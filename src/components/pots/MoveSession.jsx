import { useEffect, useRef, useState } from "react";
import { addSession, updateSession, setSessionFaint, sessionsFull, newId, nowHHMM } from "../../lib/pots.js";
import { moveState, sessionDefaults, deleteSession, MOVE_MODES, AFTER_OPTS, NEXT_OPTS, MOVE_COPY } from "../../lib/potsMove.js";
import UrgentCard, { urgentText } from "./UrgentCard.jsx";
import { Choice, CheckRow } from "./StandSafety.jsx";
import { useCue, useWakeLock } from "./StandTest.jsx";
import { symOrder } from "./PotsSymptoms.jsx";
import { numOf, numProps, addDays, symLabel, useAnnounce } from "./ui.js";

/* Movement sessions (design 4.10): the guided session timer and "Log a session I did".

   SessionRunner is the guided session. Like the stand test (StandTest.jsx), while it runs App
   renders it INSTEAD of the header chips, the tab bar and the tab content (the wordmark stays),
   as the page's single <main> with one h1: Stop and finishing are the only ways out (setup also
   has "Not today"), so nothing else can happen mid-session.
     setup -> warm (warm-up) -> main -> cool (cool-down) -> rest ("Now rest sitting or lying
     down.", the after-questions) -> Save session
     warm | main | cool --Stop--> stopped --"Save session"--> done | --Discard--> gone
   - Every length is hers: they start from her last full session and the main part from her
     plan, and the main part stays blank until she has set one (owner decision D9).
   - All timing is wall-clock (Date.now() against the part's start, less any pause); a 250 ms
     interval only redraws, so a locked screen or a backgrounded tab never skews a part. A part
     that runs out on its own hands over to the next part at the moment it ran out, not when she
     comes back: parts that ran out while she was away are chained on the wall clock, each saved
     with its full planned minutes. Only "End this part now" starts the next part at the tap.
   - The session is saved when it starts (`running`) and again at every part and every answer
     (minutes actually done, `guided`, `stopped`), and its `upd` is refreshed every few minutes
     while a part runs, so a closed app never loses it; one the app closed mid-session is marked
     stopped and interrupted at the next launch (lib/pots.js markStaleRunning).
   - At most 4 sessions a day: a fifth is refused with a message, never by dropping one.
   - In pacing mode there is no step plan, so the session has no step.
   - The red Stop sits directly under the heading and again in a sticky bar in every running
     part; inputs are never focused automatically, and each part change focuses its heading.
   - "Did you faint or nearly faint?" is asked on Stop and at the end (unless answered on Stop).
     Yes or Almost also logs a linked episode and pauses step-up options (lib/pots.js
     setSessionFaint), and Yes shows the faint urgent card, announced once.
   - Cues (a short tone made on the device, a vibration where supported) follow the stand-test
     sound setting; the screen wake lock is asked for while a part runs. No network request. */

const MIN = 60000;
const STOP_TEXT = "Stop — I need to rest";
const PARTS = ["warm", "main", "cool"];
const isPart = (ph) => PARTS.includes(ph);
const FAINT_OPTS = [["no", "No"], ["almost", "Almost"], ["yes", "Yes"]];
const HEAD = { setup: "Start a session", warm: "Warm up · easy pace", main: "Main part", cool: "Cool down · easy pace", rest: MOVE_COPY.rest };
const TIMER_LABEL = { warm: "Time left warming up", main: "Time left in the main part", cool: "Time left cooling down" };
const LINE = { warm: "Easy pace to warm up.", cool: "Easy pace to cool down." };
/** The main part's pace cue, by the session's step (ses.step; null in pacing mode): Step 1 and
    pacing mode keep the plan's full-sentences pace (MOVE_STEPS step 1) and never step it up. */
