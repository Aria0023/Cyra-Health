import { SYMS, PSYM, READS } from "../lib/constants.js";
import { fmt, sevDots } from "../lib/engine.js";

/* Cycle & Peri — Today: cycle-status card, live score meter, quick or full
   check-in, sleep quality, body signals, save, phase-appropriate daily read.
   Also the edit form for a day picked from the Calendar. */
export default function TodayScreen({ pred, stage, welcome, editDate, setEditDate, setDraft, setSleepQ, scoreMeter, quickMode, quickCheckin, symIds, symMap, draft, sleepQ, scaleSection, bodySection, todayIso, editPeriod, scales, flow, disch, odor, setDays, ping, setAppTab, contribute }) {
  return (
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
          <button key={id} aria-pressed={(draft[id] || 0) > 0} aria-label={`${symMap[id]}, severity ${draft[id] || 0} of 3`} className={`chip sev-${draft[id] || 0}`} onClick={() => setDraft((d) => ({ ...d, [id]: ((d[id] || 0) + 1) % 4 }))}>
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
        if (!editDate) contribute({ sym: mapped, sleepQ: sleepQ || "fair", flow });
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
  );
}
