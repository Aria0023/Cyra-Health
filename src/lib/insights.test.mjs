/* Unit tests for lib/insights.js (L8): the weekly / monthly summary and its sentences, symptom-by-cycle-day clusters,
   the findings Patterns and Home show (with their copy rules), Home's pick, and the privacy guarantees (no network or
   storage in the source; a day note or fertility sign never reaches an output). Run with `npm run test:unit`. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addDays, dayNumber, lc1, isPlural, be, verbS, SUMMARY, periodSummary, summarySentences, summaryMeta, recapFrom,
  CLUSTER, cycleDayCluster, patternFindings, homePick, NEED_STARTS_LINE,
} from "./insights.js";
import { dayScore } from "./engine.js";
import { SYM, PSYM, GSYM, ENERGY_ID, ALL_SYM, SCORE_SCALE } from "./constants.js";
import { FREE_PLAN, PLAN, can } from "./plan.js";

const TODAY = "2026-10-22";
const e = (date, sleepQ, sym, extra = {}) => ({ date, sleepQ, sym, ...extra });

/* ---------- helpers ---------- */
test("helpers: addDays, dayNumber, lc1, isPlural / be / verbS agreement", () => {
  assert.equal(addDays("2026-10-22", -6), "2026-10-16");
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(dayNumber("2026-10-23") - dayNumber("2026-10-22"), 1);
  assert.equal(lc1("Brain fog"), "brain fog");
  for (const p of ["Hot flashes", "Headaches", "Cravings", "Night sweats", "Mood swings"]) { assert.equal(isPlural(p), true, p); assert.equal(be(p), "were"); assert.equal(verbS(p, "cluster"), "cluster"); }
  for (const s of ["Breast tenderness", "Vaginal dryness", "Anxiety", "Low energy", "Brain fog", "Nausea"]) { assert.equal(isPlural(s), false, s); assert.equal(be(s), "was"); assert.equal(verbS(s, "cluster"), "clusters"); }
});

/* ---------- periodSummary ---------- */
const IDS = ["hf", "fog", "ns", "slp"];
const WEEK = [
  // this week (Oct 16–22)
  e("2026-10-22", "poor", { hf: 2, fog: 2, slp: 2 }),
  e("2026-10-21", "good", { hf: 2, fog: 1 }),
  e("2026-10-20", "fair", { fog: 2, slp: 3 }), // slp 3: a rough night
  e("2026-10-17", "good", {}),
  // the week before (Oct 9–15)
  e("2026-10-15", "poor", { hf: 1 }),
  e("2026-10-12", "good", {}),
  e("2026-10-10", "poor", { fog: 3, ns: 3 }),
  // older, ignored
  e("2026-10-01", "poor", { hf: 3 }),
];
const sortedOf = (rows) => [...rows].sort((a, b) => a.date.localeCompare(b.date));

test("periodSummary (week): counts, rounding, diff, top order with a severity tie-break, rough nights, compare", () => {
  const s = periodSummary(sortedOf(WEEK), IDS, SYM, TODAY, 7, 4);
  assert.deepEqual([s.from, s.to, s.prevFrom, s.prevTo], ["2026-10-16", "2026-10-22", "2026-10-09", "2026-10-15"]);
  assert.deepEqual([s.logged, s.prevLogged, s.compare], [4, 3, true]);
  // Scores by hand (scale 4, no scales): 0.48125, 0.715625, 0.559375, 0.95 → 67.66 → 68; 0.871875, 0.95, 0.48125 → 76.77 → 77.
  assert.deepEqual([s.score, s.prevScore, s.diff], [68, 77, -9]);
  assert.deepEqual([s.calm, s.prevCalm, s.rough, s.prevRough], [2, 2, 2, 2]);
  // fog 3 days; hf and slp 2 days each, slp's summed severity (5) beats hf's (4).
  assert.deepEqual(s.top, [
    { id: "fog", label: "Brain fog", days: 3, prevDays: 1 },
    { id: "slp", label: "Sleep disruption", days: 2, prevDays: 0 },
    { id: "hf", label: "Hot flashes", days: 2, prevDays: 1 },
  ]);
  assert.equal(s.cells.length, 7);
  assert.deepEqual(s.cells.map((c) => c.iso), ["2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"]);
  assert.deepEqual(s.cells.map((c) => c.score == null), [true, false, true, true, false, false, false]);
  // Two logged days before: no comparison.
  const two = periodSummary(sortedOf(WEEK.filter((d) => d.date !== "2026-10-12")), IDS, SYM, TODAY, 7, 4);
  assert.deepEqual([two.prevLogged, two.compare], [2, false]);
  assert.deepEqual(summarySentences(s), [
    "You checked in on 4 of the last 7 days, up from 3.",
    "Your average day score was 68, 9 points lower than the week before.",
    "Brain fog showed up most (3 days), then sleep disruption (2), with 2 rough nights, the same as the week before.",
  ]);
});

