/* axe-core on Shop by need, light and dark: the You card opened, and the sheet from the device list's quiet link. */
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
  test(`Shop by need, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await register(page, { stage: "Trying to conceive", pcos: "no" });
    await gotoTab(page, "You");
    await page.locator("#care").getByRole("button", { name: "See products by need" }).click();
    await page.locator('#care .shopitem[data-item="easyhome-lh"]').getByRole("button", { name: "Sources" }).click();
    await audit(page, `You → Shop by need ${scheme}`);
    await gotoTab(page, "Body");
    await page.locator(".bodydevbtn").click();
    await audit(page, `devices sheet with shop link ${scheme}`);
    await page.locator("#devices-sheet").getByRole("button", { name: "Don't have a device? See options" }).click();
    await expect(page.locator("#shop-sheet")).toBeVisible();
    await audit(page, `shop sheet ${scheme}`);
    await ctx.close();
  });
}
