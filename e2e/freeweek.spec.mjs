/* "Subscribe any time during the free week" (docs/plans/upgrade-enterprise.md Task 6), on the web build with the free-week
   gate (trialGate): during the free week You still shows "Upgrade to Pro", and the Pro sheet says, near the plan tiles,
   how to get Pro in the app; there is still no buy button on the web. After the free week the line is gone (the
   sheet's "free week is over" text says what to do). The store's wording (each plan's own trial days) and the badge
   turning "Pro" after a purchase are pinned with a mock store in src/lib/freeweek.test.mjs: the web has no store. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoTab } from "./lib/nav.mjs";

test("free week: Upgrade to Pro stays, and the Pro sheet says Pro can be had in the app now", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "no" });
  await expect(page.locator("header.mast .planbadge")).toContainText("Free week");
  await gotoTab(page, "You");
  await page.locator("#you-upgrade").click();
  const sheet = page.locator("#pro-sheet");
  const line = sheet.locator("#pro-freeweek");
  await expect(line).toHaveText("You can get Pro in the iPhone or Android app at any time, during your free week too.");
  // near the plan tiles: right under them, before what Pro adds
  expect(await page.evaluate(() => { const t = document.querySelector("#pro-sheet .plantiles"), l = document.querySelector("#pro-freeweek"), list = document.querySelector("#pro-sheet .prolist"); return !!(t.compareDocumentPosition(l) & 4) && !!(l.compareDocumentPosition(list) & 4); })).toBe(true);
  await expect(sheet.locator(".probuy")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Done" }).click();
});

test("after the free week the line is gone", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-16T10:00:00") });
  await register(page, { stage: "My Cycle", pcos: "no" });
  await page.clock.runFor(2000);
  await page.clock.setSystemTime(new Date("2026-11-24T10:00:00"));
  await page.reload();
  await expect(page.locator("header.mast .planbadge")).toContainText("Free week over");
  await page.locator("header.mast .planbadge").click();
  await expect(page.locator("#pro-sheet")).toBeVisible();
  await expect(page.locator("#pro-freeweek")).toHaveCount(0);
});
