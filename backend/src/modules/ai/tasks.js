// AI tasks. `ask`, `weekly` and `chat` are mounted (see TASKS at the bottom); welcome, route and
// insight stay below for reference but are not served — the app builds its welcome
// and routes life stages on the device.
// Each task declares: what input it accepts (an allowlist — nothing else is read),
// the system prompt, the user prompt builder, the JSON schema the model must
// return, a `clean` step that re-validates the model's output, and a deterministic
// `fallback` used when there is no API key, the API errors, or the model refuses.
//
// What `ask` forwards: the question text exactly as typed (trimmed, at most 500
// characters) and, only if the caller sends one, a life-stage label from a fixed list.
// The app sends no stage. Free text can contain anything the person typed — a name,
// a medication — and goes to Anthropic as is; the app's disclosure says so. Unknown
// fields are dropped, never forwarded. Nothing is stored.

const STAGE_LABELS = ["My Cycle", "Trying to Conceive", "Pregnancy", "Perimenopause", "Menopause", "unknown"];
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const oneOf = (v, list, dflt = null) => (list.includes(v) ? v : dflt);
const intIn = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
const num = (v, lo, hi) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null);

const GUARDRAILS = `You are an educational assistant inside Cyra, a women's hormonal-health app.
Hard rules: give educational guidance and options only. Never diagnose. Never recommend, name, or adjust doses. Never tell someone to start or stop a medication. If anything described could be a red-flag symptom (heavy bleeding soaking a pad hourly, chest pain, trouble breathing, fainting, severe headache with vision changes, reduced fetal movement, thoughts of self-harm), say clearly that it needs prompt in-person care today. Plain language at roughly an 8th-grade reading level; warm, never clinical-cold, never cute. Be honest about uncertainty and name the evidence base. Respond only with the JSON object requested.`;

/* ---------- welcome: one warm sentence from registration answers ---------- */
const welcome = {
  effort: "low", maxTokens: 300,
  validate: (b) => {
    const stage = oneOf(b.stage, STAGE_LABELS.filter((s) => s !== "unknown"));
    if (!stage) return { error: "stage must be one of " + STAGE_LABELS.slice(0, -1).join(", ") };
    return { value: { stage, age: str(b.age, 12), cycleLen: str(b.cycleLen, 16), cycleReg: str(b.cycleReg, 12), goals: Array.isArray(b.goals) ? b.goals.map((g) => str(g, 32)).filter(Boolean).slice(0, 8) : [] } };
  },
  system: GUARDRAILS,
  prompt: (v) => `Write ONE warm, specific welcome sentence (max 22 words) for a woman joining the app. Her space: ${v.stage}. Age band: ${v.age || "not given"}. Cycles: ${v.cycleLen || "n/a"}, ${v.cycleReg || "n/a"}. Goals: ${v.goals.join(", ") || "none given"}. Do not use her name — you don't know it.`,
  schema: { type: "object", properties: { welcome: { type: "string" } }, required: ["welcome"], additionalProperties: false },
  clean: (o) => ({ welcome: str(o.welcome, 240) }),
  fallback: (v) => ({ welcome: `Welcome — your ${v.stage} space is ready.` }),
};

/* ---------- route: four intake answers → exactly one life-stage experience ---------- */
export function rulesRoute(a) {
  if (a.preg === "yes") return { stage: "preg", label: "Pregnancy", welcome: "Your pregnancy space is ready — week tracking, kick counts, and gentle guidance." };
  if (a.per === "none12") return { stage: "peri", label: "Menopause", welcome: "Welcome — this space tracks symptoms and builds the record your doctor can act on, no period tracking in your way." };
  if (a.per === "irregular" && (a.age !== "u35" || a.vms === "yes")) return { stage: "peri", label: "Perimenopause", welcome: "Changing cycles are the story here — this space is built to read them, not fight them." };
  if (a.vms === "yes" && a.age === "45p") return { stage: "peri", label: "Perimenopause", welcome: "Hot flashes and sleep changes front and center — with honest guidance on what's treatable." };
  return { stage: "periods", label: "My Cycle", welcome: "Your cycle space is ready — predictions, patterns, and zero judgment." };
}
const route = {
  effort: "low", maxTokens: 300,
  validate: (b) => ({ value: { preg: oneOf(b.preg, ["yes", "no", "ttc"], "no"), age: oneOf(b.age, ["u35", "3544", "45p"], "u35"), per: oneOf(b.per, ["regular", "irregular", "none12", "na"], "na"), vms: oneOf(b.vms, ["yes", "no", "unsure"], "unsure") } }),
  system: GUARDRAILS,
  prompt: (v) => `Route a new user to exactly one experience based on her intake. Answers: pregnant=${v.preg}, age_band=${v.age}, periods=${v.per} (regular|irregular|none12|na), hot_flashes_or_night_sweats=${v.vms}. Rules: pregnancy always wins; no period for 12+ months = Menopause; irregular periods with age 35+ or with hot flashes = Perimenopause; otherwise My Cycle. Return stage (periods|preg|peri), label (My Cycle|Pregnancy|Perimenopause|Menopause) and one warm welcome sentence for this specific person (no name).`,
  schema: { type: "object", properties: { stage: { type: "string", enum: ["periods", "preg", "peri"] }, label: { type: "string", enum: ["My Cycle", "Pregnancy", "Perimenopause", "Menopause"] }, welcome: { type: "string" } }, required: ["stage", "label", "welcome"], additionalProperties: false },
  clean: (o) => { const stage = oneOf(o.stage, ["periods", "preg", "peri"]); const label = oneOf(o.label, ["My Cycle", "Pregnancy", "Perimenopause", "Menopause"]); if (!stage || !label) throw new Error("model returned an invalid route"); return { stage, label, welcome: str(o.welcome, 240) }; },
  fallback: (v) => rulesRoute(v),
};

