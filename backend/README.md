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

## Before production
Reference implementation — before real traffic add: TLS + auth on admin
routes, real secrets management (not JSON files), Postgres storage adapter,
idempotency keys on webhooks, rate limiting, and monitoring. If/when you move
to in-platform telehealth booking, this service enters HIPAA scope: BAA,
encryption at rest, audit logging, access controls.

## v2 — Open architecture additions

### Wearable integration hub (`src/modules/integrations/`)
One normalized metric schema; each source = one config file + one adapter:
- **healthkit** — app reads HealthKit/Health Connect on-device, pushes normalized
  samples (covers Oura, Fitbit, Garmin, Whoop, Samsung via the OS — preferred path)
- **oura** — Oura API v2 direct (user OAuth)
- **terra** — aggregator payloads (one adapter, dozens of wearables)
Add a wearable: drop `config/integrations/x.json` (+ adapter if the shape is new).

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
