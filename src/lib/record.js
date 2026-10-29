/* The saved record: its shape (the typedefs below), its version, which keys it holds and where each
   one goes, and small pure accessors over it. Pure: no React, no storage, no network; it runs on the
   device and in `node --test`. lib/storage.js passes every record it loads through migrate(), and
   App.jsx importBackup passes every decrypted backup through it too. RECORD_VERSION is 1 and there
   are no migration steps yet, so migrate() returns today's records untouched (the same object).
   engine.js, daylog.js (L6) and fertility.js (L7) are lower layers: this file may import them; none ever imports this file.

   Written for the iOS 15.0 web view as well: no structuredClone, Array.prototype.at, findLast or
   Object.hasOwn (Object.prototype.hasOwnProperty.call instead). docs/ARCHITECTURE.md §4 describes
   every key; a new key is added here (PERSISTED, its class, a RULES entry and a typedef), in
   record.test.mjs's pinned lists and in App.jsx's setters and values. */
import { localDay, isPeriodDay, cycleStarts, cycleSpans, cleanCycleFlags } from "./engine.js";
import { PALETTES, CADENCE, FLOW, DISCHARGE, ODOR, BODYODOR, RELATIONSHIP, INTIMACY, AFTER } from "./constants.js";
import { cleanSymPrefs, NOTE_MAX } from "./daylog.js";
import { cleanFert, cleanFertPrefs } from "./fertility.js";
import { cleanModules } from "./modules.js";
import { cleanHomeTiles } from "./home.js";
import { cleanBodyLog, cleanLabs, cleanBodyPrefs } from "./bodylog.js";
import { cleanMoodLog, cleanPracticeLog, cleanPracticeFavs } from "./mind.js";
import { cleanExperiments } from "./experiments.js";

/* ======================= shapes (documentation only) =======================
   Class tags: [record] the health record and settings (in the backup file, applied by a restore,
   taken over by another open tab); [device-only] DEVICE_ONLY (in the backup file but never applied
   by a restore, never taken over by another tab); [device-pref] DEVICE_PREFS (taken over by this
   browser's other tabs, never in the file); [not-in-backup] NOT_IN_BACKUP (deleted before the
   backup is encrypted). */

/**
 * The record as stored: one object holding exactly the PERSISTED keys, plus three container fields.
 * @typedef {Object} CyraRecord
 * @property {number} v RECORD_VERSION when it was written (1). Not the IndexedDB key name "v1".
 * @property {string} savedAt ISO timestamp of the save.
 * @property {"app"} phase Always "app": a saved record always opens the app.
 * @property {Settings["palIdx"]} palIdx [record] chosen palette per life stage.
 * @property {string|null} relationship [record] RELATIONSHIP id (Connect) or null.
 * @property {Object<string, ConnEntry>} connLog [record] Connect check-ins by local day.
 * @property {string} cadence [record] CADENCE id: how often she wants to check in.
 * @property {string} quietHours [record] reminder time of day: morning | midday | evening | never.
 * @property {boolean} quickMode [record] quick check-in (true) or full detail.
 * @property {Med[]} meds [record] What I'm trying.
 * @property {Object<string, Object<string, boolean>>} medLog [record] taken / not taken, by local day then med id.
 * @property {Appt[]} appts [record] appointments.
 * @property {Object<string, string>} journal [record] journal text by local day.
 * @property {Object<string, Object>} wearSources [record] wearable connections by source id (a restore brings them back unconfirmed).
 * @property {WearRow[]} wearData [record] daily wearable readings.
 * @property {Account} acct [record] name and email (empty in Anonymous Mode).
 * @property {boolean} research [device-only] "Share anonymous weekly counts", a consent given on this device.
 * @property {"periods"|"preg"|"peri"|null} stage [record] the one life-stage experience (null while she chooses again).
 * @property {string} stageName [record] the label for it ("My Cycle", "Trying to Conceive", "Pregnancy", "Perimenopause", "Menopause").
 * @property {string} welcome [record] the welcome sentence chosen at registration.
 * @property {DayEntry[]} days [record] check-ins (cycle and peri / meno stages), one per date.
 * @property {PregLog} pregLog [record] pregnancy check-ins.
 * @property {PulseQueue|null} pulseQueue [device-only] weekly-count flags waiting on this device.
 * @property {PulseSent|null} pulseSent [device-only] what this device already sent this ISO week.
 * @property {string|null} pulseLastSend [device-only] the local day this device last sent a tally.
 * @property {number} pulseRev [device-only] version of the sharing state, so a stale tab can't roll it back.
 * @property {boolean} askAI [device-only] "Also ask Cyra's AI", a consent given on this device.
 * @property {RegAnswers|null} regAnswers [record] registration and About you answers (in the backup file without zip and age).
 * @property {StoredReminders} reminders [record] reminder switch plus this browser's push addresses (the file keeps only enabled).
 * @property {Array<{key: string}|{ref: string}>} terraOff [device-only] unconfirmed Fitbit / Garmin / Whoop disconnects.
 * @property {KickTally|null} kickTally [record] today's kick count between taps.
 * @property {Object} pots [record] the POTS add-on: see lib/pots.js; a pots whose v is not 1 is locked and kept untouched.
 * @property {string|null} lastBackupAt [device-only] [not-in-backup] the local day this device last made a backup.
 * @property {null|"dismissed"|"installed"} installHint [device-only] [not-in-backup] whether this browser's install tip stays away (lib/pwa.js).
 * @property {"system"|"light"|"dark"} appearance [device-pref] [not-in-backup] this device's light / dark choice (lib/appearance.js).
 * @property {CycleFlags} cycleFlags [record] cycles she left out of predictions (L5); missing means {}.
 * @property {ExportTally|null} exportLog [device-only] [not-in-backup] appointment PDFs made this month (L9, lib/plan.js ExportTally); null while exports are unlimited.
 * @property {SymPrefs} symPrefs [record] her symptom list per stage (L6); missing means {} (Cyra's order).
 * @property {FertSigns} fertSigns [record] fertility signs switch and unit (L7); missing means { on: null, unit: null }.
 * @property {Object<string, {sleepH?: number, move?: Array<{id: string, type: string, min: number}>, pcos?: string[], weight?: {v: number, unit: "kg"|"lb"}}>} bodyLog [record] the fast log's second half by local day (calm R4, lib/bodylog.js).
 * @property {Array<{id: string, kind: "fglu"|"hba1c"|"waist", value: number, unit: string, date: string}>} labs [record] values she typed from her own results, dated (calm R4); never interpreted.
 * @property {{weightOn: boolean, weightUnit: ?string, glucoseUnit: ?string, hba1cUnit: ?string, waistUnit: ?string}} bodyPrefs [record] her units and whether weight is in her log (calm R4).
 * @property {Object<string, {mood?: number, tags?: string[], energy?: number, fog?: number}>} moodLog [record] the Mind check-in by local day (calm R5, lib/mind.js): a 1–5 face, feeling tags, optional energy and brain-fog levels (1–3).
 * @property {Array<{id: string, p: string, day: string, sec: number, done: boolean, helped?: "yes"|"no"}>} practiceLog [record] practices she started, oldest first, at most 400, with her "Which one helped?" answer (calm R5).
 * @property {string[]} practiceFavs [record] her favourite practices, in library order (calm R5).
 * @property {{active: ({id: string, start: string, done: string[]}|null), skip: (string|null), past: {id: string, start: string, days: string[], target: number}[]}} experiments [record] the weekly review's small experiment (calm R6, lib/experiments.js): the one running and the days she ticked, the week whose offer she skipped, the ones she finished.
 * @property {boolean} practiceHaptics [device-only] [not-in-backup] gentle vibration at each change of a practice, on this phone (calm R5).
 * @property {Object<string, {on: boolean, since: (string|null)}>} modules [record] condition modules switched on or off (calm R1, lib/modules.js), POTS excepted (it stays in `pots`); missing means {} (all off).
 */

