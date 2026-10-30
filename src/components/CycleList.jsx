import { fmt } from "../lib/engine.js";
import { fmtDate } from "../lib/i18n.js";

/* "Your cycles" (Calendar, L5; spec §5.1): the running cycle and up to 12 earlier ones, newest first, from
   lib/engine.js cycleSummary(). Each row is start · length · a decorative bar · her "Don't use" switch; the text
   carries the length, so the bar is aria-hidden. Cyra may point out a cycle that looks unusual (the "Unusual" chip and
   a suggestion), but only her tap leaves one out of predictions (onUse(start, exclude) → App.jsx setCycleUse →
   engine toggleExclude). Leaving a cycle out changes predictions only: the Report and the insights count every cycle. */
const longDay = (iso) => fmtDate(iso, { weekday: "long", month: "long", day: "numeric" });
const pct = (n, scale) => `${Math.round(Math.min(1, n / scale) * 1000) / 10}%`;

export default function CycleList({ cyc, peri = false, onUse }) {
  const rows = cyc.rows || [];
  const longest = Math.max(0, ...rows.filter((r) => r.counted).map((r) => r.len));
  const scale = Math.min(120, Math.max(40, cyc.current ? cyc.current.day : 0, longest));
  const why = (r) => {
    if (!r.counted) return `Not counted as a cycle: ${r.len < 15 ? "under 15 days" : "over 120 days"}.`;
    if (r.excluded) return "Left out of predictions.";
    if (!r.unusual) return null;
    const u = r.usual ? ` (${r.usual[0] === r.usual[1] ? `${r.usual[0]}` : `${r.usual[0]}–${r.usual[1]}`} days)` : "";
    if (r.unusual === "long" && peri) return `Much longer than your others${u}. Longer cycles are common in perimenopause, so keep it unless you know it was a one-off.`;
    return `Much ${r.unusual === "long" ? "longer" : "shorter"} than your others${u}. If it wasn't typical for you, you can stop using it for predictions.`;
  };
  return (
    <>
      <p>Predictions use up to your last 6 cycles. Tap “Don't use” on one that wasn't typical for you — after stopping the pill, an illness or a pregnancy, for example. Cyra may point out a cycle that looks unusual, but only you can leave one out.</p>
      <p>Your Report and insights still count every cycle.</p>
      <ul className="cyclist">
        {cyc.current && (
          <li className="cycrow now">
            <span className="cycstart"><span className="sr-only">Started </span>{fmt(cyc.current.start)}</span>
            <span className="cyclen">day {cyc.current.day} so far</span>
            <span className="cycbar" aria-hidden="true"><i style={{ width: pct(cyc.current.day, scale) }} /></span>
          </li>
        )}
        {rows.map((r) => {
          const text = why(r);
          return (
            <li key={r.start} className={`cycrow${r.excluded ? " out" : ""}`}>
              <span className="cycstart"><span className="sr-only">Started </span>{fmt(r.start)}</span>
              <span className="cyclen">{r.len} days</span>
              {r.counted && <span className="cycbar" aria-hidden="true"><i style={{ width: pct(r.len, scale) }} /></span>}
              {r.counted && (
                <button type="button" className={`takebtn cycuse${r.excluded ? " on" : ""}`} aria-pressed={r.excluded} onClick={() => onUse(r.start, !r.excluded)}>
                  Don't use<span className="sr-only"> for predictions: the cycle that started {longDay(r.start)}</span>
                </button>
              )}
              {text && <p className="cycwhy">{r.counted && r.unusual && <span className="statechip flag">Unusual</span>}{text}</p>}
            </li>
          );
        })}
      </ul>
      {cyc.more && <p className="cycmore">Showing your last 12 cycles.</p>}
    </>
  );
}
