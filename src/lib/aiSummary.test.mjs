/* Unit tests for lib/aiSummary.js (calm R8): the pseudonymized summary carries counts and fixed labels only.
   Adversarial fixtures put names, emails, ZIPs, dates, notes and free text everywhere the record can hold them and
   prove none of it reaches the summary or a request body built from it. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSummary, checkSummary, chatBody, weeklyBody, summaryLines, SUMMARY_PATHS, SUMMARY_VOCAB, BUCKETS, lifeStageOf, SUMMARY_WEEKS, HISTORY_MAX, QUESTION_MAX } from "./aiSummary.js";
import { addDays } from "./engine.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const TODAY = "2026-10-29";
const SECRETS = ["Maya", "Okafor", "maya.okafor@example.com", "90210", "35–44", "35-44", "2026-", "Oct", "October", "Tuesday", "St Mary", "Dr Lee", "metformin", "my boss", "secret", "LEAK", "555-0100", "@"];

/* A record stuffed with identifying and free-text data in every place it can live. */
function hostile() {
  const days = [];
  for (let i = 70; i >= 0; i--) {
    const date = addDays(TODAY, -i);
    const period = i % 30 < 4;
    days.push({
      date, period, flow: period ? "med" : null, sleepQ: i % 5 === 0 ? "poor" : "good",
      sym: { crm: period ? 2 : 0, blo: i % 3 === 0 ? 1 : 0, eng: i % 4 === 0 ? 3 : 0, "Maya's custom": 3, "maya.okafor@example.com": 2, hf: "LEAK", acn: 9 },
      note: `Maya Okafor, maya.okafor@example.com, ZIP 90210, saw Dr Lee on 2026-10-01 about metformin. secret LEAK`,
      scales: { fatigue: 7, pain: 4, moodq: 3, stress: 8 },
      cm: "eggwhite", opk: "pos", bbt: 36.7, // fertility signs: never sent
      name: "Maya", email: "maya.okafor@example.com", zip: "90210",
    });
  }
  const bodyLog = {};
  for (let i = 50; i >= 0; i--) bodyLog[addDays(TODAY, -i)] = { sleepH: 6.5 + (i % 3) * 0.5, move: [{ id: `m${i}`, type: "walk", min: 20 }], pcos: ["crash", "Maya secret", "cravings"], weight: { v: 71.3, unit: "kg" }, note: "LEAK" };
  const moodLog = {};
  for (let i = 30; i >= 0; i--) moodLog[addDays(TODAY, -i)] = { mood: (i % 5) + 1, tags: ["anxious", "tired", "Maya", "secret"], energy: i % 3 === 0 ? 1 : 2, fog: i % 4 === 0 ? 3 : 1, note: "LEAK" };
  const labs = [
    { id: "a", kind: "fglu", value: 97.46, unit: "mg/dL", date: "2026-10-02", note: "St Mary lab, Dr Lee" },
    { id: "b", kind: "fglu", value: 104, unit: "mg/dL", date: "2026-07-02" },
    { id: "c", kind: "hba1c", value: 5.67, unit: "%", date: "2026-09-12" },
    { id: "d", kind: "waist", value: 81.6, unit: "cm", date: "2026-09-30" },
    { id: "e", kind: "Maya", value: 1, unit: "x", date: "2026-09-30" },
  ];
  const experiments = { active: { id: "breathe", start: addDays(TODAY, -2), done: [addDays(TODAY, -2), TODAY] }, skip: TODAY, past: [{ id: "walk-lunch", start: addDays(TODAY, -20), days: [addDays(TODAY, -19)], target: 3 }] };
  return {
    stage: "periods", stageName: "My Cycle", entries: days, bodyLog, moodLog, labs, includeLabs: true, pcosOn: true, experiments, todayIso: TODAY,
    // fields a careless caller might pass: never read
    acct: { name: "Maya Okafor", email: "maya.okafor@example.com" }, regAnswers: { zip: "90210", age: "35–44", name: "Maya", dueDate: "2027-01-01" },
    journal: { [TODAY]: "secret LEAK Maya" }, connLog: { [TODAY]: { closeness: 3 } }, appts: [{ date: TODAY, who: "Dr Lee", note: "St Mary" }],
    meds: [{ id: 1, name: "metformin", kind: "med", started: "2026-01-01" }], pots: { log: "LEAK" }, wearData: [{ date: TODAY, temp: 0.2 }],
  };
}

const keysOf = (v, path = "", out = []) => {
  if (Array.isArray(v)) v.forEach((x) => keysOf(x, `${path}[]`, out));
  else if (v && typeof v === "object") for (const k of Object.keys(v)) { out.push(path ? `${path}.${k}` : k); keysOf(v[k], path ? `${path}.${k}` : k, out); }
  return out;
};
const stringsOf = (v, out = []) => { if (typeof v === "string") out.push(v); else if (v && typeof v === "object") Object.values(v).forEach((x) => stringsOf(x, out)); return out; };

