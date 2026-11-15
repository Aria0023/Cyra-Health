# Owner request, 2026-11-15: no "No account needed", visible plans + trial, a distinct Shop page

Owner's words: "still says no account needed, i dont see subscriptions, trial 7 days, etc. also Shop by need ...
i want seperate section that shows real products/friendly calm but distinct, maybe seperate tab that opens up"

Branch: feature/plans-shop-page. THREE tasks, ONE COMMIT EACH (CLAUDE.md). Commit WIP early and finish with a follow-up
commit after verification (never amend + force-push; blocked). Progress note: docs/plans/plans-shop-page-progress.md.
Push after each commit. Never push/merge main, no PR, never `playwright install`, no new npm dependencies.
Hard rules: every privacy/UI sentence literally true of the build; ARIA/focus/44px/WCAG AA, axe light+dark; calm copy.

Context: the live web build has NO backend (VITE_API_BASE unset), so sign-in cannot run there and the app falls back to
guest mode; nothing is sold on the web (store purchases only in the phone apps, lib/purchase.js, lib/pricing.js:
$9.95/month, $100/year, 7-day free trial on yearly).

## Task 1: no "No account needed" (commit "Accounts: say accounts are coming, never 'No account needed'")
The owner requires accounts. Remove every "No account needed" / "There's no Solia Health account to make" sentence
(src/lib/account.js guestTitle, src/locales/en-ui.js you.noAccountNeeded, src/lib/disclosures.js ~179-180, and any
other occurrence in src/ and public/legal/). Replace with true wording for each build:
- server with sign-in: the signed-in Account card as today.
- no server / no provider configured (the live demo): title "Your account", body like "Sign-in isn't switched on in
  this version yet. Until it is, your log lives only on this device." and on the sign-up step keep the skip but word it
  "Continue for now" with the reason ("Sign-in isn't switched on in this version yet"). Keep every claim true.
Update unit/e2e tests that pinned the old text, PRIVACY-AUDIT entry.

## Task 2: plans and the 7-day trial, clearly visible (commit "Plans: show Monthly and Yearly with the 7-day free trial")
- You → Plan card: two plan tiles side by side (stack under 360px): "Yearly · $100 a year · about $8.33 a month ·
  7-day free trial" (badge "7-day free trial", marked best value) and "Monthly · $9.95 a month". On the web the
  action is "Get Solia Health Pro in the app" with App Store / Google Play buttons, which link to store URLs taken from
  VITE_APP_STORE_URL / VITE_PLAY_STORE_URL (add to .env.example); while unset, show "Coming soon to the App Store and
  Google Play" (disabled-looking text, not a dead button). On phones keep the store-driven purchase flow and store
  prices only (pricing.js rules), but render the same two-tile layout with the trial badge from the store's offer.
- Pro sheet: open with the same two tiles and a one-line "Try Pro free for 7 days on the yearly plan, then $100 a
  year. Cancel any time." (web: names the US reference price "in the iPhone and Android apps"), then what Pro adds.
- A small "Pro · 7-day free trial" chip/entry on Home for non-Pro users, dismissible, opening the Pro sheet. Not on
  urgent screens, never in notifications, at most once per day visible.
- Tests: unit for tile model (web vs store), e2e + axe light/dark for You plan tiles and the Pro sheet.

## Task 3: a distinct Shop page (commit "Shop: its own calm page, opened from the header and You")
- Move "Shop by need" out of the You card list into its own full-screen page (route #/shop; keep #/care and #/shelf
  redirects), opened from: a bag icon button in the top header (aria-label "Shop", 44px, visible on the five main
  tabs), and a single distinct entry card on You ("Shop by need · Real products for your stage" with an arrow).
