import { useEffect, useId, useRef, useState } from "react";
import { CADENCE, stagePalettes } from "../lib/constants.js";
import { hasServer } from "../lib/api.js";
import { support as reminderSupport } from "../lib/notifications.js";
import { isNative } from "../lib/native.js";
import { TERMS_URL, PRIVACY_URL, POLICY_LINKS_READY, openExternal } from "../lib/links.js";
import { allFlagGroups } from "../lib/pulse.js";
import { reduceMotion } from "../lib/motion.js";
import { paletteFor } from "../lib/appearance.js";
import { localDay } from "../lib/engine.js";
import { REG_STAGE, STAGE_LABELS, STAGE_CARDS, STEP_COPY, CYCLE_LENS, regSteps, missingFor, dueDateBounds } from "../lib/onboarding.js";
import { FEATURES, remindersInBuild } from "../lib/features.js";
import { serverSees, consentDeleteFact, consentDetails } from "../lib/disclosures.js";
import Details, { WebReminderFacts } from "../components/Details.jsx";
import { ChipRow } from "../components/AnswerChips.jsx";
import Icon from "../components/Icon.jsx";

/* Phase 2: registration (L11, spec §4.2) — phase-first, 4 steps (3 for Menopause & beyond), routed by
   lib/onboarding.js regSteps(stage): Stage → Device → Cycle (My Cycle, Trying to conceive, Perimenopause) |
   Pregnancy (Pregnant) | nothing (Menopause & beyond) → Consent. Required: a stage, a typical cycle length (cycle
   stages only) and the consent box. Everything else can be skipped; the remaining answers (age band, ZIP,
   regularity, reproductive history, health background, goals, sleep, activity) live in Settings → About you
   (components/AboutYou.jsx) and are never asked here. Red state appears only after the user taps Continue with
   required fields missing; optional fields never turn red.
   There is no Cyra account: every answer is stored only on this device (App.jsx finishReg). Registration data
   reaches Cyra's server only through opt-ins: the check-in cadence (sent for web push along with the Settings
   reminder time and the browser's time zone); the coarse life-stage group in anonymous weekly counts; and, with
   Apple/Google/Facebook prefill, the name and email the provider sends, which the server holds in memory under a
   one-time code until the device collects them, or 5 minutes at most. A native sign-in returns to the step after
   Device; a web sign-in redirect returns to the stage step, because the page restarts and nothing is carried across
   it (no session or local storage is written before finishReg). Answers also leave inside an encrypted backup the
   user saves (minus the ZIP and the age band). No registration answer goes into a POTS report or spreadsheet
   (lib/potsReport.js reads POTS data and app state only; tested). The first name is added only if she ticks it.
   UI O1: the short path first (inputs, then Anonymous Mode, then the providers 3-up with Apple leftmost, both
   detail panels last); the chosen stage's palette from the moment she picks it (App.jsx regPal); each step slides
   in, scrolls to the top and hands focus to its heading; the progress strip is a progressbar; "None" answers are
   exclusive. The check-in rhythm grid sits under "Remind me on this device" and shows only while it is ticked.
   L4 (feature flags, lib/features.js): the provider row (Apple first), its note and "Exactly what's shared" exist
   only in builds with signin (off by default: production mounts no oauth module). The weekly-counts consent row
   needs counts and a server; "Remind me" on the web needs webReminders and a server; the cadence question shows
   only where this build has reminders (phones always). Every flag-dependent sentence ("What Cyra's server sees",
   the fifth consent fact, "The details") comes from lib/disclosures.js, and equals the pre-L4 text when every flag
   is on. */
// The icon beside each data fact on the consent step (decorative; the sentence is unchanged).
const FACT_ICONS = ["lock", "share", "heart", "clipboard", "trash", "file"];

