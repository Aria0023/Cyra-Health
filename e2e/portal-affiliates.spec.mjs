/* The portal's Affiliates page (docs/plans/tracking-reports.md Task 3) against a real development backend and a local
   stand-in for Impact (e2e/lib/impact.mjs): the owner links a brand to its Impact campaign, sees Solia's taps beside
   Impact's clicks, sales and commission, with totals and "Last updated"; uploads an Amazon Associates earnings report and
   sees its totals labelled "Uploaded …"; a server without Impact's variables says so and names them; a partner has no
   Affiliates page. */
import { test, expect } from "@playwright/test";
import { startBackend, portalSignIn, portalToken, OWNER } from "./lib/portal.mjs";
import { startImpact, IMPACT_TOKEN } from "./lib/impact.mjs";

const nav = (page, name) => page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name, exact: true }).click();
const tap = (base, productId) => fetch(`${base}/api/shop/tap`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId }) });
const today = new Date().toISOString().slice(0, 10);
const REPORT = ["Fee-Earnings reports", "Category,Name,ASIN,Tracking ID,Date Shipped,Price($),Items Shipped,Returns,Revenue($),Ad Fees($)", `Health,"LH strips, 50 ct",B00X,solia-20,${today} 00:00:00,19.99,2,0,39.98,1.60`, `Health,Thermometer,B00Y,solia-20,${today} 00:00:00,9.99,1,0,9.99,0.40`, ""].join("\r\n");

