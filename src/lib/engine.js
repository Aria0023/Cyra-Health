import { SYM, PSYM, QUICK_MAP, PRENATAL } from "./constants.js";

/* Deterministic demo data, cycle detection, prediction and scoring. Pure
   functions only — no React, no state, no side effects.
   engine.js is the lowest layer of the pure modules: lib/record.js and lib/pots.js may import it; it never imports them. */

/** This device's local calendar day, YYYY-MM-DD: the key for every day record (check-ins,
    pregnancy log, journal, intimacy and medication logs) and for "today". Never the UTC date,
    or an evening entry in the Americas (or a morning one in Asia) lands on the next/previous
    day. Keys stay plain YYYY-MM-DD strings, so records saved by earlier versions read as before. */
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Quick check-in answers (q1..q3) moved onto the hero symptoms they ask about. The symptoms a
    quick answer set are listed under __q (with the value it gave), so the weekly counts can
    leave them out: a combined question ("cramps or bloating") never yields a symptom flag. */
export function foldQuick(draft, stage) {
  const map = QUICK_MAP[stage] || QUICK_MAP.peri;
  const out = { ...draft }, q = { ...(draft.__q || {}) };
  for (const [k, sid] of Object.entries(map)) { if (out[k] != null) { out[sid] = out[k]; q[sid] = out[k]; } delete out[k]; }
  if (Object.keys(q).length) out.__q = q;
  return out;
}

export function seed() {
  let s = 42;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296), s / 4294967296);
  const days = []; let prevPoor = false, since = 12, len = 27, pl = 0;
  for (let i = 75; i >= 1; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if (since >= len) { pl = 4; since = 0; len = 23 + Math.floor(rnd() * 15); }
    const period = pl > 0; if (pl > 0) pl--; since++;
    const poor = rnd() < 0.32;
    const sleepQ = poor ? "poor" : rnd() < 0.4 ? "fair" : "good";
    const sev = (b) => { const r = rnd(), p = prevPoor ? b + 0.26 : b; return r < p * 0.45 ? 3 : r < p ? 2 : r < p + 0.2 ? 1 : 0; };
    days.push({ date: localDay(d), sleepQ, period, sym: { hf: sev(0.42), ns: prevPoor ? sev(0.4) : sev(0.22), fog: sev(prevPoor ? 0.5 : 0.3), mood: sev(0.3), slp: sleepQ === "poor" ? 2 + (rnd() < 0.4 ? 1 : 0) : sleepQ === "fair" ? (rnd() < 0.5 ? 1 : 0) : 0, ach: sev(0.24), crm: period ? sev(0.8) : sev(0.1), hda: sev(0.25), blo: sev(0.3), eng: sev(0.3) } });
    prevPoor = poor;
  }
  return days;
}
export const loadOf = (day, ids) => Math.min(1, ids.reduce((a, k) => a + (day.sym[k] || 0), 0) / (ids.length * 2));
export function stripeColor(v, hot, calm, mid) {
  const lerp = (a, b, u) => a.map((c, i) => Math.round(c + (b[i] - c) * u));
  const c = v < 0.5 ? lerp(calm || [187, 203, 191], mid || [221, 138, 78], v * 2) : lerp(mid || [221, 138, 78], hot, (v - 0.5) * 2);
  return `rgb(${c})`;
}
/* Pregnancy trimester for a week number: weeks 0-12 first, 13-27 second, 28+ third (Home greeting and week bar). */
export const trimesterOf = (w) => (w < 13 ? "first" : w < 28 ? "second" : "third");
/* Milestones "Next visit" sentence (UI M1), derived from PRENATAL so it is never stale: the first item whose window
   holds this week, the next item that opens later (inside the 42 pregnancy weeks — the postpartum items have no
   opening week), or what is left past 42. Pure; MilestonesScreen renders it under the hint. */
export function roadmapAdvice(pregWeek) {
  if (pregWeek > 42) return "You're past 42 weeks — the postpartum visits are what's left.";
  const flat = PRENATAL.flatMap((g) => g.items);
  const open = flat.filter((m) => pregWeek >= m.from && pregWeek <= m.to);
  const next = flat.find((m) => m.from > pregWeek && m.from <= 42);
  if (open.length) return `You're at week ${pregWeek}: ${open[0].label} is in its window now${next ? `, and ${next.label} opens at week ${next.from}` : ""} — ask about it at your next visit.`;
  if (next) return `You're at week ${pregWeek}: nothing is due this week; ${next.label} opens at week ${next.from}.`;
  return "You're past 42 weeks — the postpartum visits are what's left.";
}
export const fmt = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
/* A past day relative to today, for status lines ("last backup today"): today / yesterday / "N days ago" within a
   week, else fmt(iso). A day in the future or an unreadable value falls back to fmt(iso) rather than guessing. */
