# Launch plan: Cyra Appointment-Ready

**Target public launch: Tuesday 26 January 2027.** That is the earliest realistic date given the lead times in `ops.md`:
- choosing the name and checking it with a lawyer
- clinician and legal review (about 2–4 weeks each, run in parallel)
- setting up the company and Apple organisation accounts (up to about 2 weeks)
- the build list in `offer.md` (about 4–6 weeks for one founder)
- a 6-week real-user pilot

No date has been given by the founder. Move everything if you pick another one.

Owner of every task: the founder (F), unless a contractor is named.

## 1. Test before you spend

Two real tests come before the $4,000 of review costs in `numbers.json` is committed.

**Test A: waitlist price test** (runs 9 Nov to 29 Nov 2026)
- A landing page under the final name, with three variants split evenly:
  - A: Pro at $2.99 a month
  - B: Pro at $4.99 a month
  - C: the $7.99 Appointment Pack only
- Each variant has the same "Join the waitlist" button and an optional question: "When is your next PCOS appointment?"
- Traffic: PCOS communities (with moderator permission) and founder videos, plus the $300 test budget (`marketing.md`).
- **Success line, written before running it:**
  - at least 600 page views in total;
  - a waitlist sign-up rate of 5% or more on the best variant;
  - at least 40 sign-ups who give an appointment date within 90 days.
- **Compare with the panel.**
  - The panel had 0 of 20 buying up front and 18 of 20 naming the appointment as their trigger. Sign-ups are not purchases, so this tests interest and the appointment hypothesis, not the buy rate.
  - If the best variant comes in under 2%, go back to `/founder-offer`. If C beats A and B, lead with the pack.

**Test B: pilot** (runs 7 Dec 2026 to 17 Jan 2027, 6 weeks)
- 20–30 women from the waitlist who have an appointment within the 6 weeks.
- They get the app through TestFlight, Google Play internal testing or the web, with the build-list features in.
- After their appointment, ask three questions:
  1. Did you show the summary?
  2. Did the clinician use it, or change anything?
  3. Would you pay $7.99 for the next one? If yes, they are offered the founding pack.
- **Success line:** at least 50% show the summary, at least 30% say it changed the conversation, and at least 5 people pay. Real money or a firm pre-order, not "would".
- If fewer than 5 pay, do not launch publicly on 26 January. Rework the offer with what the pilot users said.
- Anything they agree to be quoted on becomes the first real testimonial. Ask for written consent; no health details.

## 2. The countdown (weekly blocks; ★ = critical path)

| week of | task | owner | deadline |
| --- | --- | --- | --- |
| **2 Nov** | ★ Choose the name from the `brand.md` shortlist; book a trademark lawyer search (classes 9, 42, 44) | F + lawyer | Fri 6 Nov |
| 2 Nov | Ask 3 clinicians and 2 lawyers for fixed-fee quotes; update `numbers.json` and re-run `/founder-cfo` | F | Fri 6 Nov |
| 2 Nov | Register the domain and handles under the chosen name | F | Fri 6 Nov |
| **9 Nov** | ★ Form an LLC, get an EIN, open a business bank account, apply for a D-U-N-S number | F | Fri 13 Nov |
| 9 Nov | Landing page plus the three price variants live; Test A starts | F | Mon 9 Nov |
| 9 Nov | ★ Clinician review starts (`docs/CLINICIAN-REVIEW.md`, `docs/EVIDENCE.md`, the questions list) | clinician | 4 Dec |
| 9 Nov | ★ Build: treatment check, 3-tap default log | F | Fri 20 Nov |
| **16 Nov** | ★ Legal review starts: privacy policy, terms, health-data state laws, FTC breach rule | lawyer | 4 Dec |
| 16 Nov | Apple Developer (organisation) and Google Play accounts | F | Fri 27 Nov |
| **23 Nov** | ★ Build: week-one baseline, questions list (pending clinician sign-off), the Appointment Pack purchase, "first summary free" | F | Fri 4 Dec |
| 23 Nov | Rename the app's visible name if the name changed (store listing, splash, icon) | F | Fri 4 Dec |
| 30 Nov | Test A ends (29 Nov): read the results against the success line; choose the price | F | Tue 1 Dec |
| 30 Nov | Apply clinician and legal changes; set `ANTHROPIC_API_KEY` and a spend limit on Render | F | Fri 4 Dec |
| **7 Dec** | ★ Pilot starts (soft open): TestFlight and internal testing for 20–30 waitlist users | F | Mon 7 Dec |
| 14 Dec | Clinic cards designed and checked by the clinician; ask 10 clinics | F | Fri 18 Dec |
| 21 Dec | Holiday weeks: support pilot users only; no new features | F | — |
| **4 Jan** | ★ Pilot exit interviews as appointments happen; collect consented quotes | F | 17 Jan |
| 4 Jan | Store listings written: privacy labels, screenshots of the summary with demo data, "not a diagnosis" first | F | Fri 8 Jan |
| **11 Jan** | ★ Go / no-go against the pilot success line (Mon 18 Jan at the latest) | F | Mon 18 Jan |
| 12 Jan | **Marketing calendar starts (L-14)** if go | F | Tue 12 Jan |
| 12 Jan | Submit store builds for review (allow a week and a resubmission) | F | Tue 12 Jan |
| 19 Jan | Store approvals in; founding-member offer configured, ending Thu 25 Feb 2027 | F | Fri 22 Jan |
| **26 Jan** | **Public launch** | F | Tue 26 Jan |

