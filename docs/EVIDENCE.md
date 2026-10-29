# Evidence register

What each practice, exercise or marker in Cyra rests on: a named primary or guideline source, what it supports, for
whom and how strongly. Every practice is "wellbeing support, not treatment". Medical sentences are also listed in
docs/CLINICIAN-REVIEW.md and ship only after clinician sign-off. Calm R3 started this file with the one practice Home
can suggest; calm R5 adds the Mind practices library below (the text in each "Wording in the app" line is generated
from src/lib/mind.js and checked by src/lib/mind.test.mjs).

## How the sources were checked (calm R5, 2026-10-29)
- Each candidate practice from the plan (paced breathing, box breathing, 5-4-3-2-1 grounding, short progressive muscle
  relaxation, body scan, brief mindfulness, thought record / reframe, behavioural activation, gratitude, stimulus
  control from CBT-I, a short movement break) was looked up before its copy was written.
- The PubMed connector was unavailable in that session (its server could not be reached), and pubmed.ncbi.nlm.nih.gov
  and dovepress.com could not be fetched directly, so titles, authors, journals, volumes and years were confirmed with
  web searches against publisher, PubMed Central, PEDro and university repository records. Page numbers are given only
  where a record confirmed them. A reviewer with PubMed access should re-check every citation before release.
- Kept with "Wellbeing support, not treatment.": slow breathing, box breathing, reframe one thought, three-minute pause
  (brief mindfulness), body scan, one small step (behavioural activation), five-minute movement break, short muscle
  relaxation, bed is for sleep (stimulus control).
- Labelled "Comfort, not treatment." because the evidence does not support more: 5-4-3-2-1 grounding (no controlled
  trial of the exercise found; only small, unverifiable student studies) and three good things (gratitude: reviews
  find at most a small wellbeing effect and little effect on low mood or anxiety).
- Dropped: nothing from the candidate list. Not added: claims that any practice helps brain fog specifically (no
  source found beyond the small, short-lived effect of exercise on attention), and any claim that a practice treats
  PCOS or any other condition.


## Slow breathing (Home → Today's small step, calm R3; src/lib/home.js `STEPS.breathe`)
- Source: Zaccaro A, Piarulli A, Laurino M, et al.
  How Breath-Control Can Change Your Life: A Systematic Review on Psycho-Physiological Correlates of Slow Breathing.
  Frontiers in Human Neuroscience 12:353. 2018.
- What it supports: slow breathing (around 6 breaths a minute, under 10) is associated with greater relaxation and
  comfort and lower anxiety and arousal, alongside changes in heart-rate variability and EEG.
- For whom: healthy adults in mostly small, short studies.
- Strength: modest; the review notes small samples and varied methods. Used as a short wellbeing practice only.
- Wording in the app: "After a rough night, slow breathing (around six breaths a minute) is linked with feeling calmer
  in small studies. Wellbeing support, not treatment."

## Slow breathing (Mind → Practices, calm R5; `slow`)
- Needs: Feel calmer, Wind down & rest. 3 minutes. Free core set.
- Source: Zaccaro A, Piarulli A, Laurino M, et al. Frontiers in Human Neuroscience 12:353. How Breath-Control Can Change Your Life: A Systematic Review on Psycho-Physiological Correlates of Slow Breathing. 2018.
- Source: Fincham GW, Strauss C, Montero-Marin J, Cavanagh K. Scientific Reports 13:432. Effect of breathwork on stress and mental health: a meta-analysis of randomised-controlled trials. 2023.
- For whom: healthy adults; breathwork trials in mostly non-clinical adults.
- Strength: Moderate evidence.
- Wording in the app: "Breathing at around six breaths a minute is linked with a calmer body (higher heart-rate variability) and calmer mood in healthy adults; trials of breathwork show small-to-medium drops in stress. Most studies are small." + "Wellbeing support, not treatment."

## Box breathing (Mind → Practices, calm R5; `box`)
- Needs: Feel calmer. 3 minutes. Pro (full library).
- Source: Balban MY, Neri E, Kogon MM, et al. Cell Reports Medicine 4(1):100895. Brief structured respiration practices enhance mood and reduce physiological arousal. 2023.
- For whom: healthy adults (one remote randomised trial, one month).
- Strength: Limited evidence.
- Wording in the app: "In a one-month randomised trial with healthy adults, five minutes a day of structured breathing, box breathing among them, lifted mood; practices with a long, slow out-breath did best." + "Wellbeing support, not treatment."

## 5-4-3-2-1 grounding (Mind → Practices, calm R5; `ground`)
- Needs: Ease worry. 2 minutes. Free core set.
- Source: none. No controlled trial of this exercise was found (web search, 2026-10-29); offered as comfort.
- For whom: —.
- Strength: Offered as comfort.
- Wording in the app: "A widely used way to bring attention back to the present. We found no controlled trials of this exact exercise, so it is offered as a comfort." + "Comfort, not treatment."

## Reframe one thought (Mind → Practices, calm R5; `reframe`)
- Needs: Ease worry. 4 minutes. Pro (full library).
- Source: National Institute for Health and Care Excellence (NICE) guideline. Depression in adults: treatment and management (NG222). 2022.
- For whom: adults with less severe depression (guideline); self-help use here.
- Strength: Moderate evidence.
- Wording in the app: "Noticing and re-weighing thoughts is a core skill of cognitive behavioural therapy (CBT). NICE recommends guided self-help based on CBT as a first option for less severe depression. This short exercise is one piece of that, not a full course." + "Wellbeing support, not treatment."

