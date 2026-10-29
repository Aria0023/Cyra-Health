/* Design system v2 (calm R1): the pattern-card comparison. Two labelled bars, each with its day count and its value,
   and the difference figure beside them (big serif) with its label. Bars are data marks: they take a FAMILIES colour
   (`family`, e.g. "sleep" → var(--fam-sleep)); the comparison bar is the same family softened, never a UI palette
   colour. a / b = { label, days, value (number, for the bar length), shown (the value as text, e.g. "8h") }.
   `diff` is the difference as text ("+54 min"); `diffLabel` defaults to "difference". The figure carries a text
   summary for screen readers; the bars are hidden from them. */
import { famVar } from "../../lib/constants.js";

export default function TwoBar({ a, b, diff, diffLabel = "difference", family = "sleep", className = "" }) {
  const max = Math.max(Number(a.value) || 0, Number(b.value) || 0) || 1;
  const pct = (x) => `${Math.max(4, Math.round(((Number(x) || 0) / max) * 100))}%`;
  const dayWord = (n) => `${n} ${n === 1 ? "day" : "days"}`;
  const summary = `${a.label}, ${dayWord(a.days)}: ${a.shown}. ${b.label}, ${dayWord(b.days)}: ${b.shown}.${diff ? ` ${diffLabel[0].toUpperCase() + diffLabel.slice(1)}: ${diff}.` : ""}`;
  return (
    <figure className={`twobar${className ? " " + className : ""}`} style={{ "--fc": famVar(family) }}>
      <figcaption className="sr-only">{summary}</figcaption>
      {diff && (
        <div className="twobar-diff" aria-hidden="true">
          <b>{diff}</b>
          <span>{diffLabel}</span>
        </div>
      )}
      <div className="twobar-bars" aria-hidden="true">
        {[a, b].map((x, i) => (
          <div key={i} className={`twobar-row${i ? " other" : ""}`}>
            <div className="twobar-lab"><span><b>{x.label}</b> · {dayWord(x.days)}</span><b>{x.shown}</b></div>
            <div className="twobar-track"><i style={{ width: pct(x.value) }} /></div>
          </div>
        ))}
      </div>
    </figure>
  );
}
