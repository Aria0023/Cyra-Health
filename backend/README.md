# Cyra Health — Backend (reference implementation)

A modular Node/Express service for the Cyra app. It runs anywhere Node 18+ runs
and needs no external service to start. The integrations you configure send data
to third parties: Anthropic (Ask Cyra's AI, only for people who turn it on),
Apple, Google and Facebook (sign-in), Oura and Terra (wearables), and the
browsers' push services (web reminders). `render.yaml` configures all of them.

## Two modes

| | `NODE_ENV=production` (Render) | anything else (local, demos) |
|---|---|---|
| Config file | `config/app.json` | `config/app-dev.json` |
| Modules mounted | `oauth`, `integrations`, `pulse`, `push`, `ai` — only what the shipped app calls | every module in `src/modules/` |
| Partner/referral demo, `/r/:code`, FHIR, orgs, users, auth, agent, affiliates, catalog, payouts, reports | not mounted (404) | mounted |
| Ops console at `/` | not served | served (`public/index.html`) |
| `ADMIN_KEY`, `AUTH_SECRET` | from the environment only; the server **refuses to start** (exit 1) when either is unset, a demo/placeholder value, shorter than 16 characters, or both are equal | environment, else the demo values in `config/app-dev.json` |

`CYRA_CONFIG=<file>` points at another config file in either mode (the smoke
tests use it). The start-up message names the variables at fault, never their
values; no module logs a secret. No production module uses `ADMIN_KEY` today
(it gates the admin routes of the development-only orgs/users/affiliates
modules), but the guard still requires a real one so a later config change
can't silently fall back to a demo key.

## Run it
    npm install
    node server.js                 # development: every module -> http://localhost:3000
    node scripts/smoke.js          # referral demo end to end (in a second terminal)
    BASE=http://127.0.0.1:3290 node scripts/smoke.js   # against another port
    npm run smoke:all              # ai, oauth, integrations, pulse, push and the production guard

Production on Render: set these in Render → cyra-backend → Environment (names
as in `.env.example`; never commit values): `ADMIN_KEY`, `AUTH_SECRET`
(required; generate each with `openssl rand -hex 32`), `ANTHROPIC_API_KEY`,
`APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_APP_ID`,
`FACEBOOK_APP_SECRET`, `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET`, `TERRA_DEV_ID`,
`TERRA_API_KEY`, `TERRA_SIGNING_SECRET`, `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. A sign-in, wearable or push integration
whose variables are unset answers 503 — the app never fakes it; without
`ANTHROPIC_API_KEY`, Ask answers from the deterministic library.

## Status
`render.yaml` deploys this backend with `NODE_ENV=production`, and the shipped
app sends it live traffic. In place: HTTPS via Render; per-address rate limits
on `/api/ai/ask`, `/api/pulse/tally` and `POST /api/push/subscribe` (which also
takes only browser push-service endpoints and caps its rows); provider secrets
from the environment; the start-up guard above; only the five modules the app
calls are mounted.
Not yet in place: a database or encrypted disk (`data/pulse.json` and
`data/push.json` are plain JSON on the instance disk — on Render without a
persistent disk, until the next deploy or restart; `DATA_DIR` moves them to a
disk's mount path once one is attached), audit logging and monitoring. Render's own request logs (paths, times, client addresses) are
outside this code.

This service already handles consumer health information: the text of Ask
questions people choose to send to Cyra's AI, the life stage and yes/no flags
in opt-in weekly counts, Oura readings in transit and Terra readings held in
memory. Counsel should confirm which consumer-health-data laws apply; the
privacy policy's promises (encryption at rest, access controls, monitoring)
must be implemented before launch. Turning on in-platform telehealth booking or
a clinical/health-plan integration (the `fhir` and partner `webhooks` modules)
would also need a HIPAA business-associate review: BAA, encryption at rest,
audit logging, access controls.

## Endpoints
Production (and development):

    GET  /health
    POST /api/ai/ask                                       (AI proxy; see below)
    GET  /api/oauth/providers    GET /api/oauth/:provider/start?return=    GET|POST /api/oauth/:provider/callback    POST /api/oauth/exchange
    GET  /api/integrations/sources
         oura:  GET /start  GET /callback  POST /exchange  POST /refresh  POST /pull  POST /revoke
         terra: POST /session  GET /done  POST /webhook  POST /inbox  POST /disconnect  POST /disconnect-legacy
    GET  /api/pulse              POST /api/pulse/tally
    GET  /api/push/vapid         POST|DELETE /api/push/subscribe

Development only (not mounted with `NODE_ENV=production`):

    GET  /api/partners                 GET /api/partners/:id
    POST /api/referrals/link           GET /api/referrals/:code
    GET  /r/:code                      (redirect + click tracking)
    POST /api/webhooks/:partnerId      (HMAC x-cyra-signature)
    GET  /api/payouts?from&to          GET /api/reports/partners/:id
    GET  /api/catalog?stage=peri
    /api/agent, /api/orgs, /api/users, /api/auth, /api/fhir, /api/affiliates

## Architecture
- **Modular** — every feature is a module in `src/modules/`, loaded from the
  `modules` list of the active config file (see *Two modes*). Remove a name and
  the feature's routes cease to exist. Add your own module the same way.
- **Swappable storage** — `src/core/store.js` defines a 6-method adapter
  (`insert`, `find`, `findOne`, `update`, `remove`, and `apply` for an
  all-or-nothing change to a collection); a JSON-file store ships as
  default. Implement the same interface for Postgres and change
  `storage.driver` in config.
- **Short-lived memory** — `src/core/memory.js`: rate limits keyed by a salted
  hash of the client address (the salt changes every UTC day; an entry is
  dropped about a minute — 60 to 65 seconds — after its last request), and
  one-time handoff codes that a timer deletes when they expire, whether or not
  anyone collects them (Oura tokens that were never delivered — expired,
  collected too late, or refused for a missing or wrong verifier — are then
  revoked at Oura, and so are any still waiting when the server gets SIGTERM;
  best effort: if Oura's revoke fails or the server crashes before expiry, the
  grant stays until the person removes Cyra in their Oura account).

## Partner/referral demo (development only)
Plug-and-play partners: a partner is one JSON file in `config/partners/`. Drop
in a file and referral links, webhooks, payouts, reports and the catalog pick it
up on restart. Fee model (`new_patient_bounty`, `per_visit_fee`,
`commission_pct`), attribution window, landing URL, ref param, shelf card and
life stages are per partner. The shipped app calls none of this, and none of it
is mounted in production.
1. A caller requests `POST /api/referrals/link {userRef, partnerId}`. The server
   stores `userRef` as given, so it must be an opaque, client-generated hash.
2. `GET /r/:code` logs the click and 302s to the partner with the code.
3. Partners POST events signed with HMAC-SHA256 over the raw body, using a
   per-partner secret, to `POST /api/webhooks/:partnerId`: the first
   `conversion` per patient hash is a **new patient** (bounty fires once); later
   `visit` events accrue to per-visit fees and aggregate reports. The secrets in
   `config/partners/*.json` are demo placeholders; a real one comes from
   `PARTNER_<ID>_WEBHOOK_SECRET` (e.g. `PARTNER_MIDI_WEBHOOK_SECRET`), and if
   `webhooks` is ever added to the production config, the server refuses to
   start until every partner has a real one.
4. `GET /api/payouts?from&to` = invoice basis. `GET /api/reports/partners/:id`
   = an aggregate-only report (counts, no identities).

## Wearable integration hub (`src/modules/integrations/`) — minimal server retention
One per-day row for every source: `{ date, temp (°C deviation), rhr, hrv, sleep }`.
- **Apple Health / Health Connect** — read *on the device* by the app's native
  bridge (Capacitor plugin `CyraHealth`: `available()`, `requestAuthorization()`,
  `readDaily({from,to})`). The server never sees it.
- **Oura (API v2, user OAuth)** — `GET /oura/start?return=` sends the person to
  Oura; the callback hands a one-time code to the app; `POST /oura/exchange`
  returns the tokens **to the device**, which keeps them. Until then the server
  holds them in memory under that code, deleted by a timer 5 minutes after the
  callback whether or not the device collects them. Tokens nobody collected are
  revoked at Oura when the 5 minutes run out, when a redemption is refused
  (missing or wrong verifier), or when the server shuts down (SIGTERM, e.g. a
  deploy) — best effort: if Oura's revoke fails, the server crashes, or the
  exchange answer never reaches the device, a grant can stay, so if a connect was
  interrupted, check Oura's connected apps and remove Cyra there. The only scope
  asked for is `daily`. `POST /oura/pull
  {access_token, from, to}` fetches Oura's readiness and sleep records for at
  most 30 calendar days, keeps only temperature, resting heart rate, HRV and
  sleep score, returns those — and stores nothing; `POST /oura/refresh` uses the server-held client secret (the refresh
  token passes through the server on each refresh); `POST /oura/revoke
  {access_token[, refresh_token]}` asks Oura to revoke Cyra's access (refreshing
  first if the access token has expired) and answers `{ok: true}` only when Oura
  confirms.
- **Terra (Fitbit, Garmin, Whoop, …)** — the device makes a secret mailbox
  `key` (32 random bytes, base64url) and sends it only in request bodies. The
  server derives `ref = base64url(sha256("terra:" + key)).slice(0, 32)` and gives
  Terra that ref as the connection's `reference_id`: `POST /terra/session {key,
  return}` → `{url}` (Terra's widget, limited to `TERRA_PROVIDERS`, default
  `FITBIT,GARMIN,WHOOP`, the three the app names). Terra's signed webhooks
  (`terra-signature`, HMAC over `t.body`, 5-minute window) are normalized into an
  **in-memory mailbox** under the ref, never written to disk; each row is deleted
  no later than 7 days after it first arrived (later updates to the same day
  don't extend it): a sweep runs every minute and removes a row once the next
  sweep would come after its 7 days. The device collects with `POST /terra/inbox
  {key}`, which empties the mailbox. Terra appends `reference_id` (and its
  `user_id`) to the `/terra/done` redirect, so the ref can appear in browser
  history and request logs. For connections made by this version the ref opens
  nothing: collecting and disconnecting need the key. A connection made by the
  older app version can still be ended, but never read, with its ref through
  `/terra/disconnect-legacy`. The done page — and the error page for an expired
  or invalid link — never echoes Terra's query and removes it from the address
  bar. `POST /terra/disconnect {key}` looks the connection up at Terra by its
  ref, asks Terra to deauthenticate it, and empties the mailbox (as soon as the
  disconnect is asked for, even if Terra then doesn't confirm; the app collects
  what is waiting first). Until you
  disconnect, Terra keeps the connection and keeps sending data. Disconnect asks
  Terra to deauthenticate it; any data Terra already holds stays under Terra's
  own policy. `POST /terra/disconnect-legacy {ref}` does the same for a
  connection made by the older app version, whose device-held secret was the
  ref itself (32 lowercase hex); a current (base64url) ref is refused there.
  Terra's full webhook payloads are parsed in memory (up to 5 MB each). From each
  one the server keeps only the connection's ref (`reference_id`), which the rows
  are filed under, and each day's date, temperature, resting heart rate, HRV and
  sleep (plus the server's own first-arrival time). Everything else in the
  payload, including Terra's user_id, is dropped when the request ends. A body
  that can't be parsed is refused with 400 and only the error type is logged.

`GET /sources` reports what this server can serve. Credentials: `OURA_CLIENT_ID /
OURA_CLIENT_SECRET`, `TERRA_DEV_ID / TERRA_API_KEY / TERRA_SIGNING_SECRET`
(optional `TERRA_PROVIDERS`, default `FITBIT,GARMIN,WHOOP`);
register `<PUBLIC_BASE_URL>/api/integrations/oura/callback` with Oura and
`<PUBLIC_BASE_URL>/api/integrations/terra/webhook` with Terra. `npm run
smoke:integrations` runs both flows against local mocks.

## AI proxy (`src/modules/ai/`)
The app never calls Anthropic directly and never holds a key. One endpoint is
mounted: `POST /api/ai/ask {question[, stage]}`. The app answers from its
on-device evidence library first and calls this only when the person has turned
on "Also ask Cyra's AI when the library has no answer" and the library has no
match. The question is forwarded to Anthropic verbatim (trimmed to 500
characters) — free text carries whatever she typed; the app sends no stage, and
a stage, if a caller sends one, must be one of a fixed list of labels. Unknown
fields are dropped, never forwarded. Nothing is stored; the per-address rate
limit (20 a minute) keeps only a salted hash of the address, for about a minute
(60-65 s).
The system prompt forbids diagnosis and dosing and requires an urgent flag for
red-flag symptoms. With `ANTHROPIC_API_KEY` set the proxy calls Claude
(`claude-opus-5-5` by default, structured JSON output, server-side refusal
fallback on) with one attempt and a 12-second limit, inside the app's
15-second wait; without a key, or on any API error, timeout or refusal, the
deterministic library answers with `provider: "rules"`. Anthropic keeps what it
receives under its own terms. `welcome`, `route` and `insight` are no longer
mounted (404): the app makes its welcome and life-stage routing on the device.
`npm run smoke:ai` exercises both paths against a mock Anthropic endpoint. Set
`CORS_ORIGIN` to the app's origins.

## Social sign-in (`src/modules/oauth/`)
Real authorization-code OAuth for Apple, Google and Facebook, with node:crypto
only; it fills in the registration form on the device — there are no accounts.
`GET /api/oauth/providers` says which are configured; `GET
/api/oauth/:provider/start?return=<app URL>` redirects to the provider with a
sealed, expiring state (AES-256-GCM, key derived from `AUTH_SECRET`) that
carries the nonce, PKCE verifier, return URL and app challenge, so no one can
read the verifier or change any of them in transit. The nonce is also sent to
the provider, as OpenID Connect requires, and the return URL and app challenge
are also in the `/start` request's own query, so request logs can record them.
None of the three is a secret. The app challenge is useless without the app's
verifier, which stays on the device and is sent only in its exchange call. The
separate PKCE verifier stays inside the sealed state until the server sends it to
the provider's token endpoint. The callback exchanges the code and verifies the
id_token (signature against the provider's JWKS, issuer, audience, expiry,
nonce); Facebook uses `appsecret_proof` and `/me?fields=name,email` instead.
The provider sends Cyra's server the name, email and an account id; `POST
/api/oauth/exchange {code}` returns only `{provider, email, emailVerified,
name}`, exactly once. The email is included only when Google or Apple say it is
verified; Facebook gives no such signal, so its email is never passed on
(`email: ""`, `emailVerified: false`). Account ids, tokens and other claims are
dropped as soon as the callback has read them; a failed sign-in logs only the
provider and a fixed category, never text the provider sent. The server keeps no account
record: the identity waits in memory under the one-time code, deleted by a timer
5 minutes after the callback whether or not the device collects it. Return URLs
are limited to `RETURN_ORIGINS` / `CORS_ORIGIN` and the app link below.
Credentials: `APPLE_CLIENT_ID / APPLE_TEAM_ID / APPLE_KEY_ID /
APPLE_PRIVATE_KEY`, `GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET`, `FACEBOOK_APP_ID
/ FACEBOOK_APP_SECRET`; the callback URL to register with each provider is
`<PUBLIC_BASE_URL>/api/oauth/<provider>/callback`. An unconfigured provider
answers 503 — the app never fakes a login. `npm run smoke:oauth` runs the whole
flow against a local mock provider.

## Pulse counts (`src/modules/pulse/`)
"You're not alone" weekly counts with a display threshold. A device whose owner
turned on "Share anonymous weekly counts" posts `POST /api/pulse/tally {stage,
events}` normally once a day at most — the life stage and a few yes/no event ids from
that stage's allowlist (peri: `hf`, `ns`, `rough_night`; periods: `crm`,
`mood_dip`, `heavy_day`; preg: `nau`, `kicks`, `swl`). The body must be exactly
that: a token, a date or any other field is refused (400). There is no token and
no de-duplication on the server. The server counts a tally in one write, so an
error answer never follows a partial count. The app keeps it to one tally a day
and each event at most once a week from that browser or phone app install: in a
browser it sends inside a Web Lock that every tab shares (a browser without Web
Locks sends none), re-reads its stored record first, and writes "sent" (and the
day, plus a week-only marker that outlives Delete everything and Start over) to
the device before the request, and sends nothing if sharing was turned off or a
delete started meanwhile; it treats any answer except a refusal (4xx) as
counted. So a reload, a second tab, a delete racing the send or a server error
can't make it repeat a flag that week; removing the app or clearing the site's
data resets that. What persists is
counts per (week, stage, event) in `data/pulse.json` — nothing else in Cyra's
code (the hosting provider's own request logs, outside this code, can show that
an address posted a tally). `GET /api/pulse` takes no stage (a `stage` query is
refused) and returns every stage's counts for the last closed ISO week, `{week,
k, stages}`, so loading them tells the server nothing about the reader's life
stage or health — only what any request carries (IP address, user agent, which
app or site it came from) — and no single contribution can be watched arriving. A count stays `null`
until at least `pulse.k` (default 50) contributions are counted — a display
threshold on contributions, not proof of 50 distinct people (contributions
aren't attested). Rate limits on tallies: 30 a minute per address (salted hash,
kept about a minute, 60-65 s) and 600 a minute overall. `npm run smoke:pulse` checks the
read, the threshold, the strict tally and that the disk holds counts only.

## Reminders (`src/modules/push/`)
Browser reminders use standard Web Push (VAPID, aes128gcm). While reminders are
on, the store keeps one row per browser: the push subscription (endpoint and
keys, with a hash of the endpoint as the row id), cadence, nudge time, time
zone, and the last day a reminder went out — never a name, never health data.
Turning reminders off (`DELETE /api/push/subscribe`, or a subscribe whose
cadence or time sends nothing) deletes the row when the request reaches the
server. Before sending it, the app cancels the browser's subscription — so
nothing more is shown — and saves the off switch, with the address still to
forget, on the device. If the DELETE can't land (offline, server down, an error
answer), the app sends it again at launch, when the browser comes back online or
the app comes back on screen, and on a timer while it is open, until the server
confirms; meanwhile a send to that address gets a 404/410 from the push service,
which deletes the row too. Delete everything deletes the record on the device
only after the server has confirmed every step (or the person chooses to delete
anyway, and is told the address, keys, schedule and time zone stay until the push
service reports the address gone); a wearable whose disconnect the server already
confirmed is removed from the device even if another step failed, and the card
says so. A scheduler pass runs every minute (passes never overlap) and
sends one generic "Time for your 30-second check-in" at most once per local day,
inside a 30-minute window at the chosen time, only on the cadence's days (daily
/ weekdays / Mon-Wed-Fri / Mondays; "when I feel like it" and "never" send
nothing). Re-subscribing or changing the time keeps the day's last-sent date,
and a row first created inside its own send window (for example re-created
after a restart lost the store) skips that day, so a day never gets a second
reminder. There is no SMS
anywhere. The phone build does not use this module: it schedules local
notifications on the device. Generate keys once with `npm run vapid` and set
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. `npm run smoke:push`
checks the scheduling rules, the deletions and the once-a-day guarantee, and
delivers a real encrypted push to a local HTTPS mock push service.

## Phone app returns (`src/modules/oauth/returns.js`)
The iOS/Android app runs sign-in and Oura/Terra connections outside its web view
and comes back through its own link, `cyrahealth://auth/<oauth|oura|terra>?a=<attempt>`.
`APP_RETURN_SCHEMES` (comma list, default `cyrahealth`) names the schemes accepted
as return URLs besides the `CORS_ORIGIN` web origins. An app return must match
exactly: lowercase scheme, `auth` host, the flow's path, optional `?a=`, and no
`#`; `javascript:`, `data:`, `file:` and every other scheme are refused. Because
another installed app could claim the same scheme, a sign-in or Oura app return
must carry `app_challenge` = base64url(SHA-256(verifier)) on `/start`; the
challenge is sealed into the state and bound to the handoff, and `POST
/api/oauth/exchange` / `POST /api/integrations/oura/exchange` then require
`{code, verifier}`. Terra's start takes no challenge: its return carries no code
(`#terra=1`), and its data is collected only with the device's key. Web flows
send no challenge. The callback pages only `postMessage` to http(s) openers; for
app returns they redirect straight to the app link.

## Development-only modules
- **Agent (`src/modules/agent/`)** — task + shared tool registry + pluggable
  reasoning provider (`providers/rules.js`, deterministic, the default;
  `providers/anthropic.js`, a Claude tool-use loop: set `ANTHROPIC_API_KEY` and
  `agent.provider: "anthropic"` in `config/app-dev.json`). `POST /api/agent/run`
  passes the posted task object to the provider as given — with the Anthropic
  provider, to Anthropic — and has no authentication, so it must only ever be
  given opaque userRefs and aggregates. Not mounted in production.
- **Orgs, users, auth (`src/modules/orgs|users|auth/`)** — white-label org
  config, a user control plane (`userRef`, org, role, status, createdAt, stored
  as given: `userRef` must be an opaque id, never an email) and demo org-scoped
  tokens. Admin writes are gated by a single shared `x-admin-key`; there is no
  per-org admin scope, audit log or real authentication. The shipped app calls
  none of these. Not mounted in production.
- **FHIR (`src/modules/fhir/`)** — builds FHIR R4 Bundles and records simulated
  pushes in an outbox readable without authentication. Not mounted in
  production; see *Status* before ever enabling it.
