import { Card, Sheet } from "./ui/index.js";
import { DEVICE_COPY as C } from "../lib/devices.js";

/* "Connect your devices" (Task 2): the one list of device sources (lib/devices.js deviceRows), shown as the optional
   registration step, in a sheet opened from the Home card and from You → Data sources. Each row: name, status, what it
   reads, where it goes, and at most one button. Nothing here sends anything: onConnect / onDisconnect (App.jsx
   connectWear / disconnectAny) run the existing flows after her tap; the row itself is the disclosure, so a first
   connect starts straight away. */
export function DeviceList({ rows, busy = null, onConnect, onDisconnect, demo = false }) {
  return (
    <>
      <ul className="devlist">
        {rows.map((r) => {
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
        })}
      </ul>
      {demo && <p className="rfoot">{C.demoNote}</p>}
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
