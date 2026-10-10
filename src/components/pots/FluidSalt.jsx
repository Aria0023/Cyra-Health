import { dayTotals, fmtFluid, fmtSodium, setIv, mlToOz, naMgToSaltG } from "../../lib/pots.js";
import { amountText, naText, isOz, isGSalt, numOf, numProps } from "./ui.js";

/* Fluids and Sodium cards (design 4.5). Totals are oral only and missing is never zero
   ("Nothing logged yet"); IV fluids are kept apart and never added to the oral total or goal.
   The goal meter is palette chrome (a progress control, never red), not data viz. Nothing
   here suggests an amount: goals are hers, and sodium comes from labels she copies. */

/** Progress against her own goal, in her display unit. Stored values are ml / mg sodium. */
function GoalMeter({ label, whenWord, total, goal, by, conv, unitWord, goalText }) {
  const t = total == null ? 0 : conv(total), gl = conv(goal);
  const reached = total != null && total >= goal;
  return (
    <>
      <div className="goalbar" role="progressbar" aria-valuemin={0} aria-valuemax={gl} aria-valuenow={Math.min(t, gl)} aria-label={`${label} ${whenWord}, ${t} of your ${gl} ${unitWord}`}>
        <div className="goalfill" style={{ width: `${Math.min(100, ((total || 0) / goal) * 100)}%` }} />
      </div>
      <p className="hint" style={{ margin: "0 0 8px" }}>{reached ? "Goal reached" : `of ${goalText} · ${by === "clinician" ? "your clinician's goal" : "your goal"}`}</p>
    </>
  );
}
const ozConv = (ml) => Math.round(mlToOz(ml));
const gConv = (mg) => Math.round(naMgToSaltG(mg) * 10) / 10;

/** The IV fluids row: given by a clinic, shown on its own, never part of the oral total. The
    two fields are keyed on the day only, so saving one on blur never remounts the other (the
    field she just moved into keeps focus and the phone keyboard stays up). */
