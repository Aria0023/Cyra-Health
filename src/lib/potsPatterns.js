/* POTS patterns (design 5.2-5.10, spec A13.5): what her own log shows over a window, worked out
   on the device at render and never stored. Pure functions only: no React, no state, no
   network, no storage. It reads the POTS log (lib/pots.js) and, read-only, the check-in log
   (sleep answers, hot flashes) and the logged period starts (engine.js insights().starts).

   Rules every function keeps:
   - The outcome is her own one-tap day rating: a rough day is rated Rough or Bad (3-4), among
     RATED days only. A day is never rated by guessing from symptoms.
   - Missing is not zero: an unrated day, a day with no drinks logged or a dose slot nobody
     logged is unknown (null) and left out of a comparison, never counted as "no".
   - Small numbers are held back (THRESH.pat, A13.5): a factor shows only with 14 rated days in
     the window, 5 days on each side, 4 rough days in all, a difference of at least 20 points
     AND a ratio of at least 1.3. Everything else is listed under "What Cyra checked".
   - Copy uses natural frequencies ("6 of 9 days"), names chance, and never diagnoses or calls a
     dose late or missed (POTS_BANNED is checked over every string by the unit tests).
   - Watch and ring readings (wearData) are compared on screen only. Callers that build a file
     (lib/potsReport.js) never pass them, so nothing derived from them can reach an export.
   - Cycle groups use logged period starts only, never a predicted ovulation or phase. */
import { THRESH, POTS_SYM, POTS_TRIG, POTS_MED_LIB } from "./potsConstants.js";
import { localDay, toMin, fmtFluid, fmtSodium, testTrend, median, isLockedPots, activeMeds, dayTotals } from "./pots.js";

export { testTrend };

const P = THRESH.pat;
const EPS = 1e-9; // 0.6 - 0.4 is 0.19999999999999996 in floating point: compare thresholds with a hair of slack
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (v) => typeof v === "string" && ISO.test(v);
/** `iso` moved by `n` calendar days, as a local day key. */
export const addDays = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return localDay(new Date(y, m - 1, d + n)); };
/** Whole calendar days from `a` to `b`. */
export const dayDiff = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
/** Every local day key from `from` to `to`, both included, stepping one Date (at noon, so a
    clock change never skips or repeats a day) instead of building a new one per day. */
function eachDay(from, to) {
  const out = [];
  const [y, m, d] = from.split("-").map(Number);
  const c = new Date(y, m - 1, d, 12);
  for (let s = from; s <= to; c.setDate(c.getDate() + 1), s = localDay(c)) out.push(s);
  return out;
}
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const lc1 = (s) => (typeof s === "string" && s ? s[0].toLowerCase() + s.slice(1) : s);
const n1 = (x) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 10) / 10));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const SLEEP = ["good", "fair", "poor"];
export const RATING_WORD = { 1: "Good", 2: "Okay", 3: "Rough", 4: "Bad" };

/* ---------- names ---------- */
export function symName(p, id) {
  const b = POTS_SYM.find((x) => x.id === id);
  if (b) return b.label;
  const c = ((p && p.settings && p.settings.customSym) || []).find((x) => x.id === id);
  return c ? c.label : "Other symptom";
}
export function trigName(p, id) {
  const b = POTS_TRIG.find((x) => x.id === id);
  if (b) return b.label;
  const c = ((p && p.settings && p.settings.customTrig) || []).find((x) => x.id === id);
  return c ? c.label : "Other trigger";
}
/** Library names read as words inside a sentence ("compression (leg)"); her own names stay as typed. */
const inSentence = (med) => (POTS_MED_LIB.some((x) => x.id === med.lib && x.name === med.name) ? lc1(med.name) : med.name);

/* ---------- stages and windows ---------- */
/** A stage with a cycle to group by: My Cycle and Trying to Conceive ("periods"), and
    Perimenopause. Not Menopause, not Pregnancy. */
export const isCycleStage = (stage, stageName) => stage === "periods" || (stage === "peri" && stageName !== "Menopause");
/** Her first POTS day: the earliest logged day or test, or `today` when there is none. */
export function firstDay(p, today) {
  if (!isObj(p) || isLockedPots(p)) return today;
  const ds = [...Object.keys(p.days || {}), ...(p.tests || []).map((t) => t.date)].filter((d) => isIso(d) && d <= today).sort();
  return ds.length ? ds[0] : today;
}
/** Days of POTS data, from her first POTS day to today, both included. */
export const dataDays = (p, today) => dayDiff(firstDay(p, today), today) + 1;
/** "Since you started" is offered once there are more than 60 days of data. */
export const sinceOffered = (p, today) => dataDays(p, today) > P.sinceDays;
/** The days a window covers: "today", "7", "30" (default), "90" or "all" (since her first POTS day). */
export function windowRange(p, window, today) {
  if (window === "today") return { from: today, to: today };
  if (window === "7") return { from: addDays(today, -6), to: today };
  if (window === "90") return { from: addDays(today, -89), to: today };
  if (window === "all") return { from: firstDay(p, today), to: today };
  return { from: addDays(today, -29), to: today };
}

/* ---------- cycle groups (retrospective, logged starts only) ---------- */
const cleanStarts = (starts) => [...new Set((Array.isArray(starts) ? starts : []).filter(isIso))].sort();
/** The group a day falls in, from logged period starts only (design 5.6):
    "period" = a start day and the 4 days after it; "weekBefore" = the 7 days before a LOGGED
    next start (completed cycles only); "other" = any other day from the first start to the
    last start's period; null (unknown) before the first start or after the last period. */
export function cycleGroupOn(iso, starts) {
  const s = cleanStarts(starts);
  if (!s.length || !isIso(iso)) return null;
  if (s.some((x) => x <= iso && iso <= addDays(x, 4))) return "period";
  for (let i = 1; i < s.length; i++) if (addDays(s[i], -7) <= iso && iso <= addDays(s[i], -1)) return "weekBefore";
  if (s[0] <= iso && iso <= addDays(s[s.length - 1], 4)) return "other";
  return null;
}
/** Cycle day on `iso`: day 1 is the latest logged start on or before it (the app's own cycle-day
    count), shown only when that start was at most 45 days earlier; otherwise null. */
