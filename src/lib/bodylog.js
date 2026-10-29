/* The fast log's second half (calm R4, spec §3.5b): what she logs next to the check-in, one tap at a time, on this
   device only. Pure: no React, no storage, no network; imports engine.js and modules.js only, never record.js
   (record.js imports this file for its RULES entries and the clean functions App.jsx runs on load and restore).

   Three persisted keys (record class, in encrypted backups, restored literally):
   - bodyLog   { [YYYY-MM-DD]: BodyDay }  BodyDay = { sleepH?, move?, pcos?, weight? }
                 sleepH  hours slept, 0–16 in half hours (the check-in keeps the "Slept well / So-so / Rough night" word)
                 move    [{ id, type, min }] movement sessions: type MOVE_TYPES id, min 1–600 (any kind; general, not POTS)
                 pcos    PCOS module day chips: insulin-resistance signals, PCOS symptoms and the high-sugar day marker
                         (PCOS_DAY ids; ids a later build writes are kept)
                 weight  { v, unit } optional, only when she turned weight on; never on Home, never charted
   - labs      [{ id, kind, value, unit, date }] values she types from her own results (fasting glucose, HbA1c) and
                 waist measures, each dated. Stored exactly as typed in her unit; Cyra never interprets them.
   - bodyPrefs { weightOn, weightUnit, glucoseUnit, hba1cUnit, waistUnit } her units and whether weight is in her log.

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
  return { weightOn: r.weightOn === true, weightUnit: pick(r.weightUnit, WEIGHT_UNITS), glucoseUnit: pick(r.glucoseUnit, GLUCOSE_UNITS), hba1cUnit: pick(r.hba1cUnit, HBA1C_UNITS), waistUnit: pick(r.waistUnit, WAIST_UNITS) };
}
/** Prefs with every unit filled in (her choice, else the locale's). */
export const unitsOf = (prefs, locale) => { const p = cleanBodyPrefs(prefs), d = unitsFor(locale); return { ...p, weightUnit: p.weightUnit || d.weightUnit, glucoseUnit: p.glucoseUnit || d.glucoseUnit, hba1cUnit: p.hba1cUnit || d.hba1cUnit, waistUnit: p.waistUnit || d.waistUnit }; };

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
    ctx: { preg, entry (the check-in or null), day (bodyDay), medDay ({ medId: bool }), meds, pcosOn, weightOn, symLabel(id),
    periodDay (0 = none), fertText }. value is a short plain line; "" when nothing is logged yet. */
export function logRows({ preg = false, entry = null, day = {}, medDay = null, meds = [], pcosOn = false, weightOn = false, symLabel = (id) => id, periodDay = 0 } = {}) {
  const sym = entry?.sym || {};
  const on = Object.keys(sym).filter((k) => (sym[k] || 0) > 0).sort((a, b) => sym[b] - sym[a]);
  const symV = on.length ? `${on.slice(0, 2).map(symLabel).join(", ")}${on.length > 2 ? ` +${on.length - 2}` : ""}` : entry ? "None" : "";
  const flowV = entry?.flow ? `${FLOW_W[entry.flow] || "Flow"}${periodDay ? ` · day ${periodDay}` : ""}` : entry?.period ? `Period${periodDay ? ` · day ${periodDay}` : ""}` : entry ? "No bleeding" : "";
  const sleepV = [day.sleepH != null ? hoursText(day.sleepH) : "", entry?.sleepQ ? SLEPT[entry.sleepQ] : ""].filter(Boolean).join(" · ");
  const mq = entry?.scales?.moodq || 0, ms = sym.mood || 0;
  const moodV = mq > 0 ? moodWord(mq) : ms > 0 ? (preg ? "Mood noted" : "Mood swings") : "";
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
    { id: "mood", label: "Mood", icon: "smile", tint: "mind", value: moodV, logged: mq > 0 || ms > 0 },
    { id: "meds", label: "Meds", icon: "pill", tint: "patterns", value: medsV, logged: taken.length > 0 },
    { id: "note", label: "Note", icon: "note", tint: "you", value: entry?.note ? (entry.note.length > 42 ? `${entry.note.slice(0, 40)}…` : entry.note) : "", logged: !!entry?.note },
    ...(pcosOn && !preg ? [{ id: "pcos", label: "PCOS signals", icon: "sparkle", tint: "body", value: pc.length ? `${pc.slice(0, 2).map(pcosLabel).join(", ")}${pc.length > 2 ? ` +${pc.length - 2}` : ""}` : "", logged: pc.length > 0 }] : []),
    ...(weightOn ? [{ id: "weight", label: "Weight", icon: "scale", tint: "you", value: day.weight ? `${day.weight.v} ${day.weight.unit}` : "", logged: !!day.weight }] : []),
  ];
  return rows;
}