function IvRow({ iv, day, setPots }) {
  const on = !!iv;
  const put = (patch) => setPots((p) => setIv(p, day, { ...(((p.days || {})[day] || {}).iv || {}), ...patch }));
  return (
    <div style={{ marginTop: 10 }}>
      <button type="button" className={`mc ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setPots((p) => setIv(p, day, on ? null : { ml: null, note: "" }))}>IV fluids today (given by a clinic)</button>
      {on && (
        <div style={{ marginTop: 4 }} key={day}>
          <label className="lab" htmlFor="pots-iv-ml" style={{ marginTop: 8 }}>How much (ml)</label>
          <input id="pots-iv-ml" className="inp" {...numProps()} aria-label="How much (ml)" defaultValue={iv.ml ?? ""} onBlur={(e) => { const v = numOf(e.target.value); put({ ml: v == null ? null : Math.round(v) }); }} />
          <label className="lab" htmlFor="pots-iv-note" style={{ marginTop: 0 }}>Note (optional)</label>
          <input id="pots-iv-note" className="inp" aria-label="IV fluids note (optional)" maxLength={200} defaultValue={iv.note || ""} onBlur={(e) => put({ note: e.target.value })} />
        </div>
      )}
    </div>
  );
}

export default function FluidSalt({ pots, day, whenWord = "today", units, setPots, onPreset, onOther, onGoal }) {
  const tot = dayTotals(pots, day), g = pots.settings.goals, presets = pots.settings.presets;
  const iv = (pots.days[day] || {}).iv || null;
  const fromDrinks = ((pots.days[day] || {}).intake || []).filter((x) => x.ml != null && x.naMg != null).reduce((a, x) => a + x.naMg, 0);
  const drinks = presets.filter((x) => x.ml != null);
  const salts = presets.filter((x) => x.ml == null); // every salt button, whatever its kind
  const naLabel = (pr) => (pr.naMg != null ? ` · ${pr.kind === "salt" ? "about " : ""}${naText(pr.naMg, units)}` : "");
  return (
    <>
      <section className="plaincard" aria-labelledby="pots-fluid-h" style={{ marginBottom: 12 }}>
        <h2 className="lab" id="pots-fluid-h" style={{ marginTop: 0 }} tabIndex={-1}>Fluids</h2>
        <p className="plain" style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>
          {tot.fluidMl != null ? `${fmtFluid(tot.fluidMl, units)} so far` : "Nothing logged yet"}
          {tot.iv && <span style={{ fontSize: 13, fontWeight: 500, color: "var(--soft)" }}>{` · plus ${tot.ivMl != null ? fmtFluid(tot.ivMl, units) : "some"} IV`}</span>}
        </p>
        {g.fluidMl != null
          ? <GoalMeter label="Fluids" whenWord={whenWord} total={tot.fluidMl} goal={g.fluidMl} by={g.by} conv={isOz(units) ? ozConv : (x) => x} unitWord={isOz(units) ? "fluid ounces" : "millilitres"} goalText={fmtFluid(g.fluidMl, units)} />
          : <button type="button" className="linkbtn" style={{ margin: "2px 0 8px" }} onClick={onGoal}>Set a goal</button>}
        <div className="mcrow">
          {drinks.map((pr) => (
            <button type="button" key={pr.id} className="mc" style={{ minHeight: 56 }} aria-label={`Add ${pr.label}, ${isOz(units) ? `${ozConv(pr.ml)} fluid ounces` : `${pr.ml} millilitres`}${pr.naMg != null ? `, ${naText(pr.naMg, units)}` : ""}`} onClick={() => onPreset(pr)}>
              + {pr.label} {amountText(pr.ml, units)}{naLabel(pr)}
            </button>
          ))}
          <button type="button" className="mc" style={{ minHeight: 56 }} onClick={() => onOther("fluid")}>+ Other amount</button>
        </div>
        <IvRow iv={iv} day={day} setPots={setPots} />
      </section>

      <section className="plaincard" aria-labelledby="pots-salt-h" style={{ marginBottom: 12 }}>
        <h2 className="lab" id="pots-salt-h" style={{ marginTop: 0 }} tabIndex={-1}>Sodium</h2>
        <p className="plain" style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>
          {tot.naMg == null ? "Nothing logged yet" : isGSalt(units) ? `${fmtSodium(tot.naMg, units)} so far (about ${fmtSodium(tot.naMg, null)} sodium)` : `Sodium ${fmtSodium(tot.naMg, units)} so far`}
        </p>
        {fromDrinks > 0 && <p className="hint" style={{ margin: "0 0 6px" }}>{`Includes ${naText(fromDrinks, units)} (from drinks)`}</p>}
        {g.naMg != null
          ? <GoalMeter label="Sodium" whenWord={whenWord} total={tot.naMg} goal={g.naMg} by={g.by} conv={isGSalt(units) ? gConv : (x) => x} unitWord={isGSalt(units) ? "grams of salt" : "milligrams of sodium"} goalText={fmtSodium(g.naMg, units)} />
          : <button type="button" className="linkbtn" style={{ margin: "2px 0 8px" }} onClick={onGoal}>Set a goal</button>}
        <div className="mcrow">
          {salts.map((pr) => (
            <button type="button" key={pr.id} className="mc" style={{ minHeight: 56 }} aria-label={`Add ${pr.label}${pr.naMg != null ? `, ${pr.kind === "salt" ? "about " : ""}${naText(pr.naMg, units)}` : ""}`} onClick={() => onPreset(pr)}>
              + {pr.label}{naLabel(pr)}
            </button>
          ))}
          <button type="button" className="mc" style={{ minHeight: 56 }} onClick={() => onOther("salt")}>+ Other amount</button>
        </div>
        <p className="hint" style={{ margin: "10px 0 0" }}>Labels list sodium in mg. 1 g of salt has about 390 mg of sodium.</p>
      </section>
    </>
  );
}
