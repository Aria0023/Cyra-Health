import { flagWords } from "../lib/pulse.js";
import { GSYM, PREG_TIPS } from "../lib/constants.js";
import { sevDots } from "../lib/engine.js";
import Advice from "../components/Advice.jsx";

/* Pregnancy — Today: week + trimester + progress to 40, weekly read, pregnancy
   symptoms, scales, body signals, kick counter, red-flag swelling advice. */
export default function PregTodayScreen({ pregWeek, trimester, scoreMeter, draft, setDraft, symMap, scaleSection, bodySection, kicks, setKicks, setPregLog, todayIso, scales, ping, research, contribute }) {
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
        contribute({ sym: draft, kicks });
      }}>Save today</button>
      {research && <p className="rfoot">Sharing weekly counts is on: which of {flagWords("preg")} today's check-in logged (as it stands when you last save it), plus your life stage group, go to Cyra's server on a later day, at most once a day, with no dates or values. Like any request, it carries your device's internet address. You can turn this off in ⚙ Settings.</p>}
    </main>
  );
}
