# CYRA HEALTH — BUILD SPECIFICATION

> **How to use this document:** Paste it to a coding AI with the instruction:
> *"Build this application exactly to spec. Follow the data model, thresholds, and
> algorithms precisely. Where the spec is silent, ask before deviating."*
> This is a specification, not a description — every constant here is normative.

---

## 1. WHAT THIS IS

A women's hormonal-health tracking app spanning the full female lifespan. The user
tracks symptoms in ~30 seconds a day; the app finds patterns and converts them into
plain-language guidance and a script for her doctor's appointment.

**Core product thesis:** the valuable output is not the tracking — it is being taken
seriously by a clinician. Every feature serves that.

**Non-negotiable principles (these are product requirements, not aspirations):**
- Health data is stored **on-device**. Servers never receive raw health entries.
- Nothing is sold. Partners receive an anonymous token only.
- The app gives **educational guidance and options, never diagnosis or dosing.**
- Evidence labels are honest, including "comfort, not a treatment."
- The user sees **exactly one life-stage experience**, never a menu of all three.

---

## 2. TECH STACK & CONSTRAINTS

- **Frontend:** React 18, single file, functional components + hooks only.
- No routing library — state-driven view switching.
- No CSS framework — one `<style>` block with CSS custom properties.
- **State:** `useState` / `useMemo` only. No Redux, no context needed.
- **Persistence:** device-local storage only (src/lib/storage.js: IndexedDB on the web, one file in the app sandbox on the phone); the record's shape, version and keys are defined in src/lib/record.js. Never send health data to a server.
- **Fonts:** Fraunces (headings, serif) + Karla (body, sans) via Google Fonts.
- **Mobile-first:** max-width 430px, centered.
- **AI calls:** must have a deterministic fallback so the app never breaks offline.
- **PWA shell (web):** `public/manifest.webmanifest`, five committed PNG icons (`scripts/make-icons.py`) and a
  precaching service worker (`public/sw.js`, filled in at build time by the `cyraServiceWorker` plugin in
  `vite.config.js`) make the web build installable and let it open without a connection once it holds a record.
  The worker keeps only Cyra's own files, never health data or server answers; the phone app never registers it
  (A14.1).

---

## 3. DATA MODEL

### 3.1 Day entry (the core record)
```js
{
  date: "2026-07-25",        // ISO date, unique key
  sym: { hf: 0..3, ns: 0..3, ... },  // symptom id -> severity 0-3
  scales: { fatigue: 0..10, pain: 0..10, moodq: 0..10, stress: 0..10 },
  sleepQ: "good" | "fair" | "poor",
  period: boolean,
  flow: "spot"|"light"|"med"|"heavy"|"flood" | null,
  disch: "none"|"creamy"|"eggwhite"|"sticky"|"watery"|"unusual" | null,
  odor: "none"|"mild"|"strong"|"fishy"|"yeasty" | null,
  bodyOdor: "same"|"stronger"|"changed" | null,
  note?: string, // her day note, trimmed, ≤ 280 (UTF-16 units), absent when empty; on the device and in backups; reaches a file only through the Report's "Include my notes" tick (the appointment PDF, L9)
  cm?: "dry"|"sticky"|"creamy"|"watery"|"eggwhite", // cervical mucus (L7); written only when set
  opk?: "neg"|"pos",          // ovulation (LH) test result (L7); absent = not tested
  bbt?: number                // basal body temperature in °C, 34–40, at most 3 decimals (L7); written only when set
}
```
Every field except `date` and `sym` may be absent in older records (the demo seed writes only date, sleepQ, period and sym); `sym` keys are ids from any symptom library with values 0–3; there is at most one entry per date (`upsertDay`). The `DayEntry` typedef in src/lib/record.js is the working definition; later features add their fields here.

### 3.2 Symptom libraries (exact — id: label)
```js
// Peri / Meno stage
SYM = { hf:"Hot flashes", ns:"Night sweats", fog:"Brain fog", mood:"Mood swings",
        slp:"Sleep disruption", ach:"Joint aches", dry:"Vaginal dryness",
        pal:"Heart flutters", hda:"Headaches", lib:"Libido change",
        anx:"Anxiety", itc:"Skin/itching", eng:"Low energy" }

// My Cycle stage
PSYM = { crm:"Cramps", hda:"Headaches", blo:"Bloating", mood:"Mood swings",
         ten:"Breast tenderness", acn:"Skin breakouts", bak:"Back pain",
         nau:"Nausea", cra:"Cravings", lib:"Libido change", eng:"Low energy" }

// Pregnancy stage
GSYM = { nau:"Nausea", hb:"Heartburn", swl:"Swelling", bak:"Back pain",
         crp:"Cramping", dzy:"Dizziness", brx:"Braxton-Hicks", con:"Constipation" }

// Every check-in symptom (L6): ALL_SYM = { ...SYM, ...PSYM }, the labels for any id her list can hold

SCALES = [ {id:"fatigue", low:"Energized", high:"Wiped out"},
           {id:"pain",    low:"None",      high:"Severe"},
           {id:"moodq",   low:"Low",       high:"Great"},
           {id:"stress",  low:"Calm",      high:"Maxed"} ]
```

### 3.3 Registration record (`regAnswers`; matches the build since L11)
```js
{ // asked during onboarding (L11, §4.2): stage, cycleLen, lastPeriod (cycle stages), dueDate (Pregnant),
  // name, email, anon (Device step), notifOptin, research, terms (Consent step)
  name, email, anon:bool, stage, pcos, cycleLen, lastPeriod, dueDate, notifOptin, research, terms,
  // asked only in Settings → About you (optional, all empty after onboarding):
  age, zip, cycleReg, preg, births, contra, conditions:[], familyHx:[], meds, goals:[], sleep, activity }
```
There is no password and no email opt-in. `name` and `email` are deleted in Anonymous Mode. `dueDate` is "" or
YYYY-MM-DD (`record.js` RULES) and drives the pregnancy week (`pregWeekFrom`, lib/onboarding.js); without one the week
stays at the fixed 22 every build has shown. `src/lib/onboarding.js` holds the option lists, `ANSWER_BLANK` (every answer
key empty, no identity key) and `pruneForStage` (answers typed on a step that left her flow are not saved).
`pcos` (calm R2) is the optional "Living with PCOS?" answer — `"yes"` (Yes, diagnosed), `"suspect"` (I suspect it), `"no"`,
`"unsaid"` (Prefer not to say) or `null` when she picked nothing; kept only for My Cycle, Trying to conceive and
Perimenopause (`pruneForStage` empties it otherwise; `record.js` RULES check it). On this device and in encrypted backups
like every other answer; read by no network path. `"yes"` or `"suspect"` turns the PCOS module on at registration
(`pcosModuleFrom`, record key `modules`); You → Modules turns it off again.
**Never collect:** SSN, government ID, insurance/policy numbers, payment cards,
full street address (ZIP only), or medical records. This boundary is deliberate —
collecting identifiers alongside health data changes the legal posture of the product.

### 3.4 The saved record
`{ v: RECORD_VERSION, savedAt, phase: "app", ...PERSISTED keys }`, RECORD_VERSION = 1, every load and restore through `migrate()`; key classes and backup rules in docs/ARCHITECTURE.md §4.

### 3.5 Cycle flags (local-first L5)
```js
cycleFlags: { [cycleStartIso]: { exclude: true } }   // e.g. { "2026-07-11": { exclude: true } }
```
Her own choice only: the "Don't use" switch under Calendar → Your cycles is the one writer (engine `toggleExclude`);
Cyra may suggest leaving out a cycle that looks unusual but never sets a flag itself. A key within 2 days of a cycle's
start applies to that cycle (`flagKey`: a back-filled or un-marked first period day can move a start; starts are at
least 6 days apart, so it is never ambiguous); a key with no start near it is kept, harmless, and applies again if that
start comes back. Sanitised on load, cross-tab adopt and restore by `cleanCycleFlags` (YYYY-MM-DD keys, plain-object
values, `exclude` a boolean, unknown fields kept, empty entries dropped, at most 400 entries, the newest kept). A record
key (in PERSISTED, not DEVICE_ONLY): saved with the record, adopted by her other open tabs, encrypted into a backup she
saves, restored literally (a backup without the key clears it) and deleted by Delete everything. No RECORD_VERSION bump:
missing means `{}`. Predictions read it; the clinical markers (§6.2 variability, the Report's cycle lengths) never do.

### 3.5a Home choices (calm R3)
```js
homeTiles: null | ["symptoms", "sleep", "mood", "period"]   // 2–4 ids from lib/home.js TILE_CATALOG, her order; null = Cyra's default
homeStepSkip: null | { day: "2026-10-29", id: "breathe" }   // "Not today" on Today's small step
```
`homeTiles` is a record key (RECORD, in backups, restored literally, `cleanHomeTiles` on load/adopt/restore; RULES flag
anything it would change). `homeStepSkip` is DEVICE_ONLY and in NOT_IN_BACKUP (never in a backup file, kept across a
restore). Neither holds health data; no network path reads either.

### 3.5b The fast log's second half (calm R4, `lib/bodylog.js`)
```js
bodyLog: { "2026-10-29": { sleepH: 7.5,                                   // hours slept, 0–16 in half hours
                           move: [{ id: "m1", type: "walk", min: 30 }],   // walk | strength | yoga | cycling | swim | other, 1–600 min
                           pcos: ["crash", "sug"],                         // PCOS module day chips (PCOS_DAY ids)
                           weight: { v: 64.5, unit: "kg" } } }             // optional; only while bodyPrefs.weightOn
labs: [{ id, kind: "fglu" | "hba1c" | "waist", value: 92, unit: "mg/dL", date: "2026-09-01" }]   // newest first, as typed
bodyPrefs: { weightOn: false, weightUnit: null | "kg" | "lb", glucoseUnit: null | "mg/dL" | "mmol/L", hba1cUnit: null | "%" | "mmol/mol", waistUnit: null | "cm" | "in" }
```
All three are record keys (RECORD, in encrypted backups, restored literally; `cleanBodyLog` / `cleanLabs` /
`cleanBodyPrefs` on load, adopt and restore; RULES flag anything they would change). A missing unit follows the device
locale (`unitsFor`: en-US lb / in / mg/dL / %; en-GB, CA, AU, IE, NZ mmol/L and mmol/mol; elsewhere kg / cm). Values are
checked only for plausibility per unit (typos), never interpreted. The check-in day entry (§3.1) is unchanged: sleep
quality, flow, symptoms, mood scale and the day note stay there. Meds keep the existing `meds` / `medLog` keys (her list
and taken-by-day). Weight is never on Home and never charted; nothing here is in weekly counts, Ask, AI, the doctor
email or the PDF.

### 3.5c Mind: the check-in, practices and Journey (calm R5, `lib/mind.js`)
```js
moodLog: { "2026-10-29": { mood: 2,                 // 1 Very low · 2 Low · 3 Okay · 4 Good · 5 Very good (words, never a score)
                           tags: ["tired"],         // FEELINGS ids, any number, in library order
                           energy: 1, fog: 3 } }    // optional, 1–3: Low / Some / Good; Clear / A little / Foggy
practiceLog: [{ id: "r…", p: "slow", day: "2026-10-29", sec: 180, done: true, helped: "yes" }]   // oldest first, ≤ 400
practiceFavs: ["slow", "winddown"]                  // library order
practiceHaptics: false                              // device-only, not in backups
```
Mind = Today | Practices | Journey (routes.js: views "mind", "practices", "ask"; Connection is the sub-page "connect"
opened from Journey, #/mind/connection, its segment stays Journey). Today: the check-in (each tap saves; first tap of a
day toasts "Check-in saved on this device"), "Your next practice" (`nextPractice`: late evening → Wind down; brain fog
→ movement break; anxious / overwhelmed / restless → grounding; low mood → one small step; low energy → movement
break; else slow breathing; only practices her plan opens; one she marked "It helped" before wins), and "Which one
helped?" for today's runs. Practices: 11 practices in five needs (Feel calmer, Ease worry, Clear brain fog, Lift low
energy, Wind down & rest), each 2–5 minutes with an evidence line, strength word, named sources and "Wellbeing support,
not treatment." or "Comfort, not treatment." (docs/EVIDENCE.md, docs/CLINICIAN-REVIEW.md). The practice sheet: the
breathing orb (BreathOrb: the core grows with the in-breath over the phase's own seconds; under reduced motion it only
brightens and dims), the phase word and count or the step text, a timer, Start → Pause / Resume (one button, focus kept)
and Stop, a polite live region for each change, pause when the app is hidden, favourites, optional gentle vibration on a
phone; at the end "Did that help?". Free: slow, ground, step, move, winddown; the rest need `can("fullPractices")`
(Pro chip → "What Pro adds" sheet). Journey: mood across her cycle (`moodByCycle`: a row per cycle, a cell per cycle
day, shaded with the data-viz soft ramp; "Last 5 weeks" without cycle starts; the empty line under five check-ins),
the journal (the same `journal` key as Home), the Connection card and Ask Cyra (unchanged, embedded). The "+" sheet's
Mood, Home's Mood tile and Body's Mood row (today) open the check-in; the Mood tile and the Mind rail tick from it
(`tileLogged("mood", { moodDay })`). Home's breathing step opens Slow breathing.

