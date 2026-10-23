import Advice from "../components/Advice.jsx";
import { PatternsCard, ChartSoon, windowDays, dayStats } from "../components/PatternCharts.jsx";
import { INSIGHT_STARTERS } from "../lib/askStarters.js";
import { lensLabel } from "../lib/engine.js";
import FertilitySummary from "../components/FertilitySummary.jsx";
import SummaryCard from "../components/SummaryCard.jsx";
import Details from "../components/Details.jsx";
import { famVar } from "../lib/constants.js";

/* Cycle & Peri — Patterns: the patterns card (the same card Home shows: day-score line with the
   symptom rows, or the cycle rings), insight + advice cards and trial before/after cards. Every
   insight card ends in an action row: "Add to visit notes →" opens the Report tab (which turns the
   record into the one-page summary) and, when the written library has a question for it,
   "Ask about this →" opens Ask with that question answered on the device (lib/askStarters.js).
   onGo(tab), onAsk(question) and onPots() come from App.jsx. The perimenopause spread is a clinical marker: it
   counts every cycle, and lens6 (engine cycleSummary) labels the ones she left out of predictions (L5).
   L8 (lib/insights.js, worked out in App.jsx on render, never saved): the "This week / This month" summary opens the
   screen under the h1 (week / month); `found` holds the links in her log — up to 2 sleep links plus Low energy
   (energyId) and one cycle-day cluster (never in menopause: App passes cycles: false) — and every check Cyra ran,
   listed under "How Cyra finds these". The POTS pointer stays last. */
export default function PatternsScreen({ ins, lens6 = null, symIds, symMap, stage, isMeno = false, todayIso, medEffects, potsOn = false, popIso = null, onGo, onAsk, onPots = null, scoreScale, fert = null, week = null, month = null, found = null, scoreColor, energyId = null }) {
  const days = windowDays(ins.sorted, symIds, todayIso, 60, scoreScale);
  const lensList = lens6 || ins.lens.map((len) => ({ len, excluded: false }));
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
  // Links in her log (L8): at most 2 sleep links other than Low energy, then Low energy's; at most one cycle-day card.
  const sleepCards = found ? [...found.sleep.filter((f) => f.id !== energyId).slice(0, 2), ...found.sleep.filter((f) => f.id === energyId)] : [];
  const cycleCards = found ? found.cycle.slice(0, 1) : [];
  const findCard = (f) => (
    <div className="icard" key={f.key}>
      <div className="card findcard"><div className="num">{f.num}</div><p><i className="fdot" aria-hidden="true" style={{ background: famVar(f.fam) }} />{f.text}</p></div>
      <Advice urgency={f.advice.urgency} mid>{f.advice.text}</Advice>
      {actions(f.askId)}
    </div>
  );
  return (
    <main>
      <h1 className="disp">Your last 60 days</h1>
      {logged > 0 && week && <SummaryCard week={week} month={month} scoreColor={scoreColor} todayIso={todayIso} onLog={logged >= 3 ? () => onGo("today") : null} />}
      {logged < 3 && (
        <ChartSoon logged={logged}>
          <p className="pline"><button type="button" className="linkbtn" onClick={() => onGo("today")}>Log today's check-in →</button></p>
        </ChartSoon>
      )}
      <PatternsCard days={days} ids={symIds} labels={symMap} starts={starts} sorted={ins.sorted} todayIso={todayIso} popIso={popIso} allowCycle={!isMeno} scale={scoreScale} />
      {/* Trying to conceive with fertility signs shown (L7): this cycle's signs, an observation only. */}
      {fert && <FertilitySummary days={ins.sorted} starts={ins.starts} todayIso={todayIso} unit={fert.unit} onLog={() => onGo("today")} />}

      {stats && stats.diff != null && stats.diff <= -10 && (
        <div className="icard">
          <div className="card"><div className="num">{stats.diff}</div><p>Your days have been getting harder over the last eight weeks{stats.showStretches ? ` — the hardest stretch was ${stats.worstSpan}` : ""}.</p></div>
          <Advice urgency="visit" mid>Worth a conversation soon; the Report tab turns this into a one-page summary you can hand over.</Advice>
          {actions("trend")}
        </div>
      )}
      {stage === "peri" && ins.variability != null && (
        <div className="icard">
          <div className="card"><div className="num">{ins.variability}d</div><p>Cycles ran {lensList.map(lensLabel).join(" · ")} days — a 7+ day spread is the clinical marker of the transition (STRAW staging).</p></div>
          <Advice urgency="visit" mid>Start the treatment conversation early — and ask about a lipid panel and bone-health baseline; the transition is when both start shifting.</Advice>
          {actions("var")}
        </div>
      )}
      {sleepCards.map(findCard)}
      {cycleCards.map(findCard)}
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
      {logged >= 3 && found && (
        <div className="plaincard findhow">
          <Details label="How Cyra finds these">
            <p className="plain">Cyra compares days in your own log. A link means two things showed up together in your log, not that one causes the other.</p>
            <p className="plain">Sleep links compare days after a rough night (Rough night under Last night, or Sleep disruption logged as moderate or strong) with days after a night you marked Slept well, over the last 60 days. One shows only with at least 5 days on each side, 4 moderate or strong days in all, and a clear gap: at least 1.3 times as often, and at least 20 in 100 days apart.</p>
            {!isMeno && <p className="plain">Cycle days count from each logged period start, across your last 4 cycles, up to cycle day 45. A cluster shows only with two period starts, the symptom on 6 days or more, 4 of them inside the 4 days named and from two different cycles, and those days at least twice as likely as your other cycle days.</p>}
            <ul className="findlist">{found.checked.map((l) => <li key={l}>{l}</li>)}</ul>
            <p className="plain">Worked out on this device whenever Cyra shows them. Cyra doesn't save them or send them anywhere; they leave this device only in a report you choose to share.</p>
          </Details>
        </div>
      )}
      {/* POTS tools: their patterns live in POTS tools only (never in insights() or this screen). */}
      {potsOn && <p className="hint" style={{ marginTop: 16 }}>Your POTS patterns live in POTS tools. {onPots && <button type="button" className="linkbtn" onClick={onPots}>Go to POTS tools →</button>}</p>}
    </main>
  );
}
