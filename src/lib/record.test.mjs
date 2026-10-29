/* Unit tests for lib/record.js (L3: the saved record's version, keys, backup copy, advisory
   validation and accessors). Run with `npm run test:unit`. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RECORD_VERSION, MIGRATIONS, migrate, PERSISTED, DEVICE_ONLY, DEVICE_PREFS, RECORD, NOT_IN_BACKUP, backupCopy,
  RULES, validateRecord, entryFor, upsertDay, cyclesFrom, PHASES, phaseOf, daysLogged,
} from "./record.js";
import { seed, insights, localDay, cycleStarts, cycleLens, cycleSpans } from "./engine.js";
import { PSYM, SYMS } from "./constants.js";
import { freshEmpty } from "./pots.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(SRC, p), "utf8");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const clone = (x) => JSON.parse(JSON.stringify(x));
const iso = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return localDay(d); };
// A small deterministic shuffle (no Math.random, so a failure can be replayed).
const rng = (seedN) => { let s = seedN >>> 0; return () => ((s = (s * 1664525 + 1013904223) % 4294967296), s / 4294967296); };
const shuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* An app-shaped version-1 record: the defaults App.jsx starts from (as snapshot() stores them, in
   PERSISTED order), with seed() days and a fresh POTS log. */
const DEFAULTS = () => ({
  palIdx: { peri: 0, preg: 0, periods: 0 }, relationship: null, connLog: {}, cadence: "daily", quietHours: "evening", quickMode: true,
  meds: [], medLog: {}, appts: [], journal: {}, wearSources: {}, wearData: [], acct: { name: "", email: "", anon: false }, research: false,
  stage: "peri", stageName: "Perimenopause", welcome: "", days: seed(), pregLog: {}, pulseQueue: null, pulseSent: null, pulseLastSend: null,
  pulseRev: 0, askAI: false, regAnswers: null, reminders: { enabled: false, endpoint: null, pending: [], rev: 0 }, terraOff: [], kickTally: null,
  pots: freshEmpty(), lastBackupAt: null, installHint: null, appearance: "system", cycleFlags: {}, symPrefs: {}, fertSigns: { on: null, unit: null }, exportLog: null, modules: {}, homeTiles: null, homeStepSkip: null,
  bodyLog: {}, labs: [], bodyPrefs: { weightOn: false, weightUnit: null, glucoseUnit: null, hba1cUnit: null, waistUnit: null },
  moodLog: {}, practiceLog: [], practiceFavs: [], practiceHaptics: false, experiments: { active: null, skip: null, past: [] },
  aiPrefs: { weekly: false, chat: false, labs: false }, aiChat: [], aiWeekly: null,
});
const appRecord = (over = {}) => {
  const d = { ...DEFAULTS(), ...over };
  return { v: 1, savedAt: new Date().toISOString(), phase: "app", ...Object.fromEntries(PERSISTED.map((k) => [k, d[k]])) };
};

/* ---------- version and migration ---------- */

test("RECORD_VERSION is 1 and MIGRATIONS has a step for every version below it", () => {
  assert.equal(RECORD_VERSION, 1);
  assert.deepEqual(Object.keys(MIGRATIONS).map(Number), Array.from({ length: RECORD_VERSION - 1 }, (_, i) => i + 1));
  assert.ok(Object.isFrozen(MIGRATIONS));
});

test("migrate: a v1 record comes back as the same object, unchanged", () => {
  const rec = appRecord();
  assert.deepEqual(Object.keys(rec), ["v", "savedAt", "phase", ...PERSISTED]);
  for (const k of PERSISTED) assert.notEqual(rec[k], undefined, `default for ${k}`);
  const before = clone(rec);
  assert.equal(migrate(rec), rec);
  assert.deepEqual(rec, before);
});

test("migrate: non-records and newer records come back untouched, nothing throws", () => {
  for (const x of [null, undefined, "x", 42, [], {}, { v: "1" }, { v: NaN }, { v: 2, phase: "app" }, { v: 1.5 }, { v: -1 }]) {
    let out;
    assert.doesNotThrow(() => { out = migrate(x); });
    assert.ok(Object.is(out, x), `migrate(${JSON.stringify(x)})`);
  }
  // A record whose getters throw, or nonsense options, still come back as given.
  const nasty = { get v() { throw new Error("boom"); } };
  assert.equal(migrate(nasty), nasty);
  const old = { v: 0, phase: "app" };
  assert.equal(migrate(old, { steps: null }), old);
  assert.equal(migrate(old, { steps: "x" }), old);
});

test("migrate: injected steps run in order and never mutate", () => {
  const steps = {
    1: (r) => ({ ...r, v: 2, days: r.days.map((d) => ({ ...d, m: 1 })) }),
    2: (r) => ({ ...r, v: 3, extra: true }),
  };
  const rec = appRecord();
  const before = clone(rec);
  const out = migrate(rec, { version: 3, steps });
  assert.notEqual(out, rec);
  assert.equal(out.v, 3);
  assert.equal(out.extra, true);
  assert.ok(out.days.length > 0 && out.days.every((d) => d.m === 1));
  assert.deepEqual(rec, before);
  // Starting from version 2 runs only the second step.
  const two = { ...appRecord(), v: 2 };
  const out2 = migrate(two, { version: 3, steps });
  assert.equal(out2.v, 3); assert.equal(out2.extra, true); assert.ok(out2.days.every((d) => d.m === undefined));
});

