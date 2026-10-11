/* POTS clinician report (design 6, spec A13.6): one model, four outputs: the on-screen
   preview, the PDF (lib/pdf.js, laid out by reportPdf below), the spreadsheet (toCSV) and the
   summary / email text (summaryText, emailParts). Pure functions: no React, no state, no
   network, no storage. Everything is built on the device from the POTS log.

   What goes in, and what never does:
   - Inputs are the POTS log, the life stage (app state), today's date, her choices on the
     Report section and, only while "Cycle or pregnancy details" is ticked, the related
     symptoms, sleep answers and hot flashes her check-ins logged and her logged period starts
     (read-only; for the overlap lines, cycle days, the cycle pattern and the patterns that use
     them). Registration answers are never an input:
     reportModel takes no such argument and ignores anything else it is given, so the output
     is the same whatever she answered at registration (unit-tested).
   - Never in any output: watch, ring or health-app readings or anything derived from them
     (they are not an input either: "Patterns from her log" is lib/potsPatterns.js run without
     them), the journal, the Connect log, the main check-in scales.
   - Typed notes (day, episode, test, IV and medicine notes, and what she typed about a
     tilt-table result) only with "Notes I typed"; her
     first name only with "Put my first name on it"; the life-stage label, "Pregnant", cycle
     days, the cycle pattern, the check-in overlap and the stage-based visit questions only
     with "Cycle or pregnancy details". The rest position ("lying on left side") always stays: it is how the test was
     done.
   - Nothing is diagnosed: results are compared with published thresholds, in the same words
     as the stand-test result, and every string is checked against POTS_BANNED by the tests.
   File names, the PDF title and the email subject are neutral (cyra-report-{date}.pdf,
   cyra-data-{date}.csv, "Cyra report", "My health log summary…"): the condition appears only
   inside the file. */
import { POTS_SYM, POTS_TRIG, POTS_MED_LIB, POTS_RELATED, THRESH } from "./potsConstants.js";
import { standResult, median, fmtFluid, fmtSodium, isLockedPots, localDay, toMin } from "./pots.js";
import { patterns, dayRows, cycleGroups, cycleLabelOn, isCycleStage, episodesByDose, medLine, REPORT_FOOT, PREG_NOTE as PREG_PATTERN_NOTE } from "./potsPatterns.js";
import { RAMPS } from "./constants.js";

/* ---------- small helpers ---------- */
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return localDay(new Date(y, m - 1, d + n)); };
const dayDiff = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
const D = (iso, opts) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", opts);
/** "Oct 8". */
export const fmtDay = (iso) => D(iso, { month: "short", day: "numeric" });
/** "Oct 8, 2026". */
export const fmtDayY = (iso) => D(iso, { month: "short", day: "numeric", year: "numeric" });
/** "Sep 11 – Oct 10, 2026" (years on both ends when they differ). */
export const fmtRange = (a, b) => (a.slice(0, 4) === b.slice(0, 4) ? `${fmtDay(a)} – ${fmtDayY(b)}` : `${fmtDayY(a)} – ${fmtDayY(b)}`);
/** "08:05" -> "8:05". */
const hm = (t) => (typeof t === "string" ? t.replace(/^0(\d)/, "$1") : "");
const n1 = (x) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 10) / 10));
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const andList = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthYear = (ym) => (typeof ym === "string" && /^\d{4}-\d{2}$/.test(ym) ? `${MONTHS[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}` : null);

/* ---------- words for stored values ---------- */
export const RATING_WORD = { 1: "Good", 2: "Okay", 3: "Rough", 4: "Bad" };
export const METHOD_WORD = { stand: "Active stand", lean: "Lean test" };
const methodWord = (m) => METHOD_WORD[m] || "Other test";
const DEVICE_WORD = { watch: "Watch", cuff: "Blood-pressure cuff", oximeter: "Finger pulse meter", counted: "Counted pulse", other: "Other device" };
const POS_WORD = { lying: "Lying", sitting: "Sitting", standing: "Standing still", stoodup: "Just stood up", walking: "Walking", exercise: "Exercising", heat: "Hot shower or bath", meal: "After a meal" };
const VIT_POS = { lying: "Lying", sitting: "Sitting", standing: "Standing" };
const HELPED_WORD = { lie: "Lying down", legs: "Legs up", fluids: "Fluids", salt: "Salt", cool: "Cooling", comp: "Compression", med: "Medicine", other: "Other" };
const KIND_WORD = { water: "Water", electrolyte: "Electrolyte drink", broth: "Broth or soup", food: "Salty food", tablet: "Salt tablet", salt: "Table salt", other: "Other" };
const MED_KIND = { rx: "Prescription", otc: "Over the counter", supp: "Supplement", aid: "Support" };
const FAINT_WORD = { yes: "fainted", almost: "almost fainted", no: "didn't faint" };
const MEDS_WORD = { taken: "taken", not_yet: "not yet", none: "takes none" };
const YN = (v) => (v === true ? "yes" : v === false ? "no" : "not noted");
const SUSTAINED_WORD = { met: "yes", single_mid: "single, later lower", single_last: "single, last reading", below: "no", insufficient: "insufficient" };
/** The same answers in the summary's sentence. single_last isn't a "no": nothing shows
    whether that rise lasted (design 13 #8). */
const SUSTAINED_SENTENCE = { met: "yes", single_mid: "one reading reached it and the next was lower", single_last: "only the last reading reached it, so it isn't known whether it lasted", below: "no" };
/** The stand-test result's pregnancy line (design 4.8.6), for the Standing tests section. */
const PREG_NOTE = "Heart rate normally rises during pregnancy, and these thresholds come from studies of people who weren't pregnant. Share the numbers with your prenatal team rather than reading too much into them.";
/** The report's words for the stand-test settings in POTS settings → For your report. */
export const STATUS_OPTS = [["diagnosed", "Diagnosed"], ["checking", "Being checked"], ["unsure", "Not sure yet"]];
export const ONSET_OPTS = [["infection", "An infection"], ["covid", "COVID-19"], ["pregnancy", "Pregnancy"], ["surgery", "Surgery or injury"], ["concussion", "Concussion"], ["unsure", "Not sure"], ["none", "Nothing I know of"]];
export const COND_OPTS = [["eds", "Hypermobility / EDS"], ["mcas", "MCAS"], ["mecfs", "ME/CFS"], ["longcovid", "Long COVID"], ["migraine", "Migraine"], ["gut", "Gut issues"], ["other", "Other"]];
const ONSET_WORD = { infection: "an infection", covid: "COVID-19", pregnancy: "pregnancy", surgery: "surgery or injury", concussion: "a concussion", unsure: "not sure", none: "nothing she knows of" };
const optWord = (opts, v) => (opts.find(([k]) => k === v) || [null, "Other"])[1];

/** Symptom and trigger names, her own included (archived ones keep their names). Ids this
    build doesn't know read "Other symptom" / "Other trigger"; the CSV keeps the raw id. */
export function symName(p, id) {
  const b = POTS_SYM.find((x) => x.id === id);
  if (b) return b.label;
  const c = ((p && p.settings && p.settings.customSym) || []).find((x) => x.id === id);
  return c ? c.label : "Other symptom";
}
export function trigName(p, id) {
  const b = POTS_TRIG.find((x) => x.id === id);
  if (b) return b.label;
  const c = ((p && p.settings && p.settings.customTrig) || []).find((x) => x.id === id);
  return c ? c.label : "Other trigger";
}
const known = (p, id, kind) => (kind === "sym" ? POTS_SYM : POTS_TRIG).some((x) => x.id === id) || ((p.settings[kind === "sym" ? "customSym" : "customTrig"]) || []).some((x) => x.id === id);

/* ---------- the period ---------- */
/** The report period: "30" (default), "90" or "all" (from her first POTS entry). */
export function reportRange(p, period, today) {
  let from = addDays(today, period === "90" ? -89 : -29);
  if (period === "all") {
    const dates = [...Object.keys(p.days || {}), ...(p.tests || []).map((t) => t.date), ...(p.tilt || []).map((t) => t.date), p.since].filter((d) => typeof d === "string" && ISO.test(d) && d <= today);
    from = dates.length ? dates.sort()[0] : today;
  }
  return { from, to: today, n: dayDiff(from, today) + 1 };
}
const inRange = (iso, r) => typeof iso === "string" && iso >= r.from && iso <= r.to;
/** Paper size: her choice, else from the locale (US and Canada use Letter). */
export const paperFor = (p, locale) => (p.settings.paper === "letter" || p.settings.paper === "a4" ? p.settings.paper : /^en-(US|CA)\b/.test(locale || "") ? "letter" : "a4");

