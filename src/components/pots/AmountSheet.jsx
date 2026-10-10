import { useState } from "react";
import { nowHHMM, toMin } from "../../lib/pots.js";
import { isOz, isGSalt, numOf, numProps, toMl, toNaMg, mlIn, naIn } from "./ui.js";

/* "Other amount" (design 4.5) for a drink or for salt, and the same form to edit a logged
   one (Today's log → Edit). Every field is optional except one amount. Cyra never guesses
   sodium: it is only what she copies from a label. Amounts are stored in ml and mg sodium. */
const FLUID_KINDS = [["water", "Water"], ["electrolyte", "Electrolyte drink"], ["broth", "Broth or soup"], ["other", "Other"]];
const SALT_KINDS = [["tablet", "Salt tablet"], ["food", "Salty food"], ["salt", "Table salt"], ["other", "Other"]];
const KIND_LABEL = Object.fromEntries([...FLUID_KINDS, ...SALT_KINDS]);
const WHEN = [["now", "Now"], ["hour", "1 hr ago"], ["morning", "This morning"], ["set", "Set time"]];

function whenTime(w, set) {
  const now = nowHHMM(), n = toMin(now);
  if (w === "hour") { const m = Math.max(0, n - 60); return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }
  if (w === "morning") return n > 8 * 60 ? "08:00" : now;
  if (w === "set") return /^\d{2}:\d{2}$/.test(set) ? set : now;
  return now;
}

/** item: an intake being edited (or null for a new one); mode "fluid" | "salt".
    onSave({ kind, label, ml, naMg, t }, { asButton, buttonLabel }) */
