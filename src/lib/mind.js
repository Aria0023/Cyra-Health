/* Mind (calm R5, spec §3.5c): the mood check-in, the practices library with the evidence each one rests on, the
   suggestion of "your next practice", the practice log ("Which one helped?") and the cycle-aligned mood strip.
   Pure: no React, storage, network or feature-flag import; it runs on the device and in `node --test`. record.js
   imports it for the clean functions of moodLog, practiceLog and practiceFavs.

   Evidence rule (plan §5, §7): every practice says what the evidence supports, for whom and how strongly, names its
   sources (title, authors and journal, year), and carries "Wellbeing support, not treatment." — or, where no trial
   of the exercise itself was found, "Comfort, not treatment." and an evidence line that says so. No practice claims
   to treat PCOS or any other condition. Every sentence here is listed in docs/EVIDENCE.md and docs/CLINICIAN-REVIEW.md
   (mind.test.mjs fails when one is missing). Sources were checked with web searches on 2026-10-29 (the PubMed
   connector was unavailable in that session); see docs/EVIDENCE.md. */

export const SUPPORT_LINE = "Wellbeing support, not treatment.";
export const COMFORT_LINE = "Comfort, not treatment.";

/* ---------------- the mood check-in ---------------- */
/** The 5-point face row, low → high. Words only; never a score. */
export const MOODS = Object.freeze([
  Object.freeze({ v: 1, label: "Very low" }),
  Object.freeze({ v: 2, label: "Low" }),
  Object.freeze({ v: 3, label: "Okay" }),
  Object.freeze({ v: 4, label: "Good" }),
  Object.freeze({ v: 5, label: "Very good" }),
]);
export const moodLabel = (v) => MOODS.find((m) => m.v === v)?.label || "";
/** Feeling tags (any number). */
export const FEELINGS = Object.freeze([
  Object.freeze({ id: "calm", label: "Calm" }), Object.freeze({ id: "content", label: "Content" }), Object.freeze({ id: "hopeful", label: "Hopeful" }),
  Object.freeze({ id: "tired", label: "Tired" }), Object.freeze({ id: "anxious", label: "Anxious" }),
  Object.freeze({ id: "overwhelmed", label: "Overwhelmed" }), Object.freeze({ id: "irritable", label: "Irritable" }), Object.freeze({ id: "sad", label: "Sad" }),
  Object.freeze({ id: "lonely", label: "Lonely" }), Object.freeze({ id: "restless", label: "Restless" }),
]);
export const FEELING_IDS = Object.freeze(FEELINGS.map((f) => f.id));
export const feelingLabel = (id) => FEELINGS.find((f) => f.id === id)?.label || id;
/** Optional levels, 1–3, in words. */
export const ENERGY_LEVELS = Object.freeze([[1, "Low"], [2, "Some"], [3, "Good"]]);
export const FOG_LEVELS = Object.freeze([[1, "Clear"], [2, "A little"], [3, "Foggy"]]);
export const levelLabel = (levels, v) => (levels.find(([n]) => n === v) || [])[1] || "";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isIso = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const lvl = (v) => (Number.isInteger(v) && v >= 1 && v <= 3 ? v : undefined);