export const mainLine = (step) => (step == null || step <= 1 ? "An easy pace where you could talk in full sentences." : "A pace where you could still talk in short sentences.");
const PART_WORD = { warm: "Warm up", main: "Main part", cool: "Cool down" };
const FULL_TEXT = "You've logged 4 sessions on this day, the most Cyra keeps.";
const BEAT = 4 * MIN; // refresh a running session's upd this often (staleness is 30 minutes)
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const whole = (s, lo, hi) => { const n = numOf(s); return n != null && Number.isInteger(n) && n >= lo && n <= hi ? n : null; };

/** The minutes fields of a session she sets up or logs (warm-up and cool-down may be left
    blank, which counts as none). */
function MinutesFields({ id, v, setV, errKey }) {
  const f = (k, label) => (
    <div style={{ flex: "1 1 90px" }}>
      <label className="lab" htmlFor={`${id}-${k}`}>{label}</label>
      <input id={`${id}-${k}`} className={`inp ${errKey === k ? "inpErr" : ""}`} {...numProps()} aria-label={label} aria-invalid={errKey === k || undefined} maxLength={3} value={v[k]}
        placeholder={k === "main" ? MOVE_COPY.mainPlaceholder : undefined} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {f("warm", "Warm up (minutes)")}
      {f("main", "Main part (minutes)")}
      {f("cool", "Cool down (minutes)")}
    </div>
  );
}

/** The step a new session is at: her chosen step, or none in pacing mode (no step plan then). */
const stepFor = (p, stage) => { const st = moveState(p, stage); return st.pacing ? null : (st.program || {}).step || 1; };

/** Effort, how she feels, which symptoms got worse, and (optionally) the faint question. Every
    answer is written at once through onPatch / onFaint. */
export function EndQuestions({ id, pots, ses, onPatch, onFaint, showFaint, preg, afterLabel = "How do you feel right now?" }) {
  const top = symOrder(pots).top.slice(0, 8);
  const worse = ses.worse || [];
  const worseOpts = [...top, ...worse.filter((x) => !top.includes(x))];
  return (
    <>
      <div className="scalerow" style={{ marginTop: 12 }}>
        <div className="scalehead"><span id={`${id}-eff-l`}>Effort</span><b>{ses.effort == null ? "Not set" : ses.effort}</b></div>
        <input className="slider" type="range" min="0" max="10" value={ses.effort ?? 0} aria-label="Effort, 0 is very easy, 10 is all-out" aria-valuetext={ses.effort == null ? "Not set" : `${ses.effort} out of 10`}
          onChange={(e) => onPatch({ effort: +e.target.value })} onClick={(e) => { if (ses.effort == null) onPatch({ effort: +e.target.value }); }} />
        <div className="scaleends"><span>0 very easy</span><span>10 all-out</span></div>
      </div>
      <Choice id={`${id}-after`} label={afterLabel} value={ses.after} options={AFTER_OPTS} onPick={(v) => onPatch({ after: ses.after === v ? null : v })} />
      {ses.after >= 1 && (
        <>
          <p className="lab" id={`${id}-worse`}>Which symptoms got worse? (optional)</p>
          <div className="wrapchips" role="group" aria-labelledby={`${id}-worse`} style={{ marginBottom: 6 }}>
            {worseOpts.map((sid) => { const on = worse.includes(sid); return <button type="button" key={sid} className={`minichip big ${on ? "on" : ""}`} aria-pressed={on} onClick={() => onPatch({ worse: on ? worse.filter((x) => x !== sid) : [...worse, sid] })}>{symLabel(pots, sid)}</button>; })}
          </div>
        </>
      )}
      {showFaint && <Choice id={`${id}-faint`} label="Did you faint or nearly faint?" value={ses.faint} options={FAINT_OPTS} onPick={onFaint} />}
      {showFaint && <FaintAfter faint={ses.faint} preg={preg} />}
    </>
  );
}
/** What a faint answer shows at once: the faint urgent card for Yes, and for Yes or Almost the
    exercise line (step-up options pause until she reports being checked). */
function FaintAfter({ faint, preg }) {
  return (
    <>
      {faint === "yes" && <div style={{ marginTop: 10 }}><UrgentCard variant="faint" preg={preg} /></div>}
      {(faint === "yes" || faint === "almost") && <p className="plain" style={{ marginTop: 10 }}>{MOVE_COPY.faint}</p>}
    </>
  );
}

