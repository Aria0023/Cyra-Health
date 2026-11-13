/* "How does she know she's done?" (owner request 2026-11-12): every tap that saves on the spot says "Saved ✓", and the
   check-in ends with "Today's check-in is saved ✓", the same line on the check-in, and a tick on Home's today line. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoTab, toast, openLog } from "./lib/nav.mjs";

test("instant saves say Saved ✓; the check-in ends with a clear finish and a tick on Home", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "no" });
  // Mood on Mind: each tap saves and says so
  await gotoTab(page, "Mind");
  await page.locator(".moodbtn").first().click();
  await expect(toast(page)).toHaveText("Saved ✓");

  // The check-in waits for Save, then says it plainly
  await gotoTab(page, "Body");
  await page.getByRole("button", { name: "Save today's check-in" }).click();
  await expect(toast(page)).toHaveText("Today's check-in is saved ✓");
  await gotoTab(page, "Body");
  await expect(page.locator(".savedline")).toContainText("Today's check-in is saved.");
  await gotoTab(page, "Home");
  await expect(page.locator(".todayline .todaytick")).toBeVisible();
});

test("pregnancy: sleep hours save on the tap and say Saved ✓", async ({ page }) => {
  await register(page, { stage: "Pregnant" });
  const sheet = await openLog(page);
  await sheet.getByRole("button", { name: "Sleep" }).click();
  const dlg = page.locator('[role="dialog"]').last();
  await dlg.locator("button.mc").first().click();
  await expect(toast(page)).toHaveText("Saved \u2713");
});
