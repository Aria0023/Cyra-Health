/* The pseudonymized summary Cyra's AI features send (calm R8, plan §7 "AI"). Pure: no React, storage, network or
   feature-flag import; it runs on the device and in `node --test`.

   buildSummary() turns her on-device record into counts and averages over the last SUMMARY_WEEKS weeks, and nothing
   else. It is built from fixed vocabularies only: every text value in it is a label from one of Cyra's own lists
   (life stages, the symptom libraries, feeling tags, PCOS chips, lab names and units, experiment titles). By
   construction it never contains:
     - a date, a weekday or a time (cycles are lengths in days; "currentCycleDay" is a count; the window is in weeks);
     - a note, the day note, the journal, a Connect entry, an appointment, a medicine name or any text she typed;
     - her name, email, ZIP, age band, due date, account or any registration answer (it is never given regAnswers or acct);
     - lab dates (a lab value appears only when she ticks "Include lab values", as the latest value per kind, rounded);
     - weight, fertility signs (cervical mucus, ovulation tests, temperature), the POTS log, wearable readings.
   checkSummary() proves it before every send: every key path must be on SUMMARY_PATHS, every text value must be in
   SUMMARY_VOCAB, every number finite and 0–1000, and the JSON must hold nothing date-, email- or ZIP-shaped. App.jsx
   refuses to send a summary checkSummary() finds a problem with (it cannot happen with this builder).
   The same object is shown verbatim in "What Cyra will send" and sent as is (JSON.stringify of the shown object). */
import { cycleStarts, cycleSpans, isRoughNight, addDays, daysBetween } from "./engine.js";
import { ALL_SYM, GSYM } from "./constants.js";
import { PCOS_DAY, LAB_KINDS, GLUCOSE_UNITS, HBA1C_UNITS, WAIST_UNITS, cleanBodyLog, cleanLabs } from "./bodylog.js";
import { FEELINGS, MOODS, cleanMoodLog } from "./mind.js";
import { EXPERIMENTS, EXP_DAYS, experimentOf } from "./experiments.js";

export const SUMMARY_KIND = "cyra-summary";
export const SUMMARY_VERSION = 1;
export const SUMMARY_WEEKS = 8;
export const TOP_SYMPTOMS = 8;
export const TOP_FEELINGS = 5;
export const CYCLES_MAX = 6;
export const QUESTION_MAX = 500;
export const HISTORY_MAX = 6; // chat: the last 3 exchanges at most
export const HISTORY_TEXT_MAX = 1200;

/** Life-stage labels (the only stage words the summary uses). */
export const LIFE_STAGES = Object.freeze(["My Cycle", "Trying to conceive", "Pregnancy", "Perimenopause", "Menopause"]);
export const lifeStageOf = (stage, stageName) => (stage === "preg" ? "Pregnancy" : stage === "peri" ? (stageName === "Menopause" ? "Menopause" : "Perimenopause") : stageName === "Trying to Conceive" ? "Trying to conceive" : "My Cycle");

/** Cycle-day buckets: [key, first day, last day, plain words]. */
export const BUCKETS = Object.freeze([
  ["cd1to5", 1, 5, "cycle days 1–5"], ["cd6to12", 6, 12, "cycle days 6–12"], ["cd13to19", 13, 19, "cycle days 13–19"],
  ["cd20to28", 20, 28, "cycle days 20–28"], ["cd29plus", 29, 120, "cycle day 29 on"],
]);
const bucketOf = (cd) => (BUCKETS.find(([, a, b]) => cd >= a && cd <= b) || [null])[0];
const MOOD_KEYS = Object.freeze(["veryLow", "low", "okay", "good", "veryGood"]);

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const r1 = (n) => Math.round(n * 10) / 10;
const LAB_ROUND = Object.freeze({ "mg/dL": 0, "mmol/L": 1, "%": 1, "mmol/mol": 0, cm: 0, in: 0 });
const roundTo = (n, dp) => (dp ? Math.round(n * 10 ** dp) / 10 ** dp : Math.round(n));

