/* Task B (docs/plans/partner-learn-glucose-shop.md): devices any time (Body, the "+" sheet, Settings, You) and blood
   glucose. The demo build connects illustrative glucose readings; on a phone they are read from Apple Health / Health
   Connect (see the final report for the device checks). */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoTab, openLog } from "./lib/nav.mjs";

test("devices any time: Body's Devices button, the + sheet and Settings all open the device list", async ({ page }) => {
  await register(page, { stage: "My Cycle" });
  await gotoTab(page, "Body");
  await page.locator(".bodydevbtn").click();
  const sheet = page.locator("#devices-sheet");
  await expect(sheet.getByRole("heading", { name: "Connect your devices" })).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "Blood glucose" })).toBeVisible();
  await expect(sheet.locator('.devrow[data-device="dexcom"]')).toContainText("Dexcom (through Apple Health / Health Connect)");
  await expect(sheet.locator('.devrow[data-device="libre"]')).toContainText("FreeStyle Libre (through Apple Health / Health Connect)");
  await expect(sheet).toContainText("In the Dexcom or Libre app, turn on sharing to Apple Health or Health Connect first.");
  await sheet.getByRole("button", { name: "Close Connect your devices" }).click();
  const log = await openLog(page);
  await log.getByRole("button", { name: "Connect a device" }).click();
  await expect(page.locator("#devices-sheet")).toBeVisible();
  await expect(page.locator("#log-sheet")).toHaveCount(0);
  await page.locator("#devices-sheet").getByRole("button", { name: "Close Connect your devices" }).click();
  await page.getByRole("button", { name: "Check-in settings" }).click();
  await page.locator("#settings-sheet").getByRole("button", { name: "Connect a device" }).click();
  await expect(page.locator("#devices-sheet")).toBeVisible();
});

test("glucose (demo): connect Dexcom, the Body card shows readings in words with a 7-day line; disconnect keeps them", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "yes" });
  await gotoTab(page, "Body");
  await expect(page.locator("#body-glucose")).toHaveCount(0);
  await page.locator(".bodydevbtn").click();
  const dex = page.locator('#devices-sheet .devrow[data-device="dexcom"]');
  await dex.getByRole("button", { name: "Connect" }).click();
  await expect(dex).toContainText("Connected · synced today");
  await page.locator("#devices-sheet").getByRole("button", { name: "Close Connect your devices" }).click();
  const card = page.locator("#body-glucose");
  await expect(card).toBeVisible();
  await expect(card.locator(".gluc-latest")).toContainText("mg/dL");
  await expect(card.locator(".gluc-words")).toContainText(/readings?, from \d+/);
  await expect(card.getByRole("img", { name: /Daily glucose, last 7 days/ })).toBeVisible();
  await expect(card).toContainText("Illustrative readings in this demo build");
  await expect(card).not.toContainText(/\b(high|low|normal|target|good|bad)\b/i);
  await card.locator(".learnlink[data-learn='glucose']").click();
  await expect(page.locator("#learn-sheet")).toContainText("Ask your clinician about your targets.");
  await page.locator("#learn-sheet .v2sheet-close").click();
  await page.locator(".bodydevbtn").click();
  await dex.getByRole("button", { name: "Disconnect" }).click();
  await expect(dex).toContainText("Not connected");
  await page.locator("#devices-sheet").getByRole("button", { name: "Close Connect your devices" }).click();
  await expect(page.locator("#body-glucose")).toBeVisible(); // what was read stays on this device
});
