/* Navigation helpers over the five-tab nav pill (components/ui/NavPill.jsx) and the "+" log sheet. */
import { expect } from "@playwright/test";

export const TABS = ["Home", "Body", "Mind", "Patterns", "You"];

/** Selects a tab by its label and waits for its view's heading. */
export async function gotoTab(page, label) {
  await page.getByRole("tab", { name: label, exact: true }).click();
  await expect(page.locator(".viewpanel main h1")).toBeVisible();
}
/** A segment of the current tab ("Cycles", "Report", "Calendar", "Journey", …). */
export async function gotoSegment(page, label) {
  await page.locator(".subnav").getByRole("button", { name: label, exact: true }).click();
  await expect(page.locator(".viewpanel main h1")).toBeVisible();
}
/** Opens the "+" log sheet (a dialog named "Log something"). */
export async function openLog(page) {
  await page.getByRole("button", { name: "Log something" }).click();
  const sheet = page.getByRole("dialog", { name: "Log something" });
  await expect(sheet).toBeVisible();
  return sheet;
}
export async function closeSheet(page) {
  await page.locator(".v2sheet .v2sheet-close").click();
  await expect(page.locator(".v2sheet")).toHaveCount(0);
}
/** The toast text, when one is showing. */
export const toast = (page) => page.locator(".toast");
/** The dev gallery at #/dev/ui (builds with devGallery). */
export async function gotoGallery(page, { url = process.env.E2E_URL, stage = "cycle", scheme = "light", style = "soft" } = {}) {
  await page.goto(`${url}/#/dev/ui?stage=${stage}&scheme=${scheme}&style=${style}`);
  await expect(page.locator(".devgallery h1")).toBeVisible();
}
