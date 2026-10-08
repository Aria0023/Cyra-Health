# Cyra Health — Enterprise Backend (reference implementation)

Modular, plug-and-play partner/referral backend for the Cyra app.
Runs anywhere Node 18+ runs. Zero external services required.

## Run it
    npm install
    node server.js          # -> http://localhost:3000
    node scripts/smoke.js   # end-to-end test (in a second terminal)

## Architecture
- **Modular** — every feature is a module in `src/modules/`, loaded from the
  `modules` list in `config/app.json`. Delete a name from that list and the
  feature's routes cease to exist. Add your own module the same way.
- **Plug-and-play partners** — a partner is one JSON file in `config/partners/`.
  Drop in a file and referral links, webhooks, payouts, reports, and the app's
  Shelf catalog all pick it up on restart. No code changes.
- **Customizable per partner** — fee model (`new_patient_bounty`,
  `per_visit_fee`, `commission_pct`), attribution window, landing URL,
  ref param, shelf card, life stages.
- **Swappable storage** — `src/core/store.js` defines a 4-method adapter;
  JSON-file store ships as default. Implement the same interface for
  Postgres and change `storage.driver` in config.

## The attribution model (from the Midi conversation)
1. App requests `POST /api/referrals/link` with an **opaque userRef hash** —
   no PII, no symptom data server-side, ever.
2. User clicks `GET /r/:code` → click logged → 302 to partner with the code.
3. Partner posts HMAC-signed events to `POST /api/webhooks/:partnerId`:
   first `conversion` per patient hash = **new patient** (bounty fires once);
   later `visit` events accrue to per-visit fees and aggregate reports.
4. `GET /api/payouts?from&to` = invoice basis. `GET /api/reports/partners/:id`
   = the aggregate-only report your contract audit clause points at.

## Endpoints
    GET  /health
    GET  /api/partners                 GET /api/partners/:id
    POST /api/referrals/link           GET /api/referrals/:code
    GET  /r/:code                      (redirect + click tracking)
    POST /api/webhooks/:partnerId      (HMAC x-cyra-signature)
    GET  /api/payouts?from&to
    GET  /api/reports/partners/:id
    GET  /api/catalog?stage=peri
    POST /api/ai/welcome | /api/ai/route | /api/ai/ask | /api/ai/insight   (AI proxy; see src/modules/ai)
    GET  /api/oauth/providers         GET /api/oauth/:provider/start?return=   POST /api/oauth/exchange
    GET  /api/integrations/sources    oura: /start /callback /exchange /refresh /pull   terra: /session /done /webhook /inbox
    GET  /api/pulse?stage=            POST /api/pulse/tally
    GET  /api/push/vapid              POST|DELETE /api/push/subscribe

## Before production
Reference implementation — before real traffic add: TLS + auth on admin
routes, real secrets management (not JSON files), Postgres storage adapter,
idempotency keys on webhooks, rate limiting, and monitoring. If/when you move
to in-platform telehealth booking, this service enters HIPAA scope: BAA,
encryption at rest, audit logging, access controls.

## v2 — Open architecture additions

### Wearable integration hub (`src/modules/integrations/`) — v4, privacy-first
One per-day row for every source: `{ date, temp (°C deviation), rhr, hrv, sleep }`.
- **Apple Health / Health Connect** — read *on the device* by the app's native
  bridge (Capacitor plugin `CyraHealth`: `available()`, `requestAuthorization()`,
  `readDaily({from,to})`). The server never sees it.
- **Oura (API v2, user OAuth)** — `GET /oura/start?return=` opens Oura in a popup;
  the callback hands a one-time code to the opener via `postMessage`; `POST
  /oura/exchange` returns the tokens **to the device**, which keeps them. `POST
  /oura/pull {access_token}` fetches readiness/sleep, normalizes, returns — and
  stores nothing; `POST /oura/refresh` uses the server-held client secret.
- **Terra (Fitbit, Garmin, Whoop, …)** — `POST /terra/session {ref, return}` creates
  a widget session for the device's opaque reference id; Terra's signed webhooks
  (`terra-signature`, HMAC over `t.body`, 5-minute window) are normalized into an
  **in-memory mailbox** per reference id (TTL 7 days, never written to disk) that
  the device drains with `GET /terra/inbox?ref=`.
`GET /sources` reports what this server can serve. Credentials: `OURA_CLIENT_ID /
OURA_CLIENT_SECRET`, `TERRA_DEV_ID / TERRA_API_KEY / TERRA_SIGNING_SECRET`;
register `<PUBLIC_BASE_URL>/api/integrations/oura/callback` with Oura and
`<PUBLIC_BASE_URL>/api/integrations/terra/webhook` with Terra. `npm run
smoke:integrations` runs both flows against local mocks.

