/* Home v2 (calm R3): the pure pieces of the Home screen. Imports only pure leaf modules (engine, routes, modules,
   components' EMPTY_LINE is restated here so this file stays free of React). Nothing here reads storage or the network.

   - heroModel(...)      the cycle-day ring at the top: what sits in the middle, the prediction line and its note.
   - Quick log tiles      TILE_CATALOG, DEFAULT_TILES, cleanHomeTiles(v), homeTiles(saved, availableIds), tileLogged(id, ctx).
   - Step rails           bodySteps(ctx), mindSteps(ctx): ticks for what is logged today; untouched steps are neutral.
   - Today's small step   STEPS, smallStep(ctx): one optional, rule-based suggestion with a Why line, or null.
   - Patterns preview     weekTrend(days), sparkPoints(days), cycleBuckets(days, starts, curLen): words, never numbers out of 100.
   - PCOS insight         pcosCycleCand({ on, lens }): the cycle-length pattern question as a Today's insight candidate.
   Tone rules (plan §7): no streaks, grades, scores out of 100, completeness counts or failure words. */
import { fmt, fmtRange, basisLine, periodHead, addDays } from "./engine.js";
import { LOG_ITEMS } from "./routes.js";
import { MODULES, longCycleCount } from "./modules.js";

export const EMPTY_LINE = "A few more logs will show clearer associations.";
const daysBetween = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

/* ---------------- hero ---------------- */
/** The cycle-day ring: { kind, value 0–1, center, sub, line, note, tone, action ("cal" | null) }.
    kind: "preg" | "cycle" | "long" | "meno" | "calm" | "start". value is how far through (never shown as a number). */
export function heroModel({ stage, isMeno = false, pred = null, predWhy = null, pregWeek = 0, tri = "", dueDate = "", lastPeriodIso = null, todayIso, pcosOn = false }) {
  const today = new Date(todayIso + "T12:00:00");
  const calm = { center: String(today.getDate()), sub: today.toLocaleDateString("en-US", { month: "long" }) };
  if (stage === "preg") {
    const left = Math.max(0, 40 - pregWeek);
    return { kind: "preg", value: clamp01(pregWeek / 40), center: `Week ${pregWeek}`, sub: tri ? `${tri} trimester` : "", line: dueDate ? `Due ${dueDate}` : "Your due date", note: left > 0 ? `About ${left} week${left === 1 ? "" : "s"} to go` : "Any day now", tone: "primary", action: null };
  }
  if (isMeno) {
    const n = lastPeriodIso ? daysBetween(lastPeriodIso, todayIso) : null;
    if (n != null && n >= 0 && n <= 365) return { kind: "meno", value: clamp01(n / 365), center: `${n}`, sub: n === 1 ? "day since your last period" : "days since your last period", line: `Last period ${fmt(lastPeriodIso)}`, note: "Log a bleed if one comes; Cyra keeps the count.", tone: "primary", action: "cal" };
    return { kind: "calm", value: 1, ...calm, line: "No period tracking needed", note: "Log how you feel: sleep, hot flashes, mood.", tone: "soft", action: null };
  }
  if (pred) {
    const line = pred.state === "upcoming" ? `Next period likely ${fmtRange(pred.fromIso, pred.toIso)}` : periodHead(pred);
    const note = pcosOn ? MODULES.pcos.cycle.range.text : pred.wide ? "Cycles vary for you — the range is wide on purpose." : basisLine(pred);
    return { kind: "cycle", value: clamp01(pred.cycleDay / Math.max(pred.center || 28, pred.cycleDay)), center: `Day ${pred.cycleDay}`, sub: pred.phase ? `${pred.phase} phase` : "", line, note, tone: "primary", action: "cal" };
  }
  if (predWhy?.kind === "long") {
    const note = pcosOn ? MODULES.pcos.cycle.expected.text : stage === "peri" ? "Long gaps are common in perimenopause." : "Over 120 days, so Cyra won't guess.";
    return { kind: "long", value: 1, center: `Day ${predWhy.days}`, sub: "since your last period", line: `No period on record for ${predWhy.days} days`, note, tone: "soft", action: "cal" };
  }
  return { kind: "start", value: 0, ...calm, line: "Log a period start to see your cycle day", note: "Cyra works with any cycle length.", tone: "soft", action: "cal" };
}

