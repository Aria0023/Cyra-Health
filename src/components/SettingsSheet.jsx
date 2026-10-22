import { useEffect, useRef } from "react";
import { CADENCE } from "../lib/constants.js";
import { APPEARANCES } from "../lib/appearance.js";
import { hasServer } from "../lib/api.js";
import { STAGE_GROUP, flagWords } from "../lib/pulse.js";
import DataControls from "./DataControls.jsx";
import Details, { WebReminderFacts } from "./Details.jsx";
import Icon from "./Icon.jsx";
import PotsAddon from "./pots/PotsAddon.jsx";
import { InstallSettings } from "./Pwa.jsx";
import { reduceMotion } from "../lib/motion.js";
import { FEATURES, remindersInBuild } from "../lib/features.js";

/* Settings: check-in cadence, nudge time, quick vs full check-in, add-ons (POTS tools),
   reminders, the "Share anonymous weekly counts" switch, and Your data.
   UI S1: a sticky header with a Close button (the bottom Done stays), four groups (Check-ins /
   Add-ons & sharing / Appearance / Your data), each option row a labelled group with an icon in its label.
   Opening moves focus to the title; Close and Done hand it back to the gear (triggerRef).
   L1 (spec A14.1): an Install group on the web when this browser can install Cyra (install,
   from App.jsx; never in the phone app, in standalone mode or without IndexedDB), directly
   before Your data. Home's iOS tip opens the sheet with focusTo "install": focus goes to that
   group's label instead of the title. offlineCopy tells Your data that this browser keeps
   Cyra's offline copy of its own files.
   L2 (spec §8.4): Appearance (System / Light / Dark, a .seg) sits between Add-ons & sharing and
   Install; it is this device's display preference (App.jsx chooseAppearance), never in a backup.
   L4 (feature flags, lib/features.js): the rhythm, nudge and Reminders rows exist only where this build
   has reminders (always on a phone; on the web only with webReminders), and the Anonymous weekly counts
   group only with counts. A .setgroup renders only when at least one of its rows does, so no group is ever
   empty; every id, aria-labelledby and sentence is unchanged wherever its row renders. legacyWear goes on
   to Your data (DataControls). */
/* A group label: an id its option row points at (aria-labelledby) and a small accent glyph (G3 .labico). */
const Lab = ({ id, icon, children, style }) => <p className="section-lab" id={id} style={style}><Icon name={icon} className="labico" />{children}</p>;

