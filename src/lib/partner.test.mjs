import test from "node:test";
import assert from "node:assert/strict";
import { cleanPartnerShare, partnerItems, shareMessage, partnerReminderAt, cleanNote, PARTNER_NOTIFY, PARTNER_COPY, NOTE_MAX } from "./partner.js";

const pred = { fromIso: "2026-11-20", toIso: "2026-11-24", fertileFromIso: "2026-11-02", fertileToIso: "2026-11-08", cycleDay: 12, phase: "follicular" };

test("partnerShare: known ids in order, remind only when true; defaults to next period and today", () => {
  assert.deepEqual(cleanPartnerShare(null), { pick: ["next", "today"], remind: false });
  assert.deepEqual(cleanPartnerShare({ pick: ["today", "x", "fertile"], remind: "yes" }), { pick: ["fertile", "today"], remind: false });
  assert.deepEqual(cleanPartnerShare({ pick: [], remind: true }), { pick: [], remind: true });
});

test("the fertile window is offered for Trying to conceive only", () => {
  assert.deepEqual(partnerItems({ ttc: false }).map((i) => i.id), ["next", "today"]);
  assert.deepEqual(partnerItems({ ttc: true }).map((i) => i.id), ["next", "fertile", "today"]);
});

test("the message holds only what she ticked, worded as estimates, with no ids", () => {
  const m = shareMessage({ pick: ["next"], pred, ttc: false });
  assert.equal(m.lines.length, 1);
  assert.match(m.text, /likely to start between Nov 20 and Nov 24/);
  assert.match(m.text, /estimate/);
  assert.doesNotMatch(m.text, /fertile|day 12/);
  const all = shareMessage({ pick: ["next", "fertile", "today"], pred, ttc: true, note: "  Quiet   Saturday? " });
  assert.equal(all.lines.length, 4);
  assert.match(all.text, /estimated fertile window is Nov 2 to Nov 8\. An estimate, not a guarantee\./);
  assert.match(all.text, /Today is day 12 of my cycle \(follicular phase\)\./);
  assert.match(all.text, /\nQuiet Saturday\?\n/);
  assert.doesNotMatch(all.text, /[0-9a-f]{8}-|id:|sourceId|stage/i);
});

test("outside Trying to conceive the fertile window is never named, even when ticked or when today is in it", () => {
  const m = shareMessage({ pick: ["fertile", "today"], pred: { ...pred, phase: "fertile" }, ttc: false });
  assert.doesNotMatch(m.text, /fertile/i);
  assert.match(m.text, /Today is day 12 of my cycle\./);
});

test("no prediction: no cycle lines; nothing ticked and no note is empty", () => {
  assert.equal(shareMessage({ pick: ["next", "today"], pred: null }).empty, true);
  assert.deepEqual(shareMessage({ pick: ["next"], pred: null, note: "Hi" }).lines, ["Hi"]);
  assert.equal(cleanNote("x".repeat(500)).length, NOTE_MAX);
});

test("the reminder: 18:00 two days before the likely start, only while still ahead", () => {
  const at = partnerReminderAt(pred, new Date(2026, 10, 1).getTime());
  const d = new Date(at);
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()], [2026, 10, 18, 18]);
  assert.equal(partnerReminderAt(pred, new Date(2026, 10, 19).getTime()), null);
  assert.equal(partnerReminderAt(null), null);
});

test("the notification and the copy say nothing about her body", () => {
  assert.doesNotMatch(`${PARTNER_NOTIFY.title} ${PARTNER_NOTIFY.body}`, /period|cycle|fertile|ovulat|pregnan/i);
  assert.match(PARTNER_COPY.privacy, /Nothing is stored on a server/);
  assert.match(PARTNER_COPY.privacy, /never your symptoms, notes or moods/);
});
