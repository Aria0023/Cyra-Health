# The Solia Health website (owner request 2026-11-26)

Owner asked for a website for the app that promotes it, stays inside privacy law, offers the download and the
purchase, and covers everything an app like this needs. Owner chose:

- **Ads = the website promotes the app.** No ad networks, no tracking pixels, no analytics, no third-party requests.
  Plus a ready-made kit of ad and social images.
- **Purchase = pricing plus download.** Plans and prices on the site; she subscribes in the iPhone or Android app.
  No web checkout.
- **Address = website first, app at /app.** One Render static site. Existing users land in the app automatically.

Base: `main` at 530af43. Branch: `feature/website`. One final commit per task (WIP commits allowed). CLAUDE.md hard
rules apply; every sentence on the site is a public claim and must be literally true of the build.

Baselines on 530af43: 737 unit, 148 backend, 120 e2e, 74 axe, 0 lint errors / 23 warnings, build stamp exactly once.

## Task 1 — "Web app moves to /app; nobody loses her log"
- The web build serves the app from `/app/` (entry `app/index.html`); the marketing site owns `/`. The NATIVE build
  (`cap:sync`) must stay exactly as today: the app at the root of its webDir, no marketing pages inside the phone
  app. Pick the smallest mechanism (a build mode or a second output step) and document it in docs/NATIVE.md.
- Same origin, so her on-device record (localStorage / IndexedDB) carries over untouched. Prove it with an e2e test:
  a record written by the old root app is read by the app at /app.
- Service worker: the app's worker registers at `/app/sw.js` with scope `/app/`. `/sw.js` becomes a retiring worker
  that deletes the old caches, unregisters itself and reloads its clients, so a returning user is not stuck on the
  cached old shell. The manifest moves with the app (`start_url` and `scope` inside /app/).
