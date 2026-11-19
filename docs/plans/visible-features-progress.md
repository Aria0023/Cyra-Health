# Progress: visible features (docs/plans/visible-features.md)

Branch `feature/visible-features`, worktree `/home/user/cyra-visible`. Resume from here after a restart.

## Task 1: AI on Home — DONE (final commit "Home: Ask Solia card; AI suggestions where she already looks")
- `lib/aiFeatures.js`: `askCard()` (state: soon | guest | plans | ask) and `ASK_COPY`; unit tests in
  `aiFeatures.test.mjs` (+3).
- `components/ai/AiParts.jsx`: `AskSoliaCard`, `WriteUpHomeCard`; `ChatCard` and `EvidenceCard` take `seed` /
  `onSeeded` (the question typed into their own box, never sent). App.jsx: `askSeed` (UI only), `askCardOff`
  (device-only, not in backups: `lib/record.js`), `askNow` / `askTo` / `openYouAi` before `homeView`.
- Home: the card sits after the hero, before Getting started; the write-up card under Today's insight. Patterns: the
  write-up card leads the page once she has one (`aiWriteUpFirst`). You: "Home cards" switch (moves into App settings
  in Task 3); `#you-ai` is focusable so the card's link can land on it.
- Dev gallery shows every state of the card (the "plans" state has no e2e build: both builds are proDev).
- Decisions: (1) with Pro and the chat switch off the card still offers "Ask with evidence" (it has no switch) beside
  "Chat about your log is off. Turn on in You → Solia Health's AI"; (2) the card never makes a request, so "Coming
  soon" for a server whose AI isn't set up shows only once another card's check has said so in this session;
  (3) no free-week wording on the card (the brief allows it only where the gate is on; the plans button is the plan
  card's own "See Pro plans" / "See what Pro adds").
- Tests: `e2e/ask-solia.spec.mjs` (4), `e2e/ask-solia-axe.spec.mjs` (4); `e2e/lib/api.mjs` answers `/api/ai/chat` and
  `/api/ai/weekly` when a spec sets them.
- Verified 2026-11-19 (full runs, after the last change to this task's files): lint 0 errors (23 warnings); app unit
  704/704; backend 119/119; smoke:all passed (exit 0); build stamp once; e2e 80/80; axe 54/54.

## Task 2: Shop entry points — DONE (final commit "Shop: header button and + menu row")
- Ported from origin/feature/shop-findable-visuals (084da80; 6bb6317 is that branch's tip) ONLY: the labelled "Shop"
  pill (`.shoppill`, App.jsx header), the "+" sheet row (`LogSheet` `onShop`), the one-time coach mark (`ShopCoach`,
  `shopHint.coach`, device-only). NOT ported: Home shop card, `shopArt`, the "Illustration" tag, the You card's move.
- Header: at 390px two rows (brand, name, plan badge / palette, Shop, settings); under 375px the name chip is not
  drawn (unless it says "sharing counts ✓"), so 320px is two rows too (brand, plan badge / palette, Shop, settings).
- Tests: `e2e/shop.spec.mjs` +5 (the + row, the hint x2, header fit at 320 and 390 in all nine styles: no overlap,
  nothing outside the viewport, 44px targets); `e2e/shop-axe.spec.mjs` audits Home with the hint, the + sheet, and the
  header in every style. `e2e/lib/nav.mjs` `setStyle()`.
- Verified 2026-11-19 (full runs, after the last change to app or test files): lint 0 errors (23 warnings); app unit 704/704; backend
  119/119; smoke:all passed (exit 0); build stamp once; e2e 85/85; axe 54/54.
## Task 3: You as a short menu — TODO
