/* Weekly review and one small experiment (calm R6, spec §3.5d). Pure: no React, no storage, no network.
   The review looks back at the last full week (Sunday to Saturday). It shows by itself from Sunday through Tuesday and
   on demand any other day. It counts what she logged (counts, never grades), names one or two associations from the
   pattern cards and ends in ONE optional starter experiment, with "Start" and "Skip this week" as equal choices.
   An experiment runs for 7 days from the day she starts it: she ticks the days she did it (Home's small-step card) and
   the review after it compares the days she did it with the days she didn't, as an association in her own log.
   Every experiment states what the evidence says, with a named source, and that it is wellbeing support, not
   treatment (docs/EVIDENCE.md, docs/CLINICIAN-REVIEW.md). Custom experiments are Pro (plan §3); none is built here.
   Persisted key `experiments` (record.js; in backups): { active: { id, start, done: [iso] } | null, skip: iso | null,
   past: [{ id, start, days: [iso], target }] } — skip is the Sunday of the week whose offer she skipped; past keeps the
   days she ticked so the next review can compare them. */
import { addDays, isRoughNight } from "./engine.js";
import { bodyDay } from "./bodylog.js";
import { SUPPORT_LINE, SOURCES as MIND_SOURCES } from "./mind.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const weekday = (iso) => new Date(iso + "T12:00:00").getDay(); // 0 = Sunday

export const EXP_DAYS = 7;
export const EXP_PAST_MAX = 26;
/* Sources for the experiments that are not already in the Mind library (lib/mind.js SOURCES). */
export const EXP_SOURCES = Object.freeze({
  buffey2022: Object.freeze({ title: "The Acute Effects of Interrupting Prolonged Sitting Time in Adults with Standing and Light-Intensity Walking on Biomarkers of Cardiometabolic Health in Adults: A Systematic Review and Meta-analysis", body: "Buffey AJ, Herring MP, Langley CK, Donnelly AE, Carson BP. Sports Medicine 52(8):1765–1787.", year: 2022 }),
  reynolds2016: Object.freeze({ title: "Advice to walk after meals is more effective for lowering postprandial glycaemia in type 2 diabetes mellitus than advice that does not specify timing: a randomised crossover study", body: "Reynolds AN, Mann JI, Williams S, Venn BJ. Diabetologia 59(12):2572–2578.", year: 2016 }),
});
const src = (k) => EXP_SOURCES[k] || MIND_SOURCES[k];

/** The starter experiments (free). target: days to try it within the 7; practice: the Mind practice it can open;
    watch: what the follow-up compares on the days she did it against the other days (an association only). */
export const EXPERIMENTS = Object.freeze([
  Object.freeze({
    id: "walk-lunch", title: "A 10-minute walk after lunch", short: "Try a 10-minute walk after lunch on 3 days this week.", target: 3, icon: "move",
    why: "In small trials, light walking after a meal lowered the rise in blood sugar that follows it. Whether it changes energy dips or cravings for you is what your own log can show.",
    src: Object.freeze(["buffey2022", "reynolds2016"]), line: SUPPORT_LINE,
    watch: Object.freeze({ label: "energy dips or cravings", ids: Object.freeze(["eng", "cra"]), pcos: Object.freeze(["crash"]) }),
  }),
  Object.freeze({
    id: "winddown", title: "The wind-down plan", short: "Try the wind-down practice on 4 nights this week.", target: 4, icon: "moon", practice: "winddown",
    why: "Stimulus control (keeping bed for sleep) is one part of cognitive behavioural therapy for insomnia, which sleep medicine guidelines suggest for adults with ongoing insomnia.",
    src: Object.freeze(["edinger2021"]), line: SUPPORT_LINE,
    watch: Object.freeze({ label: "rough nights", night: true }),
  }),
  Object.freeze({
    id: "breathe", title: "Three minutes of slow breathing", short: "Try three minutes of slow breathing on 4 days this week.", target: 4, icon: "breath", practice: "slow",
    why: "Breathing at around six breaths a minute is linked with feeling calmer, and trials of breathwork show small drops in stress. Most studies are small.",
    src: Object.freeze(["zaccaro2018", "fincham2023"]), line: SUPPORT_LINE,
    watch: Object.freeze({ label: "worry or a low mood", ids: Object.freeze(["anx"]), lowMood: true }),
  }),
  Object.freeze({
    id: "move", title: "A short bout of movement", short: "Try 10 to 20 minutes of movement you enjoy on 3 days this week.", target: 3, icon: "move", practice: "move",
    why: "A single bout of exercise raised feelings of energy in most trials, with small, short-lived effects.",
    src: Object.freeze(["loy2013"]), line: SUPPORT_LINE,
    watch: Object.freeze({ label: "low energy", ids: Object.freeze(["eng"]) }),
  }),
]);
export const EXPERIMENT_IDS = Object.freeze(EXPERIMENTS.map((x) => x.id));
export const experimentOf = (id) => EXPERIMENTS.find((x) => x.id === id) || null;
export const experimentSources = (x) => (x?.src || []).map(src).filter(Boolean);

