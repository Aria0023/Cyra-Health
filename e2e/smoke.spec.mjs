/* Smoke: register through onboarding for My Cycle with PCOS on, visit the five tabs and the "+" sheet, and download the
   Report PDF, which must be exactly one page (fitSummary keeps page 1 to one page; the detailed pages are off by default). */
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { register } from "./lib/onboard.mjs";
import { gotoTab, gotoSegment, openLog, closeSheet, TABS } from "./lib/nav.mjs";

/** Pages in a PDF: its /Type /Page objects (not /Pages). */
export const pdfPages = (bytes) => (Buffer.from(bytes).toString("latin1").match(/\/Type\s*\/Page(?![s])/g) || []).length;

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
