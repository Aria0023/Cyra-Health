/* Unit tests for POTS patterns (lib/potsPatterns.js), design 11.1 f, plus the report's
   Patterns, cycle-pattern and cycle-day parts (lib/potsReport.js). Run with `npm run test:unit`
   (node --test, no dependencies). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { freshEmpty, cleanPots, turnOn, setIv, setRating } from "./pots.js";
import {
  dayRows, compareFactor, factorList, goodVsRough, cycleGroups, cycleGroupOn, cycleDayOn, cycleLabelOn, medBeforeAfter,
  episodesByDose, todayPace, weekSummary, patterns, testGroups, windowRange, sinceOffered, addDays, cardWords, isCycleStage,
  GVR_WAIT, CYCLE_WAIT, PACE_WAIT, PATTERN_FOOT, SYMPTOM_FOOT, REPORT_FOOT, adviceFor,
} from "./potsPatterns.js";
import { reportModel, toCSV, modelTexts, visitQuestions, questionIn, factorPart } from "./potsReport.js";
import { POTS_BANNED, THRESH } from "./potsConstants.js";

const TODAY = "2026-10-10";
const ago = (n, from = TODAY) => addDays(from, -n);
const assertClean = (s, where) => assert.ok(!POTS_BANNED.test(s), `banned wording in ${where}: ${s}`);
const on = () => ({ ...freshEmpty(), on: true, epoch: "e1", epochAt: 1, since: ago(80) });
const rowsOf = (p, from, to, extra = {}) => dayRows(cleanPots(p), { from, to, ...extra });

/** Synthetic rows for compareFactor: nE exposed days (aE rough), nU unexposed (aU rough), and
    `unknown` rated days whose exposure isn't known. */
function synth(nE, aE, nU, aU, unknown = 0) {
  const rows = [];
  for (let i = 0; i < nE; i++) rows.push({ rated: true, rough: i < aE, x: true });
  for (let i = 0; i < nU; i++) rows.push({ rated: true, rough: i < aU, x: false });
  for (let i = 0; i < unknown; i++) rows.push({ rated: true, rough: false, x: null });
  rows.push({ rated: false, rough: null, x: true }); // an unrated day never counts
  return rows;
}
const F = { key: "x", fn: (r) => r.x };

/** A 60-day log where rough days come mostly on days with little to drink (deterministic). */
function rich({ days = 60, goal = 2000, today = TODAY } = {}) {
  const p = on();
  p.since = ago(days - 1, today);
  p.settings.goals = { fluidMl: goal, naMg: null, by: goal ? "clinician" : null, set: ago(days, today) };
  p.meds = [
    { id: "m1", lib: "mido", name: "Midodrine", kind: "rx", times: ["08:00"], note: "", started: ago(40, today), stopped: null },
    { id: "a1", lib: "comp_leg", name: "Compression (leg)", kind: "aid", times: [], note: "", started: null, stopped: null },
  ];
  for (let i = 0; i < days; i++) {
    const d = ago(i, today), low = i % 3 === 0, rough = low ? i % 5 !== 0 : i % 7 === 0;
    p.days[d] = {
      rating: rough ? 3 + (i % 2) : i % 2 ? 1 : 2,
      sym: { p_dzy: rough ? 2 : 1 },
      intake: [{ id: `a${i}`, t: "09:00", kind: "water", label: "Glass", ml: low ? 500 : 1250, naMg: null }, { id: `b${i}`, t: "15:00", kind: "electrolyte", label: "Drink", ml: low ? 250 : 1000, naMg: 400 }],
      sleep: i % 4 === 0 ? "poor" : "good",
      trig: i % 6 === 0 ? ["t_heat"] : [],
      aids: { a1: i % 2 === 0 },
      ...(i < 40 ? { doses: [{ id: `d${i}`, medId: "m1", slot: "08:00", t: i % 9 === 0 ? "11:30" : "08:10", state: "taken" }] } : {}),
      ...(rough ? { eps: [{ id: `e${i}`, t: "11:00", sym: ["p_dzy"], sev: 2, pos: "standing", faint: i % 10 === 0 ? "almost" : "no", injured: false, mins: 5, trig: [], helped: [], note: "" }] } : {}),
    };
  }
  return cleanPots(p);
}

/* ================= f. factor gates ================= */
test("f: 4 vs 5 days on a side", () => {
  assert.equal(compareFactor(synth(4, 4, 12, 1, 0), F).shown, false);
  assert.equal(compareFactor(synth(4, 4, 12, 1, 0), F).reason, "sides");
  assert.equal(compareFactor(synth(4, 4, 12, 1, 0), F).need, 1);
  assert.equal(compareFactor(synth(5, 4, 12, 1, 0), F).shown, true);
});
test("f: 13 vs 14 rated days in the window", () => {
  const r13 = compareFactor(synth(5, 4, 5, 0, 3), F), r14 = compareFactor(synth(5, 4, 5, 0, 4), F);
  assert.equal(r13.rated, 13); assert.equal(r13.shown, false); assert.equal(r13.reason, "rated");
  assert.equal(r14.rated, 14); assert.equal(r14.shown, true);
});
test("f: 3 vs 4 rough days in all", () => {
  const r3 = compareFactor(synth(7, 3, 7, 0, 0), F), r4 = compareFactor(synth(7, 4, 7, 0, 0), F);
  assert.equal(r3.shown, false); assert.equal(r3.reason, "rough");
  assert.equal(r4.shown, true);
});
test("f: a difference of 0.19 vs 0.20 (ratio well above 1.3)", () => {
  const a = compareFactor(synth(100, 59, 100, 40), F), b = compareFactor(synth(100, 60, 100, 40), F);
  assert.ok(a.ratio > 1.4 && b.ratio > 1.4);
  assert.equal(a.shown, false); assert.equal(a.reason, "small");
  assert.equal(b.shown, true, "0.6 - 0.4 is 0.2 even in floating point");
});
test("f: a ratio of 1.29 vs 1.3 (difference at least 0.20)", () => {
  const a = compareFactor(synth(31, 28, 10, 7), F), b = compareFactor(synth(15, 13, 15, 10), F);
  assert.ok(a.diff >= 0.2 && a.ratio < 1.3 && a.ratio > 1.29);
  assert.equal(a.shown, false);
  assert.ok(b.diff >= 0.2 - 1e-9 && Math.abs(b.ratio - 1.3) < 1e-9);
  assert.equal(b.shown, true);
});
test("f: card words put the side with more rough days first, in natural frequencies", () => {
  const res = compareFactor(synth(6, 1, 10, 8), F);
  const w = cardWords(res, ["days you drank less than your goal", "days you reached it"]);
  assert.equal(w.text, "Rough days came on 8 of 10 days you reached it, and 1 of 6 days you drank less than your goal.");
  assert.equal(w.num, "8 of 10");
  assert.deepEqual(w.parts.filter((x) => typeof x !== "string"), [{ b: "8 of 10" }, { b: "1 of 6" }]);
});

