#!/usr/bin/env python3
"""Makes the recorded voice guide with Kokoro (open-source, Apache-2.0 model; free, commercial use allowed), on this
machine, with no account and no network call at run time. Same output as scripts/make-voice.mjs: one .mp3 per line in
src/lib/voice.js VOICE_LINES, plus public/voice/manifest.json. The app only plays the finished files.

Setup once (any folder outside the repo):
  python3 -m venv venv && venv/bin/pip install kokoro-onnx soundfile
  download kokoro-v1.0.onnx and voices-v1.0.bin from
  https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
Run from the repo root (needs node and ffmpeg):
  KOKORO_DIR=/path/to/model/folder /path/to/venv/bin/python scripts/make-voice-kokoro.py
Options (environment): KOKORO_VOICE (default af_heart; try af_bella, af_nicole, bf_emma), KOKORO_SPEED (default 0.85).
"""
import json, os, subprocess, sys, tempfile
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, "public", "voice")
model_dir = os.environ.get("KOKORO_DIR") or sys.exit("Set KOKORO_DIR to the folder with kokoro-v1.0.onnx and voices-v1.0.bin")
voice = os.environ.get("KOKORO_VOICE", "af_heart")
speed = float(os.environ.get("KOKORO_SPEED", "0.85"))
lang = "en-gb" if voice.startswith("b") else "en-us"

# The lines and their ids come from the app's own code, so the clips always match what the app asks for.
js = 'import("./src/lib/voice.js").then(m=>console.log(JSON.stringify(m.VOICE_LINES.map(t=>[m.clipId(t),t]))))'
lines = json.loads(subprocess.check_output(["node", "-e", js], cwd=root))

os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    if f.endswith(".mp3") or f == "manifest.json":
        os.remove(os.path.join(out, f))
k = Kokoro(os.path.join(model_dir, "kokoro-v1.0.onnx"), os.path.join(model_dir, "voices-v1.0.bin"))
clips = {}
for cid, text in lines:
    audio, sr = k.create(text, voice=voice, speed=speed, lang=lang)
    # A soft quarter-second of silence before and after, so a clip never starts or stops abruptly.
    pad = np.zeros(int(sr * 0.25), dtype=audio.dtype)
    audio = np.concatenate([pad, audio, pad])
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        sf.write(tmp.name, audio, sr)
    target = os.path.join(out, f"{cid}.mp3")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", tmp.name, "-ac", "1", "-b:a", "64k",
                    "-af", "afade=t=in:d=0.05,loudnorm=I=-20:TP=-2", target], check=True)
    os.remove(tmp.name)
    clips[cid] = f"{cid}.mp3"
    print(f"{cid}.mp3  {text}")
with open(os.path.join(out, "manifest.json"), "w") as fh:
    json.dump({"voice": "Recorded calm voice", "engine": "kokoro-v1.0", "voiceId": voice, "speed": speed, "clips": clips}, fh, indent=2)
    fh.write("\n")
print(f"Done: {len(clips)} clips in public/voice/.")
