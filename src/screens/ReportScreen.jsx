import { useEffect, useRef, useState } from "react";
import { fmt, localDay, lensLabel, addDays } from "../lib/engine.js";
import { FAMILIES, SYM_FAMILY, famVar } from "../lib/constants.js";
import { strongMeterWord } from "../lib/appearance.js";
import { copyText } from "../lib/clipboard.js";
import Icon from "../components/Icon.jsx";
import Details from "../components/Details.jsx";
import { FertilityFinding } from "../components/FertilitySummary.jsx";
import { fertSummary } from "../lib/fertility.js";
import { PdfDoc } from "../lib/pdf.js";
import { visitTexts, FILE_WARNING, GATE_EMPTY, LOSSY_LINE, SAME_NUMBERS, limitLine } from "../lib/visitReport.js";
import { fitSummary, summaryPdf, summaryTexts, pdfAccent, QUESTIONS_MAX, QUESTION_LEN, addQuestion, removeQuestion } from "../lib/clinicianSummary.js";
import ClinicianPreview from "../components/ClinicianPreview.jsx";
import { pdfLossy } from "../lib/potsReport.js";
import { saveFile } from "../lib/files.js";
import { isNative } from "../lib/native.js";
import { can } from "../lib/plan.js";
import { CheckRow } from "../components/pots/StandSafety.jsx";
import { t } from "../lib/i18n.js";

/* Cycle & Peri — Report, "What to tell your doctor": plain-language findings,
   what they might mean, verbatim scripts, send-ahead email, and the collapsed
   data table demoted below the guidance.
   Colour here is the same symptom-family colour the patterns card uses (Heat, Sleep, Mind,
   Pain, Body), never the only cue: every meter, dot and bar sits beside the sentence that
   says the same thing in words, and the numbers table underneath carries every value.
   UI R1: the page names the appointment it is for, thin logs get an honest state and a way
   to Today, findings lead with the count and meters carry the 60% / 80% threshold ticks,
   the email can take up to three of the scripts, and the text leaves by email, clipboard,
   the browser's print dialog or the OS share sheet — Cyra itself still sends nothing.
   Local-first L9: section 4 opens with the Appointment PDF card. The file is built on this device by
   lib/visitReport.js (visitModel from App's buildVisit, drawn with the statically bundled PdfDoc, so
   nothing is fetched) and handed to a browser download or the phone share sheet by lib/files.js, the
   same path as the POTS report. Her day notes go in only while "Include my notes" is ticked (UI state,
   unticked on every visit, never saved); her picked questions ride along in the email and the PDF. The
   PDF is untagged, so this page is its accessible version: "The numbers behind this" carries the same
   cycle table, day-score sentence and (when ticked) notes, and the symptom table reads the same model. */

