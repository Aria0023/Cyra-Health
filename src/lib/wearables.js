/* Wearables — real ingestion, privacy first.
   Apple Health / Health Connect: read ON THIS DEVICE through the native bridge
   (Capacitor plugin "CyraHealth", see docs). Never uploaded.
   Oura: OAuth in a popup (web) or a sign-in window (phone app); the tokens
   stay on this device; the backend only proxies each pull (fetch → normalize →
   return) and stores nothing.
   Fitbit / Garmin / Whoop: the Terra widget in a popup (web) or a sign-in window
   (phone app); Terra's webhooks wait in the backend's in-memory mailbox (at most
   7 days) under an opaque id until this device drains it.
   Every source yields the same per-day row: { date, temp (°C deviation), rhr, hrv, sleep }. */
import { API_BASE, apiPost } from "./api.js";
import { isNative, platform, hasPlugin, CyraHealth, appReturnUrl, newAppVerifier, waitForAppUrl } from "./native.js";

export const SOURCES = [
  platform() === "android"
    ? { id: "healthkit", name: "Health Connect", what: "skin temperature, heart rate, HRV, sleep · read on this device" }
    : { id: "healthkit", name: "Apple Watch · Health app", what: "temperature, heart rate, sleep · read on this device" },
  { id: "oura", name: "Oura Ring", what: "temperature trend, HRV, readiness" },
  { id: "terra", name: "Fitbit · Garmin · Whoop", what: "via a secure aggregator" },
];
export const DEMO_WEARABLES = import.meta.env.VITE_DEMO_WEARABLES === "true";

/* Native bridge contract (implemented by the iOS/Android wrapper, item A12-7):
     CyraHealth.available()                → { available: boolean }
     CyraHealth.requestAuthorization()     → { granted: boolean }
     CyraHealth.readDaily({ from, to })    → { days: [{ date, temp, rhr, hrv, sleep }] } */
const bridge = () => (isNative() ? CyraHealth : null);
/* On the phone the API base is baked in at build time (VITE_API_BASE); without it
   there is no server to send the browser to. */
const needServer = () => { if (!API_BASE) throw new Error("This version of the app isn't set up to connect accounts yet"); };

/* Local calendar day (the bridge contract and Oura both count days in local time; a UTC
   date would drop "today" east of UTC early in the day). */
const isoDay = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const apiOrigin = () => (API_BASE ? new URL(API_BASE).origin : window.location.origin);
export const newRef = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join(""));

