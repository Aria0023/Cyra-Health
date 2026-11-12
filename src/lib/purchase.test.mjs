/* Unit tests for lib/purchase.js and lib/pricing.js (owner decision D4): the store is used only with a plugin and a key,
   is told nothing about her, answers honestly, and a tip never changes the plan. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { storeFor, startStore, loadOffer, buyPro, restorePurchases, sendTip, ownsPro, proOwned, STORE_LINES, STORE_KINDS } from "./purchase.js";
import { PRO_PRODUCTS, TIP_PRODUCTS, ENTITLEMENT, WEB_PRICE_LINE, planLines, perMonthOf, CANCEL_LINES, KEEP_LINE } from "./pricing.js";
import { planFor, PLAN, PRO_PLAN, DEV_PRO_PLAN, can } from "./plan.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const PRO_INFO = { entitlements: { active: { pro: { identifier: "pro", isActive: true } } } };
const NO_INFO = { entitlements: { active: {} } };

/** A fake RevenueCat plugin that records every call and its arguments. */
function fakePlugin({ owned = false, buy = "ok", restore = owned, offerings = true } = {}) {
  const calls = [];
  const pkg = (type, id, priceString, price) => ({ identifier: `$rc_${type.toLowerCase()}`, packageType: type, product: { identifier: id, priceString, price } });
  return {
    calls,
    async configure(a) { calls.push(["configure", a]); },
    async getCustomerInfo() { calls.push(["getCustomerInfo"]); return { customerInfo: owned ? PRO_INFO : NO_INFO }; },
    async getOfferings() { calls.push(["getOfferings"]); return { current: offerings ? { availablePackages: [pkg("MONTHLY", "solia_pro_monthly", "$4.99", 4.99), pkg("ANNUAL", "solia_pro_annual", "$29.99", 29.99)] } : null }; },
    async getProducts(a) { calls.push(["getProducts", a]); return { products: a.productIdentifiers.map((id, i) => ({ identifier: id, priceString: ["$1.99", "$4.99", "$9.99"][i], price: 1 })) }; },
    async purchasePackage(a) {
      calls.push(["purchasePackage", a]);
      if (buy === "cancel") { const e = new Error("cancelled"); e.userCancelled = true; e.code = "1"; throw e; }
      if (buy === "fail") throw Object.assign(new Error("network"), { code: "10" });
      return { productIdentifier: a.aPackage.product.identifier, customerInfo: PRO_INFO };
    },
    async purchaseStoreProduct(a) { calls.push(["purchaseStoreProduct", a]); if (buy === "cancel") throw Object.assign(new Error("x"), { userCancelled: true }); return { customerInfo: NO_INFO }; },
    async restorePurchases() { calls.push(["restorePurchases"]); return { customerInfo: restore ? PRO_INFO : NO_INFO }; },
  };
}

test("storeFor: only a phone with the plugin and a key has a store; the web never does", () => {
  assert.equal(storeFor({ platform: "web", plugin: fakePlugin(), apiKey: "appl_x" }).available, false);
  assert.equal(storeFor({ platform: "web" }).line, STORE_LINES.web);
  for (const p of ["ios", "android"]) {
    assert.equal(storeFor({ platform: p }).available, false);
    assert.equal(storeFor({ platform: p, plugin: fakePlugin() }).available, false, "no key → not available");
    assert.equal(storeFor({ platform: p, plugin: fakePlugin(), apiKey: "  " }).available, false);
    assert.equal(storeFor({ platform: p }).line, STORE_LINES.native);
    const s = storeFor({ platform: p, plugin: fakePlugin(), apiKey: "k" });
    assert.equal(s.available, true); assert.equal(s.line, "");
    assert.ok(STORE_KINDS.includes(s.kind));
  }
  assert.equal(storeFor({ platform: "ios", plugin: fakePlugin(), apiKey: "k" }).kind, "app-store");
  assert.equal(storeFor({ platform: "android", plugin: fakePlugin(), apiKey: "k" }).kind, "play");
});

test("startStore configures once, anonymously, and reads the entitlement", async () => {
  const plugin = fakePlugin({ owned: true });
  const s = storeFor({ platform: "ios", plugin, apiKey: "appl_pub" });
  assert.deepEqual(await startStore(s), { ok: true, owned: true });
  await startStore(s);
  const conf = plugin.calls.filter(([n]) => n === "configure");
  assert.equal(conf.length, 1, "configured once");
  assert.deepEqual(conf[0][1], { apiKey: "appl_pub" }, "no appUserID, nothing about her");
  assert.deepEqual(await startStore(storeFor({ platform: "web" })), { ok: false, owned: false });
});

test("loadOffer returns the store's own prices; buyPro buys a plan and opens Pro", async () => {
  const plugin = fakePlugin();
  const s = storeFor({ platform: "android", plugin, apiKey: "goog_pub" });
  const offer = await loadOffer(s, { tipIds: TIP_PRODUCTS.map((x) => x.id) });
  assert.equal(offer.plans.annual.priceString, "$29.99");
  assert.equal(offer.plans.monthly.priceString, "$4.99");
  assert.deepEqual(offer.tips.map((x) => x.id), TIP_PRODUCTS.map((x) => x.id));
  const b = await buyPro(s, "annual", offer);
  assert.deepEqual({ ok: b.ok, owned: b.owned, line: b.line }, { ok: true, owned: true, line: STORE_LINES.bought });
  assert.equal(plugin.calls.find(([n]) => n === "purchasePackage")[1].aPackage.product.identifier, PRO_PRODUCTS.annual.id);
  assert.equal(planFor({}, b.owned), PRO_PLAN);
  assert.equal(can("aiChat", planFor({}, b.owned)), true);
});

