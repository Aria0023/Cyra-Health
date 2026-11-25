import { useId, useState } from "react";
import { Card, Sheet } from "./ui/index.js";
import Icon from "./Icon.jsx";
import Lead from "./Lead.jsx";
import { ORG_COPY as C, cleanCode } from "../lib/org.js";

/* Organizations (2026-11-25, docs/plans/upgrade-enterprise.md Task 3; lib/org.js). Three parts, all driven by App.jsx:
   - OrgCodeField: "Invite code (optional)" and Join, with the privacy line. On registration's stage step and on
     You → Your profile. Nothing is sent until she presses Join, and then only the code (with her sign-in if signed in).
   - OrgCard: You → Your profile's "Your organization": the one she joined (logo, name, "Powered by Solia Health",
     Leave) or the code field.
   - OrgJoinSheet: opened by a ?org=<slug> link: "Join <name>?", what joining sends, the privacy line, Join / Not now.
   Every sentence comes from lib/org.js ORG_COPY. */

export function OrgLogo({ org, size = 40 }) {
  return org && org.logo ? <img className="orglogo" src={org.logo} alt="" width={size} height={size} /> : null;
}

/** onJoin(code) → Promise<string|null>: an error line, or null when she joined. */
export function OrgCodeField({ onJoin, id = "org-code" }) {
  const uid = useId();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const go = async () => {
    if (busy) return;
    const c = cleanCode(code);
    if (!c) { setErr(C.badCode); return; }
    setBusy(true); setErr(null);
    const e = await onJoin(c);
    setBusy(false);
    if (e) setErr(e); else setCode("");
  };
  return (
    <div className="orgcode" role="group" aria-labelledby={`${uid}-lab`}>
      <label className="section-lab" id={`${uid}-lab`} htmlFor={id}>{C.codeLab}</label>
      <p className="hint" id={`${uid}-hint`}>{C.codeHint}</p>
      <div className="orgcode-row">
        <input id={id} className="inp" type="text" value={code} maxLength={16} autoCapitalize="characters" autoComplete="off" spellCheck={false}
          aria-describedby={`${uid}-hint ${uid}-priv${err ? ` ${uid}-err` : ""}`} aria-invalid={err ? true : undefined}
          onChange={(e) => { setCode(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(); } }} />
        <button type="button" className="ghostbtn orgjoin" disabled={busy} onClick={go}>{busy ? C.joining : C.join}</button>
      </div>
      {err && <p className="ainote orgerr" id={`${uid}-err`} role="alert">{err}</p>}
      <p className="rfoot orgpriv" id={`${uid}-priv`}><Icon name="shield" size={14} />{C.privacy}</p>
    </div>
  );
}

/** org: the joined config (lib/org.js) or null. onJoin(code) as above; onLeave(). */
export function OrgCard({ org, onJoin, onLeave }) {
  return (
    <Card id="you-org" tint="you" icon="people" eyebrow={org ? C.poweredBy : null} title={C.cardTitle} level={2} className="youset yourorg">
      {org ? (
        <>
          <p className="orgwho"><OrgLogo org={org} size={40} /><b>{org.name}</b></p>
          <p>{C.cardIn(org.name)}</p>
          <p className="rfoot orgpriv"><Icon name="shield" size={14} />{C.privacy}</p>
          <button type="button" className="ghostbtn orgleave" onClick={onLeave}>{C.leave(org.name)}</button>
        </>
      ) : (
        <>
          <p className="hint">{C.cardNone}</p>
          <OrgCodeField id="you-org-code" onJoin={onJoin} />
        </>
      )}
    </Card>
  );
}

/** offer: the config a link named (not joined yet). onJoin() → Promise<string|null>; onClose(). */
export function OrgJoinSheet({ offer, onJoin, onClose }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const join = async () => { if (busy) return; setBusy(true); setErr(null); const e = await onJoin(); setBusy(false); if (e) setErr(e); };
  return (
    <Sheet id="org-join" title={C.joinTitle(offer.name)} onClose={onClose} closeLabel={C.notNow} className="orgjoinsheet">
      <p className="orgwho"><OrgLogo org={offer} size={48} /><b>{offer.name}</b></p>
      <p><Lead>{C.joinLead(offer.name)}</Lead></p>
      <p className="hint">{C.joinWhat}</p>
      <p className="rfoot orgpriv"><Icon name="shield" size={14} />{C.privacy}</p>
      {err && <p className="ainote orgerr" role="alert">{err}</p>}
      <div className="aisend-acts">
        <button type="button" className="cta" disabled={busy} onClick={join}>{busy ? C.joining : C.join}</button>
        <button type="button" className="ghostbtn" onClick={onClose}>{C.notNow}</button>
      </div>
      <p className="rfoot">{C.poweredBy}</p>
    </Sheet>
  );
}
