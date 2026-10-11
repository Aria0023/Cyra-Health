import { useMemo, useState } from "react";
import { setSettings, newId } from "../../lib/pots.js";
import { reportModel, toCSV, summaryText, emailParts, reportPdf, modelTexts, pdfLossy, fmtDay, questionIn } from "../../lib/potsReport.js";
import { saveFile } from "../../lib/files.js";
import { isNative } from "../../lib/native.js";
import { RAMPS } from "../../lib/constants.js";
import Details from "../Details.jsx";
import { HrChart, TrendChart } from "./HrChart.jsx";
import { CheckRow, Choice } from "./StandSafety.jsx";

/* POTS → Report (design 6.1): "For your clinician". A report she makes and takes herself: a
   PDF, a spreadsheet, a summary to copy, or an email draft. Cyra itself sends nothing: the
   files are built on this device (lib/potsReport.js; the PDF writer lib/pdf.js is loaded only
   when she taps it) and go only where she saves or shares them (lib/files.js). No watch, ring
   or health-app reading is an input here, registration answers aren't either, and typed notes,
   her first name and her life-stage details go in only while she ticks them. Every file is
   an ordinary unlocked file, and the screen says so every time.

   The preview below the buttons is an on-screen copy of exactly what the PDF holds, with real
   tables and labelled charts; it and the spreadsheet are the accessible versions of the PDF,
   which is untagged. Her own visit questions are kept in settings.questions. */
export const FIXED_LINE = "Watch and ring readings aren't included in this report or spreadsheet.";
export const WARNING = "This file isn't locked. Anyone who gets it can read it. Send it straight to your clinician or their patient portal, and avoid group chats or shared folders.";
export const REPORT_HINT = "Make a report to send or print. Cyra itself sends nothing; the file goes only where you take it.";
export const WINANSI_WARNING = "Some characters you typed, such as in your own symptom or medicine names, can't be shown in the PDF and will appear as '?' or be left out. The spreadsheet keeps them exactly.";
const PERIODS = [["30", "Last 30 days"], ["90", "Last 90 days"], ["all", "Everything"]];
const PARTS = [["tests", "Stand tests, single readings and tilt-table results"], ["sym", "Symptoms, ratings and episodes"], ["fluid", "Fluids and sodium"], ["meds", "Medicines and supports"]];

/** What a generated question is about, per Report part, for the "stay out of the files" note. */
const PART_TOPIC = { tests: "your stand tests", fluid: "your fluid and salt goal", meds: "your medicines" };
const andWords = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
const rgb = (c) => `rgb(${c.join(",")})`;

/** Oral fluid per day, as the PDF draws it: a bar per logged day (ramp().mid), nothing for a
    day not logged, the goal as a dashed ink line. Every value is in the aria-label. */
function FluidBars({ b, stage }) {
  const ramp = RAMPS[stage] || RAMPS.peri;
  const W = 340, H = 130, L = 6, R = 6, T = 14, B = 26;
  const max = Math.max(1, b.goal || 0, ...b.days.map((d) => d.v || 0)) * 1.1;
  const step = (W - L - R) / b.days.length, bw = Math.max(2, step * 0.7);
  const y = (v) => H - B - (v / max) * (H - T - B);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={b.label} style={{ display: "block", margin: "6px 0 10px" }}>
      <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="var(--line)" strokeWidth="1.5" />
      {b.days.map((d, i) => {
        const cx = L + step * i + step / 2;
        return (
          <g key={d.date}>
            {d.v != null && <rect x={cx - bw / 2} y={y(d.v)} width={bw} height={H - B - y(d.v)} fill={rgb(ramp.mid)} />}
            {(i % 7 === 0 || i === b.days.length - 1) && <text x={cx} y={H - B + 14} fontSize="10" textAnchor="middle" fill="var(--ink)">{fmtDay(d.date)}</text>}
          </g>
        );
      })}
      {b.goal != null && <line x1={L} y1={y(b.goal)} x2={W - R} y2={y(b.goal)} stroke="var(--ink)" strokeWidth="1.2" strokeDasharray="4 4" />}
    </svg>
  );
}

