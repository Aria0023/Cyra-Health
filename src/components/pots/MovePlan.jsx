import { useEffect, useRef, useState } from "react";
import {
  moveState, moveOption, progress, weeklyCounts, planLine, setProgram, clearFaintPause,
  MOVE_STEPS, MOVE_COPY, PEM_OPTS, CLEAR_OPTS, CLEAR_PREG_OPTS, WEEKDAYS,
} from "../../lib/potsMove.js";
import { RAMPS } from "../../lib/constants.js";
import Advice from "../Advice.jsx";
import Details from "../Details.jsx";
import { Choice } from "./StandSafety.jsx";
import { SessionLog } from "./MoveSession.jsx";
import { numOf, numProps, useAnnounce } from "./ui.js";

/* POTS → Move (design 4.10, spec A13.3; lib/potsMove.js). Cyra's own graded plan that starts
   lying down, in Cyra's words; not any clinic's program and not a prescription.

   - Gate 1, asked first: the crash-after-effort (PEM) question. Yes or Not sure turns on pacing
     mode: no step plan and no step-up option ever, while sessions can still be logged.
   - Gate 2: has a clinician or physio said it's OK to start? The plan shows with any answer,
     and the "check first" advice shows whenever the answer isn't Yes (also before she answers,
     since a session can already be started then). In pregnancy a separate prenatal-team answer
     is used (cleared on every change of stage into Pregnancy), and the plan and every option
     show only after its yes.
   - She picks her step; Cyra never moves her. Options (ready, hold, ease off) are offered for
     her to choose, never in pacing mode, after an exercise faint until she taps "I've been
     checked", or without a clinician's yes.
   - Her plan: weekdays, a main-part length that stays blank until she enters it (owner decision
     D9), and the heart-rate range her clinician gave in her own words. Cyra suggests none.
   - "Start a session" opens the guided timer (MoveSession.jsx, the running takeover); "Log a
     session I did" records one without it. No streaks; rest days are part of the plan. */
const rgb = (c) => `rgb(${c.join(",")})`;
const short = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Sessions per week over the last 8 weeks (fill ramp().mid), with the next days rated worse or
    crashed. Every value is in the aria-label. */
function WeekBars({ weeks, ramp }) {
  const max = Math.max(1, ...weeks.map((w) => w.n));
  const label = `Sessions per week, last 8 weeks: ${weeks.map((w) => `week from ${short(w.from)}, ${w.n}${w.worse || w.crash ? ` (next day worse ${w.worse}, crashed ${w.crash})` : ""}`).join("; ")}.`;
  const worse = weeks.reduce((a, w) => a + w.worse, 0), crash = weeks.reduce((a, w) => a + w.crash, 0);
  return (
    <>
      <p className="plain" style={{ margin: "10px 0 4px" }}><b>Sessions per week</b></p>
      <div className="bars" role="img" aria-label={label}>
        {weeks.map((w) => (
          <div key={w.from} className="brow" style={{ gridTemplateColumns: "84px 1fr 40px" }}>
            <span className="blab">{`from ${short(w.from)}`}</span>
            <div className="btrack">{w.n > 0 && <div className="bfill" style={{ width: `${(w.n / max) * 100}%`, background: rgb(ramp.mid) }} />}</div>
            <span className="bval" style={{ color: "var(--ink)" }}>{w.n}</span>
          </div>
        ))}
      </div>
      <p className="hint" style={{ margin: "6px 0 0" }}>{`Next days rated worse in these 8 weeks: ${worse} · crashed: ${crash}.`}</p>
    </>
  );
}

/** "Main part length": blank until she enters 5 to 60 minutes. A draft is kept while she types
    and saved once it is a whole number in range (or cleared). */
function MainLength({ value, onSave }) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [bad, setBad] = useState(false);
  useEffect(() => { setDraft((d) => (numOf(d) === value || (d === "" && value == null) ? d : value == null ? "" : String(value))); }, [value]);
  const ok = (n) => n != null && Number.isInteger(n) && n >= 5 && n <= 60;
  const change = (v) => {
    setDraft(v);
    const n = numOf(v);
    if (v.trim() === "") { setBad(false); if (value != null) onSave(null); } else if (ok(n)) { setBad(false); if (n !== value) onSave(n); }
  };
  return (
    <>
      <label className="lab" htmlFor="pots-move-main">Main part length (minutes)</label>
      <input id="pots-move-main" className={`inp ${bad ? "inpErr" : ""}`} {...numProps()} maxLength={2} aria-label="Main part length (minutes)" placeholder={MOVE_COPY.mainPlaceholder} value={draft}
        aria-invalid={bad || undefined} aria-describedby={bad ? "pots-move-main-err pots-move-main-hint" : "pots-move-main-hint"}
        onChange={(e) => change(e.target.value)} onBlur={() => setBad(draft.trim() !== "" && !ok(numOf(draft)))} />
      {bad && <p className="errhint" id="pots-move-main-err" role="alert" style={{ marginTop: 0 }}>Use 5 to 60 minutes, or leave it blank.</p>}
      <p className="hint" id="pots-move-main-hint" style={{ margin: "0 0 10px" }}>{MOVE_COPY.mainHint}</p>
    </>
  );
}

