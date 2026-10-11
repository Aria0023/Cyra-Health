/* Unit tests for the POTS clinician report (lib/potsReport.js) and the PDF writer
   (lib/pdf.js), design 11.1 g. Run with `npm run test:unit` (node --test, no dependencies;
   the pdftotext checks run when /usr/bin/pdftotext exists). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  freshEmpty, upsertTest, addIntake, setIv, setRating, setUp, setSym, toggleTrig, addEpisode, upsertMed, logDose, setAid, setSettings,
  addTilt, addVitals, setNote, setTestFaint, deleteTest,
} from "./pots.js";
import { reportModel, toCSV, csvCell, summaryText, emailParts, reportPdf, modelTexts, visitQuestions, reportRange, paperFor, pdfLossy, CSV_HEADER } from "./potsReport.js";
import { PdfDoc, winAnsi, textWidth, wrapLines } from "./pdf.js";
import { POTS_BANNED } from "./potsConstants.js";

const TODAY = "2026-10-10", D = "2026-10-08";
const DOSE_RE = /\b\d+(\.\d+)?\s?(mg|g|mcg)\b/;
const TEST = (over = {}) => ({
  id: "t1", date: D, t: "09:00", upd: 1, method: "stand", restPos: "back", restMin: 5, sched: "1-3-5-10", bp: true, device: "cuff",
  ctx: { meds: "taken", rateMed: "no", comp: true, ate2h: false, mlBefore: 750 },
  rest: [{ min: 4, hr: 66, sys: 118, dia: 76 }, { min: 5, hr: 70, sys: 120, dia: 78 }],
  up: [{ min: 1, atSec: 60, hr: 88, sys: 115, dia: 75, feel: [] }, { min: 3, atSec: 180, hr: 96, sys: 118, dia: 76, feel: ["p_dzy"] }, { min: 5, atSec: 300, hr: 101 }, { min: 10, atSec: 650, hr: 104 }],
  feel: [], status: "done", note: "SENTINEL_TESTNOTE", edited: false, ...over,
});
/** A log with every kind of entry, a sentinel in every typed note, and a formula-like label. */
function fixture() {
  let p = { ...freshEmpty(), on: true, epoch: "e1", epochAt: 1, since: "2026-09-01" };
  p = upsertTest(p, TEST());
  for (let i = 1; i <= 9; i++) {
    const d = `2026-10-0${i}`;
    p = addIntake(p, d, { id: `i${i}`, t: "09:00", kind: "water", label: "Glass", ml: 250, naMg: null });
    p = setRating(p, d, (i % 4) + 1);
    p = setSym(p, d, "p_dzy", (i % 3) + 1);
  }
  p = setUp(p, D, 6);
  p = toggleTrig(p, D, "t_heat");
  p = addIntake(p, D, { id: "lx", t: "10:00", kind: "electrolyte", label: "=SUM(A1)", ml: 500, naMg: 480 });
  p = setIv(p, D, { ml: 1000, note: "SENTINEL_IVNOTE" });
  p = addEpisode(p, D, { id: "e1", t: "11:00", sym: ["p_psy"], sev: 3, pos: "standing", faint: "almost", injured: false, mins: 2, trig: ["t_heat"], helped: ["lie"], note: "-5 note SENTINEL_EPNOTE" });
  p = upsertMed(p, { id: "m1", lib: "mido", name: "Midodrine", kind: "rx", times: ["08:00", "12:00"], note: "SENTINEL_MEDNOTE", started: "2026-09-01" });
  p = upsertMed(p, { id: "m2", lib: "comp_waist", name: "Compression (waist-high)", kind: "aid", times: [], note: "", started: null });
  p = logDose(p, D, { id: "d1", medId: "m1", slot: "08:00", state: "taken", t: "08:05" });
  p = setAid(p, D, "m2", true);
  p = setSettings(p, { goals: { fluidMl: 2500, naMg: 3000, by: "clinician", set: "2026-09-01" }, questions: [{ id: "q1", text: "Can I travel?" }], context: { status: "checking", onset: { ym: "2024-03", after: ["covid"] }, conditions: ["eds"] } });
  p = addTilt(p, { id: "tl1", date: "2026-09-25", where: "City clinic", told: "HR went up 40 SENTINEL_TILT", hrRise: 40, bpNote: "", fainted: "no" });
  p = addVitals(p, D, { id: "v1", t: "12:00", pos: "standing", hr: 110, sys: 110, dia: 70 });
  p = setNote(p, D, "SENTINEL_DAYNOTE");
  return p;
}
const CHECKIN = (d) => (d === D ? { sym: { fog: 2, hf: 3 } } : null);
const base = (over = {}) => ({ today: TODAY, stage: "peri", stageName: "Perimenopause", checkin: CHECKIN, checkinLabels: { fog: "Brain fog" }, ...over });
const allOut = (m) => [modelTexts(m).join("\n"), toCSV(m), summaryText(m), JSON.stringify(emailParts(m))].join("\n");