export const relDay = (iso, todayIso) => {
  const n = Math.round((new Date(todayIso + "T12:00:00") - new Date(iso + "T12:00:00")) / 86400000);
  if (!Number.isFinite(n) || n < 0) return fmt(iso);
  return n === 0 ? "today" : n === 1 ? "yesterday" : n < 7 ? `${n} days ago` : fmt(iso);
};
export const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/* ISO date n days before `today`, the same way the app keys its days (App.jsx isoDaysAgo). */
const isoBefore = (today, n) => { const d = typeof today === "string" ? new Date(today + "T12:00:00") : new Date(today); d.setDate(d.getDate() - n); return localDay(d); };
/* A period day for cycle maths: spotting alone (flow "spot") never starts or extends a period,
   including days an earlier version saved as period days. */
export const isPeriodDay = (d) => !!d && !!d.period && d.flow !== "spot";
/* A cycle length counts (lens, averages, variability) only within these bounds, in days (spec §6.2). */
export const CYCLE_MIN = 15, CYCLE_MAX = 120;
/* Whole days from one local day to another (YYYY-MM-DD), compared at noon so a daylight-saving change can't
   shift the count. */
export const daysBetween = (aIso, bIso) => Math.round((new Date(bIso + "T12:00:00") - new Date(aIso + "T12:00:00")) / 86400000);
/* The local day n days after iso (n may be negative), as YYYY-MM-DD. */
export const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return localDay(d); };
/* Median of a list of numbers (a sorted copy; an even count gives the mean of the two middle values); [] → null. */
export const median = (nums) => {
  if (!Array.isArray(nums) || !nums.length) return null;
  const s = [...nums].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/* Median absolute deviation: how far a typical value sits from the median (robust to one odd value). */
export const mad = (nums) => { const m = median(nums); return m == null ? null : median(nums.map((x) => Math.abs(x - m))); };
/* Engine owns cycle detection: record.js cyclesFrom() builds on cycleStarts and cycleSpans. */
export const cycleStarts = (sorted) => {
  const pset = new Set(sorted.filter(isPeriodDay).map((d) => d.date));
  const starts = [];
  pset.forEach((iso) => {
    let st = true;
    for (let k = 1; k <= 5; k++) { const p = new Date(iso + "T12:00:00"); p.setDate(p.getDate() - k); if (pset.has(localDay(p))) st = false; }
    if (st) starts.push(iso);
  });
  return starts.sort();
};
/* One span per pair of consecutive starts, oldest first: { start, next, len, counted } (counted = CYCLE_MIN ≤ len ≤ CYCLE_MAX). */
export const cycleSpans = (starts) => {
  const out = [];
  for (let i = 1; i < starts.length; i++) {
    const len = daysBetween(starts[i - 1], starts[i]);
    out.push({ start: starts[i - 1], next: starts[i], len, counted: len >= CYCLE_MIN && len <= CYCLE_MAX });
  }
  return out;
};
export const cycleLens = (starts) => cycleSpans(starts).filter((s) => s.counted).map((s) => s.len);
const hfRatio = (pairs) => {
  const ap = [], ao = [];
  for (const [prev, day] of pairs) (prev.sleepQ === "poor" ? ap : ao).push(day);
  const rate = (arr, id) => (arr.length ? arr.filter((d) => d.sym[id] >= 2).length / arr.length : 0);
  return rate(ao, "hf") > 0 ? rate(ap, "hf") / rate(ao, "hf") : null;
};

/* Counts cover the last 30 CALENDAR days (today and the 29 before), so "N of the last 30
   days" means exactly that; last30 holds the days actually logged in that window. The
   *30 values (hfMult30, lens30, variability30) use only that same window — what the
   doctor email summarizes. hfMult, lens and variability use everything logged. These are the clinical
   markers: they keep every cycle and never read cycleFlags (her "Don't use" choices change predictions only).
   cycles is every span between logged starts (cycleSpans), for predict() and cycleSummary(). */
export function insights(days, ids, today = new Date()) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const from = isoBefore(today, 29);
  const last30 = sorted.filter((d) => d.date >= from);
  const lib = { ...SYM, ...PSYM };
  const counts = ids.map((id) => ({ id, label: lib[id], days: last30.filter((d) => d.sym[id] > 0).length, strong: last30.filter((d) => d.sym[id] >= 2).length })).sort((a, b) => b.days - a.days);
  const roughNights = last30.filter((d) => d.sleepQ === "poor").length;
  const pairs = sorted.slice(1).map((d, i) => [sorted[i], d]);
  const hfMult = hfRatio(pairs);
  const hfMult30 = hfRatio(pairs.filter(([prev]) => prev.date >= from));
  const starts = cycleStarts(sorted);
  const lens = cycleLens(starts);
  const variability = lens.length >= 2 ? Math.max(...lens) - Math.min(...lens) : null;
  const lens30 = cycleLens(starts.filter((d) => d >= from));
  const variability30 = lens30.length >= 2 ? Math.max(...lens30) - Math.min(...lens30) : null;
  return { sorted, last30, counts, roughNights, hfMult, hfMult30, lens: lens.slice(-6), variability, lens30, variability30, starts, cycles: cycleSpans(starts) };
}

