# Cyra Health · Business plan

**Verdict: Not yet**

- ✓ Each paid Appointment Pack (30 days of Pro around one appointment) earns $6.49 before fixed costs (81% contribution).
- ✓ Year 1 operating profit: $1,767.
- ✗ 0 of 20 simulated buyers buy (0%, the bar is 25%).

| key number | |
| --- | ---: |
| Price | $7.99 a paid Appointment Pack (30 days of Pro around one appointment) |
| Profit margin at plan | 79% per paid Appointment Pack (30 days of Pro around one appointment) |
| Break-even | 1 paid Appointment Pack (30 days of Pro around one appointment)s a day |
| Year 1 operating profit | $1,767 |
| Startup spend | $4,325 |
| Cash needed before it pays for itself | $4,362 |
| Startup money earned back | not in year 1 |
| Buyer panel | 0 buy · 20 pass |

## The idea

- What it is: a calm, privacy-first women's health companion app for logging irregular cycles and symptoms and seeing honest patterns to take to a clinician; positioned first for women with PCOS.
- Who it is for: women with PCOS (diagnosed or suspected) and irregular cycles, first; the same app serves periods/PMS, trying to conceive, pregnancy, perimenopause and menopause (one life-stage experience per user), with optional condition modules (PCOS and POTS built; hair loss planned).
- What it sells, at what price: free core forever (fast logging of cycle, symptoms, sleep, movement, mood and meds; irregular-cycle predictions with ranges; calendar; word-based pattern insights; weekly review with one optional experiment; evidence-cited breathing and grounding practices; free doctor-ready PDF). Pro subscription, store-priced, PRICE NOT YET SET (to be found by /founder-pricing): Claude-powered weekly write-up and chat grounded in her own log (only a previewed, pseudonymized summary is sent), full practice library, custom experiments, medication reminders, richer PDF, optional end-to-end-encrypted account backup. Later: condition modules sold as add-ons (DTC verticals such as PCOS and hair loss).
- Where and how: online; iOS and Android apps (Capacitor shells built, not yet in the stores) and an installable web app live at cyra-health.onrender.com. How customers find it: not yet decided (no marketing yet). Delivered as software; data stays on the phone.
- Budget and constraints: solo founder; budget NOT STATED (open question for /founder-cfo). Already decided: local-first storage (health data never leaves the device except the opt-in, previewed AI summary), no ads or third-party analytics SDKs, never sell or license health data, guest use without an account, basic doctor PDF stays free, not a medical device (guidance, not diagnosis). Product is built and tested; no users and no revenue yet. Still needed before launch: clinician review of medical wording, counsel review of legal texts, App Store / Google Play accounts and store billing, ANTHROPIC_API_KEY on the backend.

## Summary

**Verdict: Not yet.**

**What has to change: prove that women will pay.**
- 0 of 20 simulated buyers paid in month one, on both the original pitch and the Appointment-Ready offer.
- On the new offer, 18 of 20 said they would pay $7.99 *before their next appointment* if the free summary helped.
- That is a hypothesis about real appointments, not a result. The pilot in `launch.md` tests it: 20–30 real women with an upcoming appointment, success at five or more real payments.
- If it fails, go back to `/founder-offer` with what they say.

**What Cyra is.** A private PCOS and irregular-cycle log that turns what happened between visits into a one-page summary a clinician can read in a minute. It is for women with diagnosed or suspected PCOS who feel brushed off at appointments. Everything stays on the phone.

**The three numbers** (inputs mostly estimates; see `cfo-sources.md`):

| number | value |
| --- | --- |
| Margin per $7.99 Appointment Pack | $6.49 kept (81%) after the 15% store fee and an estimated AI cost |
| Break-even | 1 pack a day with no founder pay; **16 a day if the founder pays herself $3,000 a month** |
| Year 1 | $1,767 operating profit on $2,445 revenue; −$2,558 after $4,325 startup spend; not earned back in year 1 |

**Where the board and the buyers agree:**
- The free doctor PDF is the reason to download.
- Pro as first pitched (AI write-up plus practices) gave buyers no reason to pay.
- Data leaving the phone is a dealbreaker unless it is optional and visible.
- Launch narrowly on PCOS.

**Where they disagree:** the board values privacy anywhere from "the moat" to "just risk reduction". Buyers treat it as necessary but not enough: several want an independent audit before they believe it.

**Biggest risks**
1. **Women use the free summary and never pay.** Mitigation: the pilot measures it before money is spent on growth.
2. **The name.** An app called "Cyra – PCOS & Cycle Tracker" is already in the App Store. Mitigation: pick a replacement and get a lawyer's check before the waitlist goes live (`brand.md`).

**What's needed to start:**
- About **$4,362** in cash, mostly clinician and legal review (estimates; get quotes).
- The first real test is the waitlist price test, 9–29 Nov 2026 (`launch.md`).

**This week:**
- **Choose the name and book the trademark search.** Everything public (domain, waitlist, store listing) waits on it.
- Ask three clinicians and two lawyers for fixed-fee quotes.

*The panel is simulated buyers, and every number is a projection. Real customers and real quotes confirm them. This is not financial, legal or tax advice.*

## What the board said

**Vote: 3 FUND IF, 0 FUND, 0 PASS. Average score 4.7 / 10** (Offers 4, Monopoly 4, Product 6).

No member would fund Cyra as pitched. All three would fund a narrower version with proof attached.

### Risks raised by more than one member (most dangerous first)
1. **No focus.** All three: the pitch spans PCOS, five life stages, POTS, hair loss and future verticals. The app keeps one experience per user, but the company and its marketing are spread across several markets with one founder.
2. **No distribution.** Offers and Monopoly: nobody knows how the first 100 users arrive or what each costs. The privacy stance (no ad-tracking SDKs) makes paid acquisition harder to measure.
3. **Slow, effortful value before any payoff.** Offers and Product: irregular cycles take months to show a pattern, the daily log is about 12 taps, and the first week has no clear reward. She may leave before the PDF ever matters.
4. **Pro is a feature list, not a better outcome.** Offers and Product: the free tier already delivers the key result (the doctor-ready PDF). Nobody has named the one Pro benefit she would feel and pay for.
5. **Unfinished seams and no proof.** Offers and Product (Monopoly on proof): clinician sign-off, legal review, store billing and the live AI key are all open, and there are no users or testimonials.

Raised by one member only:
- **Copyability** (Monopoly): every feature is an incremental improvement. A big tracker could ship a PCOS mode plus an AI summary in one release, so only the brand protects Cyra.

### Where the members disagree
- **How much the privacy stance is worth.** Monopoly calls it the most realistic moat, because an ad- or data-funded rival would have to change its business model. Offers values it only as risk reduction. Product sees it as experience quality, not a business advantage.
- **Score.** Product scores higher (6) because the product's restraint and care are already real. Offers and Monopoly (4 each) weigh the missing offer and distribution more heavily.
- **The free PDF.** Product calls it the right instinct. Offers says it gives away the outcome and leaves Pro nothing to sell. Both can be true: keep the PDF free and make Pro a different, bigger result.

### Conditions (merged checklist for the rest of the pack)
- [ ] **PCOS-only launch.** Store listing, onboarding emphasis, messaging and the first channel all say PCOS. Other stages and POTS stay in the product but get no marketing. (All three. Consumer panel, marketing, brand)
- [ ] **One-sentence pitch** for a woman with suspected PCOS. (Product. Brand, marketing)
- [ ] **Value in week one.** A scripted first five minutes, and a useful result in the first 7 days (a symptom baseline, a lab summary or a draft PDF). (Offers, Product. Offer, consumer)
- [ ] **A shorter default daily log.** The fewest taps that still feed the PDF; everything else optional. (Offers, Product. Product work, consumer)
- [ ] **Pro rebuilt around one outcome** with a named stack, a time-bound promise and a guarantee the CFO can afford. (Offers, Product. Offer, CFO)
- [ ] **Demand and price validated** before the store price is set. (Offers, Product. Consumer, pricing)
- [ ] **A named acquisition channel with a measured cost**, tested with a real waitlist or pre-sale before launch. (Monopoly, Offers. Marketing, launch, CFO)
- [ ] **Proof before paid acquisition.** Clinician sign-off on the medical wording, plus a small real-user pilot that produces testimonials. (All three. Ops, launch)
- [ ] **Seams closed before store submission.** Legal sign-off, store billing tested end to end, and a working AI path with a clear fallback. (Product, Monopoly. Ops, launch)
- [ ] **Privacy turned into a provable brand asset,** every claim literally true and checkable. (Monopoly. Brand, marketing)
- [ ] **One year-one compounding advantage named,** such as clinician referrals or a recognised evidence-cited brand. (Monopoly. Marketing, plan)

