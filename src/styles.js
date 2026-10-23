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
.cy { --fs-xs:11px; --fs-sm:12.5px; --fs-md:13.5px; --fs-lg:15.5px; --fs-num:23px; --fs-title:26px; --r-card:13px; --r-inner:11px; --r-pill:999px; --gap:8px; --stack:12px; --t-fast:100ms; --t-base:200ms; --t-slow:300ms; --ease-std:cubic-bezier(.2,0,0,1); --ease-in:cubic-bezier(.05,.7,.1,1); --ease-out:cubic-bezier(.3,0,.8,.15); --primary-text:color-mix(in srgb, var(--primary) 82%, var(--ink)); --accent-text:color-mix(in srgb, var(--accent) 82%, var(--ink)); ${tokenDecls(SCHEME_TOKENS.light)}; --sa-t:var(--safe-area-inset-top, env(safe-area-inset-top, 0px)); --sa-b:var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)); background:var(--paper); color:var(--ink); font-family:'Karla Variable','Karla',sans-serif; line-height:1.5; min-height:100dvh; max-width:430px; margin:0 auto; padding:18px 16px 48px; box-sizing:border-box; transition:background var(--t-slow); color-scheme:light; }
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
.topbtn { flex:1; border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:8px 1px; font:700 11px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
.topbtn.on { background:var(--primary); border-color:var(--primary); color:var(--on-primary); }
.stagebar { display:flex; gap:7px; margin-bottom:14px; }
.stagesel { flex:1; display:flex; flex-direction:column; gap:1px; align-items:flex-start; border:1px solid var(--line); background:var(--card); border-radius:12px; padding:9px 11px; cursor:pointer; font-family:'Karla Variable','Karla'; }
.stagesel b { font-size:13px; color:var(--ink); } .stagesel span { font-size:10.5px; color:var(--soft); }
.stagesel.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 8%, var(--card)); }
.stagesel.on b { color:var(--primary-text); }
/* ---- section bar (spec §5): the nav is the sticky, translucent wrap (.tabswrap); the strip inside scrolls sideways with
   proximity snapping and tells the wrap which edges it is against (data-start / data-end), which fade the overflow cue out.
   Sticky needs no overflow-clipping ancestor: .cy has none. html scroll-padding keeps anchored scrolls below the bar. ---- */
.tabswrap { position:sticky; top:0; z-index:4; margin:0 -16px 16px; padding:var(--sa-t) 16px 0; background:color-mix(in srgb, var(--paper) 86%, transparent); backdrop-filter:saturate(160%) blur(12px); -webkit-backdrop-filter:saturate(160%) blur(12px); }
.tabswrap::before, .tabswrap::after { content:''; position:absolute; top:0; bottom:2px; width:36px; pointer-events:none; transition:opacity var(--t-fast); }
.tabswrap::after { right:16px; background:linear-gradient(90deg, transparent, var(--paper)); }
.tabswrap::before { left:16px; background:linear-gradient(270deg, transparent, var(--paper)); opacity:0; }
.tabswrap[data-end="1"]::after { opacity:0; }
.tabswrap[data-start="1"]::before { opacity:1; }
html { scroll-padding-top:60px; }
.tabs { display:flex; gap:4px; border-bottom:2px solid var(--line); margin-bottom:0; padding-right:28px; overflow-x:auto; scroll-snap-type:x proximity; scrollbar-width:none; -webkit-overflow-scrolling:touch; }
.tabs::-webkit-scrollbar { display:none; }
.tab { flex-shrink:0; scroll-snap-align:start; }
.tab { background:none; border:none; border-bottom:3px solid transparent; padding:7px 8px 9px; font:700 13px 'Karla Variable','Karla'; color:var(--soft); cursor:pointer; transition:color var(--t-fast), border-color var(--t-fast); }
.tab-on { color:var(--primary-text); border-bottom-color:var(--primary); }
/* The screen under the bar is the tabpanel; it fades in on a tab change (keyed remount, so once per switch). */
.tabpanel { animation:cy-fade-rise var(--t-base) var(--ease-in); }
.disp { font-family:'Fraunces Variable','Fraunces',serif; font-weight:440; font-size:var(--fs-title); line-height:1.14; margin:0 0 8px; }
.hint { font-size:var(--fs-md); line-height:1.55; color:var(--soft); margin:0 0 16px; }
.chips { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-bottom:16px; }
.chip { border:1.5px solid var(--line); background:var(--card); box-shadow:var(--sh-card); border-radius:13px; padding:11px; text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:5px; font-size:13.5px; color:var(--ink); }
.dots { font-size:10.5px; letter-spacing:3px; color:var(--soft); }
/* Family colour on the data-bearing part only: a chip's dots take its symptom family's colour (--fc, FAMILIES) once it
   has a value, and pop 120ms on each change (keyed remount; none under reduced motion). Borders and backgrounds stay on the palette. */
