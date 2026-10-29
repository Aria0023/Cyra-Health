import { fmt } from "../lib/engine.js";
import { SOURCES, DEMO_WEARABLES } from "../lib/wearables.js";
import { isNative } from "../lib/native.js";
import Advice from "../components/Advice.jsx";
import Details, { WearableFacts } from "../components/Details.jsx";
import Icon from "../components/Icon.jsx";
import { dominantFamily } from "../components/PatternCharts.jsx";
import { famVar } from "../lib/constants.js";
import { reduceMotion } from "../lib/motion.js";
import { InstallTip } from "../components/Pwa.jsx";
import { FEATURES } from "../lib/features.js";
import { useEffect, useRef, useState } from "react";
import { Card, QuickTile, StepRail, Ring, Chip, EmptyNote, Sheet } from "../components/ui/index.js";
import { dateEyebrow, greeting, TILES_MIN, TILES_MAX } from "../lib/home.js";
import { MODULE_FRAMING } from "../lib/modules.js";

/* Home v2 (calm R3, spec §5 Home). Top to bottom: the date eyebrow and her greeting; the hero, a large cycle-day ring
   over a soft stage-coloured shape (lib/home.js heroModel: "Day 23" in the serif, the phase under it, then the
   prediction line with its uncertainty range; pregnancy shows the week, menopause the days since the last period or a
   calm "No period tracking needed"), the check-in button and today's line (words only, never a score); the POTS card
   and install tip when they apply; Quick log (2–4 tiles she can choose, each with a "Logged" chip once today has that
   entry); Today's small step (one optional suggestion, a Why disclosure, "Not today"); the Body and Mind step rails;
   Today's insight (one, with the not-medical-advice line); the word-based patterns preview (components/HomePatterns.jsx,
   no numbers out of 100); milestones (no counts); Coming up; the community pulse (builds with counts); and the grid of
   collapsible sections (Month vs last month, Wearables, What I'm trying, Appointments, Journal) with their panels.
   Tone (plan §7): no streaks, grades, completeness counts or bars; the empty state is "A few more logs will show
   clearer associations." Harness-kept: "POTS today" is the first p.section-lab, "Today's insight" a later one, .todayline,
   .nextrow (the TTC fertile window leads Coming up), .dgrid > .disclosure doors and their panels. */
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
const delta = (a, b, goodUp = true) => { const d = b - a; if (d === 0) return <span className="flat">unchanged</span>; const good = goodUp ? d > 0 : d < 0; return <span className={good ? "up" : "down"}>{d > 0 ? "+" : ""}{d}</span>; };

