# Progress: the Solia Health website (docs/plans/website.md)

Branch `feature/website`, worktree `/home/user/cyra-website` (base main 530af43 + the plan commit 873c93a).
Resume from here after a restart. Baselines on 530af43: 737 unit, 148 backend, 120 e2e, 74 axe, 0 lint errors / 23 warnings.

## Task 1: "Web app moves to /app; nobody loses her log" — DONE

**The mechanism (the smallest that works).** One Vite config, two commands, one `dist/`:

| Command | What it writes | Who uses it |
| --- | --- | --- |
| `npm run build` → `node scripts/build-web.mjs` | `vite build` with `base: "/app/"` into `dist/app/`; `public/legal/` moved from `dist/app/legal/` to `dist/legal/`; the app manifest's `id` set to `/`; then the website (`site/build/site.mjs`) beside it: `/index.html`, `/404.html`, `/go.js`, `/site.css`, the retiring `/sw.js` | Render, `npm run preview`, the e2e harness |
| `npm run build:native` → plain `vite build` | exactly what the build was before: the app at the root of `dist/`, no website | `npm run cap:sync` / `cap:ios` / `cap:android` |

- `site/build/hosting.mjs`: the hosting rules in one place (`/app/*` → `/app/index.html`; the no-cache list). `render.yaml`
  carries the same rules and `src/lib/site.test.mjs` fails if the two differ. The catch-all rewrite to `/index.html` is
  gone; an unknown address gets `404.html` with status 404.
- `site/build/serve.mjs`: a small static server that follows those rules (`npm run preview`, and the e2e harness instead
  of `vite preview`, whose SPA fallback would hide a missing page).
- `site/build/native-check.mjs` + `package.json` `capacitor:copy:before`: Capacitor runs it before every `cap copy` /
  `cap sync` and stops if `dist/` holds the web build, so the website can never be copied into a phone app by mistake.
  Tried here: `npx cap copy android` on a web build stops with the explanation; on the phone build it copies.
- App: `src/lib/pwa.js` `WORKER_URL` (`<base>sw.js`; `/app/sw.js` on the web, scope `/app/`), used by `registerWorker`
  and by `src/lib/notifications.js`. `public/sw.js`: a tapped notification opens `BUILD.base` (was `/`) and
  `<base>#/confirm/<day>`. Fonts, voice clips and shop images already followed Vite's base.
- `/sw.js` is now the retiring worker (`site/static/sw.js`): deletes only `cyra-shell-…` caches that hold the old shell
  (`/index.html`), unregisters, reloads the pages it controlled. No fetch, push or message handler.
- `/` sends an existing user to `/app/` (`site/static/go.js`, loaded from `<head>` without `defer`): an installed app
  (display-mode standalone / fullscreen, iOS `navigator.standalone`), an app link (`#/…`, `#oauth=…`, `?org=…`) or a record
  in this browser's IndexedDB (`cyra` / `state` / `v1`, read only, never created). The query and hash are kept.
  `/?site=1` always shows the website. No request, no cookie, nothing stored.
- `/legal/*` did not move. The manifest moved with the app (`start_url` and `scope` are `./` = `/app/`).
- Links the app builds to itself: the portal's "How people join" line now names `/app/?org=<slug>` (and says `/?org=<slug>`
  is passed on); README and docs/NATIVE.md §2 describe the two builds. `links.js` builds no link to the app itself (only
  the Terms / Privacy / store addresses from the environment), and the install tip uses the browser's own prompt, so
  neither needed a change. CI (`.github/workflows/e2e.yml`) now counts the build stamp across all of `dist/`.
- e2e harness, shared helpers only: `e2e/lib/serve.mjs` builds with `scripts/build-web.mjs`, serves with
  `site/build/serve.mjs`, and publishes `E2E_URL` / `E2E_API_URL` as `<origin>/app` (so every existing
  `` `${E2E_URL}/…` `` in the specs is the app, unchanged) plus `E2E_SITE_URL` / `E2E_API_SITE_URL` (the origin). No spec
  was edited for the move.

**Decisions and deviations**
- **"Before paint" is "nothing is painted before the answer".** The record is in IndexedDB, which can only be read
  asynchronously. An installed app or an app link is redirected synchronously in `<head>`. For the record check `go.js`
  hides the page (`html[data-wait]`), reads the one key and then either leaves or shows the page; a 700 ms cap shows the
  page whatever the database does. No network call is involved.
- **`go.js` is a file, not inline**, so the site can carry a strict Content-Security-Policy (Task 2).
- **The manifest `id` is pinned to `/`** in the web build. Before the move the manifest's `id` (`./` at `/`) was the
  origin root; left alone it would become `/app/`, and browsers would treat the moved app as a different app and never
  update an installed copy's start address. NOT VERIFIED here: no installed-PWA update can be exercised in this container.
