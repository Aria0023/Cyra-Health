/* axe-core on the Shop page (2026-11-15), light and dark, in Soft and the other styles: opened from the header, a card's
   "Learn more" open, "By brand", the device list's quiet link, and a wide screen. */
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
  test(`Shop page, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await register(page, { stage: "Trying to conceive", pcos: "no" });
    await gotoTab(page, "You");
    await page.locator("#you-shop").scrollIntoViewIfNeeded();
    await audit(page, `You → Shop entry ${scheme}`);
    await page.locator("header.mast").getByRole("button", { name: "Shop", exact: true }).click();
    const shop = page.locator("main.shoppage");
    await shop.locator('.shopcard[data-item="easyhome-lh"]').getByRole("button", { name: "Learn more" }).click();
    await audit(page, `Shop page by need ${scheme}`);
    await shop.getByRole("button", { name: "By brand" }).click();
    await audit(page, `Shop page by brand ${scheme}`);
    await shop.getByRole("button", { name: "Back" }).click();
    await gotoTab(page, "Body");
    await page.locator(".bodydevbtn").click();
    await audit(page, `devices sheet with shop link ${scheme}`);
    await page.locator("#devices-sheet").getByRole("button", { name: "Don't have a device? See options" }).click();
    await expect(shop).toBeVisible();
    await audit(page, `Shop page from a quiet link ${scheme}`);
    await page.setViewportSize({ width: 1200, height: 900 });
    await audit(page, `Shop page, wide ${scheme}`);
    await ctx.close();
  });
}

test("Shop page in every style (Mono, Bloom, Clear, Journal), light and dark", async ({ browser }) => {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await register(page, { stage: "Perimenopause", pcos: "no" });
    for (const style of ["Mono", "Bloom", "Clear", "Journal"]) {
      await gotoTab(page, "You");
      await page.getByRole("radio", { name: style }).click();
      await expect(page.locator(".cy")).toHaveAttribute("data-style", style.toLowerCase());
      await page.locator("header.mast").getByRole("button", { name: "Shop", exact: true }).click();
      await expect(page.locator("main.shoppage")).toBeVisible();
      await audit(page, `Shop page ${style} ${scheme}`);
    }
    await ctx.close();
  }
});