/* Registration answers that can seed a prediction before two cycles are logged. */
export const TOLD_CYCLE_LEN = { "Under 24 days": 23, "24–31 days": 28, "Over 31 days": 34 };
const UNSURE_CYCLE = ["Irregular", "Not sure"];

/* ---------- her cycle flags (L5, spec §3.5): "Don't use for predictions", keyed by cycle start ----------
   cycleFlags = { [cycleStartIso]: { exclude: true } }. Only her tap writes one (toggleExclude); Cyra may point out a
   cycle that looks unusual (unusualCycles) but never leaves one out by itself. Predictions read the flags; the
   clinical markers (insights(): lens, variability, lens30, variability30) never do. */
const ISO_KEY = /^\d{4}-\d{2}-\d{2}$/;
const plainObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
/* A flag within this many days of a cycle's start applies to it: a back-filled or un-marked first period day can move
   a start a little. Starts are at least 6 days apart, so it is never ambiguous. */
const FLAG_NEAR = 2;
export const CYCLE_FLAGS_MAX = 400;
/** A clean cycleFlags map (a new object): non-object, array or null → {}. Keeps entries whose key is YYYY-MM-DD and
    whose value is a plain object; exclude becomes a boolean and any other field a later version adds is kept as it
    is; an entry left with exclude false and nothing else is dropped. At most CYCLE_FLAGS_MAX entries, the newest
    keys; the input's key order is kept, so a clean map comes back byte-identical in JSON. */
export function cleanCycleFlags(v) {
  if (!plainObj(v)) return {};
  const entries = [];
  for (const k of Object.keys(v)) {
    if (!ISO_KEY.test(k) || !plainObj(v[k])) continue;
    const e = { ...v[k], exclude: !!v[k].exclude };
    if (!e.exclude && Object.keys(e).length === 1) continue;
    entries.push([k, e]);
  }
  const keep = new Set(entries.map(([k]) => k).sort().reverse().slice(0, CYCLE_FLAGS_MAX));
  const out = {};
  for (const [k, e] of entries) if (keep.has(k)) out[k] = e;
  return out;
}
/** The flag key that applies to the cycle starting `start`: the exact key, else the nearest key within 2 days, else null. */
export function flagKey(start, flags) {
  if (!plainObj(flags) || typeof start !== "string") return null;
  if (Object.prototype.hasOwnProperty.call(flags, start) && plainObj(flags[start])) return start;
  let best = null, bestD = Infinity;
  for (const k of Object.keys(flags).sort()) {
    if (!ISO_KEY.test(k) || !plainObj(flags[k])) continue;
    const d = Math.abs(daysBetween(start, k));
    if (d <= FLAG_NEAR && d < bestD) { best = k; bestD = d; }
  }
  return best;
}
/** True only when she chose "Don't use" for the cycle starting `start`. */
export const isExcluded = (start, flags) => { const k = flagKey(start, flags); return k != null && flags[k].exclude === true; };
/** Her tap on "Don't use": a NEW flags object (the input is never changed). Every key within 2 days of `start` goes,
    carrying over any other fields of the key that applied; exclude true sets [start]: { ...carried, exclude: true }.
    A key with no start near it (an edit moved that start) stays: harmless, capped by cleanCycleFlags, and it applies
    again if that start comes back. */
