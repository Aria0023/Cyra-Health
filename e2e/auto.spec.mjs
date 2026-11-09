/* Auto-tracked acceptance (docs/plans/auto-tracked-spike.md). Filled in as S2 and S3 land. S1: the demo-wearables build
   connects a source to 90 days of illustrative readings and says so. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { toast } from "./lib/nav.mjs";

test("S1: connecting a demo source brings 90 days of illustrative readings and says so", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "yes" });
  await page.getByRole("button", { name: /^Wearables/ }).click();
  const door = page.locator("#home-wear");
  await expect(door).toBeVisible();
  await door.getByRole("button", { name: "Connect" }).first().click();
  await expect(toast(page)).toContainText("Demo mode");
  await expect(toast(page)).toContainText("90 days of illustrative data");
  await expect(page.getByRole("button", { name: /^Wearables/ })).toContainText("1 connected");
});
