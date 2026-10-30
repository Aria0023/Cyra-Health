# Operations: running Cyra Appointment-Ready

A software business with one founder. "Opening" means the app is live in the stores and the backend is up. Most of the work is support, releases, content and staying compliant. **Not legal advice.** The rules below vary by country and US state and change often; confirm each with the official source or a professional.

## 1. The daily cycle (✱ = the customer sees it)

1. Check the backend is up: the status page plus the `/api/ai/status` reply. Five minutes.
2. ✱ Answer support email and store reviews within 24 hours, using the complaint routine (§4).
3. Glance at the waitlist and store dashboards: installs, first summaries, packs bought. These are aggregate store numbers; the app sends no analytics.
4. ✱ Post one piece of content (marketing calendar).
5. Two to three hours of product work toward the offer's build list (`offer.md` §3).
6. Weekly: release if anything changed (§4, release routine), reconcile store payouts, review the three numbers in `marketing.md` §5.

## 2. Suppliers (every cost in `numbers.json`)

| need | supplier | published price / how to get one | terms | source |
| --- | --- | --- | --- | --- |
| iOS distribution and in-app purchase | Apple Developer Program | $99 a year; 15% commission under the Small Business Program (apply separately) | annual; payouts monthly | https://developer.apple.com/programs/ · https://developer.apple.com/app-store/small-business-program/ |
| Android distribution and billing | Google Play Console | $25 one-time; 15% on subscriptions, and on the first $1M a year for enrolled developers | payouts monthly | https://play.google.com/console/about/ · https://support.google.com/googleplay/android-developer/answer/112622 |
| Backend hosting | Render (current); alternatives Fly.io, Railway | the static site is on the free tier; the web service is a paid tier, so check the current price | monthly, card | https://render.com/pricing · https://fly.io/docs/about/pricing/ · https://railway.com/pricing |
| AI (Pro write-up and chat) | Anthropic API, through the existing backend proxy | per-token, model-dependent: **check the live price list and set a monthly spend limit in the console** | prepaid credits or invoice | https://www.anthropic.com/pricing |
| Domain and email | any registrar (Cloudflare Registrar, Namecheap); email from Fastmail or Proton | at-cost or about $10–15 a year for the domain; about $5 a month for email | annual / monthly | https://www.cloudflare.com/products/registrar/ · https://www.fastmail.com/pricing/ · https://proton.me/mail/pricing |
| Clinician review | a PCOS-aware OB-GYN, endocrinologist or registered dietitian; a university clinic or a PCOS charity's medical adviser | **quote needed**; the $1,500 in `numbers.json` is an estimate | fixed-fee review of `docs/CLINICIAN-REVIEW.md` and `docs/EVIDENCE.md` | — |
| Legal review | a privacy and health-tech lawyer, or a startup legal service | **quote needed**; the $2,500 is an estimate | fixed fee for the privacy policy, terms and a state health-data law check | — |
| Independent privacy review (later, before PR or ads) | Mozilla *Privacy Not Included* (free, editorial, can't be bought); a paid security audit firm | **quote needed** | — | https://foundation.mozilla.org/en/privacynotincluded/ |
| Clinic cards | any online printer (Vistaprint, Moo) | about $20–60 per 100–250 cards | 3–7 days | https://www.vistaprint.com/ · https://www.moo.com/ |

`numbers.json` is unchanged: no real quote has replaced an estimate yet. When the clinician and lawyer quotes arrive, update them and re-run `/founder-cfo`.

## 3. People

| role | who | slow first month | at plan (3 packs a day) |
| --- | --- | --- | --- |
| Product, support, content, ops | the founder | about 20–30 hrs a week: build-list work, community, video | about 15 hrs a week support and ops, the rest growth |
| Clinician reviewer | contractor, fixed fee | one review before launch, then on every medical wording change | as needed |
| Lawyer | contractor, fixed fee | before launch; again if accounts or new states are added | as needed |

**Wages:** none in `numbers.json`. The founder's pay is the biggest open decision (see `cfo.md`: $3,000 a month raises break-even to 16 packs a day). **Ask an accountant** about self-employment tax and how to pay yourself from an LLC.

## 4. Routines

**Release (weekly, or when needed)**
1. Merge to `main` only after the full test set passes (the repo's suites, axe light and dark, `npm run build`, and the stamp check).
2. Render deploys the web app. Hard-reload the live site and check the build stamp.
3. For store builds, run `npx cap sync`, then build iOS and Android and upload. Write release notes in plain words and list privacy-relevant changes.
4. If any medical or privacy sentence changed, it must already be in `docs/CLINICIAN-REVIEW.md` or `docs/PRIVACY-AUDIT.md` with sign-off.
5. Watch support and reviews for 48 hours after a store release.

**Core service: the first summary works**
1. Every new install should reach a first summary within 7 days. The app guides this through its own onboarding.
2. Weekly, compare installs with packs bought in the store dashboards. If the share of installs reaching a first summary (from the opt-in user interviews, since there is no in-app analytics) looks low, talk to five users.

**Complaint**
1. Reply within 24 hours: thank her, and state exactly what happened.
2. If it's a bug, reproduce it, fix it, and give the date of the fixing release.
3. If it's about money, point her to the store's refund process (Apple: reportaproblem.apple.com; Google: Play order history). Cyra can't refund store purchases directly. Never argue.
4. If it involves data or privacy, escalate to the incident routine at once.
5. Log it in a private issue list, with no health data copied in.

**Privacy incident** (the FTC Health Breach Notification Rule can apply to health apps; confirm with the lawyer)
1. Stop the leak: switch off the affected feature flag or backend module.
2. Write down what was exposed, for whom, and when.
3. Call the lawyer the same day about notification duties: the FTC rule, and state laws such as Washington's My Health My Data Act.
4. Tell affected users plainly and quickly.

**Weekly review (Monday, 30 minutes)**
1. Review the three marketing numbers against their thresholds.
2. Check Anthropic spend against the console limit.
3. Check the hosting bill.
4. Clear the support backlog.
5. Pick one thing from the build list for the week.

## 5. Tools (the smallest stack)

| job | tool | price | why |
| --- | --- | --- | --- |
| Payments | App Store and Google Play in-app purchase | the 15% commission | Required for digital goods sold in-app; handles tax |
| Waitlist and price test | a static page on the existing Render site plus a form service that doesn't track (Tally, or Formspree) | free tiers | No new SDK in the app |
| Bookkeeping | Wave (free), or QuickBooks Simple Start | free / paid | Store payouts and a few bills |
| Support | a shared inbox on the email provider | included | Low volume |
| Monitoring | Render's dashboard plus a free uptime pinger (UptimeRobot, Better Stack free tier) | free | Know when the backend is down before users do |
| Code and CI | GitHub, the existing repo and test suites | free | Already in place |

None of these tools may receive health data. That keeps the privacy claims true.

## 6. Licences, permits and insurance checklist (US-first)

| item | why | where to confirm |
| --- | --- | --- |
| Business entity (for example an LLC) in your state | liability; store accounts as an organisation | your Secretary of State's site; https://www.sba.gov/business-guide/launch-your-business/choose-business-structure |
| EIN | banking, store payouts | https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online |
| D-U-N-S number (Apple organisation accounts) | needed to enrol as an organisation | https://developer.apple.com/support/D-U-N-S/ |
| Sales tax on app sales | Apple and Google act as marketplace facilitators in most places; confirm with the accountant | — |
| FDA: stays a general-wellness / non-device app | the wording must not diagnose or treat. Keep "guidance, not diagnosis" and the clinician review | https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices |
| FTC Health Breach Notification Rule | applies to many health apps not covered by HIPAA | https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0 |
| State consumer health-data laws (Washington My Health My Data Act, and Nevada's and Connecticut's equivalents) | consent and deletion rights for health data | Washington AG: https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy |
| HIPAA | usually **not** applicable to a direct-to-consumer app that isn't working for a provider or insurer. Confirm with the lawyer before any clinician partnership | https://www.hhs.gov/hipaa/for-professionals/special-topics/health-apps/index.html |
| App Store and Play health-app rules | Apple guideline 5.1.3 (health data); Google Play's Health apps declaration | https://developer.apple.com/app-store/review/guidelines/#health-and-health-research · https://support.google.com/googleplay/android-developer/answer/14738291 |
| Age rating | the target is adults; set the store rating accordingly and do not target under-13s (COPPA) | https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy |
| Insurance | technology errors and omissions plus cyber liability; ask a broker | — |

## 7. Risk register

| # | risk | likelihood | impact | plan |
| --- | --- | --- | --- | --- |
| 1 | **Name conflict.** An existing "Cyra – PCOS & Cycle Tracker" app objects, or a store rejects the listing for confusion | high | high | Lawyer check now; pick a replacement name before the waitlist (`brand.md`) |
| 2 | App Store review rejects the health claims or the privacy label | medium | high | Clinician-reviewed wording; a privacy label that matches the build; no diagnosis language |
| 3 | Women download the app, use the free summary, and never pay | high | high | It's the core risk. The pilot measures it; if paid conversion stays under 5% at 60 days, rethink the offer before spending |
| 4 | Users stop logging after two weeks | high | medium | 3-tap log, week-one baseline, appointment-date reminders |
| 5 | AI costs spike or the API goes down | low | medium | Console spend limit; the app already says plainly when AI isn't available; the core works without AI |
| 6 | Backend outage | low | low | The core is on-device; only AI and the account backup depend on the server; uptime pinger |
| 7 | Privacy claim found untrue (a bug sends something) | low | very high | Flags e2e tests prove zero requests; incident routine; independent review before PR |
| 8 | Founder burnout or illness | medium | high | Releases weekly at most; support templates; nothing in the product needs daily attention |
| 9 | A big competitor ships a PCOS mode plus an AI summary | medium | medium | Compete on trust and clinician adoption, not features; move fast on clinic cards |
| 10 | Bad public review about predictions for very irregular cycles | medium | medium | Honest wide ranges and wording already in the app; reply with the complaint routine; never promise accuracy |
