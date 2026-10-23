// Local-first L10: the privacy dashboard's row states (lib/privacyFlows.js) and the harness-collision guard over its
// copy and the lock's (lib/lock.js LOCK_COPY). Run: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { FLOW_IDS, FLOW_COPY, flowRows, otherConnections } from "./privacyFlows.js";
import { LOCK_COPY } from "./lock.js";
import { parseFeatures } from "./features.js";
import { filesSentence } from "./disclosures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ALL = parseFeatures("all"), DEF = parseFeatures(undefined), NONE = parseFeatures("none");
const base = { native: false, server: true, flags: ALL, planCloud: false, reminderSupport: "web", reminders: { enabled: false, status: "off", pending: [] }, research: false, askAI: false, wearLive: 0, terraOff: 0, demoWear: false };
const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
const states = (rows) => rows.map((r) => `${r.id}:${r.state}${r.note ? "+" + r.note : ""}`).join(" ");

test("privacyFlows: web, no server, a custom flag set → only files is available", () => {
  const rows = flowRows({ ...base, server: false, flags: { wearables: false, counts: false, ai: true, webReminders: true, cloudBackup: false, signin: false } });
  assert.deepEqual(rows.map((r) => r.id), [...FLOW_IDS], "FLOW_IDS order");
  assert.equal(states(rows), "reminders:na counts:na ai:na wearables:na files:you cloud:na");
  assert.equal(byId(rows).reminders.name, "Browser reminders");
});

test("privacyFlows: web, server, all flags, everything off → off rows; then on", () => {
  let r = byId(flowRows(base));
  assert.equal(states(flowRows(base)), "reminders:off counts:off ai:off wearables:off files:you cloud:na");
  r = byId(flowRows({ ...base, reminders: { enabled: true, status: "on", pending: [] }, research: true, askAI: true, wearLive: 1 }));
  for (const id of ["reminders", "counts", "ai", "wearables"]) assert.equal(r[id].state, "on", id);
  assert.equal(r.files.state, "you"); assert.equal(r.cloud.state, "na");
});

test("privacyFlows: web reminders — blocked, unsupported browser, pending addresses", () => {
  assert.equal(byId(flowRows({ ...base, reminders: { enabled: true, status: "blocked", pending: [] } })).reminders.state, "off");
  const uns = byId(flowRows({ ...base, reminderSupport: "none", reminders: { enabled: false, status: "unsupported", pending: [] } })).reminders;
  assert.equal(uns.state, "off"); assert.equal(uns.note, "unsupported");
  const pend = byId(flowRows({ ...base, reminders: { enabled: false, status: "off", pending: ["https://a"] } })).reminders;
  assert.equal(pend.state, "off"); assert.equal(pend.note, "pending");
  assert.equal(byId(flowRows({ ...base, reminders: { enabled: true, status: "on", pending: ["https://a"] } })).reminders.note, "pending");
});

test("privacyFlows: phone, no server, default flags → reminders available; counts, ai, wearables not", () => {
  const phone = { ...base, native: true, server: false, flags: DEF, reminderSupport: "native" };
  let r = byId(flowRows(phone));
  assert.equal(r.reminders.name, "Reminders"); assert.equal(r.reminders.state, "off");
  assert.equal(byId(flowRows({ ...phone, reminders: { enabled: true, status: "on", pending: [] } })).reminders.state, "on");
  for (const id of ["counts", "ai", "wearables", "cloud"]) assert.equal(r[id].state, "na", id);
  assert.equal(r.files.state, "you");
  // the phone row never depends on webReminders
  assert.equal(byId(flowRows({ ...phone, flags: NONE })).reminders.state, "off");
});

test("privacyFlows: wearables — an unconfirmed disconnect counts as on, the demo build is off, the flag off hides it", () => {
  const t = byId(flowRows({ ...base, terraOff: 1 })).wearables;
  assert.equal(t.state, "on"); assert.equal(t.note, "terraOff");
  const d = byId(flowRows({ ...base, demoWear: true, wearLive: 2 })).wearables;
  assert.equal(d.state, "off"); assert.equal(d.note, "demo");
  assert.equal(byId(flowRows({ ...base, flags: { ...ALL, wearables: false }, wearLive: 2, terraOff: 1 })).wearables.state, "na");
  assert.equal(byId(flowRows({ ...base, server: false, wearLive: 2 })).wearables.state, "na");
});

