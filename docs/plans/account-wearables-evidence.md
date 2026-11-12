# Owner request, 2026-11-12: sign-in, easy wearables, Pro = evidence-based AI

Owner's words: "i would not make anonymous they need to login with facebook, gmail, or someway. also i dont see any
place to make wearables integrated or set up easy. 3rd, the pro edition of breathing practices i think its silly,
unless we can have voice like Calm app features, its silly. i think pro should have AI functionality with evidence
based utilizing openevidence, uptodate or sometype"

Branch: feature/account-wearables-evidence. Three tasks, ONE COMMIT EACH (CLAUDE.md). Commit early as WIP and amend
after verification (container restarts have killed agents before). Keep a progress note in
docs/plans/account-wearables-evidence-progress.md. Do not merge to main and do not push to main.

Hard rules that still apply (CLAUDE.md): health data stays on the device; every privacy sentence in the UI must be
literally true of the build; Apple first in the sign-in list; ARIA, focus styles, 44px targets, WCAG contrast; axe
after changes; no API key in client code; no new runtime dependencies (backend already has @anthropic-ai/sdk; use
fetch for anything else); no scores/streaks; guidance, never diagnosis; never contraception claims.

## Research already done (cite in docs)
- OpenEvidence: no public API; app restricted to verified US clinicians (NPI). Not usable.
- UpToDate: enterprise "Expert AI" API via UpToDate Connect, bring-your-own-license (each user needs a clinician
  subscription), sold by demo request. Not usable for a consumer app today. Note both in docs/MONETIZATION.md as
  "revisit if a consumer licence appears".
- Apple App Review 5.1.1: apps that force sign-in before non-account features risk rejection; apps that offer account
  creation must offer in-app account deletion (5.1.1(v)). Hence the REQUIRE switch below.

## Task 1: Sign-in required (commit "Accounts: sign in required with Apple, Google, Facebook or email")
- New first step of registration (before Stage): "Create your account" with buttons in this order: Continue with
  Apple, Continue with Google, Continue with Facebook, Continue with email. Reuse backend/src/modules/oauth (Apple,
  Google, Facebook flows, return schemes) and src/components/AccountParts.jsx / RegisterScreen.jsx where possible.
- Email: 6-digit one-time code by email. Backend sends via the Resend HTTPS API with fetch (env RESEND_API_KEY,
  EMAIL_FROM); in development (no key) the code is logged to the server console and the app says so in dev only.
  Rate-limit code requests and attempts.
- Server keeps the account record only: account id, provider, email (or Apple relay email), display name if given,
  created date. Never health data. A signed session token (AUTH_SECRET) kept on the device in a device-only key, never
  in a backup. Endpoints: start/verify email code, provider sign-in completion, GET /me, POST sign-out,
  DELETE account (deletes the record server-side). Persist the store under DATA_DIR like the other modules.
- Mount the module in production backend/config/app.json (and render.yaml/.env.example docs). The app turns the
  `signin` feature on by default (src/lib/features.js DEFAULT_FEATURES) when the build has a server.
- REQUIRE switch: build-time VITE_REQUIRE_SIGNIN (default "true"). When true and the server reports at least one
  configured provider, there is no skip. When false, or when the build has no server, or the server reports no
  provider configured, show "Continue without an account" and say plainly why (demo/no server). This keeps the
  public demo usable and gives a one-line fallback if App Review objects.
- Existing users (record already on the device) are asked to sign in once on next launch; their on-device data stays.
- You → Account: who is signed in, Sign out, Delete account (confirm; explains health data on the device is not
  touched unless she also uses Delete everything). Delete everything also deletes the account.
- Update every UI privacy sentence that says no account / anonymous / we don't know who you are, so each stays
  literally true: the server now knows her sign-in email and provider; Facebook/Google/Apple learn she signed in to
  Solia Health. Health logs still never leave the device except the opt-in previewed AI items.
- Docs: PRIVACY-AUDIT.md entry, SPEC section, .env.example (RESEND_API_KEY, EMAIL_FROM, VITE_REQUIRE_SIGNIN, note
  APPLE_*/GOOGLE_*/FACEBOOK_* now needed in production), public/legal drafts: update the privacy policy draft's
  account section so it matches (keep Draft/noindex).
- Tests: unit tests for the backend module (code expiry, attempts, delete), onboarding e2e with a mocked provider,
  axe on the new screens light+dark.

## Task 2: Easy wearable setup (commit "Devices: one place to connect wearables, from onboarding, Home and You")
- One "Connect your devices" sheet reachable from (a) an optional registration step after Cycle/Pregnancy
  ("Connect a device? You can skip"), (b) a dismissible Home card shown until something is connected or she
  dismisses it, (c) You → Data sources (DataSourcesCard) at the top.
