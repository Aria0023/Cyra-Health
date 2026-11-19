# Progress: launch tools (docs/plans/launch-tools.md)

Branch `feature/launch-tools`, worktree `/home/user/cyra-launch`. Resume from here after a restart.

## Task 1: launch readiness page — DONE (final commit "Portal: launch readiness page")
- backend: `insights/readiness.js` (rows, summary, storage round trip, routes), `core/appSeen.js` (time of the last app
  request, in memory), `server.js` wires it, `registry.js` exports `secretProblem` / `DEMO_VALUES`.
- portal: `public/portal/launch.js` (Readiness page), nav link after Overview, route `#/readiness`, CSS.
- tests: `backend/test/insights-readiness.test.mjs`, `e2e/portal-readiness.spec.mjs`, `e2e/portal-launch-axe.spec.mjs`.
- docs: PRIVACY-AUDIT "Launch tools", spec checklist, backend/README.
- Verified 2026-11-19: lint 0 errors (23 warnings); app unit 691/691; backend 104/104; smoke:all passed (exit 0); build
  stamp once; e2e 68: 66 passed + portal.spec and portal-subs.spec failed on the nav list (now with "Readiness"), fixed
  and those two files re-run (2/2); axe 46/46.

## Task 2: AI spend meter — DONE (final commit "Portal: AI spend estimate, budget and alert")
- backend: `ai/spend.js` (recorder, prices, cost), hooks in `ai/index.js` + `ai/evidence.js`; `insights/spend.js`
  (report, budget, alert, routes); `config.ai.prices` in both config files; weekly report line; readiness row `ai-budget`.
- portal: AI costs page + Overview card (`launch.js`), nav after Weekly report.
- copy: four "keeps only a count" sentences reworded (aiFeatures.js x2, evidence.js, privacy.html); see PRIVACY-AUDIT.
- tests: `backend/test/ai-spend.test.mjs`, insights smoke, `e2e/portal-ai-costs.spec.mjs`, launch axe spec extended.
- Verified 2026-11-19: lint 0 errors (23 warnings); app unit 691/691; backend 111/111; smoke:all passed (exit 0); build
  stamp once; e2e 69/69; axe 46/46 (full runs, after the last change to this task's files).
- A kind "ask" (the free Ask) is recorded too, beside the brief's four: it spends tokens as well.
## Task 3: feedback — DONE (final commit "Feedback: send from the app, inbox in the portal")
- backend: module `feedback` (POST + owner inbox), in PRODUCTION_MODULES / app.json / app-dev.json / prod-smoke /
  features.js FEATURE_ALSO; `server.js` gives /api/feedback its own parser; weekly report counts.
- app: `src/lib/feedback.js` (payload, preview rows, send, copy, Help answers, VITE_SUPPORT_EMAIL),
  `src/components/Feedback.jsx` (HelpCard, FeedbackSheet), YouScreen `help` prop, App.jsx wiring, privacy row
  "Feedback you send", sentences updated (see PRIVACY-AUDIT Task 3).
- portal: Feedback page + Overview count (`launch.js`), nav after AI costs, footer reworded.
- docs: privacy.html row + short version, health-data.html counsel note, iOS privacy manifest (Customer support),
  .env.example + render.yaml (VITE_SUPPORT_EMAIL), STORE-SETUP, spec, backend/README.
- tests: `src/lib/feedback.test.mjs`, `backend/test/feedback.test.mjs`, `e2e/feedback.spec.mjs`,
  `e2e/feedback-axe.spec.mjs`, `e2e/portal-feedback.spec.mjs`, launch axe spec extended.
- Verified 2026-11-19: lint 0 errors (23 warnings); app unit 696/696; backend 119/119; smoke:all passed (exit 0); build
  stamp once; e2e 73/73; axe 50/50. The axe run's bundle was built after Task 4's ProSheet / delete-confirmation edits
  had started, so it covers this task's screens plus those two edits.
## Task 4: store-submission checks — verification in progress
- `ProSheet.jsx`: "Restore purchases" directly under the plan tiles (was at the bottom, below the Pro list); styles.
- `signin.js` deleteBody: + "It can't be undone. It doesn't cancel a Pro subscription: cancel that in the App Store or
  Google Play."
- `e2e/store-checks.spec.mjs` (3 tests); docs/STORE-SETUP.md section 5a; spec checklist; PRIVACY-AUDIT Task 4.
