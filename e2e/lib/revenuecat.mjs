/* A stand-in for RevenueCat's REST API for the portal e2e specs (docs/plans/portal-subscriptions.md Task 2): a local HTTP
   server on a free port of 127.0.0.1 answering the four endpoints backend/src/modules/subscriptions/revenuecat.js uses.
   The backend reaches it through REVENUECAT_API_BASE; nothing leaves the machine. `calls` records what it was sent. */
import http from "node:http";

export const RC_KEY = "sk_e2e_mock_secret_0123456789";
export async function startRevenueCat() {
  const calls = [];
  const srv = http.createServer((req, res) => {
    let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => {
      calls.push({ method: req.method, url: req.url, body: raw });
      const json = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
      if (req.headers.authorization !== `Bearer ${RC_KEY}`) return json(401, {});
      if (req.url === "/v2/projects/proje2e/metrics/overview") return json(200, { metrics: [
        { id: "active_subscriptions", name: "Active Subscriptions", value: 42, unit: "#", period: "P0D", last_updated_at_iso8601: "2026-11-15T09:00:00Z" },
        { id: "active_trials", name: "Active Trials", value: 7, unit: "#", period: "P0D" },
        { id: "mrr", name: "MRR", value: 315.5, unit: "$", period: "P28D" },
        { id: "revenue", name: "Revenue", value: 401.2, unit: "$", period: "P28D" },
        { id: "new_customers", name: "New Customers", value: 88, unit: "#", period: "P28D" }] });
      if (req.url.startsWith("/v2/projects/proje2e/offerings")) return json(200, { items: [{ lookup_key: "spring_clinic", display_name: "Spring clinic" }] });
      if (/^\/v1\/subscribers\/[A-Za-z0-9_-]+\/entitlements\/pro\/promotional$/.test(req.url)) return json(201, { subscriber: { entitlements: { pro: { expires_date: "2027-02-15T10:00:00Z" } } } });
      if (/^\/v1\/subscribers\/[A-Za-z0-9_-]+\/entitlements\/pro\/revoke_promotionals$/.test(req.url)) return json(200, { subscriber: {} });
      json(404, {});
    });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${srv.address().port}`;
  return { url, calls, env: { REVENUECAT_SECRET_KEY: RC_KEY, REVENUECAT_PROJECT_ID: "proje2e", REVENUECAT_API_BASE: url }, stop: () => new Promise((r) => srv.close(r)) };
}
