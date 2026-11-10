import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  summaryModel, fitSummary, summaryPdf, summaryTexts, pageOne, pdfAccent, onWhite, sheetVars, moreLine,
  cleanQuestions, addQuestion, removeQuestion, QUESTIONS_MAX, QUESTION_LEN, LONG_CYCLE, TOP_SYMPTOMS, NOT_ENOUGH, SUMMARY_TITLE, SUMMARY_MADE, CYCLE_ROWS_FIT, CYCLE_ROWS_MAX, TABLE_NOTE, SKIPPED_HEAD,
} from "./clinicianSummary.js";
import { cycleTable, skippedSummary, nightlyTemps } from "./signals.js";
import { syntheticLog } from "./signalsFixtures.js";
import { cyclesFrom } from "./record.js";
import { PdfDoc } from "./pdf.js";
import { addDays, insights } from "./engine.js";
import { ALL_SYM, SCORE_SCALE, PALETTES } from "./constants.js";
import { visitModel } from "./visitReport.js";
import { pdfLossy } from "./potsReport.js";

const SRC = dirname(fileURLToPath(import.meta.url));
const TODAY = "2026-11-02";
const latin1 = (b) => Buffer.from(b).toString("latin1");
const pages = (s) => (s.match(/\/Type \/Page\b/g) || []).length;

/* Period starts at the given offsets (days before TODAY), 4 period days each, every day logged from the first start.
   symAt(i, iso, cd) returns the day's sym object (cd = cycle day). */
function log(startsAgo, symAt = () => ({}), { gaps = () => false } = {}) {
  const starts = startsAgo.map((k) => addDays(TODAY, -k)).sort();
  const per = new Set(starts.flatMap((s) => [0, 1, 2, 3].map((k) => addDays(s, k))));
  const days = [];
  for (let i = Math.max(...startsAgo); i >= 0; i--) {
    const iso = addDays(TODAY, -i);
    if (gaps(i) && !per.has(iso)) continue;
    let s = null; for (const st of starts) if (st <= iso) s = st;
    const cd = s ? Math.round((Date.parse(iso) - Date.parse(s)) / 86400000) + 1 : null;
    const e = { date: iso, sym: symAt(i, iso, cd), sleepQ: i % 5 === 0 ? "poor" : "good" };
    if (per.has(iso)) { e.period = true; e.flow = "med"; }
    days.push(e);
  }
  return days;
}
const base = (over = {}) => summaryModel({ days: log([150, 108, 70, 31]), stage: "periods", stageName: "My Cycle", pcosOn: true, today: TODAY, ...over });

test("header: period, stage, PCOS, the not-a-diagnosis line, name only when passed", () => {
  const m = base();
  assert.equal(m.header.title, SUMMARY_TITLE);
  assert.equal(m.header.made, SUMMARY_MADE);
  assert.match(m.header.period, /^Aug 5 – Nov 2, 2026 · 90 days logged$/);
  assert.equal(m.header.stage, "My Cycle · PCOS module on");
  assert.equal(m.header.name, null);
  assert.equal(base({ name: "  Maya " }).header.name, "Maya");
  assert.equal(base({ pcosOn: false }).header.stage, "My Cycle · PCOS module off");
  assert.equal(summaryModel({ days: [], stage: "preg", stageName: "Pregnancy", today: TODAY }).header.stage, "Pregnancy");
  // A short log covers only the days since it started.
  const short = summaryModel({ days: log([13]), today: TODAY });
  assert.match(short.header.period, /^Oct 20 – Nov 2, 2026 · 14 days logged$/);
});

