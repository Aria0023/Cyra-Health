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
- **Persistence:** device-local storage. Never send health data to a server.
- **Fonts:** Fraunces (headings, serif) + Karla (body, sans) via Google Fonts.
- **Mobile-first:** max-width 430px, centered.
- **AI calls:** must have a deterministic fallback so the app never breaks offline.

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
  bodyOdor: "same"|"stronger"|"changed" | null
}
```

### 3.2 Symptom libraries (exact — id: label)
```js
// Peri / Meno stage
SYM = { hf:"Hot flashes", ns:"Night sweats", fog:"Brain fog", mood:"Mood swings",
        slp:"Sleep disruption", ach:"Joint aches", dry:"Vaginal dryness",
        pal:"Heart flutters", hda:"Headaches", lib:"Libido change",
        anx:"Anxiety", itc:"Skin/itching" }

// My Cycle stage
PSYM = { crm:"Cramps", hda:"Headaches", blo:"Bloating", mood:"Mood swings",
         ten:"Breast tenderness", acn:"Skin breakouts", bak:"Back pain",
         nau:"Nausea", cra:"Cravings", lib:"Libido change" }

// Pregnancy stage
GSYM = { nau:"Nausea", hb:"Heartburn", swl:"Swelling", bak:"Back pain",
         crp:"Cramping", dzy:"Dizziness", brx:"Braxton-Hicks", con:"Constipation" }

SCALES = [ {id:"fatigue", low:"Energized", high:"Wiped out"},
           {id:"pain",    low:"None",      high:"Severe"},
           {id:"moodq",   low:"Low",       high:"Great"},
           {id:"stress",  low:"Calm",      high:"Maxed"} ]
```

### 3.3 Registration record
```js
{ name, email, pass, anon:bool, age, zip, stage,
  cycleLen, cycleReg, lastPeriod, preg, births, contra,
  conditions:[], familyHx:[], meds,
  goals:[], sleep, activity,
  emailOptin, notifOptin, research, terms }
```
**Never collect:** SSN, government ID, insurance/policy numbers, payment cards,
full street address (ZIP only), or medical records. This boundary is deliberate —
collecting identifiers alongside health data changes the legal posture of the product.

---

## 4. APPLICATION FLOW (state machine)

```
phase: "splash" -> "register" -> "app"
```

### 4.1 Splash
Wordmark, tagline "One companion for every phase", value proposition, "Get started" button.

### 4.2 Registration — 8 steps, with validation
| # | Step | Fields | Required |
|---|------|--------|----------|
| 1 | Account | name (opt), email, password, **Anonymous Mode toggle** | email OR anon |
| 2 | Basics | age band, ZIP | both |
| 3 | Stage | 5 cards (see 4.3) | yes |
| 4 | Cycle history | typical length, regularity, last period (opt) | length + regularity |
| 5 | Reproductive | ever pregnant, births, contraception, has provider | ever pregnant |
| 6 | Health | conditions (multi), family history (multi), medications | medications |
| 7 | Goals | goals (multi), sleep, activity | all three |
| 8 | Consent | email opt-in, push opt-in, research opt-in, **terms** | terms |

**Validation behavior:** red state appears **only after** the user taps Continue with
fields missing — never on arrival. Show label in red with "· needed" suffix, red-tint
the inputs, and a summary line below. Optional fields never turn red.

### 4.3 Stage routing (answer → experience)
```
"My Cycle"            -> periods
"Trying to conceive"  -> periods
"Pregnant"            -> preg
"Perimenopause"       -> peri
"Menopause & beyond"  -> peri
```
After routing, the user sees ONLY that stage's tabs, symptoms, palette, and partners.
A header chip shows the current stage with a "change" affordance that re-runs intake.

---

## 5. SCREENS BY STAGE

### 5.1 Cycle & Peri stages — tabs: Today · Calendar · Patterns · Report · Care · Ask

**Today:** cycle-status card (day N, phase, days to next period or days late) ·
live day-score meter (see 6.3) · symptom chips (tap cycles 0→1→2→3→0, showing ●○○ dots) ·
0–10 sliders for the four scales · sleep quality (3 buttons) · collapsible **Body Signals**
panel (flow, discharge, vaginal odor, body odor) · save button · phase-appropriate daily read.

**Calendar:** month grid. Logged days filled with their day-score color. Period days
marked. Predicted period (dashed) and estimated fertile window (accent) for unlogged
future days. Tap any day → detail panel showing what was logged → "Edit this day" loads
that date into the check-in form and saves back to it. Confidence card: ±days derived
from cycle variability, explicitly stating it is not contraception.

**Patterns:** 60-day stripe field (each stripe = one day, colored by symptom burden,
dot marks period) · insight cards, each paired with an **advice card** carrying an
urgency chip (Self-care / Next visit / This week) · symptom-frequency bars.

**Report — "What to tell your doctor"** (this is the flagship screen):
1. *What stands out* — numbers translated to plain speech ("showed up **most days** —
   19 of your last 30 days").  Frequency wording: ≥80% "nearly every day", ≥60% "most days",
   ≥40% "about half the days", ≥20% "a few days a week", else "now and then".
2. *What this might mean* — interpretation in everyday language, threshold-driven,
   always closing with "observations, not a diagnosis".
3. *What to say out loud* — verbatim scripts she can read to her clinician, including
   "If we try something, how will we know in a few months whether it's working?"
4. *Send it ahead* — generate a short email (mailto + copy-to-clipboard).
5. Collapsed "The numbers behind this" — the data table, demoted below the guidance.

**Care:** partner list filtered by stage, ordered by match to her logged symptoms.
Each card: brand, "Partner" pill, offer, "Matched: <symptom> (n/30)", **evidence label**
(Strong evidence / Mixed evidence / Comfort, not a treatment / Clinical care), price,
CTA. Commission disclosure appears **above** the list, not buried.

**Ask:** free-text question → plain-language evidence answer (~8th-grade reading level)
+ named evidence base (e.g. ACOG, The Menopause Society, Cochrane) + one question to
bring to her doctor + urgent-flag routing if the question describes red-flag symptoms.

### 5.2 Pregnancy stage — tabs: Today · Calendar · Milestones · Ask
**Today:** week number + trimester + progress bar to 40 weeks · weekly read · pregnancy
symptoms · **kick counter** · red-flag advice (e.g. severe swelling → contact provider today).
**Calendar:** week-start markers (w22, w23…), logged-day dots, due-date countdown. No
fertile-window or period prediction — meaningless here.
**Milestones:** the full evidence-based prenatal schedule (§7), each item status-tagged
against her current week: done ✓ / in window / coming up / later.

---

## 6. ALGORITHMS (normative)

### 6.1 Insights
```
counts[symptom] = { days: entries in last 30 with severity>0,
                    strong: entries with severity>=2 }
