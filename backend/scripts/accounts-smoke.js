// Accounts smoke test (Task 1, sign-in required): a real development server pointed at the local mock identity
// provider (OAUTH_MOCK_BASE) and a local mock of Resend's HTTPS API (RESEND_API_BASE), so both sign-in paths run end to
// end: Google and Facebook through /api/oauth/:id/start → callback → POST /api/accounts/provider, and email through
// /email/start → the mock inbox → /email/verify. Then /me, sign-out, delete, and what is on disk (no health field, no raw
// provider account id) and in the log (never the code or the email when a key is set). Last, a development server
// without RESEND_API_KEY logs the code and says dev, and a production server without it reports email off.
// Usage: node scripts/accounts-smoke.js
import http from "http";
import fs from "fs";
import { spawn } from "child_process";
import crypto from "crypto";
import { startMockProvider } from "./mock-oauth-provider.js";

const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok  ", m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch { /* not yet */ } await sleep(100); } throw new Error("backend did not start"); };

// --- a mock of Resend's POST /emails ---
const inbox = [];
const resend = http.createServer((req, res) => {
  let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => {
    if (req.method === "POST" && req.url === "/emails" && req.headers.authorization === "Bearer re_test_key") {
      const b = JSON.parse(raw); inbox.push(b);
      res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ id: "email_1" }));
    }
    res.writeHead(401); res.end();
  });
});
await new Promise((r) => resend.listen(3997, r));
const mock = await startMockProvider(3996);

const DATA = "./data-accounts-smoke";
fs.rmSync(DATA, { recursive: true, force: true });
const start = (env, port) => {
  let out = "";
  const proc = spawn("node", ["server.js"], { env: { ...process.env, PORT: String(port), PUBLIC_BASE_URL: `http://127.0.0.1:${port}`, CORS_ORIGIN: "https://app.example", RETURN_ORIGINS: "", APP_RETURN_SCHEMES: "", DATA_DIR: DATA, CYRA_CONFIG: "", ...env }, stdio: ["ignore", "pipe", "pipe"] });
  proc.stdout.on("data", (d) => { out += d; }); proc.stderr.on("data", (d) => { out += d; });
  return { proc, log: () => out };
};
const B = "http://127.0.0.1:3104", RET = "https://app.example/";
const srv = start({ NODE_ENV: "", OAUTH_MOCK_BASE: mock.base, AUTH_SECRET: "accounts-smoke-secret-0123456789", RESEND_API_KEY: "re_test_key", RESEND_API_BASE: "http://127.0.0.1:3997", EMAIL_FROM: "Solia Health <signin@solia.example>" }, 3104);
const jpost = (path, body, token) => fetch(`${B}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const go = (url, init) => fetch(url, { redirect: "manual", ...init });
try {
  await waitFor(`${B}/health`);
  assert(/module mounted: accounts/.test(srv.log()), "development: the accounts module is mounted");
  const cfg = await (await fetch(`${B}/api/accounts/config`)).json();
  assert(cfg.providers.apple && cfg.providers.google && cfg.providers.facebook && cfg.providers.email, `config: every sign-in works here (${JSON.stringify(cfg.providers)})`);

  // --- email ---
  const s = await jpost("/api/accounts/email/start", { email: "Maya@Example.com" });
  const sj = await s.json();
  assert(s.status === 200 && sj.sent === true && !sj.dev, "email: a code is sent (no dev flag with a key)");
  const mail = inbox.at(-1);
  const code = /(\d{6})/.exec(mail?.text || "")?.[1];
  assert(mail && mail.to[0] === "maya@example.com" && mail.from.includes("signin@solia.example") && code, "email: Resend got one message to the normalised address with a 6-digit code");
  const v = await jpost("/api/accounts/email/verify", { email: "maya@example.com", code });
  const vj = await v.json();
  assert(v.status === 200 && vj.token && vj.account.provider === "email" && vj.account.email === "maya@example.com", "email: the code signs her in");
  const me = await (await fetch(`${B}/api/accounts/me`, { headers: { authorization: `Bearer ${vj.token}` } })).json();
  assert(me.account.id === vj.account.id, "me: the token names the account");

  // --- Google and Facebook through the oauth module ---
  for (const id of ["google", "facebook"]) {
    const r = await go(`${B}/api/oauth/${id}/start?return=${encodeURIComponent(RET)}`);
    const cb = await go((await go(r.headers.get("location"))).headers.get("location"));
    const handoff = (cb.headers.get("location") || "").split("#oauth=")[1];
    const p = await jpost("/api/accounts/provider", { code: handoff });
    const pj = await p.json();
    assert(p.status === 200 && pj.account.provider === id && pj.token, `${id}: the one-time code completes sign-in`);
    assert(id === "google" ? pj.account.email === "ada@google.example" && pj.account.name === "Ada Lovelace" : pj.account.email === "" && pj.account.name === "Ada Lovelace", `${id}: ${id === "google" ? "the verified email and name are kept" : "no email is kept (no verified signal), the name is"}`);
    assert((await jpost("/api/accounts/provider", { code: handoff })).status === 404, `${id}: the code can't be used twice`);
    assert((await jpost("/api/oauth/exchange", { code: handoff })).status === 404, `${id}: and the prefill exchange can't reuse it either`);
    // sign in again: the same account
    const r2 = await go(`${B}/api/oauth/${id}/start?return=${encodeURIComponent(RET)}`);
    const cb2 = await go((await go(r2.headers.get("location"))).headers.get("location"));
    const again = await (await jpost("/api/accounts/provider", { code: (cb2.headers.get("location") || "").split("#oauth=")[1] })).json();
    assert(again.account.id === pj.account.id, `${id}: signing in again finds the same account`);
    if (id === "facebook") {
      assert((await jpost("/api/accounts/sign-out", {}, again.token)).status === 204, "sign-out answers 204");
      assert((await fetch(`${B}/api/accounts/me`, { headers: { authorization: `Bearer ${again.token}` } })).status === 401, "the signed-out token stops working");
      assert((await fetch(`${B}/api/accounts/me`, { headers: { authorization: `Bearer ${pj.token}` } })).status === 200, "the other session stays");
      assert((await fetch(`${B}/api/accounts/me`, { method: "DELETE", headers: { authorization: `Bearer ${pj.token}` } })).status === 204, "delete answers 204");
      assert((await fetch(`${B}/api/accounts/me`, { headers: { authorization: `Bearer ${pj.token}` } })).status === 401, "a deleted account's token stops working");
    }
  }
  // CORS preflight for the bearer header and DELETE
  const pre = await fetch(`${B}/api/accounts/me`, { method: "OPTIONS", headers: { origin: "https://app.example", "access-control-request-method": "DELETE", "access-control-request-headers": "authorization" } });
  assert(pre.status === 204 && /DELETE/.test(pre.headers.get("access-control-allow-methods") || "") && /authorization/.test(pre.headers.get("access-control-allow-headers") || ""), "CORS: the app's origin may send DELETE with Authorization");

  // --- disk and log ---
  const disk = fs.readFileSync(`${DATA}/accounts.json`, "utf8") + fs.readFileSync(`${DATA}/account_sessions.json`, "utf8");
  const accts = JSON.parse(fs.readFileSync(`${DATA}/accounts.json`, "utf8"));
  assert(accts.length === 2 && accts.every((a) => Object.keys(a).sort().join() === "createdAt,email,id,key,name,provider"), `disk: two accounts left (email, google), each only id/provider/key/email/name/createdAt`);
  assert(!disk.includes("sub-1") && !disk.includes("fb1") && !disk.includes(code) && !disk.includes(vj.token), "disk: no raw provider account id, no code, no token");
  assert(!srv.log().includes("maya@example.com") && !srv.log().includes(code) && !srv.log().includes("ada@"), "log: no email address and no code");
} finally {
  srv.proc.kill();
}