const monthRows = (cur, prev) => [
  ...Array.from({ length: cur }, (_, i) => e(addDays(TODAY, -i), "good", { fog: 1 })),
  ...Array.from({ length: prev }, (_, i) => e(addDays(TODAY, -30 - i), "poor", { fog: 2 })),
];

test("periodSummary (month): compare at 10 logged days each side, 30 cells, the score equals App's scoreOn formula", () => {
  const nine = periodSummary(sortedOf(monthRows(12, 9)), IDS, SYM, TODAY, 30, 12);
  const ten = periodSummary(sortedOf(monthRows(12, 10)), IDS, SYM, TODAY, 30, 12);
  assert.deepEqual([nine.compare, ten.compare, ten.cells.length], [false, true, 30]);
  assert.deepEqual([ten.from, ten.prevFrom, ten.prevTo], ["2026-09-23", "2026-08-24", "2026-09-22"]);
  // Amendment: the same scale as dayScore(e, ids, scale) everywhere (Calendar, Home, the L9 PDF).
  const rows = sortedOf(monthRows(12, 10)).filter((d) => d.date >= ten.from);
  const want = Math.round((rows.reduce((a, d) => a + dayScore(d, IDS, SCORE_SCALE.peri), 0) / rows.length) * 100);
  assert.equal(periodSummary(sortedOf(monthRows(12, 10)), IDS, SYM, TODAY, 30, SCORE_SCALE.peri).score, want);
  assert.notEqual(periodSummary(sortedOf(monthRows(12, 10)), IDS, SYM, TODAY, 30, 2).score, want);
  assert.equal(periodSummary([], IDS, SYM, TODAY, 7).cells.length, 7);
  assert.deepEqual(SUMMARY[7].compareMin, 3);
  assert.deepEqual(SUMMARY[30].compareMin, 10);
});

test("periodSummary on pregnancy entries: rough 0, the GSYM top symptom; recapFrom keeps the old recap's shape", () => {
  const preg = [];
  for (let i = 0; i < 12; i++) preg.push(e(addDays(TODAY, -i), undefined, { nau: i % 2 ? 2 : 0, hb: 1 }));
  for (let i = 0; i < 11; i++) preg.push(e(addDays(TODAY, -31 - i), undefined, { nau: 1, hb: 0 }));
  const m = periodSummary(sortedOf(preg).map(({ sleepQ, ...rest }) => rest), Object.keys(GSYM), GSYM, TODAY, 30, SCORE_SCALE.preg);
  assert.deepEqual([m.rough, m.prevRough, m.top[0].id, m.top[0].label, m.compare], [0, 0, "hb", "Heartburn", true]);
  const r = recapFrom(m);
  assert.deepEqual(Object.keys(r), ["score", "calm", "poor", "top"]);
  assert.deepEqual(r.score, [m.prevScore, m.score]);
  assert.deepEqual(r.calm, [m.prevCalm, m.calm]);
  assert.deepEqual(r.poor, [0, 0]);
  assert.deepEqual(r.top, { label: "Heartburn", prev: 0, now: 12 });
  assert.equal(recapFrom({ ...m, compare: false }), null);
  assert.equal(recapFrom(null), null);
  assert.equal(recapFrom({ ...m, top: [] }).top, null);
});

/* ---------- summarySentences ---------- */
const S = (o) => ({ n: 7, logged: 5, prevLogged: 4, compare: true, score: 72, prevScore: 78, diff: -6, rough: 2, prevRough: 4, top: [{ label: "Brain fog", days: 4 }, { label: "Hot flashes", days: 3 }], ...o });

