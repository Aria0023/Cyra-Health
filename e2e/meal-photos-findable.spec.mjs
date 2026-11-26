/* Meal photos, findable (docs/plans/meal-photos-findable.md), against the mocked backend (API build, proDev = Pro):
   - the Body tab has a "Meal photos" card wherever Meal notes is offered, even while everything is off; never in
     Pregnancy or Menopause, and never in a build without the ai flag;
   - "Turn on meal photos" is ONE sheet: it turns on Meal notes and Meal photos together, applies her calorie choice,
     and sends nothing; "Not now" changes nothing;
   - with it on, the card's own "Take a photo" / "Choose a photo" lead to the same preview and Send as the Meals sheet;
     the answer asks which of today's meals it was; a photo that isn't food comes back to the card with the reason;
   - the Meals sheet's "Add a photo instead?" line and the row in You → Solia Health's AI open the same sheet;
   - the answer's "Show them" shows the calorie estimates in one tap;
   - "Not now" hides the card on this device, and the feature stays in You and the Meals sheet;
   - a guest is offered "Sign in to use meal photos", which opens the app's own "Create your account".
   The no-server and not-Pro states have no bundle here: lib/mealPhoto.test.mjs covers every branch of mealCardState and
   meal-photos-findable-axe.spec.mjs shows all five states in the dev gallery. */
import { test, expect } from "@playwright/test";
import { register, emailSignIn } from "./lib/onboard.mjs";
import { gotoTab, openLog, toast, gotoYou } from "./lib/nav.mjs";
import { mockApi, newApiState, TOKEN } from "./lib/api.mjs";
import { plateFile } from "./lib/photo.mjs";

const ANSWER = { provider: "x", food: true, sure: "medium", total: { low: 470, high: 720 }, items: [
  { name: "White rice", portion: "about 1 cup", low: 180, high: 260 },
  { name: "Lentil curry", portion: "a small bowl", low: 220, high: 340 },
  { name: "Steamed greens", portion: "a handful", low: 70, high: 120 },
] };
const NOT_FOOD = { provider: "x", food: false, items: [], total: { low: 0, high: 0 }, sure: "low" };
const mealCalls = (state) => state.sent.filter((r) => r.path === "/api/ai/meal");
const card = (page) => page.locator("#body-mealphotos");
const LEAD = "Photograph a meal. Solia Health's AI names the foods and can give a rough calorie range.";
const ADDS = "When you choose a photo in Meal notes, Solia Health makes it smaller on this device, shows you the exact picture, and sends it only when you tap Send.";

async function start(page, state, { stage = "My Cycle", signin = "email" } = {}) {
  await mockApi(page, state);
  await register(page, { url: process.env.E2E_API_URL, stage, signin });
  await gotoTab(page, "Body");
}
async function openMeals(page, slot = "Lunch") {
  const log = await openLog(page);
  await log.getByRole("button", { name: "Meals", exact: true }).click();
  const sheet = page.locator("#meals-sheet");
  await expect(sheet).toBeVisible();
  if (slot) await sheet.locator(".mealslots").getByRole("button", { name: slot, exact: true }).click();
  return sheet;
}

test("the card is on Body wherever Meal notes is offered, even with everything off; never in Pregnancy or Menopause, or without the ai flag", async ({ browser }) => {
  const open = async (stage, url) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    if (url) { await register(page, { url, stage }); await gotoTab(page, "Body"); } else await start(page, newApiState({}), { stage });
    return [ctx, page];
  };
  for (const stage of ["My Cycle", "Trying to conceive", "Perimenopause"]) {
    const [ctx, page] = await open(stage);
    await expect(card(page), stage).toHaveAttribute("data-state", "off");
    await expect(card(page).getByRole("heading", { name: "Meal photos" })).toBeVisible();
    await expect(card(page).locator(".mealcard-line")).toHaveText(`${LEAD} Pro, and only if you turn it on.`);
    await expect(card(page).locator(".mealcard-line strong")).toHaveText("Photograph a meal."); // the bold lead-in
    await expect(card(page).getByRole("button")).toHaveText(["Turn on meal photos", "Not now"]);
    await expect(card(page).locator('input[type="file"]')).toHaveCount(0);
    await ctx.close();
  }
  for (const stage of ["Pregnant", "Menopause & beyond"]) {
    const [ctx, page] = await open(stage);
    await expect(page.locator(".viewpanel main h1")).toBeVisible();
    await expect(card(page), stage).toHaveCount(0);
    await ctx.close();
  }
  // the other bundle has no ai flag (and no server): no card, and no way in from the Meals sheet
  const [ctx, page] = await open("My Cycle", process.env.E2E_URL);
  await expect(page.locator(".viewpanel main h1")).toBeVisible();
  await expect(card(page)).toHaveCount(0);
  await ctx.close();
});

