/* The appointment PDF (local-first L9, owner brief item 5, decision D1): one model, two outputs.
   visitModel() builds the model; visitPdf() draws it with the PdfDoc writer the caller passes in
   (lib/pdf.js, statically bundled by the Report screen), and the Report screen itself renders
   the same model as the accessible version of the file ("The numbers behind this"). Pure: no
   React, no storage, no network, and no Date.now — the same input gives the same bytes.

   What goes in, and what never does:
   - Inputs are her day entries, the engine's insights (App's own insights(days, ids), so every
     number equals the screen's), her tracked symptom ids (so day scores equal the calendar's),
     the life stage and its label, today's date, her first name (only when she gave one and is
     not anonymous), the Report's picked questions, her cycle flags (L5) and, for Trying to
     conceive with signs on, L7's fertility sentences.
   - Never an input, so never in the file: registration answers, wearable rows, the journal, the
     Connect log, appointments, POTS data. visitModel ignores anything else it is given
     (unit-tested: extra keys give byte-identical bytes).
   - Day notes (L6, entry.note) go in only with includeNotes === true; the count of notes in the
     window is reported either way so the screen can say what the tick would add.
   - Meal notes (optional, Meal notes on): a short "Meal notes" section only when the caller passes mealLines, which App does
     only while the switch is on and she ticks "Include meal notes" (lib/bodylog.js mealReportLines: counts in words, no foods).
   - Every character the PDF prints is WinAnsi (pdf.js winAnsi); the screen warns when a note
     or name would print as "?" (LOSSY_LINE) and shows the exact text itself.
   Nothing is diagnosed: every string is checked by the unit tests against banned wording, the
   header and footer say "observations, not a diagnosis", and the file name and /Title are
   neutral (cyra-summary-{date}.pdf, "Cyra report"). */
import { dayScore, isPeriodDay, isExcluded, cycleSummary, lensLabel, scoreRgb, addDays } from "./engine.js";
import { fmtDay, fmtDayY, fmtRange, tickAt } from "./potsReport.js";
import { RAMPS } from "./constants.js";
import { cyclesFrom } from "./record.js";
import { cleanNote } from "./daylog.js";
import { periodSummary } from "./insights.js";
import { FERT_COPY } from "./fertility.js";

/* ---------- fixed text ---------- */
export const VISIT_TITLE = "Cycle and symptom summary";
export const MADE_LINE = "Prepared by the user in Heard Health · observations, not a diagnosis";
export const footerText = (n, m) => `Page ${n} of ${m} · Heard Health · Observations, not a diagnosis.`;
// Same words as the POTS Report's WARNING, kept here so the Report screen never imports a POTS component.
export const FILE_WARNING = "This file isn't locked. Anyone who gets it can read it. Send it straight to your clinician or their patient portal, and avoid group chats or shared folders.";
export const GATE_EMPTY = "Log a day first. The PDF is made from your check-ins.";
export const LOSSY_LINE = "Some characters in your notes or name can't be shown in the PDF and will appear as '?' or be left out. This page shows them exactly.";
export const SAME_NUMBERS = 'The same numbers are on this page; the tables are under "The numbers behind this".';
/** Shown only if plan.js ever sets a monthly limit (none in the shipping plan). Never an upgrade prompt. */
export const limitLine = (limit, nextMonthIso) => `You've made this month's ${limit} PDFs. You can make another from ${fmtDayY(nextMonthIso)}. Print this page works any time.`;
/** The fertility caveat is L7's Patterns footer, so the PDF and Patterns say the same thing. */
export const FERTILITY_FOOT = FERT_COPY.sumFoot;
export const paperForLocale = (locale) => (/^en-(US|CA)\b/.test(locale || "") ? "letter" : "a4");

const andList = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
const dayWord = (n) => (n === 1 ? "day" : "days");
const WINDOW = 30, COMPARE_MIN = 10, MAX_ROWS = 8, MAX_CYCLES = 7, MAX_QUESTIONS = 3;

