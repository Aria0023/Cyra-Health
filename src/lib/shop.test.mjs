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
