/* axe-core on Task 3's screens, light and dark: Ask with evidence (with an answer and its sources, and the "What Solia
   Health will send" sheet), the Practices page with every practice free, and a practice sheet with the voice guide on. 0 violations. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register } from "./lib/onboard.mjs";
import { gotoTab, gotoSegment } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const audit = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
};
const ANSWER = { provider: "claude-opus-5-5", answer: "CBT-I helps sleep in menopause. [1]\n\nAsk your clinician about a referral.", sources: [{ n: 1, title: "NICE NG23 Menopause", url: "https://www.nice.org.uk/guidance/ng23" }] };

for (const scheme of ["light", "dark"]) {
  test(`Ask with evidence and the voice guide, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await mockApi(page, newApiState({ evidence: () => ({ status: 200, json: ANSWER }) }));
    await register(page, { url: process.env.E2E_API_URL, stage: "Perimenopause", signin: "email" });
    await gotoTab(page, "Mind"); await gotoSegment(page, "Journey");
    const card = page.locator("#ai-evidence");
    await card.getByLabel("Your question").fill("Does CBT help sleep in menopause?");
    await card.getByRole("button", { name: "Review and send" }).click();
    await expect(page.locator("#ai-send-sheet")).toBeVisible();
    await audit(page, `What Solia Health will send ${scheme}`);
    await page.locator("#ai-send-sheet").getByRole("button", { name: "Send", exact: true }).click();
    await expect(card.locator(".evsrcs li")).toHaveCount(1);
    await audit(page, `Ask with evidence, answered ${scheme}`);
    await gotoSegment(page, "Practices");
    await page.locator('.prow-btn[data-practice="slow"]').first().click();
    const voice = page.locator("#practice-sheet").getByRole("switch", { name: "Voice guide" });
    if (await voice.count()) await voice.click();
    await audit(page, `practice sheet, voice on ${scheme}`);
    await ctx.close();
  });

  test(`Practices, all free, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await register(page, { stage: "My Cycle" });
    await gotoTab(page, "Mind"); await gotoSegment(page, "Practices");
    await audit(page, `Practices, all free ${scheme}`);
    await ctx.close();
  });
}
