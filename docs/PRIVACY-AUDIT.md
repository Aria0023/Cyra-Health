# Cyra privacy audit

This file records the privacy audit that the build spec's production checklist (section A12) asks for: every privacy statement Cyra makes was checked against what the build actually does. It is written for the product owner and for counsel reviewing the draft legal documents in `docs/Cyra-Legal-Documents.docx`. It describes the code as of 9 October 2026 (build stamp BUILD 2026.10.07-D).

## How the audit was done and what it found

**What was checked.** Every privacy statement a user or reviewer can read: the web app's screens, the iOS and Android permission text, the iOS privacy manifest (PrivacyInfo.xcprivacy) and Android metadata, and notification text. The first audit also covered the docs, code comments and the draft legal documents.

**How.** Each statement was traced to the code that makes it true or false, and judged twice: as written, and as a reasonable user would understand it. Each finding went to an independent reviewer who tried to refute it, and only findings that survived were fixed. The final pass added a severity gate: a finding had to be fixed if it could give a user a wrong idea of what leaves the device, who receives it or how long it is kept.

**First audit: 571 statements.** 221 on web app screens, 38 in native screens and permission text, 39 in store metadata, 6 in notifications, 129 in docs and code comments, and 138 in the legal draft.
- 320 were false or misleading on at least one reading. 150 of those were plainly false.
- 16 could not be settled from code. Most were promises about future conduct in the legal draft.
- All 218 findings outside the legal draft were assigned to fixes: 28 changes to behavior, copy, native metadata and docs.
- The 102 findings in the legal draft were not edited, because the draft is waiting for attorney review. They are summarized below as 17 items.

**Final pass: 163 statements** in the changed build: every user-visible claim in the web app, the permission text, the privacy manifest and notifications.
- The reviewer upheld 2 material findings, and both were fixed:
  - Restore: the screen implied a restore replaces everything. In fact, a wearable connection that is on the device but not in the backup stays connected and keeps syncing through Cyra's server. The restore screen now says so.
  - Registration step 1 said that turning a feature off erases its data from Cyra's server, and that Cyra keeps asking until the server confirms. That was true for browser reminders but not for Fitbit/Garmin/Whoop. Now Cyra remembers a failed disconnect on the device and retries it until the server confirms. Meanwhile the wearable row shows a note, and Delete everything ends the connection too.
- 10 more were judged minor. They fell below the gate and did not have to be fixed.
- A second round re-checked the 2 fixes and found nothing.

After the final pass, the longer on-screen notices were split into a short summary with a details panel underneath ("Exactly what's sent", "Exactly what's kept"). That rewrite got its own check:
- 255 statements in the rewritten screens were traced to the code again, panels included. A separate sweep compared each screen with its pre-rewrite text, looking for any detail the rewrite dropped. It found 2 candidates; on review, both were still stated elsewhere in the same flow.
- No material findings. 13 were minor. 8 of those were wording fixes, and they were made. Among them: restore names Oura and Fitbit/Garmin/Whoop; a failed disconnect says Cyra got no answer rather than that it couldn't reach the server; the Delete everything result no longer claims waiting readings were collected; Ask says AI answers are labelled; the weekly counts footer says each phone or browser counts once a week.
- The other 5 need code changes rather than wording, and are left to the final review. They cover a phone reminder cancel that fails during Delete everything, a weekly-count flag edited across midnight, and restoring a connection that was ended after the backup was made.

This document quotes the current wording.

### Verification

Run on the final tree before commit:
- `npm run build` passes, and the bundle carries the stamp BUILD 2026.10.07-D. `npx cap sync` passes.
- ESLint: 0 errors (2 warnings for unused variables in `src/App.jsx`).
- `cd backend && npm run smoke:all`: all passed, including the production smoke test (exactly five modules mounted, secrets never logged, everything else 404).
- Emulated phone bridge (iOS and Android plugin calls against the production bundle, three builds: with a server, without one, and with policy links): 240 checks, all passed.
- Live web test against the real backend in production mode, with mock identity providers and mock Oura and Terra: 164 passed, 0 failed.
- axe-core (WCAG 2.0/2.1 A and AA plus best practice) on 28 screens, run twice (panels closed, then every panel open): 0 violations.

