import { useState } from "react";
import { GSYM, famColor } from "../lib/constants.js";
import { fmt, localDay, sevDots, trimesterOf } from "../lib/engine.js";
import { cleanNote } from "../lib/daylog.js";

/* Pregnancy — Calendar: any month, one at a time (‹ › move, "Back to this month" returns;
   the month resets when the tab is re-entered because the tab panel remounts). Week-start
   markers (W22, W23…), logged days filled with their day score, a due-date card; tap a day
   for its card — see, edit or log it (past days only). No fertile window or period
   prediction here, by design. */
const DAY = 86400000;
const GIDS = Object.keys(GSYM);
const longDay = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const shortDay = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export default function PregCalendarScreen({ pregWeek, pregLog, dayScore, scoreColor, scoreInk, scoreLabel, todayIso, pregSel, setPregSel, onEdit, ping }) {
  const [mo, setMo] = useState(0);
  const now = new Date(); now.setHours(12, 0, 0, 0);
  const first = new Date(now.getFullYear(), now.getMonth() + mo, 1);
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const monthTitle = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const due = new Date(Date.now() + (40 - pregWeek) * 7 * DAY).toLocaleDateString("en-US", { month: "long", day: "numeric" });
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
        {wkStart && <span className={`c-wklab${sc != null ? " onfill" : ""}`}>W{wk}</span>}
        {logged && <span className="c-log" />}
      </button>
    );
  }
  return (
    <main>
      <div className="calnav">
        <button type="button" className="sbtn" aria-label="Previous month" onClick={() => setMo((m) => m - 1)}>‹</button>
        <h1 className="disp" aria-live="polite">{monthTitle}</h1>
        <button type="button" className="sbtn" aria-label="Next month" onClick={() => setMo((m) => m + 1)}>›</button>
      </div>
      {mo !== 0 && <button type="button" className="linkbtn backmonth" onClick={() => setMo(0)}>Back to this month</button>}
      <p className="hint">Week markers and your logged days.</p>
      <div className="calgrid" role="group" aria-label={monthTitle}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <div key={d} className="calhead" aria-hidden="true">{d}</div>)}
        {cells}
      </div>
      {pregSel && (() => {
        const e = pregLog[pregSel];
        const esc = e ? dayScore(e, GIDS) : null;
        const syms = e ? GIDS.filter((id) => (e.sym?.[id] || 0) > 0).sort((a, b) => e.sym[b] - e.sym[a]) : [];
        return (
          <div className="card daycard" role="region" aria-label="Selected day">
            <div className="dayhead">
              <b>{shortDay(pregSel)}</b>
              {esc != null && <span className="scorepill" style={{ background: scoreColor(esc), color: scoreInk(esc) }}>{scoreLabel(esc)} · {Math.round(esc * 100)}</span>}
            </div>
            {e ? (
              <>
                {syms.length ? (
                  <ul className="pday-s">
                    {syms.map((id) => <li key={id} style={{ "--fc": famColor(id) }}>{GSYM[id]} <span className="sevd" aria-label={`${e.sym[id]} of 3`}>{sevDots(e.sym[id])}</span></li>)}
                  </ul>
                ) : <p className="dayline">No symptoms</p>}
                <p className="dayline">{e.kicks} kicks</p>
                {cleanNote(e.note) && <p className="dayline noteline"><b>Note:</b> {cleanNote(e.note)}</p>}
              </>
            ) : (
              <p className="hint" style={{ margin: "6px 0 0" }}>Nothing logged this day.</p>
            )}
            <div className="sfoot" style={{ marginTop: 10 }}>
              {e ? <button type="button" className="sbtn" onClick={() => open(pregSel)}>Edit this day</button>
                : pregSel <= todayIso ? <button type="button" className="sbtn" onClick={() => open(pregSel)}>Log this day</button>
                : <span className="hint" style={{ margin: 0 }}>That day hasn't happened yet.</span>}
              <button type="button" className="sbtn" onClick={() => setPregSel(null)}>Close</button>
            </div>
          </div>
        );
      })()}
      <div className="callegend">
        <span><i className="dot d-wk" /> week starts</span><span><i className="dot d-logdot" /> logged day</span>
      </div>
      <div className="gradlegend">
        <span>rough day</span>
        <span className="gradbar" style={{ background: `linear-gradient(90deg, ${scoreColor(0)}, ${scoreColor(0.5)}, ${scoreColor(1)})` }} />
        <span>great day</span>
      </div>
      <div className="card"><div className="num">w{pregWeek}</div><p>{40 - pregWeek} weeks to your due date, {due}. Trimester {{ first: 1, second: 2, third: 3 }[trimesterOf(pregWeek)]}. Tap any day to see or add what you logged.</p></div>
    </main>
  );
}
