import { useEffect, useRef } from "react";
import Icon from "./Icon.jsx";
import PotsAddon from "./pots/PotsAddon.jsx";
import { InstallSettings } from "./Pwa.jsx";
import { reduceMotion } from "../lib/motion.js";
import { FEATURES } from "../lib/features.js";
import { FERT_COPY } from "../lib/fertility.js";
import { Lab, reminderModel, CheckinsBody, RemindersBody, CountsBody, AppearanceBody, AboutBody, PrivacyBody } from "./settingsParts.jsx";

/* Settings: check-in cadence, nudge time, quick vs full check-in, add-ons (POTS tools),
   reminders, the "Share anonymous weekly counts" switch, and Privacy & your data.
   UI S1: a sticky header with a Close button (the bottom Done stays), the groups Check-ins /
   Add-ons & sharing / Appearance / [Install] / About you / Privacy & your data, each option row a labelled group with an icon in its label.
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
   to Your data (DataControls).
   L7 (fertility signs, D6): for stage periods, a "Track fertility signs" switch row (fertRow, from App.jsx) sits inside
   Add-ons after POTS tools, with no new section label; the weekly-counts list says fertility signs are never part of
   weekly counts.
   L10 (privacy dashboard and app lock, D4): the last group is "Privacy & your data": DataControls (status strip, where
   the record lives), the live "What can leave this device" list (PrivacyFlows, rows from App.jsx flowRows), the backup /
   restore / delete pills, then LockSettings (the PIN, lock-after, passkey). The weekly-counts "Exactly what's sent" list
   is the shared CountsFacts (Details.jsx), so the dashboard's row shows the same words.
   L11 (onboarding): an "About you" group (#set-about) directly before Privacy & your data holds the optional answers
   that used to be registration steps (AboutYou.jsx, collapsed Details per topic). Each tap goes through onAnswer into
   regAnswers (App.jsx setAnswer): on this device, in encrypted backups without zip and age, never in a network payload.
   It shows in the stage-less intake view too (the stage panels are hidden there).
   Calm R7: the group bodies moved to settingsParts.jsx (same markup, ids and sentences) so the You page can show them in
   cards; this sheet composes them in the same order and wrappers as before. On the You tab App.jsx closes the sheet
   and scrolls to the same controls on the page instead. */
export default function SettingsSheet({ cadence, setCadence, quietHours, setQuietHours, quickMode, setQuickMode, setShowSettings, ping, storageDriver, onExport, onImport, onWipe, keepsWeekNote, reminders, reminderSupport, onReminders, research, setResearch, stage, stageName, pots, onPotsOn, onPotsOff, daysLogged = 0, lastBackupAt = null, todayIso, triggerRef, install = null, focusTo = null, offlineCopy = false, appearance = "system", onAppearance, legacyWear = false, fertRow = null, flows = [], flowCtx = {}, lock = null, potsOn = false, onHandoff = null, regAnswers = null, onAnswer = null }) {
  const headRef = useRef(null);
  const installLabRef = useRef(null);
  useEffect(() => {
    if (focusTo === "install" && installLabRef.current) {
      installLabRef.current.focus();
      installLabRef.current.scrollIntoView?.({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" });
    } else headRef.current?.focus();
  }, []); // eslint-disable-line
  const close = () => { setShowSettings(false); triggerRef?.current?.focus(); };
  const { remindersHere } = reminderModel({ reminders, reminderSupport, cadence });
  return (
    <section className="palsheet" aria-label="Check-in settings" id="settings-sheet">
      <div className="sheethead">
        <h2 className="sheettitle" tabIndex={-1} ref={headRef}>Settings</h2>
        <button type="button" className="sheetclose" aria-label="Close settings" onClick={close}><Icon name="close" /></button>
      </div>
      <div className="setgroup">
        <CheckinsBody cadence={cadence} setCadence={setCadence} quietHours={quietHours} setQuietHours={setQuietHours} quickMode={quickMode} setQuickMode={setQuickMode} ping={ping} reminders={reminders} reminderSupport={reminderSupport} />
      </div>
      {(stage || remindersHere || FEATURES.counts) && <div className="setgroup">
        {stage && (
          <>
            <Lab id="set-addons" icon="plus-circle" style={{ margin: "0 0 6px" }}>Add-ons</Lab>
            <div role="group" aria-labelledby="set-addons">
              <PotsAddon pots={pots} stageName={stageName} onOn={onPotsOn} onOff={onPotsOff} storageDriver={storageDriver} />
              {fertRow && (
                <div className="medrow fertrow">
                  <div className="medinfo"><b id="fert-switch-title">{FERT_COPY.settingTitle}</b><span>{`${fertRow.ttc ? FERT_COPY.settingTtc : FERT_COPY.settingCycle} ${fertRow.privacy}`}</span></div>
                  <button type="button" className={`takebtn ${fertRow.on ? "on" : ""}`} aria-pressed={!!fertRow.on} aria-describedby="fert-switch-title" onClick={() => fertRow.setOn(!fertRow.on)}>{fertRow.on ? "✓ On" : "Turn on"}</button>
                </div>
              )}
            </div>
          </>
        )}
        <RemindersBody reminders={reminders} reminderSupport={reminderSupport} cadence={cadence} onReminders={onReminders} stage={stage} />
        <CountsBody stage={stage} research={research} setResearch={setResearch} afterOthers={!!(stage || remindersHere)} />
      </div>}
      <div className="setgroup">
        <AppearanceBody appearance={appearance} onAppearance={onAppearance} />
      </div>
      {install && <InstallSettings install={install} labRef={installLabRef} />}
      <div className="setgroup">
        <AboutBody regAnswers={regAnswers} onAnswer={onAnswer} stage={stage} stageName={stageName} todayIso={todayIso} />
      </div>
      <div className="setgroup">
        <PrivacyBody storageDriver={storageDriver} onExport={onExport} onImport={onImport} onWipe={onWipe} ping={ping} keepsWeekNote={keepsWeekNote} daysLogged={daysLogged} lastBackupAt={lastBackupAt} todayIso={todayIso} offlineCopy={offlineCopy} legacyWear={legacyWear} onHandoff={onHandoff} flows={flows} flowCtx={flowCtx} lock={lock} potsOn={potsOn} />
      </div>
      <button className="ghostbtn" onClick={close}>Done</button>
    </section>
  );
}
