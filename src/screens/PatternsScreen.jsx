import Advice from "../components/Advice.jsx";
import { PatternsCard, windowDays } from "../components/PatternCharts.jsx";

/* Cycle & Peri — Patterns: the patterns card (the same card Home shows: day-score line with the
   symptom rows, or the cycle rings), insight + advice cards and trial before/after cards. */
export default function PatternsScreen({ ins, symIds, symMap, stage, isMeno = false, todayIso, medEffects, potsOn = false, popIso = null }) {
  const days = windowDays(ins.sorted, symIds, todayIso);
  const logged = days.filter((d) => d.e).length;
  const starts = isMeno ? [] : ins.starts || [];
  return (
    <main>
      <h1 className="disp">Your last 60 days</h1>
      {logged < 3 && <p className="hint">{logged === 0 ? "Nothing logged yet — your first check-in starts the pattern." : "A few more check-ins and your chart fills in."} Come back after a few days.</p>}
      <PatternsCard days={days} ids={symIds} labels={symMap} starts={starts} sorted={ins.sorted} todayIso={todayIso} popIso={popIso} />

      {stage === "peri" && ins.variability != null && (
        <div className="icard">
          <div className="card"><div className="num">{ins.variability}d</div><p>Cycles ran {ins.lens.join(" · ")} days — a 7+ day spread is the clinical marker of the transition (STRAW staging).</p></div>
          <Advice urgency="visit">Start the treatment conversation early — and ask about a lipid panel and bone-health baseline; the transition is when both start shifting.</Advice>
        </div>
      )}
      {stage === "peri" && ins.hfMult && (
        <div className="icard">
          <div className="card"><div className="num">{ins.hfMult.toFixed(1)}×</div><p>Hot flashes were {ins.hfMult.toFixed(1)}× more likely after a rough night.</p></div>
          <Advice urgency="visit">This frequency is treatable: ask about hormone-therapy eligibility — and if that's not for you, SSRIs or the newer NK3-antagonist class are options to discuss.</Advice>
        </div>
      )}
      {stage === "periods" && (
        <div className="icard">
          <div className="card"><div className="num">{ins.counts[0].days}/30</div><p>{ins.counts[0].label} showed up most — {ins.counts[0].days} of your last 30 days.</p></div>
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
          <div className="card"><div className="num">{e.before}→{e.after}</div><p>Average day score in the two weeks before vs after starting <b>{e.name}</b>. {e.after - e.before >= 5 ? "That's a real shift." : e.after - e.before <= -5 ? "Days got harder — worth mentioning to whoever prescribed it." : "Too early to call; keep logging."}</p></div>
          <Advice urgency="visit">Bring this before/after to your next visit — it's exactly the evidence a clinician needs to decide whether to continue, adjust, or stop.</Advice>
        </div>
      ))}
      {/* POTS tools: their patterns live in POTS tools only (never in insights() or this screen). */}
      {potsOn && <p className="hint" style={{ marginTop: 16 }}>Your POTS patterns are in POTS tools (open it from Home).</p>}
    </main>
  );
}