test("cycle strip: last six complete lengths, long ones and excluded ones marked, current day, average and range", () => {
  const ago = [300, 268, 238, 196, 166, 126, 98, 60, 20]; // lengths 32, 30, 42, 30, 40, 28, 38, 40; current day 21
  const m = summaryModel({ days: log(ago, () => ({}), { gaps: (i) => i % 3 === 1 }), today: TODAY, cycleFlags: { [addDays(TODAY, -98)]: { exclude: true } } });
  assert.deepEqual(m.cycles.strip.map((c) => c.len), [42, 30, 40, 28, 38, 40]);
  assert.deepEqual(m.cycles.strip.map((c) => c.long), [true, false, true, false, true, true]);
  assert.deepEqual(m.cycles.strip.map((c) => c.excluded), [false, false, false, false, true, false]);
  assert.equal(m.cycles.current, 21);
  assert.equal(m.cycles.average, 36); // (42+30+40+28+40)/5, the excluded one shown, not averaged
  assert.deepEqual(m.cycles.range, [28, 42]);
  assert.match(m.cycles.line, /Average 36 days, range 28–42, over 5 cycles\. 4 of 6 longer than 35 days\. 1 left out of predictions by her \(shown, not averaged\)\./);
  assert.equal(LONG_CYCLE, 35);
  assert.match(summaryModel({ days: log([40, 5]), today: TODAY }).cycles.line, /^One complete cycle in the average: 35 days\.$/);
  assert.equal(summaryModel({ days: log([5]), today: TODAY }).cycles.line, "No complete cycle logged yet.");
  const meno = summaryModel({ days: log([60, 20]), stage: "peri", stageName: "Menopause", today: TODAY });
  assert.equal(meno.cycles.shown, false);
});

test("symptom clustering: top six by days, the cycle-day bucket where they gather, or spread", () => {
  const days = log([150, 108, 70, 31], (i, iso, cd) => ({
    ...(cd != null && cd <= 5 ? { crm: 2 } : {}),            // cramps: only cycle days 1–5
    ...(i % 3 === 0 ? { hda: 1 } : {}),                         // headaches: every third day
    ...(cd >= 20 && cd <= 28 ? { blo: 1 } : {}),               // bloating: late cycle
    ...(i % 2 === 0 ? { eng: 1 } : {}), ...(i % 4 === 0 ? { acn: 1 } : {}), ...(i % 5 === 0 ? { cra: 1 } : {}), ...(i % 7 === 0 ? { mood: 1 } : {}),
  }));
  const m = summaryModel({ days, today: TODAY });
  const by = Object.fromEntries(m.symptoms.rows.map((r) => [r.id, r]));
  assert.match(by.crm.cluster, /^mostly cycle days 1–5 \(\d+ of \d+\)$/);
  assert.match(by.blo.cluster, /^mostly cycle days 20–28/);
  assert.equal(by.eng.cluster, "spread across the cycle");
  const days2 = m.symptoms.rows.map((r) => r.days);
  assert.deepEqual(days2, [...days2].sort((a, b) => b - a), "most days first");
  const p = pageOne(m);
  assert.equal(p.symptoms.length, TOP_SYMPTOMS);
  assert.equal(p.symMore, `+${m.symptoms.rows.length - 6} more not shown`);
  assert.equal(pageOne({ ...m, appendix: true }).symMore, `+${m.symptoms.rows.length - 6} more in the detailed pages`);
  // No cycles in the stage → no bucket.
  const peri = summaryModel({ days, stage: "peri", stageName: "Menopause", today: TODAY });
  assert.ok(peri.symptoms.rows.every((r) => r.cluster === null));
});