test("Impact connected: taps beside clicks, sales and commission per brand; the Amazon report upload", async ({ page, browser }) => {
  const impact = await startImpact();
  const be = await startBackend({ env: impact.env });
  try {
    for (const id of ["oura", "oura", "oura", "mira"]) await tap(be.url, id);
    await portalSignIn(page, be, OWNER, "Overview");
    // link Oura to its campaign on the brand page
    await nav(page, "Brands");
    await page.getByRole("link", { name: "Oura", exact: true }).click();
    await page.getByLabel("Impact campaign ID (optional)").fill("1001");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator(".msgbox")).toContainText("Saved");
    await expect(page.getByLabel("Impact campaign ID (optional)")).toHaveValue("1001");
    expect(JSON.stringify(await (await fetch(`${be.url}/api/shop/catalog`)).json())).not.toContain("impactCampaignId");

    await nav(page, "Affiliates");
    await expect(page.getByRole("heading", { level: 1, name: "Affiliates" })).toBeFocused();
    for (const [id, v] of [["aff-taps", "4"], ["aff-clicks", "175"], ["aff-sales", "8"], ["aff-amount", "2,192.00"], ["aff-commission", "183.32"]]) await expect(page.locator(`[data-stat="${id}"] b`)).toHaveText(v);
    const t = page.getByRole("table", { name: "Taps and Impact results by brand" });
    await expect(t.locator('tr[data-brand="oura"] td')).toHaveText(["3", "Oura (1001)", "120", "6", "1,794.00", "143.52"]);
    await expect(t.locator('tr[data-brand="mira"] td')).toHaveText(["1", "Not linked", "–", "–", "–", "–"]);
    const un = page.getByRole("table", { name: "Impact campaigns not linked to a brand" });
    await expect(un.locator("tbody tr")).toHaveCount(2);
    await expect(un.locator('tr[data-campaign="1002"]')).toContainText("Mira Fertility");
    await expect(page.locator("[data-updated]")).toContainText(/Last updated .+; kept for 15 minutes\./);
    const n = impact.calls.length;
    await page.getByRole("button", { name: "Last 7 days" }).click();
    await expect(page.getByRole("button", { name: "Last 7 days" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Last 30 days" }).click();
    await expect(page.getByRole("button", { name: "Last 30 days" })).toHaveAttribute("aria-pressed", "true");
    expect(impact.calls.length, "a period already read comes from the cache").toBe(n + 1);
    expect(impact.calls.every((c) => c.method === "GET" && /^\/Mediapartners\/[A-Za-z0-9]+\/(Reports\/mp_performance_by_campaign\?START_DATE=\d{4}-\d{2}-\d{2}&END_DATE=\d{4}-\d{2}-\d{2}&SUBAID=|Campaigns)/.test(c.url))).toBe(true);

    // Amazon Associates: nothing yet, then an upload
    await expect(page.locator("main")).toContainText("No report uploaded yet.");
    await page.getByLabel("Amazon Associates earnings report (CSV)").setInputFiles({ name: "earnings.csv", mimeType: "text/csv", buffer: Buffer.from("this is not a report") });
    await page.getByRole("button", { name: "Upload report" }).click();
    await expect(page.getByRole("alert")).toContainText("No header row found");
    await page.getByLabel("Amazon Associates earnings report (CSV)").setInputFiles({ name: "earnings.csv", mimeType: "text/csv", buffer: Buffer.from(REPORT) });
    await page.getByRole("button", { name: "Upload report" }).click();
    await expect(page.locator(".msgbox")).toContainText(`Report read: 2 rows over 1 days, ${today} to ${today}.`);
    for (const [id, v] of [["az-items", "3"], ["az-revenue", "49.97"], ["az-earnings", "2.00"]]) await expect(page.locator(`[data-stat="${id}"] b`)).toHaveText(v);
    await expect(page.locator("[data-uploaded]")).toContainText(/^Uploaded .+\. The report covers/);
    await expect(page.locator("main")).not.toContainText("LH strips");

    // the token never reaches the browser or the log; a partner has no Affiliates page
    const token = await portalToken(page);
    const raw = await (await fetch(`${be.url}/api/insights/affiliates?days=30`, { headers: { authorization: `Bearer ${token}` } })).text();
    expect(raw).not.toContain(IMPACT_TOKEN);
    expect(be.log()).not.toContain(IMPACT_TOKEN);
    expect((await fetch(`${be.url}/api/shop/invites`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ email: "pat@oura.example", brandIds: ["oura"] }) })).status).toBe(201);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pp = await ctx.newPage();
    await portalSignIn(pp, be, "pat@oura.example", "Products");
    await expect(pp.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: "Affiliates" })).toHaveCount(0);
    await pp.goto(`${be.url}/portal/#/brands`);
    await pp.getByRole("link", { name: "Oura", exact: true }).click();
    await expect(pp.getByLabel("Brand name")).toBeVisible();
    await expect(pp.getByLabel("Impact campaign ID (optional)")).toHaveCount(0);
    expect((await fetch(`${be.url}/api/insights/affiliates`, { headers: { authorization: `Bearer ${await portalToken(pp)}` } })).status).toBe(403);
    await ctx.close();
  } finally { await be.stop(); await impact.stop(); }
});

test("Impact not connected: the page names the two variables and still shows the taps", async ({ page }) => {
  const be = await startBackend({ env: { IMPACT_ACCOUNT_SID: "", IMPACT_AUTH_TOKEN: "", IMPACT_API_BASE: "" } });
  try {
    await tap(be.url, "oura");
    await portalSignIn(page, be, OWNER, "Overview");
    await nav(page, "Affiliates");
    await expect(page.getByRole("heading", { level: 2, name: "Impact isn't connected to this server yet" })).toBeVisible();
    await expect(page.locator(".envlist")).toContainText("IMPACT_ACCOUNT_SID (not set)");
    await expect(page.locator(".envlist")).toContainText("IMPACT_AUTH_TOKEN (not set)");
    await expect(page.locator('[data-stat="aff-taps"] b')).toHaveText("1");
    await expect(page.locator('[data-stat="aff-commission"]')).toHaveCount(0);
    await expect(page.getByRole("table", { name: "Taps and Impact results by brand" }).locator('tr[data-brand="oura"] td')).toHaveText(["1", "Not linked", "–", "–", "–", "–"]);
  } finally { await be.stop(); }
});
