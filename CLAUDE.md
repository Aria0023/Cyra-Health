# Cyra Health — instructions for Claude Code

Read `docs/CYRA-BUILD-SPEC.md` completely before changing anything. It is the
normative spec; `src/App.jsx` is the working reference implementation.

## Hard rules (no exceptions)
- Health data never goes to a server. On-device storage only; optional backup must be
  encrypted with a user-held key.
- No API key in client code. All Anthropic calls go through the backend proxy.
- Never weaken any privacy claim in the UI. Every claim must be literally true of the build.
- Exactly one life-stage experience per user (never a menu of all stages).
- UI palettes and data-viz color ramps stay separate.
- Apple Sign-In stays first in the social login list (App Store requirement on iOS).
- Preserve all ARIA attributes, focus styles, 44px targets, and WCAG contrast thresholds.
  Run an axe-core audit after any refactor and fix what it flags.
- One commit per task. Never commit a real secret; use `.env.example` as the template.

## Order of work
1. `npm install && npm run build` — confirm the splash shows "BUILD 2026.10.07-D".
2. Commit and push to `main` (Render auto-deploys the static site).
3. Split `src/App.jsx` into components, one per screen, zero behavior change. Build must
   still pass and the build stamp must still render.
4. Work through spec section A12 (production checklist) top to bottom.
5. For anything needing a secret, list the exact variable names from `.env.example` and tell
   the user to paste values into Render → Environment.

## Layout
- `src/` — Vite + React app (static site on Render)
- `backend/` — Node/Express modular service (partners, referrals, webhooks, payouts,
  integrations hub, agent, orgs, users, auth, FHIR, affiliates). `cd backend && npm start`.
- `docs/` — build spec, legal drafts (attorney review required before publishing)
