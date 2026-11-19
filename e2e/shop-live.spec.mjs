/* The Shop page reads the published catalog from the server (docs/plans/partner-portal.md Task 3): the API build
   (e2e/lib/serve.mjs) against the mock backend (e2e/lib/api.mjs), which serves the bundled catalog (the server's seed)
   plus a brand added in the partner portal. The new brand appears with its server image, "Clinician reviewed" (signed on
   the server) and the affiliate label (an affiliate URL); the request carries nothing about her; the device's copy stays
   when the server is unreachable; an invalid catalog falls back to the bundled one. */
import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";
import { API_BASE } from "./lib/serve.mjs";

const API_URL = () => process.env.E2E_API_URL;
const seed = JSON.parse(fs.readFileSync(new URL("../backend/config/shop-seed.json", import.meta.url), "utf8"));
const IMG = "ab".repeat(12);
const lumen = { id: "lumen-sleep", name: "Lumen Sleep", monogram: "LS", hue: "indigo", tag: "SLEEP AID", about: "Sleep masks made for warm nights.", website: "https://lumen.com/", imageId: null };
const mask = {
  id: "lumen-mask-a1b2c3", brandId: "lumen-sleep", name: "Lumen sleep mask", covers: "Blocks light while you sleep", description: "Light, washable silk.", availability: "online", price: "From $29",
  url: "https://lumen.com/mask", affiliateUrl: "https://lumen.com/mask?aff=solia", imageId: IMG, categories: ["sleep"], stages: ["peri"], modules: [], kind: "aid",
  why: "A dark room helps many people fall asleep.", evidence: { tone: "comfort", label: "Comfort, not a treatment" }, sources: ["No trial evidence; listed as a comfort item"], clinicianStatus: "signed",
};
const catalog = { version: 1, updatedAt: "2026-11-15T12:00:00.000Z", brands: [...seed.brands, lumen], products: [...seed.products, mask] };
const shop$ = (page) => page.locator("main.shoppage");
const openShop = (page) => page.locator("header.mast").getByRole("button", { name: "Shop", exact: true }).click();

test("a brand published in the portal appears on the Shop page; the request carries nothing about her", async ({ page }) => {
  const state = newApiState({ catalog });
  await mockApi(page, state);
  await register(page, { url: API_URL(), stage: "Perimenopause", pcos: "no", signin: "email" });
  await expect.poll(() => state.sent.filter((r) => r.path === "/api/shop/catalog").length, { message: "the daily refresh once she is in the app" }).toBe(1);
  await openShop(page);
  const shop = shop$(page);
  await shop.getByRole("button", { name: "Sleep", exact: true }).click();
  const band = shop.locator(".shopbrand", { has: page.getByRole("heading", { level: 2, name: "Lumen Sleep" }) });
  await expect(band.locator(".shopband-tag")).toHaveText("SLEEP AID");
  await expect(band.locator(".shopband-about")).toHaveText("Sleep masks made for warm nights.");
  const card = shop.locator(`.shopcard[data-item="${mask.id}"]`);
  await expect(card.getByRole("heading", { level: 3 })).toHaveText("Lumen sleep mask");
  await expect(card.locator(".shopimg img")).toHaveAttribute("src", `${API_BASE}/api/shop/images/${IMG}`);
  await expect(card.locator(".shopprice")).toHaveText("From $29");
  await expect(card).toContainText("Clinician reviewed");
  await expect(card).toContainText("Affiliate link");
  await expect(card).toContainText("may earn a commission");
  const go = card.getByRole("link", { name: /Visit Lumen Sleep/ });
  await expect(go).toHaveAttribute("href", "https://lumen.com/mask?aff=solia");
  await expect(go).toHaveAttribute("rel", "noopener noreferrer sponsored");
  await card.getByRole("button", { name: "Learn more" }).click();
  await expect(card).toContainText("From Lumen Sleep: Light, washable silk.");
  await expect(card).toContainText("No trial evidence; listed as a comfort item");
  // the bundled items are still there, with no affiliate label and no badge (none set on the server)
  const sleepio = shop.locator('.shopcard[data-item="sleepio"]');
  await expect(sleepio).toBeVisible();
  await expect(sleepio).not.toContainText("Affiliate link");
  await expect(sleepio).not.toContainText("Clinician reviewed");
  await expect(shop.locator(".shopfoot")).toContainText("The product list comes from Solia Health's server, like loading a web page: the request carries nothing about you.");
  // every catalog request: a plain GET with no query, no token and no cookie
  const reqs = state.sent.filter((r) => r.path.startsWith("/api/shop/catalog"));
  expect(reqs.length).toBeGreaterThanOrEqual(2); // the daily refresh and opening the page
  for (const r of reqs) expect(r).toMatchObject({ method: "GET", search: "", body: null, auth: null, cookie: null });
  // the server is unreachable: the device's copy stays
  await shop.getByRole("button", { name: "Back" }).click();
  state.catalog = null;
  await openShop(page);
  await shop.getByRole("button", { name: "Sleep", exact: true }).click();
  await expect(shop.locator(`.shopcard[data-item="${mask.id}"]`)).toBeVisible();
});

test("an invalid catalog falls back to the bundled one", async ({ page }) => {
  const state = newApiState({ catalog: { version: 1, brands: [lumen], products: [{ ...mask, url: "http://lumen.com/mask" }, { ...mask, id: "x2", categories: ["casino"] }] } });
  await mockApi(page, state);
  await register(page, { url: API_URL(), stage: "Trying to conceive", pcos: "no", signin: "email" });
  await expect.poll(() => state.sent.filter((r) => r.path === "/api/shop/catalog").length).toBe(1);
  await openShop(page);
  const shop = shop$(page);
  await expect(shop.locator(".shopbrand h2").first()).toHaveText("Easy@Home");
  await expect(shop.locator('.shopcard[data-item="easyhome-lh"] .shopgo')).toHaveAttribute("href", "https://www.easyhomefertility.com/");
  await shop.getByRole("button", { name: "Sleep", exact: true }).click();
  await expect(shop.getByText("Lumen Sleep")).toHaveCount(0);
  await expect(shop.locator(".shopfoot")).not.toContainText("comes from Solia Health's server");
  // 2026-11-19: this build has a server, so a tap can be counted (lib/shopTaps.js) and the footer no longer says "nothing about you is sent"
  await expect(shop.locator(".shopfoot")).toContainText("Matched on this device: your stage and what you log are never sent.");
  await expect(shop.locator(".shopfoot")).toContainText("counts one anonymous tap for that product");
});
