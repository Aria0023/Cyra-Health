# Progress: Shop easier to find, lifelike product illustrations

Branch `feature/shop-findable-visuals`. Brief: `docs/plans/shop-findable-visuals.md`.

## Task 1: easy to find
- [x] WIP committed: header "Shop" pill (icon + label), Home "Shop by need" card (hide / bring back from You), "+" sheet
      row, You entry card moved under the stage card, one-time "New: Shop by need" hint, device-only key `shopHint`.
- [x] e2e + axe specs for each entry point; docs (PRIVACY-AUDIT, AFFILIATES, SPEC); Back returns focus to Home's and
      You's card; a narrow header (under 375px) drops her name's chip so the Shop pill keeps icon + label.
- [x] Verified 2026-11-16: lint 0 errors; unit 671/671; backend 52/52; smoke:all passed; build stamp once
      (1,618.14 kB, gzip 510.12 kB); e2e 59/59; axe 38/38, 0 violations. FINAL COMMIT DONE.

## Task 2: lifelike product illustrations
- [x] WIP committed: 23 illustrations in `src/lib/shopArt.js` (SVG markup as data, hue through CSS classes so the portal's
      CSP is fine), `src/components/shop/art/ShopArt.jsx`, `art` on every item, the card (4:3, Illustration tag, image is
      a click target, hover zoom), footer sentence, Home thumbnails, catalog cleaner (`art` kept only when known).
- [ ] backend `art` field (vocab, owner-only, catalog, seed), portal preview + picker (generated
      `backend/public/portal/shop-art.js` by `npm run shop:seed`), unit/e2e/axe tests, docs, bundle size, verification,
      final commit.

Baseline bundle (main 4fa87fd, `npm run build`): dist/assets/index-*.js 1,611.61 kB (gzip 508.62 kB).
