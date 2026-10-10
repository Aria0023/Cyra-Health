import { useState } from "react";
import { POTS_TRIG } from "../../lib/potsConstants.js";
import { nowHHMM } from "../../lib/pots.js";
import UrgentCard, { urgentText } from "./UrgentCard.jsx";
import { symOrder } from "./PotsSymptoms.jsx";
import { symLabel, trigLabel, numOf, numProps } from "./ui.js";

/* The episode sheet (design 4.4): one screen, every field optional except at least one
   symptom or a faint. Safety branches show the moment an answer is picked, before Save, so
   she sees them even if she leaves the form; each is announced once through the screen's
   alert node (`announce`). Fainting or nearly fainting while exercising also pauses step-up
   options (move.faintPause) when the episode is saved. */
const SEV = [[1, "Mild"], [2, "Moderate"], [3, "Strong"]];
const POS = [["lying", "Lying"], ["sitting", "Sitting"], ["standing", "Standing still"], ["stoodup", "Just stood up"], ["walking", "Walking"], ["exercise", "Exercising"], ["heat", "Hot shower or bath"], ["meal", "After a meal"]];
const FAINT = [["no", "No"], ["almost", "Almost"], ["yes", "Yes"]];
const HELPED = [["lie", "Lying down"], ["legs", "Legs up"], ["fluids", "Fluids"], ["salt", "Salt"], ["cool", "Cooling"], ["comp", "Compression"], ["med", "Medicine"], ["other", "Other"]];
export const EXERCISE_FAINT = "Fainting or nearly fainting during exercise needs a same-day check before you exercise again.";

function Row({ label, opts, value, onPick, multi = false }) {
  return (
    <>
      <p className="lab">{label}</p>
      <div className={multi ? "wrapchips" : "mcrow"} role="group" aria-label={label} style={{ marginBottom: 6 }}>
        {opts.map(([v, l]) => {
          const on = multi ? value.includes(v) : value === v;
          return <button type="button" key={v} className={multi ? `minichip big ${on ? "on" : ""}` : `mc ${on ? "on" : ""}`} aria-pressed={on} onClick={() => onPick(v)}>{l}</button>;
        })}
      </div>
    </>
  );
}

