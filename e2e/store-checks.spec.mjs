/* Store-submission checks (docs/plans/launch-tools.md Task 4; docs/STORE-SETUP.md "Before you submit"). Apple requires
   both, so both are pinned here on a 390x844 screen:
   1. "Restore purchases" is on the plans screen WITH the plans: visible without any scrolling when the Pro sheet opens
      (a pretend App Store, the dev gallery), directly after the plan tiles and before the long "what Pro adds" list;
      with a promotion banner above the plans too. It is also on You → Plan.
   2. "Delete my account" is reachable from You → Account in two taps while signed in ("Delete account", then "Delete
      my account"), after a confirmation that says exactly what is deleted and what is not; nothing is deleted before
      the second tap. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoTab, gotoGallery } from "./lib/nav.mjs";
import { mockApi, newApiState, TOKEN } from "./lib/api.mjs";

test.use({ viewport: { width: 390, height: 844 } });

test("Restore purchases is on screen with the plans, without scrolling (390x844)", async ({ page }) => {
  for (const open of ["Open the Pro sheet (pretend store)", "Open the Pro sheet with a promotion (pretend store)"]) {
    await gotoGallery(page);
    await page.getByRole("button", { name: open, exact: true }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.locator(".plantile").first()).toBeVisible();
    await expect(sheet.locator(".probuy")).toBeVisible(); // the store answered: plans are on sale
    const restore = sheet.getByRole("button", { name: "Restore purchases", exact: true });
    await expect(restore, "one Restore purchases, not two").toHaveCount(1);
    // nothing has been scrolled: the sheet's body is at the top, and the button is fully inside the 390x844 screen
    expect(await sheet.locator(".v2sheet-body").evaluate((el) => el.scrollTop)).toBe(0);
    await expect(restore).toBeInViewport({ ratio: 1 });
    const box = await restore.boundingBox();
    expect(box.y + box.height, `${open}: inside the screen`).toBeLessThanOrEqual(844);
    expect(box.height, "a 44px target").toBeGreaterThanOrEqual(44);
    // it comes right after the plans and before the list of what Pro adds
    const tiles = await sheet.locator(".plantile").last().boundingBox();
    const list = await sheet.locator(".prolist").boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(tiles.y + tiles.height - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(list.y + 1);
    for (const tile of await sheet.locator(".plantile").all()) await expect(tile).toBeInViewport({ ratio: 1 });
    await restore.click(); // it is a working button (the gallery's store does nothing with it)
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("Restore purchases is also on You → Plan, and says what happened", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "no" });
  await gotoTab(page, "You");
  const restore = page.locator("#you-plan").getByRole("button", { name: "Restore purchases", exact: true });
  await expect(restore).toBeVisible();
  expect((await restore.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await restore.click();
  await expect(page.locator(".toast")).toBeVisible(); // this bundle has no store: it says so instead of doing nothing
});

test("Delete my account: two taps from You → Account, after saying exactly what is deleted (390x844)", async ({ page }) => {
  const state = newApiState();
  await mockApi(page, state);
  await register(page, { url: process.env.E2E_API_URL, stage: "My Cycle", pcos: "no", signin: "email" });
  await gotoTab(page, "You");
  const account = page.locator("#you-signin");
  await expect(account.getByRole("heading", { level: 2 })).toContainText("Your account");
  await expect(account).toContainText("Signed in as maya@example.com");
  const deletes = () => state.sent.filter((r) => r.method === "DELETE" && r.path === "/api/accounts/me");

  // tap 1
  const first = account.getByRole("button", { name: "Delete account", exact: true });
  expect((await first.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await first.click();
  const confirm = page.locator("#signin-del");
  await expect(confirm).toContainText("Delete your Solia Health account?");
  await expect(confirm).toContainText("This deletes your account from Solia Health's server: your sign-in email, name and how you signed in, your monthly AI use counts, and any feedback you sent with \"It's OK to reply to me\" on.");
  await expect(confirm).toContainText("It can't be undone.");
  await expect(confirm).toContainText("It doesn't cancel a Pro subscription: cancel that in the App Store or Google Play.");
  await expect(confirm).toContainText("Your health log on this device isn't touched; to erase it too, use Delete everything.");
  expect(deletes(), "nothing is deleted before she confirms").toEqual([]);
  // she can back out
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator("#signin-del")).toHaveCount(0);
  expect(deletes()).toEqual([]);

  // tap 1 again, then tap 2
  await account.getByRole("button", { name: "Delete account", exact: true }).click();
  const go = page.locator("#signin-del").getByRole("button", { name: "Delete my account", exact: true });
  expect((await go.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await go.click();
  await expect.poll(() => deletes().length).toBe(1);
  expect(deletes()[0].auth).toBe(`Bearer ${TOKEN}`);
  await expect(page.locator("#you-signin")).toHaveCount(0);
});
