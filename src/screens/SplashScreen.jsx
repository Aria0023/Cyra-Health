import { useState } from "react";
import { RestoreForm } from "../components/DataControls.jsx";
import Icon from "../components/Icon.jsx";

/* Phase 1: splash. Wordmark, tagline, value proposition, "Get started", and a way
   back in from an encrypted backup. UI O1: a ring motif in the stage-neutral palette, the three
   promises as icon rows, and the two privacy sentences (unchanged, docs/PRIVACY-AUDIT.md) in
   their own paragraph under a lock, directly above the button. */
export default function SplashScreen({ onStart, onImport }) {
  const [restore, setRestore] = useState(false);
  return (
    <main className="splash">
      <svg className="splashmotif" aria-hidden="true" focusable="false" width="96" height="64" viewBox="0 0 96 64">
        <circle cx="30" cy="32" r="28" fill="var(--primary)" fillOpacity=".14" />
        <circle cx="62" cy="30" r="22" fill="var(--accent)" fillOpacity=".18" />
        <circle cx="46" cy="42" r="18" fill="var(--primary)" fillOpacity=".08" />
      </svg>
      <div className="splashmark">Cyra<span>.</span></div>
      <div className="splashtag">One companion for every phase</div>
      <h1 className="disp" style={{ marginTop: 22 }}>Periods, pregnancy,
        <br />the transition — and
        <br />finally being heard.</h1>
      <ul className="splashwhy">
        <li><Icon name="clock" size={18} />Track in 30 seconds a day.</li>
        <li><Icon name="chart" size={18} />See your real patterns.</li>
        <li><Icon name="clipboard" size={18} />Walk into appointments with evidence.</li>
      </ul>
      <p className="splashpriv"><Icon name="lock" size={16} />Your health log lives on your device. Nothing about your health leaves it unless you turn on a feature that tells you exactly what it sends.</p>
      <button className="cta" onClick={onStart}>Get started</button>
      <p className="rfoot" style={{ textAlign: "center" }}>Free to use · guidance, never diagnosis<br /><b>BUILD 2026.10.07-D</b></p>
      <button className="linkbtn" style={{ display: "block", margin: "18px auto 0" }} onClick={() => setRestore((v) => !v)}>{restore ? "Hide restore" : "Restore from an encrypted backup"}</button>
      {restore && <RestoreForm onImport={onImport} compact />}
    </main>
  );
}
