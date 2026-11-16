/* Store purchases (calm R8; owner decision D4, 2026-11-12): the one place Solia Health asks the app store about Pro.
   No imports, no storage, no network of its own. App.jsx passes the platform ("ios" | "android" | "web"), the store
   plugin (RevenueCat's Capacitor plugin, lib/native.js Purchases, only on a phone where it is bundled) and the
   store's public SDK key for that platform (VITE_REVENUECAT_IOS_KEY / VITE_REVENUECAT_ANDROID_KEY: RevenueCat's
   public app keys are designed to ship inside apps; they are not secrets).

   What the store is told: configure() gets no app user id, so RevenueCat makes an anonymous one. Since 2026-11-15
   (docs/plans/portal-subscriptions.md Task 3), while she is signed in to a Solia Health account the app calls
   RevenueCat's logIn with her opaque account id (linkAccount), so a free Pro grant made in the partner portal reaches
   her; signing out or deleting the account calls logOut (unlinkAccount) and RevenueCat goes back to an anonymous id.
   Never her email, her name, attributes or health data (docs/MONETIZATION.md §6, docs/PRIVACY-AUDIT.md "Pro").
   What it answers: offerings with the store's own prices, and whether the "pro" entitlement is active (and, for a free
   grant, until when).

     storeFor({ platform, plugin, apiKey }) → { kind, available, line, plugin, apiKey }
     startStore(store)                      → Promise<{ ok, owned, until }> configure once, then read the entitlement
     loadOffer(store, { offeringId })       → Promise<{ ok, plans, tips }> the store's packages and prices (the current
                                              offering, or a promotion's named offering: nothing when it doesn't exist)
     linkAccount(store, accountId)          → Promise<{ ok, owned, until }> RevenueCat logIn with the opaque account id
     unlinkAccount(store)                   → Promise<{ ok, owned }>        RevenueCat logOut (back to an anonymous id)
     redeemCode(store, { platform, code, appStoreId }) → Promise<{ ok, how, url?, line }> "Have a code?"
     buyPro(store, planId, offer)           → Promise<{ ok, owned, cancelled?, line }>
     restorePurchases(store)                → Promise<{ ok, owned, line }>
     sendTip(store, tipId, offer)           → Promise<{ ok, cancelled?, line }>  never changes the plan
   Without a plugin and a key (the web, a build without the store) nothing is available and every answer says so. */

export const STORE_KINDS = Object.freeze(["app-store", "play", "none"]);

export const STORE_LINES = Object.freeze({
  native: "The app store isn't connected in this build, so Pro can't be bought or restored here yet.",
  web: "Pro is sold in the iPhone and Android apps. There's nothing to buy on the web.",
  restoreNative: "Restoring purchases needs the app store, which isn't connected in this build. Nothing was checked or sent.",
  restoreWeb: "There's nothing to restore on the web: Pro is sold in the iPhone and Android apps.",
  restored: "Restored. Pro is on.",
  restoredNone: "No Pro subscription was found for this Apple or Google account.",
  bought: "Pro is on. Thank you.",
  cancelled: "Nothing was bought.",
  failed: "The store couldn't finish that. Nothing was charged. Try again in a moment.",
  noPrice: "The store hasn't answered with a price yet. Nothing can be bought until it does.",
  tipThanks: "Thank you. Your tip helps keep Solia Health going.",
  // 2026-11-15 (Task 3): what RevenueCat, which runs Pro for the stores, is told about her
  whoKnows: "RevenueCat, which handles Pro for the stores, gets an anonymous id, or your account number if you're signed in; never your email or anything you log.",
});

export const ENTITLEMENT_ID = "pro";
const KIND = { ios: "app-store", android: "play" };

/** The store this build can use: available only on a phone with the plugin bundled and its public key set. */
export function storeFor({ platform = "web", plugin = null, apiKey = "" } = {}) {
  const kind = KIND[platform] || "none";
  if (kind === "none") return Object.freeze({ kind, available: false, line: STORE_LINES.web, plugin: null, apiKey: "" });
  const ready = !!plugin && typeof apiKey === "string" && apiKey.trim().length > 0;
  return Object.freeze({ kind, available: ready, line: ready ? "" : STORE_LINES.native, plugin: ready ? plugin : null, apiKey: ready ? apiKey.trim() : "" });
}

/** Whether a RevenueCat customerInfo carries an active Pro entitlement. Anything unreadable is false. */
export const ownsPro = (info) => !!(info && info.entitlements && info.entitlements.active && info.entitlements.active[ENTITLEMENT_ID] && info.entitlements.active[ENTITLEMENT_ID].isActive === true);