/* ---------- the persisted key ---------- */
export const EMPTY_EXPERIMENTS = Object.freeze({ active: null, skip: null, past: Object.freeze([]) });
const cleanDays = (days, start) => {
  const end = addDays(start, EXP_DAYS - 1);
  return [...new Set((Array.isArray(days) ? days : []).filter((d) => typeof d === "string" && ISO.test(d) && d >= start && d <= end))].sort();
};
const toPast = (a) => ({ id: a.id, start: a.start, days: [...a.done], target: experimentOf(a.id)?.target || 1 });
/** A clean experiments value (unknown ids, bad dates and duplicates dropped; done days sorted, inside the 7 days). */
export function cleanExperiments(raw) {
  if (!isObj(raw)) return { active: null, skip: null, past: [] };
  let active = null;
  const a = raw.active;
  if (isObj(a) && EXPERIMENT_IDS.includes(a.id) && typeof a.start === "string" && ISO.test(a.start)) {
    active = { id: a.id, start: a.start, done: cleanDays(a.done, a.start) };
  }
  const skip = typeof raw.skip === "string" && ISO.test(raw.skip) ? raw.skip : null;
  const past = (Array.isArray(raw.past) ? raw.past : [])
    .filter((p) => isObj(p) && EXPERIMENT_IDS.includes(p.id) && typeof p.start === "string" && ISO.test(p.start) && Number.isInteger(p.target) && p.target >= 1 && p.target <= EXP_DAYS)
    .map((p) => ({ id: p.id, start: p.start, days: cleanDays(p.days, p.start), target: p.target }))
    .sort((x, y) => (x.start < y.start ? -1 : x.start > y.start ? 1 : 0))
    .slice(-EXP_PAST_MAX);
  return { active, skip, past };
}
/** Moves an ended experiment (its 7 days are over) into past. Same object when nothing changes. */
export function settle(state, todayIso) {
  const s = state || EMPTY_EXPERIMENTS;
  if (!s.active || addDays(s.active.start, EXP_DAYS - 1) >= todayIso) return s;
  return { ...s, active: null, past: [...(s.past || []), toPast(s.active)].slice(-EXP_PAST_MAX) };
}
/** Starts experiment `id` today (an earlier one is settled into past first). */
export function startExperiment(state, id, todayIso) {
  if (!experimentOf(id)) return state;
  const s = settle(state, todayIso);
  return { ...s, active: { id, start: todayIso, done: [] }, past: s.active ? [...(s.past || []), toPast(s.active)].slice(-EXP_PAST_MAX) : s.past || [] };
}
/** "Skip this week": no experiment offered again until the next review week. */
export const skipWeek = (state, weekKey) => ({ ...(state || EMPTY_EXPERIMENTS), skip: weekKey });
/** Ticks (on = true) or unticks a day of the running experiment. */
export function markDay(state, iso, on) {
  const s = state || EMPTY_EXPERIMENTS;
  if (!s.active || iso < s.active.start || iso > addDays(s.active.start, EXP_DAYS - 1)) return s;
  const set = new Set(s.active.done);
  if (on) set.add(iso); else set.delete(iso);
  return { ...s, active: { ...s.active, done: [...set].sort() } };
}
/** Stops the running experiment early (kept in past with the days she ticked). */
export const stopExperiment = (state) => (state && state.active ? { ...state, active: null, past: [...(state.past || []), toPast(state.active)].slice(-EXP_PAST_MAX) } : state);