sleepCorrelation = P(symptom>=2 | previous day sleepQ="poor")
                 / P(symptom>=2 | previous day sleepQ!="poor")
   -- only over CONSECUTIVE logged days; require >=4 samples each side.
triggerMultiplier = same ratio for tagged vs untagged days; require >=5 each side;
   surface only if multiplier >= 1.3
```

### 6.2 Cycle detection
```
period start = a period-flagged day with no period-flagged day in the prior 5 days
cycleLength  = days between consecutive starts; keep only 15..120
variability  = max(recent lengths) - min(recent lengths)   // use last 6
prediction   = lastStart + round(mean(lengths))
ovulation    ≈ nextStart - 14 ; fertile window = [ovu-3, ovu+1]
confidence   = ±max(2, round(variability/2)) days
```
**Clinical rule:** variability ≥ 7 days in the peri stage is the flagged marker of the
menopause transition and must trigger the corresponding advice.

### 6.3 Day score (drives all color)
```
burden = min(1, symptomBurden*0.5 + (fatigue/10)*0.2 + (pain/10)*0.2 + ((10-moodq)/10)*0.1)
   where symptomBurden = min(1, sum(severities) / (symptomCount * 1.6))
score  = 1 - burden        // 1 = great day, 0 = rough day
labels: >0.82 "A really good day" | >0.64 "A good day" | >0.46 "A mixed day"
        | >0.28 "A hard day" | else "A rough day"
