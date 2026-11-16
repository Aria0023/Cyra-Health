/* The guest window (owner request 2026-11-16, docs/plans/guest-window.md): "anonymous for a limited time, then
   require registering". Where sign-in is required (lib/signin.js mode "required"), "Create your account" also offers
   "Try it first": she uses the whole app, with saving, as a guest for GUEST_HOURS (48). After that the sign-in gate
   appears the next time the app opens; it still lets her back up or delete her data without signing in. The free week
   (lib/trial.js) is unchanged: 7 days from the day she finished registering, guest days included.

   - guestStart: an ISO timestamp set when she first taps "Try it first". Kept in her record AND in encrypted backups,
     so restoring a backup doesn't restart the window (a restore keeps the earlier of the backup's and this device's).
     It is null for anyone who has signed in on this device: signing in ends the guest window for good.
   - guestSeen: the latest time this device has seen while she was a guest (device-only, never in a backup). The window
     is measured against max(now, guestSeen), so moving the clock back never extends it.
   - VITE_GUEST_HOURS (build time): 0 = no guest window (sign-in first, as before); default 48; at most 168, so the
     window never outlasts the free week it is part of.
   - Only mode "required" has a guest window. In every other mode (none, unset, optional, checking, offline) nothing
     here applies and the app behaves as before; in particular, when the server can't be reached after the window the
     app opens rather than locking her out, and asks again when it can.
   - The window is kept on the device: Delete everything removes it with the rest of the record.
   Pure: no React, no storage, no network. */

export const GUEST_HOURS_DEFAULT = 48;
export const GUEST_HOURS_MAX = 168;
const HOUR = 3600000;

/** The build's window in whole hours: unset or unreadable = 48; "0" = none; capped at 168. */
export function parseGuestHours(raw) {
  const s = String(raw ?? "").trim();
  if (!/^\d{1,4}$/.test(s)) return GUEST_HOURS_DEFAULT;
  return Math.min(GUEST_HOURS_MAX, Number(s));
}
export const GUEST_HOURS = parseGuestHours(import.meta.env?.VITE_GUEST_HOURS);

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
/** A stored timestamp (guestStart, guestSeen): a real ISO time, else null. */
export const cleanGuestTime = (v) => (typeof v === "string" && ISO_TIME.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
const ms = (v) => (typeof v === "number" ? (Number.isFinite(v) ? v : null) : cleanGuestTime(v) ? Date.parse(v) : null);

/** The time the window is measured against: the later of the clock and the latest time this device has seen. */
export function guestNow(now, seen = null) {
  const n = ms(now), s = ms(seen);
  return Math.max(n ?? 0, s ?? 0);
}
/** The device's "latest time seen" stamp after looking at the clock: it only ever moves forward. */
export function nextGuestSeen(seen, now) {
  const t = guestNow(now, seen);
  return t > 0 ? new Date(t).toISOString() : null;
}

/** When the window ends (ms), or null without a start. */
export function guestEndsAt(start, hours = GUEST_HOURS) {
  const s = ms(start);
  return s == null ? null : s + Math.max(0, hours) * HOUR;
}
/** Milliseconds of the window left (0 once it's over; an unreadable start gives 0: it fails closed). A start in the
    future (the clock was moved back after she started) counts as starting now, never later. */
export function guestLeftMs({ start, now, seen = null, hours = GUEST_HOURS } = {}) {
  const s = ms(start);
  if (s == null) return 0;
  const t = guestNow(now, seen);
  const used = Math.max(0, t - s);
  return Math.max(0, Math.max(0, hours) * HOUR - used);
}

/** Whether "Create your account" offers "Try it first". */
export const canTryFirst = (mode, hours = GUEST_HOURS) => mode === "required" && hours > 0;

/** Where she stands: "in" (a guest inside the window), "over" (the window has ended: sign in to keep going) or null
    (not a guest: signed in, never tapped "Try it first", or sign-in isn't required here right now). */
export function guestState({ mode, signedIn = false, start = null, now, seen = null, hours = GUEST_HOURS } = {}) {
  if (mode !== "required" || signedIn || !cleanGuestTime(start)) return null;
  return guestLeftMs({ start, now, seen, hours }) > 0 ? "in" : "over";
}

/** The start a restore leaves on this device: none once she has signed in here; otherwise the earlier of the backup's
    and this device's, so a restore can neither restart nor extend the window. */
export function restoredGuestStart(fromBackup, onDevice, signedIn = false) {
  if (signedIn) return null;
  const a = cleanGuestTime(fromBackup), b = cleanGuestTime(onDevice);
  if (a && b) return Date.parse(a) <= Date.parse(b) ? a : b;
  return a || b;
}

/** Home's guest line shows on the first Home visit of a local day (guestNote is the last day it showed). */
export const guestNoteNew = ({ shownDay = null, todayIso } = {}) => !!todayIso && shownDay !== todayIso;
export const cleanGuestNote = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** "2 days", "1 day", "36 hours": the window in plain words. */
export function guestSpan(hours = GUEST_HOURS) {
  if (hours > 0 && hours % 24 === 0) { const d = hours / 24; return d === 1 ? "1 day" : `${d} days`; }
  return hours === 1 ? "1 hour" : `${hours} hours`;
}
/** "Wednesday, 10:00 AM": the moment the window ends, in the device's own language and clock. */
export function guestDeadline(endMs, locale = undefined) {
  const d = new Date(endMs);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString(locale, { weekday: "long" })}, ${d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`;
}

/** The whole story, once. The free week and Pro are named only where the free-week gate is on (lib/trial.js: where she
    can actually pay); elsewhere nothing ends after 7 days, so the sentence stops at the account. */
export const guestStory = ({ hours = GUEST_HOURS, trialGate = false } = {}) => (trialGate
  ? `${guestSpan(hours)} as a guest, 7 days free in all, then Pro if you want to keep logging.`
  : `${guestSpan(hours)} as a guest, then a free account to keep going.`);

export const GUEST_COPY = Object.freeze({
  tryFirst: "Try it first",
  tryWhy: (hours = GUEST_HOURS) => `Or try Solia Health as a guest for ${guestSpan(hours)} before you make an account. What you log is saved on this device, and Solia Health's server holds no account for you.`,
  started: (when) => `You're in as a guest until ${when}.`,
  line: (when) => `You're trying Solia Health as a guest. Create an account by ${when} to keep going.`,
  create: "Create account",
  hide: "Hide for today",
  hidden: "Hidden for today. You can create your account any time in You.",
  youLine: (when) => `You're trying Solia Health as a guest until ${when}. Solia Health's server holds no account for you, and your log lives on this device.`,
  sheetTitle: "Create your account",
  sheetSub: "Sign in so Solia Health knows it's you. Everything you logged as a guest stays on this device, and your account never holds it.",
  gateTitle: (hours = GUEST_HOURS) => (hours > 0 && hours % 24 === 0
    ? (hours === 24 ? "Your guest day is up" : `Your ${hours / 24} guest days are up`)
    : "Your time as a guest is up"),
  gateSub: "Sign in to keep going. Everything you logged is still on this device.",
  gateData: "Back up or delete your data without signing in",
  gateDataWhy: "Your log is yours with or without an account. You can save an encrypted backup of it, or delete everything, right here.",
  ai: "Create an account to use this. Nothing was sent.",
});