/** The on-screen preview: the same blocks the PDF draws, as HTML. */
function Preview({ model, stage }) {
  const h = model.header;
  return (
    <div className="potspreview">
      <p className="plain"><b>{h.line}</b></p>
      <p className="hint" style={{ margin: "0 0 6px" }}>{h.made}</p>
      {h.context.map((c) => <p className="plain" key={c} style={{ margin: "0 0 2px" }}>{c}</p>)}
      {h.rated && <p className="plain"><b>{h.rated}</b></p>}
      {model.sections.map((sec, i) => (
        <section key={sec.id} aria-labelledby={`pots-pv-${sec.id}`}>
          <h3 className="lab" id={`pots-pv-${sec.id}`} style={{ marginTop: 16 }}>{`${i + 1}. ${sec.title}`}</h3>
          {sec.blocks.map((b, j) => {
            const k = `${sec.id}-${j}`;
            if (b.t === "p") return <p key={k} className={b.small ? "rfoot" : "plain"} style={{ margin: "0 0 6px" }}>{b.text}</p>;
            if (b.t === "list") return <div key={k}>{b.items.map((q) => <p className="script" key={q}>{q}</p>)}</div>;
            if (b.t === "table") {
              return (
                <div key={k} className="potstablewrap" role="region" aria-label={b.caption} tabIndex={0}>
                  <table className="rtab potsrtab">
                    <caption>{b.caption}</caption>
                    <thead><tr>{b.head.map((c) => <th scope="col" key={c}>{c}</th>)}</tr></thead>
                    <tbody>{b.rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}>{c}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              );
            }
            if (b.t === "hr") return <div key={k}>{b.charts.map((c) => <div key={c.test.id}><p className="plain" style={{ margin: "8px 0 0" }}><b>{c.title}</b></p><HrChart test={c.test} result={c.result} stage={stage} /></div>)}</div>;
            if (b.t === "trend") return <div key={k}><p className="plain" style={{ margin: "8px 0 0" }}><b>{`Largest rise in each complete ${b.methodLabel}${b.median != null ? ` (median ${Math.round(b.median * 10) / 10})` : ""}`}</b></p><TrendChart rows={b.rows} thr={b.thr} stage={stage} methodLabel={b.methodLabel} /></div>;
            if (b.t === "bars") return <div key={k}><p className="plain" style={{ margin: "8px 0 0" }}><b>{`Oral fluid per day${b.goal != null ? " (dashed: your goal)" : ""}`}</b></p><FluidBars b={b} stage={stage} /></div>;
            return null;
          })}
        </section>
      ))}
      <p className="rfoot">Each PDF page ends: "Cyra · Observations, not a diagnosis."</p>
    </div>
  );
}

