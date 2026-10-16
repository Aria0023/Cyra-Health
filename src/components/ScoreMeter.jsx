/* Live day-score meter — drives its own color from the stage ramp. Until something is logged it is
   honest about it (`touched` false): "Nothing logged yet · —", an empty track and a 0 progressbar;
   the first tap switches it to the scored label and colour. */
export default function ScoreMeter({ liveScore, scoreLabel, scoreColor, touched = true }) {
  if (!touched) {
    return (
      <div className="meter meter-empty" style={{ borderColor: "var(--line)" }}>
        <div className="meterhead">
          <span className="meterlabel">Nothing logged yet</span>
          <span className="meterval"><i className="meterdot" aria-hidden="true" style={{ background: "var(--line)" }} />—</span>
        </div>
        <div className="metertrack" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} aria-label="Day score: nothing logged yet">
          <div className="meterfill" style={{ width: 0 }} />
        </div>
        <div className="meterends"><span>Tap below — your score updates live</span><span>great</span></div>
      </div>
    );
  }
  return (
    <div className="meter" style={{ borderColor: scoreColor(liveScore) }}>
      <div className="meterhead">
        <span className="meterlabel">{scoreLabel(liveScore)}</span>
        <span className="meterval"><i className="meterdot" aria-hidden="true" style={{ background: scoreColor(liveScore) }} />{Math.round(liveScore * 100)}</span>
      </div>
      <div className="metertrack" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(liveScore * 100)} aria-label={`Day score ${Math.round(liveScore * 100)} out of 100, ${scoreLabel(liveScore)}`}>
        <div className="meterfill" style={{ width: `${liveScore * 100}%`, background: `linear-gradient(90deg, ${scoreColor(0)}, ${scoreColor(0.5)}, ${scoreColor(liveScore)})` }} />
      </div>
      <div className="meterends"><span>rough</span><span>great</span></div>
    </div>
  );
}
