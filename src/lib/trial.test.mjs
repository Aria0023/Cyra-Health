/* lib/trial.js (owner decision 2026-11-12): 7 free days of the whole app, then logging needs Pro; the gate exists only
   where she can pay; what she logged is never locked from reading, export or deletion. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRIAL_DAYS, cleanTrialStart, trialDaysLeft, canLog, trialLine, TRIAL_COPY } from "./trial.js";

test("seven free days, counted on the device, today included", () => {
  assert.equal(TRIAL_DAYS, 7);
  assert.equal(trialDaysLeft("2026-11-12", "2026-11-12"), 7);
  assert.equal(trialDaysLeft("2026-11-12", "2026-11-18"), 1, "the seventh day is the last");
  assert.equal(trialDaysLeft("2026-11-12", "2026-11-19"), 0);
  assert.equal(trialDaysLeft("2026-11-12", "2027-01-01"), 0);
  assert.equal(trialDaysLeft("2026-11-20", "2026-11-12"), 7, "a start in the future counts as today");
  assert.equal(trialDaysLeft("2026-03-07", "2026-03-09"), 5, "a DST change never shifts a day");
  for (const bad of [null, "", "2026-13-01", "nope"]) assert.equal(trialDaysLeft(bad, "2026-11-12"), 0, String(bad));
});

test("canLog: no gate → always; Pro → always; otherwise only inside the free week", () => {
  assert.equal(canLog({ gateOn: false, startIso: "2020-01-01", todayIso: "2026-11-12" }), true, "no way to pay → never locked");
  assert.equal(canLog({ gateOn: true, owned: true, startIso: "2020-01-01", todayIso: "2026-11-12" }), true);
  assert.equal(canLog({ gateOn: true, owned: "yes", startIso: "2020-01-01", todayIso: "2026-11-12" }), false, "only a real true counts");
  assert.equal(canLog({ gateOn: true, startIso: "2026-11-12", todayIso: "2026-11-18" }), true);
  assert.equal(canLog({ gateOn: true, startIso: "2026-11-12", todayIso: "2026-11-19" }), false);
  assert.equal(canLog(), true);
});

test("the plan line: days left, the last day, over; nothing without a gate or with Pro", () => {
  const at = (todayIso) => trialLine({ gateOn: true, startIso: "2026-11-12", todayIso });
  assert.match(at("2026-11-12"), /^Free week: 7 days left\./);
  assert.match(at("2026-11-18"), /^Free week: last day\./);
  assert.equal(at("2026-11-19"), TRIAL_COPY.over);
  assert.equal(trialLine({ gateOn: false, startIso: "2026-11-12", todayIso: "2026-11-19" }), null);
  assert.equal(trialLine({ gateOn: true, owned: true, startIso: "2026-11-12", todayIso: "2026-11-19" }), null);
});

test("the copy promises what the app keeps: open, export, delete; no pressure words", () => {
  assert.match(TRIAL_COPY.sheetBody, /open it, export it or delete it any time, with or without Pro/);
  for (const s of Object.values(TRIAL_COPY)) assert.ok(!/\b(hurry|limited time|don't miss|last chance|act now|unlock now)\b/i.test(s), s);
  assert.equal(cleanTrialStart("2026-11-12"), "2026-11-12");
  for (const bad of [undefined, null, 5, "2026-02-30", "12/11/2026"]) assert.equal(cleanTrialStart(bad), null, String(bad));
});

test("trial.js imports nothing and has no I/O", () => {
  const code = readFileSync(new URL("./trial.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/\bimport\s/.test(code));
  for (const w of ["fetch", "localStorage", "indexedDB", "import.meta"]) assert.ok(!code.includes(w), w);
});

test("App.jsx guards every health-log setter and loads, restores and deletes through the raw ones", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  for (const k of ["ConnLog", "Meds", "MedLog", "Appts", "Journal", "Days", "PregLog", "BodyLog", "Labs", "VisitQuestions", "MoodLog", "Experiments"]) {
    assert.ok(app.includes(`const set${k} = useMemo(() => guardLog(set${k}Raw), []);`), `set${k} guarded`);
  }
  const setters = app.slice(app.indexOf("  const setters = { "), app.indexOf("\n", app.indexOf("  const setters = { ")));
  for (const k of ["connLog: setConnLogRaw", "days: setDaysRaw", "pregLog: setPregLogRaw", "meds: setMedsRaw", "journal: setJournalRaw"]) assert.ok(setters.includes(k), k);
  assert.ok(app.includes("setPots={setPotsLog}") && !app.includes("setPots={setPots}"), "POTS screens log through the guard");
  assert.ok(app.includes("const TRIAL_GATE = STORE.available || DEV_FLAGS.trialGate === true;"), "the gate needs a way to pay");
});
