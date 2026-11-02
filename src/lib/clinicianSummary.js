/* The clinician summary (doctor report v2, 2026-11-02): ONE printed page a clinician can read in a minute, built on
   this device from her own log, plus the optional detailed pages (the L9 appointment PDF, lib/visitReport.js).
   Pure: no React, no storage, no network, no Date.now; it never imports pdf.js (the caller passes PdfDoc, as
   visitReport.js does), so the same input gives the same bytes.

   summaryModel() builds page 1's data: header, cycles strip, top symptoms with their cycle-day cluster, What I'm trying
   with before / since counts, typed lab values over time, sleep / movement / mood in one line each, and her questions.
   fitSummary(model, PdfDoc) trims the lists until page 1 really fits one page (US Letter and A4), each trimmed list
   ending "+N more in the detailed pages" (or "+N more not shown" when the detailed pages are off). summaryPdf() draws
   page 1, then, only when she ticks "Add the detailed pages", the full lists, the L9 pages (tables, day ratings, notes
   and meal notes if ticked) and her saved AI write-up if she ticks it.

   Rules (owner spec, CLINICIAN-REVIEW "Clinician summary"):
   - Words only, never a verdict: a treatment row says what "changed in her log", never that something works.
   - Lab values exactly as she typed them, with unit and date; no interpretation, no reference ranges, no flags.
   - No scores on page 1 (the day score lives in the detailed pages, as before).
   - Her name only when she ticks "Include my name" (default off); notes and meal notes only when ticked.
   - Every printed character is WinAnsi (pdf.js winAnsi); the Report screen warns when something would print as "?". */
import { cycleStarts, cycleSpans, daysBetween, isExcluded, isRoughNight, addDays } from "./engine.js";
import { ALL_SYM, GSYM } from "./constants.js";
import { LAB_KINDS, labText, cleanBodyLog, cleanLabs } from "./bodylog.js";
import { cleanMoodLog, moodLabel } from "./mind.js";
import { kindLabel, TRY_MIN } from "./trying.js";
import { fmtDay, fmtDayY, fmtRange } from "./potsReport.js";
import { drawVisitBody } from "./visitReport.js";
import { cleanQuestions, addQuestion, removeQuestion, QUESTIONS_MAX, QUESTION_LEN } from "./visitQuestions.js";

/* ---------- fixed text ---------- */
export const SUMMARY_TITLE = "Solia Health · Clinician summary";
export const SUMMARY_MADE = "Prepared by the patient from her own log. Not a diagnosis.";
export const PATIENT_DATA = "Patient-reported data";
export const summaryFooter = (n, m, today) => `Page ${n} of ${m} · ${PATIENT_DATA} · Generated ${fmtDayY(today)}`;
export const NOT_ENOUGH = "Not enough days to compare";
export const TREAT_NOTE = "Counts from her log before and since each start date: what changed in her log, not a judgement of the treatment.";
export const LABS_NOTE = "Values exactly as she typed them, newest first; the small line runs oldest to newest. Not interpreted; no reference ranges.";
export const LABS_NOTE_ALL = "Values exactly as she typed them, newest first. Not interpreted; no reference ranges.";
export const NO_LABS = "No lab values typed in.";
export const NO_TREAT = "Nothing listed under What I'm trying.";
export const NO_QUESTIONS = "No questions added.";
export const moreLine = (n, appendix) => (n > 0 ? `+${n} more ${appendix ? "in the detailed pages" : "not shown"}` : null);

/* ---------- limits ---------- */
export const PERIOD_DAYS = 90;      // "a typical 3-month log"
export const CYCLES_SHOWN = 6;
export const LONG_CYCLE = 35;       // longer than this is marked
export const TOP_SYMPTOMS = 6;
export const LAB_VALUES_SHOWN = 4;  // per test, newest first
export const COMPARE_DAYS = 90;     // each side of a start date, at most
export const CLUSTER = Object.freeze({ minDays: 3, minShare: 0.4 });
/** Cycle-day buckets (the same five as the AI summary's): [first day, last day, words]. */
export const CD_BUCKETS = Object.freeze([[1, 5, "cycle days 1–5"], [6, 12, "cycle days 6–12"], [13, 19, "cycle days 13–19"], [20, 28, "cycle days 20–28"], [29, 120, "cycle day 29 on"]]);

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const r1 = (n) => Math.round(n * 10) / 10;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/* ---------- questions: lib/visitQuestions.js (persisted key `visitQuestions`, in backups) ---------- */
export { cleanQuestions, addQuestion, removeQuestion, QUESTIONS_MAX, QUESTION_LEN };