## Three-minute pause (Mind → Practices, calm R5; `pause`)
- Needs: Ease worry, Clear brain fog. 3 minutes. Pro (full library).
- Source: Schumer MC, Lindsay EK, Creswell JD. Journal of Consulting and Clinical Psychology 86(7). Brief mindfulness training for negative affectivity: a systematic review and meta-analysis. 2018.
- For whom: adults, mostly without meditation experience.
- Strength: Modest evidence.
- Wording in the app: "Reviews of brief mindfulness training find a small easing of stress, worry and low mood compared with control activities; the effect is modest and some studies may be unpublished." + "Wellbeing support, not treatment."

## One small step (Mind → Practices, calm R5; `step`)
- Needs: Lift low energy. 3 minutes. Free core set.
- Source: Ekers D, Webster L, Van Straten A, et al. PLoS One 9(6):e100100. Behavioural activation for depression; an update of meta-analysis of effectiveness and sub group analysis. 2014.
- For whom: adults with depression (randomised trials).
- Strength: Moderate evidence.
- Wording in the app: "Behavioural activation, scheduling small rewarding or meaningful activities, reduced symptoms of depression in randomised trials; many trials were of modest quality. Here it is one small step, not a programme." + "Wellbeing support, not treatment."

## Five-minute movement break (Mind → Practices, calm R5; `move`)
- Needs: Lift low energy, Clear brain fog. 5 minutes. Free core set.
- Source: Loy BD, O'Connor PJ, Dishman RK. Fatigue: Biomedicine, Health & Behavior 1(4):223–242. The effect of a single bout of exercise on energy and fatigue states: a systematic review and meta-analysis. 2013.
- Source: Chang YK, Labban JD, Gapin JI, Etnier JL. Brain Research 1453:87–101. The effects of acute exercise on cognitive performance: a meta-analysis. 2012.
- For whom: adults, healthy and with chronic conditions (single bouts).
- Strength: Moderate evidence.
- Wording in the app: "A single bout of exercise raised feelings of energy in most trials, and short bouts of exercise give a small, short-lived boost to attention and thinking. Effects are small." + "Wellbeing support, not treatment."

## Three good things (Mind → Practices, calm R5; `gratitude`)
- Needs: Lift low energy. 3 minutes. Pro (full library).
- Source: Davis DE, Choe E, Meyers J, et al. Journal of Counseling Psychology 63(1):20–31. Thankful for the little things: a meta-analysis of gratitude interventions. 2016.
- Source: Cregg DR, Cheavens JS. Journal of Happiness Studies 22(1), doi 10.1007/s10902-020-00236-6. Gratitude Interventions: Effective Self-help? A Meta-analysis of the Impact on Symptoms of Depression and Anxiety. 2021.
- For whom: mostly healthy adults.
- Strength: Offered as comfort.
- Wording in the app: "Reviews find gratitude exercises give a small lift to wellbeing at most, and little change in low mood or anxiety compared with other activities. Offered as a comfort." + "Comfort, not treatment."

## Short muscle relaxation (Mind → Practices, calm R5; `pmr`)
- Needs: Wind down & rest. 4 minutes. Pro (full library).
- Source: Muhammad Khir S, et al. Psychology Research and Behavior Management 17:345–365. Efficacy of Progressive Muscle Relaxation in Adults for Stress, Anxiety, and Depression: A Systematic Review. 2024.
- For whom: adults with stress, anxiety or low mood.
- Strength: Modest evidence.
- Wording in the app: "Progressive muscle relaxation reduced stress, anxiety and low mood in adults across many studies, often alongside other approaches; study quality varies." + "Wellbeing support, not treatment."

## Body scan (Mind → Practices, calm R5; `scan`)
- Needs: Wind down & rest. 5 minutes. Pro (full library).
- Source: Schumer MC, Lindsay EK, Creswell JD. Journal of Consulting and Clinical Psychology 86(7). Brief mindfulness training for negative affectivity: a systematic review and meta-analysis. 2018.
- For whom: adults, mostly without meditation experience.
- Strength: Modest evidence.
- Wording in the app: "The body scan is one of the brief mindfulness practices; reviews of brief mindfulness training find a small easing of stress and low mood, a modest effect." + "Wellbeing support, not treatment."

## Bed is for sleep (Mind → Practices, calm R5; `winddown`)
- Needs: Wind down & rest. 2 minutes. Free core set.
- Source: Edinger JD, Arnedt JT, Bertisch SM, et al. Journal of Clinical Sleep Medicine 17(2):255–262. Behavioral and psychological treatments for chronic insomnia disorder in adults: an American Academy of Sleep Medicine clinical practice guideline. 2021.
- For whom: adults with chronic insomnia (guideline).
- Strength: Moderate evidence.
- Wording in the app: "Stimulus control is one of the parts of cognitive behavioural therapy for insomnia (CBT-I); the American Academy of Sleep Medicine suggests it for adults with chronic insomnia. The full multi-part CBT-I is recommended most strongly." + "Wellbeing support, not treatment."
