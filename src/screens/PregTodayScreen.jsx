import { flagWords } from "../lib/pulse.js";
import Details from "../components/Details.jsx";
import { GSYM, PREG_TIPS } from "../lib/constants.js";
import { sevDots, fmt } from "../lib/engine.js";
import Advice from "../components/Advice.jsx";

/* Pregnancy — Today: week + trimester + progress to 40, weekly read, pregnancy
   symptoms, scales, body signals, kick counter, red-flag swelling advice. Opens on what is
   already saved for the day (App.jsx loads it, and keeps today's kick count on the device
   between taps); also the edit form for a day picked from the Calendar. */
export default function PregTodayScreen({ pregWeek, trimester, scoreMeter, draft, setDraft, symMap, scaleSection, bodySection, kicks, onKick, setPregLog, todayIso, editDate, onEndEdit, scales, odor, bodyOdor, ping, research, contribute }) {
  return (
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

      {editDate && (
        <div className="card" style={{ display: "block", margin: "16px 0 12px" }}>
          <p><b>Editing {fmt(editDate)}</b> — changes save to that day. <button className="linkbtn" onClick={() => onEndEdit()}>Back to today</button></p>
        </div>
      )}
      <h1 className="disp" style={{ marginTop: 16 }}>{editDate ? `Fixing up ${fmt(editDate)}` : "How's today going?"}</h1>
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
        <button className="cta" style={{ flex: 1 }} onClick={onKick}>Kick! 👣</button>
        <div className="kickcount"><b>{kicks}</b><span>{editDate ? "kicks that day" : "kicks today"}</span></div>
      </div>
      {draft.swl >= 2 ? (
        <Advice urgency="now">Sudden or severe swelling — especially with headaches or vision changes — is a call-your-provider-today signal, not a wait-and-see one.</Advice>
      ) : (
        <Advice urgency="self">Logging daily builds the record your provider actually uses at each visit — and the kick pattern matters more than any single count.</Advice>
      )}
      <button className="cta" style={{ marginTop: 12 }} onClick={() => {
        const target = editDate || todayIso;
        const entry = { sym: { ...draft }, kicks, scales: { ...scales }, odor, bodyOdor };
        setPregLog((l) => ({ ...l, [target]: entry }));
        ping(editDate ? `${fmt(target)} updated` : "Saved to your pregnancy journal — see Calendar");
        contribute({ sym: draft, kicks }, target);
        if (editDate) onEndEdit(entry, target);
      }}>{editDate ? `Save changes to ${fmt(editDate)}` : "Save today"}</button>
      {research && !editDate && (
        <>
          <p className="rfoot">Sharing weekly counts is on: which of {flagWords("preg")} today's check-in logged, plus your life stage group, go to Cyra's server on a later day, with no dates or values.</p>
          <Details label="Exactly what's sent">
            <ul>
              <li>The check-in counts as it stands when you last save it.</li>
              <li>Sent at most once a day. Like any request, it carries your device's internet address.</li>
              <li>You can turn this off in ⚙ Settings.</li>
            </ul>
          </Details>
        </>
      )}
    </main>
  );
}
