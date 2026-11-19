/* Promotions in the app (docs/plans/portal-subscriptions.md Task 3).
   - API build (the web, mocked server): the live list is downloaded with a plain GET (no query, no token, no cookie), at
     most once a day; the one promotion for her stage is chosen on the device and shown on You → Plan and the Pro sheet,
     with the web's "in the iPhone and Android apps" line and no price; "Not now" hides it on this device; the web
     explains that codes are redeemed in the app.
   - The dev gallery's pretend store (a phone's Pro sheet): the banner lists ONLY the store's prices for the promotion's
     offering, the tiles and the purchase use that offering, "Have a code?" and what RevenueCat is told are there. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoGallery, gotoYou } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

const promo = (id, who, stages, title) => ({ id, offeringId: "spring_clinic", platforms: ["ios", "android", "web"], audience: { who, stages }, startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2099-01-01T00:00:00.000Z", banner: { title, body: "A longer free trial on the yearly plan." } });

test("the web: the promotion for her stage, chosen on the device, without a price; hidden with Not now; downloaded once a day", async ({ page }) => {
  const state = newApiState({ promotions: [promo("promo_meno01", "stages", ["meno"], "For menopause"), promo("promo_peri01", "stages", ["peri"], "For perimenopause"), promo("promo_every1", "everyone", [], "For everyone")] });
  await mockApi(page, state);
  await register(page, { url: process.env.E2E_API_URL, stage: "Perimenopause", signin: "email" });
  await gotoYou(page, "Plan & account");
  const card = page.locator("#you-plan");
  const banner = card.locator(".promobanner");
  await expect(banner).toHaveCount(1);
  await expect(banner).toContainText("For perimenopause");
  await expect(banner).toContainText("A longer free trial on the yearly plan.");
  await expect(banner).toContainText("This offer is in the iPhone and Android apps. There's nothing to buy on the web.");
  expect(await banner.textContent()).not.toMatch(/[$€£]\s?\d/);
  // the request carried nothing about her
  const reqs = state.sent.filter((r) => r.path === "/api/promotions/active");
  expect(reqs.length).toBe(1);
  expect(reqs[0]).toMatchObject({ method: "GET", search: "", auth: null, cookie: null });
  // the Pro sheet shows the same one, and how codes work on the web
  await card.getByRole("button", { name: /See what Pro adds|See Pro plans/ }).click();
  const sheet = page.locator("#pro-sheet");
  await expect(sheet.locator(".promobanner")).toContainText("For perimenopause");
  await expect(sheet.getByRole("group", { name: "Have a code?" })).toContainText("Codes are redeemed in the Solia Health app on iPhone or Android");
  await sheet.getByRole("button", { name: 'Not now: hide the offer "For perimenopause"' }).click();
  await expect(sheet.locator(".promobanner")).toContainText("For everyone"); // the next one for her, still one at a time
  await expect(sheet.locator(".promobanner")).toHaveCount(1);
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(banner).toContainText("For everyone");
  await page.waitForTimeout(1500); // saved on this device
  await page.reload();
  await gotoYou(page, "Plan & account");
  await expect(page.locator("#you-plan .promobanner")).toContainText("For everyone");
  await expect(page.locator("#you-plan")).not.toContainText("For perimenopause");
  expect(state.sent.filter((r) => r.path === "/api/promotions/active").length, "not downloaded again the same day").toBe(1);
});

test("the web: no promotion for her stage shows nothing; a broken answer shows nothing", async ({ page }) => {
  const state = newApiState({ promotions: [promo("promo_meno01", "stages", ["meno"], "For menopause"), { id: "<x>", banner: "nope" }] });
  await mockApi(page, state);
  await register(page, { url: process.env.E2E_API_URL, stage: "My Cycle", signin: "email" });
  await gotoYou(page, "Plan & account");
  await expect(page.locator("#you-plan .plantile").first()).toBeVisible();
  await expect(page.locator(".promobanner")).toHaveCount(0);
});

test("a phone (pretend store): the banner lists only the store's prices for the promotion's offering; tiles and purchase use it", async ({ page }) => {
  await gotoGallery(page, { stage: "peri", scheme: "light", style: "soft" });
  await page.getByRole("button", { name: "Open the Pro sheet (pretend store)" }).click();
  let sheet = page.locator("#pro-sheet");
  await expect(sheet.locator(".plantile").first()).toContainText("$100.00 a year");
  await expect(sheet.locator(".promobanner")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Open the Pro sheet with a promotion (pretend store)" }).click();
  sheet = page.locator("#pro-sheet");
  const banner = sheet.locator(".promobanner");
  await expect(banner).toContainText("A calmer start to spring");
  await expect(banner.locator("li")).toHaveText(["Yearly: $89.99 a year · 30-day free trial"]);
  await expect(banner).toContainText("Price from the App Store or Google Play.");
  await expect(sheet.locator(".plantile")).toHaveCount(1);
  await expect(sheet.locator(".plantile").first()).toContainText("$89.99 a year");
  await expect(sheet.getByRole("button", { name: "Start 30-day free trial" })).toBeVisible(); // the trial the store's product carries
  await expect(sheet.locator("#pro-terms")).toContainText("Free for 30 days, then $89.99 a year.");
  await expect(sheet).toContainText("RevenueCat, which handles Pro for the stores, gets an anonymous id, or your account number if you're signed in; never your email or anything you log.");
  await expect(sheet.getByRole("group", { name: "Have a code?" }).getByRole("button", { name: "Have a code?" })).toBeVisible();
});