export function cycleDayOn(iso, starts) {
  if (!isIso(iso)) return null;
  const s = cleanStarts(starts).filter((x) => x <= iso);
  if (!s.length) return null;
  const n = dayDiff(s[s.length - 1], iso);
  return n <= P.cycleDayMax ? n + 1 : null;
}
/** Cycle group and cycle day for every day in [from, to] at once, from cleaned starts `S`: the
    same answers as cycleGroupOn and cycleDayOn, without re-reading the starts for each day.
    -> Map(iso -> { group, day }). */
function cycleIndex(S, from, to) {
  const out = new Map();
  if (!S.length || !isIso(from) || !isIso(to) || from > to) return out;
  const period = new Set(), before = new Set();
  for (const s of S) for (let i = 0; i <= 4; i++) period.add(addDays(s, i));
  for (let i = 1; i < S.length; i++) for (let k = 1; k <= 7; k++) before.add(addDays(S[i], -k));
  const end = addDays(S[S.length - 1], 4);
  let j = -1, since = 0;
  for (const d of eachDay(from, to)) {
    let moved = false;
    while (j + 1 < S.length && S[j + 1] <= d) { j++; moved = true; }
    since = moved ? dayDiff(S[j], d) : since + 1;
    out.set(d, {
      group: period.has(d) ? "period" : before.has(d) ? "weekBefore" : S[0] <= d && d <= end ? "other" : null,
      day: j >= 0 && since <= P.cycleDayMax ? since + 1 : null,
    });
  }
  return out;
}
/** The label a stand-test result carries: { day, weekBefore } or null (design 5.6: a label
    only; nothing is inferred from it). Only in a cycle stage. */
export function cycleLabelOn(iso, starts, stage, stageName) {
  if (!isCycleStage(stage, stageName)) return null;
  const day = cycleDayOn(iso, starts);
  return day == null ? null : { day, weekBefore: cycleGroupOn(iso, starts) === "weekBefore" };
}

/* ---------- day rows ---------- */
/** One row per calendar day in [from, to] (design 5.2). ctx: from, to, stage, starts (logged
    period starts), checkin (iso -> that day's check-in entry) or days / pregLog to build it,
    wearData (watch or ring rows; on screen only), today (that row is marked `partial`: the day
    isn't over, so its drinks and salt so far aren't compared with a goal). */
function checkinFor(ctx) {
  if (typeof ctx.checkin === "function") return (d) => { const c = ctx.checkin(d); return isObj(c) ? c : null; };
  if (ctx.stage === "preg") { const log = isObj(ctx.pregLog) ? ctx.pregLog : {}; return (d) => (isObj(log[d]) ? log[d] : null); }
  const by = new Map((Array.isArray(ctx.days) ? ctx.days : []).filter((x) => isObj(x) && isIso(x.date)).map((x) => [x.date, x]));
  return (d) => by.get(d) || null;
}
/** Every planned slot of `m` logged that day: true if each was logged taken within 2 hours of
    its time, false if any was skipped or taken further away, null if any slot is unlogged. */
function slotRule(m, doses) {
  let ok = true;
  for (const slot of m.times) {
    const ds = doses.filter((x) => x.medId === m.id && x.slot === slot);
    if (!ds.length) return null;
    if (!ds.some((x) => x.state === "taken" && Math.abs(toMin(x.t) - toMin(slot)) <= P.doseWithin)) ok = false;
  }
  return ok;
}
/** "Below" a goal, or (no goal set) below her median of logged days in the window, which needs
    10 logged days; otherwise unknown. Today is still going (`partial`): its total so far is
    never compared with a whole day's goal or usual amount, and doesn't move the median. */
