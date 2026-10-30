// calm R6: the Patterns tab's pure logic (lib/patterns.js) and the weekly review / experiments (lib/experiments.js).
// Run: node --test src/lib/patterns.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PATTERN_RULES, statusOf, EMPTY_LINE, NOT_ADVICE, usualOf, bandOf, bandCounts, bandWords, bandTrend, bodyRing, mindRing, RING_RULES, ringInputs,
  cycleTimeline, sleepCards, cycleCards, questionSides, pcosCards, trialCards, rankCards, TRIAL_MIN, BAND,
} from "./patterns.js";
import {
  EXPERIMENTS, cleanExperiments, settle, startExperiment, skipWeek, markDay, stopExperiment, runningOn, experimentStep, reviewWeek, weekCounts, countWords,
  weekSignals, pickExperiment, experimentFollowUp, lastFinished, experimentSources, EXP_DAYS,
} from "./experiments.js";
import { addDays } from "./engine.js";
import { MODULES } from "./modules.js";

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const T = "2026-10-29"; // a Thursday

test("statusOf: the thresholds are named and honest about small samples", () => {
  assert.deepEqual({ ...PATTERN_RULES }, { minEach: 5, minHits: 4, minRatio: 1.3, minDiff: 0.2, leanRatio: 1.15, leanDiff: 0.1, level: 2, days: 60 });
  assert.equal(statusOf({ n: 4, hits: 4 }, { n: 20, hits: 0 }), "notenough", "fewer than minEach on one side");
  assert.equal(statusOf({ n: 5, hits: 2 }, { n: 5, hits: 1 }), "notenough", "fewer than minHits in all");
  assert.equal(statusOf({ n: 10, hits: 6 }, { n: 10, hits: 2 }), "supported");
  assert.equal(statusOf({ n: 10, hits: 4 }, { n: 10, hits: 0 }), "supported", "zero base: the gap alone");
  assert.equal(statusOf({ n: 10, hits: 4 }, { n: 10, hits: 3 }), "still", "same direction, smaller gap");
  assert.equal(statusOf({ n: 10, hits: 3 }, { n: 10, hits: 3 }), "none");
  assert.equal(statusOf({ n: 10, hits: 1 }, { n: 10, hits: 5 }), "none", "the other direction is never a card");
});

test("bands: lighter / usual / heavier against her own usual, never a number", () => {
  const days = [0.5, 0.6, 0.7, 0.6, 0.6].map((score) => ({ score }));
  assert.equal(usualOf(days.slice(0, BAND.minDays - 1)), null);
  const u = usualOf(days);
  assert.equal(u, 0.6);
  assert.equal(bandOf(0.7, u), "lighter"); assert.equal(bandOf(0.5, u), "heavier"); assert.equal(bandOf(0.62, u), "usual"); assert.equal(bandOf(null, u), null);
  assert.deepEqual(bandCounts(days, u), { lighter: 1, usual: 3, heavier: 1 });
  assert.equal(bandWords({ lighter: 1, usual: 3, heavier: 1 }), "1 lighter, 3 usual and 1 heavier days");
  assert.equal(bandWords({ lighter: 1, usual: 0, heavier: 0 }), "1 lighter day");
  const flat = Array.from({ length: 60 }, () => ({ score: 0.6 }));
  assert.equal(bandTrend(flat, 0.6).kind, "same");
  const worse = flat.map((d, i) => (i >= 53 ? { score: 0.3 } : d));
  assert.equal(bandTrend(worse, 0.6).kind, "heavier");
  assert.equal(bandTrend(flat.map(() => ({ score: null })), null).sentence, EMPTY_LINE);
  for (const s of [bandTrend(worse, 0.6).sentence, bandWords({ lighter: 2, usual: 1, heavier: 0 })]) assert.ok(!/points|\/100|out of 100|score/i.test(s), s);
});

test("rings: words against her usual with stated minimums", () => {
  const days = Array.from({ length: 60 }, (_, i) => ({ score: i >= 53 ? 0.9 : 0.5 }));
  assert.equal(bodyRing(days).word, "Lighter than usual");
  assert.equal(bodyRing(days.map((d) => ({ score: 0.5 }))).word, "At your usual");
  assert.equal(bodyRing(days.map((d, i) => ({ score: i >= 57 ? 0.5 : null }))).word, "A few more logs");
  const ml = {};
  for (let i = 0; i < 28; i++) ml[addDays(T, -i)] = { mood: i < 7 ? 2 : 4 };
  assert.equal(mindRing(ml, T).word, "Lower than usual");
  assert.equal(mindRing({}, T).key, "none");
  const lines = ringInputs({ body: bodyRing(days), mind: mindRing(ml, T), cycle: "day 3" });
  assert.ok(lines.some((l) => l.includes(`${RING_RULES.minCur} logged days`)) && lines.every((l) => !/out of 100|points/.test(l)));
});

