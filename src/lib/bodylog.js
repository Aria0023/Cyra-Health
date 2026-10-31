/* The fast log's second half (calm R4, spec §3.5b): what she logs next to the check-in, one tap at a time, on this
   device only. Pure: no React, no storage, no network; imports engine.js and modules.js only, never record.js
   (record.js imports this file for its RULES entries and the clean functions App.jsx runs on load and restore).

   Three persisted keys (record class, in encrypted backups, restored literally):
   - bodyLog   { [YYYY-MM-DD]: BodyDay }  BodyDay = { sleepH?, move?, pcos?, weight?, meals? }
                 sleepH  hours slept, 0–16 in half hours (the check-in keeps the "Slept well / So-so / Rough night" word)
                 move    [{ id, type, min }] movement sessions: type MOVE_TYPES id, min 1–600 (any kind; general, not POTS)
                 pcos    PCOS module day chips: insulin-resistance signals, PCOS symptoms and the high-sugar day marker
                         (PCOS_DAY ids; ids a later build writes are kept)
                 weight  { v, unit } optional, only when she turned weight on; never on Home, never charted
                 meals   [{ id, meal, kind?, late?, energy? }] optional meal notes (only while Meal notes is on): which
                         meal (MEAL_SLOTS), what it was mostly (MEAL_KINDS, one), whether she ate late, and how her energy
                         felt after (MEAL_ENERGY). No foods, no calories, no photos, no free text; at most MEALS_PER_DAY.
   - labs      [{ id, kind, value, unit, date }] values she types from her own results (fasting glucose, HbA1c) and
                 waist measures, each dated. Stored exactly as typed in her unit; Cyra never interprets them.
   - bodyPrefs { weightOn, weightUnit, glucoseUnit, hba1cUnit, waistUnit, mealsOn? } her units, whether weight is in her
                 log and (only present when true) whether Meal notes is on.

   Tone rules (plan §7): no streaks, no grades, no "complete" counts; empty is calm ("Nothing yet"). */
import { MODULES } from "./modules.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[a-z][a-z0-9_]{0,15}$/;
const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
const fin = (n) => typeof n === "number" && Number.isFinite(n);
const round = (n, step) => Math.round(n / step) * step;
const clean1 = (n) => Math.round(n * 10) / 10;

/* ---------------- movement ---------------- */
export const MOVE_TYPES = Object.freeze([
  Object.freeze({ id: "walk", label: "Walk" }),
  Object.freeze({ id: "strength", label: "Strength" }),
  Object.freeze({ id: "yoga", label: "Yoga" }),
  Object.freeze({ id: "cycling", label: "Cycling" }),
  Object.freeze({ id: "swim", label: "Swim" }),
  Object.freeze({ id: "other", label: "Other" }),
]);
export const MOVE_TYPE_IDS = Object.freeze(MOVE_TYPES.map((t) => t.id));
/* Minute chips; the last reads "60+" (it saves 60 unless she types more in Custom). */
export const MOVE_MINUTES = Object.freeze([10, 20, 30, 45, 60]);
export const MOVE_MAX = 600, MOVES_PER_DAY = 12;
export const moveLabel = (type) => (MOVE_TYPES.find((t) => t.id === type) || MOVE_TYPES[MOVE_TYPES.length - 1]).label;

/* ---------------- sleep hours ---------------- */
export const SLEEP_CHIPS = Object.freeze([5, 6, 7, 8, 9]);
export const SLEEP_MIN = 0, SLEEP_MAX = 16, SLEEP_STEP = 0.5;
/** Hours to the stored half-hour value, or null when it is not a number in 0–16. */
export const cleanSleepH = (h) => (fin(h) && h >= SLEEP_MIN && h <= SLEEP_MAX ? round(h, SLEEP_STEP) : null);
/** "7h", "7½h". */
export const hoursText = (h) => (h == null ? "" : `${Math.floor(h)}${h % 1 ? "½" : ""}h`);