function goalSplit(rows, key, goal, out, basisKey) {
  const logged = rows.filter((r) => r[key] != null && !r.partial).map((r) => r[key]);
  let cut = null, basis = null;
  if (fin(goal)) { cut = goal; basis = "goal"; } else if (logged.length >= P.medianDays) { cut = median(logged); basis = "usual"; }
  for (const r of rows) { r[basisKey] = basis; r[out] = cut == null || r[key] == null || r.partial ? null : r[key] < cut; }
}
export function dayRows(p, ctx = {}) {
  if (!isObj(p) || isLockedPots(p)) return [];
  const { from, to, stage = null, starts = [], wearData = [] } = ctx;
  if (!isIso(from) || !isIso(to) || from > to) return [];
  const checkin = checkinFor(ctx);
  const days = p.days || {};
  // Exercise and IV fluids are known only once she has ever logged one: before that, a day
  // without a session or a drip isn't evidence of "no".
  const everIv = Object.values(days).some((d) => isObj(d) && d.iv);
  const everMoved = Object.values(days).some((d) => isObj(d) && Array.isArray(d.move) && d.move.length > 0);
  // Watch and ring rows (illustrative demo rows are never compared).
  const wear = new Map((Array.isArray(wearData) ? wearData : []).filter((w) => isObj(w) && isIso(w.date) && !w.demo).map((w) => [w.date, w]));
  const cyc = cycleIndex(cleanStarts(starts), from, to);
  const testDays = new Set((p.tests || []).filter((t) => t.status !== "running").map((t) => t.date));
  const today = isIso(ctx.today) ? ctx.today : null;
  const rows = [];
  let prevIso = addDays(from, -1);
  for (const d of eachDay(from, to)) {
    const x = isObj(days[d]) ? days[d] : {};
    const prev = isObj(days[prevIso]) ? days[prevIso] : null;
    prevIso = d;
    const rating = [1, 2, 3, 4].includes(x.rating) ? x.rating : null;
    let fl = null, na = null;
    for (const it of x.intake || []) { if (fin(it.ml)) fl = (fl || 0) + it.ml; if (fin(it.naMg)) na = (na || 0) + it.naMg; }
    const c = checkin(d), csym = c && isObj(c.sym) ? c.sym : {};
    const medWithin = {};
    for (const m of activeMeds(p, d)) if (m.kind !== "aid" && m.times.length) medWithin[m.id] = slotRule(m, x.doses || []);
    const mv = Object.values(medWithin);
    const w = wear.get(d) || null;
    const eps = x.eps || [];
    const sym = isObj(x.sym) ? { ...x.sym } : {};
    rows.push({
      date: d, logged: Object.keys(x).length > 0, partial: d === today,
      rated: rating != null, rating, rough: rating == null ? null : rating >= 3, good: rating == null ? null : rating === 1,
      up: fin(x.up) ? x.up : null,
      fluidMl: fl, naMg: na, belowFluidGoal: null, belowNaGoal: null, fluidBasis: null, naBasis: null,
      // Her POTS sleep answer wins. A check-in "fair" alone is unknown: the check-in saves "fair"
      // when sleep wasn't answered (TodayScreen), so it can't be told apart from no answer.
      sleepPoor: SLEEP.includes(x.sleep) ? x.sleep === "poor" : c && c.sleepQ === "poor" ? true : c && c.sleepQ === "good" ? false : null,
      movedPrev: everMoved && prev && Object.keys(prev).length ? (prev.move || []).length > 0 : null,
      heat: rating != null ? (x.trig || []).includes("t_heat") || eps.some((e) => e.pos === "heat") : null,
      trig: new Set(x.trig || []),
      ivPrev: everIv ? !!(prev && prev.iv) : null,
      medWithin, medsWithin2h: !mv.length || mv.some((v) => v == null) ? null : mv.every(Boolean),
      aids: isObj(x.aids) ? { ...x.aids } : {},
      // Hot flashes from a perimenopause check-in; a quick check-in's combined question
      // ("hot flashes or night sweats?") doesn't say which, so it is unknown.
      hfDay: stage === "peri" && c ? (isObj(c.__q) && c.__q.hf != null ? null : fin(csym.hf) && csym.hf >= 2) : null,
      rhr: w && fin(w.rhr) ? w.rhr : null, hrv: w && fin(w.hrv) ? w.hrv : null, sleep: w && fin(w.sleep) ? w.sleep : null, wearSource: w ? w.sourceId || null : null,
      symSev: sym, symAny: Object.keys(sym).length > 0,
      cycleGroup: (cyc.get(d) || {}).group ?? null, cycleDay: (cyc.get(d) || {}).day ?? null,
      eps: eps.length, faints: eps.filter((e) => e.faint === "yes").length, nearFaints: eps.filter((e) => e.faint === "almost").length,
      test: testDays.has(d),
    });
  }
  const g = (p.settings && p.settings.goals) || {};
  goalSplit(rows, "fluidMl", g.fluidMl, "belowFluidGoal", "fluidBasis");
  goalSplit(rows, "naMg", g.naMg, "belowNaGoal", "naBasis");
  return rows;
}

/* ---------- one factor ---------- */
/** Rough days on the exposed and unexposed sides of `factor` ({ key, fn(row) -> true | false |
    null, minPaired? }), over rows whose outcome is known (rated, by default). -> { key, nE, nU,
    aE, aU, pE, pU, diff, ratio, shown, reason, need, dir, rated }. reason: why it isn't shown
    ("rated": under 14 rated days; "sides": under 5 days on a side; "paired": too few paired
    days; "rough": under 4 rough days; "small": no clear difference), else null. */
export function compareFactor(rows, factor, { outcome = null } = {}) {
  const out = typeof outcome === "function" ? outcome : (r) => (r.rated ? r.rough : null);
  const known = (Array.isArray(rows) ? rows : []).filter((r) => out(r) != null);
  let nE = 0, nU = 0, aE = 0, aU = 0;
  for (const r of known) {
    const v = factor.fn(r);
    if (v == null) continue;
    if (v) { nE++; if (out(r)) aE++; } else { nU++; if (out(r)) aU++; }
  }
  const pE = nE ? aE / nE : null, pU = nU ? aU / nU : null;
  const diff = nE && nU ? Math.abs(pE - pU) : 0;
  const hi = Math.max(pE || 0, pU || 0), lo = Math.min(pE || 0, pU || 0);
  const ratio = lo === 0 ? (hi > 0 ? Infinity : 1) : hi / lo;
  const paired = nE + nU, minPaired = factor.minPaired || 0;
  const gates = known.length >= P.rated && nE >= P.side && nU >= P.side && aE + aU >= P.rough && paired >= minPaired;
  const shown = gates && diff >= P.diff - EPS && ratio >= P.ratio - EPS;
  const reason = shown ? null : known.length < P.rated ? "rated" : nE < P.side || nU < P.side ? "sides" : paired < minPaired ? "paired" : aE + aU < P.rough ? "rough" : "small";
  return { key: factor.key, nE, nU, aE, aU, pE, pU, diff, ratio, shown, gates, reason, need: Math.max(0, P.side - nE, P.side - nU), dir: pE == null || pU == null ? 0 : Math.sign(pE - pU), rated: known.length };
}

/* ---------- the factors (design 5.3) ---------- */
const WEAR_WORD = { healthkit: "watch", oura: "ring" };
const wearWord = (src) => WEAR_WORD[src] || "wearable";
/** Watch and ring provenance (design 5.3): HRV only with exactly one connected source, over that
    source's rows; resting heart rate and sleep score over the window's dominant source. */
function wearSourceFor(rows, kind, connected) {
  if (kind === "hrv") return Array.isArray(connected) && connected.length === 1 ? connected[0] : null;
  const n = new Map();
  for (const r of rows) if (r.wearSource && (fin(r.rhr) || fin(r.sleep))) n.set(r.wearSource, (n.get(r.wearSource) || 0) + 1);
  let best = null;
  for (const [k, v] of n) if (!best || v > n.get(best)) best = k;
  return best;
}
/** Every factor Cyra compares for this window. `you`: second person on screen ("days you…"),
    third person in the report ("days she…"). `wear`: include watch and ring factors (on screen
    only). -> [{ key, name, kind: "plain" | "med" | "wear", fn, phrases: [exposed, other],
    minPaired?, src?, missing? }]; `missing` marks one Cyra can't compute yet (with why). */
