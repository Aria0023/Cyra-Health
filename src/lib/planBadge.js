/* The plan badge in the header (owner request 2026-11-19: "make distinction at top pro vs trial"). Pure.
   One short word for where she stands, so Pro, the free week and a guest never look the same:
     pro    she owns Pro (a store trial of Pro counts: the store reports it as owned)
     guest  inside the "Try it first" window, before making an account
     trial  the free week is running (only where the gate is on, i.e. where she can subscribe)
     ended  the free week is over and she has no Pro
     free   everywhere else: nothing is time-limited in this build
   label is what the chip shows; say is its accessible name and tooltip (the label, then what a tap does). Since
   2026-11-25 it is the only plan or free-week message on every screen (Home's free-week bar and Pro note are gone). */
import { trialDaysLeft } from "./trial.js";

// The spoken name starts with the words on the chip (WCAG 2.5.3); `more` adds what the short word leaves out
// (2026-11-25, critique-fixes Task 1: the badge is the one place for the plan, so its name must say enough on its own).
const badge = (key, label, more = "") => ({ key, label, say: `${label}${more ? `, ${more}` : ""}. Open plans.` });
export function planBadge({ owned = false, guest = null, gateOn = false, startIso = null, todayIso = null } = {}) {
  if (owned === true) return badge("pro", "Pro");
  if (guest === "in") return badge("guest", "Guest", "no account yet");
  if (!gateOn) return badge("free", "Free");
  const n = trialDaysLeft(startIso, todayIso);
  if (n <= 0) return badge("ended", "Free week over");
  return badge("trial", `Free week \u00b7 ${n === 1 ? "last day" : `${n} days left`}`);
}

/** The badge's words on (at most) two short lines, so the header fits on one row at 320px: "Free week ·" over
    "7 days left"; a label without " · " splits before its last word once it is longer than one word or two. */
export function badgeLines(label) {
  const s = String(label || "");
  const dot = s.indexOf(" \u00b7 ");
  if (dot > 0) return [`${s.slice(0, dot)} \u00b7`, s.slice(dot + 3)];
  const sp = s.lastIndexOf(" ");
  return s.length > 10 && sp > 0 ? [s.slice(0, sp), s.slice(sp + 1)] : [s];
}