/**
 * One check-in day (cycle and peri / meno stages). Spec §3.1.
 * seed() and records from older versions may carry only date, sleepQ, period and sym; every field
 * except date and sym may be absent. Later features add their fields here.
 * @typedef {Object} DayEntry
 * @property {string} date local day, YYYY-MM-DD; at most one entry per date (upsertDay).
 * @property {Object<string, 0|1|2|3>} sym severity by symptom id, from any symptom library (ids are never reused).
 * @property {{fatigue?: number, pain?: number, moodq?: number, stress?: number}} [scales] each 0–10.
 * @property {"good"|"fair"|"poor"} [sleepQ] last night's sleep.
 * @property {boolean} [period] a period day (spotting alone never is: engine isPeriodDay).
 * @property {string|null} [flow] FLOW id.
 * @property {string|null} [disch] DISCHARGE id.
 * @property {string|null} [odor] ODOR id.
 * @property {string|null} [bodyOdor] BODYODOR id.
 * @property {string} [note] her day note (L6): trimmed, at most 280 UTF-16 units (lib/daylog.js cleanNote); absent when empty.
 * @property {"dry"|"sticky"|"creamy"|"watery"|"eggwhite"} [cm] cervical mucus (L7, lib/fertility.js); absent when not logged.
 * @property {"neg"|"pos"} [opk] ovulation (LH) test result (L7); absent means not tested.
 * @property {number} [bbt] basal body temperature in °C, 34–40, at most 3 decimals (L7); absent when not logged.
 *   On the device and in backups only; never in weekly counts, Ask or the doctor email.
 */

/**
 * One pregnancy check-in day.
 * @typedef {Object} PregEntry
 * @property {Object<string, 0|1|2|3>} sym severity by pregnancy symptom id (GSYM).
 * @property {number} [kicks] kicks counted that day, an integer ≥ 0.
 * @property {{fatigue?: number, pain?: number, moodq?: number, stress?: number}} [scales] each 0–10.
 * @property {string|null} [odor] ODOR id.
 * @property {string|null} [bodyOdor] BODYODOR id.
 * @property {string} [note] her day note (L6), as DayEntry.note.
 */
/** @typedef {Object<string, PregEntry>} PregLog pregnancy check-ins by local day (YYYY-MM-DD). */

/**
 * One cycle, derived from the logged period starts (cyclesFrom). Never stored.
 * @typedef {Object} Cycle
 * @property {string} start the first period day (YYYY-MM-DD).
 * @property {string|null} next the next start, or null for the running cycle.
 * @property {number|null} length days from start to next; null for the running cycle.
 * @property {boolean} counted CYCLE_MIN ≤ length ≤ CYCLE_MAX (what the averages and spreads use).
 * @property {number} periodDays logged period days from start up to (not including) next.
 */

/**
 * Her own per-cycle choices (L5, spec §3.5), keyed by the cycle's start date (YYYY-MM-DD). Only her "Don't use" tap
 * writes one (engine toggleExclude); a key within 2 days of a start applies to that cycle. Predictions read it;
 * the clinical markers never do. Sanitised on load, adopt and restore by engine cleanCycleFlags (at most 400
 * entries). In backups, restored literally (a backup without it clears it).
 * @typedef {Object<string, {exclude: boolean}>} CycleFlags
 */

