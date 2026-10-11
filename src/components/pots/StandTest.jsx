import { useEffect, useRef, useState } from "react";
import {
  upsertTest, deleteTest, setTestFaint, setSettings, addVitals, addTilt, markStaleRunning, interruptFor, dayTotals,
  restChecks, standChecks, bpAsked, savedUpTo, testTrend, median, newId, nowHHMM,
} from "../../lib/pots.js";
import { RUNNER_FEEL, SAFETY_COPY, THRESH } from "../../lib/potsConstants.js";
import UrgentCard, { urgentText } from "./UrgentCard.jsx";
import { StandSafety, StandSetup, Choice, CheckRow, methodDefaults } from "./StandSafety.jsx";
import StandResult, { EditReadings, resultFor, riseText, riseShown, methodWord } from "./StandResult.jsx";
import { TrendChart, fmtN } from "./HrChart.jsx";
import { TiltForm, TiltList } from "./TiltNotes.jsx";
import VitalsForm from "./VitalsForm.jsx";
import { numOf, numProps, addDays, useAnnounce } from "./ui.js";

/* The guided standing test (design 4.8; spec A13.4).

   StandRunner is the test itself. While it runs, App renders it INSTEAD of the header chips,
   the tab bar and the tab content (the wordmark stays), as the page's single <main> with one h1,
   so a tab switch, Settings, a restore, a wipe or a stage change can't happen mid-test: Stop and
   finishing are the only ways out (safety and setup also have "Not today").

   State machine (potsRun in App, UI only, never saved):
     safety -> setup -> rest (lying readings due at restMin-1 and restMin) -> stand ("I'm up")
     -> up (readings due at 1, 3, 5, 10 or every minute) -> finish -> result -> Done
     rest | stand | up --Stop--> stopped --"Save what I have"--> result | --Discard--> gone
   - All timing is wall-clock (Date.now() against phaseStart / standAt); a 250 ms interval only
     redraws, and coming back to the page recomputes everything, so a locked screen or a
     backgrounded tab never skews a reading. Missed checkpoints simply queue as due cards.
   - The test is saved (status "running") when resting starts and again on every reading, with a
     fresh `upd`, plus a heartbeat every 5 minutes while she waits, so another window never takes a
     live test for a dead one. Stop saves it as "stopped" at once; finishing saves "done".
   - Inputs are never focused automatically (a soft keyboard would cover the bottom Stop bar):
     each phase change focuses the phase heading, and a reading that comes due focuses its card's
     heading, never a field, and never while she is typing in one.
   - Live safety interrupts come from lib/pots.js interruptFor and work with blood pressure off.
     A card appears with role="alert" and Stop first; Chest pain goes straight to Stopped with
     the chest card first.
   - Cues: a short tone generated on the device with WebAudio (no file, no network) and a 200 ms
     vibration where the phone supports it, both only while settings.test.cue is on. The screen
     wake lock is asked for while resting and standing; if the browser doesn't give one, a hint
     says to keep the screen on. Nothing here makes a network request.

   StandSection is the Stand test section of the POTS tab: the last result, Start, single
   readings, tilt-table notes, the test list (Open, Edit readings, Edit note, Delete), tests over
   time, and the information-only card for a test running in another window. */

const MIN = 60000;
const STALE = THRESH.staleMin * MIN;
const LATE_SEC = 45;            // a reading entered later than this keeps its true time, and says so
const NUDGE_MS = 2 * MIN;       // "Still lying down?" after 2 minutes at the stand prompt
const HEARTBEAT = 5 * MIN;      // keeps a waiting test from looking stale to another window
const COUNT_MS = 15000;         // "Count for 15 seconds"
const STOP_TEXT = "Stop — I need to sit or lie down";
const R = THRESH.range;
const bad = (v, [lo, hi]) => v != null && (v < lo || v > hi);
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const mmssUp = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const shortDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const byMin = (a, b) => a.min - b.min;
const isRunning = (ph) => ph === "rest" || ph === "stand" || ph === "up";

/* ---------- small device helpers (all on the device; the movement session runner,
   MoveSession.jsx, uses them too) ---------- */
export function useCue(enabled) {
  const ctx = useRef(null);
  const unlock = () => {
    if (!enabled || ctx.current) return;
    try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx.current = new AC(); } catch { ctx.current = null; }
  };
  const play = () => {
    if (!enabled) return;
    try {
      const c = ctx.current;
      if (c) {
        const o = c.createOscillator(), g = c.createGain();
        o.type = "sine"; o.frequency.value = 880; g.gain.value = 0.08;
        o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.18);
      }
    } catch { /* no sound on this device */ }
    try { navigator.vibrate?.(200); } catch { /* no vibration on this device */ }
  };
  useEffect(() => () => { try { ctx.current?.close(); } catch { /* already closed */ } }, []);
  return [unlock, play];
}
export function useWakeLock() {
  const lock = useRef(null), want = useRef(false);
  const [noLock, setNoLock] = useState(false);
  const request = async () => {
    want.current = true;
    try {
      if (!navigator.wakeLock?.request) { setNoLock(true); return; }
      if (lock.current && !lock.current.released) return;
      lock.current = await navigator.wakeLock.request("screen");
      setNoLock(false);
    } catch { setNoLock(true); }
  };
  const release = () => { want.current = false; try { lock.current?.release(); } catch { /* gone */ } lock.current = null; };
  useEffect(() => {
    const v = () => { if (document.visibilityState === "visible" && want.current) request(); };
    document.addEventListener("visibilitychange", v);
    return () => { document.removeEventListener("visibilitychange", v); release(); };
  }, []); // eslint-disable-line
  return [request, release, noLock];
}