- **An already-installed web app** keeps its old start address `/` until the browser updates its manifest. `/` forwards
  an installed app to `/app/` when online. Offline, an old installed copy that has been online once since the move has
  no cached page at `/` (the old worker was retired, as the brief asks) until the browser has picked up the new start
  address. iOS Home Screen copies never re-read the manifest: they open `/` and are forwarded.
- **Web reminders (web push):** the push subscription belongs to the retired registration. The app re-subscribes on the
  new registration the next time reminders are applied. The backend is not deployed, so nothing is live to verify.
- **CLAUDE.md was not edited** (it still says `npm run build`; that is now the web build and still prints the stamp).

**New user-facing sentences (Task 1), verbatim**
- Front page (replaced in Task 2): "Solia Health" · "Cycle, fertility, pregnancy, perimenopause and menopause tracking.
  Your health log lives on your device." · "Open the web app"
- 404 page: "This page doesn't exist" · "The address may have changed. The web app is at /app/." · "Go to the Solia Health
  website"
- Portal (owner-facing, `backend/public/portal/orgs.js`): "With the invite code {code} on registration or in You → Your
  profile, or with a link to the web app that ends in /app/?org={slug}. The web app lives under /app/ on the Solia
  Health website; the same ending on the website's front page (/?org={slug}) is passed on to the app."

**Tests added:** unit `src/lib/site.test.mjs` (+8), `pwa.test.mjs` (+1), `sw.test.mjs` (+1); e2e `e2e/site-move.spec.mjs` (+3).

**Verified 2026-11-26 on the Task 1 tree (full runs from the worktree)**

| Check | Result |
| --- | --- |
| `npm run lint` (now also lints `site/`) | 0 errors, 23 warnings (the same 23 as 530af43) |
| `npm run test:unit` | 747/747 (737 + 10) |
| `cd backend && npm test` | 148/148 |
| `cd backend && npm run smoke:all` | exit 0 |
| `npm run build` | ok; "BUILD 2026.10.07-D" exactly once in `dist/` (in `dist/app/assets/index-*.js`) |
| e2e (`npm run e2e -- --trace off`) | 123/123 (120 + 3 in `site-move.spec.mjs`) |
| axe (`npm run e2e:axe -- --trace off`) | 74/74 |
| Native path | `npm run build:native`: the app at the root of `dist/`, stamp once, no website file. `npx cap copy android` and `npx cap copy ios` ran here: the guard passed and both `public/` folders hold `index.html`, `assets/`, `fonts/`, `icons/`, `legal/`, `voice/`, `shop/`, `sw.js`, `manifest.webmanifest` and Capacitor's two cordova files, nothing else. On a web build the same command stops before copying. NOT RUN: Xcode and Android Studio builds (not available in this container). |

## Task 2: "Website: what Solia Health is, and where to get it" — DONE

**What was built**
- `site/` is the source: `site/pages/` (the pages as plain strings: `home.mjs`, `layout.mjs`, `copy.mjs`), `site/css/site.css`
  (the rules), `site/build/` (`site.mjs` the builder, `app-data.mjs` reads the app's modules through Vite, `tokens.mjs`
  writes the CSS tokens, `claims.mjs` writes the claims list), `site/img/` (the screenshots), `site/shots.mjs` (retakes
  them), `site/static/` (`go.js`, the retiring `sw.js`).
- Output beside `dist/app/`: `/index.html`, `/404.html`, `/sw.js`, and the site's own files under `/site/`
  (`site.css`, `go.js`, `fonts/` ×4, `img/` ×10). No React, no bundle, one CSS file, one script (front page only).
- **The look is the app's Soft style, generated, not retyped:** the seven palette tokens of Periwinkle & Rose (the brand's
  colour) and every Soft scheme token, light and dark, from `src/lib/constants.js`; each life stage card wears the palette
  the app gives that stage (`stagePalettes`); Fraunces + Karla are the same `@fontsource-variable` files the app bundles;
  StageArt, the icons and the brand mark are rendered from the app's components at build time. `site/css/site.css` has
  no colour literal (a unit test scans it) and no data-viz ramp or family colour is used (a unit test checks).
  The page background is the app's own wash recipe (`styles.js .cy`), the phones sit in soft halos like Home's cycle
  ring, the buttons are the app's pills. Dark follows `prefers-color-scheme`.
- **Screenshots are real:** `npm run site:shots` builds the web app with the shipping default features, no server and the
  demo seed, registers in My Cycle and captures Home, the Log something sheet, Patterns, the Calendar and the Report at
  390×844 @2x, light and dark, re-encoded as WebP (37–80 kB each, 780×1688). Each `<img>` has width, height and an alt
  text that says the data is an example; each has a dark twin (`<picture>`); only the first loads eagerly.
