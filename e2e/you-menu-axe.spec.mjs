/* axe-core on You's menu and each of its pages (docs/plans/visible-features.md Task 3), light and dark: the menu in
   every style, each page in Soft and Aura, and the API build's pages that differ with a server and an account. Rows
   and the back link are checked at 44px. 0 violations. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register } from "./lib/onboard.mjs";
import { gotoTab, gotoYou, setStyle, YOU_PAGES } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const audit = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
};
const targets = async (page, sel, name) => {
  const small = await page.locator(sel).evaluateAll((els) => els.filter((el) => el.offsetParent !== null).map((el) => { const r = el.getBoundingClientRect(); return { t: (el.textContent || el.getAttribute("aria-label") || el.id || "").trim().slice(0, 30), h: Math.round(r.height), w: Math.round(r.width) }; }).filter((x) => x.h < 44 || x.w < 44));
  expect(small, `${name}: targets under 44px`).toEqual([]);
};
const STYLES = ["Soft", "Mono", "Clear", "Journal", "Aura", "Sky", "Blush", "Mint", "Sunset"];

for (const scheme of ["light", "dark"]) {
  test(`You: the menu in every style and each page, ${scheme}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await register(page, { stage: "My Cycle", pcos: "yes", name: "Maya" });
    for (const style of STYLES) {
      await setStyle(page, style);
      if (style === "Soft" || style === "Aura") {
        for (const title of YOU_PAGES) {
          await gotoYou(page, title);
          await audit(page, `You → ${title} ${style} ${scheme}`);
          await targets(page, "#you-back, .youailink button, #you-voice button, #you-home-cards button, #you-stage button", `You → ${title} ${style} ${scheme}`);
        }
      }
      await gotoTab(page, "You");
      await expect(page.locator(".youmenu .yourow")).toHaveCount(7);
      await audit(page, `You menu ${style} ${scheme}`);
      await targets(page, ".youmenu .yourow, .youmenu .youstage button", `You menu ${style} ${scheme}`);
    }
    await ctx.close();
  });

  test(`You's pages with a server and an account, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await mockApi(page, newApiState());
    await register(page, { url: process.env.E2E_API_URL, stage: "Perimenopause", pcos: "no", signin: "email" });
    await gotoTab(page, "You");
    await audit(page, `You menu, API build ${scheme}`);
    for (const title of ["Solia Health's AI", "Plan & account", "Privacy & your data", "Help & about"]) {
      await gotoYou(page, title);
      await audit(page, `You → ${title}, API build ${scheme}`);
    }
    await ctx.close();
  });
}
