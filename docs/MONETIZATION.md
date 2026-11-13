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

Calm R6: the weekly review and its starter experiments are free core. "Your own experiment" carries the one-line Pro
chip and opens "What Pro adds"; no custom-experiment builder exists yet (R8). Pattern cards are not gated in R6.

Calm R7: You has one quiet Plan card ("Cyra Free", the free-forever sentence, a "See what Pro adds" button that opens the
same `ProSheet`, and "There's nothing to buy in this version."). It never opens anything on its own, has no price, trial,
countdown or upgrade button, and a dev build (proDev) says it is a test build. R8 changes its copy when purchases exist.

## 1a. Owner decision D4 (2026-11-12): Pro is sold in the phone apps

- **Price:** $9.95 a month or $100 a year (about $8.33 a month, two months free), with a 7-day free trial on the yearly plan only.
  Optional one-time tips ("Support Solia Health"): $1.99, $4.99, $9.99. A tip unlocks nothing and never changes the plan.
- **Where:** iPhone and Android, through the App Store and Google Play, via RevenueCat's Capacitor plugin
  (`src/lib/purchase.js`; the decision record and product ids are `src/lib/pricing.js`; setup is `docs/STORE-SETUP.md`).
  The web sells nothing: the Pro sheet and the Plan card name the US price "in the iPhone and Android apps". An optional
  web tip page (`VITE_TIP_URL`) is shown on the web only, never inside the phone apps.
- **Prices on a phone come only from the store** (`product.priceString`, her currency). Until the store answers, no price
  is shown at all. The sheet shows the plan length, price per period, auto-renewal, how to cancel, Restore purchases and
  the Terms and Privacy links (App Store Review Guideline 3.1.2).
- **What RevenueCat is told:** nothing about her. `configure()` gets no app user id (RevenueCat makes an anonymous one);
  no attributes, email, name or health data are ever set; `purchase.test.mjs` fails if the code calls any of those.
  RevenueCat receives the store receipt and the anonymous id, as any subscription processor must. It is a payment
  processor, not analytics or advertising (§6), and must be listed as a processor in the Privacy Policy and the App
  Store privacy label ("Purchases", not linked to identity).
- **What Pro opens** is unchanged: `PRO_PLAN` in `src/lib/plan.js`. Everything in §2 stays free.
- **Status:** the code path is built and tested with a fake store and a pretend-store preview (dev gallery). It sells
  nothing until the products exist in App Store Connect / Play Console / RevenueCat and the two public keys are set.
  Still open: a server-side receipt check for the cloud backup entitlement (§3, `cloudBackup`).

## 1b. Owner request 2026-11-12 (Task 3): Pro is evidence-based AI; every practice is free

- **Every Mind practice is free**, with an optional **voice guide** (the device's built-in speech, free, nothing sent):
  `lib/mind.js` marks all eleven free, `plan.js` no longer has `fullPractices`, and no practice carries a Pro chip.
  This supersedes the R5 "free core set" above.
- **Pro now leads with "Ask with evidence"** (`plan.js` `aiEvidence`): her question answered by Claude with the server
  web search tool limited to PubMed, NCBI, MedlinePlus, NIH, CDC, ACOG, WHO, NICE, the Cochrane Library, the Endocrine
  Society and the FDA, with numbered source links; then the weekly write-up and chat about her log; then the encrypted
  backup where the build offers the account. The ProSheet lists only what the build really opens (the AI lines need the
  ai flag and a server); a build with none of them says so.
- **Evidence services considered and set aside (revisit if a consumer licence appears):**
  - **OpenEvidence:** no public API; the app is restricted to verified US clinicians (NPI). Not usable for a consumer app.
  - **UpToDate (Wolters Kluwer):** an enterprise "Expert AI" API through UpToDate Connect, bring-your-own-licence (each
    user needs a clinician subscription), sold by demo request. Not usable for a consumer app today.
  Until one offers a consumer licence, Ask with evidence searches only public, authoritative sites.

## 1c. Owner decision 2026-11-12: a free week, then Pro to keep logging

Supersedes "free core, forever" (§2) wherever the gate is on. `src/lib/trial.js`:
- Everyone gets 7 days of the whole app with saving, counted on the device from the first day in the app
  (`trialStart`, in the record and in backups). No card, no account.
- After that, without Pro, the health-log setters in `App.jsx` (`guardLog`) refuse any new or changed entry and open
  "Your free week is over". Load, restore, cross-tab adoption and Delete everything use the raw setters.
- Always free, whatever the plan: opening and reading what she logged, every export (PDF, spreadsheet, encrypted
  backup file), Delete everything, safety guidance and the guided practices. Privacy law (CCPA, MHMDA access and
  deletion rights) and the App Store require the first three.
- The gate is on only where she can pay: a phone build with a connected store, or the dev flag `trialGate`
  (QA, the e2e harness, and the web once Pro can be bought there). `proDev` never opens it.
- The yearly plan's own 7-day store trial still exists in the stores; decide whether to keep it (it is a second free
  week for people who pick yearly) or remove the introductory offer in App Store Connect and Play Console.

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
  `plan.cloudBackup` is false (D2 / D3). Calm R9: the file backup stays free core; only the optional account's
  backup on Cyra's server is Pro.
