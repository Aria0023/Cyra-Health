/* axe-core on Task A's screens, light and dark: Home with its "What does this mean?" links, an explainer sheet, You → Learn
   and Share with a partner, Mind with More feelings open and the "What these words mean" sheet. 0 violations. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register } from "./lib/onboard.mjs";
import { gotoTab } from "./lib/nav.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const audit = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
};

for (const scheme of ["light", "dark"]) {
  test(`Learn, Share with a partner and More feelings, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await register(page, { stage: "Trying to conceive", pcos: "no" });
    await expect(page.locator(".homehero .learnlink")).toBeVisible();
    await audit(page, `Home with Learn links ${scheme}`);
    await page.locator(".homehero .learnlink").click();
    await page.locator("#learn-sheet").getByRole("button", { name: "Sources" }).click();
    await audit(page, `explainer sheet ${scheme}`);
    await page.locator("#learn-sheet .v2sheet-close").click();
    await gotoTab(page, "You");
    await expect(page.locator("#you-learn")).toBeVisible();
    await audit(page, `You with Learn and Share ${scheme}`);
    await page.locator("#you-partner").getByRole("button", { name: "Share with a partner" }).click();
    await page.getByLabel("A short note (optional)").fill("Quiet weekend?");
    await audit(page, `partner sheet ${scheme}`);
    await page.locator("#partner-sheet .v2sheet-close").click();
    await gotoTab(page, "Mind");
    await page.locator("#mood-card").getByRole("button", { name: "More feelings" }).click();
    await page.locator("#mood-card").getByRole("button", { name: "Need space", exact: true }).click();
    await audit(page, `Mind with More feelings ${scheme}`);
    await page.locator("#mood-card").getByRole("button", { name: "What these words mean" }).click();
    await audit(page, `feeling words sheet ${scheme}`);
    await ctx.close();
  });
}
