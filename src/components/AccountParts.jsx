import { useState } from "react";
import { Card, Chip, Sheet } from "./ui/index.js";
import Icon from "./Icon.jsx";
import { noSave } from "./DataControls.jsx";
import { passphraseLength } from "../lib/backup.js";
import { isEmail, ACCOUNT_COPY as C } from "../lib/account.js";
import { ACCOUNT_LINES, accountLine } from "../lib/about.js";
import { relDay } from "../lib/engine.js";

/* The optional account (calm R9): You → Account and its two sheets. Shown only in a build that offers it (lib/cloudBackup.js
   ACCOUNTS_HERE: the cloudBackup flag and a server); otherwise YouScreen keeps R7's "No account needed" card unchanged.
   Guest is the default and stays first: the card says she's a guest and her log lives on this device; "Create an
   account" and "Sign in" are offered (with Pro, plan.can("cloudBackup")), or one Pro line and "See what Pro adds".
   Nothing here makes a request by itself: App.jsx does, only after she submits a sheet or taps a button, and only while
   she is signed in for the automatic back-ups. The passphrase lives only in the sheet's state while typed and is
   cleared on every way out; it is never saved anywhere (App.jsx keeps a key made from it, never it). */

/** An ISO time as a relative day ("today", "yesterday", "3 days ago", …) or a date. */
const whenOf = (iso, todayIso) => (iso && todayIso ? relDay(iso.slice(0, 10), todayIso) : null);

/* A quiet illustration: a soft blob and an arc in the stage accent (decorative; the arc draws in, off under reduced motion). */
const AcctArt = () => (
  <svg className="acctart" viewBox="0 0 120 60" aria-hidden="true" focusable="false">
    <path className="acctart-blob" d="M70 4c22-4 46 8 48 28s-18 28-40 26-42-6-44-24S48 8 70 4z" />
    <path className="acctart-arc" d="M30 44a26 26 0 0 1 52 0" />
    <circle className="acctart-dot" cx="82" cy="44" r="4" />
  </svg>
);

/** The choice between this device's log and the account's backup (a newer backup, or a sign-in on a device with a log). */
export function AccountChoice({ head, body, busy, onUse, onKeep, onCancel = null, id = "acct-choice" }) {
  return (
    <div className="acctchoice" role="group" aria-labelledby={`${id}-h`} id={id}>
      <p className="acctchoice-h" id={`${id}-h`}><Icon name="sparkle" size={16} />{head}</p>
      <p className="hint">{body}</p>
      <div className="acctchoice-opts">
        <button type="button" className="acctopt" disabled={busy} aria-describedby={`${id}-use`} onClick={onUse}>
          <b>{C.useBackup}</b><span id={`${id}-use`}>{C.useBackupHint}</span>
        </button>
        <button type="button" className="acctopt" disabled={busy} aria-describedby={`${id}-keep`} onClick={onKeep}>
          <b>{C.keepDevice}</b><span id={`${id}-keep`}>{C.keepDeviceHint}</span>
        </button>
      </div>
      {onCancel && <button type="button" className="linkbtn acctcancel" disabled={busy} onClick={onCancel}>{C.cancel}</button>}
    </div>
  );
}

/** You → Account. a = { can, acct, sync: {state, conflict, error}, todayIso, onCreate, onSignIn, onBackup, onSignOut,
    onDelete, onUseBackup, onKeepDevice, onPro } */
export function AccountCard({ a, person }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const acct = a.acct;
  const run = async (fn) => { setBusy(true); try { await fn(); } catch { /* the toast says what happened */ } finally { setBusy(false); } };
  if (!acct) {
    return (
      <Card id="you-account" tint="you" icon="user" eyebrow={C.eyebrow} title={C.guestTitle} level={2} className="youaccount acctcard" badge={a.can ? null : <Chip variant="pro" />}>
        {a.can && <AcctArt />}
        <p>{C.guestLine}{person && !person.anon && String(person.name || "").trim() ? " Your name stays with it." : ""}</p>
        <p className="hint">{C.guestMore}</p>
        {a.can ? (
          <div className="acctacts">
            <button type="button" className="ghostbtn acctcreate" aria-haspopup="dialog" onClick={a.onCreate}>{C.create}</button>
            <button type="button" className="linkbtn acctsignin" aria-haspopup="dialog" onClick={a.onSignIn}>{C.signIn}</button>
          </div>
        ) : (
          <div className="acctacts">
            <p className="hint acctpro">{C.proLine}</p>
            <button type="button" className="ghostbtn" aria-haspopup="dialog" onClick={a.onPro}>See what Pro adds</button>
          </div>
        )}
        <p className="rfoot">{ACCOUNT_LINES.moreAccount}</p>
      </Card>
    );
  }
  const s = a.sync || {};
  const last = whenOf(acct.at, a.todayIso);
  const status = s.state === "busy" ? C.backingUp : s.state === "offline" ? C.waiting : s.state === "gone" ? s.error : s.state === "failed" ? (s.error && s.error !== C.failed ? `${s.error} ${C.failed}` : C.failed)
    : last ? `Backed up ${last}.` : null;
  return (
    <Card id="you-account" tint="you" icon="shield" eyebrow={C.eyebrow} title={C.title} level={2} className="youaccount acctcard on">
      <AcctArt />
      <p className="acctwho"><b>{C.signedIn(acct.email)}</b></p>
      {status && !s.conflict && <p className={`acctstatus ${s.state || "idle"}`} role="status">{status}</p>}
      {s.conflict ? (
        <AccountChoice id="acct-conflict" head={C.conflictHead} busy={busy} body={`${C.conflictBody}${s.conflict.updatedAt ? ` It was last backed up ${whenOf(s.conflict.updatedAt, a.todayIso)}.` : ""}`}
          onUse={() => run(a.onUseBackup)} onKeep={() => run(a.onKeepDevice)} />
      ) : (
        <>
          <p className="hint">{C.auto}</p>
          <div className="acctacts">
            <button type="button" className="ghostbtn acctnow" disabled={busy || s.state === "busy" || !a.can} onClick={() => run(a.onBackup)}>{s.state === "busy" ? C.backingUp : C.backupNow}</button>
            <button type="button" className="linkbtn acctout" disabled={busy} onClick={() => run(a.onSignOut)}>{C.signOut}</button>
          </div>
        </>
      )}
      {!a.can && <p className="hint acctpro">{C.proLine}</p>}
      {!confirm ? (
        <button type="button" className="linkbtn danger acctdel" aria-expanded={false} aria-controls="acct-del" disabled={busy} onClick={() => setConfirm(true)}>{C.deleteAcct}</button>
      ) : (
        <div className="plaincard acctdelcard" id="acct-del" role="group" aria-labelledby="acct-del-h">
          <p className="plain"><b id="acct-del-h">{C.deleteQ}</b> {C.deleteBody}</p>
          <div className="acctacts">
            <button type="button" className="cta danger acctdelgo" disabled={busy} onClick={() => run(async () => { await a.onDelete(); setConfirm(false); })}>{C.deleteGo}</button>
            <button type="button" className="ghostbtn" disabled={busy} onClick={() => setConfirm(false)}>{C.cancel}</button>
          </div>
        </div>
      )}
      <p className="rfoot">{C.deviceKeeps}</p>
    </Card>
  );
}

