import { useRef, useState } from "react";
import { Card, Chip } from "./ui/index.js";
import Details from "./Details.jsx";
import { fmt } from "../lib/engine.js";
import { t } from "../lib/i18n.js";
import { SIGNAL_COPY, SKIP_REASONS, RISE, BASELINE } from "../lib/signals.js";
import { skipLabel } from "../lib/autoTracked.js";

/* "Today's auto-tracked" (passive tracking S2, plan §2.1): the card above Quick log while a source synced in the last
   36 h (or in a demo build). The source and when it synced; Sleep / Temperature / HRV / Resting HR as WORDS against
   her own baseline for this cycle phase (lib/signals.js readinessWords: "at your usual", "lower than usual", "lower,
   usual for your luteal days", "a few more nights will show your usual"), never a number or a score; a note under a
   night the rules left out; "also from <source>" when a second source covers the night.
   Looks right writes confirmations[day] with how long the card had been on screen (took) — it NEVER writes a day entry,
   so nothing it does not know enters the day reading or the patterns. "Add anything else?" opens the log sheet with
   symptoms first. "Skip this night" opens the reason picker (Fever or illness · Alcohol · Travel · Other) → nightSkips.
   With no night since the day before yesterday: "No readings since <day>" and the platform's own way to bring them
   (the Health app's link on iPhone, "Sync now" on Android, nothing to tap on the web). m: lib/autoTracked.js autoCardModel. */
const HEALTH_APP_URL = "x-apple-health://";
export default function AutoTrackedCard({ m, onConfirm, onAddMore, onSkip, onUnskip, onSync = null }) {
  const shownAt = useRef(Date.now()); // when the card appeared: the "took" of a Looks right (plan §8)
  const [picking, setPicking] = useState(false);
  const when = m.syncedAt ? (new Date(m.syncedAt).toDateString() === new Date().toDateString() ? t("auto.synced", { source: m.sourceName, time: new Date(m.syncedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) }) : t("auto.syncedDay", { source: m.sourceName, day: fmt(new Date(m.syncedAt)) })) : m.sourceName;
  const confirm = () => { onConfirm(m.day, { took: Math.max(0, Date.now() - shownAt.current) }); };
  const pick = (id) => { setPicking(false); onSkip(m.day, id); };
  return (
    <Card id="auto-tracked" className="autocard" tint="body" icon="pulse" eyebrow={t("auto.eyebrow")} title={when} level={2} badge={m.confirmed ? <Chip variant="logged">{t("auto.confirmedChip")}</Chip> : null}>
      {!m.fresh ? (
        <>
          <p className="autosince">{t("auto.noReadings", { day: fmt(m.day) })}</p>
          {m.platform === "ios" && <a className="ghostbtn autoopen" href={HEALTH_APP_URL}>{t("auto.openHealth")}</a>}
          {m.platform === "android" && onSync && <button type="button" className="ghostbtn autoopen" onClick={onSync}>{t("auto.syncNow")}</button>}
          {m.platform === "web" && <p className="rfoot">{t("auto.noReadingsWeb")}</p>}
        </>
      ) : (
        <>
          <ul className="autorows" aria-label={t("auto.rowsLabel", { day: fmt(m.day) })}>
            {m.rows.map((r) => (
              <li key={r.metric} className={`autorow w-${r.word || (r.present ? "none" : "missing")}`}>
                <span className="autolab">{r.label}</span>
                <span className="autoword">{r.phrase}</span>
                {r.note && <span className="autonote">{r.note}</span>}
                {r.also.length > 0 && <span className="autonote">{t("auto.alsoFrom", { source: r.also.join(", ") })}</span>}
              </li>
            ))}
          </ul>
          {m.skipped ? (
            <p className="autoskipped"><span>{t("auto.skipped", { reason: skipLabel(m.skipped).toLowerCase() })}</span> <button type="button" className="linkbtn" onClick={() => onUnskip(m.day)}>{t("auto.undo")}</button></p>
          ) : (
            <>
              {!m.confirmed && <p className="autohint">{t("auto.confirmHint")}</p>}
              <div className="autoacts">
                <button type="button" className={`stepgo autook${m.confirmed ? " done" : ""}`} aria-pressed={m.confirmed} disabled={m.confirmed} onClick={confirm}>{m.confirmed ? t("auto.confirmed") : t("auto.looksRight")}</button>
                <button type="button" className="stepskip" onClick={onAddMore}>{t("auto.addMore")}</button>
              </div>
              {picking ? (
                <div className="autopick" role="group" aria-labelledby="auto-skipwhy">
                  <p className="lab" id="auto-skipwhy">{t("auto.skipWhy")}</p>
                  <div className="mcrow">
                    {SKIP_REASONS.map(([id, label]) => <button key={id} type="button" className="mc" onClick={() => pick(id)}>{label}</button>)}
                    <button type="button" className="mc" onClick={() => setPicking(false)}>{t("auto.keepNight")}</button>
                  </div>
                </div>
              ) : (
                <p className="autoskip"><button type="button" className="linkbtn" aria-expanded={false} onClick={() => setPicking(true)}>{t("auto.skipNight")}</button></p>
              )}
            </>
          )}
        </>
      )}
      {m.demo && <p className="rfoot autodemo">{t("auto.demo")}</p>}
      <Details label={t("auto.how")}>
        <p>{t("auto.how1", { minN: BASELINE.minN })}</p>
        <p>{t("auto.how2", { above: 1.0, nights: RISE.nights, delta: RISE.delta, before: RISE.before })}</p>
        <p>{t("auto.how3")}</p>
        <p className="rfoot">{SIGNAL_COPY.guidance}</p>
      </Details>
    </Card>
  );
}