test("migrate: a missing, throwing or non-advancing step returns the input (all or nothing)", () => {
  const rec = appRecord();
  const before = clone(rec);
  // Only step 1 of the two needed: the half-way result is thrown away.
  assert.equal(migrate(rec, { version: 3, steps: { 1: (r) => ({ ...r, v: 2 }) } }), rec);
  // A step that throws.
  assert.equal(migrate(rec, { version: 2, steps: { 1: () => { throw new Error("bad step"); } } }), rec);
  // A step that doesn't bump v (would loop forever if migrate trusted it), one that skips a version, one that returns nothing.
  assert.equal(migrate(rec, { version: 2, steps: { 1: (r) => ({ ...r }) } }), rec);
  assert.equal(migrate(rec, { version: 3, steps: { 1: (r) => ({ ...r, v: 3 }), 2: (r) => ({ ...r, v: 3 }) } }), rec);
  assert.equal(migrate(rec, { version: 2, steps: { 1: () => undefined } }), rec);
  assert.equal(migrate(rec, { version: 2, steps: { 1: "not a function" } }), rec);
  assert.deepEqual(rec, before);
});

/* ---------- keys ---------- */

test("key lists are the ones App.jsx used before L3 (pinned)", () => {
  // Copied from src/App.jsx at HEAD before L3 (L1 added installHint, L2 added appearance and DEVICE_PREFS); L5 appended cycleFlags, L6 symPrefs and L7 fertSigns (record keys: in RECORD and in backups); calm R1 appended modules (record, in backups); calm R3 appended homeTiles (record, in backups) and homeStepSkip (device-only, not in backups); calm R4 appended bodyLog, labs and bodyPrefs (record, in backups); calm R5 appended moodLog, practiceLog, practiceFavs (record, in backups) and practiceHaptics (device-only, not in backups); calm R6 appended experiments (record, in backups); calm R8 appended aiPrefs (device-only consent, in the file, never applied), aiChat and aiWeekly (device-only, not in backups).
  assert.deepEqual([...PERSISTED], ["palIdx", "relationship", "connLog", "cadence", "quietHours", "quickMode", "meds", "medLog", "appts", "journal", "wearSources", "wearData", "acct", "research", "stage", "stageName", "welcome", "days", "pregLog", "pulseQueue", "pulseSent", "pulseLastSend", "pulseRev", "askAI", "regAnswers", "reminders", "terraOff", "kickTally", "pots", "lastBackupAt", "installHint", "appearance", "cycleFlags", "symPrefs", "fertSigns", "exportLog", "modules", "homeTiles", "homeStepSkip", "bodyLog", "labs", "bodyPrefs", "moodLog", "practiceLog", "practiceFavs", "practiceHaptics", "experiments", "aiPrefs", "aiChat", "aiWeekly"]);
  assert.deepEqual([...DEVICE_ONLY], ["research", "pulseQueue", "pulseSent", "pulseLastSend", "pulseRev", "askAI", "terraOff", "lastBackupAt", "installHint", "exportLog", "homeStepSkip", "practiceHaptics", "aiPrefs", "aiChat", "aiWeekly"]);
  assert.deepEqual([...DEVICE_PREFS], ["appearance"]);
  assert.deepEqual([...NOT_IN_BACKUP], ["lastBackupAt", "installHint", "exportLog", "homeStepSkip", "practiceHaptics", "aiChat", "aiWeekly", "appearance"]);
  assert.deepEqual([...RECORD], PERSISTED.filter((k) => !DEVICE_ONLY.includes(k) && k !== "reminders"));
  for (const k of NOT_IN_BACKUP) { assert.ok(PERSISTED.includes(k), `${k} persisted`); assert.ok(DEVICE_ONLY.includes(k) || DEVICE_PREFS.includes(k), `${k} device-only or a device pref`); }
  for (const k of DEVICE_ONLY) assert.ok(PERSISTED.includes(k), `${k} persisted`);
  for (const k of DEVICE_PREFS) assert.ok(RECORD.includes(k), `${k} in RECORD`);
  assert.deepEqual(DEVICE_ONLY.filter((k) => DEVICE_PREFS.includes(k)), []);
  for (const [name, list] of Object.entries({ PERSISTED, DEVICE_ONLY, DEVICE_PREFS, RECORD, NOT_IN_BACKUP })) {
    assert.ok(Object.isFrozen(list), `${name} frozen`);
    assert.equal(new Set(list).size, list.length, `${name} has no duplicates`);
  }
});

test("every persisted key has a rule, a setter and a value", () => {
  assert.deepEqual(Object.keys(RULES).sort(), [...PERSISTED].sort());
  assert.ok(Object.isFrozen(RULES));
  // Without a setter, App.jsx applySaved would throw on that key; without a value, snapshot() would save undefined.
  const lines = read("App.jsx").split("\n");
  const settersLine = lines.find((l) => l.trim().startsWith("const setters = {"));
  const valuesLine = lines.find((l) => l.trim().startsWith("const values = {"));
  assert.ok(settersLine && valuesLine, "App.jsx has the setters and values lines");
  const valueKeys = valuesLine.slice(valuesLine.indexOf("{") + 1, valuesLine.lastIndexOf("}")).split(",").map((s) => s.trim());
  for (const k of PERSISTED) {
    assert.match(settersLine, new RegExp(`[{,]\\s*${k}:`), `setter for ${k}`);
    assert.ok(valueKeys.includes(k), `value for ${k}`);
  }
});