/* ---------- the model ---------- */
/** Recent cycles for the table: the last 7 period starts (up to 6 complete cycles plus the running one),
    oldest first, from record.js cyclesFrom (one cycle definition). */
function cycleHistory(days, ins, cycleFlags, today) {
  const all = cyclesFrom(days);
  const list = all.slice(-MAX_CYCLES);
  const rows = list.map((c) => {
    const ongoing = c.next == null;
    const ongoingDay = ongoing ? Math.max(1, Math.round((new Date(`${today}T12:00:00`) - new Date(`${c.start}T12:00:00`)) / 86400000) + 1) : null;
    const excluded = !ongoing && c.counted && isExcluded(c.start, cycleFlags || {});
    const notes = [];
    if (excluded) notes.push("Left out of predictions");
    if (!ongoing && !c.counted) notes.push(`Not counted as a cycle: ${c.length < 15 ? "under 15 days" : "over 120 days"}`);
    return {
      start: c.start, length: ongoing ? null : c.length, ongoingDay, periodDays: c.periodDays, excluded,
      cells: [fmtDayY(c.start), ongoing ? `day ${ongoingDay} so far` : `${c.length} days`, String(c.periodDays), notes.join("; ")],
    };
  });
  // The spread sentence is exactly the Report footer's, from cycleSummary's lens6 (every counted cycle, D5).
  const summary = cycleSummary(ins, cycleFlags || {}, today);
  const lens6 = summary.lens6;
  let spreadLine = null;
  if (ins.variability != null && lens6.length >= 2) {
    spreadLine = `Cycle lengths: ${lens6.map(lensLabel).join(", ")} days (${ins.variability}-day spread).`;
    if (lens6.some((l) => l.excluded)) spreadLine += " Every cycle is counted here, including any she left out of predictions.";
  } else if (lens6.length === 1) spreadLine = `One complete cycle: ${lens6[0].len} days.`;
  return { rows, spreadLine, empty: rows.length ? null : "No period start logged in Heard Health.", head: ["Start", "Length", "Period days logged", "Note"] };
}

/**
 * The appointment PDF's model (also what the Report screen shows under "The numbers behind this").
 * ins: App's insights(days, ids). ids: App's tracked symptom ids. scale: SCORE_SCALE[stage] (L6), so
 * day scores equal the calendar's. fertilityLines: L7's sentences, or null when signs are not on for her.
 */
