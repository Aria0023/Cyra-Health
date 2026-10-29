import { useEffect, useRef } from "react";
import { stagePalettes } from "../lib/constants.js";
import { paletteFor } from "../lib/appearance.js";
import Icon from "./Icon.jsx";

/* Palette picker: 2–3 alternate UI palettes per stage. UI S1: each option previews itself (its own
   --primary / --accent / --line on the row, the name in its primary, a mini page swatch), carries
   aria-pressed, and the list is a group named by its label. Opening focuses the label; Done hands
   focus back to the palette button (triggerRef). L2: the previews show the scheme on screen (each palette's
   light values or its `dark` object), and a line under the list says which. */
export default function PaletteSheet({ stage, stageName, palIdx, setPalIdx, setShowPal, triggerRef, scheme = "light" }) {
  const headRef = useRef(null);
  useEffect(() => { headRef.current?.focus(); }, []);
  const close = () => { setShowPal(false); triggerRef?.current?.focus(); };
  return (
    <section className="palsheet" aria-label="Color palette" id="palette-sheet">
      <p id="pal-lab" className="section-lab sheettitle-lab" tabIndex={-1} ref={headRef} style={{ margin: "0 0 8px" }}><Icon name="palette" className="labico" />Palette · {stageName}</p>
      <div role="group" aria-labelledby="pal-lab">
        {stagePalettes(stage, stageName).map((p, i) => {
          const on = palIdx[stage] === i;
          const q = paletteFor(p, scheme);
          return (
            <button key={p.id} className={`palopt ${on ? "on" : ""}`} aria-pressed={on} style={{ "--primary": q.primary, "--accent": q.accent, "--line": q.line, "--paper-mini": q.paper }} onClick={() => { setPalIdx((x) => ({ ...x, [stage]: i })); }}>
              <span className="palswatches">
                <i style={{ background: q.primary }} /><i style={{ background: q.accent }} /><i style={{ background: q.paper, border: "1.5px solid " + q.line }} />
              </span>
              <span className="palmeta"><b>{p.name}</b><span>{p.note}</span></span>
              <span className="palmini" />
              {on && <span className="palcheck"><Icon name="check" size={14} /></span>}
            </button>
          );
        })}
      </div>
      <p className="rfoot">Showing the {scheme === "dark" ? "dark" : "light"} versions. Settings → Appearance switches between light and dark.</p>
      <button className="ghostbtn" style={{ marginTop: 4 }} onClick={close}>Done</button>
    </section>
  );
}
