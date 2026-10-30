/* Unit tests for lib/modules.js (calm R1): the condition-module registry, the persisted `modules` key and the PCOS
   data's sourcing rules. Run with `npm run test:unit`. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MODULES, MODULE_IDS, MODULE_PHASES, MODULE_FRAMING, modulePhase, cleanModules, isModuleOn, setModuleOn, modulesFor, sourcesOf, longCycleCount } from "./modules.js";
import { freshEmpty } from "./pots.js";
import { ALL_SYM } from "./constants.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIELDS = ["id", "name", "short", "stages", "symptoms", "signals", "askTopics", "reportSections", "patternQuestions", "evidence"];

test("registry: pots and pcos, each with the full shape, frozen", () => {
  assert.deepEqual([...MODULE_IDS], ["pots", "pcos"]);
  for (const id of MODULE_IDS) {
    const m = MODULES[id];
    for (const f of FIELDS) assert.ok(f in m, `${id}.${f}`);
    assert.equal(m.id, id);
    assert.ok(Object.isFrozen(m) && Object.isFrozen(m.stages));
    for (const s of m.stages) assert.ok(MODULE_PHASES.includes(s), `${id} stage ${s}`);
  }
  assert.ok(Object.isFrozen(MODULES));
});

test("modulesFor / modulePhase: PCOS in My Cycle, Trying to conceive and Perimenopause only; POTS everywhere", () => {
  const ids = (...a) => modulesFor(...a).map((m) => m.id);
  assert.deepEqual(ids("periods", "My Cycle"), ["pots", "pcos"]);
  assert.deepEqual(ids("periods", "Trying to Conceive"), ["pots", "pcos"]);
  assert.deepEqual(ids("peri", "Perimenopause"), ["pots", "pcos"]);
  assert.deepEqual(ids("peri", "Menopause"), ["pots"]);
  assert.deepEqual(ids("preg", "Pregnancy"), ["pots"]);
  assert.deepEqual(ids("ttc"), ["pots", "pcos"]);
  assert.deepEqual(ids("meno"), ["pots"]);
  assert.deepEqual(ids(null), []);
  assert.equal(modulePhase("periods", "x"), "cycle");
  assert.equal(modulePhase("bogus"), null);
});

test("cleanModules: known ids get { on, since }, POTS is dropped (it lives in pots), a later build's module is kept", () => {
  for (const v of [undefined, null, 1, "x", []]) assert.deepEqual(cleanModules(v), {});
  assert.deepEqual(cleanModules({ pcos: { on: true, since: "2026-10-01" } }), { pcos: { on: true, since: "2026-10-01" } });
  assert.deepEqual(cleanModules({ pcos: { on: "yes", since: "Oct 1" } }), { pcos: { on: false, since: null } });
  assert.deepEqual(cleanModules({ pcos: 3 }), {});
  assert.deepEqual(cleanModules({ pots: { on: true } }), {});
  assert.deepEqual(cleanModules({ hairloss: { on: true, extra: 1 } }), { hairloss: { on: true, extra: 1 } });
  const clean = { pcos: { on: false, since: "2026-01-02" } };
  assert.equal(JSON.stringify(cleanModules(clean)), JSON.stringify(clean), "idempotent");
});

test("isModuleOn / setModuleOn: PCOS writes record.modules; POTS reads and writes record.pots through pots.js", () => {
  const rec = { modules: {}, pots: freshEmpty() };
  assert.equal(isModuleOn(rec, "pcos"), false);
  assert.equal(isModuleOn(rec, "pots"), false);
  assert.equal(isModuleOn(rec, "nope"), false);
  const a = setModuleOn(rec, "pcos", true, { day: "2026-10-29" });
  assert.notEqual(a, rec); assert.deepEqual(rec.modules, {}, "input unchanged");
  assert.deepEqual(a.modules, { pcos: { on: true, since: "2026-10-29" } });
  assert.equal(isModuleOn(a, "pcos"), true);
  assert.equal(setModuleOn(a, "pcos", true), a, "already on: same record");
  const b = setModuleOn(a, "pcos", false);
  assert.deepEqual(b.modules, { pcos: { on: false, since: "2026-10-29" } });
  assert.equal(isModuleOn(b, "pcos"), false);
  const c = setModuleOn(rec, "pots", true, { day: "2026-10-29" });
  assert.equal(c.pots.on, true); assert.equal(c.pots.since, "2026-10-29"); assert.equal(isModuleOn(c, "pots"), true);
  assert.equal(rec.pots.on, false, "input pots unchanged");
  const d = setModuleOn(c, "pots", false);
  assert.equal(d.pots.on, false); assert.equal(d.pots.since, "2026-10-29", "turning POTS off keeps its log");
  assert.equal(setModuleOn(rec, "nope", true), rec);
  assert.equal(isModuleOn(null, "pcos"), false);
});

test("PCOS data: the brief's symptom chips, IR signals, >35-day cycles, four pattern questions", () => {
  const p = MODULES.pcos;
  assert.deepEqual(p.symptoms.map((s) => s.label), ["Acne", "Hair loss", "Excess hair growth", "Fatigue", "Bloating", "Mood swings", "Brain fog", "Headache", "Pelvic pain", "Cramps", "Cravings", "High-sugar day"]);
  for (const s of p.symptoms) if (s.shared) assert.ok(ALL_SYM[s.id], `${s.id} is a check-in symptom`); else assert.ok(!ALL_SYM[s.id], `${s.id} is new`);
  assert.deepEqual(p.signals.map((s) => s.id), ["crash", "cra", "waist", "fglu", "hba1c", "acan"]);
  assert.deepEqual(p.signals.find((s) => s.id === "fglu").units, ["mg/dL", "mmol/L"]);
  assert.deepEqual(p.signals.find((s) => s.id === "hba1c").units, ["%", "mmol/mol"]);
  assert.equal(p.weight.optional, true);
  assert.equal(p.cycle.longDays, 35);
  assert.deepEqual(p.patternQuestions.map((q) => q.topic), ["Sleep and fatigue", "High-sugar days", "Movement and mood", "Cycle length"]);
  assert.equal(longCycleCount([28, 36, 35, 60, null, "x"]), 2);
  assert.equal(longCycleCount(null), 0);
});

/* Every sentence that says something about a condition, with its sources. */
const medical = (m) => [
  ...(m.cycle ? ["expected", "definition"].map((k) => [`cycle.${k}`, m.cycle[k]]) : []),
  ...m.signals.filter((s) => s.info).map((s) => [`signal.${s.id}`, { text: s.info, src: s.src }]),
  ...m.askTopics.map((t) => [`ask.${t.id}`, { text: t.a, src: t.src }]),
];

