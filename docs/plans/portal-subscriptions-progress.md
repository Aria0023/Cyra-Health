# Progress: the portal controls subscriptions, promotions, Pro grants and partner codes

Brief: docs/plans/portal-subscriptions.md. Branch feature/plans-shop-page. One commit per task, WIP commits allowed, a
follow-up commit after verification (no amend / force-push). Push after each commit.

Working copy: another session switched /home/user/cyra-health to a different branch mid-task, so this work happens in a
separate git worktree of the same repository (/home/user/cyra-subs, branch feature/plans-shop-page; node_modules are
symlinks to the main checkout's). Resume there: `git worktree list`.

## Task 1: backend (subscriptions module)
- [x] backend/src/modules/subscriptions/revenuecat.js (every endpoint path in one file; fails closed when env unset)
- [x] backend/src/modules/subscriptions/index.js: metrics (5 min cache), promotions + public /api/promotions/active,
      Pro grants (single, bulk, queued until first sign-in, revoke), partner codes (batches, assign, mark, export)
- [x] shop module exposes the portal's auth + audit (ctx.portal); accounts module sign-in / delete hooks
- [x] mount in config/app.json + app-dev.json, registry PRODUCTION_MODULES, prod-smoke, render.yaml, .env.example
- [x] backend/test/subscriptions.test.mjs (12), backend/scripts/subscriptions-smoke.js in smoke:all
- [x] verified: lint 0 errors (23 warnings), unit 660/660, backend 47/47 (12 new), smoke:all all passed (subscriptions
      smoke 18 ok), build stamp once, e2e 46/46, axe 34/34 -> final commit
- Baseline before any change: lint 0 errors (23 warnings), unit 660/660, backend 35/35
- Commits: 3e84288 (WIP), then the final commit after this note

## Task 2: portal screens
- [x] backend/public/portal/subs.js (Subscriptions, Promotions + editor with banner preview, Pro grants, Codes; partner
      Codes), wired into portal.js (nav, routes, /api/* paths), portal.css; footer sentence widened to stay true
- [x] docs/STORE-SETUP.md sections 6 (RevenueCat key, promotions, grants, privacy labels) and 7 (partner codes)
- [x] e2e/portal-subs.spec.mjs (2) + portal-subs-axe.spec.mjs (light/dark, phone + wide, 44px) with a mocked RevenueCat
      (e2e/lib/revenuecat.mjs); portal.spec nav lists updated
- [x] verified: lint 0 errors (23 warnings), unit 660/660, backend 47/47, smoke:all all passed, build stamp once,
      e2e 48/48, axe 36/36 -> final commit
- Commits: 8f3f9a5 (WIP), then the final commit after this note

## Task 3: the app
- [x] lib/promos.js (+tests): cleaner, device copy, audience on the device (stage, new = first date within 14 days),
      one at a time, banner with ONLY the store's price strings (web: none); lib/promoLive.js plain GET
- [x] lib/purchase.js (+tests): linkAccount (logIn with the account id only) / unlinkAccount (logOut), proUntil (free
      grants), loadOffer({ offeringId }), redeemCode (Apple sheet / Apple redeem page / Play redeem page); pricing.js
      planLines takes the store product's trial for a promotion's offering
- [x] components/PromoBanner.jsx; ProSheet (banner, promotion offering drives tiles + purchase, Pro until, Have a code?,
      what RevenueCat is told); You → Plan (banner, Pro until); App.jsx (promos / promoHidden device-only record keys,
      download when the Pro sheet or You opens and at most daily, logIn/logOut following the sign-in)
- [x] dev gallery pretend store: a promotion offering + "Open the Pro sheet with a promotion"; VITE_APP_STORE_ID
- [x] privacy: Pro sheet line, sign-in "What signing in shares", privacy.html, health-data.html, MONETIZATION, STORE-SETUP
      labels, PRIVACY-AUDIT entry
- [x] e2e/promos.spec.mjs (3), promos-axe.spec.mjs (light/dark)
- [x] verified: lint 0 errors (23 warnings), unit 670/670, backend 47/47, smoke:all all passed, build stamp once,
      e2e 51/51, axe 38/38 -> final commit
- Commits: 220e9a3 (WIP), then the final commit after this note

## Left for the owner
- Verify every endpoint in backend/src/modules/subscriptions/revenuecat.js against RevenueCat's current API docs.
- Set REVENUECAT_SECRET_KEY, REVENUECAT_PROJECT_ID (REVENUECAT_ENTITLEMENT=pro) on cyra-backend; VITE_APP_STORE_ID on the
  static site and phone builds; follow docs/STORE-SETUP.md sections 6 and 7; update the store privacy labels.
- Counsel: the clinic grant list (docs/PRIVACY-AUDIT.md, "Promotions, Pro grants and codes").
