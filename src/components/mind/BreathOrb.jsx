/* The breathing visual (calm R5): the centrepiece of a practice. Inline SVG only, colours from tokens (the stage
   primary and accent mixed into the card, CSS .orb*), decorative (aria-hidden); the words and the live region in
   PracticePlayer carry the meaning.

   Layers, back to front: a soft halo; two pastel blobs that drift slowly in opposite directions; the core, a radial
   wash that grows on the in-breath and settles on the out-breath (a CSS transform transition whose duration is the
   phase's own seconds, so it moves exactly with the count); a ring of 60 small dots marking the whole practice's
   progress. Motion is transform/opacity only. Under prefers-reduced-motion nothing moves or scales: the blobs stay
   still and the core only brightens on the in-breath and dims on the out-breath (an opacity fade), and the phase
   word and count still change (styles.js, calm R5 block).

   Props: phase "in" | "hold" | "out" | "rest" | "idle" | "step"; dur (seconds of the current phase); progress 0–1 of
   the whole run; size; still (no drift, e.g. the small preview on a card). */
import { useId } from "react";

const DOTS = 60;
export default function BreathOrb({ phase = "idle", dur = 4, progress = 0, size = 248, still = false, children }) {
  const gid = `orbg${useId().replace(/:/g, "")}`;
  const big = phase === "in" || phase === "hold";
  const lit = Math.round(Math.max(0, Math.min(1, progress)) * DOTS);
  return (
    <div className={`orb orb-${phase}${big ? " orb-big" : ""}${still ? " orb-still" : ""}`} style={{ "--orb": `${size}px`, "--orb-t": `${Math.max(0.2, dur)}s` }}>
      <svg className="orb-svg" viewBox="0 0 240 240" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={gid} cx="42%" cy="38%" r="70%">
            <stop offset="0" className="orb-stop-a" />
            <stop offset=".62" className="orb-stop-b" />
            <stop offset="1" className="orb-stop-c" />
          </radialGradient>
        </defs>
        <circle className="orb-halo" cx="120" cy="120" r="112" />
        <g className="orb-drift orb-drift-a"><path className="orb-blob-a" d="M120 34c34 0 70 18 78 52s-6 70-36 88-70 18-96-4-34-58-22-88 42-48 76-48z" /></g>
        <g className="orb-drift orb-drift-b"><path className="orb-blob-b" d="M124 44c30 4 58 26 62 58s-14 62-44 74-64 2-82-24-16-62 6-86 28-26 58-22z" /></g>
        <g className="orb-core"><circle cx="120" cy="120" r="74" fill={`url(#${gid})`} /><circle className="orb-shine" cx="98" cy="94" r="22" /></g>
        <g className="orb-dots">
          {Array.from({ length: DOTS }, (_, i) => {
            const a = (i / DOTS) * Math.PI * 2 - Math.PI / 2;
            return <circle key={i} className={i < lit ? "on" : ""} cx={120 + 114 * Math.cos(a)} cy={120 + 114 * Math.sin(a)} r={i % 5 === 0 ? 2.1 : 1.5} />;
          })}
        </g>
      </svg>
      {children && <div className="orb-mid">{children}</div>}
    </div>
  );
}
