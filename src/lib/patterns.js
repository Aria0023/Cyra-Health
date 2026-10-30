/* Patterns tab (calm R6, spec §3.5d): the pure models behind the cycle timeline, the Body and Mind rings, the pattern
   cards and the day bands. No React, no state, no storage, no network: App and PatternsScreen call these on render and
   nothing here is saved or sent.
   Tone rules (plan §7): words, never a score or a number out of 100; associations ("lined up with"), never causes,
   verdicts or grades; "Not enough information" whenever the sample is small, with the threshold named here
   (PATTERN_RULES) and tested (patterns.test.mjs). */
import { addDays, isPeriodDay, median } from "./engine.js";
import { MODULES, MODULE_FRAMING, longCycleCount } from "./modules.js";
import { bodyDay, moveTotals, cleanBodyLog } from "./bodylog.js";

/* The empty-state line (plan §7) and the not-medical-advice line shown near every list of insights. */
export const EMPTY_LINE = "A few more logs will show clearer associations.";
export const NOT_ADVICE = MODULE_FRAMING;

/* ---------- thresholds ---------- */
/** When a comparison between two kinds of day says something.
    minEach: days needed on EACH side; minHits: days with the outcome in all (both sides) — below either the card says
    "Not enough information". minRatio / minDiff: how much more often on the first side for "Supported pattern" (the
    same bar as the L8 sleep links, engine SLEEP_LINK). leanRatio / leanDiff: a smaller gap in the same direction is
    "Still showing up". level: the severity that counts as having the outcome (2 = moderate or strong). days: the
    window the cards read ("In your recent data"). */
export const PATTERN_RULES = Object.freeze({ minEach: 5, minHits: 4, minRatio: 1.3, minDiff: 0.2, leanRatio: 1.15, leanDiff: 0.1, level: 2, days: 60 });

/** a, b: { n, hits } — the side expected to have more of the outcome first. Returns "supported" | "still" |
    "notenough" | "none" (no association in that direction; never shown as a card). */
export function statusOf(a, b, rules = PATTERN_RULES) {
  const r = { ...PATTERN_RULES, ...rules };
  if (!a || !b || a.n < r.minEach || b.n < r.minEach || a.hits + b.hits < r.minHits) return "notenough";
  const ra = a.hits / a.n, rb = b.hits / b.n, d = ra - rb;
  const ratio = rb > 0 ? ra / rb : null;
  if (d >= r.minDiff - 1e-9 && (ratio == null || ratio >= r.minRatio - 1e-9)) return "supported";
  if (d >= r.leanDiff - 1e-9 && (ratio == null || ratio >= r.leanRatio - 1e-9)) return "still";
  return "none";
}

const lc1 = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const isPlural = (label) => /[^s]s$/i.test(label || "");
const fmtRatio = (r) => (r >= 10 ? String(Math.round(r)) : r.toFixed(1));
const dayW = (k) => (k === 1 ? "day" : "days");
const STATUS_ORDER = { supported: 1, still: 2, notenough: 3, seen: 4 };
const RECENT = `In your recent data: the last ${PATTERN_RULES.days} days`;

/** The difference figure for two sides: "2.3×" (with "as often …") or, with a zero base, "a of n". */
function diffOf(a, b, label) {
  if (!a.n || !b.n) return { diff: null, diffLabel: label };
  const ra = a.hits / a.n, rb = b.hits / b.n;
  if (rb > 0 && ra >= rb) return { diff: `${fmtRatio(ra / rb)}×`, diffLabel: label };
  if (rb > 0) return { diff: `${fmtRatio(rb / Math.max(ra, 1e-9))}×`, diffLabel: label };
  return { diff: `${a.hits} of ${a.n}`, diffLabel: `${label}, none on the others` };
}
const bar = (label, side, what) => ({ label, days: side.n, value: side.n ? side.hits / side.n : 0, shown: `${what} on ${side.hits}` });