/* ---------------- quick log tiles ---------------- */
/** Every tile Home can show: the "+" sheet's items plus PCOS signals (offered while the PCOS module is on). */
export const TILE_CATALOG = Object.freeze([...LOG_ITEMS, { id: "pcos", label: "PCOS signals", icon: "sparkle", tint: "body" }].map((t) => Object.freeze({ ...t })));
export const TILE_IDS = Object.freeze(TILE_CATALOG.map((t) => t.id));
export const DEFAULT_TILES = Object.freeze(["symptoms", "sleep", "mood", "move"]);
export const TILES_MIN = 2, TILES_MAX = 4;

/** Her saved choice, cleaned: 2–4 distinct known ids in her order, else null (null = Cyra's default set). */
export function cleanHomeTiles(v) {
  if (!Array.isArray(v)) return null;
  const out = [];
  for (const id of v) if (typeof id === "string" && TILE_IDS.includes(id) && !out.includes(id)) out.push(id);
  return out.length >= TILES_MIN && out.length <= TILES_MAX ? out : null;
}

/** The tiles to draw: her choice (or the default) limited to the loggers this stage has, topped up to the minimum
    (to four for the default) from the default order, then the rest of what is available. */
export function homeTiles(saved, availableIds) {
  const avail = TILE_IDS.filter((id) => availableIds.includes(id));
  const mine = cleanHomeTiles(saved);
  const out = (mine || DEFAULT_TILES).filter((id) => avail.includes(id));
  const want = mine ? Math.max(TILES_MIN, Math.min(out.length, TILES_MAX)) : TILES_MAX;
  for (const id of [...DEFAULT_TILES, ...avail]) { if (out.length >= want) break; if (avail.includes(id) && !out.includes(id)) out.push(id); }
  return out.slice(0, TILES_MAX);
}

const anyOn = (o) => !!o && Object.values(o).some((v) => (typeof v === "number" ? v > 0 : !!v));
/** Whether today already has this kind of entry (the tile's "Logged" chip). ctx: { entry, medDay, moveCount, pcosIds }. */
export function tileLogged(id, { entry = null, medDay = null, moveCount = 0, pcosIds = [] } = {}) {
  const sym = entry?.sym || {};
  switch (id) {
    case "symptoms": return anyOn(sym);
    case "period": return !!(entry && (entry.period || entry.flow));
    case "sleep": return !!entry?.sleepQ;
    case "mood": return (entry?.scales?.moodq || 0) > 0 || (sym.mood || 0) > 0;
    case "move": return moveCount > 0;
    case "meds": return anyOn(medDay);
    case "note": return !!entry?.note;
    case "pcos": return pcosIds.some((k) => (sym[k] || 0) > 0);
    default: return false;
  }
}

/* ---------------- step rails ---------------- */
const SLEPT = { good: "Slept well", fair: "So-so", poor: "Rough night" };
/** done flags → states: done, the first not-done step is "current", the rest "todo" (neutral). An optional step
    (opt[i] true, e.g. Movement) is never the one marked next. */
export const railStates = (done, opt = []) => { let cur = false; return done.map((d, i) => (d ? "done" : cur || opt[i] ? "todo" : ((cur = true), "current"))); };
export function bodySteps({ entry = null, moveCount = 0, preg = false } = {}) {
  const nSym = Object.values(entry?.sym || {}).filter((v) => v > 0).length;
  const steps = [
    ...(preg ? [] : [{ label: "Sleep", sub: entry?.sleepQ ? SLEPT[entry.sleepQ] || "Logged" : "Last night", done: !!entry?.sleepQ }]),
    { label: "Movement", sub: moveCount > 0 ? `${moveCount} session${moveCount === 1 ? "" : "s"}` : "Optional", done: moveCount > 0 },
    { label: "Symptoms", sub: entry ? (nSym ? `${nSym} logged` : "None today") : "Today", done: !!entry },
  ];
  const st = railStates(steps.map((s) => s.done), steps.map((s) => s.label === "Movement"));
  return steps.map((s, i) => ({ label: s.label, sub: s.sub, state: st[i] }));
}
export function mindSteps({ moodDone = false, readReady = false } = {}) {
  const steps = [{ label: "Check-in", sub: moodDone ? "Mood logged" : "How you feel", done: moodDone }, { label: "Today's read", sub: readReady ? "Below" : "After check-in", done: readReady }];
  const st = railStates(steps.map((s) => s.done));
  return steps.map((s, i) => ({ label: s.label, sub: s.sub, state: st[i] }));
}