/** Every text value a summary may hold. */
export const SUMMARY_VOCAB = Object.freeze(new Set([
  SUMMARY_KIND, ...LIFE_STAGES, ...Object.values(ALL_SYM), ...Object.values(GSYM), ...PCOS_DAY.map((x) => x.label),
  ...FEELINGS.map((f) => f.label), ...Object.values(LAB_KINDS).map((k) => k.label), ...GLUCOSE_UNITS, ...HBA1C_UNITS, ...WAIST_UNITS,
  ...EXPERIMENTS.map((x) => x.title), "running", "finished",
]));

/** Every key path a summary may hold ("[]" stands for any array index). */
export const SUMMARY_PATHS = Object.freeze(new Set([
  "kind", "version", "lifeStage", "weeks", "daysLogged",
  "cycles", "cycles.lengthsInDays", "cycles.lengthsInDays[]", "cycles.currentCycleDay", "cycles.longerThan35Days",
  "daysLoggedByCycleDay", ...BUCKETS.map(([k]) => `daysLoggedByCycleDay.${k}`),
  "symptoms", "symptoms[]", "symptoms[].name", "symptoms[].days", "symptoms[].moderateOrStrongDays", "symptoms[].byCycleDay", ...BUCKETS.map(([k]) => `symptoms[].byCycleDay.${k}`),
  "sleep", "sleep.nightsWithHours", "sleep.averageHours", "sleep.roughNights",
  "movement", "movement.sessionsPerWeek", "movement.minutesPerWeek",
  "mood", "mood.checkIns", "mood.days", ...MOOD_KEYS.map((k) => `mood.days.${k}`), "mood.lowEnergyDays", "mood.foggyDays",
  "mood.feelings", "mood.feelings[]", "mood.feelings[].name", "mood.feelings[].days",
  "pcosSignals", "pcosSignals[]", "pcosSignals[].name", "pcosSignals[].days",
  "labs", "labs[]", "labs[].name", "labs[].value", "labs[].unit",
  "experiment", "experiment.name", "experiment.daysDone", "experiment.target", "experiment.status",
]));

/**
 * The summary. Every input is optional; anything unreadable counts as nothing logged.
 * @param {{ stage: string, stageName: string, entries: Array, bodyLog: Object, moodLog: Object, labs: Array,
 *   includeLabs: boolean, pcosOn: boolean, experiments: Object, todayIso: string }} input
 */