/* ================= f. day rows ================= */
test("f: 'exercised the day before' needs the calendar day before to be logged", () => {
  const p = on();
  p.days[ago(5)] = { rating: 2, move: [{ id: "s1", t: "10:00", mode: "walk", step: 1, warm: 5, main: 10, cool: 5 }] };
  p.days[ago(3)] = { rating: 2 }; // ago(4) not logged → ago(3) unknown
  p.days[ago(2)] = { rating: 2 };
  p.days[ago(1)] = { rating: 3, move: [{ id: "s2", t: "10:00", mode: "walk", step: 1, warm: 5, main: 10, cool: 5 }] };
  const by = Object.fromEntries(rowsOf(p, ago(5), TODAY).map((r) => [r.date, r]));
  assert.equal(by[ago(4)].movedPrev, true);
  assert.equal(by[ago(3)].movedPrev, null, "a non-consecutive day is unknown");
  assert.equal(by[ago(2)].movedPrev, false);
  assert.equal(by[ago(0)].movedPrev, true);
  // Before she has ever logged a session, no day is known to be "didn't exercise".
  const none = on();
  none.days[ago(2)] = { rating: 2 }; none.days[ago(1)] = { rating: 3 };
  assert.ok(rowsOf(none, ago(2), TODAY).every((r) => r.movedPrev === null));
  assert.ok(!factorList(cleanPots(none), rowsOf(none, ago(2), TODAY)).some((f) => f.key === "moved"));
});
test("f: dose timing: an unlogged slot is unknown, a skipped or far-off one is 'no'", () => {
  const p = on();
  p.meds = [{ id: "m1", lib: "mido", name: "Midodrine", kind: "rx", times: ["08:00", "20:00"], note: "", started: ago(20), stopped: null }];
  const dose = (id, slot, t, state = "taken") => ({ id, medId: "m1", slot, t, state });
  p.days[ago(5)] = { doses: [dose("a", "08:00", "09:55"), dose("b", "20:00", "18:05")] };
  p.days[ago(4)] = { doses: [dose("c", "08:00", "08:10")] };
  p.days[ago(3)] = { doses: [dose("d", "08:00", "08:10"), dose("e", "20:00", "20:00", "skipped")] };
  p.days[ago(2)] = { doses: [dose("f", "08:00", "11:00"), dose("g", "20:00", "20:00")] };
  p.days[ago(30)] = { doses: [dose("h", "08:00", "08:00"), dose("i", "20:00", "20:00")] }; // before she started it
  const by = Object.fromEntries(rowsOf(p, ago(30), TODAY).map((r) => [r.date, r]));
  assert.equal(by[ago(5)].medWithin.m1, true); assert.equal(by[ago(5)].medsWithin2h, true);
  assert.equal(by[ago(4)].medWithin.m1, null, "an unlogged dose is unknown"); assert.equal(by[ago(4)].medsWithin2h, null);
  assert.equal(by[ago(3)].medWithin.m1, false);
  assert.equal(by[ago(2)].medWithin.m1, false, "3 hours from its time is outside 2 hours");
  assert.ok(!("m1" in by[ago(30)].medWithin), "not active before its start date");
  const f = factorList(cleanPots(p), rowsOf(p, ago(30), TODAY)).find((x) => x.key === "med:m1");
  assert.match(f.phrases[0], /within 2 hours/);
  for (const s of [...f.phrases, f.name]) { assertClean(s, "med factor"); assert.ok(!/\b(late|missed)\b/i.test(s)); }
});
test("f: 'less than usual' needs 10 logged days when no goal is set (9 vs 10)", () => {
  const p = on();
  for (let i = 0; i < 9; i++) p.days[ago(i)] = { rating: 2, intake: [{ id: `i${i}`, t: "09:00", kind: "water", label: "Glass", ml: 500 + i * 100 }] };
  let rows = rowsOf(p, ago(29), TODAY);
  assert.ok(rows.every((r) => r.belowFluidGoal === null && r.fluidBasis === null));
  assert.equal(factorList(cleanPots(p), rows).find((f) => f.key === "fluid").missing, "set a goal, or log drinks on 10 days, to compare");
  p.days[ago(9)] = { rating: 2, intake: [{ id: "i9", t: "09:00", kind: "water", label: "Glass", ml: 1400 }] };
  rows = rowsOf(p, ago(29), TODAY);
  const logged = rows.filter((r) => r.fluidMl != null);
  assert.equal(logged.length, 10);
  assert.ok(logged.every((r) => r.fluidBasis === "usual"));
  assert.equal(logged.filter((r) => r.belowFluidGoal).length, 5, "below the median of 10 days");
  assert.ok(rows.filter((r) => r.fluidMl == null).every((r) => r.belowFluidGoal === null), "a day with no drinks logged is unknown, never 'below'");
  assert.match(factorList(cleanPots(p), rows).find((f) => f.key === "fluid").phrases[0], /less than usual/);
});
test("f: sleep: a check-in 'fair' alone is unknown, 'poor' counts, her POTS answer wins either way", () => {
  const p = on();
  p.days[ago(1)] = { sleep: "good" };
  p.days[ago(2)] = { sleep: "poor" };
  const checkins = [{ date: ago(0), sleepQ: "fair", sym: {} }, { date: ago(1), sleepQ: "poor", sym: {} }, { date: ago(2), sleepQ: "good", sym: {} }, { date: ago(3), sleepQ: "poor", sym: {} }, { date: ago(4), sleepQ: "good", sym: {} }];
  const by = Object.fromEntries(rowsOf(p, ago(5), TODAY, { stage: "peri", days: checkins }).map((r) => [r.date, r]));
  assert.equal(by[ago(0)].sleepPoor, null);
  assert.equal(by[ago(1)].sleepPoor, false, "her 'Slept well' overrides a check-in 'poor'");
  assert.equal(by[ago(2)].sleepPoor, true, "her 'Rough night' overrides a check-in 'good'");
  assert.equal(by[ago(3)].sleepPoor, true);
  assert.equal(by[ago(4)].sleepPoor, false);
  assert.equal(by[ago(5)].sleepPoor, null, "no answer anywhere is unknown");
  // Pregnancy entries have no sleepQ.
  const preg = Object.fromEntries(rowsOf(p, ago(3), TODAY, { stage: "preg", pregLog: { [ago(3)]: { sym: { dzy: 2 } } } }).map((r) => [r.date, r]));
  assert.equal(preg[ago(3)].sleepPoor, null);
});
test("f: hot flashes count only from a perimenopause check-in, and not from the quick check-in's combined question", () => {
  const p = on();
  const checkins = [{ date: ago(0), sym: { hf: 2 } }, { date: ago(1), sym: { hf: 1 } }, { date: ago(2), sym: { hf: 3 }, __q: { hf: 3 } }];
  const by = Object.fromEntries(rowsOf(p, ago(3), TODAY, { stage: "peri", days: checkins }).map((r) => [r.date, r]));
  assert.equal(by[ago(0)].hfDay, true); assert.equal(by[ago(1)].hfDay, false); assert.equal(by[ago(2)].hfDay, null); assert.equal(by[ago(3)].hfDay, null);
  assert.ok(rowsOf(p, ago(1), TODAY, { stage: "periods", days: checkins }).every((r) => r.hfDay === null));
});

