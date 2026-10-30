// Home v2 (calm R3). Run with: node --test src/lib/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  heroModel, TILE_IDS, DEFAULT_TILES, cleanHomeTiles, homeTiles, tileLogged, bodySteps, mindSteps, railStates,
  STEPS, smallStep, weekTrend, sparkPoints, cycleBuckets, pcosCycleCand, EMPTY_LINE, lastPeriodDay, PCOS_SIGNAL_IDS,
} from "./home.js";
import { addDays } from "./engine.js";

const T = "2026-10-29";
const series = (vals) => vals.map((score, i) => ({ iso: addDays(T, i - (vals.length - 1)), score }));
const BANNED = /\b(streak|score|grade|perfect|fail|missed|behind|out of 100|\/100|%)/i;

test("hero: cycle day, phase and the prediction range", () => {
  const pred = { cycleDay: 23, center: 30, phase: "luteal", state: "upcoming", fromIso: "2026-10-30", toIso: "2026-11-06", basis: "logged", used: 4, wide: false };
  const h = heroModel({ stage: "periods", pred, todayIso: T });
  assert.equal(h.center, "Day 23"); assert.equal(h.sub, "luteal phase");
  assert.equal(h.line, "Next period likely Oct 30 – Nov 6");
  assert.equal(h.note, "Based on your last 4 cycles");
  assert.ok(h.value > 0.7 && h.value < 0.8);
  assert.equal(heroModel({ stage: "periods", pred: { ...pred, wide: true }, todayIso: T }).note, "Cycles vary for you — the range is wide on purpose.");
  assert.equal(heroModel({ stage: "periods", pred, pcosOn: true, todayIso: T }).note, "Your cycles vary, so the range is wide on purpose.");
  assert.equal(heroModel({ stage: "periods", pred: { ...pred, cycleDay: 41 }, todayIso: T }).value, 1);
});
test("hero: pregnancy week, menopause count or calm state, long gap, no data", () => {
  const p = heroModel({ stage: "preg", pregWeek: 23, tri: "second", dueDate: "Feb 18, 2027", todayIso: T });
  assert.deepEqual([p.center, p.sub, p.line, p.note], ["Week 23", "second trimester", "Due Feb 18, 2027", "About 17 weeks to go"]);
  const m = heroModel({ stage: "peri", isMeno: true, lastPeriodIso: "2026-09-29", todayIso: T });
  assert.equal(m.center, "30"); assert.equal(m.sub, "days since your last period");
  const c = heroModel({ stage: "peri", isMeno: true, lastPeriodIso: null, todayIso: T });
  assert.equal(c.kind, "calm"); assert.equal(c.line, "No period tracking needed"); assert.equal(c.center, "29");
  assert.equal(heroModel({ stage: "peri", isMeno: true, lastPeriodIso: "2024-01-01", todayIso: T }).kind, "calm");
  const l = heroModel({ stage: "peri", predWhy: { kind: "long", days: 130 }, todayIso: T });
  assert.equal(l.line, "No period on record for 130 days"); assert.equal(l.note, "Long gaps are common in perimenopause.");
  assert.match(heroModel({ stage: "periods", predWhy: { kind: "long", days: 130 }, pcosOn: true, todayIso: T }).note, /not as mistakes/);
  assert.equal(heroModel({ stage: "periods", todayIso: T }).kind, "start");
});

test("tiles: cleaning, defaults, availability, top-up", () => {
  assert.deepEqual([...DEFAULT_TILES], ["symptoms", "sleep", "mood", "move"]);
  assert.equal(cleanHomeTiles(null), null); assert.equal(cleanHomeTiles(["sleep"]), null); assert.equal(cleanHomeTiles("x"), null);
  assert.deepEqual(cleanHomeTiles(["note", "note", "nope", "sleep"]), ["note", "sleep"]);
  assert.equal(cleanHomeTiles(["symptoms", "sleep", "mood", "move", "note"]), null);
  const all = [...TILE_IDS];
  assert.deepEqual(homeTiles(null, all), ["symptoms", "sleep", "mood", "move"]);
  assert.deepEqual(homeTiles(null, all.filter((x) => x !== "move" && x !== "pcos")), ["symptoms", "sleep", "mood", "period"]);
  assert.deepEqual(homeTiles(null, ["symptoms", "mood", "meds", "note"]), ["symptoms", "mood", "meds", "note"]); // pregnancy
  assert.deepEqual(homeTiles(["note", "mood"], all), ["note", "mood"]);
  assert.deepEqual(homeTiles(["pcos", "move"], ["symptoms", "sleep", "mood", "note"]), ["symptoms", "sleep"]); // both gone: topped up to 2
});
test("tiles: Logged per kind", () => {
  const entry = { sym: { hda: 2, acn: 1 }, sleepQ: "poor", scales: { moodq: 6 }, note: "x", period: true };
  for (const id of ["symptoms", "sleep", "mood", "note", "period"]) assert.equal(tileLogged(id, { entry }), true, id);
  assert.equal(tileLogged("pcos", { entry, pcosIds: PCOS_SIGNAL_IDS }), true);
  assert.equal(tileLogged("symptoms", { entry: { sym: { hda: 0 } } }), false);
  assert.equal(tileLogged("mood", { entry: { scales: { moodq: 0 } } }), false);
  assert.equal(tileLogged("move", { moveCount: 1 }), true); assert.equal(tileLogged("move", {}), false);
  assert.equal(tileLogged("meds", { medDay: { 3: true } }), true); assert.equal(tileLogged("meds", { medDay: { 3: false } }), false);
});

