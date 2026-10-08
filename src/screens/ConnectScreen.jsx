import { CONNECT, INTIMACY, AFTER, RELATIONSHIP } from "../lib/constants.js";
import Advice from "../components/Advice.jsx";

/* Connect (intimacy & relationship): closeness / desire / tension / mental-load
   sliders, intimacy today, afterwards, situation. Never asks a partner's gender;
   intimacy questions are hidden for solo users. */
export default function ConnectScreen({ relationship, setRelationship, conn, setConn, intimacy, setIntimacy, after, setAfter, setConnLog, todayIso, ping }) {
  const connScore = Math.round(((conn.closeness + conn.desire + conn.load + (10 - conn.friction)) / 40) * 100);
  const connAdvice = () => {
    if (after === "pain") return <Advice urgency="visit">Pain or dryness with intimacy is one of the most common — and most treatable — things people never mention. Vaginal estrogen, moisturizers, and lubricants have strong evidence. This is worth saying out loud at your next visit.</Advice>;
    if (conn.load <= 3 && conn.desire <= 4) return <Advice urgency="self">Research found that when the mental load falls mostly on one partner, their desire tends to drop — it's one of the strongest predictors, stronger than hormone levels. Worth a conversation about who carries what.</Advice>;
    if (conn.friction >= 7) return <Advice urgency="self">High tension days are worth noting next to your symptoms. Couples' stress tends to sync up — and distressed partners amplify each other, while connected ones tend to calm each other down.</Advice>;
    if (conn.closeness >= 8) return <Advice urgency="self">Affectionate closeness — not just sexual contact — has its own measurable effect on stress hormones. Days like this are worth tracking too.</Advice>;
    return <Advice urgency="self">Studies show relationship satisfaction and partner availability predict desire far more than hormone levels do. Tracking how you feel alongside your cycle helps you see your own pattern — without assuming hormones are the whole story.</Advice>;
  };
  return (
    <main>
      <h1 className="disp">Connection</h1>
      <p className="hint">Optional, private, and judgment-free. This tracks how connected you feel — not just sex — because the research is clear that closeness, fairness, and tension predict desire more than hormones do. Nothing here assumes who your partner is, or that there's only one.</p>
      {!relationship && (
        <>
          <p className="section-lab">Your situation (optional)</p>
          <div className="mcrow" style={{ marginBottom: 14 }}>
            {RELATIONSHIP.map(([v, l]) => <button key={v} aria-pressed={relationship === v} className={`mc ${relationship === v ? "on" : ""}`} onClick={() => setRelationship(v)}>{l}</button>)}
          </div>
        </>
      )}
      <p className="section-lab">How it felt today, 0–10</p>
      {Object.entries(CONNECT).map(([k, s]) => (
        <div className="scalerow" key={k}>
          <div className="scalehead"><span>{s.label}</span><b>{conn[k]}</b></div>
          <input className="slider" type="range" min="0" max="10" value={conn[k]} aria-label={`${s.label}, 0 is ${s.low}, 10 is ${s.high}`} aria-valuetext={`${conn[k]} out of 10`} onChange={(e) => setConn((x) => ({ ...x, [k]: +e.target.value }))} />
          <div className="scaleends"><span>{s.low}</span><span>{s.high}</span></div>
        </div>
      ))}
      {relationship !== "single" && (
        <>
          <p className="section-lab">Intimacy today</p>
          <div className="mcrow" style={{ marginBottom: 10 }}>
            {INTIMACY.map(([v, l]) => <button key={v} aria-pressed={intimacy === v} className={`mc ${intimacy === v ? "on" : ""}`} onClick={() => setIntimacy(intimacy === v ? null : v)}>{l}</button>)}
          </div>
          {intimacy && intimacy !== "none" && (
            <>
              <p className="section-lab">Afterwards</p>
              <div className="mcrow" style={{ marginBottom: 10 }}>
                {AFTER.map(([v, l]) => <button key={v} aria-pressed={after === v} className={`mc ${after === v ? "on" : ""}`} onClick={() => setAfter(after === v ? null : v)}>{l}</button>)}
              </div>
            </>
          )}
        </>
      )}
      <div className="card"><div className="num">{connScore}</div><p>Connection today. Over weeks, Cyra lines this up against your cycle phase and symptoms — so you can see whether low-desire days are really hormonal, or something else entirely.</p></div>
      {connAdvice()}
      <button className="cta" style={{ marginTop: 12 }} onClick={() => { setConnLog((l) => ({ ...l, [todayIso]: { ...conn, intimacy, after } })); ping("Saved — private to your device"); }}>Save</button>
      <p className="rfoot">Separated from sexual activity on purpose: affection and sex move your body differently, and both matter. Pain with intimacy is always worth raising with a clinician — it's common and treatable.</p>
    </main>
  );
}
