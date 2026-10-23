import { useState } from "react";
import { famColor } from "../lib/constants.js";
import { localDay, isPeriodDay, sevDots, fmt, fmtRange } from "../lib/engine.js";
import { cleanNote } from "../lib/daylog.js";
import Details from "../components/Details.jsx";
import CycleList from "../components/CycleList.jsx";
import Icon from "../components/Icon.jsx";
import { cleanFert, fertParts } from "../lib/fertility.js";

/* Cycle & Peri — Calendar: any month, one at a time (‹ › move, "Back to this month" returns;
   the month resets when the tab is re-entered because the tab panel remounts). Fill = day
   score, border = cycle state (period solid, predicted dashed, fertile accent), a mark on
   period days sized by flow (a dot for light, a short pill for medium, a longer one for heavy or
   flooding); tap a day for its card — see, edit or log it (past days only).
   Predicted cells are the whole likely-start range, [pred.fromIso, pred.toIso], and fertile cells the
   estimated fertile window, both inclusive and compared as ISO days (L5). Under the legends, the ±half
   confidence card names the range, what it rests on (her last kept cycles, her sign-up answer or a typical
   28 days, and how many she left out) and "Estimates — not contraception."; with no prediction a card
   says why (nothing logged, irregular at sign-up, every cycle left out, a gap over 120 days, menopause).
   "Your cycles" (a closed Details, not in menopause) lists the running cycle and up to 12 earlier ones,
   newest first, with the Unusual suggestion and her "Don't use" switch (components/CycleList.jsx).
   Fertility signs (L7, D6), only while App.jsx shows them (fertOn): a day with egg-white mucus or a positive ovulation
   test gets a small drop / test-strip mark in its cell (aria-hidden; the cell's name says it too), the legend names both,
   and the day card lists that day's signs. They never change pred. */
const FLOW_MARK = { light: "f-light", med: "f-med", heavy: "f-heavy", flood: "f-heavy" };
const FLOW_WORDS = { light: ", light flow", med: ", medium flow", heavy: ", heavy flow", flood: ", flooding" };
const longDay = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const shortDay = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export default function CalendarScreen({ pred, predWhy = null, cyc = null, onCycleUse = () => {}, stage, isMeno = false, days, symIds, symMap, dayScore, scoreColor, scoreInk, scoreLabel, todayIso, selDay, setSelDay, onEdit, fertOn = false, tempUnit = "C" }) {
  const [mo, setMo] = useState(0);
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + mo, 1);
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const monthTitle = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const firstRun = days.length === 0;
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(<div key={"e" + i} />);
  for (let dnum = 1; dnum <= dim; dnum++) {
    const d = new Date(first.getFullYear(), first.getMonth(), dnum, 12);
    const iso = localDay(d);
    const entry = days.find((x) => x.date === iso);
    const logged = !!entry && isPeriodDay(entry);
    const predP = !!pred && iso >= pred.fromIso && iso <= pred.toIso;
    const fert = !!pred && iso >= pred.fertileFromIso && iso <= pred.fertileToIso;
    const flowWords = logged ? FLOW_WORDS[entry.flow] || "" : "";
    const f = fertOn ? cleanFert(entry) : {};
    const ew = f.cm === "eggwhite", pos = f.opk === "pos";
    const sc = dayScore(entry, symIds);
    const isToday = iso === todayIso;
    const tint = sc != null ? { background: scoreColor(sc), color: scoreInk(sc), fontWeight: 700 } : {};
    const label = `${longDay(iso)}${isToday ? ", today" : ""}${logged ? `, period${flowWords}` : ""}${predP ? ", predicted period" : ""}${fert ? ", estimated fertile window" : ""}${ew ? ", egg-white mucus" : ""}${pos ? ", positive ovulation test" : ""}${sc != null ? `, ${scoreLabel(sc)}` : ""}`;
    const cls = `calcell ${logged ? "c-period" : predP ? "c-pred" : fert ? "c-fert" : ""} ${isToday ? "c-today" : ""} ${isToday && firstRun ? "c-empty" : ""} ${iso === selDay ? "c-sel" : ""} ${iso > todayIso ? "c-future" : ""}`;
    cells.push(
      <button key={iso} type="button" style={tint} className={cls} aria-label={label} aria-pressed={iso === selDay} aria-current={isToday ? "date" : undefined} onClick={() => setSelDay(iso)}>
        {dnum}{logged && <span className={`c-per-mark ${FLOW_MARK[entry.flow] || "f-light"}`} />}
        {(ew || pos) && <span className="c-fmarks" aria-hidden="true">{ew && <Icon name="drop" size={10} className="fm-ew" />}{pos && <Icon name="teststrip" size={10} />}</span>}
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
      <p className="hint">{isMeno ? "Logged days and any bleeding you note. After menopause, Cyra doesn't predict periods." : "Logged periods, predictions, and the estimated fertile window — with honest uncertainty."}</p>
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
                {fertOn && fertParts(e, tempUnit).length > 0 && <p className="dayline fertline">{`Fertility signs: ${fertParts(e, tempUnit).join(" · ")}`}</p>}
                {cleanNote(e.note) && <p className="dayline noteline"><b>Note:</b> {cleanNote(e.note)}</p>}
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
        {!isMeno && <><span><i className="dot d-pred" /> predicted</span><span><i className="dot d-fert" /> fertile (est.)</span></>}<span><i className="dot d-permark" /> period</span>
        {fertOn && <><span><Icon name="drop" size={11} className="d-ficon fm-ew" />egg-white</span><span><Icon name="teststrip" size={11} className="d-ficon" />positive test</span></>}
      </div>
      <div className="gradlegend">
        <span>rough day</span>
        <span className="gradbar" style={{ background: `linear-gradient(90deg, ${scoreColor(0)}, ${scoreColor(0.5)}, ${scoreColor(1)})` }} />
        <span>great day</span>
      </div>
      <p className="hint calhint">{firstRun ? (isMeno ? "Tap today to log your first day. What you log appears here as you go." : "Tap today to log your first day. Periods, predictions and the fertile window appear here as you go.") : "Tap any day to see or edit what you logged."}</p>
      {pred ? (
        <div className="card"><div className="num">±{pred.half}d<span className="rmeta">confidence</span></div><p>{predictionText(pred)}</p></div>
      ) : (
        <div className="card"><div className="num">—</div><p>{whyText(predWhy, stage)}</p></div>
      )}
      {!isMeno && cyc?.rows.length > 0 && (
        <div className="cycwrap">
          <Details label={<>Your cycles{cyc.pending ? <span className="dsub"> · {cyc.pending} {cyc.pending === 1 ? "looks" : "look"} unusual</span> : null}</>}>
            <CycleList cyc={cyc} peri={stage === "peri"} onUse={onCycleUse} />
          </Details>
        </div>
      )}
    </main>
  );
}

