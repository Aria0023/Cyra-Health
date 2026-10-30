# Heard Health

*I am Heard.*

Heard Health (formerly Cyra; renamed 2026-10-30) is a calm, low-pressure companion for women's health: a cycle and symptom tracker that finds patterns in her own
log and turns them into plain-language notes and a doctor-ready PDF. One life-stage experience at a time — My
Cycle, Trying to conceive, Pregnancy, Perimenopause, Menopause & beyond — with optional condition modules (PCOS,
POTS; hair loss is the next slot). Guest first: no account to start, and the health log stays on the device.
Guidance only, never diagnosis or medical advice.

**What's in the app**
- Five tabs and a "+" log sheet: **Home** (cycle day in a ring, Today's small step, Quick log tiles, Body and Mind
  progress, your patterns), **Body** (fast log, calendar, cycles, PCOS signals and lab values she types in),
  **Mind** (mood check-in, 2–5 minute practices with their evidence and sources, journal and Ask Heard Health), **Patterns**
  (cycle timeline, Body and Mind rings in words, pattern cards, the weekly review with one optional experiment,
  the Report and PDF) and **You** (stage, privacy and your data, modules, plan, reminders, appearance, Heard Health's AI,
  account, support & care, about).
- Tone rules: no streaks, scores, grades or failure language; empty states say "A few more logs will show clearer
  associations"; practices are "wellbeing support, not treatment".
- Free core forever (logging, calendar, cycles, patterns, weekly review, the basic PDF). Pro (store purchase, not
  wired to a store yet) adds the full practice library and Heard Health's AI write-up and chat; see docs/MONETIZATION.md.
- Language support: every screen string goes through `t()` (src/lib/i18n.js) with an English catalogue
  (src/locales/en.js). Dates and numbers are formatted with Intl, `<html lang>`/`dir` follow the language. Only
  English ships, so the You → Language picker stays hidden until a second complete catalogue is added.
- Light and dark mode, installable (PWA, opens offline), and iPhone / Android shells (Capacitor).

## Privacy
The health log (check-ins, journal, appointments, medications, the answers given at
sign-up, and wearable readings once they reach the app) is stored only on the device: in
IndexedDB in the browser, and in one file in the app's private storage on iPhone and
Android, marked to be left out of iPhone backups and excluded from Android backup and
device transfer. The welcome sentence and the choice of life-stage experience are made on
the device. What can leave it, when a backend is configured (`VITE_API_BASE`) and the build
offers the feature (`VITE_FEATURES`; the default build offers only Ask Cyra's AI and web
reminders, so it makes no request at launch). Each item names its flag:

- **Each launch, no health data** (`counts`): once a life stage is set, one request for last week's
  anonymous counts. It carries no life stage or identifier, only what any request carries
  (IP address, user agent).
- **"Share anonymous weekly counts"** (`counts`; off until ticked; can be turned off in Settings,
  which is saved on the device before it is confirmed and stops it in every open tab): the
  life stage group and yes/no flags (cramps, a heavy-flow day, mood swings before a predicted
  period; hot flashes, night sweats, a poor night's sleep; nausea, swelling, baby's kicks)
  from the day's check-in as last saved (a quick check-in adds only sleep and flow flags),
  sent at most once a day and never on the day they were logged, with no token, account,
  dates or values. Each flag goes at most once a week from this browser or phone app
  install: in the browser, the send runs inside a Web Lock shared by every tab (the phone app
  has a single web view; a browser without Web Locks sends none), "sent" is written to the
  device before the request, and a server answer other than a refusal counts as sent. Each
  send also leaves a week-only marker (only the week, kept until that week is over), so a new
  record made on this device that week — after Delete everything or Start over — sends
  nothing again. Removing the app or clearing this site's data resets that. The server
  counts each tally in one write and keeps only weekly totals (its rate limiter holds a
  salted hash of the client address in memory for about a minute); it shows a number once
  50 or more contributions are in.
- **"Also ask Cyra's AI"** (`ai`; off by default, per device): Ask Cyra answers from an evidence
  library on the device first. Only when this is on and the library has no answer does the
  typed question go to Cyra's server, with no life stage, name or log. The server forwards
  the text as typed to Anthropic, which keeps it under its own terms (a server without an
  Anthropic key answers from the same library instead).
- **Cyra's weekly write-up and chat** (`ai`, Pro, both off until she turns them on in You → Cyra's AI): each
  send first opens "What Cyra will send", which shows the exact request body. It holds the question (chat) and a
  pseudonymized summary of her last 8 weeks (counts, averages, cycle-day buckets; no dates, notes, name, email,
  ZIP or free text); lab values only if she ticks "Include lab values". Nothing goes until she taps Send. Cyra's
  server forwards it to Anthropic and keeps none of it (docs/PRIVACY-AUDIT.md "Calm R8" lists the fields).