- Palettes, light and dark mode, and the installable web app that opens offline.
- Symptom favourites per stage (order, "More symptoms", symptoms added from the other stage's list) and day notes,
  both part of the fast daily log (brief must-have 1). They are never behind `plan.can()`;
  `plan.extraCustomisation` is for extras beyond these.
- Fertility signs (Trying to conceive; opt-in for My Cycle): cervical mucus, ovulation tests and basal temperature
  (local-first L7) — free core, never gated in plan.js.
- Plain-language summaries and simple links (local-first L8): "This week / This month", sleep links and cycle-day
  clusters in her own log, Home's insight — worked out on the device, free core, never gated in plan.js.

Calm R8: `lib/plan.js` gains `PRO_PLAN` (what a store purchase unlocks: the full practices library, `aiPatternReports` for
Cyra's weekly write-up and `aiChat` for the chat about her log; the basic PDF stays free and unlimited; `cloudBackup` stayed
false until calm R9, which makes it part of Pro) and `planFor(devFlags, owned)`. `lib/purchase.js` is the store adapter interface (`storeFor`, `buyPro`,
`restorePurchases`, `proOwned`): on iOS and Android it is a stub that says "The app store isn't connected in this build,
so Pro can't be bought or restored here yet."; on the web there is no store ("Pro will be sold in the iPhone and Android
apps. There's nothing to buy on the web."). Nothing is ever owned, so shipping builds stay Free; only `proDev` opens Pro.
The Plan card adds "Restore purchases", which answers at once and sends nothing. No price appears anywhere ("Pro is
coming to the app stores" in the sheet) until a real store product exists. The Pro sheet now lists only what this build
opens for Pro (the full practices library, and the AI write-up and chat where the build has Cyra's AI and a server); the
planned items (your own experiments, medicine and supplement reminders, a richer PDF) are listed apart as "Planned for Pro,
not in this version yet". **Pattern cards stay free** (decided in R8): plan §7's Pro list does not include them and basic
pattern insights are free core, so the sheet's old "Every pattern" line was removed and "every pattern Cyra finds" joined
the free-forever sentence. The AI write-up and chat follow §6: off by default, her switch, the exact payload shown before
every send, a pseudonymized summary only (docs/PRIVACY-AUDIT.md "Calm R8").

## 3. Paid extension points (none active)

Every entitlement below is off or unlimited in this build. Nothing reads them yet except the unit
tests.

| Entitlement | Free value | What a paid tier could add | Hook | Slice |
|---|---|---|---|---|
| `pdfExportsPerMonth` | `null` (unlimited) | richer or unlimited exports, if a free limit is ever set | `plan.exportsLeft` / `plan.noteExport` at the Report's Download PDF | L9 |
| `aiPatternReports` | `false` | Cyra's weekly write-up (Pro) | calm R8: Patterns → "Cyra's write-up", only with the ai flag, a server, this entitlement and her switch; the exact summary is previewed before every send | R8 |
| `aiChat` | `false` | chat with Cyra's AI about her log (Pro) | calm R8: Mind → Journey → "Chat about your log", same gates, each message previewed | R8 |
| `extraCustomisation` | `false` | extras beyond the free favourites and palettes, such as custom symptoms or themes | none yet; the favourites sheet (L6) is free core and never calls `plan.can` | L6 |
| `cloudBackup` | `false` | the optional account's end-to-end-encrypted backup on Cyra's server (sign in on a new device and restore; automatic back-ups after changes), the first paid server feature (D3) | calm R9: `true` in `PRO_PLAN` and `DEV_PRO_PLAN` (QA), `false` on the free plan. You → Account and the splash's "Sign in to restore from your account" exist only with the build's `cloudBackup` flag and a server (`ACCOUNTS_HERE`); without Pro the card says "An encrypted backup to Cyra's server comes with Pro." with "See what Pro adds", and the Pro sheet lists it. The server (`backup` module, not mounted in production) stores an opaque blob, a hash of her email and a hash of a write token derived from her passphrase on the device. The entitlement is checked in the app only; a server-side receipt check is needed once a store can sell Pro | R9 |

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