Not run: native compilation. Xcode and the Android SDK aren't available in the build environment, so the Swift and Kotlin code was checked by reading and against stubs only.

## Decisions for the product owner

Each of these was settled with a default so that the build is truthful today. If you change one, the copy must change with it. Several depart from the registration table in the build spec (section 4.2), which still lists a password, a required email and a required ZIP. Update the spec to match what you decide.

1. **Splash promise.** Keep the absolute "Your health data stays on your device — always", or state it precisely?
   - Applied: precise wording. The other option was to keep "always" and remove every server path for health data (Ask AI, weekly counts, Oura, Fitbit/Garmin/Whoop).
   - The build now: the splash says "Your health log lives on your device. Nothing about your health leaves it unless you turn on a feature that tells you exactly what it sends."
   - Recommendation: keep it. The spec requires the counts, the wearable hub and the AI proxy, so "always" can't be true while they exist.
2. **Anonymous Mode.** Drop the promise "If anyone ever demands we identify you, we can't"?
   - Applied: dropped. In its place, the app says no profile is kept and that the server sees the device's internet address.
   - The build now: the sentence is gone. Step 1's "What Cyra's server sees" panel says Anonymous Mode skips name and email, Cyra keeps no account or profile in either mode, and "our server and its host see your device's internet address and app or browser type when the app connects. Cyra's own code doesn't keep the address."
   - Recommendation: keep this for now. Before making a stronger promise later, use infrastructure that doesn't see or log addresses (an oblivious relay, no address logging at the host) and re-verify. Cyra can't promise how infrastructure it doesn't control responds to legal process.
3. **Ask Cyra.** Keep an opt-in AI fallback, or ship the written library only?
   - Applied: library first, AI only by explicit opt-in on each device, question text only. Until an exact retention period is confirmed, the copy says Anthropic keeps questions "for a limited time under its own terms".
   - The build now: `src/lib/askLibrary.js` answers on the device with no network call. The AI checkbox is off by default and appears only when the build has a backend. A restored backup never turns it on. Only the typed question (up to 500 characters) is sent, with no name or life stage. The backend forwards it to Anthropic and stores nothing.
   - Recommendation: keep it, and sign a data processing agreement plus zero data retention with Anthropic before launch, so the disclosure can state an exact retention period.
4. **Weekly counts window.** Show last week's closed counts or the live current week?
   - Applied: the last closed week.
   - The build now: the app asks for every life stage at once with no stage in the request, and the server returns the last closed ISO week. A count stays hidden until it reaches 50 contributions.
   - Recommendation: keep it. Live counts would let someone see a single contribution arrive.
5. **Fake contributors.** Make weekly counts resistant to scripted contributions (app attestation)?
   - Applied: no attestation. Tallies are only rate-limited (30 a minute per address, 600 a minute overall), and the numbers are labeled "contributors" and "contributions", not people.
   - The build now: Home shows "contributors logged …" and "shows once 50 contributions are counted". The heading still says the counts come "from people who share counts".
   - Recommendation differs: before marketing the counts as people, add App Attest and Play Integrity on phones and drop web tallies. Without them anyone can create contributions, so the 50 threshold is a display rule, not a guarantee about people.
6. **Research.** Run real named studies with per-study consent?
   - Applied: no studies now. The only choice is "Share anonymous weekly counts".
   - The build now: that toggle appears on the consent step and in Settings, off by default. No study screens exist.
   - Recommendation: keep it. No studies exist, and the old copy promised per-study consent that wasn't built.
