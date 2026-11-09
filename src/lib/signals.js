/* Auto-tracked signals (passive tracking S1, docs/PASSIVE-TRACKING-PLAN.md §1.6, §2.1, §2.2, §2.7): the pure library
   that turns the one-row-per-day wearable readings (`wearData`: { date, temp, rhr, hrv, sleep, sourceId }) into words
   and cycle markers. No React, no storage, no network, no Date.now: everything is a function of the rows, the day
   entries, the cycles and her choices, so the same input gives the same answer on the device and in `node --test`.
   It imports engine.js and fertility.js only and never record.js (record.js may import sources.js, never this file).

   Data-quality rules it implements (plan §1.6; every threshold is a named constant below and unit-tested):
   1. minimum nights before any ovulation wording (RISE.minNights valid nights in the cycle, RISE.before before a candidate);
   2. "Skip this night": a night in `nightSkips` is kept in wearData but left out of every baseline, rise test and word;
   3. one preferred source per metric (wearSources[id].prefer, lib/sources.js preferredSources), the others "also from";
   4. fever-like outliers (more than OUTLIER.above °C over the mean of the other nights) left out, with a note;
   5. a night belongs to the local day it ends on (the wake-up day; wakeDay() for rows that carry a timestamp);
   6. words against her own baseline by cycle phase (mean ± BASELINE.sdK standard deviations, BASELINE.minN nights a bucket).

   Wording rules (CLINICIAN-REVIEW "Auto-tracked"): guidance only — "a rise consistent with ovulation", never
   "confirmed", never contraception; words, never a score; "Not enough nights" whenever the sample is small.
   Temperatures are °C deviations from the source's own baseline (what the plugins return), so 0.2 means 0.2 °C above. */
import { addDays, daysBetween, isPeriodDay } from "./engine.js";
import { cleanFert } from "./fertility.js";

/* ---------- constants ---------- */
export const METRICS = Object.freeze(["temp", "rhr", "hrv", "sleep"]);
export const METRIC_LABELS = Object.freeze({ sleep: "Sleep", temp: "Temperature", hrv: "HRV", rhr: "Resting HR" });
/** The order the Home card shows the four rows in. */
export const CARD_ORDER = Object.freeze(["sleep", "temp", "hrv", "rhr"]);
/** "Skip this night" reasons: [id, label]. */
export const SKIP_REASONS = Object.freeze([["fever", "Fever or illness"], ["alcohol", "Alcohol"], ["travel", "Travel"], ["other", "Other"]]);
export const SKIP_IDS = Object.freeze(SKIP_REASONS.map(([id]) => id));
/** The three-over-six rule: `nights` consecutive nights at least `delta` °C above the mean of the `before` valid nights
    before them (those within `span` days); `minNights` valid nights in the cycle before any wording; an LH-positive
    test within `lhWindow` days of the rise makes the confidence "clear". */
export const RISE = Object.freeze({ delta: 0.2, nights: 3, before: 6, minNights: 10, span: 14, lhWindow: 2 });
/** A bucket (overall or one phase) speaks only with minN nights; "lower" / "higher" is more than sdK standard deviations away. */
export const BASELINE = Object.freeze({ minN: 7, sdK: 1 });
/** A night more than `above` °C over the mean of the other nights is fever-like and left out. */
export const OUTLIER = Object.freeze({ above: 1.0 });
/** The textbook phases used when no rise was seen: menstrual = cycle days 1–menstrualDays; a finished cycle's last
    lutealDays are luteal; with a rise, ovulatory = rise day − ovBefore … rise day + ovAfter. */
export const PHASE = Object.freeze({ menstrualDays: 5, lutealDays: 14, ovBefore: 2, ovAfter: 1 });
export const PHASES = Object.freeze(["menstrual", "follicular", "ovulatory", "luteal"]);
export const PHASE_WORDS = Object.freeze({ menstrual: "period", follicular: "follicular", ovulatory: "ovulatory", luteal: "luteal" });
/** A source counts as "synced recently" for this many hours (the Home card and the "Confirm today" reminder). */
export const RECENT_HOURS = 36;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sd = (xs) => { if (xs.length < 2) return null; const m = mean(xs); return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1)); };
const r2 = (x) => Math.round(x * 100) / 100;
const pad = (n) => String(n).padStart(2, "0");

