/* axe-core on the anonymous shop tap count (docs/plans/tracking-reports.md Task 1), the API build, light and dark: the
   Shop footer's tap sentence, and You → Privacy & your data → "How this works" with the "Count my shop taps anonymously"
   row, its switch on and off (44px target) and its Details open. */
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
  test(`shop tap count: footer and privacy switch, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await mockApi(page, newApiState());
    await register(page, { url: process.env.E2E_API_URL, stage: "Perimenopause", pcos: "no", signin: "email" });
    await page.locator("header.mast").getByRole("button", { name: "Shop", exact: true }).click();
    const shop = page.locator("main.shoppage");
    await shop.locator(".shoptaps").scrollIntoViewIfNeeded();
    await expect(shop.locator(".shoptaps")).toContainText("counts one anonymous tap");
    await audit(page, `Shop footer with the tap sentence ${scheme}`);
    await shop.getByRole("button", { name: "Back" }).click();
    await gotoYou(page, "Privacy & your data");
    const privacy = page.locator("#you-privacy");
    await privacy.getByRole("button", { name: "How this works" }).click();
    const row = privacy.locator(".flowrow", { hasText: "Count my shop taps anonymously" });
    const sw = row.getByRole("switch", { name: "Count my shop taps anonymously" });
    await sw.scrollIntoViewIfNeeded();
    const box = await sw.boundingBox();
    expect(Math.min(box.width, box.height), "the switch is a 44px target").toBeGreaterThanOrEqual(44);
    await row.getByRole("button", { name: "Details" }).click();
    await expect(row).toContainText("Solia Health's own code uses the address only in memory");
    await audit(page, `privacy dashboard, shop taps on ${scheme}`);
    await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", "false");
    await audit(page, `privacy dashboard, shop taps off ${scheme}`);
    await ctx.close();
  });
}
