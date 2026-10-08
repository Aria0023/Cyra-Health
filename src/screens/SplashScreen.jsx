/* Phase 1: splash. Wordmark, tagline, value proposition, "Get started". */
export default function SplashScreen({ onStart }) {
  return (
    <div className="splash">
      <div className="splashmark">Cyra<span>.</span></div>
      <div className="splashtag">One companion for every phase</div>
      <h1 className="disp" style={{ marginTop: 26 }}>Periods, pregnancy,
        <br />the transition — and
        <br />finally being heard.</h1>
      <p className="hint">Track in 30 seconds a day. See your real patterns. Walk into appointments with evidence. Your health data stays on your device — always.</p>
      <button className="cta" onClick={onStart}>Get started</button>
      <p className="rfoot" style={{ textAlign: "center" }}>Free to use · guidance, never diagnosis<br /><b>BUILD 2026.10.07-D</b></p>
    </div>
  );
}