test("privacyFlows: cloud is 'na' unless the flag and the plan allow it; every id appears once in every configuration", () => {
  assert.equal(byId(flowRows({ ...base, flags: { ...ALL, cloudBackup: true }, planCloud: false })).cloud.state, "na");
  assert.equal(byId(flowRows({ ...base, flags: { ...ALL, cloudBackup: false }, planCloud: true })).cloud.state, "na");
  assert.equal(byId(flowRows({ ...base, flags: { ...ALL, cloudBackup: true }, planCloud: true })).cloud.state, "off");
  for (const native of [false, true]) for (const server of [false, true]) for (const flags of [ALL, DEF, NONE]) for (const planCloud of [false, true]) {
    const rows = flowRows({ ...base, native, server, flags, planCloud, reminderSupport: native ? "native" : "web" });
    assert.deepEqual(rows.map((r) => r.id), [...FLOW_IDS]);
    for (const r of rows) assert.ok(["on", "off", "you", "na"].includes(r.state));
  }
  // D2 / D3 acceptance: the rows a build renders (state ≠ na)
  const shown = (c) => flowRows(c).filter((r) => r.state !== "na").map((r) => r.name);
  assert.deepEqual(shown({ ...base, server: false, flags: DEF }), ["Backups and files you make"]);
  assert.deepEqual(shown({ ...base, server: true, flags: DEF }), ["Browser reminders", "Ask Cyra's AI", "Backups and files you make"]);
  assert.deepEqual(shown({ ...base, server: true, flags: ALL }), ["Browser reminders", "Weekly counts", "Ask Cyra's AI", "Wearable connections", "Backups and files you make"]);
});

test("privacyFlows: otherConnections — the server bullet only with a server flow, sign-in only with its flag", () => {
  assert.deepEqual(otherConnections({ native: false, server: false, flags: DEF }), ["web"]);
  assert.deepEqual(otherConnections({ native: false, server: true, flags: DEF }), ["web", "server"]);
  assert.deepEqual(otherConnections({ native: false, server: true, flags: ALL }), ["web", "server", "signin"]);
  assert.deepEqual(otherConnections({ native: false, server: true, flags: NONE }), ["web"]);
  assert.deepEqual(otherConnections({ native: true, server: true, flags: DEF }), ["server"], "the phone default build still has Cyra's AI");
  assert.deepEqual(otherConnections({ native: true, server: true, flags: parseFeatures("webReminders") }), [], "a phone with only web reminders has no server flow");
  assert.deepEqual(otherConnections({ native: true, server: true, flags: ALL }), ["server", "signin"]);
  assert.deepEqual(otherConnections({ native: true, server: false, flags: ALL }), []);
});

/* Every string of the dashboard and the lock, flattened. */
const strings = (o, out = []) => { if (typeof o === "string") out.push(o); else if (typeof o === "function") { for (const a of [0, 1, 4, true, false, 60, "0:30", "30 seconds"]) try { strings(o(a, a), out); } catch { /* arity */ } } else if (o && typeof o === "object") for (const v of Object.values(o)) strings(v, out); return out; };
test("privacyFlows + lock: harness-collision guard over FLOW_COPY and LOCK_COPY", () => {
  const all = [...strings(FLOW_COPY), ...strings(LOCK_COPY)];
  assert.ok(all.length > 60);
  const banned = ["Scheduled on this phone — no server involved", "aren't sent anywhere", "Sharing weekly counts is on", "To use it, tick", "answered on this device; nothing was sent",
    "Apple Health and Health Connect are read on this phone", "isn't available in the phone app yet", "Exactly what's sent", "Exactly what's kept", "Delete everything on this device?", "Your record couldn", "BUILD 2026"];
  for (const s of all) {
    for (const b of banned) assert.ok(!s.toLowerCase().includes(b.toLowerCase()), `"${s}" contains "${b}"`);
    for (const eq of ["Done", "Restore", "Encrypted backup", "Keep my data", "Connect"]) assert.notEqual(s, eq);
  }
  // The lock rows are .medrow elements (the suites locate Settings rows by .medrow text): none of these may appear in them.
  for (const s of strings(LOCK_COPY)) for (const b of ["Share anonymous weekly counts", "push address", "Scheduled on this phone", "POTS tools", "Oura Ring", "Health Connect", "Apple Watch"]) assert.ok(!s.includes(b), `"${s}" contains "${b}"`);
});

test("privacyFlows: the files row renders disclosures' filesSentence, which the s7 suite asserts in the all-features build", () => {
  let s7 = null; // the suite lives in the scratchpad; the sentence check still runs without it
  try { s7 = readFileSync("/tmp/claude-0/-home-user/dd34ad26-25bd-5d87-8174-4dbbc0f7e686/scratchpad/pots/s7/native-pots-s5-on-s7.mjs", "utf8"); } catch { /* not on this machine */ }
  const asserted = "Files you make yourself, like your appointment PDF or a POTS report or spreadsheet, go only where you save or send them. They aren't locked with a passphrase and never include readings Cyra gets from a connected watch, ring or health app.";
  assert.equal(filesSentence(ALL), asserted);
  if (s7) assert.ok(s7.includes(asserted.replace(/'/g, "\\'")));
  const pf = readFileSync(path.join(here, "../components/PrivacyFlows.jsx"), "utf8");
  assert.ok(pf.includes("filesSentence(FEATURES)"), "PrivacyFlows renders filesSentence(FEATURES), never a literal");
  assert.ok(pf.includes("WEAR_RESTORE_LINE"));
  assert.ok(!/Files you make yourself/.test(pf) && !/Files you make yourself/.test(JSON.stringify(FLOW_COPY)), "no static copy of the files sentence");
});
