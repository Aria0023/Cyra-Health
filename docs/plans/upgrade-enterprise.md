# Upgrade entry and the enterprise panel (owner request 2026-11-25)

Owner asked: "if someone wants to subscribe where is that menu? And where is enterprise panel so everything can be
customizable". Owner chose: a clearer Upgrade entry (payment stays in the phone apps; no web checkout), and all three
enterprise pieces: an owner settings panel, organization branding, and organization dashboards.

Base: `main` at d227a3a. Branch: `feature/upgrade-enterprise`. One commit per task (WIP commits allowed, then a final
commit per task). CLAUDE.md hard rules apply throughout; the ones that bite here are called out per task.

Baselines on d227a3a: 722 unit, 130 backend, 105 e2e, 66 axe, 0 lint errors / 24 warnings, build stamp exactly once.

## Task 1 — "Upgrade: one clear way to Pro"
- You screen: when she does not own Pro, a primary "Upgrade to Pro" button at the top of You (above the seven rows),
  opening the existing Pro sheet. Hidden when owned; for a guest it reads the same and the Pro sheet already handles
  guests. Bold lead-in rule applies to any new explanatory line.
- Every Pro-only card or locked feature that today only says it is Pro gets a "See Pro" link/button opening the same
  sheet (find them via `proAddsFor`, `PRO_*`, `unlocked` checks). No new paywall interruptions; no countdowns.
- The web keeps no buy button (the Pro sheet's existing "get it in the iPhone and Android apps" stays true).
- 44px targets, ARIA, axe clean in all nine styles light and dark for the You screen.

## Task 2 — "Owner settings: change the app without a code change"
- Backend module `settings` (add to `config/app.json` production modules and `app-dev.json`): owner-only writes
  (same `auth("owner")` / ADMIN_EMAILS pattern as `insights`), with a change log (who, when, old → new) kept on the
  server; public `GET /api/app-config` returns only non-health, non-personal app settings.
- Editable, with validation:
  - features the build already offers can be turned OFF (never on beyond the build's VITE_FEATURES; never touches
    privacy behaviour such as shop tap counting defaults);
  - default style for new users (one of `STYLES`), default palette;
  - a short Home announcement (plain text, length-capped, off by default) and Help page extra lines;
  - web reference prices shown on the web Pro sheet — with a portal warning that they must match the store prices.
    The trial length is set in App Store Connect / Play Console and is NOT editable here; the portal says so.
- Not editable: any privacy claim, legal text, clinical/safety text (contraception line, crisis lines), Apple-first
  sign-in order. The portal states this list.
- App: when `VITE_API_BASE` is set, fetch `/api/app-config` at boot, cache on device, fall back to built-in defaults
  on any failure; a build without a backend behaves exactly as today. The request carries nothing about her.
- Portal page "App settings" in the existing portal nav with the same look; axe clean.

## Task 3 — "Organizations: branded versions for clinics and employers"
- Mount `orgs` in production behind owner auth for writes; replace the demo `x-admin-key` writes with the portal's
  owner auth. Keep `GET /api/orgs/:slug/config` public. Fix the bootstrap org's theme to Solia's real palette tokens.
- Portal page "Organizations": create/edit an org — name, slug, logo (small image, size-capped, stored on the
  server), brand colours mapped onto UI palette tokens only (never data-viz ramps), checked server-side and in the
  portal for WCAG AA contrast against paper and ink, allowed life stages (a subset; she still gets exactly one), the
  partner lineup (subset of the catalog), an invite code, and org admin emails.
- App: she joins with a link `?org=<slug>` or by entering an invite code on registration (optional field; also in
  You → Your profile). The app fetches the org config, applies name/logo/colours, limits the stage list, filters the
  shop shelf, and remembers the org on device. Leaving the org restores Solia defaults. "Powered by Solia Health"
  stays visible. Joining sends only the org slug/code; with an account, the account stores which org it joined.
- Privacy copy: add one literally-true line where she joins ("Your organization sees how many people joined, never
  what you log."), update `public/legal/privacy.html` and `docs/PRIVACY-AUDIT.md` (flag for attorney review).

## Task 4 — "Organization dashboards: totals only"
- Org admins (emails listed on the org) sign in to the same portal and see ONLY their org: people joined, signed-in
  accounts, Pro subscribers, joins per week. Totals only; any number under 10 shows as "fewer than 10". No per-person
  rows, no emails, no health data (the server holds none). Owners see every org.
- Server-side role check on every route (an org admin can never read another org or owner pages). Backend tests for
  each role boundary.

## Eval
`docs/plans/upgrade-enterprise-eval.md`: taps from Home to the Pro sheet before/after (390×844, fresh My Cycle user,
light, Soft); every new route with its role check; axe results; screenshots of You (before/after), the portal's App
settings, Organizations and an org dashboard, and the app wearing a sample org brand in light and dark, saved under
the session scratchpad `shots16/`. List every new user-facing sentence verbatim.

## Out of scope
Web checkout, legal sign-off, a separate native white-label binary, App.jsx split, changing the nine styles.