export function toggleExclude(flags, start, exclude) {
  const src = plainObj(flags) ? flags : {};
  const applied = flagKey(start, src);
  const carried = {};
  if (applied != null) for (const [k, v] of Object.entries(src[applied])) if (k !== "exclude") carried[k] = v;
  const out = {};
  for (const k of Object.keys(src)) if (!(ISO_KEY.test(k) && Math.abs(daysBetween(start, k)) <= FLAG_NEAR)) out[k] = src[k];
  if (exclude) out[start] = { ...carried, exclude: true };
  else if (Object.keys(carried).length) out[start] = { ...carried, exclude: false };
  return out;
}

/** A suggestion only: for each length, 'long' | 'short' when it sits strictly outside median ± max(7, 2.5 × MAD) of
    the same list (the candidate is part of the reference), else null. Fewer than 3 lengths: all null. Nothing in the
    app changes cycleFlags from this; only her tap (toggleExclude) does. */
export function unusualCycles(lens) {
  if (!Array.isArray(lens) || lens.length < 3) return (Array.isArray(lens) ? lens : []).map(() => null);
  const m = median(lens), band = Math.max(7, 2.5 * mad(lens));
  return lens.map((x) => (x > m + band ? "long" : x < m - band ? "short" : null));
}

/* Half-widths of the likely-start range, in days. min/max clamp it once two kept cycles exist; few is the half-width
   while the centre comes from her sign-up answer, a single cycle or the 28-day default. */
export const RANGE = Object.freeze({ cycle: Object.freeze({ min: 2, max: 10, few: 4 }), peri: Object.freeze({ min: 4, max: 20, few: 6 }) });

const isoOf = (today) => (typeof today === "string" ? today : localDay(today instanceof Date ? today : new Date()));
const noon = (iso) => new Date(iso + "T12:00:00");
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/* The one place that decides whether there is a prediction (spec §6.2): { pred } or { why }, never both, so predict()
   and whyNoPrediction() always agree. Pregnancy gives { why: null } (neither). */
function plan(ins, prior, { flags = {}, stage = null, isMeno = false, today = localDay() } = {}) {
  // (1) No period prediction in pregnancy or after menopause.
  if (stage === "preg") return { why: null };
  if (isMeno) return { why: { kind: "meno" } };
  const todayIso = isoOf(today);
  const starts = (ins && ins.starts) || [];
  const told = prior ? TOLD_CYCLE_LEN[prior.cycleLen] : undefined;
  const unsure = !!prior && UNSURE_CYCLE.includes(prior.cycleLen);
  // (2) The last start: logged, or her sign-up answer while nothing is logged.
  let lastIso = starts.length ? starts[starts.length - 1] : null, seeded = false;
  if (!lastIso) {
    const lp = prior ? prior.lastPeriod : null;
    if (told && typeof lp === "string" && ISO_KEY.test(lp) && lp <= todayIso) { lastIso = lp; seeded = true; }
    else return { why: { kind: unsure ? "unsure" : "none" } };
  }
  // (3) Longer than Cyra predicts across.
  const d = daysBetween(lastIso, todayIso);
  if (d > CYCLE_MAX) return { why: { kind: "long", days: d } };
  // (4) The cycles she keeps: the last up-to-6 kept ones (a left-out one is replaced by the next older one).
  const counted = ((ins && ins.cycles) || cycleSpans(starts)).filter((s) => s.counted);
  const keptAll = counted.filter((s) => !isExcluded(s.start, flags));
  const kept = keptAll.slice(-6);
  if (counted.length && !keptAll.length && !told) return { why: { kind: "excluded" } };
  if (unsure && kept.length < 2) return { why: { kind: counted.length >= 2 ? "excluded" : "unsure" } };
  // (5) Centre and half-width.
  const R = stage === "peri" ? RANGE.peri : RANGE.cycle;
  const lens = kept.map((s) => s.len);
  let center, half, basis;
  if (kept.length >= 2) {
    center = Math.round(median(lens));
    half = clamp(Math.max(center - Math.min(...lens), Math.max(...lens) - center), R.min, R.max);
    basis = "logged";
  } else if (told) { center = told; half = R.few; basis = "told"; }
  else if (kept.length === 1) { center = lens[0]; half = R.few; basis = "logged"; }
  else { center = 28; half = R.few; basis = "default"; }
  // (6) The likely-start range, as days since the last start, and where today sits in it.
  const fromDay = Math.max(CYCLE_MIN, center - half), toDay = Math.min(CYCLE_MAX, center + half);
  const state = d < fromDay ? "upcoming" : d <= toDay ? "window" : "later";
  // (7) Fertile window, anchored on the centre; it widens by up to 3 days each side as the range widens.
  const ovuIso = addDays(lastIso, center - 14);
  const e = Math.min(3, Math.max(0, half - 2));
  const fertileFromIso = addDays(ovuIso, -3 - e), fertileToIso = addDays(ovuIso, 1 + e);
  // (8) Phase, on local days.
  const cycleDay = d + 1;
  const phase = cycleDay <= 5 ? "menstrual" : todayIso >= fertileFromIso && todayIso <= fertileToIso ? "fertile" : todayIso < fertileFromIso ? "follicular" : "luteal";
  const usedSpans = basis === "logged" ? kept : [];
  const usedStarts = usedSpans.map((s) => s.start);
  const excludedSpans = counted.filter((s) => isExcluded(s.start, flags));
  const left = usedStarts.length ? excludedSpans.filter((s) => s.start >= usedStarts[0]).length : excludedSpans.length;
  const nextIso = addDays(lastIso, center), fromIso = addDays(lastIso, fromDay), toIso = addDays(lastIso, toDay);
  return {
    pred: {
      cycleDay, center, avgLen: center, half, lastStart: lastIso, nextIso, nextStart: noon(nextIso),
      fromIso, toIso, rangeFrom: noon(fromIso), rangeTo: noon(toIso), state,
      daysTo: center - d, late: d - center, pastRange: d - toDay,
      ovuIso, ovu: noon(ovuIso), fertileFromIso, fertileToIso, fertileFrom: noon(fertileFromIso), fertileTo: noon(fertileToIso),
      fertileDay: daysBetween(lastIso, fertileFromIso) + 1, phase, seeded, basis,
      used: usedSpans.length, usedLens: usedSpans.map((s) => s.len), usedStarts,
      oneLogged: basis === "told" && keptAll.length === 1 ? keptAll[0].len : null,
      left, wide: stage === "peri",
    },
  };
}

