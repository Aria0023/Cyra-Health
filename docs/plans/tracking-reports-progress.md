# Progress: tracking and reports (docs/plans/tracking-reports.md)

Branch `feature/tracking-reports`, worktree `/home/user/cyra-track`. Resume from here after a restart.

## Task 1: anonymous shop tap counts — IN PROGRESS
Done (WIP commit):
- backend `shop` module: `POST /api/shop/tap {productId}` (body exactly that; published ids only; rate-limited in
  memory; daily totals in `shop_taps`, 400 days), `GET /api/shop/taps?days=7|30|90`, `GET /api/shop/taps.csv`
  (owner all, partner own brands), `ctx.portal.tapReport`.
- portal: `public/portal/reports.js` (Clicks page: stats, bar chart, two tables, CSV), nav link, CSS, footer sentence.
- app: `src/lib/shopTaps.js` (+ test), device-only `shopTapsOff`, Shop page `onTap` / footer copy, privacy dashboard
  row "Count my shop taps anonymously" with its switch.
Left: backend unit tests + smoke, e2e (app + portal + axe), docs (PRIVACY-AUDIT, privacy.html, AFFILIATES, spec note),
full verification, final commit.

## Task 2: sign-in stats — not started
## Task 3: affiliate earnings — not started
## Task 4: weekly report + wearable how-to — not started