test("backupCopy matches the transform exportBackup used before L3", () => {
  // The inline code exportBackup ran on a fresh snapshot() before L3 (it changed that object in place).
  const legacy = (snap) => {
    if (snap.regAnswers && typeof snap.regAnswers === "object") { const ra = { ...snap.regAnswers }; delete ra.zip; delete ra.age; snap.regAnswers = ra; }
    snap.reminders = { enabled: !!snap.reminders?.enabled };
    delete snap.lastBackupAt;
    delete snap.installHint;
    delete snap.exportLog; // L9: this device's PDF count this month never travels
    delete snap.homeStepSkip; // calm R3: this device's "Not today" for Home's small step never travels
    delete snap.practiceHaptics; // calm R5: this phone's vibration choice never travels
    delete snap.aiChat; delete snap.aiWeekly; // calm R8: the AI chat and write-up stay on this device
    for (const k of ["appearance"]) delete snap[k];
    return snap;
  };
  const s = appRecord({
    regAnswers: { zip: "02139", age: "35-44", stage: "My Cycle" },
    reminders: { enabled: true, endpoint: "https://push.example/x", pending: ["https://p"], rev: 5 },
    lastBackupAt: "2026-10-01", installHint: "dismissed", appearance: "dark", research: true, askAI: true, pulseRev: 7,
  });
  const before = clone(s);
  const out = backupCopy(s);
  assert.equal(JSON.stringify(out), JSON.stringify(legacy(clone(s))));
  assert.notEqual(out, s);
  assert.equal("lastBackupAt" in out, false);
  assert.equal("installHint" in out, false);
  assert.equal("appearance" in out, false);
  assert.equal("exportLog" in out, false);
  assert.deepEqual(out.regAnswers, { stage: "My Cycle" });
  assert.deepEqual(out.reminders, { enabled: true });
  // The other DEVICE_ONLY keys are still in the file (a restore never applies them).
  assert.equal(out.research, true); assert.equal(out.askAI, true); assert.equal(out.pulseRev, 7);
  assert.deepEqual(s, before);
  // regAnswers null stays null; a missing reminders becomes { enabled: false }.
  const n = appRecord({ regAnswers: null });
  delete n.reminders;
  const outN = backupCopy(n);
  assert.equal(outN.regAnswers, null);
  assert.deepEqual(outN.reminders, { enabled: false });
  assert.equal(JSON.stringify(outN), JSON.stringify(legacy(clone(n))));
});

/* ---------- advisory validation ---------- */

test("validateRecord: an app-shaped record has no problems", () => {
  assert.deepEqual(validateRecord(appRecord()), []);
  const full = appRecord({
    stage: "preg", stageName: "Pregnancy", relationship: "partnered", cadence: "weekdays", quietHours: "never", quickMode: false,
    pregLog: { [iso(1)]: { sym: { nau: 2, hb: 0 }, kicks: 9, scales: { fatigue: 4, pain: 0, moodq: 6, stress: 3 }, odor: null, bodyOdor: "same", note: "Kicks were busy after lunch." }, [iso(0)]: { sym: {}, kicks: 0, scales: { fatigue: 0, pain: 0, moodq: 0, stress: 0 }, odor: "mild", bodyOdor: null } },
    journal: { [iso(2)]: "Tired today.\n\nBetter after a walk." },
    appts: [{ id: 1760000000000, date: iso(-3), who: "Dr. Lee", note: "" }],
    meds: [{ id: 1760000000001, name: "Magnesium", kind: "supp", started: iso(20) }],
    medLog: { [iso(0)]: { 1760000000001: true }, [iso(1)]: { 1760000000001: false } },
    connLog: { [iso(0)]: { closeness: 5, desire: 5, friction: 2, load: 5, intimacy: "affection", after: null } },
    wearData: [{ date: iso(1), temp: 0.2, rhr: 61, hrv: null, sleep: 74, sourceId: "oura" }],
    wearSources: { oura: { connectedAt: 1, pending: true, restored: true } },
    pulseQueue: { day: iso(0), stage: "preg", events: ["nau"] }, pulseSent: { week: "2026-W43", keys: ["preg|nau"] }, pulseLastSend: iso(1), pulseRev: 1760000000000,
    research: true, askAI: true, regAnswers: { stage: "Pregnant", conditions: [], zip: "90210", age: "35–44", dueDate: iso(-126) },
    reminders: { enabled: true, endpoint: "https://push.example/x", pending: [], rev: 3 }, terraOff: [{ key: "k".repeat(43) }],
    kickTally: { day: iso(0), n: 4 }, lastBackupAt: iso(3), installHint: "installed", appearance: "dark", cycleFlags: { [iso(40)]: { exclude: true }, [iso(70)]: { exclude: false, note: "later field" } },
    symPrefs: { peri: { order: ["eng", "hf"], hidden: ["itc"], added: ["crm"] }, preg: { order: [], hidden: ["brx"], added: [] } },
    fertSigns: { on: true, unit: "F" }, modules: { pcos: { on: true, since: iso(5) } }, homeTiles: ["note", "mood", "sleep"], homeStepSkip: { day: iso(0), id: "note" },
    bodyLog: { [iso(2)]: { sleepH: 6.5, move: [{ id: "a1", type: "walk", min: 30 }], pcos: ["crash", "sug"] }, [iso(1)]: { weight: { v: 64.2, unit: "kg" } } },
    labs: [{ id: "g1", kind: "fglu", value: 92, unit: "mg/dL", date: iso(10) }, { id: "h1", kind: "hba1c", value: 5.4, unit: "%", date: iso(40) }],
    bodyPrefs: { weightOn: true, weightUnit: "kg", glucoseUnit: "mg/dL", hba1cUnit: null, waistUnit: "cm" },
    acct: { name: "Ada", email: "ada@example.com", anon: false }, welcome: "Your pregnancy space is ready.",
    days: [{ date: iso(1), sleepQ: "poor", period: true, scales: { fatigue: 3, pain: 2, moodq: 7, stress: 1 }, flow: "heavy", disch: "creamy", odor: "none", bodyOdor: "same", sym: { crm: 3, hda: 0, eng: 2 }, note: "Migraine after the late shift.\nTook the day slowly." }],
  });
  assert.deepEqual(validateRecord(full), []);
});

