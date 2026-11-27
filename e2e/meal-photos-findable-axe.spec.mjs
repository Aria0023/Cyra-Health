/* axe-core on the surfaces of docs/plans/meal-photos-findable.md, in all nine styles, light and dark, 0 violations:
   - the Body tab with the "Meal photos" card off, the "Turn on meal photos" sheet, and the Body tab with the card on
     (the API build, proDev = Pro);
   - the card in every state (no server, sign in, See Pro, turn on, on) in the dev gallery (the bundle without a server);
   - once per scheme: the answer with "Which meal was this?" and "Show them", and the Meals sheet's "Add a photo instead?".
   Every control on the card and in the sheet is checked at 44px. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register } from "./lib/onboard.mjs";
import { gotoTab, openLog, gotoGallery, gotoYou, setStyle } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";
import { plateFile } from "./lib/photo.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const STYLES = ["Soft", "Mono", "Clear", "Journal", "Aura", "Sky", "Blush", "Mint", "Sunset"];
const audit = async (page, name, include = null) => {
  let b = new AxeBuilder({ page }).withTags(TAGS);
  if (include) b = b.include(include);
  const r = await b.analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
};
const targets = async (page, sel, name) => {
  const small = await page.locator(sel).evaluateAll((els) => els.filter((el) => el.offsetParent !== null).map((el) => { const r = el.getBoundingClientRect(); return { t: (el.textContent || el.getAttribute("aria-label") || el.id || "").trim().slice(0, 30), h: Math.round(r.height), w: Math.round(r.width) }; }).filter((x) => x.h < 44 || x.w < 44));
  expect(small, `${name}: targets under 44px`).toEqual([]);
};
const ANSWER = { provider: "x", food: true, sure: "medium", total: { low: 470, high: 720 }, items: [{ name: "White rice", portion: "about 1 cup", low: 180, high: 260 }, { name: "Lentil curry", portion: "a small bowl", low: 220, high: 340 }] };

for (const scheme of ["light", "dark"]) {
  test(`Body with the Meal photos card (off, the sheet, on) in nine styles, ${scheme}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await mockApi(page, newApiState({ meal: () => ({ status: 200, json: ANSWER }) }));
    await register(page, { url: process.env.E2E_API_URL, stage: "My Cycle", signin: "email" });
    const card = page.locator("#body-mealphotos"), on = page.locator("#meal-on-sheet");
    for (const style of STYLES) {
      await setStyle(page, style);
      await gotoTab(page, "Body");
      await expect(card).toHaveAttribute("data-state", "off");
      await audit(page, `Body, card off, ${style} ${scheme}`);
      await targets(page, "#body-mealphotos button", `card off ${style} ${scheme}`);
      await card.getByRole("button", { name: "Turn on meal photos" }).click();
      await expect(on.getByRole("switch", { name: "Show calorie estimates" })).toBeVisible();
      await audit(page, `Turn on meal photos, ${style} ${scheme}`);
      if (style === "Soft") { await on.getByRole("button", { name: "Details" }).click(); await audit(page, `Turn on meal photos, Details open, ${scheme}`); }
      await targets(page, "#meal-on-sheet button", `turn-on sheet ${style} ${scheme}`);
      await on.getByRole("button", { name: "Not now", exact: true }).click();
      await expect(on).toHaveCount(0);
    }
    await card.getByRole("button", { name: "Turn on meal photos" }).click();
    await on.getByRole("button", { name: "Turn on meal photos" }).click();
    await expect(card).toHaveAttribute("data-state", "on");
    for (const style of [...STYLES].reverse()) { // the last style set above is first, so the first pass needs no trip to You
      if ((await page.locator(".cy").getAttribute("data-style")) !== style.toLowerCase()) { await setStyle(page, style); await gotoTab(page, "Body"); }
      await expect(card.getByRole("button", { name: "Take a photo" })).toBeVisible();
      await audit(page, `Body, card on, ${style} ${scheme}`);
      await targets(page, "#body-mealphotos button", `card on ${style} ${scheme}`);
    }
    // the answer for a photo from the card: "Which meal was this?" and, calories hidden, "Show them"
    await card.locator('input[data-pick="library"]').setInputFiles(plateFile(800, 600));
    await page.locator("#meal-send-sheet").getByRole("button", { name: "Send", exact: true }).click();
    const answer = page.locator("#meal-answer-sheet");
    await expect(answer.getByRole("button", { name: "Show them" })).toBeVisible();
    await audit(page, `the answer, calories hidden, ${scheme}`);
    await targets(page, "#meal-answer-sheet button, #meal-answer-sheet input", `the answer ${scheme}`);
    await answer.getByRole("button", { name: "Show them" }).click();
    await expect(answer.locator(".mealest-total")).toBeVisible();
    await audit(page, `the answer, calories shown, ${scheme}`);
    await answer.getByRole("button", { name: "Discard", exact: true }).click();
    // the Meals sheet with Meal photos off again: "Add a photo instead?"
    await gotoYou(page, "Solia Health's AI");
    await page.locator("#you-ai").getByRole("switch", { name: "Meal photos" }).click();
    await audit(page, `You, Meal photos off with Meal notes on, ${scheme}`);
    const log = await openLog(page);
    await log.getByRole("button", { name: "Meals", exact: true }).click();
    await expect(page.locator("#meals-sheet .mealphoto-instead")).toBeVisible();
    await audit(page, `Meals sheet, Add a photo instead, ${scheme}`);
    await targets(page, "#meals-sheet .mealphoto-instead button", `Add a photo instead ${scheme}`);
    await ctx.close();
  });

  test(`the Meal photos card in every state (gallery) in nine styles, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    for (const style of STYLES) {
      await gotoGallery(page, { stage: "cycle", scheme, style: style.toLowerCase() });
      for (const st of ["noserver", "signin", "pro", "off", "on"]) await expect(page.locator(`#dg-meal-${st}`)).toHaveAttribute("data-state", st);
      await expect(page.locator("#dg-meal-noserver").getByRole("button")).toHaveText(["Hide this card"]); // no server: the line, and no main button
      await expect(page.locator("#dg-meal-noserver")).toContainText("Meal photos need Solia Health's server, which this version doesn't have.");
      await expect(page.locator("#dg-meal-signin").getByRole("button")).toHaveText(["Sign in to use meal photos", "Not now"]);
      await expect(page.locator("#dg-meal-pro").getByRole("button")).toHaveText(["See Pro", "Not now"]);
      await audit(page, `gallery, Meal photos states, ${style} ${scheme}`, '[id^="dg-meal-"]');
      await targets(page, '[id^="dg-meal-"] button', `gallery Meal photos ${style} ${scheme}`);
    }
    await ctx.close();
  });
}
