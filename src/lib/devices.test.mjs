// Task 2: the one "Connect your devices" list — which rows, their state on each platform, the Home card rule, and copy
// that matches what the integrations module really does (Terra readings wait up to 7 days; Oura's are not kept).
import test from "node:test";
import assert from "node:assert/strict";
import { deviceRows, homeDevicesCard, syncedWords, cleanDevicesHint, DEVICE_COPY } from "./devices.js";

const F = { deviceSync: true, wearables: true };
const ids = (rows) => rows.map((r) => r.id);
const st = (rows) => Object.fromEntries(rows.map((r) => [r.id, r.state]));

test("devices: the rows in order, and where each one can be connected", () => {
  assert.deepEqual(ids(deviceRows({ flags: F, server: true })), ["apple", "healthconnect", "oura", "terra", "dexcom", "libre"]);
  assert.deepEqual(st(deviceRows({ flags: F, server: true, serverSources: { oura: true, terra: true } })), { apple: "elsewhere", healthconnect: "elsewhere", oura: "available", terra: "available", dexcom: "elsewhere", libre: "elsewhere" }, "a browser");
  assert.deepEqual(st(deviceRows({ native: true, platform: "ios", flags: F, server: true, serverSources: { oura: true, terra: false } })), { apple: "available", healthconnect: "elsewhere", oura: "available", terra: "notSetUp", dexcom: "available", libre: "available" });
  assert.deepEqual(st(deviceRows({ native: true, platform: "android", flags: F, server: false })), { apple: "elsewhere", healthconnect: "available", oura: "notSetUp", terra: "notSetUp", dexcom: "available", libre: "available" }, "no server: the server rows can't connect");
  assert.deepEqual(st(deviceRows({ flags: F, server: false, demo: true })).oura, "available", "the demo build connects illustrative data");
  const web = deviceRows({ flags: F, server: true });
  assert.equal(web[0].status, "In the iPhone app"); assert.equal(web[1].status, "In the Android app");
  assert.deepEqual(ids(deviceRows({ flags: { deviceSync: true, wearables: false }, native: true, platform: "ios" })), ["apple", "healthconnect", "dexcom", "libre"]);
  assert.deepEqual(ids(deviceRows({ flags: { deviceSync: false, wearables: true }, server: true })), ["oura", "terra"]);
});

test("devices: connected rows say when they last synced; Not set up yet says why", () => {
  const now = new Date(2026, 10, 12, 15).getTime();
  const rows = deviceRows({ flags: F, server: true, serverSources: { oura: true, terra: false }, wearSources: { oura: { lastSync: new Date(2026, 10, 11, 9).getTime() } }, nowMs: now });
  const oura = rows.find((r) => r.id === "oura"), terra = rows.find((r) => r.id === "terra");
  assert.equal(oura.state, "connected"); assert.equal(oura.status, "Connected · synced yesterday");
  assert.equal(terra.status, "Not set up yet"); assert.equal(terra.note, DEVICE_COPY.notSetUpWhy);
  assert.equal(syncedWords(now, now), "today"); assert.equal(syncedWords(now - 3 * 86_400_000, now), "3 days ago"); assert.equal(syncedWords(undefined, now), null);
  assert.equal(deviceRows({ flags: F, server: true, wearSources: { terra: { pending: true } } }).find((r) => r.id === "terra").state, "pending");
});

test("devices: where each reading goes, said as the code does it", () => {
  const rows = Object.fromEntries(deviceRows({ flags: F, server: true }).map((r) => [r.id, r]));
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