### 3.5d Patterns: timeline, rings, pattern cards, weekly review (calm R6, `lib/patterns.js`, `lib/experiments.js`)
```js
experiments: { active: { id: "winddown", start: "2026-10-26", done: ["2026-10-26"] } | null,   // 7 days from start
               skip: "2026-10-25" | null,                                                   // the Sunday whose offer she skipped
               past: [{ id: "move", start: "2026-10-12", days: ["2026-10-13"], target: 3 }] }  // ≤ 26, oldest first
```
Patterns (cycle stages; pregnancy keeps the care roadmap) has no score anywhere: no 0–100 axis, no "points", no number
out of 100. Top: History (Body → Cycles; Calendar in menopause) and Share (a sheet: Appointment PDF → the Report's PDF
button, Report → the Report view; L9 PDF content unchanged). The hero is the cycle timeline (`cycleTimeline`): the last
6 cycles at their actual lengths, newest first with the running one on top (dashed run to its likely length), logged
period days, a textbook fertile-window estimate only on 21–35-day cycles that are not unusual, and calm labels ("Left out
of predictions", "Longer/Shorter than your usual", with PCOS on "Over 35 days" plus the PCOS expected-cycles sentence).
Every cycle is drawn (D5). Then Body and Mind rings around the cycle ring (Home's heroModel): this week (7 days) against
days 8–28 before, in words only (Body: At your usual / Lighter than usual / Heavier than usual; Mind, from the mood face:
At your usual / Higher than usual / Lower than usual; "A few more logs" under 3 + 5 logged days), with "What's driving
this" listing the inputs. "What you're learning": cards from the L8 engine (`patternFindings().links`: sleep links and
cycle-day clusters), the PCOS module's patternQuestions (sleep under 7 h → fatigue, high-sugar days → cravings or fatigue
the next day, 20+ minutes of movement → fewer mood swings, cycle length), "What I'm trying" (A3, counted as lighter days
before and after) and two plain counts (perimenopause cycle spread, My Cycle's most-logged symptom). Each card: topic
eyebrow, chip (Supported pattern / Still showing up / Not enough information), one association sentence ("Rough nights
lined up with more headaches in your log."), the difference figure ("2.3× as often after a rough night"), TwoBar with day
counts, "In your recent data", "View pattern" (detail sheet: question, counts in words, the L8 advice, sources, the
not-medical-advice line, Add to visit notes / Ask about this). Thresholds (`PATTERN_RULES`, unit-tested): Not enough
information under 5 days on either side or 4 outcome days in all; Supported at ≥ 1.3× and ≥ 0.2 apart (the L8 sleep-link
bar); Still showing up at ≥ 1.15× and ≥ 0.1 apart. Three cards show, "View all patterns (N)" the rest; "Associations to
raise with your clinician, not a diagnosis or medical advice." sits under the heading. The 60-day chart reads against her
usual (the median of her logged days, ± 0.08): a soft "Usual" band with "Lighter" above and "Heavier" below, the day card
says "A lighter / usual / heavier day for you", the headline compares the last week's lighter and heavier days with the
first week's. Weekly review (`reviewWeek`): the last full week (Sunday–Saturday); it opens by itself Sunday through
Tuesday and on demand ("Look back") otherwise: counts of what she logged (never grades), up to two Supported sentences,
how last week's experiment went (done days against the other days, "One week is a small sample"), then ONE optional
starter experiment (`pickExperiment`: PCOS signals → a 10-minute walk after lunch on 3 days; rough nights → the wind-down
plan on 4 nights; worry or low mood → slow breathing on 4 days; else a short bout of movement on 3 days) with Start and
Skip this week, and a Pro chip on "Your own experiment". A running experiment takes Home's small-step card ("Your
experiment · day N of 7", "I did it today" / "Untick today", Not today, and its practice as a second link). The
"Cyra's write-up" slot (AI deep dive, R8) renders nothing in R6.

### 3.6 Her symptom list (symPrefs, local-first L6)
```js
symPrefs: { periods?: { order, hidden, added }, peri?: { order, hidden, added }, preg?: { order, hidden } }
// order: ids in the order shown first; hidden: ids under "More symptoms"; added: ids borrowed from the other library
// e.g. { periods: { order: ["eng", "crm"], hidden: ["acn"], added: ["hf"] } }
```
Keyed by stage id, so My Cycle and Trying to conceive share `periods`, and Perimenopause and Menopause share `peri`;
pregnancy (`preg`, decision D8 "per stage") has order and hide only, since nothing is borrowed into GSYM. `{}` is Cyra's
order: every library chip shows, in library order, and nothing is hidden. src/lib/daylog.js holds every rule:
`cleanSymPrefs` (the stage keys only, in the input's order; distinct ids matching `/^[a-z][a-z0-9_]{0,15}$/`, at most 40
per list; a stage with three empty lists is dropped; unknown well-formed ids are kept for a later version and ignored by
every reader), `chipLayout` (first = her order, then the other shown ids; more = the hidden ones), and the editors
(`moveSym`, `hideSym`, `showSym`, `addSym`, `removeSym`, `resetSyms`), which return a new object, leave other stages
untouched and store an order equal to Cyra's as `[]`. **The tracked list** (`trackedIds`: her stage's library plus what
she added, hidden ones included) is what every insight, the patterns card and its numbers, the Calendar day card, the
Report table and the doctor email run on, so hiding a chip never hides what she logged. An added symptom can be removed
only while nothing was ever logged for it (`canRemove`; the unsaved form counts too); once logged it can be hidden but
not removed. A record key (in PERSISTED, not DEVICE_ONLY): saved with the record, adopted by her other open tabs,
encrypted into a backup she saves, restored literally (a backup without it brings back Cyra's order) and deleted by
Delete everything. No RECORD_VERSION bump: missing means `{}`.

---

## 4. APPLICATION FLOW (state machine)

```
phase: "splash" -> "register" (3–5 steps) -> "app"
```

### 4.1 Splash
Wordmark, tagline "One companion for every phase", value proposition, "Get started" button.

**UI O1.** Above the wordmark an aria-hidden ring motif (`.splashmotif`: three overlapping circles in --primary 14%,
--accent 18% and --primary 8%, so it takes the stage palette after a restore). The value proposition is three icon rows
(`ul.splashwhy`: clock "Track in 30 seconds a day.", chart "See your real patterns.", clipboard "Walk into appointments
with evidence — cycles, symptoms, PCOS signals." — the PCOS clause since calm R2). The build stamp text is unchanged; `.rfoot b` is demoted to 11px / weight 500.

**L11: the promise, stated once, before any personal question.** Under the value rows an `h2.section-lab#splash-promise`
"Your privacy, plainly" labels `ul.splashpromise` (three `li`, one 16px `Icon` each; `p.splashpriv` is gone):
1. lock — "Your health log lives on your device. Nothing about your health leaves it unless you turn on a feature that
   tells you exactly what it sends." (unchanged sentence; it appears nowhere else in onboarding)
2. user — "No account needed. There's no Cyra account to make, and your name and email are optional."
3. book — "Guidance, never a diagnosis. For anything medical, talk with your clinician."
Then `button.cta` "Get started", then `button.ghostbtn.quiet.splashrestore` "Restore from an encrypted backup" (a 44px
toggle with a constant label; `aria-expanded` carries the state, `aria-controls="splash-restore"`, and `initialRestore`
from L10 seeds it open) over `div#splash-restore` (hidden while closed; the compact `RestoreForm` while open), and last the
`p.rfoot` "Free to use" + the build stamp (the "guidance, never diagnosis" clause moved into the list). "Get started" and
the toggle both sit inside the first 844px at 390 wide (`.splash` padding-top 32px, h1 margin-top 16px).

### 4.2 Registration — phase-first, 3–5 steps (L11; the optional PCOS step since calm R2)
Routed by `regSteps(stage)` in `src/lib/onboarding.js` (the one step map; `REG_STAGE`, `STAGE_LABELS`, `STAGE_CARDS`,
`STEP_COPY`, `missingFor`, `socialReturnStep` live there too):
| # | Step | Fields | Required |
|---|------|--------|----------|
| 1 | Stage | 5 cards (see 4.3) — "Where are you right now?" | yes |
| 2 | PCOS (My Cycle, Trying to conceive, Perimenopause; calm R2) — "Living with PCOS?" | Yes, diagnosed · I suspect it · No · Prefer not to say (a second tap clears) | nothing |
| 2 | Device | name (opt), email (opt), **Anonymous Mode toggle**, providers (signin builds) | nothing |
| 3 | Cycle (My Cycle, Trying to conceive, Perimenopause) — "Your cycle history" | typical length, last period (opt) | length |
| 3 | Pregnancy (Pregnant) — "Your pregnancy" | due date (opt; min today−14, max today+280) | nothing |
| — | (the step numbers shift by one after the PCOS step: cycle stages have 5 steps, Pregnant 4, Menopause & beyond 3) | | |
| 4 | Consent | reminders opt-in (+ the rhythm grid while ticked), weekly counts opt-in, **terms** | terms |

**About you (Settings).** Age band, ZIP, regularity, reproductive history, health background, goals, sleep and activity
are no longer asked at registration. They live in Settings → About you (`src/components/AboutYou.jsx`), each topic a
collapsed Details ("Your cycle" for cycle stages / "Your pregnancy" for Pregnant, then "Age and ZIP", "Reproductive
history", "Health background", "What brings you here"), with the old steps' footers word for word; each tap writes one
key into `regAnswers`. Nothing reads them except the POTS offer (conditions), which now fires from Settings.

**Measured path (Playwright, VITE_API_BASE= build, 390×844, splash → saved first check-in).** Before L11: 11 screens and
20 taps for My Cycle, Trying to conceive, Perimenopause and Menopause & beyond (15 in registration); Pregnant 11 screens,
17 taps; the 8 steps held ~809 words and the consent step was 1203px tall with the agree box below the fold. After:
My Cycle / Trying to conceive / Perimenopause 7 screens, 13 taps (8 in registration); Menopause & beyond 6 screens, 11
taps (6); Pregnant 7 screens, 9 taps (7); the consent step is 888px with nothing to tap below the fold.

**Validation behavior:** red state appears **only after** the user taps Continue with
fields missing — never on arrival. Show label in red with "· needed" suffix, red-tint
the inputs, and a summary line below. Optional fields never turn red.

**UI O1 (onboarding).**
- Device step (step 2) order: the short path first — name and email inputs (email placeholder "Email (optional)", its aria-label the
  full sentence "Email (optional, kept only on this device and in backups you save)", and the clause repeated as a visible
  helper line under the field), then "Continue in Anonymous Mode instead" (`.ghostbtn.quiet`, aria-pressed), then the
  providers in one 3-up row with Apple leftmost and inline SVG marks (`Icon apple|google|facebook`, no `.socialdot`), the
  provider footnote, and both detail panels ("What Cyra's server sees", "Exactly what's shared") together at the end.
  "Continue" sits inside the first 844px at 390 wide. Back on the stage step (step 1) returns to the splash.
- Palette preview: `REG_STAGE` (lib/onboarding.js since L11: card label → periods | preg | peri) is the one routing map;
  finishReg uses it. Each `.stagecard` carries a `.swatch-dot` in `paletteFor(PALETTES[REG_STAGE[label]][0], scheme).primary`;
  the selected card hides its dot and shows a check in --primary. From the tap on, `regPal` (phase "register" only) merges that
  palette into the Shell theme, so steps 2–4 wear the stage's first palette (crossfaded by the G4 `.cy.repaint` list), the same
  one finishReg lands on. UI palette only; nothing is persisted until finishReg (no session, local or IndexedDB storage).
- Sign-in return (L11): a native return lands on the step after Device (`socialReturnStep`: Cycle, Pregnancy or Consent) with
  the prefill toast; a web redirect restarts the page, so nothing is carried across it and she lands on the stage step, with
  her name and email waiting on the Device step after she picks a stage again.
- Chip rows: every `.lab` has an id and its `.mcrow` is `role="group" aria-labelledby` it; multi-select chips expose
  aria-pressed; "None" and "None / unsure" are exclusive (choosing one clears the rest, choosing anything else clears it).
- Consent step: the cadence cards (`.regcards.cadgrid`, two columns, the fifth spanning both) sit inside `div.cadwrap`
  directly under "Remind me on this device" (which `aria-controls` it) and render only while that box is ticked, followed by
  the anti-nag sentence; where the build has no reminders there is no row and no grid. Each data fact carries a decorative
  icon (`.rlist.icons`, text byte-identical). The CTA logic is unchanged ("Complete required fields" until the box is ticked,
  then "Enter Cyra"). Nothing is pre-ticked.
- Progress and steps: `.prog` is `role="progressbar"` ("Set-up progress", 1–N, valuenow = step, one span per step); the step
  line reads "Step n of N · Stage | Device | Cycle | Pregnancy | Consent". The step body (`.regstep`, keyed by
  step) slides in with `cy-slide-in` forward / `cy-slide-back` on Back (--t-base, --ease-in; none under reduced motion), the
  page scrolls to the top (smooth unless `reduceMotion()`) and focus moves to the `h1.disp` (tabIndex -1, no outline,
  preventScroll). A failed Continue scrolls the first marked field into view and the summary line is `role="alert"`.
- Intake (stage change): "Question n of 4" above the question, aria-hidden dots, `role="status" aria-live="polite"` on the
  "Personalizing your space…" card, and a Back link from the second question on.

### 4.3 Stage routing (answer → experience)
```
"My Cycle"            -> periods
"Trying to conceive"  -> periods
"Pregnant"            -> preg
"Perimenopause"       -> peri
"Menopause & beyond"  -> peri
```
The intake shown after "{stage} · change" routes on the device through `routeIntake` in lib/engine.js (L7):
"Are you currently pregnant?" Yes → Pregnancy; "Trying to be" → Trying to Conceive (stage `periods`), ahead of the
period and hot-flash answers; otherwise Menopause / Perimenopause / My Cycle as before.
After routing, the user sees ONLY that stage's tabs, symptoms, palette, and partners.
A header chip shows the current stage with a "change" affordance that re-runs intake.

---

**PCOS step (calm R2).** `regSteps` puts `"pcos"` after `"stage"` for My Cycle, Trying to conceive and Perimenopause
(before a stage is picked the step line reads "Step 1 of 5"). The four answers are `.mc.pcosopt` buttons (aria-pressed) in a
2-up `role=group` "Living with PCOS? (optional)", followed by a `.pcosnote` with the module framing
(`MODULE_FRAMING`). `STEP_COPY.pcos.sub`: "Optional. A yes adds PCOS symptoms, signals and cycle wording to your log; you
can change it anytime in You. Your answer stays on this device, and goes into an encrypted backup only if you save one."
Continue works with nothing picked. Yes or "I suspect it" turns the PCOS module on in finishReg
(`pcosModuleFrom(stage, answer)`); "No", "Prefer not to say" and nothing leave it off. A native sign-in now returns to step
4 for the cycle stages (`socialReturnStep` = the index after Device).

## 5. SCREENS BY STAGE

**Navigation (calm R2, replaces the section bar below).** Five tabs in every stage — **Home · Body · Mind · Patterns ·
You** — in the bottom nav pill (`NavPill`, `nav[aria-label="Sections"]` > `[role=tablist]` > five `button[role=tab].navtab`,
centred filled "+" `button.navplus` "Log something" outside the tablist, `aria-haspopup="dialog"`, `aria-expanded`). Keyboard:
roving tabindex, ArrowLeft / ArrowRight / Home / End move focus, Enter, Space or a tap selects (manual activation). A tab
switch from the nav closes the POTS page, scrolls to the top and moves focus to the view's `h1` (tabIndex -1 added). The
view model (`src/lib/routes.js`): the old screen ids stay the views (`appTab` / `pregTab`), and each belongs to one tab:
| Tab | Views (segment labels) | was |
|-----|------------------------|-----|
| Home | Home | Home |
| Body | Logs · Calendar · Cycles (no Cycles in menopause) | Today, Calendar, the "Your cycles" list; POTS tools open as a page from Home / Logs as before |
| Mind | Today · Journey (Practices joins in R5) | Connect (Today), Ask (Journey) |
| Patterns | Patterns · Report | Patterns, Report |
| You | one page | the "<stage> · change" button, a Settings card (opens the same Settings sheet), Modules (PCOS switch; POTS state → Settings → Add-ons), Care (embedded "Care & support") |
Pregnancy: Body = Logs · Calendar, Patterns = the care roadmap (Milestones), You without Modules or Care. A tab with several
views shows them as a pill segmented control `nav.subnav[aria-label="<Tab> views"] .seg` (buttons, aria-pressed; focus stays
on the segment; it stays above a POTS page opened from that view, and a tap on a segment closes that page); the view under it (`.viewpanel`, keyed) fades in once. A tab remembers the view she last had open in it.
The header keeps the wordmark, the name chip, the palette button and the "Check-in settings" button (the Settings sheet is
unchanged). Fixed nav: `.cy` keeps 104px at the bottom, the sticky save bar sits above the pill, the toast rises over it.
**Deep links:** `#/<tab>[/<segment>]` (e.g. `#/body/calendar`, `#/patterns/report`, `#/mind/journey`) and the old names
(`#/today`, `#/calendar`, `#/cycles`, `#/report`, `#/connect`, `#/ask`, `#/care` → You's "Support & care",
`#/milestones`, `#/settings` → You) open their view once she is in the app; the hash is then cleared (a reload opens Home).
`#restored`, `#oauth=…` and `#/dev/ui` are not routes. **"+" log sheet** (`LogSheet`, a v2 `Sheet` `#log-sheet`, focus trap,
Escape, focus back on "+"): Symptoms · Period · Sleep · Mood · Move · Meds · Note as quick-log tiles, one tap each into the
existing logger with focus on its first control — Symptoms and Mood open the full check-in form (the quick card's "more
detail") at the chips / the 0–10 Mood scale, Period opens Body signals, Sleep the "Last night" pills, Note the day note,
Meds Home's "What I'm trying", Move the POTS movement plan. Offered only where the logger exists: no Period or Sleep in
pregnancy, Move only with POTS tools on. ("PCOS signals" joins with its logger in R4.)

**Section bar (both stage families; superseded by calm R2 above — kept for history).** `nav[aria-label="Sections"]` is the sticky wrap (`.tabswrap`: top 0 under the
safe-area inset, paper at 86% with a saturate/blur backdrop so content scrolls under it legibly) around the one scrolling
strip `.tabs[role=tablist]`. Tab names, order, `role=tab`, `aria-selected` and the `tab` / `tab-on` classes are fixed
(harness surface). Overflow is advertised: the strip reports which edges it is against (`data-start` / `data-end` on the
wrap) and a 36px paper fade sits over the hidden side; scroll-snap is `proximity`, so a drag is never trapped. Keyboard
follows the APG tabs pattern: only the selected tab is in the Tab order (`tabindex` 0 / -1), ArrowLeft / ArrowRight /
Home / End move focus among the tabs, activation stays on click, Enter or Space; each tab has `id="tab-<id>"` and
`aria-controls="panel-<id>"`. The screen renders inside `.tabpanel[role=tabpanel]#panel-<id>` (keyed by tab, so it
remounts on a change and fades in once over --t-base with `cy-fade-rise`; no label of its own because each screen's
`<main>` is the landmark). On a tab change the selected tab is scrolled fully into the strip (smooth unless
`reduceMotion()`); `html { scroll-padding-top:60px }` keeps anchored scrolls below the bar.

### 5.1 Cycle & Peri stages — tabs: Today · Calendar · Patterns · Report · Care · Ask

**Today:** cycle-status card (day N, phase, and the likely start: `periodHead(pred)` + "." — "Period likely Oct 26 – Nov 1."
or "Period likely any day now, by Nov 1." — or, past the range, "Later than your usual range, which ended {date}." with
" — with your spread, irregularity is data too." in place of the full stop in perimenopause; no card when there is no
prediction, e.g. in menopause, pregnancy or after a gap over 120 days) ·
live day-score meter (see 6.3) · symptom chips (tap cycles 0→1→2→3→0, showing ●○○ dots) ·
0–10 sliders for the four scales · sleep quality (3 buttons) · collapsible **Body Signals**
panel (flow, discharge, vaginal odor, body odor) · save button · phase-appropriate daily read.

**Today states (UI T1).** The hint under the h1 names the mode: "Three quick questions — about ten seconds." in
quick mode, "Tap what showed up (up to 3× for strong). Takes 30 seconds, promise." in full and edit mode; Pregnancy
Today reads "Tap a symptom once for mild, up to 3× for strong." The welcome sentence written at registration shows
once, as `p.hint.welcome-line` directly under the h1 while `days.length === 0` (no card); the first save clears it
(App `onSaved`). *Empty meter:* until something on the form is set (`touched` in App.jsx: any symptom chip > 0, any
quick answer, sleep, any scale > 0, flow / discharge / odor / body odor, kicks > 0, and (L7) cervical mucus, an
ovulation test or a temperature — the same state the score and the save read) the meter is `.meter.meter-empty`: "Nothing logged yet" · "—", an empty track, border and dot `--line`,
`role=progressbar` with `aria-valuenow=0` and `aria-label="Day score: nothing logged yet"`, left foot "Tap below — your
score updates live". The first tap switches it to the scored label and ramp colour in the same frame. The live score
folds quick answers onto their hero symptoms (`foldQuick`) so the meter agrees with the score the day is saved with.
*Sleep:* the three pills sit under a "Last night" section label; on Perimenopause / Menopause in quick mode (not an
edit) the row is not rendered at all, because the quick card's second question is "How did you sleep?" with the same
three words plus "Barely slept" — see A8. The save handler is unchanged: `sleepQ || "fair"` from the pill when it was
shown. *Family colour:* each chip carries `--fc` (FAMILIES colour of `SYM_FAMILY[id]`, `famColor()` in constants.js);
only the severity dots of a chip with a value take it (`.chip:not(.sev-0) .dots`), popping 120 ms (`cy-pop`, keyed
remount on each change; none under reduced motion). Chip borders and backgrounds stay on the UI palette. *Pregnancy:*
the kick counter is a `.plaincard.kickcard` under a "Kick counter" label with a tinted, outlined `.cta.cta-kick` and an
`aria-live="polite"` count; "Save today" is the one primary-filled CTA. Range inputs are restyled: 44 px tall,
`appearance:none`, a 6 px track and a 24 px primary thumb (accent-color kept as the fallback).

**Today feedback and reach (UI T2).** *Saved line:* when today is already in the record (`savedToday` in App.jsx:
`days.some(d => d.date === todayIso)`, pregnancy `!!pregLog[todayIso]`) and no other day is being edited, a
`p.savedline` sits directly under the meter — a check icon and "Logged today — any change here updates it." The CTA
texts ("Save today's check-in", "Save today", "Save changes to <date>") and the toast sentences are unchanged.
*Yesterday shortcut:* under the h1, when yesterday has no entry, something has been logged and no edit is open
(`!yesterdayLogged && !editDate && days.length > 0`; pregnancy keys on the log having any entry), a
`button.linkbtn.yday` "Yesterday not logged · add it" opens the existing "Fixing up <date>" flow for yesterday
(`startEdit(yesterdayIso)`); it is absent once yesterday is logged. *Per-visit "more detail":* the quick card's link
no longer flips the Settings preference. App.jsx keeps `expanded` (UI state, never saved): "more detail" folds the
answers so far onto their chips (`foldQuick`) and sets it; TodayScreen then shows the chips, scales and a
`button.linkbtn.backquick` "Back to quick check-in" in place of the quick card, with the "Last night" pills (the quick
card that asked about sleep is gone, so "Rough night" is one button). Settings still shows "Quick · 3 taps" selected.
`expanded` is cleared by "Back to quick check-in", by choosing a mode in Settings, and whenever the form reloads for
a new day, a stage change or a restored record; it is kept across a save and tab changes within the session (so a
return to Today after saving shows the form she saved from). Everything that depends on which form is on screen —
the hint, the chips, the peri sleep pills, the Details sentence and what `contribute()` sends — keys on one value,
`quickCard = quickMode && !editDate && !expanded`. *Body signals in quick mode:* `bodySection` is always rendered
(collapsed), so flow, discharge and odor can be logged without leaving the quick path. *Sticky save:* the save `.cta`
sits in `div.stopbar.savebar` (position:sticky; bottom:0; z-index 3; translucent paper with blur, hairline top,
`calc(10px + var(--sa-b))` bottom padding) on both Today screens, so mid-form the primary action stays at the bottom
of the viewport and the toast is lifted above it (`.cy:has(.stopbar) .toast`); the edit banner is `.card.editbar`
(sticky under the section bar at top:60px, accent-tinted, "Back to today" kept); `.scalerow` margin is 8 px.
*Meter motion:* `.meterfill` is a `scaleX(var(--v))` transform (ScoreMeter sets `--v` = live score; the transition
property is transform and background, never width) and the big number counts from its previous value to the new one
over 250 ms in one requestAnimationFrame tween, skipped under reduced motion; `aria-valuenow` and the label hold the
final value at once. *The record moves:* a save of today sets `justSaved` (App.jsx, cleared after 1.2 s, set only by
the save handler, never on hydration or restore); the patterns card (`popIso`) wraps that day's dot in
`g.dot-new`, which pops once (`cy-pop` 600 ms; none under reduced motion) and not on a later open. *Today's read:*
`.readcard.compact` sits directly under the phase card, hint clamped to two lines, matching Pregnancy Today.

**Today: her symptom list and a day note (L6, decisions D7 and D8; `TodayScreen.jsx`, `components/SymptomSheet.jsx`,
`components/DayNote.jsx`, `lib/daylog.js`).** *Symptoms · Edit:* wherever the chips show (full, "more detail",
"Fixing up"; never on the quick card) a `div.chiphead` sits directly above them: `p.section-lab#sym-lab` "Symptoms" and a
`.linkbtn` "Edit" (`aria-label="Edit symptoms"`, `aria-expanded`, `aria-controls="sym-sheet"`, 44 px). The grid is
`div.chips[role=group][aria-labelledby=sym-lab]` of `chipLayout(stage, symPrefs).first` (§3.6; by default every library
chip in library order, Low energy last); each chip's markup is unchanged. *More symptoms:* when she has hidden any, a
`button.disclosure.more.symmore` "More symptoms · n" (`aria-expanded`, `aria-controls="sym-more"`) follows the grid, and
`div#sym-more` is always in the DOM (`hidden` while closed); open, it holds `.chips.morechips[role=group]
[aria-label="More symptoms"]`. A hidden symptom with a value in the form is lifted into the main grid while the panel is
closed (so nothing she logged is out of sight); once lifted it stays there until the panel or the sheet is next opened,
so tapping it back to 0 never pulls the focused chip out of the page; a tap inside the open panel never moves a chip. *The sheet:* "Edit"
replaces the grid with `section.symsheet#sym-sheet[aria-labelledby=sym-sheet-title]` (a card like the palette sheet,
its title bar not sticky mid-page) and focuses its `h2.sheettitle` "Your symptoms"; a `.sheetclose` "Close symptom
list", Escape and the closing `ghostbtn` "Done" all close it and return focus to Edit; the sheet also closes when the
quick card comes back. Hint: "Pick what shows first and in what order. Hide moves a symptom under More symptoms.
Everything you log stays in your patterns, calendar and report, wherever it sits. Changes save as you go." "Shown first"
(`ul.symlist`, one `li.medrow` per symptom; an added one says "From the {perimenopause|cycle} list") gives each row
icon buttons `#sym-up-{id}` "Move {label} up" (disabled on the first row) and `#sym-down-{id}` "Move {label} down"
(disabled on the last), `arrow-up` / `arrow-down` icons, never drag-only, and `#sym-hide-{id}` "Hide" (disabled when
it is the only one shown first). "Under More symptoms" rows offer `#sym-show-{id}` "Show" ("Show {label} first") and,
only for a symptom she added and never logged, "Remove". A `Details` "Add from the perimenopause list" (My Cycle and
Trying to conceive) / "Add from the cycle list" (Perimenopause and Menopause) says "These show up in your patterns,
calendar and report like the rest. Once you've logged one, you can hide it but not remove it, so your history stays
whole." and lists the other library's symptoms not yet added, each with "Add" (`#sym-add-{id}`). "Put back Cyra's
order" (`.linkbtn.symreset`, only while an order or a hidden symptom is set) clears order and hidden and keeps what she
added at the end. Every action writes `symPrefs` (the 400 ms autosave keeps it; no toasts); a visually hidden
`aria-live="polite"` line says "{label} moved to {k} of {n}." / "{label} hidden. It's under More symptoms now." /
"{label} shows first again, at the end." / "{label} added at the end." / "{label} removed from your list." / "Back to
Cyra's order. Symptoms you added stay at the end." Focus follows the symptom, by element id after the next render: after
a move it stays on the same arrow, or on the row's other arrow when the pressed one became disabled; after Hide on
`#sym-show-{id}`; after Show or Add on `#sym-up-{id}`; after Remove or the reset on the h2. UI chrome only: no family
colour in the sheet. *Day note:* after Body signals and before the Save bar in every form (quick, full, "more detail",
"Fixing up") sits `button.linkbtn.addnote` "Add a note"; it opens `div.daynote` and focuses the field, bringing the
note clear of the sticky Save bar: a `label.section-lab` "Note for today" ("Note for {Mon D}" when fixing up a day),
`textarea#day-note.inp` (3 rows, `maxLength` 280, placeholder "A trigger, a change, anything worth remembering",
`aria-describedby="day-note-hint day-note-count"`), the hint `p.rfoot#day-note-hint` "Kept with this day on this device
and in backups you save. Cyra never sends it anywhere." and the counter `#day-note-count` "{n}/280" (`.notecount.near`
from 260 on). A polite live line says "20 characters left." and "10 characters left." at exactly those counts and "The
note is full." at 280. The field stays open while the day has a note (clearing it never collapses it mid-edit). The save
stores `cleanNote(dayNote)` as `entry.note` (trimmed, CRLF to LF, at most 280 UTF-16 units, never half a surrogate pair;
no key when empty); it is part of the form (App.jsx `dayNote`: loaded from the day's entry, kept aside with the rest of
today's form while another day is edited, kept open past midnight, reloaded when another tab saves today) and is
never handed to `contribute()`. *Tap budget (A8):* the quick path is still three answers + Save.

**Calendar:** month grid. Logged days filled with their day-score color. Period days
marked, the mark sized by flow. Predicted period (dashed: every day of the likely-start range) and
estimated fertile window (accent) for unlogged days. Tap any day → detail panel showing what was logged →
"Edit this day" loads that date into the check-in form and saves back to it. Confidence card: ±half of the
likely-start range (§6.2), explicitly stating it is not contraception. "Your cycles" under it lists her
cycles and lets her leave one out of predictions (L5).

**Calendar rules (UI C1; `src/screens/CalendarScreen.jsx`, `PregCalendarScreen.jsx`).**
*Month navigation:* the `h1.disp` sits between two 44px `.sbtn` buttons (`aria-label` "Previous month" /
"Next month") in `.calnav` and shows the viewed month (`aria-live="polite"`); away from the current month a
"Back to this month" `.linkbtn` appears under it. The offset is screen state (`mo`), so re-entering the tab
(the `.tabpanel` remounts) always opens on the current month. Any month can be viewed; the grid is
`role="group"` named by the month and the headers are two letters (Su Mo Tu We Th Fr Sa), `aria-hidden`.
*Fill = score, border = cycle state:* a logged day's fill is `scoreColor(score)` and its digit `scoreInk(score)`
(§8.3); the border says what kind of day it is — `.c-period` 2px solid --primary (plus the `.c-per-mark` dot),
`.c-pred` 2px dashed --primary, `.c-fert` 2px solid --accent — and these apply whether or not the day is
scored (the old `sc == null &&` guard hid fertile and predicted states on any logged day). The legend swatches
are the same rules on an 11px square (`.d-pred` dashed, `.d-fert` accent border, `.d-permark` dot), so the
legend is a literal copy of the cells. Future unlogged days are `.c-future`: --soft digits at 500 on a faded
card, unless they carry a prediction or fertile border (then ink at 700 and the state's border colour). Today
is `.c-today` (inset ink ring); before anything is logged it also takes `.c-empty` (10% primary tint) and the
hint reads "Tap today to log your first day. Periods, predictions and the fertile window appear here as you go."
*Selected cell:* `.c-sel` draws a card-gap + 5px --primary ring (absorbed by the 5px grid gap; `.c-today.c-sel`
keeps the inset ring inside it) and the cell is `aria-pressed="true"`; exactly one cell is pressed at a time.
*Accessible name:* every cell is named "{Weekday}, {Month} {day}" followed by ", today", ", period" (then the
flow: ", light flow", ", medium flow", ", heavy flow" or ", flooding"; nothing when no flow was set),
", predicted period", ", estimated fertile window", (L7, while fertility signs are shown) ", egg-white mucus" and
", positive ovulation test", and ", {scoreLabel}" as they apply (pregnancy: ", week N
starts", ", logged"); today also carries `aria-current="date"`.
*Flow overlay (L5):* the period mark `span.c-per-mark` takes a flow class in the same position, tokens only —
`f-light` (light, or no flow set) the 5px dot, `f-med` a 9 × 5px pill, `f-heavy` (heavy and flooding) a 13 × 5px
pill. No legend row: the cell's name and the day card name the flow.
*Predicted and fertile cells (L5):* a cell is predicted when `pred.fromIso <= iso <= pred.toIso` (the whole
likely-start range) and fertile when `pred.fertileFromIso <= iso <= pred.fertileToIso`, compared inclusively as ISO
days (the old `inRange` compared noon with midnight and dropped the last day of both windows, so the fertile window
showed 4 days, not 5). Class precedence stays period > pred > fert: where the last fertile day is also the first
likely-start day (a ±10 range), that cell is dashed and its name carries both phrases.
*Menopause:* the hint under the title reads "Logged days and any bleeding you note. After menopause, Cyra doesn't
predict periods."; the first-run calhint "Tap today to log your first day. What you log appears here as you go.";
the legend shows only the period swatch; no predicted or fertile cells and no "Your cycles". The other stages keep
their hint, calhint and legend exactly.
*Day card:* `.card.daycard[role=region][aria-label="Selected day"]` renders directly after `.calgrid`
(before the legends) with a 180ms `cy-fade-rise`; `.dayhead` holds "{Wkd}, {Mon} {d}" and the `.scorepill`
(score fill + `scoreInk`); symptoms are a `.pday-s` list whose severity dots take the symptom's family colour
through `--fc` (`famColor()`); the footer is "Edit this day" for a logged day, "Log this day" for an unlogged
day up to today (both open the Today edit flow via `onEdit(iso)` — "Fixing up {date}"), or the sentence
"That day hasn't happened yet." for a future day, and always "Close". A day with a note (L6) adds
`p.dayline.noteline` "**Note:** {text}" after the "Period · Sleep: …" line, rendered as text (never HTML) with its line
breaks kept (`white-space:pre-wrap`); the symptom list is the tracked list (§3.6), so added and hidden symptoms appear.
*Confidence card (L5):* `<div class="card"><div class="num">±{pred.half}d<span class="rmeta">confidence</span></div><p>…</p></div>`;
the sentence joins, with spaces: (a) the range — upcoming "Period likely {Oct 26 – Nov 1}." (`fmtRange`, spaced en
dash, both dates in full); window "Period likely any day now, by {Nov 1}."; later "Later than your usual range, which
ended {date}. If it came and you didn't log it, tap that day to add it."; (b) one basis — logged, two or more in use:
"Based on your last {n} cycles ({a · b · …}d){, with {k} left out}."; logged, one: "Based on your last cycle
({len}d){, with {k} left out}."; told, none left out: "Based on the {n}-day cycle you gave at sign-up{ (one logged so
far: {len}d)}. After two logged cycles this becomes your own number."; told, some left out: "Based on the {n}-day
cycle you gave at sign-up, with {k} logged cycle(s) left out. Once two cycles are in use, this becomes your own
number."; default: "Based on a typical 28-day cycle until two of yours are logged."; (c) perimenopause only: "Cycles
vary more in perimenopause, so the range is wider."; (d) "Estimates — not contraception." verbatim.
*No-prediction card:* `.num` "—" and, by `whyNoPrediction().kind`: none — "No predictions yet. Log a period day (light
flow or more on the Today screen) and the calendar starts estimating your next one."; unsure — "At sign-up you said
your cycles are irregular or you're not sure how long they run, so Cyra won't guess yet. Log a couple of periods
(light flow or more on the Today screen) and the calendar starts estimating your next one."; excluded with no cycle in
use (`kept` 0) — "Every cycle you've logged is left out of predictions, so Cyra won't guess. Turn one back on under
“Your cycles” below, or keep logging."; excluded with one still in use (`kept` 1: an Irregular / Not sure sign-up waits
for two) — "At sign-up you said your cycles are irregular or you're not sure how long they run, so Cyra waits until
two cycles are in use. Only one of yours is in use now — turn another back on under “Your cycles” below, or keep
logging."; long — "It's been {n} days since the last period Cyra knows about, longer than it predicts across. If you
had one since, tap that day to log it." then " Long gaps are common in perimenopause." (peri) or " If you haven't and
that's unexpected, it's worth mentioning to a clinician."; meno — "After menopause Cyra doesn't predict periods. Any
bleeding now is worth mentioning to your doctor — log it on the Today screen so it's in your record."
*Your cycles (L5):* after the card, outside menopause and when at least one finished cycle exists, `div.cycwrap` holds
a closed `Details` (the bordered disclosure on paper, like Settings: the wrapper breaks the `.card + .morewrap` hairline
rule) labelled "Your cycles", plus `<span class="dsub"> · {n} look(s) unusual</span>` while an unusual cycle is still
among the ones in use. Inside (components/CycleList.jsx): "Predictions use up to your last 6 cycles. Tap “Don't use” on
one that wasn't typical for you — after stopping the pill, an illness or a pregnancy, for example. Cyra may point out a
cycle that looks unusual, but only you can leave one out." and "Your Report and insights still count every cycle.",
then `ul.cyclist`, newest first: the running cycle (`li.cycrow.now`: start, "day {n} so far", a faded bar, no switch)
and up to 12 earlier ones (`li.cycrow`, `.out` when left out): start (`.cycstart`, "Started " for screen readers),
"{len} days" (`.cyclen`), a decorative `span.cycbar[aria-hidden]` (width = len / min(120, max(40, current day, longest
counted)), --primary) and the switch `button.takebtn.cycuse[aria-pressed]` (`.on` when left out) named "Don't use for
predictions: the cycle that started {Weekday, Month D}" (the visible "Don't use" first). A row may add `p.cycwhy`:
uncounted spans "Not counted as a cycle: under 15 days." / "…over 120 days." (no bar, no switch); a left-out cycle
"Left out of predictions."; an unusual one (§6.2) a `.statechip.flag` "Unusual" chip and "Much longer|shorter than your
others ({lo}–{hi} days). If it wasn't typical for you, you can stop using it for predictions." — in perimenopause a
long one reads "Much longer than your others ({lo}–{hi} days). Longer cycles are common in perimenopause, so keep it
unless you know it was a one-off." Over 12 cycles: "Showing your last 12 cycles." Toasts: "Cycle from {Mon D} left
out of predictions. Your Report still counts it." / "Cycle from {Mon D} is used for predictions again."
"Tap any day to see or edit what you logged." is a one-line `.hint.calhint` under the legends.

**Patterns:** one patterns card with two views behind a "Day by day / By cycle" switch (the
switch appears only with two logged period starts, never in menopause or pregnancy). *Day by day:*
the day score for the last 60 days, each day a dot coloured by its strongest symptom family —
Heat, Sleep, Mind, Pain, Body, fixed data-viz colours separate from the UI palette — the 7-day
average as a line, period days shaded, the best and hardest 4-day stretches labelled, and under
it, on the same columns, one row per most-logged symptom (plus rough nights) with a dot per day
sized by severity; a callout gives the change in the weekly average since the first week and the
hardest stretch. *By cycle:* one ring per logged cycle (last four), day 1 at the top, dot size =
how hard the day was, period days ringed, the cycle days that are usually hardest highlighted and
named in the callout. Both views share one selection: tapping or arrowing through days opens a
day card naming what was logged, so colour is never the only cue · insight cards, each paired
with an **advice card** carrying an urgency chip (Self-care / Next visit / This week). The same
card, with a "More in Patterns →" link, sits on Home under Today's insight once 3 days are
logged, compact: up to three symptom rows, no hint line, and the day card once a day is tapped.
*Perimenopause spread card (L5, D5):* the number (`{variability}d`) counts every cycle; the sentence lists the last six
lengths with a left-out one labelled: "Cycles ran 28 · 29 · 27 · 30 · 61 (left out of predictions) · 28 days — a 7+
day spread is the clinical marker of the transition (STRAW staging)." (`lensLabel`, from `cycleSummary().lens6`).

**Patterns tab rules (P1; everything here is gated on the full card, `!compact`, so Home's compact card is as A1
describes it).** *Takeaway first:* the callout is the card's headline, `.pcallout.pcallout-top`, between the view
switch and the plot (hairline under it): a 10px aria-hidden triangle (up = better, down = harder), the number in
--primary at --fs-num and the word "better" / "harder" after it (no triangle or word within ±2 points, where the sentence
says the average is about where it was); the cycle view's "Days a–b" headline sits in the same place. The family
legend (`.flegend.flegend-top`, capitalised extras "7-day average", "Period", "Bigger = harder day", "Period day")
sits above the plot, under the one-line hint. *A day already open:* the card mounts with the last logged day selected;
the `.pday` header carries 44px "Previous day" / "Next day" `.linkbtn.pstep` buttons (aria-disabled at the ends) wired to
the same index the arrow keys use, the card's inner content is keyed on the date (120ms `cy-fade-rise`), and the
selection ring and rule slide between days (`.pselg`, a --t-fast transform transition). *Quiet live region:* `.pday` has
no `aria-live`; a visually hidden `p.sr-only[aria-live=polite][aria-atomic=true]` next to it is set only on pointer
release, an arrow-key step or the ‹ › buttons, with `describeDay()` (date, cycle day, period, score, sleep, symptoms
"n of 3"); the visible card still follows pointer moves. Both SVGs carry `aria-roledescription="interactive chart"`.
*Edge:* every score dot takes a 0.8px ink hairline (`color-mix(in srgb, var(--ink) 35%, transparent)`) instead of the
card-colour halo, so a dot has an edge on the card and on the period band; circles stay circles. *Text alternative:*
a collapsed `Details` "The numbers behind this chart" (`.disclosure.more` with the G3 chevron, inside the card) lists
as a plain `ul.pnums` the days logged, the weekly-average change with both week means, the best and hardest stretch
dates and every symptom's day count in the window (all of them, not only the drawn rows), from `dayStats()` /
`symptomRows()`; Home never renders it. *Drawn once:* on mount the 7-day line (`pathLength="1"`, `.pline-draw`:
`cy-draw` 600ms --ease-in) draws in and the dots (`g.pdots-in`: `cy-fade-rise` 300ms, 450ms delay) fade in after it;
rings draw in 60ms apart. The classes are applied only on the first render of a mount while the document is visible
(`visibilityState === "visible"`) and are dropped after 1.2s, so a tap mid-animation never cuts it, picking a day or
switching views never replays it, and the next open of the tab (G4's keyed tabpanel remounts the card) plays it again.
Under `prefers-reduced-motion` the line's dash offset is 0 and the dots opacity 1 from the first paint. *Before the
chart:* under 3 logged days the tab shows the A1 `.plaincard.pchart-soon` placeholder ("Your 60-day chart appears after
3 check-ins · {k} of 3") with "Log today's check-in →" (opens Today); the My Cycle counts card waits for a symptom on 3
days (never "0 of your last 30 days"); with one logged period start (not in menopause) the switch shows the live
"Day by day" next to a dimmed, dashed `span.mc.mc-soon[aria-disabled]` "By cycle · after your 2nd period". *Every
insight leads somewhere:* each insight card ends in an action row `p.pline.aline` ("Add to visit notes →" opens
Report; "Ask about this →", only when `INSIGHT_STARTERS` has a question for the card's symptom id, opens Ask with the
question in the textarea and its library answer shown) under an `Advice mid` with squared bottom corners. When the
weekly average fell by 10 or more points (`dayStats().diff <= -10`) a trend-drop card leads the list (§6.1). With the
POTS add-on on, the pointer reads "Your POTS patterns live in POTS tools." with a "Go to POTS tools →" link that opens
the POTS page (Home's handler).

**Summary first (L8; superseded by calm R6, §3.5d: the summary card and the trend-drop card spoke in day scores and points, so Patterns no longer shows them; the weekly review and the 60-day chart's lighter / usual / heavier words replace them, and `components/SummaryCard.jsx` was removed. `periodSummary` still feeds Home's recap and the PDF.)** Directly under the h1, once anything is logged in the 60 days, `div.plaincard.sumcard`
(`components/SummaryCard.jsx`): a `.mcrow.seg.sumseg[role=group][aria-label="Summary period"]` with two 44px
`button.mc[aria-pressed]` "This week" (pressed on open) / "This month" (React state only, never saved); `p.summeta`
("Oct 16–Oct 22 · compared with Oct 9–Oct 15", the comparison only when the earlier window has a check-in); a
decorative `div.sumcells[aria-hidden=true]` strip of 7 or 30 cells, each logged day filled with its day-score colour
from the data-viz ramp (`scoreColor`, never the UI palette), today ringed in --primary when not logged; and
`p.plain.sumtext[aria-live=polite]` with the §6.1 sentences. With 3+ logged days and nothing in the chosen window it
adds "Log today's check-in →"; under 3 logged days the ChartSoon placeholder below carries that link instead.

**Links in your log (L8).** The old hot-flash card is replaced by `.icard` cards with `.card.findcard` (the family dot,
`famVar(fam)`, before the text) from `patternFindings()`: at most 2 sleep links plus Low energy's, after the
perimenopause spread card, then at most one cycle-day card (never in menopause), then the My Cycle counts card and the
trial cards. Sleep link: `.num` "{R}×" (one decimal under 10, whole above) or "{a}/{n}" for a zero base; text "In your
log, {symptom} was/were moderate or strong {R}× as often after a rough night: on {a} of {n} days after a rough night,
and {b} of {m} after a night you slept well." (zero base: "… on {a} of {n} days after a rough night, and on none of the
{m} days after a night you slept well."). Advice: hot flashes "Next visit" (the treatment sentence); Low energy
"Self-care" ("A link in your log, not proof that one causes the other. If low energy lasts for weeks even after good
nights, thyroid, iron and vitamin D are simple blood tests worth asking about."); any other "Self-care" (the same
caveat, then CBT-I). Ask starters: hf → its own, Low energy → "Why am I so tired?", others → "Why can't I sleep?".
Cycle card: `.num` "Days {a}–{b}"; "In your log, {symptom} showed up most on cycle days {a}–{b}: {x} of the {y} days
you logged there, against {r} of {t} on your other cycle days. Seen in {c} of your last {n} cycles."; Self-care
"Knowing when it tends to come lets you plan around it — …". After the trial cards and before the POTS pointer (which
stays last), with 3+ logged days, `div.plaincard.findhow` holds a collapsed `Details` "How Cyra finds these": what a
link means (not cause), the sleep rule, the cycle rule (not in menopause), `ul.findlist` with one line per check Cyra
ran (ending "— a link.", "— no clear link.", "— a cluster.", "— no clear cluster." or "— not enough to compare yet.")
and "Worked out on this device whenever Cyra shows them. Cyra doesn't save them or send them anywhere; they leave this
device only in a report you choose to share." The chart's Rough nights row counts `isRoughNight` days.

**Report — "What to tell your doctor"** (this is the flagship screen):
0. *Cover* — days logged in the window as a number ("27/30 days logged", date range, stage)
   with a 30-cell strip of logged days (decorative; the number carries it).
1. *What stands out* — numbers translated to plain speech ("showed up **most days** —
   19 of your last 30 days").  Frequency wording: ≥80% "nearly every day", ≥60% "most days",
   ≥40% "about half the days", ≥20% "a few days a week", else "now and then". Each finding
   is a row: a dot in the symptom's family colour (the same Heat/Sleep/Mind/Pain/Body colours
   as the patterns card), the frequency words as a chip, a meter of the logged days (filled
   where the symptom showed up, the family colour itself where it was moderate or strong over a 34% tint
   of it for the other days; the first finding's legend says "Darker = moderate or strong" in light and
   in print, "Full colour = moderate or strong" in dark, where the tint is the darker segment:
   `strongMeterWord(scheme)` in lib/appearance.js) and, with ten or more
   days logged in the 30 days before the window, the change in symptom days against that
   month. Cycle lengths are drawn as dots on one scale with the shortest-to-longest span
   bracketed. Colour is never the only cue: every visual sits beside its sentence.
   *Left-out cycles (L5, D5):* the cycle finding and its numbers keep every cycle. The sentence lists the last six
   lengths with a left-out one labelled — "28, 29, 27, 30, 61 (left out of predictions), 28 days apart. Doctors call
   that a 34-day spread." — and so does the table footer ("Cycle lengths: 28, 29, 27, 30, 61 (left out of
   predictions), 28 days (34-day spread)."); a left-out cycle's dot is hollow (card fill, --primary 2px ring). The
   spread, its chip, the "My cycles have ranged from…" script and the doctor email keep every cycle unlabelled (the
   email lists what happened; the label is about the app's predictions).
   *Hot flashes and sleep (L8):* in perimenopause, when the 60-day sleep link holds (§6.1 hfMult): "**Rough nights and
   hot flashes went together.** In your log, hot flashes were moderate or strong about {x} times as often after a
   rough night." (it replaced the causal "Bad nights made the next day worse."); the doctor email's line is "• In my
   log, hot flashes were moderate or strong {x}x as often after a rough night" (30-day link).
2. *What this might mean* — interpretation in everyday language, threshold-driven, each
   paragraph headed and colour-edged by the finding it is about, always closing with
   "observations, not a diagnosis".
3. *What to say out loud* — numbered verbatim scripts she can read to her clinician, each
   with a Copy button (clipboard only), including "If we try something, how will we know in
   a few months whether it's working?"
4. *Send it ahead* — opens with the Appointment PDF card (L9: a real PDF made on the device, "Download
   PDF" on the web / "Share PDF…" on the phone), then the short email (mailto + copy-to-clipboard).
5. Collapsed "The numbers behind this" — the data table, demoted below the guidance; each
   row carries the family dot and a small bar of days (the table is the text twin of the
   meters above).

*UI R1 — ready for the appointment it is for.* Everything above stays; these are added on top:
- **Appointment context.** Under the h1 a `.rappt` line names the next upcoming appointment
  ("Dr Lee · in 6 days · Change", "today" / "tomorrow" when that close; "Your appointment" when
  no name was given) or offers "Add your appointment date". Both go to Home with the
  Appointments panel open (`goTab('home'); setShowAppts(true)`). Nothing is stored here.
- **Cover.** The text ends "logged by you · prepared {today}". Each logged cell of the 30-day
  strip is tinted by that day's score on the stage RAMP (data-viz colour, same as the calendar
  fill) with a 1px inset edge so the lightest step still reads against the card; today, when
  unlogged, is an outlined cell and the cover adds "Today isn't logged yet. Log today" (→ Today).
- **Thin-data states.** Under 3 logged days: cover, "You haven't logged much yet. A week or two
  of check-ins is enough to start seeing something real.", a "Log today" CTA, then "Send it
  ahead" with the preview and routes — "Open in email" and "Copy email" render in every state.
  3–6 days: "A week or two of check-ins makes this a lot stronger." under the cover. When no
  meaning crosses a threshold, section 2 says "Nothing in your log crosses the thresholds
  doctors usually ask about — that's useful to say too." above the disclaimer.
- **Findings, numbers first.** Each sentence opens with bold "21 of 29 days"; the meter is
  10px with ticks at 60% and 80% (the "most days" / "nearly every day" thresholds), the filled
  part a 34% family tint and the moderate-or-strong part the full colour; one `.flegend` line
  under the first meter replaces the paragraph legend; the meters grow once per mount (450ms
  scaleX, instant under reduced motion). The month-over-month change is a 10px triangle plus
  words: "5 more days than the month before (16 → 21)" in `.worse`, "fewer" in `.better`,
  "same as the month before" in `.flat` — never colour alone.
- **Meanings** carry a family dot and word (HEAT, SLEEP, PAIN; CYCLES for the variability one)
  above the heading and a rail softened to a 55% mix of the family colour with the card.
  Section numerals are Fraunces in --primary (`.rnum`); scripts are set in Fraunces 15px with
  no left rule.
- **Questions that ride along.** Each script has "Add to email and PDF" (aria-pressed; "Added ✓" when
  picked; at most three, further buttons disabled). `buildEmail(questions)` lists them under
  "Questions I'd like to cover:" before the sign-off, and the same picks go into the appointment
  PDF's "Questions I'd like to cover" section (L9). The hint ends "Up to three can ride along in the
  email and the PDF." When the encoded mailto body passes 1,900
  characters the page says "Long for an email link — use Copy email or Share…" (the link is
  still offered). "Copy" on a script reads "Copied" for 1.5s and still toasts; the helper is
  `copyText(text, okMsg, ping)` in `src/lib/clipboard.js`.
- **Routes.** "Download PDF" / "Share PDF…" (sub-label "made on this device") is the filled primary
  route, inside the Appointment PDF card (L9); "Open in email" and "Copy email" are outlined; "Print
  this page" (sub-label "from your browser"; it replaced "Print or save PDF" and the iOS sub-label is
  gone, so the print dialog is not confused with the real PDF route) calls `window.print()`; "Share…"
  (`navigator.share({ title, text })`) renders only when `navigator.canShare({ text })` is true. Routes
  wrap (two per row); page-wide `.routes .route` order is Download PDF, Open in email, Copy email,
  Print this page, [Share…]. The preview is labelled
  "Preview", sized to the whole email (`field-sizing:content`, no inner scroll) and keeps
  `aria-label="Email preview"`.
- **Print.** `@media print` hides the header, section bar, routes, the `.pdfcard`, Copy / Add / Change links and
  the toast, switches the cards to block flow with `break-inside:avoid`, and the page opens
  "The numbers behind this" on `beforeprint` (and on the print media query) so the table prints.
  Print and share hand the same text to the OS that email and the clipboard do; Cyra itself
  still sends nothing (docs/PRIVACY-AUDIT.md, "UI R1").

*Local-first L9 — the appointment PDF* (normative; brief item 5, decision D1; `src/lib/visitReport.js`,
`src/screens/ReportScreen.jsx`, `src/lib/files.js`):
- **File.** `cyra-summary-{today}.pdf`, PDF /Title "Cyra report" (lib/pdf.js), A4 or Letter by locale
  (`paperForLocale`: en-US / en-CA → letter). Built on the device by `visitPdf(visitModel(...), PdfDoc)`
  with the statically bundled writer; handed over by `saveFile` (a browser download, or the phone's
  cache → share sheet → delete path the POTS report uses). No request is made.
- **Header.** Title "Cycle and symptom summary" ("Symptom summary" when no period start is logged) plus
  " · {first name}" only when she gave one and is not in Anonymous Mode; then "{stage} · {Mon d – Mon d,
  yyyy} · N of the last 30 days logged"; then "Prepared by the user in Cyra · observations, not a
  diagnosis".
- **Sections, numbered only when present, in this order.** 1 Recent cycles (the last 7 period starts,
  oldest first: Start / Length ("day k so far" for the running one) / Period days logged / Note —
  "Left out of predictions" and/or "Not counted as a cycle: under 15 days | over 120 days"; above it the
  Report footer's own sentence "Cycle lengths: … days (N-day spread)." built from `cycleSummary().lens6`
  and `ins.variability`, followed by "Every cycle is counted here, including any she left out of
  predictions." when one is excluded (D5); "No period start logged in Cyra." without starts).
  2 Symptoms, last 30 days (up to 8 rows, engine order: Symptom / Days (of N logged) / Moderate or
  strong (severity ≥ 2) and, only when 10 or more days were logged in the 30 days before, "30 days before
  (of M logged)" and Change "same | k more | k fewer" — the screen's rule; otherwise "No comparison with
  the 30 days before (range): M days were logged then, and Cyra compares only with 10 or more."; rows
  beyond 8 in "Also logged: …"). 3 Day score, last 30 days (a 104pt chart with 0/50/100 gridlines, grey
  period bars, a dashed 30-day average, a grey line through runs of logged days and a dot per logged
  day coloured on the stage's light ramp with an ink ring; skipped with fewer than 2 logged days; the
  caption names dayScore's inputs; then "Average a over n logged days; lowest l on d, highest h on d.
  The 30 days before: average p over m logged days." with the averages from L8's `periodSummary` at
  `SCORE_SCALE[stage]`). 4 Fertility signs (only for Trying to conceive with signs on — the same rule as
  the Report's finding and email line: L7's `fertSummaryLines` plus the temperature-rise sentence, then
  L7's Patterns footer as the caveat). Questions I'd like to cover (the picked scripts, at most 3, "1."
  "2." "3."). My day notes (Date / Note, chronological) only while "Include my notes" is ticked.
- **Footer on every page.** "Page n of m · Cyra · Observations, not a diagnosis." Page budget: one or two
  pages without notes; 30 maximum-length notes may reach three.
- **The card** (`section.pdfcard[aria-labelledby=pdf-h]`, first in section 4, both thin and full
  states, rendered only when `plan.can("pdfExport")`): h2 "Appointment PDF"; the contents line built
  from the same model ("In it: …" + "At the top: [your name, ]your life stage and the dates it
  covers."); a `CheckRow` checkbox "Include my notes" when the window has notes (UI state, unticked on
  every visit, never saved; hint "{k} day note(s) in these 30 days. They go in only while this is
  ticked." / "… will be in the PDF."); the WinAnsi warning when a note or name cannot be shown; the
  primary route; the gate "Log a day first. The PDF is made from your check-ins." (`aria-disabled`,
  `aria-describedby=pdf-gate`, never `disabled`, no toast); the limit line only if plan.js ever sets a
  monthly limit (`exportsLeft` / `noteExport`, nothing counted or stored while unlimited, never an
  upgrade prompt); the file warning; "The same numbers are on this page; the tables are under "The
  numbers behind this"."
- **Toasts.** Web: "PDF downloaded. It's in your browser's downloads". Phone: "PDF ready. Choose where
  to send it" before the share sheet; cancel shows nothing; saveFile's own errors unchanged. `busy`
  guards a double tap.
- **Accessible version.** The PDF is untagged; "The numbers behind this" carries the identical cycle
  table (`<caption>` "Recent cycles", th scope=col), the day-score sentence ("Day score (0–100, higher
  is a better day): …") and, while ticked, the "My day notes" list, and the symptom deltas read the same
  model (`visit.symptoms.prevDays`), so screen and file cannot drift.

**Care:** partner list filtered by stage, ordered by match to her logged symptoms.
Each card: brand, "Partner" pill, offer, "Matched: <symptom> (n/30)", **evidence label**
(Strong evidence / Mixed evidence / Comfort, not a treatment / Clinical care), price,
CTA. Commission disclosure appears **above** the list, not buried.

*UI CC1 (Care).* Under the disclosure an `aria-hidden` legend of the four evidence chips
(Strong evidence · Mixed evidence · Comfort · Clinical care) reads the labels once.
"Clinical care" is a kind of option, not a grade of evidence, so it takes `.ev-clinical`
(a 16% primary tint) rather than the "strong" green; Midi Health reads "Menopause-trained
clinician" / "Insurance accepted by many plans". The "Matched:" line carries a 4px
`.smeter` filled to days/30 in the matched symptom's FAMILIES colour (`famColor`;
`--primary` for rough nights, which has no family) — the page's only data-viz colour,
never used on the card border. The first matched card wears `.ppill.fit` "Fits your
log". Each footer has two actions: **"Add to what I'm trying"** (`.sbtn.sadd`, the one
live action: adds `{ name: "<brand> <offer>", kind: midi → habit, else supp, started:
today }` to `meds` and toasts "Added — Cyra will compare your days before and after";
§A3) and the disabled, dashed, `--soft` "Partner link coming soon" (unchanged; no partner
link is live). Empty states: no items for the stage → "Nothing to show for your stage
yet. Check back after the next update."; items but no match → "Log a few days and the
options that fit your symptoms move to the top." The disclosure sentences are unchanged.

**Ask:** free-text question → plain-language evidence answer (~8th-grade reading level)
+ named evidence base (e.g. ACOG, The Menopause Society, Cochrane) + one question to
bring to her doctor + urgent-flag routing if the question describes red-flag symptoms.
Starter pills, the source badge, the landing and the one-tap AI route are in §10 (UI A1).

### 5.2 Pregnancy stage — tabs: Today · Calendar · Milestones · Ask
**Today:** week number + trimester + progress bar to 40 weeks · weekly read · pregnancy
symptoms · **kick counter** · red-flag advice (e.g. severe swelling → contact provider today).
*L6:* the same "Symptoms · Edit" row, "Your symptoms" sheet and "More symptoms · n" as §5.1, with order and Hide only
(`symPrefs.preg`; nothing is borrowed into GSYM, so no "Add from" Details) and the hint "Pick what shows first and in
what order. Hide moves a symptom under More symptoms. Everything you log stays in your calendar, wherever it sits.
Changes save as you go." (pregnancy has no Patterns or Report tab). The day note (§5.1) sits after the advice card and
before the Save bar, saved as `pregLog[iso].note`; `contribute({ sym, kicks })` never gets it.
**Calendar:** week-start markers (w22, w23…), logged-day dots, due-date countdown. No
fertile-window or period prediction — meaningless here.
*UI C1:* the same month navigation, cell naming, selected ring, future styling and day card as §5.1 (the
day-card button is "Edit this day" / "Log this day"; the existing toast "Editing {date} — save to update
that day" is unchanged). Week-start cells are `.c-wk` (2px --accent border, 10% accent tint, `W{n}` tag in
`.c-wklab` at 9px in `--accent-text`, or the cell's own ink on a score fill); logged days are score-filled
with the `.c-log` dot; the legend uses `.d-wk` and `.d-logdot` and is followed by the rough → great gradient
legend. Under the legends a `.card` with Fraunces "w{week}" reads "{40 − week} weeks to your due date,
{due}. Trimester {1|2|3}. Tap any day to see or add what you logged." The hint is "Week markers and your
logged days." The day card adds "**Note:** {text}" after the "{n} kicks" line when that day has a note (L6).
**Milestones:** the full evidence-based prenatal schedule (§7), each item status-tagged
against her current week: done ✓ / in window / coming up / later.
*UI M1:* the tab keeps its name, place and role. The screen opens on "you are here": a "Jump to this week" link
beside the h1, a 6px `.pregbar.road` (`role="img"`, "Week {n} of 40") under it, the shortened hint, then the derived
"Next visit" Advice (§7 "Derived advice"), then Visit rhythm and the four trimester groups. The first in-window (else
next-to-open) card is `.shelfc.now` (primary edge) and is centred on open only when it starts below 80% of the
viewport; focus is not moved (it stays on the tab). Now/soon cards offer "Add to appointments" (§A4).

---

## 6. ALGORITHMS (normative)

### 6.1 Insights
```
counts[symptom] = { days: entries in last 30 with severity>0,
                    strong: entries with severity>=2 }
nightOf(day)     = the night BEFORE that day: a day's own "Last night" answer (L8, src/lib/engine.js)
   rough = sleepQ "poor" (Rough night) or Sleep disruption (sym.slp) >= 2 (the perimenopause quick card's
           Rough night / Barely slept); good = sleepQ "good" (Slept well); So-so ("fair") / unanswered = unknown
sleepLink(id)    = P(id>=2 | rough) / P(id>=2 | good), each day paired with its OWN night, over the last 60
                   calendar days (Patterns); days with an unknown night or without id on that day's form are skipped
   -- shows only with >=5 days on each side, >=4 moderate-or-strong days in all, ratio >=1.3 and a gap of
      >=0.20 (20 in 100 days); a zero base (no hits after good nights) shows as a/n, never as a ratio
      (SLEEP_LINK = { minEach: 5, minHits: 4, minRatio: 1.3, minDiff: 0.2, level: 2 }).
hfMult   = sleepLink("hf") ratio over the last 60 calendar days (Report); hfMult30 = the last 30 (doctor email);
           null when there is no clear link or a zero base. roughNights = isRoughNight days in the last 30.
triggerMultiplier = same ratio for tagged vs untagged days; require >=5 each side;
   surface only if multiplier >= 1.3
```
**Trend-drop insight (Patterns, P1).** From `dayStats(windowDays(…, 60))`: `first` = mean day score of the logged
days in the first 7 of the 60 (3 or more needed), `last` = the same for the final 7, `diff = round((last − first) × 100)`.
When `diff <= -10` Patterns opens its insight list with a `.icard`: `.num` = diff, "Your days have been getting harder
over the last eight weeks — the hardest stretch was {hardest 4-day span}." (the clause only when the stretches are
shown, i.e. best − hardest means differ by 0.08 or more), `Advice urgency="visit"`: "Worth a conversation soon; the
Report tab turns this into a one-page summary you can hand over.", and the action row "Add to visit notes →" (Report).
It is computed from the on-device record and never stored.

**Summaries (L8, `src/lib/insights.js` periodSummary / summarySentences).** Windows: the last 7 (or 30) calendar days,
today included, against the 7 (or 30) before. A change is named only with `compareMin` logged days on both sides (3 for
the week, 10 for the month). Score = round(mean dayScore(e, ids, SCORE_SCALE[stage]) × 100), the same number as the
Calendar and Home; calm = score > 0.64; rough = isRoughNight; top = the 3 symptoms on the most days (ties: summed
severity, then list order). Sentences: "You checked in on {n} of the last 7 days[, up from / down from {p} | , the same
as the week before]." "Your average day score was {s}[, {d} points better than / lower than the week before | , about
the same as the week before]." (±3 points or more is a change; one logged day: "That day's score was {s}.") "{Top}
showed up most ({k} days)[, then {second} ({k2})], with {r} rough nights[, up from / down from {p} | , the same as the
week before]." (no symptoms: "You logged no symptoms and …"; nothing this window: "No check-ins in the last 7 days
yet." plus "You logged {p} days the week before." when there were). Month wording: "the last 30 days" / "the 30 days
before".

**Cycle-day clusters (L8, cycleDayCluster).** `CLUSTER = { maxCycles: 4, win: 4, maxDay: 45, minTotal: 6, minIn: 4,
minLoggedIn: 5, minCycles: 2, minRatio: 2, minDiff: 0.25 }`. Over the last 4 logged period starts (every logged start
counts, including cycles she left out of predictions: D5), each logged day from the oldest of them to today gets a
cycle day (from the latest start before it; days past 45 skipped). The symptom needs 6 days in all; the 4-day window
with the highest rate that holds ≥ 4 of them, from ≥ 2 different cycles, among ≥ 5 logged days, is a cluster when its
rate is at least twice the other cycle days' and 25 in 100 days above it. Needs two starts; never in menopause.

**Home pick (L8, homePick).** Candidates: the perimenopause variability marker (tier 0, the old text) plus every
qualified sleep link and cluster (tier 1, ranked by an internal strength never shown). A finding that qualifies today
but did not 7 days ago (computed on the record up to that day) is shown first, the strongest new one; otherwise the
card rotates daily through the three strongest (day number mod min(3, n)).

### 6.2 Cycle detection and prediction (normative since local-first L5; src/lib/engine.js)
```
period start = a period-flagged day (spotting never counts) with no period-flagged day in the prior 5 days
cycle        = days between consecutive starts (cycleSpans); counted when 15 ≤ length ≤ 120 (CYCLE_MIN, CYCLE_MAX)
kept         = counted cycles she did not mark "Don't use" (cycleFlags, §3.5); the last 6 KEPT are used,
               so a left-out cycle is replaced by the next older one
centre       = round(median(kept lengths))            with ≥ 2 kept
             = her sign-up length (Under 24 → 23, 24–31 → 28, Over 31 → 34)   else, when given
             = the one kept length                    else, with one kept
             = 28                                     else
half         = clamp(max(centre − shortest, longest − centre), min, max)   with ≥ 2 kept
             = few                                    otherwise
               My Cycle / Trying to conceive: min 2, max 10, few 4 · Perimenopause: min 4, max 20, few 6
range        = lastStart + [max(15, centre − half), min(120, centre + half)]    (fromIso … toIso, inclusive)
state        = upcoming (before the range) · window (inside it) · later (past it: "later than your usual range")
no prediction (whyNoPrediction kind): pregnancy (none) · menopause (meno) · Irregular / Not sure at sign-up with
               < 2 kept (unsure; excluded with kept = the number still in use when ≥ 2 are counted) · every counted
               cycle left out and no sign-up length (excluded, kept 0) · more than 120 days since the last start
               (long) · nothing logged and no usable sign-up answer (none). One internal plan() decides, so
               predict() and whyNoPrediction() always agree.
ovulation    ≈ lastStart + centre − 14
fertile      = [ovu − 3 − e, ovu + 1 + e],  e = min(3, max(0, half − 2))   (5 days at ±2, 11 days from ±5)
confidence   = ±half
unusual      = outside median ± max(7, 2.5 × MAD) of the counted ones among her last 12 cycles (≥ 3), strictly outside;
               a SUGGESTION only (the "Unusual" chip): Cyra never leaves a cycle out by itself
variability  = max(lengths) − min(lengths) over every counted cycle (insights(); unchanged, never reads cycleFlags)
```
`predict()` returns, besides the range, `cycleDay`, `center` (also `avgLen`, the name the wearable insight reads),
`late` (days past the centre; the opt-in mood-swings flag still reads it), `daysTo`, `pastRange`, `phase` (day ≤ 5
menstrual, inside the fertile window fertile, before it follicular, else luteal), `fertileDay`, `basis` (logged | told
| default), `used`/`usedLens`/`usedStarts`, `left` (left-out cycles among the ones in use, or all of them when none are),
`oneLogged` and `wide` (perimenopause). Everything is computed on the device and never stored; only her flags are.
`cyclesFrom(days)` (src/lib/record.js) lists one cycle per start from the same engine `cycleSpans()`; `counted` = 15 ≤
length ≤ 120; the running cycle has no length.
**Clinical rule:** variability ≥ 7 days in the peri stage is the flagged marker of the
menopause transition and must trigger the corresponding advice. It counts every cycle, including ones she left out of
predictions (D5); where it lists lengths, left-out ones are labelled "(left out of predictions)".

### 6.3 Day score (drives all color)
```
burden = min(1, symptomBurden*0.5 + (fatigue/10)*0.2 + (pain/10)*0.2 + ((10-moodq)/10)*0.1)
   where symptomBurden = min(1, sum(severities) / (symptomCount * 1.6))
         symptomCount = SCORE_SCALE[stage]: 12 peri / meno, 10 cycle / TTC, 8 pregnancy (L6)
score  = 1 - burden        // 1 = great day, 0 = rough day
labels: >0.82 "A really good day" | >0.64 "A good day" | >0.46 "A mixed day"
        | >0.28 "A hard day" | else "A rough day"
```
`symptomCount` is fixed per stage (`SCORE_SCALE`, lib/constants.js): the library sizes when the score was defined.
`sum(severities)` runs over the tracked list (§3.6), so every symptom she logs still adds its severity, but neither a new
library symptom (Low energy, L6) nor her list ever rescales a past day: a day that didn't log the symptom concerned keeps
its score exactly (unit-tested; the Calendar tints and digits of a record without Low energy are identical to the build
before L6). `symBurden(sym, ids, scale)` / `dayScore(entry, ids, scale)` take it as a third argument; without one they
divide by the number of ids, as before.

### 6.4 Advice thresholds (each produces guidance + urgency)
| Condition | Urgency | Guidance must convey |
|---|---|---|
| cycle variability ≥7 (peri) | Next visit | Marker of the transition; discuss treatment early; ask for lipid panel + bone-health baseline |
| hot flashes/night sweats ≥8 days/30 | Next visit | Highly treatable; ask about hormone-therapy eligibility; non-hormonal options exist |
| sleep disruption ≥8 days/30 | Next visit | CBT-I is first-line, drug-free; treating sleep often improves other symptoms |
| fatigue ≥8/10 sustained | Next visit | Thyroid, iron-deficiency anemia, vitamin D are simple blood tests — ask by name |
| pain ≥8/10 | Next visit | Do not normalize; tracked numbers are harder to dismiss |
| strong cramps ≥6 days/30 (cycle) | Next visit | Not something to push through; endometriosis is under-diagnosed for years |
| flow = "flooding" | This week | Soaking hourly / large clots warrants prompt care; anemia risk |
| odor = "fishy" | This week | Classic bacterial vaginosis sign; common, treatable with antibiotics; don't guess at the drugstore |
| odor = "yeasty" | Next visit | Likely yeast; OTC treatable, but confirm if first or recurring |
| odor = "strong" | Next visit | Healthy vaginas have a scent that shifts across the cycle; **never douche** |
| severe swelling (pregnancy) | This week | With headache or vision changes → contact provider today |

---

## 7. PRENATAL SCHEDULE (evidence-based, low-risk pregnancy)

**Visit rhythm:** every 4 weeks to 28 · every 2 weeks 28–36 · weekly from 36.
Every visit: blood pressure, urine, fundal height, fetal heart rate.

| Weeks | Item |
|---|---|
| 8–10 | Initial visit + labs: blood type & Rh, antibody screen, CBC, rubella/varicella immunity, hep B & C, HIV, syphilis, urine culture, gonorrhea/chlamydia |
| 8–12 | Dating ultrasound |
| 10–13 | Genetic screening — cell-free DNA (NIPT) from 10, or nuchal translucency 11–13 (optional) |
| any | Prenatal vitamin with folate; flu and COVID vaccination |
| 15–20 | Serum/quad screen (if NIPT not done) |
| 18–22 | Anatomy scan |
| 24–28 | Glucose screening (50g); repeat CBC |
| 27–36 | Tdap — every pregnancy |
| 28 | RhoGAM if Rh-negative |
| 28+ | Daily fetal-movement awareness; a real change in pattern = call today |
| 32–36 | RSV vaccine (seasonal, Sept–Jan US) |
| 36–37 | Group B Strep swab |
| 36–40 | Position check; weekly visits |
| 41–42 | Post-dates monitoring; induction discussion |
| <3 wks postpartum | Early postpartum contact |
| ≤12 wks postpartum | Comprehensive postpartum visit |

Always display: this is the standard low-risk schedule; the provider's plan governs.

**Source of truth (UI M1).** The table lives once, as `PRENATAL` in `src/lib/constants.js` (`{ tri, items:[{ w, from, to,
label, note, when? }] }`), read by MilestonesScreen, `engine.roadmapAdvice()` and the pregnancy Home insight ("Next up on
your care roadmap: {label} around week {from}", the first item with `from >= week` and `from <= 42`).

**Derived advice rule.** `roadmapAdvice(week)` (pure, `src/lib/engine.js`, tested in `milestones.test.mjs`): with
`open` = items whose window holds the week and `next` = the first item whose `from` is later (and ≤ 42, so the
postpartum items never "open at week 43"): open → "You're at week {w}: {open[0].label} is in its window now[, and
{next.label} opens at week {next.from}] — ask about it at your next visit."; no open but a next → "You're at week {w}:
nothing is due this week; {next.label} opens at week {next.from}."; week > 42 → "You're past 42 weeks — the postpartum
visits are what's left." No week number is hard-coded; the sentence differs at 22, 30 and 41.

**Status pill semantics.** `.ppill.now` "in window" is primary-filled with white text (the only filled pill);
`.ppill.soon` "coming up" (window opens within 4 weeks) is primary-outlined on a 10% primary tint; `.ppill.done`
"done ✓" (week past `to`) is a borderless 12% primary tint with the check glyph; `.ppill.later` is the plain pill at
85% opacity. --bad (#A04545) is not used on this screen outside the Advice chip. Done items fold to one-line
`.shelfc.done` rows (eyebrow · label · pill, note hidden); every other item keeps its full card.

**Eyebrow strings (SH-15).** `prenatalWhen(item)`: "Weeks {w}" ("Weeks 24–28", "Weeks 10+", "Weeks 28"), except
"Any week" for the folate/vaccines item and "Within 3 weeks of birth" / "By 12 weeks after birth" for the two
postpartum items — never "Weeks any". Trimester headers are `.rsec.tri` with a right-aligned "{n} of {m} done" and a
2px rule, primary (`.now`) on the current trimester (`trimesterOf(week)`, "After birth" past 42).

---

## 8. VISUAL DESIGN

### 8.1 Stage palettes (UI chrome — calm, high-contrast; design system v2 since calm R1)
`PALETTES` in `src/lib/constants.js` is the normative list: three palettes per stage (nine in all), offered as a user
setting (the palette sheet). Each entry carries the seven UI tokens for light and a `dark` object with the same seven
(decision D9, L2). `ORGS` themes carry the same shape (ORGS.cyra dresses the splash and registration; ORGS.bloom is not
selectable and keeps its old values).

**v2 (calm R1, plan §2 and §6; §6 wins on colour).** One warm, airy off-white paper and white cards in light, one deep
navy-charcoal paper and raised navy cards in dark, shared by every stage; ONE muted, pastel-leaning accent per stage on
`--primary`, with a quiet companion hue on `--accent`. The pastel itself is carried by tints (`color-mix` of the primary
into the card, the `--tint-*` domain tokens) and the paper's wash; the token values are the AA-valid tones of each hue.
Stage accents: My Cycle and Trying to conceive = periwinkle/sky, Perimenopause = lavender, Pregnancy = rose,
Menopause & beyond = soft teal. Menopause shares the `peri` stage id, so `stagePalettes(stage, stageName)`
(constants.js) returns the peri list teal-first when `stageName === MENO_NAME` ("Menopause"); `palIdx[stage]` counts
into that ordered list (App.jsx stagePal, RegisterScreen's swatches and the registration preview, PaletteSheet).

```
shared neutrals         paper              card               ink                soft               line
every v2 palette        #FAF7F4 / #131520  #FFFFFF / #1C1F2D  #1E2132 / #E9EAF3  #585C72 / #A5A9C0  #8A8DA3 / #6D7290

                        primary            accent              (light / dark)
periods.periwinkle (1)  #4A5DB0 / #A7B5F4  #B04B72 / #F0A0BE   My Cycle and Trying to conceive default
periods.sky             #2A6694 / #8EC3EC  #A8552F / #F2AE8A
periods.lilac           #7150A6 / #C6AEF2  #4F7A5C / #A6CDB0
peri.lavender (1)       #6B52A8 / #C2AEF2  #3D6E9E / #9CC2EC   Perimenopause default
peri.seafoam            #297070 / #86D2C9  #7150A6 / #C6AEF2   Menopause & beyond default (stagePalettes puts it first)
peri.dusk               #3E5F8C / #9DBBE6  #A84E6E / #EFA3BE
preg.rose (1)           #A3456A / #F2A5C0  #6550A0 / #C2B0F0   Pregnancy default
preg.blush              #9C4A5A / #EFAAB6  #297070 / #86D2C9
preg.apricot            #9C4D2C / #F2B08E  #2A6694 / #8EC3EC
ORGS.cyra               #5B54A6 / #B9B3F2  #A8486E / #F0A3C0   (paper, card, ink, soft, line: the shared neutrals)
ORGS.bloom              #2F5D50 / #8AC2B0  #C89A5B / #D8A96A   (unchanged, not selectable)
```
A stored `palIdx` keeps its number; it now points into the v2 list (no migration: the shape and range are unchanged).
**Dark design rule.** Paper is the darkest surface and card one step lighter (cards lift by lightness and a 1px
`--edge` line, not by shadow); primary and accent are light tones of the same hue, so each stage stays recognisable, and
filled controls carry `--on-primary` text (the dark paper), never white. `paletteFor(p, scheme)` (lib/appearance.js)
picks the seven tokens for the scheme on screen.

### 8.2 Data ramps (saturated — deliberately independent of chrome)
```
peri:    good rgb(26,168,148)  mid rgb(246,189,74)  rough rgb(140,74,168)
preg:    good rgb(42,176,158)  mid rgb(249,176,104) rough rgb(222,84,112)
periods: good rgb(46,154,198)  mid rgb(250,186,82)  rough rgb(226,88,74)
```
**Rule:** calm palettes make poor data colors. Chrome uses the palette; charts,
calendar fills, and score meters use the ramp. Interpolate good↔mid↔rough by score.

**Dark mode (L2).** Data colours have their own dark steps, kept in the data section of `src/lib/constants.js`, apart
from PALETTES and SCHEME_TOKENS and never derived from a UI palette:
```
RAMPS_DARK  peri:    good rgb(0,159,139)   mid rgb(189,137,0)   rough rgb(150,83,178)
            preg:    good rgb(0,159,142)   mid rgb(198,129,55)  rough rgb(219,41,84)
            periods: good rgb(39,149,193)  mid rgb(194,134,3)   rough rgb(212,64,64)
FAMILIES    Heat #E34948 / dark #DF445B   Sleep #2A78D6 / #3987E5   Mind #008300 / #117E00
            Pain #EDA100 / #C38606        Body #1BAF7A / #00A994
```
Validated with the dataviz skill's validator: `node .../dataviz/scripts/validate_palette.js
"#DF445B,#3987E5,#117E00,#C38606,#00A994" --mode dark --surface <each dark card> --pairs all` passes every check on all
11 dark cards (CVD 8.2, normal vision 17.8, every colour >= 3:1); the three ramp runs (each stage's anchors against that
stage's three dark cards and ORGS.cyra's) pass with CVD 12.1, 8.6 and 8.5 and normal vision 19.3, 18.0 and 16.7. In each
dark ramp `mid` is the lightest anchor. The light RAMPS are unchanged: they were owner-approved, and their mid anchors sit
above the validator's light band. The unit tests (lib/appearance.test.mjs) re-run the same OKLab / Machado checks.

**Delivery.** Marks never carry a literal colour. `vizVars(scheme, stage)` sets `--fam-heat … --fam-body` and
`--ramp-good / --ramp-mid / --ramp-rough` inline on `.cy` beside the palette variables; marks read them through
`famVar(fam)` / `famColor(symptomId)` (`var(--fam-*)`, undefined without a family so `var(--fc, var(--primary))`
fallbacks still work) and `rampVar(k)` (`var(--ramp-*)`, the POTS charts). The day-score fill and its ink are pure
functions in `src/lib/engine.js`: `scoreRgb(s, ramp)`, `scoreColorOf(s, ramp)` ("rgb(r,g,b)") and `inkOn(rgb)`, with
`rampOf(stage, scheme)` choosing RAMPS or RAMPS_DARK. The POTS PDF (lib/potsReport.js) keeps the light `RAMPS.peri`
whatever the appearance.

**Low energy's family (L6).** `SYM_FAMILY.eng = "sleep"`: Low energy is the everyday "tired", so a rough night and a
flat next day share the Sleep colour. It is an editorial choice, recorded here; the 0–10 Fatigue slider stays as the
detailed scale and Low energy is the fast severity tap (decision D8 keeps both).

**Family colours and the Heat / Mind pair (residual).** The symptom-family marks (FAMILIES: Heat #E34948, Sleep
#2A78D6, Mind #008300, Pain #EDA100, Body #1BAF7A) keep a red/green pair on the chart dots, which deuteranopes and
protanopes cannot tell apart by hue alone. The marks are deliberately left as the owner approved them (circles, these
colours); the distinction is carried by text channels that are always present with the chart: the legend keeps the
family word next to every swatch (above the plot on Patterns), the symptom rows under the plot are named per row, the
day card lists each symptom by name with "n of 3", and the "The numbers behind this chart" disclosure gives every
count as words. Every dot also carries a 0.8px ink hairline on Patterns for edge contrast against the card and the
period band. No colour anywhere in the app is the only carrier of a meaning.

### 8.3 Contrast requirements
Light: white cards on warm off-white paper; dark: raised navy cards one step lighter than the navy-charcoal paper.
Containers (cards, sheets, the report and shelf cards) carry a decorative 1px `--edge` hairline and a soft shadow in
light (`--sh-card`), and the 1px `--edge` line in dark; interactive controls (chips, pills, segments, disclosures,
inputs) keep a `--line` boundary at 3:1 or more on paper and card (1px since calm R1; inputs keep 1.5px). Near-black
ink in light, near-white ink in dark. Pale-on-pale fails — this was a real defect once.

**v2 minima (calm R1; every v2 palette and ORGS.cyra; lib/appearance.test.mjs).** Light: ink 15.9:1 on card (14.9:1 on
paper); soft 6.59:1 on card, 6.17:1 on paper, 5.76:1 on every domain tint; line 3.27:1 on card, 3.06:1 on paper;
primary 5.76:1 on card, 5.40:1 on paper, 4.60:1 on its own 16% tint; accent 4.92:1 on card, 4.61:1 on paper;
--primary-text 6.51:1 on paper and 6.07:1 on the tints; white on a filled primary 5.76:1; the primary as an icon on a
tint 5.03:1. Dark: ink 13.7:1 on card (15.2:1 on paper); soft 7.04:1 on card, 7.82:1 on paper, 6.17:1 on the tints;
line 3.48:1 on card, 3.86:1 on paper; primary 8.23:1 on card, 9.14:1 on paper, 5.90:1 on its 16% tint; accent 8.16:1 on
card; --primary-text 10.1:1 on paper and 7.98:1 on the tints; the dark paper on a filled primary 9.14:1.

**Dark minima (L2, all 11 dark themes, WCAG, color-mix computed as an sRGB mix; lib/appearance.test.mjs).** Ink 13.3:1
on card (14.9:1 on paper); soft 6.8:1 on card and 5.65:1 on the 10% primary / 10% accent / 5% ink tints; line 3.53:1 on
card (3.92:1 on paper); primary 7.5:1 on card and 5.49:1 on its own 16% tint; accent 7.4:1 on card; on-primary text
(the dark paper on a filled primary) 8.4:1. Status tokens in dark: --bad 7.6:1 on card and 6.1:1 on --bad-chip, the
dark paper on a --bad fill 8.5:1, --good 8.6:1 on card, the ev chips 7.8:1 and 8.5:1.

**Score ink (UI C1).** Text drawn on a score fill (calendar digits, the day card's `.scorepill`) uses
`scoreInk(s)` in App.jsx, next to `scoreColor` (both now thin wrappers over `inkOn` / `scoreColorOf` in
lib/engine.js, L2): `#000000` when the fill's relative luminance is above 0.179,
`#FFFFFF` below it. 0.179 is where black and white both measure 4.5:1 against the fill, so the digit never
drops under 4.58:1 anywhere on the three ramps, light or dark (the old `sc > 0.3` pick with white measured 2.34:1 at
worst). The dark fills stay >= 3.2:1 against their stage's dark cards.
No `> 0.3` ink pick remains in `src/`. Small accent-coloured text on a tinted cell (`.c-wklab`) uses
`--accent-text` = color-mix(accent 82%, ink), >= 5.1:1 on the 10% accent tint in the three pregnancy palettes.

### 8.4 Tokens and motion (src/styles.js, the `.cy` rule)
One scale for every screen; new rules reference the tokens instead of restating pixels.

```
type      --fs-xs 11px (section labels)  --fs-sm 12.5px (secondary)  --fs-md 13.5px (body)
          --fs-lg 15.5px  --fs-num 23px (Fraunces card numbers)  --fs-title 26px (greeting, screen titles)
          body line-height 1.5; display numbers/headings 1.15; labels, pills and legends 1.2–1.35
          floor: nothing below 10.5px except .c-wklab (9px, a two-letter week mark inside a calendar cell)
grid      --gap 8px (between cards and between pills)   --stack 12px (between sections)
radii     --r-card 20px (cards, sheets)   --r-inner 14px (controls inside a card)   --r-tile 16px (quick tiles)
          --r-btn 16px (.cta)   --r-pill 999px   (v2, calm R1; were 13 / 11)
motion    --t-fast 100ms  --t-base 200ms  --t-slow 300ms
          --ease-std cubic-bezier(.2,0,0,1)  --ease-in cubic-bezier(.05,.7,.1,1)  --ease-out cubic-bezier(.3,0,.8,.15)
colour    --primary-text  color-mix(primary 82%, ink): the tint for small primary-coloured text on paper
          --accent-text   color-mix(accent 82%, ink): the same for small accent-coloured text (calendar week tags)
          (links, stage chip, "Matched:" lines, med effect, selected stage name). Measured >= 5.2:1 on paper in
          all nine palettes; Fraunces numbers, filled buttons and the streak/pulse figures keep --primary.
          --good #43604F  --bad #A04545  --bad-bg #FBEEEA: the only status hues in chrome (.up/.down/.better/
          .worse, urgent cards, error hints, the stop button). Data-viz colours stay in FAMILIES / RAMPS.
          These and every other status/surface colour come from SCHEME_TOKENS (lib/constants.js), light and dark
          (the table under "Light and dark" below).
safe area --sa-t / --sa-b: Capacitor's --safe-area-inset-top/bottom when the shell provides them, else
          env(safe-area-inset-*), else 0. Every sticky bar and toast offsets by these, never by env() directly.
```

**Light and dark (L2, decision D9).** Settings → Appearance offers System (default), Light and Dark. The scheme on
screen is `resolveScheme(appearance, systemDark, printing)` in lib/appearance.js: printing → light; otherwise her explicit
choice; otherwise System, read with `matchMedia("(prefers-color-scheme: dark)")` and followed live. Shell puts the result
on `.cy[data-scheme="light" | "dark"]`; the palette variables (`paletteVars(paletteFor(theme, scheme))`) and the data-viz
variables (`vizVars(scheme, stage)`) arrive inline on `.cy`, and styles.js writes `SCHEME_TOKENS.light` into the `.cy`
rule and `SCHEME_TOKENS.dark` into `.cy[data-scheme="dark"]` (with `color-scheme:light` / `dark`, so native controls
and scrollbars follow). The tokens that are not part of a palette, light and dark:

```
--good            #43604F                     #8FCBA4
--bad             #A04545                     #F29B91
--bad-bg          #FBEEEA                     #3B2120
--bad-chip        #F3DBDB                     #4A2826
--err-line        #E0A99B                     #B4685F
--err-edge        #E7C3B8                     #6E3B36
--ev-mixed-bg     #FBEEE2                     #3D2C1B
--ev-mixed-ink    #8A4E18                     #F0BC86
--ev-comfort-bg   #EDE7EF                     #302A36
--ev-comfort-ink  #6E6076                     #D3C6DC
--on-primary      #FFF                        var(--paper)
--on-bad          #FFF                        var(--paper)
--on-ink          #FFF                        var(--paper)
--knob            #FFF                        #EEF1F0
--knob-edge       rgba(0,0,0,.12)             rgba(0,0,0,.5)
--halo            rgba(255,255,255,.7)        rgba(0,0,0,.55)
--mark-edge       rgba(0,0,0,.35)             rgba(255,255,255,.55)
--cell-edge       rgba(0,0,0,.14)             rgba(255,255,255,.16)
--toast-dot       var(--accent)               color-mix(in srgb, var(--accent) 60%, var(--paper))
--sh-card         0 1px 2px rgba(30,33,50,.04), 0 10px 28px -12px rgba(30,33,50,.14)   0 1px 2px rgba(0,0,0,.3)
--sh-opt          0 1px 2px rgba(30,33,50,.05)   0 1px 2px rgba(0,0,0,.3)
--sh-meter        0 1px 3px rgba(30,33,50,.06)   0 1px 3px rgba(0,0,0,.35)
--sh-sheet        0 -2px 6px rgba(30,33,50,.04), 0 18px 48px -12px rgba(30,33,50,.22)   0 4px 16px rgba(0,0,0,.5)
--sh-thumb        0 1px 2px rgba(0,0,0,.2)    0 1px 2px rgba(0,0,0,.6)
--sh-toast        0 4px 14px rgba(0,0,0,.18)  0 4px 16px rgba(0,0,0,.55)
--edge            #ECE7E3                     #2C3044            (v2: container hairline, decorative)
--wash-a/-b/-c    rgba(150,120,230,.06) rgba(100,165,235,.06) rgba(240,130,175,.06)   dark .07 / .06 / .05
--tint-mind       #EAF1FB                     #1F2A40            (pale blue)
--tint-body       #F5EDF8                     #2A2339            (pale lavender-pink)
--tint-patterns   #FDF0E6                     #30261F            (pale peach)
--tint-you        #F2F0ED                     #262836            (neutral)
--sh-lift         0 2px 6px rgba(30,33,50,.06), 0 14px 32px -10px rgba(30,33,50,.24)   0 2px 6px rgba(0,0,0,.35), 0 14px 32px -10px rgba(0,0,0,.6)
--scrim           rgba(30,33,50,.34)          rgba(0,0,0,.58)    (the sheet backdrop)
```
`--on-primary` is the text on a filled primary (.cta, `.seg .mc.on`, `.takebtn.on` and its knob, the done milestone
dots, `.ppill.now`, `.route.primary`, `.orgbtn.on`, `.topbtn.on`, the `.scorepill` fallback), `--on-bad` the text on
`.cta.stopbtn`, `--on-ink` the toast text. **Rule:** no colour literal (hex, rgb(), rgba(), white, black) in styles.js
outside the `@media print` block, and none in JSX; a new colour is a token with a light and a dark value
(lib/appearance.test.mjs scans for one). The light values were the pre-L2 literals until calm R1, which changed the
four shadows and added the v2 rows (the test pins the v2 set).

**Print stays light.** `beforeprint` and `matchMedia("print")` set `printing` with `flushSync`, so the page the browser
snapshots already wears the light palette; `afterprint` (or the media query ending) flips it back. A browser that sends
neither (headless Chromium never fires `afterprint`) leaves the app light after the print until it is reloaded:
harmless, nothing is lost. A print neither event
reaches (some share-sheet prints) falls back to a monochrome rule inside `@media print`: `.cy[data-scheme="dark"]`
forces white paper and card, black ink and primary, grey soft/line/accent and the light SCHEME_TOKENS, all `!important`.

**Document outside the column.** index.html carries `<meta name="color-scheme" content="light dark">`, two theme-color
metas (`#FAF7F4` for `(prefers-color-scheme: light)`, `#131520` for dark: ORGS.cyra's light and dark paper, which the
splash wears; the web manifest's theme and background colour follow the light one since calm R1) and `--doc-bg` (the same two values) as the html/body/#root background, so there is no white flash before
the app runs. Once it runs, `applyDocumentScheme(document, { scheme, paper })` (a layout effect in App.jsx, the only
runtime writer of theme-color) sets `documentElement.style.colorScheme`, `--doc-bg` and every theme-color meta to the
paper on screen, so the page beside the 430px column and the browser chrome match the stage paper in both schemes.

**Reduced motion is reduce, not remove.** Under `prefers-reduced-motion: reduce` keyframe animations do not
run at all and transitions are limited to background-color, border-color, color and opacity at --t-fast, so a
tap still shows its colour change. JS-driven motion (smooth scrollIntoView, the score tween, SVG draw-ins) asks
`reduceMotion()` from `src/lib/motion.js` first and does the instant version when it is true.

**Performance budget.** Anything that animates continuously animates transform or opacity only. `will-change`
only on `.toast.show` and `.tabpanel`. Nothing is scroll-linked. No requestAnimationFrame loops other than the
250ms score tween. Each entrance runs once per mount behind a ref, <= 600ms. The shared keyframes are
`cy-fade-rise`, `cy-pop`, `cy-draw`, `cy-spin`, `cy-pulse` and `cy-grow`; new motion reuses them.

**Palette crossfade.** For 400ms after a palette tap in the palette sheet, an Appearance tap, a flip of the device's own
light/dark setting while Appearance is System (`flashRepaint()`, called from the tap or the media-query listener in the
same render as the new colours) or a registration stage-card tap (a layout effect on `reg.stage`), App.jsx sets
`.cy.repaint`. Under it the page background (`.cy`) and the chrome (`.card`, `.plaincard`, `.cta`, `.tab-on`, `.mc.on`,
`.stagecard.on`, `.pulse`, `.meter`, `.disclosure`, `.pchart`, `.streak`, `.readcard`) transition background-color,
border-color and color over --t-slow, so page, cards, CTA and tabs recolour together. The `.cy` background has no
transition outside that window, and nothing sets `.repaint` on hydrate, a restore, a cross-tab adopt or print: those
replace the palette and the appearance in one frame. So a launch whose saved Appearance differs from the device's
setting shows nothing but the empty loading page in the device's scheme until the record is read, and its first frame
with content already wears the chosen scheme (measured: content at 90-160ms after navigation, final colours in that
frame, no `.repaint`; an adopting tab's page background and cards switch in one frame, with only the 100ms press
transitions of buttons and pills running). The window is scoped so the 100ms press feedback above is untouched the
rest of the time, and FAMILIES / RAMPS inline colours (chart dots, severity marks) are deliberately not in the list:
data never animates.

**Control states (one recipe for every custom control).**

```
rest      card fill, 1.5px --line border, ink text (pills .mc/.pill/.chip/.minichip/.takebtn/.sbtn; cards .stagecard/
          .obopt/.consentopt/.palopt/.disclosure/.route; .cta primary-filled). Buttons set touch-action:manipulation
          and no tap highlight, so the press state below is the only feedback.
pressed   :active, 100ms --ease-std on transform: pills scale(.96) and take the selected tint (primary 12% on card,
          primary border; the lock screen's .key too, L10); cards and the CTA scale(.985), the CTA also brightness(.94). Under reduced motion the
          scale is instant and only the colour transition remains.
hover     only inside @media (hover:hover): border-color moves to color-mix(primary 55%, line). Touch never hovers.
focus     the shared 3px --primary outline (offset 2px). .c-today draws its own ring as an inset box-shadow so
          the focus ring stacks outside it instead of replacing it.
selected  .on / .pill-on / .minichip.on: primary border, primary 12% fill, primary text, weight 700 (never a
          hard-coded hue). Severity: .chip.sev-1 accent 60% border + 7% fill, .sev-2 accent border + 16% fill,
          .sev-3 primary border + 14% fill + 700, so the three steps are distinguishable at a glance.
disabled  .cta:disabled opacity .6; .sbtn:disabled / [aria-disabled="true"] dashed --line border, --soft text,
          weight 600, cursor default. A state that is not a button (e.g. "coming soon") is a .statechip: dashed
          pill, 11px/700, --soft. Scale values at 0 render --soft (.scalehead b.zero), so nothing reads as logged.
targets   44px minimum on .mc .pill .takebtn .sbtn .linkbtn .route .inp .slider .minichip .scopy .palopt .calcell .key
          (not only inside .pots; .key is 56px tall on the lock screen, L10). .inp[type=date] keeps its native appearance so iOS shows the picker affordance.
```

**Segmented control vs pill.** Two to five mutually exclusive answers or views (a chart view, a check-in style,
a sleep answer) are a joined control: the `.mcrow` gets `seg`, the buttons keep `.mc` / `.on` and `aria-pressed`,
and the row renders as one pill-shaped border with the selected segment primary-filled in --on-primary text (white in
light, the dark paper in dark). Segment
labels wrap to two lines at 12px/700; they never truncate (`.seg.scroll` is the variant for more than five short
labels, which scrolls instead). Standalone `.mc` pills remain for multi-select and for independent choices.

**Switch look.** On/off toggles (`.takebtn[aria-pressed]`: reminders, anonymous counts, POTS tools, stand-test
BP) draw a 16x9 track and a 9px knob before their text; `.on` moves the knob right on a translucent track. The
texts ("Turn on" / "✓ On") and `aria-pressed` are unchanged. Action buttons that share the class ("Took it") stay
plain pills.

**Danger.** Destructive confirms are `.cta.stopbtn` (--bad fill), never an inline colour. The one destructive
pill ("Delete everything") carries `.mc.danger`: --bad text with a 40% --bad border, and when open (`.on`) the
--bad-bg tint with a --bad border. The primary tint never appears on a destructive control.

**Icons (src/components/Icon.jsx).** `Icon({ name, size = 16, className })` renders one inline `<svg aria-hidden="true">`
on a 24-unit grid, `stroke="currentColor"`, 2px round strokes, from a path map: chevron, check, close, lock, bell, clock,
chart, clipboard, drop, salt, heart, book, sparkle, print, share, people, plus-circle, lightning, foot, palette, sliders,
apple, google, facebook, file, download, moon (Settings → Appearance), arrow-up and arrow-down (the Move up / Move down
buttons in "Your symptoms", L6), teststrip and thermometer (fertility signs, L7; `drop` stands for mucus), shield
(Settings → Privacy & your data, L10) and backspace (the lock screen's "Delete last digit", L10). No emoji anywhere in src (they render differently per OS and the palette emoji was the most
saturated object on every screen): the header buttons are `sliders` (settings) and `palette`, the kick button `foot`,
the palette tick and the Milestones "done" tag `check`. An icon is decorative: the text node beside it, or the button's
aria-label, carries the meaning, and asserted texts ("✓ On", "✓ Taken", "✓ Sync", the `.ckbox` glyphs) stay as text.
`.labico` (14px, --accent) is the glyph before a label; `.stagechip.icon` is the header icon chip (36px wide, 44px tall,
so the pregnancy header still fits on one row).

**Disclosures.** Every `.disclosure` button ends in `<Icon name="chevron" className="chev" />`, never a '+' or '−' (plus
reads as Add on iOS); `[aria-expanded="true"] > .chev` rotates it 180° at --t-fast. Every disclosure exposes the ARIA
disclosure pattern: `aria-expanded` plus `aria-controls` naming the panel (`Details` ids, `#bodypanel`, `#report-table`,
`#home-*`, `#data-export-panel` / `#data-import-panel` / `#data-wipe-panel`); the data pills are `.mc` buttons that also
carry it. Body-signal `.minichip`s carry `aria-pressed`.

**One level of containment.** A bordered button never sits inside a bordered card. A `Details` inside `.mscard`,
`.pulse`, `.pchart` or `.symsheet` (L6) renders as a row: no border, a 1px --line hairline above, no fill, --primary-text label, the chevron
at the right, 8px vertical padding; its panel is unbordered. The bordered `Details` on Settings, Connect, the consent step
and the wearable confirm cards stay bordered (they sit on paper or in a plain card). `.icard` owns the shadow and radius of
an insight card: its `.card` has no shadow and square bottom corners, so the number card and its Advice read as one card
with one continuous border. An Advice with no card above it takes `alone` (full border, 13px radius, 10px above):
PregTodayScreen, ScaleSection, BodySignals. `.disclosure` padding is 12px 16px and `.bodypanel` 4px 16px 14px, so panel
text aligns with card text. On Home, opening a grid section scrolls its `#home-*` panel into view (`block: nearest`,
smooth unless `reduceMotion()`) and the open panel `.bodypanel.detached` is outlined in --primary.

**Toast.** An inverse surface in both schemes: `--ink` background with `--on-ink` text (white on near-black ink in
light, the dark paper on near-white ink in dark), a `--toast-dot` before the text and the `--sh-toast` shadow.

**Accent anchors.** `.section-lab::before` draws a 6px --accent dot before every section label (a pseudo-element, so
`textContent` is unchanged for the asserted labels). It is off inside `.pchart`, `.pots` and `.palsheet` (data areas and
the Settings/palette sheets, which get their own glyphs), so the accent stays a chrome anchor and never reads as data.

---


### 8.5 Design system v2 (calm R1)
The look the calm redesign (R1–R10) builds on. Everything is tokens on `.cy` (src/styles.js) and SCHEME_TOKENS /
PALETTES (src/lib/constants.js), so existing screens changed look without code changes; new screens use the
components below (src/components/ui/, re-exported from `index.js`). A gallery of every component in every stage
accent, light and dark, lives at `#/dev/ui` (src/dev/DevGallery.jsx) in builds whose VITE_FEATURES names `devGallery`
(or `all`); without the flag the route and its code are not in the bundle (`__CYRA_DEV_GALLERY__`, vite.config.js).

**Paper.** `.cy` paints `--paper` with a faint pastel wash across the top 340px (lavender → sky → pink, `--wash-a/b/c`,
6% or less) fading into the paper. **Cards.** `--card`, `--r-card` 20px, 1px `--edge`, `--sh-card` (soft in light, a
plain line in dark). **Type.** Fraunces (bundled) for card titles, big figures and the greeting; Karla for UI. The
`.eyebrow` is 11px small caps in `--primary-text` with .14em tracking. **Motion** (all off under reduced motion via the
global rule): ring arcs draw in (`cy-ring`, 900ms), sheets rise (`cy-sheet-rise`, 240ms), tiles and the "+" dip on press,
TwoBar bars grow (`cy-grow`).

**Domain tints** (`data-tint="mind" | "body" | "patterns" | "you"` sets `--tintc`): Mind pale blue, Body pale
lavender-pink, Patterns pale peach, You neutral. Used on card headers (a gradient from the tint into the card), icon
badges and quick-tile icons.

**Components** (props; every one tokens-only, 44px targets, focus-visible ring):
- `Card({ title, eyebrow, badge, icon, tint, action, hero, level = 3, as = "section", id, className })`: the v2 card;
  a section named by its title (aria-labelledby); `badge` sits at the end of the eyebrow row (e.g. a Chip); `icon` adds
  an `IBadge`. Classes `.v2card`, `.v2card.hero`, `.v2card-head`, `.v2card-eyerow`, `.v2card-title`, `.v2card-action`.
- `IBadge({ icon, tint, size = 36 })`: `.ibadge`, a pastel circle with the icon in `--primary-text`; decorative.
- `QuickTile({ icon, label, note, onClick, pressed, tint, disabled })`: `.qtile` (84px tall, `--r-tile`), line icon
  in a pastel badge over the label; `pressed` true/false makes it a toggle (aria-pressed); grid `.qtiles` (4 columns).
- `StepRail({ steps: [{ label, sub, state: "done" | "current" | "todo" }], label })`: `ol.steprail[role=list]`,
  ticked / ringed / dashed circles joined by a dotted line; states said in words ("done", "next") for screen readers;
  `aria-current="step"` on the current one. No completeness bar, untouched steps are neutral.
- `Ring({ value 0–1, title, center, sub, word, size = 132, stroke = 10, tone = "primary" | "accent" | "soft", blob })`:
  SVG ring; the accessible name is words only ("Cycle: Day 12, Follicular", "Body: At your usual"); never a number out
  of 100. `blob` draws a soft pastel shape behind it. `.ringrow` lays three side by side.
- `TwoBar({ a, b, diff, diffLabel = "difference", family })`: two labelled bars with day counts and values plus the
  serif difference figure; bars take the FAMILIES colour `var(--fam-<family>)` (the comparison bar the same family at
  42% into the card), never a UI palette colour; a figcaption carries the full text summary.
- `Chip({ variant, children })`: `.vchip.v-<variant>`; `logged` "Logged" (tick; children may extend it), `supported`
  "Supported pattern", `still` "Still showing up", `notenough` "Not enough information", `pro` "Pro". `CHIP_WORDS`.
- `NavPill({ tabs, current, onSelect, onPlus, plusLabel = "Log something", plusExpanded, label = "Sections", panelId,
  fixed = true, plusRef })`: the floating bottom bar; a tablist of five tabs (roving tabindex: ←/→/Home/End move focus,
  Enter / Space / tap select — manual activation since R2) with the filled "+" outside the tablist, centred over the middle
  gap (2 tabs | + | 3 tabs, each side half the width); safe-area aware. The app's only top-level nav since calm R2 (§5).
- `Sheet({ title, onClose, id, closeLabel = "Close" })`: bottom sheet, `role="dialog"` `aria-modal`, named by its h2;
  focus to the heading on open, Tab trapped, Escape / Close / backdrop close, focus restored on close. Render only
  while open.
- `Blob({ variant })` and `EmptyNote({ children = EMPTY_LINE })`: the illustrated moments (inline SVG in the stage
  colours, decorative) and the calm empty state, "A few more logs will show clearer associations."
- Icons added to `Icon` PATHS: home, body, mind, patterns, plus, smile, pulse, move, pill, note, sun, arrow-right,
  calendar, breath.

**Soft ramp** (data viz, separate from the UI): `SOFT_RAMP.light` #A39BE4 #857AD6 #675CC2 #4B42A4, `SOFT_RAMP.dark`
#5E56B0 #7A70D0 #988FE4 #B8B1F4, one periwinkle hue, ordinal; `vizVars` delivers `--soft-1..4`; `.softbars` uses it.
Validator (`validate_palette.js --ordinal`): light on #FFFFFF and #FAF7F4 all checks pass (light end 2.51:1, hue spread
6°), dark on #1C1F2D all pass (light end 2.68:1, hue spread 4°). FAMILIES, RAMPS and RAMPS_DARK are unchanged and still
pass on the new dark cards (unit tests).

## 9. BACKEND (separate service, optional for v1)

Modular Node/Express. Features load from a config list; each is a folder exporting
`{ mount(router, ctx) }`. Storage behind a 4-method adapter (insert/find/update/delete).

| Module | Purpose |
|---|---|
| partners | Partner registry — **one JSON file per partner**, no code to add one |
| referrals | Opaque-token link generation, click tracking, redirect |
| webhooks | HMAC-verified partner conversion events + attribution windows |
| payouts | Fee models: `new_patient_bounty`, `per_visit_fee`, `commission_pct` |
| reports | Aggregate-only partner reporting (counts, never identities) |
| catalog | Stage-filtered Care lineup, so partners update without an app release |
| integrations | Wearables: HealthKit/Health Connect, Oura, Terra aggregator → one normalized schema |
| agent | Pluggable reasoning provider (LLM or deterministic rules), shared tool registry |
| orgs / users | Multi-tenant white-labeling: theme, stages, partner lineup per org |
| auth | Org-scoped tokens |
| oauth | Apple / Google / Facebook name-and-email prefill for step 1 (held in memory ≤ 5 min); app flag `signin` |
| pulse | "You're not alone" anonymous weekly counts (weekly totals only, k ≥ 50); app flag `counts` |
| push | Web push for check-in reminders (push address + keys, schedule, time zone, last day sent); app flag `webReminders` |
| ai | Ask's opt-in AI fallback: forwards the question to Anthropic, keeps nothing; app flag `ai` |
| backup | Encrypted cloud backup scaffold: opaque client-encrypted blobs, never decrypted (§9.1); app flag `cloudBackup`; not mounted in production |

**Attribution model (important):** app requests a referral link keyed to an *opaque
user hash*; user clicks through carrying the token; partner fires a signed webhook on
conversion. First conversion per partner+patient-hash = new-patient bounty; later visits
accrue per-visit fees only. Partners receive **tokens and cohort aggregates, never
identities**. This is what lets affiliate revenue coexist with on-device privacy.

### 9.1 Server surface and feature flags (local-first L4)

**Production = push + ai.** `backend/config/app.json` (NODE_ENV=production) mounts only the two modules the app's
default build calls; `registry.js` `PRODUCTION_MODULES = ["push", "ai"]`. oauth, integrations, pulse and backup stay in
the code and in `config/app-dev.json`; listing one in `app.json` mounts it again (owner decision D2: reversible by
configuration, never by deleting code; `scripts/prod-smoke.js` proves both).

**`VITE_FEATURES`** (build time, `src/lib/features.js`): unset or empty = the defaults `ai,webReminders`; a comma list
replaces the defaults; `all` = every flag; `none` = none; case-insensitive; unknown names are ignored with a build
warning. The build logs `[cyra] features: …`. Flags and the module each one needs:

| Flag | App | Module | Default |
|---|---|---|---|
| wearables | Oura, Fitbit/Garmin/Whoop (Terra), Apple Health / Health Connect, Home's Wearables door/panel/cards, wearable milestones, POTS watch/ring rows | integrations | off |
| counts | "You're not alone" pulse, "Share anonymous weekly counts" | pulse | off |
| ai | "Also ask Cyra's AI" | ai | on |
| webReminders | reminders in a browser (phones always have local reminders) | push | on |
| cloudBackup | nothing yet (scaffold) | backup | off |
| signin | Apple / Google / Facebook prefill on step 1 | oauth | off |

**Rule:** a feature that is off leaves no trace in the UI (no row, section, door, sentence or empty group) and makes
no request; every privacy sentence stays literally true. Flag-dependent sentences are built in `src/lib/disclosures.js`
(with every flag on they are the pre-L4 text exactly). A flag never deletes recorded data.

**Backup module protocol** (`backend/src/modules/backup`): `POST /api/backup` (body = the encrypted envelope as
`application/octet-stream`) → 201 `{id, token, expiresAt}` (id 128 random bits, token 256 random bits, returned once,
only its SHA-256 kept); `PUT|GET|DELETE /api/backup/:id` with `authorization: Bearer <token>`. 415 for any other
content type, 400 empty body, 401 no/malformed token, 404 for unknown id, malformed id, wrong token or expired (all
alike), 413 over `maxBytes` (4 MiB), 507 over `maxRows` (10,000) or `maxTotalBytes` (1 GiB), 429 over the rate limit.
TTL `ttlDays` (90) from the last write; an hourly sweep deletes expired blobs and orphan files. Rows are exactly
`{id, tokenHash, size, createdAt, updatedAt, expiresAt}`; bytes in `<dir>/<id>.bin`. It never parses, decrypts or
logs a body, token or id. The app's `cloudTransport` (lib/backup.js) is fail-closed and gated by
`plan.can("cloudBackup") && FEATURES.cloudBackup` (lib/cloudBackup.js, imported by nothing yet).

---

## 10. AI INTEGRATION

Three call sites, each with a deterministic fallback:
1. **Welcome generation** — one warm sentence from registration answers.
2. **Weekly insight** — returns `{insight, action, urgency, flag_for_doctor}`.
3. **Ask** — returns `{answer, source_note, ask_your_doctor, urgent}`.

Send only aggregated data keyed to an opaque ID — never names, never raw entry logs.
Fertility signs (L7: cervical mucus, ovulation tests, basal temperature) are never in an AI payload: Ask sends
`{ question }` only.
System prompts must forbid diagnosis and dosing, and require an urgent flag for
red-flag symptoms. **In production, proxy these through the backend** — never ship an
API key in client code.

**Starter and insight questions (src/lib/askStarters.js).** `STARTERS` holds a short list per stage (peri: "Does
hormone therapy raise cancer risk?", "What helps hot flashes without hormones?", "Why can't I sleep?", "Am I in
perimenopause?", "Why am I so tired?"; periods: "Why are my cramps worse some months?", "Is a heavy period normal?",
"When is my fertile window?", "Why can't I sleep?", "Why am I so tired?"; preg: "Is it safe to exercise?", "Is this
discharge normal?", "Why am I so tired?", "Why can't I sleep?"; pots, offered only with the add-on on: "Why do I feel
dizzy when I stand?"). `INSIGHT_STARTERS` maps a Patterns insight's symptom id to the question its "Ask about this →"
asks (hf → "What helps hot flashes without hormones?", slp → "Why can't I sleep?", var → "Am I in perimenopause?",
crm → "Why are my cramps worse some months?"). Every string in both maps is answered by the written library on the
device (`answerLocally(q).matched === true`, asserted in askLibrary.test.mjs), so a tapped starter never reaches
Cyra's AI or the network; a card whose id has no entry shows "Add to visit notes →" alone rather than a question the
library cannot answer. `runAsk(q, { ai })` in App.jsx takes the question string (or the Ask button's click event, then
the textarea's text) and an optional one-call override of the saved AI choice, and keeps `question` on `askOut`.

*UI A1 — the Ask screen (src/screens/AskScreen.jsx).* Everything above stays; these are added on top:
- **Starter questions.** Above the textarea, `<p class="section-lab">Try asking</p>` and a horizontally scrolling
  `.askstarters` row of `.askstarter` pills (44px, `--primary-text` on `--card`, not `.mc`) from `STARTERS[stage]`,
  plus the POTS starter when the add-on is on (`potsOn` prop = `potsTab && potsOk`, the same gate as Patterns). A tap
  fills the textarea and runs `runAsk(q)`; every starter is library-matched, so it never reaches the AI or the
  network. On first run (no answer yet) the label and row sit in a tinted `.askintro` panel (7% primary fill, 25%
  primary border); once an answer stands the row stays, untinted. An unmatched answer repeats the row inside the
  card under `The library can answer`.
- **The hint** reads "Plain-language answers from Cyra's written evidence library, built from the guidelines your
  doctor reads." and, only when the build has a backend (`aiAvailable`), " If you turn on Cyra's AI below, any
  answer it writes is labelled." The former third sentence (each answer says where it came from and suggests a
  question) is dropped: the card now shows it.
- **Input.** `<label for="ask-q" class="section-lab">Your question</label>`; the textarea is `#ask-q`,
  `maxLength=500`, placeholder unchanged; past 400 characters a `.askcount` line reads "N / 500 characters";
  Ctrl/Cmd+Enter submits. The button text stays "Ask"; while the AI path runs it reads "Asking Cyra's AI…" with a
  14px `.askspin` ring beside the label (`cy-spin`; under prefers-reduced-motion the ring stands still and breathes
  in opacity with `cy-pulse`, the one keyframe kept under that setting because it moves nothing) and the section
  below carries `<p class="rfoot" role="status">Asking Cyra's AI…</p>`. No skeletons.
- **Landing.** The answer lives in `<section class="askout" aria-live="polite" aria-atomic="true" tabindex="-1">`
  (always in the DOM, empty until there is something to say). When `askOut` becomes a new object the screen calls
  `scrollIntoView({ block: 'start' })` (smooth unless `reduceMotion()`) and `focus({ preventScroll: true })` on the
  section; a module-level marker remembers the object it landed on, so switching tabs and coming back to a standing
  answer neither scrolls nor steals focus, while Patterns' "Ask about this →" (which sets `askOut` before the screen
  mounts) still lands. The card is `.card.askcard`, entering with `cy-fade-rise`.
- **Provenance up top.** `.asksrc` opens the card: a `uchip` badge mapped strictly from `askOut.source` — `library`,
  `server-library` and `server-library-attempted` → "Written library" (`u-visit`), `ai` → "Cyra's AI" (`.u-ai`, an
  18% accent tint with 75% accent-on-ink text, ≥4.5:1 on every palette), `error` → no badge — followed by the
  question asked (`.asksrc-q`). The badge never says more than the footer sentence, which stays verbatim and is the
  authority. The answer keeps the library's paragraphing (`split(/\n\s*\n/)`; no sentence scanner). The evidence base
  is `.askev`: a 3px primary-tinted left rule, "Evidence base: " in bold, then one citation per line — each is an
  `inline-block` span with the "; " kept inside it, so `innerText` is still the exact sentence
  "Evidence base: A; B; C." that the suites read. `<footer class="askfoot">` (hairline top) holds the source sentence
  and "Plain-language education, not medical advice or diagnosis." unchanged.
- **Worth asking.** `.askvisit` wraps the `Next visit` advice and `Copy question` (`.linkbtn.askcopy`), which copies
  `ask_your_doctor` through `copyText(text, "Question copied", ping)` (lib/clipboard.js; the blocked sentence is its
  default).
- **Urgent.** A red-flag answer uses `<Advice urgency="today">` (chip "Today") and the card gains `.askurgent`
  (`--bad` border, 3px `--bad-bg` ring).
- **Unmatched recovery.** The existing sentence ("Cyra's AI can try questions the library can't answer. To use it,
  tick … above and ask again.") stays; when `aiAvailable && !askAI` it is followed by
  `<button class="ghostbtn">Ask Cyra's AI about this</button>` and, directly under it, the AI disclosure paragraph
  (the same `AI_DISCLOSURE` text as the checkbox's). The button calls `setAskAI(true)` and
  `runAsk(askOut.question, { ai: true })`: the one-call override is required because `runAsk` would otherwise read
  the saved choice captured before this render and return the unmatched card again. The visible persisted checkbox
  flips to on, so the next unmatched question goes to the AI without the button. No Ask history is kept.

---

## 11. COPY & TONE

- Plain language at roughly an 8th-grade reading level. Translate numbers into speech.
- Warm, never clinical-cold; never cute or infantilizing.
- Non-judgmental about body topics — odor, discharge, and flow are framed as
  "the signals clinicians actually ask about, and most have simple fixes."
- Honest about uncertainty: show prediction confidence, say when evidence is mixed.
- Never promise more than the evidence supports.
- Every privacy claim in the UI must be literally true of the shipped build.

---

## 12. ACCEPTANCE CRITERIA

**Toast.** `.toast[role=status][aria-live=polite]` is always in the DOM (its text node is empty between messages; never
`display:none`), fades and rises in over --t-base and out over 150ms, and carries a 7px --accent dot. Its lifetime
scales with length: 2.6s for a short sentence, then 1s + 35ms per character, capped at 8s (a 70-character sentence
shows for 3.5s, 180 characters for 7.3s). Over 60 characters it renders `.long`: left-aligned, 14px radius, up to 92%
wide. The suites rely on the cap: the web-live suite waits 10s for a toast to clear and the native suite reads the
toast about 4s after a 70-character one.

- [ ] A user completing registration sees exactly one stage experience, never a stage menu.
- [ ] Skipping a required field and tapping Continue turns it red; optional fields never do.
- [ ] Logging a rough day visibly shifts the score meter color and the calendar fill.
- [ ] Cycle variability ≥7 days in peri produces the transition advice card.
- [ ] The Report opens with plain-language findings; the data table is collapsed below.
- [ ] The Report's Download PDF makes a one-or-two-page PDF on the device; day notes go in only when she ticks Include my notes.
- [ ] Every Care item shows an honest evidence label; commission disclosure precedes the list.
- [ ] Every AI feature still works with the network unavailable.
- [ ] No health data is transmitted anywhere; no API key exists in client code.
- [ ] Pregnancy shows week markers and milestones — never fertile windows.
- [ ] Outlier cycles are suggested, never excluded automatically; exclusions change predictions only.
- [ ] No period prediction in pregnancy or menopause.

---

# ADDENDUM — v2 features (added 2026-10-07, BUILD 2026.10.07-C)

The reference implementation `App.jsx` contains all of the following. Treat the
code as the source of truth for exact behavior; this addendum explains intent.

## A1. Home screen (default tab after registration)
**Home v2 (calm R3; normative where it differs from the older text below, which is kept for history).** `main.homev2`,
top to bottom (pure logic in src/lib/home.js, unit-tested):
1. *Hero* (`.homehero[data-kind]`, no card): the date eyebrow ("Thursday, October 29"), the greeting h1 `.greet`
   ("Good morning, Maya."), then a 176px `Ring` (`.heroring`) over a soft stage-coloured blob (`.heroblob`, inline SVG,
   primary/accent mixed thinly, a slow drift that stops under reduced motion) with a card-coloured centre. `heroModel`:
   cycle stages "Day {n}" + "{phase} phase", value = cycle day ÷ her expected length; pregnancy "Week {n}" + "{tri}
   trimester", value week ÷ 40; menopause "{n}" + "days since your last period" (within 12 months) or the calm state
   (today's date in the ring, "No period tracking needed"); a gap Cyra won't predict across "Day {n}" + "No period on record
   for {n} days"; nothing logged "Log a period start to see your cycle day". Under it one `.heroline` (a button to the
   Calendar when there is a cycle; a plain line otherwise): the prediction with its range ("Next period likely Oct 30 –
   Nov 6", or L5's "any day now" / "later than your usual range") over its basis line, or "Your cycles vary, so the range
   is wide on purpose." with the PCOS module on, or "Cycles vary for you — the range is wide on purpose." for a wide range.
   Trying to conceive with fertility signs shown: the estimated fertile window follows as one compact `.nextrow` in
   the hero (`.herorows`; L7's text, "An estimate, not contraception · Calendar →"), so signs add one row, not a section.
   Then `.todayline` (words only: "Today · slept well · cramps, bloating"; the TTC fertility read replaces it). The
   "N of 14 days" badge, its streak line and the check-in button are gone from Home (the tiles and the "+" log instead).
2. POTS card ("POTS today", still the first `p.section-lab`) and the install tip, when they apply (focus returns to the
   Quick log heading).
3. *Quick log*: h2 "Quick log" + a 44px "Choose your Quick log tiles" button (sheet `#tile-sheet` "Your Quick log": pick 2–4,
   order = pick order, "Put back Cyra's tiles", Done). 2–4 `QuickTile`s (default Symptoms · Sleep · Mood · Move, topped
   up from what the stage can log: Period when there is no Move logger; pregnancy Symptoms · Mood · Meds · Note); "PCOS
   signals" is an option while the PCOS module is on (opens the symptom logger). Each tile opens its logger through the
   "+" sheet's routing and shows a "Logged" `Chip` once today has that entry (`tileLogged`).
4. *Today's small step* (`.stepcard`, `smallStep`): nothing logged today → "Log how your energy is"; a rough night →
   "A 3-minute breathing practice" (sourced; calm R5: its button opens the Slow breathing practice, "Wellbeing support, not treatment."); PCOS on → "Notice your energy after
   meals"; pregnancy → "Note one question for your next visit"; no note → "Add one line about today"; else "Look back at
   your week". An action button, "Not today" (hides it for the day; `homeStepSkip`) and a "Why" disclosure with the source.
5. *Body / Mind rails* (`.railcard[data-tint]`, `StepRail`): Body Sleep · Movement · Symptoms (pregnancy Movement ·
   Symptoms), Mind Check-in · Today's read. Ticks for what today holds; the next step is "current"; Movement is optional
   and never marked next; untouched steps are neutral.
6. *Today's insight* (`.insightcard`, label kept as `p.section-lab`): one finding (L8 `homePick`, plus the PCOS
   cycle-length question once two cycles are counted) with "Associations to raise with your clinician, not a diagnosis or
   medical advice." under it; fewer than 3 check-ins → `EmptyNote` "A few more logs will show clearer associations."
7. *Your patterns* (`HomePatterns`, from 3 logged days): "Day by day" = a soft-ramp sparkline of the 7-day trend (no
   axis, higher = lighter days) and `weekTrend`'s sentence ("This week felt a little heavier than your usual."); "By
   cycle" (two period starts) = four soft bars Period · Follicular · Ovulation · Luteal placed from her own cycle lengths
   (`cycleBuckets`), "Lighter days tend to fall in the luteal phase; heavier ones around your period."; then "Showing up
   most lately" with family dots. No number out of 100 anywhere on Home.
8. Milestones (label "Milestones", no "N of M reached", no progress bar), Coming up (appointments; the period, due-date and
   fertile-window rows now live in the hero), the pulse, and the grid of doors with their panels (unchanged labels; Month vs
   last month says the month "felt lighter / heavier / about the same", What I'm trying says "Your days have felt …
   since starting" instead of a day score).

**Header row (`.mast`, one row at 390px in all three stages and with POTS on, <= 54px).** Wordmark (`.mark` 22px Fraunces
with the `.sub` tag) · name chip `.acctchip` (ellipsised past 110px, full text in `title`) · two 44px round icon chips
(`.stagechip.icon`: palette, then Check-in settings; primary-tinted while `aria-expanded="true"`) · the "{stage} · change"
link as `.stagechip.quiet` (no fill or border, underlined, may wrap to two lines inside its 44px box). Gap 4px; only when
even the wrapped link does not fit does it drop to a second row.

**Trying to conceive (L7).** With fertility signs shown, Home gains no section or card: Coming up's first row is the
estimated fertile window while it is ahead or under way ("Fertile window likely {range}" / "In your estimated fertile
window, until {date}", sub "An estimate, not contraception · Calendar →", opens the Calendar), and the today line under
the check-in button reads today's signs when any are logged. It sits after "POTS today" in reading order and never
moves a section label.

Both stage experiences open on **Home**, not on the check-in form. Home contains, in order:
greeting (time-of-day + name) with cycle day/phase or pregnancy week · gentle 14-day streak
("N of 14 days", never a broken-chain penalty) · one check-in CTA · today's single highest-
priority insight · the patterns card (cycle and peri stages, compact: up to three symptom rows,
the day card once a day is tapped) · "From your wearable" cards (when connected) · milestones
(a row of progress dots with the next milestone named; the full timeline under "All
milestones") · "Coming up" (predicted period or lateness, due date, next appointment with a
prep nudge ≤7 days out) · "You're not alone" pulse (one line when counts aren't available in
the build; how the counts are made sits under "How these counts work") · a two-column grid of
collapsible sections — Month vs last month, Wearables, What I'm trying, Appointments, Journal —
each opening a titled panel under the grid. Feature flags (§9.1): the pulse exists only in builds
with `counts`, and the "From your wearable" cards, the Wearables door and its panel only with
`wearables`; without wearables the grid has 4 doors (2 × 2, the existing odd-last-door span rule
doesn't apply).

**Home states (UI H1).**
- *Greeting row.* Pregnancy reads "Week {n} · {first|second|third} trimester" (`trimesterOf(week)` in lib/engine.js:
  <13 first, <28 second, else third) over a week bar (`.wkbar[role=img]`, aria-label "Week {n} of 40, {tri} trimester"):
  three trimester segments (12/15/13 weeks), the elapsed part in --primary, a marker dot at the current week, ticks
  T1 · T2 · T3 and "Due {month day}" at 10.5px --soft. The 14-day tile reads "Day 1 / let's start" while nothing is
  logged in the last 14 days and takes `.streak.warm` (accent border) from 7 days.
- *Check-in CTA.* Before today's entry: primary-filled "Check in — about 30 seconds". After it: `.cta.done` (card
  background, primary border, --primary-text) "Update today's check-in", with a `.todayline` button under it that
  opens Today: a family-coloured dot (the day's strongest symptom family, FAMILIES) and "Today · score {n} · slept
  {well|so-so|poorly} · {two strongest symptoms}{ +n}". Both label texts are unchanged.
- *Today's insight* is `.card.insight` (primary at 6% over the card) with a family dot before the sentence when the
  insight is about a symptom; the number reads "{n} days", not "n/30". Before 3 check-ins the card counts the gap:
  "0 of 3 · Log a few days and your first insight appears here." then "{k} more check-in(s) and your first insight
  appears here.". From 3 check-ins (L8) the card shows `homePick` (§6.1): the strongest new finding, else a daily
  rotation through the three strongest, the variability marker first (its text unchanged, with L5's left-out sentence).
  Finding texts are two lines at 390px (measured; unit-tested at ≤ 75 characters for every label): "In your log,
  {symptom} flared up {R}× as often after a rough night." / "… flared up after {a} of {n} rough nights." ("flared up"
  stands for moderate or strong; the Patterns card says it in full) with `.num` "{R}×" / "{a}/{n}", and "In your log,
  {symptom} cluster(s) on cycle days {a}–{b}." with `.num` "{a}–{b}". Never causal; the old "Sleep is your biggest
  lever" line is gone. Otherwise the top-count line as before.
- *Your patterns* on Home is the compact card: the view switch and the legend as on Patterns, the callout sentence
  ("Your weekly average is …" / "Days a–b …") above the plot as the card's headline (`.pcallout.top`), a shorter plot
  (viewBox height 150 instead of 206), at most three symptom rows in all (rough nights counted), the day card once a
  day is tapped, "More in Patterns →". Before 3 check-ins (cycle and peri) a placeholder `.plaincard.pchart-soon`
  stands in: an aria-hidden seven-dot sketch in --line/--soft only (no `.pchart`/`.psvg` classes, no family colours),
  "Your 60-day chart appears after 3 check-ins · {k} of 3" and a three-segment `.msbar.three`.
- *Coming up.* The predicted-period and late rows are `role=button` (click, Enter, Space) and open the Calendar; their
  sub-line ends in " · Calendar →". The appointment row keeps its Report nudge. Since L5 the period rows read: upcoming
  "Period likely Oct 26 – Nov 1" and window "Period likely any day now, by Nov 1", each over `basisLine(pred)` ("Based
  on your last 5 cycles · 1 left out", "Based on your last cycle", "Based on your sign-up answer", "Based on a typical
  28-day cycle") + " · Calendar →"; later "Period later than your usual range" over "Your range ended {date} · Normal
  variation happens · Calendar →" ("Irregularity is data too" in perimenopause); and, with no prediction because the
  last start is over 120 days ago, "No period on record for {n} days" over "Over 120 days, so Cyra won't guess ·
  Calendar →" ("Long gaps are common in perimenopause" in perimenopause). No period row in pregnancy or menopause.
- *Perimenopause insight.* The 7+ day spread insight keeps its number and sentence (every cycle counts); when she has
  left cycles out of predictions it adds " This counts every cycle, including the one you left out of predictions."
  ("the {n}" for more than one).
- *Doors.* Each grid button keeps its base label as the first text node and appends its status in `<span class="dsub">
  · …</span>`: Month vs last month · {±n | unchanged | soon}; Wearables · {n connected | optional}; What I'm trying ·
  {latest trial}, day {n}; Appointments · {who | visit} in {n} days (or today); Journal · last entry {today | weekday |
  date}. Scripts that assert these buttons match on the base label.

## A2. Pulse ("You're not alone")
Fertility signs (L7) are never a weekly-count flag: `contribute()` gets `{ sym, sleepQ, flow }` only, and
`FLAG_WORDS`, `PULSE_EVENTS` and `eventsForDay` are unchanged.
**Flag (§9.1):** `counts`, off by default. Without it there is no pulse section on Home, no GET /api/pulse, no
"Share anonymous weekly counts" (consent step, Settings, Today's sharing note, the header's "· sharing counts ✓"),
and a tally an earlier build queued is never sent.

Three stage-specific anonymous aggregate counts ("3,550 women logged cramps this week").
**Demo uses seeded placeholder numbers and says so in the UI.** Production MUST read these
from the backend aggregate endpoint (counts only, k-anonymity threshold, never identities).

**Layout (UI H1).** The section label's textContent is exactly "You're not alone · last week, from people who share
counts"; the part after the name is wrapped in `<span class="seclite">` (sentence case, normal tracking) so the label
reads as a name plus a note. When counts are unavailable in the build (`pulse.status === "unavailable"`) the card
takes `.pulse.quiet`: card background, --line border, 10px/14px padding, the dash at 16px and the sentence in --soft,
so the strongest tint on Home is not spent on a feature that is off. Otherwise the tinted `.pulse` is unchanged. The
`.pulse`/`.pulserow` classes, every sentence and the "How these counts work" disclosure are the same in both states.

## A3. "What I'm trying" — trial-and-error engine
User logs an intervention: `{ id, name, kind: "rx"|"supp"|"habit", started: ISO }` plus a
daily "taken" toggle (`medLog[iso][id]`). Engine compares average day score for the 14 days
before `started` vs 14 days after; requires ≥5 logged days on each side, otherwise shows
"N more logged days to compare". Surfaces on Home inline and on Patterns as a card with a
"bring this before/after to your visit" advice. **Never recommends doses or changes.**
Entry points: the form in Home → "What I'm trying", and (UI CC1) "Add to what I'm trying"
on every Care card, which files the brand and offer as a supplement (Midi Health: a habit)
started today and toasts the same sentence as the form; she can then mark it taken on Home.

## A4. Appointments
`{ id, date, who, note }`. Upcoming list with countdown; ≤7 days → "Prep report" button
routes to Report. Past appointments without a note prompt "What did they say?" (onBlur save).

**Roadmap → Appointments note prefill (UI M1).** The add form's state is `{ date, who, note }`. "Add to appointments"
on an in-window or coming-up Milestones card calls `onPlan(label, when)` in App.jsx, which sets `note` to
"{label} ({when, lower-cased})" (e.g. "Glucose screening (weeks 24–28)"), opens the Appointments panel, switches to
Home and toasts **"Added to Appointments — pick the date"**. The form shows the pending note as a `.hint.apptnote`
line ("For: …") above the date input while present; Add stores it as the appointment's `note` (so a past visit with a
prefilled note never asks "What did they say?" again) and clears the form to `{ date:"", who:"", note:"" }`. The
existing Add toasts are unchanged. Nothing is added until the person picks a date and taps Add.

## A5. Journal
Free text per day, `journal[iso]`, private, last 5 shown. Prompt: "How are you, really?"

## A6. Monthly recap
The last 30 calendar days vs the 30 before (needs ≥10 logged in each; since L8, the same numbers as Patterns "This
month": `recapFrom(periodSummary(…, 30))`; in pregnancy from the pregnancy log; rough nights = isRoughNight). Shows avg day score, calm days
(>0.64), rough nights, and top-symptom days with +/− deltas colored by direction (fewer rough
nights = good). Copy: "a harder month is information, not failure."

## A7. Connect (intimacy & relationship) — evidence-based, inclusive by structure
Sliders 0–10: closeness, desire, tension/conflict, fairness of mental load. Intimacy today:
none / affection / sexual / both (deliberately separated — nurturant vs sexual contact affect
hormones differently). Afterwards: better / same / worse / pain or dryness. Relationship
situation: partnered / more than one partner / single-solo / prefer not to say — **never asks
partner gender; intimacy questions hidden for solo users.** Advice logic reflects the
literature: low fairness + low desire → household-inequity finding; pain → vaginal estrogen /
moisturizers are strongly evidenced, raise at visit; high tension → couples' stress synchrony.
Framing: relationship context predicts desire more than hormone levels (SWAN). The build
does **not** yet cross-reference Connect entries with cycle phase, so the card says only
"Over weeks this builds a picture next to your symptoms." (pregnancy: "…next to your week of
pregnancy and how you felt."); a cycle-phase claim returns only when the engine does it.

*UI CC1 (Connect).* The screen reads `connLog` back: a `useEffect` keyed on `todayIso`
hydrates the sliders, intimacy and afterwards from `connLog[todayIso]` on mount and at the
day change only, never while she is editing (a local `dirty` flag is set by every onChange
and cleared on Save). The score card is idle (`.card-idle`, `.num` "—" in `--soft`, "Move the
sliders and Cyra scores how connected today felt.") until a control moves or today is logged;
then it shows the score, a band word — Close ≥ 75 / Steady ≥ 50 / Strained ≥ 30 / Distant —
as "Steady connection today.", a 4px `--primary` `.cmeter` and a 7-day `.connstrip` of
`.conndot`s (filled when logged, opacity by score, hollow when not, today outlined; palette
colours only, `role="img"` with "Last 7 days: n of 7 logged"). When today is logged, "Logged
today at NN — saving again replaces it." sits above Save. A chosen situation collapses to
"Situation: <label> · Change" (`.sitline`; Change restores the chooser). Band words are
editorial, not clinical. Hint: "Optional, private, and judgment-free. It tracks how connected
you feel, not just sex, and never assumes who your partner is or that there is only one."

## A8. Check-in cadence (anti-nag)
The consent step (under "Remind me on this device", while it is ticked; L11) and ⚙ settings: daily / weekdays / 3× week / weekly / "when I feel like
it" (no reminders). Nudge time: morning / midday / evening / never. **Policy: one reminder
max, never a second nudge, never guilt for missed days — patterns tolerate gaps.** Quick mode
replaces the symptom grid with three stage-specific questions (~10 s) that map onto hero
symptoms so patterns still compute; Full mode shows everything.

**Tap budget (L6, brief must-have 1: a log in under 40 seconds).** Counted from the Today screen as it opens: a quick log
is the three answers + "Save today's check-in" = 4 taps; a full log (a flow, three symptoms, sleep and Save) is 8 taps
from quick mode ("more detail", "Body signals", the flow, three chips, "Slept well", Save) and 7 with Settings "Full
detail". The day note and the symptom list add no tap to either path (the note is one optional link; her list only
reorders what is already there). Measured with Playwright on every change to Today (lf/l6/taps.mjs in the harness).

**Quick questions (UI T1).** `QUICK_Q[stage]` in `lib/constants.js` is three `{ q, a }` entries; `a` is four answers
whose index 0–3 is the value saved (so `QUICK_MAP` and `foldQuick` are untouched and "Rough night" on "How did you
sleep?" lands on `slp` as the 2 that "Yes" used to). The answers read as answers to their question:
- Cycle / TTC: "Any cramps or bloating?" and "Any headaches?" — No / fine · A little · Yes · A lot; "Mood today?" —
  Steady · A bit off · Low · Really low.
- Peri / Meno: "Any hot flashes or night sweats?" — No / fine · A little · Yes · A lot; "How did you sleep?" — Slept
  well · So-so · Rough night · Barely slept; "How's your focus?" — Sharp · A bit foggy · Foggy · Can't think.
- Pregnancy: the three questions keep the default answers; the card is never rendered (no quick mode in pregnancy).
Each question renders as `div[role=group][aria-labelledby]` → `p.qlab` + one joined `.mcrow.seg.answers` of four `.mc`
buttons with `aria-pressed` (labels wrap, never truncate, at 320 px). `QuickCheckin.jsx` is the only reader. While the
peri quick card is on screen the Today sleep `.pill` row is not rendered (its question is already asked); the saved
`sleepQ` and the shared poor-sleep flag still come only from the pill row, so a peri quick-mode day records `"fair"`
unless she opens "more detail" — the q2 → `sleepQ` derivation is deferred (PRIVACY-AUDIT, UI T1).

**Settings rhythm, nudge and reminders (UI S1).** In Settings the five cadences render as a two-column `.regcards.cadgrid`
of `.stagecard` buttons (the fifth spans both columns; labels, descriptions and `aria-pressed` unchanged). The nudge
time is a joined `.mcrow.seg` of the four `.mc` buttons, and it depends on the other two controls: while rhythm is
"When I feel like it", or while reminders are off but could be turned on (`!remindersOn && reminderSupport !== "none"`),
its wrapper takes `.nudgewrap.muted` (dashed rail, tinted rather than filled selection, never an opacity dim, which would
drop the filled pill under 4.5:1) and a one-line hint says why: "You chose no reminders, so there's nothing to time." /
"Reminders are off — this time is used once you turn them on." / "Reminders aren't available here, so this time isn't
used." The buttons stay enabled. The Reminders row shows a `.statechip` "Unavailable" instead of the Turn on switch only
when reminders truly cannot work in the build: `status === "unsupported"` (this browser can't show them) or a web build
with no server (`reminderSupport === "web" && !hasServer()`). A configured server that is merely unreachable keeps the
switch and its existing "Off" / "Turn on" texts (`remindersText` is not retitled).

**Flag (§9.1):** on the web the reminder controls (Settings rhythm `#set-rhythm`, nudge `#set-nudge` and Reminders
`#set-reminders`, the consent step's "Remind me" row and its cadence question) need `webReminders` (on by default);
phones always have them (`remindersInBuild(native)` in lib/features.js). A web build without it never subscribes:
a switch an earlier build left on is turned off at launch, the browser subscription cancelled and its address asked
to be forgotten. "Check-in style" then opens the Check-ins group.

## A9. Wearables & derived insights
Sources: Apple Watch via HealthKit/Health Connect (preferred, on-device), Oura API v2, Terra
aggregator (Fitbit/Garmin/Whoop). Normalized per day: `{ temp (°C deviation), rhr, hrv, sleep }`.
Derived, by stage:
- **Cycle / TTC:** retrospective ovulation confirmation — a day <0.12 followed by ≥3 consecutive
  days ≥0.20 → "consistent with ovulation around <nadir day>"; copy must state it confirms
  after the fact and is not contraception. If no shift yet and cycleDay < avgLen−14 → honest
  "no shift yet, expected around day N". Luteal signature: RHR and HRV averaged follicular vs
  luteal when ≥4 samples each.
- **Perimenopause:** night-sweat signature = temp ≥0.30 AND sleep <60; count per 30 nights,
  cross-referenced with logged night sweats; ≥8 → "Next visit".
- **Menopause (post):** no cycle logic. Report RHR baseline + spike-night count; frame around
  heart health and sleep; ≥6 spikes → "Next visit"; otherwise prompt lipid/BP check.
- **Pregnancy:** RHR average with expected 10–20 bpm climb; sudden jump = tell provider.
**Demo seeds 30 days of stage-shaped illustrative data and says so in the UI.** Production
ingests real device history through the backend integrations hub.

**Flag (§9.1):** `wearables`, off by default (it also hides Apple Health / Health Connect on the phone). Without it:
no Wearables door, panel or "From your wearable" cards, no "Wearable connected" / "Ovulation confirmed by temperature"
milestones, no POTS watch/ring rows, no request to /api/integrations (connect, sync, Terra collect, disconnect retries,
the Oura check after a restore, Delete everything's wearable steps). Recorded rows and connections are kept and
travel in backups; Delete everything shows "Cyra can't end a wearable connection from this version. …" when the record
still holds a real one.

## A10. Milestones (Home)
Usage: first week, full month, wearable connected, started a trial, first visit debriefed.
Clinical by stage — Cycle: first full cycle, 3 cycles, ovulation confirmed by temperature.
Peri: variability ≥7 flagged; **"12 months period-free = menopause" with progress bar**
(months since last period start / 12). Pregnancy: trimester transitions, anatomy-scan window.

**Copy (UI H1).** Peri: "Cycles varying by 7+ days — a sign of the transition", "12 months without a period —
menopause · {k} of 12". Usage: "Trying something new — a med, supplement or habit", "First visit written up". Done
conditions are unchanged.

**Stepper and the one milestone moment (UI H1).** The aria-hidden dot rail on Home is drawn reached-first
(`[...done, ...undone]`, so filled dots are contiguous from the left); the "All milestones" list keeps the order above.
"Next up" is the first unreached milestone with a progress bar, else the first unreached one. `milestonesFor(daysArr)`
in App.jsx is a pure function of a days array; `milestones` is `milestonesFor(days)`. TodayScreen calls
`onSaved(nextDays)` after its save; App compares reached counts before and after and, when one flips, sets a transient
`justReached` for 2000ms (the matching `.mstep` takes `.new`: dot `cy-pop` 350ms, rail `cy-grow` 300ms; none under
reduced motion) and toasts "Milestone reached: {label}". This state is never persisted and never set on hydration or
restore, so the moment cannot replay (`grep milestonesSeen src` finds nothing).

**Home ↔ roadmap bridge (UI M1).** Pregnancy Home's "Today's insight" names the next roadmap item from the same
`PRENATAL` table the Milestones tab draws; a Milestones card's "Add to appointments" lands back on Home with the
Appointments panel open and scrolled into view (HomeScreen scrolls `#home-appts` on first render only when a
prefilled note is pending). Neither direction stores anything until the appointment is added.

## A11. Social sign-in
The Device step (step 2, L11) offers Apple, Google, Facebook. Demo simulates the OAuth round-trip. Production:
real OAuth client IDs, backend callback, verified email+name only. **Apple Sign-In is required
on iOS whenever any third-party login is offered — keep it first.** Copy states providers
receive only name/email, never health data.

**Flag (§9.1):** `signin`, off by default, because the production config mounts no oauth module. Without it the Device step
has no "or fill in your name and email from" line, no provider buttons, no note and no "Exactly what's shared", a
returning `#oauth=` code is dropped without an exchange, and no third-party login is offered at all. When shown,
Apple stays first.

## A12. Production checklist (what the demo simulates)
- [ ] Proxy all Anthropic calls through the backend; no API key in client code.
- [ ] Real OAuth for Apple/Google/Facebook.
- [ ] Real HealthKit / Health Connect / Oura / Terra ingestion → integrations hub.
- [ ] Aggregate endpoint for the pulse (k-anonymity ≥ 50; counts only).
- [ ] On-device persistence (not browser localStorage) + optional user-keyed encrypted backup,
      matching the privacy policy's on-device claims exactly.
- [ ] Push notifications honoring cadence + nudge-time + "never"; no SMS.
- [ ] Capacitor or Expo wrap for iOS/Android from the same codebase.
      Shell notes the web build relies on: `index.html` sets `viewport-fit=cover`, without which every
      `env(safe-area-inset-*)` is 0 inside WKWebView and sticky bars sit under the home indicator; the
      stylesheet's `--sa-t`/`--sa-b` tokens read Capacitor's `--safe-area-inset-*` variables first and fall
      back to `env()`; the iOS config must set the Keyboard plugin to `resize: "body"` so the Ask textarea and
      the Today form are not covered by the keyboard under a sticky bottom bar (no code dependency; a
      `capacitor.config` setting when the shell is assembled). Light and dark (L2): `index.html` carries
      `<meta name="color-scheme" content="light dark">`, two theme-color metas with `media="(prefers-color-scheme:
      light)"` (#EDE4DC) and `(prefers-color-scheme: dark)` (#1B150E), and `--doc-bg` (the same two values) as the
      html/body/#root background, so the first paint is never white; `applyDocumentScheme` (lib/appearance.js) keeps
      color-scheme, `--doc-bg` and every theme-color meta on the paper on screen afterwards. Printing forces the
      light scheme (`flushSync` on `beforeprint` and on `matchMedia("print")`), with the monochrome print fallback
      in styles.js for a print neither event reaches (§8.4).
- [ ] Every UI privacy claim verified literally true of the shipped build.
- [x] Installable web app that opens offline (A14.1); Render serves /, /index.html, /sw.js and /manifest.webmanifest
      with Cache-Control: no-cache.
- [ ] Choose VITE_FEATURES for each release and list the matching backend modules (§9.1); the default offers Ask
      Cyra's AI and web reminders only. For a phone release, match the iOS privacy manifest, the HealthKit
      entitlement, the Health Connect permissions and the store answers to the release's flags (PRIVACY-AUDIT, L4).
- [x] Irregular cycles (local-first L5): predictions from the median of her last up-to-6 kept cycles with an honest
      likely-start range, long cycles to 120 days, "Don't use" per cycle (suggested, never automatic), clinical markers
      keep every cycle (§3.5, §6.2, §5.1 Calendar rules).
- [x] Faster, personal daily log (local-first L6): her symptom list per stage (order, More symptoms, added from the
      other stage's library; everything logged still counts), Low energy in the cycle and perimenopause libraries, an
      optional day note of up to 280 characters on every check-in, kept on the device and in backups (§3.6, §5.1
      "Today: her symptom list and a day note", A8 tap budget, A14.6).
- [x] Trying to conceive: fertility signs (local-first L7, D6): cervical mucus, ovulation tests and basal temperature
      on Today, marked on the Calendar, the fertile-window row and today's read on Home, a Patterns card and a Report
      finding for Trying to conceive; an opt-in for My Cycle; never in weekly counts or the AI (§3.1, A14.7).
- [x] Plain-language summaries and simple links (local-first L8): "This week / This month" on Patterns, sleep links and
      cycle-day clusters in her own log with minimum-data rules and "in your log" wording, Home's insight leads with
      what is new; all worked out on the device, nothing saved or sent (§6.1, §5.1, A1, A6, A14.8).
- [x] Structured PDF export for appointments (local-first L9): the Report's "Download PDF" / "Share PDF…" makes a
      one-or-two-page PDF on the device (recent cycles, top symptoms against the month before, a day-score chart,
      fertility signs for Trying to conceive, her picked questions, day notes only with "Include my notes"), handed
      over like the POTS report; gated through plan.js with no paywall; the Report stays its accessible version
      (§5.1 "Local-first L9", A14.9).
- [x] Privacy dashboard and app lock (local-first L10, D4): Settings → Privacy & your data shows where the record
      lives and a live "What can leave this device" list; a 4–6 digit PIN (PBKDF2-hashed, device-only slot, never in a
      backup), an optional passkey on the web, lock on launch and after Immediately / 1 min / 5 min away, a lock screen
      with back-off, and Forgot PIN → restore a backup (wipe first) or erase, with no back door (A12 "Privacy & your
      data (L10)", "App lock (L10)", "Forgot PIN (L10)", A14.10).
- [x] Onboarding short, phase-first, privacy-forward (local-first L11): the splash states the privacy promise once
      ("Your privacy, plainly", three items) before any personal question, with a 44px "Restore from an encrypted backup"
      toggle; registration is Stage → Device → Cycle | Pregnancy (skipped for Menopause & beyond) → Consent, 13 taps /
      7 screens from the splash to a saved first check-in (was 20 / 11); the optional answers moved to Settings → About
      you; the due date drives the pregnancy week; the install hint waits for the first saved check-in (§4.1, §4.2, A14.11).
- [x] Design system v2 and the condition-module registry (calm R1): warm off-white / navy-charcoal paper with a faint
      pastel wash, 20px cards with a soft shadow (light) or 1px line (dark), one pastel-leaning AA accent per stage
      (periwinkle, lavender, rose, soft teal for Menopause), domain tints, v2 components in src/components/ui/ and the
      `#/dev/ui` gallery behind the `devGallery` dev flag (§8.1, §8.3, §8.4, §8.5); src/lib/modules.js with POTS (wrapping
      the add-on's own switch) and PCOS (data only, every medical sentence sourced and listed in docs/CLINICIAN-REVIEW.md),
      persisted `modules` key in the record and in backups (ARCHITECTURE "Condition modules").
- [x] Five tabs, the log sheet and PCOS in onboarding (calm R2): Home · Body · Mind · Patterns · You in the bottom nav
      pill with the centred "+" log sheet (Symptoms · Period · Sleep · Mood · Move · Meds · Note into the existing loggers),
      segmented sub-views, deep links for the new and old routes (src/lib/routes.js, §5 "Navigation"), the You page
      (stage change, Settings, Modules with the PCOS switch, Care), and the optional "Living with PCOS?" registration step
      (§4.2; `regAnswers.pcos`, Yes / I suspect it → PCOS module on). Every harness walks through lf/nav.mjs.
- [x] Home v2 (calm R3): cycle-day hero ring with the prediction range, Quick log tiles she can choose (`homeTiles`),
      Today's small step with Why and "Not today" (`homeStepSkip`), Body / Mind step rails, one insight with the
      not-medical-advice line, a word-based patterns preview; no streaks, scores or completeness counts on Home (A1).
- [x] Body → Logs, the fast log (calm R4): four quick actions, a week strip, the day's log as rows with Logged chips,
      one-tap loggers in sheets (sleep hours, movement of any kind, meds taken from her list, PCOS signals and dated lab
      values, optional weight; §3.5b), the Calendar in a v2 card with symptom markers, Cycles with the PCOS
      longer-than-35-days count. A typical day measured at 12 taps, about 15 s at a steady 1.2 s per tap (calm/r4/accept.mjs).
- [x] Mind (calm R5): Today | Practices | Journey — a mood check-in in words, eleven 2–5 minute practices each with its
      evidence and named sources (docs/EVIDENCE.md), a reduced-motion-safe breathing visual, "Which one helped?",
      favourites, a free core set with a calm Pro chip, mood across her cycle, journal, Connection and Ask (§3.5c).
- [x] Patterns (calm R6): the cycle timeline, Body and Mind rings in words, pattern cards with honest "Not enough
      information", the 60-day chart in lighter / usual / heavier days (no scores), Share → Report and PDF, and the weekly
      review ending in one optional experiment that Home's small-step card follows (§3.5d).
- [ ] Native biometric unlock (Face ID / fingerprint) through a Capacitor plugin — later work; the phone build offers
      the PIN only (D4).
- [ ] Predicted-period reminder (later, phone only, as a local notification). On the web it would have to send the
      predicted date to Cyra's server, and today's copy promises one reminder at most. The brief's item 7 ("optional
      reminders for logging or predicted period") is met today by the optional logging reminder (A8).

**Settings sheet (UI S1).** `SettingsSheet` is `section.palsheet#settings-sheet[aria-label="Check-in settings"]` with a
sticky `.sheethead` (an `h2.sheettitle` "Settings" that takes focus on open, and a 44px `.sheetclose` button labelled
"Close settings"; the bottom "Done" stays), the `.setgroup` blocks Check-ins / Add-ons & sharing / Appearance / [Install] /
About you (L11) / Privacy & your data (L10; "Your data" before), and each option row a `[role=group][aria-labelledby]` named by its `p.section-lab` (ids `set-rhythm`,
`set-nudge`, `set-style`, `set-addons`, `set-reminders`, `set-counts`, `set-appearance`, `set-privacy`, `set-flows`, `set-data`
(now labelling "Backup, restore or delete"), `set-lock`, `set-lock-after`, `set-lock-bio`), every label opening
with an `svg.labico` glyph. The ids `set-counts`, `set-rhythm`, `set-nudge` and `set-reminders` exist only where their
rows render (§9.1: counts; reminders on a phone or with webReminders), and a `.setgroup` renders only when at least one
of its rows does. Appearance (L2) is `p.section-lab#set-appearance` (the `moon` glyph) over a joined
`div.mcrow.seg[role=group][aria-labelledby="set-appearance"]` of three `button.mc` with `aria-pressed`: "System" (the
default), "Light" and "Dark", and a `p.rfoot` "System follows this device's light or dark setting. Your choice stays on
this device and isn't part of a backup." A tap applies at once (with the 400ms chrome crossfade) and shows no toast.
**About you (L11).** `p.section-lab#set-about` (the `user` glyph) over `div[role=group][aria-labelledby="set-about"]` holding
the `p.hint` "All optional, and you can change them anytime. They stay on this device and leave it only inside an encrypted
backup you choose to save — and your age band and ZIP never go into one." and `AboutYou` (`div.aboutyou`: one collapsed
`Details` per topic, chip rows as `ChipRow` / `MultiRow` from `src/components/AnswerChips.jsx`, no toast per tap). Each tap
goes through App.jsx `setAnswer(k, v)` into `regAnswers` (autosaved within 1 s). `pregWeek` comes from
`regAnswers.dueDate` (`pregWeekFrom`; the fixed week 22 without one), so a due date typed here updates Home at once.
The header buttons carry `aria-controls="settings-sheet"` / `"palette-sheet"` next to their `aria-expanded`; opening one
sheet closes the other (`setShowPal(false); setShowSettings(s => !s)` and the mirror), and Done / Close hand focus back
to the button that opened the sheet (`triggerRef`). The palette sheet (`#palette-sheet`) is a `[role=group]` named by
`p#pal-lab`; each `.palopt` carries `aria-pressed` and its own `--primary` / `--accent` / `--line` / `--paper-mini`,
so its name, border, check and `.palmini` page swatch preview that palette before it is chosen.
The palette previews show the scheme on screen (`paletteFor(p, scheme)`: the light values or the `dark` object) and a
`p.rfoot` above Done says "Showing the light versions." / "Showing the dark versions." followed by "Settings →
Appearance switches between light and dark."; registration's stage-card `.swatch-dot`s use the same scheme.
On the web, when this browser can install Cyra and the record is in IndexedDB, a further `.setgroup` "Install"
(`p.section-lab#set-install`, focusable with `tabIndex=-1` so Home's iOS tip can open the sheet on it) sits between
Appearance and Privacy & your data (A14.1), so the groups run Check-ins, Add-ons & sharing, Appearance, [Install], Privacy & your data (the last group). It never shows in the phone app, in standalone mode or without IndexedDB.

**Privacy & your data (L10).** The last Settings group, top to bottom: `p.section-lab#set-privacy` "Privacy & your data"
(`shield` glyph) → the unchanged `p.datastat` strip → the unchanged "where it lives" `p.hint` (rendered exactly once; L1's
offline-copy `p.rfoot` directly under it) → `p.section-lab#set-flows` "What can leave this device" (`share` glyph) →
`p.hint.flowintro` "What this version of Cyra can send, and when. Nothing about your health leaves this device unless a
row below says On, or you take it out yourself as a backup, file or summary." → `ul.flowlist[role=list]` → an optional
`Details` "Other connections Cyra makes" → `p.section-lab#set-data` "Backup, restore or delete" (`file` glyph) over the
unchanged Encrypted backup / Restore / Delete everything pills → the App lock block (below) → Done. The rows come from the
pure `flowRows(c)` in `src/lib/privacyFlows.js` (`components/PrivacyFlows.jsx` renders them; App.jsx builds `c` from
`lib/features.js` flags, `plan.can("cloudBackup")`, `hasServer()`, `isNative()`, `reminderSupport()` and her settings), in
the order reminders, counts, ai, wearables, files, cloud, each `{ id, name, state: on | off | you | na, note }`:
- reminders: phone — always available, named "Reminders", On iff enabled and status "on"; web — available iff the
  webReminders flag and a server, named "Browser reminders", Off with note `unsupported` in a browser that can't show
  them, else On iff enabled and status "on", with note `pending` while addresses wait to be forgotten; otherwise `na`.
- counts: available iff the counts flag and a server; On iff `research`. ai: iff the ai flag and a server; On iff `askAI`.
- wearables: with the flag in a `VITE_DEMO_WEARABLES` build → Off with note `demo`; else iff the flag and a server → On
  iff a non-demo Oura / Terra entry or an unconfirmed Terra disconnect exists (note `terraOff` when one does); else `na`.
- files: always `you` ("When you make one"). cloud: Off iff the cloudBackup flag and `plan.can("cloudBackup")`, else `na`.
A row with state `na` is not rendered (D2 / D3: a feature that is off leaves no trace; there is no cloud row while the plan
says no). Each rendered row is `li.flowrow` with `div.flowhead` (`b#flow-{id}` the name, `span.flowstate.{state}` the
chip On / Off / When you make one), `p.flowline` (exactly what is sent, `FLOW_COPY.lines`), an optional `p.flownote`
(`FLOW_COPY.notes`) and one `Details` labelled "Details" whose button carries `aria-describedby="flow-{id}"`. The Details
reuse the fact lists their screens show, byte-identical (`components/Details.jsx`: `WebReminderFacts`, `CountsFacts({
stage })`, `AiFacts`, `WearableFacts({ native })`), plus the sentences in `FLOW_COPY.details`, `filesSentence(FEATURES)`
and `WEAR_RESTORE_LINE` (`lib/disclosures.js`; `leaveDevice` is retired). "Other connections Cyra makes" lists `web`
(not on the phone), `server` (only when the build has at least one server flow: web reminders, counts, AI, wearables or
sign-in, with a server) and `signin` (the signin flag and a server), and is omitted when empty. No row has a switch: the
controls stay where each feature lives. Rows are never `.medrow` and never contain the strings the suites use to find
Settings rows (privacyFlows.test.mjs).

**App lock (L10, decision D4).** `p.section-lab#set-lock` "App lock" (`lock` glyph) over a `.medrow[role=group]`
(`b` Off / On, `span` "Ask for a PIN each time Cyra opens on this device." or "{PIN | PIN, or fingerprint, face or screen
lock}. Cyra locks when it opens and {as soon as you leave it | after a minute away | after 5 minutes away}.", and a
`.takebtn` "Set a PIN" (`aria-expanded` / `aria-controls="lock-panel"`) or "Lock now"), the honest `p.rfoot` (web: "The
lock keeps Cyra closed on this device until your PIN is entered. It doesn't encrypt what's stored: anyone with full
access to this browser, for example through its developer tools, could still read your record. Only an encrypted backup
file is locked with a passphrase."; phone: "…on this phone… It doesn't encrypt what's stored; your phone's own passcode
is what protects its storage. …") and a `Details` of the lock facts (`LOCK_COPY.facts`, plus the POTS line while POTS is
on and the phone line on a phone). While on: `p.section-lab#set-lock-after` "Lock again after" over a `.mcrow.seg` of
`.mc[aria-pressed]` Immediately / 1 minute / 5 minutes (`after` 0 / 60 / 300); on the web, when
`PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` is true, the passkey `.medrow` (`b#set-lock-bio`
"Fingerprint, face or screen lock", `.takebtn[aria-pressed]` Turn on / ✓ On, its Details); a `.mcrow` of `.mc` "Change
PIN" and "Turn off lock". Panels share `div.plaincard#lock-panel` (set: New PIN / Repeat it, "Turn on the lock" / Cancel;
change: Current PIN + the two, "Save new PIN"; off: "Turn off the app lock?", Current PIN, "Turn off the lock" / "Keep it
on"; passkey: Current PIN → Continue, then "Set it up", which calls `createPasskey` inside the tap). Opening a panel
focuses its first field; Cancel or success returns focus to the opener. Errors: "Use 4 to 6 digits.", "The two PINs don't
match.", "That PIN is easy to guess. Avoid a run like 1234 or one digit repeated.", "That isn't your current PIN.", "Too
many tries. Try again in m:ss." (live), "Cyra couldn't save the lock on this device. Try again.", "Setting up
fingerprint, face or screen lock didn't finish. Your PIN still works.". Every string is in `LOCK_COPY` (`src/lib/lock.js`).
- **PIN.** 4–6 digits (`validPin`; `weakPin` refuses a repeated digit or a straight run), hashed with PBKDF2-SHA-256,
  600,000 rounds (`PIN_ITER`, the backup's cost), a random 16-byte salt, 32-byte output (`hashPin` → `{ salt, hash, iter,
  len }`); `checkPin` re-derives and compares in constant time. The PIN is never stored.
- **The slot.** `LockCfg = { v: 1, pin, after, cred: { id } | null, fails, waitUntil }` lives outside the record: web
  IndexedDB `cyra` / `state` key `v1-lock`; phone `Library/NoCloud/cyra-lock.json` (`storage.loadLock` / `saveLock` /
  `clearLock`, all through the save queue). It is not in PERSISTED, RECORD, DEVICE_ONLY or `snapshot()`, so never in a
  backup, the autosave or another tab's adoption; `cleanLock` validates it on every read (a damaged slot reads as no lock;
  `waitUntil` is capped at now + 15 min). App.jsx reads it in `hydrate`, only after the record and only when there is one,
  and the first render after hydration is already locked. Delete everything removes it (web: `clear()`, same
  transaction; phone: `clearLock()` after the record), as do Start over and a forgotten-PIN restore; the phone also
  clears a stale copy when a new record starts (`finishReg`, the splash restore).
- **When it locks.** At every launch with a slot, and on hide / show: `after === 0` locks on the hide itself
  (visibilitychange hidden, pagehide, appStateChange inactive); otherwise `shouldLock({ afterSec, awayMs, graced,
  running })` on show (`awayMs` is the larger of the wall-clock and `performance.now()` deltas). A hide within `GRACE_MS`
  (3 s) of a hand-off Cyra started itself (`holdLock`: the backup download / share, the Restore file picker, the passkey
  prompt, the Report's PDF / email / print / share, the POTS report save / share) is graced and locks only after
  `GRACE_MAX_MS` (5 min). Nothing locks while a POTS stand test or movement session runs (`running`) or during a wipe.
  "Lock now" locks at once. Another tab's change arrives as the BroadcastChannel message `lock` (→ `reloadLock`).
- **Back-off.** `FREE_TRIES` 5, then `BACKOFF_SEC` 30 / 60 / 120 / 300 / 900 s (`afterFail` persists `fails` and
  `waitUntil`; `afterSuccess` zeroes them). `verifyPin` is the one check: the lock screen and every Current PIN field in
  Settings share it and the persisted counter.
- **Passkey (web only).** `createPasskey` (rp "Cyra", user "Cyra lock", platform attachment, user verification required,
  attestation none) keeps only the base64url credential id; `verifyPasskey` asks for an assertion with that id and checks
  rawId, type, challenge, origin and the UP + UV flags itself (`checkClientData`, `checkAssertion`). No network. The phone
  build never offers it.
- **Lock screen** (`src/screens/LockScreen.jsx`): `main.splash.lockscreen[aria-labelledby=lock-title]` in the base org
  theme (never the stage palette; the theme-color meta and page background follow) with the wordmark, `h1#lock-title`
  "Cyra is locked" (focused on mount), no BUILD stamp, no header, tabs, sheets or toasts behind it. View pin: "Enter your
  PIN to open it.", `input.inp.pinfield[aria-label=PIN][aria-describedby=lock-status]` (digits only; Enter submits; the
  PIN's length auto-submits), `p#lock-status.lockstatus[role=status]` ("Checking…", "That PIN isn't right. {n} more
  {try|tries} before a short wait.", "That PIN isn't right.", "Too many tries. Try again in m:ss." with a 1 s tick in an
  aria-hidden span and a `.sr-only` "Too many tries. You can try again in {30 seconds | 1 minute | 2 minutes | 5 minutes |
  15 minutes}." announced once, "You can try again now.", "Fingerprint, face or screen lock didn't unlock Cyra. Use your
  PIN.", "Cyra couldn't check your PIN just now. Try again."), `div.keypad[role=group][aria-label="PIN keypad"]` of 3×4
  `button.key` (1–9, a spacer, 0, `.key.del` "Delete last digit" with the `backspace` glyph; 56px tall, disabled while
  checking or waiting), a document keydown handler for 0–9 / Backspace / Enter while no field has focus, the
  `.ghostbtn` "Use fingerprint, face or screen lock" when a passkey is set, and `.linkbtn.lockforgot` "Forgot your PIN?".
  View unreadable (the slot couldn't be read at launch): "Cyra couldn't read its lock settings on this device.", `.cta`
  "Try again", and the Forgot options. After an unlock focus lands on `.tab-on` (an open sheet focuses its own title).

**Forgot PIN (L10).** View forgot: "Cyra can't reset your PIN. There's no account and no back door. You can restore an
encrypted backup, which replaces everything on this device and turns the lock off, or erase Cyra's record on this
device.", a `.mcrow` of `.mc` "Restore from a backup" and `.mc.danger` "Erase this device's record"
(`aria-expanded` / `aria-controls`), and `.linkbtn.lockforgot` "Back to the PIN". Erase shows the existing Delete
everything confirm (`WipeConfirm`, `#lock-wipe-panel`, byte-identical). Restore, step 1 (`#lock-restore-panel`): Backup
file, Passphrase ("Backup passphrase"), `.cta` "Open my backup" ("Unlocking…"), "Opened on this device with your
passphrase. Nothing changes until you confirm on the next step."; the backup is decrypted and checked (`readBackup`, the
same errors as Settings) into memory only. Step 2: the same `WipeConfirm` with the intro "Your backup opened. Restore it
on this device? Cyra first deletes everything on this device, the same as Delete everything: every check-in, POTS log,
note, appointment and setting here, and the app lock.[ This also {deleteAlso}.] Then it puts your backup in their place
and opens without a PIN." and the button "Yes, restore my backup" ("Restoring…"). It runs `wipe()` (every server step,
this device's clean-up, the record, the lock) with `then` = write `forgotPinRecord(backup)` (`lib/lock.js`: persisted keys
from the backup only, minus DEVICE_ONLY / DEVICE_PREFS / NOT_IN_BACKUP and `reminders`; wearable connections from the
backup, marked unconfirmed; reminders off on the web; a new POTS epoch) into the fresh store, then reloads on `#restored`
(or `#restored=rem` when the backup had reminders on in a web build with reminders; `#restore` when the write failed,
which opens the splash on its restore form with "Cyra deleted this device's record but couldn't put your backup in its
place. Choose the backup file again to restore it."). Verify → wipe → write → reload, never a merge: a merge would have
let a crafted backup unlock the existing record.

**Data status strip (UI S1).** Above the Encrypted backup / Restore / Delete everything pills, `p.datastat` reads
"{N} days logged · last backup {today | yesterday | N days ago | Mon D | never}" ("never — worth doing once" from seven
logged days). `relDay(iso, todayIso)` lives in `lib/engine.js` next to `fmt`. The date comes from the new persisted key
`lastBackupAt` (ISO day, set by `exportBackup` on success only: after the share sheet returns on the phone, after the
download is triggered on the web), which is DEVICE_ONLY: it is not in the record other tabs adopt, it is deleted from
the snapshot before encryption so it is never in a backup file, a restore keeps this device's own value, and Delete
everything removes it with the rest. The persisted key `appearance` (L2: `"system" | "light" | "dark"`, anything else
reads as "system") is a `DEVICE_PREFS` key in App.jsx, kept next to DEVICE_ONLY: it is saved with the on-device record
and stays in RECORD, so every open tab of this browser follows a change (they are one device); `exportBackup` deletes
every DEVICE_PREFS key from the snapshot before encryption, `importBackup` skips them and keeps this device's value, and
Delete everything and Start over erase it with the record (the next launch is System). The backup and restore inputs have visible `label.flab` wrappers; their
placeholders and aria-labels are unchanged. The POTS add-on's off-state description is one sentence; "Works alongside
{stage}. It doesn't change your life stage." moved verbatim into its "Exactly what's kept" panel (PRIVACY-AUDIT, UI S1).

## A13. POTS add-on

**A13.1 Placement.** POTS tools are an optional add-on inside whichever single life stage the user has. They are
never a stage, never offered as a stage choice, and never change `stage` or `stageName`. One switch (`pots.on`,
Settings → Add-ons) adds a "POTS today" card to Home; POTS tools open from that card (or from a Today link) as a
page under the current tab, with a Back button, and are never a tab in that stage's tab set. Changing stage keeps
the POTS log and switch. A "POTS or dysautonomia" registration condition may show one Home offer card, once; it never
turns the add-on on by itself.

**A13.2 Data.** All POTS data lives in the persisted key `pots` (shape in lib/pots.js `POTS_EMPTY`), inside the
on-device record: autosaved, included in the encrypted backup, replaced by a restore (a backup without `pots`
clears it; a restore starts a new epoch), merged across tabs (`mergePots`: the newer epoch wins wholesale; within
an epoch a 3-way merge against the last saved copy, with tombstones never capped within an epoch), and deleted by
Delete everything. On the web every save also writes a second copy of `pots` to its own key in the same
IndexedDB store; a record saved without a `pots` key (by a tab still running a build from before POTS) takes the
log back from that copy at the next launch. Delete everything clears the whole store, copy included. Entries are
filed under the device's local day at the moment she logs them: the app moves to a new day at local midnight
and whenever it comes back to the foreground, and a half-filled check-in open at midnight stays open as an edit
of the day it was started on. Erasing the POTS log starts a new epoch and clears every free-text and health setting, keeping
only display choices. A `pots` whose `v` this build doesn't know is kept untouched and read-only, never
overwritten. It is never written to `days[]` or `pregLog`, never enters `dayScore`, `insights()`, the recap or
`eventsForDay`, and never leaves the device except in a file the user exports herself. Exports never use
registration answers. POTS symptom and trigger ids match `^(p|t|c|x)_[a-z0-9]{1,16}$` (built-in lists:
17 symptoms, 15 triggers, lib/potsConstants.js) and must never equal a weekly-count flag id or a SYM/PSYM/GSYM id.
POTS data is never part of weekly counts and never sent to Cyra's AI.

**A13.3 No diagnosis, no dosing.** POTS output never states or denies a diagnosis ("you have POTS" and similar
wording, "diagnosed with", "positive", "negative", "normal result", "abnormal" are banned, as are "late" and
"missed"; `POTS_BANNED`, checked by unit and e2e tests over POTS output, not by a whole-bundle grep). Fluid and sodium goals are entered by the user, labelled
"set by my clinician" or "my own", and never pre-filled. Typed amounts read thousands grouping ("2,500",
"1.000", "1 000") as the whole number and a lone comma as a decimal comma; text that isn't a number is an error,
never "left empty". Free text (notes) is saved as she types, like a tap. Guideline ranges appear only in a cited Details panel
with who-should-not caveats. The medicine library holds names and classes only. A free-text note is the user's own
words and is never parsed. Exercise durations are blank until the user enters them; step-ups are options she
chooses, never automatic, and never offered in pacing mode, after an exercise faint until she reports being
checked, or without a clinician "yes". In pregnancy the plan and options need a separate prenatal-team "yes",
which is cleared on every change of stage into pregnancy.

**A13.4 Standing test constants (normative).**
- Rest before standing: 5 or 10 min (defaults: active stand 5, lean 10). Lying readings at rest minutes
  restMin−1 and restMin; baseline HR = mean of the last two lying readings (or the one taken)
  (baseline BP likewise, over lying readings with both numbers). Thresholds are compared with the
  unrounded mean; numbers are shown whole or to one decimal (a half beat shows as .5).
- Upright readings: at minutes 1, 3, 5, 10, or every minute 1–10 (BP only at 1, 3, 5, 10). Minute 0 = the
  user's "I'm up" tap. Timing is wall-clock. Late readings keep their actual time. Test ends at minute 10
  (hard stop of the clock at 10:30).
- HR threshold THR = 30 bpm (40 when the teen setting is on; copy always names 40 for ages 12–19).
- Sustained: two consecutive taken upright readings with rise ≥ THR, the later at minute ≥ 3, ≤ 5 min apart.
  Single: peak rise ≥ THR without a sustained pair — "single_last" when the last taken upright reading is ≥ THR
  (nothing later shows whether it lasted), otherwise "single_mid". Below: peak < THR. Insufficient: no baseline
  or < 2 upright.
- Counted-pulse caveat when a counted reading feeds the baseline, peak or pair and |peak rise − THR| ≤ 6.
  Resting-HR note when the lying baseline is ≥ 100.
- High standing HR note: any upright HR ≥ 120.
- Orthostatic BP drop: systolic ≥ 20 or diastolic ≥ 10 below baseline within 3 min ("drop" when ≥ 2 early
  readings meet it or the last early reading at ≥ 3 min does; "single_drop" for one; "late_drop" after 3 min).
- Supine high: lying ≥ 140/90 (visit note when on ≥ 2 tests). Live crisis interrupt: any ≥ 180/120; upright,
  its second button only reopens the reading ("I typed it wrong") and the copy says to stop the test before
  resting, so the standing clock never runs while she sits.
- Pregnancy blood pressure (ACOG PB 222; copy pending clinician sign-off): any reading ≥ 160/110, lying or
  upright, raises a live maternity-unit card (before the crisis check) and an urgent line on the result from the
  first test; ≥ 140/90 adds a same-day ("Today") maternity-team line on the result and under a single reading.
  With either, the result never says the blood pressure "held steady" ("didn't drop") and the pregnancy caveat
  drops "rather than reading too much into them".
  Live low interrupt: upright systolic ≤ 80, or an early drop while symptomatic (systolic and diastolic
  each checked on its own, so one typed number is enough).
- Live interrupts that need no BP: turning on the Vision dimming, Sick or Short of breath feel chip while
  upright ("Lie down now and raise your legs. You can stop here.", Stop first); the Chest pain chip goes
  straight to Stopped with the chest urgent card; an upright HR ≥ 20 bpm below the previous upright reading;
  any HR ≥ 170. In pregnancy every lie-down instruction (these cards, the Stopped heading and the faint card's
  "Otherwise" line) says left side, not flat on the back.
- Input sanity: HR 30–220, systolic 60–260, diastolic 30–160 (outside = "That looks unusual. Check the
  number?" and not stored). The live interrupts check the value as typed up to a plausibility cap
  (HR 20–300, systolic 40–300, diastolic 20–250), so an extreme real reading still raises its card.
- Blood pressure result: "held steady" only when a lying BP and at least one standing BP in the first
  3 minutes were taken; otherwise the result says which blood pressure wasn't taken.
- Safety: the safety screen and two gates precede every test; a red Stop (≥ 56 px, --bad/--on-bad: #A04545/#FFF in light, #F29B91 on the dark paper's text in dark) sits directly
  under the phase heading and again in a sticky bar, in every running phase (the bar is lifted above an on-screen
  keyboard that only shrinks the visual viewport, and a focused field is scrolled clear of it, so a Stop stays in
  view while she types; the app toast sits above the bar and never takes a tap); inputs are never auto-focused; the
  runner is the page's `<main>` with an `h1`; Stop leads to lie-down guidance and the urgent-care card; a faint
  or near-faint answer is also logged as an episode; readings auto-save and can be corrected later (marked
  "edited"); a running test older than 30 min without activity is marked interrupted at launch, and another
  window never offers to save or discard a test that may still be running. Pregnancy rests on the left side and
  adds the pregnancy caveat to every result. The caveat (and the pregnancy blood-pressure lines) belong to the
  test, not to the current stage: a test done lying on the left side keeps them after a stage change, and a test
  done before Pregnancy never gains them; in files they still need "Cycle or pregnancy details".

**A13.5 Patterns constants (normative).** Outcome = rough day (rating 3–4) among rated days; unrated days and
unlogged exposures are unknown, never zero. Factor card: ≥ 14 rated days in the window, ≥ 5 days each side,
≥ 4 rough days total, |difference| ≥ 20 percentage points AND ratio ≥ 1.3; at most 3 cards, at most 1 from a
wearable; copy uses natural frequencies and the chance caveat. Median goal fallback needs ≥ 10 logged days.
Wearable factors need ≥ 14 paired days and appear on screen only. Good vs rough: ≥ 4 good and ≥ 4 rough days;
each row ≥ 3 values per side. 7-day comparison: ≥ 4 rated days in each week. Today pace: ≥ 7 earlier days.
Cycle groups use logged starts only (period = start..start+4; week before = 7 days before a logged next start;
other) and need ≥ 2 starts in 120 days, ≥ 2 groups with ≥ 4 rated days and ≥ 2 completed cycles; not shown in
pregnancy or menopause. Medicine since starting: 14 days each side, ≥ 5 rated days each side. Card advice:
"test on purpose" only for factors she can safely vary (sleep, heat, her trigger tags, supports); medicines and
IV fluids go to the clinician without self-changes; fluids and salt change only with a clinician's OK; exercise
follows her plan; cycle tags, hot flashes and wearable cards are "worth mentioning" only.

**A13.6 Exports.** The POTS report (PDF, in-house writer, base-14 Helvetica) and spreadsheet (one tidy CSV,
UTF-8 BOM, formula-injection guard) are built on the device and leave only through a web download or the phone
share sheet; the phone's cache copy is deleted after sharing and swept at launch and wipe. File names, share
titles and email subjects are neutral (`cyra-report-{date}.pdf`, `cyra-data-{date}.csv`). Exports never contain
wearable readings or anything derived from them, never contain registration answers, and never contain typed
notes or the user's name unless she ticks them; life stage, cycle days (her "On my period" and "Week before my
period" tags included) and check-in overlap are included only while "Cycle or pregnancy details" is ticked
(default on). Numbers she types are hers whatever she measured them with; the screen says readings Cyra gets
from a connected watch, ring or health app aren't included. The PDF writer is in the main bundle, so making a
report fetches nothing. The report's "sustained" wording names the minutes that reached the threshold and never
claims fewer did. Every export screen states that the file isn't locked.

**A13.8 UI PT1 (the Home card and the page).** *Home card:* the "POTS today" section label carries an aria-hidden
heart glyph in a sibling span (`textContent` unchanged, accent dot off via `.potslab`); the card is
`.plaincard.pots-home`. With a fluid or sodium goal set it shows compact `GoalMeter`s (`components/pots/FluidSalt.jsx`,
exported, `compact` + `tone`): a 16px drop or salt glyph, the label, the day's total as a Fraunces `.num` ("—" until
something is logged: missing is never zero) and "of 2.5 L" / "Goal reached", over the same `role=progressbar` bar;
fluids fill in the palette primary, sodium in the accent (`.goalfill.salt`), both chrome, never RAMPS. The totals
sentence ("Fluids 0.5 L of your 2.5 L · Sodium 480 mg", or "Nothing logged yet. That's fine.") stays the card's first
`p.plain`, visually hidden (`.sr-only`) while the meters show. *One-tap usual drink:* when a drink button exists
(`usualFluid`: the default fluid button, else the first drink button) a `.medrow` shows its amount, "Your usual drink"
and a `.takebtn` "+ Add" (`aria-label="Add 250 ml"`); App logs it through the same `addIntake` as the page, remembers
it for the card's Undo row (`potsHomeLast.kind = "intake"`) and shows the same toast sentence, built once in
`lib/pots.js` `intakeToast(item, totals, goals, units, whenWord)` ("Added 250 ml. 0.5 L today" / "Sodium added.
480 mg today" / "{label} logged"; the goals never change the sentence). A drink button that still has to ask its
sodium (`asksSodium`: electrolyte or broth without a figure) opens the page instead. Nothing logged from Home is marked
quick. After Undo, focus returns to the button that logged it ("+ Add" or "Took it"). "Open POTS tools" keeps its
text and `.ghostbtn` and is an underlined link (`.potsopen`); the two `.route` tiles are 56px. *Page head:* one
`.potshead` row holds the "← Back" bar and the 22px `h1.disp`. The section switcher is the joined
`.mcrow.seg.scroll.secnav` (role=group "POTS sections", `.mc.on` + `aria-pressed`, same texts), scrolling
horizontally rather than abbreviating. After setup and while the record is being saved, the top hint shows one sentence,
"Kept on this device and ready for your clinician."; the rest of the hint is in an `.sr-only` span of the same
paragraph (so assistive tech and the S2/S5 harnesses still get the full HINT text), and its two claims appear
verbatim under the Today section as `.hint.foot2` "Never part of weekly counts. Cyra can't diagnose POTS; only a
clinician can." (`TODAY_FOOT_2`), after the unchanged `TODAY_FOOT`. HINT_UNSAVED stays on top, whole, whenever
`potsSaved()` is false; the first-run cards keep the whole HINT and show `Step n of 3` beside three `.prog` dots in
`.stepline`. "When to get help now" is a full-width `.linkbtn.helpnow` row with an 8px --bad dot and a chevron
(`aria-expanded` unchanged). *Today:* a `.daterow` holds "Today · {date}" and the joined `.viewsw` toggle
(`#pots-full-btn` "Full view" | `#pots-simple-btn` "Simple view", `aria-pressed`, group "View"); "Fix up an earlier
day" stays under it in Full view. With three or more days logged (`daysLogged`, a day that only carries the
Simple-view mark doesn't count) the footer adds "N days logged · Make a report for your clinician", which opens the
Report section. *Simple view:* a tile with no drink or salt button yet is `aria-disabled="true"` (dashed, focusable,
never `disabled`), reads "Tap to add your first drink" / "Tap to add your first salt", and opens the amount sheet,
whose "save as a button" makes the next tap a one-tap log. Threshold and over-goal states keep their number cues.

**A13.7 Reminders.** The add-on adds no notification. A8 still applies: one check-in reminder at most. A
care-plan checklist is shown in the app only, with no "late", "missed" or streak language. Any future
medicine/fluid reminder is owner decision D1 and needs A8 reworded first.

## A14. Local-first core

Later slices extend this section as A14.2, A14.3, ….

### A14.1 Installable, opens offline (L1)

**What it is.** The web build is an installable web app that opens without a connection once this device holds a
record. No new dependency, no new network destination: the only extra requests are same-origin GETs for Cyra's own
static files (made by the service worker) and the browser's update checks for `/sw.js`. The phone app never
registers the worker and never shows install UI (`isNative()`).

**Manifest and icons.** `public/manifest.webmanifest`: `id` and `start_url` and `scope` `./`, `name` "Cyra Health",
`short_name` "Cyra", `description` "Track periods, pregnancy and the transition in 30 seconds a day. Your health log
lives on your device.", `display` standalone, `background_color` and `theme_color` `#EDE4DC` (ORGS.cyra.theme.paper,
the splash paper), `lang` en, `dir` ltr, `categories` health and lifestyle, and four icons: `icons/icon-192.png` and
`icons/icon-512.png` (purpose any) and `icons/icon-maskable-192.png` and `icons/icon-maskable-512.png` (purpose
maskable). No `related_applications`, no screenshots, no tracking parameters. `public/icons/apple-touch-icon.png` is
180x180. All five are opaque RGB PNGs on full-bleed paper, drawn by `scripts/make-icons.py` (Python 3 + Pillow, run by
hand from the repo root, never by the build) from the splash's three circles (primary .92, accent .85, primary .55),
motif width 0.78 of the canvas for "any", 0.62 for maskable (the whole motif inside the 80% safe circle) and 0.74 for
the Apple icon. `index.html` links the manifest, the 192 icon and the Apple icon, sets `mobile-web-app-capable`,
`apple-mobile-web-app-capable`, `apple-mobile-web-app-title` "Cyra" and `apple-mobile-web-app-status-bar-style`
default, and uses `#EDE4DC` for `theme-color` and the pre-render background, so launch screen, first paint and splash
are one colour. L2 makes both per scheme (`#EDE4DC` light, `#1B150E` dark, through two `media` theme-color metas and
`--doc-bg`, §8.4); at runtime `applyDocumentScheme` (lib/appearance.js) keeps every theme-color meta on the paper on
screen, replacing L1's `setThemeColor`. The manifest keeps its single light `theme_color` / `background_color`, so an
installed app's launch splash is light even in OS dark mode, and `apple-mobile-web-app-status-bar-style` stays default,
so the status bar of the app installed on iOS may not match a dark page either (later work, like the native status bar).

**The worker (`public/sw.js`).** A classic script at `/sw.js`, scope `/`. Its push and notificationclick handlers are
byte-for-byte the ones before L1. One marked line, `const BUILD = {…}; // @cyra-build`, holds the dev placeholder
(`version` "dev", `files` []) in the repo; in `vite dev` the worker stays reminders-only. A message `CYRA_BUILD` is
answered on the transferred port with `{ version, entry }`; `CYRA_SKIP_WAITING` calls `skipWaiting()`. With a filled
BUILD:
- install precaches exactly `BUILD.files` into `cyra-shell-<version>` with `cache: "reload"` (atomic: one failed file
  fails the install, and an older worker keeps serving);
- activate deletes every other `cyra-shell-*` cache and leaves other cache names alone; no `clients.claim()`, so a page
  that loaded without the worker stays uncontrolled until it is reloaded;
- fetch never calls `respondWith` for a non-GET request, a cross-origin request (Cyra's server, Oura, Terra, any other
  site) or anything under `/api/`. App navigations (`/index.html` or a path with no file extension) are network-first
  with a 4 s timer (`NAV_TIMEOUT_MS`); the network answer is never cached, and on an error or timeout the precached
  `/index.html` answers (`Response.error()` if even that is missing). Other navigations (such as `/fonts/OFL-Karla.txt`)
  pass through. A path in `BUILD.files` is cache-first, with the network as the fallback (not stored). Everything else
  passes through. There is no runtime caching: the worker never calls `cache.put`, never opens IndexedDB and never
  imports scripts.

**The BUILD line.** `cyraServiceWorker()` in `vite.config.js` (build only) runs in `writeBundle`, after Vite copied
`public/` into the out dir. `precacheList` (`src/lib/swBuild.js`, pure, imported only by the config and the tests)
takes every bundle file except `*.map` and `sw.js`, plus `manifest.webmanifest` and `icons/*.png` from `public/`
(never `sw.js` or `fonts/*.txt`), sorted, de-duplicated and prefixed with `base`. The version is the first 16 hex
characters of a SHA-256 over the sorted bundle entries and public files (name and bytes), so identical rebuilds give an
identical version; `entry` is `base` + the entry chunk's file name. `injectBuild` rewrites the marker line with a
replacer function (a `$` in a file name is written literally) and throws "[cyra] public/sw.js has no BUILD line to
fill (… // @cyra-build)" when the line is missing. A build without the manifest or icons warns.

**Registration rule.** `registerWorker()` (`src/lib/pwa.js`) registers `/sw.js` only on the web (`!isNative()`), only in
a production build (`import.meta.env.PROD`), only in a secure context, and App.jsx calls it only while this device
holds a record (`hydrated && phase === "app"`, never on the splash or during registration). It is memoized and tried
again after a failure. `lib/notifications.js` registers the same URL for reminders, so there is one registration; it
now waits up to 20 s for an active worker (`whenActive`) before subscribing and returns `{ active: false, error: true,
worker: true }` when none becomes active (Settings: "Couldn't set up reminders just now — tap Turn on to try again").

**Updates.** When a new worker has installed while this page is controlled by an older one, the page asks it
`CYRA_BUILD` and compares its `entry` with the script this page runs (`import.meta.url` of the entry chunk):
- the same entry (this tab already loaded the new files over the network) → adopted silently with
  `CYRA_SKIP_WAITING`;
- otherwise `p.updrow` becomes the last child of `header.mast` (app and intake screens only, never the splash,
  registration, record-unavailable or a running POTS test): "A new version of Cyra is ready" · a 44px `.linkbtn`
  "Reload" (`aria-describedby="upd-text"`). It is not a live region and not a toast. Reload waits for pending saves
  (`settleSaves`: the 400 ms autosave is flushed and awaited), sends `CYRA_SKIP_WAITING`, waits for `controllerchange`
  or the worker's `activated` (4 s at most) and reloads.
The browser checks `/sw.js` on navigation; `checkForUpdate()` also asks at most once an hour (`UPDATE_CHECK_GAP_MS`)
when Cyra comes back on screen (the visibilitychange "visible" branch).

**Install.** `installModeFor` precedence: the phone app → "none"; already standalone (`display-mode: standalone` or
`fullscreen`, or `navigator.standalone`) → "standalone"; an iPhone, iPod or iPad (including iPadOS in desktop mode,
MacIntel with touch) → "ios"; Chromium's captured `beforeinstallprompt` (default prevented, which also keeps Chrome's
mini-infobar away) → "prompt"; else "none". Install UI shows only in "prompt" and "ios", and only while
`storageDriver === "indexeddb"`:
- Settings → Install (`InstallSettings`, `components/Pwa.jsx`): "Install Cyra on this device" with, in prompt mode,
  "Opens in its own window from your home screen or app list, even without a connection, with the same record you have
  here." and a 44px `.takebtn` "Install"; in iOS mode "Tap Share, then Add to Home Screen." and the `.rfoot` "Cyra on
  your Home Screen starts with its own record, separate from this one in your browser. To bring your check-ins along,
  make an encrypted backup below, then restore it there from Cyra's first screen." (no button).
- Home tip (`InstallTip`, `.installtip`, `role=group` labelled by its sentence), after the check-in button, its today
  line and the POTS card and before "Today's insight", from `INSTALL_HINT_AFTER = 1` logged day (L11: after the first saved
  check-in; never on the splash, a register step or the stage-change intake), never again once
  `installHint` is set: prompt mode "Install Cyra to open it like an app, even without a connection." with "Install";
  iOS mode "Add Cyra to your Home Screen to open it like an app." with "Show me" (opens Settings with focus on
  `#set-install`, scrolled into view); both with a 44px icon button "Hide this tip" (`.tipclose`). Hiding it toasts
  "Tip hidden. Install stays in Settings." and returns focus to the check-in button. There is deliberately no button
  named "Not now". The tip adds at most 64px to Home at 390px and is not a section label or card.
- Accepting the browser's dialog toasts "Cyra is installed. Open it from your home screen or app list." A dialog
  dismissed from the tip hides the tip for good; one dismissed from Settings changes nothing stored.

**The device-only key `installHint`.** `null | "dismissed" | "installed"`, in PERSISTED and DEVICE_ONLY: not adopted by
other tabs, deleted from the snapshot before a backup is encrypted, kept as this device's own value on restore, and
merged one way (`mergeInstallHint`: installed > dismissed > null) by every save, so a stale tab can't bring the tip
back. "installed" is set by `appinstalled`, an accepted dialog, or opening Cyra standalone. It is erased with the record
by Delete everything and is in no network payload.

**Delete everything.** `cleanUpHere` unregisters every worker and then deletes every `cyra-shell-*` cache before the
record is cleared; the splash never registers again, so a wiped browser has no worker and no offline copy. Known
limitation: Delete everything while offline (a web build with no server steps) removes the offline copy before the
reload, so the reload shows the browser's offline page until the device is online again.

**Hosting.** `render.yaml` sends `Cache-Control: no-cache` for `/`, `/index.html`, `/sw.js` and
`/manifest.webmanifest`; hashed `/assets/*` keep the host default.

### A14.3 Data model module and plan hooks (L3)

(A14.2 is not used: L2's light and dark mode is specified in §8.1–8.4.)

**A14.3.1 The record.** `src/lib/record.js` is the single description of what Cyra saves:
- The record is one object holding exactly the PERSISTED keys (plus `v`, `savedAt` and `phase`);
  RECORD_VERSION = 1.
- DEVICE_ONLY keys are never applied by a restore and never taken over from another tab.
- NOT_IN_BACKUP keys (`lastBackupAt`, `installHint` and the DEVICE_PREFS key `appearance`) are deleted
  before encryption. `backupCopy()` also drops `regAnswers.zip` and `.age` and keeps only
  `reminders.enabled`.
- Every load (`lib/storage.js`) and every decrypted backup (`importBackup`) passes through
  `migrate()`, which today returns the record untouched.
- A change to an existing key's meaning or shape bumps RECORD_VERSION and adds one pure, unit-tested
  step to MIGRATIONS; a new optional key does not.
- `validateRecord()` is advisory: nothing calls it at runtime.
- Accessors: `entryFor`, `upsertDay`, `cyclesFrom`, `phaseOf` / `PHASES`, `daysLogged`.

**A14.3.2 Plan.** `src/lib/plan.js` holds FREE_PLAN = `{ tier: "free", pdfExportsPerMonth: null,
aiPatternReports: false, extraCustomisation: false, cloudBackup: false }`, and PLAN = FREE_PLAN.
- `can(feature)` is the only gate for a paid feature.
- `exportsLeft(tally)` returns null (unlimited) on this plan, and `noteExport` records nothing.
- No screen shows a plan, a limit, a price or an upgrade prompt.
- Rules are in docs/MONETIZATION.md.

### A14.4 Server surface, feature flags and the encrypted cloud backup scaffold (L4)

Normative text in §9.1 (flags, modules, the backup protocol) and the flag notes in A1, A2, A8, A9, A11 and A12.
- `src/lib/features.js` (pure, no imports): `FEATURE_NAMES`, `DEFAULT_FEATURES`, `FEATURE_MODULE`, `parseFeatures(raw)`,
  `unknownFeatures(raw)`, `FEATURES`, `feature(name)`, `remindersInBuild(native, f)`.
- `src/lib/disclosures.js` (imports only `remindersInBuild`): every flag-dependent privacy sentence as a builder of the
  flags (`serverSees`, `consentDeleteFact`, `consentDetails`, `leaveDevice`, `filesSentence`, `restoreFoot`,
  `restoreChanges`, `wipeConfirm`, `wipeMore`, `deleteAlso`, `intakeHint`, `startOverText`, the POTS footers) plus
  `LEGACY_WEAR_LINE`. With every flag on each returns the pre-L4 text byte for byte (disclosures.test.mjs).
- `src/lib/backup.js` (still no imports): `backupFileName`, `isEnvelope`, `fileTransport(io)` (today's download /
  share sheet, moved from App.jsx unchanged), `CLOUD_MAX_BYTES`, `cloudTransport({ request, enabled, gate })`
  (fail-closed). `src/lib/cloudBackup.js` wires the cloud transport behind `plan.can("cloudBackup")` and the flag;
  nothing imports it, so no build contains it.
- The default build makes no request at launch; the uiux snap/axe demo builds use the defaults, the harness dists and
  the live suites use `VITE_FEATURES=all`, and `lf/l4/flags-e2e.mjs` checks default / none / all.

### A14.5 Irregular cycles: outliers, honest ranges, long cycles (L5)

Decision D5: outlier cycles change predictions only. Normative text in §3.5 (cycleFlags), §6.2 (the algorithm), §5.1
(Today's phase card, the Calendar rules: predicted and fertile cells, the flow overlay, the confidence and no-prediction
cards, "Your cycles"; the Patterns peri card; the Report's labelled lengths), A1 (Coming up, the peri insight) and §12.
- `src/lib/engine.js` (pure, unit-tested in `src/lib/predict.test.mjs`): `daysBetween`, `addDays`, `median`, `mad`,
  `cycleSpans`, `RANGE`, `cleanCycleFlags`, `flagKey`, `isExcluded`, `toggleExclude`, `unusualCycles`, `predict(ins,
  prior, { flags, stage, isMeno, today })`, `whyNoPrediction` (one internal `plan()` for both), `predictionWaits`
  (kept for compatibility), `fmtRange`, `periodHead`, `basisLine`, `lensLabel`, `cycleSummary`. `insights()` also
  returns `cycles` and never reads cycleFlags.
- `src/components/CycleList.jsx` renders "Your cycles"; the restore line lives in `lib/disclosures.js` `restoreChanges`.
- Nothing new leaves the device (docs/PRIVACY-AUDIT.md, Local-first L5).

### A14.6 Faster, personal daily log: favourites, energy, a day note (L6)

Decisions D7 (day note) and D8 (favourites, Low energy). Normative text in §3.1 (`note`), §3.2 (`eng`, `ALL_SYM`),
§3.6 (symPrefs and the tracked list), §5.1 ("Today: her symptom list and a day note", the Calendar day card), §5.2
(Pregnancy Today and its Calendar card), §6.3 (`SCORE_SCALE`), §8.2 (Low energy's family), §8.4 (icons, containment)
and A8 (tap budget).
- `src/lib/daylog.js` (pure, imports only constants.js, unit-tested in `src/lib/daylog.test.mjs`): `STAGE_LIB`,
  `borrowable`, `cleanSymPrefs`, `prefsFor`, `trackedIds`, `chipLayout`, `moveSym`, `hideSym`, `showSym`, `addSym`,
  `loggedEver`, `canRemove`, `removeSym`, `resetSyms`, `NOTE_MAX`, `cleanNote`. record.js imports it for
  `RULES.symPrefs` and the note rule.
- `src/lib/constants.js`: `ENERGY_ID`, `eng` last in SYM and PSYM, `ALL_SYM`, `SCORE_SCALE`, `OTHER_LIST`,
  `SYM_FAMILY.eng`. `src/lib/engine.js`: `symBurden` / `dayScore` take a third `scale` argument.
- `src/components/SymptomSheet.jsx` ("Your symptoms") and `src/components/DayNote.jsx`; Today, Pregnancy Today, both
  Calendars, PatternCharts (`windowDays`, `ringModel`, `PatternsCard` take `scale`) and App.jsx (`symPrefs`, `dayNote`,
  the tracked `symIds`, `scoreDay`).
- Free core (brief must-have 1): no plan gate, never `plan.can()`. Nothing new leaves the device: the note and her list
  are in the record and in the encrypted backup she saves, never in weekly counts, Ask, the doctor email or the POTS
  report (docs/PRIVACY-AUDIT.md, L6).

### A14.7 Trying to conceive: fertility signs (L7)

Decision D6. Code: `src/lib/fertility.js` (pure; imports only engine.js and constants.js, unit-tested in
`fertility.test.mjs`), `src/components/FertilitySigns.jsx` (Today) and `src/components/FertilitySummary.jsx` (Patterns,
Report), with the privacy line built in `src/lib/disclosures.js` `fertPrivacyLine(f)`.
- **Who sees it.** `fertShown(stage, stageName, on)`: stage `periods` only; her Settings choice `on`, or with none yet
  (null) the stage default — on for Trying to Conceive, off for My Cycle. Never in pregnancy, perimenopause or
  menopause, even when a restored record holds signs. The record key `fertSigns = { on, unit }` (§3.4 list, in backups)
  holds the choice and the temperature unit; `on` goes back to null when the intake changes the stage label and at
  registration (re-running the intake into the same label keeps it). Restore is literal: a backup without fertSigns
  resets `on` to null and keeps this device's unit. "Trying to be" in the intake routes to Trying to Conceive (§4.3).
- **Today.** `div.plaincard.fertsigns[role=group]` labelled "Fertility signs" sits directly before Body signals in the
  quick, full and edit forms: "Cervical mucus" (`.seg`: Dry, Sticky, Creamy, Watery, Egg-white), "Ovulation test"
  (Not tested — pressed while nothing is set —, Negative, Positive) and "Basal body temperature" (`#fert-bbt`, text,
  decimal keyboard, with a °C / °F `.seg` labelled "Temperature unit"). All optional; a second tap on a choice clears
  it. The unit starts from the locale (°F for en-US and the other Fahrenheit locales) and every tap on it is saved.
  `parseBbt` accepts 2–3 digits with up to 2 decimals (comma or point), °C 34–40, °F 93.2–104; a reading in the other
  unit's range says "That looks like a °F reading. Switch the unit?" (or °C), anything else "Type a reading like
  36.45." / "That looks unusual. Check the number?". Switching the unit converts a valid reading. Saving with an
  invalid reading is stopped: toast "Check the temperature: it doesn't look like a reading. Fix it or clear it, then
  save." and focus on the field. The entry stores `cm`, `opk` and `bbt` (°C, 3 decimals, so every °F reading
  round-trips) only when set (§3.1). The footer is `fertPrivacyLine(FEATURES)` + "A guide to timing, not a confirmation
  of ovulation — and not contraception.". While the group is shown, Body signals' Discharge row offers only "Unusual"
  (plus a value a day already has) under "Mucus changes through your cycle go under Fertility signs above. Use this if
  something seems unusual."
- **Calendar.** While shown, a day with egg-white mucus or a positive test gets a 10px drop / test-strip mark
  (`span.c-fmarks[aria-hidden]`, in the cell's own ink), the legend adds "egg-white" and "positive test", the cell name
  adds ", egg-white mucus" / ", positive ovulation test", and the day card adds "Fertility signs: {parts}" before any
  Note line. Predictions never read the signs.
- **Home (Trying to conceive).** The Coming up row and the today line in A1. No new section label; Home grows by at most
  about 60px.
- **Patterns (Trying to conceive).** "Fertility signs this cycle" (from her last period start, 45 days ago or less) or
  "Fertility signs · last 35 days": egg-white and watery mucus days, positive tests (or "Ovulation tests: {k} negative,
  no positive yet"), temperature days, the temperature observation, and "Mucus and test results point to your most
  fertile days; on their own they can't show that ovulation happened. Not contraception."
- **Report (Trying to conceive).** One "Fertility signs" finding in What stands out over the same 30 days, and one email
  line "• Fertility signs in these 30 days: …" when anything was logged.
- **The 3-over-6 rule (an observation).** The first reading with six readings in the 10 days before it, followed by
  readings on three consecutive days that are all above the highest of those six, the third at least 0.2 °C above it
  (whole thousandths). Worded: "From {date}, your temperature stayed above the six readings before it (highest {temp})
  for three days in a row. A rise like this is often seen after ovulation: an observation from your own readings, not
  a confirmation." With 9+ readings and no rise: "No sustained temperature rise in these readings yet."
- **Copy rules.** `FERT_BANNED` (no "ovulation confirmed", "you ovulated", "safe days", "birth control", guarantees…)
  and `contraOk` (contraception only as "not contraception") are unit-tested over every output and checked in the e2e
  over every fertility element on screen.
- **Never sent.** The signs never enter `dayScore`, insights, predictions, weekly counts (`contribute()` gets
  `{ sym, sleepQ, flow }`), the AI (`{ question }`) or the POTS report and spreadsheet. They leave the device only inside
  the encrypted backup she saves, and as the one email line she sends herself (docs/PRIVACY-AUDIT.md, L7).
- Free core: never gated in plan.js.

### A14.8 Plain-language summaries and simple links (L8)

Brief item 4. Code: `src/lib/insights.js` (pure; imports only engine.js and constants.js; unit-tested in
`insights.test.mjs`, which also greps its source for any network or storage call), `nightOf` / `isRoughNight` /
`SLEEP_LINK` / `sleepLink` in `src/lib/engine.js`, `src/components/SummaryCard.jsx`.
- **What it computes.** `periodSummary` (week and month), `summarySentences`, `summaryMeta`, `recapFrom` (Home's
  recap), `cycleDayCluster`, `patternFindings` (sleep candidates: the 3 most-logged symptoms in 60 days, never Sleep
  disruption, plus Low energy when logged; cycle candidates: the 4 most-logged since the oldest of the last 4 starts)
  and `homePick`. Rules and copy: §6.1, §5.1 "Summary first" / "Links in your log", A1, A6.
- **Same-day pairing.** A day's "Last night" answer is the night before it, so a day pairs with its own answer (the
  pairing the POTS patterns already used). This replaced the old previous-day hot-flash ratio, which showed on tiny
  samples; the demo seed pairs each day with its own night.
- **Two rough-night readings.** On the device (summaries, chart row, recap, links, Care matching) Sleep disruption ≥ 2
  also counts as rough. The weekly counts' `rough_night` flag still uses only sleepQ "poor" (`eventsForDay` is
  unchanged), so what is shared does not change.
- **Known limit.** Peri quick-mode "Slept well" is saved as slp 0 with sleepQ "fair" (unknown), so a quick-card-only
  user has no good nights and sees "not enough to compare yet"; changing that would change what weekly counts send,
  so it waits for a reviewed change.
- **Nothing saved or sent.** No new record key; the summary period is React state. Day notes and fertility signs are
  never read. The AI pattern-report hook stays `plan.aiPatternReports = false` with no UI (docs/PRIVACY-AUDIT.md, L8).

### A14.9 Structured PDF export for appointments (L9)

Brief item 5, decision D1. Code: `src/lib/visitReport.js` (pure; no React, storage, network or Date.now; imports
engine.js, potsReport.js's date helpers, constants.js RAMPS, record.js cyclesFrom, daylog.js cleanNote, insights.js
periodSummary and fertility.js FERT_COPY; never pdf.js — the caller passes PdfDoc), `src/lib/visitReport.test.mjs`,
the `.pdfcard` in `src/screens/ReportScreen.jsx`, `src/lib/files.js` (unchanged path), `src/lib/plan.js` (L3's
`can("pdfExport")`, `exportsLeft`, `noteExport`). Rules and copy: §5.1 "Local-first L9 — the appointment PDF".
- **One model, two outputs.** `visitModel({ days, ins, ids, stage, stageName, name, today, questions, includeNotes,
  cycleFlags, fertilityLines, paper, scale })` is built by App.jsx `buildVisit` from the same insights, tracked ids
  and score scale as the screen; `visitPdf(model, PdfDoc)` draws it; the Report renders it as the accessible version.
  Registration answers, wearable rows, the journal, the Connect log, appointments and POTS data are never inputs.
- **New persisted key `exportLog`** (`{ month: "YYYY-MM", n } | null`): DEVICE_ONLY and NOT_IN_BACKUP, written only
  while `PLAN.pdfExportsPerMonth` is non-null (it is null, so the shipping app stores nothing about the PDFs she
  makes); cleared by Delete everything; kept by a restore.
- **Copy widened.** The consent details and Settings → Your data (now Privacy & your data, L10) name the appointment PDF among files she makes
  (lib/disclosures.js); the day-note hint says the note goes into an appointment PDF only with the tick; "Print or
  save PDF" → "Print this page"; "Add to email" → "Add to email and PDF". The phone sweep also removes
  `cyra-summary-*.pdf`.

### A14.11 Onboarding: short, phase-first, privacy-forward (L11)

Brief: "onboarding short, phase-first, strong privacy messaging". Code: `src/lib/onboarding.js` (pure: `REG_STAGE`,
`STAGE_LABELS`, `STAGE_CARDS`, the option lists, `ANSWER_BLANK`, `STEP_COPY`, `regSteps`, `missingFor`, `socialReturnStep`,
`toggleMulti`, `pruneForStage`, `sanitizeZip`, `pregWeekFrom`, `dueDateBounds`), `src/components/AnswerChips.jsx`
(`ChipRow`, `MultiRow`), `src/components/AboutYou.jsx`, `src/screens/RegisterScreen.jsx` (rewritten around `regSteps`),
`src/screens/SplashScreen.jsx`, `src/components/SettingsSheet.jsx` (`regAnswers`, `onAnswer`), App.jsx (`setAnswer`, the
due-date week, `finishSocial` return step, `pruneForStage` in finishReg), `src/lib/pwa.js` (`INSTALL_HINT_AFTER = 1`),
`src/lib/record.js` (`regAnswers.dueDate` rule, `RegAnswers` typedef), `Icon` `user`, styles `.splashpromise*`,
`.ghostbtn.splashrestore`, `.cadwrap`, `.aboutyou`. Rules and copy: §4.1, §4.2, §3.3, A8, A11, A12 "About you". Tests:
`src/lib/onboarding.test.mjs`; the measurement `lf/l11/measure-after.mjs` (before: `l11design/measure.mjs`). No new
persisted key (`dueDate` is a field inside `regAnswers`, in backups), no new dependency, network call or request.
Harness: every registration walk goes through the shared `lf/onboard.mjs`; `pots/e2e/nlib.mjs`'s
`finishRegistrationFromStep2` throws so a missed call site fails loudly. Privacy: docs/PRIVACY-AUDIT.md "L11".

### A14.10 Privacy dashboard and app lock (L10)

Brief item 6, decision D4. Code: `src/lib/lock.js` (pure plus WebCrypto / WebAuthn; imports only record.js), `src/lib/privacyFlows.js`
(pure), `src/lib/storage.js` (the device-only lock slot), `src/components/PrivacyFlows.jsx`, `src/components/LockSettings.jsx`,
`src/components/DataControls.jsx` (the group, `WipeConfirm` extracted, `noSave` exported, `onHandoff`), `src/components/Details.jsx`
(`describedBy`; the shared `CountsFacts` / `AiFacts` / `WearableFacts`), `src/screens/LockScreen.jsx`, App.jsx (hydrate, `verifyPin`,
hide / show, `wipe({ then, hash })`, the `#restored` / `#restore` hashes). Rules and copy: A12 "Privacy & your data (L10)", "App lock
(L10)" and "Forgot PIN (L10)"; §8.4 (`.key`, the shield and backspace glyphs). Tests: `src/lib/lock.test.mjs`,
`src/lib/privacyFlows.test.mjs`; the scratch acceptance `lf/l10/lock-check.mjs` (Chromium's CDP virtual authenticator, simulated
visibility, `page.clock`). No new dependency, network call or record key; the lock slot is documented in docs/ARCHITECTURE.md §3 and
docs/PRIVACY-AUDIT.md (L10). No harness file was edited and no suite sets a lock. Privacy controls stay free core (docs/MONETIZATION.md).
