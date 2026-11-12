# Clinician review register

Every sentence in Solia Health that states something about a condition, a practice, an exercise or a marker is listed here
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
- Text: Long or missed cycles are common with PCOS — part of your pattern, not a mistake. (Solia C, 2026-11-01: reworded from "Long or missed cycles are common with PCOS. Solia Health shows them as part of your pattern, not as mistakes." — same claim, shorter; on Body → Cycles it is now the one visible line under the count, and the guideline definition moved behind "What counts as long".)
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
- Text: Irregular or long cycles are one of the features the 2023 international PCOS guideline describes. For adults it calls cycles under 21 or over 35 days, or fewer than eight a year, irregular. Solia Health counts cycles longer than 35 days so you can show your clinician the pattern.
- Sources: Recommendations from the 2023 International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome (2023)
- Status: Awaiting clinician sign-off

### pcos.ask.pcos-diagnosis
- Where: Ask library: "How is PCOS diagnosed?" (R5/R6)
- Text: Clinicians use the Rotterdam criteria as refined by the 2023 guideline: two of irregular cycles, signs of higher androgens (such as excess hair growth or acne, or a blood test) and ovary findings on ultrasound or an AMH blood test in adults, once other causes are ruled out. Solia Health does not diagnose PCOS.
- Sources: Revised 2003 consensus on diagnostic criteria and long-term health risks related to polycystic ovary syndrome (2004); Recommendations from the 2023 International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome (2023)
- Status: Awaiting clinician sign-off

### pcos.ask.pcos-labs
- Where: Ask library: "Which numbers from my blood tests can I add?" (R5/R6)
- Text: The guideline recommends that blood sugar is checked (for example fasting glucose or HbA1c) when PCOS is diagnosed and every one to three years after. You can type values from your own results with their unit and date. Solia Health keeps them on this device and does not interpret them.
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
  date; Solia Health never interprets them.
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

## Patterns: weekly review experiments and pattern wording (calm R6; src/lib/experiments.js, src/lib/patterns.js)
The experiments' "why" lines below are medical-adjacent sentences. Pattern cards only repeat counts from her log as
associations ("Rough nights lined up with more headaches in your log.") with the line "Associations to raise with your
clinician, not a diagnosis or medical advice."; their advice text is the L8 copy, moved unchanged into the detail sheet.

### patterns.experiment.walk-lunch
- Where: Patterns → Weekly review (one optional experiment) and Home → small-step card while it runs
- Text: Try a 10-minute walk after lunch on 3 days this week. In small trials, light walking after a meal lowered the rise in blood sugar that follows it. Whether it changes energy dips or cravings for you is what your own log can show. Wellbeing support, not treatment.
- Sources: The Acute Effects of Interrupting Prolonged Sitting Time in Adults with Standing and Light-Intensity Walking on Biomarkers of Cardiometabolic Health in Adults: A Systematic Review and Meta-analysis (Buffey AJ, Herring MP, Langley CK, Donnelly AE, Carson BP. Sports Medicine 52(8):1765–1787, 2022); Advice to walk after meals is more effective for lowering postprandial glycaemia in type 2 diabetes mellitus than advice that does not specify timing: a randomised crossover study (Reynolds AN, Mann JI, Williams S, Venn BJ. Diabetologia 59(12):2572–2578, 2016); also in docs/EVIDENCE.md
- Status: Awaiting clinician sign-off

### patterns.experiment.winddown
- Where: Patterns → Weekly review (one optional experiment) and Home → small-step card while it runs
- Text: Try the wind-down practice on 4 nights this week. Stimulus control (keeping bed for sleep) is one part of cognitive behavioural therapy for insomnia, which sleep medicine guidelines suggest for adults with ongoing insomnia. Wellbeing support, not treatment.
- Sources: Behavioral and psychological treatments for chronic insomnia disorder in adults: an American Academy of Sleep Medicine clinical practice guideline (Edinger JD, Arnedt JT, Bertisch SM, et al. Journal of Clinical Sleep Medicine 17(2):255–262, 2021); also in docs/EVIDENCE.md
- Status: Awaiting clinician sign-off