/** Merge per-day rows; later rows win field by field. */
export function mergeRows(existing, incoming) {
  const by = new Map(existing.map((r) => [r.date, { ...r }]));
  for (const r of incoming) { const cur = by.get(r.date) || { date: r.date, temp: null, rhr: null, hrv: null, sleep: null }; for (const k of ["temp", "rhr", "hrv", "sleep"]) if (r[k] != null) cur[k] = r[k]; cur.sourceId = r.sourceId || cur.sourceId; by.set(r.date, cur); }
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Open a popup synchronously (inside the user's tap) and wait for the backend's done-page message. */
function popupFlow(open, type, timeoutMs = 5 * 60_000) {
  const win = window.open("about:blank", "cyra-connect", "popup,width=480,height=720");
  if (!win) return Promise.reject(new Error("Your browser blocked the sign-in window — allow pop-ups for Cyra and try again"));
  return new Promise((resolve, reject) => {
    const origin = apiOrigin();
    const timer = setTimeout(() => { cleanup(); reject(new Error("The connection window timed out")); }, timeoutMs);
    const onMsg = (e) => { if (e.origin !== origin || e.data?.type !== type) return; cleanup(); if (e.data.error || e.data.ok === false) reject(new Error("The connection didn't complete")); else resolve(e.data); };
    const poll = setInterval(() => { if (win.closed) { cleanup(); reject(new Error("The connection window was closed")); } }, 700);
    const cleanup = () => { clearTimeout(timer); clearInterval(poll); window.removeEventListener("message", onMsg); try { if (!win.closed) win.close(); } catch { /* cross-origin */ } };
    window.addEventListener("message", onMsg);
    open(win).catch((err) => { cleanup(); reject(err); });
  });
}

async function sources() {
  const r = await fetch(`${API_BASE}/api/integrations/sources`);
  if (!r.ok) throw new Error("Couldn't reach the connection service");
  try { return await r.json(); } catch { throw new Error("Couldn't reach the connection service"); }
}

/** Connect a source. Resolves { rows, state } where state is what the device must keep to sync again. */
export async function connectSource(id, { ref, onStatus = () => {} } = {}) {
  if (id === "healthkit") {
    const hk = bridge();
    if (!hk) throw new Error("Apple Health and Health Connect are read inside the Cyra app on your phone — in a browser there's nothing to connect");
    if (!hasPlugin("CyraHealth") || !(await hk.available()).available) throw new Error("Health data isn't available on this device");
    if (!(await hk.requestAuthorization()).granted) throw new Error("Cyra wasn't given permission to read health data");
    const { days } = await hk.readDaily({ from: isoDay(-30), to: isoDay(0) });
    return { rows: (days || []).map((d) => ({ ...d, sourceId: "healthkit" })), state: { connectedAt: Date.now() } };
  }
  if (id === "oura") {
    let code, verifier;
    if (isNative()) {
      needServer();
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
    onStatus("Oura connected — importing the last 30 days");
    const tokens = await apiPost("/api/integrations/oura/exchange", verifier ? { code, verifier } : { code });
    const rows = await pullOura(tokens);
    return { rows, state: { connectedAt: Date.now(), tokens } };
  }
  if (id === "terra") {
    const theRef = ref || newRef();
    if (isNative()) {
      needServer();
      const s = await sources();
      if (!s.terra) throw new Error("Fitbit, Garmin and Whoop sync isn't set up on this server yet");
      const ret = appReturnUrl("terra"); // this attempt's own link
      const { url } = await apiPost("/api/integrations/terra/session", { ref: theRef, return: ret });
      const back = await waitForAppUrl(ret, url);
      if (back.get("terra") !== "1") throw new Error("The connection didn't complete");
    } else {
      const ret = window.location.origin + window.location.pathname;
      await popupFlow(async (win) => {
        const s = await sources();
        if (!s.terra) throw new Error("Fitbit, Garmin and Whoop sync isn't set up on this server yet");
        const { url } = await apiPost("/api/integrations/terra/session", { ref: theRef, return: ret });
        win.location.assign(url);
      }, "cyra:terra");
    }
    onStatus("Connected — your device's history arrives over the next few minutes");
    const rows = await drainTerra(theRef);
    return { rows, state: { connectedAt: Date.now(), ref: theRef } };
  }
  throw new Error("Unknown source");
}

async function pullOura(tokens) {
  const attempt = (t) => apiPost("/api/integrations/oura/pull", { access_token: t.access_token, from: isoDay(-30), to: isoDay(0) });
  try { return (await attempt(tokens)).rows.map((r) => ({ ...r, sourceId: "oura" })); }
  catch (e) {
    if (!/HTTP 401/.test(e.message) || !tokens.refresh_token) throw new Error("Oura didn't answer — try syncing again in a moment");
    const fresh = await apiPost("/api/integrations/oura/refresh", { refresh_token: tokens.refresh_token });
    Object.assign(tokens, fresh);
    return (await attempt(tokens)).rows.map((r) => ({ ...r, sourceId: "oura" }));
  }
}
async function drainTerra(ref) {
  // POST: the reference id is the only key to the mailbox, so it never goes in a URL.
  let out;
  try { out = await apiPost("/api/integrations/terra/inbox", { ref }); } catch { throw new Error("Couldn't reach the connection service"); }
  return (out.rows || []).map((x) => ({ ...x, sourceId: "terra" }));
}

/** Re-sync an already connected source using the state kept on the device. */
export async function syncSource(id, state) {
  if (id === "healthkit") return (await connectSource("healthkit")).rows;
  if (id === "oura") return pullOura(state.tokens);
  if (id === "terra") return drainTerra(state.ref);
  return [];
}