/** One day's check-in, cleaned: { mood?: 1–5, tags?: [ids in FEELINGS order], energy?: 1–3, fog?: 1–3 }; {} when empty. */
export function cleanMoodDay(d) {
  if (!isObj(d)) return {};
  const out = {};
  if (Number.isInteger(d.mood) && d.mood >= 1 && d.mood <= 5) out.mood = d.mood;
  const tags = Array.isArray(d.tags) ? FEELING_IDS.filter((id) => d.tags.includes(id)) : [];
  if (tags.length) out.tags = tags;
  if (lvl(d.energy)) out.energy = d.energy;
  if (lvl(d.fog)) out.fog = d.fog;
  return out;
}
export const MOOD_DAYS_MAX = 1500;
/** moodLog { [iso]: day } in date order, empty days dropped, at most MOOD_DAYS_MAX (newest kept). */
export function cleanMoodLog(raw) {
  if (!isObj(raw)) return {};
  const keys = Object.keys(raw).filter(isIso).sort().slice(-MOOD_DAYS_MAX);
  const out = {};
  for (const k of keys) { const d = cleanMoodDay(raw[k]); if (Object.keys(d).length) out[k] = d; }
  return out;
}
/** The log with `patch` merged into `iso` (a key set to null removes it). A new object; the day goes when it empties. */
export function setMoodDay(log, iso, patch) {
  const cur = { ...(cleanMoodLog(log)[iso] || {}) };
  for (const [k, v] of Object.entries(patch || {})) { if (v === null || v === undefined) delete cur[k]; else cur[k] = v; }
  const day = cleanMoodDay(cur);
  const next = { ...cleanMoodLog(log) };
  if (Object.keys(day).length) next[iso] = day; else delete next[iso];
  return cleanMoodLog(next);
}
/** Toggle one feeling tag on a day. */
export function toggleFeeling(log, iso, id) {
  const tags = (cleanMoodLog(log)[iso]?.tags || []).slice();
  const i = tags.indexOf(id);
  if (i >= 0) tags.splice(i, 1); else if (FEELING_IDS.includes(id)) tags.push(id);
  return setMoodDay(log, iso, { tags: tags.length ? tags : null });
}
/** A short plain line for a day: "Okay · tired, foggy" ("" when nothing). */
export function moodText(day) {
  const d = cleanMoodDay(day);
  const parts = [d.mood ? moodLabel(d.mood) : "", (d.tags || []).slice(0, 2).map((t) => feelingLabel(t).toLowerCase()).join(", ")].filter(Boolean);
  return parts.join(" · ");
}
export const moodDone = (day) => Object.keys(cleanMoodDay(day)).length > 0;

/* ---------------- needs and practices ---------------- */
export const NEEDS = Object.freeze([
  Object.freeze({ id: "calm", label: "Feel calmer", icon: "breath", tint: "mind" }),
  Object.freeze({ id: "worry", label: "Ease worry", icon: "mind", tint: "you" }),
  Object.freeze({ id: "fog", label: "Clear brain fog", icon: "sun", tint: "patterns" }),
  Object.freeze({ id: "energy", label: "Lift low energy", icon: "lightning", tint: "body" }),
  Object.freeze({ id: "rest", label: "Wind down & rest", icon: "moon", tint: "mind" }),
]);
export const NEED_IDS = Object.freeze(NEEDS.map((n) => n.id));
export const needLabel = (id) => NEEDS.find((n) => n.id === id)?.label || "";

const S = (title, body, year) => Object.freeze({ title, body, year });
export const SOURCES = Object.freeze({
  zaccaro2018: S("How Breath-Control Can Change Your Life: A Systematic Review on Psycho-Physiological Correlates of Slow Breathing", "Zaccaro A, Piarulli A, Laurino M, et al. Frontiers in Human Neuroscience 12:353.", 2018),
  fincham2023: S("Effect of breathwork on stress and mental health: a meta-analysis of randomised-controlled trials", "Fincham GW, Strauss C, Montero-Marin J, Cavanagh K. Scientific Reports 13:432.", 2023),
  balban2023: S("Brief structured respiration practices enhance mood and reduce physiological arousal", "Balban MY, Neri E, Kogon MM, et al. Cell Reports Medicine 4(1):100895.", 2023),
  schumer2018: S("Brief mindfulness training for negative affectivity: a systematic review and meta-analysis", "Schumer MC, Lindsay EK, Creswell JD. Journal of Consulting and Clinical Psychology 86(7).", 2018),
  nice2022: S("Depression in adults: treatment and management (NG222)", "National Institute for Health and Care Excellence (NICE) guideline.", 2022),
  ekers2014: S("Behavioural activation for depression; an update of meta-analysis of effectiveness and sub group analysis", "Ekers D, Webster L, Van Straten A, et al. PLoS One 9(6):e100100.", 2014),
  loy2013: S("The effect of a single bout of exercise on energy and fatigue states: a systematic review and meta-analysis", "Loy BD, O'Connor PJ, Dishman RK. Fatigue: Biomedicine, Health & Behavior 1(4):223–242.", 2013),
  chang2012: S("The effects of acute exercise on cognitive performance: a meta-analysis", "Chang YK, Labban JD, Gapin JI, Etnier JL. Brain Research 1453:87–101.", 2012),
  khir2024: S("Efficacy of Progressive Muscle Relaxation in Adults for Stress, Anxiety, and Depression: A Systematic Review", "Muhammad Khir S, et al. Psychology Research and Behavior Management 17:345–365.", 2024),
  edinger2021: S("Behavioral and psychological treatments for chronic insomnia disorder in adults: an American Academy of Sleep Medicine clinical practice guideline", "Edinger JD, Arnedt JT, Bertisch SM, et al. Journal of Clinical Sleep Medicine 17(2):255–262.", 2021),
  davis2016: S("Thankful for the little things: a meta-analysis of gratitude interventions", "Davis DE, Choe E, Meyers J, et al. Journal of Counseling Psychology 63(1):20–31.", 2016),
  cregg2021: S("Gratitude Interventions: Effective Self-help? A Meta-analysis of the Impact on Symptoms of Depression and Anxiety", "Cregg DR, Cheavens JS. Journal of Happiness Studies 22(1), doi 10.1007/s10902-020-00236-6.", 2021),
});