7. **Email on step 1.** Optional or removed?
   - Applied: optional, labeled as kept on the device.
   - The build now: "Email (optional, kept only on this device and in backups you save)". Anonymous Mode hides it. No code sends it anywhere.
   - Recommendation differs: remove the field unless a feature will use it soon, since nothing reads it.
8. **ZIP.** Optional or removed?
   - Applied: optional, described truthfully.
   - The build now: "ZIP is optional and stays on this device. Cyra doesn't use it yet and never sends it anywhere." Backups leave it out.
   - Recommendation differs: remove it until a local feature uses it. It is unused, and combined with other details it can help identify someone.
9. **Care shelf brands.** Show real company names (such as Midi Health) with a "Partner" label?
   - Applied: hide the Partner label and the commission line until signed agreements exist, and keep the names as illustrative listings.
   - The build now: no item is marked as a partner, so no Partner label shows. Every item's button is disabled and reads "Partner link coming soon", and no commission wording appears. Real names such as Midi Health still appear.
   - Recommendation differs: for any brand without a signed agreement, use clearly fictional placeholders. A real company next to "Partner link coming soon" still implies a relationship that isn't on record.
10. **Backend modules.** Unload the partner, FHIR, organization and admin modules in production?
    - Applied: yes. Production loads only what the shipped app calls.
    - The build now: `backend/config/app.json` loads only sign-in (oauth), wearables (integrations), weekly counts (pulse), web reminders (push) and AI. The other modules run only in the development setup. Production refuses to start without real ADMIN_KEY and AUTH_SECRET values.
    - Recommendation: keep it. Those modules were publicly reachable, some had no authentication, they held demo secrets, and the FHIR and telehealth webhooks would trigger a HIPAA business-associate review.
11. **Minimum age and teens.**
    - Planned default: a 13+ gate, plus an "Under 18" band that hides weekly counts and AI.
    - The build now: not built, and deferred to counsel. There is no age gate, and the age bands start at "Under 25", so the app can't tell a minor from an adult.
    - Recommendation: counsel to choose. A 13+ gate is the minimum consistent with the draft Terms, and the draft policy promises teen protections the app can't apply today.
12. **Publishing the policy, and a release gate.**
    - Planned default: publish the attorney-reviewed Terms and Privacy Policy, link them from the consent checkbox, and fail web and iOS builds when the policy address is empty.
    - The build now uses a softer gate. Web and iOS builds still pass with no addresses set, but print a warning. The consent box then reads "I agree to how Cyra handles my data, as described above", and the screen says the documents aren't published yet. Once VITE_TERMS_URL and VITE_PRIVACY_URL are set, the box reads "I agree to the Terms & Privacy Policy" with links beside it. A production build then fetches each address and fails unless it serves an HTML or PDF document (CYRA_SKIP_POLICY_FETCH=1 skips the check for offline CI). Android release builds fail while `privacy_policy_url` is empty, and it is empty now. Settings has no policy link.
    - Recommendation: publish the documents. Paste VITE_TERMS_URL and VITE_PRIVACY_URL into Render → Environment for the static site (and `.env.local` for phone builds), and set `privacy_policy_url`. Consider failing web and iOS release builds on an empty address too. Agreement to documents people can't read isn't valid consent, and Washington's My Health My Data Act (MHMDA) requires a linked consumer health data policy.
13. **Facebook sign-in.** Keep it?
    - Applied: kept, with a disclosure.
    - The build now: the buttons appear as Apple, Google, Facebook (Apple first). The app says "Apple, Google or Facebook will know you're setting up Cyra." Facebook fills in the name only, and its email is never passed on.
    - Recommendation: counsel and owner to decide. Removing Facebook means an ad company doesn't learn that someone tried to sign in to a hormonal-health app, which happens even if she cancels.

## Where the draft privacy policy does not match the build

The legal draft is marked for attorney review and was not edited. These are the statements counsel needs to rewrite before publishing; the policy must describe the build exactly.

