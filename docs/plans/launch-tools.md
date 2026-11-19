# Owner request, 2026-11-19: portal launch tools and in-app feedback

Owner asked what else would help go live; I recommended, and they said "Go" to: a launch readiness page, an AI spend
meter, feedback (button in the app + inbox in the portal), and two store-submission checks.

Branch: feature/launch-tools (from main 6fcfd5f). FOUR tasks, ONE COMMIT EACH (WIP commits first are fine, final after
verification; never amend, never force-push). Progress note: docs/plans/launch-tools-progress.md; push the branch
after each commit. Never push or merge main, no PR, never `playwright install`, no new npm dependencies. Read
CLAUDE.md first. Work in your own git worktree (see the agent prompt). Commit author and trailer lines: see the prompt.

Hard constraints: health data never leaves the device. Every UI/privacy/legal sentence must stay literally true:
update each sentence a change makes false (You -> Privacy & your data, sign-in disclosure, docs/PRIVACY-AUDIT.md,
public/legal/privacy.html). Portal pages here are owner-only (partners never see them). Secrets stay server-side and
are never returned, logged or shown, not even partially. Keep ARIA, focus styles, 44px targets, contrast; portal and
app pages added here get axe specs. Follow the existing patterns in backend/src/modules/insights and
backend/public/portal (nav, tables, cards, CSV, e2e helpers e2e/lib/portal.mjs).

## Task 1: launch readiness page (commit "Portal: launch readiness page")
- Owner-only portal page "Readiness" (first in the nav after Overview). One row per dependency with a status
  (Ready / Not set up / Problem), a plain sentence on what it is for, and when not ready the EXACT variable names to
  set in Render (names only, from .env.example). Rows: sign-in secret (AUTH_SECRET), owners (ADMIN_EMAILS), email
  (RESEND_API_KEY, EMAIL_FROM), each sign-in provider separately (Apple first, Google, Facebook), AI
  (ANTHROPIC_API_KEY), subscriptions (REVENUECAT_SECRET_KEY, REVENUECAT_PROJECT_ID), Impact, Oura, storage
  (DATA_DIR set, writable, and whether data written before this server start is still there, i.e. a persistent disk),
  ADMIN_KEY, and the production module list actually mounted.
- Status comes from presence/shape checks only by default (no outbound calls on page load). Add explicit owner
  buttons for the two cheap live checks: "Send me a test email" (to the signed-in owner) and "Check storage" (write,
  read back, delete a temp file). No button that spends AI or hits third parties automatically.
- The server cannot see the static site's settings: add a short "On the app's side" section listing VITE_API_BASE
  and the optional VITE_* names with one line each, and show the time of the last request the server received from
  an app origin (a timestamp in memory only, no address) so the owner can tell whether the app is pointed at it.
- A summary line at the top: "N of M ready. Needed for launch: ...", with required vs optional marked.
- Tests: backend unit (no secret value ever in a response; statuses), portal e2e + axe (light and dark).

## Task 2: AI spend meter (commit "Portal: AI spend estimate, budget and alert")
- Record, per UTC day and per kind (evidence, chat, weekly, owner report), TOTALS only from the API responses'
  usage fields: requests, input tokens, output tokens, cache tokens if present, web searches. No account id, no text.
  Collection e.g. "ai_spend", retained 400 days.
- Cost is an ESTIMATE: tokens x prices held in config (config.ai.prices) and editable by the owner in the portal,
  because prices change. For the default prices and the usage field names, load the `claude-api` skill and use what
  it says for the configured model; do not rely on memory. Label every amount "estimate" and show the prices and
  the date they were last edited. Say plainly that Anthropic's console is the bill of record.
- Portal page "AI costs" (owner only): this month so far, projected month end, by kind, by day (accessible table +
  small bar chart), average per person who used AI this month (total / count of ai_usage rows for the month),
  CSV export.
- Budget: owner sets a monthly budget in USD in the portal; one email (Resend, existing sender) to the owner report
  recipients when the estimate first passes 80% and again at 100% in a month, never more than once each per month
  (persist the sent markers). Also show the state on the Readiness and Overview pages. No automatic shut-off (say so);
  the per-person caps remain the hard limit.
- Include AI cost in the weekly owner report's numbers.
- Tests: backend unit (totals only, estimate maths, alerts once), portal e2e + axe.

## Task 3: feedback (commit "Feedback: send from the app, inbox in the portal")
- App: You -> "Send feedback" and "Report a problem" (one sheet, two kinds). A text box (max 2000 characters), an
  optional "It's OK to reply to me" switch shown only when signed in (off by default). Above the box: "Please don't
  include health details. Nothing from your log is attached." A "What will be sent" preview showing EXACTLY the
  payload before she sends: her message, kind, app build stamp, platform (web / iOS / Android), app language, and,
  only with the reply switch on, her account email. Nothing else: no log data, no stage, no device id. Sent only when
  she presses Send. Only shown in builds with a server; otherwise show the support email link only (below).
- Backend: POST /api/feedback, rate-limited in memory per address (existing limiter), length-capped, stored with a
  received date; kept 365 days then deleted; linked to an account only when she chose reply, and then deleted with
  the account. Never logged.
- Portal page "Feedback" (owner only): newest first, filter by kind and open/handled, mark handled, delete, a
  mailto reply link when she allowed a reply, count of open items on Overview. Include the open count in the weekly
  owner report (count only, never the text, and never send feedback text to Anthropic).
- Help: a short Help section in You (free week, cancelling, where data lives, connecting a watch, in the app's
  existing voice; each answer must be true of the build) with a support email link from VITE_SUPPORT_EMAIL (hidden
  when unset; add to .env.example and docs). 
- Privacy: this is the first free text she can send to the server. Add it truthfully to You -> Privacy & your data
  ("What can leave this device"), docs/PRIVACY-AUDIT.md and public/legal/privacy.html, and add a counsel note in
  public/legal/health-data.html that a user could type health details despite the warning.
- Tests: unit, backend (payload whitelist: unknown fields dropped; email only with consent; retention; delete with
  account), e2e (request body equals the preview exactly; nothing sent before Send), portal e2e + axe, app axe.

## Task 4: store-submission checks (commit "Store checks: restore purchases and delete account are easy to find")
- Apple requires both. They exist in code (ProSheet / purchase.js; AccountParts / YouScreen). Verify in the running
  app that "Restore purchases" is visible on the plans screen without scrolling past the plans on a 390x844 screen,
  and that "Delete my account" is reachable from You -> Account in at most two taps while signed in, with a clear
  confirmation of what is deleted. Fix whatever is not so. Add e2e tests that pin both. Add both to the store
  checklist in docs/STORE-SETUP.md.

## Report back
Commits, verification table per task (lint, app unit, backend tests, backend `npm run smoke:all`, build stamp once,
e2e, axe), new environment variables, every new or changed user-facing privacy sentence verbatim, anything written
from memory that needs checking against vendor docs, deviations from this brief, and screenshots (2x) saved to
/tmp/claude-0/-home-user/dd34ad26-25bd-5d87-8174-4dbbc0f7e686/scratchpad/shots11/ : Readiness, AI costs, Feedback
inbox, the app's feedback sheet with the preview open, the app's Help section. Delete any temporary spec afterwards.
