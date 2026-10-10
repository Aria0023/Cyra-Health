import { useEffect, useRef, useState } from "react";
import { POTS_RELATED } from "../../lib/potsConstants.js";
import {
  addIntake, removeItem, updateItem, setRating, setUp, setSleep, setNote, addEpisode, addVitals, logDose, upsertPreset,
  setSettings, setFaintPause, raiseSym, markQuick, nearFaintDays, medsNowPlan, activeMeds, dayTotals, fmtFluid, fmtSodium, newId, nowHHMM,
} from "../../lib/pots.js";
import Advice from "../Advice.jsx";
import FluidSalt from "./FluidSalt.jsx";
import AmountSheet, { SodiumAsk } from "./AmountSheet.jsx";
import GoalSheet from "./GoalSheet.jsx";
import PotsSymptoms, { PotsTriggers } from "./PotsSymptoms.jsx";
import EpisodeForm from "./EpisodeForm.jsx";
import MedsToday, { doseTime, DoseFix } from "./MedsToday.jsx";
import MedEditor from "./MedEditor.jsx";
import PlanToday from "./PlanToday.jsx";
import VitalsForm from "./VitalsForm.jsx";
import QuickLog, { LastRow, FeelBad } from "./QuickLog.jsx";
import { hm, ampm, dayLabel, addDays, SEV_WORD, intakeText, amountText, symLabel, medName, useAnnounce } from "./ui.js";

/* POTS → Today (design 4.2, Full view) and Simple view (4.3). Every tap commits at once
   through a lib/pots.js action in a functional update (saved on this device by the record
   autosave). Missing is never zero, nothing is ever "missed" or "late", there are no streaks
   and no red for falling short. The last thing logged can always be undone from a visible row.
   Sheets (other amount, goals, episode, reading, medicines) open in place of the section and
   hand focus back to the button that opened them. The section owns one role="alert" node
   (urgentLive) for safety cards that appear because of an answer she just picked. */
export const TODAY_FOOT = "Saved on this device as you tap. Cyra's server never gets your POTS log, and it isn't part of weekly counts.";
export const NEAR_FAINT = "Nearly fainting most days is worth raising soon. Bring your log.";
const RATINGS = [[1, "Good"], [2, "Okay"], [3, "Rough"], [4, "Bad"]];
const SLEEP = [["good", "Slept well"], ["fair", "So-so"], ["poor", "Rough night"]];
const NA_ASK = ["electrolyte", "broth", "tablet", "food", "salt"];
const POS_WORD = { lying: "Lying", sitting: "Sitting", standing: "Standing" };