/* ================= f. good vs rough ================= */
test("f: good vs rough needs 4 of each (3 vs 4), and a row with fewer than 3 values a side shows '—'", () => {
  const p = on();
  const put = (n, rating, ml) => { p.days[ago(n)] = { rating, ...(ml ? { intake: [{ id: `i${n}`, t: "09:00", kind: "water", label: "Glass", ml }] } : {}), ...(n < 2 ? { sleep: "poor" } : {}) }; };
  [1, 2, 3].forEach((n) => put(n, 1, 2000));
  [4, 5, 6, 7].forEach((n) => put(n, 3, 800));
  let g = goodVsRough(rowsOf(p, ago(29), TODAY), cleanPots(p));
  assert.deepEqual(g, { wait: GVR_WAIT, nGood: 3, nRough: 4 });
  put(8, 1, null);
  g = goodVsRough(rowsOf(p, ago(29), TODAY), cleanPots(p));
  assert.equal(g.nGood, 4); assert.equal(g.nRough, 4);
  const fluid = g.rows.find((r) => r.label === "Average fluids (days logged)");
  assert.equal(fluid.good, "2 L"); assert.equal(fluid.rough, "0.8 L");
  const sleep = g.rows.find((r) => r.label === "A poor night before");
  assert.equal(sleep.good, "—", "only 1 good day has a sleep answer"); assert.equal(sleep.rough, "—");
  assert.equal(g.rows[0].label, "Average fluids (days logged)", "rows are ordered by size of difference; '—' rows last");
  assert.ok(!g.rows.some((r) => /watch or ring/.test(r.label)), "no watch or ring rows without readings");
});

/* ================= f. cycle groups ================= */
const STARTS = [ago(78), ago(50), ago(22)];
test("f: cycle groups from logged starts: before the first start and after the last period are unknown", () => {
  assert.equal(cycleGroupOn(ago(79), STARTS), null, "before the first start");
  assert.equal(cycleGroupOn(ago(78), STARTS), "period");
  assert.equal(cycleGroupOn(ago(74), STARTS), "period");
  assert.equal(cycleGroupOn(ago(73), STARTS), "other");
  assert.equal(cycleGroupOn(ago(57), STARTS), "weekBefore");
  assert.equal(cycleGroupOn(ago(51), STARTS), "weekBefore");
  assert.equal(cycleGroupOn(ago(18), STARTS), "period");
  assert.equal(cycleGroupOn(ago(17), STARTS), null, "the last cycle isn't complete, so its later days are unknown");
  assert.equal(cycleGroupOn(TODAY, []), null);
});
function cycleLog() {
  const p = on();
  for (let i = 0; i < 90; i++) {
    const d = ago(i), g = cycleGroupOn(d, STARTS);
    p.days[d] = { rating: g === "weekBefore" ? (i % 3 ? 4 : 2) : g === "period" ? (i % 2 ? 3 : 1) : i % 5 ? 1 : 3 };
  }
  return cleanPots(p);
}
test("f: cycle groups shown with 2 starts in 120 days and 2 completed cycles; 1 start is not enough", () => {
  const p = cycleLog(), rows = dayRows(p, { from: ago(89), to: TODAY });
  const c = cycleGroups(rows, STARTS, { stage: "periods", stageName: "My Cycle", today: TODAY });
  assert.equal(c.shown, true); assert.equal(c.k, 2);
  assert.match(c.sentence, /^From 2 cycles, rough POTS days came on: Period days \d+ of \d+ · Week before your period \d+ of 14 · Other days \d+ of \d+\.$/);
  assert.equal(c.urgency, "visit"); assert.equal(c.top, "weekBefore");
  const one = cycleGroups(rows, [ago(130), ago(50)], { stage: "periods", stageName: "My Cycle", today: TODAY });
  assert.equal(one.shown, false); assert.equal(one.wait, CYCLE_WAIT);
  const twoRecentOneCycle = cycleGroups(rows, [ago(40), ago(12)], { stage: "periods", stageName: "My Cycle", today: TODAY });
  assert.equal(twoRecentOneCycle.shown, false, "only one completed cycle");
  assert.equal(cycleGroups(rows, STARTS, { stage: "peri", stageName: "Perimenopause", today: TODAY }).shown, true);
  assert.equal(cycleGroups(rows, STARTS, { stage: "peri", stageName: "Menopause", today: TODAY }), null, "no cycle card in Menopause");
  assert.equal(cycleGroups(rows, STARTS, { stage: "preg", stageName: "Pregnancy", today: TODAY }), null, "no cycle card in pregnancy");
  // A group under 4 rated days says so.
  const sparse = cleanPots({ ...p, days: Object.fromEntries(Object.entries(p.days).filter(([d]) => cycleGroupOn(d, STARTS) !== "period" || d >= ago(20))) });
  const s2 = cycleGroups(dayRows(sparse, { from: ago(89), to: TODAY }), STARTS, { stage: "periods", stageName: "My Cycle", today: TODAY });
  assert.match(s2.sentence, /Period days not enough days yet/);
});
test("f: cycle day: day 1 is the start, shown up to 45 days after it; only in a cycle stage", () => {
  assert.equal(cycleDayOn(ago(22), STARTS), 1);
  assert.equal(cycleDayOn(ago(0), STARTS), 23);
  assert.equal(cycleDayOn(addDays(ago(22), 44), STARTS), 45);
  assert.equal(cycleDayOn(addDays(ago(22), 45), STARTS), 46);
  assert.equal(cycleDayOn(addDays(ago(22), 46), STARTS), null);
  assert.equal(cycleDayOn(ago(80), STARTS), null, "before the first start");
  assert.deepEqual(cycleLabelOn(ago(52), STARTS, "periods", "My Cycle"), { day: 27, weekBefore: true });
  assert.deepEqual(cycleLabelOn(ago(60), STARTS, "peri", "Perimenopause"), { day: 19, weekBefore: false });
  assert.equal(cycleLabelOn(ago(52), STARTS, "peri", "Menopause"), null);
  assert.equal(cycleLabelOn(ago(52), STARTS, "preg", "Pregnancy"), null);
  assert.ok(isCycleStage("periods", "Trying to Conceive") && !isCycleStage("peri", "Menopause") && !isCycleStage("preg"));
});

