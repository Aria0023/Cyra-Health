import { useEffect, useRef } from "react";
import { PALETTES } from "../lib/constants.js";
import Icon from "./Icon.jsx";

/* Palette picker: 2–3 alternate UI palettes per stage. UI S1: each option previews itself (its own
   --primary / --accent / --line on the row, the name in its primary, a mini page swatch), carries
   aria-pressed, and the list is a group named by its label. Opening focuses the label; Done hands
   focus back to the palette button (triggerRef). */
export default function PaletteSheet({ stage, stageName, palIdx, setPalIdx, setShowPal, triggerRef }) {
  const headRef = useRef(null);
  useEffect(() => { headRef.current?.focus(); }, []);
  const close = () => { setShowPal(false); triggerRef?.current?.focus(); };
  return (
    <section className="palsheet" aria-label="Color palette" id="palette-sheet">
      <p id="pal-lab" className="section-lab sheettitle-lab" tabIndex={-1} ref={headRef} style={{ margin: "0 0 8px" }}><Icon name="palette" className="labico" />Palette · {stageName}</p>
      <div role="group" aria-labelledby="pal-lab">
        {PALETTES[stage].map((p, i) => {
          const on = palIdx[stage] === i;
          return (
            <button key={p.id} className={`palopt ${on ? "on" : ""}`} aria-pressed={on} style={{ "--primary": p.primary, "--accent": p.accent, "--line": p.line, "--paper-mini": p.paper }} onClick={() => { setPalIdx((x) => ({ ...x, [stage]: i })); }}>
              <span className="palswatches">
                <i style={{ background: p.primary }} /><i style={{ background: p.accent }} /><i style={{ background: p.paper, border: "1.5px solid " + p.line }} />
              </span>
              <span className="palmeta"><b>{p.name}</b><span>{p.note}</span></span>
              <span className="palmini" />
              {on && <span className="palcheck"><Icon name="check" size={14} /></span>}
            </button>
          );
        })}
      </div>
      <button className="ghostbtn" style={{ marginTop: 4 }} onClick={close}>Done</button>
    </section>
  );
}