/* ---------- the guided session (running takeover) ---------- */
export function SessionRunner({ run, setRun, pots, setPots, stage, todayIso, ping, onEnd }) {
  const preg = stage === "preg";
  const [now, setNow] = useState(() => Date.now());
  const [live, announce] = useAnnounce();          // role="alert": the faint card when her answer shows it
  const [status, say] = useAnnounce();             // role="status": "Main part", "Cool down", ...
  const [unlockCue, cue] = useCue(pots.settings.test.cue !== false);
  const [wake, unwake, noLock] = useWakeLock();
  const h1 = useRef(null), confirmRef = useRef(null);
  const [setup, setSetup] = useState(() => { const d = sessionDefaults(pots); return { mode: d.mode, warm: String(d.warm), main: d.main == null ? "" : String(d.main), cool: String(d.cool) }; });
  const [err, setErr] = useState(null); // null | { key, text }
  const [discard, setDiscard] = useState(null); // null | { keepFaint }
  const phase = run.phase, day = run.day || todayIso;
  const ses = run.id ? ((((pots.days || {})[day] || {}).move) || []).find((x) => x.id === run.id) || null : null;
  const st = moveState(pots, stage);

  const write = (patch) => setPots((p) => updateSession(p, day, run.id, patch));
  const go = (ph, extra = {}) => setRun((r) => ({ ...r, phase: ph, phaseStart: Date.now(), paused: null, pausedMs: 0, ...extra }));
  const end = (msg) => { unwake(); onEnd(); if (msg) ping(msg); };

  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 250);
    const v = () => { if (document.visibilityState === "visible") setNow(Date.now()); };
    document.addEventListener("visibilitychange", v);
    return () => { clearInterval(h); document.removeEventListener("visibilitychange", v); };
  }, []);
  useEffect(() => { h1.current?.focus(); }, [phase]);
  useEffect(() => { if (discard) confirmRef.current?.focus(); }, [!!discard]); // eslint-disable-line
  // A session removed in another window (or a record replaced there) ends the run here.
  useEffect(() => { if (run.id && !ses) end("This session was removed in another window"); }, [run.id, !!ses]); // eslint-disable-line
  useEffect(() => { if (!isPart(phase)) unwake(); }, [phase]); // eslint-disable-line

  const plan = run.plan || { warm: 0, main: 0, cool: 0 };
  const elapsed = isPart(phase) ? (run.paused ?? now) - run.phaseStart - (run.pausedMs || 0) : 0;
  const lenMs = isPart(phase) ? plan[phase] * MIN : 0;
  const minsDone = () => Math.max(0, Math.min(plan[phase], Math.round(((run.paused ?? Date.now()) - run.phaseStart - (run.pausedMs || 0)) / MIN)));
  const nextPart = (ph) => PARTS.slice(PARTS.indexOf(ph) + 1).find((k) => plan[k] > 0) || "rest";
  const announceNext = (nx) => { say(nx === "rest" ? "Session finished. Rest now" : PART_WORD[nx]); cue(); };
  /* "End this part now": save the minutes done and start the next part (or the rest and
     after-questions) at this moment. */
  const advance = (mins) => {
    const ph = phase, nx = nextPart(ph);
    write({ [ph]: mins, ...(nx === "rest" ? { running: undefined } : {}) });
    go(nx);
    announceNext(nx);
  };
  /* Parts whose time is up move on by themselves, chained on the wall clock: the next part
     starts when the last one ran out, so after a locked screen or a hidden page every part that
     ran out meanwhile is saved with its full minutes and the current part's clock is right. */
  useEffect(() => {
    if (!isPart(phase) || !ses || run.paused) return;
    const t = Date.now(), patch = {};
    let ph = phase, at = run.phaseStart + (run.pausedMs || 0);
    while (isPart(ph) && t - at >= plan[ph] * MIN) { patch[ph] = plan[ph]; at += plan[ph] * MIN; ph = nextPart(ph); }
    if (ph === phase) return;
    if (ph === "rest") patch.running = undefined;
    write(patch);
    setRun((r) => ({ ...r, phase: ph, phaseStart: at, paused: null, pausedMs: 0 }));
    announceNext(ph);
  }); // eslint-disable-line
  // While a part runs, refresh the saved session now and then, so a relaunch can tell a running
  // session from one the app closed mid-way.
  useEffect(() => {
    if (!isPart(phase) || !run.id) return undefined;
    const h = setInterval(() => write({}), BEAT);
    return () => clearInterval(h);
  }, [phase, run.id]); // eslint-disable-line

  const start = () => {
    const warm = setup.warm.trim() === "" ? 0 : whole(setup.warm, 0, 30), main = whole(setup.main, 1, 120), cool = setup.cool.trim() === "" ? 0 : whole(setup.cool, 0, 30);
    if (!setup.mode) { setErr({ key: "mode", text: "Pick what you'll be doing." }); return; }
    if (warm == null) { setErr({ key: "warm", text: "Warm up: use 0 to 30 minutes." }); return; }
    if (main == null) { setErr({ key: "main", text: "Add how long the main part is, from 1 to 120 minutes." }); return; }
    if (cool == null) { setErr({ key: "cool", text: "Cool down: use 0 to 30 minutes." }); return; }
    if (sessionsFull(pots, todayIso)) { setErr({ key: "full", text: FULL_TEXT }); return; }
    unlockCue();
    const id = newId(), t = nowHHMM();
    setPots((p) => addSession(p, todayIso, { id, t, mode: setup.mode, step: stepFor(p, stage), warm: 0, main: 0, cool: 0, guided: true, stopped: false, effort: null, after: null, worse: [], faint: null, next: null, running: true, upd: Date.now() }));
    const first = warm > 0 ? "warm" : "main";
    go(first, { id, day: todayIso, plan: { warm, main, cool } });
    say(PART_WORD[first]);
    wake();
  };
  const stop = () => {
    write({ [phase]: minsDone(), stopped: true, after: ses && ses.after != null ? ses.after : 3, running: undefined });
    go("stopped", { stopT: nowHHMM() });
  };
  const pause = () => setRun((r) => (r.paused ? { ...r, pausedMs: (r.pausedMs || 0) + (Date.now() - r.paused), paused: null } : { ...r, paused: Date.now() }));
  const answerFaint = (v) => {
    const f = ses.faint === v ? null : v;
    setPots((p) => setSessionFaint(p, day, run.id, f, run.stopT || nowHHMM()));
    if (f === "yes") announce(urgentText("faint"));
  };

  const stopBtn = (top) => <button type="button" className={`cta stopbtn${top ? " top" : ""}`} onClick={stop}>{STOP_TEXT}</button>;
  let heading = HEAD[phase] || "Session", body;
  if (phase === "setup") {
    body = (
      <>
        <Choice id="pots-ses-mode" label="What are you doing?" value={setup.mode} options={MOVE_MODES} onPick={(v) => { setSetup((s) => ({ ...s, mode: v })); setErr(null); }} />
        {preg && setup.mode === "floor" && <p className="plain" style={{ marginTop: 8 }}>{MOVE_COPY.pregFloor}</p>}
        <p className="hint" style={{ margin: "10px 0 4px" }}>Every number is yours to change.</p>
        <MinutesFields id="pots-ses" v={setup} setV={(v) => { setSetup(v); setErr(null); }} errKey={err && err.key} />
        {st.program && st.program.hrNote && <p className="plain">{`Heart-rate range from your clinician or physio: ${st.program.hrNote}`}</p>}
        {st.paused && <p className="plain">{MOVE_COPY.faint}</p>}
        <p className="hint">Have a drink before and after.</p>
        {err && <p className="errhint" role="alert" style={{ marginTop: 0 }}>{err.text}</p>}
        <button type="button" className="cta" onClick={start}>Start</button>
        <button type="button" className="ghostbtn" onClick={() => end()}>Not today</button>
      </>
    );
  } else if (isPart(phase) && ses) {
    const nx = nextPart(phase);
    body = (
      <>
        {stopBtn(true)}
        <div className="pots-timer" role="timer" aria-label={TIMER_LABEL[phase]}>{mmss(lenMs - elapsed)}</div>
        <p className="plain" style={{ textAlign: "center" }}>{run.paused ? "Paused." : phase === "main" ? mainLine(ses.step) : LINE[phase]}</p>
        {phase === "main" && st.program && st.program.hrNote && <p className="plain" style={{ textAlign: "center" }}>{`Heart-rate range from your clinician or physio: ${st.program.hrNote}`}</p>}
        <p className="hint" style={{ textAlign: "center", margin: "0 0 10px" }}>{nx === "rest" ? "Then rest sitting or lying down." : `Then: ${PART_WORD[nx].toLowerCase()}, ${plan[nx]} min.`}</p>
        {noLock && <p className="hint" style={{ margin: "0 0 10px" }}>Keep your screen on during the session. Tap it now and then.</p>}
        <button type="button" className="ghostbtn" onClick={pause}>{run.paused ? "Resume" : "Pause"}</button>
        <button type="button" className="linkbtn" style={{ display: "block", marginTop: 10 }} onClick={() => advance(minsDone())}>End this part now</button>
      </>
    );
  } else if (phase === "rest" && ses) {
    body = (
      <>
        <EndQuestions id="pots-ses-end" pots={pots} ses={ses} preg={preg} showFaint onPatch={write} onFaint={answerFaint} />
        <button type="button" className="cta" style={{ marginTop: 16 }} onClick={() => end("Session saved. Rest if you need to.")}>Save session</button>
      </>
    );
  } else if (phase === "stopped" && ses) {
    heading = null; // the heading sits inside the role="alert" block below
    body = (
      <>
        <Choice id="pots-ses-stop-faint" label="Did you faint or nearly faint?" value={ses.faint} options={FAINT_OPTS} onPick={answerFaint} />
        <FaintAfter faint={ses.faint} preg={preg} />
        <EndQuestions id="pots-ses-stop" pots={pots} ses={ses} preg={preg} showFaint={false} onPatch={write} onFaint={answerFaint} />
        {!discard && (
          <>
            <button type="button" className="cta" style={{ marginTop: 16 }} onClick={() => end("Session saved. Rest if you need to.")}>Save session</button>
            <button type="button" className="linkbtn" style={{ display: "block", marginTop: 12 }} onClick={() => setDiscard({ keepFaint: true })}>Discard</button>
          </>
        )}
        {discard && (
          <div className="plaincard" style={{ marginTop: 14 }}>
            <p className="plain" tabIndex={-1} ref={confirmRef}>Discard this session? It's removed from your POTS log.</p>
            {(ses.faint === "yes" || ses.faint === "almost") && <CheckRow on={discard.keepFaint} onToggle={() => setDiscard((d) => ({ keepFaint: !d.keepFaint }))}>Keep the faint in my log</CheckRow>}
            <button type="button" className="cta" style={{ background: "#A04545", marginTop: 10 }} onClick={() => { const k = discard.keepFaint; setPots((p) => deleteSession(p, day, run.id, { keepFaint: k })); end("Session discarded"); }}>Discard session</button>
            <button type="button" className="ghostbtn" onClick={() => setDiscard(null)}>Keep it</button>
          </div>
        )}
      </>
    );
  } else {
    heading = "Session";
    body = <p className="plain">This session isn't on this device any more.</p>;
  }

  return (
    <main className="pots pots-run">
      <p className="sr-only" role="alert">{live}</p>
      <p className="sr-only" role="status" aria-live="polite">{status}</p>
      {phase === "stopped" && ses ? (
        <div role="alert"><h1 className="disp" tabIndex={-1} ref={h1}>{MOVE_COPY.stopped}</h1></div>
      ) : <h1 className="disp" tabIndex={-1} ref={h1}>{heading}</h1>}
      {body}
      {isPart(phase) && ses && <div className="stopbar">{stopBtn(false)}</div>}
    </main>
  );
}

