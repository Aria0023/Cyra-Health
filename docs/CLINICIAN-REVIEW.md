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
