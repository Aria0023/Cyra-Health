/* POTS movement (design 4.10, spec A13.3): Cyra's own graded, recumbent-first plan, the two
   gates in front of it, the step-up options she may choose, guided and logged sessions, and
   the pacing mode for post-exertional malaise. Pure functions only: no React, no state, no
   network, no storage. Everything here runs on the device and in `node --test`.

   Rules every function keeps:
   - Cyra never moves her to another step. Options (ready, hold, ease off) are shown for her to
     choose, never applied, and none is shown in pacing mode, while an exercise faint has
     paused them (move.faintPause, until she reports being checked), or without a "yes" from a
     clinician or physio. In pregnancy that "yes" is a separate prenatal-team answer
     (program.clearedPreg), cleared on every change of stage into Pregnancy (lib/pots.js
     resetPregClearance); the non-pregnancy answer never counts there.
   - Every number is hers: the main-part length is blank until she enters it (owner decision
     D9), and no heart-rate range is ever suggested.
   - Missing is not zero: a session with no after-rating doesn't count as one that went fine,
     and a next day she didn't answer is "not answered", never "same".
   - No streaks and nothing "missed" or "late"; rest days are part of the plan.
   - Sessions live in days[iso].move (lib/pots.js addSession / updateSession); a faint answer on
     a session also writes a linked episode and pauses the options (lib/pots.js
     setSessionFaint). Derived values (options, weeks, counts) are computed, never stored. */
import { isLockedPots, updateSession, removeItem, releaseFaintPause, localDay } from "./pots.js";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (v) => typeof v === "string" && ISO.test(v);
const fin = (v) => typeof v === "number" && Number.isFinite(v);
/** `iso` moved by `n` calendar days, as a local day key. */
const addDays = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return localDay(new Date(y, m - 1, d + n)); };
/** Whole calendar days from `a` to `b`. */
const dayDiff = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
/** 0 = Sunday … 6 = Saturday (the stored program.days use the same numbers). */
export const weekdayOf = (iso) => new Date(`${iso}T12:00:00`).getDay();

/* ---------- the plan, in Cyra's own words (not any clinic's program) ---------- */
/** The four steps. She picks hers; the weeks are typical, not targets. */
export const MOVE_STEPS = [
  { step: 1, name: "Lying and seated start", weeks: "1–4", acts: "Recumbent bike, rowing machine, swimming or water walking, floor strength (bridges, leg lifts).", pattern: "About 3 sessions a week, at an easy pace you could talk in full sentences at; 2 short strength sessions lying or seated; rest days between." },
  { step: 2, name: "Building", weeks: "5–8", acts: "The same as Step 1.", pattern: "Add a few minutes a week before adding effort; one session a week a little harder (short phrases)." },
  { step: 3, name: "Getting stronger", weeks: "9–12", acts: "Longer recumbent sessions; seated strength with bands.", pattern: "Strength twice a week." },
  { step: 4, name: "Moving upright", weeks: "13+", acts: "Walking, upright bike, elliptical, standing strength.", pattern: "Only if recumbent sessions feel manageable: swap part of one session a week for upright." },
];
export const MOVE_MODES = [["recumbent_bike", "Recumbent bike"], ["rowing", "Rowing"], ["swim", "Swimming"], ["floor", "Floor/strength"], ["walk", "Walking"], ["upright_bike", "Upright bike"], ["elliptical", "Elliptical"], ["other", "Other"]];
/** Lying or seated modes (Steps 1–3) and upright ones (Step 4); anything else counts as other. */
export const RECUMBENT = ["recumbent_bike", "rowing", "swim", "floor"];
export const UPRIGHT = ["walk", "upright_bike", "elliptical"];
export const modeWord = (m) => (MOVE_MODES.find(([k]) => k === m) || [null, "Other"])[1];
/** Session.after: 0 fine, 1 a bit worse, 2 much worse, 3 had to stop. */
export const AFTER_OPTS = [[0, "Fine"], [1, "A bit worse"], [2, "Much worse"], [3, "Had to stop"]];
export const NEXT_OPTS = [["better", "Better"], ["same", "Same"], ["worse", "Worse"], ["crash", "Crashed"]];
export const PEM_OPTS = [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]];
export const CLEAR_OPTS = [["yes", "Yes"], ["later", "I'll ask first"], ["anyway", "Show me anyway"]];
export const CLEAR_PREG_OPTS = [["yes", "My prenatal team said yes"], ["later", "I'll ask first"]];
/** Monday first, as the weekday chips show them: [stored number, label]. */
export const WEEKDAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];

