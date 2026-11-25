import test from "node:test";
import assert from "node:assert/strict";
import { GUEST_HOURS, GUEST_HOURS_DEFAULT, GUEST_HOURS_MAX, parseGuestHours, cleanGuestTime, guestNow, nextGuestSeen, guestEndsAt, guestLeftMs, canTryFirst, guestState, restoredGuestStart, guestNoteNew, cleanGuestNote, guestSpan, guestDeadline, guestStory, GUEST_COPY } from "./guest.js";
import { gateNeeded } from "./signin.js";
import { PERSISTED, RECORD, DEVICE_ONLY, NOT_IN_BACKUP, RULES, backupCopy } from "./record.js";

const H = 3600000;
const START = "2026-11-16T10:00:00.000Z";
const at = (h) => Date.parse(START) + h * H;

test("guest: the build's window is 48 hours unless VITE_GUEST_HOURS says otherwise; 0 means none; capped at the free week", () => {
  assert.equal(GUEST_HOURS_DEFAULT, 48);
  assert.equal(GUEST_HOURS, 48, "no VITE_GUEST_HOURS under node");
  for (const raw of [undefined, null, "", " ", "abc", "-1", "4.5", "48h", "99999"]) assert.equal(parseGuestHours(raw), 48, `unreadable ${raw}`);
  assert.equal(parseGuestHours("0"), 0);
  assert.equal(parseGuestHours("24"), 24);
  assert.equal(parseGuestHours(" 72 "), 72);
  assert.equal(parseGuestHours("500"), GUEST_HOURS_MAX);
  assert.equal(GUEST_HOURS_MAX, 7 * 24);
});

test("guest: the window maths", () => {
  assert.equal(guestEndsAt(START, 48), at(48));
  assert.equal(guestEndsAt(null, 48), null);
  assert.equal(guestLeftMs({ start: START, now: at(0), hours: 48 }), 48 * H);
  assert.equal(guestLeftMs({ start: START, now: at(47), hours: 48 }), H);
  assert.equal(guestLeftMs({ start: START, now: at(48), hours: 48 }), 0);
  assert.equal(guestLeftMs({ start: START, now: at(49), hours: 48 }), 0);
  assert.equal(guestLeftMs({ start: "yesterday", now: at(1), hours: 48 }), 0, "an unreadable start fails closed");
  assert.equal(guestLeftMs({ start: null, now: at(1), hours: 48 }), 0);
  assert.equal(guestLeftMs({ start: START, now: at(1), hours: 0 }), 0, "a build with no window");
  assert.equal(guestLeftMs({ start: START, now: new Date(at(1)).toISOString(), hours: 48 }), 47 * H, "now may be an ISO time");
});

test("guest: a clock moved back never extends the window", () => {
  // she used it for 47 hours, then set the clock back a day
  const seen = new Date(at(47)).toISOString();
  assert.equal(guestNow(at(23), seen), at(47));
  assert.equal(guestLeftMs({ start: START, now: at(23), seen, hours: 48 }), H);
  // past the end, then the clock goes back to the first hour: still over
  assert.equal(guestState({ mode: "required", start: START, now: at(1), seen: new Date(at(49)).toISOString(), hours: 48 }), "over");
  // a clock moved back to before she started counts as "now", never as time not yet used
  assert.equal(guestLeftMs({ start: START, now: at(-100), hours: 48 }), 48 * H);
  // the stamp only moves forward
  assert.equal(nextGuestSeen(null, at(5)), new Date(at(5)).toISOString());
  assert.equal(nextGuestSeen(seen, at(5)), seen);
  assert.equal(nextGuestSeen(seen, at(60)), new Date(at(60)).toISOString());
  assert.equal(nextGuestSeen("junk", at(5)), new Date(at(5)).toISOString());
});

