// Wearable integration hub — the server-mediated sources.
//
//   Apple Health / Health Connect: read ON THE DEVICE by the app's native bridge.
//     Nothing here; the server never sees it.
//   Oura (API v2, user OAuth): the client secret lives here, the user's tokens live
//     on the device. The server relays pulls and returns normalized rows without
//     storing them. Tokens pass through memory only: after the Oura callback they wait
//     under a one-time code until the device collects them, deleted by a timer 5
//     minutes after the callback either way. Tokens no device redeemed (the timer ran
//     out, the code came too late, or the exchange was refused for a missing or wrong
//     verifier) are revoked at Oura, and so are any still waiting when the server shuts
//     down (SIGTERM). Best effort: if Oura doesn't answer the revoke, the server crashes
//     before it can run, or the exchange answer never reaches the device, a grant can
//     stay until the person removes Cyra in Oura's connected apps. On
//     pull/refresh/revoke tokens are used for that one request and dropped. Scope:
//     "daily" only (readiness and sleep), the narrowest that gives these fields; each
//     pull fetches 30 calendar days at most.
//       GET  /api/integrations/oura/start?return=URL[&app_challenge=C] → 302 to Oura
//       GET  /api/integrations/oura/callback           → tiny page: postMessage code to opener
//                                                        (web) or go to the app link (native)
//       POST /api/integrations/oura/exchange {code[, verifier]} → tokens, once
//       POST /api/integrations/oura/refresh {refresh_token}
//       POST /api/integrations/oura/pull {access_token, from, to} → { rows }
//       POST /api/integrations/oura/revoke {access_token[, refresh_token]} → { ok }
//                                                        Oura revokes Cyra's access
//   Terra (aggregator: Fitbit, Garmin, Whoop, …): Terra pushes signed webhooks. Rows wait
//     in an in-memory mailbox until the device collects them, never written to disk;
//     each row is deleted no later than 7 days after it FIRST arrived (later updates to
//     the same day don't extend that): a sweep runs every minute (and before each
//     collection) and removes a row once the next sweep would come after its 7 days.
//     The mailbox key: the device makes a secret `key` (32 random bytes, base64url) and
//     keeps it. The server derives ref = base64url(sha256("terra:" + key)).slice(0, 32),
//     gives Terra that ref as the connection's reference_id and files Terra's deliveries
//     under it. Terra, its redirects (which append reference_id to /terra/done), its
//     webhooks and any request log only ever see the ref. For a connection made by this
//     version the ref opens nothing: collecting or disconnecting needs the key, which
//     only travels in request bodies. (A connection made by the older app version used
//     its ref as its secret, so that ref can still end it — never read it — through
//     /terra/disconnect-legacy.)
//       POST /api/integrations/terra/session {key, return} → { url } (widget)
//       GET  /api/integrations/terra/done?state=            → page that never echoes Terra's
//                                                             query and strips it from the address bar
//       POST /api/integrations/terra/webhook                (terra-signature verified)
//       POST /api/integrations/terra/inbox {key}            → { rows }, then cleared
//       POST /api/integrations/terra/disconnect {key}       → { ok, disconnected }: Terra
//                                                             deauthenticates the user(s) under
//                                                             this ref; the mailbox is emptied
//       POST /api/integrations/terra/disconnect-legacy {ref} → the same, for a connection made
//                                                             by the older app version, whose
//                                                             device-held secret WAS the ref (32
//                                                             lowercase hex). A current ref
//                                                             (base64url) is refused here.
//   GET /api/integrations/sources → which sources this server can serve.
// Return URLs: an origin in RETURN_ORIGINS / CORS_ORIGIN (web popup), or exactly
// <scheme>://auth/oura or <scheme>://auth/terra[?a=<attempt>] with a lowercase scheme from
// APP_RETURN_SCHEMES (iOS/Android), no '#'. An Oura app-link return must bind an
// app_challenge; the exchange then needs its verifier, and a web code is refused when a
// verifier is sent (see ../oauth/returns.js). Terra's return carries no secret
// (#terra=1), so it needs none. The redirect state is sealed (AES-256-GCM, see
// ../oauth/state.js): its contents can't be read or altered in transit (the Oura return
// URL and app challenge also appear in the /oura/start query; Terra's return travels
// only in a POST body).
import crypto from "crypto";
import * as oura from "./adapters/oura.js";
import * as terra from "./adapters/terra.js";
import { checkReturn, isAppReturn, startChallenge, codeRedeemable } from "../oauth/returns.js";
import { stateKey, sealState, openState } from "../oauth/state.js";
import { expiringMap } from "../../core/memory.js";

