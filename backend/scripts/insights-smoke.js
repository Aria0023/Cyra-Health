// Insights smoke test (docs/plans/tracking-reports.md): a real production-mode server (NODE_ENV=production, real-looking
// secrets, ADMIN_EMAILS) with local mocks of Impact's partner API (IMPACT_API_BASE) and Resend's (RESEND_API_BASE), on
// free ports, so the whole path runs end to end: an app account signs in and its day is noted, an owner's portal sign-in,
// the People counts, shop taps beside Impact's numbers on the Affiliates answer, an Amazon Associates report upload, and
// the weekly report previewed and sent (the plain template: no AI key here).
// Then the log and the disk: never the Impact token, never an email address in the log, totals only on disk. Last, a
// production server without the Impact variables says "not configured", names them, and makes no request.
// Usage: node scripts/insights-smoke.js
import http from "http";
import net from "net";
import fs from "fs";
import crypto from "crypto";
import { spawn } from "child_process";

const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok  ", m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const waitFor = async (url) => { for (let i = 0; i < 80; i++) { try { if ((await fetch(url)).ok) return; } catch { /* not yet */ } await sleep(100); } throw new Error("backend did not start"); };
const SID = "IRsmokeAccountSid01", TOKEN = `smoke_${crypto.randomBytes(12).toString("hex")}`;

// mock Resend
const inbox = [];
const resend = http.createServer((req, res) => { let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => { if (req.url === "/emails" && req.headers.authorization === "Bearer re_test_key") { inbox.push(JSON.parse(raw)); res.writeHead(200, { "content-type": "application/json" }); return res.end("{\"id\":\"e\"}"); } res.writeHead(401); res.end(); }); });
// mock Impact
const imCalls = [];
const impact = http.createServer((req, res) => {
  imCalls.push({ method: req.method, url: req.url, auth: req.headers.authorization });
  const json = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (req.headers.authorization !== `Basic ${Buffer.from(`${SID}:${TOKEN}`).toString("base64")}`) return json(401, { Message: "bad credentials" });
  if (req.url.startsWith(`/Mediapartners/${SID}/Campaigns`)) return json(200, { Campaigns: [{ CampaignId: "1001", CampaignName: "Oura" }] });
  if (req.url.startsWith(`/Mediapartners/${SID}/Reports/mp_performance_by_campaign?`)) return json(200, { Records: [{ CampaignId: "1001", Campaign: "Oura", Clicks: "120", Actions: "6", SaleAmount: "1794.00", Earnings: "143.52" }, { CampaignId: "1002", Campaign: "Mira Fertility", Clicks: "40", Actions: "2", SaleAmount: "398.00", Earnings: "39.80" }] });
  json(404, {});
});
const [RP, IP, P, P2] = [await freePort(), await freePort(), await freePort(), await freePort()];
await new Promise((r) => resend.listen(RP, "127.0.0.1", r));
await new Promise((r) => impact.listen(IP, "127.0.0.1", r));