test("Turn on meal photos: one sheet turns on Meal notes and Meal photos together and sends nothing; then a photo straight from the card", async ({ page }) => {
  let mode = "notfood";
  const state = newApiState({ meal: () => ({ status: 200, json: mode === "notfood" ? NOT_FOOD : ANSWER }) });
  await start(page, state);
  await expect(card(page)).toHaveAttribute("data-state", "off");
  await page.waitForTimeout(600); // the app's start-up requests have gone
  const before = state.sent.length;

  // the one confirmation sheet: a short line on screen, the full text under Details, the calorie choice off
  const turnOn = card(page).getByRole("button", { name: "Turn on meal photos" });
  await turnOn.click();
  const on = page.locator("#meal-on-sheet");
  await expect(on.getByRole("heading", { name: "Turn on meal photos" })).toBeVisible();
  await expect(on.locator(".aisend-lead")).toHaveText("Turning this on sends nothing. Each photo goes only after you've seen it and tapped Send: through Solia Health's server, which doesn't keep it, to Anthropic, which keeps it for a limited time.");
  await expect(on.getByText(ADDS)).toBeHidden();
  await on.getByRole("button", { name: "Details" }).click();
  await expect(on.getByText(ADDS)).toBeVisible();
  await expect(on).toContainText("Nothing from your log goes with it. Solia Health's server never keeps the photo or the answer.");
  await expect(on).toContainText("This also turns on Meal notes, which is where the foods from a photo are saved.");
  await expect(on).toContainText("You can turn Meal photos off in You → Solia Health's AI, and Meal notes off in You → Your profile.");
  const cal = on.getByRole("switch", { name: "Show calorie estimates" });
  await expect(cal).toHaveAttribute("aria-checked", "false");
  await expect(on).toContainText("Off unless you turn it on: calorie figures and portion guesses stay hidden. The food names always show.");

  // Not now: nothing changes, and focus is back on the button that opened it
  await cal.click();
  await on.getByRole("button", { name: "Not now", exact: true }).click();
  await expect(on).toHaveCount(0);
  await expect(card(page)).toHaveAttribute("data-state", "off");
  await expect(turnOn).toBeFocused();
  await expect(toast(page)).not.toContainText("Meal"); // the toast element is always there; nothing was turned on, so it says nothing about meals

  // again, with calories on: both switches go on together, her choice is applied, and nothing is sent
  await turnOn.click();
  await expect(on.getByRole("switch", { name: "Show calorie estimates" })).toHaveAttribute("aria-checked", "false"); // the abandoned choice wasn't kept
  await on.getByRole("switch", { name: "Show calorie estimates" }).click();
  await on.getByRole("button", { name: "Turn on meal photos" }).click();
  await expect(on).toHaveCount(0);
  await expect(toast(page)).toHaveText("Meal notes and Meal photos are on. Nothing is sent until you tap Send.");
  await expect(card(page)).toHaveAttribute("data-state", "on");
  await expect(card(page).getByRole("button", { name: "Take a photo" })).toBeFocused();
  await expect(card(page).locator(".mealcard-line")).toHaveText(LEAD);
  await expect(card(page).locator(".mealcard-cal")).toContainText("Calories: shown");
  await expect(card(page)).toContainText("Photograph only the food. You'll see exactly what will be sent before anything goes.");
  await page.waitForTimeout(600);
  expect(state.sent.length, "turning it on made no request of any kind").toBe(before);

  // two ways in, as in the Meals sheet: the camera and the library
  const camera = card(page).locator('input[data-pick="camera"]'), library = card(page).locator('input[data-pick="library"]');
  await expect(camera).toHaveAttribute("capture", "environment");
  expect(await library.getAttribute("capture")).toBeNull();

  // a photo from the card: made smaller here, previewed, nothing gone; Cancel comes back to the card
  await camera.setInputFiles(plateFile(1600, 1200));
  const send = page.locator("#meal-send-sheet");
  await expect(send.getByRole("heading", { name: "What Solia Health will send" })).toBeVisible();
  expect(await send.locator(".mealsend-img").evaluate((el) => [el.naturalWidth, el.naturalHeight])).toEqual([1024, 768]);
  expect(mealCalls(state)).toHaveLength(0);
  await send.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(toast(page)).toHaveText("Photo discarded. Nothing was sent.");
  await expect(page.locator(".v2sheet")).toHaveCount(0);
  expect(mealCalls(state)).toHaveLength(0);

  // not food: back on the card with the reason, nothing added
  await library.setInputFiles(plateFile(640, 480));
  await send.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".v2sheet")).toHaveCount(0);
  await expect(card(page).locator(".mealphoto-note")).toHaveText("That didn't look like food, or it was too unclear to read, so nothing was added. It still counted toward this month.");
  expect(mealCalls(state)).toHaveLength(1);

  // food: exactly the previewed picture goes; the answer asks which meal, with one picked already
  mode = "food";
  await camera.setInputFiles(plateFile(1600, 1200));
  await expect(card(page).locator(".mealphoto-note")).toHaveCount(0);
  const shownSrc = await send.locator(".mealsend-img").getAttribute("src");
  await send.getByRole("button", { name: "Send", exact: true }).click();
  const answer = page.locator("#meal-answer-sheet");
  await expect(answer.getByRole("heading", { name: "What the photo shows" })).toBeVisible();
  const calls = mealCalls(state);
  expect(calls).toHaveLength(2);
  expect(Object.keys(calls[1].body)).toEqual(["image"]);
  expect(`data:image/jpeg;base64,${calls[1].body.image.data}`).toBe(shownSrc);
  expect(calls[1].auth).toBe(`Bearer ${TOKEN}`);
  await expect(answer.locator(".mealfood").nth(0)).toContainText("about 1 cup · 180–260 kcal"); // she chose to show calories
  const slots = answer.getByRole("group", { name: "Which meal was this?" });
  await expect(slots.getByRole("button")).toHaveText(["Breakfast", "Lunch", "Dinner", "Snack"]);
  await expect(slots.locator('button[aria-pressed="true"]')).toHaveCount(1);
  await slots.getByRole("button", { name: "Dinner", exact: true }).click();
  await expect(slots.getByRole("button", { name: "Dinner", exact: true })).toHaveAttribute("aria-pressed", "true");
  await answer.getByRole("button", { name: "Save to today's meal notes" }).click();

  // saved as today's Dinner, shown in the Meals sheet
  const sheet = page.locator("#meals-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".meallist li")).toHaveCount(1);
  await expect(sheet.locator(".meallist li").first()).toContainText("Dinner");
  await expect(sheet.locator(".meallist li").first()).toContainText("White rice, Lentil curry, Steamed greens · 470–720 kcal");
  await expect(sheet.locator(".mealest-tag")).toHaveText("Estimated from a photo");
  await sheet.getByRole("button", { name: "Done", exact: true }).click();

  // a second photo for the same meal says it will replace the first
  await library.setInputFiles(plateFile(800, 600));
  await send.getByRole("button", { name: "Send", exact: true }).click();
  await answer.getByRole("group", { name: "Which meal was this?" }).getByRole("button", { name: "Dinner", exact: true }).click();
  await expect(answer.locator(".mealanswer-slot .rfoot")).toHaveText("Dinner already has an estimate from a photo today. Saving replaces it.");
  await answer.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(toast(page)).toHaveText("Discarded. Nothing was saved.");
  await expect(page.locator(".v2sheet")).toHaveCount(0);

  // both switches are on in You, and "Change" on the card goes to the calorie switch
  await card(page).getByRole("button", { name: "Change whether calorie estimates show" }).click();
  await expect(page.locator(".yousub h1")).toHaveText("Solia Health's AI");
  const ai = page.locator("#you-ai");
  await expect(ai.getByRole("switch", { name: "Show calorie estimates" })).toBeFocused();
  await expect(ai.getByRole("switch", { name: "Show calorie estimates" })).toHaveAttribute("aria-checked", "true");
  await expect(ai.getByRole("switch", { name: "Meal photos" })).toHaveAttribute("aria-checked", "true");
  await gotoYou(page, "Your profile");
  await expect(page.locator("#you-modules").getByRole("switch", { name: "Meal notes" })).toHaveAttribute("aria-checked", "true");
});

