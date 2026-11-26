/* axe-core on every website page (docs/plans/website.md Task 2), light and dark, at 390 and 1280px, with the questions
   closed and then open: 0 violations and no sideways scroll. Runs in the axe project (npm run e2e:axe). */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { SITE_PAGES, WIDTHS, SCHEMES, openSitePage } from "./lib/site.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

for (const scheme of SCHEMES) {
  for (const width of WIDTHS) {
    test(`website ${scheme} at ${width}px: no axe violations, no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      for (const p of SITE_PAGES) {
        await openSitePage(page, p);
        for (const open of [false, true]) {
          if (open) { if (!(await page.locator("details").count())) break; await page.evaluate(() => { for (const d of document.querySelectorAll("details")) d.open = true; }); }
          const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
          const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
          expect(bad, `${p.id} ${scheme} ${width}${open ? " (questions open)" : ""}: axe violations`).toEqual([]);
          expect(r.passes.some((x) => x.id === "color-contrast"), `${p.id}: contrast was checked`).toBe(true);
        }
        const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        expect(sideways, `${p.id} ${scheme} ${width}: sideways scroll`).toBe(false);
      }
    });
  }
}
