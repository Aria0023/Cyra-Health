/* Finding her way around (lib/guide.js): Getting started on Home, a one-time tip per screen, Show me around again. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register } from "./lib/onboard.mjs";
import { gotoTab, gotoSegment } from "./lib/nav.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const audit = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`), name).toEqual([]);
};

for (const scheme of ["light", "dark"]) {
  test(`getting started, one-time tips and the replay (${scheme})`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await register(page, { stage: "My Cycle", pcos: "no" });
    // The harness build carries 75 days of illustrative check-ins, so the check-in and period steps are already done.
    const card = page.locator(".stepcard");
    await expect(card).toContainText("Getting started · 3 of 5");
    await expect(card).toContainText("See what Patterns shows");
    await audit(page, `Home with Getting started ${scheme}`);

    // The button goes straight there, where the screen's tip shows once.
    await card.getByRole("button", { name: "Open Patterns" }).click();
    const tip = page.locator(".viewtip");
    await expect(tip).toContainText("Patterns shows what tends to go together");
    await audit(page, `Patterns with its tip ${scheme}`);
    await tip.getByRole("button", { name: "Got it" }).click();
    await expect(tip).toHaveCount(0);
    // Patterns seen: the next step moves on.
    await gotoTab(page, "Home");
    await expect(page.locator(".stepcard")).toContainText("Getting started · 4 of 5");
    await expect(page.locator(".stepcard")).toContainText("Try a 3-minute practice");
    await gotoTab(page, "Body");
    await expect(page.locator(".viewtip")).toContainText("This is where you log.");
    await gotoTab(page, "Patterns");
    await expect(page.locator(".viewtip")).toHaveCount(0, { timeout: 2000 });

    // Hide it, then bring everything back from You.
    await gotoTab(page, "Home");
    await page.locator(".stepcard").getByRole("button", { name: "Hide getting started" }).click();
    await expect(page.locator(".stepcard")).not.toContainText("Getting started");
    await gotoTab(page, "You");
    await page.locator("#you-tour").getByRole("button", { name: "Show me around again" }).click();
    await expect(page.locator(".stepcard")).toContainText("Getting started");
    await gotoTab(page, "Patterns");
    await gotoSegment(page, "Report");
    await expect(page.locator(".viewtip")).toContainText("one-page summary");
    await ctx.close();
  });
}
