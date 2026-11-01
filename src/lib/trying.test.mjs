/* Unit tests for lib/trying.js (Solia C): kinds, daily questions, Care-shelf kinds, row chips. */
import test from "node:test";
import assert from "node:assert/strict";
import { TRY_KINDS, HAND_KINDS, kindLabel, dailyQuestion, doneWord, shelfKind, SHELF_KINDS, tryChip, tryWaitLine, TRY_MIN } from "./trying.js";
import { SHELF } from "./constants.js";
import { TRIAL_MIN } from "./patterns.js";

test("trying: the daily question fits the kind", () => {
  assert.equal(dailyQuestion("rx"), "Taken today?");
  assert.equal(dailyQuestion("supp"), "Taken today?");
  assert.equal(dailyQuestion("habit"), "Did it today?");
  assert.equal(dailyQuestion("program"), "Did it today?");
  assert.equal(dailyQuestion("aid"), "Used it today?");
  assert.equal(dailyQuestion("care"), null, "a clinician service gets no daily question");
  assert.equal(doneWord("care"), null);
  assert.equal(doneWord("program"), "✓ Done");
  assert.equal(dailyQuestion("bogus"), "Did it today?", "unknown kinds read as a habit");
  assert.deepEqual(HAND_KINDS.map(([k]) => k), ["rx", "supp", "habit"]);
});

test("trying: Care-shelf items get a fitting kind (the bug: a CBT-I program listed as a Supplement, a clinician as a Habit)", () => {
  const byId = Object.fromEntries(SHELF.map((s) => [s.id, s]));
  assert.equal(shelfKind(byId.restfully), "program");
  assert.equal(kindLabel(shelfKind(byId.restfully)), "Program");
  assert.equal(shelfKind(byId.midi), "care");
  assert.equal(kindLabel(shelfKind(byId.midi)), "Care");
  assert.equal(shelfKind(byId.mineral), "supp");
  assert.equal(shelfKind(byId.verdana), "supp");
  assert.equal(shelfKind(byId.emberline), "aid");
  assert.equal(shelfKind(byId.nightfall), "aid");
  for (const s of SHELF) assert.ok(SHELF_KINDS[s.id], `${s.id} has a kind`);
  assert.equal(shelfKind({ id: "new", tone: "clinical" }), "care");
  assert.equal(shelfKind({ id: "x", kind: "program" }), "program");
  for (const k of Object.keys(TRY_KINDS)) assert.equal(typeof kindLabel(k), "string");
});

test("trying: one short chip per row; the needs-5-days detail is a separate line", () => {
  assert.equal(TRY_MIN, TRIAL_MIN);
  assert.equal(tryChip(null), null);
  assert.deepEqual(tryChip({ ready: false }), { text: "Not enough days to compare", result: false });
  assert.deepEqual(tryChip({ ready: true, before: 50, after: 51 }), { text: "About the same as before", result: true });
  assert.equal(tryChip({ ready: true, before: 40, after: 60 }).text, "Lighter days since starting");
  assert.equal(tryChip({ ready: true, before: 60, after: 40 }).text, "Heavier days since starting");
  assert.equal(tryWaitLine({ name: "Magnesium", ready: false, haveBefore: 0, haveAfter: 2, needBefore: 5, needAfter: 3, stuckBefore: true }),
    "Magnesium: needs 5 logged days in the 2 weeks before you started — you have 0, so it can't be compared.");
  assert.equal(tryWaitLine({ name: "Walk", ready: false, haveBefore: 5, haveAfter: 4, needBefore: 0, needAfter: 1 }), "Walk: 1 more logged day to compare (5 before, 4 since).");
  assert.equal(tryWaitLine({ name: "Walk", ready: true }), null);
});
