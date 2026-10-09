import { useEffect, useMemo, useRef, useState } from "react";

/* ================================================================
   CYRA HEALTH — reference implementation
   Life stages: My Cycle · Pregnancy · Peri/Meno — exactly one per user.
   The health record (daily logs, journal, intimacy log, trials, appointments,
   wearable rows once collected) lives in this component's state and is saved only
   on this device (IndexedDB or the app sandbox; lib/storage.js). What can leave the
   device, each disclosed where it is turned on:
   - always, with no health data: the stage-less read of last week's anonymous
     counts (GET /api/pulse) — IP address and user agent, like any request;
   - opt-in "Share anonymous weekly counts": life stage group + yes/no event flags,
     at most once a day, on a later day than the check-in (lib/pulse.js); the server
     keeps them only as weekly totals;
   - opt-in "Also ask Cyra's AI": only the typed question, and only when the
     on-device library has no answer (lib/askLibrary.js, runAsk below);
   - opt-in Oura / Fitbit · Garmin · Whoop connections (lib/wearables.js): Oura
     readings pass through the server on each sync and are not kept; Fitbit/Garmin/
     Whoop readings wait in server memory (never on disk) for up to 7 days until this
     device collects them, and Terra keeps its own copy under its policy; the device
     sends its Oura tokens / Terra mailbox key in request bodies;
   - web reminders: the browser's push subscription (address and keys), reminder days,
     time and time zone (plus the last day a reminder went out, so there is never a
     second one) (lib/notifications.js); phone reminders are scheduled on the phone;
   - only when she starts it: the encrypted backup file (lib/backup.js), the
     doctor-summary email draft (mailto) and the copied summary text (ReportScreen).
   Backend requests use ./lib/api.js (fetch), except the sign-in, Oura and Terra
   connection windows. These are browser navigations to `${API_BASE}/api/oauth/:id/start`,
   `${API_BASE}/api/integrations/oura/start` and the Terra widget URL that
   /api/integrations/terra/session returns, and each one ends on a backend callback or
   done page (startSocial below; lib/wearables.js). A build without VITE_API_BASE makes
   neither kind. No Anthropic call and no API key exist in client code.

   This file owns ALL state and derived data (useState / useMemo only).
   Screens live in ./screens, one file per screen; shared pieces in
   ./components; constants and pure engine functions in ./lib.
   ================================================================ */

import { SYM, SYMS, PSYM, GSYM, SHELF, PALETTES, ORGS, RAMPS } from "./lib/constants.js";
import { seed, fmt, insights, predict, predictionWaits, symBurden, scoreLabel, dayScore } from "./lib/engine.js";
import { API_BASE, apiFetch, apiPost, hasServer } from "./lib/api.js";
import { DEMO_WEARABLES, VIA_SERVER, connectSource, syncSource, disconnectSource, drainTerra, mergeRows, disconnectHelp } from "./lib/wearables.js";
import { eventsForDay, fetchPulse, pickStage, queueEvents, queueDue, flushQueue, pruneQueue, mergeQueues, localDay, weekKey } from "./lib/pulse.js";
import { answerLocally } from "./lib/askLibrary.js";
import { storage } from "./lib/storage.js";
import { encryptBackup, decryptBackup } from "./lib/backup.js";
import { syncReminders, wantsReminders, forgetOnServer, forgetOnServerWhy, knownEndpoints, unsubscribeBrowser, support as reminderSupport } from "./lib/notifications.js";
import { isNative, platform, appReturnUrl, newAppVerifier, waitForAppUrl, App as CapApp, Filesystem, Directory, Encoding, Share } from "./lib/native.js";

const DEMO_SEED = import.meta.env.VITE_DEMO_SEED === "true";
/* What persists on the device: the health record and settings. Never UI state.
   reminders persists { enabled, endpoint, pending, rev } — this browser's push address, any
   address Cyra's server still has to forget, and a version so every open tab agrees on the
   on/off switch; its status is worked out again at every launch. */
const PERSISTED = ["palIdx", "relationship", "connLog", "cadence", "quietHours", "quickMode", "meds", "medLog", "appts", "journal", "wearSources", "wearData", "acct", "research", "stage", "stageName", "welcome", "days", "pregLog", "pulseQueue", "pulseSent", "pulseLastSend", "pulseRev", "askAI", "regAnswers", "reminders", "terraOff"];
/* Per-device choices a restored backup never overrides: sharing counts and asking the AI
   are consents given on this device; terraOff is this device's unfinished disconnects. */
