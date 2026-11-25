/* axe-core (WCAG 2.0/2.1 A and AA plus best practice) on Home, Body, Mind, Patterns, You, the log sheet and the
   Report, in light and dark, in the Soft and Clear styles: 0 violations. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register } from "./lib/onboard.mjs";
import { gotoTab, gotoSegment, openLog, closeSheet, gotoGallery, gotoYou, openHomeMore } from "./lib/nav.mjs";

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
  await openHomeMore(page); // 2026-11-25: Wearables sits in Home's "More for today"
  await page.getByRole("button", { name: /^Wearables/ }).click();
  await page.locator("#home-wear").getByRole("button", { name: "Connect" }).first().click();
  await expect(page.locator("#auto-tracked")).toBeVisible();
});
test.afterAll(async () => { await context?.close(); });

for (const style of ["Soft", "Clear"]) {
  for (const scheme of ["light", "dark"]) {
    test(`${style} ${scheme}: the main screens, the log sheet and the Report`, async () => {
      await page.emulateMedia({ colorScheme: scheme });
      await gotoYou(page, "App settings");
      await page.getByRole("radio", { name: style }).click();
      await expect(page.locator(".cy")).toHaveAttribute("data-style", style.toLowerCase());
      await expect(page.locator(".cy")).toHaveAttribute("data-scheme", scheme);
      await audit(page, `You → App settings ${style} ${scheme}`);
      await gotoTab(page, "You"); await audit(page, `You ${style} ${scheme}`);
      for (const tab of ["Home", "Body", "Mind", "Patterns"]) { await gotoTab(page, tab); await audit(page, `${tab} ${style} ${scheme}`); }
      await gotoTab(page, "Home"); await page.locator("#auto-tracked").getByRole("button", { name: "Skip this night" }).click(); await audit(page, `auto-tracked skip picker ${style} ${scheme}`); await page.locator("#auto-tracked").getByRole("button", { name: "Keep it" }).click();
      await gotoTab(page, "Body"); await gotoSegment(page, "Cycles"); await audit(page, `Cycles ${style} ${scheme}`);
      await gotoYou(page, "Devices & reminders"); await page.locator('#you-sources .srcrow[data-source="oura"]').getByRole("button", { name: "Disconnect", exact: true }).click(); await audit(page, `Data sources, disconnect open ${style} ${scheme}`); await page.locator("#you-sources").getByRole("button", { name: "Keep it" }).click();
      await openLog(page); await audit(page, `log sheet ${style} ${scheme}`); await closeSheet(page);
      await gotoTab(page, "Patterns"); await gotoSegment(page, "Report"); await audit(page, `Report ${style} ${scheme}`);
    });
  }
}

test("the dev gallery: the card in five styles and the notification mock, light and dark", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  for (const scheme of ["light", "dark"]) { await gotoGallery(page, { stage: "cycle", scheme, style: "soft" }); await audit(page, `gallery ${scheme}`); }
  await ctx.close();
});

test("the Pro sheet: the store's prices, the trial, the renewal terms and tips (pretend store), light and dark", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  for (const scheme of ["light", "dark"]) {
    await gotoGallery(page, { stage: "peri", scheme, style: "soft" });
    await page.getByRole("button", { name: "Open the Pro sheet (pretend store)" }).click();
    const sheet = page.locator("#pro-sheet");
    await expect(sheet.getByRole("button", { name: "Start 7-day free trial" })).toBeVisible();
    // 2026-11-15: the sheet opens with the two store tiles (Yearly first, its trial badge from the store's offer) and the trial line
    await expect(sheet.locator(".plantile")).toHaveCount(2);
    await expect(sheet.locator(".plantile").first()).toContainText("Yearly");
    await expect(sheet.locator(".plantile").first()).toContainText("7-day free trial");
    await expect(sheet.locator(".protrialline")).toHaveCount(0); // 2026-11-25 (critique-fixes Task 5): the trial is said on the yearly tile only
    await expect(sheet.locator("#pro-terms")).toContainText("Free for 7 days, then $100.00 a year. Renews every year until you cancel.");
    await expect(sheet.locator("#pro-terms")).toContainText("Cancel any time in Settings");
    await expect(sheet.getByRole("button", { name: /\$9\.99/ })).toBeVisible();
    await audit(page, `Pro sheet, yearly picked, ${scheme}`);
    await sheet.getByRole("button", { name: /^Monthly/ }).click();
    await expect(sheet.getByRole("button", { name: "Subscribe for $9.95 a month" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: /^Monthly/ })).toHaveAttribute("aria-pressed", "true");
    await audit(page, `Pro sheet, monthly picked, ${scheme}`);
    await sheet.getByRole("button", { name: "Done" }).click();
  }
  await ctx.close();
});

test("the Pro sheet on the web sells nothing: the two plan tiles and the price in the apps", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await register(page, { stage: "Perimenopause", name: "Ana" });
  await gotoYou(page, "Plan & account");
  await page.locator("#you-plan").getByRole("button", { name: "See what Pro adds" }).click();
  const sheet = page.locator("#pro-sheet");
  await expect(sheet.locator(".protrialline")).toHaveCount(0); // 2026-11-25 (critique-fixes Task 5): the trial is said on the yearly tile only
  await expect(sheet.locator(".plantile")).toHaveText([/Yearly.*Best value.*\$100 a year.*About \$8\.33 a month.*7-day free trial/, /Monthly.*\$9\.95 a month/]);
  await expect(sheet.getByText("Coming soon to the App Store and Google Play")).toBeVisible();
  await expect(sheet.getByRole("button", { name: /free trial|Subscribe|App Store|Google Play/ })).toHaveCount(0);
  await audit(page, "Pro sheet on the web");
  await ctx.close();
});
