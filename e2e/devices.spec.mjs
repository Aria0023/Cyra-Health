/* Task 2, connecting wearables later (never during registration, owner decision 2026-11-12): the dismissible Home card and its sheet, and
   You → Devices & reminders. The API build (mocked backend: Oura set up, Terra not) shows each row's state in a browser, hides the
   Terra row and carries the "Fitbit, Garmin or Whoop?" how-to (2026-11-19, tracking-reports Task 4); with Terra set up the
   row is back; the demo build connects illustrative data with one tap. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoYou, openHomeMore } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

test("API build in a browser: registration skips devices; the Home card's sheet lists every device with what it reads and where it goes; You", async ({ page }) => {
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
  // Registration never asks about devices: Stage → Device → Pregnancy → Consent.
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your data and your choices" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connect a device?" })).toHaveCount(0);
  await page.getByRole("checkbox", { name: /I agree to/ }).click();
  await page.getByRole("button", { name: "Enter Solia Health" }).click();
  // Home: the card and its sheet list every device with what it reads and where it goes (in "More for today" since 2026-11-25)
  await openHomeMore(page);
  const card = page.locator("#home-devices");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "See devices" }).click();
  const sheet = page.locator("#devices-sheet");
  await expect(sheet.getByRole("heading", { name: "Connect your devices" })).toBeVisible();
  const row = (id) => sheet.locator(`.devrow[data-device="${id}"]`);
  await expect(row("apple")).toContainText("In the iPhone app");
  await expect(row("healthconnect")).toContainText("In the Android app");
  await expect(row("apple").getByRole("button")).toHaveCount(0); // no dead button in a browser
  await expect(row("oura")).toContainText("Not connected");
  await expect(row("oura").getByRole("button", { name: "Connect" })).toBeVisible();
  await expect(row("oura")).toContainText("passes your readings to this device without keeping them");
  // 2026-11-19: Terra isn't set up on this server, so the Fitbit · Garmin · Whoop row is hidden (no dead end) and the
  // "Fitbit, Garmin or Whoop?" how-to explains the path through Apple Health / Health Connect instead
  await expect(row("terra")).toHaveCount(0);
  await expect(sheet).not.toContainText("Not set up yet");
  const howto = sheet.locator(".devhowto");
  const toggle = howto.getByRole("button", { name: "Fitbit, Garmin or Whoop?" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(howto).toContainText("Their own apps can share your readings with Apple Health (iPhone) or Health Connect (Android), and Solia Health reads them from there, on your phone, in the Solia Health app. Solia Health's server is never involved this way.");
  for (const brand of ["Fitbit", "Garmin", "Whoop"]) await expect(howto.getByRole("list", { name: brand }).getByRole("listitem")).toHaveCount(3);
  await expect(howto.getByRole("list", { name: "Garmin" }).getByRole("listitem")).toHaveText(["Open the Garmin Connect app and go to its settings.", "Look for Apple Health (iPhone) or Health Connect (Android) there and turn on sharing for sleep and heart rate.", "In the Solia Health app on that phone, open Connect your devices and connect Apple Health or Health Connect."]);
  await expect(howto).toContainText("On an iPhone, the Fitbit app may not offer Apple Health.");
  await expect(howto).toContainText("What doesn't come through: Garmin and Whoop don't share HRV this way, so HRV stays empty for them.");
  await expect(howto).toContainText("Menu names change from time to time.");
  await expect(howto).not.toContainText("Terra");
  expect(state.sent.some((r) => r.path === "/api/integrations/sources")).toBe(true);
  await expect(sheet.locator('.devrow[data-device="oura"]')).toContainText("Where it goes");
  await sheet.getByRole("button", { name: "Close Connect your devices" }).click();
  await card.getByRole("button", { name: "Not now" }).click();
  await expect(page.locator("#home-devices")).toHaveCount(0);
  // You → Devices & reminders → Data sources: the same list, at the top
  await gotoYou(page, "Devices & reminders");
  await page.locator("#you-sources").getByRole("button", { name: "Connect a device" }).click();
  await expect(page.locator("#devices-sheet .devrow")).toHaveCount(5); // Apple Health, Health Connect, Oura + Dexcom and FreeStyle Libre (Task B); no Terra row
});

test("API build, Terra set up on the server: the Fitbit · Garmin · Whoop row is there, and so is the how-to", async ({ page }) => {
  const state = newApiState({ sources: { healthkit: "on-device", oura: true, terra: true } });
  await mockApi(page, state);
  await register(page, { url: process.env.E2E_API_URL, stage: "My Cycle", pcos: "no", signin: "email" });
  await openHomeMore(page); // 2026-11-25: the card sits in Home's "More for today"
  await page.locator("#home-devices").getByRole("button", { name: "See devices" }).click();
  const sheet = page.locator("#devices-sheet");
  const terra = sheet.locator('.devrow[data-device="terra"]');
  await expect(terra).toContainText("Fitbit · Garmin · Whoop");
  await expect(terra).toContainText("7 days at most");
  await expect(terra.getByRole("button", { name: "Connect" })).toBeVisible();
  await expect(sheet.locator(".devhowto").getByRole("button", { name: "Fitbit, Garmin or Whoop?" })).toBeVisible();
});

test("demo build: one tap connects (illustrative), the row says Connected and the Home card goes", async ({ page }) => {
  await register(page, { stage: "Perimenopause" });
  await openHomeMore(page); // 2026-11-25: the card sits in Home's "More for today"
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