/* ---------- visit questions (design 6.6) ---------- */
/** The generated "Questions for my next visit", from POTS data and app state only. Each is
    { id, text, stageBased, part }; stage-based ones go into a file only with "Cycle or pregnancy
    details", and one drawn from Report parts (`part`: "tests", "fluid", "meds", or a list such
    as ["patterns", "sym"]) only while every one of those parts is ticked (on screen they always
    show). `tests` are the finished tests
    to read (oldest first); `cycle` is the cycle card (lib/potsPatterns.js cycleGroups). */
export function visitQuestions(p, { tests = [], stage = null, stageName = null, teen = false, cycle = null } = {}) {
  if (!isObj(p) || isLockedPots(p)) return [];
  const s = p.settings, out = [];
  const add = (id, text, stageBased = false, part = null) => out.push({ id, text, stageBased, part });
  const res = tests.map((t) => ({ t, r: standResult(t, { teen }) }));
  const latest = (pred) => res.filter(pred).pop();
  const hr = latest(({ r }) => ["met", "single_mid", "single_last"].includes(r.hrStatus));
  if (hr) add("q_test", `My standing test on ${fmtDay(hr.t.date)} showed a heart-rate rise of ${n1(hr.r.peakRise)}. Could we confirm it with an in-clinic standing test or a tilt test?`, false, "tests");
  if (s.context.status !== "diagnosed") add("q_causes", "Could we check for other causes, like a blood count and iron, thyroid, and my medicines?");
  if ((s.goals.fluidMl == null && s.goals.naMg == null) || s.goals.by === "me") add("q_goal", "What daily fluid and salt goal is right for me, given my blood pressure, heart and kidneys?", false, "fluid");
  const prog = p.move && p.move.program;
  if (prog) {
    const cleared = stage === "preg" ? prog.clearedPreg : prog.cleared;
    if (cleared !== "yes") add("q_exercise", "Is it safe for me to start an exercise plan, and where should I start?");
    if (prog.pem === "yes" || prog.pem === "unsure") add("q_pem", "I crash after effort. Could this be post-exertional malaise, and how should I pace?");
  }
  // The cycle card is shown and her rough days lean clearly towards the period: a lead of at
  // least 25 points, the card's own visit rule (lib/potsPatterns.js cycleGroups `top`). It is
  // drawn from her day ratings, so in a file it needs "Symptoms, ratings and episodes" too.
  if (cycle && cycle.shown && cycle.top) add("q_cycle", `My symptoms seem worse ${cycle.top === "weekBefore" ? "the week before" : "during"} my period. Is that worth planning around?`, true, ["patterns", "sym"]);
  const meds = (p.meds || []).filter((m) => m.kind !== "aid" && !m.stopped);
  if ((stage === "preg" || stageName === "Trying to Conceive") && meds.length) add("q_preg", `I'm ${stage === "preg" ? "pregnant" : "planning a pregnancy"}. Are my POTS medicines OK to continue?`, true, "meds");
  const onset = monthYear(s.context.onset && s.context.onset.ym);
  if (stage === "peri" && onset) add("q_midlife", `My symptoms started around ${onset}. Should we also look at heart-rhythm, thyroid and other causes that become more common from midlife?`, true);
  const sup = latest(({ r }) => r.supineHigh);
  if (sup) add("q_supine", `My lying-down blood pressure has been ${Math.round(sup.r.baseSys)}/${Math.round(sup.r.baseDia)}. Is that a concern with my medicines?`, false, "tests");
  if (res.some(({ r }) => r.bpStatus === "drop")) add("q_drop", "My blood pressure dropped when I stood up. Should we look at that separately?", false, "tests");
  const rh = latest(({ r }) => r.restHigh);
  if (rh) add("q_resthigh", `My lying-down heart rate was ${Math.round(rh.r.baseHr)}. Should we look at that separately?`, false, "tests");
  return out;
}

/** Where a linked faint came from, decided positively: a stand test still on her list, a
    movement session still logged, or, once that record was deleted ("Keep the faint in my
    log"), the position the link wrote: "stoodup" for a test, "exercise" for a session. */
function linkSource(p, e) {
  if (!e.src) return null;
  if ((p.tests || []).some((t) => t.id === e.src)) return "test";
  if (Object.values(p.days || {}).some((d) => isObj(d) && Array.isArray(d.move) && d.move.some((m) => isObj(m) && m.id === e.src))) return "session";
  if (e.pos === "stoodup") return "test_deleted";
  if (e.pos === "exercise") return "session_deleted";
  return "deleted";
}
const SRC_WORD = { test: "Stand test", session: "Exercise session", test_deleted: "Stand test (deleted)", session_deleted: "Exercise session (deleted)", deleted: "Deleted record" };
const SRC_CSV = { test: "stand test", session: "session", test_deleted: "deleted stand test", session_deleted: "deleted session", deleted: "deleted record" };

/** The Report parts a generated question draws on (none, one or several). */
export const questionParts = (q) => (Array.isArray(q.part) ? q.part : q.part ? [q.part] : []);
/** Whether a generated question goes into the files for these Include choices. */
export const questionIn = (q, inc) => (inc.cycle || !q.stageBased) && questionParts(q).every((k) => inc[k] !== false);
/** The Report part a pattern factor draws on (lib/potsPatterns.js factorList): drinks, salt and
    IV fluids are "Fluids and sodium"; medicine timing and supports are "Medicines and supports";
    exercise the day before is "Movement" (its box arrives with the Move section); sleep, heat,
    triggers and hot flashes sit with "Symptoms, ratings and episodes", which every pattern
    needs anyway because the outcome is her day rating. */
export const factorPart = (f) => (["fluid", "sodium", "iv"].includes(f.key) ? "fluid" : f.kind === "med" || f.key.startsWith("med:") || f.key.startsWith("aid:") ? "meds" : f.key === "moved" ? "move" : "sym");

/* ---------- the model ---------- */
const testBpWord = (r) => {
  const d = r.drop, sd = d ? `${n1(Math.max(0, d.s))}/${n1(Math.max(0, d.d))}` : "";
  switch (r.bpStatus) {
    case "drop": return `drop within 3 min (${sd})`;
    case "single_drop": return `one early drop (${sd})`;
    case "late_drop": return `drop after minute 3 (${sd} at min ${n1(d.min)})`;
    case "no_drop": return "held steady";
    default: return r.bpMissing === "lying" ? "no lying BP" : r.bpMissing === "standing" ? "no standing BP" : r.bpMissing === "early" ? "none in first 3 min" : "not taken";
  }
};
const bpText = (r) => (fin(r.sys) || fin(r.dia) ? `${r.sys ?? "?"}/${r.dia ?? "?"}` : null);

/** Everything the report says, for the period and choices given. opts:
    period ("30" | "90" | "all"), today (local "YYYY-MM-DD"), include { tests, sym, fluid,
    meds, patterns, cycle, notes, name } (cycle and notes default to her remembered choices),
    name (her first name; used only with include.name), stage, stageName, checkin (iso -> that
    day's check-in entry or null; read only with include.cycle), checkinLabels (check-in symptom
    id -> label), starts (her logged period starts; cycle days and the cycle pattern, in files
    only with include.cycle), locale (paper size when she hasn't chosen one). */
