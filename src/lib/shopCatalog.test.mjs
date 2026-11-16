/* The live Shop catalog's cleaner and fallback (docs/plans/partner-portal.md Task 3). */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { cleanCatalog, cleanShopCatalog, catalogDue, bundledShop, liveShop, shopFor, itemsIn, itemsOf, httpsUrl, text, CATALOG_MAX_AGE_MS, MAX_PRODUCTS } from "./shopCatalog.js";
import { SHOP_ITEMS, shopItems, allItems } from "./shop.js";
import { TRY_KINDS } from "./trying.js";

const seed = JSON.parse(fs.readFileSync(new URL("../../backend/config/shop-seed.json", import.meta.url), "utf8"));
const brand = { id: "lumen", name: "Lumen Sleep", monogram: "LS", hue: "indigo", tag: "sleep aid", about: "Sleep masks.", website: "https://lumen.com/", imageId: null };
const product = { id: "lumen-mask", brandId: "lumen", name: "Lumen sleep mask", covers: "Blocks light", description: "Soft and light.", availability: "online", price: "From $29", url: "https://lumen.com/mask", affiliateUrl: "", imageId: "a".repeat(24), categories: ["sleep"], stages: ["peri"], modules: [], kind: "aid", why: "A dark room helps many people sleep.", evidence: { tone: "comfort", label: "Comfort, not a treatment" }, sources: ["No trial evidence"], clinicianStatus: "signed" };
const cat = (over = {}) => ({ version: 1, updatedAt: "2026-11-15T10:00:00.000Z", brands: [brand], products: [product], ...over });

test("cleanCatalog keeps a good catalog as is (the server's seed round-trips)", () => {
  const c = cleanCatalog({ version: 1, ...seed });
  assert.equal(c.products.length, SHOP_ITEMS.length);
  assert.deepEqual(c.products.find((p) => p.id === "easyhome-lh").evidence, { tone: "mixed", label: "Mixed evidence on pregnancy rates" });
  const one = cleanCatalog(cat());
  assert.equal(one.products[0].name, "Lumen sleep mask"); assert.equal(one.brands[0].tag, "SLEEP AID");
});

test("cleanCatalog: https-only URLs, capped text, known ids only; a bad product is dropped, not the catalog", () => {
  const bad = [
    { ...product, id: "a1", url: "http://lumen.com/" }, { ...product, id: "a2", url: "javascript:alert(1)" }, { ...product, id: "a3", url: "https://user:pw@lumen.com/" },
    { ...product, id: "a4", name: "x".repeat(91) }, { ...product, id: "a5", categories: ["casino"] }, { ...product, id: "a6", brandId: "nope" },
    { ...product, id: "A7 <script>" }, null, "text", { ...product, id: "lumen-mask" },
  ];
  const c = cleanCatalog(cat({ products: [product, ...bad] }));
  assert.deepEqual(c.products.map((p) => p.id), ["lumen-mask"], "the duplicate id is dropped too");
  const p = cleanCatalog(cat({ products: [{ ...product, affiliateUrl: "http://aff.example.com/x", price: "Cheapest ever!!", imageId: "../../etc", stages: ["peri", "x"], modules: ["pcos", "zzz"], kind: "potion", evidence: { tone: "miracle", label: "Cures all" }, clinicianStatus: "yes", why: "‮evil\u0007 why", sources: ["ok", 5, ""] }] })).products[0];
  assert.equal(p.affiliateUrl, ""); assert.equal(p.price, ""); assert.equal(p.imageId, null);
  assert.deepEqual(p.stages, ["peri"]); assert.deepEqual(p.modules, ["pcos"]); assert.equal(p.kind, null);
  assert.equal(p.evidence, null); assert.equal(p.clinicianStatus, "awaiting", "only exactly \"signed\" counts");
  assert.equal(p.why, "evil why"); assert.deepEqual(p.sources, ["ok"]);
  const b = cleanCatalog(cat({ brands: [{ ...brand, hue: "neon", monogram: "<b>" }] })).brands[0];
  assert.equal(b.hue, null); assert.equal(b.monogram, "LS");
});

test("cleanCatalog: unusable answers are null (fallback)", () => {
  for (const raw of [null, "", "<html>", [], {}, { products: "x", brands: [] }, cat({ products: [] }), cat({ products: [{ ...product, url: "http://x.com/" }] }), cat({ brands: [] })]) assert.equal(cleanCatalog(raw), null, JSON.stringify(raw)?.slice(0, 40));
  const many = cleanCatalog(cat({ products: Array.from({ length: MAX_PRODUCTS + 50 }, (_, i) => ({ ...product, id: `p-${i}` })) }));
  assert.equal(many.products.length, MAX_PRODUCTS, "capped");
});