```

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

---

## 8. VISUAL DESIGN

### 8.1 Stage palettes (UI chrome — calm, high-contrast)
```
peri:    primary #2C6A61  accent #6E7EB0  paper #E4EBE7  card #FFF  ink #17241F  line #B9CCC4
preg:    primary #2F736E  accent #D9737F  paper #EFE2E1  card #FFF  ink #241A1D  line #D4BEBC
periods: primary #33567D  accent #D26A54  paper #E3E9F0  card #FFF  ink #141E29  line #BCCAD8
```
Offer 2–3 alternate palettes per stage as a user setting.

### 8.2 Data ramps (saturated — deliberately independent of chrome)
```
peri:    good rgb(26,168,148)  mid rgb(246,189,74)  rough rgb(140,74,168)
preg:    good rgb(42,176,158)  mid rgb(249,176,104) rough rgb(222,84,112)
periods: good rgb(46,154,198)  mid rgb(250,186,82)  rough rgb(226,88,74)
```
**Rule:** calm palettes make poor data colors. Chrome uses the palette; charts,
calendar fills, and score meters use the ramp. Interpolate good↔mid↔rough by score.

### 8.3 Contrast requirements
Cards pure white on tinted paper; borders 1.5px in a visibly darker tone; subtle
shadow lift; near-black ink. Pale-on-pale fails — this was a real defect once.

---

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

**Attribution model (important):** app requests a referral link keyed to an *opaque
user hash*; user clicks through carrying the token; partner fires a signed webhook on
conversion. First conversion per partner+patient-hash = new-patient bounty; later visits
accrue per-visit fees only. Partners receive **tokens and cohort aggregates, never
identities**. This is what lets affiliate revenue coexist with on-device privacy.

---

## 10. AI INTEGRATION

Three call sites, each with a deterministic fallback:
1. **Welcome generation** — one warm sentence from registration answers.
2. **Weekly insight** — returns `{insight, action, urgency, flag_for_doctor}`.
3. **Ask** — returns `{answer, source_note, ask_your_doctor, urgent}`.

Send only aggregated data keyed to an opaque ID — never names, never raw entry logs.
System prompts must forbid diagnosis and dosing, and require an urgent flag for
red-flag symptoms. **In production, proxy these through the backend** — never ship an
API key in client code.

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

- [ ] A user completing registration sees exactly one stage experience, never a stage menu.
- [ ] Skipping a required field and tapping Continue turns it red; optional fields never do.
- [ ] Logging a rough day visibly shifts the score meter color and the calendar fill.
- [ ] Cycle variability ≥7 days in peri produces the transition advice card.
- [ ] The Report opens with plain-language findings; the data table is collapsed below.
- [ ] Every Care item shows an honest evidence label; commission disclosure precedes the list.
- [ ] Every AI feature still works with the network unavailable.
- [ ] No health data is transmitted anywhere; no API key exists in client code.
- [ ] Pregnancy shows week markers and milestones — never fertile windows.

---

# ADDENDUM — v2 features (added 2026-10-07, BUILD 2026.10.07-C)

The reference implementation `App.jsx` contains all of the following. Treat the
code as the source of truth for exact behavior; this addendum explains intent.

## A1. Home screen (default tab after registration)
Both stage experiences open on **Home**, not on the check-in form. Home contains, in order:
greeting (time-of-day + name) with cycle day/phase or pregnancy week · gentle 14-day streak
("N of 14 days", never a broken-chain penalty) · one check-in CTA · today's single highest-
priority insight · "From your wearable" cards (when connected) · milestones strip · "Coming up"
(predicted period or lateness, due date, next appointment with a prep nudge ≤7 days out) ·
"You're not alone" pulse · month-vs-last-month recap (collapsed) · collapsible sections for
Wearables, What I'm trying, Appointments, Journal.

## A2. Pulse ("You're not alone")
Three stage-specific anonymous aggregate counts ("3,550 women logged cramps this week").
**Demo uses seeded placeholder numbers and says so in the UI.** Production MUST read these
from the backend aggregate endpoint (counts only, k-anonymity threshold, never identities).

## A3. "What I'm trying" — trial-and-error engine
User logs an intervention: `{ id, name, kind: "rx"|"supp"|"habit", started: ISO }` plus a
daily "taken" toggle (`medLog[iso][id]`). Engine compares average day score for the 14 days
before `started` vs 14 days after; requires ≥5 logged days on each side, otherwise shows
"N more logged days to compare". Surfaces on Home inline and on Patterns as a card with a
"bring this before/after to your visit" advice. **Never recommends doses or changes.**

## A4. Appointments
`{ id, date, who, note }`. Upcoming list with countdown; ≤7 days → "Prep report" button
routes to Report. Past appointments without a note prompt "What did they say?" (onBlur save).

## A5. Journal
Free text per day, `journal[iso]`, private, last 5 shown. Prompt: "How are you, really?"

## A6. Monthly recap
Last 30 logged entries vs the 30 before (needs ≥10 each). Shows avg day score, calm days
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
Framing: relationship context predicts desire more than hormone levels (SWAN); Cyra lines
this up against cycle phase to test whether low-desire days are hormonal "or something else."

## A8. Check-in cadence (anti-nag)
Registration step 8 and ⚙ settings: daily / weekdays / 3× week / weekly / "when I feel like
it" (no reminders). Nudge time: morning / midday / evening / never. **Policy: one reminder
max, never a second nudge, never guilt for missed days — patterns tolerate gaps.** Quick mode
replaces the symptom grid with three stage-specific questions (~10 s) that map onto hero
symptoms so patterns still compute; Full mode shows everything.

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

## A10. Milestones (Home)
Usage: first week, full month, wearable connected, started a trial, first visit debriefed.
Clinical by stage — Cycle: first full cycle, 3 cycles, ovulation confirmed by temperature.
Peri: variability ≥7 flagged; **"12 months period-free = menopause" with progress bar**
(months since last period start / 12). Pregnancy: trimester transitions, anatomy-scan window.

## A11. Social sign-in
Account step offers Apple, Google, Facebook. Demo simulates the OAuth round-trip. Production:
real OAuth client IDs, backend callback, verified email+name only. **Apple Sign-In is required
on iOS whenever any third-party login is offered — keep it first.** Copy states providers
receive only name/email, never health data.

## A12. Production checklist (what the demo simulates)
- [ ] Proxy all Anthropic calls through the backend; no API key in client code.
- [ ] Real OAuth for Apple/Google/Facebook.
- [ ] Real HealthKit / Health Connect / Oura / Terra ingestion → integrations hub.
- [ ] Aggregate endpoint for the pulse (k-anonymity ≥ 50; counts only).
- [ ] On-device persistence (not browser localStorage) + optional user-keyed encrypted backup,
      matching the privacy policy's on-device claims exactly.
- [ ] Push notifications honoring cadence + nudge-time + "never"; no SMS.
- [ ] Capacitor or Expo wrap for iOS/Android from the same codebase.
- [ ] Every UI privacy claim verified literally true of the shipped build.
