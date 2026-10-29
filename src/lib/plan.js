/* Entitlements (owner decision D1): the one place Cyra decides whether an optional paid feature is
   available. There is one plan on sale, "free", and no way to buy another yet: no paywall, no purchase code and no
   entitlement check over the network. Calm R5 (plan §7 "Premium (Pro)", which replaces D1's "never show upgrade UI"):
   gated parts carry a one-line "Pro" chip and a "See what Pro adds" sheet, never an interruption; fullPractices gates
   the practices beyond the free core set (lib/mind.js FREE_PRACTICES). DEV_PRO_PLAN is the dev/QA unlock, chosen by
   planFor() only when the build's VITE_FEATURES names the dev flag proDev (or "all"). Calm R8: PRO_PLAN is what a store
   purchase unlocks (lib/purchase.js reports whether one is owned; in this version no store is connected, so nothing is
   ever owned and only proDev opens Pro). aiPatternReports gates Cyra's weekly write-up and aiChat the chat about her
   log (both also need the build's ai flag, a server and her own switch in You). This file imports nothing, stores nothing
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
 * @property {boolean} fullPractices the whole Mind practices library (calm R5); the free plan has the core set.
 * @property {boolean} aiChat chat with Cyra's AI about her log (calm R8; previewed summary, her switch).
 */
/**
 * How many PDF files were made in a month. Recorded only while a limit is configured.
 * @typedef {Object} ExportTally
 * @property {string} month local calendar month, YYYY-MM.
 * @property {number} n PDF files made in that month.
 */

/** @type {Readonly<Plan>} */
export const FREE_PLAN = Object.freeze({ tier: "free", pdfExportsPerMonth: null, aiPatternReports: false, extraCustomisation: false, cloudBackup: false, fullPractices: false, aiChat: false });
/** The plan this build runs on unless a dev unlock applies (planFor). */
export const PLAN = FREE_PLAN;
/** The dev/QA unlock (dev flag proDev): Pro's in-app parts on, with the free plan's PDF rule. cloudBackup stays false
    (it also needs the build's cloudBackup flag and a server; R9). */
export const DEV_PRO_PLAN = Object.freeze({ ...FREE_PLAN, tier: "pro-dev", aiPatternReports: true, extraCustomisation: true, fullPractices: true, aiChat: true });
/** What a Pro purchase unlocks (calm R8). The basic PDF stays free and unlimited; cloudBackup stays false (R9). */
export const PRO_PLAN = Object.freeze({ ...FREE_PLAN, tier: "pro", aiPatternReports: true, extraCustomisation: true, fullPractices: true, aiChat: true });
/** The plan for this build's dev flags ({ proDev }) and whether a store purchase of Pro is owned (`owned`, from
    lib/purchase.js; only a real true counts): DEV_PRO_PLAN when proDev is on, PRO_PLAN when owned, else PLAN. */
export const planFor = (devFlags = {}, owned = false) => (devFlags && devFlags.proDev === true ? DEV_PRO_PLAN : owned === true ? PRO_PLAN : PLAN);
export const PLAN_FEATURES = Object.freeze(["pdfExport", "aiPatternReports", "extraCustomisation", "cloudBackup", "fullPractices", "aiChat"]);

/** Whether `feature` is available on `plan`. The PDF export is free core (off only when a plan
    allows 0); the paid extensions need an explicit true; anything else is false (fails closed).
    With a monthly PDF limit configured, also check exportsLeft(): can() does not count exports. */
export function can(feature, plan = PLAN) {
  switch (feature) {
    case "pdfExport": return plan.pdfExportsPerMonth !== 0;
    case "aiPatternReports":
    case "extraCustomisation":
    case "cloudBackup":
    case "fullPractices":
    case "aiChat": return plan[feature] === true;
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
