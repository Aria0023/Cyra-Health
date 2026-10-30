import test from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";
import { BUILD_STAMP, MODULE_ADDS, MODULE_ADDS_IDS, PLAN_COPY, ACCOUNT_LINES, NOT_MEDICAL, AI_OFF_LINE, accountLine } from "./about.js";
import { MODULE_IDS } from "./modules.js";

const BANNED = /\b(streak|score|grade|perfect|fail|cure|treat(s|ment)? (your|pcos|pots)|diagnos(e|es|ed)? (you|your))\b/i;

test("the build stamp keeps its harness text", () => {
  assert.equal(BUILD_STAMP, "BUILD 2026.10.07-D");
});

test("every shipped module has a one-line 'what it adds' (and fertility signs)", () => {
  for (const id of MODULE_IDS.filter((m) => m !== "hairloss")) assert.ok(MODULE_ADDS[id], `no 'what it adds' for ${id}`);
  assert.ok(MODULE_ADDS.fert);
  assert.deepEqual([...MODULE_ADDS_IDS].sort(), ["fert", "pcos", "pots"]);
});

test("module lines are short, plain and say PCOS is not diagnosed", () => {
  for (const [id, t] of Object.entries(MODULE_ADDS)) {
    assert.ok(t.length < 220, `${id} line is long`);
    assert.ok(!BANNED.test(t), `${id} line has a banned word`);
  }
  assert.match(MODULE_ADDS.pcos, /does not diagnose PCOS/);
});

test("the plan copy is honest: nothing to buy, no pressure words", () => {
  assert.match(PLAN_COPY.none, /nothing to buy/);
  for (const t of Object.values(PLAN_COPY)) assert.ok(!/\b(upgrade|limited time|unlock now|don't miss|hurry|only \$)/i.test(t), t);
});

test("account lines: a name is mentioned only when one was given", () => {
  assert.equal(accountLine({ anon: true, name: "" }), ACCOUNT_LINES.none);
  assert.equal(accountLine({ anon: false, name: "" }), ACCOUNT_LINES.none);
  assert.equal(accountLine({ anon: false, name: "Maya" }), ACCOUNT_LINES.named);
  assert.equal(accountLine(null), ACCOUNT_LINES.none);
});

test("legal lines say what Cyra is not", () => {
  assert.match(NOT_MEDICAL, /not a medical device/);
  assert.match(NOT_MEDICAL, /does not diagnose/);
  assert.match(AI_OFF_LINE, /aren't sent anywhere/);
});

test("each module line is in the clinician register", () => {
  const reg = fs.readFileSync(new URL("../../docs/CLINICIAN-REVIEW.md", import.meta.url), "utf8");
  for (const [id, t] of Object.entries(MODULE_ADDS)) assert.ok(reg.includes(t), `${id} 'what it adds' is missing from docs/CLINICIAN-REVIEW.md`);
});
