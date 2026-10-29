/* Design system v2 (calm R7): a real on/off switch. One button, role="switch", aria-checked, named by the element its
   `labelledBy` points at (never by its own text) and described by `describedBy`. The track is 52x32 with a 44px
   target; on = the primary fill with the knob at the end, off = the line colour with the knob at the start, and the
   word On / Off beside it so the state never rests on colour alone. The knob slides 160ms (off under reduced motion). */
export default function Switch({ checked, onChange, labelledBy, describedBy, controls, id, className = "", disabled = false, btnRef, ...rest }) {
  return (
    <button ref={btnRef} type="button" id={id} role="switch" aria-checked={!!checked} aria-labelledby={labelledBy} aria-describedby={describedBy} aria-controls={controls}
      disabled={disabled} className={`swt${checked ? " on" : ""}${className ? " " + className : ""}`} onClick={() => onChange?.(!checked)} {...rest}>
      <span className="swt-word" aria-hidden="true">{checked ? "On" : "Off"}</span>
      <span className="swt-track" aria-hidden="true"><span className="swt-knob" /></span>
    </button>
  );
}