const DATA = `./data-insights-smoke-${process.pid}`;
const real = () => crypto.randomBytes(32).toString("hex");
const start = (env, port) => {
  let out = "";
  const proc = spawn("node", ["server.js"], { env: { ...process.env, NODE_ENV: "production", PORT: String(port), DATA_DIR: `${DATA}-${port}`, CYRA_CONFIG: "", ADMIN_KEY: real(), AUTH_SECRET: real(), ADMIN_EMAILS: "owner@solia.example", RESEND_API_KEY: "re_test_key", RESEND_API_BASE: `http://127.0.0.1:${RP}`, EMAIL_FROM: "Solia Health <portal@solia.example>", PUBLIC_BASE_URL: `http://127.0.0.1:${port}`, ANTHROPIC_API_KEY: "", REVENUECAT_SECRET_KEY: "", REVENUECAT_PROJECT_ID: "", IMPACT_ACCOUNT_SID: "", IMPACT_AUTH_TOKEN: "", IMPACT_API_BASE: "", IMPACT_REPORT_ID: "", ...env }, stdio: ["ignore", "pipe", "pipe"] });
  proc.stdout.on("data", (d) => { out += d; }); proc.stderr.on("data", (d) => { out += d; });
  return { proc, log: () => out };
};
const caller = (base) => (method, path, body, token, headers = {}) => fetch(`${base}${path}`, { method, headers: { ...(body !== undefined && typeof body !== "string" ? { "content-type": "application/json" } : {}), ...(typeof body === "string" ? { "content-type": "text/csv" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
const lastCode = (to, re) => /(\d{6})/.exec(inbox.filter((m) => m.to[0] === to && re.test(m.subject)).at(-1)?.subject || "")?.[1];
async function portalIn(call, email) { await call("POST", "/api/shop/auth/start", { email }); await sleep(50); const r = await call("POST", "/api/shop/auth/verify", { email, code: lastCode(email, /portal/) }); return r.ok ? (await r.json()).token : null; }
async function appIn(call, email) { await call("POST", "/api/accounts/email/start", { email }); await sleep(50); const r = await call("POST", "/api/accounts/email/verify", { email, code: lastCode(email, /sign-in code/) }); return r.ok ? r.json() : null; }
const today = new Date().toISOString().slice(0, 10);

const srv = start({ IMPACT_ACCOUNT_SID: SID, IMPACT_AUTH_TOKEN: TOKEN, IMPACT_API_BASE: `http://127.0.0.1:${IP}` }, P);
try {
  const B = `http://127.0.0.1:${P}`, call = caller(B);
  await waitFor(`${B}/health`);
  assert(/module mounted: insights/.test(srv.log()), "production: the insights module is mounted");
  // people
  const maya = await appIn(call, "maya@clinic.example");
  await appIn(call, "noor@clinic.example");
  assert(!!maya && maya.account.lastSeenDay === undefined && (await call("GET", "/api/accounts/me", undefined, maya.token)).status === 200, "app: two accounts sign in; GET /me answers; the app is never sent the last day used");
  const acctDisk = JSON.parse(fs.readFileSync(`${DATA}-${P}/accounts.json`, "utf8"));
  assert(acctDisk.length === 2 && acctDisk.every((a) => a.lastSeenDay === today && !/T\d\d:/.test(a.lastSeenDay)), "accounts: each keeps the last day it was used, a date with no time");
  const owner = await portalIn(call, "owner@solia.example");
  assert(!!owner, "owner: signs in to the portal");
  const pr = await call("GET", "/api/insights/people", undefined, owner);
  const people = await pr.text(), pj = JSON.parse(people);
  assert(pr.status === 200 && pj.total === 2 && pj.active1 === 2 && pj.new7 === 2 && pj.byProvider.email === 2 && pj.newByDay.length === 30, "people: counts of accounts, new and used, by sign-in method");
  assert(!/@|maya|noor/.test(people) && !people.includes(maya.account.id), "people: counts only — no email, no account id");
  // affiliates
  for (const id of ["oura", "oura", "mira"]) await call("POST", "/api/shop/tap", { productId: id });
  assert((await call("PATCH", "/api/shop/brands/oura", { impactCampaignId: "1001" }, owner)).status === 200 && !(await (await fetch(`${B}/api/shop/catalog`)).text()).includes("impactCampaignId"), "owner: links a brand to its Impact campaign; the link is never in the public catalog");
  const ar = await call("GET", "/api/insights/affiliates?days=7", undefined, owner);
  const aText = await ar.text(), a = JSON.parse(aText);
  const oura = a.rows.find((r) => r.brandId === "oura");
  assert(ar.status === 200 && a.impact.configured === true && a.impact.error === null && oura.taps === 2 && oura.clicks === 120 && oura.actions === 6 && oura.commission === 143.52 && a.totals.taps === 3 && a.totals.commission === 183.32 && a.unlinked.length === 1, "affiliates: Solia taps beside Impact's clicks, sales and commission per brand, with totals");
  const ic = imCalls.at(-1);
  assert(ic.method === "GET" && new RegExp(`^/Mediapartners/${SID}/Reports/mp_performance_by_campaign\\?START_DATE=\\d{4}-\\d{2}-\\d{2}&END_DATE=${today}&SUBAID=${SID}$`).test(ic.url), "impact: one GET to the performance-by-campaign report for the period, with Basic auth");
  const n1 = imCalls.length;
  await call("GET", "/api/insights/affiliates?days=7", undefined, owner);
  assert(imCalls.length === n1 && !aText.includes(TOKEN), "affiliates: cached (no second request); the token is never sent to the portal");
  const up = await call("POST", "/api/insights/amazon", `Fee-Earnings reports\nCategory,Name,Date Shipped,Items Shipped,Revenue($),Ad Fees($)\nHealth,"LH strips, 50 ct",${today} 00:00:00,2,39.98,1.60\nHealth,Thermometer,${today},1,9.99,0.40\n`, owner);
  const az = (await (await call("GET", "/api/insights/affiliates?days=7", undefined, owner)).json()).amazon;
  assert(up.status === 201 && az.uploaded === true && az.window.items === 3 && az.window.revenue === 49.97 && az.window.earnings === 2, "amazon: the uploaded earnings report becomes per-day totals");
  assert((await call("POST", "/api/insights/amazon", "not a report", owner)).status === 400, "amazon: a file that isn't the report is refused");
  // the weekly report (Task 4): no ANTHROPIC_API_KEY here, so the plain template; sent through Resend to the owners
  const ws = await (await call("GET", "/api/insights/weekly", undefined, owner)).json();
  assert(ws.enabled === true && ws.recipients.join() === "owner@solia.example" && ws.email === "ready" && ws.ai === false && /T14:00:00\.000Z$/.test(ws.nextAt) && new Date(ws.nextAt).getUTCDay() === 1, "weekly: on by default, to ADMIN_EMAILS, next on a Monday at 14:00 UTC; AI not set up here");
  const pv = await (await call("POST", "/api/insights/weekly/preview", {}, owner)).json();
  assert(pv.writer === "template" && /ANTHROPIC_API_KEY/.test(pv.why) && pv.text.includes("Totals only; no personal or health data.") && pv.text.includes("- Accounts: 2 in all") && !/@|maya|noor/.test(pv.text), "weekly preview: the plain template with the totals; no address or name in it");
  const before = inbox.length;
  const sn = await call("POST", "/api/insights/weekly/send", { previewId: pv.id }, owner);
  const mailed = inbox.slice(before);
  assert(sn.status === 200 && mailed.length === 1 && mailed[0].to.join() === "owner@solia.example" && mailed[0].subject === pv.subject && mailed[0].text === pv.text && mailed[0].from.includes("portal@solia.example"), "weekly send now: Resend gets exactly the previewed text, for the owner");
  assert((await call("PUT", "/api/insights/weekly", { enabled: false }, owner)).status === 200 && (await (await call("GET", "/api/insights/weekly", undefined, owner)).json()).nextAt === null, "weekly: an owner can turn it off");
  // a partner and a stranger
  await call("POST", "/api/shop/invites", { email: "pat@oura.example", brandIds: ["oura"] }, owner);
  const partner = await portalIn(call, "pat@oura.example");
  const pst = [];
  for (const p of ["/api/insights/people", "/api/insights/affiliates", "/api/insights/weekly"]) pst.push((await call("GET", p, undefined, partner)).status, (await call("GET", p)).status, (await call("GET", p, undefined, maya.token)).status);
  assert(pst.join() === "403,401,401,403,401,401,403,401,401" && (await call("GET", "/api/shop/taps?days=7", undefined, partner)).status === 200, "owner only: a partner gets 403, no sign-in and an app session get 401; the partner still reads its own brands' taps");
  // disk and log
  const log = srv.log();
  assert(!log.includes(TOKEN) && !log.includes(SID) && !/@clinic\.example|@solia\.example|@oura\.example/.test(log), "log: no Impact token or SID and no email address");
  assert(!log.includes("Accounts: 2 in all") && !log.includes("weekly report:"), "log: nothing of the weekly report's text");
  const disk = fs.readdirSync(`${DATA}-${P}`).filter((f) => f.startsWith("insights_") || f === "shop_taps.json").map((f) => fs.readFileSync(`${DATA}-${P}/${f}`, "utf8")).join("\n");
  assert(!disk.includes(TOKEN) && !/strips|Thermometer|clinic\.example/.test(disk) && !/"(symptoms|mood|days|stage|cycleLen|lastPeriod)"\s*:/.test(disk), "disk: totals only — no token, no product names from the Amazon report, no account, no health field");
} finally { srv.proc.kill(); }

// production without the Impact variables: fails closed
{
  const s2 = start({}, P2);
  try {
    const B = `http://127.0.0.1:${P2}`, call = caller(B);
    await waitFor(`${B}/health`);
    const owner = await portalIn(call, "owner@solia.example");
    const n = imCalls.length;
    const a = await (await call("GET", "/api/insights/affiliates", undefined, owner)).json();
    const c = await (await call("GET", "/api/insights/impact/campaigns", undefined, owner)).json();
    assert(a.impact.configured === false && a.impact.missing.join() === "IMPACT_ACCOUNT_SID,IMPACT_AUTH_TOKEN" && c.configured === false && c.campaigns.length === 0 && imCalls.length === n, "without Impact's variables: \"not configured\" names them, and no request is made");
    assert((await call("GET", "/api/insights/people", undefined, owner)).status === 200, "without Impact's variables: People still answers");
  } finally { s2.proc.kill(); }
}
// with an AI key: the weekly summary goes through the ai module's client (the official SDK) to a mock Anthropic
{
  const seen = [];
  const anthropic = http.createServer((req, res) => {
    let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => {
      const body = JSON.parse(raw); seen.push({ url: req.url, headers: req.headers, body });
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ id: "msg_mock", type: "message", role: "assistant", model: body.model, stop_reason: "end_turn", stop_sequence: null, content: [{ type: "thinking", thinking: "", signature: "s" }, { type: "text", text: "One account was made this week. The Shop was opened once. Nothing else stands out." }], usage: { input_tokens: 1, output_tokens: 1 } }));
    });
  });
  const [AP, P3] = [await freePort(), await freePort()];
  await new Promise((r) => anthropic.listen(AP, "127.0.0.1", r));
  const s3 = start({ ANTHROPIC_API_KEY: "sk-ant-test", ANTHROPIC_BASE_URL: `http://127.0.0.1:${AP}` }, P3);
  try {
    const B = `http://127.0.0.1:${P3}`, call = caller(B);
    await waitFor(`${B}/health`);
    await appIn(call, "ines@clinic.example");
    await call("POST", "/api/shop/tap", { productId: "oura" });
    const owner = await portalIn(call, "owner@solia.example");
    const pv = await (await call("POST", "/api/insights/weekly/preview", {}, owner)).json();
    const q = seen.at(-1);
    assert(pv.writer === "claude" && pv.why === null && pv.text.includes("One account was made this week.") && pv.text.includes("THE NUMBERS") && pv.text.includes("Totals only; no personal or health data.") && /written by Claude \(Anthropic\)/.test(pv.text), "weekly with a key: Claude's summary above the same numbers, and the email says who wrote it");
    assert(seen.length === 1 && q.url.startsWith("/v1/messages") && /server-side-fallback-2026-07-01/.test(q.headers["anthropic-beta"] || "") && q.body.fallbacks === "default" && q.body.output_config?.effort === "low" && !("thinking" in q.body) && !("temperature" in q.body) && q.body.model === "claude-opus-5-5", "anthropic: one request with the configured model, effort low, no thinking parameter, the refusal fallback on");
    const content = String(q.body.messages[0].content), given = JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1));
    assert(given.people.total === 1 && given.shop && given.unusual && !/@|\bines\b|clinic\.example|acct_/.test(content + String(q.body.system)), "anthropic: it is sent the totals JSON only — no address, name or account id");
    assert(!s3.log().includes("One account was made") && !s3.log().includes("sk-ant-test"), "log: neither the summary nor the key");
  } finally { s3.proc.kill(); anthropic.close(); fs.rmSync(`${DATA}-${P3}`, { recursive: true, force: true }); }
}
resend.close(); impact.close();
await sleep(200);
for (const p of [P, P2]) fs.rmSync(`${DATA}-${p}`, { recursive: true, force: true });
console.log(process.exitCode ? "INSIGHTS SMOKE: FAILURES" : "INSIGHTS SMOKE: all passed");
