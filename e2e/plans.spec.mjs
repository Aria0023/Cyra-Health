/* Task 2 (docs/plans/plans-shop-page.md, 2026-11-15): the two Pro plans and the 7-day free trial, clearly visible.
   - the web (no-server build): You → Plan shows Yearly (best value, 7-day free trial) and Monthly with the US reference
     prices, "Get Solia Health Pro in the app" and, with no store URL set, "Coming soon …" as plain text (no dead button);
     the Pro sheet opens with the same tiles and the trial line, and sells nothing;
   - Home's "Pro · 7-day free trial" note (API build, no free-week gate): opens the Pro sheet, hides with ×, shows on at most
     one day's first Home visit; never beside the free-week bar (the no-server build has the gate on). */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoTab, gotoYou } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

test("the web: You → Plan shows Yearly with the 7-day free trial and Monthly; the Pro sheet opens with them", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "no" });
  await expect(page.locator(".prochip")).toHaveCount(0); // the free-week bar is on in this build: one note at a time
  await gotoYou(page, "Plan & account");
  const card = page.locator("#you-plan");
  const tiles = card.locator(".plantile");
  await expect(tiles).toHaveCount(2);
  await expect(tiles.nth(0)).toContainText("Yearly");
  await expect(tiles.nth(0)).toContainText("Best value");
  await expect(tiles.nth(0)).toContainText("$100 a year");
  await expect(tiles.nth(0)).toContainText("About $8.33 a month");
  await expect(tiles.nth(0)).toContainText("7-day free trial");
  await expect(tiles.nth(1)).toContainText("Monthly");
  await expect(tiles.nth(1)).toContainText("$9.95 a month");
  await expect(tiles.nth(1)).not.toContainText("free trial");
  // side by side at phone width (390px), stacked under 360px
  const [a, b] = [await tiles.nth(0).boundingBox(), await tiles.nth(1).boundingBox()];
  expect(Math.abs(a.y - b.y)).toBeLessThan(2);
  await expect(card.getByText("Get Solia Health Pro in the app")).toBeVisible();
  await expect(card.getByText("Coming soon to the App Store and Google Play")).toBeVisible();
  await expect(card.getByRole("button", { name: /App Store|Google Play/ })).toHaveCount(0);
  await card.getByRole("button", { name: /See what Pro adds|See Pro plans/ }).click();
  const sheet = page.locator("#pro-sheet");
  await expect(sheet.locator(".plantile")).toHaveCount(2);
  await expect(sheet.locator(".protrialline")).toHaveText("Try Pro free for 7 days on the yearly plan, then $100 a year in the iPhone and Android apps. Cancel any time.");
  // the tiles come before what Pro adds
  const top = await sheet.locator(".plantiles").boundingBox(), list = await sheet.locator(".prolist").boundingBox();
  expect(top.y).toBeLessThan(list.y);
  await sheet.getByRole("button", { name: "Done" }).click();
  await page.setViewportSize({ width: 340, height: 800 });
  const [c, d] = [await tiles.nth(0).boundingBox(), await tiles.nth(1).boundingBox()];
  expect(d.y).toBeGreaterThan(c.y + c.height - 1);
});

test("Home's Pro note: opens the plans and shows on at most one day's first visit", async ({ page }) => {
  const state = newApiState();
  await mockApi(page, state);
  await register(page, { url: process.env.E2E_API_URL, stage: "Perimenopause", signin: "email" });
  const chip = page.locator(".prochip");
  await expect(chip.getByRole("button", { name: "Pro · 7-day free trial" })).toBeVisible();
  await chip.getByRole("button", { name: "Pro · 7-day free trial" }).click();
  const sheet = page.locator("#pro-sheet");
  await expect(sheet.locator(".plantile")).toHaveCount(2);
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(chip).toHaveCount(0); // opened once: gone for this visit
  await page.waitForTimeout(1500); // the day it showed is saved on this device
  await page.reload();
  await expect(page.locator(".navpill")).toBeVisible();
  await expect(chip).toHaveCount(0); // the same day: not again
  await gotoTab(page, "You");
  await gotoTab(page, "Home");
  await expect(chip).toHaveCount(0);
});

test("Home's Pro note hides with × and focus moves on", async ({ page }) => {
  const state = newApiState();
  await mockApi(page, state);
  await register(page, { url: process.env.E2E_API_URL, stage: "My Cycle", pcos: "no", signin: "email" });
  const chip = page.locator(".prochip");
  await chip.getByRole("button", { name: "Hide the Pro trial note for today" }).click();
  await expect(chip).toHaveCount(0);
  await expect(page.locator("#quicklog-t")).toBeFocused();
  // never on another screen
  for (const tab of ["Body", "You"]) { await gotoTab(page, tab); await expect(page.locator(".prochip")).toHaveCount(0); }
});