.chip:not(.sev-0) .dots { color:var(--fc, var(--primary)); display:inline-block; }
.chip .dots[data-tick] { animation:cy-pop 120ms var(--ease-std); }
.chip.sev-1 { border-color:color-mix(in srgb, var(--accent) 60%, var(--line)); background:color-mix(in srgb, var(--accent) 7%, var(--card)); }
.chip.sev-2 { border-color:var(--accent); background:color-mix(in srgb, var(--accent) 16%, var(--card)); }
.chip.sev-3 { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 14%, var(--card)); font-weight:700; }
.row { display:flex; gap:var(--gap); margin-bottom:16px; }
.pill { flex:1; border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:9px 4px; font:500 13px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
.pill-on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 12%, var(--card)); color:var(--primary); font-weight:700; }
.cta { width:100%; border:none; border-radius:13px; background:var(--primary); color:var(--on-primary); font:700 14px 'Karla Variable','Karla'; padding:14px; cursor:pointer; }
.cta:disabled { opacity:.6; }
/* Patterns charts (components/PatternCharts.jsx): data colours come from FAMILIES in lib/constants.js, never the UI palette. */
.backbar { margin:4px 0 2px; } .backbar .linkbtn { font-size:14px; }
.pchart { background:var(--card); border:1.5px solid var(--line); border-radius:var(--r-card); box-shadow:var(--sh-card); padding:12px 12px 10px; margin-bottom:var(--gap); }
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
.card { background:var(--card); border:1.5px solid var(--line); box-shadow:var(--sh-card); border-radius:var(--r-card); padding:12px 16px; display:flex; gap:13px; align-items:baseline; margin-bottom:var(--gap); }
.num { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:var(--fs-num); color:var(--primary); min-width:56px; flex-shrink:0; white-space:nowrap; font-variant-numeric:tabular-nums; }
.card p { margin:0; font-size:var(--fs-md); line-height:1.5; }
.icard { margin-bottom:var(--gap); box-shadow:var(--sh-card); border-radius:var(--r-card); }
.icard .card { margin-bottom:0; box-shadow:none; border-radius:var(--r-card) var(--r-card) 0 0; }
.advice { display:flex; gap:9px; align-items:flex-start; background:color-mix(in srgb, var(--primary) 10%, var(--card)); border:1.5px solid var(--line); border-top:none; border-radius:0 0 13px 13px; padding:10px 15px; }
.advice-alone { border-top:1.5px solid var(--line); border-radius:13px; margin-top:10px; }
.uchip { flex-shrink:0; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; border-radius:999px; padding:3px 9px; }
.u-now { background:var(--bad-chip); color:var(--bad); } .u-visit { background:color-mix(in srgb, var(--primary) 16%, var(--card)); color:var(--primary-text); } .u-self { background:color-mix(in srgb, var(--good) 13%, var(--card)); color:var(--good); }
.atext { font-size:var(--fs-sm); line-height:1.5; }
.rep { background:var(--card); border:1.5px solid var(--line); box-shadow:var(--sh-card); border-radius:13px; padding:15px; margin-bottom:12px; }
.rtitle { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:17px; margin-bottom:10px; }
.rmeta { display:block; font-size:11.5px; font-weight:400; color:var(--soft); margin-top:2px; font-family:'Karla Variable','Karla'; }
.rtab { width:100%; border-collapse:collapse; font-size:12.5px; }
.rtab th { text-align:left; font-size:11px; color:var(--soft); padding:3px 0; }
.rtab td { padding:5px 0; border-top:1px solid var(--line); }
.rlist { margin:0; padding-left:17px; font-size:var(--fs-sm); line-height:1.6; } .rfoot { font-size:12px; color:var(--soft); margin:12px 0 0; line-height:1.5; }
.routes { display:flex; gap:8px; }
.route { flex:1; display:flex; flex-direction:column; gap:2px; border:1px solid var(--primary); background:var(--card); color:var(--primary); border-radius:12px; padding:11px 8px; font:700 12px 'Karla Variable','Karla'; cursor:pointer; }
.route span { font-weight:500; font-size:11.5px; color:var(--soft); }
.shelfc { background:var(--card); border:1.5px solid var(--line); box-shadow:var(--sh-card); border-radius:var(--r-card); padding:14px; margin-bottom:var(--gap); }
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
.loglines { background:var(--card); border:1.5px solid var(--line); border-radius:13px; padding:12px; font-family:ui-monospace,monospace; font-size:11px; line-height:1.7; }
.logline.money { color:var(--good); font-weight:700; } .logline.bad { color:var(--bad); font-weight:700; }
.swatches { display:flex; gap:6px; margin-top:8px; }
.swatch { width:22px; height:22px; border-radius:6px; border:1px solid var(--line); }
.phasecard { display:flex; gap:14px; align-items:center; background:var(--card); border:1.5px solid var(--line); box-shadow:var(--sh-card); border-radius:13px; padding:13px 15px; margin-bottom:14px; }
.phaseday { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:21px; color:var(--primary); white-space:nowrap; }
.phaseinfo { display:flex; flex-direction:column; gap:2px; font-size:13px; }
.phaseinfo span { color:var(--soft); font-size:12.5px; line-height:1.45; }
.readcard { background:color-mix(in srgb, var(--primary) 10%, var(--card)); border:1.5px solid color-mix(in srgb, var(--primary) 25%, var(--line)); border-radius:13px; padding:14px; margin-top:14px; }
/* Today's read sits directly under the phase card (as the pregnancy read does): tighter, hint clamped to two lines. */
.readcard.compact { padding:10px 14px; margin-top:0; }
.readcard.compact .hint { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.calgrid { display:grid; grid-template-columns:repeat(7,1fr); gap:5px; margin-bottom:10px; }
.calhead { text-align:center; font-size:11px; letter-spacing:.04em; font-weight:700; color:var(--soft); padding:2px 0; }
.calcell { position:relative; aspect-ratio:1; display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:600; border-radius:10px; background:var(--card); border:1.5px solid var(--line); color:var(--ink); cursor:pointer; }
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
.bodypanel.more .cyclist { list-style:none; margin:8px 0 0; padding:0; }
.bodypanel.more .cycrow { display:flex; align-items:center; flex-wrap:wrap; gap:4px var(--gap); margin:0; padding:6px 0; border-top:1px solid var(--line); }
.bodypanel.more .cycrow:first-child { border-top:none; }
.cycstart { min-width:46px; font-weight:700; font-variant-numeric:tabular-nums; }
.cyclen { min-width:56px; white-space:nowrap; font-variant-numeric:tabular-nums; }
.cycrow.now .cyclen { min-width:0; color:var(--soft); }
.cycbar { flex:1 1 40px; min-width:40px; height:6px; border-radius:3px; background:color-mix(in srgb, var(--primary) 10%, var(--card)); overflow:hidden; }
.cycbar i { display:block; height:100%; border-radius:3px; background:var(--primary); }
.cycrow.now .cycbar i { background:color-mix(in srgb, var(--primary) 45%, var(--card)); }
.cycrow.out .cycstart, .cycrow.out .cyclen { color:var(--soft); }
.cycrow.out .cycbar i { background:color-mix(in srgb, var(--soft) 45%, var(--card)); }
.cycuse { flex-shrink:0; }
.bodypanel.more .cycwhy { flex-basis:100%; margin:0 0 2px; font-size:var(--fs-sm); color:var(--soft); line-height:1.45; }
.statechip.flag { display:inline-block; margin-right:6px; padding:3px 9px; border-style:solid; border-color:color-mix(in srgb, var(--accent) 70%, var(--line)); color:var(--accent-text); }
.bodypanel.more .cycmore { margin:6px 0 0; color:var(--soft); }
.pregband { display:flex; gap:14px; align-items:center; background:var(--card); border:1.5px solid var(--line); box-shadow:var(--sh-card); border-radius:13px; padding:14px 15px; margin-bottom:8px; }
.pregweek { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:22px; color:var(--primary); white-space:nowrap; }
.pregmeta { display:flex; flex-direction:column; gap:2px; font-size:13px; }
.pregmeta span { color:var(--soft); font-size:12.5px; }
.pregbar { height:8px; background:color-mix(in srgb, var(--ink) 8%, var(--paper)); border-radius:4px; overflow:hidden; margin-bottom:14px; }
.pregfill { height:100%; background:linear-gradient(90deg,var(--accent),var(--primary)); }
.kickrow { display:flex; gap:10px; align-items:stretch; margin-bottom:12px; }
.kickcard .kickrow { margin-bottom:0; } .kickcard .section-lab { margin-top:0; }
.cta.cta-kick { background:color-mix(in srgb, var(--primary) 12%, var(--card)); color:var(--primary); border:1.5px solid var(--primary); }
.kickcount { display:flex; flex-direction:column; align-items:center; justify-content:center; background:var(--card); border:1px solid var(--line); border-radius:13px; padding:6px 16px; }
.kickcount b { font-family:'Fraunces Variable','Fraunces',serif; font-size:20px; color:var(--primary); } .kickcount span { font-size:10.5px; color:var(--soft); }
.inp { width:100%; border:1.5px solid var(--line); background:var(--card); border-radius:11px; padding:11px 13px; font:500 13.5px 'Karla Variable','Karla'; color:var(--ink); margin-bottom:9px; }
.splash { padding-top:46px; text-align:left; }
.splashmark { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:44px; }
.splashmark span { color:var(--primary); }
.splashtag { font-size:12px; font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:var(--primary); margin-top:2px; }
.ghostbtn { width:100%; border:1px solid var(--primary); background:none; color:var(--primary); border-radius:13px; font:700 14px 'Karla Variable','Karla'; padding:13px; margin-top:10px; cursor:pointer; }
.consentcard { background:var(--card); border:1.5px solid var(--line); border-radius:13px; padding:14px; font-size:13px; margin-bottom:12px; }
.consentopt { display:flex; gap:11px; width:100%; text-align:left; border:1.5px solid var(--line); background:var(--card); border-radius:13px; padding:13px; font:400 var(--fs-sm) 'Karla Variable','Karla'; color:var(--ink); line-height:1.5; cursor:pointer; }
.consentopt.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 7%, var(--card)); }
.ckbox { flex-shrink:0; width:22px; height:22px; border:2px solid var(--primary); border-radius:7px; display:flex; align-items:center; justify-content:center; font-weight:700; color:var(--primary); }
.acctchip { font-size:11px; font-weight:700; color:var(--ink); border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:6px 10px; margin-right:0; max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.stagechip { border:1.5px solid var(--line); background:var(--card); color:var(--primary-text); border-radius:999px; padding:6px 10px; font:700 11px 'Karla Variable','Karla'; cursor:pointer; }
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
.pchart .section-lab::before, .pots .section-lab::before, .palsheet .section-lab::before { display:none; }
.obwrap { padding-top:14px; }
.obq { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:20px; margin:6px 0 14px; }
.obopts { display:grid; gap:var(--gap); margin-bottom:18px; }
.obopt { border:1.5px solid var(--line); background:var(--card); box-shadow:var(--sh-opt); border-radius:13px; padding:14px; text-align:left; font:500 14.5px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
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
.disclosure { width:100%; display:flex; justify-content:space-between; align-items:center; border:1.5px solid var(--line); background:var(--card); border-radius:13px; padding:12px 16px; font:700 var(--fs-md) 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; margin:14px 0 0; }
.bodypanel { border:1.5px solid var(--line); border-top:none; border-radius:0 0 13px 13px; background:var(--card); padding:4px 16px 14px; }
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
.minichip { border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:9px 14px; font:500 12.5px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
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
.palsheet { background:var(--card); border:1.5px solid var(--line); border-radius:14px; padding:14px; margin-bottom:14px; box-shadow:var(--sh-sheet); }
.palopt { display:flex; align-items:center; gap:11px; width:100%; text-align:left; border:1.5px solid var(--line); background:var(--card); border-radius:12px; padding:10px 12px; margin-bottom:8px; cursor:pointer; }
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
.mc { border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:9px 15px; font:500 13px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
.mc.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 12%, var(--card)); color:var(--primary); font-weight:700; }
.err .mc, .err .stagecard { border-color:var(--err-line); }
/* ---- control states (spec §8.4): rest / pressed / hover (pointer only) / focus-visible / disabled. Pressed = a 100ms
   scale on transform plus the selected tint, so a tap answers before the state changes. ---- */
.cy button, .cy [role=button] { -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
.cta, .ghostbtn, .back, .stagecard, .disclosure, .route, .socialbtn, .obopt, .consentopt, .palopt { transition:transform var(--t-fast) var(--ease-std), background-color var(--t-fast), border-color var(--t-fast), color var(--t-fast); }
.cta:active, .ghostbtn:active, .back:active, .stagecard:active, .disclosure:active, .route:active, .socialbtn:active, .obopt:active, .consentopt:active, .palopt:active { transform:scale(.985); }
.cta:active { filter:brightness(.94); }
.mc, .chip, .pill, .takebtn, .tipclose, .sbtn, .minichip, .tab, .calcell, .scopy, .linkbtn { transition:transform var(--t-fast) var(--ease-std), background-color var(--t-fast), border-color var(--t-fast), color var(--t-fast); }
.mc:active, .chip:active, .pill:active, .takebtn:active, .tipclose:active, .sbtn:active, .minichip:active, .calcell:active { transform:scale(.96); background:color-mix(in srgb, var(--primary) 12%, var(--card)); border-color:var(--primary); }
@media (hover:hover) { .mc:hover, .chip:hover, .pill:hover, .disclosure:hover, .stagecard:hover, .takebtn:hover, .sbtn:hover, .route:hover, .obopt:hover { border-color:color-mix(in srgb, var(--primary) 55%, var(--line)); } }
/* Danger: the one destructive pill (Delete everything) is red-outlined and never takes the primary tint. */
.mc.danger { color:var(--bad); border-color:color-mix(in srgb, var(--bad) 40%, var(--line)); }
.mc.danger:active, .mc.danger.on { background:var(--bad-bg); border-color:var(--bad); color:var(--bad); }
/* Joined control: 2-5 mutually exclusive answers or views share one border (buttons keep .mc/.on and aria-pressed;
   standalone .mc pills stay for multi-select). Labels wrap to two lines rather than truncate. */
.seg { display:flex; flex-wrap:nowrap; width:100%; background:var(--card); border:1.5px solid var(--line); border-radius:var(--r-pill); padding:3px; gap:0; box-sizing:border-box; }
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
.editbar { position:sticky; top:60px; z-index:2; background:color-mix(in srgb, var(--accent) 16%, var(--card)); border-color:var(--accent); }
/* The day just saved pops once on the patterns card (set by the save handler only; cleared after 1.2 s). */
.dot-new { transform-box:fill-box; transform-origin:center; animation:cy-pop 600ms var(--ease-std); }
.inpErr { border-color:var(--bad) !important; background:var(--bad-bg) !important; }
.errhint { font-size:var(--fs-sm); color:var(--bad); line-height:1.5; margin:14px 0 0; background:var(--bad-bg); border:1.5px solid var(--err-edge); border-radius:var(--r-inner); padding:11px 13px; }
.regcards { display:grid; gap:var(--gap); }
.stagecard { display:flex; flex-direction:column; align-items:flex-start; gap:2px; border:1.5px solid var(--line); background:var(--card); border-radius:13px; padding:13px 15px; cursor:pointer; text-align:left; }
.stagecard.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 8%, var(--card)); }
.stagecard b { font-family:'Fraunces Variable','Fraunces',serif; font-size:16px; color:var(--ink); } .stagecard.on b { color:var(--primary); }
.stagecard span { font-size:var(--fs-sm); color:var(--soft); }
.nav { display:flex; gap:10px; margin-top:20px; }
.back { border:1.5px solid var(--line); background:var(--card); color:var(--ink); border-radius:13px; padding:14px 20px; font:700 14px 'Karla Variable','Karla'; cursor:pointer; }
.nav .cta { flex:1; }
.plaincard { background:var(--card); border:1.5px solid var(--line); border-radius:var(--r-card); padding:14px 16px; margin-bottom:var(--gap); box-shadow:var(--sh-card); }
.plain { font-size:14px; line-height:1.6; margin:0 0 10px; }
.plain:last-child { margin-bottom:0; }
.script { font-size:14px; line-height:1.6; margin:0 0 12px; padding-left:12px; border-left:3px solid var(--primary); color:var(--ink); }
.script:last-child { margin-bottom:0; }
.homehead { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; }
.greet { font-family:'Fraunces Variable','Fraunces',serif; font-weight:440; font-size:var(--fs-title); line-height:1.1; margin:0; }
.greetsub { font-size:13px; color:var(--soft); margin-top:4px; }
.streak { display:flex; flex-direction:column; align-items:center; background:var(--card); border:1.5px solid var(--line); border-radius:13px; padding:8px 14px; min-width:70px; }
.streak b { font-family:'Fraunces Variable','Fraunces',serif; font-size:22px; color:var(--primary); line-height:1; } .streak span { font-size:10.5px; color:var(--soft); margin-top:2px; }
.nextrow { display:flex; gap:12px; align-items:flex-start; padding:10px 0; border-top:1.5px solid var(--line); }
.nextrow:first-child { border-top:none; }
.nextdot { flex-shrink:0; width:9px; height:9px; border-radius:50%; background:var(--accent); margin-top:5px; }
.nexttext { font-size:var(--fs-md); } .nextsub { font-size:12px; color:var(--soft); margin-top:2px; } .nextsub.link { color:var(--primary-text); font-weight:700; }
.pulse { background:color-mix(in srgb, var(--primary) 9%, var(--card)); border:1.5px solid color-mix(in srgb, var(--primary) 25%, var(--line)); border-radius:13px; padding:12px 16px; }
.pulserow { display:flex; gap:12px; align-items:baseline; padding:6px 0; }
.pulserow b { font-family:'Fraunces Variable','Fraunces',serif; font-size:22px; color:var(--primary); min-width:72px; } .pulserow span { font-size:var(--fs-md); }
.recaprow { display:flex; justify-content:space-between; padding:9px 0; border-top:1.5px solid var(--line); font-size:var(--fs-md); }
.recaprow:first-child { border-top:none; margin-top:8px; } .recaprow b { font-weight:700; }
.up { color:var(--good); font-weight:700; margin-left:4px; } .down { color:var(--bad); font-weight:700; margin-left:4px; } .flat { color:var(--soft); font-weight:500; margin-left:4px; }
.better { color:var(--good); font-weight:700; } .worse { color:var(--bad); font-weight:700; }
.medrow { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:10px 0; border-top:1.5px solid var(--line); }
.medinfo { display:flex; flex-direction:column; gap:2px; } .medinfo b { font-size:14px; } .medinfo span { font-size:var(--fs-sm); color:var(--soft); }
.medeff { color:var(--primary-text) !important; font-weight:700; } .medeff.muted { color:var(--soft) !important; font-weight:500; }
.takebtn { flex-shrink:0; border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:8px 13px; font:700 12px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
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
.socialbtn { min-height:44px; display:flex; align-items:center; justify-content:center; gap:9px; border:1.5px solid var(--line); background:var(--card); border-radius:13px; padding:12px; font:700 14px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
.socialbtn:disabled { opacity:.6; }
.socialdot { width:12px; height:12px; border-radius:50%; }
/* ---- UI O1: onboarding. Splash motif + promise rows; step 1 providers 3-up (Apple leftmost, inline marks); the stage
   cards carry their palette swatch and the chosen one a check; the consent cadence is a two-column grid; each step slides
   in (cy-slide-in / cy-slide-back, defined here) and hands focus to its heading. Under the reduce rule steps appear at once. ---- */
.splashmotif { display:block; margin:0 0 10px -2px; }
.splashwhy { list-style:none; margin:0 0 14px; padding:0; display:grid; gap:8px; }
.splashwhy li { display:flex; align-items:center; gap:10px; font-size:var(--fs-lg); font-weight:600; color:var(--ink); line-height:1.35; }
.splashwhy svg { flex-shrink:0; color:var(--accent); }
.splashpriv { display:flex; align-items:flex-start; gap:8px; font-size:var(--fs-md); line-height:1.55; color:var(--soft); margin:0 0 16px; }
.splashpriv svg { flex-shrink:0; margin-top:3px; color:var(--primary-text); }
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
.aline { margin:0; padding:0 15px 10px; background:color-mix(in srgb, var(--primary) 10%, var(--card)); border:1.5px solid var(--line); border-top:none; border-radius:0 0 var(--r-card) var(--r-card); }
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
.mc, .pill, .takebtn, .sbtn, .orgbtn, .stagechip, .topbtn, .linkbtn, .ghost, .route, .inp, .slider, .minichip, .scopy, .palopt, .calcell { min-height:44px; }
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
.askstarter { flex-shrink:0; border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:11px 14px; font:500 13px 'Karla Variable','Karla'; color:var(--primary-text); min-height:44px; cursor:pointer; transition:transform var(--t-fast) var(--ease-std), background-color var(--t-fast), border-color var(--t-fast); }
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
.rcover { background:var(--card); border:1.5px solid var(--line); box-shadow:var(--sh-card); border-radius:13px; padding:13px 15px 12px; margin-bottom:8px; }
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
.emailpreview { resize:none; field-sizing:content; background:color-mix(in srgb, var(--primary) 5%, var(--card)); border-radius:var(--r-card); padding:13px 15px; overflow:hidden; }
@media print {
  .mast, nav[aria-label="Sections"], .tabswrap, .routes, .rappt .linkbtn, .rcov-today .linkbtn, .sadd, .scopy, .toast, .disclosure, .savebar, .report .cta, .rlong { display:none !important; }
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
/* Palette crossfade: for --t-slow after a palette change, an Appearance tap or a system light/dark flip (.cy.repaint,
   App.jsx; never on hydrate, a cross-tab adopt or print) the chrome recolours together.
   FAMILIES / RAMPS inline colours (chart dots, severity marks) are not in this list by design: data never animates. */
.cy.repaint .card, .cy.repaint .plaincard, .cy.repaint .cta, .cy.repaint .tab-on, .cy.repaint .mc.on, .cy.repaint .stagecard.on, .cy.repaint .pulse, .cy.repaint .meter, .cy.repaint .disclosure, .cy.repaint .pchart, .cy.repaint .streak, .cy.repaint .readcard { transition-property:background-color, border-color, color; transition-duration:var(--t-slow); }
/* ---- UI S1: Settings and palette sheets. A sticky title bar with a Close button (Done stays at the bottom), three
   groups separated by a rule, labels with a glyph, a nudge row that says when its time isn't used (tinted, never
   dimmed by opacity: the filled pill would fall under 4.5:1), a data status strip, visible field labels, and palette
   options that preview themselves: each row carries its own --primary / --accent / --line, so its name, border, check
   and mini page swatch are drawn in that palette while the rest of the sheet stays in the current one. ---- */
.sheethead { position:sticky; top:0; z-index:2; display:flex; justify-content:space-between; align-items:center; gap:10px; background:var(--card); margin:-14px -14px 10px; padding:12px 14px; border-bottom:1.5px solid var(--line); border-radius:14px 14px 0 0; }
.sheettitle { font:600 20px 'Fraunces Variable','Fraunces',serif; margin:0; color:var(--ink); line-height:1.15; }
.sheetclose { display:inline-flex; align-items:center; justify-content:center; min-width:44px; min-height:44px; padding:0; border:1.5px solid var(--line); border-radius:var(--r-pill); background:var(--card); color:var(--primary-text); cursor:pointer; }
.setgroup { padding:10px 0 2px; border-top:1.5px solid var(--line); }
.sheethead + .setgroup { border-top:none; padding-top:0; }
.palsheet .medinfo span { font-size:13px; line-height:1.45; }
.palsheet .rfoot { font-size:12.5px; margin-top:8px; }
.palsheet .linkbtn { display:flex; width:100%; justify-content:center; min-height:44px; }
.palsheet .ghostbtn { margin-top:10px; }
.palsheet .section-lab .labico { color:var(--accent); }
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
.palmini { margin-left:auto; width:34px; height:22px; flex-shrink:0; border-radius:6px; background:var(--paper-mini); border:1.5px solid var(--line); position:relative; }
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
.pots .linkbtn.helpnow { display:flex; align-items:center; gap:8px; width:100%; text-decoration:none; border:1.5px solid var(--line); border-radius:var(--r-card); padding:10px 13px; margin-top:14px; min-height:44px; color:var(--ink); background:var(--card); font-size:var(--fs-md); text-align:left; }
.pots .linkbtn.helpnow::before { content:''; flex-shrink:0; width:8px; height:8px; border-radius:50%; background:var(--bad); }
.pots .linkbtn.helpnow .chev { margin-left:auto; color:var(--soft); }
/* ---- L1 (spec A14.1): the waiting-update row in the header and Home's install tip ---- */
.mast > .updrow { flex:1 1 100%; display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin:6px 0 0; padding:0 4px 0 12px; border:1px solid var(--line); border-radius:var(--r-pill); background:var(--card); font-size:var(--fs-sm); color:var(--soft); }
.updrow .linkbtn { min-height:44px; padding:0 8px; font-size:var(--fs-sm); }
/* gap 6px, 10px left padding and a slightly narrower Install keep the sentence to two lines at 390px, so the tip adds ≤ 64px to Home. */
.installtip { display:flex; align-items:center; gap:6px; margin:10px 0 0; padding:4px 4px 4px 10px; border:1.5px solid var(--line); border-radius:var(--r-card); background:var(--card); }
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
.symsheet { background:var(--card); border:1.5px solid var(--line); border-radius:14px; padding:14px; margin:0 0 16px; box-shadow:var(--sh-sheet); animation:cy-fade-rise var(--t-base) var(--ease-in); }
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
`;
