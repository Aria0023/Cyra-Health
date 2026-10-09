/* Wearables — real ingestion, privacy first.
   Apple Health / Health Connect: read ON THIS PHONE through the native bridge
   (Capacitor plugin "CyraHealth", see docs). Cyra never sends these readings
   anywhere; they leave the phone only inside an encrypted backup the user chooses
   to save. A browser can't read them, so the web build doesn't offer this row.
   Oura: OAuth in a popup (web) or a sign-in window (phone app). The backend
   exchanges the code for tokens (it holds the client secret) and keeps them in
   memory for at most 5 minutes until this device collects them. Tokens nobody
   collects in time, or that are claimed with the wrong check, are revoked at Oura on
   a best-effort basis; if Cyra's server crashes first or Oura doesn't answer, remove
   Cyra under connected apps in your Oura account. From then on the tokens are kept
   on this device. Each sync sends the access token (and, once it has expired, the
   refresh token) to the backend, which fetches 30 days of Oura's readiness and sleep
   records, keeps only temperature, resting heart rate, HRV and sleep score, and
   returns those without writing tokens or readings to disk. Disconnect — and Delete
   everything — asks the backend to revoke the token at Oura.
   Fitbit / Garmin / Whoop: through Terra, a health-data service (the Terra window
   offers only these three). This device makes a secret mailbox key and keeps it (it is
   also inside any encrypted backup); the backend registers only a hash of it with
   Terra, so the reference Terra echoes back can't open the mailbox. Terra keeps the device connection and data under its own
   policy and sends its updates to the backend, which keeps only temperature, resting
   heart rate, HRV and sleep, in memory (never on disk, at most 7 days after they
   arrive), until this device drains the mailbox with the key — on launch, when the
   app comes back to the foreground, and on Sync. Disconnect — and Delete everything
   — collects what is waiting, then asks the backend to end the Terra connection and
   drop the mailbox. A connection
   made by an older version (state { ref }, no key) is ended through
   /terra/disconnect-legacy.
   Every source yields the same per-day row: { date, temp (°C deviation), rhr, hrv, sleep }. */
import { API_BASE, apiPost, apiFetch } from "./api.js";
import { isNative, platform, hasPlugin, CyraHealth, appReturnUrl, newAppVerifier, waitForAppUrl } from "./native.js";

/** The sources this build can offer. Apple Health / Health Connect only exist in the phone app. */
export const SOURCES = [
  ...(isNative()
    ? [platform() === "android"
      ? { id: "healthkit", name: "Health Connect", what: "skin temperature, resting heart rate, HRV, sleep · read on this phone" }
      : { id: "healthkit", name: "Apple Watch · Health app", what: "wrist temperature, resting heart rate, HRV, sleep · read on this phone" }]
    : []),
  { id: "oura", name: "Oura Ring", what: "temperature, resting heart rate, HRV, sleep score · passes through Cyra's server, readings not stored", viaServer: true },
  { id: "terra", name: "Fitbit · Garmin · Whoop", what: "through Terra, a health-data service · waits on Cyra's server up to 7 days", viaServer: true },
];
/** Sources that go through Cyra's server, need a disclosure before connecting, and can be disconnected. */
export const VIA_SERVER = new Set(SOURCES.filter((s) => s.viaServer).map((s) => s.id));
export const DEMO_WEARABLES = import.meta.env.VITE_DEMO_WEARABLES === "true";

/* Native bridge contract (implemented by the iOS/Android wrapper, item A12-7):
     CyraHealth.available()                → { available: boolean }
     CyraHealth.requestAuthorization()     → { granted: boolean, grantedTypes?: string[], requestedTypes?: string[] }
     CyraHealth.readDaily({ from, to })    → { days: [{ date, temp, rhr, hrv, sleep }], needsAuthorization?: boolean } */
const bridge = () => (isNative() ? CyraHealth : null);
const HEALTH_CONNECT_TYPES = 4; // resting heart rate, HRV, sleep, skin temperature (android/…/CyraHealthPlugin.kt)
/* Without VITE_API_BASE there is no server to connect through, and nothing is requested. */
const needServer = () => { if (!API_BASE) throw new Error("This version of the app isn't set up to connect accounts yet"); };
const err = (message, code) => Object.assign(new Error(message), { code });
const SERVER_SILENT = "Cyra's server didn't answer — try again in a moment";

/* Local calendar day (the bridge contract and Oura both count days in local time; a UTC
   date would drop "today" east of UTC early in the day). */