- **Oura** (`wearables`; connected only after a disclosure and Continue): the device keeps the Oura
  tokens. While connecting, the server holds them in memory for at most 5 minutes until the
  device collects them (Cyra's server asks Oura to revoke tokens nobody collects, also when a
  collection is refused or the server shuts down; this is best effort, so if a connection
  doesn't finish, remove Cyra in your Oura account). Each sync sends the
  token to Cyra's server, which fetches 30 calendar days of Oura readiness and sleep
  records, keeps only temperature, resting heart rate, HRV and sleep score, and passes those
  back without storing them.
- **Fitbit, Garmin, Whoop through Terra** (`wearables`; same disclosure first; Terra's window offers only
  these three): Terra, a health-data service, keeps the device connection and its data under
  Terra's own policy and sends Cyra's server its updates; the server keeps only temperature,
  resting heart rate, HRV and sleep. Those readings wait in the server's memory, unencrypted
  and never on disk, for up to 7 days (a sweep removes each one before its 7 days are up). The server hands them over only to a request carrying the random secret key
  kept on the device (and in any encrypted backup she saves), and deletes them as soon as it
  hands them to the app (on launch, on return to the app, and on Sync). Disconnect and Delete
  everything collect what is waiting first, then end the connection.
- **Social sign-in** (`signin`; optional; Apple, Google, Facebook): the provider learns that this
  account is signing in to Cyra. Cyra's server passes the name and, only when Apple or
  Google says it is verified, the email to the device through a one-time code that a timer
  deletes after 5 minutes. No account is kept. Anonymous Mode and email registration send
  no name or email.
- **Reminders** (off until turned on): on the phone they are local notifications and
  nothing is sent, in every build. On the web (`webReminders`), Cyra's server keeps the browser's push subscription (address
  and encryption keys), the reminder days, time, time zone and last day sent, never a name
  or health data, and deletes them when reminders are turned off. Turning them off cancels
  the browser's subscription at once and saves the off switch (with the address still to
  forget) on the device before anything is sent; if the server can't be reached, the app
  keeps asking it to delete the row (at launch, when the browser is back online or Cyra is
  back on screen, and on a timer while Cyra is open) until it confirms (unless you then
  choose Delete on this device anyway or clear this site's data). Every open tab follows the
  same switch. The browser's push service delivers the reminders (for example Google's for
  Chrome, Mozilla's for Firefox, Apple's for Safari or Microsoft's for Edge).
- **Offline copy (web):** the browser keeps Cyra's own app files (no health data, no server
  answers) so Cyra opens without a connection; Delete everything removes it. The service
  worker that keeps them asks only the site that serves Cyra for those files and for updates
  to itself, and is registered only while a record exists, never in the phone app.

Never sent by Cyra: Apple Health and Health Connect readings (read on the phone; they leave
it only inside an encrypted backup the person exports herself). The **encrypted backup** is a
file the person saves herself (a download on the web, the share sheet on the phone),
encrypted with her passphrase; Cyra never receives it. [cloudBackup] A build with the
`cloudBackup` flag and a server also offers an optional account (Pro; calm R9): her record,
encrypted on her device, is kept on Cyra's server under a hash of her email and a hash of a
write token derived from her passphrase; never the email, the passphrase or the key
(docs/ARCHITECTURE.md §10.5a). The default build has no such flag and production doesn't
mount the module. Fonts are bundled, and there is no
analytics, advertising or tracking code. **Delete everything** asks Cyra's server to remove
the reminder subscription and, in a build with wearables, disconnect Oura and Terra (collecting
Terra's waiting readings first), and deletes the record on the device only after the server has confirmed every step:
if one can't be confirmed, the app says which step failed and why, and what already ended (a
connection the server did end is removed from the device), and offers Try again or "Delete on
this device anyway" (which says what stays connected and where to remove it). Then it removes
the on-device record and cancels reminders; if this device shared counts this week, only the
week-only marker above stays, until that week is over. Counts
already shared stay counted, and data that Terra, Oura or Anthropic already received
follows their own policies. Without `VITE_API_BASE` there is no backend, and none of the data above is
sent; a feature that isn't in `VITE_FEATURES` shows nothing and sends nothing either (a record from
a build that had it keeps its data, which this build doesn't show or contact).

## Run
    npm install
    npm run dev                      # the app at http://localhost:5173
    npm run build                    # production build into dist/ (the splash shows BUILD 2026.10.07-D)
    cd backend && npm install && npm start    # the backend at http://localhost:3000 (optional)

`VITE_FEATURES=all VITE_API_BASE=http://localhost:3000 npm run dev` (with the backend running; in development it
mounts every module) shows every optional feature locally. Unset, the app offers the shipping defaults: Ask
Cyra's AI and web reminders (`.env.example`, docs/ARCHITECTURE.md §10). `VITE_DEMO_SEED=true` starts with 75 days
of illustrative history (demo builds only). `VITE_FEATURES=devGallery` adds the design-system gallery at `#/dev/ui`.