test("summarySentences: exact strings", () => {
  // The brief's example.
  assert.equal(summarySentences(S({})).join(" "), "You checked in on 5 of the last 7 days, up from 4. Your average day score was 72, 6 points lower than the week before. Brain fog showed up most (4 days), then hot flashes (3), with 2 rough nights, down from 4.");
  // No comparison.
  assert.deepEqual(summarySentences(S({ prevLogged: 2, compare: false, prevScore: 60, diff: 12 })), [
    "You checked in on 5 of the last 7 days, up from 2.",
    "Your average day score was 72.",
    "Brain fog showed up most (4 days), then hot flashes (3), with 2 rough nights.",
  ]);
  assert.deepEqual(summarySentences(S({ prevLogged: 0, compare: false, prevScore: null, diff: null, top: [{ label: "Headaches", days: 1 }], rough: 1 })), [
    "You checked in on 5 of the last 7 days.",
    "Your average day score was 72.",
    "Headaches showed up most (1 day), with 1 rough night.",
  ]);
  // One logged day.
  assert.deepEqual(summarySentences(S({ logged: 1, prevLogged: 0, compare: false, score: 64, rough: 0, top: [] })), [
    "You checked in on 1 of the last 7 days.",
    "That day's score was 64.",
    "You logged no symptoms and no rough nights.",
  ]);
  // Nothing this week, 5 the week before.
  assert.deepEqual(summarySentences(S({ logged: 0, prevLogged: 5, compare: false })), ["No check-ins in the last 7 days yet.", "You logged 5 days the week before."]);
  assert.deepEqual(summarySentences(S({ logged: 0, prevLogged: 1, compare: false })), ["No check-ins in the last 7 days yet.", "You logged 1 day the week before."]);
  assert.deepEqual(summarySentences(S({ logged: 0, prevLogged: 0, compare: false })), ["No check-ins in the last 7 days yet."]);
  // No symptoms, with rough nights.
  assert.equal(summarySentences(S({ top: [] }))[2], "You logged no symptoms and 2 rough nights, down from 4.");
  assert.equal(summarySentences(S({ rough: 0, prevRough: 3 }))[2], "Brain fog showed up most (4 days), then hot flashes (3), with no rough nights, down from 3.");
  // The same counts.
  assert.deepEqual(summarySentences(S({ logged: 4, diff: 2, rough: 4 })), [
    "You checked in on 4 of the last 7 days, the same as the week before.",
    "Your average day score was 72, about the same as the week before.",
    "Brain fog showed up most (4 days), then hot flashes (3), with 4 rough nights, the same as the week before.",
  ]);
  assert.equal(summarySentences(S({ diff: 3, logged: 3 }))[1], "Your average day score was 72, 3 points better than the week before.");
  assert.equal(summarySentences(S({ diff: -3 }))[1], "Your average day score was 72, 3 points lower than the week before.");
  assert.equal(summarySentences(S({ rough: 5 }))[2], "Brain fog showed up most (4 days), then hot flashes (3), with 5 rough nights, up from 4.");
  assert.equal(summarySentences(S({ n: 30, logged: 21, prevLogged: 25 }))[0], "You checked in on 21 of the last 30 days, down from 25.");
  assert.equal(summarySentences(S({ n: 30, diff: 8 }))[1], "Your average day score was 72, 8 points better than the 30 days before.");
});

test("summaryMeta with and without the comparison", () => {
  const s = periodSummary(sortedOf(WEEK), IDS, SYM, TODAY, 7, 4);
  assert.equal(summaryMeta(s), "Oct 16–Oct 22 · compared with Oct 9–Oct 15");
  assert.equal(summaryMeta({ ...s, prevLogged: 0 }), "Oct 16–Oct 22");
});

/* ---------- cycleDayCluster ---------- */
// Cycles of `len` days from 2026-01-05; spec[c] = { logged: cycle days logged (default all ≤ 45), hits: cycle days with id > 0 }.
function cycles(len, specs, id = "hda", { lens = null } = {}) {
  const starts = [], rows = [];
  let s = "2026-01-05";
  specs.forEach((sp, c) => {
    const L = lens ? lens[c] : len;
    starts.push(s);
    const logged = sp.logged || Array.from({ length: L }, (_, i) => i + 1);
    for (const cd of logged) rows.push(e(addDays(s, cd - 1), "fair", { [id]: sp.hits.includes(cd) ? 1 : 0 }));
    s = addDays(s, L);
  });
  return { starts, rows: sortedOf(rows), end: addDays(s, -1) };
}
const D2528 = [25, 26, 27, 28];

