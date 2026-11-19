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
## Task 3: You as a short menu — DONE (final commit "You: a short menu of six pages")
- `lib/youMenu.js` (pages, `SECTION_PAGE`: card id → page, `YOU_COPY`) + `youMenu.test.mjs`; `lib/routes.js` SUBPAGES
  `youprofile | youprivacy | youai | youplan | youdevices | youapp | youhelp` (hashes `#/you/profile|privacy|ai|plan|
  devices|settings|help`); `viewForTab("you")` is always the menu.
- `screens/YouScreen.jsx`: every card is a const written in the long page's order with its lines unchanged (so
  feature/meal-photos' edits to the AI card and the Modules row merge without conflict in this file); the menu and the
  pages only place them. New: `#you-stage` (profile), `#you-ai-link` (privacy), `#you-voice` (app settings).
- App.jsx: `openYouSection(id)` opens the page that holds a card and focuses it; the header's sliders button on You
  opens Devices & reminders at `#you-checkins`; Home's "Turn on in You → Solia Health's AI" opens the AI page;
  Getting started's backup step opens Privacy & your data; `promoMoment` follows the Plan & account page. History:
  opening a page pushes `#/you/<slug>`; the "You" link and the browser's Back return to the menu with focus on the row;
  page to page replaces the entry; leaving by a tab clears the hash; a deep link opens the page at launch or on
  hashchange.
- **Solia Health's AI keeps its own row** (third), so seven rows: the six pages of the brief plus the AI. Privacy &
  your data is second and links to the AI page.
- Where the brief's list was silent: Share with a partner → Your profile; Learn and the Shop entry card → Help &
  about; anonymous weekly counts → Privacy & your data.
- Two taps: You → Plan & account → "Restore purchases"; You → Plan & account → "Delete account" (then its confirm,
  as before). e2e/store-checks.spec.mjs passes with only its navigation helper changed.
- Build stamp: on Help & about (`.youbuild`), once in the bundle; e2e/smoke.spec.mjs navigates there.
- e2e: `e2e/lib/nav.mjs` `gotoYou(page, title)`, `YOU_PAGES`, `setStyle` (via App settings); every spec that used a
  You card now opens its page first. New: `e2e/you-menu.spec.mjs` (7), `e2e/you-menu-axe.spec.mjs` (4).

### Every "You → …" sentence the app shows, and where it leads now
| Sentence (where) | Leads to |
| --- | --- |
| "Turn it on or off in You → Solia Health's AI. …" (privacy list, lib/privacyFlows.js) | KEPT. You → row "Solia Health's AI" |
| "Turn on in You → Solia Health's AI" (Home's Ask Solia card) | KEPT. Opens that page |
| "You can turn this off in You → Privacy & your data." (Shop, lib/shopTaps.js) | KEPT. You → row "Privacy & your data" |
| "Save an encrypted backup now and then in You → Privacy & your data, …" (Help answer) | KEPT |
| "(You → Privacy & your data → "Count my shop taps anonymously")" (public/legal/privacy.html) | KEPT |
| "…or delete it in You → Account." (privacy list, cloud backup) | CHANGED → "You → Plan & account" |
| "Sign out or delete the account in You → Account." (privacy list, account row) | CHANGED → "You → Plan & account" |
| "Sign out or delete your account any time in You → Account." (sign-in disclosure, lib/signin.js) | CHANGED → "You → Plan & account" |
| "…sign in again the same way and delete it in You → Account" (after Delete everything, DataControls.jsx) | CHANGED → "You → Plan & account" |
| "(You → Account, or Delete everything)" and "(You → Account)" (public/legal/privacy.html) | CHANGED → "You → Plan &amp; account" |
| "Only when you press Send in You → Help: …" (privacy list, lib/feedback.js) | CHANGED → "You → Help & about" |
| "If you send feedback from You → Help with "It's OK to reply to me" on, …" (lib/disclosures.js) | CHANGED → "You → Help & about" |
| "(only when you press Send in You → Help)" (public/legal/privacy.html) | CHANGED → "You → Help &amp; about" |
| "Open You → Data sources and connect Apple Health …" / "… from You → Data sources, where the list offers it" (Help answers) | CHANGED → "You → Devices & reminders" |
| "… is paused — resume it in You → Data sources to sync again." (toast) | CHANGED → "You → Devices & reminders" |
| "Hidden. Connect a device any time from You → Data sources." (toast) | CHANGED → "You → Devices & reminders" |
| "Getting started is hidden. You can bring it back from You." (toast) | CHANGED → "…in You → App settings." |
| "Ask Solia is hidden. You can bring it back from You." (toast, Task 1) | CHANGED → "…in You → App settings." |
| "Hidden for today. You can create your account any time in You." (toast, guest) | CHANGED → "…in You → Plan & account." |
| "Open You and choose Encrypted backup …" + button "Open You" (Getting started) | CHANGED → "Open You → Privacy & your data and choose …" + "Open Privacy & your data" |
| "…and you can change it in You." (PCOS question at registration) | KEPT (true: You → Your profile → Modules) |
| "Your settings, your plan, backups, privacy choices and Delete everything are all here." (tip on You) | KEPT (true of the menu's pages) |
| Portal: "What people sent from the app's You → Help" (launch.js); "The support address shown in You → Help." (readiness.js) | CHANGED → "You → Help & about" |
| docs/STORE-SETUP.md: "You → Account" x3, "You → Your plan" x2 | CHANGED → "You → Plan & account" |
| Older docs (PRIVACY-AUDIT history, ARCHITECTURE, MONETIZATION, PASSIVE-TRACKING-PLAN, earlier plans): "You → Account / Data sources / Modules / Cyra's AI / Help / Learn" | KEPT as history; docs/CYRA-BUILD-SPEC.md §3.5e now says which page holds each card |
No sentence in src/ or public/legal uses "You ->" (ASCII); "You → Modules", "You → Appearance", "You → Plan" and
"You → Learn" appear only in code comments.

- Screenshots (2x): scratchpad `shots14/` (01–04 Task 1, 05–06 Task 2, 07–10 Task 3).
- Verified 2026-11-19 (full runs, after the last change to app or test files): lint 0 errors (23 warnings); app unit
  708/708; backend 119/119; smoke:all passed (exit 0); build stamp once; e2e 92/92; axe 58/58 (a first full axe run was 56 + 2 failed in partner-learn-axe, a spec that still looked for Share with a partner
  on Help & about; the spec was fixed and the whole axe suite run again: 58/58).
