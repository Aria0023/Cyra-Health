import { useState } from "react";
import { POTS_SYM, POTS_TRIG } from "../../lib/potsConstants.js";
import { cycleSym, toggleTrig, addCustom } from "../../lib/pots.js";
import { sevDots } from "../../lib/engine.js";
import Advice from "../Advice.jsx";
import UrgentCard, { urgentText } from "./UrgentCard.jsx";
import { symLabel, trigLabel } from "./ui.js";

/* "Right now": POTS symptom chips (design 4.4), tapped 0 → 1 → 2 → 3 → 0 for the day's worst
   severity, exactly like the check-in chips; and "Triggers today". Her first 8 chips follow
   settings.symTop; "More symptoms" shows the rest, then her own. Her own symptoms are never
   deleted, only archived, so past days keep their names. A symptom logged that day stays
   visible (and clearable) even if it is hidden or archived now.
   Inline safety: Chest discomfort at any severity shows the chest card, Short of breath at 3
   the breath card, Nearly fainting at 3 a visit advice; each is announced once when her tap
   makes it appear. */
export const PSY_ADVICE = "Nearly fainting often is worth raising soon, not at a routine visit months away.";

/** The ordered chip lists for her settings: { top, more } (ids). */
export function symOrder(pots) {
  const s = pots.settings, hidden = new Set(s.symHidden);
  const custom = s.customSym.filter((x) => !x.archived).map((x) => x.id);
  const known = new Set([...POTS_SYM.map((x) => x.id), ...custom]);
  const top = s.symTop.filter((id) => known.has(id) && !hidden.has(id));
  const more = [...POTS_SYM.map((x) => x.id), ...custom].filter((id) => !top.includes(id) && !hidden.has(id));
  return { top, more };
}

function AddOwn({ label, onAdd }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  if (!open) return <button type="button" className="minichip big" onClick={() => setOpen(true)}>+ Add your own</button>;
  const add = () => { if (v.trim()) { onAdd(v.trim()); setV(""); setOpen(false); } };
  return (
    <div style={{ display: "flex", gap: 8, width: "100%", alignItems: "flex-start" }}>
      <input className="inp" style={{ marginBottom: 0, minHeight: 44 }} aria-label={label} maxLength={30} value={v} autoFocus onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
      <button type="button" className="sbtn" onClick={add}>Add</button>
      <button type="button" className="sbtn" onClick={() => { setV(""); setOpen(false); }}>Cancel</button>
    </div>
  );
}

export default function PotsSymptoms({ pots, day, setPots, onEpisode, announce, preg }) {
  const [more, setMore] = useState(false);
  const sym = (pots.days[day] || {}).sym || {};
  const { top, more: rest } = symOrder(pots);
  // A symptom logged that day but not among her first chips stays in view: in the first grid
  // while "More symptoms" is closed (also a hidden, archived or newer-build one), in its own
  // place once it is open.
  const extra = Object.keys(sym).filter((id) => !top.includes(id) && (!more || !rest.includes(id)));
  const firstIds = [...top, ...extra];
  const tap = (id) => {
    const next = ((sym[id] || 0) + 1) % 4;
    setPots((p) => cycleSym(p, day, id));
    if (id === "p_chest" && next === 1) announce(urgentText("chest"));
    if (id === "p_sob" && next === 3) announce(urgentText("breath"));
    if (id === "p_psy" && next === 3) announce(PSY_ADVICE);
  };
  const chip = (id) => {
    const v = sym[id] || 0, label = symLabel(pots, id);
    return (
      <button type="button" key={id} aria-pressed={v > 0} aria-label={`${label}, severity ${v} of 3`} className={`chip sev-${v}`} onClick={() => tap(id)}>
        <span>{label}</span><span className="dots" aria-hidden="true">{sevDots(v)}</span>
      </button>
    );
  };
  return (
    <section className="plaincard" aria-labelledby="pots-now-h" style={{ marginBottom: 12 }}>
      <h2 className="lab" id="pots-now-h" style={{ marginTop: 0 }} tabIndex={-1}>Right now</h2>
      <div className="chips" style={{ marginBottom: 8 }}>{firstIds.map(chip)}</div>
      {rest.length > 0 && (
        <button type="button" className="disclosure more" aria-expanded={more} aria-controls="pots-more-sym" onClick={() => setMore((v) => !v)} style={{ marginBottom: 8 }}>
          <span>More symptoms</span><span aria-hidden="true">{more ? "−" : "+"}</span>
        </button>
      )}
      <div id="pots-more-sym" hidden={!more}>
        {more && <div className="chips" style={{ marginBottom: 8 }}>{rest.map(chip)}</div>}
        <div className="wrapchips" style={{ marginBottom: 8 }}>
          <AddOwn label="Your own symptom" onAdd={(label) => setPots((p) => addCustom(p, "sym", label))} />
        </div>
      </div>
      {sym.p_chest > 0 && <UrgentCard variant="chest" preg={preg} />}
      {sym.p_sob === 3 && <UrgentCard variant="breath" preg={preg} />}
      {sym.p_psy === 3 && <div style={{ marginBottom: 8 }}><Advice urgency="visit" alone>{PSY_ADVICE}</Advice></div>}
      <button type="button" className="ghostbtn" onClick={onEpisode}>Something's happening: log an episode</button>
    </section>
  );
}

/** "Triggers today": built-in triggers, then her own (not archived), then "+ Add your own". */
export function PotsTriggers({ pots, day, setPots }) {
  const trig = (pots.days[day] || {}).trig || [];
  const own = pots.settings.customTrig.filter((x) => !x.archived).map((x) => x.id);
  const ids = [...POTS_TRIG.map((x) => x.id), ...own];
  const extra = trig.filter((id) => !ids.includes(id));
  return (
    <section className="plaincard" aria-labelledby="pots-trig-h" style={{ marginBottom: 12 }}>
      <h2 className="lab" id="pots-trig-h" style={{ marginTop: 0 }}>Triggers today</h2>
      <div className="wrapchips">
        {[...ids, ...extra].map((id) => {
          const on = trig.includes(id);
          return <button type="button" key={id} className={`minichip big ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setPots((p) => toggleTrig(p, day, id))}>{trigLabel(pots, id)}</button>;
        })}
        <AddOwn label="Your own trigger" onAdd={(label) => setPots((p) => addCustom(p, "trig", label))} />
      </div>
    </section>
  );
}
