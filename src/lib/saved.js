/* How Solia Health says something was kept (owner request 2026-11-12: "how does she know she's done?").
   One rule everywhere: a tap that saves on the spot (mood, sleep hours, a medicine taken, PCOS signals, meal details) shows
   SAVED_LINE; the daily check-in, which waits for its Save button, ends with CHECKIN_SAVED, the "Today's check-in is
   saved" line on the check-in itself, and a tick on Home's today line. Pure: no imports. */
export const SAVED_LINE = "Saved \u2713";
export const CHECKIN_SAVED = "Today's check-in is saved \u2713";
