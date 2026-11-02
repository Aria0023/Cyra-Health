# Passive tracking plan: wearables, CGM, photo meals, pattern intelligence

Status: proposal, 2026-11-02. Nothing in this document is built yet. It answers the owner's brief
("dramatically reduce manual input by integrating passive and low-friction automated tracking") against
what Solia Health already has, and proposes the data model, the screens and the build order.

## 0. Where we start (what already exists)

| piece | state today |
| --- | --- |
| Apple Health / Health Connect | A native plugin (`CyraHealthPlugin.swift` / `.kt`) reads **sleeping wrist / skin temperature, resting heart rate, HRV, sleep** and returns one row per day. It runs only in the phone app. |
| Oura, Fitbit, Garmin, Whoop | Through the backend (`integrations` module: Oura direct, the rest via Terra). Readings pass through the server and are not stored there. Behind the `wearables` flag; **off in production**. |
| Storage | `wearSources` (connections) and `wearData` (daily rows `{date, temp, rhr, hrv, sleep, sourceId}`) in the record; in backups. |
| Use of the data | POTS patterns (`potsPatterns.js`), a line on Home, fertility signs (manual BBT only: `fertility.js` `bbtShift`). Nothing in cycle prediction, the pattern cards, the weekly review or the clinician summary reads wearable data yet. |
| Not read today | steps / activity, respiratory rate, sleep stages, blood glucose, HR during sleep. |
| Rules that bind this work | health data stays on the device unless an opt-in feature says exactly what it sends; no diagnosis; no scores or grades (readability pass, R3/R6); no calories; weight off by default; one life-stage experience; AA contrast and 44 px targets. |

So the highest-priority item is not "integrate HealthKit": it is **read more types, do it in the background,
and make the app use the data**. The sync plumbing is about 40 % built.

## 1. Data model

Design rule: passive data is a **second store beside the record**, not more keys inside it. The record stays
the small, hand-entered log (what she typed and tapped). Streams can be large (a CGM produces ~290 readings a
day), arrive out of order, get corrected by the source, and must be re-derivable. Keeping them apart means a
new source never changes `days`, `bodyLog` or the backup format, and a user who disconnects a source loses
only that source's rows.

### 1.1 `sources` (in the record; replaces `wearSources`, same shape plus the new fields)

```
sources: {
  [sourceId]: {
    kind: "healthkit" | "healthconnect" | "oura" | "terra" | "dexcom" | "mira" | "fibra" | "manual",
    status: "connected" | "needs-permission" | "paused" | "expired",
    grants: ["temp","rhr","hrv","sleep","sleepStages","steps","respRate","glucose","lh","e3g","pdg","fsh","ph"],
    consent: { at: iso, version: 2, textHash },   // the exact disclosure she agreed to
    lastSync: iso | null, lastError: string | null,
    viaServer: boolean,                           // true only for oura/terra/dexcom-api
    demo: boolean
  }
}
```

Every source shows the same disclosure structure: what is read, where it is processed (this phone), whether
anything passes through Solia Health's server (Oura, Terra and a vendor API do; Apple Health and Health
Connect never do), and that readings are never stored on the server. `consent.textHash` lets the app re-ask
when the disclosure changes.

### 1.2 `streams` (a new IndexedDB object store, device-only, NOT in the record)

```
streams: {                      // key: `${metric}|${sourceId}|${day}`
  metric: "temp"|"rhr"|"hrv"|"sleep"|"sleepStages"|"steps"|"respRate"|"glucose"|"lh"|"e3g"|"pdg"|"fsh"|"ph",
  sourceId, day: "YYYY-MM-DD",
  summary: { value, unit, n, min, max, ... },   // the daily number the UI and engine use
  series?: [[epochMinute, value], ...],         // intraday points; glucose, HR-in-sleep; capped (see 1.5)
  stages?: { awake, light, deep, rem, inBed },  // minutes
  rev: n, fetchedAt: iso
}
```

