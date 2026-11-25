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
