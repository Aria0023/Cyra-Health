# Eval: upgrade entry and the enterprise panel (docs/plans/upgrade-enterprise.md)

Branch `feature/upgrade-enterprise`. "Before" = main d227a3a (a temporary worktree, removed after this eval); "after" = the
Task 6 commit (b114f4b). Tasks 5 and 6 were added by the owner during the work. Screenshots (deviceScaleFactor 2) are in the session scratchpad `shots16/` (not committed).

## 1. Taps from Home to the Pro sheet (390×844, a fresh My Cycle user, light, Soft)

Measured by a temporary Playwright spec run once on each tree (then deleted): register, Home, then each path until
`#pro-sheet` is visible.

| Path | Before (d227a3a) | After |
| --- | --- | --- |
| Header plan badge | 1 tap | 1 tap (unchanged) |
| Through You | 3 taps (You → Plan & account → See what Pro adds) | 2 taps (You → Upgrade to Pro) |

"Upgrade to Pro" on You (after): x 16, y 452, 358 × 48 (CSS px at 390×844: x, y, width, height), between the stage card and the
seven rows. Hidden when she owns Pro (`lib/youMenu.js upgradeShown`, unit-tested: the web can't buy Pro, so no e2e can own it).

## 2. Every new route and its role check (server side, every request)

| Route | Who | Others get | Tested in |
| --- | --- | --- | --- |
| `GET /api/app-config` | anyone (no parameters; nothing about anyone) | — | settings.test, app-settings.spec, prod-smoke |
| `GET /api/settings` · `PUT /api/settings` · `GET /api/settings/log` | owner (`auth("owner")`, ADMIN_EMAILS) | partner 403, org admin 403, nobody / bad token 401 | settings.test, orgs-stats.test (org admin → /api/settings 403 via the portal e2e), portal-dashboard.spec, prod-smoke |
| `GET /api/orgs/:slug/config` | anyone (never the invite code or admins) | — | orgs.test, portal-orgs.spec, prod-smoke |
| `POST /api/orgs/join` | anyone; only `{ slug }` or `{ code }`; with an app sign-in the account stores `orgSlug` | other fields 400; unknown 404; 10 a minute per address | orgs.test, orgs.spec |
| `POST /api/orgs/leave` | anyone; changes something only with an app sign-in | — | orgs.test |
| `GET /api/orgs` · `POST /api/orgs` · `PATCH /api/orgs/:slug` · `POST/DELETE /api/orgs/:slug/logo` | owner | partner 403, org admin 403, nobody 401, the old `x-admin-key` 401 | orgs.test, orgs-stats.test, portal-orgs.spec, prod-smoke |
| `GET /api/orgs/mine` | owner (every org) or org admin (its own) | partner 403, nobody / forged 401 | orgs-stats.test |
| `GET /api/orgs/:slug/stats` | owner, or an admin of that org | org admin of another org (existing or not) 403, partner 403, nobody / forged 401, an admin removed from the org 401 | orgs-stats.test, portal-dashboard.spec |
| changed: every shop / subscriptions route with `auth("any")` | owner or partner | org admin 403 (6 shop routes and /api/subscriptions/codes tested) | orgs-stats.test, portal-dashboard.spec |
| changed: `GET /api/shop/me`, `POST /api/shop/auth/sign-out` | any signed-in role (`auth("session")`) | nobody 401 | orgs-stats.test, existing shop tests |

## 3. axe

Final full runs on the Task 6 tree: **axe 74/74** (baseline 66), **e2e 120/120** (baseline 105), unit 737/737 (722),
backend 148/148 (130), lint 0 errors / 23 warnings (24), smoke:all exit 0, the build stamp once in dist.

New axe coverage (WCAG 2.0/2.1 A and AA plus best practice, 0 violations, targets checked at 44px):
| Spec | What |
| --- | --- |
| upgrade-axe (2) | You with "Upgrade to Pro" in all nine styles, light and dark; the Pro sheet it opens in Soft and Aura |
| portal-enterprise-axe (2) | App settings (empty, a form error, saved with the change log, wide); Organizations (empty, a colour below AA, created with a logo); Dashboards for an owner and for an org admin, phone and wide; light and dark |
| orgs-axe (2) | registration's stage step with the invite code, its error and after joining; Home and You → Your profile wearing an organization in Soft and Aura; no organization; the join sheet; light and dark |
| devices-look-axe (2) | Home's devices card in all nine styles, light and dark (and Home in Sunset) |

One existing axe test changed: critique-axe "check-in faces" now waits 250 ms after tapping a face (a 100 ms colour
transition was caught mid-way; it failed the same way on the Task 1 tree when re-run, so it was a timing race).

## 4. Screenshots (shots16/)

| File | What |
| --- | --- |
| you-before.png / you-after.png | You at 390×844, fresh My Cycle user, light, Soft: before (no Upgrade) and after ("Upgrade to Pro" above the rows) |
| portal-app-settings.png | the portal's App settings with an announcement and a Help line saved, and the change log |
| portal-organizations.png / portal-organization.png | the Organizations list and one organization (colours with their contrast checks, stages, lineup, code, admins, logo) |
| portal-org-dashboard.png | an org admin's dashboard (10 joins: "10"; accounts and Pro "fewer than 10" / "not available") |
| app-org-register-light.png | registration's stage step after joining with an invite code (only its two stages) |
| app-org-home-light.png / app-org-home-dark.png | the app wearing a sample org brand (Lakeside Clinic: #2F5D50 / #8A4E18, dark #8AC2B0 / #D8A96A), light and dark |
| app-org-you-light.png / app-org-you-dark.png | You → Your profile's "Your organization" card, light and dark |
| devices-card-before-{light,dark}.png / devices-card-after-{light,dark}.png | Home's "Connect a device" card before and after Task 5 (API build, Perimenopause, Soft) |

## 5. Every new user-facing sentence (verbatim)

In the app (every one; the portal's owner-facing sentences are listed per task in
docs/plans/upgrade-enterprise-progress.md, and the privacy-relevant ones in docs/PRIVACY-AUDIT.md):

- Task 1: "Upgrade to Pro" · "See Pro"
- Task 2: none of the app's own (the Home announcement and Help lines are the owner's text, plain text only)
- Task 3 (src/lib/org.js ORG_COPY): "Your organization sees how many people joined, never what you log." · "Powered by Solia
  Health" · "Invite code (optional)" · "From your clinic or employer, if they gave you one." · "Join" · "Checking…" · "Join
  {name}?" · "{name} offers Solia Health with its own look." · "Joining sends only the organization's name or code, and
  with your sign-in, your account notes which organization you joined." · "Not now" · "You joined {name}." · "Leave {name}"
  · "You left the organization. Solia Health's own look is back." · "Your organization" · "Joined through a clinic or
  employer? Enter its invite code." · "You're using {name}'s version of Solia Health." · "That invite code isn't known.
  Check it with your organization." · "That organization link isn't known." · "Couldn't reach Solia Health's server. Try
  again when you're online." · "Joining an organization needs Solia Health's server, which this version doesn't have."
- Task 4: "Totals only. Its admins see how many people joined, how many of them have an account or Pro, and joins per week;
  any number under 10 shows as "fewer than 10", and they never see a name, an email or anything you log."
- Task 5: none
- Task 6: phone, with today's store products: "You can subscribe now. Your free week isn't extended: the yearly plan's 7
  free days start when you subscribe, and the monthly plan is charged from the day you subscribe." (the days are read from
  the store's products; a plan without a store trial reads "the {yearly|monthly} plan is charged from the day you
  subscribe"); web: "You can get Pro in the iPhone or Android app at any time, during your free week too."
- Legal (public/legal/privacy.html §3, attorney review needed): the "App settings" row and the "Joining an organization"
  row, verbatim in docs/PRIVACY-AUDIT.md Tasks 2 to 4.

## 6. Deviations and what isn't verified

- Features the owner turns off apply from the next start after the app downloaded the change (module-level constants
  read the build's features when the app loads); the portal says so. The other settings apply when the download answers.
- The app keeps its copy of the app settings in localStorage (app settings only, the same for everyone; removed by Delete
  everything), because it must be read synchronously before the features are.
- The colour check is AA 4.5:1 against Solia's page AND card of each scheme (which also covers the text on filled
  buttons); not against the ink colour, which Solia's own palette would fail and which primary never sits on.
- "Change your stage" still runs the intake questions, which aren't limited by an organization; registration's stage
  cards are. She still gets exactly one stage.
- With an organization joined, the header's plan badge stays hidden (the existing org rule in the code); You's "Upgrade to
  Pro" stays.
- Task 6 wording: "monthly starts right away" became "the monthly plan is charged from the day you subscribe".
- Process: an unpushed Task 2 WIP commit was undone locally (`git reset --soft`) so Task 1's final commit could come first;
  nothing pushed was rewritten. WIP commits are on the branch between finals.
- Not verified: the RevenueCat v1 subscriber lookup used for the Pro count (written from memory, like the other calls in
  revenuecat.js; mocked in tests, "not available" without keys); a real store purchase turning the badge "Pro" (checked
  with a mock store in unit tests only: the web and the e2e harness have no store); the org flow on a phone; legal text
  (attorney review).