const DEVICE_ONLY = ["research", "pulseQueue", "pulseSent", "pulseLastSend", "pulseRev", "askAI", "terraOff"];
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
import QuickCheckin from "./components/QuickCheckin.jsx";
import SettingsSheet from "./components/SettingsSheet.jsx";
import PaletteSheet from "./components/PaletteSheet.jsx";
import SplashScreen from "./screens/SplashScreen.jsx";
import RecordUnavailableScreen from "./screens/RecordUnavailableScreen.jsx";
import RegisterScreen from "./screens/RegisterScreen.jsx";
import IntakeScreen from "./screens/IntakeScreen.jsx";
import HomeScreen from "./screens/HomeScreen.jsx";
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
  const [quickMode, setQuickMode] = useState(true);
  const [meds, setMeds] = useState([]);
  const [medLog, setMedLog] = useState({});
  const [newMed, setNewMed] = useState({ name: "", kind: "supp", started: new Date().toISOString().slice(0, 10) });
  const [showMeds, setShowMeds] = useState(false);
  const [appts, setAppts] = useState([]);
  const [newAppt, setNewAppt] = useState({ date: "", who: "" });
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
  // are opt-ins: with "Remind me" in a web browser, the reminder days, time and time zone go
  // to Cyra's server for web push; with weekly counts on, the life-stage group goes out with
  // the tallies; sign-in prefill puts the provider's name and email in server memory for at
  // most 5 minutes. They also leave inside any encrypted backup she exports (the ZIP and age
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
  const [stage, setStage] = useState(null);
  const [stageName, setStageName] = useState("");
  const [ob, setOb] = useState({ step: 0, preg: null, age: null, per: null, vms: null });
  const [obBusy, setObBusy] = useState(false);
  const [welcome, setWelcome] = useState("");
  const [appTab, setAppTab] = useState("patterns");
  const [days, setDays] = useState(() => (DEMO_SEED ? seed() : []));
  const [draft, setDraft] = useState({});
  const [sleepQ, setSleepQ] = useState(null);
  const [kicks, setKicks] = useState(0);
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
  const [hydrated, setHydrated] = useState(false);
  const [recordUnavailable, setRecordUnavailable] = useState(false); // phone: the record exists but can't be read right now
  const [recordLocked, setRecordLocked] = useState(false); // iOS: unreadable because the phone is locked (file protection)
  const [storageDriver, setStorageDriver] = useState(null); // where the record really is, for Settings → Your data (null until probed)
  const [holdWeek, setHoldWeek] = useState(null); // the week-only hold (lib/storage.js), so Delete everything can say it stays
  const [regAnswers, setRegAnswers] = useState(null); // registration answers (no name or email in Anonymous Mode)
  const [reminders, setReminders] = useState({ enabled: false, status: "off", endpoint: null, pending: [], rev: 0 }); // status: off | on | blocked (+denied) | unavailable | error | unsupported; pending: push addresses the server still has to forget
  const wipingRef = useRef(false); // Delete everything / Start over in progress: nothing may be saved any more
  const saveTimer = useRef(null);  // the pending autosave, cancelled by a wipe

  const org = ORGS[orgId];
  const stagePal = stage && orgId === "cyra" ? PALETTES[stage][palIdx[stage]] : null;
  const t = { ...org.theme, ...(stagePal || {}) };
  const symMap = stage === "periods" ? PSYM : SYM;
  const symIds = Object.keys(symMap);
  const ins = useMemo(() => insights(days, stage === "periods" ? Object.keys(PSYM) : SYMS), [days, stage]);
  /* Care: items for this stage, the ones that fit what she logged in the last 30 days first
     (most-logged match first), then in shelf order. Matching runs here, on the device. */
  const shelfItems = useMemo(() => {
    const pool = [...ins.counts, { id: "rough", label: "Rough nights", days: ins.roughNights }];
    const best = (s) => pool.filter((c) => s.m.includes(c.id) && c.days > 0).sort((a, b) => b.days - a.days)[0] || null;
    return SHELF.filter((s) => s.stages.includes(stage) && (!org.partnerIds || org.partnerIds.includes(s.id)))
      .map((s, i) => ({ ...s, top: best(s), order: i }))
      .sort((a, b) => (b.top?.days || 0) - (a.top?.days || 0) || a.order - b.order);
  }, [ins, stage, org.partnerIds]);
  // Until two cycles are logged, predictions start from the registration answers (last period, usual length).
  const pred = useMemo(() => predict(ins, stage === "preg" ? null : regAnswers), [ins, regAnswers, stage]);
  const predWaits = stage !== "preg" && !pred && predictionWaits(ins, regAnswers);
  const todayIso = new Date().toISOString().slice(0, 10);
  const pregWeek = 22, trimester = 2;
  const ping = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  useEffect(() => { setKicks(0); }, [todayIso]); // the kick counter starts again each day

  /* The doctor email: everything in it comes from one window — the last 30 calendar days —
     and the denominator is the number of days she actually logged in it. */
  const buildEmail = () => {
    const subject = `Symptom summary ahead of my appointment${acct.name ? ` — ${acct.name}` : ""}`;
    const n = ins.last30.length;
    const lines = [
      `Hi — ahead of my appointment, a brief summary of the last 30 days (I logged ${n} of them in ${org.name}):`,
      ``,
      ...ins.counts.filter((c) => c.days > 0).slice(0, 4).map((c) => `• ${c.label}: ${c.days} of ${n} logged days (${c.strong} moderate-to-strong)`),
      ...(ins.lens30.length >= 1 ? [``, `• Cycle length${ins.lens30.length > 1 ? "s" : ""} in these 30 days: ${ins.lens30.join(", ")} days${ins.variability30 != null ? ` (${ins.variability30}-day spread)` : ""}`] : []),
      ...(stage === "peri" && ins.hfMult30 ? [`• Hot flashes were ${ins.hfMult30.toFixed(1)}x more likely after poorly-rated nights`] : []),
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
     device's IP address and user agent. */
  const aiAvailable = !!API_BASE;
  const runAsk = async () => {
    const question = askQ.trim().slice(0, 500);
    if (!question) return ping("Type a question first");
    const local = answerLocally(question);
    if (local.matched || !askAI || !aiAvailable) {
      setAskOut({ source: "library", ...local, offerAI: !local.matched && !askAI && aiAvailable });
      return;
    }
    setAskBusy(true); setAskOut(null);
    try {
      const out = await apiPost("/api/ai/ask", { question });
      // degraded: the server did ask Cyra's AI, but no AI answer came back (refusal, timeout, error)
      setAskOut({ source: out.provider === "rules" ? (out.degraded ? "server-library-attempted" : "server-library") : "ai", answer: out.answer, source_note: out.source_note || null, ask_your_doctor: out.ask_your_doctor || null, urgent: !!out.urgent });
    } catch (e) {
      const answer = e?.status === 429 ? "Too many questions in a minute — try again shortly." : e?.status === 400 ? "Please type a slightly longer question." : "No answer came back from Cyra's AI. Check your connection and try again, or write the question down and bring it to your next visit.";
      setAskOut({ source: "error", answer, source_note: null, ask_your_doctor: null, urgent: false });
    }
    setAskBusy(false);
  };

  /* ---------- day score: 0 (rough) .. 1 (great) ---------- */
  const draftIds = stage === "preg" ? Object.keys(GSYM) : symIds;
  const liveBurden = Math.min(1,
    symBurden(draft, draftIds) * 0.5 +
    (scales.fatigue / 10) * 0.2 +
    (scales.pain / 10) * 0.2 +
    ((10 - scales.moodq) / 10) * 0.1
  );
  const liveScore = 1 - liveBurden; // 1 = great day
  /* Data-viz ramp: saturated and readable, independent of UI chrome colors. */
  const ramp = () => RAMPS[stage] || RAMPS.peri;
  const scoreColor = (s) => {
    const lerp = (a, b, u) => a.map((c, i) => Math.round(c + (b[i] - c) * u));
    const { good, mid, rough } = ramp();
    const c = s > 0.5 ? lerp(mid, good, (s - 0.5) * 2) : lerp(rough, mid, s * 2);
    return `rgb(${c})`;
  };

  /* ======================= HOME ======================= */
  const goTab = (t2) => (stage === "preg" ? setPregTab(t2) : setAppTab(t2));
  const entryOn = (iso) => (stage === "preg" ? pregLog[iso] : days.find((d) => d.date === iso));
  const scoreOn = (iso) => { const e = entryOn(iso); return e ? dayScore(e, stage === "preg" ? Object.keys(GSYM) : symIds) : null; };
  const isoDaysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
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
  const [pulseStatus, setPulseStatus] = useState(API_BASE ? "loading" : "unavailable");
  const pulseRead = useRef(false);
  useEffect(() => {
    if (!stage || pulseRead.current || !API_BASE) return;
    pulseRead.current = true;
    fetchPulse().then((j) => { setPulseAll(j); setPulseStatus("ok"); }, () => setPulseStatus("offline"));
  }, [stage]);
  const pulse = useMemo(() => ({ items: stage ? pickStage(pulseAll, stage) : [], k: pulseAll?.k, status: pulseStatus }), [pulseAll, pulseStatus, stage]);
  const researchRef = useRef(research); researchRef.current = research;
  const pulseRevRef = useRef(pulseRev); pulseRevRef.current = pulseRev;
  // A check-in saved (again): its flags replace whatever that day's earlier save queued. An
  // edit of an earlier day (Calendar) only replaces flags still waiting for that day.
  const contribute = (events, dateIso = todayIso) => {
    if (!researchRef.current || !stage) return;
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
    clearTimeout(saveTimer.current);
    const write = async () => {
      const latest = await storage.load().catch(() => null);
      const base = latest && latest.v === 1 ? latest : snapshot();
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
    if (!stored || stored.v !== 1 || !((stored.pulseRev || 0) > (snap.pulseRev || 0))) return snap;
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
    const avg = (arr) => Math.round((arr.reduce((a, d) => a + dayScore(d, ids), 0) / arr.length) * 100);
    const calm = (arr) => arr.filter((d) => dayScore(d, ids) > 0.64).length;
    const poor = (arr) => arr.filter((d) => d.sleepQ === "poor").length;
    const top = ins.counts[0];
    const topN = (arr) => (top ? arr.filter((d) => ((d.sym || {})[top.id] || 0) > 0).length : 0);
    return { score: [avg(prev30), avg(last30)], calm: [calm(prev30), calm(last30)], poor: [poor(prev30), poor(last30)], top: top ? { label: top.label, prev: topN(prev30), now: topN(last30) } : null };
  })();

  /* Medication effects: 14 days before start vs 14 after, needs ≥5 logged each side */
  const medEffects = meds.map((m) => {
    const start = new Date(m.started + "T12:00:00");
    const before = [], afterArr = [];
    for (let i = 1; i <= 14; i++) {
      const b = new Date(start); b.setDate(b.getDate() - i); const sb = scoreOn(b.toISOString().slice(0, 10)); if (sb != null) before.push(sb);
      const a = new Date(start); a.setDate(a.getDate() + i - 1); const sa = scoreOn(a.toISOString().slice(0, 10)); if (sa != null) afterArr.push(sa);
    }
    if (before.length < 5 || afterArr.length < 5) return { ...m, ready: false, need: Math.max(0, 5 - afterArr.length) };
    const av = (arr) => Math.round((arr.reduce((x, y) => x + y, 0) / arr.length) * 100);
    return { ...m, ready: true, before: av(before), after: av(afterArr) };
  });

  /* ---- Wearables: Apple Watch / Oura / Terra. DEMO seeding (build flag only) is shaped by
     stage and every seeded row is marked demo; production ingests real HealthKit/Health
     Connect readings on the phone and Oura/Terra through the integrations hub. ---- */
  const isMeno = stage === "peri" && stageName === "Menopause";
  const seedWear = (sourceId) => {
    const out = [];
    const cycleLen = pred ? pred.avgLen : 28;
    const lastStart = ins.starts.length ? new Date(ins.starts[ins.starts.length - 1] + "T12:00:00") : new Date();
    const nz = (i, s, amp) => ((Math.sin(i * 12.9898 + s * 78.233) * 43758.5453) % 1) * amp;
    for (let i = 30; i >= 1; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); const iso = d.toISOString().slice(0, 10);
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
  const connectWear = async (id, label, { confirmed = false } = {}) => {
    if (wearBusy) return;
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
      ping(e.message || `Couldn't connect ${label}`);
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
    if (wearBusy || !st) return;
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
    if (!list.length || !API_BASE || wipingRef.current || terraOffBusy.current) return;
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
    if (!terraOffLeft || !API_BASE || !hydrated) return;
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
    if (!st?.key || !API_BASE || DEMO_WEARABLES || wipingRef.current || Date.now() - lastDrain.current < 60_000) return;
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

  const wearInsights = (() => {
    if (!wearData.length) return [];
    const out = [];
    const sorted = [...wearData].sort((a, b) => a.date.localeCompare(b.date));
    if (stage === "periods") {
      let ovu = null, riseAt = null;
      for (let i = 1; i < sorted.length - 2; i++) {
        if (has(sorted[i - 1].temp) && has(sorted[i].temp) && has(sorted[i + 1].temp) && has(sorted[i + 2].temp) && sorted[i - 1].temp < 0.12 && sorted[i].temp >= 0.2 && sorted[i + 1].temp >= 0.2 && sorted[i + 2].temp >= 0.2) { ovu = sorted[i - 1].date; riseAt = sorted[i].date; break; }
      }
      if (ovu) out.push({ num: "Ovulated", text: `A sustained temperature rise began ${fmt(riseAt)} and held — consistent with ovulation around ${fmt(ovu)}. This confirms it after the fact, the way basal-temperature charting does. It can't predict next month, and it isn't contraception.`, advice: stageName === "Trying to Conceive" ? "If you're trying to conceive, the fertile days were the ~5 before and the day of that rise — Cyra will use this to sharpen next month's estimate." : null, urgency: "self" });
      else if (pred && pred.cycleDay < pred.avgLen - 14) out.push({ num: `Day ${pred.cycleDay}`, text: `No temperature shift yet this cycle — which fits: based on your ${pred.avgLen}-day average, ovulation would be expected around day ${pred.avgLen - 14}. Cyra will flag the rise when it holds for three days.`, urgency: "self", advice: stageName === "Trying to Conceive" ? `Your estimated fertile window opens around day ${Math.max(1, pred.avgLen - 19)} — the temperature rise confirms it only afterwards, so pair it with other signs if timing matters.` : null });
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

  /* ---- Milestones: clinical + usage ---- */
  const milestones = (() => {
    const ms = [];
    const total = stage === "preg" ? Object.keys(pregLog).length : ins.sorted.length;
    ms.push({ done: total >= 7, label: "First week tracked" });
    ms.push({ done: total >= 30, label: "A full month of data" });
    if (stage === "periods") {
      ms.push({ done: ins.lens.length >= 1, label: "First full cycle logged" });
      ms.push({ done: ins.lens.length >= 3, label: "3 cycles — predictions sharpen" });
      if (wearData.length) ms.push({ done: wearInsights.some((w) => w.num === "Ovulated"), label: "Ovulation confirmed by temperature" });
    }
    if (stage === "peri") {
      const lastP = ins.starts[ins.starts.length - 1];
      const monthsSince = lastP ? Math.floor((Date.now() - new Date(lastP + "T12:00:00")) / (30.44 * 86400000)) : null;
      ms.push({ done: ins.variability != null && ins.variability >= 7, label: "Cycle variability flagged — transition marker" });
      ms.push({ done: monthsSince != null && monthsSince >= 12, label: `12 months period-free = menopause${monthsSince != null ? ` · ${Math.min(12, monthsSince)}/12` : ""}`, progress: monthsSince != null ? Math.min(1, monthsSince / 12) : 0 });
    }
    if (stage === "preg") { ms.push({ done: pregWeek >= 13, label: "Second trimester" }); ms.push({ done: pregWeek >= 22, label: "Anatomy scan window" }); ms.push({ done: pregWeek >= 28, label: "Third trimester" }); }
    ms.push({ done: Object.values(wearSources).some((w) => w && !w.pending), label: "Wearable connected" });
    ms.push({ done: meds.length > 0, label: "Started a trial — something you're trying" });
    ms.push({ done: appts.some((a) => a.note), label: "First visit debriefed" });
    return ms;
  })();

  const homeInsight = (() => {
    if (stage === "preg") {
      const next = [[24, "glucose screening"], [27, "Tdap vaccine"], [32, "RSV vaccine (seasonal)"], [36, "Group B Strep swab"]].find(([w]) => w >= pregWeek);
      return { num: `Wk ${pregWeek}`, text: next ? `Next up on your care roadmap: ${next[1]} around week ${next[0]}.` : "You're in the home stretch — weekly visits from here." };
    }
    if (stage === "peri" && ins.variability != null && ins.variability >= 7) return { num: `${ins.variability}d`, text: `Your cycles are varying by ${ins.variability} days — the clearest marker of the transition. Worth raising at your next visit.` };
    if (stage === "peri" && ins.hfMult && ins.hfMult > 1.2) return { num: `${ins.hfMult.toFixed(1)}×`, text: `Hot flashes were ${ins.hfMult.toFixed(1)}× more likely after a rough night. Sleep is your biggest lever.` };
    const top = ins.counts.find((x) => x.days > 0);
    if (top) return { num: `${top.days}/30`, text: `${top.label} showed up most this month — ${top.days} of 30 days.` };
    return { num: "—", text: "Log a few days and your first insight appears here." };
  })();

  const upcoming = appts.filter((a) => a.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date));
  const past = appts.filter((a) => a.date < todayIso).sort((a, b) => b.date.localeCompare(a.date));
  const daysUntil = (iso) => Math.round((new Date(iso + "T12:00:00") - new Date(todayIso + "T12:00:00")) / 86400000);
  const nextUp = [];
  if (stage === "preg") nextUp.push({ k: "due", text: `Due in about ${40 - pregWeek} weeks`, sub: new Date(Date.now() + (40 - pregWeek) * 7 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric" }) });
  else if (pred) nextUp.push(pred.late > 0 ? { k: "late", text: `Period ${pred.late} day${pred.late > 1 ? "s" : ""} past your average`, sub: stage === "peri" ? "Irregularity is data too" : "Normal variation happens" } : { k: "period", text: `Period expected in ~${pred.daysTo} days`, sub: `Avg cycle ${pred.avgLen} days` });
  if (upcoming[0]) nextUp.push({ k: "appt", text: `Appointment${upcoming[0].who ? ` with ${upcoming[0].who}` : ""} in ${daysUntil(upcoming[0].date)} day${daysUntil(upcoming[0].date) === 1 ? "" : "s"}`, sub: daysUntil(upcoming[0].date) <= 7 ? "Prep your report →" : fmt(upcoming[0].date), action: daysUntil(upcoming[0].date) <= 7 ? () => goTab("report") : null });

  const style = { "--primary": t.primary, "--paper": t.paper, "--card": t.card, "--accent": t.accent, "--ink": t.ink, "--soft": t.soft, "--line": t.line };

  /* ---------- agentic intake routing ---------- */
  const rulesRoute = (a) => {
    if (a.preg === "yes") return { stage: "preg", label: "Pregnancy", welcome: "Your pregnancy space is ready — week tracking, kick counts, and gentle guidance." };
    if (a.per === "none12") return { stage: "peri", label: "Menopause", welcome: "Welcome — this space tracks symptoms and builds the record your doctor can act on, no period tracking in your way." };
    if (a.per === "irregular" && (a.age !== "u35" || a.vms === "yes")) return { stage: "peri", label: "Perimenopause", welcome: "Changing cycles are the story here — this space is built to read them, not fight them." };
    if (a.vms === "yes" && a.age === "45p") return { stage: "peri", label: "Perimenopause", welcome: "Hot flashes and sleep changes front and center — with honest guidance on what's treatable." };
    return { stage: "periods", label: "My Cycle", welcome: "Your cycle space is ready — predictions, patterns, and zero judgment." };
  };
  const finishOnboarding = async () => {
    setObBusy(true);
    // Routing runs on this device only: the intake answers (pregnancy, periods, hot
    // flashes, age band) are health data and are never stored or sent; the spec's stage map
    // is deterministic. The resulting stage reaches Cyra's server only inside the opt-in
    // weekly counts (lib/pulse.js); the counts read itself sends no stage. Otherwise it
    // leaves the device only when she moves it herself: inside an encrypted backup she
    // exports, and implied by the doctor-email text she chooses to send.
    const route = rulesRoute(ob);
    setStage(route.stage); setStageName(route.label); setWelcome(route.welcome);
    setDraft({}); setAppTab("home"); setPregTab("home"); setObBusy(false);
  };

  /* ---------- on-device persistence ---------- */
  const setters = { palIdx: setPalIdx, relationship: setRelationship, connLog: setConnLog, cadence: setCadence, quietHours: setQuietHours, quickMode: setQuickMode, meds: setMeds, medLog: setMedLog, appts: setAppts, journal: setJournal, wearSources: setWearSources, wearData: setWearData, acct: setAcct, research: setResearch, stage: setStage, stageName: setStageName, welcome: setWelcome, days: setDays, pregLog: setPregLog, pulseQueue: setPulseQueue, pulseSent: setPulseSent, pulseLastSend: setPulseLastSend, pulseRev: setPulseRev, askAI: setAskAI, regAnswers: setRegAnswers, terraOff: (v) => setTerraOff(cleanTerraOff(v)), reminders: (v) => { const rev = Number.isFinite(v?.rev) ? v.rev : 0; adoptedRemRev.current = rev; setReminders({ enabled: !!v?.enabled, status: "off", endpoint: typeof v?.endpoint === "string" ? v.endpoint : null, pending: cleanPending(v?.pending), rev }); } };
  const values = { palIdx, relationship, connLog, cadence, quietHours, quickMode, meds, medLog, appts, journal, wearSources, wearData, acct, research, stage, stageName, welcome, days, pregLog, pulseQueue, pulseSent, pulseLastSend, pulseRev, askAI, regAnswers, reminders, terraOff };
  const stored = (k) => (k === "reminders" ? { enabled: !!reminders.enabled, endpoint: reminders.endpoint || null, pending: cleanPending(reminders.pending), rev: reminders.rev || 0 } : values[k]);
  const snapshot = () => ({ v: 1, savedAt: new Date().toISOString(), phase: "app", ...Object.fromEntries(PERSISTED.map((k) => [k, stored(k)])) });
  // A saved record always opens the app — also one saved while she was choosing a stage
  // again (stage null: the intake shows, with Settings and Delete everything one tap away).
  const applySaved = (saved, { skip = [] } = {}) => {
    for (const k of PERSISTED) if (!skip.includes(k) && k in saved && saved[k] !== undefined) setters[k](saved[k]);
    setPhase("app"); setAppTab("home"); setPregTab("home");
  };
  // A record that exists but can't be read (phone only) keeps hydrated false, so nothing
  // is saved over it; RecordUnavailableScreen offers Try again.
  const hydrate = () => storage.load().then(
    (saved) => { try { if (saved && saved.v === 1 && saved.phase === "app") applySaved(saved); } finally { setRecordUnavailable(false); setHydrated(true); } },
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
    saveTimer.current = setTimeout(async () => {
      if (wipingRef.current) return;
      let out = snap;
      if (!isNative()) { // a browser can have several tabs: a newer sharing state stored by another one wins
        const latest = await storage.load().catch(() => null);
        if (wipingRef.current) return;
        out = mergePulse(snap, latest);
        if (out !== snap) adoptPulse(out);
        const rem = mergeReminders(out.reminders, latest?.reminders);
        if (rem !== out.reminders) { out = { ...out, reminders: rem }; adoptReminders(rem); }
      }
      storage.save(out).then(() => setStorageDriver(storage.driver()), () => { setStorageDriver(storage.driver()); ping("Couldn't save to this device — storage may be full or blocked"); });
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [hydrated, phase, ...PERSISTED.map((k) => values[k])]); // eslint-disable-line

  /* Weekly counts: send a due queue — at most one tally a day from this browser (or this
     phone app install), never on the day of the check-in. Inside a Web Lock shared by every
     tab of this browser, the stored record is read again, and "sent" (with today as the
     send day, plus the week-only hold) is written BEFORE the request, so neither a reload
     nor a second tab can send it again. Nothing is sent if, at that moment, the stored
     switch says sharing is off or Delete everything has started. A queue whose stage isn't
     the record's stage is dropped. A browser without Web Locks sends nothing (there would be
     no way to keep it to one a day across tabs); the phone app has a single web view. */
  const flushPulse = async () => {
    if (!API_BASE) return;
    const locks = typeof navigator !== "undefined" ? navigator.locks : null;
    if (!locks?.request && !isNative()) return;
    const run = async () => {
      if (wipingRef.current || !researchRef.current) return;
      const cur = await storage.load().catch(() => null);
      const today = localDay();
      if (!cur || cur.v !== 1 || !cur.research || !queueDue(cur.pulseQueue) || cur.pulseLastSend === today) return;
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
    const onVisible = () => { if (document.visibilityState === "visible") { drainTerraNow(); retryPushForget(); retryTerraOff(); } };
    document.addEventListener("visibilitychange", onVisible);
    const sub = isNative() ? CapApp.addListener("appStateChange", (st) => { if (st?.isActive) { drainTerraNow(); retryTerraOff(); } }) : null;
    return () => { document.removeEventListener("visibilitychange", onVisible); sub?.then((h) => h.remove()).catch(() => {}); };
  }, []); // eslint-disable-line

  /* Phone: a backup copy an interrupted share left in the app's cache (app closed or killed
     while the share sheet was open). Run at every launch, before and whether or not the
     record loads (no share can be under way in a freshly started app), and by Delete
     everything and Start over once they reach this device's clean-up. */
  const sweepBackupCache = async () => {
    const { files = [] } = await Filesystem.readdir({ path: "", directory: Directory.Cache });
    for (const f of files) { const n = typeof f === "string" ? f : f?.name; if (/^cyra-backup-.*\.cyra\.json$/.test(n || "")) await Filesystem.deleteFile({ path: n, directory: Directory.Cache }).catch(() => {}); }
  };
  const exportBackup = async (passphrase) => {
    // The backup carries the record, minus what belongs to this device only: the ZIP and the
    // age band (neither is used after registration; their screen says they "stay on this
    // device") and this browser's push addresses.
    const snap = snapshot();
    if (snap.regAnswers && typeof snap.regAnswers === "object") { const ra = { ...snap.regAnswers }; delete ra.zip; delete ra.age; snap.regAnswers = ra; }
    snap.reminders = { enabled: !!snap.reminders?.enabled };
    const env = await encryptBackup(snap, passphrase);
    const name = `cyra-backup-${todayIso}.cyra.json`;
    if (isNative()) {
      // Phone: the already-encrypted file goes to the app's cache while the share sheet
      // (Save to Files, Drive, AirDrop…) is in use and is deleted as soon as Cyra hears back
      // from it (on iPhone when the sheet or the chosen action closes; on Android when she
      // returns to Cyra from the app she chose). A copy left behind by an interrupted share
      // (app closed or killed mid-share) is deleted at the next launch (sweepBackupCache) or
      // by Delete everything. Where it goes is her choice; its contents are unreadable
      // without the passphrase (the file name shows only the date it was made).
      let uri;
      try { ({ uri } = await Filesystem.writeFile({ path: name, data: JSON.stringify(env), directory: Directory.Cache, encoding: Encoding.UTF8 })); }
      catch { throw new Error("Couldn't prepare the backup file on this phone"); }
      try { await Share.share({ title: "Cyra encrypted backup", files: [uri] }); }
      catch (e) {
        const m = String(e?.message || e);
        if (/cancel/i.test(m)) return false;
        if (/must provide|in progress/i.test(m)) throw new Error("Couldn't open the share sheet on this phone");
        throw new Error("Sharing didn't finish — the backup may not have reached where you sent it. Anything that did is still encrypted.");
      }
      finally { await Filesystem.deleteFile({ path: name, directory: Directory.Cache }).catch(() => { /* already gone */ }); }
      return true;
    }
    const blob = new Blob([JSON.stringify(env)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return true;
  };
  // Restoring brings back the record and settings, but never the per-device consents
  // (weekly counts, Cyra's AI, and in a browser the reminders, which would register this
  // browser with Cyra's server): those stay as they are on this device. A wearable
  // connection in the backup comes back on this device; one this device has that the backup
  // doesn't is kept (the restore form says so).
  const importBackup = async (file, passphrase) => {
    let env; try { env = JSON.parse(await file.text()); } catch { throw new Error("That file isn't a Cyra backup"); }
    const saved = await decryptBackup(env, passphrase);
    if (!saved || saved.v !== 1 || !saved.stage) throw new Error("That backup is empty or from a different version");
    const wear = { ...wearSources, ...(saved.wearSources && typeof saved.wearSources === "object" ? saved.wearSources : {}) };
    applySaved({ ...saved, wearSources: wear }, { skip: [...DEVICE_ONLY, "reminders"] }); setShowSettings(false);
    const restoreRem = isNative() ? !!saved.reminders?.enabled : !!reminders.enabled; // phone: scheduled on the phone, no server
    const rem = { enabled: restoreRem, endpoint: reminders.endpoint || null, pending: cleanPending(reminders.pending), rev: reminders.rev || 0 };
    setRem((x) => ({ ...x, enabled: restoreRem })); // this browser's own push addresses stay as they are
    const keep = { research, pulseQueue, pulseSent, pulseLastSend, pulseRev, askAI, terraOff: cleanTerraOff(terraOff) };
    await storage.save({ ...Object.fromEntries(PERSISTED.filter((k) => k in saved).map((k) => [k, saved[k]])), wearSources: wear, ...keep, reminders: rem, v: 1, savedAt: new Date().toISOString(), phase: "app" });
    applyReminders(restoreRem, saved.cadence || cadence, saved.quietHours || quietHours, { prompt: isNative() });
    ping(!isNative() && saved.reminders?.enabled && !reminders.enabled ? "Backup restored. Reminders stay off in this browser — turn them on in Settings if you want them here." : "Backup restored");
  };

  /* ---------- Delete everything / Start over ----------
     Delete everything — first, Cyra's server: (d) Oura, if connected: the token is revoked;
     (a) web reminders: the server forgets every push address this browser holds or held;
     (c) Terra, if connected (and every earlier Terra disconnect not yet confirmed), last
     because it empties the server's mailbox: readings waiting there are collected into the
     record first, then the server ends the connection and drops the mailbox. If any of these can't be confirmed (offline, server down, Terra/Oura
     didn't confirm, or this device holds nothing that could end it), the record on this
     device is not deleted: the error names what failed (and why) and what did end — a
     connection the server already ended is removed from this device, and if reminders were
     forgotten on the server they are turned off here too — and Settings offers Try again or
     "Delete on this device anyway", which says what stays connected and where to remove it.
     Then this device, best effort and in order: (a) reminders: phone — every pending
     notification; web — the browser's push subscription; (b) web: every service worker;
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
      if (e.data?.type !== "wipe") return;
      if (e.data.phase === "cancel") { wipingRef.current = false; return; }
      wipingRef.current = true; clearTimeout(saveTimer.current);
      if (e.data.phase === "done") window.location.replace(window.location.pathname);
    };
    return () => { ch.close(); channel.current = null; };
  }, []); // eslint-disable-line
  const tellOtherTabs = (phase) => { try { channel.current?.postMessage({ type: "wipe", phase }); } catch { /* single tab */ } };
  const cleanUpHere = async () => {
    const step = async (fn) => { try { await fn(); } catch { /* best effort: the next step still runs */ } };
    await step(() => syncReminders({ cadence: "me", nudge: "never" }, { server: false }));
    if (!isNative() && "serviceWorker" in navigator) await step(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); });
    if (isNative()) await step(sweepBackupCache);
  };
  const wipe = async (sources = {}, { force = false, pushKnown = [], holdWeek: startOver = false } = {}) => {
    wipingRef.current = true; clearTimeout(saveTimer.current);
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
      if (sources.oura && !sources.oura.demo) await serverStep("oura", () => disconnectSource("oura", sources.oura, { timeoutMs: 8000 }));
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
      const terraItems = [...(sources.terra && !sources.terra.demo ? [{ st: sources.terra, live: true }] : []), ...cleanTerraOff(terraOffRef.current).map((st) => ({ st }))];
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
    clearTimeout(saveTimer.current);
    try {
      const latest = isNative() ? null : await storage.load().catch(() => null);
      const base = latest && latest.v === 1 ? latest : snapshot();
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
      else if (r.error) { keep({ enabled: true, status: "error" }); if (prompt) ping("Cyra's server couldn't set up reminders — try again later"); }
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
     attempt's one-time verifier. A build without a server makes no request at all. */
  const PROVIDER_LABEL = { apple: "Apple", google: "Google", facebook: "Facebook" };
  const signInRetry = "Sign-in didn't complete — try again or fill in the form; anything the provider sent is erased from Cyra's server within 5 minutes.";
  const startSocial = async (id, label) => {
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
    finishSocial(m[1] ? { error: true } : { code: decodeURIComponent(m[2]) });
  }, []);

  const finishReg = async () => {
    const map = {
      "My Cycle": ["periods", "My Cycle"],
      "Trying to conceive": ["periods", "Trying to Conceive"],
      "Pregnant": ["preg", "Pregnancy"],
      "Perimenopause": ["peri", "Perimenopause"],
      "Menopause & beyond": ["peri", "Menopause"],
    };
    const [sid, slabel] = map[reg.stage] || ["peri", "Perimenopause"];
    // Anonymous Mode keeps no name and no email anywhere, not even on this device.
    const anon = !!reg.anon;
    const name = anon ? "" : reg.name.trim();
    setAcct(anon ? { name: "", email: "", anon: true } : { name, email: reg.email.trim(), anon: false });
    setResearch(!!reg.research);
    const answers = { ...reg };
    if (anon) { delete answers.name; delete answers.email; }
    setRegAnswers(answers);
    // Reminders only when she ticked "Remind me"; unticked also cancels anything left over.
    applyReminders(!!reg.notifOptin);
    setStage(sid);
    setStageName(slabel);
    setDraft({});
    setAppTab("home"); setPregTab("home");
    // The welcome is written here, on the device. Registration answers stay on this device,
    // except what she opts into on the last step: with "Remind me" in a web browser, her
    // reminder days, time and time zone go to Cyra's server for web push; with weekly counts
    // on, her life-stage group goes out with yes/no check-in flags (at most one send a day,
    // each flag at most once a week, never on the day it was logged). They are also in any
    // encrypted backup she exports (the ZIP and the age band are left out of it), and her
    // first name is in the doctor-email subject when she uses Open in email or Copy email
    // (Report).
    setWelcome(`Welcome${name ? `, ${name}` : ""} — your ${slabel} space is ready.`);
    setPhase("app");
  };

  /* ---------- shared check-in pieces (one instance, rendered by whichever Today is active) ---------- */
  const scoreMeter = <ScoreMeter liveScore={liveScore} scoreLabel={scoreLabel} scoreColor={scoreColor} />;
  const scaleSection = <ScaleSection scales={scales} setScales={setScales} />;
  const bodySection = <BodySignals stage={stage} showBody={showBody} setShowBody={setShowBody} flow={flow} setFlow={setFlow} disch={disch} setDisch={setDisch} odor={odor} setOdor={setOdor} bodyOdor={bodyOdor} setBodyOdor={setBodyOdor} />;
  const quickCheckin = <QuickCheckin stage={stage} draft={draft} setDraft={setDraft} setQuickMode={setQuickMode} />;

  if (!hydrated) {
    // Start over runs the same clean-up as Delete everything, minus the wearable disconnects:
    // the record that names them can't be read (the screen says so). It always leaves this
    // week's hold, since that record may say counts already went this week. A phone has no
    // server-side reminder row, so nothing on the server can block it.
    if (recordUnavailable) return <Shell style={style}><RecordUnavailableScreen platform={platform()} locked={recordLocked} onRetry={hydrate} onStartOver={() => wipe({}, { holdWeek: true })} /></Shell>;
    return <Shell style={style}><main aria-busy="true" /></Shell>;
  }

  if (phase === "splash") {
    return (
      <Shell style={style} toast={toast}>
        <SplashScreen onStart={() => setPhase("register")} onImport={importBackup} />
      </Shell>
    );
  }

  if (phase === "register") {
    return (
      <Shell style={style} toast={toast}>
        <RegisterScreen reg={reg} setReg={setReg} regStep={regStep} setRegStep={setRegStep} regTouched={regTouched} setRegTouched={setRegTouched} cadence={cadence} setCadence={setCadence} socialBusy={socialBusy} startSocial={startSocial} finishReg={finishReg} />
      </Shell>
    );
  }
  const keepsWeekNote = pulseSent?.week === weekKey() || holdWeek === weekKey();
  const settingsSheet = showSettings && <SettingsSheet cadence={cadence} setCadence={setCadence} quietHours={quietHours} setQuietHours={setQuietHours} quickMode={quickMode} setQuickMode={setQuickMode} setShowSettings={setShowSettings} ping={ping} storageDriver={storageDriver} onExport={exportBackup} onImport={importBackup} onWipe={wipeDevice} keepsWeekNote={keepsWeekNote} reminders={reminders} reminderSupport={reminderSupport()} onReminders={(on) => applyReminders(on)} research={research} setResearch={setSharing} stage={stage} />;
  if (!stage) {
    // Choosing a stage again: the saved record is still here, so Settings (and Delete
    // everything) stays one tap away.
    return (
      <Shell style={style} toast={toast}>
        <header className="mast" style={{ justifyContent: "flex-end", marginBottom: 0 }}>
          <button className="stagechip" onClick={() => setShowSettings((v) => !v)} aria-label="Settings and your data" aria-expanded={showSettings}>⚙</button>
        </header>
        {settingsSheet}
        <IntakeScreen org={org} acct={acct} ob={ob} setOb={setOb} obBusy={obBusy} setObBusy={setObBusy} setStage={setStage} setStageName={setStageName} setWelcome={setWelcome} setAppTab={setAppTab} setPregTab={setPregTab} finishOnboarding={finishOnboarding} />
      </Shell>
    );
  }

  const homeView = (
    <HomeScreen
      acct={acct} stage={stage} stageName={stageName} pregWeek={pregWeek} pred={pred} loggedLast14={loggedLast14} streakLine={streakLine} goTab={goTab} entryOn={entryOn} todayIso={todayIso} homeInsight={homeInsight} wearInsights={wearInsights} milestones={milestones} nextUp={nextUp} pulse={pulse}
      recap={recap} showRecap={showRecap} setShowRecap={setShowRecap}
      showWear={showWear} setShowWear={setShowWear} wearSources={wearSources} terraOffCount={terraOff.length} connectWear={connectWear} disconnectWear={disconnectWear} wearConfirm={wearConfirm} setWearConfirm={setWearConfirm} wearBusy={wearBusy} wearData={wearData} wAvg={wAvg}
      showMeds={showMeds} setShowMeds={setShowMeds} meds={meds} medLog={medLog} medEffects={medEffects} setMedLog={setMedLog} newMed={newMed} setNewMed={setNewMed} setMeds={setMeds} ping={ping}
      showAppts={showAppts} setShowAppts={setShowAppts} upcoming={upcoming} past={past} daysUntil={daysUntil} setAppts={setAppts} newAppt={newAppt} setNewAppt={setNewAppt}
      showJournal={showJournal} setShowJournal={setShowJournal} journal={journal} jDraft={jDraft} setJDraft={setJDraft} setJournal={setJournal}
    />
  );
  const askView = <AskScreen org={org} stage={stage} askQ={askQ} setAskQ={setAskQ} runAsk={runAsk} askBusy={askBusy} askOut={askOut} askAI={askAI} setAskAI={setAskAI} aiAvailable={aiAvailable} />;
  const connView = <ConnectScreen relationship={relationship} setRelationship={setRelationship} conn={conn} setConn={setConn} intimacy={intimacy} setIntimacy={setIntimacy} after={after} setAfter={setAfter} setConnLog={setConnLog} todayIso={todayIso} ping={ping} />;

  return (
    <Shell style={style} toast={toast}>
      <header className="mast">
        <span className="mark">{org.name}<span className="sub">{org.tag}</span></span>
        {stage && <span className="acctchip">{acct.anon ? "Anonymous" : acct.name || "You"}{research && hasServer() ? " · sharing counts ✓" : ""}</span>}
        {stage && orgId === "cyra" && <button className="stagechip" onClick={() => setShowPal((s) => !s)} aria-label="Color palette" aria-expanded={showPal}>🎨</button>}
        {stage && <button className="stagechip" onClick={() => setShowSettings((s) => !s)} aria-label="Check-in settings" aria-expanded={showSettings}>⚙</button>}
        {stage && <button className="stagechip" onClick={() => { setStage(null); setOb({ step: 0, preg: null, age: null, per: null, vms: null }); setWelcome(""); }}>{stageName} · change</button>}
      </header>

      {/* ============ APP ============ */}
      {settingsSheet}
      {showPal && stage && orgId === "cyra" && <PaletteSheet stage={stage} stageName={stageName} palIdx={palIdx} setPalIdx={setPalIdx} setShowPal={setShowPal} />}
      <div>

        {/* ---------- PREGNANCY: its own component ---------- */}
        {stage === "preg" ? (
          <>
            <nav aria-label="Sections">
              <div className="tabs" role="tablist">
                {[["home", "Home"], ["today", "Today"], ["cal", "Calendar"], ["mile", "Milestones"], ["connect", "Connect"], ["ask", "Ask"]].map(([id, l]) => (
                  <button key={id} role="tab" aria-selected={pregTab === id} className={`tab ${pregTab === id ? "tab-on" : ""}`} onClick={() => setPregTab(id)}>{l}</button>
                ))}
              </div>
            </nav>

            {pregTab === "today" && (
              <PregTodayScreen pregWeek={pregWeek} trimester={trimester} scoreMeter={scoreMeter} draft={draft} setDraft={setDraft} symMap={symMap} scaleSection={scaleSection} bodySection={bodySection} kicks={kicks} setKicks={setKicks} setPregLog={setPregLog} todayIso={todayIso} scales={scales} ping={ping} research={research} contribute={(entry) => contribute([...eventsForDay("preg", entry), ...(entry.kicks > 0 ? ["kicks"] : [])])} />
            )}
            {pregTab === "cal" && (
              <PregCalendarScreen pregWeek={pregWeek} pregLog={pregLog} dayScore={dayScore} scoreColor={scoreColor} todayIso={todayIso} pregSel={pregSel} setPregSel={setPregSel} setDraft={setDraft} setKicks={setKicks} setPregTab={setPregTab} ping={ping} />
            )}
            {pregTab === "mile" && <MilestonesScreen pregWeek={pregWeek} />}
            {pregTab === "ask" && askView}
            {pregTab === "connect" && connView}
            {pregTab === "home" && homeView}
          </>
        ) : (
          <>
            <nav aria-label="Sections">
              <div className="tabs" role="tablist">
                {[["home", "Home"], ["today", "Today"], ["cal", "Calendar"], ["patterns", "Patterns"], ["connect", "Connect"], ["report", "Report"], ["shelf", "Care"], ["ask", "Ask"]].map(([id, l]) => (
                  <button key={id} role="tab" aria-selected={appTab === id} className={`tab ${appTab === id ? "tab-on" : ""}`} onClick={() => setAppTab(id)}>{l}</button>
                ))}
              </div>
            </nav>

            {appTab === "today" && (
              <TodayScreen pred={pred} stage={stage} welcome={welcome} editDate={editDate} setEditDate={setEditDate} setDraft={setDraft} setSleepQ={setSleepQ} scoreMeter={scoreMeter} quickMode={quickMode} quickCheckin={quickCheckin} symIds={symIds} symMap={symMap} draft={draft} sleepQ={sleepQ} scaleSection={scaleSection} bodySection={bodySection} todayIso={todayIso} editPeriod={editPeriod} scales={scales} flow={flow} disch={disch} odor={odor} setDays={setDays} ping={ping} setAppTab={setAppTab} research={research} contribute={(entry, dateIso) => contribute(eventsForDay(stage, { ...entry, phase: pred?.phase, late: pred?.late }), dateIso)} />
            )}
            {appTab === "cal" && (
              <CalendarScreen pred={pred} predWaits={predWaits} days={days} symIds={symIds} symMap={symMap} dayScore={dayScore} scoreColor={scoreColor} scoreLabel={scoreLabel} todayIso={todayIso} selDay={selDay} setSelDay={setSelDay} setDraft={setDraft} setSleepQ={setSleepQ} setEditPeriod={setEditPeriod} setEditDate={setEditDate} setAppTab={setAppTab} ins={ins} />
            )}
            {appTab === "patterns" && <PatternsScreen ins={ins} symIds={symIds} ramp={ramp} scoreColor={scoreColor} stage={stage} medEffects={medEffects} />}
            {appTab === "report" && <ReportScreen ins={ins} stage={stage} stageName={stageName} buildEmail={buildEmail} ping={ping} showTable={showTable} setShowTable={setShowTable} />}
            {appTab === "shelf" && <CareScreen shelfItems={shelfItems} />}
            {appTab === "ask" && askView}
            {appTab === "connect" && connView}
            {appTab === "home" && homeView}
          </>
        )}
      </div>

    </Shell>
  );
}