/* ---------------- today's small step ---------------- */
/** Each step: what to try, why (src when it says what a practice does), and an optional action:
    { log: <tile id> } opens that logger, { go: <view id> } a view, { open: "appts" | "journal" } a Home section. */
export const STEPS = Object.freeze({
  energy: Object.freeze({ id: "energy", title: "Log how your energy is", body: "One tap is enough. It doesn't need to be a full check-in.", why: "A short line a day is what lets Cyra show which days tend to feel lighter for you.", action: Object.freeze({ label: "Log it", log: "symptoms" }) }),
  breathe: Object.freeze({ id: "breathe", title: "A 2-minute breathing practice", body: "Breathe in for about 4 counts and out for about 6, for two minutes, whenever suits you today.", why: "After a rough night, slow breathing (around six breaths a minute) is linked with feeling calmer in small studies. Wellbeing support, not treatment.", src: Object.freeze({ title: "How Breath-Control Can Change Your Life: A Systematic Review on Psycho-Physiological Correlates of Slow Breathing", body: "Zaccaro A, Piarulli A, Laurino M, et al. Frontiers in Human Neuroscience 12:353.", year: 2018 }), action: null }),
  pcos: Object.freeze({ id: "pcos", title: "Notice your energy after meals", body: "If an energy dip or cravings show up today, log it. No food logging needed.", why: "Energy crashes after meals and cravings are among the signals the PCOS module keeps next to your cycles, to show your clinician. Associations, not a diagnosis.", src: Object.freeze({ title: MODULES.pcos.evidence[0].title, body: MODULES.pcos.evidence[0].body, year: MODULES.pcos.evidence[0].year }), action: Object.freeze({ label: "Log a signal", log: "symptoms" }) }),
  question: Object.freeze({ id: "question", title: "Note one question for your next visit", body: "Anything you'd like to ask. Cyra keeps it with your appointments.", why: "Questions are easy to forget in the room; writing them down as they come helps.", action: Object.freeze({ label: "Open appointments", open: "appts" }) }),
  note: Object.freeze({ id: "note", title: "Add one line about today", body: "A few words is plenty: what stood out?", why: "A note sits next to the day on your calendar and helps you remember what a lighter or harder day was about.", action: Object.freeze({ label: "Add a note", log: "note" }) }),
  look: Object.freeze({ id: "look", title: "Look back at your week", body: "See what has been showing up lately.", why: "Looking at a week at a time makes slower patterns easier to notice.", action: Object.freeze({ label: "Open Patterns", go: "patterns" }) }),
});
/** One optional suggestion, or null. ctx: { stage, entry, pcosOn, todayIso, skip: { day, id } | null }. Never a streak,
    never "you missed". "Not today" (skip for today) hides it until tomorrow. */
export function smallStep({ stage, entry = null, pcosOn = false, todayIso, skip = null } = {}) {
  if (skip && skip.day === todayIso) return null;
  if (!entry) return STEPS.energy;
  if (stage !== "preg" && entry.sleepQ === "poor") return STEPS.breathe;
  if (pcosOn && stage !== "preg" && !tileLogged("pcos", { entry, pcosIds: PCOS_SIGNAL_IDS })) return STEPS.pcos;
  if (stage === "preg") return STEPS.question;
  if (!entry.note) return STEPS.note;
  return STEPS.look;
}
/** The PCOS symptoms that are also in the main symptom list (so a check-in can log them today). */
export const PCOS_SIGNAL_IDS = Object.freeze(MODULES.pcos.symptoms.filter((s) => s.shared).map((s) => s.id));

/* ---------------- patterns preview ---------------- */
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
export const TREND = Object.freeze({ cur: 7, prevFrom: 28, prevTo: 8, minCur: 3, minPrev: 5, same: 0.04, clear: 0.12 });
/** This week (last 7 days) against her usual (days 8–28 before today), in words. days: oldest → newest
    [{ iso, score|null }] ending today. { kind: "lighter" | "heavier" | "usual" | null, sentence }. */
