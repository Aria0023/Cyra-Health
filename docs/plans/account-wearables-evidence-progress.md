# Progress: sign-in, easy wearables, Pro = evidence-based AI

Brief: docs/plans/account-wearables-evidence.md. Branch feature/account-wearables-evidence. One commit per task.

Baseline (2026-11-12, before any change): lint 0 errors (26 warnings), unit 574/574, backend smoke:all passed.

## Task 1: Sign-in required: DONE (commit "Accounts: sign in required with Apple, Google, Facebook or email")
- backend/src/modules/accounts (+ oauth subject hash, ctx.oauth), production config oauth + accounts, tests + smoke
- app: SignInStep (registration step 1 + gate), You → Account (SignedInCard), Delete everything deletes the account,
  VITE_REQUIRE_SIGNIN, record key `signin` (device-only, never in backups), copy sweep, legal drafts, docs
- Verified: lint 0 errors (25 warnings); unit 580/580; backend test 13/13; smoke:all passed (new ACCOUNTS SMOKE);
  build stamp once; e2e 13/13; e2e:axe 15/15
- e2e harness now builds a second bundle (dist-e2e-api) with VITE_API_BASE=https://api.solia.test, answered by
  e2e/lib/api.mjs (page.route); the walker's `signin` option handles the new first step.

## Task 2: Easy wearable setup: not started
## Task 3: Pro = evidence-based AI: not started