export default function RegisterScreen({ reg, setReg, regStep, setRegStep, regTouched, setRegTouched, cadence, setCadence, socialBusy, startSocial, finishReg, onBackToSplash, scheme = "light" }) {
  const steps = regSteps(reg.stage);
  const key = steps[Math.min(regStep, steps.length - 1)];
  const rs = STEP_COPY[key];
  const uid = useId();
  const labId = (k) => `${uid}-${k}`;
  const [dir, setDir] = useState("fwd"); // which way the step slides in
  const headRef = useRef(null);
  // Each step opens at the top with its heading focused (preventScroll, so the smooth scroll owns the motion).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
    headRef.current?.focus({ preventScroll: true });
  }, [regStep]);
  const miss = missingFor(key, reg);
  const bad = (k) => !!regTouched[key] && miss.includes(k);
  const rup = (k, v) => setReg((x) => ({ ...x, [k]: v }));
  // Anonymous Mode on: the name and email go, and their fields and the providers are hidden.
  const toggleAnon = () => setReg((x) => (x.anon ? { ...x, anon: false } : { ...x, anon: true, name: "", email: "" }));

  /* Consent choices: each one is shown only where it can do what it says. Reminders: on the
     phone, or in a browser that can show them when this build has a server. Weekly counts:
     only when this build has a server to count them. Nothing is pre-ticked. */
  const isNativeBuild = isNative();
  const remindKind = reminderSupport(); // "native" | "web" | "none"
  const webReminders = !isNativeBuild && remindKind === "web" && hasServer() && FEATURES.webReminders;
  const consentRows = [
    (isNativeBuild || webReminders) && ["notifOptin", "Remind me on this device", isNativeBuild ? "Scheduled on this phone — no server involved. No phone number, no texts, ever." : "A plain reminder, nothing about your health in it. Cyra's server keeps this browser's push address and your reminder schedule; turning reminders off erases them. No phone number, no texts, ever."],
    hasServer() && FEATURES.counts && ["research", "Share anonymous weekly counts", "Cyra's server gets your life stage group and which of a few symptoms you logged, each at most once a week. No dates, values or name. Counts already added can't be taken back."],
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
  // The rhythm question (where this build has reminders) sits under "Remind me" and shows only while it is ticked.
  const rhythmHere = remindersInBuild(isNativeBuild);
  const b = key === "pregnancy" ? dueDateBounds(localDay()) : null;

  const go = (n, d) => { setDir(d); setRegStep(n); };
  const advance = () => {
    if (miss.length) {
      setRegTouched((t) => ({ ...t, [key]: true }));
      // The first marked field comes into view; the summary line below announces itself (role=alert).
      setTimeout(() => document.querySelector(".labErr, .inpErr, .err")?.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" }), 0);
      return;
    }
    if (regStep < steps.length - 1) go(regStep + 1, "fwd"); else finishReg();
  };
  const back = () => { if (regStep > 0) go(regStep - 1, "back"); else onBackToSplash?.(); };

  return (
    <main className="obwrap">
      <span className="mark">Cyra<span className="sub">Health</span></span>
      <div className="prog" role="progressbar" aria-label="Set-up progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={regStep + 1} style={{ marginTop: 14 }}>{steps.map((k, i) => <span key={k} className={i <= regStep ? "on" : ""} />)}</div>
      <div className="stepno">Step {regStep + 1} of {steps.length} · {rs.short}</div>
      <div className={`regstep ${dir}`} key={regStep}>
      <h1 className="disp" tabIndex={-1} ref={headRef}>{rs.title}</h1>
      <p className="hint">{rs.sub}</p>

      {key === "stage" && (
        <div className={`regcards ${bad("stage") ? "err" : ""}`}>
          {STAGE_CARDS.map(([lbl, d]) => (
            <button key={lbl} aria-pressed={reg.stage === lbl} className={`stagecard ${reg.stage === lbl ? "on" : ""}`} onClick={() => rup("stage", lbl)}>
              <b>{lbl}</b><span>{d}</span>
              <span className="swatch-dot" aria-hidden="true" style={{ background: paletteFor(stagePalettes(REG_STAGE[lbl], STAGE_LABELS[lbl])[0], scheme).primary }} />
              {reg.stage === lbl && <Icon name="check" size={18} className="stagecheck" />}
            </button>
          ))}
        </div>
      )}

      {key === "account" && (
        <>
          {!reg.anon && (
            <>
              <input className="inp" placeholder="First name (optional)" aria-label="First name (optional)" autoComplete="off" value={reg.name} onChange={(e) => rup("name", e.target.value)} />
              <input className="inp" placeholder="Email (optional)" aria-label="Email (optional, kept only on this device and in backups you save)" type="email" autoComplete="off" value={reg.email} onChange={(e) => rup("email", e.target.value)} />
              <p className="rfoot inphelp">Kept only on this device and in backups you save.</p>
            </>
          )}
          <button className="ghostbtn quiet" aria-pressed={!!reg.anon} onClick={toggleAnon}>{reg.anon ? "✓ Anonymous Mode on" : "Continue in Anonymous Mode instead"}</button>
          {!reg.anon && FEATURES.signin && (
            <>
              <div className="orline"><span>or fill in your name and email from</span></div>
              <div className="social">
                {[["apple", "Apple"], ["google", "Google"], ["facebook", "Facebook"]].map(([id, label]) => (
                  <button key={id} className="socialbtn" disabled={!!socialBusy} onClick={() => startSocial(id, label)}>
                    <Icon name={id} size={18} />{socialBusy === id ? "Connecting…" : label}
                  </button>
                ))}
              </div>
              <p className="rfoot">Apple, Google or Facebook will know you're setting up Cyra. None of your health data goes to them, and Cyra's server erases what they send within 5 minutes.</p>
            </>
          )}
          <Details label="What Cyra's server sees">
            <ul>{serverSees(FEATURES, hasServer()).map((t) => <li key={t}>{t}</li>)}</ul>
          </Details>
          {!reg.anon && FEATURES.signin && (
            <Details label="Exactly what's shared">
              <p>They send Cyra's server sign-in tokens, your name, email and an account ID (Google also sends basic profile details, such as a profile-photo link).</p>
              <p>Only your name, plus your email from Apple or Google when it's verified, comes to this device. Facebook fills in your name only.</p>
              <p>With Apple, the server then sends Apple's token straight back to Apple, asking it to end Cyra's access to your Apple ID. The server discards the tokens at once, erases the rest within 5 minutes and keeps no account record. Apple lets you hide your email.</p>
            </Details>
          )}
        </>
      )}

      {key === "cycle" && (
        <>
          <ChipRow id={labId("cycleLen")} label="Typical cycle length" options={CYCLE_LENS} value={reg.cycleLen} onPick={(v) => rup("cycleLen", v)} bad={bad("cycleLen")} />
          <p className="lab">First day of your last period (optional)</p>
          <input className="inp" type="date" aria-label="First day of your last period" value={reg.lastPeriod} onChange={(e) => rup("lastPeriod", e.target.value)} />
        </>
      )}

      {key === "pregnancy" && (
        <>
          <p className="lab" id={labId("due")}>When is your baby due? (optional)</p>
          <input className="inp" type="date" aria-labelledby={labId("due")} min={b.min} max={b.max} value={reg.dueDate} onChange={(e) => rup("dueDate", e.target.value)} />
          <p className="rfoot">Not sure yet? Leave it blank — you can add it anytime in Settings → About you.</p>
        </>
      )}

      {key === "consent" && (
        <>
          <div className="consentcard">
            <b>What Cyra does with your data:</b>
            <ul className="rlist icons" style={{ marginTop: 6 }}>
              {[
                "Your health log is stored on this device, and your patterns are worked out here.",
                "Nothing about your health leaves this device unless you turn on a feature that sends it, or take it out yourself.",
                "Never sold. Care partners get nothing from Cyra about you.",
                "Doctor sharing happens only when you send it or save a file yourself.",
                consentDeleteFact(FEATURES, isNativeBuild),
                "A backup is a file you keep, locked with a passphrase only you know. Cyra never receives the file or the passphrase, so we can't read it or recover a lost passphrase.",
              ].map((txt, i) => <li key={i}><Icon name={FACT_ICONS[i]} className="labico" />{txt}</li>)}
            </ul>
            <Details label="The details">
              <ul>{consentDetails(FEATURES, isNativeBuild).map((t) => <li key={t}>{t}</li>)}</ul>
            </Details>
          </div>
          {consentRows.map(([k, t2, d]) => [
            <button key={k} role="checkbox" aria-checked={!!(reg[k])} aria-controls={k === "notifOptin" && rhythmHere && reg.notifOptin ? labId("cadwrap") : undefined} className={`consentopt ${reg[k] ? "on" : ""} ${k === "terms" && bad("terms") ? "inpErr" : ""}`} style={{ marginBottom: 9 }} onClick={() => rup(k, !reg[k])}>
              <span className="ckbox">{reg[k] ? "✓" : ""}</span>
              <span><b>{t2}</b><br />{d}</span>
            </button>,
            k === "notifOptin" && webReminders && <Details key={`${k}-more`} label="Exactly what's kept"><WebReminderFacts /></Details>,
            k === "notifOptin" && rhythmHere && reg.notifOptin && (
              <div key={`${k}-rhythm`} className="cadwrap" id={labId("cadwrap")}>
                <p className="lab" id={labId("cadence")}>How often should Cyra check in?</p>
                <div className="regcards cadgrid" role="group" aria-labelledby={labId("cadence")} style={{ marginBottom: 14 }}>
                  {CADENCE.map((cd) => (
                    <button key={cd.id} aria-pressed={cadence === cd.id} className={`stagecard ${cadence === cd.id ? "on" : ""}`} onClick={() => setCadence(cd.id)}><b>{cd.label}</b><span>{cd.desc}</span></button>
                  ))}
                </div>
                <p className="rfoot" style={{ marginBottom: 14 }}>You can change this anytime in Settings. Cyra sends one reminder at most, never a second nudge, and never guilts you for a missed day — gaps are fine, your patterns still work.</p>
              </div>
            ),
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

      {regTouched[key] && miss.length > 0 && (
        <p className="errhint" role="alert">A few fields still need a tap — they're marked in red above.</p>
      )}
      </div>

      <div className="nav">
        <button className="back" onClick={back}>Back</button>
        <button className="cta" onClick={advance}>{regStep < steps.length - 1 ? "Continue" : (miss.length ? "Complete required fields" : "Enter Cyra")}</button>
      </div>
    </main>
  );
}