test("rails: ticks for what is logged, the next step current, the rest neutral", () => {
  assert.deepEqual(railStates([true, false, false]), ["done", "current", "todo"]);
  assert.deepEqual(railStates([false, true]), ["current", "done"]);
  const none = bodySteps({});
  assert.deepEqual(none.map((s) => s.label), ["Sleep", "Movement", "Symptoms"]);
  assert.deepEqual(none.map((s) => s.state), ["current", "todo", "todo"]);
  const some = bodySteps({ entry: { sleepQ: "good", sym: { a: 1, b: 2 } } });
  assert.deepEqual(some.map((s) => [s.state, s.sub]), [["done", "Slept well"], ["todo", "Optional"], ["done", "2 logged"]]); // Movement is optional: never "next"
  assert.deepEqual(railStates([false, false], [true, false]), ["todo", "current"]);
  assert.deepEqual(bodySteps({ preg: true }).map((s) => s.label), ["Movement", "Symptoms"]);
  assert.deepEqual(mindSteps({ moodDone: true, readReady: true }).map((s) => s.state), ["done", "done"]);
  assert.deepEqual(mindSteps({}).map((s) => s.state), ["current", "todo"]);
});

test("small step: rule order, skip for today, calm words, sources", () => {
  assert.equal(smallStep({ stage: "periods", todayIso: T }).id, "energy");
  assert.equal(smallStep({ stage: "periods", entry: { sleepQ: "poor" }, todayIso: T }).id, "breathe");
  assert.equal(smallStep({ stage: "periods", entry: { sleepQ: "good" }, pcosOn: true, todayIso: T }).id, "pcos");
  assert.equal(smallStep({ stage: "periods", entry: { sleepQ: "good", sym: { acn: 1 } }, pcosOn: true, todayIso: T }).id, "note");
  assert.equal(smallStep({ stage: "preg", entry: { sleepQ: "poor" }, todayIso: T }).id, "question");
  assert.equal(smallStep({ stage: "periods", entry: { sleepQ: "good", note: "hi" }, todayIso: T }).id, "look");
  assert.equal(smallStep({ stage: "periods", todayIso: T, skip: { day: T, id: "energy" } }), null);
  assert.equal(smallStep({ stage: "periods", todayIso: T, skip: { day: "2026-10-28", id: "energy" } }).id, "energy");
  for (const s of Object.values(STEPS)) {
    for (const t of [s.title, s.body, s.why]) assert.ok(!BANNED.test(t), `${s.id}: ${t}`);
    if (/breath/i.test(s.title)) { assert.ok(s.src && s.src.year && s.src.title && s.src.body); assert.match(s.why, /Wellbeing support, not treatment\./); }
  }
});
test("small step: every sourced sentence is registered for clinician review", () => {
  const reg = fs.readFileSync(new URL("../../docs/CLINICIAN-REVIEW.md", import.meta.url), "utf8");
  for (const s of Object.values(STEPS)) if (s.src) assert.ok(reg.includes(s.why), `${s.id} why in CLINICIAN-REVIEW.md`);
  const ev = fs.readFileSync(new URL("../../docs/EVIDENCE.md", import.meta.url), "utf8");
  assert.ok(ev.includes(STEPS.breathe.src.title));
});

