/* Unit tests for lib/mealPhoto.js (docs/plans/meal-photos.md): the downsizing maths, the request body, cleaning the
   AI's answer, what a meal note keeps, the words, and the guardrails on every sentence. Also: nothing that reads the
   log elsewhere (patterns, the AI summary, the appointment PDF) ever sees a food or a calorie figure. */
import test from "node:test";
import assert from "node:assert/strict";
import { PHOTO_MAX_SIDE, PHOTO_MAX_BYTES, EST_MAX_ITEMS, KCAL_MAX, fitWithin, base64Bytes, photoBody, bodyDataUrl, plainWords, cleanAnswer, cleanEst, totalOf, kcalRange, kcalRangeSaid, itemWords, dayTotal, mealPhotoOffer, mealCardState, cleanMealCardOff, slotForHour, MEAL_COPY, failLine } from "./mealPhoto.js";
import { cleanMeal, cleanBodyLog, addMeal, setMeal, bodyDay, mealCounts, mealReportLines, mealText, mealsText, mealDayWords } from "./bodylog.js";
import { mealCards } from "./patterns.js";
import { buildSummary } from "./aiSummary.js";
import { cleanAiPrefs } from "./aiFeatures.js";

test("fitWithin: the long side becomes at most 1024, the shape is kept, nothing is enlarged", () => {
  assert.equal(PHOTO_MAX_SIDE, 1024);
  assert.deepEqual(fitWithin(4032, 3024), { w: 1024, h: 768 });
  assert.deepEqual(fitWithin(3024, 4032), { w: 768, h: 1024 });
  assert.deepEqual(fitWithin(2048, 2048), { w: 1024, h: 1024 });
  assert.deepEqual(fitWithin(1024, 600), { w: 1024, h: 600 });
  assert.deepEqual(fitWithin(800, 600), { w: 800, h: 600 }, "never enlarged");
  assert.deepEqual(fitWithin(1025, 1), { w: 1024, h: 1 });
  assert.deepEqual(fitWithin(10000, 3), { w: 1024, h: 1 }, "never below one pixel");
  assert.deepEqual(fitWithin(1000.4, 500.6), { w: 1000, h: 501 });
  assert.deepEqual(fitWithin(5000, 2500, 500), { w: 500, h: 250 });
  for (const [w, h] of [[0, 10], [10, 0], [-5, 5], [NaN, 5], [Infinity, 5], ["x", 5], [undefined, undefined]]) assert.equal(fitWithin(w, h), null);
  for (const [w, h] of [[4032, 3024], [1179, 2556], [640, 480], [9999, 17]]) { const s = fitWithin(w, h); assert.ok(Math.max(s.w, s.h) <= 1024 && s.w >= 1 && s.h >= 1); }
});

test("photoBody: exactly { image: { media_type, data } } from a JPEG data URL, nothing else, and never over the server's cap", () => {
  const b64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString("base64");
  const body = photoBody(`data:image/jpeg;base64,${b64}`);
  assert.deepEqual(body, { image: { media_type: "image/jpeg", data: b64 } });
  assert.deepEqual(Object.keys(body), ["image"]);
  assert.equal(bodyDataUrl(body), `data:image/jpeg;base64,${b64}`, "the preview is built from the bytes that are posted");
  assert.equal(base64Bytes(b64), 7);
  assert.equal(base64Bytes("QUJD"), 3); assert.equal(base64Bytes("QUI="), 2); assert.equal(base64Bytes("QQ=="), 1); assert.equal(base64Bytes(""), 0);
  for (const bad of ["", null, "data:image/png;base64,AAAA", "data:image/jpeg;base64,", "data:image/jpeg;base64,@@@", "data:,", "https://example.com/x.jpg", "data:image/jpeg;base64,AAAA\nextra"]) assert.equal(photoBody(bad), null, String(bad));
  assert.equal(photoBody(`data:image/jpeg;base64,${"A".repeat(Math.ceil(PHOTO_MAX_BYTES / 3) * 4 + 8)}`), null, "too large for the server");
});

