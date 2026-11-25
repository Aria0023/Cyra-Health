# Owner request, 2026-11-25: make the critique's changes, then evaluate them

On 2026-11-25 I gave the owner a critique of the live app (UI, functionality, logic per user type, comparison with
Flo, Clue, Natural Cycles, Stardust, Oura/Apple). The owner replied: "Make all the notes changes and let's eval the
changes". Below is every note that is a code change. Not in scope (owner actions or later): creating the backend,
legal review, clinician sign-off, the partner view, splitting App.jsx. The style picker keeps all nine styles: the
owner put the gradient ones there to test with users, and the critique said to trim only AFTER that test.

Branch: feature/critique-fixes (from main 1628653). SIX tasks, ONE final commit each (WIP commits first are fine).
Never amend, force-push or rebase. Push after each commit. Never touch main, no PR, no new npm dependencies, never
`playwright install`. Progress note: docs/plans/critique-fixes-progress.md. Read CLAUDE.md first.

Hard rules that apply throughout: every privacy/UI claim literally true of the build (find and fix every sentence a
change makes false, in src/, public/legal, docs/PRIVACY-AUDIT.md, docs/CLINICIAN-REVIEW.md); the five tabs unchanged;
exactly one life-stage experience; no scores/streaks; guidance never diagnosis; never a contraception claim; ARIA,
focus, 44px targets, AA contrast in all nine styles, light and dark; axe after each task.

## Task 1: one trial message, a simpler header (commit "Header and Home: one plan message, fewer chips")
- The header's plan badge (lib/planBadge.js) is the ONE place that shows the plan/trial state on every screen.
  Remove from Home the "Free week: N days left …" trial bar and the "Pro · 7-day free trial" chip (proChip). Keep the
  messages that carry a decision or a blocker: the "Your free week is over" sheet when saving is blocked, the plan
  card on You → Plan & account, the Pro sheet, the guest-window line when it is nearly up. Tapping the badge already
  opens the plans; make sure the badge's text and accessible name say enough on their own (e.g. "Free week · 3 days
  left").
- Remove the palette button from the header (the palette/style choice stays in You → App settings, where it already
  is; any "palette" deep link or coach mark must point there instead). Remove the name chip (the "sharing counts ✓"
  state, if it still matters, moves to You → Privacy & your data where that switch lives).
- Header must fit on ONE row at 390px and at 320px in all nine styles: brand, plan badge, Shop, settings. If 320px
  cannot fit, the Shop pill may shrink to its icon with the accessible name "Shop" kept.
- Update e2e that look for the removed elements; keep store-checks, trial, guest specs passing with their meaning.

## Task 2: Home has one first job (commit "Home: Quick log first; the rest folds")
- Order on Home: greeting + cycle ring (hero), next-period row, Quick log, Today's small step / Getting started,
  Ask Solia, Body and Mind rails, Today's insight (and the AI write-up card when present), then a single folded
  "More for today" group (Patterns preview, milestones, connect a device, the existing folded sections: month vs last
  month, wearables, appointments, journal…). Nothing is removed; only order and folding change. The folded group
  remembers open/closed on this device (device-only preference, not in backups).
- Ring with no period logged (perimenopause and anyone without a period start): today the ring shows the calendar
  date ("19 / November"), which reads like a cycle day. Show the date small, and inside the ring a plain prompt
  "No cycle yet" with the existing "Log a period start to see your cycle day" row as the action. Words only.
- Prediction honesty: where the next-period row says "Based on your sign-up answer", add a short second line that
  says it sharpens as she logs, and (only where a wearable source is available in this build) that a connected watch
  or ring's temperature helps. No numbers, no accuracy claims.
- Trying to conceive: on the fertile-window view(s) themselves (Home's ring/row when TTC, Calendar's fertile days
  legend, the fertility summary), show the existing not-for-contraception line visibly (not only in Learn). Reuse
  the existing sentence; do not invent a new claim.

## Task 3: privacy defaults (commit "Privacy defaults: shop tap count off unless she turns it on; calories hidden by default")
- Anonymous shop tap count becomes OPT-IN: off by default for everyone, including existing users who never touched
  the switch (an explicit earlier choice of "on" may stay on; an unset value now reads as off). Rewrite every sentence
  that said it is on by default (Shop footer, You → Privacy & your data row, privacy.html, PRIVACY-AUDIT, portal
  Clicks page footnote "it is on unless she turns it off"). The Shop page offers the switch once, quietly, in its
  footer ("Help Solia Health see which products people open? Count my taps anonymously").
