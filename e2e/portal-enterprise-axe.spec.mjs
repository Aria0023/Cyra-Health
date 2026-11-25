/* axe-core on the portal's enterprise pages (docs/plans/upgrade-enterprise.md), light and dark, phone and wide, against a
   real development backend (e2e/lib/portal.mjs): App settings empty, with a form error and after saves (the change log).
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
      await page.getByLabel("Line 1").fill("Ask your clinic about its own visits.");
      await page.getByRole("button", { name: "Save Help lines" }).click();
      await expect(page.getByRole("region", { name: "Change log" }).locator("tbody tr")).toHaveCount(2);
      await audit(page, `App settings, saved ${scheme}`);
      await page.setViewportSize({ width: 1200, height: 900 });
      await audit(page, `App settings, wide ${scheme}`);
    } finally { await ctx.close(); await be.stop(); }
  });
}
