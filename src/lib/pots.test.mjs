/* Unit tests for the POTS engine (lib/pots.js, lib/potsConstants.js). Run with
   `npm run test:unit` (node --test, no dependencies). Groups follow the design's test plan:
   a cleanPots, b mergePots, b2 eraseLog, c standResult, c2 interruptFor, c3 faint linking,
   c4 ids, c5 logMedsNow, d units and totals, e weekly-count isolation, plus source greps. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import {
  POTS_EMPTY, freshEmpty, cleanPots, isLockedPots, mergePots, newEpoch, markStaleRunning, newId, eraseLog, interruptFor,
  addIntake, setIv, removeItem, setRating, setUp, cycleSym, setSym, toggleTrig, addEpisode, logDose, setAid, addVitals,
  addSession, updateSession, setSleep, setNote, tickPlan, upsertTest, editTestReadings, deleteTest, setTestFaint,
  setSessionFaint, addTilt, upsertMed, stopMed, removeMed, setSettings, addCustom, archiveCustom, upsertPreset,
  logMedsNow, medsNowPlan, dayTotals, dueDoses, standResult, mlToOz, ozToMl, saltGToNaMg, naMgToSaltG, fmtFluid, fmtSodium,
  OZ_ML, NA_PER_G_SALT, ID_RE, TAG_RE, localeUnits, turnOn, turnOff, finishSetup, resetPregClearance, samePots,
  removePreset, updateItem, raiseSym, markQuick, setFaintPause, markOffered, nearFaintDays, removePlanItem, doseTime,
  restChecks, standChecks, bpAsked, savedUpTo, testTrend, median, removeTilt, RESULT_FOOT,
} from "./pots.js";
import { POTS_SYM, POTS_TRIG, POTS_BANNED, SAFETY_COPY, GUIDE_COPY, GUIDE_VERIFIED, POTS_MED_LIB, RUNNER_FEEL, FEEL_STOP, POTS_LOCKED_COPY, POTS_ERASE } from "./potsConstants.js";
import { SYM, PSYM, GSYM } from "./constants.js";

const D = "2026-10-08", D2 = "2026-10-09";
const DOSE_RE = /\b\d+(\.\d+)?\s?(mg|g|mcg)\b/;
const on = () => ({ ...freshEmpty(), on: true, epoch: "e1", epochAt: 1000, since: D });
const json = (x) => JSON.stringify(x);
const assertClean = (s, where) => { assert.ok(!POTS_BANNED.test(s), `banned wording in ${where}: ${s}`); };

/* ================= a. cleanPots ================= */
test("a: garbage, null and arrays give a fresh empty record, never shared", () => {
  for (const g of [null, undefined, 42, "x", true, [], [1, 2], () => 1]) assert.deepEqual(cleanPots(g), freshEmpty());
  const a = cleanPots(null), b = cleanPots(null);
  assert.notEqual(a, b);
  a.settings.presets[0].ml = 1; a.days.x = 1; a.settings.symTop.push("p_x");
  assert.equal(b.settings.presets[0].ml, 250);
  assert.deepEqual(b.days, {});
  assert.equal(freshEmpty().settings.symTop.length, 8);
  assert.ok(Object.isFrozen(POTS_EMPTY) && Object.isFrozen(POTS_EMPTY.settings.presets[0]));
  assert.deepEqual(POTS_EMPTY, freshEmpty());
});

test("a: a record from a newer build (v !== 1) is locked, kept by reference and never written", () => {
  for (const locked of [{ v: 2, days: { [D]: { future: true } }, secret: "keep me" }, {}]) {
    assert.equal(isLockedPots(locked), true);
    assert.equal(cleanPots(locked), locked);
    assert.equal(newEpoch(locked, 5), locked);
    assert.equal(eraseLog(locked, 5), locked);
    assert.equal(markStaleRunning(locked, 5), locked);
    assert.equal(mergePots(locked, on(), on()), locked);
    assert.equal(mergePots(locked, locked, null), locked);
    const acts = [
      (p) => addIntake(p, D, { ml: 250 }), (p) => setIv(p, D, { ml: 500 }), (p) => removeItem(p, D, "x"), (p) => setRating(p, D, 2),
      (p) => setUp(p, D, 3), (p) => cycleSym(p, D, "p_dzy"), (p) => setSym(p, D, "p_dzy", 2), (p) => toggleTrig(p, D, "t_heat"),
      (p) => addEpisode(p, D, { sym: ["p_dzy"] }), (p) => logDose(p, D, { medId: "m1" }), (p) => setAid(p, D, "m1", true),
      (p) => addVitals(p, D, { hr: 80 }), (p) => addSession(p, D, { mode: "walk" }), (p) => updateSession(p, D, "s", {}),
      (p) => setSleep(p, D, "poor"), (p) => setNote(p, D, "n"), (p) => tickPlan(p, D, "pl"), (p) => upsertTest(p, { id: "t", date: D, t: "09:00" }),
      (p) => editTestReadings(p, "t", {}), (p) => deleteTest(p, "t"), (p) => setTestFaint(p, "t", "yes"), (p) => setSessionFaint(p, D, "s", "yes"),
      (p) => addTilt(p, { date: D }), (p) => upsertMed(p, { name: "X" }), (p) => stopMed(p, "m", D), (p) => removeMed(p, "m"),
      (p) => setSettings(p, { simple: true }), (p) => addCustom(p, "sym", "Toe"), (p) => archiveCustom(p, "sym", "c_a"),
      (p) => upsertPreset(p, { label: "Mug", ml: 300 }), (p) => logMedsNow(p, D).p,
    ];
    for (const act of acts) assert.equal(act(locked), locked);
    assert.equal(dayTotals(locked, D).fluidMl, null);
    assert.deepEqual(dueDoses(locked, D, "12:00"), []);
  }
  // A stored locked copy survives a merge with anything; a locked local copy adopts the stored one.
  const s = on();
  assert.deepEqual(mergePots(s, { v: 2 }, null), cleanPots(s));
  assert.equal(mergePots(null, { v: 2 }, null).v, 2);
});

test("a: out-of-range numbers are dropped or nulled, bad dates and times dropped", () => {
  const p = cleanPots({
    v: 1,
    days: {
      [D]: {
        rating: 5, up: 11, sym: { p_dzy: 4, p_pal: 2, p_fog: 0 },
        intake: [{ id: "a1", t: "09:00", ml: 6000 }, { id: "a2", t: "25:00", ml: 250 }, { id: "a3", t: "09:10", ml: 250.4, naMg: 30000 }],
        vit: [{ id: "v1", t: "10:00", pos: "lying", hr: 250, sys: 59, dia: 70 }],
      },
      "2026-1-1": { rating: 2 }, nope: { rating: 2 },
    },
    tests: [{ id: "t1", date: "2026-13", t: "09:00" }, { id: "t2", date: D, t: "9:00" }, { id: "t3", date: D, t: "09:00", rest: [{ min: 4, hr: 10 }] }],
    since: "yesterday", epochAt: -5,
  });
  assert.deepEqual(Object.keys(p.days), [D]);
  const d = p.days[D];
  assert.equal("rating" in d, false);
  assert.equal("up" in d, false);
  assert.deepEqual(d.sym, { p_pal: 2 });
  assert.deepEqual(d.intake.map((x) => [x.id, x.ml, x.naMg]), [["a3", 250, null]]);
  assert.deepEqual([d.vit[0].hr, d.vit[0].sys, d.vit[0].dia], [null, null, 70]);
  assert.deepEqual(p.tests.map((t) => t.id), ["t3"]);
  assert.equal(p.tests[0].rest[0].hr, null);
  assert.equal(p.since, null);
  assert.equal(p.epochAt, 0);
});

test("a: unknown fields pass through at the top level, in settings and in each day", () => {
  const raw = { v: 1, future: { a: 1 }, settings: { futureSetting: [1, 2] }, days: { [D]: { futureDay: "x", rating: 2 } } };
  const p = cleanPots(raw);
  assert.deepEqual(p.future, { a: 1 });
  assert.deepEqual(p.settings.futureSetting, [1, 2]);
  assert.equal(p.days[D].futureDay, "x");
});

test("a: newer ids and enum values survive a round trip; malformed ones are dropped", () => {
  const p = cleanPots({
    v: 1,
    days: { [D]: { sym: { p_newsym: 2, P_BAD: 2, "p-bad": 1 }, trig: ["t_newtrig", "T_X", "t_heat"], intake: [{ id: "a1", t: "09:00", kind: "gel", ml: 100 }, { id: "a2", t: "09:00", kind: "k".repeat(30), ml: 100 }], eps: [{ id: "e1", t: "10:00", pos: "hammock", sym: ["p_newsym"] }] } },
  });
  const d = cleanPots(JSON.parse(json(p))).days[D];
  assert.deepEqual(d.sym, { p_newsym: 2 });
  assert.deepEqual(d.trig, ["t_newtrig", "t_heat"]);
  assert.equal(d.intake[0].kind, "gel");
  assert.equal(d.intake[1].kind, "other");
  assert.equal(d.eps[0].pos, "hammock");
});

test("a: settings and test enums from a newer v:1 build survive a round trip", () => {
  const raw = {
    v: 1,
    settings: { units: { fluid: "cup", salt: "mmolNa" }, paper: "legal", goals: { by: "dietitian" }, testPlan: "monthly", test: { method: "tilt", restMin: 15, sched: "every2", device: "ring" } },
    tests: [{ id: "t1", date: D, t: "09:00", method: "tilt", restMin: 15, sched: "every2", device: "ring", status: "done" }],
  };
  const p = cleanPots(JSON.parse(json(cleanPots(raw))));
  const s = p.settings;
  assert.deepEqual([s.units.fluid, s.units.salt, s.paper, s.goals.by, s.testPlan], ["cup", "mmolNa", "legal", "dietitian", "monthly"]);
  assert.deepEqual([s.test.method, s.test.restMin, s.test.sched, s.test.device], ["tilt", 15, "every2", "ring"]);
  const t = p.tests[0];
  assert.deepEqual([t.method, t.restMin, t.sched, t.device], ["tilt", 15, "every2", "ring"]);
  // only unreadable values fall back to the default
  const bad = cleanPots({ v: 1, settings: { test: { restMin: 0, sched: "1 3 5" } }, tests: [{ id: "t1", date: D, t: "09:00", restMin: 45, sched: 7 }] });
  assert.deepEqual([bad.settings.test.restMin, bad.settings.test.sched, bad.tests[0].restMin, bad.tests[0].sched], [5, "1-3-5-10", 5, "1-3-5-10"]);
  // an unknown fluid unit displays as ml
  assert.equal(fmtFluid(1250, s.units), "1.25 L");
});

test("a: an archived custom symptom keeps its label and its history", () => {
  const p = cleanPots({ v: 1, settings: { customSym: [{ id: "c_abc12345", label: "Toe ache", archived: true }] }, days: { [D]: { sym: { c_abc12345: 2 } } } });
  assert.deepEqual(p.settings.customSym, [{ id: "c_abc12345", label: "Toe ache", archived: true }]);
  assert.equal(p.days[D].sym.c_abc12345, 2);
  let q = addCustom(on(), "sym", "Toe ache", "c_abc12345");
  q = archiveCustom(q, "sym", "c_abc12345");
  assert.equal(q.settings.customSym.length, 1);
  assert.equal(q.settings.customSym[0].archived, true);
  q = addCustom(q, "sym", "toe ACHE");
  assert.equal(q.settings.customSym.length, 1);
  assert.equal("archived" in q.settings.customSym[0], false);
});

test("a: lists are capped keeping the newest; tests sorted; tombstones never capped", () => {
  const intake = Array.from({ length: 130 }, (_, i) => ({ id: `i${i}`, t: "09:00", ml: 10 }));
  const tests = Array.from({ length: 510 }, (_, i) => ({ id: `t${i}`, date: `2025-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`, t: "09:00", status: "done" }));
  const gone = Array.from({ length: 5000 }, (_, i) => `g${i}`);
  const p = cleanPots({ v: 1, days: { [D]: { intake } }, tests, gone, meds: Array.from({ length: 35 }, (_, i) => ({ id: `m${i}`, name: `Med ${i}` })) });
  assert.equal(p.days[D].intake.length, 120);
  assert.equal(p.days[D].intake[0].id, "i10");
  assert.equal(p.tests.length, 500);
  assert.ok(p.tests.every((t, i) => i === 0 || p.tests[i - 1].date <= t.date));
  assert.equal(p.gone.length, 5000);
  assert.equal(p.meds.length, 30);
  assert.equal(p.meds[0].id, "m5");
  // Sessions: a fifth on one day is refused, never made room for by dropping her first one.
  let q = on();
  for (let i = 0; i < 5; i++) q = addSession(q, D, { id: `s${i}`, t: `0${i}:00`, mode: "walk" });
  assert.deepEqual(q.days[D].move.map((x) => x.id), ["s0", "s1", "s2", "s3"]);
  let r = on();
  for (let i = 0; i < 31; i++) r = addEpisode(r, D, { id: `e${i}`, t: "10:00", sym: ["p_dzy"] });
  assert.equal(r.days[D].eps.length, 30);
  assert.equal(r.days[D].eps[29].id, "e30");
  const full = cleanPots({ ...on(), tests });
  assert.equal(full.tests.length, 500);
  const added = upsertTest(full, { id: "new", date: D, t: "09:00", status: "running" });
  assert.equal(added.tests.length, 500);
  assert.equal(added.tests[added.tests.length - 1].id, "new", "a running test auto-saves at the cap");
  assert.equal(cleanPots(added).tests.length, 500);
});