/* Strength words (never a grade): "moderate" = several randomised trials or a guideline; "modest" = reviews find small
   effects or mixed results; "limited" = few or small studies; "comfort" = no trial of the exercise itself. */
export const STRENGTH = Object.freeze({ moderate: "Moderate evidence", modest: "Modest evidence", limited: "Limited evidence", comfort: "Offered as comfort" });

const breath = (inS, holdIn, outS, holdOut) => Object.freeze([
  Object.freeze({ phase: "in", s: inS }), ...(holdIn ? [Object.freeze({ phase: "hold", s: holdIn })] : []),
  Object.freeze({ phase: "out", s: outS }), ...(holdOut ? [Object.freeze({ phase: "rest", s: holdOut })] : []),
]);
const step = (text, s) => Object.freeze({ text, s });

/** The library. kind "breath": `pattern` repeats for `min` minutes; kind "steps": each step shows for its seconds.
    free: in the free plan (the rest need plan.js can("fullPractices")). caution: shown before Start when present. */
export const PRACTICES = Object.freeze([
  Object.freeze({
    id: "slow", title: "Slow breathing", short: "In for 4, out for 6: about six breaths a minute.", min: 3, kind: "breath", needs: ["calm", "rest"], free: true, icon: "breath",
    pattern: breath(4, 0, 6, 0),
    evidence: "Breathing at around six breaths a minute is linked with a calmer body (higher heart-rate variability) and calmer mood in healthy adults; trials of breathwork show small-to-medium drops in stress. Most studies are small.",
    strength: "moderate", src: ["zaccaro2018", "fincham2023"], line: SUPPORT_LINE,
  }),
  Object.freeze({
    id: "box", title: "Box breathing", short: "In 4, hold 4, out 4, hold 4.", min: 3, kind: "breath", needs: ["calm"], free: false, icon: "breath",
    pattern: breath(4, 4, 4, 4),
    evidence: "In a one-month randomised trial with healthy adults, five minutes a day of structured breathing, box breathing among them, lifted mood; practices with a long, slow out-breath did best.",
    strength: "limited", src: ["balban2023"], line: SUPPORT_LINE, caution: "If holding your breath feels uncomfortable, skip the holds and just breathe slowly.",
  }),
  Object.freeze({
    id: "ground", title: "5-4-3-2-1 grounding", short: "Name what you notice with each sense.", min: 2, kind: "steps", needs: ["worry"], free: true, icon: "sun",
    steps: Object.freeze([step("Look around. Name five things you can see.", 25), step("Notice four things you can feel: your feet, your clothes, the chair.", 25), step("Listen for three things you can hear.", 25), step("Find two things you can smell, or two scents you like.", 20), step("Notice one thing you can taste, or take a sip of water.", 15), step("Take one slow breath out. You're here.", 10)]),
    evidence: "A widely used way to bring attention back to the present. We found no controlled trials of this exact exercise, so it is offered as a comfort.",
    strength: "comfort", src: [], line: COMFORT_LINE,
  }),
  Object.freeze({
    id: "reframe", title: "Reframe one thought", short: "Catch a worry, look at it, find a kinder way to see it.", min: 4, kind: "steps", needs: ["worry"], free: false, icon: "note",
    steps: Object.freeze([step("Name the thought that keeps coming back, in a few words.", 40), step("What makes it feel true? What doesn't quite fit?", 50), step("What would you say to a friend who had this thought?", 50), step("Try a more balanced version of it. It doesn't need to be positive, just fair.", 50), step("Notice how strongly you believe the first thought now.", 30)]),
    evidence: "Noticing and re-weighing thoughts is a core skill of cognitive behavioural therapy (CBT). NICE recommends guided self-help based on CBT as a first option for less severe depression. This short exercise is one piece of that, not a full course.",
    strength: "moderate", src: ["nice2022"], line: SUPPORT_LINE,
  }),
  Object.freeze({
    id: "pause", title: "Three-minute pause", short: "Breath, body, then the room: a short mindful reset.", min: 3, kind: "steps", needs: ["worry", "fog"], free: false, icon: "mind",
    steps: Object.freeze([step("Sit comfortably. Notice what's on your mind right now, without changing it.", 60), step("Bring your attention to your breathing. Follow a few breaths in and out.", 60), step("Widen your attention to your whole body, then to the sounds around you.", 60)]),
    evidence: "Reviews of brief mindfulness training find a small easing of stress, worry and low mood compared with control activities; the effect is modest and some studies may be unpublished.",
    strength: "modest", src: ["schumer2018"], line: SUPPORT_LINE,
  }),
  Object.freeze({
    id: "step", title: "One small step", short: "Pick one small thing that matters to you and do it now.", min: 3, kind: "steps", needs: ["energy"], free: true, icon: "arrow-right",
    steps: Object.freeze([step("Think of one small thing you've been putting off or would enjoy: a text, a tidy shelf, stepping outside.", 40), step("Make it smaller still, something you could do in the next few minutes.", 30), step("Do it now. Take your time.", 90), step("Notice how you feel afterwards, even if it's only a little different.", 20)]),
    evidence: "Behavioural activation, scheduling small rewarding or meaningful activities, reduced symptoms of depression in randomised trials; many trials were of modest quality. Here it is one small step, not a programme.",
    strength: "moderate", src: ["ekers2014"], line: SUPPORT_LINE,
  }),
  Object.freeze({
    id: "move", title: "Five-minute movement break", short: "March, stretch or walk gently for five minutes.", min: 5, kind: "steps", needs: ["energy", "fog"], free: true, icon: "move",
    steps: Object.freeze([step("Stand up, or stay seated if standing makes you dizzy. Roll your shoulders back five times.", 45), step("March on the spot or walk around the room at an easy pace.", 90), step("Reach your arms up, then gently to each side.", 45), step("Keep walking or marching, a little brisker if it feels good.", 90), step("Slow down. Notice your breathing and how your head feels.", 30)]),
    evidence: "A single bout of exercise raised feelings of energy in most trials, and short bouts of exercise give a small, short-lived boost to attention and thinking. Effects are small.",
    strength: "moderate", src: ["loy2013", "chang2012"], line: SUPPORT_LINE, caution: "Keep it gentle. Sit down and stop if you feel dizzy, short of breath or unwell.",
  }),
  Object.freeze({
    id: "gratitude", title: "Three good things", short: "Bring to mind three things that went well, however small.", min: 3, kind: "steps", needs: ["energy"], free: false, icon: "heart",
    steps: Object.freeze([step("Think of one thing that went well today or recently, however small.", 50), step("A second thing. What made it good?", 50), step("A third. Who or what helped it happen?", 50), step("Stay with the feeling for a moment.", 30)]),
    evidence: "Reviews find gratitude exercises give a small lift to wellbeing at most, and little change in low mood or anxiety compared with other activities. Offered as a comfort.",
    strength: "comfort", src: ["davis2016", "cregg2021"], line: COMFORT_LINE,
  }),
  Object.freeze({
    id: "pmr", title: "Short muscle relaxation", short: "Tense, then release, one area at a time.", min: 4, kind: "steps", needs: ["rest"], free: false, icon: "body",
    steps: Object.freeze([step("Make fists and squeeze for five seconds. Let go and feel the difference.", 30), step("Lift your shoulders to your ears, hold, then let them drop.", 30), step("Scrunch your face gently, hold, then soften your jaw and forehead.", 30), step("Press your feet into the floor and tense your legs, hold, then release.", 30), step("Tense your belly and back gently, hold, then let go.", 30), step("Now let your whole body be heavy. Breathe out slowly a few times.", 60)]),
    evidence: "Progressive muscle relaxation reduced stress, anxiety and low mood in adults across many studies, often alongside other approaches; study quality varies.",
    strength: "modest", src: ["khir2024"], line: SUPPORT_LINE, caution: "Skip any area that hurts, and tense gently.",
  }),
  Object.freeze({
    id: "scan", title: "Body scan", short: "Move your attention slowly from your feet to your head.", min: 5, kind: "steps", needs: ["rest"], free: false, icon: "body",
    steps: Object.freeze([step("Lie or sit comfortably. Let your breathing settle on its own.", 40), step("Notice your feet and legs: warmth, weight, tingling, or nothing at all.", 60), step("Move up to your hips, belly and back. Let them soften if they want to.", 60), step("Notice your hands, arms and shoulders.", 50), step("Notice your neck, jaw, face and head.", 50), step("Feel your whole body breathing for a few breaths.", 40)]),
    evidence: "The body scan is one of the brief mindfulness practices; reviews of brief mindfulness training find a small easing of stress and low mood, a modest effect.",
    strength: "modest", src: ["schumer2018"], line: SUPPORT_LINE,
  }),
  Object.freeze({
    id: "winddown", title: "Bed is for sleep", short: "Stimulus control: a short plan for tonight.", min: 2, kind: "steps", needs: ["rest"], free: true, icon: "moon",
    steps: Object.freeze([step("Tonight, go to bed only when you feel sleepy, not just tired.", 20), step("Keep the bed for sleep and intimacy: no scrolling, work or worrying there.", 20), step("If you can't sleep after about 20 minutes, get up and do something quiet in dim light. Go back when sleepy.", 30), step("Get up at the same time tomorrow, however the night went.", 20), step("Settle with a few slow breaths: in for 4, out for 6.", 30)]),
    evidence: "Stimulus control is one of the parts of cognitive behavioural therapy for insomnia (CBT-I); the American Academy of Sleep Medicine suggests it for adults with chronic insomnia. The full multi-part CBT-I is recommended most strongly.",
    strength: "moderate", src: ["edinger2021"], line: SUPPORT_LINE,
  }),
]);
export const PRACTICE_IDS = Object.freeze(PRACTICES.map((p) => p.id));
export const practiceOf = (id) => PRACTICES.find((p) => p.id === id) || null;
export const FREE_PRACTICES = Object.freeze(PRACTICES.filter((p) => p.free).map((p) => p.id));
/** Practices for one need, in library order. */
export const practicesFor = (need) => PRACTICES.filter((p) => p.needs.includes(need));
/** Whether a practice can be started on this plan (canFull = plan.js can("fullPractices")). */
export const unlocked = (p, canFull = false) => !!p && (p.free || !!canFull);
/** The named sources of a practice, as { title, body, year }. */
export const sourcesOf = (p) => (p?.src || []).map((k) => SOURCES[k]).filter(Boolean);

