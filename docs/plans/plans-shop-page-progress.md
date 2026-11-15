# Progress: no "No account needed", visible plans + trial, a distinct Shop page

Brief: docs/plans/plans-shop-page.md. Branch feature/plans-shop-page. One commit per task, WIP commits allowed, a
follow-up commit after verification (no amend / force-push). Push after each commit.

Baseline (2026-11-15, before any change): lint 0 errors (23 warnings), unit 637/637, e2e 34/34, axe 27/27.

## Task 1: no "No account needed"
- [x] copy: signin.js (skip "Continue for now", why lines), account.js guestTitle, en-ui you.noAccountNeeded, disclosures splash, onboarding Device step, about.js ACCOUNT_LINES
- [x] You account card by sign-in mode; sign-up step title/sub when sign-in is off
- [x] unit + e2e tests, PRIVACY-AUDIT entry, SPEC/ARCHITECTURE wording
- [x] verified: lint 0 errors (23 warnings), unit 638/638, build stamp once, e2e 35/35, axe 27/27 -> final commit
- Commits: 89298a1 (WIP; also appended the owner's Task 3 design update to the brief), cb71a08 (final)

## Task 2: plans and the 7-day trial
- [x] lib/plans.js (+tests): web tiles, store tiles (store prices, trial badge from the store offer), trial line, Home note rules
- [x] components/PlanTiles.jsx (tiles, Get in the app with VITE_APP_STORE_URL / VITE_PLAY_STORE_URL, else "Coming soon"); You → Plan; Pro sheet opens with the tiles
- [x] Home "Pro · 7-day free trial" note; record key proChip (device-only, not in backup) + record tests
- [x] e2e/plans.spec.mjs + plans-axe.spec.mjs (light + dark), axe.spec Pro sheet updated; dev gallery's pretend yearly product has a 7-day intro offer
- [x] docs: MONETIZATION 1d, PRIVACY-AUDIT, .env.example VITE_APP_STORE_URL / VITE_PLAY_STORE_URL
- [x] verified: lint 0 errors (23 warnings), unit 643/643, build stamp once, e2e 38/38, axe 29/29 -> final commit
- Commits: 38a1987 (WIP), then the final commit after this note

## Task 3: a distinct Shop page
- [ ] not started
