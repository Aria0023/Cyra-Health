# Cyra architecture (local-first)

How Cyra keeps a health record on the device: where it is stored, what it holds, which keys go
where, what is worked out from it, and where later features plug in. `src/lib/record.js` is the
authoritative description of the record; this document explains it. The normative product spec is
`docs/CYRA-BUILD-SPEC.md`; every privacy sentence is traced in `docs/PRIVACY-AUDIT.md`.

## 1. Principles

- **On the device by default.** The health record lives on the device that made it and is never
  sent to a server (CLAUDE.md, hard rules). The optional server features she turns on send only
  what their in-app disclosure says, never the record; the full list is the README's Privacy
  section and the header comment of `src/App.jsx`.
- **No account.** Nothing needs a sign-up, a password or an email. Social sign-in is optional and
  only pre-fills the name and email fields on this device.
- **Works offline.** The record is read and written locally; the installed web app opens without a
  connection (spec A14.1).
- **A minimal, optional server.** A build without `VITE_API_BASE` makes no request to Cyra's server
  at all (on the web it fetches only Cyra's own app files from the site that serves it). With one,
  what the app may ask of it is set first by the build's feature flags (`VITE_FEATURES`, §10): the
  default build offers only Cyra's AI and web reminders, makes no request at launch, and its first
  server contact is her own opt-in (turning on browser reminders, or ticking "Also ask Cyra's AI").
  A build with `counts` also reads last week's anonymous counts once per launch, once a life stage
  is set (no health data, no life stage and no identifier, only what any request carries: IP
  address and user agent); with `signin`, `wearables` or `counts` the server also handles sign-in
  prefill, wearable connections or sharing weekly counts when she starts them. Each flow does what
  its disclosure says (the README's Privacy section, the `src/App.jsx` header). The server never
  receives the record. An optional backup must be encrypted on the device with a key she holds.
- **Guidance, not diagnosis.** Analyses are computed from her own log, on the device, and say
  what to ask, never what she has.

## 2. Layers and modules

```
UI          src/screens/*.jsx, src/components/**/*.jsx          (props in, callbacks out)
  ↓
State       src/App.jsx  (useState / useMemo, the 400 ms autosave, cross-tab messages)
  ↓
Pure lib    engine.js  ←  record.js, pots.js (+ potsPatterns, potsReport, potsMove)
            daylog.js  ←  record.js;  constants.js, appearance.js, askLibrary.js;  plan.js and features.js stand alone;
            disclosures.js imports only features.js
  ↓
I/O lib     storage.js, backup.js, files.js, native.js, api.js
            (pulse.js, notifications.js and wearables.js call api.js; backup.js imports nothing,
            its transports are given their I/O; cloudBackup.js wires its cloud transport, unimported)
  ↓
Device storage (IndexedDB / app sandbox)          optional server (VITE_API_BASE)
```

Dependency rules (unit-tested where a test can see them):

- `engine.js` is the lowest pure layer. `record.js` and `pots.js` may import it; it never imports
  them (`record.test.mjs` "layering and no I/O").
- `record.js` imports only `./engine.js`, `./constants.js` and `./daylog.js` (L6; the allowed list lives in
  `record.test.mjs`; a later pure leaf module may be added to it, and none of them may import
  `record.js` back). `daylog.js` imports only `./constants.js`. `plan.js` and `features.js` import nothing; `disclosures.js` imports only
  `features.js`; `backup.js` imports nothing (the POTS suites load it straight from Node).
- Pure modules never import `api.js`, `native.js` or `storage.js`, and never read `import.meta.env`,
  so `node --test` can load them. (`features.js` is the one exception that reads it, as
  `import.meta.env?.VITE_FEATURES`, which is undefined in Node, so Node and `vite.config.js` load it.) (`pwa.js`, `links.js`, `api.js` and `wearables.js` read build
  settings and are not pure.)
- Only `api.js` calls `fetch` (the service worker, `public/sw.js`, fetches Cyra's own files).
- The phone app's web view has an iOS 15.0 deployment target: no `structuredClone`, `.at()`,
  `findLast` or `Object.hasOwn` in shipped code.

## 3. Where the record is stored

In a browser the whole record is one value in IndexedDB (database `cyra`, store `state`, key `v1`),
with a second copy of the POTS log under `v1-pots` and a week-only hold in database `cyra-hold`;
never localStorage or cookies. On iPhone and Android it is one file, `NoCloud/cyra-state.json`, in
the app's private Library folder (left out of iPhone backups with complete file protection; Android
backup and transfer switched off), written through a temp file and a rename. The phone build opens
no IndexedDB.

Details (all in `src/lib/storage.js`; phone specifics in `docs/NATIVE.md`):

- **Web.** IndexedDB `cyra` / `state` holds `v1` (the record), `v1-pots` (the POTS log's second
  copy, written in the same transaction as every save, so a tab still running a build from before
  POTS can't lose it) and, for a moment during the probe, `probe` (a random token written and read
  back before the UI names the store). Database `cyra-hold` holds the week-only hold: the ISO week
  in which this device last sent weekly counts, nothing else. `navigator.storage.persist()` is asked
  once per launch, after the first save.
- **Phone.** `Library/NoCloud/cyra-state.json` (iPhone: excluded from backup, complete file
  protection; Android: the app's internal files folder, backup and transfer off). A save writes
  `cyra-state.json.tmp` and renames it over the record; a load falls back to the temp file when a
  save was interrupted. `NoCloud/cyra-hold.json` is the hold. While she shares an encrypted backup or
  a POTS file, the file (the backup already encrypted; a POTS report or spreadsheet unencrypted) sits
  in the app cache and is deleted afterwards, and any leftover is swept at launch and by Delete
  everything.
- **Which store is in use.** `storage.driver()` returns `indexeddb`, `app-sandbox`, `memory`
  (nothing can be stored), `stale` (a save failed; an older copy is still on the device) or
  `unreadable` (web: a record exists but couldn't be read). Settings → Your data words its storage
  sentence from it, so it never says less is stored than really is. A new driver needs its own
  sentence there and a PRIVACY-AUDIT entry.
- **Other on-device locations.** The web build's service worker keeps Cyra's own app files (the
  build's file list only, no record data, no server answers) in one Cache Storage entry named
  `cyra-shell-<version>`, only in a production web build and only while a record exists (spec
  A14.1); Delete everything removes it. The appearance choice (L2) is a key inside the record, not a
  separate store. The browser itself keeps its push subscription while web reminders are on.

**Later: SQLite on the phone** (a plan only; no dependency is added now):

- Keep the `storage` interface (`load`, `save`, `clear`, `probe`, `driver`, the hold), so App.jsx
  does not change.
- Candidate: `@capacitor-community/sqlite`. It is a new dependency and needs the owner's approval.
- Tables: `meta(key TEXT PRIMARY KEY, value JSON)` for the settings and bookkeeping keys,
  `days(date TEXT PRIMARY KEY, entry JSON)`, `preg(date TEXT PRIMARY KEY, entry JSON)` and
  `pots(value JSON)`. A save writes only the rows that changed instead of rewriting the whole file.
- Same placement (`Library/NoCloud`), the same backup exclusion and file protection.
- A one-time import from `cyra-state.json`, verified by reading every row back before the JSON
  file is deleted.
- A storage-engine change does not change `RECORD_VERSION`: the record's shape is the same. The web
  stays on IndexedDB.
- Trigger: when saves are measurably slow. A full day entry is about 320 bytes, so a year of daily
  check-ins is about 115 KB; whole-file writes are not a problem yet.

## 4. The record: version, keys and where each one goes

The record is one object: `{ v, savedAt, phase: "app", ...PERSISTED }` (`snapshot()` in App.jsx).

- `RECORD_VERSION = 1` (`src/lib/record.js`). `migrate()` runs on every load (`storage.load`, web and
  phone) and on every decrypted backup (`importBackup`). With no steps yet it returns today's
  records as the same object; it never throws (a throw on the web would turn the store
  `unreadable`; on the phone it would show the record-unavailable screen).
- The IndexedDB key name `v1` is a name, not the version.
- Three versions exist, independent of one another: the record's `v` (record.js), the backup
  envelope's `v` (`lib/backup.js`, the file format) and `pots.v` (`lib/pots.js`; a POTS log whose
  `v` isn't 1 is shown read-only and kept untouched).

Key lists (all in `record.js`): `PERSISTED` (every saved key), `DEVICE_ONLY` (per-device consents and
bookkeeping), `DEVICE_PREFS` (display preferences of this device), `RECORD` (what another open tab
takes over: PERSISTED minus DEVICE_ONLY and `reminders`) and `NOT_IN_BACKUP` (deleted before a backup
is encrypted). `backupCopy()` is the whole backup transform.

| Key | What it is | Class | In the backup file | A restore applies it | Other open tabs take it over |
|---|---|---|---|---|---|
| `days` | check-ins (cycle, peri, meno) | health log | yes | yes | yes |
| `pregLog` | pregnancy check-ins | health log | yes | yes | yes |
| `journal` | journal text by day | health log | yes | yes | yes |
| `connLog` | Connect check-ins by day | health log | yes | yes | yes |
| `meds` | What I'm trying | health log | yes | yes | yes |
| `medLog` | taken / not taken by day | health log | yes | yes | yes |
| `appts` | appointments | health log | yes | yes | yes |
| `wearData` | daily wearable readings | health log | yes | yes | yes |
| `kickTally` | today's kicks between taps | health log | yes | yes | yes |
| `regAnswers` | registration answers | health log | yes, without `zip` and `age` | yes | yes |
| `pots` | the POTS add-on | health log | yes | yes, literally, with a new epoch (a backup without one clears the POTS log; a newer build's locked log stays untouched) | yes, 3-way merged (`mergePots`, epochs) |
| `cycleFlags` | cycles she left out of predictions, `{ [startIso]: { exclude: true } }` (L5, spec §3.5) | health record (her choice) | yes | yes, literally (`cleanCycleFlags`; a backup without it clears it) | yes (sanitised by `cleanCycleFlags`) |
| `symPrefs` | her symptom list per stage id, `{ periods?, peri?, preg? }` × `{ order, hidden, added }` (L6, spec §3.6) | record (a setting) | yes | yes, literally (`cleanSymPrefs`; a backup without it brings back Cyra's order) | yes (sanitised by `cleanSymPrefs`) |
| `fertSigns` | fertility signs switch and temperature unit, `{ on: true\|false\|null, unit: "C"\|"F"\|null }` (L7, spec A14.7); `on` null = the stage default | record (a setting, no health data) | yes | yes, literally (`restoredFertPrefs`; a backup without it resets `on` to null and keeps this device's unit) | yes (sanitised by `cleanFertPrefs`) |
| `palIdx` | palette per stage | setting | yes | yes | yes |
| `cadence` | check-in rhythm | setting | yes | yes | yes |
| `quietHours` | reminder time of day | setting | yes | yes | yes |
| `quickMode` | quick or full check-in | setting | yes | yes | yes |
| `relationship` | Connect setting | setting | yes | yes | yes |
| `stage` | the one life-stage experience | setting | yes | yes | yes |
| `stageName` | its label | setting | yes | yes | yes |
| `welcome` | welcome sentence | setting | yes | yes | yes |
| `acct` | name and email (empty in Anonymous Mode) | setting | yes | yes | yes |
| `wearSources` | wearable connections | connection | yes | yes, unconfirmed (`pending` + `restored`) and merged with this device's; a Terra connection this device is disconnecting is left out | yes |
| `terraOff` | unconfirmed Fitbit / Garmin / Whoop disconnects | device-only | yes | no (this device's kept) | no |
| `research` | "Share anonymous weekly counts" | consent, device-only | yes | no (this device's kept) | through the pulse merge (`pulseRev`) |
| `askAI` | "Also ask Cyra's AI" | consent, device-only | yes | no (this device's kept) | no |
| `pulseQueue` | flags waiting to be sent | bookkeeping, device-only | yes | no | through the pulse merge |
| `pulseSent` | what was sent this week | bookkeeping, device-only | yes | no | through the pulse merge |
| `pulseLastSend` | last day a tally went | bookkeeping, device-only | yes | no | through the pulse merge |
| `pulseRev` | version of the sharing state | bookkeeping, device-only | yes | no | through the pulse merge |
| `lastBackupAt` | day this device last made a backup | bookkeeping, device-only | **no** (NOT_IN_BACKUP) | no | no |
| `installHint` | whether this browser's install tip stays away | device-only | **no** (NOT_IN_BACKUP) | no (this device's kept) | no (RECORD excludes it; each save merges the stored value one way: installed > dismissed > null) |
| `appearance` | System / Light / Dark | device preference (DEVICE_PREFS) | **no** (NOT_IN_BACKUP) | never (this device's kept) | yes (same browser, same device) |
| `reminders` | the switch, this browser's push addresses, a version | bookkeeping | `{ enabled }` only | on the phone only (the web keeps this browser's switch) | own merge (`rev`, the `reminders` message) |

"In the backup file" means inside the encrypted envelope (`lib/backup.js`, PBKDF2-SHA256 600,000
rounds, AES-256-GCM): nothing is readable without her passphrase. The per-device consents and
bookkeeping are in the file but a restore never applies them; only the NOT_IN_BACKUP keys are left
out of the file itself.

`src/lib/record.js` is authoritative: its pinned lists are guarded by `record.test.mjs` ("key lists
are the ones App.jsx used before L3"), which also checks that every key has a validation rule, a
setter and a value in App.jsx. A slice that adds a key updates this table in the same commit.

## 5. Shapes

The typedefs in `src/lib/record.js` are the working definitions (spec §3.1 and §3.4):

- **DayEntry** — `{ date: "YYYY-MM-DD" (unique), sym: { id: 0–3 }, scales?: { fatigue, pain, moodq,
  stress: 0–10 }, sleepQ?: good | fair | poor, period?: boolean, flow?, disch?, odor?, bodyOdor?, note?, cm?, opk?,
  bbt? }`. `cm` (cervical mucus: dry | sticky | creamy | watery | eggwhite), `opk` (ovulation test: neg | pos; absent =
  not tested) and `bbt` (°C, 34–40, 3 decimals) are the L7 fertility signs, written only when set (`lib/fertility.js`).
  `note` (L6) is her day note: trimmed, at most 280 UTF-16 units (`daylog.js` `cleanNote`), absent when empty; on the
  device and in backups only.
  Older records and `seed()` may carry only date, sleepQ, period and sym. At most one entry per date
  (`upsertDay`); `entryFor` returns the first one, as `days.find` did.
- **PregEntry** — `{ sym, kicks?, scales?, odor?, bodyOdor?, note? }`, kept in `pregLog` by date (`note` as DayEntry).
- **SymPrefs** — `{ periods?, peri?, preg? }`, each `{ order, hidden, added }` (lists of symptom ids, at most 40 each);
  `{}` is Cyra's order. My Cycle and Trying to conceive share `periods`, Perimenopause and Menopause share `peri`.
- **Cycle** (derived, never stored) — `{ start, next, length, counted, periodDays }` from
  `cyclesFrom(days)`, which builds on engine `cycleSpans(cycleStarts(days))` plus the running cycle.
- **CycleFlags** — `{ [cycleStartIso]: { exclude: boolean } }`, her "Don't use for predictions" choices; a key within
  2 days of a start applies to it (`flagKey`).
- **Settings group** — Settings, StoredReminders, Account, Med, Appt, ConnEntry, WearRow,
  PulseQueue, PulseSent, KickTally. The POTS log's shape is `lib/pots.js`'s.

Symptom ids are stable keys and are never reused for another meaning, so an old entry always reads
the same way. `sym` may hold ids from any library: `eng` ("Low energy") is in SYM and PSYM since L6, and
her list can add a symptom from the other stage's library (`symPrefs.*.added`). `validateRecord()` checks all of this, but only
as advice: nothing calls it at runtime, and nothing is ever dropped or rewritten because of it.

## 6. Life stages and phases: one experience, continuous data

`stage` is one of `periods`, `preg`, `peri` (or `null` while she chooses again). `stageName` carries
the label registration chose, and `phaseOf(stage, stageName)` names the phase: `cycle` (My Cycle),
`ttc` (Trying to Conceive), `preg` (Pregnancy), `peri` (Perimenopause) or `meno` (Menopause). `PHASES`
lists the exact labels `finishReg` and `rulesRoute` write; any other label of a stage counts as
`cycle` or `peri`.

Cycle, TTC, perimenopause and menopause all read the same `days`; pregnancy reads `pregLog`. Changing
stage (`{stageName} · change`) keeps every log: the other one stays and is there again if she
switches back. Only two things tied to the old stage go: weekly-count flags still waiting to be sent
for it are dropped, and a move into Pregnancy asks the POTS exercise-clearance question again. She sees exactly one experience at a time. The POTS add-on is independent of stage.

## 7. Derived data

Analyses — insights, predictions, cycles, day scores, the monthly recap, medication comparisons,
pattern charts and POTS totals — are computed on the device each time they are shown and are never
saved. Cyra's server never receives them, with one exception while she shares weekly counts: the
yes/no flag 'mood swings before a predicted period' is worked out from the prediction (see the
README's Privacy section). Otherwise they leave the device only in what she sends herself: the
doctor-summary email draft, copied summary text, and POTS reports or spreadsheets she exports.

That flag waits in `pulseQueue` on the device until it is sent, like the other weekly-count flags.
The Report's "Print or save PDF" button hands the page on screen to the browser's print dialog, and
its "Share…" button (Web Share, shown wherever the browser offers it, on a phone or a computer)
hands the email-draft text to the app she picks; each only when she taps it.

Where each comes from: `insights()` and `predict()` (`lib/engine.js`), `cyclesFrom()`
(`lib/record.js`), `dayScore()` (engine), the monthly recap, medication comparisons and wearable
insights (App.jsx `useMemo` and render-time code), pattern charts (`components/PatternCharts.jsx`),
POTS totals and patterns (`lib/pots.js`, `lib/potsPatterns.js`).

Predictions since L5: `predict()`, `whyNoPrediction()` and `cycleSummary()` (`lib/engine.js`) are computed on the device
from `days`, `cycleFlags` and the registration answers, every time they are shown, and never stored; only her flags
are. The clinical markers (`insights()`: `lens`, `variability`, `lens30`, `variability30`) never read `cycleFlags`, so
the perimenopause marker and the Report count every cycle. `engine.js` owns cycle detection (`cycleStarts`,
`cycleSpans`, `cycleLens`); `record.js` `cyclesFrom()` delegates to it, so there is one implementation.

The tracked list (L6): `trackedIds(stage, symPrefs)` (`lib/daylog.js`) is her stage's library plus what she added from
the other one, hidden ones included; App.jsx's `symIds` is that list for the cycle and perimenopause stages, and
`insights()`, the patterns card, the Calendar day card, the Report and the doctor email all run on it, so hiding a chip
never hides what she logged. Day scores divide by `SCORE_SCALE[stage]` (`lib/constants.js`: 12 / 10 / 8, the library
sizes when the score was defined; App.jsx `scoreDay`), so neither a new library symptom nor her list rescales a past
day. Both are derived on each render and never stored; only `symPrefs` is.

## 8. Saving, other tabs, backup and restore, delete

- **Autosave.** Any change to a PERSISTED value schedules a save 400 ms later (App.jsx autosave
  effect). A save waiting on its timer is written at once when the app is hidden, the page is
  closed (`pagehide`) or the phone app goes to the background. `storage.save` runs saves one at a
  time, in order.
- **Other tabs (web).** BroadcastChannel `cyra` carries four messages: `record` (another tab saved:
  take RECORD over, `adoptRecord`), `pulse` (sharing state, `pulseRev`), `reminders` (the switch,
  `rev`) and `wipe` (Delete everything under way). Before every save a tab merges the stored sharing
  state, reminders and install hint, and 3-way merges the POTS log (`mergePots`, epochs). Weekly
  counts are sent inside the Web Lock `cyra-pulse-flush`.
- **Backup.** `snapshot()` → `backupCopy()` → `encryptBackup()` (PBKDF2-SHA256, 600,000 rounds,
  AES-256-GCM) → `fileTransport.save()` (lib/backup.js): a download on the web or the share sheet on
  the phone. Cyra never receives it. A restore reads the chosen file with `fileTransport.load()`. The
  cloud transport beside it is a scaffold no build can reach (§10).
- **Restore.** `decryptBackup()` → `migrate()` → the version check (`v === RECORD_VERSION`, a stage
  set; otherwise "That backup is empty or from a different version") → every key applied except
  DEVICE_ONLY, DEVICE_PREFS and, on the web, `reminders` (§4) → saved at once.
- **Delete everything.** See the "Delete everything / Start over" comment in App.jsx: the server
  steps first (each confirmed or explained), then this device's clean-up (worker and offline copy,
  cache files, the record), and every other open tab is told to stop saving.

## 9. Health platforms: where HealthKit / Health Connect sync plugs in

**Today.** The phone app's `CyraHealth` plugin (`lib/native.js`, bridge contract in
`lib/wearables.js`) → `connectSource("healthkit")` / `syncSource("healthkit")` → rows
`{ date, temp, rhr, hrv, sleep, sourceId: "healthkit" }` → `mergeRows` → `wearData`. Read-only, from 30
days ago to today, phone only, never sent anywhere (it leaves the phone only inside an encrypted backup
she exports).

**Plug-in point (planned).** An adapter beside it in `lib/wearables.js` (or a new
`lib/healthSync.js`) that extends the bridge contract, for example `readCycle({ from, to })`:

- Cycle samples (menstrual flow, spotting) map onto `DayEntry.period` / `flow` through `upsertDay`,
  carrying a source mark, and never overwrite what she logged in Cyra herself.
- Writing back to Health is a separate, explicit permission.
- It needs new permission strings, a PrivacyInfo update, a PRIVACY-AUDIT entry and unit tests.
- It sits behind the build's wearables flag (L4) and her own opt-in.

## 10. Server surface and feature flags

### 10.1 The shipping surface

Static/PWA hosting for the app, plus a backend that mounts **push and ai only** in production
(`backend/config/app.json`, `NODE_ENV=production`). The app's default build (`VITE_FEATURES` unset)
offers only Cyra's AI and web reminders: it makes **no request at launch**, and its first server
contact is her own opt-in, turning on browser reminders (web push) or ticking "Also ask Cyra's AI"
(the question alone). The phone app schedules reminders locally and needs no server for them. Every
other server feature is present in the code, mounted in development (`config/app-dev.json`), and
turned on for a release by configuration, never by deleting or adding code (owner decision D2).

### 10.2 The flags

`src/lib/features.js` reads `VITE_FEATURES` once, at build time: unset or empty = the defaults below;
a comma list **replaces** the defaults (`counts,ai` offers only those two); `all` = every flag; `none`
= none; names match without regard to case, and an unknown name is ignored with a build warning
(`vite.config.js` logs `[cyra] features: …`). A flag decides only what the build **offers**: each
opt-in still starts off for her and says what it sends before she turns it on. A feature that is off
leaves no trace in the UI and makes no request.

| Flag | What it adds in the app | Backend module (`FEATURE_MODULE`) | What the module keeps | Default |
|---|---|---|---|---|
| `wearables` | Home's Wearables door and panel, the "From your wearable" cards and milestones, Oura and Fitbit/Garmin/Whoop (Terra) connections, on the phone Apple Health / Health Connect, POTS watch/ring rows | `integrations` | Oura tokens in memory for at most 5 minutes during a connect; Fitbit/Garmin/Whoop readings in memory for at most 7 days until the device collects them | off |
| `counts` | "You're not alone" on Home (one read per launch), "Share anonymous weekly counts" (consent and Settings) | `pulse` | weekly totals only: `{week, stage, event, count}` | off |
| `ai` | "Also ask Cyra's AI when the library has no answer" on Ask | `ai` | nothing (it forwards the question to Anthropic) | on |
| `webReminders` | check-in reminders in a browser (rhythm, nudge and Reminders in Settings, "Remind me" on the consent step); phones always have reminders | `push` | the browser's push address and keys, reminder days, time, time zone, the last day one was sent | on |
| `cloudBackup` | nothing yet (scaffold, §10.5) | `backup` | opaque encrypted blobs and a hash of each write token, 90 days after the last write | off |
| `signin` | the Apple / Google / Facebook prefill on step 1 (Apple first) | `oauth` | the provider's name and email in memory for at most 5 minutes | off |

`signin` is a sixth flag beside the five D2 names: D2 makes production push + ai, so the oauth module
is no longer mounted there, and the default build must not offer sign-in buttons that cannot work.

### 10.3 Turning a feature on

Both switches, and the secrets it needs:

1. **The app:** add the flag to `VITE_FEATURES` for the static site (Render → cyra-health →
   Environment) and for each phone build (`.env.local` before `npm run cap:sync`).
2. **The server:** list its module in `backend/config/app.json` `"modules"`, and set the module's
   variables from `.env.example` (Render → cyra-backend → Environment).

One without the other fails visibly or idles: a flag without its module offers a feature whose
requests answer 404 (the app then says it couldn't reach the service); a module without its flag is
mounted but nothing calls it. `backend/scripts/prod-smoke.js` proves that re-listing oauth,
integrations, pulse and backup brings them back on the same production server.

### 10.4 Flag-dependent copy

Every privacy sentence that names a flagged feature is built in one pure, unit-tested place,
`src/lib/disclosures.js` (step 1's "What Cyra's server sees", the consent card's fifth fact and "The
details", Your data's "What can leave this device", the restore and delete texts, the intake hint,
Start over and the POTS footers). With every flag on each builder returns the pre-L4 text byte for
byte; otherwise a shorter sentence that is still literally true (no dangling sentence, no empty
list). Screens gate whole rows and sections on `FEATURES`; they never inline a flag condition inside
a sentence. A later slice that adds or rewords such a sentence adds a builder (with tests) there
(L5's restore line, L7's fertility privacy line, L9's PDF wording, L10's dashboard), and L10's
privacy dashboard derives On / Off / "Not in this version" from `features.js`, `remindersInBuild`,
`plan.js` and her settings. A flag never deletes or changes recorded data: an earlier build's
wearable rows and connections, queued counts or choices are kept (and travel in backups) but are not
shown, sent or contacted; Delete everything in a build without wearables shows `LEGACY_WEAR_LINE`
when the record still holds a real connection.

### 10.5 The encrypted cloud backup scaffold (D3)

- **Protocol** (backend module `backup`, `backend/src/modules/backup/index.js`; listed in
  `config/app-dev.json`, **not** in `config/app.json`): `POST /api/backup` with the bytes →
  `201 {id, token, expiresAt}`; `PUT /api/backup/:id`, `GET /api/backup/:id` and
  `DELETE /api/backup/:id` with `authorization: Bearer <token>`. Bodies are
  `application/octet-stream` only (otherwise 415), at most `maxBytes` (4 MiB, 413); `maxRows`
  (10,000) and `maxTotalBytes` (1 GiB) cap the store (507); a blob expires `ttlDays` (90) after its
  last write and a sweep deletes it (hourly and at start, plus row-less files over an hour old); an
  in-memory rate limit per address. id = 128 random bits, token = 256 random bits, and only the
  token's SHA-256 is kept. Unknown id, malformed id, wrong token and expired all answer the same 404.
  Rows are exactly `{id, tokenHash, size, createdAt, updatedAt, expiresAt}`; bytes live in
  `<dir>/<id>.bin` (written to a temp file, then renamed). It never parses, inspects, decrypts or logs
  a body, a token or an id.
- **Client:** `src/lib/backup.js` has the transport interface. `fileTransport(io)` is today's
  download / share sheet; `cloudTransport({ request, enabled, gate })` moves only an envelope that is
  already encrypted (`isEnvelope`), never the passphrase or plaintext, and is fail-closed: every
  method rejects with `CLOUD_OFF` before any request unless `enabled && request && gate()`.
  `src/lib/cloudBackup.js` wires it with `apiFetch`, `hasServer()` and
  `gate: () => FEATURES.cloudBackup && can("cloudBackup")`. Nothing imports that file, so it is in no
  bundle.
- **Three gates, all closed today:** `plan.cloudBackup` (false on the only plan), the build's
  `cloudBackup` flag (off by default), and the `backup` module listed in `app.json` (not listed).
- **Before enabling it:** a screen that shows her the id + write token as a recovery code (needed to
  restore on another device); a new device-only key for them (proposed `cloudBackupRef`,
  `DEVICE_ONLY`, never in a backup; not added yet); persistent storage for the module instead of
  Render's instance disk, which is wiped on every deploy; and, in the same commit, the four privacy
  sentences that say Cyra never receives the backup file (docs/PRIVACY-AUDIT.md, L4 section).

### 10.6 Plan hooks

A feature that is optional on the server side or paid passes three gates, in this order:

1. **Build flag** — `src/lib/features.js` (§10.2).
2. **Plan** — `src/lib/plan.js` (`can(feature)`, the one entitlements object; today one free plan).
3. **Her own opt-in** — the switch or consent on the screen, off until she turns it on.

A screen never compares tier names; it asks `can(feature)`, which says no to anything it doesn't
know. The free core, the paid extension points and the rules any paid feature must follow are in
`docs/MONETIZATION.md`.

### 10.7 Harness note

The suites that pin today's full feature set build with `VITE_FEATURES=all`: `a12-8-loop/build-dists.sh`
(dist-native, dist-plain, dist-links: every native, POTS and axe suite) and the two live suites, which
also write a production config listing the five modules that build calls (oauth, integrations, pulse,
push, ai). The hard-coded walks (`walk.mjs`, `axe.mjs`, `a12-8-plain/axe-expanded.mjs`,
`final-review/axe-edit.mjs`) click "Apple" and "Wearables", so they need an `all` build and must never
be pointed at a default-flag build. The uiux snap/axe demo builds pin the shipping defaults
(`VITE_FEATURES=` empty), and `lf/l4/flags-e2e.mjs` (in `pots/s9/run-all.sh`) checks the default,
`none` and `all` builds for DOM traces and requests.

## 11. Changing the record

**Adding a key**

1. Add it to `PERSISTED` in `src/lib/record.js`, give it a `RULES` entry and a typedef, and add it to
   `DEVICE_ONLY`, `DEVICE_PREFS` and/or `NOT_IN_BACKUP` when it belongs to this device.
2. Add its setter and value in App.jsx (`setters`, `values`); `record.test.mjs` fails without them.
3. Update the pinned literal lists in `record.test.mjs` and this document's §4 row.
4. It must default safely when it is missing: an older build still open in another tab saves only
   the keys it knows, so the key can be dropped from disk until the new tab saves again. A key that
   must survive that needs a second copy, as the POTS log has.
5. A PRIVACY-AUDIT entry (where it lives, whether it is in backups) and unit tests.

**Bumping `RECORD_VERSION`**

1. Only when an existing key's meaning or shape changes; a new optional key does not need it.
2. Add one pure step to `MIGRATIONS` (version n → a new record at n + 1) with unit tests.
3. Before the first bump, ship a newer-record guard (like `isLockedPots`) in an earlier release, so an
   older build left open in a tab can't save over a newer record.
4. Keep the IndexedDB key `v1` and the file name `cyra-state.json`.
5. Older builds reject a newer backup with "That backup is empty or from a different version".
