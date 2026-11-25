/* Anonymous shop tap counts (2026-11-19, docs/plans/tracking-reports.md Task 1). When she opens a product from the Shop
   page ("Visit <brand>" or the product picture), the app tells Solia Health's server which PRODUCT was opened, so the
   server can keep one total per product per day (backend/src/modules/shop: shop_taps). Pure: no imports; the caller
   passes the build's facts (a server and the shop flag) and her device-only switch.

   What is sent: POST <server>/api/shop/tap with the body {"productId":"<id>"} and NOTHING else: no cookie
   (credentials "omit"), no token or other header of ours, no referrer, no account, device id, stage, module or anything
   she logged. Fire-and-forget with keepalive: it never blocks or delays the link, and a failure is ignored.
   When nothing is sent: a build without a server or without the shop flag; her switch "Count my shop taps anonymously"
   (You → Privacy & your data → What can leave this device, and the Shop page's footer) not turned on; an id that isn't a
   catalog id. Since 2026-11-25 (docs/plans/critique-fixes.md Task 3) the count is OPT-IN: off for everyone until she
   turns it on (record key shopTapsOn); the older key shopTapsOff is no longer read. */

export const TAP_PATH = "/api/shop/tap";
const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/; // the server's product id shape (backend/src/modules/shop/vocab.js ID_RE)

/** The exact request body for a product id, or null when the id isn't a catalog id. Only ever { productId }. */
export function tapBody(productId) {
  return typeof productId === "string" && ID_RE.test(productId) ? { productId } : null;
}

/** Whether a tap may be counted at all: a build with a server and the shop (live), and her switch turned ON. */
export const tapsOn = ({ live = false, on = false } = {}) => live === true && on === true;

/** Sends one tap, or nothing. → true when a request was started. Never throws and never waits. */
export function sendShopTap(productId, { live = false, on = false, base = "", fetchImpl = globalThis.fetch } = {}) {
  if (!tapsOn({ live, on }) || !base || typeof fetchImpl !== "function") return false;
  const body = tapBody(productId);
  if (!body) return false;
  try {
    const p = fetchImpl(`${base}${TAP_PATH}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", keepalive: true });
    if (p && typeof p.catch === "function") p.catch(() => { /* a count that didn't arrive is simply not counted */ });
  } catch { return false; }
  return true;
}

export const TAP_COPY = Object.freeze({
  name: "Count my shop taps anonymously",
  line: "When you open a product in the Shop, Solia Health's server gets that product's id and nothing else, and adds one to that product's total for the day. No account, no device id, no stage and nothing you logged goes with it.",
  detail1: "The request is sent without a cookie, a sign-in token or a referrer, even when you're signed in. Solia Health's server keeps one number per product per day, for 400 days, and no record of the single tap.",
  detail2: "Like any request, it shows your device's internet address and app or browser type. Solia Health's own code uses the address only in memory, to limit repeated requests, and doesn't keep it.",
  detail3: "The totals show Solia Health which products people open, and each brand sees the totals for its own products. It is off unless you turn it on; while it is off, nothing is sent when you open a product.",
  foot: "When you open a product, Solia Health counts one anonymous tap for that product. It isn't linked to you or to anything you log. You can turn this off here or in You → Privacy & your data.",
  // 2026-11-25: the Shop footer offers the switch once, quietly (off until she turns it on)
  ask: "Help Solia Health see which products people open?",
  switchName: "Count my taps anonymously",
});