test("the Meals sheet's line and the row in You open the same sheet; the answer's Show them shows calories in one tap", async ({ page }) => {
  const state = newApiState({ meal: () => ({ status: 200, json: ANSWER }) });
  await start(page, state);
  await gotoYou(page, "Your profile");
  await page.locator("#you-modules").getByRole("switch", { name: "Meal notes" }).click();

  // the Meals sheet, Meal notes on and photos off: one line and its link; the confirmation is a step of the same dialog
  let sheet = await openMeals(page);
  await expect(sheet.locator(".mealphoto-instead")).toHaveText("Add a photo instead? Turn on meal photos");
  await sheet.locator(".mealphoto-instead").getByRole("button", { name: "Turn on meal photos" }).click();
  const on = page.locator("#meal-on-sheet");
  await expect(on.getByRole("heading", { name: "Turn on meal photos" })).toBeFocused();
  await expect(page.locator(".v2sheet")).toHaveCount(1); // one dialog, never two
  await expect(on).not.toContainText("This also turns on Meal notes"); // it is already on
  await expect(on).toContainText("You can turn Meal photos off any time in You → Solia Health's AI.");
  await on.getByRole("button", { name: "Turn on meal photos" }).click();
  await expect(toast(page)).toHaveText("Meal photos on. Nothing is sent until you tap Send.");
  sheet = page.locator("#meals-sheet");
  await expect(sheet.getByRole("button", { name: "Take a photo" })).toBeVisible();
  await expect(sheet.locator(".mealphoto-instead")).toHaveCount(0);
  expect(mealCalls(state)).toHaveLength(0);

  // calories are hidden (she left the choice off): the answer's line has "Show them"
  await sheet.locator('input[data-pick="library"]').setInputFiles(plateFile(800, 600));
  await page.locator("#meal-send-sheet").getByRole("button", { name: "Send", exact: true }).click();
  const answer = page.locator("#meal-answer-sheet");
  await expect(answer.locator(".mealfood")).toHaveCount(3);
  await expect(answer.getByRole("group", { name: "Which meal was this?" })).toHaveCount(0); // this photo already belongs to Lunch
  await expect(answer.locator(".mealest-hidden")).toHaveText("Calorie estimates are hidden. To see them, turn on \"Show calorie estimates\" in You → Solia Health's AI or at the bottom of the Meals sheet.");
  expect(await answer.innerText()).not.toMatch(/kcal|kilocalor|about 1 cup/);
  await answer.getByLabel("Food 1").fill("Brown rice"); // an edit made before Show them is kept
  await answer.getByRole("button", { name: "Show them", exact: true }).click();
  await expect(toast(page)).toHaveText("Calorie estimates are shown");
  await expect(answer.locator(".mealest-hidden")).toHaveCount(0);
  await expect(answer.getByRole("button", { name: "Show them" })).toHaveCount(0);
  await expect(answer.locator(".mealfood").nth(0)).toContainText("about 1 cup · 180–260 kcal");
  await expect(answer.locator(".mealest-total")).toContainText("Total 470–720 kcal");
  await expect(answer.getByLabel("Food 1")).toHaveValue("Brown rice");
  await expect(answer.locator(".mealfoods")).toBeFocused();
  await answer.getByRole("button", { name: "Save to this meal note" }).click();
  sheet = page.locator("#meals-sheet");
  // the same preference: the sheet's switch is on, and she can turn it off again there
  const cal = sheet.getByRole("switch", { name: "Show calorie estimates" });
  await expect(cal).toHaveAttribute("aria-checked", "true");
  await cal.click();
  await expect(sheet.locator(".mealest-total")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Done", exact: true }).click();

  // You → Solia Health's AI: off is one tap; with Meal notes off the row says what turning it on does, and does it
  await gotoYou(page, "Solia Health's AI");
  const ai = page.locator("#you-ai");
  const sw = ai.getByRole("switch", { name: "Meal photos" });
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await sw.click();
  await expect(toast(page)).toHaveText("Meal photos off. Nothing more will be sent.");
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await gotoYou(page, "Your profile");
  await page.locator("#you-modules").getByRole("switch", { name: "Meal notes" }).click();
  await gotoYou(page, "Solia Health's AI");
  await expect(ai.locator("#ai-meals-needs")).toHaveText("Meal notes is off. Turning this on turns Meal notes on too.");
  const n = state.sent.length;
  await sw.click();
  await expect(on).toContainText("This also turns on Meal notes, which is where the foods from a photo are saved.");
  await on.getByRole("button", { name: "Turn on meal photos" }).click();
  await expect(toast(page)).toHaveText("Meal notes and Meal photos are on. Nothing is sent until you tap Send.");
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await expect(sw).toBeFocused();
  await expect(ai.locator("#ai-meals-needs")).toHaveCount(0);
  await gotoYou(page, "Your profile");
  await expect(page.locator("#you-modules").getByRole("switch", { name: "Meal notes" })).toHaveAttribute("aria-checked", "true");
  expect(state.sent.length).toBe(n);
  expect(mealCalls(state)).toHaveLength(1);
});

test("Not now hides the card on this device; the feature stays in You → Solia Health's AI and the Meals sheet", async ({ page }) => {
  const state = newApiState({ meal: () => ({ status: 200, json: ANSWER }) });
  await start(page, state);
  await card(page).getByRole("button", { name: "Not now", exact: true }).click();
  await expect(toast(page)).toHaveText("Hidden. You can turn on meal photos any time in You → Solia Health's AI.");
  await expect(card(page)).toHaveCount(0);
  await expect(page.locator(".bodyacts button").first()).toBeFocused();
  await page.waitForTimeout(1500); // the record's save on this device settles
  await page.reload();
  await gotoTab(page, "Body");
  await expect(page.locator(".bodyacts")).toBeVisible();
  await expect(card(page)).toHaveCount(0);
  // still reachable: You turns it on, and the Meals sheet then has the photo buttons
  await gotoYou(page, "Solia Health's AI");
  await page.locator("#you-ai").getByRole("switch", { name: "Meal photos" }).click();
  await page.locator("#meal-on-sheet").getByRole("button", { name: "Turn on meal photos" }).click();
  await expect(page.locator("#you-ai").getByRole("switch", { name: "Meal photos" })).toHaveAttribute("aria-checked", "true");
  const sheet = await openMeals(page);
  await expect(sheet.getByRole("button", { name: "Take a photo" })).toBeVisible();
  await sheet.getByRole("button", { name: "Done", exact: true }).click();
  await gotoTab(page, "Body");
  await expect(card(page)).toHaveCount(0); // hiding is remembered whatever the switches say
  expect(mealCalls(state)).toHaveLength(0);
});

test("a guest is offered Sign in to use meal photos, which opens Create your account; signed in, the card offers Turn on", async ({ page }) => {
  const state = newApiState({ meal: () => ({ status: 200, json: ANSWER }) });
  await start(page, state, { signin: "guest" });
  await expect(card(page)).toHaveAttribute("data-state", "signin");
  await expect(card(page).getByRole("button")).toHaveText(["Sign in to use meal photos", "Not now"]);
  // You's row says the same and its switch leads to the same sheet, turning nothing on
  await gotoYou(page, "Solia Health's AI");
  await expect(page.locator("#ai-meals-needs")).toHaveText("Meal photos needs an account. Turning this on asks you to sign in first.");
  await page.locator("#you-ai").getByRole("switch", { name: "Meal photos" }).click();
  const create = page.locator("#guest-create");
  await expect(create.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await create.locator(".v2sheet-close").click();
  await expect(page.locator("#you-ai").getByRole("switch", { name: "Meal photos" })).toHaveAttribute("aria-checked", "false");
  await gotoTab(page, "Body");
  await card(page).getByRole("button", { name: "Sign in to use meal photos" }).click();
  await expect(create.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await emailSignIn(page);
  await expect(create).toHaveCount(0);
  await expect(card(page)).toHaveAttribute("data-state", "off");
  await expect(card(page).getByRole("button", { name: "Turn on meal photos" })).toBeVisible();
  expect(mealCalls(state)).toHaveLength(0);
});
