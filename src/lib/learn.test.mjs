import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEARN, LEARN_IDS, LEARN_SOURCES, learnOf, learnSources, learnFor, LEARN_COPY } from "./learn.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const review = fs.readFileSync(path.resolve(here, "../../docs/CLINICIAN-REVIEW.md"), "utf8");

test("every explainer is 3 to 6 short sentences with at least one named source", () => {
  assert.ok(LEARN.length >= 9);
  for (const e of LEARN) {
    assert.ok(e.body.length >= 3 && e.body.length <= 6, `${e.id}: ${e.body.length} sentences`);
    for (const s of e.body) assert.ok(s.length <= 200, `${e.id}: a short sentence (${s.length})`);
    assert.ok(e.sources.length >= 1, `${e.id} has sources`);
    for (const s of e.sources) assert.ok(LEARN_SOURCES[s], `${e.id}: source ${s} is named`);
    assert.equal(learnSources(e).length, e.sources.length);
  }
  assert.equal(new Set(LEARN_IDS).size, LEARN_IDS.length);
});

test("guidance only: no targets, doses, scores, diagnoses for her or contraception claims", () => {
  const all = LEARN.flatMap((e) => [e.title, ...e.body]).join(" ");
  assert.doesNotMatch(all, /\b(you have|you are ovulating|your target is|take \d|mg\b|dose of|streak|score)\b/i);
  assert.doesNotMatch(all, /\b\d+\s*(?:–|-|to)\s*\d+\s*mg\/dL|mmol\/L/i, "no glucose target numbers");
  assert.doesNotMatch(all, /birth control|prevent pregnancy|safe days/i);
  assert.match(learnOf("glucose").body.join(" "), /Ask your clinician about your targets\./);
  assert.match(learnOf("fertile").body.join(" "), /estimate|can know/);
});

test("the library covers the topics the brief names", () => {
  for (const id of ["cycle", "fertile", "lh", "bbt", "mucus", "irregular", "peri", "wearables", "glucose"]) assert.ok(learnOf(id), id);
  assert.equal(learnOf("nope"), null);
});

test("every explainer and source is registered in docs/CLINICIAN-REVIEW.md", () => {
  for (const e of LEARN) {
    assert.ok(review.includes(`### learn.${e.id}`), `CLINICIAN-REVIEW has learn.${e.id}`);
    for (const s of e.body) assert.ok(review.includes(s), `learn.${e.id} sentence registered: ${s}`);
  }
  for (const k of Object.keys(LEARN_SOURCES)) assert.ok(review.includes(`**${k}**`), `source ${k} listed`);
});

test("learnFor lists every explainer once, her stage's first", () => {
  for (const o of [{ stage: "periods" }, { stage: "periods", ttc: true }, { stage: "peri" }, { stage: "peri", meno: true }, { stage: "preg" }, { stage: "periods", glucose: true }]) {
    const ids = learnFor(o).map((e) => e.id);
    assert.deepEqual([...ids].sort(), [...LEARN_IDS].sort(), JSON.stringify(o));
  }
  assert.equal(learnFor({ stage: "periods", ttc: true })[0].id, "fertile");
  assert.equal(learnFor({ stage: "peri" })[0].id, "peri");
  assert.match(LEARN_COPY.lead, /opening one sends nothing/);
});
