/* Entitlements (owner decision D1): the one place Cyra decides whether an optional paid feature is
   available. There is one plan, "free", and no way to get another: no paywall, no upgrade prompt, no
   purchase code and no entitlement check over the network. This file imports nothing, stores nothing
   and sends nothing. pdfExportsPerMonth null means unlimited, and while it is null noteExport()
   returns null, so no count of her exports is kept. See docs/MONETIZATION.md.

   No screen reads this file yet. Where each entitlement will be checked (docs/MONETIZATION.md §3):
   pdfExport at the Report's PDF download (L9), cloudBackup together with the build's cloudBackup
   flag in the backup transport (L4), aiPatternReports reserved (nothing calls it while it is false),
   extraCustomisation not used (the favourites sheet is free core). Components never compare tier
   names: they ask can(feature), which says no to anything it doesn't know. */

/**
 * @typedef {Object} Plan
 * @property {string} tier the plan's name ("free"). Never compared by a screen.
 * @property {number|null} pdfExportsPerMonth PDF files per local calendar month; null = unlimited, 0 = none.
 * @property {boolean} aiPatternReports advanced AI pattern reports (per-report consent).
 * @property {boolean} extraCustomisation customisation beyond the free favourites and palettes.
 * @property {boolean} cloudBackup end-to-end-encrypted cloud backup and sync.
 */
/**
 * How many PDF files were made in a month. Recorded only while a limit is configured.
 * @typedef {Object} ExportTally
 * @property {string} month local calendar month, YYYY-MM.
 * @property {number} n PDF files made in that month.
 */

/** @type {Readonly<Plan>} */
export const FREE_PLAN = Object.freeze({ tier: "free", pdfExportsPerMonth: null, aiPatternReports: false, extraCustomisation: false, cloudBackup: false });
/** The plan this build runs on. There is no other. */
export const PLAN = FREE_PLAN;
export const PLAN_FEATURES = Object.freeze(["pdfExport", "aiPatternReports", "extraCustomisation", "cloudBackup"]);

/** Whether `feature` is available on `plan`. The PDF export is free core (off only when a plan
    allows 0); the paid extensions need an explicit true; anything else is false (fails closed).
    With a monthly PDF limit configured, also check exportsLeft(): can() does not count exports. */
export function can(feature, plan = PLAN) {
  switch (feature) {
    case "pdfExport": return plan.pdfExportsPerMonth !== 0;
    case "aiPatternReports":
    case "extraCustomisation":
    case "cloudBackup": return plan[feature] === true;
    default: return false;
  }
}

/** This device's local calendar month, YYYY-MM. */
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** PDF files already made this local month according to `tally`; anything unreadable counts as none. */
export function exportsUsed(tally, now = new Date()) {
  const ok = tally !== null && typeof tally === "object" && !Array.isArray(tally) && tally.month === monthKey(now) && Number.isInteger(tally.n) && tally.n > 0;
  return ok ? tally.n : 0;
}

/** PDF files left this month: null = unlimited (the free plan); 0 when the limit isn't a whole
    number ≥ 0 (fails closed); otherwise the limit minus what was used, never below 0. */
export function exportsLeft(tally, { plan = PLAN, now = new Date() } = {}) {
  const limit = plan.pdfExportsPerMonth;
  if (limit == null) return null;
  if (!Number.isInteger(limit) || limit < 0) return 0;
  return Math.max(0, limit - exportsUsed(tally, now));
}

/** The tally after one more PDF file: a new object, or null while exports are unlimited (then
    nothing is recorded at all). */
export function noteExport(tally, { plan = PLAN, now = new Date() } = {}) {
  if (plan.pdfExportsPerMonth == null) return null;
  return { month: monthKey(now), n: exportsUsed(tally, now) + 1 };
}
