/* axe-core on the portal's enterprise pages (docs/plans/upgrade-enterprise.md), light and dark, phone and wide, against a
   real development backend (e2e/lib/portal.mjs): App settings empty, with a form error and after saves (the change log); Organizations empty, a
   new one with a colour below AA, and a created one with its logo (Task 3); Dashboards for an owner and an organization's
   admin, phone and wide (Task 4).
   Every target is checked at 44px. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { startBackend, portalSignIn, OWNER } from "./lib/portal.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const audit = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
  const small = await page.evaluate(() => [...document.querySelectorAll("main button, main a.btn, main select, main input:not([type=checkbox]):not([type=file]):not([tabindex='-1']), main textarea, main summary, #nav a, .who button")]
    .filter((el) => el.offsetParent !== null).map((el) => { const r = el.getBoundingClientRect(); return { t: el.textContent.trim().slice(0, 30) || el.id, h: r.height }; }).filter((x) => x.h < 44));
  expect(small, `${name}: targets under 44px`).toEqual([]);
};
const nav = (page, name) => page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name, exact: true }).click();

for (const scheme of ["light", "dark"]) {
  test(`portal App settings, ${scheme}`, async ({ browser }) => {
    const be = await startBackend();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    try {
      await portalSignIn(page, be, OWNER, "Overview");
      await nav(page, "App settings");
      await expect(page.getByRole("heading", { level: 1, name: "App settings" })).toBeVisible();
      await audit(page, `App settings, empty ${scheme}`);
      await page.getByLabel("Announcement", { exact: true }).fill("");
      await page.getByLabel("Show it on Home").check();
      await page.getByRole("button", { name: "Save announcement" }).click();
      await expect(page.getByRole("alert")).toBeVisible();
      await audit(page, `App settings, an error ${scheme}`);
      await page.getByLabel("Announcement", { exact: true }).fill("New sleep picks in the Shop.");
      await page.getByRole("button", { name: "Save announcement" }).click();
      await expect(page.locator(".msgbox .ok")).toHaveText("Announcement saved and on.");
      await page.getByLabel("Line 1").fill("Ask your clinic about its own visits.");
      await page.getByRole("button", { name: "Save Help lines" }).click();
      await expect(page.locator(".msgbox .ok")).toHaveText("Help lines saved.");
      await expect(page.getByRole("region", { name: "Change log" }).locator("tbody tr")).toHaveCount(2);
      await audit(page, `App settings, saved ${scheme}`);
      await page.setViewportSize({ width: 1200, height: 900 });
      await audit(page, `App settings, wide ${scheme}`);
      await page.setViewportSize({ width: 390, height: 844 });
      // Organizations (Task 3): the empty list, the form with a colour below AA, a created organization with its logo
      await nav(page, "Organizations");
      await expect(page.getByRole("heading", { level: 1, name: "Organizations" })).toBeVisible();
      await audit(page, `Organizations, empty ${scheme}`);
      await page.getByRole("link", { name: "New organization" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "New organization" })).toBeVisible();
      await page.getByLabel("Name", { exact: true }).fill("Lakeside Clinic");
      await page.getByLabel("Slug", { exact: true }).fill("lakeside");
      await page.getByLabel("Primary, light").fill("#FFD6E0");
      await expect(page.locator("#org-primary-check")).toContainText("below AA");
      await page.getByRole("button", { name: "Create organization" }).click();
      await expect(page.getByRole("alert")).toBeVisible();
      await audit(page, `New organization, a colour below AA ${scheme}`);
      await page.getByLabel("Primary, light").fill("#2F5D50");
      await page.getByRole("button", { name: "Create organization" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Lakeside Clinic" })).toBeVisible();
      await page.locator("#org-logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
      await page.getByRole("button", { name: "Upload logo" }).click();
      await expect(page.locator(".msgbox .ok")).toHaveText("Logo uploaded.");
      await audit(page, `Organization with a logo ${scheme}`);
      // Dashboards (Task 4): an owner's view of every organization, then its admin's own
      await page.locator("#who").getByRole("button", { name: "Sign out" }).waitFor();
      await nav(page, "Dashboards");
      await expect(page.locator("[data-dash]")).toHaveCount(1);
      await audit(page, `Dashboards, owner ${scheme}`);
      const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem("solia.portal")).token);
      await fetch(`${be.url}/api/orgs/lakeside`, { method: "PATCH", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ admins: ["ana@lakeside.example"] }) });
      await page.locator("#who").getByRole("button", { name: "Sign out" }).click();
      await portalSignIn(page, be, "ana@lakeside.example", "Lakeside Clinic dashboard");
      await audit(page, `Dashboard, org admin ${scheme}`);
      await page.setViewportSize({ width: 1200, height: 900 });
      await audit(page, `Dashboard, org admin, wide ${scheme}`);
    } finally { await ctx.close(); await be.stop(); }
  });
}