/** ep: an episode being edited, or null. onSave(episode) gets { t, sym, sev, pos, faint, injured, mins, trig, helped, note }. */
export default function EpisodeForm({ pots, ep, isToday, preg, announce, onSave, onCancel, headRef }) {
  const [sym, setSym] = useState(ep ? ep.sym : []);
  const [sev, setSev] = useState(ep ? ep.sev : null);
  const [pos, setPos] = useState(ep ? ep.pos : null);
  const [faint, setFaint] = useState(ep ? ep.faint : null);
  const [injured, setInjured] = useState(ep ? ep.injured === true : false);
  const [mins, setMins] = useState(ep && ep.mins != null ? String(ep.mins) : "");
  const [trig, setTrig] = useState(ep ? ep.trig : []);
  const [helped, setHelped] = useState(ep ? ep.helped : []);
  const [when, setWhen] = useState(ep || !isToday ? "earlier" : "now");
  const [t, setT] = useState(ep ? ep.t : isToday ? nowHHMM() : "12:00");
  const [note, setNote] = useState(ep ? ep.note || "" : "");
  const [more, setMore] = useState(false);
  const [err, setErr] = useState("");

  const { top, more: rest } = symOrder(pots);
  const symOpts = [...top, ...(more ? rest : rest.filter((id) => sym.includes(id))), ...sym.filter((id) => !top.includes(id) && !rest.includes(id))].map((id) => [id, symLabel(pots, id)]);
  const trigIds = [...POTS_TRIG.map((x) => x.id), ...pots.settings.customTrig.filter((x) => !x.archived).map((x) => x.id)];
  const trigOpts = [...trigIds, ...trig.filter((id) => !trigIds.includes(id))].map((id) => [id, trigLabel(pots, id)]);
  const toggle = (list, set, v) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const pickSym = (id) => {
    const on = !sym.includes(id);
    toggle(sym, setSym, id); setErr("");
    if (on && id === "p_chest") announce(urgentText("chest"));
    if (on && id === "p_sob" && sev === 3) announce(urgentText("breath"));
  };
  const pickSev = (v) => { const n = sev === v ? null : v; setSev(n); if (n === 3 && sym.includes("p_sob")) announce(urgentText("breath")); };
  const pickFaint = (v) => {
    const n = faint === v ? null : v; setFaint(n); setErr("");
    if (n === "yes") announce(injured ? urgentText("faintInjury") : urgentText("faint"));
    if (n !== "yes") setInjured(false);
    if ((n === "yes" || n === "almost") && pos === "exercise" && n !== faint) announce(EXERCISE_FAINT);
  };
  const pickPos = (v) => { const n = pos === v ? null : v; setPos(n); if (n === "exercise" && (faint === "yes" || faint === "almost")) announce(EXERCISE_FAINT); };
  const pickInjured = () => { const n = !injured; setInjured(n); if (n) announce(urgentText("faintInjury")); };

  const exerciseFaint = pos === "exercise" && (faint === "yes" || faint === "almost");
  const save = () => {
    if (!sym.length && faint !== "yes" && faint !== "almost") { setErr("Pick at least one symptom, or answer \"Did you faint?\"."); return; }
    const m = numOf(mins);
    onSave({ t: when === "now" ? nowHHMM() : (/^\d{2}:\d{2}$/.test(t) ? t : nowHHMM()), sym, sev, pos, faint, injured: faint === "yes" && injured, mins: m == null ? null : Math.round(m), trig, helped, note: note.trim().slice(0, 300) }, { exerciseFaint });
  };

  return (
    <section className="plaincard" aria-labelledby="pots-ep-h">
      <h2 className="obq" id="pots-ep-h" tabIndex={-1} ref={headRef}>{ep ? "Change this episode" : "Log an episode"}</h2>
      <p className="hint" style={{ margin: "0 0 6px" }}>Everything is optional except at least one symptom, or whether you fainted.</p>

      <Row label="What's happening?" opts={symOpts} value={sym} onPick={pickSym} multi />
      {rest.length > 0 && <button type="button" className="linkbtn" aria-expanded={more} onClick={() => setMore((v) => !v)} style={{ marginBottom: 6 }}>{more ? "Fewer symptoms" : "More symptoms"}</button>}
      {sym.includes("p_chest") && <UrgentCard variant="chest" preg={preg} />}
      {sym.includes("p_sob") && sev === 3 && <UrgentCard variant="breath" preg={preg} />}

      <Row label="How bad at its worst?" opts={SEV} value={sev} onPick={pickSev} />
      <Row label="Where were you?" opts={POS} value={pos} onPick={pickPos} />
      <Row label="Did you faint?" opts={FAINT} value={faint} onPick={pickFaint} />
      {faint === "yes" && (
        <button type="button" role="checkbox" aria-checked={injured} className={`consentopt ${injured ? "on" : ""}`} style={{ margin: "4px 0 8px" }} onClick={pickInjured}>
          <span className="ckbox" aria-hidden="true">{injured ? "✓" : ""}</span><span>I was hurt or hit my head</span>
        </button>
      )}
      {faint === "yes" && <UrgentCard variant={injured ? "faintInjury" : "faint"} preg={preg} />}
      {exerciseFaint && <p className="plain" style={{ fontWeight: 700 }}>{EXERCISE_FAINT}</p>}

      <label className="lab" htmlFor="pots-ep-mins">How long, roughly (minutes)?</label>
      <input id="pots-ep-mins" className="inp" {...numProps()} aria-label="How long, roughly (minutes)?" value={mins} onChange={(e) => setMins(e.target.value)} />
      <Row label="Anything set it off?" opts={trigOpts} value={trig} onPick={(v) => toggle(trig, setTrig, v)} multi />
      <Row label="What helped?" opts={HELPED} value={helped} onPick={(v) => toggle(helped, setHelped, v)} multi />
      <p className="lab">When?</p>
      {isToday && !ep && (
        <div className="mcrow" role="group" aria-label="When?" style={{ marginBottom: 8 }}>
          {[["now", "Now"], ["earlier", "Earlier"]].map(([v, l]) => <button type="button" key={v} className={`mc ${when === v ? "on" : ""}`} aria-pressed={when === v} onClick={() => setWhen(v)}>{l}</button>)}
        </div>
      )}
      {when === "earlier" && <input className="inp" type="time" aria-label="Time it started" value={t} onChange={(e) => setT(e.target.value)} />}
      <label className="lab" htmlFor="pots-ep-note">Note (optional)</label>
      <textarea id="pots-ep-note" className="inp" rows={3} maxLength={300} aria-label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      {err && <p className="errhint" role="alert" style={{ marginTop: 0, marginBottom: 10 }}>{err}</p>}
      <button type="button" className="cta" onClick={save}>{ep ? "Save changes" : "Save episode"}</button>
      <button type="button" className="ghostbtn" onClick={onCancel}>Cancel</button>
    </section>
  );
}