test("treatment before / since: cycle length and top-symptom days, else 'Not enough days to compare'", () => {
  // Cycles 40, 40 before; 30, 30 since a start 70 days ago; bloating on most days before, few since.
  const startAgo = 70;
  const days = log([150, 110, 70, 40, 10], (i) => (i > startAgo ? (i % 4 ? { blo: 1 } : {}) : (i % 4 === 0 ? { blo: 1 } : {})));
  const meds = [{ id: 1, name: "Metformin", kind: "rx", started: addDays(TODAY, -startAgo) }, { id: 2, name: "Inositol", kind: "supp", started: addDays(TODAY, 3) }, { id: 3, name: "Walks", kind: "habit", started: TODAY }];
  const m = summaryModel({ days, meds, today: TODAY });
  const met = m.treatments.find((t) => t.name === "Metformin");
  assert.equal(met.kind, "Prescription");
  assert.equal(met.startLine, `since Aug 24, 2026`);
  assert.deepEqual(met.compares[0], { what: "Cycle length", before: "40 d avg (1 cycle)", since: "30 d avg (2 cycles)" });
  assert.equal(met.compares[1].what, "Bloating days");
  assert.match(met.compares[1].before, /^\d+ of 71 logged$/);
  assert.match(met.line, /^Cycle length: before 40 d avg \(1 cycle\); since 30 d avg \(2 cycles\)\. Bloating days: before \d+ of 71 logged; since \d+ of 71 logged\.$/);
  for (const t of m.treatments.filter((x) => x.name !== "Metformin")) assert.equal(t.line, `${NOT_ENOUGH}.`);
  assert.equal(m.treatments.find((t) => t.name === "Walks").kind, "Habit");
  // Words only: never says it works.
  for (const t of summaryTexts(m)) assert.ok(!/\bwork(s|ed|ing)?\b|\beffective\b|\bimprov/i.test(t), t);
});

test("labs: grouped by test, newest first, values exactly as typed, a trend only with two or more", () => {
  const labs = [
    { id: "a", kind: "hba1c", value: 5.9, unit: "%", date: "2026-05-14" }, { id: "b", kind: "hba1c", value: 5.7, unit: "%", date: "2026-08-20" },
    { id: "c", kind: "hba1c", value: 5.6, unit: "%", date: "2026-10-28" }, { id: "d", kind: "fglu", value: 104, unit: "mg/dL", date: "2025-12-01" },
    { id: "e", kind: "waist", value: 86, unit: "cm", date: "2026-10-01" }, { id: "f", kind: "hba1c", value: 5.5, unit: "%", date: "2026-01-02" }, { id: "g", kind: "hba1c", value: 5.8, unit: "%", date: "2026-03-02" },
  ];
  const m = base({ labs });
  assert.deepEqual(m.labs.map((t) => t.label), ["Fasting glucose", "HbA1c", "Waist measure"]);
  const h = m.labs[1];
  assert.deepEqual(h.values.map((v) => v.date), ["2026-10-28", "2026-08-20", "2026-05-14", "2026-03-02", "2026-01-02"]);
  assert.deepEqual(h.values.map((v) => v.text), ["5.6%", "5.7%", "5.9%", "5.8%", "5.5%"]);
  assert.deepEqual(h.trend, [5.5, 5.8, 5.9, 5.7, 5.6], "oldest to newest");
  assert.equal(m.labs[0].trend, null);
  assert.equal(m.labs[0].values[0].cell, "104 mg/dL (Dec 1, 2025)");
  const p = pageOne(m);
  assert.equal(p.labs[1].shown.length, 4);
  assert.equal(p.labs[1].more, "+1 more not shown");
  for (const t of summaryTexts(m)) assert.ok(!/\b(normal|high|low|elevated|range:|reference interval|pre-?diabet|diabet)/i.test(t.replace("no reference ranges", "").replace("low or very low", "")), t);
});

test("questions: at most 8 of 200 characters, tidy, no repeats; picked suggestions after hers", () => {
  assert.deepEqual(cleanQuestions(null), []);
  assert.deepEqual(cleanQuestions(["  a\n b ", "", 3, "a b", "c"]), ["a b", "c"]);
  const long = "x".repeat(250);
  assert.equal(cleanQuestions([long])[0].length, QUESTION_LEN);
  assert.equal(cleanQuestions(Array.from({ length: 12 }, (_, i) => `q${i}`)).length, QUESTIONS_MAX);
  let list = [];
  for (let i = 0; i < 8; i++) list = addQuestion(list, `Question ${i}`).list;
  assert.deepEqual(addQuestion(list, "one more"), { ok: false, list, why: "full" });
  assert.equal(addQuestion([], "  ").why, "empty");
  assert.equal(addQuestion(["Same"], "Same").why, "same");
  assert.deepEqual(removeQuestion(["a", "b", "c"], 1), ["a", "c"]);
  const m = base({ questions: ["Mine?"], picked: ["Picked?", "Mine?"] });
  assert.deepEqual(m.questions, ["Mine?", "Picked?"]);
});