/* ---------- 5. night assignment by wake day ---------- */
/** The local day a night belongs to, from the timestamp its reading ENDED at: the wall-clock date of that moment
    (a reading that ends in the evening, 20:00 or later, is the next morning's night). A timestamp with its own
    offset ("2026-10-08T07:30:00+14:00") is read as that wall clock; a UTC one ("…Z") is moved by `tzOffsetMin`
    (the device's offset, minutes east of UTC; 0 when not given). A plain day ("2026-10-08") is returned as it is.
    Unreadable input gives null. */
export function wakeDay(at, tzOffsetMin = 0) {
  if (typeof at !== "string") return null;
  const s = at.trim();
  if (ISO.test(s)) { const [y, mo, d] = s.split("-").map(Number); const t = new Date(y, mo - 1, d, 12); return t.getFullYear() === y && t.getMonth() === mo - 1 && t.getDate() === d ? s : null; }
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?(Z|[+-]\d{2}:?\d{2})?$/.exec(s);
  if (!m) return null;
  let y = +m[1], mo = +m[2], d = +m[3], h = +m[4], mi = +m[5];
  const zone = m[7];
  if (!zone || zone === "Z") { // UTC (or no zone: treated as UTC): shift to the device's wall clock
    const off = Number.isFinite(tzOffsetMin) ? tzOffsetMin : 0;
    const t = Date.UTC(y, mo - 1, d, h, mi) + off * 60000;
    const u = new Date(t);
    y = u.getUTCFullYear(); mo = u.getUTCMonth() + 1; d = u.getUTCDate(); h = u.getUTCHours();
  }
  const day = `${y}-${pad(mo)}-${pad(d)}`;
  if (!ISO.test(day) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return h >= 20 ? addDays(day, 1) : day;
}

/* ---------- 2, 3: one value per night, the preferred source first, skips left out ---------- */
/** One reading per night for `metric` from the rows (any order; a row may carry `at` instead of `date`): the preferred
    source's reading when it has one that night, else the first source's (sorted by id, so stable); the other sources'
    readings as `also`. skips: nightSkips { [day]: reason } → `skipped` (the night is listed but never valid).
    Returns [{ day, value, sourceId, also: [{ sourceId, value }], skipped: reason | null, outlier: false, valid }],
    oldest first. prefer: { [metric]: sourceId } (lib/sources.js preferredSources). */
export function nightlyValues(rows, metric, { prefer = {}, skips = {}, tzOffsetMin = 0 } = {}) {
  const want = isObj(prefer) ? prefer[metric] : null;
  const byDay = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!isObj(r)) continue;
    const day = ISO.test(String(r.date || "")) ? r.date : wakeDay(r.at, tzOffsetMin);
    const v = num(r[metric]);
    if (!day || v == null) continue;
    const src = typeof r.sourceId === "string" ? r.sourceId : "unknown";
    const list = byDay.get(day) || [];
    list.push({ sourceId: src, value: v });
    byDay.set(day, list);
  }
  const out = [];
  for (const day of [...byDay.keys()].sort()) {
    const list = byDay.get(day).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
    const pick = (want && list.find((x) => x.sourceId === want)) || list[0];
    const skipped = isObj(skips) && typeof skips[day] === "string" ? skips[day] : null;
    out.push({ day, value: pick.value, sourceId: pick.sourceId, also: list.filter((x) => x !== pick), skipped, outlier: false, valid: !skipped });
  }
  return out;
}

/* ---------- 4: fever-like outliers ---------- */
/** Marks temperature nights more than OUTLIER.above °C over the mean of the other non-skipped nights as outliers (left
    out of every rule, with a note on the card). A new list; valid = not skipped and not an outlier. */
