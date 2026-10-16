import { useEffect, useRef, useState } from "react";
import { reduceMotion } from "../lib/motion.js";

/* Live day-score meter — drives its own color from the stage ramp. Until something is logged it is
   honest about it (`touched` false): "Nothing logged yet · —", an empty track and a 0 progressbar;
   the first tap switches it to the scored label and colour.
   Motion: the fill is a scaleX(--v) transform (styles.js .meterfill; no width transition) and the big
   number counts up or down from the previous value over 250 ms (one requestAnimationFrame tween,
   skipped under reduced motion). aria-valuenow and the label always hold the final value. */
export default function ScoreMeter({ liveScore, scoreLabel, scoreColor, touched = true }) {
  const target = touched ? Math.round(liveScore * 100) : 0;
  const [shown, setShown] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const from = prev.current; prev.current = target;
    if (from === target || reduceMotion() || typeof requestAnimationFrame !== "function") { setShown(target); return undefined; }
    let raf; const t0 = performance.now();
    const step = (t) => {
      const u = Math.min(1, (t - t0) / 250), e = 1 - (1 - u) * (1 - u);
      setShown(Math.round(from + (target - from) * e));
      if (u < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  if (!touched) {
    return (
      <div className="meter meter-empty" style={{ borderColor: "var(--line)" }}>
        <div className="meterhead">
          <span className="meterlabel">Nothing logged yet</span>
          <span className="meterval"><i className="meterdot" aria-hidden="true" style={{ background: "var(--line)" }} />—</span>
        </div>
        <div className="metertrack" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} aria-label="Day score: nothing logged yet">
          <div className="meterfill" style={{ "--v": 0 }} />
        </div>
        <div className="meterends"><span>Tap below — your score updates live</span><span>great</span></div>
      </div>
    );
  }
  return (
    <div className="meter" style={{ borderColor: scoreColor(liveScore) }}>
      <div className="meterhead">
        <span className="meterlabel">{scoreLabel(liveScore)}</span>
        <span className="meterval"><i className="meterdot" aria-hidden="true" style={{ background: scoreColor(liveScore) }} />{shown}</span>
      </div>
      <div className="metertrack" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={target} aria-label={`Day score ${target} out of 100, ${scoreLabel(liveScore)}`}>
        <div className="meterfill" style={{ "--v": liveScore, background: `linear-gradient(90deg, ${scoreColor(0)}, ${scoreColor(0.5)}, ${scoreColor(liveScore)})` }} />
      </div>
      <div className="meterends"><span>rough</span><span>great</span></div>
    </div>
  );
}