export default function AmountSheet({ mode, item, units, isToday, onSave, onCancel, headRef }) {
  const salt = mode === "salt";
  const kinds = salt ? SALT_KINDS : FLUID_KINDS;
  const [amt, setAmt] = useState(() => (item ? (salt ? naIn(item.naMg, isGSalt(units)) : mlIn(item.ml, units)) : ""));
  const [oz, setOz] = useState(isOz(units));
  const [na, setNa] = useState(() => (item && !salt ? naIn(item.naMg, isGSalt(units)) : ""));
  const [gSalt, setGSalt] = useState(isGSalt(units));
  const [kind, setKind] = useState(() => (item && kinds.some(([k]) => k === item.kind) ? item.kind : salt ? "tablet" : "water"));
  const [when, setWhen] = useState(item || !isToday ? "set" : "now");
  const [t, setT] = useState(item ? item.t : isToday ? nowHHMM() : "12:00");
  const [asButton, setAsButton] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  const u = { fluid: oz ? "oz" : "ml", salt: gSalt ? "gSalt" : "mgNa" };
  const save = () => {
    const a = numOf(amt), n = salt ? null : numOf(na);
    const ml = salt ? null : toMl(a, u), naMg = salt ? toNaMg(a, gSalt) : toNaMg(n, gSalt);
    if ((ml == null && naMg == null) || (ml != null && (ml < 1 || ml > 5000)) || (naMg != null && (naMg < 1 || naMg > 20000))) {
      setErr(salt ? "Add an amount of sodium or salt, from the label." : "Add an amount, up to 5,000 ml at a time.");
      return;
    }
    const label = (item && item.kind === kind && item.label) || (name.trim() || KIND_LABEL[kind]);
    onSave({ kind, label: label.slice(0, 30), ml, naMg, t: whenTime(when, t) }, { asButton, buttonLabel: (name.trim() || KIND_LABEL[kind]).slice(0, 30) });
  };
  const amountLabel = salt ? (gSalt ? "Amount, grams of salt" : "Amount, milligrams of sodium") : (oz ? "Amount, fluid ounces" : "Amount, millilitres");
  return (
    <section className="plaincard" aria-labelledby="pots-amount-h">
      <h2 className="obq" id="pots-amount-h" tabIndex={-1} ref={headRef}>{item ? "Change what you logged" : salt ? "Other amount of salt" : "Other amount"}</h2>
      <label className="lab" htmlFor="pots-amt">{salt ? "Sodium or salt" : "Amount"}</label>
      <input id="pots-amt" className="inp" {...numProps(true)} aria-label={amountLabel} value={amt} onChange={(e) => { setAmt(e.target.value); setErr(""); }} />
      <div className="mcrow" role="group" aria-label="Unit" style={{ marginBottom: 10 }}>
        {salt
          ? [[false, "mg sodium"], [true, "g salt"]].map(([v, l]) => <button type="button" key={l} className={`mc ${gSalt === v ? "on" : ""}`} aria-pressed={gSalt === v} onClick={() => setGSalt(v)}>{l}</button>)
          : [[false, "ml"], [true, "oz"]].map(([v, l]) => <button type="button" key={l} className={`mc ${oz === v ? "on" : ""}`} aria-pressed={oz === v} onClick={() => setOz(v)}>{l}</button>)}
      </div>
      <p className="lab">Kind</p>
      <div className="mcrow" role="group" aria-label="Kind">
        {kinds.map(([k, l]) => <button type="button" key={k} className={`mc ${kind === k ? "on" : ""}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      {!salt && (
        <>
          <label className="lab" htmlFor="pots-amt-na">Sodium from the label (optional)</label>
          <input id="pots-amt-na" className="inp" {...numProps(true)} aria-label={gSalt ? "Sodium from the label (optional), grams of salt" : "Sodium from the label (optional), milligrams"} value={na} onChange={(e) => { setNa(e.target.value); setErr(""); }} />
          <div className="mcrow" role="group" aria-label="Sodium unit" style={{ marginBottom: 4 }}>
            {[[false, "mg sodium"], [true, "g salt"]].map(([v, l]) => <button type="button" key={l} className={`mc ${gSalt === v ? "on" : ""}`} aria-pressed={gSalt === v} onClick={() => setGSalt(v)}>{l}</button>)}
          </div>
        </>
      )}
      <p className="lab">When</p>
      {isToday && !item && (
        <div className="mcrow" role="group" aria-label="When" style={{ marginBottom: 8 }}>
          {WHEN.map(([k, l]) => <button type="button" key={k} className={`mc ${when === k ? "on" : ""}`} aria-pressed={when === k} onClick={() => setWhen(k)}>{l}</button>)}
        </div>
      )}
      {(when === "set") && <input className="inp" type="time" aria-label="Time" value={t} onChange={(e) => setT(e.target.value)} />}
      {!item && (
        <>
          <button type="button" role="checkbox" aria-checked={asButton} className={`consentopt ${asButton ? "on" : ""}`} style={{ margin: "8px 0" }} onClick={() => setAsButton((v) => !v)}>
            <span className="ckbox" aria-hidden="true">{asButton ? "✓" : ""}</span><span>Save as a button</span>
          </button>
          {asButton && <input className="inp" aria-label="Button name (optional)" placeholder={`Button name, e.g. ${KIND_LABEL[kind]}`} maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />}
        </>
      )}
      <p className="hint" style={{ margin: "6px 0 10px" }}>Cyra never guesses sodium. Copy it from the label or packet.</p>
      {err && <p className="errhint" role="alert" style={{ marginTop: 0, marginBottom: 10 }}>{err}</p>}
      <button type="button" className="cta" onClick={save}>{item ? "Save changes" : "Add"}</button>
      <button type="button" className="ghostbtn" onClick={onCancel}>Cancel</button>
    </section>
  );
}

/** After a tap on a drink or salt button with no sodium figure (design 4.5): "How much sodium
    is in one?" Saving remembers it on the button and adds it to what was just logged. */
export function SodiumAsk({ preset, onSave, onSkip, headRef }) {
  const [v, setV] = useState("");
  const [err, setErr] = useState("");
  const drink = preset.ml != null;
  return (
    <section className="plaincard" aria-labelledby="pots-naask-h">
      <h2 className="obq" id="pots-naask-h" tabIndex={-1} ref={headRef}>{preset.label}</h2>
      <p className="plain">{drink ? "How much sodium is in one? Check the label. Cyra remembers it for next time." : "How much sodium is in one? It's on the packet or label."}</p>
      <input className="inp" {...numProps()} aria-label="Sodium in milligrams, from the label" value={v} onChange={(e) => { setV(e.target.value); setErr(""); }} />
      {err && <p className="errhint" role="alert" style={{ marginTop: 0, marginBottom: 10 }}>{err}</p>}
      <button type="button" className="cta" onClick={() => { const n = numOf(v); if (n == null || n < 1 || n > 20000) { setErr("Type the milligrams of sodium from the label."); return; } onSave(Math.round(n)); }}>Save</button>
      <button type="button" className="ghostbtn" onClick={onSkip}>Skip sodium</button>
    </section>
  );
}
