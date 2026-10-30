import { useState } from "react";
import { Sheet } from "./ui/index.js";
import Icon from "./Icon.jsx";
import Details from "./Details.jsx";
import { MODULE_FRAMING, MODULES, sourcesOf } from "../lib/modules.js";
import {
  MOVE_TYPES, MOVE_MINUTES, MOVE_MAX, SLEEP_CHIPS, SLEEP_MAX, SLEEP_STEP, hoursText, bodyDay, moveLabel, PCOS_DAY, LAB_KINDS,
  WEIGHT_UNITS, labText, convert, checkValue, MEAL_SLOTS, MEAL_KINDS, MEAL_LATE, MEAL_ENERGY, MEALS_PER_DAY, mealText,
} from "../lib/bodylog.js";
import { t, fmtDate } from "../lib/i18n.js";

/* The fast log's sheets (calm R4, spec §3.5b). Each one writes on tap: there is no Save to forget, and she can close it
   whenever. Everything is on this device only (lib/bodylog.js keys bodyLog / labs / bodyPrefs, and the existing meds /
   medLog). `day` is the day being logged (today unless she picked another on the Logs strip); `dayWord` names it. */

const fmtDay = (iso) => fmtDate(iso, { month: "short", day: "numeric" });
const whyText = (r, unit) => (r.why === "range" ? `That looks outside ${r.lo}–${r.hi} ${unit}. Check the number?` : r.why === "date" ? "Pick the date of the test." : "Type a number, like 5.4.");

