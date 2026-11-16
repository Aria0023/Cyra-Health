# Owner request, 2026-11-16: Shop easier to find, and lifelike product graphics

Owner's words: "the shop by need has to be easier to find, took me long time to find it, also the graphics have to be
live looking, similar to website product"

Branch: feature/shop-findable-visuals (from main 4fa87fd). TWO tasks, ONE COMMIT EACH, WIP first then a final commit
after verification (never amend + force-push). Progress note: docs/plans/shop-findable-visuals-progress.md; push after
each commit. Never push/merge main, no PR, never `playwright install`, no new npm dependencies. Read CLAUDE.md first.
Hard rules: every UI sentence literally true; ARIA/focus/44px/WCAG AA; axe light+dark; UI palettes and data-viz ramps
separate; calm tone; no fake badges or prices.

## Task 1: easy to find (commit "Shop: a labelled header button, a Home card and a place in the + sheet")
Today the Shop opens from an unlabelled bag icon in the header and one card low on You. Make it obvious:
1. Header: the bag button gets a visible text label "Shop" beside the icon (a pill, 44px high), on the five main tabs.
   If the header gets too tight at 360px, keep icon+label and drop the label of a less important header button first.
2. Home: a "Shop by need" card near the top of Home, below the hero and quick log (not inside insights or urgent
   guidance): title, one line ("Real products for <her stage in words>"), three small product thumbnails from her first
   category, and a clear "Browse the shop" button. She can hide it ("Hide", remembered in a device-only record key,
   never in a backup); a hidden card can be brought back from You. Owner decision 2026-11-16: the shop may appear on
   Home; it still never appears in insights, Patterns findings, urgent screens, notifications or onboarding. Update the
   e2e test that asserted the shop never shows on Home, and the docs that say so (PRIVACY-AUDIT / AFFILIATES / SPEC).
3. The "+" log sheet: a "Shop by need" row at the bottom, under a divider.
4. You: move the Shop entry card to the top group of You (right under her stage), not near the bottom.
5. Bottom nav stays five tabs + "+": do not add a sixth tab.
6. First visit hint: the first time she lands on Home after this update, a one-time small coach mark pointing at the
   header "Shop" pill ("New: Shop by need"), dismissible, device-only key, respects reduced motion, never traps focus.
Tests: e2e for each entry point (header pill on all tabs, Home card + hide + bring back, + sheet row, You position,
coach mark once), axe light/dark.

## Task 2: lifelike product graphics (commit "Shop: lifelike product illustrations for every item")
We may not copy brand photos or logos from brand websites (no licence); real photos arrive later from each affiliate
program's creative kit and are uploaded in the portal or public/shop/ (already supported: a real image always wins).
Until then, replace the abstract placeholder (gradient + icon) with a realistic, generic product render per item:
1. Hand-built SVG illustrations, product-photo style (studio look): soft floor shadow, highlights, gradients, depth,
   realistic proportions, on a soft brand-hue backdrop. One per product type, drawn carefully, each about 3-8 KB:
   LH test strip with pouch; digital ovulation test stick with screen; fertility hormone monitor (handheld analyzer +
   wand); phone-clip fertility reader; PdG strip box; basal thermometer; vitamin bottle with softgels; pregnancy test
   stick; CGM sensor (round patch) with applicator (two variants for the three CGM items); smart ring; square
   smartwatch; round sports watch; slim fitness band; screenless fabric strap; heat wrap; period underwear (flat lay);
   laptop/phone video-visit with a clinician silhouette; folded cooling sheets and pillow; phone with a sleep program
   screen (two variants); lab test items: home collection kit box with lancet card, and a lab requisition + blood
   tube (walk-in). Generic shapes only: NO brand logos, wordmarks, trade dress or copied packaging; neutral colours
   plus the item's brand hue as an accent. Text inside images limited to generic marks (e.g. test lines), no claims.
2. Implement as React SVG components in src/components/shop/art/ (or one sprite module), chosen by a new `art` field on
   each item in src/lib/shop.js; the server catalog may carry `art` too (cleaned against the known list; unknown ->
   category default). aria-hidden (the card's text already names the product). Works in dark mode (backdrop adapts),
   all five styles, reduced motion (no animation needed; an optional gentle hover lift only).
3. Card polish to feel like a product page: image area 4:3 on phones in the snap scroller, subtle zoom-on-hover on wide
   screens, the image links to the same destination as "Visit <brand>" (one tab stop: make the image a non-focusable
   click target, the button stays the accessible control).
4. Caption honesty: a small "Illustration" tag in the image corner whenever a card shows an illustration instead of a
   real product photo, and the "About this shop" footer says: "Pictures marked Illustration are drawings, not photos
   of the product." Real uploaded images show no tag.
5. Home card thumbnails (Task 1) use the same art.
6. Portal: the product editor's preview shows the same illustration when no image is uploaded, with a picker for `art`
   (owner only).
Tests: unit (every bundled item has a valid art id; cleaner falls back), e2e (illustration tag present without an
image, absent with one), axe light/dark incl. wide layout; check bundle size impact and report it.

## Verification before each final commit
npm run lint (0 errors), npm run test:unit, cd backend && npm test && npm run smoke:all, npm run build (stamp
"BUILD 2026.10.07-D" once), npm run e2e -- --trace off, npm run e2e:axe -- --trace off (0 violations).
Author: git -c user.name="Aria" -c user.email="aria23@gmail.com". Trailer lines:
Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HHP8o69cmnMvBZyGdDsuZF
