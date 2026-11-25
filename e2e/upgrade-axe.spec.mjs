/* axe-core on You with "Upgrade to Pro" (docs/plans/upgrade-enterprise.md Task 1) in all nine styles, light and dark, and
   on the Pro sheet it opens (Soft and Aura); the button and the sheet's Done are checked at 44px. 0 violations. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register } from "./lib/onboard.mjs";
import { gotoTab, setStyle } from "./lib/nav.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const STYLES = ["Soft", "Mono", "Clear", "Journal", "Aura", "Sky", "Blush", "Mint", "Sunset"];
const audit = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`), `${name}: axe violations`).toEqual([]);
};
const tall = async (loc, name) => { const b = await loc.boundingBox(); expect(b.height, `${name}: 44px`).toBeGreaterThanOrEqual(44); expect(b.width, `${name}: 44px`).toBeGreaterThanOrEqual(44); };

for (const scheme of ["light", "dark"]) {
  test(`You with Upgrade to Pro in every style, and its Pro sheet, ${scheme}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await register(page, { stage: "My Cycle", pcos: "no", name: "Maya" });
    for (const style of STYLES) {
      await setStyle(page, style);
      await gotoTab(page, "You");
      const up = page.locator("#you-upgrade");
      await expect(up).toBeVisible();
      await tall(up, `Upgrade ${style} ${scheme}`);
      await audit(page, `You menu with Upgrade ${style} ${scheme}`);
      if (style === "Soft" || style === "Aura") {
        await up.click();
        const sheet = page.locator("#pro-sheet");
        await expect(sheet).toBeVisible();
        await audit(page, `Pro sheet from Upgrade ${style} ${scheme}`);
        await tall(sheet.getByRole("button", { name: "Done" }), `Done ${style} ${scheme}`);
        await sheet.getByRole("button", { name: "Done" }).click();
      }
    }
    await ctx.close();
  });
}
