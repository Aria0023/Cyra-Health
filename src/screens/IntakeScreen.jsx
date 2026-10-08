/* Stage intake ("change" from the header chip): four taps re-route the user to
   exactly one life-stage experience. Pregnancy always wins. */
const OBQ = [
  { key: "preg", q: "Are you currently pregnant?", opts: [["yes", "Yes"], ["no", "No"], ["ttc", "Trying to be"]] },
  { key: "age", q: "Which fits you?", opts: [["u35", "Under 35"], ["3544", "35–44"], ["45p", "45+"]] },
  { key: "per", q: "Your periods lately?", opts: [["regular", "Pretty regular"], ["irregular", "Irregular or changing"], ["none12", "None in 12+ months"], ["na", "Prefer to skip"]] },
  { key: "vms", q: "Hot flashes or night sweats recently?", opts: [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]] },
];

export default function IntakeScreen({ org, acct, ob, setOb, obBusy, setObBusy, setStage, setStageName, setWelcome, setAppTab, setPregTab, finishOnboarding }) {
  const q = OBQ[ob.step];
  return (
    <main className="obwrap">
      <span className="mark">{org.name}<span className="sub">{org.tag}</span></span>
      <h1 className="disp" style={{ marginTop: 22 }}>{acct.name ? `${acct.name}, let's set up` : "Let's set up"}
        <br />your space.</h1>
      <p className="hint">Four quick taps. Your answers shape the whole app — one experience, built for where you are. Your health answers stay on your device.</p>
      {obBusy ? (
        <div className="card" style={{ display: "block" }}><p>Personalizing your space…</p></div>
      ) : (
        <>
          <div className="obq">{q.q}</div>
          <div className="obopts">
            {q.opts.map(([v, label]) => (
              <button key={v} className="obopt" onClick={() => {
                const next = { ...ob, [q.key]: v };
                if (q.key === "preg" && v === "yes") { setOb(next); setObBusy(true); setTimeout(() => { setStage("preg"); setStageName("Pregnancy"); setWelcome("Your pregnancy space is ready — week tracking, kick counts, and gentle guidance."); setAppTab("home"); setPregTab("home"); setObBusy(false); }, 700); return; }
                if (ob.step < OBQ.length - 1) setOb({ ...next, step: ob.step + 1 });
                else { setOb(next); finishOnboarding(); }
              }}>{label}</button>
            ))}
          </div>
          <div className="obdots">{OBQ.map((_, i) => <span key={i} className={i === ob.step ? "on" : ""} />)}</div>
        </>
      )}
      <p className="rfoot">You can retake this anytime — life changes, the app changes with you.</p>
    </main>
  );
}
