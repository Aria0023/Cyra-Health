/* Condition-module registry (calm R1, plan §7, spec §8.6 and docs/ARCHITECTURE.md "Condition modules").
   A condition module adds a condition's symptoms, signals, cycle wording, pattern questions, Ask topics and Report
   sections to the ONE life-stage experience she already has; it never replaces the stage. The ring, tiles and tabs
   are shared. Modules are pure data plus copy: a new module (hair loss is next) is a new MODULES entry and its
   copy, reviewed by a clinician, with no new engine code.

   Pure: no React, storage, network or feature-flag import, and never record.js (record.js imports this file for
   its RULES entry). Nothing here is sent anywhere: whether a module is on is part of the on-device record (the
   `modules` key, in encrypted backups, applied by a restore), and POTS keeps its own `pots` key.

   On/off:
   - pots: the existing POTS add-on (lib/pots.js, spec A13) stays the single source of truth: on = record.pots.on.
     setModuleOn delegates to pots.js turnOn / turnOff; no POTS code moves.
   - every other module: record.modules[id] = { on: true|false, since: "YYYY-MM-DD" | null }.

   Medical wording: every sentence that states something about a condition carries `src` (ids into the module's
   `evidence`), is framed as an association or as what a guideline describes (never a diagnosis, never treatment
   advice), and is listed in docs/CLINICIAN-REVIEW.md as awaiting clinician sign-off. PCOS has no UI yet: R2 (onboarding
   question, "+" sheet), R4 (Body logger), R6 (pattern cards), R7 (You → Modules) surface it.

   Adding the next module (NOT built; shown so the shape is clear):
     hairloss: {
       id: "hairloss", name: "Hair loss", short: "Hair thinning and shedding", stages: ["cycle", "ttc", "peri", "meno", "preg"],
       symptoms: [{ id: "shd", label: "More shedding" }, { id: "scalp", label: "Scalp itch or tenderness" }, ...],
       signals: [...], cycle: null, patternQuestions: [...], askTopics: [...], reportSections: [...],
       evidence: [{ id: "...", title: "...", body: "...", year: ... }],   // named primary or guideline sources
     }
   plus its copy in docs/CLINICIAN-REVIEW.md. isModuleOn / setModuleOn / modulesFor need no change. */
import { localDay } from "./engine.js";
import { TTC_NAME, MENO_NAME, ENERGY_ID } from "./constants.js";
import { turnOn as potsTurnOn, turnOff as potsTurnOff, cleanPots } from "./pots.js";

/* The phases a module can be offered in: the five life-stage experiences (record.js PHASES ids). */
export const MODULE_PHASES = Object.freeze(["cycle", "ttc", "preg", "peri", "meno"]);
/* (stage, stageName) → phase id, the same rule as record.js phaseOf (kept here so this file never imports record.js).
   A phase id passed as the stage is returned as it is. */
export const modulePhase = (stage, stageName) => {
  if (stage === "periods") return stageName === TTC_NAME ? "ttc" : "cycle";
  if (stage === "peri") return stageName === MENO_NAME ? "meno" : "peri";
  return MODULE_PHASES.includes(stage) ? stage : null;
};

/* The framing line every module surface carries near its insights. */
export const MODULE_FRAMING = "Associations to raise with your clinician, not a diagnosis or medical advice.";

const PCOS_EVIDENCE = Object.freeze([
  Object.freeze({
    id: "teede2023",
    title: "Recommendations from the 2023 International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome",
    body: "Teede HJ, Tay CT, Laven JJE, et al., for the International PCOS Network; Monash University with ESHRE, ASRM and partner societies. Published together in Fertility and Sterility, Human Reproduction, the Journal of Clinical Endocrinology & Metabolism and the European Journal of Endocrinology.",
    year: 2023,
  }),
  Object.freeze({
    id: "rotterdam2004",
    title: "Revised 2003 consensus on diagnostic criteria and long-term health risks related to polycystic ovary syndrome",
    body: "The Rotterdam ESHRE/ASRM-Sponsored PCOS Consensus Workshop Group. Fertility and Sterility 81(1):19–25 and Human Reproduction 19(1):41–47 (the 'Rotterdam criteria', agreed in 2003).",
    year: 2004,
  }),
  Object.freeze({
    id: "nicecks",
    title: "Polycystic ovary syndrome — Clinical Knowledge Summary",
    body: "National Institute for Health and Care Excellence (NICE), Clinical Knowledge Summaries (CKS), cks.nice.org.uk. The revision date shown here is to be confirmed at clinician review.",
    year: 2023,
  }),
]);