/* ---------------- PCOS day chips ---------------- */
/* From the module registry: the insulin-resistance signal chips (and the skin-darkening note as a "noticed it" chip),
   the PCOS symptoms the main list doesn't have, and the high-sugar day marker. */
const P = MODULES.pcos;
export const PCOS_DAY = Object.freeze([
  ...P.signals.filter((s) => s.kind === "chip" || s.kind === "note").map((s) => Object.freeze({ id: s.id, label: s.label, group: "signals", info: s.info || null, src: s.src || [] })),
  ...P.symptoms.filter((s) => !s.shared && s.kind !== "marker").map((s) => Object.freeze({ id: s.id, label: s.label, group: "symptoms", info: null, src: [] })),
  ...P.symptoms.filter((s) => s.kind === "marker").map((s) => Object.freeze({ id: s.id, label: s.label, group: "marker", info: null, src: [] })),
]);
export const PCOS_DAY_IDS = Object.freeze(PCOS_DAY.map((x) => x.id));
export const pcosLabel = (id) => (PCOS_DAY.find((x) => x.id === id) || { label: id }).label;

/* ---------------- units ---------------- */
export const WEIGHT_UNITS = Object.freeze(["kg", "lb"]);
export const GLUCOSE_UNITS = Object.freeze(["mg/dL", "mmol/L"]);
export const HBA1C_UNITS = Object.freeze(["%", "mmol/mol"]);
export const WAIST_UNITS = Object.freeze(["cm", "in"]);
const LB_PER_KG = 2.2046226218, MGDL_PER_MMOL = 18.0, CM_PER_IN = 2.54;
export const kgToLb = (kg) => kg * LB_PER_KG;
export const lbToKg = (lb) => lb / LB_PER_KG;
export const mmolToMgdl = (m) => m * MGDL_PER_MMOL;
export const mgdlToMmol = (g) => g / MGDL_PER_MMOL;
/* HbA1c: IFCC mmol/mol = (NGSP % − 2.15) × 10.929 (the IFCC–NGSP master equation). */
export const pctToMmolMol = (p) => (p - 2.15) * 10.929;
export const mmolMolToPct = (m) => m / 10.929 + 2.15;
export const inToCm = (i) => i * CM_PER_IN;
export const cmToIn = (c) => c / CM_PER_IN;
/** A value in one unit shown in another, to one decimal (whole numbers for mg/dL and mmol/mol). null for an unknown pair. */
export function convert(value, from, to) {
  if (!fin(value)) return null;
  if (from === to) return value;
  const f = {
    "kg>lb": kgToLb, "lb>kg": lbToKg, "mmol/L>mg/dL": mmolToMgdl, "mg/dL>mmol/L": mgdlToMmol,
    "%>mmol/mol": pctToMmolMol, "mmol/mol>%": mmolMolToPct, "in>cm": inToCm, "cm>in": cmToIn,
  }[`${from}>${to}`];
  if (!f) return null;
  const v = f(value);
  return to === "mg/dL" || to === "mmol/mol" ? Math.round(v) : clean1(v);
}
/* What can be typed, per unit: a plausibility guard for typos (a misplaced decimal), never a clinical range. */
export const PLAUSIBLE = Object.freeze({
  kg: [25, 300], lb: [55, 660], cm: [40, 200], in: [16, 80],
  "mg/dL": [20, 600], "mmol/L": [1, 33], "%": [3, 20], "mmol/mol": [9, 195],
});
/** Text she typed → a number (comma or point decimal), or null. */
export function parseNum(text) {
  if (typeof text === "number") return fin(text) ? text : null;
  const s = String(text ?? "").trim().replace(",", ".");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return fin(n) ? n : null;
}
/** A typed value checked against its unit: { ok: true, value } (to one decimal) or { ok: false, why }. */
export function checkValue(text, unit) {
  const r = PLAUSIBLE[unit];
  if (!r) return { ok: false, why: "unit" };
  const n = parseNum(text);
  if (n == null) return { ok: false, why: "number" };
  if (n < r[0] || n > r[1]) return { ok: false, why: "range", lo: r[0], hi: r[1] };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

/* ---------------- labs (dated values she types) ---------------- */
export const LAB_KINDS = Object.freeze({
  fglu: Object.freeze({ id: "fglu", label: "Fasting glucose", units: GLUCOSE_UNITS, pref: "glucoseUnit" }),
  hba1c: Object.freeze({ id: "hba1c", label: "HbA1c", units: HBA1C_UNITS, pref: "hba1cUnit" }),
  waist: Object.freeze({ id: "waist", label: "Waist measure", units: WAIST_UNITS, pref: "waistUnit" }),
});
export const LABS_MAX = 400;
const cleanLab = (x) => {
  if (!isObj(x) || !LAB_KINDS[x.kind] || !ISO.test(String(x.date))) return null;
  const k = LAB_KINDS[x.kind];
  if (!k.units.includes(x.unit) || !fin(x.value)) return null;
  const r = PLAUSIBLE[x.unit];
  if (x.value < r[0] || x.value > r[1]) return null;
  return { id: typeof x.id === "string" && x.id ? x.id.slice(0, 40) : `${x.kind}-${x.date}`, kind: x.kind, value: x.value, unit: x.unit, date: x.date };
};
/** Any stored value → a clean labs list, newest test date first (ties keep their order), at most LABS_MAX. */
export function cleanLabs(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const x of raw) { const c = cleanLab(x); if (c && !out.some((o) => o.id === c.id)) out.push(c); }
  return out.map((x, i) => [x, i]).sort((a, b) => b[0].date.localeCompare(a[0].date) || a[1] - b[1]).map(([x]) => x).slice(0, LABS_MAX);
}
/** Add one typed value: { ok, labs, why? }. The input list is not changed. */
export function addLab(labs, { kind, text, unit, date, id }) {
  if (!LAB_KINDS[kind] || !LAB_KINDS[kind].units.includes(unit)) return { ok: false, labs, why: "unit" };
  if (!ISO.test(String(date))) return { ok: false, labs, why: "date" };
  const v = checkValue(text, unit);
  if (!v.ok) return { ok: false, labs, why: v.why, lo: v.lo, hi: v.hi };
  const entry = { id: id || `${kind}-${date}-${Math.random().toString(36).slice(2, 8)}`, kind, value: v.value, unit, date };
  return { ok: true, labs: cleanLabs([entry, ...(Array.isArray(labs) ? labs : [])]) };
}
export const removeLab = (labs, id) => (Array.isArray(labs) ? labs.filter((x) => x.id !== id) : []);
/** "92 mg/dL", "5.6 %", "81 cm". */
export const labText = (x) => `${x.value}${x.unit === "%" ? "%" : ` ${x.unit}`}`;

