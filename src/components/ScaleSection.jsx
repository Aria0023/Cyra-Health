import { SCALES } from "../lib/constants.js";
import Advice from "./Advice.jsx";

/* The four 0–10 sliders, with threshold advice for fatigue and pain. */
export default function ScaleSection({ scales, setScales }) {
  return (
    <>
      <p className="section-lab">How it felt, 0–10</p>
      {SCALES.map((s) => (
        <div className="scalerow" key={s.id}>
          <div className="scalehead"><span>{s.label}</span><b>{scales[s.id]}</b></div>
          <input className="slider" type="range" min="0" max="10" value={scales[s.id]} aria-label={`${s.label}, 0 is ${s.low}, 10 is ${s.high}`} aria-valuetext={`${scales[s.id]} out of 10`} onChange={(e) => setScales((x) => ({ ...x, [s.id]: +e.target.value }))} />
          <div className="scaleends"><span>{s.low}</span><span>{s.high}</span></div>
        </div>
      ))}
      {scales.fatigue >= 8 && <Advice urgency="visit">Fatigue at this level for weeks isn't just "being tired" — thyroid problems, iron-deficiency anemia (very common with heavy periods), and vitamin D deficiency all show up this way and are all simple blood tests. Ask for them by name.</Advice>}
      {scales.pain >= 8 && <Advice urgency="visit">Pain you'd rate 8+ is not something to normalize. Bring these numbers to your appointment — a tracked pain scale is far harder to wave away than "it hurts a lot."</Advice>}
    </>
  );
}
