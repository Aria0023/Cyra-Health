import { useState } from "react";
import { GSYM, famColor } from "../lib/constants.js";
import { fmt, localDay, sevDots, trimesterOf } from "../lib/engine.js";
import { cleanNote } from "../lib/daylog.js";
import { t, fmtDate } from "../lib/i18n.js";

/* Pregnancy — Calendar: any month, one at a time (‹ › move, "Back to this month" returns;
   the month resets when the tab is re-entered because the tab panel remounts). Week-start
   markers (W22, W23…), logged days filled with their day score, a due-date card; tap a day
   for its card — see, edit or log it (past days only). No fertile window or period
   prediction here, by design. */
const DAY = 86400000;
const GIDS = Object.keys(GSYM);
const longDay = (iso) => fmtDate(iso, { weekday: "long", month: "long", day: "numeric" });
const shortDay = (iso) => fmtDate(iso, { weekday: "short", month: "short", day: "numeric" });

export default function PregCalendarScreen({ pregWeek, pregLog, dayScore, scoreColor, scoreInk, scoreLabel, todayIso, pregSel, setPregSel, onEdit, ping }) {
  const [mo, setMo] = useState(0);
  const now = new Date(); now.setHours(12, 0, 0, 0);
  const first = new Date(now.getFullYear(), now.getMonth() + mo, 1);
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const monthTitle = fmtDate(first, { month: "long", year: "numeric" });
  const due = fmtDate(new Date(Date.now() + (40 - pregWeek) * 7 * DAY), { month: "long", day: "numeric" });
  const firstRun = Object.keys(pregLog).length === 0;
  const open = (iso) => { onEdit(iso); setPregSel(null); ping(`Editing ${fmt(iso)} — save to update that day`); };
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(<div key={"e" + i} />);
  for (let dnum = 1; dnum <= dim; dnum++) {
    const d = new Date(first.getFullYear(), first.getMonth(), dnum, 12);
    const iso = localDay(d);
    const diff = Math.round((d - now) / DAY);
    const wk = pregWeek + Math.floor(diff / 7);
    const wkStart = ((diff % 7) + 7) % 7 === 0 && wk >= 1 && wk <= 40;
    const logged = pregLog[iso];
    const sc = logged ? dayScore(logged, GIDS) : null;
    const isToday = iso === todayIso;
    const tint = sc != null ? { background: scoreColor(sc), color: scoreInk(sc), fontWeight: 700 } : {};
    const label = `${longDay(iso)}${isToday ? ", today" : ""}${wkStart ? `, week ${wk} starts` : ""}${logged ? ", logged" : ""}${sc != null ? `, ${scoreLabel(sc)}` : ""}`;
    const cls = `calcell ${wkStart ? "c-wk" : ""} ${isToday ? "c-today" : ""} ${isToday && firstRun ? "c-empty" : ""} ${iso === pregSel ? "c-sel" : ""} ${iso > todayIso ? "c-future" : ""}`;
    cells.push(
      <button key={iso} type="button" style={tint} className={cls} aria-label={label} aria-pressed={iso === pregSel} aria-current={isToday ? "date" : undefined} onClick={() => setPregSel(iso)}>
        {dnum}
        {wkStart && <span className={`c-wklab${sc != null ? " onfill" : ""}`}>{t("pregCal.w", { wk })}</span>}
        {logged && <span className="c-log" />}
      </button>
    );
  }
  return (
    <main>
      <div className="calnav">
        <button type="button" className="sbtn" aria-label={t("pregCal.previousMonth")} onClick={() => setMo((m) => m - 1)}>‹</button>
        <h1 className="disp" aria-live="polite">{monthTitle}</h1>
        <button type="button" className="sbtn" aria-label={t("pregCal.nextMonth")} onClick={() => setMo((m) => m + 1)}>›</button>
      </div>
      {mo !== 0 && <button type="button" className="linkbtn backmonth" onClick={() => setMo(0)}>{t("pregCal.backToThisMonth")}</button>}
      <p className="hint">{t("pregCal.weekMarkersAndYourLogged")}</p>
      <div className="calgrid" role="group" aria-label={monthTitle}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <div key={d} className="calhead" aria-hidden="true">{d}</div>)}
        {cells}
      </div>
      {pregSel && (() => {
        const e = pregLog[pregSel];
        const esc = e ? dayScore(e, GIDS) : null;
        const syms = e ? GIDS.filter((id) => (e.sym?.[id] || 0) > 0).sort((a, b) => e.sym[b] - e.sym[a]) : [];
        return (
          <div className="card daycard" role="region" aria-label={t("pregCal.selectedDay")}>
            <div className="dayhead">
              <b>{shortDay(pregSel)}</b>
              {esc != null && <span className="scorepill" style={{ background: scoreColor(esc), color: scoreInk(esc) }}>{scoreLabel(esc)}</span>}
            </div>
            {e ? (
              <>
                {syms.length ? (
                  <ul className="pday-s">
                    {syms.map((id) => <li key={id} style={{ "--fc": famColor(id) }}>{GSYM[id]} <span className="sevd" aria-label={t("pregCal.of3", { v0: e.sym[id] })}>{sevDots(e.sym[id])}</span></li>)}
                  </ul>
                ) : <p className="dayline">{t("pregCal.noSymptoms")}</p>}
                <p className="dayline">{t("pregCal.kicks", { kicks: e.kicks })}</p>
                {cleanNote(e.note) && <p className="dayline noteline"><b>{t("pregCal.note")}</b> {cleanNote(e.note)}</p>}
              </>
            ) : (
              <p className="hint" style={{ margin: "6px 0 0" }}>{t("pregCal.nothingLoggedThisDay")}</p>
            )}
            <div className="sfoot" style={{ marginTop: 10 }}>
              {e ? <button type="button" className="sbtn" onClick={() => open(pregSel)}>{t("pregCal.editThisDay")}</button>
                : pregSel <= todayIso ? <button type="button" className="sbtn" onClick={() => open(pregSel)}>{t("pregCal.logThisDay")}</button>
                : <span className="hint" style={{ margin: 0 }}>{t("pregCal.thatDayHasntHappenedYet")}</span>}
              <button type="button" className="sbtn" onClick={() => setPregSel(null)}>{t("pregCal.close")}</button>
            </div>
          </div>
        );
      })()}
      <div className="callegend">
        <span><i className="dot d-wk" /> {t("pregCal.weekStarts")}</span><span><i className="dot d-logdot" /> {t("pregCal.loggedDay")}</span>
      </div>
      <div className="gradlegend">
        <span>{t("pregCal.heavierDay")}</span>
        <span className="gradbar" style={{ background: `linear-gradient(90deg, ${scoreColor(0)}, ${scoreColor(0.5)}, ${scoreColor(1)})` }} />
        <span>{t("pregCal.lighterDay")}</span>
      </div>
      <div className="card"><div className="num">{t("pregCal.w2", { pregWeek })}</div><p>{t("pregCal.weeksToYourDueDate", { v0: 40 - pregWeek, due, v1: { first: 1, second: 2, third: 3 }[trimesterOf(pregWeek)] })}</p></div>
    </main>
  );
}