/* ---------------- prefs ---------------- */
export const DEFAULT_BODY_PREFS = Object.freeze({ weightOn: false, weightUnit: "kg", glucoseUnit: "mg/dL", hba1cUnit: "%", waistUnit: "cm" });
/** Units for a locale when she hasn't chosen: lb / in for en-US, kg / cm elsewhere; glucose mg/dL for en-US, mmol/L for en-GB/CA/AU/IE/NZ. */
export function unitsFor(locale = "") {
  const l = String(locale || "");
  const us = /^en-US\b/i.test(l) || l === "en";
  const mmol = /^en-(GB|CA|AU|IE|NZ)\b/i.test(l);
  return { weightUnit: us ? "lb" : "kg", waistUnit: us ? "in" : "cm", glucoseUnit: mmol ? "mmol/L" : "mg/dL", hba1cUnit: mmol ? "mmol/mol" : "%" };
}
/** Any stored value → clean prefs; a missing unit is null (the screen then follows the locale, unitsFor). */
export function cleanBodyPrefs(raw) {
  const r = isObj(raw) ? raw : {};
  const pick = (v, list) => (list.includes(v) ? v : null);
  return { weightOn: r.weightOn === true, weightUnit: pick(r.weightUnit, WEIGHT_UNITS), glucoseUnit: pick(r.glucoseUnit, GLUCOSE_UNITS), hba1cUnit: pick(r.hba1cUnit, HBA1C_UNITS), waistUnit: pick(r.waistUnit, WAIST_UNITS), ...(r.mealsOn === true ? { mealsOn: true } : {}) };
}
/** Prefs with every unit filled in (her choice, else the locale's). */
export const unitsOf = (prefs, locale) => { const p = cleanBodyPrefs(prefs), d = unitsFor(locale); return { ...p, weightUnit: p.weightUnit || d.weightUnit, glucoseUnit: p.glucoseUnit || d.glucoseUnit, hba1cUnit: p.hba1cUnit || d.hba1cUnit, waistUnit: p.waistUnit || d.waistUnit }; };

