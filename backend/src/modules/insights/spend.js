// AI costs for the portal's owners (docs/plans/launch-tools.md Task 2): an ESTIMATE, a monthly budget and one alert at
// 80% and one at 100%. OWNER ONLY. The totals come from the ai module (ai/spend.js: per UTC day and kind, tokens and
// web searches as the API reported them; nothing about any person or request). This file multiplies them by prices.
//
//   GET /api/insights/ai-costs          this month so far, projected month end, by kind, by day, per person, prices, budget
//   GET /api/insights/ai-costs.csv      every kept day and kind (400 days), with the estimate at today's prices
//   PUT /api/insights/ai-costs/prices   { inputPerMTok?, outputPerMTok?, cacheWritePerMTok?, cacheReadPerMTok?, webSearchPer1000? } | { reset: true }
//   PUT /api/insights/ai-costs/budget   { usd: number | null }   (null = no budget)
//
// Every amount is an estimate: tokens x the prices held in config.ai.prices (or an owner's edit, kept in
// "ai_spend_settings" with the date). Anthropic's console is the bill of record.
// Budget: when the month's estimate first reaches 80% of the budget, and again at 100%, ONE email goes to the weekly
// report's recipients (the existing Resend sender). The marker for each is written to the store BEFORE the email goes
// out, so a restart can't send it twice; never more than one of each per calendar month (UTC). Reaching 100% without an
// 80% email sends the 100% one only. NOTHING is switched off: the per-person monthly caps (ai/usage.js) remain the hard
// limit. Logs: fixed categories only, never an address.
import { SPEND_KINDS, PRICE_FIELDS, DEFAULT_PRICES, cleanPrices, costOf } from "../ai/spend.js";

const DAY = 86_400_000;
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const monthOf = (ms) => new Date(ms).toISOString().slice(0, 7);
const r4 = (v) => Math.round(Number(v || 0) * 10_000) / 10_000;
const ZERO = () => ({ requests: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, searches: 0 });
const addTo = (t, r) => { for (const k of Object.keys(t)) t[k] += Number.isFinite(Number(r?.[k])) ? Math.max(0, Math.round(Number(r[k]))) : 0; return t; };
export const KIND_LABEL = Object.freeze({ ask: "Ask (free)", evidence: "Ask with evidence", chat: "Chat about your log", weekly: "Weekly write-up", report: "Owner report", meal: "Meal photos" });
export const ESTIMATE_LINE = "Estimate only: token totals multiplied by the prices shown. Anthropic's console is the bill of record.";
export const NO_SHUTOFF_LINE = "Nothing is switched off when the budget is passed. The per-person monthly caps remain the hard limit.";

/** { percent, level } of a month's estimate against a budget. level: none (no budget) | ok | warn (80%+) | over (100%+). */
export function budgetState(usd, budgetUsd) {
  const b = Number(budgetUsd);
  if (!(Number.isFinite(b) && b > 0)) return { budgetUsd: null, percent: null, level: "none" };
  const percent = Math.floor((Number(usd || 0) / b) * 100);
  return { budgetUsd: b, percent, level: usd >= b ? "over" : usd >= 0.8 * b ? "warn" : "ok" };
}

/** Which alert to send now, or null. sent: { p80, p100 } markers for this month. At most one email per call. */
export function alertDue(level, sent = {}) {
  if (level === "over" && !sent.p100) return "p100";
  if (level === "warn" && !sent.p80 && !sent.p100) return "p80";
  return null;
}

/**
 * The month's report from the kept totals. Pure. rows: ai_spend rows; people: how many accounts used AI this month.
 * → { month, estimateUsd, projectedUsd, byKind[], byDay[], people, perPersonUsd, totals }
 */
export function spendReport({ rows = [], prices = DEFAULT_PRICES, nowMs = Date.now(), people = 0 } = {}) {
  const month = monthOf(nowMs), today = dayOf(nowMs), d = new Date(nowMs);
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1), daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const kinds = new Map(SPEND_KINDS.map((k) => [k, ZERO()])), days = new Map();
  for (let t = start; dayOf(t) <= today; t += DAY) days.set(dayOf(t), ZERO());
  const all = ZERO();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r.day !== "string" || !r.day.startsWith(`${month}-`) || r.day > today || !kinds.has(r.kind)) continue;
    addTo(kinds.get(r.kind), r); addTo(all, r); if (days.has(r.day)) addTo(days.get(r.day), r);
  }
  const estimateUsd = costOf(all, prices);
  const elapsed = Math.max(1, (nowMs - start) / DAY); // days of the month gone, at least one, so day 1 doesn't project wildly
  const n = Math.max(0, Math.round(Number(people) || 0));
  return {
    month, asOf: today, daysInMonth, estimateUsd: r4(estimateUsd), projectedUsd: r4(Math.max(estimateUsd, (estimateUsd / elapsed) * daysInMonth)), totals: all,
    byKind: [...kinds].map(([kind, t]) => ({ kind, label: KIND_LABEL[kind], ...t, usd: r4(costOf(t, prices)) })),
    byDay: [...days].map(([day, t]) => ({ day, requests: t.requests, usd: r4(costOf(t, prices)) })),
    people: n, perPersonUsd: n > 0 ? r4(estimateUsd / n) : null,
  };
}

