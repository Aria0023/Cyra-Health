# Affiliate links for Shop by need (owner guide)

Shop by need (You → Shop by need, `src/lib/shop.js`) lists real products and services by category. It works with **no**
affiliate links: every item then shows a plain link to the brand's own page and no "Affiliate link" label. To earn from it,
join programs and paste your links into one file.

## 1. The one file to edit: `src/config/affiliates.json`

```json
{
  "_readme": "…",
  "oura": "https://your-affiliate-link-for-oura",
  "easyhome-lh": "https://www.amazon.com/dp/XXXXXXXXXX?tag=yourtag-20"
}
```

- Keys are the item ids in `src/lib/shop.js` (`SHOP_ITEMS[].id`); every id is already listed with an empty value.
- Values must start with `https://`. Anything else is ignored and the plain brand link is shown.
- An item with a value shows "Affiliate link" and the disclosure "Solia Health may earn a commission if you buy through this
  link. It never changes what we show you." An empty value shows no label: keep it that way unless the link is really an
  affiliate link, so every claim stays true.
- Affiliate tags are public by design (anyone can see them in a link). Never put a secret, API key or password here.
- Never add anything about the user to a link: no stage, no ids, no UTM parameters that hint at health (`utm_campaign=pcos`
  is not allowed). A plain program tag (Amazon `tag=`, an Impact or ShareASale click URL) is fine.
- Commit, push, and Render rebuilds the static site; phone apps pick it up at the next store build.

## 2. Programs you can join (check current terms before applying; rates and eligibility change)

| Item ids | Where to look |
| --- | --- |
| `easyhome-lh`, `clearblue-ovulation`, `easyhome-bbt`, `prenatal`, `pregnancy-test`, `heat-wrap`, `period-underwear`, `cooling-bedding` | **Amazon Associates** (generic, widely sold items; link to the product page with your tag). Some brands (Easy@Home, Thinx, Slumber Cloud) also run their own programs; check their sites. |
| `oura` | Oura's affiliate / partner program (check ouraring.com for current terms). |
| `mira`, `inito`, `proov` | Each brand's own affiliate program, where it exists (check current terms on miracare.com, inito.com, proovtest.com). |
| `stelo`, `lingo` | Check whether Dexcom (Stelo) and Abbott (Lingo) run consumer affiliate programs in your country; if not, leave empty. |
| `libre` | Prescription device: leave empty (no affiliate link to a prescription product). |
| `apple-watch`, `garmin`, `fitbit`, `whoop` | Apple has no general affiliate program for the US Apple Store (check current terms); Garmin, Fitbit and Whoop: check their sites or Amazon Associates. |
| `midi`, `sleepio`, `cbti-coach` | Care services: Midi Health may have a referral or partner program (check); Sleepio is often employer-provided; CBT-i Coach is a free government app, leave empty. |

## 3. Disclosure rules (already built in; keep them)

- **FTC Endorsement Guides (16 CFR Part 255)**: the disclosure must be clear and next to the link. The app shows "Affiliate
  link" on the item and the commission sentence under its button; the privacy line under every list says what the shop learns.
- **Ordering never follows commission**: items are ordered by her stage, her modules and the evidence. Do not reorder for rates.
- **Never** in insights, Patterns findings, urgent guidance, notifications or onboarding (checked by `e2e/shop.spec.mjs`).
- **App Store (guideline 3.1.3(e) / 3.1.1)**: linking out to buy physical goods and services consumed outside the app is
  allowed and does not use in-app purchase. Do not sell digital content through these links. Google Play: same for
  physical goods.
- **Privacy policy** (`public/legal/privacy.html`, still Draft): section 5 "Shops you choose to visit (affiliate links)"
  describes what the merchant learns; list the programs you joined there before publishing (attorney review).
- **Turning it off**: build with `VITE_FEATURES` that omits `shop` (the default list includes it).