/**
 * Her symptom list per stage id (L6, spec §3.4), lib/daylog.js: { periods?, peri?, preg? }, each { order, hidden, added }
 * (lists of symptom ids, at most 40 each). My Cycle and Trying to conceive share "periods"; Perimenopause and Menopause
 * share "peri"; pregnancy has order and hidden only. {} is Cyra's order. In the record and in backups, restored
 * literally (a backup without it brings back Cyra's order). The tracked list (library + added, hidden included)
 * drives every insight, so hiding a chip never hides what she logged.
 * @typedef {Object<string, {order: string[], hidden: string[], added: string[]}>} SymPrefs
 */

/**
 * Fertility signs (L7, lib/fertility.js): on is her Settings choice (null = the stage default: on for Trying to
 * conceive, off for My Cycle; reset to null when the intake or registration changes the stage label); unit is the
 * display and entry unit for temperature (null = from the locale). In the record and in backups; a restore is
 * literal (a backup without it resets on to null and keeps this device's unit). Holds no health data.
 * @typedef {{on: boolean|null, unit: "C"|"F"|null}} FertSigns
 */

/**
 * Settings, as stored.
 * @typedef {Object} Settings
 * @property {{peri: number, preg: number, periods: number}} palIdx index into PALETTES[stage].
 * @property {string} cadence CADENCE id.
 * @property {"morning"|"midday"|"evening"|"never"} quietHours reminder time of day.
 * @property {boolean} quickMode quick check-in or full detail.
 * @property {string|null} relationship RELATIONSHIP id.
 * @property {"system"|"light"|"dark"} appearance light / dark (DEVICE_PREFS).
 */
/**
 * Reminders as stored (its status is worked out again at every launch).
 * @typedef {Object} StoredReminders
 * @property {boolean} enabled the switch.
 * @property {string|null} endpoint this browser's push address.
 * @property {string[]} pending push addresses Cyra's server still has to forget.
 * @property {number} rev version, so every open tab agrees on the switch.
 */
/** @typedef {{name: string, email: string, anon: boolean}} Account */
/** @typedef {{stage: string|null, pcos?: "yes"|"suspect"|"no"|"unsaid"|null, cycleLen?: string|null, cycleReg?: string|null, lastPeriod?: string, dueDate?: string, age?: string|null, zip?: string, preg?: string|null, births?: string|null, contra?: string|null, conditions?: string[], familyHx?: string[], meds?: string|null, goals?: string[], sleep?: string|null, activity?: string|null, name?: string, email?: string, anon?: boolean, notifOptin?: boolean, research?: boolean, terms?: boolean}} RegAnswers
 *  Registration answers plus Settings → About you (L11). dueDate: "" or YYYY-MM-DD (Pregnant only; drives the week). name and email are absent in Anonymous Mode.
 *  pcos (calm R2): the optional "Living with PCOS?" answer (My Cycle, Trying to conceive, Perimenopause), null when not picked. */
/** @typedef {{id: number|string, name: string, kind: string, started: string}} Med What I'm trying: started is YYYY-MM-DD. */
/** @typedef {{id?: number|string, date: string, who: string, note: string}} Appt */
/** @typedef {{closeness?: number, desire?: number, friction?: number, load?: number, intimacy?: string|null, after?: string|null}} ConnEntry scales 0–10; intimacy an INTIMACY id, after an AFTER id. */
/** @typedef {{date: string, temp: number|null, rhr: number|null, hrv: number|null, sleep: number|null, sourceId?: string, demo?: boolean}} WearRow */
/** @typedef {{day: string, stage: "periods"|"preg"|"peri", byDay?: Object<string, string[]>, events: string[]}} PulseQueue byDay: flags per local day (lib/pulse.js); events is their union; an older queue has no byDay. */
/** @typedef {{week: string, keys: string[]}} PulseSent keys are "stage|event". */
/** @typedef {{day: string, n: number}} KickTally */

/* ======================= version and migration ======================= */

export const RECORD_VERSION = 1;
/* Version n → a pure step that returns a NEW record at version n + 1 (never changes its input).
   Empty: version 1 is the only version so far. */
export const MIGRATIONS = Object.freeze({});

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

/** An older record brought up to `version`, or `raw` itself (the same reference) when there is
    nothing to do: not a plain object, no numeric v, or v already at (or past) `version`. All or
    nothing: a missing step, a step that throws, or one that doesn't return exactly the next
    version gives back the original `raw` unchanged. It never throws and never changes its input. */
export function migrate(raw, { version = RECORD_VERSION, steps = MIGRATIONS } = {}) {
  try {
    if (!isObj(raw) || typeof raw.v !== "number" || !Number.isInteger(raw.v) || raw.v >= version) return raw;
    let cur = raw;
    for (let n = raw.v; n < version; n++) {
      const step = isObj(steps) && has(steps, n) ? steps[n] : null;
      if (typeof step !== "function") return raw;
      let next;
      try { next = step(cur); } catch { return raw; }
      if (!isObj(next) || next.v !== n + 1) return raw;
      cur = next;
    }
    return cur;
  } catch {
    return raw;
  }
}

/* ======================= keys ======================= */