export function visitModel({ days = [], ins, ids = [], stage, stageName = "", name = "", today, questions = [], includeNotes = false, cycleFlags = {}, fertilityLines = null, mealLines = null, paper = "a4", scale = ids.length || 1 } = {}) {
  const from = addDays(today, -(WINDOW - 1)), to = today;
  const pfrom = addDays(today, -(2 * WINDOW - 1)), pto = addDays(from, -1);
  const sorted = ins.sorted || [];
  const n = ins.last30.length;
  const prev = sorted.filter((d) => d.date >= pfrom && d.date <= pto);
  const prevN = prev.length, prevOk = prevN >= COMPARE_MIN;
  const cleanName = String(name || "").trim().slice(0, 60);

  const cycles = cycleHistory(days, ins, cycleFlags, today);

  // Symptoms, last 30 days: engine order (most days first), with the 30 days before as the comparison.
  const prevDays = Object.fromEntries(ins.counts.map((c) => [c.id, prev.filter((d) => (d.sym?.[c.id] || 0) > 0).length]));
  const logged = ins.counts.filter((c) => c.days > 0);
  const symRows = logged.slice(0, MAX_ROWS).map((c) => {
    const p = prevOk ? prevDays[c.id] : null;
    const d = p == null ? null : c.days - p;
    const change = d == null ? null : d === 0 ? "same" : d > 0 ? `${d} more` : `${-d} fewer`;
    return { id: c.id, label: c.label, days: c.days, strong: c.strong, prev: p, change, cells: [c.label, String(c.days), String(c.strong), ...(prevOk ? [String(p), change] : [])] };
  });
  const rest = logged.slice(MAX_ROWS);
  const symptoms = {
    rows: symRows, prevDays, prevN, prevOk,
    head: ["Symptom", `Days (of ${n} logged)`, "Moderate or strong", ...(prevOk ? [`30 days before (of ${prevN} logged)`, "Change"] : [])],
    lead: "Days each symptom was logged, most frequent first.",
    more: rest.length ? `Also logged: ${rest.map((r) => `${r.label} (${r.days} ${dayWord(r.days)})`).join(", ")}.` : null,
    noCompare: !prevOk && n > 0 ? `No comparison with the 30 days before (${fmtRange(pfrom, pto)}): ${prevN} ${prevN === 1 ? "day was" : "days were"} logged then, and Heard Health compares only with 10 or more.` : null,
    none: n === 0 ? "Nothing logged in these 30 days." : symRows.length === 0 ? "No symptoms logged in these 30 days." : null,
  };

  // Day score, last 30 days: the averages come from L8's periodSummary, so the PDF matches Patterns.
  const by = new Map(sorted.filter((d) => d.date >= from && d.date <= to).map((d) => [d.date, d]));
  const points = Array.from({ length: WINDOW }, (_, i) => {
    const iso = addDays(from, i), e = by.get(iso) || null;
    return { iso, score: e ? Math.round(dayScore(e, ids, scale) * 100) : null, period: isPeriodDay(e) };
  });
  const ps = periodSummary(sorted, ids, null, today, WINDOW, scale);
  const loggedPts = points.filter((p) => p.score != null);
  let low = null, high = null;
  for (const p of loggedPts) { if (!low || p.score < low.score) low = p; if (!high || p.score > high.score) high = p; }
  const count = ps.logged, avg = ps.score;
  const prevAvg = prevOk ? ps.prevScore : null, prevCount = prevOk ? ps.prevLogged : null;
  const sentence = count === 0 ? "No days logged in these 30 days."
    : `Average ${avg} over ${count} logged ${dayWord(count)}${count >= 2 ? `; lowest ${low.score} on ${fmtDay(low.iso)}, highest ${high.score} on ${fmtDay(high.iso)}` : ""}.${prevOk ? ` The 30 days before: average ${prevAvg} over ${prevCount} logged days.` : ""}`;
  const trend = {
    points, count, avg, low, high, prevAvg, prevCount, sentence,
    caption: "Each dot is a day she logged: Heard Health's 0–100 day score from her symptom severities and her fatigue, pain and mood ratings. Higher is a better day. Dashed line: 30-day average. Grey bars: period days. Gaps: days not logged.",
  };

  const fertility = Array.isArray(fertilityLines) && fertilityLines.length ? fertilityLines.map(String) : null;
  const meals = Array.isArray(mealLines) && mealLines.length ? mealLines.map(String) : null;
  const qs = (Array.isArray(questions) ? questions : []).map((q) => String(q ?? "").trim()).filter(Boolean).slice(0, MAX_QUESTIONS);
  const allNotes = sorted.filter((d) => d.date >= from && d.date <= to).map((d) => ({ iso: d.date, text: cleanNote(d.note) })).filter((x) => x.text);
  const notes = includeNotes === true ? allNotes : [];

  const parts = [];
  if (cycles.rows.length) parts.push("your recent cycles");
  if (symRows.length) parts.push(`your top symptoms${prevOk ? " against the month before" : ""}`);
  if (count > 0) parts.push("a 30-day day-score chart");
  if (fertility) parts.push("your fertility signs");
  if (meals) parts.push("your meal notes as counts");
  if (qs.length) parts.push(qs.length === 1 ? "the question you added" : `the ${qs.length} questions you added`);
  if (notes.length) parts.push(`${notes.length} day ${notes.length === 1 ? "note" : "notes"}`);

  return {
    paper, today, from, to, n,
    header: {
      title: (cycles.rows.length ? VISIT_TITLE : "Symptom summary") + (cleanName ? ` · ${cleanName}` : ""),
      line: `${stageName} · ${fmtRange(from, today)} · ${n} of the last 30 days logged`,
      made: MADE_LINE,
    },
    stage, cycles, symptoms, trend, fertility, fertilityFoot: fertility ? FERTILITY_FOOT : null, ...(meals ? { meals } : {}), questions: qs, notes, notesInWindow: allNotes.length,
    contents: parts.length ? `In it: ${andList(parts)}.` : "",
    top: `At the top: ${cleanName ? "your name, " : ""}your life stage and the dates it covers.`,
    enough: n > 0 || cycles.rows.length > 0,
    files: { pdf: `heard-health-summary-${today}.pdf` },
  };
}

