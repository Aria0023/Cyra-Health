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

## Task 3: organizations — DONE (final commit "Organizations: branded versions for clinics and employers")
- Backend `orgs` module rewritten and mounted in production (configs, PRODUCTION_MODULES, prod-smoke, readiness's module
  list, app `FEATURE_ALSO.shop`); in app-dev.json it moved after `shop` (it needs the portal sign-in). The demo
  `x-admin-key` writes are gone: every write is `ctx.portal.auth("owner")`. Public: `GET /api/orgs/:slug/config` (never
  the invite code or admins), `POST /api/orgs/join` ({ slug } or { code }, nothing else; a daily join total
  `org_joins { day, slug, joins }`; with the app's sign-in token the account row gets `orgSlug`), `POST /api/orgs/leave`
  (with a sign-in: `orgSlug` cleared; without: nothing). Owner: `GET/POST /api/orgs`, `PATCH /api/orgs/:slug`,
  `POST/DELETE /api/orgs/:slug/logo` (PNG/JPEG/WebP by magic bytes, at most 64 KB, a file under DATA_DIR/org-logos; the
  config carries it as a data URL, so the app makes one request). Checks (`cleanOrg`): slug, name (plain text, 60), colours
  (`themeProblems`: primary and accent, light and dark, each 4.5:1 on Solia's page AND card of its scheme), stages (subset
  of cycle/ttc/preg/peri/meno, at least one), lineup (null = whole Shop, or published catalog product ids), invite code
  (6-12 letters/digits, unique; made when empty), admins (at most 20 emails). The bootstrap "cyra" row now has Solia's real
  palette tokens (ORGS.cyra: #5B54A6 / #A8486E, dark #B9B3F2 / #F0A3C0) and the app's stage ids; an older row is fixed on start.
- App: `src/lib/org.js` (pure: cleaner re-checking every colour, `orgTheme` = Solia's page/card/ink/soft/line + the org's
  primary/accent, `orgView`, `stageCardsFor`, `orgFromSearch`, `cleanCode`, ORG_COPY), `src/lib/orgLive.js` (peek, join,
  leave), `src/components/OrgJoin.jsx` (OrgCodeField, OrgCard `#you-org` on You → Your profile, OrgJoinSheet `#org-join`).
  Record key `org` (device-only, not in backup). App.jsx: `org` state → `orgUi = orgView(org)` (the old `ORGS[orgId]`
  object), header mark with logo + name + "Powered by Solia Health", stage palettes and the palette picker off while
  joined (existing org rules), registration's stage cards limited (a picked card it doesn't offer is unpicked), the Shop's
  existing `allow` filter = the lineup. A `?org=` link asks for the public config only, takes the link out of the address
  bar and opens "Join <name>?"; nothing is joined or counted until Join.
- DEVIATION: the colour check is against Solia's page AND card colours of each scheme (the surfaces the brand colour sits
  on and, for filled buttons, the colour of the text on it). A check against the ink colour was not added: Solia's own
  palette (#5B54A6 on ink #1E2132, 2.4:1) would fail it, and primary is never text on ink.
- DEVIATION: "Change your stage" (You → Your profile → Change) still runs the intake questions, which aren't limited by the
  organization; the limit applies to registration's stage cards. She still gets exactly one stage.
- Existing org behaviour kept: the header's plan badge shows only on Solia's own look (constants.js ORGS rule); You's
  "Upgrade to Pro" stays.
- New user-facing sentences in the app (src/lib/org.js ORG_COPY), verbatim: "Your organization sees how many people
  joined, never what you log." (the privacy line, where she joins: registration's code field, the join sheet, You → Your
  organization) · "Powered by Solia Health" · "Invite code (optional)" · "From your clinic or employer, if they gave you
  one." · "Join" / "Checking…" · "Join {name}?" · "{name} offers Solia Health with its own look." · "Joining sends only the
  organization's name or code, and with your sign-in, your account notes which organization you joined." · "Not now" ·
  "You joined {name}." · "Leave {name}" · "You left the organization. Solia Health's own look is back." · "Your
  organization" · "Joined through a clinic or employer? Enter its invite code." · "You're using {name}'s version of Solia
  Health." · "That invite code isn't known. Check it with your organization." · "That organization link isn't known." ·
  "Couldn't reach Solia Health's server. Try again when you're online." · "Joining an organization needs Solia Health's
  server, which this version doesn't have." (not shown: the code field and card appear only in builds with a server).