test("cycleDayCluster: three cycles with headaches on cycle days 25–28 → days 25–28 with exact counts", () => {
  const f = cycles(28, [{ hits: D2528 }, { hits: D2528 }, { hits: D2528 }]);
  const k = cycleDayCluster(f.rows, f.starts, "hda", { todayIso: f.end });
  assert.deepEqual(
    { ok: k.ok, why: k.why, from: k.from, to: k.to, inWin: k.inWin, loggedIn: k.loggedIn, restHits: k.restHits, restLogged: k.restLogged, cycles: k.cycles, nCycles: k.nCycles, total: k.total },
    { ok: true, why: null, from: 25, to: 28, inWin: 12, loggedIn: 12, restHits: 0, restLogged: 72, cycles: 3, nCycles: 3, total: 12 },
  );
});

test("cycleDayCluster: the minimums", () => {
  const one = cycles(28, [{ hits: D2528 }]);
  assert.equal(cycleDayCluster(one.rows, one.starts, "hda", { todayIso: one.end }).why, "starts");
  // Window hits in only one cycle (plus two scattered days to reach 6): no window.
  const lone = cycles(28, [{ hits: D2528 }, { hits: [10] }, { hits: [10] }]);
  assert.equal(cycleDayCluster(lone.rows, lone.starts, "hda", { todayIso: lone.end }).why, "nowin");
  // 5 days in all: too few.
  const five = cycles(28, [{ hits: [25, 26, 27] }, { hits: [25, 26] }]);
  assert.equal(cycleDayCluster(five.rows, five.starts, "hda", { todayIso: five.end }).why, "few");
  assert.equal(cycleDayCluster(five.rows, five.starts, "hda", { todayIso: five.end, minTotal: 5 }).ok, true);
});

test("cycleDayCluster: ratio 2.0× vs 1.9× and gap 0.25 vs 0.24, each rule isolated", () => {
  const head = [1, 2, 3, 4], headHits = [1, 2];
  const rest = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const every4 = (from, to) => rest(from, to).filter((cd) => (cd - from) % 4 === 0);
  // Window rate 4/8 = 0.5; rest 10/40 = 0.25 → exactly 2.0× and a 0.25 gap.
  const ok = cycles(40, [{ logged: [...head, ...rest(20, 39)], hits: [...headHits, ...every4(20, 39)] }, { logged: [...head, ...rest(20, 39)], hits: [...headHits, ...every4(20, 39)] }, { logged: [], hits: [] }]);
  const k = cycleDayCluster(ok.rows, ok.starts, "hda", { todayIso: ok.end });
  assert.deepEqual([k.ok, k.from, k.inWin, k.loggedIn, k.restHits, k.restLogged], [true, 1, 4, 8, 10, 40]);
  // Rest 10/38 (two non-hit days fewer): 1.9× — no cluster on the ratio alone.
  const r19 = cycles(40, [{ logged: [...head, ...rest(20, 38)], hits: [...headHits, ...every4(20, 39)] }, { logged: [...head, ...rest(20, 38)], hits: [...headHits, ...every4(20, 39)] }, { logged: [], hits: [] }]);
  const k19 = cycleDayCluster(r19.rows, r19.starts, "hda", { todayIso: r19.end, minDiff: 0 });
  assert.deepEqual([k19.ok, k19.why, k19.restLogged], [false, "no-cluster", 38]);
  assert.equal(cycleDayCluster(ok.rows, ok.starts, "hda", { todayIso: ok.end, minDiff: 0 }).ok, true);
  // Gap 0.24: rest 13/50 = 0.26 (minRatio relaxed); gap 0.25 is the passing case above.
  const g = cycles(50, [{ logged: [...head, ...rest(20, 44)], hits: [...headHits, ...every4(20, 44)] }, { logged: [...head, ...rest(20, 44)], hits: [...headHits, ...every4(20, 40)] }, { logged: [], hits: [] }]);
  const kg = cycleDayCluster(g.rows, g.starts, "hda", { todayIso: g.end, minRatio: 0 });
  assert.deepEqual([kg.ok, kg.why, kg.restHits, kg.restLogged], [false, "no-cluster", 13, 50]);
  assert.equal(cycleDayCluster(ok.rows, ok.starts, "hda", { todayIso: ok.end, minRatio: 0 }).ok, true);
});

