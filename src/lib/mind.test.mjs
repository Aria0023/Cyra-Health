// calm R5: the Mind tab's pure logic (lib/mind.js) and its evidence register. Run: node --test src/lib/mind.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  MOODS, FEELING_IDS, cleanMoodDay, cleanMoodLog, setMoodDay, toggleFeeling, moodText, moodDone, NEEDS, NEED_IDS, PRACTICES, PRACTICE_IDS, SOURCES,
  FREE_PRACTICES, practicesFor, unlocked, sourcesOf, practiceSeconds, practiceAt, cleanPracticeLog, addRun, setHelped, runsOn, helpedIds, cleanPracticeFavs,
  toggleFav, needFrom, nextPractice, moodStrip, stripSentence, STRIP_MIN, moodByCycle, rowWords, SUPPORT_LINE, COMFORT_LINE, STRENGTH, RUNS_MAX, practiceOf,
} from "./mind.js";

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("mood check-in: five faces in words, clean days, tags in library order, levels 1–3", () => {
  assert.deepEqual(MOODS.map((m) => m.label), ["Very low", "Low", "Okay", "Good", "Very good"]);
  assert.deepEqual(cleanMoodDay({ mood: 6, tags: ["sad", "x", "calm"], energy: 0, fog: 3 }), { tags: ["calm", "sad"], fog: 3 });
  assert.deepEqual(cleanMoodDay(null), {});
  let log = setMoodDay({}, "2026-10-29", { mood: 2 });
  log = toggleFeeling(log, "2026-10-29", "tired");
  log = setMoodDay(log, "2026-10-29", { energy: 1 });
  assert.deepEqual(log, { "2026-10-29": { mood: 2, tags: ["tired"], energy: 1 } });
  assert.equal(moodText(log["2026-10-29"]), "Low · tired");
  log = toggleFeeling(setMoodDay(log, "2026-10-29", { mood: null, energy: null }), "2026-10-29", "tired");
  assert.deepEqual(log, {}, "an emptied day goes away");
  assert.equal(moodDone({}), false);
  assert.deepEqual(Object.keys(cleanMoodLog({ "2026-10-02": { mood: 3 }, "2026-10-01": { mood: 4 }, bad: { mood: 1 }, "2026-10-03": {} })), ["2026-10-01", "2026-10-02"]);
  assert.ok(FEELING_IDS.length >= 8);
});

test("library: five needs, every practice in at least one, 2–5 minutes, 4–5 free, each with an evidence line and a support or comfort line", () => {
  assert.deepEqual(NEEDS.map((n) => n.label), ["Feel calmer", "Ease worry", "Clear brain fog", "Lift low energy", "Wind down & rest"]);
  for (const n of NEED_IDS) assert.ok(practicesFor(n).length >= 2, n);
  assert.ok(FREE_PRACTICES.length >= 4 && FREE_PRACTICES.length <= 5, FREE_PRACTICES.join());
  for (const n of NEED_IDS) assert.ok(practicesFor(n).some((p) => p.free), `a free practice for ${n}`);
  for (const p of PRACTICES) {
    assert.ok(p.min >= 2 && p.min <= 5, p.id);
    assert.ok(p.needs.length && p.needs.every((n) => NEED_IDS.includes(n)), p.id);
    assert.ok(p.evidence.length > 40 && STRENGTH[p.strength], p.id);
    assert.ok(p.line === SUPPORT_LINE || p.line === COMFORT_LINE, p.id);
    if (p.strength === "comfort") assert.equal(p.line, COMFORT_LINE, `${p.id}: comfort-strength practices say so`);
    else assert.ok(p.src.length > 0 && sourcesOf(p).length === p.src.length, `${p.id}: a named source`);
    for (const s of sourcesOf(p)) assert.ok(s.title && s.body && Number.isInteger(s.year) && s.year >= 1990, `${p.id}: title, authors and journal, year`);
    const secs = practiceSeconds(p);
    assert.ok(secs >= p.min * 60 - 30 && secs <= p.min * 60 + 30, `${p.id}: ${secs}s for ${p.min} min`);
  }
  assert.equal(new Set(PRACTICE_IDS).size, PRACTICE_IDS.length);
});