export default function HomeScreen({
  acct, stage, stageName, goTab, todayIso, homeInsight, patternsCard = null, wearInsights, milestones, justReached = null, nextUp, pulse,
  todayEntry = null, scoreIds = [], scoreLabels = {},
  hero, tiles = [], onTile, tilePicker = null, step = null, onStep, onSkipStep, bodyRail = [], mindRail = [],
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
  const [picking, setPicking] = useState(false);
  // Today's line under the hero once today is logged: sleep and the two strongest symptoms, in words (no score).
  const todayLine = (() => {
    if (!todayEntry) return null;
    const syms = scoreIds.filter((k) => (todayEntry.sym?.[k] || 0) > 0).sort((a, b) => todayEntry.sym[b] - todayEntry.sym[a]);
    const fam = dominantFamily(todayEntry, scoreIds);
    const parts = ["Today", ...(todayEntry.sleepQ ? [`slept ${SLEPT[todayEntry.sleepQ] || todayEntry.sleepQ}`] : [])];
    if (syms.length) parts.push(`${syms.slice(0, 2).map((k) => scoreLabels[k] || k).join(", ")}${syms.length > 2 ? ` +${syms.length - 2}` : ""}`);
    else parts.push("no symptoms logged");
    return { text: fertRead || parts.join(" · "), color: fam ? famVar(fam) : "var(--line)" };
  })();
  // Milestones: the reached ones first on the dot rail; the list under "All milestones" keeps the spec order.
  const rail = [...milestones.filter((m) => m.done), ...milestones.filter((m) => !m.done)];
  const nextMs = milestones.find((m) => !m.done && m.progress != null) || milestones.find((m) => !m.done);
  // The hero already says when the next period (or the due date) is; the TTC fertile window sits in the hero under it
  // (one row, so fertility signs never add a section); Coming up keeps visits.
  const heroRows = nextUp.filter((n) => n.k === "fertile");
  const comingUp = nextUp.filter((n) => !["period", "late", "due", "fertile"].includes(n.k));
  const nextRow = (n) => (
    <div className="nextrow" key={n.k} role={n.action ? "button" : undefined} tabIndex={n.action ? 0 : undefined} onKeyDown={n.action ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); n.action(); } } : undefined} onClick={n.action || undefined} style={n.action ? { cursor: "pointer" } : {}}>
      <span className="nextdot" /><div><div className="nexttext">{n.text}</div><div className={`nextsub ${n.action ? "link" : ""}`}>{n.sub}</div></div>
    </div>
  );
  const wd = (iso) => (iso === todayIso ? "today" : daysUntil(iso) > -7 ? new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" }) : fmt(iso));
  const ctaRef = useRef(null); // the Quick log heading: where focus goes when the install tip closes
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
    <main className="homev2">
      {/* ---- Hero: the date, her greeting, and the cycle-day ring (pregnancy: the week; menopause: days since the last
          period or the calm "no period tracking needed" state) with the prediction line and its uncertainty. ---- */}
      <div className="homehero" data-kind={hero.kind} data-len={String(hero.center).length > 7 ? "long" : String(hero.center).length > 6 ? "mid" : undefined}>
        <p className="eyebrow homedate">{dateEyebrow(todayIso)}</p>
        <h1 className="greet">{greeting(hour)}{acct.name ? `, ${acct.name}` : ""}.</h1>
        <div className="herofig">
          <svg className="heroblob" viewBox="0 0 320 260" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
            <path className="heroblob-a" d="M150 22c38-6 82 6 106 36s26 74 6 108-58 62-102 66-86-14-106-48S34 106 56 74s56-46 94-52z" />
            <path className="heroblob-b" d="M234 34c26 4 50 24 54 50s-10 50-32 60-50 4-62-16-12-46 0-66 18-32 40-28z" />
            <path className="heroblob-b" d="M70 176c16-2 32 8 36 24s-4 32-20 36-34-4-38-20 6-38 22-40z" opacity=".8" />
            <circle className="heroblob-c" cx="268" cy="196" r="9" />
            <circle className="heroblob-c" cx="44" cy="74" r="6" />
          </svg>
          <Ring value={hero.value} center={hero.center} sub={hero.sub} size={176} stroke={13} tone={hero.tone} className="heroring" />
        </div>
        {hero.action ? (
          <button type="button" className="heroline" onClick={() => goTab(hero.action)}>
            <span className="heroline-ico" aria-hidden="true"><Icon name="calendar" size={16} /></span>
            <span className="heroline-txt"><b>{hero.line}</b><span>{hero.note}</span></span>
            <Icon name="arrow-right" size={16} className="heroline-go" />
          </button>
        ) : (
          <p className="heroline still">
            <span className="heroline-ico" aria-hidden="true"><Icon name={stage === "preg" ? "heart" : "sun"} size={16} /></span>
            <span className="heroline-txt"><b>{hero.line}</b><span>{hero.note}</span></span>
          </p>
        )}
        {heroRows.length > 0 && <div className="plaincard herorows">{heroRows.map(nextRow)}</div>}
        {todayLine && <button type="button" className="todayline" onClick={() => goTab("today")}><i className="fdot" aria-hidden="true" style={{ background: todayLine.color }} />{todayLine.text}</button>}
      </div>

      {/* POTS add-on (App.jsx): the "POTS today" card while it's on, or the one-time offer card. Never replaces Today's insight. */}
      {potsCard}
      {/* The install tip (web only, spec A14.1): hiding it hands focus back to the check-in button. */}
      {installTip && <InstallTip tip={installTip} returnFocusRef={ctaRef} />}

      {/* ---- Quick log: 2–4 tiles (her choice, You can change them here); each opens its logger. ---- */}
      <section className="quicklog" aria-labelledby="quicklog-t">
        <div className="qlhead">
          <h2 id="quicklog-t" className="v2card-title" ref={ctaRef} tabIndex={-1}>Quick log</h2>
          {tilePicker && <button type="button" className="qlpick" aria-label="Choose your Quick log tiles" aria-haspopup="dialog" aria-expanded={picking} onClick={() => setPicking(true)}><Icon name="sliders" size={18} /></button>}
        </div>
        <div className="qtiles homeqtiles" style={{ "--qcols": tiles.length }}>
          {tiles.map((t) => <QuickTile key={t.id} icon={t.icon} label={t.label} tint={t.tint} note={t.logged ? <Chip variant="logged" /> : null} onClick={() => onTile(t.id)} />)}
        </div>
      </section>

      {/* ---- Today's small step: one optional suggestion from her log and stage, a Why line, and "Not today". ---- */}
      {step && (
        <Card className="stepcard" eyebrow="Today's small step" title={step.title} icon={step.id === "breathe" ? "breath" : "sparkle"} tint="patterns" level={2}>
          <p className="stepbody">{step.body}</p>
          <div className="stepacts">
            {step.action && <button type="button" className="stepgo" onClick={() => onStep(step.action)}>{step.action.label}</button>}
            <button type="button" className="stepskip" onClick={onSkipStep}>Not today</button>
          </div>
          <Details label="Why">
            <p>{step.why}</p>
            {step.src && <p className="stepsrc">Source: {step.src.title}. {step.src.body} {step.src.year}.</p>}
          </Details>
        </Card>
      )}

      {/* ---- Body and Mind: dotted step rails, a tick for what is logged today; untouched steps stay neutral. ---- */}
      <div className="railcards">
        <section className="v2card railcard" data-tint="body" aria-labelledby="rail-body-t">
          <h2 id="rail-body-t" className="railtitle">Body</h2>
          <StepRail steps={bodyRail} label="Body today" />
        </section>
        <section className="v2card railcard" data-tint="mind" aria-labelledby="rail-mind-t">
          <h2 id="rail-mind-t" className="railtitle">Mind</h2>
          <StepRail steps={mindRail} label="Mind today" />
        </section>
      </div>

      <section className="v2card insightcard" aria-labelledby="insight-t">
        <p className="section-lab" id="insight-t">Today's insight</p>
        {homeInsight.empty
          ? <EmptyNote>{homeInsight.text}</EmptyNote>
          : <div className="card insight"><div className="num">{homeInsight.num}</div><p>{homeInsight.fam && <i className="fdot" aria-hidden="true" style={{ background: famVar(homeInsight.fam) }} />}{homeInsight.text}</p></div>}
        {!homeInsight.empty && stage !== "preg" && <p className="insightnote">{MODULE_FRAMING}</p>}
      </section>

      {/* The compact, word-based patterns preview (components/HomePatterns.jsx); the full chart is in Patterns. */}
      {patternsCard}

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

      {/* Milestones: a row of dots and the next one named; the full timeline sits under "All milestones". No counts. */}
      <p className="section-lab">Milestones</p>
      <div className="plaincard mscard">
        <ol className="msteps" aria-hidden="true">
          {rail.map((m, i) => <li className={`mstep ${m.done ? "done" : ""} ${justReached && m.label === justReached.label ? "new" : ""}`} key={i}><span className="msdot">{m.done ? "✓" : ""}</span></li>)}
        </ol>
        {nextMs
          ? <p className="msnext"><b>Next up: </b>{nextMs.label}</p>
          : <p className="msnext"><b>Every milestone reached.</b></p>}
        <Details label="All milestones">
          <ol className="mstrip" aria-label="Milestones">
            {milestones.map((m, i) => (
              <li className={`ms ${m.done ? "done" : ""}`} key={i}>
                <span className="msdot" aria-hidden="true">{m.done ? "✓" : ""}</span>
                <span className="mslabel"><span className="sr-only">{m.done ? "Reached: " : "Not yet: "}</span>{m.label}</span>
              </li>
            ))}
          </ol>
        </Details>
      </div>

      {comingUp.length > 0 && (
        <>
          <p className="section-lab">Coming up</p>
          <div className="plaincard" style={{ padding: "6px 16px" }}>
            {comingUp.map(nextRow)}
          </div>
        </>
      )}

      {picking && tilePicker && <TilePicker {...tilePicker} onClose={() => setPicking(false)} />}

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
        const felt = scoreDelta == null ? null : Math.abs(scoreDelta) < 3 ? "about the same" : scoreDelta > 0 ? "lighter" : "heavier";
        const lastMed = meds[meds.length - 1];
        const lastJ = Object.keys(journal).sort().pop();
        const apptIn = upcoming[0] ? daysUntil(upcoming[0].date) : null;
        const sections = [
          { id: "recap", label: "Month vs last month", status: recap ? felt : "soon", open: showRecap, set: setShowRecap },
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
                  <p className="recapfelt">{(() => { const d = recap.score[1] - recap.score[0]; return Math.abs(d) < 3 ? "This month felt about the same as last month." : `This month felt ${Math.abs(d) >= 8 ? "" : "a little "}${d > 0 ? "lighter" : "heavier"} than last month.`; })()}</p>
                  <div className="recaprow"><span>Calm days</span><b>{recap.calm[0]} → {recap.calm[1]} {delta(recap.calm[0], recap.calm[1])}</b></div>
                  <div className="recaprow"><span>Rough nights</span><b>{recap.poor[0]} → {recap.poor[1]} {delta(recap.poor[0], recap.poor[1], false)}</b></div>
                  {recap.top && <div className="recaprow"><span>{recap.top.label} days</span><b>{recap.top.prev} → {recap.top.now} {delta(recap.top.prev, recap.top.now, false)}</b></div>}
                  <p className="rfoot">Progress isn't always a straight line — a harder month is information, not failure.</p>
            </>
          ) : <EmptyNote>Your first monthly recap arrives once there are two months to compare.</EmptyNote>}
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
                  {eff?.ready ? <span className="medeff">{Math.abs(eff.after - eff.before) < 3 ? "Your days have felt about the same since starting" : `Your days have felt ${eff.after > eff.before ? "lighter" : "heavier"} since starting`}</span> : <span className="medeff muted">{eff ? trialWait(eff) : ""}</span>}
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

