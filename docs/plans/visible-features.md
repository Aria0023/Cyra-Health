# Owner request, 2026-11-19: make features visible; You as a short menu

Owner's words: "i think the you page has too many things on it?" and "everything seems hidden, products, AI
suggestions, AI chat etc." I proposed the plan below; the owner replied: "i wouldnt want the 5 tabs to change because
they provide robust and easy feel, so would not add 6th. agree with your build".

Branch: feature/visible-features (from main f023450). THREE tasks, ONE final commit each (WIP commits before are
fine). Never amend, never force-push. Push after each commit. Never touch main, no PR, no new npm dependencies, never
`playwright install`. Progress note: docs/plans/visible-features-progress.md. Read CLAUDE.md first.

Hard constraints
- The five tabs (Home, Body, Mind, Patterns, You) do not change: same five, same order, same labels, same nav.
- Zero features removed and zero behaviour change inside a feature: this is where things are found, not what they do.
- Every privacy/UI sentence stays literally true. Many sentences name a place ("You -> Privacy & your data",
  "You -> Solia Health's AI", "You -> Help", "You -> Modules", "You -> Appearance"): after this work each such path
  must still lead there in the words shown. Search all of src/, public/legal, docs for "You →" and "You ->" and fix or
  keep each one deliberately; list them in the progress note.
- Keep ARIA, focus handling (focus moves into an opened page and back to the row that opened it), 44px targets,
  contrast; axe specs for every new surface, light and dark. Works in every style (Soft, Mono, Clear, Journal, Aura,
  Sky, Blush, Mint, Sunset).
- Exactly one life-stage experience per user. Apple Sign-In stays first. No scores/streaks. Guidance, never diagnosis.
- Another feature branch (feature/meal-photos, not yet merged) adds a "Meal photos" switch to You -> Solia Health's AI
  and a row in the privacy list. Keep the AI card and privacy list as self-contained components so that merge is easy;
  do not restructure their insides.

## Task 1: AI on Home (commit "Home: Ask Solia card; AI suggestions where she already looks")
- A card near the top of Home (after the hero / next-period row, before Getting started), "Ask Solia":
  one text box and two actions, "Ask" (opens the existing chat with her question typed in, NOT sent: the existing
  send/preview flow and consent stay exactly as they are) and "Ask with evidence" (opens the existing evidence card
  the same way). Use the existing components and state; do not fork the AI logic.
- States, each truthful:
  - AI available and she has Pro + the feature switched on: as above.
  - Available but a switch is off: the card says it is off and offers "Turn on in You → Solia Health's AI" (deep
    link to that page), never turning anything on by itself.
  - Not Pro: what Pro's AI does in one or two lines and the existing plans entry ("See plans"); free-week wording
    only where the trial gate is on.
  - Guest / signed out where sign-in is required: the existing "create an account" path.
  - No server or AI not set up on the server (today's live site): a short "Coming soon" card that says AI isn't
    connected in this build yet. No dead buttons. This replaces today's behaviour of hiding AI entirely.
- AI suggestions: the weekly AI write-up, when she has one, shows as a card on Home under Today's insight and at the
  top of Patterns, with the existing "by AI / not advice" footers; You keeps only its switches and disclosures.
- She can hide the Ask Solia card (a device preference, with a way back in You -> App settings), like other Home cards.

## Task 2: Shop entry points (commit "Shop: header button and + menu row")
- Port ONLY the entry points from origin/feature/shop-findable-visuals (6bb6317): the labelled "Shop" pill in the
  header (replacing the bare bag icon), the row in the "+" sheet, and the one-time coach mark. Do NOT port the SVG
  product illustrations (src/lib/shopArt.js, components/shop/art) or the "Illustration" tag: the owner rejected
  those and wants affiliate-supplied photos later. Keep the Home shop card out as well unless it already exists on
  main. The header also has the new plan badge: make sure the header still fits at 320px and 390px widths without
  overlap in every style (wrap to a second row as it does today).

## Task 3: You becomes a short menu (commit "You: a short menu of six pages")
- You shows: the stage hero card at the top (unchanged), then six rows, each opening its own page inside the You
  tab (use the app's existing sub-page pattern: routes.js SUBPAGES / the back link used by Journey -> Connection,
  with hash routes so the browser back button works and deep links exist):
  1. Your profile: stage, about you, condition modules (Modules).
  2. Plan & account: plan card (with trial/Pro state, restore purchases), account / guest card, delete account.
  3. Devices & reminders: data sources / devices, check-in reminders, install the app.
  4. Privacy & your data: the privacy card and list exactly as now (what leaves the device, shop tap switch,
     anonymous counts, backup/export/delete everything), and the AI disclosure link.
  5. App settings: appearance and style, language, voice guide, the tour ("Finding your way"), Home card visibility.
  6. Help & about: Help, Send feedback / Report a problem, About & legal, the build stamp.
  Solia Health's AI (switches + disclosures) keeps its own clearly named row or sits first inside Privacy & your
  data: choose the one that keeps every "You → Solia Health's AI" sentence literally true, and say which.
- Each row: icon, title, one line of what is inside, and for Plan & account the live state (the planBadge label,
  e.g. "Free week · 4 days left"). Privacy & your data is the second row (it is a selling point).
- "Restore purchases" and "Delete my account" stay within two taps of the You tab (e2e/store-checks.spec.mjs pins
  this: keep it passing, adjusting selectors only if the path wording is unchanged).
- The build stamp "BUILD 2026.10.07-D" must still render exactly once in the build; the smoke test reads it from
  the You tab (.youbuild): keep it reachable and update that test's navigation if it moves to Help & about.
- Existing element ids (#you-privacy, #you-modules, #you-plan, #you-ai, #you-account, #you-appearance, ...) keep
  their ids on their new pages; every place that scrolls or deep-links to one (pendingFocus, coach marks, toasts,
  "open in You" links, e2e helpers) must open the right page first. Find them all.
- Tests: update e2e helpers so existing specs reach each card through the menu; add specs for the menu (each row
  opens its page, back returns focus to the row, deep link by hash, browser back), and axe for the menu and each
  page in light and dark.

## Report back
Commits; verification table per task (lint, app unit, backend tests, backend `npm run smoke:all`, build stamp
once, e2e, axe); the list of every "You → ..." sentence and where it now leads; any sentence changed, verbatim;
deviations; screenshots (2x, 390x844) in
/tmp/claude-0/-home-user/dd34ad26-25bd-5d87-8174-4dbbc0f7e686/scratchpad/shots14/ : Home with the Ask Solia card
in each state (Pro on, not Pro, coming soon), Home with the AI write-up card, the header with the Shop pill and
plan badge at 320px and 390px, the "+" sheet with Shop, the You menu, and each of the six pages; plus the You menu
in Aura and in dark. Before/after of You (full page) side by side. Delete any temporary spec; leave no untracked files.
