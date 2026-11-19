/* The portal's Clicks page (docs/plans/tracking-reports.md Task 1) against a real development backend: taps sent the way
   the app sends them become totals; the owner sees every brand, by brand and by product, for 7 / 30 / 90 days, and
   exports a CSV; a partner sees only its own brands' totals. */
import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { startBackend, portalSignIn, portalToken, OWNER } from "./lib/portal.mjs";

let be;
test.beforeAll(async () => { be = await startBackend(); });
test.afterAll(async () => { await be?.stop(); });
const tap = (base, productId) => fetch(`${base}/api/shop/tap`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId }) });
const nav = (page, name) => page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name, exact: true }).click();

test("taps become totals: the owner sees all brands and exports CSV; a partner sees only its own", async ({ page, browser }) => {
  for (const id of ["oura", "oura", "oura", "mira", "easyhome-lh", "easyhome-bbt"]) expect((await tap(be.url, id)).status).toBe(204);
  expect((await tap(be.url, "not-a-product")).status).toBe(404);

  await portalSignIn(page, be, OWNER, "Overview");
  await nav(page, "Clicks");
  await expect(page.getByRole("heading", { level: 1, name: "Clicks" })).toBeFocused();
  await expect(page.locator("main")).toContainText("nothing here says who tapped");
  await expect(page.getByRole("button", { name: "Last 30 days" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-stat="taps"] b')).toHaveText("6");
  const byBrand = page.getByRole("table", { name: "Taps by brand" });
  await expect(byBrand.locator("tbody tr")).toHaveCount(3);
  await expect(byBrand.locator('tr[data-brand="oura"]')).toContainText("Oura");
  await expect(byBrand.locator('tr[data-brand="oura"] td')).toHaveText("3");
  await expect(byBrand.locator('tr[data-brand="easy-home"] td')).toHaveText("2");
  const byProduct = page.getByRole("table", { name: "Taps by product" });
  await expect(byProduct.locator("tbody tr")).toHaveCount(4);
  await expect(byProduct.locator('tr[data-product="mira"]')).toContainText("Fertility hormone monitor");
  await expect(page.getByRole("img", { name: /Most-tapped products: Oura Ring 3/ })).toBeVisible();
  await page.getByRole("button", { name: "Last 7 days" }).click();
  await expect(page.getByRole("button", { name: "Last 7 days" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-stat="taps"] b')).toHaveText("6");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
  expect(dl.suggestedFilename()).toBe("solia-shop-taps-7d.csv");
  const csv = fs.readFileSync(await dl.path(), "utf8");
  expect(csv.split("\r\n")[0]).toBe("day,brand,product,productId,taps");
  expect(csv).toMatch(/,Oura,Oura Ring,oura,3\r\n/);
  expect(csv.trim().split("\r\n")).toHaveLength(5);

  // a partner of Oura: only Oura's totals
  const token = await portalToken(page);
  const inv = await fetch(`${be.url}/api/shop/invites`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ email: "pat@oura.example", brandIds: ["oura"] }) });
  expect(inv.status).toBe(201);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pp = await ctx.newPage();
  await portalSignIn(pp, be, "pat@oura.example", "Products");
  await expect(pp.getByRole("navigation", { name: "Portal" }).getByRole("link")).toHaveText(["Products", "Brands", "Codes", "Clicks"]);
  await nav(pp, "Clicks");
  await expect(pp.locator("main")).toContainText("How often people opened your products");
  await expect(pp.locator('[data-stat="taps"] b')).toHaveText("3");
  await expect(pp.getByRole("table", { name: "Taps by brand" }).locator("tbody tr")).toHaveCount(1);
  await expect(pp.locator("main")).not.toContainText("Mira");
  await expect(pp.locator("main")).not.toContainText("Easy@Home");
  const ptoken = await portalToken(pp);
  const direct = await (await fetch(`${be.url}/api/shop/taps?days=90`, { headers: { authorization: `Bearer ${ptoken}` } })).json();
  expect(direct.brands.map((b) => b.brandId)).toEqual(["oura"]);
  await ctx.close();
});
