import { useState } from "react";
import Advice from "../components/Advice.jsx";
import { DayLine, CycleRings, SymptomTimeline, windowDays } from "../components/PatternCharts.jsx";

/* Cycle & Peri — Patterns: the 60-day day-score line (or, with two logged periods, cycle rings),
   insight + advice cards, trial before/after cards, and the symptom timeline. */
export default function PatternsScreen({ ins, symIds, symMap, stage, isMeno = false, todayIso, medEffects }) {
  const [view, setView] = useState("days");
  const days = windowDays(ins.sorted, symIds, todayIso);
  const logged = days.filter((d) => d.e).length;
  const starts = isMeno ? [] : ins.starts || [];
  const canCycle = stage !== "preg" && !isMeno && starts.length >= 2;
  const cycleView = canCycle && view === "cycle";
  return (
    <main>
      <h1 className="disp">Your last 60 days</h1>
      {logged < 3 ? (
        <p className="hint">{logged === 0 ? "Nothing logged yet — your first check-in starts the pattern." : "A few more check-ins and your chart fills in."} Come back after a few days.</p>
      ) : (
        <>
          {canCycle && (
            <div className="mcrow" role="group" aria-label="Chart view" style={{ marginBottom: 10 }}>
              <button type="button" className={`mc ${!cycleView ? "on" : ""}`} aria-pressed={!cycleView} onClick={() => setView("days")}>Day by day</button>
              <button type="button" className={`mc ${cycleView ? "on" : ""}`} aria-pressed={cycleView} onClick={() => setView("cycle")}>By cycle</button>
            </div>
          )}
          <p className="hint" style={{ marginTop: 0 }}>{cycleView ? "One ring per cycle, day 1 at the top. Bigger dots are harder days." : "Day score from your check-ins; higher is a better day."}</p>
          {cycleView
            ? <CycleRings sorted={ins.sorted} ids={symIds} labels={symMap} starts={starts} todayIso={todayIso} />
            : <DayLine days={days} ids={symIds} labels={symMap} starts={starts} />}
        </>
      )}

      {stage === "peri" && ins.variability != null && (
        <div className="icard">
          <div className="card" style={{ marginBottom: 0 }}><div className="num">{ins.variability}d</div><p>Cycles ran {ins.lens.join(" · ")} days — a 7+ day spread is the clinical marker of the transition (STRAW staging).</p></div>
          <Advice urgency="visit">Start the treatment conversation early — and ask about a lipid panel and bone-health baseline; the transition is when both start shifting.</Advice>
        </div>
      )}
      {stage === "peri" && ins.hfMult && (
        <div className="icard">
          <div className="card" style={{ marginBottom: 0 }}><div className="num">{ins.hfMult.toFixed(1)}×</div><p>Hot flashes were {ins.hfMult.toFixed(1)}× more likely after a rough night.</p></div>
          <Advice urgency="visit">This frequency is treatable: ask about hormone-therapy eligibility — and if that's not for you, SSRIs or the newer NK3-antagonist class are options to discuss.</Advice>
        </div>
      )}
      {stage === "periods" && (
        <div className="icard">
          <div className="card" style={{ marginBottom: 0 }}><div className="num">{ins.counts[0].days}/30</div><p>{ins.counts[0].label} showed up most — {ins.counts[0].days} of your last 30 days.</p></div>
          <Advice urgency={ins.counts[0].id === "crm" && ins.counts[0].strong > 8 ? "visit" : "self"}>
            {ins.counts[0].id === "crm"
              ? ins.counts[0].strong > 8
                ? "Pain that strong, that often, isn't something to just push through — it's worth a proper look (endometriosis takes years to diagnose largely because people are told it's normal)."
                : "Continuous low-level heat and well-timed anti-inflammatories both have real evidence for cramps."
              : "Track it against your calendar — if it clusters in the week before your period, that's a PMS pattern you can plan around."}
          </Advice>
        </div>
      )}
      {medEffects.filter((e) => e.ready).map((e) => (
        <div className="icard" key={e.id}>
          <div className="card" style={{ marginBottom: 0 }}><div className="num">{e.before}→{e.after}</div><p>Average day score in the two weeks before vs after starting <b>{e.name}</b>. {e.after - e.before >= 5 ? "That's a real shift." : e.after - e.before <= -5 ? "Days got harder — worth mentioning to whoever prescribed it." : "Too early to call; keep logging."}</p></div>
          <Advice urgency="visit">Bring this before/after to your next visit — it's exactly the evidence a clinician needs to decide whether to continue, adjust, or stop.</Advice>
        </div>
      ))}
      {logged >= 3 && (
        <>
          <p className="section-lab">What showed up, and when</p>
          <SymptomTimeline days={days} ids={symIds} labels={symMap} starts={starts} />
        </>
      )}
    </main>
  );
}
