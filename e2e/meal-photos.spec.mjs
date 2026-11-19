/* Meal photos (docs/plans/meal-photos.md), against the mocked backend (API build, proDev = Pro, signed in by email):
   - with the switch off, Meal notes has no photo button and no file input, and nothing is sent;
   - with it on: the photo is made smaller on the device, "What Solia Health will send" shows the exact picture, nothing
     goes before Send, Cancel discards it, and the request carries exactly the previewed image and nothing from her log;
   - the answer can be edited and trimmed before it is saved; only what she saves is kept, never the photo;
   - "Show calorie estimates" off hides every number and keeps the food names;
   - not food, and the monthly limit, say so plainly and add nothing. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoTab, openLog, toast, gotoYou } from "./lib/nav.mjs";
import { mockApi, newApiState, TOKEN } from "./lib/api.mjs";
import { plateFile } from "./lib/photo.mjs";

const ANSWER = { provider: "claude-opus-5-5", food: true, sure: "medium", total: { low: 470, high: 720 }, items: [
  { name: "White rice", portion: "about 1 cup", low: 180, high: 260 },
  { name: "Lentil curry", portion: "a small bowl", low: 220, high: 340 },
  { name: "Steamed greens", portion: "a handful", low: 70, high: 120 },
] };
const mealCalls = (state) => state.sent.filter((r) => r.path === "/api/ai/meal");

async function start(page, state) {
  await mockApi(page, state);
  await register(page, { url: process.env.E2E_API_URL, stage: "My Cycle", signin: "email" });
  await gotoYou(page, "Your profile");
  await page.locator("#you-modules").getByRole("switch", { name: "Meal notes" }).click();
  await gotoYou(page, "Solia Health's AI"); // every test starts on the AI page, where the Meal photos switch is
}
async function openMeals(page, slot = "Lunch") {
  const log = await openLog(page);
  await log.getByRole("button", { name: "Meals", exact: true }).click();
  const sheet = page.locator("#meals-sheet");
  await expect(sheet).toBeVisible();
  if (slot) await sheet.locator(".mealslots").getByRole("button", { name: slot, exact: true }).click();
  return sheet;
}
const photosOn = async (page) => { if (!(await page.locator("#you-ai").count())) await gotoYou(page, "Solia Health's AI"); await page.locator("#you-ai").getByRole("switch", { name: "Meal photos" }).click(); };

test("Meal photos off (the default): Meal notes has no photo button, no file input and no calorie figure, and nothing is sent", async ({ page }) => {
  const state = newApiState({ meal: () => ({ status: 200, json: ANSWER }) });
  await start(page, state);
  const sw = page.locator("#you-ai").getByRole("switch", { name: "Meal photos" });
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("#you-ai").getByRole("switch", { name: "Show calorie estimates" })).toHaveCount(0);
  await gotoYou(page, "Your profile");
  await expect(page.locator("#you-modules")).toContainText("No photos or calorie estimates unless you turn on Meal photos.");
  const sheet = await openMeals(page);
  await sheet.getByRole("button", { name: "Balanced", exact: true }).click();
  await sheet.getByRole("button", { name: "Steady", exact: true }).click();
  await expect(sheet.getByRole("button", { name: /photo/i })).toHaveCount(0);
  await expect(sheet.locator('input[type="file"]')).toHaveCount(0);
  await expect(sheet.getByRole("switch")).toHaveCount(0);
  await expect(sheet).not.toContainText("kcal");
  await expect(sheet).toContainText("No scores and no targets. No photos or calorie estimates unless you turn on Meal photos in You → Solia Health's AI.");
  await expect(sheet.locator(".meallist li")).toHaveText(["Lunch · Balanced · energy steadyRemove"]);
  expect(mealCalls(state)).toHaveLength(0);
  expect(state.sent.some((r) => /meal/.test(r.path))).toBe(false);
});

test("Meal photos on: the exact previewed picture is what is sent, with nothing from her log; edit and remove before saving; hide calories", async ({ page }) => {
  const state = newApiState({
    usage: { usage: { evidence: { used: 0, limit: 30 }, chat: { used: 0, limit: 100 }, weekly: { used: 0, limit: 6 }, meal: { used: 4, limit: 60 } }, resetsOn: "2026-12-01" },
    meal: () => ({ status: 200, json: { ...ANSWER, usage: { kind: "meal", used: 5, limit: 60, resetsOn: "2026-12-01" } } }),
  });
  await start(page, state);
  await photosOn(page);
  await expect(toast(page)).toHaveText("Meal photos on. Nothing is sent until you tap Send.");
  const ai = page.locator("#you-ai");
  await expect(ai.getByRole("switch", { name: "Meal photos" })).toHaveAttribute("aria-checked", "true");
  await expect(ai.getByRole("switch", { name: "Show calorie estimates" })).toHaveAttribute("aria-checked", "true");
  await expect(ai).toContainText("Solia Health's server never keeps the photo or the answer.");
  expect(mealCalls(state)).toHaveLength(0);

  let sheet = await openMeals(page);
  await sheet.getByRole("button", { name: "Mostly carbs or sweet", exact: true }).click();
  await sheet.getByRole("button", { name: "Dipped", exact: true }).click();
  await expect(sheet.locator(".aileft")).toHaveText("56 of 60 meal photos left this month.");
  const input = sheet.locator('input[type="file"]');
  await expect(input).toHaveAttribute("accept", "image/*");
  await expect(input).toHaveAttribute("capture", "environment");
  await expect(sheet.getByRole("button", { name: "Add from a photo" })).toBeVisible();

  // pick a 1600 × 1200 photo: it is made smaller here, then shown; nothing has gone
  await input.setInputFiles(plateFile(1600, 1200));
  const send = page.locator("#meal-send-sheet");
  await expect(send.getByRole("heading", { name: "What Solia Health will send" })).toBeVisible();
  await expect(page.locator("#meals-sheet")).toHaveCount(0); // one dialog, never two
  const img = send.locator(".mealsend-img");
  await expect(img).toBeVisible();
  expect(await img.evaluate((el) => [el.naturalWidth, el.naturalHeight])).toEqual([1024, 768]);
  await expect(send).toContainText("Made smaller on this device: 1024 × 768 pixels");
  await expect(send).toContainText("Nothing from your log: no stage, no notes, no meal details.");
  await expect(send).toContainText("Your sign-in goes with the request, so Solia Health's server can count it toward this month.");
  await expect(send).toContainText("Photograph only the food.");
  expect(mealCalls(state)).toHaveLength(0);

  // Cancel discards the photo: nothing is sent, and the Meals sheet is back without it
  await send.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(toast(page)).toHaveText("Photo discarded. Nothing was sent.");
  await expect(page.locator("#meal-send-sheet")).toHaveCount(0);
  sheet = page.locator("#meals-sheet");
  await expect(sheet).toBeVisible();
  await expect(page.locator("img.mealsend-img")).toHaveCount(0);
  expect(mealCalls(state)).toHaveLength(0);

  // again, and Send
  await sheet.locator('input[type="file"]').setInputFiles(plateFile(1600, 1200));
  await expect(send).toBeVisible();
  const shownSrc = await send.locator(".mealsend-img").getAttribute("src");
  expect(shownSrc.startsWith("data:image/jpeg;base64,")).toBe(true);
  await send.getByRole("button", { name: "Send", exact: true }).click();
  const answer = page.locator("#meal-answer-sheet");
  await expect(answer.getByRole("heading", { name: "What the photo shows" })).toBeVisible();

  // the request: exactly the previewed image, her sign-in for the count, and nothing else
  const calls = mealCalls(state);
  expect(calls).toHaveLength(1);
  expect(calls[0].method).toBe("POST");
  expect(Object.keys(calls[0].body)).toEqual(["image"]);
  expect(Object.keys(calls[0].body.image).sort()).toEqual(["data", "media_type"]);
  expect(calls[0].body.image.media_type).toBe("image/jpeg");
  expect(`data:image/jpeg;base64,${calls[0].body.image.data}`).toBe(shownSrc);
  expect(calls[0].auth).toBe(`Bearer ${TOKEN}`);
  expect(calls[0].search).toBe("");
  expect(calls[0].cookie).toBeNull();
  const bytes = Buffer.from(calls[0].body.image.data, "base64");
  expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xff, 0xd8, 0xff]); // a JPEG
  expect(bytes.length).toBeLessThan(1_048_576);
  expect(bytes.includes(Buffer.from("Exif"))).toBe(false); // redrawn: no EXIF block
  expect(JSON.stringify({ ...calls[0].body, image: { ...calls[0].body.image, data: "" } })).toBe('{"image":{"media_type":"image/jpeg","data":""}}');
  expect(calls[0].headers.filter((h) => /^x-|stage|log|meal/i.test(h))).toEqual([]);

  // the answer: every figure a range and an estimate; edit a name, remove a food, then save
  await expect(answer.locator(".mealfood")).toHaveCount(3);
  await expect(answer.locator(".mealfood").nth(0)).toContainText("about 1 cup · 180–260 kcal");
  await expect(answer.locator(".mealest-total")).toContainText("Total 470–720 kcal");
  await expect(answer).toContainText("A rough estimate from a photo. It can be well off.");
  await expect(answer).toContainText("How sure the AI is: Fairly sure.");
  await expect(answer).toContainText("Solia Health doesn't keep the photo, on this device or on its server.");
  await expect(page.locator("img.mealsend-img")).toHaveCount(0); // the picture is gone from the page
  await answer.getByLabel("Food 1").fill("Brown rice");
  await answer.getByRole("button", { name: "Remove Steamed greens" }).click();
  await expect(answer.locator(".mealfood")).toHaveCount(2);
  await expect(answer.locator(".mealest-total")).toContainText("Total 400–600 kcal");
  await answer.getByRole("button", { name: "Save to this meal note" }).click();

  // saved in the meal note, marked as estimated from a photo; the rest of the note is as it was
  sheet = page.locator("#meals-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".mealest-tag")).toHaveText("Estimated from a photo");
  await expect(sheet.locator(".mealest-list li")).toHaveText(["Brown riceabout 1 cup · 180–260 kcal180 to 260 kilocalories", "Lentil currya small bowl · 220–340 kcal220 to 340 kilocalories"]);
  await expect(sheet.locator(".mealest-total")).toContainText("Total 400–600 kcal");
  await expect(sheet.locator(".meallist li").first()).toContainText("Lunch · Mostly carbs or sweet · energy dipped");
  await expect(sheet.locator(".meallist li").first()).toContainText("Brown rice, Lentil curry · 400–600 kcal");
  await expect(sheet.locator(".mealday-total")).toContainText("Day total from 1 photo: 400–600 kcal");
  await expect(sheet.locator(".mealday-total")).toContainText("A rough estimate from a photo. It can be well off.");
  await expect(sheet.locator(".aileft")).toHaveText("55 of 60 meal photos left this month.");
  await expect(sheet.getByRole("button", { name: "Replace with a new photo" })).toBeVisible();
  // no judgement, target or colour word anywhere in the sheet
  expect(await sheet.innerText()).not.toMatch(/\b(goal|target left|over|under|too much|healthy|unhealthy|good|bad|burn|deficit)\b/i);

  // hide calories: every number goes, the food names stay
  const cal = sheet.getByRole("switch", { name: "Show calorie estimates" });
  await expect(cal).toHaveAttribute("aria-checked", "true");
  await cal.click();
  await expect(cal).toHaveAttribute("aria-checked", "false");
  await expect(sheet.locator(".mealest-list li")).toHaveText(["Brown rice", "Lentil curry"]);
  await expect(sheet.locator(".mealest-total")).toHaveCount(0);
  await expect(sheet.locator(".mealday-total")).toHaveCount(0);
  await expect(sheet.locator(".meallist li").first()).toContainText("Brown rice, Lentil curry");
  expect(await sheet.locator(".mealest, .meallist").allInnerTexts().then((a) => a.join(" "))).not.toMatch(/kcal|kilocalor|\d/);

  // kept on the device after a reload, without any picture; the hide switch is remembered and shows in You too
  await sheet.getByRole("button", { name: "Done", exact: true }).click();
  await page.waitForTimeout(1500); // the record's save on this device settles
  await page.reload();
  await gotoYou(page, "Solia Health's AI");
  await expect(page.locator("#you-ai").getByRole("switch", { name: "Show calorie estimates" })).toHaveAttribute("aria-checked", "false");
  sheet = await openMeals(page, null);
  await expect(sheet.locator(".mealest-list li")).toHaveText(["Brown rice", "Lentil curry"]);
  await sheet.getByRole("switch", { name: "Show calorie estimates" }).click();
  await expect(sheet.locator(".mealest-total")).toContainText("Total 400–600 kcal");
  // what this device holds (IndexedDB and localStorage): the foods she saved, and no picture
  const stored = await page.evaluate(async () => {
    let out = Object.keys(localStorage).map((k) => localStorage.getItem(k)).join("\n");
    for (const d of await indexedDB.databases()) {
      const db = await new Promise((res, rej) => { const r = indexedDB.open(d.name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      for (const s of db.objectStoreNames) out += JSON.stringify(await new Promise((res) => { const r = db.transaction(s).objectStore(s).getAll(); r.onsuccess = () => res(r.result); }));
      db.close();
    }
    return out;
  });
  expect(stored).toContain("Brown rice");
  expect(stored).not.toMatch(/data:image|\/9j\/|"image"|"photo"/);

  // she can remove the estimate; the meal note stays
  await sheet.getByRole("button", { name: "Remove this estimate" }).click();
  await expect(sheet.locator(".mealest")).toHaveCount(0);
  await expect(sheet.locator(".meallist li").first()).toContainText("Lunch · Mostly carbs or sweet · energy dipped");
  expect(mealCalls(state)).toHaveLength(1);
});

test("Meal photos: not food adds nothing; the monthly limit and a failed read say so; turning the switch off removes the button", async ({ page }) => {
  let mode = "notfood";
  const state = newApiState({ meal: () => (mode === "notfood" ? { status: 200, json: { provider: "claude-opus-5-5", food: false, items: [], total: { low: 0, high: 0 }, sure: "low", usage: { kind: "meal", used: 59, limit: 60, resetsOn: "2026-12-01" } } }
    : mode === "limit" ? { status: 429, json: { error: "monthly-limit", kind: "meal", used: 60, limit: 60, resetsOn: "2026-12-01" } }
    : mode === "hostile" ? { status: 200, json: { provider: "x", food: true, sure: "high", advice: "eat less", items: [{ name: "<img src=x onerror=window.__pwned=1>Soup", portion: "1 bowl", low: 900, high: 100, score: 2 }, { name: "Feast", portion: "all", low: 1, high: 999999 }] } }
    : { status: 502, json: { error: "no-answer" } }) });
  await start(page, state);
  await photosOn(page);
  let sheet = await openMeals(page, "Dinner");
  const shoot = async () => {
    await page.locator('#meals-sheet input[type="file"]').setInputFiles(plateFile(640, 480));
    await page.locator("#meal-send-sheet").getByRole("button", { name: "Send", exact: true }).click();
  };
  await shoot();
  sheet = page.locator("#meals-sheet");
  await expect(sheet.locator(".mealphoto-note")).toHaveText("That didn't look like food, or it was too unclear to read, so nothing was added. It still counted toward this month.");
  await expect(sheet.locator(".mealest")).toHaveCount(0);
  await expect(page.locator("#meal-answer-sheet")).toHaveCount(0);
  await expect(sheet.locator(".aileft")).toHaveText("1 of 60 meal photos left this month.");
  mode = "fail";
  await shoot();
  await expect(sheet.locator(".mealphoto-note")).toHaveText("No answer came back, and it didn't count toward this month. Try again in a moment.");
  mode = "limit";
  await shoot();
  await expect(sheet.locator(".mealphoto-note")).toHaveText("You've used this month's 60 meal photos, so this one wasn't read and nothing went to Anthropic. They start again on December 1.");
  await expect(sheet.locator(".aileft")).toHaveText("0 of 60 meal photos left this month.");
  // a hostile answer: markup becomes plain words, the swapped range is put right, the absurd item is dropped
  mode = "hostile";
  await shoot();
  const answer = page.locator("#meal-answer-sheet");
  await expect(answer.locator(".mealfood")).toHaveCount(1);
  await expect(answer.getByLabel("Food 1")).toHaveValue("img src x onerror window. pwned 1 Soup");
  await expect(answer.locator(".mealfood")).toContainText("1 bowl · 100–900 kcal");
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  await expect(answer).not.toContainText("eat less");
  // Discard keeps nothing
  await answer.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(toast(page)).toHaveText("Discarded. Nothing was saved.");
  sheet = page.locator("#meals-sheet");
  await expect(sheet.locator(".mealest")).toHaveCount(0);
  // a file that is not a picture never leaves the device
  const n = mealCalls(state).length;
  await sheet.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a picture") });
  await expect(sheet.locator(".mealphoto-note")).toHaveText("That file couldn't be read as a photo. Nothing was sent.");
  expect(mealCalls(state)).toHaveLength(n);
  // switch off: the button and the input go
  await sheet.getByRole("button", { name: "Done", exact: true }).click();
  await gotoYou(page, "Solia Health's AI");
  await photosOn(page);
  await expect(toast(page)).toHaveText("Meal photos off. Nothing more will be sent.");
  sheet = await openMeals(page, null);
  await expect(sheet.getByRole("button", { name: /photo/i })).toHaveCount(0);
  await expect(sheet.locator('input[type="file"]')).toHaveCount(0);
  expect(mealCalls(state)).toHaveLength(n);
});
