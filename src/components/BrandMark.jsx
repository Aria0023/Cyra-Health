/* The Heard Health mark (docs/brand/heard-mark.svg): a soft ring (the cycle) with a short open gap and a rounded
   speech tail at the gap, and one solid dot inside (a day logged, a voice). Decorative wherever it appears: the
   wordmark next to it carries the name, so it is aria-hidden and never focusable. Colour comes from .brandmark
   (periwinkle #4A5DB0 on paper, #A7B5F4 in the dark scheme), not from the stage palette. */
export const MARK_RING = "M15.22 38.92 A19 19 0 1 1 26.13 48.07";
export const MARK_TAIL = "M26.13 48.07 Q22.93 53.47 16.53 55.47";

export default function BrandMark({ size = 56, className = "" }) {
  return (
    <svg className={`brandmark ${className}`.trim()} aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 64 64">
      <g fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <path d={MARK_RING} />
        <path d={MARK_TAIL} />
      </g>
      <circle cx="32" cy="30" r="5.5" fill="currentColor" />
    </svg>
  );
}