// Each family's colour as its CSS variable (--fam-*, vizVars): tint(), the meters, the meaning rails and the table bars follow light or dark.
const FAM = Object.fromEntries(FAMILIES.map((f) => [f.id, { ...f, color: famVar(f.id) }]));
const famOf = (id) => FAM[SYM_FAMILY[id] || "body"];
const tint = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, var(--card))`;
const dayIso = (iso, k) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + k); return localDay(d); };
const MAILTO_MAX = 1900; // encoded body length above which mail clients start dropping the draft silently
const PICK_MAX = 3;

/* How often, in words (the spec's thresholds), from days with the symptom over days logged. */
const inWords = (days, n) => {
  const p = Math.round((days / Math.max(1, n)) * 100);
  if (p >= 80) return "nearly every day";
  if (p >= 60) return "most days";
  if (p >= 40) return "about half the days";
  if (p >= 20) return "a few days a week";
  return "now and then";
};

const Tri = ({ up }) => <svg className="rtri" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d={up ? "M5 1.2L9.6 8.8H.4z" : "M5 8.8L.4 1.2h9.2z"} fill="currentColor" /></svg>;

/* Change in symptom days against the 30 days before this window: more days is the worse direction.
   The triangle is paired with the word ("more" / "fewer" / "same"), so the direction is never colour alone. */
function Delta({ prev, cur }) {
  if (prev == null) return null;
  const d = cur - prev;
  if (d === 0) return <span className="fdelta flat">same as the month before</span>;
  return <span className={`fdelta ${d > 0 ? "worse" : "better"}`}><Tri up={d > 0} />{Math.abs(d)} {d > 0 ? "more" : "fewer"} {Math.abs(d) === 1 ? "day" : "days"} than the month before ({prev} → {cur})</span>;
}

/* Cycle lengths as dots on one scale, the shortest-to-longest span bracketed. Decorative: the
   sentence beside it carries the lengths and the spread. A cycle she left out of predictions (outs[i]) is a hollow
   dot: it still counts here (L5). */
function CycleDots({ lens, outs = [] }) {
  const W = 300, H = 30, L = 14, R = 14;
  const lo = Math.min(18, Math.min(...lens) - 2), hi = Math.max(50, Math.max(...lens) + 2);
  const x = (v) => L + ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (W - L - R);
  const mn = Math.min(...lens), mx = Math.max(...lens);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cyclesvg" aria-hidden="true" focusable="false">
      <line x1={L} x2={W - R} y1={19} y2={19} stroke="var(--line)" strokeWidth={1} />
      {mx > mn && <line x1={x(mn)} x2={x(mx)} y1={19} y2={19} stroke="var(--primary)" strokeWidth={3} strokeLinecap="round" opacity={0.35} />}
      {lens.map((l, i) => (outs[i]
        ? <circle key={i} cx={x(l)} cy={19} r={5} fill="var(--card)" stroke="var(--primary)" strokeWidth={2} />
        : <circle key={i} cx={x(l)} cy={19} r={5} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />))}
      <text x={x(mn)} y={8} textAnchor={x(mn) < 30 ? "start" : "middle"} className="ptick">{mn}d</text>
      {mx > mn && <text x={x(mx)} y={8} textAnchor={x(mx) > W - 30 ? "end" : "middle"} className="ptick">{mx}d</text>}
    </svg>
  );
}

/* The meter: logged days as the track, the symptom's days as the fill, moderate-or-strong in the full family
   colour (the darker segment in light, the brighter one in dark: the legend says which, strongMeterWord), with
   ticks at the 60% ("most days") and 80% ("nearly every day") thresholds. Grows once per mount; the
   sentence under it is the text twin. */
function Meter({ color, any, strong, mounted }) {
  return (
    <div className="fmeter" aria-hidden="true" style={{ "--fc": color }}>
      <i className="fm-any" style={{ "--v": mounted ? any : 0 }} />
      {strong > 0 && <i className="fm-strong" style={{ "--v": mounted ? strong : 0 }} />}
      <i className="ftick" style={{ left: "60%" }} /><i className="ftick" style={{ left: "80%" }} />
    </div>
  );
}

const Sec = ({ n, children }) => <p className="rsec"><span className="rnum">{n}</span><span>{children}</span></p>;

export default function ReportScreen({ ins, stage, stageName, buildEmail, ping, showTable, setShowTable, potsOn = false, todayIso = localDay(), appt = null, daysUntil = () => 0, goTab = () => {}, setShowAppts = () => {}, scoreOn = () => null, scoreColor = () => "var(--primary)", scheme = "light", lens6 = null, fert = null, buildVisit = null, pdfLeft = null, onPdfMade = () => {}, pdfLimit = null, onHandoff = null, mealsK = 0, buildSummary = null, hasName = false, accentHex = null, questions = [], setQuestions = () => {}, aiWriteUp = null }) {
  const n = ins.last30.length; // days logged in the last 30 calendar days
  // The last 6 cycle lengths, each marked when she left it out of predictions (L5): the spread still counts every one.
  const lensList = lens6 || ins.lens.map((len) => ({ len, excluded: false }));
  const [picked, setPicked] = useState([]); // indices of scripts going into the email (max PICK_MAX)
  const [copied, setCopied] = useState(null); // index of the script whose Copy just landed
  const [mounted, setMounted] = useState(false); // flips once so the meters grow from 0
  const [withNotes, setWithNotes] = useState(false); // "Include my notes" (L9): UI only, unticked on every visit, never saved
  const [withMeals, setWithMeals] = useState(false); // "Include meal notes" (only offered while Meal notes is on and she has some): UI only, never saved
  const [busy, setBusy] = useState(false); // a PDF is being made or shared
  // Doctor report v2: "Include my name", "Add the detailed pages" and "Include the AI write-up" are UI only, off on every visit,
  // never saved. Notes, meal notes and the AI write-up live in the detailed pages, so ticking one of them adds those pages and
  // unticking the pages unticks them.
  const [withName, setWithName] = useState(false);
  const [withDetail, setWithDetail] = useState(false);
  const [withAi, setWithAi] = useState(false);
  const [bigPreview, setBigPreview] = useState(false);
  const [draftQ, setDraftQ] = useState("");
  const copyTimer = useRef(null);
  useEffect(() => { setMounted(true); return () => clearTimeout(copyTimer.current); }, []);
  // Printing wants the numbers table open; beforeprint covers the real dialog, the media query covers previews.
  useEffect(() => {
    const open = () => setShowTable(true);
    window.addEventListener("beforeprint", open);
    const mq = typeof matchMedia === "function" ? matchMedia("print") : null;
    const onMq = (e) => { if (e.matches) open(); };
    mq?.addEventListener?.("change", onMq);
    return () => { window.removeEventListener("beforeprint", open); mq?.removeEventListener?.("change", onMq); };
  }, [setShowTable]);

  // the window itself (the engine's last 30 calendar days) and the 30 days before it
  const from = dayIso(todayIso, -29);
  // Fertility signs (L7, Trying to conceive only): the same 30-day window as everything else on this page.
  const fsum = fert ? fertSummary(ins.sorted, { from, to: todayIso }) : null;
  const loggedSet = new Set(ins.last30.map((d) => d.date));
  const cells = Array.from({ length: 30 }, (_, i) => dayIso(from, i));
  const top = ins.counts.filter((c) => c.days > 0).slice(0, 3);
  const frac = (d) => Math.min(1, d / Math.max(1, n));
  const pct = (d) => `${Math.round(frac(d) * 100)}%`;
  const thin = n < 3;
  const todayLogged = loggedSet.has(todayIso);
  const meanings = [
    stage === "peri" && ins.variability != null && ins.variability >= 7 && { k: "var", fam: "Cycles", color: "var(--primary)", head: "A clear sign of the transition",
      text: "Periods that vary by a week or more are one of the clearest signs the menopause transition has started.",
      more: "That's not a diagnosis — but it's the exact thing doctors look at, and it usually means this is a years-long change worth planning for, not a random bad month." },
    stage === "peri" && ins.counts.find((c) => (c.id === "hf" || c.id === "ns") && c.days >= 8) && { k: "heat", fam: FAM.heat.label, color: FAM.heat.color, head: "Treatable, and often never discussed",
      text: <>Hot flashes and night sweats this often are <b>treatable</b> — this is the single most fixable thing on your list.</>,
      more: "Most women are never offered treatment simply because it never gets discussed." },
    ins.counts.find((c) => c.id === "slp" && c.days >= 8) && { k: "sleep", fam: FAM.sleep.label, color: FAM.sleep.color, head: "Sleep is worth treating on its own",
      text: "Sleep that's disrupted this often is worth treating on its own, not just waiting out.",
      more: "Poor sleep tends to make every other symptom louder, so fixing it often improves several things at once." },
    stage === "periods" && ins.counts.find((c) => c.id === "crm" && c.strong >= 6) && { k: "pain", fam: FAM.pain.label, color: FAM.pain.color, head: "Pain this strong has causes",
      text: "Pain this strong, this often, isn't something to just get through.",
      more: "Period pain that regularly stops you has causes that are diagnosable and treatable — it often goes unaddressed for years because people are told it's normal." },
  ].filter(Boolean);
  const scripts = [
    ...ins.counts.filter((c) => c.days > 0).slice(0, 1).map((c) => `I logged ${n} of the last 30 days. ${c.label} happened on ${c.days} of them. What could be causing it?`),
    ...(ins.variability != null && ins.variability >= 7 ? [`My cycles have ranged from ${Math.min(...ins.lens)} to ${Math.max(...ins.lens)} days. Could I be in perimenopause, and what does that mean for me?`] : []),
    ...(stage === "peri" ? ["Am I a candidate for hormone therapy? If not, what non-hormonal options would you consider?"] : []),
    ...(ins.counts.find((c) => c.days >= 8) ? ["Could we check my thyroid, iron levels, and vitamin D? I've read those can cause symptoms like mine."] : []),
    "If we try something, how will we know in a few months whether it's working?",
  ];
  const togglePick = (i) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length >= PICK_MAX ? p : [...p, i]));
  const pickedScripts = picked.slice().sort((a, b) => a - b).map((i) => scripts[i]).filter(Boolean);
  // The appointment PDF's model (L9): the picked questions and, while ticked, her notes. It is also the one source of the
  // comparison numbers on this page (prevFor), so the screen and the file cannot drift.
  const visit = buildVisit ? buildVisit({ questions: pickedScripts, includeNotes: withNotes, includeMeals: mealsK > 0 && withMeals, includeName: withName }) : null;
  // Page 1 (doctor report v2): her questions first, then the suggestions she added; trimmed to one page by a dry run.
  const summary = buildSummary ? fitSummary(buildSummary({ includeName: withName, appendix: withDetail, picked: pickedScripts }), PdfDoc, accentHex) : null;
  const accent = pdfAccent(accentHex);
  const prevFor = (c) => (visit && visit.symptoms.prevOk ? visit.symptoms.prevDays[c.id] ?? 0 : null);
  const email = buildEmail(pickedScripts);
  const emailText = `Subject: ${email.subject}\n\n${email.body}`;
  const mailtoLong = encodeURIComponent(email.body).length > MAILTO_MAX;
  const canShare = typeof navigator !== "undefined" && !!navigator.canShare?.({ text: emailText });
  const copyScript = (s, i) => copyText(s, "Question copied — paste it anywhere", ping).then((ok) => {
    if (!ok) return;
    clearTimeout(copyTimer.current); setCopied(i); copyTimer.current = setTimeout(() => setCopied(null), 1500);
  });
  const openAppts = () => { goTab("home"); setShowAppts(true); };
  const logToday = () => goTab("today");
  const apptIn = appt ? daysUntil(appt.date) : null;

  // ---- the appointment PDF (L9): made on this device, handed over by lib/files.js, counted only if plan.js ever sets a limit ----
  const limitHit = pdfLeft !== null && pdfLeft <= 0;
  const canMake = !!visit && (visit.enough || !!summary?.enough);
  // The OS share sheet with the file itself (web browsers that can share files); the phone's "Share PDF…" already does this.
  const fileShare = !isNative() && typeof navigator !== "undefined" && typeof File === "function" && !!navigator.canShare?.({ files: [new File([""], "x.pdf", { type: "application/pdf" })] });
  const sharePdf = async () => {
    if (busy || !visit || !canMake || limitHit) return;
    onHandoff?.();
    setBusy(true);
    try {
      const data = summaryPdf({ summary, visit: withDetail ? visit : null, ai: withDetail && withAi ? aiWriteUp : null, accentHex }, PdfDoc);
      await navigator.share({ title: "Solia Health report", files: [new File([data], summary.files.pdf, { type: "application/pdf" })] });
      onPdfMade();
    } catch (e) { if (e?.name !== "AbortError") ping("Couldn't open the share sheet. Use Download PDF instead"); } finally { setBusy(false); }
  };
  const setDetail = (on) => { setWithDetail(on); if (!on) { setWithNotes(false); setWithMeals(false); setWithAi(false); } };
  const tickInDetail = (on, set) => () => { set(!on); if (!on) setWithDetail(true); };
  const qList = Array.isArray(questions) ? questions : [];
  const addQ = () => {
    const r = addQuestion(qList, draftQ);
    if (!r.ok) { ping(r.why === "full" ? `Page 1 holds ${QUESTIONS_MAX} questions. Remove one to add another` : r.why === "same" ? "That question is already on your list" : "Type a question first"); return; }
    setQuestions(r.list); setDraftQ(""); ping("Question saved on this device");
  };
  const firstOfNextMonth = `${addDays(`${todayIso.slice(0, 7)}-01`, 32).slice(0, 7)}-01`; // for limitLine, only if a limit is ever set
  const makePdf = async () => {
    if (busy || !visit || !canMake || limitHit) return;
    onHandoff?.(); // L10: the share sheet / download this tap opens must not lock the app on its own hide
    setBusy(true);
    try {
      const data = summaryPdf({ summary, visit: withDetail ? visit : null, ai: withDetail && withAi ? aiWriteUp : null, accentHex }, PdfDoc);
      const r = await saveFile({ name: visit.files.pdf, data, mime: "application/pdf", title: "Solia Health report", onReady: () => ping("PDF ready. Choose where to send it") });
      if (r !== "cancelled") onPdfMade();
      if (r === "downloaded") ping("PDF downloaded. It's in your browser's downloads");
    } catch (e) { ping(e?.message || "Couldn't make the PDF"); } finally { setBusy(false); }
  };
  const pdfAttrs = !visit || !canMake ? { "aria-disabled": "true", "aria-describedby": "pdf-gate" } : limitHit ? { "aria-disabled": "true", "aria-describedby": "pdf-limit" } : busy ? { "aria-disabled": "true" } : {};
  const notesK = visit ? visit.notesInWindow : 0;
  const lossy = visitTexts(visit).some(pdfLossy) || summaryTexts(summary).some(pdfLossy) || (withDetail && withAi && aiWriteUp && pdfLossy(aiWriteUp.writeup));
  const pdfCard = visit && summary && can("pdfExport") && (
    <section className="pdfcard" aria-labelledby="pdf-h">
      <div className="pdfhead">
        <Icon name="file" size={20} className="pdfico" />
        <div>
          <h2 className="pdftitle" id="pdf-h">Appointment PDF</h2>
          <p className="pdfin">A one-page clinician summary, made on this device. Free, always.</p>
        </div>
      </div>
      <div className={`csscroll${bigPreview ? " big" : ""}`} {...(bigPreview ? { tabIndex: 0, role: "region", "aria-label": "Page 1 preview, full size" } : {})}>
        <ClinicianPreview model={summary} accent={accent} big={bigPreview} />
      </div>
      <button type="button" className="linkbtn cszoom" aria-pressed={bigPreview} onClick={() => setBigPreview((v) => !v)}>{bigPreview ? "Fit the preview to the screen" : "See page 1 full size"}</button>
      <div className="routes">
        <button type="button" className="route primary" {...pdfAttrs} onClick={makePdf}>{isNative() ? "Share PDF…" : "Download PDF"}<span>made on this device</span></button>
        {fileShare && <button type="button" className="route" {...pdfAttrs} onClick={sharePdf}>Share…<span>the PDF, to Messages, Mail or a portal</span></button>}
      </div>
      {!canMake && <p className="hint pdfnote" id="pdf-gate">{GATE_EMPTY}</p>}
      {canMake && limitHit && <p className="hint pdfnote" id="pdf-limit">{limitLine(pdfLimit, firstOfNextMonth)}</p>}
      <div className="pdfopts" role="group" aria-label="What goes in the PDF">
        {hasName && <CheckRow on={withName} onToggle={() => setWithName((v) => !v)}>Include my name</CheckRow>}
        <CheckRow on={withDetail} onToggle={() => setDetail(!withDetail)}>Add the detailed pages</CheckRow>
        <p className="hint pdfnote">{withDetail ? `Page 2 on: every symptom and lab value, the 30-day tables and day ratings.` : "Off: the PDF is page 1 only."}</p>
        {notesK > 0 && (
          <>
            <CheckRow on={withNotes} onToggle={tickInDetail(withNotes, setWithNotes)}>Include my notes</CheckRow>
            <p className="hint pdfnote">{withNotes ? `${notesK} day note${notesK === 1 ? "" : "s"} in these 30 days will be in the PDF, in the detailed pages.` : `${notesK} day note${notesK === 1 ? "" : "s"} in these 30 days. They go in only while this is ticked.`}</p>
          </>
        )}
        {mealsK > 0 && (
          <>
            <CheckRow on={withMeals} onToggle={tickInDetail(withMeals, setWithMeals)}>{t("report.includeMealNotes")}</CheckRow>
            <p className="hint pdfnote">{withMeals ? t("report.mealNotesIn", { count: mealsK }) : t("report.mealNotesOut", { count: mealsK })}</p>
          </>
        )}
        {aiWriteUp && (
          <>
            <CheckRow on={withAi} onToggle={tickInDetail(withAi, setWithAi)}>Include the AI write-up</CheckRow>
            <p className="hint pdfnote">{withAi ? "Your saved write-up goes on its own page, marked as written by the AI. Nothing is sent to make the PDF." : "Your saved AI write-up stays out of the PDF unless this is ticked."}</p>
          </>
        )}
      </div>
      {lossy && <p className="hint pdfnote">{LOSSY_LINE}</p>}
      <p className="hint pdfnote">{FILE_WARNING}</p>
      {canMake && <Details label="What's in it"><p>Page 1: your cycles, top symptoms, What I'm trying with before and since counts, lab values you typed, sleep, movement and mood, and your questions.{withName ? " Your name is at the top." : " No name unless you tick Include my name."}</p>{withDetail && visit.contents && <p>Detailed pages: {visit.contents.replace(/^In it: /, "")}</p>}</Details>}
      {canMake && <Details label="Where the numbers come from"><p className="rfoot pdfacc">{SAME_NUMBERS}</p></Details>}
    </section>
  );

  // Her own questions for page 1 (persisted `visitQuestions`, in backups). Her words only: Solia Health suggests none here.
  const qCard = summary && can("pdfExport") && (
    <section className="qcard" aria-labelledby="q-h">
      <h2 className="qtitle" id="q-h">Questions for my visit</h2>
      <p className="hint">Type what you want to ask. They print on page 1 and stay on this device (and in your backups).</p>
      {qList.length > 0 && (
        <ol className="qlist">
          {qList.map((q, i) => (
            <li key={q}><span className="qnum" aria-hidden="true">{i + 1}</span><span className="qtext">{q}</span>
              <button type="button" className="linkbtn qremove" aria-label={`Remove question ${i + 1}`} onClick={() => setQuestions(removeQuestion(qList, i))}>Remove</button></li>
          ))}
        </ol>
      )}
      {qList.length < QUESTIONS_MAX ? (
        <div className="qadd">
          <label className="lab" htmlFor="q-new">Add a question</label>
          <textarea id="q-new" className="inp qinput" rows={2} maxLength={QUESTION_LEN} value={draftQ} onChange={(e) => setDraftQ(e.target.value)} aria-describedby="q-count" />
          <div className="qaddrow">
            <span className="hint" id="q-count">{draftQ.length} of {QUESTION_LEN} characters · {qList.length} of {QUESTIONS_MAX} questions</span>
            <button type="button" className="ghostbtn qsave" onClick={addQ}>Add question</button>
          </div>
        </div>
      ) : <p className="hint">That's {QUESTIONS_MAX} questions, as many as page 1 holds. Remove one to add another.</p>}
    </section>
  );

  const sendAhead = (
    <>
      <p className="hint" style={{ marginBottom: 10 }}>A short email your doctor can read in twenty seconds. Solia Health itself sends nothing; the text goes only where you take it.</p>
      <p className="rsec">Preview</p>
      <textarea className="inp emailpreview" readOnly rows={emailText.split("\n").length + 1} aria-label="Email preview" value={emailText} onFocus={(e) => e.target.select()} />
      <div className="routes">
        <button type="button" className="route" onClick={() => { onHandoff?.(); window.open(`mailto:?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`); ping("Handing off to your email… If nothing opens, use Copy email instead."); }}>Open in email<span>pre-filled draft</span></button>
        <button type="button" className="route" onClick={() => copyText(emailText, "Email copied — paste anywhere", ping)}>Copy email<span>paste anywhere</span></button>
        <button type="button" className="route" onClick={() => { onHandoff?.(); window.print(); }}>Print this page<span>from your browser</span></button>
        {canShare && <button type="button" className="route" onClick={() => { onHandoff?.(); navigator.share({ title: email.subject, text: emailText }).catch(() => {}); }}>Share…<span>Messages, Files, a portal</span></button>}
      </div>
      {mailtoLong && <p className="hint rlong">Long for an email link — use Copy email or Share…</p>}
      {potsOn && <p className="hint" style={{ marginTop: 10 }}>Your POTS report (standing tests, drinks, medicines) is in POTS tools (open it from Home).</p>}
    </>
  );

  return (
    <main className="report">
      <h1 className="disp">What to tell your doctor</h1>
      {/* The appointment this is for: Home's "Prep your report →" lands here, so the page says which visit and when. */}
      <p className="rappt">
        {appt ? <><b>{appt.who || "Your appointment"}</b><span>· {apptIn === 0 ? "today" : apptIn === 1 ? "tomorrow" : `in ${apptIn} days`}</span><button type="button" className="linkbtn" onClick={openAppts}>Change</button></>
          : <button type="button" className="linkbtn" onClick={openAppts}>Add your appointment date</button>}
      </p>
      <p className="hint">Your last 30 days, in a few clear sentences for your doctor.</p>
      {pdfCard}
      {qCard}

      {/* Cover: how much of the window is logged, as a number and a 30-day strip (decorative twin) tinted by each
          day's score on the stage ramp — the same colour the calendar gives that day. */}
      <div className="rcover">
        <div className="rcov-top">
          <div className="num rcov-num">{n}<small>/30</small></div>
          <div className="rcov-text"><b>{n === 1 ? "day" : "days"} logged</b><span>{fmt(from)} – {fmt(todayIso)} · {stageName}</span><span className="rcov-meta">logged by you · prepared {fmt(todayIso)}</span></div>
        </div>
        <div className="rcov-cells" aria-hidden="true">
          {cells.map((iso) => {
            if (loggedSet.has(iso)) { const s = scoreOn(iso); return <i key={iso} className="on" style={s != null ? { background: scoreColor(s) } : undefined} />; }
            return <i key={iso} className={iso === todayIso ? "today" : ""} />;
          })}
        </div>
        {!todayLogged && !thin && <p className="rcov-today">Today isn't logged yet. <button type="button" className="linkbtn" onClick={logToday}>Log today</button></p>}
      </div>

      {thin ? (
        <>
          <p className="hint" style={{ marginTop: 12 }}>You haven't logged much yet. A week or two of check-ins is enough to start seeing something real.</p>
          <button type="button" className="cta" onClick={logToday}>Log today</button>
          <p className="rsec" style={{ marginTop: 18 }}>Send it ahead</p>
          {sendAhead}
        </>
      ) : (
        <>
          {n < 7 && <p className="hint" style={{ margin: "4px 0 12px" }}>A week or two of check-ins makes this a lot stronger.</p>}

          <Sec n={1}>What stands out</Sec>
          <div className="plaincard">
            {top.length === 0 ? (
              <p className="plain">You haven't logged much yet. A week or two of check-ins is enough to start seeing something real.</p>
            ) : top.map((c, idx) => {
              const f = famOf(c.id);
              const prev = prevFor(c);
              return (
                <div className="finding" key={c.id}>
                  <div className="fhead"><i className="fdot" style={{ background: f.color }} aria-hidden="true" /><b>{c.label}</b><span className="fchip" style={{ background: tint(f.color, 16) }}>{inWords(c.days, n)}</span></div>
                  <Meter color={f.color} any={frac(c.days)} strong={frac(c.strong)} mounted={mounted} />
                  {idx === 0 && <p className="flegend fleg"><span>Filled = days it showed up</span><span>{strongMeterWord(scheme)} = moderate or strong</span><span>Ticks = most days · nearly every day</span></p>}
                  <p className="plain fsub"><b className="fcount">{c.days} of {n} days</b>{c.strong > 0 ? `, ${c.strong} of them moderate or strong` : ""}.{prev != null && <> <Delta prev={prev} cur={c.days} /></>}</p>
                </div>
              );
            })}
            {ins.variability != null && (
              <div className="finding">
                <div className="fhead"><i className="fdot" style={{ background: "var(--primary)" }} aria-hidden="true" /><b>Your periods came {ins.variability >= 7 ? "at quite different times" : "fairly steadily"}</b><span className="fchip" style={{ background: tint("var(--primary)", 14) }}>{ins.variability}-day spread</span></div>
                <CycleDots lens={lensList.map((x) => x.len)} outs={lensList.map((x) => x.excluded)} />
                <p className="plain fsub">{lensList.map(lensLabel).join(", ")} days apart. Doctors call that a {ins.variability}-day spread.</p>
              </div>
            )}
            {fert && <FertilityFinding sum={fsum} unit={fert.unit} />}
            {/* L8: the 60-day sleep link (engine sleepLink, same-day pairing, with its thresholds); an observation, not a cause. */}
            {stage === "peri" && ins.hfMult != null && (
              <div className="finding fstat">
                <div className="num">{ins.hfMult.toFixed(1)}×</div>
                <p className="plain"><b>Rough nights and hot flashes went together.</b> In your log, hot flashes were moderate or strong about {ins.hfMult.toFixed(1)} times as often after a rough night.</p>
              </div>
            )}
          </div>

          <Sec n={2}>What this might mean</Sec>
          <div className="plaincard">
            {meanings.map((m) => (
              <div className="meaning" key={m.k} style={{ borderLeftColor: `color-mix(in srgb, ${m.color} 55%, var(--card))` }}>
                <span className="mfamrow"><i className="fdot" style={{ background: m.color }} aria-hidden="true" /><span className="mfam">{m.fam}</span></span>
                <b className="mhead">{m.head}</b>
                <p className="plain">{m.text}</p>
                {m.more && <Details label="Why this matters"><p className="plain">{m.more}</p></Details>}
              </div>
            ))}
            {meanings.length === 0 && <p className="plain">Nothing in your log crosses the thresholds doctors usually ask about — that's useful to say too.</p>}
            <p className="rfoot mnote">These are patterns in what you logged — observations, not a diagnosis. Only your doctor can say what's causing them.</p>
          </div>

          <Sec n={3}>What to say out loud</Sec>
          <p className="hint" style={{ marginBottom: 10 }}>Read these word for word if it helps. Up to three can go in the email and the PDF.</p>
          <div className="plaincard">
            {scripts.map((s, i) => {
              const on = picked.includes(i);
              return (
                <div className="scriptrow" key={i}>
                  <span className="sbadge" aria-hidden="true">{i + 1}</span>
                  <div className="sbody">
                    <p className="script">“{s}”</p>
                    <button type="button" className={`linkbtn sadd${on ? " on" : ""}`} aria-pressed={on} disabled={!on && picked.length >= PICK_MAX} onClick={() => togglePick(i)}>{on ? "Added ✓" : "Add to email and PDF"}</button>
                  </div>
                  <button type="button" className={`linkbtn scopy${copied === i ? " ok" : ""}`} aria-label={`Copy question ${i + 1}`} onClick={() => copyScript(s, i)}>{copied === i ? "Copied" : "Copy"}</button>
                </div>
              );
            })}
          </div>

          <Sec n={4}>Send it ahead</Sec>
          {sendAhead}
        </>
      )}

      <button type="button" className="disclosure" style={{ marginTop: 14 }} aria-expanded={showTable} aria-controls="report-table" onClick={() => setShowTable((v) => !v)}>
        <span>The numbers behind this</span><Icon name="chevron" className="chev" />
      </button>
      {showTable && (
        <div className="bodypanel" id="report-table">
          <div className="rtitle" style={{ fontSize: 15, marginTop: 10 }}>Symptom log <span className="rmeta">{stageName} · {ins.last30.length ? `${fmt(ins.last30[0].date)}–${fmt(ins.last30[ins.last30.length - 1].date)}` : "nothing logged yet"}</span></div>
          <table className="rtab"><thead><tr><th>Symptom</th><th>Days (of {n} logged)</th><th>Mod.–strong</th></tr></thead>
            <tbody>{ins.counts.map((c) => {
              const f = famOf(c.id);
              return (
                <tr key={c.id}>
                  <td><i className="fdot" style={{ background: f.color }} aria-hidden="true" /> {c.label}</td>
                  <td><span className="tbar" aria-hidden="true" style={{ "--fc": f.color }}><i style={{ width: pct(c.days) }} /></span>{c.days}/{n}</td>
                  <td>{c.strong}</td>
                </tr>
              );
            })}</tbody></table>
          {/* L9: the same cycle table, day-score sentence and (when ticked) notes as the appointment PDF — this page is its accessible version. */}
          {visit && visit.cycles.rows.length > 0 && (
            <table className="rtab"><caption className="rcap">Recent cycles</caption>
              <thead><tr>{visit.cycles.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>{visit.cycles.rows.map((r) => <tr key={r.start}>{r.cells.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          )}
          {ins.variability != null && <p className="rfoot">Cycle lengths: {lensList.map(lensLabel).join(", ")} days ({ins.variability}-day spread).</p>}
          {visit && <p className="rfoot">Day score (0–100, higher is a better day): {visit.trend.sentence}</p>}
          {visit && withNotes && visit.notes.length > 0 && (
            <>
              <p className="rcap">My day notes</p>
              <ul className="rnotes">{visit.notes.map(({ iso, text }) => <li key={iso}><b>{fmt(iso)}</b> {text}</li>)}</ul>
            </>
          )}
          {visit && visit.meals && (
            <>
              <p className="rcap">{t("report.mealNotes")}</p>
              <ul className="rnotes rmeals">{visit.meals.map((l) => <li key={l}>{l}</li>)}</ul>
            </>
          )}
          <p className="rfoot">Logged daily by you. Observations, not diagnoses.</p>
        </div>
      )}
    </main>
  );
}