test("a cancelled or failed purchase owns nothing and says so plainly", async () => {
  const offerOf = async (p) => loadOffer(storeFor({ platform: "ios", plugin: p, apiKey: "k" }));
  const pc = fakePlugin({ buy: "cancel" }), pf = fakePlugin({ buy: "fail" });
  const c = await buyPro(storeFor({ platform: "ios", plugin: pc, apiKey: "k" }), "monthly", await offerOf(pc));
  assert.deepEqual({ ...c }, { ok: false, owned: false, cancelled: true, line: STORE_LINES.cancelled });
  const f = await buyPro(storeFor({ platform: "ios", plugin: pf, apiKey: "k" }), "monthly", await offerOf(pf));
  assert.deepEqual({ ...f }, { ok: false, owned: false, line: STORE_LINES.failed });
  const noOffer = await buyPro(storeFor({ platform: "ios", plugin: fakePlugin(), apiKey: "k" }), "annual", { plans: {} });
  assert.equal(noOffer.line, STORE_LINES.noPrice);
  assert.equal((await buyPro(storeFor({ platform: "web" }), "annual", {})).line, STORE_LINES.web);
});

test("restorePurchases reports what the store finds and nothing more", async () => {
  assert.equal((await restorePurchases(storeFor({ platform: "ios", plugin: fakePlugin({ restore: true }), apiKey: "k" }))).line, STORE_LINES.restored);
  const none = await restorePurchases(storeFor({ platform: "ios", plugin: fakePlugin({ restore: false }), apiKey: "k" }));
  assert.deepEqual({ ...none }, { ok: true, owned: false, line: STORE_LINES.restoredNone });
  assert.equal((await restorePurchases(storeFor({ platform: "web" }))).line, STORE_LINES.restoreWeb);
  assert.equal((await restorePurchases(storeFor({ platform: "android" }))).line, STORE_LINES.restoreNative);
});

test("a tip thanks her and never changes the plan", async () => {
  const plugin = fakePlugin();
  const s = storeFor({ platform: "ios", plugin, apiKey: "k" });
  const offer = await loadOffer(s, { tipIds: TIP_PRODUCTS.map((x) => x.id) });
  const r = await sendTip(s, "solia_tip_medium", offer);
  assert.deepEqual({ ...r }, { ok: true, line: STORE_LINES.tipThanks });
  assert.equal("owned" in r, false, "a tip carries no entitlement");
  const c = await sendTip(storeFor({ platform: "ios", plugin: fakePlugin({ buy: "cancel" }), apiKey: "k" }), "solia_tip_small", offer);
  assert.equal(c.cancelled, true);
});

test("ownsPro reads only an active pro entitlement; the sync default owns nothing", () => {
  assert.equal(ownsPro(PRO_INFO), true);
  for (const x of [null, {}, NO_INFO, { entitlements: { active: { pro: { isActive: false } } } }, { entitlements: { active: { other: { isActive: true } } } }]) assert.equal(ownsPro(x), false);
  assert.equal(proOwned(), false);
  assert.equal(planFor({}, proOwned()), PLAN);
  assert.equal(planFor({ proDev: true }, proOwned()), DEV_PRO_PLAN);
  assert.equal(ENTITLEMENT, "pro");
});

test("pricing: the owner's prices, store prices on phones, honest terms", () => {
  assert.equal(PRO_PRODUCTS.monthly.ref, "$4.99");
  assert.equal(PRO_PRODUCTS.annual.ref, "$29.99");
  assert.equal(PRO_PRODUCTS.annual.trialDays, 7);
  assert.match(WEB_PRICE_LINE, /in the iPhone and Android apps/);
  const a = planLines("annual", { priceString: "€32,99", price: 32.99 });
  assert.equal(a.price, "€32,99 a year");
  assert.equal(a.button, "Start 7-day free trial");
  assert.match(a.terms, /^Free for 7 days, then €32,99 a year\. Renews every year until you cancel\./);
  assert.equal(a.note, "About €2.74 a month");
  const m = planLines("monthly", { priceString: "$4.99", price: 4.99 });
  assert.equal(m.button, "Subscribe for $4.99 a month");
  assert.equal(m.note, null);
  assert.equal(planLines("annual", {}), null, "no store price → no line at all");
  assert.equal(perMonthOf(29.99, "$29.99"), "$2.49");
  assert.equal(perMonthOf(29.99, "29.99"), null, "no currency symbol → no claim");
  for (const k of ["app-store", "play"]) assert.match(CANCEL_LINES[k], /Cancel any time/);
  assert.match(KEEP_LINE, /nothing you logged is locked/);
});

test("purchase.js imports nothing, stores nothing, has no network of its own, sets nothing about her", () => {
  const code = stripComments(readFileSync(join(HERE, "purchase.js"), "utf8"));
  assert.ok(!/\bimport\s/.test(code), "no import");
  for (const w of ["fetch", "XMLHttpRequest", "sendBeacon", "indexedDB", "localStorage", "import.meta", "setAttributes", "setEmail", "logIn(", "appUserID", "setDisplayName", "collectDeviceIdentifiers", "setAdjustID", "setAppsflyerID"]) assert.ok(!code.includes(w), w);
  assert.ok(!/[$€£]\s?\d/.test(code), "no price in purchase.js: prices come from the store or pricing.js");
});
