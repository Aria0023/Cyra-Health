# Meal photos: findable, one tap to turn on (owner request 2026-11-26)

Owner: "I don't see where can calculate calories of food when taking pictures". Today the feature is invisible
unless a server is connected, and then needs four steps in three places (Meal notes in You → Your profile, Meal
photos in You → Solia Health's AI, Show calorie estimates, then Body → Meals). Owner approved making it findable.

Base: `main` at 530af43. Branch: `feature/meal-photos-findable`. One final commit, titled
"Meal photos: a visible card and one tap to turn on" (WIP commits allowed). CLAUDE.md hard rules apply. The feature
stays opt-in, Pro, previewed before anything is sent (docs/plans/meal-photos.md); nothing here may send anything
new or weaken a privacy claim.

Baselines on 530af43: 737 unit, 148 backend, 120 e2e, 74 axe, 0 lint errors / 23 warnings, build stamp once.

## What to build
1. **A "Meal photos" card on the Body tab**, shown wherever Meal notes is offered (My Cycle, Trying to Conceive,
   Perimenopause; `mealsOffered`), in builds with the ai flag, even while everything is off. Never in Pregnancy
   (the app deliberately gives no calorie estimates there) and not in Menopause (unchanged; clinician question).
   Tinted like the Devices card so it is easy to spot, a bowl/camera icon, one plain line with a bold lead-in, e.g.
   "**Photograph a meal.** Solia Health's AI names the foods and can give a rough calorie range. Pro, and only if
   you turn it on."
   The card's one button depends on her state, first match wins:
   - no server in this build → no button; the line "Meal photos need Solia Health's server, which this version
     doesn't have." (literally true wording; reuse the existing phrasing pattern for server-less builds)
   - guest or signed out where sign-in is needed → "Sign in to use meal photos" (existing sign-in path)
   - not Pro → "See Pro" (opens the Pro sheet)
   - Pro, switches off → "Turn on meal photos": ONE confirmation sheet that says what turning it on does (the
     existing `MEAL_COPY.adds` text, short line visible and the full text under Details as in critique-fixes
     Task 4), with the choice "Show calorie estimates?" as a switch in the same sheet (off unless she turns it on,
     with the existing hint). Confirm turns on Meal notes and Meal photos together and applies her calorie choice.
     Nothing is sent by turning it on.
   - on → "Take a photo" and "Choose a photo" right on the card (the same pick → preview → Send flow as the Meals
     sheet, for today), plus a small "Calories: shown / hidden · change" link to the switch.
   She can hide the card ("Not now"), like the Devices card; hiding is remembered on the device and the feature
   stays reachable from You → Solia Health's AI and the Meals sheet.
2. **The Meals sheet** (when Meal notes is on but photos are off): one line and link, "Add a photo instead? Turn on
   meal photos", opening the same confirmation sheet (or See Pro / sign-in by the same rules).
3. **You → Solia Health's AI**: the Meal photos row no longer says only "Meal notes is off. Turn it on in You →
   Your profile"; its switch offers to turn both on through the same confirmation sheet.
4. **The answer**: when calories are hidden, the existing "Calorie estimates are hidden…" line gains a one-tap
   "Show them" button (it flips the same preference; she can turn it off again where she always could).

## Rules
- All state logic in a pure function with unit tests (e.g. `mealCardState({ flag, server, signedIn, pro, mealsOffered,
  notesOn, photosOn, hidden })`), so every branch above is tested.
- New record keys go through `src/lib/record.js` validation with tests; device-only, not sent anywhere.
- 44px targets, ARIA, focus return after sheets, AA contrast; axe clean on the Body tab and the new sheet in all
  nine styles, light and dark. Colour literals only in tokens.
- List every new or changed user-facing sentence verbatim in the progress note and `docs/PRIVACY-AUDIT.md`; add the
  calorie-prompt change to `docs/CLINICIAN-REVIEW.md` (the clinician still has to confirm calorie defaults, and
  whether Menopause should be offered meal photos).
- Screenshots (390×844, Soft, light and dark; deviceScaleFactor 2) of each card state, the confirmation sheet and
  an answer with calories shown, in the session scratchpad `shots18/`. Use the mock AI server the existing
  meal-photos e2e specs use; no real AI call is possible here.
