import { useEffect, useRef, useState } from "react";
import { POTS_LOCKED_COPY, POTS_ERASE } from "../../lib/potsConstants.js";
import { isLockedPots } from "../../lib/pots.js";
import Details from "../Details.jsx";
import { potsUnsaved } from "./ui.js";

/** "Exactly what's kept", first line, by where the record really is (ui.js potsUnsaved). */
const KEPT = {
  saved: "Everything you log in POTS tools is stored on this device with the rest of your record, and goes into an encrypted backup if you save one.",
  memory: "Everything you log in POTS tools is kept with the rest of your record, which right now is only in memory for this session (see Your data below): it's lost when you close Cyra unless you save an encrypted backup.",
  stale: "Everything you log in POTS tools is kept with the rest of your record, but Cyra couldn't confirm your latest changes were saved on this device (see Your data below). It goes into an encrypted backup if you save one.",
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

export default function PotsAddon({ pots, stageName, onOn, onOff, storageDriver = null }) {
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
    return (
      <div className="medrow" style={{ borderTop: "none", padding: "4px 0 8px" }}>
        <div className="medinfo"><b>POTS tools</b><span>{POTS_LOCKED_COPY}</span></div>
      </div>
    );
  }
  const on = pots.on === true;
  const open = on && ask !== null;
  return (
    <>
      <div className="medrow" style={{ borderTop: "none", padding: "4px 0 8px" }}>
        <div className="medinfo"><b id="pots-addon-title">POTS tools</b><span>{on ? "On. Open it from the POTS today card on Home." : `For a racing heart, dizziness or feeling faint when you're upright, with or without a diagnosis. Adds POTS tools to Home: a guided standing test, drinks and salt, symptoms, medicines, an exercise plan and a report for your clinician. Works alongside ${stageName || "your life stage"}. It doesn't change your life stage.`}</span></div>
        <button ref={switchRef} className={`takebtn ${on ? "on" : ""}`} aria-pressed={on} aria-describedby="pots-addon-title"
          aria-expanded={on ? open : undefined} aria-controls={open ? CARD_ID : undefined}
          onClick={() => { if (on) setAsk(ask ? null : "off"); else { setAsk(null); onOn(); } }}>{on ? "✓ On" : "Turn on"}</button>
      </div>
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
          <button className="cta" style={{ background: "#A04545" }} onClick={() => { go(null, "switch"); onOff({ erase: true }); }}>Delete POTS log</button>
          <button className="ghostbtn" onClick={() => go("off", "off")}>Keep it</button>
        </div>
      )}
      <Details label="Exactly what's kept">
        <ul>
          <li>{KEPT[potsUnsaved(storageDriver) || "saved"]}</li>
          <li>None of it is part of weekly counts, and none of it is sent to Cyra's server or Cyra's AI.</li>
          <li>A report or spreadsheet you make is an ordinary file, not locked with a passphrase. It goes only where you save or send it.</li>
          <li>Turning POTS tools off hides the tab and keeps what you logged, unless you choose to erase it.</li>
        </ul>
      </Details>
    </>
  );
}
