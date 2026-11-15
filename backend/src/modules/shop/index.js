// Shop catalog and partner portal API (owner request 2026-11-15, docs/plans/partner-portal.md Task 1). Business data
// only — brands, products and the people at partner companies who edit them — NEVER anyone's health data. The app reads
// the published catalog with one plain GET that carries nothing about the person using it (no query, no id, no token).
//
// Data (JSON store under DATA_DIR, like the other modules; images as files in DATA_DIR/shop-images/):
//   shop_brands        { id, name, monogram, hue, tag, about, website, imageId, published: <snapshot>|null, changed, … }
//   shop_products      { id, brandId, name, covers, description, availability, price, url, affiliateUrl, imageId,
//                        categories[], stages[], modules[], kind, why, evidence {tone,label}|null, sources[],
//                        clinicianStatus "awaiting"|"signed", status "draft"|"pending"|"published"|"archived",
//                        published: <snapshot>|null, updatedBy, updatedAt, … }
//                      The fields are the WORKING COPY; `published` is the snapshot the public catalog serves. An edit
//                      never changes what the app shows until an owner publishes again, so a partner's change is always
//                      reviewed first.
//   shop_partners      { email, brandIds[], role: "partner", status "invited"|"active", invitedBy, createdAt, lastSignInAt }
//   shop_invites       { id, email, brandIds[], by, at }
//   shop_applications  { id, company, email, category, website, note, status "pending"|"approved"|"rejected", at, … }
//   shop_audit         { id, at, by, action, target, fields } — every change: who, what, when (newest 5000 kept)
//   shop_sessions      { sid (SHA-256 of the session id), email, createdAt, exp }
//   shop_images        { id, type, bytes, by, at }
//   shop_meta          { key: "seeded", at } — the bundled catalog was imported once (never again, even if emptied)
//
// Roles: "owner" = an address in ADMIN_EMAILS (comma list, environment); "partner" = an address an owner invited, scoped
// to its brands. A partner may edit its brands' name / about / website / image and its products' name, covers,
// description, availability, price, url, affiliateUrl and image, create products (always drafts) and submit them for
// review. A partner can NEVER publish, unpublish, archive, set why / evidence / sources / categories / stages / modules /
// kind / clinicianStatus, or touch another brand. Owners can do everything, invite and remove partners and decide
// applications. Every write checks the role on the server.
//
// Sign-in: a one-time 6-digit email code (the accounts module's code book and Resend path; a development server without
// RESEND_API_KEY logs the code), then a portal token: base64url({ a: email, s: session id, x: expiry, aud: "portal" }) +
// HMAC with a key derived from AUTH_SECRET under its own HKDF label, so an app sign-in token never opens the portal and
// back. Tokens last 8 hours; signing out or being removed ends the session at once.
// SSO hook point (not built): `ssoFor(email)` below is where a per-company OIDC sign-in would plug in later — a company
// row { domain, issuer, clientId } chosen by the email's domain, its verified email then mapped to the same roles.
//
//   Public:  GET  /api/shop/catalog            published brands and products only (ETag, Cache-Control; no parameters)
//            GET  /api/shop/images/:id         an uploaded image (long cache)
//            POST /api/shop/apply              "Apply to partner" (company, email, category, website, note)
//            GET  /api/shop/auth/config        { email: ready, sso: [] }
//   Sign-in: POST /api/shop/auth/start {email} · POST /api/shop/auth/verify {email, code} · POST /api/shop/auth/sign-out
//   Signed in (Authorization: Bearer <portal token>):
//            GET /me · GET/POST /brands · PATCH /brands/:id · POST /brands/:id/publish (owner)
//            GET/POST /products · PATCH /products/:id · POST /products/:id/{submit|publish|unpublish|archive|restore}
//            GET /products.csv · POST /images (raw png/jpeg/webp, at most 1 MB, checked by magic bytes)
//            owner: GET /partners · POST /invites · PATCH/DELETE /partners/:email · GET /applications ·
//                   POST /applications/:id/{approve|reject} · GET /audit
// Logs: never an email address, code or token in production — only fixed categories.
import crypto from "crypto";
import fs from "fs";
import path from "path";
import express from "express";
import { rateLimiter } from "../../core/memory.js";
import { codeBook, perAddress, signToken, openToken, isEmail, normEmail, resendMailer } from "../accounts/index.js";
import * as V from "./vocab.js";

export const basePath = "/api/shop";
export const TOKEN_HOURS = 8;
export const IMAGE_MAX_BYTES = 1024 * 1024;
const env = (k) => (process.env[k] || "").trim();
const HOUR = 3_600_000;

const BRAND_PARTNER = ["name", "about", "website", "imageId"];
const BRAND_OWNER = ["monogram", "hue", "tag"];
const BRAND_CONTENT = ["name", "monogram", "hue", "tag", "about", "website", "imageId"];
export const PRODUCT_PARTNER = ["name", "covers", "description", "availability", "price", "url", "affiliateUrl", "imageId"];
export const PRODUCT_OWNER = ["brandId", "categories", "stages", "modules", "kind", "why", "evidence", "sources", "clinicianStatus"];
const PRODUCT_CONTENT = ["brandId", ...PRODUCT_PARTNER, ...PRODUCT_OWNER.filter((k) => k !== "brandId")];
const LIMITS = { brands: 500, products: 3000, partners: 2000, pendingApplications: 500, imagesPer: 300, images: 5000, audit: 5000 };