test("week trend: words only, needs enough days", () => {
  const usual = Array(21).fill(0.6), lighter = Array(7).fill(0.8), bitHeavier = Array(7).fill(0.53);
  assert.deepEqual(weekTrend(series([...usual, ...lighter])), { kind: "lighter", sentence: "This week felt lighter than your usual." });
  assert.equal(weekTrend(series([...usual, ...bitHeavier])).sentence, "This week felt a little heavier than your usual.");
  assert.equal(weekTrend(series([...usual, ...Array(7).fill(0.61)])).sentence, "This week felt about like your usual.");
  assert.deepEqual(weekTrend(series([...Array(21).fill(null), 0.5, 0.5, 0.5, null, null, null, null])), { kind: null, sentence: EMPTY_LINE });
  for (const s of [weekTrend(series([...usual, ...lighter])).sentence]) assert.ok(!/\d/.test(s), "no numbers");
});
test("sparkline: rolling mean of logged days only", () => {
  const p = sparkPoints(series([null, 0.5, null, 1]));
  assert.deepEqual(p, [{ i: 1, v: 0.5 }, { i: 2, v: 0.5 }, { i: 3, v: 0.75 }]);
});
test("by cycle: phases from her own lengths, two days per phase, words", () => {
  // two 30-day cycles: ovulation ≈ days 14–18; luteal days lighter
  const starts = [addDays(T, -59), addDays(T, -29)];
  const days = Array.from({ length: 60 }, (_, i) => { const iso = addDays(T, i - 59); const cd = (i % 30) + 1; return { iso, score: cd <= 5 ? 0.3 : cd >= 19 ? 0.8 : 0.6 }; });
  const r = cycleBuckets(days, starts, 30);
  assert.deepEqual(r.bars.map((b) => b.id), ["period", "follicular", "ovulation", "luteal"]);
  assert.ok(r.bars.every((b) => b.v != null));
  assert.equal(r.sentence, "Lighter days tend to fall in the luteal phase; heavier ones around your period.");
  assert.equal(cycleBuckets(days, [], 30).sentence, EMPTY_LINE);
  // a 45-day cycle puts ovulation late, not at day 14
  const long = Array.from({ length: 45 }, (_, i) => ({ iso: addDays("2026-01-01", i), score: 0.5 }));
  const lr = cycleBuckets(long, ["2026-01-01", "2026-02-15"]);
  assert.equal(lr.bars.find((b) => b.id === "follicular").n, 23); // days 6–28
});

test("PCOS insight candidate: cycles longer than 35 days, in-your-log wording", () => {
  assert.equal(pcosCycleCand({ on: false, lens: [40, 30] }), null);
  assert.equal(pcosCycleCand({ on: true, lens: [40] }), null);
  const c = pcosCycleCand({ on: true, lens: [40, 30, 52] });
  assert.equal(c.key, "pcos:cycle-length"); assert.equal(c.num, "2 of 3");
  assert.equal(c.homeText, "In your log, 2 of your last 3 cycles ran over 35 days.");
  assert.ok(c.homeText.length <= 75);
  assert.match(pcosCycleCand({ on: true, lens: [30, 31] }).homeText, /none of your last 2/);
});
test("last period day ignores spotting", () => {
  assert.equal(lastPeriodDay([{ date: "2026-09-01", period: true }, { date: "2026-10-01", flow: "spot" }]), "2026-09-01");
  assert.equal(lastPeriodDay([{ date: "2026-09-01", flow: "light" }]), "2026-09-01");
  assert.equal(lastPeriodDay([]), null);
});
test("home.js stays pure", () => {
  const src = fs.readFileSync(new URL("./home.js", import.meta.url), "utf8");
  assert.ok(!/fetch\(|localStorage|indexedDB|from "\.\/(storage|api|plan|notifications|record)\.js"|from "react"/.test(src));
});

test("calm R5: the Mind check-in ticks the Mood tile; the breathing step opens the Slow breathing practice", () => {
  assert.equal(tileLogged("mood", { moodDay: { mood: 3 } }), true);
  assert.equal(tileLogged("mood", { moodDay: {} }), false);
  assert.equal(tileLogged("mood", {}), false);
  assert.deepEqual({ ...STEPS.breathe.action }, { label: "Breathe with Heard Health", practice: "slow" });
});

test("meal notes tile: Logged once today has a meal note (the tile exists only while Meal notes is on)", () => {
  assert.equal(TILE_IDS.includes("meals"), true);
  assert.equal(tileLogged("meals", {}), false);
  assert.equal(tileLogged("meals", { mealCount: 2 }), true);
  assert.deepEqual(homeTiles(["symptoms", "meals"], ["symptoms", "sleep", "mood", "move"]), ["symptoms", "sleep"]);
  assert.deepEqual(homeTiles(["symptoms", "meals"], ["symptoms", "sleep", "mood", "move", "meals"]), ["symptoms", "meals"]);
});
