import { useMemo, useState } from "react";

/* ================================================================
   CYRA HEALTH — FULL SYSTEM LIVE DEMO v3
   Life stages: My Cycle (young) · Pregnancy (own component) · Peri/Meno
   New: advice-with-actions on every insight · "Send to my doctor"
   (FHIR push) · Affiliates hub · plus wearables, live agent,
   business engine, white-label org switcher, enterprise console.
   ================================================================ */

const SYM = { hf: "Hot flashes", ns: "Night sweats", fog: "Brain fog", mood: "Mood swings", slp: "Sleep disruption", ach: "Joint aches", dry: "Vaginal dryness", pal: "Heart flutters", hda: "Headaches", lib: "Libido change", anx: "Anxiety", itc: "Skin/itching" };
const SYMS = Object.keys(SYM);
const PSYM = { crm: "Cramps", hda: "Headaches", blo: "Bloating", mood: "Mood swings", ten: "Breast tenderness", acn: "Skin breakouts", bak: "Back pain", nau: "Nausea", cra: "Cravings", lib: "Libido change" };
const GSYM = { nau: "Nausea", hb: "Heartburn", swl: "Swelling", bak: "Back pain", crp: "Cramping", dzy: "Dizziness", brx: "Braxton-Hicks", con: "Constipation" };

/* Scales & body signals logged separately from yes/no symptoms */
/* Connection & intimacy — built on the dyadic/desire literature:
   relationship context predicts desire far more than hormone levels (SWAN),
   nurturant vs sexual contact move hormones differently (Steroid/Peptide
   theory), and the field's own gap is same-sex dyads — so nothing here
   assumes a partner's gender or a single partner. */
const CONNECT = {
  closeness: { label: "Closeness today", low: "Distant", high: "Very close" },
  desire:    { label: "Desire", low: "None", high: "Strong" },
  friction:  { label: "Tension or conflict", low: "None", high: "A lot" },
  load:      { label: "Fairness of the mental load", low: "Mostly on me", high: "Shared" },
};
const INTIMACY = [["none", "None"], ["affection", "Affection"], ["sexual", "Sexual"], ["both", "Both"]];
const AFTER = [["better", "Felt better after"], ["same", "About the same"], ["worse", "Felt worse"], ["pain", "Pain or dryness"]];
const RELATIONSHIP = [["partnered", "Partnered"], ["multi", "More than one partner"], ["single", "Single / solo"], ["na", "Prefer not to say"]];

/* Check-in cadence — the user sets the tempo; the app never nags. */
const CADENCE = [
  { id: "daily", label: "Daily", desc: "30-second check-in, once a day" },
  { id: "weekdays", label: "Weekdays", desc: "Skip weekends" },
  { id: "3x", label: "3× a week", desc: "Mon · Wed · Fri" },
  { id: "weekly", label: "Weekly", desc: "One reflective check-in" },
  { id: "me", label: "When I feel like it", desc: "No reminders at all" },
];
const QUICK_Q = {
  periods: ["Any cramps or bloating?", "How's your energy?", "Mood today?"],
  peri: ["Any hot flashes or night sweats?", "How did you sleep?", "How's your focus?"],
  preg: ["Any nausea or heartburn?", "Swelling anywhere?", "Energy today?"],
};

const SCALES = [
  { id: "fatigue", label: "Fatigue", low: "Energized", high: "Wiped out" },
  { id: "pain", label: "Pain", low: "None", high: "Severe" },
  { id: "moodq", label: "Mood", low: "Low", high: "Great" },
  { id: "stress", label: "Stress", low: "Calm", high: "Maxed" },
];
const FLOW = [["spot", "Spotting"], ["light", "Light"], ["med", "Medium"], ["heavy", "Heavy"], ["flood", "Flooding"]];
const DISCHARGE = [["none", "None"], ["creamy", "Creamy"], ["eggwhite", "Egg-white"], ["sticky", "Sticky"], ["watery", "Watery"], ["unusual", "Unusual"]];
const ODOR = [["none", "Nothing unusual"], ["mild", "Mild change"], ["strong", "Strong"], ["fishy", "Fishy"], ["yeasty", "Yeasty / sour"]];
const BODYODOR = [["same", "Same as usual"], ["stronger", "Stronger"], ["changed", "Different"]];

const STAGES = [
  { id: "periods", label: "My Cycle", who: "periods & PMS" },
  { id: "preg", label: "Pregnancy", who: "week by week" },
  { id: "peri", label: "Peri · Meno", who: "the transition" },
];

const SHELF = [
  { id: "midi", brand: "Midi Health", name: "Menopause-trained clinician (insurance accepted)", price: "Covered by many plans", ev: "Clinical care", tone: "strong", m: ["hf", "ns", "fog", "slp"], stages: ["peri"] },
  { id: "restfully", brand: "Restfully", name: "6-week CBT-I sleep program", price: "$49", ev: "Strong evidence", tone: "strong", m: ["slp"], stages: ["peri", "periods"] },
  { id: "emberline", brand: "Emberline", name: "Wearable heat wrap for cramps", price: "$42", ev: "Comfort with evidence", tone: "strong", m: ["crm"], stages: ["periods"] },
  { id: "mineral", brand: "Mineral & Co.", name: "Magnesium glycinate, 90 nights", price: "$24", ev: "Mixed evidence", tone: "mixed", m: ["slp", "mood", "crm"], stages: ["peri", "periods"] },
  { id: "verdana", brand: "Verdana", name: "Prenatal essentials + folate", price: "$28", ev: "Strong evidence", tone: "strong", m: ["fat"], stages: ["preg"] },
  { id: "nightfall", brand: "Nightfall", name: "Cooling sleep set", price: "$68", ev: "Comfort, not a treatment", tone: "comfort", m: ["ns", "hf"], stages: ["peri"] },
];

/* Stage palettes — the app's mood shifts with life stage.
   peri/meno: cool, calming, trust-building (teal + sage + lavender)
   pregnancy: soft pink + teal with warm neutrals
   cycle:     fresh dusty blue + soft coral, young without being girly */
const PALETTES = {
  peri: [
    { id: "teal", name: "Teal & Lavender", note: "Clinical calm", primary: "#2C6A61", accent: "#5A6A9E", paper: "#E4EBE7", card: "#FFFFFF", ink: "#17241F", soft: "#4E625B", line: "#6E8A7F" },
    { id: "dusk", name: "Dusty Blue & Sage", note: "Steady, grounded", primary: "#3A5F80", accent: "#607C69", paper: "#E5EAEF", card: "#FFFFFF", ink: "#16212B", soft: "#4D5F6E", line: "#73889F" },
    { id: "lav", name: "Lavender & Moss", note: "Soft, restorative", primary: "#5B4E85", accent: "#6A7B5C", paper: "#EAE6F0", card: "#FFFFFF", ink: "#1E1A2A", soft: "#5A5270", line: "#897EA8" },
  ],
  preg: [
    { id: "rose", name: "Teal & Dusty Rose", note: "Warm & reassuring", primary: "#2F736E", accent: "#B8505E", paper: "#EFE2E1", card: "#FFFFFF", ink: "#241A1D", soft: "#6B585B", line: "#9A7B79" },
    { id: "sage", name: "Sage & Warm Sand", note: "Earthy, gentle", primary: "#4F7355", accent: "#A06836", paper: "#EDE7DD", card: "#FFFFFF", ink: "#1F2620", soft: "#5C6459", line: "#908373" },
    { id: "coral", name: "Muted Blue & Coral", note: "Fresh, modern", primary: "#37627E", accent: "#CA4B2A", paper: "#E6EBEF", card: "#FFFFFF", ink: "#152029", soft: "#4F6070", line: "#73889F" },
  ],
  periods: [
    { id: "blue", name: "Dusty Blue & Coral", note: "Fresh, youthful", primary: "#33567D", accent: "#B9513C", paper: "#E3E9F0", card: "#FFFFFF", ink: "#141E29", soft: "#4E6070", line: "#70859D" },
    { id: "plum", name: "Plum & Peach", note: "Soft, expressive", primary: "#6B3F63", accent: "#BF5729", paper: "#EFE5EC", card: "#FFFFFF", ink: "#231825", soft: "#5F4E5C", line: "#967E91" },
    { id: "mint", name: "Deep Mint & Clay", note: "Clean, calm", primary: "#2F6B5C", accent: "#B65B42", paper: "#E3EDE8", card: "#FFFFFF", ink: "#15241E", soft: "#4C6259", line: "#698C7D" },
  ],
};

const ORGS = {
  cyra: { slug: "cyra", name: "Cyra", tag: "Health", theme: { primary: "#7A2F4E", paper: "#EDE4DC", card: "#FFFFFF", accent: "#AB6229", ink: "#241A28", soft: "#5B4E63", line: "#927F6F" }, partnerIds: null, plan: "Consumer (D2C)" },
  bloom: { slug: "bloom", name: "Bloom", tag: "by AcmeCare", theme: { primary: "#2F5D50", paper: "#F2F5F1", card: "#FBFDFA", accent: "#C89A5B", ink: "#26332E", soft: "#5F6E67", line: "#DCE3DD" }, partnerIds: ["midi", "restfully"], plan: "Employer benefit (500 seats)" },
};

/* ---------- seeded data ---------- */
function seed() {
  let s = 42;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296), s / 4294967296);
  const days = []; let prevPoor = false, since = 12, len = 27, pl = 0;
  for (let i = 75; i >= 1; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if (since >= len) { pl = 4; since = 0; len = 23 + Math.floor(rnd() * 15); }
    const period = pl > 0; if (pl > 0) pl--; since++;
    const poor = rnd() < 0.32;
    const sleepQ = poor ? "poor" : rnd() < 0.4 ? "fair" : "good";
    const sev = (b) => { const r = rnd(), p = prevPoor ? b + 0.26 : b; return r < p * 0.45 ? 3 : r < p ? 2 : r < p + 0.2 ? 1 : 0; };
    days.push({ date: d.toISOString().slice(0, 10), sleepQ, period, sym: { hf: sev(0.42), ns: prevPoor ? sev(0.4) : sev(0.22), fog: sev(prevPoor ? 0.5 : 0.3), mood: sev(0.3), slp: sleepQ === "poor" ? 2 + (rnd() < 0.4 ? 1 : 0) : sleepQ === "fair" ? (rnd() < 0.5 ? 1 : 0) : 0, ach: sev(0.24), crm: period ? sev(0.8) : sev(0.1), hda: sev(0.25), blo: sev(0.3), eng: sev(0.3) } });
    prevPoor = poor;
  }
  return days;
}
function seedMetrics(sourceId, offset) {
  const out = [];
  for (let i = 14; i >= 1; i--) {
    const d = new Date(); d.setDate(d.getDate() - i - offset);
    const date = d.toISOString().slice(0, 10); const wave = Math.sin(i / 2.3);
    out.push({ date, type: "temp_deviation", value: +(0.12 + 0.18 * Math.abs(wave)).toFixed(2), sourceId });
    out.push({ date, type: "sleep_score", value: Math.round(64 - 9 * wave), sourceId });
    out.push({ date, type: "hrv", value: Math.round(34 + 6 * wave), sourceId });
  }
  return out;
}
const loadOf = (day, ids) => Math.min(1, ids.reduce((a, k) => a + (day.sym[k] || 0), 0) / (ids.length * 2));
function stripeColor(v, hot, calm, mid) {
  const lerp = (a, b, u) => a.map((c, i) => Math.round(c + (b[i] - c) * u));
  const c = v < 0.5 ? lerp(calm || [187, 203, 191], mid || [221, 138, 78], v * 2) : lerp(mid || [221, 138, 78], hot, (v - 0.5) * 2);
  return `rgb(${c})`;
}
const fmt = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function insights(days, ids) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const last30 = sorted.slice(-30);
  const lib = { ...SYM, ...PSYM };
  const counts = ids.map((id) => ({ id, label: lib[id], days: last30.filter((d) => d.sym[id] > 0).length, strong: last30.filter((d) => d.sym[id] >= 2).length })).sort((a, b) => b.days - a.days);
  const ap = [], ao = [];
  for (let i = 1; i < sorted.length; i++) (sorted[i - 1].sleepQ === "poor" ? ap : ao).push(sorted[i]);
  const rate = (arr, id) => (arr.length ? arr.filter((d) => d.sym[id] >= 2).length / arr.length : 0);
  const hfMult = rate(ao, "hf") > 0 ? rate(ap, "hf") / rate(ao, "hf") : null;
  const pset = new Set(sorted.filter((d) => d.period).map((d) => d.date));
  const starts = [];
  pset.forEach((iso) => {
    let st = true;
    for (let k = 1; k <= 5; k++) { const p = new Date(iso + "T12:00:00"); p.setDate(p.getDate() - k); if (pset.has(p.toISOString().slice(0, 10))) st = false; }
    if (st) starts.push(iso);
  });
  starts.sort();
  const lens = [];
  for (let i = 1; i < starts.length; i++) { const g = Math.round((new Date(starts[i]) - new Date(starts[i - 1])) / 86400000); if (g >= 15 && g <= 120) lens.push(g); }
  const variability = lens.length >= 2 ? Math.max(...lens) - Math.min(...lens) : null;
  return { sorted, last30, counts, hfMult, lens: lens.slice(-6), variability, starts };
}
function predict(ins) {
  if (!ins.starts.length) return null;
  const lastStart = new Date(ins.starts[ins.starts.length - 1] + "T12:00:00");
  const avgLen = ins.lens.length ? Math.round(ins.lens.reduce((a, b) => a + b, 0) / ins.lens.length) : 28;
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const cycleDay = Math.round((today - lastStart) / 86400000) + 1;
  const nextStart = new Date(lastStart); nextStart.setDate(nextStart.getDate() + avgLen);
  const late = Math.round((today - nextStart) / 86400000);
  const ovu = new Date(nextStart); ovu.setDate(ovu.getDate() - 14);
  const fertileFrom = new Date(ovu); fertileFrom.setDate(fertileFrom.getDate() - 3);
  const fertileTo = new Date(ovu); fertileTo.setDate(fertileTo.getDate() + 1);
  const daysTo = Math.round((nextStart - today) / 86400000);
  const phase = cycleDay <= 5 ? "menstrual" : today >= fertileFrom && today <= fertileTo ? "fertile" : today < fertileFrom ? "follicular" : "luteal";
  return { cycleDay, avgLen, nextStart, daysTo, late, ovu, fertileFrom, fertileTo, phase };
}
const inRange = (d, a, b) => d >= new Date(a.toDateString()) && d <= new Date(b.toDateString());

