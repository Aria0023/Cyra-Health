# Progress: critique fixes (docs/plans/critique-fixes.md)

Branch `feature/critique-fixes`, worktree `/home/user/cyra-critique` ("before" worktree of main 1628653 at
`/home/user/cyra-before`, removed after the eval). Resume from here after a restart.

Lint baseline on this machine: 0 errors, 25 warnings on main 1628653 too (the brief says 23); the same 25 warnings after
each task (compared line by line).

## Task 1: one plan message, a simpler header — DONE (final commit "Header and Home: one plan message, fewer chips")
- Header (`App.jsx` `.mast`): brand, plan badge, Shop, Check-in settings. Removed: the name chip (`.acctchip`, and with it
  " · sharing counts ✓": the counts switch on You → Privacy & your data already says "✓ On"), the palette button and its
  sheet. The stage palette is now an inline group in You → App settings (`components/PalettePicker.jsx`, was
  `PaletteSheet.jsx`; `#you-palette`, same `palIdx`). No guide tip, coach mark or deep link pointed at the palette.
- One row at 390px and 320px in all nine styles: the badge renders on two short lines (`lib/planBadge.js` `badgeLines`:
  "Free week ·" / "7 days left"); under 375px the Shop pill shows its bag only (name "Shop" kept, visually-hidden span) and
  the wordmark steps down to 19px. Measured: 390px brand 16–131, badge 159–240, Shop 244–326, settings 330–374;
  320px brand 16–120, badge 127–208, Shop 212–256, settings 260–304 (all tops 18px).
- Badge names: "Free week · N days left. Open plans.", "Free week · last day. Open plans.", "Free week over. Open plans.",
  "Pro. Open plans.", "Free. Open plans.", and the guest's now "Guest, no account yet. Open plans.".
- Home: removed the free-week bar (`trialbar` with `trialLine`) and the "Pro · 7-day free trial" note (`proChip`); the
  record key `proChip` stays (loads, never written). `trialLine` still feeds You → Plan & account's plan card. Kept: the
  "Your free week is over" sheet, the plan card, the Pro sheet, and the guest line, which now shows only in the guest
  window's last 12 hours (`lib/guest.js` `guestNear`, `GUEST_NEAR_HOURS = 12`).
- Tests changed (brief changed the behaviour they pin): `trial.spec` (badge instead of the bar), `plans.spec` (the two Home
  Pro-note tests → one "Home has no Pro note: the badge opens the plans"), `plans-axe` (audits Home with the badge),
  `shop.spec` header fit (one row, the four controls by name; under 375px the Shop label is visually hidden),
  `guest.spec` / `guest-axe` (Home's line appears at hour 40, not at once; the badge says "Guest");
  unit: `planBadge.test` (+2: guest name, `badgeLines`; the "every badge" test now checks prefix/suffix),
  `plans.test` (Pro-note helpers removed → one test that the stored day still reads back).
- Docs: PRIVACY-AUDIT (two rows + new section "Critique fixes"), CYRA-BUILD-SPEC (header paragraphs), MONETIZATION.
- Verified 2026-11-25 on the Task 1 tree (full runs, after the last change to this task's files): lint 0 errors (25 warnings,
  identical to main); app unit 720/720; backend 130/130; smoke:all exit 0; build stamp once in dist; e2e 94/94 (95 before:
  the two Home Pro-note tests became one); axe 60/60.

## Task 2: Home has one first job — DONE (final commit "Home: Quick log first; the rest folds")
- Order (`screens/HomeScreen.jsx`): guest line (last 12 h only), hero (ring, next-period row, Learn link, TTC line, today's
  line), Quick log, POTS today and Today's auto-tracked (when they apply: they are logging cards, so they sit right under
  Quick log), Getting started / Today's small step, Ask Solia, Body and Mind rails, Today's insight, AI write-up, the install
  tip (web, one-time; kept visible), then the "More for today" disclosure (`#home-more`): devices card, patterns preview,
  wearable cards, milestones, Coming up, pulse, the five section doors and their panels. Nothing removed.
