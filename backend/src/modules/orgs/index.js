// Organizations: branded versions of the app for clinics and employers (docs/plans/upgrade-enterprise.md Task 3). Same
// app binary, one experience per organization: its name, a small logo, brand colours mapped onto the app's UI palette
// tokens (never its data-viz ramps), which life stages it offers (she still gets exactly one), the Shop products it shows,
// an invite code and the emails of its admins. Business data only: never anyone's health data (the server has none).
//
// Who may do what:
//   Public    GET  /api/orgs/:slug/config  the app's boot config for one organization: name, logo, colours, stages, the
//                                          Shop lineup. Never its invite code or admins.
//             POST /api/orgs/join          { slug } or { code }: the organization's config, and one is added to today's
//                                          join total for it (a count per day, nothing about who). With the app's sign-in
//                                          token (optional), the account stores which organization it joined (orgSlug).
//             POST /api/orgs/leave         { slug }: with the app's sign-in token, the account forgets the organization.
//                                          Without one, nothing is stored or changed.
//   Dashboards GET /api/orgs/mine · GET /api/orgs/:slug/stats — totals only, an owner or that organization's admins (stats.js)
//   Owner     GET /api/orgs · POST /api/orgs · PATCH /api/orgs/:slug · POST/DELETE /api/orgs/:slug/logo
//             (the portal's owner role, ADMIN_EMAILS, through the shop module's portal sign-in; a partner gets 403,
//             nobody signed in 401). The old demo x-admin-key writes are gone.
//
// Colours: the app's page and card colours stay Solia's (PAPER below); an organization sets its primary and accent for
// light and dark. Each must reach WCAG AA for text (4.5:1) against the page AND the card of its scheme; filled buttons
// carry the page colour (dark) or white (light, the card colour) on them, so the same check covers their text. The app
// checks again before it applies them (src/lib/org.js).
// Data (JSON store): orgs { slug, name, logo { file, type, bytes } | null, theme { primary, accent, dark { primary,
// accent } }, stages[], partnerIds[] | null, inviteCode, admins[], createdAt, updatedAt, createdBy, updatedBy };
// org_joins { day (UTC), slug, joins } — one row per organization per day, a total and nothing else.
import crypto from "crypto";
import fs from "fs";
import path from "path";
import express from "express";
import { rateLimiter } from "../../core/memory.js";
import { normEmail, isEmail } from "../accounts/index.js";
import { imageType } from "../shop/index.js";
import { mountStats } from "./stats.js";
import { revenueCat } from "../subscriptions/revenuecat.js";

export const basePath = "/api/orgs";
export const STAGE_IDS = Object.freeze(["cycle", "ttc", "preg", "peri", "meno"]);
export const SOLIA = Object.freeze({ slug: "cyra", name: "Solia Health" });
/* Solia's real UI palette tokens (src/lib/constants.js ORGS.cyra theme). */
export const SOLIA_THEME = Object.freeze({ primary: "#5B54A6", accent: "#A8486E", dark: Object.freeze({ primary: "#B9B3F2", accent: "#F0A3C0" }) });
export const PAPER = Object.freeze({ light: Object.freeze({ paper: "#FAF7F4", card: "#FFFFFF" }), dark: Object.freeze({ paper: "#131520", card: "#1C1F2D" }) });
export const LOGO_MAX_BYTES = 64 * 1024;
export const CAPS = Object.freeze({ name: 60, admins: 20, partners: 200, orgs: 500 });
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
const CODE_RE = /^[A-Z0-9]{6,12}$/;
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MIME = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);

