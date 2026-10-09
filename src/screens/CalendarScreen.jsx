import { fmt, inRange } from "../lib/engine.js";

/* Cycle & Peri — Calendar: month grid with day-score fills, period marks,
   predicted period (dashed) and estimated fertile window; tap a day to see or
   edit it; confidence card from cycle variability. */
export default function CalendarScreen({ pred, predWaits, days, symIds, symMap, dayScore, scoreColor, scoreLabel, todayIso, selDay, setSelDay, setDraft, setSleepQ, setEditPeriod, setEditDate, setAppTab, ins }) {
  return (
    <main>
      <h1 className="disp">{new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h1>
      <p className="hint">Logged periods, predictions, and the estimated fertile window — with honest uncertainty.</p>
      <div className="calgrid">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="calhead">{d}</div>)}
        {(() => {
          const now = new Date();
          const first = new Date(now.getFullYear(), now.getMonth(), 1);
          const cells = [];
          for (let i = 0; i < first.getDay(); i++) cells.push(<div key={"e" + i} />);
          const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          for (let dnum = 1; dnum <= dim; dnum++) {
            const d = new Date(now.getFullYear(), now.getMonth(), dnum, 12);
            const iso = d.toISOString().slice(0, 10);
            const logged = days.find((x) => x.date === iso && x.period);
            const predP = !!pred && inRange(d, pred.nextStart, new Date(pred.nextStart.getTime() + 4 * 86400000));
            const fert = !!pred && inRange(d, pred.fertileFrom, pred.fertileTo);
            const entry = days.find((x) => x.date === iso);
            const sc = dayScore(entry, symIds);
            const tint = sc != null ? { background: scoreColor(sc), borderColor: scoreColor(sc), color: sc > 0.3 ? "#1A1A1A" : "#FFFFFF", fontWeight: 700 } : {};
            cells.push(<button key={iso} style={tint} className={`calcell ${sc == null && logged ? "c-period" : sc == null && predP ? "c-pred" : sc == null && fert ? "c-fert" : ""} ${iso === todayIso ? "c-today" : ""}`} onClick={() => setSelDay(iso)}>{dnum}{logged && <span className="c-per-mark" />}</button>);
          }
          return cells;
        })()}
      </div>
      <div className="callegend">
        <span><i className="dot d-pred" /> predicted</span><span><i className="dot d-fert" /> fertile (est.)</span><span><i className="dot d-permark" /> period</span>
      </div>
      <div className="gradlegend">
        <span>rough day</span>
        <span className="gradbar" style={{ background: `linear-gradient(90deg, ${scoreColor(0)}, ${scoreColor(0.5)}, ${scoreColor(1)})` }} />
        <span>great day</span>
      </div>
      {selDay && (() => {
        const e = days.find((x) => x.date === selDay);
        const loggedSyms = e ? symIds.filter((id) => (e.sym[id] || 0) > 0) : [];
        return (
          <div className="card" style={{ display: "block", marginBottom: 12 }}>
            <b>{fmt(selDay)}</b>{e && dayScore(e, symIds) != null && <span className="scorepill" style={{ background: scoreColor(dayScore(e, symIds)), color: dayScore(e, symIds) > 0.3 ? "#1A1A1A" : "#FFFFFF" }}>{scoreLabel(dayScore(e, symIds))} · {Math.round(dayScore(e, symIds) * 100)}</span>}
            {e ? (
              <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.6 }}>
                {loggedSyms.length ? loggedSyms.map((id) => `${symMap[id]} ${"●".repeat(e.sym[id])}`).join(" · ") : "No symptoms"}
                {e.period ? " · Period" : ""} · Sleep: {e.sleepQ}
              </p>
            ) : (
              <p className="hint" style={{ margin: "6px 0 0" }}>Nothing logged this day.</p>
            )}
            <div className="sfoot" style={{ marginTop: 10 }}>
              {e ? <button className="sbtn" onClick={() => {
                setDraft(Object.fromEntries(symIds.map((id) => [id, e.sym[id] || 0])));
                setSleepQ(e.sleepQ); setEditPeriod(!!e.period);
                setEditDate(selDay); setSelDay(null); setAppTab("today");
              }}>Edit this day</button> : <span />}
              <button className="sbtn" onClick={() => setSelDay(null)}>Close</button>
            </div>
          </div>
        );
      })()}
      {pred ? (
        <div className="card"><div className="num">±{Math.max(2, Math.round((ins.variability || 4) / 2))}d</div><p>Confidence given your recent cycles ({ins.lens.length ? ins.lens.join(" · ") + "d" : "not enough yet"}).{pred.basis === "told" ? ` Until two cycles are logged, this uses the ${pred.avgLen}-day cycle you gave at sign-up${pred.seeded ? " and the last period date you entered" : ""}.` : ""} Estimates — not contraception. Tap any day to see or edit what you logged.</p></div>
      ) : predWaits ? (
        <div className="card"><div className="num">—</div><p>At sign-up you said your cycles are irregular or you're not sure how long they run, so Cyra won't guess yet. Log a couple of periods (any flow on the Today screen) and the calendar starts estimating your next one.</p></div>
      ) : (
        <div className="card"><div className="num">—</div><p>No predictions yet. Log a period day (any flow on the Today screen) and the calendar starts estimating your next one.</p></div>
      )}
    </main>
  );
}