/* ---------- the model ---------- */
test("g: period ranges and paper size", () => {
  const p = fixture();
  assert.deepEqual(reportRange(p, "30", TODAY), { from: "2026-09-11", to: TODAY, n: 30 });
  assert.equal(reportRange(p, "90", TODAY).n, 90);
  assert.equal(reportRange(p, "all", TODAY).from, "2026-09-01"); // her first POTS entry (since)
  assert.equal(paperFor(p, "en-US"), "letter");
  assert.equal(paperFor(p, "en-CA"), "letter");
  assert.equal(paperFor(p, "en-GB"), "a4");
  assert.equal(paperFor(setSettings(p, { paper: "a4" }), "en-US"), "a4");
});

test("g: header, sections and neutral file names", () => {
  const m = reportModel(fixture(), base());
  assert.equal(m.header.line, "POTS log summary · Prepared by the patient · Sep 11 – Oct 10, 2026");
  assert.match(m.header.made, /^Made with the Cyra app on Oct 10, 2026 from the patient's own entries/);
  assert.equal(m.header.rated, "Rated days: 9 of 30 · good 2, okay 3, rough 2, bad 2");
  assert.deepEqual(m.sections.map((s) => s.id), ["tests", "sym", "fluid", "meds", "questions"]);
  assert.deepEqual(m.files, { pdf: "cyra-report-2026-10-10.pdf", csv: "cyra-data-2026-10-10.csv" });
  assert.equal(emailParts(m).subject, "My health log summary ahead of my appointment");
  assert.ok(m.enough);
  assert.ok(m.header.context.includes("Life stage: Perimenopause"));
  const empty = reportModel({ ...freshEmpty(), on: true }, base());
  assert.equal(empty.enough, false);
  // A locked record (newer build) gives no report.
  assert.equal(reportModel({ v: 2, days: {} }, base()), null);
});

test("g: the stand-test row, its result and 'edited'", () => {
  let p = fixture();
  let m = reportModel(p, base());
  const tbl = m.sections[0].blocks.find((b) => b.t === "table");
  assert.equal(tbl.rows.length, 1);
  const row = tbl.rows[0];
  assert.match(row[0], /Oct 8 9:00\nActive stand\nLying on back, 5 min\nBlood-pressure cuff/);
  assert.match(row[2], /HR 66, 70 \(base 68\)/);
  assert.match(row[3], /10: 104/);
  assert.equal(row[4], "104 (min 10)\n+36");
  assert.equal(row[5], "yes");
  assert.equal(row[6], "held steady");
  assert.ok(!/edited/.test(toCSV(m)));
  p = upsertTest(p, TEST({ edited: true }));
  m = reportModel(p, base());
  assert.equal(m.sections[0].blocks.find((b) => b.t === "table").rows[0][5], "yes\nedited");
  assert.match(toCSV(m), /stand_summary.*edited=yes/);
  assert.match(toCSV(m), /stand_reading.*edited=yes/);
  // Pregnancy keeps the rest position, which is how the test was done.
  m = reportModel(upsertTest(p, TEST({ restPos: "left" })), base({ stage: "preg", stageName: "Pregnancy", include: { cycle: false } }));
  assert.match(m.sections[0].blocks.find((b) => b.t === "table").rows[0][0], /Lying on left side/);
});

test("g: a 13-test log shows the newest 12 and points to the spreadsheet; the PDF breaks pages", () => {
  let p = fixture();
  for (let i = 0; i < 13; i++) p = upsertTest(p, TEST({ id: `tt${i}`, date: `2026-10-${String((i % 9) + 1).padStart(2, "0")}`, t: `1${i % 10}:00` }));
  const m = reportModel(p, base());
  const tbl = m.sections[0].blocks.find((b) => b.t === "table");
  assert.equal(tbl.rows.length, 12);
  assert.match(tbl.caption, /newest 12 of 14/);
  assert.ok(m.sections[0].blocks.some((b) => b.t === "p" && b.text === "2 older tests are in the spreadsheet."));
  assert.equal(toCSV(m).split("\r\n").filter((l) => l.startsWith('"stand_summary"')).length, 14);
  const pdf = Buffer.from(reportPdf(m, PdfDoc)).toString("latin1");
  assert.ok((pdf.match(/\/Type \/Page /g) || []).length >= 2, "the long report runs over pages");
});

test("g: a faint linked to a test is listed once", () => {
  let p = fixture();
  p = setTestFaint(p, "t1", "yes", "09:12");
  const m = reportModel(p, base());
  const faints = m.sections[1].blocks.find((b) => b.t === "table" && b.caption === "Faints and near-faints");
  assert.equal(faints.rows.length, 2); // the linked faint + her own near-faint
  assert.equal(faints.rows.filter((r) => r[6] === "Stand test").length, 1);
  assert.ok(m.sections[1].blocks.some((b) => b.text === "Fainted: 1 · Almost fainted: 1"));
  assert.equal(toCSV(m).split("\r\n").filter((l) => l.includes("source=stand test t1")).length, 1);
});

test("g: a faint kept after its stand test was deleted still says it came from a stand test", () => {
  let p = setTestFaint(fixture(), "t1", "yes", "09:12");
  p = deleteTest(p, "t1"); // "Keep the faint in my log" (the default)
  const m = reportModel(p, base());
  const faints = m.sections[1].blocks.find((b) => b.t === "table" && b.caption === "Faints and near-faints");
  assert.deepEqual(faints.rows.map((r) => r[6]).sort(), ["Logged", "Stand test (deleted)"]);
  assert.ok(!modelTexts(m).some((t) => /Exercise session/.test(t)));
  const csv = toCSV(m);
  assert.ok(csv.includes("source=deleted stand test t1"));
  assert.ok(!/source=session/.test(csv));
});

test("g: unticking stand tests leaves their numbers out of the questions too", () => {
  const t = TEST({ rest: [{ min: 4, hr: 104, sys: 150, dia: 95 }, { min: 5, hr: 106, sys: 152, dia: 97 }], up: [{ min: 1, hr: 140, sys: 120, dia: 80 }, { min: 3, hr: 146, sys: 118, dia: 78 }, { min: 5, hr: 145 }, { min: 10, hr: 146 }] });
  // Two tests with a high lying blood pressure, so the supine question is generated too.
  const p = upsertTest(upsertTest(fixture(), t), { ...t, id: "t2", date: "2026-10-09" });
  const on = reportModel(p, base());
  for (const id of ["q_test", "q_supine", "q_drop", "q_resthigh"]) assert.ok(on.questions.generated.some((q) => q.id === id && q.part === "tests"), id);
  const off = reportModel(p, base({ include: { tests: false } }));
  const out = allOut(off);
  for (const bad of [/standing test on/, /lying-down/i, /dropped when I stood/, /rise of 41/, /151\/96/, /\b105\b/]) assert.ok(!bad.test(out), `${bad} with stand tests unticked`);
  // The fluid-goal question follows the fluids box, the pregnancy one the medicines box.
  const goal = setSettings(fixture(), { goals: { by: "me" } });
  assert.ok(modelTexts(reportModel(goal, base())).some((x) => /fluid and salt goal/.test(x)));
  assert.ok(!allOut(reportModel(goal, base({ include: { fluid: false } }))).includes("fluid and salt goal"));
  const preg = base({ stage: "preg", stageName: "Pregnancy" });
  assert.ok(modelTexts(reportModel(fixture(), preg)).some((x) => /I'm pregnant/.test(x)));
  assert.ok(!allOut(reportModel(fixture(), { ...preg, include: { meds: false } })).includes("POTS medicines OK"));
});

test("g: medicine counts include days backfilled before POTS was turned on, and start at her first log", () => {
  let p = { ...freshEmpty(), on: true, epoch: "e1", epochAt: 1, since: TODAY };
  p = upsertMed(p, { id: "m9", lib: "mido", name: "Midodrine", kind: "rx", times: ["08:00"], started: null });
  for (const d of ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", TODAY]) p = logDose(p, d, { id: `d${d.slice(8)}`, medId: "m9", slot: "08:00", state: "taken", t: "08:00" });
  let row = reportModel(p, base()).sections.find((s) => s.id === "meds").blocks[0].rows[0];
  assert.equal(row[4], "6 of 6 days");
  assert.equal(row[5], "taken 6 · skipped 0 · not logged 0");
  // Added today with no start date: the days before it never count as unlogged.
  let q = { ...freshEmpty(), on: true, epoch: "e1", epochAt: 1, since: "2026-09-10" };
  q = upsertMed(q, { id: "m9", lib: "mido", name: "Midodrine", kind: "rx", times: ["08:00"], started: null });
  q = logDose(q, TODAY, { id: "dt", medId: "m9", slot: "08:00", state: "taken", t: "08:00" });
  row = reportModel(q, base()).sections.find((s) => s.id === "meds").blocks[0].rows[0];
  assert.equal(row[4], "1 of 1 day");
  assert.equal(row[5], "taken 1 · skipped 0 · not logged 0");
  // Nothing logged and no start date: nothing is counted.
  q = upsertMed(q, { id: "m8", lib: "fludro", name: "Fludrocortisone", kind: "rx", times: ["09:00"], started: null });
  row = reportModel(q, base()).sections.find((s) => s.id === "meds").blocks[0].rows.find((r) => r[0] === "Fludrocortisone");
  assert.equal(row[4], "none logged");
});

test("g: the usual logged time rounds a half-minute median to a real time", () => {
  let p = { ...freshEmpty(), on: true, epoch: "e1", epochAt: 1, since: "2026-10-01" };
  p = upsertMed(p, { id: "m9", lib: "mido", name: "Midodrine", kind: "rx", times: ["08:00", "09:00"], started: "2026-10-01" });
  p = logDose(p, "2026-10-08", { id: "a1", medId: "m9", slot: "08:00", state: "taken", t: "07:59" });
  p = logDose(p, "2026-10-09", { id: "a2", medId: "m9", slot: "08:00", state: "taken", t: "08:00" });
  p = logDose(p, "2026-10-08", { id: "b1", medId: "m9", slot: "09:00", state: "taken", t: "08:59" });
  p = logDose(p, "2026-10-09", { id: "b2", medId: "m9", slot: "09:00", state: "taken", t: "09:00" });
  const row = reportModel(p, base()).sections.find((s) => s.id === "meds").blocks[0].rows[0];
  assert.equal(row[6], "8:00 → 8:00\n9:00 → 9:00");
});

test("g: in pregnancy the files carry the pregnancy note, only with cycle details", () => {
  const p = upsertTest(fixture(), TEST({ restPos: "left", up: [{ min: 1, hr: 100 }, { min: 3, hr: 105 }, { min: 5, hr: 106 }, { min: 10, hr: 108 }] }));
  const preg = base({ stage: "preg", stageName: "Pregnancy" });
  const on = reportModel(p, preg);
  assert.ok(on.sections[0].blocks.some((b) => b.t === "p" && /^Heart rate normally rises during pregnancy/.test(b.text)));
  assert.match(summaryText(on), /largest rise 40 \(outside pregnancy, clinicians use 30\)\. Blood pressure: .*I'm pregnant, and heart rate normally rises during pregnancy/);
  assert.ok(!/sustained 30 or more/.test(summaryText(on)));
  assert.match(toCSV(on), /stand_summary.*threshold_note=from studies outside pregnancy/);
  for (const t of [...modelTexts(on), summaryText(on)]) assert.ok(!POTS_BANNED.test(t), t);
  const off = reportModel(p, { ...preg, include: { cycle: false } });
  assert.ok(!/pregnan/i.test(allOut(off)));
  assert.match(summaryText(off), /sustained 30 or more: yes/);
  // "Pregnancy" as what came just before her symptoms is a pregnancy detail too.
  const q = setSettings(p, { context: { onset: { after: ["pregnancy", "covid"] } } });
  assert.ok(reportModel(q, preg).header.context.includes("Just before they started: pregnancy and COVID-19"));
  const qOff = reportModel(q, { ...preg, include: { cycle: false } });
  assert.ok(qOff.header.context.includes("Just before they started: COVID-19"));
  assert.ok(!/pregnan/i.test(allOut(qOff)));
});

/* ---------- CSV ---------- */
test("g: CSV is UTF-8 with BOM, CRLF, quoted text, bare numbers and a formula guard", () => {
  const csv = toCSV(reportModel(fixture(), base({ include: { notes: true } })));
  assert.ok(csv.startsWith(`﻿${CSV_HEADER}\r\n`));
  assert.equal(CSV_HEADER, "record,date,time,item,value,unit,position,minute,severity,detail");
  assert.ok(!/[^\r]\n/.test(csv), "every line ends in CRLF");
  assert.ok(csv.includes(`"fluid","2026-10-08","10:00","'=SUM(A1)",500,"ml",,,,"electrolyte"`));
  assert.ok(csv.includes(`"sodium","2026-10-08","10:00","'=SUM(A1)",480,"mg_sodium",,,,"from drink"`));
  assert.equal(csvCell("-5 note"), `"'-5 note"`);
  assert.equal(csvCell("+1"), `"'+1"`);
  assert.equal(csvCell("@x"), `"'@x"`);
  assert.equal(csvCell("\tx"), `"'\tx"`);
  assert.equal(csvCell('say "hi"'), `"say ""hi"""`);
  assert.equal(csvCell(42), "42");
  assert.equal(csvCell(-5), "-5"); // a number is written bare
  assert.equal(csvCell(null), "");
  assert.ok(csv.includes(`"day_rating","2026-10-08",,"rating",1,"scale_1_good_4_bad",,,,"Good"`));
  assert.ok(csv.includes(`"stand_reading","2026-10-08","09:00","hr",104,"bpm","standing",10,,"test_id=t1; method=stand; phase=upright; entered_after_s=50"`));
  assert.ok(csv.includes(`"dose","2026-10-08","08:05","Midodrine","taken",,,,,"planned 08:00"`));
  assert.ok(csv.includes(`"support","2026-10-08",,"Compression (waist-high)","worn"`));
  assert.ok(csv.includes(`"iv","2026-10-08",,"iv_fluids",1000,"ml",,,,"note=SENTINEL_IVNOTE"`));
  assert.ok(csv.includes(`"goal","2026-09-01",,"fluid_goal",2500,"ml",,,,"set_by=clinician"`));
});

test("g: notes and her name only when she opts in", () => {
  const SENT = /SENTINEL_/;
  const off = reportModel(fixture(), base({ name: "Ada" }));
  assert.ok(!SENT.test(allOut(off)), "no typed note by default");
  assert.ok(!/Ada/.test(allOut(off)), "no name by default");
  assert.ok(!off.sections.some((s) => s.id === "notes"));
  const on = reportModel(fixture(), base({ name: "Ada", include: { notes: true, name: true } }));
  const out = allOut(on);
  for (const s of ["SENTINEL_DAYNOTE", "SENTINEL_EPNOTE", "SENTINEL_TESTNOTE", "SENTINEL_IVNOTE", "SENTINEL_MEDNOTE", "SENTINEL_TILT"]) assert.ok(out.includes(s), s);
  assert.equal(on.header.line, "POTS log summary · Ada · Sep 11 – Oct 10, 2026");
  assert.equal(emailParts(on).subject, "My health log summary ahead of my appointment — Ada");
  // Notes are never in the summary or the email, even when included in the files.
  assert.ok(!SENT.test(summaryText(on)));
  // An empty name never shows.
  assert.ok(!/·  ·/.test(reportModel(fixture(), base({ name: "", include: { name: true } })).header.line));
});

test("g: 'Cycle or pregnancy details' off leaves out stage, pregnancy, overlap and stage-based questions", () => {
  const preg = base({ stage: "preg", stageName: "Pregnancy", checkin: (d) => (d === D ? { sym: { dzy: 2 } } : null), checkinLabels: { dzy: "Dizziness" } });
  const pOn = reportModel(fixture(), preg);
  assert.ok(pOn.header.context.includes("Life stage: Pregnant (week not recorded in Cyra)"));
  assert.ok(toCSV(pOn).includes(`"checkin_overlap","2026-10-08",,"Dizziness",2,"severity",,,2,"from cycle/pregnancy check-in"`));
  assert.ok(pOn.questions.generated.some((q) => q.id === "q_preg" && q.stageBased));
  assert.ok(modelTexts(pOn).some((t) => /I'm pregnant/.test(t)));
  const pOff = reportModel(fixture(), { ...preg, include: { cycle: false } });
  const out = allOut(pOff);
  for (const bad of [/Pregnan/, /Life stage/, /checkin_overlap/, /cycle_day/i, /check-in/, /Perimenopause/]) assert.ok(!bad.test(out), `${bad} with cycle details off`);
  // Peri: the midlife question uses only the onset month she typed.
  const peri = reportModel(fixture(), base());
  assert.ok(modelTexts(peri).some((t) => t.startsWith("My symptoms started around March 2024.")));
  assert.ok(!modelTexts(reportModel(fixture(), base({ include: { cycle: false } }))).some((t) => /midlife/.test(t)));
  // The check-in is not read at all with the box unticked.
  let read = 0;
  reportModel(fixture(), base({ include: { cycle: false }, checkin: () => { read++; return null; } }));
  assert.equal(read, 0);
});

test("g: registration answers never change the output", () => {
  const outs = new Set();
  for (const regAnswers of [undefined, null, { age: "u25" }, { age: "25-34" }, { age: "35-44" }, { age: "45p" }, { age: "45p", zip: "90210", conditions: ["High blood pressure", "POTS or dysautonomia"] }]) {
    for (const opts of [base(), base({ include: { notes: true } })]) {
      const m = reportModel(fixture(), { ...opts, regAnswers });
      outs.add(`${opts.include ? "n" : "-"}${allOut(m)}${Buffer.from(reportPdf(m, PdfDoc)).toString("latin1")}`);
    }
  }
  assert.equal(outs.size, 2);
  const src = readFileSync(new URL("./potsReport.js", import.meta.url), "utf8");
  for (const bad of ["regAnswers", "wearData", "wearSources"]) assert.ok(!src.includes(bad), `potsReport.js mentions ${bad}`);
});

test("g: no watch or ring reading reaches any export", () => {
  // Wearable rows (wearables.js: { date, temp, rhr, hrv, sleep, sourceId }) handed in by mistake are ignored.
  const wearData = [{ date: D, temp: 0.08, rhr: 58, hrv: 47, sleep: 81, sourceId: "apple" }];
  const m = reportModel(fixture(), base({ wearData, wearSources: { apple: {} } }));
  const csv = toCSV(m);
  assert.equal(csv, toCSV(reportModel(fixture(), base())));
  assert.ok(!/\b(rhr|hrv|temp)\b/i.test(csv));
  assert.ok(!/sleep/i.test(csv));
  for (const v of ["58", "47", "81"]) assert.ok(!csv.split("\r\n").some((l) => l.split(",").includes(v)), `${v} as a value`);
  assert.ok(!/\b(rhr|hrv)\b/i.test(summaryText(m)));
});

test("g: report wording is free of diagnosis, dose and late/missed words", () => {
  for (const stage of ["peri", "periods", "preg"]) {
    for (const p of [fixture(), upsertTest(fixture(), TEST({ status: "stopped", stoppedAt: 4, why: "faint", fainted: "yes", up: [{ min: 1, hr: 120 }, { min: 3, hr: 98 }] }))]) {
      const m = reportModel(p, base({ stage, stageName: stage === "preg" ? "Pregnancy" : "My Cycle" }));
      for (const t of [...modelTexts(m), summaryText(m), emailParts(m).subject]) assert.ok(!POTS_BANNED.test(t), `banned wording: ${t}`);
      // No dose anywhere Cyra writes about medicines (sodium amounts from labels are not doses).
      const medTexts = modelTexts({ ...m, header: { ...m.header, context: [] }, sections: m.sections.filter((x) => x.id === "meds" || x.id === "questions") });
      for (const t of [...medTexts, m.summary.meds]) assert.ok(!DOSE_RE.test(t), `dose-like wording: ${t}`);
    }
  }
  for (const q of visitQuestions(fixture(), { tests: [TEST()], stage: "peri" })) assert.ok(!POTS_BANNED.test(q.text), q.text);
});

test("g: visit questions follow her data", () => {
  let p = fixture();
  let q = visitQuestions(p, { tests: [TEST()], stage: "peri" }).map((x) => x.id);
  assert.deepEqual(q, ["q_test", "q_causes", "q_midlife"]);
  p = setSettings(p, { context: { status: "diagnosed" }, goals: { by: "me" } });
  q = visitQuestions(p, { tests: [TEST({ rest: [{ min: 4, hr: 101, sys: 150, dia: 95 }, { min: 5, hr: 103, sys: 146, dia: 93 }], up: [{ min: 1, hr: 110, sys: 120, dia: 80 }, { min: 3, hr: 112, sys: 118, dia: 78 }] })], stage: "periods" }).map((x) => x.id);
  assert.deepEqual(q, ["q_goal", "q_supine", "q_drop", "q_resthigh"]);
  const tt = visitQuestions(p, { tests: [], stage: "periods", stageName: "Trying to Conceive" });
  assert.equal(tt.find((x) => x.id === "q_preg").text, "I'm planning a pregnancy. Are my POTS medicines OK to continue?");
});

test("g: the summary text", () => {
  const s = summaryText(reportModel(fixture(), base()));
  assert.match(s, /^Hello,\n/);
  assert.match(s, /- Latest standing test: Oct 8, 2026, active stand\. Lying heart rate 68, largest rise 36, sustained 30 or more: yes\. Blood pressure: held steady\./);
  assert.match(s, /- Standing tests in the last 90 days: 1/);
  assert.match(s, /- Most frequent POTS symptoms: Dizzy or lightheaded \(9 days\)/);
  assert.match(s, /- POTS medicines: Midodrine\n/);
  assert.match(s, /I can bring the full PDF and spreadsheet to the visit\.$/);
  // A rise reached only at the last reading, or once with a lower one after it, isn't a "no".
  const last = summaryText(reportModel(upsertTest(fixture(), TEST({ up: [{ min: 1, hr: 80 }, { min: 3, hr: 85 }, { min: 5, hr: 90 }, { min: 10, hr: 104 }] })), base()));
  assert.match(last, /largest rise 36, sustained 30 or more: only the last reading reached it, so it isn't known whether it lasted\./);
  const mid = summaryText(reportModel(upsertTest(fixture(), TEST({ up: [{ min: 1, hr: 80 }, { min: 3, hr: 100 }, { min: 5, hr: 90 }, { min: 10, hr: 92 }] })), base()));
  assert.match(mid, /largest rise 32, sustained 30 or more: one reading reached it and the next was lower\./);
  for (const t of [last, mid]) assert.ok(!POTS_BANNED.test(t), t);
});

/* ---------- pdf.js ---------- */
test("g: winAnsi maps symbols, keeps WinAnsi punctuation and drops emoji", () => {
  assert.equal(winAnsi("≥30 ≤5 → ≈ ✓ ×"), ">=30 <=5 -> ~ yes x");
  assert.equal(winAnsi("½ ¼ – — · ° ' \""), "½ ¼ \x96 \x97 · ° ' \"");
  assert.equal(winAnsi("“hi” …"), "\x93hi\x94 \x85");
  assert.equal(winAnsi("ok 😀👍🏽 done"), "ok  done");
  assert.equal(winAnsi("日本"), "??");
  assert.equal(winAnsi("a\tb\nc"), "a b c");
  assert.ok(pdfLossy("日本") && pdfLossy("ok 😀") && !pdfLossy("café ≥ 30 – ¼"));
});

test("g: textWidth matches the Adobe metrics and wrap stays inside its box", () => {
  // Reference widths at 10 pt from the Adobe Core14 AFM files (computed with reportlab's metrics).
  const a = "Lying: 68. Highest standing: 104 at minute 10 – rise >= 30 · café ¼ tsp", b = "POTS log summary — Oct 8, 2026 (WAVE) “quoted” …";
  assert.ok(Math.abs(textWidth(a, 10, false) - 310.74) < 0.5);
  assert.ok(Math.abs(textWidth(a, 10, true) - 329.02) < 0.5);
  assert.ok(Math.abs(textWidth(b, 10, false) - 246.19) < 0.5);
  assert.ok(Math.abs(textWidth(b, 10, true) - 258.95) < 0.5);
  const long = "Your heart rate went up by 36 beats a minute and stayed up at minutes 5 and 10. Supercalifragilisticexpialidocious-and-even-longer-word-here";
  for (const [w, size, bold] of [[120, 9, false], [80, 10, true], [40, 8, false]]) {
    const lines = wrapLines(long, w, size, bold);
    assert.ok(lines.length > 1);
    for (const l of lines) assert.ok(textWidth(l.replace(/[\x80-\xff]/g, "?"), size, bold) <= w + 0.01, `"${l}" fits ${w}`);
  }
});

test("g: the PDF file: header, valid xref offsets, deterministic bytes", () => {
  const m = reportModel(fixture(), base());
  const a = reportPdf(m, PdfDoc), b = reportPdf(m, PdfDoc);
  assert.deepEqual(a, b, "byte-identical over two runs");
  const s = Buffer.from(a).toString("latin1");
  assert.ok(s.startsWith("%PDF-1.4\n"));
  assert.ok(s.endsWith("%%EOF\n"));
  assert.ok(!/CreationDate|ModDate/.test(s));
  assert.ok(s.includes("/Title (Cyra report)"));
  const xrefAt = Number(/startxref\n(\d+)\n/.exec(s)[1]);
  assert.equal(s.slice(xrefAt, xrefAt + 4), "xref");
  const [, count] = /xref\n0 (\d+)\n/.exec(s.slice(xrefAt));
  const entries = s.slice(xrefAt).split("\n").slice(3, 2 + Number(count));
  entries.forEach((e, i) => { assert.equal(e.length, 19); const off = Number(e.slice(0, 10)); assert.equal(s.slice(off, off + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`); });
  for (const len of s.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
    const start = len.index + len[0].length;
    assert.equal(s.slice(start + Number(len[1]), start + Number(len[1]) + 10), "\nendstream");
  }
});

test("g: pdftotext reads the title, a reading and the footer", { skip: !existsSync("/usr/bin/pdftotext") }, () => {
  const dir = mkdtempSync(join(tmpdir(), "cyra-pdf-"));
  try {
    const m = reportModel(fixture(), base({ name: "Ada", include: { name: true } }));
    writeFileSync(join(dir, "r.pdf"), reportPdf(m, PdfDoc));
    const txt = execFileSync("/usr/bin/pdftotext", ["-layout", join(dir, "r.pdf"), "-"], { encoding: "utf8" });
    assert.match(txt, /POTS log summary · Ada · Sep 11 – Oct 10, 2026/);
    assert.match(txt, /10: 104/);
    assert.match(txt, /\+36/);
    assert.match(txt, /Sustained\s+[\s\S]*>=30/);
    assert.match(txt, /Page 1 of \d · Cyra · Observations, not a diagnosis\./);
    assert.match(txt, /Medicine names and times are as she entered them\. Cyra never suggests a medicine, a dose or a change\./);
    assert.ok(!txt.includes("SENTINEL_"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("g: a small PdfDoc table repeats its header on a new page", () => {
  const doc = new PdfDoc({ paper: "letter" });
  doc.page();
  const rows = Array.from({ length: 80 }, (_, i) => [`Row ${i}`, "x"]);
  const y = doc.table(40, 40, [{ label: "Name", w: 200 }, { label: "Value", w: 100 }], rows);
  assert.ok(doc.pages.length >= 2);
  assert.ok(y > 40 && y < doc.bottom + 1);
  const s = Buffer.from(doc.bytes()).toString("latin1");
  assert.equal((s.match(/\(Name\) Tj/g) || []).length, doc.pages.length);
  assert.ok(s.includes("/MediaBox [0 0 612 792]"));
});

test("source: report files make no network or storage call", () => {
  for (const f of ["potsReport.js", "pdf.js", "files.js"]) {
    const text = readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
    for (const bad of ["fetch(", "apiPost", "apiGet", "contribute(", "localStorage", "sessionStorage", "indexedDB", "structuredClone", "XMLHttpRequest", "WebSocket", "sendBeacon"]) assert.ok(!text.includes(bad), `${f} contains ${bad}`);
    assert.ok(!/from\s+["'][^"']*\/(api|pulse|storage|notifications|wearables)\.js["']/.test(text), `${f} imports a networked or storage module`);
  }
  // pdf.js stays out of the main bundle: nothing imports it statically.
  for (const f of ["../components/pots/PotsReport.jsx", "./potsReport.js", "../App.jsx"]) {
    const text = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.ok(!/import\s[^;]*from\s+["'][^"']*\/pdf\.js["']/.test(text), `${f} imports pdf.js statically`);
  }
});
