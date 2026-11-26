# Progress: meal photos, findable (docs/plans/meal-photos-findable.md)

Branch `feature/meal-photos-findable`, worktree `/home/user/cyra-meals` (base main 530af43 + the plan commit 27b3a2c).
One task, one final commit: "Meal photos: a visible card and one tap to turn on". Resume from here after a restart.

## Status: DONE (final commit "Meal photos: a visible card and one tap to turn on"; WIP ee2aa8e holds the code)

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

## Every new or changed user-facing sentence, verbatim
(The same list is in docs/PRIVACY-AUDIT.md "Meal photos, findable", with why each is true.)

Body card (eyebrow "Solia Health's AI", title "Meal photos", the "Pro" chip: existing words):
- "Photograph a meal. Solia Health's AI names the foods and can give a rough calorie range. Pro, and only if you turn it on."
- "Photograph a meal. Solia Health's AI names the foods and can give a rough calorie range." (once on)
- "Meal photos need Solia Health's server, which this version doesn't have. With a server, you photograph a meal and
  Solia Health's AI names the foods and can give a rough calorie range." (no server)
- Buttons: "Sign in to use meal photos" · "See Pro" · "Turn on meal photos" · "Not now" · "Hide this card" · "Change"
  (spoken: "Change whether calorie estimates show")
- "Calories: shown" / "Calories: hidden"
- "Today already has 6 meal notes, as many as one day holds, so a photo has nowhere to be saved. Nothing was sent."
- Toasts after hiding: "Meal photos card hidden." · "Hidden. With Pro, meal photos are in You → Solia Health's AI." ·
  "Hidden. You can turn on meal photos any time in You → Solia Health's AI." · "Hidden. Meal photos are still in the
  Meals sheet and in You → Solia Health's AI."
- Reused unchanged on the card: "Take a photo" · "Choose a photo" · "Photograph only the food. You'll see exactly what
  will be sent before anything goes." · "Making the photo smaller on this device…" · "N of M meal photos left this month."

"Turn on meal photos" sheet (title "Turn on meal photos"; close label "Close without turning anything on"):
- "Turning this on sends nothing. Each photo goes only after you've seen it and tapped Send: through Solia Health's
  server, which doesn't keep it, to Anthropic, which keeps it for a limited time."
- under Details, unchanged: MEAL_COPY.adds ("When you choose a photo in Meal notes, … until you remove them.")
- "This also turns on Meal notes, which is where the foods from a photo are saved."
- "You can turn Meal photos off any time in You → Solia Health's AI."
- "You can turn Meal photos off in You → Solia Health's AI, and Meal notes off in You → Your profile."
- Buttons: "Turn on meal photos" · "Not now". Switch (existing): "Show calorie estimates" with "Off unless you turn it
  on: calorie figures and portion guesses stay hidden. The food names always show."
- Toast: "Meal notes and Meal photos are on. Nothing is sent until you tap Send."

Meals sheet:
- "Add a photo instead?" followed by "Turn on meal photos" / "Sign in to use meal photos" / "See Pro"
- Footer, changed: "No scores and no targets. No photos or calorie estimates unless you turn on Meal photos in You →
  Solia Health's AI. Kept on this device and in your backups, like the rest of your log." → "No scores and no targets.
  No photos or calorie estimates unless you turn on Meal photos. Kept on this device and in your backups, like the rest
  of your log."

The answer ("What the photo shows"):
- "Show them"
- "Which meal was this?" (Breakfast · Lunch · Dinner · Snack) · "Save to today's meal notes"
- "Dinner already has an estimate from a photo today. Saving replaces it." (with that meal's name)

You → Solia Health's AI, Meal photos row:
- changed: "Meal notes is off. Turn it on in You → Your profile to use this." → "Meal notes is off. Turning this on
  turns Meal notes on too."
- "Meal photos needs an account. Turning this on asks you to sign in first."

Create your account (existing sheet), for someone signed out where sign-in is optional: the existing "Sign in so Solia
Health knows it's you. Your health log stays on this device." in place of the guest line.

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
2026-11-26, from this worktree, on the tree of WIP ee2aa8e (the final commit adds only this note), full runs:

| Check | Result | Baseline 530af43 |
| --- | --- | --- |
| `npm run lint` | 0 errors, 23 warnings | 0 / 23 |
| `npm run test:unit` | 742/742 | 737 (+5) |
| `cd backend && npm test` | 148/148 | 148 (backend untouched) |
| `cd backend && npm run smoke:all` | exit 0 ("PROD SMOKE: all passed") | |
| `npm run build` | ok; "BUILD 2026.10.07-D" exactly once in dist | |
| `npm run e2e -- --trace off` | 125/125 | 120 (+5) |
| `npm run e2e:axe -- --trace off` | 78/78 | 74 (+4) |

- The first axe run was stopped from outside at test 60 of 78 (SIGTERM, exit 143, no failure; another session on this
  machine started its own Playwright run at that moment). The second run, untouched, is the 78/78 above.
- Throwaway checks, not committed (specs and builds deleted afterwards):
  - contrast of every text on the card against both ends of its gradient, nine styles × three stage accents × light and
    dark (1350 measurements): lowest 5.11:1 (the Pro chip), none under 4.5:1;
  - the real Body tab in a build with the ai flag and no server (card: no server), and in a build with a server and no
    proDev (card: See Pro → the Pro sheet, which lists Meal photos; the Meals sheet's "Add a photo instead? See Pro"
    closes the Meals sheet and opens the Pro sheet; hiding says "Hidden. With Pro, …"): axe 0 violations in Soft, light
    and dark;
  - a build with VITE_REQUIRE_SIGNIN=false: "Continue without an account", then the card's "Sign in to use meal
    photos" opens "Create your account" with "Sign in so Solia Health knows it's you. Your health log stays on this
    device."; after the email code the card offers "Turn on meal photos".

## Not verified / open
- No real AI call (mock server only), no real camera: "Take a photo" on iOS and Android web views was not tried on a device.
- The no-server, not-Pro and optional-sign-in states have no committed e2e on the real app (no bundle for them); see the
  throwaway checks above and the unit tests.
- A hidden card cannot be brought back (as with Home's devices card); the feature stays in You and the Meals sheet.
- For the clinician (docs/CLINICIAN-REVIEW.md "Meal photos, findable"): whether asking about calories at turn-on and the
  answer's "Show them" are acceptable, and whether Menopause should be offered Meal notes and Meal photos.
- MEAL_COPY.adds still begins "When you choose a photo in Meal notes" (kept word for word, as the brief asks); a card
  photo is previewed, sent and saved by the Meals sheet, so it stays true.

## Screenshots (not committed)
Scratchpad `shots18/` (390×844, Soft, light and dark, 2x): each card state, the sheet, the send sheet from the card, the
answer with calories shown and hidden, the saved note, the You row, the Meals sheet line.
