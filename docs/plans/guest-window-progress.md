# Progress: a 48-hour guest window, then sign-in

Brief: docs/plans/guest-window.md. Branch feature/guest-window (worked on in the worktree /home/user/cyra-guest).
One task, one commit title (WIP first, a final commit after verification; no amend / force-push). Push after each commit.

## Task: "Accounts: a 48-hour guest window, then sign-in to keep going"
- [x] lib/guest.js: GUEST_HOURS / VITE_GUEST_HOURS, window maths with max(now, guestSeen), guestState, restore rule, copy
- [x] record keys: guestStart (record, in backups), guestSeen + guestNote (device-only, never in a backup)
- [x] lib/signin.js gateNeeded takes the guest state; App.jsx: state, clock, restore, adoptSession ends the window
- [x] SignInStep "Try it first" + the story line; SignInGate guest wording with backup / restore / delete; GuestCreateSheet
- [x] Home guest line (first Home visit of a day, Hide for today), You → Account guest card, AI "Create an account to use this"
- [ ] unit tests (guest.test.mjs, signin / record additions)
- [ ] e2e/guest.spec.mjs + guest-axe.spec.mjs (light + dark)
- [ ] docs: .env.example, render.yaml, PRIVACY-AUDIT, SPEC, privacy.html, App Review note; grep for sentences made false
- [ ] verification: lint, unit, backend test + smoke:all, build stamp, e2e, axe -> final commit
- Commits: (WIP below)
