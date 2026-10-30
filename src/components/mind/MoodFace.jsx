/* A face for the 5-point mood row (calm R5). Inline SVG, decorative: the button around it carries the word
   ("Very low" … "Very good"). Drawn on the same 24-unit grid and stroke as Icon; the fill is a soft wash of the
   stage accent (CSS .moodface). Never an emoji (they differ per OS). */
const MOUTH = {
  1: "M8 16.8q4-3.6 8 0",
  2: "M8.6 16.2q3.4-1.8 6.8 0",
  3: "M8.6 15.6h6.8",
  4: "M8.6 14.6q3.4 2.4 6.8 0",
  5: "M8 14q4 4.4 8 0",
};
export default function MoodFace({ v = 3, size = 34 }) {
  return (
    <svg className="moodface" data-v={v} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle className="moodface-bg" cx="12" cy="12" r="10.2" />
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10.2" opacity=".35" />
        {v === 1 && <path d="M7.6 8.6l2 .9M16.4 8.6l-2 .9" />}
        <path d={MOUTH[v] || MOUTH[3]} />
      </g>
      <circle cx="9" cy="10.4" r="1.05" fill="currentColor" />
      <circle cx="15" cy="10.4" r="1.05" fill="currentColor" />
    </svg>
  );
}
