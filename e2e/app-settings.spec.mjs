/* Owner settings (docs/plans/upgrade-enterprise.md Task 2):
   - the portal's App settings page against a real development backend: owner only, what is NOT editable is listed, each
     change is checked, saved and logged (who, when, old → new) and reaches the public GET /api/app-config;
   - the app (API build, the mock answers /api/app-config): one plain GET at start with nothing about her; the Home
     announcement, Help's lines and the web's reference prices apply at once; a feature turned off is gone from the next
     start; a broken answer or none at all means the built-in defaults. */
import { test, expect } from "@playwright/test";
import { startBackend, portalSignIn, OWNER } from "./lib/portal.mjs";
import { register } from "./lib/onboard.mjs";
import { gotoTab, gotoYou } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

const nav = (page, name) => page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name, exact: true });

test.describe("portal", () => {
  let be;
  test.beforeAll(async () => { be = await startBackend(); });
  test.afterAll(async () => { await be?.stop(); });

  test("App settings: owner only; checked, saved, logged and served to the app", async ({ page }) => {
    expect((await fetch(`${be.url}/api/settings`)).status).toBe(401);
    await portalSignIn(page, be, OWNER, "Overview");
    await nav(page, "App settings").click();
    await expect(page.getByRole("heading", { level: 1, name: "App settings" })).toBeFocused();
    await expect(nav(page, "App settings")).toHaveAttribute("aria-current", "page");
    const not = page.getByRole("group", { name: "Not editable here" });
    for (const t of ["Privacy claims", "Legal text", "Clinical and safety text", "Sign in with Apple stays first", "free trial's length"]) await expect(not).toContainText(t);
    await expect(page.getByText("These must match the prices in App Store Connect and Play Console.")).toBeVisible();
    // a bad price is refused by the server and nothing is saved
    await page.getByLabel("Monthly (for example $9.95)").fill("9.95");
    await page.getByRole("button", { name: "Save prices" }).click();
    await expect(page.getByRole("alert")).toContainText("The monthly price must look like $9.95 or $100.");
    await page.getByLabel("Monthly (for example $9.95)").fill("$8.95");
    await page.getByRole("button", { name: "Save prices" }).click();
    await expect(page.locator(".msgbox .ok")).toHaveText("Prices saved.");
    await page.getByLabel("Announcement").fill("Shop by need has new sleep picks.");
    await page.getByLabel("Show it on Home").check();
    await page.getByRole("button", { name: "Save announcement" }).click();
    await expect(page.locator(".msgbox .ok")).toHaveText("Announcement saved and on.");
    await page.getByLabel("Turn off Shop by need").check();
    await page.getByRole("button", { name: "Save features" }).click();
    await expect(page.locator(".msgbox .ok")).toHaveText("Features saved.");
    const log = page.getByRole("region", { name: "Change log" });
    await expect(log.locator("tbody tr")).toHaveCount(3);
    await expect(log.locator("tbody tr").first()).toContainText(OWNER);
    await expect(log.locator("tbody tr").first()).toContainText("Features turned off");
    await expect(log.locator("tbody tr").first()).toContainText('["shop"]');
    const pub = await (await fetch(`${be.url}/api/app-config`)).json();
    expect(pub).toMatchObject({ version: 1, featuresOff: ["shop"], announcement: "Shop by need has new sleep picks.", prices: { monthly: "$8.95", annual: null } });
    expect(JSON.stringify(pub)).not.toContain("@");
  });
});

const CFG = { version: 1, featuresOff: [], defaultStyle: "aura", defaultPalette: 1, announcement: "Clinic hours change on Friday.", helpLines: ["Your clinic can answer questions about its own visits."], prices: { monthly: "$8.95", annual: "$90" }, updatedAt: "2026-11-25T09:30:00.000Z" };

test("the app: one plain GET at start; announcement, Help lines, prices and the new-person defaults apply", async ({ page }) => {
  const state = newApiState({ appConfig: CFG });
  await mockApi(page, state);
  await register(page, { url: process.env.E2E_API_URL, stage: "My Cycle", pcos: "no", signin: "email" });
  const asks = state.sent.filter((r) => r.path === "/api/app-config");
  expect(asks.length).toBeGreaterThanOrEqual(1);
  for (const r of asks) { expect(r.method).toBe("GET"); expect(r.search).toBe(""); expect(r.auth).toBeNull(); expect(r.cookie).toBeNull(); expect(r.referer).toBeNull(); }
  // a new person starts with the owner's default style
  await expect(page.locator(".cy")).toHaveAttribute("data-style", "aura");
  await gotoTab(page, "Home");
  await expect(page.locator(".homeannounce")).toHaveText("Clinic hours change on Friday.");
  await gotoYou(page, "Help & about");
  await expect(page.locator("#you-help .helpextra")).toHaveText("Your clinic can answer questions about its own visits.");
  await gotoYou(page, "Plan & account");
  await expect(page.locator("#you-plan .plantile").first()).toContainText("$90 a year");
  await expect(page.locator("#you-store-line")).toHaveText("Pro is $8.95 a month or $90 a year in the iPhone and Android apps.");
});

test("the app: a feature turned off is gone from the next start; no answer or a broken one means the built-in defaults", async ({ page }) => {
  const state = newApiState();
  await mockApi(page, state);
  await register(page, { url: process.env.E2E_API_URL, stage: "My Cycle", pcos: "no", signin: "email" });
  await expect(page.locator("header.mast").getByRole("button", { name: /Shop/ })).toBeVisible();
  await expect(page.locator(".homeannounce")).toHaveCount(0); // 404: built-in defaults
  state.appConfig = { ...CFG, featuresOff: ["shop"], announcement: null };
  await page.waitForTimeout(1200); // the record saves
  await page.reload(); // this start downloads the change
  await expect(page.locator(".navpill")).toBeVisible();
  await page.reload(); // the next start uses it
  await expect(page.locator(".navpill")).toBeVisible();
  await expect(page.locator("header.mast").getByRole("button", { name: /Shop/ })).toHaveCount(0);
  // a broken answer drops the kept copy: the shop is back from the start after
  state.appConfig = { nonsense: true };
  await page.reload();
  await expect(page.locator(".navpill")).toBeVisible();
  await page.reload();
  await expect(page.locator(".navpill")).toBeVisible();
  await expect(page.locator("header.mast").getByRole("button", { name: /Shop/ })).toBeVisible();
});
