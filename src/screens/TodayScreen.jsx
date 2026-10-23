import { useEffect, useRef, useState } from "react";
import { flagWords } from "../lib/pulse.js";
import Details from "../components/Details.jsx";
import Icon from "../components/Icon.jsx";
import SymptomSheet from "../components/SymptomSheet.jsx";
import DayNote from "../components/DayNote.jsx";
import { SYMS, PSYM, READS, famColor } from "../lib/constants.js";
import { fmt, sevDots, foldQuick, periodHead } from "../lib/engine.js";
import { upsertDay } from "../lib/record.js";
import { chipLayout, cleanNote } from "../lib/daylog.js";
import { FERT_FORM_EMPTY, fertEntryFields, FERT_COPY } from "../lib/fertility.js";

/* Cycle & Peri — Today: cycle-status card (day, phase and the same likely-start wording as Home: lib/engine.js periodHead;
   no card when there is no prediction, e.g. in menopause), live score meter, quick or full
   check-in, sleep quality, body signals, save, phase-appropriate daily read.
   Also the edit form for a day picked from the Calendar. Saving today's check-in only
   queues weekly-count flags on this device when sharing is on (App.jsx contribute); saving
   it again (also from the Calendar) replaces them, and an edit of an earlier day can only
   take back that day's flags while they are still waiting (it never adds one). A quick check-in asks combined questions ("cramps or bloating"),
   so it adds no symptom flags — only the full check-in's named symptoms, sleep and flow do.
   The form opens on what is already saved for the day (App.jsx loads it), so saving again
   updates that entry; an edit's "Period day" switch is what that day is saved with.
   "more detail" opens the full form for this visit only (App.jsx `expanded`, UI state; the Quick /
   Full detail preference in Settings is untouched): the chips, scales and "Back to quick check-in"
   replace the quick card. Sharing follows the form on screen: while the quick card is shown no
   symptom flag is added; the expanded form names its symptoms exactly as the full check-in does.
   Body signals is always reachable, so flow can be logged from quick mode (heavy-flow shares as before).
   Family colour (FAMILIES) appears only on the severity dots of a chip that has a value — the one
   data-bearing part of the form; chip borders and backgrounds stay on the UI palette.
   Her symptom list (L6, D8): the chips follow symPrefs for this stage (lib/daylog.js chipLayout); "Edit" opens the
   "Your symptoms" sheet in place of the grid, and hidden symptoms sit under "More symptoms" (one that has a value
   is lifted into the grid while that panel is closed). The day note (D7) follows Body signals in every form; it is
   saved on the entry and never handed to contribute().
   Fertility signs (L7, D6): where App.jsx shows them (fertSection, components/FertilitySigns.jsx) the group sits just
   before Body signals in the quick, full and edit forms. The save writes cm / opk / bbt on the entry from the form state
   (fert, lib/fertility.js fertEntryFields) whether or not the group is shown, so a day saved while it was shown keeps
   them when edited after it's hidden; a temperature that isn't a reading stops the save. The fertility group never
   reaches contribute(): it gets { sym, sleepQ, flow } only. */
