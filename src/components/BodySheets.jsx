import { useState } from "react";
import { Sheet } from "./ui/index.js";
import Icon from "./Icon.jsx";
import Details from "./Details.jsx";
import { MODULE_FRAMING, MODULES, sourcesOf } from "../lib/modules.js";
import {
  MOVE_TYPES, MOVE_MINUTES, MOVE_MAX, SLEEP_CHIPS, SLEEP_MAX, SLEEP_STEP, hoursText, bodyDay, moveLabel, PCOS_DAY, LAB_KINDS,
  WEIGHT_UNITS, labText, convert, checkValue,
} from "../lib/bodylog.js";

/* The fast log's sheets (calm R4, spec §3.5b). Each one writes on tap: there is no Save to forget, and she can close it
   whenever. Everything is on this device only (lib/bodylog.js keys bodyLog / labs / bodyPrefs, and the existing meds /
   medLog). `day` is the day being logged (today unless she picked another on the Logs strip); `dayWord` names it. */

const fmtDay = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const whyText = (r, unit) => (r.why === "range" ? `That looks outside ${r.lo}–${r.hi} ${unit}. Check the number?` : r.why === "date" ? "Pick the date of the test." : "Type a number, like 5.4.");

/* ---------- Sleep: hours, one tap ---------- */
export function SleepSheet({ day, dayWord, log, onSet, onClose }) {
  const h = bodyDay(log, day).sleepH ?? null;
  const step = (d) => onSet(Math.max(0, Math.min(SLEEP_MAX, (h ?? 7) + d)));
  return (
    <Sheet id="sleep-sheet" title="Sleep" closeLabel="Close sleep" onClose={onClose} className="bsheet">
      <p className="bsheet-sub">Hours slept, {dayWord}. How it felt stays in the check-in.</p>
      <div className="bigval" aria-live="polite"><span className="serif">{h == null ? "—" : hoursText(h)}</span></div>
      <div className="hourchips" role="group" aria-label="Hours slept">
        {SLEEP_CHIPS.map((n) => <button key={n} type="button" className={`mc ${h === n ? "on" : ""}`} aria-pressed={h === n} onClick={() => onSet(n)}>{n === SLEEP_CHIPS[SLEEP_CHIPS.length - 1] ? `${n}h+` : `${n}h`}</button>)}
      </div>
      <div className="stepper" role="group" aria-label="Adjust by half an hour">
        <button type="button" className="sbtn" aria-label="Half an hour less" disabled={h != null && h <= 0} onClick={() => step(-SLEEP_STEP)}>−</button>
        <span className="hint">½ hour</span>
        <button type="button" className="sbtn" aria-label="Half an hour more" disabled={h != null && h >= SLEEP_MAX} onClick={() => step(SLEEP_STEP)}>+</button>
      </div>
      <div className="bsheet-foot">
        {h != null && <button type="button" className="linkbtn" onClick={() => onSet(null)}>Clear hours</button>}
        <button type="button" className="cta" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  );
}

/* ---------- Move: type, then minutes (the minutes tap adds it) ---------- */
export function MoveSheet({ day, dayWord, log, onAdd, onRemove, onClose, lastType = "walk" }) {
  const [type, setType] = useState(lastType);
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState("");
  const mv = bodyDay(log, day).move || [];
  const addCustom = () => {
    const n = Number(String(custom).trim());
    if (!Number.isInteger(n) || n < 1 || n > MOVE_MAX) { setErr(`Minutes from 1 to ${MOVE_MAX}.`); return; }
    setErr(""); setCustom(""); onAdd({ type, min: n });
  };
  return (
    <Sheet id="move-sheet" title="Movement" closeLabel="Close movement" onClose={onClose} className="bsheet">
      <p className="bsheet-sub">Any kind counts. Pick what, then how long, {dayWord}.</p>
      <p className="lab" id="move-type-lab">What</p>
      <div className="typechips" role="group" aria-labelledby="move-type-lab">
        {MOVE_TYPES.map((t) => <button key={t.id} type="button" className={`mc ${type === t.id ? "on" : ""}`} aria-pressed={type === t.id} onClick={() => setType(t.id)}>{t.label}</button>)}
      </div>
      <p className="lab" id="move-min-lab">How long · tap to add</p>
      <div className="minchips" role="group" aria-labelledby="move-min-lab">
        {MOVE_MINUTES.map((n, i) => <button key={n} type="button" className="mc minchip" aria-label={`Add ${moveLabel(type)}, ${n}${i === MOVE_MINUTES.length - 1 ? " or more" : ""} minutes`} onClick={() => onAdd({ type, min: n })}>{i === MOVE_MINUTES.length - 1 ? `${n}+` : n}<small> min</small></button>)}
      </div>
      <div className="customrow">
        <input className="inp" inputMode="numeric" aria-label="Custom minutes" placeholder="Custom minutes" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))} onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }} aria-invalid={!!err} aria-describedby={err ? "move-err" : undefined} />
        <button type="button" className="sbtn" onClick={addCustom}>Add</button>
      </div>
      {err && <p className="fielderr" id="move-err" role="alert">{err}</p>}
      {mv.length > 0 && (
        <ul className="sesslist" aria-label={`Movement ${dayWord}`}>
          {mv.map((m) => (
            <li key={m.id}><Icon name="move" size={16} /><span>{moveLabel(m.type)} · {m.min} min</span>
              <button type="button" className="linkbtn" aria-label={`Remove ${moveLabel(m.type)}, ${m.min} minutes`} onClick={() => onRemove(m.id)}>Remove</button></li>
          ))}
        </ul>
      )}
      <div className="bsheet-foot"><button type="button" className="cta" onClick={onClose}>Done</button></div>
    </Sheet>
  );
}

