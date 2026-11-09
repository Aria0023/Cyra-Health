/* axe-core (WCAG 2.0/2.1 A and AA plus best practice) on Home, Body, Mind, Patterns, You, the log sheet and the
   Report, in light and dark, in the Soft and Clear styles: 0 violations. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register } from "./lib/onboard.mjs";
import { gotoTab, gotoSegment, openLog, closeSheet } from "./lib/nav.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const audit = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
};

test.describe.configure({ mode: "serial" });
let context, page;
test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" }); // axe needs a context of its own
  page = await context.newPage();
  await register(page, { stage: "My Cycle", pcos: "yes", name: "Maya" });
  // S2: the demo source, so Home carries "Today's auto-tracked" and Body → Cycles its markers.
  await page.getByRole("button", { name: /^Wearables/ }).click();
  await page.locator("#home-wear").getByRole("button", { name: "Connect" }).first().click();
  await expect(page.locator("#auto-tracked")).toBeVisible();
});
test.afterAll(async () => { await context?.close(); });

for (const style of ["Soft", "Clear"]) {
  for (const scheme of ["light", "dark"]) {
    test(`${style} ${scheme}: the main screens, the log sheet and the Report`, async () => {
      await page.emulateMedia({ colorScheme: scheme });
      await gotoTab(page, "You");
      await page.getByRole("radio", { name: style }).click();
      await expect(page.locator(".cy")).toHaveAttribute("data-style", style.toLowerCase());
      await expect(page.locator(".cy")).toHaveAttribute("data-scheme", scheme);
      await audit(page, `You ${style} ${scheme}`);
      for (const tab of ["Home", "Body", "Mind", "Patterns"]) { await gotoTab(page, tab); await audit(page, `${tab} ${style} ${scheme}`); }
      await gotoTab(page, "Home"); await page.locator("#auto-tracked").getByRole("button", { name: "Skip this night" }).click(); await audit(page, `auto-tracked skip picker ${style} ${scheme}`); await page.locator("#auto-tracked").getByRole("button", { name: "Keep it" }).click();
      await gotoTab(page, "Body"); await gotoSegment(page, "Cycles"); await audit(page, `Cycles ${style} ${scheme}`);
      await openLog(page); await audit(page, `log sheet ${style} ${scheme}`); await closeSheet(page);
      await gotoTab(page, "Patterns"); await gotoSegment(page, "Report"); await audit(page, `Report ${style} ${scheme}`);
    });
  }
}
