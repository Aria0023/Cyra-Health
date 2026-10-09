import { CADENCE } from "../lib/constants.js";
import { hasServer } from "../lib/api.js";
import { support as reminderSupport } from "../lib/notifications.js";
import { isNative } from "../lib/native.js";
import { TERMS_URL, PRIVACY_URL, POLICY_LINKS_READY, openExternal } from "../lib/links.js";
import { allFlagGroups } from "../lib/pulse.js";
import Details, { WebReminderFacts } from "../components/Details.jsx";

/* Phase 2: registration — 8 steps with validation. Red state appears only after
   the user taps Continue with required fields missing; optional fields never turn red.
   There is no Cyra account: every answer is stored only on this device (App.jsx
   finishReg). Registration data reaches Cyra's server only through opt-ins: the check-in
   cadence (sent for web push along with the Settings reminder time and the browser's time
   zone); the coarse life-stage group in anonymous weekly counts; and, with
   Apple/Google/Facebook prefill, the name and email the provider sends, which the server
   holds in memory under a one-time code until the device collects them, or 5 minutes at
   most. Answers also leave inside an encrypted backup the user saves (minus the ZIP and
   the age band). Required: an age band, a stage, cycle length and regularity, at least one
   goal, and the consent box. Everything else can be skipped. */
const RSTEPS = [
  { key: "account", title: "Set up Cyra on this device", sub: "There's no Cyra account. Your name, email and answers are saved on this device. Lose the device or clear the browser and you lose them, unless you saved an encrypted backup, which keeps most of them." },
  { key: "basics", title: "A bit about you", sub: "Your age band, plus an optional ZIP. Both stay on this device." },
  { key: "stage", title: "Where are you right now?", sub: "This shapes your entire experience. You can change it anytime." },
  { key: "cycle", title: "Your cycle history", sub: "So predictions can start from day one. These answers stay on this device, and go into an encrypted backup only if you save one." },
  { key: "repro", title: "Reproductive history", sub: "Optional, and kept on this device (and in an encrypted backup, if you save one). Skip anything you like." },
  { key: "health", title: "Health background", sub: "Diagnoses and family history that can affect hormonal health. All optional. They stay on this device and leave it only inside an encrypted backup you choose to save. We never import medical records." },
  { key: "goals", title: "What brings you here?", sub: "Pick as many as you like. These stay on this device and leave it only inside an encrypted backup you choose to save." },
  { key: "consent", title: "Your data and your choices", sub: "What Cyra does with your data today — and choices you can change later in Settings." },
];

// A ZIP or postal code: letters, digits, spaces and hyphens, 10 characters at most — no room for a street address.
const ZIP_CHARS = /[^A-Za-z0-9 -]/g;