- The day is the **wake-up day** for overnight metrics (temperature, HRV, RHR, sleep), the calendar day for steps and glucose. That matches what the native plugin already does.
- `wearData` becomes a view over `streams` (one migration step in `record.js`: copy old rows into `streams`, keep `wearData` readable for one version, then drop it). RECORD_VERSION bumps to 2; this is the first real migration.
- Backups: `streams` is **not** in the encrypted backup by default (size: a year of CGM is ~10 MB). A "Include wearable and glucose history" tick adds it. Restoring without it is fine because sources re-sync the last 90 days.

### 1.3 `derived` (device-only cache, rebuilt from `streams` + record)

```
derived: {
  baselines: { [metric]: { overall: {mean, sd, n}, byPhase: { menstrual, follicular, ovulatory, luteal }, byCycleDayBucket } },
  cycles: { [cycleStartIso]: { ovulation: { status: "rise-seen"|"no-rise-seen"|"not-enough-data", day, confidence: "clear"|"possible", method: "temp"|"lh+temp" }, lutealDays } },
  glucoseDays: { [day]: { timeInRange, mean, sd, spikes: [{at, peak, mealId?}] } },
  readiness: { [day]: { sleep: "usual"|"lower"|"higher", hrv: ..., rhr: ..., temp: ..., words: "A lower-than-usual night" } }
}
```

Everything here is words and counts on screen ("lower than your usual for this phase"), never a 0–100 score.
`readiness` is the internal name; the UI never says "readiness score".

### 1.4 Record additions (small, hand-entered, in backups)

| key | what | why separate |
| --- | --- | --- |
| `confirmations` | `{ [day]: { sleep: "ok"|"edited", symptoms: [...], autoAccepted: iso } }` | the one-tap "looks right" on auto-filled days |
| `mealPhotos` | `{ id, day, at, kind?, energy?, tags[], est?: { protein: "low"|"some"|"high", fibre, glycaemic: "steady"|"mixed"|"fast" }, source: "photo"|"manual" }` | extends meal notes (R-meals); the photo itself is NOT stored in the record (see §4) |
| `hormoneTests` | `{ day, kind: "lh"|"e3g"|"pdg"|"fsh", value, unit, source }` | Mira-style numerical results; manual entry first |

### 1.5 Limits and lifetime

- Keep 400 days of daily summaries, 120 days of intraday glucose series, 30 days of HR-in-sleep series. Older intraday points are thinned to hourly. Delete everything from a source when she disconnects it ("Delete readings too" is the default).
- `streams` lives in a second IndexedDB store in the same database, so "Delete everything" and the app lock cover it.

## 2. The highest-impact screens (wearables + CGM)

### 2.1 Home: "Today's auto-tracked" card (replaces the manual-first top of the quick log)

```
TODAY · from your Apple Watch, synced 7:12 am
  Sleep 6 h 50 · a little less than usual       Temperature · at your usual
  HRV · lower than your luteal usual            Resting HR · usual
  [ Looks right ]   [ Add anything else? ]
```

- One tap on "Looks right" writes `confirmations[day]` and marks the day logged. The daily promise becomes **"confirm in 10 seconds"**; the splash line changes only once this is live.
- "Add anything else?" opens the existing log sheet with symptoms first.
- Each row's word compares to **her own baseline for this cycle phase** (`derived.baselines.byPhase`), so a luteal HRV dip reads "lower, which is usual for this part of your cycle" rather than a warning.
- When nothing synced: the card says so plainly ("No readings since Tuesday · Open the Health app?") and the manual tiles stay.

### 2.2 Body → Cycles: ovulation from temperature

- The cycle strip gains a marker per cycle: **"Temperature rise seen · day 32"**, "No sustained rise seen this cycle", or "Not enough nights". Method: a three-over-six rule on nightly temperature (3 consecutive nights ≥ 0.2 °C above the mean of the previous 6), computed on device; LH results, when present, must fall within the window for "clear".
- Wording stays guidance: "a rise consistent with ovulation", never "ovulation confirmed" alone, never contraception. Trying-to-conceive copy adds "Solia Health is not a contraceptive."
- The clinician summary gets a line per cycle: cycle length · rise seen on day N / no rise seen · luteal length.

### 2.3 Patterns: glucose over the cycle (CGM users)

