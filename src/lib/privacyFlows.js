/* The privacy dashboard's "What can leave this device" list (local-first L10, brief item 6): one row per flow this
   build can use, with its real current state. Pure: the states are derived from the build's feature flags
   (lib/features.js), plan.can("cloudBackup") (lib/plan.js), whether a server is configured, the platform and her
   settings, all passed in by App.jsx. Nothing here reads storage or the network. A flow this build cannot use
   gets state "na" and is not rendered at all (decisions D2 and D3: a feature that is off leaves no trace). */

export const FLOW_IDS = Object.freeze(["reminders", "counts", "ai", "wearables", "files", "cloud"]);

/**
 * @typedef {Object} FlowRow
 * @property {"reminders"|"counts"|"ai"|"wearables"|"files"|"cloud"} id
 * @property {string} name
 * @property {"on"|"off"|"you"|"na"} state on: sending as configured; off: available, not sending; you: only when she makes one; na: not in this build.
 * @property {null|"pending"|"unsupported"|"terraOff"|"demo"} note
 */

/** Rows in FLOW_IDS order. c = { native, server, flags:{wearables,counts,ai,webReminders,cloudBackup,signin}, planCloud,
    reminderSupport, reminders:{enabled,status,pending}, research, askAI, wearLive, terraOff, demoWear }. */
export function flowRows(c = {}) {
  const f = c.flags || {};
  const rem = c.reminders || {};
  const remOn = !!rem.enabled && rem.status === "on";
  const rows = [];
  // reminders: the phone shows them itself (every build); a browser needs webReminders and a server
  if (c.native) rows.push({ id: "reminders", name: FLOW_COPY.names.remindersPhone, state: remOn ? "on" : "off", note: null });
  else if (f.webReminders && c.server) {
    if (c.reminderSupport === "none" || rem.status === "unsupported") rows.push({ id: "reminders", name: FLOW_COPY.names.remindersWeb, state: "off", note: "unsupported" });
    else rows.push({ id: "reminders", name: FLOW_COPY.names.remindersWeb, state: remOn ? "on" : "off", note: Array.isArray(rem.pending) && rem.pending.length ? "pending" : null });
  } else rows.push({ id: "reminders", name: FLOW_COPY.names.remindersWeb, state: "na", note: null });
  rows.push({ id: "counts", name: FLOW_COPY.names.counts, state: f.counts && c.server ? (c.research ? "on" : "off") : "na", note: null });
  rows.push({ id: "ai", name: FLOW_COPY.names.ai, state: f.ai && c.server ? (c.askAI ? "on" : "off") : "na", note: null });
  if (f.wearables && c.demoWear) rows.push({ id: "wearables", name: FLOW_COPY.names.wearables, state: "off", note: "demo" });
  else if (f.wearables && c.server) rows.push({ id: "wearables", name: FLOW_COPY.names.wearables, state: (c.wearLive || 0) + (c.terraOff || 0) > 0 ? "on" : "off", note: (c.terraOff || 0) > 0 ? "terraOff" : null });
  else rows.push({ id: "wearables", name: FLOW_COPY.names.wearables, state: "na", note: null });
  rows.push({ id: "files", name: FLOW_COPY.names.files, state: "you", note: null });
  rows.push({ id: "cloud", name: FLOW_COPY.names.cloud, state: f.cloudBackup && c.planCloud ? "off" : "na", note: null });
  return rows;
}

/** "Other connections Cyra makes": "web" (the app's own files), "server" (only when some server flow exists in this
    build) and "signin" (only with the signin flag and a server). */
export function otherConnections({ native = false, server = false, flags = {} } = {}) {
  const out = [];
  if (!native) out.push("web");
  const anyServer = (!native && !!flags.webReminders) || !!flags.counts || !!flags.ai || !!flags.wearables || !!flags.signin;
  if (server && anyServer) out.push("server");
  if (server && flags.signin) out.push("signin");
  return out;
}

export const FLOW_COPY = Object.freeze({
  label: "What can leave this device",
  intro: "What this version of Cyra can send, and when. Nothing about your health leaves this device unless a row below says On, or you take it out yourself as a backup, file or summary.",
  states: Object.freeze({ on: "On", off: "Off", you: "When you make one" }),
  names: Object.freeze({ remindersWeb: "Browser reminders", remindersPhone: "Reminders", counts: "Weekly counts", ai: "Ask Cyra's AI", wearables: "Wearable connections", files: "Backups and files you make", cloud: "Cloud backup" }),
  lines: Object.freeze({
    remindersWeb: "This browser's push address, and the days, time and time zone you chose, go to Cyra's server. Nothing about your health.",
    remindersPhone: "Your phone shows them itself. Nothing is sent.",
    counts: "Your life-stage group and yes/no flags for a few symptoms, each at most once a week. No dates, values or name.",
    ai: "Only a question you type, and only when Cyra's written library can't answer it. It goes through Cyra's server to Anthropic, which keeps it for a limited time.",
    wearables: "This device sends its Oura sign-in, or its Fitbit, Garmin or Whoop connection key, to Cyra's server, which brings your readings back without saving them to disk. Terra, which connects Fitbit, Garmin and Whoop, keeps its own copy.",
    files: "They go only where you save or send them. Cyra's servers don't receive them.",
  }),
  notes: Object.freeze({
    pending: "Cyra's server hasn't confirmed it erased this browser's reminder address yet. Cyra keeps asking while it's open and each time you open it.",
    unsupported: "This browser can't show reminders, so nothing is sent.",
    terraOff: "A Fitbit, Garmin or Whoop disconnect isn't confirmed yet. Cyra keeps asking until Cyra's server confirms it.",
    demo: "This demo build shows illustrative readings. Nothing is sent.",
  }),
  details: Object.freeze({
    phoneReminders1: "Cyra asks this phone to show one reminder on the days and at the time you chose. No server is involved.",
    phoneReminders2: "The reminder only says \"Time for your 30-second check-in.\"",
    countsRead: "Whether or not you share, Cyra loads last week's totals once each time it opens. That request carries nothing about you except, like any request, your device's internet address and app or browser type.",
    aiWhere: "Turn it on or off on the Ask tab.",
    wearWhere: "Connect or disconnect under Wearables on Home.",
    backupLocked: "An encrypted backup is locked with your passphrase on this device before it becomes a file. Without the passphrase it can't be opened.",
    summary: "The doctor summary on the Report tab goes only where you take it: a draft in your email app, your clipboard, the share sheet or a printout. Those apps may keep a copy under their own terms.",
  }),
  otherLabel: "Other connections Cyra makes",
  other: Object.freeze({
    web: "Cyra's app files come from Cyra's website when you open or update it online. Like any request, that shows your device's internet address and browser type, and nothing about your health.",
    server: "Any request to Cyra's server shows your device's internet address and app or browser type. Cyra's own code doesn't keep the address.",
    signin: "If you used Apple, Google or Facebook to fill in your name at setup, your name and email passed through Cyra's server, which erases them within 5 minutes.",
  }),
  detailsLabel: "Details",
});