/* ---------------- meal notes (optional, off by default; bodyPrefs.mealsOn) ----------------
   A light, calorie-free note: which meal, what it was mostly, whether she ate late and how her energy felt after.
   No foods, no amounts, no calories or macros, no photos, no scores, no "good" or "bad" food. */
export const MEAL_SLOTS = Object.freeze([
  Object.freeze({ id: "breakfast", label: "Breakfast" }),
  Object.freeze({ id: "lunch", label: "Lunch" }),
  Object.freeze({ id: "dinner", label: "Dinner" }),
  Object.freeze({ id: "snack", label: "Snack" }),
]);
/* What it was mostly: one of these (tap again to clear). "Ate late" is a separate yes/no next to them. */
export const MEAL_KINDS = Object.freeze([
  Object.freeze({ id: "balanced", label: "Balanced" }),
  Object.freeze({ id: "carbs", label: "Mostly carbs or sweet" }),
  Object.freeze({ id: "protein", label: "Protein-forward" }),
  Object.freeze({ id: "skipped", label: "Skipped" }),
]);
export const MEAL_LATE = Object.freeze({ id: "late", label: "Ate late" });
export const MEAL_ENERGY = Object.freeze([
  Object.freeze({ id: "steady", label: "Steady" }),
  Object.freeze({ id: "dipped", label: "Dipped" }),
  Object.freeze({ id: "crashed", label: "Crashed" }),
]);
export const MEALS_PER_DAY = 6;
const SLOT_IDS = MEAL_SLOTS.map((x) => x.id), KIND_IDS = MEAL_KINDS.map((x) => x.id), ENERGY_IDS = MEAL_ENERGY.map((x) => x.id);
const labelOf = (list, id) => (list.find((x) => x.id === id) || { label: id }).label;
export const mealSlotLabel = (id) => labelOf(MEAL_SLOTS, id);
export const mealKindLabel = (id) => labelOf(MEAL_KINDS, id);
export const mealEnergyLabel = (id) => labelOf(MEAL_ENERGY, id);
/** One meal note cleaned (unknown kind / energy dropped, late only when true), or null without a known meal. */
export function cleanMeal(m) {
  if (!isObj(m) || !SLOT_IDS.includes(m.meal)) return null;
  const out = { id: typeof m.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(m.id) ? m.id : `${m.meal}`, meal: m.meal };
  if (KIND_IDS.includes(m.kind)) out.kind = m.kind;
  if (m.late === true) out.late = true;
  if (ENERGY_IDS.includes(m.energy)) out.energy = m.energy;
  return out;
}