/** Every string the PDF can print (for the wording tests and the "can't be shown in the PDF" check). */
export function visitTexts(model) {
  if (!model) return [];
  const out = [model.header.title, model.header.line, model.header.made, "Recent cycles", "Symptoms, last 30 days", "Day score, last 30 days", "Fertility signs", "Questions I'd like to cover", "My day notes",
    model.cycles.spreadLine, model.cycles.empty, ...model.cycles.head, ...model.cycles.rows.flatMap((r) => r.cells),
    model.symptoms.lead, model.symptoms.more, model.symptoms.noCompare, model.symptoms.none, ...model.symptoms.head, ...model.symptoms.rows.flatMap((r) => r.cells),
    model.trend.sentence, model.trend.caption, ...(model.fertility || []), model.fertilityFoot, ...(model.meals ? ["Meal notes", ...model.meals] : []), ...model.questions, ...model.notes.flatMap((x) => [fmtDay(x.iso), x.text]), model.contents, model.top, footerText(1, 1)];
  return out.filter((x) => typeof x === "string" && x);
}

/* ---------- PDF layout ---------- */
// Chrome is greys only; data colour comes from the light ramp of her stage (the file prints on white, D9).
const INK = [34, 34, 34], SOFT = [95, 95, 95], RULE = [170, 170, 170], GRID = [225, 225, 225], PERIOD = [150, 150, 150];

function drawScoreChart(doc, x, y, w, h, trend, ramp) {
  const L = x + 30, R = x + w - 30, T = y + 8, B = y + h - 26;
  const step = (R - L) / (WINDOW - 1);
  const px = (i) => L + i * step, py = (v) => B - (v / 100) * (B - T);
  for (const v of [0, 50, 100]) {
    doc.line(L, py(v), R, py(v), { rgb: v === 0 ? RULE : GRID, width: v === 0 ? 0.6 : 0.4 });
    doc.text(L - 4, py(v) + 2.3, String(v), { size: 6.5, align: "right", rgb: SOFT });
  }
  trend.points.forEach((p, i) => { if (p.period) doc.rect(px(i) - 0.4 * step, B + 3, 0.8 * step, 3.5, { fill: PERIOD }); });
  if (trend.avg != null) {
    doc.line(L, py(trend.avg), R, py(trend.avg), { dash: [3, 2], rgb: INK, width: 0.6 });
    doc.text(R + 3, py(trend.avg) + 2.3, `avg ${trend.avg}`, { size: 6.5, rgb: SOFT });
  }
  let run = [];
  const flush = () => { if (run.length >= 2) doc.poly(run, { rgb: SOFT, width: 0.9 }); run = []; };
  trend.points.forEach((p, i) => { if (p.score == null) flush(); else run.push([px(i), py(p.score)]); });
  flush();
  trend.points.forEach((p, i) => {
    if (p.score == null) return;
    doc.dot(px(i), py(p.score), 2.6, { rgb: INK });
    doc.dot(px(i), py(p.score), 1.9, { rgb: scoreRgb(p.score / 100, ramp) });
  });
  const tick = tickAt(WINDOW, step, 34, 7);
  trend.points.forEach((p, i) => { if (tick(i)) doc.text(px(i), B + 15, fmtDay(p.iso), { size: 6, align: "center", rgb: SOFT }); });
}