**Critical path:** name and trademark, company and Apple accounts, clinician and legal review, the build list, the pilot, then go / no-go, store review, launch. Any slip in the clinician review or the store review moves the launch date one for one.

## 3. Launch day run sheet (Tue 26 Jan 2027, your time zone)

| time | what | channel |
| --- | --- | --- |
| 07:00 | Check the backend, the AI status and the store listings are live; check the build stamp on the web | Render, App Store Connect, Play Console |
| 08:00 | Waitlist email: "It's live." Links, the founding offer and its end date (25 Feb) | email |
| 09:00 | Founder video: the first summary, with demo data | TikTok, Reels |
| 10:00 | Community posts where moderators allowed them | r/PCOS etc. |
| 11:00–17:00 | Answer every comment, email and review within 2 hours | all |
| 13:00 | Clinic follow-ups: "We're live, cards attached" | email |
| 18:00 | Note the numbers: installs, first summaries started (from the opt-in pilot cohort only), packs bought, any crash reports from the stores | dashboards |
| any time | **If something breaks:** follow the risk register in `ops.md`. AI fails: the app already says so, and the core still works. Store rejection: fix and resubmit, push the email back a day. Privacy bug: follow the incident routine and switch the flag off first. | — |

## 4. The first 30 days

**Tracked weekly** (break-even comes from `cfo.md`; it is about 1 pack a day at $0 founder pay, or 16 a day with $3,000 a month of pay):

| number | target | trigger to change something |
| --- | --- | --- |
| Packs bought per day | ≥ 1 (break-even on running costs) | under 0.3 a day by day 30 |
| Waitlist to install | ≥ 40% | under 20%: the store listing isn't converting |
| Women with a first summary who buy a pack within 60 days | ≥ 10% | under 5%: talk to 10 users before spending |
| Anthropic spend vs. limit | under the limit | any spike: cap usage per user |
| Support replies under 24 hours | 100% | any miss: reduce content work |

**Reviews**
- **Day 7 (2 Feb):**
  - Are installs coming from the channels we expected?
  - Is anyone stuck in onboarding?
  - Is any privacy or crash issue showing?
- **Day 14 (9 Feb):**
  - Are first summaries happening within 7 days?
  - Which hook gets the most clicks?
  - Should the creator test ($100) go ahead?
- **Day 30 (25 Feb, the founding offer ends):**
  - Packs per day against break-even.
  - Founding members bought.
  - The paid conversion rate against the panel's simulated 18/20 "would pay after it helps". **Trust the real number.**
  - Decide between three paths: keep going on this channel mix; rework the offer (`/founder-offer`); or move to clinician distribution as the main channel.
