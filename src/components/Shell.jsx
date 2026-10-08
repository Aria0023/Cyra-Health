import { css } from "../styles.js";

/* Outer frame shared by every phase: palette variables + the one stylesheet. */
export default function Shell({ style, children }) {
  return (
    <div className="cy" style={style}>
      <style>{css}</style>
      {children}
    </div>
  );
}