export function weekTrend(days) {
  const n = days.length;
  const scores = (from, to) => days.slice(Math.max(0, n - from), n - to).map((d) => d.score).filter((s) => s != null);
  const cur = scores(TREND.cur, 0), prev = scores(TREND.prevFrom, TREND.prevTo - 1);
  if (cur.length < TREND.minCur || prev.length < TREND.minPrev) return { kind: null, sentence: EMPTY_LINE };
  const d = mean(cur) - mean(prev);
  if (Math.abs(d) < TREND.same) return { kind: "usual", sentence: "This week felt about like your usual." };
  const kind = d > 0 ? "lighter" : "heavier";
  return { kind, sentence: `This week felt ${Math.abs(d) >= TREND.clear ? "" : "a little "}${kind} than your usual.` };
}
/** The sparkline: a 7-day rolling mean of logged days, as [{ i, v }] (i = day index, v 0–1, higher = lighter). */
export function sparkPoints(days) {
  const out = [];
  days.forEach((_, i) => {
    const w = days.slice(Math.max(0, i - 6), i + 1).map((d) => d.score).filter((s) => s != null);
    if (w.length) out.push({ i, v: mean(w) });
  });
  return out;
}
/* Phases are placed from her own cycle lengths (ovulation about 14 days before the next start), never a fixed 28. */
export const BUCKETS = Object.freeze([
  Object.freeze({ id: "period", label: "Period", where: "around your period" }),
  Object.freeze({ id: "follicular", label: "Follicular", where: "in the follicular phase" }),
  Object.freeze({ id: "ovulation", label: "Ovulation", where: "around ovulation" }),
  Object.freeze({ id: "luteal", label: "Luteal", where: "in the luteal phase" }),
]);
const phaseOfDay = (day, len) => (day <= 5 ? "period" : day < len - 16 ? "follicular" : day <= len - 12 ? "ovulation" : "luteal");
/** By cycle: mean day reading per phase. starts sorted oldest first; curLen the expected length of the running cycle.
    { bars: [{ id, label, v|null, n }], sentence }. A phase needs 2 logged days to be drawn. */
export function cycleBuckets(days, starts, curLen = 28) {
  const acc = Object.fromEntries(BUCKETS.map((b) => [b.id, []]));
  for (const d of days) {
    if (d.score == null) continue;
    let k = -1; for (let j = 0; j < starts.length && starts[j] <= d.iso; j++) k = j;
    if (k < 0) continue;
    const day = daysBetween(starts[k], d.iso) + 1;
    const len = k + 1 < starts.length ? daysBetween(starts[k], starts[k + 1]) : Math.max(curLen || 28, day);
    if (day > len) continue;
    acc[phaseOfDay(day, len)].push(d.score);
  }
  const bars = BUCKETS.map((b) => ({ id: b.id, label: b.label, n: acc[b.id].length, v: acc[b.id].length >= 2 ? mean(acc[b.id]) : null }));
  const have = bars.filter((b) => b.v != null);
  if (have.length < 2) return { bars, sentence: EMPTY_LINE };
  const hi = have.reduce((a, b) => (b.v > a.v ? b : a)), lo = have.reduce((a, b) => (b.v < a.v ? b : a));
  if (hi.v - lo.v < TREND.same) return { bars, sentence: "Your days feel much the same across your cycle so far." };
  const w = (id) => BUCKETS.find((b) => b.id === id).where;
  return { bars, sentence: `Lighter days tend to fall ${w(hi.id)}; heavier ones ${w(lo.id)}.` };
}

/* ---------------- PCOS insight ---------------- */
/** The PCOS "Cycle length" pattern question as a Today's insight candidate (lib/insights.js homePick shape), once two
    cycles are counted. "In your log" wording; long cycles are part of the pattern, never an error. */
export function pcosCycleCand({ on = false, lens = [] } = {}) {
  const m = Array.isArray(lens) ? lens.filter((x) => Number.isFinite(x)).length : 0;
  if (!on || m < 2) return null;
  const n = longCycleCount(lens);
  return {
    key: "pcos:cycle-length", tier: 1, strength: n ? 0.4 : 0.1, fam: null, num: `${n} of ${m}`, homeNum: `${n} of ${m}`,
    homeText: n ? `In your log, ${n} of your last ${m} cycles ran over 35 days.` : `In your log, none of your last ${m} cycles ran over 35 days.`,
  };
}

/* The date eyebrow: "Thursday, October 29". */
export const dateEyebrow = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
export const greeting = (hour) => (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
/* The last bleeding day on record (menopause hero): newest entry with period true or a flow other than spotting. */
export const lastPeriodDay = (sorted) => { for (let i = sorted.length - 1; i >= 0; i--) { const e = sorted[i]; if (e && (e.period || (e.flow && e.flow !== "spot"))) return e.date; } return null; };
export { fmt, addDays };