test("cycle timeline: every cycle shown, outliers labelled, PCOS long cycles calm, fertile estimate only on 21–35", () => {
  const rows = [
    { start: "2026-09-01", len: 42, counted: true, excluded: false, unusual: null },
    { start: "2026-08-03", len: 29, counted: true, excluded: true, unusual: null },
    { start: "2026-07-05", len: 29, counted: true, excluded: false, unusual: "short" },
  ];
  const sorted = [{ date: "2026-09-01", period: true, flow: "med" }, { date: "2026-09-02", period: true, flow: "light" }];
  const tl = cycleTimeline({ rows, current: { start: "2026-10-13", day: 17 }, sorted, expected: 30, pcosOn: true, todayIso: T });
  assert.equal(tl.rows.length, 4); assert.equal(tl.rows[0].current, true);
  assert.equal(tl.rows[1].period, 2); assert.deepEqual(tl.rows[1].labels, ["Over 35 days"]); assert.equal(tl.rows[1].fertile, null);
  assert.deepEqual(tl.rows[2].labels, ["Left out of predictions"]); assert.deepEqual(tl.rows[2].fertile, [13, 17]);
  assert.deepEqual(tl.rows[3].labels, ["Shorter than your usual"]); assert.equal(tl.rows[3].fertile, null);
  assert.match(tl.sentence, /ran 29 to 42 days\. One ran over 35 days\./);
  assert.ok(tl.sentence.includes(MODULES.pcos.cycle.expected.text));
  assert.equal(cycleTimeline({ rows: [], current: null, todayIso: T }), null);
  const off = cycleTimeline({ rows, current: null, sorted, pcosOn: false, todayIso: T });
  assert.ok(!off.sentence.includes("PCOS") && off.rows[0].labels.length === 0);
});

test("pattern cards from the L8 engine links: Supported / Still / Not enough, sentences as associations", () => {
  const l = (rough, good) => ({ rough, good, strength: 1 });
  const cards = sleepCards([
    { kind: "sleep", id: "hda", label: "Headaches", fam: "pain", l: l({ n: 10, hits: 6 }, { n: 10, hits: 2 }) },
    { kind: "sleep", id: "blo", label: "Bloating", fam: "body", l: l({ n: 10, hits: 4 }, { n: 10, hits: 3 }) },
    { kind: "sleep", id: "eng", label: "Low energy", fam: "sleep", l: l({ n: 3, hits: 2 }, { n: 9, hits: 1 }) },
    { kind: "sleep", id: "crm", label: "Cramps", fam: "pain", l: l({ n: 10, hits: 2 }, { n: 10, hits: 2 }) },
  ]);
  assert.deepEqual(cards.map((c) => c.status), ["supported", "still", "notenough"]);
  assert.equal(cards[0].sentence, "Rough nights lined up with more headaches in your log.");
  assert.equal(cards[0].diff, "3.0×"); assert.equal(cards[0].bars.a.days, 10);
  assert.equal(cards[2].sentence, EMPTY_LINE); assert.equal(cards[2].diff, null);
  const cyc = cycleCards([
    { kind: "cycle", id: "crm", label: "Cramps", k: { ok: true, from: 1, to: 4, inWin: 8, loggedIn: 8, restHits: 4, restLogged: 40, rate: 1, restRate: 0.1, cycles: 2, nCycles: 3, total: 12, strength: 5 } },
    { kind: "cycle", id: "hda", label: "Headaches", k: { ok: false, why: "few", total: 3, nCycles: 3 } },
  ]);
  assert.equal(cyc[0].sentence, "Cramps gather around cycle days 1–4 in your log.");
  assert.equal(cyc[1].status, "notenough");
  const ranked = rankCards([...cards, ...cyc]);
  assert.deepEqual(ranked.map((c) => c.status), ["supported", "supported", "still", "notenough", "notenough"]);
  assert.equal(rankCards([{ status: "seen", strength: 9 }, { status: "still", strength: 0 }, { status: "seen", first: true, strength: 0 }]).map((c) => c.first ? "first" : c.status).join(), "first,still,seen");
  for (const c of [...cards, ...cyc]) assert.ok(!/caus|points|out of 100|\/100|score/i.test(c.sentence + (c.diff || "")), c.sentence);
});

