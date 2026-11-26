# Selling Pro: store setup checklist (owner decision D4)

The app's code for Pro is done and tested (`src/lib/purchase.js`, `src/lib/pricing.js`,
`src/components/ProSheet.jsx`). It sells nothing until the products below exist in the stores and
RevenueCat, and the two public keys are set. Everything here needs the owner's developer accounts.

**Prices:** $9.95 a month · $100 a year with a 7-day free trial · optional tips $1.99 / $4.99 / $9.99.
**Product ids are a contract with the code. Type them exactly.**

| What | Product id | Type | Price (US) | Notes |
|---|---|---|---|---|
| Pro monthly | `solia_pro_monthly` | auto-renewable subscription | $9.95 / month | no trial |
| Pro yearly | `solia_pro_annual` | auto-renewable subscription | $100.00 / year | 7-day free trial (introductory offer) |
| Tip, small | `solia_tip_small` | consumable | $1.99 | unlocks nothing |
| Tip, medium | `solia_tip_medium` | consumable | $4.99 | unlocks nothing |
| Tip, large | `solia_tip_large` | consumable | $9.99 | unlocks nothing |

RevenueCat entitlement id: **`pro`** (both subscriptions attach to it; the tips attach to nothing).

## 0. Before you start (one time)

- [ ] Apple Developer Program ($99/year) and Google Play Console ($25 once), both in the company's name.
- [ ] **Apple: sign the Paid Applications Agreement** and add banking and tax info
      (App Store Connect → Business). No purchase works until this is "Active".
- [ ] **Google: set up a payments profile** (Play Console → Settings → Payments profile).
- [ ] **Enroll in both small-business programs** so the stores keep 15% instead of 30%:
      App Store Small Business Program (apply at developer.apple.com) and Google Play's 15% tier
      (automatic for the first $1M of earnings each year; confirm in Play Console).
- [ ] Publish the Terms of Use and Privacy Policy and set `VITE_TERMS_URL` / `VITE_PRIVACY_URL`
      (the Pro sheet shows these links; Apple requires them). Counsel must first add the subscription
      terms and RevenueCat as a processor (see `docs/PRIVACY-AUDIT.md`, "Pro subscriptions and tips").

## 1. App Store Connect (iPhone)

- [ ] My Apps → Solia Health → **Subscriptions** → create a subscription group "Solia Health Pro".
- [ ] Add `solia_pro_monthly` (1 month, $9.95) and `solia_pro_annual` (1 year, $100.00) to that group.
      Give each a display name and description, and a review screenshot of the Pro sheet.
- [ ] On `solia_pro_annual` → **Introductory Offers** → Free → 1 week, all territories.
- [ ] **In-App Purchases** → add the three tips as **Consumable** with the ids and prices above.
- [ ] Users and Access → Integrations → **In-App Purchase key**: generate it, download the .p8 (for RevenueCat).
- [ ] App Information → **App-Specific Shared Secret**: generate it (for RevenueCat).
- [ ] App Privacy: add **Purchases** and **User ID** → "Linked to the user", "Not used for tracking" (the app tells
      RevenueCat her account number while she is signed in; see section 6).
- [ ] App Privacy: add **Customer Support** → "Linked to the user", "Not used for tracking", for App Functionality
      (You → Help's "Send feedback" / "Report a problem": the message she types, kept 365 days; her account email
      only if she allows a reply). `ios/App/App/PrivacyInfo.xcprivacy` declares the same.
- [ ] App Privacy: add **Photos or Videos** → "Linked to the user", "Not used for tracking", for App Functionality
      (Meal photos, Pro and opt-in: a meal photo she chooses to send goes through our server to Anthropic; our server
      keeps no photo, only a monthly count). `PrivacyInfo.xcprivacy` declares the same, and `Info.plist` now has
      `NSCameraUsageDescription` (the camera opens only from "Take a photo"; "Choose a photo" opens the system photo picker, which needs no permission). In Google Play's Data safety form,
      declare **Photos** the same way (collected, shared with a service provider, optional, not stored by us).

## 2. Google Play Console (Android)

- [ ] Monetize → Products → **Subscriptions** → create `solia_pro_monthly` with a base plan
      (auto-renewing, monthly, $9.95) and `solia_pro_annual` with a base plan (yearly, $100.00).
- [ ] On the yearly base plan → **Add offer** → free trial, 7 days, eligibility "new customers".
- [ ] Monetize → Products → **In-app products** → add the three tips (managed products; RevenueCat
      consumes them).
- [ ] Data safety form: declare purchase history and user IDs collected for app functionality and account
      management, not shared (see section 6).
- [ ] Data safety form: declare the feedback message (user-generated content sent to customer support; the email
      address only if she allows a reply), collected for app functionality, not shared, optional.
- [ ] Create a Google Cloud **service account** with Play access for RevenueCat (RevenueCat's
      dashboard walks you through it).

