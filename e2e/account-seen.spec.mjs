/* "The account is in use" (docs/plans/tracking-reports.md Task 2), the API build against the mock backend: while she is
   signed in, opening the app makes one GET /api/accounts/me with her sign-in token and no body or query; a guest makes
   none; the sign-in step says the server keeps the last day she used her account. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoTab, gotoYou } from "./lib/nav.mjs";
import { mockApi, newApiState, TOKEN } from "./lib/api.mjs";

const API_URL = () => process.env.E2E_API_URL;
const seen = (state) => state.sent.filter((r) => r.path === "/api/accounts/me" && r.method === "GET");

test("signed in: one check-in per launch, with the token and nothing else; the disclosure names the last day used", async ({ page }) => {
  const state = newApiState();
  await mockApi(page, state);
  await page.goto(`${API_URL()}/`);
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByRole("button", { name: "What signing in shares" }).click();
  await expect(page.locator("main")).toContainText("when you made the account and the last day you used your account (a date, not a time). Never your health log.");
  await expect(page.locator("main")).toContainText("While you're signed in, Solia Health tells its server the account is in use when the app opens. That request carries your sign-in and nothing from your log.");
  expect(seen(state), "nothing before she signs in").toEqual([]);
  await register(page, { url: API_URL(), stage: "My Cycle", pcos: "no", signin: "email", resume: true });
  await expect.poll(() => seen(state).length).toBe(1);
  expect(seen(state)[0]).toMatchObject({ method: "GET", search: "", body: null, auth: `Bearer ${TOKEN}`, cookie: null });
  for (const tab of ["Body", "You", "Home"]) await gotoTab(page, tab);
  await page.waitForTimeout(300);
  expect(seen(state).length, "once per launch, not per screen").toBe(1);
  await page.waitForTimeout(2000); // the autosave
  await page.reload();
  await expect(page.getByRole("tab", { name: "Home", exact: true })).toBeVisible();
  await expect.poll(() => seen(state).length, { message: "the next launch checks in again" }).toBe(2);
  // You → Privacy & your data → other connections says the same
  await gotoYou(page, "Privacy & your data");
  await page.locator("#you-privacy").getByRole("button", { name: "How this works" }).click();
  await page.locator("#you-privacy").getByRole("button", { name: "Other connections Solia Health makes" }).click();
  await expect(page.locator("#you-privacy")).toContainText("the last day you used your account (a date, not a time; the app tells the server the account is in use when it opens)");
});

test("a guest never checks in", async ({ page }) => {
  const state = newApiState();
  await mockApi(page, state);
  await register(page, { url: API_URL(), stage: "My Cycle", pcos: "no", signin: "guest" });
  for (const tab of ["Body", "You", "Home"]) await gotoTab(page, tab);
  await page.waitForTimeout(300);
  expect(seen(state)).toEqual([]);
  expect(state.sent.filter((r) => r.auth).length, "no request carried a token").toBe(0);
});