- `homeMore` record key (device-only, not in backups; `lib/record.js` + tests). A section panel that turns on while the
  group is folded opens the group (effect in HomeScreen); scrolling to a panel waits a frame so the group is open first.
- Ring with no period start (`lib/home.js` heroModel kind "start"): center "No cycle yet", sub the date small
  ("November 25"); the existing row "Log a period start to see your cycle day" is the action.
- Sign-up estimate (`HERO_COPY`): note2 "It sharpens as you log your periods." plus, where `SOURCES_HERE`, "A watch or ring
  adds temperature, which often rises after ovulation." DEVIATION: the brief's "a connected watch or ring's temperature
  helps" would be untrue of the prediction (it uses period starts only; lib/signals.js says a rise "can't predict next
  month"), so the sentence says what the source adds, not that it improves the estimate.
- TTC: "Solia Health is not a contraceptive." (SIGNAL_COPY.ttc, the existing sentence) under Home's ring/fertile row,
  under the Calendar legend (`.calnotcontra`), and in the empty fertility summary (the logged state already ends "Not
  contraception.").
- Tests: new `e2e/home-order.spec.mjs` (5), new `e2e/critique-axe.spec.mjs` (header + Home folded/open, nine styles, light
  and dark); `e2e/lib/nav.mjs` `openHomeMore`; specs that reach a folded card now open the group first: `auto.spec`,
  `axe.spec`, `devices.spec`, `devices-axe.spec`. Unit: `home.test` +1, `record.test` lists + `homeMore`.
- Docs: CYRA-BUILD-SPEC (Home order), PRIVACY-AUDIT, CLINICIAN-REVIEW (three new entries).
- Tests changed after the first full run (the brief moved what they pinned): `ask-solia.spec` (the card now follows Quick
  log, not precedes it), `auto.spec` S2 (Today's auto-tracked now sits right under Quick log, not above it; title
  changed) and S3 (opens "More for today" before the Wearables door), `devices.spec` / `devices-axe.spec` (open the group
  before the Home devices card in the two API-build tests missed at first).
- Verified 2026-11-25 on the Task 2 tree: lint 0 errors (25 warnings, same as main); app unit 721/721; backend 130/130;
  smoke:all exit 0; build stamp once in dist; e2e full run 95 passed + 4 failed (the four specs above), then those three
  spec files re-run in full after the fix: 13/13 → 99/99 in all; axe full run 60 passed + 2 failed (devices-axe, the
  same missed card), then devices-axe re-run: 2/2 → 62/62.

## Task 3: privacy defaults — DONE (final commit "Privacy defaults: shop tap count off unless she turns it on; calories hidden by default")
- Shop taps opt-in: `lib/shopTaps.js` `tapsOn({ live, on })` / `sendShopTap(..., { on })`; new record key `shopTapsOn`
  (device-only, not in backup; `shopTapsOff` kept loadable, unread). `lib/privacyFlows.js` row state from `shopTapsOn`.
  Shop footer (`components/Shop.jsx`, `.shoptapask`): "Help Solia Health see which products people open?" + switch
  "Count my taps anonymously", only where a tap can be sent (SHOP_LIVE). DEVIATION: nobody's earlier "on" carries over
  (the old key could not record an explicit on), so it is off for every existing user.
- Calories: `aiPrefs.showCal` (only when true); App/YouScreen/Meals sheet read it; answer line `MEAL_COPY.calHidden`.
- Photo pick: two buttons/inputs (`data-pick="camera"` with capture="environment", `data-pick="library"` without).
- Copy changed: see PRIVACY-AUDIT "Task 3" (every sentence old → new); CLINICIAN-REVIEW answered ("hidden by default, owner
  decision 2026-11-25; clinician to confirm") + `mealphotos.calHidden`, `mealphotos.pick`; Info.plist; STORE-SETUP.
- Tests changed: unit `shopTaps.test` (opt-in lines), `privacyFlows.test` (default state off), `record.test` (+shopTapsOn);
  e2e `shop-taps.spec` (off by default, footer switch turns it on, then the old checks), `shop-taps-axe` (+footer offer),
  `meal-photos.spec` (calories turned on where the test reads ranges; camera/library inputs; "Take a new photo"; new test
  "calorie estimates are hidden by default"), `meal-photos-axe` (hidden first, then shown).
- Also changed after the first full run: `shop-live.spec` "an invalid catalog falls back" (its footer check assumed taps on
  by default; now the footer says nothing is sent and offers the switch, off).
- Verified 2026-11-25 on the Task 3 tree: lint 0 errors (25 warnings, same as main); app unit 721/721; backend 130/130;
  smoke:all exit 0; build stamp once in dist; e2e full run 99 passed + 1 failed (shop-live, above), then shop-live re-run
  in full: 2/2 → 100/100; axe full run 62/62.

## Task 4: shorter visible copy — DONE (final commit "Copy: one plain line visible, the full text under Details")
Each block: its new visible line, and the full text, word for word, under the app's Details disclosure (components/Details.jsx,
labelled "Details" unless noted). Nothing deleted; the legal pages are unchanged by this task.

| Block | New visible line | Full text under Details |
| --- | --- | --- |
| Meal photo "What Solia Health will send": intro + "What goes with it" (`MealPhoto.jsx`, `MEAL_COPY.sheetShort`) | "Only this photo[, with your sign-in so it counts toward this month,] goes through Solia Health's server to Anthropic, which keeps it for a limited time; nothing from your log goes, and Solia Health's server doesn't keep it." (the bracket only when signed in) | `sheetLead`, then "What goes with it" with its list (`withNothing`, `withSignin` when signed in) |
| Feedback sheet, preview foot (`Feedback.jsx`, `FEEDBACK_COPY.footShortAnon` / `footShortReply`) | "Nothing else goes: nothing from your log and no sign-in, and Solia Health's team keeps it for 365 days." / with reply on: "Nothing else from your log goes; it's sent with your sign-in, linked to your account, and kept for 365 days or until you delete your account." | `previewFootAnon` or `previewFootReply`, and `kept` |
| AI send sheets' intro, chat / write-up / evidence (`AiParts.jsx` AiSendSheet, `AI_COPY.sheetShort`) | "Only the text below goes, through Solia Health's server, to Anthropic, which keeps it for a limited time; Solia Health's server doesn't keep it." | `sheetLead` |
| You → Privacy & your data → How this works, rows with more than two sentences (`PrivacyFlows.jsx`, `FLOW_COPY.short`): Solia Health's weekly write-up | "When you ask for one, a summary of your last 8 weeks (no dates, notes or name) goes through Solia Health's server to Anthropic, which keeps it for a limited time." | the row's full line first (`FLOW_COPY.lines.aiWeekly`), then its existing Details list |
| … Chat about your log | "Each message you send, with your last few chat messages and the same summary, goes through Solia Health's server to Anthropic, which keeps it for a limited time." | `FLOW_COPY.lines.aiChat`, then the existing list |
| … Meal photos | "Each photo you choose to send, with nothing from your log, goes through Solia Health's server to Anthropic, which keeps it for a limited time." | `FLOW_COPY.lines.aiMeals`, then the existing list |
| … Feedback you send | "Only when you press Send: your message, the app's version, platform and language, and your email only if you allow a reply, go to Solia Health's server, which keeps them for 365 days." | `FEEDBACK_COPY.flowLine`, then the existing list |
| Sign-in "What signing in shares" (`SignInStep.jsx`, `SIGNIN_COPY.sharedShort`) | "Signing in gives Solia Health's server an account (how you signed in, and your email or name), kept until you delete it, and never your health log." | the seven `shared` items, under the existing "What signing in shares" (already a Details; the new line sits above it) |
| Shop footer privacy text (`Shop.jsx`, `SHOP_PAGE_COPY.footShort`) | taps off: "Matched on this device; nothing about you is sent." / taps on: "Matched on this device and nothing you log is sent; opening a product counts one anonymous tap, kept only as a daily total." | `footMatched`, `footList` (live catalog), `TAP_COPY.foot` (taps on), `SHOP_COPY.privacy`. Kept visible: the heading, the tap switch offer and "Not medical advice…" (not privacy text) |
- Tests: new `e2e/short-copy.spec.mjs` (2: each block's visible line, its Details closed, the full text inside and shown
  when opened; every privacy row line has at most two sentences); `e2e/critique-axe.spec.mjs` +2 (Shop footer closed and
  open, privacy rows, feedback foot; light and dark).
- Verified 2026-11-25 on the Task 4 tree (full runs, after the last change to this task's files): lint 0 errors (25
  warnings, same as main); app unit 721/721; backend 130/130; smoke:all exit 0; build stamp once in dist; e2e 102/102;
  axe 64/64.

## Task 5: one free clock — DONE (final commit "Trial: she sees one free week")
The story she sees: "7 days free" (the free week, counted from registration, lib/trial.js). The 48-hour guest window
(lib/guest.js) still works underneath; no sentence counts it in hours or days any more, and its deadline (a day and a
time) shows only in its last 12 hours (`guestNear`). The store's 7-day trial on yearly is separate and starts at purchase,
so it is described on the yearly tile only, as "7-day free trial on yearly, starts when you subscribe".

Every user-facing mention of a free period, hours, days or a trial (src, after this task):
| Where | Text now | Was |
| --- | --- | --- |
| Header plan badge (`lib/planBadge.js`) | "Free week · N days left" / "Free week · last day" / "Free week over" / "Guest" / "Free" / "Pro" | unchanged (Task 1 made it the one place) |
| You → Plan & account, plan line (`lib/trial.js trialLine`) | "Free week: N days left. Subscribe any time to keep saving after that." / "Free week: last day. Subscribe to keep saving." / "Your free week is over. Subscribe to keep logging." | unchanged |
| "Your free week is over" sheet, blocked toast (`TRIAL_COPY`) | unchanged | unchanged |
| Pro sheet and plan card, free part (`ProSheet.jsx FREE_KEEPS_TRIAL`, `PRO_LOG`; `about.js bodyTrial`) | "Your first 7 days include everything. After that…" / "Keep logging after your free week" | unchanged |
| Help answer "How does the free week work?" (`lib/feedback.js`) | "Your first 7 days include everything. After that, saving new entries needs Pro." (gate) / "This version has no free-week limit… the first 7 days include everything…" | unchanged |
| Yearly plan tile badge (`lib/plans.js trialBadge`; locale `pro.freeTrialDays`) | "7-day free trial on yearly, starts when you subscribe" | "7-day free trial" |
| Pro sheet line above the tiles (`plans.js proTrialLine`) | REMOVED (the tile says it) | "Try Pro free for 7 days on the yearly plan, then $100 a year in the iPhone and Android apps. Cancel any time." |
| Web price line (`lib/pricing.js WEB_PRICE_LINE`) | "Pro is $9.95 a month or $100 a year in the iPhone and Android apps." | "…, with a 7-day free trial on the yearly plan." |
| Store purchase button and terms under it (`pricing.js planLines`, phones only) | "Start 7-day free trial" / "Free for 7 days, then … Cancel at least a day before the trial ends and you won't be charged." | KEPT (App Store 3.1.2 requires the trial terms at the point of purchase; they describe the store trial, which starts at purchase) |
| Promotion banner price line (`lib/promos.js`, only with a partner promotion whose store offer has a trial) | "Yearly: … · N-day free trial" | KEPT (the store's own offer; see deviations) |
| Sign-in step, "Try it first" (`GUEST_COPY.tryWhy`) | "Or try Solia Health first as a guest, before you make an account. What you log is saved on this device, and Solia Health's server holds no account for you." | "Or try Solia Health as a guest for 2 days before you make an account. …" |
| Guest story (sign-in step, You → Plan & account) (`guestStory`) | gate: "7 days free, then Pro if you want to keep logging. Create your account to keep your free week going." / no gate: "Create your free account to keep going." | "2 days as a guest, 7 days free in all, then Pro if you want to keep logging." / "2 days as a guest, then a free account to keep going." |
| Home guest line, last 12 hours only (`GUEST_COPY.line`) | "You're trying Solia Health as a guest. Create your account by {Wednesday, 10:00 AM} to keep your free week going." (no gate: "…to keep going.") | "…Create an account by {when} to keep going." + the story, shown from the first day |
| You → Plan & account guest card (`GUEST_COPY.youLine`) | "You're trying Solia Health as a guest. Solia Health's server holds…"; in the last 12 hours "…as a guest until {when}. …" | always "…as a guest until {when}. …" |
| Screen after the guest window (`GUEST_COPY.gateTitle`) | "Create your account to keep going" | "Your 2 guest days are up" |
| Restore note (`disclosures.js GUEST_RESTORE_LINE`) | "…a restore doesn't restart or extend your guest time…" | unchanged (no count) |
Not user-facing or legal (unchanged): code comments; `public/legal/privacy.html` "(48 hours as of this draft)" and
`terms.html` (still true: the window exists; legal pages are for attorney review).
- Tests: unit `guest.test` (story, gate title and line expectations; +1 test "one free clock"), `plans.test` (tile badge
  lines; the three `proTrialLine` lines removed with the function); e2e `guest.spec` (the sign-in step's words, the You
  card without a deadline until the last 12 hours, the gate heading "Create your account to keep going", Home's line
  without the story), `guest-axe` (gate heading); new `e2e/one-clock.spec.mjs` (1).
- Also changed after the first full run: `plans.spec` "the web: You → Plan shows Yearly…" and `axe.spec` (both Pro sheet
  tests) expected the removed `.protrialline`; they now check it is absent.
- Verified 2026-11-25 on the Task 5 tree: lint 0 errors (25 warnings, same as main); app unit 722/722; backend 130/130;
  smoke:all exit 0; build stamp once in dist; e2e full run 102 passed + 1 failed (plans.spec), then plans.spec re-run in
  full: 2/2 → 103/103; axe full run 62 passed + 1 failed + 1 not run (axe.spec is serial), then axe.spec re-run in full
  twice (the second web Pro sheet test also needed its line changed): 7/7 → 64/64.

## Task 6: check-in faces and stage illustrations — DONE (final commit "Check-in faces and stage illustrations")
- Quick check-in (`components/QuickCheckin.jsx`): every 4-step answer gets a face over its word, drawn by the existing
  Mind `MoodFace` (inline SVG, 24-unit grid, currentColor, aria-hidden), from a small smile (answer 0: "No / fine",
  "Slept well", "Sharp", "Steady") to a frown with brows (answer 3). The word is always shown; a picked answer also
  shows a tick before its word. Same values (0-3), same storage, same order; the button's name is still the word.
- Mind check-in mood (`MindTodayScreen.jsx`): it already had a face per option with the word under it; the picked one now
  also carries a tick, so the choice never rests on colour alone.
- Stage illustrations (`components/StageArt.jsx`): cycle = moon phases on an arc; trying to conceive = seeds opening
  along a curve; pregnancy = a seed held in nested rings; perimenopause = waves of changing height; menopause and
  beyond = a full moon and a resting leaf. Only `var(--primary)`, `var(--accent)`, `var(--card)` and color-mix tints of
  them; aria-hidden; no faces of people, no products. Shown on each registration stage card (small, `.stagecard.hasart`),
  on the You menu's stage card (bottom right, replacing the shared rings drawing) and on You → Your profile's stage card.
- Tests: new `e2e/faces-art.spec.mjs` (2); `e2e/critique-axe.spec.mjs` +2 (registration stage cards; in all nine styles,
  light and dark: the You stage card, Your profile, the quick check-in with a picked face, the Mind mood picked).
- Lint: 24 warnings from here (the old `YouScreen` "'stage' is defined but never used" warning went away: the art uses it).
