import test from "node:test";
import assert from "node:assert/strict";
import { cleanGlucoseLog, summarize, mergeGlucose, glucoseCard, fmtGlucose, demoReadings, DAYS_MAX } from "./glucose.js";

/* Fixtures in the shape the CyraHealth plugin's readGlucose returns: [{ at, mgdl }] (sources.js / signalsFixtures pattern). */
const at = (d, h, m = 0) => new Date(2026, 10, d, h, m).getTime();
const FIX = [
  { at: at(13, 7), mgdl: 96 }, { at: at(13, 12, 30), mgdl: 141.4 }, { at: at(13, 22), mgdl: 104 },
  { at: at(14, 6, 5), mgdl: 88 }, { at: at(14, 9, 40), mgdl: 132 }, { at: new Date(2026, 10, 14, 8).toISOString(), mgdl: 110 },
  { at: "not a time", mgdl: 100 }, { at: at(14, 10), mgdl: -3 }, { at: at(14, 11), mgdl: "120" },
];

test("summarize: one summary per local day; bad readings dropped; latest by time", () => {
  const d = summarize(FIX);
  assert.deepEqual(Object.keys(d), ["2026-11-13", "2026-11-14"]);
  assert.deepEqual(d["2026-11-13"], { n: 3, min: 96, max: 141, mean: 114, last: 104, lastAt: "22:00" });
  assert.deepEqual(d["2026-11-14"], { n: 3, min: 88, max: 132, mean: 110, last: 132, lastAt: "09:40" });
});

test("cleanGlucoseLog keeps known apps, well-formed days, at most DAYS_MAX newest", () => {
  assert.deepEqual(cleanGlucoseLog(null), { apps: [], connectedAt: null, lastSync: null, days: {} });
  const days = {};
  for (let i = 0; i < DAYS_MAX + 5; i++) { const dt = new Date(2026, 0, 1 + i); days[`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`] = { n: 1, min: 90, max: 90, mean: 90, last: 90, lastAt: "08:00" }; }
  const g = cleanGlucoseLog({ apps: ["libre", "x", "dexcom"], connectedAt: 5, days: { ...days, bad: {}, "2026-12-31": { n: 0 } } });
  assert.deepEqual(g.apps, ["dexcom", "libre"]);
  assert.equal(Object.keys(g.days).length, DAYS_MAX);
  assert.equal(Object.keys(g.days)[0], "2026-01-06");
  assert.equal(JSON.stringify(cleanGlucoseLog(g)), JSON.stringify(g), "idempotent");
});

test("the card: latest with unit and time, the day's range and count, a 7-day line; no judging words", () => {
  const log = mergeGlucose({ apps: ["dexcom"] }, summarize(FIX));
  const c = glucoseCard(log, "2026-11-14", "mg/dL");
  assert.equal(c.latest, "132 mg/dL"); assert.equal(c.at, "09:40");
  assert.equal(c.words, "Today: 3 readings, from 88 to 132 mg/dL.");
  assert.equal(c.week.length, 7); assert.equal(c.week[6].mean, 110); assert.equal(c.week[0].mean, null);
  const mm = glucoseCard(log, "2026-11-14", "mmol/L");
  assert.equal(mm.latest, "7.3 mmol/L"); assert.equal(mm.range, "4.9 to 7.3 mmol/L");
  assert.equal(glucoseCard(log, "2026-11-15").words, "On the last day with readings: 3 readings, from 88 to 132 mg/dL.");
  assert.equal(glucoseCard(log, "2026-12-30"), null, "nothing in the last 7 days: no card");
  const all = JSON.stringify(c);
  assert.doesNotMatch(all, /high|low|good|bad|normal|target|range is|spike|alert|dose/i);
  assert.equal(fmtGlucose(99.6), "100 mg/dL");
});

test("demo readings: a gentle curve, never in the future", () => {
  const r = demoReadings("2026-11-10", "2026-11-12");
  assert.equal(r.length, 72);
  for (const x of r) assert.ok(x.mgdl > 60 && x.mgdl < 200);
  assert.ok(demoReadings("2999-01-01", "2999-01-01").length === 0);
});
