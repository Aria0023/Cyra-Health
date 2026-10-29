import { useEffect, useRef } from "react";
import Advice from "../components/Advice.jsx";
import Icon from "../components/Icon.jsx";
import Details, { AiFacts } from "../components/Details.jsx";
import { STARTERS } from "../lib/askStarters.js";
import { copyText } from "../lib/clipboard.js";
import { reduceMotion } from "../lib/motion.js";

/* Ask: free-text question → plain-language evidence answer with named source,
   one question to bring to the doctor, and urgent-flag routing. Cyra's written
   library answers on this device first; Cyra's AI is asked only when she turned it
   on below and the library has no answer (App.jsx runAsk). UI A1: a "Try asking" row of
   starters the library always answers (lib/askStarters.js), the answer landed on and
   focused with its source badge up top, the evidence base one citation per line, the
   visit question copyable, and a one-tap AI route out of an unmatched answer that sets
   the same visible opt-in and shows the same disclosure. */
export const AI_DISCLOSURE = "When this is on and the library can't answer, your typed words go through Cyra's server to Anthropic, maker of the Claude AI, which keeps them for a limited time. Leave out identifying details.";

// The answer object the screen last landed on. Module-level on purpose: the tab panel remounts this
// screen on every tab switch, and coming back to a standing answer must not scroll or steal focus
// again, while a new answer (from the Ask button, a starter, or Patterns' "Ask about this →", which
// sets askOut before this screen mounts) always does. One App instance, so one marker.
let landedOn = null;

/* calm R5: `embedded` renders it as the "Ask Cyra" section of Mind → Journey (a section named by an h2, inside the
   Journey page's main) instead of a page of its own. Every control, sentence and behaviour is the same. */