/** Seconds a practice runs: breath = whole cycles that fit in `min` minutes; steps = the sum of the steps. */
export function practiceSeconds(p) {
  if (!p) return 0;
  if (p.kind === "breath") { const cyc = p.pattern.reduce((a, x) => a + x.s, 0); return Math.max(1, Math.round((p.min * 60) / cyc)) * cyc; }
  return p.steps.reduce((a, x) => a + x.s, 0);
}
export const PHASE_WORDS = Object.freeze({ in: "Breathe in", hold: "Hold", out: "Breathe out", rest: "Hold" });
/** Where a run is at `t` seconds: breath → { phase, word, left (s in this phase), idx, cycle, total };
    steps → { idx, text, left, total }. done: true at or after the end. */
export function practiceAt(p, t) {
  const total = practiceSeconds(p);
  const time = Math.max(0, t);
  if (time >= total) return { done: true, total, idx: -1, left: 0 };
  if (p.kind === "breath") {
    const cyc = p.pattern.reduce((a, x) => a + x.s, 0);
    let r = time % cyc, idx = 0;
    while (r >= p.pattern[idx].s) { r -= p.pattern[idx].s; idx++; }
    const ph = p.pattern[idx];
    return { done: false, total, idx, phase: ph.phase, word: PHASE_WORDS[ph.phase], left: Math.ceil(ph.s - r), dur: ph.s, cycle: Math.floor(time / cyc) };
  }
  let r = time, idx = 0;
  while (r >= p.steps[idx].s) { r -= p.steps[idx].s; idx++; }
  return { done: false, total, idx, text: p.steps[idx].text, left: Math.ceil(p.steps[idx].s - r), dur: p.steps[idx].s };
}