test("validateRecord: regAnswers.dueDate is \"\" or YYYY-MM-DD (L11); absent is fine", () => {
  assert.deepEqual(validateRecord(appRecord({ regAnswers: { stage: "Pregnant" } })), []);
  assert.deepEqual(validateRecord(appRecord({ regAnswers: { stage: "Pregnant", dueDate: "" } })), []);
  assert.deepEqual(validateRecord(appRecord({ regAnswers: { stage: "Pregnant", dueDate: "2027-02-01" } })), []);
  assert.equal(validateRecord(appRecord({ regAnswers: { stage: "Pregnant", dueDate: "2027-13-01" } })).length, 1);
  assert.equal(validateRecord(appRecord({ regAnswers: { stage: "Pregnant", dueDate: 20270201 } })).length, 1);
});

test("validateRecord: problems are reported by path", () => {
  const days = [
    { date: iso(5), sleepQ: "fair", period: false, sym: { crm: 0 } },
    { date: "10/22/2026", sleepQ: "fair", period: false, sym: { crm: 1 } },
    { date: iso(3), sleepQ: "great", period: true, flow: "gush", scales: { fatigue: 0, pain: 11, moodq: 5, stress: 0 }, sym: { crm: 7, hda: 2 } },
    { date: iso(5), sleepQ: "good", period: false, sym: {} },
  ];
  const problems = validateRecord(appRecord({ days, stage: "x", palIdx: { peri: 9, preg: 0, periods: 0 }, kickTally: { day: "x", n: -1 } }));
  const prefixes = ["days[1].date", "days: two entries for", "days[2].sym.crm", "days[2].scales.pain", "days[2].sleepQ", "days[2].flow", "stage", "palIdx.peri", "kickTally"];
  for (const pre of prefixes) assert.equal(problems.filter((p) => p.startsWith(pre)).length, 1, `${pre} in ${JSON.stringify(problems)}`);
  assert.equal(problems.length, prefixes.length, JSON.stringify(problems));
  assert.ok(problems.includes("days[2].sym.crm: expected a severity 0–3, got 7"));
  assert.ok(problems.includes(`days: two entries for ${iso(5)}`));
  assert.ok(problems.includes('stage: expected periods, preg, peri or null, got "x"'));
  for (const p of problems) assert.match(p, /^[\w.[\]]+: |^days: /, p);
});

test("cycleFlags (L5): a record key, in backups; the rule flags anything cleanCycleFlags would change", () => {
  assert.ok(RECORD.includes("cycleFlags"), "adopted by other tabs");
  assert.ok(!DEVICE_ONLY.includes("cycleFlags") && !NOT_IN_BACKUP.includes("cycleFlags"), "in backups, applied by a restore");
  assert.deepEqual(backupCopy(appRecord({ cycleFlags: { [iso(30)]: { exclude: true } } })).cycleFlags, { [iso(30)]: { exclude: true } });
  assert.deepEqual(RULES.cycleFlags({}, "cycleFlags"), []);
  assert.deepEqual(RULES.cycleFlags({ [iso(30)]: { exclude: true } }, "cycleFlags"), []);
  for (const bad of [[], null, "x", { "2026-1-1": { exclude: true } }, { [iso(30)]: true }, { [iso(30)]: { exclude: false } }, { [iso(30)]: { exclude: "yes" } }]) {
    const out = RULES.cycleFlags(bad, "cycleFlags");
    assert.equal(out.length, 1, JSON.stringify(bad));
    assert.match(out[0], /^cycleFlags: expected /);
  }
});

