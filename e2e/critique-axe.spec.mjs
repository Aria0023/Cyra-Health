/* axe-core on the surfaces docs/plans/critique-fixes.md changed (2026-11-25), in all nine styles, light and dark:
   the header (brand, plan badge, Shop, settings) and Home with "More for today" folded and open. 0 violations. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register } from "./lib/onboard.mjs";
import { gotoTab, setStyle, openHomeMore } from "./lib/nav.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const STYLES = ["Soft", "Mono", "Clear", "Journal", "Aura", "Sky", "Blush", "Mint", "Sunset"];
const audit = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
};

for (const scheme of ["light", "dark"]) {
  test(`header and Home (folded and open), every style, ${scheme}`, async ({ browser }) => {
    test.setTimeout(300_000);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await register(page, { stage: "Trying to conceive", pcos: "no", name: "Maya" });
    for (const style of STYLES) {
      await setStyle(page, style);
      await gotoTab(page, "Home");
      const more = page.getByRole("button", { name: "More for today" });
      if ((await more.getAttribute("aria-expanded")) === "true") await more.click();
      await audit(page, `Home folded, ${style} ${scheme}`);
      await openHomeMore(page);
      await audit(page, `Home open, ${style} ${scheme}`);
    }
    await ctx.close();
  });
}