/* ---------- Meds: her list, one tap taken; add / remove ---------- */
const KINDS = [["rx", "Prescription"], ["supp", "Supplement"], ["habit", "Habit"]];
export function MedsSheet({ day, dayWord, todayIso, meds, medDay, onToggle, onAdd, onRemove, onClose }) {
  const [edit, setEdit] = useState(meds.length === 0);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("supp");
  const [err, setErr] = useState("");
  const add = () => {
    const n = name.trim().slice(0, 60);
    if (!n) { setErr("Give it a name first."); return; }
    setErr(""); setName(""); onAdd({ name: n, kind, started: todayIso });
  };
  return (
    <Sheet id="meds-sheet" title="Meds & supplements" closeLabel="Close meds" onClose={onClose} className="bsheet">
      {meds.length > 0 && <p className="bsheet-sub">Tap what you took {dayWord}.</p>}
      {meds.length > 0 && (
        <div className="medtakes" role="group" aria-label={`Taken ${dayWord}`}>
          {meds.map((m) => {
            const on = !!(medDay || {})[m.id];
            return (
              <div key={m.id} className="medtake-row">
                <button type="button" className={`medtake ${on ? "on" : ""}`} aria-pressed={on} onClick={() => onToggle(m.id)}>
                  <span className="medtake-tick" aria-hidden="true">{on ? <Icon name="check" size={14} /> : null}</span>
                  <span className="medtake-name">{m.name}</span>
                </button>
                {edit && <button type="button" className="linkbtn" aria-label={`Remove ${m.name} from your list`} onClick={() => onRemove(m.id)}>Remove</button>}
              </div>
            );
          })}
        </div>
      )}
      {edit ? (
        <div className="medadd">
          <p className="lab" id="medadd-lab">{meds.length ? "Add to your list" : "Your list is empty. Add a med, supplement or habit"}</p>
          <input className="inp" aria-labelledby="medadd-lab" placeholder="e.g. Metformin · Inositol · Vitamin D" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} aria-invalid={!!err} aria-describedby={err ? "medadd-err" : undefined} />
          <div className="seg medkinds" role="group" aria-label="Kind">
            {KINDS.map(([v, l]) => <button key={v} type="button" className={`mc ${kind === v ? "on" : ""}`} aria-pressed={kind === v} onClick={() => setKind(v)}>{l}</button>)}
          </div>
          {err && <p className="fielderr" id="medadd-err" role="alert">{err}</p>}
          <button type="button" className="sbtn" onClick={add}>Add to list</button>
        </div>
      ) : (
        <button type="button" className="linkbtn" onClick={() => setEdit(true)}>Edit list</button>
      )}
      <p className="rfoot">Cyra never recommends doses or changes; those stay with you and your clinician.</p>
      <div className="bsheet-foot"><button type="button" className="cta" onClick={onClose}>Done</button></div>
    </Sheet>
  );
}

/* ---------- Weight: optional, never on Home, never charted ---------- */
export function WeightSheet({ day, dayWord, log, unit, on = true, onUnit, onSave, onOff, onClose }) {
  const cur = bodyDay(log, day).weight || null;
  const [text, setText] = useState(cur ? String(cur.unit === unit ? cur.v : convert(cur.v, cur.unit, unit)) : "");
  const [err, setErr] = useState("");
  const save = () => { const r = onSave(text, unit); if (r && !r.ok) setErr(whyText(r, unit)); else setErr(""); };
  return (
    <Sheet id="weight-sheet" title="Weight" closeLabel="Close weight" onClose={onClose} className="bsheet">
      <p className="bsheet-sub">{MODULES.pcos.weight.note}</p>
      <label className="lab" htmlFor="weight-inp">Weight {dayWord}</label>
      <div className="customrow">
        <input id="weight-inp" className="inp" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 6))} onKeyDown={(e) => { if (e.key === "Enter") save(); }} aria-invalid={!!err} aria-describedby={err ? "weight-err" : undefined} />
        <div className="seg unitseg" role="group" aria-label="Unit">
          {WEIGHT_UNITS.map((u) => <button key={u} type="button" className={`mc ${unit === u ? "on" : ""}`} aria-pressed={unit === u} onClick={() => { const n = checkValue(text, unit); if (n.ok && u !== unit) setText(String(convert(n.value, unit, u))); onUnit(u); }}>{u}</button>)}
        </div>
      </div>
      {err && <p className="fielderr" id="weight-err" role="alert">{err}</p>}
      <div className="bsheet-foot">
        {on && <button type="button" className="linkbtn" onClick={onOff}>Stop adding weight</button>}
        <button type="button" className="cta" onClick={save}>Save weight</button>
      </div>
    </Sheet>
  );
}

