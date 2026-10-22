import { useEffect, useRef } from "react";
import Advice from "../components/Advice.jsx";
import Icon from "../components/Icon.jsx";
import { PRENATAL, prenatalWhen } from "../lib/constants.js";
import { roadmapAdvice, trimesterOf } from "../lib/engine.js";
import { reduceMotion } from "../lib/motion.js";

/* Pregnancy — Milestones: the evidence-based low-risk prenatal schedule (spec §7, PRENATAL in lib/constants.js),
   each item status-tagged against the current week. UI M1: "you are here" — the derived Next-visit sentence sits
   under the hint, done items fold to one-line rows, the in-window (or next) card carries a primary edge and is
   centred on open when it would start below the fold, and a now/soon item can be put on the Appointments list. */
const TRI_KEY = { first: "First trimester", second: "Second trimester", third: "Third trimester" };

export default function MilestonesScreen({ pregWeek, onPlan }) {
  const hereRef = useRef(null);
  const flat = PRENATAL.flatMap((g) => g.items);
  // The card to centre on: the first item whose window holds this week, else the next one to open.
  const here = flat.find((m) => pregWeek >= m.from && pregWeek <= m.to) || flat.find((m) => m.from > pregWeek) || null;
  const curTri = pregWeek > 42 ? "After birth" : TRI_KEY[trimesterOf(pregWeek)];
  const jump = () => hereRef.current?.scrollIntoView?.({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" });
  useEffect(() => { // once on open, and only when the card starts in the bottom fifth or below; focus is left where it is
    const el = hereRef.current;
    if (el && el.getBoundingClientRect().top > window.innerHeight * 0.8) jump();
  }, []); // mount only
  return (
    <main>
      <div className="roadhead">
        <h1 className="disp">Your care roadmap</h1>
        {here && <button type="button" className="linkbtn" onClick={jump}>Jump to this week</button>}
      </div>
      <div className="pregbar road" role="img" aria-label={`Week ${pregWeek} of 40`}><div className="pregfill" style={{ width: `${Math.min(100, (pregWeek / 40) * 100)}%` }} /></div>
      <p className="hint">The standard low-risk prenatal schedule (ACOG-style), set against your week {pregWeek}. Your provider's plan always wins.</p>
      <Advice urgency="visit" alone>{roadmapAdvice(pregWeek)}</Advice>
      <div className="card" style={{ display: "block", marginTop: 10 }}>
        <p className="rsec" style={{ margin: "0 0 4px" }}>Visit rhythm</p>
        <p style={{ fontSize: 12.5, lineHeight: 1.6 }}>Every 4 weeks until 28 · every 2 weeks from 28–36 · weekly from 36. Every visit: blood pressure, urine check, fundal height, and baby's heartbeat — BP is how preeclampsia gets caught early.</p>
      </div>
      {PRENATAL.map((g) => {
        const doneN = g.items.filter((m) => pregWeek > m.to).length;
        return (
          <div key={g.tri}>
            <p className={`rsec tri ${g.tri === curTri ? "now" : ""}`}><span>{g.tri}</span><span className="tricount">{doneN} of {g.items.length} done</span></p>
            {g.items.map((m) => {
              const done = pregWeek > m.to;
              const now = pregWeek >= m.from && pregWeek <= m.to;
              const soon = !done && !now && m.from - pregWeek > 0 && m.from - pregWeek <= 4;
              const state = now ? "now" : soon ? "soon" : done ? "done" : "later";
              const isHere = m === here;
              return (
                <div className={`shelfc ${done ? "done" : ""} ${isHere ? "now" : ""}`} key={m.label} ref={isHere ? hereRef : undefined}>
                  <div className="shead"><span className="sbrand">{prenatalWhen(m)}</span>
                    <span className={`ppill ${state}`}>{done ? <>done <Icon name="check" size={10} /></> : now ? "in window" : soon ? "coming up" : "later"}</span></div>
                  <div className="sname">{m.label}</div>
                  <p className="hint" style={{ margin: 0 }}>{m.note}</p>
                  {(now || soon) && onPlan && <button type="button" className="linkbtn plan" style={{ marginTop: 6 }} onClick={() => onPlan(m.label, prenatalWhen(m))}>Add to appointments</button>}
                </div>
              );
            })}
          </div>
        );
      })}
      <p className="rfoot">Educational schedule, not medical advice. Twins, chronic conditions, or prior complications all change it — your provider sets your actual plan.</p>
    </main>
  );
}
