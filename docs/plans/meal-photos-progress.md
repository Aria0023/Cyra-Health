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

## Status: DONE (final commit "Meal notes: opt-in photo, AI names the food and estimates calories")
- backend: `ai/meal.js` (POST /api/ai/meal), `server.js` parser for that path, `ai_usage.meal` (cap 60), spend kind
  `meal`, weekly report count `mealPhotos`, portal kind label; `test/ai-meal.test.mjs`.
- app: `src/lib/mealPhoto.js` (+ test), `components/ai/MealPhoto.jsx`, MealsSheet steps in `BodySheets.jsx`, You → AI
  row + "Show calorie estimates", privacy list row "Meal photos", `aiPrefs.meals` / `aiPrefs.hideCal`, plan
  `aiMealPhotos`, `aiClient.mealSend`, `bodylog` `est`.
- copy and docs: CLAUDE.md rule, privacy.html, health-data.html (counsel note), PRIVACY-AUDIT "Meal photos",
  CLINICIAN-REVIEW "Meal photos", spec 3.5, backend/README, Info.plist camera string, PrivacyInfo.xcprivacy, STORE-SETUP.
- e2e: `e2e/meal-photos.spec.mjs`, `e2e/meal-photos-axe.spec.mjs`, `e2e/lib/photo.mjs`, `e2e/lib/api.mjs` (meal mock);
  `e2e/portal-ai-costs.spec.mjs` now expects six kinds.
- Verified 2026-11-19 after the last change: lint 0 errors (23 warnings); app unit 706/706; backend 130/130;
  smoke:all exit 0; build stamp once in dist; e2e 79/79; axe 52/52 (see the final report for which runs were full).
- Screenshots (not committed): scratchpad `shots13/`.
- Not done / open: no "What Pro adds" line for Meal photos; Android camera capture and iOS camera prompt not tried on
  a device; the pregnancy line is unreachable (Meal notes is not offered in pregnancy).
