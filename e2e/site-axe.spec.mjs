/* axe-core on every website page (docs/plans/website.md Task 2), light and dark, at 390 and 1280px, with the questions
   closed and then open: 0 violations and no sideways scroll. Runs in the axe project (npm run e2e:axe).
   The site's backgrounds are gradients, and axe leaves text over a gradient as "needs review", so its contrast rule
   passes only the text on flat surfaces. The rest is measured from the page's own pixels (e2e/lib/contrast.mjs): every
   line of text on every page must reach WCAG AA against the worst pixel behind it. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { SITE_PAGES, WIDTHS, SCHEMES, openSitePage } from "./lib/site.mjs";
import { measuredContrast } from "./lib/contrast.mjs";

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
        // every line of text, the open answers included, against the pixels really behind it
        const contrast = await measuredContrast(page);
        expect(contrast.checked, `${p.id}: lines of text measured`).toBeGreaterThan(15);
        expect(contrast.failures.map((f) => `${f.ratio}:1 (needs ${f.need}) "${f.text}" ${f.tag}`), `${p.id} ${scheme} ${width}: text below AA contrast, measured`).toEqual([]);
        const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        expect(sideways, `${p.id} ${scheme} ${width}: sideways scroll`).toBe(false);
      }
    });
  }
}
