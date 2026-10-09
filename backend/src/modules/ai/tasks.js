// AI tasks. Only `ask` is mounted (see TASKS at the bottom); welcome, route and
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
const RED_FLAGS = /chest pain|can'?t breathe|short(ness)? of breath|faint|passed out|soak(ing|ed)? (a |one )?(pad|tampon)|every hour|hourly|bleeding (heavily|through)|large clots|severe headache|vision (change|blur)|suicid|kill myself|self[- ]harm|end my life|(no|less|reduced) (fetal |baby )?move|baby (isn'?t|is not|stopped) moving|fever (over|above|of) (39|102|103)|severe (pain|swelling)|seizure|collapsed/i;
const LIBRARY = [
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
  effort: "medium", maxTokens: 1200,
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

// Mounted tasks. welcome, route and insight are kept above for reference only: the
// app does not call them and the router does not serve them.
export const TASKS = { ask };
export const UNMOUNTED_TASKS = { welcome, route, insight };
