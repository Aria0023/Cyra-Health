import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

/* ================================================================
   CYRA HEALTH — reference implementation
   Life stages: My Cycle · Pregnancy · Peri/Meno — exactly one per user.
   The health record (daily logs with their optional notes, her symptom list per stage, journal, intimacy log,
   trials, appointments, wearable rows once collected) lives in this component's state and is saved only
   on this device (IndexedDB or the app sandbox; lib/storage.js).
   Fertility signs on day entries (L7: cervical mucus, ovulation tests, basal temperature; lib/fertility.js) are part
   of those check-ins: they leave only inside the encrypted backup or the text she sends herself (the doctor email),
   never in weekly counts or a request to Cyra's AI. What can leave the
   device depends first on the features this build offers (VITE_FEATURES, lib/features.js;
   the default build offers only Ask Cyra's AI and web reminders, and makes no request at
   launch), then on her opt-in. Each flow, tagged with its flag, is disclosed where it is
   turned on (lib/disclosures.js holds the flag-dependent sentences):
   - [counts] with no health data: the stage-less read of last week's anonymous counts
     (GET /api/pulse) once per launch — IP address and user agent, like any request;
   - [counts] opt-in "Share anonymous weekly counts": life stage group + yes/no event flags,
     at most once a day, on a later day than the check-in (lib/pulse.js); the server
     keeps them only as weekly totals;
   - [ai] opt-in "Also ask Cyra's AI": only the typed question, and only when the
     on-device library has no answer (lib/askLibrary.js, runAsk below);
   - [wearables] opt-in Oura / Fitbit · Garmin · Whoop connections (lib/wearables.js): Oura
     readings pass through the server on each sync and are not kept; Fitbit/Garmin/
     Whoop readings wait in server memory (never on disk) for up to 7 days until this
     device collects them, and Terra keeps its own copy under its policy; the device
     sends its Oura tokens / Terra mailbox key in request bodies;
   - [webReminders] web reminders: the browser's push subscription (address and keys), reminder
     days, time and time zone (plus the last day a reminder went out, so there is never a
     second one) (lib/notifications.js); phone reminders are scheduled on the phone in every build;
   - [signin] Apple / Google / Facebook prefill of the name and email on step 1 (startSocial below);
   - only when she starts it: the encrypted backup file (lib/backup.js's file transport: a
     download, or the phone's share sheet), the doctor-summary email draft (mailto) and the
     copied summary text (ReportScreen). The encrypted backup goes only where she saves it:
     backup.js's cloud transport is unreachable in every build (its configured instance is
     imported by nothing, and plan.can("cloudBackup") is false);
   - user-started file exports (POTS report PDF/CSV, lib/files.js): a web download, or the
     phone share sheet via a plaintext file in the app cache that is deleted after sharing and
     swept at launch and wipe. No network. The POTS summary email draft and copied summary
     text work like the doctor summary (components/pots/PotsReport.jsx).
   A flag never deletes or changes what is recorded: a record from a build with more features
   keeps its wearable rows and connections, queues and choices, and this build just doesn't show,
   send or contact them (a queued weekly-counts tally is never sent; with webReminders off, a web
   push subscription left on is cancelled and its address forgotten at launch, which is clean-up).
   The web build's service worker (public/sw.js) shows reminders and keeps Cyra's own app files
   for offline use; it fetches only those files from the site that serves Cyra and never stores
   health data or any server answer (spec A14.1, lib/pwa.js).
   Backend requests use ./lib/api.js (fetch), except the sign-in [signin], Oura and Terra
   [wearables] connection windows. These are browser navigations to `${API_BASE}/api/oauth/:id/start`,
   `${API_BASE}/api/integrations/oura/start` and the Terra widget URL that
   /api/integrations/terra/session returns, and each one ends on a backend callback or
   done page (startSocial below; lib/wearables.js). A build without VITE_API_BASE makes
   neither kind. No Anthropic call and no API key exist in client code.

   This file owns ALL state and derived data (useState / useMemo only).
   Screens live in ./screens, one file per screen; shared pieces in
   ./components; constants and pure engine functions in ./lib.
   The saved record's shape, version and key lists live in ./lib/record.js; entitlements in ./lib/plan.js.
   ================================================================ */

import { SYMS, GSYM, ALL_SYM, SCORE_SCALE, SHELF, PALETTES, ORGS, SYM_FAMILY, PRENATAL, vizVars, rampOf } from "./lib/constants.js";
import { seed, fmt, addDays, routeIntake, insights, predict, whyNoPrediction, cycleSummary, cleanCycleFlags, toggleExclude, periodHead, basisLine, symBurden, scoreLabel, dayScore, isPeriodDay, trimesterOf, foldQuick, scoreRgb, scoreColorOf, inkOn } from "./lib/engine.js";
import { DEFAULT_APPEARANCE, SYSTEM_DARK_QUERY, cleanAppearance, resolveScheme, paletteFor, paletteVars, applyDocumentScheme } from "./lib/appearance.js";
import { API_BASE, apiFetch, apiPost, hasServer } from "./lib/api.js";
import { DEMO_WEARABLES, VIA_SERVER, connectSource, syncSource, disconnectSource, drainTerra, mergeRows, disconnectHelp } from "./lib/wearables.js";
import { eventsForDay, fetchPulse, pickStage, queueEvents, queueDue, flushQueue, pruneQueue, mergeQueues, localDay, weekKey } from "./lib/pulse.js";
import { answerLocally } from "./lib/askLibrary.js";
import { storage } from "./lib/storage.js";
import { PERSISTED, DEVICE_ONLY, DEVICE_PREFS, RECORD, RECORD_VERSION, migrate, backupCopy, entryFor, phaseOf } from "./lib/record.js";
import { trackedIds, cleanSymPrefs, cleanNote } from "./lib/daylog.js";
import { encryptBackup, decryptBackup, fileTransport, backupFileName } from "./lib/backup.js";
import { FEATURES, remindersInBuild } from "./lib/features.js";
import { fertPrivacyLine } from "./lib/disclosures.js";
import { fertShown, isTTC, cleanFertPrefs, restoredFertPrefs, defaultTempUnit, FERT_FORM_EMPTY, fertFormFrom, fertFormKey, fertTouched, fertRead, fertWindow, fertSummary, fertEmailLine, cleanFert, FERT_COPY } from "./lib/fertility.js";
import { syncReminders, wantsReminders, forgetOnServer, forgetOnServerWhy, knownEndpoints, unsubscribeBrowser, support as reminderSupport } from "./lib/notifications.js";
import { isNative, platform, appReturnUrl, newAppVerifier, waitForAppUrl, App as CapApp, Filesystem, Directory, Encoding, Share } from "./lib/native.js";
import { POTS_EMPTY, freshEmpty, cleanPots, isLockedPots, mergePots, samePots, newEpoch, eraseLog, turnOn, turnOff, resetPregClearance, localeUnits, dayTotals, markOffered, markStaleRunning, logDose, addIntake, intakeToast, asksSodium, removeItem as removePotsItem, setSettings as setPotsSettings, newId as newPotsId, nowHHMM } from "./lib/pots.js";
import { intakeText as potsIntakeText, ampm as potsAmpm } from "./components/pots/ui.js";
import { registerWorker, whenActive, hasShellCache, checkForUpdate, applyUpdate, clearShellCaches, displayStandalone, currentInstallMode, listenForInstall, promptInstall, cleanInstallHint, mergeInstallHint, showInstallHint, offersInstall } from "./lib/pwa.js";

const DEMO_SEED = import.meta.env.VITE_DEMO_SEED === "true";
// The encrypted backup's file transport (lib/backup.js): a download in a browser, the share sheet on a phone.
const backupFile = fileTransport({ isNative, Filesystem, Directory, Encoding, Share });
// A stable empty list for what a build without a feature passes down (PotsPatterns' memo doesn't recompute).
const NO_ROWS = Object.freeze([]);
const recordSig = (o) => JSON.stringify(RECORD.map((k) => o?.[k] ?? null));
// The tab bar scrolls sideways. Chromium doesn't scroll a partly hidden tab into view when the
// keyboard focuses it, so a focused tab (and its ring) could sit half off the edge. Only keyboard
// focus counts, and only the tab bar moves (sideways): scrollIntoView would also scroll the page,
// and a tab that kept focus after a tap gets focus again when she comes back to the app.
const tabIntoView = (e) => {
  const t = e.currentTarget, bar = t.parentElement;
  if (!bar || !t.matches?.(":focus-visible")) return;
  const tr = t.getBoundingClientRect(), br = bar.getBoundingClientRect();
  if (tr.left < br.left) bar.scrollLeft -= br.left - tr.left;
  else if (tr.right > br.right) bar.scrollLeft += tr.right - br.right;
};
/* APG tabs keyboard: only the selected tab is in the Tab order (roving tabindex); Left/Right/Home/End
   move focus among the tabs without selecting (activation stays on click, Enter or Space). */
