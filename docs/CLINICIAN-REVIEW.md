# Clinician review register

Every sentence in Cyra that states something about a condition, a practice, an exercise or a marker is listed here
with where it appears and the named source it rests on. Nothing in this file is shown to users. A sentence ships to a
public release only after a clinician has signed it off here (name, role, date). Until then its status reads
"Awaiting clinician sign-off". Framing rules for every entry: an association or what a guideline describes, never a
diagnosis, never treatment advice; near insights, "Associations to raise with your clinician, not a diagnosis or
medical advice." (`MODULE_FRAMING`, src/lib/modules.js). Practices and movement plans also carry "wellbeing support,
not treatment" (R5 adds them here with docs/EVIDENCE.md).

The POTS add-on's safety, result, pattern, movement and Ask copy has its own sign-off item (Q1) recorded in
docs/PRIVACY-AUDIT.md; it is not repeated here.

## Sources cited

- **teede2023** — Recommendations from the 2023 International Evidence-based Guideline for the Assessment and
  Management of Polycystic Ovary Syndrome. Teede HJ, Tay CT, Laven JJE, et al., International PCOS Network (Monash
  University with ESHRE, ASRM and partner societies); published together in Fertility and Sterility, Human
  Reproduction, the Journal of Clinical Endocrinology & Metabolism and the European Journal of Endocrinology. 2023.
- **rotterdam2004** — Revised 2003 consensus on diagnostic criteria and long-term health risks related to polycystic
  ovary syndrome. The Rotterdam ESHRE/ASRM-Sponsored PCOS Consensus Workshop Group. Fertility and Sterility
  81(1):19–25; Human Reproduction 19(1):41–47. 2004 (criteria agreed 2003).
- **nicecks** — Polycystic ovary syndrome, NICE Clinical Knowledge Summaries (cks.nice.org.uk). Listed in the module's
  evidence for the reviewer's cross-check; no sentence cites it alone yet. Its revision date (recorded as 2023) is to
  be confirmed at review.

## PCOS module (calm R1; src/lib/modules.js `MODULES.pcos`)

Data only in R1: no screen shows these yet (R2 onboarding, R4 Body, R5/R6 Ask and patterns, R7 You surface them).
The unit test `modules.test.mjs` fails if a medical sentence in the module is missing from this file or has no source.

### pcos.cycle.expected
- Where: Body → Cycles, PCOS cycle wording (R4)
- Text: Long or missed cycles are common with PCOS. Cyra shows them as part of your pattern, not as mistakes.
- Sources: Recommendations from the 2023 International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome (2023); Revised 2003 consensus on diagnostic criteria and long-term health risks related to polycystic ovary syndrome (2004)
- Status: Awaiting clinician sign-off

### pcos.cycle.definition
- Where: Body → Cycles, PCOS cycle wording (R4)
- Text: For adults, the international PCOS guideline describes cycles shorter than 21 days or longer than 35 days, or fewer than eight a year, as irregular.
- Sources: Recommendations from the 2023 International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome (2023)
- Status: Awaiting clinician sign-off

### pcos.signal.acan
- Where: Body → PCOS signals logger (R4)
- Text: Darker, velvety patches of skin, often on the neck or in the armpits, are listed among signs linked with insulin resistance. Worth raising with your clinician if you notice them.
- Sources: Recommendations from the 2023 International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome (2023)
- Status: Awaiting clinician sign-off

### pcos.ask.pcos-long-cycles
- Where: Ask library: "Why are my cycles so long?" (R5/R6)
- Text: Irregular or long cycles are one of the features the 2023 international PCOS guideline describes. For adults it calls cycles under 21 or over 35 days, or fewer than eight a year, irregular. Cyra counts cycles longer than 35 days so you can show your clinician the pattern.
- Sources: Recommendations from the 2023 International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome (2023)
- Status: Awaiting clinician sign-off

### pcos.ask.pcos-diagnosis
- Where: Ask library: "How is PCOS diagnosed?" (R5/R6)
- Text: Clinicians use the Rotterdam criteria as refined by the 2023 guideline: two of irregular cycles, signs of higher androgens (such as excess hair growth or acne, or a blood test) and ovary findings on ultrasound or an AMH blood test in adults, once other causes are ruled out. Cyra does not diagnose PCOS.
- Sources: Revised 2003 consensus on diagnostic criteria and long-term health risks related to polycystic ovary syndrome (2004); Recommendations from the 2023 International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome (2023)
- Status: Awaiting clinician sign-off

