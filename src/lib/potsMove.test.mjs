/* Unit tests for POTS movement (lib/potsMove.js), design 10 S7 and 11.1 c3: the gates (pacing
   mode, the clearance answer, the separate prenatal-team answer), the ready / hold / ease-off
   options, session faints (linked episode + step-up pause), the next-day answer, and the
   report's Movement section, CSV rows and summary line (lib/potsReport.js). Run with
   `npm run test:unit` (node --test, no dependencies). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { freshEmpty, cleanPots, addSession, setSessionFaint, addEpisode, resetPregClearance, mergePots, nearFaintDays, localDay } from "./pots.js";
import {
  moveState, moveOption, setProgram, clearFaintPause, setNextDay, skipNextDay, nextDayPending, deleteSession, planLine, progress,
  weeklyCounts, sessionDefaults, allSessions, hasMoveData, planWeek, leftWorse, wentOkay, MOVE_COPY, MOVE_STEPS, weekdayOf,
} from "./potsMove.js";
import { reportModel, toCSV, summaryText, modelTexts, visitQuestions, questionIn } from "./potsReport.js";
import { POTS_BANNED } from "./potsConstants.js";

const TODAY = "2026-10-10"; // a Saturday
const add = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return localDay(new Date(y, m - 1, d + n)); };
const ago = (n) => add(TODAY, -n);
const on = () => ({ ...freshEmpty(), on: true, epoch: "e1", epochAt: 1, since: ago(80) });
const clean = (s, where) => assert.ok(!POTS_BANNED.test(s), `banned wording in ${where}: ${s}`);
let n = 0;
/** A session `daysAgo` days back (step, after, next as given). */
const ses = (p, daysAgo, x = {}) => addSession(p, ago(daysAgo), { id: `s${++n}`, t: "17:00", mode: "recumbent_bike", step: 1, warm: 5, main: 12, cool: 5, guided: true, stopped: false, effort: 4, after: 0, worse: [], faint: null, next: "same", ...x });
/** A program answered and cleared, started `startAgo` days back. */
const cleared = (p, extra = {}, startAgo = 40) => setProgram(setProgram(p, { pem: "no", cleared: "yes", ...extra }, ago(startAgo)), {}, ago(startAgo));

test("S7: the gates — PEM first, pacing mode, the clearance answer and the step-up pause", () => {
  let p = on();
  let st = moveState(p, "peri");
  assert.deepEqual([st.asked, st.planShown, st.stepUps, st.program], [false, false, false, null], "nothing answered: no plan");
  for (const pem of ["yes", "unsure"]) {
    st = moveState(setProgram(p, { pem, cleared: "yes" }, TODAY), "peri");
    assert.ok(st.pacing && !st.planShown && !st.stepUps, `PEM ${pem}: pacing mode, no plan and no step-up even with a clinician's yes`);
  }
  p = setProgram(p, { pem: "no" }, TODAY);
  st = moveState(p, "peri");
  assert.ok(st.asked && !st.pacing && !st.planShown, "PEM no, clearance not answered yet: the question comes first");
  for (const c of ["later", "anyway"]) {
    st = moveState(setProgram(p, { cleared: c }, TODAY), "peri");
    assert.ok(st.planShown && !st.stepUps, `clearance "${c}": the plan shows, no step-up option`);
  }
  p = setProgram(p, { cleared: "yes" }, TODAY);
  assert.ok(moveState(p, "peri").stepUps, "a clinician's yes: options can show");
  assert.equal(p.move.program.clearedOn, TODAY, "the day she answered is kept");
  const paused = { ...p, move: { ...p.move, faintPause: TODAY } };
  assert.ok(!moveState(paused, "peri").stepUps && moveState(paused, "peri").planShown, "after an exercise faint: plan stays, options pause");
  assert.ok(moveState(clearFaintPause(paused), "peri").stepUps, "\"I've been checked\" lets them show again");
  assert.equal(clearFaintPause(p), p, "nothing to clear: the same object");
});