test("guest: only mode required has a guest window; every other mode behaves as before", () => {
  for (const mode of ["none", "unset", "optional", "checking", "offline"]) {
    assert.equal(canTryFirst(mode, 48), false, mode);
    assert.equal(guestState({ mode, start: START, now: at(1), hours: 48 }), null, `${mode} inside`);
    assert.equal(guestState({ mode, start: START, now: at(100), hours: 48 }), null, `${mode} after`);
    assert.equal(gateNeeded({ mode, signedIn: false, guest: guestState({ mode, start: START, now: at(100), hours: 48 }) }), false, `${mode}: the app opens, also after the window`);
  }
  assert.equal(canTryFirst("required", 48), true);
  assert.equal(canTryFirst("required", 0), false, "VITE_GUEST_HOURS=0: sign-in first, as before");
  assert.equal(guestState({ mode: "required", start: START, now: at(1), hours: 48 }), "in");
  assert.equal(guestState({ mode: "required", start: START, now: at(49), hours: 48 }), "over");
  assert.equal(guestState({ mode: "required", start: START, now: at(1), hours: 48, signedIn: true }), null, "signed in: not a guest");
  assert.equal(guestState({ mode: "required", start: null, now: at(1), hours: 48 }), null, "never tapped Try it first");
  assert.equal(guestState({ mode: "required", start: START, now: at(1), hours: 0 }), "over", "a start carried into a build with no window");
});

test("guest: the gate. A guest inside the window isn't asked; after it she is; an existing record with no start is asked as before", () => {
  assert.equal(gateNeeded({ mode: "required", signedIn: false, guest: "in" }), false);
  assert.equal(gateNeeded({ mode: "required", signedIn: false, guest: "over" }), true);
  assert.equal(gateNeeded({ mode: "required", signedIn: false, guest: null }), true, "a record from before the guest window, no account");
  assert.equal(gateNeeded({ mode: "required", signedIn: false }), true);
  assert.equal(gateNeeded({ mode: "required", signedIn: true, guest: null }), false);
  assert.equal(gateNeeded({ mode: "offline", signedIn: false, guest: null }), false, "the server can't be reached: nobody is locked out");
});

test("guest: a restore keeps the start (never restarts or extends the window); guestStart travels in backups, the clock stamp doesn't", () => {
  const later = "2026-11-17T09:00:00.000Z";
  assert.equal(restoredGuestStart(START, null), START, "a new device takes the backup's start");
  assert.equal(restoredGuestStart(START, later), START, "the earlier one wins");
  assert.equal(restoredGuestStart(later, START), START);
  assert.equal(restoredGuestStart(null, START), START, "a backup without one doesn't clear this device's");
  assert.equal(restoredGuestStart(null, null), null);
  assert.equal(restoredGuestStart("junk", null), null);
  assert.equal(restoredGuestStart(START, later, true), null, "signed in on this device: the guest window is over for good");
  assert.ok(PERSISTED.includes("guestStart") && RECORD.includes("guestStart") && !DEVICE_ONLY.includes("guestStart") && !NOT_IN_BACKUP.includes("guestStart"));
  for (const k of ["guestSeen", "guestNote"]) assert.ok(PERSISTED.includes(k) && DEVICE_ONLY.includes(k) && NOT_IN_BACKUP.includes(k) && !RECORD.includes(k), k);
  const copy = backupCopy({ v: 1, phase: "app", guestStart: START, guestSeen: later, guestNote: "2026-11-16", reminders: { enabled: false } });
  assert.equal(copy.guestStart, START);
  assert.equal("guestSeen" in copy, false);
  assert.equal("guestNote" in copy, false);
  for (const ok of [undefined, null, START]) { assert.deepEqual(RULES.guestStart(ok, "guestStart"), []); assert.deepEqual(RULES.guestSeen(ok, "guestSeen"), []); }
  for (const bad of ["2026-11-16", 5, {}, "2026-11-16T10:00:00+01:00"]) assert.equal(RULES.guestStart(bad, "guestStart").length, 1, String(bad));
  for (const ok of [undefined, null, "2026-11-16"]) assert.deepEqual(RULES.guestNote(ok, "guestNote"), []);
  assert.equal(RULES.guestNote("today", "guestNote").length, 1);
});

