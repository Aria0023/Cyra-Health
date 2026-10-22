import { css } from "../styles.js";

/* Outer frame shared by every phase: palette variables, the one stylesheet, and the status toast
   (aria-live) so messages show on every screen. The toast element is always in the DOM (its text
   node is emptied when nothing is showing; it is never display:none) so an aria-live region exists
   before the first message and the suites can watch one node. `long` (over 60 characters) switches
   the pill to a left-aligned, rounded block. `repaint` is true for --t-slow after a palette change (or
   an Appearance change) so the chrome crossfades together. `scheme` ("light" | "dark", App.jsx
   resolveScheme) goes on data-scheme, which selects the dark token rule in styles.js; the palette and
   data-viz variables arrive inline in `style`. */
export default function Shell({ style, scheme = "light", toast = "", repaint = false, children }) {
  return (
    <div className={`cy${repaint ? " repaint" : ""}`} data-scheme={scheme} style={style}>
      <style>{css}</style>
      {children}
      <div className={`toast${toast ? " show" : ""}${toast.length > 60 ? " long" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
