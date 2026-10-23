import { fmt } from "../lib/engine.js";
import { SOURCES, DEMO_WEARABLES } from "../lib/wearables.js";
import { isNative } from "../lib/native.js";
import Advice from "../components/Advice.jsx";
import Details, { WearableFacts } from "../components/Details.jsx";
import Icon from "../components/Icon.jsx";
import { dominantFamily, ChartSoon } from "../components/PatternCharts.jsx";
import { famVar } from "../lib/constants.js";
import { reduceMotion } from "../lib/motion.js";
import { InstallTip } from "../components/Pwa.jsx";
import { FEATURES } from "../lib/features.js";
import { useEffect, useRef } from "react";

/* Home (default tab): greeting + streak, check-in CTA, today's top insight, the patterns card,
   wearable cards, milestones, coming up, pulse, and a grid of collapsible sections (month vs
   last month, Wearables, What I'm trying, Appointments, Journal) whose open panels sit under
   the grid. Feature flags (local-first L4, lib/features.js): the pulse ("You're not alone") shows
   only in builds with counts (App.jsx passes pulse = null otherwise); the wearable cards, the
   Wearables door and its panel only in builds with wearables (without it the grid has 4 doors,
   2 × 2). With POTS tools on, a "POTS today" card (potsCard, built in App.jsx) sits under the
   check-in button. On the web, once 3 days are logged and while this browser can install Cyra,
   one dismissible install tip (installTip, components/Pwa.jsx; spec A14.1) sits after that card
   and before "Today's insight"; it is not a section label or card, so Home's labels don't move.
   L7 (fertility signs, Trying to conceive only): no new section or card. When today's entry has a fertility sign,
   App.jsx passes fertRead (lib/fertility.js) and the same today line shows it instead of its usual text; Coming up's
   first row can be the estimated fertile window (built in App.jsx nextUp, ending "An estimate, not contraception").
   L8: Today's insight is App.jsx's homePick (lib/insights.js): the strongest new finding in her log (one that qualifies
   today but didn't 7 days ago), else a daily rotation through the three strongest, the perimenopause variability
   marker first. It is always one .card.insight with a two-line text ("In your log" wording, never causal); the
   "Month vs last month" recap uses the same 30-calendar-day numbers as Patterns "This month". No markup change. */
/* A trial without enough logged days on both sides of its start date (App.jsx medEffects):
   how many more it needs, or, when the days left can't get there, that it can't be compared. */
const plural = (n) => `${n} logged day${n === 1 ? "" : "s"}`;
function trialWait(e) {
  if (e.stuckBefore) return `Only ${plural(e.haveBefore)} in the 2 weeks before the start date — Cyra needs 5 there, so this one can't be compared`;
  if (e.stuckAfter) return `Only ${plural(e.haveAfter)} in the 2 weeks from the start date — Cyra needs 5 there, so this one can't be compared`;
  const n = e.needBefore + e.needAfter;
  return `${n} more ${n === 1 ? "logged day" : "logged days"} to compare`;
}
/* Said before every first connect of a source that goes through Cyra's server. */
const here = isNative() ? "this phone" : "this device";
const Here = isNative() ? "This phone" : "This device";
const DISCLOSE = {
  oura: {
    summary: `Connecting Oura: you'll sign in at Oura, and Oura will know you connected Cyra. Each sync, Cyra's server fetches your temperature, resting heart rate, HRV and sleep score and passes them to ${here} without keeping them.`,
    details: [
      `Each time you sync, ${here} sends your Oura sign-in to Cyra's server, which uses it to fetch your last 30 days of readiness and sleep records from Oura, keeps only temperature, resting heart rate, HRV and sleep score, and passes those to ${here}. Your readings aren't kept on the server.`,
      `Your Oura sign-in is kept on ${here}. While you connect, it waits on Cyra's server in memory, never on disk, for at most 5 minutes until ${here} collects it.`,
      "Disconnect sends it once more so Oura can end Cyra's access.",
    ],
  },
  terra: {
    summary: `Connecting Fitbit, Garmin or Whoop: this goes through Terra, a health-data service that keeps your data under its own privacy policy. Cyra's server holds your daily readings until ${here} collects them, for 7 days at most.`,
    details: [
      "Terra keeps your device connection and data under its own privacy policy and sends your new wearable data to Cyra's server.",
      `The server keeps only daily temperature, resting heart rate, HRV and sleep, in memory, never on disk, until ${here} collects them, and discards the rest straight away. Anything not collected is deleted after 7 days.`,
      `${Here} keeps a random secret key (nothing about you) and sends it to Cyra's server when you connect, each time it collects readings (when you open or return to Cyra, and when you tap Sync) and when you disconnect. Only a request with that key gets your readings.`,
    ],
  },
};
const SLEPT = { good: "well", fair: "so-so", poor: "poorly" };
/* The seven-dot sketch that stands in for the chart before 3 check-ins: --line and --soft only, no data. */
const delta = (a, b, goodUp = true) => { const d = b - a; if (d === 0) return <span className="flat">unchanged</span>; const good = goodUp ? d > 0 : d < 0; return <span className={good ? "up" : "down"}>{d > 0 ? "+" : ""}{d}</span>; };