export default function PotsToday({ pots, setPots, day: dayIn, todayIso, setDay, ping, stage, stageName, checkin, symMap, conditions }) {
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
  const [live, announce] = useAnnounce();
  const opener = useRef(null), headRef = useRef(null), topRef = useRef(null);
  const [focusBack, setFocusBack] = useState(null); // null | true (the opener) | an element id

  useEffect(() => { if (sheet) headRef.current?.focus(); }, [sheet]);
  useEffect(() => {
    if (!focusBack) return;
    const el = typeof focusBack === "string" ? document.getElementById(focusBack) : opener.current;
    setFocusBack(null);
    if (el && el.isConnected && el.getClientRects().length) el.focus(); else topRef.current?.focus();
  }, [focusBack]);
  const open = (sh) => { if (!sheet) opener.current = document.activeElement; setSheet(sh); };
  const close = (to = true) => { setSheet(null); setFocusBack(to); };

  const tot = dayTotals(pots, day);
  const whenWord = isToday ? "today" : `on ${dayLabel(day)}`;
  const remember = (x) => setLast({ ...x, day });
  const undo = () => {
    if (!last) return;
    setPots((p) => last.ids.reduce((q, id) => removeItem(q, last.day, id), p));
    ping(`Removed: ${last.text}`);
    setLast(null);
  };
  const toastFor = (item) => {
    if (item.ml != null) ping(`Added ${amountText(item.ml, units)}. ${fmtFluid((tot.fluidMl || 0) + item.ml, units)} ${whenWord}`);
    else if (item.naMg != null) ping(`Sodium added. ${fmtSodium((tot.naMg || 0) + item.naMg, units)} ${whenWord}`);
    else ping(`${item.label} logged`);
  };
  const logPreset = (pr, quick = false) => {
    if (!pr) return;
    const id = newId(), t = nowHHMM();
    const item = { id, t, kind: pr.kind, label: pr.label, ml: pr.ml, naMg: pr.naMg, presetId: pr.id };
    setPots((p) => { const q = addIntake(p, day, item); return quick ? markQuick(q, day) : q; });
    remember({ ids: [id], text: `${intakeText(item, units)} at ${ampm(t)}` });
    toastFor(item);
    if (pr.naMg == null && pr.naSkip !== true && NA_ASK.includes(pr.kind)) open({ kind: "naAsk", preset: pr, itemId: id, text: `${intakeText(item, units)} at ${ampm(t)}` });
  };
  const saveAmount = (entry, { asButton, buttonLabel }) => {
    const item0 = sheet.item;
    if (item0) {
      setPots((p) => updateItem(p, day, item0.id, entry));
      ping("Saved");
    } else {
      const id = newId(), item = { ...entry, id };
      setPots((p) => {
        let q = addIntake(p, day, item);
        if (asButton) q = upsertPreset(q, { label: buttonLabel, kind: entry.kind, ml: entry.ml, naMg: entry.naMg });
        return q;
      });
      if (asButton && s.presets.length >= 16) ping("You have 16 buttons already, so this one wasn't added. Remove one in POTS settings first.");
      else toastFor(item);
      remember({ ids: [id], text: `${intakeText(item, units)} at ${ampm(item.t)}` });
    }
    close();
  };
  const naSave = (mg) => {
    const { preset, itemId, text } = sheet;
    setPots((p) => {
      const cur = p.settings.presets.find((x) => x.id === preset.id);
      let q = p;
      if (cur) { const next = { ...cur, naMg: mg }; delete next.naSkip; q = upsertPreset(q, next); }
      return updateItem(q, day, itemId, { naMg: mg });
    });
    ping(`Sodium added. ${fmtSodium((tot.naMg || 0) + mg, units)} ${whenWord}`);
    if (last && last.ids[0] === itemId) setLast({ ...last, text: text.replace(/ at /, ` · ${fmtSodium(mg, units)}${units.salt === "gSalt" ? "" : " sodium"} at `) });
    close();
  };
  const naSkip = () => {
    const { preset } = sheet;
    setPots((p) => { const cur = p.settings.presets.find((x) => x.id === preset.id); return cur ? upsertPreset(p, { ...cur, naSkip: true }) : p; });
    close();
  };
  const saveEpisode = (ep, { exerciseFaint }) => {
    const ex = sheet.ep;
    if (ex) {
      setPots((p) => { const q = updateItem(p, day, ex.id, ep); return exerciseFaint ? setFaintPause(q, todayIso) : q; });
      ping("Episode saved.");
    } else {
      const id = newId();
      const before = nearFaintDays(pots, day), had = (d.eps || []).some((e) => e.faint === "almost");
      setPots((p) => { const q = addEpisode(p, day, { ...ep, id }); return exerciseFaint ? setFaintPause(q, todayIso) : q; });
      remember({ ids: [id], text: `Episode at ${ampm(ep.t)}` });
      ping("Episode saved.");
      if (ep.faint === "almost" && !had && before + 1 >= 3) announce(NEAR_FAINT);
    }
    close();
  };
  const saveVitals = (v) => {
    const ex = sheet.v;
    if (ex) { setPots((p) => updateItem(p, day, ex.id, v)); ping("Reading saved."); }
    else {
      const id = newId();
      setPots((p) => addVitals(p, day, { ...v, id }));
      remember({ ids: [id], text: `Reading at ${ampm(v.t)}` });
      ping("Reading saved.");
    }
    close();
  };
  const logSlot = (med, slot) => {
    const id = newId(), t = doseTime(slot, isToday);
    setPots((p) => logDose(p, day, { id, medId: med.id, slot, state: "taken", t }));
    remember({ ids: [id], text: `${med.name} ${hm(slot)} taken at ${hm(t)}` });
    ping(`${med.name} logged at ${hm(t)}`);
  };
  /* Simple view "Took my meds": exactly what the tile promised (medsNowPlan). */
  const medsPlan = medsNowPlan(pots, todayIso, Date.now());
  const tookMeds = () => {
    if (!activeMeds(pots, todayIso).some((m) => m.kind !== "aid")) { open({ kind: "medEdit" }); return; }
    if (!medsPlan.logged.length) {
      if (medsPlan.guarded.length) ping(`Already logged at ${hm(medsPlan.guarded[medsPlan.guarded.length - 1].t)}`);
      else open({ kind: "medsCard" });
      return;
    }
    const t = nowHHMM(), items = medsPlan.logged.map((x) => ({ ...x, id: newId() }));
    setPots((p) => markQuick(items.reduce((q, x) => logDose(q, todayIso, { id: x.id, medId: x.medId, slot: x.slot, state: "taken", t }), p), todayIso));
    const names = items.map((x) => `${x.name}${x.slot ? ` ${hm(x.slot)}` : ""}`);
    remember({ ids: items.map((x) => x.id), text: `${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]} at ${hm(t)}` });
    ping(`Logged ${items.length} medicine${items.length > 1 ? "s" : ""} at ${hm(t)}`);
  };
  const saveBad = ({ sym, sev }) => {
    const id = newId(), t = nowHHMM();
    setPots((p) => markQuick(sym.reduce((q, x) => raiseSym(q, todayIso, x, sev), addEpisode(p, todayIso, { id, t, sym, sev })), todayIso));
    remember({ ids: [id], text: `Episode at ${ampm(t)}` });
    ping("Saved. Rest if you need to.");
    close();
  };
  const rate = (v) => {
    const next = d.rating === v ? null : v;
    setPots((p) => { const q = setRating(p, day, next); return simple ? markQuick(q, day) : q; });
    if (next === 4 && !simple && !Object.entries(pots.days).some(([k, x]) => k !== day && x.rating === 4)) setBadOffer(true);
    if (next !== 4) setBadOffer(false);
  };
  const goSimple = (on) => { setPots((p) => setSettings(p, { simple: on })); if (on) setDay(null); };

  // Earliest day she can fix up: 30 days back, or any older day that already has POTS data.
  const keys = Object.keys(pots.days).sort();
  const minDay = keys[0] && keys[0] < addDays(todayIso, -30) ? keys[0] : addDays(todayIso, -30);
  const rel = POTS_RELATED[stage] || [];
  const overlap = rel.filter((id) => ((checkin && checkin.sym) || {})[id] > 0).map((id) => `${symMap[id] || id} (${SEV_WORD[checkin.sym[id]] || "logged"})`);
  const sleepPicked = d.sleep != null ? d.sleep : checkin && checkin.sleepQ ? checkin.sleepQ : null;
  const sleepFromCheckin = d.sleep == null && !!(checkin && checkin.sleepQ);
  const nearFaint = nearFaintDays(pots, day) >= 3;

  const sheetView = sheet && (() => {
    const common = { headRef };
    switch (sheet.kind) {
      case "amount": return <AmountSheet {...common} mode={sheet.mode} item={sheet.item || null} units={units} isToday={isToday} onSave={saveAmount} onCancel={() => close()} />;
      case "naAsk": return <SodiumAsk {...common} preset={sheet.preset} onSave={naSave} onSkip={naSkip} />;
      case "goal": return <GoalSheet {...common} pots={pots} setPots={setPots} units={units} conditions={conditions} preg={preg} today={todayIso} onDone={(r) => { if (r === "saved") ping("Goals saved"); if (r === "cleared") ping("Goals cleared"); close(); }} />;
      case "episode": return <EpisodeForm {...common} pots={pots} ep={sheet.ep || null} isToday={isToday} preg={preg} announce={announce} onSave={saveEpisode} onCancel={() => close()} />;
      case "vitals": return <VitalsForm {...common} v={sheet.v || null} isToday={isToday} announce={announce} onSave={saveVitals} onCancel={() => close()} />;
      case "medEdit": return <MedEditor {...common} pots={pots} setPots={setPots} today={todayIso} pregOrTtc={pregOrTtc} ping={ping} onClose={() => close()} onGoCard={(w) => { if (simple) goSimple(false); close(w === "fluid" ? "pots-fluid-h" : "pots-salt-h"); }} />;
      case "medsCard": return (
        <section aria-labelledby="pots-medsheet-h">
          <h2 className="obq" id="pots-medsheet-h" tabIndex={-1} ref={headRef}>Nothing due now</h2>
          <p className="hint">No planned dose is due in the hour ahead or the last 3 hours. You can still log any medicine here.</p>
          <MedsToday pots={pots} day={todayIso} isToday setPots={setPots} remember={remember} onEdit={() => setSheet({ kind: "medEdit" })} />
          <button type="button" className="ghostbtn" onClick={() => close()}>Done</button>
        </section>
      );
      case "dose": {
        const name = medName(pots, sheet.dose.medId);
        return (
          <section className="plaincard" aria-labelledby="pots-dose-h">
            <h2 className="obq" id="pots-dose-h" tabIndex={-1} ref={headRef}>{`${name} dose`}</h2>
            <DoseFix dose={sheet.dose} name={name} onDone={(patch) => { if (patch === "remove") setPots((p) => removeItem(p, day, sheet.dose.id)); else if (patch) setPots((p) => updateItem(p, day, sheet.dose.id, patch)); close(); }} />
          </section>
        );
      }
      case "bad": return <FeelBad {...common} pots={pots} preg={preg} announce={announce} onSave={saveBad} onCancel={() => close()} />;
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
    ...(d.move || []).map((x) => ({ x, type: "move", text: "Movement session" })),
  ].sort((a, b) => (a.x.t < b.x.t ? -1 : a.x.t > b.x.t ? 1 : 0));
  const edit = (it) => {
    if (it.type === "intake") open({ kind: "amount", mode: it.x.ml != null ? "fluid" : "salt", item: it.x });
    else if (it.type === "ep") open({ kind: "episode", ep: it.x });
    else if (it.type === "vit") open({ kind: "vitals", v: it.x });
    else if (it.type === "dose") open({ kind: "dose", dose: it.x });
  };

  return (
    <div className="pots-today">
      <p className="sr-only" role="alert">{live}</p>
      <h2 className="sr-only" tabIndex={-1} ref={topRef}>{isToday ? "Today" : `Fixing up ${dayLabel(day)}`}</h2>
      {sheetView}
      <div hidden={!!sheet}>
        {/* 1. Logging date */}
        {isToday ? (
          <p className="plain" style={{ marginBottom: 4 }}><b>Today · {dayLabel(day)}</b></p>
        ) : (
          <div className="card" style={{ display: "block", marginBottom: 10 }}>
            <p><b>Fixing up {dayLabel(day)}</b> <button type="button" className="linkbtn" onClick={() => { setDay(null); setFixOpen(false); }}>Back to today</button></p>
          </div>
        )}
        {!simple && (
          <div style={{ marginBottom: 8 }}>
            <button type="button" className="linkbtn" aria-expanded={fixOpen} aria-controls="pots-fix" onClick={() => setFixOpen((v) => !v)}>Fix up an earlier day</button>
            <div id="pots-fix" hidden={!fixOpen}>
              <input className="inp" type="date" aria-label="Day to fix up" min={minDay} max={todayIso} value={day} style={{ marginTop: 6 }}
                onChange={(e) => { const v = e.target.value; if (/^\d{4}-\d{2}-\d{2}$/.test(v) && v >= minDay && v <= todayIso) setDay(v === todayIso ? null : v); }} />
            </div>
          </div>
        )}
        {/* 2. Simple view switch */}
        {!simple && <button type="button" className="linkbtn" aria-pressed={false} style={{ marginBottom: 10 }} onClick={() => goSimple(true)}>Simple view</button>}

        {/* 3. How's today? */}
        <p className="lab" id="pots-rate-l">How's today?</p>
        <div className="mcrow" role="group" aria-labelledby="pots-rate-l" style={{ marginBottom: 8 }}>
          {RATINGS.map(([v, l]) => <button type="button" key={v} className={`mc ${d.rating === v ? "on" : ""}`} style={{ minHeight: 56, flex: "1 1 0" }} aria-pressed={d.rating === v} onClick={() => rate(v)}>{l}</button>)}
        </div>
        {d.rating >= 3 && <p className="hint" style={{ margin: "0 0 10px" }}>Sorry today's hard. Log one thing or nothing. Both are fine.</p>}
        {badOffer && !simple && (
          <div className="plaincard" style={{ marginBottom: 12 }}>
            <p className="plain">Switch to Simple view?</p>
            <div className="wearbtns">
              <button type="button" className="sbtn" onClick={() => { setBadOffer(false); goSimple(true); }}>Yes</button>
              <button type="button" className="sbtn" onClick={() => setBadOffer(false)}>No thanks</button>
            </div>
          </div>
        )}

        {simple ? (
          <QuickLog pots={pots} units={units} plan={medsPlan} last={last} onUndo={undo}
            onDrink={(pr) => logPreset(pr, true)} onSalt={(pr) => logPreset(pr, true)} onMeds={tookMeds} onFeelBad={() => open({ kind: "bad" })} onFull={() => goSimple(false)} />
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
            {overlap.length > 0 && <p className="rfoot" style={{ margin: "0 0 12px" }}>{`Already in ${isToday ? "today's" : "that day's"} check-in: ${overlap.join(", ")}. No need to log it twice.`}</p>}
            {/* 6. Today's plan */}
            <PlanToday pots={pots} day={day} isToday={isToday} units={units} setPots={setPots} onDose={logSlot} />
            {/* 7. Fluids and sodium */}
            {s.show.fluid && <FluidSalt pots={pots} day={day} units={units} setPots={setPots} onPreset={(pr) => logPreset(pr)} onOther={(mode) => open({ kind: "amount", mode })} onGoal={() => open({ kind: "goal" })} />}
            {/* 8. Right now */}
            {s.show.sym && <PotsSymptoms pots={pots} day={day} setPots={setPots} announce={announce} preg={preg} onEpisode={() => open({ kind: "episode" })} />}
            {nearFaint && <div style={{ marginBottom: 12 }}><Advice urgency="visit">{NEAR_FAINT}</Advice></div>}
            {/* 9. Medicines & supports */}
            {s.show.meds && <MedsToday pots={pots} day={day} isToday={isToday} setPots={setPots} remember={remember} onEdit={() => open({ kind: "medEdit" })} />}
            {/* Single readings (the stand test arrives in a later version) */}
            <section className="plaincard" aria-labelledby="pots-vit-card-h" style={{ marginBottom: 12 }}>
              <h2 className="lab" id="pots-vit-card-h" style={{ marginTop: 0 }}>Heart rate and blood pressure</h2>
              <button type="button" className="linkbtn" onClick={() => open({ kind: "vitals" })}>Add a single reading</button>
            </section>
            {/* 11. Triggers */}
            {s.show.sym && <PotsTriggers pots={pots} day={day} setPots={setPots} />}
            {/* 12. Sleep last night */}
            <p className="lab" id="pots-sleep-l">Sleep last night</p>
            <div className="row" role="group" aria-labelledby="pots-sleep-l" style={{ marginBottom: sleepFromCheckin ? 4 : 16 }}>
              {SLEEP.map(([v, l]) => <button type="button" key={v} className={`pill ${sleepPicked === v ? "pill-on" : ""}`} aria-pressed={sleepPicked === v} onClick={() => setPots((p) => setSleep(p, day, d.sleep === v ? null : v))}>{l}</button>)}
            </div>
            {sleepFromCheckin && <p className="hint" style={{ margin: "0 0 14px" }}>{isToday ? "From today's check-in. Tap to change." : "From that day's check-in. Tap to change."}</p>}
            {/* 14. Note for your clinician */}
            <label className="lab" htmlFor="pots-note">Note for your clinician</label>
            <textarea id="pots-note" key={`${day}:${d.note || ""}`} className="inp" rows={3} maxLength={500} aria-label="Note for your clinician" defaultValue={d.note || ""}
              onBlur={(e) => { if (e.target.value.trim() !== (d.note || "")) setPots((p) => setNote(p, day, e.target.value)); }} />
            {/* 15. Today's log */}
            <button type="button" className="disclosure" aria-expanded={logOpen} aria-controls="pots-log" onClick={() => setLogOpen((v) => !v)}>
              <span>{isToday ? `Today's log · ${logItems.length} item${logItems.length === 1 ? "" : "s"}` : `Log for ${dayLabel(day)}`}</span><span aria-hidden="true">{logOpen ? "−" : "+"}</span>
            </button>
            <div id="pots-log" className="bodypanel" hidden={!logOpen}>
              {!logItems.length && <p className="hint" style={{ margin: "10px 0 0" }}>Nothing logged {isToday ? "yet today" : "that day"}.</p>}
              {logItems.map((it) => (
                <div className="medrow" key={it.x.id}>
                  <div className="medinfo"><b>{hm(it.x.t)}</b><span>{it.text}</span></div>
                  <div className="wearbtns">
                    {it.type !== "move" && <button type="button" className="sbtn" aria-label={`Edit ${it.text} at ${hm(it.x.t)}`} onClick={() => edit(it)}>Edit</button>}
                    <button type="button" className="sbtn" aria-label={`Remove ${it.text} at ${hm(it.x.t)}`} onClick={() => { setPots((p) => removeItem(p, day, it.x.id)); ping(`Removed: ${it.text}`); if (last && last.ids.includes(it.x.id)) setLast(null); }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
            {/* 16. Undo row */}
            <LastRow last={last} onUndo={undo} />
          </>
        )}
        {/* 17. Footer */}
        <p className="rfoot">{TODAY_FOOT}</p>
      </div>
    </div>
  );
}
