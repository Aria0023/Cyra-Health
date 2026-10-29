# Cyra monetization: free core, paid extension points, privacy rules

Cyra's core is free for good. Revenue may come later from optional paid features that do not
undermine privacy. This document says what is free, where a paid feature could plug in, how it
would be gated, and the rules every paid feature must follow. The architecture is in
`docs/ARCHITECTURE.md`; the entitlements code is `src/lib/plan.js`.

## 1. Where things stand

This build has one plan, Free, and no way to buy another: there is no paywall, no upgrade prompt, no
purchase code and no entitlement check over the network (`src/lib/plan.js`). Cyra has no analytics,
advertising or tracking code. The app calls none of the backend's partner, referral, affiliate or
payout endpoints; those modules exist for development and demos and are not mounted in the
production configuration (`backend/config/app.json`).

Owner decision D1: `src/lib/plan.js` is the single place features are gated. The free plan has no
enforced PDF export limit (there is no paid tier to upgrade to); the limit mechanism exists and is
unit-tested with a configured number, and it defaults to unlimited. No screen shows a plan, a limit,
a price or an upgrade prompt, and no screen imports `plan.js` yet.

**Calm R5 (plan §7 "Premium (Pro)", which replaces D1's "never show upgrade UI"):** `plan.js` gains the entitlement
`fullPractices` (false on the free plan). Mind → Practices keeps a free core set of five practices (slow breathing,
5-4-3-2-1 grounding, one small step, a five-minute movement break, bed is for sleep: at least one for every need); the
other six show a one-line "Pro" chip, and tapping one opens a calm "What Pro adds" sheet (`components/ProSheet.jsx`)
that says "Pro is coming to the app stores. There's nothing to buy in this version." It never opens on its own and
never blocks anything free. `DEV_PRO_PLAN` and `planFor(DEV_FLAGS)` are the dev/QA unlock: a build whose VITE_FEATURES
names the dev flag `proDev` (or "all", as the harness builds do) opens the Pro parts for testing. R8 adds store
purchases and "Restore purchases"; the basic doctor-ready PDF stays free.

## 2. The free core, forever

A feature that ships free stays free.

**Today:**

- Check-ins, quick and full, in every life stage (cycle, trying to conceive, pregnancy,
  perimenopause, menopause), and logging any past day from the Calendar.
- Calendar, Home and Today, Patterns and the basic insights.
- The Report tab: on screen, the appointment PDF made on the device (local-first L9, unlimited today), print from
  the browser, the email draft, copy.
- Care, Ask (the on-device library; Cyra's AI where the build offers it, opt-in), the journal,
  appointments, What I'm trying, Connect and Milestones.
- The POTS add-on.
- Reminders.
- The encrypted backup file and restore, and Delete everything.
- The privacy controls (local-first L10): the privacy dashboard ("What can leave this device"), the app lock (PIN,
  passkey on the web, lock-after), encrypted backup / restore and Delete everything are free core and are never
  gated through `plan.js`. The dashboard shows no cloud-backup row and no upgrade wording while
  `plan.cloudBackup` is false (D2 / D3).
- Palettes, light and dark mode, and the installable web app that opens offline.
- Symptom favourites per stage (order, "More symptoms", symptoms added from the other stage's list) and day notes,
  both part of the fast daily log (brief must-have 1). They are never behind `plan.can()`;
  `plan.extraCustomisation` is for extras beyond these.
- Fertility signs (Trying to conceive; opt-in for My Cycle): cervical mucus, ovulation tests and basal temperature
  (local-first L7) — free core, never gated in plan.js.
- Plain-language summaries and simple links (local-first L8): "This week / This month", sleep links and cycle-day
  clusters in her own log, Home's insight — worked out on the device, free core, never gated in plan.js.

## 3. Paid extension points (none active)

Every entitlement below is off or unlimited in this build. Nothing reads them yet except the unit
tests.

| Entitlement | Free value | What a paid tier could add | Hook | Slice |
|---|---|---|---|---|
| `pdfExportsPerMonth` | `null` (unlimited) | richer or unlimited exports, if a free limit is ever set | `plan.exportsLeft` / `plan.noteExport` at the Report's Download PDF | L9 |
| `aiPatternReports` | `false` | an advanced pattern report, with consent for each report | reserved and unbuilt; nothing calls it while false; no UI. The free on-device summaries and links (L8) never call it. Building it would need explicit consent for each report, a minimal pseudonymised summary and the exact disclosure of what is sent | L8 |
| `extraCustomisation` | `false` | extras beyond the free favourites and palettes, such as custom symptoms or themes | none yet; the favourites sheet (L6) is free core and never calls `plan.can` | L6 |
| `cloudBackup` | `false` | end-to-end-encrypted cloud backup and multi-device sync, the first paid server feature | scaffolded in L4, still off with no UI: the backend module `backup` (opaque encrypted blobs, never decrypted; listed in `config/app-dev.json`, not mounted in production), `cloudTransport` in `src/lib/backup.js` (fail-closed) and its configured instance `src/lib/cloudBackup.js` (imported by nothing). Three gates: `plan.can("cloudBackup")`, the build's `cloudBackup` flag (`VITE_FEATURES`), and the module listed in `backend/config/app.json`. Turning it on is a paid-tier decision plus the privacy-copy changes recorded in `docs/PRIVACY-AUDIT.md` (L4) | L4 |

## 4. How a feature is gated

Three gates, in this order (docs/ARCHITECTURE.md §10):

1. **The build flag** (`VITE_FEATURES`, `src/lib/features.js`, L4): is the code path in this build at
   all? A server feature that is off leaves no sentence or empty section behind.
2. **The plan** (`can(feature)` in `src/lib/plan.js`): is it included?
3. **Her own opt-in**: the switch or consent on screen, off until she turns it on.

Components never compare tier names (`plan.tier === "…"`); they ask `can(feature)`. `can()` fails
closed: an unknown feature, or a paid extension whose value isn't exactly `true`, is unavailable.

## 5. The PDF export limit mechanism

- The tally is `{ month: "YYYY-MM", n }`, where `month` is this device's local calendar month
  (`monthKey()`). While exports are unlimited, `noteExport()` returns `null` and nothing is recorded.
- If a limit is ever configured, the tally becomes a new persisted key that is DEVICE_ONLY and in
  NOT_IN_BACKUP (`src/lib/record.js`): it describes this device and never travels in a backup.
- It resets each local month. `exportsLeft()` never goes below 0, counts an unreadable tally as
  nothing used, and fails closed (0) when the configured limit is not a whole number ≥ 0.
- It applies to the generated PDF file only. The on-screen Report, printing, copying and the email
  draft are never limited.
- The wording for a reached limit (`limitLine` in `src/lib/visitReport.js`: "You've made this month's
  N PDFs. You can make another from {date}. Print this page works any time.") shows only when a limit
  is actually configured, as an `aria-disabled` button with that line; it is never an upgrade prompt.
- **Where it is wired (L9).** `ReportScreen` renders the Appointment PDF card only when
  `plan.can("pdfExport")`. App.jsx passes `pdfLeft = exportsLeft(exportLog, { now })` (null = unlimited)
  and the button is gated when `pdfLeft !== null && pdfLeft <= 0`. After a save that was not cancelled,
  `noteExport(exportLog, { now })` returns the next tally, and only a non-null result is written to the
  `exportLog` key (DEVICE_ONLY, NOT_IN_BACKUP, `src/lib/record.js`): in the shipping plan it is always
  null, so nothing is counted or stored. The POTS report is not gated or counted. A later paid tier could
  raise the limit or add richer exports without changing the free file.
- Tested in `src/lib/plan.test.mjs` with a limit of 3 (counting down, never negative, a new month,
  the December to January rollover, garbage tallies, bad limits).

## 6. Privacy rules for any paid feature

- Cyra never sells or licenses individual health data.
- No third-party analytics, advertising or attribution SDKs, ever.
- Research use needs her explicit, separate opt-in, is anonymised, and is never a condition of any
  feature.
- Paying never requires sending health data, and an entitlement check carries none.
- A paid server feature stores only data encrypted on her device with a key she holds (cloud
  backup), or nothing.
- AI features need explicit consent, send only a minimal pseudonymised summary with exact
  disclosure, and prefer on-device processing.
- Ending a plan never deletes, locks or degrades her data.
- A restore never grants or removes a plan.
- Safety guidance, backup, restore, Delete everything and the on-screen Report are never
  paywalled.
- Every paid feature's wording is recorded in `docs/PRIVACY-AUDIT.md` and is true in every build
  configuration.

## 7. Revenue-adjacent code that already exists

- **Care shelf** (`src/screens/CareScreen.jsx`, `SHELF` in `src/lib/constants.js`): every item's
  `partner` flag is `false` and no commission is claimed; matching runs on the device, and the screen
  says "partners never see your data". Spec §1: "Nothing is sold. Partners receive an anonymous
  token only."
- **Backend** (`backend/src/modules`): the partners, referrals, webhooks, payouts, affiliates and
  reports modules are for development and demos (`backend/config/app-dev.json`). Production mounts
  only push and ai (`backend/config/app.json`, since L4; oauth, integrations, pulse and backup are
  mounted by listing them), and the app calls none of those business endpoints (`grep -rn "/api/" src`
  finds only ai, backup, integrations, oauth, pulse and push).

## 8. Before a paid tier ships

- An owner decision on prices and limits.
- Entitlements validated by the app store or the server, carrying no health data, kept as a
  device-only key that is never in a backup.
- Honest copy, with no paywall on safety guidance, backup, restore or delete.
- A `docs/PRIVACY-AUDIT.md` entry that is true in every build configuration.
- Unit tests for every gate.
- An update to the table in §3.
