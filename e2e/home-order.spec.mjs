/* Home has one first job (2026-11-25, docs/plans/critique-fixes.md Task 2): Quick log right under the hero, then the
   small step or Getting started, Ask Solia, the rails and Today's insight; everything else in ONE folded group, "More for
   today", whose open/closed state stays on this device. The ring with no period start says "No cycle yet" in words; the
   sign-up estimate says it sharpens; Trying to conceive shows "Solia Health is not a contraceptive." on the fertile views. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoTab, gotoSegment, openHomeMore } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

const orderOf = (page) => page.locator("main.homev2").evaluate((m) => {
  const want = { "#quicklog-t": "quicklog", ".stepcard": "step", ".asksolia": "ask", ".railcards": "rails", ".insightcard": "insight", ".disclosure.homemore": "more", "#home-devices": "devices", ".mscard": "milestones", ".dgrid": "sections" };
  const found = Object.entries(want).map(([sel, name]) => [name, m.querySelector(sel)]).filter(([, el]) => el);
  return found.sort(([, a], [, b]) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)).map(([n]) => n);
});

test("Home: Quick log first, the rest in one folded group that remembers its state", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "no" });
  expect(await orderOf(page)).toEqual(["quicklog", "step", "ask", "rails", "insight", "more", "devices", "milestones", "sections"]);
  const more = page.getByRole("button", { name: "More for today" });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#home-more")).toBeHidden();
  await expect(page.locator(".mscard")).toBeHidden();
  // Quick log starts in the first screen
  const ql = await page.locator("#quicklog-t").boundingBox();
  expect(ql.y).toBeLessThan(844);
  await more.click();
  await expect(more).toHaveAttribute("aria-controls", "home-more");
  await expect(page.locator(".mscard")).toBeVisible();
  await expect(page.locator(".dgrid .disclosure")).toHaveCount(5);
  // remembered on this device
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.locator(".navpill")).toBeVisible();
  await expect(page.getByRole("button", { name: "More for today" })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "More for today" }).click();
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.getByRole("button", { name: "More for today" })).toHaveAttribute("aria-expanded", "false");
});

test("Home: a section panel that opens while the group is folded opens the group first", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "no" });
  await openHomeMore(page);
  await page.getByRole("button", { name: /^Appointments/ }).click();
  await expect(page.locator("#home-appts")).toBeVisible();
  await page.getByRole("button", { name: "More for today" }).click(); // fold it with the panel open
  await expect(page.locator("#home-appts")).toBeHidden();
  const door = page.locator(".dgrid .disclosure", { hasText: "Appointments" }); // still in the page while folded
  await door.evaluate((b) => b.click());
  await expect(page.locator("#home-appts")).toHaveCount(0); // closing the panel while folded doesn't open the group
  await expect(page.getByRole("button", { name: "More for today" })).toHaveAttribute("aria-expanded", "false");
  await door.evaluate((b) => b.click());
  await expect(page.getByRole("button", { name: "More for today" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#home-appts")).toBeVisible();
});

test("the ring with no period start says so in words; the date is small; the row is the way in", async ({ page }) => {
  await mockApi(page, newApiState());
  await register(page, { url: process.env.E2E_API_URL, stage: "Perimenopause", pcos: "no", signin: "email" });
  const ring = page.locator(".homehero .heroring .ringwrap");
  await expect(ring.locator("b")).toHaveText("No cycle yet");
  await expect(ring).toHaveAccessibleName(/^No cycle yet, [A-Z][a-z]+ \d+$/);
  const line = page.locator(".homehero .heroline");
  await expect(line).toContainText("Log a period start to see your cycle day");
  await line.click();
  await expect(page.locator(".viewpanel main h1")).toBeVisible();
});

test("the sign-up estimate says it sharpens as she logs, and what a watch or ring adds (this bundle offers sources)", async ({ page }) => {
  await mockApi(page, newApiState());
  await register(page, { url: process.env.E2E_API_URL, stage: "My Cycle", pcos: "no", signin: "email", lastPeriod: "2026-11-10" });
  const line = page.locator(".homehero .heroline");
  await expect(line).toContainText("Based on your sign-up answer");
  await expect(line.locator(".heroline-more")).toHaveText("It sharpens as you log your periods. A watch or ring adds temperature, which often rises after ovulation.");
  // (a build without any source says only the first sentence: src/lib/home.test.mjs)
});

test("Trying to conceive: the not-for-contraception line on Home and beside the Calendar's fertile days", async ({ page, browser }) => {
  await register(page, { stage: "Trying to conceive", pcos: "no" });
  await expect(page.locator(".homehero .notcontra")).toHaveText("Solia Health is not a contraceptive.");
  await gotoTab(page, "Body");
  await gotoSegment(page, "Calendar");
  await expect(page.locator(".calnotcontra")).toHaveText("Solia Health is not a contraceptive.");
  await expect(page.locator(".calnotcontra")).toBeVisible();
  // My Cycle without the goal: none of these lines
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const p2 = await ctx.newPage();
  await register(p2, { stage: "My Cycle", pcos: "no" });
  await expect(p2.locator(".notcontra")).toHaveCount(0);
  await ctx.close();
});
