/* Unit tests for lib/engine.js helpers used by Home. Run with `npm run test:unit`. */
import test from "node:test";
import assert from "node:assert/strict";
import { trimesterOf, foldQuick } from "./engine.js";
import { QUICK_Q, QUICK_MAP, SYM, PSYM } from "./constants.js";

test("trimesterOf: week 9 is the first trimester, 22 the second, 34 the third", () => {
  assert.equal(trimesterOf(9), "first");
  assert.equal(trimesterOf(12), "first");
  assert.equal(trimesterOf(13), "second");
  assert.equal(trimesterOf(22), "second");
  assert.equal(trimesterOf(27), "second");
  assert.equal(trimesterOf(28), "third");
  assert.equal(trimesterOf(34), "third");
});

test("QUICK_Q (UI T1): three {q, a} questions per stage, four answers each, values 0-3 fold onto hero symptoms", () => {
  for (const stage of ["periods", "peri", "preg"]) {
    assert.equal(QUICK_Q[stage].length, 3);
    for (const { q, a } of QUICK_Q[stage]) { assert.ok(q.endsWith("?")); assert.equal(a.length, 4); assert.equal(new Set(a).size, 4); }
  }
  assert.deepEqual(QUICK_Q.peri[1].a, ["Slept well", "So-so", "Rough night", "Barely slept"]);
  assert.deepEqual(QUICK_Q.peri[2].a, ["Sharp", "A bit foggy", "Foggy", "Can't think"]);
  assert.deepEqual(QUICK_Q.periods[2].a, ["Steady", "A bit off", "Low", "Really low"]);
  assert.equal(QUICK_Q.peri[0].a[2], "Yes"); // the native suite clicks "Yes" on the first peri question
  // the fold is unchanged: "Rough night" (index 2) on q2 lands on slp as 2, listed under __q
  assert.deepEqual(foldQuick({ q1: 3, q2: 2 }, "peri"), { hf: 3, slp: 2, __q: { hf: 3, slp: 2 } });
  for (const [stage, syms] of [["peri", SYM], ["periods", PSYM]]) for (const sid of Object.values(QUICK_MAP[stage])) assert.ok(sid in syms, `${stage} ${sid}`);
});
