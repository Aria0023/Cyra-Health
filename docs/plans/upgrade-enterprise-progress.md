# Progress: upgrade entry and the enterprise panel (docs/plans/upgrade-enterprise.md)

Branch `feature/upgrade-enterprise`, worktree `/home/user/cyra-enterprise` (base main d227a3a + the plan commit 9b27f6e).
"Before" worktree of d227a3a at `/home/user/cyra-before` (temporary, removed after the eval). Resume from here after a restart.

## Task 1: one clear way to Pro — IN PROGRESS
- You (menu, `screens/YouScreen.jsx`): `#you-upgrade`, a filled primary button "Upgrade to Pro" between the stage card and
  the seven rows, only while she does not own Pro (`lib/youMenu.js upgradeShown`; a guest sees it too). It calls the same
  `onPro` as Plan & account's "See plans" → the existing Pro sheet (on the web: tiles, "Get Solia Health Pro in the app",
  no buy button). No new explanatory line, so no bold lead-in was needed.
- "See Pro" where a locked part said Pro with no way to it: Home's Ask Solia card, guest state (`AiParts.jsx`, ASK_COPY.seePro,
  beside "Create account"); the signed-in account card when the backup needs Pro (`AccountParts.jsx`, `account.seePro`).
  Already had a way (unchanged): Ask with evidence locked ("See what Pro adds"), You → Solia Health's AI locked, the
  weekly review's own experiment, the not-signed-in account card, Ask Solia "plans" state.
- New user-facing text, verbatim: "Upgrade to Pro", "See Pro".
- Tests: unit `youMenu.test` +1 (upgradeShown, copy, placement) and the card-id test's INNER list gains "you-upgrade" (a
  menu control like "you-row"); e2e `upgrade.spec.mjs` (3), `upgrade-axe.spec.mjs` (2: nine styles light and dark + the
  sheet in Soft and Aura).
