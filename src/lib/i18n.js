/* Language support (calm R10, plan §7 "Language support"). Pure: no React, no storage, no network.

   - Catalogues are plain objects { key: string | (vars) => string | { one, other, ... } } registered by code with
     addCatalogue(code, table, meta). English (src/locales/en.js) is the source catalogue and the fallback for any key
     another catalogue lacks; a key missing everywhere comes back as the key itself (never "undefined", never a throw),
     so a missing string is visible in review and harmless in use.
   - t(key, vars) looks the key up in the current locale, then English. "{name}" placeholders are filled from vars
     (a missing var leaves the placeholder as written). A plural entry ({ one, other, few, many, two, zero }) picks
     its form with Intl.PluralRules for vars.count. A function entry is called with vars.
   - plural(n, forms, locale) is the same choice for callers that hold the forms themselves.
   - Formatting goes through one helper per kind: fmtDate(iso | Date, opts) and fmtNumber(n, opts), both Intl with
     the locale's formatting tag (English formats as "en-US", exactly the text the app always showed).
   - detectLocale(preferred) picks the best registered catalogue for the device's languages (navigator.languages):
     exact code, then its base language, then English. applyDocumentLocale(doc, code) sets <html lang> and dir.
   - The You page shows a Language picker only when at least two catalogues are registered (availableLocales()).
     Today only English ships, so the picker stays hidden; a second language is content work: add
     src/locales/<code>.js with every English key and register it in src/locales/index.js. */

export const DEFAULT_LOCALE = "en";
const RTL = new Set(["ar", "fa", "he", "ur", "ps", "dv", "yi", "ku", "sd", "ug"]);

const CATALOGUES = new Map(); // code → { table, name, tag }
let current = DEFAULT_LOCALE;

/** Register (or replace) a catalogue. meta.name is the language's own name ("English"); meta.tag the Intl tag. */
export function addCatalogue(code, table, meta = {}) {
  if (typeof code !== "string" || !code || !table || typeof table !== "object") throw new Error("addCatalogue(code, table)");
  CATALOGUES.set(code, { table, name: meta.name || code, tag: meta.tag || code });
  return code;
}
/** Remove a catalogue (tests); English stays the fallback only while it is registered. */
export function removeCatalogue(code) { CATALOGUES.delete(code); if (current === code) current = DEFAULT_LOCALE; }

/** The registered locales, English first: [{ code, name }]. */
export function availableLocales() {
  return [...CATALOGUES.entries()].map(([code, c]) => ({ code, name: c.name })).sort((a, b) => (a.code === DEFAULT_LOCALE ? -1 : b.code === DEFAULT_LOCALE ? 1 : a.name.localeCompare(b.name)));
}
/** Whether a Language picker has anything to offer (two or more catalogues). */
export const pickerShown = () => CATALOGUES.size >= 2;

const baseOf = (code) => String(code || "").toLowerCase().split(/[-_]/)[0];
/** Best registered locale for a list of preferred languages (["fr-CA", "en-US"]); English otherwise. */
export function detectLocale(preferred = []) {
  const list = (Array.isArray(preferred) ? preferred : [preferred]).filter((x) => typeof x === "string" && x);
  const codes = [...CATALOGUES.keys()];
  for (const p of list) {
    const exact = codes.find((c) => c.toLowerCase() === p.toLowerCase());
    if (exact) return exact;
    const base = codes.find((c) => baseOf(c) === baseOf(p));
    if (base) return base;
  }
  return DEFAULT_LOCALE;
}
/** A saved choice if it is registered, else the device's best match. */
export const resolveLocale = (saved, preferred) => (typeof saved === "string" && CATALOGUES.has(saved) ? saved : detectLocale(preferred));
/** Clean a saved locale choice: null (follow the device) or a short language code. */
export const cleanLocale = (v) => (typeof v === "string" && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(v) ? v : null);

export function setLocale(code) { current = CATALOGUES.has(code) ? code : DEFAULT_LOCALE; return current; }
export const getLocale = () => current;
/** The Intl tag the current (or given) locale formats with ("en" formats as "en-US"). */
export const localeTag = (code = current) => CATALOGUES.get(code)?.tag || (code === DEFAULT_LOCALE ? "en-US" : code);
export const dirOf = (code = current) => (RTL.has(baseOf(code)) ? "rtl" : "ltr");

const pluralRules = new Map();
const ruleFor = (tag) => { if (!pluralRules.has(tag)) { let r; try { r = new Intl.PluralRules(tag); } catch { r = new Intl.PluralRules("en-US"); } pluralRules.set(tag, r); } return pluralRules.get(tag); };
/** Pick the plural form of n: forms { one, other, ... } (or [one, other]). */
export function plural(n, forms, code = current) {
  const f = Array.isArray(forms) ? { one: forms[0], other: forms[1] } : forms || {};
  const cat = Number.isFinite(n) ? ruleFor(localeTag(code)).select(n) : "other";
  return f[cat] ?? f.other ?? f.one ?? "";
}

/** Fill "{name}" placeholders. A var that is null/undefined leaves its placeholder untouched. */
export function interpolate(str, vars) {
  if (!vars || typeof str !== "string") return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k])));
}

const lookup = (code, key) => CATALOGUES.get(code)?.table?.[key];
/** Whether a key exists in the given catalogue (default: English). */
export const hasKey = (key, code = DEFAULT_LOCALE) => lookup(code, key) !== undefined;

/** Translate: current locale, then English, then the key itself. */
export function t(key, vars) {
  let v = lookup(current, key);
  let code = current;
  if (v === undefined) { v = lookup(DEFAULT_LOCALE, key); code = DEFAULT_LOCALE; }
  if (v === undefined) return key;
  if (typeof v === "function") return String(v(vars || {}));
  if (v && typeof v === "object") return interpolate(plural(Number(vars?.count), v, code), vars);
  return interpolate(v, vars);
}

const toDate = (d) => (d instanceof Date ? d : typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T12:00:00") : new Date(d));
/** One date formatter for the app: an ISO day ("2026-10-29", read at local noon) or a Date. */
export function fmtDate(d, opts = { month: "short", day: "numeric" }, code = current) {
  const x = toDate(d);
  if (Number.isNaN(x.getTime())) return "";
  return x.toLocaleDateString(localeTag(code), opts);
}
/** One number formatter for the app (grouping and decimals by locale). */
export function fmtNumber(n, opts, code = current) {
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString(localeTag(code), opts);
}

/** Set <html lang> and dir for the locale (a document-like object; no-op without one). */
export function applyDocumentLocale(doc, code = current) {
  const el = doc?.documentElement;
  if (!el) return;
  const lang = code === DEFAULT_LOCALE ? "en" : code;
  if (el.lang !== lang) el.lang = lang;
  const dir = dirOf(code);
  if (el.dir !== dir) el.dir = dir;
}
