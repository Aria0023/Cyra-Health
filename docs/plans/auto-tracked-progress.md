# Auto-tracked spike: progress notes

Resumable log for docs/plans/auto-tracked-spike.md (branch `feature/auto-tracked`). Updated with every WIP commit so a
restart can pick up where the last session stopped. Dates are 2026-11-09 unless said otherwise.

## State of the branch

| part | commit | state |
| --- | --- | --- |
| S1 — signals library + source adapter | 63acff7 (WIP body; not the tip, so its body is not rewritten: the verification is recorded here) | done, verified below |
| Brief | af3ff2d | in the repo |
| E2E — in-repo Playwright harness | this commit | done, verified below |
| S2 — Looks right, cycle markers, cycle table | — | next |
| S3 — confirm from the notification, Data sources, deviceSync | — | after S2 |

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

## Owner to-do (unchanged from the brief)

Play Console Health Connect declaration; clinician sign-off of the "Auto-tracked" CLINICIAN-REVIEW entries; pilot
measurement protocol (plan §8); privacy review before marketing.
