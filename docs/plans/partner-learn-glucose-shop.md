# Owner request, 2026-11-14: close the gap with GP Apps, devices any time + glucose, category affiliate shop

Owner's words: "close the gap? i guess has more explanations people may want? also i want weables to be able to connect
whenever patient wants, more importantly want to be affliate for products specifically to category, like people who
want to get pregnant, fertility, ovulation, others can include blood sugars, dexcom etc, watch for other stuff etc.."

Branch: feature/partner-learn-glucose-shop. THREE tasks, ONE COMMIT EACH (CLAUDE.md). Commit early as WIP, then add a
follow-up commit after verification (do NOT amend + force-push: the session blocks it). Keep a progress note in
docs/plans/partner-learn-glucose-shop-progress.md and push the branch after each commit. Never push or merge to main,
never open a PR, never run `playwright install`, no new npm runtime dependencies.

Hard rules still apply (CLAUDE.md + earlier decisions): health data stays on the device; every privacy sentence must be
literally true; ARIA/focus/44px/WCAG AA, axe after changes; guidance, never diagnosis; no scores/streaks; never
contraception claims; every new medical sentence gets an entry in docs/CLINICIAN-REVIEW.md "Awaiting clinician
sign-off" with its source; calm, short copy (body >= 16px, details behind disclosures).

## Task A: close the gap with GP Apps (commit "Partner sharing, more feelings, and plain-language explanations")
GP Apps' Period Tracker has partner sharing + chat, 30+ moods, a watch app and a long track record.
1. Partner sharing, privacy-first: You -> "Share with a partner". She ticks what to include (next period window, fertile
   window [Trying to conceive only], today's cycle day/phase, an optional short note she types). "Share" opens the
   system share sheet (lib/files.js / native share; web: navigator.share, else copy text) with a short, kind message and
   no app-internal ids. Nothing is stored on a server, no partner account. Optional on-device reminder "Send an update
   before my period" (local notification on phones only). Never symptoms, notes, moods or anything not ticked.
2. More feelings: grow FEELINGS (src/lib/mind.js, currently 10) to about 24, grouped (Calm/Low/Tense/Body/Connection or
   similar), the first row as today and the rest behind "More feelings". Each has a one-line plain explanation shown on
   long-press/"i" or in a small sheet. Keep old ids valid (records already store them); update clean functions/tests.
3. Explanations people want ("Learn"): a small on-device library src/lib/learn.js of plain-language explainers, each
   3-6 short sentences + a "Sources" disclosure with named sources (ACOG, NICHD/NIH, NHS, MedlinePlus, CDC), e.g.:
   the menstrual cycle and its phases; what the fertile window is and why predictions are estimates; ovulation tests
   (LH); basal body temperature; cervical mucus; irregular cycles and PCOS basics; perimenopause signs; resting heart
   rate, HRV, skin/wrist temperature and what wearables can and can't tell; blood glucose, CGMs and time in range
   (general education only, no targets for her, "ask your clinician about your targets"). Reach them from "What does
   this mean?" links beside the related screen elements (cycle ring/phase, fertile row, fertility signs, auto-tracked
   card, glucose card from Task B) and from You -> "Learn". Every explainer registered in CLINICIAN-REVIEW.
4. Do NOT build a watch app or home-screen widget (native Swift/Kotlin targets this container cannot build or test).
   Record it as a later item in docs (SPEC A12 checklist) and say so in the final report.

## Task B: devices any time, plus blood glucose (commit "Devices any time, and blood glucose from Dexcom and Libre through the phone")
1. "Connect a device" must be reachable whenever she wants, not only in onboarding: You -> Data sources (exists), the
   "+" log sheet ("Connect a device" row), a small "Devices" button on Body, and Settings. Each row connects or
   disconnects at any time; show Connected / last sync in words. Reuse src/components/Devices.jsx and lib/devices.js.
2. Blood glucose, on the phone, never a server: read from Apple Health (HKQuantityTypeIdentifierBloodGlucose) and Health
   Connect (BloodGlucoseRecord, READ_BLOOD_GLUCOSE) through the same on-phone source path as sleep/temperature
   (src/lib/sources.js and the native plugin used by deviceSync; find it in ios/ and android/). This covers Dexcom (its
   apps write to Apple Health and Health Connect) and FreeStyle Libre where its app writes there. Device rows: "Dexcom
   (through Apple Health / Health Connect)", "FreeStyle Libre (through Apple Health / Health Connect)", explaining she
   turns on sharing in the Dexcom/Libre app first. Add the permission strings/entitlement usage text, AndroidManifest
   permission, PrivacyInfo/Play declaration notes (PRIVACY-AUDIT "Store disclosures"), keeping every claim true.
