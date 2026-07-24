# Cyra Health — deploy to Render

## What this is
The Cyra app (registration → consent → agentic intake → stage-native tracking,
calendars, care roadmaps, advice, doctor email, Shelf, Ask) as a standalone
Vite + React app, ready to deploy.

## Deploy in 5 minutes

1. **Put it on GitHub**
       git init && git add -A && git commit -m "Cyra app"
       git branch -M main
       git remote add origin https://github.com/YOUR_USER/cyra-health.git
       git push -u origin main

2. **On Render** → New → **Static Site** → connect the repo, then:
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
   Click Create. Done — you get a live `*.onrender.com` URL.

   (Or: New → **Blueprint** and let `render.yaml` configure it automatically.)

3. **Custom domain** (optional): Render → Settings → Custom Domain → add
   `app.cyrahealth.com` and set the CNAME your registrar shows.

## Run locally first
    npm install
    npm run dev        # http://localhost:5173

## Important: the AI features
"Ask Cyra" and the agentic intake call the Anthropic API directly from the
browser. That works in this demo environment but WILL NOT work on Render —
browsers block it (CORS) and, more importantly, you must never ship an API key
in client code.

Before going live, proxy those calls through a small server:
  - Deploy the companion backend (cyra-backend.zip) as a Render **Web Service**
  - Add an endpoint that calls Anthropic server-side with the key from
    Render's environment variables (never in the repo)
  - Point `runAsk` and `finishOnboarding` in App.jsx at that endpoint

Both features already fall back to deterministic logic if the call fails, so
the app stays fully usable until you wire the proxy.

## Free tier note
Render static sites are free and always-on. If you deploy the backend as a
web service on the free tier, it sleeps after inactivity and takes ~30s to
wake on the first request.
