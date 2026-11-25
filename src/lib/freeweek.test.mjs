/* Unit tests for "Subscribe any time during the free week" (docs/plans/upgrade-enterprise.md Task 6): the Pro sheet's line
   reads each plan's trial days from the same tiles the sheet shows (the store's own product on a phone), never a fixed
   number; the web says Pro is in the phone apps; nothing is said outside the free week; and a purchase makes the header's
   plan badge "Pro" on the same render (a mock store, as in purchase.test.mjs). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { freeWeekLine, planTiles, webTiles } from "./plans.js";
import { storeFor, loadOffer, buyPro } from "./purchase.js";
import { planBadge } from "./planBadge.js";

const PRO_INFO = { entitlements: { active: { pro: { isActive: true, identifier: "pro" } } } };
/** A mock RevenueCat plugin; yearlyTrial: the free-trial days of the yearly product (iOS introPrice), 0 = none. */
function mockStore({ yearlyTrial = 7 } = {}) {
  const pkg = (type, id, priceString, price, intro) => ({ identifier: `$rc_${type.toLowerCase()}`, packageType: type, product: { identifier: id, priceString, price, ...(intro ? { introPrice: { price: 0, periodUnit: "DAY", periodNumberOfUnits: intro } } : {}) } });
  const plugin = {
    async configure() {}, async getCustomerInfo() { return { customerInfo: { entitlements: { active: {} } } }; },
    async getOfferings() { return { current: { availablePackages: [pkg("MONTHLY", "solia_pro_monthly", "$9.95", 9.95, 0), pkg("ANNUAL", "solia_pro_annual", "$100.00", 100, yearlyTrial)] } }; },
    async getProducts() { return { products: [] }; },
    async purchasePackage() { return { customerInfo: PRO_INFO }; },
  };
  return storeFor({ platform: "ios", plugin, apiKey: "appl_test" });
}

test("the store's line names each plan's own trial from the store, and that monthly is charged at once", async () => {
  for (const days of [7, 3, 0]) {
    const store = mockStore({ yearlyTrial: days });
    const offer = await loadOffer(store);
    const tiles = planTiles({ where: "store", offer });
    const line = freeWeekLine({ where: "store", daysLeft: 3, tiles });
    assert.match(line, /^You can subscribe now\. Your free week isn't extended: /);
    if (days) assert.ok(line.includes(`the yearly plan's ${days} free days start when you subscribe`), line);
    else assert.ok(line.includes("the yearly plan is charged from the day you subscribe"), line);
    assert.ok(line.includes("the monthly plan is charged from the day you subscribe"), line);
  }
  assert.equal(freeWeekLine({ where: "store", daysLeft: 3, tiles: [] }), null, "no tiles yet (the store hasn't answered): nothing is claimed");
});

test("the web: Pro is in the phone apps; nothing outside the free week", () => {
  assert.equal(freeWeekLine({ where: "web", daysLeft: 5, tiles: webTiles() }), "You can get Pro in the iPhone or Android app at any time, during your free week too.");
  for (const d of [0, -1, undefined]) assert.equal(freeWeekLine({ where: "web", daysLeft: d, tiles: webTiles() }), null);
  const src = readFileSync(new URL("./plans.js", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("export function freeWeekLine"));
  assert.doesNotMatch(fn.slice(0, fn.indexOf("\n}\n")), /\b7\b/, "no trial length written into the line");
});

test("after a purchase the header's badge is Pro on the same render (mock store → buyPro → planBadge)", async () => {
  const store = mockStore();
  const offer = await loadOffer(store);
  const before = planBadge({ owned: false, gateOn: true, startIso: "2026-11-23", todayIso: "2026-11-25" });
  assert.equal(before.label, "Free week · 5 days left");
  const r = await buyPro(store, "annual", offer);
  assert.equal(r.owned, true);
  assert.equal(planBadge({ owned: r.owned, gateOn: true, startIso: "2026-11-23", todayIso: "2026-11-25" }).label, "Pro");
  // App.jsx: the sheet's onOwned sets proOwnedNow, and the badge is computed from proOwnedNow on every render
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(app, /onOwned=\{\(o\) => setProOwnedNow\(o\)\}/);
  assert.match(app, /const planNow = planBadge\(\{ owned: proOwnedNow,/);
  // and the Pro sheet hands a successful purchase straight to onOwned
  const sheet = readFileSync(new URL("../components/ProSheet.jsx", import.meta.url), "utf8");
  assert.match(sheet, /if \(r\.owned\) onOwned\?\.\(true\);/);
});