## 3. RevenueCat (free until $2,500/month in revenue)

- [ ] Create a project "Solia Health"; add an **App Store** app (bundle id from `capacitor.config.json`,
      the .p8 key and shared secret from step 1) and a **Play Store** app (package name, the service
      account JSON from step 2).
- [ ] Products → import all five products from both stores.
- [ ] Entitlements → create **`pro`** → attach `solia_pro_monthly` and `solia_pro_annual` (both stores).
      Do not attach the tips.
- [ ] Offerings → make the **current** offering with two packages: **Monthly** → `solia_pro_monthly`,
      **Annual** → `solia_pro_annual`. (The app looks for the MONTHLY and ANNUAL package types.)
- [ ] Project settings → **turn off** any attribution or integrations you don't need; set no customer
      attributes. The app never sends any, and nothing about her health may ever be added here.
- [ ] API keys → copy the two **public SDK keys** (`appl_…`, `goog_…`). Never the secret key (`sk_…`).

## 4. Put the keys into the builds

- [ ] Render → static site "cyra-health" → Environment: `VITE_REVENUECAT_IOS_KEY`,
      `VITE_REVENUECAT_ANDROID_KEY` (public, safe in the app). Optional: `VITE_TIP_URL` for a web tip page, and
      `VITE_SUPPORT_EMAIL` for the support mail link in You → Help.
- [ ] Phone builds: put the same two values in your local `.env`, then `npm run cap:sync`, which also
      bundles RevenueCat's native code (the npm dependency `@revenuecat/purchases-capacitor`).
- [ ] iOS: in Xcode, Signing & Capabilities → **+ In-App Purchase**.

## 5. Test before release

- [ ] iOS: a **Sandbox tester** account (App Store Connect → Users and Access → Sandbox), or a StoreKit
      configuration file in Xcode. Buy monthly, buy yearly (trial), cancel, Restore purchases, a tip.
- [ ] Android: add yourself as a **license tester** (Play Console → Settings → License testing) and use
      an internal testing track.
- [ ] Check the Pro sheet shows the store's price (try another country's sandbox account: the currency
      should change), and that "Start 7-day free trial" appears only on the yearly plan.
- [ ] Turn Pro off (cancel and let it lapse in sandbox): nothing she logged is locked or hidden.
- [ ] Without keys set, the phone app must say "The app store isn't connected in this build".

## 5a. Store review checks: restore purchases and delete account (2026-11-19)

Both are required by Apple's App Store review (and Google Play asks for in-app account deletion too) and are pinned by
`e2e/store-checks.spec.mjs`, on a 390x844 screen. Check them by hand in the store build before each submission.

- [ ] **Restore purchases is on the plans screen, with the plans.** Open the plans (Home or You → "See Pro plans", or
      the "Your free week is over" sheet): "Restore purchases" sits directly under the two plan tiles and is on screen
      without scrolling. It is also on You → Plan & account. Tap it on a device that already bought Pro with the same store
      account: Pro turns on.
- [ ] **Delete my account is two taps from You → Plan & account.** While signed in: You → Plan & account → "Delete account", then
      "Delete my account". Between the two taps the app says what is deleted (the account on Solia Health's server:
      sign-in email, name and how she signed in, her monthly AI use counts, any feedback she allowed a reply to), that
      it can't be undone, that it does not cancel a Pro subscription (that is done in the App Store or Google Play),
      and that the health log on the device is not touched (Delete everything erases that). Nothing is deleted before
      the second tap.
- [ ] In App Store Connect → App Review Information, say where both are: "Restore purchases: on the plans sheet under
      the plan tiles, and in You → Plan & account. Account deletion: You → Plan & account → Delete account."
- [ ] Google Play → Data safety → account deletion: Play also asks for a web address where someone can ask for their
      account to be deleted without the app. There is none in this repo yet: publish one (a page or the support
      address) before filling in that form.

## 6. Promotions, Pro grants and the subscriptions dashboard (partner portal)

The portal's **Subscriptions**, **Promotions** and **Pro grants** pages (owner only) read and write RevenueCat from the
backend. The portal never sets a price: every price, trial and discount is made in the stores, and the app shows only
the price the store returns.

**Connect RevenueCat to the backend (once).**
- [ ] RevenueCat → Project settings → API keys → **+ New secret API key** (API v2). Give it read access to charts and
      metrics, project configuration (offerings) and customer information, and write access to customer information
      (for grants). Copy it once; it starts `sk_`.
