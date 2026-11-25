import test from "node:test";
import assert from "node:assert/strict";
import { planBadge, badgeLines } from "./planBadge.js";

const day = (n) => `2026-11-${String(n).padStart(2, "0")}`;
test("Pro wins over everything", () => {
  assert.equal(planBadge({ owned: true, guest: "in", gateOn: true, startIso: day(1), todayIso: day(19) }).key, "pro");
});
test("a guest is a guest, before the free week is named", () => {
  assert.equal(planBadge({ guest: "in", gateOn: true, startIso: day(19), todayIso: day(19) }).label, "Guest");
});
test("the free week counts down, names its last day, then says it is over", () => {
  assert.equal(planBadge({ gateOn: true, startIso: day(10), todayIso: day(10) }).label, "Free week \u00b7 7 days left");
  assert.equal(planBadge({ gateOn: true, startIso: day(10), todayIso: day(16) }).label, "Free week \u00b7 last day");
  const over = planBadge({ gateOn: true, startIso: day(10), todayIso: day(17) });
  assert.equal(over.key, "ended");
  assert.equal(over.label, "Free week over");
});
test("where nobody can subscribe there is no countdown: the plan is Free", () => {
  assert.deepEqual(planBadge({ gateOn: false, startIso: day(1), todayIso: day(19) }).key, "free");
});
test("every badge has a label and a sentence", () => {
  for (const a of [{ owned: true }, { guest: "in" }, {}, { gateOn: true, startIso: day(1), todayIso: day(2) }, { gateOn: true }]) {
    const b = planBadge(a);
    assert.ok(b.say.startsWith(b.label) && b.say.endsWith(". Open plans."), b.key);
  }
});
test("the guest badge says what the one word leaves out", () => {
  assert.equal(planBadge({ guest: "in" }).say, "Guest, no account yet. Open plans.");
});
test("the badge's words fit two short lines", () => {
  assert.deepEqual(badgeLines("Free week \u00b7 3 days left"), ["Free week \u00b7", "3 days left"]);
  assert.deepEqual(badgeLines("Free week over"), ["Free week", "over"]);
  assert.deepEqual(badgeLines("Guest"), ["Guest"]);
  assert.deepEqual(badgeLines("Pro"), ["Pro"]);
});
