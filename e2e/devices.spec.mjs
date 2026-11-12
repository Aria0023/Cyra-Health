/* Task 2, one place to connect wearables: the optional registration step, the dismissible Home card and its sheet, and
   You → Data sources. The API build (mocked backend: Oura set up, Terra not) shows each row's state in a browser; the demo
   build connects illustrative data with one tap. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoTab } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

test("API build in a browser: the step lists every device with what it reads and where it goes; Home card; You", async ({ page }) => {
  const state = newApiState({ sources: { healthkit: "on-device", oura: true, terra: false } });
  await mockApi(page, state);
  // registration up to the device step, by hand
  await page.goto(`${process.env.E2E_API_URL}/`);
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Your email").fill("maya@example.com");
  await page.getByRole("button", { name: "Send me a code" }).click();
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.locator(".stagecard", { hasText: "Pregnant" }).click();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Connect a device?" })).toBeVisible();
  const row = (id) => page.locator(`.devrow[data-device="${id}"]`);
  await expect(row("apple")).toContainText("In the iPhone app");
  await expect(row("healthconnect")).toContainText("In the Android app");
  await expect(row("apple").getByRole("button")).toHaveCount(0); // no dead button in a browser
  await expect(row("oura")).toContainText("Not connected");
  await expect(row("oura").getByRole("button", { name: "Connect" })).toBeVisible();
  await expect(row("oura")).toContainText("passes your readings to this device without keeping them");
  await expect(row("terra")).toContainText("Not set up yet");
  await expect(row("terra")).toContainText("7 days at most");
  await expect(row("terra").getByRole("button")).toHaveCount(0);
  expect(state.sent.some((r) => r.path === "/api/integrations/sources")).toBe(true);
  // skip: Continue moves on
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your data and your choices" })).toBeVisible();
  await page.getByRole("checkbox", { name: /I agree to/ }).click();
  await page.getByRole("button", { name: "Enter Solia Health" }).click();
  // Home: the card, its sheet, Not now
  const card = page.locator("#home-devices");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "See devices" }).click();
  const sheet = page.locator("#devices-sheet");
  await expect(sheet.getByRole("heading", { name: "Connect your devices" })).toBeVisible();
  await expect(sheet.locator('.devrow[data-device="oura"]')).toContainText("Where it goes");
  await sheet.getByRole("button", { name: "Close Connect your devices" }).click();
  await card.getByRole("button", { name: "Not now" }).click();
  await expect(page.locator("#home-devices")).toHaveCount(0);
  // You → Data sources: the same list, at the top
  await gotoTab(page, "You");
  await page.locator("#you-sources").getByRole("button", { name: "Connect a device" }).click();
  await expect(page.locator("#devices-sheet .devrow")).toHaveCount(4);
});

test("demo build: one tap connects (illustrative), the row says Connected and the Home card goes", async ({ page }) => {
  await register(page, { stage: "Perimenopause" });
  const card = page.locator("#home-devices");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "See devices" }).click();
  const oura = page.locator('#devices-sheet .devrow[data-device="oura"]');
  await oura.getByRole("button", { name: "Connect" }).click();
  await expect(oura).toContainText("Connected · synced today");
  await expect(oura.getByRole("button", { name: "Disconnect" })).toBeVisible();
  await expect(page.locator("#devices-sheet")).toContainText("illustrative readings");
  await page.locator("#devices-sheet").getByRole("button", { name: "Close Connect your devices" }).click();
  await expect(page.locator("#home-devices")).toHaveCount(0);
});
