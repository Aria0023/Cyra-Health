# Owner request, 2026-11-19: build the tracking additions discussed on 2026-11-16, and the wearable how-to

Owner's words: "make changes from previously we talked about." The unbuilt items from that discussion:
1. Anonymous click counts per product and brand.
2. Affiliate earnings in the portal (Impact reporting).
3. Sign-in stats in the portal (counts only).
4. A weekly reporting agent (AI-written summary emailed to the owner, from totals only).
5. Fitbit / Garmin / Whoop how-to on the devices screen (share to Apple Health / Health Connect; no Terra).

Branch: feature/tracking-reports (from main 6cc9d4d). FOUR tasks, ONE COMMIT EACH (WIP first, final after
verification; never amend + force-push). Progress note: docs/plans/tracking-reports-progress.md; push after each
commit. Never push/merge main, no PR, never `playwright install`, no new npm dependencies. Read CLAUDE.md first.
Work in your own git worktree (see the agent prompt).

Hard constraints: health data never leaves the device. Nothing below may carry a user id, account id, device id, IP
(beyond the existing in-memory rate limiter), stage, module, or anything she logged. Every UI/privacy/legal sentence
must stay literally true: update each sentence these changes make false (notably the Shop's "nothing about you is
sent" / "no tracking" lines, You -> privacy dashboard "What can leave this device", PRIVACY-AUDIT, privacy.html).
Owner-only portal pages (partners see only their own brands' click totals). Secrets server-side only, never logged.

## Task 1: anonymous shop click counts (commit "Shop: anonymous tap counts per product, shown in the portal")
- App: when she taps "Visit <brand>" (or the product picture), send POST /api/shop/tap { productId } with no cookies,
  no token, no referrer, keepalive, fire-and-forget; only in builds with a server and the shop flag; never blocks or
  delays the link. Nothing else in the body. A device-only switch in You -> privacy ("Count my shop taps anonymously",
  on by default, with the exact sentence of what is sent) turns it off.
- Backend (shop module): validate productId against the catalog, rate-limit per address in memory (existing limiter),
  store ONLY daily totals: { day (UTC), productId, brandId, taps }. No per-request rows. Retain 400 days.
- Portal: "Clicks" page (owner: all; partner: own brands): totals by brand and product for 7/30/90 days, a simple
  accessible table + small bar chart, CSV export.
- Copy: the Shop footer becomes true, e.g. "When you open a product, Solia Health counts one anonymous tap for that
  product. It isn't linked to you or to anything you log." Keep "Matched on this device" sentences only where true.
- Tests: unit (cleaner, switch off -> no request), backend (totals only, unknown id rejected, partner scope), e2e
  (request body is exactly {productId}, no auth/cookie; switch off), portal e2e + axe.

## Task 2: sign-in stats (commit "Portal: account and sign-in totals")
- Accounts module: keep a coarse `lastSeenDay` (UTC date only, no time, no IP) on the account, updated at most once a
  day on GET /me or sign-in. Portal "People" card on Overview + a small page: total accounts, new accounts by day
  (30 days), active in the last 1/7/30 days, by sign-in method. Counts only: no emails, no list of people.
- Privacy: the sign-in disclosure and privacy draft gain "the last day you used your account" in what the server keeps.
- Tests: backend unit, portal e2e + axe.

## Task 3: affiliate earnings (commit "Portal: affiliate clicks, sales and commission from Impact")
- New backend module part (subscriptions-style, owner only): env IMPACT_ACCOUNT_SID, IMPACT_AUTH_TOKEN. One file holds
  every Impact endpoint path with the comment "verify against Impact's current API docs before go-live"; fails closed
  with a clear "not configured" state; cached 15 minutes; mocked in tests. Show per campaign (brand): clicks, actions
  (sales), sale amount, commission, for 7/30/90 days; totals; last updated.
- Amazon Associates has no simple reporting API for new accounts: provide a manual CSV upload of the Associates
  earnings report (parse date, items shipped, revenue, earnings; caps and validation) shown beside Impact, labelled
  "Uploaded <date>". Document both in docs/AFFILIATES.md.
- Portal page "Affiliates" combining: Solia taps (Task 1) next to network clicks/sales/commission per brand (map
  brand <-> campaign by an owner-editable field on the brand).
- Tests: backend unit (configured / not configured / API error / CSV parsing), smoke in smoke:all, portal e2e + axe.

## Task 4: weekly report agent + wearable how-to (commit "Weekly owner report by email; Fitbit, Garmin and Whoop how-to")
- Weekly report: every Monday 14:00 UTC (in-process timer checked hourly, last-sent stamp in DATA_DIR so a restart
  never double-sends; plus a "Send now" and "Preview" button in the portal, and an on/off switch + recipient list
  defaulting to ADMIN_EMAILS). Content from TOTALS ONLY: new and active accounts, subscribers/trials/revenue (RevenueCat,
  if configured), top products by taps, affiliate sales/commission (if configured), partner activity (applications,
  submissions waiting), AI usage totals (sum of ai_usage counts, no per-account data), anything unusual (week-over-week
  changes > 30%). Written by Claude through the existing ai module client (model from config, output_config effort
  "low", no thinking-disabled param; handle refusal and errors) from a JSON of totals; if ANTHROPIC_API_KEY is unset or
  the call fails, send a plain template with the same numbers. Sent with the existing Resend sender. The email states
  "Totals only; no personal or health data." Preview in the portal shows exactly what would be sent.
- Devices screen (src/components/Devices.jsx, lib/devices.js): a "Fitbit, Garmin or Whoop?" row/disclosure explaining
  in three short steps each how to turn on sharing to Apple Health (iPhone) or Health Connect (Android) in that brand's
  app, then connect Apple Health / Health Connect in Solia; note what doesn't come through (Whoop and Garmin don't
  share HRV that way). Wording generic enough to stay true as vendor menus change ("in the app's settings, look for
  Apple Health / Health Connect"). Keep Terra rows hidden unless the server reports Terra configured.
- Tests: backend unit (schedule, no double send, template fallback, totals-only JSON), portal e2e + axe, app e2e + axe
  for the devices disclosure.

## Verification before each final commit
npm run lint (0 errors), npm run test:unit, cd backend && npm test && npm run smoke:all, npm run build (stamp
"BUILD 2026.10.07-D" once), npm run e2e -- --trace off, npm run e2e:axe -- --trace off (0 violations).
Author: git -c user.name="Aria" -c user.email="aria23@gmail.com". Trailer lines:
Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HHP8o69cmnMvBZyGdDsuZF
