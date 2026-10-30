import { ACCOUNTS_HERE } from "../../lib/cloudBackup.js";
import { useEffect, useRef, useState } from "react";
import { POTS_LOCKED_COPY, POTS_ERASE } from "../../lib/potsConstants.js";
import { isLockedPots } from "../../lib/pots.js";
import Details from "../Details.jsx";
import { potsUnsaved } from "./ui.js";
import ModuleRow from "../ModuleRow.jsx";
import { MODULE_ADDS } from "../../lib/about.js";
import { FEATURES } from "../../lib/features.js";
import { potsNeverSent } from "../../lib/disclosures.js";

/** "Exactly what's kept", first line, by where the record really is (ui.js potsUnsaved). */
const KEPT = {
  saved: "Everything you log in POTS tools is stored on this device with the rest of your record, and goes into an encrypted backup if you save one.",
  memory: "Everything you log in POTS tools is kept with the rest of your record, which right now is only in memory for this session (see Privacy & your data below): it's lost when you close Heard Health unless you save an encrypted backup.",
  stale: "Everything you log in POTS tools is kept with the rest of your record, but Heard Health couldn't confirm your latest changes were saved on this device (see Privacy & your data below). It goes into an encrypted backup if you save one.",
};

/* Settings → Add-ons: the POTS tools switch (lib/pots.js, spec A13). It shows only once a life
   stage is chosen and never changes it. Turning off asks first: hide the tab and keep the log,
   or hide it and erase the log (eraseLog: a new epoch, so no other open tab merges it back).
   Every sentence names only what this build does (design 1.2, copy rule).

   Focus: while on, "✓ On" is a disclosure (aria-expanded/aria-controls) for the turn-off card,
   so focus stays on it when the card opens. Swapping one card for the other moves focus to the
   new card's first line (so the erase confirm is read when it appears); closing a card
   (Cancel, Hide, Delete POTS log) returns focus to the switch. Focus moves only after a tap
   here, never on arrival. */
const CARD_ID = "pots-off-card";

/* Calm R7: `module` renders the same switch as a row of the You page's Modules card (components/ModuleRow.jsx): a real
   role="switch" named "POTS", with the one-line "what it adds"; the turn-off card, the erase confirm, the focus moves
   and "Exactly what's kept" are the same. Settings → Add-ons keeps its own row (the sheet and the You page are never
   on screen together: App.jsx closes the sheet on You), so the ids below are unique on any screen. */
export default function PotsAddon({ pots, stageName, onOn, onOff, storageDriver = null, module = false }) {
  const [ask, setAsk] = useState(null); // null | "off" (turn-off card) | "erase" (erase confirm)
  const [focusTo, setFocusTo] = useState(null); // null | "switch" | "off" | "erase"
  const switchRef = useRef(null), offRef = useRef(null), eraseRef = useRef(null);
  useEffect(() => {
    if (!focusTo) return;
    ({ switch: switchRef, off: offRef, erase: eraseRef })[focusTo].current?.focus();
    setFocusTo(null);
  }, [focusTo, ask]);
  const go = (next, focus) => { setAsk(next); setFocusTo(focus); };

  if (isLockedPots(pots)) {
    if (module) return <ModuleRow id="pots" icon="pulse" name="POTS" short="Postural orthostatic tachycardia syndrome" locked={POTS_LOCKED_COPY} />;
    return (
      <div className="medrow" style={{ borderTop: "none", padding: "4px 0 8px" }}>
        <div className="medinfo"><b>POTS tools</b><span>{POTS_LOCKED_COPY}</span></div>
      </div>
    );
  }
  const on = pots.on === true;
  const open = on && ask !== null;
  const cards = (<>
      {on && ask === "off" && (
        <div id={CARD_ID} className="plaincard" style={{ marginBottom: 10 }}>
          <p className="plain" tabIndex={-1} ref={offRef}><b>Turn off POTS tools?</b></p>
          <button className="cta" onClick={() => { go(null, "switch"); onOff({ erase: false }); }}>Hide POTS tools (keep my POTS log)</button>
          <button className="ghostbtn" onClick={() => go("erase", "erase")}>Hide it and erase my POTS log</button>
          <button className="linkbtn" style={{ marginTop: 6 }} onClick={() => go(null, "switch")}>Cancel</button>
        </div>
      )}
      {on && ask === "erase" && (
        <div id={CARD_ID} className="plaincard" style={{ marginBottom: 10 }}>
          <p className="plain" tabIndex={-1} ref={eraseRef}>{POTS_ERASE}</p>
          <button className="cta stopbtn" onClick={() => { go(null, "switch"); onOff({ erase: true }); }}>Delete POTS log</button>
          <button className="ghostbtn" onClick={() => go("off", "off")}>Keep it</button>
        </div>
      )}
      <Details label="Exactly what's kept">
        <ul>
          <li>Works alongside {stageName || "your life stage"}. It doesn't change your life stage.</li>
          <li>{KEPT[potsUnsaved(storageDriver) || "saved"]}</li>
          <li>{potsNeverSent(FEATURES, ACCOUNTS_HERE)}</li>
          <li>A report or spreadsheet you make is an ordinary file, not locked with a passphrase. It goes only where you save or send it.</li>
          <li>Turning POTS tools off hides the tab and keeps what you logged, unless you choose to erase it.</li>
        </ul>
      </Details>
  </>);
  const toggle = () => { if (on) setAsk(ask ? null : "off"); else { setAsk(null); onOn(); } };
  if (module) {
    return (
      <ModuleRow id="pots" icon="pulse" name="POTS" short="Postural orthostatic tachycardia syndrome" adds={MODULE_ADDS.pots} on={on} onToggle={toggle} controls={open ? CARD_ID : undefined} switchRef={switchRef}>{cards}</ModuleRow>
    );
  }
  return (
    <>
      <div className="medrow" style={{ borderTop: "none", padding: "4px 0 8px" }}>
        <div className="medinfo"><b id="pots-addon-title">POTS tools</b><span>{on ? "On. Open it from the POTS today card on Home." : "For a racing heart, dizziness or feeling faint when you're upright, with or without a diagnosis: a standing test, drinks and salt, symptoms, medicines, an exercise plan and a clinician report, on Home."}</span></div>
        <button ref={switchRef} className={`takebtn ${on ? "on" : ""}`} aria-pressed={on} aria-describedby="pots-addon-title"
          aria-expanded={on ? open : undefined} aria-controls={open ? CARD_ID : undefined}
          onClick={() => { if (on) setAsk(ask ? null : "off"); else { setAsk(null); onOn(); } }}>{on ? "✓ On" : "Turn on"}</button>
      </div>
      {cards}
    </>
  );
}