1. **Policy says:** §1 'Our servers do not receive your raw health entries' / §5 'None of these include your raw health entries' / §3.1 'Our servers do not receive it in identifiable form'  
   **The build does:** Some opt-in features send health information to Cyra's server: the Ask question (forwarded to Anthropic), the life-stage group and yes/no symptom flags in weekly counts, Oura readings passing through, and Fitbit/Garmin/Whoop readings held in server memory for up to 7 days. Like any web request, each one carries the device's internet address. The app says so on registration step 1 and in the weekly-counts details on the consent step and in Settings.  
   **Recommended:** List each opt-in flow: what it sends, who receives it and how long it is kept. Say the daily log, journal and Apple Health/Health Connect data are never sent.
2. **Policy says:** §1/§5 'If you enable backup, your data is uploaded only as an encrypted blob… the key stays on your device'; §11 'deleting it in the app… clears any encrypted backup you enabled'  
   **The build does:** A backup is a file the user downloads or shares, and it never goes to Cyra. It is encrypted on the device (AES-256-GCM) with a key derived from a passphrase (PBKDF2-SHA256, 600,000 rounds) that is never stored. It leaves out the ZIP, the age band and browser push addresses. Deleting in the app doesn't touch exported files.  
   **Recommended:** Describe a file the user keeps, encrypted with a key derived from her passphrase. Say Cyra never receives it, and that deleting in the app doesn't delete exported files.
3. **Policy says:** §3.1 'Account information: optional first name, email address, and password'; §10 'account information'; Terms §3 'account credentials'; Terms §11 'delete your account'  
   **The build does:** There is no server account and no password field. Email is optional and stays on the device and in backups the user saves. Anonymous Mode skips name and email. With social sign-in, the provider sends the server tokens, name, email and an account ID. The server drops the tokens and account ID at once; for Apple it first sends Apple's token to Apple's revoke endpoint, asking Apple to end Cyra's access. It holds only the name, plus the email when Apple or Google says it is verified, in memory for up to 5 minutes. Facebook's email is never passed on.  
   **Recommended:** Say Cyra keeps no account. Describe the sign-in hand-off and that the provider learns you use Cyra. Remove the credential and account-deletion language.
4. **Policy says:** §3.1 'Approximate location: ZIP… used to surface local care options and regional averages'  
   **The build does:** ZIP is optional, unused, never sent and left out of backups. The server's web reminder record stores the browser's time zone.  
   **Recommended:** Say ZIP stays on the device, unused. Disclose that web reminders store the time zone.
5. **Policy says:** §3.1 health categories list (medications yes/no only)  
   **The build does:** The app also stores named medication and supplement trials, an intimacy and relationship log, appointments, journal entries, pregnancy kick counts and wearable readings.  
   **Recommended:** List all of these categories.
6. **Policy says:** §3.2 'device type, OS version, app version, crash and performance diagnostics'; 'Usage information: features used'  
   **The build does:** There are no analytics, crash-reporting or usage SDKs. Cyra's server and its host see each request's IP address, user agent and origin. The host (Render) keeps request logs. Cyra's own code keeps only a salted hash of the address, for about a minute, for rate limiting.  
   **Recommended:** Replace with network information (IP address, user agent, request time) and how long the host keeps logs. Remove the diagnostics and usage claims.
7. **Policy says:** §4/§9 'send you the notifications and emails you have chosen (see Section 8)'; 'reminders and insights through… push and, if you opt in, email'; unsubscribe link in each email  
   **The build does:** Cyra sends no email, and the consent step has no email option. Reminders are generic ("Time for your 30-second check-in."). Phones schedule local notifications. The web uses push, and the server stores the push address and keys, reminder days and time, time zone and the last day a reminder went out. The cross-reference should be Section 9.  
   **Recommended:** Describe generic reminders only, phone versus web, what the server stores, and that no email is sent. Fix the section number.
