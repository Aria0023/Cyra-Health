/* Smoke: register through onboarding for My Cycle with PCOS on, visit the five tabs and the "+" sheet, and download the
   Report PDF, which must be exactly one page (fitSummary keeps page 1 to one page; the detailed pages are off by default). */
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { register } from "./lib/onboard.mjs";
import { gotoTab, gotoSegment, openLog, closeSheet, TABS } from "./lib/nav.mjs";
import { pdfPages } from "./lib/pdf.mjs";

test("register (My Cycle, PCOS on), the five tabs, the log sheet, the one-page PDF, the build stamp", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "yes", name: "Maya" });
  await expect(page.locator(".viewpanel main h1")).toContainText(/Good (morning|afternoon|evening), Maya/);
  for (const tab of TABS) {
    await gotoTab(page, tab);
    await expect(page.locator(".viewpanel main h1")).toBeVisible();
    await expect(page.getByRole("tab", { name: tab, exact: true })).toHaveAttribute("aria-selected", "true");
  }
  // PCOS module on: You → Modules shows its switch on
  await gotoTab(page, "You");
  await expect(page.locator("#you-modules")).toBeVisible();
  await expect(page.locator('#you-modules [role="switch"][aria-labelledby="mod-pcos"]')).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".youbuild")).toContainText("BUILD 2026.10.07-D");
  // the "+" sheet lists the loggers this stage has, PCOS signals included
  const sheet = await openLog(page);
  await expect(sheet.getByRole("button", { name: "PCOS signals" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Period" })).toBeVisible();
  await closeSheet(page);
  // Report → Download PDF → a one-page file
  await gotoTab(page, "Patterns");
  await gotoSegment(page, "Report");
  const btn = page.getByRole("button", { name: /Download PDF/ });
  await expect(btn).toBeVisible();
  await expect(btn).not.toHaveAttribute("aria-disabled", "true");
  const [dl] = await Promise.all([page.waitForEvent("download"), btn.click()]);
  expect(dl.suggestedFilename()).toMatch(/^solia-health-summary-\d{4}-\d{2}-\d{2}\.pdf$/);
  const file = await dl.path();
  const bytes = fs.readFileSync(file);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdfPages(bytes)).toBe(1);
  fs.mkdirSync("e2e/shots", { recursive: true });
  fs.copyFileSync(file, "e2e/shots/clinician-summary.pdf");
});

test("stage cards are multi-pick: periods and perimenopause together; registration never asks about devices", async ({ page }) => {
  await page.goto(`${process.env.E2E_URL}/`);
  await page.getByRole("button", { name: "Get started" }).click();
  const skip = page.getByRole("button", { name: "Continue without an account" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  const card = (s) => page.locator(".stagecard", { hasText: s }).first();
  await card("My Cycle").click();
  await card("Perimenopause").click();
  await expect(card("My Cycle")).toHaveAttribute("aria-pressed", "true");
  await expect(card("Perimenopause")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".stagesummary")).toHaveText("Your app will be set up for Perimenopause, with “Predict my cycle” added to your goals.");
  // Pregnant stands alone, and picking another card clears it
  await card("Pregnant").click();
  await expect(card("My Cycle")).toHaveAttribute("aria-pressed", "false");
  await card("Pregnant").click();
  await card("My Cycle").click();
  await card("Perimenopause").click();
  const next = () => page.getByRole("button", { name: "Continue", exact: true }).click();
  await next(); // → PCOS
  await next(); // → Device
  await next(); // → Cycle: the period date is asked
  await expect(page.getByRole("heading", { name: "Your cycle history" })).toBeVisible();
  await page.getByRole("button", { name: "Irregular", exact: true }).click();
  await next();
  await expect(page.getByRole("heading", { name: "Your data and your choices" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connect a device?" })).toHaveCount(0);
});
