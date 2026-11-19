import { Sheet, QuickTile } from "./ui/index.js";
import { t } from "../lib/i18n.js";
import Icon from "./Icon.jsx";
import { SHOP_PAGE_COPY } from "../lib/shop.js";

/* The "+" log sheet (calm R2, spec §3): one tap each into the right logger — Symptoms, Period, Sleep, Mood, Move, Meds,
   Note — as quick-log tiles in a bottom sheet. App.jsx passes only the items whose logger exists in this experience
   (lib/routes.js logItemsFor) and does the routing (onPick): the sheet closes, the tab that holds that logger opens and
   focus lands on its first control (calm R4: Move, Meds, PCOS signals and pregnancy Sleep open their own sheets, which save as she taps). The Sheet traps focus while open and hands it back on close. Nothing in this sheet itself is saved. */
export default function LogSheet({ items, onPick, onClose, onDevices = null, onShop = null }) {
  return (
    <Sheet id="log-sheet" title={t("logSheet.logSomething")} closeLabel={t("logSheet.closeLogSheet")} onClose={onClose} className="logsheet">
      <p className="hint logsheet-hint">{t("logSheet.oneTapOpensTheRight")}</p>
      <div className="qtiles logtiles" role="group" aria-label={t("logSheet.whatToLog")}>
        {items.map((i) => <QuickTile key={i.id} icon={i.icon} label={i.label} tint={i.tint} onClick={() => onPick(i.id)} />)}
      </div>
      {/* Task B: a device can be connected from here any time, not only at the start. */}
      {onDevices && <button type="button" className="linkbtn logdevices" aria-haspopup="dialog" onClick={onDevices}><Icon name="watch" size={16} />Connect a device</button>}
      {/* The shop is easy to find from here too: one row at the bottom, under a divider. */}
      {onShop && <div className="logshop"><button type="button" className="linkbtn logshop-go" onClick={onShop}><Icon name="bag" size={16} />{SHOP_PAGE_COPY.sheetRow}<Icon name="arrow-right" size={14} /></button></div>}
    </Sheet>
  );
}
