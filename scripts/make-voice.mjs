#!/usr/bin/env node
/* Makes the recorded voice guide for Mind practices: one .mp3 per line in src/lib/voice.js VOICE_LINES (the breathing
   cues and every practice step), spoken by a calm, natural female voice from ElevenLabs, plus public/voice/manifest.json.
   Run once on a developer machine whenever a practice's wording changes; the clips are then ordinary static files the
   app plays from its own site. The app never calls ElevenLabs and nothing about a user is ever sent there.

   Usage:
     ELEVENLABS_API_KEY=... node scripts/make-voice.mjs            # make missing clips (keeps ones already made)
     ELEVENLABS_API_KEY=... node scripts/make-voice.mjs --all      # remake every clip (e.g. after changing the voice)
     ELEVENLABS_API_KEY=... node scripts/make-voice.mjs --voices   # list the voices on the account, to pick one
     ELEVENLABS_API_KEY=... node scripts/make-voice.mjs --sample   # make one sample, public/voice/sample.mp3, to listen first
   Options (environment):
     ELEVENLABS_VOICE_ID   the voice (default: Rachel, a calm, warm female narrator from ElevenLabs' default library)
     ELEVENLABS_MODEL      default eleven_multilingual_v2 (the most natural-sounding of their models)
   Commercial use of the clips needs a paid ElevenLabs plan (Starter or higher); the free plan requires attribution and
   does not allow commercial use. The key is a developer secret: never commit it and never put it in the app. */
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VOICE_LINES, clipId } from "../src/lib/voice.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "voice");
const manifestPath = path.join(outDir, "manifest.json");
const KEY = process.env.ELEVENLABS_API_KEY || "";
const VOICE = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
const API = "https://api.elevenlabs.io/v1";
const args = new Set(process.argv.slice(2));

// Calm delivery: steady (higher stability), little added style, a touch slower than normal speech.
const SETTINGS = { stability: 0.7, similarity_boost: 0.75, style: 0.1, use_speaker_boost: true, speed: 0.88 };

if (!KEY) { console.error("Set ELEVENLABS_API_KEY (see the comment at the top of this file)."); process.exit(1); }

async function tts(text) {
  // A short silence before and after keeps the delivery unhurried; the trailing pause lets a breath cue settle.
  const res = await fetch(`${API}/text-to-speech/${VOICE}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: SETTINGS }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

if (args.has("--voices")) {
  const res = await fetch(`${API}/voices`, { headers: { "xi-api-key": KEY } });
  if (!res.ok) { console.error(`ElevenLabs ${res.status}: ${await res.text()}`); process.exit(1); }
  const { voices = [] } = await res.json();
  for (const v of voices) console.log(`${v.voice_id}  ${v.name}  ${[v.labels?.gender, v.labels?.accent, v.labels?.description, v.labels?.use_case].filter(Boolean).join(", ")}`);
  process.exit(0);
}

await mkdir(outDir, { recursive: true });

if (args.has("--sample")) {
  await writeFile(path.join(outDir, "sample.mp3"), await tts("Sit comfortably. Notice what's on your mind right now, without changing it. Breathe in... and out."));
  console.log("Wrote public/voice/sample.mp3. Listen, then run without --sample. Delete the sample before committing.");
  process.exit(0);
}

let old = { clips: {} };
try { old = JSON.parse(await readFile(manifestPath, "utf8")); } catch { /* first run */ }
const remake = args.has("--all") || (old.voiceId && old.voiceId !== VOICE) || (old.model && old.model !== MODEL);
const clips = {};
let made = 0;
for (const line of VOICE_LINES) {
  const id = clipId(line);
  const file = `${id}.mp3`;
  const target = path.join(outDir, file);
  if (!remake && old.clips?.[id] === file && existsSync(target)) { clips[id] = file; continue; }
  process.stdout.write(`${file}  ${line}\n`);
  await writeFile(target, await tts(line));
  clips[id] = file;
  made += 1;
}
// Clips for lines that no longer exist are removed so the folder matches the practices.
for (const [id, file] of Object.entries(old.clips || {})) if (!clips[id]) { try { await unlink(path.join(outDir, file)); } catch { /* already gone */ } }
await writeFile(manifestPath, `${JSON.stringify({ voice: "Recorded calm voice", voiceId: VOICE, model: MODEL, clips }, null, 2)}\n`);
console.log(`Done: ${made} made, ${Object.keys(clips).length} in public/voice/manifest.json.`);