## Tests
    npm run test:unit                # unit tests for everything in src/lib (node --test)
    cd backend && npm run smoke:all  # backend smoke tests: ai, oauth, integrations, pulse, push, backup, account, prod

The end-to-end suites (Playwright against built copies of the app: native shell, web, feature flags, POTS, AI,
account) live outside the repo with the release tooling; every release runs them with an axe accessibility audit
in light and dark.

## Deploy
Static site on Render: build `npm install && npm run build`, publish `dist`.
`render.yaml` configures it automatically via Blueprint.

The build also writes the installable-app pieces: `manifest.webmanifest` and `icons/` are
copied from `public/`, and `sw.js` gets this build's file list and version (vite.config.js,
`cyraServiceWorker`; spec A14.1). The icons are committed PNGs drawn from the master mark in `docs/brand/`; regenerate them, and
the native icon sets, with `node scripts/make-icons.mjs` then `python3 scripts/flatten-icons.py` (headless
Chromium via an installed Playwright, not an npm dependency; run from the repo root). `render.yaml`
sets `Cache-Control: no-cache` for `/`, `/index.html`, `/sw.js` and `/manifest.webmanifest` so
browsers revalidate them; hashed `/assets/*` keep the host default.

## Phone apps (iOS / Android)
    VITE_API_BASE=https://cyra-backend.onrender.com npm run cap:ios       # builds, syncs and opens Xcode
    VITE_API_BASE=https://cyra-backend.onrender.com npm run cap:android   # builds, syncs and opens Android Studio
    npm run cap:sync                                                      # build + copy into both shells

The shells are in `ios/` and `android/` (Capacitor; `capacitor.config.json`). Step-by-step guide (signing,
HealthKit, Health Connect, the `cyrahealth://` return link, server settings, and what has and hasn't been
verified): `docs/NATIVE.md`.

## Render environment variables
Paste values under each service's **Environment** tab in Render (never commit them; `.env.example` is the
template with a note on each). Names only:

- **Backend (web service `cyra-backend`)**: `ANTHROPIC_API_KEY` (Cyra's AI; without it the AI features say
  they aren't set up and Ask answers from the library), `AI_MODEL` (optional), `CORS_ORIGIN`, `RETURN_ORIGINS`
  (optional), `NODE_ENV` (set by render.yaml), `APP_RETURN_SCHEMES`, `ADMIN_KEY`, `AUTH_SECRET`,
  `PUBLIC_BASE_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (web reminders), `DATA_DIR`
  (a persistent disk; needed before turning on accounts / cloud backup). Only when sign-in or wearables are
  turned on: `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET`,
  `TERRA_API_KEY`, `TERRA_DEV_ID`, `TERRA_SIGNING_SECRET`. `ANTHROPIC_BASE_URL` is for tests only; leave it unset.
- **Static app (static site `cyra-health`, build time, public)**: `VITE_API_BASE` (set by render.yaml),
  `VITE_FEATURES` (unset = shipping defaults), `VITE_TERMS_URL`, `VITE_PRIVACY_URL`. `VITE_DEMO_WEARABLES` and
  `VITE_DEMO_SEED` are for demo builds only; leave them unset in production.

## Docs
- `docs/CYRA-BUILD-SPEC.md` — complete product + technical spec (normative)
- `docs/ARCHITECTURE.md` — local-first architecture: where the record is stored, its keys and version, derived data, flags and plan hooks
- `docs/MONETIZATION.md` — the free core, paid extension points (none active) and the privacy rules any paid feature must follow
- `docs/NATIVE.md` — building and running the iPhone and Android apps
- `docs/PRIVACY-AUDIT.md` — every privacy sentence in the app and why it is true, slice by slice
- `docs/EVIDENCE.md`, `docs/CLINICIAN-REVIEW.md` — the sources behind practices and PCOS copy, and what awaits clinician sign-off
- `docs/Cyra-Legal-Documents.docx` — privacy policy, terms, research consent (drafts)
- `CLAUDE.md` — working instructions for Claude Code
- `backend/README.md` — backend architecture and endpoints

## Status
Build 2026.10.07-D. The default build (`VITE_FEATURES` unset) offers Ask Cyra's AI and web
reminders, and the production backend mounts only those two modules (push and ai). A
`VITE_FEATURES=all` build adds social sign-in (Apple, Google, Facebook), Oura and
Fitbit/Garmin/Whoop (through Terra) sync and the weekly counts: real integrations that go
through the Cyra backend once its config lists their modules and their keys are set; Apple
Health and Health Connect are read on the phone (with `wearables`). Demo data appears only in builds made with `VITE_DEMO_WEARABLES=true`
(illustrative wearable readings, labeled as such in the Wearables panel) or
`VITE_DEMO_SEED=true` (75 days of illustrative symptom history, not labeled in the app, so
for demo builds only). See spec section A12 for the production checklist.
