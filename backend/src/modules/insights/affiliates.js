// Affiliate results for the portal's owners (docs/plans/tracking-reports.md Task 3): Solia Health's own shop taps next
// to what the affiliate networks report, per brand. OWNER ONLY, totals only, business data only.
//
//   GET    /api/insights/affiliates?days=7|30|90   per brand: Solia taps (shop module) beside Impact's clicks, actions
//                                                  (sales), sale amount and commission for the brand's campaign; campaigns
//                                                  not linked to a brand; totals; when Impact was last read; and the
//                                                  uploaded Amazon Associates totals for the same days
//   GET    /api/insights/impact/campaigns          the campaigns the Impact account has joined (to link one to a brand)
//   POST   /api/insights/amazon                    the Amazon Associates earnings report as CSV text (at most 1 MB): parsed
//                                                  to one total per day (amazon.js); days in the upload replace the same
//                                                  days already stored
//   DELETE /api/insights/amazon                    removes the uploaded totals
//
// Impact: every endpoint is in ./impact.js ("verify against Impact's current API docs before go-live"). Without
// IMPACT_ACCOUNT_SID and IMPACT_AUTH_TOKEN the page says "not configured" and names those variables, and no request is
// made. Answers are cached for 15 minutes (an error for 1 minute), so the page can't hammer Impact. The token is never
// logged or sent to a browser.
// A brand is linked to its Impact campaign by the brand's owner-only field `impactCampaignId` (shop module).
//
// Data (JSON store under DATA_DIR):
//   insights_amazon  { day, items, revenue, earnings } — one row per day of the uploaded report (no product, no ASIN)
//   insights_meta    { key: "amazon", uploadedAt, by, rows, skipped, from, to }
import express from "express";
import { ImpactError, IMPACT_ENV } from "./impact.js";
import { parseAmazonCsv, amazonTotals, AMAZON_CAPS } from "./amazon.js";
import { dayOf, sinceDay } from "./people.js";

export const IMPACT_TTL_MS = 15 * 60_000;
const ERROR_TTL_MS = 60_000;
export const WINDOWS = Object.freeze([7, 30, 90]);
const AMAZON_KEEP_DAYS = 800;
const cents = (n) => Math.round(n * 100) / 100;

/** brands (with impactCampaignId), tap totals by brand, Impact rows → { rows, unlinked, totals }. Pure. */
export function joinAffiliates(brands, tapsByBrand, impactRows) {
  const byCampaign = new Map((impactRows || []).filter((r) => r.campaignId).map((r) => [r.campaignId, r]));
  const used = new Set();
  const rows = [];
  for (const b of brands) {
    const taps = tapsByBrand.get(b.id) || 0;
    const camp = b.impactCampaignId ? byCampaign.get(b.impactCampaignId) || null : null;
    if (camp) used.add(camp.campaignId);
    if (!taps && !b.impactCampaignId) continue;
    rows.push({ brandId: b.id, brand: b.name, taps, campaignId: b.impactCampaignId || null, campaign: camp?.campaign || null, linked: !!b.impactCampaignId,
      clicks: camp ? camp.clicks : null, actions: camp ? camp.actions : null, saleAmount: camp ? camp.saleAmount : null, commission: camp ? camp.commission : null });
  }
  rows.sort((a, b) => (b.commission || 0) - (a.commission || 0) || b.taps - a.taps || a.brand.localeCompare(b.brand));
  const unlinked = (impactRows || []).filter((r) => !r.campaignId || !used.has(r.campaignId)).map((r) => ({ campaignId: r.campaignId || null, campaign: r.campaign, clicks: r.clicks, actions: r.actions, saleAmount: r.saleAmount, commission: r.commission }));
  const totals = { taps: rows.reduce((n, r) => n + r.taps, 0), clicks: 0, actions: 0, saleAmount: 0, commission: 0 };
  for (const r of impactRows || []) { totals.clicks += r.clicks; totals.actions += r.actions; totals.saleAmount = cents(totals.saleAmount + r.saleAmount); totals.commission = cents(totals.commission + r.commission); }
  return { rows, unlinked, totals };
}