test("hostile record: nothing identifying, dated or typed reaches the summary", () => {
  const s = buildSummary(hostile());
  const json = JSON.stringify(s);
  for (const w of SECRETS) assert.ok(!json.includes(w), `summary contains ${w}: ${json}`);
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(json), "no ISO date");
  assert.deepEqual(checkSummary(s), [], "the proof passes");
  for (const k of keysOf(s)) assert.ok(SUMMARY_PATHS.has(k), `unexpected field ${k}`);
  for (const t of stringsOf(s)) assert.ok(SUMMARY_VOCAB.has(t), `free text "${t}"`);
  for (const k of ["note", "email", "zip", "age", "date", "weight", "cm", "opk", "bbt", "journal", "meds", "appts", "pots", "wearData", "scales"]) assert.ok(!keysOf(s).some((p) => p.split(/[.[\]]+/).includes(k)), `field ${k}`);
});

test("hostile record: what IS in it is counts and fixed labels", () => {
  const s = buildSummary(hostile());
  assert.equal(s.kind, "cyra-summary"); assert.equal(s.lifeStage, "My Cycle"); assert.equal(s.weeks, SUMMARY_WEEKS);
  assert.equal(s.daysLogged, SUMMARY_WEEKS * 7);
  assert.ok(s.cycles.lengthsInDays.every((n) => Number.isInteger(n)));
  assert.ok(s.symptoms.length > 0 && s.symptoms.every((x) => ["Cramps", "Bloating", "Low energy"].includes(x.name)), JSON.stringify(s.symptoms));
  assert.deepEqual(s.pcosSignals.map((x) => x.name), ["Energy crash after meals"], "only known chips (ids it has no chip for are dropped), by label");
  assert.deepEqual(s.mood.feelings.map((f) => f.name).sort(), ["Anxious", "Tired"]);
  assert.deepEqual(s.labs, [{ name: "Fasting glucose", value: 97, unit: "mg/dL" }, { name: "HbA1c", value: 5.7, unit: "%" }, { name: "Waist measure", value: 82, unit: "cm" }], "latest per kind, rounded, no dates");
  assert.deepEqual(s.experiment, { name: "Three minutes of slow breathing", daysDone: 2, target: 4, status: "running" });
  for (const [k] of BUCKETS) assert.ok(Number.isInteger(s.daysLoggedByCycleDay[k]));
});

test("labs only when she ticks Include lab values; PCOS only with the module on", () => {
  const h = hostile();
  assert.equal(buildSummary({ ...h, includeLabs: false }).labs, undefined);
  assert.equal(buildSummary({ ...h, includeLabs: "yes" }).labs, undefined, "only a real true");
  const off = buildSummary({ ...h, pcosOn: false });
  assert.equal(off.pcosSignals, undefined); assert.equal(off.cycles.longerThan35Days, undefined);
});

test("pregnancy and menopause: no cycles; pregnancy uses its own symptom labels", () => {
  const preg = buildSummary({ stage: "preg", stageName: "Pregnancy", entries: [{ date: TODAY, sym: { nau: 2, hb: 1, crm: 3 } }], todayIso: TODAY });
  assert.equal(preg.lifeStage, "Pregnancy"); assert.equal(preg.cycles, undefined); assert.equal(preg.daysLoggedByCycleDay, undefined);
  assert.deepEqual(preg.symptoms.map((x) => x.name), ["Nausea", "Heartburn"], "a cycle-library id is not a pregnancy symptom");
  assert.deepEqual(checkSummary(preg), []);
  const meno = buildSummary({ ...hostile(), stage: "peri", stageName: "Menopause" });
  assert.equal(meno.lifeStage, "Menopause"); assert.equal(meno.cycles, undefined);
  assert.deepEqual(checkSummary(meno), []);
  assert.equal(lifeStageOf("periods", "Trying to Conceive"), "Trying to conceive");
  assert.equal(lifeStageOf("peri", "Perimenopause"), "Perimenopause");
});

test("an empty or junk record gives a small safe summary", () => {
  for (const input of [{ todayIso: TODAY }, { todayIso: TODAY, entries: "x", bodyLog: [], moodLog: null, labs: {}, experiments: 7 }, {}, undefined]) {
    const s = buildSummary(input);
    assert.deepEqual(checkSummary(s), [], JSON.stringify(s));
  }
});