const freezeAll = (xs) => Object.freeze(xs.map((x) => Object.freeze({ ...x })));

/* PCOS (plan §7). Symptom ids that already exist in the check-in libraries (constants.js PSYM / SYM / ENERGY_ID) are
   reused (`shared: true`) so her existing logs count toward PCOS patterns; the rest are new ids. */
const PCOS = Object.freeze({
  id: "pcos",
  name: "PCOS",
  short: "Polycystic ovary syndrome",
  /* Offered in My Cycle, Trying to conceive and Perimenopause (plan §7). */
  stages: Object.freeze(["cycle", "ttc", "peri"]),
  what: Object.freeze({ text: "Adds PCOS symptoms, insulin-resistance signals, PCOS-aware cycle wording, pattern questions and a Report section. It does not diagnose PCOS.", src: [] }),
  symptoms: freezeAll([
    { id: "acn", label: "Acne", shared: true },
    { id: "hls", label: "Hair loss" },
    { id: "hgr", label: "Excess hair growth" },
    { id: ENERGY_ID, label: "Fatigue", shared: true },
    { id: "blo", label: "Bloating", shared: true },
    { id: "mood", label: "Mood swings", shared: true },
    { id: "fog", label: "Brain fog", shared: true },
    { id: "hda", label: "Headache", shared: true },
    { id: "pel", label: "Pelvic pain" },
    { id: "crm", label: "Cramps", shared: true },
    { id: "cra", label: "Cravings", shared: true },
    // A light day marker, not a symptom and not food logging: she taps it when a day felt high in sugar.
    { id: "sug", label: "High-sugar day", kind: "marker" },
  ]),
  /* Optional weight: never on Home, never charted unless she opts in (R4). */
  weight: Object.freeze({ optional: true, units: Object.freeze(["kg", "lb"]), note: "Optional. Only you see it; it is never on Home and never charted unless you choose." }),
  /* Insulin-resistance signals. Lab values are typed by her from her own results, with their unit and the test date;
     Cyra stores them on this device and never interprets them. */
  signals: freezeAll([
    { id: "crash", label: "Energy crash after meals", kind: "chip" },
    { id: "cra", label: "Cravings", kind: "chip", shared: true },
    { id: "waist", label: "Waist measure", kind: "number", units: ["cm", "in"], optional: true },
    { id: "fglu", label: "Fasting glucose", kind: "lab", units: ["mg/dL", "mmol/L"], dated: true, from: "your own results" },
    { id: "hba1c", label: "HbA1c", kind: "lab", units: ["%", "mmol/mol"], dated: true, from: "your own results" },
    { id: "acan", label: "Skin darkening (neck, armpits)", kind: "note",
      info: "Darker, velvety patches of skin, often on the neck or in the armpits, are listed among signs linked with insulin resistance. Worth raising with your clinician if you notice them.", src: ["teede2023"] },
  ]),
  /* PCOS-aware cycle wording: long and absent cycles are expected, not errors; "cycles longer than 35 days" is counted. */
  cycle: Object.freeze({
    longDays: 35,
    expected: Object.freeze({ text: "Long or missed cycles are common with PCOS. Cyra shows them as part of your pattern, not as mistakes.", src: ["teede2023", "rotterdam2004"] }),
    definition: Object.freeze({ text: "For adults, the international PCOS guideline describes cycles shorter than 21 days or longer than 35 days, or fewer than eight a year, as irregular.", src: ["teede2023"] }),
    range: Object.freeze({ text: "Your cycles vary, so the range is wide on purpose.", src: [] }),
  }),
  /* Pattern questions for the pattern engine (R6). exposure / outcome name what is compared; lag is in days.
     Results are associations in her own log, worded with MODULE_FRAMING, never causes. */
  patternQuestions: freezeAll([
    { id: "pcos-sleep-fatigue", topic: "Sleep and fatigue", question: "Do shorter nights line up with more fatigue the next day?",
      exposure: { kind: "sleepUnder", hours: 7, label: "Nights under 7 hours", other: "Nights of 7 hours or more" }, outcome: { kind: "symptom", id: ENERGY_ID, label: "Fatigue" }, lag: 1 },
    { id: "pcos-sugar-cravings", topic: "High-sugar days", question: "Do high-sugar days line up with more cravings or lower energy the next day?",
      exposure: { kind: "marker", id: "sug", label: "High-sugar days", other: "Other days" }, outcome: { kind: "symptoms", ids: ["cra", ENERGY_ID], label: "Cravings or fatigue" }, lag: 1 },
    { id: "pcos-move-mood", topic: "Movement and mood", question: "Do days with movement line up with steadier mood?",
      exposure: { kind: "movedAtLeast", minutes: 20, label: "Days with 20+ minutes of movement", other: "Other days" }, outcome: { kind: "symptom", id: "mood", label: "Mood swings" }, lag: 0 },
    { id: "pcos-cycle-length", topic: "Cycle length", question: "How has your cycle length changed over time?",
      exposure: null, outcome: { kind: "cycleLength", label: "Cycle length", longDays: 35 }, lag: 0 },
  ]),
  /* Ask library entries (R5/R6 surface them). Each answer names its source; none is advice to start or stop anything. */
  askTopics: freezeAll([
    { id: "pcos-long-cycles", q: "Why are my cycles so long?",
      a: "Irregular or long cycles are one of the features the 2023 international PCOS guideline describes. For adults it calls cycles under 21 or over 35 days, or fewer than eight a year, irregular. Cyra counts cycles longer than 35 days so you can show your clinician the pattern.", src: ["teede2023"] },
    { id: "pcos-diagnosis", q: "How is PCOS diagnosed?",
      a: "Clinicians use the Rotterdam criteria as refined by the 2023 guideline: two of irregular cycles, signs of higher androgens (such as excess hair growth or acne, or a blood test) and ovary findings on ultrasound or an AMH blood test in adults, once other causes are ruled out. Cyra does not diagnose PCOS.", src: ["rotterdam2004", "teede2023"] },
    { id: "pcos-labs", q: "Which numbers from my blood tests can I add?",
      a: "The guideline recommends that blood sugar is checked (for example fasting glucose or HbA1c) when PCOS is diagnosed and every one to three years after. You can type values from your own results with their unit and date. Cyra keeps them on this device and does not interpret them.", src: ["teede2023"] },
    { id: "pcos-skin", q: "What is skin darkening on the neck?",
      a: "Darker, velvety skin, often on the neck or in the armpits, is called acanthosis nigricans. The guideline lists it among signs linked with insulin resistance. It is worth mentioning to your clinician.", src: ["teede2023"] },
    { id: "pcos-mood", q: "Can PCOS affect my mood?",
      a: "The guideline notes that depression and anxiety are more common with PCOS and recommends that clinicians ask about them. Logging mood next to sleep and cycles can help that conversation.", src: ["teede2023"] },
  ]),
  /* The Report section spec (R6/R9 PDF): what it shows, in plain counts; never a score or a verdict. */
  reportSections: freezeAll([
    { id: "pcos-cycles", title: "Cycles", shows: ["cycle lengths", "count of cycles longer than 35 days", "longest gap between periods"], note: "Long or missed cycles shown as part of the pattern." },
    { id: "pcos-symptoms", title: "PCOS symptoms", shows: ["days logged per PCOS symptom over the period", "moderate-or-strong days"], note: "Counts only." },
    { id: "pcos-signals", title: "Insulin-resistance signals", shows: ["energy crashes after meals (days)", "cravings (days)", "high-sugar days (days)", "lab values as she typed them, with unit and date", "waist measures if she added them"], note: "Values as entered; Cyra does not interpret lab results." },
    { id: "pcos-questions", title: "Associations to raise", shows: ["pattern questions with enough data, as associations"], note: MODULE_FRAMING },
  ]),
  evidence: PCOS_EVIDENCE,
});

