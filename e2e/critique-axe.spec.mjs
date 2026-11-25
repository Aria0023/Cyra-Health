/* axe-core on the surfaces docs/plans/critique-fixes.md changed (2026-11-25), in all nine styles, light and dark:
   the header (brand, plan badge, Shop, settings) and Home with "More for today" folded and open (Task 1-2); the
   shortened blocks of Task 4. 0 violations. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register } from "./lib/onboard.mjs";
import { gotoTab, setStyle, openHomeMore, gotoYou } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

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

/* Task 4: the shortened blocks with their Details closed and open (API build), light and dark. */
for (const scheme of ["light", "dark"]) {
  test(`shortened copy: feedback foot, privacy rows, Shop footer, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await mockApi(page, newApiState());
    await register(page, { url: process.env.E2E_API_URL, stage: "Perimenopause", pcos: "no", signin: "email" });
    await page.locator("header.mast").getByRole("button", { name: "Shop", exact: true }).click();
    await page.locator("main.shoppage .shopfoot").scrollIntoViewIfNeeded();
    await audit(page, `Shop footer, Details closed ${scheme}`);
    await page.locator("main.shoppage .shopfoot .morewrap").getByRole("button").click();
    await audit(page, `Shop footer, Details open ${scheme}`);
    await page.locator("main.shoppage").getByRole("button", { name: "Back" }).click();
    await gotoYou(page, "Privacy & your data");
    await page.locator("#you-privacy").getByRole("button", { name: "How this works" }).click();
    await audit(page, `privacy rows ${scheme}`);
    await gotoYou(page, "Help & about");
    await page.locator("#you-help").getByRole("button", { name: "Send feedback" }).click();
    const fb = page.getByRole("dialog", { name: "Send feedback" });
    await fb.getByRole("button", { name: "What will be sent" }).click();
    await fb.getByLabel("Your feedback").fill("Lovely calendar.");
    await audit(page, `feedback foot, Details closed ${scheme}`);
    await ctx.close();
  });
}

/* Task 6: the stage cards at registration, and in every style the You stage card, Your profile, the quick check-in with
   a picked face and the Mind mood with a picked face, light and dark. */
for (const scheme of ["light", "dark"]) {
  test(`check-in faces and stage illustrations, every style, ${scheme}`, async ({ browser }) => {
    test.setTimeout(300_000);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await page.goto(`${process.env.E2E_URL}/`);
    await page.getByRole("button", { name: "Get started" }).click();
    await page.getByRole("button", { name: "Continue for now" }).click();
    await expect(page.locator(".stagecard svg.stageart")).toHaveCount(5);
    await audit(page, `registration stage cards ${scheme}`);
    await register(page, { stage: "Trying to conceive", pcos: "no", resume: true, signin: null });
    await gotoYou(page, "Devices & reminders");
    await page.locator("#you-checkins").getByRole("button", { name: /Check-in style|Rhythm, time and style/ }).click();
    await page.getByRole("button", { name: "Quick · 3 taps" }).click();
    for (const style of STYLES) {
      await setStyle(page, style);
      await page.getByRole("tab", { name: "You", exact: true }).click();
      await audit(page, `You stage card, ${style} ${scheme}`);
      await gotoYou(page, "Your profile");
      await audit(page, `Your profile, ${style} ${scheme}`);
      await gotoTab(page, "Body");
      const yes = page.locator("button.qface", { hasText: "A little" }).first();
      if ((await yes.getAttribute("aria-pressed")) !== "true") { await yes.click(); await page.waitForTimeout(250); } // 2026-11-25: let the 100 ms colour transition finish (axe caught it mid-way: #7D8091 on #6071BA)
      await audit(page, `quick check-in with faces, ${style} ${scheme}`);
      await gotoTab(page, "Mind");
      const mood = page.locator("#mood-card .moodbtn").nth(3);
      if ((await mood.getAttribute("aria-pressed")) !== "true") await mood.click();
      await audit(page, `Mind mood, ${style} ${scheme}`);
    }
    await ctx.close();
  });
}