/** Every sentence of the Move section that the design gives (exact copy; clinician review, Q1). */
export const MOVE_COPY = {
  pemQ: "After effort, do you often crash 12 to 72 hours later, feeling much more tired or unwell for a day or more?",
  pacing: "That's called post-exertional malaise (PEM), and it's common with ME/CFS and long COVID. For people with PEM, guidance such as NICE (2021) advises against fixed, step-up exercise programmes. Cyra will still log any activity and how you felt afterwards and the next day, with no step-ups, so you and your clinician can decide together. Ask about pacing.",
  clearQ: "Has a clinician or physio said it's OK for you to start an exercise plan?",
  clearPregQ: "Has your prenatal team said it's OK for you to start an exercise plan?",
  clearAdvice: "Check with your clinician or physio before starting, especially if you faint, have chest symptoms, or are pregnant.",
  pregWait: "During pregnancy, plan exercise with your prenatal team. You can still log activity here.",
  pregFloor: "After the first trimester, avoid lying flat on your back for long.",
  education: [
    "Why start lying down: when you're horizontal, your heart doesn't have to fight gravity, so your muscles and heart can get fitter without setting off symptoms. Research programs for POTS (Fu and Levine and colleagues in Dallas; the international POTS registry) started with recumbent bikes, rowing machines and swimming, and moved upright only after several weeks. Many people felt better after about three months. Cyra's plan follows the same general idea in simpler form. It isn't their program and it isn't a prescription.",
    "A session: about 5 minutes easy to warm up, then the main part at a pace where you could still talk in short sentences, then 5 minutes easy and a rest sitting or lying down. Have a drink before and after.",
    "Rest days matter. Most programs leave a day between sessions.",
    "Strength, about twice a week: legs and core, done lying or seated.",
  ],
  restDay: "Rest day. Rest is part of the plan.",
  mainHint: "Start lower than you think. Even 5 minutes counts.",
  mainPlaceholder: "e.g. what your clinician suggested",
  hold: "Yesterday was harder. Many people repeat the same session until it sits well.",
  holdOlder: "Your last session was harder the next day. Many people repeat the same session until it sits well.",
  holdCrash: "You crashed after your last session. Many people rest, then go back to an easier session. Tell your clinician or physio, and ask about pacing if it keeps happening.",
  holdStopped: "You had to stop your last session. Many people rest, then repeat the same session or an easier one until it sits well.",
  holdMuchWorse: "Your last session left you much worse. Many people rest, then repeat the same session or an easier one until it sits well.",
  ease: "Your last two sessions left you worse afterwards. It's fine to stay here, step back, or add a rest day. Tell your clinician or physio if it keeps happening.",
  easeSome: "Two of your sessions in the last week left you worse afterwards. It's fine to stay here, step back, or add a rest day. Tell your clinician or physio if it keeps happening.",
  // At Step 1 there is no lower step to go back to.
  easeStep1: "Your last two sessions left you worse afterwards. It's fine to stay here, shorten the main part, or add a rest day. Tell your clinician or physio if it keeps happening.",
  easeSomeStep1: "Two of your sessions in the last week left you worse afterwards. It's fine to stay here, shorten the main part, or add a rest day. Tell your clinician or physio if it keeps happening.",
  paused: "Movement: on hold until you've been checked after fainting or nearly fainting during exercise.",
  ready: (n) => `This step seems to be going okay. Options for next time: stay here, add a couple of minutes, or try Step ${n}. Check with your clinician or physio if you're unsure.`,
  faint: "Fainting or nearly fainting during exercise needs a same-day check before you exercise again.",
  stopped: "Sit or lie down, with your legs up if you're lightheaded. Have a drink.",
  rest: "Now rest sitting or lying down.",
  nextQ: "How do you feel today after yesterday's session?",
  sources: ["Fu Q et al., JACC 2010 and Hypertension 2011", "Fu Q & Levine BD, Auton Neurosci 2018", "George SA et al., Heart Rhythm 2016", "NICE NG206 (2021)", "ACOG Committee Opinion 804"],
};

