import { CADENCE } from "../lib/constants.js";
import { APPEARANCES } from "../lib/appearance.js";
import { hasServer } from "../lib/api.js";
import { STAGE_GROUP, flagWords } from "../lib/pulse.js";
import { FEATURES, remindersInBuild } from "../lib/features.js";
import DataControls from "./DataControls.jsx";
import PrivacyFlows from "./PrivacyFlows.jsx";
import LockSettings from "./LockSettings.jsx";
import Details, { WebReminderFacts, CountsFacts } from "./Details.jsx";
import Icon from "./Icon.jsx";
import AboutYou from "./AboutYou.jsx";

/* The bodies of Settings (calm R7: split out of SettingsSheet.jsx, unchanged), so the same controls, ids and sentences
   serve both places that show them: the Settings sheet (header sliders button, every tab but You) and the You page's
   cards (YouScreen.jsx), which never show at the same time (App.jsx closes the sheet on You). Each body renders the
   exact markup the sheet always had; the only differences are two props:
   - hideLab: the section label keeps its id (its option row points at it with aria-labelledby) but is visually hidden,
     because on You the card's own title says it;
   - lead: whether the body is the first thing in its group (the sheet's label margins depend on it).
   Nothing here reads storage or the network; every action is a prop from App.jsx. */

/** A group label: an id its option row points at (aria-labelledby) and a small accent glyph (G3 .labico). */
export const Lab = ({ id, icon, children, style, hide = false }) => (
  <p className={hide ? "section-lab sr-only" : "section-lab"} id={id} style={hide ? undefined : style}><Icon name={icon} className="labico" />{children}</p>
);

/** What the reminders row says and whether it can work in this build (pure; shared by the bodies below). */
export function reminderModel({ reminders, reminderSupport, cadence }) {
  const st = reminders?.status;
  const remindersText = st === "blocked"
    ? (reminderSupport === "native" ? "Notifications for Heard Health are off in your phone's Settings — turn them on there, then tap Turn on" : reminders.denied ? "Blocked in this browser — allow notifications for Heard Health in site settings, then tap Turn on" : "Waiting for permission — tap Turn on and choose Allow")
    : st === "error" && reminders?.cancelFailed ? "Couldn't cancel the reminders already scheduled on this phone — tap Turn off to try again"
    : !reminders?.enabled ? (reminders?.pending?.length ? "Off — this browser won't show reminders. Heard Health's server hasn't confirmed it forgot this browser's reminder address yet; Heard Health keeps asking while it's open and each time you open it" : "Off")
    : st === "on" ? "On"
    : st === "unsupported" ? "This browser can't show reminders"
    : st === "unavailable" ? "Reminders aren't set up on this server yet"
    : st === "error" ? "Couldn't set up reminders just now — tap Turn on to try again"
    : "Off — pick a rhythm and a time";
  // The switch reads "on" only while reminders really are set up (or simply have nothing to schedule).
  const remindersOn = !!reminders?.enabled && (st === "on" || st === "off");
  const cancelFailed = st === "error" && !!reminders?.cancelFailed; // phone: Turn off again
  // Whether this build has check-in reminders here at all (phones always; the web only with webReminders).
  const remindersHere = remindersInBuild(reminderSupport === "native");
  const webReminders = reminderSupport === "web" && hasServer() && FEATURES.webReminders;
  // Reminders cannot work in this build at all (this browser can't show them, or a web build with no server):
  // no switch, a plain "Unavailable". A server that is merely unreachable keeps the switch (it may come back).
  const unavailable = st === "unsupported" || (reminderSupport === "web" && !hasServer());
  const remindersSub = reminderSupport === "native" ? "Scheduled on this phone — no server involved."
    : webReminders ? "A plain reminder, nothing about your health in it. Heard Health's server keeps this browser's push address and your reminder schedule; turning reminders off erases them. A server update or restart can pause them until you next open Heard Health. No phone number, no texts, ever."
    : reminderSupport === "web" ? "Reminders aren't available in this version of Heard Health."
    : "This browser can't show reminders.";
  // The nudge time only matters while something will use it: rhythm "When I feel like it" schedules nothing,
  // and while reminders are off (but could be turned on) the time waits. The buttons stay enabled.
  const nudgeMuted = cadence === "me" || (!remindersOn && reminderSupport !== "none");
  const nudgeHint = cadence === "me" ? "You chose no reminders, so there's nothing to time."
    : unavailable ? "Reminders aren't available here, so this time isn't used."
    : "Reminders are off — this time is used once you turn them on.";
  return { remindersText, remindersOn, cancelFailed, remindersHere, webReminders, unavailable, remindersSub, nudgeMuted, nudgeHint };
}