export default function SettingsSheet({ cadence, setCadence, quietHours, setQuietHours, quickMode, setQuickMode, setShowSettings, ping, storageDriver, onExport, onImport, onWipe, keepsWeekNote, reminders, reminderSupport, onReminders, research, setResearch, stage, stageName, pots, onPotsOn, onPotsOff, daysLogged = 0, lastBackupAt = null, todayIso, triggerRef, install = null, focusTo = null, offlineCopy = false, appearance = "system", onAppearance, legacyWear = false }) {
  const headRef = useRef(null);
  const installLabRef = useRef(null);
  useEffect(() => {
    if (focusTo === "install" && installLabRef.current) {
      installLabRef.current.focus();
      installLabRef.current.scrollIntoView?.({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" });
    } else headRef.current?.focus();
  }, []); // eslint-disable-line
  const close = () => { setShowSettings(false); triggerRef?.current?.focus(); };
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
  // Whether this build has check-in reminders here at all (phones always; the web only with webReminders).
  const remindersHere = remindersInBuild(reminderSupport === "native");
  const webReminders = reminderSupport === "web" && hasServer() && FEATURES.webReminders;
  // Reminders cannot work in this build at all (this browser can't show them, or a web build with no server):
  // no switch, a plain "Unavailable". A server that is merely unreachable keeps the switch (it may come back).
  const unavailable = st === "unsupported" || (reminderSupport === "web" && !hasServer());
  const remindersSub = reminderSupport === "native" ? "Scheduled on this phone — no server involved."
    : webReminders ? "A plain reminder, nothing about your health in it. Cyra's server keeps this browser's push address and your reminder schedule; turning reminders off erases them. A server update or restart can pause them until you next open Cyra. No phone number, no texts, ever."
    : reminderSupport === "web" ? "Reminders aren't available in this version of Cyra."
    : "This browser can't show reminders.";
  // The nudge time only matters while something will use it: rhythm "When I feel like it" schedules nothing,
  // and while reminders are off (but could be turned on) the time waits. The buttons stay enabled.
  const nudgeMuted = cadence === "me" || (!remindersOn && reminderSupport !== "none");
  const nudgeHint = cadence === "me" ? "You chose no reminders, so there's nothing to time."
    : unavailable ? "Reminders aren't available here, so this time isn't used."
    : "Reminders are off — this time is used once you turn them on.";
  return (
    <section className="palsheet" aria-label="Check-in settings" id="settings-sheet">
      <div className="sheethead">
        <h2 className="sheettitle" tabIndex={-1} ref={headRef}>Settings</h2>
        <button type="button" className="sheetclose" aria-label="Close settings" onClick={close}><Icon name="close" /></button>
      </div>
      <div className="setgroup">
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
      </div>
      {(stage || remindersHere || FEATURES.counts) && <div className="setgroup">
        {stage && (
          <>
            <Lab id="set-addons" icon="plus-circle" style={{ margin: "0 0 6px" }}>Add-ons</Lab>
            <div role="group" aria-labelledby="set-addons">
              <PotsAddon pots={pots} stageName={stageName} onOn={onPotsOn} onOff={onPotsOff} storageDriver={storageDriver} />
            </div>
          </>
        )}
        {remindersHere && (<>
        <Lab id="set-reminders" icon="bell" style={{ margin: stage ? "12px 0 6px" : "0 0 6px" }}>Reminders</Lab>
        <div className="medrow" role="group" aria-labelledby="set-reminders" style={{ borderTop: "none", padding: "4px 0 8px" }}>
          <div className="medinfo"><b>{remindersText}</b><span>{remindersSub}</span></div>
          {cancelFailed
            ? <button className="takebtn" onClick={() => onReminders(false)}>Turn off</button>
            : unavailable ? <span className="statechip">Unavailable</span>
            : <button className={`takebtn ${remindersOn ? "on" : ""}`} aria-pressed={remindersOn} onClick={() => onReminders(!remindersOn)}>{remindersOn ? "✓ On" : "Turn on"}</button>}
        </div>
        {webReminders && <Details label="Exactly what's kept"><WebReminderFacts /></Details>}
        <p className="rfoot">One reminder at most. Missed days are never scolded — your patterns work fine with gaps.</p>
        </>)}
        {FEATURES.counts && (<>
        <Lab id="set-counts" icon="people" style={{ margin: stage || remindersHere ? "12px 0 6px" : "0 0 6px" }}>Anonymous weekly counts</Lab>
        {hasServer() ? (
          <>
            <div className="medrow" role="group" aria-labelledby="set-counts" style={{ borderTop: "none", padding: "4px 0 8px" }}>
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
        </>)}
      </div>}
      <div className="setgroup">
        <Lab id="set-appearance" icon="moon" style={{ margin: "0 0 6px" }}>Appearance</Lab>
        <div className="mcrow seg" role="group" aria-labelledby="set-appearance">
          {APPEARANCES.map(([v, label]) => (
            <button key={v} className={`mc ${appearance === v ? "on" : ""}`} aria-pressed={appearance === v} onClick={() => onAppearance(v)}>{label}</button>
          ))}
        </div>
        <p className="rfoot">System follows this device's light or dark setting. Your choice stays on this device and isn't part of a backup.</p>
      </div>
      {install && <InstallSettings install={install} labRef={installLabRef} />}
      <div className="setgroup">
        <DataControls driver={storageDriver} onExport={onExport} onImport={onImport} onWipe={onWipe} ping={ping} keepsWeekNote={keepsWeekNote} daysLogged={daysLogged} lastBackupAt={lastBackupAt} todayIso={todayIso} offlineCopy={offlineCopy} legacyWear={legacyWear} />
      </div>
      <button className="ghostbtn" onClick={close}>Done</button>
    </section>
  );
}
