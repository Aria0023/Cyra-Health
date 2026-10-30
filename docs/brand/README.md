# Heard Health brand

Renamed from Cyra on 2026-10-30. Slogan: **I am Heard**.

## Files
- `heard-mark.svg`: the mark on paper (light).
- `heard-mark-dark.svg`: the mark on night paper (dark).
- `heard-wordmark.svg`: the mark with the wordmark "Heard" + "HEALTH" (live text, see below).
- The app draws the mark from the same paths (`src/components/BrandMark.jsx`); the app icons, the native icon
  sets and the splash images are rendered from it by `scripts/make-icons.mjs`. The favicon is
  `public/icons/favicon.svg` (it follows the browser's light or dark setting).

## The mark
A soft ring (the cycle) with a short open gap and a rounded speech tail at the gap, and one solid dot inside (a day
logged, a voice). Drawn on a 64 x 64 grid: ring radius 19, stroke 6 with round caps, dot radius 5.5.

## Colours
| use | hex | on |
| --- | --- | --- |
| Mark, light | `#4A5DB0` periwinkle | paper `#FAF7F4` (5.4:1) |
| Mark, dark | `#A7B5F4` | night paper `#131520` |
| Wordmark text | ink `#1E2132` / `#E9EAF3` in dark | paper / night paper |

One accent only: marketing uses periwinkle. The app's stage palettes and the data-viz ramps stay separate from the
brand colours.

## Type
"Heard" in Fraunces 600; "HEALTH" in Karla 700, capitals, letter-spaced, beside it. In running text the name is
always "Heard Health" (never a bare "Heard", which reads as a verb). Bare "Heard" appears only in the wordmark, the
home-screen app label and the slogan.

## Clear space and size
- Clear space: at least twice the stroke width (12 units on the 64 grid, about a quarter of the mark's height) on every side.
- Minimum size: 16 px for the mark alone (favicon); 32 px where it must read clearly (app lists). The wordmark
  no smaller than 18 px for "Heard".
- App icons: the mark sits centred, about two thirds of the icon's height (half for maskable and adaptive icons, so it
  stays inside the safe zone).

## Do
- Use the mark in one colour on paper or night paper.
- Keep the gap and the tail at the lower left.
- Print one colour (periwinkle or black) on clinic cards.

## Don't
- Don't rotate, stretch or outline the mark, or close the gap.
- Don't add a uterus, flower, moon, egg or goddess imagery, gradients or pink-on-pink.
- Don't put the mark on a busy photo or on the stage accent colours.
- Don't shorten the name to "Heard" in sentences.
