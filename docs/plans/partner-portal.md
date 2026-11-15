# Owner request, 2026-11-15: enterprise login so companies and affiliates are managed live, not a static file

Owner's words: "can we make sure enterprise login for developer able to incorporate other companies and afficilates so
that its not static."

Branch: feature/plans-shop-page (on top of the Shop page work; not merged yet by owner decision). THREE tasks, ONE COMMIT
EACH, WIP first then a final commit after verification (never amend + force-push). Progress note:
docs/plans/partner-portal-progress.md; push after each commit. Never push/merge main, no PR, never `playwright install`,
no new npm dependencies (backend has express, web-push, @anthropic-ai/sdk; use node:crypto, node:fs).

Existing scaffolding to reuse or replace (read first): backend/src/modules/auth (demo "enterprise login", org-scoped
signed tokens), affiliates (apply/list/approve with x-admin-key), catalog (GET shelf), partners (JSON configs), orgs,
users, accounts (Task-1 email-code sign-in with Resend, AUTH_SECRET-signed tokens, DATA_DIR store). Health data rules
are untouched: this is business data only (brands, products, people at partner companies), never a user's health data.

## Task 1: catalog and partner backend (commit "Partner portal API: brands, products, roles and a published catalog")
- New production module `shop` (mount in backend/config/app.json and app-dev.json, render.yaml/.env.example docs):
  - Data under DATA_DIR (JSON store like other modules): brands {id, name, monogram, hue, category tag, description,
    website}, products {id, brandId, name, covers, description, availability, price?, url, affiliateUrl?, imageId?,
    categories[], stages[], modules[], why?, evidence?, sources[]?, clinicianStatus: "awaiting"|"signed", status:
    "draft"|"pending"|"published"|"archived", updatedBy, updatedAt}, partner users {email, brandIds[], role}, invites,
    applications (move affiliates/apply here or keep it and link), audit log of every change (who, what, when).
  - Roles: `owner` (emails in env ADMIN_EMAILS, comma list) and `partner` (invited by an owner, scoped to their
    brands). Sign-in for the portal: email one-time code (reuse the accounts module's code + Resend path; dev logs the
    code), returning a short-lived signed portal token (AUTH_SECRET, separate audience from app sign-in tokens), plus an
    optional SSO hook point documented for later (OIDC per company) — do not build OIDC now.
  - Partners can: edit their brands' name/description/website/images, products' name/covers/description/
    availability/price/url/affiliateUrl/image, create products as draft, submit for review (pending). Partners can NOT
    set why, evidence, sources, categories/stages/modules, clinicianStatus or publish. Owners can do everything,
    publish/unpublish/archive, invite/remove partners, approve applications (creates the brand and invites the contact).
  - Images: upload (png/jpg/webp, max 1 MB, stripped of nothing fancy but validated by magic bytes), stored under
    DATA_DIR, served at GET /api/shop/images/:id with long cache headers.
  - Public: GET /api/shop/catalog returns ONLY published brands/products (no partner emails, no audit), with ETag and
    Cache-Control; it takes no query parameters about the user. CORS as the other modules.
  - Seed: on first start with an empty store, import the bundled src/lib/shop.js catalog as published items (owner can
    edit afterwards). Rate limits on code requests and writes. Input validation and size caps everywhere; https-only URLs.
- Tests: backend unit tests (roles, partner cannot publish or set evidence, published-only feed, image validation,
  code expiry) and a smoke script in backend/scripts (pattern of existing smokes) added to smoke:all.

## Task 2: the portal web app (commit "Partner portal: sign in, manage brands and products, review and publish")
- A separate static page served by the backend at /portal/ (backend/public/portal/index.html + one JS + one CSS, no
  framework dependency; or a second Vite entry in the app repo if simpler — choose one and document). Calm, clear
  Solia design (same fonts/colours), accessible (labels, focus, 44px, AA, keyboard), responsive.
- Screens: sign in (email -> code); owner dashboard (brands, products by status, applications queue, partners,
  audit log); brand editor; product editor with live preview of the app's product card (same look as the Shop page);
  image upload with preview; submit for review (partner) / publish, unpublish, archive (owner); set clinician status
  (owner); invite partner by email to a brand; CSV export of products.
- Public "Apply to partner" form at /portal/apply (company, contact email, category, website, note) -> applications.
- Tests: e2e for the portal against the backend started in the test (or a mocked API like e2e/lib/api.mjs) covering
  owner publish flow and partner restrictions; axe on portal screens light/dark.

## Task 3: the app reads the live catalog (commit "Shop: load the published catalog from the server, bundled as fallback")
- In the app, when the build has a server (VITE_API_BASE) and the shop flag: fetch GET /api/shop/catalog when the Shop
  page opens (and at most once a day otherwise), validate/clean every field (https URLs only, text caps, known
  categories/hues), cache it on the device in a device-only record key (never in a backup), and fall back to the
  bundled src/lib/shop.js (and its config files) when offline, unset or invalid. Images from /api/shop/images/:id.
  Matching to her stage/modules stays on the device; the request carries nothing about her (no stage, no ids, no
  query). Affiliate label rule unchanged (label + disclosure only where an affiliate URL exists). "Clinician reviewed"
  badge only for items the server marks signed.
- Make the footer/privacy sentences literally true: the catalog download is a plain request for the product list,
  like loading a web page; it carries nothing about her. Update PRIVACY-AUDIT, docs/AFFILIATES.md (now: use the
  portal; the JSON files remain the offline fallback), .env.example (ADMIN_EMAILS), render.yaml.
- Tests: unit for the catalog cleaner and fallback; e2e with the mocked API serving a catalog with a new brand that
  appears on the Shop page, and an invalid catalog that falls back.

## Verification before each final commit
npm run lint (0 errors), npm run test:unit, cd backend && npm test && npm run smoke:all, npm run build (stamp
"BUILD 2026.10.07-D" once), npm run e2e -- --trace off, npm run e2e:axe -- --trace off (0 violations).
Author: git -c user.name="Aria" -c user.email="aria23@gmail.com". Trailer lines:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HHP8o69cmnMvBZyGdDsuZF
