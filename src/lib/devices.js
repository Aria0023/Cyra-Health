/* "Connect your devices" (Task 2, docs/plans/account-wearables-evidence.md): one list of every device source, the same
   everywhere it appears (the optional registration step, the dismissible Home card's sheet, the top of You → Data
   sources). Pure: no React, storage or network. App.jsx passes in the platform, the build, what the server said it can
   serve (GET /api/integrations/sources → { oura, terra }) and her connections; each row says what it reads and where the
   readings go in plain words, and what one tap does.

   Where the readings go (checked against the code, not the brief's shorthand):
   - Apple Health / Health Connect: read on the phone by the app's native bridge (lib/wearables.js); never sent to a server.
   - Oura: each sync goes through Solia Health's server, which fetches the readings from Oura and passes them to the phone
     without storing them (backend/src/modules/integrations: "returns normalized rows without storing them").
   - Fitbit · Garmin · Whoop through Terra: Terra keeps its own copy under its policy; Solia Health's server holds the
     daily readings in memory, never on disk, until the phone collects them, 7 days at most (the same module's mailbox).
     So this row does NOT say "not kept": it says how long the server holds them.

   Row states:
     connected   Connected · synced <when>      → Disconnect
     pending     Waiting to finish               → Sync
     available   Not connected                   → Connect (one tap)
     elsewhere   "In the iPhone app" / "In the Android app" (this source can't be read here) → no button
     notSetUp    "Not set up yet" (the server reports no keys for it, or this build has no server) → no button */

export const DEVICE_COPY = Object.freeze({
  title: "Connect your devices",
  lead: "Optional. Solia Health works fully without a device. A connected one adds your nightly temperature, resting heart rate, HRV and sleep.",
  stepTitle: "Connect a device?",
  stepSub: "You can skip this and connect one later from Home or You.",
  reads: "Reads",
  where: "Where it goes",
  connect: "Connect",
  connecting: "Connecting…",
  sync: "Sync",
  disconnect: "Disconnect",
  disconnecting: "Disconnecting…",
  connected: (when) => (when ? `Connected · synced ${when}` : "Connected"),
  pending: "Waiting to finish. Tap Sync once you've approved Solia Health.",
  inIphone: "In the iPhone app",
  inAndroid: "In the Android app",
  notSetUp: "Not set up yet",
  notSetUpWhy: "This server doesn't have the keys for it yet.",
  noServerWhy: "This version of Solia Health has no server to connect it through.",
  homeTitle: "Connect a device",
  homeBody: "Add sleep, temperature and heart-rate readings from your watch, ring or phone. Optional, and you choose what connects.",
  homeOpen: "See devices",
  homeHide: "Not now",
  homeHidden: "Hidden. Connect a device any time from You → Data sources.",
  youOpen: "Connect a device",
  demoNote: "This demo build shows illustrative readings. Nothing is really connected or sent.",
});

const ROWS = [
  { id: "apple", source: "healthkit", name: "Apple Health", app: "ios",
    reads: "Wrist temperature, resting heart rate, HRV and sleep from your Apple Watch or iPhone.",
    where: "Read on your iPhone by the Solia Health app. Never sent to a server." },
  { id: "healthconnect", source: "healthkit", name: "Health Connect", app: "android",
    reads: "Skin temperature, resting heart rate, HRV and sleep from the apps and watches you use with Health Connect.",
    where: "Read on your Android phone by the Solia Health app. Never sent to a server." },
  { id: "oura", source: "oura", name: "Oura Ring", server: true,
    reads: "Temperature, resting heart rate, HRV and sleep score.",
    where: "Each sync goes through Solia Health's server, which passes your readings to this device without keeping them. Oura knows you connected Solia Health." },
  { id: "terra", source: "terra", name: "Fitbit · Garmin · Whoop", server: true,
    reads: "Temperature, resting heart rate, HRV and sleep, through Terra, a health-data service.",
    where: "Terra keeps its own copy under its privacy policy. Solia Health's server holds your daily readings in memory until this device collects them, 7 days at most, then deletes them." },
];

/** "today", "yesterday", "3 days ago" (whole local days between the two times). */
export function syncedWords(ms, nowMs = Date.now()) {
  if (!Number.isFinite(ms)) return null;
  const day = (t) => { const d = new Date(t); d.setHours(12, 0, 0, 0); return d.getTime(); };
  const n = Math.round((day(nowMs) - day(ms)) / 86_400_000);
  return n <= 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`;
}

/** The rows, in order: Apple Health, Health Connect, Oura, Fitbit · Garmin · Whoop.
    c = { native, platform: "ios" | "android" | "web", flags: { deviceSync, wearables }, server, serverSources: { oura, terra } | null,
          wearSources, demo, nowMs } */
export function deviceRows(c = {}) {
  const f = c.flags || {};
  const plat = c.native ? c.platform : "web";
  const ws = c.wearSources || {};
  return ROWS.filter((r) => (r.server ? !!f.wearables : !!f.deviceSync)).map((r) => {
    const st = ws[r.source] && typeof ws[r.source] === "object" ? ws[r.source] : null;
    let state, note = null;
    if (!r.server && plat !== r.app) state = "elsewhere"; // Apple Health on Android or the web, Health Connect on iPhone or the web
    else if (st) state = st.pending ? "pending" : "connected";
    else if (r.server && !c.demo && (!c.server || (c.serverSources && c.serverSources[r.source] !== true))) { state = "notSetUp"; note = c.server ? DEVICE_COPY.notSetUpWhy : DEVICE_COPY.noServerWhy; }
    else state = "available";
    const when = st ? syncedWords(typeof st.lastSync === "number" ? st.lastSync : st.connectedAt, c.nowMs) : null;
    const status = state === "connected" ? DEVICE_COPY.connected(when) : state === "pending" ? DEVICE_COPY.pending
      : state === "elsewhere" ? (r.app === "ios" ? DEVICE_COPY.inIphone : DEVICE_COPY.inAndroid)
      : state === "notSetUp" ? DEVICE_COPY.notSetUp : "Not connected";
    return { id: r.id, source: r.source, name: r.name, reads: r.reads, where: r.where, server: !!r.server, state, status, note, demo: !!(st && st.demo) };
  });
}

/** Whether the Home card shows: some row can be connected here, nothing is connected yet and she hasn't hidden it. */
export function homeDevicesCard({ rows = [], hidden = false } = {}) {
  if (hidden) return false;
  if (rows.some((r) => r.state === "connected" || r.state === "pending")) return false;
  return rows.some((r) => r.state === "available");
}

/** The device-only "hidden" mark for the Home card: null | "hidden". */
export const cleanDevicesHint = (v) => (v === "hidden" ? "hidden" : null);
