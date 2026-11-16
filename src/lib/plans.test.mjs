import test from "node:test";
import assert from "node:assert/strict";
import { planTiles, webTiles, storeTrialDays, proTrialLine, proChipEligible, proChipNew, cleanProChip, PLANS_COPY } from "./plans.js";

const offer = (annualProduct = {}, monthlyProduct = {}) => ({
  plans: {
    annual: { priceString: "£89.99", price: 89.99, pkg: { product: { priceString: "£89.99", price: 89.99, ...annualProduct } } },
    monthly: { priceString: "£8.99", price: 8.99, pkg: { product: { priceString: "£8.99", price: 8.99, ...monthlyProduct } } },
  },
});

test("plans: the web's tiles are Yearly (best value, 7-day free trial) then Monthly, with the US reference prices", () => {
  const t = planTiles({ where: "web" });
  assert.deepEqual(t, webTiles());
  assert.deepEqual(t.map((x) => x.id), ["annual", "monthly"]);
  assert.deepEqual(t[0], { id: "annual", title: "Yearly", price: "$100 a year", note: "About $8.33 a month", trial: "7-day free trial", trialDays: 7, best: true });
  assert.deepEqual(t[1], { id: "monthly", title: "Monthly", price: "$9.95 a month", note: null, trial: null, trialDays: 0, best: false });
  assert.equal(proTrialLine("web", t), "Try Pro free for 7 days on the yearly plan, then $100 a year in the iPhone and Android apps. Cancel any time.");
});

test("plans: a phone shows only the store's prices, and no tiles until the store answers", () => {
  assert.deepEqual(planTiles({ where: "store", offer: null }), []);
  assert.deepEqual(planTiles({ where: "store", offer: { plans: {} } }), []);
  const t = planTiles({ where: "store", offer: offer({ introPrice: { price: 0, periodUnit: "DAY", periodNumberOfUnits: 7 } }) });
  assert.deepEqual(t.map((x) => [x.id, x.price, x.trial]), [["annual", "£89.99 a year", "7-day free trial"], ["monthly", "£8.99 a month", null]]);
  assert.equal(t[0].note, "About £7.49 a month");
  assert.ok(!JSON.stringify(t).includes("$"), "no reference price on a phone");
  assert.equal(proTrialLine("store", t), "Try Pro free for 7 days on the yearly plan, then £89.99 a year. Cancel any time.");
  // only what the store has
  const only = planTiles({ where: "store", offer: { plans: { monthly: offer().plans.monthly } } });
  assert.deepEqual(only.map((x) => x.id), ["monthly"]);
});

test("plans: the trial badge comes from the store's own offer (iOS intro price, Android free phase), never assumed", () => {
  assert.equal(storeTrialDays({ introPrice: { price: 0, periodUnit: "WEEK", periodNumberOfUnits: 1 } }), 7);
  assert.equal(storeTrialDays({ introPrice: { price: 0.99, periodUnit: "WEEK", periodNumberOfUnits: 1 } }), 0, "a paid intro price is not a free trial");
  assert.equal(storeTrialDays({ defaultOption: { freePhase: { billingPeriod: { unit: "DAY", value: 7 } } } }), 7);
  assert.equal(storeTrialDays({}), 0); assert.equal(storeTrialDays(null), 0);
  const t = planTiles({ where: "store", offer: offer() });
  assert.equal(t[0].trial, null);
  assert.equal(proTrialLine("store", t), null, "no store trial, no trial sentence");
});

test("plans: Home's note only without Pro, never beside the free-week bar, at most one day's first visit", () => {
  assert.equal(proChipEligible({ owned: false }), true);
  assert.equal(proChipEligible({ owned: true }), false);
  assert.equal(proChipEligible({ owned: false, trialBar: true }), false);
  assert.equal(proChipNew({ shownDay: null, todayIso: "2026-11-15" }), true);
  assert.equal(proChipNew({ shownDay: "2026-11-15", todayIso: "2026-11-15" }), false);
  assert.equal(proChipNew({ shownDay: "2026-11-14", todayIso: "2026-11-15" }), true);
  assert.equal(cleanProChip("2026-11-15"), "2026-11-15"); assert.equal(cleanProChip("x"), null); assert.equal(cleanProChip(3), null);
  assert.equal(PLANS_COPY.chip, "Pro · 7-day free trial");
});

test("plans: calm words only", () => {
  const all = JSON.stringify(PLANS_COPY) + JSON.stringify(webTiles());
  assert.doesNotMatch(all, /\b(upgrade now|limited time|hurry|don't miss|only \$|last chance)/i);
  assert.match(PLANS_COPY.comingSoon, /^Coming soon to the App Store and Google Play$/);
});