/* ---------- the model ---------- */
const lifeStage = (stage, stageName) => (stage === "preg" ? "Pregnancy" : stage === "peri" ? (stageName === "Menopause" ? "Menopause" : "Perimenopause") : stageName === "Trying to Conceive" ? "Trying to conceive" : "My Cycle");
const bucketOf = (cd) => CD_BUCKETS.findIndex(([a, b]) => cd >= a && cd <= b);

function cyclesPart(sorted, today, cycleFlags, here) {
  if (!here) return { shown: false, line: "Cycles are not tracked in this life stage.", strip: [] };
  const starts = cycleStarts(sorted.filter((e) => e.date <= today));
  const spans = cycleSpans(starts);
  const counted = spans.filter((s) => s.counted);
  const last = counted.slice(-CYCLES_SHOWN);
  const strip = last.map((s) => ({ start: s.start, len: s.len, long: s.len > LONG_CYCLE, excluded: isExcluded(s.start, cycleFlags || {}) }));
  const cur = starts.length ? daysBetween(starts[starts.length - 1], today) + 1 : null;
  const inAvg = strip.filter((c) => !c.excluded).map((c) => c.len);
  const a = avg(inAvg);
  const lines = [];
  if (!strip.length) lines.push(starts.length ? "No complete cycle logged yet." : "No period start logged.");
  else {
    if (inAvg.length >= 2) lines.push(`Average ${Math.round(a)} days, range ${Math.min(...inAvg)}–${Math.max(...inAvg)}, over ${inAvg.length} cycles.`);
    else if (inAvg.length === 1) lines.push(`One complete cycle in the average: ${inAvg[0]} days.`);
    else lines.push("No cycle in the average (every one shown was left out of predictions).");
    const nLong = strip.filter((c) => c.long).length;
    if (nLong) lines.push(`${nLong} of ${strip.length} longer than ${LONG_CYCLE} days.`);
    const nEx = strip.filter((c) => c.excluded).length;
    if (nEx) lines.push(`${nEx} left out of predictions by her (shown, not averaged).`);
  }
  const notCounted = spans.slice(-CYCLES_SHOWN).filter((s) => !s.counted).length;
  if (notCounted) lines.push(`${plural(notCounted, "gap")} under 15 or over 120 days not counted as cycles.`);
  return {
    shown: true, strip, current: cur != null && cur >= 1 && cur <= 400 ? cur : null, average: a == null ? null : Math.round(a),
    range: inAvg.length ? [Math.min(...inAvg), Math.max(...inAvg)] : null, starts,
    line: lines.join(" "),
    currentLine: cur != null && cur >= 1 && cur <= 400 ? `Current cycle: day ${cur} (started ${fmtDay(starts[starts.length - 1])}).` : null,
  };
}

function symptomsPart(win, labels, starts, here) {
  const cdOf = (iso) => { let s = null; for (const st of starts) { if (st <= iso) s = st; else break; } if (!s) return null; const n = daysBetween(s, iso) + 1; return n >= 1 && n <= 120 ? n : null; };
  const map = new Map();
  for (const e of win) {
    if (!isObj(e.sym)) continue;
    const b = here && starts.length ? bucketOf(cdOf(e.date) ?? -1) : -1;
    for (const [id, sev] of Object.entries(e.sym)) {
      if (!Object.prototype.hasOwnProperty.call(labels, id) || !(sev > 0)) continue;
      const row = map.get(id) || { id, label: labels[id], days: 0, strong: 0, buckets: CD_BUCKETS.map(() => 0) };
      row.days++; if (sev >= 2) row.strong++;
      if (b >= 0) row.buckets[b]++;
      map.set(id, row);
    }
  }
  const order = Object.keys(labels);
  const all = [...map.values()].sort((a, b) => b.days - a.days || order.indexOf(a.id) - order.indexOf(b.id));
  for (const r of all) {
    const inB = r.buckets.reduce((x, y) => x + y, 0);
    let best = -1;
    r.buckets.forEach((n, i) => { if (best < 0 || n > r.buckets[best]) best = i; });
    r.cluster = !here || !starts.length || inB === 0 ? null
      : r.buckets[best] >= CLUSTER.minDays && r.buckets[best] / inB >= CLUSTER.minShare ? `mostly ${CD_BUCKETS[best][2]} (${r.buckets[best]} of ${inB})`
      : "spread across the cycle";
  }
  return all;
}