/* ---------- "Log a session I did" (no timer) ---------- */
export function SessionLog({ pots, setPots, stage, todayIso, ping, announce, headRef, onDone }) {
  const preg = stage === "preg";
  const d = sessionDefaults(pots);
  const [day, setDay] = useState(todayIso);
  const [t, setT] = useState(nowHHMM());
  const [mode, setMode] = useState(d.mode);
  const [mins, setMins] = useState({ warm: "", main: "", cool: "" });
  const [ses, setSes] = useState({ effort: null, after: null, worse: [], faint: null });
  const [err, setErr] = useState(null);
  const min = addDays(todayIso, -30);
  const pickFaint = (v) => { const f = ses.faint === v ? null : v; setSes((x) => ({ ...x, faint: f })); if (f === "yes") announce(urgentText("faint")); };
  const save = () => {
    const warm = mins.warm.trim() === "" ? 0 : whole(mins.warm, 0, 30), main = whole(mins.main, 0, 120), cool = mins.cool.trim() === "" ? 0 : whole(mins.cool, 0, 30);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > todayIso || day < min) { setErr({ key: "day", text: "Pick a day in the last 30 days." }); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) { setErr({ key: "t", text: "Add the time it started." }); return; }
    if (!mode) { setErr({ key: "mode", text: "Pick what you did." }); return; }
    if (warm == null) { setErr({ key: "warm", text: "Warm up: use 0 to 30 minutes." }); return; }
    if (main == null) { setErr({ key: "main", text: "Add how long the main part was, from 0 to 120 minutes." }); return; }
    if (cool == null) { setErr({ key: "cool", text: "Cool down: use 0 to 30 minutes." }); return; }
    if (sessionsFull(pots, day)) { setErr({ key: "full", text: FULL_TEXT }); return; }
    const id = newId();
    setPots((p) => {
      let q = addSession(p, day, { id, t, mode, step: stepFor(p, stage), warm, main, cool, guided: false, stopped: false, effort: ses.effort, after: ses.after, worse: ses.worse, faint: null, next: null });
      if (ses.faint) q = setSessionFaint(q, day, id, ses.faint, t);
      return q;
    });
    ping("Session saved.");
    onDone(true);
  };
  return (
    <section aria-labelledby="pots-mlog-h">
      <h2 className="obq" id="pots-mlog-h" tabIndex={-1} ref={headRef}>Log a session I did</h2>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 150px" }}>
          <label className="lab" htmlFor="pots-mlog-day">Day</label>
          <input id="pots-mlog-day" className={`inp ${err && err.key === "day" ? "inpErr" : ""}`} type="date" aria-label="Day of the session" min={min} max={todayIso} value={day} onChange={(e) => { setDay(e.target.value); setErr(null); }} />
        </div>
        <div style={{ flex: "1 1 120px" }}>
          <label className="lab" htmlFor="pots-mlog-t">Time it started</label>
          <input id="pots-mlog-t" className={`inp ${err && err.key === "t" ? "inpErr" : ""}`} type="time" aria-label="Time it started" value={t} onChange={(e) => { setT(e.target.value); setErr(null); }} />
        </div>
      </div>
      <Choice id="pots-mlog-mode" label="What did you do?" value={mode} options={MOVE_MODES} onPick={(v) => { setMode(v); setErr(null); }} />
      {preg && mode === "floor" && <p className="plain" style={{ marginTop: 8 }}>{MOVE_COPY.pregFloor}</p>}
      <div style={{ marginTop: 10 }}><MinutesFields id="pots-mlog" v={mins} setV={(v) => { setMins(v); setErr(null); }} errKey={err && err.key} /></div>
      <EndQuestions id="pots-mlog-end" pots={pots} ses={ses} preg={preg} showFaint afterLabel="How did you feel right after?" onPatch={(patch) => setSes((x) => ({ ...x, ...patch }))} onFaint={pickFaint} />
      {err && <p className="errhint" role="alert" style={{ marginTop: 10 }}>{err.text}</p>}
      <button type="button" className="cta" style={{ marginTop: 14 }} onClick={save}>Save session</button>
      <button type="button" className="ghostbtn" onClick={() => onDone(false)}>Cancel</button>
    </section>
  );
}

