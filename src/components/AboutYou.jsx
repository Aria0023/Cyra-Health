import { useId } from "react";
import Details from "./Details.jsx";
import { ChipRow, MultiRow } from "./AnswerChips.jsx";
import { ANSWER_BLANK, AGE_BANDS, CYCLE_LENS, REGULARITY, EVER_PREG, BIRTHS, CONTRA, CONDITIONS, FAMILY_HX, MEDS, GOALS, SLEEP, ACTIVITY, toggleMulti, sanitizeZip, dueDateBounds } from "../lib/onboarding.js";

/* Settings → About you (L11, spec §4.2 / A12): the optional answers that used to be registration steps, each topic a
   collapsed Details so no chip shows until she opens it. Every tap calls onAnswer(key, value), which App.jsx writes into
   regAnswers: on this device, in encrypted backups (without zip and age), never in any network payload. No toast per
   tap; aria-pressed carries the state. The footnotes are the registration steps' sentences, word for word. */
export default function AboutYou({ answers, onAnswer, stage, stageName, todayIso }) {
  const a = { ...ANSWER_BLANK, ...(answers && typeof answers === "object" ? answers : {}) };
  const uid = useId();
  const id = (k) => `${uid}-${k}`;
  const pick = (k) => (v) => onAnswer(k, v);
  const tog = (k) => (v) => onAnswer(k, toggleMulti(a[k], v));
  const cycleStage = stage === "periods" || (stage === "peri" && stageName !== "Menopause");
  const b = dueDateBounds(todayIso);
  return (
    <div className="aboutyou">
      {cycleStage && (
        <Details label="Your cycle">
          <ChipRow id={id("cycleLen")} label="Typical cycle length" options={CYCLE_LENS} value={a.cycleLen} onPick={pick("cycleLen")} />
          <ChipRow id={id("cycleReg")} label="How regular?" options={REGULARITY} value={a.cycleReg} onPick={pick("cycleReg")} />
          <p className="lab">First day of your last period (optional)</p>
          <input className="inp" type="date" aria-label="First day of your last period" value={a.lastPeriod || ""} onChange={(e) => onAnswer("lastPeriod", e.target.value)} />
          <p className="rfoot">Cyra uses your typical cycle length and last period for predictions until your own logged cycles take over.</p>
        </Details>
      )}
      {stage === "preg" && (
        <Details label="Your pregnancy">
          <p className="lab" id={id("due")}>When is your baby due? (optional)</p>
          <input className="inp" type="date" aria-labelledby={id("due")} min={b.min} max={b.max} value={a.dueDate || ""} onChange={(e) => onAnswer("dueDate", e.target.value)} />
          <p className="rfoot">Cyra uses this for your week and your care roadmap.</p>
        </Details>
      )}
      <Details label="Age and ZIP">
        <ChipRow id={id("age")} label="Age" options={AGE_BANDS} value={a.age} onPick={pick("age")} />
        <p className="lab">ZIP or postal code (optional)</p>
        <input className="inp" placeholder="e.g. 90210" aria-label="ZIP or postal code (optional)" maxLength={10} pattern="[A-Za-z0-9 \-]{0,10}" autoComplete="off" value={a.zip || ""} onChange={(e) => onAnswer("zip", sanitizeZip(e.target.value))} />
        <p className="rfoot">ZIP is optional and stays on this device. Cyra doesn't use it yet and never sends it anywhere. Cyra never asks for your street address.</p>
      </Details>
      <Details label="Reproductive history">
        <ChipRow id={id("preg")} label="Ever been pregnant?" options={EVER_PREG} value={a.preg} onPick={pick("preg")} />
        <ChipRow id={id("births")} label="Births" options={BIRTHS} value={a.births} onPick={pick("births")} />
        <ChipRow id={id("contra")} label="Current birth control" options={CONTRA} value={a.contra} onPick={pick("contra")} />
        <p className="rfoot">Every question can be skipped. Your answers stay on this device (and in an encrypted backup, if you save one) and are never sold.</p>
      </Details>
      <Details label="Health background">
        <p className="hint">Diagnoses and family history that can affect hormonal health. We never import medical records.</p>
        <MultiRow id={id("conditions")} label="Relevant conditions (tap any)" options={CONDITIONS} values={a.conditions} onToggle={tog("conditions")} />
        <MultiRow id={id("familyHx")} label="Family history worth noting" options={FAMILY_HX} values={a.familyHx} onToggle={tog("familyHx")} />
        <ChipRow id={id("meds")} label="On regular medication or hormones?" options={MEDS} value={a.meds} onPick={pick("meds")} />
        <p className="rfoot">General categories only. We never ask for medical records, insurance or policy numbers, government ID, or an SSN.</p>
      </Details>
      <Details label="What brings you here">
        <MultiRow id={id("goals")} label="What would make this worth it? (pick a few)" options={GOALS} values={a.goals} onToggle={tog("goals")} />
        <ChipRow id={id("sleep")} label="Sleep, most nights" options={SLEEP} value={a.sleep} onPick={pick("sleep")} />
        <ChipRow id={id("activity")} label="Activity level" options={ACTIVITY} value={a.activity} onPick={pick("activity")} />
      </Details>
    </div>
  );
}
