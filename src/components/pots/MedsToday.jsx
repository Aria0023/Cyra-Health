import { useEffect, useState } from "react";
import { activeMeds, logDose, setAid, removeItem, updateItem, newId, nowHHMM, toMin, doseTime } from "../../lib/pots.js";
import { THRESH } from "../../lib/potsConstants.js";
import { hm, libFor } from "./ui.js";

/* "Medicines & supports" on Today (design 4.6). Names and planned times she entered; Cyra
   never suggests a medicine, an amount or a change. A slot she hasn't logged stays unknown:
   never "missed" or "late". A past one reads "Planned 8:00 · Took it?" until the day ends.
   Supports (kind "aid") are a yes/no "Wearing it today". */
/** "Midodrine 8:00 taken at 8:05": how a dose reads in the Undo row and the "Removed:" toast. */
export const doseText = (name, d) => `${name}${d.slot ? ` ${hm(d.slot)}` : ""} ${d.state === "skipped" ? "skipped" : "taken"} at ${hm(d.t)}`;

export const MEDS_FOOT = "Cyra keeps only what you enter, such as names, times and your own note. It never suggests a medicine, an amount, or a change to when you take one. That's for you and your clinician.";

function MedRow({ med, doses, aids, isToday, day, setPots, remember, onRemoved }) {
  const lib = libFor(med);
  const mine = doses.filter((d) => d.medId === med.id);
  const logged = new Set(mine.filter((d) => d.slot).map((d) => d.slot));
  const now = toMin(nowHHMM());
  const open = med.times.filter((s) => !logged.has(s));
  const byNear = (a, b) => Math.abs(toMin(a) - now) - Math.abs(toMin(b) - now);
  // The button is for the nearest unlogged slot to now (today) or the first unlogged one (an
  // earlier day). The slot she just logged here, or one logged in the last 30 minutes, keeps
  // its "✓ 12:04" there (so a quick second tap opens the time fix instead of logging the next
  // slot); with every slot logged, the nearest one's ✓ shows. Other logged doses are the small
  // time chips below.
  const [just, setJust] = useState(null); // the slot logged from this row during this visit
  const fresh = isToday ? mine.filter((d) => d.slot && (d.slot === just || Math.abs(toMin(d.t) - now) <= THRESH.repeatMin)).pop() : null;
  const near = fresh ? fresh.slot : isToday ? [...open].sort(byNear)[0] || [...med.times].sort(byNear)[0] : open[0];
  const nearDose = near ? mine.find((d) => d.slot === near) : null;
  const past = isToday ? open.filter((s) => s !== near && toMin(s) < now) : open.filter((s) => s !== near);
  const log = (slot, state) => {
    const id = newId(), t = doseTime(slot, isToday);
    setPots((p) => logDose(p, day, { id, medId: med.id, slot, state, t }));
    if (!slot || !mine.some((d) => d.slot === slot)) remember({ ids: [id], text: `${med.name}${slot ? ` ${hm(slot)}` : ""} ${state === "skipped" ? "skipped" : "taken"} at ${hm(t)}` });
    if (slot) { setJust(slot); setFocusTo(doseBtn(id)); } // the tapped button is replaced by the dose's ✓
  };
  const [fix, setFix] = useState(null); // dose id whose time is being fixed
  // Closing the time fix (or removing a dose) hands focus back to that dose's button, or to the
  // card's heading when the dose is gone, never to the page.
  const [focusTo, setFocusTo] = useState(null);
  useEffect(() => {
    if (!focusTo) return;
    setFocusTo(null);
    (document.getElementById(focusTo) || document.getElementById("pots-meds-h"))?.focus();
  }, [focusTo]);
  const doseBtn = (id) => `pots-dose-${id}`;
  // Removing a dose (the × chip or the time fix's Remove) is announced like Today's-log Remove,
  // and drops a now-stale Undo row for it.
  const remove = (d) => {
    setPots((p) => removeItem(p, day, d.id));
    onRemoved?.(d.id, doseText(med.name, d));
  };
  const sub = [lib?.cls, med.times.length ? `planned ${med.times.map(hm).join(" · ")}` : null].filter(Boolean).join(" · ");
  if (med.kind === "aid") {
    const worn = aids[med.id];
    return (
      <div className="medrow">
        <div className="medinfo"><b>{med.name}</b>{lib?.cls ? <span>{lib.cls}</span> : null}</div>
        <button type="button" className={`mc ${worn === true ? "on" : ""}`} aria-pressed={worn === true} aria-label={`Wearing ${med.name} today`} onClick={() => setPots((p) => setAid(p, day, med.id, worn !== true))}>Wearing it today</button>
      </div>
    );
  }
  return (
    <div className="medrow" style={{ flexWrap: "wrap" }}>
      <div className="medinfo" style={{ flex: "1 1 160px" }}><b>{med.name}</b>{sub ? <span>{sub}</span> : null}</div>
      <div className="wearbtns" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
        {!med.times.length && <button type="button" className="takebtn" aria-label={`Took ${med.name}`} onClick={() => log(null, "taken")}>Took it</button>}
        {near && nearDose && <button type="button" id={doseBtn(nearDose.id)} className="takebtn on" aria-pressed="true" aria-label={`${med.name} ${hm(near)}: ${nearDose.state === "skipped" ? "skipped" : `taken at ${hm(nearDose.t)}`}`} onClick={() => setFix(nearDose.id)}>{nearDose.state === "skipped" ? `Skipped (${hm(near)})` : `✓ ${hm(nearDose.t)}`}</button>}
        {near && !nearDose && (
          <>
            <button type="button" className="takebtn" aria-label={`Took ${med.name}, ${hm(near)} dose`} onClick={() => log(near, "taken")}>Took it ({hm(near)})</button>
            <button type="button" className="sbtn" aria-label={`Skipped ${med.name}, ${hm(near)} dose`} onClick={() => log(near, "skipped")}>Skipped</button>
          </>
        )}
      </div>
      {(past.length > 0 || mine.length > 0) && (
        <div className="wrapchips" style={{ width: "100%", marginTop: 6 }}>
          {past.map((s) => <button type="button" key={s} className="sbtn" aria-label={`Planned ${hm(s)}: took ${med.name}?`} onClick={() => log(s, "taken")}>Planned {hm(s)} · Took it?</button>)}
          {mine.filter((d) => d.id !== nearDose?.id).map((d) => (
            <span key={d.id} style={{ display: "inline-flex", gap: 4 }}>
              <button type="button" id={doseBtn(d.id)} className="sbtn" aria-label={`Change time of ${hm(d.t)} dose of ${med.name}`} onClick={() => setFix(d.id)}>{d.state === "skipped" ? `Skipped ${d.slot ? hm(d.slot) : ""}`.trim() : hm(d.t)}</button>
              <button type="button" className="sbtn" aria-label={`Remove ${hm(d.t)} dose of ${med.name}`} onClick={() => { remove(d); setFocusTo("pots-meds-h"); }}>×</button>
            </span>
          ))}
        </div>
      )}
      {fix && mine.some((d) => d.id === fix) && <DoseFix dose={mine.find((d) => d.id === fix)} name={med.name} onDone={(patch) => { if (patch === "remove") remove(mine.find((d) => d.id === fix)); else if (patch) setPots((p) => updateItem(p, day, fix, patch)); setFocusTo(doseBtn(fix)); setFix(null); }} />}
    </div>
  );
}