test("one-page fit: a heavy log is trimmed to one page on Letter and A4, with '+N more' lines", () => {
  const syms = Object.keys(ALL_SYM);
  const days = log([150, 108, 70, 31], (i) => Object.fromEntries(syms.filter((_, j) => (i + j) % 3).map((id) => [id, 1])));
  const meds = Array.from({ length: 7 }, (_, k) => ({ id: k, name: `A rather long supplement name number ${k}`, kind: "supp", started: addDays(TODAY, -10 * k - 5) }));
  const labs = ["fglu", "hba1c", "waist"].flatMap((kind) => Array.from({ length: 8 }, (_, k) => ({ id: `${kind}${k}`, kind, value: kind === "fglu" ? 90 + k : kind === "hba1c" ? 5.1 + k / 10 : 80 + k, unit: kind === "fglu" ? "mg/dL" : kind === "hba1c" ? "%" : "cm", date: addDays(TODAY, -30 * k) })));
  const questions = Array.from({ length: 8 }, (_, k) => `${k}: ${"a fairly long question about what she has been noticing ".repeat(3)}`.slice(0, 200));
  for (const paper of ["letter", "a4"]) {
    for (const appendix of [false, true]) {
      const m = summaryModel({ days, meds, labs, questions, picked: ["Picked one?", "Picked two?"], today: TODAY, pcosOn: true, paper, appendix });
      const f = fitSummary(m, PdfDoc, "#4A5DB0");
      assert.equal(f.fitted, true, `${paper} fits`);
      assert.ok(f.limits.questions < 10 || f.limits.treatments < 7 || f.limits.labValues < 4, "something was trimmed");
      const bytes = summaryPdf({ summary: f, accentHex: "#4A5DB0" }, PdfDoc);
      if (!appendix) assert.equal(pages(latin1(bytes)), 1, `${paper}: page 1 only`);
      const p = pageOne(f);
      const word = appendix ? "in the detailed pages" : "not shown";
      if (p.qMore) assert.ok(p.qMore.endsWith(word));
      if (p.treatMore) assert.ok(p.treatMore.endsWith(word));
    }
  }
  // A typical 3-month log needs no trimming.
  const typical = fitSummary(base({ meds: meds.slice(0, 2), labs: labs.slice(0, 5), questions: questions.slice(0, 3) }), PdfDoc);
  assert.deepEqual([typical.fitted, typical.limits.questions, typical.limits.treatments, typical.limits.labValues], [true, 3, 2, 4]);
  assert.equal(moreLine(0, true), null);
});

test("the file: page 1 alone by default; detailed pages, notes and AI write-up only when asked", () => {
  const days = log([150, 108, 70, 31], (i) => (i % 2 ? { hda: 1 } : {})).map((d, k) => (k === d.length ? d : d));
  days[days.length - 3].note = "NOTESENTINEL";
  const ids = Object.keys(ALL_SYM);
  const ins = insights(days, ids, new Date(`${TODAY}T12:00:00`));
  const visit = (notes) => visitModel({ days, ins, ids, stage: "periods", stageName: "My Cycle", today: TODAY, includeNotes: notes, scale: SCORE_SCALE.periods });
  const one = latin1(summaryPdf({ summary: fitSummary(base({ days }), PdfDoc), visit: visit(true), ai: { writeup: "AISENTINEL", day: TODAY } }, PdfDoc));
  assert.equal(pages(one), 1);
  for (const w of ["NOTESENTINEL", "AISENTINEL", "Day score", "Maya"]) assert.ok(!one.includes(w), w);
  assert.ok(one.includes("(Patient-reported data) Tj") && one.includes("(Page 1 of 1) Tj") && one.includes("(Generated Nov 2, 2026) Tj"));
  assert.ok(!/CreationDate|ModDate/.test(one));
  const full = latin1(summaryPdf({ summary: fitSummary(base({ days, appendix: true, name: "Maya" }), PdfDoc), visit: visit(true), ai: { writeup: "AISENTINEL", day: TODAY } }, PdfDoc));
  assert.ok(pages(full) >= 3);
  for (const w of ["NOTESENTINEL", "AISENTINEL", "Day score", "(Maya) Tj", "Detailed pages"]) assert.ok(full.includes(w), w);
  const noNotes = latin1(summaryPdf({ summary: fitSummary(base({ days, appendix: true }), PdfDoc), visit: visit(false) }, PdfDoc));
  assert.ok(!noNotes.includes("NOTESENTINEL") && !noNotes.includes("AISENTINEL"));
  // Same input, same bytes.
  const a = summaryPdf({ summary: fitSummary(base(), PdfDoc) }, PdfDoc), b = summaryPdf({ summary: fitSummary(base(), PdfDoc) }, PdfDoc);
  assert.deepEqual(Buffer.from(a), Buffer.from(b));
});

