/* Onboarding (L11, spec §4.2): the one routing and step map for registration, and the option lists the
   registration steps and Settings → About you share. Pure: no React, Capacitor, api, storage or features
   import, no network and no browser storage. Every answer here is kept only on the device (App.jsx regAnswers,
   which goes into encrypted backups without zip and age); nothing in this module sends anything anywhere.
   Registration is phase-first and short: (Create your account, in a build with sign-in: Task 1) → Stage → (PCOS, optional: My Cycle, Trying to conceive, Perimenopause; calm R2)
   → Device → Cycle (cycle stages) | Pregnancy (Pregnant) | nothing (Menopause & beyond) → Consent. The remaining answers (age band, ZIP, regularity, reproductive history, health
   background, goals, sleep, activity) are optional and live in Settings → About you (components/AboutYou.jsx). */

/* Stage card -> life-stage experience (spec §4.3). App.jsx finishReg routes with it; RegisterScreen colours each card's
   swatch and the chrome preview (regPal) from stagePalettes(REG_STAGE[label], STAGE_LABELS[label])[0] (constants.js). Exactly one experience per user. */
export const REG_STAGE = { "My Cycle": "periods", "Trying to conceive": "periods", "Pregnant": "preg", "Perimenopause": "peri", "Menopause & beyond": "peri" };
/* Stage card -> stageName (the label the app shows; record.js PHASES carries the same five). */
export const STAGE_LABELS = { "My Cycle": "My Cycle", "Trying to conceive": "Trying to Conceive", "Pregnant": "Pregnancy", "Perimenopause": "Perimenopause", "Menopause & beyond": "Menopause" };
export const STAGE_CARDS = [["My Cycle", "periods & PMS"], ["Trying to conceive", "fertility"], ["Pregnant", "week by week"], ["Perimenopause", "changing cycles"], ["Menopause & beyond", "post-transition"]];

/* Several stage cards can be true at once (owner decision 2026-11-12): she can still have periods in perimenopause, or be
   trying to conceive in her forties. She picks every card that fits; the app is still built around exactly one
   experience (the primary card below), and each other card she picked goes into her goals.
   - Pregnant and Menopause & beyond each stand alone: picking one clears the others, and picking another clears it.
   - The primary is the first picked card in PRIMARY_ORDER (Trying to conceive leads because fertility timing matters
     most when she has that goal; Perimenopause leads over My Cycle because its flow tracks periods as well). */
export const STAGE_ALONE = Object.freeze(["Pregnant", "Menopause & beyond"]);
export const PRIMARY_ORDER = Object.freeze(["Pregnant", "Menopause & beyond", "Trying to conceive", "Perimenopause", "My Cycle"]);
/* The goal each combinable card adds (labels from GOALS below). */
export const STAGE_GOAL = Object.freeze({ "My Cycle": "Predict my cycle", "Trying to conceive": "Get pregnant", "Perimenopause": "Track the transition" });

/** The picked cards, cleaned: known labels only, in card order, and a stand-alone card only on its own. */
export function cleanStages(list) {
  const known = Array.isArray(list) ? STAGE_CARDS.map(([l]) => l).filter((l) => list.includes(l)) : [];
  const alone = known.find((l) => STAGE_ALONE.includes(l));
  return alone ? [alone] : known;
}

/** Tap a stage card: toggles it, with Pregnant and Menopause & beyond standing alone. Never mutates its input. */
export function toggleStage(list, label) {
  const cur = cleanStages(list);
  if (!STAGE_CARDS.some(([l]) => l === label)) return cur;
  if (cur.includes(label)) return cur.filter((l) => l !== label);
  if (STAGE_ALONE.includes(label)) return [label];
  return cleanStages([...cur.filter((l) => !STAGE_ALONE.includes(l)), label]);
}

/** The one card her experience is built around, or null when nothing is picked. */
export const primaryStage = (list) => PRIMARY_ORDER.find((l) => cleanStages(list).includes(l)) || null;

/** The goals the picked cards add (every combinable card she picked, primary included). */
export const goalsForStages = (list) => cleanStages(list).map((l) => STAGE_GOAL[l]).filter(Boolean);

/** The sentence under the cards: which experience she gets, and what her other picks become. Null with nothing picked. */
export function stageSummary(list) {
  const p = primaryStage(list);
  if (!p) return null;
  const extra = cleanStages(list).filter((l) => l !== p).map((l) => `\u201c${STAGE_GOAL[l]}\u201d`);
  const and = extra.length > 1 ? `${extra.slice(0, -1).join(", ")} and ${extra[extra.length - 1]}` : extra[0];
  return `Your app will be set up for ${STAGE_LABELS[p]}${extra.length ? `, with ${and} added to your goals` : ""}.`;
}

