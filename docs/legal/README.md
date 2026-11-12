# Legal documents (drafts, attorney review required)

The documents are static pages in `public/legal/`, served by the web app at:

| Document | Path on the live site |
|---|---|
| Index | `/legal/index.html` |
| Terms of Use and EULA | `/legal/terms.html` |
| Privacy Policy | `/legal/privacy.html` |
| Consumer Health Data Privacy Policy (WA, NV, CT) | `/legal/health-data.html` |
| Medical and AI Disclaimer | `/legal/medical-disclaimer.html` |

**They are drafts, not legal advice.** Each page shows a "Draft, not in effect" notice and is `noindex`.
`src/lib/legal.test.mjs` fails if a page with an unfilled `[PLACEHOLDER]` loses its draft notice or `noindex`, if any
link between pages breaks, if a required clause is removed, or if a page claims "HIPAA compliant", "100% secure",
"FDA cleared", SOC 2 or a guaranteed-security promise. `e2e/legal-axe.spec.mjs` runs axe on every page (light, dark,
phone and desktop width).

## What these terms do for the owner, and what no terms can do

They protect the owner as far as a consumer contract enforceably can: binding individual arbitration with a class-action
and jury waiver (with the 30-day opt-out and mass-filing batching that keep it enforceable), a liability cap
(greater of 12 months of Pro fees or $50), exclusion of indirect and health-outcome damages, "as is" disclaimers,
user indemnity, a Civil Code §1542 release for third-party disputes, strong not-medical-advice / not-birth-control /
AI-output disclaimers, no liability for data lost on the user's own device, and the Apple and Google EULA terms.

They **cannot** waive: the user's CCPA and health-data rights; liability for fraud, gross negligence or willful
misconduct where California forbids it; public injunctive relief in court (California's *McGill* rule, handled in
§20.7); or statutory damages under the CMIA and Washington's MHMDA (which has a private right of action). The real
protection beyond the documents is structural:

1. **Form an LLC (or corporation)** and put the developer accounts, Render, RevenueCat and bank account in its name, so
   claims reach the company, not the owner personally. Keep company and personal money separate.
2. **Insurance:** technology errors and omissions (E&O) plus cyber liability, which covers privacy claims and breach
   costs. Ask the broker specifically about health-data and MHMDA claims.
3. **Keep the on-device design.** The less the server holds, the less there is to breach, subpoena or sue over.
4. **Make every statement true.** Most privacy enforcement (FTC, state AGs, class actions) is about apps that said one
   thing and did another. The pages must match the build exactly; see `docs/PRIVACY-AUDIT.md`.

## Owner: fill these in (search for `class="ph"`)

- `[COMPANY LEGAL NAME]`, `[STATE]`, `[limited liability company]`, `[MAILING ADDRESS]`
- `[SUPPORT EMAIL]`, `[PRIVACY EMAIL]`, `[LEGAL EMAIL]` (can be one inbox, but someone must read it: MHMDA and CCPA
  requests have 45-day deadlines, arbitration notices start clocks)
- `[COUNTY]` for court venue (where the company is based)
- `[DMCA AGENT NAME]`, and register the agent with the U.S. Copyright Office (copyright.gov/dmca-directory, $6)
- `[EFFECTIVE DATE]` on every page

## Counsel: decide or confirm

1. **California CMIA (AB 254, in force since 2024).** A business offering a "reproductive or sexual health digital
   service" is treated as a *provider of health care* under the Confidentiality of Medical Information Act. Solia Health
   very likely qualifies. Confirm what that requires, especially for the AI hand-off to Anthropic, which may need a
   CMIA-compliant authorization (Civ. Code §56.11) on the opt-in screen rather than only a consent checkbox.
2. **MHMDA consent.** Whether per-feature opt-ins meet Washington's "separate and distinct" consent, or a standalone
   consent screen is needed. The Act also requires a link to the health-data policy **on the website's homepage**
   (the marketing site must include it).
3. **Minimum age** (draft: 13+ with parental permission under 18). No age gate exists in the app yet.
4. **Arbitration provider** (draft: AAA Consumer Rules with its Mass Arbitration Supplementary Rules) and the
   batch size in §20.6.
5. **Liability cap amount** ($50 floor) and the one-year claim limit (§20.9), which some courts refuse in consumer
   contracts.
6. **Anthropic:** sign a data processing agreement and zero data retention before launch, then replace the
   retention placeholder in the Privacy Policy.
7. **Render:** confirm what request logs contain and how long they are kept; fill the placeholder.
8. **Required sign-in** (owner decision 2026-11-12: guests log on the device; Apple / Google / email sign-in is required
   for backup and sync, Pro and AI). When it ships, rewrite the "Account" row in Privacy §3 and the CCPA table to match.
9. **HIPAA:** stays out of scope only while production loads no FHIR, telehealth-webhook or partner modules.
10. **Affiliate commissions** in the Care tab: Terms §8 reserves the right; the app must label each paid link when one
    ships (FTC Endorsement Guides).

## Going live (after counsel signs off)

1. Fill every placeholder, remove each page's `<div class="draft">` notice and change `noindex, nofollow` to
   `index, follow`. The unit test then passes only if no `class="ph"` remains on a page without the notice.
2. Commit and deploy, and check the pages load at https://cyra-health.onrender.com/legal/terms.html etc.
3. **Only then** set, in Render → static site → Environment:
   `VITE_TERMS_URL=https://cyra-health.onrender.com/legal/terms.html` and
   `VITE_PRIVACY_URL=https://cyra-health.onrender.com/legal/privacy.html`.
   (A production build fetches both URLs and fails if they don't serve a document, so the pages must be live first.)
   The app then links them from registration, the Pro sheet and You.
4. Phone builds: put the same two values in `.env.local`, set `privacy_policy_url` in
   `android/app/src/main/res/values/strings.xml`, and enter the URLs in App Store Connect and the Play Console.
5. When anything in these pages changes materially, bump the version, update the effective date, and tell users in
   the app before it takes effect.
