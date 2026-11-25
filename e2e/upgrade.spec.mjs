/* One clear way to Pro (docs/plans/upgrade-enterprise.md Task 1, src/lib/youMenu.js YOU_COPY.upgrade):
   - You shows "Upgrade to Pro" above the seven rows while she does not own Pro; it opens the same Pro sheet, and on the
     web that sheet still sells nothing ("Get Solia Health Pro in the app", no buy button);
   - a locked part that says it is Pro has a way to the same sheet: Home's Ask Solia card for a guest ("See Pro").
   Ownership can't be bought on the web, so "hidden when owned" is pinned by src/lib/youMenu.test.mjs (upgradeShown). */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoTab } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

test("You: Upgrade to Pro sits above the seven rows, opens the Pro sheet, and the web sheet sells nothing", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "no", name: "Maya" });
  await gotoTab(page, "You");
  const up = page.locator(".youmenu #you-upgrade");
  await expect(up).toHaveText("Upgrade to Pro");
  await expect(up).toHaveAttribute("aria-haspopup", "dialog");
  const b = await up.boundingBox();
  expect(b.height).toBeGreaterThanOrEqual(44);
  // above the rows, below her stage card
  expect(await page.evaluate(() => {
    const u = document.querySelector("#you-upgrade"), rows = document.querySelector(".youmenu-nav"), st = document.querySelector(".youmenu .youstage");
    return !!(u.compareDocumentPosition(rows) & 4) && !!(st.compareDocumentPosition(u) & 4);
  })).toBe(true);
  await expect(page.locator(".youmenu .yourow")).toHaveCount(7);
  await up.click();
  const sheet = page.locator("#pro-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".plantile")).toHaveCount(2);
  await expect(sheet.getByText("Get Solia Health Pro in the app")).toBeVisible();
  await expect(sheet.locator(".probuy")).toHaveCount(0); // no buy button on the web
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(up).toBeFocused(); // focus returns to the button
});

test("Home → Pro sheet in two taps through You (the header's plan badge stays one tap)", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "no" });
  await gotoTab(page, "Home");
  let taps = 0;
  await page.getByRole("tab", { name: "You", exact: true }).click(); taps++;
  await page.locator("#you-upgrade").click(); taps++;
  await expect(page.locator("#pro-sheet")).toBeVisible();
  expect(taps).toBe(2);
});

test("a guest's Ask Solia card says it is Pro and offers See Pro, which opens the same sheet", async ({ page }) => {
  const state = newApiState();
  await mockApi(page, state);
  await register(page, { url: process.env.E2E_API_URL, stage: "My Cycle", pcos: "no", signin: "guest" });
  await gotoTab(page, "Home");
  const card = page.locator("#home-ask");
  await expect(card).toHaveAttribute("data-state", "guest");
  await expect(card).toContainText("Solia Health's AI is part of Pro and needs an account.");
  const see = card.getByRole("button", { name: "See Pro", exact: true });
  expect((await see.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await see.click();
  await expect(page.locator("#pro-sheet")).toBeVisible();
  await page.locator("#pro-sheet").getByRole("button", { name: "Done" }).click();
  await expect(see).toBeFocused();
  // You shows the same Upgrade button to a guest
  await gotoTab(page, "You");
  await expect(page.locator("#you-upgrade")).toBeVisible();
});
