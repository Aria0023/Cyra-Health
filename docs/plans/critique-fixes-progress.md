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