/** For a time-limited FREE grant (RevenueCat's promotional entitlement, from the partner portal): its end as an ISO
    time, else null. A paid subscription renews, so it never gets an "until". */
export function proUntil(info) {
  const e = ownsPro(info) ? info.entitlements.active[ENTITLEMENT_ID] : null;
  if (!e || String(e.store || "").toUpperCase() !== "PROMOTIONAL" || typeof e.expirationDate !== "string") return null;
  const t = Date.parse(e.expirationDate);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
const readInfo = (r) => ({ owned: ownsPro(r && r.customerInfo), until: proUntil(r && r.customerInfo) });

/* The native plugin rejects a cancelled purchase with code "1" (PURCHASE_CANCELLED_ERROR) and userCancelled in its data. */
const cancelledErr = (e) => !!e && (e.userCancelled === true || (e.data && e.data.userCancelled === true) || String(e.code) === "1");
const configured = new WeakSet();

/** Configure the store once (anonymous: no app user id), then read whether Pro is active. */
export async function startStore(store) {
  if (!store || !store.available) return { ok: false, owned: false, until: null };
  try {
    if (!configured.has(store.plugin)) { await store.plugin.configure({ apiKey: store.apiKey }); configured.add(store.plugin); }
    const r = await store.plugin.getCustomerInfo();
    return { ok: true, ...readInfo(r) };
  } catch {
    return { ok: false, owned: false, until: null };
  }
}

/** The account id RevenueCat may be told: the opaque id the accounts module made (never an email or a name). */
export const ACCOUNT_ID_RE = /^[A-Za-z0-9_-]{8,40}$/;
/** While she is signed in: RevenueCat's logIn with her account id ONLY, so a Pro grant made for her account reaches this
    device. Configures first if needed. Anything else (an email, a name) is refused before any call. */
export async function linkAccount(store, accountId) {
  if (!store || !store.available || typeof accountId !== "string" || !ACCOUNT_ID_RE.test(accountId)) return { ok: false, owned: false, until: null };
  const s = await startStore(store);
  if (!s.ok) return { ok: false, owned: false, until: null };
  try {
    const r = await store.plugin.logIn({ appUserID: accountId });
    return { ok: true, ...readInfo(r) };
  } catch {
    return { ok: false, owned: false, until: null };
  }
}
/** Signed out or the account deleted: RevenueCat's logOut, back to a new anonymous id. Already anonymous = nothing to do. */
export async function unlinkAccount(store) {
  if (!store || !store.available || !configured.has(store.plugin)) return { ok: false, owned: false };
  try {
    const a = typeof store.plugin.isAnonymous === "function" ? await store.plugin.isAnonymous() : null;
    if (a && a.isAnonymous === true) return { ok: true, owned: false };
    const r = await store.plugin.logOut();
    return { ok: true, owned: ownsPro(r && r.customerInfo) };
  } catch {
    return { ok: false, owned: false };
  }
}

/** The store's current offering: { plans: { annual, monthly }, tips: [...] }, each with the store's own price. */
export async function loadOffer(store, { planTypes = { annual: "ANNUAL", monthly: "MONTHLY" }, tipIds = [], offeringId = null } = {}) {
  if (!store || !store.available) return { ok: false, plans: {}, tips: [] };
  try {
    const o = await store.plugin.getOfferings();
    // a promotion names its own offering; one the store doesn't have answers nothing (never the current one instead)
    const offering = offeringId ? (o && o.all && typeof o.all === "object" && Object.hasOwn(o.all, offeringId) ? o.all[offeringId] : null) : o && o.current;
    if (offeringId && !offering) return { ok: false, plans: {}, tips: [] };
    const pkgs = (offering && Array.isArray(offering.availablePackages)) ? offering.availablePackages : [];
    const plans = {};
    for (const [id, type] of Object.entries(planTypes)) {
      const pkg = pkgs.find((p) => p && p.packageType === type && p.product && typeof p.product.priceString === "string");
      if (pkg) plans[id] = { pkg, priceString: pkg.product.priceString, price: pkg.product.price };
    }
    let tips = [];
    if (tipIds.length) {
      const r = await store.plugin.getProducts({ productIdentifiers: tipIds, type: "NON_SUBSCRIPTION" }).catch(() => ({ products: [] }));
      const got = (r && Array.isArray(r.products)) ? r.products : [];
      tips = tipIds.map((id) => got.find((p) => p && p.identifier === id)).filter((p) => p && typeof p.priceString === "string").map((p) => ({ id: p.identifier, product: p, priceString: p.priceString }));
    }
    return { ok: true, plans, tips };
  } catch {
    return { ok: false, plans: {}, tips: [] };
  }
}

/** Buy one Pro plan ("annual" | "monthly") from a loaded offer. */
export async function buyPro(store, planId, offer) {
  if (!store || !store.available) return { ok: false, owned: false, line: store && store.kind !== "none" ? STORE_LINES.native : STORE_LINES.web };
  const plan = offer && offer.plans && offer.plans[planId];
  if (!plan) return { ok: false, owned: false, line: STORE_LINES.noPrice };
  try {
    const r = await store.plugin.purchasePackage({ aPackage: plan.pkg });
    const owned = ownsPro(r && r.customerInfo);
    return { ok: owned, owned, line: owned ? STORE_LINES.bought : STORE_LINES.failed };
  } catch (e) {
    return cancelledErr(e) ? { ok: false, owned: false, cancelled: true, line: STORE_LINES.cancelled } : { ok: false, owned: false, line: STORE_LINES.failed };
  }
}

/** "Restore purchases": asks the store which subscriptions this Apple or Google account owns. */
export async function restorePurchases(store) {
  if (!store || !store.available) return { ok: false, owned: false, line: store && store.kind !== "none" ? STORE_LINES.restoreNative : STORE_LINES.restoreWeb };
  try {
    const r = await store.plugin.restorePurchases();
    const owned = ownsPro(r && r.customerInfo);
    return { ok: true, owned, line: owned ? STORE_LINES.restored : STORE_LINES.restoredNone };
  } catch {
    return { ok: false, owned: false, line: STORE_LINES.failed };
  }
}

/** A one-time tip. It unlocks nothing and never changes the plan. */
export async function sendTip(store, tipId, offer) {
  if (!store || !store.available) return { ok: false, line: store && store.kind !== "none" ? STORE_LINES.native : STORE_LINES.web };
  const tip = offer && Array.isArray(offer.tips) ? offer.tips.find((x) => x.id === tipId) : null;
  if (!tip) return { ok: false, line: STORE_LINES.noPrice };
  try {
    await store.plugin.purchaseStoreProduct({ product: tip.product });
    return { ok: true, line: STORE_LINES.tipThanks };
  } catch (e) {
    return cancelledErr(e) ? { ok: false, cancelled: true, line: STORE_LINES.cancelled } : { ok: false, line: STORE_LINES.failed };
  }
}

/** "Have a code?" (partner promo codes, Task 3). iOS: Apple's own code sheet through the plugin when it has one, else
    Apple's redeem page for this app (VITE_APP_STORE_ID). Android: Google Play's redeem page for the code she typed.
    Web: nothing to redeem here. The code never goes to Solia Health or RevenueCat. */
export const CODE_RE = /^[A-Za-z0-9-]{4,64}$/;
export const appleRedeemUrl = (appStoreId) => (/^\d{6,12}$/.test(String(appStoreId || "")) ? `https://apps.apple.com/redeem?ctx=offercodes&id=${appStoreId}` : null);
export const playRedeemUrl = (code) => (CODE_RE.test(String(code || "").trim()) ? `https://play.google.com/redeem?code=${encodeURIComponent(String(code).trim())}` : null);
export const CODE_LINES = Object.freeze({
  web: "Codes are redeemed in the Solia Health app on iPhone or Android: open Pro there and tap \"Have a code?\". There's nothing to redeem on the web.",
  noStore: "The app store isn't connected in this build, so a code can't be redeemed here yet.",
  badCode: "Enter the code as it was given to you: letters, numbers and dashes.",
  opened: "The store's code page is open. When it's done, come back here: Pro turns on once the store confirms it.",
  failed: "The store's code page couldn't open. Try again in a moment.",
});
export async function redeemCode(store, { platform = "web", code = "", appStoreId = "" } = {}) {
  if (platform === "web" || !store || store.kind === "none") return { ok: false, how: "none", line: CODE_LINES.web };
  if (platform === "android") {
    const url = playRedeemUrl(code);
    return url ? { ok: true, how: "url", url, line: CODE_LINES.opened } : { ok: false, how: "none", line: CODE_LINES.badCode };
  }
  if (store.available) {
    try { await store.plugin.presentCodeRedemptionSheet(); return { ok: true, how: "sheet", line: CODE_LINES.opened }; } catch { /* the plugin has no sheet here: Apple's page instead */ }
  }
  const url = appleRedeemUrl(appStoreId);
  return url ? { ok: true, how: "url", url, line: CODE_LINES.opened } : { ok: false, how: "none", line: store.available ? CODE_LINES.failed : CODE_LINES.noStore };
}

/** Kept for callers that only need a synchronous answer at launch: nothing is owned until the store has answered. */
export const proOwned = () => false;
