// Wearables hub smoke test against the local mock Oura/Terra. Usage: node scripts/integrations-smoke.js
import crypto from "crypto";
import { spawn } from "child_process";
import { startMockWearables } from "./mock-wearables.js";
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok  ", m); };
const waitFor = async (url) => { for (let i = 0; i < 50; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); } throw new Error("backend did not start"); };
const mock = await startMockWearables(3997);
const B = "http://127.0.0.1:3105", RET = "https://app.example/";
const be = spawn("node", ["server.js"], { env: { ...process.env, PORT: "3105", PUBLIC_BASE_URL: B, OURA_MOCK_BASE: mock.base, TERRA_MOCK_BASE: mock.base, CORS_ORIGIN: "https://app.example", AUTH_SECRET: "t" }, stdio: ["ignore", "ignore", "inherit"] });
const go = (u, i) => fetch(u, { redirect: "manual", ...i });
const post = (p, b, h = {}) => fetch(`${B}${p}`, { method: "POST", headers: { "content-type": "application/json", ...h }, body: typeof b === "string" ? b : JSON.stringify(b) });
try {
  await waitFor(`${B}/health`);
  const src = await (await fetch(`${B}/api/integrations/sources`)).json();
  assert(src.healthkit === "on-device" && src.oura === true && src.terra === true, "sources: healthkit on-device, oura + terra configured");

  // Oura flow
  let r = await go(`${B}/api/integrations/oura/start?return=${encodeURIComponent(RET)}`);
  assert(r.status === 302 && r.headers.get("location").startsWith(`${mock.base}/oauth/authorize?`), "oura: start redirects to Oura");
  r = await go(r.headers.get("location")); r = await go(r.headers.get("location"));
  const html = await r.text();
  assert(r.status === 200 && /postMessage/.test(html) && /"type":"cyra:oura","code":"/.test(html) && /"https:\/\/app.example"/.test(html), "oura: callback renders popup page posting the code to the app origin only");
  const code = html.match(/"code":"([a-f0-9]+)"/)[1];
  const tok = await (await post("/api/integrations/oura/exchange", { code })).json();
  assert(tok.access_token && tok.refresh_token === "rt-1" && tok.expires_at > Date.now(), "oura: exchange returns tokens to the device");
  assert((await post("/api/integrations/oura/exchange", { code })).status === 404, "oura: handoff single-use");
  const pull = await (await post("/api/integrations/oura/pull", { access_token: tok.access_token })).json();
  assert(pull.rows.length === 30 && pull.rows.every((x) => x.temp != null && x.sleep != null && x.hrv < 90 && x.rhr < 90), `oura: pull normalizes 30 days, naps ignored (${pull.rows.length} rows)`);
  assert((await post("/api/integrations/oura/pull", { access_token: "bad" })).status === 401, "oura: expired token → 401 so the device refreshes");
  const ref = await (await post("/api/integrations/oura/refresh", { refresh_token: "rt-1" })).json();
  assert(ref.access_token && ref.refresh_token === "rt-2", "oura: refresh via server-held client secret");
  assert((await go(`${B}/api/integrations/oura/callback?code=x&state=bad.sig`)).status === 400, "oura: forged state rejected");

  // Terra flow
  const sess = await (await post("/api/integrations/terra/session", { ref: "dev_abcdef12", return: RET })).json();
  assert(sess.url && sess.url.startsWith(mock.base), "terra: widget session created with dev-id + api key");
  r = await go(sess.url); r = await go(r.headers.get("location"));
  const done = await r.text();
  assert(r.status === 200 && /"type":"cyra:terra","ok":true/.test(done), "terra: success redirect renders popup page");
  assert((await post("/api/integrations/terra/session", { ref: "x", return: RET })).status === 400, "terra: ref must be opaque 8-64 chars");
  const payload = JSON.stringify({ type: "daily", user: { user_id: "terra-u1", reference_id: "dev_abcdef12", provider: "FITBIT" }, data: [{ metadata: { start_time: "2026-10-01T00:00:00Z" }, heart_rate_data: { summary: { resting_hr_bpm: 61.4, avg_hrv_rmssd: 44.2 } }, temperature_data: { body_temperature_delta: 0.21 }, sleep_durations_data: { sleep_efficiency: 0.86 } }] });
  const ts = Math.floor(Date.now() / 1000); const sig = crypto.createHmac("sha256", "test-signing").update(`${ts}.${payload}`).digest("hex");
  let w = await post("/api/integrations/terra/webhook", payload, { "terra-signature": `t=${ts},v1=${sig}` });
  assert(w.status === 200 && (await w.json()).queued === 1, "terra: signed webhook accepted and queued");
  w = await post("/api/integrations/terra/webhook", payload, { "terra-signature": `t=${ts},v1=${"0".repeat(64)}` });
  assert(w.status === 401, "terra: bad signature rejected");
  w = await post("/api/integrations/terra/webhook", payload, { "terra-signature": `t=${ts - 3600},v1=${crypto.createHmac("sha256", "test-signing").update(`${ts - 3600}.${payload}`).digest("hex")}` });
  assert(w.status === 401, "terra: stale timestamp rejected");
  let box = await (await fetch(`${B}/api/integrations/terra/inbox?ref=dev_abcdef12`)).json();
  assert(box.rows.length === 1 && box.rows[0].rhr === 61 && box.rows[0].hrv === 44 && box.rows[0].temp === 0.21 && box.rows[0].sleep === 86 && box.rows[0].date === "2026-10-01", "terra: inbox returns the normalized row");
  box = await (await fetch(`${B}/api/integrations/terra/inbox?ref=dev_abcdef12`)).json();
  assert(box.rows.length === 0, "terra: inbox cleared after the device drained it");
} finally { be.kill(); mock.close(); }
const bare = spawn("node", ["server.js"], { env: { ...process.env, PORT: "3106", OURA_CLIENT_ID: "", TERRA_API_KEY: "", OURA_MOCK_BASE: "", TERRA_MOCK_BASE: "" }, stdio: ["ignore", "ignore", "inherit"] });
try { await waitFor("http://127.0.0.1:3106/health");
  const src = await (await fetch("http://127.0.0.1:3106/api/integrations/sources")).json();
  assert(src.oura === false && src.terra === false, "sources: honest false without credentials");
  assert((await go(`http://127.0.0.1:3106/api/integrations/oura/start?return=${encodeURIComponent(RET)}`)).status === 503, "oura: unconfigured → 503");
} finally { bare.kill(); }
console.log(process.exitCode ? "INTEGRATIONS SMOKE: FAILURES" : "INTEGRATIONS SMOKE: all passed");
