import { ACCOUNTS_HERE } from "../../lib/cloudBackup.js";
import { useEffect, useRef, useState } from "react";
import { POTS_RELATED } from "../../lib/potsConstants.js";
import {
  addIntake, removeItem, updateItem, setRating, setUp, setSleep, setNote, setSym, addEpisode, addVitals, logDose, upsertPreset,
  setSettings, setFaintPause, raiseSym, markQuick, nearFaintDays, medsNowPlan, activeMeds, dayTotals, fmtSodium, newId, nowHHMM, doseTime, localDay,
  intakeToast, asksSodium, daysLogged,
} from "../../lib/pots.js";
import Advice from "../Advice.jsx";
import FluidSalt from "./FluidSalt.jsx";
import AmountSheet, { SodiumAsk } from "./AmountSheet.jsx";
import GoalSheet from "./GoalSheet.jsx";
import PotsSymptoms, { PotsTriggers } from "./PotsSymptoms.jsx";
import EpisodeForm from "./EpisodeForm.jsx";
import MedsToday, { DoseFix, doseText } from "./MedsToday.jsx";
import MedEditor from "./MedEditor.jsx";
import PlanToday from "./PlanToday.jsx";
import VitalsForm from "./VitalsForm.jsx";
import QuickLog, { LastRow, FeelBad } from "./QuickLog.jsx";
import { resultFor, riseText } from "./StandResult.jsx";
import { nextDayPending, setNextDay, skipNextDay, planLine, modeWord, NEXT_OPTS, MOVE_COPY } from "../../lib/potsMove.js";
import { SessionEdit } from "./MoveSession.jsx";
import { fmtN } from "./HrChart.jsx";
import { hm, ampm, dayLabel, addDays, SEV_WORD, intakeText, symLabel, medName, useAnnounce, potsUnsaved } from "./ui.js";
import { FEATURES } from "../../lib/features.js";
import { fmtDate } from "../../lib/i18n.js";
import { potsTodayFoot, potsTodayFootUnsaved, potsTodayFoot2 } from "../../lib/disclosures.js";

/* POTS → Today (design 4.2, Full view) and Simple view (4.3). Every tap commits at once
   through a lib/pots.js action in a functional update (saved on this device by the record
   autosave). Missing is never zero, nothing is ever "missed" or "late", there are no streaks
   and no red for falling short. The last thing logged can always be undone from a visible row.
   Sheets (other amount, goals, episode, reading, medicines) open in place of the section and
   hand focus back to the button that opened them. The section owns one role="alert" node
   (urgentLive) for safety cards that appear because of an answer she just picked. */
/* The footers name weekly counts only in builds with counts (lib/features.js); with every flag on they
   are the pre-L4 text exactly (lib/disclosures.js, disclosures.test.mjs). */
export const TODAY_FOOT = potsTodayFoot(FEATURES, ACCOUNTS_HERE);
/** The footer while the record isn't being saved (lib/storage.js driver, ui.js potsUnsaved). */
export const TODAY_FOOT_UNSAVED = potsTodayFootUnsaved(FEATURES, ACCOUNTS_HERE);
/** Under the footer, after setup (PotsScreen's top hint is then one sentence): the two sentences
    that used to sit in that hint, verbatim. */
export const TODAY_FOOT_2 = potsTodayFoot2(FEATURES);
export const NEAR_FAINT = "Nearly fainting most days is worth raising soon. Bring your log.";
const RATINGS = [[1, "Good"], [2, "Okay"], [3, "Rough"], [4, "Bad"]];
const SLEEP = [["good", "Slept well"], ["fair", "So-so"], ["poor", "Rough night"]];
const POS_WORD = { lying: "Lying", sitting: "Sitting", standing: "Standing" };

