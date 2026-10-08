import { QUICK_Q } from "../lib/constants.js";

/* Quick check-in: three stage-specific questions, done in ~10 seconds. */
export default function QuickCheckin({ stage, draft, setDraft, setQuickMode }) {
  return (
    <div className="plaincard" style={{ marginBottom: 14 }}>
      <div className="shead" style={{ marginBottom: 8 }}><span className="sbrand">Quick check-in</span><button className="linkbtn" onClick={() => setQuickMode(false)}>more detail</button></div>
      {(QUICK_Q[stage] || QUICK_Q.peri).map((q, i) => {
        const key = ["q1", "q2", "q3"][i];
        return (
          <div key={q} style={{ marginBottom: 10 }}>
            <p className="plain" style={{ marginBottom: 6, fontSize: 13.5 }}>{q}</p>
            <div className="mcrow">
              {[["0", "No / fine"], ["1", "A little"], ["2", "Yes"], ["3", "A lot"]].map(([v, l]) => (
                <button key={v} className={`mc ${String(draft[key] ?? "") === v ? "on" : ""}`} onClick={() => setDraft((d) => ({ ...d, [key]: +v }))}>{l}</button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