/* ---------- day bands (the Patterns chart: lighter / usual / heavier days, never a 0–100 axis) ---------- */
/** Half-width of "your usual" around the median of her logged days (day-reading units, 0–1). */
export const BAND = Object.freeze({ gap: 0.08, minDays: 5 });
/** Her usual day: the median reading of the logged days (null under BAND.minDays). days: [{ score|null }]. */
export function usualOf(days) {
  const xs = (days || []).map((d) => d && d.score).filter((s) => s != null);
  return xs.length >= BAND.minDays ? median(xs) : null;
}
/** "lighter" | "usual" | "heavier" for one reading against her usual (null when either is missing). */
export function bandOf(score, usual) {
  if (score == null || usual == null) return null;
  return score >= usual + BAND.gap - 1e-9 ? "lighter" : score <= usual - BAND.gap + 1e-9 ? "heavier" : "usual";
}
export const BAND_WORDS = Object.freeze({ lighter: "A lighter day for you", usual: "A usual day for you", heavier: "A heavier day for you" });
/** Counts of lighter / usual / heavier days in a list. */
export function bandCounts(days, usual) {
  const out = { lighter: 0, usual: 0, heavier: 0 };
  for (const d of days || []) { const b = bandOf(d && d.score, usual); if (b) out[b]++; }
  return out;
}
/** "3 lighter, 2 usual and 1 heavier day" (only the bands with days; "no logged days" when empty). */
export function bandWords(c) {
  const parts = [["lighter", c.lighter], ["usual", c.usual], ["heavier", c.heavier]].filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`);
  const total = c.lighter + c.usual + c.heavier;
  if (!parts.length) return "no logged days";
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${list} ${dayW(total === 1 ? 1 : 2)}`;
}
/** The 60-day chart's headline in words: the last 7 days against the first 7 of the window (needs 3 logged in each).
    { kind: "lighter" | "heavier" | "same" | null, sentence }. */
export function bandTrend(days, usual) {
  const n = (days || []).length;
  const first = days.slice(0, 7).filter((d) => d.score != null), last = days.slice(Math.max(0, n - 7)).filter((d) => d.score != null);
  if (usual == null || first.length < 3 || last.length < 3) return { kind: null, sentence: EMPTY_LINE };
  const share = (xs, k) => xs.filter((d) => bandOf(d.score, usual) === k).length / xs.length;
  const d = (share(last, "lighter") - share(last, "heavier")) - (share(first, "lighter") - share(first, "heavier"));
  if (Math.abs(d) < 0.25) return { kind: "same", sentence: "Your last week looks much like the start of these eight weeks." };
  return d > 0
    ? { kind: "lighter", sentence: "Your last week had more lighter days than the start of these eight weeks." }
    : { kind: "heavier", sentence: "Your last week had more heavier days than the start of these eight weeks." };
}

/* ---------- rings: this week against her usual, in words ---------- */
/** Words for a ring reading. value places the arc (decorative); it is never shown as a number. */
export const RING_WORDS = Object.freeze({
  body: Object.freeze({ usual: "At your usual", up: "Lighter than usual", down: "Heavier than usual", none: "A few more logs" }),
  mind: Object.freeze({ usual: "At your usual", up: "Higher than usual", down: "Lower than usual", none: "A few more logs" }),
});
const RING_VALUE = { usual: 0.5, up: 0.78, down: 0.28, none: 0.06 };
/** The window a ring compares: this week (the last 7 days) against days 8–28 before today. minCur / minPrev: logged
    days needed in each; bodyGap (day reading 0–1) and mindGap (the 1–5 mood face) the smallest change named. */
