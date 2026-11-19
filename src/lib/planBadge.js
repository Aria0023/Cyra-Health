/* The plan badge in the header (owner request 2026-11-19: "make distinction at top pro vs trial"). Pure.
   One short word for where she stands, so Pro, the free week and a guest never look the same:
     pro    she owns Pro (a store trial of Pro counts: the store reports it as owned)
     guest  inside the "Try it first" window, before making an account
     trial  the free week is running (only where the gate is on, i.e. where she can subscribe)
     ended  the free week is over and she has no Pro
     free   everywhere else: nothing is time-limited in this build
   label is what the chip shows; say is the full sentence for a screen reader and the tooltip. */
import { trialDaysLeft } from "./trial.js";

export function planBadge({ owned = false, guest = null, gateOn = false, startIso = null, todayIso = null } = {}) {
  if (owned === true) return { key: "pro", label: "Pro", say: "Your plan: Pro. Open plans." };
  if (guest === "in") return { key: "guest", label: "Guest", say: "You're trying Solia Health as a guest. Open plans." };
  if (!gateOn) return { key: "free", label: "Free", say: "Your plan: Free. Open plans." };
  const n = trialDaysLeft(startIso, todayIso);
  if (n <= 0) return { key: "ended", label: "Free week over", say: "Your free week is over. Open plans." };
  const days = n === 1 ? "last day" : `${n} days left`;
  return { key: "trial", label: `Free week \u00b7 ${days}`, say: `Free week: ${days}. Open plans.` };
}
