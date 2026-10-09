// Wearables hub smoke test against the local mock Oura/Terra, for the web popup flow
// and the native app's flow (cyrahealth://auth/<oura|terra>?a=<attempt> return links,
// Oura bound to an app verifier, both or neither). Also: the Terra mailbox key (only a
// one-way ref reaches Terra and its redirect; the ref opens nothing), the done page that
// never echoes Terra's query, real disconnects (Terra deauthenticate, Oura revoke), sealed
// state, and timed sweeps that keep each row's first arrival time.
// Usage: node scripts/integrations-smoke.js
import crypto from "crypto";
import { spawn } from "child_process";
import express from "express";
import { startMockWearables } from "./mock-wearables.js";
import { mount as mountIntegrations, terraRef } from "../src/modules/integrations/index.js";
import { normalize as terraNormalize } from "../src/modules/integrations/adapters/terra.js";
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok  ", m); };
const waitFor = async (url) => { for (let i = 0; i < 50; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); } throw new Error("backend did not start"); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const newKey = () => crypto.randomBytes(32).toString("base64url"); // what the device makes and keeps
const mock = await startMockWearables(3997);
const B = "http://127.0.0.1:3105", RET = "https://app.example/";
const be = spawn("node", ["server.js"], { env: { ...process.env, PORT: "3105", PUBLIC_BASE_URL: B, OURA_MOCK_BASE: mock.base, TERRA_MOCK_BASE: mock.base, CORS_ORIGIN: "https://app.example,capacitor://localhost,https://localhost", AUTH_SECRET: "t", APP_RETURN_SCHEMES: "", RETURN_ORIGINS: "", NODE_ENV: "" }, stdio: ["ignore", "ignore", "inherit"] });
const go = (u, i) => fetch(u, { redirect: "manual", ...i });
const post = (p, b, h = {}) => fetch(`${B}${p}`, { method: "POST", headers: { "content-type": "application/json", ...h }, body: typeof b === "string" ? b : JSON.stringify(b) });
const signed = (payload, ts = Math.floor(Date.now() / 1000), secret = "test-signing") => ({ "terra-signature": `t=${ts},v1=${crypto.createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex")}` });
const daily = (ref, date, fields) => JSON.stringify({ type: "daily", user: { user_id: "terra-u1", reference_id: ref, provider: "FITBIT" }, data: [{ metadata: { start_time: `${date}T00:00:00Z` }, ...fields }] });
// Terra's Sleep shape: a night from 23:30 the day before to 07:00 on `date` (the wake day), temperature_data = { delta }.
const prevDay = (date) => new Date(Date.parse(`${date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
const sleepP = (ref, date, fields, meta = {}) => JSON.stringify({ type: "sleep", user: { user_id: "terra-u1", reference_id: ref, provider: "FITBIT" }, data: [{ metadata: { start_time: `${prevDay(date)}T23:30:00-07:00`, end_time: `${date}T07:00:00-07:00`, is_nap: false, ...meta }, ...fields }] });
try {
  await waitFor(`${B}/health`);
  const src = await (await fetch(`${B}/api/integrations/sources`)).json();
  assert(src.healthkit === "on-device" && src.oura === true && src.terra === true, "sources: healthkit on-device, oura + terra configured");

  // Oura flow
  let r = await go(`${B}/api/integrations/oura/start?return=${encodeURIComponent(RET)}`);
  assert(r.status === 302 && r.headers.get("location").startsWith(`${mock.base}/oauth/authorize?`), "oura: start redirects to Oura");
  { const st = new URL(r.headers.get("location")).searchParams.get("state") || ""; const raw = Buffer.from(st, "base64url").toString("latin1");
    assert(st.length > 40 && !/app\.example|"ret"|oura/.test(raw) && !st.includes("."), "oura: state is sealed — Oura can't read the return URL"); }
  r = await go(r.headers.get("location")); r = await go(r.headers.get("location"));
  const html = await r.text();
  assert(r.status === 200 && /postMessage/.test(html) && /"type":"cyra:oura","code":"/.test(html) && /"https:\/\/app.example"/.test(html), "oura: callback renders popup page posting the code to the app origin only");
  assert(/history\.replaceState\(null,"",location\.pathname\)/.test(html), "oura: callback page strips its query (Oura's code, state) from the address bar");
  const code = html.match(/"code":"([a-f0-9]+)"/)[1];
  const tok = await (await post("/api/integrations/oura/exchange", { code })).json();
  assert(tok.access_token && tok.refresh_token === "rt-1" && tok.expires_at > Date.now(), "oura: exchange returns tokens to the device");
  assert((await post("/api/integrations/oura/exchange", { code })).status === 404, "oura: handoff single-use");
  const pull = await (await post("/api/integrations/oura/pull", { access_token: tok.access_token })).json();
  assert(pull.rows.length === 30 && pull.rows.every((x) => x.temp != null && x.sleep != null && x.hrv < 90 && x.rhr < 90), `oura: pull normalizes 30 days, naps ignored (${pull.rows.length} rows)`);
  assert((await post("/api/integrations/oura/pull", { access_token: "bad" })).status === 401, "oura: expired token → 401 so the device refreshes");
  const ref = await (await post("/api/integrations/oura/refresh", { refresh_token: "rt-1" })).json();
  assert(ref.access_token && ref.refresh_token === "rt-2", "oura: refresh via server-held client secret");
  { const bad = await go(`${B}/api/integrations/oura/callback?code=x&state=bad.sig`); const page = await bad.text();
    assert(bad.status === 400, "oura: forged state rejected");
    assert(/history\.replaceState\(null,"",location\.pathname\)/.test(page) && !page.includes("code=x") && bad.headers.get("cache-control") === "no-store" && bad.headers.get("referrer-policy") === "no-referrer", "oura: the expired/invalid-link page also strips Oura's code from the address bar"); }
  { const st = await go(`${B}/api/integrations/oura/start?return=${encodeURIComponent(RET)}`);
    assert(new URL(st.headers.get("location")).searchParams.get("scope") === "daily", "oura: asks only for the 'daily' scope (readiness + sleep), not heart-rate time series"); }
  { const cl = await (await post("/api/integrations/oura/pull", { access_token: tok.access_token, from: "2026-01-01", to: "2026-10-08" })).json();
    assert(cl.from === "2026-09-09" && cl.to === "2026-10-08", `oura: a pull never asks Oura for more than 30 calendar days (${cl.from}..${cl.to})`); }
  // Oura disconnect: Oura revokes the token, and it stops working
  let rv = await post("/api/integrations/oura/revoke", { access_token: ref.access_token });
  assert(rv.status === 200 && (await rv.json()).ok === true && mock.seen.revoked.includes(ref.access_token), "oura revoke: Oura revoked the access token");
  assert((await post("/api/integrations/oura/pull", { access_token: ref.access_token })).status === 401, "oura revoke: the revoked token no longer pulls data");
  rv = await post("/api/integrations/oura/revoke", { access_token: "expired-token", refresh_token: "rt-1" });
  assert(rv.status === 200 && mock.seen.revoked.length === 2, "oura revoke: expired access token → refreshed, then the fresh one revoked");
  assert((await post("/api/integrations/oura/revoke", { access_token: "expired-token" })).status === 502, "oura revoke: Oura refuses → 502, never a fake ok");
  assert((await post("/api/integrations/oura/revoke", {})).status === 400, "oura revoke: no token → 400");

  // Terra flow: the device's secret key never reaches Terra; Terra only ever sees ref = sha256("terra:"+key)[:32]
  const KEY = newKey(), REF = terraRef(KEY);
  assert(REF === crypto.createHash("sha256").update(`terra:${KEY}`).digest("base64url").slice(0, 32) && REF.length === 32, "terra: ref = base64url(sha256('terra:'+key)).slice(0,32)");
  const sess = await (await post("/api/integrations/terra/session", { key: KEY, return: RET })).json();
  assert(sess.url && sess.url.startsWith(mock.base), "terra: widget session created with dev-id + api key");
  const lastRef = (await (await fetch(`${mock.base}/last-ref`)).json()).ref;
  assert(lastRef === REF, "terra: Terra was given the derived ref as reference_id");
  assert(!mock.seen.requests.some((q) => (q.body + q.query).includes(KEY)), "terra: the key itself never reached Terra");
  r = await go(sess.url);
  const doneUrl = r.headers.get("location") || "";
  assert(doneUrl.includes(`reference_id=${REF}`) && doneUrl.includes("user_id=terra-u"), "terra: (mock) Terra's redirect appends user_id and reference_id, as the real one does");
  r = await go(doneUrl);
  const done = await r.text();
  assert(r.status === 200 && /"type":"cyra:terra","ok":true/.test(done), "terra: success redirect renders popup page");
  assert(!done.includes(REF) && !/terra-u\d/.test(done) && !done.includes("FITBIT"), "terra done: page never echoes Terra's query (no ref, user_id or resource)");
  assert(/history\.replaceState\(null,"",location\.pathname\)/.test(done), "terra done: page strips the query from the address bar");
  { const bad = await go(`${B}/api/integrations/terra/done?state=expired&ok=1&user_id=terra-u9&reference_id=${REF}`); const page = await bad.text();
    assert(bad.status === 400 && /history\.replaceState\(null,"",location\.pathname\)/.test(page) && !page.includes(REF) && !page.includes("terra-u9"), "terra done: the expired-link page strips Terra's query too and echoes none of it"); }
  assert((await post("/api/integrations/terra/session", { key: "x", return: RET })).status === 400, "terra: key must be 43-128 base64url chars");
  assert((await post("/api/integrations/terra/session", { ref: "dev_abcdef12", return: RET })).status === 400, "terra: an old {ref} session request is refused (fails closed)");
  const payload = sleepP(REF, "2026-10-01", { heart_rate_data: { summary: { resting_hr_bpm: 61.4, avg_hrv_rmssd: 44.2 } }, temperature_data: { delta: 0.21 }, sleep_durations_data: { sleep_efficiency: 0.86 } });
  let w = await post("/api/integrations/terra/webhook", payload, signed(payload));
  assert(w.status === 200 && (await w.json()).queued === 1, "terra: signed webhook accepted and queued");
  w = await post("/api/integrations/terra/webhook", payload, { "terra-signature": `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}` });
  assert(w.status === 401, "terra: bad signature rejected");
  { const big = daily(REF, "2026-10-01", { heart_rate_data: { summary: { resting_hr_bpm: 61.4, avg_hrv_rmssd: 44.2 }, detailed: { hr_samples: Array.from({ length: 6000 }, (_, i) => ({ timestamp: `2026-10-01T00:${String(i % 60).padStart(2, "0")}:00Z`, bpm: 60 + (i % 9) })) } } });
    const wb = await post("/api/integrations/terra/webhook", big, signed(big));
    assert(big.length > 150_000 && wb.status === 200 && (await wb.json()).queued === 1, `terra: a large daily payload (${Math.round(big.length / 1000)} kB, over the 100 kB default) is accepted, not lost`); }
  w = await post("/api/integrations/terra/webhook", payload, signed(payload, Math.floor(Date.now() / 1000) - 3600));
  assert(w.status === 401, "terra: stale timestamp rejected");
  assert((await fetch(`${B}/api/integrations/terra/inbox?key=${KEY}`)).status === 404, "terra: no GET drain — the key never goes in a URL");
  assert((await post("/api/integrations/terra/inbox", { ref: REF })).status === 400, "terra: the ref (what Terra and its redirect see) can't drain the mailbox");
  assert((await post("/api/integrations/terra/inbox", { key: "x" })).status === 400, "terra: inbox drain needs a well-formed key");
  let box = await (await post("/api/integrations/terra/inbox", { key: newKey() })).json();
  assert(box.rows.length === 0, "terra: another key opens an empty mailbox");
  box = await (await post("/api/integrations/terra/inbox", { key: KEY })).json();
  assert(box.rows.length === 1 && box.rows[0].rhr === 61 && box.rows[0].hrv === 44 && box.rows[0].temp === 0.21 && box.rows[0].sleep === 86 && box.rows[0].date === "2026-10-01", "terra: POST inbox {key} returns the normalized row (Sleep temperature_data.delta → temp, filed under the wake day)");
  box = await (await post("/api/integrations/terra/inbox", { key: KEY })).json();
  assert(box.rows.length === 0, "terra: inbox cleared after the device drained it");
  { const n = (p) => terraNormalize(JSON.parse(p));
    const body = JSON.stringify({ type: "body", data: [{ metadata: { start_time: "2026-10-01T00:00:00Z" }, temperature_data: { body_temperature_samples: [{ timestamp: "2026-10-01T08:00:00Z", temperature_celsius: 36.6 }], skin_temperature_samples: [{ timestamp: "2026-10-01T08:00:00Z", temperature_celsius: 33.1 }] } }] });
    assert(n(body).length === 0, "terra normalize: a Body payload's absolute °C samples never become temp (temp holds baseline deltas)");
    assert(n(sleepP("r", "2026-10-08", { temperature_data: { delta: -0.12 } }))[0]?.date === "2026-10-08", "terra normalize: a night 23:30 Oct 7 → 07:00 Oct 8 is filed under Oct 8 (the wake day, like Oura)");
    assert(n(sleepP("r", "2026-10-08", { temperature_data: { delta: 0.4 } }, { is_nap: true })).length === 0, "terra normalize: a nap is skipped (it can't overwrite the night's values)");
    assert(n(sleepP("r", "2026-10-08", { scores: { sleep_score: 77 } }))[0]?.sleep === 77, "terra normalize: sleep falls back to Terra's scores.sleep_score");
    assert(n(daily("r", "2026-10-08", { heart_rate_data: { summary: { resting_hr_bpm: 58 } } }))[0]?.date === "2026-10-08", "terra normalize: a daily payload stays on its start day"); }
  // Terra disconnect: deauthenticate at Terra, empty the mailbox
  w = await post("/api/integrations/terra/webhook", payload, signed(payload));
  const dc = await post("/api/integrations/terra/disconnect", { key: KEY });
  const dj = dc.status === 200 ? await dc.json() : {};
  assert(dc.status === 200 && dj.ok === true && dj.disconnected === 1 && mock.seen.deauthenticated.length === 1, `terra disconnect: Terra deauthenticated the user under this ref (${dc.status} ${JSON.stringify(dj)})`);
  assert(mock.seen.requests.some((q) => q.path === "/userInfo" && q.query.includes(`reference_id=${REF}`) && q.headers["x-api-key"] === "test-key"), "terra disconnect: user looked up by reference_id with the server's Terra credentials");
  box = await (await post("/api/integrations/terra/inbox", { key: KEY })).json();
  assert(box.rows.length === 0, "terra disconnect: mailbox emptied");
  assert((await post("/api/integrations/terra/disconnect", { ref: REF })).status === 400, "terra disconnect: needs the key, not the ref");
  const again = await (await post("/api/integrations/terra/disconnect", { key: KEY })).json();
  assert(again.ok === true && again.disconnected === 0, "terra disconnect: repeat is harmless (nothing left to disconnect)");
  // a connection made by the older app version: its device-held secret was the ref itself (32 lowercase hex)
  { const OLD = crypto.randomBytes(16).toString("hex");
    await go(`${mock.base}/widget?ref=${OLD}&ok=${encodeURIComponent("http://127.0.0.1:1/?x=1")}`); // (mock) Terra registers a user under the old ref
    const n0 = mock.seen.deauthenticated.length;
    const lg = await post("/api/integrations/terra/disconnect-legacy", { ref: OLD });
    const lj = lg.status === 200 ? await lg.json() : {};
    assert(lg.status === 200 && lj.disconnected === 1 && mock.seen.deauthenticated.length === n0 + 1, `terra legacy disconnect: an older version's connection is really ended at Terra (${lg.status} ${JSON.stringify(lj)})`);
    assert((await post("/api/integrations/terra/disconnect-legacy", { ref: REF })).status === 400, "terra legacy disconnect: a current ref (what Terra and its redirects see) is refused — only the key ends those");
    assert((await post("/api/integrations/terra/disconnect-legacy", { ref: OLD, key: KEY })).status === 400, "terra legacy disconnect: takes only an old ref"); }

  // ---- native app: cyrahealth:// return links ----
  const pair = () => { const verifier = crypto.randomBytes(32).toString("base64url"); return { verifier, challenge: crypto.createHash("sha256").update(verifier).digest("base64url") }; };
  const attempt = () => crypto.randomBytes(16).toString("base64url"); // per-attempt id, as the app sends it
  const OURA_APP = `cyrahealth://auth/oura?a=${attempt()}`, TERRA_APP = `cyrahealth://auth/terra?a=${attempt()}`;
  const ouraApp = async (challenge) => { // start → Oura → callback page; returns { status, html, target }
    let s = await go(`${B}/api/integrations/oura/start?return=${encodeURIComponent(OURA_APP)}&app_challenge=${challenge}`);
    if (s.status !== 302) return { status: s.status };
    s = await go(s.headers.get("location")); s = await go(s.headers.get("location"));
    const page = await s.text();
    return { status: s.status, html: page, target: JSON.parse(page.match(/location\.replace\(("[^"]*")\)/)?.[1] || '""') };
  };
  const exch = (b) => post("/api/integrations/oura/exchange", b);
  {
    const p = pair(); const out = await ouraApp(p.challenge);
    assert(out.status === 200 && !/postMessage/.test(out.html) && out.target.startsWith(`${OURA_APP}#oura=`), `oura app: callback page goes straight to ${OURA_APP}#oura=<code>, no postMessage`);
    assert(out.html.includes(`href="${out.target}"`) && /min-height:44px/.test(out.html), "oura app: page also offers a 44px \"Return to Cyra\" link");
    const code = out.target.split("#oura=")[1];
    const t = await exch({ code, verifier: p.verifier });
    const tj = t.status === 200 ? await t.json() : {};
    assert(t.status === 200 && tj.access_token && tj.refresh_token === "rt-1", `oura app: right verifier → tokens (${t.status})`);
    assert((await exch({ code, verifier: p.verifier })).status === 404, "oura app: handoff still single-use");
  }
  { const p = pair(); const out = await ouraApp(p.challenge); const code = out.target.split("#oura=")[1];
    const rv0 = mock.seen.revoked.length;
    const r1 = await exch({ code });
    assert(r1.status === 404, `oura app: missing verifier → ${r1.status}`);
    assert((await exch({ code, verifier: p.verifier })).status === 404, "oura app: a refused attempt burns the code");
    await sleep(200);
    assert(mock.seen.revoked.length === rv0 + 1, "oura app: tokens of a refused (never delivered) code are revoked at Oura at once"); }
  { const p = pair(); const out = await ouraApp(p.challenge); const code = out.target.split("#oura=")[1];
    const r1 = await exch({ code, verifier: pair().verifier });
    assert(r1.status === 404, `oura app: wrong verifier → ${r1.status}`); }
  // both or neither: a web-minted Oura code slipped into the app's link is refused with the app's verifier
  { let w2 = await go(`${B}/api/integrations/oura/start?return=${encodeURIComponent(RET)}`); w2 = await go(w2.headers.get("location")); w2 = await go(w2.headers.get("location"));
    const code = (await w2.text()).match(/"code":"([a-f0-9]+)"/)[1];
    const r1 = await exch({ code, verifier: pair().verifier });
    assert(r1.status === 404, `oura: web code + any verifier (code injected into the app) → ${r1.status}`);
    assert((await exch({ code })).status === 404, "oura: the refused attempt burns the web code"); }
  r = await go(`${B}/api/integrations/oura/start?return=${encodeURIComponent(OURA_APP)}`);
  assert(r.status === 400, `oura app: cyrahealth:// return without app_challenge → ${r.status}`);
  r = await go(`${B}/api/integrations/oura/start?return=${encodeURIComponent(RET)}&app_challenge=${pair().challenge}`);
  assert(r.status === 400, `oura web: app_challenge on a web return refused → ${r.status}`);
  for (const [bad, flow] of [["cyrahealth://auth/oauth", "oura"], ["cyrahealth://auth/terra", "oura"], ["cyrahealth://auth/oura", "terra"], ["cyrahealth://evil.example/oura", "both"], ["cyrahealth:auth/oura", "both"], ["cyrahealth://auth/oura?a=short", "both"], ["https://localhost/", "both"], ["http://localhost/", "both"],
    ["cyrahealth://auth/oura#x", "oura"], ["CYRAHEALTH://auth/oura", "oura"], ["cyrahealth://auth/terra#terra=1", "terra"], ["Cyrahealth://auth/terra", "terra"]]) {
    if (flow !== "terra") { r = await go(`${B}/api/integrations/oura/start?return=${encodeURIComponent(bad)}&app_challenge=${pair().challenge}`); assert(r.status === 400, `oura: return ${bad} rejected (${r.status})`); }
    if (flow !== "oura") { const tr = await post("/api/integrations/terra/session", { key: newKey(), return: bad }); assert(tr.status === 400, `terra: return ${bad} rejected (${tr.status})`); }
  }
  for (const bad of ["evil://x", "javascript:alert(1)", "data:text/html,hi", "file:///etc/passwd"]) {
    r = await go(`${B}/api/integrations/oura/start?return=${encodeURIComponent(bad)}&app_challenge=${pair().challenge}`);
    assert(r.status === 400, `oura: return ${bad} rejected (${r.status})`);
    const tr = await post("/api/integrations/terra/session", { key: newKey(), return: bad });
    assert(tr.status === 400, `terra: return ${bad} rejected (${tr.status})`);
  }
  {
    const ts2 = await post("/api/integrations/terra/session", { key: newKey(), return: TERRA_APP });
    const sj = await ts2.json();
    assert(ts2.status === 200 && sj.url, `terra app: session accepted with ${TERRA_APP}`);
    assert(mock.seen.widgetProviders === "FITBIT,GARMIN,WHOOP", `terra: the widget is limited to Fitbit, Garmin and Whoop (${mock.seen.widgetProviders})`);
    let d = await go(sj.url); d = await go(d.headers.get("location"));
    const page = await d.text(); const target = JSON.parse(page.match(/location\.replace\(("[^"]*")\)/)?.[1] || '""');
    assert(d.status === 200 && !/postMessage/.test(page) && target === `${TERRA_APP}#terra=1`, `terra app: done page goes straight to ${target}`);
    assert(!/terra-u\d|reference_id/.test(page) && /history\.replaceState/.test(page), "terra app: done page echoes nothing from Terra's query and strips it");
  }
  // the web done page can't be turned into script by a crafted return path
  {
    r = await go(`${B}/api/integrations/oura/start?return=${encodeURIComponent("https://app.example/</script><script>alert(1)</script>")}`);
    r = await go(r.headers.get("location")); r = await go(r.headers.get("location"));
    const page = await r.text();
    assert(r.status === 200 && !page.includes("<script>alert(1)") && (page.match(/<script>/g) || []).length === 1, "oura web: crafted return path stays inert in the done page");
  }
  // a malformed Terra delivery is refused without the default error handler (which would log part of the body)
  { const bad = await post("/api/integrations/terra/webhook", "{\"type\":\"daily\",\"x\":", signed("{\"type\":\"daily\",\"x\":"));
    assert(bad.status === 400 && /could not be read/.test(await bad.text()), `terra webhook: unreadable body → 400, nothing echoed (${bad.status})`); }
  // shutdown: an Oura handoff still waiting is revoked before the server exits
  { let w = await go(`${B}/api/integrations/oura/start?return=${encodeURIComponent(RET)}`); w = await go(w.headers.get("location")); w = await go(w.headers.get("location"));
    assert(/"code":"[a-f0-9]+"/.test(await w.text()), "oura: an uncollected handoff is waiting");
    const rv0 = mock.seen.revoked.length;
    const exited = new Promise((res) => be.once("exit", res));
    be.kill("SIGTERM"); await Promise.race([exited, sleep(5000)]);
    assert(mock.seen.revoked.length >= rv0 + 1, `oura: SIGTERM revokes (${rv0} -> ${mock.seen.revoked.length}) handoffs nobody collected before the server exits`); }
} finally { be.kill(); }

// ---- timed sweeps, in process with short TTLs: nothing waits for the next request ----
{
  process.env.TERRA_MOCK_BASE = mock.base; process.env.OURA_MOCK_BASE = mock.base; process.env.CORS_ORIGIN = "https://app.example"; process.env.RETURN_ORIGINS = ""; process.env.NODE_ENV = ""; process.env.PUBLIC_BASE_URL = "http://127.0.0.1:3112";
  const app = express(); app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
  const router = express.Router(); const ctx = { config: { authSecret: crypto.randomBytes(32).toString("hex") } };
  mountIntegrations(router, ctx, { handoffTtlMs: 300, inboxTtlMs: 600, sweepMs: 50 }); app.use("/api/integrations", router);
  const srv = await new Promise((res) => { const x = app.listen(3112, () => res(x)); });
  const P = (p, b, h = {}) => fetch(`http://127.0.0.1:3112${p}`, { method: "POST", headers: { "content-type": "application/json", ...h }, body: typeof b === "string" ? b : JSON.stringify(b) });
  try {
    // an Oura handoff nobody collects
    let s = await go(`http://127.0.0.1:3112/api/integrations/oura/start?return=${encodeURIComponent(RET)}`); s = await go(s.headers.get("location")); s = await go(s.headers.get("location"));
    const code = (await s.text()).match(/"code":"([a-f0-9]+)"/)?.[1];
    assert(code && ctx.integrationsMemory().handoffs === 1, "oura handoff: tokens wait under a one-time code");
    const rv0 = mock.seen.revoked.length;
    await sleep(450);
    assert(ctx.integrationsMemory().handoffs === 0, "oura handoff: deleted by its timer when uncollected (5 min in production, 300 ms here)");
    assert(mock.seen.revoked.length === rv0 + 1, "oura handoff: tokens nobody collected are revoked at Oura when they expire (no live grant left behind)");
    // a Terra row, then an update to the same day just before it expires: the update must not extend it
    const key = newKey(), ref = terraRef(key);
    const p1 = sleepP(ref, "2026-10-02", { temperature_data: { delta: 0.3 } });
    await P("/api/integrations/terra/webhook", p1, signed(p1));
    assert(ctx.integrationsMemory().rows === 1, "terra mailbox: one row waiting");
    await sleep(400);
    const p2 = daily(ref, "2026-10-02", { heart_rate_data: { summary: { resting_hr_bpm: 60 } } });
    await P("/api/integrations/terra/webhook", p2, signed(p2));
    await sleep(350); // 750 ms after the first arrival, 350 ms after the update; TTL 600 ms
    const mem = ctx.integrationsMemory();
    assert(mem.rows === 0 && mem.mailboxes === 0, `terra mailbox: row deleted 7 days (600 ms here) after it FIRST arrived, by the timed sweep, though updated since (${JSON.stringify(mem)})`);
    // a fresh row expires on its own with no request at all
    const p3 = sleepP(ref, "2026-10-03", { temperature_data: { delta: 0.1 } });
    await P("/api/integrations/terra/webhook", p3, signed(p3));
    await sleep(750);
    assert(ctx.integrationsMemory().mailboxes === 0, "terra mailbox: uncollected row swept with no further request");
  } finally { srv.close(); }
}
mock.close();

const bare = spawn("node", ["server.js"], { env: { ...process.env, PORT: "3106", OURA_CLIENT_ID: "", TERRA_API_KEY: "", OURA_MOCK_BASE: "", TERRA_MOCK_BASE: "" }, stdio: ["ignore", "ignore", "inherit"] });
try { await waitFor("http://127.0.0.1:3106/health");
  const src = await (await fetch("http://127.0.0.1:3106/api/integrations/sources")).json();
  assert(src.oura === false && src.terra === false, "sources: honest false without credentials");
  assert((await go(`http://127.0.0.1:3106/api/integrations/oura/start?return=${encodeURIComponent(RET)}`)).status === 503, "oura: unconfigured → 503");
  assert((await fetch("http://127.0.0.1:3106/api/integrations/terra/disconnect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: newKey() }) })).status === 503, "terra disconnect: unconfigured → 503");
} finally { bare.kill(); }
console.log(process.exitCode ? "INTEGRATIONS SMOKE: FAILURES" : "INTEGRATIONS SMOKE: all passed");
