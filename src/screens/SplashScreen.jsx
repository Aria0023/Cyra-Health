import { useState } from "react";
import { RestoreForm } from "../components/DataControls.jsx";
import Icon from "../components/Icon.jsx";
import BrandMark from "../components/BrandMark.jsx";
import { BUILD_STAMP } from "../lib/about.js";
import { splashAccountLine } from "../lib/disclosures.js";
import { ACCOUNT_COPY } from "../lib/account.js";
import { t } from "../lib/i18n.js";

/* Phase 1: splash. Wordmark, tagline, value proposition, the privacy promise, "Get started", and a way back
   in from an encrypted backup. UI O1: a ring motif in the stage-neutral palette and the three promises as icon
   rows. L11 (spec §4.1): the privacy promise is stated once, plainly, before any personal question: "Your
   privacy, plainly" with three items (the unchanged on-device sentence, docs/PRIVACY-AUDIT.md; no account
   needed; guidance, never a diagnosis), directly above the button. The restore link is now a 44px toggle
   (.ghostbtn.quiet, aria-expanded / aria-controls) with a constant label. initialRestore (L10): App.jsx opens the
   restore form straight away after a forgotten-PIN restore that deleted the record but couldn't write the backup. */
/* Calm R9: in a build that offers the optional account (`accounts`), the second promise says so (still "No account
   needed": guest is the default and nothing asks her to sign in), and with Pro (`onSignIn`) one quiet "Sign in to restore
   from your account" button sits under the file restore. */
/* Heard Health rename: the Heard mark (BrandMark) replaces the three-circle motif in the same place, the wordmark is
   "Heard" with "HEALTH" beside it (as the header), and the tagline is the slogan "I am Heard". */
export default function SplashScreen({ onStart, onImport, initialRestore = false, accounts = false, onSignIn = null }) {
  const [restore, setRestore] = useState(initialRestore);
  return (
    <main className="splash">
      <BrandMark size={60} className="splashmotif" />
      <div className="splashmark">{t("splash.cyra")}<span className="sub">{t("splash.health")}</span></div>
      <div className="splashtag slogan">{t("splash.slogan")}</div>
      <h1 className="disp" style={{ marginTop: 16 }}>{t("splash.periodsPregnancy")}
        <br />{t("splash.theTransitionAnd")}
        <br />{t("splash.finallyBeingHeard")}</h1>
      <ul className="splashwhy">
        <li><Icon name="clock" size={18} />{t("splash.trackIn30SecondsA")}</li>
        <li><Icon name="chart" size={18} />{t("splash.seeYourRealPatterns")}</li>
        <li><Icon name="clipboard" size={18} />{t("splash.walkIntoAppointmentsWithEvidence")}</li>
      </ul>
      <h2 className="section-lab splashpromise-h" id="splash-promise">{t("splash.yourPrivacyPlainly")}</h2>
      <ul className="splashpromise" aria-labelledby="splash-promise">
        <li><Icon name="lock" size={16} />{t("splash.yourHealthLogLivesOn")}</li>
        <li><Icon name="user" size={16} />{splashAccountLine(accounts)}</li>
        <li><Icon name="book" size={16} />{t("splash.guidanceNeverADiagnosisFor")}</li>
      </ul>
      <button className="cta" onClick={onStart}>{t("splash.getStarted")}</button>
      <button type="button" className="ghostbtn quiet splashrestore" aria-expanded={restore} aria-controls="splash-restore" onClick={() => setRestore((v) => !v)}>{t("splash.restoreFromAnEncryptedBackup")}</button>
      <div id="splash-restore" hidden={!restore}>{restore && <RestoreForm onImport={onImport} compact />}</div>
      {onSignIn && <button type="button" className="ghostbtn quiet splashacct" aria-haspopup="dialog" onClick={onSignIn}>{ACCOUNT_COPY.signInSplash}</button>}
      <p className="rfoot" style={{ textAlign: "center" }}>{t("splash.freeToUse")}<br /><b>{BUILD_STAMP}</b></p>
    </main>
  );
}
