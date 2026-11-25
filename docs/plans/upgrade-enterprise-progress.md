# Progress: upgrade entry and the enterprise panel (docs/plans/upgrade-enterprise.md)

Branch `feature/upgrade-enterprise`, worktree `/home/user/cyra-enterprise` (base main d227a3a + the plan commit 9b27f6e).
"Before" worktree of d227a3a at `/home/user/cyra-before` (temporary, removed after the eval). Resume from here after a restart.

## Task 1: one clear way to Pro — DONE (final commit "Upgrade: one clear way to Pro")
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
- Verified 2026-11-25 on the Task 1 tree (WIP 876f677, a clean worktree, full runs):

  | Check | Result |
  | --- | --- |
  | `npm run lint` | 0 errors, 24 warnings (the same 24 as d227a3a) |
  | `npm run test:unit` | 723/723 (722 + 1) |
  | `cd backend && npm test` | 130/130 |
  | `cd backend && npm run smoke:all` | exit 0 |
  | `npm run build` | ok; "BUILD 2026.10.07-D" once in dist |
  | e2e (`--project app`) | 108/108 (105 + 3) |
  | axe (`--project axe`) | 68/68 (66 + 2) |