- `/` sends an existing user straight to the app, before paint, with no network call: if this browser already has a
  Solia record, or runs as an installed app (display-mode standalone), or the URL carries an app hash route
  (`#/…`) or `?org=`, go to `/app/` keeping the hash and query. A `?site=1` link (and the app's own "About the
  website" link, if you add one) always shows the website.
- `/legal/*` stays where it is (store listings and the app link to it). `render.yaml`: rewrite `/app/*` to
  `/app/index.html`; drop the catch-all rewrite to `/index.html`; add a `404.html`. Keep the no-cache headers for
  the app shell, both workers and the manifest.
- Every link the app builds to itself (org invite links in the portal, the PWA install tip, `links.js`, docs) uses
  the new address. The e2e harness changes in its shared helpers (`e2e/lib/*.mjs`), not spec by spec.
- Build stamp still exactly once in dist.

## Task 2 — "Website: what Solia Health is, and where to get it"
Static HTML and CSS under a `site/` source folder, no React bundle, at most a few lines of inline-free JS (CSP
friendly). Self-hosted fonts already in the repo (Fraunces, Karla). It must look like the app's default Soft style:
the same palette tokens, soft blended gradients, the stage illustrations (StageArt), light and dark
(`prefers-color-scheme`). Load the `frontend-design` skill if you have it. Real screenshots of the app in a phone
frame, captured with Playwright from the demo seed and committed as optimised images with width/height and alt text.

Sections, in order:
1. **Hero:** one line on what it is (cycle, fertility, pregnancy, perimenopause and menopause tracking that stays on
   her phone), download buttons, "Open the web app" (→ /app/), one phone screenshot.
2. **Privacy promise:** what stays on her device; the only things that ever leave and only when she chooses (the
   previewed AI summary, the previewed meal photo, sign-in account details, the optional encrypted backup, opt-in
   anonymous shop tap counts, feedback she writes). Take the wording from the app's own privacy rows and
   `docs/PRIVACY-AUDIT.md`; do not invent a stronger claim.
3. **Five life stages**, one at a time, with the illustrations.
4. **What it does:** quick log and check-in, patterns, calendar and predictions (with the honesty line), devices,
   doctor-ready PDF, guided practices, the Shop (say plainly that some product links are affiliate links and Solia
   Health may earn a commission).
5. **Pro:** what Pro adds, from `ProSheet.jsx` constants. Features that need the server are described as part of
   Pro in the iPhone and Android apps.
6. **Pricing:** from `src/lib/pricing.js`, `src/lib/trial.js` and docs/MONETIZATION.md, never retyped by hand in
   two places — generate or import so the site and the app cannot drift. Free week, Monthly, Yearly with its
   7-day trial, auto-renewal, how to cancel on each store, "prices are set by the App Store and Google Play and can
   differ by country", and KEEP_LINE. If the owner-settings web prices exist (Task 2 of upgrade-enterprise), the
   site shows the built-in reference prices and says so; do not fetch at page load.
7. **For clinics and employers:** two or three lines on branded versions and totals-only dashboards, with a contact
   link (support email when set).
8. **Questions:** Is it a medical device or a diagnosis? (no) · Can I use it as birth control? (no: "Solia Health
   is not a contraceptive.") · Where is my data? · How do I cancel? · How do I delete my account and data? · Does
   the website track me?
9. **Footer:** Privacy Policy, Consumer Health Data Privacy Policy (its own clearly named link on the homepage:
   Washington My Health My Data Act), Terms, Medical disclaimer, Support, Delete your account, "© Solia Health".

Rules for the copy:
- No testimonials, ratings, user counts, press logos, awards, "clinically proven", "doctor recommended", "HIPAA
  compliant", or any health-outcome promise. No invented numbers. Nothing that implies diagnosis or treatment.
- No statement about a minimum age (undecided; attorney question). No statement that addresses a visitor's own
  health condition in the second person as a fact about her.
- Download buttons read `VITE_APP_STORE_URL` / `VITE_PLAY_STORE_URL` at build time. Unset → "Coming soon to the App
  Store" / "Coming soon to Google Play", not a dead link. Plain text buttons in the site's own style (the official
  Apple and Google badge artwork has its own licence terms; note in STORE-SETUP.md that the owner may swap them in).
  When `APP_STORE_ID` is known, add the Smart App Banner meta tag.
- The site sets no cookies, stores nothing, and requests nothing from another origin. The "Does the website track
  me?" answer says exactly that, plus the true caveat that the hosting provider (Render) receives the usual request
  details such as IP address, like any web host. Add a unit or e2e test that fails if any site page references
  another origin or sets a cookie, so the claim stays true.
- Bold lead-ins (`<strong>`) on explanatory paragraphs, as in the app.
- Preserve 44px targets, focus styles, AA contrast, a skip link, landmarks, one h1 per page, reduced-motion.
  axe clean on every site page, light and dark, at 390 and 1280 px wide.

## Task 3 — "Store and law pages: support, delete your account, policies"
- `/support/`: how to get help, the support email when `VITE_SUPPORT_EMAIL` is set (otherwise say in-app Help →
  Send feedback), how to cancel a subscription on each store, how to restore purchases. This is the App Store
  "Support URL".
- `/delete-account/`: Google Play requires a web page for account and data deletion. Steps in the app (the real
  path, e.g. You → Privacy & your data → Delete everything, and account deletion in You → Plan & account), what is
  deleted on the device and on the server and how fast, what is kept and why (read the backend for the truth:
  feedback retention 365 days, daily totals, anything else), and how to ask by email without the app.
- `public/legal/privacy.html` gains a "This website" section (no cookies, no trackers, host logs) and the two org /
  settings rows already added stay. Mark every legal change in `docs/PRIVACY-AUDIT.md` for attorney review. Do not
  weaken or strengthen any existing claim.
- SEO and sharing, all first-party: titles, meta descriptions, canonical, Open Graph and Twitter card with a
  1200×630 image, `robots.txt`, `sitemap.xml`, JSON-LD `SoftwareApplication` with NO rating or review fields,
  favicon and touch icons reused from the app. `/app/` is `noindex`.
- `docs/STORE-SETUP.md`: a table of which URL goes in which store field (Marketing URL, Support URL, Privacy Policy
  URL, Terms/EULA, Play "Delete account URL"), and what still needs the owner (a real domain, the store links, the
  official badges, attorney sign-off).

## Task 4 — "Ad kit: images and copy that pass the ad platforms' health rules"
- `docs/marketing/ads/`: images rendered from HTML with Playwright (deviceScaleFactor 2) using real app screenshots
  and the Soft look: 1080×1080, 1080×1350, 1080×1920, 1200×628, in light; three concepts (privacy-first, life
  stages, quick log). Not shipped in `dist`.
- `docs/marketing/ADS.md`: for each concept, headlines (≤30 and ≤40 characters), primary text, descriptions, a call
  to action; plus App Store / Play listing text (name, subtitle ≤30, short description ≤80, promotional text ≤170,
  keywords ≤100). A short checklist of the rules the copy was written to: Meta's personal-attributes and health
  rules, Google's healthcare and personalised-ads restrictions for health, Apple's 1.4.1 / 5.1.3 health rules, FTC
  truth-in-advertising and Health Breach Notification Rule, affiliate disclosure. Every claim in the kit must also
  be true of the build. Say plainly that this checklist is not legal advice and needs the attorney.

## Eval
`docs/plans/website-eval.md`: the returning-user redirect and record-carry-over proof; page weight and request
count for `/` (and proof of zero third-party requests and zero cookies); Lighthouse-style basics you can measure
without new dependencies (image dimensions, one h1, contrast via axe); axe results; the list of every public claim
on the site with the file in the app or backend that makes it true; screenshots of every page at 390 and 1280 px,
light and dark, in the session scratchpad `shots17/`.

## Out of scope
Web checkout, ad networks, analytics, a blog, a custom domain, legal sign-off, changing the app's screens.