/** The running experiment on `todayIso`: { x (catalogue entry), start, end, dayN (1–7), done, doneToday } or null. */
export function runningOn(state, todayIso) {
  const a = state && state.active;
  if (!a) return null;
  const end = addDays(a.start, EXP_DAYS - 1);
  if (todayIso < a.start || todayIso > end) return null;
  const x = experimentOf(a.id);
  if (!x) return null;
  const dayN = Math.round((Date.parse(todayIso + "T00:00:00Z") - Date.parse(a.start + "T00:00:00Z")) / 86400000) + 1;
  return { x, start: a.start, end, dayN, done: a.done.length, doneToday: a.done.includes(todayIso) };
}

/** Home's small-step card while an experiment runs (lib/home.js STEPS shape, plus `eyebrow` and `alt`). */
export function experimentStep(state, todayIso) {
  const r = runningOn(state, todayIso);
  if (!r) return null;
  const { x } = r;
  const so = `${r.done} of ${x.target} ${x.target === 1 ? "day" : "days"} so far`;
  return {
    id: "exp", eyebrow: `Your experiment · day ${r.dayN} of ${EXP_DAYS}`, title: x.title,
    body: r.doneToday ? `Ticked for today. ${so}. There's no need to do more than you planned.` : `${x.short} So far: ${r.done} of ${x.target}, on any days you choose.`,
    why: `${x.why} ${x.line}`, src: experimentSources(x)[0] || null,
    action: r.doneToday ? { label: "Untick today", exp: "undo" } : { label: "I did it today", exp: "done" },
    alt: x.practice && !r.doneToday ? { label: x.practice === "move" ? "Open the movement practice" : x.practice === "slow" ? "Open slow breathing" : "Open the wind-down practice", practice: x.practice } : null,
  };
}

/* ---------- the review week ---------- */
/** The last full week before the most recent Sunday: { key (that Sunday), from (the Sunday before), to (Saturday),
    shows: true from Sunday through Tuesday }. */
export function reviewWeek(todayIso) {
  const key = addDays(todayIso, -weekday(todayIso));
  return { key, from: addDays(key, -7), to: addDays(key, -1), shows: weekday(todayIso) <= 2 };
}
/** What she logged in [from, to], as counts: check-ins, mood check-ins, nights with sleep hours, days with movement,
    practices she finished (or ran at least 10 seconds of). */