/* Home's Quick log picker (calm R3): pick 2–4 tiles from what this stage can log; the order is the order picked.
   "Put back Cyra's tiles" clears her choice (null = the default set). Saved in the record (homeTiles) and in backups. */
function TilePicker({ choices, chosen, custom, set, onClose }) {
  const toggle = (id) => {
    const on = chosen.includes(id);
    if (on && chosen.length <= TILES_MIN) return;
    if (!on && chosen.length >= TILES_MAX) return;
    set(on ? chosen.filter((x) => x !== id) : [...chosen, id]);
  };
  return (
    <Sheet id="tile-sheet" title="Your Quick log" onClose={onClose} closeLabel="Close Quick log choices">
      <p className="hint tilehint" id="tile-hint">Pick {TILES_MIN} to {TILES_MAX}. They show on Home in the order you pick them.</p>
      <div className="tilepick" role="group" aria-label="Quick log tiles" aria-describedby="tile-hint">
        {choices.map((t) => {
          const on = chosen.includes(t.id);
          const stuck = on ? chosen.length <= TILES_MIN : chosen.length >= TILES_MAX;
          return (
            <button key={t.id} type="button" className={`mc tileopt ${on ? "on" : ""}`} aria-pressed={on} aria-disabled={stuck || undefined} onClick={() => toggle(t.id)}>
              <span className="tileopt-ico" data-tint={t.tint} aria-hidden="true"><Icon name={t.icon} size={16} /></span>{t.label}
            </button>
          );
        })}
      </div>
      {custom && <button type="button" className="linkbtn tilereset" onClick={() => { document.getElementById("tile-sheet-t")?.focus(); set(null); }}>Put back Cyra's tiles</button>}
      <button type="button" className="cta tiledone" onClick={onClose}>Done</button>
    </Sheet>
  );
}
