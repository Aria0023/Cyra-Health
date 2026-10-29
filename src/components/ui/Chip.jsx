import Icon from "../Icon.jsx";

/* Design system v2 (calm R1): a small status chip. Five variants, each with its fixed words:
   "logged" → Logged (with a tick), "supported" → Supported pattern, "still" → Still showing up,
   "notenough" → Not enough information, "pro" → Pro. Words, never grades or scores. `children` may replace the
   words only for "logged" (e.g. "Logged · 7h"). Colours are tokens validated AA in both schemes. */
export const CHIP_WORDS = Object.freeze({ logged: "Logged", supported: "Supported pattern", still: "Still showing up", notenough: "Not enough information", pro: "Pro" });
export default function Chip({ variant = "logged", children, className = "" }) {
  const words = variant === "logged" && children ? children : CHIP_WORDS[variant] || CHIP_WORDS.logged;
  return (
    <span className={`vchip v-${CHIP_WORDS[variant] ? variant : "logged"}${className ? " " + className : ""}`}>
      {variant === "logged" && <Icon name="check" size={12} />}
      {variant === "pro" && <Icon name="sparkle" size={12} />}
      {words}
    </span>
  );
}
