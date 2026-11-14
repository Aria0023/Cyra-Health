/* Unit tests for lib/trying.js (Solia C): kinds, daily questions, Care-shelf kinds, row chips. */
import test from "node:test";
import assert from "node:assert/strict";
import { TRY_KINDS, HAND_KINDS, kindLabel, dailyQuestion, doneWord, shelfKind, SHELF_KINDS, tryChip, tryWaitLine, TRY_MIN } from "./trying.js";
import { SHOP_ITEMS } from "./shop.js";
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

test("trying: shop items she can add get a fitting kind (a CBT-I program is a Program, a clinician Care, a wrap a Comfort aid)", () => {
  const byId = Object.fromEntries(SHOP_ITEMS.map((s) => [s.id, s]));
  assert.equal(shelfKind(byId.sleepio), "program");
  assert.equal(kindLabel(shelfKind(byId.sleepio)), "Program");
  assert.equal(shelfKind(byId.midi), "care");
  assert.equal(kindLabel(shelfKind(byId.midi)), "Care");
  assert.equal(shelfKind(byId.prenatal), "supp");
  assert.equal(shelfKind(byId["heat-wrap"]), "aid");
  assert.equal(shelfKind(byId["cooling-bedding"]), "aid");
  for (const s of SHOP_ITEMS.filter((i) => i.kind)) assert.ok(TRY_KINDS[s.kind], `${s.id} has a known kind`);
  assert.equal(shelfKind({ id: "new", tone: "clinical" }), "care");
  assert.equal(shelfKind({ id: "x", kind: "program" }), "program");
  assert.equal(SHELF_KINDS.restfully, "program", "an item added from the old shelf keeps its kind");
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