const isoDay = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const apiOrigin = () => new URL(API_BASE).origin;
const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
/** The Terra mailbox key: 32 random bytes, base64url. Stored only in this device's Cyra record
    and in any encrypted backup of it (so also on any device that backup is restored to). On the
    web that record is unencrypted browser storage, so an OS or browser-profile backup of the
    computer copies it; on iPhone and Android it is excluded from system backup. It is sent only
    in request bodies, never in a URL. Cyra's server uses it only while handling the request (it
    keeps a one-way hash, never the key). */
export const newKey = () => b64u(crypto.getRandomValues(new Uint8Array(32)));

/** Merge per-day rows; later rows win field by field. A real reading clears the demo mark. */
export function mergeRows(existing, incoming) {
  const by = new Map(existing.map((r) => [r.date, { ...r }]));
  for (const r of incoming) {
    const cur = by.get(r.date) || { date: r.date, temp: null, rhr: null, hrv: null, sleep: null };
    for (const k of ["temp", "rhr", "hrv", "sleep"]) if (r[k] != null) cur[k] = r[k];
    cur.sourceId = r.sourceId || cur.sourceId;
    if (r.demo) cur.demo = true; else delete cur.demo;
    by.set(r.date, cur);
  }
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Open a popup synchronously (inside the user's tap) and wait for the backend's done-page message. */
function popupFlow(open, type, timeoutMs = 5 * 60_000) {
  const win = window.open("about:blank", "cyra-connect", "popup,width=480,height=720");
  if (!win) return Promise.reject(err("Your browser blocked the sign-in window — allow pop-ups for Cyra and try again", "OPEN_FAILED"));
  return new Promise((resolve, reject) => {
    const origin = apiOrigin();
    const timer = setTimeout(() => { cleanup(); reject(err("The connection window timed out", "TIMEOUT")); }, timeoutMs);
    const onMsg = (e) => { if (e.origin !== origin || e.data?.type !== type) return; cleanup(); if (e.data.error || e.data.ok === false) reject(err("The connection didn't complete", "INCOMPLETE")); else resolve(e.data); };
    const poll = setInterval(() => { if (win.closed) { cleanup(); reject(err("The connection window was closed", "CLOSED")); } }, 700);
    const cleanup = () => { clearTimeout(timer); clearInterval(poll); window.removeEventListener("message", onMsg); try { if (!win.closed) win.close(); } catch { /* cross-origin */ } };
    window.addEventListener("message", onMsg);
    open(win).catch((e) => { cleanup(); reject(e); });
  });
}

async function sources() {
  let r;
  try { r = await apiFetch("/api/integrations/sources"); } catch { throw new Error(SERVER_SILENT); }
  if (!r.ok) throw new Error(SERVER_SILENT);
  try { return await r.json(); } catch { throw new Error(SERVER_SILENT); }
}

/* What a window that didn't finish means, worded for each source. Terra's state is saved
   before its window opens, so a late approval can still be collected with Sync. */
function windowError(id, e) {
  if (id === "terra") {
    if (e?.code === "CLOSED") return new Error("The connection window was closed. If you already approved Cyra there, tap Sync to finish, or tap Disconnect to end it.");
    if (e?.code === "TIMEOUT") return new Error("Cyra stopped waiting for the connection. If you finished signing in anyway, tap Sync to finish.");
  }
  if (id === "oura") {
    if (e?.code === "CLOSED") return new Error("The connection window was closed before Cyra finished connecting to Oura. If you already approved Cyra there, remove Cyra in your Oura account's connected apps, then tap Connect to try again.");
    if (e?.code === "TIMEOUT") return new Error("Cyra stopped waiting for Oura and didn't finish connecting. If you approved Cyra there anyway, remove it in your Oura account's connected apps. Tap Connect to try again.");
  }
  return e;
}

/** Connect a source. Resolves { rows, state, notice? }: state is what the device keeps to sync
    and disconnect; notice is a sentence to show with the result.
    onPending(state) — Terra only: called before the connection window opens, so the key is
    kept even if the window is closed late or the app is interrupted. */
export async function connectSource(id, { onStatus = () => {}, onPending = () => {} } = {}) {
  if (id === "healthkit") {
    const hk = bridge();
    if (!hk) throw new Error("Apple Health and Health Connect are read inside the Cyra app on your phone — in a browser there's nothing to connect");
    if (!hasPlugin("CyraHealth") || !(await hk.available()).available) throw new Error("Health data isn't available on this device");
    const auth = await hk.requestAuthorization();
    const granted = Array.isArray(auth?.grantedTypes) ? auth.grantedTypes : null;
    const requested = Array.isArray(auth?.requestedTypes) ? auth.requestedTypes.length : HEALTH_CONNECT_TYPES;
    if (!auth?.granted && !(granted && granted.length)) throw err("Cyra wasn't given permission to read health data", "NOT_GRANTED");
    const out = await hk.readDaily({ from: isoDay(-30), to: isoDay(0) });
    const rows = (out?.days || []).map((d) => ({ ...d, sourceId: "healthkit" }));
    if (out?.needsAuthorization && !rows.length) throw err("No Health data shared yet — check Settings → Health → Data Access & Devices → Cyra.", "NEEDS_AUTH");
    const notice = granted && granted.length < requested ? "Cyra can read only some of the health data it asked for. You can change this in Health Connect → App permissions → Cyra." : null;
    return { rows, state: { connectedAt: Date.now() }, notice };
  }
  if (id === "oura") {
    needServer();
    let code, verifier;
    try {
      if (isNative()) {
        const s = await sources();
        if (!s.oura) throw new Error("Oura isn't set up on this server yet");
        const app = await newAppVerifier();
        verifier = app.verifier;
        const ret = appReturnUrl("oura"); // this attempt's own link
        const back = await waitForAppUrl(ret, `${API_BASE}/api/integrations/oura/start?return=${encodeURIComponent(ret)}&app_challenge=${app.challenge}`);
        code = back.get("oura");
        if (back.has("oura_error") || !code) throw new Error("The connection didn't complete");
      } else {
        const ret = window.location.origin + window.location.pathname;
        const msg = await popupFlow(async (win) => {
          const s = await sources();
          if (!s.oura) throw new Error("Oura isn't set up on this server yet");
          win.location.assign(`${API_BASE}/api/integrations/oura/start?return=${encodeURIComponent(ret)}`);
        }, "cyra:oura");
        code = msg.code;
      }
    } catch (e) { throw windowError("oura", e); }
    let tokens;
    try { tokens = await apiPost("/api/integrations/oura/exchange", verifier ? { code, verifier } : { code }); }
    catch (e) { throw new Error(e?.status ? "The connection didn't complete — tap Connect to try again" : `${SERVER_SILENT}. If Cyra now shows up in your Oura account's connected apps, you can remove it there.`); }
    onStatus("Oura connected — fetching up to 30 days through Cyra's server");
    const state = { connectedAt: Date.now(), tokens };
    try { return { rows: await pullOura(tokens), state }; }
    catch (e) { return { rows: [], state, notice: e.message }; } // connected; Sync can try again
  }
  if (id === "terra") {
    needServer();
    const key = newKey();
    const pending = { key, pending: true, connectedAt: Date.now() };
    try {
      if (isNative()) {
        const s = await sources();
        if (!s.terra) throw new Error("Fitbit, Garmin and Whoop sync isn't set up on this server yet");
        const ret = appReturnUrl("terra"); // this attempt's own link
        let url;
        try { ({ url } = await apiPost("/api/integrations/terra/session", { key, return: ret })); } catch { throw new Error(SERVER_SILENT); }
        onPending(pending);
        const back = await waitForAppUrl(ret, url);
        if (back.get("terra") !== "1") throw new Error("The connection didn't complete");
      } else {
        const ret = window.location.origin + window.location.pathname;
        await popupFlow(async (win) => {
          const s = await sources();
          if (!s.terra) throw new Error("Fitbit, Garmin and Whoop sync isn't set up on this server yet");
          let url;
          try { ({ url } = await apiPost("/api/integrations/terra/session", { key, return: ret })); } catch { throw new Error(SERVER_SILENT); }
          onPending(pending);
          win.location.assign(url);
        }, "cyra:terra");
      }
    } catch (e) { throw windowError("terra", e); }
    onStatus("Connected. Terra will send your recent readings over the next few minutes; Cyra collects them when you open the app or tap Sync.");
    const state = { connectedAt: Date.now(), key };
    try { return { rows: await drainTerra(key), state }; }
    catch { return { rows: [], state }; } // connected, nothing collected yet
  }
  throw new Error("Unknown source");
}

/* Oura failures, worded for what happened: no answer from Cyra's server, a sign-in that
   has expired (the tokens are dropped and Connect comes back), or Oura itself not answering. */
async function pullOura(tokens) {
  // 30 calendar days, today included (Oura's start_date and end_date both count).
  const attempt = (t) => apiPost("/api/integrations/oura/pull", { access_token: t.access_token, from: isoDay(-29), to: isoDay(0) });
  const expired = () => err("Your Oura sign-in expired — tap Connect to reconnect", "OURA_EXPIRED");
  const toRows = (out) => (out.rows || []).map((r) => ({ ...r, sourceId: "oura" }));
  try { return toRows(await attempt(tokens)); }
  catch (e) {
    if (e?.network) throw new Error("Couldn't reach Cyra's server — check your connection");
    if (e?.status !== 401) throw new Error("Oura didn't answer — try syncing again in a moment");
    if (!tokens.refresh_token) throw expired();
    let fresh;
    try { fresh = await apiPost("/api/integrations/oura/refresh", { refresh_token: tokens.refresh_token }); }
    catch (e2) { // only a refusal (401) means the sign-in is gone; an outage keeps the tokens for the next Sync
      if (e2?.network) throw new Error("Couldn't reach Cyra's server — check your connection");
      if (e2?.status === 401) throw expired();
      throw new Error("Oura didn't answer — try syncing again in a moment");
    }
    Object.assign(tokens, fresh);
    try { return toRows(await attempt(tokens)); }
    catch (e3) { if (e3?.network) throw new Error("Couldn't reach Cyra's server — check your connection"); if (e3?.status === 401) throw expired(); throw new Error("Oura didn't answer — try syncing again in a moment"); }
  }
}

/** Collect whatever waits in this device's Terra mailbox. POST: the key travels in the body, never a URL. */
export async function drainTerra(key) {
  let out;
  try { out = await apiPost("/api/integrations/terra/inbox", { key }); } catch { throw new Error(SERVER_SILENT); }
  return (out.rows || []).map((x) => ({ ...x, sourceId: "terra" }));
}

/** Re-sync an already connected source using the state kept on the device. Resolves { rows, state }. */
export async function syncSource(id, state) {
  if (id === "healthkit") { const r = await connectSource("healthkit"); return { rows: r.rows, state, notice: r.notice }; }
  if (id === "oura") {
    needServer();
    if (!state?.tokens) throw err("Your Oura sign-in expired — tap Connect to reconnect", "OURA_EXPIRED");
    const tokens = { ...state.tokens };
    const rows = await pullOura(tokens);
    const next = { ...state, tokens };
    delete next.pending; delete next.restored; // a good pull confirms a connection restored from a backup
    return { rows, state: next };
  }
  if (id === "terra") {
    needServer();
    if (!state?.key) throw err("This Fitbit, Garmin or Whoop connection was set up by an older version of Cyra — tap Disconnect, then Connect again. If Disconnect can't end it, remove Cyra (it may be listed as Terra) under connected apps in that account.", "TERRA_OLD");
    const rows = await drainTerra(state.key);
    return { rows, state: rows.length && state.pending ? { connectedAt: state.connectedAt || Date.now(), key: state.key } : state };
  }
  return { rows: [], state };
}

/** End a server-mediated connection: Terra deauthenticates the user and the mailbox is dropped;
    Oura's token is revoked. Rejects when Cyra's server couldn't confirm it, and (code NO_KEY)
    when this device holds nothing that could end it — it never reports an end it didn't get. */
/** Where to end a connection Cyra couldn't end itself, for each source. */
export const disconnectHelp = (id) => (id === "terra" ? "remove Cyra (it may be listed as Terra) under connected apps in that account" : "remove Cyra in your Oura account's connected apps");
const NO_KEY_TERRA = "Cyra can't end this Fitbit, Garmin or Whoop connection itself — remove Cyra (it may be listed as Terra) under connected apps in that account";
const NO_KEY_OURA = "Cyra can't end this Oura connection itself — remove Cyra in your Oura account's connected apps";
export async function disconnectSource(id, state, { timeoutMs = 15000 } = {}) {
  needServer();
  if (id === "terra") {
    if (state?.key) await apiPost("/api/integrations/terra/disconnect", { key: state.key }, { timeoutMs });
    else if (typeof state?.ref === "string") await apiPost("/api/integrations/terra/disconnect-legacy", { ref: state.ref }, { timeoutMs }); // made by an older version
    else throw err(NO_KEY_TERRA, "NO_KEY");
    return true;
  }
  if (id === "oura") {
    const t = state?.tokens;
    if (!(t?.access_token || t?.refresh_token)) throw err(NO_KEY_OURA, "NO_KEY");
    await apiPost("/api/integrations/oura/revoke", { access_token: t.access_token || "", ...(t.refresh_token ? { refresh_token: t.refresh_token } : {}) }, { timeoutMs });
    return true;
  }
  return true;
}