- [ ] Render → **cyra-backend** (the web service, never the static site) → Environment:
      `REVENUECAT_SECRET_KEY` = that key, `REVENUECAT_PROJECT_ID` = the project id (Project settings → General, or the
      id in the dashboard's URL), `REVENUECAT_ENTITLEMENT` = `pro`. Save; Render redeploys.
- [ ] If Pro grants fail with "RevenueCat refused the key", the promotional-grant endpoints are API v1: create a v1
      secret key too and set it as `REVENUECAT_V1_SECRET_KEY`.
- [ ] **Before go-live, check every endpoint in `backend/src/modules/subscriptions/revenuecat.js` against RevenueCat's
      current API reference** (paths, body and response fields). They were written without access to the docs.

**A promotion (a scheduled banner tied to a store offer).**
- [ ] In the store, make the offer as an **introductory offer on its own product**, so a normal purchase applies it:
      App Store Connect → Subscriptions → the "Solia Health Pro" group → add a product (e.g. `solia_pro_annual_spring`,
      1 year) → Introductory Offers (e.g. Free, 1 month, new subscribers). Google Play Console → `solia_pro_annual` →
      add a base plan or an offer (free trial, eligibility "new customer acquisition"). The store decides who is eligible.
      (Apple's signed "Promotional Offers" are not used: the app buys packages as they are.)
- [ ] RevenueCat → Products → import it; Entitlements → `pro` → attach it; Offerings → **+ New** (not the current
      offering) with an Annual package (and a Monthly one if wanted) using the new products. Copy the offering's
      **identifier**.
- [ ] Portal → Promotions → New promotion: the offering identifier, where (iPhone / Android / web), who (everyone, new
      users, or life stages; decided on her phone), start and end, and the banner's title and text (no price: the app adds
      the store's). Save, then **Start**. It goes live at its start and ends by itself; **Stop now** ends it at once.
- [ ] Check on a sandbox phone: the banner shows the store's price for that offering, and nothing if the offering doesn't load.

**Free Pro for a person or a group.**
- [ ] Portal → Pro grants: paste one email or up to 500 (or a CSV), choose the length (1 week to lifetime, RevenueCat's
      promotional durations) and a note. Emails with no account are listed back; tick "give it to them at their first
      sign-in" to queue them. RevenueCat receives the account number, never the email.
- [ ] Revoke ends **every** free Pro grant on that account (RevenueCat's revoke is per account).
- [ ] The app picks the grant up the next time it reads Pro from RevenueCat (at launch, or Restore purchases).

**Privacy labels after this change.** The app now calls RevenueCat's `logIn` with her Solia Health account number when
she is signed in, so in App Store Connect → App Privacy, **Purchases** and a new **User ID** are "Linked to the user"
(not used for tracking), and in Google Play's Data safety form, **User IDs** are collected for app functionality and
account management (not shared). See `docs/PRIVACY-AUDIT.md`, "Promotions, Pro grants and codes".

## 7. Partner promo codes

- [ ] **iPhone:** App Store Connect → Subscriptions → the subscription → **Offer Codes** → create an offer (who may
      redeem, duration, price or free), then **one-time-use codes** → generate and download the .txt. Make a separate
      offer per partner so App Store Connect's reports show each partner's redemptions.
- [ ] **Android:** Play Console → Monetize → **Promo codes** → a subscription promotion (one-time codes) → download the
      CSV. Again one promotion per partner.
- [ ] Set `VITE_APP_STORE_ID` (the app's numeric Apple id, App Store Connect → App Information → Apple ID) on the static
      site and in the phone builds' `.env`: the Pro sheet's "Have a code?" opens Apple's redeem page with it when the
      RevenueCat plugin can't show Apple's code sheet itself.
- [ ] Portal → Codes → upload the batch (store, offer, expiry, partner). The partner downloads its available codes in
      its own portal; you mark codes given out or redeemed from the stores' reports. The portal never claims to know
      which code was used: the stores don't report that to it.

## 8. The website's download buttons (2026-11-26, docs/plans/website.md)

The website's front page (`site/pages/home.mjs`) has one button per store. They are **plain text buttons in the site's
own style**, built from the same two settings the app uses:

- [ ] Render → static site "cyra-health" → Environment: `VITE_APP_STORE_URL` (the app's App Store page) and
      `VITE_PLAY_STORE_URL` (its Google Play page), both `https://…`. Until each is set, the website says
      "Coming soon to the App Store" / "Coming soon to Google Play" as text, never a link that goes nowhere.
- [ ] `VITE_APP_STORE_ID` (the numeric Apple id, section 7) also adds Apple's Smart App Banner to the front page, so
      Safari on an iPhone offers the app at the top of the page.
- [ ] **Official badges (your choice).** Apple's "Download on the App Store" and Google's "Get it on Google Play" badge
      artwork may be used instead of the text buttons, but each has its own licence and rules (size, clear space,
      wording, one badge per store, your developer account in good standing): Apple's App Store Marketing Guidelines and
      Google Play's badge guidelines. They are not in this repository. If you want them, download the artwork from Apple's
      and Google's own marketing pages with your developer accounts, add the files under `site/img/`, and swap them in
      where `storeButtons` builds the two links. Keep them as files served by the site itself: the website loads
      nothing from another origin, and a unit test fails if it does.

