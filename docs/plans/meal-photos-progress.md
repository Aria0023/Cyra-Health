# Progress: meal photos (docs/plans/meal-photos.md)

Branch `feature/meal-photos`, worktree `/home/user/cyra-meal`. Resume from here after a restart.
One task, one final commit: "Meal notes: opt-in photo, AI names the food and estimates calories".

## Design decisions (made while building)
- Request body is JSON `{ image: { media_type, data } }` (base64), exactly what the preview sheet shows. Nothing else.
- Server: `backend/src/modules/ai/meal.js` (POST /api/ai/meal), own body parser in `server.js` (the AI parser's 32 kB
  cap is too small for a photo), image at most 1 MB decoded, JPEG / PNG / WebP by magic bytes.
- Counts: `ai_usage.meal` (default 60 a month) and spend kind `meal`. A "not food / unclear" answer is a delivered
  answer and counts.
- App: switch `aiPrefs.meals` and `aiPrefs.hideCal` (device-only); plan feature `aiMealPhotos`; pure lib
  `src/lib/mealPhoto.js`; UI `src/components/ai/MealPhoto.jsx`; estimate saved in the meal note as `est`.
- Total range shown = sum of the items (so it stays right after she removes an item).
- "Show calorie estimates" off hides calorie figures AND portion words (portions hold numbers); food names stay.
- Meal notes are not offered in the pregnancy stage today, so the pregnancy line is written and wired but unreachable.

## Status
- [x] backend route + tests (backend 130/130 on 2026-11-19; meal.js, test/ai-meal.test.mjs, server.js parser, usage + spend kinds, weekly report count)
- [x] app lib + tests (src/lib/mealPhoto.js + test, bodylog est, aiPrefs meals/hideCal, plan aiMealPhotos, aiClient mealSend)
- [x] UI (components/ai/MealPhoto.jsx, MealsSheet steps in BodySheets.jsx, You → AI row, privacy list row, styles)
- [x] privacy / clinical copy, docs (CLAUDE.md rule, privacy.html, health-data.html, PRIVACY-AUDIT, CLINICIAN-REVIEW, spec 3.5, backend README, Info.plist, PrivacyInfo, STORE-SETUP)
- [x] e2e + axe written (e2e/meal-photos.spec.mjs, e2e/meal-photos-axe.spec.mjs, e2e/lib/photo.mjs, api mock); full runs pending
- [ ] verification, screenshots, final commit
