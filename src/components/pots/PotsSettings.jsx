import { useEffect, useRef, useState } from "react";
import { POTS_SYM, POTS_ERASE } from "../../lib/potsConstants.js";
import { setSettings, upsertPreset, removePreset, removePlanItem, addCustom, archiveCustom, eraseLog, newId, fmtFluid, fmtSodium } from "../../lib/pots.js";
import Details from "../Details.jsx";
import GoalSheet from "./GoalSheet.jsx";
import MedEditor from "./MedEditor.jsx";
import { symOrder } from "./PotsSymptoms.jsx";
import { symLabel, amountText, naText, numOf, numProps, isOz, toMl, mlIn } from "./ui.js";

/* POTS settings (design 4.12): the "POTS settings" link at the bottom of the POTS tab. This
   version has what the daily loop uses: Simple view, units, which Today cards show, goals,
   drink and salt buttons, her symptoms and triggers, medicines and supports, her plan, and
   Delete POTS log. Her own symptoms and triggers are archived on "Remove" (past days keep
   their names); only Delete POTS log clears them. */
export const REMINDERS_LINE = "Cyra doesn't send medicine or drink reminders. The only reminder Cyra can send is your check-in reminder, if you turned it on. If reminders help you, your phone's clock app can set them.";
export const SHOW_CHOICES = [["test", "Stand test"], ["fluid", "Fluids & salt"], ["sym", "Symptoms"], ["meds", "Meds & supports"], ["move", "Movement"]];
const FLUID_KINDS = [["water", "Water"], ["electrolyte", "Electrolyte drink"], ["broth", "Broth or soup"], ["other", "Other drink"]];
const SALT_KINDS = [["tablet", "Salt tablet"], ["food", "Salty food"], ["salt", "Table salt"], ["other", "Other salt"]];

function Head({ id, children }) {
  return <h3 className="lab" id={id} tabIndex={-1} style={{ marginTop: 18 }}>{children}</h3>;
}

/** One drink / salt button's edit form. An unchanged amount keeps its stored ml (oz are shown
    rounded), and a kind a newer build wrote is kept unless she picks another. */
