// Anonymous shop tap counts (docs/plans/tracking-reports.md Task 1): the body is exactly { productId }, nothing is sent
// with the switch off or in a build without a server or the shop, and the request carries no credentials or referrer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tapBody, tapsOn, sendShopTap, TAP_PATH, TAP_COPY } from "./shopTaps.js";
import { flowRows, FLOW_COPY } from "./privacyFlows.js";
import { SHOP_COPY, SHOP_PAGE_COPY } from "./shop.js";

const calls = [];
const fetchImpl = (url, init) => { calls.push({ url, init }); return Promise.reject(new Error("offline")); };

test("tapBody: exactly { productId } for a catalog id; anything else is null", () => {
  assert.deepEqual(tapBody("oura"), { productId: "oura" });
  assert.deepEqual(Object.keys(tapBody("lumen-mask-a1b2c3")), ["productId"]);
  for (const bad of ["", "Oura", "a b", "../x", "x".repeat(49), null, undefined, 7, { productId: "oura" }, "oura?stage=peri", "-oura"]) assert.equal(tapBody(bad), null, String(bad));
});

test("tapsOn: only in a build with a server and the shop, and only once she turns her switch on (2026-11-25: opt-in)", () => {
  assert.equal(tapsOn({ live: true, on: true }), true);
  assert.equal(tapsOn({ live: true }), false, "off by default");
  assert.equal(tapsOn({ live: true, on: false }), false);
  assert.equal(tapsOn({ live: false, on: true }), false);
  assert.equal(tapsOn(), false);
});

test("sendShopTap: one POST with only the product id; no credentials, no referrer, no token; a failure is swallowed", async () => {
  calls.length = 0;
  assert.equal(sendShopTap("oura", { live: true, on: true, base: "https://api.solia.test", fetchImpl }), true);
  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(url, `https://api.solia.test${TAP_PATH}`);
  assert.equal(init.method, "POST");
  assert.equal(init.body, '{"productId":"oura"}');
  assert.deepEqual(init.headers, { "content-type": "application/json" }, "no authorization or other header of ours");
  assert.equal(init.credentials, "omit");
  assert.equal(init.referrerPolicy, "no-referrer");
  assert.equal(init.keepalive, true);
  await new Promise((r) => setTimeout(r, 5)); // the rejected fetch must not surface as an unhandled rejection
});

test("sendShopTap: the switch off, no server, no shop or a bad id → no request at all", () => {
  calls.length = 0;
  assert.equal(sendShopTap("oura", { live: true, on: false, base: "https://api.solia.test", fetchImpl }), false);
  assert.equal(sendShopTap("oura", { live: true, base: "https://api.solia.test", fetchImpl }), false, "unset is off");
  assert.equal(sendShopTap("oura", { live: false, on: true, base: "https://api.solia.test", fetchImpl }), false);
  assert.equal(sendShopTap("oura", { live: true, on: true, base: "", fetchImpl }), false);
  assert.equal(sendShopTap("Not An Id", { live: true, on: true, base: "https://api.solia.test", fetchImpl }), false);
  assert.equal(sendShopTap("oura", { live: true, on: true, base: "https://api.solia.test", fetchImpl: () => { throw new Error("blocked"); } }), false, "a throwing fetch never reaches the link");
  assert.equal(calls.length, 0);
});

test("privacy dashboard: the shop tap row exists only with a server and the shop flag, and follows her switch", () => {
  const row = (c) => flowRows(c).find((r) => r.id === "shopTaps");
  assert.equal(row({ server: true, flags: { shop: true } }).state, "off", "2026-11-25: off until she turns it on");
  assert.equal(row({ server: true, flags: { shop: true }, shopTapsOn: true }).state, "on");
  assert.equal(row({ server: false, flags: { shop: true } }).state, "na");
  assert.equal(row({ server: true, flags: { shop: false } }).state, "na");
  assert.equal(FLOW_COPY.names.shopTaps, TAP_COPY.name);
  assert.equal(FLOW_COPY.lines.shopTaps, TAP_COPY.line);
  assert.match(TAP_COPY.line, /that product's id and nothing else/);
});

test("Shop copy: \"nothing about you is sent\" is said only where no tap can be sent", () => {
  assert.equal(SHOP_PAGE_COPY.footMatched(false), "Matched on this device; nothing about you is sent.");
  assert.doesNotMatch(SHOP_PAGE_COPY.footMatched(true), /nothing about you is sent/);
  assert.match(SHOP_PAGE_COPY.footMatched(true), /^Matched on this device/);
  assert.match(SHOP_COPY.lead(false), /nothing about you is sent\.$/);
  assert.doesNotMatch(SHOP_COPY.lead(true), /nothing about you is sent/);
  assert.match(TAP_COPY.foot, /counts one anonymous tap for that product\. It isn't linked to you or to anything you log\./);
});
