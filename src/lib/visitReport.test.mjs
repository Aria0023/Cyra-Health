import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { visitModel, visitPdf, visitTexts, paperForLocale, footerText, VISIT_TITLE, MADE_LINE, limitLine, FERTILITY_FOOT } from "./visitReport.js";
import { PdfDoc } from "./pdf.js";
import { insights, dayScore, isPeriodDay, addDays } from "./engine.js";
import { SYM, SCORE_SCALE } from "./constants.js";
import { pdfLossy } from "./potsReport.js";
import { FERT_BANNED, contraOk } from "./fertility.js";

const SRC = dirname(fileURLToPath(import.meta.url));
const IDS = Object.keys(SYM);
const TODAY = "2026-10-22";
const latin1 = (bytes) => Buffer.from(bytes).toString("latin1");
const pageCount = (s) => (s.match(/\/Type \/Page\b/g) || []).length;

/* A perimenopause record: the 30-day window fully logged, exactly prevLogged days logged in the 30 days before
   (the earliest of them), period days wherever a start falls (so every start is detected), nine symptoms with fixed
   severities, seven period starts (the last one running today; one of the second-last cycle's period days is spotting) and, with notes, two
   notes in the window and one before it. */
function fixture({ prevLogged = 12, notes = true, periods = true } = {}) {
  const days = [];
  const syms = ["hf", "ns", "slp", "fog", "ach", "anx", "pal", "dry", "eng"];
  const starts = periods ? [0, 30, 63, 89, 121, 133, 160].map((k) => addDays(TODAY, -k)) : [];
  const periodDays = new Set(starts.flatMap((s) => [0, 1, 2, 3].map((k) => addDays(s, k))));
  for (let i = 0; i < 170; i++) {
    const iso = addDays(TODAY, -i);
    const logged = i < 30 || (i < 60 && i - 30 < prevLogged) || periodDays.has(iso);
    if (!logged) continue;
    const sym = {};
    syms.forEach((id, j) => { const v = (i + j) % 4; if (v) sym[id] = v; });
    const e = { date: iso, sym, sleepQ: i % 3 === 0 ? "poor" : "good", scales: { fatigue: (i * 3) % 10, pain: (i * 7) % 10, moodq: 3 + ((i * 5) % 7) } };
    if (periodDays.has(iso)) { e.period = true; e.flow = i === 29 ? "spot" : "med"; }
    if (notes && i === 2) e.note = "NOTESENTINEL two";
    if (notes && i === 10) e.note = "NOTESENTINEL one";
    if (notes && i === 40) e.note = "BEFORE the window";
    days.push(e);
  }
  return days.sort((a, b) => a.date.localeCompare(b.date));
}
const model = (over = {}, days = fixture()) => {
  const ins = insights(days, IDS, new Date(`${TODAY}T12:00:00`));
  return visitModel({ days, ins, ids: IDS, stage: "peri", stageName: "Perimenopause", name: "Ada", today: TODAY, questions: ["Could we check my thyroid?", "What are my options?"], cycleFlags: {}, scale: SCORE_SCALE.peri, ...over });
};
const BANNED = /\b(you have|diagnosed with|confirm(s|ed)? ovulation|ovulation (is )?confirmed|safe days?|contracept\w*|abnormal|disorder)\b/i;
const checkWording = (m) => {
  for (const t of visitTexts(m)) {
    assert.ok(contraOk(t), `contraception claim: ${t}`);
    assert.ok(!BANNED.test(t.replace(/\bnot contraception\b/gi, "")), `banned wording: ${t}`);
    for (const x of t.matchAll(/diagnosis/g)) assert.equal(t.slice(Math.max(0, x.index - 6), x.index + 9), "not a diagnosis", `diagnosis outside 'not a diagnosis': ${t}`);
  }
  for (const l of m.fertility || []) assert.ok(!FERT_BANNED.test(l), `FERT_BANNED: ${l}`);
};

