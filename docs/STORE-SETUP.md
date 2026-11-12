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
- [ ] App Privacy: add **Purchases** → "Not linked to the user", "Not used for tracking".

## 2. Google Play Console (Android)

- [ ] Monetize → Products → **Subscriptions** → create `solia_pro_monthly` with a base plan
      (auto-renewing, monthly, $9.95) and `solia_pro_annual` with a base plan (yearly, $100.00).
- [ ] On the yearly base plan → **Add offer** → free trial, 7 days, eligibility "new customers".
- [ ] Monetize → Products → **In-app products** → add the three tips (managed products; RevenueCat
      consumes them).
- [ ] Data safety form: declare purchase history collected for app functionality, not shared.
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
      `VITE_REVENUECAT_ANDROID_KEY` (public, safe in the app). Optional: `VITE_TIP_URL` for a web tip page.
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