const messy = () => ({
  v: 1, epoch: "e1", epochAt: 5, on: true, since: D, extra: { z: [1] },
  settings: { units: { fluid: "oz", salt: "Bad Value!" }, goals: { fluidMl: 2500.4, by: "me" }, presets: [{ id: "glass", label: " Glass ", kind: "water", ml: 250 }, { id: "BAD ID", label: "x" }], symTop: ["p_dzy", "p_dzy", "nope"], customTrig: [{ id: "x_aa", label: "  Wind  " }, { id: "c_aa", label: "wrong prefix" }], context: { status: "checking", onset: { ym: "2025-13", after: ["covid", "Bad Value"] }, conditions: ["eds"] }, questions: [{ id: "q1", text: "  Why?  " }, { id: "q2", text: "" }], test: { restMin: 70, cue: false, method: "Lean Test" } },
  days: { [D]: { rating: 3, up: 4.2, quick: "yes", sym: { p_dzy: 2.4 }, trig: ["t_heat", "t_heat"], iv: { ml: 1000, note: " clinic " }, doses: [{ id: "d1", medId: "m1", t: "08:05", slot: "08:00", state: "taken" }, { id: "d2", t: "08:05", state: "taken" }], aids: { m2: true, m3: "yes" }, eps: [{ id: "e1", t: "11:00", sym: ["p_psy"], sev: 3, faint: "almost", injured: "no", mins: 0 }], move: [{ id: "s1", t: "07:00", mode: "recumbent_bike", step: 9, main: 20 }], sleep: "poor", plan: { pl1: true, pl2: false }, note: "  felt bad  " }, [D2]: {} },
  tests: [{ id: "t2", date: D2, t: "08:00", status: "running", upd: 1, rest: [{ min: 4, hr: 70, how: "counted" }, { min: "5" }], up: [{ min: 1, atSec: 61, hr: 99, feel: ["p_vis", "bad"] }] }, { id: "t1", date: D, t: "09:00", status: "weird status!", ctx: { comp: "yes", mlBefore: 750 } }],
  tilt: [{ id: "tl1", date: D, told: "  normal-ish  ", hrRise: 35.6, fainted: "no" }],
  meds: [{ id: "m1", lib: "mido", name: " Midodrine ", times: ["12:00", "08:00", "08:00", "nope"], started: D }, { id: "m2", name: "", kind: "aid" }],
  move: { program: { step: 2, days: [5, 1, 1, 9], mainMin: 3, pem: "no" }, faintPause: "bad" },
  gone: ["a", "a", "BAD"],
});
test("a: idempotent, and stand-test status is never changed by the sanitizer", () => {
  const once = cleanPots(messy());
  assert.deepEqual(cleanPots(once), once);
  assert.deepEqual(cleanPots(JSON.parse(json(once))), once);
  assert.equal(once.tests.find((t) => t.id === "t2").status, "running");
  assert.equal(once.settings.units.fluid, "oz");
  assert.equal(once.settings.units.salt, "mgNa");
  assert.equal(once.settings.goals.fluidMl, 2500);
  assert.deepEqual(once.settings.symTop, ["p_dzy"]);
  assert.deepEqual(once.settings.customTrig, [{ id: "x_aa", label: "Wind" }]);
  assert.deepEqual(once.settings.context.onset, { ym: null, after: ["covid"] });
  assert.deepEqual(once.settings.questions, [{ id: "q1", text: "Why?" }]);
  assert.equal(once.settings.test.restMin, 5);
  assert.equal(once.settings.test.method, "stand");
  assert.equal(once.settings.test.cue, false);
  assert.equal(once.days[D].note, "felt bad");
  assert.equal(once.days[D].iv.note, "clinic");
  assert.deepEqual(once.days[D].aids, { m2: true });
  assert.deepEqual(once.days[D].plan, { pl1: true });
  assert.deepEqual(once.days[D2], {});
  assert.deepEqual(once.meds.map((m) => [m.name, m.times]), [["Midodrine", ["08:00", "12:00"]]]);
  assert.deepEqual(once.move.program.days, [1, 5]);
  assert.equal(once.move.program.mainMin, null);
  assert.equal(once.move.faintPause, null);
  assert.deepEqual(once.gone, ["a"]);
  assert.deepEqual(once.extra, { z: [1] });
  // markStaleRunning is the only place a status changes, and only for a stale "running" test.
  const fresh = markStaleRunning(once, 1 + 29 * 60000);
  assert.equal(fresh, once);
  const stale = markStaleRunning(once, 1 + 31 * 60000);
  assert.equal(stale.tests.find((t) => t.id === "t2").status, "interrupted");
  assert.equal(stale.tests.find((t) => t.id === "t2").rest.length, 1);
});

/* ================= b. mergePots ================= */
const drink = (id, extra = {}) => ({ id, t: "09:00", kind: "water", label: "Glass", ml: 250, naMg: null, ...extra });
const withDrinks = (p, ...ids) => ids.reduce((q, id) => addIntake(q, D, drink(id)), p);
const conv = (a, b, base) => { const m = mergePots(a, b, base); assert.deepEqual(mergePots(a, m, base), m, "merge converges"); return m; };

test("b: arrays union by id from both sides, minus tombstones from either side", () => {
  const base = withDrinks(on(), "x1", "x2");
  const A = removeItem(withDrinks(base, "a1"), D, "x1");
  const B = removeItem(withDrinks(base, "b1"), D, "x2");
  const m = conv(A, B, base);
  assert.deepEqual(m.days[D].intake.map((x) => x.id), ["a1", "b1"]);
  assert.deepEqual([...m.gone].sort(), ["x1", "x2"]);
  // and the other way round, other lists too
  const base2 = upsertMed(addTilt(on(), { id: "tl", date: D }), { id: "m1", name: "Midodrine" });
  const A2 = upsertMed(removeMed(base2, "m1"), { id: "m2", name: "Propranolol" });
  const B2 = addTilt(base2, { id: "tl2", date: D2 });
  const m2 = conv(A2, B2, base2);
  assert.deepEqual(m2.meds.map((x) => x.id), ["m2"]);
  assert.deepEqual(m2.tilt.map((x) => x.id), ["tl", "tl2"]);
});

test("b: same-id edits: one side unchanged -> the other wins; both changed -> larger upd, tie local", () => {
  const base = withDrinks(on(), "x1");
  const edit = (p, ml, upd) => ({ ...p, days: { [D]: { intake: [{ ...p.days[D].intake[0], ml, upd }] } } });
  assert.equal(conv(base, edit(base, 300, 5), base).days[D].intake[0].ml, 300);
  assert.equal(conv(edit(base, 400, 5), base, base).days[D].intake[0].ml, 400);
  assert.equal(conv(edit(base, 400, 9), edit(base, 300, 5), base).days[D].intake[0].ml, 400);
  assert.equal(conv(edit(base, 400, 5), edit(base, 300, 9), base).days[D].intake[0].ml, 300);
  assert.equal(conv(edit(base, 400, 5), edit(base, 300, 5), base).days[D].intake[0].ml, 300);
  // tests always carry upd
  const tb = upsertTest(on(), { id: "t1", date: D, t: "09:00", status: "done", note: "a" });
  const tA = { ...tb, tests: [{ ...tb.tests[0], note: "from A", upd: tb.tests[0].upd + 10 }] };
  const tB = { ...tb, tests: [{ ...tb.tests[0], note: "from B", upd: tb.tests[0].upd + 5 }] };
  assert.equal(conv(tA, tB, tb).tests[0].note, "from A");
});

test("b: per-key 3-way for day scalars and maps: a cleared symptom or trigger stays cleared", () => {
  let base = setSym(on(), D, "p_dzy", 2);
  base = toggleTrig(setRating(setSym(base, D, "p_fog", 1), D, 3), D, "t_heat");
  const A = toggleTrig(setSym(base, D, "p_dzy", 0), D, "t_heat");   // A clears a symptom and un-ticks a trigger
  const B = setSleep(setSym(withDrinks(base, "b1"), D, "p_fog", 3), D, "poor");   // stale B changes other keys
  const saved = conv(A, B, base);     // B saves over A's stored record
  const d = saved.days[D];
  assert.equal(d.sym.p_dzy, undefined);
  assert.equal(d.sym.p_fog, 3);
  assert.equal(d.trig, undefined);
  assert.equal(d.rating, 3);
  assert.equal(d.sleep, "poor");
  assert.deepEqual(d.intake.map((x) => x.id), ["b1"]);
  // B adopting A's record later: same result from B's side
  assert.equal(conv(B, A, base).days[D].sym.p_dzy, undefined);
  // B changed the same key since its base: B's change wins
  const B2 = setSym(base, D, "p_dzy", 3);
  assert.equal(conv(A, B2, base).days[D].sym.p_dzy, 3);
  // settings leaves and top-level leaves use the same rule
  const sA = setSettings(base, { units: { fluid: "oz" } }), sB = setSettings(base, { teen: true });
  const sm = conv(sA, sB, base);
  assert.equal(sm.settings.units.fluid, "oz");
  assert.equal(sm.settings.teen, true);
  assert.equal(conv({ ...base, on: false }, base, base).on, false);
});

test("b: epochs: an erase or restore in A beats a stale B; equal epochAt keeps stored", () => {
  const base = setRating(withDrinks(on(), "x1", "x2"), D, 4);
  const B = setNote(withDrinks(base, "b1"), D, "stale note");
  const erased = eraseLog(base, 5000);
  const m = conv(erased, B, base);
  assert.deepEqual(m.days, {});
  assert.equal(m.epoch, erased.epoch);
  assert.deepEqual(conv(B, erased, base).days, {});       // B adopting A's erased record
  const restored = newEpoch(setRating(withDrinks({ ...on(), epoch: "old" }, "r1"), D, 1), 6000);
  const m2 = conv(restored, B, base);
  assert.deepEqual(m2, cleanPots(restored));
  assert.deepEqual(m2.days[D].intake.map((x) => x.id), ["r1"]);
  const x = { ...on(), epoch: "ex", epochAt: 7 }, y = { ...withDrinks(on(), "y1"), epoch: "ey", epochAt: 7 };
  assert.equal(mergePots(x, y, null).epoch, "ex");
  assert.equal(mergePots(y, x, null).epoch, "ey");
  // a base from another epoch is not used as the ancestor
  const sameEpochA = withDrinks(restored, "a1"), sameEpochB = withDrinks(restored, "b1");
  assert.deepEqual(conv(sameEpochA, sameEpochB, base).days[D].intake.map((i) => i.id), ["r1", "a1", "b1"]);
});

test("b: 2,000 removals in A stay removed against a stale B (no tombstone cap)", () => {
  const n = 2000;
  const base = { ...on(), days: Object.fromEntries(Array.from({ length: 20 }, (_, d) => [`2026-08-${String(d + 1).padStart(2, "0")}`, { intake: Array.from({ length: 100 }, (_, i) => drink(`d${d}i${i}`)) }])) };
  let A = cleanPots(base);
  for (const [day, v] of Object.entries(A.days)) for (const it of v.intake) A = removeItem(A, day, it.id);
  assert.equal(A.gone.length, n);
  const B = withDrinks(cleanPots(base), "b1");
  const m = conv(A, B, base);
  assert.equal(Object.values(m.days).reduce((a, v) => a + (v.intake || []).length, 0), 1);
  assert.equal(m.gone.length, n);
});

test("b: no base falls back to local-wins and union; null stored keeps local", () => {
  const s = setRating(withDrinks(on(), "s1"), D, 2), l = setRating(withDrinks(on(), "l1"), D, 4);
  const m = conv(s, l, null);
  assert.equal(m.days[D].rating, 4);
  assert.deepEqual(m.days[D].intake.map((x) => x.id), ["s1", "l1"]);
  assert.equal(mergePots(undefined, l, null), l);
  assert.equal(mergePots(s, null, null).days[D].rating, 2);
});

test("b: convergence over a mixed scenario and a reorder", () => {
  let base = withDrinks(upsertPreset(on(), { id: "mug", label: "Mug", ml: 300 }), "x1", "x2");
  base = upsertTest(base, { id: "t1", date: D, t: "09:00", status: "done" });
  const A = setSettings(removeItem(setSym(withDrinks(base, "a1"), D, "p_pal", 1), D, "x2"), { presets: [...base.settings.presets].reverse() });
  const B = upsertTest(tickPlan(setAid(withDrinks(base, "b1"), D, "m1", true), D, "pl1"), { id: "t2", date: D, t: "10:00", status: "done" });
  const m = conv(A, B, base);
  assert.equal(conv(B, A, base).days[D].intake.length, m.days[D].intake.length);
  assert.equal(m.settings.presets[0].id, "mug");      // A's reorder survives B's save
  assert.deepEqual(m.tests.map((t) => t.id), ["t1", "t2"]);
  assert.deepEqual(m.days[D].aids, { m1: true });
});