test("guest: stored values are cleaned", () => {
  assert.equal(cleanGuestTime(START), START);
  assert.equal(cleanGuestTime(new Date(at(3)).toISOString()), new Date(at(3)).toISOString());
  for (const bad of [null, undefined, "", "2026-11-16", "2026-13-40T99:00:00.000Z", 12, {}, "2026-11-16T10:00:00"]) assert.equal(cleanGuestTime(bad), null, String(bad));
  assert.equal(cleanGuestNote("2026-11-16"), "2026-11-16");
  assert.equal(cleanGuestNote("16/11"), null);
  assert.equal(guestNoteNew({ shownDay: null, todayIso: "2026-11-16" }), true);
  assert.equal(guestNoteNew({ shownDay: "2026-11-16", todayIso: "2026-11-16" }), false, "at most once a day");
  assert.equal(guestNoteNew({ shownDay: "2026-11-16", todayIso: "2026-11-17" }), true);
});

test("guest: the copy tells the whole story once, and names Pro only where the free-week gate is on", () => {
  assert.equal(guestSpan(48), "2 days");
  assert.equal(guestSpan(24), "1 day");
  assert.equal(guestSpan(36), "36 hours");
  assert.equal(guestSpan(1), "1 hour");
  assert.equal(guestStory({ hours: 48, trialGate: true }), "7 days free, then Pro if you want to keep logging. Create your account to keep your free week going.");
  assert.equal(guestStory({ hours: 48, trialGate: false }), "Create your free account to keep going.");
  assert.ok(!/Pro|7 days/.test(guestStory({ hours: 48, trialGate: false })), "no free week or Pro where nothing ends after 7 days");
  assert.equal(GUEST_COPY.tryFirst, "Try it first");
  assert.equal(GUEST_COPY.gateTitle(48), "Create your account to keep going");
  assert.equal(GUEST_COPY.gateTitle(24), "Create your account to keep going");
  assert.equal(GUEST_COPY.gateTitle(36), "Create your account to keep going");
  assert.equal(GUEST_COPY.gateSub, "Sign in to keep going. Everything you logged is still on this device.");
  const when = guestDeadline(Date.UTC(2026, 10, 18, 10, 0), "en-US");
  assert.match(when, /^(Tuesday|Wednesday|Thursday), \d{1,2}:\d{2}\s?(AM|PM)$/);
  assert.equal(GUEST_COPY.line("Wednesday, 10:00 AM"), "You're trying Solia Health as a guest. Create your account by Wednesday, 10:00 AM to keep going.");
  assert.equal(guestDeadline(NaN), "");
  assert.match(GUEST_COPY.ai, /^Create an account to use this\./);
  for (const v of Object.values(GUEST_COPY)) { const text = typeof v === "function" ? v(48) : v; assert.ok(!/—/.test(text), "no em dash"); }
});

test("guest (2026-11-25): one free clock; no line counts hours, the deadline only near the end", () => {
  const all = [guestStory({ trialGate: true }), guestStory({ trialGate: false }), GUEST_COPY.tryWhy(48), GUEST_COPY.gateTitle(48), GUEST_COPY.youLine(), GUEST_COPY.line("Wednesday, 10:00 AM", true)];
  for (const s of all) assert.doesNotMatch(s, /\bhours?\b|\b2 days\b|48/, s);
  assert.equal(GUEST_COPY.line("Wednesday, 10:00 AM", true), "You're trying Solia Health as a guest. Create your account by Wednesday, 10:00 AM to keep your free week going.");
  assert.equal(GUEST_COPY.youLine(), "You're trying Solia Health as a guest. Solia Health's server holds no account for you, and your log lives on this device.");
  assert.match(GUEST_COPY.youLine("Wednesday, 10:00 AM"), /^You're trying Solia Health as a guest until Wednesday, 10:00 AM\./);
});