/* ---------- Sleep: hours, one tap ---------- */
export function SleepSheet({ day, dayWord, log, onSet, onClose }) {
  const h = bodyDay(log, day).sleepH ?? null;
  const step = (d) => onSet(Math.max(0, Math.min(SLEEP_MAX, (h ?? 7) + d)));
  return (
    <Sheet id="sleep-sheet" title={t("bodySheets.sleep")} closeLabel={t("bodySheets.closeSleep")} onClose={onClose} className="bsheet">
      <p className="bsheet-sub">{t("bodySheets.hoursSleptHowItFelt", { dayWord })}</p>
      <div className="bigval" aria-live="polite"><span className="serif">{h == null ? "—" : hoursText(h)}</span></div>
      <div className="hourchips" role="group" aria-label={t("bodySheets.hoursSlept")}>
        {SLEEP_CHIPS.map((n) => <button key={n} type="button" className={`mc ${h === n ? "on" : ""}`} aria-pressed={h === n} onClick={() => onSet(n)}>{n === SLEEP_CHIPS[SLEEP_CHIPS.length - 1] ? t("bodySheets.h", { n }) : t("bodySheets.h2", { n })}</button>)}
      </div>
      <div className="stepper" role="group" aria-label={t("bodySheets.adjustByHalfAnHour")}>
        <button type="button" className="sbtn" aria-label={t("bodySheets.halfAnHourLess")} disabled={h != null && h <= 0} onClick={() => step(-SLEEP_STEP)}>−</button>
        <span className="hint">{t("bodySheets.hour")}</span>
        <button type="button" className="sbtn" aria-label={t("bodySheets.halfAnHourMore")} disabled={h != null && h >= SLEEP_MAX} onClick={() => step(SLEEP_STEP)}>+</button>
      </div>
      <div className="bsheet-foot">
        {h != null && <button type="button" className="linkbtn" onClick={() => onSet(null)}>{t("bodySheets.clearHours")}</button>}
        <button type="button" className="cta" onClick={onClose}>{t("bodySheets.done")}</button>
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
    <Sheet id="move-sheet" title={t("bodySheets.movement")} closeLabel={t("bodySheets.closeMovement")} onClose={onClose} className="bsheet">
      <p className="bsheet-sub">{t("bodySheets.anyKindCountsPickWhat", { dayWord })}</p>
      <p className="lab" id="move-type-lab">{t("bodySheets.what")}</p>
      <div className="typechips" role="group" aria-labelledby="move-type-lab">
        {MOVE_TYPES.map((tv) => <button key={tv.id} type="button" className={`mc ${type === tv.id ? "on" : ""}`} aria-pressed={type === tv.id} onClick={() => setType(tv.id)}>{tv.label}</button>)}
      </div>
      <p className="lab" id="move-min-lab">{t("bodySheets.howLongTapToAdd")}</p>
      <div className="minchips" role="group" aria-labelledby="move-min-lab">
        {MOVE_MINUTES.map((n, i) => <button key={n} type="button" className="mc minchip" aria-label={t("bodySheets.addMinutes", { v0: moveLabel(type), n, v2: i === MOVE_MINUTES.length - 1 ? " or more" : "" })} onClick={() => onAdd({ type, min: n })}>{i === MOVE_MINUTES.length - 1 ? `${n}+` : n}<small> {t("bodySheets.min")}</small></button>)}
      </div>
      <div className="customrow">
        <input className="inp" inputMode="numeric" aria-label={t("bodySheets.customMinutes")} placeholder={t("bodySheets.customMinutes")} value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))} onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }} aria-invalid={!!err} aria-describedby={err ? "move-err" : undefined} />
        <button type="button" className="sbtn" onClick={addCustom}>{t("bodySheets.add")}</button>
      </div>
      {err && <p className="fielderr" id="move-err" role="alert">{err}</p>}
      {mv.length > 0 && (
        <ul className="sesslist" aria-label={t("bodySheets.movement2", { dayWord })}>
          {mv.map((m) => (
            <li key={m.id}><Icon name="move" size={16} /><span>{t("bodySheets.min2", { v0: moveLabel(m.type), min: m.min })}</span>
              <button type="button" className="linkbtn" aria-label={t("bodySheets.removeMinutes", { v0: moveLabel(m.type), min: m.min })} onClick={() => onRemove(m.id)}>{t("bodySheets.remove")}</button></li>
          ))}
        </ul>
      )}
      <div className="bsheet-foot"><button type="button" className="cta" onClick={onClose}>{t("bodySheets.done")}</button></div>
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
    <Sheet id="meds-sheet" title={t("bodySheets.medsSupplements")} closeLabel={t("bodySheets.closeMeds")} onClose={onClose} className="bsheet">
      {meds.length > 0 && <p className="bsheet-sub">{t("bodySheets.tapWhatYouTook", { dayWord })}</p>}
      {meds.length > 0 && (
        <div className="medtakes" role="group" aria-label={t("bodySheets.taken", { dayWord })}>
          {meds.map((m) => {
            const on = !!(medDay || {})[m.id];
            return (
              <div key={m.id} className="medtake-row">
                <button type="button" className={`medtake ${on ? "on" : ""}`} aria-pressed={on} onClick={() => onToggle(m.id)}>
                  <span className="medtake-tick" aria-hidden="true">{on ? <Icon name="check" size={14} /> : null}</span>
                  <span className="medtake-name">{m.name}</span>
                </button>
                {edit && <button type="button" className="linkbtn" aria-label={t("bodySheets.removeFromYourList", { name: m.name })} onClick={() => onRemove(m.id)}>{t("bodySheets.remove")}</button>}
              </div>
            );
          })}
        </div>
      )}
      {edit ? (
        <div className="medadd">
          <p className="lab" id="medadd-lab">{meds.length ? t("bodySheets.addToYourList") : t("bodySheets.yourListIsEmptyAdd")}</p>
          <input className="inp" aria-labelledby="medadd-lab" placeholder={t("bodySheets.eGMetforminInositolVitamin")} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} aria-invalid={!!err} aria-describedby={err ? "medadd-err" : undefined} />
          <div className="seg medkinds" role="group" aria-label={t("bodySheets.kind")}>
            {KINDS.map(([v, l]) => <button key={v} type="button" className={`mc ${kind === v ? "on" : ""}`} aria-pressed={kind === v} onClick={() => setKind(v)}>{l}</button>)}
          </div>
          {err && <p className="fielderr" id="medadd-err" role="alert">{err}</p>}
          <button type="button" className="sbtn" onClick={add}>{t("bodySheets.addToList")}</button>
        </div>
      ) : (
        <button type="button" className="linkbtn" onClick={() => setEdit(true)}>{t("bodySheets.editList")}</button>
      )}
      <p className="rfoot">{t("bodySheets.cyraNeverRecommendsDosesOr")}</p>
      <div className="bsheet-foot"><button type="button" className="cta" onClick={onClose}>{t("bodySheets.done")}</button></div>
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
    <Sheet id="weight-sheet" title={t("bodySheets.weight")} closeLabel={t("bodySheets.closeWeight")} onClose={onClose} className="bsheet">
      <p className="bsheet-sub">{MODULES.pcos.weight.note}</p>
      <label className="lab" htmlFor="weight-inp">{t("bodySheets.weight2", { dayWord })}</label>
      <div className="customrow">
        <input id="weight-inp" className="inp" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 6))} onKeyDown={(e) => { if (e.key === "Enter") save(); }} aria-invalid={!!err} aria-describedby={err ? "weight-err" : undefined} />
        <div className="seg unitseg" role="group" aria-label={t("bodySheets.unit")}>
          {WEIGHT_UNITS.map((u) => <button key={u} type="button" className={`mc ${unit === u ? "on" : ""}`} aria-pressed={unit === u} onClick={() => { const n = checkValue(text, unit); if (n.ok && u !== unit) setText(String(convert(n.value, unit, u))); onUnit(u); }}>{u}</button>)}
        </div>
      </div>
      {err && <p className="fielderr" id="weight-err" role="alert">{err}</p>}
      <div className="bsheet-foot">
        {on && <button type="button" className="linkbtn" onClick={onOff}>{t("bodySheets.stopAddingWeight")}</button>}
        <button type="button" className="cta" onClick={save}>{t("bodySheets.saveWeight")}</button>
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
    <Sheet id="pcos-sheet" title={t("bodySheets.pcosSignals")} closeLabel={t("bodySheets.closePcosSignals")} onClose={onClose} className="bsheet">
      <p className="bsheet-sub">{t("bodySheets.tapWhatShowedUpOne", { dayWord })}</p>
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
            <Details label={t("bodySheets.aboutSkinDarkening")}><p>{a.info}</p>{s && <p className="srcline">{t("bodySheets.source", { title: s.title, year: s.year })}</p>}</Details>
          ); })()}
        </div>
      ))}
      <div className="labbox">
        <p className="lab" id="labs-lab">{t("bodySheets.valuesFromYourOwnResults")}</p>
        <div className="seg labkinds" role="group" aria-labelledby="labs-lab">
          {Object.values(LAB_KINDS).map((k) => <button key={k.id} type="button" className={`mc ${kind === k.id ? "on" : ""}`} aria-pressed={kind === k.id} onClick={() => { setKind(k.id); setErr(""); }}>{k.id === "waist" ? t("bodySheets.waist") : k.label}</button>)}
        </div>
        <div className="customrow">
          <input className="inp" inputMode="decimal" aria-label={t("bodySheets.value", { label: LAB_KINDS[kind].label })} placeholder={t("bodySheets.value2")} value={text} onChange={(e) => setText(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 6))} aria-invalid={!!err} aria-describedby={err ? "lab-err" : undefined} />
          <div className="seg unitseg" role="group" aria-label={t("bodySheets.unit2", { label: LAB_KINDS[kind].label })}>
            {LAB_KINDS[kind].units.map((u) => <button key={u} type="button" className={`mc ${unit === u ? "on" : ""}`} aria-pressed={unit === u} onClick={() => onUnit(LAB_KINDS[kind].pref, u)}>{u}</button>)}
          </div>
        </div>
        <label className="lab" htmlFor="lab-date">{kind === "waist" ? t("bodySheets.measuredOn") : t("bodySheets.dateOfTheTest")}</label>
        <div className="customrow">
          <input id="lab-date" className="inp" type="date" max={todayIso} value={date} onChange={(e) => setDate(e.target.value)} />
          <button type="button" className="sbtn" onClick={add}>{t("bodySheets.add")}</button>
        </div>
        {err && <p className="fielderr" id="lab-err" role="alert">{err}</p>}
        {labs.length > 0 && (
          <ul className="sesslist" aria-label={t("bodySheets.valuesYouAdded")}>
            {labs.slice(0, 8).map((x) => (
              <li key={x.id}><span><b>{LAB_KINDS[x.kind].label}</b> {labText(x)} · {fmtDay(x.date)}</span>
                <button type="button" className="linkbtn" aria-label={t("bodySheets.removeFrom", { label: LAB_KINDS[x.kind].label, v1: labText(x), v2: fmtDay(x.date) })} onClick={() => onRemoveLab(x.id)}>{t("bodySheets.remove")}</button></li>
            ))}
          </ul>
        )}
        <p className="hint labnote">{t("bodySheets.cyraKeepsTheseOnThis")}</p>
      </div>
      <p className="rfoot">{MODULE_FRAMING}</p>
      <div className="bsheet-foot"><button type="button" className="cta" onClick={onClose}>{t("bodySheets.done")}</button></div>
    </Sheet>
  );
}

