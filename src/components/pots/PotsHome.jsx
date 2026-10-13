import { useEffect, useRef, useState } from "react";
import { fmtFluid, fmtSodium, dueDoses, nowHHMM, toMin } from "../../lib/pots.js";
import { hm } from "./ui.js";
import { LastRow } from "./QuickLog.jsx";

/* Home's "POTS today" card (design 1.5), right under the check-in button while POTS tools are
   on. "Today's insight" is never replaced: POTS has its own card. Totals come from App
   (dayTotals); missing is never zero. One planned dose that's due can be logged from here, and
   the dose just logged can be undone from the "Last" row (the last thing logged can always be
   undone). Its "Took it" button goes once the dose is logged, so focus moves to that Undo. */
export default function PotsHome({ pots, totals, todayIso, onTook, onQuickLog, onStandTest, onOpen, last = null, onUndo }) {
  const box = useRef(null), card = useRef(null);
  const [undone, setUndone] = useState(0);
  useEffect(() => {
    if (last && (!document.activeElement || document.activeElement === document.body)) box.current?.querySelector("[data-undo]")?.focus();
  }, [last]);
  // After Undo (its row goes), focus the card's "Took it" again, or Quick log.
  useEffect(() => { if (undone) card.current?.querySelector(".takebtn, .route")?.focus(); }, [undone]);
  const units = pots.settings.units, g = totals.goals;
  const parts = [];
  if (totals.fluidMl != null) parts.push(`Fluids ${fmtFluid(totals.fluidMl, units)}${g.fluidMl != null ? ` of your ${fmtFluid(g.fluidMl, units)}` : ""}`);
  if (totals.naMg != null) parts.push(`Sodium ${fmtSodium(totals.naMg, units)}${g.naMg != null ? ` of your ${fmtSodium(g.naMg, units)}` : ""}`);
  const now = nowHHMM();
  const due = dueDoses(pots, todayIso, now).sort((a, b) => Math.abs(toMin(a.slot) - toMin(now)) - Math.abs(toMin(b.slot) - toMin(now)))[0] || null;
  return (
    <>
      <p className="section-lab">POTS today</p>
      <div className="plaincard" style={{ marginBottom: 10 }} ref={card}>
        <p className="plain">{parts.length ? parts.join(" · ") : "Nothing logged yet. That's fine."}</p>
        <div ref={box}><LastRow last={last} onUndo={() => { onUndo(); setUndone((n) => n + 1); }} /></div>
        {due && (
          <div className="medrow">
            <div className="medinfo"><b>{`${due.med.name} · ${hm(due.slot)}`}</b></div>
            <button type="button" className="takebtn" aria-label={`Took ${due.med.name}, ${hm(due.slot)} dose`} onClick={() => onTook(due.med, due.slot)}>Took it</button>
          </div>
        )}
        <div className="routes" style={{ marginTop: 10 }}>
          <button type="button" className="route" onClick={onQuickLog}>Quick log<span>for foggy days</span></button>
          {pots.settings.show.test && <button type="button" className="route" onClick={onStandTest}>Stand test<span>about 15–25 minutes</span></button>}
        </div>
        <button type="button" className="ghostbtn" style={{ marginTop: 8 }} onClick={onOpen}>Open POTS tools</button>
      </div>
    </>
  );
}

/** The one-time offer after registration (owner decision D2): shown once if she ticked
    "POTS or dysautonomia", never turns POTS on by itself. Either button answers it for good. */
export function PotsOffer({ onOn, onNot }) {
  return (
    <div className="plaincard" style={{ margin: "14px 0 6px" }} role="region" aria-labelledby="pots-offer-h">
      <p className="plain" style={{ marginBottom: 6 }}><b id="pots-offer-h">POTS tools</b></p>
      <p className="plain">You mentioned POTS. Cyra can add a guided standing test, drinks and salt, symptoms and medicines, all kept on this device.</p>
      <div className="wearbtns">
        <button type="button" className="takebtn" onClick={onOn}>Turn on</button>
        <button type="button" className="sbtn" onClick={onNot}>Not now</button>
      </div>
    </div>
  );
}
