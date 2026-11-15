// Subscriptions smoke test (docs/plans/portal-subscriptions.md Task 1): a real production-mode server (NODE_ENV=production,
// real-looking secrets, ADMIN_EMAILS) with local mocks of RevenueCat's REST API (REVENUECAT_API_BASE) and Resend's
// (RESEND_API_BASE), on free ports, so the whole path runs end to end: the public live-promotions list, an owner's portal
// sign-in, the metrics dashboard, a promotion started and shown, a Pro grant to an app account (by its id, never its email)
// and its revoke, a code batch a partner downloads. Then the log: never the secret key, never an email address. Last, a
// production server without the RevenueCat variables says "not configured" and refuses grants before any request.
// Usage: node scripts/subscriptions-smoke.js
import http from "http";
import net from "net";
import fs from "fs";
import crypto from "crypto";
import { spawn } from "child_process";

const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok  ", m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const waitFor = async (url) => { for (let i = 0; i < 80; i++) { try { if ((await fetch(url)).ok) return; } catch { /* not yet */ } await sleep(100); } throw new Error("backend did not start"); };
const RC_KEY = `sk_smoke_${crypto.randomBytes(12).toString("hex")}`;

// mock Resend
const inbox = [];
const resend = http.createServer((req, res) => { let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => { if (req.url === "/emails" && req.headers.authorization === "Bearer re_test_key") { inbox.push(JSON.parse(raw)); res.writeHead(200, { "content-type": "application/json" }); return res.end("{\"id\":\"e\"}"); } res.writeHead(401); res.end(); }); });
// mock RevenueCat
const rcCalls = [];
const rc = http.createServer((req, res) => {
  let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => {
    rcCalls.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: raw });
    const json = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.headers.authorization !== `Bearer ${RC_KEY}`) return json(401, { message: "bad key" });
    if (req.url === "/v2/projects/projsmoke/metrics/overview") return json(200, { metrics: [{ id: "active_subscriptions", name: "Active Subscriptions", value: 12, unit: "#", period: "P0D", last_updated_at_iso8601: new Date().toISOString() }, { id: "mrr", name: "MRR", value: 99.5, unit: "$", period: "P28D" }] });
    if (req.url.startsWith("/v2/projects/projsmoke/offerings")) return json(200, { items: [{ lookup_key: "clinic_spring", display_name: "Clinic spring" }] });
    if (/^\/v1\/subscribers\/[A-Za-z0-9_-]+\/entitlements\/pro\/promotional$/.test(req.url)) return json(201, { subscriber: { entitlements: { pro: { expires_date: "2027-01-01T00:00:00Z" } } } });
    if (/^\/v1\/subscribers\/[A-Za-z0-9_-]+\/entitlements\/pro\/revoke_promotionals$/.test(req.url)) return json(200, { subscriber: {} });
    json(404, {});
  });
});
const [RP, CP, P, P2] = [await freePort(), await freePort(), await freePort(), await freePort()];
await new Promise((r) => resend.listen(RP, "127.0.0.1", r));
await new Promise((r) => rc.listen(CP, "127.0.0.1", r));

