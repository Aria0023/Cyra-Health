import { useEffect, useRef, useState } from "react";
import { Card, Chip, Sheet } from "../ui/index.js";
import Icon from "../Icon.jsx";
import Advice from "../Advice.jsx";
import { t } from "../../lib/i18n.js";

/* Cyra's AI write-up and chat (calm R8). Three parts, all driven by App.jsx:
   - AiSendSheet: "What Cyra will send". Opens before EVERY send. It shows the request body in plain words and then
     exactly as sent (the pretty JSON of the very object App.jsx posts), with Send and Cancel. Nothing goes until Send.
   - WriteUpCard: Patterns' "Cyra's write-up" (Pro + her switch). Checks once that the server has Cyra's AI set up.
   - ChatCard: Mind → Journey's "Chat about your log" (Pro + her switch). The conversation stays on this device.
   Every sentence comes from lib/aiFeatures.js AI_COPY, through the English catalogue (keys "ai.<name>", calm R10). */

/** status line for the server check: null when ready. */
const statusLine = (status) => (status === "checking" ? t("ai.checking") : status === "unset" ? t("ai.notSetUp") : status === "offline" ? t("ai.offline") : status === "error" ? t("ai.noAnswer") : null);

export function AiSendSheet({ kind, body, lines = [], busy = false, onSend, onClose }) {
  const exact = JSON.stringify(body, null, 2);
  return (
    <Sheet id="ai-send-sheet" title={t("ai.sheetTitle")} onClose={onClose} closeLabel={t("aiParts.closeWhatCyraWillSend")} className="aisend">
      <p className="aisend-lead"><Icon name="shield" size={16} />{t("ai.sheetLead")}</p>
      <section className="aisend-sec" aria-labelledby="aisend-plain-h">
        <h3 className="section-lab" id="aisend-plain-h">{t("ai.sheetPlain")}</h3>
        <dl className="aisend-plain">
          {kind === "chat" && <div className="aisend-row aisend-q"><dt>{t("ai.sheetQuestion")}</dt><dd>{body.question}</dd></div>}
          {kind === "chat" && body.history?.length > 0 && <div className="aisend-row"><dt>{t("ai.sheetHistory")}</dt><dd>{body.history.length === 1 ? t("aiParts.1Message") : t("aiParts.messages", { length: body.history.length })}{t("aiParts.shownInFullBelow")}</dd></div>}
          {lines.map(([l, tv]) => <div className="aisend-row" key={l}><dt>{l}</dt><dd>{tv}</dd></div>)}
        </dl>
      </section>
      <section className="aisend-sec" aria-labelledby="aisend-exact-h">
        <h3 className="section-lab" id="aisend-exact-h">{t("ai.sheetExact")}</h3>
        <pre className="aisend-json" tabIndex={0} aria-labelledby="aisend-exact-h">{exact}</pre>
      </section>
      <div className="aisend-acts">
        <button type="button" className="cta aisend-go" disabled={busy} onClick={onSend}>{busy ? t("aiParts.sending") : t("aiParts.send")}</button>
        <button type="button" className="ghostbtn aisend-no" onClick={onClose}>{t("aiParts.cancel")}</button>
      </div>
    </Sheet>
  );
}

/* A soft illustrated corner for the AI cards (decorative, tokens only). */
const AiArt = () => (
  <svg className="aiart" viewBox="0 0 120 80" aria-hidden="true" focusable="false">
    <path className="aiart-blob" d="M70 6c22-4 44 8 46 30s-14 38-36 40-46-6-50-26S48 10 70 6z" />
    <path className="aiart-spark" d="M84 22l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
  </svg>
);

