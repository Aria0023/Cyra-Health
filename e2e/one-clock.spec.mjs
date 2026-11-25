/* One free clock (2026-11-25, docs/plans/critique-fixes.md Task 5): she sees "7 days free" (the free week) and no second
   count. The store's 7-day trial on yearly is said on the yearly tile only, as starting when she subscribes; never on
   Home or the badge, and the Pro sheet has no separate trial line. (The guest side is in guest.spec.mjs.) */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoYou } from "./lib/nav.mjs";

test("the free week is the one clock; the store's trial is on the yearly tile only", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "no" });
  await expect(page.locator("header.mast .planbadge")).toHaveText("Free week · 7 days left");
  const home = page.locator("main.homev2");
  await expect(home).not.toContainText(/free trial|\bhours?\b as a guest|starts when you subscribe/i);
  await gotoYou(page, "Plan & account");
  const tiles = page.locator("#you-plan .plantile");
  await expect(tiles.nth(0)).toContainText("7-day free trial on yearly, starts when you subscribe");
  await expect(tiles.nth(1)).not.toContainText("free trial");
  await expect(page.locator("#you-plan")).toContainText("Free week: 7 days left.");
  await page.locator("header.mast .planbadge").click();
  const sheet = page.locator("#pro-sheet");
  await expect(sheet.locator(".plantile").first()).toContainText("starts when you subscribe");
  await expect(sheet.locator(".protrialline")).toHaveCount(0);
  await expect(sheet).not.toContainText("Try Pro free for 7 days");
});