test("S7: pregnancy uses its own prenatal-team answer; a pre-pregnancy yes unlocks nothing", () => {
  let p = cleared(on());
  assert.ok(moveState(p, "peri").stepUps);
  let st = moveState(p, "preg");
  assert.ok(!st.planShown && !st.stepUps && st.answer === null, "in pregnancy the non-pregnancy yes is ignored: no plan, no options");
  for (let i = 0; i < 6; i++) p = ses(p, 2 + i * 3);
  assert.equal(moveOption(p, { stage: "preg", today: TODAY }), null, "no step-up option either");
  assert.equal(planLine({ ...p, move: { ...p.move, program: { ...p.move.program, days: [weekdayOf(TODAY)] } } }, { stage: "preg", day: TODAY }), null, "no plan line in Today's plan");
  p = setProgram(p, { clearedPreg: "later" }, TODAY);
  assert.ok(!moveState(p, "preg").planShown, "\"I'll ask first\": still no plan");
  p = setProgram(p, { clearedPreg: "yes" }, TODAY);
  st = moveState(p, "preg");
  assert.ok(st.planShown && st.stepUps && p.move.program.clearedPregOn === TODAY, "the prenatal team's yes shows the plan and options");
  p = resetPregClearance(p);
  assert.ok(!moveState(p, "preg").planShown, "a change of stage into Pregnancy asks again");
  assert.equal(p.move.program.cleared, "yes", "the non-pregnancy answer stays for later");
});

test("S7: ready — 6 sessions at the step over 14 days, 80% okay; never automatic", () => {
  let p = cleared(on());
  for (const d of [20, 17, 14, 11, 9]) p = ses(p, d);
  assert.equal(moveOption(p, { today: TODAY }), null, "5 sessions: nothing (never nags)");
  p = ses(p, 7);
  const r = moveOption(p, { today: TODAY });
  assert.equal(r.kind, "ready");
  assert.equal(r.next, 2);
  assert.equal(r.copy, "This step seems to be going okay. Options for next time: stay here, add a couple of minutes, or try Step 2. Check with your clinician or physio if you're unsure.");
  assert.equal(p.move.program.step, 1, "the option never changes her step by itself");
  // Over at least 14 days: 6 sessions within 13 days is not enough.
  let q = cleared(on());
  for (const d of [13, 11, 9, 7, 5, 1]) q = ses(q, d);
  assert.equal(moveOption(q, { today: TODAY }), null, "6 sessions over 13 days: nothing");
  q = ses(q, 14);
  assert.equal(moveOption(q, { today: TODAY }).kind, "ready", "7 sessions over 14 days: ready");
  // 80%: 2 of 6 not okay is 67%.
  let w = cleared(on());
  for (const [d, x] of [[20, {}], [17, { after: 1 }], [14, {}], [11, { next: "worse" }], [9, { next: "crash" }], [7, { next: null }]]) w = ses(w, d, x);
  assert.equal(moveOption(w, { today: TODAY }), null, "4 of 6 okay: nothing");
  // Missing is not zero: a session with no after-rating doesn't count as okay; an unanswered next day does.
  assert.equal(wentOkay({ after: null, next: "same" }), false);
  assert.equal(wentOkay({ after: 1, next: null }), true);
  assert.equal(wentOkay({ after: 0, next: "crash" }), false);
  // Sessions at an earlier step, or before she chose this step, don't count.
  let s2 = cleared(on());
  for (const d of [30, 27, 24, 21, 18, 15]) s2 = ses(s2, d);
  s2 = setProgram(s2, { step: 2 }, ago(10));
  assert.equal(s2.move.program.stepOn, ago(10));
  assert.equal(moveOption(s2, { today: TODAY }), null, "Step 1 sessions don't make Step 2 ready");
  for (const d of [9, 7, 5, 3, 1]) s2 = ses(s2, d, { step: 2 });
  assert.equal(moveOption(s2, { today: TODAY }), null, "5 at Step 2 over 9 days: nothing yet");
  // Step 4 has no step 5.
  let s4 = setProgram(cleared(on()), { step: 4 }, ago(40));
  for (const d of [30, 27, 24, 21, 18, 15]) s4 = ses(s4, d, { step: 4 });
  assert.equal(moveOption(s4, { today: TODAY }), null);
});