### pcos.ask.pcos-labs
- Where: Ask library: "Which numbers from my blood tests can I add?" (R5/R6)
- Text: The guideline recommends that blood sugar is checked (for example fasting glucose or HbA1c) when PCOS is diagnosed and every one to three years after. You can type values from your own results with their unit and date. Cyra keeps them on this device and does not interpret them.
- Sources: Recommendations from the 2023 International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome (2023)
- Status: Awaiting clinician sign-off

### pcos.ask.pcos-skin
- Where: Ask library: "What is skin darkening on the neck?" (R5/R6)
- Text: Darker, velvety skin, often on the neck or in the armpits, is called acanthosis nigricans. The guideline lists it among signs linked with insulin resistance. It is worth mentioning to your clinician.
- Sources: Recommendations from the 2023 International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome (2023)
- Status: Awaiting clinician sign-off

### pcos.ask.pcos-mood
- Where: Ask library: "Can PCOS affect my mood?" (R5/R6)
- Text: The guideline notes that depression and anxiety are more common with PCOS and recommends that clinicians ask about them. Logging mood next to sleep and cycles can help that conversation.
- Sources: Recommendations from the 2023 International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome (2023)
- Status: Awaiting clinician sign-off


### pcos.wording (non-medical, for the reviewer's context)
- The module describes itself as: "Adds PCOS symptoms, insulin-resistance signals, PCOS-aware cycle wording, pattern
  questions and a Report section. It does not diagnose PCOS."
- Pattern questions (sleep vs fatigue, high-sugar days vs cravings/energy, movement vs mood, cycle length over time)
  are reported as associations in her own log, with `MODULE_FRAMING`.
- Lab values (fasting glucose in mg/dL or mmol/L, HbA1c in % or mmol/mol) are stored as she types them, with the test
  date; Cyra never interprets them.
- Reviewer questions: (1) is "Long or missed cycles are common with PCOS" acceptable lay wording for the guideline's
  irregular-cycle feature; (2) should the high-sugar day marker carry any caution about food anxiety or disordered
  eating; (3) confirm the NICE CKS revision date.
- Status: Awaiting clinician sign-off

## Home: Today's small step (calm R3; src/lib/home.js `STEPS`)

One optional, rule-based suggestion on Home, with a "Why" line. Only the steps that say what a practice or signal does
are listed (the others are logging prompts). `home.test.mjs` fails if a sourced step's Why line is missing here.

### home.step.breathe
- Where: Home → Today's small step, after a rough night is logged today
- Text: After a rough night, slow breathing (around six breaths a minute) is linked with feeling calmer in small studies. Wellbeing support, not treatment.
- Sources: How Breath-Control Can Change Your Life: A Systematic Review on Psycho-Physiological Correlates of Slow Breathing (Zaccaro A, Piarulli A, Laurino M, et al. Frontiers in Human Neuroscience 12:353, 2018); also in docs/EVIDENCE.md
- Reviewer question: is "in for about 4, out for about 6, for three minutes" acceptable as a generic instruction (no breath holds)?
- Status: Awaiting clinician sign-off

### home.step.pcos
- Where: Home → Today's small step, PCOS module on and no PCOS symptom logged today
- Text: Energy crashes after meals and cravings are among the signals the PCOS module keeps next to your cycles, to show your clinician. Associations, not a diagnosis.
- Sources: Recommendations from the 2023 International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome (2023)
- Status: Awaiting clinician sign-off

### home.insight.pcos-cycle-length
- Where: Home → Today's insight (PCOS module on, two or more counted cycles)
- Text: In your log, {n} of your last {m} cycles ran over 35 days. / In your log, none of your last {m} cycles ran over 35 days. (Shown with MODULE_FRAMING under the insight.)
- Sources: the 35-day threshold of the 2023 international PCOS guideline (see pcos.cycle.definition)
- Status: Awaiting clinician sign-off

## Body: the fast log and PCOS surfaces (calm R4; src/lib/bodylog.js, components/BodySheets.jsx, screens/CyclesScreen.jsx)

No new medical claim was written in R4; registered PCOS sentences are now shown in new places, and the loggers add
labels only. Listed so the reviewer sees each placement.