/* ================= b2. eraseLog ================= */
test("b2: eraseLog leaves no typed text, keeps only display choices, starts a new epoch", () => {
  const S = "SENTINEL";
  let p = on();
  p = setSettings(p, {
    simple: true, teen: true, paper: "a4", units: { fluid: "oz", salt: "gSalt" }, reportNotes: true, reportCycle: false,
    show: { move: true }, goals: { fluidMl: 2500, naMg: 3000, by: "clinician", set: D }, testPlan: "weekly", symHidden: ["p_cold"],
    test: { method: "lean", restMin: 10, sched: "every", bp: true, device: "cuff", cue: false, safetySeen: D },
    plan: [{ id: "pl1", label: `${S} plan` }], questions: [{ id: "q1", text: `${S} question` }],
    context: { status: "diagnosed", onset: { ym: "2024-03", after: ["covid"] }, conditions: ["eds"] },
    presets: [{ id: "mine", label: `${S} preset`, kind: "electrolyte", ml: 500, naMg: 480 }],
  });
  p = addCustom(p, "sym", `${S} sym`, "c_aaaa1111");
  p = archiveCustom(addCustom(p, "sym", `${S} archived`, "c_bbbb2222"), "sym", "c_bbbb2222");
  p = addCustom(p, "trig", `${S} trig`, "x_aaaa1111");
  p = setSettings(p, { symTop: ["c_aaaa1111", "p_dzy"] });
  p = setNote(p, D, `${S} day note`);
  p = setIv(p, D, { ml: 1000, note: `${S} iv` });
  p = addEpisode(p, D, { sym: ["p_dzy"], note: `${S} ep note` });
  p = addIntake(p, D, { label: `${S} drink`, ml: 250 });
  p = upsertTest(p, { id: "t1", date: D, t: "09:00", status: "done", note: `${S} test note` });
  p = addTilt(p, { id: "tl1", date: D, where: `${S} where`, told: `${S} told`, bpNote: `${S} bp` });
  p = upsertMed(p, { id: "m1", name: `${S} med`, note: `${S} med note`, times: ["08:00"] });
  p = { ...p, move: { program: { step: 2, hrNote: `${S} hr`, pem: "no" }, faintPause: D }, futureTop: `${S} future`, settings: { ...p.settings, futureSetting: `${S} fs` } };
  p = cleanPots(p);
  assert.ok(json(p).split(S).length > 15);
  const e = eraseLog(p, 9999);
  assert.ok(!json(e).includes(S), json(e));
  assert.notEqual(e.epoch, p.epoch);
  assert.equal(e.epochAt, 9999);
  assert.deepEqual(e.gone, []);
  assert.deepEqual([e.on, e.since, e.offered, e.setupDone], [p.on, p.since, p.offered, p.setupDone]);
  const f = freshEmpty().settings;
  assert.deepEqual(e.settings, {
    ...f, simple: true, teen: true, paper: "a4", units: { fluid: "oz", salt: "gSalt" }, reportNotes: true, reportCycle: false,
    show: { ...f.show, move: true }, symTop: ["p_dzy"],
    test: { method: "lean", restMin: 10, sched: "every", bp: true, device: "cuff", cue: false, safetySeen: null },
  });
  assert.deepEqual([e.days, e.tests, e.tilt, e.meds, e.move], [{}, [], [], [], { program: null, faintPause: null }]);
  assert.deepEqual(cleanPots(e), e);
});

/* ================= c. standResult ================= */
const mk = (rest, up, extra = {}) => ({
  id: "t1", date: D, t: "09:00", upd: 1, method: "stand", restPos: "back", restMin: 5, sched: "1-3-5-10", bp: false, status: "done", feel: [],
  rest: rest.map(([min, hr, sys = null, dia = null, how]) => ({ min, hr, sys, dia, ...(how ? { how } : {}) })),
  up: up.map(([min, hr, sys = null, dia = null, how]) => ({ min, atSec: min * 60, hr, sys, dia, feel: [], ...(how ? { how } : {}) })),
  ...extra,
});
const REST70 = [[4, 70], [5, 70]];
const allLines = [];
const R = (t, o) => { const r = standResult(t, o); for (const l of r.lines) allLines.push(l.text); if (r.headline) allLines.push(r.headline); return r; };
const textOf = (r) => r.lines.map((l) => l.text).join(" ");

test("c: thresholds 29 / 30 / 31 and the sustained pair", () => {
  const at = (hr) => R(mk(REST70, [[1, hr], [3, hr], [5, hr], [10, hr]]));
  assert.equal(at(99).hrStatus, "below");
  assert.equal(at(100).hrStatus, "met");
  assert.deepEqual(at(100).sustainedAt, [1, 3]);
  assert.equal(at(101).hrStatus, "met");
  const r = R(mk(REST70, [[1, 80], [3, 101], [5, 102], [10, 90]]));
  assert.equal(r.hrStatus, "met");
  assert.deepEqual(r.sustainedAt, [3, 5]);
});

test("c: the native-e2e fixture (lying 66/70; upright 88, 96, 101, 104)", () => {
  const r = R(mk([[4, 66], [5, 70]], [[1, 88], [3, 96], [5, 101], [10, 104]]));
  assert.equal(r.hrStatus, "met");
  assert.deepEqual(r.sustainedAt, [5, 10]);
  assert.equal(r.peakRise, 36);
  assert.equal(r.peakMin, 10);
  assert.equal(r.baseHr, 68);
  assert.equal(r.complete, true);
  assert.equal(r.headline, "Lying: 68. Highest standing: 104 at minute 10. That's a rise of 36 beats a minute.");
  const s = textOf(r);
  for (const want of ["went up by 36", "stayed up at minutes 5 and 10", "30-beat", "(40 or more for ages 12–19)", "It isn't a diagnosis"]) assert.ok(s.includes(want), want);
  assert.equal(r.lines.find((l) => l.kind === "advice").urgency, "visit");
});

test("c: single readings: a peak that doesn't last (single_mid) vs a peak at the last reading (single_last)", () => {
  const every = (vals) => vals.map((hr, i) => [i + 1, hr]);
  const mid = R(mk(REST70, every([102, 101, 85, 85, 85, 85, 85, 85, 85, 85]), { sched: "every" }));
  assert.equal(mid.hrStatus, "single_mid");
  assert.equal(mid.peakMin, 1);
  assert.ok(textOf(mid).includes("borderline"));
  // minutes 1 and 2 both crossed (too early for a pair); minute 3 fell back: the sentence says so
  assert.ok(textOf(mid).includes("went up by as much as 32 (minute 1), but by minute 3 it had come back under the 30-beat rise"), textOf(mid));
  assert.ok(!textOf(mid).includes("the next one didn't stay") && !textOf(mid).includes("One reading"));
  const dip = R(mk(REST70, [[1, 80], [3, 102], [5, 85], [10, 90]]));
  assert.equal(dip.hrStatus, "single_mid");
  assert.ok(textOf(dip).includes("as much as 32 (minute 3), but by minute 5"));
  const last10 = R(mk(REST70, [[1, 80], [3, 85], [5, 90], [10, 101]]));
  assert.equal(last10.hrStatus, "single_last");
  assert.ok(textOf(last10).includes("at minute 10") && textOf(last10).includes("no later reading"));
  const nine = every([80, 82, 84, 85, 86, 88, 90, 92, 101, null]);
  const last9 = R(mk(REST70, nine, { sched: "every" }));
  assert.equal(last9.hrStatus, "single_last");
  assert.ok(textOf(last9).includes("at minute 9"));
  assert.ok(mid.lines.concat(last10.lines).filter((l) => l.kind === "hr").every((l) => l.urgency === "visit"));
});

test("c: skipped readings inside 5 minutes keep a pair; a gap over 5 minutes doesn't", () => {
  const inside = R(mk(REST70, [[1, 80], [2, 85], [3, 101], [4, null], [5, 102], [6, 90]], { sched: "every" }));
  assert.equal(inside.hrStatus, "met");
  assert.deepEqual(inside.sustainedAt, [3, 5]);
  const gap = R(mk(REST70, [[1, 80], [3, 101], [5, null], [10, 101]]));
  assert.equal(gap.hrStatus, "single_last");
  assert.equal(gap.sustainedAt, null);
});

test("c: teen threshold 40", () => {
  const t = mk([[4, 66], [5, 70]], [[1, 88], [3, 96], [5, 101], [10, 104]]);
  const r = R(t, { teen: true });
  assert.equal(r.thr, 40);
  assert.equal(r.hrStatus, "below");
  assert.ok(textOf(r).includes("40-beat"));
  const m = R(mk(REST70, [[1, 110], [3, 111], [5, 112], [10, 112]]), { teen: true });
  assert.equal(m.hrStatus, "met");
  assert.ok(!textOf(m).includes("12–19"));
});

test("c: missing baseline, fewer than 2 upright readings, one lying reading", () => {
  assert.equal(R(mk([], [[1, 100], [3, 101]])).hrStatus, "insufficient");
  assert.equal(R(mk([[4, null], [5, null]], [[1, 100], [3, 101]])).hrStatus, "insufficient");
  const one = R(mk(REST70, [[1, 100]]));
  assert.equal(one.hrStatus, "insufficient");
  assert.equal(one.headline, null);
  assert.ok(textOf(one).startsWith("There aren't enough readings"));
  const single = R(mk([[5, 72]], [[1, 90], [3, 95]]));
  assert.equal(single.baseHr, 72);
  assert.equal(single.hrStatus, "below");
});

test("c: blood pressure: drop at minute 3 vs 4, single early drop, late drop, no BP", () => {
  const rest = [[4, 70, 120, 80], [5, 70, 120, 80]];
  const drop3 = R(mk(rest, [[1, 90, 118, 78], [3, 95, 99, 79], [5, 96, 118, 78], [10, 97, 118, 78]], { bp: true }));
  assert.equal(drop3.bpStatus, "drop");
  assert.deepEqual(drop3.drop, { s: 21, d: 1, min: 3 });
  const dl = drop3.lines.find((l) => l.kind === "bp");
  assert.equal(dl.urgency, "now");
  assert.ok(dl.text.startsWith("Your blood pressure dropped by 21 (top number) within 3 minutes"));
  const every = [[1, 90, 118, 78], [2, 90, 118, 78], [3, 90, 118, 78], [4, 90, 99, 79], [5, 90, 118, 78], [10, 90, 118, 78]];
  const drop4 = R(mk(rest, every, { bp: true, sched: "every" }));
  assert.equal(drop4.bpStatus, "late_drop");
  assert.ok(textOf(drop4).includes("dropped after minute 3 (by 21/1 at minute 4)"));
  const single = R(mk(rest, [[1, 90, 100, 69], [3, 95, 118, 78], [5, 96, 118, 78], [10, 97, 118, 78]], { bp: true }));
  assert.equal(single.bpStatus, "single_drop");
  assert.ok(textOf(single).includes("showed a drop of 20/11"));
  const both = R(mk(rest, [[1, 90, 100, 69], [3, 95, 98, 66], [5, 96, 118, 78], [10, 97, 118, 78]], { bp: true, fainted: "yes" }));
  assert.equal(both.bpStatus, "drop");
  assert.equal(both.lines.find((l) => l.kind === "bp").urgent, "faint");
  assert.ok(textOf(both).includes("by 22 (top number) and 14 (bottom number)"));
  const steady = R(mk(rest, [[1, 90, 118, 78], [3, 95, 117, 77], [5, 96, 118, 78], [10, 97, 118, 78]], { bp: true }));
  assert.equal(steady.bpStatus, "no_drop");
  const off = R(mk(rest, [[1, 90, 90, 60], [3, 95, 90, 60]], { bp: false }));
  assert.equal(off.bpStatus, "none");
  assert.ok(!off.lines.some((l) => l.kind === "bp"));
  const noLyingBp = R(mk(REST70, [[1, 90, 118, 78], [3, 95, 118, 78]], { bp: true }));
  assert.equal(noLyingBp.bpStatus, "none");
  assert.equal(noLyingBp.bpMissing, "lying");
  assert.ok(textOf(noLyingBp).includes("No lying-down blood pressure was taken"));
  const noBpAtAll = R(mk(REST70, [[1, 90], [3, 95]], { bp: true }));
  assert.deepEqual([noBpAtAll.bpStatus, noBpAtAll.bpMissing], ["none", "all"]);
  assert.ok(textOf(noBpAtAll).includes("No blood pressure was taken"));
  // BP on and a lying BP, but every upright reading skipped BP: never "held steady"
  const lyingOnly = R(mk(rest, [[1, 90], [3, 95], [5, 96], [10, 97]], { bp: true }));
  assert.deepEqual([lyingOnly.bpStatus, lyingOnly.bpMissing], ["none", "standing"]);
  assert.ok(textOf(lyingOnly).includes("No standing blood pressure was taken"));
  assert.ok(!textOf(lyingOnly).includes("held steady"));
  // standing BP only after minute 3, no later drop: can't speak for the first 3 minutes
  const lateOnly = R(mk(rest, [[1, 90], [3, 95], [5, 96, 118, 78], [10, 97, 118, 78]], { bp: true }));
  assert.deepEqual([lateOnly.bpStatus, lateOnly.bpMissing], ["none", "early"]);
  assert.ok(textOf(lateOnly).includes("in the first 3 minutes, when clinicians check for a drop"));
  assert.equal(steady.bpMissing, null);
});

