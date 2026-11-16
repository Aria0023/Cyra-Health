/* The backend's seed file and vocabulary stay in step with the bundled catalog (docs/plans/partner-portal.md Task 1). */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ART_IDS } from "./shopArt.js";
import { buildSeed } from "./shopSeed.js";
import { SHOP_ITEMS, SHOP_CATEGORIES, AVAIL_LABEL, TONE_LABEL, SHOP_HUE_IDS } from "./shop.js";
import { TRY_KINDS } from "./trying.js";
import { MODULE_IDS } from "./modules.js";
import * as V from "../../backend/src/modules/shop/vocab.js";

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), "utf8"));

test("backend/config/shop-seed.json is up to date (run `npm run shop:seed` after editing lib/shop.js or src/config)", () => {
  const want = buildSeed({ affiliates: read("../config/affiliates.json"), signed: read("../config/shop-reviewed.json").signed });
  assert.deepEqual(read("../../backend/config/shop-seed.json"), want);
  assert.equal(want.products.length, SHOP_ITEMS.length);
});

test("the backend's vocabulary matches the app's", () => {
  assert.deepEqual([...V.CATEGORIES], SHOP_CATEGORIES.map((c) => c.id));
  assert.deepEqual([...V.AVAILABILITY].sort(), Object.keys(AVAIL_LABEL).sort());
  assert.deepEqual([...V.TONES].sort(), Object.keys(TONE_LABEL).sort());
  assert.deepEqual([...V.HUES], [...SHOP_HUE_IDS]);
  assert.deepEqual([...V.KINDS].sort(), Object.keys(TRY_KINDS).sort());
  assert.deepEqual([...V.ARTS], [...ART_IDS]); // 2026-11-16: the product illustrations
  assert.deepEqual([...V.MODULES].sort(), [...MODULE_IDS].sort());
  for (const i of SHOP_ITEMS) for (const s of i.stages) assert.ok(V.STAGES.includes(s), s);
});

test("every seeded product passes the backend's own cleaners", () => {
  const seed = read("../../backend/config/shop-seed.json");
  for (const p of seed.products) {
    assert.equal(V.cleanUrl(p.url, { required: true }).value, p.url, p.id);
    assert.ok(!V.cleanText(p.name, V.CAPS.productName, { required: true }).error, p.id);
    assert.ok(!V.cleanText(p.why, V.CAPS.why).error, `${p.id} why`);
    assert.ok(!V.cleanText(p.covers, V.CAPS.covers).error, `${p.id} covers`);
    assert.ok(!V.cleanSources(p.sources).error, `${p.id} sources`);
  }
  for (const b of seed.brands) assert.ok(!V.cleanText(b.about, V.CAPS.about).error && V.ID_RE.test(b.id), b.id);
});

test("the partner portal's labels and preview copy match the app's (backend/public/portal/portal.js)", async () => {
  const src = fs.readFileSync(new URL("../../backend/public/portal/portal.js", import.meta.url), "utf8");
  const { AFFILIATE_LINE } = await import("./shop.js");
  // const NAME = { key: "label", … }; → a plain object (keys quoted, then JSON)
  const obj = (name) => JSON.parse(`{${src.match(new RegExp(`const ${name} = \\{(.*?)\\};`))[1].replace(/(\w+):/g, '"$1":')}}`);
  assert.deepEqual(obj("CATEGORY_LABEL"), Object.fromEntries(SHOP_CATEGORIES.map((c) => [c.id, c.label])));
  assert.deepEqual(obj("AVAIL_LABEL"), { ...AVAIL_LABEL });
  assert.deepEqual(obj("TONE_LABEL"), { ...TONE_LABEL });
  assert.deepEqual(Object.keys(obj("KIND_LABEL")).sort(), Object.keys(TRY_KINDS).sort());
  assert.ok(src.includes(JSON.stringify(AFFILIATE_LINE)), "the commission line");
  assert.ok(!/\.innerHTML\s*=|insertAdjacentHTML|document\.write/.test(src), "the portal never builds markup from text");
});

test("the portal's copy of the product illustrations is up to date (run `npm run shop:seed` after editing lib/shopArt.js)", async () => {
  const { buildPortalArt } = await import("./shopSeed.js");
  assert.equal(fs.readFileSync(new URL("../../backend/public/portal/shop-art.js", import.meta.url), "utf8"), buildPortalArt());
  const seed = read("../../backend/config/shop-seed.json");
  for (const p of seed.products) assert.ok(ART_IDS.includes(p.art), `${p.id}: a seeded product names a known illustration`);
});