/* ---------- a reading that has come due ---------- */
function DueCard({ card, bp, standAt, now, onSave, onSkip, onFeel, headRef, over }) {
  const up = card.pos === "up";
  const [hr, setHr] = useState(""), [sys, setSys] = useState(""), [dia, setDia] = useState("");
  const [counted, setCounted] = useState(false);
  const [count, setCount] = useState(null); // null | { endAt } | "ask"
  const [beats, setBeats] = useState("");
  const [feel, setFeel] = useState([]);
  const added = useRef(new Set()); // chips this card wrote into test.feel (so turning one off undoes only its own)
  const [err, setErr] = useState("");
  const n = { hr: numOf(hr), sys: bp ? numOf(sys) : null, dia: bp ? numOf(dia) : null };
  const b = { hr: bad(n.hr, R.hr), sys: bad(n.sys, R.sys), dia: bad(n.dia, R.dia) };
  useEffect(() => { if (count && count !== "ask" && now >= count.endAt) setCount("ask"); }, [now, count]);
  const late = now - card.dueAt > LATE_SEC * 1000;
  const id = `pots-due-${card.key}`;
  const title = up ? `Minute ${card.min} reading` : "Lying heart rate";
  const field = (k, label, val, set) => (
    <>
      <label className="lab" htmlFor={`${id}-${k}`}>{label}</label>
      <input id={`${id}-${k}`} className={`inp ${b[k] ? "inpErr" : ""}`} {...numProps()} style={k === "hr" ? { minHeight: 56, fontSize: 18 } : undefined}
        aria-label={label} aria-invalid={b[k] || undefined} aria-describedby={b[k] ? `${id}-${k}-err` : undefined} value={val}
        onChange={(e) => { set(e.target.value); setErr(""); if (k === "hr") setCounted(false); }} />
      {b[k] && <p className="errhint" id={`${id}-${k}-err`} style={{ marginTop: 0, marginBottom: 10 }}>That looks unusual. Check the number?</p>}
    </>
  );
  const save = () => {
    if (b.hr || b.sys || b.dia) { setErr("Fix or clear the unusual number, or skip this one."); onSave(null, n); return; }
    if (n.hr == null && n.sys == null && n.dia == null) { setErr(up ? "Add a heart rate, or tap Skip this one." : "Add a heart rate, or tap Skip."); return; }
    const r = (x) => (x == null ? null : Math.round(x));
    const reading = { min: card.min, hr: r(n.hr), sys: r(n.sys), dia: r(n.dia), ...(counted && n.hr != null ? { how: "counted" } : {}) };
    onSave(up ? { ...reading, atSec: Math.round((Date.now() - standAt) / 1000), feel } : reading);
  };
  /* A chip is recorded in the test's feel the moment it is turned on (design 4.8.5), so it is
     kept even if this reading is then skipped, or the test is stopped from here. */
  const toggleFeel = (fid) => {
    const on = !feel.includes(fid);
    setFeel(on ? [...feel, fid] : feel.filter((x) => x !== fid));
    if (on) { if (onFeel(fid, true)) added.current.add(fid); } else if (added.current.has(fid)) { added.current.delete(fid); onFeel(fid, false); }
  };
  return (
    <section className="plaincard" aria-labelledby={`${id}-h`} style={{ marginBottom: 12 }}>
      <h2 className="obq" id={`${id}-h`} tabIndex={-1} ref={headRef}>{title}</h2>
      {!up && <p className="hint" style={{ margin: "0 0 6px" }}>{`Rest minute ${card.min}. Stay lying down.`}</p>}
      {over && <p className="plain" style={{ margin: "0 0 6px" }}>{`If you took the minute ${card.min} reading before you sat down, add it now. Otherwise skip it.`}</p>}
      {/* Only upright readings store the time they were entered (atSec), so only they say so. */}
      {up && late && <p className="hint" style={{ margin: "0 0 6px" }}>That's fine. Cyra notes the time you entered it.</p>}
      {field("hr", "Heart rate (beats per minute)", hr, setHr)}
      {counted && n.hr != null && <p className="hint" style={{ margin: "0 0 8px" }}>Counted for 15 seconds, times 4.</p>}
      {bp && (
        <>
          <p className="hint" style={{ margin: "0 0 4px" }}>Keep the cuff arm supported at heart height.</p>
          {field("sys", "Top number (systolic)", sys, setSys)}
          {field("dia", "Bottom number (diastolic)", dia, setDia)}
        </>
      )}
      {count === null && <button type="button" className="linkbtn" style={{ display: "block", margin: "0 0 10px" }} onClick={() => setCount({ endAt: Date.now() + COUNT_MS })}>No device? Count for 15 seconds</button>}
      {count && count !== "ask" && (
        <div style={{ margin: "0 0 10px" }}>
          <p className="plain" style={{ marginBottom: 4 }}>Count your pulse until the timer ends.</p>
          <div className="pots-timer" role="timer" aria-label="Counting time left" style={{ fontSize: 34 }}>{mmss(count.endAt - now)}</div>
        </div>
      )}
      {count === "ask" && (
        <div style={{ margin: "0 0 10px" }}>
          <label className="lab" htmlFor={`${id}-beats`}>How many beats did you count?</label>
          <input id={`${id}-beats`} className="inp" {...numProps()} aria-label="How many beats did you count?" value={beats} onChange={(e) => setBeats(e.target.value)} />
          <div className="wearbtns">
            <button type="button" className="sbtn" onClick={() => { const c = numOf(beats); if (c != null && c > 0) { setHr(String(Math.round(c * 4))); setCounted(true); setErr(""); } setCount(null); setBeats(""); }}>Use this count</button>
            <button type="button" className="sbtn" onClick={() => { setCount(null); setBeats(""); }}>Cancel</button>
          </div>
        </div>
      )}
      {up && (
        <>
          <p className="lab" id={`${id}-feel`}>How do you feel?</p>
          <div className="wrapchips" role="group" aria-labelledby={`${id}-feel`} style={{ marginBottom: 10 }}>
            {RUNNER_FEEL.map((f) => <button type="button" key={f.id} className={`minichip big ${feel.includes(f.id) ? "on" : ""}`} aria-pressed={feel.includes(f.id)} onClick={() => toggleFeel(f.id)}>{f.label}</button>)}
          </div>
        </>
      )}
      {err && <p className="errhint" role="alert" style={{ marginTop: 0, marginBottom: 10 }}>{err}</p>}
      <button type="button" className="cta" onClick={save}>Save reading</button>
      <button type="button" className="linkbtn" style={{ display: "block", marginTop: 10 }} onClick={onSkip}>{up ? "Skip this one" : "Skip"}</button>
    </section>
  );
}

/* ---------- the runner ---------- */
export function StandRunner({ run, setRun, pots, setPots, stage, todayIso, ping, onEnd, cyc = null }) {
  const preg = stage === "preg";
  const st = pots.settings.test;
  const [now, setNow] = useState(() => Date.now());
  const [live, announce] = useAnnounce();         // role="alert": urgent cards that appear because of an answer
  const [status, say] = useAnnounce();            // role="status": "Lying reading due", "Stand up now", ...
  const [unlockCue, cue] = useCue(st.cue !== false);
  const [wake, unwake, noLock] = useWakeLock();
  const h1 = useRef(null), cardHead = useRef(null), confirmRef = useRef(null);
  const [full] = useState(() => !st.safetySeen || st.safetySeen < addDays(todayIso, -90));
  const [setup, setSetup] = useState(() => ({ method: st.method === "lean" ? "lean" : "stand", restMin: st.restMin === 10 ? 10 : 5, sched: st.sched === "every" ? "every" : "1-3-5-10", bp: st.bp === true, device: st.device || null }));
  const [ctx, setCtx] = useState({ meds: null, rateMed: null, comp: null, ate2h: null });
  const [discard, setDiscard] = useState(null); // null | { keepFaint }
  const [note, setNote] = useState("");
  const phase = run.phase;
  const test = run.id && Array.isArray(pots.tests) ? pots.tests.find((x) => x.id === run.id) || null : null;

  /* Saved writes go through lib/pots.js on the stored copy of this test. */
  const writeTest = (fn) => setPots((p) => { const t = Array.isArray(p.tests) ? p.tests.find((x) => x.id === run.id) : null; return t ? upsertTest(p, fn(t)) : p; });
  const go = (ph, extra = {}) => setRun((r) => ({ ...r, phase: ph, phaseStart: Date.now(), ...extra }));
  const end = (msg) => { unwake(); onEnd(); if (msg) ping(msg); };

  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 250);
    const v = () => { if (document.visibilityState === "visible") setNow(Date.now()); };
    document.addEventListener("visibilitychange", v);
    return () => { clearInterval(h); document.removeEventListener("visibilitychange", v); };
  }, []);
  // The full safety screen records when it was shown (the short one comes for 90 days after).
  useEffect(() => { if (full) setPots((p) => setSettings(p, { test: { safetySeen: todayIso } })); }, []); // eslint-disable-line
  // Each phase change focuses the phase heading (never an input).
  useEffect(() => { h1.current?.focus(); }, [phase]);
  // The Discard confirm takes focus once, when it opens (never again on a redraw).
  useEffect(() => { if (discard) confirmRef.current?.focus(); }, [!!discard]); // eslint-disable-line
  // A dismissed safety card hands focus to the open reading card, or else the phase heading,
  // so focus never drops to the page.
  useEffect(() => { if (run.focusTok) (cardHead.current || h1.current)?.focus(); }, [run.focusTok]); // eslint-disable-line
  // A test removed in another window (or a record replaced there) ends the run here.
  useEffect(() => { if (run.id && !test) end("This test was removed in another window"); }, [run.id, !!test]); // eslint-disable-line
  // Heartbeat while she waits: keeps upd fresh so another window shows the "running" card.
  useEffect(() => {
    if (!isRunning(phase)) return undefined;
    const h = setInterval(() => writeTest((t) => t), HEARTBEAT);
    return () => clearInterval(h);
  }, [phase, run.id]); // eslint-disable-line
  // Release the wake lock once standing is over.
  useEffect(() => { if (!isRunning(phase)) unwake(); }, [phase]); // eslint-disable-line

  /* Checkpoints due now, oldest first; the first is the card on screen, the rest queue. */
  const checks = !test ? []
    : phase === "rest" ? restChecks(test.restMin).map((m) => ({ key: `r${m}`, pos: "rest", min: m, dueAt: run.phaseStart + m * MIN }))
    : phase === "up" ? standChecks(test.sched).map((m) => ({ key: `u${m}`, pos: "up", min: m, dueAt: run.standAt + m * MIN }))
    : [];
  const due = checks.filter((c) => now >= c.dueAt && !run.done.includes(c.key));
  const card = due[0] || null;
  const upMs = run.standAt ? now - run.standAt : 0;
  // The test ends at 10:30 upright (A13.4 hard stop): she is told to sit down, and a reading
  // still open then can be added (if she took it while standing) or skipped.
  const over = phase === "up" && upMs >= THRESH.upMaxMin * MIN;

  /* Phase transitions and "came due" events. A safety card that is still open holds the
     phase where it is: the card stays on screen until she answers it (Stop, continue or
     Recheck), even when it came from the last reading of the phase. */
  const seen = useRef(new Set());
  useEffect(() => {
    if (!test) return;
    for (const c of due) {
      if (seen.current.has(c.key)) continue;
      seen.current.add(c.key);
      say(c.pos === "rest" ? "Lying reading due" : `Minute ${c.min} reading`);
      cue();
    }
    if (over && !seen.current.has("over")) { seen.current.add("over"); if (due.length) { say("Time's up, sit down now"); cue(); } }
    if (run.interrupt) return;
    if (phase === "rest" && checks.length && checks.every((c) => run.done.includes(c.key))) {
      go("stand"); say("Stand up now"); cue();
    } else if (phase === "up" && checks.length) {
      const last = checks[checks.length - 1];
      if (run.done.includes(last.key) || (over && !due.length)) finish();
    }
  }); // eslint-disable-line
  // A card that comes due takes focus on its heading, unless she is typing somewhere.
  const prevCard = useRef(null);
  useEffect(() => {
    const typing = document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);
    if (card && card.key !== prevCard.current && !typing) cardHead.current?.focus();
    else if (!card && prevCard.current && !typing) h1.current?.focus();
    prevCard.current = card ? card.key : null;
  }, [card && card.key]); // eslint-disable-line

  const markDone = (key) => setRun((r) => ({ ...r, done: r.done.includes(key) ? r.done : [...r.done, key] }));
  const showInterrupt = (ev, key = null) => {
    if (!ev) return;
    if (ev.stop) { stop({ chest: true }); return; }
    setRun((r) => ({ ...r, interrupt: { kind: ev.kind, copy: ev.copy, buttons: ev.buttons, key } }));
  };
  const stop = ({ chest = false, why = null } = {}) => {
    const at = run.standAt ? Math.min(15, Math.round(((Date.now() - run.standAt) / MIN) * 10) / 10) : 0;
    writeTest((t) => ({ ...t, status: "stopped", stoppedAt: at, why: chest ? "symptoms" : why || t.why }));
    go("stopped", { interrupt: null, chest, stopT: nowHHMM() });
    if (chest) announce(SAFETY_COPY.urgent.chest);
  };
  const finish = () => {
    writeTest((t) => ({ ...t, status: "done" }));
    go("finish", { stopT: nowHHMM() });
    say("Test finished"); cue();
  };
  const startResting = () => {
    unlockCue();
    const id = newId(), t = nowHHMM();
    const { method, restMin, sched, bp, device } = setup;
    const mlBefore = dayTotals(pots, todayIso).fluidMl;
    const test0 = {
      id, date: todayIso, t, method, restPos: preg ? "left" : "back", restMin, sched, bp, device,
      ctx: { ...ctx, mlBefore }, rest: [], up: [], feel: [], pooling: null, status: "running", stoppedAt: null, why: null, fainted: null, after: null, note: "", edited: false,
    };
    setPots((p) => upsertTest(setSettings(p, { test: { method, restMin, sched, bp, device } }), test0));
    go("rest", { id, done: [], interrupt: null });
    wake();
  };
  const saveReading = (c, reading, typed) => {
    // A value past the input range isn't saved, but a real extreme reading still raises its card.
    if (!reading) { showInterrupt(interruptFor(test, { type: "reading", reading: { ...typed, min: c.min }, pos: c.pos }), c.key); return; }
    const list = c.pos === "rest" ? "rest" : "up";
    const others = { ...test, [list]: (test[list] || []).filter((x) => x.min !== c.min) };
    const ev = interruptFor(others, { type: "reading", reading, pos: c.pos });
    writeTest((t) => ({ ...t, [list]: [...(t[list] || []).filter((x) => x.min !== c.min), reading].sort(byMin) }));
    markDone(c.key);
    showInterrupt(ev, c.key);
  };
  const toggleTestFeel = (fid) => {
    const on = !(test.feel || []).includes(fid);
    writeTest((t) => ({ ...t, feel: on ? [...(t.feel || []), fid] : (t.feel || []).filter((x) => x !== fid) }));
    if (on) showInterrupt(interruptFor(test, { type: "feel", id: fid, pos: phase === "up" ? "up" : "rest" }));
  };
  /* A chip on a due card: written to test.feel at once (and onto the reading when it's saved),
     then any safety card. Returns whether it added the id (it was not already in test.feel). */
  const cardFeel = (fid, on) => {
    const had = (test.feel || []).includes(fid);
    if (on && !had) writeTest((t) => ((t.feel || []).includes(fid) ? t : { ...t, feel: [...(t.feel || []), fid] }));
    if (!on) writeTest((t) => ({ ...t, feel: (t.feel || []).filter((x) => x !== fid) }));
    if (on) showInterrupt(interruptFor(test, { type: "feel", id: fid, pos: "up" }));
    return on && !had;
  };
  const answerFaint = (v) => {
    const f = test.fainted === v ? null : v;
    setPots((p) => setTestFaint(p, run.id, f, run.stopT));
    if (f === "yes") announce(urgentText("faint"));
  };

  /* ---------- layout pieces ---------- */
  const stopBtn = (top) => <button type="button" className={`cta stopbtn${top ? " top" : ""}`} onClick={() => stop()}>{STOP_TEXT}</button>;
  const intr = run.interrupt && (
    <div className="plaincard urgent" role="alert" style={{ marginBottom: 12 }}>
      <span className="uchip u-now">Now</span>
      <p className="plain">{run.interrupt.copy}</p>
      {preg && <p className="plain">{SAFETY_COPY.urgent.pregSuffix}</p>}
      <button type="button" className="cta" onClick={() => stop()}>{run.interrupt.buttons[0]}</button>
      <button type="button" className="ghostbtn" onClick={() => setRun((r) => ({ ...r, interrupt: null, focusTok: (r.focusTok || 0) + 1, done: r.interrupt.kind === "bpCrisis" && r.interrupt.key ? r.done.filter((k) => k !== r.interrupt.key) : r.done }))}>{run.interrupt.buttons[1]}</button>
    </div>
  );
  const wakeHint = noLock && isRunning(phase) && <p className="hint" style={{ margin: "0 0 10px" }}>Keep your screen on during the test. Tap it now and then.</p>;
  const dueCard = card && (
    <DueCard key={card.key} card={card} bp={!!test.bp && (card.pos === "rest" || test.sched !== "every" || bpAsked(card.min))} standAt={run.standAt} now={now} headRef={cardHead} over={over}
      onSave={(reading, typed) => saveReading(card, reading, typed)} onSkip={() => markDone(card.key)} onFeel={cardFeel} />
  );
  const lean = (test ? test.method : setup.method) === "lean";

  let heading, body;
  if (phase === "safety") {
    heading = "Before you start";
    body = <StandSafety full={full} preg={preg} alone={run.alone ?? null} setAlone={(v) => { setRun((r) => ({ ...r, alone: v })); if (v === true) setSetup((s) => (s.method === "stand" ? s : { ...s, method: "stand", ...methodDefaults("stand") })); }}
      onNext={() => { unlockCue(); go("setup"); }} onNotToday={() => end()} />;
  } else if (phase === "setup") {
    heading = "Set up your test";
    body = <StandSetup setup={setup} setSetup={setSetup} ctx={ctx} setCtx={setCtx} alone={run.alone ?? null} preg={preg} drinks={dayTotals(pots, todayIso).fluidMl} units={pots.settings.units} onStart={startResting} onNotToday={() => end()} />;
  } else if (phase === "rest" && test) {
    heading = "Resting · lie still and breathe normally";
    body = (
      <>
        {stopBtn(true)}
        {intr}
        <div className="pots-timer" role="timer" aria-label="Time left resting">{mmss(test.restMin * MIN - (now - run.phaseStart))}</div>
        <p className="plain" style={{ textAlign: "center" }}>{preg ? "Lie on your left side and stay still." : "Lie flat on your back and stay still."}</p>
        {wakeHint}
        {dueCard}
      </>
    );
  } else if (phase === "stand" && test) {
    heading = "Stand up now";
    body = (
      <>
        {stopBtn(true)}
        {intr}
        <p className="plain">{lean ? "Stand up and lean your upper back against the wall, heels about 15 cm (6 in) out. Let your arms hang." : "Stand up now, slowly. Then stay still with your feet a little apart. Don't talk much."}</p>
        <button type="button" className="cta" style={{ minHeight: 56, fontSize: 16 }} onClick={() => { writeTest((t) => t); go("up", { standAt: Date.now() }); }}>I'm up</button>
        {now - run.phaseStart >= NUDGE_MS && <p className="plain" style={{ marginTop: 12 }}>Still lying down? Tap 'I'm up' once you're standing, or Stop.</p>}
        {wakeHint}
      </>
    );
  } else if (phase === "up" && test) {
    const next = checks.find((c) => now < c.dueAt);
    heading = over ? "You're done. Sit down now, and get up slowly later." : lean ? "Leaning · stay still" : "Standing · stay still";
    body = (
      <>
        {stopBtn(true)}
        {intr}
        {/* The clock stops at 10:30 (A13.4); a reading still open then can be added or skipped. */}
        <div className="pots-timer" role="timer" aria-label="Time upright">{mmssUp(Math.min(upMs, THRESH.upMaxMin * MIN))}</div>
        {next && !card && <p className="plain" style={{ textAlign: "center" }}>{`Next reading at minute ${next.min} · in ${mmss(next.dueAt - now)}`}</p>}
        {wakeHint}
        {dueCard}
        {/* "How do you feel?" stays available the whole time: on the due card while one is open, here otherwise. */}
        {!card && !over && (
          <>
            <p className="lab" id="pots-run-feel">How do you feel?</p>
            <div className="wrapchips" role="group" aria-labelledby="pots-run-feel" style={{ marginBottom: 10 }}>
              {RUNNER_FEEL.map((f) => { const on = (test.feel || []).includes(f.id); return <button type="button" key={f.id} className={`minichip big ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggleTestFeel(f.id)}>{f.label}</button>; })}
            </div>
          </>
        )}
      </>
    );
  } else if (phase === "finish" && test) {
    heading = "You're done. Sit down now, and get up slowly later.";
    const pick = (k, v) => writeTest((t) => ({ ...t, [k]: t[k] === v ? null : v }));
    body = (
      <>
        {lean && <Choice id="pots-fin-pool" label="Did your legs or feet turn red or purple?" value={test.pooling} options={[["yes", "Yes"], ["no", "No"], ["unknown", "Didn't look"]]} onPick={(v) => pick("pooling", v)} />}
        <Choice id="pots-fin-after" label="How do you feel now?" value={test.after} options={[["fine", "Fine"], ["off", "A bit off"], ["bad", "Not good"]]} onPick={(v) => pick("after", v)} />
        {test.after === "bad" && <p className="plain" style={{ marginTop: 10 }}>Stay lying or seated until it passes. If it doesn't settle, or you have chest pain or trouble breathing, get urgent help.</p>}
        <button type="button" className="cta" style={{ marginTop: 16 }} onClick={() => go("result")}>See my result</button>
      </>
    );
  } else if (phase === "stopped" && test) {
    heading = null; // the heading sits inside the role="alert" block below
    body = (
      <>
        {run.chest && <UrgentCard variant="chest" preg={preg} />}
        <UrgentCard variant="test" preg={preg} />
        <Choice id="pots-stop-faint" label="Did you faint (pass out, even briefly)?" value={test.fainted} options={[["no", "No"], ["almost", "Almost"], ["yes", "Yes"]]} onPick={answerFaint} />
        {test.fainted === "yes" && <div style={{ marginTop: 10 }}><UrgentCard variant="faint" preg={preg} /></div>}
        <Choice id="pots-stop-why" label="Why did you stop?" value={test.why} options={[["faint", "Felt faint"], ["symptoms", "Other symptoms"], ["other", "Something else"]]} onPick={(v) => writeTest((t) => ({ ...t, why: t.why === v ? null : v }))} />
        {!discard && (
          <>
            <button type="button" className="cta" style={{ marginTop: 16 }} onClick={() => go("result")}>Save what I have</button>
            <button type="button" className="linkbtn" style={{ display: "block", marginTop: 12 }} onClick={() => setDiscard({ keepFaint: true })}>Discard</button>
          </>
        )}
        {discard && (
          <div className="plaincard" style={{ marginTop: 14 }}>
            <p className="plain" tabIndex={-1} ref={confirmRef}>Discard this test? Its readings are removed from your POTS log.</p>
            {(test.fainted === "yes" || test.fainted === "almost") && <CheckRow on={discard.keepFaint} onToggle={() => setDiscard((d) => ({ keepFaint: !d.keepFaint }))}>Keep the faint in my log</CheckRow>}
            <button type="button" className="cta" style={{ background: "#A04545", marginTop: 10 }} onClick={() => { const k = discard.keepFaint; setPots((p) => deleteTest(p, run.id, { keepFaint: k })); end("Test discarded"); }}>Discard test</button>
            <button type="button" className="ghostbtn" onClick={() => setDiscard(null)}>Keep it</button>
          </div>
        )}
      </>
    );
  } else if (phase === "result" && test) {
    heading = "Your result";
    const saveNote = () => { if (note.trim() !== (test.note || "")) writeTest((t) => ({ ...t, note: note.trim().slice(0, 500) })); };
    body = (
      <>
        <StandResult pots={pots} test={test} stage={stage} cyc={cyc} />
        <label className="lab" htmlFor="pots-res-note">Note about this test (optional)</label>
        <textarea id="pots-res-note" className="inp" rows={3} maxLength={500} aria-label="Note about this test (optional)" value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} />
        <button type="button" className="cta" onClick={() => { saveNote(); end("Saved. Rest now if you need to."); }}>Done</button>
      </>
    );
  } else {
    heading = "Stand test";
    body = <p className="plain">This test isn't on this device any more.</p>;
  }

  return (
    <main className="pots pots-run">
      <p className="sr-only" role="alert">{live}</p>
      <p className="sr-only" role="status" aria-live="polite">{status}</p>
      {phase === "stopped" && test ? (
        <div role="alert">
          <h1 className="disp" tabIndex={-1} ref={h1}>Lie down and raise your legs</h1>
          <p className="plain">Stay down until you feel steady. There's no rush to do anything else.</p>
        </div>
      ) : <h1 className="disp" tabIndex={-1} ref={h1}>{heading}</h1>}
      {body}
      {isRunning(phase) && test && <div className="stopbar">{stopBtn(false)}</div>}
    </main>
  );
}

/* ---------- the Stand test section (landing) ---------- */
const isoBack = (iso, n) => addDays(iso, -n);

/** "Heart rate by position": the latest lying, sitting and standing reading per day (single
    readings, not timed tests, so no threshold sentence). */
function ByPosition({ pots }) {
  const days = Object.keys(pots.days || {}).filter((k) => (pots.days[k].vit || []).length).sort().reverse().slice(0, 14);
  if (!days.length) return null;
  const cell = (k, pos) => {
    const v = (pots.days[k].vit || []).filter((x) => x.pos === pos).sort((a, b) => (a.t < b.t ? -1 : 1)).pop();
    if (!v) return "—";
    return [v.hr != null ? `${v.hr}` : null, v.sys != null || v.dia != null ? `${v.sys ?? "?"}/${v.dia ?? "?"}` : null].filter(Boolean).join(" · ") || "—";
  };
  return (
    <table className="rtab" style={{ margin: "6px 0 12px" }}>
      <caption className="lab" style={{ textAlign: "left", captionSide: "top" }}>Heart rate by position</caption>
      <thead><tr><th scope="col">Day</th><th scope="col">Lying</th><th scope="col">Sitting</th><th scope="col">Standing</th></tr></thead>
      <tbody>{days.map((k) => <tr key={k}><td>{shortDay(k)}</td><td>{cell(k, "lying")}</td><td>{cell(k, "sitting")}</td><td>{cell(k, "standing")}</td></tr>)}</tbody>
    </table>
  );
}

export function StandSection({ pots, setPots, stage, todayIso, ping, running, onStart, focusKey, cyc = null }) {
  const preg = stage === "preg";
  const [sheet, setSheet] = useState(null); // null | { kind: "open"|"edit"|"vitals"|"tilt", id? }
  const [rowAct, setRowAct] = useState(null); // null | { kind: "note"|"del"|"discard", id, ... }
  const [noteDraft, setNoteDraft] = useState("");
  const [all, setAll] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [live, announce] = useAnnounce();
  const topRef = useRef(null), sheetHead = useRef(null), confirmRef = useRef(null);
  const [focusBack, setFocusBack] = useState(null);
  // A Delete or Discard confirm takes focus once, when it opens (not on every redraw).
  const confirmKey = rowAct && (rowAct.kind === "del" || rowAct.kind === "discard") ? `${rowAct.kind}:${rowAct.id}` : null;
  useEffect(() => { if (confirmKey) confirmRef.current?.focus(); }, [confirmKey]);
  useEffect(() => { if (focusKey) topRef.current?.focus(); }, [focusKey]);
  useEffect(() => { if (sheet) sheetHead.current?.focus(); }, [sheet]);
  useEffect(() => {
    if (!focusBack) return;
    const el = document.getElementById(focusBack);
    setFocusBack(null);
    if (el && el.getClientRects().length) el.focus(); else topRef.current?.focus();
  }, [focusBack]);
  useEffect(() => { const h = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(h); }, []);

  const tests = Array.isArray(pots.tests) ? pots.tests : [];
  const mine = running && running.id;
  // A test another window is running (or that was just interrupted): information only, no
  // actions, so this window can never save or discard a live test. Once it has had no activity
  // for 30 minutes it is marked interrupted (as at launch), and Keep it / Discard apply.
  const liveTests = tests.filter((t) => t.status === "running" && t.id !== mine);
  const stale = liveTests.some((t) => now - (t.upd || 0) > STALE);
  useEffect(() => { if (stale) setPots((p) => markStaleRunning(p, Date.now())); }, [stale]); // eslint-disable-line
  const elsewhere = liveTests.some((t) => now - (t.upd || 0) <= STALE);
  const weekAgo = isoBack(todayIso, 7);
  const interrupted = tests.filter((t) => t.status === "interrupted" && t.date >= weekAgo && t.kept !== true);
  const list = tests.filter((t) => t.status !== "running").slice().reverse();
  const last = list[0] || null;
  const lastR = last ? resultFor(pots, last, stage) : null;

  const close = (to) => { setSheet(null); setFocusBack(to || "pots-stand-start"); };
  const sheetTest = sheet && sheet.id ? tests.find((t) => t.id === sheet.id) : null;
  if (sheet) {
    if ((sheet.kind === "open" || sheet.kind === "edit") && !sheetTest) { setSheet(null); return null; }
    return (
      <div className="pots-stand">
        <p className="sr-only" role="alert">{live}</p>
        <h2 className="sr-only" tabIndex={-1} ref={topRef}>Stand test</h2>
        {sheet.kind === "open" && (
          <section aria-labelledby="pots-open-h">
            <h2 className="obq" id="pots-open-h" tabIndex={-1} ref={sheetHead}>{`${methodWord(sheetTest.method)} · ${shortDay(sheetTest.date)}, ${sheetTest.t.replace(/^0/, "")}`}</h2>
            <StandResult pots={pots} test={sheetTest} stage={stage} cyc={cyc} />
            {sheetTest.note && <p className="plain" style={{ whiteSpace: "pre-wrap" }}><b>Your note: </b>{sheetTest.note}</p>}
            <button type="button" className="ghostbtn" onClick={() => close(`pots-open-${sheetTest.id}`)}>Back to stand tests</button>
          </section>
        )}
        {sheet.kind === "edit" && <EditReadings test={sheetTest} setPots={setPots} headRef={sheetHead} onDone={(saved) => { if (saved) ping("Readings corrected. The result now says so."); close(`pots-edit-${sheetTest.id}`); }} />}
        {sheet.kind === "vitals" && <VitalsForm v={null} isToday preg={preg} announce={announce} headRef={sheetHead} onCancel={() => close("pots-stand-single")}
          onSave={(v) => { setPots((p) => addVitals(p, todayIso, { ...v, id: newId() })); ping("Reading saved."); close("pots-stand-single"); }} />}
        {sheet.kind === "tilt" && <TiltForm today={todayIso} headRef={sheetHead} onCancel={() => close("pots-stand-tilt")} onSave={(t) => { setPots((p) => addTilt(p, t)); ping("Tilt-table result saved"); close("pots-stand-tilt"); }} />}
      </div>
    );
  }

  const trend = testTrend(pots).filter((x) => x.complete);
  const thr = pots.settings.teen ? THRESH.hrTeen : THRESH.hr;
  const methods = ["stand", "lean", ...new Set(trend.map((x) => x.method).filter((m) => m !== "stand" && m !== "lean"))].filter((m) => trend.filter((x) => x.method === m).length >= 2);
  const linkedFaint = (t) => ((((pots.days || {})[t.date] || {}).eps) || []).some((e) => e.src === t.id);
  const shown = all ? list : list.slice(0, 10);

  return (
    <div className="pots-stand">
      <p className="sr-only" role="alert">{live}</p>
      <h2 className="sr-only" tabIndex={-1} ref={topRef}>Stand test</h2>
      {elsewhere && (
        <div className="plaincard" style={{ marginBottom: 12 }}>
          <p className="plain">A test is running in another window or was just interrupted. Check back after it ends.</p>
        </div>
      )}
      {interrupted.map((t) => {
        const upTo = savedUpTo(t);
        const asking = rowAct && rowAct.kind === "discard" && rowAct.id === t.id;
        return (
          <div className="plaincard" key={t.id} style={{ marginBottom: 12 }}>
            <p className="plain" id={`pots-int-${t.id}`} tabIndex={-1}>{upTo > 0 ? `Your ${shortDay(t.date)} test was saved up to minute ${fmtN(upTo)}.` : `Your ${shortDay(t.date)} test was saved before you stood up.`}</p>
            {!asking && (
              <div className="wearbtns" style={{ justifyContent: "flex-start" }}>
                <button type="button" className="sbtn" onClick={() => { setPots((p) => { const x = (p.tests || []).find((y) => y.id === t.id); return x ? upsertTest(p, { ...x, kept: true }) : p; }); ping("Kept. It's in your tests below."); setFocusBack("pots-stand-start"); }}>Keep it</button>
                <button type="button" className="sbtn" onClick={() => setRowAct({ kind: "discard", id: t.id })}>Discard</button>
              </div>
            )}
            {asking && (
              <>
                <p className="plain" tabIndex={-1} ref={confirmRef}>Discard this test? Its readings are removed from your POTS log.</p>
                <button type="button" className="cta" style={{ background: "#A04545" }} onClick={() => { setPots((p) => deleteTest(p, t.id)); setRowAct(null); ping("Test discarded"); setFocusBack("pots-stand-start"); }}>Discard test</button>
                <button type="button" className="ghostbtn" onClick={() => { setRowAct(null); setFocusBack(`pots-int-${t.id}`); }}>Keep it</button>
              </>
            )}
          </div>
        );
      })}
      {last && lastR && (
        <div className="card">
          <div className="num" aria-hidden={riseShown(lastR) == null || undefined}>{riseShown(lastR) ?? "—"}</div>
          <p><b>{`Last test · ${shortDay(last.date)} · ${methodWord(last.method)}`}</b><br />{lastR.headline || riseText(last, lastR)}</p>
        </div>
      )}
      <button type="button" id="pots-stand-start" className="cta" style={{ marginTop: 6 }} onClick={onStart}>Start a standing test</button>
      <button type="button" id="pots-stand-single" className="ghostbtn" onClick={() => setSheet({ kind: "vitals" })}>Add a single reading</button>
      <button type="button" id="pots-stand-tilt" className="linkbtn" style={{ display: "block", marginTop: 12 }} onClick={() => setSheet({ kind: "tilt" })}>Add a tilt-table result</button>

      {list.length > 0 && <h3 className="lab" id="pots-tests-h" tabIndex={-1}>Your tests</h3>}
      {shown.map((t) => {
        const r = resultFor(pots, t, stage), when = shortDay(t.date);
        const act = rowAct && rowAct.id === t.id ? rowAct : null;
        return (
          <div key={t.id}>
            <div className="medrow" style={{ flexWrap: "wrap" }}>
              <div className="medinfo" style={{ flex: "1 1 140px" }}><b>{`${when} · ${methodWord(t.method)}`}</b><span>{`${riseText(t, r)}${t.edited ? " · edited" : ""}`}</span></div>
              <div className="wearbtns">
                <button type="button" id={`pots-open-${t.id}`} className="sbtn" aria-label={`Open the ${when} test`} onClick={() => setSheet({ kind: "open", id: t.id })}>Open</button>
                <button type="button" id={`pots-edit-${t.id}`} className="sbtn" aria-label={`Edit readings of the ${when} test`} onClick={() => setSheet({ kind: "edit", id: t.id })}>Edit readings</button>
                <button type="button" id={`pots-note-${t.id}`} className="sbtn" aria-label={`Edit the note on the ${when} test`} aria-expanded={!!(act && act.kind === "note")} onClick={() => { setNoteDraft(t.note || ""); setRowAct(act && act.kind === "note" ? null : { kind: "note", id: t.id }); }}>Edit note</button>
                <button type="button" id={`pots-del-${t.id}`} className="sbtn" aria-label={`Delete the ${when} test`} onClick={() => setRowAct({ kind: "del", id: t.id, keepFaint: true })}>Delete</button>
              </div>
            </div>
            {act && act.kind === "note" && (
              <div className="plaincard" style={{ margin: "4px 0 10px" }}>
                <label className="lab" htmlFor={`pots-note-in-${t.id}`} style={{ marginTop: 0 }}>Note about this test</label>
                <textarea id={`pots-note-in-${t.id}`} className="inp" rows={3} maxLength={500} aria-label="Note about this test" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
                <div className="wearbtns" style={{ justifyContent: "flex-start" }}>
                  <button type="button" className="sbtn" onClick={() => { const v = noteDraft.trim().slice(0, 500); setPots((p) => { const x = (p.tests || []).find((y) => y.id === t.id); return x ? upsertTest(p, { ...x, note: v }) : p; }); setRowAct(null); ping("Note saved"); setFocusBack(`pots-note-${t.id}`); }}>Save note</button>
                  <button type="button" className="sbtn" onClick={() => { setRowAct(null); setFocusBack(`pots-note-${t.id}`); }}>Cancel</button>
                </div>
              </div>
            )}
            {act && act.kind === "del" && (
              <div className="plaincard urgent" style={{ margin: "4px 0 10px" }}>
                <p className="plain" tabIndex={-1} ref={confirmRef}>{`Delete the ${when} test? Its readings are removed from your POTS log.`}</p>
                {linkedFaint(t) && <CheckRow on={act.keepFaint} onToggle={() => setRowAct({ ...act, keepFaint: !act.keepFaint })}>Keep the faint in my log</CheckRow>}
                <button type="button" className="cta" style={{ background: "#A04545", marginTop: 10 }} onClick={() => { setPots((p) => deleteTest(p, t.id, { keepFaint: act.keepFaint })); setRowAct(null); ping("Test deleted"); setFocusBack("pots-tests-h"); }}>Delete test</button>
                <button type="button" className="ghostbtn" onClick={() => { setRowAct(null); setFocusBack(`pots-del-${t.id}`); }}>Keep it</button>
              </div>
            )}
          </div>
        );
      })}
      {list.length > 10 && <button type="button" className="linkbtn" style={{ display: "block", marginTop: 8 }} aria-expanded={all} onClick={() => setAll((v) => !v)}>{all ? "Show the latest 10" : `Show all ${list.length} tests`}</button>}

      {methods.length > 0 && (
        <>
          <h3 className="lab">Your tests over time</h3>
          {methods.map((m) => {
            const rows = trend.filter((x) => x.method === m), md = rows.length >= 3 ? median(rows.map((x) => x.rise)) : null;
            return (
              <div key={m} style={{ marginBottom: 8 }}>
                <p className="plain" style={{ margin: "4px 0 0" }}><b>{methodWord(m)}</b></p>
                <TrendChart rows={rows} thr={thr} stage={stage} methodLabel={methodWord(m).toLowerCase()} />
                {md != null && <p className="plain">{`Median rise over your ${rows.length} ${methodWord(m).toLowerCase()} tests: ${fmtN(md)}.`}</p>}
              </div>
            );
          })}
          <p className="hint">Tests done at different times of day, cycle days or with different medicines aren't directly comparable.</p>
        </>
      )}
      <ByPosition pots={pots} />
      <TiltList pots={pots} setPots={setPots} ping={ping} onRemoved={() => setFocusBack("pots-stand-tilt")} />
    </div>
  );
}
