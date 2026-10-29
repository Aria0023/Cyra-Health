import { useRef } from "react";
import Icon from "../Icon.jsx";

/* Design system v2 (calm R1; wired into the app by R2): the bottom navigation. A floating pill holding a tablist of
   five tabs (icon over label; aria-selected; roving tabindex: ←/→, Home and End move focus, Enter, Space or a tap
   selects — manual activation, as the old tab strip had, so App.jsx can move focus to the new tab's heading) and,
   outside the tablist (a tablist may only hold tabs), a filled "+" centred over the gap in the middle of the pill.
   The gap is centred because the left and right tab groups share the width equally (2 tabs | + | 3 tabs). Every
   target is at least 44px; the bar sits above the home indicator (--sa-b) and follows the scheme through tokens.
   tabs = [{ id, label, icon }]; `panelId(id)` (optional) supplies aria-controls; `fixed` false renders it in flow
   (the dev gallery). */
export default function NavPill({ tabs, current, onSelect, onPlus, plusLabel = "Log something", plusExpanded, label = "Sections", panelId, fixed = true, plusRef }) {
  const refs = useRef([]);
  const n = tabs.length, split = Math.floor(n / 2);
  /* Equal halves keep the "+" exactly centred; under 360px wide that would squeeze the right-hand tabs below 44px, so
     styles.js switches to equal tabs (--np-narrow) and moves the "+" onto the gap (it is then slightly left of centre). */
  const cols = `repeat(${split}, ${(1 / split).toFixed(4)}fr) 64px repeat(${n - split}, ${(1 / (n - split)).toFixed(4)}fr)`;
  const narrow = `repeat(${split}, 1fr) 52px repeat(${n - split}, 1fr)`;
  const go = (i) => { refs.current[(i + n) % n]?.focus(); };
  const onKey = (e, i) => {
    const k = e.key;
    if (k === "ArrowRight") go(i + 1); else if (k === "ArrowLeft") go(i - 1); else if (k === "Home") go(0); else if (k === "End") go(n - 1); else return;
    e.preventDefault();
  };
  return (
    <nav className={`navpill${fixed ? " fixed" : ""}`} aria-label={label}>
      <div className="navpill-bar">
        <div className="navpill-tabs" role="tablist" aria-label={label} style={{ "--np-cols": cols, "--np-narrow": narrow }}>
          {tabs.map((tv, i) => {
            const on = tv.id === current;
            return (
              <button key={tv.id} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" className={`navtab${on ? " on" : ""}`} aria-selected={on} tabIndex={on ? 0 : -1}
                aria-controls={panelId ? panelId(tv.id) : undefined} style={i === split ? { gridColumn: split + 2 } : undefined}
                onClick={() => onSelect?.(tv.id)} onKeyDown={(e) => onKey(e, i)}>
                <Icon name={tv.icon} size={22} />
                <span>{tv.label}</span>
              </button>
            );
          })}
        </div>
        <button type="button" ref={plusRef} className="navplus" aria-label={plusLabel} aria-haspopup="dialog" aria-expanded={plusExpanded === undefined ? undefined : !!plusExpanded} onClick={onPlus}>
          <Icon name="plus" size={26} />
        </button>
      </div>
    </nav>
  );
}