export const RING_RULES = Object.freeze({ cur: 7, prevFrom: 28, prevTo: 8, minCur: 3, minPrev: 5, bodyGap: 0.05, mindGap: 0.4 });
function ringOf(cur, prev, gap, words) {
  if (cur.length < RING_RULES.minCur || prev.length < RING_RULES.minPrev) return { key: "none", word: words.none, value: RING_VALUE.none, cur: cur.length, prev: prev.length };
  const m = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const d = m(cur) - m(prev);
  const key = Math.abs(d) < gap ? "usual" : d > 0 ? "up" : "down";
  return { key, word: words[key], value: RING_VALUE[key], cur: cur.length, prev: prev.length };
}
/** Body: day readings (higher = lighter) from windowDays-shaped days, oldest → newest, ending today. */
export function bodyRing(days) {
  const n = (days || []).length;
  const pick = (from, to) => days.slice(Math.max(0, n - from), n - to).map((d) => d.score).filter((s) => s != null);
  return ringOf(pick(RING_RULES.cur, 0), pick(RING_RULES.prevFrom, RING_RULES.prevTo - 1), RING_RULES.bodyGap, RING_WORDS.body);
}
/** Mind: the mood face (1–5) from moodLog { iso: { mood } }. */
export function mindRing(moodLog, todayIso) {
  const log = moodLog && typeof moodLog === "object" ? moodLog : {};
  const pick = (from, to) => { const out = []; for (let i = to; i < from; i++) { const v = log[addDays(todayIso, -i)]?.mood; if (Number.isFinite(v)) out.push(v); } return out; };
  return ringOf(pick(RING_RULES.cur, 0), pick(RING_RULES.prevFrom, RING_RULES.prevTo - 1), RING_RULES.mindGap, RING_WORDS.mind);
}
/** "What's driving this": the inputs each ring reads, as plain lines. */
export function ringInputs({ body, mind, cycle = null }) {
  const cnt = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const out = [
    `Body: ${cnt(body.cur, "check-in", "check-ins")} in the last 7 days against ${body.prev} in the three weeks before. It reads the symptoms you logged and how strong they were, and the energy, pain and mood sliders.`,
    `Mind: ${cnt(mind.cur, "mood check-in", "mood check-ins")} in the last 7 days against ${mind.prev} in the three weeks before. It reads the mood face on the Mind tab.`,
  ];
  if (cycle) out.push(`Cycle: ${cycle}`);
  out.push(`A ring needs ${RING_RULES.minCur} logged days this week and ${RING_RULES.minPrev} in the three weeks before. It shows where this week sits against your own usual, in words, never a score.`);
  return out;
}

/* ---------- cycle timeline ---------- */
export const TIMELINE = Object.freeze({ max: 6, scaleMin: 35, scaleMax: 60, periodMax: 10, fertileMin: 21, fertileMax: 35 });
const periodRun = (byDate, start, max) => { let k = 0; while (k < max && isPeriodDay(byDate.get(addDays(start, k)))) k++; return k; };
/** The last cycles as rows for the timeline (newest first). rows: engine cycleSummary(...).rows (newest first);
    current: cycleSummary(...).current; sorted: the check-in entries; expected: the running cycle's likely length
    (predict avgLen) or null; pcosOn: the PCOS module is on (cycles over its longDays get a calm label).
    Returns { rows: [{ start, len, current, period, fertile: [from, to] | null, labels: [], long }], scale, sentence }
    or null before one cycle has ended and none is running. Every cycle is shown, including ones left out of
    predictions (D5: outliers change predictions only); the fertile window is a textbook estimate (len − 16 … len − 12)
    drawn only on 21–35-day cycles, never on a long or unusual one. */
export function cycleTimeline({ rows = [], current = null, sorted = [], expected = null, pcosOn = false, todayIso, max = TIMELINE.max }) {
  const byDate = new Map((sorted || []).map((e) => [e.date, e]));
  const longDays = MODULES.pcos.cycle.longDays;
  const done = (rows || []).slice(0, current ? max - 1 : max).map((r) => {
    const labels = [];
    if (r.excluded) labels.push("Left out of predictions");
    if (r.unusual === "long") labels.push("Longer than your usual");
    if (r.unusual === "short") labels.push("Shorter than your usual");
    if (!r.counted) labels.push(r.len > 120 ? "A long gap" : "Very short");
    else if (pcosOn && r.len > longDays && !labels.includes("Longer than your usual")) labels.push(`Over ${longDays} days`);
    const fert = r.counted && !r.unusual && r.len >= TIMELINE.fertileMin && r.len <= TIMELINE.fertileMax ? [r.len - 16, r.len - 12] : null;
    return { start: r.start, len: r.len, current: false, period: periodRun(byDate, r.start, TIMELINE.periodMax), fertile: fert, labels, long: r.len > longDays };
  });
  let cur = null;
  if (current && current.start && current.day >= 1) {
    const exp = Number.isFinite(expected) ? Math.round(expected) : null;
    const labels = [];
    if (pcosOn && current.day > longDays) labels.push(`Over ${longDays} days so far`);
    cur = { start: current.start, len: current.day, current: true, expected: exp, period: periodRun(byDate, current.start, Math.min(TIMELINE.periodMax, current.day)), fertile: null, labels, long: current.day > longDays };
  }
  const all = cur ? [cur, ...done] : done;
  if (!done.length && !cur) return null;
  const scale = Math.min(TIMELINE.scaleMax, Math.max(TIMELINE.scaleMin, ...all.map((r) => Math.max(r.len, r.expected || 0))));
  const lens = done.filter((r) => r.labels.indexOf("A long gap") < 0 && r.labels.indexOf("Very short") < 0).map((r) => r.len);
  let sentence = done.length ? "" : "Your first cycle is still running. The timeline fills in as each one ends.";
  if (lens.length === 1) sentence = `Your last cycle ran ${lens[0]} days.`;
  else if (lens.length > 1) {
    const lo = Math.min(...lens), hi = Math.max(...lens);
    sentence = lo === hi ? `Your last ${lens.length} cycles each ran ${lo} days.` : `Your last ${lens.length} cycles ran ${lo} to ${hi} days.`;
  }
  const nLong = longCycleCount(lens, longDays);
  if (pcosOn && nLong) sentence += ` ${nLong === 1 ? "One" : nLong} ran over ${longDays} days. ${MODULES.pcos.cycle.expected.text}`;
  return { rows: all, scale, sentence: sentence.trim(), todayIso };
}