/* ---------- reading the plan ---------- */
/** The step she chose last: when it was chosen (program.stepOn, else the plan's start). */
const stepSince = (pr) => (isIso(pr.stepOn) ? pr.stepOn : isIso(pr.start) ? pr.start : null);
/** Where she is with the Move section. `stage` decides which clearance answer applies.
    -> { program, asked (PEM answered), pacing, preg, answer, planShown, stepUps, paused } */
export function moveState(p, stage) {
  const ok = isObj(p) && !isLockedPots(p);
  const pr = ok && isObj(p.move) && isObj(p.move.program) ? p.move.program : null;
  const paused = ok && isObj(p.move) && isIso(p.move.faintPause) ? p.move.faintPause : null;
  const preg = stage === "preg";
  const asked = !!pr && pr.pem != null;
  const pacing = asked && (pr.pem === "yes" || pr.pem === "unsure");
  const answer = pr ? (preg ? pr.clearedPreg : pr.cleared) ?? null : null;
  // Outside pregnancy the plan shows once the clearance question has any answer (with a
  // persistent "check first" advice unless it is yes); in pregnancy only after the prenatal
  // team's yes. Pacing mode has no step plan at all.
  const planShown = asked && !pacing && (preg ? answer === "yes" : answer != null);
  return { program: pr, asked, pacing, preg, answer, planShown, stepUps: planShown && answer === "yes" && !paused, paused };
}

/** Every session she logged, oldest first: [{ ...session, date }]. */
export function allSessions(p) {
  if (!isObj(p) || isLockedPots(p) || !isObj(p.days)) return [];
  const out = [];
  for (const [date, d] of Object.entries(p.days)) {
    if (!isIso(date) || !isObj(d) || !Array.isArray(d.move)) continue;
    for (const s of d.move) if (isObj(s)) out.push({ ...s, date });
  }
  return out.sort((a, b) => (a.date === b.date ? (a.t < b.t ? -1 : a.t > b.t ? 1 : 0) : a.date < b.date ? -1 : 1));
}
/** Is there anything for the Movement part of a report (a session, or her Move answers)? */
export const hasMoveData = (p) => allSessions(p).length > 0 || !!moveState(p, null).program;

/** Left her worse: a next day rated worse or crashed, or "much worse" / "had to stop" right after. */
export const leftWorse = (s) => s.next === "worse" || s.next === "crash" || (fin(s.after) && s.after >= 2);
/** Went okay: rated fine or a bit worse right after (missing is not zero: an unrated session
    doesn't count), and the next day better, the same, or not answered. */
export const wentOkay = (s) => fin(s.after) && s.after <= 1 && (s.next == null || s.next === "better" || s.next === "same");

/** Which option, if any, the Move section offers today (design 4.10). Never automatic: she taps
    any step change herself. Ease off beats hold, and hold beats ready. Hold follows any latest
    session that left her worse (a next day rated worse or crashed, or "much worse" / "had to
    stop" right after), and ready is never offered while any session in the last 7 days left her
    worse, so a step-up is never suggested straight after a crash or a forced stop.
    -> null | { kind: "ease", copy, back: step-1|null } | { kind: "hold", copy } | { kind: "ready", copy, next } */