/* What persists on the device: the health record and settings. Never UI state.
   reminders persists { enabled, endpoint, pending, rev } — this browser's push address, any
   address Cyra's server still has to forget, and a version so every open tab agrees on the
   on/off switch; its status is worked out again at every launch.
   cycleFlags (L5) is her own per-cycle choice ("Don't use for predictions"): part of the record, so it travels in backups.
   symPrefs (L6) is her symptom list per stage (order, More symptoms, added from the other list): record, in backups.
   fertSigns (L7) is the fertility signs switch and temperature unit: record, in backups (no health data).
   modules (calm R1) is which condition modules are on ({ pcos: { on, since } }; lib/modules.js): record, in backups,
   restored literally. POTS keeps its own `pots` key; modules.js reads it from there.
   homeTiles (calm R3) is her Quick log choice on Home: null (Cyra's default tiles) or 2–4 tile ids (lib/home.js):
   record, in backups (no health data).
   homeStepSkip (calm R3) is the day she said "Not today" to Home's small step, { day, id } | null: device-only, never
   in a backup file (a dismissal on one device says nothing about another day elsewhere).
   bodyLog, labs, bodyPrefs (calm R4, lib/bodylog.js) are the fast log's second half: hours slept, movement sessions, PCOS
   day chips and an optional weight by day; dated lab values and waist measures she types; her units and the weight
   switch. Record, in backups, restored literally (a backup without them clears them). Health data: never sent anywhere.
   moodLog, practiceLog, practiceFavs (calm R5, lib/mind.js) are the Mind tab: the daily mood check-in, the practices
   she ran with her "Which one helped?" answers, and her favourites. Record, in backups, restored literally. Never sent.
   practiceHaptics (calm R5) is whether this phone vibrates gently during a practice: device-only, never in a backup file.
   experiments (calm R6, lib/experiments.js) is the weekly review's optional experiment: the one running with the days she
   ticked, the Sunday whose offer she skipped, and the ones she finished. Record, in backups, restored literally. Never sent.
   exportLog (L9) is this month's count of appointment PDFs, { month: "YYYY-MM", n }, written only while plan.js sets a
   monthly limit (none today, so it stays null): device-only and never in a backup file. */
export const PERSISTED = Object.freeze(["palIdx", "relationship", "connLog", "cadence", "quietHours", "quickMode", "meds", "medLog", "appts", "journal", "wearSources", "wearData", "acct", "research", "stage", "stageName", "welcome", "days", "pregLog", "pulseQueue", "pulseSent", "pulseLastSend", "pulseRev", "askAI", "regAnswers", "reminders", "terraOff", "kickTally", "pots", "lastBackupAt", "installHint", "appearance", "cycleFlags", "symPrefs", "fertSigns", "exportLog", "modules", "homeTiles", "homeStepSkip", "bodyLog", "labs", "bodyPrefs", "moodLog", "practiceLog", "practiceFavs", "practiceHaptics", "experiments"]);
/* Per-device choices a restored backup never overrides: sharing counts and asking the AI
   are consents given on this device; terraOff is this device's unfinished disconnects;
   lastBackupAt is the local day this device last made a backup (a date, nothing about her
   health), shown in Settings → Your data and left out of the backup file itself; installHint
   is whether this browser's Home install tip should stay away (null | "dismissed" |
   "installed", lib/pwa.js), also left out of the backup file; exportLog is this device's count of
   appointment PDFs this month (L9), null while exports are unlimited, also left out of the file. */
export const DEVICE_ONLY = Object.freeze(["research", "pulseQueue", "pulseSent", "pulseLastSend", "pulseRev", "askAI", "terraOff", "lastBackupAt", "installHint", "exportLog", "homeStepSkip", "practiceHaptics"]);
/* A display preference of this device (L2): appearance ("system" | "light" | "dark", lib/appearance.js).
   It is saved with the record and followed by every open tab of this browser (so it stays in RECORD,
   they are all the same device), but it is never in a backup file and never taken from one:
   exportBackup deletes it before encryption and importBackup keeps this device's value. */
export const DEVICE_PREFS = Object.freeze(["appearance"]);
/* The health record and settings another open tab of this browser can hand over (everything
   saved except the per-device consents and this browser's reminder addresses). */
export const RECORD = Object.freeze(PERSISTED.filter((k) => !DEVICE_ONLY.includes(k) && k !== "reminders"));
/* Keys deleted from the snapshot before it is encrypted, so they are never in a backup file:
   lastBackupAt (this device's own note of when it last backed up), installHint (whether this
   device's install tip is hidden), exportLog (this device's PDF count this month, L9) and appearance
   (this device's light/dark choice). */
export const NOT_IN_BACKUP = Object.freeze(["lastBackupAt", "installHint", "exportLog", "homeStepSkip", "practiceHaptics", ...DEVICE_PREFS]);

/** The record as it goes into an encrypted backup file, as a new object (the input is not
    changed): every saved key, except that regAnswers loses zip and age (neither is used after
    registration; their screen says they stay on this device), reminders keeps only { enabled }
    (this browser's push addresses never go into the file), and every NOT_IN_BACKUP key is left
    out. The other DEVICE_ONLY consents and bookkeeping are still in the file; a restore never
    applies them (App.jsx importBackup keeps this device's own values).
    Key order is kept, so its JSON is byte-identical to what exportBackup built inline before L3. */
export function backupCopy(snap) {
  const out = { ...snap };
  if (out.regAnswers && typeof out.regAnswers === "object") { const ra = { ...out.regAnswers }; delete ra.zip; delete ra.age; out.regAnswers = ra; }
  out.reminders = { enabled: !!(snap && snap.reminders && snap.reminders.enabled) };
  for (const k of NOT_IN_BACKUP) delete out[k];
  return out;
}

/* ======================= advisory validation =======================
   Nothing at runtime calls these: they describe what a well-formed record looks like, for tests,
   for a later import check and for debugging. A problem never drops or rewrites anything. */

const STAGES = ["periods", "preg", "peri"];
// Reminder time of day (SettingsSheet nudge row).
const QUIET_HOURS = ["morning", "midday", "evening", "never"];
const SLEEP_Q = ["good", "fair", "poor"];
const SCALE_IDS = ["fatigue", "pain", "moodq", "stress"];
const CONN_SCALES = ["closeness", "desire", "friction", "load"];
const INSTALL_HINTS = ["dismissed", "installed"];
const APPEARANCES = ["system", "light", "dark"];
const idsOf = (list) => list.map((x) => (Array.isArray(x) ? x[0] : x.id));

