import { useState } from "react";
import { summarySentences, summaryMeta } from "../lib/insights.js";

/* Patterns summary (L8, spec §5.1 "Summary first"): "This week" / "This month" as one .seg, the dates it covers, a
   decorative strip of the days (each logged day filled with its day-score colour from the data-viz ramp — scoreColor,
   never the UI palette; aria-hidden, the sentences say it all) and two or three plain sentences (lib/insights.js).
   week and month are App's periodSummary results, worked out on render; the chosen period is React state only,
   never saved. onLog (or null) adds the check-in link while the chosen window has nothing logged. */
export default function SummaryCard({ week, month, scoreColor, todayIso, onLog = null }) {
  const [period, setPeriod] = useState("week");
  const s = period === "month" && month ? month : week;
  return (
    <div className="plaincard sumcard">
      <div className="mcrow seg sumseg" role="group" aria-label="Summary period">
        {[["week", "This week"], ["month", "This month"]].map(([k, label]) => (
          <button key={k} type="button" className={period === k ? "mc on" : "mc"} aria-pressed={period === k} onClick={() => setPeriod(k)}>{label}</button>
        ))}
      </div>
      <p className="summeta">{summaryMeta(s)}</p>
      <div className="sumcells" aria-hidden="true" style={{ "--n": s.cells.length }}>
        {s.cells.map((c) => (
          <i key={c.iso} className={[c.score != null ? "on" : "", c.iso === todayIso ? "today" : ""].filter(Boolean).join(" ") || undefined} style={c.score != null ? { background: scoreColor(c.score) } : undefined} />
        ))}
      </div>
      <p className="plain sumtext" aria-live="polite">{summarySentences(s).join(" ")}</p>
      {onLog && s.logged === 0 && <p className="pline"><button type="button" className="linkbtn" onClick={onLog}>Log today's check-in →</button></p>}
    </div>
  );
}
