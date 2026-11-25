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

## Task 2: owner settings — DONE (final commit "Owner settings: change the app without a code change")
- Backend `settings` module (`backend/src/modules/settings/index.js`; production and dev configs, PRODUCTION_MODULES,
  prod-smoke, readiness's module list; app `FEATURE_ALSO.shop` so the default build's modules still mirror the backend):
  public `GET /api/app-config`; owner-only (`ctx.portal.auth("owner")`, ADMIN_EMAILS) `GET /api/settings`,
  `PUT /api/settings`, `GET /api/settings/log`. Change log `app_settings_log` { at, by, field, from, to } (1000 kept) and
  the portal's Activity log. Every field checked on the server (`cleanSettings`); unknown fields 400.
- App: `src/lib/appConfigBoot.js` (read first in `main.jsx`; no imports) → `globalThis.__soliaAppConfig` →
  `src/lib/features.js` `FEATURES = withRemoteOff(BUILD_FEATURES, featuresOff)` (REMOTE_OFF: ai, shop, wearables,
  webReminders, counts; never on). `src/lib/appConfig.js` (pure cleaner, `keepAppConfig`), `src/lib/appConfigLive.js` (the
  GET). App.jsx: `appCfg` state (kept copy, then the download), announcement → HomeScreen `.homeannounce`, Help lines →
  HelpCard `.helpextra`, prices → `webTiles(refs)` / `webPriceLine(refs)` on the Pro sheet, the plan card and the web price
  line; default style / palette for a person who hasn't registered or picked one yet. Delete everything removes the copy.
- Portal: `backend/public/portal/settings.js`, nav "App settings" (owner), route `#/settings`.
- DEVIATION: a feature the owner turns off is off from the next start after the app downloaded the change (not at once):
  many module-level constants read the build's features when the app loads, and the copy is applied before that. The
  portal says so. The other settings apply as soon as the download answers.
- DEVIATION: the device copy is in localStorage (not the record): it must be readable synchronously before any module reads
  the features. It is app settings only (the same for everyone).
- Portal sentences (owner-facing), verbatim: "Change parts of the app without a code change. The app downloads these
  settings when it starts, with a request that carries nothing about the person using it." · "Last changed {when} by
  {email}." / "Nothing has been changed yet: the app uses its built-in settings." · "Not editable here" with: "Privacy
  claims: what is stored, sent or kept, anywhere in the app", "Legal text: the Terms, the Privacy Policy and the consent
  step", "Clinical and safety text: "Solia Health is not a contraceptive", crisis lines, urgent-care advice and medical
  disclaimers", "The sign-in order: Sign in with Apple stays first", "The free trial's length: it is set in App Store Connect
  and Play Console", "Turning on a feature the build doesn't offer, and the shop tap count (it stays off until she turns it
  on)", "These stay in the code, where they are reviewed before each release." · Features: "Turn off a feature this build
  of the app offers. You can't turn on one the build doesn't offer. It is off from the next time each person opens the app
  after it has downloaded these settings. Sign-in, the phone's own health sources and the encrypted backup can't be turned
  off here, so nobody is cut off from her account or her backup." · "Turn off {Solia Health's AI | Shop by need | Oura,
  Fitbit, Garmin and Whoop | Reminders in a browser | Anonymous weekly counts}" · Defaults: "What someone starts with before
  she picks her own. Nobody's own choice is changed." · Announcement: "One line of plain text at the top of Home, at most
  140 characters. Off by default." "Show it on Home" · Help: "Up to 3 lines of plain text under the answers on You → Help &
  about, each at most 240 characters. Leave a box empty to drop a line." · Prices: "These must match the prices in App
  Store Connect and Play Console. The web only names them ("in the iPhone and Android apps"); nothing is sold on the web,
  and phones always show the store's own price. Leave a box empty for the built-in price." "The free trial's length is
  set in App Store Connect and Play Console, not here." · saves: "Features saved.", "Defaults saved.", "Announcement saved
  and on." / "Announcement saved; it isn't shown.", "Help lines saved.", "Prices saved.", "Nothing changed." · server
  errors (shown as sentences), e.g. "The monthly price must look like $9.95 or $100.", "An announcement that is on needs
  its text."
- New user-facing sentences in the app: none (announcement and Help lines are the owner's own text).
- Tests: backend `settings.test.mjs` (5: checks, public config, roles owner / partner 403 / anonymous 401 / bad token 401,
  change log, Activity); `insights-readiness.test` (the "Not mounted" line lists settings); unit `appConfig.test.mjs` (5) and
  `features.test` (expected production modules + settings); e2e `app-settings.spec.mjs` (3), `portal-enterprise-axe.spec.mjs`
  (2), nav lists in `portal.spec` / `portal-subs.spec` gain "App settings"; `e2e/lib/api.mjs` answers /api/app-config.
- Also changed after the first full run (the new request is in their lists, or a race surfaced): `account.spec` (the
  request list now leaves out the app settings GET, which app-settings.spec checks); `critique-axe.spec` "check-in faces"
  (waits 250 ms after tapping a face before the audit: axe caught the 100 ms colour transition mid-way, #7D8091 on #6071BA;
  it failed the same way on the Task 1 tree when re-run, so it is a timing race, not a colour change).
- Verified 2026-11-25 on the Task 2 tree (a clean worktree at the Task 2 WIP commits):

  | Check | Result |
  | --- | --- |
  | `npm run lint` | 0 errors, 24 warnings (same as d227a3a) |
  | `npm run test:unit` | 728/728 (723 + 5) |
  | `cd backend && npm test` | 135/135 (130 + 5) |
  | `cd backend && npm run smoke:all` | exit 0 (prod-smoke: settings mounted in production, `/api/app-config` 200, `/api/settings` 401) |
  | `npm run build` | ok; "BUILD 2026.10.07-D" once in dist |
  | e2e | full run 110 passed + 1 failed (account.spec, above); after the fix account.spec 6/6 → 111/111 |
  | axe | full run 68 passed + 2 failed (critique-axe race, above); after the fix critique-axe 6/6 → 70/70 |