/* ---------------- the per-day log ---------------- */
const cleanMove = (m) => {
  if (!isObj(m) || !MOVE_TYPE_IDS.includes(m.type) || !Number.isInteger(m.min) || m.min < 1 || m.min > MOVE_MAX) return null;
  return { id: typeof m.id === "string" && m.id ? m.id.slice(0, 40) : `m${m.min}${m.type}`, type: m.type, min: m.min };
};
const cleanWeight = (w) => (isObj(w) && WEIGHT_UNITS.includes(w.unit) && fin(w.v) && w.v >= PLAUSIBLE[w.unit][0] && w.v <= PLAUSIBLE[w.unit][1] ? { v: w.v, unit: w.unit } : null);
/** One day, cleaned: only the fields with something in them; null when nothing is left. */
export function cleanBodyDay(d) {
  if (!isObj(d)) return null;
  const out = {};
  const h = cleanSleepH(d.sleepH); if (h != null) out.sleepH = h;
  if (Array.isArray(d.move)) { const mv = []; for (const m of d.move) { const c = cleanMove(m); if (c && !mv.some((x) => x.id === c.id) && mv.length < MOVES_PER_DAY) mv.push(c); } if (mv.length) out.move = mv; }
  if (Array.isArray(d.pcos)) { const ps = []; for (const id of d.pcos) if (typeof id === "string" && ID_RE.test(id) && !ps.includes(id)) ps.push(id); if (ps.length) out.pcos = ps; }
  const w = cleanWeight(d.weight); if (w) out.weight = w;
  if (Array.isArray(d.meals)) { const ms = []; for (const m of d.meals) { const c = cleanMeal(m); if (c && !ms.some((x) => x.id === c.id) && ms.length < MEALS_PER_DAY) ms.push(c); } if (ms.length) out.meals = ms; }
  return Object.keys(out).length ? out : null;
}
/** Any stored value → a clean bodyLog (keys in date order, empty days dropped). */
export function cleanBodyLog(raw) {
  if (!isObj(raw)) return {};
  const out = {};
  for (const k of Object.keys(raw).filter((k) => ISO.test(k)).sort()) { const d = cleanBodyDay(raw[k]); if (d) out[k] = d; }
  return out;
}
/** The day (a clean copy, {} when empty). */
export const bodyDay = (log, iso) => (isObj(log) && isObj(log[iso]) ? cleanBodyDay(log[iso]) || {} : {});
/* A new log with one day replaced (dropped when empty). The input is not changed. */
const withDay = (log, iso, day) => {
  const base = isObj(log) ? log : {};
  const c = cleanBodyDay(day);
  const out = {};
  for (const k of Object.keys(base)) if (k !== iso) out[k] = base[k];
  if (c) out[iso] = c;
  return cleanBodyLog(out);
};
/** Set (or clear with null) the hours slept on a day. */
export const setSleepH = (log, iso, h) => { const d = bodyDay(log, iso); const v = cleanSleepH(h); if (v == null) delete d.sleepH; else d.sleepH = v; return withDay(log, iso, d); };
/** Add a movement session ({ type, min }); { ok, log }. */
export function addMove(log, iso, { type, min, id }) {
  const m = cleanMove({ id: id || `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, type, min });
  const d = bodyDay(log, iso);
  if (!m || (d.move || []).length >= MOVES_PER_DAY) return { ok: false, log };
  return { ok: true, log: withDay(log, iso, { ...d, move: [...(d.move || []), m] }) };
}
export const removeMove = (log, iso, id) => { const d = bodyDay(log, iso); return withDay(log, iso, { ...d, move: (d.move || []).filter((m) => m.id !== id) }); };
/** Toggle one PCOS day chip. */
export const togglePcos = (log, iso, id) => { const d = bodyDay(log, iso); const cur = d.pcos || []; return withDay(log, iso, { ...d, pcos: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] }); };
/** Set (or clear with null text) the day's weight; { ok, log, why? }. */
export function setWeight(log, iso, text, unit) {
  const d = bodyDay(log, iso);
  if (text == null || String(text).trim() === "") { delete d.weight; return { ok: true, log: withDay(log, iso, d) }; }
  const v = checkValue(text, unit);
  if (!v.ok || !WEIGHT_UNITS.includes(unit)) return { ok: false, log, why: v.why || "unit", lo: v.lo, hi: v.hi };
  return { ok: true, log: withDay(log, iso, { ...d, weight: { v: v.value, unit } }) };
}
/** Total minutes and sessions on a day. */
export const moveTotals = (log, iso) => { const mv = bodyDay(log, iso).move || []; return { n: mv.length, min: mv.reduce((a, m) => a + m.min, 0) }; };
/** "30 min · Walk", "2 sessions · 75 min". */
export function moveText(log, iso) {
  const mv = bodyDay(log, iso).move || [];
  if (!mv.length) return "";
  if (mv.length === 1) return `${mv[0].min} min · ${moveLabel(mv[0].type)}`;
  return `${mv.length} sessions · ${mv.reduce((a, m) => a + m.min, 0)} min`;
}

/* ---------------- meal notes: add, change, remove, words ---------------- */
/** Add a meal note ({ meal, id? }); { ok, log, id }. ok false when the meal is unknown or the day already holds MEALS_PER_DAY. */
export function addMeal(log, iso, { meal, id } = {}) {
  const d = bodyDay(log, iso);
  const cur = d.meals || [];
  const m = cleanMeal({ id: id || `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, meal });
  if (!ISO.test(String(iso)) || !m || cur.length >= MEALS_PER_DAY || cur.some((x) => x.id === m.id)) return { ok: false, log, id: null };
  return { ok: true, log: withDay(log, iso, { ...d, meals: [...cur, m] }), id: m.id };
}
/** Change one meal note: patch { meal?, kind? (null clears), late? (boolean), energy? (null clears) }. Unknown id → unchanged. */
export function setMeal(log, iso, id, patch = {}) {
  const d = bodyDay(log, iso);
  const cur = d.meals || [];
  if (!cur.some((m) => m.id === id)) return isObj(log) ? log : {};
  const next = cur.map((m) => {
    if (m.id !== id) return m;
    const o = { ...m };
    if ("meal" in patch && SLOT_IDS.includes(patch.meal)) o.meal = patch.meal;
    if ("kind" in patch) { if (KIND_IDS.includes(patch.kind)) o.kind = patch.kind; else delete o.kind; }
    if ("late" in patch) { if (patch.late === true) o.late = true; else delete o.late; }
    if ("energy" in patch) { if (ENERGY_IDS.includes(patch.energy)) o.energy = patch.energy; else delete o.energy; }
    return o;
  });
  return withDay(log, iso, { ...d, meals: next });
}
export const removeMeal = (log, iso, id) => { const d = bodyDay(log, iso); return withDay(log, iso, { ...d, meals: (d.meals || []).filter((m) => m.id !== id) }); };
/** "Lunch · Mostly carbs or sweet · ate late · energy dipped" (only what she tapped). */
export function mealText(m) {
  if (!m) return "";
  return [mealSlotLabel(m.meal), m.kind ? mealKindLabel(m.kind) : "", m.late ? "ate late" : "", m.energy ? `energy ${mealEnergyLabel(m.energy).toLowerCase()}` : ""].filter(Boolean).join(" · ");
}
/** The Logs row value: one meal in words, or "3 meals" (plus how many times energy dipped or crashed). "" when none. */
export const mealsText = (log, iso) => mealsWords(bodyDay(log, iso).meals);
/** The same words for a list of meal notes (a clean day's `meals`). */
export function mealsWords(meals) {
  const ms = Array.isArray(meals) ? meals : [];
  if (!ms.length) return "";
  if (ms.length === 1) return mealText(ms[0]);
  const low = ms.filter((m) => m.energy === "dipped" || m.energy === "crashed").length;
  return `${ms.length} meals${low ? ` · energy dipped or crashed after ${low}` : ""}`;
}
/** The calendar day card: every meal note of the day in words, one sentence ("Breakfast: balanced, energy steady. Lunch: …"). */
export function mealDayWords(log, iso) {
  const ms = bodyDay(log, iso).meals || [];
  return ms.map((m) => {
    const parts = [m.kind ? mealKindLabel(m.kind).toLowerCase() : "", m.late ? "ate late" : "", m.energy ? `energy ${mealEnergyLabel(m.energy).toLowerCase()}` : ""].filter(Boolean);
    return `${mealSlotLabel(m.meal)}${parts.length ? `: ${parts.join(", ")}` : ""}.`;
  }).join(" ");
}
/** Counts over [from, to] (ISO dates, inclusive): { notes, days, daysWith: { balanced, carbs, protein, skipped, late },
    energyAfter: { steady, dipped, crashed } }. daysWith = days with at least one meal note of that kind; energyAfter = meal notes. */