test("cycleDayCluster: days before the first used start and past cycle day 45 are ignored; only the last 4 starts; a long cycle still counts (D5)", () => {
  // Five starts: the oldest cycle (before the last 4 starts) is full of cycle-day-10 headaches.
  const f = cycles(28, [{ hits: [5, 6, 7, 8, 9, 10, 11, 12] }, { hits: D2528 }, { hits: D2528 }, { hits: D2528 }, { hits: D2528 }]);
  const k = cycleDayCluster(f.rows, f.starts, "hda", { todayIso: f.end });
  assert.deepEqual([k.ok, k.from, k.nCycles, k.total, k.cycles], [true, 25, 4, 16, 4]);
  const noOld = cycleDayCluster(f.rows.filter((d) => d.date >= f.starts[1]), f.starts, "hda", { todayIso: f.end });
  assert.deepEqual(noOld, k);
  // A 61-day cycle (one L5 would suggest leaving out of predictions) still counts; its days 46–61 are ignored.
  const long = cycles(28, [{ hits: D2528 }, { hits: [...D2528, ...Array.from({ length: 16 }, (_, i) => 46 + i)] }, { hits: D2528 }], "hda", { lens: [28, 61, 28] });
  const kl = cycleDayCluster(long.rows, long.starts, "hda", { todayIso: long.end });
  assert.deepEqual([kl.ok, kl.from, kl.to, kl.total, kl.cycles, kl.restHits], [true, 25, 28, 12, 3, 0]);
  assert.equal(kl.loggedIn + kl.restLogged, 28 + 45 + 28);
  // Entries after todayIso are ignored.
  assert.deepEqual(cycleDayCluster(f.rows, f.starts, "hda", { todayIso: addDays(f.end, -10) }).total, 12);
  assert.deepEqual(CLUSTER, { maxCycles: 4, win: 4, maxDay: 45, minTotal: 6, minIn: 4, minLoggedIn: 5, minCycles: 2, minRatio: 2, minDiff: 0.25 });
});

/* ---------- patternFindings ---------- */
// 60 days ending TODAY: even days rough, odd days good (slept well); per-id hit days.
function sleepFx(spec, { len = 60, slpAll = false } = {}) {
  const rows = [];
  for (let i = 0; i < len; i++) {
    const rough = i % 2 === 0, sym = {};
    for (const [id, f] of Object.entries(spec)) sym[id] = f(i, rough);
    if (slpAll) sym.slp = rough ? 3 : 1;
    rows.push(e(addDays(TODAY, -i), rough ? "poor" : "good", sym));
  }
  return sortedOf(rows);
}
const ENDINGS = /— (a link|no clear link|a cluster|no clear cluster|not enough to compare yet)\.$/;

