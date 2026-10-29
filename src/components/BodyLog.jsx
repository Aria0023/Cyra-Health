import { useEffect, useRef } from "react";
import { QuickTile, IBadge, Chip } from "./ui/index.js";
import Icon from "./Icon.jsx";

/* Body → Logs, the top of the page (calm R4, spec §3.5b): four quick actions, a week strip to pick a day, and the day's
   log as rows ("Symptoms · Logged", "Sleep · 7h", "Movement · 30 min", …) each one tap from its logger. The check-in
   form follows it on the same page (TodayScreen / PregTodayScreen).
   props: actions [{ id, label, icon, tint, onClick }], strip [{ iso, wd, dn, logged, sel, today }], onPickDay(iso),
   title (the card title), rows [{ id, label, icon, tint, value, logged }], onRow(id), meds, medDay, onToggleMed(id),
   weightOff (show "Add weight to your log"), onWeightOn(). */
export default function BodyLog({ actions = [], strip = [], onPickDay, title, rows = [], onRow, meds = [], medDay = null, onToggleMed, weightOff = false, onWeightOn }) {
  // On a narrow phone the strip scrolls sideways (every day stays a 44px target); it opens on its newest days.
  const stripRef = useRef(null);
  useEffect(() => { const el = stripRef.current; if (el) el.scrollLeft = el.scrollWidth; }, []);
  return (
    <div className="bodylog">
      <div className="qtiles bodyacts" role="group" aria-label="Quick actions" style={{ "--qcols": actions.length }}>
        {actions.map((a) => <QuickTile key={a.id} icon={a.icon} label={a.label} tint={a.tint} onClick={a.onClick} />)}
      </div>
      <section className="v2card logcard" data-tint="body" aria-labelledby="logcard-t">
        <div className="logcard-head">
          <IBadge icon="calendar" tint="body" />
          <h2 id="logcard-t" className="v2card-title">{title}</h2>
        </div>
        <div className="daystrip" role="group" aria-label="Pick a day" ref={stripRef}>
          {strip.map((d) => (
            <button key={d.iso} type="button" className={`dayb${d.sel ? " sel" : ""}${d.today ? " today" : ""}`} aria-pressed={d.sel}
              aria-label={`${d.long}${d.today ? ", today" : ""}${d.logged ? ", logged" : ""}`} onClick={() => onPickDay(d.iso)}>
              <span className="dayb-wd" aria-hidden="true">{d.wd}</span>
              <span className="dayb-dn" aria-hidden="true">{d.dn}</span>
              <span className={`dayb-dot${d.logged ? " on" : ""}`} aria-hidden="true" />
            </button>
          ))}
        </div>
        <ul className="logrows">
          {rows.map((r) => (
            <li key={r.id} className={`logrow-li${r.logged ? " is-logged" : ""}`}>
              <button type="button" className="logrow" data-row={r.id} onClick={() => onRow(r.id)} aria-label={`${r.label}: ${r.value || "nothing yet"}. ${r.logged ? "Edit" : "Add"}`}>
                <IBadge icon={r.icon} tint={r.tint} size={34} />
                <span className="logrow-txt"><b>{r.label}</b>{r.value ? <span className="logrow-val">{r.value}</span> : <span className="logrow-val none">Nothing yet</span>}</span>
                {r.logged ? <Chip variant="logged" /> : <span className="logrow-add" aria-hidden="true"><Icon name="plus" size={14} />Add</span>}
              </button>
              {r.id === "meds" && meds.length > 0 && (
                <div className="medquick" role="group" aria-label="Taken">
                  {meds.slice(0, 6).map((m) => {
                    const on = !!(medDay || {})[m.id];
                    return <button key={m.id} type="button" className={`medtake mini ${on ? "on" : ""}`} aria-pressed={on} onClick={() => onToggleMed(m.id)}><span className="medtake-tick" aria-hidden="true">{on ? <Icon name="check" size={12} /> : null}</span><span className="medtake-name">{m.name}</span></button>;
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
        {weightOff && <button type="button" className="linkbtn addweight" onClick={onWeightOn}>Add weight to your log (optional)</button>}
      </section>
    </div>
  );
}