// Option lists (unchanged wording from the registration steps they came from).
export const AGE_BANDS = ["Under 25", "25–34", "35–44", "45–54", "55+"];
export const CYCLE_LENS = ["Under 24 days", "24–31 days", "Over 31 days", "Irregular", "Not sure"];
export const REGULARITY = ["Clockwork", "Roughly", "All over"];
export const EVER_PREG = ["Never", "Currently", "In the past", "Prefer not to say"];
export const BIRTHS = ["0", "1", "2", "3+"];
export const CONTRA = ["None", "Pill", "IUD", "Implant/shot", "Barrier", "Prefer not to say"];
export const CONDITIONS = ["PCOS", "Endometriosis", "Thyroid", "Diabetes", "Anemia", "Migraines", "High blood pressure", "Anxiety/depression", "POTS or dysautonomia", "None"];
export const FAMILY_HX = ["Early menopause", "Osteoporosis", "Breast/ovarian cancer", "Heart disease", "None / unsure"];
export const MEDS = ["No", "Yes", "Prefer not to say"];
export const GOALS = ["Understand my symptoms", "Predict my cycle", "Get pregnant", "Avoid pregnancy", "Prep for my doctor", "Sleep better", "Feel less alone", "Track the transition"];
export const SLEEP = ["Solid", "Hit or miss", "Poor"];
export const ACTIVITY = ["Low", "Moderate", "High"];

/* Every regAnswers answer key at its empty value. No name, email or anon key: a Settings → About you edit spreads
   this under the saved answers, so it can never put identity back into an Anonymous Mode record. */
export const ANSWER_BLANK = Object.freeze({ age: null, zip: "", stage: null, stages: [], pcos: null, cycleLen: null, cycleReg: null, lastPeriod: "", dueDate: "", preg: null, births: null, contra: null, conditions: [], familyHx: [], meds: null, goals: [], sleep: null, activity: null });

/* "Living with PCOS?" (calm R2): one optional step after Stage for the stages the PCOS module serves. Nothing is
   required; Yes or "I suspect it" turns the PCOS module on (lib/modules.js), which she can turn off in You → Modules.
   The answer is kept as regAnswers.pcos (one of these ids, or null when she picked nothing). */
export const PCOS_ANSWERS = [["yes", "Yes, diagnosed"], ["suspect", "I suspect it"], ["no", "No"], ["unsaid", "Prefer not to say"]];
const PCOS_IDS = new Set(PCOS_ANSWERS.map(([id]) => id));
/* The stage cards whose flow has the PCOS step (the stages modules.js offers PCOS in). */
export const PCOS_STAGES = ["My Cycle", "Trying to conceive", "Perimenopause"];

export const STEP_COPY = {
  stage: { short: "Stage", title: "Where are you right now?", sub: "Pick all that fit, like having periods and being in perimenopause. You can change it anytime." },
  pcos: { short: "PCOS", title: "Living with PCOS?", sub: "Optional. A yes adds PCOS tracking, and you can change it in You. Your answer stays on this device, and goes into an encrypted backup only if you save one." },
  signin: { short: "Account", title: "Create your account", sub: "Sign in so Solia Health knows it's you. Your health log stays on this device, and your account never holds it." },
  // The Device step in a build with sign-in (signin flag and a server): the account exists, so the "no account" sentence goes.
  deviceSignin: { short: "Device", title: "Set up Solia Health on this device", sub: "Your name, email and answers here are saved on this device, not in your account. Lose the device or clear the browser and you lose them, unless you saved an encrypted backup, which keeps most of them." },
  account: { short: "Device", title: "Set up Solia Health on this device", sub: "There's no Solia Health account. Your name, email and answers are saved on this device. Lose the device or clear the browser and you lose them, unless you saved an encrypted backup, which keeps most of them." },
  cycle: { short: "Cycle", title: "Your cycle history", sub: "So predictions can start from day one. These answers stay on this device, and go into an encrypted backup only if you save one." },
  pregnancy: { short: "Pregnancy", title: "Your pregnancy", sub: "So your week and your care roadmap start in the right place. Your due date stays on this device, and goes into an encrypted backup only if you save one." },
  consent: { short: "Consent", title: "Your data and your choices", sub: "What Solia Health does with your data today — and choices you can change later in Settings." },
};

/** The steps for the primary stage card label (null before she picks one): 5 for the cycle stages (with the optional
    PCOS step), 4 for Pregnant, 3 for Menopause & beyond. Before a stage is picked the cycle flow is shown (the most common).
    Wearables are never asked about during registration (owner decision 2026-11-12: too early); she connects one later
    from the Home card or You → Data sources. */