export function buildSummary({ stage = "periods", stageName = "", entries = [], bodyLog = {}, moodLog = {}, labs = [], includeLabs = false, pcosOn = false, experiments = null, todayIso } = {}) {
  const today = typeof todayIso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(todayIso) ? todayIso : null;
  const life = lifeStageOf(stage, stageName);
  const out = { kind: SUMMARY_KIND, version: SUMMARY_VERSION, lifeStage: life, weeks: SUMMARY_WEEKS, daysLogged: 0 };
  if (!today) return out;
  const from = addDays(today, -(SUMMARY_WEEKS * 7 - 1));
  const inW = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= from && d <= today;
  const labels = stage === "preg" ? GSYM : ALL_SYM;
  const sorted = (Array.isArray(entries) ? entries : []).filter((e) => isObj(e) && typeof e.date === "string").slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const win = sorted.filter((e) => inW(e.date));
  out.daysLogged = new Set(win.map((e) => e.date)).size;

  // Cycles (not in pregnancy or menopause): lengths in days, today's cycle day, cycle-day buckets.
  const cyclesHere = stage !== "preg" && life !== "Menopause";
  let starts = [];
  if (cyclesHere) {
    starts = cycleStarts(sorted.filter((e) => e.date <= today));
    const lens = cycleSpans(starts).filter((s) => s.counted).map((s) => s.len).slice(-CYCLES_MAX);
    const last = starts.length ? starts[starts.length - 1] : null;
    const cd = last ? daysBetween(last, today) + 1 : null;
    out.cycles = { lengthsInDays: lens, currentCycleDay: cd != null && cd >= 1 && cd <= 120 ? cd : null };
    if (pcosOn) out.cycles.longerThan35Days = lens.filter((n) => n > 35).length;
  }
  const cdOf = (iso) => { let s = null; for (const st of starts) { if (st <= iso) s = st; else break; } if (!s) return null; const n = daysBetween(s, iso) + 1; return n >= 1 && n <= 120 ? n : null; };
  if (cyclesHere && starts.length) {
    const b = Object.fromEntries(BUCKETS.map(([k]) => [k, 0]));
    for (const e of win) { const k = bucketOf(cdOf(e.date)); if (k) b[k]++; }
    out.daysLoggedByCycleDay = b;
  }

  // Symptoms: library labels only (an id no library names is left out), days logged, moderate-or-strong days, by bucket.
  const sym = new Map();
  for (const e of win) {
    if (!isObj(e.sym)) continue;
    const k = cyclesHere && starts.length ? bucketOf(cdOf(e.date)) : null;
    for (const [id, sev] of Object.entries(e.sym)) {
      if (!Object.prototype.hasOwnProperty.call(labels, id) || !Number.isInteger(sev) || sev < 1 || sev > 3) continue;
      const row = sym.get(id) || { name: labels[id], days: 0, moderateOrStrongDays: 0, ...(cyclesHere && starts.length ? { byCycleDay: Object.fromEntries(BUCKETS.map(([b]) => [b, 0])) } : {}) };
      row.days++; if (sev >= 2) row.moderateOrStrongDays++;
      if (k && row.byCycleDay) row.byCycleDay[k]++;
      sym.set(id, row);
    }
  }
  const order = Object.keys(labels);
  out.symptoms = [...sym.entries()].sort((a, b) => b[1].days - a[1].days || order.indexOf(a[0]) - order.indexOf(b[0])).slice(0, TOP_SYMPTOMS).map(([, r]) => r);

  // Sleep and movement (the fast log), rough nights (the check-in's "Last night").
  const body = cleanBodyLog(bodyLog);
  const hrs = [], moves = [];
  for (const [d, v] of Object.entries(body)) { if (!inW(d)) continue; if (v.sleepH != null) hrs.push(v.sleepH); for (const m of v.move || []) moves.push(m.min); }
  out.sleep = { nightsWithHours: hrs.length, averageHours: hrs.length ? r1(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null, roughNights: win.filter(isRoughNight).length };
  out.movement = { sessionsPerWeek: r1(moves.length / SUMMARY_WEEKS), minutesPerWeek: Math.round(moves.reduce((a, b) => a + b, 0) / SUMMARY_WEEKS) };

  // Mood check-ins (Mind): days per mood word, low-energy and foggy days, the most-used feeling tags.
  const mood = cleanMoodLog(moodLog);
  const mdays = Object.entries(mood).filter(([d]) => inW(d)).map(([, v]) => v);
  const byMood = Object.fromEntries(MOOD_KEYS.map((k) => [k, 0]));
  const feel = new Map();
  for (const v of mdays) {
    if (Number.isInteger(v.mood) && v.mood >= 1 && v.mood <= MOODS.length) byMood[MOOD_KEYS[v.mood - 1]]++;
    for (const t of v.tags || []) { const f = FEELINGS.find((x) => x.id === t); if (f) feel.set(f.label, (feel.get(f.label) || 0) + 1); }
  }
  out.mood = {
    checkIns: mdays.length, days: byMood,
    lowEnergyDays: mdays.filter((v) => v.energy === 1).length, foggyDays: mdays.filter((v) => v.fog === 3).length,
    feelings: [...feel.entries()].sort((a, b) => b[1] - a[1] || FEELINGS.findIndex((f) => f.label === a[0]) - FEELINGS.findIndex((f) => f.label === b[0])).slice(0, TOP_FEELINGS).map(([name, days]) => ({ name, days })),
  };

  // PCOS signals (only with the PCOS module on): chip labels and day counts.
  if (pcosOn) {
    const cnt = new Map();
    for (const [d, v] of Object.entries(body)) { if (!inW(d)) continue; for (const id of v.pcos || []) { const c = PCOS_DAY.find((x) => x.id === id); if (c) cnt.set(c.id, (cnt.get(c.id) || 0) + 1); } }
    out.pcosSignals = PCOS_DAY.filter((c) => cnt.has(c.id)).map((c) => ({ name: c.label, days: cnt.get(c.id) }));
  }

  // Lab values: only when she ticks "Include lab values"; the latest per kind, rounded, never its date.
  if (includeLabs === true) {
    const seen = new Set(), rows = [];
    for (const x of cleanLabs(labs)) {
      if (seen.has(x.kind)) continue; seen.add(x.kind);
      rows.push([x.kind, { name: LAB_KINDS[x.kind].label, value: roundTo(x.value, LAB_ROUND[x.unit] ?? 0), unit: x.unit }]);
    }
    const kinds = Object.keys(LAB_KINDS);
    out.labs = rows.sort((a, b) => kinds.indexOf(a[0]) - kinds.indexOf(b[0])).map(([, r]) => r);
  }

  // The weekly experiment: the running one, or the last one that started inside the window.
  const ex = isObj(experiments) ? experiments : null;
  const act = ex && isObj(ex.active) && experimentOf(ex.active.id) ? ex.active : null;
  if (act && act.start <= today && addDays(act.start, EXP_DAYS - 1) >= today) {
    const x = experimentOf(act.id);
    out.experiment = { name: x.title, daysDone: (act.done || []).filter((d) => typeof d === "string").length, target: x.target, status: "running" };
  } else {
    const past = (ex && Array.isArray(ex.past) ? ex.past : []).filter((p) => isObj(p) && experimentOf(p.id) && inW(p.start));
    const p = past[past.length - 1];
    if (p) out.experiment = { name: experimentOf(p.id).title, daysDone: (p.days || []).filter((d) => typeof d === "string").length, target: experimentOf(p.id).target, status: "finished" };
  }
  return out;
}

/* ---------------- the proof ---------------- */
const DATE_RE = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b|\b(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\b/i;
const EMAIL_RE = /[^\s"@]+@[^\s"@]+/;
const ZIP_RE = /"\d{5}(-\d{4})?"/;

/** Problems with a summary ([] = safe to show and send). Walks every key and value. */
export function checkSummary(s) {
  const out = [];
  const walk = (v, path) => {
    if (path && !SUMMARY_PATHS.has(path)) { out.push(`${path}: not an allowed field`); return; }
    if (v === null) return;
    if (Array.isArray(v)) { if (v.length > 12) out.push(`${path}: too many items`); v.forEach((x) => walk(x, `${path}[]`)); return; }
    if (isObj(v)) { for (const k of Object.keys(v)) walk(v[k], path ? `${path}.${k}` : k); return; }
    if (typeof v === "string") { if (!SUMMARY_VOCAB.has(v)) out.push(`${path}: text outside Heard Health's fixed lists`); return; }
    if (typeof v === "number") { if (!Number.isFinite(v) || v < 0 || v > 1000) out.push(`${path}: number out of range`); return; }
    out.push(`${path}: unexpected ${typeof v}`);
  };
  if (!isObj(s)) return ["summary: not an object"];
  walk(s, "");
  if (s.kind !== SUMMARY_KIND) out.push("kind: missing");
  let json = "";
  try { json = JSON.stringify(s); } catch { return [...out, "summary: not JSON"]; }
  if (DATE_RE.test(json)) out.push("summary: something date-shaped");
  if (EMAIL_RE.test(json)) out.push("summary: something email-shaped");
  if (ZIP_RE.test(json)) out.push("summary: something ZIP-shaped");
  if (json.length > 8000) out.push("summary: too large");
  return out;
}

/* ---------------- request bodies ---------------- */
/** POST /api/ai/weekly: { summary } and nothing else. */
export const weeklyBody = (summary) => ({ summary });

/** POST /api/ai/chat: { summary, question, history }. history = her last HISTORY_MAX chat messages on this device
    ({ role: "me" | "cyra", text }), as { role: "user" | "assistant", text }, each cut to HISTORY_TEXT_MAX. A question answered on
    this device (kind "local") and an emergency reply (kind "urgent") are never part of it. */
export function chatBody({ summary, question, history = [] }) {
  const h = (Array.isArray(history) ? history : []).filter((m) => isObj(m) && (m.role === "me" || m.role === "cyra") && typeof m.text === "string" && m.text.trim() && m.kind !== "local" && m.kind !== "urgent")
    .slice(-HISTORY_MAX).map((m) => ({ role: m.role === "me" ? "user" : "assistant", text: m.text.trim().slice(0, HISTORY_TEXT_MAX) }));
  return { summary, question: String(question || "").trim().slice(0, QUESTION_MAX), history: h };
}

/* ---------------- plain-language labels for the preview ---------------- */
const n = (v, one, many) => `${v} ${v === 1 ? one : many}`;
/** The summary as labelled lines ([label, text]) for "What Cyra will send". Every line restates a field of the JSON. */
export function summaryLines(s) {
  if (!isObj(s)) return [];
  const L = [["Life stage", s.lifeStage], ["Time covered", `the last ${s.weeks} weeks (no dates)`], ["Days with a check-in", String(s.daysLogged)]];
  if (s.cycles) {
    L.push(["Cycle lengths", s.cycles.lengthsInDays.length ? `${s.cycles.lengthsInDays.join(", ")} days` : "none finished yet"]);
    L.push(["Today's cycle day", s.cycles.currentCycleDay != null ? String(s.cycles.currentCycleDay) : "not known"]);
    if (s.cycles.longerThan35Days != null) L.push(["Cycles longer than 35 days", String(s.cycles.longerThan35Days)]);
  }
  if (s.daysLoggedByCycleDay) L.push(["Check-ins by cycle day", BUCKETS.map(([k, , , w]) => `${w}: ${s.daysLoggedByCycleDay[k]}`).join("; ")]);
  L.push(["Symptoms", s.symptoms && s.symptoms.length ? s.symptoms.map((x) => `${x.name} ${n(x.days, "day", "days")}`).join(", ") : "none logged"]);
  if (s.sleep) L.push(["Sleep", `${n(s.sleep.nightsWithHours, "night", "nights")} with hours${s.sleep.averageHours != null ? `, ${s.sleep.averageHours} h on average` : ""}; ${n(s.sleep.roughNights, "rough night", "rough nights")}`]);
  if (s.movement) L.push(["Movement", `${s.movement.sessionsPerWeek} sessions and ${s.movement.minutesPerWeek} minutes a week on average`]);
  if (s.mood) L.push(["Mood check-ins", `${s.mood.checkIns}${s.mood.feelings.length ? `; feelings: ${s.mood.feelings.map((f) => `${f.name} ${f.days}`).join(", ")}` : ""}`]);
  if (s.pcosSignals) L.push(["PCOS signals", s.pcosSignals.length ? s.pcosSignals.map((x) => `${x.name} ${n(x.days, "day", "days")}`).join(", ") : "none logged"]);
  if (s.labs) L.push(["Lab values (latest, rounded, no dates)", s.labs.length ? s.labs.map((x) => `${x.name} ${x.value} ${x.unit}`).join(", ") : "none typed in"]);
  if (s.experiment) L.push(["Experiment", `${s.experiment.name}: ${s.experiment.daysDone} of ${s.experiment.target} days (${s.experiment.status})`]);
  return L;
}