### patterns.experiment.breathe
- Where: Patterns → Weekly review (one optional experiment) and Home → small-step card while it runs
- Text: Try three minutes of slow breathing on 4 days this week. Breathing at around six breaths a minute is linked with feeling calmer, and trials of breathwork show small drops in stress. Most studies are small. Wellbeing support, not treatment.
- Sources: How Breath-Control Can Change Your Life: A Systematic Review on Psycho-Physiological Correlates of Slow Breathing (Zaccaro A, Piarulli A, Laurino M, et al. Frontiers in Human Neuroscience 12:353, 2018); Effect of breathwork on stress and mental health: a meta-analysis of randomised-controlled trials (Fincham GW, Strauss C, Montero-Marin J, Cavanagh K. Scientific Reports 13:432, 2023); also in docs/EVIDENCE.md
- Status: Awaiting clinician sign-off

### patterns.experiment.move
- Where: Patterns → Weekly review (one optional experiment) and Home → small-step card while it runs
- Text: Try 10 to 20 minutes of movement you enjoy on 3 days this week. A single bout of exercise raised feelings of energy in most trials, with small, short-lived effects. Wellbeing support, not treatment.
- Sources: The effect of a single bout of exercise on energy and fatigue states: a systematic review and meta-analysis (Loy BD, O'Connor PJ, Dishman RK. Fatigue: Biomedicine, Health & Behavior 1(4):223–242, 2013); also in docs/EVIDENCE.md
- Status: Awaiting clinician sign-off

### patterns.marker.spread
- Where: Patterns → What you're learning (perimenopause), detail sheet
- Text: A spread of 7 days or more between cycles is the clinical marker of the menopause transition (STRAW staging). (moved from the L5 Patterns card, unchanged in substance)
- Status: Awaiting clinician sign-off

## You: module descriptions
### you.module.pcos
- Where: You → Modules → PCOS, "What it adds"
- Text: Adds a PCOS signals log, a count of cycles longer than 35 days and pattern questions about sleep, cravings, movement and cycle length. It does not diagnose PCOS.
- Sources: describes what the module's data does (lib/modules.js MODULES.pcos, whose sentences are registered above); no new clinical claim. The 35-day line is the module's own "cycles longer than 35 days" definition.
- Status: Awaiting clinician sign-off

### you.module.pots
- Where: You → Modules → POTS, "What it adds"
- Text: Adds a guided standing test, drinks and salt, symptoms, medicines, an exercise plan and a clinician report, opened from Home.
- Sources: describes the POTS page's tools (components/pots/PotsAddon.jsx's existing sentence, reworded); no clinical claim.
- Status: Awaiting clinician sign-off

### you.module.fert
- Where: You → Modules → Track fertility signs, "What it adds"
- Text: Adds cervical mucus, ovulation tests and basal temperature to your log, marked on your Calendar.
- Sources: describes the fertility-signs group (lib/fertility.js FERT_COPY.settingCycle, shortened); no clinical claim.
- Status: Awaiting clinician sign-off

## Solia Health's AI write-up and chat (calm R8)
### ai.system.frame
- Where: backend/src/modules/ai/tasks.js AI_FRAME (the system prompt for the weekly write-up and the chat)
- Text: describes associations in her own data she could raise with her clinician; never diagnose, never name or adjust a treatment, medicine, supplement or dose, never tell her to start or stop anything; never interpret a lab value (normal, high, low, worrying); never grade, score or rate her; say plainly when there is too little data; plain warm language; for an emergency or red-flag question, no discussion of the data, the emergency line instead.
- Sources: the existing Ask GUARDRAILS and red-flag list (askLibrary.js / tasks.js RED_FLAGS); no new clinical claim.
- Status: Awaiting clinician sign-off

### ai.emergency
- Where: chat, a red-flag question (on the device: AI_COPY.urgentLocal; on the server: EMERGENCY_ANSWER)
- Text: What you're describing needs care now, not an app. Please call your local emergency number (911 in the US) or go to urgent care. If you are thinking about harming yourself, call or text 988 (US) or your local crisis line. (The device version ends "Nothing was sent."; the server's "You are not overreacting by asking.")
- Sources: the same routing as Ask's existing urgent answer (askLibrary.js URGENT).
- Status: Awaiting clinician sign-off

### ai.notadvice
- Where: Patterns → Solia Health's write-up, Mind → Journey → Chat about your log
- Text: Associations to raise with your clinician, not a diagnosis or medical advice. / Written by Solia Health's AI (Claude, made by Anthropic) from your summary.
- Sources: MODULE_FRAMING (R2), unchanged wording.
- Status: Awaiting clinician sign-off

## Meal notes (optional, PCOS-linked; 2026-10-30)
No foods, calories, macros, photos or scores; no diet advice, no "good" or "bad" food, no weight. The existing PCOS
"high-sugar day" marker is unchanged.

