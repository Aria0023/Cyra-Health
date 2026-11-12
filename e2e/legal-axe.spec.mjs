/* axe-core on the legal pages (public/legal/), light and dark, phone and desktop width: 0 violations and no
   sideways scroll. Runs in the axe project (npm run e2e:axe). */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const PAGES = ["index.html", "terms.html", "privacy.html", "health-data.html", "medical-disclaimer.html"];

for (const scheme of ["light", "dark"]) {
  for (const width of [360, 1200]) {
    test(`legal pages ${scheme} at ${width}px: no axe violations, no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: scheme });
      for (const p of PAGES) {
        await page.goto(new URL(`/legal/${p}`, process.env.E2E_URL).href);
        await expect(page.locator("h1")).toBeVisible();
        const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
        expect(bad, `${p} ${scheme} ${width}: axe violations`).toEqual([]);
        const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        expect(sideways, `${p} ${scheme} ${width}: sideways scroll`).toBe(false);
      }
    });
  }
}
