/* axe-core on Task 3's promotion banner (docs/plans/portal-subscriptions.md), light and dark: You → Plan and the Pro sheet
   on the web (API build, mocked server: no price, the web line, "Have a code?" explained), and a phone's Pro sheet with a
   promotion from the dev gallery's pretend store (the store's prices, "Have a code?"). Targets checked at 44px. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register } from "./lib/onboard.mjs";
import { gotoTab, gotoGallery } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const audit = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
  const small = await page.evaluate(() => [...document.querySelectorAll(".promobanner button, .procode button, .procode input")].filter((el) => el.offsetParent !== null).map((el) => ({ t: el.textContent.trim().slice(0, 30), h: el.getBoundingClientRect().height })).filter((x) => x.h < 44));
  expect(small, `${name}: targets under 44px`).toEqual([]);
};
const PROMO = { id: "promo_every1", offeringId: "spring_clinic", platforms: ["ios", "android", "web"], audience: { who: "everyone", stages: [] }, startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2099-01-01T00:00:00.000Z", banner: { title: "A calmer start", body: "A longer free trial on the yearly plan." } };

for (const scheme of ["light", "dark"]) {
  test(`promotion banner, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await mockApi(page, newApiState({ promotions: [PROMO] }));
    await register(page, { url: process.env.E2E_API_URL, stage: "My Cycle", signin: "email" });
    await gotoTab(page, "You");
    await page.locator("#you-plan .promobanner").scrollIntoViewIfNeeded();
    await audit(page, `You → Plan with a promotion ${scheme}`);
    await page.locator("#you-plan").getByRole("button", { name: /See what Pro adds|See Pro plans/ }).click();
    await expect(page.locator("#pro-sheet .promobanner")).toBeVisible();
    await audit(page, `Pro sheet with a promotion, web ${scheme}`);
    await ctx.close();

    const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const p2 = await c2.newPage();
    await gotoGallery(p2, { stage: "peri", scheme, style: "soft" });
    await p2.getByRole("button", { name: "Open the Pro sheet with a promotion (pretend store)" }).click();
    await expect(p2.locator("#pro-sheet .promobanner li")).toBeVisible();
    await audit(p2, `Pro sheet with a promotion, pretend store ${scheme}`);
    await c2.close();
  });
}