export function factorList(p, rows, ctx = {}, { you = true, wear = true } = {}) {
  const V = you ? { y: "you", r: "your", was: "were" } : { y: "she", r: "her", was: "was" };
  const out = [];
  const add = (f) => out.push({ kind: "plain", ...f });
  const basisF = rows.find((r) => r.fluidBasis)?.fluidBasis || null, basisN = rows.find((r) => r.naBasis)?.naBasis || null;
  if (basisF) add({ key: "fluid", name: "Fluids", fn: (r) => r.belowFluidGoal, phrases: basisF === "goal" ? [`days ${V.y} drank less than ${V.r} goal`, `days ${V.y} reached it`] : [`days ${V.y} drank less than usual`, `days ${V.y} drank ${V.r} usual amount or more`] });
  else add({ key: "fluid", name: "Fluids", missing: `set a goal, or log drinks on ${P.medianDays} days, to compare` });
  if (basisN) add({ key: "sodium", name: "Salt", fn: (r) => r.belowNaGoal, phrases: basisN === "goal" ? [`days ${V.r} salt was under ${V.r} goal`, `days ${V.y} reached it`] : [`days ${V.r} salt was under usual`, `days it was ${V.r} usual or more`] });
  else add({ key: "sodium", name: "Salt", missing: `set a goal, or log sodium on ${P.medianDays} days, to compare` });
  add({ key: "sleep", name: "Sleep", fn: (r) => r.sleepPoor, phrases: ["days after a rough night", "days after a better night"] });
  if (rows.some((r) => r.movedPrev != null)) add({ key: "moved", name: "Exercise the day before", fn: (r) => r.movedPrev, phrases: [`days after ${V.y} exercised`, `days after ${V.y} didn't`] });
  add({ key: "heat", name: "Heat", fn: (r) => r.heat, phrases: [`days ${V.y} tagged heat`, `days ${V.y} didn't`] });
  // Triggers she tagged on at least 5 rated days (heat has its own factor above).
  const tagN = new Map();
  for (const r of rows) if (r.rated) for (const id of r.trig) if (id !== "t_heat") tagN.set(id, (tagN.get(id) || 0) + 1);
  for (const [id, n] of [...tagN].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))) {
    if (n < P.trigDays) continue;
    const label = trigName(p, id), word = POTS_TRIG.some((x) => x.id === id) ? lc1(label) : label;
    // The two period tags are written in her voice ("On my period"): give them a sentence of
    // their own, so neither the screen nor the third-person report reads "tagged on my period".
    const phrases = id === "t_period" ? [`days ${V.y} ${V.was} on ${V.r} period`, "other days"]
      : id === "t_premens" ? [`days in the week before ${V.r} period`, "other days"]
      : [`days ${V.y} tagged ${word}`, `days ${V.y} didn't`];
    add({ key: `trig:${id}`, name: label, fn: (r) => (r.rated ? r.trig.has(id) : null), phrases });
  }
  if (rows.some((r) => r.ivPrev != null)) add({ key: "iv", name: "IV fluids the day before", fn: (r) => r.ivPrev, phrases: ["days after IV fluids", "other days"] });
  for (const m of p.meds || []) {
    if (m.kind === "aid") {
      if (!rows.some((r) => typeof r.aids[m.id] === "boolean")) continue;
      add({ key: `aid:${m.id}`, name: m.name, fn: (r) => (typeof r.aids[m.id] === "boolean" ? r.aids[m.id] : null), phrases: [`days with ${inSentence(m)}`, "days without"] });
    } else if (m.times.length && rows.some((r) => m.id in r.medWithin)) {
      out.push({ kind: "med", key: `med:${m.id}`, name: `${m.name} timing`, fn: (r) => (m.id in r.medWithin ? r.medWithin[m.id] : null), phrases: [`days every planned ${m.name} dose was logged within 2 hours of its time`, "other days"] });
    }
  }
  if (ctx.stage === "peri" && rows.some((r) => r.hfDay === true)) add({ key: "hf", name: "Hot flashes", fn: (r) => r.hfDay, phrases: ["days with moderate or strong hot flashes", "other days"] });
  if (wear && you) {
    const W = [["rhr", "Resting heart rate (watch or ring)", "showed a resting heart rate above your usual", "at or below your usual", (v, m) => v > m],
      ["hrv", "HRV (watch or ring)", "showed an HRV below your usual", "at or above your usual", (v, m) => v < m],
      ["sleep", "Sleep score (watch or ring)", "showed a sleep score below your usual", "at or above your usual", (v, m) => v < m]];
    for (const [k, name, exp, other, below] of W) {
      const src = wearSourceFor(rows, k, ctx.connected);
      const vals = src ? rows.filter((r) => r.rated && r.wearSource === src && fin(r[k])) : [];
      if (!rows.some((r) => fin(r[k]))) continue;
      if (!src) { out.push({ kind: "wear", key: `wear:${k}`, name, missing: k === "hrv" ? "compared only when exactly one watch or ring is connected" : "no readings to compare" }); continue; }
      const mid = vals.length ? median(vals.map((r) => r[k])) : null;
      out.push({ kind: "wear", key: `wear:${k}`, name, src, minPaired: P.wearPaired, fn: (r) => (mid == null || r.wearSource !== src || !fin(r[k]) ? null : below(r[k], mid)), phrases: [`days your ${wearWord(src)} ${exp}`, `days ${other}`] });
    }
  }
  return out;
}

/* ---------- cards ---------- */
const ADVICE_SELF = "Worth testing on purpose for a week, and mentioning at your next visit.";
const ADVICE_MED = "Bring this to your clinician. It's your log, not proof a medicine works or doesn't, because lots changes from day to day. Don't change how you take anything without them.";
export const PATTERN_FOOT = "Cyra checks about a dozen things, so some differences will be chance. Treat these as hunches to test with your clinician, not answers.";
export const SYMPTOM_FOOT = "You're looking at one symptom, so treat any difference here as a hunch too.";
export const REPORT_FOOT = "Several factors were checked; some differences may be chance.";
/** A card's words: the side with the higher share of rough days always comes first.
    -> { num, text, parts } (parts: strings and { b } for the bold numbers). */
