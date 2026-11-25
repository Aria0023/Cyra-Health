# Eval: critique fixes, before and after (2026-11-25)

Before = `main` at 1628653 (a detached worktree). After = `feature/critique-fixes` at e1e3a14 (the six task commits).
Brief: docs/plans/critique-fixes.md. Progress, every changed sentence and the per-task verification:
docs/plans/critique-fixes-progress.md.

## 1. Each critique note → what changed → how it was checked → result

| Critique note | What changed | Checked by | Result |
| --- | --- | --- | --- |
| Plan/trial state said in several places at once | Header plan badge is the one plan message; Home's free-week bar and "Pro · 7-day free trial" chip removed; badge name says enough ("Free week · 7 days left. Open plans.", "Guest, no account yet. Open plans.") | `trial.spec` (badge text and name, no `.trialbar`), `plans.spec` "Home has no Pro note", `one-clock.spec`, unit `planBadge.test`; measurement 3 below | Pass. Plan mentions on Home's first screen 2 → 1 |
| Header crowded, wraps to two rows | Name chip and palette button removed (palette now in You → App settings; "sharing counts" state is the switch on Privacy & your data); badge on two short lines; under 375px Shop shows its bag, name "Shop" kept | `shop.spec` header fit at 320 and 390 in all nine styles (one row, four named controls, no overlap or clipping, 44px), `critique-axe` header+Home nine styles light/dark; screenshots 03, 04 | Pass. Rows 2 → 1 at 390 and 320; header 154 → 106 px tall |
| Home has no first job; Quick log far down | Order: hero, next-period row, Quick log, small step / Getting started, Ask Solia, rails, insight (+AI write-up), then one folded "More for today" (remembered on this device, `homeMore`) | `home-order.spec` (order, fold state across reloads, a panel opened while folded opens the group), updated `auto`/`ask-solia`/`devices` specs; measurements 1-2; screenshots 01-02 | Pass. Quick log y 1217 → 616 (My Cycle) and 1186 → 531 (Perimenopause): now inside the first screen |
| Ring shows the date like a cycle day when no period is known | Ring says "No cycle yet", the date small under it; the existing row is the action | `home-order.spec` "the ring with no period start…", unit `home.test`; screenshot 02 | Pass |
| Prediction from the sign-up answer sounds certain | Second line "It sharpens as you log your periods." + (builds with a source) "A watch or ring adds temperature, which often rises after ovulation." | unit `home.test`, `home-order.spec`; screenshot 01 | Pass, with a wording deviation (see 6) |
| TTC: not-for-contraception only in Learn | "Solia Health is not a contraceptive." on Home's ring/fertile row, beside the Calendar legend, in the empty fertility summary | `home-order.spec` TTC test | Pass |
| Shop tap count on by default | Opt-in for everyone (`shopTapsOn`); Shop footer offers the switch once; privacy row, footer, legal page, PRIVACY-AUDIT and portal note rewritten | `shop-taps.spec` (no tap until turned on, then exactly `{productId}`), `shop-live.spec`, `shop-taps-axe`, unit `shopTaps`/`privacyFlows`; screenshot 05 | Pass |
| Calorie figures shown by default | "Show calorie estimates" off unless she turns it on; the answer says how to show them; CLINICIAN-REVIEW answered | `meal-photos.spec` new test "hidden by default", `meal-photos-axe` | Pass |
| Meal photo: camera only | "Take a photo" (capture="environment") and "Choose a photo" (no capture) | `meal-photos.spec` input attributes, library path used for a send | Pass |
| Heavy privacy blocks | Seven blocks show one true sentence; the full text word for word under Details | `short-copy.spec` (2), `critique-axe` Task 4; measurements 6-7; screenshots 05-07 | Pass. Meal send sheet 156 → 102 visible words; feedback foot 66 → 20 |
| Two free clocks (48 h guest + 7-day week + store trial) | One story "7 days free"; guest copy names no hours; deadline only in the last 12 h; store trial on the yearly tile only | `guest.spec`, `guest-axe`, `one-clock.spec`, unit `guest.test`; measurement 8 | Pass. Free durations in src: hours 4 → 0, days 9 → 6 |
| Check-in answers are bare words | A face per answer (inline SVG, currentColor) over the word; a tick on the picked answer and mood | `faces-art.spec`, `critique-axe` Task 6 (nine styles, light/dark); screenshot 08 | Pass |
| No sense of place per life stage | One abstract illustration per stage from UI tokens, on registration cards and You's stage cards | `faces-art.spec`, `critique-axe` Task 6; screenshots 09-14 | Pass |

## 2. Measurements (390x844, light, Soft, deviceScaleFactor 1)

A temporary Playwright spec ran against each tree's own build with the e2e harness's flags minus the demo seed, so the
users were really fresh (`VITE_FEATURES=wearables,deviceSync,shop,signin,devGallery,proDev,trialGate`, demo wearables on,
no `VITE_DEMO_SEED`; clock 2026-11-25 09:00). "My Cycle" registered with a last period of Nov 10 (so the ring has a cycle
day and the estimate rests on the sign-up answer); "Perimenopause" with no period date. The meal sheet and feedback foot
ran in the API build (signed in by email against the mock). The spec was deleted afterwards.

