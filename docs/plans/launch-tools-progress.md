# Progress: launch tools (docs/plans/launch-tools.md)

Branch `feature/launch-tools`, worktree `/home/user/cyra-launch`. Resume from here after a restart.

## Task 1: launch readiness page — verification in progress
- backend: `insights/readiness.js` (rows, summary, storage round trip, routes), `core/appSeen.js` (time of the last app
  request, in memory), `server.js` wires it, `registry.js` exports `secretProblem` / `DEMO_VALUES`.
- portal: `public/portal/launch.js` (Readiness page), nav link after Overview, route `#/readiness`, CSS.
- tests: `backend/test/insights-readiness.test.mjs`, `e2e/portal-readiness.spec.mjs`, `e2e/portal-launch-axe.spec.mjs`.
- docs: PRIVACY-AUDIT "Launch tools", spec checklist, backend/README.

## Task 2: AI spend meter — not started
## Task 3: feedback — not started
## Task 4: store-submission checks — not started
