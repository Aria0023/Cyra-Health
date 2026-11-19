// Task 2: the one "Connect your devices" list — which rows, their state on each platform, the Home card rule, and copy
// that matches what the integrations module really does (Terra readings wait up to 7 days; Oura's are not kept).
import test from "node:test";
import assert from "node:assert/strict";
import { deviceRows, homeDevicesCard, syncedWords, cleanDevicesHint, deviceHowTo, terraShown, DEVICE_COPY } from "./devices.js";

const F = { deviceSync: true, wearables: true };
const ids = (rows) => rows.map((r) => r.id);
const st = (rows) => Object.fromEntries(rows.map((r) => [r.id, r.state]));

test("devices: the rows in order, and where each one can be connected", () => {
  assert.deepEqual(ids(deviceRows({ flags: F, server: true, serverSources: { oura: true, terra: true } })), ["apple", "healthconnect", "oura", "terra", "dexcom", "libre"]);
  assert.deepEqual(ids(deviceRows({ flags: F, server: true })), ["apple", "healthconnect", "oura", "dexcom", "libre"], "2026-11-19: no Fitbit · Garmin · Whoop row until the server says Terra is set up");
  assert.deepEqual(st(deviceRows({ flags: F, server: true, serverSources: { oura: true, terra: true } })), { apple: "elsewhere", healthconnect: "elsewhere", oura: "available", terra: "available", dexcom: "elsewhere", libre: "elsewhere" }, "a browser");
  assert.deepEqual(st(deviceRows({ native: true, platform: "ios", flags: F, server: true, serverSources: { oura: true, terra: false } })), { apple: "available", healthconnect: "elsewhere", oura: "available", dexcom: "available", libre: "available" }, "Terra not set up on the server: its row is hidden, not shown as a dead end");
  assert.deepEqual(st(deviceRows({ native: true, platform: "android", flags: F, server: false })), { apple: "elsewhere", healthconnect: "available", oura: "notSetUp", dexcom: "available", libre: "available" }, "no server: Oura can't connect and the Terra row is hidden");
  assert.deepEqual(st(deviceRows({ flags: F, server: false, demo: true })).oura, "available", "the demo build connects illustrative data");
  const web = deviceRows({ flags: F, server: true });
  assert.equal(web[0].status, "In the iPhone app"); assert.equal(web[1].status, "In the Android app");
  assert.deepEqual(ids(deviceRows({ flags: { deviceSync: true, wearables: false }, native: true, platform: "ios" })), ["apple", "healthconnect", "dexcom", "libre"]);
  assert.deepEqual(ids(deviceRows({ flags: { deviceSync: false, wearables: true }, server: true, serverSources: { oura: true, terra: true } })), ["oura", "terra"]);
});

test("devices: connected rows say when they last synced; Not set up yet says why", () => {
  const now = new Date(2026, 10, 12, 15).getTime();
  const rows = deviceRows({ flags: F, server: true, serverSources: { oura: true, terra: false }, wearSources: { oura: { lastSync: new Date(2026, 10, 11, 9).getTime() } }, nowMs: now });
  const oura = rows.find((r) => r.id === "oura"), terra = rows.find((r) => r.id === "terra");
  assert.equal(oura.state, "connected"); assert.equal(oura.status, "Connected · synced yesterday");
  assert.equal(terra, undefined, "Terra isn't set up on this server: no row");
  const ouraOff = deviceRows({ flags: F, server: true, serverSources: { oura: false, terra: false } }).find((r) => r.id === "oura");
  assert.equal(ouraOff.status, "Not set up yet"); assert.equal(ouraOff.note, DEVICE_COPY.notSetUpWhy);
  assert.equal(syncedWords(now, now), "today"); assert.equal(syncedWords(now - 3 * 86_400_000, now), "3 days ago"); assert.equal(syncedWords(undefined, now), null);
  assert.equal(deviceRows({ flags: F, server: true, wearSources: { terra: { pending: true } } }).find((r) => r.id === "terra").state, "pending");
});

test("devices: where each reading goes, said as the code does it", () => {
  const rows = Object.fromEntries(deviceRows({ flags: F, server: true, serverSources: { oura: true, terra: true } }).map((r) => [r.id, r]));
  assert.match(rows.apple.where, /Never sent to a server/); assert.match(rows.healthconnect.where, /Never sent to a server/);
  assert.match(rows.oura.where, /without keeping them/);
  assert.match(rows.terra.where, /7 days at most/); assert.match(rows.terra.where, /Terra keeps its own copy/);
  assert.doesNotMatch(rows.terra.where, /not kept|without keeping/, "Terra readings DO wait on the server");
});

test("devices: the Home card shows until something is connected or she hides it", () => {
  const avail = deviceRows({ flags: F, server: true, serverSources: { oura: true, terra: true } });
  assert.equal(homeDevicesCard({ rows: avail }), true);
  assert.equal(homeDevicesCard({ rows: avail, hidden: true }), false);
  assert.equal(homeDevicesCard({ rows: deviceRows({ flags: F, server: true, wearSources: { oura: { lastSync: 1 } } }) }), false);
  assert.equal(homeDevicesCard({ rows: deviceRows({ flags: F, server: true, serverSources: { oura: false, terra: false } }) }), false, "nothing can be connected here");
  assert.equal(cleanDevicesHint("hidden"), "hidden"); assert.equal(cleanDevicesHint("x"), null);
});