/* ---------- pattern cards ---------- */
/** A card: { key, topic (eyebrow), status ("supported" | "still" | "notenough" | "seen": no chip), sentence, bars
    ({ a, b } for TwoBar) | null, diff, diffLabel, family, recent, detail: { question, lines: [], advice?, askId? },
    strength, kind }. */
function card(o) { return { bars: null, diff: null, diffLabel: "", family: "body", recent: RECENT, strength: 0, ...o }; }

/** Sleep-link cards from patternFindings(...).links (every candidate Cyra checked, qualified or not). */
export function sleepCards(links = []) {
  const out = [];
  for (const x of links) {
    if (x.kind !== "sleep") continue;
    const l = x.l, L = x.label, lc = lc1(L);
    const st = statusOf(l.rough, l.good);
    if (st === "none") continue;
    const sentence = st === "supported" ? `Rough nights lined up with more ${lc} in your log.`
      : st === "still" ? `Rough nights and ${lc} are still showing up together in your log, without a clear gap yet.`
      : EMPTY_LINE;
    const d = diffOf(l.rough, l.good, "as often after a rough night");
    out.push(card({
      key: `sleep:${x.id}`, kind: "sleep", topic: `Sleep and ${lc}`, status: st, sentence, family: x.fam || "sleep",
      bars: l.rough.n && l.good.n ? { a: bar("After a rough night", l.rough, L), b: bar("After a good night", l.good, L) } : null,
      ...(st === "notenough" ? { diff: null } : d),
      strength: l.strength || 0,
      detail: {
        question: `Do rough nights line up with more ${lc} the next day?`,
        lines: [
          `${L} moderate or strong on ${l.rough.hits} of ${l.rough.n} ${dayW(l.rough.n)} after a rough night, and ${l.good.hits} of ${l.good.n} after a night you slept well.`,
          `Heard Health names a pattern with at least ${PATTERN_RULES.minEach} days on each side and ${PATTERN_RULES.minHits} days with ${lc} in all.`,
        ],
        advice: x.advice || null, askId: x.askId || null,
      },
    }));
  }
  return out;
}
/** Cycle-day cards from patternFindings(...).links (insights cycleDayCluster results). */
export function cycleCards(links = []) {
  const out = [];
  for (const x of links) {
    if (x.kind !== "cycle") continue;
    const k = x.k, L = x.label, lc = lc1(L);
    const st = k.ok ? "supported" : k.why === "few" ? "notenough"
      : k.why === "no-cluster" && k.rate - k.restRate >= PATTERN_RULES.leanDiff - 1e-9 ? "still" : "none";
    if (st === "none") continue;
    const days = k.from ? `cycle days ${k.from}–${k.to}` : "";
    const sentence = st === "supported" ? `${L} ${isPlural(L) ? "gather" : "gathers"} around ${days} in your log.`
      : st === "still" ? `${L} may be gathering around ${days}. It is still showing up there, without a clear gap yet.`
      : EMPTY_LINE;
    const a = k.from ? { n: k.loggedIn, hits: k.inWin } : null, b = k.from ? { n: k.restLogged, hits: k.restHits } : null;
    out.push(card({
      key: `cycle:${x.id}`, kind: "cycle", topic: `${L} by cycle day`, status: st, sentence, family: x.fam || "body",
      bars: a && b ? { a: bar(`Cycle days ${k.from}–${k.to}`, a, L), b: bar("Your other cycle days", b, L) } : null,
      ...(a && b && st !== "notenough" ? diffOf(a, b, "as often on those days") : {}),
      strength: k.strength || 0,
      detail: {
        question: `${isPlural(L) ? "Do" : "Does"} ${lc} tend to come on the same cycle days?`,
        lines: [
          a ? `${L} on ${k.inWin} of the ${k.loggedIn} days you logged on ${days}, and ${k.restHits} of ${k.restLogged} on your other cycle days, across ${k.cycles} of your last ${k.nCycles} cycles.`
            : `${L} logged on ${k.total} ${dayW(k.total)} in your last ${k.nCycles} cycles so far.`,
          "Cycle days count from each logged period start, across your last 4 cycles.",
        ],
        advice: x.advice || null, askId: x.askId || null,
      },
    }));
  }
  return out;
}

