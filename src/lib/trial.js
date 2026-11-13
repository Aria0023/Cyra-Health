/* The free week (owner decision 2026-11-12: "try it free, pay to keep saving"). Pure: no imports, no storage, no network.

   - Everyone gets 7 free days of the whole app, with saving, counted on this device from the day she finished
     registering (trialStart, a local YYYY-MM-DD kept in her record and in encrypted backups, so restoring a backup
     doesn't restart it). No card, no account.
   - After the 7 days, without Pro, nothing new can be logged or changed in her health log. Everything already logged
     stays: she can still open, read, export (PDF, spreadsheet, encrypted backup), and delete it, and safety guidance
     and practices stay open. Ending the free week or Pro never locks, changes or deletes what she logged.
   - The gate is on only where she can actually pay (gateOn): a phone build whose app store is connected, or a build
     with the dev flag trialGate (QA and the web, once Pro can be bought there). Nobody is ever locked out of logging
     with no way to subscribe. */

export const TRIAL_DAYS = 7;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const noon = (iso) => {
  if (!ISO.test(iso || "")) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const [y, m, day] = iso.split("-").map(Number);
  return d.getFullYear() === y && d.getMonth() + 1 === m && d.getDate() === day ? d : null;
};

/** A stored trial start: a real local date, else null. */
export const cleanTrialStart = (v) => (typeof v === "string" && noon(v) ? v : null);

/** Free days left, counting today: TRIAL_DAYS on the first day, 1 on the last, 0 once it's over. A start date in the
    future (a clock moved back) counts as starting today; an unreadable start or today gives 0 (fails closed). */
export function trialDaysLeft(startIso, todayIso) {
  const s = noon(startIso), t = noon(todayIso);
  if (!s || !t) return 0;
  const used = Math.max(0, Math.round((t - s) / 86400000));
  return Math.max(0, TRIAL_DAYS - used);
}

/** Whether she can add to or change her health log now. */
export function canLog({ gateOn = false, owned = false, startIso = null, todayIso = null } = {}) {
  if (!gateOn || owned === true) return true;
  return trialDaysLeft(startIso, todayIso) > 0;
}

/** The plan line in You and on Home while the gate is on: null when there's nothing to say (no gate, or Pro). */
export function trialLine({ gateOn = false, owned = false, startIso = null, todayIso = null } = {}) {
  if (!gateOn || owned === true) return null;
  const n = trialDaysLeft(startIso, todayIso);
  if (n <= 0) return TRIAL_COPY.over;
  return n === 1 ? "Free week: last day. Subscribe to keep saving." : `Free week: ${n} days left. Subscribe any time to keep saving after that.`;
}

export const TRIAL_COPY = Object.freeze({
  over: "Your free week is over. Subscribe to keep logging.",
  sheetTitle: "Your free week is over",
  sheetBody: "Subscribe to Pro to keep logging. Everything you already logged is still here, and stays yours: you can open it, export it or delete it any time, with or without Pro.",
  blocked: "Saving needs Pro now that your free week is over. Nothing you logged before was changed.",
});