test("wording: no diagnosis, cure or treatment claims, no PCOS claim, no streaks or scores", () => {
  const words = PRACTICES.flatMap((p) => [p.title, p.short, p.evidence, p.caution || "", ...(p.steps || []).map((s) => s.text)]).join("\n");
  for (const bad of [/diagnos/i, /\bcures?\b/i, /\btreats?\b/i, /\bheals?\b/i, /streak/i, /\bscore/i, /out of 100/i, /PCOS/i, /perfect/i, /fail/i]) assert.ok(!bad.test(words), String(bad));
  assert.ok(!/treatment/i.test(words.replace(/cognitive behavioural therapy for insomnia|therapy/g, "")), "only the support line says 'treatment'");
});

test("evidence register: every practice's evidence text and sources are in docs/EVIDENCE.md and docs/CLINICIAN-REVIEW.md", () => {
  const ev = read("docs/EVIDENCE.md"), cr = read("docs/CLINICIAN-REVIEW.md");
  for (const p of PRACTICES) {
    assert.ok(ev.includes(p.evidence), `EVIDENCE.md: ${p.id}`);
    assert.ok(cr.includes(`### mind.practice.${p.id}`) && cr.includes(p.evidence), `CLINICIAN-REVIEW.md: ${p.id}`);
    if (p.caution) assert.ok(cr.includes(p.caution), `caution of ${p.id}`);
    for (const s of sourcesOf(p)) { assert.ok(ev.includes(s.title), `EVIDENCE.md source ${s.title}`); assert.ok(cr.includes(s.title), `review source ${s.title}`); }
  }
  for (const k of Object.keys(SOURCES)) assert.ok(PRACTICES.some((p) => p.src.includes(k)), `${k} is cited`);
  assert.ok(ev.includes("PubMed connector was unavailable"), "the register says how sources were checked");
  assert.ok(cr.includes("Practices are wellbeing support, not treatment. If low mood or worry is staying with you"), "the footer sentence is listed");
});

test("practiceAt: breath phases and steps, done at the end", () => {
  const slow = practiceOf("slow");
  assert.deepEqual([0, 3.9, 4, 9.9, 10].map((t) => practiceAt(slow, t).phase), ["in", "in", "out", "out", "in"]);
  assert.equal(practiceAt(slow, 0).left, 4);
  assert.equal(practiceAt(slow, 4.2).left, 6);
  assert.equal(practiceAt(slow, practiceSeconds(slow)).done, true);
  const box = practiceOf("box");
  assert.deepEqual([0, 4, 8, 12].map((t) => practiceAt(box, t).word), ["Breathe in", "Hold", "Breathe out", "Hold"]);
  const g = practiceOf("ground");
  assert.equal(practiceAt(g, 0).idx, 0);
  assert.equal(practiceAt(g, 25).idx, 1);
  assert.match(practiceAt(g, 26).text, /four things/);
  assert.equal(practiceAt(g, -5).idx, 0);
});

test("practice log: runs, Which one helped?, today's list, favourites", () => {
  let log = addRun([], { id: "a", p: "slow", day: "2026-10-29", sec: 180.4, done: true });
  log = addRun(log, { id: "b", p: "ground", day: "2026-10-29", sec: 30, done: false });
  log = addRun(log, { id: "c", p: "slow", day: "2026-10-28", sec: 180, done: true });
  log = setHelped(log, "a", "yes");
  assert.deepEqual(log[0], { id: "a", p: "slow", day: "2026-10-29", sec: 180, done: true, helped: "yes" });
  assert.deepEqual(runsOn(log, "2026-10-29").map((r) => r.id), ["a", "b"]);
  assert.deepEqual(helpedIds(log), ["slow"]);
  assert.equal("helped" in setHelped(log, "a", null)[0], false);
  assert.deepEqual(cleanPracticeLog([{ id: "x", p: "nope", day: "2026-10-01" }, { id: "y", p: "box", day: "2026-10-01", sec: -1, helped: "maybe" }]), [{ id: "y", p: "box", day: "2026-10-01", sec: 0, done: false }]);
  const many = Array.from({ length: RUNS_MAX + 5 }, (_, i) => ({ id: `r${i}`, p: "slow", day: "2026-10-01", sec: 1, done: true }));
  assert.equal(cleanPracticeLog(many).length, RUNS_MAX);
  assert.equal(cleanPracticeLog(many)[0].id, "r5", "the newest are kept");
  assert.deepEqual(toggleFav(toggleFav([], "winddown"), "slow"), ["slow", "winddown"]);
  assert.deepEqual(toggleFav(["slow"], "slow"), []);
  assert.deepEqual(cleanPracticeFavs(["x", "box", "box"]), ["box"]);
});

