/* The morning confirm-night notification's rule and words (passive tracking S3, plan §2.6). Pure and import-free, so
   Node tests load it; lib/notifications.js (the phone plugin) and App.jsx read it. The notification says nothing about
   the readings: "Last night synced. Looks right?" with two actions, Looks right and Open. */
export const CONFIRM_ID = 1100;                  // its own id, never a reminder id (1000 + weekday)
export const CONFIRM_ACTION_TYPE = "confirm-night";
export const CONFIRM_ACTIONS = Object.freeze([Object.freeze({ id: "ok", title: "Looks right" }), Object.freeze({ id: "open", title: "Open" })]);
export const CONFIRM_TITLE = "Solia Health";
export const CONFIRM_TEXT = "Last night synced. Looks right?";
/** Local 07:00 (hour, minute): the one time it may fire, never earlier. */
export const CONFIRM_AT = Object.freeze([7, 0]);
/** When the confirm notification should fire, as ms, or null: only when a sync landed overnight before 07:00 local today
    (lastSyncMs, from last evening on), it is not yet 07:00, and today's night is not confirmed. The caller passes nowMs. */
export function confirmDueAt({ nowMs, lastSyncMs, confirmed = false } = {}) {
  if (confirmed || !Number.isFinite(nowMs) || !Number.isFinite(lastSyncMs)) return null;
  const d = new Date(nowMs);
  const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), CONFIRM_AT[0], CONFIRM_AT[1], 0, 0).getTime();
  if (nowMs >= at) return null;          // 07:00 has passed: the Home card is the place now
  if (lastSyncMs >= at) return null;     // a sync after 07:00 is not "overnight"
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime() - 12 * 3600000;
  if (lastSyncMs < dayStart) return null; // older than last evening: nothing new synced overnight
  return at;
}