test("symPrefs and day notes (L6): symPrefs is a record key in backups; notes are reported, never changed", () => {
  assert.ok(RECORD.includes("symPrefs"), "adopted by other tabs");
  assert.ok(!DEVICE_ONLY.includes("symPrefs") && !NOT_IN_BACKUP.includes("symPrefs"), "in backups, applied by a restore");
  const prefs = { periods: { order: ["eng", "crm"], hidden: ["acn"], added: ["hf"] } };
  assert.deepEqual(backupCopy(appRecord({ symPrefs: prefs })).symPrefs, prefs);
  assert.deepEqual(RULES.symPrefs({}, "symPrefs"), []);
  assert.deepEqual(RULES.symPrefs(prefs, "symPrefs"), []);
  for (const bad of [[], null, "x", { periods: { order: ["eng"] } }, { periods: { order: [], hidden: [], added: [] } }, { other: { order: ["eng"], hidden: [], added: [] } }, { peri: { order: ["Hot flashes"], hidden: [], added: [] } }]) {
    const out = RULES.symPrefs(bad, "symPrefs");
    assert.equal(out.length, 1, JSON.stringify(bad));
    assert.match(out[0], /^symPrefs: expected /);
  }
  // A note: no problem when valid, exactly one each for 281 units, a number and a blank; the entry itself is never changed.
  const day = (note) => ({ date: iso(2), sleepQ: "fair", period: false, sym: { crm: 1 }, note });
  assert.deepEqual(validateRecord(appRecord({ days: [day("x".repeat(280))] })), []);
  for (const bad of ["x".repeat(281), 42, "   "]) {
    const days = [day(bad)];
    const before = clone(days);
    const out = validateRecord(appRecord({ days }));
    assert.equal(out.length, 1, JSON.stringify(out));
    assert.match(out[0], /^days\[0\]\.note: expected /);
    assert.deepEqual(days, before, "the validator never trims or drops");
  }
  const preg = (note) => ({ [iso(1)]: { sym: { nau: 1 }, kicks: 3, note } });
  assert.deepEqual(validateRecord(appRecord({ stage: "preg", pregLog: preg("Felt good") })), []);
  for (const bad of ["y".repeat(281), 7, ""]) {
    const out = validateRecord(appRecord({ stage: "preg", pregLog: preg(bad) }));
    assert.equal(out.length, 1, JSON.stringify(out));
    assert.ok(out[0].startsWith(`pregLog.${iso(1)}.note: expected `), out[0]);
  }
  // A pre-L6 record (no note, no symPrefs) needs no migration step: migrate() returns it as it is.
  const old = appRecord();
  delete old.symPrefs;
  const before = clone(old);
  assert.equal(migrate(old), old);
  assert.deepEqual(old, before);
  assert.deepEqual(validateRecord(old), []);
});

test("fertility signs (L7): fertSigns is a record key in backups; cm, opk and bbt are reported, never changed", () => {
  assert.ok(RECORD.includes("fertSigns"), "adopted by other tabs");
  assert.ok(!DEVICE_ONLY.includes("fertSigns") && !NOT_IN_BACKUP.includes("fertSigns"), "in backups, applied by a restore");
  assert.deepEqual(backupCopy(appRecord({ fertSigns: { on: false, unit: "C" } })).fertSigns, { on: false, unit: "C" });
  for (const ok of [{ on: null, unit: null }, { on: true, unit: "F" }, { on: false, unit: "C" }]) assert.deepEqual(RULES.fertSigns(ok, "fertSigns"), []);
  for (const bad of [null, [], "x", { on: "yes", unit: null }, { on: null, unit: "K" }, { on: null }, { on: null, unit: null, extra: 1 }]) {
    const out = RULES.fertSigns(bad, "fertSigns");
    assert.equal(out.length, 1, JSON.stringify(bad));
    assert.match(out[0], /^fertSigns: expected /);
  }
  const day = (extra) => ({ date: iso(2), sleepQ: "fair", period: false, sym: { crm: 1 }, ...extra });
  assert.deepEqual(validateRecord(appRecord({ days: [day({ cm: "eggwhite", opk: "pos", bbt: 36.5 }), { ...day({ cm: "dry", opk: "neg", bbt: 34 }), date: iso(3) }] })), []);
  for (const [extra, field] of [[{ cm: "foo" }, "cm"], [{ opk: "maybe" }, "opk"], [{ bbt: "hot" }, "bbt"], [{ bbt: 60 }, "bbt"], [{ opk: "none" }, "opk"]]) {
    const days = [day(extra)];
    const before = clone(days);
    const out = validateRecord(appRecord({ days }));
    assert.equal(out.length, 1, JSON.stringify(out));
    assert.ok(out[0].startsWith(`days[0].${field}: expected `), out[0]);
    assert.deepEqual(days, before, "the validator never drops a value");
  }
  // A pre-L7 record (no fertSigns, no fertility fields) needs no migration step.
  const old = appRecord();
  delete old.fertSigns;
  assert.equal(migrate(old), old);
  assert.deepEqual(validateRecord(old), []);
});

test("validateRecord never throws and is lenient where it must be", () => {
  for (const x of [null, [], "x", { days: "nope" }, { pregLog: [] }, undefined, 42]) {
    let out;
    assert.doesNotThrow(() => { out = validateRecord(x); });
    assert.ok(Array.isArray(out), `array for ${JSON.stringify(x)}`);
  }
  assert.deepEqual(validateRecord(null), ["record: not an object"]);
  assert.ok(validateRecord({ v: 1, phase: "app", days: "nope" }).some((p) => p.startsWith("days:")));
  // A newer build's unknown key, an older record's missing key and a newer POTS log add no problem.
  const rec = appRecord({ pots: { v: 2, schema: "next" } });
  rec.someFutureKey = { anything: true };
  delete rec.journal; delete rec.appearance; delete rec.installHint;
  assert.deepEqual(validateRecord(rec), []);
  // Records saved before later fields existed: a day with only date, sleepQ, period and sym is fine.
  assert.deepEqual(validateRecord(appRecord({ days: [{ date: iso(0), sleepQ: "fair", period: false, sym: { eng: 1 } }] })), []);
  // A getter that throws inside a key is reported, not thrown.
  const odd = appRecord(); Object.defineProperty(odd, "acct", { enumerable: true, get() { throw new Error("boom"); } });
  assert.doesNotThrow(() => validateRecord(odd));
});

