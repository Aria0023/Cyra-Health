// Onboarding routing and helpers (L11). Run with: node --test src/lib/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { REG_STAGE, STAGE_LABELS, STAGE_CARDS, ANSWER_BLANK, PCOS_ANSWERS, PCOS_STAGES, STEP_COPY, cleanPcosAnswer, pcosModuleFrom, regSteps, missingFor, socialReturnStep, toggleMulti, pruneForStage, cleanStages, toggleStage, primaryStage, goalsForStages, stageSummary, STAGE_ALONE, STAGE_GOAL, GOALS, sanitizeZip, pregWeekFrom, dueDateBounds } from "./onboarding.js";
import { PHASES } from "./record.js";

const CYCLE = ["stage", "pcos", "account", "cycle", "consent"];

test("regSteps: cycle stages and null get PCOS (optional) and Cycle, Pregnant gets Pregnancy, Menopause & beyond skips the third step", () => {
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

test("socialReturnStep: the step after Device for every stage (3 with the PCOS step, else 2), 0 with no stage", () => {
  for (const l of Object.keys(REG_STAGE)) assert.equal(socialReturnStep(l), PCOS_STAGES.includes(l) ? 3 : 2);
  for (const l of Object.keys(REG_STAGE)) assert.equal(regSteps(l)[socialReturnStep(l) - 1], "account");
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

test("PCOS step (calm R2): optional, only for My Cycle / Trying to conceive / Perimenopause, four answers", () => {
  assert.deepEqual(PCOS_ANSWERS.map(([, l]) => l), ["Yes, diagnosed", "I suspect it", "No", "Prefer not to say"]);
  assert.deepEqual(PCOS_STAGES, ["My Cycle", "Trying to conceive", "Perimenopause"]);
  assert.equal(STEP_COPY.pcos.title, "Living with PCOS?");
  for (const l of PCOS_STAGES) assert.equal(regSteps(l)[1], "pcos");
  for (const l of ["Pregnant", "Menopause & beyond"]) assert.equal(regSteps(l).includes("pcos"), false);
  // Continue works with nothing picked.
  assert.deepEqual(missingFor("pcos", { pcos: null }), []);
  assert.deepEqual(missingFor("pcos", {}), []);
});

test("pcosModuleFrom: Yes or I suspect it turn the module on, only in the stages that asked", () => {
  for (const l of PCOS_STAGES) {
    assert.equal(pcosModuleFrom(l, "yes"), true);
    assert.equal(pcosModuleFrom(l, "suspect"), true);
    for (const a of ["no", "unsaid", null, undefined, "", "YES"]) assert.equal(pcosModuleFrom(l, a), false);
  }
  for (const l of ["Pregnant", "Menopause & beyond", null]) assert.equal(pcosModuleFrom(l, "yes"), false);
});

test("cleanPcosAnswer and pruneForStage keep regAnswers.pcos only where the step was asked", () => {
  for (const [id] of PCOS_ANSWERS) assert.equal(cleanPcosAnswer(id), id);
  for (const bad of [null, undefined, "", "maybe", 1, {}]) assert.equal(cleanPcosAnswer(bad), null);
  assert.equal(pruneForStage({ stage: "My Cycle", pcos: "suspect" }).pcos, "suspect");
  assert.equal(pruneForStage({ stage: "Perimenopause", pcos: "bogus" }).pcos, null);
  assert.equal(pruneForStage({ stage: "Trying to conceive" }).pcos, null);
  assert.equal(pruneForStage({ stage: "Pregnant", pcos: "yes" }).pcos, null);
  assert.equal(pruneForStage({ stage: "Menopause & beyond", pcos: "yes" }).pcos, null);
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
  assert.equal(ANSWER_BLANK.pcos, null);
  assert.deepEqual(Object.keys(ANSWER_BLANK), ["age", "zip", "stage", "stages", "pcos", "cycleLen", "cycleReg", "lastPeriod", "dueDate", "preg", "births", "contra", "conditions", "familyHx", "meds", "goals", "sleep", "activity"]);
});

test("onboarding.js makes no network call, touches no browser storage and imports nothing impure", () => {
  const src = fs.readFileSync(new URL("./onboarding.js", import.meta.url), "utf8");
  for (const bad of [/fetch\(/, /XMLHttpRequest/, /sendBeacon/, /localStorage/, /sessionStorage/, /indexedDB/i, /from\s+["'][^"']*(api|storage|features|react|capacitor)[^"']*["']/]) assert.equal(bad.test(src), false, `found ${bad}`);
  assert.equal(/^import /m.test(src), false);
});

test("regSteps with sign-in: Create your account comes first for every stage; a finished sign-in lands on the stage step", () => {
  for (const l of [null, ...Object.keys(REG_STAGE)]) {
    assert.deepEqual(regSteps(l, { signin: true }), ["signin", ...regSteps(l)]);
    assert.equal(socialReturnStep(l, { signin: true }), 1);
    assert.equal(regSteps(l, { signin: true })[1], "stage");
  }
  assert.equal(STEP_COPY.signin.title, "Create your account");
  assert.ok(!/no Solia Health account/i.test(STEP_COPY.deviceSignin.sub), "the Device step in a sign-in build never says there is no account");
});

test("registration never asks about wearables: no device step for any stage, with or without sign-in", () => {
  for (const l of [null, ...Object.keys(REG_STAGE)]) {
    for (const signin of [false, true]) assert.equal(regSteps(l, { signin, devices: true }).includes("devices"), false, `${l} ${signin}`);
  }
  assert.equal("devices" in STEP_COPY, false);
});

test("stage cards are multi-pick: periods and perimenopause together, Pregnant and Menopause & beyond alone", () => {
  let s = toggleStage([], "My Cycle");
  s = toggleStage(s, "Perimenopause");
  assert.deepEqual(s, ["My Cycle", "Perimenopause"]);
  assert.equal(primaryStage(s), "Perimenopause", "one experience: peri, which tracks periods too");
  assert.deepEqual(toggleStage(s, "My Cycle"), ["Perimenopause"], "a second tap clears a card");
  assert.deepEqual(toggleStage(s, "Pregnant"), ["Pregnant"], "Pregnant stands alone");
  assert.deepEqual(toggleStage(["Pregnant"], "My Cycle"), ["My Cycle"], "another card clears Pregnant");
  assert.deepEqual(toggleStage(["Perimenopause"], "Menopause & beyond"), ["Menopause & beyond"]);
  assert.deepEqual(toggleStage(["My Cycle"], "Not a stage"), ["My Cycle"]);
  assert.equal(primaryStage(["Trying to conceive", "Perimenopause"]), "Trying to conceive");
  assert.equal(primaryStage(["My Cycle", "Trying to conceive"]), "Trying to conceive");
  assert.equal(primaryStage([]), null);
  assert.deepEqual(cleanStages(["Perimenopause", "My Cycle", "x"]), ["My Cycle", "Perimenopause"], "card order, known only");
  assert.deepEqual(cleanStages(["My Cycle", "Pregnant"]), ["Pregnant"]);
  for (const l of STAGE_ALONE) assert.ok(REG_STAGE[l]);
  for (const g of Object.values(STAGE_GOAL)) assert.ok(GOALS.includes(g), g);
  assert.deepEqual(goalsForStages(["My Cycle", "Perimenopause"]), ["Predict my cycle", "Track the transition"]);
  assert.deepEqual(goalsForStages(["Pregnant"]), []);
});

test("the stage summary names the one experience and what the other picks become", () => {
  assert.equal(stageSummary([]), null);
  assert.equal(stageSummary(["Pregnant"]), "Your app will be set up for Pregnancy.");
  assert.equal(stageSummary(["My Cycle", "Perimenopause"]), "Your app will be set up for Perimenopause, with \u201cPredict my cycle\u201d added to your goals.");
  assert.equal(stageSummary(["My Cycle", "Trying to conceive", "Perimenopause"]), "Your app will be set up for Trying to Conceive, with \u201cPredict my cycle\u201d and \u201cTrack the transition\u201d added to your goals.");
});

test("pruneForStage keeps the picked cards and the primary in step; an older record with one stage still works", () => {
  const a = pruneForStage({ ...ANSWER_BLANK, stages: ["Perimenopause", "My Cycle"], stage: "My Cycle", cycleLen: "Irregular", lastPeriod: "2026-11-01" });
  assert.deepEqual(a.stages, ["My Cycle", "Perimenopause"]);
  assert.equal(a.stage, "Perimenopause");
  assert.equal(a.lastPeriod, "2026-11-01", "peri keeps the period date");
  const old = pruneForStage({ stage: "Pregnant", dueDate: "2027-03-01" });
  assert.deepEqual(old.stages, ["Pregnant"]);
  assert.equal(old.stage, "Pregnant");
  assert.deepEqual(ANSWER_BLANK.stages, []);
});