export function weekCounts({ entries = [], moodLog = {}, bodyLog = {}, practiceLog = [], from, to }) {
  const inW = (d) => typeof d === "string" && d >= from && d <= to;
  let sleep = 0, moves = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) { const b = bodyDay(bodyLog, d); if (b.sleepH != null) sleep++; if ((b.move || []).length) moves++; }
  return {
    checkins: (entries || []).filter((e) => e && inW(e.date)).length,
    moods: Object.keys(isObj(moodLog) ? moodLog : {}).filter((d) => inW(d) && Number.isFinite(moodLog[d]?.mood)).length,
    sleep, moves,
    practices: (Array.isArray(practiceLog) ? practiceLog : []).filter((r) => r && inW(r.day)).length,
  };
}
/** The counts as short chips' words, only the non-zero ones ("5 check-ins"). */
export function countWords(c) {
  const w = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  return [
    c.checkins && w(c.checkins, "check-in", "check-ins"), c.moods && w(c.moods, "mood check-in", "mood check-ins"),
    c.sleep && w(c.sleep, "night's sleep", "nights' sleep"), c.moves && w(c.moves, "day with movement", "days with movement"),
    c.practices && w(c.practices, "practice", "practices"),
  ].filter(Boolean);
}
/** What the week's log leans toward, for choosing one experiment: { rough, low, anx, energy, pcos }. */
export function weekSignals({ entries = [], moodLog = {}, bodyLog = {}, from, to }) {
  const es = (entries || []).filter((e) => e && e.date >= from && e.date <= to);
  const hit = (id) => es.filter((e) => (e.sym?.[id] || 0) >= 2).length;
  let pcos = 0, low = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const b = bodyDay(bodyLog, d);
    if ((b.pcos || []).some((p) => p === "crash" || p === "cra" || p === "sug")) pcos++;
    if (Number.isFinite(moodLog?.[d]?.mood) && moodLog[d].mood <= 2) low++;
  }
  return { rough: es.filter(isRoughNight).length, low: low + hit("mood"), anx: hit("anx"), energy: hit("eng"), pcos: pcos + hit("cra") };
}
/** ONE starter experiment for the week, or null when she skipped this week's or one is still running.
    Order: PCOS signals (module on) → walk after lunch; rough nights → wind-down; worry or low mood → breathing;
    low energy → movement; otherwise movement. The one she did last time is passed over when another fits. */
export function pickExperiment({ signals, pcosOn = false, state = EMPTY_EXPERIMENTS, weekKey, todayIso }) {
  const s = settle(state, todayIso);
  if (s.active || s.skip === weekKey) return null;
  const last = (s.past || []).length ? s.past[s.past.length - 1].id : null;
  const g = signals || {};
  const order = [];
  if (pcosOn && g.pcos > 0) order.push("walk-lunch");
  if (g.rough >= 2) order.push("winddown");
  if (g.low + g.anx >= 2) order.push("breathe");
  if (g.energy >= 2) order.push(pcosOn ? "walk-lunch" : "move");
  order.push("move", "breathe");
  const fresh = order.find((id) => id !== last);
  return experimentOf(fresh || order[0]);
}
/** The experiment the review looks back on: the latest past one whose 7 days ended inside [from, to] or later, else null. */
export function lastFinished(state, from) {
  const p = (state?.past || []).filter((x) => addDays(x.start, EXP_DAYS - 1) >= from);
  return p.length ? p[p.length - 1] : null;
}
/** After an experiment: the days she did it against the other days of its 7, for its `watch` outcome, as counts.
    { done: { n, hits }, other: { n, hits }, label } (hits = days with the outcome; only days with a log count).
    Rough nights read the next morning's check-in (the night after the day she did it). */
export function experimentFollowUp(item, { entries = [], moodLog = {}, bodyLog = {} }) {
  const x = experimentOf(item?.id);
  if (!x || !item.start) return null;
  const byDate = new Map((entries || []).map((e) => [e.date, e]));
  const doneSet = new Set(Array.isArray(item.days) ? item.days : []);
  const done = { n: 0, hits: 0 }, other = { n: 0, hits: 0 };
  for (let i = 0; i < EXP_DAYS; i++) {
    const d = addDays(item.start, i), w = x.watch;
    let known = false, hit = false;
    if (w.night) { const e = byDate.get(addDays(d, 1)); if (e && (e.sleepQ || e.sym?.slp != null)) { known = true; hit = isRoughNight(e); } }
    else {
      const e = byDate.get(d), b = bodyDay(bodyLog, d), m = moodLog?.[d];
      if (e && e.sym && (w.ids || []).some((id) => id in e.sym)) { known = true; hit = (w.ids || []).some((id) => (e.sym[id] || 0) >= 2); }
      if (w.pcos && Object.keys(b).length) { known = true; hit = hit || (b.pcos || []).some((p) => w.pcos.includes(p)); }
      if (w.lowMood && Number.isFinite(m?.mood)) { known = true; hit = hit || m.mood <= 2; }
    }
    if (!known) continue;
    const side = doneSet.has(d) ? done : other;
    side.n++; if (hit) side.hits++;
  }
  return { done, other, label: x.watch.label };
}