test("PCOS questions: sleep hours, the high-sugar marker and movement, with the lag; cycle length counts long cycles", () => {
  const entries = [], bodyLog = {};
  for (let i = 0; i < 20; i++) {
    const d = addDays(T, -i);
    const short = i % 2 === 0;
    bodyLog[d] = { sleepH: short ? 5.5 : 8 };
    entries.push({ date: d, sym: { eng: short ? 2 : 0, mood: 0, cra: 0 } });
  }
  const q = MODULES.pcos.patternQuestions.find((x) => x.id === "pcos-sleep-fatigue");
  const sides = questionSides(q, { entries, bodyLog, from: addDays(T, -19), to: T });
  assert.deepEqual(sides, { exp: { n: 10, hits: 10 }, other: { n: 10, hits: 0 } });
  const cards = pcosCards({ entries, bodyLog, todayIso: T, lens: [30, 41, 38, 33] });
  const sf = cards.find((c) => c.key === "pcos:pcos-sleep-fatigue");
  assert.equal(sf.status, "supported"); assert.equal(sf.sentence, "Nights under 7 hours lined up with more fatigue the next day in your log.");
  const cl = cards.find((c) => c.key === "pcos:pcos-cycle-length");
  assert.equal(cl.sentence, "In your log, 2 of your last 4 cycles ran over 35 days."); assert.equal(cl.bars.a.count, "2 cycles");
  assert.equal(pcosCards({ entries: [], bodyLog: {}, todayIso: T, lens: [30] }).find((c) => c.key === "pcos:pcos-cycle-length").status, "notenough");
  // marker with lag 1: a high-sugar day is compared with the NEXT day's check-in
  const qs = MODULES.pcos.patternQuestions.find((x) => x.id === "pcos-sugar-cravings");
  const s2 = questionSides(qs, { entries: [{ date: "2026-10-02", sym: { cra: 3, eng: 0 } }], bodyLog: { "2026-10-01": { pcos: ["sug"] } }, from: "2026-10-01", to: "2026-10-02" });
  assert.deepEqual(s2.exp, { n: 1, hits: 1 });
});

test("What I'm trying: lighter days before and after, never a score; Not enough under TRIAL_MIN", () => {
  const scores = {};
  for (let i = 1; i <= 14; i++) scores[addDays("2026-10-10", -i)] = 0.5;
  for (let i = 0; i < 10; i++) scores[addDays("2026-10-10", i)] = 0.8;
  const [c] = trialCards({ meds: [{ id: "m1", name: "Magnesium", started: "2026-10-10" }], scoreOn: (d) => scores[d] ?? null, usual: 0.6, todayIso: "2026-10-19" });
  assert.equal(c.status, "supported"); assert.match(c.sentence, /more of your days were lighter/); assert.equal(c.diff, "10 of 10");
  const [d] = trialCards({ meds: [{ id: "m2", name: "X", started: "2026-10-18" }], scoreOn: (x) => scores[x] ?? null, usual: 0.6, todayIso: "2026-10-19" });
  assert.equal(d.status, "notenough"); assert.ok(TRIAL_MIN === 5);
});

test("weekly review: Sunday through Tuesday, counts not grades, one experiment, skip this week", () => {
  assert.deepEqual(reviewWeek("2026-11-01"), { key: "2026-11-01", from: "2026-10-25", to: "2026-10-31", shows: true }); // Sunday
  assert.equal(reviewWeek("2026-11-03").shows, true); // Tuesday
  assert.equal(reviewWeek("2026-11-04").shows, false); // Wednesday
  assert.equal(reviewWeek(T).key, "2026-10-25");
  const c = weekCounts({ entries: [{ date: "2026-10-26" }, { date: "2026-10-20" }], moodLog: { "2026-10-27": { mood: 3 } }, bodyLog: { "2026-10-26": { sleepH: 7, move: [{ id: "a", type: "walk", min: 20 }] } }, practiceLog: [{ id: "r", p: "slow", day: "2026-10-28", sec: 180, done: true }], from: "2026-10-25", to: "2026-10-31" });
  assert.deepEqual(c, { checkins: 1, moods: 1, sleep: 1, moves: 1, practices: 1 });
  assert.deepEqual(countWords(c), ["1 check-in", "1 mood check-in", "1 night's sleep", "1 day with movement", "1 practice"]);
  const sig = weekSignals({ entries: [{ date: "2026-10-26", sleepQ: "poor", sym: {} }, { date: "2026-10-27", sleepQ: "poor", sym: {} }], from: "2026-10-25", to: "2026-10-31" });
  assert.equal(pickExperiment({ signals: sig, state: cleanExperiments(null), weekKey: "2026-10-25", todayIso: T }).id, "winddown");
  assert.equal(pickExperiment({ signals: { pcos: 1 }, pcosOn: true, state: cleanExperiments(null), weekKey: "2026-10-25", todayIso: T }).id, "walk-lunch");
  assert.equal(pickExperiment({ signals: {}, state: skipWeek(cleanExperiments(null), "2026-10-25"), weekKey: "2026-10-25", todayIso: T }), null);
  for (const x of EXPERIMENTS) {
    assert.ok(experimentSources(x).length >= 1 && experimentSources(x).every((s) => s.title && s.body && s.year), `${x.id} sources`);
    assert.ok(/not treatment/.test(x.line) && !/streak|score|cure|treat(s|ment) (your|PCOS)/i.test(x.why + x.short), x.id);
  }
});