8. **Policy says:** §5 'What our servers do receive: account basics (such as email…), app diagnostics, and… an anonymous referral token'  
   **The build does:** None of those are received. The real list: the sign-in hand-off; opt-in weekly counts; opt-in Ask questions; the web push address, keys, schedule and time zone; Oura readings in transit and Oura tokens while connecting (up to 5 minutes); Fitbit/Garmin/Whoop readings held for up to 7 days; and the IP address in host logs, plus a salted hash of it in rate limiting for about a minute.  
   **Recommended:** Replace with the complete, accurate list.
9. **Policy says:** §1/§6 partner referrals 'anonymous referral token… so we can be credited'; Terms §5 commission  
   **The build does:** No partner tap-through exists. The Care tab shows no Partner label, and each item's button is disabled ("Partner link coming soon"). The referral module, which stored a user reference with codes and partner patient hashes, runs only in the development setup. Production doesn't load it.  
   **Recommended:** Say Cyra currently sends partners nothing. Add referral language only when a reviewed flow ships.
10. **Policy says:** §6 service providers 'host our servers, send our emails and notifications, and provide security and analytics'  
    **The build does:** The actual recipients are Render (hosting), Anthropic (opt-in Ask AI), Terra and Oura (connections the user chooses), browser push services (web reminders), and Apple, Google and Meta (sign-in). There are no email or analytics vendors. Fonts are bundled with the app, so no font service is contacted.  
    **Recommended:** Name each recipient, the data it gets and how long it keeps it.
11. **Policy says:** Research §1-§4: per-study consent, named studies, recognized de-identification, partners bound by contract, 'Turn participation on or off… in Settings', research summaries, contact placeholder  
    **The build does:** There is one opt-in, "Share anonymous weekly counts", on the consent step and in Settings. There are no studies, no research partners and no summaries. De-identification is aggregation: a weekly count shows only once it reaches 50 contributions. That is a display rule, not proof of 50 different people.  
    **Recommended:** Rewrite as "anonymous weekly counts". Describe what is sent and the threshold, keep per-study language for the future, and fill in the contact.
12. **Policy says:** §7/§8 rights request channel '[privacy request email/link]'; verification and timelines; directing processors to delete  
    **The build does:** No request channel exists. Cyra's server holds little: turning reminders off deletes the push record, and Delete everything ends the Oura and Terra connections or tells the user what didn't end. Questions already sent to Anthropic and counts already added can't be deleted for one person. The app says so on the consent step and before Delete everything.  
    **Recommended:** Add a real contact. Explain what can and can't be deleted and why: no account, aggregate counts, processor retention.
13. **Policy says:** §8 MHMDA 'collect… only with your consent'; §7 'Cyra already limits itself to this'  
    **The build does:** Every server flow that carries health information is now an explicit opt-in, explained where it is turned on. There is still no separate MHMDA consent screen, and no consumer health data policy is linked. The consent step says the documents aren't published yet.  
    **Recommended:** Counsel to confirm whether the per-feature opt-ins satisfy MHMDA, or add a standalone consent, and link the policy.
14. **Policy says:** §10 'encryption in transit and at rest, access controls and least-privilege access, and monitoring'  
    **The build does:** TLS ends at Render's edge. The server's files (weekly count totals and web push records) are plain JSON on Render's temporary disk, so a redeploy or restart erases them (web reminders come back when each user next opens Cyra; the weekly totals start over). Whether to pay for a persistent disk is an open owner decision. Sign-in hand-offs and wearable readings stay in memory. There is no monitoring and no audit log.  
    **Recommended:** Describe the real measures, or implement them before publishing.
15. **Policy says:** §12 children: 'not directed to children under 13… apply additional protections' for minors; Terms 13+  
    **The build does:** There is no age gate. The age bands start at "Under 25", so the app can't tell a minor from an adult. A 13+ gate was planned and is waiting for counsel's decision.  
    **Recommended:** Counsel to choose the minimum age and teen rules. Then build the gate and align the policy with it.
