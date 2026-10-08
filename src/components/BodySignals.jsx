import { FLOW, DISCHARGE, ODOR, BODYODOR } from "../lib/constants.js";
import Advice from "./Advice.jsx";

/* Collapsible Body Signals panel: flow, discharge, vaginal odor, body odor. */
export default function BodySignals({ stage, showBody, setShowBody, flow, setFlow, disch, setDisch, odor, setOdor, bodyOdor, setBodyOdor }) {
  const odorAdvice = () => {
    if (odor === "fishy") return <Advice urgency="now">A fishy odor — especially with grey or thin discharge — is the classic sign of bacterial vaginosis. It's common, it's not your fault, and it's treated with a short course of antibiotics. Worth a visit this week rather than a drugstore guess.</Advice>;
    if (odor === "yeasty") return <Advice urgency="visit">A yeasty or sour smell with thick white discharge and itching usually points to a yeast infection — treatable over the counter, but if it's your first time or it keeps returning, get it confirmed. Recurring thrush can signal something else worth checking.</Advice>;
    if (odor === "strong") return <Advice urgency="visit">Strong odor changes are worth mentioning — but note that healthy vaginas have a scent, and it shifts across your cycle. Skip douching entirely: it disrupts the bacteria that protect you and makes infections more likely.</Advice>;
    if (disch === "unusual") return <Advice urgency="visit">Unusual discharge — green, grey, frothy, or with pain or bleeding — deserves a proper look rather than guesswork. Most causes are simple and treatable.</Advice>;
    if (bodyOdor === "changed") return <Advice urgency="self">Body odor genuinely shifts with hormones — many women notice it changing around ovulation, in pregnancy, and through perimenopause. If it came on suddenly with other symptoms though, mention it.</Advice>;
    return null;
  };

  return (
    <>
      <button className="disclosure" onClick={() => setShowBody((s) => !s)}>
        <span>Body signals{stage === "preg" ? "" : " · flow, discharge, odor"}</span><span>{showBody ? "−" : "+"}</span>
      </button>
      {showBody && (
        <div className="bodypanel">
          {stage !== "preg" && (
            <>
              <p className="section-lab">Flow today</p>
              <div className="wrapchips">
                {FLOW.map(([v, l]) => <button key={v} className={`minichip ${flow === v ? "on" : ""}`} onClick={() => setFlow(flow === v ? null : v)}>{l}</button>)}
              </div>
              {flow === "flood" && <Advice urgency="now">Flooding — soaking a pad or tampon hourly, or passing large clots — is a see-someone-now symptom, not something to endure. Heavy bleeding is treatable and can cause anemia if it goes unchecked.</Advice>}
              <p className="section-lab">Discharge</p>
              <div className="wrapchips">
                {DISCHARGE.map(([v, l]) => <button key={v} className={`minichip ${disch === v ? "on" : ""}`} onClick={() => setDisch(disch === v ? null : v)}>{l}</button>)}
              </div>
            </>
          )}
          <p className="section-lab">Vaginal odor</p>
          <div className="wrapchips">
            {ODOR.map(([v, l]) => <button key={v} className={`minichip ${odor === v ? "on" : ""}`} onClick={() => setOdor(odor === v ? null : v)}>{l}</button>)}
          </div>
          <p className="section-lab">Body odor</p>
          <div className="wrapchips">
            {BODYODOR.map(([v, l]) => <button key={v} className={`minichip ${bodyOdor === v ? "on" : ""}`} onClick={() => setBodyOdor(bodyOdor === v ? null : v)}>{l}</button>)}
          </div>
          {odorAdvice()}
          <p className="rfoot">Nothing here is embarrassing and nothing is judged — these are the signals clinicians actually ask about, and most have simple fixes.</p>
        </div>
      )}
    </>
  );
}
