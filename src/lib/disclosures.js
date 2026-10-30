/* Every privacy sentence whose truth depends on the build's feature flags (local-first L4,
   lib/features.js) lives here, built from the flags it names, so the app can never say something
   about a feature this build doesn't have. Each builder takes the flags object `f` explicitly (and,
   where the wording depends on the platform, `native`), so the unit tests can pin every
   configuration: with every flag on (VITE_FEATURES=all) each one returns the exact text the app
   showed before L4, byte for byte; otherwise a shorter, grammatical, literally true variant, never a
   dangling sentence or an empty list (disclosures.test.mjs).
   Rule for later slices: a new sentence that names a flagged feature is added here as a builder (or
   a constant) with its tests, never as a flag condition inlined in a screen's copy.
   Pure: imports only remindersInBuild from ./features.js (itself import-free), so Node can load it.
   Calm R9 (the optional account): a build that offers an account (accountsInBuild: the cloudBackup flag AND a server)
   lets her keep an encrypted copy of her record on Cyra's server. Every sentence that says Cyra's server never gets,
   keeps or receives her log takes an explicit `accounts` argument (default false, so every pre-R9 call and pin is
   unchanged) and, when it is true, names that one exception: the encrypted account backup she makes herself. */
import { remindersInBuild } from "./features.js";

/** Whether this build offers the optional account (encrypted backup to Cyra's server): the cloudBackup flag and a server. */
export const accountsInBuild = (f, server) => !!(f && f.cloudBackup) && !!server;
/** The exception clause the server sentences carry in an accounts build. */
export const ACCOUNT_EXCEPT = "except locked inside your encrypted account backup, if you make one";

/** 'a', 'a and b', 'a, b and c'. */
export const andList = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
/** 'a', 'a and b', 'a, b, and c'. */
export const oxfordList = (a) => (a.length < 3 ? a.join(" and ") : `${a.slice(0, -1).join(", ")}, and ${a[a.length - 1]}`);
const on = (list) => list.filter(Boolean);

/** What Delete everything also does, or "" when nothing: "turns off reminders and disconnects Oura and Fitbit/Garmin/Whoop". */
export const deleteAlso = (f, native) => on([remindersInBuild(native, f) && "turns off reminders", f.wearables && "disconnects Oura and Fitbit/Garmin/Whoop"]).join(" and ");

/* ---------- registration, step 1: "What Cyra's server sees" ---------- */
/** The bullets. With no server (VITE_API_BASE unset) no optional choice can reach one, so only the
    three that hold in every build remain. */
export function serverSees(f, server = true, accounts = false) {
  const out = [
    "An encrypted backup keeps your name, email and other sign-up answers, except your ZIP and age band.",
    "Anonymous Mode skips your name and email entirely.",
    accounts && server
      ? "Heard Health's servers keep no profile of you in either mode: no age, health history or check-ins. If you later make the optional account, they keep only your encrypted backup, which they can't read, and a one-way hash of your email."
      : "Heard Health's servers keep no account and no profile of you in either mode: no age, health history or check-ins.",
  ];
  if (!server) return out;
  const n = [f.counts, f.ai, f.webReminders, f.wearables, f.signin].filter(Boolean).length;
  if (n >= 2) out.push("A few optional choices send a little to Heard Health's server, and each one says exactly what before you turn it on.");
  else if (n === 1) out.push("One optional choice sends a little to Heard Health's server, and it says exactly what before you turn it on.");
  const keep = on([
    f.webReminders && "Browser reminders: this browser's push address and its encryption keys, your reminder days, time and time zone, and the last day a reminder went out.",
    f.wearables && "Fitbit/Garmin/Whoop sync: new readings, held up to 7 days until this device collects them.",
  ]);
  if (keep.length === 2) {
    out.push(`Two of them keep a little there while they're on. ${keep.join(" ")}`);
    out.push("Turning one off erases it from Heard Health's server. If the server can't be reached then, Heard Health keeps asking until it confirms, and Delete everything tells you if anything stays connected.");
  } else if (keep.length === 1) {
    out.push(`${n >= 2 ? "One of them keeps" : "It keeps"} a little there while it's on. ${keep[0]}`);
    out.push(`Turning it off erases it from Heard Health's server. If the server can't be reached then, Heard Health keeps asking until it confirms${f.wearables ? ", and Delete everything tells you if anything stays connected." : "."}`);
  }
  if (f.counts) out.push("If you choose to share weekly counts, they're added to anonymous weekly totals that stay on the server.");
  if (f.signin && f.wearables) out.push("Sign-in prefill and Oura connect leave your name and email, or your Oura access, there for 5 minutes at most.");
  else if (f.signin) out.push("Sign-in prefill leaves your name and email there for 5 minutes at most.");
  else if (f.wearables) out.push("Oura connect leaves your Oura access there for 5 minutes at most.");
  if (n >= 1) out.push("Like any app that goes online, our server and its host see your device's internet address and app or browser type when the app connects. Heard Health's own code doesn't keep the address.");
  return out;
}