const DATA = `./data-subs-smoke-${process.pid}`;
const real = () => crypto.randomBytes(32).toString("hex");
const start = (env, port) => {
  let out = "";
  const proc = spawn("node", ["server.js"], { env: { ...process.env, NODE_ENV: "production", PORT: String(port), DATA_DIR: `${DATA}-${port}`, CYRA_CONFIG: "", ADMIN_KEY: real(), AUTH_SECRET: real(), ADMIN_EMAILS: "owner@solia.example", RESEND_API_KEY: "re_test_key", RESEND_API_BASE: `http://127.0.0.1:${RP}`, EMAIL_FROM: "Solia Health <portal@solia.example>", PUBLIC_BASE_URL: `http://127.0.0.1:${port}`, REVENUECAT_SECRET_KEY: "", REVENUECAT_PROJECT_ID: "", REVENUECAT_API_BASE: "", ...env }, stdio: ["ignore", "pipe", "pipe"] });
  proc.stdout.on("data", (d) => { out += d; }); proc.stderr.on("data", (d) => { out += d; });
  return { proc, log: () => out };
};
const caller = (base) => (method, path, body, token) => fetch(`${base}${path}`, { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
const lastCode = (to, re) => /(\d{6})/.exec(inbox.filter((m) => m.to[0] === to && re.test(m.subject)).at(-1)?.subject || "")?.[1];
async function portalIn(call, email) { await call("POST", "/api/shop/auth/start", { email }); await sleep(50); const r = await call("POST", "/api/shop/auth/verify", { email, code: lastCode(email, /portal/) }); return r.ok ? (await r.json()).token : null; }
async function appIn(call, email) { await call("POST", "/api/accounts/email/start", { email }); await sleep(50); const r = await call("POST", "/api/accounts/email/verify", { email, code: lastCode(email, /sign-in code/) }); return r.ok ? (await r.json()).account : null; }

const srv = start({ REVENUECAT_SECRET_KEY: RC_KEY, REVENUECAT_PROJECT_ID: "projsmoke", REVENUECAT_API_BASE: `http://127.0.0.1:${CP}` }, P);
try {
  const B = `http://127.0.0.1:${P}`, call = caller(B);
  await waitFor(`${B}/health`);
  assert(/module mounted: subscriptions/.test(srv.log()), "production: the subscriptions module is mounted");
  const pub0 = await fetch(`${B}/api/promotions/active`);
  assert(pub0.status === 200 && (await pub0.json()).promotions.length === 0 && pub0.headers.get("etag") && /max-age=300/.test(pub0.headers.get("cache-control") || ""), "public: no live promotion yet; ETag and Cache-Control");
  const owner = await portalIn(call, "owner@solia.example");
  assert(!!owner, "owner: signs in to the portal");
  const cfg = await (await call("GET", "/api/subscriptions/config", undefined, owner)).json();
  assert(cfg.configured === true && !JSON.stringify(cfg).includes(RC_KEY), "config: RevenueCat configured; the key is never sent to the portal");
  const m = await (await call("GET", "/api/subscriptions/metrics", undefined, owner)).json();
  assert(m.metrics.find((x) => x.id === "active_subscriptions")?.value === 12 && m.error === null, "metrics: read from RevenueCat's v2 overview");
  const off = await (await call("GET", "/api/subscriptions/offerings", undefined, owner)).json();
  assert(off.offerings[0]?.id === "clinic_spring", "offerings: the identifiers for the promotion editor");
  const t0 = Date.now();
  const pr = await (await call("POST", "/api/subscriptions/promotions", { name: "Clinic pilot", offeringId: "clinic_spring", platforms: ["ios", "android"], audience: { who: "everyone" }, startsAt: new Date(t0 - 60_000).toISOString(), endsAt: new Date(t0 + 86_400_000).toISOString(), banner: { title: "A spring offer", body: "A longer free trial on the yearly plan." } }, owner)).json();
  assert((await call("POST", `/api/subscriptions/promotions/${pr.promotion.id}/start`, {}, owner)).status === 200, "promotion: created and started");
  const pub1 = await (await fetch(`${B}/api/promotions/active`)).json();
  assert(pub1.promotions.length === 1 && pub1.promotions[0].offeringId === "clinic_spring" && !JSON.stringify(pub1).includes("Clinic pilot"), "public: the live promotion, without its internal name");
  // a Pro grant to an app account
  const acct = await appIn(call, "maya@clinic.example");
  assert(!!acct, "app: an account signs in");
  const g = await (await call("POST", "/api/subscriptions/grants", { emails: "maya@clinic.example", duration: "monthly" }, owner)).json();
  const gc = rcCalls.filter((c) => /promotional$/.test(c.url)).at(-1);
  assert(g.results?.[0]?.status === "granted" && gc.url === `/v1/subscribers/${acct.id}/entitlements/pro/promotional` && JSON.parse(gc.body).duration === "monthly" && !gc.body.includes("@"), "grant: RevenueCat gets her opaque account id and a duration, never her email");
  assert((await call("POST", `/api/subscriptions/grants/${g.results[0].id}/revoke`, {}, owner)).status === 200 && /revoke_promotionals$/.test(rcCalls.at(-1).url), "revoke: RevenueCat's revoke call");
  // codes
  assert((await call("POST", "/api/shop/invites", { email: "pat@oura.example", brandIds: ["oura"] }, owner)).status === 201, "owner: invites a partner");
  const b = await call("POST", "/api/subscriptions/codes/batches", { label: "Oura spring", platform: "ios", offerRef: "oura_spring", brandId: "oura", codes: "SMOKE-0001\nSMOKE-0002" }, owner);
  assert(b.status === 201, "codes: a batch uploaded and assigned to a partner's brand");
  const partner = await portalIn(call, "pat@oura.example");
  const csv = await (await call("GET", "/api/subscriptions/codes.csv", undefined, partner)).text();
  assert(/SMOKE-0001/.test(csv) && (await call("GET", "/api/subscriptions/metrics", undefined, partner)).status === 403 && (await call("GET", "/api/subscriptions/grants", undefined, partner)).status === 403, "partner: downloads its codes; metrics and grants are 403");
  // disk and log
  const log = srv.log();
  assert(!log.includes(RC_KEY) && !/@clinic\.example|@solia\.example|@oura\.example/.test(log), "log: no secret key and no email address");
  const disk = fs.readdirSync(`${DATA}-${P}`).filter((f) => f.startsWith("subs_")).map((f) => fs.readFileSync(`${DATA}-${P}/${f}`, "utf8")).join("\n");
  assert(!disk.includes(RC_KEY) && !/"(symptoms|mood|days|stage|cycleLen|lastPeriod)"\s*:/.test(disk), "disk: no key and no health field");
} finally { srv.proc.kill(); }

// production without the RevenueCat variables: fails closed
{
  const s2 = start({}, P2);
  try {
    const B = `http://127.0.0.1:${P2}`, call = caller(B);
    await waitFor(`${B}/health`);
    const owner = await portalIn(call, "owner@solia.example");
    const m = await (await call("GET", "/api/subscriptions/metrics", undefined, owner)).json();
    const n = rcCalls.length;
    const g = await call("POST", "/api/subscriptions/grants", { emails: "maya@clinic.example", duration: "monthly" }, owner);
    assert(m.configured === false && m.missing.join() === "REVENUECAT_SECRET_KEY,REVENUECAT_PROJECT_ID" && g.status === 503 && rcCalls.length === n, "without RevenueCat's variables: \"not configured\" names them; grants refused before any request");
    assert((await fetch(`${B}/api/promotions/active`)).status === 200, "without RevenueCat's variables: the public promotions list still answers");
  } finally { s2.proc.kill(); }
}
resend.close(); rc.close();
await sleep(200);
for (const p of [P, P2]) fs.rmSync(`${DATA}-${p}`, { recursive: true, force: true });
console.log(process.exitCode ? "SUBSCRIPTIONS SMOKE: FAILURES" : "SUBSCRIPTIONS SMOKE: all passed");