- Meal photos: "Show calorie estimates" defaults to OFF (hidden) for everyone who has not explicitly turned it on.
  Food names and portion words still show. The answer sheet says how to show calories. Update CLINICIAN-REVIEW.md
  (the open question is now answered "hidden by default, owner decision 2026-11-25; clinician to confirm").
- Meal photos: let her choose from the photo library as well as the camera. Two buttons: "Take a photo"
  (capture="environment") and "Choose a photo" (no capture attribute). Everything after is unchanged.

## Task 4: shorter visible copy (commit "Copy: one plain line visible, the full text under Details")
- For the heaviest blocks, show ONE plain sentence and put the rest, word for word, under the app's existing
  Details disclosure. Targets: the meal-photo "What Solia Health will send" sheet intro and its "What goes with it"
  list; the feedback sheet's preview foot; the AI send sheets' intros; the You → Privacy & your data rows that have
  more than two sentences visible; the sign-in "What signing in shares" block; the Shop footer privacy text.
- The visible sentence must itself be true and complete for the decision in front of her (what goes, to whom,
  whether it is kept). Nothing is deleted; legal pages unchanged except where Task 3 changed facts.
- Keep a list in the progress note: each block, its new visible line, and that the full text is under Details.

## Task 5: one free clock (commit "Trial: she sees one free week")
- Users see ONE free period: "7 days free" (the free week, counted from registration). The 48-hour guest window
  (lib/guest.js) keeps working underneath but its user-facing copy stops naming hours as a second clock: before
  sign-in it says "Create your account to keep your free week going" with the deadline as a date/time only near the
  end (last 12 hours). The store's 7-day trial on the yearly plan is described on the plan tiles as "includes your
  7 days free" style wording only if that is literally true; if the store trial is separate and starts at purchase,
  say "7-day free trial on yearly, starts when you subscribe" on the tile only, never on Home or the badge.
- Find every user-facing mention of hours/days/trial (lib/guest.js GUEST_COPY, lib/trial.js, lib/plans.js,
  pricing copy, onboarding, Help answers) and make them one consistent story. List them in the progress note.

## Task 6: friendlier check-in and a picture per stage (commit "Check-in faces and stage illustrations")
- Mood / check-in answers: where she picks how she feels (Mind check-in mood, and the quick check-in's 4-step
  scales like "No / fine, A little, Yes, A lot"), add a simple face or symbol per option drawn as inline SVG in
  currentColor (in the app's existing icon style, components/Icon.jsx), with the word always shown under it.
  Selected state stays obvious without colour alone. Same values, same storage, same order.
- One calm decorative illustration per life stage (cycle, trying to conceive, pregnancy, perimenopause, menopause and
  beyond), inline SVG built only from UI tokens (var(--primary), --accent, tints), shown in the stage hero on You →
  Your profile and on the registration stage cards. aria-hidden; no people's faces; abstract shapes (moon phases,
  leaves, waves, seeds), not product drawings. Must look right in all nine styles, light and dark.

## Evaluation (after all six tasks; this is the "eval" the owner asked for)
Write docs/plans/critique-fixes-eval.md with:
- A table: each critique note → what changed → how it was checked (test name or screenshot) → result.
- Measurements before (main 1628653) and after, at 390x844 light Soft, for a fresh "My Cycle" user and a fresh
  "Perimenopause" user: Home full-page height in px; the y position (px from top) of the Quick log and of the "+"
  button's first reachable log action; number of plan/trial mentions visible on Home's first screen (0–844px);
  header row count at 390px and 320px; number of header controls; visible words in the meal-photo send sheet and the
  feedback preview foot (visible text only, Details closed); and the count of user-facing "free" durations found in
  src (hours vs days). Measure with a temporary Playwright spec against a build of main and of the branch (use git
  worktree for main; delete the spec afterwards).
- Axe results for every changed surface in all nine styles at least for Home and the header, light and dark.
- Screenshots (2x, 390x844) in /tmp/claude-0/-home-user/dd34ad26-25bd-5d87-8174-4dbbc0f7e686/scratchpad/shots15/ :
  before/after side by side for Home (My Cycle), Home (Perimenopause, no period), header at 320 and 390, the Shop
  footer, meal-photo send sheet, feedback sheet, the check-in with faces, the five stage illustrations (in Soft and
  in Aura, light and dark).

## Report back
Commits; verification table per task (lint, app unit, backend tests, backend `npm run smoke:all`, build stamp once,
e2e, axe); the eval file's contents; every changed user-facing sentence verbatim (privacy and clinical);
deviations; screenshot paths.
