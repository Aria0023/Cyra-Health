import Advice from "../components/Advice.jsx";
import { PatternsCard, ChartSoon, windowDays, dayStats } from "../components/PatternCharts.jsx";
import { INSIGHT_STARTERS } from "../lib/askStarters.js";

/* Cycle & Peri — Patterns: the patterns card (the same card Home shows: day-score line with the
   symptom rows, or the cycle rings), insight + advice cards and trial before/after cards. Every
   insight card ends in an action row: "Add to visit notes →" opens the Report tab (which turns the
   record into the one-page summary) and, when the written library has a question for it,
   "Ask about this →" opens Ask with that question answered on the device (lib/askStarters.js).
   onGo(tab), onAsk(question) and onPots() come from App.jsx. */
export default function PatternsScreen({ ins, symIds, symMap, stage, isMeno = false, todayIso, medEffects, potsOn = false, popIso = null, onGo, onAsk, onPots = null }) {
  const days = windowDays(ins.sorted, symIds, todayIso);
  const logged = days.filter((d) => d.e).length;
  const starts = isMeno ? [] : ins.starts || [];
  const stats = logged >= 3 ? dayStats(days) : null;
  const top = ins.counts[0];
  const actions = (id) => (
    <p className="pline aline">
      <button type="button" className="linkbtn" onClick={() => onGo("report")}>Add to visit notes →</button>
      {INSIGHT_STARTERS[id] && <> · <button type="button" className="linkbtn" onClick={() => onAsk(INSIGHT_STARTERS[id])}>Ask about this →</button></>}
    </p>
  );
  return (
    <main>
      <h1 className="disp">Your last 60 days</h1>
      {logged < 3 && (
        <ChartSoon logged={logged}>
          <p className="pline"><button type="button" className="linkbtn" onClick={() => onGo("today")}>Log today's check-in →</button></p>
        </ChartSoon>
      )}
      <PatternsCard days={days} ids={symIds} labels={symMap} starts={starts} sorted={ins.sorted} todayIso={todayIso} popIso={popIso} allowCycle={!isMeno} />

      {stats && stats.diff != null && stats.diff <= -10 && (
        <div className="icard">
          <div className="card"><div className="num">{stats.diff}</div><p>Your days have been getting harder over the last eight weeks{stats.showStretches ? ` — the hardest stretch was ${stats.worstSpan}` : ""}.</p></div>
          <Advice urgency="visit" mid>Worth a conversation soon; the Report tab turns this into a one-page summary you can hand over.</Advice>
          {actions("trend")}
        </div>
      )}
      {stage === "peri" && ins.variability != null && (
        <div className="icard">
          <div className="card"><div className="num">{ins.variability}d</div><p>Cycles ran {ins.lens.join(" · ")} days — a 7+ day spread is the clinical marker of the transition (STRAW staging).</p></div>
          <Advice urgency="visit" mid>Start the treatment conversation early — and ask about a lipid panel and bone-health baseline; the transition is when both start shifting.</Advice>
          {actions("var")}
        </div>
      )}
      {stage === "peri" && ins.hfMult && (
        <div className="icard">
          <div className="card"><div className="num">{ins.hfMult.toFixed(1)}×</div><p>Hot flashes were {ins.hfMult.toFixed(1)}× more likely after a rough night.</p></div>
          <Advice urgency="visit" mid>This frequency is treatable: ask about hormone-therapy eligibility — and if that's not for you, SSRIs or the newer NK3-antagonist class are options to discuss.</Advice>
          {actions("hf")}
        </div>
      )}
      {stage === "periods" && top && top.days >= 3 && (
        <div className="icard">
          <div className="card"><div className="num">{top.days}/30</div><p>{top.label} showed up most — {top.days} of your last 30 days.</p></div>
          <Advice urgency={top.id === "crm" && top.strong > 8 ? "visit" : "self"} mid>
            {top.id === "crm"
              ? top.strong > 8
                ? "Pain that strong, that often, isn't something to just push through — it's worth a proper look (endometriosis takes years to diagnose largely because people are told it's normal)."
                : "Continuous low-level heat and well-timed anti-inflammatories both have real evidence for cramps."
              : "Track it against your calendar — if it clusters in the week before your period, that's a PMS pattern you can plan around."}
          </Advice>
          {actions(top.id)}
        </div>
      )}
      {medEffects.filter((e) => e.ready).map((e) => (
        <div className="icard" key={e.id}>
          <div className="card"><div className="num">{e.before}→{e.after}</div><p>Average day score in the two weeks before vs after starting <b>{e.name}</b>. {e.after - e.before >= 5 ? "That's a real shift." : e.after - e.before <= -5 ? "Days got harder — worth mentioning to whoever prescribed it." : "Too early to call; keep logging."}</p></div>
          <Advice urgency="visit" mid>Bring this before/after to your next visit — it's exactly the evidence a clinician needs to decide whether to continue, adjust, or stop.</Advice>
          {actions("med")}
        </div>
      ))}
      {/* POTS tools: their patterns live in POTS tools only (never in insights() or this screen). */}
      {potsOn && <p className="hint" style={{ marginTop: 16 }}>Your POTS patterns live in POTS tools. {onPots && <button type="button" className="linkbtn" onClick={onPots}>Go to POTS tools →</button>}</p>}
    </main>
  );
}
