// Passive tracking S3: the confirm-night rule and words (lib/confirmNight.js, pure; lib/notifications.js re-exports them and
// talks to the phone plugin, which only runs on a phone). Run: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { confirmDueAt, CONFIRM_ID, CONFIRM_ACTION_TYPE, CONFIRM_ACTIONS, CONFIRM_TEXT, CONFIRM_AT } from "./confirmNight.js";
import { readFileSync } from "node:fs";

const at = (h, m = 0, day = 8) => new Date(2026, 10, day, h, m).getTime(); // local time, 2026-11-<day>

test("confirm-night: its own id and action type; two actions; the text carries no health content", () => {
  assert.equal(CONFIRM_ID, 1100);
  assert.ok(![1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007].includes(CONFIRM_ID), "never a reminder id");
  assert.equal(CONFIRM_ACTION_TYPE, "confirm-night");
  assert.deepEqual(CONFIRM_ACTIONS.map((a) => [a.id, a.title]), [["ok", "Looks right"], ["open", "Open"]]);
  assert.equal(CONFIRM_TEXT, "Last night synced. Looks right?");
  assert.deepEqual([...CONFIRM_AT], [7, 0]);
  const src = readFileSync(new URL("./notifications.js", import.meta.url), "utf8");
  assert.ok(src.includes('export const REMINDER_BODY = "Time for your 30-second check-in."') && src.includes('from "./confirmNight.js"'), "notifications.js keeps the plain body and reads the rule from confirmNight.js");
  assert.ok(Object.isFrozen(CONFIRM_ACTIONS) && Object.isFrozen(CONFIRM_AT));
});

test("confirmDueAt: 07:00 local today only when a sync landed overnight before 07:00, it is not yet 07:00, and the night is not confirmed", () => {
  const seven = at(7);
  assert.equal(confirmDueAt({ nowMs: at(5, 30), lastSyncMs: at(5, 10) }), seven, "resumed at 05:10, now 05:30 → 07:00 today");
  assert.equal(confirmDueAt({ nowMs: at(6, 59), lastSyncMs: at(23, 50, 7) }), seven, "a sync late last evening counts as overnight");
  assert.equal(confirmDueAt({ nowMs: at(7, 0), lastSyncMs: at(5) }), null, "07:00 has arrived: the card is the place now");
  assert.equal(confirmDueAt({ nowMs: at(9), lastSyncMs: at(8) }), null, "a sync after 07:00 is not overnight");
  assert.equal(confirmDueAt({ nowMs: at(6), lastSyncMs: at(9, 0, 7) }), null, "yesterday morning's sync is stale");
  assert.equal(confirmDueAt({ nowMs: at(6), lastSyncMs: at(5), confirmed: true }), null, "already confirmed → nothing");
  assert.equal(confirmDueAt({ nowMs: at(6), lastSyncMs: null }), null);
  assert.equal(confirmDueAt({}), null);
  assert.ok(confirmDueAt({ nowMs: at(6), lastSyncMs: at(5) }) > at(6), "never before 07:00");
});
