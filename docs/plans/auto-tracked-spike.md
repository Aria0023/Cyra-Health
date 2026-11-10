# Auto-tracked spike: build brief (S1 done; S2, S3, E2E to go)

Status 2026-11-09. Owner approved all nine improvements in docs/PASSIVE-TRACKING-PLAN.md v2 ("ok do it all").
S1 (signals library + source adapter) is committed on `feature/auto-tracked` (63acff7, WIP body). A container restart
wiped the session's temporary folder, which held the previous end-to-end harness and the S2/S3 drafts, so this brief
lives in the repo and the new harness lives in the repo (`e2e/`).

## Rules (from CLAUDE.md and the project's working rules)
- Health data stays on the device except the opt-in, previewed AI summary; no API key in client code; never weaken a
  privacy claim (every sentence literally true in every build config; record new/moved ones in docs/PRIVACY-AUDIT.md).
- Guidance, never diagnosis; never "ovulation confirmed", never contraception wording ("Solia Health is not a
  contraceptive." in TTC); no scores/grades/streaks/"points"/"of 100"; words against her own baseline.
- One life-stage experience; Apple Sign-In first; ARIA, focus styles, 44 px targets, WCAG AA in light and dark and in
  all five styles (Soft, Mono, Bloom, Clear, Journal); every new string through t() in src/locales/en-ui.js.
- One commit per task (commit early with a WIP body, amend after verification). Author
  `git -c user.name="Aria" -c user.email="aria23@gmail.com"`. Message ends with exactly:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` then
  `Claude-Session: https://claude.ai/code/session_01HHP8o69cmnMvBZyGdDsuZF`. Never push or merge.
- Keep progress notes in docs/plans/auto-tracked-progress.md (committed with each WIP) so a restart can resume.
- No new runtime dependency. Dev dependencies for the e2e harness are allowed (`@playwright/test` or plain
  `playwright` + `@axe-core/playwright`); Chromium is at /opt/pw-browsers (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1; use
  executablePath /opt/pw-browsers/chromium if the pinned version differs). Never run "playwright install".

## What S1 provides (read these first)
src/lib/signals.js (wakeDay, nightlyTemps, excludeOutliers, ovulationFor [three-over-six; rise-seen / no-rise-seen /
not-enough-nights; day, confidence, lutealDays], cycleOvulations, riseWords/riseDetail, phaseOf, baselines/wordFor,
readinessWords, cycleTable, skippedSummary, hrvBeforeRise, reviewSentence, SIGNAL_COPY), src/lib/signalsFixtures.js
(7 synthetic fixtures, demoRows/demoStarts), src/lib/sources.js (adapter seam demo/healthkit/oura/terra, mergeSourceRows,
preferred sources, syncedRecently 36 h, nightSkips/confirmations/trackStats helpers), record.js keys nightSkips,
confirmations (in backups), trackStats (device-only, never in backup), App.jsx wiring. Also read: HomeScreen.jsx,
CyclesScreen/CycleList, patterns.js (PATTERN_RULES, cards), WeeklyReview, clinicianSummary.js (+ ClinicianPreview),
notifications.js, wearables.js, features.js, YouScreen.jsx, DevGallery.jsx, styles.js tokens, docs/PASSIVE-TRACKING-PLAN.md.

## E2E (commit: "E2E: an in-repo Playwright harness") — do this FIRST so S2/S3 can be verified
- `e2e/` with `package.json` scripts: `npm run e2e` (builds dist with VITE_DEMO_WEARABLES=true, serves it with vite
  preview on a free port, runs the specs) and `npm run e2e:axe`.
- Specs: `smoke.spec.mjs` (register through onboarding for My Cycle with PCOS on; visit all five tabs and the + sheet;
  Report PDF download yields a 1-page PDF), `axe.spec.mjs` (axe on Home, Body, Mind, Patterns, You, the log sheet and
  the Report in light + dark for Soft and Clear; 0 violations), `privacy.spec.mjs` (default build makes no request off
  its own origin; AI features off → zero /api calls), `auto.spec.mjs` (S2/S3 acceptance below, filled in as they land).
- Helpers: `e2e/lib/onboard.mjs` (register walker), `e2e/lib/nav.mjs` (gotoTab/openLog), `e2e/lib/serve.mjs`.
- A GitHub Actions workflow `.github/workflows/e2e.yml` running unit + build + e2e on push to main and PRs (uses
  `npx playwright install --with-deps chromium` THERE, never here).

## S2 (commit: "Auto-tracked S2: Looks right, cycle markers and the cycle table")
- Home: when a non-demo source has rows in the last 36 h (or the demo-wearables build), a **"Today's auto-tracked"**
  card ABOVE the quick log: source name + synced time; rows Sleep / Temperature / HRV / Resting HR as words vs her
  phase baseline (readinessWords); buttons **Looks right** (writes confirmations[day] with `took` ms since mount and
  via "app"; marks the day as confirmed on the today line and Body rail; NEVER writes a synthetic day entry) and
  **Add anything else?** (opens the log sheet, symptoms first); **Skip this night** link → reason picker (Fever/ill ·
  Alcohol · Travel · Other) → nightSkips; "No readings since <day>" state with "Open the Health app" (iOS,
  x-apple-health://) / "Sync now" (Android) / nothing clickable on web.
- Reminder copy when synced in 36 h: "Confirm today (10 s)".
- Body → Cycles: per-cycle marker from ovulationFor ("Temperature rise seen · day 32", "No sustained rise seen this
  cycle", "Not enough nights"); luteal length in the row when known; TTC adds "Solia Health is not a contraceptive." once.
- Patterns: two PATTERN_RULES cards (sleep hours vs top symptom; HRV lower-than-usual days vs mood/energy); weekly
  review gains reviewSentence when a rule passes.
- Clinician summary: the cycle TABLE (length · bleeding days · rise seen (day) / no rise / not enough nights · luteal)
  for the last 6–12 cycles when temps exist (the strip stays when they don't); one page on Letter/A4 via fitSummary;
  appendix lists skipped-nights count.
- Unit tests for new pure logic; CLINICIAN-REVIEW and PRIVACY-AUDIT entries; en-ui strings; dev gallery shows the card.

## S3 (commit: "Auto-tracked S3: confirm from the notification, Data sources, and device-only sync in production")
- Native: LocalNotifications action type `confirm-night` (Looks right / Open); schedule at 07:00 local only when a
  sync landed before 07:00 and today is not confirmed; `localNotificationActionPerformed` → confirmations with via
  "notification". Web: push payload `{type:"confirm-night"}` with actions in public/sw.js; notificationclick →
  postMessage to the page or open `#/confirm/<day>` which writes the confirmation; backend push module gains the
  payload kind + smoke test. Existing reminders untouched for users without a source.
- You → **Data sources** card (manage surface; the Home "Wearables" door may stay as a pointer): per source status,
  what it reads, "Where it goes" (this phone only / through Solia Health's server), last sync, preferred source per
  metric, Pause, Disconnect (+ "Delete readings too", default on), demo switch where the build has it; **"How this is
  going"** from trackStats (days confirmed, median seconds, connected since) + "Kept on this device, never sent."
- Flag: seventh flag `deviceSync` (default ON; on-phone sources only; no backend module); Oura/Terra stay behind
  `wearables`. features.js + tests, build scripts, .env.example, render.yaml comment, docs.
- Dev gallery: the card in all five styles + a notification mock.

## Verify after each commit (all must pass)
`npm run build` (stamp "BUILD 2026.10.07-D" exactly once in dist/assets/index-*.js); ESLint 0 errors (`npx eslint src
--ext .js,.jsx` with the repo config, or the nearest equivalent that works without the old scratchpad config); `npm run
test:unit` 0 fail; `cd backend && npm run smoke:all`; `npm run e2e` and `npm run e2e:axe`. Render PDF page 1 for the
demo profile to PNG (pdftoppm) and LOOK at it; look at the card in Soft light, Clear dark, Bloom light. Put final
screenshots in `e2e/shots/` (gitignored except a curated `docs/plans/auto-tracked-shots/` set of ~10 PNGs committed
at small size, ≤ 300 KB each).

## Owner to-do (unchanged)
Play Console Health Connect declaration; clinician sign-off of the "Auto-tracked" CLINICIAN-REVIEW entries; pilot
measurement protocol (plan §8); privacy review before marketing.