export function cardWords(res, phrases, outcomeLabel = null) {
  const e = [res.aE, res.nE, phrases[0]], u = [res.aU, res.nU, phrases[1]];
  const [a, b] = (res.pE ?? 0) >= (res.pU ?? 0) ? [e, u] : [u, e];
  const lead = outcomeLabel ? `${outcomeLabel} was moderate or strong on` : "Rough days came on";
  const parts = [`${lead} `, { b: `${a[0]} of ${a[1]}` }, ` ${a[2]}, and `, { b: `${b[0]} of ${b[1]}` }, ` ${b[2]}.`];
  return { num: `${a[0]} of ${a[1]}`, text: parts.map((x) => (typeof x === "string" ? x : x.b)).join(""), parts };
}
/** Factor results to cards and "What Cyra checked" lines (design 5.3): at most 3 cards, at most
    1 from a watch or ring, medicine factors after the others, findings also seen in the window
    before first, then by size of difference. */
function rank(factors, results, prevResults, outcomeLabel) {
  const items = factors.map((f, i) => ({ f, res: results[i], prev: prevResults ? prevResults[i] : null }));
  const shown = items.filter((x) => x.res && x.res.shown).map((x) => ({ ...x, repeated: !!(x.prev && x.prev.gates && x.prev.dir !== 0 && x.prev.dir === x.res.dir) }));
  shown.sort((a, b) => (a.f.kind === "med") - (b.f.kind === "med") || b.repeated - a.repeated || b.res.diff - a.res.diff);
  const cards = [], extra = [];
  let wearN = 0;
  for (const x of shown) {
    if (cards.length >= P.cards || (x.f.kind === "wear" && wearN >= P.wearCards)) { extra.push(x); continue; }
    if (x.f.kind === "wear") wearN++;
    const w = cardWords(x.res, x.f.phrases, outcomeLabel);
    cards.push({ key: x.f.key, kind: x.f.kind, name: x.f.name, num: w.num, text: w.text, parts: w.parts, repeated: x.repeated,
      urgency: x.f.kind === "med" ? "visit" : "self", advice: x.f.kind === "med" ? ADVICE_MED : ADVICE_SELF, src: x.f.src || null, res: x.res });
  }
  const checked = [];
  for (const x of items) {
    if (cards.some((c) => c.key === x.f.key)) continue;
    if (x.f.missing) { checked.push({ key: x.f.key, text: `${x.f.name}: ${x.f.missing}` }); continue; }
    const r = x.res;
    if (r.shown) checked.push({ key: x.f.key, text: `${x.f.name}: ${cardWords(r, x.f.phrases, outcomeLabel).text}` });
    else if (r.reason === "sides") checked.push({ key: x.f.key, text: `${x.f.name}: needs ${plural(r.need, "more day", "more days")} on each side` });
    else if (r.reason === "paired") checked.push({ key: x.f.key, text: `${x.f.name}: needs ${plural(P.wearPaired - r.nE - r.nU, "more day", "more days")} with a reading` });
    else checked.push({ key: x.f.key, text: `${x.f.name}: no clear difference yet (${plural(r.nE + r.nU, "day")})` });
  }
  return { cards, checked };
}

/* ---------- good days vs rough days (design 5.4) ---------- */
export const GVR_WAIT = "Rate about 2 weeks of days to compare good and rough days.";
const COMPRESSION = ["comp_waist", "comp_leg", "binder"];
/** Good (rated 1) and rough (3-4) days side by side; Okay days left out. Needs 4 of each; a
    row needs 3 values on each side, otherwise "—". Rows are ordered by size of difference.
    opts: units, cycle (show the cycle-group mix), connected (watch or ring sources), wear
    (include the on-screen-only watch and ring rows). */
export function goodVsRough(rows, p, { units = { fluid: "ml", salt: "mgNa" }, cycle = false, connected = [], wear = true } = {}) {
  const good = rows.filter((r) => r.rating === 1), rough = rows.filter((r) => r.rating >= 3);
  if (good.length < P.gvr || rough.length < P.gvr) return { wait: GVR_WAIT, nGood: good.length, nRough: rough.length };
  const out = [];
  const avg = (label, get, fmt, extra = {}) => {
    const g = good.map(get).filter(fin), r = rough.map(get).filter(fin);
    const ok = g.length >= P.gvrRow && r.length >= P.gvrRow;
    const gv = ok ? mean(g) : null, rv = ok ? mean(r) : null;
    out.push({ label, good: ok ? fmt(gv) : "—", rough: ok ? fmt(rv) : "—", size: ok ? Math.abs(gv - rv) / Math.max(Math.abs(gv), Math.abs(rv), 1) : -1, ...extra });
  };
  const share = (label, get) => {
    const g = good.map(get).filter((v) => v != null), r = rough.map(get).filter((v) => v != null);
    const ok = g.length >= P.gvrRow && r.length >= P.gvrRow;
    const gs = g.filter(Boolean).length, rs = r.filter(Boolean).length;
    out.push({ label, good: ok ? `${gs} of ${g.length}` : "—", rough: ok ? `${rs} of ${r.length}` : "—", size: ok ? Math.abs(gs / g.length - rs / r.length) : -1 });
  };
  // Today isn't over: its drinks and salt so far would pull a whole-day average down.
  avg("Average fluids (days logged)", (r) => (r.partial ? null : r.fluidMl), (v) => fmtFluid(v, units));
  avg("Average sodium (days logged)", (r) => (r.partial ? null : r.naMg), (v) => (units && units.salt === "gSalt" ? fmtSodium(v, units) : `${fmtSodium(v, units)} sodium`));
  share("A poor night before", (r) => r.sleepPoor);
  share("Exercised the day before", (r) => r.movedPrev);
  share("Heat tagged", (r) => r.heat);
  share("Every planned dose logged within 2 hours of its time", (r) => r.medsWithin2h);
  const comp = (p.meds || []).filter((m) => m.kind === "aid" && COMPRESSION.includes(m.lib)).map((m) => m.id);
  share("Compression worn", (r) => { const v = comp.map((id) => r.aids[id]).filter((x) => typeof x === "boolean"); return v.length ? v.some(Boolean) : null; });
  avg("Episodes per day", (r) => r.eps, (v) => n1(Math.round(v * 10) / 10));
  if (cycle) {
    const mix = (side) => { const k = side.filter((r) => r.cycleGroup); return { k, t: k.length, c: { period: k.filter((r) => r.cycleGroup === "period").length, weekBefore: k.filter((r) => r.cycleGroup === "weekBefore").length, other: k.filter((r) => r.cycleGroup === "other").length } }; };
    const g = mix(good), r = mix(rough), ok = g.t >= P.gvrRow && r.t >= P.gvrRow;
    const txt = (m) => `period ${m.c.period} · week before ${m.c.weekBefore} · other ${m.c.other}`;
    out.push({ label: "Cycle days (period · week before · other)", good: ok ? txt(g) : "—", rough: ok ? txt(r) : "—", size: ok ? Math.max(...["period", "weekBefore", "other"].map((k) => Math.abs(g.c[k] / g.t - r.c[k] / r.t))) : -1 });
  }
  const wearSrc = {};
  if (wear) {
    for (const [k, label, fmt] of [["rhr", "Average resting heart rate (watch or ring)", (v) => `${Math.round(v)} bpm`], ["hrv", "Average HRV (watch or ring)", (v) => `${Math.round(v)} ms`], ["sleep", "Average sleep score (watch or ring)", (v) => `${Math.round(v)}`]]) {
      if (!rows.some((r) => fin(r[k]))) continue;
      const src = wearSourceFor(rows, k, connected);
      if (!src) continue;
      wearSrc[src] = true;
      avg(label, (r) => (r.wearSource === src ? r[k] : null), fmt, { wear: src });
    }
  }
  out.sort((a, b) => b.size - a.size);
  return { nGood: good.length, nRough: rough.length, rows: out.map(({ size, ...x }) => x), wearSources: Object.keys(wearSrc) };
}