test("c: supine high, crisis, resting HR 99 vs 100, high standing HR", () => {
  const hi = mk([[4, 70, 145, 85], [5, 70, 143, 85]], [[1, 90, 140, 85], [3, 95, 140, 85]], { bp: true });
  assert.equal(R(hi).supineHigh, true);
  assert.ok(!R(hi, { supineCount: 1 }).lines.some((l) => l.kind === "supineHigh"));
  assert.ok(textOf(R(hi, { supineCount: 2 })).includes("140/90 or higher on 2 tests"));
  assert.equal(R(mk(REST70, [[1, 90, 185, 95], [3, 95, 130, 85]], { bp: true })).crisis, true);
  assert.equal(R(mk(REST70, [[1, 90, 130, 85], [3, 95, 130, 85]], { bp: true })).crisis, false);
  assert.equal(R(mk([[4, 99], [5, 99]], [[1, 110], [3, 112]])).restHigh, false);
  // thresholds use the unrounded mean: 99.5 isn't 100, a 19.5 drop isn't 20, a 29.5 rise isn't 30
  const half = R(mk([[4, 99, 119, 79], [5, 100, 120, 80]], [[1, 110, 100, 79], [3, 112, 100, 79]], { bp: true }));
  assert.equal(half.baseHr, 99.5);
  assert.equal(half.restHigh, false);
  assert.equal(half.bpStatus, "no_drop");
  assert.ok(half.headline.startsWith("Lying: 99.5."), half.headline);
  const rise295 = R(mk([[4, 70], [5, 71]], [[1, 100], [3, 100]]));
  assert.equal(rise295.hrStatus, "below");
  assert.ok(textOf(rise295).includes("went up by 29.5 beats a minute at most"));
  const sym = { ...mk([[4, 99, 119, 79], [5, 100, 120, 80]], [[1, 110, 100, 79]], { bp: true }), feel: ["p_dzy"] };
  assert.equal(interruptFor(sym, { type: "reading", pos: "up", reading: { min: 3, hr: 112, sys: 100, dia: 79 } }), null, "the live card and the result agree");
  const rh = R(mk([[4, 100], [5, 100]], [[1, 110], [3, 112]]));
  assert.equal(rh.restHigh, true);
  assert.equal(rh.lines.find((l) => l.kind === "restHigh").urgency, "visit");
  assert.ok(textOf(R(mk(REST70, [[1, 120], [3, 104]]))).includes("reached 120"));
  assert.equal(R(mk(REST70, [[1, 119], [3, 104]])).hr120, false);
});

test("c: counted-pulse caveat only near the threshold and only when a counted reading counts", () => {
  const up = (last, how) => [[1, 80], [3, 85], [5, 101, null, null, how], [10, last]];
  assert.equal(R(mk(REST70, up(106, "counted"))).counted, true);   // rise 36: |36-30| = 6
  assert.equal(R(mk(REST70, up(107, "counted"))).counted, false);  // rise 37
  assert.equal(R(mk(REST70, up(106))).counted, false);
  assert.equal(R(mk([[4, 70, null, null, "counted"], [5, 70]], up(106))).counted, true);   // a counted baseline reading
  assert.ok(textOf(R(mk(REST70, up(106, "counted")))).includes("Counted pulses can be off"));
});

test("c: edited, heart-rate medicine, stopped, pregnancy and midlife lines", () => {
  const base = mk([[4, 66], [5, 70]], [[1, 88], [3, 96], [5, 101], [10, 104]]);
  assert.equal(R({ ...base, edited: true }).lines[0].text, "Some readings were corrected after the test.");
  assert.equal(R({ ...base, edited: true }).edited, true);
  assert.ok(textOf(R({ ...base, ctx: { rateMed: "yes" } })).includes("heart-rate medicine today"));
  const st = R({ ...base, status: "stopped", stoppedAt: 4.5, why: "faint", up: base.up.slice(0, 2) });
  assert.ok(textOf(st).includes("You stopped at minute 4.5 because you felt faint."));
  assert.equal(st.minutesUp, 4.5);
  assert.equal(st.complete, false);
  assert.ok(textOf(R({ ...base, status: "stopped", stoppedAt: null, up: [] })).includes("You stopped before standing up"));
  const preg = R({ ...base, restPos: "left" }, { stage: "preg" });
  assert.ok(preg.headline.startsWith("Lying on left side: 68."));
  assert.ok(textOf(preg).includes("That's a rise of 36. Outside pregnancy, clinicians use 30."));
  assert.equal(preg.lines.find((l) => l.kind === "hr").urgency, null);
  assert.deepEqual(preg.lines.filter((l) => l.kind === "advice").map((l) => [l.text, l.urgency]), [["Share this test, and ask whether an in-clinic standing test or a tilt test would help.", "visit"]]);
  assert.ok(!textOf(preg).includes("stayed up at minutes"));
  assert.ok(textOf(preg).includes("Heart rate normally rises during pregnancy"));
  assert.ok(textOf(R(base, { stage: "peri", firstFinding: true })).includes("more common from midlife"));
  assert.ok(!textOf(R(base, { stage: "peri", firstFinding: false })).includes("midlife"));
  assert.ok(!textOf(R(mk(REST70, [[1, 80], [3, 82]]), { stage: "peri", firstFinding: true })).includes("midlife"));
  assert.ok(R(base, { cycle: { day: 24, weekBefore: true } }).lines.some((l) => l.text === "Cycle day 24 (week before your period)"));
});

test("c: below: self-care advice unless she felt unwell; never a negative rise", () => {
  assert.equal(R(mk(REST70, [[1, 80], [3, 82]])).lines.find((l) => l.kind === "hr").urgency, "self");
  assert.equal(R(mk(REST70, [[1, 80], [3, 82]]), { daySym: { p_dzy: 2 } }).lines.find((l) => l.kind === "hr").urgency, "visit");
  assert.equal(R(mk(REST70, [[1, 80], [3, 82]], { feel: ["p_dzy"] })).lines.find((l) => l.kind === "hr").urgency, "visit");
  const flat = R(mk(REST70, [[1, 66], [3, 68]]));
  assert.ok(flat.headline.endsWith("That's no rise above lying."));
  assert.ok(textOf(flat).startsWith("Your heart rate didn't rise above your lying rate"));
});

test("c: no result line uses banned wording or names a dose", () => {
  assert.ok(allLines.length > 50);
  for (const s of allLines) { assertClean(s, "standResult"); assert.ok(!DOSE_RE.test(s), s); }
});

/* ================= c2. interruptFor ================= */
test("c2: feel chips: lie-down card upright only; chest pain goes straight to Stopped", () => {
  const t = mk(REST70, [[1, 90]]);
  for (const id of ["p_vis", "p_gi", "p_sob"]) {
    const c = interruptFor(t, { type: "feel", id, pos: "up" });
    assert.equal(c.kind, "feel");
    assert.equal(c.stop, false);
    assert.deepEqual(c.buttons, ["Stop and lie down", "I feel okay, continue"]);
    assert.equal(c.copy, "Lie down now and raise your legs. You can stop here.");
    assert.equal(interruptFor(t, { type: "feel", id, pos: "rest" }), null);
  }
  for (const id of ["p_dzy", "p_pal", "p_trem"]) assert.equal(interruptFor(t, { type: "feel", id, pos: "up" }), null);
  const chest = interruptFor(t, { type: "feel", id: "p_chest", pos: "up" });
  assert.equal(chest.kind, "chest");
  assert.equal(chest.stop, true);
  assert.equal(chest.urgent, "chest");
  assert.deepEqual(RUNNER_FEEL.map((f) => f.id), ["p_dzy", "p_pal", "p_vis", "p_gi", "p_trem", "p_sob", "p_chest"]);
  assert.deepEqual(FEEL_STOP, ["p_vis", "p_gi", "p_sob"]);
});

test("c2: heart-rate fall of 20 after the previous taken upright reading; HR 170 anywhere", () => {
  const t = mk(REST70, [[1, 120]]);
  assert.equal(interruptFor(t, { type: "reading", pos: "up", reading: { min: 3, hr: 99 } }).kind, "hrFall");
  assert.equal(interruptFor(t, { type: "reading", pos: "up", reading: { min: 3, hr: 101 } }), null);
  const skipped = mk(REST70, [[1, 120], [3, null]]);
  assert.equal(interruptFor(skipped, { type: "reading", pos: "up", reading: { min: 5, hr: 99 } }).kind, "hrFall");
  const saved = mk(REST70, [[1, 120], [3, 99]]);      // the new reading may already be saved
  assert.equal(interruptFor(saved, { type: "reading", pos: "up", reading: saved.up[1] }).kind, "hrFall");
  assert.equal(interruptFor(t, { type: "reading", pos: "up", reading: { min: 3, hr: 169 } }), null);
  assert.equal(interruptFor(t, { type: "reading", pos: "up", reading: { min: 3, hr: 170 } }).kind, "hrHigh");
  assert.equal(interruptFor(mk([], []), { type: "reading", pos: "rest", reading: { min: 4, hr: 170 } }).kind, "hrHigh");
  assert.equal(interruptFor(mk([], []), { type: "reading", pos: "rest", reading: { min: 4, hr: 169 } }), null);
});