/* PCOS pattern questions (lib/modules.js MODULES.pcos.patternQuestions). Which way "more" points for each: the
   exposure side is expected to have MORE of the outcome, except movement and mood, where days with movement are
   compared for FEWER mood swings. */
const LESS = new Set(["pcos-move-mood"]);
/** One question over the window [from, to]. entries: check-in entries; bodyLog: lib/bodylog.js. Returns
    { exp: { n, hits }, other: { n, hits } } — days whose exposure is known and whose outcome day has a check-in that
    carries the outcome symptom. Sleep hours describe the night that ended that morning, so a short night is compared
    with that same day; the other exposures use the question's lag (1 = the next day). */
export function questionSides(q, { entries = [], bodyLog = {}, from, to, level = PATTERN_RULES.level }) {
  const byDate = new Map((entries || []).map((e) => [e.date, e]));
  const exp = { n: 0, hits: 0 }, other = { n: 0, hits: 0 };
  const ids = q.outcome.kind === "symptoms" ? q.outcome.ids : [q.outcome.id];
  for (let iso = from; iso <= to; iso = addDays(iso, 1)) {
    const day = bodyDay(bodyLog, iso);
    let exposed = null, outIso = addDays(iso, q.lag || 0);
    const known = Object.keys(day).length > 0 || byDate.has(iso);
    if (q.exposure.kind === "sleepUnder") { if (day.sleepH != null) exposed = day.sleepH < q.exposure.hours; outIso = iso; }
    else if (q.exposure.kind === "marker") { if (known) exposed = (day.pcos || []).includes(q.exposure.id); }
    else if (q.exposure.kind === "movedAtLeast") { if (known) exposed = moveTotals(bodyLog, iso).min >= q.exposure.minutes; }
    if (exposed == null || outIso > to) continue;
    const e = byDate.get(outIso);
    if (!e || !e.sym || !ids.some((id) => id in e.sym)) continue;
    const side = exposed ? exp : other;
    side.n++;
    if (ids.some((id) => (e.sym[id] || 0) >= level)) side.hits++;
  }
  return { exp, other };
}
/** The PCOS module's cards (only when the module is on). lens: her counted cycle lengths, oldest first. */
/* ---------- meal notes (only while Meal notes is on): energy after meals ----------
   One card comparing how often energy "Dipped" or "Crashed" after meals she noted as "Mostly carbs or sweet" against her
   other meals (Balanced or Protein-forward; skipped meals and meals without a kind or an energy answer are left out). The
   unit is a meal note, with PATTERN_RULES' thresholds (minEach meals on each side, minHits dips in all). Shown only
   with enough notes; worded as an association in her log, never advice, never "good" or "bad" food, never weight. */
