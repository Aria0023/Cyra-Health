import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { WipeConfirm, noSave } from "../components/DataControls.jsx";
import { LOCK_COPY as T, FREE_TRIES, fmtWait, waitWords } from "../lib/lock.js";

/* The lock screen (local-first L10, decision D4): a full-screen view in the base theme, rendered by App.jsx instead of
   everything else while the app is locked, so no header, tab, sheet, toast or record content exists behind it. It has
   an h1, a PIN field, a 3×4 keypad with 56px keys, the back-off the device persists (lib/lock.js), the passkey route
   where one is set, and "Forgot your PIN?": two ways out with no back door. "Erase this device's record" is the
   existing Delete everything confirm (WipeConfirm); "Restore from a backup" first opens the backup with the
   passphrase (onOpenBackup, held in App.jsx memory only), then the same confirm card wipes the device and writes the
   backup into the fresh store before reloading (App.jsx onRestore). A merge restore would have let a crafted backup
   unlock an existing record, so none is offered here. The passphrase is cleared on every way out. Nothing here makes
   a request, and the BUILD stamp is not rendered. */
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function LockScreen({ cfg = null, unreadable = false, passkeyOk = false, onPin, onPasskey, onRetryRead, onOpenBackup, onCancelBackup, onRestore, onWipe, keepsWeekNote = false, wipeAlso = "", legacyWear = false, offlineCopy = false }) {
  const [view, setView] = useState("pin"); // "pin" | "forgot" (unreadable replaces "pin" while the slot can't be read)
  const [pane, setPane] = useState(null); // forgot: null | "restore" | "erase"
  const [restoreStep, setRestoreStep] = useState(1);
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState({ kind: "idle" }); // idle | wrong | waiting | retry | bio | read
  const [waitUntil, setWaitUntil] = useState(cfg?.waitUntil && cfg.waitUntil > Date.now() ? cfg.waitUntil : 0);
  const [now, setNow] = useState(() => Date.now());
  const [file, setFile] = useState(null), [pass, setPass] = useState(""), [rErr, setRErr] = useState(""), [rBusy, setRBusy] = useState(false);
  const titleRef = useRef(null), inputRef = useRef(null), forgotBtn = useRef(null), restoreBtn = useRef(null), eraseBtn = useRef(null);
  const waiting = waitUntil > now;
  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => { if (cfg?.waitUntil && cfg.waitUntil > Date.now()) { setWaitUntil(cfg.waitUntil); setStatus({ kind: "waiting" }); } }, [cfg?.waitUntil]);
  // The wait counts down once a second; when it ends the keys come back and the status says so.
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => { const n = Date.now(); setNow(n); if (n >= waitUntil) setStatus((s) => (s.kind === "waiting" ? { kind: "retry" } : s)); }, 1000);
    return () => clearInterval(t);
  }, [waiting, waitUntil]);
  const busy = checking || waiting;
  const submit = async (value) => {
    const v = value ?? pin;
    if (busy || !cfg || v.length < 4) return;
    setChecking(true); setStatus({ kind: "checking" });
    const r = await onPin(v);
    setChecking(false); setPin("");
    if (r.ok) return;
    if (r.error) { setStatus({ kind: "read" }); return; }
    if (r.waitUntil && r.waitUntil > Date.now()) { setWaitUntil(r.waitUntil); setNow(Date.now()); setStatus({ kind: "waiting", words: waitWords(r.waitUntil - Date.now()) }); return; }
    setStatus({ kind: "wrong", left: Math.max(0, FREE_TRIES - (r.fails || 0)) });
  };
  const type = (d) => { if (busy) return; const next = (pin + d).slice(0, 6); setPin(next); if (cfg && next.length >= cfg.pin.len) submit(next); };
  const del = () => { if (!busy) setPin((p) => p.slice(0, -1)); };
  // Keys typed anywhere on the PIN view (not inside a field) work like the keypad.
  useEffect(() => {
    if (view !== "pin" || unreadable) return;
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) { e.preventDefault(); type(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); del(); }
      else if (e.key === "Enter") { e.preventDefault(); submit(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }); // every render: the handler closes over the current pin
  const usePasskey = async () => { if (busy) return; const r = await onPasskey(); if (!r.ok) setStatus({ kind: "bio" }); };
  const leaveForgot = () => { setPane(null); setRestoreStep(1); setFile(null); setPass(""); setRErr(""); onCancelBackup?.(); };
  const goForgot = () => { setView("forgot"); setPin(""); };
  const backToPin = () => { leaveForgot(); setView("pin"); };
  const openBackup = async () => {
    if (!file) return setRErr("Choose your backup file first");
    setRBusy(true); setRErr("");
    try { await onOpenBackup(file, pass); setRestoreStep(2); } catch (e) { setRErr(e?.message || "Couldn't open the backup"); } finally { setPass(""); setRBusy(false); }
  };
  const statusText = status.kind === "checking" ? T.checking
    : status.kind === "wrong" ? T.wrong(status.left)
    : status.kind === "retry" ? T.canRetry
    : status.kind === "bio" ? T.bioFailed
    : status.kind === "read" ? T.readError
    : "";
  const bad = ["wrong", "waiting", "bio", "read"].includes(status.kind) || waiting;
  const forgotLinks = (
    <>
      <div className="mcrow" style={{ marginTop: 12 }}>
        <button type="button" ref={restoreBtn} className={`mc ${pane === "restore" ? "on" : ""}`} aria-expanded={pane === "restore"} aria-controls="lock-restore-panel" onClick={() => { if (pane === "restore") leaveForgot(); else { leaveForgot(); setPane("restore"); } }}>{T.restoreBtn}</button>
        <button type="button" ref={eraseBtn} className={`mc danger ${pane === "erase" ? "on" : ""}`} aria-expanded={pane === "erase"} aria-controls="lock-wipe-panel" onClick={() => { if (pane === "erase") leaveForgot(); else { leaveForgot(); setPane("erase"); } }}>{T.eraseBtn}</button>
      </div>
      {pane === "restore" && restoreStep === 1 && (
        <div className="plaincard" id="lock-restore-panel" style={{ marginTop: 10 }}>
          <p className="lab" style={{ margin: "0 0 6px" }}>{T.restoreLab}</p>
          <label className="flab"><span>{T.fileLab}</span><input className="inp" type="file" accept=".json,.cyra,application/json" aria-label="Backup file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
          <label className="flab"><span>{T.passLab}</span><input className="inp" type="password" placeholder={T.passField} aria-label={T.passField} {...noSave} value={pass} onChange={(e) => setPass(e.target.value)} /></label>
          {rErr && <p className="errhint" style={{ marginTop: 0 }} role="alert">{rErr}</p>}
          <button className="cta" disabled={rBusy} onClick={openBackup}>{rBusy ? T.unlocking : T.openBackup}</button>
          <p className="rfoot">{T.restoreFoot}</p>
        </div>
      )}
      {pane === "restore" && restoreStep === 2 && (
        <WipeConfirm panelId="lock-restore-panel" onWipe={onRestore} keepsWeekNote={keepsWeekNote} legacyWear={legacyWear} offlineCopy={offlineCopy} onCancel={() => { leaveForgot(); restoreBtn.current?.focus(); }}
          confirmLabel={T.restoreConfirm} busyLabel={T.restoring}
          intro={<><b>{T.restoreIntroHead}</b>{T.restoreIntro}{wipeAlso ? " " + wipeAlso : ""}{T.restoreIntroTail}</>} />
      )}
      {pane === "erase" && <WipeConfirm panelId="lock-wipe-panel" onWipe={onWipe} keepsWeekNote={keepsWeekNote} legacyWear={legacyWear} offlineCopy={offlineCopy} onCancel={() => { leaveForgot(); eraseBtn.current?.focus(); }} />}
    </>
  );
  return (
    <main className="splash lockscreen" aria-labelledby="lock-title">
      <div className="splashmark">Cyra<span>.</span></div>
      <h1 id="lock-title" className="disp" tabIndex={-1} ref={titleRef}>{T.title}</h1>
      {view === "forgot" ? (
        <>
          <p className="plain" style={{ textAlign: "left" }}><b>{T.forgotHead}</b>{T.forgotBody}</p>
          {forgotLinks}
          <button type="button" className="linkbtn lockforgot" onClick={backToPin}>{T.back}</button>
        </>
      ) : unreadable ? (
        <>
          <p className="hint">{T.unreadable}</p>
          <button className="cta" onClick={onRetryRead}>{T.tryAgain}</button>
          {forgotLinks}
        </>
      ) : (
        <>
          <p className="hint">{T.enter}</p>
          <input className="inp pinfield" type="password" inputMode="numeric" pattern="[0-9]*" {...noSave} maxLength={6} aria-label={T.pinLabel} aria-describedby="lock-status" value={pin} ref={inputRef} disabled={busy}
            onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setPin(v); if (cfg && v.length >= cfg.pin.len && v.length > pin.length) submit(v); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }} />
          <p id="lock-status" className={`lockstatus${bad ? " bad" : ""}`} role="status">
            {waiting ? <><span aria-hidden="true">{T.waiting(fmtWait(waitUntil - now))}</span><span className="sr-only">{T.waitingSr(status.words || waitWords(waitUntil - now))}</span></> : statusText}
          </p>
          <div className="keypad" role="group" aria-label={T.keypad}>
            {KEYS.map((k) => <button key={k} type="button" className="key" disabled={busy} onClick={() => type(k)}>{k}</button>)}
            <span className="keyspacer" aria-hidden="true" />
            <button type="button" className="key" disabled={busy} onClick={() => type("0")}>0</button>
            <button type="button" className="key del" disabled={busy} aria-label={T.del} onClick={del}><Icon name="backspace" size={22} /></button>
          </div>
          {passkeyOk && cfg?.cred && <button type="button" className="ghostbtn" disabled={busy} onClick={usePasskey}>{T.useBio}</button>}
          <button type="button" ref={forgotBtn} className="linkbtn lockforgot" onClick={goForgot}>{T.forgot}</button>
        </>
      )}
    </main>
  );
}