### Open numbers nobody has yet
- PCOS market size and how many of those women Cyra can reach. (Competitors, consumer)
- Acquisition cost and channel. (Consumer, marketing, CFO)
- Pro price. (Pricing)
- AI cost per user, store fees, and the cost of clinician and legal review. (CFO)
- Founder budget. (CFO; the founder has to supply it)

### The strongest version the board can see
**This differs from the pitch.**

Cyra launches as *the private PCOS log that gets you taken seriously at your next appointment*, for women with diagnosed or suspected PCOS and irregular cycles. Everything else stays in the code but unmarketed.

**Free tier:**
- a three-tap daily log;
- a first-week baseline;
- the free clinician PDF.

**Pro (one promise):** "walk into your appointment with a clinician-ready picture in 8 weeks." That covers the AI write-up of her own pattern, a lab-and-symptom timeline and appointment prep, with a guarantee.

**Distribution:** through one channel the founder can measure, such as PCOS communities, creators or clinicians who recommend it, proven with a waitlist and a small clinician-reviewed pilot before any paid spend.

**Moat:** the privacy stance plus clinician trust. Hair loss and the other stages come only after PCOS users stay and pay.

## The competition

Date researched: 2026-10-30. Method: `founder-competitors`. Market: online consumer app (iOS, Android, web) for women with PCOS and irregular cycles, plus period, fertility, pregnancy, perimenopause and menopause tracking.

### Read this first: how the facts were gathered

