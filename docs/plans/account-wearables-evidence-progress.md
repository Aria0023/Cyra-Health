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

## Task 2: Easy wearable setup: DONE (commit "Devices: one place to connect wearables, from onboarding, Home and You")
- lib/devices.js + components/Devices.jsx: one list; registration step "devices" (before Consent), Home card
  (devicesHint, device-only), sheet, You → Data sources button; wearables on by default; production mounts integrations
- Terra row wording follows the code (held up to 7 days), not the brief's "not kept" (Oura only)
- Verified: lint 0 errors (25 warnings); unit 585/585; backend 13/13; smoke:all passed; build stamp once; e2e 15/15; axe 17/17
## Task 3: Pro = evidence-based AI: DONE (commit "Pro: evidence-based answers with sources; all practices free with voice guidance")
- every practice free (mind.js, plan.js drops fullPractices, adds aiEvidence); voice guide (lib/voice.js, practiceVoice key)
- backend ai/evidence.js POST /api/ai/evidence (web_search_20260209, allowed_domains, max_uses 5, effort medium, refusal,
  search-error and pause_turn handling, rate limit), scripts/evidence-smoke.js in smoke:all
- EvidenceCard (Mind → Journey, Patterns), preview via AiSendSheet, red flags on device; ProSheet leads with it
- Verified: lint 0 errors (23 warnings); unit 589/589; backend 13/13; smoke:all passed; build stamp once; e2e 18/18; axe 21/21

All three tasks done. Nothing left from the brief; see the final report for owner actions (env vars, persistent disk).