3. A Body "Glucose" card when readings exist: today's readings in plain words (latest value with unit and time, the
   day's range, how many readings), her unit (existing glucoseUnit pref), a 7-day line in the data-viz ramp (keep UI
   palettes and data-viz ramps separate), "What does this mean?" -> the Task A explainer. No targets, no colours that
   judge, no "good/bad", no alerts, no dosing. Readings stay on the device; include in the clinician PDF as an optional
   section (off by default) only if it fits on the page rules.
4. Native code: make the change carefully even though it can't be compiled here; keep it minimal, follow existing
   patterns, and list in the final report exactly what must be tested on a real iPhone/Android. Unit-test the JS side
   with fixtures (sources.js/signalsFixtures pattern), and e2e on the web/demo build.
5. Dexcom's own cloud API needs Dexcom partner approval: document it in docs/PASSIVE-TRACKING-PLAN.md as later, do not
   build it.

## Task C: category affiliate shop (commit "Shop by need: affiliate products matched on the device to her stage and modules")
1. Replace the fictional SHELF brands in src/lib/constants.js (Emberline, Mineral & Co., Verdana, Nightfall, Restfully
   are placeholders) with a real catalog in src/lib/shop.js: categories and real, widely sold products/services, e.g.
   - Trying to conceive / ovulation: LH ovulation test strips (Easy@Home, Pregmate), Clearblue digital ovulation test,
     hormone monitors (Mira, Inito, Proov), basal thermometer (Easy@Home), prenatal vitamins with folic acid.
   - Pregnancy: prenatal vitamins with folic acid, pregnancy tests.
   - Blood sugar / CGM: Dexcom Stelo (over-the-counter CGM), Abbott Lingo, FreeStyle Libre (by prescription; link to
     its info page, no claims).
   - Wearables: Oura Ring, Apple Watch, Garmin, Fitbit, Whoop.
   - Periods: heat wraps/pads, period underwear.
   - Perimenopause/menopause: menopause-trained telehealth (Midi Health), cooling bedding.
   - Sleep: CBT-I programs/apps.
   Each item: id, brand, name, category, stages/modules it is shown for, a one-line "why" in plain words with an
   evidence label (existing tones: strong / mixed / comfort / clinical) and a source, and `url` (the brand's own page).
2. Affiliate links come from ONE owner-edited file, src/config/affiliates.json ({ "<item id>": "<affiliate url>" }),
   committed empty-valued with a comment-like "_readme" key. An item with an affiliate URL shows the label "Affiliate
   link" and the disclosure "Solia Health may earn a commission if you buy through this link. It never changes what we
   show you." An item without one shows the plain brand link and NO affiliate label (keep the claim true). Affiliate
   tags are public by design; never a secret.
3. Matching happens on the device: her stage and modules choose the first categories shown (Trying to conceive ->
   ovulation/fertility first; PCOS -> blood sugar; Pregnancy -> pregnancy; Peri/Meno -> menopause; everyone ->
   wearables, sleep). She can browse every category. Nothing about her is sent anywhere; the link carries no user data
   (no stage, no ids, no UTM with health info). Disclose plainly that the shop she opens learns she came from Solia
   Health. Open links in the system browser (native Browser/App launcher; web: target=_blank rel="noopener noreferrer
   sponsored"). No tracking pixels, no SDKs, no server calls.
4. Placement, calm and never pushy: You -> "Shop by need" (rename/fold the Care shelf so there is one place); contextual
   quiet links only where relevant: the Devices sheet ("Don't have a device? See options" -> wearables / blood sugar),
   fertility signs (Trying to conceive) -> ovulation & fertility, glucose card -> blood sugar. Never in insights,
   Patterns findings, urgent guidance, notifications or onboarding. A feature flag `shop` (default on) in
   src/lib/features.js turns it off entirely.
5. Update docs: new docs/AFFILIATES.md (programs the owner can join: Amazon Associates for generic items; brand programs
   such as Oura, Mira, Inito, Proov and others where they exist (say "check current terms" rather than inventing
   rates); how to paste links into src/config/affiliates.json; FTC endorsement-guide disclosure; App Store: physical
   goods may link out). MONETIZATION.md, PRIVACY-AUDIT.md (what the merchant learns), legal privacy draft (affiliate
   links section, still Draft), CLINICIAN-REVIEW for every "why" line.

## Verification before each final commit
npm run lint (0 errors), npm run test:unit, backend smoke if backend touched, npm run build (stamp "BUILD 2026.10.07-D"
once), npm run e2e and npm run e2e:axe (0 violations) with new specs covering the new screens in light and dark.
Commit author: git -c user.name="Aria" -c user.email="aria23@gmail.com". End each commit message with:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HHP8o69cmnMvBZyGdDsuZF