/* ---------------- practice log and favourites ---------------- */
export const RUNS_MAX = 400;
export const HELPED = Object.freeze(["yes", "no"]);
/** practiceLog: [{ id, day, sec, done, helped? }] oldest first, at most RUNS_MAX (newest kept). id: a run id; p: practice id. */
export function cleanPracticeLog(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const r of raw) {
    if (!isObj(r) || typeof r.id !== "string" || !r.id || r.id.length > 40 || !PRACTICE_IDS.includes(r.p) || !isIso(r.day)) continue;
    const x = { id: r.id, p: r.p, day: r.day, sec: Number.isInteger(r.sec) && r.sec >= 0 && r.sec <= 3600 ? r.sec : 0, done: r.done === true };
    if (HELPED.includes(r.helped)) x.helped = r.helped;
    out.push(x);
  }
  return out.slice(-RUNS_MAX);
}
/** The log with one more run. */
export function addRun(log, { id, p, day, sec = 0, done = false }) {
  return cleanPracticeLog([...cleanPracticeLog(log), { id, p, day, sec: Math.round(sec), done }]);
}
/** The log with `helped` ("yes" | "no" | null) set on run `id`. */
export function setHelped(log, id, helped) {
  return cleanPracticeLog(cleanPracticeLog(log).map((r) => {
    if (r.id !== id) return r;
    const { helped: _old, ...rest } = r; // eslint-disable-line no-unused-vars
    return HELPED.includes(helped) ? { ...rest, helped } : rest;
  }));
}
/** Today's runs, one per practice (its latest run), newest last. */
export function runsOn(log, iso) {
  const by = new Map();
  for (const r of cleanPracticeLog(log)) if (r.day === iso) by.set(r.p, r);
  return [...by.values()];
}
/** Practice ids she marked "helped" at least once, most recent first. */
export function helpedIds(log) {
  const seen = [];
  for (const r of cleanPracticeLog(log).slice().reverse()) if (r.helped === "yes" && !seen.includes(r.p)) seen.push(r.p);
  return seen;
}
export const FAVS_MAX = PRACTICES.length;
export const cleanPracticeFavs = (raw) => (Array.isArray(raw) ? PRACTICE_IDS.filter((id) => raw.includes(id)) : []);
export const toggleFav = (favs, id) => { const f = cleanPracticeFavs(favs); return cleanPracticeFavs(f.includes(id) ? f.filter((x) => x !== id) : [...f, id]); };

