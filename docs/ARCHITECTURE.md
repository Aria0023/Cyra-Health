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
  the server answers one request per launch, once a life stage is set, for last week's anonymous
  counts (no health data, no life stage and no identifier, only what any request carries: IP address
  and user agent), and otherwise handles only the features she turns on or starts (sign-in, web
  reminders, sharing weekly counts, Cyra's AI, wearable connections), each as its disclosure says
  (the README's Privacy section, the `src/App.jsx` header). It never receives the record. An
  optional backup must be encrypted on the device with a key she holds.
- **Guidance, not diagnosis.** Analyses are computed from her own log, on the device, and say
  what to ask, never what she has.

## 2. Layers and modules

```
UI          src/screens/*.jsx, src/components/**/*.jsx          (props in, callbacks out)
  ↓
State       src/App.jsx  (useState / useMemo, the 400 ms autosave, cross-tab messages)
  ↓
Pure lib    engine.js  ←  record.js, pots.js (+ potsPatterns, potsReport, potsMove)
            constants.js, appearance.js, askLibrary.js;  plan.js stands alone
  ↓
I/O lib     storage.js, backup.js, files.js, native.js, api.js
            (pulse.js, notifications.js and wearables.js call api.js)
  ↓
Device storage (IndexedDB / app sandbox)          optional server (VITE_API_BASE)
```

Dependency rules (unit-tested where a test can see them):

- `engine.js` is the lowest pure layer. `record.js` and `pots.js` may import it; it never imports
  them (`record.test.mjs` "layering and no I/O").
- `record.js` imports only `./engine.js` and `./constants.js` (the allowed list lives in
  `record.test.mjs`; a later pure leaf module may be added to it, and none of them may import
  `record.js` back). `plan.js` imports nothing.
- Pure modules never import `api.js`, `native.js` or `storage.js`, and never read `import.meta.env`,
  so `node --test` can load them. (`pwa.js`, `links.js`, `api.js` and `wearables.js` read build
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
  stress: 0–10 }, sleepQ?: good | fair | poor, period?: boolean, flow?, disch?, odor?, bodyOdor? }`.
  Older records and `seed()` may carry only date, sleepQ, period and sym. At most one entry per date
  (`upsertDay`); `entryFor` returns the first one, as `days.find` did.
- **PregEntry** — `{ sym, kicks?, scales?, odor?, bodyOdor? }`, kept in `pregLog` by date.
- **Cycle** (derived, never stored) — `{ start, next, length, counted, periodDays }` from
  `cyclesFrom(days)`.
- **Settings group** — Settings, StoredReminders, Account, Med, Appt, ConnEntry, WearRow,
  PulseQueue, PulseSent, KickTally. The POTS log's shape is `lib/pots.js`'s.

Symptom ids are stable keys and are never reused for another meaning, so an old entry always reads
the same way. `sym` may hold ids from any library: `seed()` already writes `eng`, and a later slice
lets her log a symptom from another stage's library. `validateRecord()` checks all of this, but only
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
  AES-256-GCM) → a download on the web or the share sheet on the phone. Cyra never receives it.
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

## 10. Feature flags and plan hooks

A feature that is optional on the server side or paid passes three gates, in this order:

1. **Build flag** — `src/lib/features.js` arrives in L4 (read from `VITE_FEATURES`, a comma list;
   `all` turns everything on). Planned flags per decision D2: wearables, counts, ai, webReminders,
   cloudBackup, with production defaults off / off / on / on / off. L4 replaces this section with the
   real table.
2. **Plan** — `src/lib/plan.js` (`can(feature)`, the one entitlements object; today one free plan).
3. **Her own opt-in** — the switch or consent on the screen, off until she turns it on.

A screen never compares tier names; it asks `can(feature)`, which says no to anything it doesn't
know. The free core, the paid extension points and the rules any paid feature must follow are in
`docs/MONETIZATION.md`.

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
