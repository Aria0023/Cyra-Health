// Local-first L4: every flag-dependent privacy sentence (lib/disclosures.js). With every flag on, each
// builder must return the text the app showed before L4, byte for byte (the literals below are copied
// from the pre-L4 source); with fewer flags, shorter sentences that never mention an absent feature.
// Run: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { FEATURE_NAMES, parseFeatures, remindersInBuild } from "./features.js";
import {
  andList, oxfordList, deleteAlso, serverSees, consentDeleteFact, consentDetails, filesSentence, leaveDevice, restoreFoot, restoreChanges,
  wipeConfirm, wipeMore, LEGACY_WEAR_LINE, intakeHint, startOverText, potsTodayFoot, potsTodayFootUnsaved, potsTodayFoot2, potsHintTail,
  potsNeverSent, potsFixedLine, potsRemindersLine, fertPrivacyLine,
} from "./disclosures.js";

const ALL = parseFeatures("all"), DEF = parseFeatures(undefined), NONE = parseFeatures("none");

/* ---- the pre-L4 literals (RegisterScreen, DataControls, IntakeScreen, RecordUnavailableScreen, POTS) ---- */
const PRE = {
  serverSees: [
    "An encrypted backup keeps your name, email and other sign-up answers, except your ZIP and age band.",
    "Anonymous Mode skips your name and email entirely.",
    "Cyra's servers keep no account and no profile of you in either mode: no age, health history or check-ins.",
    "A few optional choices send a little to Cyra's server, and each one says exactly what before you turn it on.",
    "Two of them keep a little there while they're on. Browser reminders: this browser's push address and its encryption keys, your reminder days, time and time zone, and the last day a reminder went out. Fitbit/Garmin/Whoop sync: new readings, held up to 7 days until this device collects them.",
    "Turning one off erases it from Cyra's server. If the server can't be reached then, Cyra keeps asking until it confirms, and Delete everything tells you if anything stays connected.",
    "If you choose to share weekly counts, they're added to anonymous weekly totals that stay on the server.",
    "Sign-in prefill and Oura connect leave your name and email, or your Oura access, there for 5 minutes at most.",
    "Like any app that goes online, our server and its host see your device's internet address and app or browser type when the app connects. Cyra's own code doesn't keep the address.",
  ],
  consentDeleteFact: "Delete everything from Settings, anytime. It also turns off reminders and disconnects Oura and Fitbit/Garmin/Whoop.",
  consentDetails: [
    "Features that send something: weekly counts, Cyra's AI and wearable syncs. Each one tells you what it sends before you turn it on.",
    "Taking it out yourself means a doctor summary you open in email or copy, a POTS report or spreadsheet you save or share, which isn't locked, or a backup file you save, which stays locked with your passphrase.",
    "If Delete everything can't confirm that reminders are off and Oura and Fitbit/Garmin/Whoop are disconnected, Cyra tells you what did and didn't happen, and keeps your record on this device until you choose.",
    "Deleting can't pull back what already left: anonymous counts you shared stay counted, questions already sent to Cyra's AI stay with Anthropic for a limited time under its own terms, and readings Terra already collected stay under Terra's policy.",
  ],
  leaveDevice: [
    "Features you turn on (reminders in a browser, weekly counts, Cyra's AI, Oura, Fitbit/Garmin/Whoop) each say, before you turn them on, what they send and where.",
    "Restoring a backup brings back its wearable connections on this device.",
    "Files you make yourself, like a POTS report or spreadsheet, go only where you save or send them. They aren't locked with a passphrase and never include readings Cyra gets from a connected watch, ring or health app.",
  ],
  restoreFoot: "Unlocked on this device with your passphrase. It replaces your record here. Oura and Fitbit/Garmin/Whoop connections in the backup come back unconfirmed until Cyra checks them through its server; ones only on this device stay connected.",
  restoreChanges: [
    "Your settings are replaced too, except this device's choices about weekly counts, Cyra's AI, browser reminders and appearance (light or dark).",
    "If the backup has Oura or Fitbit/Garmin/Whoop connected, that connection comes back on this device marked not confirmed, because it may have been ended since the backup was made. It counts as connected again once Cyra confirms it through its server: Oura on a Sync that works (checked straight away, and removed from this device if it no longer works), Fitbit/Garmin/Whoop when readings arrive. A Fitbit/Garmin/Whoop connection you ended after the backup can't send readings, so tap Disconnect to remove it. One this device is still waiting to see disconnected isn't restored. A connection this device has now for the same service is replaced, so remove Cyra in that account if you want it ended.",
    "A connection this device has that the backup doesn't (Oura or Fitbit/Garmin/Whoop) stays connected here and keeps fetching readings through Cyra's server as before. Tap Disconnect under Wearables on Home if you don't want it.",
    // Added by L5 (cycle flags restored literally), directly before the POTS line, which stays last.
    "Cycles you left out of predictions are restored as the backup has them; a backup made before you left any out uses every cycle again.",
    "A backup made before you turned on POTS tools has no POTS log, so restoring it clears the POTS log on this device.",
  ],
  wipeConfirm: " Every check-in, POTS log, note, appointment and setting goes for good. This also turns off reminders and disconnects Oura and Fitbit/Garmin/Whoop. Cyra's servers keep no copy of your log, so it can't be recovered unless you saved a backup.",
  wipeMoreWeb: [
    "If Cyra's server, Oura or Fitbit/Garmin/Whoop can't confirm that, Cyra tells you what did and didn't end and keeps your record on this device until you choose.",
    "Anonymous counts you already shared stay counted. Questions already sent to Cyra's AI stay with Anthropic for a limited time under its own terms, and readings Terra already collected stay under Terra's policy.",
    "Report files you already saved or shared aren't on this device's record. Delete them wherever you put them.",
  ],
  appleHealth: "Apple Health or Health Connect access stays on until you turn it off in your phone's settings.",
  intakeHint: "Four quick taps. Your answers shape the whole app — one experience, built for where you are. Your answers stay on this device. (If you share weekly counts, your life stage is part of what's shared.)",
  startOver: " This deletes this phone's record for good and turns off reminders, but doesn't disconnect wearables. Cyra keeps no copy of your record on its servers, so the only way back is an encrypted backup you saved — you can restore one on the next screen.",
  TODAY_FOOT: "Saved on this device as you tap. Cyra's server never gets your POTS log, and it isn't part of weekly counts.",
  TODAY_FOOT_UNSAVED: {
    memory: "Not being saved: Cyra couldn't open this browser's storage, so what you log here is lost when you close Cyra. Cyra's server never gets your POTS log, and it isn't part of weekly counts.",
    stale: "Cyra couldn't confirm your latest taps were saved on this device; they may be lost when you close Cyra. Cyra's server never gets your POTS log, and it isn't part of weekly counts.",
  },
  TODAY_FOOT_2: "Never part of weekly counts. Cyra can't diagnose POTS; only a clinician can.",
  HINT_TAIL: "Never part of weekly counts. Cyra can't diagnose POTS; only a clinician can, and good notes make that visit faster.",
  potsNeverSent: "None of it is part of weekly counts, and none of it is sent to Cyra's server or Cyra's AI.",
  FIXED_LINE: "Readings Cyra gets from a connected watch, ring or health app aren't included in this report or spreadsheet. Heart rates and blood pressures you type in yourself are, even if you read them off a watch.",
  REMINDERS_LINE: "Cyra doesn't send medicine or drink reminders. The only reminder Cyra can send is your check-in reminder, if you turned it on. If reminders help you, your phone's clock app can set them.",
};
const REMINDERS_SHORT = "Cyra doesn't send medicine or drink reminders. If reminders help you, your phone's clock app can set them.";