test("your next practice: from today's check-in, unlocked only, preferring what helped", () => {
  assert.equal(needFrom({ fog: 3 }, 10).need, "fog");
  assert.equal(needFrom({ tags: ["anxious"] }, 10).need, "worry");
  assert.equal(needFrom({ mood: 1 }, 10).need, "low");
  assert.equal(needFrom({ energy: 1 }, 10).need, "energy");
  assert.equal(needFrom({ mood: 4 }, 22).need, "rest");
  assert.equal(needFrom({}, 10).need, "calm");
  assert.equal(nextPractice({ day: { mood: 1 }, hour: 10 }).practice.id, "step");
  assert.equal(nextPractice({ day: { mood: 1 }, hour: 10 }).need, "energy");
  assert.equal(nextPractice({ day: { tags: ["anxious"] }, hour: 10 }).practice.id, "ground");
  assert.equal(nextPractice({ day: { fog: 3 }, hour: 10 }).practice.id, "move");
  assert.equal(nextPractice({ day: {}, hour: 23 }).practice.id, "winddown");
  // A locked practice she marked helpful is skipped on the free plan and preferred with Pro.
  const log = setHelped(addRun([], { id: "a", p: "reframe", day: "2026-10-28", sec: 200, done: true }), "a", "yes");
  assert.equal(nextPractice({ day: { tags: ["anxious"] }, hour: 10, log }).practice.id, "ground");
  assert.equal(nextPractice({ day: { tags: ["anxious"] }, hour: 10, log, canFull: true }).practice.id, "reframe");
  for (const d of [{}, { mood: 1 }, { fog: 3 }, { tags: ["overwhelmed"] }, { energy: 1 }]) for (const h of [3, 10, 22]) assert.ok(unlocked(nextPractice({ day: d, hour: h }).practice, false));
});

test("mood across the cycle: rows by cycle day, words not scores, the empty line under five check-ins", () => {
  const rows = moodByCycle({ "2026-10-20": { mood: 2 }, "2026-10-21": { mood: 5 } }, ["2026-08-28", "2026-09-25", "2026-10-19"], "2026-10-29");
  assert.deepEqual(rows.map((r) => r.label), ["This cycle", "Last cycle", "The cycle before"]);
  assert.equal(rows[0].days.length, 11);
  assert.deepEqual(rows[0].days.slice(0, 3).map((d) => [d.cd, d.mood]), [[1, null], [2, 2], [3, 5]]);
  assert.equal(rows[1].days.length, 24);
  assert.equal(rowWords(rows[0]), "2 check-ins: 1 lighter, 1 lower.");
  assert.equal(rowWords(rows[1]), "No check-ins yet.");
  const recent = moodByCycle({}, [], "2026-10-29");
  assert.equal(recent.length, 1); assert.equal(recent[0].label, "Last 5 weeks"); assert.equal(recent[0].days.length, 35);
  const strip = moodStrip({ "2026-10-29": { mood: 4 } }, [], "2026-10-29", 35);
  assert.equal(strip.length, 35); assert.equal(strip[34].mood, 4);
  assert.equal(stripSentence(strip, "EMPTY"), "EMPTY");
  const full = moodStrip(Object.fromEntries(["25", "26", "27", "28", "29"].map((d, i) => [`2026-10-${d}`, { mood: i + 1 }])), [], "2026-10-29", 35);
  assert.equal(full.filter((d) => d.mood != null).length, STRIP_MIN);
  assert.equal(stripSentence(full, "EMPTY"), "5 check-ins in the last 35 days: 2 lighter, 2 lower, the rest in between.");
  assert.ok(!/\d+\s*(%|\/\s*100|points?)/.test(stripSentence(full, "")));
});
