import { CADENCE } from "../lib/constants.js";
import { hasServer } from "../lib/api.js";
import { STAGE_GROUP, flagWords } from "../lib/pulse.js";
import DataControls from "./DataControls.jsx";

/* ⚙ Settings: check-in cadence, nudge time, quick vs full check-in, reminders, the
   "Share anonymous weekly counts" switch, and Your data. */
export default function SettingsSheet({ cadence, setCadence, quietHours, setQuietHours, quickMode, setQuickMode, setShowSettings, ping, storageDriver, onExport, onImport, onWipe, keepsWeekNote, reminders, reminderSupport, onReminders, research, setResearch, stage }) {
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
  const remindersSub = reminderSupport === "native" ? "Scheduled on this phone — no server involved."
    : reminderSupport === "web" && hasServer() ? "A plain reminder, nothing about your health in it. Your browser's push service delivers it. Cyra's server keeps only this browser's push address and its encryption keys, the days and time you chose, your time zone, and the last day it sent you a reminder. These are deleted when you turn reminders off (if Cyra's server can't be reached then, Cyra asks it again while Cyra is open and every time you open it, until the server confirms; this browser can't receive any reminder meanwhile). No phone number, no texts, ever."
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
      <p className="section-lab" style={{ margin: "14px 0 8px" }}>Reminders</p>
      <div className="medrow" style={{ borderTop: "none", padding: "4px 0 8px" }}>
        <div className="medinfo"><b>{remindersText}</b><span>{remindersSub}</span></div>
        {cancelFailed
          ? <button className="takebtn" onClick={() => onReminders(false)}>Turn off</button>
          : <button className={`takebtn ${remindersOn ? "on" : ""}`} aria-pressed={remindersOn} onClick={() => onReminders(!remindersOn)}>{remindersOn ? "✓ On" : "Turn on"}</button>}
      </div>
      <p className="rfoot">One reminder at most. Missed days are never scolded — your patterns work fine with gaps.</p>
      <p className="section-lab" style={{ margin: "14px 0 8px" }}>Anonymous weekly counts</p>
      {hasServer() ? (
        <div className="medrow" style={{ borderTop: "none", padding: "4px 0 8px" }}>
          <div className="medinfo"><b id="share-counts-title">Share anonymous weekly counts</b><span>Your life stage group{STAGE_GROUP[stage] ? ` (${STAGE_GROUP[stage]})` : ""} and whether you logged {flagWords(stage) || "a few symptoms"}, each at most once a week from this device (deleting the app or clearing this browser's data resets that), added to the weekly counts. Sent at most once a day, never on the day you log them, with no dates or values; like any request, it carries your device's internet address. Turning this off stops sharing right away. Counts already added can't be taken back.</span></div>
          <button className={`takebtn ${research ? "on" : ""}`} aria-pressed={!!research} aria-describedby="share-counts-title" onClick={() => setResearch(!research)}>{research ? "✓ On" : "Turn on"}</button>
        </div>
      ) : (
        <p className="hint" style={{ margin: "0 0 8px" }}>Weekly counts aren't available in this version of Cyra, so nothing is shared.</p>
      )}
      <DataControls driver={storageDriver} onExport={onExport} onImport={onImport} onWipe={onWipe} ping={ping} keepsWeekNote={keepsWeekNote} />
      <button className="ghostbtn" style={{ marginTop: 10 }} onClick={() => setShowSettings(false)}>Done</button>
    </section>
  );
}