export function mountAffiliates(router, { ctx, store, clock, reading, writing, owner, impact }) {
  const { audit } = ctx.portal;
  const now = () => new Date(clock()).toISOString();
  const windowOf = (req) => { const n = Number.parseInt(req.query.days, 10); return WINDOWS.includes(n) ? n : 30; };

  /* ---------- Impact, cached ---------- */
  const perf = new Map(); // "from|to" → { at, until, rows?, error? }
  /** { rows, error, fetchedAt } for from..to; never throws. force: read again unless the last read is under 30 s old. */
  async function impactPerformance(from, to, force = false) {
    if (!impact.configured) return { rows: [], error: null, fetchedAt: null };
    const t = clock(), k = `${from}|${to}`, hit = perf.get(k);
    if (!hit || hit.until <= t || (force && t - hit.at > 30_000)) {
      try { perf.set(k, { at: t, until: t + IMPACT_TTL_MS, rows: await impact.performance(from, to) }); }
      catch (e) { console.warn(`[cyra] insights: impact (${e instanceof ImpactError ? e.cat : "error"})`); perf.set(k, { at: t, until: t + ERROR_TTL_MS, rows: [], error: e instanceof ImpactError ? e.cat : "Impact could not be read" }); }
      for (const [key, v] of perf) if (v.until <= t - IMPACT_TTL_MS) perf.delete(key);
    }
    const c = perf.get(k);
    return { rows: c.rows || [], error: c.error || null, fetchedAt: new Date(c.at).toISOString() };
  }
  let campaignsCache = null;
  async function impactCampaigns() {
    if (!impact.configured) return { campaigns: [], error: null };
    const t = clock();
    if (!campaignsCache || campaignsCache.until <= t) {
      try { campaignsCache = { until: t + IMPACT_TTL_MS, campaigns: await impact.campaigns() }; }
      catch (e) { console.warn(`[cyra] insights: impact campaigns (${e instanceof ImpactError ? e.cat : "error"})`); campaignsCache = { until: t + ERROR_TTL_MS, campaigns: [], error: e instanceof ImpactError ? e.cat : "Impact could not be read" }; }
    }
    return { campaigns: campaignsCache.campaigns, error: campaignsCache.error || null };
  }
  const impactState = () => ({ configured: impact.configured, missing: impact.missing, env: { sid: IMPACT_ENV.sid, token: IMPACT_ENV.token, report: IMPACT_ENV.report } });

  async function amazonState(since) {
    const meta = await store.findOne("insights_meta", (m) => m.key === "amazon");
    if (!meta) return { uploaded: false };
    const days = await store.find("insights_amazon");
    return { uploaded: true, uploadedAt: meta.uploadedAt, rows: meta.rows, from: days.length ? days.reduce((a, d) => (d.day < a ? d.day : a), days[0].day) : null, to: days.length ? days.reduce((a, d) => (d.day > a ? d.day : a), days[0].day) : null, window: amazonTotals(days, since) };
  }

  router.get("/affiliates", reading, owner, async (req, res) => {
    const days = windowOf(req), t = clock(), from = sinceDay(days, t), to = dayOf(t);
    const taps = await ctx.portal.tapReport(days);
    const brands = await store.find("shop_brands");
    const im = await impactPerformance(from, to, req.query.refresh === "1");
    const joined = joinAffiliates(brands, new Map(taps.brands.map((b) => [b.brandId, b.taps])), im.rows);
    res.json({ days, from, to, impact: { ...impactState(), error: im.error, fetchedAt: im.fetchedAt, cachedMinutes: IMPACT_TTL_MS / 60_000 }, ...joined, amazon: await amazonState(from) });
  });

  router.get("/impact/campaigns", reading, owner, async (req, res) => res.json({ ...impactState(), ...(await impactCampaigns()) }));

  // The report is sent as text (text/csv), so the server's JSON parser never touches it; capped at 1 MB here.
  const csvBody = express.text({ type: () => true, limit: AMAZON_CAPS.bytes });
  router.post("/amazon", writing, owner, (req, res, next) => {
    if (req.body !== undefined && typeof req.body !== "string" && Object.keys(req.body || {}).length) return res.status(415).json({ error: "send the report as CSV text (content-type text/csv)" });
    csvBody(req, res, (err) => {
      if (err) return res.status(err.status === 413 || err.type === "entity.too.large" ? 413 : 400).json({ error: err.status === 413 || err.type === "entity.too.large" ? "the file is larger than 1 MB" : "the file could not be read" });
      next();
    });
  }, async (req, res) => {
    const parsed = parseAmazonCsv(typeof req.body === "string" ? req.body : "", { nowMs: clock() });
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const keepFrom = sinceDay(AMAZON_KEEP_DAYS, clock());
    await store.apply("insights_amazon", (rows) => {
      const fresh = new Set(parsed.days.map((d) => d.day));
      for (let i = rows.length - 1; i >= 0; i--) if (fresh.has(rows[i].day) || rows[i].day < keepFrom) rows.splice(i, 1);
      for (const d of parsed.days) if (d.day >= keepFrom) rows.push(d);
      rows.sort((a, b) => (a.day < b.day ? -1 : 1));
    });
    const meta = { key: "amazon", uploadedAt: now(), by: req.portal.email, rows: parsed.rows, skipped: parsed.skipped, from: parsed.from, to: parsed.to };
    await store.remove("insights_meta", (m) => m.key === "amazon");
    await store.insert("insights_meta", meta);
    await audit(req.portal.email, "upload amazon report", "affiliates:amazon", { rows: parsed.rows, skipped: parsed.skipped, from: parsed.from, to: parsed.to });
    res.status(201).json({ uploadedAt: meta.uploadedAt, rows: parsed.rows, skipped: parsed.skipped, days: parsed.days.length, from: parsed.from, to: parsed.to });
  });

  router.delete("/amazon", writing, owner, async (req, res) => {
    const n = await store.remove("insights_amazon", () => true);
    await store.remove("insights_meta", (m) => m.key === "amazon");
    await audit(req.portal.email, "remove amazon report", "affiliates:amazon", { days: n });
    res.sendStatus(204);
  });

  return { impactPerformance, amazonDays: () => store.find("insights_amazon"), amazonMeta: () => store.findOne("insights_meta", (m) => m.key === "amazon") };
}
