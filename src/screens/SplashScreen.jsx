import { useState } from "react";
import { RestoreForm } from "../components/DataControls.jsx";

/* Phase 1: splash. Wordmark, tagline, value proposition, "Get started", and a way
   back in from an encrypted backup. */
export default function SplashScreen({ onStart, onImport }) {
  const [restore, setRestore] = useState(false);
  return (
    <main className="splash">
      <div className="splashmark">Cyra<span>.</span></div>
      <div className="splashtag">One companion for every phase</div>
      <h1 className="disp" style={{ marginTop: 26 }}>Periods, pregnancy,
        <br />the transition — and
        <br />finally being heard.</h1>
      <p className="hint">Track in 30 seconds a day. See your real patterns. Walk into appointments with evidence. Your health log lives on your device. Nothing about your health leaves it unless you turn on a feature that tells you exactly what it sends.</p>
      <button className="cta" onClick={onStart}>Get started</button>
      <p className="rfoot" style={{ textAlign: "center" }}>Free to use · guidance, never diagnosis<br /><b>BUILD 2026.10.07-D</b></p>
      <button className="linkbtn" style={{ display: "block", margin: "18px auto 0" }} onClick={() => setRestore((v) => !v)}>{restore ? "Hide restore" : "Restore from an encrypted backup"}</button>
      {restore && <RestoreForm onImport={onImport} compact />}
    </main>
  );
}
