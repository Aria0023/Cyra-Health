# Owner request, 2026-11-19: meal photos, with AI naming the food and estimating calories

Owner's words: "also need the Meal notes [...] to use algorithm or AI to identify food and calories with camera
photo." Asked how to build it given the privacy rule, the owner chose: **"Opt-in Pro feature"**: off until she turns
it on; she takes a photo, sees exactly what is sent, taps Send; AI returns the foods and a rough calorie range; the
photo is not kept on the server; counts toward a monthly cap; the privacy rule and wording are updated to match.

Branch: feature/meal-photos, stacked on feature/launch-tools (so the AI spend meter and feedback exist). ONE task,
ONE final commit ("Meal notes: opt-in photo, AI names the food and estimates calories"); WIP commits before it are
fine. Never amend, never force-push. Push the branch after each commit. Never touch main, no PR, no new npm
dependencies, never `playwright install`. Progress note: docs/plans/meal-photos-progress.md.

## The rule change (owner-approved, 2026-11-19)
CLAUDE.md's first hard rule currently allows one thing to leave the device: the opt-in, previewed AI summary. Edit
that line to add the second: the opt-in, previewed meal photo she chooses to send. Nothing else widens. Every claim
in the UI, docs/PRIVACY-AUDIT.md, public/legal/privacy.html, the splash line, You -> Privacy & your data, the AI
disclosures and the Meal notes copy ("No calories, no photos, no scores.") must be made literally true of the new
build: find each sentence this makes false and rewrite it. Add a counsel note in public/legal/health-data.html (a
meal photo plus calorie estimate is likely consumer health data; it is sent to Anthropic through our server).

## What to build
- Switch: You -> AI gains "Meal photos" (off by default, Pro, needs sign-in like the other AI features, same
  disclosure pattern as chat/evidence). With it off, Meal notes look and behave exactly as today and nothing is sent.
- In the Meal notes logger, with the switch on: "Add from a photo". Use a plain file input
  (`accept="image/*" capture="environment"`), which works on the web and in the iOS/Android web views with no plugin.
  On the device, before anything is sent: redraw the image on a canvas at most 1024px on the long side, JPEG ~0.8
  (this also drops EXIF, including location). Add the iOS camera usage string if the web view needs it.
- "What will be sent" sheet (the existing AI send-sheet pattern): the downsized photo exactly as it will be sent,
  and the sentence of what goes with it (nothing: no log, no stage, no notes; her sign-in for the monthly count).
  "Photograph only the food" hint. Nothing leaves until she presses Send. Cancel discards the photo.
- Backend: POST /api/ai/meal through the existing proxy and model config (image block + a tight system prompt;
  structured JSON out). Never store or log the photo or the answer; keep only the counts: ai_usage kind `meal`
  (default cap 60 a month, config.ai.monthly.meal, shown as "X of N left this month") and the spend meter's totals
  (new kind `meal`). Size-limit the upload; reject non-images. For the request shape (image input, structured
  output) load the `claude-api` skill; do not rely on memory.
- Answer: a list of foods with a plain portion guess and a calorie RANGE each (low-high), a total range, and how
  sure it is (low / medium / high). If the photo isn't food or is unclear, say so and add nothing. She can edit a
  name, remove an item, or discard everything before saving. Saved (on the device only, in the meal note, in
  encrypted backups like other meal notes): the foods, portion words and calorie ranges, marked as "estimated from a
  photo". The photo itself is not kept, on the device or anywhere.
- Showing calories: per meal, and a day total range in the meal notes list. A device switch "Show calorie estimates"
  (on by default once Meal photos is on) hides every number while keeping the food names.
- Guardrails (hard): no calorie targets or goals, no "over/under", no scores, streaks, grades, colours for good/bad,
  no weight-loss or diet advice, no judgement words about food. Every calorie figure is labelled an estimate
  ("A rough estimate from a photo. It can be well off."). Guidance, never diagnosis. In the pregnancy stage add one
  line that energy needs change in pregnancy and to ask her clinician; never a number. Add every new sentence to
  docs/CLINICIAN-REVIEW.md for sign-off, and note there that calorie display may be unsuitable for people with a
  history of disordered eating (the hide switch exists for that).
- The rest of Meal notes (meal type, how energy felt after) stays. Patterns/insights must not start using calories.
- Tests: unit (downsizing maths, cleaning the AI answer: ranges sane, unknown fields dropped, hostile strings),
  backend (nothing stored but counts; cap -> 429; sign-in required; non-image rejected; mock Anthropic via the
  existing e2e/lib/anthropic.mjs style), e2e (switch off -> no button and no request; the request carries exactly
  the previewed image and nothing from the log; edit/remove before save; hide-calories switch), axe light and dark.

## Report back
Commits; verification table (lint, app unit, backend tests, backend `npm run smoke:all`, build stamp once, e2e,
axe); every new or changed user-facing sentence verbatim (privacy and clinical); anything taken from memory that
needs checking against vendor docs; deviations; screenshots (2x) in
/tmp/claude-0/-home-user/dd34ad26-25bd-5d87-8174-4dbbc0f7e686/scratchpad/shots13/ : the switch in You -> AI, the
"What will be sent" sheet with a photo, the answer with edit/remove, a saved meal note with calories, the same with
calories hidden. Delete any temporary spec afterwards; leave no untracked files.