export function mealCounts(log, from, to) {
  const out = { notes: 0, days: 0, daysWith: { balanced: 0, carbs: 0, protein: 0, skipped: 0, late: 0 }, energyAfter: { steady: 0, dipped: 0, crashed: 0 } };
  const clean = cleanBodyLog(log);
  for (const [iso, d] of Object.entries(clean)) {
    if (iso < from || iso > to || !d.meals) continue;
    out.days++; out.notes += d.meals.length;
    for (const k of KIND_IDS) if (d.meals.some((m) => m.kind === k)) out.daysWith[k]++;
    if (d.meals.some((m) => m.late)) out.daysWith.late++;
    for (const m of d.meals) if (m.energy) out.energyAfter[m.energy]++;
  }
  return out;
}
const countList = (pairs) => pairs.filter(([, n]) => n > 0).map(([w, n]) => `${w} on ${n} ${n === 1 ? "day" : "days"}`);
const energyList = (e) => [["steady", e.steady], ["dipped", e.dipped], ["crashed", e.crashed]].filter(([, n]) => n > 0).map(([w, n]) => `${w} after ${n} ${n === 1 ? "meal" : "meals"}`);
const joinAnd = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
/** The appointment summary's "Meal notes" lines: counts in words, no foods. [] when there are no meal notes. */
export function mealReportLines(log, from, to) {
  const c = mealCounts(log, from, to);
  if (!c.notes) return [];
  const kinds = countList([["balanced", c.daysWith.balanced], ["mostly carbs or sweet", c.daysWith.carbs], ["protein-forward", c.daysWith.protein], ["a skipped meal", c.daysWith.skipped], ["ate late", c.daysWith.late]]);
  const en = energyList(c.energyAfter);
  return [
    `${c.notes} meal ${c.notes === 1 ? "note" : "notes"} on ${c.days} ${c.days === 1 ? "day" : "days"} (no foods, amounts or calories).`,
    ...(kinds.length ? [`What meals were mostly: ${joinAnd(kinds)}.`] : []),
    ...(en.length ? [`Energy after meals: ${joinAnd(en)}.`] : []),
  ];
}