test("patternFindings: candidates (never Sleep disruption), the energy id, order, checked lines, cycles off / one start", () => {
  const rows = sleepFx({
    fog: (i, r) => (r ? (i % 4 === 0 ? 3 : 2) : i % 6 === 1 ? 2 : 1), // strong link
    hf: (i, r) => (r ? (i % 4 === 0 ? 2 : 1) : i % 8 === 1 ? 2 : 1), // weaker link
    ns: (i) => (i % 2 ? 2 : 2), // the same either way: no link
    mood: (i) => (i < 6 ? 1 : 0), // 4th by days: not a candidate
    [ENERGY_ID]: (i) => (i === 0 ? 2 : 0), // logged once: still checked
  }, { slpAll: true });
  const ids = ["hf", "ns", "fog", "slp", "mood", ENERGY_ID];
  const f = patternFindings({ sorted: rows, ids, labels: SYM, starts: [], todayIso: TODAY, energyId: ENERGY_ID });
  assert.ok(!f.checked.some((l) => l.startsWith("Sleep disruption")));
  assert.deepEqual(f.checked.map((l) => l.split(" and sleep:")[0]), ["Hot flashes", "Night sweats", "Brain fog", "Low energy", "By cycle day: Heard Health needs two logged period starts to compare cycle days."]);
  assert.equal(f.checked[4], NEED_STARTS_LINE);
  for (const l of f.checked.slice(0, 4)) assert.match(l, ENDINGS);
  assert.match(f.checked[1], /— no clear link\.$/);
  assert.equal(f.checked[3], "Low energy and sleep: moderate or strong on 1 day so far — not enough to compare yet.");
  assert.deepEqual(f.sleep.map((x) => x.id), ["fog", "hf"]); // strongest first
  assert.ok(f.sleep[0].strength >= f.sleep[1].strength);
  assert.deepEqual(f.sleep.map((x) => x.key), ["sleep:fog", "sleep:hf"]);
  assert.equal(f.sleep[1].advice.urgency, "visit");
  assert.equal(f.sleep[1].askId, "hf");
  assert.equal(f.sleep[0].askId, "slp");
  assert.equal(f.sleep[0].fam, "mind");
  // Not tracked → not checked.
  const noEng = patternFindings({ sorted: rows, ids: ids.filter((x) => x !== ENERGY_ID), labels: SYM, starts: [], todayIso: TODAY, energyId: ENERGY_ID });
  assert.ok(!noEng.checked.some((l) => l.startsWith("Low energy")));
  // Menopause: no cycle lines at all.
  const meno = patternFindings({ sorted: rows, ids, labels: SYM, starts: [], todayIso: TODAY, energyId: ENERGY_ID, cycles: false });
  assert.ok(!meno.checked.some((l) => /cycle day/.test(l)));
  assert.deepEqual([meno.cycle, meno.cyclesUsed], [[], 0]);
  // One start → the single waiting line.
  const one = patternFindings({ sorted: rows, ids, labels: SYM, starts: [addDays(TODAY, -20)], todayIso: TODAY });
  assert.deepEqual(one.checked.filter((l) => /cycle day/.test(l)), [NEED_STARTS_LINE]);
  // Few nights.
  const few = patternFindings({ sorted: rows.slice(-6), ids, labels: SYM, starts: [], todayIso: TODAY, cycles: false });
  assert.equal(few.checked[0], "Hot flashes and sleep: 3 days after a rough night and 3 after a night you slept well so far — not enough to compare yet.");
});

test("patternFindings: the cycle-day card and its lines", () => {
  const f = cycles(28, [{ hits: D2528 }, { hits: D2528 }, { hits: D2528 }]);
  const out = patternFindings({ sorted: f.rows, ids: ["hda", "crm"], labels: PSYM, starts: f.starts, todayIso: f.end, energyId: ENERGY_ID });
  assert.equal(out.cycle.length, 1);
  const c = out.cycle[0];
  assert.equal(c.homeNum, "25–28");
  assert.deepEqual([c.key, c.kind, c.num, c.fam, c.tier, c.askId, c.advice.urgency], ["cycle:hda", "cycle", "Days 25–28", "pain", 1, "hda", "self"]);
  assert.equal(c.text, "In your log, headaches showed up most on cycle days 25–28: 12 of the 12 days you logged there, against 0 of 72 on your other cycle days. Seen in 3 of your last 3 cycles.");
  assert.equal(c.homeText, "In your log, headaches cluster on cycle days 25–28.");
  assert.ok(out.checked.includes("Headaches by cycle day: 12 of 12 logged days on cycle days 25–28, 0 of 72 on your other cycle days — a cluster."));
  assert.equal(out.cyclesUsed, 3);
  const few = patternFindings({ sorted: f.rows.map((d) => ({ ...d, sym: { ...d.sym, crm: d.date === f.end ? 1 : 0 } })), ids: ["hda", "crm"], labels: PSYM, starts: f.starts, todayIso: f.end });
  assert.ok(few.checked.includes("Cramps by cycle day: logged on 1 day in these cycles so far — not enough to compare yet."));
  const flat = cycles(28, [{ hits: [3, 10, 17, 24] }, { hits: [5, 12, 19, 26] }, { hits: [1, 8] }]);
  const nc = patternFindings({ sorted: flat.rows, ids: ["hda"], labels: PSYM, starts: flat.starts, todayIso: flat.end });
  assert.ok(nc.checked.includes("Headaches by cycle day — no clear cluster."));
  for (const l of [...out.checked, ...few.checked, ...nc.checked]) assert.match(l, ENDINGS);
});

/* ---------- copy rules for every label ---------- */
const BANNED = /\b(cause[sd]?|because|due to|triggers?|leads? to|makes)\b/i;
const clean = (t) => t.split("not proof that one causes the other").join("");
const BAD_TOKENS = /NaN|undefined|\bnull\b/;
function linkRows(id, rh, rn, gh, gn) {
  const rows = []; let i = 0;
  for (let k = 0; k < rn; k++) rows.push(e(addDays(TODAY, -i++), "poor", { [id]: k < rh ? 2 : 0 }));
  for (let k = 0; k < gn; k++) rows.push(e(addDays(TODAY, -i++), "good", { [id]: k < gh ? 2 : 0 }));
  return sortedOf(rows);
}

