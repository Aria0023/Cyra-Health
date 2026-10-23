import { useEffect, useRef, useState } from "react";
import Details from "./Details.jsx";
import Icon from "./Icon.jsx";
import { noSave } from "./DataControls.jsx";
import { LOCK_COPY as T, AFTER_CHOICES, validPin, weakPin, fmtWait } from "../lib/lock.js";

/* Settings → Privacy & your data → App lock (local-first L10, decision D4). Shows the lock's state, sets / changes /
   turns off the PIN, the lock-after choice and, on the web where a platform authenticator exists, the passkey switch.
   All of it goes through App.jsx's lock API (`lock` prop): every write lands in the device-only slot
   (lib/storage.js), never in the record or a backup. The PIN fields ask password managers not to keep them; a typed
   PIN lives only in this form's state and is cleared on every way out. Wrong current PINs count toward the same
   back-off as the lock screen (lock.verify). The honest note under the row says what the lock is not: encryption.
   No button here is named Done, Restore, Encrypted backup, Delete everything, Keep my data or Connect, and no row
   text contains the strings the suites use to find other Settings rows (privacyFlows.test.mjs). */
const PIN_FIELD = { className: "inp", type: "password", inputMode: "numeric", pattern: "[0-9]*", maxLength: 6, ...noSave };

