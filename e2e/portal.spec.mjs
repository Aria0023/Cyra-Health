/* The partner portal (docs/plans/partner-portal.md Task 2) against a real development backend started for this file
   (e2e/lib/portal.mjs): the public "Apply to partner" form; the owner's sign-in, approval, a new product set up and
   published, and the CSV export; an invited partner who sees only its brand, edits and submits but can't publish or set
   the evidence, with the live catalog unchanged until the owner publishes. */
import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { startBackend, portalSignIn, OWNER, PNG_1PX } from "./lib/portal.mjs";

let be;
test.beforeAll(async () => { be = await startBackend(); });
test.afterAll(async () => { await be?.stop(); });
const catalog = async () => (await fetch(`${be.url}/api/shop/catalog`)).json();

test("apply, then the owner approves, sets up a product, publishes it, and exports CSV", async ({ page }) => {
  // the public form
  await page.goto(`${be.url}/portal/apply`);
  await expect(page.getByRole("heading", { level: 1, name: "Apply to partner with Solia Health" })).toBeVisible();
  await page.getByLabel("Company").fill("Lumen Sleep");
  await page.getByLabel("Contact email").fill("hi@lumen.example");
  await page.getByLabel("Category").selectOption("sleep");
  await page.getByLabel("Website (https://)").fill("http://lumen.com/");
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(page.getByRole("alert")).toContainText("must start with https://");
  await page.getByLabel("Website (https://)").fill("https://lumen.com/");
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Thanks: your application was received" })).toBeFocused();
  await expect(page.locator("main")).toContainText("If it's approved, hi@lumen.example is invited to this portal.");

  // the owner
  await portalSignIn(page, be, OWNER, "Overview");
  await expect(page.locator(".who")).toContainText(`Signed in as ${OWNER} · Owner`);
  await expect(page.getByRole("navigation", { name: "Portal" }).getByRole("link")).toHaveText(["Overview", "Readiness", "Products", "Brands", "Applications", "Partners", "Subscriptions", "Promotions", "Pro grants", "Codes", "Clicks", "People", "Affiliates", "Weekly report", "AI costs", "Feedback", "Activity"]);
  await expect(page.locator(".stats").first()).toContainText("Applications waiting");
  await page.getByRole("link", { name: "Review applications" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Applications" })).toBeFocused();
  await page.getByRole("button", { name: "Approve Lumen Sleep" }).click();
  await expect(page.locator(".msgbox")).toContainText("Approved: Lumen Sleep was created and hi@lumen.example was invited.");
  await page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: "Partners", exact: true }).click();
  await expect(page.locator('[data-partner="hi@lumen.example"]')).toContainText("Invited");

  // a new product for the new brand
  await page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: "Products", exact: true }).click();
  await page.getByRole("button", { name: "New product" }).click();
  await page.getByLabel("Brand").selectOption({ label: "Lumen Sleep" });
  await page.getByLabel("Product name").fill("Lumen sleep mask");
  await page.getByLabel("Product page (https://)").fill("https://lumen.com/mask");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Lumen sleep mask" })).toBeVisible();
  const preview = page.getByRole("group", { name: "Preview: the product card in the app" });
  await expect(preview.locator(".sname")).toHaveText("Lumen sleep mask");
  await page.getByLabel("What it covers (one line)").fill("Blocks light while you sleep");
  await expect(preview).toContainText("Blocks light while you sleep");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("alert")).toContainText("Needs a category before it can be published.");
  await page.getByRole("group", { name: /Needs/ }).getByLabel("Sleep").check();
  await page.getByLabel("Evidence", { exact: true }).selectOption("comfort");
  await page.getByLabel("Evidence label").fill("Comfort, not a treatment");
  await page.getByLabel("Why (one plain line)").fill("A dark room helps many people fall asleep.");
  await expect(preview.locator(".ev")).toContainText("Comfort, not a treatment");
  await expect(preview.getByText("Affiliate link")).toHaveCount(0);
  await page.getByLabel("Affiliate link (https://, optional)").fill("https://lumen.com/mask?aff=solia");
  await expect(preview.getByText("Affiliate link")).toBeVisible();
  await expect(preview).toContainText("may earn a commission");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.locator(".msgbox")).toContainText("Published: this version is live in the app's catalog.");
  const c = await catalog();
  const live = c.products.find((p) => p.name === "Lumen sleep mask");
  expect(live).toMatchObject({ categories: ["sleep"], affiliateUrl: "https://lumen.com/mask?aff=solia", evidence: { tone: "comfort", label: "Comfort, not a treatment" } });
  expect(c.brands.map((b) => b.name)).toContain("Lumen Sleep");

  // CSV export and the activity log
  await page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: "Products", exact: true }).click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
  expect(dl.suggestedFilename()).toBe("shop-products.csv");
  const csv = await fs.promises.readFile(await dl.path(), "utf8");
  expect(csv.split("\r\n")[0]).toMatch(/^id,brand,name,status,live/);
  expect(csv).toContain("Lumen sleep mask");
  await page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: "Activity", exact: true }).click();
  await expect(page.locator(".audit")).toContainText(`${OWNER} publish`);
  await expect(page.locator(".audit")).toContainText("public apply");
});

