/* Unit tests for the owner's app settings in the app (docs/plans/upgrade-enterprise.md Task 2): the cleaner, the
   features it may turn off (never on), the web reference prices, and that the app's lists match the backend's checks. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanAppConfig, keepAppConfig, webRefs, APP_CONFIG_KEY, ANNOUNCE_MAX } from "./appConfig.js";
import { REMOTE_OFF, withRemoteOff, parseFeatures, DEFAULT_FEATURES } from "./features.js";
import { webTiles, planTiles } from "./plans.js";
import { webPriceLine, WEB_PRICE_LINE } from "./pricing.js";
import { STYLE_KEYS } from "./appearance.js";
import * as server from "../../backend/src/modules/settings/index.js";

const good = { version: 1, featuresOff: ["shop"], defaultStyle: "aura", defaultPalette: 1, announcement: "New: Shop by need.", helpLines: ["Ask your clinic for its invite code."], prices: { monthly: "$8.95", annual: "$90" }, updatedAt: "2026-11-25T09:30:00.000Z" };

test("cleanAppConfig keeps a good config and drops anything it doesn't know", () => {
  assert.deepEqual(cleanAppConfig(good), good);
  for (const bad of [null, [], "x", { ...good, version: 2 }]) assert.equal(cleanAppConfig(bad), null);
  const c = cleanAppConfig({ ...good, featuresOff: ["shop", "signin", "deviceSync", "cloudBackup", "bogus"], defaultStyle: "bloom", defaultPalette: 7, announcement: "<b>x</b>", helpLines: ["a\nb", "ok", 3, "x".repeat(241), "two", "three"], prices: { monthly: "8.95", annual: "$90" }, extra: "ignored" });
  assert.deepEqual(c.featuresOff, ["shop"], "sign-in, on-device sources and the backup are never turned off");
  assert.equal(c.defaultStyle, null);
  assert.equal(c.defaultPalette, null);
  assert.equal(c.announcement, null, "plain text only");
  assert.deepEqual(c.helpLines, ["ok", "two", "three"]);
  assert.deepEqual(c.prices, { monthly: null, annual: "$90" });
  assert.ok(!("extra" in c));
  assert.equal(cleanAppConfig({ ...good, announcement: "x".repeat(ANNOUNCE_MAX + 1) }).announcement, null);
});

test("withRemoteOff only turns features off, and only the allowed ones", () => {
  const all = parseFeatures("all");
  const off = withRemoteOff(all, ["ai", "shop", "signin", "deviceSync", "cloudBackup"]);
  assert.equal(off.ai, false); assert.equal(off.shop, false);
  assert.equal(off.signin, true); assert.equal(off.deviceSync, true); assert.equal(off.cloudBackup, true);
  const none = withRemoteOff(parseFeatures("none"), []);
  assert.deepEqual(withRemoteOff(parseFeatures("none"), REMOTE_OFF), none, "nothing is ever turned on");
  assert.deepEqual(withRemoteOff(DEFAULT_FEATURES, null), { ...DEFAULT_FEATURES });
});

test("the web's reference prices: the owner's when set, else the built-in ones", () => {
  assert.deepEqual(webTiles().map((t) => t.price), ["$100 a year", "$9.95 a month"]);
  assert.deepEqual(planTiles({ where: "web", refs: { monthly: "$8.95", annual: "$90" } }).map((t) => t.price), ["$90 a year", "$8.95 a month"]);
  assert.equal(planTiles({ where: "web", refs: webRefs(good) })[0].note, "About $7.50 a month");
  assert.equal(webPriceLine(null), WEB_PRICE_LINE);
  assert.equal(webPriceLine({ monthly: "$8.95", annual: null }), "Pro is $8.95 a month or $100 a year in the iPhone and Android apps.");
  // a phone never shows a reference price, whatever the owner set
  assert.deepEqual(planTiles({ where: "store", offer: null, refs: { monthly: "$1", annual: "$2" } }), []);
});

test("the app and the backend agree on what may be set", () => {
  assert.deepEqual([...server.REMOTE_OFF], [...REMOTE_OFF]);
  assert.deepEqual([...server.STYLE_KEYS], [...STYLE_KEYS]);
  assert.equal(server.ANNOUNCE_MAX, ANNOUNCE_MAX);
  // whatever the server's checks accept, the app's cleaner keeps
  const { patch } = server.cleanSettings({ featuresOff: ["ai"], defaultStyle: "mint", defaultPalette: 2, announcement: { on: true, text: "Hello." }, helpLines: ["One."], prices: { monthly: "$9.95", annual: "$100" } });
  const pub = server.publicConfig(patch, "2026-11-25T09:30:00.000Z");
  assert.deepEqual(cleanAppConfig(pub), pub);
});

test("the kept copy: written and removed under one key; a blocked storage never throws", () => {
  const m = new Map();
  const ls = { setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  keepAppConfig(good, ls);
  assert.deepEqual(JSON.parse(m.get(APP_CONFIG_KEY)), good);
  keepAppConfig(null, ls);
  assert.equal(m.size, 0);
  assert.doesNotThrow(() => keepAppConfig(good, { setItem() { throw new Error("blocked"); } }));
  // the boot reader imports nothing (lib/features.js must not have run before it)
  const boot = readFileSync(new URL("./appConfigBoot.js", import.meta.url), "utf8");
  assert.ok(!/^\s*import\s/m.test(boot));
  const main = readFileSync(new URL("../main.jsx", import.meta.url), "utf8");
  assert.ok(main.indexOf('import "./lib/appConfigBoot.js"') < main.indexOf("import React"), "read before anything else");
  // the download carries nothing about her
  const live = readFileSync(new URL("./appConfigLive.js", import.meta.url), "utf8");
  assert.match(live, /apiFetch\("\/api\/app-config", \{ method: "GET", credentials: "omit", referrerPolicy: "no-referrer" \}/);
});
