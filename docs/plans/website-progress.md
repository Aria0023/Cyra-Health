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