- Friendly, calm but distinct look, still within the design system: a soft "shop" tint/wash for the page header,
  category chips as a horizontal scroller at the top (her stage's categories first), product cards as a 2-column grid on
  wide screens / 1 column on phones, each card with a brand monogram tile (coloured from the existing UI palette, not
  the data-viz ramps), brand, product name, the one-line why, the evidence label pill, and "Visit <brand>" (affiliate
  label + disclosure only where src/config/affiliates.json has a link, as today). Sources stay behind a disclosure.
  A short footer with the honest notes (what the shop learns, not medical advice).
- Back button returns to where she came from; the page has an h1, landmarks, focus moves to the h1 on open.
- Keep the quiet contextual links (devices sheet, fertility signs, glucose card) but point them at the new page with the
  right category preselected.
- Tests: update shop e2e/axe specs for the page (light+dark), header button, deep links.

### Task 3 owner update (2026-11-15, reference: health marketplaces such as Quest Diagnostics, Midi, Hims/Hers, Everlywell)
Build the Shop page to this design, within the design system and calm tone:
1. Top: a horizontal scroller of brand chips ("All brands" first), each chip = small coloured monogram tile (2 letters,
   colour from the UI palette, not the data-viz ramps) + brand name; tapping filters to that brand. Keep the category
   chips too (her stage's categories first) as a second row or a toggle "By need / By brand".
2. Content grouped by brand: each brand section has a full-width softly tinted header band (left accent border in the
   brand tile colour, monogram tile, brand name, a small uppercase category tag like "LAB NETWORK" / "AT-HOME TESTS" /
   "TELEHEALTH" / "WEARABLE", one-line description). Under it a row/grid of product cards.
3. Product card: an image area on top (aspect ~1:1) with a small brand pill overlaid bottom-right; then a line with
   availability (e.g. "Ships to your home" / "Walk-in at a lab" / "Online visit") and the price on the right when known;
   product name (larger); a short "what it covers" line; 1-2 lines of description; "Sold by <brand>"; evidence pill;
   buttons "Visit <brand>" (primary, dark) and "Learn more" (secondary, opens the Sources/why disclosure or a small
   sheet). Affiliate label + disclosure only where src/config/affiliates.json has a link (unchanged rule).
4. Images: no licensed product photos yet. Optional `image` per item read from public/shop/<item id>.(jpg|webp),
   declared in a manifest (src/config/shop-images.json, committed empty); when absent, a calm illustrated placeholder
   (soft gradient in the brand tile colour + the category icon), never a broken image, never hotlinked brand images.
   Document in docs/AFFILIATES.md that the owner drops images from each affiliate program's creative kit (they grant
   use) into public/shop/.
5. Price: optional `price` field ("From $89") the owner fills in src/config/affiliates.json alongside the link (or a
   separate field), shown only when present, with "Price set by <brand>; check their site" in Learn more. No invented prices.
6. Badges: no fake "Physician pick"/"Best seller". A "Clinician reviewed" badge only for items whose CLINICIAN-REVIEW
   entry is marked signed (none yet, so none show): implement the mechanism, default off.
7. Catalog additions that fit women's health (real brands, no contraception services, no invented claims): lab testing:
   Quest Diagnostics (questhealth.com consumer tests, e.g. women's health/hormone or thyroid panels), Labcorp OnDemand
   (e.g. women's health or thyroid tests), Everlywell (e.g. women's fertility test, perimenopause test); telehealth:
   Midi Health (menopause, already in), Hers (only categories unrelated to contraception, e.g. menopause or skin if
   offered; if unsure, skip). Wire them into categories (add a "Lab tests" category; Trying to conceive and PCOS see
   relevant lab tests early). Every why line registered in CLINICIAN-REVIEW, marked confirm at review.
8. Layout: 1 column on phones (cards full width), 2-4 columns on wide screens; generous spacing like the reference;
   works in all five styles and dark mode; axe 0 violations; 44px targets.
Everything else in Task 3 stays (header bag button, #/shop route, entry card on You, contextual links with the
category preselected, honest footer).

## Verification before each final commit
npm run lint (0 errors), npm run test:unit, npm run build (stamp "BUILD 2026.10.07-D" once), npm run e2e -- --trace off,
npm run e2e:axe -- --trace off (0 violations). Author: git -c user.name="Aria" -c user.email="aria23@gmail.com".
Trailer lines:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HHP8o69cmnMvBZyGdDsuZF
