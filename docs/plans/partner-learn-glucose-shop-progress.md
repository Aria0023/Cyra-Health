# Progress: partner sharing, Learn, devices any time + glucose, shop by need

Brief: docs/plans/partner-learn-glucose-shop.md. Branch feature/partner-learn-glucose-shop. One commit per task, WIP commits
allowed, follow-up commit after verification (no amend / force-push).

Baseline (2026-11-14, before any change): lint 0 errors (23 warnings), unit 613/613, e2e 25/25.

## Task A: Partner sharing, more feelings, and plain-language explanations
- [x] lib/partner.js + tests (share text, prefs, reminder time); record key partnerShare
- [x] FEELINGS 10 -> 24, grouped, "More feelings", explanations sheet; old ids kept
- [x] lib/learn.js explainers + Learn sheet, You -> Learn, "What does this mean?" links (ring, fertile row, fertility signs, auto card)
- [x] CLINICIAN-REVIEW, PRIVACY-AUDIT, ARCHITECTURE, SPEC A12 (watch app / widget later)
- [x] e2e/partner-learn.spec.mjs + e2e/partner-learn-axe.spec.mjs (light + dark)
- [x] verified: lint 0 errors, unit 627/627, build stamp once, e2e 29/29, axe 23/23 -> final commit

## Task B: Devices any time, and blood glucose
- [x] lib/glucose.js (+tests), record key glucoseLog, devices.js Dexcom/Libre rows (+tests)
- [x] wearables.js connectGlucose; iOS readGlucose + glucose auth option; Android readGlucose + READ_BLOOD_GLUCOSE
- [x] Body "Devices" button + Glucose card (soft ramp), "+" sheet and Settings "Connect a device"
- [x] Info.plist string, PrivacyInfo comment, manifest, strings.xml rationale; PRIVACY-AUDIT store notes; PASSIVE-TRACKING-PLAN Dexcom cloud later
- [x] e2e/glucose.spec.mjs + glucose-axe.spec.mjs; e2e demo build now includes deviceSync (shipping default)
- Clinician PDF glucose section: not added (page 1 rules; see report)

## Task C: Shop by need
- [ ] not started
