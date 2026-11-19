# Progress: tracking and reports (docs/plans/tracking-reports.md)

Branch `feature/tracking-reports`, worktree `/home/user/cyra-track`. Resume from here after a restart.

## Task 1: anonymous shop tap counts — DONE (final commit "Shop: anonymous tap counts per product, shown in the portal")
- backend `shop` module: `POST /api/shop/tap {productId}`, `GET /api/shop/taps`, `/taps.csv`, `shop_taps` daily totals.
- portal: Clicks page (`public/portal/reports.js`). App: `src/lib/shopTaps.js`, `shopTapsOff`, Shop footer, privacy row + switch.
- docs: PRIVACY-AUDIT section, privacy.html, health-data.html counsel note, README, .env.example, spec checklist, iOS manifest purpose.
- Verified 2026-11-19: lint 0 errors; app unit 684/684; backend 63/63; smoke:all passed; build stamp once;
  e2e 59/59 (58 + shop-live fixed and re-run); axe 44/44.

## Task 2: sign-in stats — DONE (final commit "Portal: account and sign-in totals")
- accounts module: `lastSeenDay` (UTC date, at most one write a day, on sign-in and GET /me); the app calls GET /me once
  per launch while signed in (`accountSeen`).
- new backend module `insights` (mounted in production, app.json / app-dev.json / registry / features FEATURE_ALSO):
  `GET /api/insights/people` (owner only, counts only). Portal: People page + Overview card.
- copy: sign-in "What signing in shares", privacy dashboard "Other connections", consent `serverSees`, privacy.html,
  PRIVACY-AUDIT, portal footer.
- Verified 2026-11-19: lint 0 errors; app unit 684/684; backend 70/70; smoke:all 12/12 passed; build stamp once;
  e2e 62/62 (61 + portal.spec fixed and re-run); axe 44/44.

## Task 3: affiliate earnings — DONE (final commit "Portal: affiliate clicks, sales and commission from Impact")
- `insights/impact.js` (every Impact endpoint; VERIFY against Impact's docs), `amazon.js` (CSV → per-day totals),
  `affiliates.js` (routes, 15-minute cache), brand field `impactCampaignId` (owner only, never published).
- Portal: Affiliates page, brand editor field. Smoke: `scripts/insights-smoke.js` (in smoke:all). e2e/lib/impact.mjs.
- Docs: AFFILIATES.md sections 4 and 5, .env.example, render.yaml (IMPACT_ACCOUNT_SID, IMPACT_AUTH_TOKEN), PRIVACY-AUDIT.
- Verified 2026-11-19: lint 0 errors; app unit 684/684; backend 82/82; smoke:all 13/13 passed; build stamp once;
  e2e 64/64 (63 + guest.spec.mjs:37, which failed once on a reload and passed 3 of 3 re-runs: timing, not this task);
  axe 44/44.
- NOTE: `insights/report.js` and `test/insights-weekly.test.mjs` (Task 4, unfinished) are NOT in this commit; they are in
  commit 2353bcc and come back in the next WIP commit.

## Task 4: weekly report + wearable how-to — IN PROGRESS
Written, not yet wired or run: `insights/weekly.js` (pure), `insights/report.js` (routes + hourly timer),
`test/insights-weekly.test.mjs`. Left: `writeText` + `ctx.aiWrite` in the ai module, mount in insights/index.js, portal
Weekly report page, devices how-to (Devices.jsx, lib/devices.js; hide the Terra row unless the server reports it),
e2e + axe, docs.
