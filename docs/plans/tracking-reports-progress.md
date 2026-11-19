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

## Task 3: affiliate earnings — IN PROGRESS
Written, not yet wired or run: `insights/impact.js`, `amazon.js`, `affiliates.js` (routes), `test/insights-affiliates.test.mjs`,
`e2e/lib/impact.mjs`. Left: mount in insights/index.js, brand field `impactCampaignId` (shop module, owner only, not in
the public catalog), portal Affiliates page + brand editor field, smoke (`insights-smoke.js` in smoke:all), e2e + axe,
docs/AFFILIATES.md, .env.example, render.yaml.
## Task 4: weekly report + wearable how-to — IN PROGRESS
Written, not yet wired or run: `insights/weekly.js` (pure), `insights/report.js` (routes + hourly timer),
`test/insights-weekly.test.mjs`. Left: `writeText` + `ctx.aiWrite` in the ai module, mount in insights/index.js, portal
Weekly report page, devices how-to (Devices.jsx, lib/devices.js; hide the Terra row unless the server reports it),
e2e + axe, docs.