export default function MovePlan({ pots, setPots, stage, todayIso, ping, onStart, focus = false, onFocused }) {
  const preg = stage === "preg";
  const st = moveState(pots, stage), pr = st.program;
  const [sheet, setSheet] = useState(null); // null | "log"
  const [hr, setHr] = useState(pr && pr.hrNote ? pr.hrNote : "");
  const [live, announce] = useAnnounce();
  const topRef = useRef(null), sheetHead = useRef(null);
  const [focusTo, setFocusTo] = useState(null); // an element id, or "top"
  // Focus moves to the section heading only when App asked for it (one-shot), never on a chip tap.
  useEffect(() => { if (focus) { topRef.current?.focus(); onFocused?.(); } }, [focus]); // eslint-disable-line
  useEffect(() => { if (sheet) sheetHead.current?.focus(); }, [sheet]);
  useEffect(() => {
    if (!focusTo) return;
    const el = focusTo === "top" ? null : document.getElementById(focusTo);
    setFocusTo(null);
    if (el && el.getClientRects().length) el.focus(); else topRef.current?.focus();
  }, [focusTo]);
  useEffect(() => { setHr((h) => (h.trim() === ((pr && pr.hrNote) || "") ? h : (pr && pr.hrNote) || "")); }, [pr && pr.hrNote]); // eslint-disable-line
  const set = (patch) => setPots((p) => setProgram(p, patch, todayIso));

  if (sheet === "log") {
    return (
      <div className="pots-move">
        <p className="sr-only" role="alert">{live}</p>
        <SessionLog pots={pots} setPots={setPots} stage={stage} todayIso={todayIso} ping={ping} announce={announce} headRef={sheetHead} onDone={() => { setSheet(null); setFocusTo("pots-move-log"); }} />
      </div>
    );
  }

  const ramp = RAMPS[stage] || RAMPS.peri;
  const opt = moveOption(pots, { stage, today: todayIso });
  const prog = st.planShown ? progress(pots, todayIso) : null;
  const weeks = weeklyCounts(pots, todayIso);
  const line = planLine(pots, { stage, day: todayIso });
  const step = pr ? pr.step || 1 : 1;
  const days = pr && Array.isArray(pr.days) ? pr.days : [];

  return (
    <div className="pots-move">
      <p className="sr-only" role="alert">{live}</p>
      <h2 className="sr-only" tabIndex={-1} ref={topRef}>Move</h2>

      {/* Gate 1: crashing after effort (PEM), asked first. */}
      {!st.asked && (
        <section className="plaincard" aria-labelledby="pots-move-pem-h" style={{ marginBottom: 12 }}>
          <h3 className="lab" id="pots-move-pem-h" style={{ marginTop: 0 }}>Before a plan</h3>
          <Choice id="pots-move-pem" label={MOVE_COPY.pemQ} value={pr ? pr.pem : null} options={PEM_OPTS} onPick={(v) => { set({ pem: v }); setFocusTo(v === "no" ? "pots-move-clear" : "pots-move-pacing"); }} />
          <p className="hint" style={{ margin: "8px 0 0" }}>You can change this answer later in POTS settings.</p>
        </section>
      )}

      {st.paused && (
        <div className="plaincard urgent" style={{ marginBottom: 12 }}>
          <p className="plain" id="pots-move-paused" tabIndex={-1}>{MOVE_COPY.faint}</p>
          {st.planShown && <p className="plain">Step-up options are paused until then.</p>}
          <button type="button" className="ghostbtn" onClick={() => { setPots(clearFaintPause); ping("Thanks. Step-up options can show again."); setFocusTo("top"); }}>I've been checked</button>
        </div>
      )}

      {st.pacing && (
        <div className="plaincard" style={{ marginBottom: 12 }}>
          <p className="plain" id="pots-move-pacing" tabIndex={-1}>{MOVE_COPY.pacing}</p>
        </div>
      )}

      {/* Gate 2: clearance (a separate prenatal-team answer in pregnancy). */}
      {st.asked && !st.pacing && (
        <div style={{ marginBottom: 12 }}>
          <h3 className="lab" id="pots-move-clear" tabIndex={-1} style={{ marginTop: 0 }}>Before you start</h3>
          {preg
            ? <Choice id="pots-move-clearq" label={MOVE_COPY.clearPregQ} value={pr.clearedPreg ?? null} options={CLEAR_PREG_OPTS} onPick={(v) => set({ clearedPreg: pr.clearedPreg === v ? null : v })} />
            : <Choice id="pots-move-clearq" label={MOVE_COPY.clearQ} value={pr.cleared ?? null} options={CLEAR_OPTS} onPick={(v) => set({ cleared: pr.cleared === v ? null : v })} />}
          {!preg && pr.cleared !== "yes" && <div style={{ marginTop: 10 }}><Advice urgency="visit">{MOVE_COPY.clearAdvice}</Advice></div>}
          {preg && pr.clearedPreg !== "yes" && <p className="plain" style={{ marginTop: 10 }}>{MOVE_COPY.pregWait}</p>}
        </div>
      )}

      {st.planShown && (
        <>
          {opt && (
            <div className="plaincard" style={{ marginBottom: 12 }}>
              <p className="plain">{opt.copy}</p>
              {opt.kind === "ready" && <button type="button" className="ghostbtn" onClick={() => { set({ step: opt.next }); ping(`Step ${opt.next} chosen`); setFocusTo("pots-move-step-h"); }}>{`Move to Step ${opt.next}`}</button>}
              {opt.kind === "ease" && opt.back && <button type="button" className="ghostbtn" onClick={() => { set({ step: opt.back }); ping(`Step ${opt.back} chosen`); setFocusTo("pots-move-step-h"); }}>Step back a step</button>}
            </div>
          )}
          {prog && <p className="plain" id="pots-move-progress"><b>{prog.text}</b></p>}
          {line && !st.paused && <p className="plain">{line}</p>}
        </>
      )}
      {st.asked && weeks.some((w) => w.n > 0) && <WeekBars weeks={weeks} ramp={ramp} />}

      {st.asked && (
        <>
          <button type="button" id="pots-move-start" className="cta" style={{ marginTop: 12 }} onClick={onStart}>Start a session</button>
          <button type="button" id="pots-move-log" className="linkbtn" style={{ display: "block", marginTop: 10 }} onClick={() => setSheet("log")}>Log a session I did</button>
        </>
      )}

      {st.planShown && (
        <>
          <section className="plaincard" aria-labelledby="pots-move-about-h" style={{ margin: "14px 0 12px" }}>
            <h3 className="lab" id="pots-move-about-h" style={{ marginTop: 0 }}>About this plan</h3>
            {MOVE_COPY.education.map((x) => <p className="plain" key={x.slice(0, 20)}>{x}</p>)}
          </section>

          <h3 className="lab" id="pots-move-step-h" tabIndex={-1}>Your step</h3>
          <div className="mcrow" role="group" aria-labelledby="pots-move-step-h">
            {MOVE_STEPS.map((x) => <button type="button" key={x.step} className={`mc ${step === x.step ? "on" : ""}`} aria-pressed={step === x.step} onClick={() => { if (step !== x.step) set({ step: x.step }); }}>{`Step ${x.step}`}</button>)}
          </div>
          <p className="hint" style={{ margin: "6px 0 8px" }}>You choose your step. Cyra never moves you on by itself. The weeks are typical, not targets.</p>
          {MOVE_STEPS.map((x) => (
            <div key={x.step} className="medrow" style={{ display: "block" }}>
              <p className="plain" style={{ margin: "0 0 2px" }}><b>{`Step ${x.step} · ${x.name}`}</b>{` · typical weeks ${x.weeks}${step === x.step ? " · your step" : ""}`}</p>
              <p className="plain" style={{ margin: "0 0 2px" }}>{x.acts}</p>
              <p className="hint" style={{ margin: 0 }}>{x.pattern}</p>
              {x.step === 1 && preg && <p className="plain" style={{ margin: "4px 0 0" }}>{MOVE_COPY.pregFloor}</p>}
            </div>
          ))}

          <h3 className="lab" id="pots-move-plan-h" style={{ marginTop: 18 }}>Your plan</h3>
          <p className="lab" id="pots-move-days" style={{ marginTop: 4 }}>Which days will you move?</p>
          <div className="mcrow" role="group" aria-labelledby="pots-move-days" style={{ flexWrap: "wrap" }}>
            {WEEKDAYS.map(([n, l]) => { const on = days.includes(n); return <button type="button" key={n} className={`mc ${on ? "on" : ""}`} aria-pressed={on} onClick={() => set({ days: on ? days.filter((x) => x !== n) : [...days, n] })}>{l}</button>; })}
          </div>
          {days.length > 0 && <p className="hint" style={{ margin: "6px 0 0" }}>{`Other days: ${MOVE_COPY.restDay}`}</p>}
          <div style={{ marginTop: 10 }}><MainLength value={pr.mainMin ?? null} onSave={(n) => set({ mainMin: n })} /></div>
          <label className="lab" htmlFor="pots-move-hr">Heart-rate range from your clinician or physio (optional)</label>
          <input id="pots-move-hr" className="inp" maxLength={120} aria-label="Heart-rate range from your clinician or physio (optional)" aria-describedby="pots-move-hr-hint" value={hr}
            onChange={(e) => { const v = e.target.value; setHr(v); if (v.trim() !== (pr.hrNote || "")) set({ hrNote: v }); }} />
          <p className="hint" id="pots-move-hr-hint" style={{ margin: "0 0 10px" }}>In their words. Cyra never suggests a range.</p>
        </>
      )}

      {st.asked && (
        <Details label="Where this approach comes from">
          <ul>{MOVE_COPY.sources.map((x) => <li key={x}>{x}</li>)}</ul>
        </Details>
      )}
    </div>
  );
}