### meals.setting
- Where: You → Modules → Meal notes (under PCOS), the row's line and "What each one adds"
- Text: Note what kind of meal it was and how your energy felt after. No calories, no photos, no scores. / A Meals row in Body, a Meals logger in the + sheet and on Home, an "Energy after meals" pattern once there are enough notes, and an optional line in your appointment PDF. Kept on this device and in your backups, like the rest of your log. An AI summary, if you use one, holds counts only.
- Sources: describes the feature; no clinical claim.
- Status: Awaiting clinician sign-off

### meals.sheet
- Where: Body → Meals sheet (#meals-sheet)
- Text: Chips "Breakfast · Lunch · Dinner · Snack"; "What it was mostly": Balanced · Mostly carbs or sweet · Protein-forward · Skipped · Ate late; "Energy after": Steady · Dipped · Crashed. Sub-line: "What kind of meal it was and how your energy felt after, {day}. Every tap saves; all of it is optional." Footer: "No calories, no photos, no scores. Kept on this device and in your backups, like the rest of your log."
- Sources: none needed (her own description of a meal); please check the kind labels read as neutral, not as a verdict.
- Status: Awaiting clinician sign-off

### meals.pattern
- Where: Patterns → "What you're learning", card "Energy after meals" (lib/patterns.js mealCards), and its detail sheet
- Text: "In your log, energy dipped or crashed more often (/ less often) after meals that were mostly carbs or sweet than after your other meals." / "Meals that were mostly carbs or sweet and (fewer) energy dips are still showing up together in your log, without a clear gap yet." / "In your log, energy dipped or crashed about as often after meals that were mostly carbs or sweet as after your other meals." Question: "Does my energy dip more often after some kinds of meals?" Detail lines: the counts; "A pattern is named with at least 5 meal notes on each side and 4 dips or crashes in all. Skipped meals and notes without an energy answer are left out."; "This is what your own notes show, not a rule about food. Energy after a meal also follows sleep, stress, your cycle and more."; "The 2023 International PCOS Guideline recommends healthy eating without naming any one specific diet." Followed by the not-medical-advice line.
- Sources: teede2023 (Recommendations from the 2023 International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome, 2023). Verified only through a PubMed-indexed summary of the 2023 guideline ("a healthy lifestyle should be at the focus of care … with no specific diet or physical exercise recommended"); the guideline's own text could not be opened from the build environment. Please confirm the wording against the guideline's lifestyle/dietary recommendations.
- Status: Awaiting clinician sign-off

### meals.report
- Where: Report → Appointment PDF, "Include meal notes" tick and the "Meal notes" section (lib/bodylog.js mealReportLines)
- Text: "N meal notes on N days (no foods, amounts or calories)." / "What meals were mostly: balanced on N days, mostly carbs or sweet on N days, …" / "Energy after meals: steady after N meals, dipped after N meals and crashed after N meals."
- Sources: counts of her own notes; no clinical claim.
- Status: Awaiting clinician sign-off

### meals.ai
- Where: backend AI_FRAME (added rule) and "What Solia Health will send" line "Meal notes (counts only, no foods)"
- Text: Never give diet or food advice: do not call any food or meal good, bad, healthy or unhealthy, never mention calories, weight or weight loss, and never tell her what to eat; meal-note counts are only associations with how her energy felt.
- Sources: product rule (no diet advice); no clinical claim.
- Status: Awaiting clinician sign-off

## Readability pass (Solia C, 2026-11-01): medical sentences moved behind a tap or reworded

No medical claim was added. The sentences below keep their facts; they were shortened, or moved behind a disclosure so
a card shows one or two short lines. Every one still renders (in the page, inside the closed panel).

### pcos.cycle.expected (reworded)
- Where: Body → Cycles, PCOS card (the one visible line under the count); Patterns → cycle timeline → "About long cycles" (moved there from the timeline sentence); Home hero note on a long gap
- Before: Long or missed cycles are common with PCOS. Solia Health shows them as part of your pattern, not as mistakes.
- After: Long or missed cycles are common with PCOS — part of your pattern, not a mistake.
- Sources: teede2023, rotterdam2004 (unchanged)
- Status: Awaiting clinician sign-off

### pcos.cycle.definition (moved)
- Where: Body → Cycles, PCOS card → "What counts as long" (was "What counts as a long cycle"); the source and the not-a-diagnosis line → "Source"
- Text (unchanged): For adults, the international PCOS guideline describes cycles shorter than 21 days or longer than 35 days, or fewer than eight a year, as irregular.
- Status: Awaiting clinician sign-off

### report.meanings (split: first sentence visible, the rest behind "Why this matters")
- Where: Patterns → Report → "What this might mean" (src/screens/ReportScreen.jsx meanings)
- Visible / behind the tap:
  - "Periods that vary by a week or more are one of the clearest signs the menopause transition has started." / "That's not a diagnosis — but it's the exact thing doctors look at, and it usually means this is a years-long change worth planning for, not a random bad month."
  - "Hot flashes and night sweats this often are treatable — this is the single most fixable thing on your list." / "Most women are never offered treatment simply because it never gets discussed."
  - "Sleep that's disrupted this often is worth treating on its own, not just waiting out." / "Poor sleep tends to make every other symptom louder, so fixing it often improves several things at once."
  - "Pain this strong, this often, isn't something to just get through." / "Period pain that regularly stops you has causes that are diagnosable and treatable — it often goes unaddressed for years because people are told it's normal."
- The observations-not-a-diagnosis line under them is unchanged (now one small line).
- Status: Awaiting clinician sign-off (the wording itself predates this pass and was never registered here)

### trial.detail and What I'm trying (reworded)
- Where: Patterns → a "What I'm trying" card → its sheet (lib/patterns.js trialCards); Home → What I'm trying → "How comparing works"; Body → Meds sheet footnote
- Before: "Solia Health compares once there are 5 logged days on each side. It never suggests a dose or a change." / "Change one variable at a time for two weeks, then look … Solia Health never recommends doses or changes; those stay with you and your clinician."
- After: "Compared once there are 5 logged days on each side. Never a suggested dose or change." / "Try one change for two weeks and compare." + "How comparing works": "Your days are compared once there are 5 logged days on each side: the 2 weeks before you started and the 2 weeks from the start. Lighter days for you count, never a score." and "It never recommends doses or changes; those stay with you and your clinician." / Meds sheet: "Never a dose or a change from here; those stay with you and your clinician."
- Status: Awaiting clinician sign-off

### calendar.prediction and calendar.why (moved / reworded, no new claim)
- Where: Body → Calendar. The range and "Estimates — not contraception." stay on the card; what the estimate rests on (and "Cycles vary more in perimenopause, so the range is wider.") moved behind "How this is worked out". The no-prediction lines drop the app's name ("After menopause, periods aren't predicted. Any bleeding now is worth mentioning to your doctor — log it on the Today screen so it's in your record.").
- Status: Awaiting clinician sign-off

### meals.pattern detail line (reworded)
- "Solia Health names a pattern with at least 5 meal notes on each side …" → "A pattern is named with at least 5 meal notes on each side …" (same rule; the meals.pattern entry above now quotes the new wording).

## Clinician summary (doctor report v2, 2026-11-02): page 1 of the appointment PDF
Code: src/lib/clinicianSummary.js. No new medical claim and no suggested questions; these are the new sentences a clinician
reads, all descriptive counts. Please check that none reads as a diagnosis or a verdict on a treatment.

### summary.header
- "Solia Health · Clinician summary"; "Prepared by the patient from her own log. Not a diagnosis."; footer "Patient-reported data".
- Status: Awaiting clinician sign-off

### summary.cycles
- Boxes labelled "over 35 d" for cycles longer than 35 days (the same 35-day line as pcos.cycle.definition), "excluded" for
  cycles she left out of predictions; "Average N days, range a–b, over k cycles. m of n longer than 35 days. j left out of
  predictions by her (shown, not averaged)."; "Current cycle: day N".
- Status: Awaiting clinician sign-off

### summary.symptoms
- "mostly cycle days 20–28 (k of n)" when at least 40% and 3 of a symptom's days fall in one bucket (1–5, 6–12, 13–19,
  20–28, 29 on); otherwise "spread across the cycle". A count, not a phase claim (no "luteal", no "premenstrual").