export default function HomeScreen({
  acct, stage, stageName, pregWeek, tri = "second", dueDate = "", pred, loggedLast14, loggedTotal = 0, streakLine, goTab, entryOn, todayIso, homeInsight, patternsCard = null, wearInsights, milestones, justReached = null, nextUp, pulse,
  todayEntry = null, scoreIds = [], scoreLabels = {}, dayScore = null,
  recap, showRecap, setShowRecap,
  showWear, setShowWear, wearSources, terraOffCount = 0, connectWear, disconnectWear, wearConfirm, setWearConfirm, wearBusy, wearData, wAvg,
  showMeds, setShowMeds, meds, medLog, medEffects, setMedLog, newMed, setNewMed, setMeds, ping,
  showAppts, setShowAppts, upcoming, past, daysUntil, setAppts, newAppt, setNewAppt,
  showJournal, setShowJournal, journal, jDraft, setJDraft, setJournal,
  potsCard = null,
  installTip = null,
  fertRead = null,
}) {
  const hour = new Date().getHours();
  const connectedCount = Object.values(wearSources).filter((w) => w && !w.pending).length;
  const allDemo = wearData.length > 0 && wearData.every((r) => r.demo);
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  // Today's line under the CTA once today is logged: score, sleep, the two strongest symptoms, in words.
  const todayLine = (() => {
    if (!todayEntry) return null;
    const score = dayScore ? Math.round(dayScore(todayEntry, scoreIds) * 100) : null;
    const syms = scoreIds.filter((k) => (todayEntry.sym?.[k] || 0) > 0).sort((a, b) => todayEntry.sym[b] - todayEntry.sym[a]);
    const fam = dominantFamily(todayEntry, scoreIds);
    const parts = ["Today", ...(score != null ? [`score ${score}`] : []), ...(todayEntry.sleepQ ? [`slept ${SLEPT[todayEntry.sleepQ] || todayEntry.sleepQ}`] : [])];
    if (syms.length) parts.push(`${syms.slice(0, 2).map((k) => scoreLabels[k] || k).join(", ")}${syms.length > 2 ? ` +${syms.length - 2}` : ""}`);
    return { text: fertRead || parts.join(" · "), color: fam ? famVar(fam) : "var(--line)" };
  })();
  // Pregnancy week bar: three trimester segments (weeks 1–12, 13–27, 28–40), the elapsed part filled.
  const wkSegs = [[0, 12], [12, 27], [27, 40]].map(([a, b]) => Math.max(0, Math.min(1, (pregWeek - a) / (b - a))));
  // The stepper rail shows reached dots first (contiguous from the left); the list under "All milestones" keeps the spec order.
  const rail = [...milestones.filter((m) => m.done), ...milestones.filter((m) => !m.done)];
  const nextMs = milestones.find((m) => !m.done && m.progress != null) || milestones.find((m) => !m.done);
  const wd = (iso) => (iso === todayIso ? "today" : daysUntil(iso) > -7 ? new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" }) : fmt(iso));
  const ctaRef = useRef(null); // the check-in button: where focus goes when the install tip closes
  // A section opened from the grid scrolls its panel into view (the panels sit under the grid, so an
  // open one can start below the fold). Not on first render, and only for the flag that just turned on.
  const wasOpen = useRef(null);
  useEffect(() => {
    const now = { recap: showRecap, wear: showWear, meds: showMeds, appts: showAppts, journal: showJournal };
    const prev = wasOpen.current; wasOpen.current = now;
    if (!prev) { // first render: only a roadmap item just sent here (UI M1 prefilled note) scrolls the open Appointments panel into view
      if (showAppts && newAppt.note) document.getElementById("home-appts")?.scrollIntoView?.({ block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" });
      return;
    }
    const opened = Object.keys(now).find((k) => now[k] && !prev[k]);
    if (opened) document.getElementById(`home-${opened}`)?.scrollIntoView?.({ block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" });
  }, [showRecap, showWear, showMeds, showAppts, showJournal]);

  return (
    <main>
      <div className="homehead">
        <div>
          <h1 className="greet">{greet}{acct.name ? `, ${acct.name}` : ""}.</h1>
          <div className="greetsub">{stage === "preg" ? `Week ${pregWeek} · ${tri} trimester` : pred ? `Day ${pred.cycleDay} · ${pred.phase} phase` : stageName}</div>
        </div>
        {loggedLast14 === 0
          ? <div className="streak"><b>Day 1</b><span>let's start</span></div>
          : <div className={`streak ${loggedLast14 >= 7 ? "warm" : ""}`}><b>{loggedLast14}</b><span>of 14 days</span></div>}
      </div>
      {stage === "preg" && (
        <div className="wkbar" role="img" aria-label={`Week ${pregWeek} of 40, ${tri} trimester`}>
          <div className="wktrack">{wkSegs.map((f, i) => <i key={i} className="wkseg"><b style={{ width: `${f * 100}%` }} />{f > 0 && f < 1 && <u style={{ left: `${f * 100}%` }} />}{f === 1 && i === 2 && <u style={{ left: "100%" }} />}</i>)}</div>
          <div className="wkticks"><span>T1</span><span>T2</span><span>T3<em>Due {dueDate}</em></span></div>
        </div>
      )}
      <p className="hint" style={{ marginTop: -6 }}>{streakLine}</p>

      <button ref={ctaRef} className={`cta ${entryOn(todayIso) ? "done" : ""}`} onClick={() => goTab("today")}>{entryOn(todayIso) ? "Update today's check-in" : "Check in — about 30 seconds"}</button>
      {todayLine && <button type="button" className="todayline" onClick={() => goTab("today")}><i className="fdot" aria-hidden="true" style={{ background: todayLine.color }} />{todayLine.text}</button>}
      {/* POTS add-on (App.jsx): the "POTS today" card while it's on, or the one-time offer card. Never replaces Today's insight. */}
      {potsCard}
      {/* The install tip (web only, spec A14.1): hiding it hands focus back to the check-in button. */}
      {installTip && <InstallTip tip={installTip} returnFocusRef={ctaRef} />}

      <p className="section-lab">Today's insight</p>
      <div className="card insight"><div className="num">{homeInsight.num}</div><p>{homeInsight.fam && <i className="fdot" aria-hidden="true" style={{ background: famVar(homeInsight.fam) }} />}{homeInsight.text}</p></div>

      {/* The patterns card (components/PatternCharts.jsx), the same card the Patterns tab opens with;
          before 3 check-ins, a grey sketch that counts the gap (no chart classes, no family colours). */}
      {patternsCard ? (
        <>
          <p className="section-lab">Your patterns · last 60 days</p>
          {patternsCard}
        </>
      ) : stage !== "preg" && (
        <>
          <p className="section-lab">Your patterns</p>
          <ChartSoon logged={loggedTotal} />
        </>
      )}

      {wearInsights.length > 0 && (
        <>
          <p className="section-lab">From your wearable</p>
          {wearInsights.map((w, i) => (
            <div className="icard" key={i}>
              <div className="card"><div className="num">{w.num}</div><p>{w.text}</p></div>
              {w.advice && <Advice urgency={w.urgency || "self"}>{w.advice}</Advice>}
            </div>
          ))}
        </>
      )}

      {/* Milestones: a row of progress dots and the next one named; the full timeline sits under
          "All milestones" (hidden until opened, so it isn't read twice). */}
      <p className="section-lab">Milestones · {milestones.filter((m) => m.done).length} of {milestones.length} reached</p>
      <div className="plaincard mscard">
        <ol className="msteps" aria-hidden="true">
          {rail.map((m, i) => <li className={`mstep ${m.done ? "done" : ""} ${justReached && m.label === justReached.label ? "new" : ""}`} key={i}><span className="msdot">{m.done ? "✓" : ""}</span></li>)}
        </ol>
        {nextMs
          ? <p className="msnext"><b>Next up: </b>{nextMs.label}{nextMs.progress != null && <span className="msbar" aria-hidden="true"><i style={{ width: `${nextMs.progress * 100}%` }} /></span>}</p>
          : <p className="msnext"><b>Every milestone reached.</b></p>}
        <Details label="All milestones">
          <ol className="mstrip" aria-label="Milestones">
            {milestones.map((m, i) => (
              <li className={`ms ${m.done ? "done" : ""}`} key={i}>
                <span className="msdot" aria-hidden="true">{m.done ? "✓" : ""}</span>
                <span className="mslabel"><span className="sr-only">{m.done ? "Reached: " : "Not yet: "}</span>{m.label}</span>
                {m.progress != null && !m.done && <span className="msbar"><i style={{ width: `${m.progress * 100}%` }} /></span>}
              </li>
            ))}
          </ol>
        </Details>
      </div>

      {nextUp.length > 0 && (
        <>
          <p className="section-lab">Coming up</p>
          <div className="plaincard" style={{ padding: "6px 16px" }}>
            {nextUp.map((n) => (
              <div className="nextrow" key={n.k} role={n.action ? "button" : undefined} tabIndex={n.action ? 0 : undefined} onKeyDown={n.action ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); n.action(); } } : undefined} onClick={n.action || undefined} style={n.action ? { cursor: "pointer" } : {}}>
                <span className="nextdot" /><div><div className="nexttext">{n.text}</div><div className={`nextsub ${n.action ? "link" : ""}`}>{n.sub}</div></div>
              </div>
            ))}
          </div>
        </>
      )}

      {pulse && (<>
      <p className="section-lab">You're not alone <span className="seclite">· last week, from people who share counts</span></p>
      <div className={`pulse ${pulse.status === "unavailable" ? "quiet" : ""}`}>
        {pulse.status === "unavailable" ? (
          <div className="pulserow"><b>—</b><span>Community counts aren't available in this version of the app</span></div>
        ) : pulse.items.map((it) => (
          <div className="pulserow" key={it.id}>
            <b>{it.count != null ? it.count.toLocaleString() : "—"}</b>
            <span>{it.count != null ? `contributors ${it.what}`
              : pulse.status === "loading" ? `${it.what} · loading last week's number`
              : pulse.status === "offline" ? `${it.what} · couldn't load last week's number`
              : `${it.what} · shows once ${pulse.k || 50} contributions are counted`}</span>
          </div>
        ))}
        {/* The two claims that matter most stay on screen; how the counts are made sits one tap away
            (hidden, not removed: the full text is always part of the screen). */}
        <p className="rfoot" style={{ margin: "8px 0 0" }}>Anonymous counts only: no names, dates or values.{pulse.status !== "unavailable" && " Loading these numbers tells Cyra's server nothing about your health."}</p>
        <Details label="How these counts work">
          <p>The Cyra app adds to them only for people who turn on sharing, at most once a week from each phone or browser, so one person sharing from two devices counts twice. A number shows only once {pulse.k || 50} or more contributions are in. Because no one is identified, Cyra's server can't check who sends a count, so treat these as rough numbers.</p>
        </Details>
      </div>
      </>)}

      {/* ---- The collapsible sections (five, or four without wearables): buttons in a two-column grid, the open panels under it ---- */}
      {(() => {
        // Each door carries its status after the base label (the base label stays the first text node).
        const scoreDelta = recap ? recap.score[1] - recap.score[0] : null;
        const lastMed = meds[meds.length - 1];
        const lastJ = Object.keys(journal).sort().pop();
        const apptIn = upcoming[0] ? daysUntil(upcoming[0].date) : null;
        const sections = [
          { id: "recap", label: "Month vs last month", status: recap ? (scoreDelta ? `${scoreDelta > 0 ? "+" : "−"}${Math.abs(scoreDelta)}` : "unchanged") : "soon", open: showRecap, set: setShowRecap },
          FEATURES.wearables && { id: "wear", label: "Wearables", status: connectedCount ? `${connectedCount} connected` : "optional", open: showWear, set: setShowWear },
          { id: "meds", label: "What I'm trying", status: lastMed ? `${lastMed.name}, day ${Math.max(1, 1 - daysUntil(lastMed.started))}` : "", open: showMeds, set: setShowMeds },
          { id: "appts", label: "Appointments", status: upcoming[0] ? `${upcoming[0].who || "visit"} ${apptIn === 0 ? "today" : `in ${apptIn} day${apptIn === 1 ? "" : "s"}`}` : "", open: showAppts, set: setShowAppts },
          { id: "journal", label: "Journal", status: lastJ ? `last entry ${wd(lastJ)}` : "", open: showJournal, set: setShowJournal },
        ].filter(Boolean);
        return (
          <div className="dgrid">
            {sections.map((sec) => (
              <button type="button" key={sec.id} className={`disclosure ${sec.open ? "on" : ""}`} aria-expanded={sec.open} aria-controls={sec.open ? `home-${sec.id}` : undefined} onClick={() => sec.set((v) => !v)}>
                <span>{sec.label}{sec.status && <span className="dsub"> · {sec.status}</span>}</span><Icon name="chevron" className="chev" />
              </button>
            ))}
          </div>
        );
      })()}

      {showRecap && (
        <div className="bodypanel detached" id="home-recap">
          <p className="ptitle">Your month vs last month</p>
          {recap ? (
            <>
                  <div className="recaprow"><span>Average day score</span><b>{recap.score[0]} → {recap.score[1]} {delta(recap.score[0], recap.score[1])}</b></div>
                  <div className="recaprow"><span>Calm days</span><b>{recap.calm[0]} → {recap.calm[1]} {delta(recap.calm[0], recap.calm[1])}</b></div>
                  <div className="recaprow"><span>Rough nights</span><b>{recap.poor[0]} → {recap.poor[1]} {delta(recap.poor[0], recap.poor[1], false)}</b></div>
                  {recap.top && <div className="recaprow"><span>{recap.top.label} days</span><b>{recap.top.prev} → {recap.top.now} {delta(recap.top.prev, recap.top.now, false)}</b></div>}
                  <p className="rfoot">Progress isn't always a straight line — a harder month is information, not failure.</p>
            </>
          ) : <p className="plain" style={{ marginTop: 6 }}>Your first monthly recap arrives once there are two months to compare. Keep going.</p>}
        </div>
      )}

      {/* ---- Wearables ---- */}
      {showWear && FEATURES.wearables && (
        <div className="bodypanel detached" id="home-wear">
          <p className="ptitle">Wearables</p>
          <p className="hint" style={{ margin: "10px 0" }}>Entirely optional. Cyra works fully without a device. Connect one and Cyra keeps only temperature, resting heart rate, HRV and sleep from it — whichever your device records.</p>
          {SOURCES.map(({ id, name, what, viaServer }) => {
            const st = wearSources[id];
            return (
              <div key={id}>
                <div className="medrow">
                  <div className="medinfo"><b>{name}</b><span>{what}</span>{st?.pending && <span>{st.restored ? id === "oura" ? "Restored from a backup, not confirmed yet: it shows as connected once a Sync works, and Sync removes it if it no longer does." : "Restored from a backup, not confirmed yet: it shows as connected once readings arrive. If you ended it after making the backup, tap Disconnect." : "Waiting for the connection to finish — tap Sync once you've approved Cyra."}</span>}{id === "terra" && terraOffCount > 0 && <span>Disconnect not confirmed yet: your earlier connection may still be linked and sending new readings to Cyra's server. Cyra keeps asking while it's open and each time you open it.</span>}</div>
                  <div className="wearbtns">
                    {viaServer && st && !st.demo && <button className="takebtn" disabled={!!wearBusy} aria-busy={wearBusy === `${id}:off`} onClick={() => disconnectWear(id, name)}>{wearBusy === `${id}:off` ? "Disconnecting…" : "Disconnect"}</button>}
                    <button className={`takebtn ${st && !st.pending ? "on" : ""}`} disabled={!!wearBusy} aria-busy={wearBusy === id} aria-expanded={viaServer && !st ? wearConfirm === id : undefined} onClick={() => connectWear(id, name)}>{wearBusy === id ? (st ? "Syncing…" : "Connecting…") : st ? (st.pending ? "Sync" : "✓ Sync") : "Connect"}</button>
                  </div>
                </div>
                {wearConfirm === id && !st && (
                  <div className="plaincard wearconfirm" role="group" aria-label={`Before connecting ${name}`}>
                    <p className="plain">{DISCLOSE[id].summary}</p>
                    <Details label="Exactly what happens"><ul>{DISCLOSE[id].details.map((t) => <li key={t}>{t}</li>)}</ul></Details>
                    <button className="cta" onClick={() => connectWear(id, name, { confirmed: true })}>Continue</button>
                    <button className="ghostbtn" onClick={() => setWearConfirm(null)}>Not now</button>
                  </div>
                )}
              </div>
            );
          })}
          {wearData.length > 0 && (
            <div className="plaincard" style={{ marginTop: 10 }}>
              <div className="recaprow" style={{ borderTop: "none", marginTop: 0 }}><span>Avg temperature deviation</span><b>{wAvg("temp") == null ? "—" : `${wAvg("temp") > 0 ? "+" : ""}${wAvg("temp")}°C`}</b></div>
              <div className="recaprow"><span>Resting heart rate</span><b>{wAvg("rhr") == null ? "—" : `${wAvg("rhr")} bpm`}</b></div>
              <div className="recaprow"><span>HRV</span><b>{wAvg("hrv") == null ? "—" : `${wAvg("hrv")} ms`}</b></div>
              <div className="recaprow"><span>Sleep score</span><b>{wAvg("sleep") == null ? "—" : wAvg("sleep")}</b></div>
            </div>
          )}
          <p className="rfoot">{allDemo ? "This build shows 30 days of illustrative demo data shaped to your stage — not a real device. "
            : DEMO_WEARABLES && !wearData.length ? "In this demo build, connecting a device adds 30 days of illustrative data shaped to your stage — not from a real device. "
            : isNative() ? "Apple Health and Health Connect are read on this phone and leave it only inside an encrypted backup you choose to save. " : ""}Wearable signals confirm patterns after the fact — they don't replace a clinician and aren't contraception.</p>
          {!allDemo && !(DEMO_WEARABLES && !wearData.length) && (
            <Details label="How each connection works"><WearableFacts native={isNative()} /></Details>
          )}
        </div>
      )}

      {/* ---- What I'm trying ---- */}
      {showMeds && (
        <div className="bodypanel detached" id="home-meds">
          <p className="ptitle">What I'm trying · meds, supplements, habits</p>
          <p className="hint" style={{ margin: "10px 0" }}>Change one thing — a prescription, a supplement, cutting caffeine, an earlier bedtime — and Cyra compares your days before and after. Trial and error, with a record.</p>
          {meds.map((m) => {
            const takenToday = !!(medLog[todayIso] || {})[m.id];
            const eff = medEffects.find((e) => e.id === m.id);
            return (
              <div className="medrow" key={m.id}>
                <div className="medinfo"><b>{m.name}</b><span>{m.kind === "rx" ? "Prescription" : m.kind === "supp" ? "Supplement" : "Habit"} · since {fmt(m.started)}</span>
                  {eff?.ready ? <span className="medeff">Day score {eff.before} → {eff.after} since starting</span> : <span className="medeff muted">{eff ? trialWait(eff) : ""}</span>}
                </div>
                <button aria-pressed={takenToday} className={`takebtn ${takenToday ? "on" : ""}`} onClick={() => setMedLog((l) => ({ ...l, [todayIso]: { ...(l[todayIso] || {}), [m.id]: !takenToday } }))}>{takenToday ? "✓ Taken" : "Taken today?"}</button>
              </div>
            );
          })}
          <input className="inp" placeholder="e.g. Estradiol patch · Magnesium · No caffeine after noon" aria-label="e.g. Estradiol patch · Magnesium · No caffeine after noon" value={newMed.name} onChange={(e) => setNewMed((x) => ({ ...x, name: e.target.value }))} />
          <div className="mcrow" style={{ marginBottom: 9 }}>
            {[["rx", "Prescription"], ["supp", "Supplement"], ["habit", "Habit / lifestyle"]].map(([v, l]) => <button key={v} aria-pressed={newMed.kind === v} className={`mc ${newMed.kind === v ? "on" : ""}`} onClick={() => setNewMed((x) => ({ ...x, kind: v }))}>{l}</button>)}
          </div>
          <p className="lab" style={{ margin: "4px 0 6px" }}>Started on</p>
          <input className="inp" type="date" aria-label="Started on date" value={newMed.started} onChange={(e) => setNewMed((x) => ({ ...x, started: e.target.value }))} />
          <button className="cta" onClick={() => { if (!newMed.name.trim()) return ping("Give it a name first"); setMeds((m) => [...m, { id: Date.now(), ...newMed }]); setNewMed({ name: "", kind: "supp", started: todayIso }); ping("Added — Cyra will compare your days before and after"); }}>Add</button>
          <p className="rfoot">Change one variable at a time for two weeks, then look — that's how you learn what actually moves your days. Cyra never recommends doses or changes; those stay with you and your clinician.</p>
        </div>
      )}

      {/* ---- Appointments ---- */}
      {showAppts && (
        <div className="bodypanel detached" id="home-appts">
          <p className="ptitle">Appointments</p>
          {upcoming.map((a) => (
            <div className="medrow" key={a.id}>
              <div className="medinfo"><b>{a.who || "Appointment"}</b><span>{fmt(a.date)} · in {daysUntil(a.date)} day{daysUntil(a.date) === 1 ? "" : "s"}</span></div>
              {daysUntil(a.date) <= 7 && stage !== "preg" && <button className="takebtn on" onClick={() => goTab("report")}>Prep report</button>}
            </div>
          ))}
          {past.filter((a) => !a.note).map((a) => (
            <div className="plaincard" key={a.id} style={{ margin: "8px 0" }}>
              <b style={{ fontSize: 13.5 }}>{a.who || "Appointment"} · {fmt(a.date)}</b>
              <p className="hint" style={{ margin: "4px 0 8px" }}>What did they say? A line or two is enough.</p>
              <textarea className="inp" rows={2} style={{ resize: "none", fontFamily: "inherit" }} placeholder="e.g. Starting a low-dose patch, recheck in 3 months" aria-label="e.g. Starting a low-dose patch, recheck in 3 months" onBlur={(e) => { const v = e.target.value.trim(); if (v) setAppts((x) => x.map((y) => y.id === a.id ? { ...y, note: v } : y)); }} />
            </div>
          ))}
          {past.filter((a) => a.note).slice(0, 3).map((a) => <div className="medrow" key={a.id}><div className="medinfo"><b>{a.who || "Appointment"} · {fmt(a.date)}</b><span>{a.note}</span></div></div>)}
          <p className="lab" style={{ margin: "10px 0 6px" }}>Add an appointment</p>
          {newAppt.note && <p className="hint apptnote" style={{ margin: "0 0 6px" }}>For: {newAppt.note}</p>}
          <input className="inp" type="date" aria-label="Appointment date" value={newAppt.date} onChange={(e) => setNewAppt((x) => ({ ...x, date: e.target.value }))} />
          <input className="inp" placeholder="With whom (optional)" aria-label="With whom (optional)" value={newAppt.who} onChange={(e) => setNewAppt((x) => ({ ...x, who: e.target.value }))} />
          <button className="cta" onClick={() => { if (!newAppt.date) return ping("Pick a date"); setAppts((x) => [...x, { id: Date.now(), ...newAppt, note: newAppt.note || "" }]); setNewAppt({ date: "", who: "", note: "" }); ping(stage === "preg" ? "Added — it shows on Home under Coming up" : "Added — it shows on Home, with a prompt to prep your report in the week before"); }}>Add</button>
        </div>
      )}

      {/* ---- Journal ---- */}
      {showJournal && (
        <div className="bodypanel detached" id="home-journal">
          <p className="ptitle">Journal</p>
          <p className="hint" style={{ margin: "10px 0 8px" }}>How are you, really? Some days a slider isn't enough.</p>
          <textarea className="inp" rows={3} style={{ resize: "none", fontFamily: "inherit" }} value={jDraft} onChange={(e) => setJDraft(e.target.value)} placeholder="Private. Just for you." />
          <button className="cta" onClick={() => {
            const t = jDraft.trim(); if (!t) return;
            const more = !!journal[todayIso];
            // A day keeps every entry written on it: a later one is added below the earlier ones.
            setJournal((j) => ({ ...j, [todayIso]: j[todayIso] ? `${j[todayIso]}\n\n${t}` : t }));
            setJDraft(""); ping(more ? "Added to today's journal" : "Saved to your journal");
          }}>Save entry</button>
          {Object.keys(journal).sort().reverse().slice(0, 5).map((iso) => <div className="jentry" key={iso}><b>{fmt(iso)}</b><p style={{ whiteSpace: "pre-wrap" }}>{journal[iso]}</p></div>)}
        </div>
      )}
    </main>
  );
}