export function regSteps(stageLabel, { signin = false } = {}) {
  const steps = stageLabel === "Pregnant" ? ["stage", "account", "pregnancy", "consent"]
    : stageLabel === "Menopause & beyond" ? ["stage", "account", "consent"]
    : ["stage", "pcos", "account", "cycle", "consent"];
  // Sign-in (Task 1, lib/signin.js): in a build that offers it, "Create your account" comes first, before the stage.
  return signin ? ["signin", ...steps] : steps;
}

/** A PCOS answer as kept: one of the PCOS_ANSWERS ids, or null. */
export const cleanPcosAnswer = (v) => (PCOS_IDS.has(v) ? v : null);

/** Whether a registration turns the PCOS module on: only "Yes, diagnosed" or "I suspect it", only for a stage whose
    flow asked. "No", "Prefer not to say" and nothing picked leave it off. */
export function pcosModuleFrom(stageLabel, answer) {
  return PCOS_STAGES.includes(stageLabel) && (answer === "yes" || answer === "suspect");
}

/** The required answers a step still lacks. Only the stage, a typical cycle length and the consent box are ever required. */
export function missingFor(stepKey, reg) {
  const r = reg || {};
  if (stepKey === "stage") return r.stage ? [] : ["stage"];
  if (stepKey === "cycle") return r.cycleLen ? [] : ["cycleLen"];
  if (stepKey === "consent") return r.terms ? [] : ["terms"];
  return [];
}

/** Where a sign-in return lands: the step after Device when the stage is known (a native return), else the stage step
    (a web redirect restarted the page, so nothing is known). With sign-in as the first step, a finished sign-in lands
    on the step after it (the stage step), whatever the stage. */
export function socialReturnStep(stageLabel, { signin = false } = {}) {
  if (signin) return 1;
  return stageLabel ? regSteps(stageLabel).indexOf("account") + 1 : 0;
}

// A "None" / "None / unsure" answer clears the others, and any other answer clears it.
const NONE = /^None\b/;
/** Toggle v in a multi-answer list; never mutates its input. */
export function toggleMulti(list, v) {
  const cur = Array.isArray(list) ? list : [];
  if (cur.includes(v)) return cur.filter((y) => y !== v);
  if (NONE.test(v)) return [v];
  return [...cur.filter((y) => !NONE.test(y)), v];
}

/** A copy of the answers with the ones typed on a step that is no longer in her flow emptied. */
export function pruneForStage(answers) {
  const a = { ...(answers || {}) };
  // The picked cards and the primary agree: an older record with only a stage gets that one card.
  a.stages = cleanStages(Array.isArray(a.stages) && a.stages.length ? a.stages : a.stage ? [a.stage] : []);
  if (a.stages.length) a.stage = primaryStage(a.stages);
  if (a.stage !== "Pregnant") a.dueDate = "";
  a.pcos = PCOS_STAGES.includes(a.stage) ? cleanPcosAnswer(a.pcos) : null;
  if (a.stage === "Pregnant" || a.stage === "Menopause & beyond") { a.cycleLen = null; a.lastPeriod = ""; }
  return a;
}

/** A ZIP or postal code: letters, digits, spaces and hyphens, 10 characters at most — no room for a street address. */
export function sanitizeZip(text) {
  return String(text ?? "").replace(/[^A-Za-z0-9 -]/g, "").slice(0, 10);
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const noon = (iso) => {
  if (!ISO.test(iso || "")) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const [y, m, day] = iso.split("-").map(Number);
  // A rolled-over date ("2026-13-01") is malformed, not a date.
  return d.getFullYear() === y && d.getMonth() + 1 === m && d.getDate() === day ? d : null;
};
const DAY = 86400000;
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Pregnancy week from a due date (40 weeks = 280 days before it), 1–42; null when malformed or out of range. */
export function pregWeekFrom(dueIso, todayIso) {
  const due = noon(dueIso), today = noon(todayIso);
  if (!due || !today) return null;
  const d = Math.round((due - today) / DAY); // noon to noon, so a DST change never shifts a day
  if (d > 280 || d < -14) return null;
  return Math.max(1, Math.min(42, Math.floor((280 - d) / 7)));
}

/** The date input's bounds: two weeks overdue to a full 40 weeks ahead. */
export function dueDateBounds(todayIso) {
  const t = noon(todayIso) || new Date(new Date().setHours(12, 0, 0, 0));
  const min = new Date(t.getTime() - 14 * DAY), max = new Date(t.getTime() + 280 * DAY);
  return { min: isoOf(min), max: isoOf(max) };
}