/** "Create an account" / "Sign in". mode "create" | "signin"; onSubmit(email, pass) resolves { choice } when this
    device already has a log and the account has a backup (then the sheet shows AccountChoice), or nothing when done. */
export function AccountSheet({ mode, onClose, onSubmit, onUse, onKeep, choice = null }) {
  const create = mode === "create";
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const clear = () => { setPass(""); setPass2(""); };
  const go = async () => {
    setErr("");
    if (!isEmail(email)) return setErr(C.errEmail);
    if (passphraseLength(pass) < 8) { clear(); return setErr(C.errShort); }
    if (create && pass !== pass2) { clear(); return setErr(C.errMatch); }
    if (create && !agree) return setErr(C.errAgree);
    setBusy(true);
    try { await onSubmit(email, pass); }
    catch (e) { setErr(e.message || "Couldn't do that just now"); }
    finally { clear(); setBusy(false); }
  };
  const pick = async (fn) => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr(e.message || "Couldn't do that just now"); } finally { setBusy(false); } };
  return (
    <Sheet id="acct-sheet" title={create ? C.createTitle : C.signInTitle} onClose={onClose} closeLabel={create ? "Close create an account" : "Close sign in"} className="acctsheet">
      {choice ? (
        <>
          <AccountChoice id="acct-local" head={C.localHead} body={C.localBody} busy={busy} onUse={() => pick(onUse)} onKeep={() => pick(onKeep)} onCancel={onClose} />
          {err && <p className="errhint">{err}</p>}
        </>
      ) : (
        <form className="acctform" onSubmit={(e) => { e.preventDefault(); go(); }} noValidate>
          <p className="acctlead">{create ? C.createLead : C.signInLead}</p>
          {create && (
            <div className="acctholds">
              <p className="section-lab" id="acct-holds">{C.holdsLab}</p>
              <ul className="rlist" aria-labelledby="acct-holds">{C.holds.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}
          <p className="acctlost" id="acct-lost"><Icon name="lock" size={16} />{C.lost}</p>
          <label className="flab"><span>{C.emailLab}</span><input className="inp" type="email" inputMode="email" autoComplete="username" aria-label="Account email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="flab"><span>{C.passLab}</span><input className="inp" type="password" placeholder="Passphrase (8+ characters)" aria-label="Account passphrase" aria-describedby="acct-lost" {...noSave} value={pass} onChange={(e) => setPass(e.target.value)} /></label>
          {create && <label className="flab"><span>{C.pass2Lab}</span><input className="inp" type="password" placeholder="Repeat passphrase" aria-label="Repeat account passphrase" {...noSave} value={pass2} onChange={(e) => setPass2(e.target.value)} /></label>}
          {create && (
            <button type="button" role="checkbox" aria-checked={agree} className={`consentopt ${agree ? "on" : ""}`} onClick={() => setAgree((v) => !v)}>
              <span className="ckbox" aria-hidden="true">{agree ? "✓" : ""}</span>
              <span><b>{C.understand}</b></span>
            </button>
          )}
          {err && <p className="errhint" role="alert">{err}</p>}
          <button type="submit" className="cta" disabled={busy}>{busy ? (create ? C.createBusy : C.signInBusy) : (create ? C.createGo : C.signInGo)}</button>
          {create && <p className="rfoot">{C.deviceKeeps}</p>}
        </form>
      )}
    </Sheet>
  );
}

export { accountLine };