### body.pcos.sheet
- Where: Body → Logs → PCOS signals (sheet), PCOS module on
- Shows: chips "Energy crash after meals", "Cravings", "Skin darkening (neck, armpits)" under "Insulin-resistance
  signals"; "Hair loss", "Excess hair growth", "Pelvic pain" under "PCOS symptoms"; "High-sugar day" under "Day marker";
  the acanthosis line (pcos.signals.acan, sourced teede2023) behind "About skin darkening"; MODULE_FRAMING at the foot.
- Lab entry: fasting glucose (mg/dL or mmol/L), HbA1c (% or mmol/mol), waist (cm or in), each dated. A typo guard
  rejects values outside 20–600 mg/dL, 1–33 mmol/L, 3–20 %, 9–195 mmol/mol, 40–200 cm, 16–80 in ("That looks outside
  … Check the number?"). These are not clinical ranges and nothing is interpreted.
- Reviewer questions: (1) is grouping these chips as "Insulin-resistance signals" acceptable lay wording; (2) are the
  typo-guard bounds wide enough for real results; (3) the unit conversion shown when she switches units uses
  mg/dL = mmol/L × 18 and IFCC mmol/mol = (% − 2.15) × 10.929 — acceptable?
- Status: Awaiting clinician sign-off

### body.cycles.pcos-long
- Where: Body → Cycles, PCOS module on
- Text: "{n} of your {m} finished cycles on record." under "Cycles longer than 35 days", with pcos.cycle.expected and,
  behind "What counts as a long cycle", pcos.cycle.definition (sourced teede2023) and MODULE_FRAMING.
- Status: Awaiting clinician sign-off

### body.weight
- Where: Body → Logs → Weight (only after she turns it on with "Add weight to your log (optional)")
- Text: pcos.weight.note. Weight is never on Home and never charted.
- Reviewer question: should the weight logger carry any wording for people with a history of disordered eating (see
  also the high-sugar marker question above)?
- Status: Awaiting clinician sign-off

## Mind: practices library (calm R5; src/lib/mind.js `PRACTICES`, screens/PracticesScreen.jsx, components/mind/PracticeSheet.jsx)

Short guided practices grouped by need (Feel calmer, Ease worry, Clear brain fog, Lift low energy, Wind down & rest).
Each carries its evidence line, named sources and "Wellbeing support, not treatment." or "Comfort, not treatment.".
`mind.test.mjs` fails if a practice's evidence text is missing here or in docs/EVIDENCE.md, if a non-comfort practice
has no source, or if the data uses diagnosis, cure, treat-claims, streak or score words. The check-in's suggestion
lines ("You said your head feels foggy." …) only repeat what she tapped and are not listed.

### mind.practices.footer
- Where: Mind → Practices, end of the page
- Text: Practices are wellbeing support, not treatment. If low mood or worry is staying with you, or you feel unsafe, talk to your doctor, or call your local emergency number.
- Reviewer question: should a named crisis line be shown per locale (no network call; a static list)?
- Status: Awaiting clinician sign-off

### mind.practice.slow
- Where: Mind → Practices and the practice sheet; can be suggested as "Your next practice" on Mind → Today
- Text (evidence): Breathing at around six breaths a minute is linked with a calmer body (higher heart-rate variability) and calmer mood in healthy adults; trials of breathwork show small-to-medium drops in stress. Most studies are small. Wellbeing support, not treatment.
- Text (instructions): In for 4, out for 6: about six breaths a minute. Paced for 3 minutes.
- Sources: How Breath-Control Can Change Your Life: A Systematic Review on Psycho-Physiological Correlates of Slow Breathing (Zaccaro A, Piarulli A, Laurino M, et al. Frontiers in Human Neuroscience 12:353, 2018); Effect of breathwork on stress and mental health: a meta-analysis of randomised-controlled trials (Fincham GW, Strauss C, Montero-Marin J, Cavanagh K. Scientific Reports 13:432, 2023); also in docs/EVIDENCE.md
- Status: Awaiting clinician sign-off

### mind.practice.box
- Where: Mind → Practices and the practice sheet
- Text (evidence): In a one-month randomised trial with healthy adults, five minutes a day of structured breathing, box breathing among them, lifted mood; practices with a long, slow out-breath did best. Wellbeing support, not treatment.
- Text (instructions): In 4, hold 4, out 4, hold 4. Paced for 3 minutes.
- Text (caution): If holding your breath feels uncomfortable, skip the holds and just breathe slowly.
- Sources: Brief structured respiration practices enhance mood and reduce physiological arousal (Balban MY, Neri E, Kogon MM, et al. Cell Reports Medicine 4(1):100895, 2023); also in docs/EVIDENCE.md
- Status: Awaiting clinician sign-off

### mind.practice.ground
- Where: Mind → Practices and the practice sheet; can be suggested as "Your next practice" on Mind → Today
- Text (evidence): A widely used way to bring attention back to the present. We found no controlled trials of this exact exercise, so it is offered as a comfort. Comfort, not treatment.
- Text (instructions): Look around. Name five things you can see. / Notice four things you can feel: your feet, your clothes, the chair. / Listen for three things you can hear. / Find two things you can smell, or two scents you like. / Notice one thing you can taste, or take a sip of water. / Take one slow breath out. You're here.
- Sources: none (comfort, not treatment); also in docs/EVIDENCE.md
- Status: Awaiting clinician sign-off

### mind.practice.reframe
- Where: Mind → Practices and the practice sheet; can be suggested as "Your next practice" on Mind → Today
- Text (evidence): Noticing and re-weighing thoughts is a core skill of cognitive behavioural therapy (CBT). NICE recommends guided self-help based on CBT as a first option for less severe depression. This short exercise is one piece of that, not a full course. Wellbeing support, not treatment.
- Text (instructions): Name the thought that keeps coming back, in a few words. / What makes it feel true? What doesn't quite fit? / What would you say to a friend who had this thought? / Try a more balanced version of it. It doesn't need to be positive, just fair. / Notice how strongly you believe the first thought now.
- Sources: Depression in adults: treatment and management (NG222) (National Institute for Health and Care Excellence (NICE) guideline, 2022); also in docs/EVIDENCE.md
- Status: Awaiting clinician sign-off

### mind.practice.pause
- Where: Mind → Practices and the practice sheet; can be suggested as "Your next practice" on Mind → Today
- Text (evidence): Reviews of brief mindfulness training find a small easing of stress, worry and low mood compared with control activities; the effect is modest and some studies may be unpublished. Wellbeing support, not treatment.
- Text (instructions): Sit comfortably. Notice what's on your mind right now, without changing it. / Bring your attention to your breathing. Follow a few breaths in and out. / Widen your attention to your whole body, then to the sounds around you.
- Sources: Brief mindfulness training for negative affectivity: a systematic review and meta-analysis (Schumer MC, Lindsay EK, Creswell JD. Journal of Consulting and Clinical Psychology 86(7), 2018); also in docs/EVIDENCE.md
- Status: Awaiting clinician sign-off

### mind.practice.step
- Where: Mind → Practices and the practice sheet; can be suggested as "Your next practice" on Mind → Today
- Text (evidence): Behavioural activation, scheduling small rewarding or meaningful activities, reduced symptoms of depression in randomised trials; many trials were of modest quality. Here it is one small step, not a programme. Wellbeing support, not treatment.
- Text (instructions): Think of one small thing you've been putting off or would enjoy: a text, a tidy shelf, stepping outside. / Make it smaller still, something you could do in the next few minutes. / Do it now. Take your time. / Notice how you feel afterwards, even if it's only a little different.
- Sources: Behavioural activation for depression; an update of meta-analysis of effectiveness and sub group analysis (Ekers D, Webster L, Van Straten A, et al. PLoS One 9(6):e100100, 2014); also in docs/EVIDENCE.md
- Status: Awaiting clinician sign-off

### mind.practice.move
- Where: Mind → Practices and the practice sheet; can be suggested as "Your next practice" on Mind → Today
- Text (evidence): A single bout of exercise raised feelings of energy in most trials, and short bouts of exercise give a small, short-lived boost to attention and thinking. Effects are small. Wellbeing support, not treatment.
- Text (instructions): Stand up, or stay seated if standing makes you dizzy. Roll your shoulders back five times. / March on the spot or walk around the room at an easy pace. / Reach your arms up, then gently to each side. / Keep walking or marching, a little brisker if it feels good. / Slow down. Notice your breathing and how your head feels.
- Text (caution): Keep it gentle. Sit down and stop if you feel dizzy, short of breath or unwell.
- Sources: The effect of a single bout of exercise on energy and fatigue states: a systematic review and meta-analysis (Loy BD, O'Connor PJ, Dishman RK. Fatigue: Biomedicine, Health & Behavior 1(4):223–242, 2013); The effects of acute exercise on cognitive performance: a meta-analysis (Chang YK, Labban JD, Gapin JI, Etnier JL. Brain Research 1453:87–101, 2012); also in docs/EVIDENCE.md
- Status: Awaiting clinician sign-off

### mind.practice.gratitude
- Where: Mind → Practices and the practice sheet
- Text (evidence): Reviews find gratitude exercises give a small lift to wellbeing at most, and little change in low mood or anxiety compared with other activities. Offered as a comfort. Comfort, not treatment.
- Text (instructions): Think of one thing that went well today or recently, however small. / A second thing. What made it good? / A third. Who or what helped it happen? / Stay with the feeling for a moment.
- Sources: Thankful for the little things: a meta-analysis of gratitude interventions (Davis DE, Choe E, Meyers J, et al. Journal of Counseling Psychology 63(1):20–31, 2016); Gratitude Interventions: Effective Self-help? A Meta-analysis of the Impact on Symptoms of Depression and Anxiety (Cregg DR, Cheavens JS. Journal of Happiness Studies 22(1), doi 10.1007/s10902-020-00236-6, 2021); also in docs/EVIDENCE.md
- Status: Awaiting clinician sign-off

### mind.practice.pmr
- Where: Mind → Practices and the practice sheet
- Text (evidence): Progressive muscle relaxation reduced stress, anxiety and low mood in adults across many studies, often alongside other approaches; study quality varies. Wellbeing support, not treatment.
- Text (instructions): Make fists and squeeze for five seconds. Let go and feel the difference. / Lift your shoulders to your ears, hold, then let them drop. / Scrunch your face gently, hold, then soften your jaw and forehead. / Press your feet into the floor and tense your legs, hold, then release. / Tense your belly and back gently, hold, then let go. / Now let your whole body be heavy. Breathe out slowly a few times.
- Text (caution): Skip any area that hurts, and tense gently.
- Sources: Efficacy of Progressive Muscle Relaxation in Adults for Stress, Anxiety, and Depression: A Systematic Review (Muhammad Khir S, et al. Psychology Research and Behavior Management 17:345–365, 2024); also in docs/EVIDENCE.md
- Status: Awaiting clinician sign-off

### mind.practice.scan
- Where: Mind → Practices and the practice sheet
- Text (evidence): The body scan is one of the brief mindfulness practices; reviews of brief mindfulness training find a small easing of stress and low mood, a modest effect. Wellbeing support, not treatment.
- Text (instructions): Lie or sit comfortably. Let your breathing settle on its own. / Notice your feet and legs: warmth, weight, tingling, or nothing at all. / Move up to your hips, belly and back. Let them soften if they want to. / Notice your hands, arms and shoulders. / Notice your neck, jaw, face and head. / Feel your whole body breathing for a few breaths.
- Sources: Brief mindfulness training for negative affectivity: a systematic review and meta-analysis (Schumer MC, Lindsay EK, Creswell JD. Journal of Consulting and Clinical Psychology 86(7), 2018); also in docs/EVIDENCE.md
- Status: Awaiting clinician sign-off

### mind.practice.winddown
- Where: Mind → Practices and the practice sheet; can be suggested as "Your next practice" on Mind → Today
- Text (evidence): Stimulus control is one of the parts of cognitive behavioural therapy for insomnia (CBT-I); the American Academy of Sleep Medicine suggests it for adults with chronic insomnia. The full multi-part CBT-I is recommended most strongly. Wellbeing support, not treatment.
- Text (instructions): Tonight, go to bed only when you feel sleepy, not just tired. / Keep the bed for sleep and intimacy: no scrolling, work or worrying there. / If you can't sleep after about 20 minutes, get up and do something quiet in dim light. Go back when sleepy. / Get up at the same time tomorrow, however the night went. / Settle with a few slow breaths: in for 4, out for 6.
- Sources: Behavioral and psychological treatments for chronic insomnia disorder in adults: an American Academy of Sleep Medicine clinical practice guideline (Edinger JD, Arnedt JT, Bertisch SM, et al. Journal of Clinical Sleep Medicine 17(2):255–262, 2021); also in docs/EVIDENCE.md
- Status: Awaiting clinician sign-off