/* ---------- accessors ---------- */

test("entryFor and upsertDay", () => {
  const a = { date: iso(2), sym: { crm: 1 } }, a2 = { date: iso(2), sym: { crm: 3 } }, b = { date: iso(1), sym: {} };
  assert.equal(entryFor([b, a, a2], iso(2)), a, "the first of two same-date entries");
  assert.equal(entryFor([a, b], iso(9)), null);
  assert.equal(entryFor([null, b], iso(1)), b);
  assert.equal(entryFor(null, iso(1)), null);
  assert.equal(entryFor({ date: iso(1) }, iso(1)), null);
  // Replace the same date, sort ascending, leave the input alone.
  const days = [a, b];
  const before = clone(days);
  const e = { date: iso(2), sym: { crm: 2 } }, c = { date: iso(4), sym: {} };
  assert.deepEqual(upsertDay(days, e), [e, b]);
  assert.deepEqual(upsertDay(days, c), [c, a, b]);
  assert.deepEqual(days, before);
  assert.notEqual(upsertDay(days, e), days);
  // Against TodayScreen's former inline expression, for 20 shuffles of 10 entries plus a new or a replacement entry.
  const inline = (list, entry) => [...list.filter((x) => x.date !== entry.date), entry].sort((x, y) => x.date.localeCompare(y.date));
  const ten = Array.from({ length: 10 }, (_, i) => ({ date: iso(i * 2), sleepQ: "fair", period: false, sym: { crm: i % 4 } }));
  const r = rng(7);
  for (let t = 0; t < 20; t++) {
    const list = shuffle(ten, r);
    const entry = t % 2 ? { date: iso(4), sleepQ: "good", period: true, sym: { crm: 3 } } : { date: iso(3), sleepQ: "poor", period: false, sym: {} };
    const snap = clone(list);
    assert.deepEqual(upsertDay(list, entry), inline(list, entry));
    assert.deepEqual(list, snap);
  }
});

test("cyclesFrom: one cycle per start", () => {
  const day = (n, period, flow = period ? "med" : null) => ({ date: iso(n), period, flow, sleepQ: "fair", sym: {} });
  const days = [day(60, true), day(59, true), day(32, true), day(31, true), day(0, false)];
  const want = [
    { start: iso(60), next: iso(32), length: 28, counted: true, periodDays: 2 },
    { start: iso(32), next: null, length: null, counted: false, periodDays: 2 },
  ];
  assert.deepEqual(cyclesFrom(days), want);
  // Spotting starts nothing and is not a period day.
  assert.deepEqual(cyclesFrom([...days, day(45, true, "spot")]), want);
  // Starts 10 days apart: a real cycle, but too short to count; 130 days apart: too long to count.
  const short = cyclesFrom([day(40, true), day(30, true)]);
  assert.equal(short[0].length, 10); assert.equal(short[0].counted, false);
  const long = cyclesFrom([day(140, true), day(10, true)]);
  assert.equal(long[0].length, 130); assert.equal(long[0].counted, false);
  // Input order doesn't matter; junk items are skipped.
  const r = rng(3);
  for (let t = 0; t < 5; t++) assert.deepEqual(cyclesFrom(shuffle(days, r)), want);
  assert.deepEqual(cyclesFrom([null, "x", { period: true }, ...days]), want);
  assert.deepEqual(cyclesFrom(null), []);
  assert.deepEqual(cyclesFrom([]), []);
});

test("cyclesFrom agrees with insights()", () => {
  const day = (n, period) => ({ date: iso(n), period, flow: period ? "med" : null, sleepQ: "fair", sym: {} });
  const backFilled = [day(32, true), day(31, true), day(0, false), day(60, true), day(59, true)];
  for (const [days, ids] of [[seed(), Object.keys(PSYM)], [seed(), SYMS], [backFilled, ["crm"]], [[...backFilled, day(90, true)], ["crm"]]]) {
    const ins = insights(days, ids);
    const cycles = cyclesFrom(days);
    assert.deepEqual(cycles.map((c) => c.start), ins.starts);
    const counted = cycles.filter((c) => c.counted).map((c) => c.length);
    assert.deepEqual(counted, cycleLens(cycleStarts(days)));
    assert.deepEqual(counted.slice(-6), ins.lens);
  }
  assert.ok(cyclesFrom(seed()).length >= 2, "the demo seed has cycles");
});

