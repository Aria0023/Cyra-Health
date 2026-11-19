/* axe-core on the portal's reporting pages (docs/plans/tracking-reports.md), light and dark, phone and wide, against a
   real development backend (e2e/lib/portal.mjs): Clicks with totals, its chart and tables, and empty; the Overview's
   People card and the People page with its chart and the 30-day table open; Affiliates with Impact connected (a local
   stand-in), an upload error and the Amazon totals, and the brand editor's Impact field. Every target is checked at 44px. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { startBackend, portalSignIn, appAccount, OWNER } from "./lib/portal.mjs";
import { startImpact } from "./lib/impact.mjs";

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
    const impact = await startImpact();
    const be = await startBackend({ env: impact.env });
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
      // People (Task 2)
      await page.setViewportSize({ width: 390, height: 844 });
      for (const e of ["maya@x.example", "noor@x.example"]) await appAccount(be, e);
      await nav(page, "Overview");
      await expect(page.locator('[data-stat="people-total"] b')).toHaveText("2");
      await audit(page, `overview with the People card ${scheme}`);
      await nav(page, "People");
      await expect(page.getByRole("heading", { level: 1, name: "People" })).toBeVisible();
      await page.getByText("The 30 days as a table").click();
      await expect(page.getByRole("table", { name: "New accounts by day" })).toBeVisible();
      await audit(page, `people ${scheme}`);
      await page.setViewportSize({ width: 1200, height: 900 });
      await audit(page, `people, wide ${scheme}`);
      // Affiliates (Task 3): Impact connected, the upload form, an error, and the uploaded Amazon totals
      await page.setViewportSize({ width: 390, height: 844 });
      await nav(page, "Affiliates");
      await expect(page.getByRole("table", { name: "Taps and Impact results by brand" })).toBeVisible();
      await audit(page, `affiliates ${scheme}`);
      await page.getByRole("button", { name: "Upload report" }).click();
      await expect(page.getByRole("alert")).toBeVisible();
      await audit(page, `affiliates with an error ${scheme}`);
      const day = new Date().toISOString().slice(0, 10);
      await page.getByLabel("Amazon Associates earnings report (CSV)").setInputFiles({ name: "earnings.csv", mimeType: "text/csv", buffer: Buffer.from(`Date Shipped,Items Shipped,Revenue($),Ad Fees($)\n${day},3,49.97,2.00\n`) });
      await page.getByRole("button", { name: "Upload report" }).click();
      await expect(page.locator('[data-stat="az-earnings"] b')).toHaveText("2.00");
      await audit(page, `affiliates with Amazon totals ${scheme}`);
      await page.setViewportSize({ width: 1200, height: 900 });
      await audit(page, `affiliates, wide ${scheme}`);
      await nav(page, "Brands");
      await page.getByRole("link", { name: "Oura", exact: true }).click();
      await expect(page.getByLabel("Impact campaign ID (optional)")).toBeVisible();
      await audit(page, `brand editor with the Impact field ${scheme}`);
    } finally { await ctx.close(); await be.stop(); await impact.stop(); }
  });
}