test("S7: hold and ease off, and the order ease off > hold > ready", () => {
  let p = cleared(on());
  for (const d of [20, 17, 14, 11, 9, 7]) p = ses(p, d);
  const h = ses(p, 1, { next: "worse" });
  assert.deepEqual([moveOption(h, { today: TODAY }).kind, moveOption(h, { today: TODAY }).copy], ["hold", "Yesterday was harder. Many people repeat the same session until it sits well."]);
  const h2 = ses(p, 3, { next: "worse" });
  assert.equal(moveOption(h2, { today: TODAY }).copy, MOVE_COPY.holdOlder, "a session from days ago isn't called \"yesterday\"");
  // Ease off: 2 sessions within 7 days left her worse (next worse/crash or after >= 2).
  let e = setProgram(p, { step: 2 }, ago(30));
  e = ses(e, 4, { step: 2, after: 2, next: "same" });
  e = ses(e, 2, { step: 2, next: "crash" });
  let r = moveOption(e, { today: TODAY });
  assert.deepEqual([r.kind, r.copy, r.back], ["ease", MOVE_COPY.ease, 1], "the last two sessions left her worse");
  e = ses(e, 1, { step: 2, after: 0, next: null });
  r = moveOption(e, { today: TODAY });
  assert.deepEqual([r.kind, r.copy], ["ease", MOVE_COPY.easeSome], "not the last two: the copy says two in the last week");
  const old = ses(ses(p, 9, { after: 3 }), 8, { next: "worse" });
  assert.notEqual(moveOption(old, { today: TODAY })?.kind, "ease", "8 and 9 days ago aren't within 7 days");
  // Ease beats hold: two worse within the week, the latest worse next day.
  const both = ses(ses(p, 3, { after: 2 }), 1, { next: "worse" });
  assert.equal(moveOption(both, { today: TODAY }).kind, "ease");
  assert.equal(moveOption(both, { today: TODAY }).back, null, "Step 1: no step back button");
  assert.ok(leftWorse({ after: 3 }) && leftWorse({ next: "crash" }) && !leftWorse({ after: 1, next: "same" }));
  // None of them in pacing mode, while paused, or without the yes.
  for (const [x, why] of [[setProgram(both, { pem: "yes" }, TODAY), "pacing mode"], [{ ...both, move: { ...both.move, faintPause: TODAY } }, "faint pause"], [setProgram(both, { cleared: "anyway" }, TODAY), "no clinician's yes"]]) {
    assert.equal(moveOption(x, { today: TODAY }), null, `no options: ${why}`);
  }
});

test("S7 / c3: a session faint logs one linked exercise episode and pauses step-ups; no double count", () => {
  let p = cleared(on());
  p = ses(p, 0, { id: "fx1" });
  p = setSessionFaint(p, TODAY, "fx1", "almost", "17:20");
  let eps = p.days[TODAY].eps;
  assert.equal(eps.length, 1);
  assert.deepEqual([eps[0].src, eps[0].pos, eps[0].faint, eps[0].sym, eps[0].t], ["fx1", "exercise", "almost", ["p_psy"], "17:20"]);
  assert.equal(p.move.faintPause, TODAY);
  assert.equal(moveState(p, "peri").stepUps, false);
  p = setSessionFaint(p, TODAY, "fx1", "yes");
  eps = p.days[TODAY].eps;
  assert.deepEqual([eps.length, eps[0].faint, eps[0].sev], [1, "yes", 3], "changing the answer updates the same episode");
  assert.equal(nearFaintDays(setSessionFaint(p, TODAY, "fx1", "almost"), TODAY), 1, "a session near-faint counts towards the near-faint advice");
  // Discarding the session keeps the faint unless she unticks it.
  assert.equal(deleteSession(p, TODAY, "fx1").days[TODAY].eps.length, 1);
  const gone = deleteSession(p, TODAY, "fx1", { keepFaint: false });
  assert.ok(!gone.days[TODAY].eps && !gone.days[TODAY].move && gone.gone.includes("fx1"), "session and its faint go, tombstoned");
  assert.equal(deleteSession(p, TODAY, "nope"), p);
  // The report lists it once, as an exercise faint from a session.
  const m = reportModel(p, { today: TODAY, stage: "peri" });
  const mv = m.sections.find((s) => s.id === "move");
  assert.ok(mv.blocks.some((b) => b.text === `Faints or near-faints during exercise: 1 (Oct 10, fainted).`));
  const faintRows = m.sections.find((s) => s.id === "sym").blocks.find((b) => b.caption === "Faints and near-faints").rows;
  assert.deepEqual(faintRows.map((r) => r[6]), ["Exercise session"]);
});

