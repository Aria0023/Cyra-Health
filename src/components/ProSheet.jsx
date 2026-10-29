import { Sheet } from "./ui/index.js";
import Icon from "./Icon.jsx";

/* "See what Pro adds" (calm R5, plan §7 "Premium (Pro)"). One calm sheet, opened only when she taps a Pro chip's
   "See what Pro adds": never on its own, never blocking anything free. There is nothing to buy in this version
   (R8 wires store purchases), so it says so plainly. `unlocked` is true in a dev/QA build (VITE_FEATURES proDev),
   where the Pro parts are already open for testing. R7's Plan card in You opens the same sheet. */
export const PRO_ADDS = Object.freeze([
  ["mind", "The full practices library", "Every guided practice, not only the core set."],
  ["patterns", "Every pattern", "All the associations Cyra finds in your log, not only the first."],
  ["sparkle", "Your own experiments", "Design small experiments of your own beyond the starter ones."],
  ["pill", "Medicine and supplement reminders", "Reminders for what you take, listed in your PDF too."],
  ["note", "A weekly write-up and chat, only if you turn them on", "Each shows exactly what it would send before anything is sent."],
]);
export const FREE_KEEPS = "Free stays free: logging, the calendar, cycles, your weekly review, a core set of practices and the basic doctor-ready PDF.";
export default function ProSheet({ onClose, unlocked = false }) {
  return (
    <Sheet id="pro-sheet" title="What Pro adds" onClose={onClose} closeLabel="Close what Pro adds" className="prosheet">
      <ul className="prolist">
        {PRO_ADDS.map(([icon, t, d]) => (
          <li key={t}><span className="prolist-ico" aria-hidden="true"><Icon name={icon} size={16} /></span><span><b>{t}</b><span className="prolist-d">{d}</span></span></li>
        ))}
      </ul>
      <p className="profree">{FREE_KEEPS}</p>
      <p className="hint pronote">{unlocked ? "This is a test build: Pro's parts are unlocked here for checking. Nothing is bought." : "Pro is coming to the app stores. There's nothing to buy in this version."}</p>
      <button type="button" className="cta" onClick={onClose}>Done</button>
    </Sheet>
  );
}
