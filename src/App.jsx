import { useMemo, useState } from "react";

/* ================================================================
   CYRA HEALTH — FULL SYSTEM LIVE DEMO v3
   Life stages: My Cycle (young) · Pregnancy (own component) · Peri/Meno
   New: advice-with-actions on every insight · "Send to my doctor"
   (FHIR push) · Affiliates hub · plus wearables, live agent,
   business engine, white-label org switcher, enterprise console.

   This file owns ALL state and derived data (useState / useMemo only).
   Screens live in ./screens, one file per screen; shared pieces in
   ./components; constants and pure engine functions in ./lib.
   ================================================================ */

import { SYM, SYMS, PSYM, GSYM, SHELF, PALETTES, ORGS, RAMPS } from "./lib/constants.js";
import { seed, seedMetrics, fmt, insights, predict, symBurden, scoreLabel, dayScore } from "./lib/engine.js";
import Shell from "./components/Shell.jsx";
import ScoreMeter from "./components/ScoreMeter.jsx";
import ScaleSection from "./components/ScaleSection.jsx";
import BodySignals from "./components/BodySignals.jsx";
import QuickCheckin from "./components/QuickCheckin.jsx";
import SettingsSheet from "./components/SettingsSheet.jsx";
import PaletteSheet from "./components/PaletteSheet.jsx";
import SplashScreen from "./screens/SplashScreen.jsx";
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
  const [wearData, setWearData] = useState([]);
  const [showWear, setShowWear] = useState(false);
  const [regStep, setRegStep] = useState(0);
  const [regTouched, setRegTouched] = useState({});
  const [reg, setReg] = useState({
    name: "", email: "", pass: "", anon: false, age: null, zip: "",
    stage: null, cycleLen: null, cycleReg: null, lastPeriod: "",
    preg: null, births: null, contra: null,
    conditions: [], familyHx: [], meds: null,
    goals: [], sleep: null, activity: null,
    emailOptin: true, notifOptin: true, research: false, terms: false,
  });
  const [acct, setAcct] = useState({ name: "", email: "", anon: false });
  const [research, setResearch] = useState(false);
  const [stage, setStage] = useState(null);
  const [stageName, setStageName] = useState("");
  const [ob, setOb] = useState({ step: 0, preg: null, age: null, per: null, vms: null });
  const [obBusy, setObBusy] = useState(false);
  const [welcome, setWelcome] = useState("");
  const [section, setSection] = useState("app");
  const [appTab, setAppTab] = useState("patterns");
  const [days, setDays] = useState(seed);
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
  const [metrics, setMetrics] = useState(() => seedMetrics("healthkit", 0));
  const [synced, setSynced] = useState({ healthkit: true, oura: false, terra: false });
  const [agentOut, setAgentOut] = useState(null);
  const [agentBusy, setAgentBusy] = useState(false);
  const [bizEvents, setBizEvents] = useState([]);
  const [bizStep, setBizStep] = useState(0);
  const [selDay, setSelDay] = useState(null);
  const [editDate, setEditDate] = useState(null);
  const [editPeriod, setEditPeriod] = useState(false);
  const [affs, setAffs] = useState([
    { id: 1, company: "Embr Labs", category: "Cooling wearable", fee: "18% commission", status: "pending" },
    { id: 2, company: "Cusp Health", category: "Telehealth (fertility)", fee: "$60/new patient", status: "approved" },
    { id: 3, company: "Luna Sleepwear", category: "Apparel", fee: "15% commission", status: "rejected" },
  ]);
  const [affForm, setAffForm] = useState({ company: "", category: "" });
  const [users, setUsers] = useState([
    { ref: "u_9f2ab", org: "cyra", role: "member", status: "active" },
    { ref: "u_bb381", org: "bloom", role: "org_admin", status: "active" },
    { ref: "u_e77a0", org: "bloom", role: "member", status: "active" },
  ]);
  const [toast, setToast] = useState("");

  const org = ORGS[orgId];
  const stagePal = stage && orgId === "cyra" ? PALETTES[stage][palIdx[stage]] : null;
  const t = { ...org.theme, ...(stagePal || {}) };
  const symMap = stage === "periods" ? PSYM : SYM;
  const activeStage = stage || "peri";
  const symIds = Object.keys(symMap);
  const shelfItems = SHELF.filter((s) => s.stages.includes(stage) && (!org.partnerIds || org.partnerIds.includes(s.id)));
  const ins = useMemo(() => insights(days, stage === "periods" ? Object.keys(PSYM) : SYMS), [days, stage]);
  const pred = useMemo(() => predict(ins), [ins]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const pregWeek = 22, trimester = 2;
  const ping = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const sync = (id, label) => {
    if (synced[id]) return ping(`${label} already synced`);
    setMetrics((m) => [...m, ...seedMetrics(id, id === "oura" ? 0 : 1)]);
    setSynced((s) => ({ ...s, [id]: true }));
    ping(`${label} synced — 42 samples normalized`);
  };
  const avg = (type) => { const v = metrics.filter((m) => m.type === type).map((m) => m.value); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };

  const runAgent = async () => {
    setAgentBusy(true); setAgentOut(null);
    const summary = {
      userRef: "u_9f2ab", org: org.slug, life_stage: stage === "preg" ? `pregnancy week ${pregWeek}` : stage,
      wearables: { avg_temp_deviation_c: +avg("temp_deviation").toFixed(2), avg_sleep_score: Math.round(avg("sleep_score")), avg_hrv: Math.round(avg("hrv")) },
      symptoms_last30: Object.fromEntries(ins.counts.map((c) => [c.label, `${c.days}/30 days`])),
      sleep_to_hotflash_multiplier: ins.hfMult ? +ins.hfMult.toFixed(1) : null,
      cycle_lengths_days: ins.lens,
      shelf_options: shelfItems.map((s) => `${s.brand}: ${s.name} (${s.ev})`),
    };
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 700,
          messages: [{ role: "user", content: `You are the insight agent inside ${org.name}, a hormonal-health app. Respond ONLY with JSON (no markdown): {"insight":"2-3 warm plain sentences connecting the data","action":"one concrete evidence-based next step the user can take","urgency":"self-care|next visit|this week","flag_for_doctor":"one thing to raise at an appointment"} Educational guidance only — options and questions to ask, never diagnosis or prescriptions. Data: ${JSON.stringify(summary)}` }],
        }),
      });
      const data = await r.json();
      const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
      setAgentOut({ provider: "claude-sonnet-4-6 (live)", ...JSON.parse(text.replace(/```json|```/g, "").trim()) });
    } catch {
      setAgentOut({
        provider: "rules fallback (offline)",
        insight: `Temperature ran ${avg("temp_deviation").toFixed(2)}°C above baseline while sleep scores averaged ${Math.round(avg("sleep_score"))} — and check-ins show the same story from the symptom side.`,
        action: "Start with sleep: CBT-I is the first-line, drug-free treatment for this pattern.",
        urgency: "self-care",
        flag_for_doctor: ins.variability ? `Cycle lengths of ${ins.lens.join(", ")} days — a ${ins.variability}-day spread.` : "Your symptom frequency table.",
      });
    }
    setAgentBusy(false);
  };

  const buildEmail = () => {
    const subject = `Symptom summary ahead of my appointment${acct.name ? ` — ${acct.name}` : ""}`;
    const lines = [
      `Hi — ahead of my appointment, a brief summary of my last 30 tracked days (logged daily in ${org.name}):`,
      ``,
      ...ins.counts.filter((c) => c.days > 0).slice(0, 4).map((c) => `• ${c.label}: ${c.days}/30 days (${c.strong} moderate-to-strong)`),
      ...(ins.lens.length >= 2 ? [``, `• Recent cycle lengths: ${ins.lens.join(", ")} days (${ins.variability}-day spread)`] : []),
      ...(stage === "peri" && ins.hfMult ? [`• Hot flashes were ${ins.hfMult.toFixed(1)}x more likely after poorly-rated nights`] : []),
      ``,
      `Happy to share the full day-by-day log at the visit. Thank you!`,
    ];
    return { subject, body: lines.join("\n") };
  };

  /* ---------- Ask Cyra: plain-language evidence Q&A ---------- */
  const runAsk = async () => {
    if (!askQ.trim()) return ping("Type a question first");
    setAskBusy(true); setAskOut(null);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 700,
          messages: [{ role: "user", content: `You are "Ask ${org.name}", a plain-language health explainer inside a women's hormonal-health app. The user's life stage: ${stageName || "unknown"}. Their question: "${askQ}". Respond ONLY with JSON (no markdown): {"answer":"120-170 words at an 8th-grade reading level, warm and honest, explaining what the evidence says","source_note":"which guideline bodies or evidence this reflects, by name (e.g. ACOG, The Menopause Society, Cochrane reviews)","ask_your_doctor":"one specific question they could bring to their clinician","urgent":true|false}. Set urgent true ONLY if the question describes red-flag symptoms needing prompt care. Educational only — no diagnosis, no dosing, no prescriptions. If asked about self-harm or crisis topics, set urgent true and point to professional support.` }],
        }),
      });
      const data = await r.json();
      const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
      setAskOut({ live: true, ...JSON.parse(text.replace(/```json|```/g, "").trim()) });
    } catch {
      setAskOut({ live: false, answer: "I couldn't reach the evidence service just now — but your question is saved. In the shipped app this answers in a few seconds, in plain language, with the guideline it came from named underneath.", source_note: null, ask_your_doctor: null, urgent: false });
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
  const scoreRough = () => ramp().rough;
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

  /* Pulse: anonymous aggregate counts. DEMO FIGURES — production reads these from the
     backend's aggregate endpoint (counts only, never identities). */
  const wk = Math.floor(Date.now() / (7 * 86400000));
  const seedN = (base, spread, salt) => base + ((wk * 9301 + salt * 49297) % spread);
  const PULSE = {
    peri: [[seedN(2100, 400, 1), "logged hot flashes"], [seedN(1650, 300, 2), "had a rough night's sleep"], [seedN(610, 120, 3), "brought a Cyra report to a doctor"]],
    periods: [[seedN(3300, 500, 4), "logged cramps"], [seedN(2400, 400, 5), "tracked a mood dip before their period"], [seedN(880, 150, 6), "asked a doctor about heavy periods"]],
    preg: [[seedN(1200, 250, 7), "logged nausea"], [seedN(940, 200, 8), "counted kicks"], [seedN(410, 90, 9), "had a glucose screen"]],
  }[stage] || [];

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

  /* ---- Wearables: Apple Watch / Oura / Terra. DEMO seeding shaped by stage;
     production ingests real HealthKit/Oura/Terra samples via the integrations hub. ---- */
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
      out.push({ date: iso, sourceId, temp: +temp.toFixed(2), rhr: Math.round(rhr), hrv: Math.round(hrv), sleep: Math.round(sleep) });
    }
    return out;
  };
  const connectWear = (id, label) => {
    if (wearSources[id]) return ping(`${label} is already connected`);
    setWearSources((s) => ({ ...s, [id]: true }));
    if (!wearData.length) setWearData(seedWear(id));
    ping(`${label} connected — 30 days imported`);
  };
  const wAvg = (k) => (wearData.length ? Math.round((wearData.reduce((a, m) => a + m[k], 0) / wearData.length) * (k === "temp" ? 100 : 1)) / (k === "temp" ? 100 : 1) : null);

  const wearInsights = (() => {
    if (!wearData.length) return [];
    const out = [];
    const sorted = [...wearData].sort((a, b) => a.date.localeCompare(b.date));
    if (stage === "periods") {
      let ovu = null, riseAt = null;
      for (let i = 1; i < sorted.length - 2; i++) {
        if (sorted[i - 1].temp < 0.12 && sorted[i].temp >= 0.2 && sorted[i + 1].temp >= 0.2 && sorted[i + 2].temp >= 0.2) { ovu = sorted[i - 1].date; riseAt = sorted[i].date; break; }
      }
      if (ovu) out.push({ num: "Ovulated", text: `A sustained temperature rise began ${fmt(riseAt)} and held — consistent with ovulation around ${fmt(ovu)}. This confirms it after the fact, the way basal-temperature charting does. It can't predict next month, and it isn't contraception.`, advice: stageName === "Trying to Conceive" ? "If you're trying to conceive, the fertile days were the ~5 before and the day of that rise — Cyra will use this to sharpen next month's estimate." : null, urgency: "self" });
      else if (pred && pred.cycleDay < pred.avgLen - 14) out.push({ num: `Day ${pred.cycleDay}`, text: `No temperature shift yet this cycle — which fits: based on your ${pred.avgLen}-day average, ovulation would be expected around day ${pred.avgLen - 14}. Cyra will flag the rise when it holds for three days.`, urgency: "self", advice: stageName === "Trying to Conceive" ? `Your estimated fertile window opens around day ${Math.max(1, pred.avgLen - 19)} — the temperature rise confirms it only afterwards, so pair it with other signs if timing matters.` : null });
      const lut = sorted.filter((s) => s.temp >= 0.2), fol = sorted.filter((s) => s.temp < 0.12);
      if (lut.length >= 4 && fol.length >= 4) {
        const av = (a, k) => Math.round(a.reduce((x, y) => x + y[k], 0) / a.length);
        out.push({ num: `${av(fol, "rhr")}→${av(lut, "rhr")}`, text: `Resting heart rate runs about ${av(lut, "rhr") - av(fol, "rhr")} bpm higher in the second half of your cycle, and HRV dips ${av(fol, "hrv") - av(lut, "hrv")} ms. That's your body's normal luteal signature — useful context for why some weeks feel heavier.` });
      }
    }
    if (stage === "peri" && !isMeno) {
      const hot = wearData.filter((m) => m.temp >= 0.3 && m.sleep < 60).length;
      const nsLogged = ins.counts.find((x) => x.id === "ns")?.days || 0;
      out.push({ num: `${hot}`, text: `${hot} of the last 30 nights showed a temperature spike with broken sleep — the wearable signature of night sweats${nsLogged ? `, and it lines up with the ${nsLogged} you logged` : ""}. Two independent signals telling the same story is exactly what a clinician wants to see.`, urgency: hot >= 8 ? "visit" : "self", advice: hot >= 8 ? "Night sweats this frequent are very treatable — bring this count to your doctor." : "Keep both the wearable and your check-ins going; agreement between them makes your record much stronger." });
    }
    if (isMeno) {
      const spikes = wearData.filter((m) => m.temp >= 0.3).length;
      out.push({ num: `${wAvg("rhr")}`, text: `Resting heart rate averaged ${wAvg("rhr")} bpm on a steady temperature baseline (${spikes} spike night${spikes === 1 ? "" : "s"} in 30). After menopause there's no cycle to track — so the useful signals shift to heart health and sleep. A rising resting heart rate over months, or a new run of night spikes, is worth noting.`, urgency: spikes >= 6 ? "visit" : "self", advice: spikes >= 6 ? "A new pattern of night-time temperature spikes after menopause is worth mentioning at your next visit." : "Post-menopause, cardiovascular risk rises — ask about a lipid panel and blood-pressure check if you haven't lately." });
    }
    if (stage === "preg") out.push({ num: `${wAvg("rhr")}`, text: `Resting heart rate averaged ${wAvg("rhr")} bpm. It normally climbs 10–20 bpm across pregnancy as blood volume rises — a gradual rise is expected; a sudden jump, or a racing heart at rest, is a tell-your-provider signal.`, urgency: "self", advice: "Sleep score averaged " + wAvg("sleep") + " — side-sleeping with pillow support has real evidence behind it in later pregnancy." });
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
    ms.push({ done: Object.keys(wearSources).length > 0, label: "Wearable connected" });
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

  const BIZ = [
    { l: "1 · Generate referral link (hash only)", line: "POST /api/referrals/link → code a47f…, no PII" },
    { l: "2 · User clicks → redirect to partner", line: "GET /r/a47f… → 302 partner site ?ref=a47f…" },
    { l: "3 · Partner webhook: patient booked", line: "HMAC ✓ · conversion · NEW PATIENT → $80 bounty", amt: 80 },
    { l: "4 · Follow-up visit (no double bounty)", line: "HMAC ✓ · visit · isNewPatient: false → $0" },
    { l: "5 · Product sale $68 → 15%", line: "HMAC ✓ · conversion · commission $10.20", amt: 10.2 },
    { l: "6 · Forged webhook → rejected", line: "HMAC ✗ → 401 · no event, no payout" },
  ];
  const bizTotal = bizEvents.reduce((a, e) => a + (e.amt || 0), 0);
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
    let route = rulesRoute(ob);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 300,
          messages: [{ role: "user", content: `Route a new user of a women's hormonal-health app to exactly one experience based on their intake. Answers: pregnant=${ob.preg}, age_band=${ob.age}, periods=${ob.per} (regular|irregular|none12|na), hot_flashes_or_night_sweats=${ob.vms}. Respond ONLY JSON: {"stage":"periods|preg|peri","label":"My Cycle|Pregnancy|Perimenopause|Menopause","welcome":"one warm sentence for this specific person"}. Pregnancy always wins. No period for 12+ months = Menopause.` }],
        }),
      });
      const data = await r.json();
      const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (["periods", "preg", "peri"].includes(parsed.stage)) route = parsed;
    } catch { /* rules route already set */ }
    setStage(route.stage); setStageName(route.label); setWelcome(route.welcome);
    setDraft({}); setAppTab("home"); setPregTab("home"); setObBusy(false);
  };

  const finishReg = async () => {
    const map = {
      "My Cycle": ["periods", "My Cycle"],
      "Trying to conceive": ["periods", "Trying to Conceive"],
      "Pregnant": ["preg", "Pregnancy"],
      "Perimenopause": ["peri", "Perimenopause"],
      "Menopause & beyond": ["peri", "Menopause"],
    };
    const [sid, slabel] = map[reg.stage] || ["peri", "Perimenopause"];
    setAcct({ name: reg.name, email: reg.email, anon: reg.anon });
    setResearch(reg.research);
    setStage(sid);
    setStageName(slabel);
    setDraft({});
    setAppTab("home"); setPregTab("home");
    setWelcome(`Welcome${reg.name ? `, ${reg.name}` : ""} — your ${slabel} space is ready.`);
    setPhase("app");
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 200,
          messages: [{ role: "user", content: `Write ONE warm, specific welcome sentence (max 22 words) for a woman joining a hormonal-health app. Her space: ${slabel}. Age: ${reg.age}. Cycles: ${reg.cycleLen || "n/a"}, ${reg.cycleReg || "n/a"}. Goals: ${reg.goals.join(", ") || "none given"}. Reply with the sentence only, no quotes.` }],
        }),
      });
      const d = await r.json();
      const txt = (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
      if (txt) setWelcome(txt);
    } catch { /* keep the rules welcome */ }
  };

  /* ---------- shared check-in pieces (one instance, rendered by whichever Today is active) ---------- */
  const scoreMeter = <ScoreMeter liveScore={liveScore} scoreLabel={scoreLabel} scoreColor={scoreColor} />;
  const scaleSection = <ScaleSection scales={scales} setScales={setScales} />;
  const bodySection = <BodySignals stage={stage} showBody={showBody} setShowBody={setShowBody} flow={flow} setFlow={setFlow} disch={disch} setDisch={setDisch} odor={odor} setOdor={setOdor} bodyOdor={bodyOdor} setBodyOdor={setBodyOdor} />;
  const quickCheckin = <QuickCheckin stage={stage} draft={draft} setDraft={setDraft} setQuickMode={setQuickMode} />;

  if (phase === "splash") {
    return (
      <Shell style={style}>
        <SplashScreen onStart={() => setPhase("register")} />
      </Shell>
    );
  }

  if (phase === "register") {
    return (
      <Shell style={style}>
        <RegisterScreen reg={reg} setReg={setReg} regStep={regStep} setRegStep={setRegStep} regTouched={regTouched} setRegTouched={setRegTouched} cadence={cadence} setCadence={setCadence} socialBusy={socialBusy} setSocialBusy={setSocialBusy} ping={ping} finishReg={finishReg} />
      </Shell>
    );
  }
  if (!stage) {
    return (
      <Shell style={style}>
        <IntakeScreen org={org} acct={acct} ob={ob} setOb={setOb} obBusy={obBusy} setObBusy={setObBusy} setStage={setStage} setStageName={setStageName} setWelcome={setWelcome} setAppTab={setAppTab} setPregTab={setPregTab} finishOnboarding={finishOnboarding} />
      </Shell>
    );
  }

  const homeView = (
    <HomeScreen
      acct={acct} stage={stage} stageName={stageName} pregWeek={pregWeek} pred={pred} loggedLast14={loggedLast14} streakLine={streakLine} goTab={goTab} entryOn={entryOn} todayIso={todayIso} homeInsight={homeInsight} wearInsights={wearInsights} milestones={milestones} nextUp={nextUp} pulse={PULSE}
      recap={recap} showRecap={showRecap} setShowRecap={setShowRecap}
      showWear={showWear} setShowWear={setShowWear} wearSources={wearSources} connectWear={connectWear} wearData={wearData} wAvg={wAvg}
      showMeds={showMeds} setShowMeds={setShowMeds} meds={meds} medLog={medLog} medEffects={medEffects} setMedLog={setMedLog} newMed={newMed} setNewMed={setNewMed} setMeds={setMeds} ping={ping}
      showAppts={showAppts} setShowAppts={setShowAppts} upcoming={upcoming} past={past} daysUntil={daysUntil} setAppts={setAppts} newAppt={newAppt} setNewAppt={setNewAppt}
      showJournal={showJournal} setShowJournal={setShowJournal} journal={journal} jDraft={jDraft} setJDraft={setJDraft} setJournal={setJournal}
    />
  );
  const askView = <AskScreen org={org} stage={stage} askQ={askQ} setAskQ={setAskQ} runAsk={runAsk} askBusy={askBusy} askOut={askOut} />;
  const connView = <ConnectScreen relationship={relationship} setRelationship={setRelationship} conn={conn} setConn={setConn} intimacy={intimacy} setIntimacy={setIntimacy} after={after} setAfter={setAfter} setConnLog={setConnLog} todayIso={todayIso} ping={ping} />;

  return (
    <Shell style={style}>
      <header className="mast">
        <span className="mark">{org.name}<span className="sub">{org.tag}</span></span>
        {stage && <span className="acctchip">{acct.anon ? "Anonymous" : acct.name || "You"}{research ? " · research ✓" : ""}</span>}
        {stage && orgId === "cyra" && <button className="stagechip" onClick={() => setShowPal((s) => !s)} aria-label="Color palette" aria-expanded={showPal}>🎨</button>}
        {stage && <button className="stagechip" onClick={() => setShowSettings((s) => !s)} aria-label="Check-in settings" aria-expanded={showSettings}>⚙</button>}
        {stage && <button className="stagechip" onClick={() => { setStage(null); setOb({ step: 0, preg: null, age: null, per: null, vms: null }); setWelcome(""); }}>{stageName} · change</button>}
      </header>

      {/* ============ APP ============ */}
      {showSettings && <SettingsSheet cadence={cadence} setCadence={setCadence} quietHours={quietHours} setQuietHours={setQuietHours} quickMode={quickMode} setQuickMode={setQuickMode} setShowSettings={setShowSettings} ping={ping} />}
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
              <PregTodayScreen pregWeek={pregWeek} trimester={trimester} scoreMeter={scoreMeter} draft={draft} setDraft={setDraft} symMap={symMap} scaleSection={scaleSection} bodySection={bodySection} kicks={kicks} setKicks={setKicks} setPregLog={setPregLog} todayIso={todayIso} scales={scales} ping={ping} />
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
              <TodayScreen pred={pred} stage={stage} welcome={welcome} editDate={editDate} setEditDate={setEditDate} setDraft={setDraft} setSleepQ={setSleepQ} scoreMeter={scoreMeter} quickMode={quickMode} quickCheckin={quickCheckin} symIds={symIds} symMap={symMap} draft={draft} sleepQ={sleepQ} scaleSection={scaleSection} bodySection={bodySection} todayIso={todayIso} editPeriod={editPeriod} scales={scales} flow={flow} disch={disch} odor={odor} setDays={setDays} ping={ping} setAppTab={setAppTab} />
            )}
            {appTab === "cal" && pred && (
              <CalendarScreen pred={pred} days={days} symIds={symIds} symMap={symMap} dayScore={dayScore} scoreColor={scoreColor} scoreLabel={scoreLabel} todayIso={todayIso} selDay={selDay} setSelDay={setSelDay} setDraft={setDraft} setSleepQ={setSleepQ} setEditPeriod={setEditPeriod} setEditDate={setEditDate} setAppTab={setAppTab} ins={ins} />
            )}
            {appTab === "patterns" && <PatternsScreen ins={ins} symIds={symIds} ramp={ramp} scoreColor={scoreColor} stage={stage} medEffects={medEffects} />}
            {appTab === "report" && <ReportScreen ins={ins} stage={stage} stageName={stageName} buildEmail={buildEmail} ping={ping} showTable={showTable} setShowTable={setShowTable} />}
            {appTab === "shelf" && <CareScreen shelfItems={shelfItems} ins={ins} ping={ping} />}
            {appTab === "ask" && askView}
            {appTab === "connect" && connView}
            {appTab === "home" && homeView}
          </>
        )}
      </div>

      <div className="toast" role="status" aria-live="polite" style={toast ? {} : { display: "none" }}>{toast}</div>
    </Shell>
  );
}