/** Every builder's output for flags f on one platform, as a flat list of { name, text } (nulls dropped). */
const outputs = (f, native, server = true) => {
  const list = [
    ["serverSees", serverSees(f, server)], ["consentDeleteFact", consentDeleteFact(f, native)], ["consentDetails", consentDetails(f, native)],
    ["leaveDevice", leaveDevice(f)], ["filesSentence", filesSentence(f)], ["restoreFoot", restoreFoot(f)], ["restoreChanges", restoreChanges(f)],
    ["wipeConfirm", wipeConfirm(f, native)], ["wipeMore", wipeMore(f, native)], ["intakeHint", intakeHint(f)],
    ["startOverText", startOverText(f)], ["potsTodayFoot", potsTodayFoot(f)], ["potsTodayFootUnsaved", Object.values(potsTodayFootUnsaved(f))],
    ["potsTodayFoot2", potsTodayFoot2(f)], ["potsHintTail", potsHintTail(f)], ["potsNeverSent", potsNeverSent(f)],
    ["potsFixedLine", potsFixedLine(f)], ["potsRemindersLine", potsRemindersLine(f, native)], ["fertPrivacyLine", fertPrivacyLine(f)],
  ];
  return list.flatMap(([name, v]) => (Array.isArray(v) ? v : [v]).filter((t) => t != null).map((text) => ({ name, text })));
};