test("S7: the next-day question — pending, answered, skipped", () => {
  let p = cleared(on());
  p = ses(p, 1, { id: "y1", next: null });
  p = ses(p, 1, { id: "y2", t: "18:00", next: null });
  p = ses(p, 2, { id: "o1", next: null });
  assert.deepEqual(nextDayPending(p, TODAY).map((x) => x.id), ["y1", "y2"], "only yesterday's sessions, not older ones");
  const a = setNextDay(p, ago(1), ["y1", "y2"], "worse");
  assert.deepEqual(a.days[ago(1)].move.map((x) => x.next), ["worse", "worse"]);
  assert.deepEqual(nextDayPending(a, TODAY), []);
  const s = skipNextDay(p, ago(1), ["y1", "y2"]);
  assert.deepEqual(nextDayPending(s, TODAY), [], "Skip: not asked again");
  assert.deepEqual(s.days[ago(1)].move.map((x) => x.next), [null, null], "a skip is not an answer");
  assert.deepEqual(cleanPots(s), cleanPots(cleanPots(s)), "the skip survives the sanitizer (idempotent)");
  const back = setNextDay(s, ago(1), ["y1"], "better");
  assert.equal(back.days[ago(1)].move[0].nextSkip, undefined, "answering later replaces the skip");
});

test("S7: setProgram — created on the first answer, ranges, step day; locked records untouched", () => {
  let p = setProgram(on(), { pem: "no" }, TODAY);
  assert.deepEqual(p.move.program, { cleared: null, clearedOn: null, clearedPreg: null, clearedPregOn: null, pem: "no", step: 1, start: TODAY, stepOn: TODAY, days: [], mainMin: null, hrNote: "" });
  assert.equal(p.move.program.mainMin, null, "the main part stays blank until she enters it (D9)");
  p = setProgram(p, { mainMin: 4, days: [5, 1, 1, 9], hrNote: `  ${"x".repeat(130)} `, step: 7, start: "2020-01-01", bogus: 1 }, TODAY);
  assert.deepEqual([p.move.program.mainMin, p.move.program.days, p.move.program.hrNote.length, p.move.program.step, p.move.program.start, p.move.program.bogus], [null, [1, 5], 120, 1, TODAY, undefined]);
  p = setProgram(p, { mainMin: 15, cleared: "yes" }, TODAY);
  p = setProgram(p, { cleared: null }, ago(-1));
  assert.deepEqual([p.move.program.mainMin, p.move.program.cleared, p.move.program.clearedOn], [15, null, null]);
  assert.deepEqual(cleanPots(p).move.program, cleanPots(cleanPots(p)).move.program, "the sanitizer keeps the plan as set");
  const locked = { v: 2, move: {} };
  for (const fn of [(x) => setProgram(x, { pem: "no" }, TODAY), clearFaintPause, (x) => setNextDay(x, TODAY, ["a"], "same"), (x) => skipNextDay(x, TODAY, ["a"]), (x) => deleteSession(x, TODAY, "a")]) assert.equal(fn(locked), locked);
  assert.equal(setProgram(on(), { pem: "no" }, "not a day").move.program, null);
});

test("S7: plan line, progress, weekly counts, session defaults", () => {
  let p = cleared(on(), {}, 20);
  assert.equal(planLine(p, { stage: "peri", day: TODAY }), null, "no days chosen: no line");
  p = setProgram(p, { days: [weekdayOf(TODAY)] }, TODAY);
  assert.equal(planLine(p, { stage: "peri", day: TODAY }), "Movement: Step 1 session today");
  assert.equal(planLine(p, { stage: "peri", day: ago(1) }), "Rest day. Rest is part of the plan.");
  assert.equal(planLine(setProgram(p, { pem: "yes" }, TODAY), { stage: "peri", day: TODAY }), null, "pacing mode: no plan line");
  assert.equal(planWeek(p.move.program, TODAY), 3, "day 20 of the plan is week 3");
  p = ses(ses(p, 15, { main: 18 }), 3, { main: 10 });
  p = ses(p, 30, { main: 40 }); // before the plan started: not in the plan's progress
  assert.equal(progress(p, TODAY).text, "Step 1 · week 3 of your plan · 2 sessions · longest main part 18 min");
  const w = weeklyCounts(ses(p, 1, { next: "crash" }), TODAY);
  assert.equal(w.length, 8);
  assert.deepEqual(w.slice(-3).map((x) => [x.n, x.crash]), [[1, 0], [0, 0], [2, 1]]);
  assert.equal(w[7].to, TODAY);
  assert.deepEqual(sessionDefaults(on()), { mode: null, warm: 5, main: null, cool: 5 }, "no plan length and no session: the main part is blank");
  const d = sessionDefaults(ses(ses(setProgram(p, { mainMin: 20 }, TODAY), 0, { mode: "swim", warm: 3, cool: 4, main: 11 }), 0, { id: "st", t: "18:00", mode: "rowing", stopped: true, warm: 1, main: 0, cool: 0 }));
  assert.deepEqual(d, { mode: "rowing", warm: 3, main: 20, cool: 4 }, "her plan's main part; warm-up and cool-down from her last full session");
  assert.equal(allSessions(p).length, 3);
  assert.ok(hasMoveData(p) && !hasMoveData(on()));
});

