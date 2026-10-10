import { useState } from "react";
import UrgentCard, { urgentText } from "./UrgentCard.jsx";
import { PSY_ADVICE, symOrder } from "./PotsSymptoms.jsx";
import Advice from "../Advice.jsx";
import { hm, symLabel, amountText, naText } from "./ui.js";

/* Simple view (design 4.3, capability 8): four large tiles for a foggy day. Each tile says
   exactly what one tap does; the last thing logged can always be undone from a visible row.
   "Took my meds" names exactly what it will log (lib/pots.js medsNowPlan, with the 30-minute
   repeat guard), so a double tap never records two doses. */
/** A tile's sub-line: "Glass · 250 ml", "Salt tablet · 500 mg sodium". */
const tileSub = (pr, units) => [pr.label, pr.ml != null ? amountText(pr.ml, units) : null, pr.naMg != null ? naText(pr.naMg, units) : null].filter(Boolean).join(" · ");

export default function QuickLog({ pots, units, plan, last, onDrink, onSalt, onMeds, onFeelBad, onUndo, onFull }) {
  const s = pots.settings, presets = s.presets;
  const fluid = presets.find((x) => x.id === s.defaultFluid && x.ml != null) || presets.find((x) => x.ml != null) || null;
  const salt = presets.find((x) => x.id === s.defaultSalt && x.ml == null) || presets.find((x) => x.ml == null) || null;
  const medsSub = plan.logged.length
    ? `Logs: ${plan.logged.map((x) => `${x.name}${x.slot ? ` ${hm(x.slot)}` : ""}`).join(", ")}`
    : plan.guarded.length ? `Already logged at ${hm(plan.guarded[plan.guarded.length - 1].t)}` : "Nothing due now";
  return (
    <>
      <div className="potsgrid" role="group" aria-label="Quick log">
        <button type="button" className="route" disabled={!fluid} onClick={() => onDrink(fluid)}>I drank something<span>{fluid ? tileSub(fluid, units) : "Add a drink button in POTS settings"}</span></button>
        <button type="button" className="route" disabled={!salt} onClick={() => onSalt(salt)}>I had salt<span>{salt ? tileSub(salt, units) : "Add a salt button in POTS settings"}</span></button>
        <button type="button" className="route" onClick={onMeds}>Took my meds<span>{medsSub}</span></button>
        <button type="button" className="route" onClick={onFeelBad}>I feel bad now<span>Pick what's happening</span></button>
      </div>
      <LastRow last={last} onUndo={onUndo} big />
      <button type="button" id="pots-full-btn" className="linkbtn" style={{ marginTop: 10 }} onClick={onFull}>Full view</button>
    </>
  );
}

/** "Last: Glass 250 ml at 2:10 pm" with Undo (both views). */
export function LastRow({ last, onUndo, big = false }) {
  if (!last) return null;
  return (
    <div className="medrow" style={{ borderTop: "none" }} aria-live="off">
      <div className="medinfo"><span>{big ? "Last logged" : "Last"}</span><b>{last.text}</b></div>
      <button type="button" className="sbtn" data-undo="" style={big ? { minHeight: 56, padding: "7px 20px" } : undefined} aria-label={`Undo: ${last.text}`} onClick={onUndo}>Undo</button>
    </div>
  );
}

/** "I feel bad now": her top 6 symptoms as big chips, how bad, Save. Saves an episode now and
    raises those symptoms' day severity to at least that level. */
export function FeelBad({ pots, preg, announce, onSave, onCancel, headRef }) {
  const [sym, setSym] = useState([]);
  const [sev, setSev] = useState(2);
  const [err, setErr] = useState("");
  const ids = symOrder(pots).top.slice(0, 6);
  const pick = (id) => {
    const on = !sym.includes(id);
    setSym(on ? [...sym, id] : sym.filter((x) => x !== id)); setErr("");
    if (on && id === "p_chest") announce(urgentText("chest"));
    if (on && id === "p_sob" && sev === 3) announce(urgentText("breath"));
    if (on && id === "p_psy" && sev === 3) announce(PSY_ADVICE);
  };
  const pickSev = (v) => {
    setSev(v);
    if (v === 3 && sym.includes("p_sob")) announce(urgentText("breath"));
    else if (v === 3 && sym.includes("p_psy")) announce(PSY_ADVICE);
  };
  return (
    <section className="plaincard" aria-labelledby="pots-bad-h">
      <h2 className="obq" id="pots-bad-h" tabIndex={-1} ref={headRef}>I feel bad now</h2>
      <div className="chips" role="group" aria-label="What's happening?">
        {ids.map((id) => {
          const on = sym.includes(id);
          return <button type="button" key={id} className={`chip ${on ? "sev-3" : "sev-0"}`} style={{ minHeight: 64 }} aria-pressed={on} onClick={() => pick(id)}>{symLabel(pots, id)}</button>;
        })}
      </div>
      {sym.includes("p_chest") && <UrgentCard variant="chest" preg={preg} />}
      {sym.includes("p_sob") && sev === 3 && <UrgentCard variant="breath" preg={preg} />}
      {sym.includes("p_psy") && sev === 3 && <div style={{ marginBottom: 8 }}><Advice urgency="visit">{PSY_ADVICE}</Advice></div>}
      <div className="mcrow" role="group" aria-label="How bad?" style={{ marginBottom: 12 }}>
        {[[1, "Mild"], [2, "Moderate"], [3, "Severe"]].map(([v, l]) => <button type="button" key={v} className={`mc ${sev === v ? "on" : ""}`} aria-pressed={sev === v} onClick={() => pickSev(v)}>{l}</button>)}
      </div>
      {err && <p className="errhint" role="alert" style={{ marginTop: 0, marginBottom: 10 }}>{err}</p>}
      <button type="button" className="cta" onClick={() => { if (!sym.length) { setErr("Pick at least one, then Save."); return; } onSave({ sym, sev }); }}>Save</button>
      <button type="button" className="ghostbtn" onClick={onCancel}>Cancel</button>
    </section>
  );
}
