/* Live day-score meter — drives its own color from the stage ramp. */
export default function ScoreMeter({ liveScore, scoreLabel, scoreColor }) {
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