const READS = {
  menstrual: ["Why cramps peak on day 1–2", "Prostaglandins drive them — which is why anti-inflammatories and heat both genuinely work."],
  follicular: ["Your estrogen upswing", "Energy and mood often climb now; a good week for harder workouts."],
  fertile: ["The fertile window, honestly", "Body signs beat any app's guess — here's why we show a range, not a day."],
  luteal: ["Luteal sleep, explained", "Progesterone raises body temperature ~0.3°C — why sleep feels lighter this week."],
};
const PREG_TIPS = {
  1: ["Folate matters most right now", "It's the best-evidenced supplement in medicine for this trimester."],
  2: ["Week 22: the kicking era", "Movement patterns become trackable — that's why the kick counter exists."],
  3: ["Third trimester sleep", "Side-sleeping with pillow support has real evidence behind it."],
};

/* Advice engine: every insight ends in an action + urgency. */
function Advice({ urgency, children }) {
  const map = { now: ["This week", "u-now"], visit: ["Next visit", "u-visit"], self: ["Self-care", "u-self"] };
  const [label, cls] = map[urgency];
  return (
    <div className="advice">
      <span className={`uchip ${cls}`}>{label}</span>
      <span className="atext">{children}</span>
    </div>
  );
}

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
  const symBurden = (symObj, ids) => {
    const vals = ids.map((k) => symObj[k] || 0);
    return vals.length ? Math.min(1, vals.reduce((a, b) => a + b, 0) / (ids.length * 1.6)) : 0;
  };
  const draftIds = stage === "preg" ? Object.keys(GSYM) : symIds;
  const liveBurden = Math.min(1,
    symBurden(draft, draftIds) * 0.5 +
    (scales.fatigue / 10) * 0.2 +
    (scales.pain / 10) * 0.2 +
    ((10 - scales.moodq) / 10) * 0.1
  );
  const liveScore = 1 - liveBurden; // 1 = great day
  const scoreLabel = (s) => s > 0.82 ? "A really good day" : s > 0.64 ? "A good day" : s > 0.46 ? "A mixed day" : s > 0.28 ? "A hard day" : "A rough day";
  /* Data-viz ramp: saturated and readable, independent of UI chrome colors. */
  const RAMPS = {
    peri:    { good: [26, 168, 148], mid: [246, 189, 74], rough: [140, 74, 168] },
    preg:    { good: [42, 176, 158], mid: [249, 176, 104], rough: [222, 84, 112] },
    periods: { good: [46, 154, 198], mid: [250, 186, 82], rough: [226, 88, 74] },
  };
  const ramp = () => RAMPS[stage] || RAMPS.peri;
  const scoreRough = () => ramp().rough;
  const scoreColor = (s) => {
    const lerp = (a, b, u) => a.map((c, i) => Math.round(c + (b[i] - c) * u));
    const { good, mid, rough } = ramp();
    const c = s > 0.5 ? lerp(mid, good, (s - 0.5) * 2) : lerp(rough, mid, s * 2);
    return `rgb(${c})`;
  };
  const dayScore = (entry, ids) => {
    if (!entry) return null;
    const sc = entry.scales || {};
    return 1 - Math.min(1, symBurden(entry.sym || {}, ids) * 0.5 + ((sc.fatigue || 0) / 10) * 0.2 + ((sc.pain || 0) / 10) * 0.2 + ((10 - (sc.moodq ?? 5)) / 10) * 0.1);
  };

  const scoreMeter = (
    <div className="meter" style={{ borderColor: scoreColor(liveScore) }}>
      <div className="meterhead">
        <span className="meterlabel">{scoreLabel(liveScore)}</span>
        <span className="meterval" style={{ color: scoreColor(liveScore) }}>{Math.round(liveScore * 100)}</span>
      </div>
      <div className="metertrack" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(liveScore * 100)} aria-label={`Day score ${Math.round(liveScore * 100)} out of 100, ${scoreLabel(liveScore)}`}>
        <div className="meterfill" style={{ width: `${liveScore * 100}%`, background: `linear-gradient(90deg, ${scoreColor(0)}, ${scoreColor(0.5)}, ${scoreColor(liveScore)})` }} />
      </div>
      <div className="meterends"><span>rough</span><span>great</span></div>
    </div>
  );

  const odorAdvice = () => {
    if (odor === "fishy") return <Advice urgency="now">A fishy odor — especially with grey or thin discharge — is the classic sign of bacterial vaginosis. It's common, it's not your fault, and it's treated with a short course of antibiotics. Worth a visit this week rather than a drugstore guess.</Advice>;
    if (odor === "yeasty") return <Advice urgency="visit">A yeasty or sour smell with thick white discharge and itching usually points to a yeast infection — treatable over the counter, but if it's your first time or it keeps returning, get it confirmed. Recurring thrush can signal something else worth checking.</Advice>;
    if (odor === "strong") return <Advice urgency="visit">Strong odor changes are worth mentioning — but note that healthy vaginas have a scent, and it shifts across your cycle. Skip douching entirely: it disrupts the bacteria that protect you and makes infections more likely.</Advice>;
    if (disch === "unusual") return <Advice urgency="visit">Unusual discharge — green, grey, frothy, or with pain or bleeding — deserves a proper look rather than guesswork. Most causes are simple and treatable.</Advice>;
    if (bodyOdor === "changed") return <Advice urgency="self">Body odor genuinely shifts with hormones — many women notice it changing around ovulation, in pregnancy, and through perimenopause. If it came on suddenly with other symptoms though, mention it.</Advice>;
    return null;
  };

  const bodySection = (
    <>
      <button className="disclosure" onClick={() => setShowBody((s) => !s)}>
        <span>Body signals{stage === "preg" ? "" : " · flow, discharge, odor"}</span><span>{showBody ? "−" : "+"}</span>
      </button>
      {showBody && (
        <div className="bodypanel">
          {stage !== "preg" && (
            <>
              <p className="section-lab">Flow today</p>
              <div className="wrapchips">
                {FLOW.map(([v, l]) => <button key={v} className={`minichip ${flow === v ? "on" : ""}`} onClick={() => setFlow(flow === v ? null : v)}>{l}</button>)}
              </div>
              {flow === "flood" && <Advice urgency="now">Flooding — soaking a pad or tampon hourly, or passing large clots — is a see-someone-now symptom, not something to endure. Heavy bleeding is treatable and can cause anemia if it goes unchecked.</Advice>}
              <p className="section-lab">Discharge</p>
              <div className="wrapchips">
                {DISCHARGE.map(([v, l]) => <button key={v} className={`minichip ${disch === v ? "on" : ""}`} onClick={() => setDisch(disch === v ? null : v)}>{l}</button>)}
              </div>
            </>
          )}
          <p className="section-lab">Vaginal odor</p>
          <div className="wrapchips">
            {ODOR.map(([v, l]) => <button key={v} className={`minichip ${odor === v ? "on" : ""}`} onClick={() => setOdor(odor === v ? null : v)}>{l}</button>)}
          </div>
          <p className="section-lab">Body odor</p>
          <div className="wrapchips">
            {BODYODOR.map(([v, l]) => <button key={v} className={`minichip ${bodyOdor === v ? "on" : ""}`} onClick={() => setBodyOdor(bodyOdor === v ? null : v)}>{l}</button>)}
          </div>
          {odorAdvice()}
          <p className="rfoot">Nothing here is embarrassing and nothing is judged — these are the signals clinicians actually ask about, and most have simple fixes.</p>
        </div>
      )}
    </>
  );

  const scaleSection = (
    <>
      <p className="section-lab">How it felt, 0–10</p>
      {SCALES.map((s) => (
        <div className="scalerow" key={s.id}>
          <div className="scalehead"><span>{s.label}</span><b>{scales[s.id]}</b></div>
          <input className="slider" type="range" min="0" max="10" value={scales[s.id]} aria-label={`${s.label}, 0 is ${s.low}, 10 is ${s.high}`} aria-valuetext={`${scales[s.id]} out of 10`} onChange={(e) => setScales((x) => ({ ...x, [s.id]: +e.target.value }))} />
          <div className="scaleends"><span>{s.low}</span><span>{s.high}</span></div>
        </div>
      ))}
      {scales.fatigue >= 8 && <Advice urgency="visit">Fatigue at this level for weeks isn't just "being tired" — thyroid problems, iron-deficiency anemia (very common with heavy periods), and vitamin D deficiency all show up this way and are all simple blood tests. Ask for them by name.</Advice>}
      {scales.pain >= 8 && <Advice urgency="visit">Pain you'd rate 8+ is not something to normalize. Bring these numbers to your appointment — a tracked pain scale is far harder to wave away than "it hurts a lot."</Advice>}
    </>
  );

  /* ---- Settings: cadence + quiet hours ---- */
  const settingsSheet = showSettings && (
    <div className="palsheet">
      <p className="section-lab" style={{ margin: "0 0 8px" }}>Check-in rhythm</p>
      <div className="regcards">
        {CADENCE.map((cd) => (
          <button key={cd.id} aria-pressed={cadence === cd.id} className={`stagecard ${cadence === cd.id ? "on" : ""}`} style={{ padding: "10px 14px" }} onClick={() => { setCadence(cd.id); ping(`Rhythm set to ${cd.label.toLowerCase()}`); }}><b style={{ fontSize: 14 }}>{cd.label}</b><span>{cd.desc}</span></button>
        ))}
      </div>
      <p className="section-lab" style={{ margin: "14px 0 8px" }}>Best time to nudge</p>
      <div className="mcrow">
        {[["morning", "Morning"], ["midday", "Midday"], ["evening", "Evening"], ["never", "Never remind me"]].map(([v, l]) => (
          <button key={v} aria-pressed={quietHours === v} className={`mc ${quietHours === v ? "on" : ""}`} onClick={() => setQuietHours(v)}>{l}</button>
        ))}
      </div>
      <p className="section-lab" style={{ margin: "14px 0 8px" }}>Check-in style</p>
      <div className="mcrow">
        <button className={`mc ${quickMode ? "on" : ""}`} onClick={() => setQuickMode(true)}>Quick · 3 taps</button>
        <button className={`mc ${!quickMode ? "on" : ""}`} onClick={() => setQuickMode(false)}>Full detail</button>
      </div>
      <p className="rfoot">One reminder at most. Missed days are never scolded — your patterns work fine with gaps.</p>
      <button className="ghostbtn" style={{ marginTop: 10 }} onClick={() => setShowSettings(false)}>Done</button>
    </div>
  );

  /* ---- Quick check-in: three stage-specific questions, done in ~10 seconds ---- */
  const quickCheckin = (
    <div className="plaincard" style={{ marginBottom: 14 }}>
      <div className="shead" style={{ marginBottom: 8 }}><span className="sbrand">Quick check-in</span><button className="linkbtn" onClick={() => setQuickMode(false)}>more detail</button></div>
      {(QUICK_Q[stage] || QUICK_Q.peri).map((q, i) => {
        const key = ["q1", "q2", "q3"][i];
        return (
          <div key={q} style={{ marginBottom: 10 }}>
            <p className="plain" style={{ marginBottom: 6, fontSize: 13.5 }}>{q}</p>
            <div className="mcrow">
              {[["0", "No / fine"], ["1", "A little"], ["2", "Yes"], ["3", "A lot"]].map(([v, l]) => (
                <button key={v} className={`mc ${String(draft[key] ?? "") === v ? "on" : ""}`} onClick={() => setDraft((d) => ({ ...d, [key]: +v }))}>{l}</button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ---- Connection & intimacy view ---- */
  const connScore = Math.round(((conn.closeness + conn.desire + conn.load + (10 - conn.friction)) / 40) * 100);
  const connAdvice = () => {
    if (after === "pain") return <Advice urgency="visit">Pain or dryness with intimacy is one of the most common — and most treatable — things people never mention. Vaginal estrogen, moisturizers, and lubricants have strong evidence. This is worth saying out loud at your next visit.</Advice>;
    if (conn.load <= 3 && conn.desire <= 4) return <Advice urgency="self">Research found that when the mental load falls mostly on one partner, their desire tends to drop — it's one of the strongest predictors, stronger than hormone levels. Worth a conversation about who carries what.</Advice>;
    if (conn.friction >= 7) return <Advice urgency="self">High tension days are worth noting next to your symptoms. Couples' stress tends to sync up — and distressed partners amplify each other, while connected ones tend to calm each other down.</Advice>;
    if (conn.closeness >= 8) return <Advice urgency="self">Affectionate closeness — not just sexual contact — has its own measurable effect on stress hormones. Days like this are worth tracking too.</Advice>;
    return <Advice urgency="self">Studies show relationship satisfaction and partner availability predict desire far more than hormone levels do. Tracking how you feel alongside your cycle helps you see your own pattern — without assuming hormones are the whole story.</Advice>;
  };
  const connView = (
    <main>
      <h1 className="disp">Connection</h1>
      <p className="hint">Optional, private, and judgment-free. This tracks how connected you feel — not just sex — because the research is clear that closeness, fairness, and tension predict desire more than hormones do. Nothing here assumes who your partner is, or that there's only one.</p>
      {!relationship && (
        <>
          <p className="section-lab">Your situation (optional)</p>
          <div className="mcrow" style={{ marginBottom: 14 }}>
            {RELATIONSHIP.map(([v, l]) => <button key={v} aria-pressed={relationship === v} className={`mc ${relationship === v ? "on" : ""}`} onClick={() => setRelationship(v)}>{l}</button>)}
          </div>
        </>
      )}
      <p className="section-lab">How it felt today, 0–10</p>
      {Object.entries(CONNECT).map(([k, s]) => (
        <div className="scalerow" key={k}>
          <div className="scalehead"><span>{s.label}</span><b>{conn[k]}</b></div>
          <input className="slider" type="range" min="0" max="10" value={conn[k]} aria-label={`${s.label}, 0 is ${s.low}, 10 is ${s.high}`} aria-valuetext={`${conn[k]} out of 10`} onChange={(e) => setConn((x) => ({ ...x, [k]: +e.target.value }))} />
          <div className="scaleends"><span>{s.low}</span><span>{s.high}</span></div>
        </div>
      ))}
      {relationship !== "single" && (
        <>
          <p className="section-lab">Intimacy today</p>
          <div className="mcrow" style={{ marginBottom: 10 }}>
            {INTIMACY.map(([v, l]) => <button key={v} aria-pressed={intimacy === v} className={`mc ${intimacy === v ? "on" : ""}`} onClick={() => setIntimacy(intimacy === v ? null : v)}>{l}</button>)}
          </div>
          {intimacy && intimacy !== "none" && (
            <>
              <p className="section-lab">Afterwards</p>
              <div className="mcrow" style={{ marginBottom: 10 }}>
                {AFTER.map(([v, l]) => <button key={v} aria-pressed={after === v} className={`mc ${after === v ? "on" : ""}`} onClick={() => setAfter(after === v ? null : v)}>{l}</button>)}
              </div>
            </>
          )}
        </>
      )}
      <div className="card"><div className="num">{connScore}</div><p>Connection today. Over weeks, Cyra lines this up against your cycle phase and symptoms — so you can see whether low-desire days are really hormonal, or something else entirely.</p></div>
      {connAdvice()}
      <button className="cta" style={{ marginTop: 12 }} onClick={() => { setConnLog((l) => ({ ...l, [todayIso]: { ...conn, intimacy, after } })); ping("Saved — private to your device"); }}>Save</button>
      <p className="rfoot">Separated from sexual activity on purpose: affection and sex move your body differently, and both matter. Pain with intimacy is always worth raising with a clinician — it's common and treatable.</p>
    </main>
  );

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
  const delta = (a, b, goodUp = true) => { const d = b - a; if (d === 0) return <span className="flat">unchanged</span>; const good = goodUp ? d > 0 : d < 0; return <span className={good ? "up" : "down"}>{d > 0 ? "+" : ""}{d}</span>; };

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

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const homeView = (
    <main>
      <div className="homehead">
        <div>
          <div className="greet">{greet}{acct.name ? `, ${acct.name}` : ""}.</div>
          <div className="greetsub">{stage === "preg" ? `Week ${pregWeek} · second trimester` : pred ? `Day ${pred.cycleDay} · ${pred.phase} phase` : stageName}</div>
        </div>
        <div className="streak"><b>{loggedLast14}</b><span>of 14 days</span></div>
      </div>
      <p className="hint" style={{ marginTop: -6 }}>{streakLine}</p>

      <button className="cta" onClick={() => goTab("today")}>{entryOn(todayIso) ? "Update today's check-in" : "Check in — about 30 seconds"}</button>

      <p className="section-lab">Today's insight</p>
      <div className="card"><div className="num">{homeInsight.num}</div><p>{homeInsight.text}</p></div>

      {wearInsights.length > 0 && (
        <>
          <p className="section-lab">From your wearable</p>
          {wearInsights.map((w, i) => (
            <div className="icard" key={i}>
              <div className="card" style={{ marginBottom: 0 }}><div className="num">{w.num}</div><p>{w.text}</p></div>
              {w.advice && <Advice urgency={w.urgency || "self"}>{w.advice}</Advice>}
            </div>
          ))}
        </>
      )}

      <p className="section-lab">Milestones</p>
      <div className="mstrip">
        {milestones.map((m, i) => (
          <div className={`ms ${m.done ? "done" : ""}`} key={i}>
            <span className="msdot">{m.done ? "✓" : ""}</span>
            <span className="mslabel">{m.label}</span>
            {m.progress != null && !m.done && <span className="msbar"><i style={{ width: `${m.progress * 100}%` }} /></span>}
          </div>
        ))}
      </div>

      {nextUp.length > 0 && (
        <>
          <p className="section-lab">Coming up</p>
          <div className="plaincard" style={{ padding: "6px 16px" }}>
            {nextUp.map((n) => (
              <div className="nextrow" key={n.k} role={n.action ? "button" : undefined} tabIndex={n.action ? 0 : undefined} onKeyDown={n.action ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); n.action(); } } : undefined} onClick={n.action || undefined} style={n.action ? { cursor: "pointer" } : {}}>
                <span className="nextdot" /><div><div className="nexttext">{n.text}</div><div className={`nextsub ${n.action ? "link" : ""}`}>{n.sub}</div></div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="section-lab">You're not alone · this week across Cyra</p>
      <div className="pulse">
        {PULSE.map(([n, what]) => <div className="pulserow" key={what}><b>{n.toLocaleString()}</b><span>women {what}</span></div>)}
        <p className="rfoot" style={{ margin: "10px 0 0" }}>Anonymous counts only — no one's data is shared. Demo figures; live numbers come from the aggregate service.</p>
      </div>

      {recap ? (
        <>
          <button className="disclosure" onClick={() => setShowRecap((v) => !v)}><span>Your month vs last month</span><span>{showRecap ? "−" : "+"}</span></button>
          {showRecap && (
            <div className="bodypanel">
              <div className="recaprow"><span>Average day score</span><b>{recap.score[0]} → {recap.score[1]} {delta(recap.score[0], recap.score[1])}</b></div>
              <div className="recaprow"><span>Calm days</span><b>{recap.calm[0]} → {recap.calm[1]} {delta(recap.calm[0], recap.calm[1])}</b></div>
              <div className="recaprow"><span>Rough nights</span><b>{recap.poor[0]} → {recap.poor[1]} {delta(recap.poor[0], recap.poor[1], false)}</b></div>
              {recap.top && <div className="recaprow"><span>{recap.top.label} days</span><b>{recap.top.prev} → {recap.top.now} {delta(recap.top.prev, recap.top.now, false)}</b></div>}
              <p className="rfoot">Progress isn't always a straight line — a harder month is information, not failure.</p>
            </div>
          )}
        </>
      ) : (
        <div className="card" style={{ marginTop: 14 }}><div className="num">30d</div><p>Your first monthly recap arrives once there are two months to compare. Keep going.</p></div>
      )}

      {/* ---- Wearables ---- */}
      <button className="disclosure" onClick={() => setShowWear((v) => !v)}><span>Wearables{Object.keys(wearSources).length ? ` · ${Object.keys(wearSources).length} connected` : " · optional"}</span><span>{showWear ? "−" : "+"}</span></button>
      {showWear && (
        <div className="bodypanel">
          <p className="hint" style={{ margin: "10px 0" }}>Entirely optional — Cyra works fully without a device. Connect one and it adds skin temperature, resting heart rate, HRV, and sleep to your record, read on your device.</p>
          {[["healthkit", "Apple Watch · Health app", "temperature, heart rate, sleep"], ["oura", "Oura Ring", "temperature trend, HRV, readiness"], ["terra", "Fitbit · Garmin · Whoop", "via a secure aggregator"]].map(([id, name, what]) => (
            <div className="medrow" key={id}>
              <div className="medinfo"><b>{name}</b><span>{what}</span></div>
              <button className={`takebtn ${wearSources[id] ? "on" : ""}`} onClick={() => connectWear(id, name)}>{wearSources[id] ? "✓ Connected" : "Connect"}</button>
            </div>
          ))}
          {wearData.length > 0 && (
            <div className="plaincard" style={{ marginTop: 10 }}>
              <div className="recaprow" style={{ borderTop: "none", marginTop: 0 }}><span>Avg temperature deviation</span><b>{wAvg("temp") > 0 ? "+" : ""}{wAvg("temp")}°C</b></div>
              <div className="recaprow"><span>Resting heart rate</span><b>{wAvg("rhr")} bpm</b></div>
              <div className="recaprow"><span>HRV</span><b>{wAvg("hrv")} ms</b></div>
              <div className="recaprow"><span>Sleep score</span><b>{wAvg("sleep")}</b></div>
            </div>
          )}
          <p className="rfoot">Demo imports 30 days of illustrative data shaped to your stage; production reads your real device history. Wearable signals confirm patterns after the fact — they don't replace a clinician and aren't contraception.</p>
        </div>
      )}

      {/* ---- What I'm trying ---- */}
      <button className="disclosure" onClick={() => setShowMeds((v) => !v)}><span>What I'm trying · meds, supplements, habits{meds.length ? ` · ${meds.length}` : ""}</span><span>{showMeds ? "−" : "+"}</span></button>
      {showMeds && (
        <div className="bodypanel">
          <p className="hint" style={{ margin: "10px 0" }}>Change one thing — a prescription, a supplement, cutting caffeine, an earlier bedtime — and Cyra compares your days before and after. Trial and error, with a record.</p>
          {meds.map((m) => {
            const takenToday = !!(medLog[todayIso] || {})[m.id];
            const eff = medEffects.find((e) => e.id === m.id);
            return (
              <div className="medrow" key={m.id}>
                <div className="medinfo"><b>{m.name}</b><span>{m.kind === "rx" ? "Prescription" : m.kind === "supp" ? "Supplement" : "Habit"} · since {fmt(m.started)}</span>
                  {eff?.ready ? <span className="medeff">Day score {eff.before} → {eff.after} since starting</span> : <span className="medeff muted">{eff ? `${eff.need} more logged days to compare` : ""}</span>}
                </div>
                <button aria-pressed={takenToday} className={`takebtn ${takenToday ? "on" : ""}`} onClick={() => setMedLog((l) => ({ ...l, [todayIso]: { ...(l[todayIso] || {}), [m.id]: !takenToday } }))}>{takenToday ? "✓ Taken" : "Taken today?"}</button>
              </div>
            );
          })}
          <input className="inp" placeholder="e.g. Estradiol patch · Magnesium · No caffeine after noon" aria-label="e.g. Estradiol patch · Magnesium · No caffeine after noon" value={newMed.name} onChange={(e) => setNewMed((x) => ({ ...x, name: e.target.value }))} />
          <div className="mcrow" style={{ marginBottom: 9 }}>
            {[["rx", "Prescription"], ["supp", "Supplement"], ["habit", "Habit / lifestyle"]].map(([v, l]) => <button key={v} aria-pressed={newMed.kind === v} className={`mc ${newMed.kind === v ? "on" : ""}`} onClick={() => setNewMed((x) => ({ ...x, kind: v }))}>{l}</button>)}
          </div>
          <p className="lab" style={{ margin: "4px 0 6px" }}>Started on</p>
          <input className="inp" type="date" aria-label="Started on date" value={newMed.started} onChange={(e) => setNewMed((x) => ({ ...x, started: e.target.value }))} />
          <button className="cta" onClick={() => { if (!newMed.name.trim()) return ping("Give it a name first"); setMeds((m) => [...m, { id: Date.now(), ...newMed }]); setNewMed({ name: "", kind: "supp", started: todayIso }); ping("Added — Cyra will compare your days before and after"); }}>Add</button>
          <p className="rfoot">Change one variable at a time for two weeks, then look — that's how you learn what actually moves your days. Cyra never recommends doses or changes; those stay with you and your clinician.</p>
        </div>
      )}

      {/* ---- Appointments ---- */}
      <button className="disclosure" onClick={() => setShowAppts((v) => !v)}><span>Appointments{upcoming.length ? ` · ${upcoming.length} upcoming` : ""}</span><span>{showAppts ? "−" : "+"}</span></button>
      {showAppts && (
        <div className="bodypanel">
          {upcoming.map((a) => (
            <div className="medrow" key={a.id}>
              <div className="medinfo"><b>{a.who || "Appointment"}</b><span>{fmt(a.date)} · in {daysUntil(a.date)} day{daysUntil(a.date) === 1 ? "" : "s"}</span></div>
              {daysUntil(a.date) <= 7 && <button className="takebtn on" onClick={() => goTab("report")}>Prep report</button>}
            </div>
          ))}
          {past.filter((a) => !a.note).map((a) => (
            <div className="plaincard" key={a.id} style={{ margin: "8px 0" }}>
              <b style={{ fontSize: 13.5 }}>{a.who || "Appointment"} · {fmt(a.date)}</b>
              <p className="hint" style={{ margin: "4px 0 8px" }}>What did they say? A line or two is enough.</p>
              <textarea className="inp" rows={2} style={{ resize: "none", fontFamily: "inherit" }} placeholder="e.g. Starting a low-dose patch, recheck in 3 months" aria-label="e.g. Starting a low-dose patch, recheck in 3 months" onBlur={(e) => { const v = e.target.value.trim(); if (v) setAppts((x) => x.map((y) => y.id === a.id ? { ...y, note: v } : y)); }} />
            </div>
          ))}
          {past.filter((a) => a.note).slice(0, 3).map((a) => <div className="medrow" key={a.id}><div className="medinfo"><b>{a.who || "Appointment"} · {fmt(a.date)}</b><span>{a.note}</span></div></div>)}
          <p className="lab" style={{ margin: "10px 0 6px" }}>Add an appointment</p>
          <input className="inp" type="date" aria-label="Appointment date" value={newAppt.date} onChange={(e) => setNewAppt((x) => ({ ...x, date: e.target.value }))} />
          <input className="inp" placeholder="With whom (optional)" aria-label="With whom (optional)" value={newAppt.who} onChange={(e) => setNewAppt((x) => ({ ...x, who: e.target.value }))} />
          <button className="cta" onClick={() => { if (!newAppt.date) return ping("Pick a date"); setAppts((x) => [...x, { id: Date.now(), ...newAppt, note: "" }]); setNewAppt({ date: "", who: "" }); ping("Added — Cyra will nudge you to prep a week out"); }}>Add</button>
        </div>
      )}

      {/* ---- Journal ---- */}
      <button className="disclosure" onClick={() => setShowJournal((v) => !v)}><span>Journal{Object.keys(journal).length ? ` · ${Object.keys(journal).length} entries` : ""}</span><span>{showJournal ? "−" : "+"}</span></button>
      {showJournal && (
        <div className="bodypanel">
          <p className="hint" style={{ margin: "10px 0 8px" }}>How are you, really? Some days a slider isn't enough.</p>
          <textarea className="inp" rows={3} style={{ resize: "none", fontFamily: "inherit" }} value={jDraft} onChange={(e) => setJDraft(e.target.value)} placeholder="Private. Just for you." />
          <button className="cta" onClick={() => { if (!jDraft.trim()) return; setJournal((j) => ({ ...j, [todayIso]: jDraft.trim() })); setJDraft(""); ping("Saved to your journal"); }}>Save entry</button>
          {Object.keys(journal).sort().reverse().slice(0, 5).map((iso) => <div className="jentry" key={iso}><b>{fmt(iso)}</b><p>{journal[iso]}</p></div>)}
        </div>
      )}
    </main>
  );

  const askView = (
    <main>
      <h1 className="disp">Ask {org.name}</h1>
      <p className="hint">Real medical evidence, translated into plain language — the stuff your doctor reads, made readable. Every answer names its source and ends with a question worth bringing to your next visit.</p>
      <textarea className="inp" rows={3} style={{ resize: "none", fontFamily: "inherit" }} placeholder={stage === "preg" ? "e.g. Is it safe to exercise in the second trimester?" : stage === "periods" ? "e.g. Why are my cramps worse some months?" : "e.g. Does hormone therapy raise cancer risk?"} value={askQ} onChange={(e) => setAskQ(e.target.value)} />
      <button className="cta" onClick={runAsk} disabled={askBusy}>{askBusy ? "Reading the evidence…" : "Ask"}</button>
      {askOut && (
        <div className="card" style={{ display: "block", marginTop: 14 }}>
          {askOut.urgent && <div style={{ marginBottom: 10 }}><Advice urgency="now">This sounds like something to get checked promptly — please contact your provider or urgent care rather than waiting.</Advice></div>}
          <p style={{ lineHeight: 1.6 }}>{askOut.answer}</p>
          {askOut.source_note && <p className="rfoot" style={{ marginTop: 10 }}>Evidence base: {askOut.source_note}</p>}
          {askOut.ask_your_doctor && <div style={{ marginTop: 10 }}><Advice urgency="visit">Worth asking: "{askOut.ask_your_doctor}"</Advice></div>}
          <p className="rfoot" style={{ marginTop: 10 }}>Plain-language education, not medical advice or diagnosis.</p>
        </div>
      )}
      <p className="rfoot" style={{ marginTop: 14 }}>Your questions stay on your device and are never linked to your identity.</p>
    </main>
  );

  const BIZ = [
    { l: "1 · Generate referral link (hash only)", line: "POST /api/referrals/link → code a47f…, no PII" },
    { l: "2 · User clicks → redirect to partner", line: "GET /r/a47f… → 302 partner site ?ref=a47f…" },
    { l: "3 · Partner webhook: patient booked", line: "HMAC ✓ · conversion · NEW PATIENT → $80 bounty", amt: 80 },
    { l: "4 · Follow-up visit (no double bounty)", line: "HMAC ✓ · visit · isNewPatient: false → $0" },
    { l: "5 · Product sale $68 → 15%", line: "HMAC ✓ · conversion · commission $10.20", amt: 10.2 },
    { l: "6 · Forged webhook → rejected", line: "HMAC ✗ → 401 · no event, no payout" },
  ];
  const bizTotal = bizEvents.reduce((a, e) => a + (e.amt || 0), 0);
  const sevDots = (n) => "●".repeat(n) + "○".repeat(3 - n);
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

  const OBQ = [
    { key: "preg", q: "Are you currently pregnant?", opts: [["yes", "Yes"], ["no", "No"], ["ttc", "Trying to be"]] },
    { key: "age", q: "Which fits you?", opts: [["u35", "Under 35"], ["3544", "35–44"], ["45p", "45+"]] },
    { key: "per", q: "Your periods lately?", opts: [["regular", "Pretty regular"], ["irregular", "Irregular or changing"], ["none12", "None in 12+ months"], ["na", "Prefer to skip"]] },
    { key: "vms", q: "Hot flashes or night sweats recently?", opts: [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]] },
  ];

  if (phase === "splash") {
    return (
      <div className="cy" style={style}>
        <style>{css}</style>
        <div className="splash">
          <div className="splashmark">Cyra<span>.</span></div>
          <div className="splashtag">One companion for every phase</div>
          <h1 className="disp" style={{ marginTop: 26 }}>Periods, pregnancy,
            <br />the transition — and
            <br />finally being heard.</h1>
          <p className="hint">Track in 30 seconds a day. See your real patterns. Walk into appointments with evidence. Your health data stays on your device — always.</p>
          <button className="cta" onClick={() => setPhase("register")}>Get started</button>
          <p className="rfoot" style={{ textAlign: "center" }}>Free to use · guidance, never diagnosis<br /><b>BUILD 2026.10.07-D</b></p>
        </div>
      </div>
    );
  }

  if (phase === "register") {
    const RSTEPS = [
      { key: "account", title: "Create your account", sub: "Or don't — Anonymous Mode gives you the full app with no name, no email, nothing that identifies you. If anyone ever demands we identify you, we can't." },
      { key: "basics", title: "A bit about you", sub: "Age band and ZIP — enough to personalize, never enough on their own to identify you." },
      { key: "stage", title: "Where are you right now?", sub: "This shapes your entire experience. You can change it anytime." },
      { key: "cycle", title: "Your cycle history", sub: "So predictions start accurate instead of guessing for months." },
      { key: "repro", title: "Reproductive history", sub: "Private and optional — it genuinely changes what's relevant to you." },
      { key: "health", title: "Health background", sub: "General categories that interact with hormonal health — never your medical records." },
      { key: "goals", title: "What brings you here?", sub: "So the app leads with what you actually care about." },
      { key: "consent", title: "Your data, your rules", sub: "The promises that never change — and the choices that are yours." },
    ];
    const rs = RSTEPS[regStep];
    const REQ = {
      account: [["email", reg.anon || reg.email.includes("@")]],
      basics: [["age", reg.age], ["zip", reg.zip]],
      stage: [["stage", reg.stage]],
      cycle: [["cycleLen", reg.cycleLen], ["cycleReg", reg.cycleReg]],
      repro: [["preg", reg.preg]],
      health: [["meds", reg.meds]],
      goals: [["goals", reg.goals.length], ["sleep", reg.sleep], ["activity", reg.activity]],
      consent: [["terms", reg.terms]],
    };
    const miss = (REQ[rs.key] || []).filter(([, ok]) => !ok).map(([k]) => k);
    const bad = (k) => regTouched[rs.key] && miss.includes(k);
    const rup = (k, v) => setReg((x) => ({ ...x, [k]: v }));
    const rtog = (k, v) => setReg((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));
    const RLab = ({ k, children }) => <p className={`lab ${bad(k) ? "labErr" : ""}`}>{children}{bad(k) && <span className="need"> · needed</span>}</p>;
    const RChips = ({ k, opts }) => (
      <div className={`mcrow ${bad(k) ? "err" : ""}`}>
        {opts.map((o) => <button key={o} aria-pressed={reg[k] === o} className={`mc ${reg[k] === o ? "on" : ""}`} onClick={() => rup(k, reg[k] === o ? null : o)}>{o}</button>)}
      </div>
    );
    const RMulti = ({ k, opts }) => (
      <div className={`mcrow ${bad(k) ? "err" : ""}`}>
        {opts.map((o) => <button key={o} className={`mc ${reg[k].includes(o) ? "on" : ""}`} onClick={() => rtog(k, o)}>{o}</button>)}
      </div>
    );

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

    const advance = () => {
      if (miss.length) { setRegTouched((t) => ({ ...t, [rs.key]: true })); return; }
      if (regStep < RSTEPS.length - 1) setRegStep(regStep + 1); else finishReg();
    };

    return (
      <div className="cy" style={style}>
        <style>{css}</style>
        <div className="obwrap">
          <span className="mark">Cyra<span className="sub">Health</span></span>
          <div className="prog" style={{ marginTop: 14 }}>{RSTEPS.map((_, i) => <span key={i} className={i <= regStep ? "on" : ""} />)}</div>
          <div className="stepno">Step {regStep + 1} of {RSTEPS.length}</div>
          <h1 className="disp">{rs.title}</h1>
          <p className="hint">{rs.sub}</p>

          {rs.key === "account" && (
            <>
              <input className="inp" placeholder="First name (optional)" aria-label="First name (optional)" value={reg.name} onChange={(e) => rup("name", e.target.value)} />
              <input className={`inp ${bad("email") ? "inpErr" : ""}`} placeholder="Email" aria-label="Email" type="email" value={reg.email} onChange={(e) => rup("email", e.target.value)} />
              <input className="inp" placeholder="Password" aria-label="Password" type="password" value={reg.pass} onChange={(e) => rup("pass", e.target.value)} />
              <button className="ghostbtn" onClick={() => { rup("anon", !reg.anon); rup("email", ""); }}>{reg.anon ? "✓ Anonymous Mode on" : "Continue in Anonymous Mode instead"}</button>
              <div className="orline"><span>or sign in with</span></div>
              <div className="social">
                {[["apple", "Apple", "#000"], ["google", "Google", "#4285F4"], ["facebook", "Facebook", "#1877F2"]].map(([id, label, color]) => (
                  <button key={id} className="socialbtn" disabled={!!socialBusy} onClick={() => {
                    setSocialBusy(id);
                    setTimeout(() => {
                      /* Production: redirect to the provider's OAuth flow; the backend callback
                         returns a verified email + name. Demo fills in a placeholder identity. */
                      setReg((x) => ({ ...x, anon: false, email: x.email || `you@${id === "apple" ? "privaterelay.appleid.com" : id + ".com"}`, name: x.name }));
                      setSocialBusy(null); ping(`Signed in with ${label}`); setRegStep(1);
                    }, 900);
                  }}>
                    <span className="socialdot" aria-hidden="true" style={{ background: color }} />{socialBusy === id ? "Connecting…" : label}
                  </button>
                ))}
              </div>
              <p className="rfoot">Signing in with a provider shares only your name and email with Cyra — never your health data with them. Apple lets you hide your email.</p>
            </>
          )}

          {rs.key === "basics" && (
            <>
              <RLab k="age">Age</RLab>
              <RChips k="age" opts={["Under 25", "25–34", "35–44", "45–54", "55+"]} />
              <RLab k="zip">ZIP or postal code</RLab>
              <input className={`inp ${bad("zip") ? "inpErr" : ""}`} placeholder="e.g. 90210" aria-label="e.g. 90210" value={reg.zip} onChange={(e) => rup("zip", e.target.value)} />
              <p className="rfoot">ZIP, not street address — enough for local care and regional averages, nothing more. A store only ever collects your full address at checkout.</p>
            </>
          )}

          {rs.key === "stage" && (
            <div className={`regcards ${bad("stage") ? "err" : ""}`}>
              {[["My Cycle", "periods & PMS"], ["Trying to conceive", "fertility"], ["Pregnant", "week by week"], ["Perimenopause", "changing cycles"], ["Menopause & beyond", "post-transition"]].map(([lbl, d]) => (
                <button key={lbl} aria-pressed={reg.stage === lbl} className={`stagecard ${reg.stage === lbl ? "on" : ""}`} onClick={() => rup("stage", lbl)}><b>{lbl}</b><span>{d}</span></button>
              ))}
            </div>
          )}

          {rs.key === "cycle" && (
            <>
              <RLab k="cycleLen">Typical cycle length</RLab>
              <RChips k="cycleLen" opts={["Under 24 days", "24–31 days", "Over 31 days", "Irregular", "Not sure"]} />
              <RLab k="cycleReg">How regular?</RLab>
              <RChips k="cycleReg" opts={["Clockwork", "Roughly", "All over"]} />
              <p className="lab">First day of your last period (optional)</p>
              <input className="inp" type="date" aria-label="First day of your last period" value={reg.lastPeriod} onChange={(e) => rup("lastPeriod", e.target.value)} />
            </>
          )}

          {rs.key === "repro" && (
            <>
              <RLab k="preg">Ever been pregnant?</RLab>
              <RChips k="preg" opts={["Never", "Currently", "In the past"]} />
              <p className="lab">Births</p>
              <RChips k="births" opts={["0", "1", "2", "3+"]} />
              <p className="lab">Current birth control</p>
              <RChips k="contra" opts={["None", "Pill", "IUD", "Implant/shot", "Barrier", "Prefer not to say"]} />
              <p className="rfoot">Every field skippable. Context to serve you — kept on your device, never sold.</p>
            </>
          )}

          {rs.key === "health" && (
            <>
              <p className="lab">Relevant conditions (tap any)</p>
              <RMulti k="conditions" opts={["PCOS", "Endometriosis", "Thyroid", "Diabetes", "Anemia", "Migraines", "High blood pressure", "Anxiety/depression", "None"]} />
              <p className="lab">Family history worth noting</p>
              <RMulti k="familyHx" opts={["Early menopause", "Osteoporosis", "Breast/ovarian cancer", "Heart disease", "None / unsure"]} />
              <RLab k="meds">On regular medication or hormones?</RLab>
              <RChips k="meds" opts={["No", "Yes", "Prefer not to say"]} />
              <p className="rfoot">General categories only. We never ask for medical records, insurance or policy numbers, government ID, or an SSN.</p>
            </>
          )}

          {rs.key === "goals" && (
            <>
              <RLab k="goals">What would make this worth it? (pick a few)</RLab>
              <RMulti k="goals" opts={["Understand my symptoms", "Predict my cycle", "Get pregnant", "Avoid pregnancy", "Prep for my doctor", "Sleep better", "Feel less alone", "Track the transition"]} />
              <RLab k="sleep">Sleep, most nights</RLab>
              <RChips k="sleep" opts={["Solid", "Hit or miss", "Poor"]} />
              <RLab k="activity">Activity level</RLab>
              <RChips k="activity" opts={["Low", "Moderate", "High"]} />
            </>
          )}

          {rs.key === "consent" && (
            <>
              <div className="consentcard">
                <b>Always true — no toggle, no fine print:</b>
                <ul className="rlist" style={{ marginTop: 6 }}>
                  <li>Your health data is stored on your device — insights run locally, not on our servers.</li>
                  <li>Never sold. Partners receive an anonymous token, never your identity.</li>
                  <li>Doctor sharing happens only when you press send.</li>
                  <li>Delete everything, anytime, in one tap.</li>
                  <li>Optional backup is encrypted so even we cannot read it — the key stays on your device.</li>
                </ul>
              </div>
              <p className="lab">How often should Cyra check in?</p>
              <div className="regcards" style={{ marginBottom: 14 }}>
                {CADENCE.map((cd) => (
                  <button key={cd.id} aria-pressed={cadence === cd.id} className={`stagecard ${cadence === cd.id ? "on" : ""}`} style={{ padding: "10px 14px" }} onClick={() => setCadence(cd.id)}><b style={{ fontSize: 14 }}>{cd.label}</b><span>{cd.desc}</span></button>
                ))}
              </div>
              <p className="rfoot" style={{ marginBottom: 14 }}>You can change this anytime. Cyra sends one reminder at most, never a second nudge, and never guilts you for a missed day — gaps are fine, your patterns still work.</p>
              {[["emailOptin", "Email me insights & reminders", "Unsubscribe anytime."],
                ["notifOptin", "Notify me on this device", "Free push reminders. No phone number, no texts, ever."],
                ["research", "Contribute to research", "Named studies improving women's care — aggregate, de-identified, opt-in per study, withdraw anytime."],
                ["terms", "I agree to the Terms & Privacy Policy", "Plain language, no dark patterns."]].map(([k, t2, d]) => (
                <button key={k} role="checkbox" aria-checked={!!(reg[k])} className={`consentopt ${reg[k] ? "on" : ""} ${k === "terms" && bad("terms") ? "inpErr" : ""}`} style={{ marginBottom: 9 }} onClick={() => rup(k, !reg[k])}>
                  <span className="ckbox">{reg[k] ? "✓" : ""}</span>
                  <span><b>{t2}</b><br />{d}</span>
                </button>
              ))}
            </>
          )}

          {regTouched[rs.key] && miss.length > 0 && (
            <p className="errhint">A few fields still need a tap — they're marked in red above.</p>
          )}

          <div className="nav">
            {regStep > 0 && <button className="back" onClick={() => setRegStep(regStep - 1)}>Back</button>}
            <button className="cta" onClick={advance}>{regStep < RSTEPS.length - 1 ? "Continue" : (miss.length ? "Complete required fields" : "Enter Cyra")}</button>
          </div>
        </div>
      </div>
    );
  }
  if (!stage) {
    const q = OBQ[ob.step];
    return (
      <div className="cy" style={style}>
        <style>{css}</style>
        <div className="obwrap">
          <span className="mark">{org.name}<span className="sub">{org.tag}</span></span>
          <h1 className="disp" style={{ marginTop: 22 }}>{acct.name ? `${acct.name}, let's set up` : "Let's set up"}
            <br />your space.</h1>
          <p className="hint">Four quick taps. Your answers shape the whole app — one experience, built for where you are. Your health answers stay on your device.</p>
          {obBusy ? (
            <div className="card" style={{ display: "block" }}><p>Personalizing your space…</p></div>
          ) : (
            <>
              <div className="obq">{q.q}</div>
              <div className="obopts">
                {q.opts.map(([v, label]) => (
                  <button key={v} className="obopt" onClick={() => {
                    const next = { ...ob, [q.key]: v };
                    if (q.key === "preg" && v === "yes") { setOb(next); setObBusy(true); setTimeout(() => { setStage("preg"); setStageName("Pregnancy"); setWelcome("Your pregnancy space is ready — week tracking, kick counts, and gentle guidance."); setAppTab("home"); setPregTab("home"); setObBusy(false); }, 700); return; }
                    if (ob.step < OBQ.length - 1) setOb({ ...next, step: ob.step + 1 });
                    else { setOb(next); finishOnboarding(); }
                  }}>{label}</button>
                ))}
              </div>
              <div className="obdots">{OBQ.map((_, i) => <span key={i} className={i === ob.step ? "on" : ""} />)}</div>
            </>
          )}
          <p className="rfoot">You can retake this anytime — life changes, the app changes with you.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cy" style={style}>
      <style>{css}</style>
      <header className="mast">
        <span className="mark">{org.name}<span className="sub">{org.tag}</span></span>
        {stage && <span className="acctchip">{acct.anon ? "Anonymous" : acct.name || "You"}{research ? " · research ✓" : ""}</span>}
        {stage && orgId === "cyra" && <button className="stagechip" onClick={() => setShowPal((s) => !s)} aria-label="Color palette" aria-expanded={showPal}>🎨</button>}
        {stage && <button className="stagechip" onClick={() => setShowSettings((s) => !s)} aria-label="Check-in settings" aria-expanded={showSettings}>⚙</button>}
        {stage && <button className="stagechip" onClick={() => { setStage(null); setOb({ step: 0, preg: null, age: null, per: null, vms: null }); setWelcome(""); }}>{stageName} · change</button>}
      </header>

      {/* ============ APP ============ */}
      {settingsSheet}
      {showPal && stage && orgId === "cyra" && (
        <div className="palsheet">
          <p className="section-lab" style={{ margin: "0 0 8px" }}>Palette · {stageName}</p>
          {PALETTES[stage].map((p, i) => (
            <button key={p.id} className={`palopt ${palIdx[stage] === i ? "on" : ""}`} onClick={() => { setPalIdx((x) => ({ ...x, [stage]: i })); }}>
              <span className="palswatches">
                <i style={{ background: p.primary }} /><i style={{ background: p.accent }} /><i style={{ background: p.paper, border: "1.5px solid " + p.line }} />
              </span>
              <span className="palmeta"><b>{p.name}</b><span>{p.note}</span></span>
              {palIdx[stage] === i && <span className="palcheck">✓</span>}
            </button>
          ))}
          <button className="ghostbtn" style={{ marginTop: 4 }} onClick={() => setShowPal(false)}>Done</button>
        </div>
      )}
      {true && (
        <div>

          {/* ---------- PREGNANCY: its own component ---------- */}
          {stage === "preg" ? (
            <>
              <nav className="tabs" role="tablist" aria-label="Sections">
                {[["home", "Home"], ["today", "Today"], ["cal", "Calendar"], ["mile", "Milestones"], ["connect", "Connect"], ["ask", "Ask"]].map(([id, l]) => (
                  <button key={id} role="tab" aria-selected={pregTab === id} className={`tab ${pregTab === id ? "tab-on" : ""}`} onClick={() => setPregTab(id)}>{l}</button>
                ))}
              </nav>

              {pregTab === "today" && (
            <main>
              <div className="pregband">
                <div className="pregweek">Week {pregWeek}</div>
                <div className="pregmeta"><b>Second trimester</b><span>Baby is about the size of a papaya. 18 weeks to go.</span></div>
              </div>
              <div className="pregbar"><div className="pregfill" style={{ width: `${(pregWeek / 40) * 100}%` }} /></div>

              <div className="readcard">
                <div className="rsec" style={{ margin: "0 0 4px" }}>This week's read</div>
                <div className="sname">{PREG_TIPS[trimester][0]}</div>
                <p className="hint" style={{ margin: "4px 0 0" }}>{PREG_TIPS[trimester][1]}</p>
              </div>

              <h1 className="disp" style={{ marginTop: 16 }}>How's today going?</h1>
              {scoreMeter}
              <div className="chips">
                {Object.entries(GSYM).map(([id, label]) => (
                  <button key={id} aria-pressed={(draft[id] || 0) > 0} aria-label={`${(symMap[id] || label)}, severity ${draft[id] || 0} of 3`} className={`chip sev-${draft[id] || 0}`} onClick={() => setDraft((d) => ({ ...d, [id]: ((d[id] || 0) + 1) % 4 }))}>
                    <span>{label}</span><span className="dots" aria-hidden="true">{sevDots(draft[id] || 0)}</span>
                  </button>
                ))}
              </div>
              {scaleSection}
              {bodySection}
              <div className="kickrow">
                <button className="cta" style={{ flex: 1 }} onClick={() => { setKicks((k) => k + 1); }}>Kick! 👣</button>
                <div className="kickcount"><b>{kicks}</b><span>kicks today</span></div>
              </div>
              {draft.swl >= 2 ? (
                <Advice urgency="now">Sudden or severe swelling — especially with headaches or vision changes — is a call-your-provider-today signal, not a wait-and-see one.</Advice>
              ) : (
                <Advice urgency="self">Logging daily builds the record your provider actually uses at each visit — and the kick pattern matters more than any single count.</Advice>
              )}
              <button className="cta" style={{ marginTop: 12 }} onClick={() => {
                setPregLog((l) => ({ ...l, [todayIso]: { sym: { ...draft }, kicks, scales: { ...scales } } }));
                ping("Saved to your pregnancy journal — see Calendar");
              }}>Save today</button>
            </main>
              )}

              {pregTab === "cal" && (
                <main>
                  <h1 className="disp">{new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h1>
                  <p className="hint">Week markers, your logged days, and the road to your due date — {new Date(Date.now() + (40 - pregWeek) * 7 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.</p>
                  <div className="calgrid">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="calhead">{d}</div>)}
                    {(() => {
                      const now = new Date(); now.setHours(12, 0, 0, 0);
                      const first = new Date(now.getFullYear(), now.getMonth(), 1);
                      const cells = [];
                      for (let i = 0; i < first.getDay(); i++) cells.push(<div key={"e" + i} />);
                      const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                      for (let dnum = 1; dnum <= dim; dnum++) {
                        const d = new Date(now.getFullYear(), now.getMonth(), dnum, 12);
                        const iso = d.toISOString().slice(0, 10);
                        const diff = Math.round((d - now) / 86400000);
                        const wk = pregWeek + Math.floor(diff / 7);
                        const wkStart = ((diff % 7) + 7) % 7 === 0;
                        const logged = pregLog[iso];
                        cells.push(
                          <button key={iso} style={logged && dayScore(logged, Object.keys(GSYM)) != null ? { background: scoreColor(dayScore(logged, Object.keys(GSYM))), borderColor: scoreColor(dayScore(logged, Object.keys(GSYM))), color: dayScore(logged, Object.keys(GSYM)) > 0.3 ? "#1A1A1A" : "#FFFFFF", fontWeight: 700 } : {}} className={`calcell ${wkStart ? "c-wk" : ""} ${iso === todayIso ? "c-today" : ""}`} onClick={() => setPregSel(iso)}>
                            {dnum}
                            {wkStart && wk >= 1 && wk <= 40 && <span className="c-wklab">w{wk}</span>}
                            {logged && <span className="c-log" />}
                          </button>
                        );
                      }
                      return cells;
                    })()}
                  </div>
                  <div className="callegend">
                    <span><i className="dot d-fert" /> week starts</span><span><i className="dot d-logdot" /> logged day</span>
                  </div>
                  {pregSel && (() => {
                    const e = pregLog[pregSel];
                    return (
                      <div className="card" style={{ display: "block", marginBottom: 12 }}>
                        <b>{fmt(pregSel)}</b>
                        {e ? (
                          <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.6 }}>
                            {Object.entries(e.sym).filter(([, v]) => v > 0).map(([id, v]) => `${GSYM[id]} ${"●".repeat(v)}`).join(" · ") || "No symptoms"} · {e.kicks} kicks
                          </p>
                        ) : (
                          <p className="hint" style={{ margin: "6px 0 0" }}>Nothing logged this day.</p>
                        )}
                        <div className="sfoot" style={{ marginTop: 10 }}>
                          {e ? <button className="sbtn" onClick={() => { setDraft({ ...e.sym }); setKicks(e.kicks); setPregSel(null); setPregTab("today"); ping(`Editing ${fmt(pregSel)} — save to update`); }}>Edit</button> : <span />}
                          <button className="sbtn" onClick={() => setPregSel(null)}>Close</button>
                        </div>
                      </div>
                    );
                  })()}
                </main>
              )}

              {pregTab === "mile" && (
                <main>
                  <h1 className="disp">Your care roadmap</h1>
                  <p className="hint">The standard evidence-based prenatal schedule for a low-risk pregnancy (ACOG-style), positioned against your week {pregWeek}. Your provider's plan always wins — risk factors change the schedule.</p>
                  <div className="card" style={{ display: "block" }}>
                    <p className="rsec" style={{ margin: "0 0 4px" }}>Visit rhythm</p>
                    <p style={{ fontSize: 12.5, lineHeight: 1.6 }}>Every 4 weeks until 28 · every 2 weeks from 28–36 · weekly from 36. Every visit: blood pressure, urine check, fundal height, and baby's heartbeat — BP is how preeclampsia gets caught early.</p>
                  </div>
                  {(() => {
                    const M = [
                      { tri: "First trimester", items: [
                        { w: "8–10", from: 8, to: 10, label: "Initial visit + full labs", note: "Blood type & Rh, antibody screen, blood count, immunity (rubella, varicella), hepatitis B & C, HIV, syphilis, urine culture, gonorrhea/chlamydia." },
                        { w: "8–12", from: 8, to: 12, label: "Dating ultrasound", note: "Confirms due date — the anchor for everything after." },
                        { w: "10+", from: 10, to: 13, label: "Genetic screening (NIPT)", note: "Cell-free DNA from week 10, or combined nuchal scan at 11–13. Optional, your call." },
                        { w: "any", from: 0, to: 13, label: "Folate + vaccines", note: "Prenatal vitamin with folate; flu and COVID vaccines recommended in any trimester." },
                      ]},
                      { tri: "Second trimester", items: [
                        { w: "15–20", from: 15, to: 20, label: "Serum screen (if no NIPT)", note: "The quad screen window, for those who skipped cell-free DNA." },
                        { w: "18–22", from: 18, to: 22, label: "Anatomy scan", note: "The big ultrasound — organs, growth, placenta position." },
                        { w: "24–28", from: 24, to: 28, label: "Glucose screening", note: "One-hour 50g screen for gestational diabetes; repeat blood count for anemia rides along." },
                        { w: "27–36", from: 27, to: 36, label: "Tdap vaccine", note: "Every pregnancy — it's how baby gets whooping-cough protection before their own shots." },
                        { w: "28", from: 28, to: 28, label: "RhoGAM (if Rh-negative)", note: "Only applies if your blood type is Rh-negative — your week-8 labs answered that." },
                      ]},
                      { tri: "Third trimester", items: [
                        { w: "28+", from: 28, to: 40, label: "Daily kick awareness", note: "From 28 weeks, the movement pattern matters — a real change in the pattern is a call-today, not a wait." },
                        { w: "32–36", from: 32, to: 36, label: "RSV vaccine (seasonal)", note: "Given Sept–Jan in the US to protect baby's first RSV season." },
                        { w: "36–37", from: 36, to: 37, label: "GBS swab", note: "Quick routine test; a positive just means antibiotics in labor." },
                        { w: "36", from: 36, to: 40, label: "Position check + weekly visits", note: "Baby's position confirmed; cadence steps up to weekly." },
                        { w: "41", from: 41, to: 42, label: "Post-dates monitoring", note: "Extra monitoring from 41 weeks; induction offered by 41–42 — evidence favors not going far past." },
                      ]},
                      { tri: "After birth", items: [
                        { w: "<3wk", from: 43, to: 99, label: "Early postpartum contact", note: "Within 3 weeks of delivery — mood, feeding, recovery, blood pressure." },
                        { w: "≤12wk", from: 43, to: 99, label: "Comprehensive postpartum visit", note: "The full check by 12 weeks. Postpartum care is care, not a formality." },
                      ]},
                    ];
                    return M.map((g) => (
                      <div key={g.tri}>
                        <p className="rsec" style={{ marginTop: 14 }}>{g.tri}</p>
                        {g.items.map((m) => {
                          const done = pregWeek > m.to;
                          const now = pregWeek >= m.from && pregWeek <= m.to;
                          const soon = !done && !now && m.from - pregWeek > 0 && m.from - pregWeek <= 4;
                          return (
                            <div className="shelfc" key={m.label} style={done ? { opacity: 0.55 } : {}}>
                              <div className="shead"><span className="sbrand">Weeks {m.w}</span>
                                <span className="ppill" style={now ? { borderColor: "#A04545", color: "#A04545" } : soon ? { borderColor: "var(--primary)", color: "var(--primary)" } : {}}>{done ? "done ✓" : now ? "in window" : soon ? "coming up" : "later"}</span></div>
                              <div className="sname">{m.label}</div>
                              <p className="hint" style={{ margin: 0 }}>{m.note}</p>
                            </div>
                          );
                        })}
                      </div>
                    ));
                  })()}
                  <Advice urgency="visit">You're at week {pregWeek}: the glucose screen window opens at 24 — ask to get it scheduled at your next visit, and Tdap can ride along from week 27.</Advice>
                  <p className="rfoot">Educational schedule, not medical advice. Twins, chronic conditions, or prior complications all change it — your provider sets your actual plan.</p>
                </main>
              )}
              {pregTab === "ask" && askView}
              {pregTab === "connect" && connView}
              {pregTab === "home" && homeView}
            </>
          ) : (
            <>
              <nav className="tabs" role="tablist" aria-label="Sections">
                {[["home", "Home"], ["today", "Today"], ["cal", "Calendar"], ["patterns", "Patterns"], ["connect", "Connect"], ["report", "Report"], ["shelf", "Care"], ["ask", "Ask"]].map(([id, l]) => (
                  <button key={id} role="tab" aria-selected={appTab === id} className={`tab ${appTab === id ? "tab-on" : ""}`} onClick={() => setAppTab(id)}>{l}</button>
                ))}
              </nav>

              {appTab === "today" && (
                <main>
                  {pred && (
                    <div className="phasecard">
                      <div className="phaseday">Day {pred.cycleDay}</div>
                      <div className="phaseinfo">
                        <b>{pred.phase[0].toUpperCase() + pred.phase.slice(1)} phase</b>
                        <span>{pred.late > 0 ? `Period ${pred.late} days past the ${pred.avgLen}-day average${stage === "peri" ? " — with your spread, irregularity is data too." : "."}` : `Period expected in ~${pred.daysTo} days (avg ${pred.avgLen}d).`}</span>
                      </div>
                    </div>
                  )}
                  {welcome && <div className="readcard" style={{ marginTop: 0, marginBottom: 14 }}><p className="hint" style={{ margin: 0 }}>{welcome}</p></div>}
              {editDate && (
                <div className="card" style={{ display: "block", marginBottom: 12 }}>
                  <p><b>Editing {fmt(editDate)}</b> — changes save to that day. <button className="linkbtn" onClick={() => { setEditDate(null); setDraft({}); setSleepQ(null); }}>Back to today</button></p>
                </div>
              )}
              <h1 className="disp">{editDate ? `Fixing up ${fmt(editDate)}` : stage === "periods" ? "Hey — how's today?" : "How was today, honestly?"}</h1>
                  <p className="hint">Tap what showed up (up to 3× for strong). Takes 30 seconds, promise.</p>
                  {scoreMeter}
                  {quickMode && !editDate && quickCheckin}
                  {(!quickMode || editDate) && <div className="chips">
                    {symIds.map((id) => (
                      <button key={id} aria-pressed={(draft[id] || 0) > 0} aria-label={`${(symMap[id] || label)}, severity ${draft[id] || 0} of 3`} className={`chip sev-${draft[id] || 0}`} onClick={() => setDraft((d) => ({ ...d, [id]: ((d[id] || 0) + 1) % 4 }))}>
                        <span>{symMap[id]}</span><span className="dots" aria-hidden="true">{sevDots(draft[id] || 0)}</span>
                      </button>
                    ))}
                  </div>}
                  <div className="row">
                    {[["good", "Slept well"], ["fair", "So-so"], ["poor", "Rough night"]].map(([id, l]) => (
                      <button key={id} aria-pressed={sleepQ === id} className={`pill ${sleepQ === id ? "pill-on" : ""}`} onClick={() => setSleepQ(id)}>{l}</button>
                    ))}
                  </div>
                  {(!quickMode || editDate) && scaleSection}
                  {(!quickMode || editDate) && bodySection}
                  <button className="cta" onClick={() => {
                    const target = editDate || todayIso;
                    const quickMap = stage === "periods" ? { q1: "crm", q2: "eng", q3: "mood" } : { q1: "hf", q2: "slp", q3: "fog" };
                    const mapped = { ...draft };
                    if (quickMode && !editDate) { Object.entries(quickMap).forEach(([q, sid]) => { if (draft[q] != null) mapped[sid] = draft[q]; }); if (mapped.q1 != null) mapped.fat = mapped.q2; }
                    ["q1", "q2", "q3"].forEach((k) => delete mapped[k]);
                    setDays((d) => [...d.filter((x) => x.date !== target), { date: target, sleepQ: sleepQ || "fair", period: editDate ? editPeriod : false, scales: { ...scales }, flow, disch, odor, sym: { ...Object.fromEntries([...SYMS, ...Object.keys(PSYM)].map((k) => [k, 0])), ...mapped } }].sort((a, b) => a.date.localeCompare(b.date)));
                    ping(editDate ? `${fmt(target)} updated` : "Saved — check Patterns");
                    if (editDate) { setEditDate(null); setDraft({}); setSleepQ(null); setAppTab("cal"); } else setAppTab("patterns");
                  }}>{editDate ? `Save changes to ${fmt(editDate)}` : "Save today's check-in"}</button>
                  {pred && (
                    <div className="readcard">
                      <div className="rsec" style={{ margin: "0 0 4px" }}>Today's read · {pred.phase} phase</div>
                      <div className="sname">{READS[pred.phase][0]}</div>
                      <p className="hint" style={{ margin: "4px 0 0" }}>{READS[pred.phase][1]}</p>
                    </div>
                  )}
                </main>
              )}

              {appTab === "cal" && pred && (
                <main>
                  <h1 className="disp">{new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h1>
                  <p className="hint">Logged periods, predictions, and the estimated fertile window — with honest uncertainty.</p>
                  <div className="calgrid">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="calhead">{d}</div>)}
                    {(() => {
                      const now = new Date();
                      const first = new Date(now.getFullYear(), now.getMonth(), 1);
                      const cells = [];
                      for (let i = 0; i < first.getDay(); i++) cells.push(<div key={"e" + i} />);
                      const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                      for (let dnum = 1; dnum <= dim; dnum++) {
                        const d = new Date(now.getFullYear(), now.getMonth(), dnum, 12);
                        const iso = d.toISOString().slice(0, 10);
                        const logged = days.find((x) => x.date === iso && x.period);
                        const predP = inRange(d, pred.nextStart, new Date(pred.nextStart.getTime() + 4 * 86400000));
                        const fert = inRange(d, pred.fertileFrom, pred.fertileTo);
                        const entry = days.find((x) => x.date === iso);
                        const sc = dayScore(entry, symIds);
                        const tint = sc != null ? { background: scoreColor(sc), borderColor: scoreColor(sc), color: sc > 0.3 ? "#1A1A1A" : "#FFFFFF", fontWeight: 700 } : {};
                        cells.push(<button key={iso} style={tint} className={`calcell ${sc == null && logged ? "c-period" : sc == null && predP ? "c-pred" : sc == null && fert ? "c-fert" : ""} ${iso === todayIso ? "c-today" : ""}`} onClick={() => setSelDay(iso)}>{dnum}{logged && <span className="c-per-mark" />}</button>);
                      }
                      return cells;
                    })()}
                  </div>
                  <div className="callegend">
                    <span><i className="dot d-pred" /> predicted</span><span><i className="dot d-fert" /> fertile (est.)</span><span><i className="dot d-permark" /> period</span>
                  </div>
                  <div className="gradlegend">
                    <span>rough day</span>
                    <span className="gradbar" style={{ background: `linear-gradient(90deg, ${scoreColor(0)}, ${scoreColor(0.5)}, ${scoreColor(1)})` }} />
                    <span>great day</span>
                  </div>
                  {selDay && (() => {
                    const e = days.find((x) => x.date === selDay);
                    const loggedSyms = e ? symIds.filter((id) => (e.sym[id] || 0) > 0) : [];
                    return (
                      <div className="card" style={{ display: "block", marginBottom: 12 }}>
                        <b>{fmt(selDay)}</b>{e && dayScore(e, symIds) != null && <span className="scorepill" style={{ background: scoreColor(dayScore(e, symIds)), color: dayScore(e, symIds) > 0.3 ? "#1A1A1A" : "#FFFFFF" }}>{scoreLabel(dayScore(e, symIds))} · {Math.round(dayScore(e, symIds) * 100)}</span>}
                        {e ? (
                          <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.6 }}>
                            {loggedSyms.length ? loggedSyms.map((id) => `${symMap[id]} ${"●".repeat(e.sym[id])}`).join(" · ") : "No symptoms"}
                            {e.period ? " · Period" : ""} · Sleep: {e.sleepQ}
                          </p>
                        ) : (
                          <p className="hint" style={{ margin: "6px 0 0" }}>Nothing logged this day.</p>
                        )}
                        <div className="sfoot" style={{ marginTop: 10 }}>
                          {e ? <button className="sbtn" onClick={() => {
                            setDraft(Object.fromEntries(symIds.map((id) => [id, e.sym[id] || 0])));
                            setSleepQ(e.sleepQ); setEditPeriod(!!e.period);
                            setEditDate(selDay); setSelDay(null); setAppTab("today");
                          }}>Edit this day</button> : <span />}
                          <button className="sbtn" onClick={() => setSelDay(null)}>Close</button>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="card"><div className="num">±{Math.max(2, Math.round((ins.variability || 4) / 2))}d</div><p>Confidence given your recent cycles ({ins.lens.join(" · ")}d). Estimates — not contraception. Tap any day to see or edit what you logged.</p></div>
                </main>
              )}

              {appTab === "patterns" && (
                <main>
                  <h1 className="disp">Your last 60 days</h1>
                  <div className="stripes" role="img" aria-label="Sixty daily stripes colored from calm to heavy; a dot marks period days">
                    {ins.sorted.slice(-60).map((d) => (
                      <div key={d.date} className="scol" title={fmt(d.date)}>
                        <div className="stripe" style={{ background: stripeColor(loadOf(d, symIds), ramp().rough, ramp().good, ramp().mid) }} />
                        <div className={`sdot ${d.period ? "on" : ""}`} />
                      </div>
                    ))}
                  </div>
                  <div className="legend"><span>calm</span><span className="lbar" style={{ background: `linear-gradient(90deg,${scoreColor(1)},${scoreColor(0.5)},${scoreColor(0)})` }} /><span>heavy</span><span className="lper">· period</span></div>

                  {stage === "peri" && ins.variability != null && (
                    <div className="icard">
                      <div className="card" style={{ marginBottom: 0 }}><div className="num">{ins.variability}d</div><p>Cycles ran {ins.lens.join(" · ")} days — a 7+ day spread is the clinical marker of the transition (STRAW staging).</p></div>
                      <Advice urgency="visit">Start the treatment conversation early — and ask about a lipid panel and bone-health baseline; the transition is when both start shifting.</Advice>
                    </div>
                  )}
                  {stage === "peri" && ins.hfMult && (
                    <div className="icard">
                      <div className="card" style={{ marginBottom: 0 }}><div className="num">{ins.hfMult.toFixed(1)}×</div><p>Hot flashes were {ins.hfMult.toFixed(1)}× more likely after a rough night.</p></div>
                      <Advice urgency="visit">This frequency is treatable: ask about hormone-therapy eligibility — and if that's not for you, SSRIs or the newer NK3-antagonist class are options to discuss.</Advice>
                    </div>
                  )}
                  {stage === "periods" && (
                    <div className="icard">
                      <div className="card" style={{ marginBottom: 0 }}><div className="num">{ins.counts[0].days}/30</div><p>{ins.counts[0].label} showed up most — {ins.counts[0].days} of your last 30 days.</p></div>
                      <Advice urgency={ins.counts[0].id === "crm" && ins.counts[0].strong > 8 ? "visit" : "self"}>
                        {ins.counts[0].id === "crm"
                          ? ins.counts[0].strong > 8
                            ? "Pain that strong, that often, isn't something to just push through — it's worth a proper look (endometriosis takes years to diagnose largely because people are told it's normal)."
                            : "Continuous low-level heat and well-timed anti-inflammatories both have real evidence for cramps."
                          : "Track it against your calendar — if it clusters in the week before your period, that's a PMS pattern you can plan around."}
                      </Advice>
                    </div>
                  )}
                  {medEffects.filter((e) => e.ready).map((e) => (
                    <div className="icard" key={e.id}>
                      <div className="card" style={{ marginBottom: 0 }}><div className="num">{e.before}→{e.after}</div><p>Average day score in the two weeks before vs after starting <b>{e.name}</b>. {e.after - e.before >= 5 ? "That's a real shift." : e.after - e.before <= -5 ? "Days got harder — worth mentioning to whoever prescribed it." : "Too early to call; keep logging."}</p></div>
                      <Advice urgency="visit">Bring this before/after to your next visit — it's exactly the evidence a clinician needs to decide whether to continue, adjust, or stop.</Advice>
                    </div>
                  ))}
                  <div className="bars">
                    {ins.counts.map((c) => (
                      <div key={c.id} className="brow"><span className="blab">{c.label}</span><div className="btrack"><div className="bfill" style={{ width: `${(c.days / 30) * 100}%`, background: `linear-gradient(90deg,${scoreColor(0.62)},${scoreColor(Math.max(0, 0.55 - (c.days / 30) * 0.55))})` }} /></div><span className="bval">{c.days}</span></div>
                    ))}
                  </div>
                </main>
              )}

              {appTab === "report" && (
                <main>
                  <h1 className="disp">What to tell your doctor</h1>
                  <p className="hint">Appointments are short. This turns {ins.total || 30} days of what you felt into a few clear sentences — so "I just haven't felt right" becomes something your doctor can actually work with.</p>

                  <p className="rsec">1 · What stands out</p>
                  {(() => {
                    const top = ins.counts.filter((c) => c.days > 0).slice(0, 3);
                    const pct = (d) => Math.round((d / Math.max(1, ins.last30.length)) * 100);
                    const inWords = (d) => {
                      const p = pct(d);
                      if (p >= 80) return "nearly every day";
                      if (p >= 60) return "most days";
                      if (p >= 40) return "about half the days";
                      if (p >= 20) return "a few days a week";
                      return "now and then";
                    };
                    return (
                      <div className="plaincard">
                        {top.length === 0 ? (
                          <p className="plain">You haven't logged much yet. A week or two of check-ins is enough to start seeing something real.</p>
                        ) : top.map((c) => (
                          <p className="plain" key={c.id}>
                            <b>{c.label}</b> showed up <b>{inWords(c.days)}</b> — {c.days} of your last {ins.last30.length} days
                            {c.strong > 0 ? `, and ${c.strong} of those were moderate or strong` : ""}.
                          </p>
                        ))}
                        {ins.variability != null && (
                          <p className="plain">
                            <b>Your periods came {ins.variability >= 7 ? "at quite different times" : "fairly steadily"}</b> — {ins.lens.join(", ")} days apart. Doctors call that a {ins.variability}-day spread.
                          </p>
                        )}
                        {stage === "peri" && ins.hfMult && ins.hfMult > 1.2 && (
                          <p className="plain">
                            <b>Bad nights made the next day worse.</b> After a rough night's sleep, hot flashes were about {ins.hfMult.toFixed(1)} times more likely.
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  <p className="rsec">2 · What this might mean</p>
                  <div className="plaincard">
                    {stage === "peri" && ins.variability != null && ins.variability >= 7 && (
                      <p className="plain">Periods that vary by a week or more are one of the clearest signs the menopause transition has started. That's not a diagnosis — but it's the exact thing doctors look at, and it usually means this is a years-long change worth planning for, not a random bad month.</p>
                    )}
                    {stage === "peri" && ins.counts.find((c) => (c.id === "hf" || c.id === "ns") && c.days >= 8) && (
                      <p className="plain">Hot flashes and night sweats this often are <b>treatable</b> — this is the single most fixable thing on your list. Most women are never offered treatment simply because it never gets discussed.</p>
                    )}
                    {ins.counts.find((c) => c.id === "slp" && c.days >= 8) && (
                      <p className="plain">Sleep that's disrupted this often is worth treating on its own, not just waiting out. Poor sleep tends to make every other symptom louder, so fixing it often improves several things at once.</p>
                    )}
                    {stage === "periods" && ins.counts.find((c) => c.id === "crm" && c.strong >= 6) && (
                      <p className="plain">Pain this strong, this often, isn't something to just get through. Period pain that regularly stops you has causes that are diagnosable and treatable — it often goes unaddressed for years because people are told it's normal.</p>
                    )}
                    <p className="plain">These are patterns in what you logged — observations, not a diagnosis. Only your doctor can say what's causing them.</p>
                  </div>

                  <p className="rsec">3 · What to say out loud</p>
                  <p className="hint" style={{ marginBottom: 10 }}>Read these word for word if it helps. Knowing the question is half of getting a real answer.</p>
                  <div className="plaincard">
                    {ins.counts.filter((c) => c.days > 0).slice(0, 1).map((c) => (
                      <p className="script" key={c.id}>“I've tracked this daily. {c.label} happened {c.days} out of {ins.last30.length} days. What could be causing it?”</p>
                    ))}
                    {ins.variability != null && ins.variability >= 7 && (
                      <p className="script">“My cycles have ranged from {Math.min(...ins.lens)} to {Math.max(...ins.lens)} days. Could I be in perimenopause, and what does that mean for me?”</p>
                    )}
                    {stage === "peri" && (
                      <p className="script">“Am I a candidate for hormone therapy? If not, what non-hormonal options would you consider?”</p>
                    )}
                    {ins.counts.find((c) => c.days >= 8) && (
                      <p className="script">“Could we check my thyroid, iron levels, and vitamin D? I've read those can cause symptoms like mine.”</p>
                    )}
                    <p className="script">“If we try something, how will we know in a few months whether it's working?”</p>
                  </div>

                  <p className="rsec">4 · Send it ahead</p>
                  <p className="hint" style={{ marginBottom: 10 }}>A short email your doctor can read in twenty seconds — nothing to log into on their end.</p>
                  <div className="routes">
                    <button className="route" onClick={() => { const e = buildEmail(); window.open(`mailto:?subject=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(e.body)}`); ping("Opening your email app…"); }}>Open in email<span>pre-filled draft</span></button>
                    <button className="route" onClick={() => { const e = buildEmail(); const txt = `Subject: ${e.subject}\n\n${e.body}`; if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(() => ping("Email copied — paste anywhere"), () => ping("Copy blocked — long-press the preview")); }}>Copy email<span>paste anywhere</span></button>
                  </div>

                  <button className="disclosure" style={{ marginTop: 14 }} onClick={() => setShowTable((v) => !v)}>
                    <span>The numbers behind this</span><span>{showTable ? "−" : "+"}</span>
                  </button>
                  {showTable && (
                    <div className="bodypanel">
                      <div className="rtitle" style={{ fontSize: 15, marginTop: 10 }}>Symptom log <span className="rmeta">{stageName} · {fmt(ins.last30[0].date)}–{fmt(ins.last30[ins.last30.length - 1].date)}</span></div>
                      <table className="rtab"><thead><tr><th>Symptom</th><th>Days</th><th>Mod.–strong</th></tr></thead>
                        <tbody>{ins.counts.map((c) => <tr key={c.id}><td>{c.label}</td><td>{c.days}/{ins.last30.length}</td><td>{c.strong}</td></tr>)}</tbody></table>
                      {ins.variability != null && <p className="rfoot">Cycle lengths: {ins.lens.join(", ")} days ({ins.variability}-day spread).</p>}
                      <p className="rfoot">Logged daily by you. Observations, not diagnoses.</p>
                    </div>
                  )}
                </main>
              )}

              {appTab === "shelf" && (
                <main>
                  <h1 className="disp">Care & support</h1>
                  <p className="hint">Clinicians and products matched to what you’ve actually logged — matching runs on your device, so partners never see your data. Cyra earns a commission when you use these, and every label below is the honest state of the evidence, including when something is comfort rather than treatment.</p>
                  {shelfItems.map((s) => {
                    const top = ins.counts.find((c) => s.m.includes(c.id));
                    return (
                      <div className="shelfc" key={s.id}>
                        <div className="shead"><span className="sbrand">{s.brand}</span><span className="ppill">Partner</span></div>
                        <div className="sname">{s.name}</div>
                        {top && top.days > 0 && <div className="smatch">Matched: {top.label.toLowerCase()} ({top.days}/30)</div>}
                        <span className={`ev ev-${s.tone}`}>{s.ev}</span>
                        <div className="sfoot"><b>{s.price}</b><button className="sbtn" onClick={() => ping("Opens partner site in shipped app")}>View with partner</button></div>
                      </div>
                    );
                  })}
                </main>
              )}
              {appTab === "ask" && askView}
              {appTab === "connect" && connView}
              {appTab === "home" && homeView}
            </>
          )}
        </div>
      )}

      <div className="toast" role="status" aria-live="polite" style={toast ? {} : { display: "none" }}>{toast}</div>
    </div>
  );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,440;9..144,600&family=Karla:wght@400;500;700&display=swap');
.cy { background:var(--paper); color:var(--ink); font-family:'Karla',sans-serif; min-height:100vh; max-width:430px; margin:0 auto; padding:18px 16px 48px; box-sizing:border-box; transition:background .35s; }
.cy * { box-sizing:border-box; }
.mast { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
.mark { font-family:'Fraunces',serif; font-weight:600; font-size:24px; }
.sub { font-size:10px; font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:var(--primary); margin-left:7px; vertical-align:3px; }
.orgsel { display:flex; gap:4px; background:var(--card); border:1px solid var(--line); border-radius:999px; padding:3px; }
.orgbtn { border:none; background:none; border-radius:999px; padding:5px 12px; font:700 11.5px 'Karla'; color:var(--soft); cursor:pointer; }
.orgbtn.on { background:var(--primary); color:#FFF; }
.topnav { display:flex; gap:4px; margin-bottom:12px; }
.topbtn { flex:1; border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:8px 1px; font:700 11px 'Karla'; color:var(--ink); cursor:pointer; }
.topbtn.on { background:var(--primary); border-color:var(--primary); color:#FFF; }
.stagebar { display:flex; gap:7px; margin-bottom:14px; }
.stagesel { flex:1; display:flex; flex-direction:column; gap:1px; align-items:flex-start; border:1px solid var(--line); background:var(--card); border-radius:12px; padding:9px 11px; cursor:pointer; font-family:'Karla'; }
.stagesel b { font-size:13px; color:var(--ink); } .stagesel span { font-size:10.5px; color:var(--soft); }
.stagesel.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 8%, var(--card)); }
.stagesel.on b { color:var(--primary); }
.tabs { display:flex; gap:1px; border-bottom:2px solid var(--line); margin-bottom:16px; overflow-x:auto; scrollbar-width:none; -webkit-overflow-scrolling:touch; }
.tabs::-webkit-scrollbar { display:none; }
.tab { flex-shrink:0; }
.tab { background:none; border:none; border-bottom:3px solid transparent; padding:7px 8px 9px; font:700 13px 'Karla'; color:var(--soft); cursor:pointer; }
.tab-on { color:var(--ink); border-bottom-color:var(--primary); }
.disp { font-family:'Fraunces',serif; font-weight:440; font-size:25px; line-height:1.14; margin:0 0 8px; }
.hint { font-size:13.5px; line-height:1.55; color:var(--soft); margin:0 0 16px; }
.chips { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-bottom:16px; }
.chip { border:1.5px solid var(--line); background:var(--card); box-shadow:0 1px 2px rgba(0,0,0,.04); border-radius:13px; padding:11px; text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:5px; font-size:13.5px; color:var(--ink); }
.dots { font-size:10px; letter-spacing:3px; color:var(--soft); }
.chip.sev-1, .chip.sev-2 { border-color:var(--accent); background:color-mix(in srgb, var(--accent) 14%, var(--card)); }
.chip.sev-3 { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 12%, var(--card)); }
.row { display:flex; gap:8px; margin-bottom:16px; }
.pill { flex:1; border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:9px 4px; font:500 13px 'Karla'; color:var(--ink); cursor:pointer; }
.pill-on { border-color:#7E9B87; background:#E7EFE9; }
.cta { width:100%; border:none; border-radius:13px; background:var(--primary); color:#FFF; font:700 14px 'Karla'; padding:14px; cursor:pointer; }
.cta:disabled { opacity:.6; }
.stripes { display:flex; height:88px; border-radius:10px; overflow:hidden; margin-bottom:6px; }
.scol { flex:1; display:flex; flex-direction:column; } .stripe { flex:1; } .sdot { height:5px; } .sdot.on { background:var(--primary); }
.legend { display:flex; align-items:center; gap:8px; font-size:11px; color:var(--soft); margin-bottom:16px; }
.lbar { flex:1; height:5px; border-radius:3px; } .lper { color:var(--primary); font-weight:700; }
.card { background:var(--card); border:1.5px solid var(--line); box-shadow:0 1px 2px rgba(0,0,0,.04); border-radius:13px; padding:13px 15px; display:flex; gap:13px; align-items:baseline; margin-bottom:10px; }
.num { font-family:'Fraunces',serif; font-weight:600; font-size:23px; color:var(--primary); min-width:56px; }
.card p { margin:0; font-size:13px; line-height:1.5; }
.icard { margin-bottom:12px; }
.advice { display:flex; gap:9px; align-items:flex-start; background:color-mix(in srgb, var(--primary) 10%, var(--card)); border:1.5px solid var(--line); border-top:none; border-radius:0 0 13px 13px; padding:10px 15px; }
.uchip { flex-shrink:0; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; border-radius:999px; padding:3px 9px; }
.u-now { background:#F3DBDB; color:#A04545; } .u-visit { background:color-mix(in srgb, var(--primary) 16%, var(--card)); color:var(--primary); } .u-self { background:#E7EFE9; color:#43604F; }
.atext { font-size:12.5px; line-height:1.5; }
.bars { display:grid; gap:8px; margin-top:6px; }
.brow { display:grid; grid-template-columns:108px 1fr 24px; align-items:center; gap:9px; }
.blab { font-size:12px; } .btrack { height:10px; background:color-mix(in srgb, var(--ink) 14%, var(--card)); border-radius:5px; overflow:hidden; }
.bfill { height:100%; } .bval { font-size:11.5px; color:var(--soft); text-align:right; }
.rep { background:var(--card); border:1.5px solid var(--line); box-shadow:0 1px 2px rgba(0,0,0,.04); border-radius:13px; padding:15px; margin-bottom:12px; }
.rtitle { font-family:'Fraunces',serif; font-weight:600; font-size:17px; margin-bottom:10px; }
.rmeta { display:block; font-size:11.5px; font-weight:400; color:var(--soft); margin-top:2px; font-family:'Karla'; }
.rtab { width:100%; border-collapse:collapse; font-size:12.5px; }
.rtab th { text-align:left; font-size:11px; color:var(--soft); padding:3px 0; }
.rtab td { padding:5px 0; border-top:1px solid var(--line); }
.rsec { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.09em; color:var(--soft); margin:12px 0 6px; }
.rlist { margin:0; padding-left:17px; font-size:12.5px; line-height:1.6; } .rfoot { font-size:11.5px; color:var(--soft); margin:12px 0 0; line-height:1.5; }
.routes { display:flex; gap:8px; }
.route { flex:1; display:flex; flex-direction:column; gap:2px; border:1px solid var(--primary); background:var(--card); color:var(--primary); border-radius:12px; padding:11px 8px; font:700 12px 'Karla'; cursor:pointer; }
.route span { font-weight:500; font-size:10.5px; color:var(--soft); }
.shelfc { background:var(--card); border:1.5px solid var(--line); box-shadow:0 1px 2px rgba(0,0,0,.04); border-radius:13px; padding:14px; margin-bottom:10px; }
.shead { display:flex; justify-content:space-between; margin-bottom:3px; }
.sbrand { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--soft); }
.ppill { font-size:10px; font-weight:700; text-transform:uppercase; border:1px solid var(--line); border-radius:999px; padding:2px 8px; color:var(--soft); }
.sname { font-family:'Fraunces',serif; font-weight:600; font-size:15.5px; margin-bottom:3px; }
.smatch { font-size:11.5px; color:var(--primary); font-weight:700; margin-bottom:5px; }
.ev { display:inline-block; font-size:10.5px; font-weight:700; border-radius:999px; padding:3px 9px; margin-bottom:8px; }
.ev-strong { background:#E7EFE9; color:#43604F; } .ev-mixed { background:#FBEEE2; color:#A15E22; } .ev-comfort { background:#EDE7EF; color:#6E6076; }
.sfoot { display:flex; justify-content:space-between; align-items:center; font-size:13px; gap:8px; }
.sbtn { border:1px solid var(--primary); background:none; color:var(--primary); border-radius:999px; padding:7px 14px; font:700 12px 'Karla'; cursor:pointer; }
.loglines { background:var(--card); border:1.5px solid var(--line); border-radius:13px; padding:12px; font-family:ui-monospace,monospace; font-size:11px; line-height:1.7; }
.logline.money { color:#43604F; font-weight:700; } .logline.bad { color:#A04545; font-weight:700; }
.swatches { display:flex; gap:6px; margin-top:8px; }
.swatch { width:22px; height:22px; border-radius:6px; border:1px solid var(--line); }
.phasecard { display:flex; gap:14px; align-items:center; background:var(--card); border:1.5px solid var(--line); box-shadow:0 1px 2px rgba(0,0,0,.04); border-radius:13px; padding:13px 15px; margin-bottom:14px; }
.phaseday { font-family:'Fraunces',serif; font-weight:600; font-size:21px; color:var(--primary); white-space:nowrap; }
.phaseinfo { display:flex; flex-direction:column; gap:2px; font-size:13px; }
.phaseinfo span { color:var(--soft); font-size:12.5px; line-height:1.45; }
.readcard { background:color-mix(in srgb, var(--primary) 10%, var(--card)); border:1.5px solid color-mix(in srgb, var(--primary) 25%, var(--line)); border-radius:13px; padding:14px; margin-top:14px; }
.calgrid { display:grid; grid-template-columns:repeat(7,1fr); gap:5px; margin-bottom:10px; }
.calhead { text-align:center; font-size:10.5px; font-weight:700; color:var(--soft); padding:2px 0; }
.calcell { position:relative; aspect-ratio:1; display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:600; border-radius:10px; background:var(--card); border:1.5px solid var(--line); color:var(--ink); cursor:pointer; }
.c-period { background:var(--primary); border-color:var(--primary); color:#FFF; font-weight:700; }
.c-pred { background:color-mix(in srgb, var(--primary) 18%, var(--card)); border-style:dashed; border-color:var(--primary); color:var(--primary); font-weight:700; }
.c-fert { background:color-mix(in srgb, var(--accent) 22%, var(--card)); border-color:var(--accent); }
.c-today { outline:2px solid var(--ink); outline-offset:1px; }
.callegend { display:flex; flex-wrap:wrap; gap:10px; font-size:11.5px; color:var(--soft); margin-bottom:12px; }
.callegend .dot { display:inline-block; width:10px; height:10px; border-radius:3px; margin-right:4px; vertical-align:-1px; }
.d-period { background:var(--primary); } .d-pred { background:color-mix(in srgb, var(--primary) 25%, var(--card)); border:1px dashed var(--primary); } .d-fert { background:color-mix(in srgb, var(--accent) 35%, var(--card)); }
.pregband { display:flex; gap:14px; align-items:center; background:var(--card); border:1.5px solid var(--line); box-shadow:0 1px 2px rgba(0,0,0,.04); border-radius:13px; padding:14px 15px; margin-bottom:8px; }
.pregweek { font-family:'Fraunces',serif; font-weight:600; font-size:22px; color:var(--primary); white-space:nowrap; }
.pregmeta { display:flex; flex-direction:column; gap:2px; font-size:13px; }
.pregmeta span { color:var(--soft); font-size:12.5px; }
.pregbar { height:8px; background:color-mix(in srgb, var(--ink) 8%, var(--paper)); border-radius:4px; overflow:hidden; margin-bottom:14px; }
.pregfill { height:100%; background:linear-gradient(90deg,var(--accent),var(--primary)); }
.kickrow { display:flex; gap:10px; align-items:stretch; margin-bottom:12px; }
.kickcount { display:flex; flex-direction:column; align-items:center; justify-content:center; background:var(--card); border:1px solid var(--line); border-radius:13px; padding:6px 16px; }
.kickcount b { font-family:'Fraunces',serif; font-size:20px; color:var(--primary); } .kickcount span { font-size:10.5px; color:var(--soft); }
.inp { width:100%; border:1.5px solid var(--line); background:var(--card); border-radius:11px; padding:11px 13px; font:500 13.5px 'Karla'; color:var(--ink); margin-bottom:9px; }
.splash { padding-top:46px; text-align:left; }
.splashmark { font-family:'Fraunces',serif; font-weight:600; font-size:44px; }
.splashmark span { color:var(--primary); }
.splashtag { font-size:12px; font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:var(--primary); margin-top:2px; }
.ghostbtn { width:100%; border:1px solid var(--primary); background:none; color:var(--primary); border-radius:13px; font:700 14px 'Karla'; padding:13px; margin-top:10px; cursor:pointer; }
.consentcard { background:var(--card); border:1.5px solid var(--line); border-radius:13px; padding:14px; font-size:13px; margin-bottom:12px; }
.consentopt { display:flex; gap:11px; width:100%; text-align:left; border:1.5px solid var(--line); background:var(--card); border-radius:13px; padding:13px; font:400 12.5px 'Karla'; color:var(--ink); line-height:1.5; cursor:pointer; }
.consentopt.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 7%, var(--card)); }
.ckbox { flex-shrink:0; width:22px; height:22px; border:2px solid var(--primary); border-radius:7px; display:flex; align-items:center; justify-content:center; font-weight:700; color:var(--primary); }
.acctchip { font-size:11px; font-weight:700; color:var(--ink); border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:6px 11px; margin-right:6px; }
.stagechip { border:1.5px solid var(--line); background:var(--card); color:var(--primary); border-radius:999px; padding:6px 12px; font:700 11.5px 'Karla'; cursor:pointer; }
.obwrap { padding-top:14px; }
.obq { font-family:'Fraunces',serif; font-weight:600; font-size:20px; margin:6px 0 14px; }
.obopts { display:grid; gap:9px; margin-bottom:18px; }
.obopt { border:1.5px solid var(--line); background:var(--card); box-shadow:0 1px 2px rgba(0,0,0,.05); border-radius:13px; padding:14px; text-align:left; font:500 14.5px 'Karla'; color:var(--ink); cursor:pointer; }
.obopt:active { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 8%, var(--card)); }
.obdots { display:flex; gap:6px; margin-bottom:16px; }
.obdots span { width:8px; height:8px; border-radius:50%; background:var(--line); }
.obdots span.on { background:var(--primary); }
.c-log { position:absolute; top:3px; right:4px; width:5px; height:5px; border-radius:50%; background:var(--accent); }
.c-period .c-log { background:#FFF; }
.linkbtn { border:none; background:none; color:var(--primary); font:700 12.5px 'Karla'; text-decoration:underline; cursor:pointer; padding:0; }
.c-wk { border-color:var(--accent); }
.c-wklab { position:absolute; bottom:2px; font-size:7.5px; font-weight:700; color:var(--accent); }
.d-logdot { background:var(--accent); border-radius:50%; }
.section-lab { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--soft); margin:14px 0 7px; }
.disclosure { width:100%; display:flex; justify-content:space-between; align-items:center; border:1.5px solid var(--line); background:var(--card); border-radius:13px; padding:13px 15px; font:700 13px 'Karla'; color:var(--ink); cursor:pointer; margin:14px 0 0; }
.bodypanel { border:1.5px solid var(--line); border-top:none; border-radius:0 0 13px 13px; background:var(--card); padding:4px 15px 14px; }
.wrapchips { display:flex; flex-wrap:wrap; gap:7px; }
.minichip { border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:7px 13px; font:500 12.5px 'Karla'; color:var(--ink); cursor:pointer; }
.minichip.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 12%, var(--card)); color:var(--primary); font-weight:700; }
.scalerow { margin-bottom:12px; }
.scalehead { display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:3px; }
.scalehead b { font-family:'Fraunces',serif; color:var(--primary); font-size:15px; }
.slider { width:100%; accent-color:var(--primary); }
.scaleends { display:flex; justify-content:space-between; font-size:11px; color:var(--soft); }
.meter { border:2px solid var(--line); box-shadow:0 1px 3px rgba(0,0,0,.06); background:var(--card); border-radius:13px; padding:12px 14px; margin-bottom:14px; transition:border-color .3s; }
.meterhead { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:7px; }
.meterlabel { font-family:'Fraunces',serif; font-weight:600; font-size:16px; }
.meterval { font-family:'Fraunces',serif; font-weight:600; font-size:20px; transition:color .3s; }
.metertrack { height:11px; background:color-mix(in srgb, var(--ink) 14%, var(--card)); border-radius:5px; overflow:hidden; }
.meterfill { height:100%; border-radius:5px; transition:width .3s ease, background .3s; }
.meterends { display:flex; justify-content:space-between; font-size:10.5px; color:var(--soft); margin-top:3px; }
.gradlegend { display:flex; align-items:center; gap:8px; font-size:11px; color:var(--soft); margin-bottom:12px; }
.gradbar { flex:1; height:7px; border-radius:4px; }
.c-per-mark { position:absolute; bottom:3px; width:5px; height:5px; border-radius:50%; background:var(--primary); box-shadow:0 0 0 1.5px rgba(255,255,255,.7); }
.d-permark { background:var(--primary); border-radius:50%; }
.scorepill { float:right; font-size:10px; font-weight:700; color:#FFF; border-radius:999px; padding:3px 9px; }
.palsheet { background:var(--card); border:1.5px solid var(--line); border-radius:14px; padding:14px; margin-bottom:14px; box-shadow:0 2px 8px rgba(0,0,0,.07); }
.palopt { display:flex; align-items:center; gap:11px; width:100%; text-align:left; border:1.5px solid var(--line); background:var(--card); border-radius:12px; padding:10px 12px; margin-bottom:8px; cursor:pointer; }
.palopt.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 8%, var(--card)); }
.palswatches { display:flex; gap:4px; flex-shrink:0; }
.palswatches i { width:19px; height:19px; border-radius:6px; display:block; }
.palmeta { display:flex; flex-direction:column; flex:1; }
.palmeta b { font-size:13px; color:var(--ink); } .palmeta span { font-size:11px; color:var(--soft); }
.palcheck { color:var(--primary); font-weight:700; }
.prog { display:flex; gap:5px; margin-bottom:6px; }
.prog span { flex:1; height:5px; border-radius:3px; background:color-mix(in srgb, var(--ink) 14%, var(--card)); }
.prog span.on { background:var(--primary); }
.stepno { font-size:11px; font-weight:700; color:var(--soft); text-transform:uppercase; letter-spacing:.07em; margin-bottom:12px; }
.lab { font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--soft); margin:16px 0 8px; }
.labErr { color:#B4462F; }
.need { color:#B4462F; font-weight:700; }
.mcrow { display:flex; flex-wrap:wrap; gap:8px; }
.mc { border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:9px 15px; font:500 13px 'Karla'; color:var(--ink); cursor:pointer; }
.mc.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 12%, var(--card)); color:var(--primary); font-weight:700; }
.err .mc, .err .stagecard { border-color:#E0A99B; }
.inpErr { border-color:#C4573B !important; background:#FBEEEA !important; }
.errhint { font-size:12.5px; color:#B4462F; line-height:1.5; margin:14px 0 0; background:#FBEEEA; border:1.5px solid #E7C3B8; border-radius:11px; padding:11px 13px; }
.regcards { display:grid; gap:9px; }
.stagecard { display:flex; flex-direction:column; align-items:flex-start; gap:2px; border:1.5px solid var(--line); background:var(--card); border-radius:13px; padding:13px 15px; cursor:pointer; text-align:left; }
.stagecard.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 8%, var(--card)); }
.stagecard b { font-family:'Fraunces',serif; font-size:16px; color:var(--ink); } .stagecard.on b { color:var(--primary); }
.stagecard span { font-size:12px; color:var(--soft); }
.nav { display:flex; gap:10px; margin-top:20px; }
.back { border:1.5px solid var(--line); background:var(--card); color:var(--ink); border-radius:13px; padding:14px 20px; font:700 14px 'Karla'; cursor:pointer; }
.nav .cta { flex:1; }
.plaincard { background:var(--card); border:1.5px solid var(--line); border-radius:13px; padding:14px 16px; margin-bottom:6px; box-shadow:0 1px 2px rgba(0,0,0,.04); }
.plain { font-size:14px; line-height:1.6; margin:0 0 10px; }
.plain:last-child { margin-bottom:0; }
.script { font-size:14px; line-height:1.6; margin:0 0 12px; padding-left:12px; border-left:3px solid var(--primary); color:var(--ink); }
.script:last-child { margin-bottom:0; }
.homehead { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; }
.greet { font-family:'Fraunces',serif; font-weight:440; font-size:26px; line-height:1.1; }
.greetsub { font-size:13px; color:var(--soft); margin-top:4px; }
.streak { display:flex; flex-direction:column; align-items:center; background:var(--card); border:1.5px solid var(--line); border-radius:13px; padding:8px 14px; min-width:70px; }
.streak b { font-family:'Fraunces',serif; font-size:22px; color:var(--primary); line-height:1; } .streak span { font-size:10px; color:var(--soft); margin-top:2px; }
.nextrow { display:flex; gap:12px; align-items:flex-start; padding:10px 0; border-top:1.5px solid var(--line); }
.nextrow:first-child { border-top:none; }
.nextdot { flex-shrink:0; width:9px; height:9px; border-radius:50%; background:var(--accent); margin-top:5px; }
.nexttext { font-size:14px; } .nextsub { font-size:12px; color:var(--soft); margin-top:2px; } .nextsub.link { color:var(--primary); font-weight:700; }
.pulse { background:color-mix(in srgb, var(--primary) 9%, var(--card)); border:1.5px solid color-mix(in srgb, var(--primary) 25%, var(--line)); border-radius:13px; padding:12px 16px; }
.pulserow { display:flex; gap:12px; align-items:baseline; padding:6px 0; }
.pulserow b { font-family:'Fraunces',serif; font-size:22px; color:var(--primary); min-width:72px; } .pulserow span { font-size:13.5px; }
.recaprow { display:flex; justify-content:space-between; padding:9px 0; border-top:1.5px solid var(--line); font-size:13.5px; }
.recaprow:first-child { border-top:none; margin-top:8px; } .recaprow b { font-weight:700; }
.up { color:#43604F; font-weight:700; margin-left:4px; } .down { color:#A04545; font-weight:700; margin-left:4px; } .flat { color:var(--soft); font-weight:500; margin-left:4px; }
.medrow { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:10px 0; border-top:1.5px solid var(--line); }
.medinfo { display:flex; flex-direction:column; gap:2px; } .medinfo b { font-size:14px; } .medinfo span { font-size:12px; color:var(--soft); }
.medeff { color:var(--primary) !important; font-weight:700; } .medeff.muted { color:var(--soft) !important; font-weight:500; }
.takebtn { flex-shrink:0; border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:8px 13px; font:700 12px 'Karla'; color:var(--ink); cursor:pointer; }
.takebtn.on { border-color:var(--primary); background:var(--primary); color:#FFF; }
.jentry { border-top:1.5px solid var(--line); padding:10px 0; } .jentry b { font-size:12px; color:var(--soft); } .jentry p { margin:4px 0 0; font-size:13.5px; line-height:1.55; white-space:pre-wrap; }
.orline { display:flex; align-items:center; gap:10px; margin:14px 0 10px; font-size:11.5px; color:var(--soft); text-transform:uppercase; letter-spacing:.07em; }
.orline::before, .orline::after { content:""; flex:1; height:1.5px; background:var(--line); }
.social { display:grid; gap:8px; }
.socialbtn { display:flex; align-items:center; justify-content:center; gap:9px; border:1.5px solid var(--line); background:var(--card); border-radius:13px; padding:12px; font:700 14px 'Karla'; color:var(--ink); cursor:pointer; }
.socialbtn:disabled { opacity:.6; }
.socialdot { width:12px; height:12px; border-radius:50%; }
.mstrip { display:grid; gap:7px; }
.ms { display:flex; align-items:center; gap:10px; background:var(--card); border:1.5px solid var(--line); border-radius:11px; padding:9px 12px; font-size:13px; color:var(--soft); }
.ms.done { color:var(--ink); border-color:color-mix(in srgb, var(--primary) 35%, var(--line)); }
.msdot { flex-shrink:0; width:20px; height:20px; border-radius:50%; border:2px solid var(--line); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; }
.ms.done .msdot { background:var(--primary); border-color:var(--primary); color:#FFF; }
.mslabel { flex:1; }
.msbar { width:56px; height:6px; background:color-mix(in srgb, var(--ink) 12%, var(--card)); border-radius:3px; overflow:hidden; }
.msbar i { display:block; height:100%; background:var(--primary); }
/* ---- accessibility ---- */
@media (prefers-reduced-motion: reduce) { .cy * { transition:none !important; animation:none !important; } }
button:focus-visible, input:focus-visible, textarea:focus-visible, [tabindex]:focus-visible { outline:3px solid var(--primary); outline-offset:2px; border-radius:8px; }
.tab { min-height:44px; padding:12px 10px; }
.mc, .pill, .takebtn, .sbtn, .orgbtn, .stagechip, .topbtn, .linkbtn, .ghost, .route { min-height:44px; }
.minichip { min-height:40px; }
.sdot.on, .c-per-mark { outline:1.5px solid rgba(0,0,0,.35); }
.toast { position:fixed; left:50%; transform:translateX(-50%); bottom:20px; background:var(--ink); color:#FFF; font-size:13px; padding:9px 16px; border-radius:999px; max-width:86%; text-align:center; z-index:9; }
`;