export function reportModel(p, opts = {}) {
  const { period = "30", today = localDay(new Date()), stage = null, stageName = null, name = "", checkin = null, checkinLabels = {}, locale = "en-US" } = opts;
  const starts = Array.isArray(opts.starts) ? opts.starts : [];
  if (!isObj(p) || isLockedPots(p)) return null;
  const s = p.settings, units = s.units;
  const inc = { tests: true, sym: true, fluid: true, meds: true, patterns: true, cycle: s.reportCycle !== false, notes: s.reportNotes === true, name: false, ...(isObj(opts.include) ? opts.include : {}) };
  const who = inc.name && typeof name === "string" && name.trim() ? name.trim() : "";
  const range = reportRange(p, period, today);
  const teen = s.teen === true, thr = teen ? THRESH.hrTeen : THRESH.hr;
  const preg = stage === "preg";
  const days = Object.keys(p.days || {}).filter((d) => inRange(d, range)).sort();
  const dayOf = (d) => p.days[d] || {};
  const tests = (p.tests || []).filter((t) => t.status !== "running" && inRange(t.date, range));
  const results = new Map(tests.map((t) => [t.id, standResult(t, { teen, stage })]));
  const tilt = (p.tilt || []).filter((t) => inRange(t.date, range)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  /* Cycle days and the cycle pattern come from her logged period starts (lib/potsPatterns.js),
     in a cycle stage only; in a file only with "Cycle or pregnancy details". The cycle card
     itself (90 days, POTS ratings and starts only) also feeds the on-screen visit question. */
  const cycleStage = isCycleStage(stage, stageName);
  const cycleOf = (t) => (inc.cycle ? cycleLabelOn(t.date, starts, stage, stageName) : null);
  const cycleCard = cycleStage ? cycleGroups(dayRows(p, { from: addDays(today, -89), to: today, stage, starts }), starts, { stage, stageName, today }) : null;
  const periodRows = dayRows(p, { ...range, stage });

  /* Ratings, symptoms, episodes, intake: counted over logged days in the period. */
  const ratings = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const symDays = new Map(), trigDays = new Map(), eps = [], ups = [];
  let fluidDays = 0, fluidSum = 0, naDays = 0, naSum = 0, fluidMet = 0, naMet = 0;
  const ivDays = [];
  for (const d of days) {
    const x = dayOf(d);
    if (fin(x.rating) && ratings[x.rating] != null) ratings[x.rating]++;
    if (fin(x.up)) ups.push(x.up);
    for (const [id, v] of Object.entries(x.sym || {})) { const c = symDays.get(id) || { n: 0, strong: 0 }; c.n++; if (v >= 2) c.strong++; symDays.set(id, c); }
    for (const id of x.trig || []) trigDays.set(id, (trigDays.get(id) || 0) + 1);
    for (const e of x.eps || []) eps.push({ ...e, date: d });
    let fl = null, na = null;
    for (const it of x.intake || []) { if (fin(it.ml)) fl = (fl || 0) + it.ml; if (fin(it.naMg)) na = (na || 0) + it.naMg; }
    if (fl != null) { fluidDays++; fluidSum += fl; if (s.goals.fluidMl != null && fl >= s.goals.fluidMl) fluidMet++; }
    if (na != null) { naDays++; naSum += na; if (s.goals.naMg != null && na >= s.goals.naMg) naMet++; }
    if (x.iv) ivDays.push({ date: d, ml: x.iv.ml, note: x.iv.note || "" });
  }
  const rated = ratings[1] + ratings[2] + ratings[3] + ratings[4];
  const loggedDays = days.filter((d) => Object.keys(dayOf(d)).length > 0).length;
  const enough = tests.length >= 1 || loggedDays >= 3;

  /* Check-in overlap: only with "Cycle or pregnancy details", read from the check-in. */
  const overlap = [];
  if (inc.cycle && typeof checkin === "function") {
    const rel = POTS_RELATED[stage] || [];
    for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
      const c = checkin(d), sym = c && isObj(c.sym) ? c.sym : {};
      for (const id of rel) if (fin(sym[id]) && sym[id] > 0) overlap.push({ date: d, id, label: checkinLabels[id] || id, sev: sym[id] });
    }
  }

  /* Header. */
  const ctx = s.context, context = [];
  if (ctx.status) context.push(`Where she is with POTS: ${optWord(STATUS_OPTS, ctx.status).toLowerCase()}`);
  // "Pregnancy" as what came just before is a pregnancy detail: it goes in only with
  // "Cycle or pregnancy details", like the life-stage line.
  const onset = monthYear(ctx.onset && ctx.onset.ym), after = ((ctx.onset && ctx.onset.after) || []).filter((v) => inc.cycle || v !== "pregnancy").map((v) => ONSET_WORD[v] || "something else");
  if (onset) context.push(`Symptoms started: ${onset}`);
  if (after.length) context.push(`Just before they started: ${andList(after)}`);
  if ((ctx.conditions || []).length) context.push(`Other conditions: ${ctx.conditions.map((v) => optWord(COND_OPTS, v)).join(", ")}`);
  if (inc.cycle && stage) context.push(preg ? "Life stage: Pregnant (week not recorded in Cyra)" : `Life stage: ${stageName || "not set"}`);
  const rangeLabel = fmtRange(range.from, range.to);
  const header = {
    title: "POTS log summary",
    line: `POTS log summary · ${who || "Prepared by the patient"} · ${rangeLabel}`,
    made: `Made with the Cyra app on ${fmtDayY(today)} from the patient's own entries, measured at home with her own devices. Not a medical-device record. Not a diagnosis. Thresholds quoted from HRS 2015 and Freeman 2011.`,
    context,
    rated: inc.sym ? `Rated days: ${rated} of ${range.n} · good ${ratings[1]}, okay ${ratings[2]}, rough ${ratings[3]}, bad ${ratings[4]}` : null,
  };

  const sections = [];
  /* 1. Standing tests */
  if (inc.tests) {
    const blocks = [];
    const newest = [...tests].reverse();
    const shown = newest.slice(0, 12);
    if (!shown.length) blocks.push({ t: "p", text: "No standing tests in this period." });
    else {
      const rows = shown.map((t) => {
        const r = results.get(t.id), c = t.ctx || {};
        const lying = t.restPos === "left" ? "Lying on left side" : "Lying on back";
        const rest = [...(t.rest || [])].sort((a, b) => a.min - b.min);
        const restHr = rest.filter((x) => fin(x.hr)).map((x) => `${x.hr}${x.how === "counted" ? "c" : ""}`);
        const restBp = rest.map(bpText).filter(Boolean);
        const up = [...(t.up || [])].sort((a, b) => a.min - b.min).map((x) => `${n1(x.min)}: ${fin(x.hr) ? `${x.hr}${x.how === "counted" ? "c" : ""}` : "skipped"}${bpText(x) ? ` (${bpText(x)})` : ""}`);
        const felt = [...new Set([...(t.feel || []), ...(t.up || []).flatMap((x) => x.feel || [])])].map((id) => symName(p, id));
        const stop = t.status === "stopped" ? `Stopped at ${fin(t.stoppedAt) && t.stoppedAt > 0 ? `min ${n1(t.stoppedAt)}` : "rest"}${t.why === "faint" ? " (felt faint)" : t.why === "symptoms" ? " (other symptoms)" : t.why === "other" ? " (something else)" : ""}` : t.status === "interrupted" ? "Interrupted (app closed)" : "Completed";
        return [
          [`${fmtDay(t.date)} ${hm(t.t)}`, methodWord(t.method), `${lying}, ${t.restMin} min`, t.device ? DEVICE_WORD[t.device] || "Other device" : null].filter(Boolean).join("\n"),
          [`Usual meds: ${MEDS_WORD[c.meds] || "not noted"}`, `Heart-rate med: ${c.rateMed === "yes" ? "yes" : c.rateMed === "no" ? "no" : c.rateMed === "unsure" ? "not sure" : "not noted"}`, `Compression: ${YN(c.comp)}`, `Ate <2 h: ${YN(c.ate2h)}`, `Fluids before: ${fin(c.mlBefore) ? fmtFluid(c.mlBefore, units) : "not noted"}`].join("\n"),
          [restHr.length ? `HR ${restHr.join(", ")}${r.baseHr != null ? ` (base ${n1(r.baseHr)})` : ""}` : "HR not taken", restBp.length ? `BP ${restBp.join(", ")}` : null].filter(Boolean).join("\n"),
          up.length ? up.join("\n") : "none",
          r.peakHr != null && r.hrStatus !== "insufficient" ? `${r.peakHr} (min ${n1(r.peakMin)})\n${r.peakRise > 0 ? "+" : ""}${n1(r.peakRise)}` : "—",
          `${SUSTAINED_WORD[r.hrStatus]}${t.edited ? "\nedited" : ""}`,
          t.bp ? testBpWord(r) : "BP not taken",
          [stop, t.fainted ? `Faint: ${FAINT_WORD[t.fainted] || "other"}` : null, t.pooling === "yes" ? "Legs red or purple" : null, cycleOf(t) ? `Cycle day ${cycleOf(t).day}${cycleOf(t).weekBefore ? " (week before her period)" : ""}` : null, felt.length ? `Felt: ${felt.join(", ")}` : null].filter(Boolean).join("\n"),
        ];
      });
      blocks.push({ t: "table", caption: `Standing tests (${newest.length > 12 ? `newest 12 of ${newest.length}` : `${newest.length}`}, newest first)`, head: ["Test", "Before the test", "Lying", "Upright HR (BP) by minute", "Peak HR · max rise", `Sustained ≥${thr}`, "BP finding", "Stopped · faint · felt"], widths: [64, 72, 56, 74, 50, 52, 64, 83], rows, size: 7 });
      if (newest.length > 12) blocks.push({ t: "p", text: `${newest.length - 12} older ${newest.length - 12 === 1 ? "test is" : "tests are"} in the spreadsheet.`, small: true });
      if (tests.some((t) => [...(t.rest || []), ...(t.up || [])].some((x) => x.how === "counted"))) blocks.push({ t: "p", text: "c = counted pulse (15 seconds × 4).", small: true });
      const charts = shown.filter((t) => { const r = results.get(t.id); return r.baseHr != null && (t.up || []).some((x) => fin(x.hr)); }).slice(0, 3).map((t) => {
        const r = results.get(t.id), pts = (t.up || []).filter((x) => fin(x.hr) && fin(x.min)).sort((a, b) => a.min - b.min).map((x) => ({ min: x.min, hr: x.hr }));
        return { title: `${fmtDay(t.date)} · ${methodWord(t.method)}`, base: r.baseHr, thr, pts, rest: t.restPos === "left" ? "Lying on left side" : "Lying", test: t, result: r,
          label: `Heart rate, ${fmtDay(t.date)} ${methodWord(t.method).toLowerCase()}: lying ${n1(r.baseHr)}; ${pts.map((x) => `minute ${n1(x.min)}, ${x.hr}`).join("; ")}; threshold ${thr} above lying.` };
      });
      if (charts.length) blocks.push({ t: "hr", charts });
      for (const method of ["stand", "lean"]) {
        const rows2 = tests.filter((t) => t.method === method).map((t) => ({ t, r: results.get(t.id) })).filter(({ r }) => r.complete && r.hrStatus !== "insufficient").map(({ t, r }) => ({ id: t.id, date: t.date, rise: r.peakRise }));
        if (rows2.length >= 2) {
          const med = rows2.length >= 3 ? median(rows2.map((x) => x.rise)) : null;
          blocks.push({ t: "trend", method, methodLabel: methodWord(method).toLowerCase(), rows: rows2, thr, median: med,
            label: `Largest heart-rate rise in each complete ${methodWord(method).toLowerCase()}: ${rows2.map((x) => `${fmtDay(x.date)}, ${n1(x.rise)}`).join("; ")}; threshold ${thr}${med != null ? `; median ${n1(med)}` : ""}.` });
        }
      }
      if (blocks.some((b) => b.t === "trend")) blocks.push({ t: "p", text: "Tests done at different times of day, cycle days or with different medicines aren't directly comparable.", small: true });
    }
    // In pregnancy (and only with cycle details, so the file doesn't disclose it otherwise)
    // every result carries the pregnancy caveat of the stand-test result (design 4.8.6, A13.4).
    if (preg && inc.cycle && shown.length) blocks.push({ t: "p", text: PREG_NOTE });
    blocks.push({ t: "p", text: "Reference: a sustained rise of ≥30 bpm (≥40 at ages 12–19) within 10 min of standing, without orthostatic hypotension, is the heart-rate criterion in the 2015 HRS consensus statement. OH: drop ≥20 systolic or ≥10 diastolic within 3 min (Freeman 2011).", small: true });
    if (teen) blocks.push({ t: "p", text: "She uses the 40-beat threshold for ages 12–19 in Cyra.", small: true });
    const vit = days.flatMap((d) => (dayOf(d).vit || []).map((v) => ({ ...v, date: d })));
    if (vit.length) blocks.push({ t: "table", caption: "Single readings by position", head: ["Date", "Time", "Position", "Heart rate", "Blood pressure"], widths: [80, 60, 100, 100, 175], rows: vit.map((v) => [fmtDay(v.date), hm(v.t), VIT_POS[v.pos] || "Other", fin(v.hr) ? String(v.hr) : "—", bpText(v) || "—"]) });
    // Her typed words on a tilt result (where, what she was told, BP notes) go in only with
    // "Notes I typed", like every other text she typed; the date, rise and faint answer always do.
    const typed = (v) => (inc.notes ? v || "—" : "not included");
    if (tilt.length) blocks.push({ t: "table", caption: "Tilt-table results (as told to the patient)", head: ["Date", "Where", "What she was told", "HR rise", "BP notes", "Fainted"], widths: [52, 70, 205, 45, 90, 53], rows: tilt.map((x) => [fmtDayY(x.date), typed(x.where), typed(x.told), fin(x.hrRise) ? String(x.hrRise) : "—", typed(x.bpNote), x.fainted ? FAINT_WORD[x.fainted] || "other" : "—"]) });
    if (tilt.length && !inc.notes) blocks.push({ t: "p", text: "What she typed about tilt-table results is included only when she adds her notes.", small: true });
    sections.push({ id: "tests", title: "Standing tests", blocks });
  }

  /* 2. Symptoms and episodes */
  const faints = eps.filter((e) => e.faint === "yes" || e.faint === "almost");
  const nFaint = eps.filter((e) => e.faint === "yes").length, nAlmost = eps.filter((e) => e.faint === "almost").length;
  const symRows = [...symDays.entries()].map(([id, c]) => ({ id, label: symName(p, id), ...c })).sort((a, b) => b.n - a.n || b.strong - a.strong || (a.label < b.label ? -1 : 1));
  const trigRows = [...trigDays.entries()].map(([id, n]) => ({ id, label: trigName(p, id), n })).sort((a, b) => b.n - a.n || (a.label < b.label ? -1 : 1));
  if (inc.sym) {
    const blocks = [];
    if (ups.length) blocks.push({ t: "p", text: `"How much did being upright bother you" (0–10): average ${n1(Math.round((ups.reduce((a, b) => a + b, 0) / ups.length) * 10) / 10)} on ${plural(ups.length, "day")}.` });
    const symAny = days.filter((d) => Object.keys(dayOf(d).sym || {}).length).length;
    if (symRows.length) blocks.push({ t: "table", caption: `Symptoms (logged on ${plural(symAny, "day")})`, head: ["Symptom", "Days logged", "Days moderate or strong"], widths: [255, 110, 150], rows: symRows.map((x) => [x.label, String(x.n), String(x.strong)]) });
    else blocks.push({ t: "p", text: "No symptoms logged in this period." });
    if (inc.cycle && overlap.length) {
      const by = new Map();
      for (const o of overlap) by.set(o.label, (by.get(o.label) || 0) + 1);
      blocks.push({ t: "p", text: `Also logged in her cycle/pregnancy check-in: ${[...by.entries()].map(([l, n]) => `${l} (${plural(n, "day")})`).join(", ")}.` });
    }
    if (eps.length) {
      const pos = new Map();
      for (const e of eps) { const w = e.pos ? POS_WORD[e.pos] || "Other" : "Not noted"; pos.set(w, (pos.get(w) || 0) + 1); }
      blocks.push({ t: "p", text: `Episodes: ${eps.length}. Where she was: ${[...pos.entries()].sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w.toLowerCase()} ${n}`).join(", ")}.` });
    } else blocks.push({ t: "p", text: "No episodes logged in this period." });
    blocks.push({ t: "p", text: `Fainted: ${nFaint} · Almost fainted: ${nAlmost}` });
    if (faints.length) {
      const srcWord = (e) => (e.src ? SRC_WORD[linkSource(p, e)] : "Logged");
      blocks.push({ t: "table", caption: "Faints and near-faints", head: ["Date", "Time", "Faint", "Where", "Minutes", "Hurt", "From"], widths: [62, 45, 90, 95, 55, 45, 123], rows: faints.map((e) => [fmtDay(e.date), hm(e.t), FAINT_WORD[e.faint], e.pos ? POS_WORD[e.pos] || "Other" : "—", fin(e.mins) ? String(e.mins) : "—", e.injured ? "yes" : "no", srcWord(e)]) });
    }
    if (trigRows.length) blocks.push({ t: "p", text: `Most-tagged triggers: ${trigRows.slice(0, 5).map((x) => `${x.label} (${plural(x.n, "day")})`).join(", ")}.` });
    sections.push({ id: "sym", title: "Symptoms and episodes", blocks });
  }

  /* 3. Fluids and sodium */
  const g = s.goals;
  const goalBy = g.by === "clinician" ? "set by her clinician" : g.by === "me" ? "her own goal" : null;
  if (inc.fluid) {
    const blocks = [];
    blocks.push({ t: "p", text: fluidDays ? `Fluids logged on ${fluidDays} of ${range.n} days. Average oral fluid on those days: ${fmtFluid(fluidSum / fluidDays, units)}.` : "No fluids logged in this period." });
    blocks.push({ t: "p", text: naDays ? `Sodium logged on ${naDays} of ${range.n} days. Average on those days: ${fmtSodium(naSum / naDays, { salt: "mgNa" })} sodium (from labels she entered).` : "No sodium logged in this period." });
    const goals = [g.fluidMl != null ? `fluids ${fmtFluid(g.fluidMl, units)}` : null, g.naMg != null ? `sodium ${fmtSodium(g.naMg, { salt: "mgNa" })}` : null].filter(Boolean);
    blocks.push({ t: "p", text: goals.length ? `Daily goals: ${goals.join(", ")}${goalBy ? `, ${goalBy}` : ""}${g.set ? ` (${fmtDayY(g.set)})` : ""}.` : "No goal set." });
    const met = [g.fluidMl != null && fluidDays ? `Fluid goal reached on ${fluidMet} of ${plural(fluidDays, "logged day")}.` : null, g.naMg != null && naDays ? `Sodium goal reached on ${naMet} of ${plural(naDays, "logged day")}.` : null].filter(Boolean);
    if (met.length) blocks.push({ t: "p", text: met.join(" ") });
    if (ivDays.length) blocks.push({ t: "p", text: `IV fluid days (not counted in the oral totals): ${ivDays.map((x) => `${fmtDay(x.date)} (${fin(x.ml) ? fmtFluid(x.ml, units) : "amount not noted"}${inc.notes && x.note ? `; ${x.note}` : ""})`).join(", ")}.` });
    const last = range.n > 30 ? addDays(range.to, -29) : range.from;
    const bars = [];
    for (let d = last; d <= range.to; d = addDays(d, 1)) {
      let v = null;
      for (const it of dayOf(d).intake || []) if (fin(it.ml)) v = (v || 0) + it.ml;
      bars.push({ date: d, v });
    }
    if (bars.some((x) => x.v != null)) {
      blocks.push({ t: "bars", days: bars, goal: g.fluidMl, units, label: `Oral fluid per day, ${fmtRange(last, range.to)}: ${bars.map((x) => `${fmtDay(x.date)}, ${x.v == null ? "not logged" : fmtFluid(x.v, units)}`).join("; ")}${g.fluidMl != null ? `; goal ${fmtFluid(g.fluidMl, units)}` : ""}.` });
    }
    sections.push({ id: "fluid", title: "Fluids and sodium", blocks });
  }

  /* 4. Medicines and supports */
  if (inc.meds) {
    const blocks = [];
    const meds = (p.meds || []).filter((m) => (!m.started || m.started <= range.to) && (!m.stopped || m.stopped >= range.from));
    if (!meds.length) blocks.push({ t: "p", text: "No medicines or supports on her list for this period." });
    else {
      // The first day she logged this medicine or support, on any date: "Fix up an earlier
      // day" can log doses before she turned POTS on, and those count like any other.
      const firstLog = (m) => {
        let f = null;
        for (const [d, x] of Object.entries(p.days || {})) {
          if (!ISO.test(d) || !isObj(x) || (f && d >= f)) continue;
          if (m.kind === "aid" ? isObj(x.aids) && typeof x.aids[m.id] === "boolean" : (x.doses || []).some((ds) => ds.medId === m.id)) f = d;
        }
        return f;
      };
      const rows = meds.map((m) => {
        const lib = POTS_MED_LIB.find((x) => x.id === m.lib);
        // Counting starts at the Started date she entered, or at the first day she logged it
        // (whichever is earlier), never before the period. With neither, nothing is counted,
        // so days before she added it never read as unlogged.
        const from = [m.started, firstLog(m)].filter(Boolean).sort()[0] || null;
        const start = from && from > range.from ? from : range.from, end = m.stopped && m.stopped < range.to ? m.stopped : range.to;
        const active = [];
        if (from) for (let d = start; d <= end; d = addDays(d, 1)) active.push(d);
        const dates = m.started || m.stopped ? `${m.started ? `from ${fmtDay(m.started)}` : ""}${m.stopped ? `${m.started ? " " : ""}stopped ${fmtDay(m.stopped)}` : ""}` : "—";
        const base = [m.name, (lib && lib.cls) || MED_KIND[m.kind] || "Other", dates, m.times.length ? m.times.map(hm).join(", ") : "none set"];
        if (m.kind === "aid") {
          let worn = 0, not = 0;
          for (const d of active) { const a = (dayOf(d).aids || {})[m.id]; if (a === true) worn++; else if (a === false) not++; }
          return [...base, active.length ? `worn ${plural(worn, "day")}, not worn ${not}` : "none logged", "—", "—", ...(inc.notes ? [m.note || "—"] : [])];
        }
        let any = 0, taken = 0, skipped = 0, notLogged = 0;
        const bySlot = new Map(m.times.map((t) => [t, []]));
        for (const d of active) {
          const ds = (dayOf(d).doses || []).filter((x) => x.medId === m.id);
          if (ds.length) any++;
          for (const x of ds) { if (x.state === "taken") { taken++; if (x.slot && bySlot.has(x.slot)) bySlot.get(x.slot).push(toMin(x.t)); } else if (x.state === "skipped") skipped++; }
          if (d < range.to) for (const t of m.times) if (!ds.some((x) => x.slot === t)) notLogged++;
        }
        // The median of an even count can end in .5: round it to whole minutes before
        // splitting, so 479.5 reads 8:00, never 7:60.
        const usual = m.times.length ? m.times.map((t) => { const md = median(bySlot.get(t)); const r = md == null ? null : Math.round(md); return `${hm(t)} → ${r == null ? "—" : hm(`${String(Math.floor(r / 60) % 24).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}`)}`; }).join("\n") : "—";
        if (!active.length) return [...base, "none logged", "none logged", usual, ...(inc.notes ? [m.note || "—"] : [])];
        return [...base, `${any} of ${plural(active.length, "day")}`, `taken ${taken} · skipped ${skipped}${m.times.length ? ` · not logged ${notLogged}` : ""}`, usual, ...(inc.notes ? [m.note || "—"] : [])];
      });
      const head = ["Name", "Class", "Dates", "Planned times", "Days with a dose logged", "Doses", "Usual logged time", ...(inc.notes ? ["Her note"] : [])];
      const widths = inc.notes ? [62, 70, 55, 50, 58, 70, 60, 90] : [75, 85, 65, 60, 65, 85, 80];
      blocks.push({ t: "table", caption: "Medicines and supports", head, widths, rows, size: 7.5 });
      blocks.push({ t: "p", text: "Day counts start at the start date she entered, or at the first day she logged it if that was earlier or no start date was entered.", small: true });
      // Episodes by time since a dose (design 5.7): descriptive only, once there are 7 days with
      // a dose logged and 10 episodes on them. Episode times are part of "Symptoms, ratings and
      // episodes", so this line needs that box too.
      if (inc.sym) for (const m of meds) { const e = episodesByDose(p, m, periodRows); if (e) blocks.push({ t: "p", text: e.text }); }
    }
    blocks.push({ t: "p", text: inc.notes ? "Medicine names, times and notes are as she entered them. Cyra never suggests a medicine, a dose or a change." : "Medicine names and times are as she entered them. Cyra never suggests a medicine, a dose or a change.", small: true });
    sections.push({ id: "meds", title: "Medicines and supports", blocks });
  }

  /* 6. Cycle pattern (cycle stages, 90 days, design 5.6) and 7. Patterns from her log
     (design 5.3 and 5.7): observations, not causes. Built by lib/potsPatterns.js from the POTS
     log only, plus check-in sleep and hot flashes and her period starts only with cycle
     details; never with watch or ring readings. Every pattern counts rough days, so both
     sections need "Symptoms, ratings and episodes"; and each observation follows the part it
     draws on (factorPart): with a part unticked its factors aren't even compared, and with
     medicines unticked there is no before/after line, so no unticked part reaches a file
     through Patterns. */
  if (inc.patterns && inc.sym && inc.cycle && cycleCard && cycleCard.shown) {
    const G = [["period", "Period days"], ["weekBefore", "Week before her period"], ["other", "Other days"]];
    sections.push({ id: "cycle", title: "Cycle pattern", blocks: [
      { t: "table", caption: `Rough POTS days by cycle group, last 90 days (${plural(cycleCard.k, "cycle")})`, head: ["Days", "Rough days", "Rated days"], widths: [215, 150, 150],
        rows: G.map(([k, l]) => [l, cycleCard.groups[k].enough ? String(cycleCard.groups[k].a) : "not enough days yet", String(cycleCard.groups[k].n)]) },
      { t: "p", text: cycleCard.sentence.replace("Week before your period", "Week before her period") },
      { t: "p", text: "Groups come from the period starts she logged, never from a predicted ovulation or phase.", small: true },
    ] });
  } else if (inc.patterns && inc.cycle && preg) {
    // The screen's "POTS and pregnancy" note, without its line to her ("Bring your stand tests…").
    sections.push({ id: "cycle", title: "POTS and pregnancy", blocks: [{ t: "p", text: PREG_PATTERN_NOTE.slice(0, PREG_PATTERN_NOTE.indexOf(" Bring ")) }] });
  }
  let patternsShown = null;
  if (inc.patterns && inc.sym) {
    const pat = patterns(p, { window: period === "30" ? "30" : "90", range: { from: range.from, to: range.to }, today, stage, stageName, you: false,
      checkin: inc.cycle && typeof checkin === "function" ? checkin : null, starts: inc.cycle ? starts : [],
      keep: (f) => inc[factorPart(f)] !== false, meds: inc.meds !== false });
    const items = [...pat.cards.map((c) => c.text), ...pat.meds.filter((m) => m.beforeAfter && m.beforeAfter.ready).map((m) => medLine(m.name, m.beforeAfter))];
    patternsShown = items;
    sections.push({ id: "patterns", title: "Patterns from her log", blocks: [
      { t: "p", text: "Observations, not causes." },
      ...(items.length ? [{ t: "list", items }] : [{ t: "p", text: "Nothing stood out in this period. Cyra compares only once there are at least 14 rated days, with enough days on each side." }]),
      { t: "p", text: REPORT_FOOT, small: true },
    ] });
  }

  /* 8. Patient's questions */
  const generated = visitQuestions(p, { tests, stage, stageName, teen, cycle: cycleCard });
  const own = (s.questions || []).map((q) => q.text);
  const qList = [...generated.filter((q) => questionIn(q, inc)).map((q) => q.text), ...own];
  if (qList.length) sections.push({ id: "questions", title: "Patient's questions", blocks: [{ t: "list", items: qList }] });

  /* 9. Notes (only if included) */
  if (inc.notes) {
    const notes = [];
    for (const d of days) {
      const x = dayOf(d);
      if (x.note) notes.push({ d, t: "", about: "Day note", text: x.note });
      for (const e of x.eps || []) if (e.note) notes.push({ d, t: e.t, about: `Episode ${hm(e.t)}`, text: e.note });
    }
    for (const t of tests) if (t.note) notes.push({ d: t.date, t: t.t, about: `Stand test ${hm(t.t)}`, text: t.note });
    const key = (n) => `${n.d} ${n.t}`;
    const rows = notes.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0)).map((n) => [fmtDay(n.d), n.about, n.text]);
    if (rows.length) sections.push({ id: "notes", title: "Notes", blocks: [{ t: "table", caption: "Notes she typed", head: ["Date", "About", "Note"], widths: [55, 85, 375], rows }] });
  }

  /* The summary (6.4): first person, no notes, no wearables. */
  const allDone = (p.tests || []).filter((t) => t.status !== "running");
  const latestT = allDone.length ? allDone[allDone.length - 1] : null;
  const latestR = latestT ? standResult(latestT, { teen }) : null;
  const in90 = allDone.filter((t) => t.date >= addDays(today, -89) && t.date <= today).length;
  const sessions30 = 0; // movement sessions arrive with the Move section
  const summary = {
    rated: inc.sym ? `Days rated: ${rated} of ${range.n} (good ${ratings[1]}, okay ${ratings[2]}, rough ${ratings[3]}, bad ${ratings[4]})` : null,
    test: inc.tests && latestT ? `Latest standing test: ${fmtDayY(latestT.date)}, ${methodWord(latestT.method).toLowerCase()}. ${latestR.baseHr != null ? `Lying heart rate ${n1(latestR.baseHr)}` : "No lying heart rate"}${latestR.hrStatus === "insufficient" ? ", not enough readings for a rise" : preg && inc.cycle ? `, largest rise ${n1(latestR.peakRise)} (outside pregnancy, clinicians use ${thr}${latestR.hrStatus.startsWith("single") ? `; ${SUSTAINED_SENTENCE[latestR.hrStatus]}` : ""})` : `, largest rise ${n1(latestR.peakRise)}, sustained ${thr} or more: ${SUSTAINED_SENTENCE[latestR.hrStatus]}`}. Blood pressure: ${latestT.bp ? testBpWord(latestR) : "not taken"}.${preg && inc.cycle ? " I'm pregnant, and heart rate normally rises during pregnancy; these thresholds come from studies of people who weren't pregnant." : ""}` : null,
    tests90: inc.tests ? `Standing tests in the last 90 days: ${in90}` : null,
    sym: inc.sym && symRows.length ? `Most frequent POTS symptoms: ${symRows.slice(0, 3).map((x) => `${x.label} (${plural(x.n, "day")})`).join(", ")}` : null,
    faint: inc.sym ? `Fainted: ${nFaint} · Almost fainted: ${nAlmost}` : null,
    fluid: inc.fluid ? [fluidDays ? `Fluids: about ${fmtFluid(fluidSum / fluidDays, units)} a day on logged days${g.fluidMl != null ? ` (goal ${fmtFluid(g.fluidMl, units)}${g.by === "clinician" ? ", set by my clinician" : g.by === "me" ? ", my own goal" : ""})` : ""}` : "Fluids: none logged", naDays ? `Sodium: about ${fmtSodium(naSum / naDays, { salt: "mgNa" })} a day on logged days${g.naMg != null ? ` (goal ${fmtSodium(g.naMg, { salt: "mgNa" })})` : ""}` : null].filter(Boolean).join(". ") : null,
    meds: inc.meds ? ((p.meds || []).filter((m) => m.kind !== "aid" && !m.stopped).length ? `POTS medicines: ${(p.meds || []).filter((m) => m.kind !== "aid" && !m.stopped).map((m) => m.name).join(", ")}` : "POTS medicines: none on my list") : null,
    sessions: sessions30 ? `Exercise sessions in the last 30 days: ${sessions30}` : null,
  };

  return {
    today, period, range, rangeLabel, inc, who, stage, preg, units, thr, teen, enough,
    paper: paperFor(p, locale),
    files: { pdf: `cyra-report-${today}.pdf`, csv: `cyra-data-${today}.csv` },
    header, sections, summary,
    questions: { generated, own: s.questions || [] },
    data: { p, days, tests, tilt, overlap, results, cycleDays: new Map(tests.map((t) => [t.id, cycleOf(t)]).filter(([, c]) => c)), patterns: patternsShown },
  };
}

/* ---------- CSV (design 6.3) ---------- */
export const CSV_HEADER = "record,date,time,item,value,unit,position,minute,severity,detail";
/** One CSV cell (RFC 4180): numbers bare, text quoted with "" escaping, and text that a
    spreadsheet could read as a formula (starting with = + - @, tab or CR) gets a leading '. */
export function csvCell(v) {
  if (v == null || v === "") return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
const kv = (pairs) => pairs.filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}=${v}`).join("; ");

/** The spreadsheet: one tidy table, UTF-8 with BOM, CRLF line endings. Every reading in the
    period, nothing derived from a watch or ring, typed notes only with "Notes I typed". */
export function toCSV(model) {
  if (!model) return "";
  const { data: { p, days, tests, tilt, overlap, results, cycleDays }, inc } = model;
  const rows = [];
  const R = (record, date, time, item, value, unit, position, minute, severity, detail) => rows.push([record, date, time, item, value, unit, position, minute, severity, detail]);
  const note = (s) => (inc.notes && s ? s : null);
  const s = p.settings;
  if (inc.fluid) {
    if (s.goals.fluidMl != null) R("goal", s.goals.set, "", "fluid_goal", s.goals.fluidMl, "ml", "", "", "", kv([["set_by", s.goals.by]]));
    if (s.goals.naMg != null) R("goal", s.goals.set, "", "sodium_goal", s.goals.naMg, "mg_sodium", "", "", "", kv([["set_by", s.goals.by]]));
  }
  if (inc.meds) {
    for (const m of p.meds || []) {
      if ((m.started && m.started > model.range.to) || (m.stopped && m.stopped < model.range.from)) continue;
      const lib = POTS_MED_LIB.find((x) => x.id === m.lib);
      R("med", m.started, "", m.name, "", "", "", "", "", kv([["class", (lib && lib.cls) || MED_KIND[m.kind] || "Other"], ["kind", m.kind], ["started", m.started], ["stopped", m.stopped], ["times", m.times.join(" ")], ["note", note(m.note)]]));
    }
  }
  const medName = (id) => ((p.meds || []).find((m) => m.id === id) || {}).name || "Other medicine";
  const byDate = new Map();
  for (const t of tests) byDate.set(t.date, [...(byDate.get(t.date) || []), t]);
  const allDates = [...new Set([...days, ...tests.map((t) => t.date), ...tilt.map((t) => t.date), ...overlap.map((o) => o.date)])].sort();
  for (const d of allDates) {
    const x = p.days[d] || {};
    if (inc.sym) {
      if (fin(x.rating)) R("day_rating", d, "", "rating", x.rating, "scale_1_good_4_bad", "", "", "", RATING_WORD[x.rating]);
      if (fin(x.up)) R("day_upright", d, "", "upright", x.up, "scale", "", "", "", "");
      for (const [id, v] of Object.entries(x.sym || {})) R("symptom_day", d, "", symName(p, id), v, "severity", "", "", v, known(p, id, "sym") ? "" : id);
      if (inc.cycle) for (const o of overlap.filter((o) => o.date === d)) R("checkin_overlap", d, "", o.label, o.sev, "severity", "", "", o.sev, "from cycle/pregnancy check-in");
      for (const id of x.trig || []) R("trigger", d, "", trigName(p, id), 1, "", "", "", "", known(p, id, "trig") ? "" : id);
    }
    if (inc.fluid) {
      for (const it of [...(x.intake || [])].sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0))) {
        const label = it.label || KIND_WORD[it.kind] || "Other";
        if (fin(it.ml)) R("fluid", d, it.t, label, it.ml, "ml", "", "", "", it.kind);
        if (fin(it.naMg)) R("sodium", d, it.t, label, it.naMg, "mg_sodium", "", "", "", fin(it.ml) ? "from drink" : it.kind);
      }
      if (x.iv) R("iv", d, "", "iv_fluids", fin(x.iv.ml) ? x.iv.ml : "", "ml", "", "", "", kv([["note", note(x.iv.note)]]));
    }
    if (inc.meds) {
      for (const ds of [...(x.doses || [])].sort((a, b) => (a.t < b.t ? -1 : 1))) R("dose", d, ds.t, medName(ds.medId), ds.state, "", "", "", "", ds.slot ? `planned ${ds.slot}` : "");
      for (const [id, v] of Object.entries(x.aids || {})) R("support", d, "", medName(id), v ? "worn" : "not_worn", "", "", "", "", "");
    }
    if (inc.sym) {
      for (const e of [...(x.eps || [])].sort((a, b) => (a.t < b.t ? -1 : 1))) {
        const src = e.src ? `${SRC_CSV[linkSource(p, e)]} ${e.src}` : null;
        R("episode", d, e.t, e.sym.map((id) => symName(p, id)).join("; ") || (e.faint ? "Faint" : "Episode"), fin(e.mins) ? e.mins : "", "min", e.pos ? POS_WORD[e.pos] || e.pos : "", "", fin(e.sev) ? e.sev : "",
          kv([["faint", e.faint], ["injured", e.injured ? "yes" : "no"], ["triggers", (e.trig || []).map((id) => trigName(p, id)).join(", ")], ["helped", (e.helped || []).map((h) => HELPED_WORD[h] || "Other").join(", ")], ["source", src], ["note", note(e.note)]]));
      }
      if (inc.notes && x.note) R("note", d, "", "day_note", "", "", "", "", "", x.note);
    }
    if (inc.tests) {
      for (const v of [...(x.vit || [])].sort((a, b) => (a.t < b.t ? -1 : 1))) {
        const pos = VIT_POS[v.pos] ? v.pos : "other";
        if (fin(v.hr)) R("vitals", d, v.t, "hr", v.hr, "bpm", pos, "", "", "");
        if (fin(v.sys)) R("vitals", d, v.t, "sys", v.sys, "mmHg", pos, "", "", "");
        if (fin(v.dia)) R("vitals", d, v.t, "dia", v.dia, "mmHg", pos, "", "", "");
      }
      for (const t of byDate.get(d) || []) {
        const r = results.get(t.id), c = t.ctx || {};
        const felt = [...new Set([...(t.feel || []), ...(t.up || []).flatMap((u) => u.feel || [])])].map((id) => symName(p, id)).join(", ");
        R("stand_summary", d, t.t, "max_rise", r.hrStatus !== "insufficient" && fin(r.peakRise) ? Math.round(r.peakRise * 10) / 10 : "", "bpm", "", "", "",
          kv([["test_id", t.id], ["method", t.method], ["rest", `${t.restPos === "left" ? "left side" : "back"} ${t.restMin} min`], ["device", t.device], ["lying_hr", r.baseHr != null ? Math.round(r.baseHr * 10) / 10 : null], ["peak_hr", r.hrStatus !== "insufficient" ? r.peakHr : null], ["peak_min", r.hrStatus !== "insufficient" ? r.peakMin : null], ["threshold", r.thr], ["sustained", SUSTAINED_WORD[r.hrStatus]], ["bp_finding", t.bp ? testBpWord(r) : "not taken"], ["status", t.status], ["stopped_at", t.status === "stopped" ? t.stoppedAt : null], ["why", t.why], ["fainted", t.fainted], ["meds", c.meds], ["rate_med", c.rateMed], ["compression", c.comp == null ? null : c.comp ? "yes" : "no"], ["ate_2h", c.ate2h == null ? null : c.ate2h ? "yes" : "no"], ["fluid_before_ml", c.mlBefore], ["cycle_day", cycleDays.get(t.id)?.day], ["week_before_period", cycleDays.get(t.id)?.weekBefore ? "yes" : null], ["pooling", t.pooling], ["felt", felt], ["edited", t.edited ? "yes" : null], ["threshold_note", model.preg && inc.cycle ? "from studies outside pregnancy" : null], ["note", note(t.note)]]));
        const lyingPos = t.restPos === "left" ? "left" : "lying";
        for (const rd of [...(t.rest || [])].sort((a, b) => a.min - b.min)) {
          const det = kv([["test_id", t.id], ["method", t.method], ["phase", "rest"], ["counted", rd.how === "counted" ? "yes" : null], ["edited", t.edited ? "yes" : null]]);
          if (fin(rd.hr)) R("stand_reading", d, t.t, "hr", rd.hr, "bpm", lyingPos, rd.min, "", det);
          if (fin(rd.sys)) R("stand_reading", d, t.t, "sys", rd.sys, "mmHg", lyingPos, rd.min, "", det);
          if (fin(rd.dia)) R("stand_reading", d, t.t, "dia", rd.dia, "mmHg", lyingPos, rd.min, "", det);
        }
        for (const rd of [...(t.up || [])].sort((a, b) => a.min - b.min)) {
          const after = fin(rd.atSec) ? Math.max(0, Math.round(rd.atSec - rd.min * 60)) : null;
          const det = kv([["test_id", t.id], ["method", t.method], ["phase", "upright"], ["entered_after_s", after], ["counted", rd.how === "counted" ? "yes" : null], ["felt", (rd.feel || []).map((id) => symName(p, id)).join(", ")], ["edited", t.edited ? "yes" : null]]);
          if (fin(rd.hr)) R("stand_reading", d, t.t, "hr", rd.hr, "bpm", "standing", rd.min, "", det);
          if (fin(rd.sys)) R("stand_reading", d, t.t, "sys", rd.sys, "mmHg", "standing", rd.min, "", det);
          if (fin(rd.dia)) R("stand_reading", d, t.t, "dia", rd.dia, "mmHg", "standing", rd.min, "", det);
        }
      }
      for (const x2 of tilt.filter((t) => t.date === d)) R("tilt_note", d, "", "tilt", fin(x2.hrRise) ? x2.hrRise : "", "bpm", "", "", "", kv([["where", note(x2.where)], ["told", note(x2.told)], ["bp_note", note(x2.bpNote)], ["fainted", x2.fainted]]));
    }
  }
  return `﻿${[CSV_HEADER, ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n")}\r\n`;
}