16. **Policy says:** About These Documents: 'HIPAA does not currently govern Cyra'; checklist 'If any clinical-provider… integration is added'  
    **The build does:** The FHIR push and telehealth conversion webhooks are still in the code and run in the development setup. Production doesn't load them.  
    **Recommended:** Keep the statement only while production keeps those modules off, and record the HIPAA assessment.
17. **Policy says:** §13 / Terms §12 notice of material changes  
    **The build does:** There is no in-app notice and no versioned acceptance.  
    **Recommended:** Store the accepted policy version on the device, show an in-app re-consent screen when it changes, and word the commitment to match.

## Store disclosures implied by the build

**iOS privacy manifest** (`ios/App/App/PrivacyInfo.xcprivacy`). Tracking is off (NSPrivacyTracking false, no tracking domains). That is literally true: the app has no analytics, advertising or crash SDK, and fonts are bundled. Every collected type is declared linked to the user, not used for tracking, and used for app functionality only. The plist's comments give the reasons:
- **Health:** weekly-count flags, Ask questions that describe health, Oura readings relayed in real time, and Fitbit/Garmin/Whoop readings held in memory for up to 7 days. Linked because the Terra mailbox is keyed by a reference id that Terra keeps with the connection, and Apple labels each data type as a whole.
- **Sensitive info:** pregnancy, through the pregnancy stage and flags in weekly counts and through Ask questions. The tally alone is unlinked, but Ask text can identify her, so the type is declared linked.
- **Other user content:** the Ask question (up to 500 characters), forwarded to Anthropic. Linked because free text can contain her name or contact details.
- **Email address and Name:** the social sign-in hand-off, held in memory for up to 5 minutes. Declared because the hold outlasts a single request.
- **User ID:** the Terra reference id, a one-way hash of a secret key kept on the device.
- **Other data types:** Oura access and refresh tokens, held in memory for up to 5 minutes while connecting.
- **Product interaction:** the host's log entry for each backend request. The comment says it includes the URL with any query string, the client IP and the user agent. Linked because Terra's return page adds the connection's reference id to a logged URL. The draft said to remove this type; it stays, for that reason.
- **Not collected,** with reasons given: Apple Health data, the encrypted backup, the doctor summary, loading the weekly counts, the welcome sentence, phone reminders, fonts, the sign-in and connect pages themselves, and rate-limit hashes.
- **Required-reason API:** file timestamps (reason C617.1), used by the Capacitor Filesystem library built into the app.

**App Store Connect.** The App Privacy answers should mirror the manifest. Data Linked to You: Health, Sensitive Info, Other User Content, Name, Email Address, User ID, Product Interaction and Other Data. Data Used to Track You: none. A privacy policy URL (the attorney-reviewed policy) is required. The HealthKit usage text says Cyra never sends Health data to its servers or anyone else, and that the data leaves the device only inside an encrypted backup. That matches the code: the health plugin makes no network calls. Review notes should say the same (Guideline 5.1.3).

**Android.** The manifest requests exactly four Health Connect permissions, all read-only: READ_RESTING_HEART_RATE, READ_HEART_RATE_VARIABILITY, READ_SLEEP and READ_SKIN_TEMPERATURE. The Play Console Health apps declaration must list the same four. App backup is off, and the record is excluded from cloud backup and device transfer. `privacy_policy_url` in `android/app/src/main/res/values/strings.xml` is empty. While it is empty, the Health Connect rationale screen hides its policy button and release builds fail on purpose: `checkPrivacyPolicyUrl` in `android/app/build.gradle` runs before `preReleaseBuild`, `assembleRelease` and `bundleRelease`. Debug builds are not affected.

