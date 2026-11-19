// Impact (impact.com) partner reporting, the ONLY place in the backend that knows its endpoints
// (docs/plans/tracking-reports.md Task 3).
//
// VERIFY AGAINST IMPACT'S CURRENT API DOCS BEFORE GO-LIVE. This container could not reach Impact's documentation, so
// every path, parameter and response field below is written from memory of the Impact "Mediapartners" (partner /
// publisher) REST API and must be checked (https://integrations.impact.com/impact-publisher/reference) before the owner
// relies on the numbers. Each endpoint is used in exactly one function below and mocked in
// backend/test/insights.test.mjs, scripts/insights-smoke.js and e2e/lib/impact.mjs.
//
//   GET /Mediapartners/{AccountSID}/Campaigns                          the brands (campaigns) this account has joined
//   GET /Mediapartners/{AccountSID}/Reports/{ReportId}?START_DATE=YYYY-MM-DD&END_DATE=YYYY-MM-DD&SUBAID={AccountSID}
//                                                                      performance by campaign: clicks, actions, sale
//                                                                      amount and earnings for the period
// Authentication: HTTP Basic, user = Account SID, password = Auth Token (Impact → Settings → API). "Accept:
// application/json". The report's id is the least certain part: IMPACT_REPORT_ID overrides the default below (not a
// secret; Impact → Reports → the "Performance by Campaign" report → its handle in the API link).
//
// Secrets: IMPACT_ACCOUNT_SID and IMPACT_AUTH_TOKEN, server only: never in the app, never in a VITE_ variable, never
// logged, never sent anywhere but Impact's API host, never returned to the portal. IMPACT_API_BASE is for tests only.
//
// Fails closed: without both variables the client reports { configured: false, missing: [names] } and every call throws
// ImpactError("not configured") before any request. Errors carry a fixed category (never the token, never a body).
// What comes back is business data about campaigns (totals); it holds nothing about any Solia Health user.

export const IMPACT_DEFAULT_BASE = "https://api.impact.com";
export const IMPACT_DEFAULT_REPORT = "mp_performance_by_campaign";
export const IMPACT_ENV = Object.freeze({ sid: "IMPACT_ACCOUNT_SID", token: "IMPACT_AUTH_TOKEN", report: "IMPACT_REPORT_ID", base: "IMPACT_API_BASE" });

/** Every endpoint path, built from validated parts only (verify against Impact's current API docs before go-live). */
export const IMPACT_PATHS = Object.freeze({
  campaigns: (sid) => `/Mediapartners/${encodeURIComponent(sid)}/Campaigns?PageSize=1000`,
  performanceByCampaign: (sid, reportId, start, end) => `/Mediapartners/${encodeURIComponent(sid)}/Reports/${encodeURIComponent(reportId)}?START_DATE=${encodeURIComponent(start)}&END_DATE=${encodeURIComponent(end)}&SUBAID=${encodeURIComponent(sid)}`,
});

export class ImpactError extends Error {
  constructor(cat, status = 0) { super(cat); this.cat = cat; this.status = status; }
}

const SID_RE = /^[A-Za-z0-9]{6,64}$/;
const REPORT_RE = /^[A-Za-z0-9_.-]{1,80}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const CAMPAIGN_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const key = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, "");
/** The first of `names` a record has (keys compared without case, spaces or underscores). */
const field = (rec, names) => { const m = new Map(Object.entries(rec || {}).map(([k, v]) => [key(k), v])); for (const n of names) if (m.has(n)) return m.get(n); return undefined; };
const num = (v) => { const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[$,\s]/g, "")); return Number.isFinite(n) && Math.abs(n) < 1e12 ? n : 0; };
const cents = (n) => Math.round(n * 100) / 100;

