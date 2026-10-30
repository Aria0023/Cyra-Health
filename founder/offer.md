# The offer: Cyra Appointment-Ready

Method: the Offers lens (a summary of a published offer framework; not anyone's own words).
Inputs:
- Panel: 0 of 20 bought the v1 pitch (`panel/results.md`).
- Competitor complaints (`competitors.md`).
- The board's conditions (`board.md`).
- No `numbers.json` yet. Costs below are rated 1–5 from what the product already does; the CFO step has to confirm them.

## 1. The problem list (in the buyer's words, from the panel and competitor complaints)

Before buying:
1. "The free version already does what I need."
2. "I don't pay for apps, period" and "Not monthly."
3. "I'm not paying to send my log to an AI."
4. "Who is the AI provider, and do they keep it?"
5. "Privacy promises are just marketing claims."
6. "Predictions never work for my irregular cycles."
7. "Every app paywalls the useful part and keeps upselling me" (competitor complaint #1).
8. "Is this a weight-loss app in disguise?"
9. "Breathing exercises don't help with trying to conceive."
10. "Nothing says which guidelines the patterns are based on."

While using it:

11. "I've quit every tracker within a few weeks; logging is homework."
12. "An AI write-up of a half-empty log is worth nothing."
13. "It takes months before irregular cycles show anything."
14. "I can't tell if metformin or inositol is doing anything."
15. "I want it to fill itself in from my phone or watch."

At the appointment:

16. "An app won't change what my doctor does."
17. "I keep forgetting what happened between visits."
18. "I want my doctor to take me seriously and order the right tests."
19. "I want something my OB or fertility specialist will actually use."

After:

20. "Will I keep paying for nothing between appointments?"
21. "If I cancel, do I lose my record?"

## 2. Solutions, scored (value to her 1–5 · cost to deliver 1–5, 1 = cheap)

| # | solution | answers | value | cost | keep? |
| --- | --- | --- | ---: | ---: | --- |
| A | **Appointment summary**: one page for the clinician built on her phone. Covers cycle lengths, symptom trends, her typed lab values, and what changed since her last visit. | 1, 16, 17, 19 | 5 | 1 (the PDF engine exists) | core |
| B | **Treatment check**: before and after starting a medicine or supplement (metformin, inositol, the pill), showing cycle length and symptom days. Worded as "here is what changed in your log", never "it works". | 14, 16 | 5 | 2 (data exists; needs a comparison view) | core |
| C | **Questions to bring**: a short list drawn from the 2023 international PCOS guideline's assessment topics. Each item is cited and phrased "you could ask about…". It never says "you need test X". | 10, 18 | 4 | 2 (copy plus clinician review) | core |
| D | **Works without AI**: A to C run fully on the phone. The AI write-up is an optional extra, off by default, previewed before every send. | 3, 4, 5 | 5 | 1 (already true of the build) | bonus 1 |
| E | **First summary free**: the first appointment summary is free. Pay only for the next one or for continuous Pro. | 1, 2, 7, 20 | 5 | 1 (no marginal cost; it runs on her phone) | guarantee |
| F | **Pay per appointment**: $7.99 one-time for 30 days of Pro around a visit, as an alternative to a subscription. | 2, 20 | 4 | 1 | rung |
| G | **10-second log**: a 3-tap default (flow, top symptom, energy). Everything else optional. | 11, 12 | 4 | 2 (product work) | bonus 2 |
| H | **Useful in week one**: a "first 7 days" baseline card, so there is something to show before any cycle pattern exists. | 12, 13 | 4 | 2 | bonus 3 |
| I | **No-weight promise**: weight is off by default, never on Home, never charted. Stated in the store listing. | 8 | 3 | 1 (already true) | message |
| J | **Keep your record**: export, the PDF and the free core stay free forever, even after cancelling. | 21 | 4 | 1 (already true) | message |
| K | Apple Health / Health Connect import of sleep and steps | 15 | 4 | 4 (new native work) | later |
| L | Independent privacy audit | 5 | 4 | 4 (paid third party) | later, before paid ads |
| M | Trying-to-conceive ovulation-range pack | 9, 19 | 4 | 4 (clinical review needed) | later |
| N | Run the AI on the phone | 3 | 3 | 5 | no |

## 3. The stack

**Name: Cyra Appointment-Ready**

**Core** (described by the outcome):
- *Walk into your next PCOS appointment with a one-page picture your clinician can read in a minute.* That page shows what your cycles did, what your symptoms did, and what changed since you started treatment. It comes with the questions worth asking.
- Built on your phone (A, B, C).

**Bonuses**, each aimed at one objection:
1. **No AI required** (D). The summary, the treatment check and the questions never leave your phone. The AI write-up is optional and previewed before every send. *Kills "I won't send my log to an AI."*
2. **The 10-second log** (G). Three taps a day is enough to build the summary. *Kills "logging is homework."*
3. **Your first-week baseline** (H). Something to show at your appointment even if you only started this week. *Kills "it takes months."*

**Guarantee: your first appointment summary is free** (E). See it before paying anything.
- Cost: zero marginal cost, because it runs on her phone. The only cost is revenue from women who stop after one free summary.
- The CFO has to model that conversion. Store refunds are handled by Apple and Google, so Cyra does not promise a refund of its own.

**Urgency (true):** founding-member yearly price of $19.99, locked in. Limited to the first 1,000 subscribers or launch month, whichever comes first (from `pricing.md`). No countdown timers and no "only N left" unless the counter is real.

**Prices:**
- Free core forever.
- Appointment Pack: $7.99 one-time.
- Pro: $3.99 a month or $29.99 a year.

**Must be built before this offer can be sold** (it is not deliverable today):
- B, the treatment check;
- C, the cited questions list, after clinician review;
- G, the 3-tap default log;
- H, the week-one baseline;
- the Appointment Pack purchase;
- "first summary free" gating.

A, D, I and J are true of the build today.

## 4. Value equation (1–10, before → after)

| element | v1 pitch | Appointment-Ready | what moves it |
| --- | ---: | ---: | --- |
| Dream outcome | 4 | 8 | The core is now "taken seriously at the appointment" plus "is my treatment working", not "AI write-up and breathing practices". |
| Perceived likelihood | 3 | 6 | Guideline-cited questions, no AI required, and the free first summary she can judge herself. Still no real proof: there is no clinician sign-off or pilot yet. |
| Time to result | 3 | 6 | The week-one baseline, and the summary tied to her next appointment date. |
| Effort and sacrifice | 4 | 7 | The 3-tap log, nothing to pay up front, and no data leaving the phone. |

## 5. Re-test (same 20 buyers, same seeded cards)

The re-test showed the same 20 buyers (same seed and cards) the new pitch. Full results are in `founder/panel-v2/results.md`.

| | v1 pitch | Appointment-Ready |
| --- | ---: | ---: |
| Buy in the first month | 0 / 20 | 0 / 20 |
| Name a paid trigger they would act on ("would pay $7.99 / once") | 3 / 20 | **18 / 20** |
| Reason: trust (AI, data leaving the phone) | 5 | 3 |
| Reason: need (the free tier covers it) | 7 | 6 |
| Reason: habit (will quit logging) | 5 | 5 |
| Reason: price | 3 | 5 |
| Price range (simulated) | $1.02 to $5.99 | $1.02 to $5.99; bargain point $3.00 |

**What moved**
- The objection to the AI feature mostly disappeared. Buyers called out "the AI write-up is off by default" and "weight is off by default" as reasons they would install.
- The deciding question changed. Buyers stopped asking "why pay at all?" and started saying "I'll pay $7.99 before my next appointment if the free summary gets my doctor to act." 18 of 20 named that exact trigger.

**What did not move**
- Nobody pays in month one. The offer itself causes part of this: the first summary is free, and most buyers have no appointment booked yet.
- Habit is unchanged. Five buyers still expect to stop logging, even at three taps a day.
- Price sensitivity is high. Buyers in this panel mostly earn under $41k, and the panel's design assumes buyers tend to say yes, which makes these answers optimistic.

**Reading it**
- The offer did not fail. It moved the purchase to the appointment.
- Revenue follows appointments, not days, so the paid product is the **Appointment Pack**, and Pro is the upgrade for heavy users.
- The real-world test that matters is whether a free summary changes what happens at an appointment. Only a pilot with real users and clinicians can answer that.

**Still unresolved**
- Trust in the "runs on your phone" claim. Three buyers asked for a published independent audit or open source.
- Trying-to-conceive users want fertility-specific help (Selin, Farah). That is item M, deferred.