test("disclosures: fertPrivacyLine (L7) has four variants, keyed on the counts and ai flags only", () => {
  const v = (counts, ai) => fertPrivacyLine({ ...NONE, counts, ai });
  assert.equal(v(true, true), "Kept on this device. Never part of weekly counts or sent to Cyra's AI.");
  assert.equal(v(true, false), "Kept on this device. Never part of weekly counts.");
  assert.equal(v(false, true), "Kept on this device. Never sent to Cyra's AI.");
  assert.equal(v(false, false), "Kept on this device.");
  assert.equal(fertPrivacyLine(ALL), v(true, true));
  assert.equal(fertPrivacyLine(DEF), v(false, true));
  assert.equal(fertPrivacyLine(NONE), v(false, false));
  // The other flags never change it.
  for (const n of FEATURE_NAMES) if (n !== "counts" && n !== "ai") assert.equal(fertPrivacyLine({ ...ALL, [n]: false }), v(true, true));
});

test("disclosures: list helpers", () => {
  assert.equal(andList([]), ""); assert.equal(andList(["a"]), "a"); assert.equal(andList(["a", "b"]), "a and b"); assert.equal(andList(["a", "b", "c"]), "a, b and c");
  assert.equal(oxfordList(["a"]), "a"); assert.equal(oxfordList(["a", "b"]), "a and b"); assert.equal(oxfordList(["a", "b", "c"]), "a, b, and c");
  assert.equal(deleteAlso(ALL, false), "turns off reminders and disconnects Oura and Fitbit/Garmin/Whoop");
  assert.equal(deleteAlso(DEF, false), "turns off reminders");
  assert.equal(deleteAlso(NONE, false), "");
  assert.equal(deleteAlso(NONE, true), "turns off reminders");
});

test("disclosures: with every flag on, web and phone, each builder is the pre-L4 text byte for byte", () => {
  for (const native of [false, true]) {
    assert.deepEqual(serverSees(ALL), PRE.serverSees);
    assert.deepEqual(serverSees(ALL, true), PRE.serverSees);
    assert.equal(consentDeleteFact(ALL, native), PRE.consentDeleteFact);
    assert.deepEqual(consentDetails(ALL, native), PRE.consentDetails);
    assert.deepEqual(leaveDevice(ALL), PRE.leaveDevice);
    assert.equal(filesSentence(ALL), PRE.leaveDevice[2]);
    assert.equal(restoreFoot(ALL), PRE.restoreFoot);
    assert.deepEqual(restoreChanges(ALL), PRE.restoreChanges);
    assert.equal(wipeConfirm(ALL, native), PRE.wipeConfirm);
    assert.deepEqual(wipeMore(ALL, native), native ? [PRE.wipeMoreWeb[0], PRE.wipeMoreWeb[1], PRE.appleHealth, PRE.wipeMoreWeb[2]] : PRE.wipeMoreWeb);
    assert.equal(intakeHint(ALL), PRE.intakeHint);
    assert.equal(startOverText(ALL), PRE.startOver);
    assert.equal(potsTodayFoot(ALL), PRE.TODAY_FOOT);
    assert.deepEqual(potsTodayFootUnsaved(ALL), PRE.TODAY_FOOT_UNSAVED);
    assert.equal(potsTodayFoot2(ALL), PRE.TODAY_FOOT_2);
    assert.equal(potsHintTail(ALL), PRE.HINT_TAIL);
    assert.equal(potsNeverSent(ALL), PRE.potsNeverSent);
    assert.equal(potsFixedLine(ALL), PRE.FIXED_LINE);
    assert.equal(potsRemindersLine(ALL, native), PRE.REMINDERS_LINE);
  }
});