export const basePath = "/api/integrations";

const env = (k) => (process.env[k] || "").trim();
const form = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null)).toString();
const isoDay = (d) => d.toISOString().slice(0, 10);
const validDay = (s, dflt) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? s : dflt);
const KEY = /^[A-Za-z0-9_-]{43,128}$/; // the device's mailbox key: at least 32 random bytes, base64url
/** The Terra reference_id for a device's mailbox key. One-way: the ref can't be turned back into the key. */
export const terraRef = (key) => crypto.createHash("sha256").update(`terra:${key}`).digest("base64url").slice(0, 32);

// JSON that is safe inside <script>, and text that is safe inside an attribute.
const js = (v) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const attr = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// First thing each page does: drop the query (state, Oura's code, Terra's user_id/reference_id) from the address bar and session history entry.
const STRIP = `try{history.replaceState(null,"",location.pathname)}catch(e){}`;
/* The error page for an expired or invalid link: it strips the query too, so Oura's code or
   Terra's user_id and reference_id never stay in the address bar or history. */
function expiredPage(res) {
  res.status(400).set("content-type", "text/html; charset=utf-8").set("cache-control", "no-store").set("referrer-policy", "no-referrer")
    .send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cyra</title><script>${STRIP}</script><p style="font:15px system-ui;padding:24px">Connection link expired or invalid. Please go back to Cyra and try again.</p>`);
}

/* The "done" page. Web (http/https return): hand a message to the opener and close;
   fall back to a redirect. App link (cyrahealth://…): no opener and no postMessage —
   go straight to the app, with a link to tap in case the browser asks first. */
function popupPage(res, { ret, message, frag }) {
  const target = `${ret}#${frag}`;
  res.set("content-type", "text/html; charset=utf-8").set("cache-control", "no-store").set("referrer-policy", "no-referrer");
  if (isAppReturn(ret)) {
    return res.send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cyra</title><p style="font:15px system-ui;padding:24px">Taking you back to Cyra… <a href="${attr(target)}" style="display:inline-block;min-height:44px;line-height:44px;padding:0 8px">Return to Cyra</a></p><script>${STRIP}location.replace(${js(target)});</script>`);
  }
  res.send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cyra</title><p style="font:15px system-ui;padding:24px">Finishing up… you can close this window.</p><script>${STRIP}(function(){var m=${js(message)};try{if(window.opener&&!window.opener.closed){window.opener.postMessage(m,${js(new URL(ret).origin)});window.close();return;}}catch(e){}location.replace(${js(target)});})();</script>`);
}

