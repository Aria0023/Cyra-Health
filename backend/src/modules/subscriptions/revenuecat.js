// RevenueCat's REST API, the ONLY place in the backend that knows its endpoints (docs/plans/portal-subscriptions.md).
//
// VERIFY AGAINST REVENUECAT'S CURRENT API DOCS BEFORE GO-LIVE. This container could not reach RevenueCat's
// documentation, so every path, body and response field below is written from memory of API v1 / v2 and must be
// checked (https://www.revenuecat.com/docs/api-v1 and /api-v2) before the owner relies on it. Each one is used in
// exactly one function below and mocked in backend/test/subscriptions.test.mjs and scripts/subscriptions-smoke.js.
//
//   v2  GET  /v2/projects/{project_id}/metrics/overview                      the dashboard's overview numbers
//   v2  GET  /v2/projects/{project_id}/offerings?limit=…                     offering identifiers, for the promotion editor
//   v1  POST /v1/subscribers/{app_user_id}/entitlements/{entitlement}/promotional        body { duration }
//   v1  POST /v1/subscribers/{app_user_id}/entitlements/{entitlement}/revoke_promotionals
//
// Secrets: REVENUECAT_SECRET_KEY (a secret API key, server only: never in the app, never logged, never sent anywhere but
// RevenueCat's API host) and REVENUECAT_PROJECT_ID. If RevenueCat's v1 endpoints refuse the v2 key, set
// REVENUECAT_V1_SECRET_KEY to a v1 secret key and it is used for the two v1 calls instead. REVENUECAT_ENTITLEMENT is the
// entitlement the app checks ("pro", src/lib/pricing.js ENTITLEMENT). REVENUECAT_API_BASE is for tests only.
//
// Fails closed: without the key and project id the client reports { configured: false, missing: [names] } and every
// call throws RcError("not configured") before any request. Errors carry a fixed category (never the key, never a body).

export const RC_DEFAULT_BASE = "https://api.revenuecat.com";
export const RC_ENV = Object.freeze({ key: "REVENUECAT_SECRET_KEY", project: "REVENUECAT_PROJECT_ID", entitlement: "REVENUECAT_ENTITLEMENT", v1Key: "REVENUECAT_V1_SECRET_KEY", base: "REVENUECAT_API_BASE" });

/** The durations RevenueCat's v1 promotional call accepts that the portal offers, with their portal labels. */
export const RC_DURATIONS = Object.freeze({ weekly: "1 week", monthly: "1 month", three_month: "3 months", six_month: "6 months", yearly: "1 year", lifetime: "Lifetime" });

/** Every endpoint path, built from validated parts only (verify against RevenueCat's current API docs before go-live). */
export const RC_PATHS = Object.freeze({
  metricsOverview: (projectId) => `/v2/projects/${encodeURIComponent(projectId)}/metrics/overview`,
  offerings: (projectId) => `/v2/projects/${encodeURIComponent(projectId)}/offerings?limit=100`,
  grantPromotional: (appUserId, entitlement) => `/v1/subscribers/${encodeURIComponent(appUserId)}/entitlements/${encodeURIComponent(entitlement)}/promotional`,
  revokePromotional: (appUserId, entitlement) => `/v1/subscribers/${encodeURIComponent(appUserId)}/entitlements/${encodeURIComponent(entitlement)}/revoke_promotionals`,
});

/** The overview metric ids the portal shows, in order (v2 overview `metrics[].id`). */
export const RC_METRICS = Object.freeze(["active_subscriptions", "active_trials", "mrr", "revenue", "new_customers", "active_users", "churn"]);

export class RcError extends Error {
  constructor(cat, status = 0) { super(cat); this.cat = cat; this.status = status; }
}

const APP_USER_RE = /^[A-Za-z0-9_-]{8,64}$/;
const ID_RE = /^[A-Za-z0-9_.$-]{1,100}$/;

