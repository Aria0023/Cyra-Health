import { fmt } from "../lib/engine.js";
import Advice from "../components/Advice.jsx";

/* Home (default tab): greeting + streak, check-in CTA, today's top insight,
   wearable cards, milestones, coming up, pulse, monthly recap, and the
   collapsible Wearables / What I'm trying / Appointments / Journal sections. */
const delta = (a, b, goodUp = true) => { const d = b - a; if (d === 0) return <span className="flat">unchanged</span>; const good = goodUp ? d > 0 : d < 0; return <span className={good ? "up" : "down"}>{d > 0 ? "+" : ""}{d}</span>; };

export default function HomeScreen({
  acct, stage, stageName, pregWeek, pred, loggedLast14, streakLine, goTab, entryOn, todayIso, homeInsight, wearInsights, milestones, nextUp, pulse,
  recap, showRecap, setShowRecap,
  showWear, setShowWear, wearSources, connectWear, wearData, wAvg,
  showMeds, setShowMeds, meds, medLog, medEffects, setMedLog, newMed, setNewMed, setMeds, ping,
  showAppts, setShowAppts, upcoming, past, daysUntil, setAppts, newAppt, setNewAppt,
  showJournal, setShowJournal, journal, jDraft, setJDraft, setJournal,
}) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <main>
      <div className="homehead">
        <div>
          <div className="greet">{greet}{acct.name ? `, ${acct.name}` : ""}.</div>
          <div className="greetsub">{stage === "preg" ? `Week ${pregWeek} · second trimester` : pred ? `Day ${pred.cycleDay} · ${pred.phase} phase` : stageName}</div>
        </div>
        <div className="streak"><b>{loggedLast14}</b><span>of 14 days</span></div>
      </div>
      <p className="hint" style={{ marginTop: -6 }}>{streakLine}</p>

      <button className="cta" onClick={() => goTab("today")}>{entryOn(todayIso) ? "Update today's check-in" : "Check in — about 30 seconds"}</button>

      <p className="section-lab">Today's insight</p>
      <div className="card"><div className="num">{homeInsight.num}</div><p>{homeInsight.text}</p></div>

      {wearInsights.length > 0 && (
        <>
          <p className="section-lab">From your wearable</p>
          {wearInsights.map((w, i) => (
            <div className="icard" key={i}>
              <div className="card" style={{ marginBottom: 0 }}><div className="num">{w.num}</div><p>{w.text}</p></div>
              {w.advice && <Advice urgency={w.urgency || "self"}>{w.advice}</Advice>}
            </div>
          ))}
        </>
      )}

      <p className="section-lab">Milestones</p>
      <div className="mstrip">
        {milestones.map((m, i) => (
          <div className={`ms ${m.done ? "done" : ""}`} key={i}>
            <span className="msdot">{m.done ? "✓" : ""}</span>
            <span className="mslabel">{m.label}</span>
            {m.progress != null && !m.done && <span className="msbar"><i style={{ width: `${m.progress * 100}%` }} /></span>}
          </div>
        ))}
      </div>

      {nextUp.length > 0 && (
        <>
          <p className="section-lab">Coming up</p>
          <div className="plaincard" style={{ padding: "6px 16px" }}>
            {nextUp.map((n) => (
              <div className="nextrow" key={n.k} role={n.action ? "button" : undefined} tabIndex={n.action ? 0 : undefined} onKeyDown={n.action ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); n.action(); } } : undefined} onClick={n.action || undefined} style={n.action ? { cursor: "pointer" } : {}}>
                <span className="nextdot" /><div><div className="nexttext">{n.text}</div><div className={`nextsub ${n.action ? "link" : ""}`}>{n.sub}</div></div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="section-lab">You're not alone · this week across Cyra</p>
      <div className="pulse">
        {pulse.map(([n, what]) => <div className="pulserow" key={what}><b>{n.toLocaleString()}</b><span>women {what}</span></div>)}
        <p className="rfoot" style={{ margin: "10px 0 0" }}>Anonymous counts only — no one's data is shared. Demo figures; live numbers come from the aggregate service.</p>
      </div>

      {recap ? (
        <>
          <button className="disclosure" onClick={() => setShowRecap((v) => !v)}><span>Your month vs last month</span><span>{showRecap ? "−" : "+"}</span></button>
          {showRecap && (
            <div className="bodypanel">
              <div className="recaprow"><span>Average day score</span><b>{recap.score[0]} → {recap.score[1]} {delta(recap.score[0], recap.score[1])}</b></div>
              <div className="recaprow"><span>Calm days</span><b>{recap.calm[0]} → {recap.calm[1]} {delta(recap.calm[0], recap.calm[1])}</b></div>
              <div className="recaprow"><span>Rough nights</span><b>{recap.poor[0]} → {recap.poor[1]} {delta(recap.poor[0], recap.poor[1], false)}</b></div>
              {recap.top && <div className="recaprow"><span>{recap.top.label} days</span><b>{recap.top.prev} → {recap.top.now} {delta(recap.top.prev, recap.top.now, false)}</b></div>}
              <p className="rfoot">Progress isn't always a straight line — a harder month is information, not failure.</p>
            </div>
          )}
        </>
      ) : (
        <div className="card" style={{ marginTop: 14 }}><div className="num">30d</div><p>Your first monthly recap arrives once there are two months to compare. Keep going.</p></div>
      )}

      {/* ---- Wearables ---- */}
      <button className="disclosure" onClick={() => setShowWear((v) => !v)}><span>Wearables{Object.keys(wearSources).length ? ` · ${Object.keys(wearSources).length} connected` : " · optional"}</span><span>{showWear ? "−" : "+"}</span></button>
      {showWear && (
        <div className="bodypanel">
          <p className="hint" style={{ margin: "10px 0" }}>Entirely optional — Cyra works fully without a device. Connect one and it adds skin temperature, resting heart rate, HRV, and sleep to your record, read on your device.</p>
          {[["healthkit", "Apple Watch · Health app", "temperature, heart rate, sleep"], ["oura", "Oura Ring", "temperature trend, HRV, readiness"], ["terra", "Fitbit · Garmin · Whoop", "via a secure aggregator"]].map(([id, name, what]) => (
            <div className="medrow" key={id}>
              <div className="medinfo"><b>{name}</b><span>{what}</span></div>
              <button className={`takebtn ${wearSources[id] ? "on" : ""}`} onClick={() => connectWear(id, name)}>{wearSources[id] ? "✓ Connected" : "Connect"}</button>
            </div>
          ))}
          {wearData.length > 0 && (
            <div className="plaincard" style={{ marginTop: 10 }}>
              <div className="recaprow" style={{ borderTop: "none", marginTop: 0 }}><span>Avg temperature deviation</span><b>{wAvg("temp") > 0 ? "+" : ""}{wAvg("temp")}°C</b></div>
              <div className="recaprow"><span>Resting heart rate</span><b>{wAvg("rhr")} bpm</b></div>
              <div className="recaprow"><span>HRV</span><b>{wAvg("hrv")} ms</b></div>
              <div className="recaprow"><span>Sleep score</span><b>{wAvg("sleep")}</b></div>
            </div>
          )}
          <p className="rfoot">Demo imports 30 days of illustrative data shaped to your stage; production reads your real device history. Wearable signals confirm patterns after the fact — they don't replace a clinician and aren't contraception.</p>
        </div>
      )}

      {/* ---- What I'm trying ---- */}
      <button className="disclosure" onClick={() => setShowMeds((v) => !v)}><span>What I'm trying · meds, supplements, habits{meds.length ? ` · ${meds.length}` : ""}</span><span>{showMeds ? "−" : "+"}</span></button>
      {showMeds && (
        <div className="bodypanel">
          <p className="hint" style={{ margin: "10px 0" }}>Change one thing — a prescription, a supplement, cutting caffeine, an earlier bedtime — and Cyra compares your days before and after. Trial and error, with a record.</p>
          {meds.map((m) => {
            const takenToday = !!(medLog[todayIso] || {})[m.id];
            const eff = medEffects.find((e) => e.id === m.id);
            return (
              <div className="medrow" key={m.id}>
                <div className="medinfo"><b>{m.name}</b><span>{m.kind === "rx" ? "Prescription" : m.kind === "supp" ? "Supplement" : "Habit"} · since {fmt(m.started)}</span>
                  {eff?.ready ? <span className="medeff">Day score {eff.before} → {eff.after} since starting</span> : <span className="medeff muted">{eff ? `${eff.need} more logged days to compare` : ""}</span>}
                </div>
                <button aria-pressed={takenToday} className={`takebtn ${takenToday ? "on" : ""}`} onClick={() => setMedLog((l) => ({ ...l, [todayIso]: { ...(l[todayIso] || {}), [m.id]: !takenToday } }))}>{takenToday ? "✓ Taken" : "Taken today?"}</button>
              </div>
            );
          })}
          <input className="inp" placeholder="e.g. Estradiol patch · Magnesium · No caffeine after noon" aria-label="e.g. Estradiol patch · Magnesium · No caffeine after noon" value={newMed.name} onChange={(e) => setNewMed((x) => ({ ...x, name: e.target.value }))} />
          <div className="mcrow" style={{ marginBottom: 9 }}>
            {[["rx", "Prescription"], ["supp", "Supplement"], ["habit", "Habit / lifestyle"]].map(([v, l]) => <button key={v} aria-pressed={newMed.kind === v} className={`mc ${newMed.kind === v ? "on" : ""}`} onClick={() => setNewMed((x) => ({ ...x, kind: v }))}>{l}</button>)}
          </div>
          <p className="lab" style={{ margin: "4px 0 6px" }}>Started on</p>
          <input className="inp" type="date" aria-label="Started on date" value={newMed.started} onChange={(e) => setNewMed((x) => ({ ...x, started: e.target.value }))} />
          <button className="cta" onClick={() => { if (!newMed.name.trim()) return ping("Give it a name first"); setMeds((m) => [...m, { id: Date.now(), ...newMed }]); setNewMed({ name: "", kind: "supp", started: todayIso }); ping("Added — Cyra will compare your days before and after"); }}>Add</button>
          <p className="rfoot">Change one variable at a time for two weeks, then look — that's how you learn what actually moves your days. Cyra never recommends doses or changes; those stay with you and your clinician.</p>
        </div>
      )}

      {/* ---- Appointments ---- */}
      <button className="disclosure" onClick={() => setShowAppts((v) => !v)}><span>Appointments{upcoming.length ? ` · ${upcoming.length} upcoming` : ""}</span><span>{showAppts ? "−" : "+"}</span></button>
      {showAppts && (
        <div className="bodypanel">
          {upcoming.map((a) => (
            <div className="medrow" key={a.id}>
              <div className="medinfo"><b>{a.who || "Appointment"}</b><span>{fmt(a.date)} · in {daysUntil(a.date)} day{daysUntil(a.date) === 1 ? "" : "s"}</span></div>
              {daysUntil(a.date) <= 7 && <button className="takebtn on" onClick={() => goTab("report")}>Prep report</button>}
            </div>
          ))}
          {past.filter((a) => !a.note).map((a) => (
            <div className="plaincard" key={a.id} style={{ margin: "8px 0" }}>
              <b style={{ fontSize: 13.5 }}>{a.who || "Appointment"} · {fmt(a.date)}</b>
              <p className="hint" style={{ margin: "4px 0 8px" }}>What did they say? A line or two is enough.</p>
              <textarea className="inp" rows={2} style={{ resize: "none", fontFamily: "inherit" }} placeholder="e.g. Starting a low-dose patch, recheck in 3 months" aria-label="e.g. Starting a low-dose patch, recheck in 3 months" onBlur={(e) => { const v = e.target.value.trim(); if (v) setAppts((x) => x.map((y) => y.id === a.id ? { ...y, note: v } : y)); }} />
            </div>
          ))}
          {past.filter((a) => a.note).slice(0, 3).map((a) => <div className="medrow" key={a.id}><div className="medinfo"><b>{a.who || "Appointment"} · {fmt(a.date)}</b><span>{a.note}</span></div></div>)}
          <p className="lab" style={{ margin: "10px 0 6px" }}>Add an appointment</p>
          <input className="inp" type="date" aria-label="Appointment date" value={newAppt.date} onChange={(e) => setNewAppt((x) => ({ ...x, date: e.target.value }))} />
          <input className="inp" placeholder="With whom (optional)" aria-label="With whom (optional)" value={newAppt.who} onChange={(e) => setNewAppt((x) => ({ ...x, who: e.target.value }))} />
          <button className="cta" onClick={() => { if (!newAppt.date) return ping("Pick a date"); setAppts((x) => [...x, { id: Date.now(), ...newAppt, note: "" }]); setNewAppt({ date: "", who: "" }); ping("Added — Cyra will nudge you to prep a week out"); }}>Add</button>
        </div>
      )}

      {/* ---- Journal ---- */}
      <button className="disclosure" onClick={() => setShowJournal((v) => !v)}><span>Journal{Object.keys(journal).length ? ` · ${Object.keys(journal).length} entries` : ""}</span><span>{showJournal ? "−" : "+"}</span></button>
      {showJournal && (
        <div className="bodypanel">
          <p className="hint" style={{ margin: "10px 0 8px" }}>How are you, really? Some days a slider isn't enough.</p>
          <textarea className="inp" rows={3} style={{ resize: "none", fontFamily: "inherit" }} value={jDraft} onChange={(e) => setJDraft(e.target.value)} placeholder="Private. Just for you." />
          <button className="cta" onClick={() => { if (!jDraft.trim()) return; setJournal((j) => ({ ...j, [todayIso]: jDraft.trim() })); setJDraft(""); ping("Saved to your journal"); }}>Save entry</button>
          {Object.keys(journal).sort().reverse().slice(0, 5).map((iso) => <div className="jentry" key={iso}><b>{fmt(iso)}</b><p>{journal[iso]}</p></div>)}
        </div>
      )}
    </main>
  );
}
