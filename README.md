# Cyra Health

One companion for every phase — cycle, pregnancy, perimenopause, menopause.
Tracks in 30 seconds a day, finds patterns, and turns them into plain-language
guidance and a doctor-ready summary. Health data stays on the device.

## Run
    npm install
    npm run dev          # http://localhost:5173
    npm run backend      # http://localhost:3000 (optional business layer)

## Deploy
Static site on Render: build `npm install && npm run build`, publish `dist`.
`render.yaml` configures it automatically via Blueprint.

## Phone apps (iOS / Android)
    VITE_API_BASE=https://cyra-backend.onrender.com npm run cap:ios       # Xcode
    VITE_API_BASE=https://cyra-backend.onrender.com npm run cap:android   # Android Studio

Step-by-step guide (signing, HealthKit, Health Connect, the `cyrahealth://` return
link, server settings, and what has and hasn't been verified): `docs/NATIVE.md`.

## Docs
- `docs/CYRA-BUILD-SPEC.md` — complete product + technical spec (normative)
- `docs/NATIVE.md` — building and running the iPhone and Android apps
- `docs/Cyra-Legal-Documents.docx` — privacy policy, terms, research consent (drafts)
- `CLAUDE.md` — working instructions for Claude Code
- `backend/README.md` — backend architecture and endpoints

## Status
Build 2026.10.07-D. Demo-grade: wearable data, pulse counts, and social login are
simulated and labeled as such in the UI. See spec section A12 for the production checklist.
