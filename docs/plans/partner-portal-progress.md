# Progress: partner portal, enterprise login and a live shop catalog

Brief: docs/plans/partner-portal.md. Branch feature/plans-shop-page. One commit per task, WIP commits allowed, a
follow-up commit after verification (no amend / force-push). Push after each commit.

Baseline (2026-11-15, before any change): lint 0 errors (23 warnings), unit 647/647, backend tests 13/13
(e2e 41/41 and axe 30/30 at the last commit of this branch).

## Task 1: catalog and partner backend
- [x] backend/src/modules/shop/vocab.js (vocabulary + input cleaners)
- [x] src/lib/shopSeed.js + scripts/shop-seed.mjs (`npm run shop:seed`) -> backend/config/shop-seed.json
- [ ] backend/src/modules/shop/index.js: email-code sign-in (portal token, own HKDF label), roles, brands, products
      (working copy + published snapshot), images, applications, invites, audit, public catalog (ETag), seed
- [ ] mount in config/app.json + app-dev.json, registry PRODUCTION_MODULES, prod-smoke, render.yaml, .env.example
- [ ] backend/test/shop.test.mjs, backend/scripts/shop-smoke.js in smoke:all
- [ ] verified -> final commit