/* The confidence card's sentence (spec §5.1 Calendar rules): the range, what it rests on, the perimenopause note and
   "Estimates — not contraception." verbatim, joined with spaces. */
function predictionText(p) {
  const range = p.state === "upcoming" ? `Period likely ${fmtRange(p.fromIso, p.toIso)}.`
    : p.state === "window" ? `Period likely any day now, by ${fmt(p.toIso)}.`
    : `Later than your usual range, which ended ${fmt(p.toIso)}. If it came and you didn't log it, tap that day to add it.`;
  const leftOut = p.left ? `, with ${p.left} left out` : "";
  const basis = p.basis === "logged"
    ? (p.used >= 2 ? `Based on your last ${p.used} cycles (${p.usedLens.join(" · ")}d)${leftOut}.` : `Based on your last cycle (${p.usedLens[0]}d)${leftOut}.`)
    : p.basis === "told"
      ? (p.left
        ? `Based on the ${p.center}-day cycle you gave at sign-up, with ${p.left} logged cycle${p.left === 1 ? "" : "s"} left out. Once two cycles are in use, this becomes your own number.`
        : `Based on the ${p.center}-day cycle you gave at sign-up${p.oneLogged ? ` (one logged so far: ${p.oneLogged}d)` : ""}. After two logged cycles this becomes your own number.`)
      : "Based on a typical 28-day cycle until two of yours are logged.";
  return [range, basis, p.wide ? "Cycles vary more in perimenopause, so the range is wider." : null, "Estimates — not contraception."].filter(Boolean).join(" ");
}

/* Why there is no prediction (engine whyNoPrediction). */
function whyText(why, stage) {
  switch (why?.kind) {
    case "unsure": return "At sign-up you said your cycles are irregular or you're not sure how long they run, so Cyra won't guess yet. Log a couple of periods (light flow or more on the Today screen) and the calendar starts estimating your next one.";
    case "excluded": return why.kept
      // An Irregular / Not sure sign-up with one cycle still in use (plan() waits for two).
      ? "At sign-up you said your cycles are irregular or you're not sure how long they run, so Cyra waits until two cycles are in use. Only one of yours is in use now — turn another back on under “Your cycles” below, or keep logging."
      : "Every cycle you've logged is left out of predictions, so Cyra won't guess. Turn one back on under “Your cycles” below, or keep logging.";
    case "long": return `It's been ${why.days} days since the last period Cyra knows about, longer than it predicts across. If you had one since, tap that day to log it.${stage === "peri" ? " Long gaps are common in perimenopause." : " If you haven't and that's unexpected, it's worth mentioning to a clinician."}`;
    case "meno": return "After menopause Cyra doesn't predict periods. Any bleeding now is worth mentioning to your doctor — log it on the Today screen so it's in your record.";
    default: return "No predictions yet. Log a period day (light flow or more on the Today screen) and the calendar starts estimating your next one.";
  }
}