/** The PDF for `model`, drawn with `PdfDoc` (lib/pdf.js, passed in by the caller). -> Uint8Array. */
export function visitPdf(model, PdfDoc) {
  const doc = new PdfDoc({ paper: model.paper });
  doc.page();
  const X = doc.margin, W = doc.W - 2 * doc.margin;
  const ramp = RAMPS[model.stage] || RAMPS.peri;
  let y = doc.top + 4;
  y = doc.wrap(X, y, W, model.header.title, { size: 14, bold: true, gap: 1.3 });
  y = doc.wrap(X, y, W, model.header.line, { size: 9.5 });
  y = doc.wrap(X, y, W, model.header.made, { size: 8, rgb: SOFT });
  let i = 0;
  const section = (title, need) => {
    i += 1;
    y = doc.ensure(y + 6, need);
    doc.line(X, y - 9, X + W, y - 9, { rgb: RULE, width: 0.5 });
    y = doc.wrap(X, y + 4, W, `${i}. ${title}`, { size: 11.5, bold: true });
  };
  const table = (head, widths, rows) => {
    y = doc.table(X, y, head.map((label, j) => ({ label, w: widths[j] * W })), rows, { size: 8.5 }) + 8;
  };

  // 1. Recent cycles
  section("Recent cycles", 60);
  if (model.cycles.rows.length) {
    if (model.cycles.spreadLine) y = doc.wrap(X, y, W, model.cycles.spreadLine, { size: 9 }) + 2;
    table(model.cycles.head, [0.26, 0.22, 0.18, 0.34], model.cycles.rows.map((r) => r.cells));
  } else y = doc.wrap(X, y, W, model.cycles.empty, { size: 9 });

  // 2. Symptoms
  const s = model.symptoms;
  section("Symptoms, last 30 days", 60);
  if (s.none) y = doc.wrap(X, y, W, s.none, { size: 9 });
  else {
    y = doc.wrap(X, y, W, s.lead, { size: 8.5, rgb: SOFT });
    table(s.head, s.prevOk ? [0.3, 0.18, 0.16, 0.2, 0.16] : [0.5, 0.26, 0.24], s.rows.map((r) => r.cells));
    if (s.more) y = doc.wrap(X, y, W, s.more, { size: 7.5, rgb: SOFT });
    if (s.noCompare) y = doc.wrap(X, y, W, s.noCompare, { size: 7.5, rgb: SOFT });
  }

  // 3. Day score
  section("Day score, last 30 days", 150);
  if (model.trend.count >= 2) {
    const h = 104;
    drawScoreChart(doc, X, y, W, h, model.trend, ramp);
    y += h + 4;
    y = doc.wrap(X, y, W, model.trend.caption, { size: 7.5, rgb: SOFT });
  }
  y = doc.wrap(X, y, W, model.trend.sentence, { size: 9 });

  // 4. Fertility signs (Trying to conceive only)
  if (model.fertility) {
    section("Fertility signs", 40);
    for (const line of model.fertility) y = doc.wrap(X, y, W, line, { size: 9 });
    y = doc.wrap(X, y + 1, W, model.fertilityFoot, { size: 7.5, rgb: SOFT });
  }

  // Meal notes (only with mealLines: Meal notes on and "Include meal notes" ticked)
  if (model.meals) {
    section("Meal notes", 40);
    for (const line of model.meals) y = doc.wrap(X, y, W, line, { size: 9 });
  }

  // Questions
  if (model.questions.length) {
    section("Questions I'd like to cover", 40);
    model.questions.forEach((q, k) => {
      y = doc.ensure(y, 24);
      doc.text(X, y, `${k + 1}.`, { size: 9, bold: true });
      y = doc.wrap(X + 14, y, W - 14, q, { size: 9 });
    });
  }

  // My day notes (only with includeNotes)
  if (model.notes.length) {
    section("My day notes", 50);
    table(["Date", "Note"], [0.14, 0.86], model.notes.map((x) => [fmtDay(x.iso), x.text]));
  }

  doc.footer((n, m, d) => d.text(d.W / 2, d.H - 24, footerText(n, m), { size: 7.5, align: "center", rgb: SOFT }));
  return doc.bytes();
}
