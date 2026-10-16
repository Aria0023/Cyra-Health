/* Unit tests for lib/engine.js helpers used by Home. Run with `npm run test:unit`. */
import test from "node:test";
import assert from "node:assert/strict";
import { trimesterOf } from "./engine.js";

test("trimesterOf: week 9 is the first trimester, 22 the second, 34 the third", () => {
  assert.equal(trimesterOf(9), "first");
  assert.equal(trimesterOf(12), "first");
  assert.equal(trimesterOf(13), "second");
  assert.equal(trimesterOf(22), "second");
  assert.equal(trimesterOf(27), "second");
  assert.equal(trimesterOf(28), "third");
  assert.equal(trimesterOf(34), "third");
});
