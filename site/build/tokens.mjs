/* The website's colours and faces, generated from the app's own tokens (src/lib/constants.js, read by app-data.mjs):
   the default Soft style's palette (Periwinkle & Rose, the brand's colour), its light and dark scheme tokens, the type
   faces, and each life stage's own palette for its illustration. site/css/site.css uses these variables and holds no
   colour of its own (src/lib/site.test.mjs scans it). UI palette tokens only: no data-viz ramp is used on the site.
   Pure: no imports. */

const decls = (o) => Object.entries(o).map(([k, v]) => `${k}:${v}`).join(";");
const palette = (p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [`--${k}`, v]));
const stageDecls = (s) => `--primary:${s.primary};--accent:${s.accent}`;

/** The :root tokens (light, then dark by the visitor's system setting) and one [data-stage] rule per life stage. */
export function tokensCss(tokens) {
  const { shape } = tokens;
  const faces = { "--ff-display": shape["--ff-display"], "--ff-body": shape["--ff-body"] };
  const light = { ...palette(tokens.palette.light), ...tokens.scheme.light, ...faces };
  const dark = { ...palette(tokens.palette.dark), ...tokens.scheme.dark };
  const stages = Object.entries(tokens.stages);
  return [
    `:root{color-scheme:light dark;${decls(light)}}`,
    ...stages.map(([k, s]) => `[data-stage="${k}"]{${stageDecls(s.light)}}`),
    `@media (prefers-color-scheme:dark){:root{${decls(dark)}}${stages.map(([k, s]) => `[data-stage="${k}"]{${stageDecls(s.dark)}}`).join("")}}`,
  ].join("\n");
}

/** The two theme-color values for the browser's own chrome: the paper of each scheme. */
export const themeColors = (tokens) => ({ light: tokens.palette.light.paper, dark: tokens.palette.dark.paper });
