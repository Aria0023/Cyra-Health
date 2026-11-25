// Owner settings: change parts of the app without a code change (docs/plans/upgrade-enterprise.md Task 2).
// App settings only: never anyone's health data, never anything about one person. The app downloads them with one plain
// GET that carries nothing about her (no query, no token, no cookie).
//
// Who may do what: writes are OWNER-ONLY (the portal's owner role, ADMIN_EMAILS), checked on the server for every request
// through the shop module's portal sign-in (ctx.portal.auth("owner")). A partner or an organization admin gets 403;
// without a portal sign-in, 401.
//
//   Public: GET /api/app-config           the app's settings: features turned off, the default style and palette for new
//                                         people, a Home announcement (only while on), Help's extra lines and the web's
//                                         reference prices. Nothing about anyone.
//   Owner:  GET /api/settings             the values, the built-in defaults, the allowed options, what is NOT editable, and
//                                         the newest change log rows
//           PUT /api/settings             change one or more values (each checked; unknown fields 400)
//           GET /api/settings/log         the change log: who, when, which setting, old → new (newest first, 1000 kept)
//
// Editable, and nothing else:
//   featuresOff     features the build offers that the app should turn OFF (never on beyond the build's VITE_FEATURES):
//                   only those in REMOTE_OFF. Sign-in, on-device sources and the encrypted backup are never switched off
//                   from here (someone could be cut off from her account or her backup), and no privacy behaviour
//                   (such as the shop tap count, which stays off until she turns it on) is a setting here.
//   defaultStyle    the style new people start with (one of STYLE_KEYS; src/lib/appearance.js STYLES), or null
//   defaultPalette  the stage palette new people start with (0, 1 or 2; src/lib/constants.js PALETTES), or null
//   announcement    { on, text }: one plain-text line on Home, at most ANNOUNCE_MAX characters, off by default
//   helpLines       up to HELP_LINES_MAX plain-text lines under Help's answers, each at most HELP_LINE_MAX characters
//   prices          { monthly, annual }: the US reference prices the web's Pro sheet shows ("$9.95"); null = the built-in
//                   ones. They must match the store prices (the portal says so). The trial length is set in App Store
//                   Connect / Play Console and is not a setting.
// Not editable here (NOT_EDITABLE, shown by the portal): privacy claims, legal text, clinical and safety text, sign-in order.
import crypto from "crypto";
import { rateLimiter } from "../../core/memory.js";

export const basePath = "/api";
export const REMOTE_OFF = Object.freeze(["ai", "shop", "wearables", "webReminders", "counts"]);
export const FEATURE_LABEL = Object.freeze({ ai: "Solia Health's AI", shop: "Shop by need", wearables: "Oura, Fitbit, Garmin and Whoop", webReminders: "Reminders in a browser", counts: "Anonymous weekly counts" });
export const STYLE_KEYS = Object.freeze(["soft", "mono", "clear", "journal", "aura", "sky", "blush", "mint", "sunset"]);
export const PALETTES = 3;
export const ANNOUNCE_MAX = 140, HELP_LINE_MAX = 240, HELP_LINES_MAX = 3;
export const PRICE_RE = /^\$\d{1,4}(\.\d{2})?$/;
export const DEFAULTS = Object.freeze({ featuresOff: [], defaultStyle: null, defaultPalette: null, announcement: { on: false, text: "" }, helpLines: [], prices: { monthly: null, annual: null } });
export const FIELDS = Object.freeze(Object.keys(DEFAULTS));
export const NOT_EDITABLE = Object.freeze([
  "Privacy claims: what is stored, sent or kept, anywhere in the app",
  "Legal text: the Terms, the Privacy Policy and the consent step",
  "Clinical and safety text: \"Solia Health is not a contraceptive\", crisis lines, urgent-care advice and medical disclaimers",
  "The sign-in order: Sign in with Apple stays first",
  "The free trial's length: it is set in App Store Connect and Play Console",
  "Turning on a feature the build doesn't offer, and the shop tap count (it stays off until she turns it on)",
]);
const LOG_KEEP = 1000;
// Plain text only: no control characters (newlines included), no angle brackets.
const PLAIN_BAD = /[\u0000-\u001f\u007f-\u009f<>]/;

