import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SHOP_ITEMS, SHOP_IDS, SHOP_CATEGORIES, SHOP_SOURCES, TONE_LABEL, AFFILIATE_LINE, SHOP_COPY, linkFor, relFor, shopCategories, shopItems, itemSources } from "./shop.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const AFF = JSON.parse(fs.readFileSync(path.resolve(here, "../config/affiliates.json"), "utf8"));
const review = fs.readFileSync(path.resolve(here, "../../docs/CLINICIAN-REVIEW.md"), "utf8");

test("catalog: real items, each with a category, a why, an honest evidence label, sources and the brand's own https page", () => {
  assert.ok(SHOP_ITEMS.length >= 20);
  const cats = SHOP_CATEGORIES.map((c) => c.id);
  for (const i of SHOP_ITEMS) {
    assert.ok(cats.includes(i.category), i.id);
    assert.ok(i.brand && i.name && i.why && i.ev, i.id);
    assert.ok(TONE_LABEL[i.tone], `${i.id} tone`);
    assert.ok(i.src.length && itemSources(i).length === i.src.length, `${i.id} sources named`);
    assert.match(i.url, /^https:\/\/[^?#]+$/, `${i.id}: a plain https brand page, no query`);
  }
  for (const c of cats) assert.ok(shopItems(c).length > 0, `${c} has items`);
  assert.equal(new Set(SHOP_IDS).size, SHOP_IDS.length);
  for (const fake of ["Emberline", "Mineral & Co.", "Verdana", "Nightfall", "Restfully"]) assert.ok(!SHOP_ITEMS.some((i) => i.brand === fake), `${fake} is gone`);
});

test("affiliates.json: one empty entry per item plus _readme; no secrets", () => {
  assert.ok(typeof AFF._readme === "string" && /never put a secret/i.test(AFF._readme));
  assert.deepEqual(Object.keys(AFF).filter((k) => k !== "_readme").sort(), [...SHOP_IDS].sort());
  for (const id of SHOP_IDS) assert.equal(AFF[id], "", `${id} is committed empty`);
});

test("links: an https affiliate URL wins and is labelled; otherwise the plain brand page with no label; nothing about her added", () => {
  const item = SHOP_ITEMS.find((i) => i.id === "oura");
  assert.deepEqual(linkFor(item, AFF), { href: "https://ouraring.com/", affiliate: false });
  assert.equal(relFor(linkFor(item, AFF)), "noopener noreferrer");
  const aff = linkFor(item, { oura: "https://example-affiliate.test/oura?tag=solia-20" });
  assert.deepEqual(aff, { href: "https://example-affiliate.test/oura?tag=solia-20", affiliate: true });
  assert.equal(relFor(aff), "noopener noreferrer sponsored");
  assert.equal(linkFor(item, { oura: "http://insecure.test/" }).affiliate, false, "only https");
  assert.equal(linkFor(item, { oura: "javascript:alert(1)" }).affiliate, false);
  assert.equal(AFFILIATE_LINE, "Solia Health may earn a commission if you buy through this link. It never changes what we show you.");
  assert.match(SHOP_COPY.privacy, /a plain brand link doesn't/);
});

test("matching on the device: her stage and modules choose the first categories; every category is listed", () => {
  const first = (o) => shopCategories(o).map((c) => c.id);
  assert.equal(first({ stage: "periods", ttc: true })[0], "fertility");
  assert.equal(first({ stage: "periods", pcos: true })[0], "glucose");
  assert.equal(first({ stage: "preg" })[0], "pregnancy");
  assert.equal(first({ stage: "peri" })[0], "meno");
  for (const o of [{}, { stage: "preg" }, { stage: "peri" }, { ttc: true, pcos: true }]) assert.deepEqual([...first(o)].sort(), SHOP_CATEGORIES.map((c) => c.id).sort());
  assert.ok(first({ stage: "periods" }).indexOf("wearables") < first({ stage: "periods" }).indexOf("meno"), "everyone: wearables and sleep early");
  assert.deepEqual(shopItems("sleep", { allow: ["sleepio"] }).map((i) => i.id), ["sleepio"]);
  assert.ok(shopItems("pregnancy").some((i) => i.id === "prenatal"), "an item can belong to a second category");
});

test("every why line is registered in docs/CLINICIAN-REVIEW.md with its sources", () => {
  for (const i of SHOP_ITEMS) assert.ok(review.includes(i.why), `shop.${i.id} why registered`);
  for (const k of Object.keys(SHOP_SOURCES)) assert.ok(review.includes(`**${k}**`), `source ${k} listed`);
  const all = SHOP_ITEMS.map((i) => `${i.why} ${i.ev}`).join(" ");
  assert.doesNotMatch(all, /cure|treats PCOS|prevent pregnancy|birth control|guarantee/i);
});

/* ---------- the Shop page (2026-11-15, plans-shop-page Task 3 and the owner's design update) ---------- */
import { BRANDS, BRAND_TINTS, AVAIL_LABEL, CATEGORY_ICON, SHOP_PAGE_COPY, monogram, brandTint, brandsOf, groupByBrand, allItems, priceFor, imageFor, isReviewed } from "./shop.js";
const IMAGES = JSON.parse(fs.readFileSync(path.resolve(here, "../config/shop-images.json"), "utf8"));
const REVIEWED = JSON.parse(fs.readFileSync(path.resolve(here, "../config/shop-reviewed.json"), "utf8"));

test("shop page: every brand has a type tag and one line, a two-letter monogram and a UI tint (never a data-viz ramp)", () => {
  for (const b of brandsOf(SHOP_ITEMS)) {
    assert.ok(BRANDS[b] && /^[A-Z -]+$/.test(BRANDS[b].tag) && BRANDS[b].about, b);
    assert.match(monogram(b), /^[A-Z]{2}$/, b);
    assert.ok(BRAND_TINTS.includes(brandTint(b)), b);
    assert.equal(brandTint(b), brandTint(b), "stable");
    assert.ok(review.includes(BRANDS[b].about), `brand line for ${b} registered`);
  }
  assert.deepEqual([...BRAND_TINTS], ["mind", "body", "patterns", "you"]);
  assert.equal(monogram("Quest Diagnostics"), "QD"); assert.equal(monogram("Oura"), "OU"); assert.equal(monogram("US Department of Veterans Affairs"), "VA");
  for (const i of SHOP_ITEMS) {
    assert.ok(AVAIL_LABEL[i.avail], `${i.id} availability`);
    assert.ok(i.covers && review.includes(i.covers), `${i.id} covers registered`);
    assert.ok(CATEGORY_ICON[i.category], `${i.id} placeholder icon`);
  }
});

test("shop page: grouped by brand in order; a brand filter; lab tests early for Trying to conceive, PCOS and perimenopause", () => {
  const g = groupByBrand(shopItems("fertility"));
  assert.equal(g[0].brand, "Easy@Home");
  assert.deepEqual(g[0].items.map((i) => i.id), ["easyhome-lh", "easyhome-bbt"]);
  assert.deepEqual(allItems({ brand: "Everlywell" }).map((i) => i.id), ["everly-fertility", "everly-peri"]);
  const order = (o) => shopCategories(o).map((c) => c.id);
  assert.ok(order({ ttc: true }).indexOf("labs") <= 2);
  assert.ok(order({ pcos: true }).indexOf("labs") <= 2);
  assert.ok(order({ stage: "peri" }).indexOf("labs") <= 2);
  assert.ok(shopItems("labs").length >= 4);
  assert.ok(shopItems("glucose").some((i) => i.id === "labcorp-a1c") && shopItems("meno").some((i) => i.id === "everly-peri"));
  for (const brand of ["Quest Diagnostics", "Labcorp OnDemand", "Everlywell"]) assert.ok(SHOP_ITEMS.some((i) => i.brand === brand), brand);
  assert.ok(!SHOP_ITEMS.some((i) => /hers|hims/i.test(i.brand)), "no service is listed we couldn't check (no contraception services)");
});

test("shop page: a price only when the owner set one, an image only when the owner placed one, no invented badges", () => {
  const item = SHOP_ITEMS.find((i) => i.id === "everly-peri");
  assert.equal(priceFor(item, AFF), null, "committed: no prices");
  assert.equal(priceFor(item, { "everly-peri": { url: "https://aff.test/x", price: "From $99" } }), "From $99");
  assert.equal(linkFor(item, { "everly-peri": { url: "https://aff.test/x", price: "From $99" } }).affiliate, true);
  assert.equal(linkFor(item, { "everly-peri": { url: "", price: "From $99" } }).affiliate, false, "a price alone isn't a link");
  assert.equal(priceFor(item, { "everly-peri": { price: "Best price ever!" } }), null, "only a plain price");
  assert.deepEqual(Object.keys(IMAGES), ["_readme"], "images manifest committed empty");
  assert.equal(imageFor(item, IMAGES), null);
  assert.equal(imageFor(item, { "everly-peri": "everly-peri.webp" }), "shop/everly-peri.webp");
  assert.equal(imageFor(item, { "everly-peri": "https://brand.example/img.jpg" }), null, "never a hotlinked image");
  assert.equal(imageFor(item, { "everly-peri": "../x.webp" }), null);
  assert.deepEqual(REVIEWED.signed, [], "no item is clinician-signed yet, so no badge shows");
  assert.equal(isReviewed(item, REVIEWED.signed), false);
  assert.equal(isReviewed(item, ["everly-peri"]), true);
  for (const id of REVIEWED.signed) assert.match(review, new RegExp(`### shop\\.${id} [^\\n]*\\n(?:- [^\\n]*\\n)*- Status: Signed`), `${id} signed in CLINICIAN-REVIEW`);
  const all = JSON.stringify(SHOP_PAGE_COPY) + JSON.stringify(BRANDS);
  assert.doesNotMatch(all, /physician pick|best seller|top rated|#1|guarantee/i);
});
