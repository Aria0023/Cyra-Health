# Passive tracking plan v2: a two-week spike first, then wearables, CGM and the rest

Status: plan v2, 2026-11-04 (v1 was 2026-11-02). The owner approved nine improvements to v1 on 2026-11-04 and this
version folds them in. Everything the spike builds (S1–S3 in §3) is being built now; everything after it is still a
proposal. It answers the owner's brief ("dramatically reduce manual input by integrating passive and low-friction
automated tracking") against what Solia Health already has, and proposes the data model, the screens and the build
order.

## 0. Where we start (what already exists)

| piece | state today |
| --- | --- |
| Apple Health / Health Connect | A native plugin (`CyraHealthPlugin.swift` / `.kt`) reads **sleeping wrist / skin temperature, resting heart rate, HRV, sleep** and returns one row per day `{ date, temp, rhr, hrv, sleep }` (the day is the wake-up day). It runs only in the phone app, when the app is open. |
| Oura, Fitbit, Garmin, Whoop | Through the backend (`integrations` module: Oura direct, the rest via Terra). Readings pass through the server and are not stored there. Behind the `wearables` flag; **off in production**. |
| Storage | `wearSources` (connections) and `wearData` (daily rows `{date, temp, rhr, hrv, sleep, sourceId}`) in the record; in backups. |
| Use of the data | POTS patterns (`potsPatterns.js`), a line on Home, fertility signs (manual BBT only: `fertility.js` `bbtShift`). Nothing in cycle prediction, the pattern cards, the weekly review or the clinician summary reads wearable data yet. |
| Not read today | steps / activity, respiratory rate, sleep stages, blood glucose, HR during sleep. |
| Rules that bind this work | health data stays on the device unless an opt-in feature says exactly what it sends; no diagnosis; no scores or grades (readability pass, R3/R6); no calories; weight off by default; one life-stage experience; AA contrast and 44 px targets. |

### 0.1 What the spike proves (improvement 1)

Before any new permission, background job, vendor API or CGM work, a **two-week spike** on the four readings the
plugin already returns (temperature, resting heart rate, HRV, sleep, one row per day) has to show that passive data
changes something a person would bring to a PCOS appointment and that she will confirm it in seconds. The spike
adds no native permission, no Health Connect background job and no CGM. It is three commits (§3, S1–S3) and ends
with the numbers in §8, measured on the device only.

**Priority (improvement 2):** what changes a PCOS appointment comes first — an ovulation / cycle-day read from
temperature ("a rise consistent with ovulation on day 32", "no sustained rise this cycle", "not enough nights")
per cycle, in the Cycles list, in the weekly review and as a cycle table in the clinician PDF. Sleep and HRV are
context ("HRV · lower, usual for your luteal days"), never a verdict and never a score.

So the highest-priority item is still not "integrate HealthKit": it is **make the app use the readings it already
has, with honest data-quality rules, and prove that a person confirms rather than types**.

## 1. Data model

Design rule: passive data is a **second store beside the record**, not more keys inside it. The record stays the
small, hand-entered log (what she typed and tapped). Streams can be large (a CGM produces ~290 readings a day),
arrive out of order, get corrected by the source, and must be re-derivable. Keeping them apart means a new source
never changes `days`, `bodyLog` or the backup format, and a user who disconnects a source loses only that source's
rows.

**The spike keeps today's storage.** One row per day in `wearData` is small (a year is ~365 rows), so S1–S3 keep
`wearSources` / `wearData` as they are and add only the small record keys in §1.4. The `streams` store (§1.2) comes
with the first intraday source (CGM, HR during sleep). No raw intraday series exists in this build and none goes
into a backup (`record.js` `backupCopy` strips any `series` field a future row might carry; unit-tested).

### 1.1 `sources` (later; today `wearSources`, same shape plus the new fields)

```
sources: {
  [sourceId]: {
    kind: "healthkit" | "healthconnect" | "oura" | "terra" | "dexcom" | "manual",
    status: "connected" | "needs-permission" | "paused" | "expired",
    grants: ["temp","rhr","hrv","sleep","sleepStages","steps","respRate","glucose"],
    consent: { at: iso, version: 2, textHash },   // the exact disclosure she agreed to
    lastSync: iso | null, lastError: string | null,
    viaServer: boolean,                           // true only for oura/terra/dexcom-api
    prefer: ["temp", "hrv"],                      // the metrics this source is the preferred one for (spike: in wearSources)
    paused: boolean,                              // spike: in wearSources
    demo: boolean
  }
}
```