/* ---------------- your next practice ---------------- */
/** The need today's check-in points to, with the plain reason. hour: local hour (0–23). Order: wind-down late in the
    evening, then brain fog, worry, low mood, low energy, otherwise calm. */
export function needFrom(day, hour = 12) {
  const d = cleanMoodDay(day);
  const tags = d.tags || [];
  if (hour >= 21 || hour < 4) return { need: "rest", why: "It's late: something to help you wind down." };
  if (d.fog === 3) return { need: "fog", why: "You said your head feels foggy." };
  if (tags.some((t) => ["anxious", "overwhelmed", "restless"].includes(t))) return { need: "worry", why: "You said you're feeling on edge." };
  if ((d.mood && d.mood <= 2) || tags.some((t) => ["sad", "lonely"].includes(t))) return { need: "low", why: "You said your mood is low today." };
  if (d.energy === 1 || tags.includes("tired")) return { need: "energy", why: "You said your energy is low." };
  return { need: "calm", why: d.mood ? "A short practice for whenever suits you today." : "Check in above and Heard Health will pick one for how you feel." };
}
/* Low mood leads with one small step (behavioural activation); otherwise the need's own list. */
const ORDER = { low: ["step", "move", "slow"], energy: ["move", "step", "slow"], fog: ["move", "pause", "slow"], worry: ["ground", "reframe", "pause", "slow"], rest: ["winddown", "slow", "pmr", "scan"], calm: ["slow", "box", "ground"] };
/** { practice, need, why }: the first unlocked practice for today's need, preferring one she said helped before. */
export function nextPractice({ day = null, hour = 12, log = [], canFull = false } = {}) {
  const { need, why } = needFrom(day, hour);
  const list = ORDER[need].map(practiceOf).filter((p) => unlocked(p, canFull));
  const helped = helpedIds(log);
  const pick = list.find((p) => helped.includes(p.id)) || list[0] || practiceOf("slow");
  return { practice: pick, need: need === "low" ? "energy" : need, why };
}

