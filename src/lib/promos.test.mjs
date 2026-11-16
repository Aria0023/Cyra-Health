/* Promotions in the app (docs/plans/portal-subscriptions.md Task 3): the cleaner, the device-side audience rules, the
   once-a-day download, and the rule that a phone never shows a promotion without the store's own price. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanPromo, cleanPromos, cleanPromoCache, cleanPromoHidden, promosDue, promoStageOf, isNewUser, promoFor, promoBanner, PROMO_COPY } from "./promos.js";
import { planLines } from "./pricing.js";
import { storeTrialDays } from "./plans.js";

const P = (over = {}) => ({ id: "promo_spring1", offeringId: "spring_clinic", platforms: ["ios", "android", "web"], audience: { who: "everyone", stages: [] }, startsAt: "2026-11-10T00:00:00.000Z", endsAt: "2026-11-30T00:00:00.000Z", banner: { title: "A calmer start", body: "A longer free trial on the yearly plan." }, ...over });
const NOW = Date.parse("2026-11-15T12:00:00Z");

test("cleanPromo: keeps only the known shape; anything odd drops the promotion", () => {
  assert.deepEqual(cleanPromo(P()), P());
  assert.equal(cleanPromo(P({ id: "<script>" })), null);
  assert.equal(cleanPromo(P({ offeringId: "has spaces" })), null);
  assert.equal(cleanPromo(P({ platforms: ["ios", "windows"] })), null);
  assert.equal(cleanPromo(P({ platforms: [] })), null);
  assert.equal(cleanPromo(P({ audience: { who: "stages", stages: [] } })), null);
  assert.equal(cleanPromo(P({ audience: { who: "stages", stages: ["ttc", "elsewhere"] } })), null);
  assert.equal(cleanPromo(P({ audience: { who: "anyone" } })), null);
  assert.equal(cleanPromo(P({ endsAt: "2026-11-01T00:00:00Z" })), null);
  assert.equal(cleanPromo(P({ banner: { title: "x".repeat(41), body: "y" } })), null);
  assert.equal(cleanPromo(P({ banner: { title: "Hi", body: "" } })), null);
  assert.deepEqual(cleanPromo(P({ banner: { title: " Calm‮title ", body: "a\n b" } })).banner, { title: "Calm title", body: "a b" });
  assert.deepEqual(Object.keys(cleanPromo({ ...P(), name: "Dr Smith's patients", price: "$1" })).sort(), ["audience", "banner", "endsAt", "id", "offeringId", "platforms", "startsAt"], "extra fields never kept");
  assert.equal(cleanPromos({ nope: 1 }), null);
  assert.deepEqual(cleanPromos({ promotions: [P(), { bad: true }] }).map((p) => p.id), ["promo_spring1"]);
  assert.equal(cleanPromos({ promotions: Array.from({ length: 30 }, (_, i) => P({ id: `promo_${String(i).padStart(4, "0")}` })) }).length, 20);
});

test("device copy and hidden ids: cleaned; downloaded again after a day", () => {
  assert.equal(cleanPromoCache(null), null);
  assert.equal(cleanPromoCache({ at: "nope", list: [] }), null);
  assert.deepEqual(cleanPromoCache({ at: "2026-11-15T00:00:00Z", list: [P(), 4] }), { at: "2026-11-15T00:00:00.000Z", list: [P()] });
  assert.deepEqual(cleanPromoHidden(["promo_spring1", "promo_spring1", 3, "<x>"]), ["promo_spring1"]);
  assert.equal(promosDue(null, NOW), true);
  assert.equal(promosDue({ at: new Date(NOW - 23 * 3600000).toISOString(), list: [] }, NOW), false);
  assert.equal(promosDue({ at: new Date(NOW - 24 * 3600000).toISOString(), list: [] }, NOW), true);
});

test("audience on the device: stage ids, new = first used within 14 days", () => {
  assert.equal(promoStageOf({ stage: "periods" }), "periods");
  assert.equal(promoStageOf({ stage: "periods", ttc: true }), "ttc");
  assert.equal(promoStageOf({ stage: "peri", meno: true }), "meno");
  assert.equal(promoStageOf({ stage: "preg" }), "preg");
  assert.equal(promoStageOf({ stage: null }), null);
  assert.equal(isNewUser("2026-11-02", "2026-11-15"), true);
  assert.equal(isNewUser("2026-11-01", "2026-11-15"), false, "the 15th day is not new");
  assert.equal(isNewUser(null, "2026-11-15"), false);
  assert.equal(isNewUser("2026-11-20", "2026-11-15"), false);
  const list = [P({ id: "promo_newbies", audience: { who: "new", stages: [] } }), P({ id: "promo_meno01", audience: { who: "stages", stages: ["meno"] }, platforms: ["ios"] }), P({ id: "promo_every1" })];
  assert.equal(promoFor(list, { platform: "ios", stage: "meno", isNew: true, nowMs: NOW }).id, "promo_newbies", "the first match, one at a time");
  assert.equal(promoFor(list, { platform: "ios", stage: "meno", isNew: false, nowMs: NOW }).id, "promo_meno01");
  assert.equal(promoFor(list, { platform: "android", stage: "meno", nowMs: NOW }).id, "promo_every1", "platform filter");
  assert.equal(promoFor(list, { platform: "web", stage: "ttc", hidden: ["promo_every1"], nowMs: NOW }), null, "a hidden one stays hidden");
  assert.equal(promoFor(list, { platform: "ios", stage: "meno", nowMs: NOW, owned: true }), null, "nobody with Pro sees one");
  assert.equal(promoFor(list, { platform: "ios", nowMs: Date.parse("2026-12-01T00:00:00Z") }), null, "past its end on this device's clock");
});

test("no price without the store: a phone shows a banner only with the store's own price strings; the web never shows a price", () => {
  const promo = P();
  const pkg = (type, id, priceString, price, trial = false) => ({ identifier: type, packageType: type, product: { identifier: id, priceString, price, ...(trial ? { introPrice: { price: 0, periodUnit: "MONTH", periodNumberOfUnits: 1 } } : {}) } });
  const offer = { ok: true, plans: { annual: { pkg: pkg("ANNUAL", "solia_pro_annual_spring", "€99,99", 99.99, true), priceString: "€99,99", price: 99.99 } } };
  const b = promoBanner(promo, { where: "store", offer, lines: planLines, trialDays: storeTrialDays });
  assert.deepEqual(b.prices, ["Yearly: €99,99 a year · 30-day free trial"]);
  assert.equal(b.foot, PROMO_COPY.storeLine);
  assert.equal(promoBanner(promo, { where: "store", offer: null, lines: planLines }), null, "the store hasn't answered: nothing");
  assert.equal(promoBanner(promo, { where: "store", offer: { ok: false, plans: {} }, lines: planLines }), null, "the offering didn't load: nothing");
  assert.equal(promoBanner(promo, { where: "store", offer: { ok: true, plans: { annual: { priceString: "" } } }, lines: planLines }), null, "no price string: nothing");
  const w = promoBanner(promo, { where: "web" });
  assert.deepEqual(w.prices, []);
  assert.equal(w.foot, PROMO_COPY.webLine);
  assert.ok(!/[$€£]\s?\d/.test(JSON.stringify(w)), "no reference price on the web for a promotion");
});

test("planLines: a promotion's offering names the trial its store product has, never the regular plan's", () => {
  assert.equal(planLines("annual", { priceString: "$89.99", price: 89.99, trialDays: 30 }).button, "Start 30-day free trial");
  assert.equal(planLines("annual", { priceString: "$89.99", price: 89.99, trialDays: 0 }).button, "Subscribe for $89.99 a year");
  assert.equal(planLines("annual", { priceString: "$100.00", price: 100 }).button, "Start 7-day free trial", "unchanged without it");
});