test("disclosures: the shipping defaults (ai, webReminders), web and phone", () => {
  const sees = [
    PRE.serverSees[0], PRE.serverSees[1], PRE.serverSees[2],
    "A few optional choices send a little to Cyra's server, and each one says exactly what before you turn it on.",
    "One of them keeps a little there while it's on. Browser reminders: this browser's push address and its encryption keys, your reminder days, time and time zone, and the last day a reminder went out.",
    "Turning it off erases it from Cyra's server. If the server can't be reached then, Cyra keeps asking until it confirms.",
    PRE.serverSees[8],
  ];
  assert.deepEqual(serverSees(DEF, true), sees);
  assert.deepEqual(serverSees(DEF, false), PRE.serverSees.slice(0, 3), "no server: no optional choice can reach one");
  for (const native of [false, true]) {
    assert.equal(consentDeleteFact(DEF, native), "Delete everything from Settings, anytime. It also turns off reminders.");
    assert.equal(wipeConfirm(DEF, native), " Every check-in, POTS log, note, appointment and setting goes for good. This also turns off reminders. Cyra's servers keep no copy of your log, so it can't be recovered unless you saved a backup.");
  }
  assert.deepEqual(consentDetails(DEF, false), [
    "A feature that sends something: Cyra's AI. It tells you what it sends before you turn it on.",
    PRE.consentDetails[1],
    "If Delete everything can't confirm that reminders are off, Cyra tells you what did and didn't happen, and keeps your record on this device until you choose.",
    "Deleting can't pull back what already left: questions already sent to Cyra's AI stay with Anthropic for a limited time under its own terms.",
  ]);
  assert.deepEqual(consentDetails(DEF, true), [consentDetails(DEF, false)[0], PRE.consentDetails[1], consentDetails(DEF, false)[3]], "phone: a cancel never needs the server");
  assert.deepEqual(leaveDevice(DEF), [
    "Features you turn on (reminders in a browser, Cyra's AI) each say, before you turn them on, what they send and where.",
    "Files you make yourself, like a POTS report or spreadsheet, go only where you save or send them. They aren't locked with a passphrase.",
  ]);
  assert.equal(restoreFoot(DEF), "Unlocked on this device with your passphrase. It replaces your record here.");
  assert.deepEqual(restoreChanges(DEF), ["Your settings are replaced too, except this device's choices about Cyra's AI, browser reminders and appearance (light or dark).", PRE.restoreChanges[3], PRE.restoreChanges[4]]);
  assert.deepEqual(wipeMore(DEF, false), [
    "If Cyra's server can't confirm that, Cyra tells you what did and didn't end and keeps your record on this device until you choose.",
    "Questions already sent to Cyra's AI stay with Anthropic for a limited time under its own terms.",
    PRE.wipeMoreWeb[2],
  ]);
  assert.deepEqual(wipeMore(DEF, true), ["Questions already sent to Cyra's AI stay with Anthropic for a limited time under its own terms.", PRE.wipeMoreWeb[2]]);
  assert.equal(intakeHint(DEF), "Four quick taps. Your answers shape the whole app — one experience, built for where you are. Your answers stay on this device.");
  assert.equal(startOverText(DEF), " This deletes this phone's record for good and turns off reminders. Cyra keeps no copy of your record on its servers, so the only way back is an encrypted backup you saved — you can restore one on the next screen.");
  assert.equal(potsTodayFoot(DEF), "Saved on this device as you tap. Cyra's server never gets your POTS log.");
  assert.deepEqual(potsTodayFootUnsaved(DEF), {
    memory: "Not being saved: Cyra couldn't open this browser's storage, so what you log here is lost when you close Cyra. Cyra's server never gets your POTS log.",
    stale: "Cyra couldn't confirm your latest taps were saved on this device; they may be lost when you close Cyra. Cyra's server never gets your POTS log.",
  });
  assert.equal(potsTodayFoot2(DEF), "Cyra can't diagnose POTS; only a clinician can.");
  assert.equal(potsHintTail(DEF), "Cyra can't diagnose POTS; only a clinician can, and good notes make that visit faster.");
  assert.equal(potsNeverSent(DEF), "None of it is sent to Cyra's server or Cyra's AI.");
  assert.equal(potsFixedLine(DEF), null);
  assert.equal(potsRemindersLine(DEF, false), PRE.REMINDERS_LINE);
  assert.equal(potsRemindersLine(DEF, true), PRE.REMINDERS_LINE);
});

