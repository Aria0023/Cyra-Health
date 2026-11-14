import { Card } from "./ui/index.js";
import { LearnLink } from "./Learn.jsx";
import { fmtGlucose } from "../lib/glucose.js";
import { fmt } from "../lib/engine.js";

/* Body → "Glucose" (Task B, 2026-11-14): shown when readings from the phone's Health store exist in the last 7 days
   (lib/glucose.js glucoseCard). The latest reading with its unit and time, the day's range and count in words, and a
   7-day line: each day's range as a soft band and its average as a line, in the single-hue soft data ramp (--soft-*),
   so no colour says good or bad. No targets, no "high"/"low", no alerts, no dosing. Readings stay on this device.
   `extra`: a quiet line under the card (Task C's shop link, when the build has it). */
const W = 300, H = 84, PAD = 8;
export default function GlucoseCard({ m, extra = null }) {
  const vals = m.week.flatMap((d) => (d.mean == null ? [] : [d.min, d.max]));
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = Math.max(20, hi - lo);
  const x = (i) => PAD + (i * (W - 2 * PAD)) / 6;
  const y = (v) => H - PAD - ((v - (lo - (span - (hi - lo)) / 2)) / span) * (H - 2 * PAD);
  const pts = m.week.map((d, i) => (d.mean == null ? null : [x(i), y(d.mean)])).filter(Boolean);
  const label = `Daily glucose, last 7 days: ${m.week.filter((d) => d.mean != null).map((d) => `${fmt(d.date)} average ${fmtGlucose(d.mean, m.unit)}`).join("; ")}.`;
  return (
    <Card id="body-glucose" tint="body" icon="drop" eyebrow={m.demo ? "Demo readings" : "From your phone"} title="Glucose" level={2} className="glucosecard">
      <p className="gluc-latest"><b>{m.latest}</b>{m.at && <span> {m.today ? "at" : `on ${fmt(m.day)} at`} {m.at}</span>}</p>
      <p className="gluc-words">{m.words}</p>
      <svg className="gluc-line" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="none">
        {m.week.map((d, i) => (d.mean == null ? null : <rect key={d.date} x={x(i) - 5} width="10" y={y(d.max)} height={Math.max(2, y(d.min) - y(d.max))} rx="5" className="gluc-band" />))}
        {pts.length > 1 && <polyline points={pts.map((p) => p.join(",")).join(" ")} className="gluc-mean" />}
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" className="gluc-dot" />)}
      </svg>
      <p className="rfoot">Each bar is a day's range, the line its average. {m.demo ? "Illustrative readings in this demo build: nothing was read from a sensor or sent." : "Read on your phone, kept on this device."}</p>
      <p className="learnrow-wrap"><LearnLink id="glucose" />{extra}</p>
    </Card>
  );
}