/* ---------------- the Logs card rows ---------------- */
const SLEPT = { good: "Slept well", fair: "So-so", poor: "Rough night" };
const FLOW_W = { spot: "Spotting", light: "Light flow", med: "Medium flow", heavy: "Heavy flow", flood: "Flooding" };
const moodWord = (q) => (q >= 7 ? "Good" : q >= 4 ? "In between" : "Low");
/** Which day of a period `iso` is (1 = it started that day), from the check-ins, or 0 when it isn't a period day. */
export function periodDayOf(days, iso, isPeriod) {
  const byDate = new Map((Array.isArray(days) ? days : []).map((d) => [d.date, d]));
  let n = 0, cur = iso;
  while (byDate.has(cur) && isPeriod(byDate.get(cur)) && n < 15) {
    n++;
    const t = new Date(cur + "T12:00:00"); t.setDate(t.getDate() - 1);
    cur = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }
  return n;
}
/** The rows of the Logs card for a day, in order: [{ id, label, icon, tint, value, logged }].
    ctx: { moodDay (the Mind check-in that day, calm R5), preg, entry (the check-in or null), day (bodyDay), medDay ({ medId: bool }), meds, pcosOn, weightOn, mealsOn, symLabel(id),
    periodDay (0 = none), fertText }. value is a short plain line; "" when nothing is logged yet. */
