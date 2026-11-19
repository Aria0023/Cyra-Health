/* axe-core on Task 2's screens, light and dark: the "Connect your devices" sheet in the API build (mocked:
   Oura set up, Terra not: its row hidden, the "Fitbit, Garmin or Whoop?" how-to closed and open), the Home card, and the
   "Connect your devices" sheet with a connected (demo) row. 0 violations. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register, emailSignIn } from "./lib/onboard.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const audit = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
};

for (const scheme of ["light", "dark"]) {
  test(`devices sheet (API build), Home card and sheet, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await mockApi(page, newApiState({ sources: { healthkit: "on-device", oura: true, terra: false } }));
    await page.goto(`${process.env.E2E_API_URL}/`);
    await page.getByRole("button", { name: "Get started" }).click();
    await emailSignIn(page);
    await page.locator(".stagecard", { hasText: "Menopause & beyond" }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your data and your choices" })).toBeVisible(); // no device step
    await page.getByRole("checkbox", { name: /I agree to/ }).click();
    await page.getByRole("button", { name: "Enter Solia Health" }).click();
    await page.locator("#home-devices").getByRole("button", { name: "See devices" }).click();
    // 2026-11-19: Terra isn't set up on this (mock) server, so its row is hidden and the how-to stands in for it
    await expect(page.locator('#devices-sheet .devrow[data-device="terra"]')).toHaveCount(0);
    await audit(page, `devices sheet, API build ${scheme}`);
    const howto = page.locator("#devices-sheet .devhowto");
    const toggle = howto.getByRole("button", { name: "Fitbit, Garmin or Whoop?" });
    await toggle.scrollIntoViewIfNeeded();
    expect((await toggle.boundingBox()).height, "the how-to toggle is a 44px target").toBeGreaterThanOrEqual(44);
    await toggle.click();
    await expect(howto.getByRole("list", { name: "Garmin" })).toBeVisible();
    await audit(page, `devices sheet with the Fitbit, Garmin or Whoop how-to open ${scheme}`);
    await ctx.close();

    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const p2 = await ctx2.newPage();
    await register(p2, { stage: "My Cycle", name: "Maya" });
    await expect(p2.locator("#home-devices")).toBeVisible();
    await audit(p2, `Home devices card ${scheme}`);
    await p2.locator("#home-devices").getByRole("button", { name: "See devices" }).click();
    await p2.locator('#devices-sheet .devrow[data-device="oura"]').getByRole("button", { name: "Connect" }).click();
    await expect(p2.locator('#devices-sheet .devrow[data-device="oura"]')).toContainText("Connected");
    await audit(p2, `devices sheet, one connected ${scheme}`);
    await ctx2.close();
  });
}