- Status: Awaiting clinician sign-off

### summary.treatment
- "Cycle length: before 40 d avg (1 cycle); since 30 d avg (2 cycles). Bloating days: before 50 of 71 logged; since 18 of 71
  logged." or "Not enough days to compare."; footnote "Counts from her log before and since each start date: what changed in
  her log, not a judgement of the treatment." Equal windows (at most 90 days) either side; no statistics, no causal words.
- Status: Awaiting clinician sign-off

### summary.labs
- Values and units exactly as typed, newest first, with dates; a small line oldest to newest; "Values exactly as she typed
  them, newest first; the small line runs oldest to newest. Not interpreted; no reference ranges." No flags or ranges.
- Status: Awaiting clinician sign-off

### summary.ai
- Detailed pages only, when ticked: "Written by the AI from the counts she chose to send on <date>. Not a diagnosis; not
  reviewed by a clinician." followed by the stored write-up (already registered under "Cyra's AI write-up and chat").
- Status: Awaiting clinician sign-off


## Auto-tracked (passive tracking S2, 2026-11-09): the Home card, the cycle markers, the clinician table, two pattern cards
Code: src/lib/signals.js (the rules and every fixed sentence, `SIGNAL_COPY`), src/lib/autoTracked.js, src/components/AutoTrackedCard.jsx,
src/components/CycleList.jsx, src/lib/clinicianSummary.js, src/lib/patterns.js `wearCards`. Plan: docs/PASSIVE-TRACKING-PLAN.md §1.6, §2.1,
§2.2, §2.7, §7. Every sentence is worded as an observation from her own device's nightly readings; none says ovulation happened or
was confirmed (`FERT_BANNED` is unit-tested over `SIGNAL_COPY` and the markers) and contraception is named only as "Solia Health is
not a contraceptive." for Trying to conceive. Please check that nothing reads as a diagnosis, a fertility verdict or a score.