/* ---------- summary and email (design 6.4) ---------- */
/** The summary she can copy into a portal message: first person, no notes, no wearables. */
export function summaryText(model) {
  if (!model) return "";
  const s = model.summary;
  const lines = [s.rated, s.test, s.tests90, s.sym, s.faint, s.fluid, s.meds, s.sessions].filter(Boolean);
  return [
    "Hello,",
    "",
    `Here is a short summary of my POTS log from the Cyra app, ${model.rangeLabel}. I logged it at home myself; it isn't a diagnosis.`,
    "",
    ...lines.map((l) => `- ${l}`),
    "",
    "I can bring the full PDF and spreadsheet to the visit.",
    ...(model.who ? ["", model.who] : []),
  ].join("\n");
}
/** The email draft: a neutral subject (a mail preview never names a condition) and the summary. */
export function emailParts(model) {
  return { subject: `My health log summary ahead of my appointment${model && model.who ? ` — ${model.who}` : ""}`, body: summaryText(model) };
}

/* Characters the PDF (WinAnsi, lib/pdf.js winAnsi) can show: printable ASCII, Latin-1, the 27
   WinAnsi extras, the symbols it writes as text (≥ -> ">=" and so on) and spaces. Kept here,
   not imported from lib/pdf.js, so that writer stays in its own lazily loaded chunk. */