export default function LockSettings({ lock, potsOn = false }) {
  const { cfg, passkeyOk = false, native = false, lastBackupAt = null } = lock;
  const on = !!cfg && !cfg.unreadable;
  const [panel, setPanel] = useState(null); // null | "set" | "change" | "off" | "passkey"
  const [step, setStep] = useState(1); // passkey panel: 1 = current PIN, 2 = confirm with the device
  const [cur, setCur] = useState(""), [p1, setP1] = useState(""), [p2, setP2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const opener = useRef(null), first = useRef(null);
  const setBtn = useRef(null), changeBtn = useRef(null), offBtn = useRef(null), bioBtn = useRef(null);
  // A back-off from the lock screen (or another tab) applies here too.
  useEffect(() => { if (cfg?.waitUntil) setWaitUntil(cfg.waitUntil); }, [cfg?.waitUntil]);
  useEffect(() => {
    if (!(waitUntil > now)) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waitUntil, now > waitUntil]); // eslint-disable-line
  // Opening a panel focuses its first field; Cancel or success hands focus back to the button that opened it.
  useEffect(() => { if (panel) first.current?.focus(); }, [panel, step]);
  const clear = () => { setCur(""); setP1(""); setP2(""); setErr(""); };
  const open = (p, ref) => { opener.current = ref.current; clear(); setStep(1); setPanel(panel === p ? null : p); };
  const close = () => { clear(); setPanel(null); setStep(1); opener.current?.focus(); };
  const waiting = waitUntil > now;
  const waitErr = () => T.errWait(fmtWait(waitUntil - Date.now()));
  // A current-PIN check, through the same code path and back-off as the lock screen.
  const checkCurrent = async () => {
    if (waiting) { setErr(waitErr()); return false; }
    const r = await lock.verify(cur);
    if (r.ok) return true;
    if (r.error) { setErr(T.readError); return false; }
    if (r.waitUntil && r.waitUntil > Date.now()) { setWaitUntil(r.waitUntil); setNow(Date.now()); setErr(T.errWait(fmtWait(r.waitUntil - Date.now()))); return false; }
    setErr(T.errCurrent); setCur(""); return false;
  };
  const newPinOk = () => {
    if (!validPin(p1)) { setErr(T.errDigits); return false; }
    if (p1 !== p2) { setErr(T.errMatch); setP2(""); return false; }
    if (weakPin(p1)) { setErr(T.errWeak); setP1(""); setP2(""); return false; }
    return true;
  };
  const run = async (fn) => { setBusy(true); setErr(""); try { await fn(); } finally { setBusy(false); } };
  const doSet = () => run(async () => {
    if (!newPinOk()) return;
    try { await lock.setPin(p1); close(); } catch { setErr(T.errSave); }
  });
  const doChange = () => run(async () => {
    if (!(await checkCurrent())) return;
    if (!newPinOk()) return;
    try { await lock.changePin(p1); close(); } catch { setErr(T.errSave); }
  });
  const doOff = () => run(async () => {
    if (!(await checkCurrent())) return;
    try { await lock.turnOff(); close(); } catch { setErr(T.errSave); }
  });
  const doBioStep1 = () => run(async () => { if (await checkCurrent()) { setCur(""); setStep(2); } });
  // The passkey is created inside this tap (no await before lock.passkeyOn, which asks the authenticator first).
  const doBioStep2 = () => {
    setBusy(true); setErr("");
    lock.passkeyOn().then(() => close(), (e) => setErr(e?.code === "save" ? T.errSave : T.errBio)).finally(() => setBusy(false));
  };
  const liveErr = err && waiting && err.startsWith("Too many tries") ? waitErr() : err;
  const field = (label, aria, value, set, ref) => (
    <label className="flab"><span>{label}</span><input {...PIN_FIELD} aria-label={aria} value={value} ref={ref} onChange={(e) => set(e.target.value.replace(/\D/g, ""))} /></label>
  );
  const errLine = liveErr && <p className="errhint" style={{ marginTop: 0 }} role="alert">{liveErr}</p>;
  const sub = on ? T.onSub(!!cfg.cred && passkeyOk, cfg.after) : T.offSub;
  return (
    <>
      <p className="section-lab" id="set-lock" style={{ margin: "12px 0 6px" }}><Icon name="lock" className="labico" />{T.label}</p>
      <div className="medrow" role="group" aria-labelledby="set-lock" style={{ borderTop: "none", padding: "4px 0 8px" }}>
        <div className="medinfo"><b>{on ? T.onTitle : T.offTitle}</b><span>{sub}</span></div>
        {on
          ? <button type="button" className="takebtn" onClick={() => lock.lockNow()}>{T.lockNow}</button>
          : <button type="button" ref={setBtn} className="takebtn" aria-expanded={panel === "set"} aria-controls="lock-panel" onClick={() => open("set", setBtn)}>{T.setPin}</button>}
      </div>
      <p className="rfoot">{native ? T.notePhone : T.noteWeb}</p>
      <Details label="Details" describedBy="set-lock">
        <ul>
          {T.facts.map((t) => <li key={t}>{t}</li>)}
          {potsOn && <li>{T.factPots}</li>}
          {native && <li>{T.factPhone}</li>}
        </ul>
      </Details>
      {on && (
        <>
          <p className="section-lab" id="set-lock-after" style={{ margin: "12px 0 6px" }}>{T.afterLabel}</p>
          <div className="mcrow seg" role="group" aria-labelledby="set-lock-after">
            {AFTER_CHOICES.map((sec) => (
              <button key={sec} type="button" className={`mc ${cfg.after === sec ? "on" : ""}`} aria-pressed={cfg.after === sec} onClick={() => lock.setAfter(sec).catch(() => setErr(T.errSave))}>{T.afterNames[sec]}</button>
            ))}
          </div>
          {passkeyOk && (
            <>
              <div className="medrow" role="group" aria-labelledby="set-lock-bio">
                <div className="medinfo"><b id="set-lock-bio">{T.bioTitle}</b><span>{T.bioSub}</span></div>
                <button type="button" ref={bioBtn} className={`takebtn ${cfg.cred ? "on" : ""}`} aria-pressed={!!cfg.cred} aria-expanded={cfg.cred ? undefined : panel === "passkey"} aria-controls={cfg.cred ? undefined : "lock-panel"}
                  onClick={() => (cfg.cred ? lock.passkeyOff().catch(() => setErr(T.errSave)) : open("passkey", bioBtn))}>{cfg.cred ? "✓ On" : "Turn on"}</button>
              </div>
              <Details label="Details" describedBy="set-lock-bio"><ul>{T.bioFacts.map((t) => <li key={t}>{t}</li>)}</ul></Details>
            </>
          )}
          <div className="mcrow" style={{ marginTop: 10 }}>
            <button type="button" ref={changeBtn} className={`mc ${panel === "change" ? "on" : ""}`} aria-expanded={panel === "change"} aria-controls="lock-panel" onClick={() => open("change", changeBtn)}>{T.changePin}</button>
            <button type="button" ref={offBtn} className={`mc ${panel === "off" ? "on" : ""}`} aria-expanded={panel === "off"} aria-controls="lock-panel" onClick={() => open("off", offBtn)}>{T.turnOff}</button>
          </div>
        </>
      )}
      {panel === "set" && (
        <div className="plaincard" id="lock-panel" style={{ marginTop: 10 }}>
          <p className="lab" style={{ margin: "0 0 6px" }}>{T.choose}</p>
          {field(T.newPin, T.newPinLabel, p1, setP1, first)}
          {field(T.repeat, T.repeatLabel, p2, setP2)}
          <p className="hint">{T.forgetHint}{lastBackupAt ? "" : T.noBackupYet}</p>
          {errLine}
          <button className="cta" disabled={busy} onClick={doSet}>{busy ? T.saving : T.turnOnLock}</button>
          <button className="ghostbtn" disabled={busy} onClick={close}>{T.cancel}</button>
        </div>
      )}
      {panel === "change" && (
        <div className="plaincard" id="lock-panel" style={{ marginTop: 10 }}>
          {field(T.current, T.current, cur, setCur, first)}
          {field(T.newPin, T.newPinLabel, p1, setP1)}
          {field(T.repeat, T.repeatLabel, p2, setP2)}
          {errLine}
          <button className="cta" disabled={busy} onClick={doChange}>{busy ? T.saving : T.saveNew}</button>
          <button className="ghostbtn" disabled={busy} onClick={close}>{T.cancel}</button>
        </div>
      )}
      {panel === "off" && (
        <div className="plaincard" id="lock-panel" style={{ marginTop: 10 }}>
          <p className="lab" style={{ margin: "0 0 6px" }}>{T.offAsk}</p>
          <p className="hint">{T.offHint}</p>
          {field(T.current, T.current, cur, setCur, first)}
          {errLine}
          <button className="cta" disabled={busy} onClick={doOff}>{busy ? T.saving : T.turnOffLock}</button>
          <button className="ghostbtn" disabled={busy} onClick={close}>{T.keepOn}</button>
        </div>
      )}
      {panel === "passkey" && (
        <div className="plaincard" id="lock-panel" style={{ marginTop: 10 }}>
          {step === 1 ? (
            <>
              <p className="lab" style={{ margin: "0 0 6px" }}>{T.bioSetup}</p>
              {field(T.current, T.current, cur, setCur, first)}
              {errLine}
              <button className="cta" disabled={busy} onClick={doBioStep1}>{T.bioContinue}</button>
            </>
          ) : (
            <>
              <p className="hint">{T.bioConfirm}</p>
              {errLine}
              <button className="cta" disabled={busy} ref={first} onClick={doBioStep2}>{T.bioGo}</button>
            </>
          )}
          <button className="ghostbtn" disabled={busy} onClick={close}>{T.cancel}</button>
        </div>
      )}
    </>
  );
}
