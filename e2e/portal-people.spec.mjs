/* The portal's People page and the Overview's People card (docs/plans/tracking-reports.md Task 2) against a real
   development backend: accounts made the way the app makes them become counts (total, new, used, by sign-in method);
   nothing on the page or in the API answer names anyone; a partner has no People link and gets 403 from the API. */
import { test, expect } from "@playwright/test";
import { startBackend, portalSignIn, portalToken, appAccount, OWNER } from "./lib/portal.mjs";

let be;
test.beforeAll(async () => { be = await startBackend(); });
test.afterAll(async () => { await be?.stop(); });
const nav = (page, name) => page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name, exact: true }).click();

test("accounts become counts: the Overview card and the People page; a partner can't see them", async ({ page, browser }) => {
  const emails = ["maya@clinic.example", "noor@clinic.example", "ines@clinic.example"];
  const ids = [];
  for (const e of emails) ids.push((await appAccount(be, e)).id);

  await portalSignIn(page, be, OWNER, "Overview");
  const card = page.getByRole("region", { name: "People" });
  await expect(card.locator('[data-stat="people-total"] b')).toHaveText("3");
  await expect(card.locator('[data-stat="people-new7"] b')).toHaveText("3");
  await expect(card.locator('[data-stat="people-active7"] b')).toHaveText("3");
  await card.getByRole("link", { name: "See People" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "People" })).toBeFocused();
  await expect(page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: "People" })).toHaveAttribute("aria-current", "page");
  for (const [id, v] of [["people-total", "3"], ["people-new7", "3"], ["people-new30", "3"], ["people-active1", "3"], ["people-active7", "3"], ["people-active30", "3"]]) await expect(page.locator(`[data-stat="${id}"] b`)).toHaveText(v);
  const by = page.getByRole("table", { name: "Accounts by sign-in method" });
  await expect(by.locator('tr[data-signin="email"] td').first()).toHaveText("3");
  await expect(by.locator('tr[data-signin="email"] td').nth(1)).toHaveText("100%");
  await expect(by.locator('tr[data-signin="apple"] td').first()).toHaveText("0");
  await expect(page.getByRole("img", { name: /New accounts per day, last 30 days \(UTC\): 3 in all/ })).toBeVisible();
  await page.getByText("The 30 days as a table").click();
  await expect(page.getByRole("table", { name: "New accounts by day" }).locator("tbody tr")).toHaveCount(30);
  await expect(page.getByRole("table", { name: "New accounts by day" }).locator("tbody tr").first().locator("td")).toHaveText("3");
  await expect(page.locator("main")).toContainText("Counts only: this page never shows who.");
  // nothing on the page, and nothing in the API answer, names anyone
  const text = await page.locator("main").innerText();
  for (const s of [...emails, ...ids, "clinic.example"]) expect(text).not.toContain(s);
  const token = await portalToken(page);
  const raw = await (await fetch(`${be.url}/api/insights/people`, { headers: { authorization: `Bearer ${token}` } })).text();
  for (const s of [...emails, ...ids, "@"]) expect(raw).not.toContain(s);

  // a partner: no People link, the route falls back to Products, the API answers 403
  expect((await fetch(`${be.url}/api/shop/invites`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ email: "pat@oura.example", brandIds: ["oura"] }) })).status).toBe(201);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pp = await ctx.newPage();
  await portalSignIn(pp, be, "pat@oura.example", "Products");
  await expect(pp.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: "People" })).toHaveCount(0);
  await pp.goto(`${be.url}/portal/#/people`);
  await expect(pp.getByRole("heading", { level: 1, name: "Products" })).toBeVisible();
  const ptoken = await portalToken(pp);
  expect((await fetch(`${be.url}/api/insights/people`, { headers: { authorization: `Bearer ${ptoken}` } })).status).toBe(403);
  expect((await fetch(`${be.url}/api/insights/people`)).status).toBe(401);
  await ctx.close();
});
