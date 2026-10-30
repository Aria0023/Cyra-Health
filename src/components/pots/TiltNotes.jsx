import { useEffect, useRef, useState } from "react";
import { removeTilt, newId } from "../../lib/pots.js";
import { Choice } from "./StandSafety.jsx";
import { numOf, numProps, dayLabel } from "./ui.js";

/* Tilt-table results (design 4.7), kept as she was told them, next to her stand tests, so
   everything is in one place for her clinician. Cyra stores the words and numbers she types and
   never interprets them: nothing here feeds a result, a pattern or a threshold. */
export const TILT_HINT = "Heard Health just keeps this with your other results so it's in one place for your clinician. It doesn't interpret it.";
const FAINT = [["no", "No"], ["almost", "Almost"], ["yes", "Yes"]];
const FAINT_WORD = { no: "didn't faint", almost: "almost fainted", yes: "fainted" };

export function TiltForm({ today, onSave, onCancel, headRef }) {
  const [date, setDate] = useState(today);
  const [where, setWhere] = useState("");
  const [told, setTold] = useState("");
  const [rise, setRise] = useState("");
  const [bp, setBp] = useState("");
  const [fainted, setFainted] = useState(null);
  const [err, setErr] = useState("");
  const save = () => {
    const n = numOf(rise);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) { setErr("Pick the date of the test (today or earlier)."); return; }
    if (n != null && (n < 0 || n > 200)) { setErr("Check the heart-rate rise (a number of beats a minute)."); return; }
    if (!where.trim() && !told.trim() && n == null && !bp.trim() && !fainted) { setErr("Add what you were told, or at least one detail."); return; }
    onSave({ id: newId(), date, where: where.trim(), told: told.trim(), hrRise: n == null ? null : Math.round(n), bpNote: bp.trim(), fainted });
  };
  return (
    <section className="plaincard" aria-labelledby="pots-tilt-h">
      <h2 className="obq" id="pots-tilt-h" tabIndex={-1} ref={headRef}>Add a tilt-table result</h2>
      <p className="hint" style={{ margin: "0 0 6px" }}>{TILT_HINT}</p>
      <label className="lab" htmlFor="pots-tilt-date">Date</label>
      <input id="pots-tilt-date" className="inp" type="date" aria-label="Date" max={today} value={date} onChange={(e) => { setDate(e.target.value); setErr(""); }} />
      <label className="lab" htmlFor="pots-tilt-where">Where (optional)</label>
      <input id="pots-tilt-where" className="inp" aria-label="Where (optional)" maxLength={80} value={where} onChange={(e) => { setWhere(e.target.value); setErr(""); }} />
      <label className="lab" htmlFor="pots-tilt-told">What the report or your clinician said</label>
      <textarea id="pots-tilt-told" className="inp" rows={4} maxLength={1000} aria-label="What the report or your clinician said" value={told} onChange={(e) => { setTold(e.target.value); setErr(""); }} />
      <label className="lab" htmlFor="pots-tilt-rise">Heart-rate rise they mentioned (optional)</label>
      <input id="pots-tilt-rise" className="inp" {...numProps()} aria-label="Heart-rate rise they mentioned (optional)" value={rise} onChange={(e) => { setRise(e.target.value); setErr(""); }} />
      <label className="lab" htmlFor="pots-tilt-bp">Blood pressure notes (optional)</label>
      <input id="pots-tilt-bp" className="inp" aria-label="Blood pressure notes (optional)" maxLength={200} value={bp} onChange={(e) => { setBp(e.target.value); setErr(""); }} />
      <Choice id="pots-tilt-faint" label="Did you faint during it?" value={fainted} options={FAINT} onPick={(v) => setFainted(fainted === v ? null : v)} />
      {err && <p className="errhint" role="alert" style={{ marginBottom: 10 }}>{err}</p>}
      <button type="button" className="cta" style={{ marginTop: 14 }} onClick={save}>Save</button>
      <button type="button" className="ghostbtn" onClick={onCancel}>Cancel</button>
    </section>
  );
}

/** Her saved tilt-table results, newest first, word for word. Remove asks first: what she
    typed goes for good (it is tombstoned, so no other window brings it back). */
export function TiltList({ pots, setPots, ping, onRemoved }) {
  const [asking, setAsking] = useState(null); // id of the result whose Remove confirm is open
  const confirmRef = useRef(null);
  useEffect(() => { if (asking) confirmRef.current?.focus(); }, [asking]);
  const list = [...(pots.tilt || [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (!list.length) return null;
  return (
    <>
      <h3 className="lab" id="pots-tilt-list-h" tabIndex={-1}>Tilt-table results (as you were told them)</h3>
      {list.map((x) => {
        const head = [dayLabel(x.date), x.where].filter(Boolean).join(" · ");
        const sub = [x.hrRise != null ? `heart-rate rise they mentioned: ${x.hrRise}` : null, x.bpNote || null, x.fainted ? FAINT_WORD[x.fainted] || null : null].filter(Boolean).join(" · ");
        return (
          <div key={x.id}>
            <div className="medrow">
              <div className="medinfo"><b>{head}</b>{x.told ? <span style={{ whiteSpace: "pre-wrap" }}>{x.told}</span> : null}{sub ? <span>{sub}</span> : null}</div>
              <button type="button" id={`pots-tilt-rm-${x.id}`} className="sbtn" aria-label={`Remove the tilt-table result from ${dayLabel(x.date)}`} aria-expanded={asking === x.id} onClick={() => setAsking(asking === x.id ? null : x.id)}>Remove</button>
            </div>
            {asking === x.id && (
              <div className="plaincard urgent" style={{ margin: "4px 0 10px" }}>
                <p className="plain" tabIndex={-1} ref={confirmRef}>{`Remove the ${dayLabel(x.date)} tilt-table result? What you typed is removed from your POTS log.`}</p>
                <button type="button" className="cta stopbtn" style={{ marginTop: 10 }} onClick={() => { setPots((p) => removeTilt(p, x.id)); setAsking(null); ping("Tilt-table result removed"); onRemoved?.(); }}>Remove</button>
                <button type="button" className="ghostbtn" onClick={() => { setAsking(null); document.getElementById(`pots-tilt-rm-${x.id}`)?.focus(); }}>Keep it</button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

