/* Onboarding (L11, spec §4.2): the one routing and step map for registration, and the option lists the
   registration steps and Settings → About you share. Pure: no React, Capacitor, api, storage or features
   import, no network and no browser storage. Every answer here is kept only on the device (App.jsx regAnswers,
   which goes into encrypted backups without zip and age); nothing in this module sends anything anywhere.
   Registration is phase-first and short: Stage → Device → Cycle (cycle stages) | Pregnancy (Pregnant) | nothing
   (Menopause & beyond) → Consent. The remaining answers (age band, ZIP, regularity, reproductive history, health
   background, goals, sleep, activity) are optional and live in Settings → About you (components/AboutYou.jsx). */

/* Stage card -> life-stage experience (spec §4.3). App.jsx finishReg routes with it; RegisterScreen colours each card's
   swatch and the chrome preview (regPal) from PALETTES[REG_STAGE[label]][0]. Exactly one experience per user. */
export const REG_STAGE = { "My Cycle": "periods", "Trying to conceive": "periods", "Pregnant": "preg", "Perimenopause": "peri", "Menopause & beyond": "peri" };
/* Stage card -> stageName (the label the app shows; record.js PHASES carries the same five). */
export const STAGE_LABELS = { "My Cycle": "My Cycle", "Trying to conceive": "Trying to Conceive", "Pregnant": "Pregnancy", "Perimenopause": "Perimenopause", "Menopause & beyond": "Menopause" };
export const STAGE_CARDS = [["My Cycle", "periods & PMS"], ["Trying to conceive", "fertility"], ["Pregnant", "week by week"], ["Perimenopause", "changing cycles"], ["Menopause & beyond", "post-transition"]];

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
export const ANSWER_BLANK = Object.freeze({ age: null, zip: "", stage: null, cycleLen: null, cycleReg: null, lastPeriod: "", dueDate: "", preg: null, births: null, contra: null, conditions: [], familyHx: [], meds: null, goals: [], sleep: null, activity: null });

export const STEP_COPY = {
  stage: { short: "Stage", title: "Where are you right now?", sub: "This shapes your entire experience. You can change it anytime." },
  account: { short: "Device", title: "Set up Cyra on this device", sub: "There's no Cyra account. Your name, email and answers are saved on this device. Lose the device or clear the browser and you lose them, unless you saved an encrypted backup, which keeps most of them." },
  cycle: { short: "Cycle", title: "Your cycle history", sub: "So predictions can start from day one. These answers stay on this device, and go into an encrypted backup only if you save one." },
  pregnancy: { short: "Pregnancy", title: "Your pregnancy", sub: "So your week and your care roadmap start in the right place. Your due date stays on this device, and goes into an encrypted backup only if you save one." },
  consent: { short: "Consent", title: "Your data and your choices", sub: "What Cyra does with your data today — and choices you can change later in Settings." },
};

/** The steps for a stage card label (null before she picks one): 4 for the cycle stages and Pregnant, 3 for Menopause & beyond. */
export function regSteps(stageLabel) {
  if (stageLabel === "Pregnant") return ["stage", "account", "pregnancy", "consent"];
  if (stageLabel === "Menopause & beyond") return ["stage", "account", "consent"];
  return ["stage", "account", "cycle", "consent"];
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
    (a web redirect restarted the page, so nothing is known). */
export function socialReturnStep(stageLabel) {
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
  if (a.stage !== "Pregnant") a.dueDate = "";
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
