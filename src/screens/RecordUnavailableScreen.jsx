import { useState } from "react";

/* Phone build only: the record file exists but couldn't be read (iOS keeps it locked
   while the phone is locked; or the file is damaged). Nothing is saved while this
   screen shows, so the real record is never overwritten by an empty one. */
export default function RecordUnavailableScreen({ onRetry, onStartOver }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const retry = async () => { setBusy(true); try { await onRetry(); } finally { setBusy(false); } };
  return (
    <main className="splash">
      <div className="splashmark">Cyra<span>.</span></div>
      <h1 className="disp" style={{ marginTop: 26 }}>Your record couldn't be opened</h1>
      <div role="alert">
        <p className="hint">Your phone keeps Cyra's record locked while the phone itself is locked. Unlock your phone, then tap Try again. Nothing has been changed or deleted.</p>
      </div>
      <button className="cta" disabled={busy} onClick={retry}>{busy ? "Opening…" : "Try again"}</button>
      {!confirm && <button className="ghostbtn" onClick={() => setConfirm(true)}>It still won't open</button>}
      {confirm && (
        <div className="plaincard" style={{ marginTop: 10 }}>
          <p className="plain"><b>Start over on this phone?</b> If the record still won't open after unlocking, the file may be damaged. Starting over deletes it for good — Cyra holds no copy, so there's nothing to recover.</p>
          <button className="cta" style={{ background: "#A04545" }} onClick={onStartOver}>Delete it and start over</button>
          <button className="ghostbtn" onClick={() => setConfirm(false)}>Keep my record</button>
        </div>
      )}
    </main>
  );
}