/* ---------- PCOS signals (module on): day chips, then dated values she types ---------- */
const GROUPS = [["signals", "Insulin-resistance signals"], ["symptoms", "PCOS symptoms"], ["marker", "Day marker"]];
export function PcosSheet({ day, dayWord, todayIso, log, labs, units, onToggle, onAddLab, onRemoveLab, onUnit, onClose }) {
  const chosen = bodyDay(log, day).pcos || [];
  const [kind, setKind] = useState("fglu");
  const [text, setText] = useState("");
  const [date, setDate] = useState(day <= todayIso ? day : todayIso);
  const [err, setErr] = useState("");
  const unit = units[LAB_KINDS[kind].pref];
  const add = () => {
    const r = onAddLab({ kind, text, unit, date });
    if (!r.ok) { setErr(whyText(r, unit)); return; }
    setErr(""); setText("");
  };
  const mod = MODULES.pcos;
  return (
    <Sheet id="pcos-sheet" title="PCOS signals" closeLabel="Close PCOS signals" onClose={onClose} className="bsheet">
      <p className="bsheet-sub">Tap what showed up {dayWord}. One tap is enough.</p>
      {GROUPS.map(([g, l]) => (
        <div key={g} className="pgroup">
          <p className="lab" id={`pg-${g}`}>{l}</p>
          <div className="pchips" role="group" aria-labelledby={`pg-${g}`}>
            {PCOS_DAY.filter((x) => x.group === g).map((x) => {
              const on = chosen.includes(x.id);
              return <button key={x.id} type="button" className={`mc pchip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => onToggle(x.id)}>{on && <Icon name="check" size={13} />}{x.label}</button>;
            })}
          </div>
          {g === "signals" && (() => { const a = PCOS_DAY.find((x) => x.id === "acan"); const s = sourcesOf(mod, a.src)[0]; return (
            <Details label="About skin darkening"><p>{a.info}</p>{s && <p className="srcline">Source: {s.title} ({s.year}).</p>}</Details>
          ); })()}
        </div>
      ))}
      <div className="labbox">
        <p className="lab" id="labs-lab">Values from your own results</p>
        <div className="seg labkinds" role="group" aria-labelledby="labs-lab">
          {Object.values(LAB_KINDS).map((k) => <button key={k.id} type="button" className={`mc ${kind === k.id ? "on" : ""}`} aria-pressed={kind === k.id} onClick={() => { setKind(k.id); setErr(""); }}>{k.id === "waist" ? "Waist" : k.label}</button>)}
        </div>
        <div className="customrow">
          <input className="inp" inputMode="decimal" aria-label={`${LAB_KINDS[kind].label} value`} placeholder="Value" value={text} onChange={(e) => setText(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 6))} aria-invalid={!!err} aria-describedby={err ? "lab-err" : undefined} />
          <div className="seg unitseg" role="group" aria-label={`${LAB_KINDS[kind].label} unit`}>
            {LAB_KINDS[kind].units.map((u) => <button key={u} type="button" className={`mc ${unit === u ? "on" : ""}`} aria-pressed={unit === u} onClick={() => onUnit(LAB_KINDS[kind].pref, u)}>{u}</button>)}
          </div>
        </div>
        <label className="lab" htmlFor="lab-date">{kind === "waist" ? "Measured on" : "Date of the test"}</label>
        <div className="customrow">
          <input id="lab-date" className="inp" type="date" max={todayIso} value={date} onChange={(e) => setDate(e.target.value)} />
          <button type="button" className="sbtn" onClick={add}>Add</button>
        </div>
        {err && <p className="fielderr" id="lab-err" role="alert">{err}</p>}
        {labs.length > 0 && (
          <ul className="sesslist" aria-label="Values you added">
            {labs.slice(0, 8).map((x) => (
              <li key={x.id}><span><b>{LAB_KINDS[x.kind].label}</b> {labText(x)} · {fmtDay(x.date)}</span>
                <button type="button" className="linkbtn" aria-label={`Remove ${LAB_KINDS[x.kind].label} ${labText(x)} from ${fmtDay(x.date)}`} onClick={() => onRemoveLab(x.id)}>Remove</button></li>
            ))}
          </ul>
        )}
        <p className="hint labnote">Cyra keeps these on this device and does not interpret them.</p>
      </div>
      <p className="rfoot">{MODULE_FRAMING}</p>
      <div className="bsheet-foot"><button type="button" className="cta" onClick={onClose}>Done</button></div>
    </Sheet>
  );
}

export { fmtDay };