export function WriteUpCard({ status, last = null, busy = false, note = null, onPrepare, onCheck }) {
  useEffect(() => { onCheck?.(); }, []); // eslint-disable-line
  const line = statusLine(status);
  const paras = last ? String(last.writeup).split(/\n\s*\n/) : [];
  return (
    <Card id="ai-writeup" tint="patterns" icon="sparkle" eyebrow={t("aiParts.yourLast8Weeks")} badge={<Chip variant="pro" />} title={t("ai.wuTitle")} level={2} className="aicard aiwriteup">
      <AiArt />
      {last ? (
        <div className="aiout" tabIndex={-1}>
          {paras.map((tv, i) => <p key={i} className="aitext">{tv}</p>)}
          {last.ask && <Advice urgency="visit">{t("aiParts.worthAsking", { ask: last.ask })}</Advice>}
          <p className="aichips"><span className="aisent"><Icon name="check" size={12} />{t("ai.sentSummary")}</span></p>
          <p className="rfoot">{t("ai.byAI")} {t("ai.notAdvice")}</p>
        </div>
      ) : <p className="hint">{t("ai.wuLead")}</p>}
      {line && <p className="ainote" role="status">{line}</p>}
      {note && <p className="ainote" role="status">{note}</p>}
      <button type="button" className={last ? "ghostbtn aigo" : "cta aigo"} aria-haspopup="dialog" disabled={busy || status !== "ready"} onClick={onPrepare}>
        {busy ? t("aiParts.writing") : last ? t("ai.wuAgain") : t("ai.wuGo")}
      </button>
    </Card>
  );
}

export function ChatCard({ status, chat = [], busy = false, note = null, online = true, onPrepare, onClear, onCheck }) {
  const [q, setQ] = useState("");
  const listRef = useRef(null);
  useEffect(() => { onCheck?.(); }, []); // eslint-disable-line
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [chat.length]);
  const line = !online ? t("ai.offline") : statusLine(status);
  const can = online && status === "ready" && !busy && q.trim().length >= 2;
  const send = () => { if (can) onPrepare(q.trim(), () => setQ("")); };
  return (
    <Card id="ai-chat" tint="mind" icon="sparkle" eyebrow={t("aiParts.aboutYourOwnLog")} badge={<Chip variant="pro" />} title={t("ai.chatTitle")} level={2} className="aicard aichat"
      action={chat.length ? <button type="button" className="linkbtn aiclear" onClick={onClear}>{t("ai.chatClear")}</button> : null}>
      <p className="hint">{t("ai.chatLead")}</p>
      <ol className="ailist" ref={listRef} aria-live="polite" aria-label={t("aiParts.conversation")}>
        {chat.length === 0 && <li className="aiempty">{t("ai.chatEmpty")}</li>}
        {chat.map((m, i) => (
          <li key={i} className={`aimsg ${m.role === "me" ? "me" : "cyra"}${m.kind === "urgent" ? " urgent" : ""}`}>
            <span className="sr-only">{m.role === "me" ? t("aiParts.you") : t("aiParts.cyra")}</span>
            {String(m.text).split(/\n\s*\n/).map((tv, j) => <p key={j}>{tv}</p>)}
            {m.ask && <p className="aiask">{t("aiParts.worthAsking", { ask: m.ask })}</p>}
            {m.role === "me" && m.kind !== "local" && <span className="aisent"><Icon name="check" size={12} />{t("ai.sentChat")}</span>}
          </li>
        ))}
        {busy && <li className="aimsg cyra aiwait" role="status">{t("aiParts.cyraIsWriting")}</li>}
      </ol>
      {line && <p className="ainote" role="status">{line}</p>}
      {note && <p className="ainote" role="status">{note}</p>}
      <label className="section-lab" htmlFor="ai-chat-q">{t("ai.chatLabel")}</label>
      <textarea id="ai-chat-q" className="inp aiq" rows={2} maxLength={500} value={q} onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); send(); } }} />
      <button type="button" className="cta aichatgo" aria-haspopup="dialog" disabled={!can} onClick={send}>{t("ai.chatGo")}</button>
      <p className="rfoot">{t("ai.notAdvice")} {t("ai.chatKept")}</p>
    </Card>
  );
}