export default function PotsToday({ pots, setPots, day: dayIn, todayIso, setDay, ping, stage, stageName, checkin, symMap, conditions, onStandTest, onReport = null, storageDriver = null, syncDay = null }) {
  const s = pots.settings, units = s.units, simple = s.simple === true, preg = stage === "preg";
  const pregOrTtc = preg || stageName === "Trying to Conceive";
  const day = simple ? todayIso : dayIn;
  const isToday = day === todayIso;
  const d = pots.days[day] || {};
  const [sheet, setSheet] = useState(null);
  const [last, setLast] = useState(null);
  const [fixOpen, setFixOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [badOffer, setBadOffer] = useState(false);
  const [fixHint, setFixHint] = useState(false);
  const [live, announce] = useAnnounce();
  /* The day note is saved as she types (the record autosave, flushed when the app is hidden or
     closed), so "Saved on this device as you tap" holds for it too. The text she sees is a local
     draft (the stored note is trimmed); it follows the stored note when another day is shown, or
     when the note changes elsewhere (Undo, another tab, a restore) while she isn't typing in it. */
  const [noteDraft, setNoteDraft] = useState(d.note || "");
  const noteDay = useRef(day);
  useEffect(() => {
    const moved = noteDay.current !== day; noteDay.current = day;
    if (moved || typeof document === "undefined" || document.activeElement?.id !== "pots-note") setNoteDraft((v) => (!moved && v.trim() === (d.note || "") ? v : d.note || ""));
  }, [day, d.note]);
  const opener = useRef(null), headRef = useRef(null), topRef = useRef(null);
  const [focusBack, setFocusBack] = useState(null); // null | true (the opener) | an element id

  useEffect(() => { if (sheet) headRef.current?.focus(); }, [sheet]);
  useEffect(() => {
    if (!focusBack) return;
    const el = focusBack === "top" ? null : typeof focusBack === "string" ? document.getElementById(focusBack) : opener.current;
    setFocusBack(null);
    if (el && el.isConnected && el.getClientRects().length) el.focus(); else topRef.current?.focus();
  }, [focusBack]);
  const open = (sh) => { if (!sheet) opener.current = document.activeElement; setSheet(sh); };
  const close = (to = true) => { setSheet(null); setFocusBack(to); };

  const tot = dayTotals(pots, day);
  const whenWord = isToday ? "today" : `on ${dayLabel(day)}`;
  const remember = (x, on = day) => setLast({ ...x, day: on });
  const doseRemoved = (id, text) => { ping(`Removed: ${text}`); setLast((l) => (l && l.ids.includes(id) ? null : l)); };
  /* The day a new timed entry is filed under. On "today" it is the date at the moment of the tap
     (App moves to a new day at midnight and on resume; this covers a tap that lands first, and
     tells App to catch up). An earlier day she picked to fix up stays that day. */
  const nowDay = () => (syncDay ? syncDay() : localDay());
  const tapDay = () => (isToday ? nowDay() : day);
  /* Undo takes back the whole tap: the items it added and, for "I feel bad now", each symptom
     severity it raised (back to what it was, unless she has changed it since). */
  const undo = () => {
    if (!last) return;
    setPots((p) => {
      let q = last.ids.reduce((x, id) => removeItem(x, last.day, id), p);
      for (const [id, [prev, raised]] of Object.entries(last.sym || {})) {
        if ((((q.days[last.day] || {}).sym || {})[id] || 0) === raised) q = setSym(q, last.day, id, prev);
      }
      return q;
    });
    ping(`Removed: ${last.text}`);
    setLast(null);
    setFocusBack("top"); // the Undo row goes with it
  };
  // The toast sentence is built in lib/pots.js (intakeToast), so Home's one-tap drink says the same.
  const sayLogged = (item, on = day) => ping(intakeToast(item, on === day ? tot : dayTotals(pots, on), s.goals, units, whenWord));
  const logPreset = (pr, quick = false) => {
    if (!pr) return;
    const id = newId(), t = nowHHMM(), on = tapDay();
    const item = { id, t, kind: pr.kind, label: pr.label, ml: pr.ml, naMg: pr.naMg, presetId: pr.id };
    setPots((p) => { const q = addIntake(p, on, item); return quick ? markQuick(q, on) : q; });
    remember({ ids: [id], text: `${intakeText(item, units)} at ${ampm(t)}` }, on);
    sayLogged(item, on);
    if (asksSodium(pr)) open({ kind: "naAsk", preset: pr, itemId: id, day: on, text: `${intakeText(item, units)} at ${ampm(t)}` });
  };
  const saveAmount = (entry, { asButton, buttonLabel }) => {
    const item0 = sheet.item;
    if (item0) {
      setPots((p) => updateItem(p, day, item0.id, entry));
      ping("Saved");
    } else {
      const id = newId(), item = { ...entry, id }, on = tapDay();
      setPots((p) => {
        let q = addIntake(p, on, item);
        if (asButton) q = upsertPreset(q, { label: buttonLabel, kind: entry.kind, ml: entry.ml, naMg: entry.naMg });
        return q;
      });
      if (asButton && s.presets.length >= 16) ping("You have 16 buttons already, so this one wasn't added. Remove one in POTS settings first.");
      else sayLogged(item, on);
      remember({ ids: [id], text: `${intakeText(item, units)} at ${ampm(item.t)}` }, on);
    }
    close();
  };
  const naSave = (mg) => {
    const { preset, itemId, text } = sheet, on = sheet.day || day;
    setPots((p) => {
      const cur = p.settings.presets.find((x) => x.id === preset.id);
      let q = p;
      if (cur) { const next = { ...cur, naMg: mg }; delete next.naSkip; q = upsertPreset(q, next); }
      return updateItem(q, on, itemId, { naMg: mg });
    });
    ping(`Sodium added. ${fmtSodium(((on === day ? tot : dayTotals(pots, on)).naMg || 0) + mg, units)} ${whenWord}`);
    if (last && last.ids[0] === itemId) setLast({ ...last, text: text.replace(/ at /, ` · ${fmtSodium(mg, units)}${units.salt === "gSalt" ? "" : " sodium"} at `) });
    close();
  };
  const naSkip = () => {
    const { preset } = sheet;
    setPots((p) => { const cur = p.settings.presets.find((x) => x.id === preset.id); return cur ? upsertPreset(p, { ...cur, naSkip: true }) : p; });
    close();
  };
  /* A new or changed episode that makes the near-faint advice appear (3 or more days in 7)
     announces it, as the safety cards do. */
  const saveEpisode = (ep, { exerciseFaint }) => {
    const ex = sheet.ep, id = ex ? ex.id : newId(), on = ex ? day : tapDay();
    const apply = (p) => (ex ? updateItem(p, on, id, ep) : addEpisode(p, on, { ...ep, id }));
    const before = nearFaintDays(pots, on), after = nearFaintDays(apply(pots), on);
    setPots((p) => { const q = apply(p); return exerciseFaint ? setFaintPause(q, ex ? todayIso : nowDay()) : q; });
    if (!ex) remember({ ids: [id], text: `Episode at ${ampm(ep.t)}` }, on);
    ping("Episode saved.");
    if (before < 3 && after >= 3) announce(NEAR_FAINT);
    close();
  };
  const saveVitals = (v) => {
    const ex = sheet.v;
    if (ex) { setPots((p) => updateItem(p, day, ex.id, v)); ping("Reading saved."); }
    else {
      const id = newId(), on = tapDay();
      setPots((p) => addVitals(p, on, { ...v, id }));
      remember({ ids: [id], text: `Reading at ${ampm(v.t)}` }, on);
      ping("Reading saved.");
    }
    close();
  };
  const logSlot = (med, slot) => {
    const id = newId(), t = doseTime(slot, isToday), on = tapDay();
    setPots((p) => logDose(p, on, { id, medId: med.id, slot, state: "taken", t }));
    remember({ ids: [id], text: `${med.name} ${hm(slot)} taken at ${hm(t)}` }, on);
    ping(`${med.name} logged at ${hm(t)}`);
  };
  /* Simple view "Took my meds": exactly what the tile promised (medsNowPlan). */
  const medsPlanNow = medsNowPlan(pots, todayIso, Date.now());
  const tookMeds = () => {
    const on = tapDay(), medsPlan = on === todayIso ? medsPlanNow : medsNowPlan(pots, on, Date.now());
    if (!activeMeds(pots, on).some((m) => m.kind !== "aid")) { open({ kind: "medEdit" }); return; }
    if (!medsPlan.logged.length) {
      if (medsPlan.guarded.length) ping(`Already logged at ${hm(medsPlan.guarded[medsPlan.guarded.length - 1].t)}`);
      else open({ kind: "medsCard" });
      return;
    }
    const t = nowHHMM(), items = medsPlan.logged.map((x) => ({ ...x, id: newId() }));
    setPots((p) => markQuick(items.reduce((q, x) => logDose(q, on, { id: x.id, medId: x.medId, slot: x.slot, state: "taken", t }), p), on));
    const names = items.map((x) => `${x.name}${x.slot ? ` ${hm(x.slot)}` : ""}`);
    remember({ ids: items.map((x) => x.id), text: `${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]} at ${hm(t)}` }, on);
    ping(`Logged ${items.length} medicine${items.length > 1 ? "s" : ""} at ${hm(t)}`);
  };
  const saveBad = ({ sym, sev }) => {
    const id = newId(), t = nowHHMM(), on = nowDay();
    // What each symptom's day severity was, and what this tap raised it to (for Undo).
    const cur = ((pots.days[on] || {}).sym) || {};
    const raised = Object.fromEntries(sym.filter((x) => (cur[x] || 0) < sev).map((x) => [x, [cur[x] || 0, sev]]));
    setPots((p) => markQuick(sym.reduce((q, x) => raiseSym(q, on, x, sev), addEpisode(p, on, { id, t, sym, sev })), on));
    setLast({ ids: [id], sym: raised, text: `Episode at ${ampm(t)}`, day: on });
    ping("Saved. Rest if you need to.");
    close();
  };
  const rate = (v) => {
    const next = d.rating === v ? null : v;
    setPots((p) => { const q = setRating(p, day, next); return simple ? markQuick(q, day) : q; });
    if (next === 4 && !simple && !Object.entries(pots.days).some(([k, x]) => k !== day && x.rating === 4)) setBadOffer(true);
    if (next !== 4) setBadOffer(false);
  };
  // Switching views replaces the tapped button: focus goes to the given control in the new view.
  const goSimple = (on, focusId = on ? "pots-full-btn" : "pots-simple-btn") => { setPots((p) => setSettings(p, { simple: on })); if (on) setDay(null); setFocusBack(focusId); };

  // Earliest day she can fix up: 30 days back, or any older day that already has POTS data
  // (a brand-new day can only be backfilled within the last 30 days).
  const keys = Object.keys(pots.days).sort(), back30 = addDays(todayIso, -30);
  const minDay = keys[0] && keys[0] < back30 ? keys[0] : back30;
  const pickDay = (v) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v > todayIso) return;
    if (v < back30 && !pots.days[v]) { setFixHint(true); return; }
    setFixHint(false);
    setDay(v === todayIso ? null : v);
  };
  const rel = POTS_RELATED[stage] || [];
  const overlap = rel.filter((id) => ((checkin && checkin.sym) || {})[id] > 0).map((id) => `${symMap[id] || id} (${SEV_WORD[checkin.sym[id]] || "logged"})`);
  const sleepPicked = d.sleep != null ? d.sleep : checkin && checkin.sleepQ ? checkin.sleepQ : null;
  const sleepFromCheckin = d.sleep == null && !!(checkin && checkin.sleepQ);
  const nearFaint = nearFaintDays(pots, day) >= 3;
  // 13. The next-day question about yesterday's sessions (only on today, with Move shown).
  const nextDue = isToday && s.show.move ? nextDayPending(pots, todayIso) : [];
  const yesterday = addDays(todayIso, -1);
  const answerNext = (v) => { const ids = nextDue.map((x) => x.id); setPots((p) => setNextDay(p, yesterday, ids, v)); ping("Saved. Thanks."); setFocusBack("pots-note"); };
  const skipNext = () => { const ids = nextDue.map((x) => x.id); setPots((p) => skipNextDay(p, yesterday, ids)); setFocusBack("pots-note"); };
  // Today's plan: the movement line ("Movement: Step 1 session today" / rest day), with Move shown.
  const moveLine = s.show.move ? planLine(pots, { stage, day }) : null;
  // Stand test card: the latest finished, stopped or interrupted test ("Oct 3 · heart rate rose 34").
  const lastTest = [...(pots.tests || [])].reverse().find((t) => t.status !== "running") || null;
  const lastLine = (() => {
    if (!lastTest) return "No tests yet";
    const r = resultFor(pots, lastTest, stage), when = fmtDate(lastTest.date, { month: "short", day: "numeric" });
    const what = r.hrStatus !== "insufficient" && r.peakRise > 0 ? `heart rate rose ${fmtN(r.peakRise)}` : riseText(lastTest, r);
    return `Last test: ${when} · ${what}`;
  })();

  const nDays = daysLogged(pots);

  const sheetView = sheet && (() => {
    const common = { headRef };
    switch (sheet.kind) {
      case "amount": return <AmountSheet {...common} mode={sheet.mode} item={sheet.item || null} units={units} isToday={isToday} onSave={saveAmount} onCancel={() => close()} />;
      case "naAsk": return <SodiumAsk {...common} preset={sheet.preset} onSave={naSave} onSkip={naSkip} />;
      case "goal": return <GoalSheet {...common} pots={pots} setPots={setPots} units={units} conditions={conditions} preg={preg} today={todayIso} onDone={(r) => { if (r === "saved") ping("Goals saved"); if (r === "cleared") ping("Goals cleared"); close(); }} />;
      case "episode": return <EpisodeForm {...common} pots={pots} ep={sheet.ep || null} isToday={isToday} preg={preg} announce={announce} onSave={saveEpisode} onCancel={() => close()} />;
      case "vitals": return <VitalsForm {...common} v={sheet.v || null} isToday={isToday} preg={preg} announce={announce} onSave={saveVitals} onCancel={() => close()} />;
      case "medEdit": return <MedEditor {...common} pots={pots} setPots={setPots} today={todayIso} pregOrTtc={pregOrTtc} ping={ping} onClose={() => close()} onGoCard={(w) => { if (simple) goSimple(false); close(w === "fluid" ? "pots-fluid-h" : "pots-salt-h"); }} />;
      case "medsCard": return (
        <section aria-labelledby="pots-medsheet-h">
          <h2 className="obq" id="pots-medsheet-h" tabIndex={-1} ref={headRef}>Nothing due now</h2>
          <p className="hint">No planned dose is due in the hour ahead or the last 3 hours. You can still log any medicine here.</p>
          <MedsToday pots={pots} day={todayIso} isToday setPots={setPots} remember={remember} onRemoved={doseRemoved} onEdit={() => setSheet({ kind: "medEdit" })} />
          <button type="button" className="ghostbtn" onClick={() => close()}>Done</button>
        </section>
      );
      case "dose": {
        const name = medName(pots, sheet.dose.medId);
        return (
          <section className="plaincard" aria-labelledby="pots-dose-h">
            <h2 className="obq" id="pots-dose-h" tabIndex={-1} ref={headRef}>{`${name} dose`}</h2>
            <DoseFix dose={sheet.dose} name={name} onDone={(patch) => { if (patch === "remove") { setPots((p) => removeItem(p, day, sheet.dose.id)); doseRemoved(sheet.dose.id, doseText(name, sheet.dose)); } else if (patch) setPots((p) => updateItem(p, day, sheet.dose.id, patch)); close(); }} />
          </section>
        );
      }
      case "bad": return <FeelBad {...common} pots={pots} preg={preg} announce={announce} onSave={saveBad} onCancel={() => close()} />;
      case "session": return <SessionEdit {...common} pots={pots} setPots={setPots} ses={sheet.ses} day={day} todayIso={todayIso} preg={preg} announce={announce} onDone={(saved) => { if (saved) ping("Session saved."); close(); }} />;
      default: return null;
    }
  })();

  /* Today's log: every intake, dose, episode, reading and session that day, by time. */
  const posWord = (v) => POS_WORD[v.pos] || "Single";
  const logItems = [
    ...(d.intake || []).map((x) => ({ x, type: "intake", text: intakeText(x, units) })),
    ...(d.doses || []).map((x) => ({ x, type: "dose", text: `${medName(pots, x.medId)} ${x.state === "skipped" ? "skipped" : "taken"}${x.slot ? ` (planned ${hm(x.slot)})` : ""}` })),
    ...(d.eps || []).map((x) => ({ x, type: "ep", text: `Episode: ${[x.sym.map((id) => symLabel(pots, id)).join(", "), x.faint === "yes" ? "fainted" : x.faint === "almost" ? "almost fainted" : "", x.sev ? SEV_WORD[x.sev] : ""].filter(Boolean).join(" · ")}` })),
    ...(d.vit || []).map((x) => ({ x, type: "vit", text: `${posWord(x)} reading: ${[x.hr != null ? `heart rate ${x.hr}` : null, x.sys != null || x.dia != null ? `${x.sys ?? "?"}/${x.dia ?? "?"}` : null].filter(Boolean).join(" · ")}` })),
    ...(d.move || []).map((x) => ({ x, type: "move", text: `${modeWord(x.mode)} session${x.main ? ` · main part ${x.main} min` : ""}${x.interrupted ? " · ended early (the app closed)" : x.stopped ? " · stopped early" : x.running ? " · not finished" : ""}` })),
  ].sort((a, b) => (a.x.t < b.x.t ? -1 : a.x.t > b.x.t ? 1 : 0));
  const edit = (it) => {
    if (it.type === "intake") open({ kind: "amount", mode: it.x.ml != null ? "fluid" : "salt", item: it.x });
    else if (it.type === "ep") open({ kind: "episode", ep: it.x });
    else if (it.type === "vit") open({ kind: "vitals", v: it.x });
    else if (it.type === "dose") open({ kind: "dose", dose: it.x });
    else if (it.type === "move") open({ kind: "session", ses: it.x });
  };

  return (
    <div className="pots-today">
      <p className="sr-only" role="alert">{live}</p>
      <h2 className="sr-only" tabIndex={-1} ref={topRef}>{isToday ? "Today" : `Fixing up ${dayLabel(day)}`}</h2>
      {sheetView}
      <div hidden={!!sheet}>
        {/* 1. Logging date, with the view switch (one mode, two names: Full view | Simple view) */}
        {!isToday && (
          <div className="card" style={{ display: "block", marginBottom: 10 }}>
            <p><b>Fixing up {dayLabel(day)}</b> <button type="button" className="linkbtn" onClick={() => { setDay(null); setFixOpen(false); setFixHint(false); setFocusBack("pots-fix-btn"); }}>Back to today</button></p>
          </div>
        )}
        <div className="daterow">
          {isToday && <p className="plain"><b>Today · {dayLabel(day)}</b></p>}
          <div className="mcrow seg viewsw" role="group" aria-label="View">
            <button type="button" id="pots-full-btn" className={`mc ${!simple ? "on" : ""}`} aria-pressed={!simple} onClick={() => { if (simple) goSimple(false); }}>Full view</button>
            <button type="button" id="pots-simple-btn" className={`mc ${simple ? "on" : ""}`} aria-pressed={simple} onClick={() => { if (!simple) goSimple(true); }}>Simple view</button>
          </div>
        </div>
        {!simple && (
          <div style={{ marginBottom: 8 }}>
            <button type="button" id="pots-fix-btn" className="linkbtn" aria-expanded={fixOpen} aria-controls="pots-fix" onClick={() => setFixOpen((v) => !v)}>Fix up an earlier day</button>
            <div id="pots-fix" hidden={!fixOpen}>
              <input className="inp" type="date" aria-label="Day to fix up" aria-describedby={fixHint ? "pots-fix-hint" : undefined} min={minDay} max={todayIso} value={day} style={{ marginTop: 6 }}
                onChange={(e) => pickDay(e.target.value)} />
              {fixHint && <p className="hint" id="pots-fix-hint" role="status" style={{ margin: "0 0 8px" }}>You can add a new day from the last 30 days. Older days can be changed only if they already have POTS entries.</p>}
            </div>
          </div>
        )}
        {/* 3. How's today? */}
        <p className="lab" id="pots-rate-l">How's today?</p>
        <div className="mcrow" role="group" aria-labelledby="pots-rate-l" style={{ marginBottom: 8 }}>
          {RATINGS.map(([v, l]) => <button type="button" key={v} id={`pots-rate-${v}`} className={`mc ${d.rating === v ? "on" : ""}`} style={{ minHeight: 56, flex: "1 1 0" }} aria-pressed={d.rating === v} onClick={() => rate(v)}>{l}</button>)}
        </div>
        {d.rating >= 3 && <p className="hint" style={{ margin: "0 0 10px" }}>Sorry today's hard. Log one thing or nothing. Both are fine.</p>}
        {badOffer && !simple && (
          <div className="plaincard" style={{ marginBottom: 12 }}>
            <p className="plain">Switch to Simple view?</p>
            <div className="wearbtns">
              <button type="button" className="sbtn" onClick={() => { setBadOffer(false); goSimple(true, "pots-rate-4"); }}>Yes</button>
              <button type="button" className="sbtn" onClick={() => { setBadOffer(false); setFocusBack("pots-rate-4"); }}>No thanks</button>
            </div>
          </div>
        )}

        {simple ? (
          <QuickLog pots={pots} units={units} plan={medsPlanNow} last={last} onUndo={undo}
            onDrink={(pr) => logPreset(pr, true)} onSalt={(pr) => logPreset(pr, true)} onMeds={tookMeds} onFeelBad={() => open({ kind: "bad" })} onOther={(mode) => open({ kind: "amount", mode })} />
        ) : (
          <>
            {/* 4. Upright today */}
            <div className="scalerow" style={{ marginTop: 6 }}>
              <div className="scalehead"><span>How much did being upright bother you today?</span><b>{d.up == null ? "Not set" : d.up}</b></div>
              <input className="slider" type="range" min="0" max="10" value={d.up ?? 0} aria-label="Upright today, 0 is not at all, 10 is couldn't stay up" aria-valuetext={d.up == null ? "Not set" : `${d.up} out of 10`}
                onChange={(e) => setPots((p) => setUp(p, day, +e.target.value))} onClick={(e) => { if (d.up == null) setPots((p) => setUp(p, day, +e.target.value)); }} />
              <div className="scaleends"><span>0 not at all</span><span>10 couldn't stay up</span></div>
              {d.up != null && <button type="button" className="linkbtn" onClick={() => setPots((p) => setUp(p, day, null))}>Clear</button>}
            </div>
            {/* 5. Overlap with the check-in (read only) */}
            {overlap.length > 0 && <p className="rfoot" style={{ margin: "0 0 12px" }}>{`Already in ${isToday ? "today's" : "that day's"} check-in: ${overlap.join(", ")}. No need to log it twice${s.reportCycle !== false ? "; your POTS report shows both" : ""}.`}</p>}
            {/* 6. Today's plan */}
            <PlanToday pots={pots} day={day} isToday={isToday} units={units} setPots={setPots} onDose={logSlot} moveLine={moveLine} />
            {/* 7. Fluids and sodium */}
            {s.show.fluid && <FluidSalt pots={pots} day={day} whenWord={whenWord} units={units} setPots={setPots} onPreset={(pr) => logPreset(pr)} onOther={(mode) => open({ kind: "amount", mode })} onGoal={() => open({ kind: "goal" })} />}
            {/* 8. Right now */}
            {s.show.sym && <PotsSymptoms pots={pots} day={day} setPots={setPots} announce={announce} preg={preg} onEpisode={() => open({ kind: "episode" })} />}
            {nearFaint && <div style={{ marginBottom: 12 }}><Advice urgency="visit" alone>{NEAR_FAINT}</Advice></div>}
            {/* 9. Medicines & supports */}
            {s.show.meds && <MedsToday pots={pots} day={day} isToday={isToday} setPots={setPots} remember={remember} onRemoved={doseRemoved} onEdit={() => open({ kind: "medEdit" })} />}
            {/* 10. Stand test */}
            {s.show.test && (
              <section className="plaincard" aria-labelledby="pots-stand-card-h" style={{ marginBottom: 12 }}>
                <h2 className="lab" id="pots-stand-card-h" style={{ marginTop: 0 }}>Stand test</h2>
                <p className="plain">{lastLine}</p>
                <button type="button" className="cta" onClick={onStandTest}>Start a stand test</button>
                <button type="button" className="linkbtn" style={{ display: "block", marginTop: 10 }} onClick={() => open({ kind: "vitals" })}>Add a single reading</button>
              </section>
            )}
            {/* 11. Triggers */}
            {s.show.sym && <PotsTriggers pots={pots} day={day} setPots={setPots} />}
            {/* 12. Sleep last night */}
            <p className="lab" id="pots-sleep-l">Sleep last night</p>
            <div className="row" role="group" aria-labelledby="pots-sleep-l" style={{ marginBottom: sleepFromCheckin ? 4 : 16 }}>
              {SLEEP.map(([v, l]) => <button type="button" key={v} className={`pill ${sleepPicked === v ? "pill-on" : ""}`} aria-pressed={sleepPicked === v} onClick={() => setPots((p) => setSleep(p, day, d.sleep === v ? null : v))}>{l}</button>)}
            </div>
            {sleepFromCheckin && <p className="hint" style={{ margin: "0 0 14px" }}>{isToday ? "From today's check-in. Tap to change." : "From that day's check-in. Tap to change."}</p>}
            {/* 13. Movement next-day prompt */}
            {nextDue.length > 0 && (
              <section className="plaincard" aria-labelledby="pots-next-l" style={{ marginBottom: 12 }}>
                <p className="lab" id="pots-next-l" style={{ marginTop: 0 }}>{MOVE_COPY.nextQ}</p>
                <div className="mcrow" role="group" aria-labelledby="pots-next-l">
                  {NEXT_OPTS.map(([v, l]) => <button type="button" key={v} className="mc" onClick={() => answerNext(v)}>{l}</button>)}
                </div>
                <button type="button" className="linkbtn" style={{ display: "block", marginTop: 8 }} onClick={skipNext}>Skip</button>
              </section>
            )}
            {/* 14. Note for your clinician */}
            <label className="lab" htmlFor="pots-note">Note for your clinician</label>
            <textarea id="pots-note" className="inp" rows={3} maxLength={500} aria-label="Note for your clinician" aria-describedby="pots-note-hint" value={noteDraft}
              onChange={(e) => { const v = e.target.value; setNoteDraft(v); if (v.trim() !== (d.note || "")) setPots((p) => setNote(p, day, v)); }} />
            <p className="hint" id="pots-note-hint" style={{ margin: "0 0 12px" }}>Goes in your report only if you include notes.</p>
            {/* 15. Today's log */}
            <button type="button" id="pots-log-btn" className="disclosure" aria-expanded={logOpen} aria-controls="pots-log" onClick={() => setLogOpen((v) => !v)}>
              <span>{isToday ? `Today's log · ${logItems.length} item${logItems.length === 1 ? "" : "s"}` : `Log for ${dayLabel(day)}`}</span><span aria-hidden="true">{logOpen ? "−" : "+"}</span>
            </button>
            <div id="pots-log" className="bodypanel" hidden={!logOpen}>
              {!logItems.length && <p className="hint" style={{ margin: "10px 0 0" }}>Nothing logged {isToday ? "yet today" : "that day"}.</p>}
              {logItems.map((it) => (
                <div className="medrow" key={it.x.id}>
                  <div className="medinfo"><b>{hm(it.x.t)}</b><span>{it.text}</span></div>
                  <div className="wearbtns">
                    <button type="button" className="sbtn" aria-label={`Edit ${it.text} at ${hm(it.x.t)}`} onClick={() => edit(it)}>Edit</button>
                    <button type="button" className="sbtn" aria-label={`Remove ${it.text} at ${hm(it.x.t)}`} onClick={() => { setPots((p) => removeItem(p, day, it.x.id)); ping(`Removed: ${it.text}`); if (last && last.ids.includes(it.x.id)) setLast(null); setFocusBack("pots-log-btn"); }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
            {/* 16. Undo row */}
            <LastRow last={last} onUndo={undo} />
          </>
        )}
        {/* 17. Footer: the saving sentence, the two sentences from the (now one-line) page hint, and once
            three days are logged, the way to the report. */}
        <p className="rfoot">{potsUnsaved(storageDriver) ? TODAY_FOOT_UNSAVED[potsUnsaved(storageDriver)] : TODAY_FOOT}</p>
        <p className="hint foot2">{TODAY_FOOT_2}</p>
        {nDays >= 3 && onReport && <p className="pline reportline">{`${nDays} days logged · `}<button type="button" className="linkbtn" onClick={onReport}>Make a report for your clinician</button></p>}
      </div>
    </div>
  );
}
