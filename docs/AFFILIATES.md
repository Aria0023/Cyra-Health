# Affiliate links for Shop by need (owner guide)

Shop by need (You → Shop by need, `src/lib/shop.js`) lists real products and services by category. It works with **no**
affiliate links: every item then shows a plain link to the brand's own page and no "Affiliate link" label.

## 0. Now: use the partner portal (2026-11-15)

The live catalog is edited in the **partner portal** at `<backend>/portal/` (e.g. `https://cyra-backend.onrender.com/portal/`)
and the app downloads what you publish (`GET /api/shop/catalog`, a plain request that carries nothing about her) when the
Shop opens and at most once a day otherwise. No app build is needed for a catalog change.
1. Put your sign-in address in `ADMIN_EMAILS` (Render → cyra-backend → Environment), with `RESEND_API_KEY` and `EMAIL_FROM`
   so the one-time codes are emailed. Attach a persistent disk and point `DATA_DIR` at it, or every portal edit is lost on
   the next deploy.
2. Sign in at `/portal/` with that address and the emailed 6-digit code. The first start imported this bundled catalog as
   published, so everything below is already there to edit.
3. Per product: the affiliate link, price and image are fields in the product editor (same rules as below: https only,
   plain prices, images you have the right to use, PNG/JPEG/WebP up to 1 MB). The why line, evidence, sources, needs and
   "Clinician reviewed" (set only once docs/CLINICIAN-REVIEW.md says Signed) are owner-only fields.
4. Brands that want to join apply at `/portal/apply`; approving one creates the brand and invites its contact, who can then
   edit only that brand and submit changes. Nothing a partner does reaches the app until you publish it.

**The files below remain the offline fallback**: the app shows them when the build has no server, the server can't be
reached and no copy was downloaded yet, or the server's answer fails the app's checks. After editing them, run
`npm run shop:seed` so a fresh server's first import matches (a unit test fails otherwise). An existing portal store is not
changed by them.

## 1. The fallback file: `src/config/affiliates.json`

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
- **Optional price** (2026-11-15): instead of a plain string, an entry can be `{ "url": "https://…", "price": "From $89" }`.
  The price shows on the product card only when present and only in a plain form (`$89`, `From $89`, `About $99 a year`,
  `$49 per test`); "Learn more" then says "Price set by <brand>; check their site." Copy it from the brand's own site and
  update it when theirs changes: never invent or round a price. `{ "url": "", "price": "…" }` shows the price with the plain
  brand link (no affiliate label).
- Commit, push, and Render rebuilds the static site; phone apps pick it up at the next store build. (In the portal, a
  published change reaches the app without a build.)

## 1a. Product images (optional): `public/shop/` and `src/config/shop-images.json`

The Shop page shows a calm illustrated placeholder (a soft wash in the brand's tint with the need's icon) for every product
until you add an image you have the right to use. Most affiliate programs give partners a creative kit (product photos and
logos) with permission to use them; take images only from there, or from the brand with written permission.
1. Save the image as `public/shop/<item id>.webp` (or `.jpg`), square, about 800×800, under ~150 KB.
2. Declare it in `src/config/shop-images.json`: `"everly-peri": "everly-peri.webp"`. Only a file named after its item id is used.
3. Never link to a brand's own image server (no hotlinking): the app loads nothing from another server to show the shop.
Remove an image by deleting both the file and its line.

## 1b. "Clinician reviewed" badge

Shown only for an item whose `docs/CLINICIAN-REVIEW.md` entry says `Status: Signed` AND whose id is listed in
`src/config/shop-reviewed.json` `"signed"`. None is signed yet, so no badge shows. There are no "Physician pick" or
"Best seller" badges.

## 2. Programs you can join (check current terms before applying; rates and eligibility change)

| Item ids | Where to look |
| --- | --- |
| `easyhome-lh`, `clearblue-ovulation`, `easyhome-bbt`, `prenatal`, `pregnancy-test`, `heat-wrap`, `period-underwear`, `cooling-bedding` | **Amazon Associates** (generic, widely sold items; link to the product page with your tag). Some brands (Easy@Home, Thinx, Slumber Cloud) also run their own programs; check their sites. |
| `oura` | Oura's affiliate / partner program (check ouraring.com for current terms). |
| `mira`, `inito`, `proov` | Each brand's own affiliate program, where it exists (check current terms on miracare.com, inito.com, proovtest.com). |
| `stelo`, `lingo` | Check whether Dexcom (Stelo) and Abbott (Lingo) run consumer affiliate programs in your country; if not, leave empty. |
| `libre` | Prescription device: leave empty (no affiliate link to a prescription product). |
| `apple-watch`, `garmin`, `fitbit`, `whoop` | Apple has no general affiliate program for the US Apple Store (check current terms); Garmin, Fitbit and Whoop: check their sites or Amazon Associates. |
| `quest-thyroid`, `labcorp-a1c`, `everly-fertility`, `everly-peri` | Lab tests (2026-11-15): Quest (questhealth.com), Labcorp OnDemand and Everlywell each run affiliate or partner programs through networks such as Impact or CJ (check current terms and whether health-test affiliate links are allowed in your country). Hers was not added: we couldn't confirm a listing unrelated to contraception. |
| `midi`, `sleepio`, `cbti-coach` | Care services: Midi Health may have a referral or partner program (check); Sleepio is often employer-provided; CBT-i Coach is a free government app, leave empty. |

## 3. Disclosure rules (already built in; keep them)

- **FTC Endorsement Guides (16 CFR Part 255)**: the disclosure must be clear and next to the link. The app shows "Affiliate
  link" on the item and the commission sentence under its button; the privacy line under every list says what the shop learns.
- **Ordering never follows commission**: items are ordered by her stage, her modules and the evidence. Do not reorder for rates.
- **Never** in insights, Patterns findings, urgent guidance, notifications or onboarding (checked by `e2e/shop.spec.mjs`).
- **Where the shop opens from** (owner decision 2026-11-16: it may appear on Home): the header's labelled "Shop" pill, one
  "Shop by need" card on Home that she can hide (You brings it back), a row at the bottom of the "+" sheet, the card at
  the top of You, and the quiet links beside the device list, fertility signs and the glucose card.
- **App Store (guideline 3.1.3(e) / 3.1.1)**: linking out to buy physical goods and services consumed outside the app is
  allowed and does not use in-app purchase. Do not sell digital content through these links. Google Play: same for
  physical goods.
- **Privacy policy** (`public/legal/privacy.html`, still Draft): section 5 "Shops you choose to visit (affiliate links)"
  describes what the merchant learns; list the programs you joined there before publishing (attorney review).
- **Turning it off**: build with `VITE_FEATURES` that omits `shop` (the default list includes it).
