import { useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import Details from "./Details.jsx";
import { Sheet } from "./ui/index.js";
import { PROVIDERS, SIGNIN_COPY as C, canSkip, skipLabel, cleanCode, isEmailAddress, whoLine } from "../lib/signin.js";
import { GUEST_COPY as G } from "../lib/guest.js";

/* The sign-in choices (Task 1): Apple, Google, Facebook, then email, in that order (Apple first: App Store). Used as
   registration's first step ("Create your account", RegisterScreen) and as the one-time screen an existing user sees
   before the app opens (SignInGate below). What it offers comes from lib/signin.js signinMode: no skip while sign-in is
   required and the server has a sign-in; while sign-in is off "Continue for now", when optional "Continue without an
   account", each with the reason in plain words.
   The guest window (2026-11-16, lib/guest.js): where sign-in is required and the build has a guest window, registration
   passes `guest` ({ hours, story, onTry }) and the step also offers "Try it first", a real skip, with the whole story in
   one line. The gate and the in-app "Create your account" sheet (GuestCreateSheet) never pass it: no skip there.
   Nothing here sends anything by itself: onProvider / onEmailStart / onEmailVerify (App.jsx) make the requests, each
   after her tap. The email and the code live only in this component's state until she sends them. */
export default function SignInStep({ mode, providers = {}, busy = null, signedIn = null, onProvider, onEmailStart, onEmailVerify, onSkip, onRetry, guest = null }) {
  const uid = useId();
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(null); // { email, dev } once a code went out
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [working, setWorking] = useState(false);
  const emailRef = useRef(null), codeRef = useRef(null);
  useEffect(() => { if (emailOpen && !sent) emailRef.current?.focus(); }, [emailOpen, sent]);
  useEffect(() => { if (sent) codeRef.current?.focus(); }, [sent]);

  const live = mode === "required" || mode === "optional";
  const why = mode === "none" ? C.whyNone : mode === "unset" ? C.whyUnset : mode === "optional" ? C.whyOptional : null;

  const send = async () => {
    setErr("");
    if (!isEmailAddress(email)) { setErr(C.errEmail); emailRef.current?.focus(); return; }
    setWorking(true);
    try { const r = await onEmailStart(email.trim()); setSent({ email: email.trim().toLowerCase(), dev: r?.dev === true }); setCode(""); }
    catch (e) { setErr(e?.status === 429 ? C.errBusy : e?.network ? C.errNetwork : C.errSend); }
    finally { setWorking(false); }
  };
  const verify = async () => {
    setErr("");
    const c = cleanCode(code);
    if (c.length !== 6) { setErr(C.errCode); codeRef.current?.focus(); return; }
    setWorking(true);
    try { await onEmailVerify(sent.email, c); }
    catch (e) {
      setErr(e?.why === "wrong" ? C.errWrong : e?.why === "locked" ? C.errLocked : e?.why === "expired" ? C.errExpired : e?.status === 429 ? C.errBusy : e?.network ? C.errNetwork : C.errExpired);
      if (e?.why === "locked" || e?.why === "expired") setCode("");
    } finally { setWorking(false); }
  };

  if (signedIn) {
    return <p className="signin-done" role="status"><Icon name="check" size={18} />{C.signedIn(whoLine(signedIn))}</p>;
  }
  return (
    <div className="signin">
      {mode === "checking" && <p className="hint" role="status">{C.checking}</p>}
      {mode === "offline" && (
        <div className="plaincard signin-offline" role="alert">
          <p className="plain">{C.offline}</p>
          <button type="button" className="ghostbtn" onClick={onRetry}>{C.retry}</button>
        </div>
      )}
      {live && (
        <>
          <div className="signin-list" role="group" aria-label={C.title}>
            {PROVIDERS.map(([id, label]) => (
              <button key={id} type="button" className={`signinbtn ${id}`} disabled={!!busy || working || providers[id] !== true} aria-describedby={providers[id] !== true ? `${uid}-${id}-off` : undefined} onClick={() => onProvider(id, label)}>
                <Icon name={id} size={20} /><span>{busy === id ? C.connecting : C.continueWith(label)}</span>
              </button>
            ))}
            <button type="button" className="signinbtn email" aria-expanded={emailOpen} aria-controls={`${uid}-email`} disabled={!!busy || providers.email !== true} aria-describedby={providers.email !== true ? `${uid}-email-off` : undefined} onClick={() => { setEmailOpen((v) => !v); setErr(""); }}>
              <Icon name="mail" size={20} /><span>{C.email}</span>
            </button>
          </div>
          {PROVIDERS.filter(([id]) => providers[id] !== true).map(([id, label]) => <p key={id} className="rfoot signin-off" id={`${uid}-${id}-off`}>{C.notHere(label)}</p>)}
          {providers.email !== true && <p className="rfoot signin-off" id={`${uid}-email-off`}>{C.notHere("Email")}</p>}
          <div id={`${uid}-email`} hidden={!emailOpen}>
            {emailOpen && (!sent ? (
              <form className="signin-email" noValidate onSubmit={(e) => { e.preventDefault(); send(); }}>
                <label className="flab"><span>{C.emailLab}</span>
                  <input ref={emailRef} className="inp" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!err || undefined} aria-describedby={err ? `${uid}-err` : undefined} />
                </label>
                <button type="submit" className="cta" disabled={working}>{working ? C.sending : C.sendCode}</button>
              </form>
            ) : (
              <form className="signin-email" noValidate onSubmit={(e) => { e.preventDefault(); verify(); }}>
                <p className="hint" id={`${uid}-sent`}>{C.codeSent(sent.email)}</p>
                {sent.dev && <p className="rfoot signin-dev">{C.devCode}</p>}
                <label className="flab"><span>{C.codeLab}</span>
                  <input ref={codeRef} className="inp signin-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(cleanCode(e.target.value))} aria-describedby={`${uid}-sent${err ? ` ${uid}-err` : ""}`} aria-invalid={!!err || undefined} />
                </label>
                <button type="submit" className="cta" disabled={working}>{working ? C.verifying : C.verify}</button>
                <div className="signin-again">
                  <button type="button" className="linkbtn" disabled={working} onClick={send}>{C.resend}</button>
                  <button type="button" className="linkbtn" disabled={working} onClick={() => { setSent(null); setCode(""); setErr(""); }}>{C.otherEmail}</button>
                </div>
              </form>
            ))}
          </div>
          {err && <p className="errhint" role="alert" id={`${uid}-err`}>{err}</p>}
        </>
      )}
      {canSkip(mode) && (
        <div className="signin-skip">
          <p className="hint">{why}</p>
          <button type="button" className="ghostbtn" onClick={onSkip}>{skipLabel(mode)}</button>
        </div>
      )}
      {mode === "required" && guest && (
        <div className="signin-skip signin-try">
          <p className="hint">{G.tryWhy(guest.hours)}</p>
          <p className="hint signin-story"><b>{guest.story}</b></p>
          <button type="button" className="ghostbtn" disabled={!!busy || working} onClick={() => { guest.onTry?.(); onSkip?.(); }}>{G.tryFirst}</button>
        </div>
      )}
      {mode !== "none" && <p className="hint signin-sharedshort">{C.sharedShort}</p>}
      {mode !== "none" && (
        <Details label={C.sharedLab}>
          <ul>{C.shared.map((s) => <li key={s}>{s}</li>)}</ul>
        </Details>
      )}
    </div>
  );
}