const plain = (v, max) => {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  if (!s || s.length > max || PLAIN_BAD.test(s)) return null;
  return s;
};

/** body (a partial) → { patch } or { status, error }. Every field is checked; an unknown field is refused. */
export function cleanSettings(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { status: 400, error: "send the settings as an object" };
  const unknown = Object.keys(body).filter((k) => !FIELDS.includes(k));
  if (unknown.length) return { status: 400, error: `unknown setting: ${unknown.join(", ")}` };
  const patch = {};
  if ("featuresOff" in body) {
    const v = body.featuresOff;
    if (!Array.isArray(v) || v.some((x) => !REMOTE_OFF.includes(x))) return { status: 400, error: `featuresOff may list only ${REMOTE_OFF.join(", ")}` };
    patch.featuresOff = REMOTE_OFF.filter((x) => v.includes(x));
  }
  if ("defaultStyle" in body) {
    const v = body.defaultStyle;
    if (v !== null && !STYLE_KEYS.includes(v)) return { status: 400, error: `defaultStyle must be one of ${STYLE_KEYS.join(", ")} or null` };
    patch.defaultStyle = v;
  }
  if ("defaultPalette" in body) {
    const v = body.defaultPalette;
    if (v !== null && !(Number.isInteger(v) && v >= 0 && v < PALETTES)) return { status: 400, error: "defaultPalette must be 0, 1, 2 or null" };
    patch.defaultPalette = v;
  }
  if ("announcement" in body) {
    const v = body.announcement;
    if (!v || typeof v !== "object" || typeof v.on !== "boolean") return { status: 400, error: "announcement must be { on, text }" };
    const raw = typeof v.text === "string" ? v.text : "";
    const text = raw.trim() ? plain(raw, ANNOUNCE_MAX) : "";
    if (text === null) return { status: 400, error: `the announcement must be plain text of at most ${ANNOUNCE_MAX} characters` };
    if (v.on && !text) return { status: 400, error: "an announcement that is on needs its text" };
    patch.announcement = { on: v.on, text };
  }
  if ("helpLines" in body) {
    const v = body.helpLines;
    if (!Array.isArray(v) || v.length > HELP_LINES_MAX) return { status: 400, error: `helpLines must be a list of at most ${HELP_LINES_MAX} lines` };
    const lines = v.filter((x) => typeof x === "string" && x.trim()).map((x) => plain(x, HELP_LINE_MAX));
    if (lines.some((x) => x === null) || v.some((x) => typeof x !== "string")) return { status: 400, error: `each Help line must be plain text of at most ${HELP_LINE_MAX} characters` };
    patch.helpLines = lines;
  }
  if ("prices" in body) {
    const v = body.prices;
    if (!v || typeof v !== "object" || Object.keys(v).some((k) => k !== "monthly" && k !== "annual")) return { status: 400, error: "prices must be { monthly, annual }" };
    const out = {};
    for (const k of ["monthly", "annual"]) {
      const p = v[k] == null || v[k] === "" ? null : String(v[k]).trim();
      if (p !== null && !PRICE_RE.test(p)) return { status: 400, error: `the ${k} price must look like $9.95 or $100` };
      out[k] = p;
    }
    patch.prices = out;
  }
  return { patch };
}

/** The stored values → what GET /api/app-config answers (the announcement only while on). */
export function publicConfig(values, updatedAt = null) {
  const v = { ...DEFAULTS, ...(values || {}) };
  return {
    version: 1,
    featuresOff: [...v.featuresOff],
    defaultStyle: v.defaultStyle,
    defaultPalette: v.defaultPalette,
    announcement: v.announcement && v.announcement.on && v.announcement.text ? v.announcement.text : null,
    helpLines: [...v.helpLines],
    prices: { monthly: v.prices?.monthly ?? null, annual: v.prices?.annual ?? null },
    updatedAt,
  };
}

