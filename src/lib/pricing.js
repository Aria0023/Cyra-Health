/* Pro pricing (owner decision D4, 2026-11-12; prices changed by the owner the same day): $9.95 a month or $100 a year, a 7-day free trial on the yearly
   plan, plus optional one-time tips. Pure: no imports, no storage, no network.

   Where a price may appear (App Store Review Guideline 3.1.2 and Google Play's subscription policy):
   - On a phone, ONLY the price the store returns (product.priceString), in her own currency. The reference prices
     below are never shown on a phone; if the store hasn't answered, no price is shown at all.
   - On the web, nothing is sold. The web may name the reference US price as "in the iPhone and Android apps".
   Product ids are the contract with App Store Connect, Google Play Console and RevenueCat (docs/STORE-SETUP.md). */

/** The RevenueCat entitlement that Pro's subscriptions grant. */
export const ENTITLEMENT = "pro";

/** The two Pro subscriptions. `ref` is the owner's US reference price (web wording only). */
export const PRO_PRODUCTS = Object.freeze({
  monthly: Object.freeze({ id: "solia_pro_monthly", packageType: "MONTHLY", ref: "$9.95", per: "month", trialDays: 0 }),
  annual: Object.freeze({ id: "solia_pro_annual", packageType: "ANNUAL", ref: "$100", per: "year", trialDays: 7 }),
});
export const PRO_PLAN_IDS = Object.freeze(["annual", "monthly"]);

/** One-time "Support Solia Health" tips: consumables, they unlock nothing (a tip never changes the plan). */
export const TIP_PRODUCTS = Object.freeze([
  Object.freeze({ id: "solia_tip_small", ref: "$1.99", label: "A small thank-you" }),
  Object.freeze({ id: "solia_tip_medium", ref: "$4.99", label: "A coffee's worth" }),
  Object.freeze({ id: "solia_tip_large", ref: "$9.99", label: "A big boost" }),
]);

/** The web's sentence about Pro (no store on the web, so the US reference price, named as such). */
export const WEB_PRICE_LINE = `Pro is ${PRO_PRODUCTS.monthly.ref} a month or ${PRO_PRODUCTS.annual.ref} a year in the iPhone and Android apps, with a ${PRO_PRODUCTS.annual.trialDays}-day free trial on the yearly plan.`;

/** "$2.50 a month" for a yearly price, from the store's own number and currency symbol in its price string. Null when
    the store's string can't be read safely (then nothing is claimed). */
export function perMonthOf(price, priceString) {
  if (typeof price !== "number" || !(price > 0) || typeof priceString !== "string") return null;
  const m = priceString.match(/^([^\d\s.,]*)\s?[\d.,]+\s?([^\d\s.,]*)$/);
  if (!m || (!m[1] && !m[2])) return null;
  const n = (Math.floor((price / 12) * 100) / 100).toFixed(2);
  return `${m[1]}${n}${m[2] ? " " + m[2] : ""}`;
}

/** What the subscribe button and the lines under it say, for one plan with the store's own price. Required by
    Guideline 3.1.2: the title, the length, the price per period, auto-renewal, and how to cancel. */
export function planLines(planId, { priceString, price } = {}) {
  const p = PRO_PRODUCTS[planId];
  if (!p || typeof priceString !== "string" || !priceString) return null;
  const trial = p.trialDays > 0;
  const perMonth = planId === "annual" ? perMonthOf(price, priceString) : null;
  return {
    title: planId === "annual" ? "Yearly" : "Monthly",
    price: `${priceString} a ${p.per}`,
    note: planId === "annual" ? (perMonth ? `About ${perMonth} a month` : null) : null,
    button: trial ? `Start ${p.trialDays}-day free trial` : `Subscribe for ${priceString} a ${p.per}`,
    terms: trial
      ? `Free for ${p.trialDays} days, then ${priceString} a ${p.per}. Renews every ${p.per} until you cancel. Cancel at least a day before the trial ends and you won't be charged.`
      : `${priceString} a ${p.per}. Renews every ${p.per} until you cancel.`,
  };
}

/** How to cancel, by store (Guideline 3.1.2: tell her how). */
export const CANCEL_LINES = Object.freeze({
  "app-store": "Cancel any time in Settings → your name → Subscriptions. Payment is charged to your Apple Account.",
  play: "Cancel any time in Google Play → Payments & subscriptions → Subscriptions. Payment is charged to your Google Play account.",
});

/** The promise that ending Pro keeps (docs/MONETIZATION.md §6). */
export const KEEP_LINE = "If Pro ends, nothing you logged is changed or deleted, and you can always open, export or delete it.";
