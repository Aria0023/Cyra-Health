/* The portal's AI costs page (docs/plans/launch-tools.md Task 2) against a real development backend and a local
   stand-in for Anthropic: what a real request reported using becomes an estimate (labelled as one, with its prices);
   the owner edits the prices and sets a budget; passing 80% raises the alert once and shows on Overview and
   Readiness; the CSV; nothing names anyone; a partner can't see any of it. */
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { startBackend, portalSignIn, portalToken, OWNER } from "./lib/portal.mjs";
import { startAnthropic } from "./lib/anthropic.mjs";

let be, ai;
test.beforeAll(async () => { ai = await startAnthropic(); be = await startBackend({ env: ai.env }); });
test.afterAll(async () => { await be?.stop(); await ai?.stop(); });
const nav = (page, name) => page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name, exact: true }).click();

test("AI costs: an estimate from real usage, editable prices, a budget with its alert, Overview and Readiness, CSV; owner only", async ({ page, browser }) => {
  await portalSignIn(page, be, OWNER, "Overview");
  await nav(page, "AI costs");
  await expect(page.getByRole("heading", { level: 1, name: "AI costs" })).toBeFocused();
  await expect(page.locator("[data-estimate-note]")).toHaveText("Estimate only: token totals multiplied by the prices shown. Anthropic's console is the bill of record.");
  await expect(page.locator('[data-stat="ai-month"] b')).toHaveText("$0.00");
  await expect(page.locator("[data-prices-edited]")).toContainText("Never edited here: these are the defaults in the server's config for claude-opus-5-5");
  for (const [label, v] of [["Input, per million tokens (USD)", "4"], ["Output, per million tokens (USD)", "20"], ["Cache writes, per million tokens (USD)", "5"], ["Cache reads, per million tokens (USD)", "0.2"], ["Web searches, per 1,000 (USD)", "10"]]) await expect(page.getByLabel(label)).toHaveValue(v);

  // one real request through the SDK: the weekly report's summary, which the stand-in says used 1M in and 100k out
  ai.state.usage = { input_tokens: 1_000_000, output_tokens: 100_000, cache_read_input_tokens: 500_000, server_tool_use: { web_search_requests: 0 } };
  await nav(page, "Weekly report");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".mail-body")).toContainText("- Estimated AI cost: $0.00 this week");
  await nav(page, "AI costs");
  await expect(page.locator('[data-stat="ai-month"] b')).toHaveText("$6.10"); // $4 + $2 + $0.10
  await expect(page.locator('[data-stat="ai-month"]')).toContainText("Estimate");
  await expect(page.locator('[data-stat="ai-projected"]')).toContainText("Estimated month end");
  await expect(page.locator('[data-stat="ai-person"] b')).toHaveText("–");
  const kinds = page.getByRole("table", { name: "Estimated AI cost by kind" });
  await expect(kinds.locator('tr[data-kind="report"] td')).toHaveText(["1", "1,000,000", "100,000", "500,000", "0", "$6.10"]);
  await expect(kinds.locator("tbody tr")).toHaveCount(5);
  await expect(page.getByRole("table", { name: "Estimated AI cost by day" }).locator("tbody tr").first().locator("td").last()).toHaveText("$6.10");
  await expect(page.getByRole("img", { name: /Estimated cost per day, .*: \$6\.10 in all/ })).toBeVisible();

  // the owner's prices are the ones used
  await page.getByLabel("Input, per million tokens (USD)").fill("5");
  await page.getByRole("button", { name: "Save prices" }).click();
  await expect(page.locator(".msgbox")).toContainText("The prices are saved");
  await expect(page.locator('[data-stat="ai-month"] b')).toHaveText("$7.10");
  await expect(page.locator("[data-prices-edited]")).toContainText("Last edited");
  await page.getByRole("button", { name: "Back to the defaults" }).click();
  await expect(page.locator('[data-stat="ai-month"] b')).toHaveText("$6.10");

  // a budget: validation, then 81% raises the 80% alert once (a development server writes it to its console)
  await page.getByLabel("Budget in US dollars per month").fill("lots");
  await page.getByRole("button", { name: "Save budget" }).click();
  await expect(page.getByRole("alert")).toContainText("Enter the budget as a number above 0");
  await page.getByLabel("Budget in US dollars per month").fill("7.5");
  await page.getByRole("button", { name: "Save budget" }).click();
  await expect(page.locator(".msgbox")).toContainText("The budget is $7.50 a month.");
  await expect(page.locator("[data-budget]")).toHaveAttribute("data-budget", "warn");
  await expect(page.locator("[data-budget]")).toContainText("Past 80% of budget $6.10 of $7.50: 81% of this month's budget.");
  await expect(page.locator("main")).toContainText("Nothing is switched off when the budget is passed. The per-person monthly caps remain the hard limit.");
  await expect.poll(() => (be.log().match(/the alert "Solia Health: the AI cost estimate has passed 80% of this month's budget" was not emailed/g) || []).length).toBe(1);
  await page.reload();
  await expect(page.locator("[data-alerts]")).toContainText("Alerts sent this month: 80% on");
  await page.getByLabel("Budget in US dollars per month").fill("7.6");
  await page.getByRole("button", { name: "Save budget" }).click();
  await expect(page.locator(".msgbox")).toContainText("$7.60");
  await page.waitForTimeout(300);
  expect((be.log().match(/has passed 80%/g) || []).length, "never a second 80% alert in the month").toBe(1);

  // CSV
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
  const csv = fs.readFileSync(await dl.path(), "utf8").trim().split("\n");
  expect(csv[0]).toBe("day_utc,kind,requests,input_tokens,output_tokens,cache_write_tokens,cache_read_tokens,web_searches,estimated_cost_usd");
  expect(csv[1]).toMatch(/^\d{4}-\d\d-\d\d,report,1,1000000,100000,0,500000,0,6\.1000$/);

  // the same state on Overview and on Readiness
  await nav(page, "Overview");
  const card = page.getByRole("region", { name: "AI costs" });
  await expect(card.locator('[data-stat="ov-ai-month"] b')).toHaveText("$6.10");
  await expect(card.locator('[data-stat="ov-ai-budget"]')).toContainText("80%");
  await expect(card).toContainText("An estimate; Anthropic's console is the bill of record.");
  await nav(page, "Readiness");
  await expect(page.locator('[data-row="ai-budget"]')).toHaveAttribute("data-status", "problem");
  await expect(page.locator('[data-row="ai-budget"]')).toContainText("$6.10: 80% of the $7.60 budget, past 80%");
  await expect(page.locator('[data-row="ai"]')).toHaveAttribute("data-status", "ready");

  // what is stored and answered: totals only
  const token = await portalToken(page);
  const raw = await (await fetch(`${be.url}/api/insights/ai-costs`, { headers: { authorization: `Bearer ${token}` } })).text();
  for (const s of ["@", "acct_", "sk-ant-e2e-mock"]) expect(raw).not.toContain(s);

  // a partner: no link, the API answers 403
  expect((await fetch(`${be.url}/api/shop/invites`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ email: "pat@oura.example", brandIds: ["oura"] }) })).status).toBe(201);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pp = await ctx.newPage();
  await portalSignIn(pp, be, "pat@oura.example", "Products");
  await expect(pp.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: "AI costs" })).toHaveCount(0);
  await pp.goto(`${be.url}/portal/#/ai-costs`);
  await expect(pp.getByRole("heading", { level: 1, name: "Products" })).toBeVisible();
  const ptoken = await portalToken(pp);
  for (const [m, p] of [["GET", "/api/insights/ai-costs"], ["GET", "/api/insights/ai-costs.csv"], ["PUT", "/api/insights/ai-costs/budget"]]) expect((await fetch(`${be.url}${p}`, { method: m, headers: { authorization: `Bearer ${ptoken}`, "content-type": "application/json" }, body: m === "PUT" ? JSON.stringify({ usd: 1 }) : undefined })).status).toBe(403);
  await ctx.close();
});
