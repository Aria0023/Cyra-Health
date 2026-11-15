// The shop's vocabulary and input cleaners (partner portal, docs/plans/partner-portal.md Task 1). Pure: no I/O.
// The lists mirror the app's src/lib/shop.js (SHOP_CATEGORIES, AVAIL_LABEL, TONE_LABEL, SHOP_HUE_IDS), lib/trying.js
// TRY_KINDS and the stage / module ids; src/lib/shopCatalog.test.mjs fails if the two drift apart.
//
// Every cleaner takes untrusted input and answers { value } or { error }: text is trimmed and capped, URLs must be
// https with a real host and no user:password, lists keep only known ids. Nothing here ever echoes a long value back.

export const CATEGORIES = Object.freeze(["fertility", "pregnancy", "labs", "glucose", "wearables", "periods", "meno", "sleep"]);
export const AVAILABILITY = Object.freeze(["home", "lab", "visit", "app", "online", "stores", "rx"]);
export const TONES = Object.freeze(["strong", "mixed", "comfort", "clinical"]);
export const HUES = Object.freeze(["teal", "blue", "coral", "violet", "green", "amber", "rose", "indigo", "cyan", "plum"]);
export const KINDS = Object.freeze(["rx", "supp", "habit", "program", "aid", "care"]);
export const STAGES = Object.freeze(["periods", "ttc", "preg", "peri", "meno"]);
export const MODULES = Object.freeze(["pots", "pcos"]);
export const CLINICIAN = Object.freeze(["awaiting", "signed"]);
export const STATUSES = Object.freeze(["draft", "pending", "published", "archived"]);
// The same plain price forms the app accepts (src/lib/shop.js PRICE_RE).
export const PRICE_RE = /^(From |About )?[$£€]\d[\d.,]{0,8}( (a|per) (month|year|test|kit))?$/;

export const CAPS = Object.freeze({
  brandName: 60, tag: 30, about: 240, productName: 90, covers: 140, description: 400, why: 240, evidenceLabel: 80,
  source: 300, sources: 6, url: 500, company: 100, note: 600, price: 40,
});

const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g; // control and bidi-override characters

/** Plain one-line text: trimmed, control characters removed, whitespace collapsed; error when too long or required and empty. */
export function cleanText(v, max, { required = false, multiline = false } = {}) {
  if (v == null) v = "";
  if (typeof v !== "string") return { error: "must be text" };
  let s = v.replace(CTRL, "");
  s = multiline ? s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim() : s.replace(/\s+/g, " ").trim();
  if (s.length > max) return { error: `must be at most ${max} characters` };
  if (required && !s) return { error: "is required" };
  return { value: s };
}

/** An https URL with a real host name (a dot, no IP literal checks needed for safety, no user:password), or "" when empty and optional. */
export function cleanUrl(v, { required = false } = {}) {
  if (v == null || v === "") return required ? { error: "is required" } : { value: "" };
  if (typeof v !== "string") return { error: "must be a web address" };
  const s = v.trim();
  if (!s) return required ? { error: "is required" } : { value: "" };
  if (s.length > CAPS.url) return { error: `must be at most ${CAPS.url} characters` };
  if (!/^https:\/\//i.test(s)) return { error: "must start with https://" };
  let u;
  try { u = new URL(s); } catch { return { error: "is not a valid web address" }; }
  if (u.protocol !== "https:" || u.username || u.password) return { error: "must be a plain https:// address" };
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(u.hostname) || /^\d+(\.\d+)+$/.test(u.hostname)) return { error: "needs a real host name" };
  if (/(^|\.)(localhost|local|internal|test|example|invalid)$/i.test(u.hostname)) return { error: "needs a public host name" };
  return { value: u.href };
}

/** A list of known ids (deduplicated, in the given order); unknown ids are an error. */
export function cleanIds(v, known, { min = 0, max = known.length } = {}) {
  if (v == null) v = [];
  if (!Array.isArray(v)) return { error: "must be a list" };
  const out = [];
  for (const x of v) {
    if (typeof x !== "string" || !known.includes(x)) return { error: `has an unknown value (allowed: ${known.join(", ")})` };
    if (!out.includes(x)) out.push(x);
  }
  if (out.length < min) return { error: `needs at least ${min}` };
  if (out.length > max) return { error: `takes at most ${max}` };
  return { value: out };
}

export const cleanOne = (v, known, { nullable = false } = {}) => {
  if (nullable && (v == null || v === "")) return { value: null };
  return typeof v === "string" && known.includes(v) ? { value: v } : { error: `must be one of ${known.join(", ")}` };
};

export function cleanPrice(v) {
  if (v == null || v === "") return { value: "" };
  if (typeof v !== "string") return { error: "must be text" };
  const s = v.trim();
  if (!s) return { value: "" };
  if (s.length > CAPS.price || !PRICE_RE.test(s)) return { error: 'must be a plain price such as "$89", "From $89" or "About $99 a year"' };
  return { value: s };
}

export function cleanMonogram(v, name) {
  if (v == null || v === "") return { value: monogramOf(name) };
  if (typeof v !== "string" || !/^[A-Z0-9]{1,3}$/.test(v.trim().toUpperCase())) return { error: "must be 1 to 3 letters or digits" };
  return { value: v.trim().toUpperCase() };
}
/** The two-letter monogram of a name (the same rule as the app's lib/shop.js monogram). */
export function monogramOf(name) {
  const words = String(name || "").split(/[^A-Za-z]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] || "?").slice(0, 2).toUpperCase();
}

export function cleanEvidence(v) {
  if (v == null) return { value: null };
  if (typeof v !== "object" || Array.isArray(v)) return { error: "must be { tone, label }" };
  const tone = cleanOne(v.tone, TONES);
  if (tone.error) return { error: `tone ${tone.error}` };
  const label = cleanText(v.label, CAPS.evidenceLabel, { required: true });
  if (label.error) return { error: `label ${label.error}` };
  return { value: { tone: tone.value, label: label.value } };
}

export function cleanSources(v) {
  if (v == null) return { value: [] };
  if (!Array.isArray(v)) return { error: "must be a list" };
  if (v.length > CAPS.sources) return { error: `takes at most ${CAPS.sources}` };
  const out = [];
  for (const s of v) { const t = cleanText(s, CAPS.source, { required: true }); if (t.error) return { error: `each source ${t.error}` }; out.push(t.value); }
  return { value: out };
}

/** A URL-safe id from a name: "Easy@Home" → "easy-home". */
export const slug = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "item";
export const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
export const IMAGE_ID_RE = /^[a-f0-9]{24}$/;
