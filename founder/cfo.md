# CFO's note: Cyra Health

**Not financial, tax or legal advice.** An accountant should check the business structure, any payroll and the sales tax on app sales before money moves. App-store prices include tax in many countries; Apple and Google collect and pay it, so the revenue below is before their deductions.

**Most inputs are estimates.** Only you know your budget and whether you will pay yourself. The tool's sources are in `cfo-sources.md`. Change `numbers.json` and re-run when you have the real figures.

## The margin
- Each $7.99 Appointment Pack leaves **$6.49 (81%)** after the 15% store commission ($1.20) and an estimated $0.30 of AI cost.
- Running costs are about **$18 a month** (hosting, the Apple developer fee, the domain). That figure assumes nobody is paid.
- On those inputs, break-even is **1 pack a day**, and the plan of 3 a day keeps **79%** of every sale.

## The line to watch: your own pay, then volume
- **If you pay yourself $3,000 a month:**
  - Break-even jumps to **16 packs a day**, about 480 a month.
  - Year 1 loses **$34,233**.
  - You would need **$38,558** before it pays for itself.
  - That is the real business question: Cyra is cheap to run but needs hundreds of paying women a month to replace a salary.
- **If volume comes in at half the plan:** year 1 operating profit falls from $1,767 to **$774**, and the cash needed barely moves ($4,370). At $0 salary, slow sales hurt little because costs are tiny.
- The volume ramp is a guess. The buyer panel had **0 of 20** buying in month one, and 18 of 20 said they would pay $7.99 only after a free summary helped at an appointment. So the ramp starts at zero for two months, then grows slowly.
- Plan volume (3 packs a day = 90 a month) is not proven by anything yet. The landing-page test in `pricing.md` is the first real number.

## Cash
- **$4,362** before it pays for itself, almost all of it one-off:
  - clinician review, about $1,500 (estimate)
  - lawyer review, about $2,500 (estimate)
  - a $300 landing-page test (estimate)
  - the $25 Google Play fee
- Year 1 earns back about $1,767 of it. **The startup spend is not recovered within year 1** at this plan.

## Three ways to improve the margin (each run through the tool)
1. **Sell the yearly plan to heavy users.** Each $29.99 subscription leaves $21.89 (73%), using an estimated $3.60 a year for AI, versus $6.49 per pack. One yearly subscriber is worth about 3.4 packs. Push it to users who are still logging after the first month.
2. **Do not lead with the $3.99 monthly plan.**
   - At $3.99 a unit leaves $2.49 (62%).
   - At the same volume, year 1 operating profit falls from $1,767 to $543.
   - Keep monthly available, but price it so the yearly plan is the obvious choice. A lower monthly price only works if it sells more than twice as many units.
3. **Cut the startup spend before cutting the price.**
   - Clinician and lawyer reviews are 92% of the cash needed ($4,000 of $4,325).
   - Get fixed quotes. Ask a clinician partner to review in exchange for credit, or through a university clinic or PCOS charity.
   - Every $1,000 saved is about 154 fewer packs to earn back.

## The board's money conditions (`board.md`)
- [ ] **Measured acquisition cost:** not met. No channel has been tested. Nothing above includes paying for users; any ad spend comes straight off the $6.49 per pack.
- [ ] **Pro around one outcome, with a guarantee the CFO can afford:** met on paper. "First summary free" costs nothing at the margin because it runs on the phone. Its real cost is the women who never pay, which only the pilot will show.
- [ ] **Price validated before setting it:** not met. Simulated answers only. Run the $2.99/$4.99 page test and the $7.99 pack-only version.
- [ ] **Store fees and AI cost known:** store fees are known (15%). AI cost is an estimate; check it against real usage once `ANTHROPIC_API_KEY` is live.

# Unit economics: Cyra Health (Appointment-Ready offer)

Every number below comes from the input file. Nothing is looked up or guessed.

## One paid Appointment Pack (30 days of Pro around one appointment)

| line | per paid Appointment Pack (30 days of Pro around one appointment) |
| --- | ---: |
| Price | $7.99 |
| App store commission, 15% (Apple Small Business Program / Google Play subscriptions) | -$1.20 |
| AI write-up + chat for 30 days (ESTIMATE, only if she turns AI on) | -$0.30 |
| **Contribution** (what each paid Appointment Pack (30 days of Pro around one appointment) leaves to pay the fixed costs) | **$6.49** (81%) |

## The margin that matters

Fixed costs: $18 a month (Backend hosting on Render, one web service (ESTIMATE from Render's paid tier) $7, Apple Developer Program, $99/yr spread monthly $8, Domain + email (ESTIMATE) $3, Founder pay (ZERO until the founder says otherwise) $0).

- **Break-even: 1 paid Appointment Pack (30 days of Pro around one appointment)s a day.** Below that you lose money every month.
- **Profit margin at your plan** (3 a day): **79%** of every sale, after every cost.

## Year 1, month by month

| month | paid Appointment Pack (30 days of Pro around one appointment)s a day | revenue | profit | cumulative (after $4,325 startup) |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | $0 | -$18 | -$4,343 |
| 2 | 0 | $0 | -$18 | -$4,362 |
| 3 | 0 | $24 | $1 | -$4,360 |
| 4 | 0 | $48 | $21 | -$4,340 |
| 5 | 0 | $72 | $40 | -$4,299 |
| 6 | 0 | $120 | $79 | -$4,220 |
| 7 | 1 | $168 | $118 | -$4,102 |
| 8 | 1 | $240 | $176 | -$3,926 |
| 9 | 1 | $312 | $235 | -$3,691 |
| 10 | 2 | $384 | $293 | -$3,398 |
| 11 | 2 | $479 | $371 | -$3,027 |
| 12 | 2 | $599 | $468 | -$2,558 |

- **Year 1 operating profit: $1,767** on $2,445 of revenue.
- After the $4,325 startup spend: -$2,558.
- Startup money earned back: not within year 1.
- Cash you need before it pays for itself: **$4,362**.

## What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 79% | 1 | $1,767 |
| Price -10% | 76% | 1 | $1,522 |
| Volume -20% | 78% | 1 | $1,370 |
| Unit costs +15% | 76% | 1 | $1,698 |

## Red flags

- The startup spend is not earned back within year 1.