const show = (v) => {
  let s;
  try { s = v === undefined ? "undefined" : typeof v === "number" && !Number.isFinite(v) ? String(v) : JSON.stringify(v); } catch { s = String(v); }
  if (s === undefined) s = String(v);
  return s.length > 60 ? `${s.slice(0, 57)}...` : s;
};
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (s) => typeof s === "string" && ISO_RE.test(s) && localDay(new Date(`${s}T12:00:00`)) === s;
const inRange = (n, lo, hi) => typeof n === "number" && Number.isFinite(n) && n >= lo && n <= hi;
const isSev = (n) => Number.isInteger(n) && n >= 0 && n <= 3;
const isCount = (n) => Number.isInteger(n) && n >= 0;
const oneOfOrNull = (v, ids) => v === null || ids.includes(v);
const listWords = (ids) => (ids.length < 2 ? ids.join("") : `${ids.slice(0, -1).join(", ")} or ${ids[ids.length - 1]}`);

const isoProblem = (v, p, what = "a YYYY-MM-DD date") => (isIso(v) ? [] : [`${p}: expected ${what}, got ${show(v)}`]);
const boolRule = (v, p) => (typeof v === "boolean" ? [] : [`${p}: expected true or false, got ${show(v)}`]);
const stringRule = (v, p) => (typeof v === "string" ? [] : [`${p}: expected text, got ${show(v)}`]);
const objectRule = (v, p) => (isObj(v) ? [] : [`${p}: expected an object, got ${show(v)}`]);
const enumRule = (ids, { nullable = false } = {}) => (v, p) =>
  ((nullable ? oneOfOrNull(v, ids) : ids.includes(v)) ? [] : [`${p}: expected ${listWords(nullable ? [...ids, "null"] : ids)}, got ${show(v)}`]);
const isoOrNullRule = (v, p) => (v === null || isIso(v) ? [] : [`${p}: expected null or a YYYY-MM-DD date, got ${show(v)}`]);
/* An object keyed by local day (YYYY-MM-DD), each value checked by `entry`. */
const byDayRule = (entry, what) => (v, p) => {
  if (!isObj(v)) return [`${p}: expected ${what} by date, got ${show(v)}`];
  const out = [];
  for (const k of Object.keys(v)) {
    if (!isIso(k)) out.push(`${p}.${k}: expected a YYYY-MM-DD date as the key`);
    out.push(...entry(v[k], `${p}.${k}`));
  }
  return out;
};
const listRule = (item, what) => (v, p) => {
  if (!Array.isArray(v)) return [`${p}: expected a list of ${what}, got ${show(v)}`];
  const out = [];
  v.forEach((x, i) => out.push(...item(x, `${p}[${i}]`)));
  return out;
};

/* The fields DayEntry and PregEntry share. */
const symProblems = (sym, p) => {
  if (!isObj(sym)) return [`${p}: expected severities by symptom id, got ${show(sym)}`];
  const out = [];
  for (const k of Object.keys(sym)) if (!isSev(sym[k])) out.push(`${p}.${k}: expected a severity 0–3, got ${show(sym[k])}`);
  return out;
};
const scalesProblems = (sc, p) => {
  if (sc === undefined) return [];
  if (!isObj(sc)) return [`${p}: expected { fatigue, pain, moodq, stress }, got ${show(sc)}`];
  const out = [];
  for (const k of SCALE_IDS) if (has(sc, k) && !inRange(sc[k], 0, 10)) out.push(`${p}.${k}: expected a number 0–10, got ${show(sc[k])}`);
  return out;
};
const pickProblems = (e, p, field, list) => (has(e, field) && e[field] !== undefined && !oneOfOrNull(e[field], idsOf(list)) ? [`${p}.${field}: expected ${listWords([...idsOf(list), "null"])}, got ${show(e[field])}`] : []);

/* The day note (L6): when present, a non-empty string of at most NOTE_MAX UTF-16 units (it is saved trimmed and
   absent when empty). Reported, never trimmed or dropped here. */
const noteProblems = (e, p) => (has(e, "note") && e.note !== undefined && !(typeof e.note === "string" && e.note.trim() !== "" && e.note.length <= NOTE_MAX)
  ? [`${p}.note: expected text of 1–${NOTE_MAX} characters, got ${show(e.note)}`] : []);