/** Check-in rhythm, best time to nudge (only where this build has reminders) and check-in style. */
export function CheckinsBody({ cadence, setCadence, quietHours, setQuietHours, quickMode, setQuickMode, ping, reminders, reminderSupport }) {
  const { remindersHere, nudgeMuted, nudgeHint } = reminderModel({ reminders, reminderSupport, cadence });
  return (
    <>
      {remindersHere && (<>
        <Lab id="set-rhythm" icon="clock" style={{ margin: "0 0 6px" }}>Check-in rhythm</Lab>
        <div className="regcards cadgrid" role="group" aria-labelledby="set-rhythm">
          {CADENCE.map((cd) => (
            <button key={cd.id} aria-pressed={cadence === cd.id} className={`stagecard ${cadence === cd.id ? "on" : ""}`} onClick={() => { setCadence(cd.id); ping(`Rhythm set to ${cd.label.toLowerCase()}`); }}><b>{cd.label}</b><span>{cd.desc}</span></button>
          ))}
        </div>
        <Lab id="set-nudge" icon="bell" style={{ margin: "12px 0 6px" }}>Best time to nudge</Lab>
        <div className={`nudgewrap ${nudgeMuted ? "muted" : ""}`}>
          <div className="mcrow seg" role="group" aria-labelledby="set-nudge">
            {[["morning", "Morning"], ["midday", "Midday"], ["evening", "Evening"], ["never", "Never remind me"]].map(([v, l]) => (
              <button key={v} aria-pressed={quietHours === v} className={`mc ${quietHours === v ? "on" : ""}`} onClick={() => setQuietHours(v)}>{l}</button>
            ))}
          </div>
          {nudgeMuted && <p className="hint nudgehint">{nudgeHint}</p>}
        </div>
      </>)}
      <Lab id="set-style" icon="lightning" style={{ margin: remindersHere ? "12px 0 6px" : "0 0 6px" }}>Check-in style</Lab>
      <div className="mcrow seg" role="group" aria-label="Check-in style" aria-labelledby="set-style">
        <button className={`mc ${quickMode ? "on" : ""}`} aria-pressed={quickMode} onClick={() => setQuickMode(true)}>Quick · 3 taps</button>
        <button className={`mc ${!quickMode ? "on" : ""}`} aria-pressed={!quickMode} onClick={() => setQuickMode(false)}>Full detail</button>
      </div>
    </>
  );
}

/** The Reminders row (phone or browser), its "Exactly what's kept" and the one-reminder line. Only where this build has reminders. */
export function RemindersBody({ reminders, reminderSupport, cadence, onReminders, stage, lead = false, hideLab = false }) {
  const m = reminderModel({ reminders, reminderSupport, cadence });
  if (!m.remindersHere) return null;
  return (
    <>
      <Lab id="set-reminders" icon="bell" hide={hideLab} style={{ margin: stage && !lead ? "12px 0 6px" : "0 0 6px" }}>Reminders</Lab>
      <div className="medrow" role="group" aria-labelledby="set-reminders" style={{ borderTop: "none", padding: "4px 0 8px" }}>
        <div className="medinfo"><b>{m.remindersText}</b><span>{m.remindersSub}</span></div>
        {m.cancelFailed
          ? <button className="takebtn" onClick={() => onReminders(false)}>Turn off</button>
          : m.unavailable ? <span className="statechip">Unavailable</span>
          : <button className={`takebtn ${m.remindersOn ? "on" : ""}`} aria-pressed={m.remindersOn} onClick={() => onReminders(!m.remindersOn)}>{m.remindersOn ? "✓ On" : "Turn on"}</button>}
      </div>
      {m.webReminders && <Details label="Exactly what's kept"><WebReminderFacts /></Details>}
      <p className="rfoot">One reminder at most. Missed days are never scolded — your patterns work fine with gaps.</p>
    </>
  );
}