/* Before / since a start date, over at most COMPARE_DAYS each side (the "since" side ends today; the "before" side is as
   long as the "since" side so the two are like for like). Cycle length: complete counted cycles that START on that
   side. Top symptom: days with it of the logged days on that side, TRY_MIN logged days each side at least. */
function treatmentsPart(meds, sorted, starts, topSym, today, here) {
  const spans = cycleSpans(starts).filter((s) => s.counted);
  const out = [];
  for (const m of Array.isArray(meds) ? meds : []) {
    if (!isObj(m) || typeof m.name !== "string" || !m.name.trim() || !ISO.test(String(m.started))) continue;
    const s = m.started;
    const span = Math.min(COMPARE_DAYS, Math.max(0, daysBetween(s, today) + 1));
    const row = { id: m.id, name: m.name.trim().slice(0, 60), kind: kindLabel(m.kind), started: s, startLine: `since ${fmtDayY(s)}`, compares: [], line: null };
    if (span > 0 && s <= today) {
      const bFrom = addDays(s, -span), bTo = addDays(s, -1), aTo = addDays(s, span - 1) > today ? today : addDays(s, span - 1);
      if (here) {
        const before = spans.filter((c) => c.start >= bFrom && c.start <= bTo && c.next <= s).map((c) => c.len);
        const since = spans.filter((c) => c.start >= s && c.start <= aTo).map((c) => c.len);
        if (before.length && since.length) row.compares.push({ what: "Cycle length", before: `${Math.round(avg(before))} d avg (${plural(before.length, "cycle")})`, since: `${Math.round(avg(since))} d avg (${plural(since.length, "cycle")})` });
      }
      if (topSym) {
        const b = sorted.filter((e) => e.date >= bFrom && e.date <= bTo), a = sorted.filter((e) => e.date >= s && e.date <= aTo);
        if (b.length >= TRY_MIN && a.length >= TRY_MIN) {
          const hit = (xs) => xs.filter((e) => isObj(e.sym) && e.sym[topSym.id] > 0).length;
          row.compares.push({ what: `${topSym.label} days`, before: `${hit(b)} of ${b.length} logged`, since: `${hit(a)} of ${a.length} logged` });
        }
      }
    }
    row.line = row.compares.length ? row.compares.map((c) => `${c.what}: before ${c.before}; since ${c.since}`).join(". ") + "." : `${NOT_ENOUGH}.`;
    out.push(row);
  }
  return out.sort((a, b) => b.started.localeCompare(a.started));
}

function labsPart(labs, today) {
  const clean = cleanLabs(labs); // newest first
  const kinds = Object.keys(LAB_KINDS);
  return kinds.map((k) => {
    const vals = clean.filter((x) => x.kind === k);
    if (!vals.length) return null;
    const unit = vals[0].unit;
    const trend = vals.filter((x) => x.unit === unit).slice().reverse().map((x) => x.value); // oldest → newest, newest's unit
    return { kind: k, label: LAB_KINDS[k].label, values: vals.map((x) => ({ date: x.date, text: labText(x), cell: `${labText(x)} (${fmtDay(x.date)}${x.date.slice(0, 4) !== String(today).slice(0, 4) ? `, ${x.date.slice(0, 4)}` : ""})` })), trend: trend.length >= 2 ? trend : null };
  }).filter(Boolean);
}