/* ---------- registration, consent step ---------- */
/** The fifth fact on the consent card. */
export function consentDeleteFact(f, native) {
  const also = deleteAlso(f, native);
  return `Delete everything from Settings, anytime.${also ? ` It also ${also}.` : ""}`;
}

/** "The details" under the consent card (nulls dropped). */
export function consentDetails(f, native) {
  const send = on([f.counts && "weekly counts", f.ai && "Heard Health's AI", f.wearables && "wearable syncs"]);
  const li1 = send.length >= 2 ? `Features that send something: ${andList(send)}. Each one tells you what it sends before you turn it on.`
    : send.length === 1 ? `A feature that sends something: ${send[0]}. It tells you what it sends before you turn it on.` : null;
  const li2 = "Taking it out yourself means a doctor summary you open in email or copy, an appointment PDF, POTS report or spreadsheet you save or share, which isn't locked, or a backup file you save, which stays locked with your passphrase.";
  const li3 = f.wearables && f.webReminders ? "If Delete everything can't confirm that reminders are off and Oura and Fitbit/Garmin/Whoop are disconnected, Heard Health tells you what did and didn't happen, and keeps your record on this device until you choose."
    : f.wearables ? "If Delete everything can't confirm that Oura and Fitbit/Garmin/Whoop are disconnected, Heard Health tells you what did and didn't happen, and keeps your record on this device until you choose."
    : f.webReminders && !native ? "If Delete everything can't confirm that reminders are off, Heard Health tells you what did and didn't happen, and keeps your record on this device until you choose."
    : null;
  const gone = on([f.counts && "anonymous counts you shared stay counted", f.ai && "questions already sent to Heard Health's AI stay with Anthropic for a limited time under its own terms", f.wearables && "readings Terra already collected stay under Terra's policy"]);
  const li4 = gone.length ? `Deleting can't pull back what already left: ${oxfordList(gone)}.` : null;
  return on([li1, li2, li3, li4]);
}

/* ---------- Settings → Privacy & your data (L10: the "Backups and files you make" row and the wearables row) ---------- */
/** The files sentence in the "Backups and files you make" row's Details (its wearable clause only where a watch, ring or health app can be connected). */
export const filesSentence = (f) => `Files you make yourself, like your appointment PDF or a POTS report or spreadsheet, go only where you save or send them. They aren't locked with a passphrase${f.wearables ? " and never include readings Heard Health gets from a connected watch, ring or health app" : ""}.`;

/** The "Wearable connections" row's Details (so only where the wearables flag is on, the one configuration with wearable connections). */
export const WEAR_RESTORE_LINE = "Restoring a backup brings back its wearable connections on this device.";

/** The line under the Restore button (Settings and the splash). */
export const restoreFoot = (f) => `Unlocked on this device with your passphrase. It replaces your record here.${f.wearables ? " Oura and Fitbit/Garmin/Whoop connections in the backup come back unconfirmed until Heard Health checks them through its server; ones only on this device stay connected." : ""}`;

