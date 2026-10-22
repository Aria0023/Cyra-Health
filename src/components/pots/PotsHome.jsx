import { useEffect, useRef, useState } from "react";
import { fmtFluid, fmtSodium, dueDoses, nowHHMM, toMin, usualFluid } from "../../lib/pots.js";
import { hm, amountText, isOz, isGSalt } from "./ui.js";
import { LastRow } from "./QuickLog.jsx";
import { GoalMeter, ozConv, gConv } from "./FluidSalt.jsx";
import Icon from "../Icon.jsx";

/* Home's "POTS today" card (design 1.5), right under the check-in button while POTS tools are
   on. "Today's insight" is never replaced: POTS has its own card. Totals come from App
   (dayTotals); missing is never zero. With goals set, two compact meters (fluids in the palette
   primary, sodium in the accent) show the day against them; the totals sentence stays for
   assistive tech. Her usual drink (lib/pots.js usualFluid) logs in one tap from here ("+ Add",
   App's onDrink, the same addIntake and toast as the page), and one planned dose that's due can
   be logged from here too; the thing just logged can be undone from the "Last" row (the last
   thing logged can always be undone). "Took it" goes away once the dose is logged and hands focus
   to that Undo; "+ Add" stays (a second glass is a second tap) and keeps focus. Undo hands focus
   back to the button that logged the item. */
export default function PotsHome({ pots, totals, todayIso, onTook, onDrink = null, onQuickLog, onStandTest, onOpen, last = null, onUndo }) {
  const box = useRef(null), card = useRef(null);
  const [undone, setUndone] = useState(null);
  useEffect(() => {
    if (last && (!document.activeElement || document.activeElement === document.body)) box.current?.querySelector("[data-undo]")?.focus();
  }, [last]);
  // After Undo (its row goes), focus the button that logged it: "Took it" for a dose, "+ Add" for a drink, else Quick log.
  useEffect(() => {
    if (!undone || !card.current) return;
    const q = (sel) => card.current.querySelector(sel);
    const order = undone.kind === "dose" ? ["[data-took]", "[data-add]", ".route"] : ["[data-add]", "[data-took]", ".route"];
    (order.map(q).find(Boolean) || null)?.focus();
  }, [undone]);
  const units = pots.settings.units, g = totals.goals;
  const parts = [];
  if (totals.fluidMl != null) parts.push(`Fluids ${fmtFluid(totals.fluidMl, units)}${g.fluidMl != null ? ` of your ${fmtFluid(g.fluidMl, units)}` : ""}`);
  if (totals.naMg != null) parts.push(`Sodium ${fmtSodium(totals.naMg, units)}${g.naMg != null ? ` of your ${fmtSodium(g.naMg, units)}` : ""}`);
  const sentence = parts.length ? parts.join(" · ") : "Nothing logged yet. That's fine.";
  const meters = g.fluidMl != null || g.naMg != null;
  const now = nowHHMM();
  const due = dueDoses(pots, todayIso, now).sort((a, b) => Math.abs(toMin(a.slot) - toMin(now)) - Math.abs(toMin(b.slot) - toMin(now)))[0] || null;
  const drink = onDrink ? usualFluid(pots) : null;
  const drinkAmount = drink ? amountText(drink.ml, units) : "";
  return (
    <>
      <p className="section-lab potslab"><span aria-hidden="true"><Icon name="heart" className="labico" /></span>POTS today</p>
      <div className="plaincard pots-home" style={{ marginBottom: 10 }} ref={card}>
        {/* The totals sentence is the card's first .plain line; with meters it is read, not seen. */}
        <p className={`plain ${meters ? "sr-only" : ""}`}>{sentence}</p>
        {meters && (
          <div className={`meters ${g.fluidMl != null && g.naMg != null ? "two" : ""}`}>
            {g.fluidMl != null && <GoalMeter compact label="Fluids" whenWord="today" total={totals.fluidMl} goal={g.fluidMl} by={g.by} conv={isOz(units) ? ozConv : (x) => x} unitWord={isOz(units) ? "fluid ounces" : "millilitres"} goalText={fmtFluid(g.fluidMl, units)} totalText={fmtFluid(totals.fluidMl, units)} />}
            {g.naMg != null && <GoalMeter compact tone="salt" label="Sodium" whenWord="today" total={totals.naMg} goal={g.naMg} by={g.by} conv={isGSalt(units) ? gConv : (x) => x} unitWord={isGSalt(units) ? "grams of salt" : "milligrams of sodium"} goalText={fmtSodium(g.naMg, units)} totalText={fmtSodium(totals.naMg, units)} />}
          </div>
        )}
        <div ref={box}><LastRow last={last} onUndo={() => { const kind = last?.kind || "dose"; onUndo(); setUndone({ n: (undone?.n || 0) + 1, kind }); }} /></div>
        {drink && (
          <div className="medrow">
            <div className="medinfo"><b>{drinkAmount}</b><span>Your usual drink</span></div>
            <button type="button" className="takebtn" data-add="" aria-label={`Add ${drinkAmount}`} onClick={() => onDrink(drink)}>+ Add</button>
          </div>
        )}
        {due && (
          <div className="medrow">
            <div className="medinfo"><b>{`${due.med.name} · ${hm(due.slot)}`}</b></div>
            <button type="button" className="takebtn" data-took="" aria-label={`Took ${due.med.name}, ${hm(due.slot)} dose`} onClick={() => onTook(due.med, due.slot)}>Took it</button>
          </div>
        )}
        <div className="routes" style={{ marginTop: 10 }}>
          <button type="button" className="route" onClick={onQuickLog}>Quick log<span>Simple view · for foggy days</span></button>
          {pots.settings.show.test && <button type="button" className="route" onClick={onStandTest}>Stand test<span>about 15–25 minutes</span></button>}
        </div>
        <button type="button" className="ghostbtn potsopen" onClick={onOpen}>Open POTS tools</button>
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