test("experiments: start, tick, Home step, settle into past, follow-up compares the days", () => {
  let s = startExperiment(cleanExperiments(null), "winddown", "2026-10-26");
  assert.deepEqual(s.active, { id: "winddown", start: "2026-10-26", done: [] });
  s = markDay(s, "2026-10-26", true); s = markDay(s, "2026-10-27", true); s = markDay(s, "2026-11-10", true);
  assert.deepEqual(s.active.done, ["2026-10-26", "2026-10-27"]);
  const r = runningOn(s, "2026-10-28");
  assert.deepEqual([r.dayN, r.done, r.doneToday], [3, 2, false]);
  const st = experimentStep(s, "2026-10-28");
  assert.equal(st.eyebrow, "Your experiment · day 3 of 7"); assert.equal(st.action.exp, "done"); assert.equal(st.alt.practice, "winddown");
  assert.match(experimentStep(markDay(s, "2026-10-28", true), "2026-10-28").body, /Ticked for today\. 3 of 4 days so far/);
  assert.equal(experimentStep(s, "2026-11-02"), null);
  const settled = settle(s, "2026-11-02");
  assert.equal(settled.active, null); assert.deepEqual(settled.past, [{ id: "winddown", start: "2026-10-26", days: ["2026-10-26", "2026-10-27"], target: 4 }]);
  assert.equal(settle(s, "2026-10-28"), s);
  assert.deepEqual(cleanExperiments(JSON.parse(JSON.stringify(settled))), settled);
  assert.deepEqual(lastFinished(settled, "2026-10-25").id, "winddown");
  const entries = [{ date: "2026-10-27", sleepQ: "good", sym: {} }, { date: "2026-10-28", sleepQ: "good", sym: {} }, { date: "2026-10-29", sleepQ: "poor", sym: {} }];
  const fu = experimentFollowUp(settled.past[0], { entries });
  assert.deepEqual(fu, { done: { n: 2, hits: 0 }, other: { n: 1, hits: 1 }, label: "rough nights" });
  assert.equal(stopExperiment(s).active, null);
  assert.deepEqual(cleanExperiments({ active: { id: "nope", start: T }, skip: "x", past: [{ id: "move", start: "bad", target: 3 }] }), { active: null, skip: null, past: [] });
  assert.ok(EXP_DAYS === 7);
});

test("Patterns copy: no 0–100 scale or points on the Patterns screen and chart; the not-medical-advice line is there", () => {
  const screen = read("src/screens/PatternsScreen.jsx"), chart = read("src/components/PatternCharts.jsx");
  for (const [name, src] of [["PatternsScreen", screen], ["PatternCharts", chart]]) {
    assert.ok(!/points|\/100|out of 100|Day score|day score/.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), `${name} has score wording`);
  }
  assert.ok(screen.includes("NOT_ADVICE") && NOT_ADVICE.includes("not a diagnosis or medical advice"));
  assert.ok(!/streak/i.test(screen));
});

test("experiments are in the evidence register and the clinician review list, word for word", () => {
  const ev = read("docs/EVIDENCE.md"), cr = read("docs/CLINICIAN-REVIEW.md");
  for (const x of EXPERIMENTS) {
    assert.ok(ev.includes(x.why) && cr.includes(x.why), `${x.id} why text missing from the registers`);
    for (const s of experimentSources(x)) assert.ok(ev.includes(s.title), `${x.id} source ${s.title}`);
  }
});
