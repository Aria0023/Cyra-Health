import Advice from "../components/Advice.jsx";

/* Pregnancy — Milestones: the evidence-based low-risk prenatal schedule (spec §7),
   each item status-tagged against the current week. */
const PRENATAL = [
  { tri: "First trimester", items: [
    { w: "8–10", from: 8, to: 10, label: "Initial visit + full labs", note: "Blood type & Rh, antibody screen, blood count, immunity (rubella, varicella), hepatitis B & C, HIV, syphilis, urine culture, gonorrhea/chlamydia." },
    { w: "8–12", from: 8, to: 12, label: "Dating ultrasound", note: "Confirms due date — the anchor for everything after." },
    { w: "10+", from: 10, to: 13, label: "Genetic screening (NIPT)", note: "Cell-free DNA from week 10, or combined nuchal scan at 11–13. Optional, your call." },
    { w: "any", from: 0, to: 13, label: "Folate + vaccines", note: "Prenatal vitamin with folate; flu and COVID vaccines recommended in any trimester." },
  ]},
  { tri: "Second trimester", items: [
    { w: "15–20", from: 15, to: 20, label: "Serum screen (if no NIPT)", note: "The quad screen window, for those who skipped cell-free DNA." },
    { w: "18–22", from: 18, to: 22, label: "Anatomy scan", note: "The big ultrasound — organs, growth, placenta position." },
    { w: "24–28", from: 24, to: 28, label: "Glucose screening", note: "One-hour 50g screen for gestational diabetes; repeat blood count for anemia rides along." },
    { w: "27–36", from: 27, to: 36, label: "Tdap vaccine", note: "Every pregnancy — it's how baby gets whooping-cough protection before their own shots." },
    { w: "28", from: 28, to: 28, label: "RhoGAM (if Rh-negative)", note: "Only applies if your blood type is Rh-negative — your week-8 labs answered that." },
  ]},
  { tri: "Third trimester", items: [
    { w: "28+", from: 28, to: 40, label: "Daily kick awareness", note: "From 28 weeks, the movement pattern matters — a real change in the pattern is a call-today, not a wait." },
    { w: "32–36", from: 32, to: 36, label: "RSV vaccine (seasonal)", note: "Given Sept–Jan in the US to protect baby's first RSV season." },
    { w: "36–37", from: 36, to: 37, label: "GBS swab", note: "Quick routine test; a positive just means antibiotics in labor." },
    { w: "36", from: 36, to: 40, label: "Position check + weekly visits", note: "Baby's position confirmed; cadence steps up to weekly." },
    { w: "41", from: 41, to: 42, label: "Post-dates monitoring", note: "Extra monitoring from 41 weeks; induction offered by 41–42 — evidence favors not going far past." },
  ]},
  { tri: "After birth", items: [
    { w: "<3wk", from: 43, to: 99, label: "Early postpartum contact", note: "Within 3 weeks of delivery — mood, feeding, recovery, blood pressure." },
    { w: "≤12wk", from: 43, to: 99, label: "Comprehensive postpartum visit", note: "The full check by 12 weeks. Postpartum care is care, not a formality." },
  ]},
];

export default function MilestonesScreen({ pregWeek }) {
  return (
    <main>
      <h1 className="disp">Your care roadmap</h1>
      <p className="hint">The standard evidence-based prenatal schedule for a low-risk pregnancy (ACOG-style), positioned against your week {pregWeek}. Your provider's plan always wins — risk factors change the schedule.</p>
      <div className="card" style={{ display: "block" }}>
        <p className="rsec" style={{ margin: "0 0 4px" }}>Visit rhythm</p>
        <p style={{ fontSize: 12.5, lineHeight: 1.6 }}>Every 4 weeks until 28 · every 2 weeks from 28–36 · weekly from 36. Every visit: blood pressure, urine check, fundal height, and baby's heartbeat — BP is how preeclampsia gets caught early.</p>
      </div>
      {PRENATAL.map((g) => (
        <div key={g.tri}>
          <p className="rsec" style={{ marginTop: 14 }}>{g.tri}</p>
          {g.items.map((m) => {
            const done = pregWeek > m.to;
            const now = pregWeek >= m.from && pregWeek <= m.to;
            const soon = !done && !now && m.from - pregWeek > 0 && m.from - pregWeek <= 4;
            return (
              <div className="shelfc" key={m.label} style={done ? { background: "var(--paper)", boxShadow: "none" } : {}}>
                <div className="shead"><span className="sbrand">Weeks {m.w}</span>
                  <span className="ppill" style={now ? { borderColor: "#A04545", color: "#A04545" } : soon ? { borderColor: "var(--primary)", color: "var(--primary)" } : {}}>{done ? "done ✓" : now ? "in window" : soon ? "coming up" : "later"}</span></div>
                <div className="sname">{m.label}</div>
                <p className="hint" style={{ margin: 0 }}>{m.note}</p>
              </div>
            );
          })}
        </div>
      ))}
      <Advice urgency="visit">You're at week {pregWeek}: the glucose screen window opens at 24 — ask to get it scheduled at your next visit, and Tdap can ride along from week 27.</Advice>
      <p className="rfoot">Educational schedule, not medical advice. Twins, chronic conditions, or prior complications all change it — your provider sets your actual plan.</p>
    </main>
  );
}