/** The "Share anonymous weekly counts" group (only where the build has counts). */
export function CountsBody({ stage, research, setResearch, lead = false, hideLab = false, afterOthers = false }) {
  if (!FEATURES.counts) return null;
  return (
    <>
      <Lab id="set-counts" icon="people" hide={hideLab} style={{ margin: afterOthers && !lead ? "12px 0 6px" : "0 0 6px" }}>Anonymous weekly counts</Lab>
      {hasServer() ? (
        <>
          <div className="medrow" role="group" aria-labelledby="set-counts" style={{ borderTop: "none", padding: "4px 0 8px" }}>
            <div className="medinfo"><b id="share-counts-title">Share anonymous weekly counts</b><span>Your life stage group{STAGE_GROUP[stage] ? ` (${STAGE_GROUP[stage]})` : ""} and whether you logged {flagWords(stage) || "a few symptoms"}, each at most once a week, with no dates or values. Turning this off stops sharing right away. Counts already added can't be taken back.</span></div>
            <button className={`takebtn ${research ? "on" : ""}`} aria-pressed={!!research} aria-describedby="share-counts-title" onClick={() => setResearch(!research)}>{research ? "✓ On" : "Turn on"}</button>
          </div>
          <Details label="Exactly what's sent"><CountsFacts stage={stage} /></Details>
        </>
      ) : (
        <p className="hint" style={{ margin: "0 0 8px" }}>Weekly counts aren't available in this version of Heard Health, so nothing is shared.</p>
      )}
    </>
  );
}

/** Appearance: System / Light / Dark. */
export function AppearanceBody({ appearance, onAppearance, hideLab = false }) {
  return (
    <>
      <Lab id="set-appearance" icon="moon" hide={hideLab} style={{ margin: "0 0 6px" }}>Appearance</Lab>
      <div className="mcrow seg" role="group" aria-labelledby="set-appearance">
        {APPEARANCES.map(([v, label]) => (
          <button key={v} className={`mc ${appearance === v ? "on" : ""}`} aria-pressed={appearance === v} onClick={() => onAppearance(v)}>{label}</button>
        ))}
      </div>
      <p className="rfoot">System follows this device's light or dark setting. Your choice stays on this device and isn't part of a backup.</p>
    </>
  );
}

/** About you: the optional answers, one collapsed Details per topic. */
export function AboutBody({ regAnswers, onAnswer, stage, stageName, todayIso, hideLab = false, compact = false }) {
  const answers = <AboutYou answers={regAnswers} onAnswer={onAnswer || (() => {})} stage={stage} stageName={stageName} todayIso={todayIso} />;
  return (
    <>
      <Lab id="set-about" icon="user" hide={hideLab} style={{ margin: "0 0 6px" }}>About you</Lab>
      <div role="group" aria-labelledby="set-about">
        {compact
          ? <p className="hint" style={{ margin: "0 0 8px" }}>All optional, and you can change them anytime.</p>
          : <p className="hint" style={{ margin: "0 0 8px" }}>All optional, and you can change them anytime. They stay on this device and leave it only inside an encrypted backup you choose to save — and your age band and ZIP never go into one.</p>}
        {compact ? <Details label="Your answers"><p className="hint" style={{ margin: "0 0 8px" }}>They stay on this device and leave it only inside an encrypted backup you choose to save — and your age band and ZIP never go into one.</p>{answers}</Details> : answers}
      </div>
    </>
  );
}

/** Privacy & your data: where the record lives, "What can leave this device", backup / restore / delete, then the app lock. */
/** Calm R10: the You page's three short facts besides "N days logged · last backup": what is on right now among the
    flows this build can use (the same rows "What can leave this device" lists) and whether the app lock is on. */
export function privacyFacts(flows = [], lock = null) {
  const on = flows.filter((r) => r.state === "on").map((r) => r.name);
  const out = [{ id: "flows", icon: "share", text: on.length ? `Turned on now: ${on.join(", ")}. Each one says exactly what it sends.` : "Every feature that can send something is off right now." }];
  if (lock) out.push({ id: "lock", icon: "lock", text: lock.cfg && !lock.cfg.unreadable ? "App lock is on." : "App lock is off. You can set a PIN below." });
  return out;
}

export function PrivacyBody({ storageDriver, onExport, onImport, onWipe, ping, keepsWeekNote, daysLogged, lastBackupAt, todayIso, offlineCopy, legacyWear, onHandoff, flows, flowCtx, lock, potsOn, hideLab = false, compact = false }) {
  return (
    <>
      <DataControls driver={storageDriver} onExport={onExport} onImport={onImport} onWipe={onWipe} ping={ping} keepsWeekNote={keepsWeekNote} daysLogged={daysLogged} lastBackupAt={lastBackupAt} todayIso={todayIso} offlineCopy={offlineCopy} legacyWear={legacyWear} onHandoff={onHandoff} hideLab={hideLab} compact={compact} facts={compact ? privacyFacts(flows, lock) : []} howLead={compact ? "Your log is yours. Below is everything Heard Health can send, and the tools to back it up, lock it and delete it." : null}>
        <PrivacyFlows rows={flows} {...flowCtx} />
      </DataControls>
      {lock && <LockSettings lock={lock} potsOn={potsOn} compact={compact} />}
    </>
  );
}