**Google Play Data safety.** Answers that match the build:
- **Health and fitness** (health info, fitness info): collected, optional, for app functionality, encrypted in transit. It comes from weekly counts, Ask questions, and Oura and Fitbit/Garmin/Whoop readings. Health Connect data is not collected; it stays on the phone.
- **Personal info, name and email:** collected during optional social sign-in and held for up to 5 minutes. The iOS manifest treats this as collection. Answer the same way, rather than "processed ephemerally", unless counsel decides otherwise.
- **Personal info, user IDs:** the Terra reference id.
- **App activity, other user-generated content:** the Ask question. It is optional and goes to Anthropic as a service provider.
- **App activity, app interactions:** consider declaring the host's request logs, to match the iOS Product interaction entry.
- **Oura tokens** have no exact Play category. Counsel to decide whether to list them under "Other info".
- **Device or other IDs:** none. **Location:** none (the ZIP is never sent).
- **Sharing:** nothing is shared for a third party's own use. Anthropic, Render, Terra and Oura act as service providers or at the user's direction. Counsel to confirm.
- **Deletion:** there is no account. Delete everything clears the device and ends server-side reminders and wearable connections. Add the privacy contact once it exists.

**Web.** California law (CCPA/CPRA) requires a notice at or before collection, and MHMDA requires a linked consumer health data policy. Today the consent step links the Terms and Privacy Policy only when VITE_TERMS_URL and VITE_PRIVACY_URL are both set. Otherwise it says they aren't published yet, and the checkbox covers only what the screen says. Settings → Your data has no policy link. Add one there.

## Data flows the app does not mention yet

These are real and not yet disclosed in the app. Most belong in the privacy policy; some may deserve a product change.

- **Host request logs.** Render keeps a log entry for every backend request. According to the iOS manifest, the entry records the full URL with any query string, the client IP and the user agent, and Terra's return page puts the connection's reference id into a logged URL. Step 1 says the server and its host "see" the device's internet address, but nothing says the host keeps logs or for how long. Confirm the contents and retention with Render.
- **Anthropic retention.** The app says Anthropic keeps Ask questions "for a limited time under its own terms". The exact period is unconfirmed, and no zero-data-retention agreement is in place.
- **Sign-in history on Android.** The app says Apple, Google or Facebook will know you're setting up Cyra. It doesn't say that on Android the sign-in and connect windows open in the default browser, so their addresses can land in that browser's history, which may sync to other devices.
- **Push services.** Settings says "Your browser's push service delivers the reminder." It doesn't say that the push service (Google, Mozilla or Apple) sees the push address and when each reminder arrives, which reveals the reminder schedule.
- **Doctor email.** The Report screen says Cyra sends nothing and the text goes only where you take it. It doesn't say that webmail or the Gmail app can save the draft to the mail provider's servers before she presses send, or that "Copy email" can sync through Universal Clipboard or a keyboard's clipboard history.
- **Screenshots and keyboards.** Android doesn't block screenshots of health screens (no FLAG_SECURE), and iOS shows health screens in the app switcher (no privacy cover). Predictive keyboards can learn journal and Ask text. Nothing in the app mentions this.
- **Unencrypted web storage.** Your data says the record is in the browser's on-device database and that a private window erases it. It doesn't say the record isn't encrypted, or that system backups of the computer (such as Time Machine) can copy it, including the Oura sign-in and the Fitbit/Garmin/Whoop connection key.

**Now disclosed or resolved since the draft:**
- **The device's internet address.** Step 1 says Cyra's server and its host see it. The weekly-counts details, on the consent step and in Settings, say each request carries it. Cyra's rate limiters keep only a salted hash of it, for about a minute.
- **Terra and Oura.** Each is named before connecting, with what it keeps: Terra keeps data under its own policy, and Oura will know you connected Cyra.
- **Restoring a backup.** The restore screen (`src/components/DataControls.jsx`) and Your data now say that wearable connections in the backup come back unconfirmed until Cyra checks them through its server (Oura straight away; Fitbit/Garmin/Whoop when readings arrive), that one this device is still disconnecting isn't restored, and that connections only on this device stay connected.
- **Partner webhook secrets.** Production refuses to start if the webhook module is turned on without a real secret for each partner. The demo secrets in `backend/config/partners/` are used only in development.