test("c2: blood-pressure crisis and low-BP cases; with BP off only the HR and chip cases fire", () => {
  const rest = [[4, 70, 120, 80], [5, 70, 120, 80]];
  const t = mk(rest, [[1, 90, 118, 78]], { bp: true });
  const crisis = interruptFor(t, { type: "reading", pos: "up", reading: { min: 3, hr: 95, sys: 185, dia: 95 } });
  assert.equal(crisis.kind, "bpCrisis");
  // Upright the second button only reopens the reading (a typo); lying, it rechecks.
  assert.deepEqual(crisis.buttons, ["Stop the test", "I typed it wrong"]);
  assert.match(crisis.copy, /^That's a very high reading\. Stop the test, then sit or lie down/);
  assert.deepEqual(interruptFor(t, { type: "reading", pos: "rest", reading: { min: 5, hr: 70, sys: 185, dia: 95 } }).buttons, ["Stop the test", "Recheck"]);
  assert.equal(interruptFor(t, { type: "reading", pos: "rest", reading: { min: 5, hr: 70, sys: 150, dia: 120 } }).kind, "bpCrisis");
  assert.equal(interruptFor(t, { type: "reading", pos: "up", reading: { min: 3, hr: 95, sys: 80, dia: 50 } }).kind, "bpLow");
  assert.equal(interruptFor(t, { type: "reading", pos: "up", reading: { min: 3, hr: 95, sys: 81, dia: 75 } }), null);
  assert.equal(interruptFor(t, { type: "reading", pos: "rest", reading: { min: 5, hr: 70, sys: 80, dia: 50 } }), null);
  const symptomatic = { ...t, feel: ["p_dzy"] };
  assert.equal(interruptFor(symptomatic, { type: "reading", pos: "up", reading: { min: 3, hr: 95, sys: 99, dia: 79 } }).kind, "bpLow");
  assert.equal(interruptFor(t, { type: "reading", pos: "up", reading: { min: 3, hr: 95, sys: 99, dia: 79 } }), null);
  assert.equal(interruptFor(symptomatic, { type: "reading", pos: "up", reading: { min: 4, hr: 95, sys: 99, dia: 79 } }), null);
  assert.equal(interruptFor(t, { type: "reading", pos: "up", reading: { min: 3, hr: 95, sys: 99, dia: 79, feel: ["p_pal"] } }).kind, "bpLow");
  // BP off: readings carry no BP, so only heart-rate cases can fire
  const off = mk(REST70, [[1, 120]]);
  assert.equal(interruptFor(off, { type: "reading", pos: "up", reading: { min: 3, hr: 101 } }), null);
  assert.equal(interruptFor(off, { type: "reading", pos: "up", reading: { min: 3, hr: 100 } }).kind, "hrFall");
  // a real extreme reading outside the input-sanity range (not stored) still raises its card
  const fast = mk(REST70, [[1, 110, 110, 75]], { bp: true });
  const up3 = (reading) => interruptFor(fast, { type: "reading", pos: "up", reading: { min: 3, ...reading } });
  assert.equal(up3({ hr: 225 }).kind, "hrHigh");
  assert.equal(up3({ hr: 300 }).kind, "hrHigh");
  assert.equal(up3({ hr: 100, sys: 270, dia: 100 }).kind, "bpCrisis");
  assert.equal(up3({ hr: 100, sys: 150, dia: 165 }).kind, "bpCrisis");
  assert.equal(up3({ hr: 100, sys: 55, dia: 35 }).kind, "bpLow");
  assert.equal(up3({ hr: 28 }).kind, "hrFall");
  assert.equal(interruptFor(mk([], []), { type: "reading", pos: "rest", reading: { min: 4, hr: 230 } }).kind, "hrHigh");
  // only impossible values (past the plausibility cap) are ignored as typos
  assert.equal(interruptFor(off, { type: "reading", pos: "up", reading: { min: 3, hr: 1700 } }), null);
  assert.equal(interruptFor(t, { type: "reading", pos: "up", reading: { min: 3, sys: 1185, dia: 79, hr: 119 } }), null);
  assert.equal(up3({ hr: 301 }), null);
  assert.equal(interruptFor(t, null), null);
  // the early drop while symptomatic needs only one number
  assert.equal(interruptFor(symptomatic, { type: "reading", pos: "up", reading: { min: 1, hr: 100, sys: 95 } }).kind, "bpLow");
  assert.equal(interruptFor(symptomatic, { type: "reading", pos: "up", reading: { min: 1, hr: 100, dia: 69 } }).kind, "bpLow");
  assert.equal(interruptFor(symptomatic, { type: "reading", pos: "up", reading: { min: 1, hr: 100, sys: 101 } }), null);
  assert.equal(interruptFor(t, { type: "reading", pos: "up", reading: { min: 1, hr: 100, sys: 95 } }), null, "not without symptoms");
});

test("c4: POTS_BANNED catches diagnoses stated, hedged or denied, and lets the disclaimers through", () => {
  for (const bad of [
    "You have POTS.", "you do not have POTS", "You don't have POTS", "You don’t have POTS", "You may have POTS", "You might have POTS",
    "You likely have POTS", "You probably have POTS", "You could have POTS", "You've got POTS", "You’ve got POTS",
    "This result is consistent with POTS", "This rules out POTS", "This test confirms POTS", "The rise suggests POTS",
    "It indicates POTS", "points to POTS", "diagnosed with", "a positive test", "negative", "abnormal", "a normal result", "late", "missed",
  ]) assert.ok(POTS_BANNED.test(bad), bad);
  for (const ok of [
    "Cyra can't diagnose POTS; only a clinician can.", "Some people with POTS notice symptoms shift with their cycle",
    "conditions like POTS (postural orthostatic tachycardia syndrome)", "Is it safe for me to start an exercise plan?",
    "late_drop", "Could a standing test or tilt-table test help explain why I feel unwell when I stand?",
  ]) assert.ok(!POTS_BANNED.test(ok), ok);
});

test("c2: safety copy is free of banned wording and names the local emergency number", () => {
  const strs = [];
  const walk = (v) => { if (typeof v === "string") strs.push(v); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  walk(SAFETY_COPY); walk(GUIDE_COPY); walk(POTS_SYM); walk(POTS_TRIG); walk(POTS_MED_LIB); walk(RUNNER_FEEL);
  for (const s of strs) assertClean(s, "constants");
  for (const v of ["test", "faintInjury", "chest", "breath"]) assert.ok(SAFETY_COPY.urgent[v].includes("(911 in the US)"));
  assert.ok(SAFETY_COPY.urgent.faint[0].lead.includes("your local emergency number (911 in the US)"));
  assert.equal(GUIDE_VERIFIED, false);
  assert.ok(!/litres|grams/.test(json(GUIDE_COPY[0])), "unverified figures stay out until sign-off");
  for (const m of POTS_MED_LIB) assert.ok(!DOSE_RE.test(json(m)), m.name);
});

test("c2: pregnancy: 160/110 raises its own card in any position; 140/90 a same-day line on the result", () => {
  const preg = { preg: true };
  const t = mk([[4, 70, 168, 112], [5, 70, 166, 112]], [[1, 90, 165, 110], [3, 92, 166, 111], [5, 92, 164, 110], [10, 93, 165, 112]], { bp: true, restPos: "left" });
  const lying = interruptFor(t, { type: "reading", pos: "rest", reading: { min: 5, hr: 70, sys: 166, dia: 112 } }, preg);
  assert.equal(lying.kind, "bpPregSevere");
  assert.match(lying.copy, /call your maternity unit now/);
  assert.match(lying.copy, /\(911 in the US\)/);
  assert.deepEqual(lying.buttons, ["Stop the test", "I typed it wrong"]);
  assert.equal(interruptFor(t, { type: "reading", pos: "up", reading: { min: 3, hr: 92, sys: 150, dia: 110 } }, preg).kind, "bpPregSevere");
  assert.equal(interruptFor(t, { type: "reading", pos: "up", reading: { min: 3, hr: 92, sys: 200, dia: 95 } }, preg).kind, "bpPregSevere", "before the crisis card in pregnancy");
  assert.equal(interruptFor(t, { type: "reading", pos: "up", reading: { min: 3, hr: 92, sys: 159, dia: 109 } }, preg), null);
  // Outside pregnancy nothing changes: 165/112 raises no card.
  assert.equal(interruptFor(t, { type: "reading", pos: "up", reading: { min: 3, hr: 92, sys: 165, dia: 112 } }), null);
  const sev = R(t, { stage: "preg", supineCount: 1 });
  assert.equal(sev.pregBp, "severe");
  const line = sev.lines.find((l) => l.kind === "pregBp");
  assert.equal(line.urgent, "pregBp");
  assert.ok(SAFETY_COPY.urgent.pregBp.includes("(911 in the US)"));
  assert.ok(sev.lines.findIndex((l) => l.kind === "pregBp") < sev.lines.findIndex((l) => l.kind === "bp"));
  const txt = textOf(sev);
  assert.ok(!txt.includes("held steady"), txt);
  assert.ok(!txt.includes("reading too much"), txt);
  assert.match(txt, /Your blood pressure didn't drop while you were upright\./);
  const hi = R(mk([[4, 70, 145, 92], [5, 70, 144, 92]], [[1, 90, 140, 90], [3, 92, 142, 91]], { bp: true, restPos: "left" }), { stage: "preg" });
  assert.equal(hi.pregBp, "high");
  const hl = hi.lines.find((l) => l.kind === "pregBp");
  assert.equal(hl.urgency, "today"); assert.equal(hl.urgent, null);
  assert.match(hl.text, /call your maternity team today/);
  assert.equal(interruptFor(t, { type: "reading", pos: "rest", reading: { min: 5, hr: 70, sys: 145, dia: 92 } }, preg), null);
  // Not pregnant: the same readings keep today's wording.
  const std = R(t, { supineCount: 1 });
  assert.equal(std.pregBp, null);
  assert.ok(!std.lines.some((l) => l.kind === "pregBp"));
  assert.match(textOf(std), /held steady/);
  const ok = R(mk([[4, 70, 118, 76], [5, 70, 118, 76]], [[1, 90, 120, 80], [3, 92, 118, 79]], { bp: true, restPos: "left" }), { stage: "preg" });
  assert.equal(ok.pregBp, null);
  assert.match(textOf(ok), /rather than reading too much into them/);
});

test("c2: pregnancy: the lie-down cards say left side, not flat on her back", () => {
  const t = mk(REST70, [[1, 120]], { restPos: "left" });
  const preg = { preg: true };
  const cards = [
    interruptFor(t, { type: "feel", id: "p_vis", pos: "up" }, preg),
    interruptFor(t, { type: "reading", pos: "up", reading: { min: 3, hr: 99 } }, preg),
    interruptFor(t, { type: "reading", pos: "up", reading: { min: 3, hr: 175 } }, preg),
    interruptFor({ ...t, bp: true }, { type: "reading", pos: "up", reading: { min: 3, hr: 110, sys: 78, dia: 50 } }, preg),
  ];
  assert.deepEqual(cards.map((c) => c.kind), ["feel", "hrFall", "hrHigh", "bpLow"]);
  for (const c of cards) {
    assert.match(c.copy, /left side/);
    assert.ok(!/raise your legs/.test(c.copy), c.copy);
    assert.equal(c.copy, SAFETY_COPY.interruptPreg[c.kind]);
  }
  assert.equal(interruptFor(t, { type: "feel", id: "p_vis", pos: "up" }).copy, "Lie down now and raise your legs. You can stop here.");
  assert.equal(SAFETY_COPY.stoppedHead.preg, "Lie down on your left side");
  assert.match(SAFETY_COPY.urgent.faintOtherwisePreg, /left side, not flat on your back/);
});

test("c: overMins lists every upright minute at or above the threshold", () => {
  assert.deepEqual(R(mk(REST70, [[1, 85], [3, 105], [10, 104]])).overMins, [3, 10]);
  const every = R(mk(REST70, [[1, 110], [2, 108], [3, 80], [10, 86]], { sched: "every" }));
  assert.equal(every.hrStatus, "single_mid");
  assert.deepEqual(every.overMins, [1, 2]);
});

/* ================= c3. faint linking ================= */
test("c3: a test faint answer writes one linked episode; changing it updates or removes it", () => {
  let p = upsertTest(on(), mk(REST70, [[1, 90]], { id: "tst1", status: "stopped", stoppedAt: 1, t: "09:00" }));
  p = setTestFaint(p, "tst1", "yes", "09:12");
  let eps = p.days[D].eps;
  assert.equal(eps.length, 1);
  assert.deepEqual([eps[0].src, eps[0].pos, eps[0].faint, eps[0].sev, eps[0].t, eps[0].sym], ["tst1", "stoodup", "yes", 3, "09:12", ["p_psy"]]);
  assert.equal(p.tests[0].fainted, "yes");
  p = addEpisode(p, D, { ...eps[0], note: "my own words", mins: 2 });     // her edit to the linked episode
  p = setTestFaint(p, "tst1", "almost");
  eps = p.days[D].eps;
  assert.equal(eps.length, 1);
  assert.deepEqual([eps[0].faint, eps[0].sev, eps[0].note, eps[0].mins, eps[0].t], ["almost", 2, "my own words", 2, "09:12"]);
  const epId = eps[0].id;
  p = setTestFaint(p, "tst1", "no");
  assert.equal((p.days[D].eps || []).length, 0);
  assert.ok(p.gone.includes(epId));
  // deleting a test keeps the faint by default, removes it when asked
  p = setTestFaint(p, "tst1", "yes");
  assert.equal(deleteTest(p, "tst1").days[D].eps.length, 1);
  const del = deleteTest(p, "tst1", { keepFaint: false });
  assert.equal((del.days[D].eps || []).length, 0);
  assert.ok(del.gone.includes("tst1"));
  assert.equal(upsertTest(del, mk(REST70, [], { id: "tst1" })), del, "a deleted test can't come back");
});

test("c3: a session faint writes an exercise episode and pauses step-ups; counts come from episodes only", () => {
  let p = addSession(on(), D, { id: "ses1", t: "07:00", mode: "recumbent_bike", main: 15 });
  p = setSessionFaint(p, D, "ses1", "almost");
  const ep = p.days[D].eps[0];
  assert.deepEqual([ep.src, ep.pos, ep.faint, ep.sev], ["ses1", "exercise", "almost", 2]);
  assert.equal(p.move.faintPause, D);
  assert.equal(p.days[D].move[0].faint, "almost");
  p = setSessionFaint(p, D, "ses1", "almost");
  p = upsertTest(p, mk(REST70, [[1, 90]], { id: "tst2", status: "stopped" }));
  p = setTestFaint(p, "tst2", "almost");
  p = addEpisode(p, D, { sym: ["p_psy"], faint: "almost" });
  const near = Object.values(p.days).flatMap((d) => d.eps || []).filter((e) => e.faint === "almost").length;
  assert.equal(near, 3, "session, test and her own episode, each once");
  // Corrected to No: the linked episode goes, and so does the pause only this session set
  // (no other exercise faint is logged); with another exercise faint logged, the pause stays.
  const withOther = setSessionFaint(addEpisode(p, D, { sym: ["p_psy"], faint: "yes", pos: "exercise" }), D, "ses1", "no");
  assert.equal(withOther.move.faintPause, D, "another exercise faint keeps the pause until she reports being checked");
  p = setSessionFaint(p, D, "ses1", "no");
  assert.equal(p.move.faintPause, null, "a corrected answer takes back the pause it set");
  assert.equal(p.days[D].eps.filter((e) => e.src === "ses1").length, 0);
});

/* ================= c4. ids ================= */
test("c4: 17 symptoms and 15 triggers, unique, well-formed, never a check-in or weekly-count id", () => {
  const sym = POTS_SYM.map((s) => s.id), trig = POTS_TRIG.map((t) => t.id);
  assert.equal(sym.length, 17);
  assert.equal(trig.length, 15);
  assert.equal(new Set([...sym, ...trig]).size, 32);
  const taken = new Set([...Object.keys(SYM), ...Object.keys(PSYM), ...Object.keys(GSYM), "hf", "ns", "crm", "mood", "nau", "swl"]);
  for (const id of [...sym, ...trig]) { assert.match(id, /^(p|t|c|x)_[a-z0-9]{1,16}$/); assert.ok(!taken.has(id), id); }
  assert.ok(sym.every((id) => id.startsWith("p_")) && trig.every((id) => id.startsWith("t_")));
  assert.deepEqual(freshEmpty().settings.symTop, sym.slice(0, 8));
  for (let i = 0; i < 200; i++) assert.match(newId(), ID_RE);
  const c = addCustom(addCustom(on(), "sym", "Toe ache"), "trig", "Wind");
  assert.match(c.settings.customSym[0].id, /^c_[a-z0-9]{8}$/);
  assert.match(c.settings.customTrig[0].id, /^x_[a-z0-9]{8}$/);
  assert.ok(TAG_RE.test(c.settings.customSym[0].id));
  assert.equal(new Set(POTS_MED_LIB.map((m) => m.id)).size, POTS_MED_LIB.length);
});

/* ================= c5. Simple view "Took my meds" ================= */
const at = (h, m, s = 0, day = 8) => new Date(2026, 9, day, h, m, s).getTime();
const pairs = (plan) => plan.logged.map((x) => [x.medId, x.slot]);
test("c5: logs exactly what it promised, once; a 30-minute repeat guard; logs again later", () => {
  // No medicine has times: each one logs once per tap, guarded for 30 minutes.
  let u = upsertMed(on(), { id: "prop", lib: "prop", name: "Propranolol", kind: "rx" });
  u = upsertMed(u, { id: "iron", lib: "iron", name: "Iron", kind: "supp" });
  u = upsertMed(u, { id: "comp", lib: "comp_waist", name: "Compression (waist-high)", kind: "aid" });
  const promised = medsNowPlan(u, D, at(12, 4));
  assert.deepEqual(pairs(promised), [["prop", null], ["iron", null]]);
  const first = logMedsNow(u, D, at(12, 4));
  assert.deepEqual(pairs(first), pairs(promised));
  assert.deepEqual(first.p.days[D].doses.map((d) => [d.medId, d.slot, d.t, d.state]), [["prop", null, "12:04", "taken"], ["iron", null, "12:04", "taken"]]);
  assert.deepEqual(first.logged.map((x) => x.id), first.p.days[D].doses.map((d) => d.id));
  const second = logMedsNow(first.p, D, at(12, 4, 5));
  assert.deepEqual(second.logged, []);
  assert.deepEqual(second.guarded.map((g) => [g.medId, g.t]), [["prop", "12:04"], ["iron", "12:04"]]);
  assert.equal(second.p.days[D].doses.length, 2);
  const later = logMedsNow(first.p, D, at(12, 35));
  assert.deepEqual(pairs(later), [["prop", null], ["iron", null]]);
  assert.equal(later.p.days[D].doses.length, 4);
});

test("c5: with any planned times, only timed medicines log, one dose each per tap", () => {
  // Mixed list: Iron (no times) is never logged by the tile while Midodrine has times.
  let p = upsertMed(on(), { id: "mido", lib: "mido", name: "Midodrine", kind: "rx", times: ["08:00", "12:00", "16:00"] });
  p = upsertMed(p, { id: "iron", lib: "iron", name: "Iron", kind: "supp" });
  for (const [h, slot] of [[8, "08:00"], [12, "12:00"], [16, "16:00"]]) {
    const r = logMedsNow(p, D, at(h, 5));
    assert.deepEqual(pairs(r), [["mido", slot]]);
    p = r.p;
  }
  assert.deepEqual(p.days[D].doses.map((d) => [d.medId, d.slot, d.t]), [["mido", "08:00", "08:05"], ["mido", "12:00", "12:05"], ["mido", "16:00", "16:05"]]);
  assert.deepEqual(pairs(medsNowPlan(p, D, at(17, 0))), [], "nothing due, so nothing logged");
  // Once the timed medicine is stopped, the untimed one logs again.
  assert.deepEqual(pairs(medsNowPlan(stopMed(p, "mido", "2026-10-07"), D, at(12, 4))), [["iron", null]]);
  // Two slots in the window: one tap logs one dose (the latest slot at or before now) ...
  let q = upsertMed(on(), { id: "pyri", lib: "pyri", name: "Pyridostigmine", kind: "rx", times: ["08:00", "10:00"] });
  const both = logMedsNow(q, D, at(10, 0));
  assert.deepEqual(both.p.days[D].doses.map((d) => [d.slot, d.t]), [["10:00", "10:00"]]);
  // ... the earlier slot is never logged after a later one (no false dose at 10:45)
  assert.deepEqual(pairs(medsNowPlan(both.p, D, at(10, 45))), []);
  assert.deepEqual(pairs(medsNowPlan(q, D, at(9, 0))), [["pyri", "08:00"]]);
  assert.deepEqual(pairs(medsNowPlan(q, D, at(7, 30))), [["pyri", "08:00"]], "else the next slot within the hour");
  q = logDose(q, D, { medId: "pyri", slot: "08:00", state: "skipped", t: "08:10" });
  assert.deepEqual(pairs(medsNowPlan(q, D, at(9, 30))), [["pyri", "10:00"]]);
});

test("c5: the repeat guard works across midnight", () => {
  const p = upsertMed(on(), { id: "prop", name: "Propranolol", kind: "rx" });
  const late = logMedsNow(p, D, at(23, 50));
  assert.equal(late.logged.length, 1);
  const after = logMedsNow(late.p, D2, at(0, 5, 0, 9));
  assert.deepEqual(after.logged, []);
  assert.deepEqual(after.guarded.map((g) => [g.medId, g.t]), [["prop", "23:50"]]);
  assert.equal(logMedsNow(late.p, D2, at(0, 21, 0, 9)).logged.length, 1, "31 minutes later it logs");
});

/* ================= d. units, totals, due doses ================= */
test("d: unit conversions and display", () => {
  assert.equal(OZ_ML, 29.5735);
  assert.equal(NA_PER_G_SALT, 393);
  assert.ok(Math.abs(ozToMl(1) - 29.5735) < 1e-9);
  assert.ok(Math.abs(mlToOz(ozToMl(8)) - 8) < 1e-9);
  assert.equal(saltGToNaMg(1), 393);
  assert.ok(Math.abs(naMgToSaltG(1800) - 4.58) < 0.01);
  assert.equal(fmtFluid(1250, { fluid: "ml" }), "1.25 L");
  assert.equal(fmtFluid(500, { fluid: "ml" }), "0.5 L");
  assert.equal(fmtFluid(2000), "2 L");
  assert.equal(fmtFluid(1250, { fluid: "oz" }), "42 oz");
  assert.equal(fmtFluid(null), null);
  assert.equal(fmtSodium(1800, { salt: "mgNa" }), "1,800 mg");
  assert.equal(fmtSodium(1234), "1,230 mg");
  assert.equal(fmtSodium(1800, { salt: "gSalt" }), "4.6 g salt");
  assert.equal(fmtSodium(undefined), null);
});

test("d: day totals: IV kept apart, electrolytes count twice, missing is not zero", () => {
  assert.deepEqual([dayTotals(on(), D).fluidMl, dayTotals(on(), D).naMg, dayTotals(on(), D).hasFluid], [null, null, false]);
  let p = addIntake(on(), D, { kind: "water", label: "Glass", ml: 250 });
  p = addIntake(p, D, { kind: "electrolyte", label: "Electrolyte drink", ml: 500, naMg: 480 });
  p = addIntake(p, D, { kind: "tablet", label: "Salt tablet", naMg: 500 });
  p = setIv(p, D, { ml: 1000, note: "" });
  const t = dayTotals(p, D);
  assert.deepEqual([t.fluidMl, t.naMg, t.ivMl, t.iv, t.nIntake, t.hasFluid, t.hasSodium], [750, 980, 1000, true, 3, true, true]);
  // A salty snack whose sodium she doesn't know is logged, amount unknown (never 0).
  const snack = addIntake(on(), D, { kind: "food", label: "Salty snack", ml: null, naMg: null, presetId: "snack" });
  assert.equal(snack.days[D].intake.length, 1);
  assert.deepEqual([dayTotals(snack, D).nIntake, dayTotals(snack, D).naMg, dayTotals(snack, D).hasSodium, dayTotals(snack, D).fluidMl], [1, null, false, null]);
  assert.equal(addIntake(on(), D, { ml: null, naMg: null }).days[D], undefined, "nothing at all to log");
  const saltOnly = dayTotals(addIntake(on(), D, { kind: "salt", naMg: 580 }), D);
  assert.equal(saltOnly.fluidMl, null);
  assert.equal(saltOnly.naMg, 580);
  const g = dayTotals(setSettings(p, { goals: { fluidMl: 2500, by: "clinician" } }), D);
  assert.equal(g.goals.fluidMl, 2500);
  p = upsertMed(p, { id: "m1", name: "Midodrine", times: ["08:00", "12:00"] });
  p = logDose(p, D, { medId: "m1", slot: "08:00", state: "taken", t: "08:05" });
  p = logDose(p, D, { medId: "m1", slot: "12:00", state: "skipped", t: "12:30" });
  assert.deepEqual([dayTotals(p, D).doneDoses, dayTotals(p, D).dueDoses], [1, 2]);
  p = logDose(p, D, { medId: "m1", slot: "12:00", state: "taken", t: "12:40" });
  assert.equal(p.days[D].doses.length, 2, "a slot is logged once; a later answer replaces it");
  assert.equal(dayTotals(p, D).doneDoses, 2);
});

test("d: due doses window: 180 minutes back and 60 ahead, both ends included", () => {
  const p = upsertMed(on(), { id: "m1", name: "Midodrine", times: ["08:59", "09:00", "13:00", "13:01"] });
  assert.deepEqual(dueDoses(p, D, "12:00").map((x) => x.slot), ["09:00", "13:00"]);
  const logged = logDose(p, D, { medId: "m1", slot: "09:00", state: "skipped", t: "09:30" });
  assert.deepEqual(dueDoses(logged, D, "12:00").map((x) => x.slot), ["13:00"]);
  assert.deepEqual(dueDoses(p, D, "12:00", { back: 181, ahead: 61 }).map((x) => x.slot), ["08:59", "09:00", "13:00", "13:01"]);
  assert.deepEqual(dueDoses(upsertMed(p, { id: "m2", name: "Compression (leg)", kind: "aid", times: ["12:00"] }), D, "12:00").map((x) => x.med.id), ["m1", "m1"]);
});

test("d: actions are pure and keep the day sparse", () => {
  const p0 = on(), snap = json(p0);
  let p = setRating(p0, D, 2);
  p = setUp(p, D, 7); p = cycleSym(p, D, "p_dzy"); p = cycleSym(p, D, "p_dzy"); p = toggleTrig(p, D, "t_heat");
  p = setSleep(p, D, "good"); p = setNote(p, D, " hi "); p = tickPlan(p, D, "pl1"); p = setAid(p, D, "m1", false);
  p = addVitals(p, D, { pos: "standing", hr: 110, sys: 300 });
  assert.equal(json(p0), snap, "input never mutated");
  const d = p.days[D];
  assert.deepEqual([d.rating, d.up, d.sym.p_dzy, d.trig, d.sleep, d.note, d.plan, d.aids, d.vit[0].hr, d.vit[0].sys], [2, 7, 2, ["t_heat"], "good", "hi", { pl1: true }, { m1: false }, 110, null]);
  p = setRating(p, D, null); p = setUp(p, D, null); p = cycleSym(cycleSym(p, D, "p_dzy"), D, "p_dzy"); p = toggleTrig(p, D, "t_heat");
  p = setSleep(p, D, null); p = setNote(p, D, ""); p = tickPlan(p, D, "pl1"); p = setAid(p, D, "m1", null); p = removeItem(p, D, d.vit[0].id);
  assert.deepEqual(p.days[D], {});
  assert.equal(addEpisode(on(), D, { sym: [] }).days[D], undefined, "an episode needs a symptom or a faint");
  assert.equal(addEpisode(on(), D, { faint: "yes" }).days[D].eps.length, 1);
  assert.equal(addVitals(on(), D, { hr: 10 }).days[D], undefined);
  const o = on();
  assert.equal(addIntake(o, "Oct 8", { ml: 250 }), o, "a bad day key changes nothing");
  assert.equal(addIntake(o, D, { ml: 0 }).days[D], undefined, "an amount is required");
  const ed = upsertTest(on(), mk([[4, 66, null, null, "counted"], [5, 70]], [[1, 88], [3, 96], [5, 101], [10, 104]], { id: "te" }));
  const fixed = editTestReadings(ed, "te", { up: [null, null, null, { hr: 140 }], rest: [{ hr: 66 }] });
  assert.equal(fixed.tests[0].edited, true);
  assert.equal(fixed.tests[0].up[3].hr, 140);
  assert.equal(fixed.tests[0].up[3].min, 10);
  assert.equal(fixed.tests[0].rest[0].how, "counted", "unchanged heart rate stays counted");
  assert.equal(editTestReadings(ed, "te", { up: [{ hr: 88 }] }), ed, "no change, no edit flag");
  assert.equal(editTestReadings(upsertTest(on(), { id: "r", date: D, t: "09:00", status: "running", up: [{ min: 1, hr: 90 }] }), "r", { up: [{ hr: 91 }] }).tests[0].up[0].hr, 90);
  const s = updateSession(addSession(on(), D, { id: "s1", mode: "walk", main: 10 }), D, "s1", { next: "worse", effort: 6 });
  assert.deepEqual([s.days[D].move[0].next, s.days[D].move[0].effort, typeof s.days[D].move[0].upd], ["worse", 6, "number"]);
});

/* ================= e. weekly-count isolation ================= */
/* lib/pulse.js imports lib/api.js, which reads Vite's import.meta.env, so the two functions
   under test are lifted from the real source text rather than from a copy. */
function lift(src, start) {
  const i = src.indexOf(start);
  assert.ok(i >= 0, `${start} not found in pulse.js`);
  let j = start.startsWith("export function") ? src.indexOf(") {", i) + 2 : src.indexOf("{", i);
  let depth = 0, k = j;
  for (; k < src.length; k++) { if (src[k] === "{") depth++; else if (src[k] === "}" && --depth === 0) break; }
  return src.slice(i, k + 1).replace(/^export /, "");
}
const pulseSrc = readFileSync(new URL("./pulse.js", import.meta.url), "utf8");
const pulse = await import("data:text/javascript," + encodeURIComponent(`${lift(pulseSrc, "export const PULSE_EVENTS = {")};\n${lift(pulseSrc, "export function eventsForDay(")}\nexport { PULSE_EVENTS, eventsForDay };`));

test("e: POTS fields never change weekly counts, in any stage", () => {
  const potsDay = cleanPots(messy()).days[D];
  const allSym = Object.fromEntries([...POTS_SYM, ...POTS_TRIG].map((s) => [s.id, 3]));
  const entries = [
    { sym: { hf: 2, ns: 1, crm: 1, mood: 2, nau: 1, swl: 1 }, sleepQ: "poor", flow: "heavy", phase: "luteal", late: 0 },
    { sym: {}, sleepQ: "good" },
    {},
  ];
  for (const stage of ["peri", "periods", "preg"]) {
    for (const entry of entries) {
      const plain = pulse.eventsForDay(stage, entry);
      // every POTS day field alongside the check-in, and every POTS symptom / trigger id in its sym map
      assert.deepEqual(pulse.eventsForDay(stage, { ...potsDay, ...entry, sym: { ...(entry.sym || {}), ...potsDay.sym, ...allSym } }), plain);
    }
    assert.deepEqual(pulse.eventsForDay(stage, potsDay), [], "a POTS day on its own is no event");
  }
  const flags = new Set(Object.values(pulse.PULSE_EVENTS).flat().map(([id]) => id));
  for (const s of [...POTS_SYM, ...POTS_TRIG]) assert.ok(!flags.has(s.id) && !(s.id in SYM) && !(s.id in PSYM) && !(s.id in GSYM));
  // A POTS day spread over a check-in entry carries no field eventsForDay reads.
  assert.deepEqual(Object.keys(potsDay).filter((k) => ["sym", "sleepQ", "flow", "phase", "late", "kicks"].includes(k)), ["sym"]);
  assert.ok(Object.keys(potsDay.sym).every((k) => TAG_RE.test(k)));
});

/* ================= s2. the Settings switch, stage changes, merge bookkeeping ================= */
test("s2: localeUnits: US English shows ounces, every other language millilitres; sodium in mg", () => {
  assert.deepEqual(localeUnits("en-US"), { fluid: "oz", salt: "mgNa" });
  for (const l of ["en-GB", "en-CA", "fr-FR", "es-US", "", undefined]) assert.deepEqual(localeUnits(l === undefined ? "de" : l), { fluid: "ml", salt: "mgNa" });
});

test("s2: turnOn the first time starts an epoch, sets since, Simple view and units; later turn-ons change nothing else", () => {
  const p0 = freshEmpty();
  const a = turnOn(p0, { day: D, simple: true, units: { fluid: "oz", salt: "mgNa" }, nowMs: 5000 });
  assert.equal(a.on, true); assert.equal(a.since, D); assert.equal(a.epochAt, 5000);
  assert.ok(ID_RE.test(a.epoch)); assert.equal(a.settings.simple, true); assert.deepEqual(a.settings.units, { fluid: "oz", salt: "mgNa" });
  assert.deepEqual(p0, freshEmpty(), "input not mutated");
  assert.deepEqual(cleanPots(a), a, "the result is already clean");
  // off, change display choices, on again: the epoch, since and her choices stay
  const b = setSettings(turnOff(a), { simple: false, units: { fluid: "ml" } });
  assert.equal(b.on, false);
  const c = turnOn(b, { day: D2, simple: true, units: { fluid: "oz", salt: "gSalt" }, nowMs: 9000 });
  assert.equal(c.on, true); assert.equal(c.epoch, a.epoch); assert.equal(c.epochAt, 5000); assert.equal(c.since, D);
  assert.equal(c.settings.simple, false); assert.equal(c.settings.units.fluid, "ml");
  // an erased log (new epoch, since kept) turns on again in that same epoch
  const e = eraseLog(c, 12000), f = turnOn(turnOff(e), { day: D2, nowMs: 15000 });
  assert.equal(f.epoch, e.epoch); assert.equal(f.epochAt, 12000);
  // a log adopted with an epoch but no since (never turned on here) keeps that epoch
  const g = turnOn({ ...freshEmpty(), epoch: "e7", epochAt: 70 }, { day: D, nowMs: 99 });
  assert.equal(g.epoch, "e7"); assert.equal(g.epochAt, 70); assert.equal(g.since, D);
});

test("s2: turnOn / turnOff never touch the log or the stage, and leave a locked record alone", () => {
  let p = turnOn(freshEmpty(), { day: D, nowMs: 1 });
  p = addIntake(p, D, { id: "i1", t: "09:00", kind: "water", label: "Glass", ml: 250 });
  p = setRating(p, D, 3);
  const off = turnOff(p);
  assert.deepEqual({ ...off, on: true }, p, "only the switch changed");
  assert.equal(turnOff(off), off, "already off: unchanged");
  assert.deepEqual(turnOn(off, { day: D2, nowMs: 2 }), p, "back on: the same log");
  for (const x of [p, off]) assert.ok(!("stage" in x) && !("stageName" in x));
  const locked = { v: 2, on: true, future: { a: 1 } };
  assert.equal(turnOn(locked, { day: D }), locked); assert.equal(turnOff(locked), locked);
  assert.equal(resetPregClearance(locked), locked);
  assert.ok(isLockedPots(locked) && typeof POTS_LOCKED_COPY === "string" && /^Update Cyra to see your POTS log\./.test(POTS_LOCKED_COPY));
  assertClean(POTS_LOCKED_COPY, "POTS_LOCKED_COPY");
});

test("s2: finishSetup marks setup done once, and leaves a locked record alone", () => {
  const p = turnOn(freshEmpty(), { day: D, nowMs: 1 });
  const q = finishSetup(p);
  assert.equal(q.setupDone, true); assert.equal(p.setupDone, false);
  assert.equal(finishSetup(q), q);
  assert.deepEqual({ ...q, setupDone: false }, p, "nothing else changes");
  const locked = { v: 2 }; assert.equal(finishSetup(locked), locked);
  assert.equal(eraseLog(q).setupDone, true, "an erase keeps setup done");
});

test("s2: a change of stage into Pregnancy clears only the prenatal-team answer", () => {
  const base = turnOn(freshEmpty(), { day: D, nowMs: 1 });
  assert.equal(resetPregClearance(base), base, "no program: unchanged");
  const prog = { cleared: "yes", clearedOn: D, clearedPreg: "yes", clearedPregOn: D, pem: "no", step: 2, start: D, days: [1, 3], mainMin: 20, hrNote: "from my physio" };
  const p = cleanPots({ ...base, move: { program: prog, faintPause: null } });
  const r = resetPregClearance(p);
  assert.deepEqual(r.move.program, { ...p.move.program, clearedPreg: null, clearedPregOn: null });
  assert.equal(r.move.program.cleared, "yes", "the non-pregnancy answer stays");
  assert.deepEqual(cleanPots(r), r);
  assert.equal(resetPregClearance(r), r, "nothing left to clear: the same object (no save churn)");
  assert.equal(p.move.program.clearedPreg, "yes", "input not mutated");
});

test("s2: samePots ignores key order and undefined keys, and sees real changes", () => {
  const a = turnOn(freshEmpty(), { day: D, nowMs: 1 });
  const reordered = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(a).reverse())));
  assert.ok(samePots(a, reordered) && samePots(a, { ...a, extra: undefined }));
  assert.ok(!samePots(a, setRating(a, D, 2)) && !samePots(a, turnOff(a)));
  // a merge that changed nothing is the same content as the stored copy
  assert.ok(samePots(mergePots(a, reordered, a), a));
});