### Agentic backend (`src/modules/agent/`)
Agent = task + shared tool registry + pluggable reasoning provider:
- `providers/rules.js` — deterministic, zero-setup (default)
- `providers/anthropic.js` — Claude tool-use loop; set ANTHROPIC_API_KEY and
  flip `agent.provider` to "anthropic" in config/app.json. No other change.
Tools (get_metrics, get_catalog, get_partner_stats) are provider-agnostic —
add a tool once, every provider can use it. Agents only ever see opaque
userRefs and normalized aggregates, never PII or raw symptom logs.

`POST /api/agent/run {"task":"weekly_insight","userRef":"...","stage":"peri"}`

## v3 — Multi-tenant white-labeling
- `orgs` module: create organizations with their own theme, life stages, and
  partner lineup. The app (web or phone — same React codebase wrapped with
  Capacitor/Expo) calls `GET /api/orgs/:slug/config` at boot: one binary,
  per-org branding and shelf.
- `users` module: opaque userRef + org + role + status only. Identity belongs
  in your IdP (OIDC/SSO); health data stays on-device.
- Admin writes gated by `x-admin-key` (demo). Production: real auth, per-org
  admin scopes, audit log.

## v4 — AI proxy (`src/modules/ai/`)
The app never calls Anthropic directly and never holds a key. Four endpoints
mirror the app's call sites — `welcome`, `route`, `ask`, `insight` — each with a
strict input allowlist (categorical answers and aggregates only; unknown fields
are dropped, never forwarded), a per-IP rate limit, a system prompt that forbids
diagnosis and dosing and requires an urgent flag for red-flag symptoms, and a
deterministic fallback. With `ANTHROPIC_API_KEY` set the proxy calls Claude
(`claude-opus-5-5` by default, structured JSON output, server-side refusal
fallback on); without it, or on any API error, the fallback answers with
`provider: "rules"` so the app keeps working. `npm run smoke:ai` exercises both
paths against a mock Anthropic endpoint. Set `CORS_ORIGIN` to the app's origin.

## v4 — Social sign-in (`src/modules/oauth/`)
Real authorization-code OAuth for Apple, Google and Facebook, with node:crypto
only. `GET /api/oauth/providers` says which are configured; `GET
/api/oauth/:provider/start?return=<app URL>` redirects to the provider with a
signed, expiring state (nonce, PKCE verifier, return URL); the callback
exchanges the code, verifies the id_token (signature against the provider's
JWKS, issuer, audience, expiry, nonce — Facebook uses `appsecret_proof` and
`/me` instead), then redirects back to the app with a one-time handoff code;
`POST /api/oauth/exchange {code}` returns `{provider, email, emailVerified,
name}` exactly once. The server keeps no account record: the identity waits in
memory for at most five minutes until the device collects it. Return URLs are
limited to `CORS_ORIGIN`. Credentials: `APPLE_CLIENT_ID / APPLE_TEAM_ID /
APPLE_KEY_ID / APPLE_PRIVATE_KEY`, `GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET`,
`FACEBOOK_APP_ID / FACEBOOK_APP_SECRET`; the callback URL to register with each
provider is `<PUBLIC_BASE_URL>/api/oauth/<provider>/callback`. An unconfigured
provider answers 503 — the app never fakes a login. `npm run smoke:oauth` runs
the whole flow against a local mock provider.

## v4 — Pulse aggregates (`src/modules/pulse/`)
"You're not alone" counts with k-anonymity. An opted-in device posts
`POST /api/pulse/tally {stage, token, events}` — the stage, a few allowlisted
event flags for the week, and a random weekly token used only to de-duplicate
in memory (never written to disk; the week's sets are dropped as weeks roll
over). What persists is counts per (week, stage, event). `GET /api/pulse?stage=`
returns each event's count only once at least `pulse.k` (default 50) distinct
contributors reached it, otherwise `null`. Per-IP rate limit on tallies.
`npm run smoke:pulse` checks suppression, de-duplication, the threshold, and
that the on-disk store holds counts only.

## v4 — Reminders (`src/modules/push/`)
Browser reminders use standard Web Push (VAPID, aes128gcm). The store keeps the
browser's push subscription, cadence, nudge time and timezone, plus the last
day a reminder went out — never a name, never health data. A scheduler pass
runs every minute and sends one generic "Time for your 30-second check-in" at
most once per day, inside a 30-minute window at the chosen local time, only on
the cadence's days (daily / weekdays / Mon-Wed-Fri / Mondays; "when I feel
like it" and "never" send nothing). A 404/410 from the push service drops the
subscription. There is no SMS anywhere. The phone build does not use this
module: it schedules local notifications on the device. Generate keys once with
`npm run vapid` and set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
`npm run smoke:push` checks the scheduling rules and delivers a real encrypted
push to a local HTTPS mock push service.