function PresetForm({ pr, units, onSave, onCancel }) {
  const drink = pr ? pr.ml != null : true;
  const [isDrink, setIsDrink] = useState(drink);
  const [label, setLabel] = useState(pr ? pr.label : "");
  const [ml0] = useState(pr ? mlIn(pr.ml, units) : "");
  const [ml, setMl] = useState(ml0);
  const [na, setNa] = useState(pr && pr.naMg != null ? String(pr.naMg) : "");
  const [kind, setKind] = useState(pr ? pr.kind : "water");
  const [err, setErr] = useState("");
  const kinds = isDrink ? FLUID_KINDS : SALT_KINDS;
  const save = () => {
    const m = isDrink ? (pr && pr.ml != null && ml === ml0 ? pr.ml : toMl(numOf(ml), units)) : null, n = numOf(na);
    if (!label.trim()) { setErr("Give the button a name."); return; }
    if (isDrink && (m == null || m < 1 || m > 5000)) { setErr("Add the amount for a drink button."); return; }
    if (n != null && (n < 1 || n > 20000)) { setErr("Check the sodium number (mg from the label)."); return; }
    const next = { ...(pr || {}), label: label.trim(), kind: kinds.some(([k]) => k === kind) || (pr && pr.kind === kind && isDrink === drink) ? kind : kinds[0][0], ml: m, naMg: n == null ? null : Math.round(n) };
    if (n != null) delete next.naSkip;
    onSave(next);
  };
  return (
    <div className="plaincard" role="group" aria-label={pr ? `Change ${pr.label}` : "New button"} style={{ margin: "8px 0" }}>
      {!pr && (
        <div className="mcrow" role="group" aria-label="Button for" style={{ marginBottom: 8 }}>
          {[[true, "A drink"], [false, "Salt"]].map(([v, l]) => <button type="button" key={l} className={`mc ${isDrink === v ? "on" : ""}`} aria-pressed={isDrink === v} onClick={() => { setIsDrink(v); setKind(v ? "water" : "tablet"); }}>{l}</button>)}
        </div>
      )}
      <input className="inp" aria-label="Button name" placeholder="Button name" maxLength={30} value={label} onChange={(e) => { setLabel(e.target.value); setErr(""); }} />
      {isDrink && <input className="inp" {...numProps(isOz(units))} aria-label={isOz(units) ? "Amount, fluid ounces" : "Amount, millilitres"} placeholder={isOz(units) ? "Amount (oz)" : "Amount (ml)"} value={ml} onChange={(e) => { setMl(e.target.value); setErr(""); }} />}
      <input className="inp" {...numProps()} aria-label="Sodium from the label, milligrams (optional)" placeholder="Sodium from the label, mg (optional)" value={na} onChange={(e) => { setNa(e.target.value); setErr(""); }} />
      <div className="mcrow" role="group" aria-label="Kind" style={{ marginBottom: 8 }}>
        {kinds.map(([k, l]) => <button type="button" key={k} className={`mc ${kind === k ? "on" : ""}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      {err && <p className="errhint" role="alert" style={{ marginTop: 0, marginBottom: 8 }}>{err}</p>}
      <div className="wearbtns">
        <button type="button" className="sbtn" onClick={save}>Save</button>
        <button type="button" className="sbtn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function PotsSettings({ pots, setPots, stage, stageName, conditions, ping, shows, today, onBack, headRef }) {
  const s = pots.settings, units = s.units, preg = stage === "preg";
  const [sub, setSub] = useState(null); // null | "goals" | "meds"
  const [editPr, setEditPr] = useState(null); // preset id | "new" | null
  const [ask, setAsk] = useState(false); // Delete POTS log confirm
  const [newSym, setNewSym] = useState(""), [newTrig, setNewTrig] = useState(""), [newPlan, setNewPlan] = useState("");
  const subHead = useRef(null), opener = useRef(null), askRef = useRef(null);
  const [back, setBack] = useState(false);
  // An inline form or confirm that closes hands focus to the control that opened it (by id,
  // since that control may have been re-rendered), or to its section heading.
  const [focusTo, setFocusTo] = useState(null); // [id, fallback id]
  useEffect(() => {
    if (!focusTo) return;
    setFocusTo(null);
    (document.getElementById(focusTo[0]) || document.getElementById(focusTo[1]))?.focus();
  }, [focusTo]);
  const closePr = (id) => { setEditPr(null); setFocusTo([id === "new" ? "pots-set-addbtn" : `pots-prchg-${id}`, "pots-set-btns"]); };
  useEffect(() => { if (sub) subHead.current?.focus(); }, [sub]);
  useEffect(() => { if (!back) return; setBack(false); if (opener.current?.isConnected) opener.current.focus(); }, [back]);
  useEffect(() => { if (ask) askRef.current?.focus(); }, [ask]);
  const openSub = (k) => { opener.current = document.activeElement; setSub(k); };
  const closeSub = () => { setSub(null); setBack(true); };
  const set = (patch) => setPots((p) => setSettings(p, patch));

  if (sub === "goals") return <GoalSheet pots={pots} setPots={setPots} units={units} conditions={conditions} preg={preg} today={today} headRef={subHead} onDone={(r) => { if (r === "saved") ping("Goals saved"); if (r === "cleared") ping("Goals cleared"); closeSub(); }} />;
  if (sub === "meds") return <MedEditor pots={pots} setPots={setPots} today={today} pregOrTtc={preg || stageName === "Trying to Conceive"} ping={ping} headRef={subHead} onClose={closeSub} onGoCard={() => { closeSub(); onBack(); }} />;

  const presets = s.presets;
  const move = (arr, i, dir) => { const a = [...arr]; const j = i + dir; if (j < 0 || j >= a.length) return arr; [a[i], a[j]] = [a[j], a[i]]; return a; };
  const { top, more } = symOrder(pots);
  const hidden = s.symHidden.filter((id) => POTS_SYM.some((x) => x.id === id) || s.customSym.some((x) => x.id === id && !x.archived));
  const ownSym = s.customSym.filter((x) => !x.archived), ownTrig = s.customTrig.filter((x) => !x.archived);
  const g = s.goals;
  const goalLine = g.fluidMl == null && g.naMg == null ? "No goals set" : [g.fluidMl != null ? `Fluids ${fmtFluid(g.fluidMl, units)}` : null, g.naMg != null ? `Sodium ${fmtSodium(g.naMg, units)}` : null, g.by === "clinician" ? "set by your clinician" : g.by === "me" ? "your own goal" : null].filter(Boolean).join(" · ");
  const choices = SHOW_CHOICES.filter(([k]) => shows.includes(k));

  return (
    <section aria-labelledby="pots-set-h">
      <h2 className="obq" id="pots-set-h" tabIndex={-1} ref={headRef}>POTS settings</h2>
      <button type="button" className="linkbtn" onClick={onBack}>Back to Today</button>

      <Head id="pots-set-view">View</Head>
      <div className="medrow" style={{ borderTop: "none" }}>
        <div className="medinfo"><b id="pots-set-simple">Simple view</b><span>Four big buttons for foggy days.</span></div>
        <button type="button" className={`takebtn ${s.simple ? "on" : ""}`} aria-pressed={s.simple} aria-describedby="pots-set-simple" onClick={() => set({ simple: !s.simple })}>{s.simple ? "✓ On" : "Turn on"}</button>
      </div>
      <p className="plain" style={{ margin: "8px 0 6px" }}>Fluids in</p>
      <div className="mcrow" role="group" aria-label="Fluids in">
        {[["ml", "ml"], ["oz", "oz"]].map(([v, l]) => <button type="button" key={v} className={`mc ${units.fluid === v ? "on" : ""}`} aria-pressed={units.fluid === v} onClick={() => set({ units: { fluid: v } })}>{l}</button>)}
      </div>
      <p className="plain" style={{ margin: "10px 0 6px" }}>Sodium in</p>
      <div className="mcrow" role="group" aria-label="Sodium in">
        {[["mgNa", "mg sodium"], ["gSalt", "g salt"]].map(([v, l]) => <button type="button" key={v} className={`mc ${units.salt === v ? "on" : ""}`} aria-pressed={units.salt === v} onClick={() => set({ units: { salt: v } })}>{l}</button>)}
      </div>
      {choices.length > 0 && (
        <>
          <p className="plain" style={{ margin: "10px 0 6px" }}>Cards on Today</p>
          <div className="mcrow" role="group" aria-label="Cards on Today">
            {choices.map(([k, l]) => <button type="button" key={k} className={`mc ${s.show[k] ? "on" : ""}`} aria-pressed={!!s.show[k]} onClick={() => set({ show: { [k]: !s.show[k] } })}>{l}</button>)}
          </div>
          <p className="hint" style={{ margin: "6px 0 0" }}>Less on screen can help on foggy days.</p>
        </>
      )}

      <Head id="pots-set-goals">Goals</Head>
      <div className="medrow" style={{ borderTop: "none" }}>
        <div className="medinfo"><b>Your daily goals</b><span>{goalLine}</span></div>
        <button type="button" className="sbtn" aria-label="Change your daily goals" onClick={() => openSub("goals")}>Change</button>
      </div>

      <Head id="pots-set-btns">Drink and salt buttons</Head>
      {presets.map((pr, i) => (
        <div key={pr.id}>
          <div className="medrow" style={{ flexWrap: "wrap" }}>
            <div className="medinfo" style={{ flex: "1 1 150px" }}><b>{pr.label}</b><span>{[pr.ml != null ? amountText(pr.ml, units) : null, pr.naMg != null ? naText(pr.naMg, units) : "sodium not set", (pr.id === s.defaultFluid && pr.ml != null) || (pr.id === s.defaultSalt && pr.ml == null) ? "in Simple view" : null].filter(Boolean).join(" · ")}</span></div>
            <div className="wearbtns" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button type="button" id={`pots-prchg-${pr.id}`} className="sbtn" aria-label={`Change ${pr.label}`} aria-expanded={editPr === pr.id} onClick={() => setEditPr(editPr === pr.id ? null : pr.id)}>Change</button>
              <button type="button" className="sbtn" aria-label={`Move ${pr.label} up`} disabled={i === 0} onClick={() => set({ presets: move(presets, i, -1) })}>↑</button>
              <button type="button" className="sbtn" aria-label={`Move ${pr.label} down`} disabled={i === presets.length - 1} onClick={() => set({ presets: move(presets, i, 1) })}>↓</button>
              {!((pr.id === s.defaultFluid && pr.ml != null) || (pr.id === s.defaultSalt && pr.ml == null)) && <button type="button" className="sbtn" aria-label={`Use ${pr.label} in Simple view`} onClick={() => { set(pr.ml != null ? { defaultFluid: pr.id } : { defaultSalt: pr.id }); setFocusTo([`pots-prchg-${pr.id}`, "pots-set-btns"]); }}>Use in Simple view</button>}
              <button type="button" className="sbtn" aria-label={`Remove ${pr.label}`} onClick={() => { setPots((p) => removePreset(p, pr.id)); ping(`${pr.label} button removed`); setFocusTo(["pots-set-btns", "pots-set-btns"]); }}>Remove</button>
            </div>
          </div>
          {editPr === pr.id && <PresetForm pr={pr} units={units} onCancel={() => closePr(pr.id)} onSave={(next) => { setPots((p) => upsertPreset(p, next)); closePr(pr.id); ping("Saved"); }} />}
        </div>
      ))}
      {presets.length < 16
        ? <button type="button" id="pots-set-addbtn" className="linkbtn" style={{ marginTop: 8 }} aria-expanded={editPr === "new"} onClick={() => setEditPr(editPr === "new" ? null : "new")}>+ Add a button</button>
        : <p className="hint">You have 16 buttons, the most there can be. Remove one to add another.</p>}
      {editPr === "new" && <PresetForm pr={null} units={units} onCancel={() => closePr("new")} onSave={(next) => { setPots((p) => upsertPreset(p, { ...next, id: newId() })); closePr("new"); ping(`${next.label} button added`); }} />}

      <Head id="pots-set-sym">My symptoms</Head>
      <p className="hint" style={{ marginBottom: 6 }}>Your first 8 chips, in order. The rest are under "More symptoms".</p>
      {top.map((id, i) => (
        <div className="medrow" key={id}>
          <div className="medinfo"><b>{symLabel(pots, id)}</b></div>
          <div className="wearbtns" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button type="button" className="sbtn" aria-label={`Move ${symLabel(pots, id)} up`} disabled={i === 0} onClick={() => set({ symTop: move(top, i, -1) })}>↑</button>
            <button type="button" className="sbtn" aria-label={`Move ${symLabel(pots, id)} down`} disabled={i === top.length - 1} onClick={() => set({ symTop: move(top, i, 1) })}>↓</button>
            <button type="button" className="sbtn" aria-label={`Take ${symLabel(pots, id)} out of your first 8`} onClick={() => { set({ symTop: top.filter((x) => x !== id) }); setFocusTo(["pots-set-sym", "pots-set-sym"]); }}>Take out</button>
          </div>
        </div>
      ))}
      {more.length > 0 && <p className="plain" style={{ margin: "10px 0 2px" }}>More symptoms</p>}
      {more.map((id) => {
        const own = s.customSym.find((x) => x.id === id);
        return (
          <div className="medrow" key={id}>
            <div className="medinfo"><b>{symLabel(pots, id)}</b>{own ? <span>Your own</span> : null}</div>
            <div className="wearbtns" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
              {top.length < 8 && <button type="button" className="sbtn" aria-label={`Add ${symLabel(pots, id)} to your first 8`} onClick={() => { set({ symTop: [...top, id] }); setFocusTo(["pots-set-sym", "pots-set-sym"]); }}>Add to first 8</button>}
              <button type="button" className="sbtn" aria-label={`Hide ${symLabel(pots, id)}`} onClick={() => { set({ symHidden: [...s.symHidden, id] }); setFocusTo(["pots-set-sym", "pots-set-sym"]); }}>Hide</button>
              {own && <button type="button" className="sbtn" aria-label={`Remove ${own.label}`} onClick={() => { setPots((p) => archiveCustom(p, "sym", id)); ping(`${own.label} removed. Past days keep it.`); setFocusTo(["pots-set-sym", "pots-set-sym"]); }}>Remove</button>}
            </div>
          </div>
        );
      })}
      {hidden.length > 0 && <p className="plain" style={{ margin: "10px 0 2px" }}>Hidden</p>}
      {hidden.map((id) => (
        <div className="medrow" key={id}>
          <div className="medinfo"><b>{symLabel(pots, id)}</b></div>
          <button type="button" className="sbtn" aria-label={`Show ${symLabel(pots, id)}`} onClick={() => { set({ symHidden: s.symHidden.filter((x) => x !== id) }); setFocusTo(["pots-set-sym", "pots-set-sym"]); }}>Show</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10 }}>
        <input className="inp" aria-label="Your own symptom" placeholder="Your own symptom" maxLength={30} value={newSym} onChange={(e) => setNewSym(e.target.value)} />
        <button type="button" className="sbtn" disabled={ownSym.length >= 20} onClick={() => { if (newSym.trim()) { setPots((p) => addCustom(p, "sym", newSym)); setNewSym(""); } }}>Add</button>
      </div>
      {top.some((id) => s.customSym.some((x) => x.id === id && !x.archived)) && <p className="hint">To remove one of your own symptoms, take it out of your first 8 first.</p>}

      <Head id="pots-set-trig">My triggers</Head>
      {!ownTrig.length && <p className="hint" style={{ marginBottom: 6 }}>Triggers you add yourself show here.</p>}
      {ownTrig.map((x) => (
        <div className="medrow" key={x.id}>
          <div className="medinfo"><b>{x.label}</b></div>
          <button type="button" className="sbtn" aria-label={`Remove ${x.label}`} onClick={() => { setPots((p) => archiveCustom(p, "trig", x.id)); ping(`${x.label} removed. Past days keep it.`); setFocusTo(["pots-set-trig", "pots-set-trig"]); }}>Remove</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 8 }}>
        <input className="inp" aria-label="Your own trigger" placeholder="Your own trigger" maxLength={30} value={newTrig} onChange={(e) => setNewTrig(e.target.value)} />
        <button type="button" className="sbtn" disabled={ownTrig.length >= 20} onClick={() => { if (newTrig.trim()) { setPots((p) => addCustom(p, "trig", newTrig)); setNewTrig(""); } }}>Add</button>
      </div>

      <Head id="pots-set-meds">Medicines and supports</Head>
      <div className="medrow" style={{ borderTop: "none" }}>
        <div className="medinfo"><b>{pots.meds.length ? `${pots.meds.length} on your list` : "None added yet"}</b></div>
        <button type="button" className="sbtn" aria-label="Change medicines and supports" onClick={() => openSub("meds")}>Change</button>
      </div>

      <Head id="pots-set-plan">My plan</Head>
      <p className="hint" style={{ marginBottom: 6 }}>Things clinicians often include in a POTS plan: fluids, salt, compression, a movement plan, sleep, medicines, avoiding your triggers. Add the ones your clinician agreed with you.</p>
      {s.plan.map((it) => (
        <div className="medrow" key={it.id}>
          <div className="medinfo"><b>{it.label}</b></div>
          <button type="button" className="sbtn" aria-label={`Remove ${it.label} from your plan`} onClick={() => { setPots((p) => removePlanItem(p, it.id)); setFocusTo(["pots-set-plan", "pots-set-plan"]); }}>Remove</button>
        </div>
      ))}
      {s.plan.length < 12 && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 8 }}>
          <input className="inp" aria-label="Add an item" placeholder="+ Add an item" maxLength={40} value={newPlan} onChange={(e) => setNewPlan(e.target.value)} />
          <button type="button" className="sbtn" onClick={() => { const l = newPlan.trim(); if (l) { set({ plan: [...s.plan, { id: newId(), label: l.slice(0, 40) }] }); setNewPlan(""); } }}>Add</button>
        </div>
      )}
      <Details label="Things that help many people">
        <p>Talk these through with your clinician:</p>
        <ul>
          <li>Get up in stages: sit for a minute before you stand.</li>
          <li>When you feel lightheaded: cross your legs and squeeze, clench your buttocks, or squat. These counter-moves push blood back up.</li>
          <li>Smaller meals, and care with heat and with standing still for long.</li>
          <li>Waist-high or abdominal compression is the kind most often studied.</li>
        </ul>
        <p>Sources: Heart Rhythm Society 2015; Canadian Cardiovascular Society 2020.</p>
      </Details>
      <p className="rfoot" style={{ marginTop: 4 }}>{REMINDERS_LINE}</p>

      <Head id="pots-set-del">Delete POTS log</Head>
      {!ask && <button type="button" id="pots-set-delbtn" className="ghostbtn" style={{ marginTop: 0 }} onClick={() => setAsk(true)}>Delete POTS log</button>}
      {ask && (
        <div className="plaincard urgent" style={{ marginBottom: 10 }}>
          <p className="plain" tabIndex={-1} ref={askRef}>{POTS_ERASE}</p>
          <button type="button" className="cta" style={{ background: "#A04545" }} onClick={() => { setPots((p) => eraseLog(p)); setAsk(false); ping("POTS log erased"); onBack(); }}>Delete POTS log</button>
          <button type="button" className="ghostbtn" onClick={() => { setAsk(false); setFocusTo(["pots-set-delbtn", "pots-set-del"]); }}>Keep it</button>
        </div>
      )}
      <button type="button" className="ghostbtn" onClick={onBack}>Back to Today</button>
    </section>
  );
}
