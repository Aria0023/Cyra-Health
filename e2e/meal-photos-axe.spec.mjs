/* axe-core on the Meal photos screens (docs/plans/meal-photos.md), light and dark: the switch in You → Solia Health's
   AI, "What Solia Health will send" with a photo, the answer with edit and remove, a saved meal note with calories, and
   the same with calories hidden. 0 violations. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register } from "./lib/onboard.mjs";
import { gotoTab, openLog } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";
import { plateFile } from "./lib/photo.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const audit = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
};
const ANSWER = { provider: "claude-opus-5-5", food: true, sure: "medium", total: { low: 470, high: 720 }, items: [{ name: "White rice", portion: "about 1 cup", low: 180, high: 260 }, { name: "Lentil curry", portion: "a small bowl", low: 220, high: 340 }, { name: "Steamed greens", portion: "a handful", low: 70, high: 120 }], usage: { kind: "meal", used: 5, limit: 60, resetsOn: "2026-12-01" } };

for (const scheme of ["light", "dark"]) {
  test(`Meal photos: the switch, the send sheet, the answer and a saved note, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await mockApi(page, newApiState({ meal: () => ({ status: 200, json: ANSWER }) }));
    await register(page, { url: process.env.E2E_API_URL, stage: "My Cycle", signin: "email" });
    await gotoTab(page, "You");
    await page.locator("#you-modules").getByRole("switch", { name: "Meal notes" }).click();
    await page.locator("#you-ai").getByRole("switch", { name: "Meal photos" }).click();
    await expect(page.locator("#you-ai").getByRole("switch", { name: "Show calorie estimates" })).toBeVisible();
    await audit(page, `You, Meal photos on ${scheme}`);
    const log = await openLog(page);
    await log.getByRole("button", { name: "Meals", exact: true }).click();
    const sheet = page.locator("#meals-sheet");
    await sheet.locator(".mealslots").getByRole("button", { name: "Lunch", exact: true }).click();
    await expect(sheet.getByRole("button", { name: "Add from a photo" })).toBeVisible();
    await audit(page, `Meals sheet with the photo button ${scheme}`);
    await sheet.locator('input[type="file"]').setInputFiles(plateFile(1600, 1200));
    const send = page.locator("#meal-send-sheet");
    await expect(send.locator(".mealsend-img")).toBeVisible();
    await audit(page, `What Solia Health will send, a photo ${scheme}`);
    await send.getByRole("button", { name: "Send", exact: true }).click();
    const answer = page.locator("#meal-answer-sheet");
    await expect(answer.locator(".mealfood")).toHaveCount(3);
    await audit(page, `the answer ${scheme}`);
    await answer.getByRole("button", { name: "Save to this meal note" }).click();
    await expect(page.locator("#meals-sheet .mealest-total")).toBeVisible();
    await audit(page, `a saved meal note with calories ${scheme}`);
    await page.locator("#meals-sheet").getByRole("switch", { name: "Show calorie estimates" }).click();
    await expect(page.locator("#meals-sheet .mealest-total")).toHaveCount(0);
    await audit(page, `a saved meal note, calories hidden ${scheme}`);
    await ctx.close();
  });
}
