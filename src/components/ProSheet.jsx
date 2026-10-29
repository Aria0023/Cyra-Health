import { Sheet } from "./ui/index.js";
import Icon from "./Icon.jsx";

/* "See what Pro adds" (calm R5, plan §7 "Premium (Pro)"). One calm sheet, opened only when she taps a Pro chip's
   "See what Pro adds": never on its own, never blocking anything free. Calm R8: every line under "What Pro adds" is
   something this build really opens for Pro (lib/plan.js): the full practices library, and, only in a build that has
   Cyra's AI and a server (`ai`), the weekly write-up and the chat, each previewed before every send. What is planned
   but not built is listed apart, as planned. Patterns are not gated: every pattern card stays free (plan §7's Pro list
   doesn't include them, and basic insights are free core), and so does the basic doctor-ready PDF. There is nothing to
   buy in this version (lib/purchase.js: no store is connected), so it says so plainly. `unlocked` is true in a dev/QA
   build (VITE_FEATURES proDev), where the Pro parts are already open for testing. R7's Plan card opens the same sheet. */
export const PRO_ADDS = Object.freeze([
  ["mind", "The full practices library", "Every guided practice, not only the core set."],
]);
export const PRO_AI = Object.freeze(["note", "A weekly write-up and chat about your log, only if you turn them on", "Written by Cyra's AI from a summary of your log with no dates, notes or anything that names you. Each shows exactly what it would send before anything is sent."]);
export const PRO_PLANNED = Object.freeze(["Your own experiments, beyond the starter ones", "Medicine and supplement reminders", "A richer PDF with trends and the write-up"]);
export const FREE_KEEPS = "Free stays free: logging, the calendar, cycles, every pattern Cyra finds, your weekly review, a core set of practices and the basic doctor-ready PDF.";
/** Calm R9: only in a build that offers the optional account (lib/cloudBackup.js ACCOUNTS_HERE). */
export const PRO_CLOUD = Object.freeze(["shield", "An encrypted backup to Cyra's server, if you make an account", "Bring your log back on a new phone or browser with your email and passphrase. It's encrypted on your device first; Cyra can't read it."]);
export const proAddsFor = (ai, cloud = false) => [...PRO_ADDS, ...(ai ? [PRO_AI] : []), ...(cloud ? [PRO_CLOUD] : [])];
export default function ProSheet({ onClose, unlocked = false, ai = false, cloud = false }) {
  return (
    <Sheet id="pro-sheet" title="What Pro adds" onClose={onClose} closeLabel="Close what Pro adds" className="prosheet">
      <ul className="prolist" aria-label="What Pro adds in this version">
        {proAddsFor(ai, cloud).map(([icon, t, d]) => (
          <li key={t}><span className="prolist-ico" aria-hidden="true"><Icon name={icon} size={16} /></span><span><b>{t}</b><span className="prolist-d">{d}</span></span></li>
        ))}
      </ul>
      <p className="section-lab proplanned-lab" id="pro-planned">Planned for Pro, not in this version yet</p>
      <ul className="proplanned" aria-labelledby="pro-planned">{PRO_PLANNED.map((t) => <li key={t}>{t}</li>)}</ul>
      <p className="profree">{FREE_KEEPS}</p>
      <p className="hint pronote">{unlocked ? "This is a test build: Pro's parts are unlocked here for checking. Nothing is bought." : "Pro is coming to the app stores. There's nothing to buy in this version."}</p>
      <button type="button" className="cta" onClick={onClose}>Done</button>
    </Sheet>
  );
}
