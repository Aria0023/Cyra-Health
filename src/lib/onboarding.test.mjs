// Onboarding routing and helpers (L11). Run with: node --test src/lib/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { REG_STAGE, STAGE_LABELS, STAGE_CARDS, ANSWER_BLANK, regSteps, missingFor, socialReturnStep, toggleMulti, pruneForStage, sanitizeZip, pregWeekFrom, dueDateBounds } from "./onboarding.js";
import { PHASES } from "./record.js";

const CYCLE = ["stage", "account", "cycle", "consent"];

test("regSteps: cycle stages and null get Cycle, Pregnant gets Pregnancy, Menopause & beyond skips the third step", () => {
  for (const l of [null, "My Cycle", "Trying to conceive", "Perimenopause"]) assert.deepEqual(regSteps(l), CYCLE);
  assert.deepEqual(regSteps("Pregnant"), ["stage", "account", "pregnancy", "consent"]);
  assert.deepEqual(regSteps("Menopause & beyond"), ["stage", "account", "consent"]);
});

test("missingFor: stage needs a stage, cycle only a length, consent the box, the rest nothing", () => {
  assert.deepEqual(missingFor("stage", { stage: null }), ["stage"]);
  assert.deepEqual(missingFor("stage", { stage: "My Cycle" }), []);
  assert.deepEqual(missingFor("cycle", { cycleLen: null, cycleReg: null, lastPeriod: "" }), ["cycleLen"]);
  assert.deepEqual(missingFor("cycle", { cycleLen: "24–31 days", cycleReg: null, lastPeriod: "" }), []);
  assert.deepEqual(missingFor("account", { name: "", email: "" }), []);
  assert.deepEqual(missingFor("pregnancy", { dueDate: "" }), []);
  assert.deepEqual(missingFor("consent", { terms: false }), ["terms"]);
  assert.deepEqual(missingFor("consent", { terms: true }), []);
  assert.deepEqual(missingFor("cycle", undefined), ["cycleLen"]);
});

test("socialReturnStep: 2 for every stage (the step after Device), 0 with no stage", () => {
  for (const l of Object.keys(REG_STAGE)) assert.equal(socialReturnStep(l), 2);
  assert.equal(socialReturnStep(null), 0);
  assert.equal(socialReturnStep(undefined), 0);
});

test("toggleMulti: None answers are exclusive, re-tap removes, order kept, input untouched", () => {
  const a = ["PCOS", "Thyroid"];
  assert.deepEqual(toggleMulti(a, "None"), ["None"]);
  assert.deepEqual(toggleMulti(["Early menopause"], "None / unsure"), ["None / unsure"]);
  assert.deepEqual(toggleMulti(["None"], "PCOS"), ["PCOS"]);
  assert.deepEqual(toggleMulti(a, "PCOS"), ["Thyroid"]);
  assert.deepEqual(toggleMulti(a, "Anemia"), ["PCOS", "Thyroid", "Anemia"]);
  assert.deepEqual(a, ["PCOS", "Thyroid"]);
  assert.deepEqual(toggleMulti(undefined, "PCOS"), ["PCOS"]);
});

test("pruneForStage: answers from a step outside her flow are emptied; nothing else changes; input untouched", () => {
  const base = { name: "Ada", email: "a@b.c", anon: false, stage: "Pregnant", cycleLen: "24–31 days", lastPeriod: "2026-10-01", dueDate: "2027-02-01", age: "35–44", conditions: ["PCOS"], terms: true };
  const p = pruneForStage(base);
  assert.equal(p.dueDate, "2027-02-01"); assert.equal(p.cycleLen, null); assert.equal(p.lastPeriod, "");
  assert.equal(p.name, "Ada"); assert.equal(p.email, "a@b.c"); assert.equal(p.age, "35–44"); assert.deepEqual(p.conditions, ["PCOS"]); assert.equal(p.terms, true);
  assert.equal(base.cycleLen, "24–31 days");
  const m = pruneForStage({ ...base, stage: "Menopause & beyond" });
  assert.equal(m.dueDate, ""); assert.equal(m.cycleLen, null); assert.equal(m.lastPeriod, "");
  for (const s of ["My Cycle", "Trying to conceive", "Perimenopause"]) {
    const c = pruneForStage({ ...base, stage: s });
    assert.equal(c.dueDate, ""); assert.equal(c.cycleLen, "24–31 days"); assert.equal(c.lastPeriod, "2026-10-01");
  }
});