/* Fertility signs (L7): each of cm, opk and bbt, when present, must be what lib/fertility.js cleanFert keeps. */
const FERT_WHAT = { cm: "dry, sticky, creamy, watery or eggwhite", opk: "neg or pos", bbt: "a °C temperature from 34 to 40" };
const fertProblems = (d, p) => {
  const ok = cleanFert(d);
  return ["cm", "opk", "bbt"].filter((k) => has(d, k) && d[k] !== undefined && ok[k] === null).map((k) => `${p}.${k}: expected ${FERT_WHAT[k]}, got ${show(d[k])}`);
};
function dayEntryProblems(d, p) {
  const out = [...symProblems(d.sym, `${p}.sym`), ...scalesProblems(d.scales, `${p}.scales`), ...noteProblems(d, p)];
  if (d.sleepQ !== undefined && d.sleepQ !== null && !SLEEP_Q.includes(d.sleepQ)) out.push(`${p}.sleepQ: expected good, fair or poor, got ${show(d.sleepQ)}`);
  if (d.period !== undefined && typeof d.period !== "boolean") out.push(`${p}.period: expected true or false, got ${show(d.period)}`);
  out.push(...pickProblems(d, p, "flow", FLOW), ...pickProblems(d, p, "disch", DISCHARGE), ...pickProblems(d, p, "odor", ODOR), ...pickProblems(d, p, "bodyOdor", BODYODOR));
  out.push(...fertProblems(d, p));
  return out;
}
const daysRule = (v, p) => {
  if (!Array.isArray(v)) return [`${p}: expected a list of day entries, got ${show(v)}`];
  const out = [], seen = new Set();
  v.forEach((d, i) => {
    const q = `${p}[${i}]`;
    if (!isObj(d)) { out.push(`${q}: expected a day entry, got ${show(d)}`); return; }
    if (!isIso(d.date)) out.push(`${q}.date: expected a YYYY-MM-DD date, got ${show(d.date)}`);
    else if (seen.has(d.date)) out.push(`${p}: two entries for ${d.date}`);
    else seen.add(d.date);
    out.push(...dayEntryProblems(d, q));
  });
  return out;
};
const pregEntryProblems = (e, p) => {
  if (!isObj(e)) return [`${p}: expected a pregnancy entry, got ${show(e)}`];
  const out = [...symProblems(e.sym, `${p}.sym`), ...scalesProblems(e.scales, `${p}.scales`), ...noteProblems(e, p)];
  if (e.kicks !== undefined && !isCount(e.kicks)) out.push(`${p}.kicks: expected a whole number ≥ 0, got ${show(e.kicks)}`);
  out.push(...pickProblems(e, p, "odor", ODOR), ...pickProblems(e, p, "bodyOdor", BODYODOR));
  return out;
};
const connEntryProblems = (e, p) => {
  if (!isObj(e)) return [`${p}: expected a Connect entry, got ${show(e)}`];
  const out = [];
  for (const k of CONN_SCALES) if (has(e, k) && !inRange(e[k], 0, 10)) out.push(`${p}.${k}: expected a number 0–10, got ${show(e[k])}`);
  out.push(...pickProblems(e, p, "intimacy", INTIMACY), ...pickProblems(e, p, "after", AFTER));
  return out;
};
const medProblems = (m, p) => {
  if (!isObj(m)) return [`${p}: expected { id, name, kind, started }, got ${show(m)}`];
  const out = [];
  if (!(typeof m.id === "number" || typeof m.id === "string")) out.push(`${p}.id: expected a number or text, got ${show(m.id)}`);
  if (typeof m.name !== "string") out.push(`${p}.name: expected text, got ${show(m.name)}`);
  if (typeof m.kind !== "string") out.push(`${p}.kind: expected text, got ${show(m.kind)}`);
  out.push(...isoProblem(m.started, `${p}.started`));
  return out;
};
const apptProblems = (a, p) => {
  if (!isObj(a)) return [`${p}: expected { date, who, note }, got ${show(a)}`];
  const out = [...isoProblem(a.date, `${p}.date`)];
  if (typeof a.who !== "string") out.push(`${p}.who: expected text, got ${show(a.who)}`);
  if (typeof a.note !== "string") out.push(`${p}.note: expected text, got ${show(a.note)}`);
  return out;
};
const wearRowProblems = (r, p) => {
  if (!isObj(r)) return [`${p}: expected { date, temp, rhr, hrv, sleep }, got ${show(r)}`];
  const out = [...isoProblem(r.date, `${p}.date`)];
  for (const k of ["temp", "rhr", "hrv", "sleep"]) if (r[k] !== undefined && r[k] !== null && !(typeof r[k] === "number" && Number.isFinite(r[k]))) out.push(`${p}.${k}: expected a number or null, got ${show(r[k])}`);
  return out;
};
const stringList = (v) => Array.isArray(v) && v.every((x) => typeof x === "string");

/** One rule per PERSISTED key: (value, path) → problems ("<path>: <what is wrong>"). A key that is
    missing from a record is never a problem (an older record); validateRecord skips it. */
