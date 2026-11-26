# Progress: meal photos, findable (docs/plans/meal-photos-findable.md)

Branch `feature/meal-photos-findable`, worktree `/home/user/cyra-meals` (base main 530af43 + the plan commit 27b3a2c).
One task, one final commit: "Meal photos: a visible card and one tap to turn on". Resume from here after a restart.

## Status: IN PROGRESS (code, tests and docs written; full verification running)

## What was built
- `src/lib/mealPhoto.js`: `mealCardState({ flag, server, mealsOffered, signMode, signedIn, pro, notesOn, photosOn, hidden })`
  → `{ state: null | "noserver" | "signin" | "pro" | "off" | "on", card }` (pure, every branch unit-tested);
  `cleanMealCardOff`; `slotForHour`; the new MEAL_COPY sentences. `src/lib/bodylog.js mealSlotOpen`.
- `src/lib/record.js`: new key `mealCardOff` (true/false; DEVICE_ONLY, NOT_IN_BACKUP; rule + tests).
- `src/components/ai/MealPhoto.jsx`: `MealPhotosCard` (the Body card), `MealTurnOnBody` / `MealTurnOnSheet` (the one
  confirmation), `MealAnswerBody` gains "Show them" and, for a card photo, "Which meal was this?"; `PhotoPick` takes a
  `hintId` (two can be on screen) and a camera icon (`Icon.jsx camera`).
- `src/components/BodySheets.jsx MealsSheet`: the "Add a photo instead?" line, a fourth step ("Turn on meal photos",
  same dialog), and `start={{ shot }}` for a photo picked on the card.
- `src/App.jsx`: `mealWay`, `turnOnMeals` (sets `bodyPrefs.mealsOn`, `aiPrefs.meals`, `aiPrefs.showCal`; no request),
  `mealCardFile`, the card in `logTop` (above the quick actions), the standalone sheet, and the create-account sheet for
  a signed-out user where sign-in is optional.
- `src/screens/YouScreen.jsx`: the Meal photos switch opens the sheet; `src/dev/DevGallery.jsx`: the card in each state.
- `src/styles.js`: `.mealcard` (tokens only), the sheet and answer bits. `src/locales/en-ui.js`: the Meals footer.
- Docs: PRIVACY-AUDIT "Meal photos, findable", CLINICIAN-REVIEW "Meal photos, findable" (two decisions for the
  clinician), spec 3.5i "Findable".

## Decisions made while building
- Sign-in is "needed" where the server has sign-in set up (`signMode` "required" or "optional"), which is where the
  server refuses a photo without it (backend ai/usage.js). A guest is that case in mode "required".
- "Sign in to use meal photos" opens the existing `GuestCreateSheet`. It used to render only for a guest; it now also
  renders for a signed-out user where sign-in is optional, with the existing line `SIGNIN_COPY.sub` (there was no in-app
  sign-in path for her at all).
- No-server card: the description is written as what a server would add ("With a server, you photograph a meal…"), so
  the card claims nothing this build cannot do. The brief's sentence is the bold lead-in, word for word.
- A card photo has no meal note. The answer asks "Which meal was this?" with the hour's meal picked first
  (4–11 Breakfast, 11–16 Lunch, 16–22 Dinner, else Snack); a meal already noted today takes the photo in its note (and
  the sheet says when that replaces an estimate). Six snacks in a day: the card says there is nowhere to save it, before
  anything is prepared or sent.
- From the card, Cancel / Discard / a failed read / "not food" close the sheet and return to the card (the reason shows
  under its buttons). A saved answer stays in the Meals sheet, showing the note.
- "Calories: shown / hidden · Change" goes to You → Solia Health's AI with focus on the "Show calorie estimates" switch.
- The You switch is ON only while Meal notes is on too (photos cannot be taken otherwise), so its on/off matches the card.
- The hide button reads "Not now" where the card offers something to do, "Hide this card" where it doesn't (no server)
  or she is already using it (on). The toast after hiding names only places that exist in that state.
- The Meals footer lost "in You → Solia Health's AI" (it can now be turned on from the sheet and Body too).
- The sheet's switch keeps the existing name "Show calorie estimates" (not a new "Show calorie estimates?"), so one
  setting has one name everywhere.

## Every new or changed user-facing sentence
Listed verbatim in docs/PRIVACY-AUDIT.md "Meal photos, findable → Every new or changed sentence, verbatim" (the same
list as the final report).

## Tests
- unit: `mealPhoto.test.mjs` +3 (mealCardState every branch; the card's words; cleanMealCardOff + slotForHour),
  `record.test.mjs` +1 (mealCardOff) and the pinned key lists, `bodylog.test.mjs` +1 (mealSlotOpen).
- e2e: `meal-photos-findable.spec.mjs` (5). `meal-photos.spec.mjs`, `meal-photos-axe.spec.mjs`, `short-copy.spec.mjs`:
  only the lines the new behaviour affects (the switch now opens the sheet; the Meals sheet has the one link; the footer).
- axe: `meal-photos-findable-axe.spec.mjs` (4: Body card off / the sheet / card on in nine styles, light and dark; the
  five states in the dev gallery in nine styles, light and dark; 44px targets).
- Not in the committed e2e: the no-server and not-Pro states on the real Body tab (no bundle has the ai flag without a
  server, or a server without proDev). Covered by the unit tests, by the dev gallery axe run, and by throwaway builds
  for the screenshots.

## Verification
(filled in after the full runs)

## Screenshots (not committed)
Scratchpad `shots18/` (390×844, Soft, light and dark, 2x): each card state, the sheet, the send sheet from the card, the
answer with calories shown and hidden, the saved note, the You row, the Meals sheet line.
