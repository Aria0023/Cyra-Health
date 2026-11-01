/* "What I'm trying" (Solia C, 2026-11-01): the kinds an item can be, the daily question each kind asks, the kind a
   Care-shelf item gets when she taps "Try this", and the short status a row shows. Pure: no imports, no storage.

   Kinds she picks by hand stay rx / supp / habit (the record's `meds[].kind`, record.js). Items added from the Care
   shelf get a fitting kind instead of a guess: a sleep program is a "program", a clinician service is "care" (no daily
   question: it isn't something she takes or does each day), a wrap or a cooling set is a "comfort aid". Anything
   unknown (an old or hand-edited record) reads as a habit. */
export const TRY_KINDS = Object.freeze({
  rx: Object.freeze({ label: "Prescription", ask: "taken" }),
  supp: Object.freeze({ label: "Supplement", ask: "taken" }),
  habit: Object.freeze({ label: "Habit", ask: "did" }),
  program: Object.freeze({ label: "Program", ask: "did" }),
  aid: Object.freeze({ label: "Comfort aid", ask: "used" }),
  care: Object.freeze({ label: "Care", ask: null }),
});
/** The kinds offered when she adds an item herself, in order. */
export const HAND_KINDS = Object.freeze([["rx", "Prescription"], ["supp", "Supplement"], ["habit", "Habit"]]);
const kindOf = (k) => TRY_KINDS[k] || TRY_KINDS.habit;
export const kindLabel = (k) => kindOf(k).label;
const QUESTION = { taken: "Taken today?", did: "Did it today?", used: "Used it today?" };
const DONE = { taken: "✓ Taken", did: "✓ Done", used: "✓ Used" };
/** The daily question for a kind ("Taken today?" for meds and supplements, "Did it today?" for habits and programs),
    or null for care services, which get no daily question. */
export const dailyQuestion = (k) => QUESTION[kindOf(k).ask] || null;
/** The pressed state's word for the same toggle. */
export const doneWord = (k) => DONE[kindOf(k).ask] || null;

/** The Care shelf's items (lib/constants.js SHELF) by id → kind. A shelf item may also carry its own `kind`. */
export const SHELF_KINDS = Object.freeze({ midi: "care", restfully: "program", emberline: "aid", mineral: "supp", verdana: "supp", nightfall: "aid" });
export function shelfKind(item) {
  if (item && TRY_KINDS[item.kind]) return item.kind;
  if (item && SHELF_KINDS[item.id]) return SHELF_KINDS[item.id];
  if (item && item.tone === "clinical") return "care";
  return "habit";
}

/** The minimum logged days on each side of the start date before a comparison (App.jsx medEffects; lib/patterns.js TRIAL_MIN). */
export const TRY_MIN = 5;
/** A row's short status chip from its medEffects entry: { text, result } — result true for a comparison. */
export function tryChip(eff) {
  if (!eff) return null;
  if (eff.ready) {
    const same = Math.abs(eff.after - eff.before) < 3;
    return { text: same ? "About the same as before" : eff.after > eff.before ? "Lighter days since starting" : "Heavier days since starting", result: true };
  }
  return { text: "Not enough days to compare", result: false };
}
/** The per-item detail for "How comparing works", said once for the whole list: what each waiting item still needs. */
export function tryWaitLine(eff) {
  if (!eff || eff.ready) return null;
  if (eff.stuckBefore) return `${eff.name}: needs ${TRY_MIN} logged days in the 2 weeks before you started — you have ${eff.haveBefore}, so it can't be compared.`;
  if (eff.stuckAfter) return `${eff.name}: needs ${TRY_MIN} logged days in the 2 weeks from the start — you have ${eff.haveAfter}, so it can't be compared.`;
  const n = (eff.needBefore || 0) + (eff.needAfter || 0);
  return `${eff.name}: ${n} more logged day${n === 1 ? "" : "s"} to compare (${eff.haveBefore} before, ${eff.haveAfter} since).`;
}