Every source shows the same disclosure structure: what is read, where it is processed (this phone), whether
anything passes through Solia Health's server (Oura, Terra and a vendor API do; Apple Health and Health Connect
never do), and that readings are never stored on the server. `consent.textHash` lets the app re-ask when the
disclosure changes.

### 1.2 `streams` (later: a new IndexedDB object store, device-only, NOT in the record)

```
streams: {                      // key: `${metric}|${sourceId}|${day}`
  metric: "temp"|"rhr"|"hrv"|"sleep"|"sleepStages"|"steps"|"respRate"|"glucose",
  sourceId, day: "YYYY-MM-DD",
  summary: { value, unit, n, min, max, ... },   // the daily number the UI and engine use
  series?: [[epochMinute, value], ...],         // intraday points; glucose, HR-in-sleep; capped (see 1.5)
  stages?: { awake, light, deep, rem, inBed },  // minutes
  rev: n, fetchedAt: iso
}
```

- The day is the **wake-up day** for overnight metrics (temperature, HRV, RHR, sleep), the calendar day for steps and glucose. That matches what the native plugin already does; `signals.js` `wakeDay()` applies the same rule to any row that carries a timestamp instead of a day.
- `wearData` becomes a view over `streams` (one migration step in `record.js`: copy old rows into `streams`, keep `wearData` readable for one version, then drop it). RECORD_VERSION bumps to 2; this is the first real migration.
- Backups: `streams` is **not** in the encrypted backup by default (size: a year of CGM is ~10 MB). A "Include wearable and glucose history" tick adds it. Restoring without it is fine because sources re-sync the last 90 days.

### 1.3 `derived` (device-only cache, rebuilt from the rows + record; in the spike it is computed on render by `lib/signals.js`, nothing is stored)

```
derived: {
  baselines: { [metric]: { overall: {mean, sd, n}, byPhase: { menstrual, follicular, ovulatory, luteal } } },
  cycles: { [cycleStartIso]: { ovulation: { status: "rise-seen"|"no-rise-seen"|"not-enough-nights", day, confidence: "clear"|"possible" }, lutealDays } },
  glucoseDays: { [day]: { timeInRange, mean, sd, spikes: [{at, peak, mealId?}] } },   // later
  readiness: { [day]: { sleep: "usual"|"lower"|"higher", hrv: ..., rhr: ..., temp: ..., words } }
}
```

Everything here is words and counts on screen ("lower than your usual for this phase"), never a 0–100 score.
`readiness` is the internal name; the UI never says "readiness score".

### 1.4 Record additions (small, hand-entered, in backups unless marked)

| key | what | why separate |
| --- | --- | --- |
| `confirmations` | `{ [day]: { at: iso, took?: ms, via: "app"|"notification" } }` | the one-tap "Looks right" on an auto-tracked day: when, how long from the card appearing to the tap, and whether it came from the app or the notification. Record, in backups. |
| `nightSkips` | `{ [day]: "fever"|"alcohol"|"travel"|"other" }` | "Skip this night": a night she says not to use (fever or illness, alcohol, travel, other). Record, in backups. The reading stays in `wearData`; the signals library leaves it out. |
| `wearSources[id].prefer` | `["temp", …]` | one preferred source per metric when two sources cover the same night; the others show as "also from". In the existing key, so in backups as before. |
| `trackStats` | `{ confirmed, fast, tooks: [ms…], sourceSince, firstConfirm }` | the spike's success numbers (§8), **device-only and never in any backup, never sent**; shown in You → Data sources → "How this is going" and in the dev gallery. |
| `mealPhotos` (later) | `{ id, day, at, kind?, energy?, tags[], est?, source }` | extends meal notes (R-meals); the photo itself is NOT stored in the record (see §5, Later) |
| `hormoneTests` (later) | `{ day, kind: "lh"|"e3g"|"pdg"|"fsh", value, unit, source }` | numerical hormone results; manual entry first (see §6, Later) |

### 1.5 Limits and lifetime