export function excludeOutliers(nights, { above = OUTLIER.above } = {}) {
  const vals = (nights || []).filter((n) => !n.skipped).map((n) => n.value);
  const sum = vals.reduce((a, b) => a + b, 0);
  return (nights || []).map((n) => {
    // against the mean of the OTHER non-skipped nights, so one hot night can't lift the bar it is measured against
    const others = vals.length >= 2 ? (sum - n.value) / (vals.length - 1) : null;
    const outlier = !n.skipped && others != null && n.value > others + above;
    return { ...n, outlier, valid: !n.skipped && !outlier };
  });
}
/** nightlyValues for temperature with the outlier rule applied (what every temperature rule reads). */
export const nightlyTemps = (rows, opts = {}) => excludeOutliers(nightlyValues(rows, "temp", opts), opts);
/** Only the nights a rule may read. */
export const validNights = (nights) => (nights || []).filter((n) => n.valid);
/** The note shown under a temperature row the rules left out, or null. */
export const nightNote = (n) => (!n ? null : n.skipped ? `Skipped: ${(SKIP_REASONS.find(([id]) => id === n.skipped) || [null, "other"])[1].toLowerCase()}` : n.outlier ? "Left out: much higher than your other nights" : null);

/* ---------- cycles ---------- */
/** The cycle day of `day` in a cycle that starts on `start` (1 on the start day). */
export const cycleDayOf = (start, day) => daysBetween(start, day) + 1;
/** The cycle `day` falls in: { start, next|null, length|null } from a cycles list (record.js cyclesFrom shape, or
    engine cycleSummary rows with start/next/len), or null before the first start. */
export function cycleOf(cycles, day) {
  let hit = null;
  for (const c of Array.isArray(cycles) ? cycles : []) {
    if (!isObj(c) || typeof c.start !== "string" || c.start > day) continue;
    if (!hit || c.start > hit.start) hit = c;
  }
  if (!hit) return null;
  const next = typeof hit.next === "string" ? hit.next : null;
  return next && day >= next ? null : { start: hit.start, next, length: next ? daysBetween(hit.start, next) : num(hit.length ?? hit.len) };
}
const normCycle = (c) => ({ start: c.start, next: typeof c.next === "string" ? c.next : null, length: typeof c.next === "string" ? daysBetween(c.start, c.next) : num(c.length ?? c.len) });

/* ---------- 1: ovulation from temperature (the three-over-six rule) ---------- */
/** LH-positive days from the day entries (fertility signs opk "pos"). */
export const lhPositiveDays = (days) => (Array.isArray(days) ? days : []).filter((d) => isObj(d) && ISO.test(String(d.date)) && cleanFert(d).opk === "pos").map((d) => d.date);

/**
 * The rise read for one cycle: { status: "rise-seen" | "no-rise-seen" | "not-enough-nights", day (cycle day of the
 * first rise night) | null, date | null, confidence: "clear" | "possible" | null, lutealDays | null, nights (valid
 * nights in the cycle), cover (the mean the rise cleared) | null }.
 * cycle: { start, next | null }; temps: nightlyTemps(); opk: LH-positive days (lhPositiveDays).
 * Rule: RISE.nights consecutive calendar nights, all valid, each at least RISE.delta over the mean of the RISE.before
 * valid nights right before the first of them (all within RISE.span days of it). "not-enough-nights" with fewer than
 * RISE.minNights valid nights in the cycle, or when no candidate ever had RISE.before valid nights before it.
 */