test("copy rules: agreement, 'In your log,', no NaN / undefined / null, no causal words, Home texts ≤ 90 characters", () => {
  const labels = [...new Set([...Object.values(SYM), ...Object.values(PSYM), ...Object.values(GSYM), "Low energy"])];
  const all = [];
  for (const label of labels) {
    const id = Object.keys(ALL_SYM).find((k) => ALL_SYM[k] === label) || "x";
    for (const energy of [null, id]) {
      // Worst-case numbers: a 9.9× ratio (99/100 vs 10/100), a zero base (28/30), cycle days 38–41.
      const ratio = patternFindings({ sorted: linkRows(id, 99, 100, 10, 100), ids: [id], labels: { [id]: label }, starts: [], todayIso: TODAY, energyId: energy, days: 400, cycles: false });
      const zero = patternFindings({ sorted: linkRows(id, 28, 30, 0, 30), ids: [id], labels: { [id]: label }, starts: [], todayIso: TODAY, energyId: energy, cycles: false });
      const cyc = cycles(45, [{ hits: [38, 39, 40, 41] }, { hits: [38, 39, 40, 41] }, { hits: [38, 39, 40, 41] }], id);
      const cl = patternFindings({ sorted: cyc.rows, ids: [id], labels: { [id]: label }, starts: cyc.starts, todayIso: cyc.end, energyId: energy });
      assert.equal(cl.cycle[0].num, "Days 38–41", label);
      // Sleep disruption is never its own sleep candidate.
      if (id === "slp") { assert.deepEqual([ratio.sleep, zero.sleep, ratio.checked], [[], [], []]); all.push(...cl.checked, cl.cycle[0].text, cl.cycle[0].homeText); continue; }
      assert.equal(ratio.sleep[0].num, "9.9×", label);
      assert.equal(zero.sleep[0].num, "28/30", label);
      for (const f of [ratio.sleep[0], zero.sleep[0], cl.cycle[0]]) {
        assert.ok(f.text.startsWith("In your log,") && f.homeText.startsWith("In your log,"), label);
        assert.ok(f.homeText.length <= 75, `${f.homeText} (${f.homeText.length})`); // the measured two-line budget at 390px
        all.push(f.text, f.homeText, f.advice.text, f.num);
      }
      all.push(...ratio.checked, ...zero.checked, ...cl.checked);
      const lc = lc1(label);
      assert.ok(ratio.sleep[0].text.includes(`${lc} ${isPlural(label) ? "were" : "was"} moderate or strong 9.9× as often after a rough night`), label);
      assert.ok(cl.cycle[0].homeText.includes(`${lc} ${isPlural(label) ? "cluster" : "clusters"} on cycle days 38–41`), label);
    }
  }
  assert.ok(patternFindings({ sorted: linkRows("hf", 99, 100, 10, 100), ids: ["hf"], labels: SYM, starts: [], todayIso: TODAY, days: 400, cycles: false }).sleep[0].text.includes("hot flashes were moderate or strong 9.9× as often after a rough night: on 99 of 100 days after a rough night, and 10 of 100 after a night you slept well."));
  assert.equal(patternFindings({ sorted: linkRows("fog", 12, 14, 0, 9), ids: ["fog"], labels: SYM, starts: [], todayIso: TODAY, cycles: false }).sleep[0].text, "In your log, brain fog was moderate or strong on 12 of 14 days after a rough night, and on none of the 9 days after a night you slept well.");
  assert.equal(patternFindings({ sorted: linkRows("fog", 12, 14, 0, 9), ids: ["fog"], labels: SYM, starts: [], todayIso: TODAY, cycles: false }).sleep[0].homeText, "In your log, brain fog flared up after 12 of 14 rough nights.");
  assert.equal(patternFindings({ sorted: linkRows("hf", 99, 100, 10, 100), ids: ["hf"], labels: SYM, starts: [], todayIso: TODAY, days: 400, cycles: false }).sleep[0].homeText, "In your log, hot flashes flared up 9.9× as often after a rough night.");
  // Two-digit ratios round to a whole number.
  assert.equal(patternFindings({ sorted: linkRows("fog", 60, 100, 5, 100), ids: ["fog"], labels: SYM, starts: [], todayIso: TODAY, days: 400, cycles: false }).sleep[0].num, "12×");
  // Summary sentences too.
  for (const s of [S({}), S({ logged: 0 }), S({ logged: 1, top: [] }), S({ compare: false })]) all.push(...summarySentences(s));
  all.push(...summarySentences(periodSummary(sortedOf(WEEK), IDS, SYM, TODAY, 7, 4)), summaryMeta(periodSummary(sortedOf(WEEK), IDS, SYM, TODAY, 7, 4)));
  for (const t of all) {
    assert.doesNotMatch(t, BAD_TOKENS, t);
    assert.doesNotMatch(clean(t), BANNED, t);
  }
});

