import { useState } from "react";
import { RestoreForm } from "../components/DataControls.jsx";
import Icon from "../components/Icon.jsx";

/* Phase 1: splash. Wordmark, tagline, value proposition, the privacy promise, "Get started", and a way back
   in from an encrypted backup. UI O1: a ring motif in the stage-neutral palette and the three promises as icon
   rows. L11 (spec §4.1): the privacy promise is stated once, plainly, before any personal question: "Your
   privacy, plainly" with three items (the unchanged on-device sentence, docs/PRIVACY-AUDIT.md; no account
   needed; guidance, never a diagnosis), directly above the button. The restore link is now a 44px toggle
   (.ghostbtn.quiet, aria-expanded / aria-controls) with a constant label. initialRestore (L10): App.jsx opens the
   restore form straight away after a forgotten-PIN restore that deleted the record but couldn't write the backup. */
export default function SplashScreen({ onStart, onImport, initialRestore = false }) {
  const [restore, setRestore] = useState(initialRestore);
  return (
    <main className="splash">
      <svg className="splashmotif" aria-hidden="true" focusable="false" width="96" height="64" viewBox="0 0 96 64">
        <circle cx="30" cy="32" r="28" fill="var(--primary)" fillOpacity=".14" />
        <circle cx="62" cy="30" r="22" fill="var(--accent)" fillOpacity=".18" />
        <circle cx="46" cy="42" r="18" fill="var(--primary)" fillOpacity=".08" />
      </svg>
      <div className="splashmark">Cyra<span>.</span></div>
      <div className="splashtag">One companion for every phase</div>
      <h1 className="disp" style={{ marginTop: 16 }}>Periods, pregnancy,
        <br />the transition — and
        <br />finally being heard.</h1>
      <ul className="splashwhy">
        <li><Icon name="clock" size={18} />Track in 30 seconds a day.</li>
        <li><Icon name="chart" size={18} />See your real patterns.</li>
        <li><Icon name="clipboard" size={18} />Walk into appointments with evidence — cycles, symptoms, PCOS signals.</li>
      </ul>
      <h2 className="section-lab splashpromise-h" id="splash-promise">Your privacy, plainly</h2>
      <ul className="splashpromise" aria-labelledby="splash-promise">
        <li><Icon name="lock" size={16} />Your health log lives on your device. Nothing about your health leaves it unless you turn on a feature that tells you exactly what it sends.</li>
        <li><Icon name="user" size={16} />No account needed. There's no Cyra account to make, and your name and email are optional.</li>
        <li><Icon name="book" size={16} />Guidance, never a diagnosis. For anything medical, talk with your clinician.</li>
      </ul>
      <button className="cta" onClick={onStart}>Get started</button>
      <button type="button" className="ghostbtn quiet splashrestore" aria-expanded={restore} aria-controls="splash-restore" onClick={() => setRestore((v) => !v)}>Restore from an encrypted backup</button>
      <div id="splash-restore" hidden={!restore}>{restore && <RestoreForm onImport={onImport} compact />}</div>
      <p className="rfoot" style={{ textAlign: "center" }}>Free to use<br /><b>BUILD 2026.10.07-D</b></p>
    </main>
  );
}