export const MEAL_SRC = Object.freeze(["teede2023"]);
export const MEAL_DIET_LINE = "The 2023 International PCOS Guideline recommends healthy eating without naming any one specific diet.";
export function mealSides({ bodyLog = {}, from, to }) {
  const a = { n: 0, hits: 0 }, b = { n: 0, hits: 0 };
  for (const [iso, d] of Object.entries(cleanBodyLog(bodyLog))) {
    if (iso < from || iso > to) continue;
    for (const m of d.meals || []) {
      if (!m.energy || !m.kind || m.kind === "skipped") continue;
      const side = m.kind === "carbs" ? a : b;
      side.n++;
      if (m.energy === "dipped" || m.energy === "crashed") side.hits++;
    }
  }
  return { carbs: a, other: b };
}
export function mealCards({ bodyLog = {}, todayIso, days = PATTERN_RULES.days }) {
  const from = addDays(todayIso, -(days - 1));
  const { carbs, other } = mealSides({ bodyLog, from, to: todayIso });
  const more = statusOf(carbs, other), less = statusOf(other, carbs);
  if (more === "notenough") return [];
  const st = more !== "none" ? more : less !== "none" ? less : "seen";
  const dir = more !== "none" ? "more" : less !== "none" ? "less" : "same";
  const sentence = dir === "same"
    ? "In your log, energy dipped or crashed about as often after meals that were mostly carbs or sweet as after your other meals."
    : st === "supported"
      ? `In your log, energy dipped or crashed ${dir} often after meals that were mostly carbs or sweet than after your other meals.`
      : `Meals that were mostly carbs or sweet and ${dir === "more" ? "" : "fewer "}energy dips are still showing up together in your log, without a clear gap yet.`;
  const d0 = dir === "less" ? diffOf(other, carbs, "as often after other meals") : diffOf(carbs, other, "as often after mostly carbs or sweet");
  // With no dips at all on the other side the figure is "a of n": say which meals it counts, in plain words.
  const d = d0.diff && / of /.test(d0.diff) ? { diff: d0.diff, diffLabel: dir === "less" ? "of your other meals had a dip or crash after; no mostly carbs or sweet meal did" : "mostly carbs or sweet meals had a dip or crash after; none of your other meals did" } : d0;
  const mealW = (k) => (k === 1 ? "meal" : "meals");
  return [card({
    key: "meals:energy", kind: "meals", topic: "Energy after meals", status: st, sentence, family: "body",
    bars: { a: { label: "Mostly carbs or sweet", days: carbs.n, value: carbs.hits / carbs.n, shown: `${carbs.hits} dipped or crashed`, count: `${carbs.n} ${mealW(carbs.n)}` }, b: { label: "Other meals", days: other.n, value: other.hits / other.n, shown: `${other.hits} dipped or crashed`, count: `${other.n} ${mealW(other.n)}` } },
    ...(dir === "same" ? { diff: null, diffLabel: "" } : d),
    strength: Math.abs(carbs.hits / carbs.n - other.hits / other.n),
    detail: {
      question: "Does my energy dip more often after some kinds of meals?",
      lines: [
        `Energy dipped or crashed after ${carbs.hits} of ${carbs.n} ${mealW(carbs.n)} you noted as mostly carbs or sweet, and after ${other.hits} of ${other.n} of your other ${mealW(other.n)} (balanced or protein-forward).`,
        `Heard Health names a pattern with at least ${PATTERN_RULES.minEach} meal notes on each side and ${PATTERN_RULES.minHits} dips or crashes in all. Skipped meals and notes without an energy answer are left out.`,
        "This is what your own notes show, not a rule about food. Energy after a meal also follows sleep, stress, your cycle and more.",
        MEAL_DIET_LINE,
      ],
      askId: null, src: MEAL_SRC,
    },
  })];
}
export function pcosCards({ entries = [], bodyLog = {}, todayIso, lens = [], days = PATTERN_RULES.days }) {
  const from = addDays(todayIso, -(days - 1));
  const out = [];
  for (const q of MODULES.pcos.patternQuestions) {
    if (q.outcome.kind === "cycleLength") {
      const ls = (lens || []).filter((x) => Number.isFinite(x)).slice(-6), m = ls.length, n = longCycleCount(ls, q.outcome.longDays);
      const st = m < 3 ? "notenough" : n === 1 ? "still" : "supported";
      out.push(card({
        key: `pcos:${q.id}`, kind: "pcos", topic: q.topic, status: st, family: "body", recent: `In your recent data: your last ${m || "few"} cycles`,
        sentence: m < 3 ? EMPTY_LINE : n === 0 ? `In your log, your last ${m} cycles all ran ${q.outcome.longDays} days or under.` : `In your log, ${n} of your last ${m} cycles ran over ${q.outcome.longDays} days.`,
        bars: m ? { a: { label: `Over ${q.outcome.longDays} days`, count: `${n} ${n === 1 ? "cycle" : "cycles"}`, value: n / m, shown: `${n} of ${m}` }, b: { label: `${q.outcome.longDays} days or under`, count: `${m - n} ${m - n === 1 ? "cycle" : "cycles"}`, value: (m - n) / m, shown: `${m - n} of ${m}` } } : null,
        diff: m >= 3 ? `${n} of ${m}` : null, diffLabel: `cycles over ${q.outcome.longDays} days`, strength: n ? 0.4 : 0.1,
        detail: { question: q.question, lines: [MODULES.pcos.cycle.expected.text, `Cycle lengths: ${ls.join(", ") || "none counted yet"} days.`], askId: null, src: MODULES.pcos.cycle.expected.src },
      }));
      continue;
    }
    const { exp, other } = questionSides(q, { entries, bodyLog, from, to: todayIso });
    const less = LESS.has(q.id);
    const st = less ? statusOf(other, exp) : statusOf(exp, other);
    if (st === "none") continue;
    const next = q.lag ? " the next day" : "";
    const lo = lc1(q.outcome.label);
    const sentence = st === "notenough" ? EMPTY_LINE
      : less ? (st === "supported" ? `${q.exposure.label} lined up with fewer ${lo} in your log.` : `${q.exposure.label} and fewer ${lo} are still showing up together in your log, without a clear gap yet.`)
      : (st === "supported" ? `${q.exposure.label} lined up with more ${lo}${next} in your log.` : `${q.exposure.label} and ${lo}${next} are still showing up together in your log, without a clear gap yet.`);
    const d = st === "notenough" ? {} : less ? diffOf(other, exp, `as often on ${lc1(q.exposure.other)}`) : diffOf(exp, other, `as often${next}`);
    out.push(card({
      key: `pcos:${q.id}`, kind: "pcos", topic: q.topic, status: st, sentence, family: q.outcome.id === "mood" ? "mind" : "sleep",
      bars: exp.n && other.n ? { a: bar(q.exposure.label, exp, q.outcome.label), b: bar(q.exposure.other, other, q.outcome.label) } : null,
      ...d, strength: exp.n && other.n ? Math.abs(exp.hits / exp.n - other.hits / other.n) : 0,
      detail: {
        question: q.question,
        lines: [
          `${q.outcome.label} moderate or strong${next} on ${exp.hits} of ${exp.n} ${dayW(exp.n)} (${lc1(q.exposure.label)}) and ${other.hits} of ${other.n} (${lc1(q.exposure.other)}).`,
          `Heard Health names a pattern with at least ${PATTERN_RULES.minEach} days on each side and ${PATTERN_RULES.minHits} days with ${lo} in all.`,
        ],
        askId: null,
      },
    }));
  }
  return out;
}

