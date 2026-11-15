# Progress: partner portal, enterprise login and a live shop catalog

Brief: docs/plans/partner-portal.md. Branch feature/plans-shop-page. One commit per task, WIP commits allowed, a
follow-up commit after verification (no amend / force-push). Push after each commit.

Baseline (2026-11-15, before any change): lint 0 errors (23 warnings), unit 647/647, backend tests 13/13
(e2e 41/41 and axe 30/30 at the last commit of this branch).

## Task 1: catalog and partner backend
- [x] backend/src/modules/shop/vocab.js (vocabulary + input cleaners)
- [x] src/lib/shopSeed.js + scripts/shop-seed.mjs (`npm run shop:seed`) -> backend/config/shop-seed.json
- [x] backend/src/modules/shop/index.js: email-code sign-in (portal token, own HKDF label), roles, brands, products
      (working copy + published snapshot), images, applications, invites, audit, public catalog (ETag), seed
- [x] accounts: resendMailer() shared (no behaviour change); affiliates module notes the production path
- [x] mount in config/app.json + app-dev.json, registry PRODUCTION_MODULES, prod-smoke, render.yaml, .env.example
      (ADMIN_EMAILS, DATA_DIR note); features.js FEATURE_MODULE.shop = "shop"
- [x] backend/test/shop.test.mjs (22), backend/scripts/shop-smoke.js in smoke:all; src/lib/shopSeed.test.mjs (seed + vocab drift)
- [x] verified: lint 0 errors (23 warnings), unit 650/650, backend 35/35, smoke:all all passed (shop smoke 18 ok),
      build stamp once, e2e 41/41, axe 30/30 -> final commit
- Commits: 177b42e, 91f9474 (WIP), then the final commit after this note

## Task 2: the portal web app
- [x] backend/src/modules/portal (static /portal/, /portal/apply, strict CSP), backend/public/portal (html, js, css, fonts);
      chosen over a second Vite entry (same origin as the API, deploys with the backend); configs, registry, prod-smoke,
      FEATURE_ALSO.shop = ["portal"], backend/README section; dev static skips /portal
- [x] e2e/portal.spec.mjs (3) against a real dev backend started in the spec (e2e/lib/portal.mjs); portal-axe.spec.mjs
      light/dark, phone + wide, 44px check; shopSeed.test.mjs checks portal labels match the app
- [x] verified: lint 0 errors (23 warnings), unit 651/651, backend 35/35, smoke:all all passed, build stamp once,
      e2e 44/44, axe 32/32 -> final commit
- Commits: 1007c0a (WIP), then the final commit after this note

## Task 3: the app reads the live catalog
- [x] src/lib/shopCatalog.js (+ tests): cleaner, record value, bundled/live shapes, fallback
- [ ] fetch on Shop open + once a day; device-only record key shopCatalog (not in backup); Shop.jsx on the shape
- [ ] footer sentence; PRIVACY-AUDIT, AFFILIATES, .env.example, render.yaml
- [ ] e2e with the mocked API (new brand appears; invalid catalog falls back)
- [ ] verified -> final commit
