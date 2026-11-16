/* The Shop's product illustrations (docs/plans/shop-findable-visuals.md Task 2): every bundled item names a known
   drawing, the drawings are generic and self-contained (no text, no link, no script, no inline style: the partner
   portal's CSP allows none), and an unknown id from the server falls back to the need's default. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SHOP_ART, ART_IDS, ART_LABEL, ART_DEFAULT, cleanArt, artFor, artSvg } from "./shopArt.js";
import { SHOP_ITEMS, SHOP_CATEGORIES, SHOP_PAGE_COPY, BRANDS } from "./shop.js";
import { cleanCatalog, cleanShopCatalog, liveShop, bundledShop } from "./shopCatalog.js";

test("every bundled item has a valid art id; the three glucose sensors use two variants", () => {
  for (const i of SHOP_ITEMS) assert.ok(ART_IDS.includes(i.art), `${i.id}: ${i.art}`);
  assert.equal(ART_IDS.length, 23);
  assert.deepEqual([...new Set(SHOP_ITEMS.filter((i) => i.category === "glucose").map((i) => i.art))].sort(), ["cgm-a", "cgm-b"]);
  const used = new Set(SHOP_ITEMS.map((i) => i.art));
  for (const id of ART_IDS) assert.ok(used.has(id), `${id} is drawn for some item`);
  for (const b of bundledShop().items) assert.ok(ART_IDS.includes(b.art), b.id);
});

test("every need has a default drawing, and every drawing a plain label for the portal's picker", () => {
  for (const c of SHOP_CATEGORIES) assert.ok(ART_IDS.includes(ART_DEFAULT[c.id]), c.id);
  assert.deepEqual(Object.keys(ART_LABEL), [...ART_IDS]);
  for (const l of Object.values(ART_LABEL)) assert.ok(l.length > 5 && l.length < 50, l);
});

test("the drawings are generic and self-contained: no text, links, scripts, images or inline style; about 3 to 8 KB each", () => {
  const brands = Object.keys(BRANDS).filter((b) => b.length > 3);
  for (const id of ART_IDS) {
    const s = SHOP_ART[id];
    assert.ok(s.length > 3000 && s.length < 8192, `${id}: ${s.length} bytes`);
    assert.ok(!/<text|<tspan|<a[\s>]|<script|<image|<foreignObject|<use|href|style=|\son\w+=|javascript:|url\((?!#ID_)/i.test(s), `${id}: only shapes, gradients and filters of its own`);
    for (const b of brands) assert.ok(!s.toLowerCase().includes(b.toLowerCase()), `${id} names no brand (${b})`);
    assert.ok(s.includes('class="a-sh"'), `${id}: a floor shadow`);
    assert.ok(/class="(ah|ahl|ahd|ahs|sh)"/.test(s), `${id}: the brand hue as an accent`);
    // every reference resolves inside the drawing
    const defined = new Set([...s.matchAll(/id="(ID_\w+)"/g)].map((m) => m[1]));
    for (const m of s.matchAll(/url\(#(ID_\w+)\)/g)) assert.ok(defined.has(m[1]), `${id}: ${m[1]} is defined`);
    assert.equal(defined.size, [...s.matchAll(/id="/g)].length, `${id}: no duplicate ids`);
  }
});

test("artSvg: ids are unique per instance; an unknown id draws a known drawing", () => {
  const a = artSvg("smart-ring", "a:r1:"), b = artSvg("smart-ring", "a:r2:");
  assert.ok(!a.includes("ID_") && a.includes('id="ar1_b"') && b.includes('id="ar2_b"'));
  assert.equal(artSvg("nope", "x"), artSvg("lab-kit", "x"));
  assert.equal(artSvg("__proto__", "x"), artSvg("lab-kit", "x"));
});

test("the cleaner falls back: an unknown or missing art from the server becomes the need's default", () => {
  assert.equal(cleanArt("watch-round"), "watch-round");
  for (const bad of ["", "nope", "constructor", "__proto__", 3, null, undefined, ["cgm-a"]]) assert.equal(cleanArt(bad), null);
  assert.equal(artFor({ art: "smart-ring", category: "wearables" }), "smart-ring");
  assert.equal(artFor({ art: "<svg>", category: "wearables" }), "watch-round");
  assert.equal(artFor({ category: "sleep" }), "sleep-app-a");
  assert.equal(artFor({ category: "unknown" }), "lab-kit");
  const brand = { id: "lumen", name: "Lumen Sleep", monogram: "LS", hue: "indigo", tag: "SLEEP AID", about: "", website: "https://lumen.com/" };
  const p = (over) => ({ id: "m1", brandId: "lumen", name: "Mask", url: "https://lumen.com/m", categories: ["sleep"], ...over });
  const clean = cleanCatalog({ brands: [brand], products: [p({ art: "sleep-app-b" }), p({ id: "m2", art: "evil<script>" }), p({ id: "m3" })] });
  assert.deepEqual(clean.products.map((x) => x.art), ["sleep-app-b", undefined, undefined]);
  assert.deepEqual(liveShop(clean).items.map((x) => x.art), ["sleep-app-b", "sleep-app-a", "sleep-app-a"]);
  // a copy saved on a device before the field existed still cleans to itself (the record check compares the two)
  const old = { at: "2026-11-15T00:00:00.000Z", data: cleanCatalog({ brands: [brand], products: [p({})] }) };
  assert.equal(JSON.stringify(cleanShopCatalog(old)), JSON.stringify(old));
});

test("caption honesty: the tag and the footer sentence", () => {
  assert.equal(SHOP_PAGE_COPY.illustration, "Illustration");
  assert.equal(SHOP_PAGE_COPY.footArt, "Pictures marked Illustration are drawings, not photos of the product.");
});
