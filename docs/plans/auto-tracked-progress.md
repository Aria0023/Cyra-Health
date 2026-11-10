# Auto-tracked spike: progress notes

Resumable log for docs/plans/auto-tracked-spike.md (branch `feature/auto-tracked`). Updated with every WIP commit so a
restart can pick up where the last session stopped. Dates are 2026-11-09 unless said otherwise.

## State of the branch

| part | commit | state |
| --- | --- | --- |
| S1 — signals library + source adapter | 63acff7 (WIP body; not the tip, so its body is not rewritten: the verification is recorded here) | done, verified below |
| Brief | af3ff2d | in the repo |
| E2E — in-repo Playwright harness | d091607 | done, verified below |
| S2 — Looks right, cycle markers, cycle table | 003f11e | done, verified below |
| S3 — confirm from the notification, Data sources, deviceSync | this commit | done, verified below |

## S1 verification (run 2026-11-09 on 63acff7 + the E2E commit's tree)

- `npm run build`: passes; "BUILD 2026.10.07-D" exactly once in dist/assets/index-*.js.
- ESLint (the new repo config, eslint.config.js: @eslint/js recommended + react jsx-uses-* + the two classic hook rules): 0
  errors, 26 warnings (pre-existing unused variables and exhaustive-deps notes). One S1 lint fix in signals.js: the sparse
  array `[, "other"]` in `nightNote` became `[null, "other"]` (no behaviour change).
- `npm run test:unit`: 553 pass, 0 fail (signals 30+, sources, record pinned lists).
- `cd backend && npm run smoke:all`: see the E2E section below (the backend is untouched by S1).
- `npm run e2e` (S1 part of auto.spec.mjs): connecting a demo source in the demo-wearables build shows "Demo mode — … showing
  90 days of illustrative data" and the Wearables door reads "1 connected".

## E2E commit

What landed: `e2e/` (playwright.config.mjs; lib/serve.mjs builds dist-e2e/ with VITE_DEMO_WEARABLES=true,
VITE_DEMO_SEED=true, VITE_FEATURES=wearables,devGallery,proDev and serves it with `vite preview` on a free port;
lib/browser.mjs picks Playwright's Chromium or the pre-installed /opt/pw-browsers build; lib/onboard.mjs register
walker; lib/nav.mjs gotoTab / gotoSegment / openLog / closeSheet / gotoGallery), specs smoke / axe / privacy / auto,
root scripts `e2e`, `e2e:axe`, `lint`, eslint.config.js, `.github/workflows/e2e.yml` (lint, unit, build + stamp, backend
smoke, `npx playwright install --with-deps chromium`, e2e, e2e:axe), dev dependencies @playwright/test 1.65,
@axe-core/playwright 4.14, eslint 9 + plugins. Playwright 1.65 expects Chromium 1254; the container has 1243, so the
config falls back to the installed executable (never `playwright install` here).

Two pre-existing WCAG 2.5.3 (label in name) violations axe found on Body → Logs were fixed in components/BodyLog.jsx: the
day-strip buttons and the log rows now take their name from their own text (visible letter/number or label/value first,
the long date or "edit" for screen readers after it) instead of an aria-label that did not contain the visible text.
No sentence changed meaning.

Observation (not fixed, outside the spike): opening the "+" sheet from the You tab right after a tab switch can leave
focus on the page's h1 instead of the sheet heading, so Escape does not close it; the helper closes with the Close
button. Worth a look in a later a11y pass.

## S2 commit

What landed: `src/lib/autoTracked.js` (signalsFor: cycles, nightly words, baselines, the rise per cycle, markers, PDF table,
review sentence; autoCardModel; CONFIRM_BODY), `src/components/AutoTrackedCard.jsx` (words per metric, Looks right with
`took` from the card's appearance, Add anything else?, Skip this night → reason picker, "No readings since" with the Health app
link / Sync now / nothing on web, demo note, "How these words are worked out"), HomeScreen slot above Quick log + the today line
and Body rail (`home.js` bodySteps `auto`), CycleList/CyclesScreen markers + "How the temperature rise is read" + the TTC line
once, `patterns.js` wearCards (sleep vs top symptom, HRV vs low mood/energy) + the review sentence in the weekly notes,
`clinicianSummary.js` cycle table (newest first, ≤ 12, trimmed to 6 first) + appendix skipped nights + ClinicianPreview table,
`notifications.js` REMINDER_BODY / body option ("Confirm today (10 s)" while synced; re-applied when the window flips),
`privacyFlows.js` phoneReminders2 sentence, `signalsFixtures.js` demoRows shaped to her starts (+ the demo adapter), the Home
"From your wearable" card and the milestone reworded to guidance (no "confirmed"), en-ui `auto.*` / `cycles.*` strings, the
gallery card, docs (CLINICIAN-REVIEW "Auto-tracked", PRIVACY-AUDIT "Auto-tracked S2", SPEC 3.5k S2, ARCHITECTURE), tests
(autoTracked.test.mjs, patterns, clinicianSummary, home) and e2e auto.spec.mjs S2 (+ axe on the card, the skip picker and
Cycles).

