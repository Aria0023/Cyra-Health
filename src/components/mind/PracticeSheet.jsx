import { useEffect, useRef, useState } from "react";
import { Sheet } from "../ui/index.js";
import Icon from "../Icon.jsx";
import BreathOrb from "./BreathOrb.jsx";
import { practiceAt, practiceSeconds, sourcesOf, STRENGTH, needLabel } from "../../lib/mind.js";

/* One practice (calm R5): the guided run and what the evidence says, in one sheet. The orb (BreathOrb) leads; under it
   the phase word or the step, a timer, then Start → Pause / Resume and Stop. At the end she can say whether it helped
   (stored with the run on this device). Accessibility: the sheet's heading takes focus on open (Sheet); the Start
   button keeps focus as it becomes Pause; a polite live region announces each change of phase or step (not each
   second); the timer is role="timer"; at the end focus moves to "Did that help?". The run pauses when the app is
   hidden. Haptics: `buzz` (a function, or null when this device can't vibrate) is called at each change while
   `haptics` is on. Nothing here is sent anywhere.

   Props: practice; need (the need it was opened from, for the eyebrow); fav, onFav; haptics, onHaptics, buzz;
   onRun({ sec, done }) → run id (App saves the run when it ends: finished, or stopped after 10 seconds or more);
   onHelped(runId, "yes" | "no"); onClose. */
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;
export default function PracticeSheet({ practice: p, need = null, fav = false, onFav, haptics = false, onHaptics, buzz = null, onRun, onHelped, onClose }) {
  const total = practiceSeconds(p);
  const [status, setStatus] = useState("ready"); // ready | running | paused | done
  const [elapsed, setElapsed] = useState(0); // ms
  const [runId, setRunId] = useState(null);
  const [helped, setHelpedState] = useState(null);
  const base = useRef(0), since = useRef(0), saved = useRef(false), helpRef = useRef(null);
  const at = practiceAt(p, elapsed / 1000);
  const key = status === "running" || status === "paused" ? `${at.idx}:${at.cycle ?? 0}` : status;

  useEffect(() => {
    if (status !== "running") return undefined;
    const id = setInterval(() => setElapsed(base.current + (Date.now() - since.current)), 200);
    return () => clearInterval(id);
  }, [status]);
  useEffect(() => { if (status === "running" && at.done) finish(true); });
  // A change of phase or step: one gentle vibration, if she turned it on.
  const lastKey = useRef("");
  useEffect(() => { if (status === "running" && key !== lastKey.current) { lastKey.current = key; if (haptics && buzz) buzz(); } }, [key, status]);
  // Hidden app → pause.
  useEffect(() => {
    const onVis = () => { if (document.hidden && status === "running") pause(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  });
  useEffect(() => { if (status === "done") requestAnimationFrame(() => helpRef.current?.focus()); }, [status]);
  // Closing mid-run keeps a run of 10 seconds or more (not finished).
  useEffect(() => () => { if (!saved.current && base.current + (since.current ? Date.now() - since.current : 0) >= 10000) onRun?.({ sec: Math.round((base.current + (since.current ? Date.now() - since.current : 0)) / 1000), done: false }); }, []);

  const start = () => { base.current = 0; since.current = Date.now(); saved.current = false; setElapsed(0); setHelpedState(null); setStatus("running"); };
  function pause() { base.current += Date.now() - since.current; since.current = 0; setElapsed(base.current); setStatus("paused"); }
  const resume = () => { since.current = Date.now(); setStatus("running"); };
  function finish(done) {
    const ms = base.current + (since.current ? Date.now() - since.current : 0);
    base.current = done ? total * 1000 : ms; since.current = 0;
    if (!saved.current && (done || ms >= 10000)) { saved.current = true; setRunId(onRun?.({ sec: Math.round(Math.min(ms, total * 1000) / 1000), done }) || null); }
    if (done) { setElapsed(total * 1000); setStatus("done"); } else { onClose?.(); }
  }
  const answer = (v) => { setHelpedState(v); if (runId) onHelped?.(runId, v); };

  const live = status === "running" || status === "paused";
  const orbPhase = !live ? (status === "done" ? "out" : "idle") : p.kind === "breath" ? at.phase : "step";
  const left = live ? total - Math.floor(elapsed / 1000) : status === "done" ? 0 : total;
  const word = !live ? (status === "done" ? "Done" : `${p.min} min`) : p.kind === "breath" ? at.word : `Step ${at.idx + 1} of ${p.steps.length}`;
  const announce = status === "running" ? (p.kind === "breath" ? at.word : at.text) : status === "paused" ? "Paused" : status === "done" ? "Done." : "";
  const srcs = sourcesOf(p);
  return (
    <Sheet id="practice-sheet" title={p.title} onClose={() => (live ? finish(false) : onClose?.())} closeLabel="Close practice" className="practicesheet">
      <p className="eyebrow psh-eye">{need ? `${needLabel(need)} · ` : ""}{p.min} minutes</p>
      <div className="psh-stage">
        <BreathOrb phase={orbPhase} dur={live ? (status === "paused" ? 0.4 : at.dur) : 1.2} progress={total ? Math.min(1, elapsed / 1000 / total) : 0}>
          <span className="orb-word serif">{word}</span>
          {live && p.kind === "breath" && <span className="orb-count" aria-hidden="true">{at.left}</span>}
          {status === "paused" && <span className="orb-paused">Paused</span>}
        </BreathOrb>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announce}</p>
      {p.kind === "steps" && <p className={`psh-step serif${live ? "" : " idle"}`}>{live ? at.text : status === "done" ? "Take a moment before you go on." : p.short}</p>}
      {p.kind === "breath" && !live && <p className="psh-step idle">{status === "done" ? "Take a moment before you go on." : p.short}</p>}
      <p className="psh-timer" role="timer" aria-label={`Time left ${mmss(left)}`}>{mmss(left)}</p>
      {status !== "done" ? (
        <div className="psh-ctrls">
          {/* One button that changes its job, so focus stays on it from Start to Pause to Resume. */}
          <button type="button" className="cta psh-go" onClick={status === "ready" ? start : status === "running" ? pause : resume}>
            <Icon name={status === "running" ? "pause" : "play"} size={16} />{status === "ready" ? "Start" : status === "running" ? "Pause" : "Resume"}
          </button>
          {live && <button type="button" className="ghostbtn psh-stop" onClick={() => finish(false)}><Icon name="stop" size={14} />Stop</button>}
        </div>
      ) : (
        <div className="psh-done" role="group" aria-labelledby="psh-help">
          <h3 id="psh-help" ref={helpRef} tabIndex={-1} className="psh-help serif">Did that help?</h3>
          <div className="psh-helpbtns">
            <button type="button" className={`mc ${helped === "yes" ? "on" : ""}`} aria-pressed={helped === "yes"} onClick={() => answer("yes")}>It helped</button>
            <button type="button" className={`mc ${helped === "no" ? "on" : ""}`} aria-pressed={helped === "no"} onClick={() => answer("no")}>Not this time</button>
          </div>
          <p className="hint psh-helpnote">Your answer stays on this device. Cyra suggests what helps you more often.</p>
          <button type="button" className="ghostbtn psh-again" onClick={start}>Again</button>
        </div>
      )}
      {p.caution && <p className="psh-caution"><Icon name="heart" size={14} />{p.caution}</p>}
      <div className="psh-tools">
        <button type="button" className={`psh-tool${fav ? " on" : ""}`} aria-pressed={fav} onClick={onFav}><Icon name="star" size={16} />Favourite</button>
        {buzz && <button type="button" className={`psh-tool${haptics ? " on" : ""}`} aria-pressed={haptics} onClick={onHaptics}><Icon name="pulse" size={16} />Gentle vibration</button>}
      </div>
      <section className="psh-ev" aria-labelledby="psh-ev-t">
        <div className="psh-evhead"><h3 id="psh-ev-t" className="psh-evtitle">What the evidence says</h3><span className={`psh-strength s-${p.strength}`}>{STRENGTH[p.strength]}</span></div>
        <p className="psh-evtext">{p.evidence}</p>
        {srcs.length > 0 && (
          <ul className="psh-srcs" aria-label="Sources">
            {srcs.map((s) => <li key={s.title}><b>{s.title}.</b> {s.body} {s.year}.</li>)}
          </ul>
        )}
        <p className="psh-line">{p.line}</p>
      </section>
    </Sheet>
  );
}
