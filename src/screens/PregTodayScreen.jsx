import { useRef, useState } from "react";
import { flagWords } from "../lib/pulse.js";
import Details from "../components/Details.jsx";
import { GSYM, PREG_TIPS, famColor } from "../lib/constants.js";
import { sevDots, fmt } from "../lib/engine.js";
import { chipLayout, cleanNote } from "../lib/daylog.js";
import Advice from "../components/Advice.jsx";
import Icon from "../components/Icon.jsx";
import SymptomSheet from "../components/SymptomSheet.jsx";
import DayNote from "../components/DayNote.jsx";

/* Pregnancy — Today: week + trimester + progress to 40, weekly read, pregnancy
   symptoms, scales, body signals, kick counter, red-flag swelling advice. Opens on what is
   already saved for the day (App.jsx loads it, and keeps today's kick count on the device
   between taps); also the edit form for a day picked from the Calendar.
   L6: her symptom list for pregnancy (order and Hide only, lib/daylog.js; nothing is borrowed into GSYM) behind the
   same "Symptoms · Edit" row as Today, and the day note after the advice card (never handed to contribute()). */
export default function PregTodayScreen({ onPots = null, pregWeek, trimester, scoreMeter, draft, setDraft, symMap, scaleSection, bodySection, kicks, onKick, setPregLog, todayIso, editDate, onEndEdit, savedToday = false, yesterdayIso = null, yesterdayLogged = true, anyLogged = false, onEditDay = null, symPrefs = {}, setSymPrefs = () => {}, dayNote = "", setDayNote = () => {}, scales, odor, bodyOdor, ping, research, contribute, logTop = null }) {
  // UI state only, never saved: the "Your symptoms" sheet and the "More symptoms" panel.
  const [symEdit, setSymEdit] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const editRef = useRef(null);
  const { first, more } = chipLayout("preg", symPrefs);
  // A hidden symptom with a value is lifted into the grid while More symptoms is closed; once lifted it stays there
  // until the panel is next opened, so tapping it back to 0 never pulls the focused chip out of the page.
  const keepLifted = useRef(new Set());
  if (moreOpen || symEdit) keepLifted.current.clear();
  const lifted = moreOpen ? [] : more.filter((id) => (draft[id] || 0) > 0 || keepLifted.current.has(id));
  lifted.forEach((id) => keepLifted.current.add(id));
  const chip = (id) => {
    const label = GSYM[id];
    const sev = draft[id] || 0;
    return (
      <button key={id} aria-pressed={sev > 0} aria-label={`${(symMap[id] || label)}, severity ${sev} of 3`} className={`chip sev-${sev}`} style={{ "--fc": famColor(id) }} onClick={() => setDraft((d) => ({ ...d, [id]: ((d[id] || 0) + 1) % 4 }))}>
        <span>{label}</span><span key={sev} className="dots" aria-hidden="true" data-tick={sev || undefined}>{sevDots(sev)}</span>
      </button>
    );
  };
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
        <div className="card editbar" style={{ display: "block", margin: "16px 0 12px" }}>
          <p><b>Editing {fmt(editDate)}</b> — changes save to that day. <button className="linkbtn" onClick={() => onEndEdit()}>Back to today</button></p>
        </div>
      )}
      <h1 className="disp" style={{ marginTop: 16 }}>{editDate ? `Fixing up ${fmt(editDate)}` : "How's today going?"}</h1>
      {!yesterdayLogged && !editDate && anyLogged && onEditDay && <button type="button" className="linkbtn yday" onClick={() => onEditDay(yesterdayIso)}>Yesterday not logged · add it</button>}
      {logTop}
      {logTop && <h2 className="checkhead">{editDate ? `Check-in for ${fmt(editDate)}` : "Today's check-in"}</h2>}
      <p className="hint">Tap a symptom once for mild, up to 3× for strong.</p>
      {scoreMeter}
      {savedToday && !editDate && <p className="savedline"><Icon name="check" size={14} /> Logged today — any change here updates it.</p>}
      <div className="chiphead">
        <p className="section-lab" id="sym-lab">Symptoms</p>
        <button type="button" ref={editRef} className="linkbtn" aria-label="Edit symptoms" aria-expanded={symEdit} aria-controls="sym-sheet" onClick={() => setSymEdit((v) => !v)}>Edit</button>
      </div>
      {symEdit ? (
        <SymptomSheet stage="preg" symPrefs={symPrefs} setSymPrefs={setSymPrefs} days={[]} onClose={() => { setSymEdit(false); editRef.current?.focus(); }} />
      ) : (
        <>
          <div className="chips" role="group" aria-labelledby="sym-lab">{[...first, ...lifted].map(chip)}</div>
          {more.length > 0 && (
            <>
              <button type="button" className="disclosure more symmore" aria-expanded={moreOpen} aria-controls="sym-more" onClick={() => setMoreOpen((v) => !v)}>
                <span>More symptoms<span className="dsub"> · {more.length}</span></span><Icon name="chevron" className="chev" />
              </button>
              <div id="sym-more" hidden={!moreOpen}>{moreOpen && <div className="chips morechips" role="group" aria-label="More symptoms">{more.map(chip)}</div>}</div>
            </>
          )}
        </>
      )}
      {scaleSection}
      {bodySection}
      {/* The kick counter is a tool, not the day's primary action: tinted and outlined inside its own card, so "Save today" is the one filled CTA. */}
      <div className="plaincard kickcard">
        <p className="section-lab">Kick counter</p>
        <div className="kickrow">
          <button className="cta cta-kick" style={{ flex: 1 }} onClick={onKick}>Kick! <Icon name="foot" /></button>
          <div className="kickcount" aria-live="polite"><b>{kicks}</b><span>{editDate ? "kicks that day" : "kicks today"}</span></div>
        </div>
      </div>
      {draft.swl >= 2 ? (
        <Advice urgency="now" alone>Sudden or severe swelling — especially with headaches or vision changes — is a call-your-provider-today signal, not a wait-and-see one.</Advice>
      ) : (
        <Advice urgency="self" alone>Logging daily builds the record your provider actually uses at each visit — and the kick pattern matters more than any single count.</Advice>
      )}
      <DayNote key={editDate || "today"} value={dayNote} onChange={setDayNote} label={editDate ? `Note for ${fmt(editDate)}` : "Note for today"} />
      <div className="stopbar savebar"><button className="cta" onClick={() => {
        const target = editDate || todayIso;
        // Her day note (D7), trimmed and only when there is one; contribute() below never gets it.
        const note = cleanNote(dayNote);
        const entry = { sym: { ...draft }, kicks, scales: { ...scales }, odor, bodyOdor, ...(note ? { note } : {}) };
        setPregLog((l) => ({ ...l, [target]: entry }));
        ping(editDate ? `${fmt(target)} updated` : "Saved to your pregnancy journal — see Calendar");
        contribute({ sym: draft, kicks }, target);
        if (editDate) onEndEdit(entry, target); else setDayNote(note);
      }}>{editDate ? `Save changes to ${fmt(editDate)}` : "Save today"}</button></div>
      {onPots && !editDate && <button className="linkbtn potslink" style={{ marginTop: 10 }} onClick={onPots}>Log POTS symptoms and drinks →</button>}
      {research && !editDate && (
        <>
          <p className="rfoot">Sharing weekly counts is on: which of {flagWords("preg")} today's check-in logged, plus your life stage group, go to Cyra's server on a later day, with no dates or values.</p>
          <Details label="Exactly what's sent">
            <ul>
              <li>The check-in counts as it stands when you last save it.</li>
              <li>Sent at most once a day. Like any request, it carries your device's internet address.</li>
              <li>You can turn this off in <Icon name="sliders" size={12} className="labico" />Settings.</li>
            </ul>
          </Details>
        </>
      )}
    </main>
  );
}
