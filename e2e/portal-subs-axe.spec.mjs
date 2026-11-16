/* axe-core on the portal's subscriptions screens (docs/plans/portal-subscriptions.md Task 2), light and dark, phone and
   wide: Subscriptions (configured, and not configured), Promotions and the promotion editor with its banner preview, Pro
   grants with results, the owner's Codes, and a partner's Codes. A real development backend with a mocked RevenueCat
   (e2e/lib/revenuecat.mjs). Every target is checked at 44px. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { startBackend, portalSignIn, portalToken, appAccount, OWNER } from "./lib/portal.mjs";
import { startRevenueCat } from "./lib/revenuecat.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const audit = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
  const small = await page.evaluate(() => [...document.querySelectorAll("main button, main a.btn, main select, main summary, main input:not([type=checkbox]):not([type=radio]):not([type=file]):not([tabindex='-1']), #nav a, .who button")]
    .filter((el) => el.offsetParent !== null).map((el) => { const r = el.getBoundingClientRect(); return { t: el.textContent.trim().slice(0, 30) || el.id, h: r.height }; }).filter((x) => x.h < 44));
  expect(small, `${name}: targets under 44px`).toEqual([]);
};
const nav = (page, n) => page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: n, exact: true });

for (const scheme of ["light", "dark"]) {
  test(`portal subscriptions screens, ${scheme}`, async ({ browser }) => {
    const rc = await startRevenueCat();
    const be = await startBackend({ env: rc.env });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    try {
      await portalSignIn(page, be, OWNER, "Overview");
      await nav(page, "Subscriptions").click();
      await expect(page.locator('[data-metric="active_subscriptions"]')).toBeVisible();
      await audit(page, `subscriptions ${scheme}`);
      await page.setViewportSize({ width: 1280, height: 900 });
      await audit(page, `subscriptions, wide ${scheme}`);
      await page.setViewportSize({ width: 390, height: 844 });

      await nav(page, "Promotions").click();
      await page.locator(".guide summary").click();
      await audit(page, `promotions ${scheme}`);
      await page.getByRole("link", { name: "New promotion" }).click();
      await page.getByLabel("Name (only owners see it)").fill("Spring");
      await page.getByLabel("RevenueCat offering identifier").selectOption("spring_clinic");
      await page.getByRole("radio", { name: /People at certain life stages/ }).check();
      await page.getByRole("checkbox", { name: "Menopause", exact: true }).check();
      await page.getByRole("checkbox", { name: /^Web/ }).check();
      await page.getByLabel("Banner title (up to 40 characters)").fill("A calmer start");
      await page.getByLabel("Banner text (up to 120 characters)").fill("A longer free trial on the yearly plan.");
      await audit(page, `promotion editor ${scheme}`);
      await page.getByRole("button", { name: "Save as draft" }).click();
      await expect(page.locator("#promoform .badge")).toHaveText("Draft");
      await page.setViewportSize({ width: 1280, height: 900 });
      await audit(page, `promotion editor, wide ${scheme}`);
      await page.setViewportSize({ width: 390, height: 844 });

      await appAccount(be, "maya@clinic.example");
      await nav(page, "Pro grants").click();
      await page.getByLabel("Account emails").fill("maya@clinic.example\nnobody@clinic.example");
      await page.getByRole("button", { name: "Give Pro" }).click();
      await expect(page.locator('[data-result="maya@clinic.example"]')).toBeVisible();
      await audit(page, `pro grants ${scheme}`);

      const owner = await portalToken(page);
      await fetch(`${be.url}/api/shop/invites`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${owner}` }, body: JSON.stringify({ email: "pat@oura.example", brandIds: ["oura"] }) });
      await nav(page, "Codes").click();
      await page.getByLabel("Label").fill("Oura spring");
      await page.getByLabel("Store offer they belong to").fill("oura_spring");
      await page.getByLabel("Partner (brand)").selectOption("oura");
      await page.getByLabel("Codes, one per line").first().fill("OURA-AXE-0001\nOURA-AXE-0002");
      await page.getByRole("button", { name: "Upload codes" }).click();
      await expect(page.locator("[data-batch]")).toBeVisible();
      await audit(page, `codes (owner) ${scheme}`);

      const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
      const pp = await pctx.newPage();
      await portalSignIn(pp, be, "pat@oura.example", "Products");
      await nav(pp, "Codes").click();
      await expect(pp.locator("table")).toContainText("OURA-AXE-0001");
      await audit(pp, `codes (partner) ${scheme}`);
      await pctx.close();
    } finally { await ctx.close(); await be.stop(); await rc.stop(); }

    const plain = await startBackend();
    const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const p2 = await c2.newPage();
    try {
      await portalSignIn(p2, plain, OWNER, "Overview");
      await nav(p2, "Subscriptions").click();
      await expect(p2.locator(".envlist")).toBeVisible();
      await audit(p2, `subscriptions, not configured ${scheme}`);
      await nav(p2, "Pro grants").click();
      await audit(p2, `pro grants, not configured ${scheme}`);
    } finally { await c2.close(); await plain.stop(); }
  });
}
