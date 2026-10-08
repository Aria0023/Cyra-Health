import { PALETTES } from "../lib/constants.js";

/* 🎨 Palette picker: 2–3 alternate UI palettes per stage. */
export default function PaletteSheet({ stage, stageName, palIdx, setPalIdx, setShowPal }) {
  return (
    <div className="palsheet">
      <p className="section-lab" style={{ margin: "0 0 8px" }}>Palette · {stageName}</p>
      {PALETTES[stage].map((p, i) => (
        <button key={p.id} className={`palopt ${palIdx[stage] === i ? "on" : ""}`} onClick={() => { setPalIdx((x) => ({ ...x, [stage]: i })); }}>
          <span className="palswatches">
            <i style={{ background: p.primary }} /><i style={{ background: p.accent }} /><i style={{ background: p.paper, border: "1.5px solid " + p.line }} />
          </span>
          <span className="palmeta"><b>{p.name}</b><span>{p.note}</span></span>
          {palIdx[stage] === i && <span className="palcheck">✓</span>}
        </button>
      ))}
      <button className="ghostbtn" style={{ marginTop: 4 }} onClick={() => setShowPal(false)}>Done</button>
    </div>
  );
}