/* ---------- Today's log → Edit on a session ---------- */
/** Correct a saved session: what she did, the minutes, effort, how she felt right after, which
    symptoms got worse, the faint answer and (for an earlier day) how she felt the next day. A
    draft until "Save changes"; a changed faint answer goes through setSessionFaint, so its
    linked episode and the step-up pause follow it. */
export function SessionEdit({ pots, setPots, ses: s0, day, todayIso, preg, announce, headRef, onDone }) {
  const [mode, setMode] = useState(s0.mode);
  const [mins, setMins] = useState({ warm: String(s0.warm ?? 0), main: String(s0.main ?? 0), cool: String(s0.cool ?? 0) });
  const [ses, setSes] = useState({ effort: s0.effort ?? null, after: s0.after ?? null, worse: s0.worse || [], faint: s0.faint ?? null });
  const [next, setNext] = useState(s0.next ?? null);
  const [err, setErr] = useState(null);
  const pickFaint = (v) => { const f = ses.faint === v ? null : v; setSes((x) => ({ ...x, faint: f })); if (f === "yes") announce(urgentText("faint")); };
  const save = () => {
    const warm = mins.warm.trim() === "" ? 0 : whole(mins.warm, 0, 30), main = whole(mins.main, 0, 120), cool = mins.cool.trim() === "" ? 0 : whole(mins.cool, 0, 30);
    if (warm == null) { setErr({ key: "warm", text: "Warm up: use 0 to 30 minutes." }); return; }
    if (main == null) { setErr({ key: "main", text: "Add how long the main part was, from 0 to 120 minutes." }); return; }
    if (cool == null) { setErr({ key: "cool", text: "Cool down: use 0 to 30 minutes." }); return; }
    const patch = { mode: mode || s0.mode, warm, main, cool, effort: ses.effort, after: ses.after, worse: ses.worse, next, ...(next != null ? { nextSkip: undefined } : {}) };
    setPots((p) => {
      let q = updateSession(p, day, s0.id, patch);
      const cur = ((((q.days || {})[day] || {}).move) || []).find((x) => x.id === s0.id);
      if (cur && (cur.faint ?? null) !== ses.faint) q = setSessionFaint(q, day, s0.id, ses.faint, s0.t);
      return q;
    });
    onDone(true);
  };
  return (
    <section aria-labelledby="pots-sedit-h">
      <h2 className="obq" id="pots-sedit-h" tabIndex={-1} ref={headRef}>{`Session at ${s0.t}`}</h2>
      {s0.interrupted && <p className="hint">The app closed during this session, so it ended early.</p>}
      <Choice id="pots-sedit-mode" label="What did you do?" value={mode} options={MOVE_MODES} onPick={(v) => { setMode(v); setErr(null); }} />
      {preg && mode === "floor" && <p className="plain" style={{ marginTop: 8 }}>{MOVE_COPY.pregFloor}</p>}
      <div style={{ marginTop: 10 }}><MinutesFields id="pots-sedit" v={mins} setV={(v) => { setMins(v); setErr(null); }} errKey={err && err.key} /></div>
      <EndQuestions id="pots-sedit-end" pots={pots} ses={ses} preg={preg} showFaint afterLabel="How did you feel right after?" onPatch={(patch) => setSes((x) => ({ ...x, ...patch }))} onFaint={pickFaint} />
      {day < todayIso && <Choice id="pots-sedit-next" label="How did you feel the next day?" value={next} options={NEXT_OPTS} onPick={(v) => setNext((x) => (x === v ? null : v))} />}
      {err && <p className="errhint" role="alert" style={{ marginTop: 10 }}>{err.text}</p>}
      <button type="button" className="cta" style={{ marginTop: 14 }} onClick={save}>Save changes</button>
      <button type="button" className="ghostbtn" onClick={() => onDone(false)}>Cancel</button>
    </section>
  );
}
