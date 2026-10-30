import Blob from "./Blob.jsx";

/* Design system v2 (calm R1): an SVG ring. `value` 0–1 is how much of the ring is filled (a cycle's progress, or where
   a reading sits against her usual); it is never shown as a number out of 100. `word` is the words-only reading
   ("At your usual", "A little lower"); `center` is what sits in the middle (e.g. "Day 12", big serif), `sub` a small
   line under it, `title` the ring's name ("Body"). The accessible name is built from the words only:
   "{title}: {center}, {sub}. {word}". `tone` picks the stroke: "primary" (default) | "accent" | "soft". `blob` puts
   a soft pastel shape behind the ring (an illustrated moment; decorative). The arc fills in on mount (CSS, off
   under reduced motion). */
export default function Ring({ value = 0, title, center, sub, word, size = 132, stroke = 10, tone = "primary", blob = false, className = "" }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const mid = [center, sub].filter(Boolean).join(", ");
  const name = `${title ? `${title}: ` : ""}${mid}${word ? `${mid ? ". " : ""}${word}` : ""}`;
  return (
    <figure className={`ring tone-${tone}${className ? " " + className : ""}`} style={{ "--ring": `${size}px` }}>
      <div className="ringwrap" role="img" aria-label={name}>
        {blob && <Blob className="ringblob" />}
        <svg className="ringsvg" viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
          <circle className="ringtrack" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
          <circle className="ringarc" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ "--ring-c": c, "--ring-off": c * (1 - v) }} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </svg>
        {(center || sub) && (
          <span className="ringmid" aria-hidden="true">
            {center && <b>{center}</b>}
            {sub && <span>{sub}</span>}
          </span>
        )}
      </div>
      {(title || word) && (
        <figcaption aria-hidden="true">
          {title && <span className="ringtitle">{title}</span>}
          {word && <span className="ringword">{word}</span>}
        </figcaption>
      )}
    </figure>
  );
}
