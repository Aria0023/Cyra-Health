import { useMemo, useState } from "react";
import { Card, Sheet, Switch } from "./ui/index.js";
import Details from "./Details.jsx";
import Icon from "./Icon.jsx";
import { FEEDBACK_COPY as C, HELP_COPY as H, FEEDBACK_MAX, FEEDBACK_KINDS, feedbackPayload, previewRows, canReply, cleanMessage, supportHref } from "../lib/feedback.js";

/* You → Help & about, and the feedback sheet (2026-11-19, docs/plans/launch-tools.md Task 3; lib/feedback.js has the payload,
   the request and every sentence).
   HelpCard: a few short answers, each true of this build (helpItems, computed in App.jsx from the build's facts), then,
   in a build with a server, "Send feedback" and "Report a problem" (one sheet, two kinds), and the support email link
   when VITE_SUPPORT_EMAIL is set. A build without a server shows the email link only; with neither, just the answers.
   FeedbackSheet: the warning above the box, the box (2000 characters), the "It's OK to reply to me" switch only while
   signed in with an email (off by default), and "What will be sent": a list built from the very object that is
   posted, so the preview and the request cannot differ. NOTHING is sent while she types, toggles or reads the
   preview: the one request is made by the Send button (onSend(payload)). */
export function HelpCard({ items = [], canSend = false, onOpen, supportEmail = "" }) {
  const mail = supportEmail ? <a className="helpmail" href={supportHref(supportEmail)}>{supportEmail}</a> : null;
  return (
    <Card id="you-help" tint="you" icon="book" eyebrow={H.eyebrow} title={H.title} level={2} className="youset youhelp" tabIndex={-1}>
      <p className="hint yousum">{H.lead}</p>
      <div className="helplist">
        {items.map((it) => (
          <Details key={it.id} label={it.q}>
            <div data-help={it.id}>{it.a.map((p, i) => <p key={i}>{p}</p>)}</div>
          </Details>
        ))}
      </div>
      {canSend && (
        <div className="helpsend">
          <p className="section-lab">{H.contact}</p>
          <p className="hint">{H.contactLead}</p>
          <div className="acctacts">
            <button type="button" className="ghostbtn helpfb" aria-haspopup="dialog" onClick={() => onOpen("feedback")}><Icon name="note" size={18} />{C.sendFeedback}</button>
            <button type="button" className="ghostbtn helpproblem" aria-haspopup="dialog" onClick={() => onOpen("problem")}>{C.reportProblem}</button>
          </div>
        </div>
      )}
      {mail && <p className="rfoot helpmailline">{canSend ? H.emailLead : H.emailOnlyLead} {mail}</p>}
    </Card>
  );
}

export function FeedbackSheet({ kind: kind0 = "feedback", build, platform, language, account = null, onSend, onClose }) {
  const [kind, setKind] = useState(FEEDBACK_KINDS.includes(kind0) ? kind0 : "feedback");
  const [text, setText] = useState("");
  const [reply, setReply] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const replyOk = canReply(account);
  const clean = cleanMessage(text);
  const tooLong = clean.length > FEEDBACK_MAX;
  const payload = useMemo(() => feedbackPayload({ kind, message: text, build, platform, language, reply: reply && replyOk, account }), [kind, text, build, platform, language, reply, replyOk, account]);
  const rows = previewRows(payload);
  const send = async () => {
    if (!payload || busy) return;
    setBusy(true); setErr("");
    const r = await onSend(payload);
    if (r && r.ok) return; // the caller closes the sheet and says so
    setBusy(false); setErr(C.err[r?.why] || C.err.server);
  };
  return (
    <Sheet id="feedback-sheet" title={C.title[kind]} onClose={onClose} className="feedbacksheet">
      <div className="mcrow seg" role="group" aria-label={C.kindLabel}>
        {FEEDBACK_KINDS.map((k) => <button key={k} type="button" className={`mc ${kind === k ? "on" : ""}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{C.kindName[k]}</button>)}
      </div>
      <p className="plain fbwarn" id="fb-warn"><Icon name="shield" size={16} /> {C.warn}</p>
      <label className="section-lab" htmlFor="fb-text">{C.boxLabel[kind]}</label>
      <textarea id="fb-text" className="inp fbtext" rows={5} maxLength={FEEDBACK_MAX} aria-describedby="fb-warn fb-count" aria-invalid={tooLong || undefined} value={text} onChange={(e) => setText(e.target.value)} />
      <p className={`rfoot fbcount${FEEDBACK_MAX - clean.length <= 100 ? " near" : ""}`} id="fb-count">{C.count(clean.length)}</p>
      {tooLong && <p className="errhint" role="alert">{C.tooLong}</p>}
      {replyOk && (
        <div className="modrow fbreply">
          <div className="modrow-main"><div className="modinfo"><b id="fb-reply-n">{C.replyName}</b></div>
            <Switch checked={reply} onChange={setReply} labelledBy="fb-reply-n" describedBy="fb-reply-d" /></div>
          <p className="modadds" id="fb-reply-d">{C.replyHint(account.email.trim())}</p>
        </div>
      )}
      <Details label={C.previewLabel}>
        {payload ? (
          <>
            <p>{C.previewLead}</p>
            <dl className="fbpreview" data-feedback-preview>
              {rows.map(([k, label, value]) => <div key={k} className="fbrow" data-key={k}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
            <p className="rfoot fbfoot">{payload.reply ? C.footShortReply : C.footShortAnon}</p>
            <Details><p className="rfoot">{payload.reply ? C.previewFootReply : C.previewFootAnon}</p><p className="rfoot">{C.kept}</p></Details>
          </>
        ) : <p>{tooLong ? C.tooLong : C.previewEmpty}</p>}
      </Details>
      {err && <p className="errhint" role="alert">{err}</p>}
      <div className="acctacts fbacts">
        {/* Not disabled while sending (a disabled button drops the focus out of the dialog): send() ignores a second press. */}
        <button type="button" className="cta fbsend" disabled={!payload} aria-busy={busy || undefined} onClick={send}>{busy ? C.sending : C.send}</button>
        <button type="button" className="ghostbtn" disabled={busy} onClick={onClose}>{C.cancel}</button>
      </div>
    </Sheet>
  );
}