test("cleanAnswer: ranges made sane, unknown fields dropped, hostile strings reduced to plain words", () => {
  const out = cleanAnswer({ provider: "x", food: true, sure: "high", total: { low: 1, high: 99999 }, advice: "eat less", score: 3, usage: { kind: "meal" }, items: [
    { name: "Grilled chicken", portion: "about 1 cup", low: 200, high: 320, grade: "A" },
    { name: "White rice", portion: "a small bowl", low: 260.4, high: 180 },
    { name: "<script>alert(1)</script>Salad", portion: "<b>1</b> [x](javascript:alert(1))", low: 20, high: 60 },
    { name: "Tea\u0000‮\n\twith  milk", portion: "", low: 0, high: 0 },
    { name: "x".repeat(200), portion: "y".repeat(200), low: 5, high: 6 },
    { name: "Cake", portion: "a slice", low: -1, high: 300 },
    { name: "Feast", portion: "a table", low: 10, high: KCAL_MAX + 1 },
    { name: "Soup", portion: "a bowl", low: "120", high: 200 },
    { name: "Stew", portion: "a bowl", low: NaN, high: 200 },
    { name: "Pie", portion: "a slice", low: 100, high: Infinity },
    { name: "   ", portion: "1", low: 1, high: 2 },
    { name: 42, portion: "1", low: 1, high: 2 },
    null, "x", [],
  ] });
  assert.deepEqual(out, { food: true, sure: "high", items: [
    { name: "Grilled chicken", portion: "about 1 cup", low: 200, high: 320 },
    { name: "White rice", portion: "a small bowl", low: 180, high: 260 },
    { name: "script alert(1) /script Salad", portion: "b 1 /b x (javascript alert(1))", low: 20, high: 60 },
    { name: "Tea with milk", portion: "", low: 0, high: 0 },
    { name: "x".repeat(60), portion: "y".repeat(40), low: 5, high: 6 },
  ] });
  for (const it of out.items) { assert.doesNotMatch(it.name + it.portion, /[<>="[\]:;{}\\`\u202e]/); assert.ok([...(it.name + it.portion)].every((ch) => ch.charCodeAt(0) >= 32)); }
  assert.equal(plainWords("  Caf\u00e9 au lait (1/2) & 50% + more-ish  ", 60), "Caf\u00e9 au lait (1/2) & 50% + more-ish");
  assert.equal(plainWords(42, 60), "");
  assert.deepEqual(Object.keys(out).sort(), ["food", "items", "sure"]);
  assert.equal(cleanAnswer({ food: true, sure: "certain", items: [{ name: "Rice", portion: "1 cup", low: 1, high: 2 }] }).sure, "low");
  assert.equal(cleanAnswer({ food: true, sure: "high", items: Array.from({ length: 30 }, (_, i) => ({ name: `Food ${i}`, portion: "1", low: 1, high: 2 })) }).items.length, EST_MAX_ITEMS);
});

test("cleanAnswer: not food, unclear or nothing usable → nothing to add", () => {
  for (const d of [null, undefined, "x", [], {}, { food: false, items: [{ name: "Cat", portion: "1", low: 1, high: 2 }] }, { food: "true", items: [{ name: "Rice", portion: "1", low: 1, high: 2 }] }, { food: true, items: [] }, { food: true, items: "x" }, { food: true, items: [{ name: "<>", portion: "1", low: 1, high: 2 }] }]) assert.deepEqual(cleanAnswer(d), { food: false });
});

test("what a meal note keeps: the foods, portion words, ranges and how sure; never a photo; removable", () => {
  const est = { items: [{ name: "Oat porridge", portion: "1 bowl", low: 250, high: 380 }, { name: "Banana", portion: "1 medium", low: 90, high: 120 }], sure: "medium" };
  assert.deepEqual(cleanEst({ ...est, photo: "data:image/jpeg;base64,AAAA", image: {}, total: { low: 1, high: 2 }, kcal: 5 }), est);
  assert.equal(cleanEst(null), null); assert.equal(cleanEst({ items: [] }), null); assert.equal(cleanEst({ items: [{ name: "", low: 1, high: 2 }] }), null);
  const m = cleanMeal({ id: "l1", meal: "lunch", kind: "balanced", energy: "steady", est: { ...est, photo: "x" }, photo: "data:image/jpeg;base64,AAAA", image: "x", kcal: 800, food: "pasta" });
  assert.deepEqual(m, { id: "l1", meal: "lunch", kind: "balanced", energy: "steady", est });
  assert.equal("est" in cleanMeal({ id: "l2", meal: "lunch", est: { items: [] } }), false);
  const D = "2026-11-18";
  let log = addMeal({}, D, { meal: "lunch", id: "l" }).log;
  log = setMeal(log, D, "l", { est });
  assert.deepEqual(bodyDay(log, D).meals[0], { id: "l", meal: "lunch", est });
  assert.deepEqual(cleanBodyLog(JSON.parse(JSON.stringify(log))), log, "survives a backup round trip");
  assert.doesNotMatch(JSON.stringify(log), /data:image|base64|photo/);
  log = setMeal(log, D, "l", { kind: "carbs" });
  assert.deepEqual(bodyDay(log, D).meals[0].est, est, "another change leaves it alone");
  log = setMeal(log, D, "l", { est: null });
  assert.deepEqual(bodyDay(log, D).meals[0], { id: "l", meal: "lunch", kind: "carbs" });
});

test("words: always a range, a total that is the sum, and names only while calories are hidden", () => {
  const items = [{ name: "White rice", portion: "a small bowl", low: 180, high: 260 }, { name: "Dal", portion: "1 cup", low: 200, high: 300 }];
  assert.deepEqual(totalOf(items), { low: 380, high: 560 });
  assert.equal(kcalRange(items[0]), "180–260 kcal");
  assert.equal(kcalRangeSaid(items[0]), "180 to 260 kilocalories");
  assert.equal(kcalRange({ low: 0, high: 0 }), "0 kcal");
  assert.equal(itemWords(items[0]), "White rice · a small bowl · 180–260 kcal");
  assert.equal(itemWords(items[0], false), "White rice");
  assert.doesNotMatch(itemWords(items[0], false) + itemWords(items[1], false), /\d/, "hidden: no number at all");
  assert.equal(dayTotal([]), null); assert.equal(dayTotal([{ id: "a", meal: "lunch" }]), null); assert.equal(dayTotal(null), null);
  assert.deepEqual(dayTotal([{ id: "a", meal: "lunch", est: { items, sure: "low" } }, { id: "b", meal: "dinner" }, { id: "c", meal: "snack", est: { items: [items[1]], sure: "high" } }]), { low: 580, high: 860, meals: 2 });
  assert.equal(MEAL_COPY.dayTotal("580–860 kcal", 2), "Day total from 2 photos: 580–860 kcal");
  assert.equal(MEAL_COPY.dayTotal("90 kcal", 1), "Day total from 1 photo: 90 kcal");
});

test("the offer and the switches: off by default, needs the flag, a server, Pro and Meal notes in her stage", () => {
  assert.equal(mealPhotoOffer({}), false);
  const all = { flag: true, server: true, pro: true, mealsOffered: true };
  assert.equal(mealPhotoOffer(all), true);
  for (const k of Object.keys(all)) assert.equal(mealPhotoOffer({ ...all, [k]: false }), false, k);
  assert.equal("meals" in cleanAiPrefs(null), false); assert.equal("hideCal" in cleanAiPrefs(null), false);
  assert.equal(cleanAiPrefs({ meals: true }).meals, true);
});

/* 2026-11-26 (docs/plans/meal-photos-findable.md): the Body card, the Meals sheet's line and the row in You all read
   one answer. Every branch, first match wins. */
test("mealCardState: nothing without the flag or outside the stages with Meal notes; then no server, sign in, See Pro, turn on, on", () => {
  const on = { flag: true, server: true, mealsOffered: true, signMode: "required", signedIn: true, pro: true, notesOn: true, photosOn: true, hidden: false };
  assert.deepEqual(mealCardState(), { state: null, card: false });
  assert.deepEqual(mealCardState({}), { state: null, card: false });
  assert.deepEqual(mealCardState(on), { state: "on", card: true });
  // no ai flag in the build, or a stage that isn't offered Meal notes (Pregnancy, Menopause): nothing, whatever else is true
  assert.deepEqual(mealCardState({ ...on, flag: false }), { state: null, card: false });
  assert.deepEqual(mealCardState({ ...on, mealsOffered: false }), { state: null, card: false });
  assert.deepEqual(mealCardState({ ...on, mealsOffered: false, hidden: true }), { state: null, card: false });
  // shown even while everything is off
  assert.deepEqual(mealCardState({ flag: true, mealsOffered: true }), { state: "noserver", card: true });
  // 1. no server: says so, before anything about her
  assert.equal(mealCardState({ ...on, server: false }).state, "noserver");
  assert.equal(mealCardState({ ...on, server: false, signedIn: false, pro: false, notesOn: false, photosOn: false }).state, "noserver");
  // 2. sign-in, where this server asks for it (a guest is signed out in mode "required"); never where it has none
  assert.equal(mealCardState({ ...on, signedIn: false }).state, "signin");
  assert.equal(mealCardState({ ...on, signedIn: false, signMode: "optional" }).state, "signin");
  assert.equal(mealCardState({ ...on, signedIn: false, pro: false, notesOn: false, photosOn: false }).state, "signin", "sign-in comes before See Pro");
  for (const signMode of ["none", "unset", "checking", "offline", undefined]) assert.equal(mealCardState({ ...on, signedIn: false, signMode }).state, "on", String(signMode));
  // 3. not Pro
  assert.equal(mealCardState({ ...on, pro: false }).state, "pro");
  assert.equal(mealCardState({ ...on, pro: false, notesOn: false, photosOn: false }).state, "pro", "See Pro comes before Turn on");
  assert.equal(mealCardState({ ...on, pro: false, signMode: "unset", signedIn: false }).state, "pro");
  // 4. Pro with either switch off: one sheet turns both on
  assert.equal(mealCardState({ ...on, notesOn: false }).state, "off");
  assert.equal(mealCardState({ ...on, photosOn: false }).state, "off");
  assert.equal(mealCardState({ ...on, notesOn: false, photosOn: false }).state, "off");
  for (const v of [undefined, null, 1, "true", {}]) { assert.equal(mealCardState({ ...on, notesOn: v }).state, "off", `notesOn ${String(v)}`); assert.equal(mealCardState({ ...on, photosOn: v }).state, "off", `photosOn ${String(v)}`); }
  // hidden: the card goes in every state, and the state stays for the Meals sheet and You
  for (const over of [{}, { server: false }, { signedIn: false }, { pro: false }, { photosOn: false }]) {
    const shown = mealCardState({ ...on, ...over }), gone = mealCardState({ ...on, ...over, hidden: true });
    assert.equal(shown.card, true); assert.equal(gone.card, false); assert.equal(gone.state, shown.state);
  }
  assert.equal(mealCardState({ ...on, hidden: "yes" }).card, true, "only a real true hides it");
  // every state has its button words and its line for the hidden toast
  for (const st of ["noserver", "signin", "pro", "off", "on"]) assert.equal(typeof MEAL_COPY.hiddenSaid[st], "string", st);
  assert.deepEqual(Object.keys(MEAL_COPY.hiddenSaid), ["noserver", "signin", "pro", "off", "on"]);
});

test("the Body card's words: the exact sentences, and each one true of the state it is shown in", () => {
  assert.equal(MEAL_COPY.cardLead, "Photograph a meal. Solia Health's AI names the foods and can give a rough calorie range.");
  assert.equal(MEAL_COPY.cardOptIn, "Pro, and only if you turn it on.");
  assert.match(MEAL_COPY.cardNoServer, /^Meal photos need Solia Health's server, which this version doesn't have\. With a server, /);
  assert.equal(MEAL_COPY.cardSignIn, "Sign in to use meal photos");
  assert.equal(MEAL_COPY.cardSeePro, "See Pro");
  assert.equal(MEAL_COPY.cardTurnOn, "Turn on meal photos");
  assert.equal(MEAL_COPY.cardNotNow, "Not now");
  assert.equal(MEAL_COPY.cardCal(true), "Calories: shown"); assert.equal(MEAL_COPY.cardCal(false), "Calories: hidden");
  assert.ok(MEAL_COPY.cardCalChangeSaid.toLowerCase().includes(MEAL_COPY.cardCalChange.toLowerCase()), "the spoken name holds the visible word");
  // the hidden toasts name only places that exist in that state: no server names none; without Pro, You's AI page has no row yet
  assert.doesNotMatch(MEAL_COPY.hiddenSaid.noserver, /You →|Meals sheet/);
  for (const st of ["signin", "pro"]) { assert.match(MEAL_COPY.hiddenSaid[st], /^Hidden\. With Pro, /); assert.doesNotMatch(MEAL_COPY.hiddenSaid[st], /Meals sheet/); }
  assert.doesNotMatch(MEAL_COPY.hiddenSaid.off, /Meals sheet/, "the Meals sheet exists only while Meal notes is on");
  assert.match(MEAL_COPY.hiddenSaid.on, /Meals sheet and in You → Solia Health's AI\.$/);
  // the confirmation sheet: turning it on sends nothing, and it says where each switch turns off
  assert.match(MEAL_COPY.onShort, /^Turning this on sends nothing\. Each photo goes only after you've seen it and tapped Send/);
  assert.match(MEAL_COPY.onShort, /Solia Health's server, which doesn't keep it, to Anthropic, which keeps it for a limited time\.$/);
  assert.equal(MEAL_COPY.onOffWhere(false), "You can turn Meal photos off any time in You → Solia Health's AI.");
  assert.equal(MEAL_COPY.onOffWhere(true), "You can turn Meal photos off in You → Solia Health's AI, and Meal notes off in You → Your profile.");
  assert.equal(MEAL_COPY.onSaid, "Meal photos on. Nothing is sent until you tap Send.");
  assert.equal(MEAL_COPY.bothOnSaid, "Meal notes and Meal photos are on. Nothing is sent until you tap Send.");
  assert.equal(MEAL_COPY.needsNotes, "Meal notes is off. Turning this on turns Meal notes on too.");
  assert.equal(MEAL_COPY.instead, "Add a photo instead?");
  assert.equal(MEAL_COPY.showThem, "Show them");
});

test("cleanMealCardOff and slotForHour: a real true hides the card; a card photo is filed by the hour until she picks", () => {
  assert.equal(cleanMealCardOff(true), true);
  for (const v of [false, undefined, null, 1, "true", "hidden", {}, []]) assert.equal(cleanMealCardOff(v), false, String(v));
  const want = { 0: "snack", 3: "snack", 4: "breakfast", 10: "breakfast", 11: "lunch", 15: "lunch", 16: "dinner", 21: "dinner", 22: "snack", 23: "snack" };
  for (const [h, slot] of Object.entries(want)) assert.equal(slotForHour(Number(h)), slot, `hour ${h}`);
  for (const v of [NaN, undefined, "x", Infinity]) assert.equal(slotForHour(v), "snack", String(v));
  for (let h = 0; h < 24; h++) assert.ok(["breakfast", "lunch", "dinner", "snack"].includes(slotForHour(h)));
});

test("guardrails: no sentence sets a target, judges food or gives advice; every calorie sentence says it is an estimate", () => {
  const all = [];
  const walk = (v) => { if (typeof v === "string") all.push(v); else if (typeof v === "function") all.push(String(v(3, "2026-12-01", 5) ?? "")); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  walk({ ...MEAL_COPY, limit: null, left: null, photoFacts: null, dayTotal: null }); all.push(MEAL_COPY.limit(60, "2026-12-01"), MEAL_COPY.left({ used: 3, limit: 60 }), MEAL_COPY.photoFacts(1024, 768, 150000), MEAL_COPY.dayTotal("1–2 kcal", 2));
  for (const s of all) {
    assert.doesNotMatch(s, /\b(goal|target|budget|over|under|too (much|many|little)|limit yourself|burn|deficit|surplus|lose|loss|gain|diet|weight|healthy|unhealthy|good|bad|junk|clean|cheat|guilt|treat|score|streak|grade|should|must|try to)\b/i, s);
    assert.doesNotMatch(s, /[—]/, s);
  }
  assert.equal(MEAL_COPY.calNote, "A rough estimate from a photo. It can be well off.");
  assert.equal(MEAL_COPY.savedTag, "Estimated from a photo");
  assert.equal(MEAL_COPY.preg, "Energy needs change in pregnancy. Ask your clinician what's right for you.");
  assert.doesNotMatch(MEAL_COPY.preg, /\d/, "never a number");
  assert.equal(MEAL_COPY.left({ used: 3, limit: 60 }), "57 of 60 meal photos left this month.");
  assert.equal(MEAL_COPY.limit(60, "2026-12-01"), "You've used this month's 60 meal photos, so this one wasn't read and nothing went to Anthropic. They start again on December 1.");
  // privacy sentences that must stay literally true of the build
  assert.match(MEAL_COPY.sheetLead, /never keeps the photo or the answer/);
  assert.match(MEAL_COPY.adds, /sends it only when you tap Send/);
  assert.match(MEAL_COPY.adds, /Nothing from your log goes with it/);
  assert.match(MEAL_COPY.notKept, /^Solia Health doesn't keep the photo, on this device or on its server\./);
  assert.match(MEAL_COPY.photoFacts(1024, 768, 150000), /1024 × 768 pixels, about 146 kB/);
});

test("failLine: each reason has its own true sentence", () => {
  assert.equal(failLine({ why: "unset" }), MEAL_COPY.notSetUp);
  assert.equal(failLine({ why: "busy" }), MEAL_COPY.tooMany);
  assert.equal(failLine({ why: "signin" }), MEAL_COPY.signin);
  assert.equal(failLine({ why: "offline" }), MEAL_COPY.dropped);
  assert.equal(failLine({ why: "toobig" }), MEAL_COPY.tooBig);
  assert.equal(failLine({ why: "notimage" }), MEAL_COPY.notImage);
  assert.equal(failLine({ why: "error" }), MEAL_COPY.noAnswer);
  assert.equal(failLine(null), MEAL_COPY.noAnswer);
  assert.match(failLine({ why: "limit", limit: 60, resetsOn: "2027-01-01" }), /this month's 60 meal photos.*January 1\.$/);
});

test("nothing else reads an estimate: patterns, the AI summary, counts, the PDF lines and the day words are unchanged by it", () => {
  const est = { items: [{ name: "Zebracorn porridge", portion: "1 bowl", low: 311, high: 477 }], sure: "medium" };
  const days = [];
  for (let i = 1; i <= 28; i++) days.push(`2026-10-${String(i).padStart(2, "0")}`);
  const build = (withEst) => {
    let log = {};
    days.forEach((d, i) => {
      log = addMeal(log, d, { meal: "lunch", id: "l" }).log;
      log = setMeal(log, d, "l", { kind: i % 2 ? "carbs" : "balanced", energy: i % 2 ? "dipped" : "steady", ...(withEst ? { est } : {}) });
    });
    return log;
  };
  const plain = build(false), withEst = build(true);
  const todayIso = "2026-10-28";
  assert.deepEqual(mealCards({ bodyLog: withEst, todayIso }), mealCards({ bodyLog: plain, todayIso }));
  assert.deepEqual(mealCounts(withEst, "2026-10-01", todayIso), mealCounts(plain, "2026-10-01", todayIso));
  assert.deepEqual(mealReportLines(withEst, "2026-10-01", todayIso), mealReportLines(plain, "2026-10-01", todayIso));
  assert.equal(mealsText(withEst, todayIso), mealsText(plain, todayIso));
  assert.equal(mealDayWords(withEst, todayIso), mealDayWords(plain, todayIso));
  assert.equal(mealText(bodyDay(withEst, todayIso).meals[0]), mealText(bodyDay(plain, todayIso).meals[0]));
  const sum = (bodyLog) => buildSummary({ stage: "periods", stageName: "My Cycle", entries: [], bodyLog, moodLog: {}, labs: [], includeLabs: false, pcosOn: false, mealsOn: true, experiments: [], todayIso });
  assert.deepEqual(sum(withEst), sum(plain));
  for (const text of [JSON.stringify(sum(withEst)), JSON.stringify(mealCards({ bodyLog: withEst, todayIso })), mealReportLines(withEst, "2026-10-01", todayIso).join(" ")]) assert.doesNotMatch(text, /Zebracorn|porridge|311|477|kcal/i);
});
