/* Unit tests for lib/purchase.js (calm R8): the store stub owns nothing, answers honestly, and does no I/O. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { storeFor, buyPro, restorePurchases, proOwned, STORE_LINES, STORE_KINDS } from "./purchase.js";
import { planFor, PLAN, DEV_PRO_PLAN, can } from "./plan.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

test("storeFor: phones name their store but none is available; the web has none", () => {
  assert.deepEqual({ ...storeFor({ platform: "ios" }) }, { kind: "app-store", available: false, line: STORE_LINES.native });
  assert.deepEqual({ ...storeFor({ platform: "android" }) }, { kind: "play", available: false, line: STORE_LINES.native });
  for (const p of ["web", undefined, "x"]) assert.equal(storeFor({ platform: p }).kind, "none");
  assert.equal(storeFor().available, false);
  for (const p of ["ios", "android", "web"]) assert.ok(STORE_KINDS.includes(storeFor({ platform: p }).kind));
});

test("buyPro and restorePurchases own nothing and say why", async () => {
  for (const p of ["ios", "android", "web"]) {
    const s = storeFor({ platform: p });
    const b = await buyPro(s), r = await restorePurchases(s);
    assert.equal(b.owned, false); assert.equal(b.ok, false);
    assert.equal(r.owned, false); assert.equal(r.ok, false);
    assert.equal(r.line, p === "web" ? STORE_LINES.restoreWeb : STORE_LINES.restoreNative);
  }
  assert.equal(proOwned(), false);
});

test("the stub never opens Pro: only proDev does", () => {
  assert.equal(planFor({}, proOwned()), PLAN);
  assert.equal(can("aiChat", planFor({}, proOwned())), false);
  assert.equal(planFor({ proDev: true }, proOwned()), DEV_PRO_PLAN);
});

test("no price, no network, no storage", () => {
  const code = stripComments(readFileSync(join(HERE, "purchase.js"), "utf8"));
  assert.ok(!/\bimport\s/.test(code), "no import");
  for (const w of ["fetch", "XMLHttpRequest", "sendBeacon", "indexedDB", "localStorage", "import.meta"]) assert.ok(!code.includes(w), w);
  assert.ok(!/[$€£]\s?\d|\d+[.,]\d\d\s?(USD|EUR|GBP)/.test(code), "no price");
});