Deviations: none from the brief. The S1 wording in App.jsx's older "Ovulated" card and "Ovulation confirmed by temperature"
milestone were reworded (they predate S1 and broke the no-"confirmed" rule); registered in CLINICIAN-REVIEW auto.rise.

Verification (2026-11-09): build + stamp once; ESLint 0 errors (29 warnings, unused directives / unused vars, pre-existing);
unit 559/559; backend smoke:all passed; e2e 6/6; e2e:axe 4/4 (36 audits, 0 violations). Looked at: PDF page 1 (table of 2 cycles,
"seen, day 15", luteal 23 d, one page), the card in Soft light / Clear dark / Bloom light, the Cycles markers.

## S3 commit

What landed: the seventh flag `deviceSync` (features.js, default ON, FEATURE_MODULE null; lib/wearables.js SOURCES follows
deviceSync for the on-phone source and wearables for Oura/Terra, SOURCES_HERE; App.jsx `wearOn`; the Home door; the
Apple Health access line in wipeMore follows deviceSync); `src/lib/confirmNight.js` (pure: id 1100, action type, the two
actions, the text, confirmDueAt) + lib/notifications.js (registerConfirmActions, scheduleConfirm, onConfirmAction,
cancelAll keeps the confirm notification unless `all`, the web subscribe carries `confirm`); App.jsx schedules / cancels
it from autoModel, handles the action (via "notification", no screen; Open → Home), listens for the service worker's
`{ type: "confirm-night", day }` and the `#/confirm/<day>` hash; public/sw.js shows the two actions and routes them
(sw.test.mjs pins the new handlers); backend push stores `confirm` and sends `payloadFor(row)` (push-smoke pins the row
keys and the payload); `src/components/DataSourcesCard.jsx` on You (status · what it reads · Where it goes · last sync ·
nights, Connect/Sync, Pause/Resume, Disconnect + "Delete its readings from this device too" default on, preferred-source
picker, Demo readings switch, "How this is going" + "Kept on this device, never sent.") with lib/autoTracked.js sourceRows /
preferRows / howGoing; the gallery's five-style strip and notification mock; en-ui `sources.*`; .env.example, render.yaml,
NATIVE.md, ARCHITECTURE flag table, SPEC 3.5k S3, PRIVACY-AUDIT "Auto-tracked S3", CLINICIAN-REVIEW auto.notification /
auto.sources; tests notifications.test.mjs, autoTracked (sourceRows…), features, disclosures (OFF_RE.deviceSync), appearance
(the gallery may write data-style), sw; e2e auto.spec.mjs S3 + gallery, axe on Data sources (disconnect open) and the gallery.

Deviations: none from the brief. Notes: in the demo build "How this is going" says "No source connected on this device yet"
because trackStats.sourceSince counts real connects only (as the plan's pilot numbers intend). Pause is offered on every
connected source, demo included. The on-phone schedule can only be exercised on a phone (the plugin); its rule is unit-tested
and the web path is covered end to end (#/confirm/<day>, the service worker in sw.test.mjs).

Verification (2026-11-09): build + stamp once (features: ai, webReminders, deviceSync); ESLint 0 errors (26 warnings,
pre-existing); unit 563/563; backend smoke:all passed (push: confirm flag + payload); e2e 8/8; e2e:axe 5/5 (0 violations:
28 screens × 4 + the card, the skip picker, Cycles, Data sources, the gallery light and dark). Looked at: PDF page 1, the card
in three styles, the Cycles markers, Data sources, the five-style strip, the notification mock. Curated shots:
docs/plans/auto-tracked-shots/ (9 PNGs, 8–195 KB each, README.md indexes them).

## Owner to-do (unchanged from the brief)

- Play Console Health Connect declaration (the on-phone source now ships by default on Android: `deviceSync`).
- Clinician sign-off of the "Auto-tracked" CLINICIAN-REVIEW entries (auto.words, auto.rise, auto.table, auto.patterns,
  auto.reminder, auto.notification, auto.sources).
- Pilot measurement protocol (plan §8): read "How this is going" with the person present.
- Privacy review before marketing (and before Oura/Terra leave the `wearables` flag).
- Merge decision for `feature/auto-tracked` (nothing pushed or merged by the agent); on main, Render redeploys the static site.
- On the phones: run a real device through the 07:00 confirm notification once (the rule is unit-tested, the plugin path is not).
