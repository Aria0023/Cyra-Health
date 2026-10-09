import { flagWords } from "../lib/pulse.js";
import Details from "../components/Details.jsx";
import { SYMS, PSYM, READS } from "../lib/constants.js";
import { fmt, sevDots, foldQuick } from "../lib/engine.js";

/* Cycle & Peri — Today: cycle-status card, live score meter, quick or full
   check-in, sleep quality, body signals, save, phase-appropriate daily read.
   Also the edit form for a day picked from the Calendar. Saving today's check-in only
   queues weekly-count flags on this device when sharing is on (App.jsx contribute); saving
   it again (also from the Calendar) replaces them, and an edit of an earlier day can only
   take back that day's flags while they are still waiting (it never adds one). A quick check-in asks combined questions ("cramps or bloating"),
   so it adds no symptom flags — only the full check-in's named symptoms, sleep and flow do.
   The form opens on what is already saved for the day (App.jsx loads it), so saving again
   updates that entry; an edit's "Period day" switch is what that day is saved with. */
export default function TodayScreen({ pred, stage, welcome, editDate, onEndEdit, setDraft, setSleepQ, scoreMeter, quickMode, quickCheckin, symIds, symMap, draft, sleepQ, scaleSection, bodySection, todayIso, editPeriod, setEditPeriod, scales, flow, disch, odor, bodyOdor, setDays, ping, setAppTab, research, contribute }) {
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
          <p><b>Editing {fmt(editDate)}</b> — changes save to that day. <button className="linkbtn" onClick={() => onEndEdit()}>Back to today</button></p>
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
      {editDate && (
        <div className="row">
          <button aria-pressed={editPeriod} className={`pill ${editPeriod ? "pill-on" : ""}`} onClick={() => setEditPeriod((v) => !v)}>Period day</button>
        </div>
      )}
      {(!quickMode || editDate) && scaleSection}
      {(!quickMode || editDate) && bodySection}
      <button className="cta" onClick={() => {
        const target = editDate || todayIso;
        // Quick answers (also ones carried over by "more detail" or left from quick mode) are
        // saved as the hero symptoms they ask about.
        const mapped = foldQuick(draft, stage);
        const fromQuick = mapped.__q || {};
        delete mapped.__q;
        const sym = { ...Object.fromEntries([...SYMS, ...Object.keys(PSYM)].map((k) => [k, 0])), ...mapped };
        // Spotting alone is not a period day; an edit keeps the day's own "Period day" switch.
        const bleeding = !!flow && flow !== "spot";
        const entry = { date: target, sleepQ: sleepQ || "fair", period: editDate ? !!editPeriod : bleeding, scales: { ...scales }, flow, disch, odor, bodyOdor, sym };
        setDays((d) => [...d.filter((x) => x.date !== target), entry].sort((a, b) => a.date.localeCompare(b.date)));
        ping(editDate ? `${fmt(target)} updated` : "Saved — check Patterns");
        // Weekly counts: a symptom still at the value a combined quick question gave it adds no flag.
        const flagged = Object.fromEntries(Object.entries(mapped).filter(([k, v]) => !(k in fromQuick && fromQuick[k] === v)));
        contribute({ sym: quickMode && !editDate ? {} : flagged, sleepQ: sleepQ || "fair", flow }, target);
        if (editDate) { onEndEdit(entry); setAppTab("cal"); } else { setDraft(Object.keys(fromQuick).length ? { ...sym, __q: fromQuick } : sym); setAppTab("patterns"); }
      }}>{editDate ? `Save changes to ${fmt(editDate)}` : "Save today's check-in"}</button>
      {research && !editDate && (
        <>
          <p className="rfoot">Sharing weekly counts is on: which of {flagWords(stage)} this check-in logged, plus your life stage group, go to Cyra's server on a later day, with no dates or values.</p>
          <Details label="Exactly what's sent">
            <ul>
              <li>Until it's sent on a later day, saving this check-in again today replaces what it counts, and a fix from the Calendar on a later day can only take flags back, never add one. A fix after it's sent can't change counts already sent.</li>
              {quickMode && <li>{stage === "peri" ? "A quick check-in shares only whether you had a poor night's sleep." : "A quick check-in shares only whether you logged a heavy-flow day."}</li>}
              <li>Sent at most once a day. Like any request, it carries your device's internet address.</li>
              <li>You can turn this off in ⚙ Settings.</li>
            </ul>
          </Details>
        </>
      )}
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