/** "What a restore changes". This device's choices are kept whatever the server: they are settings on this device. */
export function restoreChanges(f) {
  const keep = on([f.counts && "weekly counts", f.ai && "Heard Health's AI", f.webReminders && "browser reminders", "appearance (light or dark)"]);
  return on([
    `Your settings are replaced too, except this device's choices about ${andList(keep)}.`,
    f.wearables && "If the backup has Oura or Fitbit/Garmin/Whoop connected, that connection comes back on this device marked not confirmed, because it may have been ended since the backup was made. It counts as connected again once Heard Health confirms it through its server: Oura on a Sync that works (checked straight away, and removed from this device if it no longer works), Fitbit/Garmin/Whoop when readings arrive. A Fitbit/Garmin/Whoop connection you ended after the backup can't send readings, so tap Disconnect to remove it. One this device is still waiting to see disconnected isn't restored. A connection this device has now for the same service is replaced, so remove Heard Health in that account if you want it ended.",
    f.wearables && "A connection this device has that the backup doesn't (Oura or Fitbit/Garmin/Whoop) stays connected here and keeps fetching readings through Heard Health's server as before. Tap Disconnect under Wearables on Home if you don't want it.",
    // L5: her "Don't use" choices are part of the record and restored literally (App.jsx importBackup, cleanCycleFlags).
    "Cycles you left out of predictions are restored as the backup has them; a backup made before you left any out uses every cycle again.",
    "A backup made before you turned on POTS tools has no POTS log, so restoring it clears the POTS log on this device.",
  ]);
}

/** After "<b>Delete everything on this device?</b>" (so it starts with a space). */
export function wipeConfirm(f, native, accounts = false) {
  const also = deleteAlso(f, native);
  const tail = accounts
    ? " Heard Health's servers keep no readable copy of your log. An encrypted account backup, if you made one, stays on Heard Health's server until you delete the account or it expires; otherwise your log can't be recovered unless you saved a backup."
    : " Heard Health's servers keep no copy of your log, so it can't be recovered unless you saved a backup.";
  return ` Every check-in, POTS log, note, appointment and setting goes for good.${also ? ` This also ${also}.` : ""}${tail}`;
}

/** The storage line's last sentence in Privacy & your data. */
export const storeCopyLine = (accounts = false) => (accounts ? "Heard Health's servers keep no readable copy: only your encrypted account backup, if you make one." : "Heard Health's servers don't keep a copy.");

/** "More about deleting" (DataControls appends its offline-copy and this-week items after these). */
export function wipeMore(f, native) {
  const li1 = f.wearables ? "If Heard Health's server, Oura or Fitbit/Garmin/Whoop can't confirm that, Heard Health tells you what did and didn't end and keeps your record on this device until you choose."
    : f.webReminders && !native ? "If Heard Health's server can't confirm that, Heard Health tells you what did and didn't end and keeps your record on this device until you choose."
    : null;
  const tail = f.ai && f.wearables ? "Questions already sent to Heard Health's AI stay with Anthropic for a limited time under its own terms, and readings Terra already collected stay under Terra's policy."
    : f.ai ? "Questions already sent to Heard Health's AI stay with Anthropic for a limited time under its own terms."
    : f.wearables ? "Readings Terra already collected stay under Terra's policy."
    : null;
  const li2 = on([f.counts && "Anonymous counts you already shared stay counted.", tail]).join(" ") || null;
  const li3 = native && f.wearables ? "Apple Health or Health Connect access stays on until you turn it off in your phone's settings." : null;
  return on([li1, li2, li3, "Report files you already saved or shared aren't on this device's record. Delete them wherever you put them."]);
}

/** Shown on Delete everything only in a build without wearables whose record still holds a real
    Oura / Fitbit·Garmin·Whoop connection (or an unconfirmed disconnect) from an earlier build or a
    restored backup: this build doesn't ask Cyra's server to end it. */
export const LEGACY_WEAR_LINE = "Heard Health can't end a wearable connection from this version. If you connected Oura, Fitbit, Garmin or Whoop to Heard Health before, remove Heard Health in that account's connected apps (it may be listed as Cyra, and Fitbit, Garmin and Whoop may list it as Terra).";

/* ---------- stage intake, Start over (phone) ---------- */
export const intakeHint = (f) => `Four quick taps. Your answers shape the whole app — one experience, built for where you are. Your answers stay on this device.${f.counts ? " (If you share weekly counts, your life stage is part of what's shared.)" : ""}`;