/** Next period (a likely-start range), fertile window and phase, or null (whyNoPrediction says why). `prior` is the
    registration record (regAnswers): with no logged period yet, its lastPeriod is the first start; until two kept
    cycles exist, its cycleLen sets the centre (Under 24 → 23, 24–31 → 28, Over 31 → 34; Irregular / Not sure → no
    prediction until two cycles are kept). Options: flags (cycleFlags), stage, isMeno, today (YYYY-MM-DD or a Date).
    avgLen is the centre (the median of her last up-to-6 kept cycles, not a mean); late is days past the centre. */
export function predict(ins, prior = null, opts = {}) {
  return plan(ins, prior, opts).pred || null;
}
/** null when predict() gives a prediction (and in pregnancy); otherwise { kind: 'meno' | 'unsure' | 'excluded' |
    'long' | 'none', days? }. Built from the same plan() as predict(). */
export function whyNoPrediction(ins, prior = null, opts = {}) {
  return plan(ins, prior, opts).why || null;
}
/** Kept for compatibility (App no longer imports it): the irregular / not-sure wait. */
export const predictionWaits = (ins, prior, flags = {}) => whyNoPrediction(ins, prior, { flags })?.kind === "unsure";

/* ---------- wording (Home, Today, Calendar, Patterns, Report) ---------- */
/** 'Oct 26 – Nov 1': spaced en dash, both dates in full. */
export const fmtRange = (aIso, bIso) => `${fmt(aIso)} – ${fmt(bIso)}`;
/** The headline for a prediction: 'Period likely Oct 26 – Nov 1' | 'Period likely any day now, by Nov 1' | 'Period later than your usual range'. */
export const periodHead = (p) => (p.state === "later" ? "Period later than your usual range" : p.state === "window" ? `Period likely any day now, by ${fmt(p.toIso)}` : `Period likely ${fmtRange(p.fromIso, p.toIso)}`);
/** What a prediction rests on: 'Based on your last 5 cycles · 1 left out', 'Based on your sign-up answer', … */
export const basisLine = (p) => {
  const head = p.basis === "told" ? "Based on your sign-up answer" : p.basis === "default" ? "Based on a typical 28-day cycle" : p.used === 1 ? "Based on your last cycle" : `Based on your last ${p.used} cycles`;
  return p.left ? `${head} · ${p.left} left out` : head;
};
/** A cycle length in the clinical lists: '61 (left out of predictions)' for one she left out. */
export const lensLabel = ({ len, excluded }) => (excluded ? `${len} (left out of predictions)` : `${len}`);

