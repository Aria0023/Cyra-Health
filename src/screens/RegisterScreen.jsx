import { CADENCE } from "../lib/constants.js";

/* Phase 2: registration — 8 steps with validation. Red state appears only after
   the user taps Continue with required fields missing; optional fields never turn red. */
const RSTEPS = [
  { key: "account", title: "Create your account", sub: "Or don't — Anonymous Mode gives you the full app with no name, no email, nothing that identifies you. If anyone ever demands we identify you, we can't." },
  { key: "basics", title: "A bit about you", sub: "Age band and ZIP — enough to personalize, never enough on their own to identify you." },
  { key: "stage", title: "Where are you right now?", sub: "This shapes your entire experience. You can change it anytime." },
  { key: "cycle", title: "Your cycle history", sub: "So predictions start accurate instead of guessing for months." },
  { key: "repro", title: "Reproductive history", sub: "Private and optional — it genuinely changes what's relevant to you." },
  { key: "health", title: "Health background", sub: "General categories that interact with hormonal health — never your medical records." },
  { key: "goals", title: "What brings you here?", sub: "So the app leads with what you actually care about." },
  { key: "consent", title: "Your data, your rules", sub: "The promises that never change — and the choices that are yours." },
];

export default function RegisterScreen({ reg, setReg, regStep, setRegStep, regTouched, setRegTouched, cadence, setCadence, socialBusy, setSocialBusy, ping, finishReg }) {
  const rs = RSTEPS[regStep];
  const REQ = {
    account: [["email", reg.anon || reg.email.includes("@")]],
    basics: [["age", reg.age], ["zip", reg.zip]],
    stage: [["stage", reg.stage]],
    cycle: [["cycleLen", reg.cycleLen], ["cycleReg", reg.cycleReg]],
    repro: [["preg", reg.preg]],
    health: [["meds", reg.meds]],
    goals: [["goals", reg.goals.length], ["sleep", reg.sleep], ["activity", reg.activity]],
    consent: [["terms", reg.terms]],
  };
  const miss = (REQ[rs.key] || []).filter(([, ok]) => !ok).map(([k]) => k);
  const bad = (k) => regTouched[rs.key] && miss.includes(k);
  const rup = (k, v) => setReg((x) => ({ ...x, [k]: v }));
  const rtog = (k, v) => setReg((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));
  const RLab = ({ k, children }) => <p className={`lab ${bad(k) ? "labErr" : ""}`}>{children}{bad(k) && <span className="need"> · needed</span>}</p>;
  const RChips = ({ k, opts }) => (
    <div className={`mcrow ${bad(k) ? "err" : ""}`}>
      {opts.map((o) => <button key={o} aria-pressed={reg[k] === o} className={`mc ${reg[k] === o ? "on" : ""}`} onClick={() => rup(k, reg[k] === o ? null : o)}>{o}</button>)}
    </div>
  );
  const RMulti = ({ k, opts }) => (
    <div className={`mcrow ${bad(k) ? "err" : ""}`}>
      {opts.map((o) => <button key={o} className={`mc ${reg[k].includes(o) ? "on" : ""}`} onClick={() => rtog(k, o)}>{o}</button>)}
    </div>
  );

  const advance = () => {
    if (miss.length) { setRegTouched((t) => ({ ...t, [rs.key]: true })); return; }
    if (regStep < RSTEPS.length - 1) setRegStep(regStep + 1); else finishReg();
  };

  return (
    <main className="obwrap">
      <span className="mark">Cyra<span className="sub">Health</span></span>
      <div className="prog" style={{ marginTop: 14 }}>{RSTEPS.map((_, i) => <span key={i} className={i <= regStep ? "on" : ""} />)}</div>
      <div className="stepno">Step {regStep + 1} of {RSTEPS.length}</div>
      <h1 className="disp">{rs.title}</h1>
      <p className="hint">{rs.sub}</p>

      {rs.key === "account" && (
        <>
          <input className="inp" placeholder="First name (optional)" aria-label="First name (optional)" value={reg.name} onChange={(e) => rup("name", e.target.value)} />
          <input className={`inp ${bad("email") ? "inpErr" : ""}`} placeholder="Email" aria-label="Email" type="email" value={reg.email} onChange={(e) => rup("email", e.target.value)} />
          <input className="inp" placeholder="Password" aria-label="Password" type="password" value={reg.pass} onChange={(e) => rup("pass", e.target.value)} />
          <button className="ghostbtn" onClick={() => { rup("anon", !reg.anon); rup("email", ""); }}>{reg.anon ? "✓ Anonymous Mode on" : "Continue in Anonymous Mode instead"}</button>
          <div className="orline"><span>or sign in with</span></div>
          <div className="social">
            {[["apple", "Apple", "#000"], ["google", "Google", "#4285F4"], ["facebook", "Facebook", "#1877F2"]].map(([id, label, color]) => (
              <button key={id} className="socialbtn" disabled={!!socialBusy} onClick={() => {
                setSocialBusy(id);
                setTimeout(() => {
                  /* Production: redirect to the provider's OAuth flow; the backend callback
                     returns a verified email + name. Demo fills in a placeholder identity. */
                  setReg((x) => ({ ...x, anon: false, email: x.email || `you@${id === "apple" ? "privaterelay.appleid.com" : id + ".com"}`, name: x.name }));
                  setSocialBusy(null); ping(`Signed in with ${label}`); setRegStep(1);
                }, 900);
              }}>
                <span className="socialdot" aria-hidden="true" style={{ background: color }} />{socialBusy === id ? "Connecting…" : label}
              </button>
            ))}
          </div>
          <p className="rfoot">Signing in with a provider shares only your name and email with Cyra — never your health data with them. Apple lets you hide your email.</p>
        </>
      )}

      {rs.key === "basics" && (
        <>
          <RLab k="age">Age</RLab>
          <RChips k="age" opts={["Under 25", "25–34", "35–44", "45–54", "55+"]} />
          <RLab k="zip">ZIP or postal code</RLab>
          <input className={`inp ${bad("zip") ? "inpErr" : ""}`} placeholder="e.g. 90210" aria-label="e.g. 90210" value={reg.zip} onChange={(e) => rup("zip", e.target.value)} />
          <p className="rfoot">ZIP, not street address — enough for local care and regional averages, nothing more. A store only ever collects your full address at checkout.</p>
        </>
      )}

      {rs.key === "stage" && (
        <div className={`regcards ${bad("stage") ? "err" : ""}`}>
          {[["My Cycle", "periods & PMS"], ["Trying to conceive", "fertility"], ["Pregnant", "week by week"], ["Perimenopause", "changing cycles"], ["Menopause & beyond", "post-transition"]].map(([lbl, d]) => (
            <button key={lbl} aria-pressed={reg.stage === lbl} className={`stagecard ${reg.stage === lbl ? "on" : ""}`} onClick={() => rup("stage", lbl)}><b>{lbl}</b><span>{d}</span></button>
          ))}
        </div>
      )}

      {rs.key === "cycle" && (
        <>
          <RLab k="cycleLen">Typical cycle length</RLab>
          <RChips k="cycleLen" opts={["Under 24 days", "24–31 days", "Over 31 days", "Irregular", "Not sure"]} />
          <RLab k="cycleReg">How regular?</RLab>
          <RChips k="cycleReg" opts={["Clockwork", "Roughly", "All over"]} />
          <p className="lab">First day of your last period (optional)</p>
          <input className="inp" type="date" aria-label="First day of your last period" value={reg.lastPeriod} onChange={(e) => rup("lastPeriod", e.target.value)} />
        </>
      )}

      {rs.key === "repro" && (
        <>
          <RLab k="preg">Ever been pregnant?</RLab>
          <RChips k="preg" opts={["Never", "Currently", "In the past"]} />
          <p className="lab">Births</p>
          <RChips k="births" opts={["0", "1", "2", "3+"]} />
          <p className="lab">Current birth control</p>
          <RChips k="contra" opts={["None", "Pill", "IUD", "Implant/shot", "Barrier", "Prefer not to say"]} />
          <p className="rfoot">Every field skippable. Context to serve you — kept on your device, never sold.</p>
        </>
      )}

      {rs.key === "health" && (
        <>
          <p className="lab">Relevant conditions (tap any)</p>
          <RMulti k="conditions" opts={["PCOS", "Endometriosis", "Thyroid", "Diabetes", "Anemia", "Migraines", "High blood pressure", "Anxiety/depression", "None"]} />
          <p className="lab">Family history worth noting</p>
          <RMulti k="familyHx" opts={["Early menopause", "Osteoporosis", "Breast/ovarian cancer", "Heart disease", "None / unsure"]} />
          <RLab k="meds">On regular medication or hormones?</RLab>
          <RChips k="meds" opts={["No", "Yes", "Prefer not to say"]} />
          <p className="rfoot">General categories only. We never ask for medical records, insurance or policy numbers, government ID, or an SSN.</p>
        </>
      )}

      {rs.key === "goals" && (
        <>
          <RLab k="goals">What would make this worth it? (pick a few)</RLab>
          <RMulti k="goals" opts={["Understand my symptoms", "Predict my cycle", "Get pregnant", "Avoid pregnancy", "Prep for my doctor", "Sleep better", "Feel less alone", "Track the transition"]} />
          <RLab k="sleep">Sleep, most nights</RLab>
          <RChips k="sleep" opts={["Solid", "Hit or miss", "Poor"]} />
          <RLab k="activity">Activity level</RLab>
          <RChips k="activity" opts={["Low", "Moderate", "High"]} />
        </>
      )}

      {rs.key === "consent" && (
        <>
          <div className="consentcard">
            <b>Always true — no toggle, no fine print:</b>
            <ul className="rlist" style={{ marginTop: 6 }}>
              <li>Your health data is stored on your device — insights run locally, not on our servers.</li>
              <li>Never sold. Partners receive an anonymous token, never your identity.</li>
              <li>Doctor sharing happens only when you press send.</li>
              <li>Delete everything, anytime, in one tap.</li>
              <li>Optional backup is encrypted so even we cannot read it — the key stays on your device.</li>
            </ul>
          </div>
          <p className="lab">How often should Cyra check in?</p>
          <div className="regcards" style={{ marginBottom: 14 }}>
            {CADENCE.map((cd) => (
              <button key={cd.id} aria-pressed={cadence === cd.id} className={`stagecard ${cadence === cd.id ? "on" : ""}`} style={{ padding: "10px 14px" }} onClick={() => setCadence(cd.id)}><b style={{ fontSize: 14 }}>{cd.label}</b><span>{cd.desc}</span></button>
            ))}
          </div>
          <p className="rfoot" style={{ marginBottom: 14 }}>You can change this anytime. Cyra sends one reminder at most, never a second nudge, and never guilts you for a missed day — gaps are fine, your patterns still work.</p>
          {[["emailOptin", "Email me insights & reminders", "Unsubscribe anytime."],
            ["notifOptin", "Notify me on this device", "Free push reminders. No phone number, no texts, ever."],
            ["research", "Contribute to research", "Named studies improving women's care — aggregate, de-identified, opt-in per study, withdraw anytime."],
            ["terms", "I agree to the Terms & Privacy Policy", "Plain language, no dark patterns."]].map(([k, t2, d]) => (
            <button key={k} role="checkbox" aria-checked={!!(reg[k])} className={`consentopt ${reg[k] ? "on" : ""} ${k === "terms" && bad("terms") ? "inpErr" : ""}`} style={{ marginBottom: 9 }} onClick={() => rup(k, !reg[k])}>
              <span className="ckbox">{reg[k] ? "✓" : ""}</span>
              <span><b>{t2}</b><br />{d}</span>
            </button>
          ))}
        </>
      )}

      {regTouched[rs.key] && miss.length > 0 && (
        <p className="errhint">A few fields still need a tap — they're marked in red above.</p>
      )}

      <div className="nav">
        {regStep > 0 && <button className="back" onClick={() => setRegStep(regStep - 1)}>Back</button>}
        <button className="cta" onClick={advance}>{regStep < RSTEPS.length - 1 ? "Continue" : (miss.length ? "Complete required fields" : "Enter Cyra")}</button>
      </div>
    </main>
  );
}