export function moveOption(p, { stage = null, today } = {}) {
  const st = moveState(p, stage);
  if (!st.stepUps || !isIso(today)) return null;
  const pr = st.program, step = pr.step || 1;
  const all = allSessions(p).filter((s) => s.date <= today);
  // Ease off: two sessions within the last 7 days left her worse.
  const week = all.filter((s) => s.date >= addDays(today, -6));
  const worse = week.filter(leftWorse);
  if (worse.length >= 2) {
    const last2 = all.slice(-2);
    const lastTwo = last2.length === 2 && last2.every((s) => s.date >= addDays(today, -6) && leftWorse(s));
    const copy = step > 1 ? (lastTwo ? MOVE_COPY.ease : MOVE_COPY.easeSome) : lastTwo ? MOVE_COPY.easeStep1 : MOVE_COPY.easeSomeStep1;
    return { kind: "ease", copy, back: step > 1 ? step - 1 : null };
  }
  // Hold: her latest session left her worse (the next day, or right after).
  const last = all[all.length - 1];
  if (last && last.next === "crash") return { kind: "hold", copy: MOVE_COPY.holdCrash };
  if (last && last.next === "worse") return { kind: "hold", copy: last.date === addDays(today, -1) ? MOVE_COPY.hold : MOVE_COPY.holdOlder };
  if (last && leftWorse(last)) return { kind: "hold", copy: last.after >= 3 ? MOVE_COPY.holdStopped : MOVE_COPY.holdMuchWorse };
  // Ready: at least 6 sessions at this step over at least 14 days, 80% or more of them okay, and
  // none in the last 7 days left her worse.
  if (step >= 4 || worse.length) return null;
  const since = stepSince(pr);
  const at = all.filter((s) => s.step === step && (!since || s.date >= since));
  if (at.length < 6 || dayDiff(at[0].date, at[at.length - 1].date) + 1 < 14) return null;
  if (at.filter(wentOkay).length < 0.8 * at.length) return null;
  return { kind: "ready", copy: MOVE_COPY.ready(step + 1), next: step + 1 };
}

/** Week of her plan, counting the day the plan started as week 1. */
export const planWeek = (pr, today) => (isObj(pr) && isIso(pr.start) && isIso(today) ? Math.max(1, Math.floor(dayDiff(pr.start, today) / 7) + 1) : 1);
/** "Step 1 · week 3 of your plan · 9 sessions · longest main part 18 min" (sessions since the
    plan started). */
export function progress(p, today) {
  const pr = moveState(p, null).program;
  if (!pr) return null;
  const s = allSessions(p).filter((x) => (!isIso(pr.start) || x.date >= pr.start) && x.date <= today);
  const longest = s.reduce((m, x) => (fin(x.main) && x.main > m ? x.main : m), 0);
  const step = pr.step || 1, week = planWeek(pr, today);
  return { step, week, n: s.length, longest, text: `Step ${step} · week ${week} of your plan · ${s.length} ${s.length === 1 ? "session" : "sessions"}${longest ? ` · longest main part ${longest} min` : ""}` };
}
/** Sessions per week for the last `weeks` weeks, as rolling 7-day blocks ending `today`, oldest
    first: [{ from, to, n, worse, crash }] (worse / crash = next days rated so). */
export function weeklyCounts(p, today, weeks = 8) {
  const all = allSessions(p);
  const out = [];
  for (let k = weeks - 1; k >= 0; k--) {
    const to = addDays(today, -7 * k), from = addDays(to, -6);
    const s = all.filter((x) => x.date >= from && x.date <= to);
    out.push({ from, to, n: s.length, worse: s.filter((x) => x.next === "worse").length, crash: s.filter((x) => x.next === "crash").length });
  }
  return out;
}
/** The movement line for Today's plan on `day`: "Movement: Step 1 session today" on a planned
    weekday, "Rest day. Rest is part of the plan." on the others; null with no plan to show
    (pacing mode, pregnancy before the prenatal team's yes, or no days chosen). After an exercise
    faint (move.faintPause) it never offers a session: it says movement is on hold until she has
    been checked. */
export function planLine(p, { stage = null, day } = {}) {
  const st = moveState(p, stage);
  if (!st.planShown || !isIso(day)) return null;
  if (st.paused) return MOVE_COPY.paused;
  if (!Array.isArray(st.program.days) || !st.program.days.length) return null;
  return st.program.days.includes(weekdayOf(day)) ? `Movement: Step ${st.program.step || 1} session today` : MOVE_COPY.restDay;
}
/** Yesterday's sessions still waiting for "How do you feel today after yesterday's session?":
    no next-day answer and not skipped. */
export function nextDayPending(p, today) {
  if (!isObj(p) || isLockedPots(p) || !isIso(today)) return [];
  const y = addDays(today, -1);
  return ((((p.days || {})[y] || {}).move) || []).filter((s) => isObj(s) && s.next == null && s.nextSkip !== true).map((s) => ({ ...s, date: y }));
}
/** The lengths a new guided session starts with: her last full session's mode and minutes
    (one she didn't stop early), the main part from her plan when she has set one, and 5-minute
    warm-up and cool-down otherwise. The main part is never a length Cyra picks: with no plan
    length and no earlier session it stays blank (owner decision D9). */
