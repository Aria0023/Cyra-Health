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

## Task 2: AI spend meter — not started
## Task 3: feedback — not started
## Task 4: store-submission checks — not started
