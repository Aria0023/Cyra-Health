/* axe-core on the portal's launch tools (docs/plans/launch-tools.md), light and dark, phone and wide, against a real
   development backend (e2e/lib/portal.mjs): Readiness with rows in every status and after both live checks. Every
   target is checked at 44px. */
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
  test(`portal launch tools, ${scheme}`, async ({ browser }) => {
    const be = await startBackend({ env: { GOOGLE_CLIENT_ID: "x".repeat(20), GOOGLE_CLIENT_SECRET: "x".repeat(20), FACEBOOK_APP_ID: "x".repeat(20) } });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    try {
      await portalSignIn(page, be, OWNER, "Overview");
      // Readiness (Task 1): ready, not set up and problem rows; then after the two checks
      await nav(page, "Readiness");
      await expect(page.locator('[data-row="signin-facebook"]')).toHaveAttribute("data-status", "problem");
      await audit(page, `readiness ${scheme}`);
      await page.getByRole("button", { name: "Check storage" }).click();
      await expect(page.locator("#ready-disk-out")).toContainText("Storage works");
      await page.getByRole("button", { name: "Send me a test email" }).click();
      await expect(page.locator(".msgbox")).toContainText("nothing was sent");
      await audit(page, `readiness after the checks ${scheme}`);
      await page.setViewportSize({ width: 1200, height: 900 });
      await audit(page, `readiness, wide ${scheme}`);
    } finally { await ctx.close(); await be.stop(); }
  });
}