export function ovulationFor(cycle, temps, { opk = [], rules = RISE } = {}) {
  const R = { ...RISE, ...rules };
  if (!isObj(cycle) || typeof cycle.start !== "string") return { status: "not-enough-nights", day: null, date: null, confidence: null, lutealDays: null, nights: 0, cover: null };
  const c = normCycle(cycle);
  const inCycle = (temps || []).filter((n) => n.day >= c.start && (!c.next || n.day < c.next));
  const valid = inCycle.filter((n) => n.valid);
  const base = { day: null, date: null, confidence: null, lutealDays: null, nights: valid.length, cover: null };
  if (valid.length < R.minNights) return { status: "not-enough-nights", ...base };
  let anyCandidate = false;
  for (let i = R.before; i + R.nights - 1 < valid.length; i++) {
    const first = valid[i];
    const prev = valid.slice(i - R.before, i).filter((n) => daysBetween(n.day, first.day) <= R.span);
    if (prev.length < R.before) continue;
    anyCandidate = true;
    const run = valid.slice(i, i + R.nights);
    let consecutive = true;
    for (let k = 1; k < run.length; k++) if (daysBetween(run[k - 1].day, run[k].day) !== 1) { consecutive = false; break; }
    if (!consecutive) continue;
    const cover = mean(prev.map((n) => n.value));
    if (!run.every((n) => n.value >= cover + R.delta - 1e-9)) continue;
    const day = cycleDayOf(c.start, first.day);
    const clear = (opk || []).some((d) => typeof d === "string" && Math.abs(daysBetween(d, first.day)) <= R.lhWindow);
    return { status: "rise-seen", day, date: first.day, confidence: clear ? "clear" : "possible", lutealDays: c.next ? daysBetween(first.day, c.next) : null, nights: valid.length, cover: r2(cover) };
  }
  return { status: anyCandidate ? "no-rise-seen" : "not-enough-nights", ...base };
}
/** ovulationFor for every cycle: { [start]: result }. */
export function cycleOvulations(cycles, temps, opts = {}) {
  const out = {};
  for (const c of Array.isArray(cycles) ? cycles : []) if (isObj(c) && typeof c.start === "string") out[c.start] = ovulationFor(c, temps, opts);
  return out;
}
/** The marker words for a cycle (Body → Cycles, the review): guidance only. */
export function riseWords(ov) {
  if (!ov || ov.status === "not-enough-nights") return "Not enough nights";
  if (ov.status === "no-rise-seen") return "No sustained rise seen this cycle";
  return `Temperature rise seen · day ${ov.day}`;
}
/** The one-line explanation under a marker. */
export function riseDetail(ov) {
  if (!ov) return null;
  if (ov.status === "rise-seen") return `${ov.confidence === "clear" ? "A positive ovulation test fell within 2 days of it: a" : "A"} rise consistent with ovulation, from your own nightly temperatures: three nights in a row at least 0.2 °C above the six before. An observation, not a confirmation.`;
  if (ov.status === "no-rise-seen") return `${ov.nights} nights read, none held 0.2 °C above the six before for three nights in a row.`;
  return `Nights read: ${ov.nights}. The rise test needs ${RISE.minNights} valid nights in a cycle, with ${RISE.before} before any candidate.`;
}

/* ---------- phases ---------- */
/** The phase `day` falls in: from the cycle (cycles list) and the rise seen in it (ov = ovulationFor result), or
    null outside any cycle. With a rise: menstrual (cycle days 1–5), follicular, ovulatory (rise − 2 … rise + 1), luteal
    after that. Without one: menstrual, then follicular; a finished cycle's last PHASE.lutealDays days are luteal. */
export function phaseOf(day, cycles, ovulations = {}) {
  const c = cycleOf(cycles, day);
  if (!c) return null;
  const cd = cycleDayOf(c.start, day);
  if (cd <= PHASE.menstrualDays) return "menstrual";
  const ov = ovulations && ovulations[c.start];
  if (ov && ov.status === "rise-seen" && ov.day != null) {
    if (cd < ov.day - PHASE.ovBefore) return "follicular";
    if (cd <= ov.day + PHASE.ovAfter) return "ovulatory";
    return "luteal";
  }
  if (c.length != null && cd > c.length - PHASE.lutealDays) return "luteal";
  return "follicular";
}

/* ---------- 6: baselines and words ---------- */
const stats = (vals) => ({ mean: vals.length ? r2(mean(vals)) : null, sd: vals.length >= 2 ? r2(sd(vals)) : null, n: vals.length });
/**
 * Her own baseline per metric: { [metric]: { overall: { mean, sd, n }, byPhase: { menstrual, follicular, ovulatory,
 * luteal: { mean, sd, n } } } } over the valid nights (skips out; fever-like temperatures out). nightly: { temp, rhr,
 * hrv, sleep } from nightlyTemps / nightlyValues (buildNightly). ovulations: cycleOvulations().
 */
