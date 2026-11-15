// Subscriptions, promotions, Pro grants and partner codes for the partner portal (owner request 2026-11-15,
// docs/plans/portal-subscriptions.md Task 1). Business data only: never anyone's health data, never her life stage.
//
// Store rules: prices, trials and discounts exist ONLY in App Store Connect / Play Console. Nothing here holds a price.
// A promotion names a RevenueCat offering (created there first); the app shows only the prices the store returns for it.
//
// RevenueCat: every endpoint is in ./revenuecat.js ("verify against RevenueCat's current API docs before go-live"). Without
// REVENUECAT_SECRET_KEY and REVENUECAT_PROJECT_ID the module still mounts; the dashboard says "not configured" and names
// those variables, and grants are refused (503) before any request. The secret key is never logged or sent to a browser.
//
// Who may do what: everything is OWNER-ONLY (the portal's owner role, ADMIN_EMAILS), checked on the server for every route,
// except two partner reads: a partner sees the codes assigned to its own brands (counts and its available codes) and can
// download its available codes. Partners never see revenue, metrics, promotions or grants.
//
// Data (JSON store under DATA_DIR):
//   subs_promotions  { id, name, offeringId, platforms[], audience { who, stages[] }, startsAt, endsAt, banner { title, body },
//                      enabled, stoppedAt, createdBy, createdAt, updatedBy, updatedAt }
//                    status (computed): draft (never started) | scheduled | live | ended (stopped or past its end)
//   subs_grants      { id, email, accountIds[], duration, note, status "granted"|"queued"|"revoked"|"cancelled"|"failed",
//                      expiresAt, by, at, appliedAt?, revokedAt?, revokedBy?, error? }
//   subs_batches     { id, label, platform "ios"|"android", offerRef, expiresAt, brandId, count, by, at }
//   subs_codes       { id, batchId, code, status "available"|"given"|"redeemed", markedAt?, markedBy? }
// Audit: every change goes to the portal's audit log (shop_audit), so Activity lists it.
//
//   Public:   GET /api/promotions/active                     live promotions only: no names, nothing about anyone; no query
//   Owner:    GET /api/subscriptions/config | metrics | offerings
//             GET/POST /api/subscriptions/promotions · PATCH/DELETE /promotions/:id · POST /promotions/:id/{start|stop}
//             GET/POST /api/subscriptions/grants · POST /grants/:id/revoke
//             POST /api/subscriptions/codes/batches · GET/PATCH/DELETE /codes/batches/:id · POST /codes/mark
//   Owner and partner (partner: its own brands only): GET /api/subscriptions/codes · GET /api/subscriptions/codes.csv
import crypto from "crypto";
import { rateLimiter } from "../../core/memory.js";
import { normEmail, isEmail } from "../accounts/index.js";
import * as V from "../shop/vocab.js";
import { revenueCat, RcError, RC_DURATIONS, RC_ENV } from "./revenuecat.js";