export default function TodayScreen({ onPots = null, pred, stage, welcome, editDate, onEndEdit, setDraft, setSleepQ, scoreMeter, quickMode, expanded = false, setExpanded = () => {}, quickCheckin, savedToday = false, yesterdayIso = null, yesterdayLogged = true, onEditDay = null, symPrefs = {}, setSymPrefs = () => {}, dayNote = "", setDayNote = () => {}, symMap, draft, sleepQ, scaleSection, bodySection, todayIso, editPeriod, setEditPeriod, scales, flow, disch, odor, bodyOdor, days = [], setDays, onSaved = null, ping, setAppTab, research, contribute, fertSection = null, fert = FERT_FORM_EMPTY, tempUnit = "C", fertOn = false }) {
  // The quick card is on screen: quick mode, not an edit, not expanded for this visit. Everything that
  // depends on "which form is this" (hint, chips, the peri sleep pills, what contribute() sends) keys on it.
  const quickCard = quickMode && !editDate && !expanded;
  // UI state only, never saved: the "Your symptoms" sheet and the "More symptoms" panel.
  const [symEdit, setSymEdit] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const editRef = useRef(null);
  useEffect(() => { if (quickCard) setSymEdit(false); }, [quickCard]);
  const { first, more } = chipLayout(stage, symPrefs);
  // A hidden symptom with a value is lifted into the grid while More symptoms is closed; once lifted it stays there
  // until the panel is next opened, so tapping it back to 0 never pulls the focused chip out of the page.
  const keepLifted = useRef(new Set());
  if (moreOpen || symEdit) keepLifted.current.clear();
  const lifted = moreOpen ? [] : more.filter((id) => (draft[id] || 0) > 0 || keepLifted.current.has(id));
  lifted.forEach((id) => keepLifted.current.add(id));
  const chip = (id) => {
    const sev = draft[id] || 0;
    return (
      <button key={id} aria-pressed={sev > 0} aria-label={`${symMap[id]}, severity ${sev} of 3`} className={`chip sev-${sev}`} style={{ "--fc": famColor(id) }} onClick={() => setDraft((d) => ({ ...d, [id]: ((d[id] || 0) + 1) % 4 }))}>
        <span>{symMap[id]}</span><span key={sev} className="dots" aria-hidden="true" data-tick={sev || undefined}>{sevDots(sev)}</span>
      </button>
    );
  };
  return (
    <main>
      {pred && (
        <div className="phasecard">
          <div className="phaseday">Day {pred.cycleDay}</div>
          <div className="phaseinfo">
            <b>{pred.phase[0].toUpperCase() + pred.phase.slice(1)} phase</b>
            <span>{pred.state === "later" ? `Later than your usual range, which ended ${fmt(pred.toIso)}${stage === "peri" ? " — with your spread, irregularity is data too." : "."}` : `${periodHead(pred)}.`}</span>
          </div>
        </div>
      )}
      {pred && (
        <div className="readcard compact">
          <div className="rsec" style={{ margin: "0 0 4px" }}>Today's read · {pred.phase} phase</div>
          <div className="sname">{READS[pred.phase][0]}</div>
          <p className="hint" style={{ margin: "4px 0 0" }}>{READS[pred.phase][1]}</p>
        </div>
      )}
      {editDate && (
        <div className="card editbar" style={{ display: "block", marginBottom: 12 }}>
          <p><b>Editing {fmt(editDate)}</b> — changes save to that day. <button className="linkbtn" onClick={() => onEndEdit()}>Back to today</button></p>
        </div>
      )}
      <h1 className="disp" style={pred ? { marginTop: 16 } : undefined}>{editDate ? `Fixing up ${fmt(editDate)}` : stage === "periods" ? "Hey — how's today?" : "How was today, honestly?"}</h1>
      {welcome && !editDate && days.length === 0 && <p className="hint welcome-line">{welcome}</p>}
      {/* A missed day is one tap away (the same "Fixing up <date>" flow the Calendar opens). */}
      {!yesterdayLogged && !editDate && days.length > 0 && onEditDay && <button type="button" className="linkbtn yday" onClick={() => onEditDay(yesterdayIso)}>Yesterday not logged · add it</button>}
      <p className="hint">{quickCard ? "Three quick questions — about ten seconds." : "Tap what showed up (up to 3× for strong). Takes 30 seconds, promise."}</p>
      {scoreMeter}
      {/* Status in the form: today is already in the record, and this form is that entry. */}
      {savedToday && !editDate && <p className="savedline"><Icon name="check" size={14} /> Logged today — any change here updates it.</p>}
      {quickCard && quickCheckin}
      {quickMode && expanded && !editDate && <button type="button" className="linkbtn backquick" onClick={() => setExpanded(false)}>Back to quick check-in</button>}
      {!quickCard && (
        <>
          <div className="chiphead">
            <p className="section-lab" id="sym-lab">Symptoms</p>
            <button type="button" ref={editRef} className="linkbtn" aria-label="Edit symptoms" aria-expanded={symEdit} aria-controls="sym-sheet" onClick={() => setSymEdit((v) => !v)}>Edit</button>
          </div>
          {symEdit ? (
            <SymptomSheet stage={stage} symPrefs={symPrefs} setSymPrefs={setSymPrefs} days={[...days, { sym: draft }]} onClose={() => { setSymEdit(false); editRef.current?.focus(); }} />
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
        </>
      )}
      {/* Sleep: the peri quick card already asks "How did you sleep?" (q2, its answers are these pill texts), so the
          pill row is not drawn while that card is on screen; everywhere else it stays, under a "Last night" label. */}
      {!(stage === "peri" && quickCard) && (
        <>
          <p className="section-lab">Last night</p>
          <div className="row">
            {[["good", "Slept well"], ["fair", "So-so"], ["poor", "Rough night"]].map(([id, l]) => (
              <button key={id} aria-pressed={sleepQ === id} className={`pill ${sleepQ === id ? "pill-on" : ""}`} onClick={() => setSleepQ(id)}>{l}</button>
            ))}
          </div>
        </>
      )}
      {editDate && (
        <div className="row">
          <button aria-pressed={editPeriod} className={`pill ${editPeriod ? "pill-on" : ""}`} onClick={() => setEditPeriod((v) => !v)}>Period day</button>
        </div>
      )}
      {!quickCard && scaleSection}
      {fertSection}
      {bodySection}
      <DayNote key={editDate || "today"} value={dayNote} onChange={setDayNote} label={editDate ? `Note for ${fmt(editDate)}` : "Note for today"} />
      <div className="stopbar savebar"><button className="cta" onClick={() => {
        const target = editDate || todayIso;
        // Fertility signs (L7): a temperature that isn't a reading stops the save, with focus on the field.
        // (A half-typed value left in a group that has since been hidden is dropped instead: there is no field to fix.)
        let fo = fertEntryFields(fert, tempUnit);
        if (!fo.ok && fertOn) { ping(FERT_COPY.saveBlocked); document.getElementById("fert-bbt")?.focus(); return; }
        if (!fo.ok) fo = fertEntryFields({ ...fert, bbtText: "" }, tempUnit);
        // Quick answers (also ones carried over by "more detail" or left from quick mode) are
        // saved as the hero symptoms they ask about.
        const mapped = foldQuick(draft, stage);
        const fromQuick = mapped.__q || {};
        delete mapped.__q;
        const sym = { ...Object.fromEntries([...SYMS, ...Object.keys(PSYM)].map((k) => [k, 0])), ...mapped };
        // Spotting alone is not a period day; an edit keeps the day's own "Period day" switch.
        const bleeding = !!flow && flow !== "spot";
        // Her day note (D7) is kept on the entry, trimmed, and only when there is one. It never goes to contribute().
        const note = cleanNote(dayNote);
        const entry = { date: target, sleepQ: sleepQ || "fair", period: editDate ? !!editPeriod : bleeding, scales: { ...scales }, flow, disch, odor, bodyOdor, sym, ...(note ? { note } : {}), ...fo.fields };
        const next = upsertDay(days, entry);
        setDays((d) => upsertDay(d, entry));
        ping(editDate ? `${fmt(target)} updated` : "Saved — check Patterns");
        // App compares milestones before and after this save (the "Milestone reached" moment); it may replace the toast above.
        onSaved?.(next, editDate ? null : target);
        // Weekly counts: a symptom still at the value a combined quick question gave it adds no flag,
        // and while the quick card is the form on screen no symptom flag is added at all.
        const flagged = Object.fromEntries(Object.entries(mapped).filter(([k, v]) => !(k in fromQuick && fromQuick[k] === v)));
        contribute({ sym: quickCard ? {} : flagged, sleepQ: sleepQ || "fair", flow }, target);
        if (editDate) { onEndEdit(entry); setAppTab("cal"); } else { setDraft(Object.keys(fromQuick).length ? { ...sym, __q: fromQuick } : sym); setDayNote(note); setAppTab("patterns"); }
      }}>{editDate ? `Save changes to ${fmt(editDate)}` : "Save today's check-in"}</button></div>
      {onPots && !editDate && <button className="linkbtn potslink" style={{ marginTop: 10 }} onClick={onPots}>Log POTS symptoms and drinks →</button>}
      {research && !editDate && (
        <>
          <p className="rfoot">Sharing weekly counts is on: which of {flagWords(stage)} this check-in logged, plus your life stage group, go to Cyra's server on a later day, with no dates or values.</p>
          <Details label="Exactly what's sent">
            <ul>
              <li>Until it's sent on a later day, saving this check-in again today replaces what it counts, and a fix from the Calendar on a later day can only take flags back, never add one. A fix after it's sent can't change counts already sent.</li>
              {fertOn && <li>{FERT_COPY.todayCountsLi}</li>}
              {quickCard && <li>{stage === "peri" ? "A quick check-in shares only whether you had a poor night's sleep." : "A quick check-in shares only whether you logged a heavy-flow day."}</li>}
              <li>Sent at most once a day. Like any request, it carries your device's internet address.</li>
              <li>You can turn this off in <Icon name="sliders" size={12} className="labico" />Settings.</li>
            </ul>
          </Details>
        </>
      )}
    </main>
  );
}
