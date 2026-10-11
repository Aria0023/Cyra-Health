import { useEffect, useRef, useState } from "react";
import { nowHHMM, interruptFor } from "../../lib/pots.js";
import { THRESH, SAFETY_COPY } from "../../lib/potsConstants.js";
import { numOf, numProps } from "./ui.js";
import Advice from "../Advice.jsx";

/* "Add a single reading" (design 4.7): one heart rate and/or blood pressure by position,
   written to days[iso].vit. No threshold sentence: these aren't timed tests. A number outside
   the sane range shows "That looks unusual. Check the number?" and isn't saved until fixed or
   cleared. A very fast heart rate or a very high blood pressure shows the same safety copy as
   the stand test's live cards (SAFETY_COPY, clinician sign-off Q1), decided by the same rule
   (interruptFor): the value as typed counts up to the plausibility caps, so a real extreme
   reading outside the input-sanity range (HR 230, 270/130) still raises its card, though it
   isn't saved. In pregnancy the card adds the maternity-team line, as every UrgentCard does,
   says left side rather than flat on her back, and a blood pressure of 160/110 or higher raises
   its own maternity-unit card (SAFETY_COPY.urgent.pregBp); 140/90 or higher shows a same-day
   line (SAFETY_COPY.pregBpHigh, THRESH.preg*). */
const POS = [["lying", "Lying"], ["sitting", "Sitting"], ["standing", "Standing"]];
const R = THRESH.range;
const out = (v, [lo, hi]) => v != null && (v < lo || v > hi);

export default function VitalsForm({ v, isToday, preg = false, onSave, onCancel, headRef, announce }) {
  const [pos, setPos] = useState(v ? v.pos : null);
  const [hr, setHr] = useState(v && v.hr != null ? String(v.hr) : "");
  const [sys, setSys] = useState(v && v.sys != null ? String(v.sys) : "");
  const [dia, setDia] = useState(v && v.dia != null ? String(v.dia) : "");
  const [t, setT] = useState(v ? v.t : isToday ? nowHHMM() : "12:00");
  const [err, setErr] = useState("");
  const n = { hr: numOf(hr), sys: numOf(sys), dia: numOf(dia) };
  const bad = { hr: out(n.hr, R.hr), sys: out(n.sys, R.sys), dia: out(n.dia, R.dia) };
  // Resting position: only the very-fast-heart-rate and very-high-reading cards apply here.
  const ev = interruptFor(null, { type: "reading", reading: n, pos: "rest" }, { preg });
  const high = ev && (ev.kind === "hrHigh" || ev.kind === "bpCrisis" || ev.kind === "bpPregSevere") ? ev.kind : null;
  // Not a test, so the pregnancy card here has no "Stop the test".
  const highCopy = high === "bpPregSevere" ? SAFETY_COPY.urgent.pregBp : high ? ev.copy : "";
  const pregHigh = preg && !high && ((n.sys != null && !bad.sys && n.sys >= THRESH.pregHighSys) || (n.dia != null && !bad.dia && n.dia >= THRESH.pregHighDia));
  // Announced once when her typing makes the card appear (never for a reading opened to edit).
  const seen = useRef(high);
  useEffect(() => { if (high && high !== seen.current) announce?.(highCopy); seen.current = high; }, [high]); // eslint-disable-line
  const field = (id, label, val, set, isBad) => (
    <>
      <label className="lab" htmlFor={id}>{label}</label>
      <input id={id} className={`inp ${isBad ? "inpErr" : ""}`} {...numProps()} aria-label={label} aria-invalid={isBad || undefined} aria-describedby={isBad ? `${id}-err` : undefined} value={val} onChange={(e) => { set(e.target.value); setErr(""); }} />
      {isBad && <p className="errhint" id={`${id}-err`} style={{ marginTop: 0, marginBottom: 10 }}>That looks unusual. Check the number?</p>}
    </>
  );
  const save = () => {
    if (bad.hr || bad.sys || bad.dia) { setErr("Fix or clear the unusual number first."); return; }
    if (n.hr == null && n.sys == null && n.dia == null) { setErr("Add a heart rate or a blood pressure."); return; }
    const r = (x) => (x == null ? null : Math.round(x));
    onSave({ pos, hr: r(n.hr), sys: r(n.sys), dia: r(n.dia), t: /^\d{2}:\d{2}$/.test(t) ? t : nowHHMM() });
  };
  return (
    <section className="plaincard" aria-labelledby="pots-vit-h">
      <h2 className="obq" id="pots-vit-h" tabIndex={-1} ref={headRef}>{v ? "Change this reading" : "Add a single reading"}</h2>
      <p className="hint" style={{ margin: "0 0 6px" }}>Rest about 2 minutes in each position first. Keep the cuff arm supported at heart height.</p>
      <p className="lab">Position</p>
      <div className="mcrow" role="group" aria-label="Position" style={{ marginBottom: 6 }}>
        {POS.map(([k, l]) => <button type="button" key={k} className={`mc ${pos === k ? "on" : ""}`} aria-pressed={pos === k} onClick={() => setPos(pos === k ? null : k)}>{l}</button>)}
      </div>
      {field("pots-vit-hr", "Heart rate", hr, setHr, bad.hr)}
      {field("pots-vit-sys", "Top number (systolic)", sys, setSys, bad.sys)}
      {field("pots-vit-dia", "Bottom number (diastolic)", dia, setDia, bad.dia)}
      <label className="lab" htmlFor="pots-vit-t">Time</label>
      <input id="pots-vit-t" className="inp" type="time" aria-label="Time" value={t} onChange={(e) => setT(e.target.value)} />
      {high && <div className="plaincard urgent" data-urgent={high} style={{ marginBottom: 10 }}><span className="uchip u-now">Now</span><p className="plain">{highCopy}</p>{preg && high !== "bpPregSevere" && <p className="plain">{SAFETY_COPY.urgent.pregSuffix}</p>}</div>}
      {pregHigh && <div className="icard" style={{ marginBottom: 10 }}><Advice urgency="today" alone>{SAFETY_COPY.pregBpHigh}</Advice></div>}
      {err && <p className="errhint" role="alert" style={{ marginTop: 0, marginBottom: 10 }}>{err}</p>}
      <button type="button" className="cta" onClick={save}>{v ? "Save changes" : "Save reading"}</button>
      <button type="button" className="ghostbtn" onClick={onCancel}>Cancel</button>
    </section>
  );
}
