import { CERVICAL_MUCUS, OVULATION_TEST } from "../lib/constants.js";
import { parseBbt, bbtToText, FERT_COPY } from "../lib/fertility.js";

/* Today → "Fertility signs" (local-first L7, decision D6): cervical mucus and an ovulation test as joined .seg rows,
   basal body temperature as a text field with a °C / °F .seg. All optional; tapping a choice again clears it. Shown only
   where App.jsx fertShown() says so (Trying to conceive by default, My Cycle when she turns it on in Settings), and
   rendered just before Body signals. Form state only (App.jsx `fert`); the save writes cm / opk / bbt on the day entry
   (lib/fertility.js fertEntryFields) and never hands them to contribute(). The unit she picks (setUnit) is saved in
   fertSigns. No motion, no network, never auto-focused.
   privacy: the flag-dependent line from lib/disclosures.js fertPrivacyLine, followed by the fixed guidance sentence. */
export default function FertilitySigns({ fert, setFert, unit, setUnit, privacy }) {
  const typedUnit = fert.bbtUnit === "C" || fert.bbtUnit === "F" ? fert.bbtUnit : unit;
  const parsed = parseBbt(fert.bbtText, typedUnit);
  const bad = !parsed.ok;
  const err = !bad ? null
    : parsed.why === "format" ? (typedUnit === "F" ? FERT_COPY.errFormatF : FERT_COPY.errFormatC)
    : parsed.why === "otherUnit" ? (typedUnit === "F" ? FERT_COPY.errOtherF : FERT_COPY.errOtherC)
    : FERT_COPY.errRange;
  const pickUnit = (u) => {
    // A valid reading moves with the unit; anything else stays as typed and is checked in the new unit. The tap is her
    // choice of unit, so it is saved (fertSigns.unit) even when it was already the locale's default.
    setFert((f) => {
      const p = parseBbt(f.bbtText, f.bbtUnit === "C" || f.bbtUnit === "F" ? f.bbtUnit : unit);
      return { ...f, bbtText: p.ok && p.c != null ? bbtToText(p.c, u) : f.bbtText, bbtUnit: u };
    });
    setUnit(u);
  };
  return (
    <div className="plaincard fertsigns" role="group" aria-labelledby="fert-lab">
      <p className="section-lab" id="fert-lab">{FERT_COPY.title}</p>
      <p className="hint fertsub">{FERT_COPY.sub}</p>
      <div role="group" aria-labelledby="fert-cm-lab">
        <p className="qlab" id="fert-cm-lab">Cervical mucus</p>
        <div className="mcrow seg fertseg">
          {CERVICAL_MUCUS.map(([v, l]) => (
            <button key={v} type="button" aria-pressed={fert.cm === v} className={`mc ${fert.cm === v ? "on" : ""}`} onClick={() => setFert((f) => ({ ...f, cm: f.cm === v ? null : v }))}>{l}</button>
          ))}
        </div>
      </div>
      <div role="group" aria-labelledby="fert-opk-lab">
        <p className="qlab" id="fert-opk-lab">Ovulation test</p>
        <div className="mcrow seg fertseg">
          {OVULATION_TEST.map(([v, l]) => {
            const on = v === "none" ? !fert.opk : fert.opk === v;
            return <button key={v} type="button" aria-pressed={on} className={`mc ${on ? "on" : ""}`} onClick={() => setFert((f) => ({ ...f, opk: v === "none" || f.opk === v ? null : v }))}>{l}</button>;
          })}
        </div>
      </div>
      <label className="qlab" htmlFor="fert-bbt">Basal body temperature</label>
      <div className="bbtrow">
        <input id="fert-bbt" className="inp" type="text" inputMode="decimal" autoComplete="off" enterKeyHint="done"
          placeholder={typedUnit === "F" ? "e.g. 97.61" : "e.g. 36.45"} value={fert.bbtText}
          aria-invalid={bad ? "true" : undefined} aria-describedby={bad ? "fert-bbt-err" : "fert-bbt-help"}
          onChange={(e) => { const v = e.target.value; setFert((f) => ({ ...f, bbtText: v, bbtUnit: unit })); }} />
        <div className="mcrow seg unitseg" role="group" aria-label="Temperature unit">
          {["C", "F"].map((u) => (
            <button key={u} type="button" aria-pressed={typedUnit === u} className={`mc ${typedUnit === u ? "on" : ""}`} onClick={() => pickUnit(u)}>°{u}</button>
          ))}
        </div>
      </div>
      {bad ? <p className="errhint" id="fert-bbt-err">{err}</p> : <p className="rfoot inphelp" id="fert-bbt-help">{FERT_COPY.bbtHelp}</p>}
      <p className="rfoot fertfoot">{`${privacy} ${FERT_COPY.foot}`}</p>
    </div>
  );
}
