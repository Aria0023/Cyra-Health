import { useEffect, useRef, useState } from "react";
import { Card, Chip } from "../ui/index.js";
import Advice from "../Advice.jsx";
import { EVIDENCE_COPY as C, answerParts } from "../../lib/evidence.js";
import { openExternal } from "../../lib/links.js";
import { isNative } from "../../lib/native.js";

/* "Ask with evidence" (Pro, Task 3), in Mind → Journey and on Patterns. Without Pro: one line and "See what Pro adds".
   With Pro: her question, an optional "Include a summary of my log" tick, and "Review and send", which opens "What Solia
   Health will send" (App.jsx, AiSendSheet) with the exact body; nothing goes until Send there. The answer shows with
   numbered links to its sources. A red-flag question is answered on this device by App.jsx and never sent. */
export default function EvidenceCard({ open = false, onPro, summaryOk = false, busy = false, out = null, note = null, onPrepare, id = "ai-evidence" }) {
  const [q, setQ] = useState("");
  const [inc, setInc] = useState(false);
  const [err, setErr] = useState("");
  const outRef = useRef(null);
  useEffect(() => { if (out) outRef.current?.focus({ preventScroll: false }); }, [out]);
  const opens = isNative() ? "opens in your browser" : C.opensIn;
  if (!open) {
    return (
      <Card id={id} tint="mind" icon="book" title={C.title} badge={<Chip variant="pro" />} level={2} className="aicard evcard locked">
        <p className="hint">{C.locked}</p>
        <button type="button" className="ghostbtn" aria-haspopup="dialog" onClick={onPro}>See what Pro adds</button>
      </Card>
    );
  }
  const go = () => { setErr(""); if (q.trim().length < 3) { setErr(C.tooShort); return; } onPrepare(q.trim(), inc && summaryOk); };
  return (
    <Card id={id} tint="mind" icon="book" title={C.title} badge={<Chip variant="pro" />} level={2} className="aicard evcard">
      <p className="hint">{C.lead}</p>
      <label className="section-lab" htmlFor={`${id}-q`}>{C.label}</label>
      <textarea id={`${id}-q`} className="inp" rows={3} maxLength={500} placeholder={C.placeholder} value={q} onChange={(e) => setQ(e.target.value)} aria-describedby={err ? `${id}-err` : undefined} />
      {summaryOk && (
        <>
          <button type="button" role="checkbox" aria-checked={inc} aria-describedby={`${id}-inc`} className={`consentopt ${inc ? "on" : ""}`} onClick={() => setInc((v) => !v)}>
            <span className="ckbox" aria-hidden="true">{inc ? "✓" : ""}</span>
            <span><b>{C.includeSummary}</b></span>
          </button>
          <p className="rfoot" id={`${id}-inc`}>{C.includeHint}</p>
        </>
      )}
      {err && <p className="errhint" role="alert" id={`${id}-err`}>{err}</p>}
      <button type="button" className="cta" aria-haspopup="dialog" disabled={busy} onClick={go}>{busy ? C.asking : C.ask}</button>
      {busy && <p className="rfoot" role="status">{C.asking}</p>}
      {note && <p className="hint evnote" role="status">{note}</p>}
      {out && (
        <div className={`evout${out.urgent ? " askurgent" : ""}`} tabIndex={-1} ref={outRef} aria-label={`Answer: ${out.question}`}>
          <p className="asksrc-q">{out.question}</p>
          {out.urgent ? <Advice urgency="today">{out.answer}</Advice> : answerParts(out.answer).map((para, i) => (
            <p key={i} className="aitext">{para.map((x, j) => (x.n ? <a key={j} className="evmark" href={`#${id}-src-${x.n}`} aria-label={`Source ${x.n}`}>[{x.n}]</a> : <span key={j}>{x.text}</span>))}</p>
          ))}
          {out.sources?.length > 0 && (
            <>
              <h3 className="section-lab" id={`${id}-srch`}>{C.sourcesLab}</h3>
              <ol className="evsrcs" aria-labelledby={`${id}-srch`}>
                {out.sources.map((s) => (
                  <li key={s.n} id={`${id}-src-${s.n}`} value={s.n}>
                    <a className="linkbtn evsrc" href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`${s.title} (${opens})`} onClick={(e) => { e.preventDefault(); openExternal(s.url); }}>{s.title}</a>
                    <span className="evhost">{new URL(s.url).hostname.replace(/^www\./, "")}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          <p className="rfoot">{C.foot}</p>
        </div>
      )}
    </Card>
  );
}