const PDF_OK = /^[\x20-\x7e\xa0-\xff\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178≥≤→←≈✓✔×−‑‐\t\n\r\f\v\u2000-\u200a\u202f\u205f\u3000]*$/;
/** True when the PDF can't show some of `str` exactly (it would print "?" or leave an emoji
    out): the Report section then says so. */
export const pdfLossy = (str) => !PDF_OK.test(String(str ?? ""));

/** Every piece of text the model can put in front of a reader (for the wording tests and
    the "can't be shown in the PDF" check). */
export function modelTexts(model) {
  if (!model) return [];
  const out = [model.header.line, model.header.made, ...model.header.context, model.header.rated].filter(Boolean);
  for (const sec of model.sections) {
    out.push(sec.title);
    for (const b of sec.blocks) {
      if (b.t === "p") out.push(b.text);
      if (b.t === "list") out.push(...b.items);
      if (b.t === "table") out.push(b.caption, ...b.head, ...b.rows.flat());
      if (b.t === "hr") for (const c of b.charts) out.push(c.title, c.label);
      if (b.t === "trend" || b.t === "bars") out.push(b.label);
    }
  }
  return out.filter((x) => typeof x === "string");
}

/* ---------- PDF layout (design 6.2) ---------- */
// Data colours come from the data-viz ramp only (one fixed ramp, so a file's colours never hint
// at her life stage); chrome is greys and black.
const RAMP = RAMPS.peri;
const INK = [34, 34, 34], SOFT = [95, 95, 95], RULE = [170, 170, 170];