function dailyPart(win, from, today, bodyLog, moodLog) {
  const inW = (d) => ISO.test(d) && d >= from && d <= today;
  const body = cleanBodyLog(bodyLog);
  const hrs = [], moves = [];
  for (const [d, v] of Object.entries(body)) { if (!inW(d)) continue; if (v.sleepH != null) hrs.push(v.sleepH); for (const m of v.move || []) moves.push(m.min); }
  const rough = win.filter(isRoughNight).length;
  const weeks = Math.max(1, (daysBetween(from, today) + 1) / 7);
  const sleep = hrs.length || win.length ? `${hrs.length ? `${r1(avg(hrs))} h average over ${plural(hrs.length, "night")} with hours` : "No hours logged"}; ${plural(rough, "rough night")} in her check-ins.` : "Nothing logged.";
  const move = moves.length ? `${plural(moves.length, "session")} (${r1(moves.length / weeks)} a week), ${Math.round(moves.reduce((a, b) => a + b, 0) / weeks)} min a week on average.` : "No sessions logged.";
  const mood = cleanMoodLog(moodLog);
  const m = Object.entries(mood).filter(([d]) => inW(d)).map(([, v]) => v).filter((v) => Number.isInteger(v.mood));
  let moodLine = "No mood check-ins.";
  if (m.length) {
    const cnt = new Map();
    for (const v of m) cnt.set(v.mood, (cnt.get(v.mood) || 0) + 1);
    const [top, k] = [...cnt.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
    const low = m.filter((v) => v.mood <= 2).length;
    moodLine = `${plural(m.length, "check-in")}; most often "${moodLabel(top)}" (${k}); low or very low on ${plural(low, "day")}.`;
  }
  return { sleep, move, mood: moodLine, nights: hrs.length, sessions: moves.length, checkIns: m.length };
}

/**
 * Page 1's data. days: her day entries; stage / stageName; pcosOn; today (YYYY-MM-DD); name: '' unless she ticked
 * "Include my name"; meds: What I'm trying; labs; bodyLog; moodLog; cycleFlags; questions: her typed questions;
 * picked: the suggested questions she added with "Add to email and PDF" (listed after her own).
 */
export function summaryModel({ days = [], stage = "periods", stageName = "", pcosOn = false, today, name = "", meds = [], labs = [], bodyLog = {}, moodLog = {}, cycleFlags = {}, questions = [], picked = [], paper = "a4", appendix = false } = {}) {
  const sorted = (Array.isArray(days) ? days : []).filter((e) => isObj(e) && typeof e.date === "string" && ISO.test(e.date) && e.date <= today).slice().sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted.length ? sorted[0].date : today;
  const from = addDays(today, -(PERIOD_DAYS - 1)) > first ? addDays(today, -(PERIOD_DAYS - 1)) : first;
  const win = sorted.filter((e) => e.date >= from);
  const logged = new Set(win.map((e) => e.date)).size;
  const stageWords = lifeStage(stage, stageName);
  const here = stage !== "preg" && stageWords !== "Menopause";
  const cycles = cyclesPart(sorted, today, cycleFlags, here);
  const starts = cycles.starts || [];
  const labels = stage === "preg" ? GSYM : ALL_SYM;
  const symAll = symptomsPart(win, labels, starts, here);
  const treatments = treatmentsPart(meds, sorted, starts, symAll[0] || null, today, here);
  const labRows = labsPart(labs, today);
  const daily = dailyPart(win, from, today, bodyLog, moodLog);
  const qs = [];
  for (const q of [...cleanQuestions(questions), ...(Array.isArray(picked) ? picked : []).map((x) => String(x ?? "").trim()).filter(Boolean)]) if (!qs.includes(q)) qs.push(q);
  const cleanName = String(name || "").trim().slice(0, 60);
  return {
    paper, today, from, logged, appendix: appendix === true,
    header: {
      title: SUMMARY_TITLE,
      name: cleanName || null,
      period: `${fmtRange(from, today)} · ${plural(logged, "day")} logged`,
      stage: `${stageWords}${stage === "preg" ? "" : ` · PCOS module ${pcosOn ? "on" : "off"}`}`,
      made: SUMMARY_MADE,
    },
    cycles, symptoms: { rows: symAll, logged }, treatments, labs: labRows, daily, questions: qs,
    limits: { symptoms: TOP_SYMPTOMS, labValues: LAB_VALUES_SHOWN, treatments: treatments.length, questions: qs.length },
    enough: logged > 0 || labRows.length > 0 || treatments.length > 0,
    files: { pdf: `solia-health-summary-${today}.pdf` },
  };
}

/** What page 1 shows under `model.limits`: the visible rows and the "+N more" lines. */
export function pageOne(model) {
  const L = model.limits;
  const ap = model.appendix;
  const sym = model.symptoms.rows.slice(0, L.symptoms);
  const labs = model.labs.map((t) => ({ ...t, shown: t.values.slice(0, L.labValues), more: moreLine(t.values.length - Math.min(t.values.length, L.labValues), ap) }));
  return {
    symptoms: sym, symMore: moreLine(model.symptoms.rows.length - sym.length, ap),
    labs,
    treatments: model.treatments.slice(0, L.treatments), treatMore: moreLine(model.treatments.length - Math.min(model.treatments.length, L.treatments), ap),
    questions: model.questions.slice(0, L.questions), qMore: moreLine(model.questions.length - Math.min(model.questions.length, L.questions), ap),
  };
}

/** Every string page 1 (and the summary's own appendix pages) can print, for the wording and "?" checks. */
export function summaryTexts(model) {
  if (!model) return [];
  const p = pageOne(model);
  return [model.header.title, model.header.name, model.header.period, model.header.stage, model.header.made,
    model.cycles.line, model.cycles.currentLine, ...model.cycles.strip.map((c) => String(c.len)),
    ...model.symptoms.rows.flatMap((r) => [r.label, r.cluster]), p.symMore,
    ...model.treatments.flatMap((t) => [t.name, t.kind, t.startLine, t.line]), p.treatMore, TREAT_NOTE,
    ...model.labs.flatMap((t) => [t.label, ...t.values.map((v) => v.cell)]), LABS_NOTE, LABS_NOTE_ALL,
    model.daily.sleep, model.daily.move, model.daily.mood, ...model.questions, p.qMore,
    summaryFooter(1, 1, model.today)].filter((x) => typeof x === "string" && x);
}

/* ---------- PDF layout ---------- */
// Greys for chrome; one accent (her stage colour, AA on white) for section labels, the strip and the bars. Every mark
// that uses the accent also has words or numbers beside it, so the page reads the same printed in greyscale.
const INK = [28, 28, 30], SOFT = [88, 88, 92], HAIR = [200, 200, 204], FAINT = [236, 236, 238];
const M = 46; // generous margins (points)
const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "")); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
/** Contrast of an [r,g,b] against white. */
export const onWhite = (rgb) => 1.05 / (lum(rgb) + 0.05);
/** The accent for the page: her stage colour, darkened step by step until it reaches 4.5:1 on white. */
export function pdfAccent(hex) {
  let c = hexRgb(hex) || [74, 93, 176];
  for (let i = 0; i < 40 && onWhite(c) < 4.5; i++) c = c.map((v) => Math.round(v * 0.92));
  return c;
}
const css = (c) => `rgb(${c.join(", ")})`;
/** The PDF's colours as CSS custom properties for the in-app preview sheet (components/ClinicianPreview.jsx), so the
    preview is the same light page in every style and scheme. `accent` is pdfAccent()'s [r, g, b]. */
