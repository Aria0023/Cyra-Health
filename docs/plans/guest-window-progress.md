# Progress: a 48-hour guest window, then sign-in

Brief: docs/plans/guest-window.md. Branch feature/guest-window (worked on in the worktree /home/user/cyra-guest).
One task, one commit title (WIP first, a final commit after verification; no amend / force-push). Push after each commit.

## Task: "Accounts: a 48-hour guest window, then sign-in to keep going"
- [x] lib/guest.js: GUEST_HOURS / VITE_GUEST_HOURS, window maths with max(now, guestSeen), guestState, restore rule, copy
- [x] record keys: guestStart (record, in backups), guestSeen + guestNote (device-only, never in a backup)
- [x] lib/signin.js gateNeeded takes the guest state; App.jsx: state, clock, restore, adoptSession ends the window
- [x] SignInStep "Try it first" + the story line; SignInGate guest wording with backup / restore / delete; GuestCreateSheet
- [x] Home guest line (first Home visit of a day, Hide for today), You → Account guest card, AI "Create an account to use this"
- [x] unit tests: src/lib/guest.test.mjs (window maths, clock moved back, restore keeps the start, modes, copy per build), record + disclosures pins
- [x] e2e/guest.spec.mjs (4) + guest-axe.spec.mjs (light + dark); e2e/lib/onboard.mjs signin: "guest" and resume
- [x] docs: .env.example + render.yaml (VITE_GUEST_HOURS), SPEC A11.2, PRIVACY-AUDIT "The guest window" (with the App Review 5.1.1 note), privacy.html + terms.html drafts
- [x] sentences checked (src/, public/legal/): terms §6 "before you use it" rewritten; "What a restore changes" gains the guest sentence; comments that said "no skip"
- [x] verified: lint 0 errors (23 warnings), unit 678/678, backend 52/52, smoke:all all passed, build stamp once, e2e 56/56, axe 40/40 -> final commit
- Decisions: signing in ends the guest window for good (guestStart cleared), so a later sign-out shows "Sign in to keep going" as before;
  a restore keeps the earlier start; the gate appears on the next open (launch or back to the front), never mid-task;
  where the free-week gate is off the story reads "2 days as a guest, then a free account to keep going." (no "7 days", no Pro);
  VITE_GUEST_HOURS is capped at 168.
- Commits: 0c09535 (WIP), the second WIP (tests), then the final commit after this note