/* ================= f. medicines ================= */
test("f: medicine since starting needs 5 rated days on each side (4 vs 5)", () => {
  const p = on(), start = ago(14);
  p.meds = [{ id: "m1", lib: "prop", name: "Propranolol", kind: "rx", times: [], note: "", started: start, stopped: null }];
  for (let i = 1; i <= 4; i++) p.days[addDays(start, -i)] = { rating: i % 2 ? 3 : 1 };
  for (let i = 0; i < 7; i++) p.days[addDays(start, i)] = { rating: i < 2 ? 3 : 1 };
  let r = medBeforeAfter(cleanPots(p), p.meds[0], rowsOf(p, ago(40), TODAY));
  assert.equal(r.ready, false); assert.equal(r.need, 1);
  p.days[addDays(start, -10)] = { rating: 1 };
  r = medBeforeAfter(cleanPots(p), p.meds[0], rowsOf(p, ago(40), TODAY));
  assert.deepEqual(r, { ready: true, before: { a: 2, n: 5 }, after: { b: 2, m: 7 } });
});
test("f: episodes by time since a dose need 7 dosed days and 10 episodes", () => {
  const p = on(), med = { id: "m1", lib: "mido", name: "Midodrine", kind: "rx", times: ["08:00"], note: "", started: null, stopped: null };
  p.meds = [med];
  for (let i = 0; i < 7; i++) {
    p.days[ago(i)] = { doses: [{ id: `d${i}`, medId: "m1", slot: "08:00", t: "08:00", state: "taken" }],
      eps: [{ id: `e${i}`, t: i < 3 ? "07:00" : "09:30", sym: ["p_dzy"] }, ...(i < 2 ? [{ id: `f${i}`, t: "15:00", sym: ["p_dzy"] }] : [])] };
  }
  p.days[ago(10)] = { eps: [{ id: "x1", t: "09:00", sym: ["p_dzy"] }] }; // no dose that day: not counted
  const q = cleanPots(p), rows = dayRows(q, { from: ago(29), to: TODAY });
  assert.equal(episodesByDose(q, med, rows), null, "9 episodes on dosed days");
  q.days[ago(6)].eps.push({ id: "z", t: "12:30", sym: ["p_dzy"], trig: [], helped: [], note: "", injured: false });
  const e = episodesByDose(q, med, rows);
  assert.deepEqual(e.buckets.map((b) => b.n), [3, 4, 0, 1, 2]);
  assert.equal(e.text, "Episodes by time since a Midodrine dose (10 episodes on 7 days with a dose logged): before the first dose 3 · 0–2 h 4 · 2–4 h 0 · 4–6 h 1 · 6 h or more 2.");
  const six = cleanPots({ ...q, days: Object.fromEntries(Object.entries(q.days).filter(([d]) => d !== ago(1))) });
  assert.equal(episodesByDose(six, med, dayRows(six, { from: ago(29), to: TODAY })), null, "6 dosed days");
});

