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

   2026-11-19 (docs/plans/tracking-reports.md Task 4): the Fitbit · Garmin · Whoop row (through Terra) shows only where
   it can do something: the server said Terra is set up, a connection already exists, or the demo build. Everywhere else
   the list carries a "Fitbit, Garmin or Whoop?" how-to instead (deviceHowTo): turn on sharing to Apple Health or Health
   Connect in the brand's own app, then connect Apple Health / Health Connect here. That path never involves a server.

   Row states:
     connected   Connected · synced <when>      → Disconnect
     pending     Waiting to finish               → Sync
     available   Not connected                   → Connect (one tap)
     elsewhere   "In the iPhone app" / "In the Android app" (this source can't be read here) → no button
     notSetUp    "Not set up yet" (the server reports no keys for it, or this build has no server) → no button */

export const DEVICE_COPY = Object.freeze({
  title: "Connect your devices",
  lead: "Optional. Solia Health works fully without a device. A watch or ring adds your nightly temperature, resting heart rate, HRV and sleep; a glucose sensor adds your blood glucose. Connect or disconnect any time.",
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
  inPhone: "In the iPhone or Android app",
  glucoseLead: "Blood glucose from a Dexcom or FreeStyle Libre sensor comes through Apple Health or Health Connect. In the Dexcom or Libre app, turn on sharing to Apple Health or Health Connect first.",
  noDevice: "Don't have a device? See options",
  howtoLabel: "Fitbit, Garmin or Whoop?",
});

/* The how-to (2026-11-19). Worded to stay true as the brands' menus change: it says where to look ("in the app's
   settings, look for Apple Health / Health Connect"), never a menu path, and says what to conclude when it isn't there.
   Facts to re-check before each release (docs/PRIVACY-AUDIT.md lists them): the Fitbit app shares with Health Connect on
   Android and has not offered Apple Health on iPhone; Garmin Connect and WHOOP share sleep and heart rate with Apple
   Health and Health Connect but not HRV. */
const HOWTO_BRANDS = [
  { id: "fitbit", name: "Fitbit", app: "the Fitbit app", iosNote: "On an iPhone, the Fitbit app may not offer Apple Health. If it isn't in the settings, Fitbit can't share this way on an iPhone." },
  { id: "garmin", name: "Garmin", app: "the Garmin Connect app" },
  { id: "whoop", name: "Whoop", app: "the WHOOP app" },
];

/** The "Fitbit, Garmin or Whoop?" how-to for this platform, or null in a build without the on-phone sources.
    c = { native, platform: "ios" | "android" | "web", flags: { deviceSync } } */
export function deviceHowTo(c = {}) {
  if (!c.flags?.deviceSync) return null;
  const plat = c.native ? c.platform : "web";
  const target = plat === "ios" ? "Apple Health" : plat === "android" ? "Health Connect" : "Apple Health (iPhone) or Health Connect (Android)";
  const phone = plat === "ios" ? "on your iPhone" : plat === "android" ? "on your Android phone" : "on your phone, in the Solia Health app";
  const last = plat === "web" ? "In the Solia Health app on that phone, open Connect your devices and connect Apple Health or Health Connect."
    : `Come back here and connect ${target} in the list above.`;
  return {
    label: DEVICE_COPY.howtoLabel,
    lead: `Their own apps can share your readings with ${target}, and Solia Health reads them from there, ${phone}. Solia Health's server is never involved this way.`,
    brands: HOWTO_BRANDS.map((b) => ({
      id: b.id, name: b.name,
      steps: [`Open ${b.app} and go to its settings.`, `Look for ${target} there and turn on sharing for sleep and heart rate.`, last],
      note: b.iosNote && plat !== "android" ? b.iosNote : null,
    })),
    missing: "What doesn't come through: Garmin and Whoop don't share HRV this way, so HRV stays empty for them. Sleep and heart rate come through when the brand's app shares them.",
    menus: `Menu names change from time to time. In the brand app's settings, look for ${target}. If it isn't there, that app can't share this way on your phone.`,
  };
}

/** Whether the Fitbit · Garmin · Whoop (Terra) row is shown: the server reports Terra set up, a connection exists
    (so it can be synced or disconnected), a disconnect is still waiting, or the demo build. */
export const terraShown = ({ server = false, serverSources = null, wearSources = {}, demo = false, terraOff = 0 } = {}) =>
  !!demo || !!(wearSources && wearSources.terra) || terraOff > 0 || (!!server && !!serverSources && serverSources.terra === true);

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

/* Blood glucose (Task B, 2026-11-14): Dexcom and FreeStyle Libre write their readings to Apple Health and Health Connect;
   the app reads them there on the phone (lib/wearables.js connectGlucose). Their connection lives in glucoseLog.apps
   (lib/glucose.js), not in wearSources, so the nightly signals never see them. */
const via = (plat) => (plat === "ios" ? "Apple Health" : plat === "android" ? "Health Connect" : "Apple Health / Health Connect");
const GLUCOSE_ROWS = [
  { id: "dexcom", brand: "Dexcom", app: "the Dexcom app" },
  { id: "libre", brand: "FreeStyle Libre", app: "the FreeStyle Libre app" },
];

/** "today", "yesterday", "3 days ago" (whole local days between the two times). */
export function syncedWords(ms, nowMs = Date.now()) {
  if (!Number.isFinite(ms)) return null;
  const day = (t) => { const d = new Date(t); d.setHours(12, 0, 0, 0); return d.getTime(); };
  const n = Math.round((day(nowMs) - day(ms)) / 86_400_000);
  return n <= 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`;
}

/** The rows, in order: Apple Health, Health Connect, Oura, Fitbit · Garmin · Whoop (only where terraShown).
    c = { native, platform: "ios" | "android" | "web", flags: { deviceSync, wearables }, server, serverSources: { oura, terra } | null,
          wearSources, demo, nowMs } */
export function deviceRows(c = {}) {
  const f = c.flags || {};
  const plat = c.native ? c.platform : "web";
  const ws = c.wearSources || {};
  return ROWS.filter((r) => (r.server ? !!f.wearables : !!f.deviceSync)).filter((r) => r.id !== "terra" || terraShown({ server: c.server, serverSources: c.serverSources, wearSources: ws, demo: c.demo, terraOff: c.terraOff })).map((r) => {
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
  }).concat(f.deviceSync ? glucoseRows(c, plat) : []);
}

/** The Dexcom and FreeStyle Libre rows. c.glucose: glucoseLog ({ apps, lastSync, connectedAt }). In a browser they can't be
    read ("In the iPhone or Android app"), except in the demo build, which connects illustrative readings. */
function glucoseRows(c, plat) {
  const g = c.glucose && typeof c.glucose === "object" ? c.glucose : {};
  const apps = Array.isArray(g.apps) ? g.apps : [];
  return GLUCOSE_ROWS.map((r) => {
    const on = apps.includes(r.id);
    const state = on ? "connected" : plat === "web" && !c.demo ? "elsewhere" : "available";
    const when = on ? syncedWords(typeof g.lastSync === "number" ? g.lastSync : g.connectedAt, c.nowMs) : null;
    const status = state === "connected" ? DEVICE_COPY.connected(when) : state === "elsewhere" ? DEVICE_COPY.inPhone : "Not connected";
    return {
      id: r.id, source: "glucose", glucose: true, name: `${r.brand} (through ${via(plat)})`, server: false, state, status, note: null, demo: !!(on && g.demo),
      reads: `Blood glucose readings that ${r.app} shares with ${via(plat)}. Turn on that sharing in ${r.app} first.`,
      where: `Read on your phone by the Solia Health app from ${via(plat)}. Never sent to a server.`,
    };
  });
}

/** Whether the Home card shows: some row can be connected here, nothing is connected yet and she hasn't hidden it. */
export function homeDevicesCard({ rows = [], hidden = false } = {}) {
  if (hidden) return false;
  if (rows.some((r) => r.state === "connected" || r.state === "pending")) return false;
  return rows.some((r) => r.state === "available" && !r.glucose);
}

/** The device-only "hidden" mark for the Home card: null | "hidden". */
export const cleanDevicesHint = (v) => (v === "hidden" ? "hidden" : null);
