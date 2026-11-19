/* axe-core on the portal's reporting pages (docs/plans/tracking-reports.md), light and dark, phone and wide, against a
   real development backend (e2e/lib/portal.mjs): Clicks with totals, its chart and tables, and empty. Every target is
   checked at 44px. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { startBackend, portalSignIn, OWNER } from "./lib/portal.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const audit = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
  const small = await page.evaluate(() => [...document.querySelectorAll("main button, main a.btn, main select, main input:not([type=checkbox]):not([type=file]):not([tabindex='-1']), main summary, #nav a, .who button")]
    .filter((el) => el.offsetParent !== null).map((el) => { const r = el.getBoundingClientRect(); return { t: el.textContent.trim().slice(0, 30) || el.id, h: r.height }; }).filter((x) => x.h < 44));
  expect(small, `${name}: targets under 44px`).toEqual([]);
};
const nav = (page, name) => page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name, exact: true }).click();
const tap = (base, productId) => fetch(`${base}/api/shop/tap`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId }) });

for (const scheme of ["light", "dark"]) {
  test(`portal reporting pages, ${scheme}`, async ({ browser }) => {
    const be = await startBackend();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    try {
      await portalSignIn(page, be, OWNER, "Overview");
      await nav(page, "Clicks");
      await expect(page.getByRole("heading", { level: 1, name: "Clicks" })).toBeVisible();
      await audit(page, `clicks, empty ${scheme}`);
      for (const id of ["oura", "oura", "mira", "easyhome-lh", "sleepio", "stelo", "lingo", "prenatal"]) await tap(be.url, id);
      await page.getByRole("button", { name: "Last 7 days" }).click();
      await expect(page.getByRole("table", { name: "Taps by product" })).toBeVisible();
      await audit(page, `clicks with totals ${scheme}`);
      await page.setViewportSize({ width: 1200, height: 900 });
      await audit(page, `clicks, wide ${scheme}`);
    } finally { await ctx.close(); await be.stop(); }
  });
}
