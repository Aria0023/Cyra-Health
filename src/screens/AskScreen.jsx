import Advice from "../components/Advice.jsx";

/* Ask: free-text question → plain-language evidence answer with named source,
   one question to bring to the doctor, and urgent-flag routing. */
export default function AskScreen({ org, stage, askQ, setAskQ, runAsk, askBusy, askOut }) {
  return (
    <main>
      <h1 className="disp">Ask {org.name}</h1>
      <p className="hint">Real medical evidence, translated into plain language — the stuff your doctor reads, made readable. Every answer names its source and ends with a question worth bringing to your next visit.</p>
      <textarea className="inp" rows={3} style={{ resize: "none", fontFamily: "inherit" }} placeholder={stage === "preg" ? "e.g. Is it safe to exercise in the second trimester?" : stage === "periods" ? "e.g. Why are my cramps worse some months?" : "e.g. Does hormone therapy raise cancer risk?"} value={askQ} onChange={(e) => setAskQ(e.target.value)} />
      <button className="cta" onClick={runAsk} disabled={askBusy}>{askBusy ? "Reading the evidence…" : "Ask"}</button>
      {askOut && (
        <div className="card" style={{ display: "block", marginTop: 14 }}>
          {askOut.urgent && <div style={{ marginBottom: 10 }}><Advice urgency="now">This sounds like something to get checked promptly — please contact your provider or urgent care rather than waiting.</Advice></div>}
          <p style={{ lineHeight: 1.6 }}>{askOut.answer}</p>
          {askOut.source_note && <p className="rfoot" style={{ marginTop: 10 }}>Evidence base: {askOut.source_note}</p>}
          {askOut.ask_your_doctor && <div style={{ marginTop: 10 }}><Advice urgency="visit">Worth asking: "{askOut.ask_your_doctor}"</Advice></div>}
          <p className="rfoot" style={{ marginTop: 10 }}>Plain-language education, not medical advice or diagnosis.</p>
        </div>
      )}
      <p className="rfoot" style={{ marginTop: 14 }}>Your questions stay on your device and are never linked to your identity.</p>
    </main>
  );
}