test("wording: no scores, verdicts or diagnoses on page 1; every string WinAnsi-safe for ordinary input", () => {
  const m = base({ meds: [{ id: 1, name: "Metformin", kind: "rx", started: addDays(TODAY, -40) }], questions: ["Is this normal for me?"] });
  for (const t of summaryTexts(m).filter((x) => x !== "Is this normal for me?")) {
    assert.ok(!/\bscore|\/100|\bgrade|\bworks?\b|\bdiagnosed with|\byou have\b|\babnormal|\bdisorder/i.test(t), t);
    for (const x of t.matchAll(/diagnosis/g)) assert.equal(t.slice(Math.max(0, x.index - 6), x.index + 9).toLowerCase(), "not a diagnosis", t);
    assert.ok(!pdfLossy(t), `prints as ?: ${t}`);
  }
});

test("accent: her stage colour at AA on white, for every palette; the preview uses the same colours", () => {
  for (const list of Object.values(PALETTES)) for (const p of list) assert.ok(onWhite(pdfAccent(p.primary)) >= 4.5, p.id);
  assert.ok(onWhite(pdfAccent("#C2AEF2")) >= 4.5, "even a pale dark-scheme tone is darkened");
  assert.ok(onWhite(pdfAccent(null)) >= 4.5);
  const v = sheetVars(pdfAccent("#4A5DB0"));
  assert.equal(v["--cs-paper"], "rgb(255, 255, 255)");
  assert.ok(v["--cs-acc"].startsWith("rgb("));
});

