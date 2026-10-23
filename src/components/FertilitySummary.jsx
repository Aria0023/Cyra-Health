import Icon from "./Icon.jsx";
import { cycleWindow, fertSummary, fertSummaryLines, bbtShiftSentence, fertReportSentence, FERT_COPY } from "../lib/fertility.js";

/* Fertility signs on Patterns and the Report (local-first L7, decision D6), Trying to conceive only (App.jsx passes
   `fert` only then). Counts from her own day entries, worked out on the device; a temperature rise is worded as an
   observation, never a confirmation, and mucus or tests are never said to show that ovulation happened. */

/** Patterns: this cycle (from her last period start, 45 days ago or less) or the last 35 days. */
export default function FertilitySummary({ days, starts, todayIso, unit, onLog }) {
  const win = cycleWindow(starts, todayIso);
  const sum = fertSummary(days, win);
  const lines = fertSummaryLines(sum);
  return (
    <>
      <p className="section-lab">{win.anchored ? FERT_COPY.sumHeadCycle : FERT_COPY.sumHead35}</p>
      <div className="plaincard fertsum">
        {sum.logged === 0 ? (
          <>
            <p className="plain">{FERT_COPY.sumEmpty}</p>
            <button type="button" className="linkbtn" onClick={onLog}>{FERT_COPY.sumLog}</button>
          </>
        ) : (
          <>
            <ul className="fertlist">
              {lines.map((l) => <li key={l.text}><Icon name={l.icon} className="labico" />{l.text}</li>)}
            </ul>
            {sum.bbt.shift ? <p className="plain fertshift">{bbtShiftSentence(sum.bbt.shift, unit)}</p>
              : sum.bbt.n >= 9 ? <p className="plain fertshift">{FERT_COPY.noShift}</p> : null}
            <p className="rfoot">{FERT_COPY.sumFoot}</p>
          </>
        )}
      </div>
    </>
  );
}

/** Report → What stands out: one finding over the Report's 30-day window; null when nothing was logged. */
export function FertilityFinding({ sum, unit }) {
  if (!sum || sum.logged === 0) return null;
  return (
    <div className="finding fertfind">
      <div className="fhead"><Icon name="drop" className="labico" /><b>{FERT_COPY.title}</b><span className="fchip" style={{ background: "color-mix(in srgb, var(--primary) 14%, var(--card))" }}>{sum.logged} {sum.logged === 1 ? "day" : "days"} with signs</span></div>
      <p className="plain fsub">{fertReportSentence(sum, unit)}</p>
    </div>
  );
}