/** The portal token key: AUTH_SECRET through HKDF with the portal's own label (never the app's session key). */
export function portalKey(secret) {
  if (!secret) throw new Error("AUTH_SECRET is required for the shop portal");
  return Buffer.from(crypto.hkdfSync("sha256", Buffer.from(String(secret), "utf8"), Buffer.from("cyra-portal-v1"), Buffer.from("portal token"), 32));
}
/** ADMIN_EMAILS → the owners' normalised addresses (invalid entries dropped). */
export const ownersFrom = (raw) => [...new Set(String(raw || "").split(",").map(normEmail).filter(isEmail))];
/** "png" | "jpeg" | "webp" by magic bytes, or null. */
export function imageType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 16) return null;
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && buf.subarray(12, 16).toString("latin1") === "IHDR") return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP" && /^VP8[ LX]$/.test(buf.subarray(12, 16).toString("latin1"))) return "webp";
  return null;
}
const MIME = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
/** SSO hook point (not built): the company sign-in for an address, or null for the email code. */
export const ssoFor = () => null;

const sidHash = (sid) => crypto.createHash("sha256").update(String(sid)).digest("base64url");
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k] === undefined ? null : o[k]]));
const csvCell = (v) => { let s = Array.isArray(v) ? v.join(" ") : v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const short = (v) => { const s = typeof v === "string" ? v : JSON.stringify(v); return s == null ? null : s.length > 200 ? `${s.slice(0, 199)}…` : s; };

/** Cleans one field of a brand. */
function brandField(k, v, row) {
  switch (k) {
    case "name": return V.cleanText(v, V.CAPS.brandName, { required: true });
    case "about": return V.cleanText(v, V.CAPS.about);
    case "tag": { const t = V.cleanText(v, V.CAPS.tag); return t.error ? t : { value: t.value.toUpperCase() }; }
    case "website": return V.cleanUrl(v, { required: true });
    case "monogram": return V.cleanMonogram(v, row?.name);
    case "hue": return V.cleanOne(v, V.HUES, { nullable: true });
    case "imageId": return v == null || v === "" ? { value: null } : V.IMAGE_ID_RE.test(String(v)) ? { value: String(v) } : { error: "is not an uploaded image" };
    default: return { error: "is not a field" };
  }
}
/** Cleans one field of a product. */
function productField(k, v) {
  switch (k) {
    case "brandId": return typeof v === "string" && V.ID_RE.test(v) ? { value: v } : { error: "is not a brand" };
    case "name": return V.cleanText(v, V.CAPS.productName, { required: true });
    case "covers": return V.cleanText(v, V.CAPS.covers);
    case "description": return V.cleanText(v, V.CAPS.description, { multiline: true });
    case "availability": return V.cleanOne(v, V.AVAILABILITY);
    case "price": return V.cleanPrice(v);
    case "url": return V.cleanUrl(v, { required: true });
    case "affiliateUrl": return V.cleanUrl(v);
    case "imageId": return v == null || v === "" ? { value: null } : V.IMAGE_ID_RE.test(String(v)) ? { value: String(v) } : { error: "is not an uploaded image" };
    case "categories": return V.cleanIds(v, V.CATEGORIES, { max: 3 });
    case "stages": return V.cleanIds(v, V.STAGES);
    case "modules": return V.cleanIds(v, V.MODULES);
    case "kind": return V.cleanOne(v, V.KINDS, { nullable: true });
    case "why": return V.cleanText(v, V.CAPS.why);
    case "evidence": return V.cleanEvidence(v);
    case "sources": return V.cleanSources(v);
    case "clinicianStatus": return V.cleanOne(v, V.CLINICIAN);
    default: return { error: "is not a field" };
  }
}
/** body → { patch } or { status, error }: unknown fields 400; fields the role may not set 403 (named). */
export function cleanPatch(body, role, kind, row = null) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { status: 400, error: "send a JSON object" };
  const partnerKeys = kind === "brand" ? BRAND_PARTNER : PRODUCT_PARTNER;
  const ownerKeys = kind === "brand" ? BRAND_OWNER : PRODUCT_OWNER;
  const keys = Object.keys(body);
  const unknown = keys.filter((k) => !partnerKeys.includes(k) && !ownerKeys.includes(k));
  if (unknown.length) return { status: 400, error: `unknown field${unknown.length > 1 ? "s" : ""}: ${unknown.slice(0, 5).join(", ").slice(0, 120)}` };
  const forbidden = role === "owner" ? [] : keys.filter((k) => ownerKeys.includes(k));
  if (forbidden.length) return { status: 403, error: `only an owner can set: ${forbidden.join(", ")}` };
  const patch = {};
  for (const k of keys) {
    const r = (kind === "brand" ? brandField : productField)(k, body[k], row);
    if (r.error) return { status: 400, error: `${k} ${r.error}` };
    patch[k] = r.value;
  }
  return { patch };
}