test("cyclesFrom is engine cycleSpans plus the running cycle (one cycle-detection implementation, L5)", () => {
  for (const days of [seed(), [], [{ date: iso(140), period: true, sym: {} }, { date: iso(10), period: true, sym: {} }]]) {
    const spans = cycleSpans(cycleStarts(days));
    const cycles = cyclesFrom(days);
    assert.deepEqual(cycles.slice(0, spans.length).map(({ start, next, length, counted }) => ({ start, next, len: length, counted })), spans);
    assert.equal(cycles.length, spans.length + (cycleStarts(days).length ? 1 : 0));
  }
  assert.ok(!/\bnew Date\(next\)|CYCLE_MIN|CYCLE_MAX/.test(stripComments(read("lib/record.js"))), "record.js measures no cycle itself");
});

test("phaseOf and PHASES", () => {
  for (const [id, p] of Object.entries(PHASES)) assert.equal(phaseOf(p.stage, p.stageName), id, id);
  assert.deepEqual(Object.keys(PHASES), ["cycle", "ttc", "preg", "peri", "meno"]);
  assert.equal(phaseOf("periods", ""), "cycle");
  assert.equal(phaseOf("periods", "My Cycle"), "cycle");
  assert.equal(phaseOf("peri", "Perimenopause"), "peri");
  assert.equal(phaseOf("peri", "Menopause"), "meno");
  assert.equal(phaseOf("preg", "Pregnancy"), "preg");
  assert.equal(phaseOf(null, "x"), null);
  // Only the label finishReg and rulesRoute store counts: the registration card's own wording is not it.
  assert.equal(phaseOf("peri", "Menopause & beyond"), "peri");
  assert.ok(Object.isFrozen(PHASES));
  for (const p of Object.values(PHASES)) assert.ok(Object.isFrozen(p));
});

test("daysLogged", () => {
  assert.equal(daysLogged({ stage: "preg", days: [{}, {}], pregLog: { [iso(0)]: {}, [iso(1)]: {}, [iso(2)]: {} } }), 3);
  assert.equal(daysLogged({ stage: "peri", days: [{}, {}], pregLog: { [iso(0)]: {} } }), 2);
  assert.equal(daysLogged({ stage: "periods" }), 0);
  assert.equal(daysLogged({ stage: "preg" }), 0);
  assert.equal(daysLogged({ stage: "peri", days: "nope" }), 0);
});

/* ---------- layering and no I/O ---------- */

// record.js may import only these pure leaf modules. A later slice may add one (L6 './daylog.js',
// L7 './fertility.js'); none of them may import record.js back.
const RECORD_IMPORTS = ["./engine.js", "./constants.js", "./daylog.js", "./fertility.js", "./modules.js", "./home.js", "./bodylog.js", "./mind.js", "./experiments.js", "./aiFeatures.js"];
const importsOf = (code) => [...code.matchAll(/^\s*import\b[^;]*?\bfrom\s*["']([^"']+)["']/gm)].map((m) => m[1]);