| # | Measure | My Cycle before | My Cycle after | Perimenopause before | Perimenopause after |
| --- | --- | --- | --- | --- | --- |
| 1 | Home full-page height (px) | 2430 | 1769 | 2424 | 1683 |
| 2a | Quick log heading, y from top (px) | 1217 | 616 | 1186 | 531 |
| 2b | "+" button, y (px) / its first log action ("Symptoms") in the sheet, y (px) | 773 / 523 | 773 / 523 | 773 / 523 | 773 / 523 |
| 3 | Plan/trial mentions visible in Home's first 844 px (distinct elements) | 2: the badge "Free week · 7 days left" and the bar "Free week: 7 days left. Subscribe any time…" with "See plans" | 1: the badge | 2 (same) | 1: the badge |
| 4 | Header rows at 390 / 320 | 2 / 2 | 1 / 1 | 2 / 2 | 1 / 1 |
| 5 | Header controls | 4 (plan badge, Color palette, Shop, Check-in settings; plus the name chip, not a control) | 3 (plan badge, Shop, Check-in settings) | 4 | 3 |
| 6 | Visible words, meal photo send sheet (Details closed; whole dialog incl. title and buttons) | 156 | 102 | | |
| 7 | Visible words, feedback preview foot (Details closed) | 66 | 20 | | |
| 8 | User-facing "free" durations in src (string literals naming hours/days with free/guest/trial; tests, comments and the dev gallery excluded) | hours 4 (the guest-window strings built from `guestSpan(48)` → "2 days as a guest…", "…as a guest for 2 days…", "Your 2 guest days are up"), days 9 | hours 0, days 6 | | |

The ring centre read "25 November" for the Perimenopause user before and "No cycle yet November 25" after; My Cycle read
"Day 16 fertile phase" in both. The "+" sheet was already one tap from every screen; the brief's order change moved
Quick log, not the sheet, so 2b is unchanged by design.

Remaining durations after (8): "Your first 7 days include everything…" (free week), "7 days free, then Pro… keep your free
week going." (guest story, gate builds), the yearly tile "7-day free trial on yearly, starts when you subscribe", the
store purchase button "Start 7-day free trial" and its terms "Free for 7 days, then…", and "Free week: N days left…".

## 3. Axe

`e2e/critique-axe.spec.mjs` (committed) runs on every changed surface, 0 violations required (wcag2a, wcag2aa, wcag21a,
wcag21aa, best-practice):
- the header and Home, "More for today" folded and open, in all nine styles (Soft, Mono, Clear, Journal, Aura, Sky,
  Blush, Mint, Sunset), light and dark;
- the Shop footer (Details closed and open), the privacy rows, the feedback foot, light and dark;
- the registration stage cards, and in all nine styles the You stage card, Your profile, the quick check-in with a
  picked face and the Mind mood picked, light and dark.
Also changed surfaces covered by updated suites: `plans-axe` (Home with the badge), `guest-axe`, `meal-photos-axe`
(calories hidden first, then shown), `shop-taps-axe` (footer offer), `devices-axe`, `axe.spec` (Pro sheet without the
trial line). Last full axe run (Task 6 tree): 66/66 passed, 0 violations.

## 4. Screenshots (2x, 390x844)

`/tmp/claude-0/-home-user/dd34ad26-25bd-5d87-8174-4dbbc0f7e686/scratchpad/shots15/` (not committed): 01 Home My Cycle
before/after; 02 Home Perimenopause (no period) before/after; 03 header 390; 04 header 320; 05 Shop footer; 06 meal photo
send sheet; 07 feedback sheet (preview open); 08 quick check-in with faces; 09-10 registration stage cards (Soft, light and
dark); 11-14 the five stage illustrations in Soft and Aura, light and dark. Raw shots in `raw/`.

## 5. What this eval does not show

- No user test: the gradient styles' trial and the order of Home were not tried with people.
- Native builds (camera vs library picker on iOS/Android, the store's trial terms) were not run on a device.
- Measurement 8 is a static count of string literals with a stated rule; strings built at run time from other words
  could escape it.

## 6. Deviations from the brief (kept the rule, did the closest truthful thing)

- Prediction line: "a connected watch or ring's temperature helps" would be untrue (the prediction uses period starts
  only); the line says "A watch or ring adds temperature, which often rises after ovulation."
- Shop taps: an "explicit earlier on" cannot be told from the old default (the old key only recorded "off"), so the count
  is off for every existing user until she turns it on.
- Store trial: the purchase button "Start 7-day free trial" and the terms under it stay (App Store 3.1.2 needs them where
  she buys); the partner promotion banner keeps its store offer's "· N-day free trial". Everywhere else the store trial is
  on the yearly tile only.
- Install tip (web, one-time) stays visible after Today's insight rather than inside "More for today"; POTS today and
  Today's auto-tracked sit right under Quick log (logging cards), not in the fold.
