import { ACCOUNTS_HERE } from "../lib/cloudBackup.js";
import { useState } from "react";
import { passphraseLength } from "../lib/backup.js";
import { isNative } from "../lib/native.js";
import { relDay } from "../lib/engine.js";
import Details from "./Details.jsx";
import Icon from "./Icon.jsx";
import { FEATURES } from "../lib/features.js";
import { restoreFoot, restoreChanges, wipeConfirm, wipeMore, storeCopyLine, LEGACY_WEAR_LINE } from "../lib/disclosures.js";

/* Privacy & your data (L10; "Your data" before): where the record lives, the live "What can leave this device"
   dashboard (rendered by SettingsSheet as `children`, components/PrivacyFlows.jsx), encrypted backup out/in,
   delete everything; the App lock block follows this component in the same group (components/LockSettings.jsx).
   Encryption, decryption and deletion run on this device. The passphrase lives only
   in this form's state while it is typed, is cleared on every way out (done, cancel,
   error), and is never saved; the fields ask password managers not to keep it.
   Delete everything first asks Cyra's server to stop reminders and end wearable
   connections (App.jsx wipe; Terra's waiting readings are collected first, because a
   disconnect empties its server mailbox). If any of that can't be confirmed, the record
   on this device is not deleted: connections the server did end are removed here too,
   and this card names what ended, what failed and why, and offers Try again, or Delete
   on this device anyway with exactly what stays connected and where to remove it.
   offlineCopy (web, once the offline worker is active and its cache exists; spec A14.1): one
   line under the storage line says this browser also keeps Cyra's own app files, which hold
   none of her record, and the delete details say that copy goes too (cleanUpHere in App.jsx).
   L4: every sentence that names a flagged feature comes from lib/disclosures.js with this build's
   FEATURES (identical to the text before L4 when every flag is on). legacyWear (App.jsx): a build
   without wearables whose record still holds a real connection says, under the delete confirm, where
   to remove it, because this build doesn't ask Cyra's server to end it.
   L10: the Delete everything confirm (both of its panels, byte-identical) is WipeConfirm, exported so the lock
   screen's "Erase this device's record" and its forgotten-PIN restore show the same card; onHandoff (App.jsx
   holdLock) runs when the Restore file picker opens, so the hide it causes doesn't lock the app. */
export const noSave = { autoComplete: "off", "data-1p-ignore": "true", "data-lpignore": "true" };

export function RestoreForm({ onImport, onDone, compact = false, onPick = null }) {
  const [file, setFile] = useState(null);
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    if (!file) return setErr("Choose your backup file first");
    setBusy(true); setErr("");
    try { await onImport(file, pass); onDone?.(); } catch (e) { setErr(e.message || "Couldn't restore"); } finally { setPass(""); setBusy(false); }
  };
  return (
    <div className="plaincard" style={{ marginTop: compact ? 10 : 0 }}>
      <p className="lab" style={{ margin: "0 0 6px" }}>Restore from an encrypted backup</p>
      <label className="flab"><span>Backup file</span><input className="inp" type="file" accept=".json,.cyra,application/json" aria-label="Backup file" onClick={() => onPick?.()} onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
      <label className="flab"><span>Passphrase</span><input className="inp" type="password" placeholder="Backup passphrase" aria-label="Backup passphrase" {...noSave} value={pass} onChange={(e) => setPass(e.target.value)} /></label>
      {err && <p className="errhint" style={{ marginTop: 0 }}>{err}</p>}
      <button className="cta" disabled={busy} onClick={go}>{busy ? "Unlocking…" : "Restore"}</button>
      <p className="rfoot">{restoreFoot(FEATURES)}</p>
      <Details label="What a restore changes">
        <ul>{restoreChanges(FEATURES).map((t) => <li key={t}>{t}</li>)}</ul>
      </Details>
    </div>
  );
}

/* What Delete everything couldn't confirm, in plain words, worded for why it failed:
   network (no answer from Cyra's server), refused (the server answered, but it — or Oura or
   Terra — didn't confirm), nokey (this device holds nothing that could end it). */
