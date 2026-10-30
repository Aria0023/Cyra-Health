import { useEffect, useRef, useState } from "react";
import { POTS_MED_LIB } from "../../lib/potsConstants.js";
import { upsertMed, stopMed, removeMed } from "../../lib/pots.js";
import { hm, libFor } from "./ui.js";

/* Add or change a medicine or support (design 4.6). The list (POTS_MED_LIB) holds names and
   classes only, never a dose. Her note is her own words: never parsed, never checked, never
   used in any calculation (owner decision D8). Planned times are for her own plan; Cyra sends
   no reminder. "I've stopped this" keeps the medicine (before/after views still work);
   "Remove completely" asks first. */
export const LIB_FOOT = "Names, classes and a short plain description only. Heard Health never suggests a medicine, a dose, or a change.";
const KINDS = [["rx", "Prescription"], ["otc", "Over the counter"], ["supp", "Supplement"], ["aid", "Support (compression etc.)"]];
const libByName = (name) => POTS_MED_LIB.find((x) => x.name.toLowerCase() === String(name || "").trim().toLowerCase()) || null;
const PREG_LINE = "Pregnant or planning to be? Ask your prenatal team or prescriber about every medicine and supplement you take for POTS. Some aren't used in pregnancy.";

function MedForm({ med, setPots, today, pregOrTtc, onDone, onGoCard, headRef }) {
  const [name, setName] = useState(med ? med.name : "");
  const [kind, setKind] = useState(med ? med.kind : "rx");
  const [times, setTimes] = useState(med ? med.times : []);
  const [started, setStarted] = useState(med?.started || "");
  const [note, setNote] = useState(med?.note || "");
  const [ask, setAsk] = useState(null); // null | "stop" | "remove"
  const [stopOn, setStopOn] = useState(today);
  const [err, setErr] = useState("");
  // Opening a confirm moves focus to its first line; closing it returns focus to its link.
  const askRef = useRef(null), asked = useRef(null);
  useEffect(() => {
    if (ask) { asked.current = ask; askRef.current?.focus(); }
    else if (asked.current) { document.getElementById(asked.current === "stop" ? "pots-med-stopbtn" : "pots-med-rmbtn")?.focus(); asked.current = null; }
  }, [ask]);
  const lib = libByName(name);
  const sodiumLike = /salt\s*tablet|electrolyte/i.test(name);
  const pickName = (v) => { setName(v); setErr(""); const l = libByName(v); if (l && !med) setKind(l.kind); };
  const save = () => {
    if (!name.trim()) { setErr("Add a name."); return; }
    setPots((p) => upsertMed(p, { ...(med || {}), name: name.trim(), lib: lib ? lib.id : null, kind, times: kind === "aid" ? [] : times.filter((t) => /^\d{2}:\d{2}$/.test(t)), started: started || null, note: note.trim() }));
    onDone(med ? "Saved" : `${name.trim()} added`);
  };
  return (
    <section className="plaincard" aria-labelledby="pots-medform-h" style={{ marginBottom: 12 }}>
      <h2 className="obq" id="pots-medform-h" tabIndex={-1} ref={headRef}>{med ? `Change ${med.name}` : "Add a medicine or support"}</h2>
      <label className="lab" htmlFor="pots-med-name" style={{ marginTop: 0 }}>Name</label>
      <input id="pots-med-name" className="inp" list="pots-meds" aria-label="Medicine or support name" maxLength={40} autoComplete="off" value={name} onChange={(e) => pickName(e.target.value)} />
      <datalist id="pots-meds">{POTS_MED_LIB.map((x) => <option key={x.id} value={x.name} />)}</datalist>
      {lib && (lib.cls || lib.line) && <p className="hint" style={{ margin: "-2px 0 8px" }}>{[lib.cls, lib.line].filter(Boolean).join(" · ")}</p>}
      {sodiumLike && (
        <p className="hint" style={{ margin: "0 0 8px" }}>Log these under Sodium or Fluids so they count toward your totals. <button type="button" className="linkbtn" onClick={() => onGoCard(/electrolyte/i.test(name) ? "fluid" : "salt")}>{/electrolyte/i.test(name) ? "Go to Fluids" : "Go to Sodium"}</button></p>
      )}
      <p className="lab">Type</p>
      <div className="mcrow" role="group" aria-label="Type" style={{ marginBottom: 6 }}>
        {KINDS.map(([k, l]) => <button type="button" key={k} className={`mc ${kind === k ? "on" : ""}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      {kind !== "aid" && (
        <>
          <p className="lab">Usual times (optional)</p>
          {times.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input className="inp" type="time" aria-label={`Usual time ${i + 1}`} value={t} onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))} />
              <button type="button" className="sbtn" aria-label={`Remove usual time ${i + 1}`} onClick={() => setTimes(times.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          {times.length < 6 && <button type="button" className="linkbtn" onClick={() => setTimes([...times, ""])}>{times.length ? "+ another time" : "+ add a time"}</button>}
          <p className="hint" style={{ margin: "6px 0 0" }}>These are for your own plan. Heard Health doesn't send reminders.</p>
        </>
      )}
      <label className="lab" htmlFor="pots-med-started">Started (optional)</label>
      <input id="pots-med-started" className="inp" type="date" aria-label="Started (optional)" max={today} value={started} onChange={(e) => setStarted(e.target.value)} />
      <label className="lab" htmlFor="pots-med-note" style={{ marginTop: 6 }}>Your note (optional)</label>
      <input id="pots-med-note" className="inp" aria-label="Your note (optional)" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
      <p className="hint" style={{ margin: "-2px 0 10px" }}>For example, what your label says. Heard Health never checks or suggests amounts.</p>
      {err && <p className="errhint" role="alert" style={{ marginTop: 0, marginBottom: 10 }}>{err}</p>}
      <button type="button" className="cta" onClick={save}>Save</button>
      {med && !med.stopped && ask !== "stop" && <button type="button" id="pots-med-stopbtn" className="linkbtn" style={{ marginTop: 10, display: "block" }} onClick={() => setAsk("stop")}>I've stopped this</button>}
      {med && ask === "stop" && (
        <div className="plaincard" style={{ marginTop: 10 }}>
          <p className="plain" tabIndex={-1} ref={askRef} style={{ marginTop: 0 }}>{`When did you stop ${med.name}?`}</p>
          <label className="lab" htmlFor="pots-med-stop" style={{ marginTop: 0 }}>Stopped on</label>
          <input id="pots-med-stop" className="inp" type="date" aria-label="Stopped on" max={today} value={stopOn} onChange={(e) => setStopOn(e.target.value)} />
          <p className="hint" style={{ margin: "0 0 8px" }}>It stays in your log, so you can still look back at it.</p>
          <button type="button" className="cta" onClick={() => { setPots((p) => stopMed(p, med.id, /^\d{4}-\d{2}-\d{2}$/.test(stopOn) ? stopOn : today)); onDone(`${med.name} marked stopped`); }}>Mark as stopped</button>
          <button type="button" className="ghostbtn" onClick={() => setAsk(null)}>Cancel</button>
        </div>
      )}
      {med && ask !== "remove" && <button type="button" id="pots-med-rmbtn" className="linkbtn" style={{ marginTop: 10, display: "block" }} onClick={() => setAsk("remove")}>Remove completely</button>}
      {med && ask === "remove" && (
        <div className="plaincard" style={{ marginTop: 10 }}>
          <p className="plain" tabIndex={-1} ref={askRef}>Remove {med.name} completely? Doses you logged stay on their days, but the name goes from your list. To keep it for looking back, use "I've stopped this" instead.</p>
          <button type="button" className="cta stopbtn" onClick={() => { setPots((p) => removeMed(p, med.id)); onDone(`${med.name} removed`); }}>Remove</button>
          <button type="button" className="ghostbtn" onClick={() => setAsk(null)}>Keep it</button>
        </div>
      )}
      <button type="button" className="ghostbtn" onClick={() => onDone(null)}>Cancel</button>
      {pregOrTtc && <p className="rfoot">{PREG_LINE}</p>}
      <p className="rfoot">{LIB_FOOT}</p>
    </section>
  );
}

/** The editor: her medicines and supports (in use, then stopped) and the add / change form.
    Swapping list and form moves focus: into the form, to its heading; back to the list, to the
    button that opened the form ("Change" for that medicine, or "Add a medicine or support"),
    or the list's heading when that medicine is gone. Never to the page. */
export default function MedEditor({ pots, setPots, today, pregOrTtc, ping, onClose, onGoCard, headRef }) {
  const [editing, setEditing] = useState(pots.meds.length ? null : "new"); // null | "new" | med id
  const med = editing && editing !== "new" ? pots.meds.find((m) => m.id === editing) : null;
  const openerId = useRef(null), mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const el = !editing && openerId.current ? document.getElementById(openerId.current) : null;
    (el || headRef?.current)?.focus();
  }, [editing]); // eslint-disable-line
  const edit = (id) => { openerId.current = id === "new" ? "pots-med-add" : `pots-medchg-${id}`; setEditing(id); };
  if (editing) {
    return <MedForm key={editing} med={med} setPots={setPots} today={today} pregOrTtc={pregOrTtc} headRef={headRef} onGoCard={onGoCard}
      onDone={(msg) => { if (msg) ping(msg); if (!pots.meds.length && !msg) onClose(); else setEditing(null); }} />;
  }
  const inUse = pots.meds.filter((m) => !m.stopped || m.stopped >= today), stopped = pots.meds.filter((m) => m.stopped && m.stopped < today);
  const row = (m) => (
    <div className="medrow" key={m.id}>
      <div className="medinfo"><b>{m.name}</b><span>{[libFor(m)?.cls, m.times.length ? `planned ${m.times.map(hm).join(" · ")}` : null, m.stopped ? `stopped ${m.stopped}` : null].filter(Boolean).join(" · ") || (m.kind === "aid" ? "Support" : "No planned times")}</span></div>
      <button type="button" id={`pots-medchg-${m.id}`} className="sbtn" aria-label={`Change ${m.name}`} onClick={() => edit(m.id)}>Change</button>
    </div>
  );
  return (
    <section className="plaincard" aria-labelledby="pots-medlist-h" style={{ marginBottom: 12 }}>
      <h2 className="obq" id="pots-medlist-h" tabIndex={-1} ref={headRef}>Medicines and supports</h2>
      {inUse.map(row)}
      {stopped.length > 0 && <><p className="lab">Stopped</p>{stopped.map(row)}</>}
      {pots.meds.length < 30
        ? <button type="button" id="pots-med-add" className="cta" style={{ marginTop: 10 }} onClick={() => edit("new")}>Add a medicine or support</button>
        : <p className="hint">You have 30 on your list. Remove one to add another.</p>}
      <button type="button" className="ghostbtn" onClick={onClose}>Done</button>
      {pregOrTtc && <p className="rfoot">{PREG_LINE}</p>}
      <p className="rfoot">{LIB_FOOT}</p>
    </section>
  );
}

/** First-run card 3, "Any POTS medicines or supports?": library chips; each one picked asks
    for optional times; "Add another" takes any name. Next saves them (saveRef). */
export function MedSetup({ setPots, saveRef }) {
  const [picked, setPicked] = useState([]); // [{ key, name, lib, kind, times: [] }]
  const [other, setOther] = useState("");
  const toggle = (l) => setPicked(picked.some((x) => x.key === l.id) ? picked.filter((x) => x.key !== l.id) : [...picked, { key: l.id, name: l.name, lib: l.id, kind: l.kind, times: [] }]);
  const addOther = () => { const n = other.trim(); if (!n) return; const l = libByName(n); setPicked([...picked, { key: `o${picked.length}-${n}`, name: n.slice(0, 40), lib: l ? l.id : null, kind: l ? l.kind : "rx", times: [] }]); setOther(""); };
  const setTimes = (key, times) => setPicked(picked.map((x) => (x.key === key ? { ...x, times } : x)));
  saveRef.current = () => {
    if (picked.length) setPots((p) => picked.reduce((q, x) => upsertMed(q, { name: x.name, lib: x.lib, kind: x.kind, times: x.times.filter((t) => /^\d{2}:\d{2}$/.test(t)), started: null, note: "" }), p));
    return true;
  };
  return (
    <>
      <div className="wrapchips" role="group" aria-label="Medicines and supports" style={{ marginBottom: 10 }}>
        {POTS_MED_LIB.map((l) => { const on = picked.some((x) => x.key === l.id); return <button type="button" key={l.id} className={`minichip big ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggle(l)}>{l.name}</button>; })}
      </div>
      <label className="lab" htmlFor="pots-setup-other" style={{ marginTop: 0 }}>Add another</label>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <input id="pots-setup-other" className="inp" aria-label="Add another medicine or support" maxLength={40} value={other} onChange={(e) => setOther(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addOther(); }} />
        <button type="button" className="sbtn" onClick={addOther}>Add</button>
      </div>
      {picked.filter((x) => x.kind !== "aid").map((x) => (
        <div key={x.key} style={{ marginBottom: 8 }} role="group" aria-label={`${x.name}, usual times`}>
          <p className="plain" style={{ margin: "6px 0 4px" }}><b>{x.name}</b>: usual times (optional)</p>
          {x.times.map((t, i) => <input key={i} className="inp" type="time" aria-label={`${x.name}, usual time ${i + 1}`} value={t} onChange={(e) => setTimes(x.key, x.times.map((y, j) => (j === i ? e.target.value : y)))} />)}
          {x.times.length < 6 && <button type="button" className="linkbtn" onClick={() => setTimes(x.key, [...x.times, ""])}>{x.times.length ? "+ another time" : "+ add a time"}</button>}
        </div>
      ))}
      {picked.some((x) => x.kind === "aid") && <p className="hint" style={{ margin: "4px 0 8px" }}>Supports are a simple yes or no each day.</p>}
      <p className="hint" style={{ margin: "4px 0 12px" }}>These are for your own plan. Heard Health doesn't send reminders.</p>
      <p className="rfoot" style={{ marginTop: 0, marginBottom: 12 }}>{LIB_FOOT}</p>
    </>
  );
}
