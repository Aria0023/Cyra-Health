/* axe-core on Task 2's plans, light and dark: You → Plan's two tiles and "Get Solia Health Pro in the app" (no-server
   build), the Pro sheet that opens with them, and Home with the header's plan badge (API build, mocked server; Home's Pro note is gone since 2026-11-25). */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register } from "./lib/onboard.mjs";
import { gotoYou } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const audit = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
};

for (const scheme of ["light", "dark"]) {
  test(`plans and the trial, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await register(page, { stage: "Pregnant" });
    await gotoYou(page, "Plan & account");
    await page.locator("#you-plan .plantiles").scrollIntoViewIfNeeded();
    await audit(page, `You → Plan tiles ${scheme}`);
    await page.locator("#you-plan").getByRole("button", { name: /See what Pro adds|See Pro plans/ }).click();
    await expect(page.locator("#pro-sheet .plantile")).toHaveCount(2);
    await audit(page, `Pro sheet with tiles ${scheme}`);
    await ctx.close();
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const p2 = await ctx2.newPage();
    await mockApi(p2, newApiState());
    await register(p2, { url: process.env.E2E_API_URL, stage: "My Cycle", pcos: "no", signin: "email" });
    await expect(p2.locator("header.mast .planbadge")).toBeVisible(); // 2026-11-25: the badge, not a Home note, says the plan
    await audit(p2, `Home with the plan badge ${scheme}`);
    await ctx2.close();
  });
}
