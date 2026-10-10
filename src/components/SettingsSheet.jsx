import { useState } from "react";
import { CADENCE } from "../lib/constants.js";
import { hasServer } from "../lib/api.js";
import { STAGE_GROUP, flagWords } from "../lib/pulse.js";
import DataControls from "./DataControls.jsx";
import Details, { WebReminderFacts } from "./Details.jsx";
import { POTS_LOCKED_COPY } from "../lib/potsConstants.js";
import { isLockedPots } from "../lib/pots.js";

/* Settings → Add-ons: the POTS tools switch (lib/pots.js, spec A13). It shows only once a life
   stage is chosen and never changes it. Turning off asks first: hide the tab and keep the log,
   or hide it and erase the log (eraseLog: a new epoch, so no other open tab merges it back).
   Every sentence names only what this build does (design 1.2, copy rule). */
const POTS_ERASE = "Erase your POTS log from this device? Standing tests, drinks and salt, symptoms, triggers, episodes, medicines, movement, your goals, your plan and visit questions, the symptom and trigger names you added, your drink and salt buttons, and what you told Cyra for your report all go for good. Only display choices stay: units, paper size, Simple view, which cards show, the order of Cyra's own symptom chips, your stand-test setup, the teen threshold setting and whether notes and cycle details go in reports. Your check-ins aren't touched. Backups you saved earlier still have it.";
function PotsAddon({ pots, stageName, onOn, onOff }) {
  const [ask, setAsk] = useState(null); // null | "off" (turn-off card) | "erase" (erase confirm)
  if (isLockedPots(pots)) {
    return (
      <div className="medrow" style={{ borderTop: "none", padding: "4px 0 8px" }}>
        <div className="medinfo"><b>POTS tools</b><span>{POTS_LOCKED_COPY}</span></div>
      </div>
    );
  }
  const on = pots.on === true;
  return (
    <>
      <div className="medrow" style={{ borderTop: "none", padding: "4px 0 8px" }}>
        <div className="medinfo"><b id="pots-addon-title">POTS tools</b><span>{on ? "On. Find it in the POTS tab." : `For a racing heart, dizziness or feeling faint when you're upright, with or without a diagnosis. Adds a POTS tab. Works alongside ${stageName || "your life stage"}. It doesn't change your life stage.`}</span></div>
        <button className={`takebtn ${on ? "on" : ""}`} aria-pressed={on} aria-describedby="pots-addon-title" onClick={() => { if (on) setAsk(ask ? null : "off"); else { setAsk(null); onOn(); } }}>{on ? "✓ On" : "Turn on"}</button>
      </div>
      {on && ask === "off" && (
        <div className="plaincard" style={{ marginBottom: 10 }}>
          <p className="plain"><b>Turn off POTS tools?</b></p>
          <button className="cta" onClick={() => { setAsk(null); onOff({ erase: false }); }}>Hide the POTS tab (keep my POTS log)</button>
          <button className="ghostbtn" onClick={() => setAsk("erase")}>Hide it and erase my POTS log</button>
          <button className="linkbtn" style={{ marginTop: 6 }} onClick={() => setAsk(null)}>Cancel</button>
        </div>
      )}
      {on && ask === "erase" && (
        <div className="plaincard" style={{ marginBottom: 10 }}>
          <p className="plain">{POTS_ERASE}</p>
          <button className="cta" style={{ background: "#A04545" }} onClick={() => { setAsk(null); onOff({ erase: true }); }}>Delete POTS log</button>
          <button className="ghostbtn" onClick={() => setAsk("off")}>Keep it</button>
        </div>
      )}
      <Details label="Exactly what's kept">
        <ul>
          <li>Everything you log in POTS tools is stored on this device with the rest of your record, and goes into an encrypted backup if you save one.</li>
          <li>None of it is part of weekly counts, and none of it is sent to Cyra's server or Cyra's AI.</li>
          <li>Turning POTS tools off hides the tab and keeps what you logged, unless you choose to erase it.</li>
        </ul>
      </Details>
    </>
  );
}

/* ⚙ Settings: check-in cadence, nudge time, quick vs full check-in, add-ons (POTS tools),
   reminders, the "Share anonymous weekly counts" switch, and Your data. */