### auto.words (Home → "Today's auto-tracked")
- "Sleep · at your usual", "Temperature · lower than usual" / "higher than usual", "HRV · lower, usual for your luteal days",
  "a few more nights will show your usual", "no reading", "left out". Method: her own mean ± 1 standard deviation per cycle
  phase (period · follicular · ovulatory · luteal), each phase needing 7 of her nights, else all her nights; fewer than 7 in all
  gives the "few more nights" line. Notes: "Left out: much higher than your other nights" (a night more than 1.0 °C over the mean
  of her other nights, fever-like), "Skipped: fever or illness / alcohol / travel / other". Never a number, never a score.
- Details: "Each reading is compared with your own nights in the same cycle phase … A phase needs 7 of your nights before it
  speaks …", "A night more than 1 °C above your other nights is left out as fever-like …", "Looks right only notes that you saw
  this; it never adds a symptom or a day to your log.", and `SIGNAL_COPY.guidance`: "From your own nightly temperatures, read on
  this device. Guidance for a conversation with your clinician, not a diagnosis."
- Status: Awaiting clinician sign-off

### auto.rise (Body → Cycles markers; the Report preview; the PDF table; the Home "From your wearable" card)
- Per cycle: "Temperature rise seen · day 14" (+ " · luteal 14 days" when the next start is known), "No sustained rise seen this
  cycle", "Not enough nights". Rule (three-over-six): three consecutive valid nights each at least 0.2 °C above the mean of the six
  valid nights before them; nothing is said under 10 valid nights in the cycle or without six before a candidate; a positive LH
  test within 2 days makes the confidence "clear" (the table says "(LH)"), else "possible". Skipped and fever-like nights never count.
- Explanations: "A rise consistent with ovulation, from your own nightly temperatures: three nights in a row at least 0.2 °C above
  the six before. An observation, not a confirmation." / "N nights read, none held 0.2 °C above the six before for three nights in a
  row." / "Nights read: N. The rise test needs 10 valid nights in a cycle, with 6 before any candidate."
- Home (My Cycle, builds with wearables, replaces the earlier "Ovulated" card): "A temperature rise consistent with ovulation
  began on cycle day N (date): three nights in a row at least 0.2 °C above the six before, from your own nightly readings. An
  observation after the fact, the way basal-temperature charting works; it can't predict next month." TTC advice: "If you're trying
  to conceive, the days most often fertile were the ~5 before and the day of that rise." Without a rise: "No sustained temperature
  rise yet this cycle — which fits: based on your usual N-day cycle, a rise would be expected around day N−14. Solia Health will say
  so once one holds for three nights." Milestone label: "Temperature rise seen in a cycle" (was "Ovulation confirmed by temperature").
- Trying to conceive, once under the list: "Solia Health is not a contraceptive."
- Status: Awaiting clinician sign-off

