import { QUICK_Q } from "../lib/constants.js";
import { t } from "../lib/i18n.js";
import MoodFace from "./mind/MoodFace.jsx";
import Icon from "./Icon.jsx";

/* 2026-11-25 (docs/plans/critique-fixes.md Task 6): a face over each answer, drawn like the Mind mood faces (inline SVG,
   currentColor, decorative), the word always under it. Answer 0 is the easiest ("No / fine", "Slept well", "Sharp"), 3 the
   hardest, so the faces run from a small smile to a frown. A selected answer also gets a tick, so it never rests on colour.
   Same values (0-3), same storage, same order. */
const QUICK_FACE = Object.freeze([4, 3, 2, 1]);

/* Quick check-in: three stage-specific questions, done in ~10 seconds. Each question is a labelled
   group whose four answers form one joined .seg control (the answers read as answers to that
   question; their index 0-3 is the value saved). "more detail" (onMore, App.jsx) carries the
   answers given so far onto the matching symptom chips and opens the full form for this visit
   only; the Quick / Full detail preference in Settings is not touched. */
export default function QuickCheckin({ stage, draft, setDraft, onMore }) {
  return (
    <div className="plaincard" style={{ marginBottom: 14 }}>
      <div className="shead"><span className="sbrand">{t("quick.quickCheckIn")}</span><button type="button" className="linkbtn" onClick={onMore}>{t("quick.moreDetail")}</button></div>
      {(QUICK_Q[stage] || QUICK_Q.peri).map((q, i) => {
        const key = ["q1", "q2", "q3"][i];
        const qid = `quick-${key}`;
        return (
          <div key={q.q} role="group" aria-labelledby={qid} style={{ marginBottom: 10 }}>
            <p id={qid} className="qlab">{q.q}</p>
            <div className="mcrow seg answers">
              {q.a.map((l, v) => {
                const on = String(draft[key] ?? "") === String(v);
                return (
                  <button key={l} className={`mc qface ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setDraft((d) => ({ ...d, [key]: v }))}>
                    <MoodFace v={QUICK_FACE[v]} size={26} />
                    <span className="qface-lab">{on && <Icon name="check" size={11} className="qface-tick" />}{l}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
