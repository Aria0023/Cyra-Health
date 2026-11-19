/* The plan badge in the header (owner request 2026-11-19: "make distinction at top pro vs trial"). Pure.
   One short word for where she stands, so Pro, the free week and a guest never look the same:
     pro    she owns Pro (a store trial of Pro counts: the store reports it as owned)
     guest  inside the "Try it first" window, before making an account
     trial  the free week is running (only where the gate is on, i.e. where she can subscribe)
     ended  the free week is over and she has no Pro
     free   everywhere else: nothing is time-limited in this build
   label is what the chip shows; say is its accessible name and tooltip (the label, then what a tap does). */
import { trialDaysLeft } from "./trial.js";

const badge = (key, label) => ({ key, label, say: `${label}. Open plans.` }); // the spoken name starts with the words on the chip
export function planBadge({ owned = false, guest = null, gateOn = false, startIso = null, todayIso = null } = {}) {
  if (owned === true) return badge("pro", "Pro");
  if (guest === "in") return badge("guest", "Guest");
  if (!gateOn) return badge("free", "Free");
  const n = trialDaysLeft(startIso, todayIso);
  if (n <= 0) return badge("ended", "Free week over");
  return badge("trial", `Free week \u00b7 ${n === 1 ? "last day" : `${n} days left`}`);
}
