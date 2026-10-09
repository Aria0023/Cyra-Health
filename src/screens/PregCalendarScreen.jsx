import { GSYM } from "../lib/constants.js";
import { fmt, localDay } from "../lib/engine.js";

/* Pregnancy — Calendar: week-start markers, logged-day dots, due-date countdown.
   No fertile window or period prediction here, by design. */
export default function PregCalendarScreen({ pregWeek, pregLog, dayScore, scoreColor, todayIso, pregSel, setPregSel, onEdit, ping }) {
  return (
    <main>
      <h1 className="disp">{new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h1>
      <p className="hint">Week markers, your logged days, and the road to your due date — {new Date(Date.now() + (40 - pregWeek) * 7 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.</p>
      <div className="calgrid">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="calhead">{d}</div>)}
        {(() => {
          const now = new Date(); now.setHours(12, 0, 0, 0);
          const first = new Date(now.getFullYear(), now.getMonth(), 1);
          const cells = [];
          for (let i = 0; i < first.getDay(); i++) cells.push(<div key={"e" + i} />);
          const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          for (let dnum = 1; dnum <= dim; dnum++) {
            const d = new Date(now.getFullYear(), now.getMonth(), dnum, 12);
            const iso = localDay(d);
            const diff = Math.round((d - now) / 86400000);
            const wk = pregWeek + Math.floor(diff / 7);
            const wkStart = ((diff % 7) + 7) % 7 === 0;
            const logged = pregLog[iso];
            cells.push(
              <button key={iso} style={logged && dayScore(logged, Object.keys(GSYM)) != null ? { background: scoreColor(dayScore(logged, Object.keys(GSYM))), borderColor: scoreColor(dayScore(logged, Object.keys(GSYM))), color: dayScore(logged, Object.keys(GSYM)) > 0.3 ? "#1A1A1A" : "#FFFFFF", fontWeight: 700 } : {}} className={`calcell ${wkStart ? "c-wk" : ""} ${iso === todayIso ? "c-today" : ""}`} onClick={() => setPregSel(iso)}>
                {dnum}
                {wkStart && wk >= 1 && wk <= 40 && <span className="c-wklab">w{wk}</span>}
                {logged && <span className="c-log" />}
              </button>
            );
          }
          return cells;
        })()}
      </div>
      <div className="callegend">
        <span><i className="dot d-fert" /> week starts</span><span><i className="dot d-logdot" /> logged day</span>
      </div>
      {pregSel && (() => {
        const e = pregLog[pregSel];
        return (
          <div className="card" style={{ display: "block", marginBottom: 12 }}>
            <b>{fmt(pregSel)}</b>
            {e ? (
              <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.6 }}>
                {Object.entries(e.sym).filter(([, v]) => v > 0).map(([id, v]) => `${GSYM[id]} ${"●".repeat(v)}`).join(" · ") || "No symptoms"} · {e.kicks} kicks
              </p>
            ) : (
              <p className="hint" style={{ margin: "6px 0 0" }}>Nothing logged this day.</p>
            )}
            <div className="sfoot" style={{ marginTop: 10 }}>
              {e ? <button className="sbtn" onClick={() => { onEdit(pregSel); setPregSel(null); ping(`Editing ${fmt(pregSel)} — save to update that day`); }}>Edit</button> : <span />}
              <button className="sbtn" onClick={() => setPregSel(null)}>Close</button>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
