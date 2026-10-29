import { useEffect, useRef, useState } from "react";
import { Card, Chip, Sheet } from "../ui/index.js";
import Icon from "../Icon.jsx";
import Advice from "../Advice.jsx";
import { AI_COPY as C } from "../../lib/aiFeatures.js";

/* Cyra's AI write-up and chat (calm R8). Three parts, all driven by App.jsx:
   - AiSendSheet: "What Cyra will send". Opens before EVERY send. It shows the request body in plain words and then
     exactly as sent (the pretty JSON of the very object App.jsx posts), with Send and Cancel. Nothing goes until Send.
   - WriteUpCard: Patterns' "Cyra's write-up" (Pro + her switch). Checks once that the server has Cyra's AI set up.
   - ChatCard: Mind → Journey's "Chat about your log" (Pro + her switch). The conversation stays on this device.
   Every sentence comes from lib/aiFeatures.js AI_COPY. */

/** status line for the server check: null when ready. */
const statusLine = (status) => (status === "checking" ? C.checking : status === "unset" ? C.notSetUp : status === "offline" ? C.offline : status === "error" ? C.noAnswer : null);

export function AiSendSheet({ kind, body, lines = [], busy = false, onSend, onClose }) {
  const exact = JSON.stringify(body, null, 2);
  return (
    <Sheet id="ai-send-sheet" title={C.sheetTitle} onClose={onClose} closeLabel="Close what Cyra will send" className="aisend">
      <p className="aisend-lead"><Icon name="shield" size={16} />{C.sheetLead}</p>
      <section className="aisend-sec" aria-labelledby="aisend-plain-h">
        <h3 className="section-lab" id="aisend-plain-h">{C.sheetPlain}</h3>
        <dl className="aisend-plain">
          {kind === "chat" && <div className="aisend-row aisend-q"><dt>{C.sheetQuestion}</dt><dd>{body.question}</dd></div>}
          {kind === "chat" && body.history?.length > 0 && <div className="aisend-row"><dt>{C.sheetHistory}</dt><dd>{body.history.length === 1 ? "1 message" : `${body.history.length} messages`}, shown in full below</dd></div>}
          {lines.map(([l, t]) => <div className="aisend-row" key={l}><dt>{l}</dt><dd>{t}</dd></div>)}
        </dl>
      </section>
      <section className="aisend-sec" aria-labelledby="aisend-exact-h">
        <h3 className="section-lab" id="aisend-exact-h">{C.sheetExact}</h3>
        <pre className="aisend-json" tabIndex={0} aria-labelledby="aisend-exact-h">{exact}</pre>
      </section>
      <div className="aisend-acts">
        <button type="button" className="cta aisend-go" disabled={busy} onClick={onSend}>{busy ? "Sending…" : "Send"}</button>
        <button type="button" className="ghostbtn aisend-no" onClick={onClose}>Cancel</button>
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
    <Card id="ai-writeup" tint="patterns" icon="sparkle" eyebrow="Your last 8 weeks" badge={<Chip variant="pro" />} title={C.wuTitle} level={2} className="aicard aiwriteup">
      <AiArt />
      {last ? (
        <div className="aiout" tabIndex={-1}>
          {paras.map((t, i) => <p key={i} className="aitext">{t}</p>)}
          {last.ask && <Advice urgency="visit">Worth asking: "{last.ask}"</Advice>}
          <p className="aichips"><span className="aisent"><Icon name="check" size={12} />{C.sentSummary}</span></p>
          <p className="rfoot">{C.byAI} {C.notAdvice}</p>
        </div>
      ) : <p className="hint">{C.wuLead}</p>}
      {line && <p className="ainote" role="status">{line}</p>}
      {note && <p className="ainote" role="status">{note}</p>}
      <button type="button" className={last ? "ghostbtn aigo" : "cta aigo"} aria-haspopup="dialog" disabled={busy || status !== "ready"} onClick={onPrepare}>
        {busy ? "Writing…" : last ? C.wuAgain : C.wuGo}
      </button>
    </Card>
  );
}

export function ChatCard({ status, chat = [], busy = false, note = null, online = true, onPrepare, onClear, onCheck }) {
  const [q, setQ] = useState("");
  const listRef = useRef(null);
  useEffect(() => { onCheck?.(); }, []); // eslint-disable-line
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [chat.length]);
  const line = !online ? C.offline : statusLine(status);
  const can = online && status === "ready" && !busy && q.trim().length >= 2;
  const send = () => { if (can) onPrepare(q.trim(), () => setQ("")); };
  return (
    <Card id="ai-chat" tint="mind" icon="sparkle" eyebrow="About your own log" badge={<Chip variant="pro" />} title={C.chatTitle} level={2} className="aicard aichat"
      action={chat.length ? <button type="button" className="linkbtn aiclear" onClick={onClear}>{C.chatClear}</button> : null}>
      <p className="hint">{C.chatLead}</p>
      <ol className="ailist" ref={listRef} aria-live="polite" aria-label="Conversation">
        {chat.length === 0 && <li className="aiempty">{C.chatEmpty}</li>}
        {chat.map((m, i) => (
          <li key={i} className={`aimsg ${m.role === "me" ? "me" : "cyra"}${m.kind === "urgent" ? " urgent" : ""}`}>
            <span className="sr-only">{m.role === "me" ? "You: " : "Cyra: "}</span>
            {String(m.text).split(/\n\s*\n/).map((t, j) => <p key={j}>{t}</p>)}
            {m.ask && <p className="aiask">Worth asking: "{m.ask}"</p>}
            {m.role === "me" && m.kind !== "local" && <span className="aisent"><Icon name="check" size={12} />{C.sentChat}</span>}
          </li>
        ))}
        {busy && <li className="aimsg cyra aiwait" role="status">Cyra is writing…</li>}
      </ol>
      {line && <p className="ainote" role="status">{line}</p>}
      {note && <p className="ainote" role="status">{note}</p>}
      <label className="section-lab" htmlFor="ai-chat-q">{C.chatLabel}</label>
      <textarea id="ai-chat-q" className="inp aiq" rows={2} maxLength={500} value={q} onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); send(); } }} />
      <button type="button" className="cta aichatgo" aria-haspopup="dialog" disabled={!can} onClick={send}>{C.chatGo}</button>
      <p className="rfoot">{C.notAdvice} {C.chatKept}</p>
    </Card>
  );
}