function drawHr(doc, x, y, w, h, c) {
  doc.text(x, y + 8, c.title, { size: 8, bold: true });
  const L = x + 4, R = x + w - 6, T = y + 18, B = y + h - 30;
  const vals = [...c.pts.map((q) => q.hr), c.base, c.base + c.thr];
  const lo = Math.floor((Math.min(...vals) - 8) / 10) * 10, hi = Math.ceil((Math.max(...vals) + 8) / 10) * 10;
  const maxMin = Math.max(10, ...c.pts.map((q) => q.min));
  const px = (m) => L + (m / maxMin) * (R - L), py = (v) => T + (1 - (v - lo) / (hi - lo)) * (B - T);
  doc.line(L, B, R, B, { rgb: RULE, width: 0.6 });
  for (const m of [0, 1, 3, 5, 10].filter((m) => m <= maxMin)) doc.text(px(m), B + 8, String(m), { size: 6.5, align: "center", rgb: SOFT });
  doc.text((L + R) / 2, B + 17, "minutes upright", { size: 6.5, align: "center", rgb: SOFT });
  doc.line(L, py(c.base), R, py(c.base), { dash: [3, 2], rgb: INK, width: 0.6 });
  doc.line(L, py(c.base + c.thr), R, py(c.base + c.thr), { dash: [1, 2], rgb: INK, width: 0.6 });
  doc.poly(c.pts.map((q) => [px(q.min), py(q.hr)]), { rgb: RAMP.rough, width: 1.4 });
  for (const q of c.pts) { doc.dot(px(q.min), py(q.hr), 1.8, { rgb: RAMP.rough }); doc.text(px(q.min), py(q.hr) - 4, String(q.hr), { size: 6.5, bold: true, align: "center" }); }
  doc.text(x, y + h - 2, `dashed: ${c.rest.toLowerCase()} ${n1(c.base)} · dotted: +${c.thr}`, { size: 6.5, rgb: SOFT });
}
function drawTrend(doc, x, y, w, h, b) {
  doc.text(x, y + 8, `Largest rise in each complete ${b.methodLabel}${b.median != null ? ` (median ${n1(b.median)})` : ""}`, { size: 8, bold: true });
  const L = x + 4, R = x + w - 26, T = y + 20, B = y + h - 14;
  const vals = [...b.rows.map((r) => r.rise), b.thr, 0];
  const lo = Math.floor(Math.min(...vals) / 10) * 10, hi = Math.ceil((Math.max(...vals) + 6) / 10) * 10;
  const px = (i) => (b.rows.length === 1 ? (L + R) / 2 : L + (i / (b.rows.length - 1)) * (R - L)), py = (v) => T + (1 - (v - lo) / (hi - lo)) * (B - T);
  doc.line(L, py(b.thr), R, py(b.thr), { dash: [3, 2], rgb: INK, width: 0.6 });
  doc.text(R + 4, py(b.thr) + 2, `+${b.thr}`, { size: 6.5, rgb: SOFT });
  const every = Math.max(1, Math.ceil(b.rows.length / 10));
  b.rows.forEach((r, i) => {
    doc.dot(px(i), py(r.rise), 2.4, { rgb: r.rise >= b.thr ? RAMP.rough : RAMP.good });
    doc.text(px(i), py(r.rise) - 5, n1(r.rise), { size: 6.5, bold: true, align: "center" });
    if (i % every === 0 || i === b.rows.length - 1) doc.text(px(i), B + 9, fmtDay(r.date), { size: 6, align: "center", rgb: SOFT });
  });
}
function drawBars(doc, x, y, w, h, b) {
  doc.text(x, y + 8, `Oral fluid per day${b.goal != null ? " (dashed: her goal)" : ""}`, { size: 8, bold: true });
  const L = x + 4, R = x + w - 4, T = y + 22, B = y + h - 14;
  const max = Math.max(1, b.goal || 0, ...b.days.map((d) => d.v || 0)) * 1.1;
  const step = (R - L) / b.days.length, bw = Math.max(2, step * 0.7);
  const py = (v) => B - (v / max) * (B - T);
  doc.line(L, B, R, B, { rgb: RULE, width: 0.6 });
  b.days.forEach((d, i) => {
    const cx = L + step * i + step / 2;
    if (d.v != null) {
      doc.rect(cx - bw / 2, py(d.v), bw, B - py(d.v), { fill: RAMP.mid });
      if (b.days.length <= 31) doc.text(cx, py(d.v) - 2, b.units && b.units.fluid === "oz" ? String(Math.round(d.v / 29.5735)) : n1(Math.round(d.v / 100) / 10), { size: 5, align: "center" });
    } else doc.text(cx, B - 2, "–", { size: 6, align: "center", rgb: SOFT });
    if (i % 5 === 0 || i === b.days.length - 1) doc.text(cx, B + 8, fmtDay(d.date), { size: 5.5, align: "center", rgb: SOFT });
  });
  if (b.goal != null) doc.line(L, py(b.goal), R, py(b.goal), { dash: [3, 2], rgb: INK, width: 0.7 });
  doc.text(R, T - 6, b.units && b.units.fluid === "oz" ? "labels in oz · – not logged" : "labels in litres · – not logged", { size: 6, align: "right", rgb: SOFT });
}

