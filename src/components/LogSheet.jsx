import { Sheet, QuickTile } from "./ui/index.js";

/* The "+" log sheet (calm R2, spec §3): one tap each into the right logger — Symptoms, Period, Sleep, Mood, Move, Meds,
   Note — as quick-log tiles in a bottom sheet. App.jsx passes only the items whose logger exists in this experience
   (lib/routes.js logItemsFor) and does the routing (onPick): the sheet closes, the tab that holds that logger opens and
   focus lands on its first control. The Sheet traps focus while open and hands it back on close. Nothing here is saved. */
export default function LogSheet({ items, onPick, onClose }) {
  return (
    <Sheet id="log-sheet" title="Log something" closeLabel="Close log sheet" onClose={onClose} className="logsheet">
      <p className="hint logsheet-hint">One tap opens the right place. Nothing is saved until you save it there.</p>
      <div className="qtiles logtiles" role="group" aria-label="What to log">
        {items.map((i) => <QuickTile key={i.id} icon={i.icon} label={i.label} tint={i.tint} onClick={() => onPick(i.id)} />)}
      </div>
    </Sheet>
  );
}