export const sheetVars = (accent) => ({
  "--cs-paper": css([255, 255, 255]), "--cs-ink": css(INK), "--cs-soft": css(SOFT), "--cs-hair": css(HAIR), "--cs-faint": css(FAINT),
  "--cs-acc": css(accent), "--cs-tint": css(tint(accent, 0.16)),
});
const tint = (rgb, k) => rgb.map((v) => Math.round(255 - (255 - v) * k)); // k of the colour over white

/** Draws page 1 into `doc` (a fresh PdfDoc). Returns { y, overflow } — overflow when it needed more than one page. */
function drawPageOne(doc, model, accent) {
  const p = pageOne(model);
  const X = M, W = doc.W - 2 * M, B = doc.bottom;
  let y = M + 2;
  let over = false;
  const room = (need) => { if (y + need > B) over = true; };
  const label = (t) => {
    y += 12; room(30);
    doc.text(X, y, t.toUpperCase(), { size: 7.6, bold: true, rgb: accent, spacing: 0.9 });
    doc.line(X, y + 4, X + W, y + 4, { rgb: HAIR, width: 0.5 });
    y += 15;
  };
  const para = (t, o = {}) => { if (!t) return; y = doc.wrap(X + (o.indent || 0), y, W - (o.indent || 0), t, { size: o.size || 8.6, rgb: o.rgb || INK, bold: !!o.bold, gap: 1.3 }); room(0); };

  // Header
  doc.text(X, y + 8, model.header.title, { size: 15, bold: true, rgb: INK });
  if (model.header.name) doc.text(X + W, y + 8, model.header.name, { size: 11, bold: true, rgb: INK, align: "right" });
  y += 24;
  doc.text(X, y, `${model.header.period}  ·  ${model.header.stage}`, { size: 8.8, rgb: INK });
  y += 12;
  doc.text(X, y, model.header.made, { size: 8, rgb: SOFT });
  y += 6;
  doc.line(X, y, X + W, y, { rgb: accent, width: 1.2 });
  y += 2;

  // Cycles
  if (model.cycles.shown) {
    label("Cycles");
    const strip = model.cycles.strip;
    if (strip.length) {
      const cw = 52, ch = 30;
      strip.forEach((c, i) => {
        const cx = X + i * (cw + 6);
        doc.rect(cx, y, cw, ch, { fill: c.long ? tint(accent, 0.16) : null, stroke: c.long ? accent : HAIR, width: c.long ? 0.9 : 0.5 });
        doc.text(cx + cw / 2, y + 14, `${c.len}`, { size: 12, bold: true, align: "center", rgb: INK });
        doc.text(cx + cw / 2, y + 24.5, c.excluded ? "excluded" : c.long ? `over ${LONG_CYCLE} d` : "days", { size: 6.4, align: "center", rgb: SOFT });
      });
      const rx = X + strip.length * (cw + 6) + 6;
      if (model.cycles.current != null) {
        doc.text(rx, y + 11, "Current cycle", { size: 7, rgb: SOFT });
        doc.text(rx, y + 25, `day ${model.cycles.current}`, { size: 12, bold: true, rgb: accent });
      }
      y += ch + 12;
      doc.text(X, y - 2, "Oldest to newest, last complete cycles.", { size: 6.8, rgb: SOFT });
      y += 9;
    } else if (model.cycles.currentLine) { para(model.cycles.currentLine); }
    para(model.cycles.line);
  } else { label("Cycles"); para(model.cycles.line, { rgb: SOFT }); }

  // Top symptoms
  label(`Top symptoms · days, of ${model.symptoms.logged} logged`);
  if (!p.symptoms.length) para("No symptoms logged in this period.", { rgb: SOFT });
  else {
    const n = Math.max(1, model.symptoms.logged);
    const c1 = 132, bw = 92, c3 = X + c1 + bw + 46;
    for (const r of p.symptoms) {
      room(12);
      doc.text(X, y, r.label, { size: 8.6, rgb: INK });
      doc.rect(X + c1, y - 6.2, bw, 6, { fill: FAINT });
      doc.rect(X + c1, y - 6.2, Math.max(1, (bw * r.days) / n), 6, { fill: accent });
      doc.text(X + c1 + bw + 34, y, String(r.days), { size: 8.6, bold: true, align: "right", rgb: INK });
      if (r.cluster) doc.text(c3, y, r.cluster, { size: 8, rgb: SOFT });
      y += 12.5;
    }
    if (p.symMore) para(p.symMore, { size: 7.4, rgb: SOFT });
  }

  // Treatments
  label("What she is trying · before and since starting");
  if (!p.treatments.length) para(NO_TREAT, { rgb: SOFT });
  else {
    for (const t of p.treatments) {
      room(22);
      doc.text(X, y, t.name, { size: 8.8, bold: true, rgb: INK });
      doc.text(X + W, y, `${t.kind} · ${t.startLine}`, { size: 8, align: "right", rgb: SOFT });
      y += 11;
      para(t.line, { indent: 10, rgb: t.compares.length ? INK : SOFT, size: 8.2 });
      y += 1;
    }
    if (p.treatMore) para(p.treatMore, { size: 7.4, rgb: SOFT });
    para(TREAT_NOTE, { size: 7.2, rgb: SOFT });
  }

  // Labs
  label("Lab values over time");
  if (!p.labs.length) para(NO_LABS, { rgb: SOFT });
  else {
    const c1 = 104, sw = 40, c2 = c1 + sw + 14;
    for (const t of p.labs) {
      room(13);
      doc.text(X, y, t.label, { size: 8.6, bold: true, rgb: INK });
      const vals = t.shown.map((v) => v.cell).join("   ") + (t.more ? `   ${t.more}` : "");
      const endY = doc.wrap(X + c2, y, W - c2, vals, { size: 8.2, rgb: INK, gap: 1.3 });
      if (t.trend) {
        const lo = Math.min(...t.trend), hi = Math.max(...t.trend), sx = X + c1, top = y - 7, h = 8;
        const pts = t.trend.map((v, i) => [sx + (i * sw) / (t.trend.length - 1), top + h - (hi === lo ? h / 2 : ((v - lo) / (hi - lo)) * h)]);
        doc.poly(pts, { rgb: accent, width: 1 });
        const last = pts[pts.length - 1];
        doc.dot(last[0], last[1], 1.6, { rgb: accent });
      }
      y = Math.max(y + 12.5, endY);
    }
    para(LABS_NOTE, { size: 7.2, rgb: SOFT });
  }

  // Sleep, movement, mood
  label("Sleep · movement · mood");
  for (const [k, v] of [["Sleep", model.daily.sleep], ["Movement", model.daily.move], ["Mood", model.daily.mood]]) {
    room(12);
    doc.text(X, y, k, { size: 8.6, bold: true, rgb: INK });
    y = doc.wrap(X + 64, y, W - 64, v, { size: 8.4, rgb: INK, gap: 1.3 });
  }

  // Questions
  label("Questions for my visit");
  if (!p.questions.length) para(NO_QUESTIONS, { rgb: SOFT });
  else {
    p.questions.forEach((q, i) => {
      room(12);
      doc.text(X, y, `${i + 1}.`, { size: 8.8, bold: true, rgb: accent });
      y = doc.wrap(X + 14, y, W - 14, q, { size: 8.8, rgb: INK, gap: 1.3 });
    });
    if (p.qMore) para(p.qMore, { size: 7.4, rgb: SOFT });
  }
  return { y, overflow: over || doc.pages.length > 1 };
}