/* ================= s3: the daily loop's helpers ================= */
test("s3: updateItem edits a logged intake, dose, episode or reading in place, with upd; invalid edits change nothing", () => {
  let p = addIntake(on(), D, { id: "i1", t: "09:40", kind: "water", label: "Glass", ml: 250 });
  p = logDose(p, D, { id: "d1", medId: "m1", slot: "08:00", state: "taken", t: "08:05" });
  p = addEpisode(p, D, { id: "e1", t: "10:00", sym: ["p_dzy"], sev: 2 });
  p = addVitals(p, D, { id: "v1", t: "11:00", pos: "standing", hr: 96 });
  const q = updateItem(p, D, "i1", { ml: 300, naMg: 120, t: "09:45" });
  const it = q.days[D].intake[0];
  assert.equal(it.ml, 300); assert.equal(it.naMg, 120); assert.equal(it.t, "09:45"); assert.ok(it.upd > 0);
  assert.equal(updateItem(p, D, "d1", { t: "08:20", state: "skipped" }).days[D].doses[0].state, "skipped");
  assert.deepEqual(updateItem(p, D, "e1", { sym: ["p_dzy", "p_fog"], faint: "almost" }).days[D].eps[0].sym, ["p_dzy", "p_fog"]);
  assert.equal(updateItem(p, D, "v1", { hr: 400 }).days[D].vit[0].hr, null, "an out-of-range value is dropped, as the sanitizer does");
  assert.equal(updateItem(p, D, "i1", { t: "25:00" }), p, "a bad time leaves the item as it was");
  assert.equal(updateItem(p, D, "nope", { ml: 1 }), p);
  assert.equal(updateItem(p, D2, "i1", { ml: 1 }), p);
  assert.equal(updateItem(p, D, "i1", null), p);
  // the original is never mutated, and a merge picks the edited copy (changed vs base)
  assert.equal(p.days[D].intake[0].ml, 250);
  assert.equal(mergePots(p, q, p).days[D].intake[0].ml, 300);
});

