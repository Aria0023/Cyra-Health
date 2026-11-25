/* The portal's Organizations (docs/plans/upgrade-enterprise.md Task 3) against a real development backend: an owner creates
   one (colours checked on the page and the server), edits its lineup and uploads a logo; the public config carries no
   invite code or admins; joining by code counts one; a partner has no Organizations page and the API refuses it. */
import { test, expect } from "@playwright/test";
import { startBackend, portalSignIn, portalToken, OWNER, PNG_1PX } from "./lib/portal.mjs";

let be;
test.beforeAll(async () => { be = await startBackend(); });
test.afterAll(async () => { await be?.stop(); });
const nav = (page, name) => page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name, exact: true });

test("owner: create an organization, check its colours, lineup and logo; the app's config and join", async ({ page }) => {
  await portalSignIn(page, be, OWNER, "Overview");
  await nav(page, "Organizations").click();
  await expect(page.getByRole("heading", { level: 1, name: "Organizations" })).toBeFocused();
  await expect(page.getByText("No organizations yet.")).toBeVisible();
  await page.getByRole("link", { name: "New organization" }).click();
  await expect(nav(page, "Organizations")).toHaveAttribute("aria-current", "page");
  // Solia's own colours are filled in and pass
  await expect(page.locator("#org-primary-check")).toContainText("passes AA (4.5:1)");
  await page.getByLabel("Name", { exact: true }).fill("Lakeside Clinic");
  await page.getByLabel("Slug", { exact: true }).fill("lakeside");
  await page.getByLabel("Primary, light").fill("#FFD6E0");
  await expect(page.locator("#org-primary-check")).toContainText("below AA (4.5:1)");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByRole("alert")).toHaveText("Fix the colours marked below first: each needs 4.5:1 on the page and the card.");
  await page.getByLabel("Primary, light").fill("#2F5D50");
  for (const l of ["My Cycle", "Trying to conceive", "Pregnant"]) await page.locator("fieldset", { hasText: "Life stages it offers" }).getByLabel(l, { exact: true }).uncheck();
  await page.getByLabel("Show the whole Shop").uncheck();
  await page.locator('input[name="org-lineup"][value="midi"]').check();
  await page.getByLabel("Invite code").fill("LAKE2026");
  await page.getByLabel("Admin emails, one per line").fill("ana@lakeside.example");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Lakeside Clinic" })).toBeVisible();
  await expect(page.locator(".msgbox .ok")).toHaveText("Created Lakeside Clinic. Its invite code is LAKE2026.");
  await expect(page.locator("main")).toContainText("Your organization sees how many people joined, never what you log.");
  await page.locator("#org-logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG_1PX });
  await page.getByRole("button", { name: "Upload logo" }).click();
  await expect(page.locator(".msgbox .ok")).toHaveText("Logo uploaded.");
  await expect(page.getByRole("img", { name: "Lakeside Clinic logo" })).toBeVisible();
  // the server checks colours too
  const token = await portalToken(page);
  const r = await fetch(`${be.url}/api/orgs/lakeside`, { method: "PATCH", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ theme: { primary: "#FFD6E0", accent: "#8A4E18", dark: { primary: "#8AC2B0", accent: "#D8A96A" } } }) });
  expect(r.status).toBe(400);
  // what the app gets: no invite code, no admins
  const cfg = await (await fetch(`${be.url}/api/orgs/lakeside/config`)).json();
  expect(cfg).toMatchObject({ slug: "lakeside", name: "Lakeside Clinic", stages: ["peri", "meno"], partnerIds: ["midi"], poweredBy: "Solia Health" });
  expect(cfg.logo).toMatch(/^data:image\/png;base64,/);
  expect(JSON.stringify(cfg)).not.toMatch(/LAKE2026|ana@/);
  const j = await fetch(`${be.url}/api/orgs/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "LAKE2026" }) });
  expect(j.status).toBe(200);
  await nav(page, "Organizations").click();
  await expect(page.locator('[data-org="lakeside"]')).toContainText("invite code LAKE2026");
});

test("a partner has no Organizations page, and the API refuses it", async ({ page }) => {
  const owner = await (async () => { const p2 = await page.context().newPage(); await portalSignIn(p2, be, OWNER, "Overview"); const t = await portalToken(p2); await p2.close(); return t; })();
  await fetch(`${be.url}/api/shop/invites`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${owner}` }, body: JSON.stringify({ email: "pat@oura.example", brandIds: ["oura"] }) });
  await portalSignIn(page, be, "pat@oura.example", "Products");
  await expect(nav(page, "Organizations")).toHaveCount(0);
  const t = await portalToken(page);
  for (const [m, p] of [["GET", "/api/orgs"], ["POST", "/api/orgs"], ["PATCH", "/api/orgs/lakeside"]]) {
    expect((await fetch(`${be.url}${p}`, { method: m, headers: { "content-type": "application/json", authorization: `Bearer ${t}` }, body: m === "GET" ? undefined : "{}" })).status, `${m} ${p}`).toBe(403);
  }
  expect((await fetch(`${be.url}/api/orgs`, { method: "POST", headers: { "content-type": "application/json", "x-admin-key": "portal-e2e-admin-0123456789abcdef" }, body: JSON.stringify({ slug: "x-y-z", name: "X" }) })).status, "the admin key opens nothing").toBe(401);
});