test("a partner sees only its brand, can edit and submit, but never publish or set the evidence", async ({ page, browser }) => {
  // the owner invites a partner from the brand page
  await portalSignIn(page, be, OWNER, "Overview");
  await page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: "Brands", exact: true }).click();
  await page.locator('[data-brand="oura"]').getByRole("link", { name: "Oura" }).click();
  await page.getByLabel("Their work email").fill("pat@oura.example");
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.locator(".msgbox")).toContainText("Invited pat@oura.example.");

  const ctx = await browser.newContext();
  const pp = await ctx.newPage();
  await portalSignIn(pp, be, "pat@oura.example", "Products");
  await expect(pp.locator(".who")).toContainText("Partner");
  await expect(pp.getByRole("navigation", { name: "Portal" }).getByRole("link")).toHaveText(["Products", "Brands", "Codes", "Clicks"]);
  await expect(pp.locator(".row")).toHaveCount(1);
  await pp.getByRole("link", { name: "Oura Ring" }).click();
  await expect(pp.getByRole("heading", { level: 1, name: "Oura Ring" })).toBeFocused();
  // owner-only fields are shown read-only, never as controls; no publish actions
  await expect(pp.locator(".locked")).toContainText("Set by Solia Health");
  await expect(pp.locator(".locked")).toContainText("Mixed evidence: Useful trends, not a diagnosis");
  for (const name of [/Needs/, "Evidence label", "Why (one plain line)", "Clinician review"]) await expect(pp.getByLabel(name)).toHaveCount(0);
  for (const name of ["Publish", "Unpublish", "Archive"]) await expect(pp.getByRole("button", { name, exact: true })).toHaveCount(0);
  // edit, with an image, and the preview follows
  await pp.getByLabel("Product name").fill("Oura Ring 4");
  await pp.getByLabel("Price (optional)").fill("From $349");
  const preview = pp.getByRole("group", { name: "Preview: the product card in the app" });
  await expect(preview.locator(".sname")).toHaveText("Oura Ring 4");
  await expect(preview.locator(".shopprice")).toHaveText("From $349");
  await pp.getByLabel("Product image").setInputFiles({ name: "ring.png", mimeType: "image/png", buffer: PNG_1PX });
  await expect(pp.locator(".msgbox")).toContainText("Image uploaded");
  await expect(preview.locator(".shopimg img")).toHaveCount(1);
  await pp.getByRole("button", { name: "Save changes" }).click();
  await expect(pp.locator(".msgbox")).toContainText("The app keeps showing the last published version until this one is published.");
  await pp.getByRole("button", { name: "Submit for review" }).click();
  await expect(pp.locator(".msgbox")).toContainText("Sent for review.");
  expect((await catalog()).products.find((p) => p.id === "oura").name).toBe("Oura Ring");
  // the server refuses the owner-only actions to a partner even if asked directly
  const direct = await pp.evaluate(async () => {
    const { token } = JSON.parse(sessionStorage.getItem("solia.portal"));
    const call = (m, p, b) => fetch(`/api/shop${p}`, { method: m, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.status);
    return [await call("POST", "/products/oura/publish", {}), await call("PATCH", "/products/oura", { evidence: { tone: "strong", label: "Strong evidence" } }), await call("PATCH", "/products/oura", { clinicianStatus: "signed" }), await call("PATCH", "/products/whoop", { name: "x" })];
  });
  expect(direct).toEqual([403, 403, 403, 404]);
  await ctx.close();

  // the owner sees it waiting and publishes
  await page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: "Overview", exact: true }).click();
  await page.locator('[data-product="oura"]').getByRole("link").click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.locator(".msgbox")).toContainText("Published");
  const live = (await catalog()).products.find((p) => p.id === "oura");
  expect(live.name).toBe("Oura Ring 4"); expect(live.price).toBe("From $349"); expect(live.imageId).toMatch(/^[a-f0-9]{24}$/);
  const img = await fetch(`${be.url}/api/shop/images/${live.imageId}`);
  expect(img.headers.get("content-type")).toBe("image/png");
});

test("signing out ends the session; a stranger's address gets the same screen and no code", async ({ page }) => {
  await portalSignIn(page, be, OWNER, "Overview");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to the partner portal" })).toBeVisible();
  await expect(page.getByText("You're signed out.")).toBeVisible();
  await page.getByLabel("Work email").fill("stranger@else.example");
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Enter your code" })).toBeVisible();
  await expect(page.locator("main")).toContainText("If stranger@else.example has access to the portal");
  expect(be.codeFor("stranger@else.example")).toBeNull();
});