- Portal sentences (owner-facing, backend/public/portal/orgs.js), verbatim: "Branded versions of Solia Health for clinics
  and employers: one app, with the organization's name, logo and colours, the life stages it offers and its Shop lineup.
  People join with the organization's link or invite code." · "New organization" · "No organizations yet." · "{slug} ·
  invite code {code} · {stages} · updated {when}" · "3 to 32 lowercase letters, digits or hyphens. It is in the join link
  and can't be changed later." / "The slug can't be changed." · "Only the app's primary and accent colours, for light and
  dark. The page, card and text colours stay Solia Health's, and charts keep their own colours. Each must reach 4.5:1 on
  the page and on the card of its scheme (WCAG AA)." · "{a}:1 on the page, {c}:1 on the card: passes AA (4.5:1)" / "…:
  below AA (4.5:1)" / "Not a colour yet: use #RRGGBB." · "Life stages it offers (each person still gets exactly one)" ·
  "Show the whole Shop" · "6 to 12 letters or digits. Leave it empty and one is made for you." / "6 to 12 letters or
  digits. Changing it stops the old code from working." · "Admin emails, one per line" · "They sign in to this portal and
  see only this organization's totals." · "Fix the colours marked below first: each needs 4.5:1 on the page and the card."
  · "Created {name}. Its invite code is {code}." · "Saved." · "Logo" · "No logo yet: the app shows the name only." · "Logo
  file (PNG, JPEG or WebP, at most 64 KB; square works best)" · "Upload logo" / "Remove logo" · "Choose a PNG, JPEG or WebP
  file first." · "The logo is larger than 64 KB." · "Logo uploaded." / "Logo removed." · "How people join" · "With the
  invite code {code} on registration or in You → Your profile, or with a link to the app that ends in ?org={slug}." ·
  "The app shows each person this, where she joins: "Your organization sees how many people joined, never what you log."
  (This portal is at {origin}.)" · "There's no organization with that slug." · "All organizations".
- Legal: `public/legal/privacy.html` §3 gains the row "Joining an organization (optional, with an invite code or link from
  a clinic or employer)" (verbatim in docs/PRIVACY-AUDIT.md Task 3). FLAG FOR ATTORNEY REVIEW.
- Tests: backend `orgs.test.mjs` (7: colours, checks, bootstrap palette, roles owner / partner 403 / anonymous 401 / the old
  x-admin-key 401, logo, join by slug and code with the daily total and the account's orgSlug, leave); `insights-readiness`
  line (+ orgs); unit `org.test.mjs` (5), `record.test` (the `org` key in the pinned lists, defaults, backup copy and
  RECORD_IMPORTS), `features.test` (production modules + orgs), `youMenu` SECTION_PAGE `you-org`; e2e `orgs.spec.mjs` (4),
  `portal-orgs.spec.mjs` (2), `orgs-axe.spec.mjs` (2), `portal-enterprise-axe.spec.mjs` (+ Organizations pages); nav lists
  in `portal.spec` / `portal-subs.spec` gain "Organizations"; `e2e/lib/api.mjs` answers the three org routes.
- Verified 2026-11-25 on the Task 3 tree (a clean worktree at the Task 3 WIP commit, full runs):

  | Check | Result |
  | --- | --- |
  | `npm run lint` | 0 errors, 23 warnings (d227a3a's 24 less App.jsx's unused `setOrgId`, now used) |
  | `npm run test:unit` | 733/733 (728 + 5) |
  | `cd backend && npm test` | 142/142 (135 + 7) |
  | `cd backend && npm run smoke:all` | exit 0 (prod-smoke: orgs mounted in production, `/api/orgs/cyra/config` 200 with Solia's palette, writes 401, the admin key 401) |
  | `npm run build` | ok; "BUILD 2026.10.07-D" once in dist |
  | e2e | 117/117 (111 + 6) |
  | axe | 72/72 (70 + 2) |
- The owner's Tasks 5 and 6 were appended to docs/plans/upgrade-enterprise.md in this commit (coordinator's request).
