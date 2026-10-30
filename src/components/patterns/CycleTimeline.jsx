import { fmt } from "../../lib/engine.js";
import { t } from "../../lib/i18n.js";

/* The Patterns hero (calm R6): the last cycles as bars of their actual lengths, newest first, the running one on top.
   Each bar shows the logged period days (strongest ramp step), a textbook fertile-window estimate on 21–35-day cycles
   (dashed, labelled an estimate), and, for the running cycle, a dashed run to its likely length. Labels are calm words:
   "Left out of predictions", "Longer than your usual", PCOS "Over 35 days". Marks use the soft data-viz ramp
   (--soft-1..4), never the UI palette. Bars are hidden from screen readers; each row says its cycle in words.
   model: lib/patterns.js cycleTimeline(...). */
export default function CycleTimeline({ model }) {
  const pct = (d) => `${Math.min(100, (d / model.scale) * 100).toFixed(2)}%`;
  const hasFert = model.rows.some((r) => r.fertile);
  return (
    <div className="tl">
      <ul className="tlrows">
        {model.rows.map((r) => {
          const say = r.current
            ? `This cycle, from ${fmt(r.start)}: day ${r.len} so far${r.expected ? `, likely about ${r.expected} days` : ""}.`
            : `Cycle from ${fmt(r.start)}: ${r.len} days${r.period ? `, period logged on ${r.period} ${r.period === 1 ? "day" : "days"}` : ""}.`;
          return (
            <li key={r.start} className={`tlrow${r.current ? " now" : ""}${r.long ? " long" : ""}`}>
              <span className="sr-only">{say}{r.labels.length ? ` ${r.labels.join(". ")}.` : ""}</span>
              <div className="tlhead" aria-hidden="true">
                <span className="tldate">{r.current ? t("timeline.now") : fmt(r.start)}</span>
                <span className="tllen">{r.current ? <>{t("timeline.day")} <b>{r.len}</b></> : <><b>{r.len}</b> {t("timeline.days")}</>}</span>
              </div>
              <div className="tltrack" aria-hidden="true">
                {r.current && r.expected > r.len && <i className="tlexp" style={{ width: pct(r.expected) }} />}
                <i className="tlbar" style={{ width: pct(r.len) }}>
                  {r.period > 0 && <i className="tlper" style={{ width: `${((r.period / r.len) * 100).toFixed(2)}%` }} />}
                  {r.fertile && <i className="tlfert" style={{ left: `${(((r.fertile[0] - 1) / r.len) * 100).toFixed(2)}%`, width: `${(((r.fertile[1] - r.fertile[0] + 1) / r.len) * 100).toFixed(2)}%` }} />}
                </i>
              </div>
              {r.labels.length > 0 && <div className="tllabs" aria-hidden="true">{r.labels.map((l) => <span key={l} className="tllab">{l}</span>)}</div>}
            </li>
          );
        })}
      </ul>
      <div className="tlkey" aria-hidden="true">
        <span><i className="k-per" />{t("timeline.period")}</span>
        {hasFert && <span><i className="k-fert" />{t("timeline.likelyFertileDaysAnEstimate")}</span>}
        <span><i className="k-cyc" />{t("timeline.cycle")}</span>
        {model.rows.some((r) => r.current && r.expected > r.len) && <span><i className="k-exp" />{t("timeline.stillRunning")}</span>}
      </div>
      {model.sentence && <p className="tlsent">{model.sentence}</p>}
    </div>
  );
}