test("s3: removePreset removes and tombstones a button, so a stale tab can't merge it back; defaults move on", () => {
  const p = setSettings(on(), { defaultFluid: "glass", defaultSalt: "tab" });
  const q = removePreset(removePreset(p, "glass"), "tab");
  assert.ok(!q.settings.presets.some((x) => x.id === "glass" || x.id === "tab"));
  assert.ok(q.gone.includes("glass") && q.gone.includes("tab"));
  assert.equal(q.settings.defaultFluid, "bottle"); assert.equal(q.settings.defaultSalt, "snack");
  assert.ok(!mergePots(q, p, p).settings.presets.some((x) => x.id === "glass"), "a stale tab doesn't bring it back");
  assert.equal(removePreset(p, "nope"), p);
  const locked = { v: 2 }; assert.equal(removePreset(locked, "glass"), locked);
});

test("s3: removing a plan item tombstones it: the next save's merge and a stale tab can't bring it back", () => {
  const saved = setSettings(on(), { plan: [{ id: "pl1", label: "Compression stockings" }, { id: "pl2", label: "Sit to shower" }] });
  assert.deepEqual(saved.gone, [], "adding items tombstones nothing");
  const removed = removePlanItem(saved, "pl1");
  assert.deepEqual(removed.settings.plan.map((x) => x.id), ["pl2"]);
  assert.ok(removed.gone.includes("pl1"));
  // the single-tab autosave: mergePots(stored, local, base) with stored = base = the saved copy
  assert.deepEqual(mergePots(saved, removed, saved).settings.plan.map((x) => x.id), ["pl2"], "the save keeps it removed");
  // a stale tab (still has it, base = the old saved copy) saves after the removal was stored
  const stale = setSettings(saved, { plan: [...saved.settings.plan, { id: "pl3", label: "Salt at breakfast" }] });
  assert.deepEqual(mergePots(removed, stale, saved).settings.plan.map((x) => x.id), ["pl2", "pl3"], "the stale tab's new item stays, the removed one doesn't return");
  // the same rule for any removal through setSettings; a reorder tombstones nothing
  assert.ok(setSettings(saved, { plan: [saved.settings.plan[1]] }).gone.includes("pl1"));
  assert.deepEqual(setSettings(saved, { plan: [...saved.settings.plan].reverse() }).gone, []);
  assert.equal(removePlanItem(saved, "nope"), saved);
  const locked = { v: 2 }; assert.equal(removePlanItem(locked, "pl1"), locked);
});

test("s3: doseTime never records a time that hasn't happened yet", () => {
  const at = (hhmm) => new Date(`${D}T${hhmm}:00`).getTime();
  assert.equal(doseTime("20:00", true, at("16:30")), "16:30", "a slot 3.5 h ahead logs now");
  assert.equal(doseTime("20:00", true, at("16:00")), "16:00", "a slot 4 h ahead logs now");
  assert.equal(doseTime("12:00", true, at("11:30")), "11:30", "a slot just ahead logs now");
  assert.equal(doseTime("08:00", true, at("09:30")), "09:30", "a slot within 3 h past logs now");
  assert.equal(doseTime("08:00", true, at("11:00")), "11:00", "exactly 3 h past logs now");
  assert.equal(doseTime("08:00", true, at("11:01")), "08:00", "more than 3 h past: she is catching up, the slot's time");
  assert.equal(doseTime("20:00", false, at("09:00")), "20:00", "an earlier day keeps the slot's time");
  assert.equal(doseTime(null, true, at("09:00")), "09:00");
  assert.equal(doseTime(null, false, at("09:00")), "09:00");
});