test("PCOS sourcing: every medical sentence cites a named source with title, body and year; no diagnosis or treatment wording", () => {
  const p = MODULES.pcos;
  assert.deepEqual(p.evidence.map((e) => e.id), ["teede2023", "rotterdam2004", "nicecks"]);
  for (const e of p.evidence) { assert.ok(e.title.length > 10 && e.body.length > 10, e.id); assert.ok(Number.isInteger(e.year), e.id); }
  assert.match(p.evidence[0].title, /2023 International Evidence-based Guideline/);
  const items = medical(p);
  assert.ok(items.length >= 8);
  for (const [k, it] of items) {
    assert.ok(Array.isArray(it.src) && it.src.length, `${k} cites a source`);
    assert.equal(sourcesOf(p, it.src).length, it.src.length, `${k} sources resolve`);
  }
  const all = JSON.stringify(p);
  for (const bad of [/you have PCOS/i, /\bcure/i, /\btreat(s|ment)? (your|it|PCOS)/i, /\bmetformin|\bspironolactone|\binositol/i, /\bdose\b/i, /\bscore/i, /\bstreak/i]) assert.ok(!bad.test(all), `no ${bad}`);
  assert.match(p.askTopics.find((t) => t.id === "pcos-diagnosis").a, /Cyra does not diagnose PCOS\./);
  assert.match(MODULE_FRAMING, /not a diagnosis or medical advice/);
});

test("CLINICIAN-REVIEW.md lists every PCOS medical sentence as awaiting sign-off", () => {
  const doc = readFileSync(join(ROOT, "docs", "CLINICIAN-REVIEW.md"), "utf8");
  for (const [k, it] of medical(MODULES.pcos)) assert.ok(doc.includes(it.text), `${k} is in docs/CLINICIAN-REVIEW.md`);
  assert.match(doc, /Awaiting clinician sign-off/);
});

test("layering: modules.js imports only engine, constants and pots; never record.js, storage, React or the network", () => {
  const src = readFileSync(join(ROOT, "src", "lib", "modules.js"), "utf8");
  const imports = [...src.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ["./constants.js", "./engine.js", "./pots.js"]);
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const w of ["fetch(", "localStorage", "indexedDB", "react", "record.js"]) assert.ok(!code.includes(w), w);
});
