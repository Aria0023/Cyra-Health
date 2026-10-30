// The fast log's second half (calm R4). Run with: node --test src/lib/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  MOVE_TYPE_IDS, MOVE_MINUTES, cleanSleepH, hoursText, PCOS_DAY, PCOS_DAY_IDS, convert, parseNum, checkValue,
  cleanLabs, addLab, removeLab, labText, unitsFor, cleanBodyPrefs, unitsOf, cleanBodyDay, cleanBodyLog, bodyDay,
  setSleepH, addMove, removeMove, togglePcos, setWeight, moveTotals, moveText, logRows, periodDayOf,
  kgToLb, lbToKg, pctToMmolMol, mmolMolToPct,
} from "./bodylog.js";
import { MODULES } from "./modules.js";

const D = "2026-10-29";

test("movement types and minute chips (owner brief: walk, strength, yoga, cycling, swim, other; 10/20/30/45/60+)", () => {
  assert.deepEqual([...MOVE_TYPE_IDS], ["walk", "strength", "yoga", "cycling", "swim", "other"]);
  assert.deepEqual([...MOVE_MINUTES], [10, 20, 30, 45, 60]);
});

test("sleep hours: half hours in 0–16", () => {
  assert.equal(cleanSleepH(7.3), 7.5);
  assert.equal(cleanSleepH(7.2), 7);
  assert.equal(cleanSleepH(-1), null);
  assert.equal(cleanSleepH(17), null);
  assert.equal(cleanSleepH("7"), null);
  assert.equal(hoursText(7), "7h");
  assert.equal(hoursText(6.5), "6½h");
});

test("PCOS day chips come from the module registry (signals, PCOS-only symptoms, the high-sugar marker)", () => {
  assert.deepEqual([...PCOS_DAY_IDS], ["crash", "cra", "acan", "hls", "hgr", "pel", "sug"]);
  assert.ok(PCOS_DAY.find((x) => x.id === "acan").info && PCOS_DAY.find((x) => x.id === "acan").src.includes("teede2023"));
  for (const x of PCOS_DAY) for (const s of x.src) assert.ok(MODULES.pcos.evidence.some((e) => e.id === s));
});

test("unit conversion", () => {
  assert.equal(convert(100, "kg", "lb"), 220.5);
  assert.equal(convert(150, "lb", "kg"), 68);
  assert.equal(convert(5.5, "mmol/L", "mg/dL"), 99);
  assert.equal(convert(90, "mg/dL", "mmol/L"), 5);
  assert.equal(convert(5.7, "%", "mmol/mol"), 39);
  assert.equal(convert(48, "mmol/mol", "%"), 6.5);
  assert.equal(convert(32, "in", "cm"), 81.3);
  assert.equal(convert(80, "cm", "in"), 31.5);
  assert.equal(convert(80, "cm", "cm"), 80);
  assert.equal(convert(80, "cm", "kg"), null);
  assert.ok(Math.abs(lbToKg(kgToLb(61.3)) - 61.3) < 1e-9);
  assert.ok(Math.abs(mmolMolToPct(pctToMmolMol(6.1)) - 6.1) < 1e-9);
});

test("typed values: comma or point decimals, a plausibility guard per unit", () => {
  assert.equal(parseNum("5,6"), 5.6);
  assert.equal(parseNum(" 92 "), 92);
  assert.equal(parseNum("9x"), null);
  assert.equal(parseNum(""), null);
  assert.deepEqual(checkValue("92", "mg/dL"), { ok: true, value: 92 });
  assert.equal(checkValue("920", "mg/dL").why, "range");
  assert.equal(checkValue("abc", "kg").why, "number");
  assert.equal(checkValue("60", "stone").why, "unit");
});

test("labs: dated values she types, newest first, removable; never interpreted", () => {
  let r = addLab([], { kind: "fglu", text: "92", unit: "mg/dL", date: "2026-09-01", id: "a" });
  assert.ok(r.ok);
  r = addLab(r.labs, { kind: "hba1c", text: "5,4", unit: "%", date: "2026-10-01", id: "b" });
  assert.deepEqual(r.labs.map((x) => x.id), ["b", "a"]);
  assert.equal(labText(r.labs[0]), "5.4%");
  assert.equal(labText(r.labs[1]), "92 mg/dL");
  assert.equal(addLab(r.labs, { kind: "fglu", text: "92", unit: "%", date: "2026-10-01" }).ok, false);
  assert.equal(addLab(r.labs, { kind: "fglu", text: "92", unit: "mg/dL", date: "yesterday" }).why, "date");
  assert.equal(addLab(r.labs, { kind: "waist", text: "500", unit: "cm", date: "2026-10-01" }).why, "range");
  assert.deepEqual(removeLab(r.labs, "b").map((x) => x.id), ["a"]);
  assert.deepEqual(cleanLabs([{ id: "z", kind: "nope", value: 1, unit: "%", date: D }, "x", null]), []);
  assert.deepEqual(cleanLabs(r.labs), r.labs);
});

test("prefs and locale units", () => {
  assert.deepEqual(unitsFor("en-US"), { weightUnit: "lb", waistUnit: "in", glucoseUnit: "mg/dL", hba1cUnit: "%" });
  assert.deepEqual(unitsFor("en-GB"), { weightUnit: "kg", waistUnit: "cm", glucoseUnit: "mmol/L", hba1cUnit: "mmol/mol" });
  assert.deepEqual(cleanBodyPrefs(null), { weightOn: false, weightUnit: null, glucoseUnit: null, hba1cUnit: null, waistUnit: null });
  assert.equal(cleanBodyPrefs({ weightOn: true, weightUnit: "st" }).weightUnit, null);
  assert.equal(unitsOf({ weightUnit: "kg" }, "en-US").weightUnit, "kg");
  assert.equal(unitsOf({}, "en-US").weightUnit, "lb");
});