test("s3: a single reading (no test, resting) past the input-sanity range still raises its card", () => {
  const card = (reading) => (interruptFor(null, { type: "reading", reading, pos: "rest" }) || {}).kind || null;
  assert.equal(card({ hr: 230 }), "hrHigh", "HR 230 is outside the stored range but still a very fast heart rate");
  assert.equal(card({ hr: 200 }), "hrHigh");
  assert.equal(card({ sys: 270, dia: 130 }), "bpCrisis");
  assert.equal(card({ sys: 150, dia: 165 }), "bpCrisis");
  assert.equal(card({ sys: 185, dia: 100 }), "bpCrisis");
  assert.equal(card({ hr: 400 }), null, "past the plausibility cap it can only be a typo");
  assert.equal(card({ hr: 96, sys: 70, dia: 40 }), null, "the low-BP card is upright only");
});

test("s3: raiseSym only raises; markQuick, setFaintPause and markOffered set one field; nearFaintDays counts days, not episodes", () => {
  let p = setSym(on(), D, "p_dzy", 2);
  assert.equal(raiseSym(p, D, "p_dzy", 1), p);
  assert.equal(raiseSym(p, D, "p_dzy", 3).days[D].sym.p_dzy, 3);
  assert.equal(raiseSym(p, D, "p_fog", 2).days[D].sym.p_fog, 2);
  assert.equal(markQuick(p, D).days[D].quick, true);
  assert.equal(markQuick(on(), D2).days[D2].quick, true, "a Simple-view log on a new day marks it");
  assert.equal(setFaintPause(on(), D).move.faintPause, D);
  { const base = on(); assert.equal(setFaintPause(base, "bad"), base); assert.equal(markOffered(base, "bad"), base); }
  assert.equal(markOffered(on(), D).offered, D);
  const locked = { v: 2 };
  for (const f of [(x) => raiseSym(x, D, "p_dzy", 3), (x) => markQuick(x, D), (x) => setFaintPause(x, D), (x) => markOffered(x, D)]) assert.equal(f(locked), locked);
  // near-faint days: "almost" episodes on 3 different days in the 7 ending on D; two on one day count once
  const days = ["2026-10-01", "2026-10-03", "2026-10-05", "2026-10-08"];
  let q = on();
  q = addEpisode(q, days[0], { t: "09:00", faint: "almost" }); // 7 days before D (Oct 2 - 8 is the window): outside
  q = addEpisode(q, days[1], { t: "09:00", faint: "almost" });
  q = addEpisode(q, days[2], { t: "09:00", faint: "almost" });
  q = addEpisode(q, days[2], { t: "10:00", faint: "almost" });
  assert.equal(nearFaintDays(q, D), 2);
  q = setTestFaint(upsertTest(q, { id: "t1", date: D, t: "09:00", status: "done", rest: [], up: [] }), "t1", "almost");
  assert.equal(nearFaintDays(q, D), 3, "a test's near-faint counts (from its linked episode)");
  q = addEpisode(q, D, { t: "11:00", faint: "yes", sym: ["p_psy"] });
  assert.equal(nearFaintDays(q, D), 3, "a full faint isn't a near-faint");
  assert.equal(nearFaintDays({ v: 2 }, D), 0);
});

test("s3: the erase confirm names what eraseLog keeps (display choices only)", () => {
  for (const kept of ["units", "paper size", "Simple view", "which cards show", "the order of Cyra's own symptom chips", "your stand-test setup", "the teen threshold setting", "whether notes and cycle details go in reports"]) assert.ok(POTS_ERASE.includes(kept), kept);
  assert.ok(!POTS_BANNED.test(POTS_ERASE));
});

/* ================= s4: the standing test (schedule, trend, tilt notes, runner writes) ================= */
test("s4: rest readings at restMin-1 and restMin; upright at 1, 3, 5, 10 or every minute; BP only at 1, 3, 5, 10", () => {
  assert.deepEqual(restChecks(5), [4, 5]);
  assert.deepEqual(restChecks(10), [9, 10]);
  assert.deepEqual(restChecks("x"), [4, 5]);
  assert.deepEqual(standChecks("1-3-5-10"), [1, 3, 5, 10]);
  assert.deepEqual(standChecks("every"), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(standChecks("newer"), [1, 3, 5, 10]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(bpAsked), [1, 3, 5, 10]);
});

test("s4: savedUpTo names the last upright minute with a reading (0 before standing)", () => {
  assert.equal(savedUpTo(mk(REST70, [])), 0);
  assert.equal(savedUpTo(mk(REST70, [[1, 90], [3, 95], [5, null]])), 3);
  assert.equal(savedUpTo(mk(REST70, [[1, 90], [3, 95], [5, 99]])), 5);
  assert.equal(savedUpTo(null), 0);
});

test("s4: testTrend lists finished tests with a rise, oldest first; running and insufficient tests are left out", () => {
  let p = on();
  p = upsertTest(p, mk([[4, 66], [5, 70]], [[1, 88], [3, 96], [5, 101], [10, 104]], { id: "a", date: "2026-10-01" }));
  p = upsertTest(p, mk(REST70, [[1, 80], [3, 85]], { id: "b", date: "2026-10-03", status: "stopped", stoppedAt: 3 }));
  p = upsertTest(p, mk(REST70, [[1, 90]], { id: "c", date: "2026-10-04" }));
  p = upsertTest(p, mk(REST70, [[1, 90], [3, 95]], { id: "d", date: "2026-10-05", status: "running" }));
  p = upsertTest(p, mk(REST70, [[1, 85], [3, 90], [5, 92], [10, 95]], { id: "e", date: "2026-09-30", method: "lean" }));
  const tr = testTrend(p);
  assert.deepEqual(tr.map((x) => x.id), ["e", "a", "b"]);
  assert.deepEqual(tr.find((x) => x.id === "a"), { id: "a", date: "2026-10-01", t: "09:00", method: "stand", rise: 36, complete: true });
  assert.equal(tr.find((x) => x.id === "b").complete, false);
  assert.equal(tr.find((x) => x.id === "e").method, "lean");
  assert.deepEqual(testTrend({ v: 2 }), []);
  assert.deepEqual(testTrend(null), []);
});

test("s4: median", () => {
  assert.equal(median([]), null);
  assert.equal(median([34]), 34);
  assert.equal(median([40, 20, 30]), 30);
  assert.equal(median([20, 30, 40, 50]), 35);
});

test("s4: removeTilt removes and tombstones a tilt note, so a stale tab can't merge it back", () => {
  let p = addTilt(on(), { id: "tl1", date: D, told: "Rise of 35, they said" });
  p = addTilt(p, { id: "tl2", date: D2, where: "City clinic" });
  const base = p;
  const q = removeTilt(p, "tl1");
  assert.deepEqual(q.tilt.map((x) => x.id), ["tl2"]);
  assert.ok(q.gone.includes("tl1"));
  assert.equal(removeTilt(q, "nope"), q);
  assert.deepEqual(mergePots(base, q, base).tilt.map((x) => x.id), ["tl2"]); // stale stored copy
  assert.deepEqual(mergePots(q, base, base).tilt.map((x) => x.id), ["tl2"]); // stale local copy
  const locked = { v: 2, tilt: [{ id: "x" }] };
  assert.equal(removeTilt(locked, "x"), locked);
});

test("s4: the runner's writes: created running, readings replace by minute, Stop saves stopped, a kept flag passes through", () => {
  const t0 = { ...mk([], [], { id: "run1", status: "running", upd: 0 }), rest: [], up: [] };
  let p = upsertTest(on(), t0);
  assert.equal(p.tests[0].status, "running");
  assert.ok(p.tests[0].upd > 0);
  const add = (q, list, r) => upsertTest(q, { ...q.tests[0], [list]: [...q.tests[0][list].filter((x) => x.min !== r.min), r].sort((a, b) => a.min - b.min) });
  p = add(p, "rest", { min: 4, hr: 66, sys: null, dia: null });
  p = add(p, "rest", { min: 5, hr: 70, sys: null, dia: null });
  p = add(p, "up", { min: 1, atSec: 61, hr: 88, sys: null, dia: null, feel: [] });
  p = add(p, "up", { min: 1, atSec: 70, hr: 89, sys: null, dia: null, feel: ["p_dzy"], how: "counted" }); // a recheck replaces minute 1
  assert.deepEqual(p.tests[0].up.map((r) => [r.min, r.hr, r.how]), [[1, 89, "counted"]]);
  p = upsertTest(p, { ...p.tests[0], status: "stopped", stoppedAt: 1.4, why: "symptoms" });
  assert.equal(p.tests[0].status, "stopped");
  assert.equal(p.tests[0].stoppedAt, 1.4);
  p = upsertTest(p, { ...p.tests[0], status: "interrupted", kept: true });
  assert.equal(cleanPots(p).tests[0].kept, true);
  assert.equal(markStaleRunning(p, Date.now() + 3600000), p); // nothing running: unchanged
});

test("s4: a test left running is marked interrupted only after 30 minutes without activity", () => {
  const now = 10_000_000;
  const p = { ...on(), tests: [{ ...mk(REST70, [[1, 90]], { id: "r1", status: "running" }), upd: now - 29 * 60000 }, { ...mk(REST70, [[1, 90], [3, 99]], { id: "r2", status: "running", date: D2 }), upd: now - 31 * 60000 }] };
  const q = markStaleRunning(p, now);
  assert.deepEqual(q.tests.map((t) => t.status), ["running", "interrupted"]);
  assert.equal(savedUpTo(q.tests[1]), 3);
});

test("s4: every line of every result the runner can show, and its fixed ending, is free of banned wording", () => {
  const cases = [
    mk(REST70, [[1, 88], [3, 96], [5, 101], [10, 104]], { bp: true, rest: [{ min: 4, hr: 70, sys: 150, dia: 95 }, { min: 5, hr: 70, sys: 150, dia: 95 }], up: [{ min: 1, atSec: 60, hr: 100, sys: 120, dia: 80, feel: ["p_vis"] }, { min: 3, atSec: 180, hr: 104, sys: 118, dia: 79, feel: [] }], fainted: "yes" }),
    mk([[4, 101], [5, 103]], [[1, 130], [3, 125]], { status: "stopped", stoppedAt: 3.2, why: "faint", edited: true, ctx: { rateMed: "yes" } }),
    mk(REST70, [], { status: "stopped", stoppedAt: 0 }),
    mk(REST70, [[1, 80], [3, 85]], { status: "interrupted" }),
  ];
  for (const t of cases) for (const stage of ["peri", "periods", "preg"]) for (const teen of [false, true]) {
    const r = standResult(t, { stage, teen, supineCount: 2, firstFinding: true, daySym: { p_dzy: 2 } });
    for (const l of r.lines) { assertClean(l.text, `${stage} ${l.kind}`); assert.ok(!DOSE_RE.test(l.text), l.text); }
    if (r.headline) assertClean(r.headline, "headline");
  }
  assertClean(RESULT_FOOT, "RESULT_FOOT");
});

/* ================= source greps (A13, design 11.6) ================= */
test("source: POTS files make no network or storage call and never deep-clone with structuredClone", () => {
  // Every POTS-only source file: the engine (src/lib/pots*.js), the POTS tab
  // (src/screens/PotsScreen.jsx) and everything under src/components/pots/ (the Settings
  // switch today; each later slice's components land there and are covered automatically).
  const lib = new URL("./", import.meta.url), src = new URL("../", import.meta.url);
  const walk = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(new URL(`${e.name}/`, dir)) : /\.(js|jsx|mjs)$/.test(e.name) && !/\.test\./.test(e.name) ? [new URL(e.name, dir)] : [])) : []);
  const files = [
    ...readdirSync(lib).filter((f) => /^pots.*\.js$/.test(f)).map((f) => new URL(f, lib)),
    new URL("screens/PotsScreen.jsx", src),
    ...walk(new URL("components/pots/", src)),
  ];
  const names = files.map((u) => u.pathname.split("/src/")[1]);
  for (const must of ["lib/pots.js", "lib/potsConstants.js", "screens/PotsScreen.jsx", "components/pots/PotsAddon.jsx"]) assert.ok(names.includes(must), `${must} is scanned`);
  for (const u of files) {
    const text = readFileSync(u, "utf8"), f = u.pathname.split("/src/")[1];
    for (const bad of ["fetch(", "apiPost", "apiGet", "contribute(", "localStorage", "sessionStorage", "indexedDB", "structuredClone", "XMLHttpRequest", "WebSocket", "sendBeacon"]) assert.ok(!text.includes(bad), `${f} contains ${bad}`);
    assert.ok(!/from\s+["'][^"']*\/(api|pulse|storage|notifications|wearables)\.js["']/.test(text), `${f} imports a networked or storage module`);
  }
});