/** client({ env, fetchImpl, timeoutMs }) → { configured, missing, entitlement, metrics(), offerings(), grant(), revoke() }. */
export function revenueCat({ env = process.env, fetchImpl = globalThis.fetch, timeoutMs = 10_000 } = {}) {
  const get = (k) => String(env[k] || "").trim();
  const key = get(RC_ENV.key), project = get(RC_ENV.project), v1Key = get(RC_ENV.v1Key) || key;
  const entitlement = get(RC_ENV.entitlement) || "pro";
  const base = (get(RC_ENV.base) || RC_DEFAULT_BASE).replace(/\/$/, "");
  const missing = [!key && RC_ENV.key, !project && RC_ENV.project].filter(Boolean);
  const configured = missing.length === 0 && ID_RE.test(project) && ID_RE.test(entitlement);

  async function call(method, path, { body, secret = key } = {}) {
    if (!configured) throw new RcError("not configured");
    let r;
    try {
      r = await fetchImpl(`${base}${path}`, {
        method,
        headers: { authorization: `Bearer ${secret}`, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch { throw new RcError("RevenueCat could not be reached"); }
    if (!r.ok) throw new RcError(r.status === 401 || r.status === 403 ? `RevenueCat refused the key (${r.status})` : r.status === 404 ? "RevenueCat answered 404 (not found)" : r.status === 429 ? "RevenueCat is rate-limiting (429)" : `RevenueCat answered ${r.status}`, r.status);
    try { return await r.json(); } catch { throw new RcError("RevenueCat's answer could not be read"); }
  }

  return {
    configured, missing, entitlement,
    /** { metrics: [{ id, name, value, unit, period }], updatedAt } — only the ids in RC_METRICS that RevenueCat returns. */
    async metrics() {
      const j = await call("GET", RC_PATHS.metricsOverview(project));
      const list = Array.isArray(j?.metrics) ? j.metrics : [];
      const out = [];
      let updatedAt = null;
      for (const id of RC_METRICS) {
        const m = list.find((x) => x && x.id === id);
        if (!m || typeof m.value !== "number" || !Number.isFinite(m.value)) continue;
        out.push({ id, name: String(m.name || id).slice(0, 60), value: m.value, unit: String(m.unit || "").slice(0, 10), period: String(m.period || "").slice(0, 10) });
        const at = m.last_updated_at_iso8601 || (Number.isFinite(m.last_updated_at) ? new Date(m.last_updated_at).toISOString() : null);
        if (at && !Number.isNaN(Date.parse(at)) && (!updatedAt || at > updatedAt)) updatedAt = new Date(at).toISOString();
      }
      return { metrics: out, updatedAt };
    },
    /** [{ id: lookup_key, name }] — the offering identifiers the app asks the store for. */
    async offerings() {
      const j = await call("GET", RC_PATHS.offerings(project));
      const items = Array.isArray(j?.items) ? j.items : [];
      return items.map((o) => ({ id: String(o?.lookup_key || ""), name: String(o?.display_name || o?.lookup_key || "").slice(0, 80) })).filter((o) => ID_RE.test(o.id)).slice(0, 100);
    },
    /** Grants promotional access to the entitlement → { expiresAt: ISO|null }. */
    async grant(appUserId, duration) {
      if (!APP_USER_RE.test(String(appUserId))) throw new RcError("not an account id");
      if (!Object.hasOwn(RC_DURATIONS, duration)) throw new RcError("not a duration");
      const j = await call("POST", RC_PATHS.grantPromotional(appUserId, entitlement), { body: { duration }, secret: v1Key });
      const e = j?.subscriber?.entitlements?.[entitlement];
      const exp = e && typeof e.expires_date === "string" && !Number.isNaN(Date.parse(e.expires_date)) ? new Date(e.expires_date).toISOString() : null;
      return { expiresAt: exp };
    },
    /** Revokes every promotional grant of the entitlement for this app user (RevenueCat has no per-grant revoke). */
    async revoke(appUserId) {
      if (!APP_USER_RE.test(String(appUserId))) throw new RcError("not an account id");
      await call("POST", RC_PATHS.revokePromotional(appUserId, entitlement), { secret: v1Key });
      return { ok: true };
    },
  };
}