export function baselines(nightly, cycles, ovulations = {}) {
  const out = {};
  for (const m of METRICS) {
    const list = validNights(nightly && nightly[m]);
    const byPhase = Object.fromEntries(PHASES.map((p) => [p, []]));
    for (const n of list) { const p = phaseOf(n.day, cycles, ovulations); if (p) byPhase[p].push(n.value); }
    out[m] = { overall: stats(list.map((n) => n.value)), byPhase: Object.fromEntries(PHASES.map((p) => [p, stats(byPhase[p])])) };
  }
  return out;
}
/** "usual" | "lower" | "higher" for a value against a bucket, or null when the bucket has fewer than BASELINE.minN
    nights. Within mean ± sdK·sd is usual (a bucket with sd 0 counts any difference). */
export function wordFor(value, bucket, { minN = BASELINE.minN, sdK = BASELINE.sdK } = {}) {
  const v = num(value);
  if (v == null || !isObj(bucket) || bucket.n < minN || bucket.mean == null) return null;
  const s = bucket.sd == null ? 0 : bucket.sd;
  if (v > bucket.mean + sdK * s + 1e-9) return "higher";
  if (v < bucket.mean - sdK * s - 1e-9) return "lower";
  return "usual";
}
/** Every metric's nightly list in one object (temperature with the outlier rule). */
export function buildNightly(rows, opts = {}) {
  return { temp: nightlyTemps(rows, opts), rhr: nightlyValues(rows, "rhr", opts), hrv: nightlyValues(rows, "hrv", opts), sleep: nightlyValues(rows, "sleep", opts) };
}
const WORD_PHRASE = { usual: "at your usual", lower: "lower than usual", higher: "higher than usual" };
export const FEW_NIGHTS = "a few more nights will show your usual";
/**
 * Words for one day's readings, never numbers: [{ metric, label, word, phrase, phase, also, note, present }] in
 * CARD_ORDER. The phase bucket speaks when it has BASELINE.minN nights, else the overall one; when the phase bucket
 * says "usual" but the overall one says lower or higher, the phrase is "lower, usual for your luteal days".
 */
export function readinessWords(day, nightly, base, cycles, ovulations = {}) {
  const phase = phaseOf(day, cycles, ovulations);
  return CARD_ORDER.map((m) => {
    const n = (nightly && nightly[m] || []).find((x) => x.day === day) || null;
    const b = base && base[m];
    const also = n ? n.also.map((a) => a.sourceId) : [];
    if (!n) return { metric: m, label: METRIC_LABELS[m], word: null, phrase: "no reading", phase, also, note: null, present: false };
    const note = m === "temp" ? nightNote(n) : (n.skipped ? nightNote(n) : null);
    if (!n.valid) return { metric: m, label: METRIC_LABELS[m], word: null, phrase: "left out", phase, also, note, present: true };
    const pb = phase && b ? b.byPhase[phase] : null;
    const pw = wordFor(n.value, pb), ow = wordFor(n.value, b && b.overall);
    let word = pw ?? ow, phrase;
    if (pw == null && ow == null) phrase = FEW_NIGHTS;
    else if (pw === "usual" && ow && ow !== "usual") phrase = `${ow}, usual for your ${PHASE_WORDS[phase]} days`;
    else phrase = WORD_PHRASE[word];
    return { metric: m, label: METRIC_LABELS[m], word, phrase, phase, also, note, present: true };
  });
}

/* ---------- the cycle table (the clinician PDF, plan §2.7) ---------- */
/** Bleeding days in a cycle: period days (engine isPeriodDay) from the start up to the next start. */
export const bleedingDays = (days, cycle) => { const c = normCycle(cycle); return (Array.isArray(days) ? days : []).filter((d) => isObj(d) && typeof d.date === "string" && d.date >= c.start && (!c.next || d.date < c.next) && isPeriodDay(d)).length; };
/** Rows for the table, newest first, at most `max` (12), finished cycles and the running one:
    [{ start, length | null, running, bleeding, rise: ovulationFor(), riseText, luteal | null }]. riseText: "seen, day 14" /
    "seen, day 14 (LH)" / "no sustained rise" / "not enough nights". */
