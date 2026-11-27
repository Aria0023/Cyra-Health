# Eval: the Solia Health website (docs/plans/website.md)

Branch `feature/website`, base `main` 530af43 + the plan commit 873c93a (main has since moved on; it was not merged
into this branch). Measured 2026-11-26 and re-verified 2026-11-27 on the final tree, on a
plain `npm run build` (no store links, no support address, no site address: the repository's defaults), served the way
`render.yaml` configures Render (`site/build/serve.mjs`), with the e2e harness's Chromium. Sizes are the files' own
bytes; "gzip" is the same request list with the text files gzipped, as a host that compresses would send them.

**What was not measured, and why:** the live site and every outside host are blocked in this session, so nothing was
checked against Render, the stores or the ad platforms' policy pages. The list is at the end.

## Commits

| Task | Commit(s) |
| --- | --- |
| 1. "Web app moves to /app; nobody loses her log" | e966b84 |
| 2. "Website: what Solia Health is, and where to get it" | f606222 (WIP: the pages), bbe4af7 (final: the verification record) |
| 3. "Store and law pages: support, delete your account, policies" | fb20e93 |
| 4. "Ad kit: images and copy that pass the ad platforms' health rules" | ddd86d3 |
| Eval | this commit |

## Verification, per task (full runs from the worktree; details in docs/plans/website-progress.md)

| Check | Baseline 530af43 | Task 1 | Task 2 | Task 3 | Task 4 | Final (eval) |
| --- | --- | --- | --- | --- | --- | --- |
| `npm run lint` | 0 errors, 23 warnings | 0 / 23 | 0 / 23 | 0 / 23 | 0 / 23 | 0 / 23 |
| `npm run test:unit` | 737 | 747 | 757 | 761 | 764 | 764 |
| `cd backend && npm test` | 148 | 148 | 148 | 148 | 148 | 148 |
| `cd backend && npm run smoke:all` | exit 0 | exit 0 | exit 0 | exit 0 | exit 0 | exit 0 |
| `npm run build`, stamp in `dist/` | once | once | once | once | once | once |
| e2e (`npm run e2e -- --trace off`) | 120 | 123 | 126 | 128 | 128 | 128 (see the note on two timing-sensitive tests) |
| axe (`npm run e2e:axe -- --trace off`) | 74 | 74 | 78 | 78 | 78 | 78 on 2026-11-26 (with contrast measured from pixels); on 2026-11-27 two reruns were not clean (see the note) |
| Native: `build:native` + `cap copy` | n/a | app at root, no website | same | same | same | same (android and ios) |

**Four existing tests are timing-sensitive, and it showed during this work.** None is about the website and none was
edited. The website's own tests (`site-move`, `site`, `site-axe`) passed in every run.
- **The axe suite on the final tree: 78/78 on 2026-11-26. On 2026-11-27, with no code change in between, two full
  reruns gave 69 passed / 3 failed / 6 not run, and 71 passed / 1 failed / 6 not run.** The failures are
  `e2e/axe.spec.mjs:31` ("Soft light: the main screens …", at its Cycles step) and `e2e/meal-photos-axe.spec.mjs:20`
  (light and dark); the "not run" are the rest of `axe.spec.mjs`, which is serial and stops at its first failure. Both
  run axe on an app screen right after tapping a segmented control whose colours take 100 ms to change, so axe sometimes
  reads a colour half-way. **The untouched baseline (530af43, in a temporary worktree) fails the same tests the same
  day:** in a series of single-test runs made back to back, `axe.spec.mjs:31` passed 3 of 8 on the baseline and 2 of 8 on this
  branch; `meal-photos-axe` failed in 1 of
  4 baseline runs. So this is the app's existing test, not this branch; it did not show on 2026-11-26 on either.
- `e2e/guest.spec.mjs:38` ("guest window: try it first …"): on the final tree the full e2e suite was run three times:
  127/128 and 127/128 on 2026-11-26 (this test both times, at the same line: after a reload it expects a line that was
  hidden a moment earlier to stay hidden), then 128/128 on 2026-11-27. Run by itself it passed 5 of 5, and in a 42-test sequence 2 of 2. It passed in
  every full run of Tasks 1 to 4.
- `e2e/orgs.spec.mjs:68` ("a ?org= link …") failed once in Task 2's first run, while a second suite and a build were
  running on the same machine (it reads the mock server's request list on the line after a click, without waiting). It
  passed in every other run.
- One thing changed under these two: the e2e server is now `site/build/serve.mjs` inside the test runner instead of a separate
  `vite preview` process (needed for the real 404 and the `/app/*` rule). It answers a little faster, which may make a
  reload win a race it used to lose. NOT VERIFIED as the cause. All four tests deserve an explicit wait in a later change.

Tests added over the baseline: unit +27 (`site.test.mjs` 25, `pwa.test.mjs` 1, `sw.test.mjs` 1), e2e +8
(`site-move.spec.mjs` 3, `site.spec.mjs` 5), axe +4 (`site-axe.spec.mjs`). No existing test was skipped, disabled or had a
count changed; the harness changed only in `e2e/lib/serve.mjs` (and gained `e2e/lib/site.mjs` and `e2e/lib/contrast.mjs`).
Xcode and Android Studio builds were NOT run (not available here).

## 1. The returning user: redirect and record carry-over

**The proof is a test** (`e2e/site-move.spec.mjs`, 3 tests, in every e2e run above):

1. One origin serves the app the way it was served before the move (plain `vite build`: the app at `/`, its worker at
   `/sw.js` with scope `/`). The test registers there as Maya (My Cycle), waits for her record in IndexedDB, for the
   root worker to be registered and for its shell cache.
2. The same origin is switched to today's web build (the website at `/`, the app under `/app/`).
3. She opens `/` again. Asserted: the address becomes `/app/`; the app shows "Good morning/afternoon/evening, Maya" and
   no "Get started"; the only main-frame addresses ever shown are `/` and `/app/`; after the retiring worker runs, the one
   registration left is `/app/sw.js` with scope `/app/`, no cache holds the old shell (`/index.html`) and the app's new
   shell cache exists; her record is still there and You → Your profile opens.
4. `/#/you/privacy` lands on `/app/#/you/privacy` on the right page; `/?site=1` shows the website even to her.
5. A first-time visitor stays on the website, with no database created by looking, nothing in localStorage,
   sessionStorage or cookies, and no worker; `/?org=lakeside` and `/#/shop` go to the app; a page running as an installed
   app (display-mode standalone) goes to the app.
6. `/app/some/deep/link` answers with the app; `/no-such-page` answers 404 with the 404 page; `/legal/*` answer where
   they always did; `/manifest.webmanifest` is gone and `/app/manifest.webmanifest` has `start_url` and `scope` `./`.

**Measured on the final build** (a browser that registered in the app, then five visits to `/`):

| What | Result |
| --- | --- |
| Lands on | `/app/`, greeting "Good morning, Maya." |
| Time from asking for `/` to the address being `/app/` | 174, 134, 173, 120, 128 ms (local server) |
| Painted on `/` before leaving | nothing: no `first-paint` or `first-contentful-paint` entry was recorded on `/`, and `html[data-wait]` was still set when the page was left, 46 ms after it started |
| Network calls made to decide | none: `site/static/go.js` reads IndexedDB on the device (unit tests scan it for any request, cookie or write) |
| Requests the browser made before the app's page | `/`, `/site/go.js`, and, because the browser's preload scanner starts them while the script loads, the stylesheet, the two fonts and the hero picture. All same-origin, all cached after the first time |
| First-time visitor | stays on `/`; `data-wait` removed; 0 databases created |

## 2. Page weight, requests, third parties, cookies

| Page | Requests on load | Bytes on load | With text gzipped | After scrolling to the end |
| --- | --- | --- | --- | --- |
| `/` | 7 | 222,012 | 177,904 | 11 requests, 464,936 bytes (420,828 gzip): the four lower screenshots load lazily |
| `/support/` | 5 | 128,830 | 108,374 | the same |
| `/delete-account/` | 5 | 131,370 | 109,060 | the same |
| the 404 page | 5 | 124,635 | 106,936 | the same |

Identical at 390 and 1280 px. The front page's seven requests: the page itself 37,325 · `site.css` 20,564 · `go.js` 2,636 ·
Fraunces 67,304 · Karla 32,116 · the hero screenshot 61,544 (WebP) · the favicon 523. One stylesheet, one script (the
front page only), no inline style or script, 489 DOM nodes.

| Claim on the site ("Does the website track me?") | Measured on every page, 390 and 1280 |
| --- | --- |
| loads nothing from any other site | 0 requests to another origin |
| sets no cookies | 0 responses with `Set-Cookie`; 0 cookies in the browser; `document.cookie` empty |
| keeps nothing in your browser | localStorage 0, sessionStorage 0, IndexedDB databases 0, Cache Storage 0, service workers 0 |
| enforced, not only observed | every page carries `Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'self'; font-src 'self'; script-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'`, and no console error (a blocked file would log one) appears in `e2e/site.spec.mjs` |

Kept true by tests that fail otherwise: `src/lib/site.test.mjs` (a static scan of every page, the stylesheet and
`go.js`) and `e2e/site.spec.mjs` (a real browser).

## 3. Lighthouse-style basics (measured without new dependencies)

| Check | `/` | `/support/` | `/delete-account/` | 404 |
| --- | --- | --- | --- | --- |
| `<html lang>` / viewport meta | en / yes | en / yes | en / yes | en / yes |
| Title / description length | 79 / 120 | 22 / 112 | 43 / 124 | 29 / 24 |
| `<h1>` count; heading levels skipped | 1; 0 of 33 | 1; 0 of 9 | 1; 0 of 6 | 1; 0 |
| Landmarks: header, main, nav, footer; skip link | 1, 1, 2, 1; yes | same | same | same |
| Images: with width and height / with alt text / loaded | 5 / 5 / 5 (4 lazy, 1 eager) | none | none | none |
| Targets under 44 px (buttons, nav, footer links, questions) | 0 | 0 | 0 | 0 |
| Sideways scroll at 390 and 1280 | no | no | no | no |
| Cumulative layout shift (load, then a full scroll) | 0 | 0 | 0 | 0 |
| First contentful paint, local (390 / 1280) | 144 / 168 ms | 80 / 104 ms | 80 / 96 ms | 76 / 72 ms |
| Largest contentful paint element (390 / 1280) | the h1 / the hero screenshot | text | text | text |
| Faces actually used | Fraunces Variable, Karla Variable (the site's own files, `font-display: swap`) | same | same | same |
| Search and sharing | canonical and `og:url` only with a known address; `og:image` 1200×630 (78 kB JPEG); JSON-LD `SoftwareApplication` with no rating or review; `robots.txt`; `sitemap.xml` only with a known address | card, no JSON-LD | card, no JSON-LD | `noindex` |

The paint times are from a local server and say only that nothing blocks: on a real network the two font files
(99 kB) are the largest part of a first visit.

## 4. Accessibility: axe, and contrast measured where axe cannot

- **axe-core (WCAG 2.0/2.1 A and AA + best practice):** 0 violations in 20 audits: `/`, `/support/`, `/delete-account/`
  and the 404 page, light and dark, at 390 and 1280 px, and the front page again with all six questions open. 30 to 36
  rules pass per page. In the suite this is `e2e/site-axe.spec.mjs` (4 tests; axe total 78/78).
- **What axe could not decide:** the site's backgrounds are soft gradients, and axe marks text over a gradient "needs
  review" instead of pass or fail. Its contrast rule passed only the text on flat surfaces (42 nodes on the front page)
  and left 137 to 170 nodes on the front page, and 18 to 82 on the others, undecided.
- **So contrast was measured from the pixels** (`e2e/lib/contrast.mjs`, now part of the same four axe tests): each page
  is photographed with its text made transparent, and every line of text is compared with the worst pixel behind it.

  | | Lines of text measured (4 pages × 2 widths, questions open) | Lowest ratio found | Below AA (4.5:1, or 3:1 for large text) |
  | --- | --- | --- | --- |
  | Light | 1,424 | 5.75:1 | 0 |
  | Dark | 1,424 | 7.04:1 | 0 |

- Keyboard: the skip link is the first stop and lands on the content; a question opens and closes with Enter; focus is
  a 3 px outline in the primary colour (`e2e/site.spec.mjs`). Motion: only two short transitions, both off under
  `prefers-reduced-motion`. Drawings are decorative (`aria-hidden`); the words beside them carry the meaning.

## 5. Every public claim, with the file that makes it true

**`docs/plans/website-claims.md`**: every sentence, label and alt text the pages show, word for word, each with the app,
backend or site file that makes it true. It is generated from the pages themselves (`npm run site:claims`); the unit
tests fail if it is out of date, if a page shows any text that is not in it, or if a named file does not exist.

| Page | Claims | Labels (names, headings, link text) |
| --- | --- | --- |
| `/` | 172 | 13 |
| `/support/` | 33 | 17 |
| `/delete-account/` | 42 | 18 |
| the 404 page | 11 | 15 |

The ad kit's lines are listed the same way in **`docs/marketing/ADS.md`** (generated from `site/ads.mjs`). Every legal
or privacy wording change is in **`docs/PRIVACY-AUDIT.md`**, "The Solia Health website", flagged for attorney review.

Where the brief's wording would not have been literally true of the build, the site says the true thing instead; each
case is listed with its reason in `docs/plans/website-progress.md` (Task 2 "Deviations", Task 3 and Task 4
"Decisions and deviations"). The three that matter most to the owner:

1. **Affiliate links:** no affiliate link is configured in this build, so the site says product links *may be*
   affiliate links (and switches to *are* by itself when one is configured).
2. **What can leave the device:** the app's shipping build can send more than the six things the brief lists, so the
   site lists all of the app's own rows rather than claim a shorter list.
3. **"No ads":** the Shop lists products, some through affiliate links, so the site and the ad kit say "no ad networks"
   and "no trackers", not "no ads" or "private".

## 6. Screenshots

In the session scratchpad, `shots17/` (deviceScaleFactor 2), taken from the final build: every page at 390 and 1280 px,
light and dark, as a full page and as the first screen ("fold"). 32 files:

`home-…`, `support-…`, `delete-account-…`, `not-found-…`, each as `-390-light`, `-390-dark`, `-1280-light`, `-1280-dark`
(`.png`, full page) and the same with `-fold.png`.

The pictures the site itself ships are committed: `site/img/` (ten app screenshots, `og.jpg`); the ad kit's twelve are
in `docs/marketing/ads/`.

## 7. Not verified here (the owner or a later session must check)

- **Anything on Render.** That Render applies the `/app/*` rewrite only when no file answers, serves `404.html` with
  status 404 for unknown addresses, sends the `no-cache` headers as listed, and sets `RENDER_EXTERNAL_URL` while a static
  site builds (if not, set `VITE_SITE_URL`, or there is no canonical link and no sitemap; the build warns). The local
  server follows the same rules, pinned against `render.yaml`, but it is not Render.
- **Browsers other than Chromium.** The move, the retiring worker and the redirect were exercised in Chromium only.
- **An installed web app.** The manifest's `id` is pinned to `/` so a browser can update an app installed from the old
  address; no installed-app update can be exercised here. An iPhone Home Screen copy opens `/` and is forwarded.
- **Phone builds.** `npm run build:native` and `cap copy` were run; Xcode and Android Studio builds were not.
- **The stores' and ad platforms' current rules.** The ad checklist and the store-field table were written without
  access to those pages. ADS.md says it is not legal advice.
- **A deletion request by email.** The backend has no owner-side action for it (docs/STORE-SETUP.md §9).
- **A clean full axe run on 2026-11-27.** The last clean one on this code is from 2026-11-26; the reruns hit the app's
  two timing-sensitive axe tests, which the untouched baseline hits too (the note under the verification table).
- **Why `e2e/guest.spec.mjs:38` failed twice in three full runs on 2026-11-26.** It and `e2e/orgs.spec.mjs:68` are
  intermittent; neither was edited. The full e2e run of 2026-11-27 was 128/128.