/* POTS: the existing add-on (lib/pots.js, spec A13), registered here so You → Modules lists it beside PCOS. Its
   content lives in the POTS code and its own clinician sign-off item (Q1 in docs/PRIVACY-AUDIT.md); nothing moves. */
const POTS = Object.freeze({
  id: "pots",
  name: "POTS",
  short: "Postural orthostatic tachycardia syndrome",
  stages: Object.freeze([...MODULE_PHASES]),
  what: Object.freeze({ text: "Adds POTS tools: fluids and salt, symptoms and triggers, a standing test, a movement plan and a POTS report.", src: [] }),
  symptoms: Object.freeze([]), signals: Object.freeze([]), cycle: null,
  patternQuestions: Object.freeze([]), askTopics: Object.freeze([]), reportSections: Object.freeze([]), evidence: Object.freeze([]),
  source: "lib/pots.js",
});

export const MODULES = Object.freeze({ pots: POTS, pcos: PCOS });
export const MODULE_IDS = Object.freeze(Object.keys(MODULES));

/* ---------- the persisted `modules` key: { [id]: { on, since } } for every module except pots ---------- */
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
/** Any stored value → a clean `modules` object: known non-POTS ids with { on: boolean, since: ISO | null }; unknown
    ids written by a newer build are kept as they are (never dropped); anything else is removed. */
