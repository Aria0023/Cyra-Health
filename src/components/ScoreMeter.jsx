
/* Live day meter (calm R10: words only, never a number out of 100 — plan §7 tone rules; the fill still moves) — drives its own color from the stage ramp. Until something is logged it is
   honest about it (`touched` false): "Nothing logged yet · —", an empty track and a 0 progressbar;
   the first tap switches it to the scored label and colour.
   Motion: the fill is a scaleX(--v) transform (styles.js .meterfill). aria-valuenow keeps the fill's
   position for assistive tech; aria-valuetext and the label say it in words. */
export default function ScoreMeter({ liveScore, scoreLabel, scoreColor, touched = true }) {
  const target = touched ? Math.round(liveScore * 100) : 0;
  if (!touched) {
    return (
      <div className="meter meter-empty" style={{ borderColor: "var(--line)" }}>
        <div className="meterhead">
          <span className="meterlabel">Nothing logged yet</span>
          <span className="meterval"><i className="meterdot" aria-hidden="true" style={{ background: "var(--line)" }} />—</span>
        </div>
        <div className="metertrack" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} aria-label="How today is going: nothing logged yet">
          <div className="meterfill" style={{ "--v": 0 }} />
        </div>
        <div className="meterends"><span>Tap below — this fills in as you go</span></div>
      </div>
    );
  }
  return (
    <div className="meter" style={{ borderColor: scoreColor(liveScore) }}>
      <div className="meterhead">
        <span className="meterlabel">{scoreLabel(liveScore)}</span>
        <span className="meterval"><i className="meterdot" aria-hidden="true" style={{ background: scoreColor(liveScore) }} /></span>
      </div>
      <div className="metertrack" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={target} aria-label={`How today is going: ${scoreLabel(liveScore)}`} aria-valuetext={scoreLabel(liveScore)}>
        <div className="meterfill" style={{ "--v": liveScore, background: `linear-gradient(90deg, ${scoreColor(0)}, ${scoreColor(0.5)}, ${scoreColor(liveScore)})` }} />
      </div>
      <div className="meterends"><span>heavier</span><span>lighter</span></div>
    </div>
  );
}
