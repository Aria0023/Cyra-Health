import Advice from "../components/Advice.jsx";
import Details from "../components/Details.jsx";

/* Ask: free-text question → plain-language evidence answer with named source,
   one question to bring to the doctor, and urgent-flag routing. Cyra's written
   library answers on this device first; Cyra's AI is asked only when she turned it
   on below and the library has no answer (App.jsx runAsk). */
const AI_DISCLOSURE = "When this is on and the library can't answer, your typed words go through Cyra's server to Anthropic, maker of the Claude AI, which keeps them for a limited time. Leave out identifying details.";

export default function AskScreen({ org, stage, askQ, setAskQ, runAsk, askBusy, askOut, askAI, setAskAI, aiAvailable }) {
  const sourceLine = askOut?.source === "ai" ? "Written by Cyra's AI (Claude, made by Anthropic) — not from the written library."
    : askOut?.source === "library" ? "From Cyra's written library — answered on this device; nothing was sent."
    : askOut?.source === "server-library-attempted" ? "From Cyra's written library. Your question was sent to Cyra's server, which asked Cyra's AI (Claude, made by Anthropic). Anthropic may have received it, but no AI answer came back."
    : askOut?.source === "server-library" ? "From Cyra's written library. Your question was sent to Cyra's server, but Cyra's AI isn't set up there, so it didn't go to Anthropic."
    : null;
  return (
    <main>
      <h1 className="disp">Ask {org.name}</h1>
      <p className="hint">Answers come first from Cyra's written evidence library, built from the guidelines your doctor reads and put into plain language. If you turn on Cyra's AI, any answer it writes is labelled. Each answer says where it came from and, when it can, suggests a question for your next visit.</p>
      <textarea className="inp" rows={3} style={{ resize: "none", fontFamily: "inherit" }} placeholder={stage === "preg" ? "e.g. Is it safe to exercise in the second trimester?" : stage === "periods" ? "e.g. Why are my cramps worse some months?" : "e.g. Does hormone therapy raise cancer risk?"} value={askQ} onChange={(e) => setAskQ(e.target.value)} />
      {aiAvailable && (
        <>
          <button role="checkbox" aria-checked={!!askAI} aria-describedby="ask-ai-disclosure" className={`consentopt ${askAI ? "on" : ""}`} style={{ marginBottom: 6 }} onClick={() => setAskAI(!askAI)}>
            <span className="ckbox" aria-hidden="true">{askAI ? "✓" : ""}</span>
            <span><b>Also ask Cyra's AI when the library has no answer</b></span>
          </button>
          <p className="rfoot" id="ask-ai-disclosure" style={{ margin: "0 0 4px" }}>{AI_DISCLOSURE}</p>
          <Details label="Exactly what's sent">
            <ul>
              <li>The question you typed (up to 500 characters) is sent. Your name, account and life stage don't go with it.</li>
              <li>Cyra doesn't keep your question. Anthropic keeps it for a limited time under its own terms.</li>
            </ul>
          </Details>
        </>
      )}
      <button className="cta" onClick={runAsk} disabled={askBusy}>{askBusy ? "Asking Cyra's AI…" : "Ask"}</button>
      {askOut && (
        <div className="card" style={{ display: "block", marginTop: 14 }}>
          {askOut.urgent && <div style={{ marginBottom: 10 }}><Advice urgency="now">This sounds like something to get checked promptly — please contact your provider or urgent care rather than waiting.</Advice></div>}
          <p style={{ lineHeight: 1.6 }}>{askOut.answer}</p>
          {askOut.source_note && <p className="rfoot" style={{ marginTop: 10 }}>Evidence base: {askOut.source_note}</p>}
          {askOut.ask_your_doctor && <div style={{ marginTop: 10 }}><Advice urgency="visit">Worth asking: "{askOut.ask_your_doctor}"</Advice></div>}
          {askOut.offerAI && <p className="rfoot" style={{ marginTop: 10 }}>Cyra's AI can try questions the library can't answer. To use it, tick "Also ask Cyra's AI when the library has no answer" above and ask again.</p>}
          {sourceLine && <p className="rfoot" style={{ marginTop: 10 }}>{sourceLine}</p>}
          <p className="rfoot" style={{ marginTop: 10 }}>Plain-language education, not medical advice or diagnosis.</p>
        </div>
      )}
      <p className="rfoot" style={{ marginTop: 14 }}>{aiAvailable
        ? "Questions the library answers stay on this device. If you turn on Cyra's AI, only questions the library can't answer are sent, and never with your name or account."
        : "Questions are answered on this device from Cyra's written library and aren't sent anywhere."}</p>
    </main>
  );
}
