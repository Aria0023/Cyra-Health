# Progress: tracking and reports (docs/plans/tracking-reports.md)

Branch `feature/tracking-reports`, worktree `/home/user/cyra-track`. Resume from here after a restart.

## Task 1: anonymous shop tap counts — DONE (final commit "Shop: anonymous tap counts per product, shown in the portal")
- backend `shop` module: `POST /api/shop/tap {productId}`, `GET /api/shop/taps`, `/taps.csv`, `shop_taps` daily totals.
- portal: Clicks page (`public/portal/reports.js`). App: `src/lib/shopTaps.js`, `shopTapsOff`, Shop footer, privacy row + switch.
- docs: PRIVACY-AUDIT section, privacy.html, health-data.html counsel note, README, .env.example, spec checklist, iOS manifest purpose.
- Verified 2026-11-19: lint 0 errors; app unit 684/684; backend 63/63; smoke:all passed; build stamp once;
  e2e 59/59 (58 + shop-live fixed and re-run); axe 44/44.

## Task 2: sign-in stats — not started
## Task 3: affiliate earnings — not started
## Task 4: weekly report + wearable how-to — not started
