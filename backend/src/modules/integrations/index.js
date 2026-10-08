// Wearable integration hub — production ingestion, privacy-first.
//
//   Apple Health / Health Connect: read ON THE DEVICE by the app's native bridge.
//     Nothing here; the server never sees it.
//   Oura (API v2, user OAuth): the client secret lives here, the user's tokens live
//     on the device. The server proxies pulls and returns normalized rows without
//     storing them.
//       GET  /api/integrations/oura/start?return=URL   → 302 to Oura (popup)
//       GET  /api/integrations/oura/callback           → tiny page: postMessage code to opener
//       POST /api/integrations/oura/exchange {code}    → tokens, once
//       POST /api/integrations/oura/refresh {refresh_token}
//       POST /api/integrations/oura/pull {access_token, from, to} → { rows }
//   Terra (aggregator: Fitbit, Garmin, Whoop, …): Terra pushes signed webhooks.
//     Rows wait in an in-memory mailbox keyed by the device's opaque reference id
//     until the device drains it (TTL 7 days, never written to disk).
//       POST /api/integrations/terra/session {ref, return} → { url } (widget)
//       GET  /api/integrations/terra/done?state=            → popup page, postMessage
//       POST /api/integrations/terra/webhook                (terra-signature verified)
//       GET  /api/integrations/terra/inbox?ref=             → { rows }, then cleared
//   GET /api/integrations/sources → which sources this server can serve.
import crypto from "crypto";
import * as oura from "./adapters/oura.js";
import * as terra from "./adapters/terra.js";

export const basePath = "/api/integrations";

const env = (k) => (process.env[k] || "").trim();
const form = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null)).toString();
const sign = (payload, secret) => { const body = Buffer.from(JSON.stringify(payload)).toString("base64url"); return `${body}.${crypto.createHmac("sha256", secret).update(body).digest("base64url")}`; };
const verify = (token, secret) => {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const good = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const p = JSON.parse(Buffer.from(body, "base64url").toString());
  return p.exp > Date.now() ? p : null;
};
const isoDay = (d) => d.toISOString().slice(0, 10);
const validDay = (s, dflt) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? s : dflt);

/* The popup "done" page: hand a message to the opener and close; fall back to a redirect. */
function popupPage(res, { origin, ret, message, frag }) {
  const msg = JSON.stringify(message), o = JSON.stringify(origin), r = JSON.stringify(`${ret}#${frag}`);
  res.set("content-type", "text/html; charset=utf-8").send(`<!doctype html><meta charset="utf-8"><title>Cyra</title><p style="font:15px system-ui;padding:24px">Finishing up… you can close this window.</p><script>(function(){var m=${msg};try{if(window.opener&&!window.opener.closed){window.opener.postMessage(m,${o});window.close();return;}}catch(e){}location.replace(${r});})();</script>`);
}