/* ---------- homePick ---------- */
const C = (key, strength, tier = 1) => ({ key, strength, tier });

test("homePick: a new finding beats every standing one; otherwise a daily rotation over the three strongest; var first", () => {
  const cands = [C("sleep:fog", 3), C("sleep:hf", 9), C("cycle:hda", 5), C("sleep:ns", 1)];
  assert.equal(homePick(cands, new Set(["sleep:hf", "cycle:hda", "sleep:ns"]), TODAY).key, "sleep:fog");
  assert.equal(homePick(cands, new Set(["sleep:hf"]), TODAY).key, "cycle:hda"); // the strongest new one
  const standing = new Set(cands.map((c) => c.key));
  const picks = [0, 1, 2].map((i) => homePick(cands, standing, addDays(TODAY, i)).key);
  assert.equal(new Set(picks).size, 3);
  assert.ok(!picks.includes("sleep:ns")); // only the three strongest rotate
  assert.equal(homePick(cands, standing, TODAY).key, homePick(cands, standing, TODAY).key);
  assert.equal(homePick(cands, standing, addDays(TODAY, 3)).key, picks[0]);
  // tier 0 ("var") ranks first.
  const withVar = [...cands, C("var", 0.5, 0)];
  assert.equal(homePick(withVar, new Set(), TODAY).key, "var");
  assert.equal(homePick([], new Set(), TODAY), null);
  assert.equal(homePick(null, new Set(), TODAY), null);
  assert.equal(homePick([C("a", 1)], new Set(["a"]), TODAY).key, "a");
});

/* ---------- privacy ---------- */
test("privacy: insights.js has no network, storage or app-module imports; notes and fertility signs never reach an output", () => {
  const src = readFileSync(new URL("./insights.js", import.meta.url), "utf8");
  for (const bad of ["fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "EventSource", "localStorage", "indexedDB", "import(", "./api", "./storage", "./plan", "./notifications"]) assert.ok(!src.includes(bad), bad);
  const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(imports)].sort(), ["./constants.js", "./engine.js"]);
  const secret = (rows) => rows.map((d, i) => ({ ...d, note: "PRIVATE-NOTE", mucus: "eggwhite", cm: "eggwhite", opk: "positive", bbt: 36.71 + i / 1000 }));
  const f = cycles(28, [{ hits: D2528 }, { hits: D2528 }, { hits: D2528 }]);
  const rows = secret(f.rows.map((d, i) => ({ ...d, sleepQ: i % 2 ? "good" : "poor", sym: { ...d.sym, fog: i % 2 ? 0 : 2 } })));
  const outs = [
    patternFindings({ sorted: rows, ids: ["hda", "fog"], labels: ALL_SYM, starts: f.starts, todayIso: f.end, energyId: ENERGY_ID }),
    periodSummary(rows, ["hda", "fog"], ALL_SYM, f.end, 7), periodSummary(rows, ["hda", "fog"], ALL_SYM, f.end, 30),
    summarySentences(periodSummary(rows, ["hda", "fog"], ALL_SYM, f.end, 30)),
    cycleDayCluster(rows, f.starts, "hda", { todayIso: f.end }),
  ];
  assert.ok(outs[0].sleep.length && outs[0].cycle.length);
  const json = JSON.stringify(outs);
  for (const w of ["PRIVATE-NOTE", "eggwhite", "positive", "36.7"]) assert.ok(!json.includes(w), w);
});

test("plan hook: AI pattern reports stay off", () => {
  assert.equal(FREE_PLAN.aiPatternReports, false);
  assert.equal(PLAN.aiPatternReports, false);
  assert.equal(can("aiPatternReports"), false);
});