export const basePath = "/api";
export const PLATFORMS = Object.freeze(["ios", "android", "web"]);
export const CODE_PLATFORMS = Object.freeze(["ios", "android"]);
export const AUDIENCE = Object.freeze(["everyone", "new", "stages"]);
export const CAPS = Object.freeze({ name: 80, title: 40, body: 120, note: 200, label: 80, offerRef: 100, promotions: 200, grantsAtOnce: 500, grants: 20_000, batchCodes: 2000, codes: 50_000, batches: 1000, emailsText: 60_000, codesText: 90_000 });
export const METRICS_TTL_MS = 5 * 60_000;
const ERROR_TTL_MS = 60_000;
const OFFERING_RE = /^[A-Za-z0-9_.$-]{1,100}$/;
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9-]{3,63}$/;
const ID_RE = /^[A-Za-z0-9_-]{6,40}$/;
const YEAR = 366 * 86_400_000;
const newId = () => crypto.randomBytes(9).toString("base64url");
const csvCell = (v) => { let s = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const isoOf = (v) => { if (typeof v !== "string" || v.length > 40) return null; const t = Date.parse(v); return Number.isNaN(t) ? null : new Date(t).toISOString(); };

/* ================= pure parts (tested) ================= */

/** draft | scheduled | live | ended, at `now` (ms). */
export function promoStatus(p, now = Date.now()) {
  if (!p.enabled) return p.stoppedAt ? "ended" : "draft";
  if (Date.parse(p.endsAt) <= now) return "ended";
  if (Date.parse(p.startsAt) > now) return "scheduled";
  return "live";
}

/** The public list: live promotions only, with only what the app needs to decide on the device. Newest start first. */
export function activePromotions(rows, now = Date.now()) {
  return rows.filter((p) => promoStatus(p, now) === "live")
    .sort((a, b) => (a.startsAt < b.startsAt ? 1 : a.startsAt > b.startsAt ? -1 : 0))
    .map((p) => ({ id: p.id, offeringId: p.offeringId, platforms: [...p.platforms], audience: { who: p.audience.who, stages: p.audience.who === "stages" ? [...p.audience.stages] : [] }, startsAt: p.startsAt, endsAt: p.endsAt, banner: { title: p.banner.title, body: p.banner.body } }));
}

/** body (+ the row being edited) → { value } | { error }. Every field is required on create; an edit may send some. */
export function cleanPromotion(body, row = null) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "send a JSON object" };
  const allowed = ["name", "offeringId", "platforms", "audience", "startsAt", "endsAt", "banner"];
  const unknown = Object.keys(body).filter((k) => !allowed.includes(k));
  if (unknown.length) return { error: `unknown field: ${unknown.slice(0, 3).join(", ").slice(0, 60)}` };
  const merged = { ...(row || {}), ...body };
  const name = V.cleanText(merged.name, CAPS.name, { required: true });
  if (name.error) return { error: `name ${name.error}` };
  if (typeof merged.offeringId !== "string" || !OFFERING_RE.test(merged.offeringId.trim())) return { error: "offeringId must be a RevenueCat offering identifier (letters, digits, _ . $ -)" };
  const platforms = V.cleanIds(merged.platforms, PLATFORMS, { min: 1, max: 3 });
  if (platforms.error) return { error: "platforms must name at least one of ios, android, web" };
  const a = merged.audience && typeof merged.audience === "object" ? merged.audience : {};
  if (!AUDIENCE.includes(a.who)) return { error: "audience.who must be everyone, new or stages" };
  let stages = [];
  if (a.who === "stages") {
    const s = V.cleanIds(a.stages, V.STAGES, { min: 1 });
    if (s.error) return { error: "audience.stages must name at least one stage" };
    stages = s.value;
  }
  const startsAt = isoOf(merged.startsAt), endsAt = isoOf(merged.endsAt);
  if (!startsAt) return { error: "startsAt must be a date and time" };
  if (!endsAt) return { error: "endsAt must be a date and time" };
  if (Date.parse(endsAt) <= Date.parse(startsAt)) return { error: "endsAt must be after startsAt" };
  if (Date.parse(endsAt) - Date.parse(startsAt) > YEAR) return { error: "a promotion can run for at most a year" };
  const b = merged.banner && typeof merged.banner === "object" ? merged.banner : {};
  const title = V.cleanText(b.title, CAPS.title, { required: true });
  if (title.error) return { error: `banner title ${title.error}` };
  const text = V.cleanText(b.body, CAPS.body, { required: true });
  if (text.error) return { error: `banner text ${text.error}` };
  // A price, percentage or "free" claim in the banner would be the portal inventing an offer: the store's own price is
  // shown beside it by the app. Refuse currency amounts and percentages outright.
  if (/[$£€¥₹]\s?\d|\d\s?(%|(percent|usd|eur|gbp)\b)/i.test(`${title.value} ${text.value}`)) return { error: "the banner can't name a price or a percentage: the app shows the store's own price next to it" };
  return { value: { name: name.value, offeringId: merged.offeringId.trim(), platforms: platforms.value, audience: { who: a.who, stages }, startsAt, endsAt, banner: { title: title.value, body: text.value } } };
}