### auto.table (clinician PDF page 1, "Cycles · newest first", when temperature nights exist)
- Columns start · length · bleeding days · temperature rise ("seen, day 14", "seen, day 14 (LH)", "no sustained rise", "not enough
  nights") · luteal length; at most 12 cycles, trimmed to 6 before anything else when page 1 is full; the strip stays without
  temperature nights. Note: "Temperature rise: three nights in a row at least 0.2 °C above the six before, from her wearable's
  nightly readings, read on her device. An observation consistent with ovulation, not a confirmation." Appendix: "Auto-tracked
  nights" → "Nights she marked as not usable: N (fever or illness 2, travel 1)." / "No nights marked as not usable." and "A night she
  marked as not usable stays out of every baseline and of the temperature-rise test."
- Status: Awaiting clinician sign-off

### auto.patterns (Patterns → "What you're learning", two cards; `PATTERN_RULES` thresholds)
- "Nights with lower-than-usual sleep lined up with more <top symptom> the next day in your log." / "Days after a lower-than-usual
  HRV night lined up with more low mood or low energy in your log." (Supported pattern), the "still showing up together … without
  a clear gap yet" variants, and "A few more logs will show clearer associations." Detail: the counts on each side, "\"Lower than
  usual\" means more than one standard deviation under your own average, from at least 7 nights. Nights you skipped are left
  out.", and the usual threshold sentence. Associations in her log, never causes.
- Weekly review, when a rise was seen: "Temperature rose on day 32." or "Temperature rose on day 32; HRV was lower in the 5 days
  before." (the second clause only when at least 3 of the 5 nights before the rise read lower than her usual).
- Status: Awaiting clinician sign-off

### auto.reminder (phone reminder body while a source synced in the last 36 h)
- "Confirm today (10 s)" instead of "Time for your 30-second check-in." (lib/autoTracked.js `CONFIRM_BODY`); the Home card shows the
  same line above Looks right. No health content.
- Status: Awaiting clinician sign-off

### auto.notification (S3; phone local notification and web push, `lib/confirmNight.js`, `public/sw.js`, backend push)
- "Last night synced. Looks right?" with the actions "Looks right" and "Open". Only fires at 07:00 local after an overnight sync,
  never before 07:00, never when the night is confirmed; no reading, number or word about her body is in it.
- Status: Awaiting clinician sign-off

### auto.sources (S3; You → Data sources, `src/components/DataSourcesCard.jsx`, `lib/sources.js` statsView)
- No medical sentence: source names, what each reads, where it goes, Pause / Disconnect, and the spike's counts ("3 nights
  confirmed with Looks right since 2026-10-02.", "Typically 9 seconds from the card appearing to the tap (67% under 15
  seconds).", "A source has been connected since … (30 days)."). Counts of her own taps, never a score or a grade.
- Status: Awaiting clinician sign-off (for the record; no claim about a condition)

## Ask with evidence (Pro, Task 3, 2026-11-12): the system prompt and the app's fixed lines

### evidence.system (backend/src/modules/ai/evidence.js `EVIDENCE_SYSTEM`, sent with every question)
- Must use the web_search tool, limited to PubMed, NCBI, MedlinePlus, NIH, CDC, ACOG, WHO, NICE, the Cochrane Library,
  the Endocrine Society and the FDA (at most 5 searches), and base the answer only on what it finds.
- Plain language at about an 8th-grade reading level, at most 220 words; cite every medical claim (uncited claims are not
  allowed); say plainly when evidence is weak, mixed, early or only from small studies; guidance, never a diagnosis;
  never doses or dosing advice, never start/stop/change a medicine or supplement; never contraception claims; suggest
  her clinician and end with one question to ask them; red-flag symptoms → care now and the emergency line (911 / 988 US),
  without searching. A pseudonymized summary of her logs, if she included it, may be related to the evidence but never
  interpreted as a diagnosis.
- The server withholds any answer with no source at all ("No sources could be found for that just now, so there's no
  answer."), and only links on those domains are shown.
- Status: Awaiting clinician sign-off

### evidence.app (src/lib/evidence.js `EVIDENCE_COPY`)
- Under every answer: "Guidance, not a diagnosis or dosing advice. Bring what you read to your clinician."
- A red-flag question, answered on the device and never sent: "What you're describing needs care now, not an app. Please
  call your local emergency number (911 in the US) or go to urgent care. If you are thinking about harming yourself, call
  or text 988 (US) or your local crisis line. Your question wasn't sent anywhere."
- A model refusal: "This one can't be answered here. Please ask your clinician."
- Status: Awaiting clinician sign-off

### practices.voice (src/lib/voice.js, free)
- Breathing cues spoken by the device's built-in voice: "Breathe in", "Hold", "and out", "Rest"; step practices speak each
  step's existing text. No new medical claim.
- Status: Awaiting clinician sign-off (for the record)

