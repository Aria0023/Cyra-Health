import { Sheet, QuickTile } from "./ui/index.js";
import { t } from "../lib/i18n.js";

/* The "+" log sheet (calm R2, spec §3): one tap each into the right logger — Symptoms, Period, Sleep, Mood, Move, Meds,
   Note — as quick-log tiles in a bottom sheet. App.jsx passes only the items whose logger exists in this experience
   (lib/routes.js logItemsFor) and does the routing (onPick): the sheet closes, the tab that holds that logger opens and
   focus lands on its first control (calm R4: Move, Meds, PCOS signals and pregnancy Sleep open their own sheets, which save as she taps). The Sheet traps focus while open and hands it back on close. Nothing in this sheet itself is saved. */
export default function LogSheet({ items, onPick, onClose }) {
  return (
    <Sheet id="log-sheet" title={t("logSheet.logSomething")} closeLabel={t("logSheet.closeLogSheet")} onClose={onClose} className="logsheet">
      <p className="hint logsheet-hint">{t("logSheet.oneTapOpensTheRight")}</p>
      <div className="qtiles logtiles" role="group" aria-label={t("logSheet.whatToLog")}>
        {items.map((i) => <QuickTile key={i.id} icon={i.icon} label={i.label} tint={i.tint} onClick={() => onPick(i.id)} />)}
      </div>
    </Sheet>
  );
}