/** The PDF for `model`, drawn with `PdfDoc` (lib/pdf.js, passed in so that module stays in
    its own lazily loaded chunk). -> Uint8Array. */
export function reportPdf(model, PdfDoc) {
  const doc = new PdfDoc({ paper: model.paper });
  doc.page();
  const X = doc.margin, W = doc.W - 2 * doc.margin;
  let y = doc.top + 4;
  y = doc.wrap(X, y, W, model.header.line, { size: 13, bold: true, gap: 1.3 });
  y = doc.wrap(X, y + 1, W, model.header.made, { size: 8, rgb: SOFT });
  for (const c of model.header.context) y = doc.wrap(X, y, W, c, { size: 8.5 });
  if (model.header.rated) y = doc.wrap(X, y, W, model.header.rated, { size: 8.5, bold: true });
  y += 4;
  model.sections.forEach((sec, i) => {
    y = doc.ensure(y + 6, 60);
    doc.line(X, y - 9, X + W, y - 9, { rgb: RULE, width: 0.5 });
    y = doc.wrap(X, y + 4, W, `${i + 1}. ${sec.title}`, { size: 11.5, bold: true });
    for (const b of sec.blocks) {
      if (b.t === "p") y = doc.wrap(X, y, W, b.text, { size: b.small ? 7.5 : 9, rgb: b.small ? SOFT : null }) + 1;
      else if (b.t === "list") for (const it of b.items) { y = doc.ensure(y, 12); doc.text(X, y, "•", { size: 9 }); y = doc.wrap(X + 10, y, W - 10, it, { size: 9 }) + 2; }
      else if (b.t === "table") {
        y = doc.ensure(y, 40);
        y = doc.wrap(X, y + 2, W, b.caption, { size: 8.5, bold: true }) - 6;
        const total = b.widths.reduce((a, c) => a + c, 0);
        y = doc.table(X, y, b.head.map((label, j) => ({ label, w: (b.widths[j] / total) * W })), b.rows, { size: b.size || 8 }) + 10;
      } else if (b.t === "hr") {
        const h = 120, gap = 10, cw = (W - gap * 2) / 3;
        y = doc.ensure(y, h + 6);
        b.charts.forEach((c, j) => drawHr(doc, X + j * (cw + gap), y, cw, h, c));
        y += h + 12;
      } else if (b.t === "trend") { y = doc.ensure(y, 110); drawTrend(doc, X, y, W, 100, b); y += 112; }
      else if (b.t === "bars") { y = doc.ensure(y, 120); drawBars(doc, X, y, W, 110, b); y += 122; }
    }
  });
  doc.footer((n, m, d) => d.text(d.W / 2, d.H - 24, `Page ${n} of ${m} · Cyra · Observations, not a diagnosis.`, { size: 7.5, align: "center", rgb: SOFT }));
  return doc.bytes();
}