/** After "<b>Start over on this phone?</b>" (phone only, so reminders always exist). */
export const startOverText = (f, accounts = false) => ` This deletes this phone's record for good and turns off reminders${f.wearables ? ", but doesn't disconnect wearables" : ""}. ${accounts
  ? "Heard Health keeps no readable copy of your record on its servers, so the only way back is an encrypted backup you saved or your account's encrypted backup — you can restore a saved one on the next screen."
  : "Heard Health keeps no copy of your record on its servers, so the only way back is an encrypted backup you saved — you can restore one on the next screen."}`;

/* ---------- POTS tools (the components keep their exported names, computed from these) ---------- */
const potsEnd = (f, accounts) => `${accounts ? `, ${ACCOUNT_EXCEPT}` : ""}${f.counts ? ", and it isn't part of weekly counts." : "."}`;
export const potsTodayFoot = (f, accounts = false) => `Saved on this device as you tap. Heard Health's server never gets your POTS log${potsEnd(f, accounts)}`;
export const potsTodayFootUnsaved = (f, accounts = false) => ({
  memory: `Not being saved: Heard Health couldn't open this browser's storage, so what you log here is lost when you close Heard Health. Heard Health's server never gets your POTS log${potsEnd(f, accounts)}`,
  stale: `Heard Health couldn't confirm your latest taps were saved on this device; they may be lost when you close Heard Health. Heard Health's server never gets your POTS log${potsEnd(f, accounts)}`,
});
export const potsTodayFoot2 = (f) => `${f.counts ? "Never part of weekly counts. " : ""}Heard Health can't diagnose POTS; only a clinician can.`;
export const potsHintTail = (f) => `${f.counts ? "Never part of weekly counts. " : ""}Heard Health can't diagnose POTS; only a clinician can, and good notes make that visit faster.`;
export const potsNeverSent = (f, accounts = false) => {
  const s = f.counts && f.ai ? "None of it is part of weekly counts, and none of it is sent to Heard Health's server or Heard Health's AI."
    : f.counts ? "None of it is part of weekly counts, and none of it is sent to Heard Health's server."
    : f.ai ? "None of it is sent to Heard Health's server or Heard Health's AI."
    : "None of it is sent to Heard Health's server.";
  return accounts ? `${s.slice(0, -1)}, ${ACCOUNT_EXCEPT}.` : s;
};

/* ---------- the splash, the lock screen and the registration consent card (calm R9) ---------- */
/** The splash promise's second item. */
export const splashAccountLine = (accounts = false) => (accounts
  ? "No account needed. An account is optional and only keeps an encrypted backup, and your name and email are optional too."
  : "No account needed. There's no Heard Health account to make, and your name and email are optional.");
/** The consent card's backup fact. */
export const consentBackupFact = (accounts = false) => `A backup is a file you keep, locked with a passphrase only you know. Heard Health never receives the file or the passphrase, so we can't read it or recover a lost passphrase.${accounts ? " The optional account keeps the same kind of encrypted backup on Heard Health's server; Heard Health can't read it or recover that passphrase either." : ""}`;
/** The report's watch/ring sentence: only where a watch, ring or health app can be connected at all. */
export const potsFixedLine = (f) => (f.wearables ? "Readings Heard Health gets from a connected watch, ring or health app aren't included in this report or spreadsheet. Heart rates and blood pressures you type in yourself are, even if you read them off a watch." : null);
export const potsRemindersLine = (f, native) => (remindersInBuild(native, f)
  ? "Heard Health doesn't send medicine or drink reminders. The only reminder Heard Health can send is your check-in reminder, if you turned it on. If reminders help you, your phone's clock app can set them."
  : "Heard Health doesn't send medicine or drink reminders. If reminders help you, your phone's clock app can set them.");

/* ---------- fertility signs (L7, decision D6) ---------- */
/** The privacy line under Today's Fertility signs group and in Settings' "Track fertility signs" row. Each clause only
    where this build has the feature it names; all are true in every build (the fields live only in the day entries:
    contribute() gets { sym, sleepQ, flow } and the AI request body is { question }). */
export const fertPrivacyLine = (f) => (f.counts && f.ai ? "Kept on this device. Never part of weekly counts or sent to Heard Health's AI."
  : f.counts ? "Kept on this device. Never part of weekly counts."
  : f.ai ? "Kept on this device. Never sent to Heard Health's AI."
  : "Kept on this device.");