/* ================= f. the "repeated" badge, wearables and the per-symptom outcome ================= */
test("f: 'Seen last month too' when the 30 days before pass the gates in the same direction", () => {
  const p = rich({ days: 60 });
  const pat = patterns(p, { window: "30", today: TODAY, stage: "peri", stageName: "Perimenopause" });
  const fluid = pat.cards.find((c) => c.key === "fluid");
  assert.ok(fluid, "the fluid card shows");
  assert.equal(fluid.repeated, true);
  assert.match(fluid.text, /^Rough days came on \d+ of \d+ days you drank less than your goal, and \d+ of \d+ days you reached it\.$/);
  assert.equal(fluid.urgency, "self");
  const short = patterns(rich({ days: 30 }), { window: "30", today: TODAY, stage: "peri", stageName: "Perimenopause" });
  assert.equal(short.cards.find((c) => c.key === "fluid").repeated, false, "nothing logged the month before");
  assert.ok(pat.cards.length <= THRESH.pat.cards);
  assert.equal(pat.footer, PATTERN_FOOT);
});
test("f: card advice: 'test on purpose' only for what she can safely vary herself", () => {
  // IV fluids every third day, good days after them and rough days otherwise.
  let p = turnOn(freshEmpty(), { day: "2026-09-11" });
  for (let i = 0; i < 30; i++) {
    const d = addDays(TODAY, -i);
    if (i % 3 === 1) p = setIv(p, d, { ml: 1000 });
    p = setRating(p, d, (i + 1) % 3 === 1 ? 1 : 3);
  }
  const iv = patterns(p, { window: "30", today: TODAY, stage: "periods" }).cards.find((c) => c.key === "iv");
  assert.ok(iv, "the IV card shows");
  assert.equal(iv.urgency, "visit");
  assert.match(iv.advice, /don't change when you have them on your own/);
  const SELF = /testing on purpose/;
  for (const key of ["iv", "fluid", "sodium", "moved", "trig:t_period", "trig:t_premens", "hf"]) assert.ok(!SELF.test(adviceFor({ kind: "plain", key }).advice), key);
  assert.ok(!SELF.test(adviceFor({ kind: "wear", key: "wear:rhr" }).advice));
  assert.match(adviceFor({ kind: "plain", key: "sodium" }).advice, /only with your clinician's OK/);
  assert.equal(adviceFor({ kind: "plain", key: "trig:t_period" }).advice, "Worth mentioning at your next visit.");
  for (const key of ["sleep", "heat", "trig:t_shower", "aid:m1"]) assert.match(adviceFor({ kind: "plain", key }).advice, SELF, key);
  assert.equal(adviceFor({ kind: "med", key: "med:m1" }).urgency, "visit");
  for (const key of ["iv", "fluid", "sodium", "moved", "hf", "sleep"]) assert.ok(!POTS_BANNED.test(adviceFor({ kind: "plain", key }).advice), key);
});
test("f: watch and ring provenance: HRV only with one connected source, over its rows; RHR over the dominant source", () => {
  const p = rich({ days: 40 });
  const wearData = [];
  for (let i = 0; i < 40; i++) {
    const rough = p.days[ago(i)].rating >= 3;
    wearData.push({ date: ago(i), rhr: rough ? 78 : 62, hrv: rough ? 30 : 55, sleep: rough ? 60 : 85, sourceId: i < 34 ? "oura" : "terra" });
  }
  const rows = dayRows(p, { from: ago(29), to: TODAY, wearData });
  const two = factorList(p, rows, { connected: ["oura", "healthkit"] });
  assert.equal(two.find((f) => f.key === "wear:hrv").missing, "compared only when exactly one watch or ring is connected");
  const one = factorList(p, rows, { connected: ["terra"] });
  const hrv = one.find((f) => f.key === "wear:hrv");
  assert.equal(hrv.src, "terra");
  assert.ok(rows.filter((r) => r.wearSource === "oura").every((r) => hrv.fn(r) === null), "HRV uses only the connected source's rows");
  const rhr = one.find((f) => f.key === "wear:rhr");
  assert.equal(rhr.src, "oura", "resting heart rate uses the window's dominant source");
  assert.equal(rhr.minPaired, 14);
  assert.ok(rows.filter((r) => r.wearSource === "terra").every((r) => rhr.fn(r) === null));
  // Demo rows are never compared.
  assert.ok(dayRows(p, { from: ago(29), to: TODAY, wearData: wearData.map((w) => ({ ...w, demo: true })) }).every((r) => r.rhr === null));
  // On screen: at most one watch or ring card, tagged with its source.
  const pat = patterns(p, { window: "30", today: TODAY, stage: "peri", stageName: "Perimenopause", wearData, connected: ["oura"] });
  const wear = pat.cards.filter((c) => c.kind === "wear");
  assert.ok(wear.length <= 1);
  if (wear.length) assert.equal(wear[0].src, "oura");
  // Third person (the report) never has watch or ring factors, even when rows carry readings.
  assert.ok(!factorList(p, rows, { connected: ["oura"] }, { you: false }).some((f) => f.kind === "wear"));
});
test("f: per-symptom outcome: offered from 10 days; a day with no symptom entries is left out, not 'absent'", () => {
  const p = rich({ days: 60 });
  const pat = patterns(p, { window: "30", today: TODAY, outcome: "p_dzy" });
  assert.deepEqual(pat.outcomes.map((o) => o.id), ["p_dzy"]);
  assert.equal(pat.outcome, "p_dzy");
  assert.equal(pat.footer, `${PATTERN_FOOT} ${SYMPTOM_FOOT}`);
  for (const c of pat.cards) assert.match(c.text, /^Dizzy or lightheaded was moderate or strong on /);
  // Drop the symptoms from 5 days: those days leave the comparison.
  const q = cleanPots({ ...p, days: Object.fromEntries(Object.entries(p.days).map(([d, x], i) => [d, i < 5 ? { ...x, sym: {} } : x])) });
  const rowsQ = dayRows(q, { from: ago(29), to: TODAY });
  const out = (r) => (r.symAny ? (r.symSev.p_dzy || 0) >= 2 : null);
  const f = { key: "all", fn: () => true };
  assert.equal(compareFactor(rowsQ, f, { outcome: out }).nE, rowsQ.filter((r) => r.symAny).length);
  assert.ok(rowsQ.filter((r) => r.symAny).length < 30);
  // Under 10 days a symptom isn't offered.
  const few = on();
  for (let i = 0; i < 9; i++) few.days[ago(i)] = { rating: 2, sym: { p_fog: 2 } };
  assert.deepEqual(patterns(cleanPots(few), { window: "30", today: TODAY }).outcomes, []);
});

/* ================= f. today, week, windows, tests ================= */
test("f: today's pace needs 7 earlier days with drinks (6 vs 7)", () => {
  const p = on();
  for (let i = 1; i <= 6; i++) p.days[ago(i)] = { intake: [{ id: `a${i}`, t: "09:00", kind: "water", ml: 500 }, { id: `b${i}`, t: "16:00", kind: "water", ml: 800 }] };
  assert.deepEqual(todayPace(cleanPots(p), TODAY, 14 * 60), { wait: PACE_WAIT, n: 6 });
  p.days[ago(7)] = { intake: [{ id: "a7", t: "08:00", kind: "water", ml: 1000 }] };
  p.days[TODAY] = { intake: [{ id: "t", t: "10:00", kind: "water", ml: 300 }] };
  assert.deepEqual(todayPace(cleanPots(p), TODAY, 14 * 60), { usualByNow: 500, today: 300, n: 7 });
  delete p.days[TODAY];
  assert.equal(todayPace(cleanPots(p), TODAY, 14 * 60).today, null, "nothing logged today is unknown, never 0");
});
test("f: this week vs last week needs 4 rated days in each (3 vs 4)", () => {
  const mk = (n, rough) => Array.from({ length: 7 }, (_, i) => ({ date: ago(i), rated: i < n, rough: i < n ? i < rough : null, rating: i < n ? (i < rough ? 3 : 1) : null }));
  assert.equal(weekSummary(mk(4, 2), mk(3, 1)).line, "Not enough rated days last week to compare.");
  assert.equal(weekSummary(mk(3, 2), mk(4, 1)).line, "Not enough rated days this week to compare.");
  const w = weekSummary(mk(4, 3), mk(5, 1));
  assert.equal(w.compare, true); assert.equal(w.line, "Rough days: 3 this week, 1 the week before.");
});
test("f: windows and 'Since you started' after more than 60 days", () => {
  assert.deepEqual(windowRange(on(), "7", TODAY), { from: ago(6), to: TODAY });
  assert.deepEqual(windowRange(on(), "30", TODAY), { from: ago(29), to: TODAY });
  assert.equal(sinceOffered(rich({ days: 60 }), TODAY), false);
  assert.equal(sinceOffered(rich({ days: 61 }), TODAY), true);
  assert.deepEqual(windowRange(rich({ days: 61 }), "all", TODAY), { from: ago(60), to: TODAY });
});
test("f: stand tests over time need 2 complete tests of one method, the median from 3", () => {
  const p = on();
  const t = (id, date, up10, method = "stand", status = "done") => ({ id, date, t: "08:00", upd: 1, method, restPos: "back", restMin: 5, sched: "1-3-5-10", bp: false, rest: [{ min: 4, hr: 70 }, { min: 5, hr: 70 }], up: [{ min: 1, atSec: 60, hr: 90 }, { min: 10, atSec: 600, hr: up10 }], feel: [], status });
  p.tests = [t("a", ago(9), 100), t("b", ago(6), 104, "lean"), t("c", ago(3), 96, "stand", "stopped")];
  assert.deepEqual(testGroups(cleanPots(p)), []);
  p.tests.push(t("d", ago(2), 110));
  let g = testGroups(cleanPots(p));
  assert.equal(g.length, 1); assert.deepEqual(g[0].rows.map((r) => r.rise), [30, 40]); assert.equal(g[0].median, null); assert.equal(g[0].thr, 30);
  p.tests.push(t("e", ago(1), 120));
  g = testGroups(cleanPots(p), { teen: true });
  assert.equal(g[0].median, 40); assert.equal(g[0].thr, 40);
});

/* ================= f. wording ================= */
test("f: every patterns string is free of diagnosis, dose and late/missed words, in every stage and window", () => {
  const p = rich({ days: 75 });
  const checkins = Array.from({ length: 75 }, (_, i) => ({ date: ago(i), sleepQ: i % 3 ? "good" : "poor", sym: { hf: i % 2 ? 2 : 0 } }));
  const wearData = Array.from({ length: 75 }, (_, i) => ({ date: ago(i), rhr: 60 + (i % 9), hrv: 40 + (i % 7), sleep: 70 + (i % 11), sourceId: "oura" }));
  const strings = [];
  const walk = (x) => { if (typeof x === "string") strings.push(x); else if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object" && !(x instanceof Set)) Object.values(x).forEach(walk); };
  for (const [stage, stageName] of [["peri", "Perimenopause"], ["peri", "Menopause"], ["periods", "My Cycle"], ["preg", "Pregnancy"]]) {
    for (const window of ["today", "7", "30", "all"]) {
      for (const outcome of [null, "p_dzy"]) {
        const pat = patterns(p, { window, today: TODAY, stage, stageName, starts: STARTS, days: checkins, wearData, connected: ["oura"], outcome, nowMin: 600 });
        walk({ ...pat, rows: null });
      }
    }
  }
  assert.ok(strings.length > 100);
  for (const s of strings) assertClean(s, "patterns");
});

/* ================= report: Patterns, cycle pattern, cycle days ================= */
function reportLog() {
  const p = rich({ days: 60 });
  p.tests = [{ id: "t1", date: ago(52), t: "08:30", upd: 1, method: "stand", restPos: "back", restMin: 5, sched: "1-3-5-10", bp: false, rest: [{ min: 4, hr: 66 }, { min: 5, hr: 70 }], up: [{ min: 1, atSec: 60, hr: 88 }, { min: 3, atSec: 180, hr: 96 }, { min: 5, atSec: 300, hr: 101 }, { min: 10, atSec: 600, hr: 104 }], feel: [], status: "done" }];
  return cleanPots(p);
}
/** reportLog with every rated day in the week before a period rated Bad and the rest Good:
    rough days lean far more than 25 points towards the week before. */
function leanLog() {
  const p = reportLog();
  for (const [d, x] of Object.entries(p.days)) x.rating = cycleGroupOn(d, STARTS) === "weekBefore" ? 4 : 1;
  return cleanPots(p);
}
const ropts = (over = {}) => ({ period: "90", today: TODAY, stage: "periods", stageName: "My Cycle", starts: STARTS, ...over });
test("report: 'Patterns from her log' lists what stood out, in the third person, with the chance footer", () => {
  const m = reportModel(reportLog(), ropts());
  const sec = m.sections.find((s) => s.id === "patterns");
  assert.equal(sec.title, "Patterns from her log");
  assert.equal(sec.blocks[0].text, "Observations, not causes.");
  assert.ok(sec.blocks[1].items.some((t) => /days she drank less than her goal/.test(t)));
  assert.ok(!sec.blocks[1].items.some((t) => /\byou\b|\byour\b/i.test(t)));
  assert.equal(sec.blocks.at(-1).text, REPORT_FOOT);
  const off = reportModel(reportLog(), ropts({ include: { patterns: false } }));
  assert.ok(!off.sections.some((s) => s.id === "patterns" || s.id === "cycle"));
  for (const s of modelTexts(m)) assertClean(s, "report");
});
test("report: cycle days and the cycle pattern only with 'Cycle or pregnancy details', in a cycle stage", () => {
  const m = reportModel(reportLog(), ropts());
  const csv = toCSV(m);
  assert.match(csv, /cycle_day=27; week_before_period=yes/);
  assert.ok(m.sections.find((s) => s.id === "tests").blocks.find((b) => b.t === "table").rows[0].at(-1).includes("Cycle day 27 (week before her period)"));
  const cyc = m.sections.find((s) => s.id === "cycle");
  assert.equal(cyc.title, "Cycle pattern");
  assert.match(cyc.blocks[1].text, /^From 2 cycles, rough POTS days came on: Period days .* Week before her period .* Other days /);
  // This log's rough days don't lean 25 points towards the period, so no cycle question.
  assert.ok(!m.questions.generated.some((q) => q.id === "q_cycle"));
  const lean = reportModel(leanLog(), ropts());
  assert.ok(lean.questions.generated.some((q) => q.id === "q_cycle" && q.stageBased && q.part.join() === "patterns,sym"));
  const off = reportModel(leanLog(), ropts({ include: { cycle: false } }));
  const csvOff = toCSV(off);
  assert.ok(!/cycle_day|week_before_period/.test(csvOff));
  assert.ok(!off.sections.some((s) => s.id === "cycle"));
  assert.ok(!modelTexts(off).some((t) => /Cycle day|cycle group|my period/.test(t)));
  assert.ok(off.questions.generated.some((q) => q.id === "q_cycle"), "on screen the cycle question still shows");
  assert.ok(!off.questions.generated.filter((q) => questionIn(q, off.inc)).some((q) => q.id === "q_cycle"), "but it stays out of the files");
  // Menopause and pregnancy: no cycle day, no cycle pattern.
  for (const [stage, stageName] of [["peri", "Menopause"], ["preg", "Pregnancy"]]) {
    const x = reportModel(reportLog(), ropts({ stage, stageName }));
    assert.ok(!/cycle_day/.test(toCSV(x)));
    assert.ok(!x.sections.some((s) => s.title === "Cycle pattern"));
  }
  const preg = reportModel(reportLog(), ropts({ stage: "preg", stageName: "Pregnancy" }));
  assert.equal(preg.sections.find((s) => s.id === "cycle").blocks[0].text, "POTS can get better, worse or stay the same in pregnancy, and it often changes after birth (Kimpinski et al., 2010).");
});
test("report: the cycle visit question follows the cycle card", () => {
  const q = (cycle) => visitQuestions(reportLog(), { stage: "periods", stageName: "My Cycle", cycle }).find((x) => x.id === "q_cycle");
  assert.equal(q({ shown: true, top: "weekBefore" }).text, "My symptoms seem worse the week before my period. Is that worth planning around?");
  assert.equal(q({ shown: true, top: "period" }).text, "My symptoms seem worse during my period. Is that worth planning around?");
  assert.equal(q({ shown: true, top: null }), undefined);
  assert.equal(q({ shown: false, wait: CYCLE_WAIT }), undefined);
});
test("report: episodes by time since a dose in the medicines section, with symptoms and episodes ticked", () => {
  const p = reportLog();
  for (let i = 0; i < 12; i++) p.days[ago(i)].eps = [{ id: `x${i}`, t: "10:00", sym: ["p_dzy"], sev: 2, pos: "standing", faint: "no", injured: false, mins: 5, trig: [], helped: [], note: "" }];
  const m = reportModel(cleanPots(p), ropts({ period: "30" }));
  assert.ok(m.sections.find((s) => s.id === "meds").blocks.some((b) => /^Episodes by time since a Midodrine dose/.test(b.text || "")));
  const noSym = reportModel(cleanPots(p), ropts({ period: "30", include: { sym: false } }));
  assert.ok(!noSym.sections.find((s) => s.id === "meds").blocks.some((b) => /^Episodes by time/.test(b.text || "")));
});
test("report: watch and ring rows handed in change nothing (patterns run without them)", () => {
  const wearData = Array.from({ length: 60 }, (_, i) => ({ date: ago(i), rhr: 58, hrv: 47, sleep: 81, sourceId: "oura" }));
  const a = reportModel(reportLog(), ropts()), b = reportModel(reportLog(), ropts({ wearData, connected: ["oura"], wearSources: { oura: {} } }));
  assert.equal(toCSV(a), toCSV(b));
  assert.deepEqual(modelTexts(a), modelTexts(b));
  assert.ok(!modelTexts(b).some((t) => /watch|ring|HRV|resting heart rate/i.test(t) && !/Watch and ring/.test(t)));
});
test("report: check-in sleep and hot flashes feed the report's patterns only with cycle details", () => {
  const p = reportLog();
  let reads = 0;
  const checkin = () => { reads++; return { sleepQ: "poor", sym: { hf: 2 } }; };
  reportModel(p, ropts({ stage: "peri", stageName: "Perimenopause", checkin, include: { cycle: false } }));
  assert.equal(reads, 0);
  reportModel(p, ropts({ stage: "peri", stageName: "Perimenopause", checkin }));
  assert.ok(reads > 0);
});

/* ================= review fixes (S6) ================= */
/** 60 days: a medicine with a time ("SecretMed", started 20 days ago, on time on some days and
    3 hours off on others), a leg compression support, drinks and salt under a goal on rough
    days, heat tags, and ratings. Everything Patterns can compare, so each part can be unticked. */
function partsLog() {
  const p = on();
  p.since = ago(59);
  p.settings.goals = { fluidMl: 2000, naMg: 2000, by: "clinician", set: ago(60) };
  p.meds = [
    { id: "m1", lib: null, name: "SecretMed", kind: "rx", times: ["08:00"], note: "", started: ago(20), stopped: null },
    { id: "a1", lib: "comp_leg", name: "Compression (leg)", kind: "aid", times: [], note: "", started: null, stopped: null },
  ];
  for (let i = 0; i < 60; i++) {
    const rough = i % 3 === 0;
    p.days[ago(i)] = {
      rating: rough ? 4 : 1,
      sym: { p_dzy: rough ? 3 : 1 },
      trig: rough ? ["t_heat", "t_stand"] : [],
      intake: [{ id: `a${i}`, t: "09:00", kind: "electrolyte", label: "Drink", ml: rough ? 600 : 2400, naMg: rough ? 400 : 2400 }],
      ...(i % 9 === 0 ? { iv: { ml: 1000, note: "" } } : {}),
      aids: { a1: !rough },
      ...(i < 20 ? { doses: [{ id: `d${i}`, medId: "m1", slot: "08:00", t: rough ? "11:30" : "08:05", state: "taken" }] } : {}),
    };
  }
  return cleanPots(p);
}
test("report: every pattern follows the part it draws on; no unticked part reaches a file through Patterns", () => {
  const p = partsLog();
  const run = (include) => reportModel(p, { period: "90", today: TODAY, stage: "peri", stageName: "Perimenopause", include });
  const all = run({});
  const pat = (m) => (m.sections.find((s) => s.id === "patterns") || { blocks: [] }).blocks.flatMap((b) => b.items || []).join("\n");
  assert.match(pat(all), /drank less than her goal|salt was under her goal/);
  assert.match(pat(all), /Before SecretMed: rough days/, "with every part ticked the medicine shows up in Patterns");
  // Medicines and supports unticked: no medicine or support name anywhere in the files.
  const noMeds = run({ meds: false });
  for (const t of [...modelTexts(noMeds), toCSV(noMeds)]) assert.ok(!/SecretMed|ompression/.test(t), t);
  assert.ok(pat(noMeds).length > 0, "the other observations stay");
  // Fluids and sodium unticked: no drink, salt or IV observation.
  const noFluid = run({ fluid: false });
  assert.ok(!/drank|salt was|IV fluids|goal/.test(pat(noFluid)), pat(noFluid));
  // Left-out factors are dropped before ranking, so the next ones in line take their places.
  assert.match(pat(noFluid), /days she tagged heat/);
  assert.match(pat(noFluid), /compression \(leg\)/);
  assert.ok(!modelTexts(noFluid).some((t) => /drank|salt was under|IV fluids/.test(t)));
  // Symptoms, ratings and episodes unticked: ratings are the outcome, so no Patterns, no cycle
  // pattern, no rough-day count and no cycle question anywhere.
  for (const stage of [["peri", "Perimenopause"], ["periods", "My Cycle"]]) {
    const noSym = reportModel(leanLog(), { period: "90", today: TODAY, stage: stage[0], stageName: stage[1], starts: STARTS, include: { sym: false } });
    assert.ok(!noSym.sections.some((s) => s.id === "patterns" || s.title === "Cycle pattern"), stage[1]);
    assert.ok(!modelTexts(noSym).some((t) => /rough|Rough|rated days|Rated days|my period/.test(t)), stage[1]);
    assert.ok(!/day_rating/.test(toCSV(noSym)));
    assert.ok(noSym.questions.generated.some((q) => q.id === "q_cycle"), "on screen the cycle question still shows");
    assert.ok(!noSym.questions.generated.filter((q) => questionIn(q, noSym.inc)).some((q) => q.id === "q_cycle"), "but not in the files");
  }
  // All three unticked: the reviewers' case (only tests and questions remain).
  const none = run({ meds: false, fluid: false, sym: false });
  assert.deepEqual(none.sections.map((s) => s.id), ["tests", "questions"]);
  assert.ok(!modelTexts(none).some((t) => /SecretMed|ompression|drank|Rough days/.test(t)));
  // factorPart: which box each factor follows.
  assert.equal(factorPart({ key: "fluid", kind: "plain" }), "fluid");
  assert.equal(factorPart({ key: "iv", kind: "plain" }), "fluid");
  assert.equal(factorPart({ key: "med:m1", kind: "med" }), "meds");
  assert.equal(factorPart({ key: "aid:a1", kind: "plain" }), "meds");
  assert.equal(factorPart({ key: "trig:t_stand", kind: "plain" }), "sym");
  assert.equal(factorPart({ key: "moved", kind: "plain" }), "move");
  for (const s of [...modelTexts(all), ...modelTexts(noMeds), ...modelTexts(noFluid)]) assertClean(s, "report parts");
});
test("report: a medicine's before and after days come from the report period only", () => {
  const p = on();
  p.since = ago(199);
  p.meds = [{ id: "m1", lib: "ivab", name: "Ivabradine", kind: "rx", times: [], note: "", started: ago(150), stopped: null }];
  for (let i = 0; i < 200; i++) p.days[ago(i)] = { rating: i > 150 ? 4 : 1 };
  const q = cleanPots(p);
  const texts = (period) => modelTexts(reportModel(q, { period, today: TODAY })).join("\n");
  assert.ok(!/Before Ivabradine/.test(texts("30")), "a start 150 days ago is outside a 30-day report");
  assert.ok(!/Before Ivabradine/.test(texts("90")));
  assert.match(texts("all"), /Before Ivabradine: rough days 14 of 14\. Since: 0 of 14\./);
  // On screen, "Medicines since starting" isn't tied to the window.
  assert.ok(patterns(q, { window: "30", today: TODAY }).meds[0].beforeAfter.ready);
  // A start inside the period but near its first day compares only the period's own days.
  const p2 = on();
  p2.since = ago(59);
  p2.meds = [{ id: "m1", lib: null, name: "Nearstart", kind: "rx", times: [], note: "", started: ago(25), stopped: null }];
  for (let i = 0; i < 60; i++) p2.days[ago(i)] = { rating: i > 25 ? 4 : 1 };
  const m30 = reportModel(cleanPots(p2), { period: "30", today: TODAY });
  // 4 rated days before the start are inside the period (ago(29)..ago(26)): under 5, so no line.
  assert.ok(!modelTexts(m30).some((t) => /Before Nearstart/.test(t)));
  assert.match(modelTexts(reportModel(cleanPots(p2), { period: "90", today: TODAY })).join("\n"), /Before Nearstart: rough days 14 of 14\. Since: 0 of 14\./);
});
test("cycle question: only when the lead is at least 25 points (the card's visit rule)", () => {
  const starts = [ago(84), ago(56), ago(28), ago(0)];
  const rowsWith = (share) => {
    const out = [], seen = { period: 0, weekBefore: 0, other: 0 }, tot = { period: 0, weekBefore: 0, other: 0 };
    for (let i = 89; i >= 0; i--) { const g = cycleGroupOn(ago(i), starts); if (g) tot[g]++; }
    for (let i = 89; i >= 0; i--) {
      const d = ago(i), g = cycleGroupOn(d, starts);
      const k = g ? seen[g]++ : 0;
      out.push({ date: d, rated: true, rough: g ? k < Math.round(share[g] * tot[g]) : false });
    }
    return out;
  };
  const opts = { stage: "periods", stageName: "My Cycle", today: TODAY };
  const small = cycleGroups(rowsWith({ period: 0.44, weekBefore: 0.33, other: 0.33 }), starts, opts);
  assert.equal(small.shown, true); assert.equal(small.urgency, "self"); assert.equal(small.top, null);
  const mid = cycleGroups(rowsWith({ period: 0.5, weekBefore: 0.34, other: 0.34 }), starts, opts);
  assert.equal(mid.urgency, "self"); assert.equal(mid.top, null);
  const big = cycleGroups(rowsWith({ period: 0.63, weekBefore: 0.33, other: 0.33 }), starts, opts);
  assert.equal(big.urgency, "visit"); assert.equal(big.top, "period");
  const q = (cycle) => visitQuestions(reportLog(), { stage: "periods", stageName: "My Cycle", cycle }).some((x) => x.id === "q_cycle");
  assert.equal(q(small), false); assert.equal(q(mid), false); assert.equal(q(big), true);
});
test("today isn't over: its drinks and salt so far are never compared with a goal or the usual", () => {
  const p = on();
  p.settings.goals = { fluidMl: 2000, naMg: null, by: "me", set: ago(30) };
  for (let i = 0; i < 12; i++) p.days[ago(i)] = { rating: 2, intake: [{ id: `a${i}`, t: "09:00", kind: "water", label: "Glass", ml: i === 0 ? 250 : 2500, naMg: i === 0 ? 100 : 1000 }] };
  const q = cleanPots(p);
  const withToday = dayRows(q, { from: ago(11), to: TODAY, today: TODAY });
  const last = withToday.at(-1);
  assert.equal(last.partial, true);
  assert.equal(last.fluidMl, 250, "the total so far is still shown");
  assert.equal(last.belowFluidGoal, null);
  assert.equal(last.belowNaGoal, null, "the median fallback leaves today out too");
  assert.equal(withToday[0].belowNaGoal, false, "earlier days still compare with the median of the earlier days");
  const asPast = dayRows(q, { from: ago(11), to: TODAY });
  assert.equal(asPast.at(-1).belowFluidGoal, true, "a finished day is compared as before");
  // The 30-day window passes today through.
  assert.equal(patterns(q, { window: "30", today: TODAY }).rows.at(-1).partial, true);
});
test("the period tags read as sentences, on screen and in the third-person report", () => {
  const p = on();
  for (let i = 0; i < 30; i++) p.days[ago(i)] = { rating: i % 4 === 0 ? 4 : 1, trig: i % 4 === 0 ? ["t_period", "t_premens"] : [] };
  const q = cleanPots(p), rows = dayRows(q, { from: ago(29), to: TODAY });
  const ph = (you) => Object.fromEntries(factorList(q, rows, {}, { you }).filter((f) => f.key.startsWith("trig:")).map((f) => [f.key, f.phrases]));
  assert.deepEqual(ph(true)["trig:t_period"], ["days you were on your period", "other days"]);
  assert.deepEqual(ph(false)["trig:t_period"], ["days she was on her period", "other days"]);
  assert.deepEqual(ph(true)["trig:t_premens"], ["days in the week before your period", "other days"]);
  assert.deepEqual(ph(false)["trig:t_premens"], ["days in the week before her period", "other days"]);
  const texts = patterns(q, { window: "30", today: TODAY }).cards.map((c) => c.text).join("\n");
  assert.ok(!/tagged on my period|tagged week before my period/i.test(texts), texts);
});
test("dayRows' cycle index gives the same group and cycle day as cycleGroupOn and cycleDayOn", () => {
  const starts = [ago(140), ago(112), ago(80), ago(51), ago(22), ago(22), "bad", ago(3)];
  const rows = dayRows(cleanPots(on()), { from: ago(170), to: addDays(TODAY, 10), starts });
  for (const r of rows) {
    assert.equal(r.cycleGroup, cycleGroupOn(r.date, starts), r.date);
    assert.equal(r.cycleDay, cycleDayOn(r.date, starts), r.date);
  }
});

/* ================= source ================= */
test("source: potsPatterns.js makes no network or storage call", () => {
  const text = readFileSync(new URL("./potsPatterns.js", import.meta.url), "utf8");
  for (const bad of ["fetch(", "apiPost", "apiGet", "contribute(", "localStorage", "sessionStorage", "indexedDB", "structuredClone", "XMLHttpRequest", "WebSocket", "sendBeacon"]) assert.ok(!text.includes(bad), `potsPatterns.js contains ${bad}`);
  assert.ok(!/from\s+["'][^"']*\/(api|pulse|storage|notifications|wearables)\.js["']/.test(text));
  assert.ok(!text.includes("regAnswers"));
});
