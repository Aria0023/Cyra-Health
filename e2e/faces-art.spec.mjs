/* Check-in faces and stage illustrations (2026-11-25, docs/plans/critique-fixes.md Task 6): each quick check-in answer
   has a face (inline SVG, decorative) over its word; a picked answer and a picked mood also carry a tick, so the choice
   never rests on colour; the values saved are unchanged. One illustration per life stage, decorative, on the
   registration stage cards and the stage card on You. */
import { test, expect } from "@playwright/test";
import { register, STAGES } from "./lib/onboard.mjs";
import { gotoTab, gotoYou } from "./lib/nav.mjs";

test("quick check-in: a face over every answer, the word under it, a tick on the one picked", async ({ page }) => {
  await register(page, { stage: "Perimenopause", pcos: "no" });
  await gotoYou(page, "Devices & reminders");
  const style = page.locator("#you-checkins").getByRole("button", { name: /Check-in style|Rhythm, time and style/ });
  await style.click();
  await page.getByRole("button", { name: "Quick · 3 taps" }).click();
  await gotoTab(page, "Body");
  const q = page.locator(".plaincard", { hasText: "Any hot flashes or night sweats?" });
  await expect(q.locator("button.qface")).toHaveCount(12);
  await expect(q.locator("button.qface svg.moodface[aria-hidden='true']")).toHaveCount(12);
  const group = q.getByRole("group", { name: "Any hot flashes or night sweats?" });
  await expect(group.getByRole("button")).toHaveText(["No / fine", "A little", "Yes", "A lot"]);
  await group.getByRole("button", { name: "A little" }).click();
  await expect(group.getByRole("button", { name: "A little" })).toHaveAttribute("aria-pressed", "true");
  await expect(group.locator("button.on .qface-tick")).toHaveCount(1);
  for (const b of await q.locator("button.qface").all()) { const box = await b.boundingBox(); expect(box.height).toBeGreaterThanOrEqual(44); }
  // Mind: the mood faces keep their words; the picked one carries a tick too
  await gotoTab(page, "Mind");
  const mood = page.locator("#mood-card .moodrow");
  await mood.locator(".moodbtn").nth(3).click();
  await expect(mood.locator(".moodbtn.on .moodtick")).toHaveCount(1);
});

test("stage illustrations: one per stage on the registration cards, and the stage card on You", async ({ page }) => {
  await page.goto(`${process.env.E2E_URL}/`);
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "Continue for now" }).click();
  const cards = page.locator(".stagecard");
  await expect(cards).toHaveCount(5);
  const arts = await cards.evaluateAll((cs) => cs.map((c) => { const s = c.querySelector("svg.stageart"); return s ? `${s.getAttribute("data-art")}:${s.getAttribute("aria-hidden")}` : null; }));
  expect(arts).toEqual(["cycle:true", "ttc:true", "preg:true", "peri:true", "meno:true"]);
  await expect(cards.first()).toHaveAccessibleName(/^My Cycle/);
  expect(STAGES).toHaveLength(5);
  await register(page, { stage: "Menopause & beyond", resume: true, signin: null });
  await gotoYou(page, "Your profile");
  await expect(page.locator("#you-stage svg.stageart")).toHaveAttribute("data-art", "meno");
  await page.getByRole("tab", { name: "You", exact: true }).click();
  await expect(page.locator(".youstage svg.stageart")).toHaveAttribute("data-art", "meno");
});
