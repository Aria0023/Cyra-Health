# Owner request, 2026-11-16: anonymous for a limited time, then sign-in; 7 free days with saving

Owner's words: "i would say annoymous for limited time, like 24-48hrs? then require registering login? 7 days which
you can save etc."

Decision recorded: a 48-hour guest window, then sign-in is required; the existing 7-day free week (with saving,
lib/trial.js) is unchanged and keeps counting from the day she finished registering.

Branch: feature/guest-window (from main 4fa87fd). ONE task, ONE commit (WIP first, then a final commit after
verification; never amend + force-push). Progress note: docs/plans/guest-window-progress.md; push after each commit.
Never push/merge main, no PR, never `playwright install`, no new npm dependencies. Read CLAUDE.md first.

## Behaviour (commit "Accounts: a 48-hour guest window, then sign-in to keep going")
Timeline for a new user where sign-in works (lib/signin.js mode "required"):
- Hour 0-48 (guest): the "Create your account" step offers the sign-in buttons AND "Try it first" (a real skip). She
  uses the whole app with saving. A quiet line on Home/You (not a nag, at most once a day, dismissible for the day):
  "You're trying Solia Health as a guest. Create an account by <weekday, time> to keep going." with "Create account".
- After 48 hours: the existing one-time sign-in gate (gateNeeded in lib/signin.js, used today for existing records)
  appears on next open: "Your 2 guest days are up. Sign in to keep going. Everything you logged is still on this
  device." Sign-in buttons, Apple first. No skip. The gate MUST still let her (a) save an encrypted backup / export
  and (b) delete everything, without signing in (never lock a person out of her own data); reuse existing flows.
  After sign-in she lands exactly where she was, nothing lost.
- Days 0-7: the free week (lib/trial.js) is unchanged: saving is free for 7 days from registration; after that Pro is
  needed to keep logging, only where she can actually pay. Make the copy tell the whole story once, on the sign-in
  step and in the guest line: "2 days as a guest, 7 days free in all, then Pro if you want to keep logging."
  (Only say the Pro part in builds where the trial gate is on; keep every sentence literally true per build.)
Rules:
- Guest window = GUEST_HOURS (48), from a device-stored start time `guestStart` (ISO timestamp set when she first
  taps "Try it first"; kept in the record AND in encrypted backups so a restore doesn't restart it; a clock moved back
  never extends it: use max(now, lastSeen) with a device-only lastSeen stamp). Build-time override VITE_GUEST_HOURS
  (0 = no guest window, sign-in first as today; default 48). Document in .env.example and render.yaml.
- Applies only in mode "required". Modes none/unset/optional/checking/offline behave as today (the public demo with no
  server stays open with "Continue for now"; if the server can't be reached after the window, the app opens as today
  rather than locking her out, and asks again when it can).
- Existing records created before this change with no guestStart and no account: treated as today (asked once on next
  launch when required).
- Pro's AI already needs sign-in; guest users see "Create an account to use this" there.
- App Review note in docs (5.1.1: forcing sign-in for non-account features risks rejection; the guest window softens
  it; VITE_REQUIRE_SIGNIN=false remains the fallback).
- Update every privacy/UI sentence so it stays true (guest: the server knows nothing about her; signed in: as today).
  PRIVACY-AUDIT entry, SPEC section, privacy.html draft.
- Tests: unit (window maths, clock moved back, restore keeps start, modes), e2e with the mocked API (try first ->
  guest line -> advance clock 49h -> gate with backup/delete available -> sign in -> back in the app with data), axe
  light/dark on the new states.

## Verification
npm run lint (0 errors), npm run test:unit, cd backend && npm test && npm run smoke:all, npm run build (stamp once),
npm run e2e -- --trace off, npm run e2e:axe -- --trace off (0 violations).
Author: git -c user.name="Aria" -c user.email="aria23@gmail.com". Trailer lines:
Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HHP8o69cmnMvBZyGdDsuZF