/** One report record → { campaignId, campaign, clicks, actions, saleAmount, commission } | null. */
export function performanceRow(rec) {
  const id = field(rec, ["campaignid", "programid", "advertiserid"]);
  const name = field(rec, ["campaign", "campaignname", "program", "programname", "brand", "advertiser"]);
  const campaignId = id == null ? "" : String(id).trim();
  if (!CAMPAIGN_ID_RE.test(campaignId) && !name) return null;
  return {
    campaignId: CAMPAIGN_ID_RE.test(campaignId) ? campaignId : "",
    campaign: String(name ?? campaignId).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80),
    clicks: Math.round(num(field(rec, ["clicks", "click", "uniqueclicks"]))),
    actions: Math.round(num(field(rec, ["actions", "sales", "conversions", "actioncount"]))),
    saleAmount: cents(num(field(rec, ["saleamount", "salesamount", "revenue", "amount"]))),
    commission: cents(num(field(rec, ["earnings", "payout", "commission", "totalearnings", "actioncost"]))),
  };
}

/** client({ env, fetchImpl, timeoutMs }) → { configured, missing, campaigns(), performance(start, end) }. */
export function impactClient({ env = process.env, fetchImpl = globalThis.fetch, timeoutMs = 15_000 } = {}) {
  const get = (k) => String(env[k] || "").trim();
  const sid = get(IMPACT_ENV.sid), token = get(IMPACT_ENV.token), reportId = get(IMPACT_ENV.report) || IMPACT_DEFAULT_REPORT;
  const base = (get(IMPACT_ENV.base) || IMPACT_DEFAULT_BASE).replace(/\/$/, "");
  const missing = [!sid && IMPACT_ENV.sid, !token && IMPACT_ENV.token].filter(Boolean);
  const configured = missing.length === 0 && SID_RE.test(sid) && REPORT_RE.test(reportId);

  async function call(path) {
    if (!configured) throw new ImpactError("not configured");
    let r;
    try {
      r = await fetchImpl(`${base}${path}`, { method: "GET", headers: { authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
    } catch { throw new ImpactError("Impact could not be reached"); }
    if (!r.ok) throw new ImpactError(r.status === 401 || r.status === 403 ? `Impact refused the account SID or token (${r.status})` : r.status === 404 ? "Impact answered 404 (check the report id)" : r.status === 429 ? "Impact is rate-limiting (429)" : `Impact answered ${r.status}`, r.status);
    try { return await r.json(); } catch { throw new ImpactError("Impact's answer could not be read"); }
  }

  return {
    configured, missing, reportId,
    /** [{ id, name }] — the campaigns (brands) this Impact account has joined. */
    async campaigns() {
      const j = await call(IMPACT_PATHS.campaigns(sid));
      const list = Array.isArray(j?.Campaigns) ? j.Campaigns : [];
      return list.map((c) => ({ id: String(c?.CampaignId ?? "").trim(), name: String(c?.CampaignName ?? c?.AdvertiserName ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80) })).filter((c) => CAMPAIGN_ID_RE.test(c.id)).slice(0, 1000);
    },
    /** [{ campaignId, campaign, clicks, actions, saleAmount, commission }] for start..end (UTC days, inclusive), one row per campaign. */
    async performance(start, end) {
      if (!DAY_RE.test(String(start)) || !DAY_RE.test(String(end)) || start > end) throw new ImpactError("not a date range");
      const j = await call(IMPACT_PATHS.performanceByCampaign(sid, reportId, start, end));
      const recs = Array.isArray(j?.Records) ? j.Records : [];
      const by = new Map();
      for (const rec of recs.slice(0, 5000)) {
        const row = performanceRow(rec);
        if (!row) continue;
        const k = row.campaignId || `name:${row.campaign.toLowerCase()}`;
        const cur = by.get(k);
        if (!cur) by.set(k, row);
        else { cur.clicks += row.clicks; cur.actions += row.actions; cur.saleAmount = cents(cur.saleAmount + row.saleAmount); cur.commission = cents(cur.commission + row.commission); }
      }
      return [...by.values()];
    },
  };
}