export function sessionDefaults(p) {
  const all = allSessions(p);
  const last = all.filter((s) => !s.stopped).pop() || null;
  const pr = moveState(p, null).program;
  const mins = (v, d) => (fin(v) ? v : d);
  const main = pr && fin(pr.mainMin) ? pr.mainMin : last && fin(last.main) && last.main > 0 ? last.main : null;
  const mode = (all[all.length - 1] || {}).mode;
  return { mode: MOVE_MODES.some(([k]) => k === mode) ? mode : null, warm: last ? mins(last.warm, 5) : 5, main, cool: last ? mins(last.cool, 5) : 5 };
}

/* ---------- actions (each returns a new pots; a locked record comes back unchanged) ---------- */
const guard = (fn) => (p, ...a) => (!isObj(p) || isLockedPots(p) ? p : fn(p, ...a));
const PROGRAM_KEYS = ["cleared", "clearedPreg", "pem", "step", "days", "mainMin", "hrNote"];
/** Set her Move answers and plan (created on the first answer, starting `today`). Answering a
    clearance question records the day (clearedOn / clearedPregOn); choosing another step
    records the day she chose it (stepOn), so "ready" only counts sessions at that step since.
    Unknown keys in `patch` are ignored. */
export const setProgram = guard((p, patch, today) => {
  if (!isObj(patch) || !isIso(today)) return p;
  const cur = isObj(p.move) && isObj(p.move.program) ? p.move.program : null;
  const base = cur || { cleared: null, clearedOn: null, clearedPreg: null, clearedPregOn: null, pem: null, step: 1, start: today, stepOn: today, days: [], mainMin: null, hrNote: "" };
  const next = { ...base };
  for (const k of PROGRAM_KEYS) if (k in patch) next[k] = patch[k];
  if ("cleared" in patch && patch.cleared !== base.cleared) next.clearedOn = patch.cleared == null ? null : today;
  if ("clearedPreg" in patch && patch.clearedPreg !== base.clearedPreg) next.clearedPregOn = patch.clearedPreg == null ? null : today;
  if ("step" in patch && patch.step !== base.step) next.stepOn = today;
  if (Array.isArray(next.days)) next.days = [...new Set(next.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  if (next.mainMin != null && !(fin(next.mainMin) && next.mainMin >= 5 && next.mainMin <= 60)) next.mainMin = null;
  if (typeof next.hrNote === "string") next.hrNote = next.hrNote.trim().slice(0, 120);
  if (![1, 2, 3, 4].includes(next.step)) next.step = base.step || 1;
  return { ...p, move: { ...(isObj(p.move) ? p.move : {}), program: next } };
});
/** "I've been checked": step-up options may show again after an exercise faint. */
export const clearFaintPause = guard((p) => (isObj(p.move) && p.move.faintPause ? { ...p, move: { ...p.move, faintPause: null, faintPauseSrc: undefined } } : p));
/** The next-day answer for each of `ids` on `day` (better / same / worse / crash, or null to
    clear); answering also takes away an earlier "Skip". */
export const setNextDay = guard((p, day, ids, next) => (Array.isArray(ids) ? ids : [ids]).reduce((q, id) => updateSession(q, day, id, { next: next == null ? null : next, nextSkip: undefined }), p));
/** "Skip" on the next-day question: it isn't asked again for these sessions. */
export const skipNextDay = guard((p, day, ids) => (Array.isArray(ids) ? ids : [ids]).reduce((q, id) => updateSession(q, day, id, { nextSkip: true }), p));
/** Discard a session (tombstoned). Its linked faint episode stays unless keepFaint is false;
    then a step-up pause only its faint set is taken back too (lib/pots.js releaseFaintPause). */
export const deleteSession = guard((p, day, id, { keepFaint = true } = {}) => {
  let q = removeItem(p, day, id);
  if (q === p) return p;
  if (!keepFaint) {
    const ex = (((q.days || {})[day] || {}).eps || []).find((e) => e.src === id);
    if (ex) q = removeItem(q, day, ex.id);
    q = releaseFaintPause(q, id);
  }
  return q;
});