/** "Your cycles" (Calendar) and the clinical lists: { rows, current, lens6, excludedCount, pending, more }.
    rows: the last 12 spans, newest first, each { start, next, len, counted, excluded, unusual, usual, used };
    unusual is checked against the counted lengths among those 12; usual is [min, max] of the ones not unusual.
    lens6: the last 6 counted spans as { start, len, excluded } (the same lengths and order as ins.lens).
    pending: unusual rows the current prediction still uses. */
export function cycleSummary(ins, flags, todayIso, usedStarts = []) {
  const starts = (ins && ins.starts) || [];
  const spans = (ins && ins.cycles) || cycleSpans(starts);
  const shown = spans.slice(-12);
  const ref = shown.filter((s) => s.counted).map((s) => s.len);
  const marks = unusualCycles(ref);
  const plain = ref.filter((_, i) => !marks[i]);
  const usual = plain.length ? [Math.min(...plain), Math.max(...plain)] : null;
  let j = 0;
  const oldestFirst = shown.map((s) => {
    const unusual = s.counted ? marks[j++] || null : null;
    return { start: s.start, next: s.next, len: s.len, counted: s.counted, excluded: s.counted && isExcluded(s.start, flags), unusual, usual, used: usedStarts.includes(s.start) };
  });
  const rows = oldestFirst.reverse();
  const last = starts.length ? starts[starts.length - 1] : null;
  const counted = spans.filter((s) => s.counted);
  return {
    rows,
    current: last ? { start: last, day: daysBetween(last, todayIso) + 1 } : null,
    lens6: counted.slice(-6).map((s) => ({ start: s.start, len: s.len, excluded: isExcluded(s.start, flags) })),
    excludedCount: counted.filter((s) => isExcluded(s.start, flags)).length,
    pending: rows.filter((r) => r.unusual && r.used).length,
    more: spans.length > 12,
  };
}
/* Calendar no longer uses this (its cells compare ISO days); kept for compatibility. */
export const inRange = (d, a, b) => d >= new Date(a.toDateString()) && d <= new Date(b.toDateString());

/* ---------- day score: 0 (rough) .. 1 (great) ---------- */
export const symBurden = (symObj, ids) => {
  const vals = ids.map((k) => symObj[k] || 0);
  return vals.length ? Math.min(1, vals.reduce((a, b) => a + b, 0) / (ids.length * 1.6)) : 0;
};
export const scoreLabel = (s) => s > 0.82 ? "A really good day" : s > 0.64 ? "A good day" : s > 0.46 ? "A mixed day" : s > 0.28 ? "A hard day" : "A rough day";
export const dayScore = (entry, ids) => {
  if (!entry) return null;
  const sc = entry.scales || {};
  return 1 - Math.min(1, symBurden(entry.sym || {}, ids) * 0.5 + ((sc.fatigue || 0) / 10) * 0.2 + ((sc.pain || 0) / 10) * 0.2 + ((10 - (sc.moodq ?? 5)) / 10) * 0.1);
};
export const sevDots = (n) => "●".repeat(n) + "○".repeat(3 - n);
/* ---------- day-score colour (data viz; the ramp comes from lib/constants.js rampOf(stage, scheme)) ----------
   rough → mid for s ≤ 0.5, mid → good above, each channel rounded. */
export const scoreRgb = (s, ramp) => {
  const lerp = (a, b, u) => a.map((c, i) => Math.round(c + (b[i] - c) * u));
  const { good, mid, rough } = ramp;
  return s > 0.5 ? lerp(mid, good, (s - 0.5) * 2) : lerp(rough, mid, s * 2);
};
export const scoreColorOf = (s, ramp) => `rgb(${scoreRgb(s, ramp)})`;
/* Ink for text drawn on a score fill (calendar digits, the day card's score pill): black above a relative
   luminance of 0.179, white below it — the crossover where both inks measure 4.5:1 against the fill. */
export const inkOn = ([r, g, b]) => {
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.179 ? "#000000" : "#FFFFFF";
};