const STEP = { reminders: "remove this browser's reminder details", terra: "disconnect Fitbit, Garmin or Whoop", oura: "disconnect Oura" };
const WHO = { terra: "Terra (the service Cyra uses for Fitbit, Garmin and Whoop)", oura: "Oura" };
const ENDED = { oura: "Oura is disconnected and removed from this device", terra: "Fitbit, Garmin or Whoop is disconnected and removed from this device (Cyra first tried to collect readings waiting on its server; any it couldn't collect were deleted there)", reminders: "Cyra's server erased this browser's reminder details, and reminders are off" };
const failLine = (kind, steps) => {
  const names = andList(steps.map((k) => STEP[k] || k));
  if (kind === "network") return `Cyra didn't get an answer from its server to ${names}, so it can't tell whether that happened. Try again when you're online.`;
  if (kind === "nokey") return `This device doesn't hold what Cyra needs to ${names} itself — ${steps.map((k) => (k === "terra" ? "remove Cyra (it may be listed as Terra) under connected apps in that account" : "remove Cyra in your Oura account's connected apps")).join("; ")}.`;
  const wear = steps.filter((k) => WHO[k]), rem = steps.includes("reminders");
  return [wear.length && `Cyra's server asked ${andList(wear.map((k) => WHO[k]))} to end the connection, but it didn't confirm. Try again, or remove Cyra in that account's connected apps.`,
    rem && "Cyra's server didn't confirm it removed this browser's reminder details. Try again."].filter(Boolean).join(" ");
};
const STAYS = {
  oura: "Oura stays connected to Cyra until you remove Cyra in your Oura account's connected apps",
  terra: "your Fitbit, Garmin or Whoop account stays connected until you remove Cyra (it may be listed as Terra) in that account's connected apps; until then Terra keeps sending that account's new readings to Cyra's server, where each day waits up to 7 days for a device that will never collect it and is then deleted",
  reminders: "Cyra's server keeps this browser's push address and its keys, the reminder days and time you chose, your time zone and the last day it sent a reminder, until the browser's push service reports the address gone (no reminder will be shown here)",
};
const andList = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

/* The Delete everything confirm: the question card, then, when the server steps couldn't all be confirmed, the
   blocked card with Try again / Delete on this device anyway. `intro` replaces the question (the lock screen's
   forgotten-PIN restore, which wipes first); the ids, classes and every other sentence are unchanged. */