test("disclosures: none — the minimal outputs", () => {
  assert.deepEqual(serverSees(NONE, true), PRE.serverSees.slice(0, 3));
  assert.deepEqual(serverSees(NONE, false), PRE.serverSees.slice(0, 3));
  assert.equal(consentDeleteFact(NONE, false), "Delete everything from Settings, anytime.");
  assert.equal(consentDeleteFact(NONE, true), "Delete everything from Settings, anytime. It also turns off reminders.");
  for (const native of [false, true]) assert.deepEqual(consentDetails(NONE, native), [PRE.consentDetails[1]]);
  assert.deepEqual(leaveDevice(NONE), ["Files you make yourself, like a POTS report or spreadsheet, go only where you save or send them. They aren't locked with a passphrase."]);
  assert.deepEqual(restoreChanges(NONE), ["Your settings are replaced too, except this device's choices about appearance (light or dark).", PRE.restoreChanges[3], PRE.restoreChanges[4]]);
  assert.equal(wipeConfirm(NONE, false), " Every check-in, POTS log, note, appointment and setting goes for good. Cyra's servers keep no copy of your log, so it can't be recovered unless you saved a backup.");
  assert.deepEqual(wipeMore(NONE, false), [PRE.wipeMoreWeb[2]]);
  assert.deepEqual(wipeMore(NONE, true), [PRE.wipeMoreWeb[2]]);
  assert.equal(potsNeverSent(NONE), "None of it is sent to Cyra's server.");
  assert.equal(potsRemindersLine(NONE, false), REMINDERS_SHORT);
  assert.equal(potsRemindersLine(NONE, true), PRE.REMINDERS_LINE, "phones always have check-in reminders");
});

test("disclosures: restoreChanges and serverSees for all, default and none, with and without a server", () => {
  for (const server of [true, false]) {
    assert.deepEqual(serverSees(ALL, server), server ? PRE.serverSees : PRE.serverSees.slice(0, 3));
    assert.equal(serverSees(DEF, server).length, server ? 7 : 3);
    assert.deepEqual(serverSees(NONE, server), PRE.serverSees.slice(0, 3));
  }
  // restoreChanges names this device's choices, which a restore keeps whether or not the build has a server.
  assert.equal(restoreChanges(ALL)[0], PRE.restoreChanges[0]);
  assert.equal(restoreChanges(DEF)[0], "Your settings are replaced too, except this device's choices about Cyra's AI, browser reminders and appearance (light or dark).");
  assert.equal(restoreChanges(NONE)[0], "Your settings are replaced too, except this device's choices about appearance (light or dark).");
  assert.equal(restoreChanges.length, 1, "takes only the flags: no server or platform wording");
  // L5: the cycles line is second to last and the POTS line stays last in every configuration (the POTS suites assert it).
  for (let mask = 0; mask < 1 << FEATURE_NAMES.length; mask++) {
    const list = restoreChanges(Object.fromEntries(FEATURE_NAMES.map((n, i) => [n, !!(mask & (1 << i))])));
    assert.equal(list[list.length - 1], PRE.restoreChanges[4]);
    assert.equal(list[list.length - 2], PRE.restoreChanges[3]);
  }
});

test("disclosures: singular forms for one feature", () => {
  const one = parseFeatures("ai");
  assert.equal(serverSees(one)[3], "One optional choice sends a little to Cyra's server, and it says exactly what before you turn it on.");
  assert.equal(consentDetails(one, false)[0], "A feature that sends something: Cyra's AI. It tells you what it sends before you turn it on.");
  assert.equal(leaveDevice(one)[0], "A feature you turn on (Cyra's AI) says, before you turn it on, what it sends and where.");
  const rem = parseFeatures("webReminders");
  assert.equal(serverSees(rem)[4], "It keeps a little there while it's on. Browser reminders: this browser's push address and its encryption keys, your reminder days, time and time zone, and the last day a reminder went out.");
  const wear = parseFeatures("wearables");
  assert.equal(serverSees(wear)[5], "Turning it off erases it from Cyra's server. If the server can't be reached then, Cyra keeps asking until it confirms, and Delete everything tells you if anything stays connected.");
  assert.ok(serverSees(wear).includes("Oura connect leaves your Oura access there for 5 minutes at most."));
  assert.ok(serverSees(parseFeatures("signin")).includes("Sign-in prefill leaves your name and email there for 5 minutes at most."));
  assert.equal(consentDetails(wear, false)[2], "If Delete everything can't confirm that Oura and Fitbit/Garmin/Whoop are disconnected, Cyra tells you what did and didn't happen, and keeps your record on this device until you choose.");
  assert.equal(wipeMore(wear, false)[1], "Readings Terra already collected stay under Terra's policy.");
});

