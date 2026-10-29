/* Design system v2 (calm R1): a soft, hand-drawn-looking pastel blob in the stage accent, for the illustrated moments
   (behind the cycle ring, on empty states). Inline SVG, decorative (aria-hidden), colours from tokens only:
   the fill is the primary and accent mixed into the card at low strength (CSS .blob). `variant` 0–2 picks a shape. */
const SHAPES = [
  "M100 14c28 0 58 12 70 38s6 58-10 80-46 40-74 36-54-20-64-46S16 70 32 48 72 14 100 14z",
  "M96 18c30-4 62 10 74 36 12 26 0 52-14 74s-40 42-70 38S30 146 22 118 18 62 38 42 66 22 96 18z",
  "M104 20c24 4 52 16 62 42s4 56-14 76-48 30-74 24S30 136 24 110s-2-54 18-72 38-22 62-18z",
];
export default function Blob({ variant = 0, className = "" }) {
  return (
    <svg className={`blob${className ? " " + className : ""}`} viewBox="0 0 200 180" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
      <path className="blob-a" d={SHAPES[variant % SHAPES.length]} />
      <path className="blob-b" d={SHAPES[(variant + 1) % SHAPES.length]} transform="translate(30 22) scale(.72)" />
    </svg>
  );
}
