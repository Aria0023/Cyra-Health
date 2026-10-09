# Cyra Health

One companion for every phase — cycle, pregnancy, perimenopause, menopause.
Tracks in 30 seconds a day, finds patterns, and turns them into plain-language
guidance and a doctor-ready summary. The health log is stored only on the device. Opt-in
features (weekly counts, Ask Cyra's AI, Oura and Fitbit/Garmin/Whoop) send only what their
in-app disclosure says; the full list, including sign-in and web reminders, is under
Privacy below.

## Privacy
The health log (check-ins, journal, appointments, medications, the answers given at
sign-up, and wearable readings once they reach the app) is stored only on the device: in
IndexedDB in the browser, and in one file in the app's private storage on iPhone and
Android, marked to be left out of iPhone backups and excluded from Android backup and
device transfer. The welcome sentence and the choice of life-stage experience are made on
the device. What can leave it, when a backend is configured (`VITE_API_BASE`):

- **Each launch, no health data:** once a life stage is set, one request for last week's
  anonymous counts. It carries no life stage or identifier, only what any request carries
  (IP address, user agent).
- **"Share anonymous weekly counts"** (off until ticked; can be turned off in Settings,
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
- **"Also ask Cyra's AI"** (off by default, per device): Ask Cyra answers from an evidence
  library on the device first. Only when this is on and the library has no answer does the
  typed question go to Cyra's server, with no life stage, name or log. The server forwards
  the text as typed to Anthropic, which keeps it under its own terms (a server without an
  Anthropic key answers from the same library instead).
- **Oura** (connected only after a disclosure and Continue): the device keeps the Oura
  tokens. While connecting, the server holds them in memory for at most 5 minutes until the
  device collects them (Cyra's server asks Oura to revoke tokens nobody collects, also when a
  collection is refused or the server shuts down; this is best effort, so if a connection
  doesn't finish, remove Cyra in your Oura account). Each sync sends the
  token to Cyra's server, which fetches 30 calendar days of Oura readiness and sleep
  records, keeps only temperature, resting heart rate, HRV and sleep score, and passes those
  back without storing them.
- **Fitbit, Garmin, Whoop through Terra** (same disclosure first; Terra's window offers only
  these three): Terra, a health-data service, keeps the device connection and its data under
  Terra's own policy and sends Cyra's server its updates; the server keeps only temperature,
  resting heart rate, HRV and sleep. Those readings wait in the server's memory, unencrypted
  and never on disk, for up to 7 days (a sweep removes each one before its 7 days are up). The server hands them over only to a request carrying the random secret key
  kept on the device (and in any encrypted backup she saves), and deletes them as soon as it
  hands them to the app (on launch, on return to the app, and on Sync). Disconnect and Delete
  everything collect what is waiting first, then end the connection.
- **Social sign-in** (optional; Apple, Google, Facebook): the provider learns that this
  account is signing in to Cyra. Cyra's server passes the name and, only when Apple or
  Google says it is verified, the email to the device through a one-time code that a timer
  deletes after 5 minutes. No account is kept. Anonymous Mode and email registration send
  no name or email.
- **Reminders** (off until turned on): on the phone they are local notifications and
  nothing is sent. On the web, Cyra's server keeps the browser's push subscription (address
  and encryption keys), the reminder days, time, time zone and last day sent, never a name
  or health data, and deletes them when reminders are turned off. Turning them off cancels
  the browser's subscription at once and saves the off switch (with the address still to
  forget) on the device before anything is sent; if the server can't be reached, the app
  keeps asking it to delete the row (at launch, when the browser is back online or Cyra is
  back on screen, and on a timer while Cyra is open) until it confirms (unless you then
  choose Delete on this device anyway or clear this site's data). Every open tab follows the
  same switch. The browser's push service delivers the reminders (for example Google's for
  Chrome, Mozilla's for Firefox, Apple's for Safari or Microsoft's for Edge).

Never sent by Cyra: Apple Health and Health Connect readings (read on the phone; they leave
it only inside an encrypted backup the person exports herself). The **encrypted backup** is a
file the person saves herself (a download on the web, the share sheet on the phone),
encrypted with her passphrase; Cyra never receives it. Fonts are bundled, and there is no
analytics, advertising or tracking code. **Delete everything** asks Cyra's server to remove
the reminder subscription and disconnect Oura and Terra (collecting Terra's waiting readings
first), and deletes the record on the device only after the server has confirmed every step:
if one can't be confirmed, the app says which step failed and why, and what already ended (a
connection the server did end is removed from the device), and offers Try again or "Delete on
this device anyway" (which says what stays connected and where to remove it). Then it removes
the on-device record and cancels reminders; if this device shared counts this week, only the
week-only marker above stays, until that week is over. Counts
already shared stay counted, and data that Terra, Oura or Anthropic already received
follows their own policies. Without `VITE_API_BASE` there is no backend, and none of the data above is
sent.

## Run
    npm install
    npm run dev          # http://localhost:5173
    npm run backend      # http://localhost:3000 (optional business layer)

## Deploy
Static site on Render: build `npm install && npm run build`, publish `dist`.
`render.yaml` configures it automatically via Blueprint.

## Phone apps (iOS / Android)
    VITE_API_BASE=https://cyra-backend.onrender.com npm run cap:ios       # Xcode
    VITE_API_BASE=https://cyra-backend.onrender.com npm run cap:android   # Android Studio

Step-by-step guide (signing, HealthKit, Health Connect, the `cyrahealth://` return
link, server settings, and what has and hasn't been verified): `docs/NATIVE.md`.

## Docs
- `docs/CYRA-BUILD-SPEC.md` — complete product + technical spec (normative)
- `docs/NATIVE.md` — building and running the iPhone and Android apps
- `docs/Cyra-Legal-Documents.docx` — privacy policy, terms, research consent (drafts)
- `CLAUDE.md` — working instructions for Claude Code
- `backend/README.md` — backend architecture and endpoints

## Status
Build 2026.10.07-D. Social sign-in (Apple, Google, Facebook), Oura and Fitbit/Garmin/Whoop
(through Terra) sync, Ask Cyra's AI and the weekly counts are real integrations that go
through the Cyra backend once their keys are configured; Apple Health and Health Connect are
read on the phone. Demo data appears only in builds made with `VITE_DEMO_WEARABLES=true`
(illustrative wearable readings, labeled as such in the Wearables panel) or
`VITE_DEMO_SEED=true` (75 days of illustrative symptom history, not labeled in the app, so
for demo builds only). See spec section A12 for the production checklist.
