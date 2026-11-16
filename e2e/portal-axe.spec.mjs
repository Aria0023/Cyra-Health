/* axe-core on the partner portal (docs/plans/partner-portal.md Task 2), light and dark, phone and wide: sign-in, the
   code step, the owner's overview, products, product editor with its preview, brand page, partners, applications and
   activity, the public "Apply to partner" form, and a partner's product editor. A real development backend per scheme
   (e2e/lib/portal.mjs). Every target is checked at 44px. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { startBackend, portalSignIn, OWNER } from "./lib/portal.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const audit = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
  const small = await page.evaluate(() => [...document.querySelectorAll("main button, main a.btn, main select, main input:not([type=checkbox]):not([type=file]):not([tabindex='-1']), #nav a, .who button")]
    .filter((el) => el.offsetParent !== null && !el.closest(".honey")).map((el) => { const r = el.getBoundingClientRect(); return { t: el.textContent.trim().slice(0, 30) || el.id, h: r.height }; }).filter((x) => x.h < 44));
  expect(small, `${name}: targets under 44px`).toEqual([]);
};

for (const scheme of ["light", "dark"]) {
  test(`partner portal, ${scheme}`, async ({ browser }) => {
    const be = await startBackend();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    try {
      await page.goto(`${be.url}/portal/apply`);
      await expect(page.getByRole("heading", { level: 1, name: "Apply to partner with Solia Health" })).toBeVisible();
      await audit(page, `apply ${scheme}`);
      await page.getByLabel("Company").fill("Lumen Sleep");
      await page.getByLabel("Contact email").fill("hi@lumen.example");
      await page.getByLabel("Website (https://)").fill("https://lumen.com/");
      await page.getByRole("button", { name: "Send application" }).click();
      await expect(page.getByRole("heading", { level: 1, name: /application was received/ })).toBeVisible();
      await audit(page, `apply sent ${scheme}`);

      await page.goto(`${be.url}/portal/`);
      await expect(page.getByRole("heading", { level: 1, name: "Sign in to the partner portal" })).toBeVisible();
      await audit(page, `sign in ${scheme}`);
      await page.getByRole("button", { name: "Email me a code" }).click();
      await expect(page.getByRole("alert")).toBeVisible();
      await audit(page, `sign in with an error ${scheme}`);
      await page.getByLabel("Work email").fill(OWNER);
      await page.getByRole("button", { name: "Email me a code" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Enter your code" })).toBeVisible();
      await audit(page, `code ${scheme}`);

      await portalSignIn(page, be, OWNER, "Overview");
      await audit(page, `overview ${scheme}`);
      const nav = (n) => page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: n, exact: true });
      await nav("Products").click();
      await page.getByRole("button", { name: "New product" }).click();
      await audit(page, `products ${scheme}`);
      await page.getByRole("link", { name: "Oura Ring" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Oura Ring" })).toBeVisible();
      await audit(page, `product editor (owner) ${scheme}`);
      await page.setViewportSize({ width: 1280, height: 900 });
      await audit(page, `product editor (owner), wide ${scheme}`);
      await page.setViewportSize({ width: 390, height: 844 });
      await nav("Brands").click();
      await audit(page, `brands ${scheme}`);
      await page.locator('[data-brand="oura"]').getByRole("link").click();
      await audit(page, `brand ${scheme}`);
      await page.getByLabel("Their work email").fill("pat@oura.example");
      await page.getByRole("button", { name: "Send invitation" }).click();
      await expect(page.locator(".msgbox")).toContainText("Invited");
      await nav("Applications").click();
      await audit(page, `applications ${scheme}`);
      await nav("Partners").click();
      await audit(page, `partners ${scheme}`);
      await nav("Activity").click();
      await audit(page, `activity ${scheme}`);

      const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
      const pp = await pctx.newPage();
      await portalSignIn(pp, be, "pat@oura.example", "Products");
      await audit(pp, `partner products ${scheme}`);
      await pp.getByRole("link", { name: "Oura Ring" }).click();
      await audit(pp, `product editor (partner) ${scheme}`);
      await pctx.close();
    } finally { await ctx.close(); await be.stop(); }
  });
}
