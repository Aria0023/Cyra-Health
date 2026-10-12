import { useState } from "react";
import UrgentCard from "./UrgentCard.jsx";
import Details from "../Details.jsx";
import { fmtFluid } from "../../lib/pots.js";

/* Before every standing test (design 4.8.3, 4.8.4). Both screens are phases of the runner, so
   they render inside its single <main> under its h1 (StandTest.jsx owns the heading). Nothing
   here is a hard gate except the two safety checkboxes: "Is someone with you?" is strongly
   advised, not required (owner decision D13), and answering No steers to the active stand.
   Safety copy needs clinician sign-off (Q1). */

const SAFETY_FIRST = [
  "This test can make you feel faint. Have someone with you, or close enough to hear you.",
  "Set up right next to a bed or sofa so you can lie straight back down. Clear the floor around you.",
  "Stop and lie down the moment you feel faint, your vision greys out, you feel sick, or you just want to. Stopping early is safe and still a useful result.",
  "Take your usual medicines as normal. Don't skip or change one for this test unless your clinician told you to.",
];
const NOT_TODAY = [
  "you've fainted in the past few days and haven't been checked",
  "you have chest pain, or feel very unwell",
  "a clinician has told you not to do standing tests",
];
const NOT_TODAY_PREG = "you haven't checked with your prenatal team first";
export const PREG_LINE = "In pregnancy, fainting, a racing heart that won't settle, chest pain or breathlessness need a same-day call to your maternity team.";
export const GATES = [
  ["read", "I've read the safety steps. I'll stop and lie down if I feel faint."],
  ["bed", "I have somewhere to lie down right next to me."],
];
export const SOLO = "On your own? Choose the active stand, keep your phone in your hand, stand right beside the bed, and stop at the first sign of feeling faint. Consider waiting until someone can be nearby, especially for a lean test. If you feel faint, lie down first and log later.";

function SafetySteps({ preg }) {
  return (
    <>
      <p className="lab" style={{ marginTop: 0 }}>Safety first</p>
      <ul className="rlist">{SAFETY_FIRST.map((x) => <li key={x}>{x}</li>)}</ul>
      <p className="lab">Don't do it today if</p>
      <ul className="rlist">{[...NOT_TODAY, ...(preg ? [NOT_TODAY_PREG] : [])].map((x) => <li key={x}>{x}</li>)}</ul>
    </>
  );
}

/** A role="checkbox" row in the house consent style. */
export function CheckRow({ on, onToggle, children, id }) {
  return (
    <button type="button" id={id} role="checkbox" aria-checked={on} className={`consentopt ${on ? "on" : ""}`} style={{ marginTop: 8 }} onClick={onToggle}>
      <span className="ckbox" aria-hidden="true">{on ? "✓" : ""}</span><span>{children}</span>
    </button>
  );
}

/** One `.mcrow` of pressed-state choices with a visible label: [[value, label], ...]. */
export function Choice({ id, label, value, options, onPick, hint = null }) {
  return (
    <>
      <p className="lab" id={id}>{label}</p>
      <div className="mcrow" role="group" aria-labelledby={id}>
        {options.map(([v, l]) => <button type="button" key={String(v)} className={`mc ${value === v ? "on" : ""}`} aria-pressed={value === v} onClick={() => onPick(v)}>{l}</button>)}
      </div>
      {hint && <p className="hint" style={{ margin: "6px 0 0" }}>{hint}</p>}
    </>
  );
}

/** Safety (full the first time and every 90 days, condensed otherwise). `full` is decided once
    by the runner when this screen opens; the full version records today as safetySeen. */
export function StandSafety({ full, preg, alone, setAlone, onNext, onNotToday }) {
  const [gates, setGates] = useState({ read: false, bed: false });
  const ok = gates.read && gates.bed;
  return (
    <>
      <div className="plaincard" role="group" aria-label="Before you start" style={{ marginBottom: 12 }}>
        {full && <SafetySteps preg={preg} />}
        <div style={{ marginTop: full ? 12 : 0 }}><UrgentCard variant="test" preg={preg} /></div>
        {preg && <p className="plain" style={{ marginTop: 10 }}>{PREG_LINE}</p>}
        {!full && <Details label="Show all safety steps"><SafetySteps preg={preg} /></Details>}
        {GATES.map(([k, l]) => <CheckRow key={k} on={gates[k]} onToggle={() => setGates((g) => ({ ...g, [k]: !g[k] }))}>{l}</CheckRow>)}
        <Choice id="pots-st-alone" label="Is someone with you or nearby?" value={alone} options={[[false, "Yes"], [true, "No"]]} onPick={(v) => setAlone(alone === v ? null : v)} />
        {alone === true && <p className="plain" style={{ marginTop: 10 }}>{SOLO}</p>}
      </div>
      {!ok && <p className="hint" id="pots-st-gates" style={{ margin: "0 0 8px" }}>Tick both boxes above to go on.</p>}
      <button type="button" className="cta" disabled={!ok} aria-describedby={ok ? undefined : "pots-st-gates"} onClick={onNext}>Next</button>
      <button type="button" className="ghostbtn" onClick={onNotToday}>Not today</button>
    </>
  );
}