export default function PotsReport({ pots, setPots, stage, stageName, todayIso, ping, firstName = "", checkin, checkinLabels, locale }) {
  const s = pots.settings;
  const [period, setPeriod] = useState("30");
  const [parts, setParts] = useState({ tests: true, sym: true, fluid: true, meds: true });
  const [withName, setWithName] = useState(false);
  const [busy, setBusy] = useState(null); // "pdf" | "csv" | null
  const [newQ, setNewQ] = useState("");
  const phone = isNative();
  const include = { ...parts, cycle: s.reportCycle !== false, notes: s.reportNotes === true, name: withName && !!firstName };
  const model = useMemo(
    () => reportModel(pots, { period, today: todayIso, include, name: firstName, stage, stageName, checkin, checkinLabels, locale }),
    // `include` is rebuilt each render; its parts are listed one by one.
    [pots, period, todayIso, parts.tests, parts.sym, parts.fluid, parts.meds, include.cycle, include.notes, include.name, firstName, stage, stageName, checkin, checkinLabels, locale], // eslint-disable-line
  );
  if (!model) return null;
  const email = emailParts(model), summary = summaryText(model);
  const lossyText = modelTexts(model).some(pdfLossy);
  const set = (patch) => setPots((p) => setSettings(p, patch));

  const exportFile = async (kind) => {
    if (!model.enough || busy) return;
    setBusy(kind);
    try {
      let data, name, mime, title;
      if (kind === "pdf") {
        // The PDF writer is its own chunk, fetched on the first tap. It can fail to load (offline
        // since the app opened, or a new version deployed while this tab stayed open): say what
        // to do instead of showing the browser's module error.
        let PdfDoc;
        try { ({ PdfDoc } = await import("../../lib/pdf.js")); } catch { ping("Couldn't load the PDF maker. Reload Cyra and try again, or save the spreadsheet."); return; }
        data = reportPdf(model, PdfDoc); name = model.files.pdf; mime = "application/pdf"; title = "Cyra report";
      } else {
        data = toCSV(model); name = model.files.csv; mime = "text/csv;charset=utf-8"; title = "Cyra spreadsheet";
      }
      const r = await saveFile({ name, data, mime, title, onReady: () => ping("Report ready. Choose where to send it") });
      if (r === "downloaded") ping(kind === "pdf" ? "Report downloaded. It's in your browser's downloads" : "Spreadsheet downloaded. It's in your browser's downloads");
    } catch (e) { ping(e?.message || "Couldn't make the file"); }
    finally { setBusy(null); }
  };
  const copy = () => {
    if (!model.enough) return;
    const blocked = () => ping("Copy blocked. Select the text in the preview below");
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(summary).then(() => ping("Summary copied. Paste it into your message"), blocked); else blocked();
  };
  const openEmail = () => {
    if (!model.enough) return;
    window.open(`mailto:?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`);
    ping("Handing off to your email… If nothing opens, use Copy summary text instead.");
  };
  const gate = model.enough ? {} : { "aria-disabled": "true", "aria-describedby": "pots-rep-gate" };
  // While a file is being made its button reads as unavailable but keeps focus (a disabled
  // button would drop focus to the page); exportFile's busy guard ignores a second tap.
  const busyGate = (kind) => (busy === kind ? { ...gate, "aria-disabled": "true" } : gate);
  const gen = model.questions.generated, own = model.questions.own;
  // Report parts she unticked that keep one of the generated questions out of the files
  // (a life-stage question already has its own note while cycle details are unticked).
  const partsOut = PARTS.filter(([k]) => !parts[k] && gen.some((q) => q.part === k && (include.cycle || !q.stageBased) && !questionIn(q, include)));
  const addQ = () => { const t = newQ.trim().slice(0, 200); if (!t || own.length >= 10) return; set({ questions: [...own, { id: newId(), text: t }] }); setNewQ(""); };

  return (
    <section className="potsreport" aria-labelledby="pots-rep-h">
      <h2 className="rsec" id="pots-rep-h" tabIndex={-1}>For your clinician</h2>
      <p className="hint">{REPORT_HINT}</p>

      <Choice id="pots-rep-period" label="Period" value={period} options={PERIODS} onPick={setPeriod} />
      <p className="lab" id="pots-rep-inc">Include</p>
      <div role="group" aria-labelledby="pots-rep-inc">
        {PARTS.map(([k, l]) => <CheckRow key={k} on={parts[k]} onToggle={() => setParts((x) => ({ ...x, [k]: !x[k] }))}>{l}</CheckRow>)}
        <CheckRow id="pots-rep-cycle" on={include.cycle} onToggle={() => set({ reportCycle: !include.cycle })}>Cycle or pregnancy details</CheckRow>
        <p className="hint" style={{ margin: "4px 0 0" }}>Untick to leave out your life stage, pregnancy and the symptoms your check-ins also logged.</p>
        <CheckRow on={include.notes} onToggle={() => set({ reportNotes: !include.notes })}>Notes I typed</CheckRow>
        {firstName && <CheckRow on={withName} onToggle={() => setWithName((v) => !v)}>Put my first name on it</CheckRow>}
      </div>

      <section className="plaincard" aria-labelledby="pots-q-h" style={{ marginTop: 14 }}>
        <h3 className="lab" id="pots-q-h" tabIndex={-1} style={{ marginTop: 0 }}>Questions for my next visit</h3>
        <p className="hint" style={{ margin: "0 0 8px" }}>These go in your report. Cyra suggests some from your log for the period above; add your own.</p>
        {gen.map((q) => <p className="script" key={q.id}>{q.text}</p>)}
        {!include.cycle && gen.some((q) => q.stageBased) && <p className="hint" style={{ margin: "0 0 8px" }}>Questions about your life stage stay out of the files while "Cycle or pregnancy details" is unticked.</p>}
        {partsOut.length > 0 && <p className="hint" style={{ margin: "0 0 8px" }}>{`Questions about ${andWords(partsOut.map(([k]) => PART_TOPIC[k]))} stay out of the files while ${partsOut.length === 1 ? `"${partsOut[0][1]}" is` : "those parts are"} unticked.`}</p>}
        {own.map((q) => (
          <div className="medrow" key={q.id}>
            <div className="medinfo"><span style={{ color: "var(--ink)", fontSize: 14 }}>{q.text}</span></div>
            <button type="button" className="sbtn" aria-label={`Remove your question: ${q.text}`} onClick={() => { set({ questions: own.filter((x) => x.id !== q.id) }); document.getElementById("pots-q-h")?.focus(); }}>Remove</button>
          </div>
        ))}
        {own.length < 10 ? (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 8 }}>
            <input className="inp" aria-label="Your own question" placeholder="Your own question" maxLength={200} value={newQ} onChange={(e) => setNewQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addQ(); }} />
            <button type="button" className="sbtn" onClick={addQ}>Add</button>
          </div>
        ) : <p className="hint">You have 10 questions, the most there can be. Remove one to add another.</p>}
      </section>

      <p className="plain" style={{ marginTop: 14 }}>{FIXED_LINE}</p>
      <div className="plaincard"><p className="plain">{WARNING}</p></div>
      {lossyText && <p className="hint">{WINANSI_WARNING}</p>}
      {!model.enough && <p className="plain" id="pots-rep-gate"><b>Log a standing test or a few days first.</b></p>}
      <div className="routes" style={{ flexWrap: "wrap" }}>
        <button type="button" className="route" {...busyGate("pdf")} onClick={() => exportFile("pdf")}>{phone ? "Share PDF report…" : "Save PDF report"}<span>charts and tables</span></button>
        <button type="button" className="route" {...busyGate("csv")} onClick={() => exportFile("csv")}>{phone ? "Share spreadsheet…" : "Save spreadsheet (CSV)"}<span>every reading</span></button>
        <button type="button" className="route" {...gate} onClick={copy}>Copy summary text<span>for a portal message</span></button>
      </div>
      <div className="routes" style={{ marginTop: 8 }}>
        <button type="button" className="route" {...gate} onClick={openEmail}>Open in email<span>pre-filled draft</span></button>
      </div>
      <p className="hint" style={{ margin: "10px 0 4px" }}>{`The email's subject line is "${email.subject}".`}</p>
      <textarea className="inp emailpreview" readOnly rows={9} aria-label="Summary preview" value={summary} onFocus={(e) => e.target.select()} />

      <Details label="Preview the PDF report">
        <Preview model={model} stage={stage} />
      </Details>
    </section>
  );
}
