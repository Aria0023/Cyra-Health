/* Voice guide for Mind practices (Task 3): the device's own text-to-speech (the browser's speechSynthesis, which the iOS
   and Android web views also have) speaks each step, and short cues for breathing ("Breathe in", "and out"). Nothing is
   recorded or sent: the words are spoken by this device's built-in voice. Free, like every practice. Where
   speechSynthesis is missing, voiceSupported() is false and the switch is not shown. Her on/off is the device-only record
   key practiceVoice (lib/record.js), like practiceHaptics. */

/** The words for a moment of a practice: breathing phases get a short cue, steps their own text. */
export function voiceCue(kind, at) {
  if (!at) return "";
  if (kind === "breath") return { in: "Breathe in", hold: "Hold", out: "and out", rest: "Rest" }[at.phase] || "";
  return typeof at.text === "string" ? at.text : "";
}

/** An English voice to speak with: this device's default English voice, else a local English one, else any English one. */
export function pickVoice(voices, lang = "en") {
  const en = (Array.isArray(voices) ? voices : []).filter((v) => v && typeof v.lang === "string" && v.lang.toLowerCase().startsWith(lang));
  return en.find((v) => v.default) || en.find((v) => v.localService) || en[0] || null;
}

const synth = () => (typeof window !== "undefined" && window.speechSynthesis && typeof window.SpeechSynthesisUtterance === "function" ? window.speechSynthesis : null);
/** Whether this device can speak at all. */
export const voiceSupported = () => !!synth();

/** Speak `text` calmly (rate 0.9), replacing anything still being said. */
export function speak(text) {
  const s = synth();
  if (!s || !text) return;
  try {
    s.cancel();
    const u = new window.SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    u.pitch = 1;
    const v = pickVoice(s.getVoices());
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-US";
    s.speak(u);
  } catch { /* no voice now: the practice carries on silently */ }
}
/** Stop speaking at once (pause, stop, close). */
export function hush() { try { synth()?.cancel(); } catch { /* nothing to stop */ } }
