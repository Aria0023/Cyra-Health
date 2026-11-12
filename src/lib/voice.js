/* Voice guide for Mind practices. Two sources, best first:
   1. Recorded clips: a calm, natural female voice, made once ahead of time by scripts/make-voice.mjs and shipped as
      static files in public/voice/ (manifest.json maps each line's id to its .mp3). The app plays them from its own
      site like any image or font; nothing about her is sent, and nothing she says is recorded.
   2. Where a line has no clip (or no clips ship in this build): this device's own text-to-speech (speechSynthesis, which
      the iOS and Android web views also have), using the most natural female English voice the device offers, at a
      slow, low, calm setting.
   Free, like every practice. Where neither can play, voiceSupported() is false and the switch is not shown. Her on/off
   is the device-only record key practiceVoice (lib/record.js), like practiceHaptics.
   Pure apart from the playback functions at the bottom; the rest runs in `node --test`. */
import { PRACTICES } from "./mind.js";

/** The words for a moment of a practice: breathing phases get a short cue, steps their own text. */
export const BREATH_CUES = Object.freeze({ in: "Breathe in", hold: "Hold", out: "and out", rest: "Rest" });
export function voiceCue(kind, at) {
  if (!at) return "";
  if (kind === "breath") return BREATH_CUES[at.phase] || "";
  return typeof at.text === "string" ? at.text : "";
}

/** Every line the guide can speak: the breathing cues and each step of every practice, once each. */
export const VOICE_LINES = Object.freeze([...new Set([
  ...Object.values(BREATH_CUES),
  ...PRACTICES.flatMap((p) => (Array.isArray(p.steps) ? p.steps.map((s) => s.text) : [])),
])].filter((s) => typeof s === "string" && s.trim()));

/** A short stable id for a line (FNV-1a, 32-bit, hex): the clip's file name and its key in the manifest. */
export function clipId(text) {
  const s = String(text || "").trim().replace(/\s+/g, " ");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

/** A manifest as read from public/voice/manifest.json, kept only if well formed: { voice, clips: { id: "id.mp3" } }. */
export function cleanManifest(raw) {
  if (!raw || typeof raw !== "object" || !raw.clips || typeof raw.clips !== "object") return null;
  const clips = {};
  for (const [id, file] of Object.entries(raw.clips)) if (/^[0-9a-f]{8}$/.test(id) && typeof file === "string" && /^[0-9a-f]{8}\.mp3$/.test(file)) clips[id] = file;
  return Object.keys(clips).length ? { voice: typeof raw.voice === "string" ? raw.voice.slice(0, 80) : "", clips } : null;
}

/* Device voices, most natural and calm first. Premium / Enhanced (Apple), Natural (Microsoft) and Google's female voices
   sound far less mechanical than the default compact voices. Only English voices are considered. */
const PREFERRED = [
  /\b(ava|zoe|samantha|allison|susan|serena|karen|moira|tessa|fiona|nicky|evan?a)\b.*\((premium|enhanced)\)/i,
  /\bmicrosoft (ava|emma|jenny|aria|michelle|sonia|libby|natasha|clara)\b.*natural/i,
  /google uk english female/i,
  /\b(ava|zoe|samantha|allison|susan|serena|karen|moira|tessa|fiona|nicky)\b/i,
  /google us english/i,
  /\bfemale\b/i,
  /\b(jenny|aria|zira|hazel|catherine|libby|sonia)\b/i,
];
const rank = (v) => { const i = PREFERRED.findIndex((re) => re.test(v.name || "")); return i < 0 ? PREFERRED.length : i; };

/** The calmest English voice this device has: the best match above (a local one on a tie), else the default English
    voice, else a local English one, else any English one. */
export function pickVoice(voices, lang = "en") {
  const en = (Array.isArray(voices) ? voices : []).filter((v) => v && typeof v.lang === "string" && v.lang.toLowerCase().startsWith(lang));
  if (!en.length) return null;
  const best = [...en].sort((a, b) => rank(a) - rank(b) || Number(!!b.localService) - Number(!!a.localService))[0];
  if (rank(best) < PREFERRED.length) return best;
  return en.find((v) => v.default) || en.find((v) => v.localService) || en[0];
}

/** How the device voice speaks: slower and a little lower than normal speech. */
export const DEVICE_RATE = 0.82;
export const DEVICE_PITCH = 0.95;

/* ---- playback (browser only) ---- */
const synth = () => (typeof window !== "undefined" && window.speechSynthesis && typeof window.SpeechSynthesisUtterance === "function" ? window.speechSynthesis : null);
const canPlayAudio = () => typeof window !== "undefined" && typeof window.Audio === "function";
const base = () => { try { return (import.meta.env && import.meta.env.BASE_URL) || "/"; } catch { return "/"; } };

let manifest; // undefined: not asked yet; null: none in this build; else the clean manifest
let loading = null;
let current = null; // the clip playing now

/** Read public/voice/manifest.json once. Resolves to whether recorded clips are available. */
export function loadClips() {
  if (manifest !== undefined) return Promise.resolve(!!manifest);
  if (!loading) {
    loading = (typeof fetch === "function" ? fetch(`${base()}voice/manifest.json`, { cache: "no-cache" }) : Promise.reject(new Error("no fetch")))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { manifest = cleanManifest(j); return !!manifest; })
      .catch(() => { manifest = null; return false; });
  }
  return loading;
}
/** Whether this build ships recorded clips (after loadClips has finished). */
export const clipsReady = () => !!manifest && canPlayAudio();

/** Whether this device can play the guide at all. */
export const voiceSupported = () => !!synth() || clipsReady();

function speakDevice(text) {
  const s = synth();
  if (!s || !text) return;
  try {
    s.cancel();
    const u = new window.SpeechSynthesisUtterance(text);
    u.rate = DEVICE_RATE;
    u.pitch = DEVICE_PITCH;
    const v = pickVoice(s.getVoices());
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-US";
    s.speak(u);
  } catch { /* no voice now: the practice carries on silently */ }
}

/** Speak `text`: its recorded clip when there is one, else the device voice. Replaces anything still playing. */
export function speak(text) {
  if (!text) return;
  hush();
  const file = manifest && canPlayAudio() ? manifest.clips[clipId(text)] : null;
  if (!file) { speakDevice(text); return; }
  try {
    const a = new window.Audio(`${base()}voice/${file}`);
    current = a;
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => { if (current === a) { current = null; speakDevice(text); } });
  } catch { current = null; speakDevice(text); }
}
/** Stop at once (pause, stop, close). */
export function hush() {
  if (current) { try { current.pause(); } catch { /* already stopped */ } current = null; }
  try { synth()?.cancel(); } catch { /* nothing to stop */ }
}