test("checkSummary catches anything outside the allowlist", () => {
  const s = buildSummary(hostile());
  const bad = [
    { ...s, note: "hi" }, { ...s, lifeStage: "Maya" }, { ...s, weeks: -1 }, { ...s, weeks: Infinity },
    { ...s, symptoms: [{ name: "My own thing", days: 1 }] }, { ...s, labs: [{ name: "HbA1c", value: 5.6, unit: "%", date: "2026-10-01" }] },
    { ...s, symptoms: [{ name: "Cramps", days: "2026-10-01" }] }, { ...s, mood: { ...s.mood, checkIns: "maya@x.io" } }, { ...s, kind: "other" },
    { ...s, sleep: { ...s.sleep, averageHours: true } }, null, [], "x",
  ];
  for (const b of bad) assert.ok(checkSummary(b).length > 0, JSON.stringify(b)?.slice(0, 120));
});

test("request bodies: weekly is { summary }; chat is { summary, question, history } with history capped", () => {
  const s = buildSummary(hostile());
  assert.deepEqual(Object.keys(weeklyBody(s)), ["summary"]);
  const hist = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? "cyra" : "me", text: `m${i} ${"x".repeat(2000)}`, at: "2026-10-29", sent: true }));
  const b = chatBody({ summary: s, question: `  ${"q".repeat(900)}  `, history: [...hist, { role: "system", text: "x" }, { role: "me", text: "  " }, null] });
  assert.deepEqual(Object.keys(b), ["summary", "question", "history"]);
  assert.equal(b.question.length, QUESTION_MAX);
  assert.equal(b.history.length, HISTORY_MAX);
  assert.ok(b.history.every((m) => ["user", "assistant"].includes(m.role) && Object.keys(m).join() === "role,text" && m.text.length <= 1200));
  assert.ok(!JSON.stringify(b.history).includes("2026-10-29"), "history keeps no time stamps");
  const local = chatBody({ summary: s, question: "q?", history: [{ role: "me", text: "chest pain LOCALQ", kind: "local" }, { role: "cyra", text: "call 911", kind: "urgent" }, { role: "me", text: "ok" }] });
  assert.deepEqual(local.history, [{ role: "user", text: "ok" }], "a question answered on this device and an emergency reply are never sent");
});

test("summaryLines restate the fields in plain words, with no dates", () => {
  const lines = summaryLines(buildSummary(hostile()));
  assert.ok(lines.length >= 8);
  assert.ok(lines.some(([l]) => l === "Time covered"));
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(JSON.stringify(lines)));
  for (const w of SECRETS.filter((x) => x !== "@")) assert.ok(!JSON.stringify(lines).includes(w), w);
});

test("aiSummary.js does no I/O", () => {
  const code = readFileSync(join(HERE, "aiSummary.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const w of ["fetch(", "XMLHttpRequest", "indexedDB", "localStorage", "import.meta", "regAnswers", "acct"]) assert.ok(!code.includes(w), w);
});

test("meal notes: aggregated counts only, only with Meal notes on, never in pregnancy", () => {
  const bodyLog = {};
  for (let i = 0; i < 10; i++) bodyLog[addDays(TODAY, -i)] = { meals: [{ id: `a${i}`, meal: "lunch", kind: i % 2 ? "carbs" : "protein", energy: i % 4 ? "steady" : "crashed", late: i < 3, food: "pasta LEAK" }] };
  bodyLog[addDays(TODAY, -100)] = { meals: [{ id: "old", meal: "dinner", kind: "skipped" }] };
  const off = buildSummary({ stage: "periods", stageName: "My Cycle", bodyLog, todayIso: TODAY });
  assert.equal("meals" in off, false);
  const on = buildSummary({ stage: "periods", stageName: "My Cycle", bodyLog, todayIso: TODAY, mealsOn: true });
  assert.deepEqual(on.meals, { daysWithNotes: 10, daysWith: { balanced: 0, mostlyCarbsOrSweet: 5, proteinForward: 5, skipped: 0, ateLate: 3 }, energyAfter: { steady: 7, dipped: 0, crashed: 3 } });
  assert.deepEqual(checkSummary(on), []);
  const json = JSON.stringify(on);
  for (const bad of ["lunch", "Lunch", "pasta", "LEAK", "2026-"]) assert.ok(!json.includes(bad), bad);
  assert.equal("meals" in buildSummary({ stage: "preg", stageName: "Pregnancy", bodyLog, todayIso: TODAY, mealsOn: true }), false);
  assert.equal("meals" in buildSummary({ stage: "periods", stageName: "My Cycle", bodyLog, todayIso: TODAY, mealsOn: "yes" }), false);
  const line = summaryLines(on).find(([l]) => l.startsWith("Meal notes"));
  assert.ok(line && /10 days with meal notes/.test(line[1]) && /crashed 3/.test(line[1]));
  // a meal note smuggled in as text is refused
  assert.ok(checkSummary({ ...on, meals: { ...on.meals, food: "pasta" } }).length > 0);
});
