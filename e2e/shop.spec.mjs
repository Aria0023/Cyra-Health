/* Task C (docs/plans/partner-learn-glucose-shop.md): Shop by need, matched on the device. With src/config/affiliates.json
   committed empty, every link is the brand's own page with no affiliate label (the label shows only where the owner
   pasted an affiliate URL; lib/shop.test.mjs covers that). Links are checked, never followed: the app sends nothing. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoTab } from "./lib/nav.mjs";

test("You → Shop by need: Trying to conceive sees ovulation & fertility first; plain brand links open a new tab with no data", async ({ page }) => {
  const outside = [];
  page.on("request", (r) => { if (!r.url().startsWith(process.env.E2E_URL)) outside.push(r.url()); });
  await register(page, { stage: "Trying to conceive", pcos: "no" });
  await gotoTab(page, "You");
  const card = page.locator("#care");
  await expect(card.getByRole("heading", { name: "Products and services, by need" })).toBeVisible();
  await card.getByRole("button", { name: "See products by need" }).click();
  await expect(card.locator(".shopcats .mc").first()).toHaveText("Ovulation & fertility");
  await expect(card.locator(".shopcats .mc").first()).toHaveAttribute("aria-pressed", "true");
  const lh = card.locator('.shopitem[data-item="easyhome-lh"]');
  await expect(lh).toContainText("Ovulation (LH) test strips");
  await expect(lh).toContainText("Mixed evidence on pregnancy rates");
  const a = lh.getByRole("link", { name: /Visit Easy@Home/ });
  await expect(a).toHaveAttribute("href", "https://www.easyhomefertility.com/");
  await expect(a).toHaveAttribute("target", "_blank");
  await expect(a).toHaveAttribute("rel", "noopener noreferrer");
  await expect(card.getByText("Affiliate link", { exact: true })).toHaveCount(0);
  await expect(card).not.toContainText("may earn a commission");
  await expect(card).toContainText("Neither carries anything about you");
  await card.getByRole("button", { name: "Blood sugar" }).click();
  await expect(card.locator('.shopitem[data-item="stelo"]')).toContainText("Stelo over-the-counter CGM");
  for (const link of await card.locator(".shopgo").all()) expect(await link.getAttribute("href")).not.toMatch(/[?&](utm_|stage|ttc|pcos|id=)/i);
  expect(outside).toEqual([]);
});

test("PCOS on: blood sugar first; the device sheet's quiet link opens wearables; the glucose card links to blood sugar", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "yes" });
  await gotoTab(page, "You");
  await page.locator("#care").getByRole("button", { name: "See products by need" }).click();
  await expect(page.locator("#care .shopcats .mc").first()).toHaveText("Blood sugar");
  await gotoTab(page, "Body");
  await page.locator(".bodydevbtn").click();
  await page.locator("#devices-sheet").getByRole("button", { name: "Don't have a device? See options" }).click();
  const sheet = page.getByRole("dialog", { name: "Shop by need" });
  await expect(sheet.getByRole("button", { name: "Wearables" })).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.locator('.shopitem[data-item="oura"]')).toBeVisible();
  await sheet.getByRole("button", { name: "Close Shop by need" }).click();
  await page.locator(".bodydevbtn").click();
  await page.locator('#devices-sheet .devrow[data-device="dexcom"]').getByRole("button", { name: "Connect" }).click();
  await page.locator("#devices-sheet .v2sheet-close").click();
  await page.locator("#body-glucose").getByRole("button", { name: "Blood sugar options" }).click();
  await expect(page.getByRole("dialog", { name: "Shop by need" }).getByRole("button", { name: "Blood sugar" })).toHaveAttribute("aria-pressed", "true");
});

test("the shop never shows in insights, Patterns or Home", async ({ page }) => {
  await register(page, { stage: "Perimenopause", pcos: "no" });
  await expect(page.locator(".shoplink, .shopitem")).toHaveCount(0);
  await gotoTab(page, "Patterns");
  await expect(page.locator(".shoplink, .shopitem")).toHaveCount(0);
  await gotoTab(page, "You");
  await page.locator("#care").getByRole("button", { name: "See products by need" }).click();
  await expect(page.locator("#care .shopcats .mc").first()).toHaveText("Perimenopause & menopause");
});