test("devices: Dexcom and FreeStyle Libre through Apple Health / Health Connect, read on the phone", () => {
  const ios = Object.fromEntries(deviceRows({ native: true, platform: "ios", flags: F }).map((r) => [r.id, r]));
  assert.equal(ios.dexcom.name, "Dexcom (through Apple Health)");
  assert.match(ios.dexcom.reads, /Turn on that sharing in the Dexcom app first/);
  assert.match(ios.libre.where, /Never sent to a server/);
  assert.equal(ios.dexcom.source, "glucose"); assert.equal(ios.dexcom.glucose, true);
  const and = Object.fromEntries(deviceRows({ native: true, platform: "android", flags: F, glucose: { apps: ["libre"], lastSync: Date.now() } }).map((r) => [r.id, r]));
  assert.equal(and.libre.name, "FreeStyle Libre (through Health Connect)");
  assert.equal(and.libre.state, "connected"); assert.equal(and.libre.status, "Connected · synced today");
  assert.equal(and.dexcom.state, "available");
  const web = Object.fromEntries(deviceRows({ flags: F }).map((r) => [r.id, r]));
  assert.equal(web.dexcom.status, "In the iPhone or Android app");
  assert.equal(deviceRows({ flags: F, demo: true }).find((r) => r.id === "dexcom").state, "available", "the demo build connects illustrative readings");
  assert.equal(homeDevicesCard({ rows: deviceRows({ flags: { deviceSync: true, wearables: false } }) }), false, "glucose rows alone don't bring back the Home card in a browser");
});

test("devices: the Fitbit · Garmin · Whoop row shows only where it can do something", () => {
  assert.equal(terraShown({ server: true, serverSources: { terra: true } }), true);
  assert.equal(terraShown({ server: true, serverSources: { terra: false } }), false);
  assert.equal(terraShown({ server: true, serverSources: null }), false, "not until the server has answered");
  assert.equal(terraShown({ server: false, serverSources: { terra: true } }), false);
  assert.equal(terraShown({ server: false, wearSources: { terra: { key: "k" } } }), true, "a connection that exists can always be synced or disconnected");
  assert.equal(terraShown({ server: true, serverSources: { terra: false }, terraOff: 1 }), true, "a disconnect still waiting stays visible");
  assert.equal(terraShown({ demo: true }), true);
  assert.equal(terraShown(), false);
  const connected = deviceRows({ flags: F, server: true, serverSources: { oura: true, terra: false }, wearSources: { terra: { key: "k", lastSync: Date.now() } } }).find((r) => r.id === "terra");
  assert.equal(connected.state, "connected");
});

test("devices: the Fitbit, Garmin or Whoop how-to — three steps each, by platform, and what doesn't come through", () => {
  assert.equal(deviceHowTo({ flags: { deviceSync: false } }), null, "no on-phone sources in the build: no how-to");
  const ios = deviceHowTo({ native: true, platform: "ios", flags: F });
  assert.equal(ios.label, "Fitbit, Garmin or Whoop?");
  assert.deepEqual(ios.brands.map((b) => b.name), ["Fitbit", "Garmin", "Whoop"]);
  for (const b of ios.brands) assert.equal(b.steps.length, 3, b.name);
  assert.deepEqual(ios.brands[1].steps, ["Open the Garmin Connect app and go to its settings.", "Look for Apple Health there and turn on sharing for sleep and heart rate.", "Come back here and connect Apple Health in the list above."]);
  assert.match(ios.lead, /share your readings with Apple Health, and Solia Health reads them from there, on your iPhone\. Solia Health's server is never involved this way\./);
  assert.match(ios.brands[0].note, /the Fitbit app may not offer Apple Health/);
  assert.equal(ios.brands[1].note, null);
  const and = deviceHowTo({ native: true, platform: "android", flags: F });
  assert.equal(and.brands[0].steps[1], "Look for Health Connect there and turn on sharing for sleep and heart rate.");
  assert.equal(and.brands[0].note, null, "the iPhone caveat isn't shown on Android");
  assert.match(and.brands[2].steps[0], /^Open the WHOOP app and go to its settings\.$/);
  const web = deviceHowTo({ flags: F });
  assert.equal(web.brands[0].steps[2], "In the Solia Health app on that phone, open Connect your devices and connect Apple Health or Health Connect.");
  assert.match(web.menus, /look for Apple Health \(iPhone\) or Health Connect \(Android\)\. If it isn't there, that app can't share this way on your phone\./);
  for (const h of [ios, and, web]) {
    assert.equal(h.missing, "What doesn't come through: Garmin and Whoop don't share HRV this way, so HRV stays empty for them. Sleep and heart rate come through when the brand's app shares them.");
    assert.doesNotMatch(JSON.stringify(h), /Terra|tap the|Settings >|→/, "no menu paths and no Terra");
  }
});