/* ---------- colour checks (WCAG 2.x relative luminance) ---------- */
const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
/** The contrast ratio of two #RRGGBB colours (1 to 21). */
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** theme → a list of problems (empty when every colour passes AA 4.5:1 on its scheme's page and card). */
export function themeProblems(theme) {
  const out = [];
  const pairs = [["light", "primary", theme?.primary], ["light", "accent", theme?.accent], ["dark", "primary", theme?.dark?.primary], ["dark", "accent", theme?.dark?.accent]];
  for (const [scheme, role, hex] of pairs) {
    const name = `${scheme === "dark" ? "dark " : ""}${role}`;
    if (typeof hex !== "string" || !HEX_RE.test(hex)) { out.push(`${name} must be a colour like #5B54A6`); continue; }
    for (const surface of ["paper", "card"]) {
      const r = contrast(hex, PAPER[scheme][surface]);
      if (r < 4.5) out.push(`${name} ${hex.toUpperCase()} has ${r.toFixed(2)}:1 against the ${scheme} ${surface === "paper" ? "page" : "card"} (${PAPER[scheme][surface]}); it needs 4.5:1`);
    }
  }
  return out;
}

const plain = (v, max) => { if (typeof v !== "string") return null; const s = v.replace(/\s+/g, " ").trim(); return s && s.length <= max && ![...s].some((c) => c.charCodeAt(0) < 32 || c === "<" || c === ">") ? s : null; };
const upHex = (h) => h.toUpperCase();

/** body → { patch } or { status, error }. create: slug and name required. productIds: the catalog's ids. */
export function cleanOrg(body, { create = false, productIds = [] } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { status: 400, error: "send the organization as an object" };
  const allowed = ["slug", "name", "theme", "stages", "partnerIds", "inviteCode", "admins"];
  const unknown = Object.keys(body).filter((k) => !allowed.includes(k));
  if (unknown.length) return { status: 400, error: `unknown field: ${unknown.join(", ")}` };
  if (!create && "slug" in body) return { status: 400, error: "the slug can't be changed" };
  const patch = {};
  if (create || "slug" in body) {
    const s = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    if (!SLUG_RE.test(s)) return { status: 400, error: "the slug must be 3 to 32 lowercase letters, digits or hyphens" };
    if (s === SOLIA.slug || s === "solia") return { status: 400, error: "that slug is Solia Health's own" };
    patch.slug = s;
  }
  if (create || "name" in body) {
    const n = plain(body.name, CAPS.name);
    if (!n) return { status: 400, error: `the name must be plain text of at most ${CAPS.name} characters` };
    patch.name = n;
  }
  if ("theme" in body || create) {
    const t = body.theme || SOLIA_THEME;
    const problems = themeProblems(t);
    if (problems.length) return { status: 400, error: `colours: ${problems.join("; ")}` };
    patch.theme = { primary: upHex(t.primary), accent: upHex(t.accent), dark: { primary: upHex(t.dark.primary), accent: upHex(t.dark.accent) } };
  }
  if ("stages" in body || create) {
    const v = body.stages ?? STAGE_IDS;
    if (!Array.isArray(v) || !v.length || v.some((x) => !STAGE_IDS.includes(x))) return { status: 400, error: `stages must list at least one of ${STAGE_IDS.join(", ")}` };
    patch.stages = STAGE_IDS.filter((x) => v.includes(x));
  }
  if ("partnerIds" in body) {
    const v = body.partnerIds;
    if (v !== null && (!Array.isArray(v) || v.length > CAPS.partners || v.some((x) => typeof x !== "string" || !ID_RE.test(x) || !productIds.includes(x)))) return { status: 400, error: "partnerIds must be null (the whole Shop) or products from the catalog" };
    patch.partnerIds = v === null ? null : [...new Set(v)];
  } else if (create) patch.partnerIds = null;
  if ("inviteCode" in body) {
    const c = typeof body.inviteCode === "string" ? body.inviteCode.trim().toUpperCase() : "";
    if (!CODE_RE.test(c)) return { status: 400, error: "the invite code must be 6 to 12 letters or digits" };
    patch.inviteCode = c;
  }
  if ("admins" in body || create) {
    const v = body.admins ?? [];
    if (!Array.isArray(v) || v.length > CAPS.admins || v.some((x) => !isEmail(x))) return { status: 400, error: `admins must be at most ${CAPS.admins} email addresses` };
    patch.admins = [...new Set(v.map(normEmail))];
  }
  return { patch };
}

/** An org row → what the app may see (never the invite code or admins). logoData: the logo as a data URL, or null. */
export function publicOrg(o, logoData = null) {
  return { version: 1, slug: o.slug, name: o.name, logo: logoData, theme: o.theme, stages: [...o.stages], partnerIds: o.partnerIds ? [...o.partnerIds] : null, poweredBy: SOLIA.name };
}
export const newCode = () => Array.from(crypto.randomBytes(8), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");

export function mount(router, ctx, { clock = Date.now, rc: rcOpt = null } = {}) {
  const { store, config } = ctx;
  if (!ctx.portal) throw new Error("orgs needs the shop module (the portal's sign-in) mounted before it");
  const { auth, audit } = ctx.portal;
  const cfg = config.orgs || {};
  const dataDir = store.dir || process.env.DATA_DIR || config.storage?.dir || "./data";
  const logoDir = path.join(dataDir, "org-logos");
  fs.mkdirSync(logoDir, { recursive: true });
  const L = {
    pub: rateLimiter({ perMinute: cfg.publicPerMinute || 120 }),
    join: rateLimiter({ perMinute: cfg.joinPerMinute || 10, globalPerMinute: cfg.joinGlobalPerMinute || 1000 }),
    read: rateLimiter({ perMinute: cfg.readPerMinute || 120 }),
    write: rateLimiter({ perMinute: cfg.writePerMinute || 30, globalPerMinute: 200 }),
  };
  ctx.onShutdown?.push(async () => { for (const l of Object.values(L)) l.stop(); });
  const limited = (lim) => (req, res, next) => (lim(req.ip) ? next() : res.status(429).json({ error: "too many requests — try again in a minute" }));
  const owner = auth("owner");
  const now = () => new Date(clock()).toISOString();
  const productIds = async () => (await store.find("shop_products")).filter((p) => p.status !== "archived").map((p) => p.id);
  const logoData = (o) => {
    if (!o.logo) return null;
    try { return `data:${MIME[o.logo.type]};base64,${fs.readFileSync(path.join(logoDir, o.logo.file)).toString("base64")}`; } catch { return null; }
  };

  // Bootstrap Solia's own organization once, with its real palette tokens (and fix an older bootstrap row's theme).
  const ready = (async () => {
    const row = await store.findOne("orgs", (o) => o.slug === SOLIA.slug);
    const base = { name: SOLIA.name, theme: { ...SOLIA_THEME, dark: { ...SOLIA_THEME.dark } }, stages: [...STAGE_IDS], partnerIds: null };
    if (!row) await store.insert("orgs", { slug: SOLIA.slug, ...base, logo: null, inviteCode: null, admins: [], createdAt: now(), updatedAt: now(), createdBy: "bootstrap", updatedBy: "bootstrap" });
    else if (JSON.stringify(row.theme) !== JSON.stringify(base.theme) || JSON.stringify(row.stages) !== JSON.stringify(base.stages)) await store.update("orgs", (o) => o.slug === SOLIA.slug, { ...base, logo: row.logo || null, inviteCode: row.inviteCode || null, admins: row.admins || [] });
  })();
  ctx.orgsReady = ready;
  const findOrg = async (slug) => { await ready; return store.findOne("orgs", (o) => o.slug === slug); };
  const isSolia = (o) => o.slug === SOLIA.slug;

  /* ================= public ================= */
  router.get("/:slug/config", limited(L.pub), async (req, res) => {
    const org = await findOrg(String(req.params.slug || "").toLowerCase());
    if (!org) return res.status(404).json({ error: "unknown organization" });
    res.set({ "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" });
    res.json(publicOrg(org, logoData(org)));
  });

  router.post("/join", limited(L.join), async (req, res) => {
    res.set("cache-control", "no-store");
    const b = req.body || {};
    if (Object.keys(b).some((k) => k !== "slug" && k !== "code") || (b.slug == null) === (b.code == null)) return res.status(400).json({ error: "send the organization's slug or its invite code, and nothing else" });
    await ready;
    const org = b.slug != null
      ? await store.findOne("orgs", (o) => o.slug === String(b.slug).toLowerCase() && !isSolia(o))
      : await store.findOne("orgs", (o) => !!o.inviteCode && o.inviteCode === String(b.code).trim().toUpperCase() && !isSolia(o));
    if (!org) return res.status(404).json({ error: b.code != null ? "that invite code isn't known" : "unknown organization", why: b.code != null ? "code" : "slug" });
    const day = dayOf(clock());
    await store.apply("org_joins", (rows) => { const r = rows.find((x) => x.day === day && x.slug === org.slug); if (r) r.joins += 1; else rows.push({ day, slug: org.slug, joins: 1 }); });
    const who = ctx.accountWho ? await ctx.accountWho(req).catch(() => null) : null;
    if (who) await store.update("accounts", (a) => a.id === who.acct.id, { orgSlug: org.slug });
    res.json({ org: publicOrg(org, logoData(org)), account: !!who });
  });

  router.post("/leave", limited(L.join), async (req, res) => {
    res.set("cache-control", "no-store");
    const who = ctx.accountWho ? await ctx.accountWho(req).catch(() => null) : null;
    if (who && who.acct.orgSlug) await store.update("accounts", (a) => a.id === who.acct.id, { orgSlug: null });
    res.status(204).end();
  });

  /* ================= dashboards: owners and the organization's admins (Task 4, stats.js) ================= */
  mountStats(router, { store, auth, limited: limited(L.read), clock, rc: rcOpt || revenueCat(), isSolia });

  /* ================= owner ================= */
  const ownerView = (o) => ({ ...o, logo: o.logo ? { type: o.logo.type, bytes: o.logo.bytes, data: logoData(o) } : null });
  router.get("/", limited(L.read), owner, async (req, res) => {
    await ready;
    res.json({ orgs: (await store.find("orgs")).filter((o) => !isSolia(o)).map(ownerView), solia: publicOrg(await findOrg(SOLIA.slug)), stages: STAGE_IDS, paper: PAPER });
  });

  router.post("/", limited(L.write), owner, async (req, res) => {
    const c = cleanOrg(req.body, { create: true, productIds: await productIds() });
    if (c.error) return res.status(c.status).json({ error: c.error });
    await ready;
    const all = await store.find("orgs");
    if (all.length >= CAPS.orgs) return res.status(409).json({ error: "too many organizations" });
    if (all.some((o) => o.slug === c.patch.slug)) return res.status(409).json({ error: "that slug is taken" });
    let code = c.patch.inviteCode || newCode();
    if (all.some((o) => o.inviteCode === code)) { if (c.patch.inviteCode) return res.status(409).json({ error: "that invite code is taken" }); code = newCode(); }
    const row = { ...c.patch, inviteCode: code, logo: null, createdAt: now(), updatedAt: now(), createdBy: req.portal.email, updatedBy: req.portal.email };
    await store.insert("orgs", row);
    await audit(req.portal.email, "create", `org:${row.slug}`, { name: row.name });
    res.status(201).json({ org: ownerView(row) });
  });

  router.patch("/:slug", limited(L.write), owner, async (req, res) => {
    const org = await findOrg(String(req.params.slug));
    if (!org || isSolia(org)) return res.status(404).json({ error: "unknown organization" });
    const c = cleanOrg(req.body, { productIds: await productIds() });
    if (c.error) return res.status(c.status).json({ error: c.error });
    if (c.patch.inviteCode && (await store.find("orgs")).some((o) => o.slug !== org.slug && o.inviteCode === c.patch.inviteCode)) return res.status(409).json({ error: "that invite code is taken" });
    await store.update("orgs", (o) => o.slug === org.slug, { ...c.patch, updatedAt: now(), updatedBy: req.portal.email });
    await audit(req.portal.email, "update", `org:${org.slug}`, Object.fromEntries(Object.keys(c.patch).map((k) => [k, c.patch[k]])));
    res.json({ org: ownerView(await findOrg(org.slug)) });
  });

  const raw = express.raw({ type: () => true, limit: LOGO_MAX_BYTES });
  router.post("/:slug/logo", limited(L.write), owner, (req, res, next) => raw(req, res, (err) => {
    if (err) return res.status(err.status === 413 || err.type === "entity.too.large" ? 413 : 400).json({ error: err.status === 413 || err.type === "entity.too.large" ? "the logo is larger than 64 KB" : "the logo could not be read" });
    next();
  }), async (req, res) => {
    const org = await findOrg(String(req.params.slug));
    if (!org || isSolia(org)) return res.status(404).json({ error: "unknown organization" });
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) return res.status(400).json({ error: "send the logo file as the request body" });
    if (buf.length > LOGO_MAX_BYTES) return res.status(413).json({ error: "the logo is larger than 64 KB" });
    const type = imageType(buf);
    if (!type) return res.status(415).json({ error: "only PNG, JPEG or WebP images" });
    const file = `${org.slug}-${crypto.randomBytes(6).toString("hex")}.${type}`;
    fs.writeFileSync(path.join(logoDir, file), buf, { flag: "wx" });
    if (org.logo?.file) fs.rmSync(path.join(logoDir, org.logo.file), { force: true });
    await store.update("orgs", (o) => o.slug === org.slug, { logo: { file, type, bytes: buf.length }, updatedAt: now(), updatedBy: req.portal.email });
    await audit(req.portal.email, "logo", `org:${org.slug}`, { type, bytes: buf.length });
    res.status(201).json({ org: ownerView(await findOrg(org.slug)) });
  });

  router.delete("/:slug/logo", limited(L.write), owner, async (req, res) => {
    const org = await findOrg(String(req.params.slug));
    if (!org || isSolia(org)) return res.status(404).json({ error: "unknown organization" });
    if (org.logo?.file) fs.rmSync(path.join(logoDir, org.logo.file), { force: true });
    await store.update("orgs", (o) => o.slug === org.slug, { logo: null, updatedAt: now(), updatedBy: req.portal.email });
    await audit(req.portal.email, "logo-removed", `org:${org.slug}`);
    res.json({ org: ownerView(await findOrg(org.slug)) });
  });

  router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.warn(`[cyra] orgs: ${String(err?.type || err?.code || "error").slice(0, 40)}`);
    if (!res.headersSent) res.status(err?.status && err.status < 500 ? err.status : 500).json({ error: "something went wrong" });
  });
}
