import { useState } from "react";
import { famColor } from "../lib/constants.js";
import { inRange, localDay, isPeriodDay, sevDots } from "../lib/engine.js";

/* Cycle & Peri — Calendar: any month, one at a time (‹ › move, "Back to this month" returns;
   the month resets when the tab is re-entered because the tab panel remounts). Fill = day
   score, border = cycle state (period solid, predicted dashed, fertile accent), a dot on
   period days; tap a day for its card — see, edit or log it (past days only); confidence
   card from cycle variability. */
const DAY = 86400000;
const longDay = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const shortDay = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export default function CalendarScreen({ pred, predWaits, days, symIds, symMap, dayScore, scoreColor, scoreInk, scoreLabel, todayIso, selDay, setSelDay, onEdit, ins }) {
  const [mo, setMo] = useState(0);
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + mo, 1);
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const monthTitle = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const firstRun = days.length === 0;
  const lens = ins.lens || [];
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(<div key={"e" + i} />);
  for (let dnum = 1; dnum <= dim; dnum++) {
    const d = new Date(first.getFullYear(), first.getMonth(), dnum, 12);
    const iso = localDay(d);
    const entry = days.find((x) => x.date === iso);
    const logged = !!entry && isPeriodDay(entry);
    const predP = !!pred && inRange(d, pred.nextStart, new Date(pred.nextStart.getTime() + 4 * DAY));
    const fert = !!pred && inRange(d, pred.fertileFrom, pred.fertileTo);
    const sc = dayScore(entry, symIds);
    const isToday = iso === todayIso;
    const tint = sc != null ? { background: scoreColor(sc), color: scoreInk(sc), fontWeight: 700 } : {};
    const label = `${longDay(iso)}${isToday ? ", today" : ""}${logged ? ", period" : ""}${predP ? ", predicted period" : ""}${fert ? ", estimated fertile window" : ""}${sc != null ? `, ${scoreLabel(sc)}` : ""}`;
    const cls = `calcell ${logged ? "c-period" : predP ? "c-pred" : fert ? "c-fert" : ""} ${isToday ? "c-today" : ""} ${isToday && firstRun ? "c-empty" : ""} ${iso === selDay ? "c-sel" : ""} ${iso > todayIso ? "c-future" : ""}`;
    cells.push(
      <button key={iso} type="button" style={tint} className={cls} aria-label={label} aria-pressed={iso === selDay} aria-current={isToday ? "date" : undefined} onClick={() => setSelDay(iso)}>
        {dnum}{logged && <span className="c-per-mark" />}
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
      <p className="hint">Logged periods, predictions, and the estimated fertile window — with honest uncertainty.</p>
      <div className="calgrid" role="group" aria-label={monthTitle}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <div key={d} className="calhead" aria-hidden="true">{d}</div>)}
        {cells}
      </div>
      {selDay && (() => {
        const e = days.find((x) => x.date === selDay);
        const esc = e ? dayScore(e, symIds) : null;
        const loggedSyms = e ? symIds.filter((id) => (e.sym[id] || 0) > 0).sort((a, b) => e.sym[b] - e.sym[a]) : [];
        return (
          <div className="card daycard" role="region" aria-label="Selected day">
            <div className="dayhead">
              <b>{shortDay(selDay)}</b>
              {esc != null && <span className="scorepill" style={{ background: scoreColor(esc), color: scoreInk(esc) }}>{scoreLabel(esc)} · {Math.round(esc * 100)}</span>}
            </div>
            {e ? (
              <>
                {loggedSyms.length ? (
                  <ul className="pday-s">
                    {loggedSyms.map((id) => <li key={id} style={{ "--fc": famColor(id) }}>{symMap[id]} <span className="sevd" aria-label={`${e.sym[id]} of 3`}>{sevDots(e.sym[id])}</span></li>)}
                  </ul>
                ) : <p className="dayline">No symptoms</p>}
                <p className="dayline">{isPeriodDay(e) ? "Period · " : ""}Sleep: {e.sleepQ}</p>
              </>
            ) : (
              <p className="hint" style={{ margin: "6px 0 0" }}>Nothing logged this day.</p>
            )}
            <div className="sfoot" style={{ marginTop: 10 }}>
              {e ? <button type="button" className="sbtn" onClick={() => { onEdit(selDay); setSelDay(null); }}>Edit this day</button>
                : selDay <= todayIso ? <button type="button" className="sbtn" onClick={() => { onEdit(selDay); setSelDay(null); }}>Log this day</button>
                : <span className="hint" style={{ margin: 0 }}>That day hasn't happened yet.</span>}
              <button type="button" className="sbtn" onClick={() => setSelDay(null)}>Close</button>
            </div>
          </div>
        );
      })()}
      <div className="callegend">
        <span><i className="dot d-pred" /> predicted</span><span><i className="dot d-fert" /> fertile (est.)</span><span><i className="dot d-permark" /> period</span>
      </div>
      <div className="gradlegend">
        <span>rough day</span>
        <span className="gradbar" style={{ background: `linear-gradient(90deg, ${scoreColor(0)}, ${scoreColor(0.5)}, ${scoreColor(1)})` }} />
        <span>great day</span>
      </div>
      <p className="hint calhint">{firstRun ? "Tap today to log your first day. Periods, predictions and the fertile window appear here as you go." : "Tap any day to see or edit what you logged."}</p>
      {pred ? (
        <div className="card"><div className="num">±{Math.max(2, Math.round((ins.variability || 4) / 2))}d<span className="rmeta">confidence</span></div><p>{pred.basis === "told"
          ? `Based on the ${pred.avgLen}-day cycle you gave at sign-up${lens.length ? ` (one logged so far: ${lens[0]}d)` : ""}. After two logged cycles this becomes your own number. Estimates — not contraception.`
          : lens.length ? `Based on your last ${lens.length === 1 ? "cycle" : `${lens.length} cycles`} (${lens.join(" · ")}d). Estimates — not contraception.`
          : "Based on a typical 28-day cycle until two of yours are logged. Estimates — not contraception."}</p></div>
      ) : predWaits ? (
        <div className="card"><div className="num">—</div><p>At sign-up you said your cycles are irregular or you're not sure how long they run, so Cyra won't guess yet. Log a couple of periods (light flow or more on the Today screen) and the calendar starts estimating your next one.</p></div>
      ) : (
        <div className="card"><div className="num">—</div><p>No predictions yet. Log a period day (light flow or more on the Today screen) and the calendar starts estimating your next one.</p></div>
      )}
    </main>
  );
}
