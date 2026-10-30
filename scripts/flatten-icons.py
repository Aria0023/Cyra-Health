#!/usr/bin/env python3
"""Second step after `node scripts/make-icons.mjs`: Chromium writes RGBA PNGs, and the App Store refuses an app
icon with an alpha channel, so every icon drawn on full-bleed paper is saved again as opaque RGB (Pillow).
The Android round and adaptive-foreground icons keep their transparency. Run from the repo root."""
import glob
from PIL import Image

KEEP_ALPHA = ("ic_launcher_round.png", "ic_launcher_foreground.png")
files = glob.glob("public/icons/*.png") + glob.glob("ios/App/App/Assets.xcassets/*/*.png") + glob.glob("android/app/src/main/res/*/*.png")
for f in sorted(files):
    if f.endswith(KEEP_ALPHA):
        continue
    im = Image.open(f)
    if im.mode != "RGB":
        im.convert("RGB").save(f, optimize=True)
        print("flattened", f)
