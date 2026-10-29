import Icon from "../Icon.jsx";

/* Design system v2 (calm R1): a rounded quick-log tile, a line icon in a pastel badge over a short label. At least
   76px tall and never narrower than 44px. `pressed` (true | false) makes it a toggle (aria-pressed) and fills it with
   the stage tint; leave it undefined for a plain action. `note` is an optional second line (e.g. "Logged"). The press
   gives a 120ms dip (none under reduced motion). */
export default function QuickTile({ icon, label, note, onClick, pressed, tint, disabled = false, ...rest }) {
  return (
    <button type="button" className="qtile" data-tint={tint || undefined} aria-pressed={pressed === undefined ? undefined : !!pressed} onClick={onClick} disabled={disabled} {...rest}>
      <span className="qtile-ico" aria-hidden="true"><Icon name={icon} size={20} /></span>
      <span className="qtile-lab">{label}</span>
      {note && <span className="qtile-note">{note}</span>}
    </button>
  );
}