- Rows, each with one tap: Apple Health (iPhone app), Health Connect (Android app), Oura, Fitbit / Garmin / Whoop
  (via Terra). Each row says what it reads in plain words and where data goes (on-phone sources: read on the phone,
  never a server; Oura/Terra: pass through Solia Health's server, not kept, as the existing integrations module does
  — verify the wording against backend/src/modules/integrations before writing it).
- In a browser, Apple Health / Health Connect rows say "In the iPhone app" / "In the Android app" instead of a dead
  button. Rows whose server keys are not configured say "Not set up yet" (server reports which are configured).
- Turn `wearables` on in DEFAULT_FEATURES and mount `integrations` in production config; .env.example lists
  OURA_CLIENT_ID/SECRET, TERRA_API_KEY/DEV_ID/SIGNING_SECRET as needed. PRIVACY-AUDIT entry: the pass-through is now
  on by default (owner decision 2026-11-12); flag that the earlier privacy-review recommendation still stands.
- Connected state shows on each row (Connected · last sync in words) with Disconnect.
- Tests + axe.

## Task 3: Pro = evidence-based AI; practices free, with voice (commit "Pro: evidence-based answers with sources; all practices free with voice guidance")
- Every Mind practice becomes free (mind.js free:true for all; remove fullPractices from PRO_PLAN/plan gating and
  any Pro chip on practices). Update ProSheet, PLAN_COPY, MONETIZATION.md.
- Voice guidance, free, on the device: an optional "Voice guide" switch on the practice sheet that speaks each step
  with the browser's speechSynthesis (works in the iOS/Android web views); calm rate (~0.9), picks an en voice,
  respects a remembered on/off (device-only key), stops on close/pause. Breathing practices speak short cues
  ("Breathe in… and out") timed to the existing visual. If speechSynthesis is missing, the switch is not shown.
  Honest copy: no claim of recorded/human voices.
- Pro "Ask with evidence": backend POST /api/ai/evidence. Uses the @anthropic-ai/sdk already installed, model from
  config (claude-opus-5-5), with the server web search tool:
    { type: "web_search_20260209", name: "web_search", max_uses: 5,
      allowed_domains: ["pubmed.ncbi.nlm.nih.gov","ncbi.nlm.nih.gov","medlineplus.gov","nih.gov","cdc.gov",
        "acog.org","who.int","nice.org.uk","cochranelibrary.com","endocrine.org","fda.gov"] }
  Answers carry citations (text blocks' `citations` of type web_search_result_location: url, title, cited_text);
  return { answer, sources:[{title,url}] } and show numbered source links. System prompt: plain language, cite every
  medical claim, say when evidence is weak or mixed, guidance not diagnosis, never dosing advice, suggest asking a
  clinician, never contraception claims. Do NOT pass `thinking:{type:"disabled"}` (400 on this model); set
  output_config effort "medium". Check stop_reason "refusal" and handle; consider betas
  ["server-side-fallback-2026-07-01"] with fallbacks "default" if the installed SDK accepts it (beta client), else skip.
  Server-tool errors arrive as a result block with an error object, not an exception — handle that.
- Privacy: only her typed question is sent (plus, if she ticks it, the existing pseudonymized summary, previewed
  verbatim as today). Preview screen "What Solia Health will send" before every send. Red flags are answered on the
  device with the existing urgent guidance and never forwarded (reuse existing rule). Nothing logged or stored on
  the server. Disclose that the question goes to Anthropic and its search provider runs the search.
- Gate with plan can("aiEvidence") (Pro), also needs the ai flag + server. Where: Mind → Ask (or wherever Ask lives)
  and Patterns. Rate limit per minute as the ai module does.
- Update ProSheet to lead with: Ask with evidence (sources from PubMed, MedlinePlus, CDC, NIH, ACOG, WHO, NICE…),
  weekly write-up, chat about your log, encrypted backup. Copy must be literally true.
- backend smoke script with a mocked Anthropic base URL (ai-smoke pattern) covering citations, refusal, tool error.
- Docs: PRIVACY-AUDIT, MONETIZATION (OpenEvidence/UpToDate note), CLINICIAN-REVIEW entry for the system prompt.

## Verification before each final amend
npm run lint (0 errors), unit tests, backend smoke:all, npm run build (stamp "BUILD 2026.10.07-D" renders once),
npm run e2e and npm run e2e:axe (0 violations). Never run `playwright install`; the browser is preinstalled.
Push the branch: git push -u origin feature/account-wearables-evidence.
Commit author: git -c user.name="Aria" -c user.email="aria23@gmail.com". End each commit message with:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HHP8o69cmnMvBZyGdDsuZF
