import { CADENCE } from "../lib/constants.js";

/* ⚙ Settings: check-in cadence, nudge time, quick vs full check-in. */
export default function SettingsSheet({ cadence, setCadence, quietHours, setQuietHours, quickMode, setQuickMode, setShowSettings, ping }) {
  return (
    <section className="palsheet" aria-label="Check-in settings">
      <p className="section-lab" style={{ margin: "0 0 8px" }}>Check-in rhythm</p>
      <div className="regcards">
        {CADENCE.map((cd) => (
          <button key={cd.id} aria-pressed={cadence === cd.id} className={`stagecard ${cadence === cd.id ? "on" : ""}`} style={{ padding: "10px 14px" }} onClick={() => { setCadence(cd.id); ping(`Rhythm set to ${cd.label.toLowerCase()}`); }}><b style={{ fontSize: 14 }}>{cd.label}</b><span>{cd.desc}</span></button>
        ))}
      </div>
      <p className="section-lab" style={{ margin: "14px 0 8px" }}>Best time to nudge</p>
      <div className="mcrow">
        {[["morning", "Morning"], ["midday", "Midday"], ["evening", "Evening"], ["never", "Never remind me"]].map(([v, l]) => (
          <button key={v} aria-pressed={quietHours === v} className={`mc ${quietHours === v ? "on" : ""}`} onClick={() => setQuietHours(v)}>{l}</button>
        ))}
      </div>
      <p className="section-lab" style={{ margin: "14px 0 8px" }}>Check-in style</p>
      <div className="mcrow">
        <button className={`mc ${quickMode ? "on" : ""}`} onClick={() => setQuickMode(true)}>Quick · 3 taps</button>
        <button className={`mc ${!quickMode ? "on" : ""}`} onClick={() => setQuickMode(false)}>Full detail</button>
      </div>
      <p className="rfoot">One reminder at most. Missed days are never scolded — your patterns work fine with gaps.</p>
      <button className="ghostbtn" style={{ marginTop: 10 }} onClick={() => setShowSettings(false)}>Done</button>
    </section>
  );
}
