/* Navigation helpers over the five-tab nav pill (components/ui/NavPill.jsx) and the "+" log sheet. */
import { expect } from "@playwright/test";

export const TABS = ["Home", "Body", "Mind", "Patterns", "You"];

/** Selects a tab by its label and waits for its view's heading. */
export async function gotoTab(page, label) {
  await page.getByRole("tab", { name: label, exact: true }).click();
  await expect(page.locator(".viewpanel main h1")).toBeVisible();
}
/* You is a short menu (2026-11-19, src/lib/youMenu.js): each card lives on one of its pages. */
export const YOU_PAGES = ["Your profile", "Privacy & your data", "Solia Health's AI", "Plan & account", "Devices & reminders", "App settings", "Help & about"];
/** Opens one of You's pages from the menu (the You tab always opens on the menu) and waits for its heading. */
export async function gotoYou(page, title) {
  await page.getByRole("tab", { name: "You", exact: true }).click();
  await page.locator(".youmenu .yourow", { hasText: title }).click();
  await expect(page.locator(".yousub h1")).toHaveText(title);
}
/** Picks a style (Soft, Mono, Clear, Journal, Aura, Sky, Blush, Mint, Sunset) with You → App settings' style picker; ends there. */
export async function setStyle(page, name) {
  await gotoYou(page, "App settings");
  await page.getByRole("radio", { name, exact: true }).click();
  await expect(page.locator(".cy")).toHaveAttribute("data-style", name.toLowerCase());
}
/** Opens Home's folded "More for today" group (2026-11-25, docs/plans/critique-fixes.md Task 2) if it is closed. */
export async function openHomeMore(page) {
  const more = page.getByRole("button", { name: "More for today" });
  if ((await more.getAttribute("aria-expanded")) !== "true") await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
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