export function logRows({ moodDay = null, preg = false, entry = null, day = {}, medDay = null, meds = [], pcosOn = false, weightOn = false, mealsOn = false, symLabel = (id) => id, periodDay = 0 } = {}) {
  const sym = entry?.sym || {};
  const on = Object.keys(sym).filter((k) => (sym[k] || 0) > 0).sort((a, b) => sym[b] - sym[a]);
  const symV = on.length ? `${on.slice(0, 2).map(symLabel).join(", ")}${on.length > 2 ? ` +${on.length - 2}` : ""}` : entry ? "None" : "";
  const flowV = entry?.flow ? `${FLOW_W[entry.flow] || "Flow"}${periodDay ? ` · day ${periodDay}` : ""}` : entry?.period ? `Period${periodDay ? ` · day ${periodDay}` : ""}` : entry ? "No bleeding" : "";
  const sleepV = [day.sleepH != null ? hoursText(day.sleepH) : "", entry?.sleepQ ? SLEPT[entry.sleepQ] : ""].filter(Boolean).join(" · ");
  const mq = entry?.scales?.moodq || 0, ms = sym.mood || 0;
  const md = moodDay && typeof moodDay === "object" ? moodDay : {};
  const MW = ["", "Very low", "Low", "Okay", "Good", "Very good"];
  const mdV = [MW[md.mood] || "", (Array.isArray(md.tags) ? md.tags : []).slice(0, 2).join(", ")].filter(Boolean).join(" · ");
  const moodV = mdV || (mq > 0 ? moodWord(mq) : ms > 0 ? (preg ? "Mood noted" : "Mood swings") : "");
  const taken = (meds || []).filter((m) => medDay && medDay[m.id]);
  const medsV = !meds?.length ? "" : taken.length ? taken.map((m) => m.name).slice(0, 2).join(", ") + (taken.length > 2 ? ` +${taken.length - 2}` : "") : "";
  const mv = day.move || [];
  const moveV = !mv.length ? "" : mv.length === 1 ? `${mv[0].min} min · ${moveLabel(mv[0].type)}` : `${mv.length} sessions · ${mv.reduce((a, m) => a + m.min, 0)} min`;
  const pc = day.pcos || [];
  const rows = [
    { id: "symptoms", label: "Symptoms", icon: "pulse", tint: "body", value: symV, logged: on.length > 0 },
    ...(preg ? [] : [{ id: "flow", label: "Flow", icon: "drop", tint: "body", value: flowV, logged: !!(entry && (entry.flow || entry.period)) }]),
    { id: "sleep", label: "Sleep", icon: "moon", tint: "mind", value: sleepV, logged: day.sleepH != null || !!entry?.sleepQ },
    { id: "move", label: "Movement", icon: "move", tint: "body", value: moveV, logged: mv.length > 0 },
    { id: "mood", label: "Mood", icon: "smile", tint: "mind", value: moodV, logged: mq > 0 || ms > 0 || !!mdV },
    { id: "meds", label: "Meds", icon: "pill", tint: "patterns", value: medsV, logged: taken.length > 0 },
    { id: "note", label: "Note", icon: "note", tint: "you", value: entry?.note ? (entry.note.length > 42 ? `${entry.note.slice(0, 40)}…` : entry.note) : "", logged: !!entry?.note },
    ...(pcosOn && !preg ? [{ id: "pcos", label: "PCOS signals", icon: "sparkle", tint: "body", value: pc.length ? `${pc.slice(0, 2).map(pcosLabel).join(", ")}${pc.length > 2 ? ` +${pc.length - 2}` : ""}` : "", logged: pc.length > 0 }] : []),
    ...(mealsOn && !preg ? [{ id: "meals", label: "Meals", icon: "bowl", tint: "body", value: mealsWords(day.meals), logged: (day.meals || []).length > 0 }] : []),
    ...(weightOn ? [{ id: "weight", label: "Weight", icon: "scale", tint: "you", value: day.weight ? `${day.weight.v} ${day.weight.unit}` : "", logged: !!day.weight }] : []),
  ];
  return rows;
}
