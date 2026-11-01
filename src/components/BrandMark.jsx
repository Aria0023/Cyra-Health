/* The Solia Health mark (docs/brand/solia-mark.svg): a soft ring with a half-sun rising from a short horizon inside
   it (sun = "sol") and one small dot above (a day logged). Decorative wherever it appears: the wordmark next to it
   carries the name, so it is aria-hidden and never focusable. Colour comes from .brandmark (periwinkle #4A5DB0 on
   paper, #A7B5F4 in the dark scheme), not from the stage palette. Drawn on a 64 x 64 grid. */
export const MARK_SUN = "M21 39 A11 11 0 0 1 43 39 Z";
export const MARK_HORIZON = "M18.5 39 H45.5";

export default function BrandMark({ size = 56, className = "" }) {
  return (
    <svg className={`brandmark ${className}`.trim()} aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeWidth="5" />
      <path d={MARK_SUN} fill="currentColor" />
      <path d={MARK_HORIZON} fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="42.5" cy="21.5" r="3.4" fill="currentColor" />
    </svg>
  );
}
