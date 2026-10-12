import { activeMeds, dayTotals, fmtFluid, fmtSodium, tickPlan, nowHHMM, toMin } from "../../lib/pots.js";
import { hm, addDays } from "./ui.js";

/* "Today's plan" (design 4.9), built only from her own data and shown only when it has
   something in it: planned doses still to come (a past one reads "Planned 8:00 · Took it?"),
   fluid and sodium progress when she has goals, "Standing test: you planned one this week"
   (only with the "About weekly" rhythm and no test in the last 7 days; never overdue), the
   movement line (lib/potsMove.js planLine: "Movement: Step 1 session today" on a planned weekday,
   "Rest day. Rest is part of the plan." on the others), and her own plan items, ticked per day.
   Nothing is ever marked late, missed or red; no streaks, no badge. In-app only: Cyra sends
   no reminder for any of it. */
export function planDoses(pots, day) {
  const doses = ((pots.days[day] || {}).doses) || [];
  const out = [];
  for (const med of activeMeds(pots, day)) {
    if (med.kind === "aid") continue;
    for (const slot of med.times) if (!doses.some((d) => d.medId === med.id && d.slot === slot)) out.push({ med, slot });
  }
  return out.sort((a, b) => toMin(a.slot) - toMin(b.slot));
}

export default function PlanToday({ pots, day, isToday, units, setPots, onDose, moveLine = null }) {
  const g = pots.settings.goals, tot = dayTotals(pots, day), items = pots.settings.plan;
  const ticked = ((pots.days[day] || {}).plan) || {};
  const doses = isToday ? planDoses(pots, day) : [];
  const now = toMin(nowHHMM());
  const hasGoals = g.fluidMl != null || g.naMg != null;
  const weekAgo = addDays(day, -6);
  const testDue = isToday && pots.settings.testPlan === "weekly" && pots.settings.show.test && !(pots.tests || []).some((t) => t.date >= weekAgo && t.date <= day);
  const move = isToday ? moveLine : null;
  if (!doses.length && !hasGoals && !items.length && !testDue && !move) return null;
  return (
    <section className="plaincard" aria-labelledby="pots-plan-h" style={{ marginBottom: 12 }}>
      <h2 className="lab" id="pots-plan-h" style={{ marginTop: 0 }}>{isToday ? "Today's plan" : "Your plan that day"}</h2>
      {doses.map(({ med, slot }) => {
        const past = toMin(slot) < now;
        return (
          <div className="medrow" key={`${med.id}-${slot}`}>
            <div className="medinfo"><b>{past ? `Planned ${hm(slot)}` : hm(slot)}</b><span>{med.name}</span></div>
            <button type="button" className="takebtn" aria-label={`Took ${med.name}, ${hm(slot)} dose`} onClick={() => onDose(med, slot)}>{past ? "Took it?" : "Took it"}</button>
          </div>
        );
      })}
      {testDue && <p className="plain" style={{ margin: "8px 0 4px" }}>Standing test: you planned one this week</p>}
      {move && <p className="plain" style={{ margin: "8px 0 4px" }}>{move}</p>}
      {g.fluidMl != null && <p className="plain" style={{ margin: "8px 0 4px" }}>{tot.fluidMl != null ? `Fluids: ${fmtFluid(tot.fluidMl, units)} of ${fmtFluid(g.fluidMl, units)}` : `Fluids: goal ${fmtFluid(g.fluidMl, units)}, nothing logged yet`}</p>}
      {g.naMg != null && <p className="plain" style={{ margin: "0 0 4px" }}>{tot.naMg != null ? `Sodium: ${fmtSodium(tot.naMg, units)} of ${fmtSodium(g.naMg, units)}` : `Sodium: goal ${fmtSodium(g.naMg, units)}, nothing logged yet`}</p>}
      {items.map((it) => {
        const on = !!ticked[it.id];
        return (
          <button type="button" key={it.id} role="checkbox" aria-checked={on} className={`consentopt ${on ? "on" : ""}`} style={{ marginTop: 8 }} onClick={() => setPots((p) => tickPlan(p, day, it.id))}>
            <span className="ckbox" aria-hidden="true">{on ? "✓" : ""}</span><span>{it.label}</span>
          </button>
        );
      })}
    </section>
  );
}