- **Sections, in the brief's order:** hero · "Your privacy, plainly" · five life stages · what it does · what Pro adds ·
  pricing · clinics and employers · six questions · footer (Privacy Policy, Consumer Health Data Privacy Policy with
  "(Washington My Health My Data Act)", Terms of Use, Medical disclaimer, Support, Delete your account, "© Solia Health").
  Until Task 3 adds the two pages, "Support" and "Delete your account" go to the matching question on the front page
  (`layout.mjs hrefFor`), so no link is dead in this commit.
- **Every sentence, verbatim, with its source:** `docs/plans/website-claims.md` (generated from the pages; 169 claims and
  13 labels on the front page). That file is the list of every new user-facing sentence this task added.
- Download buttons: `VITE_APP_STORE_URL` / `VITE_PLAY_STORE_URL` through the app's own `src/lib/links.js`; unset →
  "Coming soon to the App Store" / "Coming soon to Google Play" as text; `VITE_APP_STORE_ID` adds the Smart App Banner.
  `render.yaml`, `.env.example` and `docs/STORE-SETUP.md` §8 (the official badges note) say so.
- A strict Content-Security-Policy on every page (this origin only; no inline script or style anywhere).

**Deviations from the brief, each because the brief's wording would not have been literally true of the build**
1. **Affiliate links:** the brief asks to "say plainly that some product links are affiliate links". This build has none
   configured (`src/config/affiliates.json` is all empty), so the page says "Some product links may be affiliate links,
   labelled "Affiliate link" in the app. Solia Health may earn a commission if you buy through one." The build changes
   "may be" to "are" by itself when at least one is configured.
2. **"The optional encrypted backup":** the encrypted backup on Solia Health's server (`cloudBackup`) is not in the
   shipping features, so the website describes the encrypted backup FILE she makes, which never reaches a server.
3. **"The only things that ever leave":** the app's shipping build can send more than the brief's six (a question to the
   AI, browser reminders, wearable connections, Pro's ids to RevenueCat, joining an organization). The section lists all
   of the app's own rows instead of claiming a shorter list.
4. **"Stays on her phone":** the hero says "lives on your device" (the app's own words; on the web it is the browser).
5. **Clinics and employers contact link:** shown only when `VITE_SUPPORT_EMAIL` is set (it is unset here), as the brief
   says "when set"; with it unset there is no contact line at all rather than an invented address.
6. **The meta description does not say "for iPhone and Android"** while the store links are unset.
7. **No "About the website" link was added to the app** (changing the app's screens is out of scope); `/?site=1` works.
8. **No italic for the slogan** (the italic Fraunces file would add 81 kB for three words).

**Tests added:** unit `src/lib/site.test.mjs` 8 → 18 (+10; Task 1's page test was rewritten for the real pages);
e2e `e2e/site.spec.mjs` (+3); axe `e2e/site-axe.spec.mjs` (+4: light and dark × 390 and 1280, questions closed and
open). Shared page list for the specs: `e2e/lib/site.mjs`.

**Verified 2026-11-26 on the Task 2 tree (WIP f606222; lint, unit, backend, smoke and build in the worktree before any
Task 3 edit; e2e and axe as full runs from a clean temporary worktree of f606222, removed after the eval)**

| Check | Result |
| --- | --- |
| `npm run lint` | 0 errors, 23 warnings (the same 23) |
| `npm run test:unit` | 757/757 (747 + 10) |
| `cd backend && npm test` | 148/148 |
| `cd backend && npm run smoke:all` | exit 0 |
| `npm run build` | ok; "BUILD 2026.10.07-D" exactly once in `dist/`; the site's own files are 804 kB in `dist/site/` |
| e2e (`npm run e2e -- --trace off`) | 126/126 (123 + 3 in `site.spec.mjs`) |
| axe (`npm run e2e:axe -- --trace off`) | 78/78 (74 + 4 in `site-axe.spec.mjs`: front page and 404, light and dark, 390 and 1280, questions closed and open) |
| Native path | `npm run build:native` then the Capacitor guard: passes on the phone build, stops on the web build (now recognised by `app/`, `site/`, `404.html`). Xcode / Android Studio builds NOT RUN (not available here). |

Note for whoever reruns the suite: `e2e/orgs.spec.mjs:68` ("a ?org= link…") reads the mock's request list on the line after
a click, without waiting. It passed in every quiet run (Task 1, and this clean run) and failed twice while another suite
and a build were running on the same machine. It was not edited (it is not about the website).