/** Fix the time (or taken / skipped) of a logged dose, in place. */
export function DoseFix({ dose, name, onDone }) {
  const [t, setT] = useState(dose.t);
  const [state, setState] = useState(dose.state);
  return (
    <div className="plaincard" style={{ width: "100%", marginTop: 8 }} role="group" aria-label={`${name} dose`}>
      <label className="lab" htmlFor={`fix-${dose.id}`} style={{ marginTop: 0 }}>Time</label>
      <input id={`fix-${dose.id}`} className="inp" type="time" aria-label={`Time of the ${name} dose`} value={t} onChange={(e) => setT(e.target.value)} />
      <div className="mcrow" role="group" aria-label="Taken or skipped" style={{ marginBottom: 8 }}>
        {[["taken", "Taken"], ["skipped", "Skipped"]].map(([v, l]) => <button type="button" key={v} className={`mc ${state === v ? "on" : ""}`} aria-pressed={state === v} onClick={() => setState(v)}>{l}</button>)}
      </div>
      <div className="wearbtns">
        <button type="button" className="sbtn" onClick={() => onDone(/^\d{2}:\d{2}$/.test(t) ? { t, state } : { state })}>Save</button>
        <button type="button" className="sbtn" onClick={() => onDone("remove")}>Remove</button>
        <button type="button" className="sbtn" onClick={() => onDone(null)}>Cancel</button>
      </div>
    </div>
  );
}

export default function MedsToday({ pots, day, isToday, setPots, remember, onRemoved, onEdit }) {
  const d = pots.days[day] || {};
  const doses = d.doses || [], aids = d.aids || {};
  const meds = activeMeds(pots, day);
  return (
    <section className="plaincard" aria-labelledby="pots-meds-h" style={{ marginBottom: 12 }}>
      <h2 className="lab" id="pots-meds-h" style={{ marginTop: 0 }} tabIndex={-1}>Medicines &amp; supports</h2>
      {!meds.length && <p className="hint" style={{ margin: "0 0 6px" }}>Nothing added yet.</p>}
      {meds.map((m) => <MedRow key={m.id} med={m} doses={doses} aids={aids} isToday={isToday} day={day} setPots={setPots} remember={remember} onRemoved={onRemoved} />)}
      <button type="button" className="linkbtn" style={{ marginTop: 6 }} onClick={onEdit}>Add or change medicines</button>
      <p className="rfoot">{MEDS_FOOT}</p>
    </section>
  );
}