test("source: pure, no pdf.js import, no network or storage; pdftotext reads page 1", () => {
  const src = readFileSync(join(SRC, "clinicianSummary.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const w of ["fetch(", "localStorage", "indexedDB", "Date.now", "new Date()", "from \"./pdf.js\"", "from \"./api.js\"", "import("]) assert.ok(!src.includes(w), w);
  if (!existsSync("/usr/bin/pdftotext")) return;
  const dir = mkdtempSync(join(tmpdir(), "cs-"));
  const f = join(dir, "s.pdf");
  writeFileSync(f, summaryPdf({ summary: fitSummary(base({ labs: [{ id: "a", kind: "hba1c", value: 5.6, unit: "%", date: "2026-10-28" }] }), PdfDoc) }, PdfDoc));
  const txt = execFileSync("/usr/bin/pdftotext", ["-layout", f, "-"]).toString();
  for (const w of ["Solia Health · Clinician summary", "CYCLES", "TOP SYMPTOMS", "LAB VALUES OVER TIME", "5.6% (Oct 28)", "QUESTIONS FOR MY VISIT", "Patient-reported data"]) assert.ok(txt.includes(w), w);
});

/* Passive tracking S2 (plan §2.7): the cycle table in place of the strip when temperature nights exist; one page on Letter and A4. */
test("cycle table: with temperature nights page 1 shows a table (newest first, at most 12, trimmed to 6 first); without them the strip stays", () => {
  // Nine 28-day cycles with a rise on day 15, ending today: the log's days are the fixture's period days, filled in with check-ins.
  const f = syntheticLog({ start: addDays(TODAY, -(28 * 9) - 10), n: 9, running: false });
  const days = f.days.filter((d) => d.date <= TODAY);
  const sym = log([300, 268, 238, 196, 166, 126, 98, 60, 20], () => ({ crm: 2, hda: 1 })).filter((d) => !d.period).map((d) => ({ ...d, period: false }));
  const all = [...days, ...sym.filter((d) => !days.some((x) => x.date === d.date))];
  const cycles = cyclesFrom(days);
  const temps = nightlyTemps(f.rows);
  const wear = { cycles: cycleTable(cycles, temps, days), skipped: skippedSummary({ [addDays(TODAY, -3)]: "fever", [addDays(TODAY, -9)]: "travel" }) };
  const m = summaryModel({ days: all, today: TODAY, wear, questions: ["One?", "Two?"], meds: [{ id: 1, name: "Magnesium", kind: "supp", started: addDays(TODAY, -40) }] });
  assert.ok(m.cycles.table, "a table");
  assert.ok(m.cycles.table.length >= 6 && m.cycles.table.length <= CYCLE_ROWS_MAX);
  assert.ok(m.cycles.table[0].start > m.cycles.table[1].start, "newest first");
  assert.ok(m.cycles.table.some((r) => /^seen, day 15/.test(r.rise)), JSON.stringify(m.cycles.table.map((r) => r.rise)));
  assert.ok(m.cycles.table.some((r) => r.luteal === "14 d"));
  assert.equal(m.cycles.tableNote, TABLE_NOTE);
  assert.equal(m.limits.cycleRows, m.cycles.table.length);
  assert.match(m.skipped.text, /^Nights she marked as not usable: 2 \(fever or illness 1, travel 1\)\.$/);
  for (const paper of ["letter", "a4"]) {
    const fit = fitSummary({ ...m, paper }, PdfDoc, PALETTES.periods[0].primary);
    assert.ok(fit.fitted, `${paper}: fits one page`);
    assert.ok(fit.limits.cycleRows <= CYCLE_ROWS_FIT || fit.limits.cycleRows === m.cycles.table.length, `${paper}: the table is trimmed to ${CYCLE_ROWS_FIT} rows first when it has to be`);
    const bytes = summaryPdf({ summary: fit }, PdfDoc);
    assert.equal(pages(latin1(bytes)), 1, `${paper}: one page`);
    const p1 = pageOne(fit);
    assert.ok(p1.cycleRows.length <= fit.limits.cycleRows);
    if (p1.cycleRows.length < m.cycles.table.length) assert.match(p1.cycMore, /^\+\d+ more not shown$/);
  }
  const texts = summaryTexts(m);
  assert.ok(texts.includes(TABLE_NOTE) && texts.includes(SKIPPED_HEAD) && texts.includes(m.skipped.text));
  for (const tx of texts) assert.ok(!/ovulation (is |was )?confirmed|contracept/i.test(tx), tx);
  // the appendix carries every row and the skipped-nights count
  const withApp = summaryPdf({ summary: fitSummary({ ...m, appendix: true }, PdfDoc) }, PdfDoc);
  assert.ok(pages(latin1(withApp)) >= 2);
  // without temperature nights, or without wear at all: the strip
  const noTemps = { cycles: cycleTable(cycles, [], days), skipped: skippedSummary({}) };
  assert.equal(summaryModel({ days: all, today: TODAY, wear: noTemps }).cycles.table, undefined);
  assert.equal(summaryModel({ days: all, today: TODAY }).cycles.table, undefined);
  assert.equal(summaryModel({ days: all, today: TODAY }).skipped, null);
  // never in pregnancy
  assert.equal(summaryModel({ days: [], stage: "preg", stageName: "Pregnancy", today: TODAY, wear }).cycles.table, undefined);
});