test("layering and no I/O", () => {
  const rec = stripComments(read("lib/record.js"));
  assert.deepEqual(importsOf(rec).sort(), [...RECORD_IMPORTS].sort());
  assert.ok(!/\bimport\s*\(|\brequire\s*\(/.test(rec), "no dynamic import or require");
  for (const w of ["fetch", "XMLHttpRequest", "sendBeacon", "indexedDB", "localStorage", "sessionStorage", "import.meta"]) assert.ok(!rec.includes(w), `record.js mentions ${w}`);
  for (const f of ["structuredClone", ".at(", "findLast", "Object.hasOwn("]) assert.ok(!rec.includes(f), `record.js uses ${f} (iOS 15.0 target)`);
  for (const m of RECORD_IMPORTS) assert.ok(!stripComments(read(join("lib", m))).includes("record.js"), `${m} imports record.js`);
  assert.ok(!stripComments(read("lib/engine.js")).includes("record.js"), "engine.js never imports record.js");
  assert.ok(!importsOf(stripComments(read("lib/pots.js"))).includes("./record.js"), "pots.js never imports record.js");
  const storage = stripComments(read("lib/storage.js"));
  assert.match(storage, /import \{ migrate \} from "\.\/record\.js";/);
  assert.equal(storage.split("migrate(").length - 1, 2, "storage.js calls migrate( on both load paths");
  const app = read("App.jsx");
  assert.ok(app.includes("migrate(await decryptBackup"), "importBackup runs the decrypted backup through migrate");
  assert.ok(app.includes("backupCopy(snapshot())"), "exportBackup uses backupCopy");
  assert.equal(read("screens/TodayScreen.jsx").split("upsertDay(").length - 1, 2, "TodayScreen saves through upsertDay");
});

test("appointment PDFs (L9): exportLog is device-only, never in a backup, null unless a monthly limit is configured", () => {
  assert.ok(PERSISTED.includes("exportLog") && DEVICE_ONLY.includes("exportLog") && NOT_IN_BACKUP.includes("exportLog"));
  assert.ok(!RECORD.includes("exportLog"), "never handed to another tab");
  assert.equal("exportLog" in backupCopy(appRecord({ exportLog: { month: "2026-10", n: 2 } })), false);
  for (const ok of [null, { month: "2026-10", n: 0 }, { month: "2026-10", n: 3 }]) assert.deepEqual(RULES.exportLog(ok, "exportLog"), []);
  for (const bad of [undefined, [], "x", 1, { month: "2026-1", n: 1 }, { month: "2026-10", n: -1 }, { month: "2026-10", n: 1.5 }, { n: 1 }]) {
    const out = RULES.exportLog(bad, "exportLog");
    assert.equal(out.length, 1, JSON.stringify(bad));
    assert.match(out[0], /^exportLog: expected null or \{ month: YYYY-MM, n: a whole number ≥ 0 \}/);
  }
  assert.deepEqual(validateRecord(appRecord({ exportLog: null })), []);
});

test("Home (calm R3): homeTiles is a record key in backups; homeStepSkip is device-only and never in a backup", () => {
  assert.ok(RECORD.includes("homeTiles") && !DEVICE_ONLY.includes("homeTiles") && !NOT_IN_BACKUP.includes("homeTiles"));
  assert.deepEqual(backupCopy(appRecord({ homeTiles: ["mood", "note"] })).homeTiles, ["mood", "note"]);
  assert.ok(DEVICE_ONLY.includes("homeStepSkip") && NOT_IN_BACKUP.includes("homeStepSkip") && !RECORD.includes("homeStepSkip"));
  assert.equal("homeStepSkip" in backupCopy(appRecord({ homeStepSkip: { day: "2026-10-29", id: "note" } })), false);
  for (const ok of [null, ["mood", "note"], ["symptoms", "sleep", "mood", "move"]]) assert.deepEqual(RULES.homeTiles(ok, "homeTiles"), []);
  for (const bad of [["mood"], ["mood", "mood"], ["x", "y"], "mood", ["a", "b", "c", "d", "e"]]) assert.equal(RULES.homeTiles(bad, "homeTiles").length, 1, JSON.stringify(bad));
  assert.deepEqual(RULES.homeStepSkip({ day: "2026-10-29", id: "note" }, "s"), []);
  assert.equal(RULES.homeStepSkip({ day: "x" }, "s").length, 1);
});

test("Body log (calm R4): bodyLog, labs and bodyPrefs are record keys in backups, checked by their clean functions", () => {
  for (const k of ["bodyLog", "labs", "bodyPrefs"]) assert.ok(RECORD.includes(k) && !DEVICE_ONLY.includes(k) && !NOT_IN_BACKUP.includes(k), k);
  const bl = { "2026-10-28": { sleepH: 7, move: [{ id: "x", type: "yoga", min: 20 }] } };
  assert.deepEqual(backupCopy(appRecord({ bodyLog: bl })).bodyLog, bl);
  assert.deepEqual(RULES.bodyLog(bl, "bodyLog"), []);
  assert.equal(RULES.bodyLog({ "2026-10-28": { sleepH: 30 } }, "bodyLog").length, 1);
  assert.equal(RULES.bodyLog({ "2026-10-28": {} }, "bodyLog").length, 1);
  assert.deepEqual(RULES.labs([], "labs"), []);
  assert.equal(RULES.labs([{ id: "a", kind: "fglu", value: 9000, unit: "mg/dL", date: "2026-10-01" }], "labs").length, 1);
  assert.equal(RULES.bodyPrefs({ weightOn: "yes" }, "bodyPrefs").length, 1);
});

test("Mind (calm R5): moodLog, practiceLog and practiceFavs are record keys in backups; practiceHaptics stays on the device", () => {
  for (const k of ["moodLog", "practiceLog", "practiceFavs"]) assert.ok(RECORD.includes(k) && !DEVICE_ONLY.includes(k) && !NOT_IN_BACKUP.includes(k), k);
  assert.ok(DEVICE_ONLY.includes("practiceHaptics") && NOT_IN_BACKUP.includes("practiceHaptics") && !RECORD.includes("practiceHaptics"));
  const ml = { "2026-10-01": { mood: 3, tags: ["tired"], fog: 2 } };
  const pl = [{ id: "r1", p: "slow", day: "2026-10-01", sec: 180, done: true, helped: "yes" }];
  const copy = backupCopy(appRecord({ moodLog: ml, practiceLog: pl, practiceFavs: ["slow"], practiceHaptics: true }));
  assert.deepEqual(copy.moodLog, ml); assert.deepEqual(copy.practiceLog, pl); assert.deepEqual(copy.practiceFavs, ["slow"]);
  assert.equal("practiceHaptics" in copy, false);
  assert.deepEqual(validateRecord(appRecord({ moodLog: { "2026-10-01": { mood: 9 } } })).length > 0, true);
  assert.deepEqual(validateRecord(appRecord({ practiceFavs: ["nope"] })).length > 0, true);
  assert.deepEqual(validateRecord(appRecord({ moodLog: ml, practiceLog: pl, practiceFavs: ["slow"] })), []);
});

test("Patterns (calm R6): experiments is a record key in backups, validated and restored literally", () => {
  assert.ok(RECORD.includes("experiments") && !DEVICE_ONLY.includes("experiments") && !NOT_IN_BACKUP.includes("experiments"));
  const ex = { active: { id: "winddown", start: "2026-10-26", done: ["2026-10-26"] }, skip: "2026-10-25", past: [{ id: "move", start: "2026-10-12", days: ["2026-10-13"], target: 3 }] };
  assert.deepEqual(backupCopy(appRecord({ experiments: ex })).experiments, ex);
  assert.deepEqual(validateRecord(appRecord({ experiments: ex })), []);
  assert.ok(validateRecord(appRecord({ experiments: { active: { id: "nope", start: "x" }, skip: null, past: [] } })).length > 0);
});
