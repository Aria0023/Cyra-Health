# Owner request, 2026-11-15: the portal controls subscriptions and promotions ("all of it")

The five parts the owner approved:
1. Subscriptions dashboard (read-only, from RevenueCat).
2. Promotion switching: offers created once in App Store Connect / Play Console are scheduled and targeted from the
   portal (on/off, start/end dates, audience: everyone / new users / a life stage).
3. In-app promotion banners tied to a real store offer (price shown is always the store's price).
4. Free Pro grants to a person or a group for a set time (by account email), e.g. a partner clinic's patients.
5. Partner promo codes: batches of Apple/Google offer codes handed to partners, tracked per partner.

Branch: feature/plans-shop-page (with the Shop page and partner portal; not merged by owner decision). THREE tasks, ONE
COMMIT EACH, WIP first then a final commit after verification (never amend + force-push). Progress note:
docs/plans/portal-subscriptions-progress.md; push after each commit. Never push/merge main, no PR, never `playwright
install`, no new npm dependencies (use fetch + node:crypto). Read CLAUDE.md first.

Hard constraints:
- Store rules: prices, trials and discounts are created ONLY in App Store Connect / Play Console. The portal never
  invents a price; banners and tiles show only the price the store returns for the referenced offering/package. Web
  sells nothing ("in the iPhone and Android apps").
- Secrets: REVENUECAT_SECRET_KEY (server only, never in the app, never logged) and REVENUECAT_PROJECT_ID; the app keeps
  only the public SDK keys. Owner-only access to everything in this brief (partners never see revenue or grants; a
  partner may see only the codes assigned to its own brands and their count).
- Privacy: health data never leaves the device. Today the app tells RevenueCat nothing about her. Part 4 needs an
  identity: when she is signed in, the app calls RevenueCat logIn with her opaque Solia account id (never email, never
  name, never health data); signed out, RevenueCat keeps its anonymous id. Update every UI/privacy/legal-draft sentence
  so it stays literally true ("RevenueCat gets an anonymous id, or your account number if you're signed in; never your
  email or anything you log"), PRIVACY-AUDIT entry, store disclosures note (User ID).
- Targeting happens on the device: the app downloads the list of active promotions (no query, nothing about her) and
  decides locally whether her stage / newness matches. The server never learns her stage.
- RevenueCat API: use REST v2 where available (e.g. metrics overview for project) and v1 for promotional entitlements
  (POST /v1/subscribers/{app_user_id}/entitlements/{entitlement_id}/promotional with a duration, and the revoke call).
  This container may not reach RevenueCat's docs: put every endpoint path in ONE file
  (backend/src/modules/subscriptions/revenuecat.js) with a comment "verify against RevenueCat's current API docs before
  go-live", make the client fail closed with a clear "not configured" state when env is unset, and mock it in tests.

## Task 1: backend (commit "Subscriptions API: RevenueCat metrics, promotions, Pro grants and partner codes")
- New production module `subscriptions` (owner-only routes using the portal token; mount in app.json/app-dev.json;
  .env.example + render.yaml: REVENUECAT_SECRET_KEY, REVENUECAT_PROJECT_ID, REVENUECAT_ENTITLEMENT (default "pro")).
- Metrics: cached (5 min) overview: active subscribers, active trials, MRR, revenue last 28 days, new customers, churn if
  available; plus a "last updated" time. Errors shown plainly.
- Promotions store (DATA_DIR): {id, name, offeringId (RevenueCat offering identifier), platforms, audience: {who:
  "everyone"|"new"|"stages", stages[]}, startsAt, endsAt, banner: {title<=40, body<=120}, status draft|scheduled|
  live|ended}. Public GET /api/promotions/active returns only currently active promos (no audience secrets beyond the
  rules, no names of people), ETag + Cache-Control, no query params.
- Pro grants: grant by one email or a pasted list/CSV (<=500), duration (1 week / 1 month / 3 months / 6 months / 1 year
  / lifetime per RevenueCat's allowed durations), note; resolves email -> account id via the accounts module; emails
  with no account are listed back ("no account yet: invite them to sign up") and can be queued to apply on first
  sign-in. Revoke. Every grant/revoke in the audit log.
- Partner codes: owner uploads code batches (CSV/text, one code per line) labelled with platform (ios/android), the
  store offer they belong to, expiry, and the partner brand; assign to a partner; status per code (available /
  given out / marked redeemed); counts per partner. Partners can download their own available codes in the portal.
  Redemption tracking: per-partner distinct store offers are the recommended way (document); show counts the owner
  marks, plus RevenueCat-reported numbers where the API provides them; never claim tracking the code can't do.
- Tests: backend unit tests with a mocked RevenueCat (configured / not configured / API error), role checks (partner
  gets 403 on everything except its own codes), schedule logic, CSV parsing caps; add to smoke:all.

## Task 2: portal screens (commit "Portal: subscriptions dashboard, promotions, Pro grants and partner codes")
- New nav items (owner): Subscriptions (dashboard cards + "not configured" guidance with the exact env names),
  Promotions (list, create/edit with schedule + audience + banner text + live preview of the in-app banner with
  "price from the store" placeholder, start/stop), Pro grants (single + bulk, results table, revoke, queued grants),
  Codes (upload batch, assign to partner, export). Partner nav: "Codes" showing only their codes.
- Plain guidance copy on what must be created in App Store Connect / Play Console / RevenueCat first (offer, offering
  id), linking docs/STORE-SETUP.md sections.
- Accessible, same style as the portal; e2e (real backend + mocked RevenueCat) for each screen and partner limits; axe
  light/dark.

## Task 3: the app (commit "App: scheduled promotions from the store, Pro grants by account, and redeem a code")
- Download /api/promotions/active when the Pro sheet or You opens (and at most daily), clean it, cache device-only,
  evaluate audience on device ("new" = first used within 14 days, per the record's own dates). When a promo matches:
  request that RevenueCat offering through lib/purchase.js; show a calm banner on the plan tiles and the Pro sheet with
  the banner text and ONLY the store's price strings for that offering (if the offering or prices don't load, show
  nothing). Web: the banner says the offer is in the iPhone and Android apps, no price unless a reference price exists
  for that offer in lib/pricing.js (it doesn't: show none).
- Signed in: Purchases.logIn(accountId) after sign-in, logOut on sign-out/delete (lib/purchase.js); entitlement
  refresh picks up promotional Pro (grants) automatically. Pro shows "Pro until <date>" for a time-limited grant.
- "Have a code?" on the Pro sheet: iOS opens the system offer-code redemption sheet (via the RevenueCat Capacitor
  plugin if it exposes it; else Apple's redeem URL https://apps.apple.com/redeem?ctx=offercodes&id=<app id> from env
  VITE_APP_STORE_ID); Android opens the Play redeem URL https://play.google.com/redeem?code=<code> after she types the
  code; web explains codes are redeemed in the app.
- Never in notifications, onboarding, urgent screens or insights; at most one promo banner at a time; dismissible.
- Tests: unit (audience evaluation, cleaner, no-price-without-store rule, logIn/logOut calls), e2e with mocked API +
  the dev gallery's pretend store, axe light/dark.

## Verification before each final commit
npm run lint (0 errors), npm run test:unit, cd backend && npm test && npm run smoke:all, npm run build (stamp once),
npm run e2e -- --trace off, npm run e2e:axe -- --trace off (0 violations).
Author: git -c user.name="Aria" -c user.email="aria23@gmail.com". Trailer lines:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HHP8o69cmnMvBZyGdDsuZF