/** The one-time screen for a record already on this device when sign-in becomes required, and the screen a guest sees
    once her guest window is over (title / sub from lib/guest.js). `data` (the guest screen) is the encrypted backup,
    restore and Delete everything, usable without signing in: nobody is locked out of her own data. */
export function SignInGate({ children, title = C.gateTitle, sub = C.gateSub, data = null }) {
  const headRef = useRef(null);
  useEffect(() => { headRef.current?.focus({ preventScroll: true }); }, []);
  return (
    <main className="obwrap signingate">
      <span className="mark">Solia<span className="sub">Health</span></span>
      <h1 className="disp" tabIndex={-1} ref={headRef} style={{ marginTop: 18 }}>{title}</h1>
      <p className="hint">{sub}</p>
      {children}
      {data && (
        <section className="gatedata" aria-labelledby="gatedata-h">
          <h2 className="gatedata-h" id="gatedata-h">{G.gateData}</h2>
          <p className="hint">{G.gateDataWhy}</p>
          {data}
        </section>
      )}
    </main>
  );
}

/** "Create your account" for a guest inside her window (Home's guest line, You → Plan & account): the same choices, no skip.
    A finished sign-in closes it (App.jsx adoptSession) and she is exactly where she was. */
export function GuestCreateSheet({ onClose, step, sub = null }) {
  // `sub` (2026-11-26, meal-photos-findable): the line for someone who isn't a guest, e.g. signed out where sign-in is optional.
  return (
    <Sheet id="guest-create" title={G.sheetTitle} onClose={onClose}>
      <p className="hint">{sub || G.sheetSub}</p>
      <SignInStep {...step} />
    </Sheet>
  );
}