/* A feature that is off is never named. Narrowed where a sentence legitimately uses the word for something else:
   counts matches the feature's names, not the verb ("It counts as connected again", a wearables sentence);
   signin's /Apple/ excludes "Apple Health" (a wearables sentence); web reminders exclude potsRemindersLine (its short
   form says Cyra sends NO medicine or drink reminders) and startOverText (a phone-only screen, and phones always
   have reminders). LEGACY_WEAR_LINE is a constant for wearables-off builds, not a builder. */
const OFF_RE = {
  wearables: /Oura|Fitbit|Garmin|Whoop|Terra|wearable|watch, ring|Apple Health|Health Connect/,
  counts: /weekly counts|[Aa]nonymous counts|counts you|weekly totals/,
  ai: /Cyra's AI|Anthropic/,
  signin: /Sign-in|Apple(?! Health)|Google|Facebook/,
  webReminders: /reminder/i,
  cloudBackup: /cloud/i,
};
test("disclosures: a feature that is off is never mentioned (each single flag off, each single flag on, web and phone)", () => {
  const configs = [];
  for (const n of FEATURE_NAMES) {
    configs.push({ label: `all but ${n}`, f: { ...ALL, [n]: false } });
    configs.push({ label: `only ${n}`, f: parseFeatures(n) });
  }
  configs.push({ label: "default", f: DEF }, { label: "none", f: NONE });
  for (const { label, f } of configs) {
    for (const native of [false, true]) {
      for (const { name, text } of outputs(f, native)) {
        for (const n of FEATURE_NAMES) {
          if (f[n]) continue;
          if (n === "webReminders" && (remindersInBuild(native, f) || name === "potsRemindersLine" || name === "startOverText")) continue;
          assert.ok(!OFF_RE[n].test(text), `${label}, ${native ? "phone" : "web"}: ${name} names ${n}: ${text}`);
        }
      }
    }
  }
});

test("disclosures: every output is a clean sentence in every configuration", () => {
  const all = [];
  const flagsets = [];
  for (let mask = 0; mask < 1 << FEATURE_NAMES.length; mask++) flagsets.push(Object.fromEntries(FEATURE_NAMES.map((n, i) => [n, !!(mask & (1 << i))])));
  for (const f of flagsets) for (const native of [false, true]) for (const server of [true, false]) all.push(...outputs(f, native, server));
  assert.ok(all.length > 1000);
  for (const { name, text } of all) {
    assert.equal(typeof text, "string", name);
    assert.ok(!/ {2}/.test(text), `${name}: double space: ${text}`);
    assert.ok(!text.includes(" ."), `${name}: " .": ${text}`);
    assert.ok(!text.includes("()"), `${name}: "()": ${text}`);
    assert.ok(!text.includes(", and."), `${name}: ", and.": ${text}`);
    assert.ok(!/^\s*,|,\s*$/.test(text), `${name}: dangling comma: ${text}`);
    assert.ok(/[.)]$/.test(text), `${name}: must end with . or ): ${text}`);
    assert.ok(text.trim().length > 10, `${name}: empty: ${text}`);
  }
  assert.ok(/[.)]$/.test(LEGACY_WEAR_LINE) && !/ {2}/.test(LEGACY_WEAR_LINE));
  assert.equal(LEGACY_WEAR_LINE, "Cyra can't end a wearable connection from this version. If you connected Oura, Fitbit, Garmin or Whoop to Cyra before, remove Cyra in that account's connected apps (Fitbit, Garmin and Whoop may list it as Terra).");
});