const tabKeys = (e) => {
  const keys = { ArrowRight: 1, ArrowLeft: -1, Home: 0, End: 0 };
  if (!(e.key in keys)) return;
  const tabs = [...(e.currentTarget.parentElement?.querySelectorAll('[role="tab"]') || [])];
  if (!tabs.length) return;
  const i = tabs.indexOf(e.currentTarget);
  const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (i + keys[e.key] + tabs.length) % tabs.length;
  e.preventDefault(); tabs[next].focus();
};
/* The tab strip advertises its overflow: data-start / data-end on the sticky wrap drive the two edge fades. */
const tabEdges = (bar) => ({ start: bar.scrollLeft > 4, end: bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - 4 });
const ZERO_SCALES = { fatigue: 0, pain: 0, moodq: 0, stress: 0 };
/* Push addresses Cyra's server still has to forget (every one is retried until confirmed). */
const cleanPending = (v) => (Array.isArray(v) ? [...new Set(v.filter((e) => typeof e === "string" && /^https:\/\//.test(e) && e.length <= 2048))].slice(0, 100) : []);
/* Fitbit/Garmin/Whoop disconnects Cyra's server couldn't confirm: { key } (or { ref } from an
   older version), kept on this device and asked again until the server confirms. */
const offId = (x) => x.key || x.ref;
const cleanTerraOff = (v) => {
  if (!Array.isArray(v)) return [];
  const ok = v.filter((x) => x && ((typeof x.key === "string" && /^[A-Za-z0-9_-]{43,128}$/.test(x.key)) || (typeof x.ref === "string" && /^[0-9a-f]{32}$/.test(x.ref))))
    .map((x) => (typeof x.key === "string" && x.key ? { key: x.key } : { ref: x.ref }));
  return ok.filter((x, i) => ok.findIndex((y) => offId(y) === offId(x)) === i).slice(0, 20);
};
import Shell from "./components/Shell.jsx";
import ScoreMeter from "./components/ScoreMeter.jsx";
import ScaleSection from "./components/ScaleSection.jsx";
import BodySignals from "./components/BodySignals.jsx";
import FertilitySigns from "./components/FertilitySigns.jsx";
import QuickCheckin from "./components/QuickCheckin.jsx";
import SettingsSheet from "./components/SettingsSheet.jsx";
import PaletteSheet from "./components/PaletteSheet.jsx";
import Icon from "./components/Icon.jsx";
import { UpdateRow } from "./components/Pwa.jsx";
import { reduceMotion } from "./lib/motion.js";
import SplashScreen from "./screens/SplashScreen.jsx";
import RecordUnavailableScreen from "./screens/RecordUnavailableScreen.jsx";
import RegisterScreen from "./screens/RegisterScreen.jsx";
import IntakeScreen from "./screens/IntakeScreen.jsx";
import HomeScreen from "./screens/HomeScreen.jsx";
import { PatternsCard, windowDays } from "./components/PatternCharts.jsx";
import TodayScreen from "./screens/TodayScreen.jsx";
import CalendarScreen from "./screens/CalendarScreen.jsx";
import PatternsScreen from "./screens/PatternsScreen.jsx";
import ReportScreen from "./screens/ReportScreen.jsx";
import CareScreen from "./screens/CareScreen.jsx";
import AskScreen from "./screens/AskScreen.jsx";
import ConnectScreen from "./screens/ConnectScreen.jsx";
import PregTodayScreen from "./screens/PregTodayScreen.jsx";
import PregCalendarScreen from "./screens/PregCalendarScreen.jsx";
import MilestonesScreen from "./screens/MilestonesScreen.jsx";
import PotsScreen from "./screens/PotsScreen.jsx";
import PotsToday from "./components/pots/PotsToday.jsx";
import PotsSettings from "./components/pots/PotsSettings.jsx";
import PotsHome, { PotsOffer } from "./components/pots/PotsHome.jsx";
import GoalSheet from "./components/pots/GoalSheet.jsx";
import { MedSetup } from "./components/pots/MedEditor.jsx";
import { StandRunner, StandSection } from "./components/pots/StandTest.jsx";
import MovePlan from "./components/pots/MovePlan.jsx";
import { SessionRunner } from "./components/pots/MoveSession.jsx";
import PotsReport from "./components/pots/PotsReport.jsx";
import PotsPatterns from "./components/pots/PotsPatterns.jsx";

/* Stage card -> life-stage experience (spec §4.3). finishReg routes with it; RegisterScreen colours each card's
   swatch and the chrome preview (regPal) from PALETTES[REG_STAGE[label]][0]. Exactly one experience per user. */
export const REG_STAGE = { "My Cycle": "periods", "Trying to conceive": "periods", "Pregnant": "preg", "Perimenopause": "peri", "Menopause & beyond": "peri" };

export default function CyraDemo() {
  const [orgId, setOrgId] = useState("cyra");
  const [palIdx, setPalIdx] = useState({ peri: 0, preg: 0, periods: 0 });
  const [showPal, setShowPal] = useState(false);
  const [phase, setPhase] = useState("splash"); // splash -> register (8 steps) -> app
  const [showTable, setShowTable] = useState(false);
  const [conn, setConn] = useState({ closeness: 5, desire: 5, friction: 2, load: 5 });
  const [intimacy, setIntimacy] = useState(null);
  const [after, setAfter] = useState(null);
  const [relationship, setRelationship] = useState(null);
  const [connLog, setConnLog] = useState({});
  const [cadence, setCadence] = useState("daily");
  const [quietHours, setQuietHours] = useState("evening");
  const [showSettings, setShowSettings] = useState(false);
  const settingsBtnRef = useRef(null), palBtnRef = useRef(null); // the header buttons a closed sheet hands focus back to (UI S1)
  const [quickMode, setQuickMode] = useState(true);
  const [expanded, setExpanded] = useState(false); // Today: "more detail" opened the full form for this visit (UI state only, never saved; quickMode is the preference)
  const [meds, setMeds] = useState([]);
  const [medLog, setMedLog] = useState({});
  const [newMed, setNewMed] = useState({ name: "", kind: "supp", started: localDay() });
  const [showMeds, setShowMeds] = useState(false);
  const [appts, setAppts] = useState([]);
  const [newAppt, setNewAppt] = useState({ date: "", who: "", note: "" });
  const [showAppts, setShowAppts] = useState(false);
  const [journal, setJournal] = useState({});
  const [jDraft, setJDraft] = useState("");
  const [showJournal, setShowJournal] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [socialBusy, setSocialBusy] = useState(null);
  const [wearSources, setWearSources] = useState({});
  const [terraOff, setTerraOff] = useState([]); // unconfirmed Fitbit/Garmin/Whoop disconnects, asked again until confirmed
  const [wearData, setWearData] = useState([]);
  const [showWear, setShowWear] = useState(false);
  const [regStep, setRegStep] = useState(0);
  const [regTouched, setRegTouched] = useState({});
  // Registration answers are stored on this device. The only ones that ever reach a server
  // are opt-ins: with "Remind me" in a web browser (builds with webReminders), the reminder days,
  // time and time zone go to Cyra's server for web push; with weekly counts on (builds with
  // counts), the life-stage group goes out with the tallies; sign-in prefill (builds with signin)
  // puts the provider's name and email in server memory for at most 5 minutes. They also leave inside any encrypted backup she exports (the ZIP and age
  // band are left out). There is no Cyra account, so there is no password; name and email are
  // optional and are kept nowhere, not even on this device, in Anonymous Mode.
  const [reg, setReg] = useState({
    name: "", email: "", anon: false, age: null, zip: "",
    stage: null, cycleLen: null, cycleReg: null, lastPeriod: "",
    preg: null, births: null, contra: null,
    conditions: [], familyHx: [], meds: null,
    goals: [], sleep: null, activity: null,
    // Nothing is pre-ticked. notifOptin: reminders are off until she ticks "Remind me".
    // research: the "Share anonymous weekly counts" consent (also in Settings afterwards).
    notifOptin: false, research: false, terms: false,
  });
  const [acct, setAcct] = useState({ name: "", email: "", anon: false });
  const [research, setResearch] = useState(false); // "Share anonymous weekly counts" — see lib/pulse.js
  const [pulseQueue, setPulseQueue] = useState(null); // { day, stage, events } waiting on this device for a later launch
  const [pulseSent, setPulseSent] = useState(null); // { week, keys: ["stage|event"] } already sent this ISO week
  const [pulseLastSend, setPulseLastSend] = useState(null); // local day this browser / app install last sent a tally: at most one a day
  const [pulseRev, setPulseRev] = useState(0); // version of the sharing state above, so a stale tab can't roll it back
  const [askAI, setAskAI] = useState(false); // "Also ask Cyra's AI when the library has no answer" — off until she turns it on
  const [lastBackupAt, setLastBackupAt] = useState(null); // local day this device last made an encrypted backup (device-only, never in the file)
  /* Installable web app (spec A14.1, lib/pwa.js). installHint is persisted (device-only, never in
     a backup, only ever gets stronger: null → "dismissed" → "installed"); the rest is UI only. */
  const [installMode, setInstallMode] = useState("none"); // "none" | "prompt" | "ios" | "standalone"
  const [installHint, setInstallHint] = useState(null);
  const [updateReady, setUpdateReady] = useState(false); // an updated worker is waiting: the header shows "A new version of Cyra is ready · Reload"
  const [offlineReady, setOfflineReady] = useState(false); // the worker is active and its cyra-shell-* cache exists: Your data says so
  const [settingsFocus, setSettingsFocus] = useState(null); // null | "install": Settings opens on its Install group (Home's iOS tip)
  const [stage, setStage] = useState(null);
  const [stageName, setStageName] = useState("");
  const [ob, setOb] = useState({ step: 0, preg: null, age: null, per: null, vms: null });
  const [obBusy, setObBusy] = useState(false);
  const [welcome, setWelcome] = useState("");
  const [appTab, setAppTab] = useState("patterns");
  const [days, setDays] = useState(() => (DEMO_SEED ? seed() : []));
  const [draft, setDraft] = useState({});
  const [dayNote, setDayNote] = useState(""); // the check-in form's day note (L6), saved on the entry as note
  const [sleepQ, setSleepQ] = useState(null);
  const [kicks, setKicks] = useState(0);
  const [kickTally, setKickTally] = useState(null); // { day, n }: today's kick count, kept on the device between taps (before Save today)
  const [pregTab, setPregTab] = useState("home");
  const [pregLog, setPregLog] = useState({});
  const [pregSel, setPregSel] = useState(null);
  const [scales, setScales] = useState({ fatigue: 0, pain: 0, moodq: 0, stress: 0 });
  const [flow, setFlow] = useState(null);
  const [disch, setDisch] = useState(null);
  const [odor, setOdor] = useState(null);
  const [bodyOdor, setBodyOdor] = useState(null);
  const [showBody, setShowBody] = useState(false);
  const [askQ, setAskQ] = useState("");
  const [askBusy, setAskBusy] = useState(false);
  const [askOut, setAskOut] = useState(null);
  const [selDay, setSelDay] = useState(null);
  const [editDate, setEditDate] = useState(null);
  const [editPeriod, setEditPeriod] = useState(false);
  const [toast, setToast] = useState("");
  const [tabEdge, setTabEdge] = useState({ start: false, end: false }); // which edges of the tab strip are scrolled against
  const [repaint, setRepaint] = useState(false); // true for --t-slow after a palette change: chrome colours crossfade together
  /* Appearance (L2, spec §8.4): her choice (persisted, a DEVICE_PREFS key), the device's own light/dark
     setting (matchMedia, followed live) and whether a print is under way (always light). */
  const [appearance, setAppearance] = useState(DEFAULT_APPEARANCE);
  const [systemDark, setSystemDark] = useState(() => typeof matchMedia === "function" && matchMedia(SYSTEM_DARK_QUERY).matches);
  const [printing, setPrinting] = useState(false);
  const scheme = resolveScheme(appearance, systemDark, printing);
  const [hydrated, setHydrated] = useState(false);
  const [recordUnavailable, setRecordUnavailable] = useState(false); // phone: the record exists but can't be read right now
  const [recordLocked, setRecordLocked] = useState(false); // iOS: unreadable because the phone is locked (file protection)
  const [storageDriver, setStorageDriver] = useState(null); // where the record really is, for Settings → Your data (null until probed)
  const [holdWeek, setHoldWeek] = useState(null); // the week-only hold (lib/storage.js), so Delete everything can say it stays
  const [regAnswers, setRegAnswers] = useState(null); // registration answers (no name or email in Anonymous Mode)
  // Cycles she left out of predictions, { [startIso]: { exclude: true } }; part of the record and of backups (L5).
  const [cycleFlags, setCycleFlags] = useState({});
  // Her symptom list per stage id, { periods?, peri?, preg? } × { order, hidden, added } (lib/daylog.js); part of the record and of backups (L6).
  const [symPrefs, setSymPrefs] = useState({});
  /* Fertility signs (L7, decision D6; lib/fertility.js): fertSigns = { on, unit } is part of the record and of backups
     (on null = the stage default: on for Trying to conceive, off for My Cycle); fert is the check-in form's group
     (form state, saved on the day entry as cm / opk / bbt). Shown only in stage periods (fertShown), never sent anywhere. */
  const [fertSigns, setFertSigns] = useState({ on: null, unit: null });
  const [fert, setFert] = useState(FERT_FORM_EMPTY);
  const fertOn = fertShown(stage, stageName, fertSigns.on);
  const ttc = isTTC(stage, stageName);
  const tempUnit = fertSigns.unit || defaultTempUnit(typeof navigator !== "undefined" ? navigator.language : "");
  const setTempUnit = (u) => setFertSigns((p) => ({ ...p, unit: u }));
  const [reminders, setReminders] = useState({ enabled: false, status: "off", endpoint: null, pending: [], rev: 0 }); // status: off | on | blocked (+denied) | unavailable | error | unsupported; pending: push addresses the server still has to forget
  /* POTS add-on (lib/pots.js, spec A13): one persisted key, part of the on-device record, never
     sent anywhere and never part of weekly counts. An older record without it keeps this
     default, which is "off". A `pots` written by a newer build is kept untouched and shown
     read-only (isLockedPots). Every POTS write goes through a functional updater with a
     lib/pots.js action, each of which leaves a locked record unchanged. */
  const [pots, setPots] = useState(POTS_EMPTY);
  const [potsSec, setPotsSec] = useState("today"); // the POTS tools page's section (UI only, not saved)
  const [potsOpen, setPotsOpen] = useState(false); // POTS tools open as a page under the current tab (UI only)
  const [potsHomeLast, setPotsHomeLast] = useState(null); // Home "POTS today": the dose ("Took it") or drink ("+ Add") it just logged, for its Undo row (UI only)
  const [potsDate, setPotsDate] = useState(null); // POTS → Today's logging day while fixing up an earlier one; null = today (UI only, so every launch starts on today)
  const potsBase = useRef(null); // the `pots` this tab last saved or took from storage: the base of the 3-way merge (mergePots)
  /* The standing test or session running in this tab (UI only, never saved): while it is set the
     runner takes over the page (see the render below). { kind: "test", id, phase, phaseStart,
     standAt, done: [checkpoint keys handled], interrupt, ... } (components/pots/StandTest.jsx), or
     { kind: "session", id, day, phase, phaseStart, plan, paused, pausedMs, ... }
     (components/pots/MoveSession.jsx). */
  const [potsRun, setPotsRun] = useState(null);
  /* One-shot focus request for a POTS section ("stand" | "move" | null): set when a test or
     session ends, or by Today's "Start a stand test", and cleared by the section once it has
     moved focus to its heading, so a later chip tap to that section leaves focus on the chip. */
  const [potsFocus, setPotsFocus] = useState(null);
  const potsFocused = () => setPotsFocus(null);
  const wipingRef = useRef(false); // Delete everything / Start over in progress: nothing may be saved any more
  const saveTimer = useRef(null);  // the pending autosave, cancelled by a wipe
  const pendingSave = useRef(null); // that autosave's write, run at once when the app is hidden or closed (flushSave)
  const lastSig = useRef(null);     // the record this tab last saved or took over from another tab
  const skipSig = useRef(null);     // a record just taken over from another tab, not to be written back
  const lastSave = useRef(null);    // the latest save's promise (settleSaves waits for it before an update reload)
  const updating = useRef(false);   // Reload for an update is under way
  const cancelSave = () => { clearTimeout(saveTimer.current); pendingSave.current = null; };
  // Resolves when that write is done (Promise.resolve() when nothing is pending); the pagehide and visibility callers ignore it.
  const flushSave = () => { const run = pendingSave.current; if (!run) return Promise.resolve(); clearTimeout(saveTimer.current); pendingSave.current = null; return run(); };
  const settleSaves = async () => { await flushSave(); try { await lastSave.current; } catch { /* reported by the save itself */ } };

  const org = ORGS[orgId];
  const stagePal = stage && orgId === "cyra" ? PALETTES[stage][palIdx[stage]] : null;
  // Registration: from the moment she picks a stage card, the chrome wears that stage's first palette
  // (the same one finishReg lands on), so the choice shows before the app does. UI palette only.
  const regPal = phase === "register" && reg.stage ? PALETTES[REG_STAGE[reg.stage]][0] : null;
  // The seven UI tokens for the scheme on screen (each palette's light values or its `dark` object).
  const t = { ...paletteFor(org.theme, scheme), ...(stagePal ? paletteFor(stagePal, scheme) : regPal ? paletteFor(regPal, scheme) : {}) };
  /* The tracked list (L6): her stage's library plus what she added from the other one, hidden ones included
     (lib/daylog.js trackedIds). Every insight, chart, calendar card, report row and the doctor email runs on it,
     so a hidden chip still counts. */
  const symIds = useMemo(() => (stage === "periods" || stage === "peri" ? trackedIds(stage, symPrefs) : SYMS), [stage, symPrefs]);
  const symMap = useMemo(() => Object.fromEntries(symIds.map((id) => [id, ALL_SYM[id]])), [symIds]);
  const ins = useMemo(() => insights(days, symIds), [days, symIds]);
  /* Care: items for this stage, the ones that fit what she logged in the last 30 days first
     (most-logged match first), then in shelf order. Matching runs here, on the device. */
  const shelfItems = useMemo(() => {
    const pool = [...ins.counts, { id: "rough", label: "Rough nights", days: ins.roughNights }];
    const best = (s) => pool.filter((c) => s.m.includes(c.id) && c.days > 0).sort((a, b) => b.days - a.days)[0] || null;
    return SHELF.filter((s) => s.stages.includes(stage) && (!org.partnerIds || org.partnerIds.includes(s.id)))
      .map((s, i) => ({ ...s, top: best(s), order: i }))
      .sort((a, b) => (b.top?.days || 0) - (a.top?.days || 0) || a.order - b.order);
  }, [ins, stage, org.partnerIds]);
  /* This device's calendar day, never the UTC date. Kept as state so the whole app moves to the
     new day together: at local midnight (a timer, checked at least once a minute, since timers
     pause while a device sleeps) and whenever the app comes back (visible, focused, resumed or
     restored), so nothing logged after midnight is filed under the day before. */
  const [todayIso, setTodayIso] = useState(() => localDay());
  const syncDay = () => { const now = localDay(); setTodayIso((cur) => (cur === now ? cur : now)); return now; };
  const isMeno = phaseOf(stage, stageName) === "meno";
  /* Predictions (L5, spec §6.2): the median of her last up-to-6 kept cycles (the ones she didn't mark "Don't use"),
     a likely-start range, and an honest reason when there is none. Until two cycles are kept they start from the
     registration answers (last period, usual length). No period prediction in pregnancy or menopause. */
  const prior = stage === "preg" ? null : regAnswers;
  const predOpts = { flags: cycleFlags, stage, isMeno, today: todayIso };
  const pred = useMemo(() => predict(ins, prior, predOpts), [ins, regAnswers, stage, isMeno, cycleFlags, todayIso]); // eslint-disable-line
  const predWhy = useMemo(() => (pred ? null : whyNoPrediction(ins, prior, predOpts)), [pred, ins, regAnswers, stage, isMeno, cycleFlags, todayIso]); // eslint-disable-line
  // "Your cycles" on the Calendar and the labelled clinical lists (Patterns, Report).
  const cyc = useMemo(() => cycleSummary(ins, cycleFlags, todayIso, pred?.usedStarts || []), [ins, cycleFlags, todayIso, pred]);
  // Her tap on "Don't use" (Calendar → Your cycles). Cyra only suggests; nothing else changes cycleFlags.
  const setCycleUse = (start, exclude) => {
    setCycleFlags((f) => toggleExclude(f, start, exclude));
    ping(exclude ? `Cycle from ${fmt(start)} left out of predictions. Your Report still counts it.` : `Cycle from ${fmt(start)} is used for predictions again.`);
  };
  const pregWeek = 22, trimester = 2;
  const tri = trimesterOf(pregWeek); // "first" | "second" | "third", for the Home greeting and week bar
  const dueDate = new Date(Date.now() + (40 - pregWeek) * 7 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const toastTimer = useRef(null);
  /* A toast stays long enough to be read: 2.6s for a short one, then 1s + 35ms per character (a 70-character
     sentence shows for 3.5s, 180 characters for 7.3s), capped at 8s: the web-live suite waits 10s for a toast
     to clear and the native suite reads the toast about 4s after a 70-character one appears. */
  const setFertOn = (on) => { setFertSigns((p) => ({ ...p, on })); ping(on ? FERT_COPY.toastOn : FERT_COPY.toastOff); };
  const ping = (m) => { clearTimeout(toastTimer.current); setToast(m); const ms = Math.min(8000, Math.max(2600, 1000 + m.length * 35)); toastTimer.current = setTimeout(() => setToast(""), ms); };
  // Milestones → Appointments bridge (UI M1, spec A4/A10): a now/soon roadmap item prefills the add-appointment note
  // and opens Home with the Appointments panel out; the person picks the date. `when` is the item's eyebrow text.
  const onPlan = (label, when) => { setNewAppt((a) => ({ ...a, note: `${label} (${when.charAt(0).toLowerCase()}${when.slice(1)})` })); setShowAppts(true); setPregTab("home"); ping("Added to Appointments — pick the date"); };

  /* The doctor email: everything in it comes from one window — the last 30 calendar days —
     and the denominator is the number of days she actually logged in it. */
  // questions: scripts she picked on the Report ("Add to email"), listed before the sign-off.
  const buildEmail = (questions = []) => {
    const subject = `Symptom summary ahead of my appointment${acct.name ? ` — ${acct.name}` : ""}`;
    const n = ins.last30.length;
    let fertLine = null;
    const lines = [
      `Hi — ahead of my appointment, a brief summary of the last 30 days (I logged ${n} of them in ${org.name}):`,
      ``,
      ...ins.counts.filter((c) => c.days > 0).slice(0, 4).map((c) => `• ${c.label}: ${c.days} of ${n} logged days (${c.strong} moderate-to-strong)`),
      ...(ins.lens30.length >= 1 ? [``, `• Cycle length${ins.lens30.length > 1 ? "s" : ""} in these 30 days: ${ins.lens30.join(", ")} days${ins.variability30 != null ? ` (${ins.variability30}-day spread)` : ""}`] : []),
      // Trying to conceive with fertility signs shown (L7): one line, from the same 30 days, only when something was logged.
      ...(ttc && fertOn && (fertLine = fertEmailLine(fertSummary(ins.sorted, { from: addDays(todayIso, -29), to: todayIso }))) ? [``, fertLine] : []),
      ...(stage === "peri" && ins.hfMult30 ? [`• Hot flashes were ${ins.hfMult30.toFixed(1)}x more likely after poorly-rated nights`] : []),
      ...(questions.length ? [``, `Questions I'd like to cover:`, ...questions.map((q, i) => `${i + 1}. ${q}`)] : []),
      ``,
      `Happy to share the full day-by-day log at the visit. Thank you!`,
    ];
    return { subject, body: lines.join("\n") };
  };

  /* ---------- Ask Cyra: plain-language evidence Q&A ----------
     The written library answers on this device first (red flags included) and nothing is
     sent. Only when she has turned on "Also ask Cyra's AI" AND the library has no answer
     does the question go to Cyra's backend, which forwards the text verbatim to
     Anthropic. The request body is { question } alone — no stage, name, account or entry
     log — though whatever she typed goes as typed, and like any request it carries the
     device's IP address and user agent. A build without the ai flag (or without a server)
     never offers it: Ask then answers from the library only. */
  const aiAvailable = FEATURES.ai && !!API_BASE;
  // q: a question string (a Patterns "Ask about this →" or a starter) or the Ask button's click event
  // (then the textarea's text); ai overrides the saved "Also ask Cyra's AI" choice for this one call.
  const runAsk = async (q, { ai } = {}) => {
    const question = (typeof q === "string" ? q : askQ).trim().slice(0, 500);
    const useAI = ai ?? askAI;
    if (!question) return ping("Type a question first");
    const local = answerLocally(question);
    if (local.matched || !useAI || !aiAvailable) {
      setAskOut({ source: "library", question, ...local, offerAI: !local.matched && !useAI && aiAvailable });
      return;
    }
    setAskBusy(true); setAskOut(null);
    try {
      const out = await apiPost("/api/ai/ask", { question });
      // degraded: the server did ask Cyra's AI, but no AI answer came back (refusal, timeout, error)
      setAskOut({ source: out.provider === "rules" ? (out.degraded ? "server-library-attempted" : "server-library") : "ai", question, answer: out.answer, source_note: out.source_note || null, ask_your_doctor: out.ask_your_doctor || null, urgent: !!out.urgent });
    } catch (e) {
      const answer = e?.status === 429 ? "Too many questions in a minute — try again shortly." : e?.status === 400 ? "Please type a slightly longer question." : "No answer came back from Cyra's AI. Check your connection and try again, or write the question down and bring it to your next visit.";
      setAskOut({ source: "error", question, answer, source_note: null, ask_your_doctor: null, urgent: false });
    }
    setAskBusy(false);
  };

  /* ---------- day score: 0 (rough) .. 1 (great) ---------- */
  const draftIds = stage === "preg" ? Object.keys(GSYM) : symIds;
  /* The day-score divisor (spec §6.3): the stage's library size when the score was defined, so neither Low energy
     nor her list rescales a past day (lib/constants.js SCORE_SCALE). */
  const scoreScale = SCORE_SCALE[stage];
  const scoreDay = (e, ids) => dayScore(e, ids, scoreScale);
  // Quick answers (q1-q3) count as the hero symptoms they are saved as, so the live meter agrees with the day's saved score.
  const liveDraft = stage === "preg" ? draft : foldQuick(draft, stage);
  const liveBurden = Math.min(1,
    symBurden(liveDraft, draftIds, scoreScale) * 0.5 +
    (scales.fatigue / 10) * 0.2 +
    (scales.pain / 10) * 0.2 +
    ((10 - scales.moodq) / 10) * 0.1
  );
  const liveScore = 1 - liveBurden; // 1 = great day
  /* Honest meter: nothing reads as scored until something is logged. Computed from the same form state the
     score and the save use (symptom chips, quick answers, sleep, scales, body signals, kicks). */
  const touched = draftIds.some((id) => (draft[id] || 0) > 0) || ["q1", "q2", "q3"].some((k) => draft[k] != null) || !!sleepQ
    || Object.values(scales).some((v) => v > 0) || !!flow || !!disch || !!odor || !!bodyOdor || kicks > 0 || fertTouched(fert);
  /* Data-viz ramp: saturated and readable, independent of UI chrome colors; its dark steps on a dark card
     (lib/constants.js rampOf). Score fill and the ink on it come from lib/engine.js. */
  const ramp = () => rampOf(stage, scheme);
  const scoreColor = (s) => scoreColorOf(s, ramp());
  // Ink for text drawn on a score fill (calendar digits, the day card's score pill): black or white, >= 4.5:1.
  const scoreInk = (s) => inkOn(scoreRgb(s, ramp()));

  /* ======================= HOME ======================= */
  const goTab = (t2) => (stage === "preg" ? setPregTab(t2) : setAppTab(t2));
  const entryOn = (iso) => (stage === "preg" ? pregLog[iso] : entryFor(days, iso));
  const scoreOn = (iso) => { const e = entryOn(iso); return e ? scoreDay(e, stage === "preg" ? Object.keys(GSYM) : symIds) : null; };
  // Today's status lines: whether today is already in the record and whether yesterday is missing (computed on render, never stored).
  const savedToday = stage === "preg" ? !!pregLog[todayIso] : days.some((d) => d.date === todayIso);
  const yesterdayIso = (() => { const d = new Date(todayIso + "T12:00:00"); d.setDate(d.getDate() - 1); return localDay(d); })();
  const yesterdayLogged = !!entryOn(yesterdayIso);

  /* ---------- the check-in form (Today) ----------
     The form always opens on what is saved for the day it edits, so saving again updates
     that entry instead of replacing it with a blank form: today's entry at launch, when the
     day changes and when the stage changes; a Calendar day while it is being edited (today's
     unsaved form is put aside and comes back afterwards). Today's kick count is also kept on
     the device between taps (kickTally), so a relaunch never shows fewer kicks. */
  const formFrom = (e, tally = 0) => ({
    draft: e ? { ...(e.sym || {}) } : {}, sleepQ: e?.sleepQ ?? null, scales: { ...ZERO_SCALES, ...(e?.scales || {}) },
    flow: e?.flow ?? null, disch: e?.disch ?? null, odor: e?.odor ?? null, bodyOdor: e?.bodyOdor ?? null, kicks: Math.max(e?.kicks || 0, tally),
    note: cleanNote(e?.note), fert: fertFormFrom(e, tempUnit),
  });
  const formFor = (iso) => formFrom(entryOn(iso), stage === "preg" && iso === todayIso && kickTally?.day === iso ? kickTally.n || 0 : 0);
  // A form's contents for comparing (unset symptoms, key order and the quick-answer bookkeeping
  // __q, which a saved quick check-in keeps in the form, don't count; an unanswered sleep
  // question saves as "fair"; the day note compares trimmed, as it is saved).
  const formKey = (f) => JSON.stringify([Object.entries(f.draft || {}).filter(([k, v]) => v && k !== "__q").sort(), f.sleepQ || "fair", Object.entries(f.scales || {}).sort(), f.flow ?? null, f.disch ?? null, f.odor ?? null, f.bodyOdor ?? null, f.kicks || 0, (f.note || "").trim(), fertFormKey(f.fert, tempUnit)]);
  const applyForm = (f) => { setDraft(f.draft); setSleepQ(f.sleepQ); setScales(f.scales); setFlow(f.flow); setDisch(f.disch); setOdor(f.odor); setBodyOdor(f.bodyOdor); setKicks(f.kicks); setDayNote(f.note || ""); setFert(f.fert || FERT_FORM_EMPTY); };
  const editSnap = useRef(null); // today's form, put aside while another day is edited
  const formStage = useRef(null);
  const formDay = useRef(null); // the day the open form was loaded for
  const [formRev, setFormRev] = useState(0); // bumped when the record is replaced (backup restored, another tab saved)
  useEffect(() => {
    if (!hydrated || !stage) return;
    const f = formFor(todayIso);
    setExpanded(false); // a new day (or stage, or a restored record) opens Today in the chosen mode again
    const sameStage = formStage.current === stage; formStage.current = stage;
    const prevDay = formDay.current; formDay.current = todayIso;
    if (editDate && sameStage) { editSnap.current = f; return; } // an edit stays open; today's form comes back after it
    // Midnight (or a resume next morning) with a check-in half filled in: it stays open as an
    // edit of the day it was started on, so saving files it there, and nothing she picked is wiped.
    if (sameStage && prevDay && prevDay < todayIso && formKey({ draft, sleepQ, scales, flow, disch, odor, bodyOdor, kicks, note: dayNote, fert }) !== formKey(formFor(prevDay))) {
      editSnap.current = f; setEditPeriod(stage !== "preg" && isPeriodDay(entryOn(prevDay))); setEditDate(prevDay); return;
    }
    editSnap.current = null; setEditDate(null); applyForm(f);
  }, [hydrated, todayIso, stage, formRev]); // eslint-disable-line
  useEffect(() => { setExpanded(false); }, [quickMode]); // choosing a mode in Settings ends a per-visit expansion
  const startEdit = (iso) => {
    if (!editDate) editSnap.current = { draft, sleepQ, scales, flow, disch, odor, bodyOdor, kicks, note: dayNote, fert };
    applyForm(formFor(iso));
    setEditPeriod(stage !== "preg" && isPeriodDay(entryOn(iso)));
    setEditDate(iso); goTab("today");
  };
  // saved: the entry just saved for editDate (if that was today, the form now shows it).
  const endEdit = (saved) => {
    if (!editDate) return;
    const back = saved && editDate === todayIso ? formFrom(saved) : editSnap.current || formFor(todayIso);
    editSnap.current = null; setEditDate(null); applyForm(back);
  };
  const curTab = stage === "preg" ? pregTab : appTab;
  useEffect(() => { if (editDate && curTab !== "today") endEdit(); }, [curTab]); // eslint-disable-line -- leaving Today ends an edit
  // The selected tab is always fully inside the strip (a Home card can select Report, which starts off-screen).
  useEffect(() => { document.querySelector(".tab-on")?.scrollIntoView?.({ inline: "nearest", block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" }); }, [appTab, pregTab]);
  const measureTabs = (bar) => { if (!bar) return; const e = tabEdges(bar); setTabEdge((c) => (c.start === e.start && c.end === e.end ? c : e)); };
  useEffect(() => { // once on mount (and whenever the strip appears) plus on resize; scrolling the strip reports itself
    const bar = document.querySelector(".tabs"); measureTabs(bar);
    const onResize = () => measureTabs(document.querySelector(".tabs"));
    window.addEventListener("resize", onResize); return () => window.removeEventListener("resize", onResize);
  }, [stage]);
  const palFirst = useRef(true);
  useEffect(() => { // a palette change crossfades the chrome (cards, CTA, tabs) over --t-slow; chart colours are inline and do not transition
    if (palFirst.current) { palFirst.current = false; return; }
    setRepaint(true); const t = setTimeout(() => setRepaint(false), 400); return () => clearTimeout(t);
  }, [palIdx]);
  const regPalFirst = useRef(true);
  useEffect(() => { // the stage card tap recolours the registration chrome the same way (UI O1)
    if (regPalFirst.current) { regPalFirst.current = false; return; }
    if (phase !== "register") return;
    setRepaint(true); const t = setTimeout(() => setRepaint(false), 400); return () => clearTimeout(t);
  }, [reg.stage]);
  /* Appearance: an Appearance tap or a flip of the device's light/dark setting crossfades the chrome the
     same way. Never on hydrate, a cross-tab adopt or printing (those just switch). */
  const repaintTimer = useRef(null);
  const flashRepaint = () => { clearTimeout(repaintTimer.current); setRepaint(true); repaintTimer.current = setTimeout(() => setRepaint(false), 400); };
  const chooseAppearance = (v) => { const next = cleanAppearance(v); if (next === appearance) return; setAppearance(next); flashRepaint(); };
  /* The device's setting is followed live (System). Printing always renders the light palette: beforeprint
     (and matchMedia("print"), which also covers print previews) flips it with flushSync, so the page the
     browser snapshots is already light; afterprint flips it back. styles.js keeps a monochrome fallback for a
     print neither event reaches. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sys = typeof matchMedia === "function" ? matchMedia(SYSTEM_DARK_QUERY) : null;
    const pr = typeof matchMedia === "function" ? matchMedia("print") : null;
    const onSys = (e) => { setSystemDark(!!e.matches); flashRepaint(); };
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    const onPrint = (e) => (e.matches ? before() : after());
    sys?.addEventListener?.("change", onSys);
    pr?.addEventListener?.("change", onPrint);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      sys?.removeEventListener?.("change", onSys); pr?.removeEventListener?.("change", onPrint);
      window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after);
      clearTimeout(repaintTimer.current);
    };
  }, []); // eslint-disable-line

  /* ---------- POTS add-on: the switch and its one tab ----------
     Settings → Add-ons turns it on and off; it never changes the life stage, and changing stage
     keeps the log and the switch. It is an add-on, not a tab: while it is on, Home shows a "POTS
     today" card, and POTS tools open as a page under whichever tab she is on, with a Back button
     (a newer build's record that is switched on shows that page read-only). */
  const potsTab = pots?.on === true;
  // Turned off here, in another tab or by a restore: never leave her on a page that's gone.
  useEffect(() => { if (!potsTab && potsOpen) setPotsOpen(false); }, [potsTab, potsOpen]);
  const potsOn = () => {
    setPots((p) => turnOn(p, { day: todayIso, simple: quickMode, units: localeUnits() }));
    ping("POTS tools on. Open them from the POTS today card on Home");
  };
  // "Hide POTS tools (keep my POTS log)", or "Hide it and erase my POTS log" (a new epoch, so
  // no other open tab can merge the erased entries back).
  const potsOff = ({ erase = false } = {}) => {
    setPots((p) => turnOff(erase ? eraseLog(p) : p)); setPotsHomeLast(null);
    ping(erase ? "POTS log erased and POTS tools hidden" : "POTS tools hidden. Your POTS log is kept");
  };
  /* Home: the "POTS today" card while it's on (totals from dayTotals; "Today's insight" is never
     replaced; her usual drink logs in one tap through the same addIntake and intakeToast as the
     page, and a drink button that still has to ask its sodium opens the page instead), or, once, the offer card for someone who ticked "POTS or dysautonomia" at
     registration (owner decision D2). The offer never turns POTS on by itself, and answering it
     (either button) means it never comes back; it isn't shown to someone who has ever turned
     POTS on. The registration answer is read here, on screen, and nowhere else. */
  const potsOk = !isLockedPots(pots);
  // A record replaced mid-test by one this build can't read (another tab restored it) ends the run.
  useEffect(() => { if (potsRun && !potsOk) setPotsRun(null); }, [potsRun, potsOk]);
  const potsTotals = useMemo(() => dayTotals(pots, todayIso), [pots, todayIso]);
  // Home's Undo row shows only while that dose is still in the log: an erase, a restore, a
  // removal in Today's log or in another tab (or another tab having logged that dose first)
  // takes the row away, so it never offers to undo something that isn't there.
  const potsHomeLive = potsHomeLast && potsHomeLast.day === todayIso && ((((pots.days || {})[potsHomeLast.day] || {})[potsHomeLast.kind === "intake" ? "intake" : "doses"]) || []).some((x) => x && x.id === potsHomeLast.id) ? potsHomeLast : null;
  // POTS → Report reads the day's check-in only for the "also in check-in" lines, and only
  // while "Cycle or pregnancy details" is ticked (lib/potsReport.js). It never gets
  // registration answers or wearable readings.
  // A lookup built once per log change (the first entry for a date wins, as days.find did), so
  // Patterns and the report read a long log in one pass instead of searching it day by day.
  const potsCheckin = useMemo(() => {
    if (stage === "preg") return (iso) => pregLog[iso];
    const by = new Map();
    for (const d of days) if (d && !by.has(d.date)) by.set(d.date, d);
    return (iso) => by.get(iso);
  }, [stage, days, pregLog]);
  // POTS → Patterns compares watch and ring readings on screen only (never in a POTS file); HRV
  // only when exactly one source is connected (lib/potsPatterns.js). Cycle days and cycle groups
  // use the period starts her check-ins logged (ins.starts), in a cycle stage only.
  const potsWearConnected = useMemo(() => Object.entries(wearSources).filter(([, v]) => v && !v.pending && !v.demo).map(([k]) => k), [wearSources]);
  const potsCyc = useMemo(() => ({ starts: ins.starts, stageName }), [ins, stageName]);
  const potsOffer = potsOk && !pots.on && !pots.since && !pots.offered && Array.isArray(regAnswers?.conditions) && regAnswers.conditions.includes("POTS or dysautonomia");
  const openPots = (simple = false) => { if (simple) setPots((p) => setPotsSettings(p, { simple: true })); setPotsSec("today"); setPotsDate(null); setPotsOpen(true); };
  const openStandTest = () => { setPotsSec("stand"); setPotsOpen(true); };
  /* Every change of stage INTO Pregnancy asks the prenatal team's exercise answer again: a "yes"
     given before this pregnancy, or in an earlier one, never carries over. The answer is cleared
     by her own stage actions, never by what the record says the stage was: when she taps
     "<stageName> · change" (written to disk together with the empty stage, so a reload at the
     stage chooser can't bring it back) and again whenever she or registration picks Pregnancy.
     Loading, restoring or adopting a record isn't a change of stage, so a restore stays literal
     (D4) and another tab's fresh answer is never cleared here. */
  const chooseStage = (s) => { if (s === "preg") setPots(resetPregClearance); setStage(s); };
  const addKick = () => {
    const n = kicks + 1;
    setKicks(n);
    if (!editDate) setKickTally({ day: todayIso, n });
  };
  // A bleeding flow picked while editing a day marks it a period day (the switch can undo it).
  const pickFlow = (v) => { setFlow(v); if (editDate && v && v !== "spot") setEditPeriod(true); };
  const isoDaysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return localDay(d); };
  const loggedLast14 = Array.from({ length: 14 }, (_, i) => isoDaysAgo(i)).filter((iso) => !!entryOn(iso)).length;
  const streakLine = loggedLast14 >= 10 ? "That's a real record now." : loggedLast14 >= 5 ? "Patterns are starting to show." : "Every entry counts — nothing to catch up on.";

  /* Pulse ("You're not alone"): last closed week's anonymous counts, read ONCE per launch
     with no stage in the request; this device picks its own stage's numbers locally, so
     changing stage never asks again. A count shows only once k contributions are in.
     Sharing (opt-in, research === true): a check-in only queues yes/no flags on this
     device (saving that day again replaces them). Nothing is sent at check-in time; a
     launch on a later day sends at most one tally a day (enforced across tabs with a Web
     Lock and a stored send day), with no token or account; like any request it carries
     the IP address and user agent (see lib/pulse.js and flushPulse below).
     Every tab agrees on the sharing state (research, queue, what was sent, the send day):
     a consent change or a send bumps pulseRev and is told to the other tabs, and before
     each save a tab adopts a newer stored version. Turning sharing off is written to the
     device at once (inside the same Web Lock as a send) before it is confirmed, a send
     re-reads that stored switch and sends nothing once it is off, and a send never turns a
     stored "off" back on. */
  const [pulseAll, setPulseAll] = useState(null);
  // A build without the counts flag never reads or sends counts (Home then has no pulse section).
  const [pulseStatus, setPulseStatus] = useState(FEATURES.counts && API_BASE ? "loading" : "unavailable");
  const pulseRead = useRef(false);
  useEffect(() => {
    if (!FEATURES.counts || !stage || pulseRead.current || !API_BASE) return;
    pulseRead.current = true;
    fetchPulse().then((j) => { setPulseAll(j); setPulseStatus("ok"); }, () => setPulseStatus("offline"));
  }, [stage]);
  const pulse = useMemo(() => ({ items: stage ? pickStage(pulseAll, stage) : [], k: pulseAll?.k, status: pulseStatus }), [pulseAll, pulseStatus, stage]);
  const researchRef = useRef(research); researchRef.current = research;
  const pulseRevRef = useRef(pulseRev); pulseRevRef.current = pulseRev;
  // A check-in saved (again): its flags replace whatever that day's earlier save queued. An
  // edit of an earlier day (Calendar) can only take back flags still waiting for that day.
  const contribute = (events, dateIso = todayIso) => {
    if (!FEATURES.counts || !researchRef.current || !stage) return;
    const past = dateIso !== todayIso; // an earlier day's phase isn't known here, so it never yields mood_dip
    setPulseQueue((q) => queueEvents(q, pulseSent, stage, past ? events.filter((e) => e !== "mood_dip") : events, new Date(), { day: past ? dateIso : null }));
  };
  const nextRev = (other = 0) => Math.max(Date.now(), pulseRevRef.current + 1, other + 1);
  const adoptPulse = (p) => {
    const on = !!p.research;
    researchRef.current = on; pulseRevRef.current = p.pulseRev || 0;
    setResearch(on); setPulseQueue(on ? pruneQueue(p.pulseQueue, p.pulseSent) : null); setPulseSent(p.pulseSent ?? null);
    setPulseLastSend(p.pulseLastSend ?? null); setPulseRev(p.pulseRev || 0);
  };
  const tellPulse = (p) => { try { channel.current?.postMessage({ type: "pulse", ...p }); } catch { /* single tab */ } };
  const setSharing = async (on) => {
    const p = { research: !!on, pulseQueue: on ? pulseQueue : null, pulseSent, pulseLastSend, pulseRev: nextRev() };
    adoptPulse(p); tellPulse(p); // every tab stops (or starts) queuing at once
    if (on) { ping("Weekly counts on — flags from your check-ins go out on a later day, at most once a day"); return; }
    // Off is confirmed only once it is stored on this device, so no later launch can send.
    cancelSave();
    const write = async () => {
      const latest = await storage.load().catch(() => null);
      const base = latest && latest.v === RECORD_VERSION ? latest : snapshot();
      const rev = Math.max(p.pulseRev, (base.pulseRev || 0) + 1);
      await storage.save({ ...base, research: false, pulseQueue: null, pulseRev: rev, savedAt: new Date().toISOString() });
      return rev;
    };
    try {
      const locks = typeof navigator !== "undefined" ? navigator.locks : null;
      const rev = !isNative() && locks?.request ? await locks.request("cyra-pulse-flush", write) : await write();
      if (rev !== p.pulseRev) { const q = { ...p, pulseRev: rev }; adoptPulse(q); tellPulse(q); }
      setStorageDriver(storage.driver());
      ping("Stopped sharing weekly counts. Nothing more will be sent.");
    } catch {
      setStorageDriver(storage.driver());
      ping("Sharing is off, but Cyra couldn't save that, so it could turn back on next time — tap Turn on, then off again.");
    }
  };
  /* A stored sharing state newer than this tab's (another tab turned sharing off, or sent
     a tally) wins over what this tab is about to save. */
  const mergePulse = (snap, stored) => {
    if (!stored || stored.v !== RECORD_VERSION || !((stored.pulseRev || 0) > (snap.pulseRev || 0))) return snap;
    const on = !!stored.research, sent = stored.pulseSent ?? null;
    const queue = on ? mergeQueues(pruneQueue(snap.pulseQueue, sent), pruneQueue(stored.pulseQueue, sent)) : null;
    return { ...snap, research: on, pulseQueue: queue, pulseSent: sent, pulseLastSend: stored.pulseLastSend ?? null, pulseRev: stored.pulseRev };
  };

  // One stage per queue: when the stage changes (or is being chosen again), the old stage's
  // unsent flags are dropped in every tab, never sent.
  useEffect(() => {
    if (!hydrated || !pulseQueue || pulseQueue.stage === stage) return;
    const p = { research, pulseQueue: null, pulseSent, pulseLastSend, pulseRev: nextRev() };
    adoptPulse(p); tellPulse(p);
  }, [stage, hydrated]); // eslint-disable-line

  /* Monthly recap: last 30 vs the 30 before */
  const recap = (() => {
    const sorted = stage === "preg" ? Object.keys(pregLog).sort().map((k) => ({ date: k, ...pregLog[k] })) : ins.sorted;
    const ids = stage === "preg" ? Object.keys(GSYM) : symIds;
    const last30 = sorted.slice(-30), prev30 = sorted.slice(-60, -30);
    if (last30.length < 10 || prev30.length < 10) return null;
    const avg = (arr) => Math.round((arr.reduce((a, d) => a + scoreDay(d, ids), 0) / arr.length) * 100);
    const calm = (arr) => arr.filter((d) => scoreDay(d, ids) > 0.64).length;
    const poor = (arr) => arr.filter((d) => d.sleepQ === "poor").length;
    const top = ins.counts[0];
    const topN = (arr) => (top ? arr.filter((d) => ((d.sym || {})[top.id] || 0) > 0).length : 0);
    return { score: [avg(prev30), avg(last30)], calm: [calm(prev30), calm(last30)], poor: [poor(prev30), poor(last30)], top: top ? { label: top.label, prev: topN(prev30), now: topN(last30) } : null };
  })();

  /* Medication effects: 14 days before start vs 14 after, needs ≥5 logged each side. Only
     today and later days can still be logged, so a side that can no longer reach 5 says so
     (stuck) instead of counting down. */
  const medEffects = meds.map((m) => {
    const start = new Date(m.started + "T12:00:00");
    const before = [], afterArr = [];
    let openBefore = 0, openAfter = 0;
    for (let i = 1; i <= 14; i++) {
      const b = new Date(start); b.setDate(b.getDate() - i); const ib = localDay(b), sb = scoreOn(ib); if (sb != null) before.push(sb); else if (ib >= todayIso) openBefore++;
      const a = new Date(start); a.setDate(a.getDate() + i - 1); const ia = localDay(a), sa = scoreOn(ia); if (sa != null) afterArr.push(sa); else if (ia >= todayIso) openAfter++;
    }
    if (before.length < 5 || afterArr.length < 5) {
      const needBefore = Math.max(0, 5 - before.length), needAfter = Math.max(0, 5 - afterArr.length);
      return { ...m, ready: false, haveBefore: before.length, haveAfter: afterArr.length, needBefore, needAfter, stuckBefore: needBefore > openBefore, stuckAfter: needAfter > openAfter };
    }
    const av = (arr) => Math.round((arr.reduce((x, y) => x + y, 0) / arr.length) * 100);
    return { ...m, ready: true, before: av(before), after: av(afterArr) };
  });

  /* ---- Wearables: Apple Watch / Oura / Terra. DEMO seeding (build flag only) is shaped by
     stage and every seeded row is marked demo; production ingests real HealthKit/Health
     Connect readings on the phone and Oura/Terra through the integrations hub. ---- */
  const seedWear = (sourceId) => {
    const out = [];
    const cycleLen = pred ? pred.avgLen : 28;
    const lastStart = ins.starts.length ? new Date(ins.starts[ins.starts.length - 1] + "T12:00:00") : new Date();
    const nz = (i, s, amp) => ((Math.sin(i * 12.9898 + s * 78.233) * 43758.5453) % 1) * amp;
    for (let i = 30; i >= 1; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); const iso = localDay(d);
      const cd = (((Math.round((d - lastStart) / 86400000)) % cycleLen) + cycleLen) % cycleLen;
      let temp, rhr, hrv, sleep;
      if (stage === "periods") { const lut = i <= 12; temp = (lut ? 0.32 : 0.02) + nz(i, 1, 0.07); rhr = (lut ? 64 : 60) + nz(i, 2, 2); hrv = (lut ? 38 : 46) + nz(i, 3, 4); sleep = 74 + nz(i, 4, 8); }
      else if (isMeno) { temp = 0.03 + nz(i, 1, 0.06); rhr = 63 + nz(i, 2, 2); hrv = 36 + nz(i, 3, 4); sleep = 70 + nz(i, 4, 9); }
      else if (stage === "peri") { const poor = (days.find((x) => x.date === iso) || {}).sleepQ === "poor"; temp = (poor ? 0.38 : 0.08) + nz(i, 1, 0.1); rhr = 62 + (poor ? 4 : 0) + nz(i, 2, 2); hrv = (poor ? 30 : 40) + nz(i, 3, 4); sleep = (poor ? 54 : 72) + nz(i, 4, 7); }
      else { temp = 0.25 + nz(i, 1, 0.06); rhr = 73 + nz(i, 2, 2); hrv = 32 + nz(i, 3, 3); sleep = 66 + nz(i, 4, 8); }
      out.push({ date: iso, sourceId, demo: true, temp: +temp.toFixed(2), rhr: Math.round(rhr), hrv: Math.round(hrv), sleep: Math.round(sleep) });
    }
    return out;
  };
  const [wearBusy, setWearBusy] = useState(null);
  const [wearConfirm, setWearConfirm] = useState(null); // a server-mediated source whose disclosure card is open
  const restoredOuraGone = "The Oura connection in the backup no longer works, so it was removed from this device. Tap Connect to reconnect; if Cyra still shows in your Oura account's connected apps, you can remove it there.";
  const connectWear = async (id, label, { confirmed = false } = {}) => {
    if (!FEATURES.wearables || wearBusy) return;
    if (DEMO_WEARABLES) { // illustrative data, build-flag only; the UI says so
      if (wearSources[id]) return ping(`Demo mode — ${label} is already showing illustrative data`);
      if (wearData.length) return ping("Demo mode — no device connected; nothing was added");
      setWearSources((s) => ({ ...s, [id]: { connectedAt: Date.now(), demo: true } }));
      setWearData(seedWear(id));
      return ping(`Demo mode — ${label} isn't really connected; showing 30 days of illustrative data`);
    }
    const existing = wearSources[id];
    // Oura and Terra go through Cyra's server: say exactly what that means before every first connect.
    if (!existing && VIA_SERVER.has(id) && !confirmed && API_BASE) { setWearConfirm(id); return; }
    setWearConfirm(null);
    setWearBusy(id);
    try {
      // No await before connectSource: on the web its sign-in popup must open inside this tap.
      const result = existing ? await syncSource(id, existing) : await connectSource(id, { onStatus: ping, onPending: (st) => setWearSources((s) => ({ ...s, [id]: st })) });
      setWearSources((s) => ({ ...s, [id]: result.state }));
      setWearData((d) => mergeRows(d, result.rows));
      const n = result.rows.length;
      let msg = n ? `${label}: ${n} day${n === 1 ? "" : "s"} imported.` : existing ? `${label}: no new readings found.`
        : id === "terra" ? `${label} connected — no readings yet. They come in when you open Cyra or tap Sync.` : `${label} connected — no readings yet. Tap Sync to check again.`;
      if (result.notice) msg = `${msg} ${result.notice}`;
      ping(msg);
    } catch (e) {
      if (e?.code === "OURA_EXPIRED") setWearSources(({ oura, ...rest }) => rest); // Connect comes back
      ping(e?.code === "OURA_EXPIRED" && existing?.restored ? restoredOuraGone : e.message || `Couldn't connect ${label}`);
    } finally {
      setWearBusy(null);
    }
  };
  /* Disconnect a server-mediated source: Cyra's server ends it at Oura / Terra first, and
     only then is it removed here. When this device holds nothing that could end it
     (NO_KEY), only the local entry is removed and the person is told to remove Cyra in
     that account. Terra: readings waiting on Cyra's server are collected first, because the
     server empties the mailbox as soon as a disconnect is asked for. Readings already
     imported stay in the record on this device. A Terra disconnect Cyra's server couldn't
     confirm is kept in terraOff and asked again until it confirms (retryTerraOff). */
  const disconnectWear = async (id, label) => {
    const st = wearSources[id];
    if (!FEATURES.wearables || wearBusy || !st) return;
    setWearBusy(`${id}:off`);
    try {
      if (id === "terra" && st.key) { try { const rows = await drainTerra(st.key); if (rows.length) setWearData((d) => mergeRows(d, rows)); } catch { /* nothing collected */ } }
      await disconnectSource(id, st);
      setWearSources(({ [id]: _gone, ...rest }) => rest);
      ping(`${label} disconnected. Readings already imported stay on this device.`);
    } catch (e) {
      if (e?.code === "NO_KEY") { // nothing on this device could end it: say so, and stop showing it as connected
        setWearSources(({ [id]: _gone, ...rest }) => rest);
        ping(`${label} connection removed from this device. Readings already imported stay on this device. ${e.message}.`);
      } else if (id === "terra") { // kept on this device and asked again until Cyra's server confirms (retryTerraOff)
        setTerraOff((p) => cleanTerraOff([...p, st]));
        setWearSources(({ terra: _gone, ...rest }) => rest);
        ping(`Couldn't confirm the disconnect yet — ${label} may still be connected, so Cyra will keep asking.`);
      } else ping(`Couldn't confirm the disconnect — ${label} may still be connected. Try again, or ${disconnectHelp(id)}.`);
    } finally {
      setWearBusy(null);
    }
  };
  /* An unconfirmed Fitbit/Garmin/Whoop disconnect is asked again at launch, when the device
     comes back online or Cyra comes back on screen, and on a timer while one is left, until
     Cyra's server confirms. Readings are not collected for it any more (the disconnect
     empties the server mailbox). */
  const terraOffRef = useRef(terraOff); terraOffRef.current = terraOff;
  const terraOffBusy = useRef(false);
  const retryTerraOff = async () => {
    const list = cleanTerraOff(terraOffRef.current);
    if (!FEATURES.wearables || !list.length || !API_BASE || wipingRef.current || terraOffBusy.current) return;
    terraOffBusy.current = true;
    try {
      const done = [];
      for (const st of list) {
        if (wipingRef.current) break;
        try { await disconnectSource("terra", st, { timeoutMs: 10000 }); done.push(offId(st)); } catch { /* asked again later */ }
      }
      if (done.length && !wipingRef.current) {
        setTerraOff((p) => cleanTerraOff(p).filter((x) => !done.includes(offId(x))));
        ping("Fitbit · Garmin · Whoop: Cyra's server confirmed the disconnect. Readings already imported stay on this device.");
      }
    } finally { terraOffBusy.current = false; }
  };
  // While a disconnect is unconfirmed: try again on a timer (30 s, doubling to 15 min).
  const terraOffLeft = terraOff.length > 0;
  useEffect(() => {
    if (!FEATURES.wearables || !terraOffLeft || !API_BASE || !hydrated) return;
    let delay = 30_000, t = null, stop = false;
    const tick = async () => { if (stop) return; await retryTerraOff(); delay = Math.min(delay * 2, 15 * 60_000); if (!stop) t = setTimeout(tick, delay); };
    t = setTimeout(tick, delay);
    return () => { stop = true; clearTimeout(t); };
  }, [terraOffLeft, hydrated]); // eslint-disable-line
  /* Terra readings wait on Cyra's server until this device collects them, so collect them
     on launch and whenever the app comes back to the foreground (at most once a minute). */
  const wearSourcesRef = useRef(wearSources); wearSourcesRef.current = wearSources;
  const lastDrain = useRef(0);
  const drainTerraNow = async () => {
    const st = wearSourcesRef.current.terra;
    if (!FEATURES.wearables || !st?.key || !API_BASE || DEMO_WEARABLES || wipingRef.current || Date.now() - lastDrain.current < 60_000) return;
    lastDrain.current = Date.now();
    try {
      const { rows, state } = await syncSource("terra", st);
      if (wipingRef.current) return;
      if (rows.length) { setWearData((d) => mergeRows(d, rows)); ping(`Fitbit · Garmin · Whoop: ${rows.length} day${rows.length === 1 ? "" : "s"} imported`); }
      if (state !== st) setWearSources((s) => (s.terra ? { ...s, terra: state } : s));
    } catch { /* collected next time */ }
  };
  /* Wearable rows can lack any field (no watch worn, no sleep tracked): a missing value is
     "no reading", never 0, so averages and thresholds only look at real readings. */
  const has = (v) => typeof v === "number" && Number.isFinite(v);
  const wAvg = (k) => { const vals = wearData.map((m) => m[k]).filter(has); return vals.length ? Math.round((vals.reduce((a, v) => a + v, 0) / vals.length) * (k === "temp" ? 100 : 1)) / (k === "temp" ? 100 : 1) : null; };

  // A build without the wearables flag keeps the rows (and backups carry them) but shows nothing from them.
  const wearInsights = (() => {
    if (!FEATURES.wearables || !wearData.length) return [];
    const out = [];
    const sorted = [...wearData].sort((a, b) => a.date.localeCompare(b.date));
    if (stage === "periods") {
      let ovu = null, riseAt = null;
      for (let i = 1; i < sorted.length - 2; i++) {
        if (has(sorted[i - 1].temp) && has(sorted[i].temp) && has(sorted[i + 1].temp) && has(sorted[i + 2].temp) && sorted[i - 1].temp < 0.12 && sorted[i].temp >= 0.2 && sorted[i + 1].temp >= 0.2 && sorted[i + 2].temp >= 0.2) { ovu = sorted[i - 1].date; riseAt = sorted[i].date; break; }
      }
      if (ovu) out.push({ num: "Ovulated", text: `A sustained temperature rise began ${fmt(riseAt)} and held — consistent with ovulation around ${fmt(ovu)}. This confirms it after the fact, the way basal-temperature charting does. It can't predict next month, and it isn't contraception.`, advice: stageName === "Trying to Conceive" ? "If you're trying to conceive, the fertile days were the ~5 before and the day of that rise — Cyra will use this to sharpen next month's estimate." : null, urgency: "self" });
      else if (pred && pred.cycleDay < pred.avgLen - 14) out.push({ num: `Day ${pred.cycleDay}`, text: `No temperature shift yet this cycle — which fits: based on your usual ${pred.avgLen}-day cycle, ovulation would be expected around day ${pred.avgLen - 14}. Cyra will flag the rise when it holds for three days.`, urgency: "self", advice: stageName === "Trying to Conceive" ? `Your estimated fertile window opens around day ${Math.max(1, pred.fertileDay)} — the temperature rise confirms it only afterwards, so pair it with other signs if timing matters.` : null });
      const lut = sorted.filter((s) => has(s.temp) && s.temp >= 0.2), fol = sorted.filter((s) => has(s.temp) && s.temp < 0.12);
      if (lut.length >= 4 && fol.length >= 4) {
        const av = (a, k) => { const v = a.map((y) => y[k]).filter(has); return v.length >= 4 ? Math.round(v.reduce((x, y) => x + y, 0) / v.length) : null; };
        const [rf, rl, hf, hl] = [av(fol, "rhr"), av(lut, "rhr"), av(fol, "hrv"), av(lut, "hrv")];
        if (rf != null && rl != null && hf != null && hl != null) out.push({ num: `${rf}→${rl}`, text: `Resting heart rate runs about ${rl - rf} bpm higher in the second half of your cycle, and HRV dips ${hf - hl} ms. That's your body's normal luteal signature — useful context for why some weeks feel heavier.` });
      }
    }
    if (stage === "peri" && !isMeno) {
      const hot = wearData.filter((m) => has(m.temp) && has(m.sleep) && m.temp >= 0.3 && m.sleep < 60).length;
      const nsLogged = ins.counts.find((x) => x.id === "ns")?.days || 0;
      out.push({ num: `${hot}`, text: `${hot} of the last 30 nights showed a temperature spike with broken sleep — the wearable signature of night sweats${nsLogged ? `, and it lines up with the ${nsLogged} you logged` : ""}. Two independent signals telling the same story is exactly what a clinician wants to see.`, urgency: hot >= 8 ? "visit" : "self", advice: hot >= 8 ? "Night sweats this frequent are very treatable — bring this count to your doctor." : "Keep both the wearable and your check-ins going; agreement between them makes your record much stronger." });
    }
    if (isMeno && wAvg("rhr") != null) {
      const spikes = wearData.filter((m) => has(m.temp) && m.temp >= 0.3).length;
      out.push({ num: `${wAvg("rhr")}`, text: `Resting heart rate averaged ${wAvg("rhr")} bpm on a steady temperature baseline (${spikes} spike night${spikes === 1 ? "" : "s"} in 30). After menopause there's no cycle to track — so the useful signals shift to heart health and sleep. A rising resting heart rate over months, or a new run of night spikes, is worth noting.`, urgency: spikes >= 6 ? "visit" : "self", advice: spikes >= 6 ? "A new pattern of night-time temperature spikes after menopause is worth mentioning at your next visit." : "Post-menopause, cardiovascular risk rises — ask about a lipid panel and blood-pressure check if you haven't lately." });
    }
    if (stage === "preg" && wAvg("rhr") != null) out.push({ num: `${wAvg("rhr")}`, text: `Resting heart rate averaged ${wAvg("rhr")} bpm. It normally climbs 10–20 bpm across pregnancy as blood volume rises — a gradual rise is expected; a sudden jump, or a racing heart at rest, is a tell-your-provider signal.`, urgency: "self", advice: (wAvg("sleep") != null ? "Sleep score averaged " + wAvg("sleep") + " — s" : "S") + "ide-sleeping with pillow support has real evidence behind it in later pregnancy." });
    return out;
  })();

  /* ---- Milestones: clinical + usage. A pure function of a days array (the record it is given,
     not the state), so a save can be compared before and after; `milestones` is today's. ---- */
  const milestonesFor = (daysArr) => {
    const di = daysArr === days ? ins : insights(daysArr, symIds);
    const ms = [];
    const total = stage === "preg" ? Object.keys(pregLog).length : di.sorted.length;
    ms.push({ done: total >= 7, label: "First week tracked" });
    ms.push({ done: total >= 30, label: "A full month of data" });
    if (stage === "periods") {
      ms.push({ done: di.lens.length >= 1, label: "First full cycle logged" });
      ms.push({ done: di.lens.length >= 3, label: "3 cycles — predictions sharpen" });
      if (FEATURES.wearables && wearData.length) ms.push({ done: wearInsights.some((w) => w.num === "Ovulated"), label: "Ovulation confirmed by temperature" });
    }
    if (stage === "peri") {
      const lastP = di.starts[di.starts.length - 1];
      const monthsSince = lastP ? Math.floor((Date.now() - new Date(lastP + "T12:00:00")) / (30.44 * 86400000)) : null;
      ms.push({ done: di.variability != null && di.variability >= 7, label: "Cycles varying by 7+ days — a sign of the transition" });
      ms.push({ done: monthsSince != null && monthsSince >= 12, label: `12 months without a period — menopause${monthsSince != null ? ` · ${Math.min(12, monthsSince)} of 12` : ""}`, progress: monthsSince != null ? Math.min(1, monthsSince / 12) : 0 });
    }
    if (stage === "preg") { ms.push({ done: pregWeek >= 13, label: "Second trimester" }); ms.push({ done: pregWeek >= 22, label: "Anatomy scan window" }); ms.push({ done: pregWeek >= 28, label: "Third trimester" }); }
    if (FEATURES.wearables) ms.push({ done: Object.values(wearSources).some((w) => w && !w.pending), label: "Wearable connected" });
    ms.push({ done: meds.length > 0, label: "Trying something new — a med, supplement or habit" });
    ms.push({ done: appts.some((a) => a.note), label: "First visit written up" });
    return ms;
  };
  const milestones = milestonesFor(days);
  /* The one milestone moment: right after a save that flips a milestone, Home pops that dot and the
     toast names it, for 2 seconds. Transient state only: never stored, never set on hydration or
     restore, so it cannot replay. */
  const [justReached, setJustReached] = useState(null);
  const reachedTimer = useRef(null);
  useEffect(() => () => clearTimeout(reachedTimer.current), []);
  /* The day just saved: for 1.2 s after a save of today, the patterns card pops that day's dot once (UI state only,
     set by the save handler alone, never on hydration or restore, never stored). */
  const [justSaved, setJustSaved] = useState(null);
  const savedTimer = useRef(null);
  useEffect(() => () => clearTimeout(savedTimer.current), []);
  const onSaved = (nextDays, savedIso = null) => {
    if (savedIso) { setJustSaved(savedIso); clearTimeout(savedTimer.current); savedTimer.current = setTimeout(() => setJustSaved(null), 1200); }
    // The welcome line (Today, under the h1) is for the first visit only: the first save clears it.
    if (welcome) setWelcome("");
    const before = milestonesFor(days), after = milestonesFor(nextDays);
    const fresh = after.find((m) => m.done && !before.find((b) => b.label === m.label)?.done);
    if (!fresh) return;
    setJustReached({ label: fresh.label, at: Date.now() });
    ping(`Milestone reached: ${fresh.label}`);
    clearTimeout(reachedTimer.current);
    reachedTimer.current = setTimeout(() => setJustReached(null), 2000);
  };

  /* The peri variability marker counts every cycle (D5); when she left some out of predictions it says so (L5). One named
     expression so a later insight can carry the same sentence. */
  const countsEveryCycle = cyc.excludedCount > 0 ? ` This counts every cycle, including ${cyc.excludedCount === 1 ? "the one" : `the ${cyc.excludedCount}`} you left out of predictions.` : "";
  const homeInsight = (() => {
    if (stage === "preg") {
      const next = PRENATAL.flatMap((g) => g.items).find((m) => m.from >= pregWeek && m.from <= 42); // from the same schedule Milestones draws (UI M1)
      return { num: `Wk ${pregWeek}`, text: next ? `Next up on your care roadmap: ${next.label} around week ${next.from}.` : "You're in the home stretch — weekly visits from here." };
    }
    // Honest first run: before 3 check-ins the card counts the gap and names what unlocks it.
    if (days.length < 3) {
      const n = ins.sorted.length, left = 3 - n;
      return { num: `${n} of 3`, text: n === 0 ? "Log a few days and your first insight appears here." : `${left} more check-in${left === 1 ? "" : "s"} and your first insight appears here.` };
    }
    if (stage === "peri" && ins.variability != null && ins.variability >= 7) return { num: `${ins.variability}d`, text: `Your cycles are varying by ${ins.variability} days — the clearest marker of the transition. Worth raising at your next visit.${countsEveryCycle}` };
    if (stage === "peri" && ins.hfMult && ins.hfMult > 1.2) return { num: `${ins.hfMult.toFixed(1)}×`, text: `Hot flashes were ${ins.hfMult.toFixed(1)}× more likely after a rough night. Sleep is your biggest lever.`, fam: "heat" };
    const top = ins.counts.find((x) => x.days > 0);
    if (top) return { num: `${top.days} days`, text: `${top.label} showed up most this month — ${top.days} of 30 days.`, fam: SYM_FAMILY[top.id] || "body" };
    return { num: "—", text: "Log a few days and your first insight appears here." };
  })();

  const upcoming = appts.filter((a) => a.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date));
  const past = appts.filter((a) => a.date < todayIso).sort((a, b) => b.date.localeCompare(a.date));
  const daysUntil = (iso) => Math.round((new Date(iso + "T12:00:00") - new Date(todayIso + "T12:00:00")) / 86400000);
  const nextUp = [];
  // Trying to conceive with fertility signs shown (L7): the estimated fertile window leads Coming up while it is still ahead or under way.
  const fertHead = ttc && fertOn ? fertWindow(pred, todayIso) : null;
  if (fertHead) nextUp.push({ k: "fertile", text: fertHead, sub: FERT_COPY.winSub, action: () => goTab("cal") });
  if (stage === "preg") nextUp.push({ k: "due", text: `Due in about ${40 - pregWeek} weeks`, sub: new Date(Date.now() + (40 - pregWeek) * 7 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric" }) });
  // The likely-start range (L5): "Period likely Oct 26 – Nov 1" over what it rests on; later than the range; or a gap too long to predict across.
  else if (pred) nextUp.push(pred.state === "later" ? { k: "late", text: periodHead(pred), sub: `Your range ended ${fmt(pred.toIso)} · ${stage === "peri" ? "Irregularity is data too" : "Normal variation happens"} · Calendar →`, action: () => goTab("cal") } : { k: "period", text: periodHead(pred), sub: `${basisLine(pred)} · Calendar →`, action: () => goTab("cal") });
  else if (predWhy?.kind === "long") nextUp.push({ k: "late", text: `No period on record for ${predWhy.days} days`, sub: `${stage === "peri" ? "Long gaps are common in perimenopause" : "Over 120 days, so Cyra won't guess"} · Calendar →`, action: () => goTab("cal") });
  if (upcoming[0]) nextUp.push({ k: "appt", text: `Appointment${upcoming[0].who ? ` with ${upcoming[0].who}` : ""} in ${daysUntil(upcoming[0].date)} day${daysUntil(upcoming[0].date) === 1 ? "" : "s"}`, sub: daysUntil(upcoming[0].date) <= 7 && stage !== "preg" ? "Prep your report →" : fmt(upcoming[0].date), action: daysUntil(upcoming[0].date) <= 7 && stage !== "preg" ? () => goTab("report") : null }); // pregnancy has no Report tab

  // The palette (UI) and data-viz custom properties, inline on .cy; data-scheme picks the dark token rule (Shell).
  const style = { ...paletteVars(t), ...vizVars(scheme, stage) };
  const shell = { style, scheme };

  /* ---------- agentic intake routing (lib/engine.js routeIntake) ---------- */
  const finishOnboarding = async () => {
    setObBusy(true);
    // Routing runs on this device only: the intake answers (pregnancy, periods, hot
    // flashes, age band) are health data and are never stored or sent; the spec's stage map
    // is deterministic. The resulting stage reaches Cyra's server only inside the opt-in
    // weekly counts (builds with counts; lib/pulse.js); the counts read itself sends no stage. Otherwise it
    // leaves the device only when she moves it herself: inside an encrypted backup she
    // exports, and implied by the doctor-email text she chooses to send, or in a POTS report
    // or spreadsheet she exports, only when she leaves 'Cycle or pregnancy details' ticked.
    const route = routeIntake(ob);
    // A new stage label starts fertility signs at that stage's default again (L7); re-running into the same one keeps her choice.
    if (route.label !== stageName) setFertSigns((p) => ({ ...p, on: null }));
    chooseStage(route.stage); setStageName(route.label); setWelcome(route.welcome);
    setDraft({}); setAppTab("home"); setPregTab("home"); setObBusy(false);
  };

  /* ---------- on-device persistence ---------- */
  const setters = { palIdx: setPalIdx, relationship: setRelationship, connLog: setConnLog, cadence: setCadence, quietHours: setQuietHours, quickMode: setQuickMode, meds: setMeds, medLog: setMedLog, appts: setAppts, journal: setJournal, wearSources: setWearSources, wearData: setWearData, acct: setAcct, research: setResearch, stage: setStage, stageName: setStageName, welcome: setWelcome, days: setDays, pregLog: setPregLog, pulseQueue: setPulseQueue, pulseSent: setPulseSent, pulseLastSend: setPulseLastSend, pulseRev: setPulseRev, askAI: setAskAI, regAnswers: setRegAnswers, kickTally: (v) => setKickTally(v && typeof v.day === "string" && Number.isFinite(v.n) ? { day: v.day, n: v.n } : null), terraOff: (v) => setTerraOff(cleanTerraOff(v)), lastBackupAt: (v) => setLastBackupAt(typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null), reminders: (v) => { const rev = Number.isFinite(v?.rev) ? v.rev : 0; adoptedRemRev.current = rev; setReminders({ enabled: !!v?.enabled, status: "off", endpoint: typeof v?.endpoint === "string" ? v.endpoint : null, pending: cleanPending(v?.pending), rev }); }, pots: (v) => setPots(cleanPots(v)), installHint: (v) => setInstallHint((cur) => mergeInstallHint(cleanInstallHint(v), cur)), appearance: (v) => setAppearance(cleanAppearance(v)), cycleFlags: (v) => setCycleFlags(cleanCycleFlags(v)), symPrefs: (v) => setSymPrefs(cleanSymPrefs(v)), fertSigns: (v) => setFertSigns(cleanFertPrefs(v)) };
  const values = { palIdx, relationship, connLog, cadence, quietHours, quickMode, meds, medLog, appts, journal, wearSources, wearData, acct, research, stage, stageName, welcome, days, pregLog, pulseQueue, pulseSent, pulseLastSend, pulseRev, askAI, regAnswers, reminders, terraOff, kickTally, pots, lastBackupAt, installHint, appearance, cycleFlags, symPrefs, fertSigns };
  const valuesRef = useRef(values); valuesRef.current = values;
  const stored = (k) => (k === "reminders" ? { enabled: !!reminders.enabled, endpoint: reminders.endpoint || null, pending: cleanPending(reminders.pending), rev: reminders.rev || 0 } : values[k]);
  const snapshot = () => ({ v: RECORD_VERSION, savedAt: new Date().toISOString(), phase: "app", ...Object.fromEntries(PERSISTED.map((k) => [k, stored(k)])) });
  // A saved record always opens the app — also one saved while she was choosing a stage
  // again (stage null: the intake shows, with Settings and Delete everything one tap away).
  const applySaved = (saved, { skip = [] } = {}) => {
    for (const k of PERSISTED) if (!skip.includes(k) && k in saved && saved[k] !== undefined) setters[k](saved[k]);
    setPhase("app"); setAppTab("home"); setPregTab("home");
  };
  // A record that exists but can't be read (phone only) keeps hydrated false, so nothing
  // is saved over it; RecordUnavailableScreen offers Try again.
  const hydrate = () => storage.load().then(
    async (saved) => {
      try {
        if (saved && saved.v === RECORD_VERSION && saved.phase === "app") {
          // A record with no `pots` at all was last saved by a build from before POTS (a tab left
          // open across the deploy): this build always writes it. The web keeps a second copy of
          // the POTS log that such a build never touches (lib/storage.js POTS_KEY); it is taken
          // back here, and the autosave that follows writes it into the record again.
          if (!("pots" in saved)) { const copy = await storage.loadPotsCopy(); if (copy && typeof copy === "object") saved = { ...saved, pots: copy }; }
          applySaved(saved); potsBase.current = saved.pots === undefined ? null : cleanPots(saved.pots);
          // A stand test left "running" with no activity for 30 minutes was interrupted (the app
          // closed mid-test): it keeps every reading it saved and is offered as Keep it / Discard.
          // Only here, at launch: a cross-tab adopt never marks another window's live test.
          setPots((p) => markStaleRunning(p, Date.now()));
        }
      }
      finally { setRecordUnavailable(false); setHydrated(true); }
    },
    (e) => { setRecordLocked(!!e?.locked); setRecordUnavailable(true); },
  );
  /* At every start, before and whether or not the record loads: (phone) delete a backup copy
     an interrupted share left in the cache — no share can be under way in a freshly started
     app — and drop a week-only hold whose week is over. */
  useEffect(() => {
    hydrate(); storage.probe().then(setStorageDriver);
    if (isNative()) sweepBackupCache().catch(() => { /* best effort */ });
    storage.dropStaleHold(weekKey()).then(() => storage.getHold()).then(setHoldWeek, () => {});
  }, []); // eslint-disable-line
  useEffect(() => {
    if (!hydrated || phase !== "app" || wipingRef.current) return;
    const snap = snapshot();
    // What this tab just took over from another tab is already stored: don't write it back.
    const adopted = !!skipSig.current && recordSig(snap) === skipSig.current;
    skipSig.current = null;
    if (adopted) return;
    const run = async () => {
      if (wipingRef.current) return;
      let out = snap;
      if (!isNative()) { // a browser can have several tabs: a newer sharing state stored by another one wins
        const latest = await storage.load().catch(() => null);
        if (wipingRef.current) return;
        out = mergePulse(snap, latest);
        if (out !== snap) adoptPulse(out);
        const rem = mergeReminders(out.reminders, latest?.reminders);
        if (rem !== out.reminders) { out = { ...out, reminders: rem }; adoptReminders(rem); }
        // The install tip: a stronger stored hint (another tab hid it, or Cyra was installed) wins, so a stale tab can't bring it back.
        const ih = mergeInstallHint(out.installHint, latest?.installHint);
        if (ih !== out.installHint) { out = { ...out, installHint: ih }; setInstallHint(ih); }
        // POTS: another tab's newer epoch (an erase or a restore there) wins wholesale; within
        // one epoch both tabs' entries are kept and a removal or a cleared value stays removed
        // (a 3-way merge against what this tab last saved or adopted, lib/pots.js mergePots).
        // A POTS tap made here while storage.load() was pending is already in state but not in
        // this snapshot: rebase it onto the merge (3-way, this snapshot as the base) instead of
        // overwriting it; the autosave that tap scheduled then saves it.
        const pm = mergePots(latest && latest.v === RECORD_VERSION ? latest.pots : undefined, out.pots, potsBase.current);
        if (!samePots(pm, out.pots)) { const mine = out.pots; out = { ...out, pots: pm }; setPots((cur) => (cur === mine ? pm : mergePots(pm, cur, mine))); }
      }
      const p = storage.save(out).then(() => {
        potsBase.current = out.pots;
        setStorageDriver(storage.driver());
        // Other open tabs of this browser take the saved record over, so none of them
        // writes its older copy back over this one (adoptRecord).
        const sig = isNative() ? null : recordSig(out);
        if (sig && sig !== lastSig.current) { lastSig.current = sig; try { channel.current?.postMessage({ type: "record" }); } catch { /* single tab */ } }
      }, () => { setStorageDriver(storage.driver()); ping("Couldn't save to this device — storage may be full or blocked"); });
      lastSave.current = p;
      return p;
    };
    pendingSave.current = run;
    saveTimer.current = setTimeout(() => { pendingSave.current = null; run(); }, 400);
    return () => cancelSave();
  }, [hydrated, phase, ...PERSISTED.map((k) => values[k])]); // eslint-disable-line
  /* Another tab of this browser saved the record: take its health record and settings over
     (never the per-device consents or reminder addresses, which have their own merge). The
     check-in form is reloaded when that changed today's entry. */
  const adoptRecord = async () => {
    if (!hydrated || phase !== "app" || wipingRef.current || isNative()) return;
    const saved = await storage.load().catch(() => null);
    if (!saved || saved.v !== RECORD_VERSION || saved.phase !== "app" || wipingRef.current) return;
    const cur = valuesRef.current, sig = recordSig(saved);
    if (sig === recordSig(cur)) return;
    lastSig.current = sig; skipSig.current = sig;
    for (const k of RECORD) {
      if (!(k in saved) || saved[k] === undefined) continue;
      if (k !== "pots") { setters[k](saved[k]); continue; }
      // POTS is merged, not replaced, so this tab's own unsaved taps survive; when the merge
      // changes nothing the stored copy is taken as it is (no save goes back and forth). The
      // stored copy becomes the merge base, so what this tab changed still counts as its change.
      const m = mergePots(saved.pots, cur.pots, potsBase.current);
      const took = cleanPots(samePots(m, saved.pots) ? saved.pots : m);
      setPots((now) => (now === cur.pots ? took : mergePots(took, now, cur.pots))); // keeps a tap made since `cur` was read
      potsBase.current = cleanPots(saved.pots);
    }
    const today = (v) => JSON.stringify([v.stage, v.stage === "preg" ? v.pregLog?.[todayIso] ?? null : (v.days || []).find((d) => d.date === todayIso) ?? null, v.kickTally ?? null]);
    if (today(saved) !== today(cur)) setFormRev((n) => n + 1);
  };
  const adoptRecordRef = useRef(adoptRecord); adoptRecordRef.current = adoptRecord;

  /* Weekly counts: send a due queue — at most one tally a day from this browser (or this
     phone app install), never on the day of the check-in. Inside a Web Lock shared by every
     tab of this browser, the stored record is read again, and "sent" (with today as the
     send day, plus the week-only hold) is written BEFORE the request, so neither a reload
     nor a second tab can send it again. Nothing is sent if, at that moment, the stored
     switch says sharing is off or Delete everything has started. A queue whose stage isn't
     the record's stage is dropped. A browser without Web Locks sends nothing (there would be
     no way to keep it to one a day across tabs); the phone app has a single web view. */
  const flushPulse = async () => {
    if (!API_BASE || !FEATURES.counts) return; // a build without counts never sends a tally, even one an earlier build queued
    const locks = typeof navigator !== "undefined" ? navigator.locks : null;
    if (!locks?.request && !isNative()) return;
    const run = async () => {
      if (wipingRef.current || !researchRef.current) return;
      const cur = await storage.load().catch(() => null);
      const today = localDay();
      if (!cur || cur.v !== RECORD_VERSION || !cur.research || !queueDue(cur.pulseQueue) || cur.pulseLastSend === today) return;
      const hold0 = await storage.getHold();
      // Resolves false (and the tally is not sent) when sharing is off or a delete has started.
      const commit = async ({ queue, sent }) => {
        if (wipingRef.current) return false;
        const latest = (await storage.load().catch(() => null)) || cur;
        if (wipingRef.current) return false;
        const on = !!latest.research && researchRef.current; // a stored "off" always wins
        const newer = latest.pulseQueue?.day === today ? pruneQueue(latest.pulseQueue, sent) : null; // a check-in saved meanwhile
        const p = { research: on, pulseQueue: on ? mergeQueues(queue, newer) : null, pulseSent: sent, pulseLastSend: today, pulseRev: nextRev(latest.pulseRev || 0) };
        if (queue && hold0 !== weekKey()) { await storage.clearHold(); setHoldWeek(hold0); } // refused: nothing was counted
        else if (!queue && sent?.week === weekKey() && sent.keys?.length) { await storage.setHold(sent.week); setHoldWeek(sent.week); } // survives Delete everything / Start over
        await storage.save({ ...latest, ...p, savedAt: new Date().toISOString() });
        if (wipingRef.current) return false;
        adoptPulse(p); tellPulse(p);
        return on;
      };
      // A queue left over from another stage: dropped, never sent.
      if (cur.pulseQueue.stage !== cur.stage) return commit({ queue: null, sent: cur.pulseSent ?? null });
      // This device already sent counts this week from an earlier record (deleted since): send none.
      if (hold0 === weekKey() && cur.pulseSent?.week !== weekKey()) return commit({ queue: null, sent: cur.pulseSent ?? null });
      await flushQueue(cur.pulseQueue, cur.pulseSent ?? null, { commit });
    };
    try { if (locks?.request) await locks.request("cyra-pulse-flush", run); else await run(); } catch { /* tried again on a later launch */ }
  };
  /* Once per launch, after the record is loaded: send a due weekly-counts queue, collect
     Terra readings waiting on the server, and ask the server again to forget any reminder
     address it couldn't be told to forget before. */
  const launched = useRef(false);
  useEffect(() => {
    if (!hydrated || launched.current) return;
    launched.current = true;
    flushPulse();
    drainTerraNow();
    retryPushForget();
    retryTerraOff();
  }, [hydrated]); // eslint-disable-line
  useEffect(() => {
    const onOnline = () => { retryPushForget(); retryTerraOff(); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []); // eslint-disable-line
  useEffect(() => {
    // Hidden, closed or sent to the background: a save still waiting on its 400 ms timer is written now.
    const onVisible = () => { if (document.visibilityState === "visible") { syncDay(); drainTerraNow(); retryPushForget(); retryTerraOff(); checkForUpdate(); } else flushSave(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", flushSave);
    // Back from the background, a restored page or a focused window: the day may have changed.
    window.addEventListener("pageshow", syncDay); window.addEventListener("focus", syncDay);
    const sub = isNative() ? CapApp.addListener("appStateChange", (st) => { if (st?.isActive) { syncDay(); drainTerraNow(); retryTerraOff(); } else flushSave(); }) : null;
    // Local midnight while the app stays open. Checked at least once a minute, because a timer
    // doesn't count the time a device spends asleep and the clock or time zone can change.
    let dayTimer = null;
    const armDay = () => { const n = new Date(), next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 1); dayTimer = setTimeout(() => { syncDay(); armDay(); }, Math.max(1000, Math.min(next - n, 60000))); };
    armDay();
    return () => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("pagehide", flushSave); window.removeEventListener("pageshow", syncDay); window.removeEventListener("focus", syncDay); clearTimeout(dayTimer); sub?.then((h) => h.remove()).catch(() => {}); };
  }, []); // eslint-disable-line

  /* ---------- installable web app (spec A14.1, lib/pwa.js) ----------
     Web only. What this browser can offer (Chromium's captured install prompt, the iPhone/iPad
     Share steps, nothing when Cyra already runs standalone) is worked out at mount and again
     when the browser offers or completes an install. */
  useEffect(() => {
    if (isNative()) return;
    setInstallMode(currentInstallMode());
    return listenForInstall({
      onPrompt: () => setInstallMode(currentInstallMode()),
      onInstalled: () => { setInstallMode(currentInstallMode()); setInstallHint((h) => mergeInstallHint(h, "installed")); },
    });
  }, []);
  /* The offline worker is registered only while this device holds a record (never on the splash
     or during registration, so a device wiped by Delete everything stays unregistered), and only
     in a production web build (registerWorker checks). Opened standalone means installed. */
  useEffect(() => {
    if (!hydrated || phase !== "app" || wipingRef.current) return;
    registerWorker({ onUpdateReady: () => setUpdateReady(true) })
      .then((reg) => whenActive(reg))
      .then(async (ok) => { if (ok && await hasShellCache()) setOfflineReady(true); })
      .catch(() => { /* no offline copy this time; tried again at the next launch */ });
    if (!isNative() && displayStandalone()) setInstallHint((h) => mergeInstallHint(h, "installed"));
  }, [hydrated, phase]);
  // The document outside the column (color-scheme, --doc-bg) and the browser chrome (theme-color) follow the scheme and paper on screen.
  useLayoutEffect(() => { applyDocumentScheme(document, { scheme, paper: t.paper }); }, [scheme, t.paper]);
  useEffect(() => { if (!showSettings) setSettingsFocus(null); }, [showSettings]);

  /* Phone: a backup copy, POTS report or POTS spreadsheet an interrupted share left in the
     app's cache (app closed or killed while the share sheet was open). Run at every launch,
     before and whether or not the record loads (no share can be under way in a freshly
     started app), and by Delete everything and Start over once they reach this device's
     clean-up. Only Cyra's own export names match; nothing else in the cache is touched. */
  const sweepBackupCache = async () => {
    const { files = [] } = await Filesystem.readdir({ path: "", directory: Directory.Cache });
    for (const f of files) { const n = typeof f === "string" ? f : f?.name; if (/^cyra-(backup-.*\.cyra\.json|(report|data)-\d{4}-\d{2}-\d{2}\.(pdf|csv))$/.test(n || "")) await Filesystem.deleteFile({ path: n, directory: Directory.Cache }).catch(() => {}); }
  };
  const exportBackup = async (passphrase) => {
    // The backup carries the record, minus what belongs to this device only: the ZIP and the
    // age band (neither is used after registration; their screen says they "stay on this
    // device"), this browser's push addresses and this device's display preferences.
    const snap = backupCopy(snapshot());
    const env = await encryptBackup(snap, passphrase);
    // The file transport (lib/backup.js) hands the encrypted file over: a download, or the phone's share
    // sheet via the app cache (deleted as soon as Cyra hears back; sweepBackupCache catches an interrupted one).
    const handed = await backupFile.save(env, { name: backupFileName(todayIso) });
    if (handed) setLastBackupAt(todayIso);
    return handed;
  };
  // Restoring brings back the record and settings, but never the per-device consents
  // (weekly counts, Cyra's AI, and in a browser the reminders, which would register this
  // browser with Cyra's server), nor this device's appearance (DEVICE_PREFS): those stay as they are on this device. A wearable
  // connection in the backup comes back on this device unconfirmed; one this device has that the backup
  // doesn't is kept (the restore form says so).
  const importBackup = async (file, passphrase) => {
    const env = await backupFile.load(file);
    const saved = migrate(await decryptBackup(env, passphrase));
    if (!saved || saved.v !== RECORD_VERSION || !saved.stage) throw new Error("That backup is empty or from a different version");
    /* Oura / Terra connections in the backup may have been ended since it was made. One whose
       Terra disconnect this device is already asking for is left out; the others come back
       unconfirmed (pending + restored): they don't count as connected until a Sync gets
       readings, and Oura is checked right away (one that no longer works is removed). */
    const fromBackup = saved.wearSources && typeof saved.wearSources === "object" ? { ...saved.wearSources } : {};
    const endingIds = cleanTerraOff(terraOff).map(offId);
    if (fromBackup.terra && endingIds.includes(offId(fromBackup.terra))) delete fromBackup.terra;
    for (const id of ["oura", "terra"]) {
      const st = fromBackup[id];
      if (st && typeof st === "object" && !st.demo && JSON.stringify(st) !== JSON.stringify(wearSources[id])) fromBackup[id] = { ...st, pending: true, restored: true };
    }
    const wear = { ...wearSources, ...fromBackup };
    /* POTS is restored literally (owner decision D4): a backup without a POTS log clears it here.
       It starts a new epoch, so another open tab takes the restored log over whole instead of
       merging its own older entries back in. A log from a newer build stays untouched. */
    const restoredPots = newEpoch(saved.pots ?? freshEmpty(), Date.now());
    /* Cycles she left out of predictions are restored literally too (L5): a backup without cycleFlags clears them here, so
       "It replaces your record here." stays true. */
    const restoredFlags = cleanCycleFlags(saved.cycleFlags);
    // Her symptom list is restored literally as well (L6): a backup without symPrefs brings back Cyra's order.
    const restoredPrefs = cleanSymPrefs(saved.symPrefs);
    // Fertility signs' switch and unit are restored literally too (L7): a backup without them resets the switch to the stage default and keeps this device's unit.
    const restoredFert = restoredFertPrefs(saved.fertSigns, fertSigns);
    applySaved({ ...saved, pots: restoredPots, wearSources: wear, cycleFlags: restoredFlags, symPrefs: restoredPrefs, fertSigns: restoredFert }, { skip: [...DEVICE_ONLY, ...DEVICE_PREFS, "reminders"] }); setShowSettings(false); setFormRev((n) => n + 1);
    potsBase.current = restoredPots; setPotsHomeLast(null);
    const restoreRem = isNative() ? !!saved.reminders?.enabled : !!reminders.enabled; // phone: scheduled on the phone, no server
    const rem = { enabled: restoreRem, endpoint: reminders.endpoint || null, pending: cleanPending(reminders.pending), rev: reminders.rev || 0 };
    setRem((x) => ({ ...x, enabled: restoreRem })); // this browser's own push addresses stay as they are
    const keep = { research, pulseQueue, pulseSent, pulseLastSend, pulseRev, askAI, terraOff: cleanTerraOff(terraOff), lastBackupAt, installHint, appearance };
    await storage.save({ ...Object.fromEntries(PERSISTED.filter((k) => k in saved).map((k) => [k, saved[k]])), pots: restoredPots, wearSources: wear, cycleFlags: restoredFlags, symPrefs: restoredPrefs, fertSigns: restoredFert, ...keep, reminders: rem, v: RECORD_VERSION, savedAt: new Date().toISOString(), phase: "app" });
    applyReminders(restoreRem, saved.cadence || cadence, saved.quietHours || quietHours, { prompt: isNative() });
    ping(!isNative() && saved.reminders?.enabled && !reminders.enabled ? "Backup restored. Reminders stay off in this browser — turn them on in Settings if you want them here." : "Backup restored");
    if (FEATURES.wearables && wear.oura?.restored && API_BASE && !DEMO_WEARABLES) checkRestoredOura(wear.oura);
  };
  const checkRestoredOura = async (st) => {
    setWearBusy("oura");
    try {
      const { rows, state } = await syncSource("oura", st);
      if (wipingRef.current) return;
      setWearSources((s) => (s.oura?.restored ? { ...s, oura: state } : s));
      if (rows.length) setWearData((d) => mergeRows(d, rows));
    } catch (e) {
      if (e?.code === "OURA_EXPIRED" && !wipingRef.current) { setWearSources(({ oura: _gone, ...rest }) => rest); ping(restoredOuraGone); }
      // anything else: it stays unconfirmed, and Sync checks it again
    } finally { setWearBusy(null); }
  };

  /* ---------- Delete everything / Start over ----------
     Delete everything — first, Cyra's server: (d) Oura, if connected (builds with wearables): the
     token is revoked; (a) web reminders: the server forgets every push address this browser holds
     or held (in every build, since the server may still hold one); (c) Terra, if connected (and every
     earlier Terra disconnect not yet confirmed; builds with wearables), last
     because it empties the server's mailbox: readings waiting there are collected into the
     record first, then the server ends the connection and drops the mailbox. If any of these can't be confirmed (offline, server down, Terra/Oura
     didn't confirm, or this device holds nothing that could end it), the record on this
     device is not deleted: the error names what failed (and why) and what did end — a
     connection the server already ended is removed from this device, and if reminders were
     forgotten on the server they are turned off here too — and Settings offers Try again or
     "Delete on this device anyway", which says what stays connected and where to remove it.
     Then this device, best effort and in order: (a) reminders: phone — every pending
     notification; web — the browser's push subscription; (b) web: every service worker, then
     the offline copy of Cyra's own files (every cyra-shell-* cache; lib/pwa.js);
     (e) phone: any backup file left in the cache; then the record is deleted and checked
     gone; (f) other open tabs are told to stop saving (and to carry on if the delete stops),
     and to reload once the record is gone. If deleting the record itself fails, what
     already happened is applied here too (reminders off, ended connections removed) and the
     message says so. The week-only hold (lib/storage.js) stays when this device sent counts
     this week, and a stale one is removed.
     Start over (phone, record unreadable) does all of this except (c) and (d): the keys are
     in the unreadable record, and its screen tells her to remove access in the wearable
     account. It always leaves this week's hold, since the unreadable record may say counts
     already went this week. */
  const channel = useRef(null);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = (channel.current = new BroadcastChannel("cyra"));
    ch.onmessage = (e) => {
      if (e.data?.type === "pulse") { if ((e.data.pulseRev || 0) > pulseRevRef.current) adoptPulse(e.data); return; }
      if (e.data?.type === "reminders") { adoptReminders(e.data); return; }
      if (e.data?.type === "record") { adoptRecordRef.current(); return; }
      if (e.data?.type !== "wipe") return;
      if (e.data.phase === "cancel") { wipingRef.current = false; return; }
      wipingRef.current = true; cancelSave();
      if (e.data.phase === "done") window.location.replace(window.location.pathname);
    };
    return () => { ch.close(); channel.current = null; };
  }, []); // eslint-disable-line
  const tellOtherTabs = (phase) => { try { channel.current?.postMessage({ type: "wipe", phase }); } catch { /* single tab */ } };
  const cleanUpHere = async () => {
    const step = async (fn) => { try { await fn(); } catch { /* best effort: the next step still runs */ } };
    await step(() => syncReminders({ cadence: "me", nudge: "never" }, { server: false }));
    if (!isNative() && "serviceWorker" in navigator) await step(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); });
    if (!isNative()) await step(clearShellCaches); // the offline copy of Cyra's own files (spec A14.1); the splash never registers again
    if (isNative()) await step(sweepBackupCache);
  };
  const wipe = async (sources = {}, { force = false, pushKnown = [], holdWeek: startOver = false } = {}) => {
    wipingRef.current = true; cancelSave();
    tellOtherTabs("start");
    const failed = [], ended = []; // failed: [{ name, kind: network | refused | nokey }]
    let pushLeft = null, pushForgot = false, terraLiveEnded = false;
    const terraOffDone = [];
    const dropEnded = () => {
      const gone = [...ended.filter((k) => k !== "reminders"), ...(terraLiveEnded ? ["terra"] : [])];
      if (gone.length) setWearSources((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !gone.includes(k))));
      if (terraOffDone.length) setTerraOff((p) => cleanTerraOff(p).filter((x) => !terraOffDone.includes(offId(x))));
    };
    const remindersOff = (pending) => setRem((x) => ({ ...x, enabled: false, status: "off", endpoint: null, pending: cleanPending(pending) }));
    if (hasServer()) {
      const kindOf = (e) => (e?.code === "NO_KEY" ? "nokey" : e?.status ? "refused" : "network");
      const serverStep = async (name, fn) => { try { await fn(); ended.push(name); } catch (e) { failed.push({ name, kind: kindOf(e) }); } };
      // Wearables: only a build that has them asks Cyra's server to end a connection (otherwise Delete everything
      // shows LEGACY_WEAR_LINE for one an earlier build or a backup left in the record).
      if (FEATURES.wearables && sources.oura && !sources.oura.demo) await serverStep("oura", () => disconnectSource("oura", sources.oura, { timeoutMs: 8000 }));
      if (!isNative()) {
        const all = await knownEndpoints(pushKnown);
        const r = await forgetOnServerWhy(all, { timeoutMs: 6000 });
        pushLeft = r.left;
        if (r.left.length) failed.push({ name: "reminders", kind: r.refused ? "refused" : "network" });
        else if (all.length) ended.push("reminders");
        pushForgot = r.left.length < all.length;
        if (pushForgot) await unsubscribeBrowser().catch(() => []); // the server forgot this browser: no reminder is shown here any more
      }
      // Fitbit/Garmin/Whoop: the live connection plus any earlier disconnect not yet confirmed.
      const terraItems = FEATURES.wearables ? [...(sources.terra && !sources.terra.demo ? [{ st: sources.terra, live: true }] : []), ...cleanTerraOff(terraOffRef.current).map((st) => ({ st }))] : [];
      if (terraItems.length) {
        await serverStep("terra", async () => {
          let first = null;
          for (const { st, live } of terraItems) {
            if (st.key) { try { const rows = await drainTerra(st.key); if (rows.length) setWearData((d) => mergeRows(d, rows)); } catch { /* nothing collected */ } }
            try { await disconnectSource("terra", st, { timeoutMs: 8000 }); if (live) terraLiveEnded = true; else terraOffDone.push(offId(st)); }
            catch (e) { first = first || e; }
          }
          if (first) throw first;
        });
      }
    }
    if (failed.length && !force) {
      dropEnded();
      if (pushForgot) remindersOff(pushLeft || []); // the rest is still retried until the server confirms
      wipingRef.current = false; tellOtherTabs("cancel");
      throw Object.assign(new Error("Cyra couldn't confirm every step — your record wasn't deleted"), { failed, ended });
    }
    await cleanUpHere();
    if (startOver || pulseSent?.week === weekKey()) await storage.setHold(weekKey()); // this week's flags already went (or may have) from this device
    else await storage.dropStaleHold(weekKey());
    try { await storage.clear(); }
    catch (e) {
      // What already happened stays applied: reminders are off, ended connections are gone.
      dropEnded(); remindersOff(pushLeft || []);
      wipingRef.current = false; tellOtherTabs("cancel");
      const done = ["reminders are already off", ...(ended.includes("oura") ? ["Oura is disconnected"] : []), ...(ended.includes("terra") ? ["Fitbit, Garmin or Whoop is disconnected"] : [])];
      const head = e?.partial ? "Your record couldn't be fully deleted — a copy is still on this device. Try again." : "Your record couldn't be deleted from this device — try again.";
      const list = done.length < 2 ? done.join("") : `${done.slice(0, -1).join(", ")} and ${done[done.length - 1]}`;
      throw new Error(`${head} ${list.replace(/^./, (c) => c.toUpperCase())}.`);
    }
    await storage.dropDatabase();
    tellOtherTabs("done");
    window.location.replace(window.location.pathname);
  };
  // Settings shows a failure itself (DataControls), with Try again / Delete on this device anyway.
  const wipeDevice = (opts = {}) => wipe(wearSources, { ...opts, pushKnown: knownPush() });

  /* ---------- reminders: on-device schedule (phone) or web push (browser) ----------
     Off by default. Whatever the state, "Off", "When I feel like it" and "Never remind me"
     cancel everything; status is worked out again at every launch, never trusted from disk.
     Web, turning off: the browser's subscription is cancelled first and the off switch is
     saved on this device, together with every address Cyra's server still has to forget
     (reminders.pending), BEFORE anything is sent; then the server is asked to forget them,
     and only the ones it confirms leave the list. The rest are sent again at launch, when
     the browser comes back online or Cyra comes back on screen, and on a timer while Cyra
     is open, until the server confirms (up to 100 addresses; "Delete on this device anyway"
     or clearing this site's data erases the list). Every open tab agrees on the switch:
     a change bumps reminders.rev, is told to the other tabs, and before each save a tab
     adopts a newer stored switch and keeps every address still to forget, so a stale tab
     can't turn reminders back on. Phone: a failed cancel is shown, never reported as off.
     Only the newest call's result is shown. */
  const remindersRef = useRef(reminders); remindersRef.current = reminders;
  const remGen = useRef(0);
  const adoptedRemRev = useRef(0); // the newest switch this tab took from another tab or from disk
  const forgotten = useRef(new Set()); // addresses Cyra's server confirmed it forgot (never re-added)
  const markForgotten = (tried, left) => { for (const e of cleanPending(tried)) if (!cleanPending(left).includes(e)) forgotten.current.add(e); };
  const stillPending = (...lists) => cleanPending(lists.flatMap((l) => cleanPending(l))).filter((e) => !forgotten.current.has(e));
  const knownPush = () => { const r = remindersRef.current; return [...cleanPending(r.pending), ...(r.endpoint ? [r.endpoint] : [])]; };
  /* A stored reminders switch newer than this tab's wins, and its addresses still to forget are
     added to this tab's (a stale tab can neither turn reminders back on nor drop one). */
  const mergeReminders = (mine, theirs) => {
    if (!mine || !theirs || typeof theirs !== "object" || !((theirs.rev || 0) > (mine.rev || 0))) return mine;
    return { enabled: !!theirs.enabled, endpoint: typeof theirs.endpoint === "string" ? theirs.endpoint : null, pending: stillPending(mine.pending, theirs.pending), rev: theirs.rev };
  };
  const adoptReminders = (r) => {
    if (!((r.rev || 0) > (remindersRef.current.rev || 0))) return;
    adoptedRemRev.current = r.rev || 0;
    setReminders((x) => ((r.rev || 0) <= (x.rev || 0) ? x
      : { ...x, enabled: !!r.enabled, status: r.enabled ? (r.status || x.status) : "off", endpoint: r.enabled ? r.endpoint || x.endpoint || null : null, pending: stillPending(x.pending, r.pending), rev: r.rev }));
  };
  // A change to the switch made in this tab gets a new version and is told to the other tabs.
  const setRem = (next) => setReminders((x) => {
    const n = typeof next === "function" ? next(x) : next;
    const changed = !!n.enabled !== !!x.enabled;
    return { ...n, rev: changed ? Math.max(Date.now(), (x.rev || 0) + 1) : n.rev ?? x.rev ?? 0 };
  });
  useEffect(() => {
    if (!reminders.rev || reminders.rev === adoptedRemRev.current) return;
    adoptedRemRev.current = reminders.rev;
    try { channel.current?.postMessage({ type: "reminders", enabled: !!reminders.enabled, status: reminders.status, endpoint: reminders.endpoint || null, pending: cleanPending(reminders.pending), rev: reminders.rev }); } catch { /* single tab */ }
  }, [reminders.rev]); // eslint-disable-line
  /* Save the record now (not 400 ms later), with this reminders value: used before an off
     switch's network calls, so a tab closed during them can't lose it. */
  const saveRemindersNow = async (rem) => {
    if (!hydrated || phase !== "app" || wipingRef.current) return;
    cancelSave();
    try {
      const latest = isNative() ? null : await storage.load().catch(() => null);
      const base = latest && latest.v === RECORD_VERSION ? latest : snapshot();
      await storage.save({ ...base, reminders: { enabled: !!rem.enabled, endpoint: rem.endpoint || null, pending: stillPending(rem.pending, base.reminders?.pending), rev: Math.max(rem.rev || 0, base.reminders?.rev || 0) }, savedAt: new Date().toISOString() });
    } catch { /* the autosave tries again */ }
  };
  const offPendingMsg = "Reminders are off and this browser won't show any more. Cyra's server didn't confirm it erased this browser's reminder address, so Cyra will ask it again while Cyra is open and each time you open it, until it does.";
  const forgetBusy = useRef(false);
  const retryPushForget = async () => {
    const tried = cleanPending(remindersRef.current.pending);
    if (!tried.length || !API_BASE || isNative() || wipingRef.current || forgetBusy.current) return;
    forgetBusy.current = true;
    try {
      const left = await forgetOnServer(tried, { timeoutMs: 10000 });
      for (const e of tried) if (!left.includes(e)) forgotten.current.add(e);
      setReminders((x) => ({ ...x, pending: cleanPending(x.pending).filter((e) => left.includes(e) || !tried.includes(e)) }));
    } finally { forgetBusy.current = false; }
  };
  // While an address still has to be forgotten: try again on a timer (30 s, doubling to 15 min).
  const pendingCount = cleanPending(reminders.pending).length;
  useEffect(() => {
    if (!pendingCount || !API_BASE || isNative() || !hydrated) return;
    let delay = 30_000, t = null, stop = false;
    const tick = async () => { if (stop) return; await retryPushForget(); delay = Math.min(delay * 2, 15 * 60_000); if (!stop) t = setTimeout(tick, delay); };
    t = setTimeout(tick, delay);
    return () => { stop = true; clearTimeout(t); };
  }, [pendingCount > 0, hydrated]); // eslint-disable-line
  const blockedMsg = (r) => (isNative() ? "Notifications for Cyra are off in your phone's Settings — turn them on there to get reminders" : r.denied ? "Notifications for Cyra are blocked in this browser's site settings" : "Reminders need your permission — tap Turn on and choose Allow");
  const applyReminders = async (enabled, cad = cadence, nudge = quietHours, { prompt = true } = {}) => {
    // A web build without webReminders never subscribes: a switch an earlier build left on is turned off
    // at launch (the browser subscription is cancelled and any known address is asked to be forgotten).
    if (enabled && !remindersInBuild(isNative())) enabled = false;
    const gen = ++remGen.current;
    const current = () => gen === remGen.current;
    const known = knownPush();
    if (!enabled || !wantsReminders(cad, nudge)) {
      let pending = cleanPending(remindersRef.current.pending);
      if (!isNative()) {
        // First the browser side and the saved switch, then the server.
        const live = await unsubscribeBrowser().catch(() => []);
        for (const e of [...known, ...live]) forgotten.current.delete(e); // in use until now: must be forgotten again
        pending = cleanPending([...pending, ...known, ...live]);
        if (API_BASE) {
          const rem = { enabled: !!enabled, status: "off", endpoint: null, pending, rev: !!enabled !== !!remindersRef.current.enabled ? Math.max(Date.now(), (remindersRef.current.rev || 0) + 1) : remindersRef.current.rev || 0 };
          if (current()) setReminders(rem);
          await saveRemindersNow(rem);
        }
      }
      try { const tried = pending; const r = await syncReminders({ cadence: "me", nudge: "never" }, { known: pending }); pending = cleanPending(r.pending); if (!isNative()) markForgotten(tried, pending); }
      catch {
        if (isNative()) { // nothing may say "off" while the phone may still hold scheduled reminders
          if (!current()) return;
          setRem((x) => ({ ...x, enabled: false, status: "error", cancelFailed: true, endpoint: null }));
          if (prompt) ping("Couldn't cancel reminders on this phone — tap Turn off to try again");
          return;
        }
      }
      if (!current()) return;
      setRem((x) => ({ enabled: !!enabled, status: "off", endpoint: null, pending, rev: x.rev }));
      if (prompt && pending.length && !enabled) ping(offPendingMsg);
      return;
    }
    try {
      const r = await syncReminders({ cadence: cad, nudge }, { prompt, known });
      if (!current()) return;
      const keep = (patch) => setRem((x) => ({ endpoint: x.endpoint || null, pending: cleanPending(x.pending), rev: x.rev, ...patch }));
      if (r.active) { if (r.endpoint) forgotten.current.delete(r.endpoint); markForgotten(known.filter((e) => e !== r.endpoint), r.pending); setRem((x) => ({ enabled: true, status: "on", endpoint: r.endpoint || null, pending: cleanPending(r.pending), rev: x.rev })); }
      else if (r.blocked) {
        // No permission any more: the browser dropped its subscription, so have the server forget the old address too.
        const left = known.length && !isNative() ? await forgetOnServer(known) : [];
        if (!current()) return;
        setRem((x) => ({ enabled: false, status: "blocked", denied: !!r.denied, endpoint: null, pending: left, rev: x.rev }));
        if (prompt) ping(blockedMsg(r));
      }
      else if (r.unsupported) keep({ enabled: true, status: "unsupported" });
      else if (r.unavailable) { keep({ enabled: true, status: "unavailable" }); if (prompt) ping("Reminders aren't set up on this server yet"); }
      // worker: this browser's service worker never became active (lib/notifications.js), so the server wasn't asked.
      else if (r.error) { keep({ enabled: true, status: "error" }); if (prompt) ping(r.worker ? "Couldn't set up reminders in this browser — try turning them on again" : "Cyra's server couldn't set up reminders — try again later"); }
      else if (r.superseded) { /* a newer "off" came in meanwhile */ }
      else keep({ enabled: true, status: "off" });
    } catch (e) {
      if (!current()) return;
      setRem((x) => ({ endpoint: x.endpoint || null, pending: cleanPending(x.pending), enabled: true, status: "error", rev: x.rev }));
      if (prompt) ping(isNative() ? "Couldn't schedule reminders on this phone — try turning them on again" : e?.network ? "Couldn't reach Cyra's server — try turning reminders on again" : "Couldn't set up reminders in this browser — try turning them on again");
    }
  };
  useEffect(() => {
    if (!hydrated || phase !== "app" || wipingRef.current) return;
    if (reminders.enabled) applyReminders(true, cadence, quietHours, { prompt: false });
    else {
      // Nothing scheduled: cancel anything left over (and retry forgetting old addresses), keeping the status shown.
      const gen = ++remGen.current;
      const tried = knownPush();
      syncReminders({ cadence: "me", nudge: "never" }, { known: tried })
        .then((r) => { if (!isNative()) markForgotten(tried, r.pending); if (gen === remGen.current) setReminders((x) => ({ ...x, endpoint: null, pending: cleanPending(r.pending), ...(x.cancelFailed ? { status: "off", cancelFailed: false } : {}) })); })
        .catch(() => { /* nothing to cancel */ });
    }
  }, [cadence, quietHours, hydrated]); // eslint-disable-line

  /* ---------- "fill in your name and email from" Apple / Google / Facebook ----------
     Not an account: real OAuth through the backend only to prefill step 1, kept on this
     device. Web: a full-page redirect that comes back as #oauth=<code>. Phone app: a sign-in
     window (iOS: ASWebAuthenticationSession; Android: the system browser), back through
     cyrahealth://auth/oauth?a=<attempt>#oauth=<code>, redeemable only with this
     attempt's one-time verifier. A build without a server makes no request at all, and a
     build without the signin flag (the default: production mounts no oauth module) shows no
     provider buttons and never exchanges a returning #oauth= code. */
  const PROVIDER_LABEL = { apple: "Apple", google: "Google", facebook: "Facebook" };
  const signInRetry = "Sign-in didn't complete — try again or fill in the form; anything the provider sent is erased from Cyra's server within 5 minutes.";
  const startSocial = async (id, label) => {
    if (!FEATURES.signin) return; // a build without signin shows no provider buttons (RegisterScreen)
    setSocialBusy(id);
    if (!hasServer()) { ping(`Sign-in isn't available in this version — fill in the form or use Anonymous Mode; your profile stays on this ${isNative() ? "phone" : "device"}.`); setSocialBusy(null); return; }
    try {
      const r = await apiFetch("/api/oauth/providers", {}, { timeoutMs: 10000 });
      let available = null;
      if (r.ok) { try { available = await r.json(); } catch { /* not the providers list */ } }
      if (available?.[id] !== true) {
        ping(available?.[id] === false ? `${label} sign-in isn't set up on this server yet` : "Couldn't reach the sign-in service — try again in a moment");
        setSocialBusy(null); return;
      }
      // The provider learns that this account is signing in to Cyra (plus the usual IP and
      // browser details) and nothing about her health. The backend holds the verified email
      // and name in memory under a one-time code for at most 5 minutes, hands them to this
      // device, and writes nothing to disk.
      if (isNative()) {
        const { verifier, challenge } = await newAppVerifier();
        const ret = appReturnUrl("oauth"); // this attempt's own link
        let back = null;
        try { back = await waitForAppUrl(ret, `${API_BASE}/api/oauth/${id}/start?return=${encodeURIComponent(ret)}&app_challenge=${challenge}`); } catch { /* closed, timed out or couldn't open */ }
        setSocialBusy(null);
        finishSocial(back && !back.has("oauth_error") && back.get("oauth") ? { code: back.get("oauth"), verifier } : { error: true });
        return;
      }
      window.location.assign(`${API_BASE}/api/oauth/${id}/start?return=${encodeURIComponent(window.location.origin + window.location.pathname)}`);
    } catch {
      ping("Couldn't reach the sign-in service — try again in a moment"); setSocialBusy(null);
    }
  };
  // Shared by both returns: exchange the one-time code, prefill, move to step 2. Only a
  // verified email is filled in (the server drops unverified and Facebook emails and every
  // other provider field). The toast says what was filled in, and that a name or email she
  // had typed was kept. Anonymous Mode, if she turned it on meanwhile, wins: nothing is
  // filled in.
  const regRef = useRef(reg); regRef.current = reg;
  const finishSocial = ({ code, verifier, error }) => {
    setPhase("register");
    if (error) { ping(signInRetry); return; }
    apiPost("/api/oauth/exchange", verifier ? { code, verifier } : { code })
      .then((idn) => {
        const label = PROVIDER_LABEL[idn?.provider] || "the provider";
        if (regRef.current.anon) { ping(`Anonymous Mode is on, so nothing from ${label} was filled in`); return; }
        const email = idn?.emailVerified === true && typeof idn.email === "string" ? idn.email.trim() : "";
        const first = (typeof idn?.name === "string" ? idn.name.trim() : "").split(/\s+/)[0] || "";
        const typed = !!regRef.current.name, typedEmail = !!regRef.current.email;
        const fillName = !!first && !typed, fillEmail = !!email && !typedEmail;
        setReg((x) => (x.anon ? x : { ...x, email: x.email || email, name: x.name || first }));
        setRegStep(1);
        const what = [fillName && "name", fillEmail && "email"].filter(Boolean).join(" and ");
        const parts = [];
        if (what) parts.push(`Filled in your ${what} from ${label} — saved only on this device`);
        if (first && typed) parts.push(`${label} shared your name; Cyra kept the one you typed`);
        if (email && typedEmail) parts.push(`${label} shared a verified email; Cyra kept the one you typed`);
        if (!first && !email) parts.push(`${label} didn't share a name or a verified email — fill in the form if you like`);
        ping(parts.join(". "));
      })
      .catch(() => ping(signInRetry));
  };
  useEffect(() => {
    const m = /^#oauth(_error)?=(.+)$/.exec(window.location.hash || "");
    if (!m) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (FEATURES.signin) finishSocial(m[1] ? { error: true } : { code: decodeURIComponent(m[2]) }); // otherwise just dropped: no exchange request
  }, []);

  const finishReg = async () => {
    const labels = { "My Cycle": "My Cycle", "Trying to conceive": "Trying to Conceive", "Pregnant": "Pregnancy", "Perimenopause": "Perimenopause", "Menopause & beyond": "Menopause" };
    const sid = REG_STAGE[reg.stage] || "peri", slabel = labels[reg.stage] || "Perimenopause";
    // Anonymous Mode keeps no name and no email anywhere, not even on this device.
    const anon = !!reg.anon;
    const name = anon ? "" : reg.name.trim();
    setAcct(anon ? { name: "", email: "", anon: true } : { name, email: reg.email.trim(), anon: false });
    setResearch(!!reg.research);
    const answers = { ...reg };
    if (anon) { delete answers.name; delete answers.email; }
    setRegAnswers(answers);
    setFertSigns((p) => ({ ...p, on: null })); // a new registration starts fertility signs at its stage's default (L7)
    // Reminders only when she ticked "Remind me"; unticked also cancels anything left over.
    applyReminders(!!reg.notifOptin);
    chooseStage(sid);
    setStageName(slabel);
    setDraft({});
    setAppTab("home"); setPregTab("home");
    // The welcome is written here, on the device. Registration answers stay on this device,
    // except what she opts into on the last step: with "Remind me" in a web browser, her
    // reminder days, time and time zone go to Cyra's server for web push (builds with
    // webReminders); with weekly counts on (builds with counts), her life-stage group goes out
    // with yes/no check-in flags (at most one send a day, each flag at most once a week, never on
    // the day it was logged). They are also in any encrypted backup she exports (the ZIP and the age band are left out of it), and her
    // first name is in the doctor-email subject when she uses Open in email or Copy email
    // (Report). A POTS report or spreadsheet uses no registration answer; her first name goes
    // on it only if she ticks "Put my first name on it" (lib/potsReport.js).
    setWelcome(`Welcome${name ? `, ${name}` : ""} — your ${slabel} space is ready.`);
    setPhase("app");
  };

  /* ---------- shared check-in pieces (one instance, rendered by whichever Today is active) ---------- */
  const scoreMeter = <ScoreMeter liveScore={liveScore} scoreLabel={scoreLabel} scoreColor={scoreColor} touched={touched} />;
  const scaleSection = <ScaleSection scales={scales} setScales={setScales} />;
  const bodySection = <BodySignals fertOn={fertOn} stage={stage} showBody={showBody} setShowBody={setShowBody} flow={flow} setFlow={pickFlow} disch={disch} setDisch={setDisch} odor={odor} setOdor={setOdor} bodyOdor={bodyOdor} setBodyOdor={setBodyOdor} />;
  // Fertility signs (L7): the Today group where fertShown says so. Its privacy line names only what this build has (lib/disclosures.js).
  const fertPrivacy = fertPrivacyLine(FEATURES);
  const fertSection = fertOn ? <FertilitySigns fert={fert} setFert={setFert} unit={tempUnit} setUnit={setTempUnit} privacy={fertPrivacy} /> : null;
  // "more detail" opens the full form for this visit only: the answers so far move onto their symptom chips; the Settings preference is untouched.
  const quickCheckin = <QuickCheckin stage={stage} draft={draft} setDraft={setDraft} onMore={() => { setDraft((d) => foldQuick(d, stage)); setExpanded(true); }} />;

  if (!hydrated) {
    // Start over runs the same clean-up as Delete everything, minus the wearable disconnects:
    // the record that names them can't be read (the screen says so). It always leaves this
    // week's hold, since that record may say counts already went this week. A phone has no
    // server-side reminder row, so nothing on the server can block it.
    if (recordUnavailable) return <Shell {...shell}><RecordUnavailableScreen platform={platform()} locked={recordLocked} onRetry={hydrate} onStartOver={() => wipe({}, { holdWeek: true })} /></Shell>;
    return <Shell {...shell}><main aria-busy="true" /></Shell>;
  }

  if (phase === "splash") {
    return (
      <Shell {...shell} toast={toast}>
        <SplashScreen onStart={() => setPhase("register")} onImport={importBackup} />
      </Shell>
    );
  }

  if (phase === "register") {
    return (
      <Shell {...shell} toast={toast} repaint={repaint}>
        <RegisterScreen reg={reg} setReg={setReg} regStep={regStep} setRegStep={setRegStep} regTouched={regTouched} setRegTouched={setRegTouched} cadence={cadence} setCadence={setCadence} socialBusy={socialBusy} startSocial={startSocial} finishReg={finishReg} onBackToSplash={() => setPhase("splash")} scheme={scheme} />
      </Shell>
    );
  }
  /* Install and update (spec A14.1). The Home tip and Settings → Install show only where this
     browser can install Cyra and the record really is in IndexedDB (the installed app then opens
     the same record); the tip waits for 3 logged days and never comes back once hidden or installed. */
  const daysLogged = stage === "preg" ? Object.keys(pregLog).length : days.length;
  const recordInIdb = storageDriver === "indexeddb";
  const installNow = async (from) => {
    const out = await promptInstall();
    setInstallMode(currentInstallMode());
    if (out === "accepted") { setInstallHint((h) => mergeInstallHint(h, "installed")); ping("Cyra is installed. Open it from your home screen or app list."); }
    else if (out === "dismissed" && from === "tip") setInstallHint((h) => mergeInstallHint(h, "dismissed"));
  };
  const hideInstallTip = () => { setInstallHint((h) => mergeInstallHint(h, "dismissed")); ping("Tip hidden. Install stays in Settings."); };
  const showInstallSteps = () => { setShowPal(false); setSettingsFocus("install"); setShowSettings(true); };
  // Reload for an update: pending saves are written first, then the waiting worker takes over.
  const reloadForUpdate = async () => { if (updating.current) return; updating.current = true; await settleSaves(); await applyUpdate(); };
  // The last child of header.mast (inside the banner landmark), on the app and intake screens only.
  const updateRow = updateReady ? <UpdateRow onReload={reloadForUpdate} /> : null;
  const keepsWeekNote = pulseSent?.week === weekKey() || holdWeek === weekKey();
  /* A build without wearables can't end a connection an earlier build (or a restored backup) left in the
     record, so Delete everything says where to remove it (DataControls, LEGACY_WEAR_LINE). Demo rows don't count. */
  const legacyWear = !FEATURES.wearables && (Object.values(wearSources).some((s) => s && typeof s === "object" && !s.demo) || terraOff.length > 0);
  const settingsSheet = showSettings && <SettingsSheet daysLogged={daysLogged} lastBackupAt={lastBackupAt} todayIso={todayIso} triggerRef={settingsBtnRef} cadence={cadence} setCadence={setCadence} quietHours={quietHours} setQuietHours={setQuietHours} quickMode={quickMode} setQuickMode={setQuickMode} setShowSettings={setShowSettings} ping={ping} storageDriver={storageDriver} onExport={exportBackup} onImport={importBackup} onWipe={wipeDevice} keepsWeekNote={keepsWeekNote} reminders={reminders} reminderSupport={reminderSupport()} onReminders={(on) => applyReminders(on)} research={research} setResearch={setSharing} stage={stage} stageName={stageName} pots={pots} onPotsOn={potsOn} onPotsOff={potsOff}
    install={offersInstall({ mode: installMode, stored: recordInIdb }) ? { mode: installMode, onInstall: () => installNow("settings") } : null} focusTo={settingsFocus} offlineCopy={offlineReady} appearance={appearance} onAppearance={chooseAppearance} legacyWear={legacyWear}
    fertRow={stage === "periods" ? { on: fertOn, setOn: setFertOn, ttc, privacy: fertPrivacy } : null} />;
  if (!stage) {
    // Choosing a stage again: the saved record is still here, so Settings (and Delete
    // everything) stays one tap away.
    return (
      <Shell {...shell} toast={toast}>
        <header className="mast" style={{ justifyContent: "flex-end", marginBottom: 0 }}>
          <button ref={settingsBtnRef} className="stagechip icon" onClick={() => setShowSettings((v) => !v)} aria-label="Settings and your data" aria-expanded={showSettings} aria-controls="settings-sheet"><Icon name="sliders" size={18} /></button>
          {updateRow}
        </header>
        {settingsSheet}
        <IntakeScreen org={org} acct={acct} ob={ob} setOb={setOb} obBusy={obBusy} setObBusy={setObBusy} setStage={chooseStage} setStageName={setStageName} setWelcome={setWelcome} setAppTab={setAppTab} setPregTab={setPregTab} finishOnboarding={finishOnboarding} />
      </Shell>
    );
  }

  /* Home: the patterns card (the same card the Patterns tab opens with, compact: fewer symptom
     rows, no hint, day card once a day is tapped), once 3 days are logged. */
  const sixty = stage === "preg" ? null : windowDays(ins.sorted, symIds, todayIso, 60, scoreScale);
  const patternsCard = sixty && sixty.filter((d) => d.e).length >= 3
    ? <PatternsCard days={sixty} ids={symIds} labels={symMap} starts={isMeno ? [] : ins.starts} sorted={ins.sorted} todayIso={todayIso} maxRows={3} compact popIso={justSaved} onMore={() => goTab("patterns")} scale={scoreScale} />
    : null;
  /* POTS tools open as a page under the current tab (potsOpen): the tab bar stays, with the
     current tab still selected, and a Back button at the top of the page returns to it. */
  const potsPage = potsOpen && potsTab;
  const pregIs = (id) => !potsPage && pregTab === id;
  const appIs = (id) => !potsPage && appTab === id;
  const homeView = (
    <HomeScreen
      acct={acct} stage={stage} stageName={stageName} pregWeek={pregWeek} tri={tri} dueDate={dueDate} pred={pred} loggedLast14={loggedLast14} loggedTotal={stage === "preg" ? Object.keys(pregLog).length : ins.sorted.length} streakLine={streakLine} goTab={goTab} entryOn={entryOn} todayIso={todayIso} homeInsight={homeInsight} patternsCard={patternsCard} wearInsights={wearInsights} milestones={milestones} justReached={justReached} nextUp={nextUp} pulse={FEATURES.counts ? pulse : null}
      todayEntry={entryOn(todayIso) || null} scoreIds={stage === "preg" ? Object.keys(GSYM) : symIds} scoreLabels={stage === "preg" ? GSYM : symMap} dayScore={scoreDay}
      recap={recap} showRecap={showRecap} setShowRecap={setShowRecap}
      showWear={showWear} setShowWear={setShowWear} wearSources={wearSources} terraOffCount={terraOff.length} connectWear={connectWear} disconnectWear={disconnectWear} wearConfirm={wearConfirm} setWearConfirm={setWearConfirm} wearBusy={wearBusy} wearData={wearData} wAvg={wAvg}
      showMeds={showMeds} setShowMeds={setShowMeds} meds={meds} medLog={medLog} medEffects={medEffects} setMedLog={setMedLog} newMed={newMed} setNewMed={setNewMed} setMeds={setMeds} ping={ping}
      showAppts={showAppts} setShowAppts={setShowAppts} upcoming={upcoming} past={past} daysUntil={daysUntil} setAppts={setAppts} newAppt={newAppt} setNewAppt={setNewAppt}
      showJournal={showJournal} setShowJournal={setShowJournal} journal={journal} jDraft={jDraft} setJDraft={setJDraft} setJournal={setJournal}
      fertRead={ttc && fertOn && (() => { const f = cleanFert(entryOn(todayIso)); return !!(f.cm || f.opk || f.bbt != null); })() ? fertRead(entryOn(todayIso), tempUnit).text : null}
      installTip={showInstallHint({ mode: installMode, daysLogged, installHint, stored: recordInIdb }) ? { mode: installMode, onInstall: () => installNow("tip"), onShow: showInstallSteps, onHide: hideInstallTip } : null}
      potsCard={potsTab && potsOk
        ? <PotsHome pots={pots} totals={potsTotals} todayIso={todayIso} onQuickLog={() => openPots(true)} onStandTest={openStandTest} onOpen={() => openPots()}
            last={potsHomeLive}
            onUndo={() => { const l = potsHomeLive; setPotsHomeLast(null); if (!l) return; setPots((p) => removePotsItem(p, l.day, l.id)); ping(`Removed: ${l.text}`); }}
            onTook={(med, slot) => { const day = syncDay(), t = nowHHMM(), id = newPotsId(); setPots((p) => logDose(p, day, { id, medId: med.id, slot, state: "taken", t })); setPotsHomeLast({ id, day, kind: "dose", text: `${med.name} ${slot.replace(/^0/, "")} at ${t.replace(/^0/, "")}` }); ping(`${med.name} logged at ${t.replace(/^0/, "")}`); }}
            onDrink={(pr) => {
              if (asksSodium(pr)) { openPots(); return; }
              const day = syncDay(), t = nowHHMM(), id = newPotsId(), units = pots.settings.units;
              const item = { id, t, kind: pr.kind, label: pr.label, ml: pr.ml, naMg: pr.naMg, presetId: pr.id };
              setPots((p) => addIntake(p, day, item));
              setPotsHomeLast({ id, day, kind: "intake", text: `${potsIntakeText(item, units)} at ${potsAmpm(t)}` });
              ping(intakeToast(item, day === todayIso ? potsTotals : dayTotals(pots, day), pots.settings.goals, units));
            }} />
        : potsOffer ? <PotsOffer onOn={() => { setPots((p) => markOffered(p, todayIso)); potsOn(); }} onNot={() => setPots((p) => markOffered(p, todayIso))} /> : null}
    />
  );
  const askView = <AskScreen org={org} stage={stage} askQ={askQ} setAskQ={setAskQ} runAsk={runAsk} askBusy={askBusy} askOut={askOut} askAI={askAI} setAskAI={setAskAI} aiAvailable={aiAvailable} potsOn={potsTab && potsOk} ping={ping} />;
  /* POTS tab: its sections, POTS settings and the first-run cards (goals, medicines). The tools
     this build has decide what "What would help?" and POTS settings offer (POTS_SHOWS). */
  const potsDay = potsDate && potsDate < todayIso ? potsDate : todayIso;
  const potsConditions = Array.isArray(regAnswers?.conditions) ? regAnswers.conditions : [];
  const POTS_SHOWS = ["test", "fluid", "sym", "meds", "move"];
  const potsView = (
    <PotsScreen onBack={() => setPotsOpen(false)} pots={pots} setPots={setPots} locked={!potsOk} potsSec={potsSec} setPotsSec={setPotsSec} shows={POTS_SHOWS} preg={stage === "preg"} storageDriver={storageDriver}
      sections={potsOk ? {
        today: <PotsToday pots={pots} setPots={setPots} day={potsDay} todayIso={todayIso} setDay={setPotsDate} ping={ping} stage={stage} stageName={stageName} checkin={entryOn(potsDay)} symMap={stage === "preg" ? GSYM : symMap} conditions={potsConditions} onStandTest={() => { setPotsSec("stand"); setPotsFocus("stand"); }} onReport={() => setPotsSec("report")} storageDriver={storageDriver} syncDay={syncDay} />,
        report: <PotsReport pots={pots} setPots={setPots} stage={stage} stageName={stageName} todayIso={todayIso} ping={ping} firstName={acct.anon ? "" : (acct.name || "").trim()} checkin={potsCheckin} checkinLabels={stage === "preg" ? GSYM : symMap} starts={ins.starts} locale={typeof navigator !== "undefined" ? navigator.language : "en-US"} />,
        patterns: <PotsPatterns pots={pots} stage={stage} stageName={stageName} todayIso={todayIso} starts={ins.starts} checkin={potsCheckin} wearData={FEATURES.wearables ? wearData : NO_ROWS} connected={FEATURES.wearables ? potsWearConnected : NO_ROWS} />,
        stand: <StandSection pots={pots} setPots={setPots} stage={stage} todayIso={todayIso} ping={ping} running={potsRun} focus={potsFocus === "stand"} onFocused={potsFocused} cyc={potsCyc}
          onStart={() => setPotsRun({ kind: "test", id: null, phase: "safety", phaseStart: Date.now(), standAt: null, done: [], interrupt: null })} />,
        move: <MovePlan pots={pots} setPots={setPots} stage={stage} todayIso={todayIso} ping={ping} focus={potsFocus === "move"} onFocused={potsFocused}
          onStart={() => setPotsRun({ kind: "session", id: null, day: todayIso, phase: "setup", phaseStart: Date.now(), plan: null, paused: null, pausedMs: 0 })} />,
      } : {}}
      settings={potsOk ? ({ headRef, onBack }) => <PotsSettings pots={pots} setPots={setPots} stage={stage} stageName={stageName} conditions={potsConditions} ping={ping} shows={POTS_SHOWS} today={todayIso} headRef={headRef} onBack={onBack} /> : null}
      setupCards={potsOk ? [
        { id: "goals", title: "Any goals from your clinician?", skip: { label: "No goals yet, just track", big: true },
          body: (saveRef) => <GoalSheet setup pots={pots} setPots={setPots} units={pots.settings.units} conditions={potsConditions} preg={stage === "preg"} today={todayIso} saveRef={saveRef} /> },
        { id: "meds", title: "Any POTS medicines or supports?", skip: { label: "Skip, add later" }, body: (saveRef) => <MedSetup setPots={setPots} saveRef={saveRef} /> },
      ] : []} />
  );
  /* Running takeover (design 3.3-7): while a stand test or a guided movement session runs, the
     runner is the page — its single <main> with one h1 — instead of the header chips, the tab bar
     and the tab content (the wordmark stays). Stop or finishing are the only ways out, so a tab
     switch, Settings, a restore, a wipe or a stage change can't happen mid-test or mid-session. */
  if (potsRun && potsOk) {
    return (
      <Shell {...shell} toast={toast}>
        <header className="mast"><span className="mark">{org.name}<span className="sub">{org.tag}</span></span></header>
        {potsRun.kind === "session"
          ? <SessionRunner run={potsRun} setRun={setPotsRun} pots={pots} setPots={setPots} stage={stage} todayIso={todayIso} ping={ping}
              onEnd={() => { setPotsRun(null); setPotsSec("move"); setPotsFocus("move"); }} />
          : <StandRunner run={potsRun} setRun={setPotsRun} pots={pots} setPots={setPots} stage={stage} todayIso={todayIso} ping={ping} cyc={potsCyc}
              onEnd={() => { setPotsRun(null); setPotsSec("stand"); setPotsFocus("stand"); }} />}
      </Shell>
    );
  }
  const connView = <ConnectScreen relationship={relationship} setRelationship={setRelationship} conn={conn} setConn={setConn} intimacy={intimacy} setIntimacy={setIntimacy} after={after} setAfter={setAfter} connLog={connLog} setConnLog={setConnLog} todayIso={todayIso} stage={stage} ping={ping} />;

  return (
    <Shell {...shell} toast={toast} repaint={repaint}>
      <header className="mast">
        <span className="mark">{org.name}<span className="sub">{org.tag}</span></span>
        {stage && <span className="acctchip" title={`${acct.anon ? "Anonymous" : acct.name || "You"}${research && FEATURES.counts && hasServer() ? " · sharing counts ✓" : ""}`}>{acct.anon ? "Anonymous" : acct.name || "You"}{research && FEATURES.counts && hasServer() ? " · sharing counts ✓" : ""}</span>}
        {/* One sheet at a time: opening either closes the other (UI S1). */}
        {stage && orgId === "cyra" && <button ref={palBtnRef} className="stagechip icon" onClick={() => { setShowSettings(false); setShowPal((s) => !s); }} aria-label="Color palette" aria-expanded={showPal} aria-controls="palette-sheet"><Icon name="palette" size={18} /></button>}
        {stage && <button ref={settingsBtnRef} className="stagechip icon" onClick={() => { setShowPal(false); setShowSettings((s) => !s); }} aria-label="Check-in settings" aria-expanded={showSettings} aria-controls="settings-sheet"><Icon name="sliders" size={18} /></button>}
        {stage && <button className="stagechip quiet" onClick={() => { setPots(resetPregClearance); setStage(null); setOb({ step: 0, preg: null, age: null, per: null, vms: null }); setWelcome(""); }}>{stageName} · change</button>}
        {updateRow}
      </header>

      {/* ============ APP ============ */}
      {settingsSheet}
      {showPal && stage && orgId === "cyra" && <PaletteSheet stage={stage} stageName={stageName} palIdx={palIdx} setPalIdx={setPalIdx} setShowPal={setShowPal} triggerRef={palBtnRef} scheme={scheme} />}
      <div>

        {/* ---------- PREGNANCY: its own component ---------- */}
        {stage === "preg" ? (
          <>
            <nav aria-label="Sections" className="tabswrap" data-start={tabEdge.start ? "1" : "0"} data-end={tabEdge.end ? "1" : "0"}>
              <div className="tabs" role="tablist" onScroll={(e) => measureTabs(e.currentTarget)}>
                {[["home", "Home"], ["today", "Today"], ["cal", "Calendar"], ["mile", "Milestones"], ["connect", "Connect"], ["ask", "Ask"]].map(([id, l]) => (
                  <button key={id} role="tab" id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={pregTab === id} tabIndex={pregTab === id ? 0 : -1} className={`tab ${pregTab === id ? "tab-on" : ""}`} onClick={() => { setPotsOpen(false); setPregTab(id); }} onFocus={tabIntoView} onKeyDown={tabKeys}>{l}</button>
                ))}
              </div>
            </nav>
            {/* The screen is the tabpanel each tab's aria-controls points at; keyed so a tab change remounts it (and its
                fade-in runs once). It carries no aria-labelledby: each screen's <main> is the landmark, and axe's region rule
                counts a labelled non-landmark wrapper as content outside one. */}
            <div className="tabpanel" role="tabpanel" id={`panel-${pregTab}`} key={pregTab}>
            {potsPage && potsView}

            {pregIs("today") && (
              <PregTodayScreen onPots={potsTab ? () => openPots() : null} pregWeek={pregWeek} trimester={trimester} scoreMeter={scoreMeter} draft={draft} setDraft={setDraft} symMap={symMap} scaleSection={scaleSection} bodySection={bodySection} kicks={kicks} onKick={addKick} setPregLog={setPregLog} todayIso={todayIso} editDate={editDate} onEndEdit={endEdit} savedToday={savedToday} yesterdayIso={yesterdayIso} yesterdayLogged={yesterdayLogged} anyLogged={Object.keys(pregLog).length > 0} onEditDay={startEdit} symPrefs={symPrefs} setSymPrefs={setSymPrefs} dayNote={dayNote} setDayNote={setDayNote} scales={scales} odor={odor} bodyOdor={bodyOdor} ping={ping} research={FEATURES.counts && research} contribute={(entry, dateIso) => contribute([...eventsForDay("preg", entry), ...(entry.kicks > 0 ? ["kicks"] : [])], dateIso)} />
            )}
            {pregIs("cal") && (
              <PregCalendarScreen pregWeek={pregWeek} pregLog={pregLog} dayScore={scoreDay} scoreColor={scoreColor} scoreInk={scoreInk} scoreLabel={scoreLabel} todayIso={todayIso} pregSel={pregSel} setPregSel={setPregSel} onEdit={startEdit} ping={ping} />
            )}
            {pregIs("mile") && <MilestonesScreen pregWeek={pregWeek} onPlan={onPlan} />}
            {pregIs("ask") && askView}
            {pregIs("connect") && connView}
            {pregIs("home") && homeView}
            </div>
          </>
        ) : (
          <>
            <nav aria-label="Sections" className="tabswrap" data-start={tabEdge.start ? "1" : "0"} data-end={tabEdge.end ? "1" : "0"}>
              <div className="tabs" role="tablist" onScroll={(e) => measureTabs(e.currentTarget)}>
                {[["home", "Home"], ["today", "Today"], ["cal", "Calendar"], ["patterns", "Patterns"], ["connect", "Connect"], ["report", "Report"], ["shelf", "Care"], ["ask", "Ask"]].map(([id, l]) => (
                  <button key={id} role="tab" id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={appTab === id} tabIndex={appTab === id ? 0 : -1} className={`tab ${appTab === id ? "tab-on" : ""}`} onClick={() => { setPotsOpen(false); setAppTab(id); }} onFocus={tabIntoView} onKeyDown={tabKeys}>{l}</button>
                ))}
              </div>
            </nav>
            <div className="tabpanel" role="tabpanel" id={`panel-${appTab}`} key={appTab}>
            {potsPage && potsView}

            {appIs("today") && (
              <TodayScreen onPots={potsTab ? () => openPots() : null} pred={pred} stage={stage} welcome={welcome} editDate={editDate} onEndEdit={endEdit} setDraft={setDraft} setSleepQ={setSleepQ} scoreMeter={scoreMeter} quickMode={quickMode} expanded={expanded} setExpanded={setExpanded} quickCheckin={quickCheckin} savedToday={savedToday} yesterdayIso={yesterdayIso} yesterdayLogged={yesterdayLogged} onEditDay={startEdit} symPrefs={symPrefs} setSymPrefs={setSymPrefs} dayNote={dayNote} setDayNote={setDayNote} symMap={symMap} draft={draft} sleepQ={sleepQ} scaleSection={scaleSection} bodySection={bodySection} todayIso={todayIso} editPeriod={editPeriod} setEditPeriod={setEditPeriod} scales={scales} flow={flow} disch={disch} odor={odor} bodyOdor={bodyOdor} days={days} setDays={setDays} onSaved={onSaved} ping={ping} setAppTab={setAppTab} research={FEATURES.counts && research} contribute={(entry, dateIso) => contribute(eventsForDay(stage, { ...entry, phase: pred?.phase, late: pred?.late }), dateIso)} fertSection={fertSection} fert={fert} tempUnit={tempUnit} fertOn={fertOn} />
            )}
            {appIs("cal") && (
              <CalendarScreen pred={pred} predWhy={predWhy} cyc={cyc} onCycleUse={setCycleUse} stage={stage} isMeno={isMeno} days={days} symIds={symIds} symMap={symMap} dayScore={scoreDay} scoreColor={scoreColor} scoreInk={scoreInk} scoreLabel={scoreLabel} todayIso={todayIso} selDay={selDay} setSelDay={setSelDay} onEdit={startEdit} fertOn={fertOn} tempUnit={tempUnit} />
            )}
            {appIs("patterns") && <PatternsScreen ins={ins} lens6={cyc.lens6} symIds={symIds} symMap={symMap} scoreScale={scoreScale} stage={stage} isMeno={isMeno} todayIso={todayIso} medEffects={medEffects} potsOn={potsTab && potsOk} popIso={justSaved} onGo={goTab} onAsk={(q) => { setAskQ(q); goTab("ask"); runAsk(q); }} onPots={potsTab ? () => openPots() : null} fert={ttc && fertOn ? { unit: tempUnit } : null} />}
            {appIs("report") && <ReportScreen ins={ins} lens6={cyc.lens6} stage={stage} stageName={stageName} buildEmail={buildEmail} ping={ping} showTable={showTable} setShowTable={setShowTable} potsOn={potsTab && potsOk} todayIso={todayIso} appt={upcoming[0] || null} daysUntil={daysUntil} goTab={goTab} setShowAppts={setShowAppts} scoreOn={scoreOn} scoreColor={scoreColor} fert={ttc && fertOn ? { unit: tempUnit } : null} />}
            {appIs("shelf") && <CareScreen shelfItems={shelfItems} onTry={(s) => { setMeds((m) => [...m, { id: Date.now(), name: `${s.brand} ${s.name}`, kind: s.id === "midi" ? "habit" : "supp", started: todayIso }]); ping("Added — Cyra will compare your days before and after"); }} />}
            {appIs("ask") && askView}
            {appIs("connect") && connView}
            {appIs("home") && homeView}
            </div>
          </>
        )}
      </div>

    </Shell>
  );
}
