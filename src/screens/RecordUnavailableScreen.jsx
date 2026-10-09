import { useState } from "react";
import Details from "../components/Details.jsx";

/* Phone build only: the record file exists but couldn't be read. On iOS that is
   usually because the phone is locked (the file has Complete protection); otherwise
   the file may be damaged. Nothing is saved while this screen shows, so the real
   record is never overwritten by an empty one. Start over runs the same clean-up as
   Delete everything except the wearable disconnects (App.jsx wipe), always leaves this
   week's week-only hold (the unreadable record may say counts already went this week),
   and only moves on once the record is really deleted. */
export default function RecordUnavailableScreen({ platform, locked, onRetry, onStartOver }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState("");
  const retry = async () => { setBusy(true); try { await onRetry(); } finally { setBusy(false); } };
  const startOver = async () => { setDeleting(true); setErr(""); try { await onStartOver(); } catch (e) { setErr(e?.message || "Couldn't delete the record — try again"); } finally { setDeleting(false); } };
  const iosLocked = platform === "ios" && locked;
  return (
    <main className="splash">
      <div className="splashmark">Cyra<span>.</span></div>
      <h1 className="disp" style={{ marginTop: 26 }}>Your record couldn't be opened</h1>
      <div role="alert">
        <p className="hint">{iosLocked
          ? "Your iPhone keeps Cyra's record locked while it's locked. Unlock it, then tap Try again. Cyra hasn't saved anything over your record."
          : "Cyra couldn't read its record on this phone. Tap Try again. If it still won't open, the file may be damaged. Cyra hasn't saved anything over it."}</p>
      </div>
      <button className="cta" disabled={busy || deleting} onClick={retry}>{busy ? "Opening…" : "Try again"}</button>
      {!confirm && <button className="ghostbtn" onClick={() => setConfirm(true)}>It still won't open</button>}
      {confirm && (
        <div className="plaincard" style={{ marginTop: 10 }}>
          <p className="plain"><b>Start over on this phone?</b> This deletes this phone's record for good and turns off reminders, but doesn't disconnect wearables. Cyra keeps no copy of your record on its servers, so the only way back is an encrypted backup you saved — you can restore one on the next screen.</p>
          <Details label="If you connected a wearable">
            <ul>
              <li>If you connected Fitbit, Garmin or Whoop, new readings keep arriving at Cyra's server (held in memory up to 7 days, then deleted) until you remove access for Cyra or Terra, the service Cyra connects through, in that account. Terra keeps what it already collected under its own policy.</li>
              <li>If you connected Oura, remove Cyra's access in your Oura account.</li>
            </ul>
          </Details>
          {err && <p className="errhint" role="alert" style={{ marginTop: 0 }}>{err}</p>}
          <button className="cta" style={{ background: "#A04545" }} disabled={busy || deleting} onClick={startOver}>{deleting ? "Deleting…" : "Delete it and start over"}</button>
          <button className="ghostbtn" onClick={() => setConfirm(false)}>Keep my record</button>
        </div>
      )}
    </main>
  );
}
