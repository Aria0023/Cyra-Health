/* One stylesheet, injected once per screen shell. CSS custom properties come from
   the active palette (see App.jsx). The fonts are bundled (src/main.jsx imports
   @fontsource-variable/fraunces and /karla), so this stylesheet loads nothing from
   another server. The bundled faces are named 'Fraunces Variable' and 'Karla Variable';
   plain 'Fraunces' / 'Karla' stay listed as fallbacks for a locally installed copy. */
import { SCHEME_TOKENS } from "./lib/constants.js";
import { tokenDecls } from "./lib/appearance.js";

export const css = `
/* ---- tokens (spec §8.4): one type scale, one grid, one set of radii and motion timings. --primary-text is the
   body-text tint of the palette primary (AA on paper at 12.5px in every palette); --good/--bad are the two status
   hues; --sa-* are the device safe-area insets (Capacitor's --safe-area-inset-* first, then env(), then 0).
   L2: every status and surface colour (--good, --bad, --on-primary, --knob, the --sh-* shadows, …) is a token from
   SCHEME_TOKENS in lib/constants.js, its light value here and its dark value in the rule below. No colour literal
   appears in this stylesheet outside the print block (lib/appearance.test.mjs scans for one). ---- */
.cy { --fs-xs:11px; --fs-sm:12.5px; --fs-md:13.5px; --fs-lg:15.5px; --fs-num:23px; --fs-title:26px; --r-card:20px; --r-inner:14px; --r-tile:16px; --r-btn:16px; --r-pill:999px; --gap:8px; --stack:12px; --t-fast:100ms; --t-base:200ms; --t-slow:300ms; --ease-std:cubic-bezier(.2,0,0,1); --ease-in:cubic-bezier(.05,.7,.1,1); --ease-out:cubic-bezier(.3,0,.8,.15); --primary-text:color-mix(in srgb, var(--primary) 82%, var(--ink)); --accent-text:color-mix(in srgb, var(--accent) 82%, var(--ink)); ${tokenDecls(SCHEME_TOKENS.light)}; --sa-t:var(--safe-area-inset-top, env(safe-area-inset-top, 0px)); --sa-b:var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)); background:linear-gradient(180deg, transparent 0, var(--paper) 340px) no-repeat, linear-gradient(105deg, var(--wash-a), var(--wash-b) 52%, var(--wash-c)) no-repeat, var(--paper); background-size:100% 340px, 100% 340px, auto; color:var(--ink); font-family:'Karla Variable','Karla',sans-serif; line-height:1.5; min-height:100dvh; max-width:430px; margin:0 auto; padding:18px 16px 48px; box-sizing:border-box; color-scheme:light; }
/* Dark (L2, spec §8.4): App.jsx resolves Appearance to data-scheme on .cy; the palette and data-viz variables arrive inline. */
.cy[data-scheme="dark"] { color-scheme:dark; ${tokenDecls(SCHEME_TOKENS.dark)} }
/* html is above .cy, so the one html-level rule (scroll padding under the POTS stop bar) gets the same inset tokens. */
html { --sa-t:var(--safe-area-inset-top, env(safe-area-inset-top, 0px)); --sa-b:var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)); }
.cy * { box-sizing:border-box; }
.mast { display:flex; flex-wrap:wrap; justify-content:flex-end; align-items:center; gap:4px; margin-bottom:10px; }
/* One row on a 390px phone (spec A1): wordmark, name chip (ellipsised past 110px), two 44px icon chips, the quiet stage link.
   The chips can still narrow (their text wraps inside) and only when even that doesn't fit does the last one move to a second row, so the page never scrolls sideways. */
.mast > .mark { margin-right:auto; }
.mast > .stagechip, .mast > .acctchip { flex:1 1 min-content; max-width:max-content; margin-right:0; }
.mast > .stagechip.icon { flex:0 0 44px; max-width:44px; }
.mark { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:22px; }
.sub { font-size:10.5px; font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:var(--primary-text); margin-left:7px; vertical-align:3px; }
.orgsel { display:flex; gap:4px; background:var(--card); border:1px solid var(--line); border-radius:999px; padding:3px; }
.orgbtn { border:none; background:none; border-radius:999px; padding:5px 12px; font:700 11.5px 'Karla Variable','Karla'; color:var(--soft); cursor:pointer; }
.orgbtn.on { background:var(--primary); color:var(--on-primary); }
.topnav { display:flex; gap:4px; margin-bottom:12px; }
.topbtn { flex:1; border:1px solid var(--line); background:var(--card); border-radius:999px; padding:8px 1px; font:700 11px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
.topbtn.on { background:var(--primary); border-color:var(--primary); color:var(--on-primary); }
.stagebar { display:flex; gap:7px; margin-bottom:14px; }
.stagesel { flex:1; display:flex; flex-direction:column; gap:1px; align-items:flex-start; border:1px solid var(--line); background:var(--card); border-radius:12px; padding:9px 11px; cursor:pointer; font-family:'Karla Variable','Karla'; }
.stagesel b { font-size:13px; color:var(--ink); } .stagesel span { font-size:10.5px; color:var(--soft); }
.stagesel.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 8%, var(--card)); }
.stagesel.on b { color:var(--primary-text); }
/* ---- navigation (calm R2, spec §3): the five-tab nav pill (styles under "The nav pill" below) is fixed at the bottom,
   so the page keeps room for it, the sticky save bar stops just above it and the toast rises over it. A tab that hosts
   several views shows them as a pill segmented control (.subnav .seg) at the top of its panel; the view under it fades
   in on a switch (keyed remount, once per switch; off under reduced motion). ---- */
html { scroll-padding-top:16px; scroll-padding-bottom:calc(150px + var(--sa-b)); }
.cy:has(.navpill.fixed) { padding-bottom:calc(104px + var(--sa-b)); }
.cy:has(.navpill.fixed) .stopbar { bottom:calc(76px + var(--sa-b)); }
.cy:has(.navpill.fixed) .stopbar.savebar { padding-bottom:10px; border-radius:var(--r-card) var(--r-card) 0 0; }
.cy:has(.navpill.fixed) .toast { bottom:calc(92px + var(--sa-b)); }
.cy:has(.navpill.fixed):has(.stopbar) .toast { bottom:calc(158px + var(--sa-b)); }
.subnav { margin:2px 0 16px; }
.subseg { box-shadow:var(--sh-opt); border-color:var(--edge); }
.subseg .mc { font-size:var(--fs-sm); }
.subseg .mc.on { box-shadow:0 4px 12px -6px var(--primary); }
.viewpanel { animation:cy-fade-rise var(--t-base) var(--ease-in); }
.disp { font-family:'Fraunces Variable','Fraunces',serif; font-weight:440; font-size:var(--fs-title); line-height:1.14; margin:0 0 8px; }
.hint { font-size:var(--fs-md); line-height:1.55; color:var(--soft); margin:0 0 16px; }
.chips { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-bottom:16px; }
.chip { border:1px solid var(--line); background:var(--card); box-shadow:var(--sh-card); border-radius:var(--r-card); padding:11px; text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:5px; font-size:13.5px; color:var(--ink); }
.dots { font-size:10.5px; letter-spacing:3px; color:var(--soft); }
/* Family colour on the data-bearing part only: a chip's dots take its symptom family's colour (--fc, FAMILIES) once it
   has a value, and pop 120ms on each change (keyed remount; none under reduced motion). Borders and backgrounds stay on the palette. */
.chip:not(.sev-0) .dots { color:var(--fc, var(--primary)); display:inline-block; }
.chip .dots[data-tick] { animation:cy-pop 120ms var(--ease-std); }
.chip.sev-1 { border-color:color-mix(in srgb, var(--accent) 60%, var(--line)); background:color-mix(in srgb, var(--accent) 7%, var(--card)); }
.chip.sev-2 { border-color:var(--accent); background:color-mix(in srgb, var(--accent) 16%, var(--card)); }
.chip.sev-3 { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 14%, var(--card)); font-weight:700; }
.row { display:flex; gap:var(--gap); margin-bottom:16px; }
.pill { flex:1; border:1px solid var(--line); background:var(--card); border-radius:999px; padding:9px 4px; font:500 13px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
.pill-on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 12%, var(--card)); color:var(--primary); font-weight:700; }
.cta { width:100%; border:none; border-radius:var(--r-btn); box-shadow:0 6px 16px -8px var(--primary); background:var(--primary); color:var(--on-primary); font:700 14px 'Karla Variable','Karla'; padding:14px; cursor:pointer; }
.cta:disabled { opacity:.6; }
/* Patterns charts (components/PatternCharts.jsx): data colours come from FAMILIES in lib/constants.js, never the UI palette. */
.backbar { margin:4px 0 2px; } .backbar .linkbtn { font-size:14px; }
.pchart { background:var(--card); border:1px solid var(--edge); border-radius:var(--r-card); box-shadow:var(--sh-card); padding:12px 12px 10px; margin-bottom:var(--gap); }
.psvg:focus:not(:focus-visible) { outline:none; }
.psvg { display:block; width:100%; height:auto; overflow:visible; touch-action:pan-y; cursor:crosshair; }
.psvg text { font-family:'Karla Variable','Karla',sans-serif; }
.ptick { font-size:10.5px; fill:var(--soft); } .pnote { font-size:10.5px; font-weight:700; fill:var(--ink); } .prow { font-size:11px; font-weight:600; fill:var(--ink); }
.pswitch { margin-bottom:8px; } .phint { font-size:12.5px; margin:0 0 6px; }
.pline { font-size:var(--fs-md); margin:2px 0 0; } .pline .linkbtn { font-size:var(--fs-md); }
.flegend { display:flex; flex-wrap:wrap; gap:4px 12px; font-size:12px; color:var(--soft); margin:8px 0 2px; }
.flegend span { display:inline-flex; align-items:center; gap:5px; }
.fdot { display:inline-block; width:9px; height:9px; border-radius:50%; flex-shrink:0; }
.fline { display:inline-block; width:16px; height:2px; background:var(--ink); border-radius:1px; }
.fband { display:inline-block; width:12px; height:11px; background:var(--ink); opacity:.12; border-radius:2px; }
.fsize { display:inline-block; width:12px; height:12px; border-radius:50%; border:1.5px solid var(--soft); }
.fring { display:inline-block; width:9px; height:9px; border-radius:50%; border:1.5px solid var(--ink); }
.pday { background:color-mix(in srgb, var(--ink) 5%, var(--card)); border-radius:12px; padding:9px 11px; margin-top:8px; font-size:13px; min-height:58px; }
.pday-h { font-weight:700; } .pday .hint { margin:0; }
.pday-s { list-style:none; margin:4px 0 0; padding:0; display:flex; flex-wrap:wrap; gap:3px 12px; }
.pday-s li { display:inline-flex; align-items:center; gap:5px; } .sevd { color:var(--fc, var(--soft)); font-size:10.5px; letter-spacing:1px; }
.pcallout { display:flex; gap:12px; align-items:baseline; border-top:1px solid var(--line); margin-top:10px; padding-top:9px; }
.pcallout b { font-family:'Fraunces Variable','Fraunces',serif; font-size:24px; font-weight:600; white-space:nowrap; font-variant-numeric:tabular-nums; }
.pcallout p { margin:0; font-size:var(--fs-md); }
.card { background:var(--card); border:1px solid var(--edge); box-shadow:var(--sh-card); border-radius:var(--r-card); padding:12px 16px; display:flex; gap:13px; align-items:baseline; margin-bottom:var(--gap); }
.num { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:var(--fs-num); color:var(--primary); min-width:56px; flex-shrink:0; white-space:nowrap; font-variant-numeric:tabular-nums; }
.card p { margin:0; font-size:var(--fs-md); line-height:1.5; }
.icard { margin-bottom:var(--gap); box-shadow:var(--sh-card); border-radius:var(--r-card); }
.icard .card { margin-bottom:0; box-shadow:none; border-radius:var(--r-card) var(--r-card) 0 0; }
.advice { display:flex; gap:9px; align-items:flex-start; background:color-mix(in srgb, var(--primary) 10%, var(--card)); border:1px solid var(--edge); border-top:none; border-radius:0 0 var(--r-card) var(--r-card); padding:10px 15px; }
.advice-alone { border-top:1px solid var(--edge); border-radius:var(--r-card); margin-top:10px; }
.uchip { flex-shrink:0; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; border-radius:999px; padding:3px 9px; }
.u-now { background:var(--bad-chip); color:var(--bad); } .u-visit { background:color-mix(in srgb, var(--primary) 16%, var(--card)); color:var(--primary-text); } .u-self { background:color-mix(in srgb, var(--good) 13%, var(--card)); color:var(--good); }
.atext { font-size:var(--fs-sm); line-height:1.5; }
.rep { background:var(--card); border:1px solid var(--edge); box-shadow:var(--sh-card); border-radius:var(--r-card); padding:15px; margin-bottom:12px; }
.rtitle { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:17px; margin-bottom:10px; }
.rmeta { display:block; font-size:11.5px; font-weight:400; color:var(--soft); margin-top:2px; font-family:'Karla Variable','Karla'; }
.rtab { width:100%; border-collapse:collapse; font-size:12.5px; }
.rtab th { text-align:left; font-size:11px; color:var(--soft); padding:3px 0; }
.rtab td { padding:5px 0; border-top:1px solid var(--line); }
.rlist { margin:0; padding-left:17px; font-size:var(--fs-sm); line-height:1.6; } .rfoot { font-size:12px; color:var(--soft); margin:12px 0 0; line-height:1.5; }
.routes { display:flex; gap:8px; }
.route { flex:1; display:flex; flex-direction:column; gap:2px; border:1px solid var(--primary); background:var(--card); color:var(--primary); border-radius:12px; padding:11px 8px; font:700 12px 'Karla Variable','Karla'; cursor:pointer; }
.route span { font-weight:500; font-size:11.5px; color:var(--soft); }
.shelfc { background:var(--card); border:1px solid var(--edge); box-shadow:var(--sh-card); border-radius:var(--r-card); padding:14px; margin-bottom:var(--gap); }
.shead { display:flex; justify-content:space-between; align-items:center; margin-bottom:3px; }
.ppill { display:inline-flex; align-items:center; gap:3px; font-size:10.5px; font-weight:700; text-transform:uppercase; border:1px solid var(--line); border-radius:999px; padding:2px 8px; color:var(--soft); }
.sname { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:15.5px; margin-bottom:3px; }
.smatch { font-size:11.5px; color:var(--primary-text); font-weight:700; margin-bottom:5px; }
.ev { display:inline-block; font-size:11px; font-weight:700; border-radius:999px; padding:3px 10px; margin-bottom:8px; }
.ev-strong { background:color-mix(in srgb, var(--good) 13%, var(--card)); color:var(--good); } .ev-mixed { background:var(--ev-mixed-bg); color:var(--ev-mixed-ink); } .ev-comfort { background:var(--ev-comfort-bg); color:var(--ev-comfort-ink); }
/* Clinical care is a kind of option, not a grade of evidence, so it takes the palette primary rather than the "strong" green. */
.ev-clinical { background:color-mix(in srgb, var(--primary) 16%, var(--card)); color:color-mix(in srgb, var(--primary) 80%, var(--ink)); }
/* Care (UI CC1): the four-chip legend under the disclosure reads the labels once; the match meter is the one
   FAMILIES-coloured mark on the page (the matched symptom's family, --primary when it has none); the first matched
   card wears "Fits your log"; the footer wraps so a long price and two actions never collide. */
.evlegend { display:flex; flex-wrap:wrap; gap:6px; margin:-6px 0 14px; } .evlegend .ev { margin:0; }
.smeter { display:block; height:4px; border-radius:999px; background:color-mix(in srgb, var(--ink) 8%, var(--card)); margin-top:4px; overflow:hidden; }
.smeter i { display:block; height:100%; border-radius:999px; background:var(--primary); }
.ppill.fit { border-color:var(--primary); color:var(--primary-text); background:color-mix(in srgb, var(--primary) 10%, var(--card)); }
.sfoot { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; font-size:13px; gap:8px 6px; }
.sfoot b { flex:1; min-width:0; overflow-wrap:anywhere; } .sfoot .sbtn { flex-shrink:0; }
.sfoot .acts { display:contents; } .sfoot .acts .sbtn[aria-disabled="true"] { margin-left:auto; }
.sfoot .sadd { min-height:36px; font-size:12px; text-decoration:none; }
.shelf-empty { margin-top:-4px; }
.sbtn { border:1px solid var(--primary); background:none; color:var(--primary); border-radius:999px; padding:7px 14px; font:700 12px 'Karla Variable','Karla'; cursor:pointer; }
.loglines { background:var(--card); border:1px solid var(--edge); border-radius:var(--r-card); padding:12px; font-family:ui-monospace,monospace; font-size:11px; line-height:1.7; }
.logline.money { color:var(--good); font-weight:700; } .logline.bad { color:var(--bad); font-weight:700; }
.swatches { display:flex; gap:6px; margin-top:8px; }
.swatch { width:22px; height:22px; border-radius:6px; border:1px solid var(--line); }
.phasecard { display:flex; gap:14px; align-items:center; background:var(--card); border:1px solid var(--edge); box-shadow:var(--sh-card); border-radius:var(--r-card); padding:13px 15px; margin-bottom:14px; }
.phaseday { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:21px; color:var(--primary); white-space:nowrap; }
.phaseinfo { display:flex; flex-direction:column; gap:2px; font-size:13px; }
.phaseinfo span { color:var(--soft); font-size:12.5px; line-height:1.45; }
.readcard { background:color-mix(in srgb, var(--primary) 10%, var(--card)); border:1.5px solid color-mix(in srgb, var(--primary) 25%, var(--line)); border-radius:var(--r-card); padding:14px; margin-top:14px; }
/* Today's read sits directly under the phase card (as the pregnancy read does): tighter, hint clamped to two lines. */
.readcard.compact { padding:10px 14px; margin-top:0; }
.readcard.compact .hint { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.calgrid { display:grid; grid-template-columns:repeat(7,1fr); gap:5px; margin-bottom:10px; }
.calhead { text-align:center; font-size:11px; letter-spacing:.04em; font-weight:700; color:var(--soft); padding:2px 0; }
.calcell { position:relative; aspect-ratio:1; display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:600; border-radius:10px; background:var(--card); border:1px solid var(--line); color:var(--ink); cursor:pointer; }
/* Calendar (spec §5.1): fill = day score (inline, from the ramp), border = cycle state, so the legend swatches below are a
   literal copy of the cell styling. Month navigation sits around the h1; the selected day's card follows the grid. */
.calnav { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px; }
.calnav .disp { margin:0; flex:1; text-align:center; }
.calnav .sbtn { min-width:44px; padding:0 12px; font-size:22px; line-height:1; font-weight:500; }
.linkbtn.backmonth { display:flex; margin:-2px auto 6px; font-size:var(--fs-sm); }
.c-period { border:2px solid var(--primary); }
.c-pred { border:2px dashed var(--primary); }
.c-fert { border:2px solid var(--accent); }
.c-today { outline:none; box-shadow:inset 0 0 0 2px var(--ink); }
.c-today.c-empty { background:color-mix(in srgb, var(--primary) 10%, var(--card)); }
.c-sel { box-shadow:0 0 0 2.5px var(--card), 0 0 0 5px var(--primary); z-index:1; }
.c-today.c-sel { box-shadow:inset 0 0 0 2px var(--ink), 0 0 0 2.5px var(--card), 0 0 0 5px var(--primary); }
.c-future { color:var(--soft); font-weight:500; border-color:color-mix(in srgb, var(--line) 55%, transparent); background:color-mix(in srgb, var(--card) 60%, transparent); }
.c-future.c-pred, .c-future.c-fert { color:inherit; font-weight:700; } .c-future.c-pred { border-color:var(--primary); } .c-future.c-fert { border-color:var(--accent); }
.hint.calhint { margin:-4px 0 12px; }
.daycard { display:block; margin-bottom:12px; animation:cy-fade-rise 180ms var(--ease-in); }
.dayhead { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; }
.daycard .pday-s { margin-top:6px; } .daycard .pday-s li { font-size:var(--fs-sm); }
.daycard .dayline { margin:5px 0 0; font-size:var(--fs-sm); }
.callegend { display:flex; flex-wrap:wrap; gap:10px; font-size:11.5px; color:var(--soft); margin-bottom:6px; }
.callegend .dot { display:inline-block; width:11px; height:11px; border-radius:3px; margin-right:4px; vertical-align:-1px; }
.d-period { background:var(--primary); } .d-pred { background:var(--card); border:1.5px dashed var(--primary); } .d-fert { background:var(--card); border:2px solid var(--accent); }
.d-wk { background:var(--card); border:2px solid var(--accent); border-radius:3px; }
/* Your cycles (Calendar, L5): start · length · decorative bar · Don't use switch; the text carries the length. */
.bodypanel.more .cyclist, .cyclespage .cyclist { list-style:none; margin:8px 0 0; padding:0; }
.bodypanel.more .cycrow, .cyclespage .cycrow { display:flex; align-items:center; flex-wrap:wrap; gap:4px var(--gap); margin:0; padding:6px 0; border-top:1px solid var(--line); }
.bodypanel.more .cycrow:first-child, .cyclespage .cycrow:first-child { border-top:none; }
.cycstart { min-width:46px; font-weight:700; font-variant-numeric:tabular-nums; }
.cyclen { min-width:56px; white-space:nowrap; font-variant-numeric:tabular-nums; }
.cycrow.now .cyclen { min-width:0; color:var(--soft); }
.cycbar { flex:1 1 40px; min-width:40px; height:6px; border-radius:3px; background:color-mix(in srgb, var(--primary) 10%, var(--card)); overflow:hidden; }
.cycbar i { display:block; height:100%; border-radius:3px; background:var(--primary); }
.cycrow.now .cycbar i { background:color-mix(in srgb, var(--primary) 45%, var(--card)); }
.cycrow.out .cycstart, .cycrow.out .cyclen { color:var(--soft); }
.cycrow.out .cycbar i { background:color-mix(in srgb, var(--soft) 45%, var(--card)); }
.cycuse { flex-shrink:0; }
.bodypanel.more .cycwhy, .cyclespage .cycwhy { flex-basis:100%; margin:0 0 2px; font-size:var(--fs-sm); color:var(--soft); line-height:1.45; }
.statechip.flag { display:inline-block; margin-right:6px; padding:3px 9px; border-style:solid; border-color:color-mix(in srgb, var(--accent) 70%, var(--line)); color:var(--accent-text); }
.bodypanel.more .cycmore { margin:6px 0 0; color:var(--soft); }
.pregband { display:flex; gap:14px; align-items:center; background:var(--card); border:1px solid var(--edge); box-shadow:var(--sh-card); border-radius:var(--r-card); padding:14px 15px; margin-bottom:8px; }
.pregweek { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:22px; color:var(--primary); white-space:nowrap; }
.pregmeta { display:flex; flex-direction:column; gap:2px; font-size:13px; }
.pregmeta span { color:var(--soft); font-size:12.5px; }
.pregbar { height:8px; background:color-mix(in srgb, var(--ink) 8%, var(--paper)); border-radius:4px; overflow:hidden; margin-bottom:14px; }
.pregfill { height:100%; background:linear-gradient(90deg,var(--accent),var(--primary)); }
.kickrow { display:flex; gap:10px; align-items:stretch; margin-bottom:12px; }
.kickcard .kickrow { margin-bottom:0; } .kickcard .section-lab { margin-top:0; }
.cta.cta-kick { background:color-mix(in srgb, var(--primary) 12%, var(--card)); color:var(--primary); border:1.5px solid var(--primary); }
.kickcount { display:flex; flex-direction:column; align-items:center; justify-content:center; background:var(--card); border:1px solid var(--line); border-radius:var(--r-card); padding:6px 16px; }
.kickcount b { font-family:'Fraunces Variable','Fraunces',serif; font-size:20px; color:var(--primary); } .kickcount span { font-size:10.5px; color:var(--soft); }
.inp { width:100%; border:1px solid var(--line); background:var(--card); border-radius:11px; padding:11px 13px; font:500 13.5px 'Karla Variable','Karla'; color:var(--ink); margin-bottom:9px; }
.splash { padding-top:32px; text-align:left; }
.splashmark { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:44px; }
.splashmark span { color:var(--primary); }
.splashtag { font-size:12px; font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:var(--primary); margin-top:2px; }
.ghostbtn { width:100%; border:1px solid var(--primary); background:none; color:var(--primary); border-radius:var(--r-card); font:700 14px 'Karla Variable','Karla'; padding:13px; margin-top:10px; cursor:pointer; }
.consentcard { background:var(--card); border:1px solid var(--edge); border-radius:var(--r-card); padding:14px; font-size:13px; margin-bottom:12px; }
.consentopt { display:flex; gap:11px; width:100%; text-align:left; border:1px solid var(--line); background:var(--card); border-radius:var(--r-card); padding:13px; font:400 var(--fs-sm) 'Karla Variable','Karla'; color:var(--ink); line-height:1.5; cursor:pointer; }
.consentopt.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 7%, var(--card)); }
.ckbox { flex-shrink:0; width:22px; height:22px; border:2px solid var(--primary); border-radius:7px; display:flex; align-items:center; justify-content:center; font-weight:700; color:var(--primary); }
.acctchip { font-size:11px; font-weight:700; color:var(--ink); border:1px solid var(--line); background:var(--card); border-radius:999px; padding:6px 10px; margin-right:0; max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.stagechip { border:1px solid var(--line); background:var(--card); color:var(--primary-text); border-radius:999px; padding:6px 10px; font:700 11px 'Karla Variable','Karla'; cursor:pointer; }
.stagechip.icon { width:44px; height:44px; padding:0; display:inline-flex; align-items:center; justify-content:center; }
.stagechip[aria-expanded="true"] { background:color-mix(in srgb, var(--primary) 12%, var(--card)); border-color:var(--primary); }
/* The "{stage} · change" link reads as a link, not a fourth chip. */
/* It may wrap to two lines inside its 44px box ("Perimenopause · change" at 390px), which keeps the header to one row. */
.stagechip.quiet { background:transparent; border-color:transparent; text-decoration:underline; text-underline-offset:3px; padding:6px 3px; line-height:1.2; }
.cta > svg, .ghostbtn > svg { vertical-align:-3px; margin-left:2px; }
/* Icons (components/Icon.jsx): inline SVG on currentColor. .chev is the disclosure chevron, pointing down closed and up open;
   .labico is the small accent glyph before a label. Section labels outside data areas and the Settings/palette sheets carry a 6px accent dot. */
.chev { flex-shrink:0; transition:transform var(--t-fast) var(--ease-std); }
[aria-expanded="true"] > .chev { transform:rotate(180deg); }
.labico { width:14px; height:14px; margin-right:6px; vertical-align:-2px; color:var(--accent); }
.section-lab::before { content:''; display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--accent); margin-right:7px; vertical-align:1px; }
.pchart .section-lab::before, .pots .section-lab::before, .palsheet .section-lab::before, .youpage .section-lab::before { display:none; }
.obwrap { padding-top:14px; }
.obq { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:20px; margin:6px 0 14px; }
.obopts { display:grid; gap:var(--gap); margin-bottom:18px; }
.obopt { border:1px solid var(--line); background:var(--card); box-shadow:var(--sh-opt); border-radius:var(--r-card); padding:14px; text-align:left; font:500 14.5px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
.obdots { display:flex; gap:6px; margin-bottom:16px; }
.obdots span { width:8px; height:8px; border-radius:50%; background:var(--line); }
.obdots span.on { background:var(--primary); }
.c-log { position:absolute; top:3px; right:4px; width:5px; height:5px; border-radius:50%; background:var(--accent); box-shadow:0 0 0 1.5px var(--halo); }
.c-period .c-log { background:var(--knob); }
.linkbtn { display:inline-flex; align-items:center; border:none; background:none; color:var(--primary-text); font:700 12.5px 'Karla Variable','Karla'; text-decoration:underline; cursor:pointer; padding:0; }
.c-wk { border:2px solid var(--accent); background:color-mix(in srgb, var(--accent) 10%, var(--card)); padding-bottom:8px; }
/* The week tag reads in a darkened accent on the tinted week cell (>= 5.1:1 in the three pregnancy palettes) and in the cell's own ink on a score fill. */
.c-wklab { position:absolute; bottom:3px; font-size:9px; font-weight:700; letter-spacing:.02em; line-height:1; color:var(--accent-text); } .c-wklab.onfill { color:inherit; }
.d-logdot { background:var(--accent); border-radius:50%; }
/* One section-label style everywhere (Home sections, Report sections, shelf brand line, form labels). */
.section-lab, .rsec, .sbrand, .lab { font-size:var(--fs-xs); font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--soft); margin:14px 0 7px; }
/* Body text sits at 1.5; display numbers, headings, labels, pills and legends are single-line pieces and keep a tight
   leading so the 1.5 body leading does not stretch cards. */
.mark, .num, .pcallout b, .rtitle, .obq, .pulserow b, .pregweek, .phaseday, .kickcount b, .meterlabel, .meterval, .sname, .splashmark, .stagecard b, .scalehead b, .msdot, .ckbox { line-height:1.15; }
.section-lab, .rsec, .sbrand, .lab, .stepno, .sub, .splashtag, .orline, .uchip, .ppill, .ev, .fchip, .streak span, .scorepill, .sevd, .dots, .kickcount span, .rmeta, .calhead { line-height:1.2; }
.flegend, .callegend, .gradlegend, .meterends, .scaleends, .nextsub, .greetsub, .rtab, .potsrtab, .loglines, .ptick { line-height:1.3; }
.scalehead, .shead, .sfoot, .fhead, .medinfo, .pregmeta, .phaseinfo, .palmeta, .rcov-text, .recaprow, .nextrow, .kickcount, .streak { line-height:1.35; }
.rsec { margin:12px 0 6px; } .sbrand { margin:0; }
.disclosure { width:100%; display:flex; justify-content:space-between; align-items:center; border:1px solid var(--line); background:var(--card); border-radius:var(--r-card); padding:12px 16px; font:700 var(--fs-md) 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; margin:14px 0 0; }
.bodypanel { border:1px solid var(--line); border-top:none; border-radius:0 0 var(--r-card) var(--r-card); background:var(--card); padding:4px 16px 14px; }
.disclosure.more { margin:8px 0 0; min-height:44px; padding:10px 13px; border-radius:var(--r-inner); background:transparent; font-size:var(--fs-sm); text-align:left; gap:10px; }
.disclosure.more[aria-expanded="true"] { border-radius:var(--r-inner) var(--r-inner) 0 0; }
.bodypanel.more { border-radius:0 0 var(--r-inner) var(--r-inner); background:transparent; padding:8px 13px 10px; font-size:var(--fs-sm); line-height:1.55; color:var(--ink); }
.bodypanel.more[hidden] { display:none; }
.bodypanel.more p { margin:0 0 6px; } .bodypanel.more p:last-child { margin-bottom:0; }
.bodypanel.more ul { margin:0; padding-left:17px; } .bodypanel.more li { margin:0 0 5px; } .bodypanel.more li:last-child { margin-bottom:0; }
.morewrap { margin:0 0 10px; }
.mscard .disclosure.more, .pulse .disclosure.more, .pchart .disclosure.more, .card + .morewrap .disclosure.more { border:none; border-top:1px solid var(--line); border-radius:0; background:none; padding:8px 0; margin-top:8px; color:var(--primary-text); justify-content:space-between; }
.mscard .bodypanel.more, .pulse .bodypanel.more, .pchart .bodypanel.more { border:none; padding:4px 0 6px; }
.wrapchips { display:flex; flex-wrap:wrap; gap:7px; }
.minichip { border:1px solid var(--line); background:var(--card); border-radius:999px; padding:9px 14px; font:500 12.5px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
.minichip.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 12%, var(--card)); color:var(--primary); font-weight:700; }
.scalerow { margin-bottom:8px; }
.scalehead { display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:-4px; }
.scalehead b { font-family:'Fraunces Variable','Fraunces',serif; color:var(--primary); font-size:15px; }
.scalehead b.zero { color:var(--soft); }
.slider { width:100%; accent-color:var(--primary); margin:0; cursor:pointer; -webkit-appearance:none; appearance:none; height:44px; background:transparent; }
.slider::-webkit-slider-runnable-track { height:6px; border-radius:3px; background:color-mix(in srgb, var(--ink) 14%, var(--card)); }
.slider::-moz-range-track { height:6px; border-radius:3px; background:color-mix(in srgb, var(--ink) 14%, var(--card)); }
.slider::-webkit-slider-thumb { -webkit-appearance:none; width:24px; height:24px; margin-top:-9px; border-radius:50%; background:var(--primary); border:2px solid var(--card); box-shadow:var(--sh-thumb); }
.slider::-moz-range-thumb { width:24px; height:24px; border-radius:50%; background:var(--primary); border:2px solid var(--card); box-shadow:var(--sh-thumb); }
.scaleends { display:flex; justify-content:space-between; font-size:11.5px; color:var(--soft); margin-top:-6px; }
/* Connect (UI CC1): the score card is idle (em dash, --soft) until a slider moves or today is logged; the band word
   and a 4px --primary meter follow the number; the 7-day strip is palette-only (filled = logged, opacity = score,
   hollow = unlogged). The family colours never appear here: this is a relationship score, not a symptom. */
.card-idle .num { color:var(--soft); }
.cbody { flex:1; min-width:0; }
.cmeter { display:block; height:4px; border-radius:999px; background:color-mix(in srgb, var(--ink) 8%, var(--card)); margin:8px 0 6px; overflow:hidden; }
.cmeter i { display:block; height:100%; border-radius:999px; background:var(--primary); transform-origin:left; transform:scaleX(var(--v, 0)); transition:transform var(--t-slow) var(--ease-std); }
.connstrip { display:inline-flex; gap:5px; align-items:center; vertical-align:middle; margin-left:6px; }
.conndot { width:9px; height:9px; border-radius:50%; border:1.5px solid var(--primary); background:var(--primary); box-sizing:border-box; }
.conndot.off { background:transparent; border-color:color-mix(in srgb, var(--primary) 45%, var(--line)); }
.conndot.today { outline:1.5px solid var(--primary); outline-offset:1.5px; }
.cweek { font-size:var(--fs-sm); color:var(--soft); margin-top:2px; display:flex; align-items:center; flex-wrap:wrap; }
.hint.saved-line { margin:10px 0 8px; color:var(--primary-text); font-weight:600; font-size:var(--fs-sm); }
.hint.sitline { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin:0 0 4px; font-size:var(--fs-sm); } .sitline .linkbtn { min-height:44px; font-size:var(--fs-sm); }
.meter { border:2px solid var(--line); box-shadow:var(--sh-meter); background:var(--card); border-radius:var(--r-card); padding:12px 14px; margin-bottom:var(--gap); transition:border-color var(--t-slow) var(--ease-std); }
.meterhead { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:7px; }
.meterlabel { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:16px; }
.meterval { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:20px; display:inline-flex; align-items:center; gap:7px; }
.meterdot { width:12px; height:12px; border-radius:50%; display:inline-block; transition:background var(--t-slow) var(--ease-std); }
.metertrack { height:11px; background:color-mix(in srgb, var(--ink) 14%, var(--card)); border-radius:5px; overflow:hidden; }
/* The fill is a transform (--v = 0..1, ScoreMeter.jsx), so a change animates on the compositor; no width transition. */
.meterfill { height:100%; width:100%; border-radius:5px; transform-origin:left; transform:scaleX(var(--v, 0)); transition:transform var(--t-slow) var(--ease-std), background var(--t-slow) var(--ease-std); }
.meterends { display:flex; justify-content:space-between; font-size:10.5px; color:var(--soft); margin-top:3px; }
/* Honest empty meter: before anything is logged the label is soft, the dot and border are --line and the track is faded. */
.meter-empty .meterlabel { color:var(--soft); } .meter-empty .metertrack { opacity:.5; } .meter-empty .meterval { color:var(--soft); }
.gradlegend { display:flex; align-items:center; gap:8px; font-size:11px; color:var(--soft); margin-bottom:12px; }
.gradbar { flex:1; height:7px; border-radius:4px; }
.c-per-mark { position:absolute; bottom:3px; width:5px; height:5px; border-radius:50%; background:var(--primary); box-shadow:0 0 0 1.5px var(--halo); }
/* Flow on the period mark (L5): light or unset keeps the 5px dot; medium is a 9 × 5 pill, heavy and flooding 13 × 5. The day's
   name carries the flow in words (", heavy flow"), so the width is never the only cue. */
.c-per-mark.f-med { width:9px; border-radius:var(--r-pill); } .c-per-mark.f-heavy { width:13px; border-radius:var(--r-pill); }
.d-permark { background:var(--primary); border-radius:50%; }
.scorepill { float:none; font-size:11px; font-weight:700; color:var(--on-primary); border-radius:999px; padding:3px 9px; white-space:nowrap; }
.palsheet { background:var(--card); border:1px solid var(--edge); border-radius:var(--r-card); padding:14px; margin-bottom:14px; box-shadow:var(--sh-sheet); }
.palopt { display:flex; align-items:center; gap:11px; width:100%; text-align:left; border:1px solid var(--line); background:var(--card); border-radius:12px; padding:10px 12px; margin-bottom:8px; cursor:pointer; }
.palopt.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 8%, var(--card)); }
.palswatches { display:flex; gap:4px; flex-shrink:0; }
.palswatches i { width:19px; height:19px; border-radius:6px; display:block; }
.palmeta { display:flex; flex-direction:column; flex:1; }
.palmeta b { font-size:13px; color:var(--ink); } .palmeta span { font-size:11px; color:var(--soft); }
.palcheck { color:var(--primary); font-weight:700; display:inline-flex; align-items:center; }
.prog { display:flex; gap:5px; margin-bottom:6px; }
.prog span { flex:1; height:5px; border-radius:3px; background:color-mix(in srgb, var(--ink) 14%, var(--card)); }
.prog span.on { background:var(--primary); }
.stepno { font-size:11px; font-weight:700; color:var(--soft); text-transform:uppercase; letter-spacing:.07em; margin-bottom:12px; }
.labErr { color:var(--bad); }
.need { color:var(--bad); font-weight:700; }
.mcrow { display:flex; flex-wrap:wrap; gap:var(--gap); }
.mc { border:1px solid var(--line); background:var(--card); border-radius:999px; padding:9px 15px; font:500 13px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
.mc.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 12%, var(--card)); color:var(--primary); font-weight:700; }
.err .mc, .err .stagecard { border-color:var(--err-line); }
/* ---- control states (spec §8.4): rest / pressed / hover (pointer only) / focus-visible / disabled. Pressed = a 100ms
   scale on transform plus the selected tint, so a tap answers before the state changes. ---- */
.cy button, .cy [role=button] { -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
.cta, .ghostbtn, .back, .stagecard, .disclosure, .route, .socialbtn, .obopt, .consentopt, .palopt { transition:transform var(--t-fast) var(--ease-std), background-color var(--t-fast), border-color var(--t-fast), color var(--t-fast); }
.cta:active, .ghostbtn:active, .back:active, .stagecard:active, .disclosure:active, .route:active, .socialbtn:active, .obopt:active, .consentopt:active, .palopt:active { transform:scale(.985); }
.cta:active { filter:brightness(.94); }
.mc, .chip, .pill, .takebtn, .tipclose, .sbtn, .minichip, .tab, .calcell, .scopy, .linkbtn, .key { transition:transform var(--t-fast) var(--ease-std), background-color var(--t-fast), border-color var(--t-fast), color var(--t-fast); }
.mc:active, .chip:active, .pill:active, .takebtn:active, .tipclose:active, .sbtn:active, .minichip:active, .calcell:active, .key:active { transform:scale(.96); background:color-mix(in srgb, var(--primary) 12%, var(--card)); border-color:var(--primary); }
@media (hover:hover) { .mc:hover, .chip:hover, .pill:hover, .disclosure:hover, .stagecard:hover, .takebtn:hover, .sbtn:hover, .route:hover, .obopt:hover { border-color:color-mix(in srgb, var(--primary) 55%, var(--line)); } }
/* Danger: the one destructive pill (Delete everything) is red-outlined and never takes the primary tint. */
.mc.danger { color:var(--bad); border-color:color-mix(in srgb, var(--bad) 40%, var(--line)); }
.mc.danger:active, .mc.danger.on { background:var(--bad-bg); border-color:var(--bad); color:var(--bad); }
/* Joined control: 2-5 mutually exclusive answers or views share one border (buttons keep .mc/.on and aria-pressed;
   standalone .mc pills stay for multi-select). Labels wrap to two lines rather than truncate. */
.seg { display:flex; flex-wrap:nowrap; width:100%; background:var(--card); border:1px solid var(--line); border-radius:var(--r-pill); padding:3px; gap:0; box-sizing:border-box; }
.seg .mc { flex:1 1 0; min-width:0; border:none; background:none; border-radius:var(--r-pill); padding:7px 4px; font-weight:700; font-size:12px; line-height:1.2; color:var(--soft); min-height:44px; text-align:center; white-space:normal; overflow-wrap:anywhere; }
.seg .mc.on { background:var(--primary); color:var(--on-primary); }
.seg .mc:active { background:color-mix(in srgb, var(--primary) 12%, var(--card)); } .seg .mc.on:active { background:var(--primary); }
.seg.scroll { overflow-x:auto; scrollbar-width:none; } .seg.scroll::-webkit-scrollbar { display:none; }
.seg.scroll .mc { flex:1 0 auto; padding:8px 12px; white-space:nowrap; }
/* Quick check-in: each question is a labelled group (.qlab) over one joined .seg of four answers. */
.qlab { font-weight:600; font-size:var(--fs-md); color:var(--ink); margin:0 0 6px; }
.welcome-line { color:var(--primary-text); margin-bottom:6px; }
/* ---- Today status and reach (UI T2): the saved line under the meter, the yesterday shortcut under the h1, the per-visit
   "Back to quick check-in", the sticky save bar (reuses .stopbar: sticky bottom, and .cy:has(.stopbar) lifts the toast) and the
   sticky edit strip under the section bar. Sticky needs no overflow-clipping ancestor; main and .cy have none. ---- */
.savedline { display:flex; gap:6px; align-items:center; font-size:var(--fs-sm); color:var(--primary-text); margin:-6px 0 10px; }
.savedline svg { flex-shrink:0; }
.linkbtn.yday { display:flex; margin:-8px 0 2px; font-size:var(--fs-md); }
.linkbtn.backquick { display:flex; margin:-4px 0 6px; }
.stopbar.savebar { z-index:3; margin:12px -16px 0; padding:10px 16px calc(10px + var(--sa-b)); background:color-mix(in srgb, var(--paper) 88%, transparent); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); border-top:1px solid var(--line); }
.savebar .cta { margin:0; }
.editbar { position:sticky; top:calc(8px + var(--sa-t)); z-index:2; background:color-mix(in srgb, var(--accent) 16%, var(--card)); border-color:var(--accent); }
/* The day just saved pops once on the patterns card (set by the save handler only; cleared after 1.2 s). */
.dot-new { transform-box:fill-box; transform-origin:center; animation:cy-pop 600ms var(--ease-std); }
.inpErr { border-color:var(--bad) !important; background:var(--bad-bg) !important; }
.errhint { font-size:var(--fs-sm); color:var(--bad); line-height:1.5; margin:14px 0 0; background:var(--bad-bg); border:1.5px solid var(--err-edge); border-radius:var(--r-inner); padding:11px 13px; }
.regcards { display:grid; gap:var(--gap); }
.stagecard { display:flex; flex-direction:column; align-items:flex-start; gap:2px; border:1px solid var(--line); background:var(--card); border-radius:var(--r-card); padding:13px 15px; cursor:pointer; text-align:left; }
.stagecard.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 8%, var(--card)); }
.stagecard b { font-family:'Fraunces Variable','Fraunces',serif; font-size:16px; color:var(--ink); } .stagecard.on b { color:var(--primary); }
.stagecard span { font-size:var(--fs-sm); color:var(--soft); }
.nav { display:flex; gap:10px; margin-top:20px; }
.back { border:1px solid var(--line); background:var(--card); color:var(--ink); border-radius:var(--r-card); padding:14px 20px; font:700 14px 'Karla Variable','Karla'; cursor:pointer; }
.nav .cta { flex:1; }
.plaincard { background:var(--card); border:1px solid var(--edge); border-radius:var(--r-card); padding:14px 16px; margin-bottom:var(--gap); box-shadow:var(--sh-card); }
.plain { font-size:14px; line-height:1.6; margin:0 0 10px; }
.plain:last-child { margin-bottom:0; }
.script { font-size:14px; line-height:1.6; margin:0 0 12px; padding-left:12px; border-left:3px solid var(--primary); color:var(--ink); }
.script:last-child { margin-bottom:0; }
.homehead { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; }
.greet { font-family:'Fraunces Variable','Fraunces',serif; font-weight:440; font-size:var(--fs-title); line-height:1.1; margin:0; }
.greetsub { font-size:13px; color:var(--soft); margin-top:4px; }
.streak { display:flex; flex-direction:column; align-items:center; background:var(--card); border:1px solid var(--edge); border-radius:var(--r-card); padding:8px 14px; min-width:70px; }
.streak b { font-family:'Fraunces Variable','Fraunces',serif; font-size:22px; color:var(--primary); line-height:1; } .streak span { font-size:10.5px; color:var(--soft); margin-top:2px; }
.nextrow { display:flex; gap:12px; align-items:flex-start; padding:10px 0; border-top:1.5px solid var(--line); }
.nextrow:first-child { border-top:none; }
.nextdot { flex-shrink:0; width:9px; height:9px; border-radius:50%; background:var(--accent); margin-top:5px; }
.nexttext { font-size:var(--fs-md); } .nextsub { font-size:12px; color:var(--soft); margin-top:2px; } .nextsub.link { color:var(--primary-text); font-weight:700; }
.pulse { background:color-mix(in srgb, var(--primary) 9%, var(--card)); border:1.5px solid color-mix(in srgb, var(--primary) 25%, var(--line)); border-radius:var(--r-card); padding:12px 16px; }
.pulserow { display:flex; gap:12px; align-items:baseline; padding:6px 0; }
.pulserow b { font-family:'Fraunces Variable','Fraunces',serif; font-size:22px; color:var(--primary); min-width:72px; } .pulserow span { font-size:var(--fs-md); }
.recaprow { display:flex; justify-content:space-between; padding:9px 0; border-top:1.5px solid var(--line); font-size:var(--fs-md); }
.recaprow:first-child { border-top:none; margin-top:8px; } .recaprow b { font-weight:700; }
.up { color:var(--good); font-weight:700; margin-left:4px; } .down { color:var(--bad); font-weight:700; margin-left:4px; } .flat { color:var(--soft); font-weight:500; margin-left:4px; }
.better { color:var(--good); font-weight:700; } .worse { color:var(--bad); font-weight:700; }
.medrow { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:10px 0; border-top:1.5px solid var(--line); }
.medinfo { display:flex; flex-direction:column; gap:2px; } .medinfo b { font-size:14px; } .medinfo span { font-size:var(--fs-sm); color:var(--soft); }
.medeff { color:var(--primary-text) !important; font-weight:700; } .medeff.muted { color:var(--soft) !important; font-weight:500; }
.takebtn { flex-shrink:0; border:1px solid var(--line); background:var(--card); border-radius:999px; padding:8px 13px; font:700 12px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
.takebtn.on { border-color:var(--primary); background:var(--primary); color:var(--on-primary); }
.takebtn[aria-pressed] { position:relative; padding:8px 13px 8px 34px; }
.takebtn[aria-pressed]::before { content:''; position:absolute; left:11px; top:50%; width:16px; height:9px; transform:translateY(-50%); border-radius:999px; background:var(--line); }
.takebtn[aria-pressed]::after { content:''; position:absolute; left:11px; top:50%; width:9px; height:9px; transform:translateY(-50%); border-radius:50%; background:var(--knob); box-shadow:0 0 0 1px var(--knob-edge); transition:left var(--t-fast); }
.takebtn.on[aria-pressed]::before { background:color-mix(in srgb, var(--on-primary) 45%, transparent); }
.takebtn.on[aria-pressed]::after { left:18px; box-shadow:none; background:var(--on-primary); }
.jentry { border-top:1.5px solid var(--line); padding:10px 0; } .jentry b { font-size:12px; color:var(--soft); } .jentry p { margin:4px 0 0; font-size:var(--fs-md); line-height:1.55; white-space:pre-wrap; }
.orline { display:flex; align-items:center; gap:10px; margin:14px 0 10px; font-size:11.5px; color:var(--soft); text-transform:uppercase; letter-spacing:.07em; }
.orline::before, .orline::after { content:""; flex:1; height:1.5px; background:var(--line); }
.social { display:grid; gap:var(--gap); }
.socialbtn { min-height:44px; display:flex; align-items:center; justify-content:center; gap:9px; border:1px solid var(--line); background:var(--card); border-radius:var(--r-card); padding:12px; font:700 14px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
.socialbtn:disabled { opacity:.6; }
.socialdot { width:12px; height:12px; border-radius:50%; }
/* ---- UI O1: onboarding. Splash motif + promise rows; step 1 providers 3-up (Apple leftmost, inline marks); the stage
   cards carry their palette swatch and the chosen one a check; the consent cadence is a two-column grid; each step slides
   in (cy-slide-in / cy-slide-back, defined here) and hands focus to its heading. Under the reduce rule steps appear at once. ---- */
.splashmotif { display:block; margin:0 0 10px -2px; }
.splashwhy { list-style:none; margin:0 0 14px; padding:0; display:grid; gap:8px; }
.splashwhy li { display:flex; align-items:center; gap:10px; font-size:var(--fs-lg); font-weight:600; color:var(--ink); line-height:1.35; }
.splashwhy svg { flex-shrink:0; color:var(--accent); }
.splashpromise-h { margin:0 0 8px; }
.splashpromise { list-style:none; margin:0 0 16px; padding:0; display:grid; gap:8px; }
.splashpromise li { display:flex; align-items:flex-start; gap:8px; font-size:var(--fs-md); line-height:1.5; color:var(--soft); }
.splashpromise svg { flex-shrink:0; margin-top:3px; color:var(--primary-text); }
.ghostbtn.splashrestore { margin-top:10px; }
.cadwrap { margin:-2px 0 12px; padding:10px 0 2px 12px; border-left:2px solid var(--line); }
.aboutyou .morewrap + .morewrap { margin-top:6px; }
.rfoot b { font-weight:500; font-size:11px; letter-spacing:.04em; }
.social { grid-template-columns:repeat(3, 1fr); }
.socialbtn { padding:10px 6px; font-size:13px; gap:6px; min-height:44px; }
.socialbtn svg { flex-shrink:0; }
.ghostbtn.quiet { border-color:var(--line); color:var(--ink); font-weight:600; }
.inp { min-height:44px; } .inp::placeholder { color:var(--soft); }
.rfoot.inphelp { margin:-3px 0 10px 2px; }
.stagecard { position:relative; }
.swatch-dot { position:absolute; right:15px; top:16px; width:10px; height:10px; border-radius:50%; }
.stagecard.on .swatch-dot { display:none; }
.stagecheck { position:absolute; right:13px; top:13px; color:var(--primary); }
.cadgrid { grid-template-columns:1fr 1fr; gap:var(--gap); }
.cadgrid .stagecard { padding:10px 12px; min-height:56px; } .cadgrid .stagecard b { font-size:14px; } .cadgrid .stagecard span { font-size:11.5px; }
.cadgrid > .stagecard:last-child:nth-child(odd) { grid-column:1 / -1; }
.rlist.icons { list-style:none; padding-left:0; line-height:1.5; } .rlist.icons li { display:flex; align-items:flex-start; gap:8px; } .rlist.icons li + li { margin-top:2px; }
.rlist.icons .labico { width:16px; height:16px; margin:2px 0 0; }
.regstep.fwd { animation:cy-slide-in var(--t-base) var(--ease-in); } .regstep.back { animation:cy-slide-back var(--t-base) var(--ease-in); }
@keyframes cy-slide-in { from { opacity:0; transform:translateX(24px) } }
@keyframes cy-slide-back { from { opacity:0; transform:translateX(-24px) } }
.disp:focus { outline:none; }
.prog span { transition:background var(--t-slow); }
.obback { display:block; margin:-6px 0 12px; }

/* Milestones: a progress timeline (a line through small nodes), not a list of choices. */
.mscard { padding:12px 16px 8px; margin-bottom:var(--gap); } .mscard .morewrap { margin:2px 0 0; }
.msteps { list-style:none; margin:2px 0 8px; padding:0; display:flex; align-items:center; }
.mstep { position:relative; flex:1; display:flex; justify-content:center; align-items:center; }
.mstep::before { content:""; position:absolute; left:0; right:0; top:50%; height:2px; margin-top:-1px; background:var(--line); }
.mstep:first-child::before { left:50%; } .mstep:last-child::before { right:50%; }
.mstep.done::before { background:var(--primary); } .mstep .msdot { position:relative; }
.mstep.done .msdot { background:var(--primary); border-color:var(--primary); color:var(--on-primary); }
.msnext { font-size:var(--fs-md); margin:0; line-height:1.5; } .msnext .msbar { display:inline-block; vertical-align:middle; margin-left:8px; }
.dgrid { display:grid; grid-template-columns:1fr 1fr; gap:var(--gap); margin-top:14px; }
.dgrid .disclosure { margin:0; min-height:44px; padding:10px 12px; font-size:12.5px; text-align:left; gap:8px; }
.dgrid > .disclosure:last-child:nth-child(odd) { grid-column:1 / -1; }
.disclosure.on { border-color:var(--primary); color:var(--primary); }
.bodypanel.detached { border-top:1.5px solid var(--line); border-color:var(--primary); border-radius:var(--r-card); margin-top:8px; }
.ptitle { font-weight:700; font-size:13.5px; margin:10px 0 0; }
.pulse .morewrap { margin:6px 0 0; } .ptap { color:var(--soft); }
.mstrip { list-style:none; margin:0; padding:0 0 0 2px; }
.ms { position:relative; display:flex; align-items:center; gap:12px; padding:6px 0 6px 0; font-size:13px; color:var(--soft); }
.ms::before { content:""; position:absolute; left:8px; top:0; bottom:0; width:2px; background:var(--line); }
.ms:first-child::before { top:50%; } .ms:last-child::before { bottom:50%; }
.ms.done { color:var(--ink); }
.msdot { position:relative; flex-shrink:0; width:18px; height:18px; border-radius:50%; border:2px solid var(--line); background:var(--card); display:flex; align-items:center; justify-content:center; font-size:10.5px; font-weight:700; box-sizing:border-box; }
.ms.done .msdot { background:var(--primary); border-color:var(--primary); color:var(--on-primary); }
.ms.done + .ms::before { background:linear-gradient(var(--primary), var(--primary) 50%, var(--line) 50%); }
.ms.done + .ms.done::before, .ms.done:first-child::before { background:var(--primary); }
.mslabel { flex:1; }
.msbar { width:56px; height:6px; background:color-mix(in srgb, var(--ink) 12%, var(--card)); border-radius:3px; overflow:hidden; }
.msbar i { display:block; height:100%; background:var(--primary); }
/* ---- Home (UI H1): done CTA, today line, doors with status, first-run sketch, quiet pulse, week bar, milestone moment ---- */
.cta.done { background:var(--card); color:var(--primary-text); border:1.5px solid var(--primary); }
.todayline { display:flex; gap:8px; align-items:center; width:100%; min-height:44px; border:none; background:none; text-align:left; font:500 var(--fs-md) 'Karla Variable','Karla'; color:var(--soft); padding:4px 2px; margin:-4px 0 6px; cursor:pointer; line-height:1.3; }
.todayline .fdot { width:8px; height:8px; }
.card.insight { background:color-mix(in srgb, var(--primary) 6%, var(--card)); }
.card.insight .fdot { width:8px; height:8px; margin-right:6px; vertical-align:1px; }
.streak.warm { border-color:var(--accent); } .streak.warm b { color:color-mix(in srgb, var(--accent) 70%, var(--ink)); }
.dsub { color:var(--soft); font-weight:500; }
.nextrow[role=button]:active { background:color-mix(in srgb, var(--primary) 6%, transparent); }
.pchart-soon { padding:12px 16px 14px; } .pchart-soon svg { display:block; width:100%; height:auto; margin:0 0 6px; } .pchart-soon .plain { margin:0 0 8px; }
.msbar.three { display:grid; grid-template-columns:1fr 1fr 1fr; gap:3px; width:100%; background:none; overflow:visible; }
.msbar.three i { background:color-mix(in srgb, var(--ink) 12%, var(--card)); border-radius:3px; } .msbar.three i.on { background:var(--primary); }
.pchart .pcallout.top { border-top:none; margin:0; padding-top:0; } .pcallout.top b { font-size:20px; }
/* Patterns (P1): the takeaway and legend above the plot, a day card with ‹ › steps, a once-only draw-in, the numbers as text,
   an action row under every insight. Home's compact card (.pcallout.top above) is untouched by these. */
.pchart .pcallout.pcallout-top { border-top:none; border-bottom:1px solid var(--line); margin:0 0 10px; padding:0 0 9px; }
.pcallout-top b { color:var(--primary); font-size:var(--fs-num); display:inline-flex; align-items:baseline; gap:4px; }
.ptri { flex-shrink:0; align-self:center; } .pword { font-family:'Karla Variable','Karla',sans-serif; font-size:var(--fs-sm); font-weight:700; color:var(--primary-text); }
.flegend-top { margin:0 0 6px; }
.seg .mc.mc-soon { display:flex; align-items:center; justify-content:center; color:var(--soft); font-weight:600; cursor:default; border:1.5px dashed var(--line); margin:-1.5px; }
.pday-h { display:flex; justify-content:space-between; align-items:center; gap:8px; }
.pday-nav { padding-top:4px; } .psteps { display:inline-flex; gap:2px; margin:-6px -8px -6px 0; flex-shrink:0; }
.pstep { min-width:44px; min-height:44px; justify-content:center; text-decoration:none; font-size:22px; line-height:1; border-radius:var(--r-inner); padding-bottom:3px; }
.pstep[aria-disabled="true"] { color:var(--soft); opacity:.45; cursor:default; }
.pday-in { animation:cy-fade-rise 120ms var(--ease-in); }
.pselg { transition:transform var(--t-fast) var(--ease-std); }
.pline-draw { stroke-dasharray:1; stroke-dashoffset:1; animation:cy-draw 600ms var(--ease-in) forwards; }
.pdots-in { animation:cy-fade-rise 300ms var(--ease-in) 450ms both; }
.pnums { margin:0; padding-left:18px; } .pchart .morewrap { margin:0; } .pchart .pline + .morewrap { margin-top:4px; }
.aline { margin:0; padding:0 15px 10px; background:color-mix(in srgb, var(--primary) 10%, var(--card)); border:1px solid var(--edge); border-top:none; border-radius:0 0 var(--r-card) var(--r-card); }
.aline .linkbtn { font-size:var(--fs-sm); } .advice-mid { border-radius:0; }
.pchart-soon .pline { margin:8px 0 0; }
.pulse.quiet { background:var(--card); border-color:var(--line); padding:10px 14px; }
.pulse.quiet .pulserow { padding:0; } .pulse.quiet .pulserow b { min-width:auto; font-size:16px; } .pulse.quiet .pulserow span { font-size:var(--fs-md); color:var(--soft); }
.pulse.quiet .rfoot { margin-top:4px !important; } .pulse.quiet .morewrap { margin:0; } .pulse.quiet .disclosure.more { margin-top:4px; padding:4px 0; }
.seclite { text-transform:none; letter-spacing:0; font-weight:600; }
.wkbar { margin:2px 0 10px; }
.wktrack { display:grid; grid-template-columns:12fr 15fr 13fr; gap:3px; height:6px; }
.wkseg { position:relative; display:block; height:6px; border-radius:3px; background:color-mix(in srgb, var(--ink) 12%, var(--card)); }
.wkseg b { position:absolute; left:0; top:0; bottom:0; border-radius:3px; background:var(--primary); }
.wkseg u { position:absolute; top:50%; width:12px; height:12px; margin:-6px 0 0 -6px; border-radius:50%; background:var(--primary); border:2px solid var(--card); box-sizing:border-box; box-shadow:0 0 0 1px var(--primary); }
.wkticks { display:grid; grid-template-columns:12fr 15fr 13fr; gap:3px; margin-top:3px; font-size:10.5px; font-weight:700; color:var(--soft); line-height:1.2; }
.wkticks span:last-child { display:flex; justify-content:space-between; } .wkticks em { font-style:normal; font-weight:500; }
.mstep.new .msdot { animation:cy-pop 350ms var(--ease-std); } .mstep.new::before { transform-origin:left; animation:cy-grow 300ms var(--ease-in); }
/* ---- Milestones (UI M1): you are here ---- */
.roadhead { display:flex; justify-content:space-between; align-items:center; gap:10px; margin:0 0 8px; } .roadhead .disp { margin:0; } .roadhead .linkbtn { min-height:44px; flex-shrink:0; font-size:var(--fs-sm); text-align:right; }
.pregbar.road { height:6px; border-radius:3px; background:color-mix(in srgb, var(--ink) 10%, var(--card)); overflow:hidden; margin:0 0 12px; }
.ppill.now { background:var(--primary); border-color:var(--primary); color:var(--on-primary); }
.ppill.soon { border-color:var(--primary); color:var(--primary-text); background:color-mix(in srgb, var(--primary) 10%, var(--card)); }
.ppill.done { background:color-mix(in srgb, var(--primary) 12%, var(--card)); color:color-mix(in srgb, var(--primary) 80%, var(--ink)); border-color:transparent; }
.ppill.later { opacity:.85; }
.shelfc.done { display:grid; grid-template-columns:auto 1fr auto; align-items:center; column-gap:10px; padding:8px 14px; }
.shelfc.done .shead { display:contents; } .shelfc.done .sbrand { order:1; white-space:nowrap; } .shelfc.done .sname { order:2; font-size:var(--fs-md); font-family:inherit; font-weight:600; margin:0; } .shelfc.done .ppill { order:3; } .shelfc.done .hint { display:none; }
.shelfc.now { border-color:var(--primary); box-shadow:0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent); }
.shelfc .linkbtn.plan { min-height:44px; margin:0 0 -10px; font-size:var(--fs-sm); }
.rsec.tri { display:flex; justify-content:space-between; align-items:baseline; gap:8px; border-bottom:2px solid var(--line); padding-bottom:4px; margin:14px 0 8px; } .rsec.tri.now { border-color:var(--primary); color:var(--primary-text); } .rsec.tri .tricount { letter-spacing:0; text-transform:none; font-weight:600; }
/* ---- accessibility ---- */
/* Reduce, don't remove: movement (keyframes, transform/size transitions) goes away, the 100ms colour and opacity
   feedback that tells a reduced-motion user a tap registered stays. */
@media (prefers-reduced-motion: reduce) { .cy *, .cy *::before, .cy *::after { animation:none !important; transition-property:background-color,border-color,color,opacity !important; transition-duration:var(--t-fast) !important; } }
@media (prefers-reduced-motion: reduce) { .pline-draw { stroke-dashoffset:0; } .pdots-in { opacity:1; } }
/* ---- shared motion (performance budget): anything continuous animates transform/opacity only; will-change only on
   .toast.show and .tabpanel; nothing scroll-linked; no rAF loops except the 250ms score tween. Each runs once per
   mount behind a ref, <= 600ms, and reduceMotion() (lib/motion.js) guards every scrollIntoView, tween and draw-in. ---- */
@keyframes cy-fade-rise { from { opacity:0; transform:translateY(4px) } }
@keyframes cy-pop { 50% { transform:scale(1.22) } }
@keyframes cy-draw { to { stroke-dashoffset:0 } }
@keyframes cy-spin { to { transform:rotate(360deg) } }
@keyframes cy-pulse { 50% { opacity:.45 } }
@keyframes cy-grow { from { transform:scaleX(0) } }
button:focus-visible, input:focus-visible, textarea:focus-visible, [tabindex]:focus-visible { outline:3px solid var(--primary); outline-offset:2px; border-radius:8px; }
.tab { min-height:44px; padding:12px 8px; }
/* The tab bar scrolls sideways (overflow-x:auto), which clips anything drawn outside it, so a tab's ring sits just inside the tab. */
.tab:focus-visible { outline-offset:-3px; }
.seg.scroll .mc:focus-visible { outline-offset:-3px; } .seg.scroll .mc.on:focus-visible { outline-color:var(--card); }
.mc, .pill, .takebtn, .sbtn, .orgbtn, .stagechip, .topbtn, .linkbtn, .ghost, .route, .inp, .slider, .minichip, .scopy, .palopt, .calcell, .key { min-height:44px; }
.sdot.on, .c-per-mark { outline:1.5px solid var(--mark-edge); }
.wearbtns { display:flex; gap:6px; flex-shrink:0; align-items:center; }
.wearconfirm { margin:2px 0 12px; }
.wearconfirm .ghostbtn { margin-top:8px; }
.sbtn:disabled, .sbtn[aria-disabled="true"] { cursor:default; color:var(--soft); border-color:var(--line); border-style:dashed; font-weight:600; }
button[aria-disabled="true"] { cursor:default; }
.statechip { font:700 11px 'Karla Variable','Karla'; color:var(--soft); border:1.5px dashed var(--line); border-radius:var(--r-pill); padding:6px 10px; align-self:center; line-height:1.2; }
.emailpreview { resize:vertical; font:500 12.5px/1.5 'Karla Variable','Karla',sans-serif; white-space:pre-wrap; user-select:text; -webkit-user-select:text; }
/* ---- Ask (UI A1): starters that always answer, the answer landed on with its source up top, a copyable visit question ---- */
.askstart { margin-bottom:4px; } .askstart .section-lab { margin-top:6px; }
.askintro { background:color-mix(in srgb, var(--primary) 7%, var(--card)); border:1.5px solid color-mix(in srgb, var(--primary) 25%, var(--line)); border-radius:var(--r-card); padding:10px 14px 4px; margin-bottom:6px; }
.askintro .section-lab { margin-top:0; }
.askstarters { display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; margin:-5px -16px 12px; padding:5px 16px 6px; }
.askstarters::-webkit-scrollbar { display:none; }
.askintro .askstarters { margin:-5px -14px 4px; padding:5px 14px 6px; }
.askstarter { flex-shrink:0; border:1px solid var(--line); background:var(--card); border-radius:999px; padding:11px 14px; font:500 13px 'Karla Variable','Karla'; color:var(--primary-text); min-height:44px; cursor:pointer; transition:transform var(--t-fast) var(--ease-std), background-color var(--t-fast), border-color var(--t-fast); }
.askstarter:active { transform:scale(.97); border-color:var(--primary); background:color-mix(in srgb, var(--primary) 10%, var(--card)); }
@media (hover:hover) { .askstarter:hover { border-color:var(--primary); } }
label.section-lab { display:block; margin:12px 0 6px; }
.askcount { margin:-4px 0 8px; text-align:right; }
.askspin { display:inline-block; width:14px; height:14px; border:2px solid color-mix(in srgb, var(--on-primary) 40%, transparent); border-top-color:var(--on-primary); border-radius:50%; margin-right:8px; vertical-align:-2px; animation:cy-spin 800ms linear infinite; }
/* The one keyframe kept under reduced motion: the busy ring stops turning and breathes in opacity instead (no movement), so the wait still reads as live. */
@media (prefers-reduced-motion: reduce) { .askspin { border-color:var(--on-primary); animation:cy-pulse 1.4s ease-in-out infinite !important; } }
.askout:not(:empty) { margin-top:14px; } .askout:focus-visible { outline-offset:3px; border-radius:var(--r-card); }
.askcard { display:block; margin:0 0 var(--gap); animation:cy-fade-rise var(--t-base) var(--ease-in); }
.askcard.askurgent { border-color:var(--bad); box-shadow:0 0 0 3px var(--bad-bg); }
.asksrc { display:flex; gap:9px; align-items:baseline; margin-bottom:10px; }
.asksrc .uchip { white-space:nowrap; }
.asksrc-q { font-size:var(--fs-sm); color:var(--soft); line-height:1.4; min-width:0; overflow-wrap:anywhere; }
.u-ai { background:color-mix(in srgb, var(--accent) 18%, var(--card)); color:color-mix(in srgb, var(--accent) 75%, var(--ink)); }
.askcard .asktext { line-height:1.6; } .askcard .asktext + .asktext { margin-top:8px; }
.askcard .askev { margin:10px 0 0; padding-left:12px; border-left:3px solid color-mix(in srgb, var(--primary) 35%, var(--card)); font-size:var(--fs-sm); line-height:1.55; color:var(--ink); }
.askev-lab { font-weight:700; color:var(--soft); }
/* One citation per line, with the sentence kept whole for anything that reads the text (inline-block, not block, and pre-wrap so the "; " survives). */
.askev-i { display:inline-block; width:100%; white-space:pre-wrap; }
.askvisit { margin-top:10px; } .askvisit .linkbtn.askcopy { display:inline-flex; margin:-2px 0 -6px; font-size:var(--fs-sm); }
.askagain .section-lab { margin-top:12px; } .askagain .askstarters { margin-bottom:4px; }
.askcard .ghostbtn { margin-top:10px; } .askcard .ghostbtn + .rfoot { margin-top:6px; }
.askfoot { border-top:1px solid var(--line); margin-top:10px; padding-top:1px; } .askfoot .rfoot { margin-top:8px; }
/* ---- POTS add-on (scoped to .pots and the stand-test runner; chrome only — data colours come from RAMPS) ---- */
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
.pots .cta, .pots .ghostbtn { min-height:56px; }
.pots .mc, .pots .takebtn, .pots .sbtn, .pots .linkbtn, .pots .pill, .pots .chip { min-height:44px; }
.pots .linkbtn, .pots .sbtn { min-width:44px; }
.pots .obq { margin:0 0 10px; }
.minichip.big { min-height:44px; padding:10px 15px; font-size:13px; }
.pots .wearbtns { flex-shrink:1; flex-wrap:wrap; justify-content:flex-end; min-width:0; }
.pots .medinfo { min-width:0; overflow-wrap:anywhere; }
.pots .inp, .pots .slider { min-height:44px; }
.pots .linkbtn, .pots .ghostbtn, .pots .sbtn, .pots .scalehead b, .potslink { color:var(--primary-text); }
.pots .disclosure, .potslink { min-height:44px; }
.potsgrid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px; }
.potsgrid .route { min-height:72px; justify-content:center; align-items:flex-start; text-align:left; font-size:14px; padding:12px; }
.potsgrid .route span { font-size:12px; }
/* Day and week bars (POTS Patterns DayBars, Move weekly bars): the rows set their own grid-template-columns inline; the fill is var(--ramp-mid). */
.bars { display:grid; gap:8px; margin-top:6px; }
.brow { display:grid; grid-template-columns:108px 1fr 24px; align-items:center; gap:9px; }
.blab { font-size:12px; } .btrack { height:10px; background:color-mix(in srgb, var(--ink) 14%, var(--card)); border-radius:5px; overflow:hidden; }
.bfill { height:100%; } .bval { font-size:11.5px; color:var(--soft); text-align:right; }
.goalbar { height:10px; background:var(--line); border-radius:5px; overflow:hidden; margin:8px 0 4px; }
.goalfill { height:100%; background:var(--primary); border-radius:5px; }
.pots-timer { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:54px; line-height:1.1; text-align:center; font-variant-numeric:tabular-nums; margin:6px 0 10px; color:var(--ink); }
.cta.stopbtn { background:var(--bad); color:var(--on-bad); min-height:56px; font-size:15px; }
.cta.stopbtn.top { margin:2px 0 12px; }
.stopbar { position:sticky; bottom:0; z-index:5; background:var(--paper); padding:10px 0 calc(10px + var(--sa-b)); margin-top:12px; }
html:has(.pots-run .stopbar) { scroll-padding-bottom:calc(90px + var(--sa-b)); }
.potsreport .routes { flex-wrap:wrap; }
.potsreport .route { flex:1 1 140px; min-height:56px; color:var(--primary-text); }
.potsreport .route[aria-disabled="true"] { border-style:dashed; cursor:default; }
.potstablewrap { overflow-x:auto; margin:4px 0 10px; }
.potstablewrap:focus-visible { outline:2px solid var(--primary); outline-offset:2px; }
.potsrtab { font-size:11.5px; }
.potsrtab caption { text-align:left; font-weight:700; font-size:12.5px; color:var(--ink); padding:6px 0 4px; }
.potsrtab th, .potsrtab td { padding-right:8px; vertical-align:top; white-space:pre-line; color:var(--ink); }
.rcover { background:var(--card); border:1px solid var(--edge); box-shadow:var(--sh-card); border-radius:var(--r-card); padding:13px 15px 12px; margin-bottom:8px; }
.rcov-top { display:flex; gap:12px; align-items:baseline; }
.rcov-num { font-size:30px; min-width:0; } .rcov-num small { font-size:16px; font-weight:600; color:var(--soft); margin-left:1px; }
.rcov-text { display:flex; flex-direction:column; gap:1px; font-size:13.5px; } .rcov-text span { font-size:12px; color:var(--soft); }
.rcov-cells { display:grid; grid-template-columns:repeat(30, 1fr); gap:2px; margin-top:10px; }
.rcov-cells i { display:block; height:8px; border-radius:2px; background:var(--line); } .rcov-cells i.on { background:var(--primary); }
.finding { padding:9px 0; border-top:1px solid var(--line); } .finding:first-child { padding-top:0; border-top:none; } .finding:last-child { padding-bottom:0; }
.fhead { display:flex; align-items:center; gap:7px; font-size:14px; } .fhead b { flex:1; min-width:0; }
.fchip { flex-shrink:0; font-size:11px; font-weight:700; color:var(--ink); border-radius:999px; padding:3px 9px; white-space:nowrap; }
.fmeter { position:relative; height:8px; border-radius:4px; background:color-mix(in srgb, var(--fc) 14%, var(--card)); margin:8px 0 6px; overflow:hidden; }
.fmeter i { position:absolute; left:0; top:0; height:100%; border-radius:4px; }
.fm-any { background:color-mix(in srgb, var(--fc) 45%, var(--card)); } .fm-strong { background:var(--fc); box-shadow:2px 0 0 var(--card); }
.fsub { font-size:13px; color:var(--soft); margin:0; } .fsub .up, .fsub .down, .fsub .flat { margin-left:0; }
.fstat { display:flex; gap:12px; align-items:baseline; } .fstat .num { font-size:24px; min-width:56px; flex-shrink:0; white-space:nowrap; } .fstat .plain { flex:1; min-width:0; margin:0; }
.cyclesvg { display:block; width:100%; height:auto; margin:4px 0 2px; overflow:visible; } .cyclesvg text { font-family:'Karla Variable','Karla',sans-serif; }
.meaning { border-left:3px solid var(--line); padding-left:11px; margin:0 0 12px; } .meaning .plain { margin:2px 0 0; }
.mhead { display:block; font-size:13px; } .mnote { color:var(--soft); font-size:13px; }
.scriptrow { display:flex; align-items:flex-start; gap:9px; margin:0 0 10px; } .scriptrow:last-child { margin-bottom:0; }
.scriptrow .script { flex:1; min-width:0; margin:0; } .scriptrow .script:last-child { margin-bottom:0; }
.sbadge { flex-shrink:0; width:22px; height:22px; border-radius:50%; background:color-mix(in srgb, var(--primary) 12%, var(--card)); color:var(--primary); font-size:11.5px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; margin-top:1px; }
.scopy { flex-shrink:0; align-self:flex-start; padding:0 2px; }
.tbar { display:inline-block; vertical-align:middle; width:46px; height:6px; border-radius:3px; background:color-mix(in srgb, var(--fc) 14%, var(--card)); margin-right:7px; overflow:hidden; }
.tbar i { display:block; height:100%; border-radius:3px; background:var(--fc); }
.plaincard.urgent { border:2px solid var(--bad); }
.plaincard.urgent .uchip { display:inline-block; margin-bottom:6px; }
/* Toast (spec §12): always in the DOM, faded and slid in over --t-base, out over 150ms; its lifetime scales with length
   (App.jsx ping, 2.6s to 8s). .long (over 60 characters) is a left-aligned rounded block instead of a centred pill. */
.toast { position:fixed; left:50%; transform:translate(-50%, 8px); bottom:calc(20px + var(--sa-b)); background:var(--ink); color:var(--on-ink); font-size:13px; line-height:1.4; padding:9px 16px; border-radius:999px; max-width:86%; text-align:center; z-index:9; opacity:0; pointer-events:none; box-shadow:var(--sh-toast); transition:opacity 150ms var(--ease-out), transform 150ms var(--ease-out); }
.toast::before { content:''; display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--toast-dot); margin-right:8px; vertical-align:1px; }
.toast.show { opacity:1; pointer-events:auto; transform:translate(-50%, 0); transition-duration:var(--t-base); transition-timing-function:var(--ease-in); will-change:transform; }
.toast.long { text-align:left; border-radius:14px; padding:11px 14px; max-width:92%; }
.cy:has(.stopbar) .toast { bottom:calc(86px + var(--sa-b)); }
/* ---- UI R1: Report — appointment line, ramp-tinted cover, threshold meters, softened rails, route hierarchy,
   picked questions, print. Family / ramp colours stay on the data marks only; the chrome is the stage palette. ---- */
.rappt { display:flex; flex-wrap:wrap; align-items:center; gap:0 6px; font-size:var(--fs-md); color:var(--soft); margin:-8px 0 10px; min-height:44px; }
.rappt b { color:var(--ink); } .rappt .linkbtn { font-size:var(--fs-md); }
.rcov-meta { margin-top:1px; }
.rcov-cells i.on { box-shadow:inset 0 0 0 1px var(--cell-edge); }
.rcov-cells i.today { background:transparent; box-shadow:inset 0 0 0 1.5px var(--primary); }
.rcov-today { font-size:var(--fs-sm); color:var(--soft); margin:8px 0 -4px; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.rcov-today .linkbtn { font-size:var(--fs-sm); }
.report .rsec { display:flex; align-items:baseline; gap:8px; }
.rnum { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:17px; letter-spacing:0; text-transform:none; color:var(--primary); line-height:1; }
.fhead b { font-size:15px; }
.fmeter { height:10px; border-radius:5px; }
.fmeter .fm-any, .fmeter .fm-strong { width:100%; transform-origin:left; transform:scaleX(var(--v, 0)); transition:transform 450ms var(--ease-in); }
.fm-any { background:color-mix(in srgb, var(--fc) 34%, var(--card)); }
.ftick { position:absolute; top:-2px; bottom:-2px; width:1px; height:auto; border-radius:0; background:var(--ink); opacity:.55; }
.fleg { margin:4px 0 6px; font-size:var(--fs-xs); gap:2px 10px; }
.fcount { color:var(--ink); font-weight:700; font-size:var(--fs-md); }
.fdelta { display:inline-flex; align-items:center; gap:4px; }
.fdelta.flat { color:var(--soft); font-weight:500; } .fdelta.worse, .fdelta.better { font-weight:600; }
.rtri { flex-shrink:0; }
.mfamrow { display:inline-flex; align-items:center; gap:6px; margin-bottom:2px; }
.mfam { font-size:var(--fs-xs); font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--soft); line-height:1.2; }
.report .scriptrow .script { border-left:none; padding-left:0; font-family:'Fraunces Variable','Fraunces',serif; font-weight:440; font-size:15px; line-height:1.5; }
.sbody { flex:1; min-width:0; display:flex; flex-direction:column; align-items:flex-start; gap:2px; }
.sadd { font-size:var(--fs-sm); min-height:36px; } .sadd.on { text-decoration:none; color:var(--good); }
.sadd:disabled { color:var(--soft); text-decoration:none; cursor:default; opacity:.7; }
.scopy.ok { color:var(--good); text-decoration:none; }
.routes { flex-wrap:wrap; }
.route { flex:1 1 150px; font-size:13px; padding:12px 10px; }
.route.primary { background:var(--primary); border-color:var(--primary); color:var(--on-primary); }
.route.primary span { color:color-mix(in srgb, var(--on-primary) 92%, transparent); font-size:11px; }
.rlong { margin:8px 0 0; }
.report .rsec + .emailpreview { margin-top:0; }
/* L9: the Appointment PDF card at the top of "Send it ahead", its notes opt-in, and the cycle table / notes list in "The numbers behind this". Tokens only. */
.pdfcard { background:var(--card); border:1.5px solid var(--primary); border-radius:var(--r-card); padding:14px 16px; margin:0 0 var(--stack); }
.pdfhead { display:flex; gap:10px; align-items:flex-start; }
.pdfico { flex-shrink:0; color:var(--primary-text); margin-top:3px; }
.pdftitle { font:600 var(--fs-lg)/1.2 'Fraunces Variable','Fraunces',serif; color:var(--ink); margin:0; }
.pdfin { font-size:var(--fs-sm); color:var(--soft); line-height:1.45; margin:3px 0 0; }
.pdfcard .consentopt { margin-top:12px !important; }
.pdfcard .routes { margin-top:12px; }
.pdfcard .route.primary { flex:1 1 100%; min-height:56px; }
.pdfcard .route[aria-disabled="true"] { background:var(--card); color:var(--primary-text); border-style:dashed; cursor:default; }
.pdfcard .route[aria-disabled="true"] span { color:var(--soft); }
.pdfnote { margin:8px 0 0; font-size:var(--fs-sm); }
.pdfacc { margin:8px 0 0; }
.rcap { caption-side:top; text-align:left; font:600 15px 'Fraunces Variable','Fraunces',serif; color:var(--ink); padding:14px 0 6px; margin:0; }
.rnotes { list-style:none; margin:0; padding:0; font-size:var(--fs-sm); line-height:1.5; }
.rnotes li { padding:6px 0; border-top:1px solid var(--line); overflow-wrap:anywhere; }
.rnotes b { margin-right:6px; }
.emailpreview { resize:none; field-sizing:content; background:color-mix(in srgb, var(--primary) 5%, var(--card)); border-radius:var(--r-card); padding:13px 15px; overflow:hidden; }
/* L10: the privacy dashboard rows (Settings → Privacy & your data → What can leave this device) and the lock screen. Tokens only; no animation is added, so the reduced-motion block above already covers them. */
.flowlist { list-style:none; margin:0 0 6px; padding:0; }
.flowrow { padding:10px 0 2px; border-top:1.5px solid var(--line); }
.flowrow:first-child { border-top:none; padding-top:2px; }
.flowhead { display:flex; justify-content:space-between; align-items:center; gap:10px; }
.flowhead b { font-size:14px; color:var(--ink); line-height:1.3; }
.flowstate { flex-shrink:0; font:700 11px 'Karla Variable','Karla'; line-height:1.2; border:1px solid var(--line); border-radius:var(--r-pill); padding:4px 10px; color:var(--soft); background:var(--card); }
.flowstate.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 12%, var(--card)); color:var(--primary-text); }
.flowstate.you { border-color:color-mix(in srgb, var(--accent) 55%, var(--line)); color:var(--accent-text); }
.flowstate.na { border-style:dashed; }
.flowline { margin:3px 0 0; font-size:var(--fs-sm); line-height:1.45; color:var(--soft); }
.flownote { margin:4px 0 0; font-size:var(--fs-sm); line-height:1.45; color:var(--primary-text); font-weight:600; }
.flowrow .morewrap { margin:2px 0 8px; }
.flowintro { margin:0 0 6px; font-size:var(--fs-sm); }
.lockscreen { text-align:center; }
.lockscreen .disp { margin-top:22px; }
.pinfield { display:block; max-width:220px; margin:14px auto 4px; text-align:center; font:600 24px 'Karla Variable','Karla'; letter-spacing:.45em; }
.lockstatus { min-height:1.5em; margin:0 0 10px; font-size:var(--fs-md); color:var(--soft); }
.lockstatus.bad { color:var(--bad); font-weight:600; }
.keypad { display:grid; grid-template-columns:repeat(3, 1fr); gap:var(--gap) 14px; max-width:276px; margin:0 auto 10px; }
.key { min-height:56px; min-width:44px; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--line); background:var(--card); border-radius:var(--r-pill); font:500 22px 'Fraunces Variable','Fraunces',serif; color:var(--ink); cursor:pointer; }
.key.del { border-color:transparent; background:none; color:var(--primary-text); }
.key:disabled { color:var(--soft); border-style:dashed; cursor:default; }
.lockforgot { display:flex; margin:14px auto 0; min-height:44px; }
.lockscreen .plaincard, .lockscreen .mcrow { text-align:left; }
@media print {
  .mast, nav[aria-label="Sections"], .navpill, .subnav, .v2sheet-wrap, .tabswrap, .routes, .pdfcard, .rappt .linkbtn, .rcov-today .linkbtn, .sadd, .scopy, .toast, .disclosure, .savebar, .report .cta, .rlong { display:none !important; }
  .bodypanel { display:block !important; border-radius:0; }
  .rappt { min-height:0; margin:0 0 6px; } .rappt:not(:has(b)), .rcov-today { display:none !important; }
  .cy { padding:0; max-width:none; background:#FFF; color:#000; }
  .plaincard > * { display:block; }
  .card, .plaincard, .finding, .meaning, .scriptrow, .rcover { break-inside:avoid; box-shadow:none; border-color:#999; }
  .rsec, .section-lab { break-after:avoid; }
  body { orphans:3; widows:3; }
  .fmeter { border:1px solid #999; }
  .fmeter .fm-any, .fmeter .fm-strong { transition:none; }
  .emailpreview { border:1px solid #999; }
  /* Print stays light (L2): App.jsx flips data-scheme to light on beforeprint / matchMedia('print'); a print the
     JS did not flip (a share-sheet print) still comes out readable black on white with this monochrome fallback. */
  html, body, #root { background:#FFF !important; color-scheme:light; }
  .cy, .cy *, .cy *::before, .cy *::after { transition:none !important; animation:none !important; }
  .cy[data-scheme="dark"] { color-scheme:light; --paper:#FFFFFF !important; --card:#FFFFFF !important; --ink:#000000 !important; --soft:#444444 !important; --line:#999999 !important; --primary:#000000 !important; --accent:#555555 !important; ${tokenDecls(SCHEME_TOKENS.light, true)} }
}
/* Palette crossfade: for --t-slow after a palette tap, an Appearance tap or a system light/dark flip (.cy.repaint,
   App.jsx; never on hydrate, a cross-tab adopt or print) the page and the chrome recolour together. The .cy background
   transitions only inside that window: outside it (launch, adopt) a scheme change lands in one frame.
   FAMILIES / RAMPS inline colours (chart dots, severity marks) are not in this list by design: data never animates. */
.cy.repaint { transition:background var(--t-slow); }
.cy.repaint .card, .cy.repaint .plaincard, .cy.repaint .cta, .cy.repaint .navtab.on, .cy.repaint .navplus, .cy.repaint .mc.on, .cy.repaint .stagecard.on, .cy.repaint .pulse, .cy.repaint .meter, .cy.repaint .disclosure, .cy.repaint .pchart, .cy.repaint .streak, .cy.repaint .readcard { transition-property:background-color, border-color, color; transition-duration:var(--t-slow); }
/* ---- UI S1: Settings and palette sheets. A sticky title bar with a Close button (Done stays at the bottom), three
   groups separated by a rule, labels with a glyph, a nudge row that says when its time isn't used (tinted, never
   dimmed by opacity: the filled pill would fall under 4.5:1), a data status strip, visible field labels, and palette
   options that preview themselves: each row carries its own --primary / --accent / --line, so its name, border, check
   and mini page swatch are drawn in that palette while the rest of the sheet stays in the current one. ---- */
.sheethead { position:sticky; top:0; z-index:2; display:flex; justify-content:space-between; align-items:center; gap:10px; background:var(--card); margin:-14px -14px 10px; padding:12px 14px; border-bottom:1.5px solid var(--line); border-radius:14px 14px 0 0; }
.sheettitle { font:600 20px 'Fraunces Variable','Fraunces',serif; margin:0; color:var(--ink); line-height:1.15; }
.sheetclose { display:inline-flex; align-items:center; justify-content:center; min-width:44px; min-height:44px; padding:0; border:1px solid var(--line); border-radius:var(--r-pill); background:var(--card); color:var(--primary-text); cursor:pointer; }
.setgroup { padding:10px 0 2px; border-top:1px solid var(--edge); }
.sheethead + .setgroup { border-top:none; padding-top:0; }
.palsheet .medinfo span, .youpage .medinfo span { font-size:13px; line-height:1.45; }
.palsheet .rfoot { font-size:12.5px; margin-top:8px; }
.palsheet .linkbtn { display:flex; width:100%; justify-content:center; min-height:44px; }
.palsheet .ghostbtn { margin-top:10px; }
.palsheet .section-lab .labico, .youpage .section-lab .labico { color:var(--accent); }
.nudgewrap.muted .seg { border-style:dashed; }
.nudgewrap.muted .mc { color:var(--soft); }
.nudgewrap.muted .mc.on { background:color-mix(in srgb, var(--primary) 14%, var(--card)); color:var(--primary-text); }
.nudgehint { margin:8px 0 0; font-size:var(--fs-sm); }
.datastat { display:flex; gap:6px; align-items:center; flex-wrap:wrap; font-size:13px; line-height:1.4; margin:0 0 10px; padding:9px 12px; border-radius:var(--r-inner); background:color-mix(in srgb, var(--accent) 10%, var(--card)); border-left:3px solid var(--accent); color:var(--ink); }
.flab { display:block; margin:0 0 9px; font-size:var(--fs-sm); font-weight:700; color:var(--soft); line-height:1.3; }
.flab > span { display:block; margin-bottom:4px; }
.flab .inp { margin-bottom:0; }
.palopt { border-color:var(--line); }
.palopt.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 8%, var(--card)); }
.palopt b, .palcheck { color:var(--primary); }
.palmini { margin-left:auto; width:34px; height:22px; flex-shrink:0; border-radius:6px; background:var(--paper-mini); border:1px solid var(--line); position:relative; }
.palmini::after { content:''; position:absolute; left:5px; right:5px; bottom:4px; height:5px; border-radius:3px; background:var(--primary); }
/* ---- UI PT1: POTS. The Home card's two compact meters (fluids = palette primary, sodium = the accent: chrome, not
   data colours), the one-tap usual drink row, the page's head row and joined section control, the Full/Simple switch,
   the step dots on first-run cards and the "When to get help now" row. ---- */
.goalfill.salt { background:var(--accent); }
.pots .labico { width:16px; height:16px; color:var(--primary); } .pots .labico.salt { color:var(--accent); }
.section-lab.potslab::before { display:none; } .section-lab.potslab .labico { width:14px; height:14px; vertical-align:-3px; color:var(--accent); }
.pots-home .meters { display:grid; grid-template-columns:1fr; gap:10px 14px; margin:0 0 6px; } .pots-home .meters.two { grid-template-columns:1fr 1fr; }
.goalmeter { min-width:0; } .goalmeter .goalbar { margin:6px 0 0; height:8px; }
.goalhead { display:flex; flex-wrap:wrap; align-items:baseline; gap:2px 6px; line-height:1.2; }
.goallab { display:inline-flex; align-items:center; gap:5px; width:100%; font-size:var(--fs-xs); font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--soft); }
.goallab .labico { width:16px; height:16px; margin:0; color:var(--primary); } .goalmeter.salt .goallab .labico { color:var(--accent); }
.goalmeter .num { font-size:20px; min-width:0; } .goalmeter.salt .num { color:var(--accent-text); }
.goalof { font-size:var(--fs-sm); color:var(--soft); }
.pots-home .medrow { padding:6px 0; } .pots-home .medinfo b { font-size:14px; } .pots-home .medrow + .routes { margin-top:6px !important; }
.pots-home .route { font-size:13px; min-height:56px; padding:10px 8px; } .pots-home .route span { font-size:11.5px; }
.pots-home .ghostbtn.potsopen { width:auto; border:none; padding:10px 4px 6px; margin:4px 0 -6px; font-size:12.5px; text-decoration:underline; min-height:44px; text-align:left; color:var(--primary-text); }
.potshead { display:flex; align-items:center; gap:10px; margin:4px 0 6px; } .potshead .backbar { margin:0; } .potshead .disp { margin:0; font-size:22px; }
.pots .hint.tophint { margin-bottom:12px; }
.pots .secnav { margin-bottom:14px; } .pots .secnav .mc { padding:8px 10px; min-height:44px; }
.pots .daterow { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:6px 10px; margin-bottom:8px; } .daterow .plain { margin:0; }
.pots .viewsw { width:auto; margin-left:auto; } .pots .viewsw .mc { flex:0 0 auto; padding:7px 12px; white-space:nowrap; }
.potsgrid .route[aria-disabled="true"] { border-style:dashed; color:var(--soft); }
.pots .hint.foot2 { font-size:12px; color:var(--soft); margin:4px 0 0; line-height:1.5; }
.pots .reportline { margin-top:8px; font-size:var(--fs-sm); color:var(--soft); } .pots .reportline .linkbtn { font-size:var(--fs-sm); }
.stepline { display:flex; align-items:center; gap:8px; margin-bottom:4px; } .stepline .stepno { margin:0; }
.stepline .prog { margin:0; gap:4px; } .stepline .prog span { flex:none; width:6px; height:6px; border-radius:50%; }
.pots .linkbtn.helpnow { display:flex; align-items:center; gap:8px; width:100%; text-decoration:none; border:1px solid var(--line); border-radius:var(--r-card); padding:10px 13px; margin-top:14px; min-height:44px; color:var(--ink); background:var(--card); font-size:var(--fs-md); text-align:left; }
.pots .linkbtn.helpnow::before { content:''; flex-shrink:0; width:8px; height:8px; border-radius:50%; background:var(--bad); }
.pots .linkbtn.helpnow .chev { margin-left:auto; color:var(--soft); }
/* ---- L1 (spec A14.1): the waiting-update row in the header and Home's install tip ---- */
.mast > .updrow { flex:1 1 100%; display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin:6px 0 0; padding:0 4px 0 12px; border:1px solid var(--line); border-radius:var(--r-pill); background:var(--card); font-size:var(--fs-sm); color:var(--soft); }
.updrow .linkbtn { min-height:44px; padding:0 8px; font-size:var(--fs-sm); }
/* gap 6px, 10px left padding and a slightly narrower Install keep the sentence to two lines at 390px, so the tip adds ≤ 64px to Home. */
.installtip { display:flex; align-items:center; gap:6px; margin:10px 0 0; padding:4px 4px 4px 10px; border:1px solid var(--line); border-radius:var(--r-card); background:var(--card); }
.installtip p { flex:1; min-width:0; margin:0; font-size:var(--fs-md); line-height:1.35; color:var(--ink); }
.installtip .tipico { flex:0 0 auto; color:var(--accent-text); }
.installtip .takebtn { flex-shrink:0; padding:8px 11px; }
.tipclose { flex:0 0 44px; width:44px; height:44px; display:inline-flex; align-items:center; justify-content:center; padding:0; border:none; background:none; color:var(--soft); border-radius:var(--r-pill); cursor:pointer; }
/* ---- L6: symptom list and day note (spec §5.1 "Today: her symptom list and a day note"). The "Symptoms · Edit" row over
   the chips, the "More symptoms · n" disclosure under them, the inline "Your symptoms" sheet (a card like the palette
   sheet; its title bar is not sticky mid-page under the section bar; one level of containment, so its Details renders
   as a row), and the day note with its counter. Tokens only; no family colours in the sheet. ---- */
.chiphead { display:flex; justify-content:space-between; align-items:center; gap:10px; margin:2px 0 4px; }
.chiphead .section-lab { margin:0; }
.chiphead .linkbtn { font-size:var(--fs-sm); min-width:44px; justify-content:flex-end; }
.disclosure.more.symmore { margin:-6px 0 12px; }
.disclosure.more.symmore[aria-expanded="true"] { border-radius:var(--r-inner); }
.chips.morechips { margin:8px 0 16px; }
.symsheet { background:var(--card); border:1px solid var(--edge); border-radius:var(--r-card); padding:14px; margin:0 0 16px; box-shadow:var(--sh-sheet); animation:cy-fade-rise var(--t-base) var(--ease-in); }
.symsheet .sheethead { position:static; }
.symsheet .section-lab::before { display:none; }
.symsheet .section-lab { margin:14px 0 2px; }
.symsheet > .hint { font-size:var(--fs-sm); margin:0 0 6px; }
.symlist { list-style:none; margin:0; padding:0; }
.symlist .medrow { flex-wrap:wrap; }
.symlist .medinfo { flex:1 1 130px; min-width:0; overflow-wrap:anywhere; }
.symlist .wearbtns { margin-left:auto; flex-wrap:wrap; justify-content:flex-end; }
.sbtn.symmove { min-width:44px; padding:0 10px; display:inline-flex; align-items:center; justify-content:center; }
.symsheet .disclosure.more { border:none; border-top:1px solid var(--line); border-radius:0; background:none; padding:8px 0; margin-top:10px; color:var(--primary-text); }
.symsheet .bodypanel.more { border:none; padding:0 0 4px; }
.symsheet .bodypanel.more ul { padding-left:0; }
.symsheet .bodypanel.more li { margin:0; }
.symsheet .linkbtn.symreset { display:flex; margin:10px 0 0; font-size:var(--fs-sm); }
.linkbtn.addnote { display:flex; margin:10px 0 4px; font-size:var(--fs-md); }
.daynote { margin:14px 0 4px; }
.daynote .section-lab { display:block; margin:0 0 6px; }
.daynote .inp { display:block; min-height:76px; resize:vertical; line-height:1.45; margin-bottom:4px; }
.notefoot { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
.notefoot .rfoot { margin:0; }
.notecount { flex-shrink:0; font-size:var(--fs-sm); color:var(--soft); font-variant-numeric:tabular-nums; }
.notecount.near { color:var(--ink); font-weight:700; }
.daycard .dayline.noteline { white-space:pre-wrap; overflow-wrap:anywhere; }
/* L7 fertility signs (decision D6): Today's group, the Calendar marks and legend, the Patterns card. Existing tokens only
   (no FAMILIES or RAMPS colours), no motion; every target uses the existing 44px .mc / .linkbtn / .takebtn / .inp rules. */
.fertsigns { margin:var(--stack) 0; }
.fertsigns > .section-lab { margin:0 0 2px; }
.fertsigns .fertsub { font-size:var(--fs-sm); margin:0 0 10px; }
.fertsigns [role=group] { margin-bottom:10px; }
.fertsigns label.qlab { display:block; }
.fertseg .mc { padding:7px 2px; }
.bbtrow { display:flex; gap:var(--gap); align-items:stretch; }
.bbtrow .inp { flex:1 1 auto; min-width:0; margin-bottom:0; font-variant-numeric:tabular-nums; }
.seg.unitseg { flex:0 0 112px; width:112px; margin-bottom:0; }
.fertsigns .inphelp, .fertsigns .errhint { margin:6px 0 0; }
.fertfoot { margin-top:10px; }
.dischnote { font-size:var(--fs-sm); margin:0 0 6px; }
.c-fmarks { position:absolute; top:3px; right:3px; display:flex; gap:1px; line-height:0; pointer-events:none; }
.c-fmarks svg { stroke-width:3; }
.fm-ew path { fill:currentColor; }
.callegend .d-ficon { width:11px; height:11px; margin-right:4px; vertical-align:-1px; color:var(--ink); }
.fertsum .fertlist { list-style:none; margin:0; padding:0; display:grid; gap:6px; font-size:var(--fs-md); }
.fertsum .fertlist li { display:flex; gap:8px; align-items:flex-start; }
.fertsum .fertlist .labico { flex:0 0 auto; margin:3px 0 0; }
.fertsum .fertshift { margin:10px 0 0; }
/* Patterns summary and links (L8) */
.sumcard { padding:12px 14px 14px; } .sumcard .seg { margin-bottom:10px; }
.summeta { font-size:var(--fs-sm); color:var(--soft); margin:0 0 6px; line-height:1.35; }
.sumcells { display:grid; grid-template-columns:repeat(var(--n, 7), 1fr); gap:3px; margin:0 0 10px; }
.sumcells i { display:block; height:10px; border-radius:3px; box-shadow:inset 0 0 0 1.5px var(--line); }
.sumcells i.on { box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--ink) 18%, transparent); }
.sumcells i.today:not(.on) { box-shadow:inset 0 0 0 1.5px var(--primary); }
.sumtext { margin:0; }
.card.findcard .fdot { width:8px; height:8px; margin-right:6px; vertical-align:1px; }
.findhow { padding:4px 14px 8px; } .findhow .bodypanel p { margin:0 0 8px; }
.findlist { margin:0 0 8px; padding-left:17px; } .findlist li { margin:3px 0; }
/* ---- design system v2 (calm R1, spec §8.5): cards, icon badges, quick tiles, step rails, rings, two-bar comparisons,
   chips, the nav pill, the bottom sheet, blobs and the empty note. Colours are tokens only (--tint-* domain pastels,
   --edge hairline, --sh-lift); data marks take FAMILIES (--fam-*) or the soft ramp (--soft-1..4), never the palette. ---- */
.cy [data-tint="mind"] { --tintc:var(--tint-mind); } .cy [data-tint="body"] { --tintc:var(--tint-body); }
.cy [data-tint="patterns"] { --tintc:var(--tint-patterns); } .cy [data-tint="you"] { --tintc:var(--tint-you); }
.eyebrow { margin:0 0 3px; font:700 var(--fs-xs) 'Karla Variable','Karla',sans-serif; letter-spacing:.14em; text-transform:uppercase; color:var(--primary-text); line-height:1.2; }
.serif { font-family:'Fraunces Variable','Fraunces',serif; }
.v2card { position:relative; background:var(--card); border:1px solid var(--edge); border-radius:var(--r-card); box-shadow:var(--sh-card); padding:16px; margin-bottom:var(--stack); }
.v2card[data-tint] { background:linear-gradient(180deg, var(--tintc) 0, var(--card) 92px) var(--card); }
.v2card.hero { padding:20px 18px; }
.v2card-head { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
.v2card-head:only-child { margin-bottom:0; }
.v2card-titles { flex:1; min-width:0; }
.v2card-eyerow { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px; } .v2card-eyerow .eyebrow { margin:0; }
.v2card-title { margin:0; font-family:'Fraunces Variable','Fraunces',serif; font-weight:560; font-size:18px; line-height:1.25; letter-spacing:-.005em; color:var(--ink); }
.v2card.hero .v2card-title { font-size:22px; }
.v2card-action { flex-shrink:0; }
.v2card p { font-size:var(--fs-md); line-height:1.5; }
.ibadge { --ib:36px; flex-shrink:0; width:var(--ib); height:var(--ib); border-radius:50%; display:inline-flex; align-items:center; justify-content:center; background:color-mix(in srgb, var(--primary) 14%, var(--card)); color:var(--primary-text); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--primary) 10%, transparent); }
.ibadge[data-tint] { background:var(--tintc); }
.v2card[data-tint] .ibadge { background:var(--card); }
/* Quick-log tiles: a soft card-coloured tile (its label names it, so the hairline is decorative), a pastel badge. */
.qtiles { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:var(--gap); margin-bottom:var(--stack); }
.qtile { min-height:84px; min-width:44px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:10px 4px; border:1px solid var(--edge); background:var(--card); border-radius:var(--r-tile); box-shadow:var(--sh-card); font:700 12.5px 'Karla Variable','Karla',sans-serif; color:var(--ink); cursor:pointer; transition:transform var(--t-fast) var(--ease-std), background-color var(--t-base), border-color var(--t-base); }
.qtile:active { transform:scale(.96); }
.qtile-ico { width:38px; height:38px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; background:var(--tintc, color-mix(in srgb, var(--primary) 13%, var(--card))); color:var(--primary-text); }
.qtile-lab { line-height:1.2; text-align:center; }
.qtile-note { font-size:var(--fs-xs); font-weight:600; color:var(--soft); line-height:1.2; }
.qtile[aria-pressed="true"] { background:color-mix(in srgb, var(--primary) 12%, var(--card)); border-color:var(--primary); }
.qtile[aria-pressed="true"] .qtile-ico { background:var(--primary); color:var(--on-primary); }
/* Step rails: circles joined by a dotted line; done = filled with a tick, current = accent ring, todo = neutral. */
.steprail { list-style:none; margin:0; padding:0; display:flex; }
.steprail .step { position:relative; flex:1 1 0; min-width:0; display:flex; flex-direction:column; align-items:center; text-align:center; gap:3px; }
.steprail .step + .step::before { content:''; position:absolute; top:15px; right:calc(50% + 20px); left:calc(-50% + 20px); border-top:2px dotted var(--line); }
.steprail .step.done + .step::before { border-top-style:solid; border-color:color-mix(in srgb, var(--primary) 55%, var(--card)); }
.stepdot { width:32px; height:32px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font:700 13px 'Karla Variable','Karla',sans-serif; border:1.5px dashed var(--line); color:var(--soft); background:var(--card); }
.step.done .stepdot { border:none; background:var(--primary); color:var(--on-primary); }
.step.current .stepdot { border:2px solid var(--primary); color:var(--primary-text); background:color-mix(in srgb, var(--primary) 12%, var(--card)); box-shadow:0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent); }
.steplab { font-weight:700; font-size:var(--fs-sm); color:var(--ink); line-height:1.25; margin-top:3px; }
.step.current .steplab { color:var(--primary-text); }
.stepsub { font-size:var(--fs-xs); color:var(--soft); line-height:1.3; }
/* Rings: track in the stage tint, arc in the stage colour; the arc draws in once (off under reduced motion). */
.ringrow { display:flex; justify-content:space-around; align-items:flex-start; gap:var(--gap); }
.ring { margin:0; display:flex; flex-direction:column; align-items:center; gap:6px; flex:0 1 var(--ring); min-width:0; }
.ringwrap { position:relative; width:100%; max-width:var(--ring); aspect-ratio:1; display:grid; place-items:center; container-type:inline-size; }
.ringsvg { position:relative; display:block; overflow:visible; grid-area:1 / 1; width:100%; height:100%; }
.ringtrack { stroke:color-mix(in srgb, var(--primary) 14%, var(--card)); }
.ringarc { stroke:var(--primary); animation:cy-ring 900ms var(--ease-std) both; }
.ring.tone-accent .ringtrack { stroke:color-mix(in srgb, var(--accent) 14%, var(--card)); } .ring.tone-accent .ringarc { stroke:var(--accent); }
.ring.tone-soft .ringtrack { stroke:color-mix(in srgb, var(--ink) 8%, var(--card)); } .ring.tone-soft .ringarc { stroke:var(--soft); }
.ringmid { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; pointer-events:none; }
.ringmid b { font-family:'Fraunces Variable','Fraunces',serif; font-weight:560; font-size:calc(var(--ring) * .2); font-size:20cqw; line-height:1.05; color:var(--ink); font-variant-numeric:tabular-nums; }
.ringmid span { font-size:var(--fs-sm); color:var(--soft); margin-top:2px; }
.ring figcaption { display:flex; flex-direction:column; align-items:center; gap:1px; text-align:center; }
.ringtitle { font:700 var(--fs-xs) 'Karla Variable','Karla',sans-serif; letter-spacing:.12em; text-transform:uppercase; color:var(--primary-text); }
.ring.tone-accent .ringtitle { color:var(--accent-text); }
.ringword { font-size:var(--fs-sm); color:var(--ink); }
.ringblob { position:absolute; width:128%; height:128%; left:-14%; top:-14%; }
@keyframes cy-ring { from { stroke-dashoffset:var(--ring-c); } to { stroke-dashoffset:var(--ring-off); } }
/* Blobs (illustrated moments): the stage colours mixed thinly into the card. */
.blob { display:block; overflow:visible; pointer-events:none; }
.blob-a { fill:color-mix(in srgb, var(--primary) 13%, transparent); }
.blob-b { fill:color-mix(in srgb, var(--accent) 11%, transparent); }
.emptynote { position:relative; display:flex; align-items:center; gap:12px; padding:6px 2px; }
.emptynote .emptyblob { width:64px; height:58px; flex-shrink:0; }
.emptynote p { margin:0; font-size:var(--fs-md); color:var(--soft); line-height:1.5; }
/* Two-bar comparison (pattern cards): data colours only. */
.twobar { margin:0; display:flex; align-items:center; gap:14px; }
.twobar-diff { flex-shrink:0; display:flex; flex-direction:column; min-width:78px; }
.twobar-diff b { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:28px; line-height:1.05; color:var(--ink); font-variant-numeric:tabular-nums; white-space:nowrap; }
.twobar-diff span { font-size:var(--fs-xs); color:var(--soft); margin-top:2px; }
.twobar-bars { flex:1; min-width:0; display:flex; flex-direction:column; gap:10px; }
.twobar-lab { display:flex; justify-content:space-between; gap:8px; font-size:var(--fs-xs); color:var(--soft); margin-bottom:4px; }
.twobar-lab b { color:var(--ink); font-weight:700; }
.twobar-track { height:8px; border-radius:var(--r-pill); background:color-mix(in srgb, var(--ink) 7%, var(--card)); overflow:hidden; }
.twobar-track i { display:block; height:100%; border-radius:var(--r-pill); background:var(--fc); transform-origin:left; animation:cy-grow 600ms var(--ease-std) both; }
.twobar-row.other .twobar-track i { background:color-mix(in srgb, var(--fc) 42%, var(--card)); }
/* Soft-ramp bars and sparklines (the dev gallery and later charts). */
.softbars { display:flex; align-items:flex-end; gap:5px; height:56px; }
.softbars i { flex:1; border-radius:6px 6px 3px 3px; background:var(--soft-2); }
.softbars i.s1 { background:var(--soft-1); } .softbars i.s3 { background:var(--soft-3); } .softbars i.s4 { background:var(--soft-4); }
/* Status chips: words, never grades. */
.vchip { display:inline-flex; align-items:center; gap:4px; font:700 11px 'Karla Variable','Karla',sans-serif; line-height:1.2; border-radius:var(--r-pill); padding:4px 10px; white-space:nowrap; }
.vchip.v-logged { background:color-mix(in srgb, var(--good) 13%, var(--card)); color:var(--good); }
.vchip.v-supported { background:color-mix(in srgb, var(--primary) 16%, var(--card)); color:var(--primary-text); }
.vchip.v-still { background:var(--ev-mixed-bg); color:var(--ev-mixed-ink); }
.vchip.v-notenough { background:color-mix(in srgb, var(--ink) 5%, var(--card)); color:var(--soft); box-shadow:inset 0 0 0 1px var(--edge); }
.vchip.v-pro { background:color-mix(in srgb, var(--accent) 16%, var(--card)); color:var(--accent-text); }
/* The nav pill: a floating bar of five tabs with a filled "+" centred over the middle gap. */
.navpill { z-index:6; }
.navpill.fixed { position:fixed; left:0; right:0; bottom:0; padding:0 12px calc(10px + var(--sa-b)); max-width:430px; margin:0 auto; pointer-events:none; }
.navpill-bar { position:relative; pointer-events:auto; background:color-mix(in srgb, var(--card) 94%, transparent); backdrop-filter:saturate(150%) blur(10px); -webkit-backdrop-filter:saturate(150%) blur(10px); border:1px solid var(--edge); border-radius:var(--r-pill); box-shadow:var(--sh-lift); padding:5px; }
.navpill-tabs { display:grid; align-items:stretch; grid-template-columns:var(--np-cols); }
.navtab { min-height:54px; min-width:44px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; border:none; background:none; border-radius:var(--r-pill); padding:4px 2px; font:600 11px 'Karla Variable','Karla',sans-serif; color:var(--soft); cursor:pointer; transition:background-color var(--t-base), color var(--t-base); }
.navtab span { line-height:1.1; white-space:nowrap; }
.navtab.on { background:color-mix(in srgb, var(--primary) 13%, var(--card)); color:var(--primary-text); font-weight:800; }
.navtab:focus-visible { outline-offset:-3px; border-radius:var(--r-pill); }
.navplus { position:absolute; top:50%; left:50%; width:56px; height:56px; transform:translate(-50%, -50%); border:none; border-radius:50%; background:var(--primary); color:var(--on-primary); display:inline-flex; align-items:center; justify-content:center; box-shadow:0 8px 20px -6px var(--primary), 0 0 0 4px var(--card); cursor:pointer; transition:transform var(--t-fast) var(--ease-std); }
.navplus:active { transform:translate(-50%, -50%) scale(.94); }
.navplus:focus-visible { outline-offset:4px; border-radius:50%; }
@media (max-width:359px) { .navpill.fixed { padding-left:6px; padding-right:6px; } .navpill-bar { padding:3px; } .navpill-tabs { grid-template-columns:var(--np-narrow); } .navplus { width:50px; height:50px; left:calc(3px + (100% - 58px) * 0.4 + 26px); } }
/* The bottom sheet. */
.v2sheet-wrap { position:fixed; inset:0; z-index:8; display:flex; align-items:flex-end; justify-content:center; }
.v2sheet-back { position:absolute; inset:0; background:var(--scrim); animation:cy-fade var(--t-base) var(--ease-std) both; }
.v2sheet { position:relative; width:100%; max-width:430px; max-height:88dvh; overflow:auto; background:var(--card); border-radius:26px 26px 0 0; box-shadow:var(--sh-sheet); padding:8px 18px calc(20px + var(--sa-b)); animation:cy-sheet-rise 240ms var(--ease-in) both; }
.v2sheet-grip { display:block; width:40px; height:5px; border-radius:var(--r-pill); background:color-mix(in srgb, var(--ink) 16%, var(--card)); margin:2px auto 8px; }
.v2sheet-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
.v2sheet-title { margin:0; font-family:'Fraunces Variable','Fraunces',serif; font-weight:560; font-size:20px; line-height:1.25; color:var(--ink); }
.v2sheet-close { flex-shrink:0; width:44px; height:44px; border-radius:50%; border:1px solid var(--line); background:var(--card); color:var(--ink); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
@keyframes cy-sheet-rise { from { transform:translateY(40px); opacity:.4; } }
@keyframes cy-fade { from { opacity:0; } }
/* The "+" log sheet (calm R2): seven quick-log tiles in a 4-up grid (4 + 3, or 4 + 4 with Move). */
.logsheet-hint { margin:0 0 12px; }
.logtiles { margin-bottom:4px; }
.logtiles .qtile { animation:cy-fade-rise var(--t-base) var(--ease-in) both; }
.logtiles .qtile:nth-child(n+5) { animation-delay:40ms; }
/* Registration's "Living with PCOS?" step (calm R2): four answers 2-up, then the module's framing on a pastel note. */
.pcosopts { display:grid; grid-template-columns:1fr 1fr; gap:var(--gap); margin:6px 0 14px; }
.pcosopts .mc.pcosopt { min-height:56px; margin:0; display:inline-flex; align-items:center; justify-content:center; gap:6px; border-radius:var(--r-tile); font-weight:700; text-align:center; }
.pcosnote { display:flex; gap:12px; align-items:center; padding:14px; border-radius:var(--r-card); border:1px solid var(--edge); background:linear-gradient(135deg, var(--tint-body), var(--card) 80%); }
.pcosnote p { margin:0; font-size:var(--fs-md); line-height:1.5; color:var(--ink); }
/* You (calm R2): one scrolling page — her name in the serif, the stage hero, settings, modules, support & care. */
.youpage { position:relative; }
.youpage > .eyebrow { margin-top:4px; }
.youname { margin:0 0 14px; }
.youstage .hint { margin:0 0 6px; }
.youstage .stagechip.quiet { min-height:44px; padding:6px 0; font-size:var(--fs-md); }
.youlist { list-style:none; margin:0 0 4px; padding:0; display:grid; gap:8px; }
.youlist li { display:flex; gap:10px; align-items:flex-start; font-size:var(--fs-md); line-height:1.45; color:var(--ink); }
.youlist svg { flex-shrink:0; margin-top:2px; color:var(--primary-text); }
.youopen { margin-top:12px; }
.modlist { list-style:none; margin:0; padding:0; }
.modrow:first-child { border-top:none; padding-top:2px; }
.carepart { margin-top:22px; padding-top:4px; }
.carepart > .disp { font-size:22px; }
.cyclespage > p { font-size:var(--fs-md); line-height:1.5; color:var(--soft); }
/* The dev gallery (#/dev/ui, VITE_FEATURES devGallery only). */
.devgallery { padding-bottom:104px; }
.dgcontrols { margin:0 0 var(--stack); } .dgcontrols .lab { margin-top:6px; } .dgcontrols .seg { margin-bottom:6px; }
.dgrings { padding:18px 10px 14px; }
.dgcount { font-size:var(--fs-xs); font-weight:700; color:var(--soft); }
.dgfoot { display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:10px; border-top:1px solid var(--edge); font-size:var(--fs-xs); color:var(--soft); }
.dgfoot .linkbtn { min-height:44px; gap:4px; text-decoration:none; font-size:var(--fs-sm); }
.dgchips { display:flex; flex-wrap:wrap; gap:6px; }
.dgbadges { display:flex; flex-wrap:wrap; gap:14px; }
.dgbadge { display:inline-flex; flex-direction:column; align-items:center; gap:4px; font-size:var(--fs-xs); color:var(--soft); }
.dgserif { font-family:'Fraunces Variable','Fraunces',serif; font-size:22px; font-weight:500; margin:0 0 6px; }
.dglog { grid-template-columns:repeat(4, minmax(0, 1fr)); }
/* ---- Home v2 (calm R3): the hero ring, Quick log, today's small step, the Body/Mind rails, the word-based patterns preview. ---- */
.mast > .stagechip.icon { border-color:transparent; background:color-mix(in srgb, var(--primary) 9%, var(--card)); box-shadow:inset 0 0 0 1px var(--edge); }
.mast > .stagechip.icon[aria-expanded="true"] { background:color-mix(in srgb, var(--primary) 16%, var(--card)); box-shadow:inset 0 0 0 1.5px var(--primary); }
.mast > .acctchip { border-color:transparent; background:color-mix(in srgb, var(--ink) 5%, var(--card)); color:var(--soft); }
.homehero { position:relative; text-align:center; padding:2px 0 4px; margin-bottom:var(--stack); }
.homehero .homedate { margin:0 0 6px; }
.homehero .greet { font-size:28px; letter-spacing:-.01em; }
.herofig { position:relative; display:grid; place-items:center; width:min(100%, 320px); height:224px; margin:4px auto 0; }
.heroblob { position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none; animation:cy-drift 14s ease-in-out infinite alternate; }
.heroblob-a { fill:color-mix(in srgb, var(--primary) 15%, transparent); }
.heroblob-b { fill:color-mix(in srgb, var(--accent) 14%, transparent); }
.heroblob-c { fill:color-mix(in srgb, var(--accent) 22%, transparent); }
.homehero[data-kind="calm"] .heroblob-a, .homehero[data-kind="start"] .heroblob-a { fill:color-mix(in srgb, var(--primary) 10%, transparent); }
@keyframes cy-drift { from { transform:translate(-4px, 2px) rotate(-1.5deg); } to { transform:translate(4px, -3px) rotate(1.5deg); } }
.heroring { position:relative; flex:none; width:176px; }
.heroring .ringwrap { border-radius:50%; background:radial-gradient(circle, var(--card) 0 61%, transparent 62%); box-shadow:0 18px 40px -22px color-mix(in srgb, var(--primary) 70%, transparent); }
.heroring .ringmid b { font-size:40px; font-weight:520; letter-spacing:-.015em; }
.heroring .ringmid span { font-size:var(--fs-md); color:var(--soft); margin-top:4px; }
.homehero[data-kind="meno"] .heroring .ringmid b { font-size:44px; }
.homehero[data-kind="meno"] .heroring .ringmid span { max-width:110px; line-height:1.25; font-size:var(--fs-sm); }
.heroline { display:flex; align-items:center; gap:12px; width:100%; min-height:60px; margin:8px 0 0; padding:12px 14px; text-align:left; background:var(--card); border:1px solid var(--edge); border-radius:var(--r-card); box-shadow:var(--sh-card); color:var(--ink); font:inherit; }
button.heroline { cursor:pointer; transition:transform var(--t-fast) var(--ease-std); } button.heroline:active { transform:scale(.985); }
.heroline-ico { flex:none; width:36px; height:36px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; background:color-mix(in srgb, var(--primary) 13%, var(--card)); color:var(--primary-text); }
.heroline-txt { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.heroline-txt b { font-size:15px; font-weight:700; line-height:1.3; color:var(--ink); }
.heroline-txt span { font-size:var(--fs-sm); line-height:1.35; color:var(--soft); }
.heroline-go { flex:none; color:var(--primary-text); }
.homehero .herorows { margin:6px 0 0; padding:0 14px; text-align:left; border-radius:var(--r-card); }
.homehero .herorows .nextrow { min-height:44px; padding:6px 0; align-items:center; }
.homehero .herorows .nexttext { line-height:1.3; } .homehero .herorows .nextsub { line-height:1.3; }
.homehero .todayline { justify-content:center; margin:6px 0 -6px; }
.homehero[data-len="mid"] .heroring .ringmid b { font-size:34px; }
.homehero[data-len="long"] .heroring .ringmid b { font-size:29px; }
.qlhead .v2card-title:focus { outline:none; } .qlhead .v2card-title:focus-visible { outline:2px solid var(--primary); outline-offset:3px; border-radius:6px; }
.quicklog { margin:0 0 var(--stack); }
.qlhead { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:4px 2px 10px; }
.qlhead .v2card-title { font-size:20px; }
.qlpick { flex:none; width:44px; height:44px; border-radius:50%; border:none; background:color-mix(in srgb, var(--primary) 9%, var(--card)); box-shadow:inset 0 0 0 1px var(--edge); color:var(--primary-text); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
.homeqtiles { grid-template-columns:repeat(var(--qcols, 4), minmax(0, 1fr)); margin-bottom:0; }
.homeqtiles .qtile { min-height:92px; }
.homeqtiles .qtile-note .vchip { padding:2px 7px; font-size:10.5px; }
.stepcard .v2card-head { margin-bottom:8px; }
.stepcard .stepbody { margin:0 0 12px; color:var(--soft); }
.stepacts { display:flex; flex-wrap:wrap; gap:8px; }
.stepgo, .stepskip { min-height:44px; padding:0 18px; border-radius:var(--r-pill); font:700 14px 'Karla Variable','Karla',sans-serif; cursor:pointer; transition:transform var(--t-fast) var(--ease-std); }
.stepgo:active, .stepskip:active { transform:scale(.97); }
.stepgo { border:none; background:var(--primary); color:var(--on-primary); box-shadow:0 6px 14px -8px var(--primary); }
.stepskip { border:1px solid var(--line); background:var(--card); color:var(--ink); }
.stepcard .morewrap { margin:8px 0 -6px; }
.stepcard .disclosure.more { border:none; border-top:1px solid var(--edge); border-radius:0; background:none; padding:8px 0; color:var(--primary-text); justify-content:space-between; }
.stepcard .bodypanel.more { border:none; padding:2px 0 4px; }
.stepcard .bodypanel.more p { margin:0 0 6px; }
.stepcard .stepsrc { font-size:var(--fs-xs); color:var(--soft); }
.railcards { display:grid; gap:var(--gap); margin-bottom:var(--stack); }
.railcard { display:grid; grid-template-columns:72px minmax(0, 1fr); align-items:center; gap:8px; padding:14px 12px 12px 16px; margin:0; }
.railcard[data-tint] { background:linear-gradient(120deg, var(--tintc) 0, color-mix(in srgb, var(--tintc) 55%, var(--card)) 60%, var(--card) 100%); }
.railtitle { margin:0; font-family:'Fraunces Variable','Fraunces',serif; font-weight:560; font-size:21px; color:var(--ink); align-self:start; padding-top:4px; }
.railcard .steprail .stepdot { background:var(--card); }
.railcard .steprail .step.done .stepdot { background:var(--primary); }
.insightcard > .section-lab { margin:0 0 10px; }
.insightcard .card.insight { margin:0; padding:0; border:none; box-shadow:none; background:none; }
.insightcard .card.insight .num { font-size:30px; }
.insightcard .insightnote { margin:12px 0 0; padding-top:10px; border-top:1px solid var(--edge); font-size:var(--fs-xs); line-height:1.45; color:var(--soft); }
.insightcard .emptynote { padding:0; }
.homepatterns .hpmore { min-height:44px; font-size:var(--fs-sm); text-decoration:none; }
.hpswitch { margin:0 0 12px; }
.hpfig { position:relative; margin:0; }
.hpplot { position:relative; }
.hpspark { display:block; width:100%; height:76px; overflow:visible; }
.hpline { stroke-dasharray:1200; animation:cy-draw 1100ms var(--ease-std) both; }
@keyframes cy-draw { from { stroke-dashoffset:1200; } to { stroke-dashoffset:0; } }
.hpdot { position:absolute; width:12px; height:12px; border-radius:50%; background:var(--soft-3); box-shadow:0 0 0 3px var(--card), 0 0 0 6px color-mix(in srgb, var(--soft-2) 30%, transparent); transform:translate(-50%, -50%); }
.hpends { display:flex; justify-content:space-between; margin-top:4px; font-size:var(--fs-xs); color:var(--soft); }
.v2card .hpsentence { margin:10px 0 4px; font-family:'Fraunces Variable','Fraunces',serif; font-weight:480; font-size:18px; line-height:1.35; color:var(--ink); }
.v2card .hplegend { margin:0; display:flex; align-items:center; gap:6px; font-size:var(--fs-xs); color:var(--soft); }
.hpkey { flex:none; width:16px; height:3px; border-radius:2px; background:linear-gradient(90deg, var(--soft-1), var(--soft-3)); }
.hpkey.bar { width:8px; height:12px; border-radius:3px 3px 1px 1px; background:var(--soft-2); }
.hpbars { display:flex; align-items:stretch; gap:10px; height:112px; }
.hpbar { flex:1; min-width:0; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:6px; }
.hpbar i { display:block; width:100%; max-width:56px; border-radius:12px 12px 5px 5px; background:var(--soft-2); transform-origin:bottom; animation:cy-rise 600ms var(--ease-std) both; }
.hpbar i.s1 { background:var(--soft-1); } .hpbar i.s3 { background:var(--soft-3); }
.hpbar i.none { background:none; border:1.5px dashed var(--line); }
.hpbar span { font-size:var(--fs-xs); color:var(--soft); white-space:nowrap; }
@keyframes cy-rise { from { transform:scaleY(.15); opacity:.4; } }
.hplately { margin-top:14px; padding-top:12px; border-top:1px solid var(--edge); }
.hplab { display:block; font-size:var(--fs-xs); font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--soft); margin-bottom:8px; }
.hplately ul { list-style:none; margin:0; padding:0; display:flex; flex-wrap:wrap; gap:6px; }
.hplately li { display:inline-flex; align-items:center; gap:6px; padding:6px 11px; border-radius:var(--r-pill); background:color-mix(in srgb, var(--ink) 4%, var(--card)); box-shadow:inset 0 0 0 1px var(--edge); font-size:var(--fs-sm); font-weight:600; color:var(--ink); }
.hplately .fdot { width:8px; height:8px; }
.recapfelt { margin:8px 0 2px; font-family:'Fraunces Variable','Fraunces',serif; font-size:17px; line-height:1.35; color:var(--ink); }
.tilehint { margin:0 0 12px; }
.tilepick { display:grid; grid-template-columns:1fr 1fr; gap:var(--gap); }
.tilepick .mc.tileopt { margin:0; min-height:52px; display:flex; align-items:center; gap:10px; justify-content:flex-start; border-radius:var(--r-tile); font-weight:700; text-align:left; }
.tilepick .mc.tileopt[aria-disabled="true"] { opacity:.55; }
.tileopt-ico { flex:none; width:30px; height:30px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; background:var(--tintc, color-mix(in srgb, var(--primary) 13%, var(--card))); color:var(--primary-text); }
.tilepick .mc.tileopt.on .tileopt-ico { background:var(--card); }
.tilereset { display:flex; margin:14px auto 0; min-height:44px; font-size:var(--fs-md); }
.tiledone { margin-top:12px; }
@media (max-width:359px) { .homehero .greet { font-size:24px; } .herofig { height:212px; } .heroring { width:160px; } .heroring .ringmid b { font-size:34px; } .railcard { grid-template-columns:60px minmax(0, 1fr); padding-left:12px; } .railtitle { font-size:18px; } .homeqtiles .qtile-lab { font-size:11.5px; } }

/* ---- calm R4: Body → Logs (the fast log), its sheets, the calendar card and the cycles page ---- */
.bodylogs > .bodyhead { position:relative; padding:4px 0 6px; margin-bottom:6px; isolation:isolate; }
.bodyblob { position:absolute; z-index:-1; right:-18px; top:-14px; width:190px; height:116px; fill:color-mix(in srgb, var(--accent) 9%, transparent); animation:cy-drift 16s var(--ease-std) infinite alternate; pointer-events:none; }
.bodyeye { text-transform:uppercase; }
.bodyhead .disp { margin:2px 0 4px; }
.bodyhead .bodyphase { margin:0 0 4px; }
.checkhead { margin:22px 0 6px; font:600 21px/1.25 'Fraunces Variable','Fraunces',serif; color:var(--ink); }
.bodyacts { grid-template-columns:repeat(var(--qcols, 4), minmax(0, 1fr)); margin:8px 0 var(--stack); }
.bodyacts .qtile { min-height:80px; }
.logcard { padding:14px 14px 8px; background:linear-gradient(180deg, color-mix(in srgb, var(--tintc, var(--tint-body)) 85%, var(--card)) 0, var(--card) 132px); }
.logcard-head { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.logcard-head .ibadge { background:var(--card); }
.logcard-head .v2card-title { margin:0; }
.daystrip { display:grid; grid-template-columns:repeat(7, minmax(44px, 1fr)); gap:4px; margin:0 0 6px; overflow-x:auto; scrollbar-width:none; padding:2px; }
.daystrip::-webkit-scrollbar { display:none; }
.dayb { min-height:56px; min-width:44px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; border:1px solid transparent; background:color-mix(in srgb, var(--card) 70%, transparent); border-radius:14px; cursor:pointer; color:var(--ink); padding:4px 0; transition:transform var(--t-fast) var(--ease-std), background-color var(--t-fast); }
.dayb:active { transform:scale(.95); }
.dayb-wd { font:700 10.5px 'Karla Variable','Karla',sans-serif; letter-spacing:.06em; color:var(--soft); text-transform:uppercase; }
.dayb-dn { font:600 16px/1 'Fraunces Variable','Fraunces',serif; }
.dayb-dot { width:5px; height:5px; border-radius:50%; background:transparent; }
.dayb-dot.on { background:var(--primary); }
.dayb.today { border-color:color-mix(in srgb, var(--primary) 45%, var(--edge)); }
.dayb.sel { background:var(--primary); border-color:var(--primary); color:var(--on-primary); box-shadow:var(--sh-lift); }
.dayb.sel .dayb-wd { color:var(--on-primary); } .dayb.sel .dayb-dot.on { background:var(--on-primary); }
.logrows { list-style:none; margin:0; padding:0; }
.logrow-li + .logrow-li { border-top:1px solid var(--edge); }
.logrow { width:100%; min-height:56px; display:grid; grid-template-columns:34px minmax(0, 1fr) auto; align-items:center; gap:12px; padding:8px 2px; background:none; border:none; text-align:left; cursor:pointer; color:var(--ink); font:inherit; border-radius:12px; }
.logrow:active { background:color-mix(in srgb, var(--primary) 6%, transparent); }
.logrow-txt { display:flex; flex-direction:column; gap:1px; min-width:0; }
.logrow-txt b { font-size:var(--fs-md); font-weight:700; }
.logrow-val { font-size:var(--fs-sm); color:var(--soft); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.logrow-li.is-logged .logrow-val { color:var(--ink); }
.logrow-li:not(.is-logged) .logrow { min-height:50px; padding:5px 2px; } .logrow-li:not(.is-logged) .logrow-val:empty, .logrow-li:not(.is-logged) .logrow-val.none { display:none; }
.logrow-add { display:inline-flex; align-items:center; gap:3px; font:700 12px 'Karla Variable','Karla',sans-serif; color:var(--primary-text); padding:5px 10px; border-radius:var(--r-pill); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--primary) 35%, var(--edge)); }
.medquick { display:flex; flex-wrap:wrap; gap:6px; padding:0 0 10px 46px; }
.medtake { display:inline-flex; align-items:center; gap:8px; min-height:44px; padding:6px 14px 6px 8px; border-radius:var(--r-pill); border:1px solid var(--line); background:var(--card); color:var(--ink); font:600 var(--fs-sm) 'Karla Variable','Karla',sans-serif; cursor:pointer; transition:transform var(--t-fast) var(--ease-std), background-color var(--t-fast); }
.medtake:active { transform:scale(.96); }
.medtake-tick { width:22px; height:22px; flex:none; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; box-shadow:inset 0 0 0 1.5px var(--line); }
.medtake.on { background:color-mix(in srgb, var(--primary) 12%, var(--card)); border-color:var(--primary); }
.medtake.on .medtake-tick { background:var(--primary); color:var(--on-primary); box-shadow:none; animation:cy-pop 160ms var(--ease-std); }
.medtake-name { overflow-wrap:anywhere; text-align:left; }
.addweight { margin:2px 0 6px; font-size:var(--fs-sm); }
.sleephrs { margin:6px 0 0; font-size:var(--fs-sm); }
.bsheet-sub { margin:0 0 12px; color:var(--soft); font-size:var(--fs-md); line-height:1.45; }
.bsheet .lab { margin:14px 0 6px; }
.bigval { text-align:center; margin:2px 0 10px; }
.bigval .serif { font-size:44px; line-height:1; color:var(--primary-text); }
.hourchips, .typechips, .minchips, .pchips { display:flex; flex-wrap:wrap; gap:8px; }
.hourchips .mc { flex:1 1 0; min-width:52px; }
.bsheet .mc.on:not(.seg .mc) { background:var(--primary); border-color:var(--primary); color:var(--on-primary); }
.minchips .minchip { flex:1 1 0; min-width:54px; min-height:52px; font:700 16px 'Karla Variable','Karla',sans-serif; border-radius:16px; background:color-mix(in srgb, var(--tint-body) 70%, var(--card)); }
.minchip small { font-size:11px; font-weight:600; color:var(--soft); }
.stepper { display:flex; align-items:center; justify-content:center; gap:14px; margin:12px 0 0; }
.stepper .sbtn { min-width:52px; font-size:22px; }
.stepper .hint { margin:0; }
.customrow { display:flex; gap:8px; align-items:stretch; margin-top:10px; }
.customrow .inp { flex:1 1 auto; min-width:0; margin:0; }
.customrow .sbtn { flex:none; padding:0 18px; }
.customrow .unitseg { flex:0 0 auto; width:auto; }
.unitseg .mc { padding:7px 12px; flex:0 0 auto; }
.fielderr { margin:6px 0 0; color:var(--bad); font-size:var(--fs-sm); font-weight:600; }
.sesslist { list-style:none; margin:14px 0 0; padding:0; }
.sesslist li { display:flex; align-items:center; gap:10px; min-height:44px; border-top:1px solid var(--edge); font-size:var(--fs-md); color:var(--ink); }
.sesslist li > span { flex:1; min-width:0; }
.sesslist li svg { color:var(--primary-text); flex:none; }
.sesslist .linkbtn { font-size:var(--fs-sm); }
.medtakes { display:flex; flex-direction:column; gap:8px; }
.medtake-row { display:flex; align-items:center; gap:8px; }
.medtake-row .medtake { flex:1; border-radius:16px; min-height:52px; }
.medadd { margin-top:12px; } .medadd .inp { margin:0 0 8px; } .medadd .seg { margin-bottom:8px; }
.bsheet-foot { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:18px; }
.bsheet-foot .cta { flex:1; margin:0; }
.pgroup + .pgroup { margin-top:4px; }
.pchip { display:inline-flex; align-items:center; gap:6px; }
.pgroup .morewrap { margin-top:8px; }
.labbox { margin-top:16px; padding:12px 14px 14px; border-radius:var(--r-inner); background:color-mix(in srgb, var(--tint-patterns) 70%, var(--card)); box-shadow:inset 0 0 0 1px var(--edge); }
.labbox .lab:first-child { margin-top:0; }
.labkinds .mc { font-size:11.5px; }
.labnote { margin:10px 0 0; }
.srcline { font-size:var(--fs-xs); color:var(--soft); }
/* Calendar (R4): the month in a v2 card, symptom markers under the day number. */
.calcard { padding:12px 12px 10px; }
.calcard .calgrid { margin-bottom:10px; } .calcard .gradlegend { margin-bottom:0; } .calcard .daycard { box-shadow:none; }
.c-symdot { position:absolute; top:4px; right:4px; width:6px; height:6px; border-radius:50%; background:var(--fc); box-shadow:0 0 0 1.5px var(--card); }
.callegend .d-sym { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:4px; background:var(--soft-3); vertical-align:0; }
.calpred { display:flex; gap:12px; align-items:flex-start; }
.calpred .num { flex:none; }
.pcoslong { margin:0 0 var(--stack); }
.pcoslong .bigcount { font:600 34px/1 'Fraunces Variable','Fraunces',serif; color:var(--primary-text); margin-right:8px; }
.pcoslong p { margin:6px 0 0; }
@media (max-width:359px) { .bodyacts .qtile-lab { font-size:11px; } .dayb-dn { font-size:14px; } .medquick { padding-left:0; } }

/* ---- calm R5: Mind (Today check-in, Practices, Journey, the practice sheet, the breathing orb, the Pro sheet) ----
   Colours from tokens only; mood cells use the data-viz soft ramp (--soft-1..4), never the UI palette. All motion is
   transform/opacity, and off (or opacity only) under reduced motion. */
.mindtoday, .practicespage, .journey { padding-bottom:8px; }
.mindhead { position:relative; isolation:isolate; padding:4px 0 6px; margin-bottom:8px; }
.mindhead .disp { margin:2px 0 4px; } .mindhead .hint { margin:0; }
.mindblob { position:absolute; z-index:-1; right:-12px; top:-18px; width:200px; height:124px; fill:color-mix(in srgb, var(--primary) 9%, transparent); animation:cy-drift 17s var(--ease-std) infinite alternate; pointer-events:none; }
.journey .mindblob { fill:color-mix(in srgb, var(--accent) 9%, transparent); }
.flipx { transform:scaleX(-1); }
.subback { min-height:44px; gap:6px; text-decoration:none; font-size:var(--fs-sm); margin:0 0 2px; }
/* the check-in */
.checkcard .v2card-head { margin-bottom:14px; }
.moodrow { display:grid; grid-template-columns:repeat(5, minmax(0, 1fr)); gap:6px; margin:0 0 14px; }
.moodbtn { display:flex; flex-direction:column; align-items:center; gap:6px; min-height:76px; padding:9px 2px 8px; border-radius:var(--r-tile); border:1px solid var(--edge); background:var(--card); color:var(--soft); cursor:pointer; font:inherit; transition:transform var(--t-fast) var(--ease-std), background-color var(--t-fast), border-color var(--t-fast); }
.moodbtn:active { transform:scale(.95); }
.moodbtn .moodface { color:var(--soft); }
.moodface-bg { fill:color-mix(in srgb, var(--primary) 7%, var(--card)); }
.moodbtn.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 12%, var(--card)); color:var(--primary-text); box-shadow:0 6px 14px -10px var(--primary); }
.moodbtn.on .moodface { color:var(--primary-text); } .moodbtn.on .moodface-bg { fill:var(--card); }
.moodlab { font:700 11.5px/1.15 'Karla Variable','Karla',sans-serif; text-align:center; color:inherit; }
.moodbtn:not(.on) .moodlab { color:var(--soft); }
.mindlab { margin:0 0 8px; font:700 13px 'Karla Variable','Karla',sans-serif; color:var(--ink); display:flex; align-items:center; gap:6px; }
.mindlab span { font-weight:500; color:var(--soft); }
.feelchips { display:flex; flex-wrap:wrap; gap:7px; margin:0 0 14px; }
.feelchip { min-height:44px; transition:transform var(--t-fast) var(--ease-std), background-color var(--t-fast); } .feelchip:active { transform:scale(.95); }
.levels { display:grid; gap:12px; }
.levelrow .mindlab { color:var(--ink); } .levelrow .mindlab svg { color:var(--primary-text); }
/* your next practice */
.nextbody { display:flex; align-items:center; gap:14px; }
.nextorb { flex:none; }
.nexttext { min-width:0; }
.nextwhy { margin:0 0 4px; font:600 14.5px/1.35 'Karla Variable','Karla',sans-serif; color:var(--ink); }
.nextshort { margin:0; font-size:var(--fs-sm); color:var(--soft); line-height:1.4; }
.nexttags { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0 0; }
.nextmin { display:inline-block; padding:2px 9px; border-radius:var(--r-pill); background:var(--tint-mind); color:var(--primary-text); font-weight:700; font-size:11.5px; }
.nextacts { display:flex; align-items:center; gap:14px; margin-top:14px; }
.nextacts .cta { flex:1; }
.nextmore { min-height:44px; flex:none; font-size:var(--fs-sm); }
.nextline { margin:10px 0 0; font-size:12px; color:var(--soft); }
.cta.nextgo, .cta.psh-go, .cta.bhero-go { display:inline-flex; align-items:center; justify-content:center; gap:8px; }
/* which one helped */
.helpedlist { list-style:none; margin:0 0 6px; padding:0; }
.helpedrow { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; padding:8px 0; border-top:1px solid var(--edge); }
.helpedrow:first-child { border-top:none; padding-top:0; }
.helpedname { font:600 14.5px 'Karla Variable','Karla',sans-serif; color:var(--ink); }
.helpedbtns { display:flex; gap:6px; } .helpedbtns .mc { min-height:44px; }
/* the breathing orb */
.orb { position:relative; width:var(--orb); height:var(--orb); max-width:100%; margin:0 auto; }
.orb-svg { display:block; width:100%; height:100%; overflow:visible; }
.orb-halo { fill:color-mix(in srgb, var(--primary) 6%, transparent); }
.orb-blob-a { fill:color-mix(in srgb, var(--accent) 15%, transparent); }
.orb-blob-b { fill:color-mix(in srgb, var(--primary) 15%, transparent); }
.orb-drift { transform-box:view-box; transform-origin:50% 50%; animation:cy-orb-turn 40s linear infinite; }
.orb-drift-b { animation-duration:56s; animation-direction:reverse; }
.orb-still .orb-drift { animation:none; }
.orb-core { transform-box:view-box; transform-origin:50% 50%; transform:scale(.64); opacity:.82; transition:transform var(--orb-t) cubic-bezier(.45,.05,.55,.95), opacity var(--orb-t) ease-in-out; }
.orb-big .orb-core { transform:scale(1); opacity:1; }
.orb-idle .orb-core, .orb-step .orb-core { transform:scale(.8); opacity:.95; animation:cy-orb-rest 7s ease-in-out infinite alternate; }
.orb-still .orb-core { animation:none; }
.orb-stop-a { stop-color:color-mix(in srgb, var(--primary) 16%, var(--card)); }
.orb-stop-b { stop-color:color-mix(in srgb, var(--accent) 30%, var(--card)); }
.orb-stop-c { stop-color:color-mix(in srgb, var(--primary) 42%, var(--card)); }
.orb-shine { fill:var(--card); opacity:.4; }
.cy[data-scheme="dark"] .orb-stop-a { stop-color:color-mix(in srgb, var(--primary) 34%, var(--card)); }
.cy[data-scheme="dark"] .orb-stop-b { stop-color:color-mix(in srgb, var(--accent) 48%, var(--card)); }
.cy[data-scheme="dark"] .orb-stop-c { stop-color:color-mix(in srgb, var(--primary) 66%, var(--card)); }
.cy[data-scheme="dark"] .orb-shine { fill:var(--ink); opacity:.16; }
.cy[data-scheme="dark"] .orb-blob-a { fill:color-mix(in srgb, var(--accent) 20%, transparent); }
.cy[data-scheme="dark"] .orb-blob-b { fill:color-mix(in srgb, var(--primary) 20%, transparent); }
.orb-dots circle { fill:color-mix(in srgb, var(--ink) 14%, transparent); }
.orb-dots circle.on { fill:var(--primary); }
.orb-mid { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; pointer-events:none; }
.orb-word { font-size:23px; font-weight:560; color:var(--ink); line-height:1.1; }
.orb-count { margin-top:6px; font:700 15px 'Karla Variable','Karla',sans-serif; color:var(--primary-text); font-variant-numeric:tabular-nums; }
.orb-paused { margin-top:6px; font:700 12px 'Karla Variable','Karla',sans-serif; letter-spacing:.12em; text-transform:uppercase; color:var(--soft); }
@keyframes cy-orb-turn { to { transform:rotate(360deg); } }
@keyframes cy-orb-rest { from { transform:scale(.78); } to { transform:scale(.84); } }
@media (prefers-reduced-motion: reduce) {
  .orb-core, .orb-big .orb-core, .orb-idle .orb-core, .orb-step .orb-core { transform:scale(.86) !important; }
  .orb-core { opacity:.55; } .orb-big .orb-core, .orb-idle .orb-core, .orb-step .orb-core { opacity:1; }
  .moodbtn:active, .feelchip:active { transform:none; }
}
/* the practice sheet */
.practicesheet .psh-eye { margin:-4px 0 6px; }
.psh-stage { display:flex; justify-content:center; padding:4px 0 8px; }
.psh-stage .orb { --orb:min(248px, 70vw) !important; }
.psh-step { margin:4px auto 6px; max-width:330px; min-height:3.9em; text-align:center; font-size:18px; line-height:1.35; color:var(--ink); }
.psh-step.idle { font-family:'Karla Variable','Karla',sans-serif; font-size:var(--fs-md); color:var(--soft); min-height:0; }
.psh-timer { margin:0 0 12px; text-align:center; font:700 14px 'Karla Variable','Karla',sans-serif; color:var(--soft); font-variant-numeric:tabular-nums; letter-spacing:.04em; }
.psh-ctrls { display:flex; gap:10px; align-items:stretch; }
.psh-ctrls .cta { flex:2; margin:0; min-height:50px; }
.psh-ctrls .psh-stop { flex:1; margin:0; display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:50px; }
.psh-done { text-align:center; }
.psh-help { margin:0 0 10px; font-size:19px; font-weight:560; color:var(--ink); }
.psh-helpbtns { display:flex; gap:8px; justify-content:center; } .psh-helpbtns .mc { min-height:44px; }
.psh-helpnote { margin:8px 0 0; }
.psh-again { margin-top:10px; }
.psh-caution { display:flex; gap:8px; align-items:flex-start; margin:12px 0 0; padding:10px 12px; border-radius:var(--r-inner); background:color-mix(in srgb, var(--accent) 8%, var(--card)); font-size:var(--fs-sm); color:var(--ink); line-height:1.4; }
.psh-caution svg { flex:none; margin-top:2px; color:var(--accent-text); }
.psh-tools { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0 0; }
.psh-tool { display:inline-flex; align-items:center; gap:6px; min-height:44px; padding:0 14px; border-radius:var(--r-pill); border:1px solid var(--line); background:var(--card); color:var(--ink); font:600 13px 'Karla Variable','Karla',sans-serif; cursor:pointer; }
.psh-tool.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 12%, var(--card)); color:var(--primary-text); }
.psh-tool.on svg { fill:currentColor; }
.psh-ev { margin-top:14px; padding:14px; border-radius:var(--r-inner); background:var(--tint-mind); }
.psh-evhead { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-bottom:6px; }
.psh-evtitle { margin:0; font:600 15px 'Fraunces Variable','Fraunces',serif; color:var(--ink); }
.psh-strength { font:700 11px 'Karla Variable','Karla',sans-serif; letter-spacing:.06em; text-transform:uppercase; padding:3px 9px; border-radius:var(--r-pill); background:var(--card); color:var(--primary-text); }
.psh-strength.s-comfort { color:var(--soft); }
.psh-evtext { margin:0 0 8px; font-size:var(--fs-sm); line-height:1.5; color:var(--ink); }
.psh-srcs { margin:0 0 8px; padding-left:18px; font-size:12px; line-height:1.45; color:var(--soft); } .psh-srcs li { margin-bottom:4px; } .psh-srcs b { color:var(--ink); font-weight:600; }
.psh-line { margin:0; font:700 12.5px 'Karla Variable','Karla',sans-serif; color:var(--primary-text); }
/* the practices library */
.breathhero .bhero { display:flex; align-items:center; gap:12px; }
.breathhero .orb { flex:none; }
.bhero-txt { min-width:0; } .bhero-txt p { margin:0 0 10px; font-size:var(--fs-sm); color:var(--soft); line-height:1.4; }
.needcard .v2card-head { margin-bottom:6px; }
.prows { list-style:none; margin:0; padding:0; }
.prows li + li .prow-btn { border-top:1px solid var(--edge); }
.prow-btn { width:100%; display:flex; align-items:center; gap:12px; min-height:62px; padding:9px 2px; border:0; background:none; color:var(--ink); text-align:left; font:inherit; cursor:pointer; border-radius:var(--r-inner); transition:background-color var(--t-fast); }
.prow-btn:hover { background:color-mix(in srgb, var(--primary) 5%, transparent); }
.prow-txt { flex:1; min-width:0; } .prow-txt b { display:block; font:600 15px 'Karla Variable','Karla',sans-serif; }
.prow-sub { display:block; margin-top:2px; font-size:12.5px; color:var(--soft); }
.prow-go { flex:none; color:var(--primary-text); }
.prowhy { margin:4px 2px 8px; }
.practfoot { margin:6px 2px 0; }
/* journey */
.moodsent { margin:0 0 10px; font-size:var(--fs-sm); color:var(--ink); }
.moodcard .emptynote { margin-bottom:10px; }
.moodrows { display:grid; gap:12px; }
.moodrow-lab { margin:0 0 5px; font-size:12.5px; color:var(--soft); } .moodrow-lab b { color:var(--ink); font-weight:700; margin-right:4px; }
.moodcells { display:grid; grid-template-columns:repeat(var(--n), minmax(0, 1fr)); gap:2px; height:30px; }
.mcell { display:block; border-radius:3px; background:color-mix(in srgb, var(--ink) 7%, var(--card)); }
.mcell.m1 { background:var(--soft-4); } .mcell.m2 { background:var(--soft-3); } .mcell.m3 { background:var(--soft-2); }
.mcell.m4 { background:var(--soft-1); } .mcell.m5 { background:color-mix(in srgb, var(--soft-1) 55%, var(--card)); }
.moodticks { position:relative; height:14px; margin:3px 0 0; font-size:10.5px; color:var(--soft); }
.moodticks span { position:absolute; left:calc(var(--at) * 100%); }
.moodkey { display:flex; flex-wrap:wrap; gap:4px 12px; margin:12px 0 0; font-size:11.5px; color:var(--soft); }
.moodkey span { display:inline-flex; align-items:center; gap:5px; } .moodkey .mcell { width:12px; height:12px; }
.journalcard .jwrite { min-height:44px; min-width:44px; justify-content:center; padding:0 4px; font-size:var(--fs-sm); }
.jform .jacts { display:flex; gap:8px; } .jform .jacts .cta, .jform .jacts .ghostbtn { flex:1; margin:0; }
.jlist { list-style:none; margin:0; padding:0; }
.jlist .jentry { padding:8px 0; border-top:1px solid var(--edge); } .jlist .jentry:first-child { border-top:none; padding-top:2px; }
.jlist .jentry b { font-size:12.5px; color:var(--primary-text); } .jlist .jentry p { margin:3px 0 0; font-size:var(--fs-sm); white-space:pre-wrap; color:var(--ink); }
.connopen { display:inline-flex; align-items:center; justify-content:center; gap:8px; margin-top:4px; }
.askpart { margin-top:calc(var(--stack) + 6px); padding-top:4px; }
.journeyh { display:flex; align-items:center; gap:10px; margin:0 0 6px; font:560 20px 'Fraunces Variable','Fraunces',serif; color:var(--ink); }
/* the Pro sheet */
.prolist { list-style:none; margin:0 0 12px; padding:0; }
.prolist li { display:flex; gap:12px; align-items:flex-start; padding:9px 0; border-top:1px solid var(--edge); } .prolist li:first-child { border-top:none; }
.prolist-ico { flex:none; width:34px; height:34px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; background:var(--tint-mind); color:var(--primary-text); }
.prolist b { display:block; font:600 14.5px 'Karla Variable','Karla',sans-serif; color:var(--ink); }
.prolist-d { display:block; font-size:var(--fs-sm); color:var(--soft); margin-top:2px; }
.profree { margin:0 0 6px; font-size:var(--fs-sm); color:var(--ink); }
.pronote { margin:0 0 12px; }
@media (max-width:359px) { .moodlab { font-size:10.5px; } .nextbody { gap:10px; } .breathhero .orb { --orb:100px !important; } }

/* ---- calm R6: Patterns — cycle timeline, Body and Mind rings, pattern cards, weekly review, Share ---- */
.patternspage > .pathead { position:relative; isolation:isolate; padding:4px 0 8px; margin-bottom:6px; }
.patblob { position:absolute; z-index:-1; right:-14px; top:-20px; width:210px; height:126px; fill:color-mix(in srgb, var(--accent) 10%, transparent); animation:cy-drift 18s var(--ease-std) infinite alternate; pointer-events:none; }
.pathead .disp { margin:2px 0 10px; }
.patacts { display:flex; gap:8px; }
.patact { display:inline-flex; align-items:center; gap:7px; min-height:44px; padding:0 16px; border-radius:var(--r-pill); border:1px solid var(--edge); background:var(--card); color:var(--ink); box-shadow:var(--sh-card); font:700 14px 'Karla Variable','Karla',sans-serif; cursor:pointer; transition:transform var(--t-fast) var(--ease-std); }
.patact svg { color:var(--primary-text); } .patact:active { transform:scale(.97); }
.tl { margin-top:12px; }
.tlrows { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:12px; }
.tlhead { display:flex; justify-content:space-between; align-items:baseline; font-size:var(--fs-xs); color:var(--soft); margin-bottom:5px; }
.tldate { font-weight:700; color:var(--ink); letter-spacing:.02em; }
.tlrow.now .tldate { color:var(--primary-text); text-transform:uppercase; letter-spacing:.12em; }
.tllen b { font-family:'Fraunces Variable','Fraunces',serif; font-size:17px; font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; }
.tltrack { position:relative; height:14px; border-radius:var(--r-pill); background:color-mix(in srgb, var(--ink) 5%, var(--card)); }
.tlbar { position:absolute; left:0; top:0; bottom:0; border-radius:var(--r-pill); background:linear-gradient(90deg, var(--soft-1), color-mix(in srgb, var(--soft-2) 70%, var(--soft-1))); overflow:hidden; transform-origin:left; animation:cy-grow 700ms var(--ease-std) both; }
.tlrow:nth-child(2) .tlbar { animation-delay:60ms; } .tlrow:nth-child(3) .tlbar { animation-delay:120ms; } .tlrow:nth-child(n+4) .tlbar { animation-delay:180ms; }
.tlper { position:absolute; left:0; top:0; bottom:0; background:var(--soft-4); border-radius:var(--r-pill) 0 0 var(--r-pill); }
.tlfert { position:absolute; top:3px; bottom:3px; border-radius:var(--r-pill); background:color-mix(in srgb, var(--card) 55%, transparent); box-shadow:inset 0 0 0 1.5px var(--soft-3); }
.tlexp { position:absolute; left:0; top:0; bottom:0; border-radius:var(--r-pill); border:1.5px dashed var(--soft-2); }
.tlrow.now .tlbar { background:linear-gradient(90deg, var(--soft-2), var(--soft-3)); }
.tllabs { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
.tllab { font:700 11px 'Karla Variable','Karla',sans-serif; padding:3px 9px; border-radius:var(--r-pill); background:var(--tint-patterns); color:var(--ink); box-shadow:inset 0 0 0 1px var(--edge); }
.tlkey { display:flex; flex-wrap:wrap; gap:6px 14px; margin-top:14px; font-size:var(--fs-xs); color:var(--soft); }
.tlkey span { display:inline-flex; align-items:center; gap:6px; }
.tlkey i { display:inline-block; width:16px; height:8px; border-radius:var(--r-pill); }
.tlkey .k-per { background:var(--soft-4); } .tlkey .k-cyc { background:var(--soft-1); } .tlkey .k-fert { box-shadow:inset 0 0 0 1.5px var(--soft-3); background:var(--card); } .tlkey .k-exp { border:1.5px dashed var(--soft-2); }
.tlsent { margin:12px 0 0; font-family:'Fraunces Variable','Fraunces',serif; font-weight:480; font-size:17px; line-height:1.4; color:var(--ink); }
.ringscard .patrings { margin:14px 0 4px; align-items:center; }
.ringins { margin:0; padding-left:18px; font-size:var(--fs-sm); line-height:1.5; } .ringins li + li { margin-top:6px; }
.learn { margin:24px 0 var(--stack); }
.learnhead { margin:0 0 12px; }
.sechead { margin:0; font:560 22px/1.25 'Fraunces Variable','Fraunces',serif; color:var(--ink); }
.notadvice { margin:4px 0 0; font-size:var(--fs-sm); color:var(--soft); line-height:1.45; }
.patcard .v2card-title { font-size:17px; font-weight:520; line-height:1.35; }
.patcard .twobar, .patsheet .twobar { margin-top:14px; flex-direction:column; align-items:stretch; gap:10px; }
.patcard .twobar-diff, .patsheet .twobar-diff { flex-direction:row; align-items:baseline; gap:8px; min-width:0; }
.patcard .twobar-diff span, .patsheet .twobar-diff span { margin:0; font-size:var(--fs-sm); }
.patcard.st-notenough .v2card-title { color:var(--soft); }
.patbig { margin:12px 0 0; display:flex; align-items:baseline; gap:8px; color:var(--soft); font-size:var(--fs-sm); }
.patbig b { font-family:'Fraunces Variable','Fraunces',serif; font-size:28px; font-weight:600; color:var(--ink); }
.patfoot { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:12px; padding-top:10px; border-top:1px solid var(--edge); }
.patrecent { margin:0; font-size:var(--fs-xs); color:var(--soft); }
.patview { min-height:44px; flex-shrink:0; font-weight:700; }
.viewall { margin-top:2px; }
.daycard .pchart, .daycard .pchart-soon { margin:10px 0 0; border:none; box-shadow:none; padding:0; background:none; }
.pusual { fill:color-mix(in srgb, var(--soft-1) 22%, transparent); }
.patsheet .patq { margin:2px 0 8px; font:560 18px/1.35 'Fraunces Variable','Fraunces',serif; color:var(--ink); }
.patsheet-chip { margin-bottom:6px; }
.patsheet .patsent { margin:0 0 12px; font-size:var(--fs-md); line-height:1.5; }
.patlines { margin:14px 0 12px; padding-left:18px; font-size:var(--fs-sm); line-height:1.5; } .patlines li + li { margin-top:6px; }
.patsheet .advice { margin:0 0 10px; }
.patacts2 { margin-top:10px; }
.sharelist { list-style:none; margin:6px 0 0; padding:0; display:flex; flex-direction:column; gap:10px; }
.sharerow { width:100%; display:flex; align-items:center; gap:14px; text-align:left; min-height:64px; padding:12px 14px; border-radius:var(--r-inner); border:1px solid var(--edge); background:var(--card); color:var(--ink); cursor:pointer; font:inherit; }
.sharerow > svg { flex-shrink:0; color:var(--primary-text); }
.sharerow b { display:block; font-size:var(--fs-md); } .sharerow span span { display:block; font-size:var(--fs-sm); color:var(--soft); margin-top:2px; }
.wrclosed { display:flex; align-items:center; gap:12px; background:linear-gradient(135deg, var(--tint-patterns), var(--card) 70%); }
.wrclosed-txt { flex:1; min-width:0; } .wrclosed-txt .hint { margin:2px 0 0; }
.wropen { width:auto; margin:0; padding:0 16px; min-height:44px; border-radius:var(--r-pill); flex-shrink:0; }
.wrlead { margin:10px 0 8px; font-size:var(--fs-md); }
.wrcounts { list-style:none; display:flex; flex-wrap:wrap; gap:8px; margin:0; padding:0; }
.wrcounts li { padding:6px 12px; border-radius:var(--r-pill); background:var(--tint-patterns); font:700 13px 'Karla Variable','Karla',sans-serif; color:var(--ink); }
.wrh { margin:18px 0 6px; font:560 17px/1.3 'Fraunces Variable','Fraunces',serif; color:var(--ink); }
.wrnotes { margin:0; padding-left:18px; font-size:var(--fs-md); line-height:1.5; }
.wrlast p { margin:0 0 6px; font-size:var(--fs-sm); line-height:1.5; }
.wrexp { margin-top:18px; padding:14px; border-radius:var(--r-inner); background:linear-gradient(160deg, var(--tint-body), color-mix(in srgb, var(--tint-mind) 60%, var(--card))); }
.wrexp:focus { outline:none; } .wrexp:focus-visible { outline:2px solid var(--primary); outline-offset:2px; }
.wrexp-t { margin:2px 0 4px; font:600 19px/1.3 'Fraunces Variable','Fraunces',serif; color:var(--ink); }
.wrexp > p { margin:0 0 8px; font-size:var(--fs-md); line-height:1.5; }
.wracts { display:flex; gap:8px; margin-top:10px; }
.wracts .cta, .wracts .ghostbtn { flex:1; margin:0; min-height:48px; }
.wrpract { margin:8px 0 0; }
.wrcustom { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:12px; padding-top:10px; border-top:1px solid color-mix(in srgb, var(--ink) 10%, transparent); font-size:var(--fs-sm); color:var(--soft); }
.wrcustom .linkbtn { min-height:44px; }
.stepalt { margin:6px 0 0; } .stepalt .linkbtn { min-height:44px; }
@media (max-width:359px) { .patact { padding:0 12px; } .wracts { flex-direction:column; } .patfoot { flex-wrap:wrap; } }
/* ---- calm R7: You (switches, module rows, the page's cards) ---- */
.swt { display:inline-flex; align-items:center; gap:8px; flex-shrink:0; min-width:44px; min-height:44px; padding:0; border:none; background:none; cursor:pointer; color:var(--soft); font:700 12px 'Karla Variable','Karla'; }
.swt-word { min-width:22px; text-align:right; line-height:1; } .swt.on .swt-word { color:var(--primary-text); }
.swt-track { position:relative; display:block; width:52px; height:32px; border-radius:var(--r-pill); background:var(--line); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--ink) 8%, transparent); transition:background-color var(--t-fast) var(--ease-std); }
.swt-knob { position:absolute; top:3px; left:3px; width:26px; height:26px; border-radius:50%; background:var(--knob); box-shadow:0 0 0 1px var(--knob-edge); transition:left var(--t-fast) var(--ease-std), transform var(--t-fast) var(--ease-std); }
.swt.on .swt-track { background:var(--primary); } .swt.on .swt-knob { left:23px; }
.swt:active .swt-knob { transform:scale(.94); }
.modlist { list-style:none; margin:0; padding:0; }
.modrow { padding:12px 0; border-top:1px solid var(--edge); }
.modrow:first-child { border-top:none; padding-top:2px; }
.modrow-main { display:flex; align-items:center; gap:12px; }
.modinfo { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; } .modinfo b { font-size:15px; line-height:1.3; } .modinfo span { font-size:var(--fs-sm); color:var(--soft); line-height:1.4; }
.youpage .modadds { margin:8px 0 0 52px; font-size:var(--fs-sm); line-height:1.5; color:var(--ink); }
.modadds-lab { display:block; margin-bottom:2px; font:700 var(--fs-xs) 'Karla Variable','Karla'; letter-spacing:.08em; text-transform:uppercase; color:var(--primary-text); }
.youpage .modnote { margin:6px 0 0 52px; }
.modrow .plaincard, .modrow .morewrap { margin-left:0; margin-top:10px; }
.youpage .rfoot { font-size:12.5px; }
.youstage { overflow:hidden; }
.youart { position:absolute; right:-6px; top:-4px; width:190px; height:142px; z-index:0; pointer-events:none; }
.youart-blob { fill:color-mix(in srgb, var(--primary) 12%, transparent); }
.youart-ring { fill:none; stroke:color-mix(in srgb, var(--accent) 38%, transparent); stroke-width:1.5; stroke-dasharray:2 5; stroke-linecap:round; } .youart-ring.r2 { stroke:color-mix(in srgb, var(--primary) 34%, transparent); stroke-dasharray:none; }
.youart-arc { fill:none; stroke:var(--primary); stroke-width:3.5; stroke-linecap:round; opacity:.55; }
.youart-dot { fill:var(--accent); opacity:.8; }
.youfact { display:flex; align-items:center; gap:6px; margin:6px 0 0; font-size:var(--fs-sm); color:var(--soft); } .youfact svg { color:var(--accent-text); }
.youreminders { margin-top:14px; padding-top:12px; border-top:1px solid var(--edge); }
.youstage > .v2card-head, .youstage > p, .youstage > button { position:relative; z-index:1; } .youstage > .hint { max-width:78%; }
.youprivacy { border-color:color-mix(in srgb, var(--primary) 20%, var(--edge)); }
.youprivacy .youlead { margin:0 0 12px; }
.youplan p { margin:0 0 8px; }
.youplan .youfree { color:var(--soft); }
.youplan .youprobtn { margin-top:4px; }
.youset .setgroup, .youinstall .setgroup { border-top:none; padding:0; }
.youset .cadgrid { margin-bottom:0; }
.youai .consentopt { margin-bottom:8px; }
.youlegals { display:flex; flex-wrap:wrap; gap:4px 18px; margin:0 0 4px; }
.youpage .youlegal.linkbtn { display:inline-flex; align-items:center; gap:6px; min-height:44px; padding:0; }
.youbuild { text-align:center; margin-top:14px; }
.youaccount p { margin:0 0 6px; }
.youlegal-card p { margin:0 0 8px; }
.youpage .carepart { margin-top:6px; } .youpage .sbtn { min-height:44px; }
/* ---- calm R8: Pro, Cyra's write-up and chat, "What Cyra will send" ---- */
.youplanacts { display:flex; flex-wrap:wrap; align-items:center; gap:6px 16px; margin-top:4px; }
.youplanacts .youprobtn { margin:0; }
.yourestore.linkbtn { min-height:44px; padding:0; }
.youaipro { margin-top:16px; padding:14px; border-radius:var(--r-inner); background:linear-gradient(160deg, var(--tint-mind), color-mix(in srgb, var(--tint-patterns) 55%, var(--card))); }
.youaipro-lab { display:flex; align-items:center; gap:8px; margin:0 0 6px; }
.youaipro .modadds { margin:8px 0 0; font-size:var(--fs-sm); line-height:1.5; color:var(--ink); }
.youaipro .modrow { border-top-color:color-mix(in srgb, var(--ink) 10%, transparent); }
.youaipro .consentopt { margin:10px 0 4px; }
.youaipro.locked .ghostbtn { margin-top:6px; }
.aicard { position:relative; overflow:hidden; }
.aicard > *:not(.aiart) { position:relative; z-index:1; }
.aiart { position:absolute; right:-18px; bottom:-14px; width:150px; height:100px; z-index:0; pointer-events:none; opacity:.8; }
.aiart-blob { fill:color-mix(in srgb, var(--primary) 11%, transparent); }
.aiart-spark { fill:var(--accent); opacity:.55; }
.aiout { margin:2px 0 10px; } .aiout:focus { outline:none; } .aiout:focus-visible { outline:2px solid var(--primary); outline-offset:3px; border-radius:6px; }
.aitext { margin:0 0 10px; font-size:var(--fs-md); line-height:1.6; color:var(--ink); }
.aichips { margin:8px 0 4px; }
.aisent { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:var(--r-pill); background:color-mix(in srgb, var(--primary) 10%, var(--card)); color:var(--primary-text); font:700 var(--fs-xs)/1.4 'Karla Variable','Karla'; }
.ainote { margin:8px 0; padding:10px 12px; border-radius:var(--r-inner); background:color-mix(in srgb, var(--tint-patterns) 70%, var(--card)); font-size:var(--fs-sm); line-height:1.5; color:var(--ink); }
.aigo { margin-top:6px; }
.ailist { list-style:none; margin:10px 0 12px; padding:0; display:flex; flex-direction:column; gap:10px; max-height:420px; overflow-y:auto; }
.aiempty { font-size:var(--fs-sm); color:var(--soft); padding:6px 0; }
.aimsg { max-width:88%; padding:10px 13px; border-radius:16px; font-size:var(--fs-md); line-height:1.5; animation:cy-ai-in var(--t-base) var(--ease-std); }
.aimsg p { margin:0 0 6px; } .aimsg p:last-of-type { margin-bottom:0; }
.aimsg.me { align-self:flex-end; background:color-mix(in srgb, var(--primary) 13%, var(--card)); border-bottom-right-radius:6px; color:var(--ink); }
.aimsg.cyra { align-self:flex-start; background:var(--tint-mind); border-bottom-left-radius:6px; color:var(--ink); }
.aimsg.urgent { background:var(--bad-bg); color:var(--ink); box-shadow:inset 3px 0 0 var(--bad); }
.aimsg .aisent { margin-top:6px; }
.aiask { font-size:var(--fs-sm); color:var(--soft); }
.aiwait { color:var(--soft); }
.aiq { width:100%; resize:none; font-family:inherit; margin-bottom:8px; }
.aiclear.linkbtn { min-height:44px; padding:0 4px; }
@keyframes cy-ai-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
@media (prefers-reduced-motion: reduce) { .aimsg { animation:none; } }
.aisend-lead { display:flex; gap:8px; align-items:flex-start; margin:0 0 12px; font-size:var(--fs-sm); line-height:1.5; color:var(--ink); }
.aisend-lead svg { flex-shrink:0; margin-top:2px; color:var(--primary-text); }
.aisend-sec { margin:0 0 12px; }
.aisend-sec .section-lab { margin:0 0 6px; }
.aisend-plain { margin:0; display:flex; flex-direction:column; gap:6px; }
.aisend-row { display:grid; grid-template-columns:minmax(96px, 38%) 1fr; gap:8px; padding:6px 0; border-top:1px solid var(--edge); font-size:var(--fs-sm); line-height:1.45; }
.aisend-row:first-child { border-top:none; }
.aisend-row dt { color:var(--soft); font-weight:700; } .aisend-row dd { margin:0; color:var(--ink); overflow-wrap:anywhere; }
.aisend-q dd { font-weight:700; }
.aisend-json { margin:0; max-height:38vh; overflow:auto; padding:12px; border-radius:var(--r-inner); background:color-mix(in srgb, var(--ink) 5%, var(--card)); border:1px solid var(--edge); font:12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color:var(--ink); white-space:pre-wrap; overflow-wrap:anywhere; }
.aisend-json:focus-visible { outline:2px solid var(--primary); outline-offset:2px; }
.aisend-acts { display:flex; gap:8px; position:sticky; bottom:0; padding-top:8px; background:var(--card); }
.aisend-acts .cta, .aisend-acts .ghostbtn { flex:1; margin:0; min-height:48px; }
.proplanned-lab { margin:14px 0 4px; }
.proplanned { margin:0 0 12px; padding-left:18px; font-size:var(--fs-sm); line-height:1.6; color:var(--soft); }
/* ---------- calm R9: the optional account (You → Account, its sheets, the splash sign-in) ---------- */
.acctcard { position:relative; overflow:hidden; }
.acctart { position:absolute; right:-6px; top:8px; width:120px; height:60px; pointer-events:none; }
.acctart-blob { fill:var(--primary); opacity:.10; }
.acctart-arc { fill:none; stroke:var(--accent); stroke-width:3; stroke-linecap:round; opacity:.55; stroke-dasharray:90; stroke-dashoffset:90; animation:cy-acct-arc .9s var(--ease-std) .1s forwards; }
.acctart-dot { fill:var(--primary); opacity:.7; }
@keyframes cy-acct-arc { to { stroke-dashoffset:0; } }
.acctwho { margin:0 0 4px; position:relative; overflow-wrap:anywhere; }
.acctstatus { display:inline-flex; align-items:center; gap:6px; margin:0 0 8px !important; padding:4px 10px; border-radius:var(--r-pill); background:var(--tint-you); font-size:var(--fs-sm); color:var(--ink); }
.acctstatus::before { content:""; width:8px; height:8px; border-radius:50%; background:var(--good); }
.acctstatus.busy::before { background:var(--primary); animation:cy-fade 1.2s ease-in-out infinite alternate; }
.acctstatus.failed::before, .acctstatus.offline::before, .acctstatus.gone::before { background:var(--soft); }
.acctacts { display:flex; flex-wrap:wrap; align-items:center; gap:6px 16px; margin:6px 0 4px; }
.acctacts .ghostbtn, .acctacts .cta { margin:0; width:auto; flex:1 1 auto; min-width:150px; }
.acctacts .linkbtn, .linkbtn.acctdel { min-height:44px; padding:0; }
.linkbtn.danger { color:var(--bad); }
.acctpro { margin:0 !important; flex-basis:100%; }
.acctdelcard { margin:6px 0 8px; }
.cta.danger { background:var(--bad); color:var(--on-bad); }
.acctchoice { margin:8px 0; padding:14px; border-radius:var(--r-inner); border:1px solid var(--edge); background:linear-gradient(160deg, var(--tint-patterns), var(--card) 70%); animation:cy-fade .3s var(--ease-std); }
.acctchoice-h { display:flex; align-items:center; gap:8px; margin:0 0 4px !important; font:600 17px 'Fraunces Variable','Fraunces',serif; color:var(--ink); }
.acctchoice-h svg { color:var(--primary-text); }
.acctchoice-opts { display:grid; gap:8px; margin-top:10px; }
.acctopt { display:flex; flex-direction:column; align-items:flex-start; gap:2px; width:100%; min-height:56px; text-align:left; padding:11px 14px; border-radius:var(--r-inner); border:1px solid var(--line); background:var(--card); color:var(--ink); font:400 var(--fs-sm) 'Karla Variable','Karla',sans-serif; cursor:pointer; }
.acctopt b { font-size:var(--fs-md); }
.acctopt span { color:var(--soft); }
.acctopt:active { transform:scale(.98); }
.acctcancel { margin-top:6px; min-height:44px; }
.acctform { display:flex; flex-direction:column; gap:2px; }
.acctlead { margin:0 0 10px; }
.acctholds { margin:0 0 10px; padding:12px 14px; border-radius:var(--r-inner); background:var(--tint-mind); }
.acctholds .section-lab { margin:0 0 4px; }
.acctholds .rlist { margin:0; font-size:var(--fs-sm); line-height:1.55; }
.acctlost { display:flex; gap:8px; align-items:flex-start; margin:0 0 10px; padding:11px 13px; border-radius:var(--r-inner); border:1px solid var(--err-edge); background:var(--bad-bg); color:var(--ink); font-size:var(--fs-sm); line-height:1.5; }
.acctlost svg { flex:none; margin-top:2px; color:var(--bad); }
.acctform .consentopt { margin:8px 0 4px; }
.acctform .cta { margin-top:10px; }
.splashacct { margin-top:2px; }
`;