/** "What I'm trying" (spec A3 trial engine) as cards: the 14 days before she started against the 14 from the start,
    counted as lighter days for her (bandOf), never as a score. meds: [{ id, name, started }]; scoreOn(iso) → reading
    | null; usual: usualOf(...). Needs TRIAL_MIN logged days on each side, otherwise "Not enough information". */
export const TRIAL_MIN = 5;
export function trialCards({ meds = [], scoreOn, usual, todayIso }) {
  const out = [];
  for (const m of meds || []) {
    if (!m || typeof m.started !== "string") continue;
    const before = [], after = [];
    for (let i = 1; i <= 14; i++) {
      const b = scoreOn(addDays(m.started, -i)); if (b != null) before.push(b);
      const ai = addDays(m.started, i - 1); if (ai <= todayIso) { const a = scoreOn(ai); if (a != null) after.push(a); }
    }
    const light = (xs) => ({ n: xs.length, hits: xs.filter((s) => bandOf(s, usual) === "lighter").length });
    const A = light(after), B = light(before);
    const enough = usual != null && A.n >= TRIAL_MIN && B.n >= TRIAL_MIN;
    const d = enough ? A.hits / A.n - B.hits / B.n : 0;
    const st = !enough ? "notenough" : Math.abs(d) >= PATTERN_RULES.minDiff - 1e-9 ? "supported" : "still";
    const sentence = !enough ? EMPTY_LINE
      : Math.abs(d) < PATTERN_RULES.leanDiff ? `Since starting ${m.name}, your days look much like before so far.`
      : d > 0 ? `Since starting ${m.name}, more of your days were lighter than your usual.`
      : `Since starting ${m.name}, fewer of your days were lighter than your usual. Worth mentioning to whoever suggested it.`;
    out.push(card({
      key: `trial:${m.id}`, kind: "trial", topic: `What I'm trying · ${m.name}`, status: st, sentence, family: "body",
      bars: A.n || B.n ? { a: { label: "Since starting", days: A.n, value: A.n ? A.hits / A.n : 0, shown: `${A.hits} lighter` }, b: { label: "The two weeks before", days: B.n, value: B.n ? B.hits / B.n : 0, shown: `${B.hits} lighter` } } : null,
      diff: enough ? `${A.hits} of ${A.n}` : null, diffLabel: "lighter days since starting", recent: "In your recent data: two weeks either side of the start",
      strength: Math.abs(d),
      detail: {
        question: `Have your days felt different since starting ${m.name}?`,
        lines: [`Lighter days for you: ${A.hits} of ${A.n} since starting, ${B.hits} of ${B.n} in the two weeks before.`, `Heard Health compares once there are ${TRIAL_MIN} logged days on each side. It never suggests a dose or a change.`],
        advice: { urgency: "visit", text: "Bring this before and after to your next visit: it is the kind of record a clinician can use to decide whether to continue, adjust or stop." },
        askId: "med",
      },
    }));
  }
  return out;
}

