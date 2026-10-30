#!/usr/bin/env python3
"""Cyra's app icons (spec A14.1), drawn from the splash's three-circle motif.

What it draws: the motif from src/screens/SplashScreen.jsx in its 96x64 viewBox,
  circle (30,32) r28 in PRIMARY #7A2F4E at alpha .92,
  circle (62,30) r22 in ACCENT  #AB6229 at alpha .85,
  circle (46,42) r18 in PRIMARY #7A2F4E at alpha .55
(the splash uses .14 / .18 / .08; the alphas are raised so the mark reads at icon size),
on full-bleed paper #EDE4DC (ORGS.cyra.theme.paper, the colour the splash and the
installed app's launch screen show). The motif's bounding box (2,4)-(84,60) is centred.
No text. Every file is opaque RGB.

Files (public/icons/, committed; the build only copies them):
  icon-192.png, icon-512.png                    purpose "any", motif width 0.78 of the canvas
  icon-maskable-192.png, icon-maskable-512.png  purpose "maskable", motif width 0.62, so the
                                                motif's whole bounding box stays inside the
                                                80% safe circle
  apple-touch-icon.png                          180x180, motif width 0.74

Each circle is composited as its own RGBA layer (Image.alpha_composite) at 4x
supersampling, then resized with LANCZOS, converted to RGB and saved with optimize=True.

Run by hand from the repo root (Python 3 + Pillow; never run by the build, no npm
dependency):
    python3 scripts/make-icons.py
"""
import os

from PIL import Image, ImageDraw

PAPER = (0xED, 0xE4, 0xDC)
PRIMARY = (0x7A, 0x2F, 0x4E)
ACCENT = (0xAB, 0x62, 0x29)
CIRCLES = [  # (cx, cy, r, colour, alpha) in the splash's 96x64 viewBox
    (30, 32, 28, PRIMARY, 0.92),
    (62, 30, 22, ACCENT, 0.85),
    (46, 42, 18, PRIMARY, 0.55),
]
BOX = (2, 4, 84, 60)  # the motif's bounding box in viewBox units
SUPER = 4
OUT = os.path.join("public", "icons")
ICONS = [
    ("icon-192.png", 192, 0.78),
    ("icon-512.png", 512, 0.78),
    ("icon-maskable-192.png", 192, 0.62),
    ("icon-maskable-512.png", 512, 0.62),
    ("apple-touch-icon.png", 180, 0.74),
]


def draw(size, width_frac):
    big = size * SUPER
    img = Image.new("RGBA", (big, big), PAPER + (255,))
    x0, y0, x1, y1 = BOX
    scale = width_frac * big / (x1 - x0)
    # Centre the bounding box on the canvas.
    ox = (big - (x1 - x0) * scale) / 2 - x0 * scale
    oy = (big - (y1 - y0) * scale) / 2 - y0 * scale
    for cx, cy, r, colour, alpha in CIRCLES:
        layer = Image.new("RGBA", (big, big), (0, 0, 0, 0))
        x, y, rr = ox + cx * scale, oy + cy * scale, r * scale
        ImageDraw.Draw(layer).ellipse((x - rr, y - rr, x + rr, y + rr), fill=colour + (round(alpha * 255),))
        img = Image.alpha_composite(img, layer)
    return img.resize((size, size), Image.LANCZOS).convert("RGB")


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, size, frac in ICONS:
        path = os.path.join(OUT, name)
        draw(size, frac).save(path, optimize=True)
        print(f"wrote {path} ({size}x{size}, motif width {frac})")


if __name__ == "__main__":
    main()