export const RULES = Object.freeze({
  // Settings
  palIdx: (v, p) => {
    if (!isObj(v)) return [`${p}: expected a palette number per life stage, got ${show(v)}`];
    const out = [];
    for (const s of Object.keys(PALETTES)) { const n = PALETTES[s].length; if (!(Number.isInteger(v[s]) && v[s] >= 0 && v[s] < n)) out.push(`${p}.${s}: expected a palette number 0–${n - 1}, got ${show(v[s])}`); }
    return out;
  },
  relationship: enumRule(idsOf(RELATIONSHIP), { nullable: true }),
  connLog: byDayRule(connEntryProblems, "Connect entries"),
  cadence: enumRule(idsOf(CADENCE)),
  quietHours: enumRule(QUIET_HOURS),
  quickMode: boolRule,
  // The day logs
  meds: listRule(medProblems, "medications"),
  medLog: byDayRule((e, p) => (isObj(e) ? Object.keys(e).filter((k) => typeof e[k] !== "boolean").map((k) => `${p}.${k}: expected true or false, got ${show(e[k])}`) : [`${p}: expected taken (true / false) by medication id, got ${show(e)}`]), "medication days"),
  appts: listRule(apptProblems, "appointments"),
  journal: byDayRule((e, p) => stringRule(e, p), "journal text"),
  wearSources: objectRule,
  wearData: listRule(wearRowProblems, "wearable rows"),
  acct: (v, p) => {
    if (!isObj(v)) return [`${p}: expected { name, email, anon }, got ${show(v)}`];
    return [...stringRule(v.name, `${p}.name`), ...stringRule(v.email, `${p}.email`), ...boolRule(v.anon, `${p}.anon`)];
  },
  research: boolRule,
  stage: enumRule(STAGES, { nullable: true }),
  stageName: stringRule,
  welcome: stringRule,
  days: daysRule,
  pregLog: byDayRule(pregEntryProblems, "pregnancy entries"),
  // Weekly-counts bookkeeping (DEVICE_ONLY)
  pulseQueue: (v, p) => (v === null || (isObj(v) && isIso(v.day) && STAGES.includes(v.stage) && stringList(v.events)) ? [] : [`${p}: expected null or { day: YYYY-MM-DD, stage, events: [text] }, got ${show(v)}`]),
  pulseSent: (v, p) => (v === null || (isObj(v) && typeof v.week === "string" && stringList(v.keys)) ? [] : [`${p}: expected null or { week, keys: [text] }, got ${show(v)}`]),
  pulseLastSend: isoOrNullRule,
  pulseRev: (v, p) => (inRange(v, 0, Infinity) ? [] : [`${p}: expected a number ≥ 0, got ${show(v)}`]),
  askAI: boolRule,
  regAnswers: (v, p) => {
    if (v === null) return [];
    if (!isObj(v)) return [`${p}: expected an object or null, got ${show(v)}`];
    // dueDate (L11): absent (older records), "" or a YYYY-MM-DD day. pcos (calm R2): absent, null or one of the four answers.
    const out = v.dueDate === undefined || v.dueDate === "" || isIso(v.dueDate) ? [] : [`${p}.dueDate: expected "" or YYYY-MM-DD, got ${show(v.dueDate)}`];
    if (!(v.pcos === undefined || v.pcos === null || ["yes", "suspect", "no", "unsaid"].includes(v.pcos))) out.push(`${p}.pcos: expected null, "yes", "suspect", "no" or "unsaid", got ${show(v.pcos)}`);
    return out;
  },
  reminders: (v, p) => {
    if (!isObj(v)) return [`${p}: expected { enabled, endpoint, pending, rev }, got ${show(v)}`];
    const out = [...boolRule(v.enabled, `${p}.enabled`)];
    if (!(v.endpoint === null || typeof v.endpoint === "string")) out.push(`${p}.endpoint: expected text or null, got ${show(v.endpoint)}`);
    if (!stringList(v.pending)) out.push(`${p}.pending: expected a list of addresses, got ${show(v.pending)}`);
    if (!inRange(v.rev, 0, Infinity)) out.push(`${p}.rev: expected a number ≥ 0, got ${show(v.rev)}`);
    return out;
  },
  terraOff: (v, p) => (Array.isArray(v) ? [] : [`${p}: expected a list, got ${show(v)}`]),
  kickTally: (v, p) => (v === null || (isObj(v) && isIso(v.day) && isCount(v.n)) ? [] : [`${p}: expected null or { day: YYYY-MM-DD, n: a whole number ≥ 0 }, got ${show(v)}`]),
  // The POTS add-on: its deeper shape is lib/pots.js cleanPots's job (a pots whose v is not 1 is valid and locked).
  pots: objectRule,
  lastBackupAt: isoOrNullRule,
  installHint: enumRule(INSTALL_HINTS, { nullable: true }),
  appearance: enumRule(APPEARANCES),
  // Her "Don't use for predictions" choices: a problem whenever cleanCycleFlags would change anything.
  cycleFlags: (v, p) => (JSON.stringify(v) === JSON.stringify(cleanCycleFlags(v)) ? [] : [`${p}: expected { YYYY-MM-DD: { exclude: true|false, … } } (at most 400, no empty entries), got ${show(v)}`]),
  // Her symptom list per stage (L6): a problem whenever cleanSymPrefs would change anything.
  // Fertility signs switch and unit (L7): a problem whenever cleanFertPrefs would change anything.
  fertSigns: (v, p) => (JSON.stringify(v) === JSON.stringify(cleanFertPrefs(v)) ? [] : [`${p}: expected { on: true|false|null, unit: "C"|"F"|null }, got ${show(v)}`]),
  // Appointment PDFs this month (L9): null, or { month: YYYY-MM, n: a whole number ≥ 0 }.
  exportLog: (v, p) => (v === null || (isObj(v) && typeof v.month === "string" && /^\d{4}-\d{2}$/.test(v.month) && isCount(v.n)) ? [] : [`${p}: expected null or { month: YYYY-MM, n: a whole number ≥ 0 }, got ${show(v)}`]),
  // Condition modules (calm R1): a problem whenever cleanModules would change anything.
  modules: (v, p) => (JSON.stringify(v) === JSON.stringify(cleanModules(v)) ? [] : [`${p}: expected { <module id>: { on: true|false, since: YYYY-MM-DD|null } } (POTS lives in pots), got ${show(v)}`]),
  // Home's Quick log tiles (calm R3): null, or what cleanHomeTiles keeps unchanged (2–4 distinct tile ids).
  homeTiles: (v, p) => (v === null || JSON.stringify(v) === JSON.stringify(cleanHomeTiles(v)) ? [] : [`${p}: expected null or 2–4 distinct Home tile ids, got ${show(v)}`]),
  // Home's small step "Not today" (calm R3): null or { day: YYYY-MM-DD, id: text }.
  homeStepSkip: (v, p) => (v === null || (isObj(v) && isIso(v.day) && typeof v.id === "string") ? [] : [`${p}: expected null or { day: YYYY-MM-DD, id }, got ${show(v)}`]),
  // The fast log's second half (calm R4): a problem whenever the clean function would change anything.
  bodyLog: (v, p) => (JSON.stringify(v) === JSON.stringify(cleanBodyLog(v)) ? [] : [`${p}: expected { YYYY-MM-DD: { sleepH?, move?, pcos?, weight? } } in date order, no empty days, got ${show(v)}`]),
  labs: (v, p) => (JSON.stringify(v) === JSON.stringify(cleanLabs(v)) ? [] : [`${p}: expected a list of { id, kind, value, unit, date }, newest first, values within their unit's range, got ${show(v)}`]),
  bodyPrefs: (v, p) => (JSON.stringify(v) === JSON.stringify(cleanBodyPrefs(v)) ? [] : [`${p}: expected { weightOn, weightUnit, glucoseUnit, hba1cUnit, waistUnit }, got ${show(v)}`]),
  // The Mind tab (calm R5): a problem whenever the clean function would change anything.
  moodLog: (v, p) => (JSON.stringify(v) === JSON.stringify(cleanMoodLog(v)) ? [] : [`${p}: expected { YYYY-MM-DD: { mood?: 1–5, tags?, energy?: 1–3, fog?: 1–3 } } in date order, no empty days, got ${show(v)}`]),
  practiceLog: (v, p) => (JSON.stringify(v) === JSON.stringify(cleanPracticeLog(v)) ? [] : [`${p}: expected a list of { id, p (practice id), day, sec, done, helped? }, at most 400, got ${show(v)}`]),
  practiceFavs: (v, p) => (JSON.stringify(v) === JSON.stringify(cleanPracticeFavs(v)) ? [] : [`${p}: expected practice ids in library order, got ${show(v)}`]),
  practiceHaptics: (v, p) => (typeof v === "boolean" ? [] : [`${p}: expected true or false, got ${show(v)}`]),
  experiments: (v, p) => (JSON.stringify(v) === JSON.stringify(cleanExperiments(v)) ? [] : [`${p}: expected { active: { id, start, done: [days] } | null, skip: day | null, past: [{ id, start, days, target }] }, got ${show(v)}`]),
  symPrefs: (v, p) => (JSON.stringify(v) === JSON.stringify(cleanSymPrefs(v)) ? [] : [`${p}: expected { periods|peri|preg: { order, hidden, added } } (lists of symptom ids, at most 40 each, no empty stages), got ${show(v)}`]),
});

