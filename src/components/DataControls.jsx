import { useState } from "react";

/* Your data: where it lives, encrypted backup out/in, delete everything.
   Every action runs on this device; the passphrase is used once and never kept. */
export function RestoreForm({ onImport, onDone, compact = false }) {
  const [file, setFile] = useState(null);
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    if (!file) return setErr("Choose your backup file first");
    setBusy(true); setErr("");
    try { await onImport(file, pass); onDone?.(); } catch (e) { setErr(e.message || "Couldn't restore"); } finally { setBusy(false); }
  };
  return (
    <div className="plaincard" style={{ marginTop: compact ? 10 : 0 }}>
      <p className="lab" style={{ margin: "0 0 6px" }}>Restore from an encrypted backup</p>
      <input className="inp" type="file" accept=".json,.cyra,application/json" aria-label="Backup file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <input className="inp" type="password" placeholder="Backup passphrase" aria-label="Backup passphrase" value={pass} onChange={(e) => setPass(e.target.value)} />
      {err && <p className="errhint" style={{ marginTop: 0 }}>{err}</p>}
      <button className="cta" disabled={busy} onClick={go}>{busy ? "Unlocking…" : "Restore"}</button>
      <p className="rfoot">Decrypted on this device with your passphrase. Restoring replaces what's here now.</p>
    </div>
  );
}

export default function DataControls({ driver, onExport, onImport, onWipe, ping }) {
  const [mode, setMode] = useState(null); // null | "export" | "import" | "wipe"
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Phone build: a web view can't save a download, so there is no backup file to offer
  // there (yet) — and no copy may promise one.
  const where = driver === "app-sandbox" ? "in this app's protected storage on your phone" : driver === "indexeddb" ? "in this browser's on-device database (not cookies, not localStorage)" : "in memory for this session only — nothing is saved";
  const doExport = async () => {
    setErr("");
    if (pass.length < 8) return setErr("Use a passphrase of at least 8 characters");
    if (pass !== pass2) return setErr("The two passphrases don't match");
    setBusy(true);
    try { const saved = await onExport(pass); if (saved === false) return; setMode(null); setPass(""); setPass2(""); ping("Backup saved — keep the passphrase somewhere safe; it can't be recovered"); } catch (e) { setErr(e.message || "Couldn't create the backup"); } finally { setBusy(false); }
  };
  return (
    <>
      <p className="section-lab" style={{ margin: "14px 0 8px" }}>Your data</p>
      <p className="hint" style={{ margin: "0 0 10px" }}>Everything you log is stored {where}. It is never sent to Cyra's servers.</p>
      <div className="mcrow">
        <button className={`mc ${mode === "export" ? "on" : ""}`} onClick={() => { setMode(mode === "export" ? null : "export"); setErr(""); }}>Encrypted backup</button>
        <button className={`mc ${mode === "import" ? "on" : ""}`} onClick={() => { setMode(mode === "import" ? null : "import"); setErr(""); }}>Restore</button>
        <button className={`mc ${mode === "wipe" ? "on" : ""}`} onClick={() => { setMode(mode === "wipe" ? null : "wipe"); setErr(""); }}>Delete everything</button>
      </div>
      {mode === "export" && (
        <div className="plaincard" style={{ marginTop: 10 }}>
          <p className="lab" style={{ margin: "0 0 6px" }}>Lock the backup with a passphrase</p>
          <input className="inp" type="password" placeholder="Passphrase (8+ characters)" aria-label="Backup passphrase" value={pass} onChange={(e) => setPass(e.target.value)} />
          <input className="inp" type="password" placeholder="Repeat passphrase" aria-label="Repeat backup passphrase" value={pass2} onChange={(e) => setPass2(e.target.value)} />
          {err && <p className="errhint" style={{ marginTop: 0 }}>{err}</p>}
          <button className="cta" disabled={busy} onClick={doExport}>{busy ? "Encrypting…" : driver === "app-sandbox" ? "Save encrypted backup…" : "Download encrypted backup"}</button>
          <p className="rfoot">AES-256 encrypted on this device before it becomes a file. Even Cyra can't read it — only this passphrase opens it, and it isn't stored anywhere.</p>
        </div>
      )}
      {mode === "import" && <RestoreForm onImport={onImport} onDone={() => setMode(null)} compact />}
      {mode === "wipe" && (
        <div className="plaincard" style={{ marginTop: 10 }}>
          <p className="plain"><b>Delete everything on this device?</b> Every check-in, note, appointment and setting goes — immediately and for good. Cyra holds no copy, so there's nothing to recover unless you made a backup.</p>
          <button className="cta" style={{ background: "#A04545" }} onClick={onWipe}>Yes, delete it all</button>
          <button className="ghostbtn" onClick={() => setMode(null)}>Keep my data</button>
        </div>
      )}
    </>
  );
}
