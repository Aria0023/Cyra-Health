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
import { t } from "../lib/i18n.js";

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
      <button key={id} aria-pressed={sev > 0} aria-label={t("pregBody.severityOf3", { v0: symMap[id] || label, sev })} className={`chip sev-${sev}`} style={{ "--fc": famColor(id) }} onClick={() => setDraft((d) => ({ ...d, [id]: ((d[id] || 0) + 1) % 4 }))}>
        <span>{label}</span><span key={sev} className="dots" aria-hidden="true" data-tick={sev || undefined}>{sevDots(sev)}</span>
      </button>
    );
  };
  return (
    <main>
      <div className="pregband">
        <div className="pregweek">{t("pregBody.week", { pregWeek })}</div>
        <div className="pregmeta"><b>{t("pregBody.secondTrimester")}</b><span>{t("pregBody.babyIsAboutTheSize")}</span></div>
      </div>
      <div className="pregbar"><div className="pregfill" style={{ width: `${(pregWeek / 40) * 100}%` }} /></div>

      <div className="readcard">
        <div className="rsec" style={{ margin: "0 0 4px" }}>{t("pregBody.thisWeeksRead")}</div>
        <div className="sname">{PREG_TIPS[trimester][0]}</div>
        <p className="hint" style={{ margin: "4px 0 0" }}>{PREG_TIPS[trimester][1]}</p>
      </div>

      {editDate && (
        <div className="card editbar" style={{ display: "block", margin: "16px 0 12px" }}>
          <p><b>{t("pregBody.editing", { v0: fmt(editDate) })}</b> {t("pregBody.changesSaveToThatDay")} <button className="linkbtn" onClick={() => onEndEdit()}>{t("pregBody.backToToday")}</button></p>
        </div>
      )}
      <h1 className="disp" style={{ marginTop: 16 }}>{editDate ? t("pregBody.fixingUp", { v0: fmt(editDate) }) : t("pregBody.howsTodayGoing")}</h1>
      {!yesterdayLogged && !editDate && anyLogged && onEditDay && <button type="button" className="linkbtn yday" onClick={() => onEditDay(yesterdayIso)}>{t("pregBody.yesterdayNotLoggedAddIt")}</button>}
      {logTop}
      {logTop && <h2 className="checkhead">{editDate ? t("pregBody.checkInFor", { v0: fmt(editDate) }) : t("pregBody.todaysCheckIn")}</h2>}
      <p className="hint">{t("pregBody.tapASymptomOnceFor")}</p>
      {scoreMeter}
      {savedToday && !editDate && <p className="savedline"><Icon name="check" size={14} /> {t("pregBody.loggedTodayAnyChangeHere")}</p>}
      <div className="chiphead">
        <p className="section-lab" id="sym-lab">{t("pregBody.symptoms")}</p>
        <button type="button" ref={editRef} className="linkbtn" aria-label={t("pregBody.editSymptoms")} aria-expanded={symEdit} aria-controls="sym-sheet" onClick={() => setSymEdit((v) => !v)}>{t("pregBody.edit")}</button>
      </div>
      {symEdit ? (
        <SymptomSheet stage="preg" symPrefs={symPrefs} setSymPrefs={setSymPrefs} days={[]} onClose={() => { setSymEdit(false); editRef.current?.focus(); }} />
      ) : (
        <>
          <div className="chips" role="group" aria-labelledby="sym-lab">{[...first, ...lifted].map(chip)}</div>
          {more.length > 0 && (
            <>
              <button type="button" className="disclosure more symmore" aria-expanded={moreOpen} aria-controls="sym-more" onClick={() => setMoreOpen((v) => !v)}>
                <span>{t("pregBody.moreSymptoms")}<span className="dsub"> · {more.length}</span></span><Icon name="chevron" className="chev" />
              </button>
              <div id="sym-more" hidden={!moreOpen}>{moreOpen && <div className="chips morechips" role="group" aria-label={t("pregBody.moreSymptoms")}>{more.map(chip)}</div>}</div>
            </>
          )}
        </>
      )}
      {scaleSection}
      {bodySection}
      {/* The kick counter is a tool, not the day's primary action: tinted and outlined inside its own card, so "Save today" is the one filled CTA. */}
      <div className="plaincard kickcard">
        <p className="section-lab">{t("pregBody.kickCounter")}</p>
        <div className="kickrow">
          <button className="cta cta-kick" style={{ flex: 1 }} onClick={onKick}>{t("pregBody.kick")} <Icon name="foot" /></button>
          <div className="kickcount" aria-live="polite"><b>{kicks}</b><span>{editDate ? t("pregBody.kicksThatDay") : t("pregBody.kicksToday")}</span></div>
        </div>
      </div>
      {draft.swl >= 2 ? (
        <Advice urgency="now" alone>{t("pregBody.suddenOrSevereSwellingEspecially")}</Advice>
      ) : (
        <Advice urgency="self" alone>{t("pregBody.loggingDailyBuildsTheRecord")}</Advice>
      )}
      <DayNote key={editDate || "today"} value={dayNote} onChange={setDayNote} label={editDate ? t("pregBody.noteFor", { v0: fmt(editDate) }) : t("pregBody.noteForToday")} />
      <div className="stopbar savebar"><button className="cta" onClick={() => {
        const target = editDate || todayIso;
        // Her day note (D7), trimmed and only when there is one; contribute() below never gets it.
        const note = cleanNote(dayNote);
        const entry = { sym: { ...draft }, kicks, scales: { ...scales }, odor, bodyOdor, ...(note ? { note } : {}) };
        setPregLog((l) => ({ ...l, [target]: entry }));
        ping(editDate ? `${fmt(target)} updated` : "Saved to your pregnancy journal — see Calendar");
        contribute({ sym: draft, kicks }, target);
        if (editDate) onEndEdit(entry, target); else setDayNote(note);
      }}>{editDate ? t("pregBody.saveChangesTo", { v0: fmt(editDate) }) : t("pregBody.saveToday")}</button></div>
      {onPots && !editDate && <button className="linkbtn potslink" style={{ marginTop: 10 }} onClick={onPots}>{t("pregBody.logPotsSymptomsAndDrinks")}</button>}
      {research && !editDate && (
        <>
          <p className="rfoot">{t("pregBody.sharingWeeklyCountsIsOn")} {flagWords("preg")} {t("pregBody.todaysCheckInLoggedPlus")}</p>
          <Details label={t("pregBody.exactlyWhatsSent")}>
            <ul>
              <li>{t("pregBody.theCheckInCountsAs")}</li>
              <li>{t("pregBody.sentAtMostOnceA")}</li>
              <li>{t("pregBody.youCanTurnThisOff")} <Icon name="sliders" size={12} className="labico" />{t("pregBody.settings")}</li>
            </ul>
          </Details>
        </>
      )}
    </main>
  );
}
