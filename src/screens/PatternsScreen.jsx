import { fmt, loadOf, stripeColor, isPeriodDay } from "../lib/engine.js";
import Advice from "../components/Advice.jsx";

/* Cycle & Peri — Patterns: 60-day stripe field, insight + advice cards,
   trial before/after cards, symptom-frequency bars. */
export default function PatternsScreen({ ins, symIds, ramp, scoreColor, stage, medEffects }) {
  return (
    <main>
      <h1 className="disp">Your last 60 days</h1>
      {ins.sorted.length === 0 && <p className="hint">Nothing logged yet — your first check-in starts the pattern. Come back after a few days and this fills in.</p>}
      <div className="stripes" role="img" aria-label="Sixty daily stripes colored from calm to heavy; a dot marks period days">
        {ins.sorted.slice(-60).map((d) => (
          <div key={d.date} className="scol" title={fmt(d.date)}>
            <div className="stripe" style={{ background: stripeColor(loadOf(d, symIds), ramp().rough, ramp().good, ramp().mid) }} />
            <div className={`sdot ${isPeriodDay(d) ? "on" : ""}`} />
          </div>
        ))}
      </div>
      <div className="legend"><span>calm</span><span className="lbar" style={{ background: `linear-gradient(90deg,${scoreColor(1)},${scoreColor(0.5)},${scoreColor(0)})` }} /><span>heavy</span><span className="lper">· period</span></div>

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
      <div className="bars">
        {ins.counts.map((c) => (
          <div key={c.id} className="brow"><span className="blab">{c.label}</span><div className="btrack"><div className="bfill" style={{ width: `${(c.days / 30) * 100}%`, background: `linear-gradient(90deg,${scoreColor(0.62)},${scoreColor(Math.max(0, 0.55 - (c.days / 30) * 0.55))})` }} /></div><span className="bval">{c.days}</span></div>
        ))}
      </div>
    </main>
  );
}
