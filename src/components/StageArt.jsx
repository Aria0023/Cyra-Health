/* One calm, decorative illustration per life stage (2026-11-25, docs/plans/critique-fixes.md Task 6): abstract shapes
   only (moon phases, seeds, leaves, waves), no people and no product drawings. Drawn only from the UI tokens
   (var(--primary), var(--accent) and tints of them mixed into var(--card)), so it follows every style and palette, light
   and dark. Always aria-hidden: the stage's name beside it carries the meaning. Shown in the stage hero on You (the menu
   and Your profile) and on each registration stage card (`small`). */
const STAGE_KEY = Object.freeze({ periods: "cycle", ttc: "ttc", preg: "preg", peri: "peri", meno: "meno" });

/** The art's key for an app stage ("periods" | "peri" | "preg") and her stage name, or for a registration card label. */
export function stageArtKey({ stage = null, stageName = "", card = null } = {}) {
  if (card) return { "My Cycle": "cycle", "Trying to conceive": "ttc", "Pregnant": "preg", "Perimenopause": "peri", "Menopause & beyond": "meno" }[card] || "cycle";
  if (stage === "preg") return "preg";
  if (/conceive/i.test(stageName || "")) return "ttc";
  if (/menopause/i.test(stageName || "") && !/peri/i.test(stageName || "")) return "meno";
  return STAGE_KEY[stage] || "cycle";
}

const tint = (v, n) => `color-mix(in srgb, var(--${v}) ${n}%, var(--card))`;

function Shapes({ k }) {
  switch (k) {
    case "ttc": // seeds opening along a curve
      return (
        <>
          <path d="M18 112c30-44 74-62 124-58" fill="none" stroke={tint("primary", 45)} strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="44" cy="84" rx="9" ry="14" transform="rotate(-38 44 84)" fill={tint("accent", 40)} />
          <ellipse cx="78" cy="66" rx="11" ry="17" transform="rotate(-24 78 66)" fill={tint("accent", 62)} />
          <ellipse cx="118" cy="56" rx="13" ry="20" transform="rotate(-10 118 56)" fill="var(--accent)" opacity=".85" />
          <circle cx="152" cy="54" r="10" fill={tint("primary", 70)} />
          <circle cx="152" cy="54" r="4" fill="var(--card)" />
        </>
      );
    case "preg": // a seed held inside nested rings
      return (
        <>
          <circle cx="96" cy="64" r="50" fill={tint("primary", 16)} />
          <circle cx="96" cy="64" r="36" fill="none" stroke={tint("primary", 50)} strokeWidth="3" />
          <circle cx="96" cy="64" r="22" fill={tint("accent", 45)} />
          <ellipse cx="96" cy="66" rx="7" ry="10" fill="var(--accent)" />
          <circle cx="150" cy="22" r="5" fill={tint("primary", 60)} />
          <circle cx="40" cy="108" r="4" fill={tint("accent", 60)} />
        </>
      );
    case "peri": // waves, changing height
      return (
        <>
          <path d="M8 58c18-18 32-18 48 0s30 18 46 0 30-26 50-6 26 12 36 4" fill="none" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M8 82c18-10 32-10 48 0s30 10 46 0 30-16 50-2 26 8 36 2" fill="none" stroke={tint("accent", 70)} strokeWidth="3" strokeLinecap="round" />
          <path d="M8 104c18-6 32-6 48 0s30 6 46 0 30-8 50 0 26 4 36 0" fill="none" stroke={tint("primary", 40)} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="160" cy="26" r="12" fill={tint("accent", 45)} />
        </>
      );
    case "meno": // a full moon and a resting leaf
      return (
        <>
          <circle cx="128" cy="48" r="30" fill={tint("primary", 30)} />
          <circle cx="128" cy="48" r="30" fill="none" stroke={tint("primary", 60)} strokeWidth="2" />
          <path d="M28 108c10-36 44-52 82-44-8 34-44 54-82 44z" fill={tint("accent", 55)} />
          <path d="M30 106c22-16 46-28 76-40" fill="none" stroke="var(--card)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="60" cy="30" r="4" fill={tint("primary", 55)} />
        </>
      );
    default: // cycle: moon phases on an arc
      return (
        <>
          <path d="M14 96c40-60 132-60 168 0" fill="none" stroke={tint("primary", 35)} strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" />
          <circle cx="30" cy="80" r="11" fill="none" stroke={tint("primary", 60)} strokeWidth="2.5" />
          <path d="M66 38a13 13 0 1 0 0 26 9 13 0 0 1 0-26z" fill={tint("accent", 60)} />
          <circle cx="98" cy="40" r="15" fill="var(--accent)" opacity=".85" />
          <path d="M130 38a13 13 0 1 1 0 26 9 13 0 0 0 0-26z" fill={tint("accent", 60)} />
          <circle cx="166" cy="80" r="11" fill="none" stroke={tint("primary", 60)} strokeWidth="2.5" />
        </>
      );
  }
}

export default function StageArt({ k = "cycle", small = false, className = "" }) {
  return (
    <svg className={`stageart${small ? " small" : ""}${className ? ` ${className}` : ""}`} data-art={k} viewBox="0 0 196 128" aria-hidden="true" focusable="false">
      <Shapes k={k} />
    </svg>
  );
}
