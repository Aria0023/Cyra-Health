/* axe-core on Task 1's surfaces (docs/plans/visible-features.md), light and dark: Home with the Ask Solia card (the
   text box, the API build) and the write-up card; Home with the "Coming soon" card (no server); and the dev gallery,
   which shows the card in every state (ask, switch off, plans, guest, soon). Controls are checked at 44px. */
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
};
const targets = async (page, sel, name) => {
  const small = await page.locator(sel).evaluateAll((els) => els.filter((el) => el.offsetParent !== null).map((el) => { const r = el.getBoundingClientRect(); return { t: (el.textContent || el.getAttribute("aria-label") || el.id || "").trim().slice(0, 30), h: Math.round(r.height), w: Math.round(r.width) }; }).filter((x) => x.h < 44 || x.w < 44));
  expect(small, `${name}: targets under 44px`).toEqual([]);
};

for (const scheme of ["light", "dark"]) {
  test(`Home with Ask Solia and the write-up, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await mockApi(page, newApiState({ weekly: () => ({ status: 200, json: { writeup: "Hot flashes came up on 9 days.\n\nSleep was steadier in weeks you moved more.", ask_your_doctor: "Are night sweats worth a visit?" } }) }));
    await register(page, { url: process.env.E2E_API_URL, stage: "Perimenopause", signin: "email" });
    await expect(page.locator("#home-ask")).toHaveAttribute("data-state", "ask");
    await audit(page, `Home, Ask Solia with the chat off ${scheme}`);
    await targets(page, "#home-ask button, #home-ask textarea", `Ask Solia, chat off ${scheme}`);
    await gotoTab(page, "You");
    await page.locator("#you-ai").getByRole("switch", { name: "Chat about your log" }).click();
    await page.locator("#you-ai").getByRole("switch", { name: "Weekly write-up" }).click();
    await gotoTab(page, "Patterns");
    await page.locator("#ai-writeup").getByRole("button", { name: "Prepare a write-up" }).click();
    await page.locator("#ai-send-sheet").getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.locator("#ai-writeup .aiout")).toBeVisible();
    await audit(page, `Patterns led by the write-up ${scheme}`);
    await gotoTab(page, "Home");
    await expect(page.locator("#home-writeup")).toBeVisible();
    await audit(page, `Home, Ask Solia and the write-up ${scheme}`);
    await targets(page, "#home-ask button, #home-ask textarea, #home-writeup button", `Ask Solia and the write-up ${scheme}`);
    await ctx.close();
  });

  test(`Home with the Coming soon card, and every state in the gallery, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await register(page, { stage: "My Cycle" });
    await expect(page.locator("#home-ask")).toHaveAttribute("data-state", "soon");
    await audit(page, `Home, Coming soon ${scheme}`);
    await targets(page, "#home-ask button", `Coming soon ${scheme}`);
    for (const style of ["soft", "aura", "mono"]) {
      await gotoGallery(page, { stage: "peri", scheme, style });
      await expect(page.locator("#dg-ask-plans")).toBeVisible();
      await audit(page, `gallery, Ask Solia states ${style} ${scheme}`);
      await targets(page, '[id^="dg-ask-"] button, [id^="dg-ask-"] textarea, #dg-writeup button', `gallery Ask Solia ${style} ${scheme}`);
    }
    await ctx.close();
  });
}
