# Solia Health brand

Renamed from Heard Health on 2026-11-01 (and from Cyra on 2026-10-30). Slogan: **I am Heard** (unchanged).

## Files
- `solia-mark.svg`: the mark on paper (light).
- `solia-mark-dark.svg`: the mark on night paper (dark).
- `solia-wordmark.svg`: the mark with the wordmark "Solia" + "HEALTH" (live text, see below).
- The app draws the mark from the same shapes (`src/components/BrandMark.jsx`); the app icons, the native icon
  sets and the splash images are rendered from it by `scripts/make-icons.mjs` (then `scripts/flatten-icons.py`).
  The favicon is `public/icons/favicon.svg` (it follows the browser's light or dark setting).

## The mark
A soft ring with a half-sun rising from a short horizon inside it ("sol", the sun) and one small dot above it (a day
logged). Calm and round; it reads at 32 px. Drawn on a 64 x 64 grid: ring radius 22, stroke 5; half-sun radius 11 on
the horizon at y 39; horizon 27 units long, stroke 4.5 with round caps, clear of the ring; dot radius 3.4 at (42.5, 21.5).

## Colours
| use | hex | on |
| --- | --- | --- |
| Mark, light | `#4A5DB0` periwinkle | paper `#FAF7F4` (5.4:1) |
| Mark, dark | `#A7B5F4` | night paper `#131520` |
| Wordmark text | ink `#1E2132` / `#E9EAF3` in dark | paper / night paper |

One accent only: marketing uses periwinkle. The app's stage palettes, the Mono style and the data-viz ramps stay
separate from the brand colours.

## Type
"Solia" in Fraunces 600; "HEALTH" in Karla 700, capitals, letter-spaced, beside it. In running text the name is
"Solia Health"; a bare "Solia" appears only in the wordmark and the home-screen app label. The slogan is "I am Heard".

## Clear space and size
- Clear space: at least twice the ring's stroke (10 units on the 64 grid) on every side.
- Minimum size: 16 px for the mark alone (favicon); 32 px where it must read clearly (app lists). The wordmark
  no smaller than 18 px for "Solia".
- App icons: the mark sits centred, about two thirds of the icon's height (half for maskable and adaptive icons, so it
  stays inside the safe zone).

## Do
- Use the mark in one colour on paper or night paper.
- Keep the sun on its horizon, the dot at the upper right.
- Print one colour (periwinkle or black) on clinic cards.

## Don't
- Don't rotate, stretch or outline the mark, add rays, or let the horizon touch the ring.
- Don't add a uterus, flower, moon, egg or goddess imagery, gradients or pink-on-pink.
- Don't put the mark on a busy photo or on the stage accent colours.
- Don't use a bare "Solia" in sentences.