/** Trims page 1's lists, step by step, until a dry run fits one page. Returns a new model with `limits` set. The steps
    (lab values per test, symptoms, treatments, questions) are the one-page fit heuristic; the "+N more" lines say what
    went to the detailed pages. */
export function fitSummary(model, PdfDoc, accentHex = null) {
  const steps = [
    (l) => (l.labValues > 3 ? { ...l, labValues: 3 } : null),
    (l) => (l.questions > 6 ? { ...l, questions: 6 } : null),
    (l) => (l.symptoms > 5 ? { ...l, symptoms: 5 } : null),
    (l) => (l.treatments > 3 ? { ...l, treatments: 3 } : null),
    (l) => (l.labValues > 2 ? { ...l, labValues: 2 } : null),
    (l) => (l.symptoms > 4 ? { ...l, symptoms: 4 } : null),
    (l) => (l.questions > 4 ? { ...l, questions: 4 } : null),
    (l) => (l.treatments > 2 ? { ...l, treatments: 2 } : null),
    (l) => (l.questions > 3 ? { ...l, questions: 3 } : null),
    (l) => (l.symptoms > 3 ? { ...l, symptoms: 3 } : null),
    (l) => (l.labValues > 1 ? { ...l, labValues: 1 } : null),
    (l) => (l.treatments > 1 ? { ...l, treatments: 1 } : null),
    (l) => (l.questions > 2 ? { ...l, questions: 2 } : null),
  ];
  const accent = pdfAccent(accentHex);
  let m = { ...model, limits: { ...model.limits } };
  const fits = (mm) => { const d = new PdfDoc({ paper: mm.paper, margin: M, bottom: 40 }); d.page(); return !drawPageOne(d, mm, accent).overflow; };
  for (const step of steps) {
    if (fits(m)) return { ...m, fitted: true };
    const next = step(m.limits);
    if (next) m = { ...m, limits: next };
  }
  return { ...m, fitted: fits(m) };
}

