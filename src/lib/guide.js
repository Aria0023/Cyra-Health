/* Finding her way around (owner request 2026-11-12: "guide them on what to click, it could be overwhelming").
   Pure: no imports, no storage, no network. Three calm pieces, none of which ever blocks anything:
   - Getting started: during her first 7 days in the app (or 7 days after "Show me around again"), Home's small-step card
     shows the next unfinished first step, one at a time, each with a button that goes straight there. Finished steps
     drop out on their own; "Hide getting started" ends it.
   - A one-time tip at the top of each view the first time she opens it, with "Got it". Once seen, never again.
   - You → "Show me around again" brings both back.
   `guide` is device-only and never in a backup: { seen: [view ids], off: boolean, replay: YYYY-MM-DD | null }. */

export const GUIDE_DAYS = 7;
export const GUIDE_BLANK = Object.freeze({ seen: Object.freeze([]), off: false, replay: null });

/** One tip per view id (lib/routes.js), in plain words: what this place is for and the one thing to tap. */
export const VIEW_HINTS = Object.freeze({
  today: "This is where you log. Tap what you notice today, then Save today's check-in at the bottom. Missed a day? Open Calendar and tap the day.",
  cal: "Each day's colour shows how it went. Tap any day to see what you logged or to fill it in.",
  cycles: "Each row is one cycle, with its length and your period days. Predictions get steadier after two or three cycles.",
  mind: "Log your mood in one tap. Practices has short guided breathing and relaxation, and Journey keeps your journal.",
  practices: "Short guided practices, from 1 to 10 minutes. Tap one to start, and turn on the voice guide if you like.",
  ask: "Your journal, your mood over time and your questions live here.",
  patterns: "Patterns shows what tends to go together in your log, like short sleep and headaches. It gets clearer after a week or two of check-ins.",
  report: "Make a one-page summary to take to your doctor, as a PDF or an email you send yourself.",
  mile: "Your pregnancy roadmap: what usually happens around each week, and which visits and tests to plan.",
  you: "Your settings, your plan, backups, privacy choices and Delete everything are all here.",
});

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const VIEW_IDS = Object.keys(VIEW_HINTS);

/** A stored guide, cleaned: known view ids only (in VIEW_HINTS order), a boolean, and a date or null. */
export function cleanGuide(v) {
  const o = v && typeof v === "object" && !Array.isArray(v) ? v : {};
  const seen = Array.isArray(o.seen) ? VIEW_IDS.filter((id) => o.seen.includes(id)) : [];
  return { seen, off: o.off === true, replay: typeof o.replay === "string" && ISO.test(o.replay) ? o.replay : null };
}

/** The tip for a view, or null once she has seen it (or for a view without one). */
export const hintFor = (guide, view) => (VIEW_HINTS[view] && !cleanGuide(guide).seen.includes(view) ? VIEW_HINTS[view] : null);

/** The guide after "Got it" on a view's tip. */
export const markSeen = (guide, view) => {
  const g = cleanGuide(guide);
  return VIEW_HINTS[view] && !g.seen.includes(view) ? cleanGuide({ ...g, seen: [...g.seen, view] }) : g;
};

/** "Show me around again": every tip comes back and Getting started runs for another week from today. */
export const replayGuide = (todayIso) => ({ seen: [], off: false, replay: ISO.test(todayIso || "") ? todayIso : null });

const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

/** Whether Getting started is still running today: within GUIDE_DAYS of the later of her first day and a replay. */
export function guideActive(guide, { startIso = null, todayIso = null } = {}) {
  const g = cleanGuide(guide);
  if (g.off || !ISO.test(todayIso || "")) return false;
  const from = [startIso, g.replay].filter((d) => ISO.test(d || "")).sort().pop();
  if (!from) return false;
  const d = daysBetween(from, todayIso);
  return d >= 0 && d < GUIDE_DAYS;
}

/** The first steps, each with when it counts as done. ctx: { preg, meno, logged, periodKnown, practiced, backedUp, seen }. */
export function firstSteps({ preg = false, meno = false } = {}) {
  return [
    { id: "gs-checkin", title: "Do your first check-in", body: "Tap the symptoms you notice today, then Save at the bottom. It takes about 30 seconds.", why: "Each check-in is a dot on your calendar. A few of them are what let Solia Health show you patterns.", action: { label: "Start my check-in", log: "symptoms" }, done: (c) => c.logged },
    ...(preg || meno ? [] : [{ id: "gs-period", title: "Add your period", body: "Mark a day you had your period. You can add past days from the calendar too.", why: "Your period dates are what cycle predictions start from.", action: { label: "Log a period day", log: "period" }, done: (c) => c.periodKnown }]),
    { id: "gs-patterns", title: preg ? "See your pregnancy roadmap" : "See what Patterns shows", body: preg ? "What usually happens around each week, and which visits to plan." : "It fills in as you log, and shows what tends to go together for you.", why: preg ? "Knowing what's coming makes appointments easier to plan." : "Patterns are the main thing Solia Health gives back for your logging.", action: { label: preg ? "Open the roadmap" : "Open Patterns", view: preg ? "mile" : "patterns" }, done: (c) => c.seen.includes(preg ? "mile" : "patterns") },
    { id: "gs-practice", title: "Try a 3-minute practice", body: "Slow breathing, guided step by step. Whenever suits you today.", why: "Practices are there for harder days. Trying one now means you know where it is.", action: { label: "Start a practice", practice: "slow" }, done: (c) => c.practiced },
    { id: "gs-backup", title: "Save a backup", body: "Your log lives only on this device. Open You and choose Encrypted backup to save a copy only you can open.", why: "If your phone is lost or reset, a backup is the only way to get your log back. Nobody else has a copy.", action: { label: "Open You", view: "you" }, done: (c) => c.backedUp },
  ];
}

/** Home's Getting started step, or null (not running, all done, or hidden). Carries an eyebrow "Getting started · n of N"
    and an alt link to hide it. */
export function gettingStarted(guide, { startIso = null, todayIso = null, preg = false, meno = false, logged = false, periodKnown = false, practiced = false, backedUp = false } = {}) {
  if (!guideActive(guide, { startIso, todayIso })) return null;
  const g = cleanGuide(guide);
  const steps = firstSteps({ preg, meno });
  const ctx = { logged, periodKnown, practiced, backedUp, seen: g.seen };
  const i = steps.findIndex((s) => !s.done(ctx));
  if (i < 0) return null;
  const { done: _done, ...step } = steps[i];
  const doneCount = steps.filter((s) => s.done(ctx)).length;
  return { ...step, eyebrow: `Getting started · ${doneCount + 1} of ${steps.length}`, alt: { label: "Hide getting started", hideGuide: true } };
}