export const METHODS = [["stand", "Active stand: stand still on your own"], ["lean", "Lean test: upper back against a wall, heels about 15 cm (6 in) out"]];
const DEVICES = [["watch", "Watch"], ["cuff", "Blood-pressure cuff"], ["oximeter", "Finger pulse meter"], ["counted", "Counting my pulse"], ["other", "Other"]];
/** Rest length and schedule defaults by method: active stand 5 min and 1-3-5-10; lean 10 min
    and every minute (A13.4). */
export const methodDefaults = (m) => (m === "lean" ? { restMin: 10, sched: "every" } : { restMin: 5, sched: "1-3-5-10" });

/** Setup: which test, rest length, schedule, blood pressure, device and the context she wants
    stored with the test. Choices are remembered in settings.test when resting starts. */
export function StandSetup({ setup, setSetup, ctx, setCtx, alone, preg, drinks, units, onStart, onNotToday }) {
  const set = (patch) => setSetup((s) => ({ ...s, ...patch }));
  const c = (k, v) => setCtx((x) => ({ ...x, [k]: x[k] === v ? null : v }));
  const leanHint = ["Leaning stops your leg muscles from helping, so it can show more.", alone === true ? "Best done with someone nearby." : null, preg ? "Check with your maternity team before doing a lean test in pregnancy." : null].filter(Boolean).join(" ");
  return (
    <>
      <Choice id="pots-st-method" label="Which test?" value={setup.method} options={METHODS} onPick={(v) => set({ method: v, ...methodDefaults(v) })}
        hint={setup.method === "lean" ? leanHint : null} />
      <Choice id="pots-st-rest" label="Rest first for" value={setup.restMin} options={[[5, "5 minutes"], [10, "10 minutes"]]} onPick={(v) => set({ restMin: v })} />
      <Choice id="pots-st-sched" label="Readings while upright" value={setup.sched} options={[["1-3-5-10", "At 1, 3, 5 and 10 minutes"], ["every", "Every minute"]]} onPick={(v) => set({ sched: v })} />
      <p className="lab" id="pots-st-bp-l">Blood pressure</p>
      <div className="medrow" style={{ borderTop: "none", paddingTop: 0 }}>
        <div className="medinfo"><b id="pots-st-bp">I'll take blood pressure too</b><span>Optional, but clinicians usually want both. A heart rate alone can't show a blood-pressure drop. Keep the cuff arm supported at heart height, especially when standing.</span></div>
        <button type="button" className={`takebtn ${setup.bp ? "on" : ""}`} aria-pressed={setup.bp} aria-describedby="pots-st-bp" onClick={() => set({ bp: !setup.bp })}>{setup.bp ? "✓ On" : "Turn on"}</button>
      </div>
      <Choice id="pots-st-dev" label="Measuring with" value={setup.device} options={DEVICES} onPick={(v) => set({ device: setup.device === v ? null : v })} />
      <p className="lab">About today (optional)</p>
      <Choice id="pots-st-meds" label="Taken your usual medicines today?" value={ctx.meds} options={[["taken", "Yes"], ["not_yet", "Not yet"], ["none", "I don't take any"]]} onPick={(v) => c("meds", v)} hint="Do this the way your clinician asked." />
      <Choice id="pots-st-rate" label="Taken a heart-rate medicine today (like a beta blocker or ivabradine)?" value={ctx.rateMed} options={[["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]]} onPick={(v) => c("rateMed", v)} />
      <Choice id="pots-st-comp" label="Wearing compression?" value={ctx.comp} options={[[true, "Yes"], [false, "No"]]} onPick={(v) => c("comp", v)} />
      <Choice id="pots-st-ate" label="Eaten in the last 2 hours?" value={ctx.ate2h} options={[[true, "Yes"], [false, "No"]]} onPick={(v) => c("ate2h", v)} />
      <p className="plain" style={{ margin: "12px 0 4px" }}>{drinks != null ? `Drinks so far today: ${fmtFluid(drinks, units)}` : "Drinks so far today: none logged"}</p>
      <p className="hint">Try to test at the same time of day each time, so results compare. Many people see a bigger rise in the morning.</p>
      <p className="lab">How to lie</p>
      {preg ? (
        <>
          <p className="plain">Lie on your <b>left side</b>, not flat on your back.</p>
          <p className="hint">Lying flat on your back later in pregnancy can lower blood pressure, so rest on your left side.</p>
        </>
      ) : <p className="plain">Lie flat on your back.</p>}
      <button type="button" className="cta" onClick={onStart}>Start resting</button>
      <button type="button" className="ghostbtn" onClick={onNotToday}>Not today</button>
    </>
  );
}