test("sections in the bytes", () => {
  const m = model();
  assert.equal(m.n, 30);
  assert.equal(m.symptoms.prevN, 12);
  assert.ok(m.symptoms.prevOk);
  assert.equal(m.cycles.rows.length, 7);
  assert.equal(m.symptoms.rows.length, 8);
  const s = latin1(visitPdf(m, PdfDoc));
  assert.ok(s.includes("(Cycle and symptom summary · Ada) Tj"));
  assert.ok(s.includes("Prepared by the user in Heard Health · observations, not a diagnosis"));
  for (const t of ["(1. Recent cycles) Tj", "(2. Symptoms, last 30 days) Tj", "(3. Day score, last 30 days) Tj", "(4. Questions I'd like to cover) Tj"]) assert.ok(s.includes(t), t);
  assert.equal((s.match(/\(Page 1 of /g) || []).length, 1);
  assert.equal((s.match(/\(Page \d+ of /g) || []).length, pageCount(s));
  assert.ok(!s.includes("Fertility signs"));
  assert.ok(!s.includes("My day notes"));
  checkWording(m);
});

test("notes absent unless opted in", () => {
  const off = model();
  assert.deepEqual(off.notes, []);
  assert.equal(off.notesInWindow, 2);
  const sOff = latin1(visitPdf(off, PdfDoc));
  assert.ok(!sOff.includes("NOTESENTINEL") && !sOff.includes("My day notes"));
  const on = model({ includeNotes: true });
  assert.deepEqual(on.notes.map((x) => x.text), ["NOTESENTINEL one", "NOTESENTINEL two"]);
  assert.ok(on.notes[0].iso < on.notes[1].iso, "chronological");
  const sOn = latin1(visitPdf(on, PdfDoc));
  assert.ok(sOn.includes("(5. My day notes) Tj"));
  assert.ok(sOn.indexOf("NOTESENTINEL one") < sOn.indexOf("NOTESENTINEL two"));
  assert.ok(!sOn.includes("BEFORE the window"));
  assert.ok(on.contents.endsWith("and 2 day notes."));
  // A truthy non-boolean never opts in.
  assert.deepEqual(model({ includeNotes: "yes" }).notes, []);
});

test("fertility only when passed", () => {
  const line = "Egg-white mucus on 3 days (Oct 9–11).";
  const m = model({ fertilityLines: [line] });
  assert.deepEqual(m.fertility, [line]);
  assert.equal(m.fertilityFoot, FERTILITY_FOOT);
  const s = latin1(visitPdf(m, PdfDoc));
  assert.ok(s.includes("(4. Fertility signs) Tj") && s.includes("(5. Questions I'd like to cover) Tj"));
  assert.ok(s.includes("(Egg-white mucus on 3 days"));
  assert.ok(s.includes("Mucus and test results point to your most fertile days"));
  assert.ok(m.contents.includes("your fertility signs"));
  checkWording(m);
  for (const v of [null, []]) {
    const x = model({ fertilityLines: v });
    assert.equal(x.fertility, null);
    assert.ok(!latin1(visitPdf(x, PdfDoc)).includes("Fertility signs"));
  }
});

test("cycle history", () => {
  const m = model();
  const rows = m.cycles.rows;
  assert.equal(rows.length, 7);
  assert.ok(rows[0].start < rows[6].start, "oldest first");
  assert.equal(rows[6].cells[1], "day 1 so far");
  assert.equal(rows[6].ongoingDay, 1);
  // A 12-day gap (day -133 to -121) is not a cycle length.
  const short = rows.find((r) => r.length === 12);
  assert.equal(short.cells[3], "Not counted as a cycle: under 15 days");
  assert.ok(!m.cycles.spreadLine.includes("12"));
  // periodDays counts isPeriodDay days only: the spotting day (today-29) is not counted.
  assert.equal(rows[6].periodDays, 1);
  assert.equal(rows[5].periodDays, 3);
  assert.equal(rows[5].cells[1], "30 days");
  // Lengths and spread read exactly as the Report footer (every counted cycle, D5).
  assert.equal(m.cycles.spreadLine, "Cycle lengths: 27, 32, 26, 33, 30 days (7-day spread).");
  // A cycle left out of predictions is labelled, still counted and the sentence says so.
  const ex = model({ cycleFlags: { [addDays(TODAY, -63)]: { exclude: true } } });
  const row = ex.cycles.rows.find((r) => r.start === addDays(TODAY, -63));
  assert.equal(row.cells[3], "Left out of predictions");
  assert.equal(row.cells[1], "33 days");
  assert.equal(ex.cycles.spreadLine, "Cycle lengths: 27, 32, 26, 33 (left out of predictions), 30 days (7-day spread). Every cycle is counted here, including any she left out of predictions.");
  // No starts at all.
  const none = model({}, fixture({ periods: false }));
  assert.equal(none.cycles.rows.length, 0);
  assert.equal(none.cycles.empty, "No period start logged in Heard Health.");
  assert.equal(none.header.title, "Symptom summary · Ada");
  const s = latin1(visitPdf(none, PdfDoc));
  assert.ok(s.includes("(Symptom summary · Ada) Tj") && s.includes("No period start logged in Heard Health."));
});

test("symptom comparison rule", () => {
  const nine = model({}, fixture({ prevLogged: 9 }));
  assert.equal(nine.symptoms.prevN, 9);
  assert.equal(nine.symptoms.prevOk, false);
  assert.deepEqual(nine.symptoms.head, ["Symptom", "Days (of 30 logged)", "Moderate or strong"]);
  assert.equal(nine.symptoms.noCompare, "No comparison with the 30 days before (Aug 24 – Sep 22, 2026): 9 days were logged then, and Heard Health compares only with 10 or more.");
  assert.equal(nine.symptoms.rows[0].cells.length, 3);
  assert.ok(!visitTexts(nine).some((t) => t.includes("30 days before (of")));
  const ten = model({}, fixture({ prevLogged: 10 }));
  assert.equal(ten.symptoms.prevN, 10);
  assert.ok(ten.symptoms.prevOk);
  assert.equal(ten.symptoms.head.length, 5);
  assert.equal(ten.symptoms.noCompare, null);
  const changes = new Set(ten.symptoms.rows.map((r) => r.change));
  assert.ok([...changes].every((c) => c === "same" || /^\d+ (more|fewer)$/.test(c)), [...changes].join());
  // prevDays equals a direct count for every id (the rule ReportScreen's Delta used).
  const days = fixture({ prevLogged: 10 });
  const from = addDays(TODAY, -29), pfrom = addDays(TODAY, -59);
  const prev30 = days.filter((d) => d.date >= pfrom && d.date < from);
  for (const id of IDS) assert.equal(ten.symptoms.prevDays[id], prev30.filter((d) => (d.sym?.[id] || 0) > 0).length, id);
  // Days and strong equal ins.counts.
  const ins = insights(days, IDS, new Date(`${TODAY}T12:00:00`));
  for (const r of ten.symptoms.rows) { const c = ins.counts.find((x) => x.id === r.id); assert.equal(r.days, c.days); assert.equal(r.strong, c.strong); }
  // A 9th symptom goes to the "Also logged" sentence.
  assert.equal(ten.symptoms.more, `Also logged: ${ins.counts[8].label} (${ins.counts[8].days} days).`);
  // Exact change cells for a hand-made pair.
  const pair = fixture({ prevLogged: 10 }).map((d) => ({ ...d, sym: {} }));
  const set = (iso, id) => { const e = pair.find((d) => d.date === iso); if (e) e.sym = { ...e.sym, [id]: 1 }; };
  for (let i = 0; i < 5; i++) { set(addDays(TODAY, -i), "hf"); set(addDays(TODAY, -i), "ns"); }
  for (let i = 5; i < 8; i++) set(addDays(TODAY, -i), "ns");
  for (let i = 0; i < 3; i++) set(addDays(TODAY, -i), "fog");
  for (let i = 30; i < 35; i++) { set(addDays(TODAY, -i), "hf"); set(addDays(TODAY, -i), "ns"); }
  for (let i = 35; i < 40; i++) set(addDays(TODAY, -i), "fog");
  const insP = insights(pair, IDS, new Date(`${TODAY}T12:00:00`));
  const p = visitModel({ days: pair, ins: insP, ids: IDS, stage: "peri", stageName: "Perimenopause", today: TODAY, scale: SCORE_SCALE.peri });
  const row = (id) => p.symptoms.rows.find((r) => r.id === id);
  assert.equal(row("hf").change, "same");
  assert.equal(row("ns").change, "3 more");
  assert.equal(row("fog").change, "2 fewer");
});

test("day-score trend", () => {
  const days = fixture();
  const m = model({}, days);
  assert.equal(m.trend.points.length, 30);
  assert.equal(m.trend.points[0].iso, addDays(TODAY, -29));
  assert.equal(m.trend.points[29].iso, TODAY);
  for (const p of m.trend.points) {
    const e = days.find((d) => d.date === p.iso) || null;
    assert.equal(p.score, e ? Math.round(dayScore(e, IDS, SCORE_SCALE.peri) * 100) : null);
    assert.equal(p.period, isPeriodDay(e));
  }
  const scores = m.trend.points.map((p) => p.score);
  const lo = Math.min(...scores), hi = Math.max(...scores);
  assert.equal(m.trend.low.iso, m.trend.points.find((p) => p.score === lo).iso, "earliest lowest");
  assert.equal(m.trend.high.iso, m.trend.points.find((p) => p.score === hi).iso, "earliest highest");
  assert.equal(m.trend.sentence, `Average ${m.trend.avg} over 30 logged days; lowest ${lo} on ${new Date(`${m.trend.low.iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}, highest ${hi} on ${new Date(`${m.trend.high.iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}. The 30 days before: average ${m.trend.prevAvg} over 12 logged days.`);
  // Without a comparison the second sentence is absent.
  const nine = model({}, fixture({ prevLogged: 9 }));
  assert.ok(!nine.trend.sentence.includes("The 30 days before"));
  assert.equal(nine.trend.prevAvg, null);
  // Ties: two equal lowest days, the earliest wins.
  const flat = days.map((d) => (d.date >= addDays(TODAY, -29) ? { ...d, sym: {}, sleepQ: "good", scales: { fatigue: 0, pain: 0, moodq: 5 } } : d));
  const insF = insights(flat, IDS, new Date(`${TODAY}T12:00:00`));
  const f = visitModel({ days: flat, ins: insF, ids: IDS, stage: "peri", stageName: "Perimenopause", today: TODAY, scale: SCORE_SCALE.peri });
  assert.equal(f.trend.low.iso, addDays(TODAY, -29));
  assert.equal(f.trend.high.iso, addDays(TODAY, -29));
  // Nothing logged: the sentence alone, and no chart operators.
  const empty = days.filter((d) => d.date < addDays(TODAY, -29));
  const insE = insights(empty, IDS, new Date(`${TODAY}T12:00:00`));
  const e = visitModel({ days: empty, ins: insE, ids: IDS, stage: "peri", stageName: "Perimenopause", today: TODAY, scale: SCORE_SCALE.peri });
  assert.equal(e.trend.count, 0);
  assert.equal(e.trend.sentence, "No days logged in these 30 days.");
  const s = latin1(visitPdf(e, PdfDoc));
  assert.ok(!s.includes(" c f Q"), "no dots");
  assert.ok(!s.includes("[3 2] 0 d"), "no average line");
  assert.ok(s.includes("Nothing logged in these 30 days."));
  assert.ok(!s.includes("Each dot is a day"));
});

test("contents and top lines", () => {
  const full = model();
  assert.equal(full.contents, "In it: your recent cycles, your top symptoms against the month before, a 30-day day-score chart and the 2 questions you added.");
  assert.equal(full.top, "At the top: your name, your life stage and the dates it covers.");
  const noName = model({ name: "" });
  assert.equal(noName.top, "At the top: your life stage and the dates it covers.");
  assert.equal(noName.header.title, VISIT_TITLE);
  assert.ok(!noName.header.title.includes(" · "));
  const bare = model({ questions: [] }, fixture({ periods: false, prevLogged: 9 }));
  assert.equal(bare.contents, "In it: your top symptoms and a 30-day day-score chart.");
  const oneNote = model({ includeNotes: true, questions: ["One?"] }, fixture().filter((d) => d.note !== "NOTESENTINEL one"));
  assert.equal(oneNote.contents, "In it: your recent cycles, your top symptoms against the month before, a 30-day day-score chart, the question you added and 1 day note.");
  // enough: false only with nothing in the window and no cycles.
  assert.ok(full.enough);
  const nothing = visitModel({ days: [], ins: insights([], IDS, new Date(`${TODAY}T12:00:00`)), ids: IDS, stage: "peri", stageName: "Perimenopause", today: TODAY, scale: SCORE_SCALE.peri });
  assert.equal(nothing.enough, false);
  assert.equal(nothing.contents, "");
  const old = fixture().filter((d) => d.date < addDays(TODAY, -29));
  const oldOnly = visitModel({ days: old, ins: insights(old, IDS, new Date(`${TODAY}T12:00:00`)), ids: IDS, stage: "peri", stageName: "Perimenopause", today: TODAY, scale: SCORE_SCALE.peri });
  assert.ok(oldOnly.enough, "cycles alone are enough");
  assert.equal(oldOnly.header.line, "Perimenopause · Sep 23 – Oct 22, 2026 · 0 of the last 30 days logged");
  assert.equal(full.files.pdf, "heard-health-summary-2026-10-22.pdf");
  assert.equal(full.header.made, MADE_LINE);
  assert.equal(limitLine(3, "2026-11-01"), "You've made this month's 3 PDFs. You can make another from Nov 1, 2026. Print this page works any time.");
});

test("questions", () => {
  const m = model({ questions: ["  one ", "two", "", "three", "four"] });
  assert.deepEqual(m.questions, ["one", "two", "three"]);
  const s = latin1(visitPdf(m, PdfDoc));
  assert.ok(s.includes("(1.) Tj") && s.includes("(2.) Tj") && s.includes("(3.) Tj") && s.includes("(three) Tj") && !s.includes("(four) Tj"));
  const none = model({ questions: [] });
  assert.deepEqual(none.questions, []);
  assert.ok(!none.contents.includes("question"));
  assert.ok(!latin1(visitPdf(none, PdfDoc)).includes("Questions I'd like"));
});

test("no other inputs", () => {
  const a = visitPdf(model(), PdfDoc);
  const b = visitPdf(model({ wearData: [{ date: TODAY, rhr: 58 }, { date: addDays(TODAY, -1), rhr: 47 }], journal: { [TODAY]: "JOURNALSENTINEL" }, regAnswers: { zip: "90210" }, appts: [{ date: TODAY, who: "Dr APPTSENTINEL" }] }), PdfDoc);
  assert.deepEqual(Buffer.from(a), Buffer.from(b));
  const s = latin1(a);
  for (const t of ["JOURNALSENTINEL", "90210", "APPTSENTINEL", "58", "47"]) assert.ok(!new RegExp(`\\(${t}\\) Tj`).test(s), t);
});

test("deterministic, valid file", () => {
  const a = visitPdf(model(), PdfDoc), b = visitPdf(model(), PdfDoc);
  assert.deepEqual(Buffer.from(a), Buffer.from(b));
  const s = latin1(a);
  assert.ok(s.startsWith("%PDF-1.4"));
  assert.ok(s.endsWith("%%EOF\n"));
  assert.ok(!/CreationDate|ModDate/.test(s));
  assert.ok(s.includes("/Title (Heard Health report)"));
  const xrefAt = Number(/startxref\n(\d+)\n/.exec(s)[1]);
  assert.equal(s.slice(xrefAt, xrefAt + 4), "xref");
  const [, count] = /xref\n0 (\d+)\n/.exec(s.slice(xrefAt));
  const entries = s.slice(xrefAt).split("\n").slice(3, 2 + Number(count));
  entries.forEach((e, i) => { const off = Number(e.slice(0, 10)); assert.ok(s.slice(off).startsWith(`${i + 1} 0 obj`), `object ${i + 1} at ${off}`); });
  for (const m of s.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
    const start = m.index + m[0].length;
    assert.equal(s.slice(start + Number(m[1]), start + Number(m[1]) + 10), "\nendstream", "stream length is exact");
  }
});

test("paper", () => {
  assert.equal(paperForLocale("en-US"), "letter");
  assert.equal(paperForLocale("en-CA"), "letter");
  for (const l of ["en-GB", "de-DE", undefined]) assert.equal(paperForLocale(l), "a4");
  assert.ok(latin1(visitPdf(model({ paper: "letter" }), PdfDoc)).includes("/MediaBox [0 0 612 792]"));
  assert.ok(latin1(visitPdf(model(), PdfDoc)).includes("/MediaBox [0 0 595.28 841.89]"));
});

test("page budget", () => {
  const base = fixture({ notes: false });
  const full = model({ questions: ["a?", "b?", "c?"] }, base);
  assert.ok(pageCount(latin1(visitPdf(full, PdfDoc))) <= 2);
  const long = "x".repeat(279) + "y";
  const withNotes = (k) => base.map((d, i) => (d.date >= addDays(TODAY, -29) && i >= base.length - k ? { ...d, note: long } : d));
  const ten = model({ includeNotes: true }, withNotes(10));
  assert.equal(ten.notes.length, 10);
  assert.ok(pageCount(latin1(visitPdf(ten, PdfDoc))) <= 2);
  const thirty = model({ includeNotes: true }, withNotes(30));
  assert.equal(thirty.notes.length, 30);
  const s = latin1(visitPdf(thirty, PdfDoc));
  const pages = pageCount(s);
  assert.ok(pages <= 3, `${pages} pages`);
  for (let p = 1; p <= pages; p++) assert.ok(s.includes(`(Page ${p} of ${pages} `), `page ${p}`);
});

test("WinAnsi", () => {
  const days = fixture().map((d) => (d.note === "NOTESENTINEL one" ? { ...d, note: "😊 tired ναι" } : d));
  const m = model({ includeNotes: true }, days);
  assert.ok(visitTexts(m).some(pdfLossy));
  const bytes = visitPdf(m, PdfDoc);
  assert.ok(!Array.from(bytes).includes(0xf0), "no UTF-8 emoji lead byte");
  assert.ok(latin1(bytes).includes("tired ???) Tj"));
  assert.equal(visitTexts(model()).some(pdfLossy), false);
});

test("pdftotext", { skip: !existsSync("/usr/bin/pdftotext") }, () => {
  const dir = mkdtempSync(join(tmpdir(), "cyra-visit-"));
  const f = join(dir, "visit.pdf");
  writeFileSync(f, visitPdf(model(), PdfDoc));
  const t = execFileSync("/usr/bin/pdftotext", ["-layout", f, "-"], { encoding: "utf8" });
  assert.match(t, /Cycle and symptom summary · Ada/);
  assert.match(t, /Perimenopause · \w{3} \d+ – \w{3} \d+, \d{4} · \d+ of the last 30 days logged/);
  assert.match(t, /Hot flashes\s+\d+\s+\d+/);
  assert.match(t, /Page 1 of \d · Heard Health · Observations, not a diagnosis\./);
});

test("banned wording", () => {
  for (const m of [model(), model({ includeNotes: true, fertilityLines: ["Positive ovulation test on 1 day: Oct 12", "Temperature logged on 9 days"] }), model({}, fixture({ periods: false, prevLogged: 9 }))]) checkWording(m);
  assert.equal(footerText(2, 3), "Page 2 of 3 · Heard Health · Observations, not a diagnosis.");
});

test("source", () => {
  const src = readFileSync(join(SRC, "visitReport.js"), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  for (const w of ["fetch(", "apiPost", "localStorage", "sessionStorage", "indexedDB", "XMLHttpRequest", "WebSocket", "sendBeacon", "Date.now", "new Date()"]) assert.ok(!src.includes(w), w);
  for (const mod of ["api.js", "pulse.js", "storage.js", "notifications.js", "wearables.js", "pdf.js", "plan.js"]) assert.ok(!new RegExp(`from "\\./${mod.replace(".", "\\.")}"`).test(src), mod);
  assert.match(src, /import \{ RAMPS \} from "\.\/constants\.js"/);
  const screen = readFileSync(join(SRC, "..", "screens", "ReportScreen.jsx"), "utf8");
  assert.match(screen, /import \{ PdfDoc \} from "\.\.\/lib\/pdf\.js"/);
  for (const f of ["App.jsx", "screens/ReportScreen.jsx", "components/pots/PotsReport.jsx"]) {
    const code = readFileSync(join(SRC, "..", f), "utf8");
    assert.ok(!/import\((["'`])[^)]*(pdf|visitReport)\.js/.test(code), `${f} lazy-imports pdf.js or visitReport.js`);
  }
});

test("meal notes only when passed (Meal notes on and ticked): counts in words, no foods", () => {
  const off = model();
  assert.equal("meals" in off, false);
  const sOff = latin1(visitPdf(off, PdfDoc));
  assert.ok(!sOff.includes("Meal notes"));
  assert.equal(sOff, latin1(visitPdf(model({ mealLines: null }), PdfDoc)), "null mealLines: identical bytes");
  assert.equal(sOff, latin1(visitPdf(model({ mealLines: [] }), PdfDoc)), "empty mealLines: identical bytes");
  const lines = ["5 meal notes on 3 days (no foods, amounts or calories).", "Energy after meals: steady after 3 meals and dipped after 2 meals."];
  const on = model({ mealLines: lines });
  assert.deepEqual(on.meals, lines);
  const s = latin1(visitPdf(on, PdfDoc));
  assert.ok(s.includes("(4. Meal notes) Tj"));
  assert.ok(s.includes("5 meal notes on 3 days"));
  assert.ok(on.contents.includes("your meal notes as counts"));
  assert.ok(visitTexts(on).includes("Meal notes"));
  checkWording(on);
});