export default function SettingsSheet({ cadence, setCadence, quietHours, setQuietHours, quickMode, setQuickMode, setShowSettings, ping, storageDriver, onExport, onImport, onWipe, keepsWeekNote, reminders, reminderSupport, onReminders, research, setResearch, stage, stageName, pots, onPotsOn, onPotsOff }) {
  const st = reminders?.status;
  const remindersText = st === "blocked"
    ? (reminderSupport === "native" ? "Notifications for Cyra are off in your phone's Settings — turn them on there, then tap Turn on" : reminders.denied ? "Blocked in this browser — allow notifications for Cyra in site settings, then tap Turn on" : "Waiting for permission — tap Turn on and choose Allow")
    : st === "error" && reminders?.cancelFailed ? "Couldn't cancel the reminders already scheduled on this phone — tap Turn off to try again"
    : !reminders?.enabled ? (reminders?.pending?.length ? "Off — this browser won't show reminders. Cyra's server hasn't confirmed it forgot this browser's reminder address yet; Cyra keeps asking while it's open and each time you open it" : "Off")
    : st === "on" ? "On"
    : st === "unsupported" ? "This browser can't show reminders"
    : st === "unavailable" ? "Reminders aren't set up on this server yet"
    : st === "error" ? "Couldn't set up reminders just now — tap Turn on to try again"
    : "Off — pick a rhythm and a time";
  // The switch reads "on" only while reminders really are set up (or simply have nothing to schedule).
  const remindersOn = !!reminders?.enabled && (st === "on" || st === "off");
  const cancelFailed = st === "error" && !!reminders?.cancelFailed; // phone: Turn off again
  const webReminders = reminderSupport === "web" && hasServer();
  const remindersSub = reminderSupport === "native" ? "Scheduled on this phone — no server involved."
    : webReminders ? "A plain reminder, nothing about your health in it. Cyra's server keeps this browser's push address and your reminder schedule; turning reminders off erases them. A server update or restart can pause them until you next open Cyra. No phone number, no texts, ever."
    : reminderSupport === "web" ? "Reminders aren't available in this version of Cyra."
    : "This browser can't show reminders.";
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
      {stage && (
        <>
          <p className="section-lab" style={{ margin: "14px 0 8px" }}>Add-ons</p>
          <PotsAddon pots={pots} stageName={stageName} onOn={onPotsOn} onOff={onPotsOff} />
        </>
      )}
      <p className="section-lab" style={{ margin: "14px 0 8px" }}>Reminders</p>
      <div className="medrow" style={{ borderTop: "none", padding: "4px 0 8px" }}>
        <div className="medinfo"><b>{remindersText}</b><span>{remindersSub}</span></div>
        {cancelFailed
          ? <button className="takebtn" onClick={() => onReminders(false)}>Turn off</button>
          : <button className={`takebtn ${remindersOn ? "on" : ""}`} aria-pressed={remindersOn} onClick={() => onReminders(!remindersOn)}>{remindersOn ? "✓ On" : "Turn on"}</button>}
      </div>
      {webReminders && <Details label="Exactly what's kept"><WebReminderFacts /></Details>}
      <p className="rfoot">One reminder at most. Missed days are never scolded — your patterns work fine with gaps.</p>
      <p className="section-lab" style={{ margin: "14px 0 8px" }}>Anonymous weekly counts</p>
      {hasServer() ? (
        <>
          <div className="medrow" style={{ borderTop: "none", padding: "4px 0 8px" }}>
            <div className="medinfo"><b id="share-counts-title">Share anonymous weekly counts</b><span>Your life stage group{STAGE_GROUP[stage] ? ` (${STAGE_GROUP[stage]})` : ""} and whether you logged {flagWords(stage) || "a few symptoms"}, each at most once a week, with no dates or values. Turning this off stops sharing right away. Counts already added can't be taken back.</span></div>
            <button className={`takebtn ${research ? "on" : ""}`} aria-pressed={!!research} aria-describedby="share-counts-title" onClick={() => setResearch(!research)}>{research ? "✓ On" : "Turn on"}</button>
          </div>
          <Details label="Exactly what's sent">
            <ul>
              <li>Sent at most once a day, and never on the day you log them.</li>
              <li>"Once a week" is counted on this device: deleting the app or clearing this browser's data resets it.</li>
              <li>No dates, values, name or account. Like any request, it carries your device's internet address.</li>
              <li>They're added to the weekly "You're not alone" counts.</li>
              <li>Nothing you log in POTS tools is ever part of weekly counts.</li>
            </ul>
          </Details>
        </>
      ) : (
        <p className="hint" style={{ margin: "0 0 8px" }}>Weekly counts aren't available in this version of Cyra, so nothing is shared.</p>
      )}
      <DataControls driver={storageDriver} onExport={onExport} onImport={onImport} onWipe={onWipe} ping={ping} keepsWeekNote={keepsWeekNote} />
      <button className="ghostbtn" style={{ marginTop: 10 }} onClick={() => setShowSettings(false)}>Done</button>
    </section>
  );
}