export function mount(router, ctx) {
  const { config } = ctx;
  const secret = config.authSecret;
  const publicBase = () => (env("PUBLIC_BASE_URL") || env("RENDER_EXTERNAL_URL") || config.baseUrl || "").replace(/\/$/, "");
  const allowedReturn = (url) => {
    let u; try { u = new URL(url); } catch { return false; }
    if (!/^https?:$/.test(u.protocol)) return false;
    const list = (env("CORS_ORIGIN") || "*").split(",").map((s) => s.trim()).filter(Boolean);
    return list.includes("*") || list.includes(u.origin);
  };
  const O = () => {
    const mock = env("OURA_MOCK_BASE");
    return { clientId: env("OURA_CLIENT_ID") || (mock ? "test-oura" : ""), clientSecret: env("OURA_CLIENT_SECRET") || (mock ? "test-oura-secret" : ""), authorize: mock ? `${mock}/oauth/authorize` : "https://cloud.ouraring.com/oauth/authorize", token: mock ? `${mock}/oauth/token` : "https://api.ouraring.com/oauth/token", api: mock ? `${mock}/v2` : "https://api.ouraring.com/v2" };
  };
  const T = () => {
    const mock = env("TERRA_MOCK_BASE");
    return { devId: env("TERRA_DEV_ID") || (mock ? "test-dev" : ""), apiKey: env("TERRA_API_KEY") || (mock ? "test-key" : ""), signingSecret: env("TERRA_SIGNING_SECRET") || (mock ? "test-signing" : ""), api: mock || "https://api.tryterra.co/v2" };
  };
  const ouraOn = () => !!(O().clientId && O().clientSecret);
  const terraOn = () => !!(T().devId && T().apiKey && T().signingSecret);

  const handoffs = new Map(); // one-time codes → tokens (Oura), 5 min
  const inbox = new Map();    // Terra reference id → { rows: Map(date→row), exp }
  const sweep = () => { const now = Date.now(); for (const [k, v] of handoffs) if (v.exp < now) handoffs.delete(k); for (const [k, v] of inbox) if (v.exp < now) inbox.delete(k); };

  router.get("/sources", (req, res) => res.json({ healthkit: "on-device", oura: ouraOn(), terra: terraOn() }));

  /* ---------------- Oura ---------------- */
  router.get("/oura/start", (req, res) => {
    const o = O();
    if (!ouraOn()) return res.status(503).json({ error: "Oura is not configured on this server" });
    const ret = String(req.query.return || "");
    if (!allowedReturn(ret)) return res.status(400).json({ error: "return URL not allowed" });
    const state = sign({ s: "oura", ret, exp: Date.now() + 10 * 60_000 }, secret);
    res.redirect(302, `${o.authorize}?${form({ response_type: "code", client_id: o.clientId, redirect_uri: `${publicBase()}/api/integrations/oura/callback`, scope: "daily heartrate", state })}`);
  });
  router.get("/oura/callback", async (req, res) => {
    const st = verify(req.query.state, secret);
    if (!st || st.s !== "oura") return res.status(400).send("Connection link expired or invalid. Please go back to Cyra and try again.");
    const origin = new URL(st.ret).origin;
    if (req.query.error || !req.query.code) return popupPage(res, { origin, ret: st.ret, message: { type: "cyra:oura", error: String(req.query.error || "no_code") }, frag: "oura_error=1" });
    try {
      const o = O();
      const r = await fetch(o.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form({ grant_type: "authorization_code", code: req.query.code, redirect_uri: `${publicBase()}/api/integrations/oura/callback`, client_id: o.clientId, client_secret: o.clientSecret }) });
      const tok = await r.json();
      if (!r.ok || !tok.access_token) throw new Error(tok.error_description || tok.error || `token ${r.status}`);
      sweep();
      const code = crypto.randomBytes(24).toString("hex");
      handoffs.set(code, { tokens: { access_token: tok.access_token, refresh_token: tok.refresh_token || null, expires_at: Date.now() + (tok.expires_in || 86400) * 1000 }, exp: Date.now() + 5 * 60_000 });
      popupPage(res, { origin, ret: st.ret, message: { type: "cyra:oura", code }, frag: `oura=${code}` });
    } catch (e) {
      console.warn(`[cyra] oura callback: ${e.message}`);
      popupPage(res, { origin, ret: st.ret, message: { type: "cyra:oura", error: "connect_failed" }, frag: "oura_error=1" });
    }
  });
  router.post("/oura/exchange", (req, res) => {
    sweep();
    const h = handoffs.get(String(req.body?.code || ""));
    handoffs.delete(String(req.body?.code || ""));
    if (!h) return res.status(404).json({ error: "code unknown, used, or expired" });
    res.json(h.tokens);
  });
  router.post("/oura/refresh", async (req, res) => {
    const o = O();
    if (!ouraOn()) return res.status(503).json({ error: "Oura is not configured" });
    const refresh = String(req.body?.refresh_token || "");
    if (!refresh) return res.status(400).json({ error: "refresh_token required" });
    const r = await fetch(o.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form({ grant_type: "refresh_token", refresh_token: refresh, client_id: o.clientId, client_secret: o.clientSecret }) });
    const tok = await r.json();
    if (!r.ok || !tok.access_token) return res.status(401).json({ error: "refresh failed" });
    res.json({ access_token: tok.access_token, refresh_token: tok.refresh_token || refresh, expires_at: Date.now() + (tok.expires_in || 86400) * 1000 });
  });
  // Pass-through: fetch, normalize, return. Nothing is kept.
  router.post("/oura/pull", async (req, res) => {
    const o = O();
    const token = String(req.body?.access_token || "");
    if (!token) return res.status(400).json({ error: "access_token required" });
    const to = validDay(req.body?.to, isoDay(new Date())), from = validDay(req.body?.from, isoDay(new Date(Date.now() - 30 * 86400000)));
    const get = async (path) => { const r = await fetch(`${o.api}/usercollection/${path}?${form({ start_date: from, end_date: to })}`, { headers: { authorization: `Bearer ${token}` } }); if (r.status === 401) throw Object.assign(new Error("unauthorized"), { status: 401 }); if (!r.ok) throw new Error(`${path} ${r.status}`); return (await r.json()).data || []; };
    try {
      const [readiness, dailySleep, sleep] = await Promise.all([get("daily_readiness"), get("daily_sleep"), get("sleep")]);
      res.json({ rows: oura.normalize({ readiness, dailySleep, sleep }), from, to });
    } catch (e) {
      res.status(e.status === 401 ? 401 : 502).json({ error: e.status === 401 ? "token expired — refresh" : "Oura did not answer" });
    }
  });

  /* ---------------- Terra ---------------- */
  router.post("/terra/session", async (req, res) => {
    const t = T();
    if (!terraOn()) return res.status(503).json({ error: "Fitbit/Garmin/Whoop sync is not configured on this server" });
    const ref = String(req.body?.ref || ""), ret = String(req.body?.return || "");
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(ref)) return res.status(400).json({ error: "ref must be an opaque id (8-64 chars)" });
    if (!allowedReturn(ret)) return res.status(400).json({ error: "return URL not allowed" });
    const state = sign({ s: "terra", ret, exp: Date.now() + 30 * 60_000 }, secret);
    const done = `${publicBase()}/api/integrations/terra/done?state=${encodeURIComponent(state)}`;
    try {
      const r = await fetch(`${t.api}/auth/generateWidgetSession`, { method: "POST", headers: { "content-type": "application/json", "dev-id": t.devId, "x-api-key": t.apiKey }, body: JSON.stringify({ reference_id: ref, language: "en", auth_success_redirect_url: `${done}&ok=1`, auth_failure_redirect_url: `${done}&ok=0` }) });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.message || `widget ${r.status}`);
      res.json({ url: j.url });
    } catch (e) {
      console.warn(`[cyra] terra session: ${e.message}`);
      res.status(502).json({ error: "Could not start the connection" });
    }
  });
  router.get("/terra/done", (req, res) => {
    const st = verify(req.query.state, secret);
    if (!st || st.s !== "terra") return res.status(400).send("Connection link expired or invalid. Please go back to Cyra and try again.");
    const ok = String(req.query.ok) === "1";
    popupPage(res, { origin: new URL(st.ret).origin, ret: st.ret, message: { type: "cyra:terra", ok }, frag: ok ? "terra=1" : "terra_error=1" });
  });
  // Terra signs each webhook: terra-signature: t=<unix>,v1=<hex hmac-sha256(secret, `${t}.${rawBody}`)>
  router.post("/terra/webhook", (req, res) => {
    const t = T();
    if (!terraOn()) return res.status(503).json({ error: "not configured" });
    const header = String(req.get("terra-signature") || "");
    const ts = /t=(\d+)/.exec(header)?.[1], v1 = /v1=([a-f0-9]+)/i.exec(header)?.[1];
    if (!ts || !v1) return res.status(401).json({ error: "missing signature" });
    const expected = crypto.createHmac("sha256", t.signingSecret).update(`${ts}.`).update(req.rawBody || "").digest("hex");
    const a = Buffer.from(v1.toLowerCase()), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: "bad signature" });
    if (Math.abs(Date.now() / 1000 - Number(ts)) > 5 * 60) return res.status(401).json({ error: "stale signature" });
    const ref = req.body?.user?.reference_id;
    const rows = ["daily", "sleep", "body"].includes(req.body?.type) ? terra.normalize(req.body) : [];
    if (ref && rows.length) {
      sweep();
      const box = inbox.get(ref) || { rows: new Map(), exp: 0 };
      for (const r of rows) box.rows.set(r.date, { ...(box.rows.get(r.date) || {}), ...Object.fromEntries(Object.entries(r).filter(([, v]) => v != null)) });
      box.exp = Date.now() + 7 * 86400000;
      if (box.rows.size > 400) for (const k of [...box.rows.keys()].sort().slice(0, box.rows.size - 400)) box.rows.delete(k);
      inbox.set(ref, box);
      if (inbox.size > 50_000) inbox.delete(inbox.keys().next().value);
    }
    res.json({ ok: true, queued: rows.length });
  });
  router.get("/terra/inbox", (req, res) => {
    const ref = String(req.query.ref || "");
    const box = inbox.get(ref);
    inbox.delete(ref);
    res.json({ rows: box ? [...box.rows.values()].sort((a, b) => a.date.localeCompare(b.date)) : [] });
  });
}