test("helpers: httpsUrl and text", () => {
  assert.equal(httpsUrl("https://a.com/x"), "https://a.com/x");
  for (const v of ["http://a.com", "https://localhost", "https://1.2.3.4/", 7, "data:x"]) assert.equal(httpsUrl(v), "", String(v));
  assert.equal(text("  a \n b ", 10), "a b"); assert.equal(text("x".repeat(11), 10), ""); assert.equal(text(5, 10), "");
});

test("the record value: cleaned again on load; refresh at most once a day", () => {
  const now = Date.parse("2026-11-15T12:00:00Z");
  const rec = cleanShopCatalog({ at: new Date(now - 1000).toISOString(), data: cat() });
  assert.equal(rec.data.products.length, 1);
  assert.equal(cleanShopCatalog({ at: "yesterday-ish", data: cat() }), null);
  assert.equal(cleanShopCatalog({ at: new Date(now).toISOString(), data: { products: [] } }), null);
  assert.equal(cleanShopCatalog("x"), null);
  assert.equal(catalogDue(null, now), true);
  assert.equal(catalogDue(rec, now), false);
  assert.equal(catalogDue({ at: new Date(now - CATALOG_MAX_AGE_MS - 1).toISOString() }, now), true);
});

test("the bundled shape matches lib/shop.js item for item (the fallback shows what the app showed before)", () => {
  const s = bundledShop({ affiliates: { oura: { url: "https://aff.example.com/oura", price: "From $299" } }, images: { mira: "mira.webp" }, signed: ["sleepio"] });
  assert.equal(s.source, "bundled");
  for (const c of ["fertility", "labs", "sleep", "glucose"]) assert.deepEqual(itemsIn(s, c).map((i) => i.id), shopItems(c).map((i) => i.id), c);
  assert.deepEqual(itemsOf(s, { brand: "Everlywell" }).map((i) => i.id), allItems({ brand: "Everlywell" }).map((i) => i.id));
  const oura = s.items.find((i) => i.id === "oura");
  assert.deepEqual([oura.href, oura.affiliate, oura.price], ["https://aff.example.com/oura", true, "From $299"]);
  assert.equal(s.items.find((i) => i.id === "whoop").affiliate, false);
  assert.deepEqual(s.items.find((i) => i.id === "mira").image, { bundled: "shop/mira.webp" });
  assert.equal(s.items.find((i) => i.id === "sleepio").reviewed, true);
  assert.equal(s.items.filter((i) => i.reviewed).length, 1);
  assert.equal(s.brands["Easy@Home"].tag, "AT-HOME TESTS");
});

test("the live shape: server images, affiliate label only with an affiliate URL, reviewed only when signed", () => {
  const s = liveShop(cleanCatalog(cat({ products: [product, { ...product, id: "lumen-2", affiliateUrl: "https://aff.lumen.com/2", imageId: null, clinicianStatus: "awaiting", evidence: null }] })), { apiBase: "https://api.solia.test", images: { "lumen-2": "lumen-2.jpg" } });
  const [a, b] = s.items;
  assert.deepEqual(a.image, { url: `https://api.solia.test/api/shop/images/${"a".repeat(24)}` });
  assert.deepEqual([a.href, a.affiliate, a.reviewed, a.tone, a.ev], ["https://lumen.com/mask", false, true, "comfort", "Comfort, not a treatment"]);
  assert.deepEqual([b.href, b.affiliate, b.reviewed, b.tone], ["https://aff.lumen.com/2", true, false, null]);
  assert.deepEqual(b.image, { bundled: "shop/lumen-2.jpg" });
  assert.deepEqual(s.brands["Lumen Sleep"], { tag: "SLEEP AID", about: "Sleep masks.", mono: "LS", hue: "indigo" });
  assert.deepEqual(itemsIn(s, "sleep").map((i) => i.id), ["lumen-mask", "lumen-2"]);
  assert.deepEqual(itemsIn(s, "sleep", { allow: ["lumen-2"] }).map((i) => i.id), ["lumen-2"]);
});

test("shopFor: the live copy when there is one, else the bundled catalog", () => {
  assert.equal(shopFor(null).source, "bundled");
  assert.equal(shopFor({ at: "2026-11-15T00:00:00Z", data: cleanCatalog(cat()) }, { apiBase: "https://x.test" }).source, "live");
});

test("the cleaner's kinds match lib/trying.js", () => {
  const src = fs.readFileSync(new URL("./shopCatalog.js", import.meta.url), "utf8");
  const kinds = JSON.parse(src.match(/const KINDS = (\[.*?\]);/)[1]);
  assert.deepEqual(kinds.sort(), Object.keys(TRY_KINDS).sort());
});
