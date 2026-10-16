/* Motion guard. Every scrollIntoView({ behavior: "smooth" }), score tween and SVG draw-in asks this first and
   falls back to the instant version when the person has asked the OS for less motion. The stylesheet handles
   CSS keyframes and transitions on its own (styles.js, prefers-reduced-motion block); this is for JS-driven motion. */
export const reduceMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
