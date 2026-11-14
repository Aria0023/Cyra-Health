/* axe-core on Task B's screens, light and dark: Body with its Devices button, the device list with the Blood glucose
   section (one row connected), the Body Glucose card and the "+" sheet's Connect a device. 0 violations. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register } from "./lib/onboard.mjs";
import { gotoTab, openLog } from "./lib/nav.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const audit = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
};

for (const scheme of ["light", "dark"]) {
  test(`devices any time and the Glucose card, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await register(page, { stage: "Perimenopause" });
    await gotoTab(page, "Body");
    await audit(page, `Body with Devices ${scheme}`);
    await page.locator(".bodydevbtn").click();
    await page.locator('#devices-sheet .devrow[data-device="libre"]').getByRole("button", { name: "Connect" }).click();
    await expect(page.locator('#devices-sheet .devrow[data-device="libre"]')).toContainText("Connected");
    await audit(page, `device list with glucose ${scheme}`);
    await page.locator("#devices-sheet .v2sheet-close").click();
    await expect(page.locator("#body-glucose")).toBeVisible();
    await audit(page, `Body Glucose card ${scheme}`);
    await openLog(page);
    await audit(page, `log sheet with Connect a device ${scheme}`);
    await ctx.close();
  });
}