// --- development without a key: the code goes to the console and the app is told so ---
{
  const d = start({ NODE_ENV: "", AUTH_SECRET: "accounts-smoke-secret-0123456789", RESEND_API_KEY: "", EMAIL_FROM: "" }, 3105);
  try {
    await waitFor("http://127.0.0.1:3105/health");
    const r = await fetch("http://127.0.0.1:3105/api/accounts/email/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "dev@example.com" }) });
    const j = await r.json();
    await sleep(100);
    assert(r.status === 200 && j.dev === true && /sign-in code for dev@example\.com is \d{6}/.test(d.log()), "development without RESEND_API_KEY: the code is logged on the server and the answer says dev");
  } finally { d.proc.kill(); }
}
// --- production: config/app.json mounts it; without a key email is off ---
{
  const real = () => crypto.randomBytes(32).toString("hex");
  const p = start({ NODE_ENV: "production", ADMIN_KEY: real(), AUTH_SECRET: real(), RESEND_API_KEY: "", EMAIL_FROM: "" }, 3106);
  try {
    await waitFor("http://127.0.0.1:3106/health");
    const cfg = await (await fetch("http://127.0.0.1:3106/api/accounts/config")).json();
    assert(/module mounted: accounts/.test(p.log()) && cfg.providers.email === false && cfg.providers.google === false, `production without keys: accounts mounted, nothing configured (${JSON.stringify(cfg.providers)})`);
    const r = await fetch("http://127.0.0.1:3106/api/accounts/email/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "x@example.com" }) });
    assert(r.status === 503, "production without RESEND_API_KEY: email/start answers 503");
  } finally { p.proc.kill(); }
}
mock.close(); resend.close();
await sleep(150);
fs.rmSync(DATA, { recursive: true, force: true });
console.log(process.exitCode ? "ACCOUNTS SMOKE: FAILURES" : "ACCOUNTS SMOKE: all passed");
process.exit();
