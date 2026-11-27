/* axe-core on the Shop page (2026-11-15), light and dark, in Soft and the other styles: opened from the header, a card's
   "Learn more" open, "By brand", the device list's quiet link, and a wide screen. */
import fs from "node:fs";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register } from "./lib/onboard.mjs";
import { gotoTab, gotoYou } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";
import { settled } from "./lib/settle.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const audit = async (page, name) => {
  await settled(page);
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
};

for (const scheme of ["light", "dark"]) {
  test(`Shop page, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await register(page, { stage: "Trying to conceive", pcos: "no" });
    // 2026-11-19 (entry points): the header's Shop pill with its one-time hint, and the + sheet's row
    await expect(page.locator(".shopcoach")).toBeVisible();
    await audit(page, `Home with the Shop pill and its hint ${scheme}`);
    await page.getByRole("button", { name: "Log something" }).click();
    await expect(page.getByRole("dialog", { name: "Log something" }).getByRole("button", { name: "Shop by need" })).toBeVisible();
    await audit(page, `+ sheet with the Shop row ${scheme}`);
    await page.locator(".v2sheet .v2sheet-close").click();
    await gotoYou(page, "Help & about");
    await page.locator("#you-shop").scrollIntoViewIfNeeded();
    await audit(page, `You → Shop entry ${scheme}`);
    await page.locator("header.mast").getByRole("button", { name: "Shop", exact: true }).click();
    const shop = page.locator("main.shoppage");
    await shop.locator('.shopcard[data-item="easyhome-lh"]').getByRole("button", { name: "Learn more" }).click();
    await audit(page, `Shop page by need ${scheme}`);
    await shop.getByRole("button", { name: "By brand" }).click();
    await audit(page, `Shop page by brand ${scheme}`);
    await shop.getByRole("button", { name: "Back" }).click();
    await gotoTab(page, "Body");
    await page.locator(".bodydevbtn").click();
    await audit(page, `devices sheet with shop link ${scheme}`);
    await page.locator("#devices-sheet").getByRole("button", { name: "Don't have a device? See options" }).click();
    await expect(shop).toBeVisible();
    await audit(page, `Shop page from a quiet link ${scheme}`);
    await page.setViewportSize({ width: 1200, height: 900 });
    await audit(page, `Shop page, wide ${scheme}`);
    await ctx.close();
  });
}

test("Shop page in every style (Mono, Clear, Journal, Aura, Sky, Blush, Mint, Sunset), light and dark", async ({ browser }) => {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await register(page, { stage: "Perimenopause", pcos: "no" });
    for (const style of ["Mono", "Clear", "Journal", "Aura", "Sky", "Blush", "Mint", "Sunset"]) {
      await gotoYou(page, "App settings");
      await page.getByRole("radio", { name: style }).click();
      await expect(page.locator(".cy")).toHaveAttribute("data-style", style.toLowerCase());
      { // the header with the labelled Shop pill and the plan badge, before the shop is open
        const r = await new AxeBuilder({ page }).include("header.mast").withTags(TAGS).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`), `header ${style} ${scheme}`).toEqual([]);
      }
      await page.locator("header.mast").getByRole("button", { name: "Shop", exact: true }).click();
      await expect(page.locator("main.shoppage")).toBeVisible();
      await audit(page, `Shop page ${style} ${scheme}`);
    }
    await ctx.close();
  }
});

/* 2026-11-15 (partner portal Task 3): the Shop page drawn from the server's catalog (the API build and its mock), with a
   portal-added brand, its server image, "Clinician reviewed", the affiliate label and "Learn more" open. */
for (const scheme of ["light", "dark"]) {
  test(`Shop page from the live catalog, ${scheme}`, async ({ browser }) => {
    const seed = JSON.parse(fs.readFileSync(new URL("../backend/config/shop-seed.json", import.meta.url), "utf8"));
    const lumen = { id: "lumen-sleep", name: "Lumen Sleep", monogram: "LS", hue: "indigo", tag: "SLEEP AID", about: "Sleep masks.", website: "https://lumen.com/", imageId: null };
    const mask = { id: "lumen-mask", brandId: "lumen-sleep", name: "Lumen sleep mask", covers: "Blocks light", description: "Light, washable silk.", availability: "online", price: "From $29", url: "https://lumen.com/mask", affiliateUrl: "https://lumen.com/mask?aff=solia", imageId: "ab".repeat(12), categories: ["sleep"], stages: [], modules: [], kind: null, why: "A dark room helps many people fall asleep.", evidence: { tone: "comfort", label: "Comfort, not a treatment" }, sources: ["No trial evidence"], clinicianStatus: "signed" };
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await mockApi(page, newApiState({ catalog: { version: 1, brands: [...seed.brands, lumen], products: [...seed.products, mask] } }));
    await register(page, { url: process.env.E2E_API_URL, stage: "Perimenopause", pcos: "no", signin: "email" });
    await page.locator("header.mast").getByRole("button", { name: "Shop", exact: true }).click();
    const shop = page.locator("main.shoppage");
    await shop.getByRole("button", { name: "Sleep", exact: true }).click();
    const card = shop.locator('.shopcard[data-item="lumen-mask"]');
    await expect(card.locator("img")).toBeVisible();
    await card.getByRole("button", { name: "Learn more" }).click();
    await audit(page, `Shop page, live catalog ${scheme}`);
    await ctx.close();
  });
}
