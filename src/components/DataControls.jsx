import { useState } from "react";
import { passphraseLength } from "../lib/backup.js";
import { isNative } from "../lib/native.js";
import Details from "./Details.jsx";

/* Your data: where it lives, encrypted backup out/in, delete everything.
   Encryption, decryption and deletion run on this device. The passphrase lives only
   in this form's state while it is typed, is cleared on every way out (done, cancel,
   error), and is never saved; the fields ask password managers not to keep it.
   Delete everything first asks Cyra's server to stop reminders and end wearable
   connections (App.jsx wipe; Terra's waiting readings are collected first, because a
   disconnect empties its server mailbox). If any of that can't be confirmed, the record
   on this device is not deleted: connections the server did end are removed here too,
   and this card names what ended, what failed and why, and offers Try again, or Delete
   on this device anyway with exactly what stays connected and where to remove it. */
const noSave = { autoComplete: "off", "data-1p-ignore": "true", "data-lpignore": "true" };

export function RestoreForm({ onImport, onDone, compact = false }) {
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
      <input className="inp" type="file" accept=".json,.cyra,application/json" aria-label="Backup file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <input className="inp" type="password" placeholder="Backup passphrase" aria-label="Backup passphrase" {...noSave} value={pass} onChange={(e) => setPass(e.target.value)} />
      {err && <p className="errhint" style={{ marginTop: 0 }}>{err}</p>}
      <button className="cta" disabled={busy} onClick={go}>{busy ? "Unlocking…" : "Restore"}</button>
      <p className="rfoot">Unlocked on this device with your passphrase. It replaces your record here. Oura and Fitbit/Garmin/Whoop connections in the backup come back unconfirmed until Cyra checks them through its server; ones only on this device stay connected.</p>
      <Details label="What a restore changes">
        <ul>
          <li>Your settings are replaced too, except this device's choices about weekly counts, Cyra's AI and browser reminders.</li>
          <li>If the backup has Oura or Fitbit/Garmin/Whoop connected, that connection comes back on this device marked not confirmed, because it may have been ended since the backup was made. It counts as connected again once Cyra confirms it through its server: Oura on a Sync that works (checked straight away, and removed from this device if it no longer works), Fitbit/Garmin/Whoop when readings arrive. A Fitbit/Garmin/Whoop connection you ended after the backup can't send readings, so tap Disconnect to remove it. One this device is still waiting to see disconnected isn't restored. A connection this device has now for the same service is replaced, so remove Cyra in that account if you want it ended.</li>
          <li>A connection this device has that the backup doesn't (Oura or Fitbit/Garmin/Whoop) stays connected here and keeps fetching readings through Cyra's server as before. Tap Disconnect under Wearables on Home if you don't want it.</li>
        </ul>
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

export default function DataControls({ driver, onExport, onImport, onWipe, ping, keepsWeekNote = false }) {
  const [mode, setMode] = useState(null); // null | "export" | "import" | "wipe"
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [wiping, setWiping] = useState(false);
  const [blocked, setBlocked] = useState(null); // { failed: [{ name, kind }], ended: [names] } from a Delete everything that stopped
  const phone = driver === "app-sandbox" || isNative();
  const where = driver == null ? null
    : driver === "app-sandbox" ? "in this app's private storage on this device"
    : driver === "indexeddb" ? "in this browser's on-device database (not cookies, not localStorage); in a private window it's erased once you close every private window"
    : driver === "stale" ? "on this device, but Cyra couldn't confirm your latest changes were saved. A copy of your record, possibly without your most recent changes, is stored here, and changes that weren't saved may be lost when you close Cyra. Delete everything removes it"
    : driver === "unreadable" ? "in memory for this session only: Cyra couldn't open this browser's storage. An earlier record may still be stored here; clear this site's data in your browser to remove it"
    : "in memory for this session only — nothing is saved on this device";
  const clearPass = () => { setPass(""); setPass2(""); };
  const switchTo = (m) => { setMode(mode === m ? null : m); setErr(""); setBlocked(null); clearPass(); };
  const runWipe = async (opts) => {
    setWiping(true); setErr("");
    try { await onWipe(opts); }
    catch (e) { if (Array.isArray(e?.failed) && e.failed.length) setBlocked({ failed: e.failed, ended: Array.isArray(e.ended) ? e.ended : [] }); else { setBlocked(null); setErr(e?.message || "Couldn't delete the record — try again"); } }
    finally { setWiping(false); }
  };
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
      <p className="section-lab" style={{ margin: "14px 0 8px" }}>Your data</p>
      <p className="hint" style={{ margin: "0 0 8px" }}>{where ? `Your check-ins, notes and history are stored ${where}.` : "Checking where your check-ins, notes and history are stored…"} Cyra's servers don't keep a copy.</p>
      <Details label="What can leave this device">
        <p>Features you turn on (reminders in a browser, weekly counts, Cyra's AI, Oura, Fitbit/Garmin/Whoop) each say, before you turn them on, what they send and where.</p>
        <p>Restoring a backup brings back its wearable connections on this device.</p>
      </Details>
      <div className="mcrow">
        <button className={`mc ${mode === "export" ? "on" : ""}`} onClick={() => switchTo("export")}>Encrypted backup</button>
        <button className={`mc ${mode === "import" ? "on" : ""}`} onClick={() => switchTo("import")}>Restore</button>
        <button className={`mc ${mode === "wipe" ? "on" : ""}`} onClick={() => switchTo("wipe")}>Delete everything</button>
      </div>
      {mode === "export" && (
        <div className="plaincard" style={{ marginTop: 10 }}>
          <p className="lab" style={{ margin: "0 0 6px" }}>Lock the backup with a passphrase</p>
          <input className="inp" type="password" placeholder="Passphrase (8+ characters)" aria-label="Backup passphrase" {...noSave} value={pass} onChange={(e) => setPass(e.target.value)} />
          <input className="inp" type="password" placeholder="Repeat passphrase" aria-label="Repeat backup passphrase" {...noSave} value={pass2} onChange={(e) => setPass2(e.target.value)} />
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
      {mode === "import" && <RestoreForm onImport={onImport} onDone={() => setMode(null)} compact />}
      {mode === "wipe" && !blocked && (
        <div className="plaincard" style={{ marginTop: 10 }}>
          <p className="plain"><b>Delete everything on this device?</b> Every check-in, note, appointment and setting goes for good. This also turns off reminders and disconnects Oura and Fitbit/Garmin/Whoop. Cyra's servers keep no copy of your log, so it can't be recovered unless you saved a backup.</p>
          <Details label="More about deleting">
            <ul>
              <li>If Cyra's server, Oura or Fitbit/Garmin/Whoop can't confirm that, Cyra tells you what did and didn't end and keeps your record on this device until you choose.</li>
              <li>Anonymous counts you already shared stay counted. Questions already sent to Cyra's AI stay with Anthropic for a limited time under its own terms, and readings Terra already collected stay under Terra's policy.</li>
              {isNative() && <li>Apple Health or Health Connect access stays on until you turn it off in your phone's settings.</li>}
              {keepsWeekNote && <li>So this device isn't counted twice, Cyra keeps only this week's date here (nothing else, nothing about your health) and deletes it the first time Cyra opens after this week ends.</li>}
            </ul>
          </Details>
          {err && <p className="errhint" role="alert" style={{ marginTop: 0 }}>{err}</p>}
          <button className="cta" style={{ background: "#A04545" }} disabled={wiping} onClick={() => runWipe({})}>{wiping ? "Deleting…" : "Yes, delete it all"}</button>
          <button className="ghostbtn" disabled={wiping} onClick={() => setMode(null)}>Keep my data</button>
        </div>
      )}
      {mode === "wipe" && blocked && (
        <div className="plaincard" style={{ marginTop: 10 }} role="alert">
          <p className="plain"><b>Your check-ins, notes and settings haven't been deleted.</b>{blocked.ended.length ? ` Already done: ${andList(blocked.ended.map((k) => ENDED[k]).filter(Boolean))}.` : ""} {["network", "refused", "nokey"].map((kind) => { const steps = blocked.failed.filter((f) => f.kind === kind).map((f) => f.name); return steps.length ? failLine(kind, steps) : ""; }).filter(Boolean).join(" ")} Or delete on this device anyway.</p>
          <p className="rfoot" style={{ marginTop: 0 }}>If you delete anyway, {andList(blocked.failed.map((f) => STAYS[f.name]).filter(Boolean))}.</p>
          {blocked.failed.some((f) => f.kind !== "nokey") && <button className="cta" disabled={wiping} onClick={() => runWipe({})}>{wiping ? "Trying…" : "Try again"}</button>}
          <button className="cta" style={{ background: "#A04545" }} disabled={wiping} onClick={() => runWipe({ force: true })}>{wiping ? "Deleting…" : "Delete on this device anyway"}</button>
          <button className="ghostbtn" disabled={wiping} onClick={() => { setBlocked(null); setMode(null); }}>Keep my data</button>
        </div>
      )}
    </>
  );
}