- Keep 400 days of daily summaries, 120 days of intraday glucose series, 30 days of HR-in-sleep series. Older intraday points are thinned to hourly. Delete everything from a source when she disconnects it ("Delete readings too" is the default, on in the spike's Data sources screen).
- `streams` lives in a second IndexedDB store in the same database, so "Delete everything" and the app lock cover it.

### 1.6 Data-quality rules (improvement 3; `lib/signals.js`, unit-tested on synthetic cycles)

1. **Minimum nights before any ovulation wording.** A cycle needs at least 10 valid nights, and at least 6 valid
   nights before a candidate rise, before the app says anything about a rise. Below that the cycle reads "Not enough
   nights", in the Cycles list, the review and the PDF table alike.
2. **"Skip this night".** One tap on the Home card opens a reason picker (Fever or illness · Alcohol · Travel ·
   Other). The night is kept in `wearData` but left out of every baseline, rise test and card (`nightSkips`, on the
   device and in backups). The PDF appendix states how many nights were skipped.
3. **One preferred source per metric.** When two sources cover one night (a watch and a ring), the preferred source's
   reading is the one used; the other shows as "also from Oura Ring" on the card. The choice is per metric, in You →
   Data sources.
4. **Fever-like outliers.** A night more than 1.0 °C above the mean of the valid nights around it is left out of the
   rise test and the baselines, with a note on the card ("Left out: much higher than your other nights"). She can
   still mark the night as a fever or illness.
5. **Night assignment by wake day.** A night belongs to the local day it ends on (the wake-up morning). The plugins
   already count this way; a row with a timestamp instead of a day goes through `wakeDay()`, which uses the device's
   local day at the end of the night, so a time-zone change moves nothing twice.
6. **Readings against her own baseline, by phase.** Words ("usual", "lower", "higher") compare the night with the
   mean ± 1 standard deviation of her own valid nights in the same cycle phase (menstrual, follicular, ovulatory,
   luteal), each phase needing at least 7 nights; with fewer, the overall baseline is used, and with fewer than 7
   overall the card says "A few more nights will show your usual".

## 2. The highest-impact screens (wearables + CGM)

### 2.1 Home: "Today's auto-tracked" card (above the Quick log, S2)

```
TODAY'S AUTO-TRACKED · Apple Watch · Health app, synced 7:12 am
  Sleep · usual                      Temperature · at your usual
  HRV · lower, usual for your luteal days     Resting HR · usual
  [ Looks right ]   [ Add anything else? ]          Skip this night
```

- Shown when a real (non-demo) source has a row from the last 36 hours, or in a demo build. One tap on "Looks
  right" writes `confirmations[day]` (`took` is measured from the card appearing) and Home shows the day as
  confirmed (the today line and the Body rail). It never invents a symptom: no day entry is written, so nothing it
  does not know enters the day reading or the patterns. "Add anything else?" opens the log sheet with symptoms
  first.
- Each row's word compares to **her own baseline for this cycle phase** (§1.6, rule 6), so a luteal HRV dip reads
  "lower, usual for your luteal days" rather than a warning.
- "Skip this night" opens the reason picker (§1.6, rule 2). "Also from Oura Ring" appears under a row when a second
  source covers the same night.
- When nothing synced: the card says so plainly ("No readings since Tuesday") with "Open the Health app" on iPhone
  (the Health app's own link), "Sync now" on Android (Health Connect has no link to open; a sync reads on open) and
  nothing to tap on the web.
- The daily promise becomes **"confirm in 10 seconds"**; the splash line changes only once the pilot numbers (§8) say
  people do confirm.

### 2.2 Body → Cycles: ovulation from temperature (S2)

- Each cycle in the list gains a marker: **"Temperature rise seen · day 32"**, "No sustained rise seen this cycle",
  or "Not enough nights". Method: a three-over-six rule on nightly temperature (3 consecutive nights at least 0.2 °C
  above the mean of the 6 valid nights before them), computed on the device by `signals.js` `ovulationFor()` with
  §1.6's rules; a positive LH test (fertility signs) within 2 days of the rise makes the confidence "clear",
  otherwise "possible". The luteal length (rise day to the next period start) shows on finished cycles.
- Wording stays guidance: "a rise consistent with ovulation", never "ovulation confirmed", never contraception.
  Trying to conceive adds "Solia Health is not a contraceptive." once, under the list.
- The clinician summary gets the cycle table (§2.7) instead of a line per cycle.

### 2.3 Patterns: glucose over the cycle (CGM users; later, §4)

- A day strip of glucose (line, with her own usual band, not clinical ranges unless she turns on "show the standard range") with **meal notes and symptoms as marks** and the cycle phase as a background band.
- Cards (same PatternCard format, same thresholds in `PATTERN_RULES`): "Spikier after mostly-carbs meals (12 of 15 vs 4 of 20)", "More variable in your luteal days", "Steadier on nights with 7 h+ sleep". Words only, no "time in range 68 %" on cards; the exact numbers live in "The numbers behind this" and in the PDF appendix.
- Nothing on this screen says "insulin resistance". The PCOS module's existing signals card can link to it with the guideline citation already in `modules.js`.

### 2.4 You → Data sources (S3)

- One card, one row per source: status, what it reads, last sync, **"Where it goes"** (this phone only / through
  Solia Health's server), Pause, Disconnect (+ "Delete readings too", on by default). A preferred-source picker per
  metric appears once two sources are connected. A "Demo readings" switch exists in demo builds only
  (`VITE_DEMO_WEARABLES`), for screenshots and tests, and says so.
- **"How this is going"**: the spike's numbers from `trackStats` (days confirmed, median seconds to confirm, source
  connected since) with the sentence "Kept on this device, never sent." The pilot reads them with the person present
  (§8).
- Connect flow per source: disclosure sheet → system permission (HealthKit / Health Connect) or vendor sign-in (Oura)
  → first sync with a progress line → the Home card appears. Home keeps its Wearables door with the connect rows and
  the averages (the suites assert it); the panel points to You → Data sources for everything else.

### 2.5 Check-in rhythm change (S2)

- If a source synced in the last 36 h, the daily reminder text becomes "Confirm today (10 s)" (phone: the local
  notification is rescheduled with that body; web: the server sends the plain reminder it always did, see §2.6) and
  the Home card is the first thing under the hero.

### 2.6 The morning notification with the confirm action on it (improvement 5, S3)

- **Phone:** a LocalNotifications action type `confirm-night` with two actions, **Looks right** and **Open**. After
  a sync that brings last night's row, when today isn't confirmed yet, the app schedules "Last night synced. Looks
  right?" for 07:00 local if it is earlier than that (never before 7:00; nothing if the night is already
  confirmed). Tapping **Looks right** fires `localNotificationActionPerformed`; the app's handler writes
  `confirmations[day]` with `via: "notification"` and `took` from the notification's delivery, without opening a
  screen. **Open** opens Home on the card.
- **Honest limit of the spike:** the app only syncs while it runs (open, resumed, Sync tapped), so in this build the
  notification fires when a sync happened before 07:00 (for example the app resumed early). The useful version —
  "the watch synced overnight" — needs iOS background delivery, which §4 says is occasional, and a scheduled job on
  Android (§3, W2). The reminder path for people without a source is untouched.
- **Web:** the push payload gains `type: "confirm-night"` with the actions `[{ action: "ok", title: "Looks right" },
  { action: "open", title: "Open" }]`; the service worker shows the action buttons, and on "Looks right" posts a
  message to an open Solia Health page (which writes the confirmation) or opens the page at `#/confirm/<day>`, which
  writes it on load. A browser gets this payload only when it subscribed with `confirm: true` (the app sets it while
  a source synced in the last 36 h; the server keeps the flag beside the cadence, nothing else).

### 2.7 Clinician PDF: the cycle table (improvement 4, S2)

- When temperature rows exist, page 1's Cycles section becomes a **table** (never a chart) of the last 6–12 cycles:
  start · length · bleeding days · temperature rise ("seen, day 14", "no sustained rise", "not enough nights") ·
  luteal length. The strip stays when there are no temperature rows. `fitSummary` keeps page 1 to one page on Letter
  and A4 by trimming the table to 6 rows before anything else. The appendix lists how many nights were skipped and
  why.

## 3. Build order: the spike first (S1–S3), then the rest

| step | work | notes |
| --- | --- | --- |
| **S1** | **Signals library and the source adapter.** `src/lib/signals.js` (pure: `nightlyTemps`, `excludeOutliers`, `baselines`, `ovulationFor`, `cycleTable`, `readinessWords`, `wakeDay`), synthetic fixtures (`signalsFixtures.js`: regular 28, irregular 45 with a late rise, anovulatory, 4 skipped nights, a fever night, two sources for one night, a wake-day boundary across a time zone) and ≥ 25 unit tests; `src/lib/sources.js`, the adapter seam `{ id, name, viaServer, read({ fromIso, toIso }) → WearRow[] }` with adapters for demo, healthkit, oura and terra; record keys `nightSkips`, `confirmations`, `trackStats`, `wearSources[id].prefer` (§1.4) | `record.js` PERSISTED / RULES / typedefs; PRIVACY-AUDIT; unit tests |
| **S2** | **Home card, confirmations, cycle markers, PDF table, review sentence** (§2.1, §2.2, §2.5, §2.7; Patterns gains two cards — lower-than-usual sleep nights vs her top symptom, HRV lower-than-usual days vs mood or energy — through `PATTERN_RULES`, and the weekly review one sentence when a rule passes: "Temperature rose on day 32; HRV was lower in the 5 days before.") | engine + patterns.js + clinicianSummary.js; CLINICIAN-REVIEW; PRIVACY-AUDIT |
| **S3** | **Confirm from the notification, Data sources, the production flag, stats** (§2.6, §2.4, §8); the `deviceSync` flag (W9 below), on by default: on-phone sources are offered in the phone app's default build, Oura and Terra stay behind `wearables` | features.js, flags-e2e, build-dists, render.yaml, .env.example, the dev gallery |
| W1 | `streams` store + `sources` + migration v2 + unit tests + backup tick | after the spike; `src/lib/streams.js`, `record.js`, `backup.js`, PRIVACY-AUDIT |
| W2 | Native plugin: add **steps, respiratory rate, sleep stages, HR during sleep**; iOS background delivery (`HKObserverQuery` + `enableBackgroundDelivery`; occasional, see §4), Android Health Connect reads on app open + a daily WorkManager job (Health Connect has no push) | iOS entitlement and Info.plist usage strings exist; add the new types to `NSHealthShareUsageDescription` and `PrivacyInfo.xcprivacy`; a Health Connect declaration in the Play Console |
| W3 | Sync scheduler on device: on app open, on resume, on background delivery; 90-day backfill on first connect; dedupe by `(metric, sourceId, day, rev)` | `src/lib/sync.js` |
| W8 | Oura/Terra: map into `streams`; keep off in production until a privacy review of the server pass-through | no new server code |
| W9 | The production flag: `deviceSync` (on-phone sources only) is on by default from S3; `wearables` (server sources) stays off until the review above | done in S3 for the device part |

Owner actions: Apple developer account with HealthKit capability (already configured in the Xcode project), a Health
Connect declaration in the Play Console, clinician review of the ovulation, baseline and card wording
(docs/CLINICIAN-REVIEW.md "Auto-tracked"), the pilot's measurement protocol (§8), a Mozilla-style privacy review
before marketing it.

## 4. CGM (after the spike; via health platforms only)

- **Only path in this plan: Apple Health / Health Connect, not vendor APIs, and only after the spike** (improvement
  6). Dexcom's and Abbott's phone apps are documented as writing glucose into Apple Health (`bloodGlucose`) and
  Health Connect (`BloodGlucoseRecord`) on many setups; reading it there keeps everything on the phone and needs no
  new server code.
- **Honest platform notes (improvement 7):**
  - Whether Dexcom (G7, Stelo) and Abbott (Libre, Lingo) write to Apple Health / Health Connect on a given phone,
    region and app version is **unverified**: it has to be checked per device during the build, and the UI must say
    "no readings found" rather than assume.
  - **iOS background delivery is occasional.** `enableBackgroundDelivery` wakes the app at most hourly for most
    types and only when the system allows; a morning notification that depends on it will sometimes come late or
    not at all. The plan treats background delivery as a bonus, not a promise.
  - **Android has no background delivery.** Health Connect is read when the app opens (and, after W2, by a scheduled
    job that may be deferred by battery policy). "Last night synced" on Android therefore means "synced when you
    opened the app or when the job ran".
- **Not in this plan:** the Dexcom developer API (OAuth, a backend pass-through like Oura's), Abbott Lingo (no public
  API known at the time of writing), LibreView-based unofficial routes (not acceptable).
- Model: `streams.metric = "glucose"` with 5-minute `series`; `derived.glucoseDays` computes mean, SD, her usual band (10th–90th percentile of her own last 14 days), spikes (rise ≥ 2 mmol/L / 36 mg/dL within 60 min), and meal attribution to meal notes within a 2 h window.
- Screens: §2.3; plus a "Glucose" row in Body → Logs and a tick on the clinician summary ("Add glucose summary": mean, variability words, spikes per week, time in her usual band; the standard 70–180 range only if she ticks "show the standard range").
- Wording: "may relate to insulin resistance" appears once, in the PCOS module card, with the guideline citation; never on a glucose card.

## 5. Later: photo meals with AI estimation (cut from this build; improvement 6)

Three conflicts with the product's own rules, and a recommendation, kept here for when this is picked up again:

1. **Photos cannot be analysed on the phone with today's bundle.** Any useful estimate means sending the photo to the backend proxy and on to an AI provider. That is a new category of data leaving the device (an image of a plate, often with a table, a hand, a room). It can be done under the existing "What Solia Health will send" preview, but the preview must show the photo and the user must know the provider sees it.
2. **"PCOS-friendliness score" breaks the no-scores rule** and the buyer panel's objection to diet judgement. Recommendation: estimates in words only ("protein: some · fibre: low · likely fast-rising"), no score, no "friendly/unfriendly".
3. **Calories and macros are excluded** by the owner's brief. Protein/fibre/glycaemic words are allowed; grams are not shown.

If built: `mealPhotos` entry → optional "Estimate from a photo" (Pro, off by default, consent per photo, photo deleted after the reply, never stored) → words into the meal note → the glucose attribution in §4 uses it. Offline: she can tag the meal by hand exactly as today.

## 6. Later: specialised devices (cut from this build; improvement 6)

- Mira-style hormone tests: `hormoneTests` and the `lh/e3g/pdg/fsh` metrics, with manual entry in the PCOS signals sheet and a CSV importer when the export format is confirmed. No vendor API work until one exists publicly.
- Fibra-style underwear: `ph` and discharge categories reserved in the model; UI only when there is a source.
- Dexcom vendor API: see §4, not in this plan.

## 7. Pattern intelligence (S2 starts it; the rest after the spike)

- S2 extends `patterns.js` with two wearable cards (lower-than-usual sleep nights vs her top symptom; HRV lower-than-usual days vs mood or energy), same `PATTERN_RULES` thresholds, same "Not enough information" honesty, and the weekly review's one sentence when a rule passes ("Temperature rose on day 32; HRV was lower in the 5 days before.").
- Later: temperature rise → cycle length, glucose variability → meal kinds, glucose → sleep; clinician summary glucose summary (tick); the Pro chat's pseudonymised summary extended by stream aggregates (weekly means, counts, phase words; never raw series, never timestamps), updating `SUMMARY_PATHS`, the backend allowlist, the preview and the audit together, as R8 requires.

## 8. Success numbers for the spike (improvement 8; measured on the device only, no analytics)

The app has no analytics and gets none. The three numbers below are kept in `trackStats` on the device (never in a
backup, never sent) and shown in You → Data sources → "How this is going" and in the dev gallery; the pilot reads
them **with the person present** (she opens the screen, the interviewer notes the numbers).

| number | how it is measured | target for "go" |
| --- | --- | --- |
| share of days confirmed in under 15 s | `confirmations[day].took` (card shown → Looks right) over the days a source synced; `trackStats.fast / trackStats.confirmed` | ≥ 70 % |
| share of pilot users with a source connected at day 30 | pilot interviews at day 30: You → Data sources shows a connected source (`trackStats.sourceSince`) | ≥ 50 % |
| paid-conversion change among connected users | pilot: Pro take-up among people with a source connected vs without, asked in the interview (Solia Health has no purchase data in this build) | any positive difference |

Pilot protocol (owner): 10–20 people with a watch or ring, two weeks, a day-30 interview; nothing leaves the device
except what she reads out.

## 9. Order of work and sizing

1. **S1–S3 (the spike):** signals library + adapter seam, Home card / cycles / PDF table / review, notification confirm + Data sources + the device flag + stats. ~2 weeks of agent slices, the full suite set after each.
2. **Pilot and the §8 numbers:** two weeks with real devices; the clinician review of the wording in parallel.
3. W1–W3 (streams store, more native reads, background delivery where it exists, scheduler): ~2 weeks; store privacy labels updated.
4. CGM via Health platforms (§4): ~1 week after W3, per-device verification first.
5. Pattern intelligence and chat summary fields (§7): ~1 week.
6. Oura/Terra in production (W8), photo meals, Mira import, a vendor API: only after the above is in users' hands and the privacy review is done.

Every slice: one commit, unit tests for the pure logic, the full suite set, axe in both schemes, PRIVACY-AUDIT and CLINICIAN-REVIEW updated in the same commit, nothing merged without the owner's go.