export default function RegisterScreen({ reg, setReg, regStep, setRegStep, regTouched, setRegTouched, cadence, setCadence, socialBusy, startSocial, finishReg }) {
  const rs = RSTEPS[regStep];
  const REQ = {
    account: [],
    basics: [["age", reg.age]],
    stage: [["stage", reg.stage]],
    cycle: [["cycleLen", reg.cycleLen], ["cycleReg", reg.cycleReg]],
    repro: [],
    health: [],
    goals: [["goals", reg.goals.length]],
    consent: [["terms", reg.terms]],
  };
  const miss = (REQ[rs.key] || []).filter(([, ok]) => !ok).map(([k]) => k);
  const bad = (k) => regTouched[rs.key] && miss.includes(k);
  const rup = (k, v) => setReg((x) => ({ ...x, [k]: v }));
  const rtog = (k, v) => setReg((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));
  // Anonymous Mode on: the name and email go, and their fields and the providers are hidden.
  const toggleAnon = () => setReg((x) => (x.anon ? { ...x, anon: false } : { ...x, anon: true, name: "", email: "" }));
  // Error ink #A13D28 (.labErr, .need) is 5.2:1 on the registration paper (#EDE4DC).
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

  /* Consent choices: each one is shown only where it can do what it says. Reminders: on the
     phone, or in a browser that can show them when this build has a server. Weekly counts:
     only when this build has a server to count them. Nothing is pre-ticked. */
  const isNativeBuild = isNative();
  const remindKind = reminderSupport(); // "native" | "web" | "none"
  const webReminders = !isNativeBuild && remindKind === "web" && hasServer();
  const consentRows = [
    (isNativeBuild || webReminders) && ["notifOptin", "Remind me on this device", isNativeBuild ? "Scheduled on this phone — no server involved. No phone number, no texts, ever." : "A plain reminder, nothing about your health in it. Cyra's server keeps this browser's push address and your reminder schedule; turning reminders off erases them. No phone number, no texts, ever."],
    hasServer() && ["research", "Share anonymous weekly counts", "Cyra's server gets your life stage group and which of a few symptoms you logged, each at most once a week. No dates, values or name. Counts already added can't be taken back."],
    // Until the published Terms and Privacy Policy can be linked, the box asks only for
    // agreement to what this screen itself says.
    ["terms", POLICY_LINKS_READY ? "I agree to the Terms & Privacy Policy" : "I agree to how Cyra handles my data, as described above", POLICY_LINKS_READY ? "Nothing here is pre-ticked, and every optional choice can be changed later in Settings." : "Plain language, no dark patterns."],
  ].filter(Boolean);
  const opensIn = isNativeBuild ? "opens in your browser" : "opens in a new tab";
  const PolicyLink = ({ url, children }) => (
    <a className="linkbtn" href={url} target="_blank" rel="noopener noreferrer" aria-label={`${children} (${opensIn})`}
      style={{ display: "inline-flex", alignItems: "center", padding: "0 4px" }}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openExternal(url); }}>{children}</a>
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
        <Details label="What Cyra's server sees">
          <ul>
            <li>An encrypted backup keeps everything except your ZIP and age band.</li>
            <li>Anonymous Mode skips your name and email entirely.</li>
            <li>Cyra's servers keep no account and no profile of you in either mode: no age, health history or check-ins.</li>
            <li>A few optional choices send a little to Cyra's server, and each one says exactly what before you turn it on.</li>
            <li>Two of them keep a little there while they're on. Browser reminders: this browser's push address and its encryption keys, your reminder days, time and time zone, and the last day a reminder went out. Fitbit/Garmin/Whoop sync: new readings, held up to 7 days until this device collects them.</li>
            <li>Turning one off erases it from Cyra's server. If the server can't be reached then, Cyra keeps asking until it confirms, and Delete everything tells you if anything stays connected.</li>
            <li>If you choose to share weekly counts, they're added to anonymous weekly totals that stay on the server.</li>
            <li>Sign-in prefill and Oura connect leave your name and email, or your Oura access, there for 5 minutes at most.</li>
            <li>Like any app that goes online, our server and its host see your device's internet address and app or browser type when the app connects. Cyra's own code doesn't keep the address.</li>
          </ul>
        </Details>
      )}

      {rs.key === "account" && (
        <>
          {!reg.anon && (
            <>
              <input className="inp" placeholder="First name (optional)" aria-label="First name (optional)" autoComplete="off" value={reg.name} onChange={(e) => rup("name", e.target.value)} />
              <input className="inp" placeholder="Email (optional, kept only on this device and in backups you save)" aria-label="Email (optional, kept only on this device and in backups you save)" type="email" autoComplete="off" value={reg.email} onChange={(e) => rup("email", e.target.value)} />
            </>
          )}
          <button className="ghostbtn" aria-pressed={!!reg.anon} onClick={toggleAnon}>{reg.anon ? "✓ Anonymous Mode on" : "Continue in Anonymous Mode instead"}</button>
          {!reg.anon && (
            <>
              <div className="orline"><span>or fill in your name and email from</span></div>
              <div className="social">
                {[["apple", "Apple", "#000"], ["google", "Google", "#4285F4"], ["facebook", "Facebook", "#1877F2"]].map(([id, label, color]) => (
                  <button key={id} className="socialbtn" disabled={!!socialBusy} onClick={() => startSocial(id, label)}>
                    <span className="socialdot" aria-hidden="true" style={{ background: color }} />{socialBusy === id ? "Connecting…" : label}
                  </button>
                ))}
              </div>
              <p className="rfoot">Apple, Google or Facebook will know you're setting up Cyra. None of your health data goes to them, and Cyra's server erases what they send within 5 minutes.</p>
              <Details label="Exactly what's shared">
                <p>They send Cyra's server sign-in tokens, your name, email and an account ID (Google also sends basic profile details, such as a profile-photo link).</p>
                <p>Only your name, plus your email from Apple or Google when it's verified, comes to this device. Facebook fills in your name only.</p>
                <p>With Apple, the server then sends Apple's token straight back to Apple, asking it to end Cyra's access to your Apple ID. The server discards the tokens at once, erases the rest within 5 minutes and keeps no account record. Apple lets you hide your email.</p>
              </Details>
            </>
          )}
        </>
      )}

      {rs.key === "basics" && (
        <>
          <RLab k="age">Age</RLab>
          <RChips k="age" opts={["Under 25", "25–34", "35–44", "45–54", "55+"]} />
          <p className="lab">ZIP or postal code (optional)</p>
          <input className="inp" placeholder="e.g. 90210" aria-label="ZIP or postal code (optional)" maxLength={10} pattern="[A-Za-z0-9 \-]{0,10}" autoComplete="off" value={reg.zip} onChange={(e) => rup("zip", e.target.value.replace(ZIP_CHARS, "").slice(0, 10))} />
          <p className="rfoot">ZIP is optional and stays on this device. Cyra doesn't use it yet and never sends it anywhere. Cyra never asks for your street address.</p>
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
          <p className="lab">Ever been pregnant?</p>
          <RChips k="preg" opts={["Never", "Currently", "In the past", "Prefer not to say"]} />
          <p className="lab">Births</p>
          <RChips k="births" opts={["0", "1", "2", "3+"]} />
          <p className="lab">Current birth control</p>
          <RChips k="contra" opts={["None", "Pill", "IUD", "Implant/shot", "Barrier", "Prefer not to say"]} />
          <p className="rfoot">Every question can be skipped. Your answers stay on this device (and in an encrypted backup, if you save one) and are never sold.</p>
        </>
      )}

      {rs.key === "health" && (
        <>
          <p className="lab">Relevant conditions (tap any)</p>
          <RMulti k="conditions" opts={["PCOS", "Endometriosis", "Thyroid", "Diabetes", "Anemia", "Migraines", "High blood pressure", "Anxiety/depression", "None"]} />
          <p className="lab">Family history worth noting</p>
          <RMulti k="familyHx" opts={["Early menopause", "Osteoporosis", "Breast/ovarian cancer", "Heart disease", "None / unsure"]} />
          <p className="lab">On regular medication or hormones?</p>
          <RChips k="meds" opts={["No", "Yes", "Prefer not to say"]} />
          <p className="rfoot">General categories only. We never ask for medical records, insurance or policy numbers, government ID, or an SSN.</p>
        </>
      )}

      {rs.key === "goals" && (
        <>
          <RLab k="goals">What would make this worth it? (pick a few)</RLab>
          <RMulti k="goals" opts={["Understand my symptoms", "Predict my cycle", "Get pregnant", "Avoid pregnancy", "Prep for my doctor", "Sleep better", "Feel less alone", "Track the transition"]} />
          <p className="lab">Sleep, most nights</p>
          <RChips k="sleep" opts={["Solid", "Hit or miss", "Poor"]} />
          <p className="lab">Activity level</p>
          <RChips k="activity" opts={["Low", "Moderate", "High"]} />
        </>
      )}

      {rs.key === "consent" && (
        <>
          <div className="consentcard">
            <b>What Cyra does with your data:</b>
            <ul className="rlist" style={{ marginTop: 6 }}>
              <li>Your health log is stored on this device, and your patterns are worked out here.</li>
              <li>Nothing about your health leaves this device unless you turn on a feature that sends it, or take it out yourself.</li>
              <li>Never sold. Care partners get nothing from Cyra about you.</li>
              <li>Doctor sharing happens only when you press send.</li>
              <li>Delete everything from Settings, anytime. It also turns off reminders and disconnects Oura and Fitbit/Garmin/Whoop.</li>
              <li>A backup is a file you keep, locked with a passphrase only you know. Cyra never receives the file or the passphrase, so we can't read it or recover a lost passphrase.</li>
            </ul>
            <Details label="The details">
              <ul>
                <li>Features that send something: weekly counts, Cyra's AI and wearable syncs. Each one tells you what it sends before you turn it on.</li>
                <li>Taking it out yourself means a doctor summary you open in email or copy, or a backup file you save, which stays locked with your passphrase.</li>
                <li>If Delete everything can't confirm that reminders are off and Oura and Fitbit/Garmin/Whoop are disconnected, Cyra tells you what did and didn't happen, and keeps your record on this device until you choose.</li>
                <li>Deleting can't pull back what already left: anonymous counts you shared stay counted, questions already sent to Cyra's AI stay with Anthropic for a limited time under its own terms, and readings Terra already collected stay under Terra's policy.</li>
              </ul>
            </Details>
          </div>
          <p className="lab">How often should Cyra check in?</p>
          <div className="regcards" style={{ marginBottom: 14 }}>
            {CADENCE.map((cd) => (
              <button key={cd.id} aria-pressed={cadence === cd.id} className={`stagecard ${cadence === cd.id ? "on" : ""}`} style={{ padding: "10px 14px" }} onClick={() => setCadence(cd.id)}><b style={{ fontSize: 14 }}>{cd.label}</b><span>{cd.desc}</span></button>
            ))}
          </div>
          <p className="rfoot" style={{ marginBottom: 14 }}>You can change this anytime in Settings. Cyra sends one reminder at most, never a second nudge, and never guilts you for a missed day — gaps are fine, your patterns still work.</p>
          {consentRows.map(([k, t2, d]) => [
            <button key={k} role="checkbox" aria-checked={!!(reg[k])} className={`consentopt ${reg[k] ? "on" : ""} ${k === "terms" && bad("terms") ? "inpErr" : ""}`} style={{ marginBottom: 9 }} onClick={() => rup(k, !reg[k])}>
              <span className="ckbox">{reg[k] ? "✓" : ""}</span>
              <span><b>{t2}</b><br />{d}</span>
            </button>,
            k === "notifOptin" && webReminders && <Details key={`${k}-more`} label="Exactly what's kept"><WebReminderFacts /></Details>,
            k === "research" && (
              <Details key={`${k}-more`} label="Exactly what's sent">
                <ul>
                  <li>The symptoms that count, by life stage: {allFlagGroups()}. A quick check-in adds only sleep and flow flags.</li>
                  <li>Sent at most once a day, and never on the day you log them.</li>
                  <li>"Once a week" is counted on this device: deleting the app or clearing this browser's data resets it.</li>
                  <li>No dates, values, name or account. Like any request, it carries your device's internet address and app or browser type.</li>
                  <li>They're added to the weekly "You're not alone" counts. Turn this off anytime in Settings.</li>
                </ul>
              </Details>
            ),
          ])}
          {/* The documents sit next to the box, never inside it: opening one doesn't tick it. */}
          {POLICY_LINKS_READY ? (
            <p className="rfoot" style={{ margin: "-4px 0 9px", display: "flex", flexWrap: "wrap", alignItems: "center" }}>
              <PolicyLink url={TERMS_URL}>Read the Terms</PolicyLink>
              <span aria-hidden="true">·</span>
              <PolicyLink url={PRIVACY_URL}>Read the Privacy Policy</PolicyLink>
            </p>
          ) : TERMS_URL || PRIVACY_URL ? (
            <p className="rfoot" style={{ margin: "-4px 0 9px", display: "flex", flexWrap: "wrap", alignItems: "center" }}>
              {TERMS_URL ? <PolicyLink url={TERMS_URL}>Read the Terms</PolicyLink> : <PolicyLink url={PRIVACY_URL}>Read the Privacy Policy</PolicyLink>}
              <span>Cyra's {TERMS_URL ? "Privacy Policy" : "Terms"} isn't published yet; a later version of Cyra will link it here. Until then, the box above covers only what this screen says.</span>
            </p>
          ) : (
            <p className="rfoot" style={{ margin: "0 0 9px" }}>Cyra's Terms and Privacy Policy aren't published yet; a later version of Cyra will link them here. Until then, the box above covers only what this screen says.</p>
          )}
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