/** The estimated cost of the rows between two UTC days (inclusive). For the weekly report. */
export const costBetween = (rows, from, to, prices) => r4(costOf((rows || []).filter((r) => r && typeof r.day === "string" && r.day >= from && r.day <= to && SPEND_KINDS.includes(r.kind)).reduce(addTo, ZERO()), prices));

const usd = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** { subject, text } of a budget alert. which: "p80" | "p100". Totals only. */
export function alertEmail(which, { month, estimateUsd, projectedUsd, budgetUsd }) {
  const pct = which === "p100" ? "100%" : "80%";
  return {
    subject: `Solia Health: the AI cost estimate has passed ${pct} of this month's budget`,
    text: [
      `The estimated AI cost for ${month} (UTC) is ${usd(estimateUsd)}, which has passed ${pct} of the monthly budget of ${usd(budgetUsd)}.`,
      `At this pace the month would end near ${usd(projectedUsd)}.`,
      "",
      ESTIMATE_LINE,
      NO_SHUTOFF_LINE,
      "",
      `You get this email once when the estimate first passes ${pct} of the budget in a month. Change the budget or the prices in the Solia Health partner portal (AI costs).`,
      "Totals only; no personal or health data.",
    ].join("\n"),
  };
}

export function mountSpend(router, { ctx, store, clock, reading, writing, owner, mailer, production, recipients }) {
  const { audit } = ctx.portal;
  const now = () => new Date(clock()).toISOString();
  const base = cleanPrices(ctx.config.ai?.prices);
  const model = () => String(process.env.AI_MODEL || ctx.config.ai?.model || DEFAULT_PRICES.model);
  const mail = mailer ? { ready: true, dev: false, send: (to, s, t) => mailer.send(to, s, t) }
    : production ? { ready: false, dev: false } : { ready: true, dev: true, send: async (to, s) => { console.log(`[cyra] insights (development, RESEND_API_KEY not set): the alert "${s}" was not emailed`); } };

  async function settings() {
    const row = await store.findOne("ai_spend_settings", (r) => r.key === "state");
    return { prices: row?.prices ? cleanPrices(row.prices, base) : base, pricesEditedAt: row?.prices ? row.pricesEditedAt || null : null, budgetUsd: Number(row?.budgetUsd) > 0 ? Number(row.budgetUsd) : null, budgetSetAt: row?.budgetSetAt || null, alerts: row?.alerts && typeof row.alerts === "object" ? row.alerts : {} };
  }
  const save = (fn) => store.apply("ai_spend_settings", (rows) => { let r = rows.find((x) => x.key === "state"); if (!r) { r = { key: "state", prices: null, pricesEditedAt: null, budgetUsd: null, budgetSetAt: null, alerts: {} }; rows.push(r); } return fn(r); });

  async function report() {
    const st = await settings(), t = clock(), month = monthOf(t);
    await ctx.aiSpend?.idle?.();
    const people = (await store.find("ai_usage", (r) => typeof r.id === "string" && r.id.endsWith(`:${month}`))).length;
    const rep = spendReport({ rows: await store.find("ai_spend"), prices: st.prices, nowMs: t, people });
    return { st, rep, budget: { ...budgetState(rep.estimateUsd, st.budgetUsd), setAt: st.budgetSetAt, alerts: { p80: st.alerts[month]?.p80 || null, p100: st.alerts[month]?.p100 || null } } };
  }
  /** What the Overview, the Readiness page and the weekly report show: the month's estimate against the budget. */
  async function state() {
    const { rep, budget } = await report();
    return { month: rep.month, estimateUsd: rep.estimateUsd, projectedUsd: rep.projectedUsd, budgetUsd: budget.budgetUsd, percent: budget.percent, level: budget.level };
  }

  /* ---------- the alert: once at 80%, once at 100%, per month ---------- */
  let checking = false;
  async function check() {
    if (checking) return null;
    checking = true;
    try {
      const { rep, budget } = await report();
      const which = alertDue(budget.level, budget.alerts);
      if (!which) return null;
      const to = await recipients();
      if (!mail.ready || !to.length) return null; // nothing to send with or to: the marker stays open
      const at = now();
      await save((r) => { r.alerts = { [rep.month]: { ...(r.alerts?.[rep.month] || {}), [which]: at } }; }); // claimed before sending; older months' markers are dropped
      const m = alertEmail(which, { month: rep.month, estimateUsd: rep.estimateUsd, projectedUsd: rep.projectedUsd, budgetUsd: budget.budgetUsd });
      let sent = 0, failed = 0;
      for (const addr of to) { try { await mail.send(addr, m.subject, m.text); sent++; } catch { failed++; } }
      if (failed) console.warn(`[cyra] insights: AI budget alert: ${failed} of ${to.length} not sent`);
      await audit("system", "AI budget alert", `ai-costs:${rep.month}`, { level: which === "p100" ? "100%" : "80%", sent, failed });
      return { which, sent, failed };
    } catch { console.warn("[cyra] insights: the AI budget could not be checked"); return null; }
    finally { checking = false; }
  }
  // The ai module calls this after each recorded request; at most one check a minute, and never in the request's way.
  let lastCheck = 0;
  ctx.onAiSpend = () => { const t = clock(); if (t - lastCheck < 60_000) return; lastCheck = t; Promise.resolve().then(check); };
  ctx.aiBudgetCheck = check; // tests
  ctx.aiSpendState = state;

  /* ---------- routes ---------- */
  const view = async () => {
    const { st, rep, budget } = await report();
    return { ...rep, estimate: true, estimateLine: ESTIMATE_LINE, noShutoffLine: NO_SHUTOFF_LINE, model: model(),
      prices: { ...st.prices, editedAt: st.pricesEditedAt, defaults: base, modelDiffers: model() !== st.prices.model }, budget, email: mail.ready ? (mail.dev ? "development" : "ready") : "not set up", keptDays: 400 };
  };
  router.get("/ai-costs", reading, owner, async (req, res) => { res.set("cache-control", "no-store"); res.json(await view()); });

  router.get("/ai-costs.csv", reading, owner, async (req, res) => {
    const st = await settings();
    await ctx.aiSpend?.idle?.();
    const rows = (await store.find("ai_spend", (r) => SPEND_KINDS.includes(r.kind) && typeof r.day === "string")).sort((a, b) => (a.day === b.day ? SPEND_KINDS.indexOf(a.kind) - SPEND_KINDS.indexOf(b.kind) : a.day < b.day ? 1 : -1));
    const lines = ["day_utc,kind,requests,input_tokens,output_tokens,cache_write_tokens,cache_read_tokens,web_searches,estimated_cost_usd"];
    for (const r of rows) { const t = addTo(ZERO(), r); lines.push([r.day, r.kind, t.requests, t.input, t.output, t.cacheWrite, t.cacheRead, t.searches, costOf(t, st.prices).toFixed(4)].join(",")); }
    res.set({ "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="solia-ai-costs.csv"', "cache-control": "no-store" });
    res.send(`${lines.join("\n")}\n`);
  });

  router.put("/ai-costs/prices", writing, owner, async (req, res) => {
    const b = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const unknown = Object.keys(b).filter((k) => !PRICE_FIELDS.includes(k) && k !== "reset");
    if (unknown.length) return res.status(400).json({ error: `unknown field: ${unknown.slice(0, 3).join(", ").slice(0, 60)}` });
    if (b.reset === true) { await save((r) => { r.prices = null; r.pricesEditedAt = null; }); await audit(req.portal.email, "AI prices reset", "ai-costs:prices", {}); return res.json(await view()); }
    const given = PRICE_FIELDS.filter((k) => k in b);
    if (!given.length) return res.status(400).json({ error: "send at least one price" });
    for (const k of given) { const v = b[k]; if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100_000) return res.status(400).json({ error: `${k} must be a number from 0 to 100000` }); }
    const cur = (await settings()).prices;
    await save((r) => { r.prices = { ...cur, ...Object.fromEntries(given.map((k) => [k, b[k]])) }; r.pricesEditedAt = now(); });
    await audit(req.portal.email, "AI prices", "ai-costs:prices", Object.fromEntries(given.map((k) => [k, b[k]])));
    res.json(await view());
    Promise.resolve().then(check);
  });

  router.put("/ai-costs/budget", writing, owner, async (req, res) => {
    const b = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    if (Object.keys(b).some((k) => k !== "usd") || !("usd" in b)) return res.status(400).json({ error: "send usd: a number, or null for no budget" });
    if (b.usd !== null && (typeof b.usd !== "number" || !Number.isFinite(b.usd) || b.usd <= 0 || b.usd > 1_000_000)) return res.status(400).json({ error: "usd must be a number above 0, at most 1000000, or null for no budget" });
    await save((r) => { r.budgetUsd = b.usd === null ? null : Math.round(b.usd * 100) / 100; r.budgetSetAt = now(); });
    await audit(req.portal.email, "AI budget", "ai-costs:budget", { usd: b.usd });
    res.json(await view());
    Promise.resolve().then(check);
  });

  /** For the weekly report: the estimate for the report's week and for its month so far, and the budget. */
  async function forWeek(week) {
    const st = await settings();
    await ctx.aiSpend?.idle?.();
    const rows = await store.find("ai_spend"), month = week.to.slice(0, 7);
    const monthUsd = costBetween(rows, `${month}-01`, `${month}-31`, st.prices), b = budgetState(monthUsd, st.budgetUsd);
    return { weekUsd: costBetween(rows, week.from, week.to, st.prices), monthUsd, budgetUsd: b.budgetUsd, budgetPercent: b.percent };
  }

  return { state, check, settings, forWeek };
}
