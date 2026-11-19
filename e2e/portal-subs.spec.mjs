/* The portal's subscriptions screens (docs/plans/portal-subscriptions.md Task 2) against a real development backend
   (e2e/lib/portal.mjs) and a mocked RevenueCat (e2e/lib/revenuecat.mjs): the owner's Subscriptions dashboard, a promotion
   made with its live banner preview and started (then in the public list), Pro grants (granted, no account yet, revoked),
   a code batch assigned to a partner's brand; the partner, who sees only Products, Brands and its own Codes and gets 403
   from every other subscriptions route; and a server without RevenueCat's variables, which names them. */
import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { startBackend, portalSignIn, portalToken, appAccount, OWNER } from "./lib/portal.mjs";
import { startRevenueCat } from "./lib/revenuecat.mjs";

const pad = (n) => String(n).padStart(2, "0");
const localInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const nav = (page, n) => page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: n, exact: true });

let be, rc;
test.beforeAll(async () => { rc = await startRevenueCat(); be = await startBackend({ env: rc.env }); });
test.afterAll(async () => { await be?.stop(); await rc?.stop(); });

test("owner: subscriptions, a promotion with its preview, Pro grants and codes; a partner sees only its own codes", async ({ page, browser }) => {
  await portalSignIn(page, be, OWNER, "Overview");
  await expect(page.getByRole("navigation", { name: "Portal" }).getByRole("link")).toHaveText(["Overview", "Products", "Brands", "Applications", "Partners", "Subscriptions", "Promotions", "Pro grants", "Codes", "Clicks", "People", "Activity"]);

  // Subscriptions: RevenueCat's numbers, read-only
  await nav(page, "Subscriptions").click();
  await expect(page.getByRole("heading", { level: 1, name: "Subscriptions" })).toBeFocused();
  await expect(page.locator('[data-metric="active_subscriptions"]')).toContainText("42");
  await expect(page.locator('[data-metric="active_subscriptions"]')).toContainText("Active subscriptions");
  await expect(page.locator('[data-metric="mrr"]')).toContainText("$315.50");
  await expect(page.locator("main")).toContainText("Churn isn't in RevenueCat's overview numbers");
  await expect(page.locator("main")).toContainText("RevenueCat last updated these");

  // Promotions: a new one, its banner preview, the no-price rule, start
  await nav(page, "Promotions").click();
  await expect(page.locator("main")).toContainText("No promotions yet.");
  await page.getByRole("link", { name: "New promotion" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "New promotion" })).toBeVisible();
  await page.getByLabel("Name (only owners see it)").fill("Clinic pilot (Dr Lee)");
  await page.getByLabel("RevenueCat offering identifier").selectOption("spring_clinic");
  await page.getByRole("radio", { name: /People at certain life stages/ }).check();
  await page.getByRole("checkbox", { name: "Perimenopause" }).check();
  await page.getByLabel("Starts").fill(localInput(new Date(Date.now() - 3_600_000)));
  await page.getByLabel("Ends").fill(localInput(new Date(Date.now() + 10 * 86_400_000)));
  await page.getByLabel("Banner title (up to 40 characters)").fill("Half price, $4.99");
  await page.getByLabel("Banner text (up to 120 characters)").fill("A longer free trial on the yearly plan.");
  const preview = page.locator("#pr-preview");
  await expect(preview).toContainText("Half price, $4.99");
  await expect(preview).toContainText("Price from the store");
  await page.getByRole("button", { name: "Save as draft" }).click();
  await expect(page.getByRole("alert")).toContainText("can't name a price or a percentage");
  await page.getByLabel("Banner title (up to 40 characters)").fill("A calmer start");
  await expect(page.locator("#pr-title-count")).toHaveText("14 of 40 characters");
  await page.getByRole("button", { name: "Save as draft" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Clinic pilot (Dr Lee)" })).toBeVisible();
  await expect(page.locator("#promoform .badge")).toHaveText("Draft");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.locator(".msgbox")).toContainText("Started: it's live in the app now.");
  await expect(page.locator("#promoform .badge")).toHaveText("Live");
  const pub = await (await fetch(`${be.url}/api/promotions/active`)).json();
  expect(pub.promotions.map((p) => [p.offeringId, p.audience.stages.join(), p.banner.title])).toEqual([["spring_clinic", "peri", "A calmer start"]]);
  expect(JSON.stringify(pub)).not.toContain("Dr Lee");
  await page.getByRole("link", { name: "All promotions" }).click();
  await expect(page.locator("[data-promotion] .badge")).toHaveText("Live");

  // Pro grants: one with an account, one without; revoke
  const maya = await appAccount(be, "maya@clinic.example");
  await nav(page, "Pro grants").click();
  await page.getByLabel("Account emails").fill("maya@clinic.example\nnobody@clinic.example");
  await page.getByLabel("For", { exact: true }).selectOption("three_month");
  await page.getByLabel("Note (only owners see it)").fill("Clinic pilot");
  await page.getByRole("button", { name: "Give Pro" }).click();
  await expect(page.locator(".msgbox")).toContainText("Done: 1 granted, 0 waiting for a first sign-in, 1 with no account yet, 0 failed.");
  await expect(page.locator('[data-result="maya@clinic.example"]')).toContainText("Granted");
  await expect(page.locator('[data-result="nobody@clinic.example"]')).toContainText("No account yet: invite them to sign up");
  expect(rc.calls.some((c) => c.url === `/v1/subscribers/${maya.id}/entitlements/pro/promotional` && JSON.parse(c.body).duration === "three_month" && !c.body.includes("@"))).toBe(true);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Revoke Pro for maya@clinic.example" }).click();
  await expect(page.locator(".msgbox")).toContainText("Revoked Pro for maya@clinic.example.");
  await expect(page.locator("[data-grant]").first()).toContainText("Revoked");
  // queued for a first sign-in
  await page.getByLabel("Account emails").fill("later@clinic.example");
  await page.getByRole("checkbox", { name: /give it to them at their first sign-in/ }).check();
  await page.getByRole("button", { name: "Give Pro" }).click();
  await expect(page.locator(".msgbox")).toContainText("1 waiting for a first sign-in");
  await expect(page.locator("main")).toContainText("later@clinic.example");

  // Codes: a batch for Oura, then a partner
  const owner = await portalToken(page);
  expect((await fetch(`${be.url}/api/shop/invites`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${owner}` }, body: JSON.stringify({ email: "pat@oura.example", brandIds: ["oura"] }) })).status).toBe(201);
  await nav(page, "Codes").click();
  await page.getByLabel("Label").fill("Oura spring");
  await page.getByLabel("Store", { exact: true }).selectOption("ios");
  await page.getByLabel("Store offer they belong to").fill("oura_spring_3m");
  await page.getByLabel("Partner (brand)").selectOption("oura");
  await page.getByLabel("Codes, one per line").first().fill("OURA-E2E-0001\nOURA-E2E-0002\nOURA-E2E-0003\nnot a code");
  await page.getByRole("button", { name: "Upload codes" }).click();
  await expect(page.locator(".msgbox")).toContainText("Uploaded 3 codes. 1 lines weren't codes and were skipped.");
  await expect(page.locator("[data-batch]")).toContainText("3 available · 0 given out · 0 marked redeemed");
  await page.getByLabel("Mark as").selectOption("redeemed");
  await page.locator("#cm-codes").fill("OURA-E2E-0002");
  await page.getByRole("button", { name: "Mark", exact: true }).click();
  await expect(page.locator(".msgbox")).toContainText("Marked 1 codes.");
  await expect(page.locator("main")).toContainText("Apple and Google don't tell this portal which code was used");

  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", acceptDownloads: true });
  const pp = await pctx.newPage();
  try {
    await portalSignIn(pp, be, "pat@oura.example", "Products");
    await expect(pp.getByRole("navigation", { name: "Portal" }).getByRole("link")).toHaveText(["Products", "Brands", "Codes", "Clicks"]);
    await nav(pp, "Codes").click();
    await expect(pp.getByRole("heading", { level: 1, name: "Codes" })).toBeFocused();
    await expect(pp.locator(".stats")).toContainText("2Available");
    await expect(pp.locator(".stats")).toContainText("1Marked redeemed");
    await expect(pp.locator("table")).toContainText("OURA-E2E-0001");
    await expect(pp.locator("table")).not.toContainText("OURA-E2E-0002");
    const dl = pp.waitForEvent("download");
    await pp.getByRole("button", { name: "Download my available codes (CSV)" }).click();
    const csv = fs.readFileSync(await (await dl).path(), "utf8");
    expect(csv).toContain("OURA-E2E-0001");
    expect(csv).not.toContain("OURA-E2E-0002");
    // a partner never reaches the owner's screens or routes
    await pp.goto(`${be.url}/portal/#/grants`);
    await expect(pp.getByRole("heading", { level: 1, name: "Products" })).toBeVisible();
    const pt = await portalToken(pp);
    for (const p of ["/metrics", "/promotions", "/grants", "/config", "/offerings"]) expect((await fetch(`${be.url}/api/subscriptions${p}`, { headers: { authorization: `Bearer ${pt}` } })).status, p).toBe(403);
  } finally { await pctx.close(); }

  // every grant and code change is in Activity
  await nav(page, "Activity").click();
  for (const a of ["grant", "revoke grant", "upload codes", "start"]) await expect(page.locator(".audit")).toContainText(` ${a} `);
});

test("without RevenueCat's variables the portal names them and grants are off", async ({ page }) => {
  const plain = await startBackend();
  try {
    await portalSignIn(page, plain, OWNER, "Overview");
    await nav(page, "Subscriptions").click();
    await expect(page.getByRole("heading", { level: 2, name: "RevenueCat isn't connected to this server yet" })).toBeVisible();
    await expect(page.locator(".envlist")).toContainText("REVENUECAT_SECRET_KEY (not set)");
    await expect(page.locator(".envlist")).toContainText("REVENUECAT_PROJECT_ID (not set)");
    await nav(page, "Pro grants").click();
    await expect(page.getByRole("button", { name: "Give Pro" })).toBeDisabled();
    await nav(page, "Promotions").click();
    await page.getByRole("link", { name: "New promotion" }).click();
    await expect(page.getByLabel("RevenueCat offering identifier")).toHaveAttribute("type", "text");
  } finally { await plain.stop(); }
});
