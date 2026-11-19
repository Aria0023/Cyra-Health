import { Card, Sheet } from "./ui/index.js";
import { DEVICE_COPY as C } from "../lib/devices.js";
import Details from "./Details.jsx";

/* "Connect your devices" (Task 2): the one list of device sources (lib/devices.js deviceRows), shown as the optional
   registration step, in a sheet opened from the Home card and from You → Data sources. Each row: name, status, what it
   reads, where it goes, and at most one button. Nothing here sends anything: onConnect / onDisconnect (App.jsx
   connectWear / disconnectAny) run the existing flows after her tap; the row itself is the disclosure, so a first
   connect starts straight away.
   2026-11-19: `howto` (lib/devices.js deviceHowTo) is the "Fitbit, Garmin or Whoop?" disclosure under the list: three short
   steps per brand to share with Apple Health / Health Connect in the brand's own app, and what doesn't come through. */
export function DeviceList({ rows, busy = null, onConnect, onDisconnect, demo = false, extra = null, howto = null }) {
  const row = (r) => {
    const nameId = `dev-${r.id}`, whyId = `dev-${r.id}-st`;
    const going = busy === r.source, ending = busy === `${r.source}:off`;
    return (
      <li key={r.id} className={`devrow st-${r.state}`} data-device={r.id}>
        <div className="devrow-main">
          <div className="devinfo">
            <b id={nameId}>{r.name}</b>
            <span className="devstatus" id={whyId}>{r.status}{r.note ? ` ${r.note}` : ""}</span>
          </div>
          {r.state === "available" && <button type="button" className="takebtn devgo" aria-describedby={`${nameId} ${whyId}`} disabled={!!busy} aria-busy={going} onClick={() => onConnect(r)}>{going ? C.connecting : C.connect}</button>}
          {r.state === "pending" && <button type="button" className="takebtn devgo" aria-describedby={nameId} disabled={!!busy} aria-busy={going} onClick={() => onConnect(r)}>{C.sync}</button>}
          {r.state === "connected" && <button type="button" className="takebtn devoff" aria-describedby={nameId} disabled={!!busy} aria-busy={ending} onClick={() => onDisconnect(r)}>{ending ? C.disconnecting : C.disconnect}</button>}
        </div>
        <p className="devline"><b>{C.reads}:</b> {r.reads}</p>
        <p className="devline"><b>{C.where}:</b> {r.where}</p>
      </li>
    );
  };
  const main = rows.filter((r) => !r.glucose), gluc = rows.filter((r) => r.glucose);
  return (
    <>
      {main.length > 0 && <ul className="devlist">{main.map(row)}</ul>}
      {howto && (
        <div className="devhowto" data-howto="">
          <Details label={howto.label}>
            <p>{howto.lead}</p>
            {howto.brands.map((b) => (
              <div key={b.id} className="devhow" data-brand={b.id}>
                <p className="devhow-name" id={`devhow-${b.id}`}><b>{b.name}</b></p>
                <ol aria-labelledby={`devhow-${b.id}`}>{b.steps.map((t) => <li key={t}>{t}</li>)}</ol>
                {b.note && <p className="devhow-note">{b.note}</p>}
              </div>
            ))}
            <p>{howto.missing}</p>
            <p>{howto.menus}</p>
          </Details>
        </div>
      )}
      {/* Task B: blood glucose through Apple Health / Health Connect (Dexcom, FreeStyle Libre). */}
      {gluc.length > 0 && (
        <>
          <h3 className="section-lab devsub" id="dev-glucose-h">Blood glucose</h3>
          <p className="hint devlead">{C.glucoseLead}</p>
          <ul className="devlist" aria-labelledby="dev-glucose-h">{gluc.map(row)}</ul>
        </>
      )}
      {demo && <p className="rfoot">{C.demoNote}</p>}
      {extra}
    </>
  );
}

export function DevicesSheet({ onClose, ...list }) {
  return (
    <Sheet id="devices-sheet" title={C.title} onClose={onClose} closeLabel={`Close ${C.title}`} className="devsheet">
      <p className="hint devlead">{C.lead}</p>
      <DeviceList {...list} />
    </Sheet>
  );
}

/** Home: shown until something is connected or she taps Not now (lib/devices.js homeDevicesCard). */
export function DevicesHomeCard({ onOpen, onHide }) {
  return (
    <Card id="home-devices" tint="body" icon="watch" title={C.homeTitle} level={2} className="devhome">
      <p className="hint">{C.homeBody}</p>
      <div className="devhome-acts">
        <button type="button" className="ghostbtn" aria-haspopup="dialog" onClick={onOpen}>{C.homeOpen}</button>
        <button type="button" className="linkbtn" onClick={onHide}>{C.homeHide}</button>
      </div>
    </Card>
  );
}