/* ---------------- mood across the cycle ---------------- */
/** The last `n` days ending today: [{ iso, mood|null, tags, cd|null, start }], cd = cycle day from her starts (sorted
    ascending). Words and faces only; nothing is averaged into a score. */
export function moodStrip(moodLog, starts = [], todayIso, n = 35) {
  const log = cleanMoodLog(moodLog);
  const out = [];
  const t0 = new Date(todayIso + "T12:00:00");
  const ss = (Array.isArray(starts) ? starts : []).filter(isIso).slice().sort();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(t0); d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    let st = null; for (const s of ss) if (s <= iso) st = s;
    const cd = st ? Math.round((new Date(iso + "T12:00:00") - new Date(st + "T12:00:00")) / 86400000) + 1 : null;
    out.push({ iso, mood: log[iso]?.mood ?? null, tags: log[iso]?.tags || [], cd, start: ss.includes(iso) });
  }
  return out;
}
/** A plain sentence about the strip, or the empty line while fewer than 5 check-ins are in it. */
export const STRIP_MIN = 5;
export function stripSentence(strip, emptyLine) {
  const got = strip.filter((d) => d.mood != null);
  if (got.length < STRIP_MIN) return emptyLine;
  const low = got.filter((d) => d.mood <= 2), high = got.filter((d) => d.mood >= 4);
  return `${got.length} check-ins in the last ${strip.length} days: ${high.length} lighter, ${low.length} lower, the rest in between.`;
}

const isoAdd = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const CYCLE_ROW_MAX = 45;
/** Mood lined up by cycle day: up to `rows` cycles (newest first), each { key, label, start, days: [{ cd, iso, mood }] } with
    one cell per cycle day from day 1 to the day before the next start (today for the running one), at most CYCLE_ROW_MAX.
    Without cycle starts (pregnancy, menopause, nothing logged yet) one row of the last 35 days ("Last 5 weeks"). */
export function moodByCycle(moodLog, starts = [], todayIso, rows = 3) {
  const log = cleanMoodLog(moodLog);
  const ss = (Array.isArray(starts) ? starts : []).filter((s) => isIso(s) && s <= todayIso).slice().sort();
  if (!ss.length) {
    const days = moodStrip(log, [], todayIso, 35).map((d, i) => ({ cd: i + 1, iso: d.iso, mood: d.mood }));
    return [{ key: "recent", label: "Last 5 weeks", start: days[0].iso, days }];
  }
  const out = [];
  for (let k = ss.length - 1; k >= 0 && out.length < rows; k--) {
    const start = ss[k];
    const end = k + 1 < ss.length ? isoAdd(ss[k + 1], -1) : todayIso;
    const days = [];
    for (let cd = 1, iso = start; iso <= end && cd <= CYCLE_ROW_MAX; cd++, iso = isoAdd(iso, 1)) days.push({ cd, iso, mood: log[iso]?.mood ?? null });
    out.push({ key: start, label: out.length === 0 ? "This cycle" : out.length === 1 ? "Last cycle" : "The cycle before", start, days });
  }
  return out;
}
/** Plain words for one row (no averages): "6 check-ins: 2 lighter, 1 lower." or "No check-ins in this cycle yet." */
export function rowWords(row) {
  const got = row.days.filter((d) => d.mood != null);
  if (!got.length) return "No check-ins yet.";
  const hi = got.filter((d) => d.mood >= 4).length, lo = got.filter((d) => d.mood <= 2).length;
  return `${got.length} check-in${got.length === 1 ? "" : "s"}: ${hi} lighter, ${lo} lower.`;
}