const shown = (v) => { const s = JSON.stringify(v); return s.length > 400 ? `${s.slice(0, 399)}…` : s; };

export function mount(router, ctx, { clock = Date.now } = {}) {
  const { store, config } = ctx;
  if (!ctx.portal) throw new Error("settings needs the shop module (the portal's sign-in) mounted before it");
  const { auth, audit } = ctx.portal;
  const cfg = config.settings || {};
  const L = {
    pub: rateLimiter({ perMinute: cfg.publicPerMinute || 120 }),
    read: rateLimiter({ perMinute: cfg.readPerMinute || 120 }),
    write: rateLimiter({ perMinute: cfg.writePerMinute || 30, globalPerMinute: 200 }),
  };
  ctx.onShutdown?.push(async () => { for (const l of Object.values(L)) l.stop(); });
  const limited = (lim) => (req, res, next) => (lim(req.ip) ? next() : res.status(429).json({ error: "too many requests — try again in a minute" }));
  const owner = auth("owner");
  const now = () => new Date(clock()).toISOString();

  async function current() {
    const row = await store.findOne("app_settings", (r) => r.key === "app");
    return row ? { values: { ...DEFAULTS, ...row.values }, updatedAt: row.updatedAt || null, updatedBy: row.updatedBy || null } : { values: { ...DEFAULTS }, updatedAt: null, updatedBy: null };
  }

  router.get("/app-config", limited(L.pub), async (req, res) => {
    const c = await current();
    res.set({ "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" });
    res.json(publicConfig(c.values, c.updatedAt));
  });

  router.get("/settings", limited(L.read), owner, async (req, res) => {
    const c = await current();
    const log = (await store.find("app_settings_log")).slice(-50).reverse();
    res.json({ ...c, defaults: DEFAULTS, options: { features: REMOTE_OFF.map((id) => ({ id, label: FEATURE_LABEL[id] })), styles: STYLE_KEYS, palettes: PALETTES, announceMax: ANNOUNCE_MAX, helpLineMax: HELP_LINE_MAX, helpLinesMax: HELP_LINES_MAX }, notEditable: NOT_EDITABLE, log });
  });

  router.get("/settings/log", limited(L.read), owner, async (req, res) => {
    res.json({ log: (await store.find("app_settings_log")).slice().reverse() });
  });

  router.put("/settings", limited(L.write), owner, async (req, res) => {
    const c = cleanSettings(req.body);
    if (c.error) return res.status(c.status).json({ error: c.error });
    const cur = await current();
    const at = now(), by = req.portal.email;
    const changed = Object.keys(c.patch).filter((k) => JSON.stringify(c.patch[k]) !== JSON.stringify(cur.values[k]));
    if (!changed.length) return res.json({ ...cur, changed: [] });
    const values = { ...cur.values, ...c.patch };
    if (await store.findOne("app_settings", (r) => r.key === "app")) await store.update("app_settings", (r) => r.key === "app", { values, updatedAt: at, updatedBy: by });
    else await store.insert("app_settings", { key: "app", values, updatedAt: at, updatedBy: by });
    const rows = changed.map((field) => ({ id: crypto.randomBytes(9).toString("base64url"), at, by, field, from: shown(cur.values[field]), to: shown(values[field]) }));
    await store.apply("app_settings_log", (all) => { all.push(...rows); if (all.length > LOG_KEEP) all.splice(0, all.length - LOG_KEEP); });
    await audit(by, "settings", "app-settings", Object.fromEntries(changed.map((k) => [k, values[k]])));
    res.json({ values, updatedAt: at, updatedBy: by, changed });
  });
}
