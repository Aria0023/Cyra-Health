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