/** Problems with a record, each "<path>: <what is wrong>" (e.g. "days[2].sym.crm: expected a
    severity 0–3, got 7"). Advisory only. Unknown top-level keys (a newer build's) and missing
    keys (an older record's) are allowed. It never throws. */
export function validateRecord(record) {
  try {
    if (!isObj(record)) return ["record: not an object"];
    const out = [];
    if (!(Number.isInteger(record.v) && record.v >= 1)) out.push(`v: expected a whole number ≥ 1, got ${show(record.v)}`);
    if (record.phase !== "app") out.push(`phase: expected "app", got ${show(record.phase)}`);
    if (record.savedAt !== undefined && typeof record.savedAt !== "string") out.push(`savedAt: expected text, got ${show(record.savedAt)}`);
    for (const k of PERSISTED) {
      if (!has(record, k) || record[k] === undefined) continue;
      try { out.push(...RULES[k](record[k], k)); } catch { out.push(`${k}: could not be checked`); }
    }
    return out;
  } catch {
    return ["record: could not be checked"];
  }
}

/* ======================= accessors ======================= */

/** The first entry saved for a date (as days.find did), or null. Tolerates a non-array and null items. */
export function entryFor(days, iso) {
  if (!Array.isArray(days)) return null;
  for (const d of days) if (d && d.date === iso) return d;
  return null;
}

/** The day log with `entry` saved for its date: any earlier entry for that date replaced, sorted by
    date. A new array; the input array and its entries are not changed. */
export function upsertDay(days, entry) {
  return [...(Array.isArray(days) ? days : []).filter((x) => x && x.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date));
}

/** One cycle per logged period start (engine cycleStarts: a period day with no period day in the
    5 days before it; spotting never starts one), whatever order the days are in. See Cycle. The finished
    cycles are engine cycleSpans() (one cycle-detection implementation), plus the running one. */
export function cyclesFrom(days) {
  const list = (Array.isArray(days) ? days : []).filter((d) => isObj(d) && typeof d.date === "string");
  const starts = cycleStarts(list);
  const periodDates = [...new Set(list.filter(isPeriodDay).map((d) => d.date))];
  const spans = cycleSpans(starts);
  const cycles = spans.map((s) => ({ start: s.start, next: s.next, length: s.len, counted: s.counted }));
  if (starts.length) cycles.push({ start: starts[starts.length - 1], next: null, length: null, counted: false });
  return cycles.map((c) => ({ ...c, periodDays: periodDates.filter((d) => d >= c.start && (c.next == null || d < c.next)).length }));
}

/* The five phases a person can be in, as the stage and stage label finishReg and rulesRoute write.
   Cycle and Trying to conceive share the "periods" stage; Perimenopause and Menopause share "peri". */
export const PHASES = Object.freeze({
  cycle: Object.freeze({ stage: "periods", stageName: "My Cycle" }),
  ttc: Object.freeze({ stage: "periods", stageName: "Trying to Conceive" }),
  preg: Object.freeze({ stage: "preg", stageName: "Pregnancy" }),
  peri: Object.freeze({ stage: "peri", stageName: "Perimenopause" }),
  meno: Object.freeze({ stage: "peri", stageName: "Menopause" }),
});

/** "cycle" | "ttc" | "preg" | "peri" | "meno" for a stored stage and stage label, or null. Only the
    exact labels in PHASES pick ttc and meno; any other label of that stage is cycle or peri. */
export function phaseOf(stage, stageName) {
  if (stage === "preg") return "preg";
  if (stage === "periods") return stageName === PHASES.ttc.stageName ? "ttc" : "cycle";
  if (stage === "peri") return stageName === PHASES.meno.stageName ? "meno" : "peri";
  return null;
}

/** How many days she has logged in her stage's log. */
export function daysLogged({ stage, days, pregLog } = {}) {
  return stage === "preg" ? Object.keys(pregLog || {}).length : (Array.isArray(days) ? days.length : 0);
}