export function cleanModules(raw) {
  if (!isObj(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === "pots") continue; // POTS lives in record.pots
    if (MODULES[k]) { if (isObj(v)) out[k] = { on: v.on === true, since: typeof v.since === "string" && ISO.test(v.since) ? v.since : null }; }
    else if (isObj(v)) out[k] = v; // a later build's module: kept untouched
  }
  return out;
}

/** True when module `id` is on in `record` ({ modules, pots }). POTS reads record.pots.on (the add-on's own switch). */
export function isModuleOn(record, id) {
  if (!MODULES[id]) return false;
  if (id === "pots") return !!(isObj(record?.pots) && record.pots.on === true);
  const m = isObj(record?.modules) ? record.modules[id] : null;
  return !!(isObj(m) && m.on === true);
}

/** A new record with module `id` turned on or off (the input is not changed). POTS goes through lib/pots.js turnOn /
    turnOff (opts: { day, simple, units, nowMs } are passed through); others write record.modules[id]. An unknown id,
    or a switch that is already in place, returns the record unchanged (same reference). */
export function setModuleOn(record, id, on, opts = {}) {
  const r = isObj(record) ? record : {};
  if (!MODULES[id] || isModuleOn(r, id) === !!on) return record;
  if (id === "pots") {
    const p = isObj(r.pots) ? r.pots : cleanPots(r.pots);
    const next = on ? potsTurnOn(p, { ...opts, day: opts.day || localDay() }) : potsTurnOff(p);
    return next === p ? record : { ...r, pots: next };
  }
  const mods = cleanModules(r.modules);
  return { ...r, modules: { ...mods, [id]: { on: !!on, since: on ? (opts.day && ISO.test(opts.day) ? opts.day : localDay()) : mods[id]?.since ?? null } } };
}

/** The modules offered in a stage: modulesFor(stage, stageName) or modulesFor(phaseId). Registry order. */
export function modulesFor(stage, stageName) {
  const ph = modulePhase(stage, stageName);
  return ph ? MODULE_IDS.map((k) => MODULES[k]).filter((m) => m.stages.includes(ph)) : [];
}

/** The evidence entries a piece of copy cites (src ids → entries), for a "Source" line. */
export const sourcesOf = (mod, src) => (src || []).map((s) => mod.evidence.find((e) => e.id === s)).filter(Boolean);

/** Cycles longer than the module's long-cycle threshold (PCOS: 35 days), from a list of cycle lengths in days. */
export const longCycleCount = (lens, days = PCOS.cycle.longDays) => (Array.isArray(lens) ? lens.filter((n) => Number.isFinite(n) && n > days).length : 0);
