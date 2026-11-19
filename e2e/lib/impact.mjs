/* A stand-in for Impact's partner API for the portal e2e specs (docs/plans/tracking-reports.md Task 3): a local HTTP server
   on a free port of 127.0.0.1 answering the two endpoints backend/src/modules/insights/impact.js uses. The backend
   reaches it through IMPACT_API_BASE; nothing leaves the machine. `calls` records what it was sent. */
import http from "node:http";

export const IMPACT_SID = "IRe2eAccountSid0123";
export const IMPACT_TOKEN = "e2e_impact_auth_token_0123456789";
export async function startImpact() {
  const calls = [];
  const basic = `Basic ${Buffer.from(`${IMPACT_SID}:${IMPACT_TOKEN}`).toString("base64")}`;
  const srv = http.createServer((req, res) => {
    calls.push({ method: req.method, url: req.url });
    const json = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.headers.authorization !== basic) return json(401, {});
    if (req.url.startsWith(`/Mediapartners/${IMPACT_SID}/Campaigns`)) return json(200, { Campaigns: [{ CampaignId: "1001", CampaignName: "Oura" }, { CampaignId: "1002", CampaignName: "Mira Fertility" }, { CampaignId: "1003", CampaignName: "Everlywell" }] });
    if (req.url.startsWith(`/Mediapartners/${IMPACT_SID}/Reports/`)) return json(200, { Records: [
      { CampaignId: "1001", Campaign: "Oura", Clicks: "120", Actions: "6", SaleAmount: "1794.00", Earnings: "143.52" },
      { CampaignId: "1002", Campaign: "Mira Fertility", Clicks: "40", Actions: "2", SaleAmount: "398.00", Earnings: "39.80" },
      { CampaignId: "1003", Campaign: "Everlywell", Clicks: "15", Actions: "0", SaleAmount: "0", Earnings: "0" }] });
    json(404, {});
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${srv.address().port}`;
  return { url, calls, env: { IMPACT_ACCOUNT_SID: IMPACT_SID, IMPACT_AUTH_TOKEN: IMPACT_TOKEN, IMPACT_API_BASE: url }, stop: () => new Promise((r) => srv.close(r)) };
}