/* ---------- cycle groups (design 5.6) ---------- */
export const CYCLE_WAIT = "Needs about two cycles of rated days";
export const CYCLE_NOTE = "Some people with POTS notice symptoms shift with their cycle, often around the period; others don't. If this matches how you feel, it's worth mentioning.";
export const CYCLE_PERI = "POTS and perimenopause share symptoms like a racing heart, flushing and poor sleep. Seeing them side by side can help your clinician tell them apart.";
export const PREG_NOTE = "POTS can get better, worse or stay the same in pregnancy, and it often changes after birth (Kimpinski et al., 2010). Bring your stand tests to prenatal visits.";
const GROUP_WORD = { period: "Period days", weekBefore: "Week before your period", other: "Other days" };
/** Rough POTS days by cycle group over the 90-day window (rows), from logged starts only.
    Shown in My Cycle, Trying to Conceive and Perimenopause, with 2 starts in the last 120 days,
    2 groups with 4 rated days and 2 completed cycles contributing; never in Menopause or
    Pregnancy (-> null). -> { shown: true, k, groups, sentence, urgency, top } | { shown: false, wait, k, groups }. */
export function cycleGroups(rows, starts, { stage = null, stageName = null, today } = {}) {
  if (!isCycleStage(stage, stageName)) return null;
  const s = cleanStarts(starts).filter((x) => !today || x <= today);
  const from = today ? addDays(today, -(P.cycleWin - 1)) : null;
  const win = rows.filter((r) => r.rated && (!from || (r.date >= from && r.date <= today)));
  const dates = win.map((r) => r.date).sort();
  const idx = dates.length ? cycleIndex(s, dates[0], dates[dates.length - 1]) : new Map();
  const groups = {};
  for (const g of ["period", "weekBefore", "other"]) {
    const in_ = win.filter((r) => (idx.get(r.date) || {}).group === g);
    groups[g] = { n: in_.length, a: in_.filter((r) => r.rough).length, enough: in_.length >= P.cycleGroup };
  }
  let k = 0;
  for (let i = 0; i + 1 < s.length; i++) if (win.some((r) => r.date >= s[i] && r.date <= addDays(s[i + 1], -1))) k++;
  const recent = today ? s.filter((x) => x > addDays(today, -P.cycleStartDays)).length : s.length;
  const enough = Object.values(groups).filter((g) => g.enough);
  if (recent < P.cycleStarts || enough.length < 2 || k < P.cycleCycles) return { shown: false, wait: CYCLE_WAIT, k, groups };
  const part = (g) => `${GROUP_WORD[g]} ${groups[g].enough ? `${groups[g].a} of ${groups[g].n}` : "not enough days yet"}`;
  const shares = Object.entries(groups).filter(([, g]) => g.enough).map(([key, g]) => ({ key, v: g.a / g.n }));
  const max = Math.max(...shares.map((x) => x.v)), min = Math.min(...shares.map((x) => x.v));
  const tops = shares.filter((x) => x.v === max);
  const urgency = max - min >= P.cycleSpread - EPS ? "visit" : "self";
  return {
    shown: true, k, groups,
    sentence: `From ${k} cycles, rough POTS days came on: ${["period", "weekBefore", "other"].map(part).join(" · ")}.`,
    urgency,
    // The group with the most rough days, for the visit question ("My symptoms seem worse…"):
    // only when it is around the period AND leads by the card's own visit rule (25 points), so
    // a day or two more never becomes a claim in her voice in a clinician file.
    top: urgency === "visit" && tops.length === 1 && tops[0].key !== "other" ? tops[0].key : null,
  };
}

/* ---------- medicines (design 5.7) ---------- */
/** Rough-day share in the 14 days before `med.started` and the 14 days from it. `rows` must
    cover those days. -> { ready: true, before: { a, n }, after: { b, m } } | { ready: false, need, before, after }. */
