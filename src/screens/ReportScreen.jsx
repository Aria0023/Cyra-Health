import { fmt } from "../lib/engine.js";

/* Cycle & Peri — Report, "What to tell your doctor": plain-language findings,
   what they might mean, verbatim scripts, send-ahead email, and the collapsed
   data table demoted below the guidance. */
export default function ReportScreen({ ins, stage, stageName, buildEmail, ping, showTable, setShowTable }) {
  const n = ins.last30.length; // days logged in the last 30 calendar days
  const email = buildEmail();
  const emailText = `Subject: ${email.subject}\n\n${email.body}`;
  return (
    <main>
      <h1 className="disp">What to tell your doctor</h1>
      <p className="hint">Appointments are short. This turns the last 30 days of what you felt into a few clear sentences — so "I just haven't felt right" becomes something your doctor can actually work with.</p>

      <p className="rsec">1 · What stands out</p>
      {(() => {
        const top = ins.counts.filter((c) => c.days > 0).slice(0, 3);
        const pct = (d) => Math.round((d / Math.max(1, ins.last30.length)) * 100);
        const inWords = (d) => {
          const p = pct(d);
          if (p >= 80) return "nearly every day";
          if (p >= 60) return "most days";
          if (p >= 40) return "about half the days";
          if (p >= 20) return "a few days a week";
          return "now and then";
        };
        return (
          <div className="plaincard">
            {top.length === 0 ? (
              <p className="plain">You haven't logged much yet. A week or two of check-ins is enough to start seeing something real.</p>
            ) : top.map((c) => (
              <p className="plain" key={c.id}>
                <b>{c.label}</b> showed up <b>{inWords(c.days)}</b> — {c.days} of the {n} days you logged in the last 30
                {c.strong > 0 ? `, and ${c.strong} of those were moderate or strong` : ""}.
              </p>
            ))}
            {ins.variability != null && (
              <p className="plain">
                <b>Your periods came {ins.variability >= 7 ? "at quite different times" : "fairly steadily"}</b> — {ins.lens.join(", ")} days apart. Doctors call that a {ins.variability}-day spread.
              </p>
            )}
            {stage === "peri" && ins.hfMult && ins.hfMult > 1.2 && (
              <p className="plain">
                <b>Bad nights made the next day worse.</b> After a rough night's sleep, hot flashes were about {ins.hfMult.toFixed(1)} times more likely.
              </p>
            )}
          </div>
        );
      })()}

      <p className="rsec">2 · What this might mean</p>
      <div className="plaincard">
        {stage === "peri" && ins.variability != null && ins.variability >= 7 && (
          <p className="plain">Periods that vary by a week or more are one of the clearest signs the menopause transition has started. That's not a diagnosis — but it's the exact thing doctors look at, and it usually means this is a years-long change worth planning for, not a random bad month.</p>
        )}
        {stage === "peri" && ins.counts.find((c) => (c.id === "hf" || c.id === "ns") && c.days >= 8) && (
          <p className="plain">Hot flashes and night sweats this often are <b>treatable</b> — this is the single most fixable thing on your list. Most women are never offered treatment simply because it never gets discussed.</p>
        )}
        {ins.counts.find((c) => c.id === "slp" && c.days >= 8) && (
          <p className="plain">Sleep that's disrupted this often is worth treating on its own, not just waiting out. Poor sleep tends to make every other symptom louder, so fixing it often improves several things at once.</p>
        )}
        {stage === "periods" && ins.counts.find((c) => c.id === "crm" && c.strong >= 6) && (
          <p className="plain">Pain this strong, this often, isn't something to just get through. Period pain that regularly stops you has causes that are diagnosable and treatable — it often goes unaddressed for years because people are told it's normal.</p>
        )}
        <p className="plain">These are patterns in what you logged — observations, not a diagnosis. Only your doctor can say what's causing them.</p>
      </div>

      <p className="rsec">3 · What to say out loud</p>
      <p className="hint" style={{ marginBottom: 10 }}>Read these word for word if it helps. Knowing the question is half of getting a real answer.</p>
      <div className="plaincard">
        {ins.counts.filter((c) => c.days > 0).slice(0, 1).map((c) => (
          <p className="script" key={c.id}>“I logged {n} of the last 30 days. {c.label} happened on {c.days} of them. What could be causing it?”</p>
        ))}
        {ins.variability != null && ins.variability >= 7 && (
          <p className="script">“My cycles have ranged from {Math.min(...ins.lens)} to {Math.max(...ins.lens)} days. Could I be in perimenopause, and what does that mean for me?”</p>
        )}
        {stage === "peri" && (
          <p className="script">“Am I a candidate for hormone therapy? If not, what non-hormonal options would you consider?”</p>
        )}
        {ins.counts.find((c) => c.days >= 8) && (
          <p className="script">“Could we check my thyroid, iron levels, and vitamin D? I've read those can cause symptoms like mine.”</p>
        )}
        <p className="script">“If we try something, how will we know in a few months whether it's working?”</p>
      </div>

      <p className="rsec">4 · Send it ahead</p>
      <p className="hint" style={{ marginBottom: 10 }}>A short email your doctor can read in twenty seconds — nothing to log into on their end. Below is exactly what it says. Cyra itself sends nothing; the text goes only where you take it.</p>
      <textarea className="inp emailpreview" readOnly rows={9} aria-label="Email preview" value={emailText} onFocus={(e) => e.target.select()} />
      <div className="routes">
        <button className="route" onClick={() => { window.open(`mailto:?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`); ping("Handing off to your email… If nothing opens, use Copy email instead."); }}>Open in email<span>pre-filled draft</span></button>
        <button className="route" onClick={() => { const blocked = () => ping("Copy blocked — select the text in the preview above"); if (navigator.clipboard?.writeText) navigator.clipboard.writeText(emailText).then(() => ping("Email copied — paste anywhere"), blocked); else blocked(); }}>Copy email<span>paste anywhere</span></button>
      </div>

      <button className="disclosure" style={{ marginTop: 14 }} onClick={() => setShowTable((v) => !v)}>
        <span>The numbers behind this</span><span>{showTable ? "−" : "+"}</span>
      </button>
      {showTable && (
        <div className="bodypanel">
          <div className="rtitle" style={{ fontSize: 15, marginTop: 10 }}>Symptom log <span className="rmeta">{stageName} · {ins.last30.length ? `${fmt(ins.last30[0].date)}–${fmt(ins.last30[ins.last30.length - 1].date)}` : "nothing logged yet"}</span></div>
          <table className="rtab"><thead><tr><th>Symptom</th><th>Days (of {n} logged)</th><th>Mod.–strong</th></tr></thead>
            <tbody>{ins.counts.map((c) => <tr key={c.id}><td>{c.label}</td><td>{c.days}/{n}</td><td>{c.strong}</td></tr>)}</tbody></table>
          {ins.variability != null && <p className="rfoot">Cycle lengths: {ins.lens.join(", ")} days ({ins.variability}-day spread).</p>}
          <p className="rfoot">Logged daily by you. Observations, not diagnoses.</p>
        </div>
      )}
    </main>
  );
}