/* ---------- ask: plain-language evidence Q&A ---------- */
// The same red flags and written library as the app's src/lib/askLibrary.js (keep the two in step).
// Exported only so src/lib/askLibrary.test.mjs can check that both lists match; nothing else reads them.
export const RED_FLAGS = /chest pain|can'?t breathe|short(ness)? of breath|faint|passed out|soak(ing|ed)? (a |one )?(pad|tampon)|every hour|hourly|bleeding (heavily|through)|large clots|severe headache|vision (change|blur)|suicid|kill myself|self[- ]harm|end my life|(no|less|reduced) (fetal |baby )?move|baby (isn'?t|is not|stopped) moving|fever (over|above|of) (39|102|103)|severe (pain|swelling)|seizure|collapsed/i;
export const LIBRARY = [
  // POTS entries (design A13 / S8). They sit above the existing topics, so every pattern needs the word "POTS",
  // a POTS-specific term or a standing context: no bare "tachycardia", "postural", "orthostatic", "exercise
  // intolerance", "deconditioning" or "salt tablet". RED_FLAGS above still wins for "faint", "chest pain" etc.
  // Each pattern starts with ^(?![\s\S]*(heavy …|anemi)): a question that also names heavy bleeding, clots,
  // flooding or anaemia skips them and reaches the heavy-bleeding entry, which carries the same-day-care line.
  // Every POTS answer ends with the same when-to-get-help sentence (clinician review, Q1). No lookbehind:
  // Safari before 16.4 (iOS 15 target) can't parse it.
  // Backend copies drop the "Cyra's optional POTS tools in Settings …" sentence: this fallback only answers these
  // entries for older apps (newer ones answer them on the device), and those apps have no POTS tools.
  { re: /^(?![\s\S]*(heavy (period|bleed|flow)|menorrhagia|clots|flooding|anemi))[\s\S]*?(\bpots\b.{0,40}(exercis|workouts?|gym|\bwalk(s|ed|ing)?\b|\b(running|jogging)\b|go for a (run|walk|jog)|\bbik(e|es|ing)\b|cycling|\b(can i|ok to|safe to) (cycle|run|jog)\b|\bswim|rowing|recumbent)|(exercis|workouts?|gym|\bwalk(s|ed|ing)?\b|\b(running|jogging)\b|go for a (run|walk|jog)|\bbik(e|es|ing)\b|cycling|\b(can i|ok to|safe to) (cycle|run|jog)\b|\bswim|rowing|recumbent).{0,40}\bpots\b)/i, answer: "Exercise helps many people with POTS, but the way in matters. Programs that have been studied start lying down or reclined, such as a recumbent bike, a rowing machine or swimming, and build slowly over weeks before moving upright, because being horizontal takes gravity out of the picture. Many people felt better after about three months. If you feel much worse a day or two after effort and it lasts (post-exertional malaise, common with ME/CFS and long COVID), step-up plans aren't recommended; pacing is. Check with your clinician or physio before starting. If you're pregnant, plan exercise with your prenatal team first, avoid lying flat on your back for long after the first trimester, and stop and call them for bleeding, painful contractions, leaking fluid or calf pain. Get care today if you've fainted or blacked out, or if you have chest pain, trouble breathing, heavy bleeding, a racing heartbeat that doesn't settle after lying down, or dizziness that's new or much worse in pregnancy or after giving birth. If it's severe, call your local emergency number (911 in the US).", source_note: "Fu & Levine, Autonomic Neuroscience 2018; George et al., Heart Rhythm 2016 (international POTS registry); NICE guideline NG206 (2021) on ME/CFS.", ask: "Is a recumbent-first exercise plan right for me, and could I have post-exertional malaise?" },
  { re: /^(?![\s\S]*(heavy (period|bleed|flow)|menorrhagia|clots|flooding|anemi))[\s\S]*?((salt|sodium|electrolyte|fluid|water|hydrat).{0,40}\bpots\b|\bpots\b.{0,40}(salt|sodium|electrolyte|fluid|water|hydrat))/i, answer: "People with POTS are often advised to drink more and take in more salt, because it helps keep more fluid in the blood vessels. Expert guidance mentions daily amounts, but they aren't right for everyone. High blood pressure, heart, kidney or liver disease, pregnancy and some medicines all change the answer, so your amounts should come from your clinician. Food labels list sodium in milligrams, and 1 gram of salt has about 390 mg of sodium. Spreading drinks through the day, and having a glass or two before getting up, are common tips. Get care today if you've fainted or blacked out, or if you have chest pain, trouble breathing, heavy bleeding, a racing heartbeat that doesn't settle after lying down, or dizziness that's new or much worse in pregnancy or after giving birth. If it's severe, call your local emergency number (911 in the US).", source_note: "Heart Rhythm Society expert consensus statement (2015); Canadian Cardiovascular Society position statement (2020).", ask: "What daily fluid and salt goal is right for me, given my blood pressure, heart and kidneys?" },
  { re: /^(?![\s\S]*(heavy (period|bleed|flow)|menorrhagia|clots|flooding|anemi))[\s\S]*?(\bpots\b.{0,40}(\bperiods?\b(?! of time)|(menstrual |monthly |my )cycles?\b|\bcycle days?\b|menstru|pregnan|menopaus|perimenopaus)|(\bperiods?\b(?! of time)|(menstrual |monthly |my )cycles?\b|\bcycle days?\b|menstru|pregnan|menopaus|perimenopaus).{0,40}\bpots\b)/i, answer: "Some people with POTS notice their symptoms change across the menstrual cycle, often feeling worse around their period, though small studies don't all agree on how much. In pregnancy, POTS gets better for some people, worse for others, and stays the same for many, and it can change again after birth, so it's worth involving your prenatal team early, especially about medicines. Around perimenopause, a racing heart, flushing and poor sleep can come from hormones, from POTS, or from other causes such as thyroid or heart-rhythm problems. Logging symptoms alongside your cycle helps your clinician sort these out. Get care today if you've fainted or blacked out, or if you have chest pain, trouble breathing, heavy bleeding, a racing heartbeat that doesn't settle after lying down, or dizziness that's new or much worse in pregnancy or after giving birth. If it's severe, call your local emergency number (911 in the US).", source_note: "Peggs et al., Int J Gynaecol Obstet 2012; Fu et al., Hypertension 2010; Kimpinski et al., Mayo Clinic Proceedings 2010.", ask: "Could my cycle (or pregnancy, or menopause) be changing my POTS symptoms, and should that change my plan?" },
  { re: /^(?![\s\S]*(heavy (period|bleed|flow)|menorrhagia|clots|flooding|anemi))[\s\S]*?(\bpots\b|postural (orthostatic )?tachycardia|orthostatic (intolerance|hypotension|tachycardia)|dysautonomia|tilt[- ]?table|(dizz|light-?headed|palpitat|racing heart|fast heart|heartbeat|heart (rate|races|racing|pounds|pounding)).{0,30}(stand|get(ting)? up|upright))/i, answer: "Feeling dizzy or lightheaded, or having a racing heart when you stand up, is called orthostatic intolerance. It has several causes: not drinking enough, some medicines, low iron or anaemia, thyroid problems, heart-rhythm problems, and conditions like POTS (postural orthostatic tachycardia syndrome), where the heart rate rises a lot on standing. A clinician can check with a simple standing test or a tilt-table test, along with blood tests for other causes. Logging when it happens and what you'd had to drink makes that visit more useful. Cyra can't diagnose POTS; only a clinician can. Get care today if you've fainted or blacked out, or if you have chest pain, trouble breathing, heavy bleeding, a racing heartbeat that doesn't settle after lying down, or dizziness that's new or much worse in pregnancy or after giving birth. If it's severe, call your local emergency number (911 in the US).", source_note: "Heart Rhythm Society expert consensus statement (2015); Canadian Cardiovascular Society position statement (2020).", ask: "Could a standing test or tilt-table test help explain why I feel unwell when I stand, and should we check for other causes?" },
  { re: /hormone (replacement )?therapy|\bhrt\b|\bmht\b|estrogen patch|cancer risk/i, answer: "Hormone therapy is the most effective treatment for hot flashes and night sweats, and for most healthy women who start it before 60 or within ten years of their last period, the benefits outweigh the risks. The cancer question is more specific than the headlines: in the big Women's Health Initiative trial, estrogen taken alone did not raise breast cancer risk, while estrogen plus a progestogen raised it slightly after several years of use — a small absolute change, similar in size to other everyday factors. Your own history matters a lot: prior breast cancer, blood clots, stroke, or liver disease change the picture. The honest answer is that this is a personal risk-benefit decision, best made with a clinician who knows your history.", source_note: "The Menopause Society 2022 Hormone Therapy Position Statement; NICE menopause guideline NG23; Women's Health Initiative follow-up studies.", ask: "Given my history, am I a candidate for hormone therapy — and if so, estrogen-only or combined?" },
  { re: /non[- ]?hormonal|without hormones|ssri|fezolinetant|hot flash|night sweat/i, answer: "Hot flashes and night sweats are very treatable, and hormone therapy isn't the only route. Non-hormonal options with real evidence include certain antidepressants used at low doses (SSRIs and SNRIs), gabapentin, oxybutynin, and a newer class — neurokinin-3 receptor antagonists such as fezolinetant — that acts directly on the brain's temperature control. Cognitive behavioral therapy and clinical hypnosis also reduce how much flashes disrupt life. Supplements like black cohosh and soy isoflavones have mixed or weak evidence. Bringing a count of your flashes per week to a visit makes the conversation concrete.", source_note: "The Menopause Society 2023 Nonhormone Therapy Position Statement; NICE NG23; Cochrane reviews of non-hormonal treatments for vasomotor symptoms.", ask: "Which non-hormonal option fits me best given my other medications and health history?" },
  { re: /sleep|insomnia|wake up|can'?t fall asleep/i, answer: "Sleep problems around hormonal change are common, and the first-line treatment isn't a pill: cognitive behavioral therapy for insomnia (CBT-I) has the strongest evidence, works as well as sleep medication in the short term and better in the long term, and has no side effects. Night sweats that wake you are a separate, treatable problem — fixing them often fixes the sleep. Sleeping pills are generally a short-term bridge, not a plan. Tracking which nights are rough alongside your symptoms helps a clinician see the pattern.", source_note: "American Academy of Sleep Medicine clinical guideline for chronic insomnia; The Menopause Society; NICE NG23.", ask: "Could I be referred for CBT-I, and are my night sweats part of why I'm not sleeping?" },
  { re: /cramp|period pain|dysmenorrhea|endometriosis/i, answer: "Period cramps come from prostaglandins — chemicals that make the uterus contract — which is why anti-inflammatory painkillers and continuous low-level heat both genuinely work, with good trial evidence behind each. Hormonal contraception is another well-evidenced option for people who want it. The line to watch: pain that regularly stops you from working, studying, or getting out of bed is not something to push through. Endometriosis and adenomyosis are common causes of pain like that, and they typically take years to diagnose largely because people are told it's normal.", source_note: "ACOG Committee Opinion on dysmenorrhea and endometriosis in adolescents; Cochrane reviews of NSAIDs and of heat for dysmenorrhea; NICE NG73 endometriosis guideline.", ask: "My pain reaches this level on this many days a month — could it be endometriosis, and how would we check?" },
  { re: /heavy (period|bleed|flow)|menorrhagia|clots|flooding|anemi/i, answer: "Heavy periods are defined by what they do to your life, not a number: soaking a pad or tampon every hour, passing clots bigger than a coin, bleeding for more than seven days, or needing to change protection overnight. It's common, it's treatable, and the first thing a clinician checks is iron, because heavy bleeding is the leading cause of anemia in women. Treatment options to ask about include tranexamic acid taken only on heavy days, hormonal options including the hormonal IUD, and investigation of causes like fibroids or polyps. Bleeding that is suddenly much heavier than your normal, with dizziness or breathlessness, needs same-day care.", source_note: "ACOG Practice Bulletin on heavy menstrual bleeding; NICE NG88 heavy menstrual bleeding guideline; Cochrane reviews of tranexamic acid.", ask: "Could we check a blood count and iron, and which treatment options fit my situation?" },
  { re: /exercise|workout|run(ning)?|lift|yoga|safe to .* (pregnan|trimester)/i, answer: "For an uncomplicated pregnancy, exercise is recommended, not just allowed: the guidance is about 150 minutes of moderate activity a week, continued through all three trimesters, and it lowers the risk of gestational diabetes, excess weight gain, and some pregnancy complications. Walking, swimming, stationary cycling, prenatal yoga, and strength training are all considered safe. Things to avoid: contact sports, activities with a real fall risk, hot yoga, scuba diving, and lying flat on your back for long periods after the first trimester. Stop and call your provider for bleeding, regular painful contractions, fluid leaking, dizziness, chest pain, or calf pain.", source_note: "ACOG Committee Opinion 804, Physical Activity and Exercise During Pregnancy and the Postpartum Period; Canadian Guideline for Physical Activity throughout Pregnancy.", ask: "Is there anything about my pregnancy that changes the standard exercise advice?" },
  { re: /odor|smell|discharge|bacterial vaginosis|\bbv\b|yeast|thrush|itch/i, answer: "A fishy odor, especially with thin grey or white discharge, is the classic sign of bacterial vaginosis — the most common vaginal condition, caused by a shift in the normal bacteria rather than anything you did. It's treated with a short course of antibiotics, and over-the-counter yeast treatments won't fix it. Thick white discharge with itching points more toward yeast, which can be treated over the counter, but a first episode or repeated episodes should be confirmed. Healthy vaginas have a scent that changes across the cycle, and douching makes infections more likely, not less. Green, frothy, or bloody discharge, or pain with it, deserves a proper look.", source_note: "CDC Sexually Transmitted Infections Treatment Guidelines (bacterial vaginosis and vulvovaginal candidiasis); ACOG FAQ on vaginitis.", ask: "Could you test the discharge so we treat the right thing the first time?" },
  { re: /fertil|ovulat|conceive|get pregnant|trying for a baby|lh (test|strip)/i, answer: "The fertile window is roughly the five days before ovulation plus the day itself, because sperm can wait several days but an egg lasts less than a day. Apps estimate ovulation from your past cycle lengths, so the estimate is only as good as your regularity — a range, not a day. Ovulation predictor kits detect the hormone surge a day or so before ovulation; basal body temperature confirms it happened, but only after the fact. Sex every one to two days through the window is as effective as any precise timing. If you've been trying for a year — or six months if you're over 35 — that's the standard point to ask for an evaluation, for both partners.", source_note: "ACOG FAQ on evaluating infertility; American Society for Reproductive Medicine committee opinion on optimizing natural fertility; Cochrane review of timed intercourse.", ask: "Based on how long we've been trying and my age, is it time for a fertility evaluation?" },
  { re: /irregular|cycle (length|vary|chang)|perimenopaus|am i in (peri)?menopause|skipp(ed|ing) period/i, answer: "Cycles that start varying by a week or more from one to the next are the clearest early sign of the menopause transition — it's literally the marker doctors use to stage it. Perimenopause can last several years and is diagnosed from your pattern and symptoms, not a blood test, because hormone levels swing day to day. Irregular cycles under 40 can have other causes worth checking, including thyroid problems and polycystic ovary syndrome. A record of your cycle lengths and symptoms is more useful at a visit than any single lab value, and treatment for symptoms doesn't have to wait until periods stop.", source_note: "STRAW+10 staging criteria for reproductive aging; The Menopause Society; NICE NG23.", ask: "My cycles have ranged this widely — could this be perimenopause, and what should we check to rule out other causes?" },
  { re: /tired|fatigue|exhaust|no energy|thyroid|iron|vitamin d/i, answer: "Feeling wiped out for weeks is a symptom worth investigating rather than normalizing. Three common, easily tested causes show up as fatigue: an underactive thyroid, iron-deficiency anemia (very common with heavy periods), and low vitamin D. Each is a simple blood test, and each is treatable. Poor sleep and mood changes around hormonal transitions also drain energy, so a sleep pattern alongside your fatigue scores gives a clinician something concrete. Asking for the tests by name tends to work better than saying \"I'm just tired.\"", source_note: "American Thyroid Association guidelines; ACOG guidance on anemia in women; NICE guidance on tiredness and vitamin D deficiency.", ask: "Could we check my thyroid, a full blood count with iron studies, and vitamin D?" },
];
const ask = {
  // Opus 5.5 always thinks, and thinking counts toward max_tokens: low effort keeps it short (and inside
  // the 12 s limit), and 4000 leaves room for it plus the ~400-token JSON answer, so it isn't truncated.
  effort: "low", maxTokens: 4000,
  // stage is optional: the app no longer sends it, so the prompt carries only what she typed.
  validate: (b) => { const question = str(b.question, 500); if (question.length < 3) return { error: "question is required" }; return { value: { question, stage: oneOf(b.stage, STAGE_LABELS.filter((s) => s !== "unknown"), "not stated") } }; },
  system: GUARDRAILS,
  prompt: (v) => `You are "Ask Cyra", a plain-language health explainer. The user's life stage: ${v.stage}. Her question: "${v.question}". Return: answer (120-170 words at an 8th-grade reading level, warm and honest, explaining what the evidence says), source_note (which guideline bodies or evidence this reflects, by name — e.g. ACOG, The Menopause Society, Cochrane reviews), ask_your_doctor (one specific question she could bring to her clinician), urgent (true ONLY if the question describes red-flag symptoms needing prompt care, or self-harm or crisis — then also point to professional support in the answer).`,
  schema: { type: "object", properties: { answer: { type: "string" }, source_note: { type: "string" }, ask_your_doctor: { type: "string" }, urgent: { type: "boolean" } }, required: ["answer", "source_note", "ask_your_doctor", "urgent"], additionalProperties: false },
  clean: (o) => ({ answer: str(o.answer, 2000), source_note: str(o.source_note, 400) || null, ask_your_doctor: str(o.ask_your_doctor, 300) || null, urgent: !!o.urgent }),
  fallback: (v) => {
    if (RED_FLAGS.test(v.question)) return { answer: "What you're describing can be a sign of something that needs to be checked today, not researched. Please contact your provider now, or go to urgent care or an emergency department — and if you are thinking about harming yourself, call or text 988 (US) or your local crisis line. You are not overreacting by asking.", source_note: null, ask_your_doctor: null, urgent: true };
    const hit = LIBRARY.find((t) => t.re.test(v.question));
    if (hit) return { answer: hit.answer, source_note: hit.source_note, ask_your_doctor: hit.ask, urgent: false };
    return { answer: "I don't have a written answer for that one yet. Cyra's AI wasn't available for this question, so rather than guess, here's the honest route: write the question down exactly as you asked it here and bring it to your next visit — clinicians answer specific questions far better than vague ones. If it's about a symptom that is new, severe, or getting worse, don't wait for the appointment.", source_note: null, ask_your_doctor: v.question, urgent: false };
  },
};

/* ---------- insight: weekly insight from aggregates ---------- */
const insight = {
  effort: "medium", maxTokens: 800,
  validate: (b) => {
    const symptoms = {};
    if (b.symptoms_last30 && typeof b.symptoms_last30 === "object") for (const [k, d] of Object.entries(b.symptoms_last30).slice(0, 20)) { const days = intIn(d, 0, 30); const label = str(k, 32); if (label && days != null) symptoms[label] = days; }
    const lens = Array.isArray(b.cycle_lengths_days) ? b.cycle_lengths_days.map((n) => intIn(n, 15, 120)).filter((n) => n != null).slice(0, 12) : [];
    const w = b.wearables && typeof b.wearables === "object" ? { avg_temp_deviation_c: num(b.wearables.avg_temp_deviation_c, -2, 3), avg_sleep_score: num(b.wearables.avg_sleep_score, 0, 100), avg_hrv: num(b.wearables.avg_hrv, 0, 300) } : null;
    return { value: { stage: oneOf(b.stage, STAGE_LABELS, "unknown"), symptoms_last30: symptoms, sleep_to_hotflash_multiplier: num(b.sleep_to_hotflash_multiplier, 0, 20), cycle_lengths_days: lens, wearables: w } };
  },
  system: GUARDRAILS,
  prompt: (v) => `Weekly insight for a user in the ${v.stage} stage. Aggregated data (last 30 days, no identity): ${JSON.stringify(v)}. Return: insight (2-3 warm plain sentences connecting the data), action (one concrete evidence-based next step she can take), urgency (self-care | next visit | this week), flag_for_doctor (one thing to raise at an appointment).`,
  schema: { type: "object", properties: { insight: { type: "string" }, action: { type: "string" }, urgency: { type: "string", enum: ["self-care", "next visit", "this week"] }, flag_for_doctor: { type: "string" } }, required: ["insight", "action", "urgency", "flag_for_doctor"], additionalProperties: false },
  clean: (o) => ({ insight: str(o.insight, 800), action: str(o.action, 400), urgency: oneOf(o.urgency, ["self-care", "next visit", "this week"], "self-care"), flag_for_doctor: str(o.flag_for_doctor, 300) }),
  fallback: (v) => {
    const top = Object.entries(v.symptoms_last30).sort((a, b) => b[1] - a[1])[0];
    const spread = v.cycle_lengths_days.length >= 2 ? Math.max(...v.cycle_lengths_days) - Math.min(...v.cycle_lengths_days) : null;
    const parts = [];
    if (top && top[1] > 0) parts.push(`${top[0]} showed up on ${top[1]} of your last 30 days — the clearest pattern this month.`);
    if (v.sleep_to_hotflash_multiplier && v.sleep_to_hotflash_multiplier > 1.2) parts.push(`Hot flashes were about ${v.sleep_to_hotflash_multiplier.toFixed(1)} times more likely after a rough night, so sleep is a lever worth pulling first.`);
    if (v.wearables?.avg_sleep_score != null && v.wearables.avg_sleep_score < 70) parts.push(`Your wearable's sleep score averaged ${Math.round(v.wearables.avg_sleep_score)}, which backs that up from the other side.`);
    if (!parts.length) parts.push("No strong pattern stands out yet — a couple more weeks of check-ins will sharpen this.");
    const urgent = (top && top[1] >= 8) || (spread != null && spread >= 7);
    return { insight: parts.join(" "), action: v.wearables?.avg_sleep_score != null && v.wearables.avg_sleep_score < 70 || /sleep/i.test(top?.[0] || "") ? "Start with sleep: CBT-I is the first-line, drug-free treatment, and a steady wake time is the simplest first step." : "Keep logging daily for two more weeks, then compare — patterns need a baseline before they mean anything.", urgency: urgent ? "next visit" : "self-care", flag_for_doctor: spread != null && spread >= 7 ? `Cycle lengths of ${v.cycle_lengths_days.join(", ")} days — a ${spread}-day spread, which is the marker clinicians use for the transition.` : top ? `${top[0]} on ${top[1]} of 30 days.` : "Your symptom frequency table." };
  },
};

/* ---------- weekly and chat (calm R8): the pseudonymized summary ----------
   Both are Pro features she turns on herself; the app shows her this exact body before every send. What they accept:
   `summary` — the app's src/lib/aiSummary.js object: counts, averages, cycle lengths and labels from Cyra's fixed lists,
   never a date, note, name, email, ZIP, age band or lab date. The server re-checks its shape (checkSummary below) and
   refuses anything else with 400 rather than forwarding it. `question` (chat): what she typed, trimmed to 500
   characters. `history` (chat): at most 6 earlier messages of this chat from her device, { role: user|assistant, text }.
   Unknown fields are dropped. Nothing is stored or logged: the body exists only for the length of the request.
   There is no rules fallback for these two: without a key the route answers 503 and the app says AI isn't set up. */
const SUMMARY_TOP = new Set(["kind", "version", "lifeStage", "weeks", "daysLogged", "cycles", "daysLoggedByCycleDay", "symptoms", "sleep", "movement", "mood", "pcosSignals", "labs", "experiment"]);
const SAFE_TEXT = /^[A-Za-z0-9 ,.'()/%+\u2013-]{1,60}$/;
const DATE_LIKE = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/;
/** [] when `s` looks like an aiSummary object: plain keys, short label texts, finite numbers 0–1000, depth ≤ 4, ≤ 8000 bytes. */
export function checkSummary(s) {
  const out = [];
  if (!s || typeof s !== "object" || Array.isArray(s)) return ["summary must be an object"];
  if (s.kind !== "cyra-summary") out.push("summary.kind must be cyra-summary");
  for (const k of Object.keys(s)) if (!SUMMARY_TOP.has(k)) out.push(`summary.${String(k).slice(0, 24)} is not accepted`);
  const walk = (v, depth) => {
    if (depth > 4) { out.push("summary is nested too deeply"); return; }
    if (v === null) return;
    if (Array.isArray(v)) { if (v.length > 12) out.push("summary list too long"); for (const x of v) walk(x, depth + 1); return; }
    if (typeof v === "object") { for (const [k, x] of Object.entries(v)) { if (!/^[A-Za-z0-9]{1,24}$/.test(k)) out.push("summary key not accepted"); walk(x, depth + 1); } return; }
    if (typeof v === "string") { if (!SAFE_TEXT.test(v) || DATE_LIKE.test(v) || /@/.test(v)) out.push("summary text not accepted"); return; }
    if (typeof v === "number") { if (!Number.isFinite(v) || v < 0 || v > 1000) out.push("summary number out of range"); return; }
    out.push("summary value not accepted");
  };
  walk(s, 0);
  let n = 0; try { n = JSON.stringify(s).length; } catch { out.push("summary is not JSON"); }
  if (n > 8000) out.push("summary too large");
  return [...new Set(out)].slice(0, 5);
}
const AI_FRAME = `You write for Cyra, a calm women's-health app. You are given a pseudonymized summary of one person's own logs: counts, averages, cycle lengths and labels, with no dates and nothing that identifies her.
Hard rules: describe associations in her own data that she could raise with her clinician. Never diagnose, never name or adjust a treatment, medicine, supplement or dose, never tell her to start or stop anything. Never interpret a lab value: do not say whether a number is normal, high, low or worrying; you may only note that she logged it and suggest she reviews it with her clinician. Never grade, score or rate her, her week or her logging; no streaks, no "good job", no "you failed", no numbers out of 100. Say plainly when there is too little data ("a few more logs will show clearer associations"). Plain, warm language at about an 8th-grade reading level. If anything in the question describes a medical emergency or a red-flag symptom (heavy bleeding soaking a pad hourly, chest pain, trouble breathing, fainting, severe headache with vision changes, reduced fetal movement, thoughts of self-harm), do not discuss the data: say it needs care now and give the emergency line: call your local emergency number (911 in the US), or for thoughts of self-harm call or text 988 (US) or your local crisis line. Respond only with the JSON object requested.`;
export const EMERGENCY_ANSWER = "What you're describing needs care now, not an app. Please call your local emergency number (911 in the US) or go to urgent care. If you are thinking about harming yourself, call or text 988 (US) or your local crisis line. You are not overreacting by asking.";
const words = (t, max) => { const w = String(t || "").trim().split(/\s+/).filter(Boolean); return w.length > max ? `${w.slice(0, max).join(" ")}…` : w.join(" "); };
const weekly = {
  effort: "low", maxTokens: 4000,
  validate: (b) => { const p = checkSummary(b.summary); if (p.length) return { error: p.join("; ") }; return { value: { summary: b.summary } }; },
  system: AI_FRAME,
  prompt: (v) => `Her summary (JSON): ${JSON.stringify(v.summary)}\nWrite her weekly write-up: at most 180 words, two or three short paragraphs, about what stands out in these counts (patterns across cycle days, sleep, movement, mood, any experiment), framed as associations, not causes. Return writeup (the text, at most 180 words) and ask_your_doctor (one specific question she could bring to her clinician).`,
  schema: { type: "object", properties: { writeup: { type: "string" }, ask_your_doctor: { type: "string" } }, required: ["writeup", "ask_your_doctor"], additionalProperties: false },
  clean: (o) => ({ writeup: words(o.writeup, 180), ask_your_doctor: str(o.ask_your_doctor, 300) || null }),
};
const chat = {
  effort: "low", maxTokens: 4000,
  validate: (b) => {
    const p = checkSummary(b.summary); if (p.length) return { error: p.join("; ") };
    const question = str(b.question, 500); if (question.length < 2) return { error: "question is required" };
    const history = (Array.isArray(b.history) ? b.history : []).filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text.trim()).slice(-6).map((m) => ({ role: m.role, text: str(m.text, 1200) }));
    return { value: { summary: b.summary, question, history } };
  },
  system: AI_FRAME,
  // Earlier turns as alternating messages (the first must be hers), then her summary and the new question.
  messages: (v) => {
    const h = [...v.history]; while (h.length && h[0].role !== "user") h.shift();
    return [...h.map((m) => ({ role: m.role, content: m.text })), { role: "user", content: `Her summary (JSON): ${JSON.stringify(v.summary)}\nHer question: "${v.question}"\nAnswer in at most 150 words, grounded in the summary where it helps. Return answer, ask_your_doctor (one question for her clinician, or an empty string) and urgent (true only for a red-flag or crisis question).` }];
  },
  schema: { type: "object", properties: { answer: { type: "string" }, ask_your_doctor: { type: "string" }, urgent: { type: "boolean" } }, required: ["answer", "ask_your_doctor", "urgent"], additionalProperties: false },
  clean: (o) => ({ answer: o.urgent ? EMERGENCY_ANSWER : words(o.answer, 170), ask_your_doctor: o.urgent ? null : str(o.ask_your_doctor, 300) || null, urgent: !!o.urgent }),
  // A red-flag question is answered here, before anything is sent to Anthropic.
  preflight: (v) => (RED_FLAGS.test(v.question) ? { answer: EMERGENCY_ANSWER, ask_your_doctor: null, urgent: true } : null),
};

// Mounted tasks. welcome, route and insight are kept above for reference only: the
// app does not call them and the router does not serve them. weekly and chat need a key (no fallback).
export const TASKS = { ask, weekly, chat };
export const UNMOUNTED_TASKS = { welcome, route, insight };