export function medBeforeAfter(p, med, rows) {
  if (!isObj(med) || !isIso(med.started)) return { ready: false, need: P.medMin };
  const b0 = addDays(med.started, -P.medSide), b1 = addDays(med.started, -1), a1 = addDays(med.started, P.medSide - 1);
  const side = (f, t) => { const r = rows.filter((x) => x.rated && x.date >= f && x.date <= t); return { n: r.length, a: r.filter((x) => x.rough).length }; };
  const B = side(b0, b1), A = side(med.started, a1);
  const before = { a: B.a, n: B.n }, after = { b: A.a, m: A.n };
  if (B.n >= P.medMin && A.n >= P.medMin) return { ready: true, before, after };
  return { ready: false, need: Math.max(0, P.medMin - B.n, P.medMin - A.n), before, after };
}
export const MED_ADVICE = "Bring this to your next visit, and don't change anything without your clinician. Lots can change at once, so this isn't proof.";
export const medLine = (name, r) => `Before ${name}: rough days ${r.before.a} of ${r.before.n}. Since: ${r.after.b} of ${r.after.m}.`;
const BUCKETS = ["before the first dose", "0–2 h", "2–4 h", "4–6 h", "6 h or more"];
/** Episodes by time since a logged dose of `med` (descriptive only; design 5.7): over `rows`,
    on days with a dose logged taken. Needs 7 such days and 10 episodes on them; else null. */
export function episodesByDose(p, med, rows) {
  if (!isObj(med) || med.kind === "aid") return null;
  const counts = BUCKETS.map(() => 0);
  let dosed = 0, n = 0;
  for (const r of rows) {
    const x = (p.days || {})[r.date];
    if (!isObj(x)) continue;
    const times = (x.doses || []).filter((d) => d.medId === med.id && d.state === "taken").map((d) => toMin(d.t)).filter(fin).sort((a, b) => a - b);
    if (!times.length) continue;
    dosed++;
    for (const e of x.eps || []) {
      const t = toMin(e.t);
      if (!fin(t)) continue;
      const last = times.filter((v) => v <= t).pop();
      const i = last == null ? 0 : t - last < 120 ? 1 : t - last < 240 ? 2 : t - last < 360 ? 3 : 4;
      counts[i]++; n++;
    }
  }
  if (dosed < P.epsDosedDays || n < P.epsTimed) return null;
  return { name: med.name, days: dosed, n, buckets: BUCKETS.map((label, i) => ({ label, n: counts[i] })),
    text: `Episodes by time since a ${med.name} dose (${plural(n, "episode")} on ${plural(dosed, "day")} with a dose logged): ${BUCKETS.map((l, i) => `${l} ${counts[i]}`).join(" · ")}.` };
}

/* ---------- today and this week (design 5.5) ---------- */
export const PACE_WAIT = "Once you've logged about a week, Cyra can show your usual pace.";
/** "By 2:10 pm on most days you've had about 1.1 L": the median of earlier days' oral fluid up
    to the same time of day, over the last 30 days with drinks logged (needs 7). */
export function todayPace(p, iso, nowMin) {
  if (!isObj(p) || isLockedPots(p) || !isIso(iso) || !fin(nowMin)) return { wait: PACE_WAIT, n: 0 };
  const days = p.days || {};
  const earlier = [];
  for (let i = 1; i <= P.paceBack; i++) {
    const its = ((days[addDays(iso, -i)] || {}).intake || []).filter((it) => fin(it.ml));
    if (its.length) earlier.push(its.filter((it) => toMin(it.t) <= nowMin).reduce((a, it) => a + it.ml, 0));
  }
  if (earlier.length < P.pace) return { wait: PACE_WAIT, n: earlier.length };
  const its = ((days[iso] || {}).intake || []).filter((it) => fin(it.ml));
  return { usualByNow: median(earlier), today: its.length ? its.reduce((a, it) => a + it.ml, 0) : null, n: earlier.length };
}
const clock = (m) => { const h = Math.floor(m / 60), mm = m % 60; return `${((h + 11) % 12) + 1}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`; };
export const paceText = (pace, nowMin, units) => (pace.wait ? pace.wait
  : `By ${clock(nowMin)} on most days you've had about ${fmtFluid(pace.usualByNow, units)}; today ${pace.today == null ? "nothing logged yet" : fmtFluid(pace.today, units)}.`);
/** This week and the week before (design 5.5): one row per day, and rough days compared only
    when both weeks have 4 rated days. */
export function weekSummary(rows, prevRows) {
  const rated = (rs) => rs.filter((r) => r.rated);
  const t = rated(rows), q = rated(prevRows || []);
  const roughThis = t.filter((r) => r.rough).length, roughPrev = q.filter((r) => r.rough).length;
  const compare = t.length >= P.week && q.length >= P.week;
  return {
    days: rows.map((r) => ({ date: r.date, rating: r.rating, fluidMl: r.fluidMl, naMg: r.naMg, eps: r.eps, logged: r.logged, test: r.test })),
    ratedThis: t.length, ratedPrev: q.length, roughThis, roughPrev, compare,
    line: compare ? `Rough days: ${roughThis} this week, ${roughPrev} the week before.` : q.length < P.week ? "Not enough rated days last week to compare." : "Not enough rated days this week to compare.",
  };
}
export const WEEK_NOTE = "A week is too short to tell what helps. See 30 days for that.";
export const TODAY_NOTE = "One day is too little to compare.";
/** Today so far: totals against her goals, rating, symptoms, episodes, doses and any test. */
export function todaySummary(p, iso) {
  const x = ((p && p.days) || {})[iso] || {};
  const tests = (p.tests || []).filter((t) => t.date === iso && t.status !== "running");
  return {
    totals: dayTotals(p, iso), rating: [1, 2, 3, 4].includes(x.rating) ? x.rating : null,
    sym: Object.entries(isObj(x.sym) ? x.sym : {}).sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ id, label: symName(p, id), sev: v })),
    eps: (x.eps || []).length, faints: (x.eps || []).filter((e) => e.faint === "yes").length, nearFaints: (x.eps || []).filter((e) => e.faint === "almost").length,
    test: tests.length ? tests[tests.length - 1] : null,
  };
}