export function WipeConfirm({ onWipe, keepsWeekNote = false, onCancel, panelId = "data-wipe-panel", intro = null, confirmLabel = "Yes, delete it all", busyLabel = "Deleting…", legacyWear = false, offlineCopy = false }) {
  const [wiping, setWiping] = useState(false);
  const [err, setErr] = useState("");
  const [blocked, setBlocked] = useState(null); // { failed: [{ name, kind }], ended: [names] } from a Delete everything that stopped
  const native = isNative();
  const runWipe = async (opts) => {
    setWiping(true); setErr("");
    try { await onWipe(opts); }
    catch (e) { if (Array.isArray(e?.failed) && e.failed.length) setBlocked({ failed: e.failed, ended: Array.isArray(e.ended) ? e.ended : [] }); else { setBlocked(null); setErr(e?.message || "Couldn't delete the record — try again"); } }
    finally { setWiping(false); }
  };
  if (blocked) {
    return (
      <div className="plaincard" id={panelId} style={{ marginTop: 10 }} role="alert">
        <p className="plain"><b>Your check-ins, notes and settings haven't been deleted.</b>{blocked.ended.length ? ` Already done: ${andList(blocked.ended.map((k) => ENDED[k]).filter(Boolean))}.` : ""} {["network", "refused", "nokey"].map((kind) => { const steps = blocked.failed.filter((f) => f.kind === kind).map((f) => f.name); return steps.length ? failLine(kind, steps) : ""; }).filter(Boolean).join(" ")} Or delete on this device anyway.</p>
        <p className="rfoot" style={{ marginTop: 0 }}>If you delete anyway, {andList(blocked.failed.map((f) => STAYS[f.name]).filter(Boolean))}.</p>
        {blocked.failed.some((f) => f.kind !== "nokey") && <button className="cta" disabled={wiping} onClick={() => runWipe({})}>{wiping ? "Trying…" : "Try again"}</button>}
        <button className="cta stopbtn" disabled={wiping} onClick={() => runWipe({ force: true })}>{wiping ? "Deleting…" : "Delete on this device anyway"}</button>
        <button className="ghostbtn" disabled={wiping} onClick={() => { setBlocked(null); onCancel?.(); }}>Keep my data</button>
      </div>
    );
  }
  return (
    <div className="plaincard" id={panelId} style={{ marginTop: 10 }}>
      <p className="plain">{intro ?? <><b>Delete everything on this device?</b>{wipeConfirm(FEATURES, native, ACCOUNTS_HERE)}</>}</p>
      {legacyWear && <p className="rfoot" style={{ marginTop: 0 }}>{LEGACY_WEAR_LINE}</p>}
      <Details label="More about deleting">
        <ul>
          {wipeMore(FEATURES, native).map((t) => <li key={t}>{t}</li>)}
          {offlineCopy && <li>Cyra's offline copy of its own app files is removed from this browser too.</li>}
          {keepsWeekNote && <li>So this device isn't counted twice, Cyra keeps only this week's date here (nothing else, nothing about your health) and deletes it the first time Cyra opens after this week ends.</li>}
        </ul>
      </Details>
      {err && <p className="errhint" role="alert" style={{ marginTop: 0 }}>{err}</p>}
      <button className="cta stopbtn" disabled={wiping} onClick={() => runWipe({})}>{wiping ? busyLabel : confirmLabel}</button>
      <button className="ghostbtn" disabled={wiping} onClick={() => onCancel?.()}>Keep my data</button>
    </div>
  );
}

export default function DataControls({ driver, onExport, onImport, onWipe, ping, keepsWeekNote = false, daysLogged = 0, lastBackupAt = null, todayIso, offlineCopy = false, legacyWear = false, onHandoff = null, hideLab = false, children = null }) {
  const [mode, setMode] = useState(null); // null | "export" | "import" | "wipe"
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const phone = driver === "app-sandbox" || isNative();
  const where = driver == null ? null
    : driver === "app-sandbox" ? "in this app's private storage on this device"
    : driver === "indexeddb" ? "in this browser's on-device database (not cookies, not localStorage); in a private window it's erased once you close every private window"
    : driver === "stale" ? "on this device, but Cyra couldn't confirm your latest changes were saved. A copy of your record, possibly without your most recent changes, is stored here, and changes that weren't saved may be lost when you close Cyra. Delete everything removes it"
    : driver === "unreadable" ? "in memory for this session only: Cyra couldn't open this browser's storage. An earlier record may still be stored here; clear this site's data in your browser to remove it"
    : "in memory for this session only — nothing is saved on this device";
  const clearPass = () => { setPass(""); setPass2(""); };
  const switchTo = (m) => { setMode(mode === m ? null : m); setErr(""); clearPass(); }; // a closed WipeConfirm unmounts, which drops its blocked state
  const doExport = async () => {
    setErr("");
    if (passphraseLength(pass) < 8) { clearPass(); return setErr("Use a passphrase of at least 8 characters"); }
    if (pass !== pass2) { clearPass(); return setErr("The two passphrases don't match"); }
    setBusy(true);
    try {
      const saved = await onExport(pass);
      if (saved === false) return;
      setMode(null);
      ping(phone ? "Backup handed to the app you chose — check it arrived. Keep the passphrase somewhere safe; Cyra can't recover it." : "Backup file created — check your downloads. Keep the passphrase somewhere safe; Cyra can't recover it.");
    } catch (e) { setErr(e.message || "Couldn't create the backup"); } finally { clearPass(); setBusy(false); }
  };
  return (
    <>
      <p className={hideLab ? "section-lab sr-only" : "section-lab"} id="set-privacy" style={hideLab ? undefined : { margin: "0 0 6px" }}><Icon name="shield" className="labico" />Privacy &amp; your data</p>
      <p className="datastat"><b>{daysLogged === 1 ? "1 day logged" : `${daysLogged} days logged`}</b><span aria-hidden="true">·</span><span>last backup {lastBackupAt && todayIso ? relDay(lastBackupAt, todayIso) : (daysLogged >= 7 ? "never — worth doing once" : "never")}</span></p>
      <p className="hint" style={{ margin: "0 0 8px" }}>{where ? `Your check-ins, notes and history are stored ${where}.` : "Checking where your check-ins, notes and history are stored…"} {storeCopyLine(ACCOUNTS_HERE)}</p>
      {offlineCopy && <p className="rfoot" style={{ margin: "0 0 8px" }}>This browser also keeps a copy of Cyra's own app files, so Cyra opens without a connection. That copy holds none of your check-ins, notes or settings.</p>}
      {children}
      <p className="section-lab" id="set-data" style={{ margin: "12px 0 6px" }}><Icon name="file" className="labico" />Backup, restore or delete</p>
      <div className="mcrow" role="group" aria-labelledby="set-data">
        <button className={`mc ${mode === "export" ? "on" : ""}`} aria-expanded={mode === "export"} aria-controls="data-export-panel" onClick={() => switchTo("export")}>Encrypted backup</button>
        <button className={`mc ${mode === "import" ? "on" : ""}`} aria-expanded={mode === "import"} aria-controls="data-import-panel" onClick={() => switchTo("import")}>Restore</button>
        <button className={`mc danger ${mode === "wipe" ? "on" : ""}`} aria-expanded={mode === "wipe"} aria-controls="data-wipe-panel" onClick={() => switchTo("wipe")}>Delete everything</button>
      </div>
      {mode === "export" && (
        <div className="plaincard" id="data-export-panel" style={{ marginTop: 10 }}>
          <p className="lab" style={{ margin: "0 0 6px" }}>Lock the backup with a passphrase</p>
          <label className="flab"><span>Passphrase</span><input className="inp" type="password" placeholder="Passphrase (8+ characters)" aria-label="Backup passphrase" {...noSave} value={pass} onChange={(e) => setPass(e.target.value)} /></label>
          <label className="flab"><span>Repeat it</span><input className="inp" type="password" placeholder="Repeat passphrase" aria-label="Repeat backup passphrase" {...noSave} value={pass2} onChange={(e) => setPass2(e.target.value)} /></label>
          {err && <p className="errhint" style={{ marginTop: 0 }}>{err}</p>}
          <button className="cta" disabled={busy} onClick={doExport}>{busy ? "Encrypting…" : phone ? "Save encrypted backup…" : "Download encrypted backup"}</button>
          <p className="rfoot">Encrypted on this device with your passphrase before it becomes a file. Cyra's servers never receive the file or the passphrase. Without it the backup can't be opened, and a lost passphrase can't be recovered.</p>
          <Details label="Backup details">
            <ul>
              <li>AES-256 encryption.</li>
              <li>Cyra never saves this passphrase, on this device or on its servers. Don't let your browser or password manager save it either.</li>
              {phone && <li>On a phone, the file sits in the app's temporary cache only while you share it. A copy left by an interrupted share is deleted the next time Cyra opens.</li>}
            </ul>
          </Details>
        </div>
      )}
      {mode === "import" && <div id="data-import-panel"><RestoreForm onImport={onImport} onDone={() => setMode(null)} compact onPick={onHandoff} /></div>}
      {mode === "wipe" && <WipeConfirm onWipe={onWipe} keepsWeekNote={keepsWeekNote} legacyWear={legacyWear} offlineCopy={offlineCopy} onCancel={() => setMode(null)} />}
    </>
  );
}