export function mount(router, ctx, { handoffTtlMs = 5 * 60_000, inboxTtlMs = 7 * 86400000, sweepMs = 60_000 } = {}) {
  const { config } = ctx;
  const key = stateKey(config.authSecret);
  const publicBase = () => (env("PUBLIC_BASE_URL") || env("RENDER_EXTERNAL_URL") || config.baseUrl || "").replace(/\/$/, "");
  const O = () => {
    const mock = env("OURA_MOCK_BASE");
    return { clientId: env("OURA_CLIENT_ID") || (mock ? "test-oura" : ""), clientSecret: env("OURA_CLIENT_SECRET") || (mock ? "test-oura-secret" : ""), authorize: mock ? `${mock}/oauth/authorize` : "https://cloud.ouraring.com/oauth/authorize", token: mock ? `${mock}/oauth/token` : "https://api.ouraring.com/oauth/token", revoke: mock ? `${mock}/oauth/revoke` : "https://api.ouraring.com/oauth/revoke", api: mock ? `${mock}/v2` : "https://api.ouraring.com/v2" };
  };
  const T = () => {
    const mock = env("TERRA_MOCK_BASE");
    return { devId: env("TERRA_DEV_ID") || (mock ? "test-dev" : ""), apiKey: env("TERRA_API_KEY") || (mock ? "test-key" : ""), signingSecret: env("TERRA_SIGNING_SECRET") || (mock ? "test-signing" : ""), api: mock || "https://api.tryterra.co/v2" };
  };
  const ouraOn = () => !!(O().clientId && O().clientSecret);
  const terraOn = () => !!(T().devId && T().apiKey && T().signingSecret);

  // Oura tokens that no device redeemed are revoked at Oura: when the code expires, arrives
  // too late, or is refused (wrong or missing verifier), and at server shutdown. The device
  // never got them, so nobody else could end that grant. Best effort: a crash inside the
  // 5-minute window, or a reply lost on its way to the device, can still leave a grant,
  // which the person can remove in Oura's connected apps. Only a status is ever logged.
  const revokeUnclaimed = async ({ tokens } = {}) => {
    const o = O();
    if (!ouraOn() || !tokens?.access_token) return;
    try {
      const r = await fetch(`${o.revoke}?${form({ access_token: tokens.access_token })}`);
      if (!r.ok) console.warn(`[cyra] oura: unclaimed token revoke answered ${r.status}`);
    } catch { console.warn("[cyra] oura: unclaimed token revoke failed"); }
  };
  const handoffs = expiringMap(handoffTtlMs, { onExpire: revokeUnclaimed }); // one-time codes → { tokens, ac (app challenge or null) } (Oura); each deleted by its own timer
  const inbox = new Map();                    // Terra ref → { rows: Map(date → { at: first arrival, row }) }
  const sweep = () => {
    const now = Date.now();
    handoffs.sweep();
    // A row goes once the NEXT sweep would come after its 7 days, so none outlives them.
    for (const [k, v] of inbox) { for (const [d, row] of v.rows) if (row.at + inboxTtlMs - sweepMs <= now) v.rows.delete(d); if (v.rows.size === 0) inbox.delete(k); }
  };
  const sweeper = setInterval(sweep, sweepMs);
  sweeper.unref?.();
  // Shutdown (Render deploy or restart, see server.js): revoke every Oura grant still waiting.
  if (Array.isArray(ctx.onShutdown)) ctx.onShutdown.push(() => handoffs.drain());
  ctx.integrationsMemory = () => ({ handoffs: handoffs.size, mailboxes: inbox.size, rows: [...inbox.values()].reduce((n, b) => n + b.rows.size, 0) }); // tests

  router.get("/sources", (req, res) => res.json({ healthkit: "on-device", oura: ouraOn(), terra: terraOn() }));

  /* ---------------- Oura ---------------- */
  router.get("/oura/start", (req, res) => {
    const o = O();
    if (!ouraOn()) return res.status(503).json({ error: "Oura is not configured on this server" });
    const ret = checkReturn(req.query.return, { flows: ["oura"] });
    if (!ret) return res.status(400).json({ error: "return URL not allowed" });
    const app = startChallenge(ret, req.query.app_challenge);
    if (app.error) return res.status(400).json({ error: app.error });
    const state = sealState({ s: "oura", ret: ret.href, ac: app.challenge, exp: Date.now() + 10 * 60_000 }, key, "oura");
    res.redirect(302, `${o.authorize}?${form({ response_type: "code", client_id: o.clientId, redirect_uri: `${publicBase()}/api/integrations/oura/callback`, scope: "daily", state })}`);
  });
  router.get("/oura/callback", async (req, res) => {
    const st = openState(req.query.state, key, "oura");
    if (!st || st.s !== "oura") return expiredPage(res);
    if (req.query.error || !req.query.code) return popupPage(res, { ret: st.ret, message: { type: "cyra:oura", error: String(req.query.error || "no_code").slice(0, 64) }, frag: "oura_error=1" });
    try {
      const o = O();
      const r = await fetch(o.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form({ grant_type: "authorization_code", code: req.query.code, redirect_uri: `${publicBase()}/api/integrations/oura/callback`, client_id: o.clientId, client_secret: o.clientSecret }) });
      const tok = await r.json();
      if (!r.ok || !tok.access_token) throw new Error(`token exchange failed (${r.status})`); // never Oura's own text
      const code = crypto.randomBytes(24).toString("hex");
      handoffs.set(code, { tokens: { access_token: tok.access_token, refresh_token: tok.refresh_token || null, expires_at: Date.now() + (tok.expires_in || 86400) * 1000 }, ac: st.ac || null });
      popupPage(res, { ret: st.ret, message: { type: "cyra:oura", code }, frag: `oura=${code}` });
    } catch (e) {
      console.warn(`[cyra] oura callback: ${/^token exchange failed \(\d+\)$/.test(String(e?.message)) ? e.message : "error"}`);
      popupPage(res, { ret: st.ret, message: { type: "cyra:oura", error: "connect_failed" }, frag: "oura_error=1" });
    }
  });
  router.post("/oura/exchange", (req, res) => {
    const h = handoffs.take(String(req.body?.code || "")); // single use, also when the verifier is missing or wrong
    if (!codeRedeemable(h, req.body?.verifier)) { // both or neither
      if (h) handoffs.refuse(h); // refused = no device got the tokens: end that grant at Oura (not awaited)
      return res.status(404).json({ error: "code unknown, used, or expired" });
    }
    res.json(h.tokens);
  });
  const refreshTokens = async (o, refresh) => {
    const r = await fetch(o.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form({ grant_type: "refresh_token", refresh_token: refresh, client_id: o.clientId, client_secret: o.clientSecret }) });
    // Oura down or rate-limiting is not a refusal: throw (the route answers 502) so the device keeps its tokens.
    if (r.status >= 500 || r.status === 429) throw new Error(`token endpoint ${r.status}`);
    const tok = await r.json();
    return r.ok && tok.access_token ? tok : null;
  };
  router.post("/oura/refresh", async (req, res) => {
    const o = O();
    if (!ouraOn()) return res.status(503).json({ error: "Oura is not configured" });
    const refresh = String(req.body?.refresh_token || "");
    if (!refresh) return res.status(400).json({ error: "refresh_token required" });
    try {
      const tok = await refreshTokens(o, refresh);
      if (!tok) return res.status(401).json({ error: "refresh failed" });
      res.json({ access_token: tok.access_token, refresh_token: tok.refresh_token || refresh, expires_at: Date.now() + (tok.expires_in || 86400) * 1000 });
    } catch {
      res.status(502).json({ error: "Oura did not answer" });
    }
  });
  // Pass-through: fetch, normalize, return. Nothing is kept.
  router.post("/oura/pull", async (req, res) => {
    const o = O();
    const token = String(req.body?.access_token || "");
    if (!token) return res.status(400).json({ error: "access_token required" });
    // At most 30 calendar days, both ends included: a `from` earlier than 29 days before `to` is moved up.
    const to = validDay(req.body?.to, isoDay(new Date()));
    const earliest = isoDay(new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86400000));
    const asked = validDay(req.body?.from, earliest);
    const from = asked < earliest ? earliest : asked;
    const get = async (path) => { const r = await fetch(`${o.api}/usercollection/${path}?${form({ start_date: from, end_date: to })}`, { headers: { authorization: `Bearer ${token}` } }); if (r.status === 401) throw Object.assign(new Error("unauthorized"), { status: 401 }); if (!r.ok) throw new Error(`${path} ${r.status}`); return (await r.json()).data || []; };
    try {
      const [readiness, dailySleep, sleep] = await Promise.all([get("daily_readiness"), get("daily_sleep"), get("sleep")]);
      res.json({ rows: oura.normalize({ readiness, dailySleep, sleep }), from, to });
    } catch (e) {
      res.status(e.status === 401 ? 401 : 502).json({ error: e.status === 401 ? "token expired — refresh" : "Oura did not answer" });
    }
  });
  // Disconnect: ask Oura to revoke Cyra's access. If the access token has expired, the
  // refresh token gets a fresh one first, which is then revoked. Nothing is kept.
  router.post("/oura/revoke", async (req, res) => {
    const o = O();
    if (!ouraOn()) return res.status(503).json({ error: "Oura is not configured on this server" });
    const access = String(req.body?.access_token || ""), refresh = String(req.body?.refresh_token || "");
    if (!access && !refresh) return res.status(400).json({ error: "access_token required" });
    const revoke = async (t) => (await fetch(`${o.revoke}?${form({ access_token: t })}`)).ok;
    try {
      if (access && (await revoke(access))) return res.json({ ok: true });
      if (refresh) { const tok = await refreshTokens(o, refresh); if (tok && (await revoke(tok.access_token))) return res.json({ ok: true }); }
      res.status(502).json({ error: "Oura didn't confirm — remove Cyra under Oura's account settings, then try again" });
    } catch {
      res.status(502).json({ error: "Oura did not answer" });
    }
  });

  /* ---------------- Terra ---------------- */
  const mailboxKey = (body) => {
    if (body?.ref !== undefined) return { error: "send {key}: the mailbox is opened with the device's key, not a ref" };
    const k = String(body?.key || "");
    return KEY.test(k) ? { ref: terraRef(k) } : { error: "key must be the device's secret mailbox key (32+ random bytes, base64url: 43-128 characters)" };
  };
  router.post("/terra/session", async (req, res) => {
    const t = T();
    if (!terraOn()) return res.status(503).json({ error: "Fitbit/Garmin/Whoop sync is not configured on this server" });
    const mk = mailboxKey(req.body), ret = checkReturn(req.body?.return, { flows: ["terra"] });
    if (mk.error) return res.status(400).json({ error: mk.error });
    if (!ret) return res.status(400).json({ error: "return URL not allowed" });
    const state = sealState({ s: "terra", ret: ret.href, exp: Date.now() + 30 * 60_000 }, key, "terra");
    const done = `${publicBase()}/api/integrations/terra/done?state=${encodeURIComponent(state)}`;
    try {
      const r = await fetch(`${t.api}/auth/generateWidgetSession`, { method: "POST", headers: { "content-type": "application/json", "dev-id": t.devId, "x-api-key": t.apiKey }, body: JSON.stringify({ reference_id: mk.ref, providers: env("TERRA_PROVIDERS") || "FITBIT,GARMIN,WHOOP", language: "en", auth_success_redirect_url: `${done}&ok=1`, auth_failure_redirect_url: `${done}&ok=0` }) });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(`widget ${r.status}`); // never Terra's own text
      res.json({ url: j.url });
    } catch (e) {
      console.warn(`[cyra] terra session: ${/^widget \d+$/.test(String(e?.message)) ? e.message : "error"}`);
      res.status(502).json({ error: "Could not start the connection" });
    }
  });
  // Terra appends user_id, reference_id and more to this URL. The page uses only the sealed
  // state and `ok`, never echoes anything else, and removes the query from the address bar.
  router.get("/terra/done", (req, res) => {
    const st = openState(req.query.state, key, "terra");
    if (!st || st.s !== "terra") return expiredPage(res);
    const ok = String(req.query.ok) === "1";
    popupPage(res, { ret: st.ret, message: { type: "cyra:terra", ok }, frag: ok ? "terra=1" : "terra_error=1" });
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
    if (typeof ref === "string" && ref && rows.length) {
      const box = inbox.get(ref) || { rows: new Map() };
      for (const r of rows) {
        const prev = box.rows.get(r.date);
        // an update to a day merges into its row but keeps the day's first arrival time, so it can't stretch the 7 days
        box.rows.set(r.date, { at: prev?.at ?? Date.now(), row: { ...(prev?.row || {}), ...Object.fromEntries(Object.entries(r).filter(([, v]) => v != null)) } });
      }
      if (box.rows.size > 400) for (const k of [...box.rows.keys()].sort().slice(0, box.rows.size - 400)) box.rows.delete(k);
      inbox.set(ref, box);
      if (inbox.size > 50_000) inbox.delete(inbox.keys().next().value);
    }
    res.json({ ok: true, queued: rows.length });
  });
  // POST, not GET: the key travels only in the body, never in a URL that request logs or proxies might record.
  router.post("/terra/inbox", (req, res) => {
    const mk = mailboxKey(req.body);
    if (mk.error) return res.status(400).json({ error: mk.error });
    sweep();
    const box = inbox.get(mk.ref);
    inbox.delete(mk.ref);
    res.json({ rows: box ? [...box.rows.values()].map((x) => x.row).sort((a, b) => a.date.localeCompare(b.date)) : [] });
  });
  // Disconnect: find the Terra user(s) registered under this device's ref, ask Terra to
  // deauthenticate each one, and empty the mailbox. The mailbox is emptied as soon as a
  // disconnect is asked for, even if Terra then doesn't confirm (the app collects what is
  // waiting first). Nothing is kept.
  router.post("/terra/disconnect", async (req, res) => {
    const mk = mailboxKey(req.body);
    if (mk.error) return res.status(400).json({ error: mk.error });
    await endTerra(mk.ref, res);
  });
  // The older app version kept its ref itself as the mailbox secret (32 lowercase hex), so
  // holding it is the same authority it always was. Today's refs are base64url hashes that
  // Terra and its redirects see, so they are refused here: only the key can end those.
  router.post("/terra/disconnect-legacy", async (req, res) => {
    const ref = String(req.body?.ref || "");
    if (req.body?.key !== undefined || !/^[0-9a-f]{32}$/.test(ref)) return res.status(400).json({ error: "ref must be a connection id from the older app version (32 lowercase hex)" });
    await endTerra(ref, res);
  });
  async function endTerra(ref, res) {
    const mk = { ref };
    inbox.delete(mk.ref);
    if (!terraOn()) return res.status(503).json({ error: "Fitbit/Garmin/Whoop sync is not configured on this server" });
    const t = T(), headers = { "dev-id": t.devId, "x-api-key": t.apiKey };
    try {
      const r = await fetch(`${t.api}/userInfo?${form({ reference_id: mk.ref })}`, { headers });
      if (!r.ok) throw new Error(`userInfo ${r.status}`);
      const j = await r.json();
      const users = [...(Array.isArray(j.users) ? j.users : []), ...(j.user ? [j.user] : [])];
      const ids = [...new Set(users.map((u) => u?.user_id).filter((x) => typeof x === "string" && x))];
      for (const id of ids) {
        const d = await fetch(`${t.api}/auth/deauthenticateUser?${form({ user_id: id })}`, { method: "DELETE", headers });
        if (!d.ok) throw new Error(`deauthenticate ${d.status}`);
      }
      inbox.delete(mk.ref); // again, in case a delivery landed meanwhile
      res.json({ ok: true, disconnected: ids.length });
    } catch (e) {
      console.warn(`[cyra] terra disconnect: ${String(e.message || "error").slice(0, 120)}`);
      res.status(502).json({ error: "Terra didn't confirm the disconnect — try again, or remove Cyra (it may be listed as Terra) under connected apps in your device account" });
    }
  }
}
