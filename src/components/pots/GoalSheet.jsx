import { useState } from "react";
import { setSettings } from "../../lib/pots.js";
import { GUIDE_COPY } from "../../lib/potsConstants.js";
import Details from "../Details.jsx";
import { isOz, numOf, notNum, numProps, toMl, toNaMg, mlIn, naIn } from "./ui.js";

/* Her daily goals (design 4.5): set with her clinician, never pre-filled and never a default.
   Guideline context sits behind a cited Details panel (GUIDE_COPY; the figures stay out until
   the clinical reviewer checks them, GUIDE_VERIFIED). A registration answer of high blood
   pressure only adds an on-screen caution here; it is never used anywhere else. */
const para = (segs) => segs.map((s, i) => (typeof s === "string" ? s : <b key={i}>{s.b}</b>));

export function GuideDetails({ label }) {
  return <Details label={label}>{GUIDE_COPY.map((segs, i) => <p key={i}>{para(segs)}</p>)}</Details>;
}

/** The goal form. `saveRef` (setup card): Next calls saveRef.current(). Otherwise it has its
    own Save and Cancel. */
export default function GoalSheet({ pots, setPots, units, conditions = [], preg = false, saveRef, onDone, headRef, setup = false, today }) {
  const g = pots.settings.goals;
  const [fl, setFl] = useState(() => mlIn(g.fluidMl, units));
  const [na, setNa] = useState(() => naIn(g.naMg, units?.salt === "gSalt"));
  const [gSalt, setGSalt] = useState(units?.salt === "gSalt");
  const [by, setBy] = useState(g.by);
  const [err, setErr] = useState("");
  const highBp = Array.isArray(conditions) && conditions.includes("High blood pressure");

  const commit = () => {
    const fluidMl = toMl(numOf(fl), units), naMg = toNaMg(numOf(na), gSalt);
    if (notNum(fl) || notNum(na) || (fluidMl != null && (fluidMl < 1 || fluidMl > 5000)) || (naMg != null && (naMg < 1 || naMg > 20000))) { setErr("Check the numbers: up to 5,000 ml of fluid and 20,000 mg of sodium a day."); return false; }
    const none = fluidMl == null && naMg == null;
    setPots((p) => setSettings(p, { goals: { fluidMl, naMg, by: none ? null : by, set: none ? null : today } }));
    return true;
  };
  if (saveRef) saveRef.current = commit;
  const clear = () => { setFl(""); setNa(""); setBy(null); setErr(""); if (!setup) { setPots((p) => setSettings(p, { goals: { fluidMl: null, naMg: null, by: null, set: null } })); onDone?.("cleared"); } };

  const body = (
    <>
      {!setup && <h2 className="obq" id="pots-goal-h" tabIndex={-1} ref={headRef}>Your daily goals</h2>}
      {setup && <p className="lab" style={{ marginTop: 0 }}>Your daily goals</p>}
      <p className="hint" style={{ marginBottom: 10 }}>Set these with your clinician. Heard Health tracks them; it doesn't choose them.</p>
      {highBp && <div className="plaincard" style={{ marginBottom: 10 }}><p className="plain">You told Heard Health you have high blood pressure. Extra salt can raise it further, so please set any salt goal with your clinician.</p></div>}
      {preg && <p className="plain">In pregnancy, ask your prenatal team before changing how much salt or fluid you have.</p>}
      <label className="lab" htmlFor="pots-goal-fl">{isOz(units) ? "Fluid goal (oz a day)" : "Fluid goal (ml a day)"}</label>
      <input id="pots-goal-fl" className="inp" {...numProps(isOz(units))} aria-label={isOz(units) ? "Fluid goal (oz a day)" : "Fluid goal (ml a day)"} value={fl} onChange={(e) => { setFl(e.target.value); setErr(""); }} />
      <label className="lab" htmlFor="pots-goal-na" style={{ marginTop: 6 }}>Sodium goal</label>
      <input id="pots-goal-na" className="inp" {...numProps(gSalt)} aria-label={gSalt ? "Sodium goal, grams of salt a day" : "Sodium goal, milligrams of sodium a day"} value={na} onChange={(e) => { setNa(e.target.value); setErr(""); }} />
      <div className="mcrow" role="group" aria-label="Sodium goal unit" style={{ marginBottom: 10 }}>
        {[[false, "mg sodium"], [true, "g salt"]].map(([v, l]) => <button type="button" key={l} className={`mc ${gSalt === v ? "on" : ""}`} aria-pressed={gSalt === v} onClick={() => setGSalt(v)}>{l}</button>)}
      </div>
      <p className="lab">Who set these?</p>
      <div className="mcrow" role="group" aria-label="Who set these?" style={{ marginBottom: 10 }}>
        {[["clinician", "My clinician"], ["me", "Me"]].map(([v, l]) => <button type="button" key={v} className={`mc ${by === v ? "on" : ""}`} aria-pressed={by === v} onClick={() => setBy(by === v ? null : v)}>{l}</button>)}
      </div>
      <button type="button" className="linkbtn" style={{ marginBottom: 6 }} onClick={clear}>Clear goals</button>
      <GuideDetails label={highBp ? "Guideline ranges, for context" : "What guidelines say"} />
      {err && <p className="errhint" role="alert" style={{ marginTop: 0, marginBottom: 10 }}>{err}</p>}
    </>
  );
  if (setup) return body;
  return (
    <section className="plaincard" aria-labelledby="pots-goal-h">
      {body}
      <button type="button" className="cta" onClick={() => { if (commit()) onDone?.("saved"); }}>Save goals</button>
      <button type="button" className="ghostbtn" onClick={() => onDone?.(null)}>Cancel</button>
    </section>
  );
}
