import { css } from "../styles.js";

/* Outer frame shared by every phase: palette variables, the one stylesheet,
   and the status toast (aria-live) so messages show on every screen. */
export default function Shell({ style, toast = "", children }) {
  return (
    <div className="cy" style={style}>
      <style>{css}</style>
      {children}
      <div className="toast" role="status" aria-live="polite" style={toast ? {} : { display: "none" }}>{toast}</div>
    </div>
  );
}