/* The summary's own appendix pages: the full lists page 1 trimmed or summarised. */
function drawFullLists(doc, model, accent) {
  const X = M, W = doc.W - 2 * M;
  let y = doc.top + 4;
  const head = (t) => { y = doc.ensure(y + 8, 50); doc.text(X, y, t.toUpperCase(), { size: 7.6, bold: true, rgb: accent, spacing: 0.9 }); doc.line(X, y + 4, X + W, y + 4, { rgb: HAIR, width: 0.5 }); y += 16; };
  doc.text(X, y + 6, "Detailed pages", { size: 13, bold: true, rgb: INK });
  y += 22;
  y = doc.wrap(X, y, W, `The full lists behind page 1 (${model.header.period}), then the 30-day tables.`, { size: 8.6, rgb: SOFT });
  if (model.symptoms.rows.length) {
    head(`Every symptom logged · days of ${model.symptoms.logged} logged`);
    y = doc.table(X, y, [{ label: "Symptom", w: W * 0.34 }, { label: "Days", w: W * 0.12 }, { label: "Moderate or strong", w: W * 0.18 }, { label: "When in the cycle", w: W * 0.36 }],
      model.symptoms.rows.map((r) => [r.label, String(r.days), String(r.strong), r.cluster || "–"]), { size: 8.2 }) + 6;
  }
  if (model.treatments.length) {
    head("What she is trying · before and since starting");
    y = doc.table(X, y, [{ label: "Item", w: W * 0.24 }, { label: "Kind and start", w: W * 0.24 }, { label: "In her log", w: W * 0.52 }],
      model.treatments.map((t) => [t.name, `${t.kind}, ${t.startLine}`, t.line]), { size: 8.2 }) + 11;
    y = doc.wrap(X, y, W, TREAT_NOTE, { size: 7.4, rgb: SOFT });
  }
  if (model.labs.length) {
    head("Every lab value she typed");
    y = doc.table(X, y, [{ label: "Test", w: W * 0.3 }, { label: "Date", w: W * 0.3 }, { label: "Value as typed", w: W * 0.4 }],
      model.labs.flatMap((t) => t.values.map((v) => [t.label, fmtDayY(v.date), v.text])), { size: 8.2 }) + 11;
    y = doc.wrap(X, y, W, LABS_NOTE_ALL, { size: 7.4, rgb: SOFT });
  }
  if (model.questions.length > pageOne(model).questions.length) {
    head("Questions for my visit (all)");
    model.questions.forEach((q, i) => { y = doc.ensure(y, 14); doc.text(X, y, `${i + 1}.`, { size: 8.8, bold: true }); y = doc.wrap(X + 14, y, W - 14, q, { size: 8.8 }); });
  }
  return y;
}