test("S7: a session merges across tabs, and a next-day answer in one tab survives the other", () => {
  const base = cleanPots(ses(cleared(on()), 1, { id: "m1", next: null }));
  const a = setNextDay(base, ago(1), ["m1"], "worse");
  const b = ses(base, 0, { id: "m2" });
  const m = mergePots(a, b, base);
  assert.deepEqual(allSessions(m).map((x) => [x.id, x.next]), [["m1", "worse"], ["m2", "same"]]);
  const c = setProgram(base, { step: 2 }, TODAY);
  assert.equal(mergePots(c, b, base).move.program.step, 2, "a step change in the other tab is kept");
});

test("S7 report: the Movement section, CSV session rows and the summary line", () => {
  let p = cleared(on(), { days: [1, 3, 5], mainMin: 15, hrNote: "110-130 per physio" }, 30);
  p = ses(p, 20, { worse: ["p_dzy"], after: 1, next: "worse" });
  p = ses(p, 10, { mode: "walk", main: 8, after: 2, next: "crash", worse: ["p_dzy", "p_fat"] });
  p = ses(p, 3, { guided: false, stopped: true, after: 3, next: null, effort: 7 });
  const opts = { today: TODAY, stage: "peri", stageName: "Perimenopause" };
  let m = reportModel(p, opts);
  assert.equal(m.inc.move, true, "Movement is included when she has sessions");
  const sec = m.sections.find((s) => s.id === "move");
  const texts = sec.blocks.filter((b) => b.t === "p").map((b) => b.text);
  assert.ok(texts.includes("Often crashes 12 to 72 hours after effort, for a day or more (her answer): no."));
  assert.ok(texts.includes("OK from a clinician or physio to start an exercise plan (her answer): yes (Sep 10, 2026)."));
  assert.ok(texts.includes("Her step in Cyra's plan, which she chooses herself: Step 1 (lying and seated start), week 5 of her plan. Planned days: Mon, Wed, Fri. Main part she set: 15 min."));
  assert.ok(texts.includes("Sessions in this period: 3 (2 with Cyra's timer, 1 stopped early). Main part: 32 min in all, longest 12 min; warm-up and cool-down 30 min."));
  assert.ok(texts.includes("Lying or seated: 2 · upright: 1 · other: 0 (recumbent bike 2, walking 1)."));
  assert.ok(texts.includes("How she felt right after: fine 0, a bit worse 1, much worse 1, had to stop 1, not answered 0."));
  assert.ok(texts.includes("How she felt the next day: better 0, the same 0, worse 1, crashed 1, not answered 1."));
  assert.ok(texts.includes("Symptoms that got worse after a session: Dizzy or lightheaded (2), Fatigue (1)."));
  assert.ok(texts.includes("No faint or near-faint during exercise was logged in this period."));
  assert.ok(!texts.some((t) => t.includes("110-130")), "the heart-rate range she typed goes in only with notes");
  assert.ok(sec.blocks.some((b) => b.t === "weeks" && b.weeks.length === 4 && b.weeks.reduce((a, w) => a + w.n, 0) === 3), "sessions per week: the 4 whole weeks of the 30 days");
  assert.ok(sec.blocks.find((b) => b.t === "weeks").label.startsWith("Exercise sessions per week, "));
  assert.deepEqual(m.sections.map((s) => s.id).slice(0, 5), ["tests", "sym", "fluid", "meds", "move"], "Movement comes after Medicines");
  assert.ok(summaryText(m).includes("- Exercise sessions in the last 30 days: 3"));
  for (const t of modelTexts(m)) clean(t, "report text");
  const csv = toCSV(m);
  const rows = csv.split("\r\n").filter((l) => l.startsWith('"session"'));
  assert.equal(rows.length, 3);
  assert.ok(rows[1].startsWith(`"session","${ago(10)}","17:00","walk",8,"min",`) && rows[1].includes("after=much_worse; next=crash; worse=Dizzy or lightheaded, Fatigue; stopped=no"), rows[1]);
  assert.ok(rows[2].includes("guided=no; effort=7; after=had_to_stop") && rows[2].includes("stopped=yes"));
  // With notes: the heart-rate range she noted.
  m = reportModel(p, { ...opts, include: { notes: true } });
  assert.ok(modelTexts(m).includes("Heart-rate range she noted from her clinician or physio: 110-130 per physio"));
  // Movement unticked: no section, no session rows, no summary line, no exercise questions.
  const q = setProgram(p, { cleared: "later", pem: "unsure" }, TODAY);
  m = reportModel(q, { ...opts, include: { move: false } });
  assert.ok(!m.sections.some((s) => s.id === "move") && !toCSV(m).includes('"session"') && !summaryText(m).includes("Exercise sessions"));
  assert.ok(!modelTexts(m).some((t) => /exercise plan|post-exertional/.test(t)), "the exercise and PEM questions stay out of the files");
  const gen = visitQuestions(q, { stage: "peri" });
  assert.deepEqual(gen.filter((x) => x.part === "move").map((x) => x.id), ["q_pem"], "pacing mode: PEM question, no clearance question (no plan in pacing mode)");
  assert.ok(gen.filter((x) => x.part === "move").every((x) => !questionIn(x, { move: false, cycle: true }) && questionIn(x, { move: true, cycle: true })));
  m = reportModel(q, opts);
  assert.ok(modelTexts(m).includes("Often crashes 12 to 72 hours after effort, for a day or more (her answer): not sure. Cyra's pacing mode is on for her: it shows no step-up options."));
  assert.ok(!modelTexts(m).some((t) => t.startsWith("Her step")), "pacing mode: no step line");
  // Nothing to report: off by default, and the summary has no line.
  m = reportModel(on(), opts);
  assert.equal(m.inc.move, false);
  assert.ok(!summaryText(m).includes("Exercise sessions"));
});

