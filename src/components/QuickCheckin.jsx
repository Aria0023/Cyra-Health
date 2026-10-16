import { QUICK_Q } from "../lib/constants.js";

/* Quick check-in: three stage-specific questions, done in ~10 seconds. Each question is a labelled
   group whose four answers form one joined .seg control (the answers read as answers to that
   question; their index 0-3 is the value saved). "more detail" (onMore, App.jsx) carries the
   answers given so far onto the matching symptom chips and opens the full form for this visit
   only; the Quick / Full detail preference in Settings is not touched. */
export default function QuickCheckin({ stage, draft, setDraft, onMore }) {
  return (
    <div className="plaincard" style={{ marginBottom: 14 }}>
      <div className="shead"><span className="sbrand">Quick check-in</span><button type="button" className="linkbtn" onClick={onMore}>more detail</button></div>
      {(QUICK_Q[stage] || QUICK_Q.peri).map((q, i) => {
        const key = ["q1", "q2", "q3"][i];
        const qid = `quick-${key}`;
        return (
          <div key={q.q} role="group" aria-labelledby={qid} style={{ marginBottom: 10 }}>
            <p id={qid} className="qlab">{q.q}</p>
            <div className="mcrow seg answers">
              {q.a.map((l, v) => {
                const on = String(draft[key] ?? "") === String(v);
                return <button key={l} className={`mc ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setDraft((d) => ({ ...d, [key]: v }))}>{l}</button>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