/* ---------- Meal notes (optional, off by default): which meal, what it was mostly, energy after ----------
   Calorie-free on purpose: no foods, amounts, photos or scores. Picking a meal adds it (or opens the one already noted,
   except Snack, which can repeat); every chip below saves on tap. Up to MEALS_PER_DAY a day. */
export function MealsSheet({ day, dayWord, log, onAdd, onSet, onRemove, onClose }) {
  const meals = bodyDay(log, day).meals || [];
  const [sel, setSel] = useState(meals.length ? meals[meals.length - 1].id : null);
  const cur = meals.find((m) => m.id === sel) || null;
  const full = meals.length >= MEALS_PER_DAY;
  const pickSlot = (slot) => {
    const had = slot !== "snack" ? meals.find((m) => m.meal === slot) : null;
    if (had) { setSel(had.id); return; }
    const id = onAdd(slot);
    if (id) setSel(id);
  };
  const chip = (on, label, onClick, key) => (
    <button key={key} type="button" className={`mc pchip ${on ? "on" : ""}`} aria-pressed={on} onClick={onClick}>{on && <Icon name="check" size={13} />}{label}</button>
  );
  return (
    <Sheet id="meals-sheet" title={t("bodySheets.meals")} closeLabel={t("bodySheets.closeMeals")} onClose={onClose} className="bsheet mealsheet">
      <p className="bsheet-sub">{t("bodySheets.mealsSub", { dayWord })}</p>
      <div className="bigval mealcount" aria-live="polite"><span className="serif">{meals.length}</span><span className="mealcount-w">{t("bodySheets.mealNotesCount", { count: meals.length })}</span></div>
      {meals.length > 0 && (
        <ul className="meallist" aria-label={t("bodySheets.mealNotesOn", { dayWord })}>
          {meals.map((m) => (
            <li key={m.id} className={m.id === sel ? "on" : ""}>
              <button type="button" className="mealpick" aria-pressed={m.id === sel} onClick={() => setSel(m.id)}>
                <span className="mealpick-ico" aria-hidden="true"><Icon name="bowl" size={16} /></span><span>{mealText(m)}</span>
              </button>
              <button type="button" className="linkbtn" aria-label={t("bodySheets.removeMeal", { what: mealText(m) })} onClick={() => { onRemove(m.id); if (m.id === sel) setSel(null); }}>{t("bodySheets.remove")}</button>
            </li>
          ))}
        </ul>
      )}
      <p className="lab" id="meal-slot-lab">{meals.length ? t("bodySheets.whichMealAnother") : t("bodySheets.whichMeal")}</p>
      <div className="typechips mealslots" role="group" aria-labelledby="meal-slot-lab">
        {MEAL_SLOTS.map((x) => {
          const on = !!cur && cur.meal === x.id;
          const blocked = full && !(x.id !== "snack" && meals.some((m) => m.meal === x.id));
          return <button key={x.id} type="button" className={`mc ${on ? "on" : ""}`} aria-pressed={on} disabled={blocked} onClick={() => pickSlot(x.id)}>{x.label}</button>;
        })}
      </div>
      {full && <p className="hint">{t("bodySheets.mealsFull", { n: MEALS_PER_DAY })}</p>}
      {cur ? (
        <div className="mealedit">
          <div className="pgroup">
            <p className="lab" id="meal-kind-lab">{t("bodySheets.whatItWasMostly")}</p>
            <div className="pchips" role="group" aria-labelledby="meal-kind-lab">
              {MEAL_KINDS.map((k) => chip(cur.kind === k.id, k.label, () => onSet(cur.id, { kind: cur.kind === k.id ? null : k.id }), k.id))}
              {chip(!!cur.late, MEAL_LATE.label, () => onSet(cur.id, { late: !cur.late }), MEAL_LATE.id)}
            </div>
          </div>
          <div className="pgroup">
            <p className="lab" id="meal-energy-lab">{t("bodySheets.energyAfter")}</p>
            <div className="pchips mealenergy" role="group" aria-labelledby="meal-energy-lab">
              {MEAL_ENERGY.map((e) => chip(cur.energy === e.id, e.label, () => onSet(cur.id, { energy: cur.energy === e.id ? null : e.id }), e.id))}
            </div>
          </div>
        </div>
      ) : (
        <p className="hint mealhint">{t("bodySheets.mealsPickFirst")}</p>
      )}
      <p className="rfoot">{t("bodySheets.mealsFoot")}</p>
      <div className="bsheet-foot"><button type="button" className="cta" onClick={onClose}>{t("bodySheets.done")}</button></div>
    </Sheet>
  );
}

export { fmtDay };