export function cycleTable(cycles, temps, days, { opk = [], max = 12 } = {}) {
  const list = (Array.isArray(cycles) ? cycles : []).filter((c) => isObj(c) && typeof c.start === "string").map(normCycle).sort((a, b) => b.start.localeCompare(a.start)).slice(0, max);
  return list.map((c) => {
    const rise = ovulationFor(c, temps, { opk });
    const riseText = rise.status === "rise-seen" ? `seen, day ${rise.day}${rise.confidence === "clear" ? " (LH)" : ""}` : rise.status === "no-rise-seen" ? "no sustained rise" : "not enough nights";
    return { start: c.start, length: c.length, running: !c.next, bleeding: bleedingDays(days, c), rise, riseText, luteal: rise.lutealDays };
  });
}
/** How many nights were skipped, with the reasons: { n, byReason: { fever: 2, … }, text }. */
export function skippedSummary(skips) {
  const byReason = {};
  let n = 0;
  for (const v of Object.values(isObj(skips) ? skips : {})) { if (!SKIP_IDS.includes(v)) continue; n++; byReason[v] = (byReason[v] || 0) + 1; }
  const parts = SKIP_REASONS.filter(([id]) => byReason[id]).map(([id, label]) => `${label.toLowerCase()} ${byReason[id]}`);
  return { n, byReason, text: n ? `Nights she marked as not usable: ${n} (${parts.join(", ")}).` : "No nights marked as not usable." };
}

/* ---------- the weekly review sentence (plan §7) ---------- */
/** HRV in the `n` nights before a rise: { n (nights with a reading), lower (nights "lower" against the overall baseline) }. */
export function hrvBeforeRise(ov, nightly, base, { n = 5 } = {}) {
  if (!ov || ov.status !== "rise-seen" || !ov.date) return { n: 0, lower: 0 };
  const from = addDays(ov.date, -n), to = addDays(ov.date, -1);
  let k = 0, lower = 0;
  for (const x of validNights(nightly && nightly.hrv)) {
    if (x.day < from || x.day > to) continue;
    k++;
    if (wordFor(x.value, base && base.hrv && base.hrv.overall) === "lower") lower++;
  }
  return { n: k, lower };
}
/** "Temperature rose on day 32; HRV was lower in the 5 days before." — the first clause when a rise was seen, the
    second only when at least 3 of the 5 nights before it read lower than her usual. null without a rise. */
export function reviewSentence(ov, hrvBefore = { n: 0, lower: 0 }, { minLower = 3, n = 5 } = {}) {
  if (!ov || ov.status !== "rise-seen") return null;
  const head = `Temperature rose on day ${ov.day}`;
  return hrvBefore && hrvBefore.lower >= minLower ? `${head}; HRV was lower in the ${n} days before.` : `${head}.`;
}

/* ---------- which night the Home card is about ---------- */
/** The most recent night with any valid reading on or before `todayIso` from a non-demo source, or null. */
export function latestNight(nightly, todayIso) {
  let best = null;
  for (const m of METRICS) for (const n of (nightly && nightly[m]) || []) if (n.day <= todayIso && (!best || n.day > best)) best = n.day;
  return best;
}

/* ---------- copy safety ---------- */
/** Every fixed sentence this library can show, for the wording tests (FERT_BANNED and contraOk over all of them). */
export const SIGNAL_COPY = Object.freeze({
  riseSeen: riseWords({ status: "rise-seen", day: 14 }),
  noRise: riseWords({ status: "no-rise-seen" }),
  notEnough: riseWords({ status: "not-enough-nights" }),
  riseDetail: riseDetail({ status: "rise-seen", day: 14, confidence: "possible" }),
  riseDetailClear: riseDetail({ status: "rise-seen", day: 14, confidence: "clear" }),
  noRiseDetail: riseDetail({ status: "no-rise-seen", nights: 20 }),
  notEnoughDetail: riseDetail({ status: "not-enough-nights", nights: 4 }),
  fewNights: FEW_NIGHTS,
  outlier: nightNote({ outlier: true }),
  ttc: "Solia Health is not a contraceptive.",
  guidance: "From your own nightly temperatures, read on this device. Guidance for a conversation with your clinician, not a diagnosis.",
});