test("S7 report: exercise faints and the pregnancy answer follow the Include boxes", () => {
  let p = cleared(on());
  p = setProgram(p, { clearedPreg: "yes" }, ago(5));
  p = ses(p, 4, { id: "f1" });
  p = setSessionFaint(p, ago(4), "f1", "almost");
  p = addEpisode(p, ago(2), { id: "e1", t: "10:00", sym: ["p_dzy"], pos: "exercise", faint: "yes", sev: 3 });
  const base = { today: TODAY, stage: "preg", stageName: "Pregnancy" };
  let t = modelTexts(reportModel(p, base));
  assert.ok(t.includes(`Faints or near-faints during exercise: 2 (${"Oct 6"}, almost fainted; Oct 8, fainted).`), "with symptoms: every exercise faint from her episodes");
  assert.ok(t.some((x) => x.startsWith("OK from her prenatal team to start an exercise plan (her answer): yes")) && !t.some((x) => x.startsWith("OK from a clinician")));
  t = modelTexts(reportModel(p, { ...base, include: { sym: false } }));
  assert.ok(t.includes("Faints or near-faints during exercise: 1 (Oct 6, almost fainted)."), "without symptoms: only the sessions' own answers");
  t = modelTexts(reportModel(p, { ...base, include: { cycle: false } }));
  assert.ok(!t.some((x) => /prenatal|Her step/.test(x)), "without cycle details: no prenatal-team answer and no plan line in pregnancy");
});

test("S7: every Move string is free of banned wording; no network or storage in the Move code", () => {
  const strings = [...Object.values(MOVE_COPY).flatMap((v) => (typeof v === "function" ? [v(2), v(4)] : Array.isArray(v) ? v : [v])), ...MOVE_STEPS.flatMap((s) => [s.name, s.acts, s.pattern])];
  for (const s of strings) clean(s, "MOVE_COPY");
  assert.ok(!strings.some((s) => /\b\d+\s?(mg|bpm)\b/.test(s)), "no dose or heart-rate target");
  for (const f of ["./potsMove.js", "../components/pots/MovePlan.jsx", "../components/pots/MoveSession.jsx"]) {
    const text = readFileSync(new URL(f, import.meta.url), "utf8");
    for (const bad of ["fetch(", "apiPost", "apiGet", "contribute(", "localStorage", "sessionStorage", "indexedDB", "structuredClone", "XMLHttpRequest", "WebSocket", "sendBeacon"]) assert.ok(!text.includes(bad), `${f} contains ${bad}`);
  }
});