/** The public catalog from the rows: published snapshots only, nothing about who edits them. */
export function buildCatalog(brands, products) {
  const live = products.filter((p) => p.published && p.status !== "archived");
  const byId = new Map(brands.filter((b) => b.published).map((b) => [b.id, b]));
  const out = { version: 1, updatedAt: null, brands: [], products: [] };
  const used = new Set();
  for (const p of live) {
    if (!byId.has(p.published.brandId)) continue;
    used.add(p.published.brandId);
    out.products.push({ id: p.id, ...pick(p.published, PRODUCT_CONTENT) });
    if (p.publishedAt && (!out.updatedAt || p.publishedAt > out.updatedAt)) out.updatedAt = p.publishedAt;
  }
  for (const b of brands) if (used.has(b.id)) {
    out.brands.push({ id: b.id, ...pick(b.published, BRAND_CONTENT) });
    if (b.publishedAt && (!out.updatedAt || b.publishedAt > out.updatedAt)) out.updatedAt = b.publishedAt;
  }
  return out;
}

const seedFile = new URL("../../../config/shop-seed.json", import.meta.url);

export function mount(router, ctx, { clock = Date.now, sweepMs = 30_000, mailer, owners: ownersOpt } = {}) {
  const { config, store } = ctx;
  const production = !!config.production;
  const cfg = config.shop || {};
  const key = portalKey(config.authSecret);
  const owners = () => ownersOpt || ownersFrom(env("ADMIN_EMAILS"));
  const dataDir = store.dir || env("DATA_DIR") || config.storage?.dir || "./data";
  const imgDir = path.join(dataDir, "shop-images");
  fs.mkdirSync(imgDir, { recursive: true });
  const now = () => new Date(clock()).toISOString();

  // mail: Resend when configured; development without a key logs; production without one = sign-in not set up (503)
  const resend = mailer !== undefined ? mailer : resendMailer();
  const mail = resend
    ? { ready: true, dev: false, send: (to, subject, text) => resend.send(to, subject, text) }
    : production
      ? { ready: false, dev: false, send: async () => { throw Object.assign(new Error("send"), { cat: "email not configured" }); } }
      : { ready: true, dev: true, send: async (to, subject, text) => { console.log(`[cyra] shop portal (development, RESEND_API_KEY not set): ${/code/i.test(subject) ? `sign-in code for ${to} is ${(/(\d{6})/.exec(subject) || [])[1]}` : `"${subject}" for ${to}: ${text.split("\n").find((l) => /https?:/.test(l)) || ""}`}`); } };
  const portalUrl = () => `${(env("PUBLIC_BASE_URL") || env("RENDER_EXTERNAL_URL") || config.baseUrl || "").replace(/\/$/, "")}/portal/`;

  const codes = codeBook({ ttlMs: cfg.codeTtlMs || 10 * 60_000, tries: 5, clock, sweepMs });
  const perEmail = perAddress({ max: cfg.codesPerAddress || 3, clock });
  const L = {
    start: rateLimiter({ perMinute: cfg.startPerMinute || 5, globalPerMinute: 300 }),
    verify: rateLimiter({ perMinute: cfg.verifyPerMinute || 20 }),
    read: rateLimiter({ perMinute: cfg.readPerMinute || 240 }),
    write: rateLimiter({ perMinute: cfg.writePerMinute || 60, globalPerMinute: cfg.writeGlobalPerMinute || 1200 }),
    upload: rateLimiter({ perMinute: cfg.uploadPerMinute || 20, globalPerMinute: 200 }),
    apply: rateLimiter({ perMinute: cfg.applyPerMinute || 3, globalPerMinute: cfg.applyGlobalPerMinute || 30 }),
    catalog: rateLimiter({ perMinute: cfg.catalogPerMinute || 120 }),
  };
  ctx.onShutdown?.push(async () => { codes.stop(); for (const l of Object.values(L)) l.stop(); });
  const limited = (lim, msg = "too many requests — try again in a minute") => (req, res, next) => (lim(req.ip) ? next() : res.status(429).json({ error: msg }));
  const noStore = (req, res, next) => { res.set("cache-control", "no-store"); next(); };

  /* ---------- the catalog cache ---------- */
  let cached = null; // { body, etag }
  const invalidate = () => { cached = null; };
  async function catalog() {
    if (cached) return cached;
    const body = JSON.stringify(buildCatalog(await store.find("shop_brands"), await store.find("shop_products")));
    cached = { body, etag: `"${crypto.createHash("sha256").update(body).digest("base64url").slice(0, 27)}"` };
    return cached;
  }

  /* ---------- seed: the bundled catalog, once, into an empty store ---------- */
  const ready = (async () => {
    if (await store.findOne("shop_meta", (m) => m.key === "seeded")) return;
    if ((await store.find("shop_brands")).length || (await store.find("shop_products")).length) { await store.insert("shop_meta", { key: "seeded", at: now(), skipped: true }); return; }
    let seed;
    try { seed = JSON.parse(fs.readFileSync(seedFile, "utf8")); } catch { console.warn("[cyra] shop: no seed file; the catalog starts empty"); return; }
    const at = now();
    let nb = 0, np = 0;
    for (const b of seed.brands || []) {
      const c = cleanPatch(pick(b, BRAND_CONTENT), "owner", "brand", b);
      if (c.error || !V.ID_RE.test(b.id || "")) { console.warn(`[cyra] shop seed: brand skipped (${c.error || "id"})`); continue; }
      const row = { id: b.id, ...c.patch, published: { ...c.patch }, changed: false, createdAt: at, publishedAt: at, updatedBy: "seed", updatedAt: at };
      await store.insert("shop_brands", row); nb++;
    }
    const brandIds = new Set((await store.find("shop_brands")).map((b) => b.id));
    for (const p of seed.products || []) {
      const c = cleanPatch(pick(p, PRODUCT_CONTENT), "owner", "product");
      if (c.error || !V.ID_RE.test(p.id || "") || !brandIds.has(c.patch.brandId)) { console.warn(`[cyra] shop seed: product skipped (${c.error || "id or brand"})`); continue; }
      await store.insert("shop_products", { id: p.id, ...c.patch, status: "published", published: { ...c.patch }, publishedAt: at, publishedBy: "seed", createdAt: at, updatedBy: "seed", updatedAt: at }); np++;
    }
    await store.insert("shop_meta", { key: "seeded", at });
    await audit("seed", "import", "catalog", { brands: nb, products: np });
    console.log(`[cyra] shop: imported the bundled catalog (${nb} brands, ${np} products) as published`);
  })();
  ctx.shopReady = ready; // tests
  router.use(async (req, res, next) => { try { await ready; } catch { /* seeding is best effort */ } next(); });

  async function audit(by, action, target, fields = {}) {
    const row = { id: crypto.randomBytes(9).toString("base64url"), at: now(), by, action, target, fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, short(v)])) };
    await store.apply("shop_audit", (rows) => { rows.push(row); if (rows.length > LIMITS.audit) rows.splice(0, rows.length - LIMITS.audit); });
  }

  /* ---------- who is signed in ---------- */
  async function roleOf(email) {
    if (owners().includes(email)) return { role: "owner", brandIds: null };
    const p = await store.findOne("shop_partners", (r) => r.email === email);
    return p ? { role: "partner", brandIds: [...(p.brandIds || [])] } : null;
  }
  const auth = (need = "any") => async (req, res, next) => {
    res.set("cache-control", "no-store");
    const m = /^Bearer\s+(\S+)$/.exec(req.get("authorization") || "");
    const p = m && openToken(m[1], key, clock());
    if (!p || p.aud !== "portal") return res.status(401).json({ error: "not signed in" });
    const s = await store.findOne("shop_sessions", (r) => r.sid === sidHash(p.s) && r.email === p.a);
    if (!s || s.exp <= clock()) return res.status(401).json({ error: "not signed in" });
    const r = await roleOf(p.a);
    if (!r) return res.status(401).json({ error: "not signed in" });
    if (need === "owner" && r.role !== "owner") return res.status(403).json({ error: "only an owner can do this" });
    req.portal = { email: p.a, sid: s.sid, ...r };
    next();
  };
  const mayBrand = (who, brandId) => who.role === "owner" || who.brandIds.includes(brandId);
  const reading = limited(L.read), writing = limited(L.write);

  /** An image id a user may attach: it exists and, for a partner, they uploaded it. */
  async function imageOk(who, id) {
    if (id == null) return true;
    const img = await store.findOne("shop_images", (i) => i.id === id);
    return !!img && (who.role === "owner" || img.by === who.email);
  }

  /* ================= public ================= */
  router.get("/catalog", limited(L.catalog), async (req, res) => {
    const c = await catalog();
    res.set({ "cache-control": "public, max-age=300", etag: c.etag, "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" });
    if ((req.get("if-none-match") || "").split(/\s*,\s*/).includes(c.etag)) return res.status(304).end();
    res.send(c.body);
  });

  router.get("/images/:id", limited(L.catalog), async (req, res) => {
    const id = String(req.params.id || "");
    if (!V.IMAGE_ID_RE.test(id)) return res.status(404).json({ error: "no such image" });
    const img = await store.findOne("shop_images", (i) => i.id === id);
    if (!img || !MIME[img.type]) return res.status(404).json({ error: "no such image" });
    const file = path.join(imgDir, `${id}.${img.type}`);
    if (!fs.existsSync(file)) return res.status(404).json({ error: "no such image" });
    res.set({ "content-type": MIME[img.type], "cache-control": "public, max-age=31536000, immutable", etag: `"${id}"`, "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox", "cross-origin-resource-policy": "cross-origin" });
    if (req.get("if-none-match") === `"${id}"`) return res.status(304).end();
    res.send(fs.readFileSync(file));
  });

  router.post("/apply", noStore, limited(L.apply, "too many applications from here — try again in a few minutes"), async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    if (b.nickname) return res.json({ received: true }); // the form's hidden honeypot: a bot filled it; nothing is kept
    const company = V.cleanText(b.company, V.CAPS.company, { required: true });
    const email = normEmail(b.email);
    const category = V.cleanOne(b.category, V.CATEGORIES);
    const website = V.cleanUrl(b.website, { required: true });
    const note = V.cleanText(b.note, V.CAPS.note, { multiline: true });
    const bad = [company.error && `company ${company.error}`, !isEmail(email) && "email address not valid", category.error && `category ${category.error}`, website.error && `website ${website.error}`, note.error && `note ${note.error}`].filter(Boolean);
    if (bad.length) return res.status(400).json({ error: bad.join("; ") });
    if ((await store.find("shop_applications", (a) => a.status === "pending")).length >= LIMITS.pendingApplications) return res.status(503).json({ error: "applications are paused for now — try again later" });
    const row = { id: crypto.randomBytes(9).toString("base64url"), company: company.value, email, category: category.value, website: website.value, note: note.value, status: "pending", at: now() };
    await store.insert("shop_applications", row);
    await audit("public", "apply", `application:${row.id}`, { company: row.company });
    res.status(201).json({ received: true });
  });

  router.get("/auth/config", noStore, (req, res) => res.json({ email: mail.ready === true, sso: [] }));

  /* ================= sign-in ================= */
  router.post("/auth/start", noStore, limited(L.start), async (req, res) => {
    const email = normEmail(req.body?.email);
    if (!isEmail(email)) return res.status(400).json({ error: "email address not valid" });
    if (!mail.ready) return res.status(503).json({ error: "email sign-in is not set up on this server" });
    if (!perEmail(email)) return res.status(429).json({ error: "too many codes for this address — try again in a few minutes" });
    const ok = ssoFor(email) == null && (await roleOf(email));
    // The same answer for an address with no portal access, so the form can't be used to find out who has one.
    if (ok) {
      const code = codes.issue(email);
      try {
        await mail.send(email, `Your Solia Health partner portal code: ${code}`, `Your Solia Health partner portal sign-in code is ${code}.\n\nIt works once, for 10 minutes. If you didn't ask for it, you can ignore this email.`);
      } catch (e) { codes.drop(email); console.warn(`[cyra] shop portal: code not sent (${e?.cat || "network"})`); return res.status(502).json({ error: "the code couldn't be sent — try again" }); }
    }
    res.json({ sent: true, ...(mail.dev ? { dev: true } : {}) });
  });

  router.post("/auth/verify", noStore, limited(L.verify, "too many tries — wait a minute"), async (req, res) => {
    const email = normEmail(req.body?.email);
    if (!isEmail(email)) return res.status(400).json({ error: "email address not valid" });
    const r = codes.check(email, req.body?.code);
    if (r === "wrong") return res.status(401).json({ error: "that code isn't right", why: "wrong" });
    if (r === "locked") return res.status(401).json({ error: "too many wrong codes — ask for a new one", why: "locked" });
    if (r !== "ok") return res.status(401).json({ error: "that code has expired — ask for a new one", why: "expired" });
    const role = await roleOf(email);
    if (!role) return res.status(401).json({ error: "this address has no portal access", why: "none" });
    const t = clock();
    await store.remove("shop_sessions", (s) => s.exp <= t);
    const sid = crypto.randomBytes(24).toString("base64url");
    const exp = t + TOKEN_HOURS * HOUR;
    await store.insert("shop_sessions", { sid: sidHash(sid), email, createdAt: now(), exp });
    if (role.role === "partner") await store.update("shop_partners", (p) => p.email === email, { status: "active", lastSignInAt: now() });
    await audit(email, "sign-in", `person:${email}`);
    res.json({ token: signToken({ a: email, s: sid, x: exp, aud: "portal" }, key), me: { email, ...role }, expiresAt: new Date(exp).toISOString() });
  });

  router.post("/auth/sign-out", auth(), async (req, res) => {
    await store.remove("shop_sessions", (s) => s.sid === req.portal.sid);
    res.sendStatus(204);
  });

  router.get("/me", reading, auth(), (req, res) => res.json({ me: { email: req.portal.email, role: req.portal.role, brandIds: req.portal.brandIds } }));

  /* ================= brands ================= */
  router.get("/brands", reading, auth(), async (req, res) => {
    res.json({ brands: await store.find("shop_brands", (b) => mayBrand(req.portal, b.id)) });
  });

  router.post("/brands", writing, auth("owner"), async (req, res) => {
    const c = cleanPatch(req.body, "owner", "brand", req.body);
    if (c.error) return res.status(c.status).json({ error: c.error });
    if (!c.patch.name || !c.patch.website) return res.status(400).json({ error: "name and website are required" });
    const r = await createBrand(c.patch, req.portal.email);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.status(201).json({ brand: r.brand });
  });
  async function createBrand(fields, by) {
    const all = await store.find("shop_brands");
    if (all.length >= LIMITS.brands) return { status: 409, error: "too many brands" };
    if (all.some((b) => b.name.toLowerCase() === fields.name.toLowerCase())) return { status: 409, error: "a brand with this name exists" };
    let id = V.slug(fields.name);
    while (all.some((b) => b.id === id)) id = `${V.slug(fields.name).slice(0, 35)}-${crypto.randomBytes(2).toString("hex")}`;
    const at = now();
    const brand = { id, name: fields.name, monogram: fields.monogram || V.monogramOf(fields.name), hue: fields.hue || null, tag: fields.tag || "", about: fields.about || "", website: fields.website, imageId: fields.imageId || null, published: null, changed: true, createdAt: at, updatedBy: by, updatedAt: at };
    await store.insert("shop_brands", brand);
    await audit(by, "create", `brand:${id}`, pick(brand, BRAND_CONTENT));
    return { brand };
  }

  router.patch("/brands/:id", writing, auth(), async (req, res) => {
    const brand = await store.findOne("shop_brands", (b) => b.id === req.params.id);
    if (!brand || !mayBrand(req.portal, brand.id)) return res.status(404).json({ error: "no such brand" });
    const c = cleanPatch(req.body, req.portal.role, "brand", brand);
    if (c.error) return res.status(c.status).json({ error: c.error });
    if (c.patch.name && (await store.findOne("shop_brands", (b) => b.id !== brand.id && b.name.toLowerCase() === c.patch.name.toLowerCase()))) return res.status(409).json({ error: "a brand with this name exists" });
    if ("imageId" in c.patch && !(await imageOk(req.portal, c.patch.imageId))) return res.status(400).json({ error: "imageId is not an image you uploaded" });
    const changed = Object.keys(c.patch).filter((k) => JSON.stringify(brand[k]) !== JSON.stringify(c.patch[k]));
    if (!changed.length) return res.json({ brand });
    const patch = { ...pick(c.patch, changed), changed: true, updatedBy: req.portal.email, updatedAt: now() };
    await store.update("shop_brands", (b) => b.id === brand.id, patch);
    await audit(req.portal.email, "edit", `brand:${brand.id}`, pick(c.patch, changed));
    res.json({ brand: { ...brand, ...patch } });
  });

  router.post("/brands/:id/publish", writing, auth("owner"), async (req, res) => {
    const brand = await store.findOne("shop_brands", (b) => b.id === req.params.id);
    if (!brand) return res.status(404).json({ error: "no such brand" });
    const at = now();
    const patch = { published: pick(brand, BRAND_CONTENT), publishedAt: at, changed: false };
    await store.update("shop_brands", (b) => b.id === brand.id, patch);
    invalidate();
    await audit(req.portal.email, "publish", `brand:${brand.id}`);
    res.json({ brand: { ...brand, ...patch } });
  });

  /* ================= products ================= */
  const visibleProducts = (who) => store.find("shop_products", (p) => mayBrand(who, p.brandId));

  router.get("/products", reading, auth(), async (req, res) => res.json({ products: await visibleProducts(req.portal) }));

  router.get("/products.csv", reading, auth(), async (req, res) => {
    const brands = new Map((await store.find("shop_brands")).map((b) => [b.id, b.name]));
    const cols = ["id", "brand", "name", "status", "live", "availability", "price", "url", "affiliateUrl", "categories", "stages", "modules", "clinicianStatus", "updatedBy", "updatedAt"];
    const rows = (await visibleProducts(req.portal)).map((p) => ({ ...p, brand: brands.get(p.brandId) || p.brandId, live: p.published ? "yes" : "no" }));
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\r\n") + "\r\n";
    res.set({ "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="shop-products.csv"' });
    res.send(csv);
  });

  router.post("/products", writing, auth(), async (req, res) => {
    // brandId names the brand on create (a partner may name only its own brands); every other field is cleaned by role
    const { brandId: rawBrand, ...rest } = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const brandId = typeof rawBrand === "string" ? rawBrand : "";
    const c = cleanPatch(rest, req.portal.role, "product");
    if (c.error) return res.status(c.status).json({ error: c.error });
    const fields = c.patch;
    const brand = await store.findOne("shop_brands", (b) => b.id === brandId);
    if (!brand || !mayBrand(req.portal, brandId)) return res.status(404).json({ error: "no such brand" });
    if (!fields.name || !fields.url) return res.status(400).json({ error: "name and url are required" });
    if ("imageId" in fields && !(await imageOk(req.portal, fields.imageId))) return res.status(400).json({ error: "imageId is not an image you uploaded" });
    const all = await store.find("shop_products");
    if (all.length >= LIMITS.products) return res.status(409).json({ error: "too many products" });
    let id;
    do id = `${V.slug(fields.name).slice(0, 38)}-${crypto.randomBytes(3).toString("hex")}`; while (all.some((p) => p.id === id));
    const at = now();
    const row = {
      id, brandId, name: "", covers: "", description: "", availability: "online", price: "", url: "", affiliateUrl: "", imageId: null,
      categories: [], stages: [], modules: [], kind: null, why: "", evidence: null, sources: [], clinicianStatus: "awaiting",
      ...fields, status: "draft", published: null, createdAt: at, updatedBy: req.portal.email, updatedAt: at,
    };
    await store.insert("shop_products", row);
    await audit(req.portal.email, "create", `product:${id}`, pick(row, PRODUCT_CONTENT));
    res.status(201).json({ product: row });
  });

  async function productFor(req, res) {
    const p = await store.findOne("shop_products", (x) => x.id === req.params.id);
    if (!p || !mayBrand(req.portal, p.brandId)) { res.status(404).json({ error: "no such product" }); return null; }
    return p;
  }

  router.patch("/products/:id", writing, auth(), async (req, res) => {
    const p = await productFor(req, res); if (!p) return;
    if (p.status === "archived" && req.portal.role !== "owner") return res.status(409).json({ error: "this product is archived" });
    const c = cleanPatch(req.body, req.portal.role, "product");
    if (c.error) return res.status(c.status).json({ error: c.error });
    if (c.patch.brandId && !(await store.findOne("shop_brands", (b) => b.id === c.patch.brandId))) return res.status(400).json({ error: "brandId is not a brand" });
    if ("imageId" in c.patch && !(await imageOk(req.portal, c.patch.imageId))) return res.status(400).json({ error: "imageId is not an image you uploaded" });
    const changed = Object.keys(c.patch).filter((k) => JSON.stringify(p[k]) !== JSON.stringify(c.patch[k]));
    if (!changed.length) return res.json({ product: p });
    // An edit never changes the live catalog: a published product gets unpublished changes (draft); a partner's edit to
    // a product waiting for review sends it back to draft, to be submitted again.
    const status = p.status === "published" ? "draft" : p.status === "pending" && req.portal.role === "partner" ? "draft" : p.status;
    const patch = { ...pick(c.patch, changed), status, updatedBy: req.portal.email, updatedAt: now() };
    await store.update("shop_products", (x) => x.id === p.id, patch);
    await audit(req.portal.email, "edit", `product:${p.id}`, pick(c.patch, changed));
    res.json({ product: { ...p, ...patch } });
  });

  const action = (name, need, fn) => router.post(`/products/:id/${name}`, writing, auth(need), async (req, res) => {
    const p = await productFor(req, res); if (!p) return;
    const r = await fn(p, req.portal);
    if (r.error) return res.status(r.status || 409).json({ error: r.error });
    const patch = { ...r.patch, updatedBy: req.portal.email, updatedAt: now() };
    await store.update("shop_products", (x) => x.id === p.id, patch);
    invalidate();
    await audit(req.portal.email, name, `product:${p.id}`, r.fields || {});
    res.json({ product: { ...p, ...patch } });
  });
  action("submit", "any", async (p) => (p.status !== "draft" ? { error: `only a draft can be submitted (this one is ${p.status})` } : !p.name || !p.url ? { status: 400, error: "name and url are required" } : { patch: { status: "pending" } }));
  action("publish", "owner", async (p, who) => {
    if (p.status === "archived") return { error: "restore it first" };
    const missing = [!p.name && "name", !p.url && "url", !p.availability && "availability", !(p.categories || []).length && "a category"].filter(Boolean);
    if (missing.length) return { status: 400, error: `needs ${missing.join(", ")} before it can be published` };
    const brand = await store.findOne("shop_brands", (b) => b.id === p.brandId);
    if (!brand) return { status: 400, error: "its brand is missing" };
    const at = now();
    if (!brand.published) {
      await store.update("shop_brands", (b) => b.id === brand.id, { published: pick(brand, BRAND_CONTENT), publishedAt: at, changed: false });
      await audit(who.email, "publish", `brand:${brand.id}`, { with: p.id });
    }
    return { patch: { status: "published", published: pick(p, PRODUCT_CONTENT), publishedAt: at, publishedBy: who.email } };
  });
  action("unpublish", "owner", async (p) => (!p.published ? { error: "it isn't published" } : { patch: { status: "draft", published: null } }));
  action("archive", "owner", async (p) => (p.status === "archived" ? { error: "already archived" } : { patch: { status: "archived", published: null } }));
  action("restore", "owner", async (p) => (p.status !== "archived" ? { error: "it isn't archived" } : { patch: { status: "draft" } }));

  /* ================= images ================= */
  const raw = express.raw({ type: () => true, limit: IMAGE_MAX_BYTES });
  router.post("/images", limited(L.upload), auth(), (req, res, next) => raw(req, res, (err) => {
    if (err) return res.status(err.status === 413 || err.type === "entity.too.large" ? 413 : 400).json({ error: err.status === 413 || err.type === "entity.too.large" ? "the image is larger than 1 MB" : "the image could not be read" });
    next();
  }), async (req, res) => {
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) return res.status(400).json({ error: "send the image file as the request body" });
    if (buf.length > IMAGE_MAX_BYTES) return res.status(413).json({ error: "the image is larger than 1 MB" });
    const type = imageType(buf);
    if (!type) return res.status(415).json({ error: "only PNG, JPEG or WebP images" });
    const all = await store.find("shop_images");
    if (all.length >= LIMITS.images || all.filter((i) => i.by === req.portal.email).length >= LIMITS.imagesPer) return res.status(409).json({ error: "too many images" });
    const id = crypto.randomBytes(12).toString("hex");
    fs.writeFileSync(path.join(imgDir, `${id}.${type}`), buf, { flag: "wx" });
    const row = { id, type, bytes: buf.length, by: req.portal.email, at: now() };
    await store.insert("shop_images", row);
    await audit(req.portal.email, "upload", `image:${id}`, { type, bytes: buf.length });
    res.status(201).json({ image: { id, type, bytes: buf.length, url: `${basePath}/images/${id}` } });
  });

  /* ================= partners, invites, applications, audit (owner) ================= */
  router.get("/partners", reading, auth("owner"), async (req, res) => {
    res.json({ owners: owners(), partners: await store.find("shop_partners"), invites: (await store.find("shop_invites")).slice(-200).reverse() });
  });

  async function invite(email, brandIds, by) {
    if (owners().includes(email)) return { status: 400, error: "this address is an owner already" };
    const known = new Set((await store.find("shop_brands")).map((b) => b.id));
    if (!brandIds.length || brandIds.some((b) => !known.has(b))) return { status: 400, error: "brandIds must name at least one brand" };
    const existing = await store.findOne("shop_partners", (p) => p.email === email);
    if (!existing && (await store.find("shop_partners")).length >= LIMITS.partners) return { status: 409, error: "too many partners" };
    const merged = [...new Set([...(existing?.brandIds || []), ...brandIds])];
    if (existing) await store.update("shop_partners", (p) => p.email === email, { brandIds: merged });
    else await store.insert("shop_partners", { email, brandIds: merged, role: "partner", status: "invited", invitedBy: by, createdAt: now(), lastSignInAt: null });
    await store.insert("shop_invites", { id: crypto.randomBytes(9).toString("base64url"), email, brandIds, by, at: now() });
    await audit(by, "invite", `person:${email}`, { brandIds });
    let emailed = false;
    try {
      if (mail.ready) {
        const names = (await store.find("shop_brands", (b) => brandIds.includes(b.id))).map((b) => b.name).join(", ");
        await mail.send(email, "You're invited to the Solia Health partner portal", `You've been invited to manage ${names} in the Solia Health partner portal.\n\nSign in with this email address at ${portalUrl()}\nYou'll get a one-time code by email each time; there is no password.`);
        emailed = true;
      }
    } catch (e) { console.warn(`[cyra] shop portal: invitation not sent (${e?.cat || "network"})`); }
    return { partner: await store.findOne("shop_partners", (p) => p.email === email), emailed };
  }

  router.post("/invites", writing, auth("owner"), async (req, res) => {
    const email = normEmail(req.body?.email);
    if (!isEmail(email)) return res.status(400).json({ error: "email address not valid" });
    const ids = V.cleanIds(req.body?.brandIds, (await store.find("shop_brands")).map((b) => b.id), { min: 1, max: 50 });
    if (ids.error) return res.status(400).json({ error: `brandIds ${ids.error.slice(0, 60)}` });
    const r = await invite(email, ids.value, req.portal.email);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.status(201).json(r);
  });

  router.patch("/partners/:email", writing, auth("owner"), async (req, res) => {
    const email = normEmail(req.params.email);
    const p = await store.findOne("shop_partners", (x) => x.email === email);
    if (!p) return res.status(404).json({ error: "no such partner" });
    const ids = V.cleanIds(req.body?.brandIds, (await store.find("shop_brands")).map((b) => b.id), { min: 1, max: 50 });
    if (ids.error) return res.status(400).json({ error: `brandIds ${ids.error.slice(0, 60)}` });
    await store.update("shop_partners", (x) => x.email === email, { brandIds: ids.value });
    await audit(req.portal.email, "edit", `person:${email}`, { brandIds: ids.value });
    res.json({ partner: { ...p, brandIds: ids.value } });
  });

  router.delete("/partners/:email", writing, auth("owner"), async (req, res) => {
    const email = normEmail(req.params.email);
    const n = await store.remove("shop_partners", (x) => x.email === email);
    if (!n) return res.status(404).json({ error: "no such partner" });
    await store.remove("shop_sessions", (s) => s.email === email);
    await audit(req.portal.email, "remove", `person:${email}`);
    res.sendStatus(204);
  });

  router.get("/applications", reading, auth("owner"), async (req, res) => res.json({ applications: (await store.find("shop_applications")).slice().reverse() }));

  router.post("/applications/:id/approve", writing, auth("owner"), async (req, res) => {
    const a = await store.findOne("shop_applications", (x) => x.id === req.params.id);
    if (!a) return res.status(404).json({ error: "no such application" });
    if (a.status !== "pending") return res.status(409).json({ error: `already ${a.status}` });
    const name = V.cleanText(req.body?.brandName ?? a.company, V.CAPS.brandName, { required: true });
    if (name.error) return res.status(400).json({ error: `brandName ${name.error}` });
    const b = await createBrand({ name: name.value, website: a.website }, req.portal.email);
    if (b.error) return res.status(b.status).json({ error: b.error });
    const inv = await invite(a.email, [b.brand.id], req.portal.email);
    if (inv.error) return res.status(inv.status).json({ error: inv.error });
    await store.update("shop_applications", (x) => x.id === a.id, { status: "approved", brandId: b.brand.id, decidedBy: req.portal.email, decidedAt: now() });
    await audit(req.portal.email, "approve", `application:${a.id}`, { brandId: b.brand.id });
    res.json({ brand: b.brand, partner: inv.partner, emailed: inv.emailed });
  });

  router.post("/applications/:id/reject", writing, auth("owner"), async (req, res) => {
    const a = await store.findOne("shop_applications", (x) => x.id === req.params.id);
    if (!a) return res.status(404).json({ error: "no such application" });
    if (a.status !== "pending") return res.status(409).json({ error: `already ${a.status}` });
    await store.update("shop_applications", (x) => x.id === a.id, { status: "rejected", decidedBy: req.portal.email, decidedAt: now() });
    await audit(req.portal.email, "reject", `application:${a.id}`);
    res.json({ ok: true });
  });

  router.get("/audit", reading, auth("owner"), async (req, res) => {
    const n = Math.min(1000, Math.max(1, Number.parseInt(req.query.limit, 10) || 200));
    res.json({ audit: (await store.find("shop_audit")).slice(-n).reverse() });
  });

  // anything thrown in a route: a plain answer, never a stack trace or the body
  router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.warn(`[cyra] shop: ${String(err?.type || err?.code || "error").slice(0, 40)}`);
    if (!res.headersSent) res.status(err?.status && err.status < 500 ? err.status : 500).json({ error: "something went wrong" });
  });
}