export const AI_HEAD = "Solia Health's AI write-up";
export const aiLine = (day) => `Written by the AI from the counts she chose to send${day ? ` on ${fmtDayY(day)}` : ""}. Not a diagnosis; not reviewed by a clinician.`;

/**
 * The file: page 1 always; with appendix, the full lists, the L9 detailed pages (`visit`, a visitModel built with the
 * same name / notes / meal-notes choices) and, when passed, her saved AI write-up ({ writeup, day }). -> Uint8Array.
 */
export function summaryPdf({ summary, visit = null, ai = null, accentHex = null }, PdfDoc) {
  const accent = pdfAccent(accentHex);
  const fitted = summary.fitted ? summary : fitSummary(summary, PdfDoc, accentHex);
  const doc = new PdfDoc({ paper: fitted.paper, margin: M, bottom: 40 });
  doc.page();
  drawPageOne(doc, fitted, accent);
  if (fitted.appendix) {
    doc.page();
    drawFullLists(doc, fitted, accent);
    if (visit) { doc.page(); drawVisitBody(doc, visit); }
    if (ai && typeof ai.writeup === "string" && ai.writeup.trim()) {
      doc.page();
      let y = doc.top + 4;
      doc.text(M, y, AI_HEAD.toUpperCase(), { size: 7.6, bold: true, rgb: accent, spacing: 0.9 });
      doc.line(M, y + 4, doc.W - M, y + 4, { rgb: HAIR, width: 0.5 });
      y = doc.wrap(M, y + 18, doc.W - 2 * M, aiLine(ai.day), { size: 7.8, rgb: SOFT });
      y = doc.wrap(M, y + 4, doc.W - 2 * M, ai.writeup, { size: 9, rgb: INK, gap: 1.4 });
    }
  }
  doc.footer((n, m, d) => {
    d.line(M, d.H - 30, d.W - M, d.H - 30, { rgb: HAIR, width: 0.4 });
    d.text(M, d.H - 20, PATIENT_DATA, { size: 7, rgb: SOFT });
    d.text(d.W / 2, d.H - 20, `Page ${n} of ${m}`, { size: 7, align: "center", rgb: SOFT });
    d.text(d.W - M, d.H - 20, `Generated ${fmtDayY(fitted.today)}`, { size: 7, align: "right", rgb: SOFT });
  });
  return doc.bytes();
}
