/* The portal's Readiness page (docs/plans/launch-tools.md Task 1) against a real development backend: one row per
   dependency with its status and the exact variable names, the summary line, the two live checks, the app's side with
   the time of the last app request; no secret value on the page or in the API answer; a partner can't see any of it. */
import { test, expect } from "@playwright/test";
import { startBackend, portalSignIn, portalToken, OWNER } from "./lib/portal.mjs";

const SECRET = "e2e-SECRETVALUE-0123456789abcdef";
let be;
test.beforeAll(async () => { be = await startBackend({ env: { GOOGLE_CLIENT_ID: SECRET, GOOGLE_CLIENT_SECRET: SECRET, FACEBOOK_APP_ID: SECRET, FACEBOOK_APP_SECRET: "", ANTHROPIC_API_KEY: "", OURA_CLIENT_ID: "", OURA_CLIENT_SECRET: "" } }); });
test.afterAll(async () => { await be?.stop(); });

test("Readiness: statuses, exact variable names, the two checks, the app's side; never a value; owner only", async ({ page, browser }) => {
  await portalSignIn(page, be, OWNER, "Overview");
  const links = page.getByRole("navigation", { name: "Portal" }).getByRole("link");
  await expect(links.nth(0)).toHaveText("Overview");
  await expect(links.nth(1)).toHaveText("Readiness");
  await links.nth(1).click();
  await expect(page.getByRole("heading", { level: 1, name: "Readiness" })).toBeFocused();
  await expect(links.nth(1)).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".ready-sum")).toContainText(/^\d+ of 14 ready\. Needed for launch: /);
  await expect(page.locator(".ready-sum")).toContainText("AI");
  const row = (id) => page.locator(`[data-row="${id}"]`);
  await expect(row("auth-secret")).toHaveAttribute("data-status", "ready");
  await expect(row("signin-google")).toHaveAttribute("data-status", "ready");
  await expect(row("signin-google")).toContainText("Optional");
  await expect(row("signin-facebook")).toHaveAttribute("data-status", "problem");
  await expect(row("signin-facebook")).toContainText("FACEBOOK_APP_SECRET is missing");
  await expect(row("signin-facebook").locator(".envlist li")).toHaveText(["FACEBOOK_APP_ID (set)", "FACEBOOK_APP_SECRET (not set)"]);
  await expect(row("ai")).toHaveAttribute("data-status", "not-set-up");
  await expect(row("ai")).toContainText("Required");
  await expect(row("ai").locator(".envlist li")).toHaveText(["ANTHROPIC_API_KEY (not set)"]);
  await expect(row("email").locator(".envlist li")).toHaveText(["RESEND_API_KEY (not set)", "EMAIL_FROM (not set)"]);
  await expect(row("signin-apple").locator(".envlist li")).toHaveText(["APPLE_CLIENT_ID (not set)", "APPLE_TEAM_ID (not set)", "APPLE_KEY_ID (not set)", "APPLE_PRIVATE_KEY (not set)"]);
  await expect(row("storage")).toContainText("Not confirmed yet");
  await expect(row("modules")).toHaveAttribute("data-status", "ready");
  // Apple is listed before Google and Facebook
  const order = await page.locator("[data-row]").evaluateAll((els) => els.map((e) => e.dataset.row));
  expect(order.indexOf("signin-apple")).toBeLessThan(order.indexOf("signin-google"));
  await expect(page.locator("[data-modules]")).toContainText("insights");

  // the app's side: nothing yet, then a request from an app origin shows as a time
  await expect(page.locator("[data-app-seen]")).toContainText("No request from an app origin since this server started.");
  await expect(page.getByRole("table", { name: "The app's build settings" }).locator("tbody tr").first()).toContainText("VITE_API_BASE");
  await fetch(`${be.url}/api/shop/catalog`, { headers: { origin: "https://app.solia.example" } });
  await page.reload();
  await expect(page.locator("[data-app-seen]")).toContainText("Last request from an app origin:");
  expect(await page.locator("[data-app-seen]").getAttribute("data-app-seen")).toMatch(/^\d{4}-\d\d-\d\dT/);

  // the two live checks
  await page.getByRole("button", { name: "Check storage" }).click();
  await expect(page.locator("#ready-disk-out")).toContainText("Storage works: a test file was written, read back and deleted");
  await page.getByRole("button", { name: "Send me a test email" }).click();
  await expect(page.locator(".msgbox")).toContainText("Development server: email isn't set up here, so nothing was sent.");

  // no value anywhere: the page, the API answer, the server's log
  const token = await portalToken(page);
  const raw = await (await fetch(`${be.url}/api/insights/readiness`, { headers: { authorization: `Bearer ${token}` } })).text();
  for (const s of [SECRET, "SECRETVALUE", "portal-e2e-secret", "portal-e2e-admin"]) { expect(raw).not.toContain(s); expect(await page.locator("body").innerText()).not.toContain(s); expect(be.log()).not.toContain(s); }

  // a partner: no link, the route falls back, the API answers 403
  expect((await fetch(`${be.url}/api/shop/invites`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ email: "pat@oura.example", brandIds: ["oura"] }) })).status).toBe(201);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pp = await ctx.newPage();
  await portalSignIn(pp, be, "pat@oura.example", "Products");
  await expect(pp.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: "Readiness" })).toHaveCount(0);
  await pp.goto(`${be.url}/portal/#/readiness`);
  await expect(pp.getByRole("heading", { level: 1, name: "Products" })).toBeVisible();
  const ptoken = await portalToken(pp);
  expect((await fetch(`${be.url}/api/insights/readiness`, { headers: { authorization: `Bearer ${ptoken}` } })).status).toBe(403);
  expect((await fetch(`${be.url}/api/insights/readiness/storage-check`, { method: "POST", headers: { authorization: `Bearer ${ptoken}` } })).status).toBe(403);
  await ctx.close();
});