test("sanitizeZip: strips punctuation, keeps postcodes, cuts at 10", () => {
  assert.equal(sanitizeZip("12 Main St., Apt #4"), "12 Main St");
  assert.equal(sanitizeZip("SW1A 1AA"), "SW1A 1AA");
  assert.equal(sanitizeZip("12345678901234"), "1234567890");
  assert.equal(sanitizeZip(null), "");
});

const plus = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

test("pregWeekFrom: 40 weeks before the due date, clamped 1–42, null outside two weeks over or 40 weeks ahead", () => {
  const t = "2026-10-23";
  assert.equal(pregWeekFrom(t, t), 40);
  assert.equal(pregWeekFrom(plus(t, 126), t), 22);
  assert.equal(pregWeekFrom(plus(t, 200), t), 11);
  assert.equal(pregWeekFrom(plus(t, 280), t), 1);
  assert.equal(pregWeekFrom(plus(t, -10), t), 41);
  assert.equal(pregWeekFrom(plus(t, -14), t), 42);
  assert.equal(pregWeekFrom(plus(t, -15), t), null);
  assert.equal(pregWeekFrom(plus(t, 281), t), null);
  assert.equal(pregWeekFrom("", t), null);
  assert.equal(pregWeekFrom(undefined, t), null);
  assert.equal(pregWeekFrom("2026-13-01", t), null);
  assert.equal(pregWeekFrom("2026-03-09", "2026-03-07"), 39); // across a DST change
});

test("dueDateBounds: today−14 to today+280, and the ends map to weeks 42 and 1", () => {
  const t = "2026-10-23";
  const b = dueDateBounds(t);
  assert.deepEqual(b, { min: plus(t, -14), max: plus(t, 280) });
  assert.equal(pregWeekFrom(b.min, t), 42);
  assert.equal(pregWeekFrom(b.max, t), 1);
});

test("REG_STAGE and STAGE_LABELS: the five cards, each a known stage, matching record.js PHASES", () => {
  const cards = STAGE_CARDS.map(([l]) => l);
  assert.deepEqual(Object.keys(REG_STAGE), cards);
  assert.deepEqual(Object.keys(STAGE_LABELS), cards);
  for (const v of Object.values(REG_STAGE)) assert.ok(["periods", "preg", "peri"].includes(v));
  assert.equal(STAGE_LABELS["Menopause & beyond"], "Menopause");
  assert.equal(STAGE_LABELS["Trying to conceive"], "Trying to Conceive");
  const map = { "My Cycle": "cycle", "Trying to conceive": "ttc", "Pregnant": "preg", "Perimenopause": "peri", "Menopause & beyond": "meno" };
  for (const [card, ph] of Object.entries(map)) {
    assert.equal(STAGE_LABELS[card], PHASES[ph].stageName);
    assert.equal(REG_STAGE[card], PHASES[ph].stage);
  }
});

test("ANSWER_BLANK carries no identity and includes dueDate", () => {
  for (const k of ["name", "email", "anon"]) assert.equal(k in ANSWER_BLANK, false);
  assert.equal(ANSWER_BLANK.dueDate, "");
  assert.deepEqual(Object.keys(ANSWER_BLANK), ["age", "zip", "stage", "cycleLen", "cycleReg", "lastPeriod", "dueDate", "preg", "births", "contra", "conditions", "familyHx", "meds", "goals", "sleep", "activity"]);
});

test("onboarding.js makes no network call, touches no browser storage and imports nothing impure", () => {
  const src = fs.readFileSync(new URL("./onboarding.js", import.meta.url), "utf8");
  for (const bad of [/fetch\(/, /XMLHttpRequest/, /sendBeacon/, /localStorage/, /sessionStorage/, /indexedDB/i, /from\s+["'][^"']*(api|storage|features|react|capacitor)[^"']*["']/]) assert.equal(bad.test(src), false, `found ${bad}`);
  assert.equal(/^import /m.test(src), false);
});