- **No competitor page could be opened from this session.** apps.apple.com, play.google.com, flo.health, helloclue.com, reddit.com and trustpilot.com all failed. WebFetch could not resolve them, and the session proxy returned 403 (policy denial). They need to be allowed in the session's network settings before anyone re-reads them. The PubMed connector also failed to connect (403).
- Every fact below comes from **web search results** that quote or summarise the linked page. The page itself was not opened. Treat each price and rating as "seen in a search result of that page on 2026-10-30", and confirm it in the store before relying on it.
- Several store listings in the results were old cached snapshots, and prices often conflict between storefronts. Where they conflict, both figures are given.
- **Dropped because they could not be verified from their own site or store listing:** Midday (only a 2022 news article gave a price: https://medcitynews.com/2022/08/lisa-health-launches-digital-menopause-app-with-mayo-clinic/), Elektra (not found), PCOS AI, PMOSense, Posiva, Cysterly, Cysta AI, Ebb and Allura (store-mirror listings only, with no price or rating worth recording). These are evidence that the PCOS long tail is crowded. They are not rows in the table.

### 1. The table (most direct first)

| # | name | type | comparable price (Pro / premium) | rating (count) | positioning line |
|---|---|---|---|---|---|
| 1 | Clue | Direct | USD 9.99/mo, 39.99/yr (US App Store) | 4.8 (407K, US) | "Clue Plus: With you through it all" |
| 2 | Flo | Direct | monthly + yearly exist; **no current price visible** | 4.8 (1.7M, US, old snapshot); Trustpilot 3.9 (~4,222) | not captured |
| 3 | Stardust | Direct | ~USD 6.99/mo, 29.99/yr (listing may be dated) | 4.8 (99.1K) | "Your data is private. Period." |
| 4 | Period Tracker: Private Log | Direct (closest clone of Cyra's pitch) | not found | not found | "shows an honest confidence range — never false certainty" |
| 5 | Ciora: PCOS Tracker | Direct (PCOS) | PHP 199/mo, 999/yr, 2,990 lifetime | not found | "Track your cycle, symptoms, meals, sleep, habits, and progress in one simple app designed for women managing PCOS." |
| 6 | PCOS Polly | Direct (PCOS) | USD 19.99/mo, 24.99/qtr, 59.99/yr | not verified | store title only |
| 7 | PCOS Tracker App (Healthium) | Direct (PCOS) | USD 11.99–89.99 IAP | not found | not captured |
| 8 | Hormona | Direct (hormones/peri) | USD 19.99/mo, 69.99/yr (34.99/yr also listed) | not found | store title only |
| 9 | Balance (Balance+) | Direct (menopause stage) | GBP 4.99/mo, 49.99/yr (official UK) | 4.73 (996, third party) | "Balance+ — Personalised menopause support" |
| 10 | Caria | Direct (menopause stage) | USD 9.99/mo, 49.99/yr (desc.); 5.99/47.99 (IAP list) | not found | store title only |
| 11 | Bearable | Indirect | USD 4.49–49.99 IAP; lifetime 99.99 | not found | "Bearable is free to use and has no ads" |
| 12 | HealthMaxxing | Indirect | Pro, USD 39.99/yr annual offer in terms | not found | "Free Body & Mind Health Tracker" |
| 13 | Natural Cycles | Indirect | USD 14.99/mo, 119.99/yr (**third-party**: Medical News Today) | not found | "Natural Birth Control" |
| 14 | Ovia | Indirect | free; premium via employer/health plan | not found | "Ovia for Fertility, Pregnancy, and Parenting" |
| 15 | Period Calendar (Simple Design) | Indirect | freemium; price not found | 4.89 (~4.86M, Google Play via Sensor Tower) | not captured |
| 16 | drip. | Indirect (privacy-first) | free, open source | not found | "keeps all your data private on your device" |
| 17 | Euki | Indirect (privacy-first) | free (nonprofit) | not found | "Your data is stored locally (on your device) and nowhere else." |
| 18 | Allara Health | Indirect (telehealth) | USD 149/mo self-pay (or insurance) | not found | "Virtual Women's Health, Covered by Insurance" |
| 19 | Inito | Indirect (device) | USD 119 device + 15 strips; strips USD 49/15 | not found | "Inito Fertility Monitor" |
| 20 | Cysterhood | Indirect (PCOS coaching) | USD 29.99/mo, 129.99/yr (listings conflict) | not found | "the largest PCOS community focused on weight loss…" |
| S1 | Apple Health Cycle Tracking | Substitute | free (built in) | n/a | flags irregular, infrequent or prolonged cycles; 12-month PDF for a clinician |
| S2 | Reddit r/PCOS | Substitute | free | n/a | peer advice |
| S3 | Paper, notes app, spreadsheet | Substitute | free | n/a | n/a |
| S4 | Clinician / telehealth | Substitute | visit cost or insurance | n/a | n/a |

The links, what each one includes and the source notes for every row are in `founder/competitors.csv`.

**Count:** 20 competitors verified (direct and indirect) plus 4 substitutes. Facts are verified at search-result level only (see above).

### 2. Price range (annual Pro subscription, USD, app-only)

App-only annual plans with a USD figure from the app's own listing or site: Stardust 29.99, Clue 39.99, HealthMaxxing 39.99, Caria 49.99, PCOS Polly 59.99, Hormona 69.99, PCOS Tracker App (Healthium) 89.99 (top of IAP range), Cysterhood 129.99.

- **Low: USD 29.99/yr** (Stardust)
- **Median: USD 54.99/yr** (midpoint of 49.99 and 59.99, n=8)
- **High: USD 129.99/yr** (Cysterhood, which adds coaching and meal plans)
- Monthly plans seen: USD 6.99 (Stardust) to 29.99 (Cysterhood). Clue and Caria are both at 9.99, and PCOS Polly and Hormona are both at 19.99.
- Excluded from the range: Natural Cycles (third-party price, and it is a contraception device), Allara (USD 149/month care, not an app), Inito (hardware), Balance (GBP 49.99/yr ≈ in the middle of the range) and Ciora (PHP).
- **Free floor:** Apple Health, drip., Euki, Ovia, Flo's free tier and Period Calendar. Many buyers will expect the core for free. Cyra's free core matches that expectation.

### 3. Positioning map

Axes chosen for this buyer: **privacy and data control** (left = cloud account and ad/analytics history; right = on-device, no account) vs. **depth of PCOS and irregular-cycle support** (bottom = generic period calendar; top = built for PCOS or irregular cycles).

```
 PCOS / irregular depth
 HIGH |  Allara ($149/mo care)      PCOS Polly, Ciora,           Period Tracker: Private Log
      |  Cysterhood (weight loss)   Healthium, Hormona           (claims: ranges + on-device;
      |                             (subscription-first,          unverified)
      |                              food/weight-heavy)              <-- CYRA aims here
      |
  MID |  Flo (Premium: AI assistant,  Clue (modes incl.            Apple Health (deviation
      |  doctor report)               perimenopause; EU)           detection + 12-mo PDF, free)
      |  Natural Cycles, Ovia         Balance, Caria, Bearable
      |
  LOW |  Period Calendar              Stardust (privacy claim,     drip., Euki (local-only,
      |                               but Mozilla found sharing)    free, no PCOS features)
      +------------------------------------------------------------------------------
        LOW privacy / data control           MID                     HIGH
```

Placement evidence: Flo, from the FTC 2021 order and the 2025 jury verdict against Meta over Flo data (https://techcrunch.com/2025/08/05/jury-rules-meta-violated-california-privacy-laws-by-collecting-menstrual-health-data-from-flo). Stardust, from Mozilla's finding that it shared reproductive data with RudderStack (https://www.mozillafoundation.org/ca/nothing-personal/stardust-privacy-review/). drip. and Euki, from their own local-only statements and Mozilla's "Best Of" for Euki. Apple Health, from https://support.apple.com/en-us/120356. Private Log's placement rests only on its own claims (https://mwm.ai/apps/period-tracker-private-log/6785241171).

### 4. What customers complain about (ranked)

Reviews were mined for Flo, Clue, Stardust, Natural Cycles and Balance, plus r/PCOS. The App Store and Trustpilot pages could not be opened, so quotes are the verbatim fragments that appeared in search results. Counts are individual reviews or posts seen, not market totals.

1. **Paywall and upsell pressure (4 individual reviews + 2 aggregator summaries; not thin).**
   - Clue: "every time I save after tracking, a full screen subscription ad" and "bombarded with this push to pay for features i do not use or need" (https://apps.apple.com/us/app/clue-period-cycle-tracker/id657189652); "the rest of the functions of the app are already behind a paywall" (same listing, via https://unstar.app/blog/flo-clue-stardust-apple-health-period-tracking-apps-ranked-2026).
   - Healthium PCOS Tracker: a reviewer says it isn't worth "$90/year" (https://apps.apple.com/us/app/pcos-tracker-app/id6739416655).
   - Flo: aggregators report users "forced to click through multiple subscription offers every time they open the app" (https://unstar.app/blog/is-flo-legit-safe-period-tracker-app-reviews-2026, https://kimola.com/reports/unlock-insights-with-the-flo-user-feedback-analysis-report-app-store-us-147596).
2. **Predictions fail for irregular cycles, with no way to explain why (3 individual reviews or posts + 1 summary; not thin).**
   - Flo, Trustpilot: "Unable to log surgery's or medical issues that can change your period… I am unable to explain to the app why it is late or irregular." and "I've been really disappointed by how inaccurate its fertility predictions are." (https://www.trustpilot.com/review/flo.health)
   - r/PCOS: "no app is going to be good at accounting for irregular cycles/predicting when your period will come" (https://redlib.hbubli.cc/r/PCOS/comments/1j63pl4/period_tracking_apps).
3. **Privacy and data sharing (evidence events, not reviews: 2 companies, 3 independent sources; not thin).**
   - Flo: FTC 2021 consent order. A federal jury found in August 2025 that Meta illegally collected Flo users' data, and Flo settled the day before the verdict (https://therecord.media/jury-verdict-meta-flo-app-data-privacy-case, https://www.fiercehealthcare.com/digital-health/meta-found-liable-abusing-consumer-reproductive-health-data-run-targeted-ads).
   - Stardust: Mozilla found it "sharing sensitive reproductive details with analytics company RudderStack" despite its "Your data is private. Period." line.
4. **Billing and cancellation (1 verbatim review + 3 secondary sources; thin in verbatim terms, but corroborated).**
   - Flo: "when you cancel the app subscription your website subscription continues in the background without your knowledge silently taking money each month." (https://www.trustpilot.com/review/flo.health?page=4)
   - Eat Proteins: "Complaints cluster around billing, not the tracker itself." (https://eatproteins.com/flo-health-review/)
   - Natural Cycles: Medical News Today says negative reviews cite refunds and charges after cancelling (https://www.medicalnewstoday.com/articles/natural-cycles-review).
5. **Tone that doesn't fit the user (thin).** Stardust's astrology framing draws complaints from people who installed it for tracking (summary at https://unstar.app/blog/flo-clue-stardust-apple-health-period-tracking-apps-ranked-2026). Flo sends unwelcome pregnancy notifications (Trustpilot summary).
6. **Stability and support (thin).** Balance: a user could not get past verification, another reports freezing, and one says the developer doesn't respond (https://justuseapp.com/en/app/1503345959/balance-menopause-support/reviews). Clue: a user was locked out after an update needed a newer iOS.

Not found: a body of complaints about Balance's paywall. Its reviews are mostly positive per the same aggregator.

### 5. The gap

**The gap is narrow, and it is a positioning gap, not an empty feature space.** On the evidence, Cyra would be the one app with all four of these at once:

- PCOS-first symptom and irregular-cycle logging with range-based predictions. This answers complaint #2.
- A free core that includes the doctor PDF, without upsell interruptions. This answers complaint #1. Clue and Flo gate trends and doctor reports, and the PCOS apps are subscription-first.
- Verifiably local-first data with no ad or analytics SDKs. This answers complaint #3. The established apps with PCOS depth (Flo, Clue, the PCOS subscription apps) are cloud-account products, and the local-only apps (drip., Euki) have no PCOS depth.
- No food or weight focus. Cysterhood, PCOS Polly and Ciora lead with meals and weight loss.

Plainly, it is weaker than it looks:

- **Apple Health already gives iPhone users, for free, irregular-cycle detection and a 12-month PDF for a clinician.** That covers much of Cyra's free core for iOS buyers.
- **"Period Tracker: Private Log" already claims honest ranges, on-device storage, no account and PCOS/perimenopause support.** PMOSense, Ebb and others make similar range claims. None of these could be verified beyond search mirrors, but the pitch is not unique.
- AI chat is not a differentiator. Flo Premium already sells a Health Assistant, and HealthMaxxing Pro sells "expanded AI".
- What is defensible is **trust plus PCOS clinical framing**: guideline-cited wording, previewed and pseudonymized AI payloads, and no history of data incidents. That has to be proven (an independent privacy review such as Mozilla's, plus clinician sign-off) before it is a gap a buyer can see.

### 6. The threat

1. **Apple (fastest, free).** Cycle Tracking already has deviation detection and PDF export. Adding PCOS symptom chips or a "conditions" view in an iOS release would cover Cyra's free core for every iPhone user, at zero price and with on-device privacy by default.
2. **Clue.** It has the EU-privacy reputation, paid modes for conceiving, pregnancy and perimenopause already, and has worked on PCOS before (https://techcrunch.com/2019/09/04/period-app-clue-hopes-to-predict-if-you-have-pcos/). A "Clue PCOS" mode inside Clue Plus (USD 39.99/yr) is a short step, with 407K US ratings behind it.
3. **Long-tail PCOS app makers.** Dozens of AI-wrapped PCOS trackers launched in 2025–2026 (PCOS AI, Cysta AI, Cycla AI, PMOSense, Private Log…). They can copy Cyra's copy and features in weeks, and they compete on App Store keywords, which Cyra has not yet entered.

### Sources not reached

apps.apple.com, play.google.com, flo.health, helloclue.com, reddit.com and trustpilot.com (proxy 403 or DNS failure from WebFetch), and the PubMed connector (403). Everything above should be re-checked in the stores before the pricing step.

Next: `/founder-consumer` uses complaints 1–4 as buyer objections, and `/founder-pricing` uses the USD 29.99 / 54.99 / 129.99 annual range.

## The buyer panel

**0 buy · 20 pass** (0% buy) out of 20 simulated buyers. Seed 476364, so the same cards can be dealt again.

These are simulated buyers, not customers. Use this to find objections and weak spots, then confirm the big ones with real people before you spend.

### By segment

| group | buyers | buy rate |
| --- | ---: | ---: |
| Suspected PCOS, not yet diagnosed | 6 | 0%  (thin) |
| Trying to conceive with PCOS | 7 | 0%  (thin) |
| Student or early-career with irregular periods | 3 | 0%  (thin) |
| Diagnosed PCOS, managing symptoms | 4 | 0%  (thin) |

### By buying behaviour

| group | buyers | buy rate |
| --- | ---: | ---: |
| Free-only | 4 | 0%  (thin) |
| App fatigue | 5 | 0%  (thin) |
| Pays for help | 3 | 0%  (thin) |
| Uses Flo or Clue today | 1 | 0%  (thin) |
| Privacy-wary | 5 | 0%  (thin) |
| Research-heavy | 2 | 0%  (thin) |

### By income

| group | buyers | buy rate |
| --- | ---: | ---: |
| $66,000 and up | 8 | 0% |
| $41,000 to $66,000 | 6 | 0%  (thin) |
| under $41,000 | 6 | 0%  (thin) |

### Why they pass

| reason | buyers | in their words |
| --- | ---: | --- |
| need | 7 | "The no-account, stays-on-my-phone part actually gets me to download it, but the doctor PDF is the thing I'd use and that's free. Pro is an AI chat and breathing exercises, and I'm not paying to send my log to an AI when what I want is to know if my inositol is working." (P004) · "Honestly the free version is the part I want: ranges instead of a fake 28-day guess and a PDF I can show my doctor. I'd download it and try it, but I'm not paying $5 a month on my budget for an AI write-up when I don't know yet if the free predictions are any better than Flo's." (P005) |
| habit | 5 | "I'd maybe download the free version, since honest ranges instead of a fake 28-day guess and the doctor PDF actually sound useful. But I don't pay for apps, and an AI write-up of my own notes isn't worth $5 a month when Apple Health and my Notes app cost nothing." (P001) · "I'd maybe download the free version for the doctor PDF, but I've quit every tracker within a few weeks because logging feels like homework, so paying for Pro before I've even stuck with the free part makes no sense. An AI write-up of my own log doesn't tell me whether my metformin is working or change what my doctor does." (P003) |
| trust | 5 | "I'd download the free version, because on-phone storage with no account is exactly what I want, and the doctor PDF could help me find out whether the metformin is doing anything. But I won't pay to send my fertility log to an AI until I've read the privacy policy and seen who handles that data, and I'd want a couple of months of free use before I decide Pro is worth it." (P008) · "I might download the free version for the doctor PDF, since my period is six weeks late and I need something to show a clinician, but I'm not paying to have my log sent to an AI. On $31k, five bucks a month for a chatbot and breathing exercises isn't a priority." (P009) |
| price | 3 | "I'd download the free version for the doctor-ready PDF because that's exactly my problem before appointments, but I never pay for apps and nothing in Pro is something I need. An AI write-up and breathing exercises aren't worth $5 a month when the free part already does the job." (P002) · "I might download the free version for the doctor PDF since that's my actual problem, but I don't pay for apps, period. An AI write-up of my own log isn't worth $5 a month when I can just read it myself before my appointment." (P007) |

### Why they buy

| reason | buyers | in their words |
| --- | ---: | --- |

### What would flip a no

- If the free version actually got my cycles roughly right for a few months and the AI summary helped me get a doctor to take me seriously and order PCOS tests, I might pay for a year once, at a deal.
- If my doctor actually used the Pro write-up and it helped get my fertility questions taken seriously, maybe a one-time payment, but not a monthly one.
- If I actually kept logging for a couple of months on the free version and the doctor PDF got my doctor to change something, like adjusting my meds or ordering tests, I'd consider paying.
- If Pro showed me a before-and-after of my symptoms and cycle length since I started metformin or inositol, in a form my doctor would take seriously, so it saves me an appointment or gets me a real answer faster.
- If after a few months the free ranges were actually right for me and the Pro write-up could clearly show whether my metformin or inositol is changing my cycles or symptoms, I'd pay for the yearly plan.
- If I'd actually kept logging on the free version for two or three months and Pro gave me something concrete for trying to conceive, like ovulation likelihood with PCOS or something my OB said was useful, not just AI commentary.
- If my doctor actually used the Pro write-up and it changed what happened at my appointment, I might pay for a month or two around visits.
- A plain-language policy naming the AI provider and saying in writing that it keeps nothing and doesn't train on the data, plus an independent privacy audit. After that, a free trial of the weekly write-up showing it can actually tell me whether my meds are working.
- An independent privacy audit or a clear published policy saying the AI provider keeps and trains on nothing, plus a few months of using the free app without any weight-loss pushing.
- An independent privacy audit, plus proof the doctor PDF actually changed how clinicians respond to people with PCOS.
- If Pro did something that actually cut down time with doctors, like a write-up my clinician has said they'll use, or something that helps me get a PCOS workup ordered, instead of a summary for me to read.
- Proof that the doctor-ready report actually changed how clinicians treated people, plus an independent privacy audit showing what the AI part sends and that it isn't kept.

20 buyers gave all four price answers. Run founder-pricing's van_westendorp.py on the answers folder.

## Pricing

**Read this first.** No buyer on the panel bought Pro, at any price. Seven of the 20 said the free tier already covers what they need. Cutting the price does not fix that. The panel's price answers tell us **what to test**; the offer (next step) has to fix **what Pro is**.

### 1. The price

**Pro: $3.99 a month or $29.99 a year** (the yearly plan is 37% cheaper than paying monthly). Prices are in US dollars, set through the App Store and Google Play.

Why this price:
- **Panel range** (simulated buyers, n=20, `pricing-curve.md`):
  - The acceptable range is $1.02 to $5.99.
  - $2.99 is the price where as many buyers call it a bargain as call it expensive.
  - The median buyer starts to find it expensive at $4.99 and refuses at $8.00.
  - $3.99 sits between the bargain point and the point where it feels expensive.
  - The $4.99 we tested is exactly where the median buyer starts to find it expensive, and 7 of 20 put their "too expensive" price at or below $4.99.
- **Competitors** (`competitors.md`):
  - Annual plans run from $29.99 (Stardust) through $39.99 (Clue, HealthMaxxing) and a $54.99 median, up to $129.99 (Cysterhood, which includes coaching).
  - Monthly plans run from $6.99 to $29.99.
  - $29.99 a year ties the cheapest app.
  - $3.99 a month is below every monthly price seen.
  - That fits a product whose main promise is a free core. Cyra cannot charge a PCOS-program price for an app that is not a program.
- **Margin.**
  - Known: the app stores keep a 15% commission (Apple's Small Business Program and Google Play's subscription rate). That leaves about $3.39 a month, or $25.49 a year, before AI costs.
  - Not known yet: the AI cost per Pro user and the fixed costs. These come from the CFO (`/founder-cfo`), and this section must be re-checked after that step. If AI usage costs more than about $1 per user per month, the monthly price has to go up or the AI use has to be capped.

### 2. The ladder

| rung | price | who it is for | reason to step up |
| --- | --- | --- | --- |
| **Free** | $0, forever | everyone | Logging, ranges, patterns and the doctor PDF. This stays free; it is the trust anchor and the reason people download. |
| **Appointment Pack** (one-time) | $7.99 per appointment | women with a visit coming up who "don't pay subscriptions" | Several buyers asked for a one-off payment "for a month or two around visits". Buying it gives 30 days of Pro around one appointment, with a prepared summary for that appointment. |
| **Pro monthly** | $3.99 a month | women who log steadily and want the write-up every week | Weekly AI write-up and chat, the full practice library, and backup. |
| **Pro yearly** | $29.99 a year | women who have kept logging for a month or more | Same as monthly, 37% cheaper. |

Condition modules (PCOS today, hair loss later) stay inside Pro for now. Selling them as add-ons only makes sense once buyers have shown they pay for one.

### 3. Opening offer

**Founding member: Pro yearly for $19.99, locked for as long as the subscription is kept.**
- Who can get it: the first 1,000 subscribers, or anyone who joins before the end of launch month, whichever comes first.
- Why it doesn't train buyers to wait for discounts: it is tied to joining early, it has a real end date and a real cap, and it is never repeated.
- No "was $X" price is shown. The yearly plan has never been sold at any price.

### 4. What to test with real buyers

1. **Monthly price: $2.99 vs. $4.99.** Two versions of a landing page, each with a "Join the Pro waitlist" button showing its price, sent to the same audience (r/PCOS-style communities and PCOS creators). Measure clicks to join and emails left at each price. Run each version until at least 200 people have seen it.
2. **Subscription vs. one-time payment.** A third version offers only the $7.99 Appointment Pack. If it converts at least as well as the subscription, lead with it.
3. **Do this before setting the store price.** None of these tests need the app stores; they need a page and a payment link or waitlist.

### 5. The panel's price objections, in their words (top three)

1. "I don't pay for apps, period. An AI write-up of my own log isn't worth $5 a month when I can just read it myself before my appointment." (P007)
2. "I'm not paying $5 a month on my budget for an AI write-up when I don't know yet if the free predictions are any better than Flo's." (P005)
3. "Maybe a one-time payment, but not a monthly one." (P002, on what would change their mind)

These are simulated buyers, not customers. Use their words to find objections. Never use them as testimonials.

## The offer

Method: the Offers lens (a summary of a published offer framework; not anyone's own words).
Inputs:
- Panel: 0 of 20 bought the v1 pitch (`panel/results.md`).
- Competitor complaints (`competitors.md`).
- The board's conditions (`board.md`).
- No `numbers.json` yet. Costs below are rated 1–5 from what the product already does; the CFO step has to confirm them.

### 1. The problem list (in the buyer's words, from the panel and competitor complaints)

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

### 2. Solutions, scored (value to her 1–5 · cost to deliver 1–5, 1 = cheap)

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

### 3. The stack

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

### 4. Value equation (1–10, before → after)

| element | v1 pitch | Appointment-Ready | what moves it |
| --- | ---: | ---: | --- |
| Dream outcome | 4 | 8 | The core is now "taken seriously at the appointment" plus "is my treatment working", not "AI write-up and breathing practices". |
| Perceived likelihood | 3 | 6 | Guideline-cited questions, no AI required, and the free first summary she can judge herself. Still no real proof: there is no clinician sign-off or pilot yet. |
| Time to result | 3 | 6 | The week-one baseline, and the summary tied to her next appointment date. |
| Effort and sacrifice | 4 | 7 | The 3-tap log, nothing to pay up front, and no data leaving the phone. |

### 5. Re-test (same 20 buyers, same seeded cards)

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

## The numbers

**Not financial, tax or legal advice.** An accountant should check the business structure, any payroll and the sales tax on app sales before money moves. App-store prices include tax in many countries; Apple and Google collect and pay it, so the revenue below is before their deductions.

**Most inputs are estimates.** Only you know your budget and whether you will pay yourself. The tool's sources are in `cfo-sources.md`. Change `numbers.json` and re-run when you have the real figures.

### The margin
- Each $7.99 Appointment Pack leaves **$6.49 (81%)** after the 15% store commission ($1.20) and an estimated $0.30 of AI cost.
- Running costs are about **$18 a month** (hosting, the Apple developer fee, the domain). That figure assumes nobody is paid.
- On those inputs, break-even is **1 pack a day**, and the plan of 3 a day keeps **79%** of every sale.

### The line to watch: your own pay, then volume
- **If you pay yourself $3,000 a month:**
  - Break-even jumps to **16 packs a day**, about 480 a month.
  - Year 1 loses **$34,233**.
  - You would need **$38,558** before it pays for itself.
  - That is the real business question: Cyra is cheap to run but needs hundreds of paying women a month to replace a salary.
- **If volume comes in at half the plan:** year 1 operating profit falls from $1,767 to **$774**, and the cash needed barely moves ($4,370). At $0 salary, slow sales hurt little because costs are tiny.
- The volume ramp is a guess. The buyer panel had **0 of 20** buying in month one, and 18 of 20 said they would pay $7.99 only after a free summary helped at an appointment. So the ramp starts at zero for two months, then grows slowly.
- Plan volume (3 packs a day = 90 a month) is not proven by anything yet. The landing-page test in `pricing.md` is the first real number.

### Cash
- **$4,362** before it pays for itself, almost all of it one-off:
  - clinician review, about $1,500 (estimate)
  - lawyer review, about $2,500 (estimate)
  - a $300 landing-page test (estimate)
  - the $25 Google Play fee
- Year 1 earns back about $1,767 of it. **The startup spend is not recovered within year 1** at this plan.

### Three ways to improve the margin (each run through the tool)
1. **Sell the yearly plan to heavy users.** Each $29.99 subscription leaves $21.89 (73%), using an estimated $3.60 a year for AI, versus $6.49 per pack. One yearly subscriber is worth about 3.4 packs. Push it to users who are still logging after the first month.
2. **Do not lead with the $3.99 monthly plan.**
   - At $3.99 a unit leaves $2.49 (62%).
   - At the same volume, year 1 operating profit falls from $1,767 to $543.
   - Keep monthly available, but price it so the yearly plan is the obvious choice. A lower monthly price only works if it sells more than twice as many units.
3. **Cut the startup spend before cutting the price.**
   - Clinician and lawyer reviews are 92% of the cash needed ($4,000 of $4,325).
   - Get fixed quotes. Ask a clinician partner to review in exchange for credit, or through a university clinic or PCOS charity.
   - Every $1,000 saved is about 154 fewer packs to earn back.

### The board's money conditions (`board.md`)
- [ ] **Measured acquisition cost:** not met. No channel has been tested. Nothing above includes paying for users; any ad spend comes straight off the $6.49 per pack.
- [ ] **Pro around one outcome, with a guarantee the CFO can afford:** met on paper. "First summary free" costs nothing at the margin because it runs on the phone. Its real cost is the women who never pay, which only the pilot will show.
- [ ] **Price validated before setting it:** not met. Simulated answers only. Run the $2.99/$4.99 page test and the $7.99 pack-only version.
- [ ] **Store fees and AI cost known:** store fees are known (15%). AI cost is an estimate; check it against real usage once `ANTHROPIC_API_KEY` is live.

## Unit economics: Cyra Health (Appointment-Ready offer)

Every number below comes from the input file. Nothing is looked up or guessed.

### One paid Appointment Pack (30 days of Pro around one appointment)

| line | per paid Appointment Pack (30 days of Pro around one appointment) |
| --- | ---: |
| Price | $7.99 |
| App store commission, 15% (Apple Small Business Program / Google Play subscriptions) | -$1.20 |
| AI write-up + chat for 30 days (ESTIMATE, only if she turns AI on) | -$0.30 |
| **Contribution** (what each paid Appointment Pack (30 days of Pro around one appointment) leaves to pay the fixed costs) | **$6.49** (81%) |

### The margin that matters

Fixed costs: $18 a month (Backend hosting on Render, one web service (ESTIMATE from Render's paid tier) $7, Apple Developer Program, $99/yr spread monthly $8, Domain + email (ESTIMATE) $3, Founder pay (ZERO until the founder says otherwise) $0).

- **Break-even: 1 paid Appointment Pack (30 days of Pro around one appointment)s a day.** Below that you lose money every month.
- **Profit margin at your plan** (3 a day): **79%** of every sale, after every cost.

### Year 1, month by month

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

### What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 79% | 1 | $1,767 |
| Price -10% | 76% | 1 | $1,522 |
| Volume -20% | 78% | 1 | $1,370 |
| Unit costs +15% | 76% | 1 | $1,698 |

### Red flags

- The startup spend is not earned back within year 1.

## Marketing

**Evidence used:**
- `panel/` and `panel-v2/`: 20 simulated buyers, 0 first-month buys. 18 of 20 would pay $7.99 before an appointment, once a free summary has helped.
- `competitors.md`: what Cyra must not sound like.
- `offer.md`, `pricing.md` and `cfo.md`: $6.49 kept per pack.

**Health claims:** marketing says what the app does, never what it treats. "Helps you prepare for appointments", never "helps you get diagnosed" or "manage PCOS". Not legal advice; the US FTC's health-claims guidance and the app stores' health rules apply.

### 1. Positioning

Three versions:

1. **For women with suspected or diagnosed PCOS** who keep getting brushed off at appointments, Cyra is the private symptom log that turns what happened between visits into a one-page summary their clinician can read in a minute. Flo and Clue are built for regular cycles and keep your data in their cloud; Cyra is not.
2. For women with irregular periods who don't know if it's PCOS, Cyra is the tracker that never fakes a 28-day prediction, shows honest ranges, and keeps everything on your phone. Unlike mainstream period apps, it was not built for regular cycles.
3. For women on metformin or inositol for PCOS, Cyra is the log that shows what has changed since you started, so your next appointment is about evidence, not memory. Unlike a notes app, it does the comparison for you.

**Recommended: 1.** It is the reason every buyer gave for downloading:
- "the doctor PDF is the thing I'd use" (P004 v1);
- "forgetting what happened between visits is her real problem" (P019 v2);
- 18 of 20 tied paying to an appointment.

Version 3 is a strong supporting message, used for the treatment-check feature. Version 2 competes on predictions, where buyers are the most sceptical. Five of 20 said predictions "never work for me".

### 2. Channels

| channel | why it fits this buyer | rough cost | how you'll know it worked | start? |
| --- | --- | --- | --- | --- |
| **PCOS communities** (r/PCOS, PCOS Facebook groups, Discord servers) | Where the "research-heavy" and "privacy-wary" buyers already talk; the panel personas read r/PCOS. | $0, your time. **Follow each community's self-promotion rules; ask moderators first.** | Waitlist sign-ups from community links, tracked with a separate link per community | **Yes**, but only as a member who helps, with the founder named and the app disclosed |
| **Founder-led short video** (TikTok, Instagram Reels) | Panel habit: "scroll PCOS TikTok a few nights a week". Showing the one-page summary is visual and specific. | $0, about 3 hrs/week | Views to link-in-bio clicks to waitlist; above 1% of views clicking through is good | **Yes** |
| **Clinicians and PCOS dietitians** (a printable "bring this to your appointment" card) | Proves the core promise, and clinician trust is the board's moat condition. | $0 to $100 for printing | Clinicians who agree to hand it out; installs from the card's QR code (one QR per clinic) | **Yes**, after the clinician review is done |
| PCOS micro-creators (10k–100k followers), paid and disclosed | Reaches the audience faster than founder video | $100–$300 per post (estimate) | Waitlist sign-ups from each creator's code | Later: only once the waitlist converts at more than 2% |
| Search content ("questions to ask your doctor about PCOS", "is my PCOS treatment working") | Matches what this buyer searches before an appointment | $0, writing time | Organic visits to waitlist | Month 2 onwards |
| Paid social and search ads | Fast, but see the cap in §5 | — | — | **No.** Each pack keeps $6.49; ads in this category very likely cost more than that per install (unmeasured), and Cyra's no-tracking promise rules out the usual ad attribution tools |
| PR on "the period app that doesn't keep your data" | A real angle after the Flo/Meta verdict | $0 | Coverage | Later, and only after the independent privacy review buyers asked for |

**Start with three:** communities, founder video, and the clinician card.

### 3. Ten hooks

Each hook answers a panel objection.

| # | format | hook | answers |
| --- | --- | --- | --- |
| 1 | video, first 3 s | "This is the page I wish I'd brought to my last PCOS appointment." | "an app won't change what my doctor does" |
| 2 | video | "I logged 3 taps a day. Here's what my doctor saw." | "logging is homework" |
| 3 | headline | "Your first appointment summary is free. See it before you pay anything." | "every app paywalls the useful part" |
| 4 | video | "Is your metformin doing anything? Here's how to bring evidence instead of a feeling." | "I can't tell if my treatment works" |
| 5 | headline | "No account. No ads. Your log never leaves your phone." | "I don't trust a period app with my data" |
| 6 | video | "Why your period app keeps guessing 28 days, and what an honest range looks like." | "predictions never work for irregular cycles" |
| 7 | headline | "Weight is off by default and never charted." | "is this a weight-loss app in disguise?" |
| 8 | video | "The AI is off unless you turn it on. Here's exactly what it would send." | "I won't send my log to an AI" |
| 9 | clinic card | "Bring this to your appointment: a one-page picture of your cycles, your symptoms and your questions." | "I keep forgetting what happened between visits" |
| 10 | headline | "No subscription needed: $7.99 for the appointment you have coming up." | "I don't pay for apps / not monthly" |

Every hook describes what the app does. None of them promise a diagnosis, a treatment change or a doctor's reaction.

### 4. The 30-day campaign (L = launch day; the date is set in `launch.md`)

Pre-launch builds a waitlist, because the app isn't in the stores yet.

| day | channel | what goes out | message / hook |
| --- | --- | --- | --- |
| L-14 | Landing page | Waitlist page live, with the two price variants (A: $2.99/mo, B: $4.99/mo) and C (pack only, $7.99) | Hook 3 |
| L-14 | Communities | Ask moderators of three PCOS communities if a founder post is allowed | — |
| L-13 | Video | Founder intro: why Cyra exists, no-weight stance | Hook 7 |
| L-12 | Video | Screen recording of the 3-tap log | Hook 2 |
| L-11 | Clinicians | Email 10 local PCOS-aware clinicians and dietitians with the card draft | Hook 9 |
| L-10 | Video | "Honest ranges vs. a fake 28 days" | Hook 6 |
| L-9 | Communities | Helpful post: "Questions people ask their doctor about PCOS (with the guideline source)", app mentioned once, disclosed | Hook 1 |
| L-8 | Video | What the AI would send, shown in the preview sheet | Hook 8 |
| L-7 | Landing page | Check the price-test numbers; keep the better variant | — |
| L-6 | Video | Privacy: "where your log lives" | Hook 5 |
| L-5 | Communities | Answer comments and questions only | — |
| L-4 | Video | Treatment check walkthrough (demo data, labelled as demo) | Hook 4 |
| L-3 | Email | Waitlist email: the date, the founding-member offer and its end date | Hook 3 |
| L-2 | Video | Behind the scenes: the clinician review (only once it is done) | — |
| L-1 | Email | "Tomorrow" to the waitlist | — |
| **L** | All | **Launch:** store links, founding member $19.99/year until L+30 or the first 1,000 | Hooks 1 and 3 |
| L+1 | Video | Unboxing the first summary (demo data) | Hook 1 |
| L+2 | Communities | Launch note where moderators allowed it | Hook 5 |
| L+3 | Email | "How to get your first summary in 7 days" | Hook 2 |
| L+5 | Video | Pack vs. subscription, plainly | Hook 10 |
| L+7 | Clinicians | Deliver the printed cards to clinics that agreed | Hook 9 |
| L+8 | Video | Reply to the most common comment | — |
| L+10 | Email | Week-one baseline reminder | — |
| L+12 | Video | The metformin and inositol "what changed" view | Hook 4 |
| L+14 | Communities | Ask users (real ones, opt-in) what's missing | — |
| L+16 | Email | "Founding price ends in 14 days" (true date) | — |

**When there's nothing new to post:**
- How the clinician review changed the wording.
- Reading the 2023 guideline in plain language, with citations.
- What Cyra chose not to build (food tracking, streaks), and why.

### 5. Budget and the numbers

**The cap on acquisition cost**
- Each pack keeps **$6.49** (`cfo.md`).
- The panel gave no repeat data. 18 of 20 framed paying as "before my next appointment". Assuming **two appointments a year** (an assumption, not a panel number), one paying woman is worth about **2 × $6.49 = $12.98** in year 1.
- So the most you can pay to win a *paying* customer is about **$13**. To keep half as margin, aim for $6.50 or less.
- If 1 in 5 free users ever pays (also an assumption), the cap on a free *install* is about $2.60. That is why paid ads are off the list.

**Budget for the first 30 days: $500**

| line | amount |
| --- | ---: |
| Landing-page price test (`pricing.md`) | $300 |
| Clinician cards, printing | $100 |
| One disclosed creator test post, after the waitlist converts above 2% | $100 |

**Three numbers to watch weekly**

| number | healthy | change something if |
| --- | --- | --- |
| Waitlist sign-up rate (landing-page views to sign-ups) | ≥ 5% | under 2% for two weeks: rework the hook and page |
| First-summary rate (installs that create a first summary within 14 days) | ≥ 30% | under 15%: the log or onboarding is too heavy |
| Paid conversion (women with a first summary who buy a pack within 60 days) | ≥ 10% | under 5% after 60 days: the summary isn't changing appointments; talk to 10 users before spending more |

**Rules**
- Panel quotes are research only. They never appear in ads.
- There are no reviews, ratings or testimonials yet; none appear anywhere until real users give them.

## Brand

**Not legal advice.** Searches below are public web searches from this session. Only a trademark lawyer can clear a name, and nothing is registered until you register it.

### 0. The name problem (read first)

**"Cyra" is already in use for the same product, for the same buyer.** Searches on 2026-10-30 found:
- **"Cyra – PCOS & Cycle Tracker"**, a live iOS App Store listing with a free tier, a yearly subscription with a 3-day trial, and the line "not a diagnosis or a substitute for medical care". ([appshunter listing](https://appshunter.io/ios/app/cyra-pcos-and-cycle-tracker/id6772643056); [hunted.space](https://hunted.space/product/cyra-pcos))
- **Cyra**, an Australian women's-health startup tracking PCOS, endometriosis and adenomyosis symptoms to share with doctors. ([Illawarra Mercury](https://www.illawarramercury.com.au/story/9310178/young-tech-entrepreneur-motivated-to-improve-womens-health/))
- Near neighbours in health: **Syra Health** (a Nasdaq-listed US health company), **Kyra Health**, **Nyra** (a feminine-health app), **Myra** (a cycle app), and **Cystra: PCOS Tracker & Diet**. ([Syra](https://www.marketbeat.com/earnings/reports/2025-3-11-syra-health-corp-stock), [Kyra](https://pitchbook.com/profiles/company/812067-04), [Nyra](https://www.mobihealthnews.com/content/asia-pacific/nyra-app-launched-help-women-manage-feminine-health), [Myra and Cystra](https://appshunter.io/ios/app/myra-cycle-syncing-and-fertility/id6450864090))
- No exact USPTO record for "CYRA" turned up in aggregator results; the closest was CyRa B.V. in unrelated classes ([trademarkdir](https://trademarkdir.com/owner/cyra-b-v)). That does **not** clear the name. A same-name app in the same store category is a confusion and App Store rejection risk on its own.

**Recommendation: do not launch publicly as "Cyra" until a trademark lawyer has looked.** Choose a replacement now, so the waitlist, handles and store listing start under the final name. The app's code calls itself Cyra in many places; renaming the visible name is a contained change.

### 1. Ten name candidates

| # | name | style | what it says | out loud / on an icon | risk |
| --- | --- | --- | --- | --- | --- |
| 1 | **Cyra** (keep) | invented | short, soft | easy; good icon letter | **Same-name PCOS app already live** |
| 2 | **Heard** | evocative | "be taken seriously at your appointment", the panel's #1 want | one syllable, strong; "H" icon | Common word; likely crowded marks in software; check class 9/44 |
| 3 | **Folio** | descriptive-evocative | your health folder for appointments | clear; "F" or folder mark | Generic word; many "Folio" software marks |
| 4 | **Kept** | evocative | your log, kept on your phone; you kept track | short, unusual; risk of "kept" sounding passive | Generic word |
| 5 | **Ledger Rose** | evocative | a record, with warmth | two words, long on an icon | "Ledger" is a big crypto brand |
| 6 | **Ovaly** | invented | ovary + "only you" | cute; might read as an egg brand | Close to "Ovia" (a competitor) |
| 7 | **Notewell** | descriptive | notes that serve you well | clear; long | Low |
| 8 | **Evidently** | evocative | "bring evidence", with a light wink | 4 syllables; long on an icon | Common word |
| 9 | **Marlow** | invented / person-like | warm, human | easy; "M" icon | Common surname; several brands |
| 10 | **Tally** | descriptive | counting days honestly | easy; friendly | Tally is a forms company (tally.so) |

**Shortlist:**
- **Heard**: the strongest fit with the positioning. Pair it with a descriptor, e.g. "Heard: PCOS appointment log".
- **Notewell**: the lowest conflict risk.
- **Folio**: the clearest about the core feature.

Keep **Cyra** only if the lawyer finds the existing app's rights weak.

**Checks you must run** (domain lookups were blocked from this session, so none are confirmed):
- **Trademark:**
  - USPTO Trademark Search: https://tmsearch.uspto.gov/
  - UKIPO: https://www.gov.uk/search-for-trademark
  - EUIPO eSearch: https://euipo.europa.eu/eSearch/
  - CIPO: https://ised-isde.canada.ca/cipo/trademark-search/srch
  - **Classes to search:**
    - 9: downloadable software and apps
    - 42: SaaS and software services
    - 44: medical and health information services
- **Domains:** check `<name>.com`, `<name>.app` and `<name>.health` at any registrar.
- **App stores:** search the name in the App Store and Google Play, Health & Fitness and Medical categories.
- **Handles:** check Instagram, TikTok, X and YouTube for `@<name>`, `@<name>app` and `@<name>health`.
- **Confusion:** stay away from the -yra sound family (Syra, Kyra, Nyra, Myra) and from Ovia, Flo and Clue.

### 2. Voice and promise

**The promise:** *Your log stays yours, and your next appointment starts with evidence, not memory.*

**Tagline options**
1. "Walk in with evidence."
2. "Your cycles, on the record."
3. "The private log that gets you heard." (pairs with the name **Heard**)

**Voice: calm, plain, on her side.**

| adjective | do | don't |
| --- | --- | --- |
| Calm | Short sentences; one idea at a time; "a few more logs will show more" | Urgency, streaks, "you missed a day!" |
| Plain | Say exactly what happens to her data; name the guideline | Jargon, "AI-powered insights", "revolutionary" |
| On her side | Believe her symptoms; frame findings as questions for her clinician | Diagnosing, promising outcomes, weight talk |

**Before / after (from `pitch-v1.md`):**
- Before: "Cyra Pro, $4.99 a month or $39.99 a year: a weekly AI write-up and chat about your own log…, the full library of short breathing and grounding practices, and an optional encrypted backup."
- After: "Your first appointment summary is free. Need another? $7.99 covers your next appointment, with no subscription."

### 3. The look (brief)

These colours are already built into the app (design system v2), with contrast measured in the build:

| colour | hex | job | contrast |
| --- | --- | --- | --- |
| Paper | `#FAF7F4` | warm background, never stark white | — |
| Ink | `#1E2132` | text | 15.9:1 on white cards |
| Periwinkle | `#4A5DB0` | the one accent: buttons, links, the cycle ring | 5.40:1 on paper (AA for text) |
| Night paper | `#131520` | dark-mode background | ink `#E9EAF3` on it is AA-plus |

Keep one accent. Per-stage accents exist in the app, but marketing uses periwinkle only.

**Type**

These are already in the app. Both are free under the SIL Open Font License from Google Fonts. Self-host the font files rather than loading them from Google, to keep the no-tracking promise.
- **Display: Fraunces**, a soft serif, for headings and big numbers.
- **Text: Karla**, a readable sans, for body text and UI.

**Logo brief**
- **What it must say:** a private record, warm not clinical, not a uterus and not a flower.
- **Where it must work:**
  - a 32px app icon;
  - a clinic card printed in one colour;
  - a TikTok avatar.
- **Avoid:**
  - pink-on-pink;
  - moons and goddesses;
  - eggs;
  - anything resembling Flo's, Clue's or the existing Cyra's marks.
- **Direction:** a lowercase wordmark in Fraunces, plus a simple mark of a folded page or ring with a single dot (a day logged). No image tool is connected in this session, so no concepts are generated; any concepts made later are concepts, not a finished logo.

### 4. The first five touchpoints

1. **Landing page:**
   - Headline (hook 1): "Walk in with evidence."
   - One screenshot of the one-page summary (demo data, labelled).
   - Three facts: on your phone, first summary free, weight off by default.
   - The waitlist button.
2. **Store listing:**
   - The first screenshot is the summary.
   - The first line of the description says "not a diagnosis or a medical device".
   - The privacy label matches what the app really does.
3. **Purchase confirmation** (the app's equivalent of packaging and receipt): "Your pack covers 30 days around your appointment. Nothing renews. Your log stays on your phone."
4. **First social post:**
   - The founder, on camera, showing the summary page.
   - "Why I built this", no claims.
   - Disclose that it is the founder's own app.
5. **Reply to the first complaint:**
   - Thank her.
   - Say exactly what happened and what Cyra (or the new name) will change, and by when.
   - Never ask her to edit a review.
   - Template: "You're right that [X]. Here's what happened: [Y]. We're changing [Z] by [date]. Thank you for telling us."

## Operations

A software business with one founder. "Opening" means the app is live in the stores and the backend is up. Most of the work is support, releases, content and staying compliant. **Not legal advice.** The rules below vary by country and US state and change often; confirm each with the official source or a professional.

### 1. The daily cycle (✱ = the customer sees it)

1. Check the backend is up: the status page plus the `/api/ai/status` reply. Five minutes.
2. ✱ Answer support email and store reviews within 24 hours, using the complaint routine (§4).
3. Glance at the waitlist and store dashboards: installs, first summaries, packs bought. These are aggregate store numbers; the app sends no analytics.
4. ✱ Post one piece of content (marketing calendar).
5. Two to three hours of product work toward the offer's build list (`offer.md` §3).
6. Weekly: release if anything changed (§4, release routine), reconcile store payouts, review the three numbers in `marketing.md` §5.

### 2. Suppliers (every cost in `numbers.json`)

| need | supplier | published price / how to get one | terms | source |
| --- | --- | --- | --- | --- |
| iOS distribution and in-app purchase | Apple Developer Program | $99 a year; 15% commission under the Small Business Program (apply separately) | annual; payouts monthly | https://developer.apple.com/programs/ · https://developer.apple.com/app-store/small-business-program/ |
| Android distribution and billing | Google Play Console | $25 one-time; 15% on subscriptions, and on the first $1M a year for enrolled developers | payouts monthly | https://play.google.com/console/about/ · https://support.google.com/googleplay/android-developer/answer/112622 |
| Backend hosting | Render (current); alternatives Fly.io, Railway | the static site is on the free tier; the web service is a paid tier, so check the current price | monthly, card | https://render.com/pricing · https://fly.io/docs/about/pricing/ · https://railway.com/pricing |
| AI (Pro write-up and chat) | Anthropic API, through the existing backend proxy | per-token, model-dependent: **check the live price list and set a monthly spend limit in the console** | prepaid credits or invoice | https://www.anthropic.com/pricing |
| Domain and email | any registrar (Cloudflare Registrar, Namecheap); email from Fastmail or Proton | at-cost or about $10–15 a year for the domain; about $5 a month for email | annual / monthly | https://www.cloudflare.com/products/registrar/ · https://www.fastmail.com/pricing/ · https://proton.me/mail/pricing |
| Clinician review | a PCOS-aware OB-GYN, endocrinologist or registered dietitian; a university clinic or a PCOS charity's medical adviser | **quote needed**; the $1,500 in `numbers.json` is an estimate | fixed-fee review of `docs/CLINICIAN-REVIEW.md` and `docs/EVIDENCE.md` | — |
| Legal review | a privacy and health-tech lawyer, or a startup legal service | **quote needed**; the $2,500 is an estimate | fixed fee for the privacy policy, terms and a state health-data law check | — |
| Independent privacy review (later, before PR or ads) | Mozilla *Privacy Not Included* (free, editorial, can't be bought); a paid security audit firm | **quote needed** | — | https://foundation.mozilla.org/en/privacynotincluded/ |
| Clinic cards | any online printer (Vistaprint, Moo) | about $20–60 per 100–250 cards | 3–7 days | https://www.vistaprint.com/ · https://www.moo.com/ |

`numbers.json` is unchanged: no real quote has replaced an estimate yet. When the clinician and lawyer quotes arrive, update them and re-run `/founder-cfo`.

### 3. People

| role | who | slow first month | at plan (3 packs a day) |
| --- | --- | --- | --- |
| Product, support, content, ops | the founder | about 20–30 hrs a week: build-list work, community, video | about 15 hrs a week support and ops, the rest growth |
| Clinician reviewer | contractor, fixed fee | one review before launch, then on every medical wording change | as needed |
| Lawyer | contractor, fixed fee | before launch; again if accounts or new states are added | as needed |

**Wages:** none in `numbers.json`. The founder's pay is the biggest open decision (see `cfo.md`: $3,000 a month raises break-even to 16 packs a day). **Ask an accountant** about self-employment tax and how to pay yourself from an LLC.

### 4. Routines

**Release (weekly, or when needed)**
1. Merge to `main` only after the full test set passes (the repo's suites, axe light and dark, `npm run build`, and the stamp check).
2. Render deploys the web app. Hard-reload the live site and check the build stamp.
3. For store builds, run `npx cap sync`, then build iOS and Android and upload. Write release notes in plain words and list privacy-relevant changes.
4. If any medical or privacy sentence changed, it must already be in `docs/CLINICIAN-REVIEW.md` or `docs/PRIVACY-AUDIT.md` with sign-off.
5. Watch support and reviews for 48 hours after a store release.

**Core service: the first summary works**
1. Every new install should reach a first summary within 7 days. The app guides this through its own onboarding.
2. Weekly, compare installs with packs bought in the store dashboards. If the share of installs reaching a first summary (from the opt-in user interviews, since there is no in-app analytics) looks low, talk to five users.

**Complaint**
1. Reply within 24 hours: thank her, and state exactly what happened.
2. If it's a bug, reproduce it, fix it, and give the date of the fixing release.
3. If it's about money, point her to the store's refund process (Apple: reportaproblem.apple.com; Google: Play order history). Cyra can't refund store purchases directly. Never argue.
4. If it involves data or privacy, escalate to the incident routine at once.
5. Log it in a private issue list, with no health data copied in.

**Privacy incident** (the FTC Health Breach Notification Rule can apply to health apps; confirm with the lawyer)
1. Stop the leak: switch off the affected feature flag or backend module.
2. Write down what was exposed, for whom, and when.
3. Call the lawyer the same day about notification duties: the FTC rule, and state laws such as Washington's My Health My Data Act.
4. Tell affected users plainly and quickly.

**Weekly review (Monday, 30 minutes)**
1. Review the three marketing numbers against their thresholds.
2. Check Anthropic spend against the console limit.
3. Check the hosting bill.
4. Clear the support backlog.
5. Pick one thing from the build list for the week.

### 5. Tools (the smallest stack)

| job | tool | price | why |
| --- | --- | --- | --- |
| Payments | App Store and Google Play in-app purchase | the 15% commission | Required for digital goods sold in-app; handles tax |
| Waitlist and price test | a static page on the existing Render site plus a form service that doesn't track (Tally, or Formspree) | free tiers | No new SDK in the app |
| Bookkeeping | Wave (free), or QuickBooks Simple Start | free / paid | Store payouts and a few bills |
| Support | a shared inbox on the email provider | included | Low volume |
| Monitoring | Render's dashboard plus a free uptime pinger (UptimeRobot, Better Stack free tier) | free | Know when the backend is down before users do |
| Code and CI | GitHub, the existing repo and test suites | free | Already in place |

None of these tools may receive health data. That keeps the privacy claims true.

### 6. Licences, permits and insurance checklist (US-first)

| item | why | where to confirm |
| --- | --- | --- |
| Business entity (for example an LLC) in your state | liability; store accounts as an organisation | your Secretary of State's site; https://www.sba.gov/business-guide/launch-your-business/choose-business-structure |
| EIN | banking, store payouts | https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online |
| D-U-N-S number (Apple organisation accounts) | needed to enrol as an organisation | https://developer.apple.com/support/D-U-N-S/ |
| Sales tax on app sales | Apple and Google act as marketplace facilitators in most places; confirm with the accountant | — |
| FDA: stays a general-wellness / non-device app | the wording must not diagnose or treat. Keep "guidance, not diagnosis" and the clinician review | https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices |
| FTC Health Breach Notification Rule | applies to many health apps not covered by HIPAA | https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0 |
| State consumer health-data laws (Washington My Health My Data Act, and Nevada's and Connecticut's equivalents) | consent and deletion rights for health data | Washington AG: https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy |
| HIPAA | usually **not** applicable to a direct-to-consumer app that isn't working for a provider or insurer. Confirm with the lawyer before any clinician partnership | https://www.hhs.gov/hipaa/for-professionals/special-topics/health-apps/index.html |
| App Store and Play health-app rules | Apple guideline 5.1.3 (health data); Google Play's Health apps declaration | https://developer.apple.com/app-store/review/guidelines/#health-and-health-research · https://support.google.com/googleplay/android-developer/answer/14738291 |
| Age rating | the target is adults; set the store rating accordingly and do not target under-13s (COPPA) | https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy |
| Insurance | technology errors and omissions plus cyber liability; ask a broker | — |

### 7. Risk register

| # | risk | likelihood | impact | plan |
| --- | --- | --- | --- | --- |
| 1 | **Name conflict.** An existing "Cyra – PCOS & Cycle Tracker" app objects, or a store rejects the listing for confusion | high | high | Lawyer check now; pick a replacement name before the waitlist (`brand.md`) |
| 2 | App Store review rejects the health claims or the privacy label | medium | high | Clinician-reviewed wording; a privacy label that matches the build; no diagnosis language |
| 3 | Women download the app, use the free summary, and never pay | high | high | It's the core risk. The pilot measures it; if paid conversion stays under 5% at 60 days, rethink the offer before spending |
| 4 | Users stop logging after two weeks | high | medium | 3-tap log, week-one baseline, appointment-date reminders |
| 5 | AI costs spike or the API goes down | low | medium | Console spend limit; the app already says plainly when AI isn't available; the core works without AI |
| 6 | Backend outage | low | low | The core is on-device; only AI and the account backup depend on the server; uptime pinger |
| 7 | Privacy claim found untrue (a bug sends something) | low | very high | Flags e2e tests prove zero requests; incident routine; independent review before PR |
| 8 | Founder burnout or illness | medium | high | Releases weekly at most; support templates; nothing in the product needs daily attention |
| 9 | A big competitor ships a PCOS mode plus an AI summary | medium | medium | Compete on trust and clinician adoption, not features; move fast on clinic cards |
| 10 | Bad public review about predictions for very irregular cycles | medium | medium | Honest wide ranges and wording already in the app; reply with the complaint routine; never promise accuracy |

## Launch plan

**Target public launch: Tuesday 26 January 2027.** That is the earliest realistic date given the lead times in `ops.md`:
- choosing the name and checking it with a lawyer
- clinician and legal review (about 2–4 weeks each, run in parallel)
- setting up the company and Apple organisation accounts (up to about 2 weeks)
- the build list in `offer.md` (about 4–6 weeks for one founder)
- a 6-week real-user pilot

No date has been given by the founder. Move everything if you pick another one.

Owner of every task: the founder (F), unless a contractor is named.

### 1. Test before you spend

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

### 2. The countdown (weekly blocks; ★ = critical path)

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

### 3. Launch day run sheet (Tue 26 Jan 2027, your time zone)

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

### 4. The first 30 days

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

_The panel is simulated buyers and the numbers are projections from your inputs. Confirm demand with real customers and costs with real quotes before you spend. Not financial, legal or tax advice._