/* ---------- stand tests over time (design 5.8) ---------- */
export const TREND_NOTE = "Tests done at different times of day, cycle days or with different medicines aren't directly comparable.";
/** Complete tests of one method, oldest first, once there are 2 (the median from 3). */
export function testGroups(p, { teen = false } = {}) {
  const thr = teen ? THRESH.hrTeen : THRESH.hr;
  const done = testTrend(p).filter((x) => x.complete);
  return ["stand", "lean"].map((method) => {
    const rows = done.filter((x) => x.method === method);
    return rows.length >= 2 ? { method, rows, thr, median: rows.length >= 3 ? median(rows.map((r) => r.rise)) : null } : null;
  }).filter(Boolean);
}

/* ---------- everything for one window ---------- */
/** All patterns for a window (design 5.5). ctx: window ("today" | "7" | "30" | "90" | "all"),
    range ({ from, to }, overrides the window's), today, nowMin (minutes since midnight, for
    today's pace), stage, stageName, starts, checkin | days | pregLog, wearData and connected
    (watch and ring: on screen only; omit them for anything that leaves the device), outcome (a
    symptom id: "Days with {symptom} moderate or strong" instead of rough days), you (second
    person, default true), keep (factor -> boolean: only the factors a caller may show are
    compared, before ranking, so a factor left out is never replaced by a guess about it), meds
    (false: no "Medicines since starting"). A file's caller passes `range`: then a medicine's
    before and after days are only days inside that range, as its header states.
    -> { window, range, rated, rows, today, pace, week, cards, checked, footer, outcomes,
    outcome, goodVsRough, cycle, meds, tests }. */
export function patterns(p, ctx = {}) {
  if (!isObj(p) || isLockedPots(p)) return null;
  const today = isIso(ctx.today) ? ctx.today : localDay(new Date());
  const window = ["today", "7", "30", "90", "all"].includes(ctx.window) ? ctx.window : "30";
  const range = ctx.range && isIso(ctx.range.from) && isIso(ctx.range.to) ? ctx.range : windowRange(p, window, today);
  const { stage = null, stageName = null, starts = [], connected = [], you = true } = ctx;
  const wearData = Array.isArray(ctx.wearData) ? ctx.wearData : [];
  const base = { stage, starts, checkin: ctx.checkin, days: ctx.days, pregLog: ctx.pregLog, wearData, today };
  const keep = typeof ctx.keep === "function" ? ctx.keep : () => true;
  const clip = !!(ctx.range && isIso(ctx.range.from) && isIso(ctx.range.to));
  const rows = dayRows(p, { ...base, ...range });
  const out = { window, range, rated: rows.filter((r) => r.rated).length, rows, today: null, pace: null, week: null, cards: [], checked: [], footer: null, outcomes: [], outcome: null, goodVsRough: null, cycle: null, meds: [], tests: [] };
  if (window === "today") {
    out.today = todaySummary(p, range.to);
    out.pace = todayPace(p, range.to, ctx.nowMin);
    return out;
  }
  if (window === "7") {
    out.week = weekSummary(rows, dayRows(p, { ...base, from: addDays(range.from, -7), to: addDays(range.from, -1) }));
    return out;
  }
  // Per-symptom outcome (design 2.1): offered for symptoms logged on at least 10 days here.
  const symN = new Map();
  for (const r of rows) for (const id of Object.keys(r.symSev)) symN.set(id, (symN.get(id) || 0) + 1);
  out.outcomes = [...symN].filter(([, n]) => n >= P.symDays).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, label: symName(p, id), n }));
  const sym = out.outcomes.find((o) => o.id === ctx.outcome) || null;
  out.outcome = sym ? sym.id : null;
  // A day with no symptom entries is unknown, not "absent".
  const outcome = sym ? (r) => (r.symAny ? (r.symSev[sym.id] || 0) >= 2 : null) : null;
  const factors = factorList(p, rows, { stage, connected }, { you, wear: you && wearData.length > 0 }).filter(keep);
  const compute = (rs) => factors.map((f) => (f.missing ? null : compareFactor(rs, f, { outcome })));
  const results = compute(rows);
  // "Seen last month too": the 30 days before pass the gates in the same direction.
  let prev = null;
  if (window === "30") {
    const prevRows = dayRows(p, { ...base, from: addDays(range.from, -30), to: addDays(range.from, -1) });
    const pf = factorList(p, prevRows, { stage, connected }, { you, wear: you && wearData.length > 0 });
    prev = factors.map((f) => { const g = pf.find((x) => x.key === f.key); return g && !g.missing ? compareFactor(prevRows, g, { outcome }) : null; });
  }
  const ranked = rank(factors, results, prev, sym ? sym.label : null);
  out.cards = ranked.cards; out.checked = ranked.checked;
  out.footer = sym ? `${PATTERN_FOOT} ${SYMPTOM_FOOT}` : PATTERN_FOOT;
  out.goodVsRough = goodVsRough(rows, p, { units: p.settings.units, cycle: isCycleStage(stage, stageName), connected, wear: you && wearData.length > 0 });
  const rows90 = dayRows(p, { ...base, from: addDays(today, -(P.cycleWin - 1)), to: today });
  out.cycle = cycleGroups(rows90, starts, { stage, stageName, today });
  // Medicines since starting: those she started while already logging POTS days. In a file
  // (`clip`), only a start inside the range counts, and only the range's own days are compared.
  const first = firstDay(p, today);
  for (const m of ctx.meds === false ? [] : p.meds || []) {
    if (m.kind === "aid") continue;
    const start = isIso(m.started) && m.started > first && m.started <= today && (!clip || (m.started >= range.from && m.started <= range.to));
    const from0 = start ? addDays(m.started, -P.medSide) : null;
    const mrows = start ? dayRows(p, { ...base, from: clip && from0 < range.from ? range.from : from0, to: clip ? range.to : today }) : null;
    const ba = mrows ? medBeforeAfter(p, m, mrows) : null;
    const eps = episodesByDose(p, m, rows);
    if (ba || eps) out.meds.push({ id: m.id, name: m.name, beforeAfter: ba, eps });
  }
  out.tests = testGroups(p, { teen: p.settings.teen === true });
  return out;
}