/** Ranks cards for the list: a clinical marker (`first`, the perimenopause spread) first, then Supported pattern, Still
    showing up, Not enough information, and plain counts last; strongest first within each. */
export function rankCards(cards) {
  const o = (c) => (c.first ? 0 : STATUS_ORDER[c.status] ?? 9);
  return [...(cards || [])].sort((a, b) => o(a) - o(b) || b.strength - a.strength);
}
/** How many cards show before "View all patterns". */
export const CARDS_SHOWN = 3;

/* ---------- plain observations kept from the L5/L8 Patterns screen (no chip: they are counts, not associations) ---------- */
/** Perimenopause: the spread between cycle lengths, the clinical marker of the transition (every cycle counts, D5).
    lens: [{ len, excluded }]; variability: days between the shortest and longest. */
export function spreadCard({ variability, lens = [] }) {
  if (variability == null) return null;
  const list = lens.map(({ len, excluded }) => (excluded ? `${len} (left out of predictions)` : `${len}`)).join(" · ");
  return card({
    key: "marker:spread", kind: "marker", topic: "Cycle length spread", status: "seen", first: true, strength: 99,
    sentence: `Your cycles ran ${list} days.`, diff: null, recent: "In your recent data: your last cycles",
    bars: null, big: `${variability} days`, bigLabel: "between your shortest and longest",
    detail: {
      question: "How much do your cycle lengths vary?",
      lines: [`A spread of 7 days or more between cycles is the clinical marker of the menopause transition (STRAW staging). Yours: ${variability} days.`],
      advice: { urgency: "visit", text: "Start the treatment conversation early — and ask about a lipid panel and bone-health baseline; the transition is when both start shifting." },
      askId: "var",
    },
  });
}
/** My Cycle: the symptom logged on the most of the last 30 days (3 or more). top: insights() counts[0]. */
export function topCard(top) {
  if (!top || top.days < 3) return null;
  return card({
    key: `marker:top:${top.id}`, kind: "marker", topic: "Most logged", status: "seen", strength: 0.05, family: "body",
    sentence: `${top.label} showed up most: on ${top.days} of your last 30 days.`, recent: "In your recent data: the last 30 days",
    big: `${top.days} of 30`, bigLabel: "days",
    detail: {
      question: "What shows up most in your log?",
      lines: [`${top.label} on ${top.days} of the last 30 days.`],
      advice: top.id === "crm"
        ? { urgency: top.strong > 8 ? "visit" : "self", text: top.strong > 8 ? "Pain that strong, that often, isn't something to just push through — it's worth a proper look (endometriosis takes years to diagnose largely because people are told it's normal)." : "Continuous low-level heat and well-timed anti-inflammatories both have real evidence for cramps." }
        : { urgency: "self", text: "Track it against your calendar — if it clusters in the week before your period, that's a PMS pattern you can plan around." },
      askId: top.id,
    },
  });
}
