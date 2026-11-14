/* Task A (docs/plans/partner-learn-glucose-shop.md): Share with a partner, more feelings, Learn. Demo build (no server). */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoTab } from "./lib/nav.mjs";

test("Learn: 'What does this mean?' beside the ring and the fertile row opens a sourced explainer; You → Learn lists them all", async ({ page }) => {
  await register(page, { stage: "Trying to conceive", pcos: "no" });
  const ringLink = page.locator(".homehero .learnlink[data-learn='cycle']");
  await expect(ringLink).toBeVisible();
  // The fertile-window row shows only while the window is ahead (date-dependent on the demo seed); when it shows, so does its link.
  if (await page.locator(".herorows").count()) await expect(page.locator(".herorows .learnlink[data-learn='fertile']")).toBeVisible();
  await ringLink.click();
  const sheet = page.getByRole("dialog", { name: "The menstrual cycle and its phases" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("so it's an estimate");
  await sheet.getByRole("button", { name: "Sources" }).click();
  await expect(sheet).toContainText("ACOG Committee Opinion 651");
  await sheet.getByRole("button", { name: /^Close/ }).click();
  await expect(page.locator("#learn-sheet")).toHaveCount(0);
  await gotoTab(page, "You");
  const card = page.locator("#you-learn");
  await expect(card.locator(".learnrow")).toHaveCount(9);
  await expect(card.locator(".learnrow").first()).toContainText("fertile window"); // Trying to conceive: the fertile window first
  await card.getByRole("button", { name: /Blood glucose, CGMs and time in range/ }).click();
  await expect(page.locator("#learn-sheet")).toContainText("Ask your clinician about your targets.");
});

test("More feelings: the first row as before, 14 more behind a disclosure, and a sheet with what each word means", async ({ page }) => {
  await register(page, { stage: "My Cycle" });
  await gotoTab(page, "Mind");
  const card = page.locator("#mood-card");
  await expect(card.locator(".feelchips").first().locator(".feelchip")).toHaveCount(10);
  await card.getByRole("button", { name: "More feelings" }).click();
  await card.getByRole("button", { name: "Grateful", exact: true }).click();
  await expect(card.getByRole("button", { name: "Grateful", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(card.locator(".feelchip")).toHaveCount(24);
  await card.getByRole("button", { name: "What these words mean" }).click();
  const sheet = page.getByRole("dialog", { name: "What these words mean" });
  await expect(sheet.locator(".feelword")).toHaveCount(24);
  await expect(sheet).toContainText("Wanting time to yourself.");
  await sheet.getByRole("button", { name: /^Close/ }).click();
  // the pick is kept: after a reload the disclosure opens by itself on the picked feeling
  await page.waitForTimeout(1500); // the record's save on this device settles
  await page.reload();
  await expect(page.locator(".navpill")).toBeVisible();
  await gotoTab(page, "Mind");
  await expect(page.locator("#mood-card").getByRole("button", { name: "Grateful", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("Share with a partner: only what she ticks is in the message; the fertile window only for Trying to conceive; copied on the web", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); } catch { /* none */ } });
  await register(page, { stage: "Trying to conceive", pcos: "no" });
  await gotoTab(page, "You");
  await page.locator("#you-partner").getByRole("button", { name: "Share with a partner" }).click();
  const sheet = page.getByRole("dialog", { name: "Share with a partner" });
  const box = (name) => sheet.getByRole("checkbox", { name });
  await expect(box("When my next period is likely")).toHaveAttribute("aria-checked", "true");
  await expect(box("Today's cycle day and phase")).toHaveAttribute("aria-checked", "true");
  await expect(box("My estimated fertile window")).toHaveAttribute("aria-checked", "false");
  const preview = sheet.locator(".partnerpreview");
  await expect(preview).toContainText("It's an estimate");
  await expect(preview).not.toContainText("fertile window is");
  await box("My estimated fertile window").click();
  await expect(preview).toContainText("My estimated fertile window is");
  await box("Today's cycle day and phase").click();
  await expect(preview).not.toContainText("Today is day");
  await sheet.getByLabel("A short note (optional)").fill("Dinner at home Saturday?");
  await expect(preview).toContainText("Dinner at home Saturday?");
  await expect(sheet).toContainText("Reminders to send an update work in the Solia Health app on a phone.");
  await expect(sheet.getByRole("switch")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("Copied");
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("My next period is likely to start between");
  expect(text).toContain("My estimated fertile window is");
  expect(text).toContain("Dinner at home Saturday?");
  expect(text).not.toMatch(/Today is day|symptom|mood|sourceId|stage/i);
  await ctx.close();

  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const p2 = await ctx2.newPage();
  await register(p2, { stage: "My Cycle" });
  await gotoTab(p2, "You");
  await p2.locator("#you-partner").getByRole("button", { name: "Share with a partner" }).click();
  await expect(p2.getByRole("dialog", { name: "Share with a partner" }).getByRole("checkbox")).toHaveCount(2);
  await expect(p2.locator(".partnerpreview")).not.toContainText("fertile");
  await ctx2.close();
});

test("Share with a partner is not offered in pregnancy or menopause", async ({ page }) => {
  await register(page, { stage: "Pregnant" });
  await gotoTab(page, "You");
  await expect(page.locator("#you-partner")).toHaveCount(0);
  await expect(page.locator("#you-learn")).toBeVisible();
});