test("the day log: sleep, movement, PCOS chips and weight; empty days are dropped", () => {
  let log = setSleepH({}, D, 7.5);
  assert.deepEqual(log, { [D]: { sleepH: 7.5 } });
  let r = addMove(log, D, { type: "walk", min: 30, id: "m1" });
  assert.ok(r.ok); log = r.log;
  r = addMove(log, D, { type: "yoga", min: 45, id: "m2" }); log = r.log;
  assert.deepEqual(moveTotals(log, D), { n: 2, min: 75 });
  assert.equal(moveText(log, D), "2 sessions · 75 min");
  assert.equal(addMove(log, D, { type: "run", min: 30 }).ok, false);
  assert.equal(addMove(log, D, { type: "walk", min: 0 }).ok, false);
  log = removeMove(log, D, "m2");
  assert.equal(moveText(log, D), "30 min · Walk");
  log = togglePcos(log, D, "crash"); log = togglePcos(log, D, "sug");
  assert.deepEqual(bodyDay(log, D).pcos, ["crash", "sug"]);
  log = togglePcos(log, D, "crash");
  assert.deepEqual(bodyDay(log, D).pcos, ["sug"]);
  const w = setWeight(log, D, "64,5", "kg");
  assert.ok(w.ok); assert.deepEqual(bodyDay(w.log, D).weight, { v: 64.5, unit: "kg" });
  assert.equal(setWeight(log, D, "6450", "kg").ok, false);
  log = setWeight(w.log, D, "", "kg").log;
  assert.equal(bodyDay(log, D).weight, undefined);
  log = setSleepH(removeMove(togglePcos(log, D, "sug"), D, "m1"), D, null);
  assert.deepEqual(log, {});
});

test("clean: unknown fields dropped, a later build's PCOS ids kept, keys sorted, junk ignored", () => {
  assert.equal(cleanBodyDay({ x: 1 }), null);
  assert.deepEqual(cleanBodyDay({ pcos: ["crash", "crash", "newid", 3] }), { pcos: ["crash", "newid"] });
  assert.deepEqual(Object.keys(cleanBodyLog({ "2026-10-29": { sleepH: 7 }, "2026-10-01": { sleepH: 8 }, bad: { sleepH: 7 } })), ["2026-10-01", "2026-10-29"]);
  assert.deepEqual(cleanBodyLog([1, 2]), {});
  const once = cleanBodyLog({ [D]: { move: [{ id: "a", type: "swim", min: 20 }], weight: { v: 150, unit: "lb" } } });
  assert.deepEqual(cleanBodyLog(once), once);
});

test("period day number from the check-ins", () => {
  const days = [{ date: "2026-10-27", flow: "light" }, { date: "2026-10-28", flow: "med" }, { date: D, flow: "heavy" }];
  const isP = (e) => !!e.flow && e.flow !== "spot";
  assert.equal(periodDayOf(days, D, isP), 3);
  assert.equal(periodDayOf(days, "2026-10-27", isP), 1);
  assert.equal(periodDayOf(days, "2026-10-30", isP), 0);
});

test("the Logs card rows: plain values, Logged only when something is there, no grades or counts of completeness", () => {
  const entry = { date: D, sym: { crm: 2, hda: 1, blo: 3, acn: 0 }, sleepQ: "good", flow: "med", scales: { moodq: 8 }, note: "Long walk by the river" };
  const day = { sleepH: 7.5, move: [{ id: "a", type: "walk", min: 30 }], pcos: ["crash"], weight: { v: 64, unit: "kg" } };
  const rows = logRows({ entry, day, medDay: { 1: true }, meds: [{ id: 1, name: "Magnesium" }], pcosOn: true, weightOn: true, symLabel: (id) => ({ crm: "Cramps", hda: "Headache", blo: "Bloating" })[id], periodDay: 2 });
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.deepEqual(rows.map((r) => r.id), ["symptoms", "flow", "sleep", "move", "mood", "meds", "note", "pcos", "weight"]);
  assert.equal(by.symptoms.value, "Bloating, Cramps +1");
  assert.equal(by.flow.value, "Medium flow · day 2");
  assert.equal(by.sleep.value, "7½h · Slept well");
  assert.equal(by.move.value, "30 min · Walk");
  assert.equal(by.mood.value, "Good");
  assert.equal(by.meds.value, "Magnesium");
  assert.equal(by.pcos.value, "Energy crash after meals");
  assert.equal(by.weight.value, "64 kg");
  assert.ok(rows.every((r) => r.logged));
  const empty = logRows({});
  assert.ok(empty.every((r) => !r.logged && r.value === ""));
  assert.deepEqual(empty.map((r) => r.id), ["symptoms", "flow", "sleep", "move", "mood", "meds", "note"]);
  assert.deepEqual(logRows({ preg: true, pcosOn: true }).map((r) => r.id), ["symptoms", "sleep", "move", "mood", "meds", "note"]);
  const banned = /\b(streak|score|grade|perfect|fail|missed|complete|behind)\b/i;
  for (const r of rows) assert.ok(!banned.test(`${r.label} ${r.value}`), r.id);
});

test("calm R5: the Logs card's Mood row shows the Mind check-in", () => {
  const row = (ctx) => logRows(ctx).find((r) => r.id === "mood");
  assert.deepEqual([row({ moodDay: { mood: 2, tags: ["tired", "sad", "calm"] } }).value, row({ moodDay: { mood: 2 } }).logged], ["Low · tired, sad", true]);
  assert.equal(row({ moodDay: null }).logged, false);
});
