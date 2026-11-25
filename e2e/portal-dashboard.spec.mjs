/* Organization dashboards (docs/plans/upgrade-enterprise.md Task 4) against a real development backend: an org admin (an
   email listed on the organization) signs in to the same portal and sees ONLY its organization's totals, with any number
   under 10 as "fewer than 10"; no names, emails or health data; owner pages and another organization are refused on the
   server. An owner sees every organization's dashboard. */
import { test, expect } from "@playwright/test";
import { startBackend, portalSignIn, portalToken, OWNER } from "./lib/portal.mjs";

let be;
test.beforeAll(async () => { be = await startBackend(); });
test.afterAll(async () => { await be?.stop(); });
const THEME = { primary: "#2F5D50", accent: "#8A4E18", dark: { primary: "#8AC2B0", accent: "#D8A96A" } };
const nav = (page) => page.getByRole("navigation", { name: "Portal" }).getByRole("link");
const call = (method, p, body, token) => fetch(`${be.url}${p}`, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });

test("an org admin sees only its organization's totals; an owner sees every one", async ({ page, browser }) => {
  // the owner sets up two organizations
  const op = await browser.newPage();
  await portalSignIn(op, be, OWNER, "Overview");
  const owner = await portalToken(op);
  expect((await call("POST", "/api/orgs", { slug: "lakeside", name: "Lakeside Clinic", theme: THEME, stages: ["peri", "meno"], inviteCode: "LAKE2026", admins: ["ana@lakeside.example"] }, owner)).status).toBe(201);
  expect((await call("POST", "/api/orgs", { slug: "harbor", name: "Harbor Works", theme: THEME, inviteCode: "HARB2026", admins: ["hal@harbor.example"] }, owner)).status).toBe(201);
  for (let i = 0; i < 3; i++) await call("POST", "/api/orgs/join", { code: "LAKE2026" });

  await portalSignIn(page, be, "ana@lakeside.example", "Lakeside Clinic dashboard");
  await expect(page.locator("#who")).toContainText("Organization admin");
  await expect(nav(page)).toHaveText(["Dashboard"]);
  const dash = page.locator('[data-dash="lakeside"]');
  await expect(dash.locator('[data-stat="joined"] b')).toHaveText("fewer than 10");
  await expect(dash.locator('[data-stat="signed-in"] b')).toHaveText("fewer than 10");
  await expect(dash.locator('[data-stat="pro"] b')).toHaveText("not available"); // RevenueCat isn't set up on this server
  await expect(dash.getByRole("region", { name: "Lakeside Clinic: joins per week" }).locator("tbody tr")).toHaveCount(12);
  // 10 joins this week (the join limit is 10 a minute from one address): the totals now show
  for (let i = 0; i < 7; i++) expect((await call("POST", "/api/orgs/join", { slug: "lakeside" })).status).toBe(200);
  await page.reload();
  await expect(dash.locator('[data-stat="joined"] b')).toHaveText("10");
  await expect(dash.locator("tbody tr").last().locator("td")).toHaveText("10");
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/@|LAKE2026|Harbor/);
  // owner pages and the other organization: the page doesn't open them and the server refuses them
  for (const hash of ["#/orgs", "#/settings", "#/people", "#/products", "#/dashboard/harbor"]) {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(/Organizations|App settings|People|Products|Harbor/);
  }
  const ana = await portalToken(page);
  for (const [m, p] of [["GET", "/api/orgs/harbor/stats"], ["GET", "/api/orgs"], ["GET", "/api/settings"], ["GET", "/api/insights/people"], ["GET", "/api/shop/products"], ["GET", "/api/subscriptions/codes"]]) {
    expect((await call(m, p, undefined, ana)).status, `${m} ${p}`).toBe(403);
  }
  // the owner sees both organizations' dashboards
  await op.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: "Dashboards", exact: true }).click();
  await expect(op.getByRole("heading", { level: 1, name: "Organization dashboards" })).toBeVisible();
  await expect(op.locator("[data-dash]")).toHaveCount(2);
  await expect(op.locator('[data-dash="lakeside"] [data-stat="joined"] b')).toHaveText("10");
  await expect(op.locator('[data-dash="harbor"] [data-stat="joined"] b')).toHaveText("fewer than 10");
  await op.close();
});