/** Pasted text or CSV → { emails[] (normalised, unique), invalid[] (at most 50 shown) }. Words without "@" are ignored. */
export function parseEmails(text) {
  const out = new Set(), invalid = [];
  for (const raw of String(text || "").split(/[\s,;]+/)) {
    const t = raw.replace(/^[<"'(]+|[>"')]+$/g, "");
    if (!t.includes("@")) continue;
    const e = normEmail(t);
    if (isEmail(e)) out.add(e); else if (invalid.length < 50) invalid.push(t.slice(0, 80));
  }
  return { emails: [...out], invalid };
}

/** Pasted text or CSV (one code per line, first column) → { codes[] (unique), invalid (count) }. A header "code" is skipped. */
export function parseCodes(text) {
  const out = new Set();
  let invalid = 0;
  for (const line of String(text || "").split(/\r?\n/)) {
    const c = line.split(/[,;\t]/)[0].trim().replace(/^"|"$/g, "");
    if (!c || /^code$/i.test(c)) continue;
    if (CODE_RE.test(c)) out.add(c); else invalid++;
  }
  return { codes: [...out], invalid };
}

const countsOf = (codes, now, batches) => {
  const c = { available: 0, given: 0, redeemed: 0, expired: 0 };
  for (const x of codes) {
    const b = batches.get(x.batchId);
    if (x.status === "available" && b?.expiresAt && Date.parse(b.expiresAt) <= now) c.expired++;
    else c[x.status] = (c[x.status] || 0) + 1;
  }
  return c;
};

/* ================= the routes ================= */
export function mount(router, ctx, { clock = Date.now, rc: rcOpt = null } = {}) {
  const { config, store } = ctx;
  if (!ctx.portal) throw new Error("subscriptions needs the shop module (the portal's sign-in) mounted before it");
  const { auth, audit } = ctx.portal;
  const rc = rcOpt || revenueCat();
  const cfg = config.subscriptions || {};
  const now = () => new Date(clock()).toISOString();
  const L = {
    pub: rateLimiter({ perMinute: cfg.publicPerMinute || 120 }),
    read: rateLimiter({ perMinute: cfg.readPerMinute || 240 }),
    write: rateLimiter({ perMinute: cfg.writePerMinute || 60, globalPerMinute: 1200 }),
    grant: rateLimiter({ perMinute: cfg.grantPerMinute || 20, globalPerMinute: 200 }),
  };
  ctx.onShutdown?.push(async () => { for (const l of Object.values(L)) l.stop(); });
  const limited = (lim) => (req, res, next) => (lim(req.ip) ? next() : res.status(429).json({ error: "too many requests — try again in a minute" }));
  const reading = limited(L.read), writing = limited(L.write);
  const owner = auth("owner"), anyone = auth();
  const notConfigured = () => ({ error: `RevenueCat isn't set up on this server: set ${rc.missing.length ? rc.missing.join(" and ") : `${RC_ENV.key} and ${RC_ENV.project}`} in the server's environment`, missing: rc.missing });

  /* ---------- public: the live promotions (nothing about anyone, no parameters) ---------- */
  let pubCache = null; // { body, etag, until }
  const invalidate = () => { pubCache = null; };
  router.get("/promotions/active", limited(L.pub), async (req, res) => {
    const t = clock();
    if (!pubCache || pubCache.until <= t) {
      const rows = await store.find("subs_promotions");
      const body = JSON.stringify({ version: 1, promotions: activePromotions(rows, t) });
      // re-read at the next start or end of any promotion, and at least every minute
      const edges = rows.flatMap((p) => [Date.parse(p.startsAt), Date.parse(p.endsAt)]).filter((x) => x > t);
      pubCache = { body, etag: `"${crypto.createHash("sha256").update(body).digest("base64url").slice(0, 27)}"`, until: Math.min(t + 60_000, ...edges) };
    }
    res.set({ "cache-control": "public, max-age=300", etag: pubCache.etag, "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" });
    if ((req.get("if-none-match") || "").split(/\s*,\s*/).includes(pubCache.etag)) return res.status(304).end();
    res.send(pubCache.body);
  });

  /* ---------- owner: configuration and metrics ---------- */
  router.get("/subscriptions/config", reading, owner, (req, res) => {
    res.json({ configured: rc.configured, missing: rc.missing, entitlement: rc.entitlement, durations: RC_DURATIONS, env: { key: RC_ENV.key, project: RC_ENV.project, entitlement: RC_ENV.entitlement } });
  });

  let metricsCache = null; // { at, until, value?, error? }
  router.get("/subscriptions/metrics", reading, owner, async (req, res) => {
    if (!rc.configured) return res.json({ configured: false, missing: rc.missing, metrics: [], updatedAt: null, fetchedAt: null, error: null });
    const t = clock();
    const fresh = req.query.refresh === "1" && (!metricsCache || t - metricsCache.at > 30_000);
    if (!metricsCache || metricsCache.until <= t || fresh) {
      try { const v = await rc.metrics(); metricsCache = { at: t, until: t + METRICS_TTL_MS, value: v }; }
      catch (e) { console.warn(`[cyra] subscriptions: metrics (${e instanceof RcError ? e.cat : "error"})`); metricsCache = { at: t, until: t + ERROR_TTL_MS, error: e instanceof RcError ? e.cat : "RevenueCat could not be read" }; }
    }
    const m = metricsCache;
    res.json({ configured: true, missing: [], metrics: m.value?.metrics || [], updatedAt: m.value?.updatedAt || null, fetchedAt: new Date(m.at).toISOString(), error: m.error || null });
  });

  let offeringsCache = null;
  router.get("/subscriptions/offerings", reading, owner, async (req, res) => {
    if (!rc.configured) return res.json({ configured: false, offerings: [], error: null });
    const t = clock();
    if (!offeringsCache || offeringsCache.until <= t) {
      try { offeringsCache = { until: t + METRICS_TTL_MS, offerings: await rc.offerings() }; }
      catch (e) { offeringsCache = { until: t + ERROR_TTL_MS, offerings: [], error: e instanceof RcError ? e.cat : "RevenueCat could not be read" }; }
    }
    res.json({ configured: true, offerings: offeringsCache.offerings, error: offeringsCache.error || null });
  });

  /* ---------- owner: promotions ---------- */
  const withStatus = (p) => ({ ...p, status: promoStatus(p, clock()) });
  router.get("/subscriptions/promotions", reading, owner, async (req, res) => {
    res.json({ promotions: (await store.find("subs_promotions")).map(withStatus).reverse() });
  });
  router.post("/subscriptions/promotions", writing, owner, async (req, res) => {
    const c = cleanPromotion(req.body);
    if (c.error) return res.status(400).json({ error: c.error });
    if ((await store.find("subs_promotions")).length >= CAPS.promotions) return res.status(409).json({ error: "too many promotions: delete old drafts first" });
    const at = now();
    const row = { id: newId(), ...c.value, enabled: false, stoppedAt: null, createdBy: req.portal.email, createdAt: at, updatedBy: req.portal.email, updatedAt: at };
    await store.insert("subs_promotions", row);
    await audit(req.portal.email, "create", `promotion:${row.id}`, { name: row.name, offeringId: row.offeringId });
    res.status(201).json({ promotion: withStatus(row) });
  });
  const promoFor = async (req, res) => {
    const p = ID_RE.test(req.params.id) ? await store.findOne("subs_promotions", (x) => x.id === req.params.id) : null;
    if (!p) res.status(404).json({ error: "no such promotion" });
    return p;
  };
  router.patch("/subscriptions/promotions/:id", writing, owner, async (req, res) => {
    const p = await promoFor(req, res); if (!p) return;
    const c = cleanPromotion(req.body, p);
    if (c.error) return res.status(400).json({ error: c.error });
    const patch = { ...c.value, updatedBy: req.portal.email, updatedAt: now() };
    await store.update("subs_promotions", (x) => x.id === p.id, patch);
    invalidate();
    await audit(req.portal.email, "edit", `promotion:${p.id}`, Object.fromEntries(Object.keys(req.body || {}).map((k) => [k, c.value[k]])));
    res.json({ promotion: withStatus({ ...p, ...patch }) });
  });
  router.post("/subscriptions/promotions/:id/start", writing, owner, async (req, res) => {
    const p = await promoFor(req, res); if (!p) return;
    if (Date.parse(p.endsAt) <= clock()) return res.status(409).json({ error: "its end date has passed: change the dates first" });
    const patch = { enabled: true, stoppedAt: null, updatedBy: req.portal.email, updatedAt: now() };
    await store.update("subs_promotions", (x) => x.id === p.id, patch);
    invalidate();
    await audit(req.portal.email, "start", `promotion:${p.id}`, { startsAt: p.startsAt, endsAt: p.endsAt });
    res.json({ promotion: withStatus({ ...p, ...patch }) });
  });
  router.post("/subscriptions/promotions/:id/stop", writing, owner, async (req, res) => {
    const p = await promoFor(req, res); if (!p) return;
    if (!p.enabled) return res.status(409).json({ error: "it isn't on" });
    const patch = { enabled: false, stoppedAt: now(), updatedBy: req.portal.email, updatedAt: now() };
    await store.update("subs_promotions", (x) => x.id === p.id, patch);
    invalidate();
    await audit(req.portal.email, "stop", `promotion:${p.id}`);
    res.json({ promotion: withStatus({ ...p, ...patch }) });
  });
  router.delete("/subscriptions/promotions/:id", writing, owner, async (req, res) => {
    const p = await promoFor(req, res); if (!p) return;
    if (promoStatus(p, clock()) === "live" || promoStatus(p, clock()) === "scheduled") return res.status(409).json({ error: "stop it before deleting it" });
    await store.remove("subs_promotions", (x) => x.id === p.id);
    invalidate();
    await audit(req.portal.email, "delete", `promotion:${p.id}`, { name: p.name });
    res.sendStatus(204);
  });

  /* ---------- owner: Pro grants ---------- */
  const accountsFor = async (email) => (await store.find("accounts", (a) => normEmail(a.email) === email)).map((a) => a.id);
  async function grantTo(row) {
    let expiresAt = null;
    for (const id of row.accountIds) { const r = await rc.grant(id, row.duration); if (r.expiresAt && (!expiresAt || r.expiresAt > expiresAt)) expiresAt = r.expiresAt; }
    return expiresAt;
  }

  router.get("/subscriptions/grants", reading, owner, async (req, res) => {
    const t = clock();
    res.json({ configured: rc.configured, durations: RC_DURATIONS, grants: (await store.find("subs_grants")).slice(-2000).reverse().map((g) => ({ ...g, ended: g.status === "granted" && g.expiresAt ? Date.parse(g.expiresAt) <= t : false })) });
  });

  router.post("/subscriptions/grants", limited(L.grant), owner, async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    if (typeof b.emails !== "string" || b.emails.length > CAPS.emailsText) return res.status(400).json({ error: `emails must be text (at most ${CAPS.emailsText} characters)` });
    if (!Object.hasOwn(RC_DURATIONS, b.duration)) return res.status(400).json({ error: `duration must be one of ${Object.keys(RC_DURATIONS).join(", ")}` });
    const note = V.cleanText(b.note, CAPS.note);
    if (note.error) return res.status(400).json({ error: `note ${note.error}` });
    const { emails, invalid } = parseEmails(b.emails);
    if (!emails.length) return res.status(400).json({ error: "no email address found", invalid });
    if (emails.length > CAPS.grantsAtOnce) return res.status(400).json({ error: `at most ${CAPS.grantsAtOnce} addresses at a time (found ${emails.length})` });
    if (!rc.configured) return res.status(503).json(notConfigured());
    if ((await store.find("subs_grants")).length + emails.length > CAPS.grants) return res.status(409).json({ error: "the grant list is full" });
    const queue = b.queue === true, by = req.portal.email;
    const results = [];
    for (const email of emails) {
      const accountIds = await accountsFor(email);
      const row = { id: newId(), email, accountIds, duration: b.duration, note: note.value, status: "granted", expiresAt: null, by, at: now() };
      if (!accountIds.length) {
        if (!queue) { results.push({ email, status: "no-account" }); continue; }
        row.status = "queued";
        await store.insert("subs_grants", row);
        await audit(by, "queue grant", `grant:${row.id}`, { email, duration: row.duration });
        results.push({ email, status: "queued", id: row.id });
        continue;
      }
      try { row.expiresAt = await grantTo(row); }
      catch (e) { row.status = "failed"; row.error = e instanceof RcError ? e.cat : "RevenueCat could not be reached"; }
      await store.insert("subs_grants", row);
      await audit(by, row.status === "granted" ? "grant" : "grant failed", `grant:${row.id}`, { email, duration: row.duration, accounts: accountIds.length, ...(row.error ? { error: row.error } : {}) });
      results.push({ email, status: row.status, id: row.id, accounts: accountIds.length, expiresAt: row.expiresAt, error: row.error || null });
    }
    res.status(201).json({ results, invalid });
  });

  router.post("/subscriptions/grants/:id/revoke", limited(L.grant), owner, async (req, res) => {
    const g = ID_RE.test(req.params.id) ? await store.findOne("subs_grants", (x) => x.id === req.params.id) : null;
    if (!g) return res.status(404).json({ error: "no such grant" });
    const at = now(), by = req.portal.email;
    if (g.status === "queued") {
      await store.update("subs_grants", (x) => x.id === g.id, { status: "cancelled", revokedAt: at, revokedBy: by });
      await audit(by, "cancel grant", `grant:${g.id}`, { email: g.email });
      return res.json({ grant: { ...g, status: "cancelled", revokedAt: at, revokedBy: by } });
    }
    if (g.status !== "granted") return res.status(409).json({ error: `it is ${g.status}` });
    if (!rc.configured) return res.status(503).json(notConfigured());
    try { for (const id of g.accountIds) await rc.revoke(id); }
    catch (e) { return res.status(502).json({ error: `nothing was revoked: ${e instanceof RcError ? e.cat : "RevenueCat could not be reached"}` }); }
    // RevenueCat revokes every promotional grant of the entitlement for an account, so every grant to these accounts ends.
    const ids = new Set(g.accountIds);
    const ended = await store.apply("subs_grants", (rows) => {
      let n = 0;
      for (const r of rows) if (r.status === "granted" && r.accountIds.some((a) => ids.has(a))) { r.status = "revoked"; r.revokedAt = at; r.revokedBy = by; n++; }
      return n;
    });
    await audit(by, "revoke grant", `grant:${g.id}`, { email: g.email, accounts: g.accountIds.length, grantsEnded: ended });
    res.json({ grant: { ...g, status: "revoked", revokedAt: at, revokedBy: by }, grantsEnded: ended });
  });

  // A grant queued for an email is applied the first time an account with that sign-in email signs in.
  ctx.onAccountSignIn ||= [];
  ctx.onAccountSignIn.push(async ({ id, email }) => {
    const e = normEmail(email);
    if (!e || !rc.configured) return;
    const queued = await store.find("subs_grants", (g) => g.status === "queued" && g.email === e);
    for (const g of queued) {
      try {
        const expiresAt = await grantTo({ ...g, accountIds: [id] });
        await store.update("subs_grants", (x) => x.id === g.id && x.status === "queued", { status: "granted", accountIds: [id], expiresAt, appliedAt: now() });
        await audit("system", "grant (queued, applied at sign-in)", `grant:${g.id}`, { duration: g.duration });
      } catch (err) {
        await store.update("subs_grants", (x) => x.id === g.id, { error: err instanceof RcError ? err.cat : "RevenueCat could not be reached" });
        console.warn("[cyra] subscriptions: a queued grant could not be applied");
      }
    }
  });
  // A deleted account: its id is dropped from the grant list (RevenueCat keeps its own anonymous record of the grant).
  ctx.onAccountDelete ||= [];
  ctx.onAccountDelete.push(async ({ id }) => {
    await store.apply("subs_grants", (rows) => { for (const r of rows) if (r.accountIds.includes(id)) { r.accountIds = r.accountIds.filter((a) => a !== id); r.accountDeleted = true; } });
  });

  /* ---------- partner codes ---------- */
  const brandsById = async () => new Map((await ctx.portal.brandIds()).map((b) => [b.id, b]));
  const batchMap = async () => new Map((await store.find("subs_batches")).map((b) => [b.id, b]));

  router.get("/subscriptions/codes", reading, anyone, async (req, res) => {
    const t = clock(), who = req.portal;
    const batches = await batchMap(), brands = await brandsById();
    const mine = (b) => who.role === "owner" || (b.brandId && who.brandIds.includes(b.brandId));
    const visible = [...batches.values()].filter(mine);
    const codes = await store.find("subs_codes", (c) => visible.some((b) => b.id === c.batchId));
    const perBrand = new Map();
    for (const b of visible) {
      const k = b.brandId || "";
      if (!perBrand.has(k)) perBrand.set(k, []);
      perBrand.get(k).push(...codes.filter((c) => c.batchId === b.id));
    }
    const summary = [...perBrand.entries()].map(([brandId, list]) => ({ brandId: brandId || null, brand: brands.get(brandId)?.name || null, counts: countsOf(list, t, batches) }));
    const batchRows = visible.map((b) => ({ ...b, brand: brands.get(b.brandId)?.name || null, counts: countsOf(codes.filter((c) => c.batchId === b.id), t, batches) })).reverse();
    if (who.role === "owner") return res.json({ role: "owner", summary, batches: batchRows });
    // a partner: its brands' counts, and its available codes that haven't expired
    const available = codes.filter((c) => c.status === "available" && !(batches.get(c.batchId).expiresAt && Date.parse(batches.get(c.batchId).expiresAt) <= t))
      .map((c) => { const b = batches.get(c.batchId); return { code: c.code, platform: b.platform, offerRef: b.offerRef, expiresAt: b.expiresAt, brand: brands.get(b.brandId)?.name || null }; });
    res.json({ role: "partner", summary, batches: batchRows.map(({ by, ...b }) => b), available }); // eslint-disable-line no-unused-vars
  });

  router.get("/subscriptions/codes.csv", reading, anyone, async (req, res) => {
    const t = clock(), who = req.portal;
    const batches = await batchMap(), brands = await brandsById();
    let rows;
    if (who.role === "owner") {
      const only = typeof req.query.batch === "string" && ID_RE.test(req.query.batch) ? req.query.batch : null;
      rows = await store.find("subs_codes", (c) => !only || c.batchId === only);
    } else {
      rows = await store.find("subs_codes", (c) => { const b = batches.get(c.batchId); return c.status === "available" && b && b.brandId && who.brandIds.includes(b.brandId) && !(b.expiresAt && Date.parse(b.expiresAt) <= t); });
    }
    const cols = ["code", "platform", "store offer", "expires", "brand", "status"];
    const lines = rows.map((c) => { const b = batches.get(c.batchId) || {}; return [c.code, b.platform, b.offerRef, b.expiresAt ? b.expiresAt.slice(0, 10) : "", brands.get(b.brandId)?.name || "", c.status].map(csvCell).join(","); });
    await audit(who.email, "export codes", who.role === "owner" ? "codes" : `codes:${who.brandIds.join(" ")}`, { count: rows.length });
    res.set({ "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="solia-codes.csv"' });
    res.send([cols.join(","), ...lines].join("\r\n") + "\r\n");
  });

  router.post("/subscriptions/codes/batches", writing, owner, async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const label = V.cleanText(b.label, CAPS.label, { required: true });
    if (label.error) return res.status(400).json({ error: `label ${label.error}` });
    if (!CODE_PLATFORMS.includes(b.platform)) return res.status(400).json({ error: "platform must be ios or android" });
    const offerRef = V.cleanText(b.offerRef, CAPS.offerRef, { required: true });
    if (offerRef.error) return res.status(400).json({ error: `store offer ${offerRef.error}` });
    const expiresAt = b.expiresAt ? isoOf(b.expiresAt) : null;
    if (b.expiresAt && !expiresAt) return res.status(400).json({ error: "expiresAt must be a date" });
    const brands = await brandsById();
    const brandId = b.brandId ? String(b.brandId) : null;
    if (brandId && !brands.has(brandId)) return res.status(400).json({ error: "brandId is not a brand" });
    if (typeof b.codes !== "string" || b.codes.length > CAPS.codesText) return res.status(400).json({ error: `codes must be text, one per line (at most ${CAPS.codesText} characters)` });
    const { codes, invalid } = parseCodes(b.codes);
    if (!codes.length) return res.status(400).json({ error: "no codes found: one code per line, letters, digits and dashes", invalid });
    if (codes.length > CAPS.batchCodes) return res.status(400).json({ error: `at most ${CAPS.batchCodes} codes in one batch (found ${codes.length})` });
    const existing = await store.find("subs_codes");
    if (existing.length + codes.length > CAPS.codes || (await store.find("subs_batches")).length >= CAPS.batches) return res.status(409).json({ error: "the code store is full" });
    const known = new Set(existing.map((c) => c.code));
    const fresh = codes.filter((c) => !known.has(c));
    if (!fresh.length) return res.status(409).json({ error: "every one of these codes is uploaded already" });
    const batch = { id: newId(), label: label.value, platform: b.platform, offerRef: offerRef.value, expiresAt, brandId, count: fresh.length, by: req.portal.email, at: now() };
    await store.insert("subs_batches", batch);
    await store.apply("subs_codes", (rows) => { for (const code of fresh) rows.push({ id: newId(), batchId: batch.id, code, status: "available" }); });
    await audit(req.portal.email, "upload codes", `batch:${batch.id}`, { label: batch.label, platform: batch.platform, offerRef: batch.offerRef, brandId, count: fresh.length });
    res.status(201).json({ batch, added: fresh.length, duplicates: codes.length - fresh.length, invalid });
  });

  const batchFor = async (req, res) => {
    const b = ID_RE.test(req.params.id) ? await store.findOne("subs_batches", (x) => x.id === req.params.id) : null;
    if (!b) res.status(404).json({ error: "no such batch" });
    return b;
  };
  router.get("/subscriptions/codes/batches/:id", reading, owner, async (req, res) => {
    const b = await batchFor(req, res); if (!b) return;
    res.json({ batch: b, codes: await store.find("subs_codes", (c) => c.batchId === b.id) });
  });
  router.patch("/subscriptions/codes/batches/:id", writing, owner, async (req, res) => {
    const b = await batchFor(req, res); if (!b) return;
    const brandId = req.body?.brandId ? String(req.body.brandId) : null;
    if (brandId && !(await brandsById()).has(brandId)) return res.status(400).json({ error: "brandId is not a brand" });
    await store.update("subs_batches", (x) => x.id === b.id, { brandId });
    await audit(req.portal.email, "assign codes", `batch:${b.id}`, { brandId });
    res.json({ batch: { ...b, brandId } });
  });
  router.delete("/subscriptions/codes/batches/:id", writing, owner, async (req, res) => {
    const b = await batchFor(req, res); if (!b) return;
    await store.remove("subs_codes", (c) => c.batchId === b.id);
    await store.remove("subs_batches", (x) => x.id === b.id);
    await audit(req.portal.email, "delete codes", `batch:${b.id}`, { label: b.label, count: b.count });
    res.sendStatus(204);
  });
  router.post("/subscriptions/codes/mark", writing, owner, async (req, res) => {
    const status = req.body?.status;
    if (!["available", "given", "redeemed"].includes(status)) return res.status(400).json({ error: "status must be available, given or redeemed" });
    if (typeof req.body?.codes !== "string" || req.body.codes.length > CAPS.codesText) return res.status(400).json({ error: "codes must be text, one per line" });
    const { codes } = parseCodes(req.body.codes);
    if (!codes.length) return res.status(400).json({ error: "no codes found" });
    const want = new Set(codes), at = now(), by = req.portal.email;
    const found = await store.apply("subs_codes", (rows) => { let n = 0; for (const r of rows) if (want.has(r.code)) { r.status = status; r.markedAt = at; r.markedBy = by; n++; } return n; });
    await audit(by, `mark codes ${status}`, "codes", { count: found });
    res.json({ marked: found, notFound: codes.length - found });
  });

  router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.warn(`[cyra] subscriptions: ${String(err?.type || err?.code || "error").slice(0, 40)}`);
    if (!res.headersSent) res.status(err?.status && err.status < 500 ? err.status : 500).json({ error: "something went wrong" });
  });
}
