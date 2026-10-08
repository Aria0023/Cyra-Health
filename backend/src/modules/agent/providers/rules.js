// Deterministic provider: same tool interface as the LLM provider,
// so the system runs (and is testable) with no API key.
export async function run(task, TOOLS) {
  const trace = [];
  const call = async (name, args) => {
    const out = await TOOLS[name].run(args);
    trace.push({ tool: name, args, results: Array.isArray(out) ? out.length : 1 });
    return out;
  };

  if (task.task === "weekly_insight") {
    const metrics = await call("get_metrics", { userRef: task.userRef, days: 30 });
    const temps = metrics.filter((m) => m.type === "temp_deviation").map((m) => m.value);
    const sleeps = metrics.filter((m) => m.type === "sleep_score").map((m) => m.value);
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const findings = [];
    if (avg(temps) != null && avg(temps) > 0.15)
      findings.push(`Body temperature ran ${avg(temps).toFixed(2)}°C above your baseline on average — a pattern worth logging alongside hot flashes.`);
    if (avg(sleeps) != null && avg(sleeps) < 70)
      findings.push(`Average sleep score was ${Math.round(avg(sleeps))} — below the healthy band. Your check-ins can confirm whether symptoms track it.`);
    const catalog = await call("get_catalog", { stage: task.stage || "peri" });
    const rec = avg(sleeps) != null && avg(sleeps) < 70 ? catalog.find((c) => /sleep|clinician/i.test(c.offer)) : null;
    return {
      insight: findings.length ? findings.join(" ") : "No notable wearable patterns this week.",
      suggestion: rec ? `Relevant shelf option: ${rec.name} — ${rec.offer} (${rec.evidence}).` : null,
      disclaimer: "Patterns, not diagnoses.",
      trace,
    };
  }

  if (task.task === "partner_brief") {
    const stats = await call("get_partner_stats", { partnerId: task.partnerId });
    return {
      insight: `Partner ${task.partnerId}: ${stats.clicks} clicks → ${stats.newPatients} new patients (${
        stats.clicks ? Math.round((100 * stats.newPatients) / stats.clicks) : 0
      }% conversion).`,
      trace,
    };
  }
  throw new Error(`unknown task: ${task.task}`);
}
