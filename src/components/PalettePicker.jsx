import { stagePalettes } from "../lib/constants.js";
import { paletteFor } from "../lib/appearance.js";
import Icon from "./Icon.jsx";

/* Palette picker: 2–3 alternate UI palettes per stage. UI S1: each option previews itself (its own
   --primary / --accent / --line on the row, the name in its primary, a mini page swatch), carries
   aria-pressed, and the list is a group named by its label. L2: the previews show the scheme on screen (each palette's
   light values or its `dark` object), and a line under the list says which.
   2026-11-25 (docs/plans/critique-fixes.md Task 1): no longer a sheet opened from a header button; it sits in
   You → App settings under Appearance and style (#you-palette), so there is no focus to move or hand back. */
export default function PalettePicker({ stage, stageName, palIdx, setPalIdx, scheme = "light" }) {
  return (
    <div className="palsheet palinline" id="you-palette">
      <p id="pal-lab" className="section-lab" style={{ margin: "14px 0 6px" }}><Icon name="palette" className="labico" />Palette · {stageName}</p>
      <div role="group" aria-labelledby="pal-lab">
        {stagePalettes(stage, stageName).map((p, i) => {
          const on = palIdx[stage] === i;
          const q = paletteFor(p, scheme);
          return (
            <button key={p.id} type="button" className={`palopt ${on ? "on" : ""}`} aria-pressed={on} style={{ "--primary": q.primary, "--accent": q.accent, "--line": q.line, "--paper-mini": q.paper }} onClick={() => { setPalIdx((x) => ({ ...x, [stage]: i })); }}>
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
      <p className="rfoot">Showing the {scheme === "dark" ? "dark" : "light"} versions. Appearance, above, switches between light and dark.</p>
    </div>
  );
}