- A day strip of glucose (line, with her own usual band, not clinical ranges unless she turns on "show the standard range") with **meal notes and symptoms as marks** and the cycle phase as a background band.
- Cards (same PatternCard format, same thresholds in `PATTERN_RULES`): "Spikier after mostly-carbs meals (12 of 15 vs 4 of 20)", "More variable in your luteal days", "Steadier on nights with 7 h+ sleep". Words only, no "time in range 68 %" on cards; the exact numbers live in "The numbers behind this" and in the PDF appendix.
- Nothing on this screen says "insulin resistance". The PCOS module's existing signals card can link to it with the guideline citation already in `modules.js`.

### 2.4 You → Data sources (replaces the wearables section of Settings)

- One row per source with status, what it reads, last sync, **"Where it goes"** (this phone only / through Solia Health's server), Pause, Disconnect (+ delete readings).
- Connect flow per source: disclosure sheet → system permission (HealthKit / Health Connect) or vendor sign-in (Oura, Dexcom) → first sync with a progress line → the Home card appears.
- A "Demo readings" switch exists already (`VITE_DEMO_WEARABLES`); keep it for screenshots and tests.

### 2.5 Check-in rhythm change

- If a source synced in the last 36 h, the daily reminder text becomes "Confirm today (10 s)" and the quick check-in opens on the auto-tracked card.

## 3. Wearable sync: implementation steps (priority 1)

| step | work | notes |
| --- | --- | --- |
| W1 | `streams` store + `sources` + migration v2 + unit tests + backup tick | `src/lib/streams.js`, `record.js`, `backup.js`, PRIVACY-AUDIT |
| W2 | Native plugin: add **steps, respiratory rate, sleep stages, HR during sleep**; iOS background delivery (`HKObserverQuery` + `enableBackgroundDelivery`), Android Health Connect reads on app open + a daily WorkManager job (Health Connect has no push) | iOS entitlement and Info.plist usage strings exist; add the new types to `NSHealthShareUsageDescription` and `PrivacyInfo.xcprivacy` |
| W3 | Sync scheduler on device: on app open, on resume, on background delivery; 90-day backfill on first connect; dedupe by `(metric, sourceId, day, rev)` | `src/lib/sync.js` |
| W4 | Baselines + phase normalisation (`derived.baselines`), ovulation rule, readiness words | `src/lib/signals.js` with tests on synthetic cycles incl. irregular 45-day and anovulatory cases |
| W5 | Home "Today's auto-tracked" card + confirmations; log sheet "Add anything else?" | reuse QuickTile/StepRail/Chip |
| W6 | Cycles ovulation markers; Patterns sleep/HRV cards; weekly review sentences; clinician summary lines | engine + patterns.js + clinicianSummary.js |
| W7 | You → Data sources screen; disclosures; delete-on-disconnect | replaces Settings wearables UI |
| W8 | Oura/Terra: map into `streams`; keep off in production until a privacy review of the server pass-through | no new server code |
| W9 | Turn the `wearables` flag ON in production **for on-phone sources only** (new sub-flag `wearables=device`) | server sources stay off |

Owner actions: Apple developer account with HealthKit capability (already configured in the Xcode project), a Health Connect declaration in the Play Console, clinician review of the ovulation and baseline wording, Mozilla-style privacy review before marketing it.

## 4. CGM (priority 2)

- **First path: Apple Health / Health Connect, not vendor APIs.** Dexcom's and Abbott's phone apps write glucose into Apple Health (`bloodGlucose`) and Health Connect (`BloodGlucoseRecord`) on many setups; reading it there keeps everything on the phone and needs no new server code. This must be verified per device during the build; Stelo and Lingo behaviour differs by region and app version.
- **Second path: Dexcom API** (official developer program, OAuth, sandbox). Needs a backend pass-through like Oura's, a disclosure, and the same "readings not stored" rule. Abbott Lingo has no public API known at the time of writing; LibreView-based unofficial routes are not acceptable.
- Model: `streams.metric = "glucose"` with 5-minute `series`; `derived.glucoseDays` computes mean, SD, her usual band (10th–90th percentile of her own last 14 days), spikes (rise ≥ 2 mmol/L / 36 mg/dL within 60 min), and meal attribution to `mealPhotos`/meal notes within a 2 h window.
- Screens: §2.3; plus a "Glucose" row in Body → Logs and a tick on the clinician summary ("Add glucose summary": mean, variability words, spikes per week, time in her usual band; the standard 70–180 range only if she ticks "show the standard range").
- Wording: "may relate to insulin resistance" appears once, in the PCOS module card, with the guideline citation; never on a glucose card.

## 5. Photo meals with AI estimation (priority 3) — build last, and differently from the brief

Three conflicts with the product's own rules, and a recommendation:

1. **Photos cannot be analysed on the phone with today's bundle.** Any useful estimate means sending the photo to the backend proxy and on to an AI provider. That is a new category of data leaving the device (an image of a plate, often with a table, a hand, a room). It can be done under the existing "What Solia Health will send" preview, but the preview must show the photo and the user must know the provider sees it.
2. **"PCOS-friendliness score" breaks the no-scores rule** and the buyer panel's objection to diet judgement. Recommendation: estimates in words only ("protein: some · fibre: low · likely fast-rising"), no score, no "friendly/unfriendly".
3. **Calories and macros are excluded** by the owner's brief. Protein/fibre/glycaemic words are allowed; grams are not shown.

Build: `mealPhotos` entry → optional "Estimate from a photo" (Pro, off by default, consent per photo, photo deleted after the reply, never stored) → words into the meal note → the glucose attribution in §4 uses it. Offline: she can tag the meal by hand exactly as today.

## 6. Specialised devices (priority 4, future-ready now)

- `hormoneTests` and the `lh/e3g/pdg/fsh/ph` metrics exist from W1, with manual entry in the PCOS signals sheet and a "Mira export" importer (CSV) when their export format is confirmed. No vendor API work until one exists publicly.
- Fibra-style underwear: `ph` and discharge categories reserved in the model; UI only when there is a source.

## 7. Pattern intelligence (priority 5)

- Extend `patterns.js` with stream-aware questions (sleep → symptoms, HRV by phase, temperature rise → cycle length, glucose variability → meal kinds, glucose → sleep), same `PATTERN_RULES` thresholds, same "Not enough information" honesty.
- Weekly review: one sentence per supported pattern, e.g. "Temperature rose on day 32; HRV was lower in the 5 days before; glucose was spikier on 3 of 4 mostly-carb days." Each clause only when its rule passes.
- Clinician summary: ovulation per cycle, sleep/HRV trend line, glucose summary (tick), all as counts and words.
- Natural-language questions ("Why did my energy crash this week?"): the existing Pro chat, with the pseudonymised summary extended by stream aggregates (weekly means, counts, phase words; never raw series, never timestamps). Update `SUMMARY_PATHS`, the backend allowlist, the preview and the audit together, as R8 requires.

## 8. UX and flow (priority 6)

- Home order when a source is connected: auto-tracked card → Looks right / Add anything else → small step → the rest.
- Splash promise: "Track in 30 seconds a day" becomes "Confirm in 10 seconds with a watch, 30 without" once W5 ships.
- Offline-first stays true: every stream is read into the phone; nothing syncs anywhere unless a server source is on.
- Accessibility: every word-state has a text label; the glucose strip has a table alternative ("The numbers behind this"); 44 px targets; AA in all five styles.

## 9. Order of work and sizing

1. W1–W4 (model, native reads, scheduler, signals): the foundation; ~2 weeks of agent slices, full suite at the end.
2. W5–W7 (Home card, cycles/patterns/summary, data-sources screen): ~2 weeks; screenshots in all styles.
3. W9 production flag for device sources; store privacy labels updated.
4. CGM via Health platforms (§4 first path): ~1 week after W4.
5. Pattern intelligence and chat summary fields (§7): ~1 week.
6. Dexcom API, photo meals, Mira import: only after the above is in users' hands and the privacy review is done.

Every slice: one commit, unit tests for the pure logic, the full suite set, axe in both schemes, PRIVACY-AUDIT and CLINICIAN-REVIEW updated in the same commit, nothing merged without the owner's go.