export default function AskScreen({ org, stage, askQ, setAskQ, runAsk, askBusy, askOut, askAI, setAskAI, aiAvailable, potsOn = false, ping, embedded = false }) {
  const Wrap = embedded ? "section" : "main";
  const outRef = useRef(null);
  const starters = [...(STARTERS[stage] || STARTERS.peri), ...(potsOn ? STARTERS.pots : [])];
  const sourceLine = askOut?.source === "ai" ? "Written by Cyra's AI (Claude, made by Anthropic) — not from the written library."
    : askOut?.source === "library" ? "From Cyra's written library — answered on this device; nothing was sent."
    : askOut?.source === "server-library-attempted" ? "From Cyra's written library. Your question was sent to Cyra's server, which asked Cyra's AI (Claude, made by Anthropic). Anthropic may have received it, but no AI answer came back."
    : askOut?.source === "server-library" ? "From Cyra's written library. Your question was sent to Cyra's server, but Cyra's AI isn't set up there, so it didn't go to Anthropic."
    : null;
  // Source badge, mapped strictly from askOut.source: every library route (on the device, or the
  // server's rules fallback) is "Written library"; only an AI-written answer is "Cyra's AI"; an
  // error has no badge. It must agree with the footer sentence above, which is the authority.
  const badge = askOut?.source === "ai" ? ["Cyra's AI", "u-ai"] : askOut && askOut.source !== "error" ? ["Written library", "u-visit"] : null;
  const unmatched = !!askOut && askOut.source === "library" && askOut.matched === false;
  // The library's own paragraphing (blank lines) is kept; no sentence scanner.
  const paragraphs = askOut ? String(askOut.answer || "").split(/\n\s*\n/) : [];
  const evidence = askOut?.source_note ? askOut.source_note.split(/;\s*/).filter(Boolean) : [];

  // Land on the answer: the section top inside the viewport, then focus on the section itself so a
  // screen reader reads the card from its badge. Smooth only when the OS allows motion.
  useEffect(() => {
    const el = outRef.current;
    if (!askOut || askOut === landedOn || !el) return;
    landedOn = askOut;
    el.scrollIntoView?.({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
    el.focus({ preventScroll: true });
  }, [askOut]);

  const startRow = (
    <div className="askstarters">
      {starters.map((q) => (
        <button key={q} type="button" className="askstarter" onClick={() => { setAskQ(q); runAsk(q); }}>{q}</button>
      ))}
    </div>
  );
  const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !askBusy) { e.preventDefault(); runAsk(); } };
  return (
    <Wrap className={embedded ? "askpart" : undefined} id={embedded ? "ask" : undefined} aria-labelledby={embedded ? "ask-h" : undefined}>
      {embedded ? <h2 className="journeyh askh" id="ask-h"><span className="ibadge" data-tint="mind" aria-hidden="true"><Icon name="sparkle" size={18} /></span>Ask {org.name}</h2> : <h1 className="disp">Ask {org.name}</h1>}
      <p className="hint">Plain-language answers from Cyra's written evidence library, built from the guidelines your doctor reads.{aiAvailable && " If you turn on Cyra's AI below, any answer it writes is labelled."}</p>
      <div className={askOut ? "askstart" : "askstart askintro"}>
        <p className="section-lab">Try asking</p>
        {startRow}
      </div>
      <label htmlFor="ask-q" className="section-lab">Your question</label>
      <textarea id="ask-q" className="inp" rows={3} maxLength={500} style={{ resize: "none", fontFamily: "inherit" }} placeholder={stage === "preg" ? "e.g. Is it safe to exercise in the second trimester?" : stage === "periods" ? "e.g. Why are my cramps worse some months?" : "e.g. Does hormone therapy raise cancer risk?"} value={askQ} onChange={(e) => setAskQ(e.target.value)} onKeyDown={onKey} />
      {askQ.length > 400 && <p className="rfoot askcount" aria-live="polite">{askQ.length} / 500 characters</p>}
      {aiAvailable && (
        <>
          <button role="checkbox" aria-checked={!!askAI} aria-describedby="ask-ai-disclosure" className={`consentopt ${askAI ? "on" : ""}`} style={{ marginBottom: 6 }} onClick={() => setAskAI(!askAI)}>
            <span className="ckbox" aria-hidden="true">{askAI ? "✓" : ""}</span>
            <span><b>Also ask Cyra's AI when the library has no answer</b></span>
          </button>
          <p className="rfoot" id="ask-ai-disclosure" style={{ margin: "0 0 4px" }}>{AI_DISCLOSURE}</p>
          <Details label="Exactly what's sent"><AiFacts /></Details>
        </>
      )}
      <button className="cta" onClick={runAsk} disabled={askBusy}>{askBusy ? <><span className="askspin" aria-hidden="true" />Asking Cyra's AI…</> : "Ask"}</button>
      <section className="askout" aria-live="polite" aria-atomic="true" tabIndex={-1} ref={outRef}>
        {askBusy && <p className="rfoot" role="status">Asking Cyra's AI…</p>}
        {askOut && (
          <div className={`card askcard ${askOut.urgent ? "askurgent" : ""}`} key={askOut.question + askOut.source}>
            <div className="asksrc">
              {badge && <span className={`uchip ${badge[1]}`}>{badge[0]}</span>}
              {askOut.question && <span className="asksrc-q">{askOut.question}</span>}
            </div>
            {askOut.urgent && <div style={{ marginBottom: 10 }}><Advice urgency="today">This sounds like something to get checked promptly — please contact your provider or urgent care rather than waiting.</Advice></div>}
            {paragraphs.map((t, i) => <p key={i} className="asktext">{t}</p>)}
            {evidence.length > 0 && (
              <p className="askev"><span className="askev-lab">Evidence base: </span>{evidence.map((e, i) => <span key={i} className="askev-i">{e}{i < evidence.length - 1 ? "; " : ""}</span>)}</p>
            )}
            {askOut.ask_your_doctor && (
              <div className="askvisit">
                <Advice urgency="visit">Worth asking: "{askOut.ask_your_doctor}"</Advice>
                <button type="button" className="linkbtn askcopy" onClick={() => copyText(askOut.ask_your_doctor, "Question copied", ping)}>Copy question</button>
              </div>
            )}
            {unmatched && (
              <div className="askagain">
                <p className="section-lab">The library can answer</p>
                {startRow}
              </div>
            )}
            {askOut.offerAI && (
              <>
                <p className="rfoot" style={{ marginTop: 10 }}>Cyra's AI can try questions the library can't answer. To use it, tick "Also ask Cyra's AI when the library has no answer" above and ask again.</p>
                {aiAvailable && !askAI && (
                  <>
                    {/* One tap does both: it turns the visible, persisted opt-in on and sends this one question. The override is needed because runAsk would otherwise read the saved choice from before this render and return the unmatched card again. */}
                    <button type="button" className="ghostbtn" onClick={() => { setAskAI(true); runAsk(askOut.question, { ai: true }); }}>Ask Cyra's AI about this</button>
                    <p className="rfoot">{AI_DISCLOSURE}</p>
                  </>
                )}
              </>
            )}
            <footer className="askfoot">
              {sourceLine && <p className="rfoot">{sourceLine}</p>}
              <p className="rfoot">Plain-language education, not medical advice or diagnosis.</p>
            </footer>
          </div>
        )}
      </section>
      <p className="rfoot" style={{ marginTop: 14 }}>{aiAvailable
        ? "Questions the library answers stay on this device. If you turn on Cyra's AI, only questions the library can't answer are sent, and never with your name or account."
        : "Questions are answered on this device from Cyra's written library and aren't sent anywhere."}</p>
    </Wrap>
  );
}
