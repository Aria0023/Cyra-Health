/* One stylesheet, injected once per screen shell. CSS custom properties come from
   the active palette (see App.jsx). The fonts are bundled (src/main.jsx imports
   @fontsource-variable/fraunces and /karla), so this stylesheet loads nothing from
   another server. The bundled faces are named 'Fraunces Variable' and 'Karla Variable';
   plain 'Fraunces' / 'Karla' stay listed as fallbacks for a locally installed copy. */
export const css = `
/* ---- tokens (spec §8.4): one type scale, one grid, one set of radii and motion timings. --primary-text is the
   body-text tint of the palette primary (AA on paper at 12.5px in every palette); --good/--bad are the two status
   hues; --sa-* are the device safe-area insets (Capacitor's --safe-area-inset-* first, then env(), then 0). ---- */
.cy { --fs-xs:11px; --fs-sm:12.5px; --fs-md:13.5px; --fs-lg:15.5px; --fs-num:23px; --fs-title:26px; --r-card:13px; --r-inner:11px; --r-pill:999px; --gap:8px; --stack:12px; --t-fast:100ms; --t-base:200ms; --t-slow:300ms; --ease-std:cubic-bezier(.2,0,0,1); --ease-in:cubic-bezier(.05,.7,.1,1); --ease-out:cubic-bezier(.3,0,.8,.15); --primary-text:color-mix(in srgb, var(--primary) 82%, var(--ink)); --good:#43604F; --bad:#A04545; --bad-bg:#FBEEEA; --sa-t:var(--safe-area-inset-top, env(safe-area-inset-top, 0px)); --sa-b:var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)); background:var(--paper); color:var(--ink); font-family:'Karla Variable','Karla',sans-serif; line-height:1.5; min-height:100dvh; max-width:430px; margin:0 auto; padding:18px 16px 48px; box-sizing:border-box; transition:background var(--t-slow); }
/* html is above .cy, so the one html-level rule (scroll padding under the POTS stop bar) gets the same inset tokens. */
html { --sa-t:var(--safe-area-inset-top, env(safe-area-inset-top, 0px)); --sa-b:var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)); }
.cy * { box-sizing:border-box; }
.mast { display:flex; flex-wrap:wrap; justify-content:flex-end; align-items:center; gap:6px; margin-bottom:10px; }
/* Narrow phones: the header chips first narrow (their text wraps inside), and only when even that doesn't fit does the last one move to a second row, so the page never scrolls sideways. */
.mast > .mark { margin-right:auto; }
.mast > .stagechip, .mast > .acctchip { flex:1 1 min-content; max-width:max-content; margin-right:0; }
.mark { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:24px; }
.sub { font-size:10.5px; font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:var(--primary-text); margin-left:7px; vertical-align:3px; }
.orgsel { display:flex; gap:4px; background:var(--card); border:1px solid var(--line); border-radius:999px; padding:3px; }
.orgbtn { border:none; background:none; border-radius:999px; padding:5px 12px; font:700 11.5px 'Karla Variable','Karla'; color:var(--soft); cursor:pointer; }
.orgbtn.on { background:var(--primary); color:#FFF; }
.topnav { display:flex; gap:4px; margin-bottom:12px; }
.topbtn { flex:1; border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:8px 1px; font:700 11px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
.topbtn.on { background:var(--primary); border-color:var(--primary); color:#FFF; }
.stagebar { display:flex; gap:7px; margin-bottom:14px; }
.stagesel { flex:1; display:flex; flex-direction:column; gap:1px; align-items:flex-start; border:1px solid var(--line); background:var(--card); border-radius:12px; padding:9px 11px; cursor:pointer; font-family:'Karla Variable','Karla'; }
.stagesel b { font-size:13px; color:var(--ink); } .stagesel span { font-size:10.5px; color:var(--soft); }
.stagesel.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 8%, var(--card)); }
.stagesel.on b { color:var(--primary-text); }
.tabs { display:flex; gap:1px; border-bottom:2px solid var(--line); margin-bottom:16px; overflow-x:auto; scrollbar-width:none; -webkit-overflow-scrolling:touch; }
.tabs::-webkit-scrollbar { display:none; }
.tab { flex-shrink:0; }
.tab { background:none; border:none; border-bottom:3px solid transparent; padding:7px 8px 9px; font:700 13px 'Karla Variable','Karla'; color:var(--soft); cursor:pointer; }
.tab-on { color:var(--ink); border-bottom-color:var(--primary); }
.disp { font-family:'Fraunces Variable','Fraunces',serif; font-weight:440; font-size:var(--fs-title); line-height:1.14; margin:0 0 8px; }
.hint { font-size:var(--fs-md); line-height:1.55; color:var(--soft); margin:0 0 16px; }
.chips { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-bottom:16px; }
.chip { border:1.5px solid var(--line); background:var(--card); box-shadow:0 1px 2px rgba(0,0,0,.04); border-radius:13px; padding:11px; text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:5px; font-size:13.5px; color:var(--ink); }
.dots { font-size:10.5px; letter-spacing:3px; color:var(--soft); }
.chip.sev-1 { border-color:color-mix(in srgb, var(--accent) 60%, var(--line)); background:color-mix(in srgb, var(--accent) 7%, var(--card)); }
.chip.sev-2 { border-color:var(--accent); background:color-mix(in srgb, var(--accent) 16%, var(--card)); }
.chip.sev-3 { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 14%, var(--card)); font-weight:700; }
.row { display:flex; gap:var(--gap); margin-bottom:16px; }
.pill { flex:1; border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:9px 4px; font:500 13px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
.pill-on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 12%, var(--card)); color:var(--primary); font-weight:700; }
.cta { width:100%; border:none; border-radius:13px; background:var(--primary); color:#FFF; font:700 14px 'Karla Variable','Karla'; padding:14px; cursor:pointer; }
.cta:disabled { opacity:.6; }
/* Patterns charts (components/PatternCharts.jsx): data colours come from FAMILIES in lib/constants.js, never the UI palette. */
.backbar { margin:4px 0 2px; } .backbar .linkbtn { font-size:14px; }
.pchart { background:var(--card); border:1.5px solid var(--line); border-radius:var(--r-card); box-shadow:0 1px 2px rgba(0,0,0,.04); padding:12px 12px 10px; margin-bottom:var(--gap); }
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
.pday-s li { display:inline-flex; align-items:center; gap:5px; } .sevd { color:var(--soft); font-size:10.5px; letter-spacing:1px; }
.pcallout { display:flex; gap:12px; align-items:baseline; border-top:1px solid var(--line); margin-top:10px; padding-top:9px; }
.pcallout b { font-family:'Fraunces Variable','Fraunces',serif; font-size:24px; font-weight:600; white-space:nowrap; font-variant-numeric:tabular-nums; }
.pcallout p { margin:0; font-size:var(--fs-md); }
.card { background:var(--card); border:1.5px solid var(--line); box-shadow:0 1px 2px rgba(0,0,0,.04); border-radius:var(--r-card); padding:12px 16px; display:flex; gap:13px; align-items:baseline; margin-bottom:var(--gap); }
.num { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:var(--fs-num); color:var(--primary); min-width:56px; flex-shrink:0; white-space:nowrap; font-variant-numeric:tabular-nums; }
.card p { margin:0; font-size:var(--fs-md); line-height:1.5; }
.icard { margin-bottom:var(--gap); }
.advice { display:flex; gap:9px; align-items:flex-start; background:color-mix(in srgb, var(--primary) 10%, var(--card)); border:1.5px solid var(--line); border-top:none; border-radius:0 0 13px 13px; padding:10px 15px; }
.advice-alone { border-top:1.5px solid var(--line); border-radius:13px; }
.uchip { flex-shrink:0; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; border-radius:999px; padding:3px 9px; }
.u-now { background:#F3DBDB; color:var(--bad); } .u-visit { background:color-mix(in srgb, var(--primary) 16%, var(--card)); color:var(--primary-text); } .u-self { background:color-mix(in srgb, var(--good) 13%, var(--card)); color:var(--good); }
.atext { font-size:var(--fs-sm); line-height:1.5; }
.rep { background:var(--card); border:1.5px solid var(--line); box-shadow:0 1px 2px rgba(0,0,0,.04); border-radius:13px; padding:15px; margin-bottom:12px; }
.rtitle { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:17px; margin-bottom:10px; }
.rmeta { display:block; font-size:11.5px; font-weight:400; color:var(--soft); margin-top:2px; font-family:'Karla Variable','Karla'; }
.rtab { width:100%; border-collapse:collapse; font-size:12.5px; }
.rtab th { text-align:left; font-size:11px; color:var(--soft); padding:3px 0; }
.rtab td { padding:5px 0; border-top:1px solid var(--line); }
.rlist { margin:0; padding-left:17px; font-size:var(--fs-sm); line-height:1.6; } .rfoot { font-size:12px; color:var(--soft); margin:12px 0 0; line-height:1.5; }
.routes { display:flex; gap:8px; }
.route { flex:1; display:flex; flex-direction:column; gap:2px; border:1px solid var(--primary); background:var(--card); color:var(--primary); border-radius:12px; padding:11px 8px; font:700 12px 'Karla Variable','Karla'; cursor:pointer; }
.route span { font-weight:500; font-size:11.5px; color:var(--soft); }
.shelfc { background:var(--card); border:1.5px solid var(--line); box-shadow:0 1px 2px rgba(0,0,0,.04); border-radius:var(--r-card); padding:14px; margin-bottom:var(--gap); }
.shead { display:flex; justify-content:space-between; align-items:center; margin-bottom:3px; }
.ppill { font-size:10.5px; font-weight:700; text-transform:uppercase; border:1px solid var(--line); border-radius:999px; padding:2px 8px; color:var(--soft); }
.sname { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:15.5px; margin-bottom:3px; }
.smatch { font-size:11.5px; color:var(--primary-text); font-weight:700; margin-bottom:5px; }
.ev { display:inline-block; font-size:11px; font-weight:700; border-radius:999px; padding:3px 9px; margin-bottom:8px; }
.ev-strong { background:color-mix(in srgb, var(--good) 13%, var(--card)); color:var(--good); } .ev-mixed { background:#FBEEE2; color:#8A4E18; } .ev-comfort { background:#EDE7EF; color:#6E6076; }
.sfoot { display:flex; justify-content:space-between; align-items:center; font-size:13px; gap:8px; }
.sbtn { border:1px solid var(--primary); background:none; color:var(--primary); border-radius:999px; padding:7px 14px; font:700 12px 'Karla Variable','Karla'; cursor:pointer; }
.loglines { background:var(--card); border:1.5px solid var(--line); border-radius:13px; padding:12px; font-family:ui-monospace,monospace; font-size:11px; line-height:1.7; }
.logline.money { color:var(--good); font-weight:700; } .logline.bad { color:var(--bad); font-weight:700; }
.swatches { display:flex; gap:6px; margin-top:8px; }
.swatch { width:22px; height:22px; border-radius:6px; border:1px solid var(--line); }
.phasecard { display:flex; gap:14px; align-items:center; background:var(--card); border:1.5px solid var(--line); box-shadow:0 1px 2px rgba(0,0,0,.04); border-radius:13px; padding:13px 15px; margin-bottom:14px; }
.phaseday { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:21px; color:var(--primary); white-space:nowrap; }
.phaseinfo { display:flex; flex-direction:column; gap:2px; font-size:13px; }
.phaseinfo span { color:var(--soft); font-size:12.5px; line-height:1.45; }
.readcard { background:color-mix(in srgb, var(--primary) 10%, var(--card)); border:1.5px solid color-mix(in srgb, var(--primary) 25%, var(--line)); border-radius:13px; padding:14px; margin-top:14px; }
.calgrid { display:grid; grid-template-columns:repeat(7,1fr); gap:5px; margin-bottom:10px; }
.calhead { text-align:center; font-size:10.5px; font-weight:700; color:var(--soft); padding:2px 0; }
.calcell { position:relative; aspect-ratio:1; display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:600; border-radius:10px; background:var(--card); border:1.5px solid var(--line); color:var(--ink); cursor:pointer; }
.c-period { background:var(--primary); border-color:var(--primary); color:#FFF; font-weight:700; }
.c-pred { background:color-mix(in srgb, var(--primary) 18%, var(--card)); border-style:dashed; border-color:var(--primary); color:var(--primary); font-weight:700; }
.c-fert { background:color-mix(in srgb, var(--accent) 22%, var(--card)); border-color:var(--accent); }
.c-today { outline:none; box-shadow:inset 0 0 0 2px var(--ink); }
.callegend { display:flex; flex-wrap:wrap; gap:10px; font-size:11.5px; color:var(--soft); margin-bottom:12px; }
.callegend .dot { display:inline-block; width:10px; height:10px; border-radius:3px; margin-right:4px; vertical-align:-1px; }
.d-period { background:var(--primary); } .d-pred { background:color-mix(in srgb, var(--primary) 25%, var(--card)); border:1px dashed var(--primary); } .d-fert { background:color-mix(in srgb, var(--accent) 35%, var(--card)); }
.pregband { display:flex; gap:14px; align-items:center; background:var(--card); border:1.5px solid var(--line); box-shadow:0 1px 2px rgba(0,0,0,.04); border-radius:13px; padding:14px 15px; margin-bottom:8px; }
.pregweek { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:22px; color:var(--primary); white-space:nowrap; }
.pregmeta { display:flex; flex-direction:column; gap:2px; font-size:13px; }
.pregmeta span { color:var(--soft); font-size:12.5px; }
.pregbar { height:8px; background:color-mix(in srgb, var(--ink) 8%, var(--paper)); border-radius:4px; overflow:hidden; margin-bottom:14px; }
.pregfill { height:100%; background:linear-gradient(90deg,var(--accent),var(--primary)); }
.kickrow { display:flex; gap:10px; align-items:stretch; margin-bottom:12px; }
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
.acctchip { font-size:11px; font-weight:700; color:var(--ink); border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:6px 11px; margin-right:6px; }
.stagechip { border:1.5px solid var(--line); background:var(--card); color:var(--primary-text); border-radius:999px; padding:6px 12px; font:700 11.5px 'Karla Variable','Karla'; cursor:pointer; }
.obwrap { padding-top:14px; }
.obq { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:20px; margin:6px 0 14px; }
.obopts { display:grid; gap:var(--gap); margin-bottom:18px; }
.obopt { border:1.5px solid var(--line); background:var(--card); box-shadow:0 1px 2px rgba(0,0,0,.05); border-radius:13px; padding:14px; text-align:left; font:500 14.5px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
.obdots { display:flex; gap:6px; margin-bottom:16px; }
.obdots span { width:8px; height:8px; border-radius:50%; background:var(--line); }
.obdots span.on { background:var(--primary); }
.c-log { position:absolute; top:3px; right:4px; width:5px; height:5px; border-radius:50%; background:var(--accent); }
.c-period .c-log { background:#FFF; }
.linkbtn { display:inline-flex; align-items:center; border:none; background:none; color:var(--primary-text); font:700 12.5px 'Karla Variable','Karla'; text-decoration:underline; cursor:pointer; padding:0; }
.c-wk { border-color:var(--accent); }
.c-wklab { position:absolute; bottom:2px; font-size:9px; font-weight:700; color:var(--accent); }
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
.disclosure { width:100%; display:flex; justify-content:space-between; align-items:center; border:1.5px solid var(--line); background:var(--card); border-radius:13px; padding:13px 15px; font:700 var(--fs-md) 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; margin:14px 0 0; }
.bodypanel { border:1.5px solid var(--line); border-top:none; border-radius:0 0 13px 13px; background:var(--card); padding:4px 15px 14px; }
.disclosure.more { margin:8px 0 0; min-height:44px; padding:10px 13px; border-radius:var(--r-inner); background:transparent; font-size:var(--fs-sm); text-align:left; gap:10px; }
.disclosure.more[aria-expanded="true"] { border-radius:var(--r-inner) var(--r-inner) 0 0; }
.bodypanel.more { border-radius:0 0 var(--r-inner) var(--r-inner); background:transparent; padding:8px 13px 10px; font-size:var(--fs-sm); line-height:1.55; color:var(--ink); }
.bodypanel.more[hidden] { display:none; }
.bodypanel.more p { margin:0 0 6px; } .bodypanel.more p:last-child { margin-bottom:0; }
.bodypanel.more ul { margin:0; padding-left:17px; } .bodypanel.more li { margin:0 0 5px; } .bodypanel.more li:last-child { margin-bottom:0; }
.morewrap { margin:0 0 10px; }
.wrapchips { display:flex; flex-wrap:wrap; gap:7px; }
.minichip { border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:9px 14px; font:500 12.5px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
.minichip.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 12%, var(--card)); color:var(--primary); font-weight:700; }
.scalerow { margin-bottom:12px; }
.scalehead { display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:-4px; }
.scalehead b { font-family:'Fraunces Variable','Fraunces',serif; color:var(--primary); font-size:15px; }
.scalehead b.zero { color:var(--soft); }
.slider { width:100%; accent-color:var(--primary); margin:0; cursor:pointer; }
.scaleends { display:flex; justify-content:space-between; font-size:11.5px; color:var(--soft); margin-top:-6px; }
.meter { border:2px solid var(--line); box-shadow:0 1px 3px rgba(0,0,0,.06); background:var(--card); border-radius:var(--r-card); padding:12px 14px; margin-bottom:var(--gap); transition:border-color var(--t-slow) var(--ease-std); }
.meterhead { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:7px; }
.meterlabel { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:16px; }
.meterval { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:20px; display:inline-flex; align-items:center; gap:7px; }
.meterdot { width:12px; height:12px; border-radius:50%; display:inline-block; transition:background var(--t-slow) var(--ease-std); }
.metertrack { height:11px; background:color-mix(in srgb, var(--ink) 14%, var(--card)); border-radius:5px; overflow:hidden; }
.meterfill { height:100%; border-radius:5px; transition:width var(--t-slow) var(--ease-std), background var(--t-slow) var(--ease-std); }
.meterends { display:flex; justify-content:space-between; font-size:10.5px; color:var(--soft); margin-top:3px; }
.gradlegend { display:flex; align-items:center; gap:8px; font-size:11px; color:var(--soft); margin-bottom:12px; }
.gradbar { flex:1; height:7px; border-radius:4px; }
.c-per-mark { position:absolute; bottom:3px; width:5px; height:5px; border-radius:50%; background:var(--primary); box-shadow:0 0 0 1.5px rgba(255,255,255,.7); }
.d-permark { background:var(--primary); border-radius:50%; }
.scorepill { float:right; font-size:10.5px; font-weight:700; color:#FFF; border-radius:999px; padding:3px 9px; }
.palsheet { background:var(--card); border:1.5px solid var(--line); border-radius:14px; padding:14px; margin-bottom:14px; box-shadow:0 2px 8px rgba(0,0,0,.07); }
.palopt { display:flex; align-items:center; gap:11px; width:100%; text-align:left; border:1.5px solid var(--line); background:var(--card); border-radius:12px; padding:10px 12px; margin-bottom:8px; cursor:pointer; }
.palopt.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 8%, var(--card)); }
.palswatches { display:flex; gap:4px; flex-shrink:0; }
.palswatches i { width:19px; height:19px; border-radius:6px; display:block; }
.palmeta { display:flex; flex-direction:column; flex:1; }
.palmeta b { font-size:13px; color:var(--ink); } .palmeta span { font-size:11px; color:var(--soft); }
.palcheck { color:var(--primary); font-weight:700; }
.prog { display:flex; gap:5px; margin-bottom:6px; }
.prog span { flex:1; height:5px; border-radius:3px; background:color-mix(in srgb, var(--ink) 14%, var(--card)); }
.prog span.on { background:var(--primary); }
.stepno { font-size:11px; font-weight:700; color:var(--soft); text-transform:uppercase; letter-spacing:.07em; margin-bottom:12px; }
.labErr { color:var(--bad); }
.need { color:var(--bad); font-weight:700; }
.mcrow { display:flex; flex-wrap:wrap; gap:var(--gap); }
.mc { border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:9px 15px; font:500 13px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
.mc.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 12%, var(--card)); color:var(--primary); font-weight:700; }
.err .mc, .err .stagecard { border-color:#E0A99B; }
/* ---- control states (spec §8.4): rest / pressed / hover (pointer only) / focus-visible / disabled. Pressed = a 100ms
   scale on transform plus the selected tint, so a tap answers before the state changes. ---- */
.cy button, .cy [role=button] { -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
.cta, .ghostbtn, .back, .stagecard, .disclosure, .route, .socialbtn, .obopt, .consentopt, .palopt { transition:transform var(--t-fast) var(--ease-std), background-color var(--t-fast), border-color var(--t-fast), color var(--t-fast); }
.cta:active, .ghostbtn:active, .back:active, .stagecard:active, .disclosure:active, .route:active, .socialbtn:active, .obopt:active, .consentopt:active, .palopt:active { transform:scale(.985); }
.cta:active { filter:brightness(.94); }
.mc, .chip, .pill, .takebtn, .sbtn, .minichip, .tab, .calcell, .scopy, .linkbtn { transition:transform var(--t-fast) var(--ease-std), background-color var(--t-fast), border-color var(--t-fast), color var(--t-fast); }
.mc:active, .chip:active, .pill:active, .takebtn:active, .sbtn:active, .minichip:active, .calcell:active { transform:scale(.96); background:color-mix(in srgb, var(--primary) 12%, var(--card)); border-color:var(--primary); }
@media (hover:hover) { .mc:hover, .chip:hover, .pill:hover, .disclosure:hover, .stagecard:hover, .takebtn:hover, .sbtn:hover, .route:hover, .obopt:hover { border-color:color-mix(in srgb, var(--primary) 55%, var(--line)); } }
/* Danger: the one destructive pill (Delete everything) is red-outlined and never takes the primary tint. */
.mc.danger { color:var(--bad); border-color:color-mix(in srgb, var(--bad) 40%, var(--line)); }
.mc.danger:active, .mc.danger.on { background:var(--bad-bg); border-color:var(--bad); color:var(--bad); }
/* Joined control: 2-5 mutually exclusive answers or views share one border (buttons keep .mc/.on and aria-pressed;
   standalone .mc pills stay for multi-select). Labels wrap to two lines rather than truncate. */
.seg { display:flex; flex-wrap:nowrap; width:100%; background:var(--card); border:1.5px solid var(--line); border-radius:var(--r-pill); padding:3px; gap:0; box-sizing:border-box; }
.seg .mc { flex:1 1 0; min-width:0; border:none; background:none; border-radius:var(--r-pill); padding:7px 4px; font-weight:700; font-size:12px; line-height:1.2; color:var(--soft); min-height:44px; text-align:center; white-space:normal; overflow-wrap:anywhere; }
.seg .mc.on { background:var(--primary); color:#FFF; }
.seg .mc:active { background:color-mix(in srgb, var(--primary) 12%, var(--card)); } .seg .mc.on:active { background:var(--primary); }
.seg.scroll { overflow-x:auto; scrollbar-width:none; } .seg.scroll::-webkit-scrollbar { display:none; }
.seg.scroll .mc { flex:1 0 auto; padding:8px 12px; white-space:nowrap; }
.inpErr { border-color:var(--bad) !important; background:var(--bad-bg) !important; }
.errhint { font-size:var(--fs-sm); color:var(--bad); line-height:1.5; margin:14px 0 0; background:var(--bad-bg); border:1.5px solid #E7C3B8; border-radius:var(--r-inner); padding:11px 13px; }
.regcards { display:grid; gap:var(--gap); }
.stagecard { display:flex; flex-direction:column; align-items:flex-start; gap:2px; border:1.5px solid var(--line); background:var(--card); border-radius:13px; padding:13px 15px; cursor:pointer; text-align:left; }
.stagecard.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 8%, var(--card)); }
.stagecard b { font-family:'Fraunces Variable','Fraunces',serif; font-size:16px; color:var(--ink); } .stagecard.on b { color:var(--primary); }
.stagecard span { font-size:var(--fs-sm); color:var(--soft); }
.nav { display:flex; gap:10px; margin-top:20px; }
.back { border:1.5px solid var(--line); background:var(--card); color:var(--ink); border-radius:13px; padding:14px 20px; font:700 14px 'Karla Variable','Karla'; cursor:pointer; }
.nav .cta { flex:1; }
.plaincard { background:var(--card); border:1.5px solid var(--line); border-radius:var(--r-card); padding:14px 16px; margin-bottom:var(--gap); box-shadow:0 1px 2px rgba(0,0,0,.04); }
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
.takebtn.on { border-color:var(--primary); background:var(--primary); color:#FFF; }
.takebtn[aria-pressed] { position:relative; padding:8px 13px 8px 34px; }
.takebtn[aria-pressed]::before { content:''; position:absolute; left:11px; top:50%; width:16px; height:9px; transform:translateY(-50%); border-radius:999px; background:var(--line); }
.takebtn[aria-pressed]::after { content:''; position:absolute; left:11px; top:50%; width:9px; height:9px; transform:translateY(-50%); border-radius:50%; background:#FFF; box-shadow:0 0 0 1px rgba(0,0,0,.12); transition:left var(--t-fast); }
.takebtn.on[aria-pressed]::before { background:rgba(255,255,255,.45); }
.takebtn.on[aria-pressed]::after { left:18px; box-shadow:none; }
.jentry { border-top:1.5px solid var(--line); padding:10px 0; } .jentry b { font-size:12px; color:var(--soft); } .jentry p { margin:4px 0 0; font-size:var(--fs-md); line-height:1.55; white-space:pre-wrap; }
.orline { display:flex; align-items:center; gap:10px; margin:14px 0 10px; font-size:11.5px; color:var(--soft); text-transform:uppercase; letter-spacing:.07em; }
.orline::before, .orline::after { content:""; flex:1; height:1.5px; background:var(--line); }
.social { display:grid; gap:var(--gap); }
.socialbtn { min-height:44px; display:flex; align-items:center; justify-content:center; gap:9px; border:1.5px solid var(--line); background:var(--card); border-radius:13px; padding:12px; font:700 14px 'Karla Variable','Karla'; color:var(--ink); cursor:pointer; }
.socialbtn:disabled { opacity:.6; }
.socialdot { width:12px; height:12px; border-radius:50%; }

/* Milestones: a progress timeline (a line through small nodes), not a list of choices. */
.mscard { padding:12px 16px 8px; margin-bottom:var(--gap); } .mscard .morewrap { margin:2px 0 0; }
.msteps { list-style:none; margin:2px 0 8px; padding:0; display:flex; align-items:center; }
.mstep { position:relative; flex:1; display:flex; justify-content:center; align-items:center; }
.mstep::before { content:""; position:absolute; left:0; right:0; top:50%; height:2px; margin-top:-1px; background:var(--line); }
.mstep:first-child::before { left:50%; } .mstep:last-child::before { right:50%; }
.mstep.done::before { background:var(--primary); } .mstep .msdot { position:relative; }
.mstep.done .msdot { background:var(--primary); border-color:var(--primary); color:#FFF; }
.msnext { font-size:var(--fs-md); margin:0; line-height:1.5; } .msnext .msbar { display:inline-block; vertical-align:middle; margin-left:8px; }
.dgrid { display:grid; grid-template-columns:1fr 1fr; gap:var(--gap); margin-top:14px; }
.dgrid .disclosure { margin:0; min-height:44px; padding:10px 12px; font-size:12.5px; text-align:left; gap:8px; }
.dgrid > .disclosure:last-child:nth-child(odd) { grid-column:1 / -1; }
.disclosure.on { border-color:var(--primary); color:var(--primary); }
.bodypanel.detached { border-top:1.5px solid var(--line); border-radius:13px; margin-top:8px; }
.ptitle { font-weight:700; font-size:13.5px; margin:10px 0 0; }
.pulse .morewrap { margin:6px 0 0; } .ptap { color:var(--soft); }
.mstrip { list-style:none; margin:0; padding:0 0 0 2px; }
.ms { position:relative; display:flex; align-items:center; gap:12px; padding:6px 0 6px 0; font-size:13px; color:var(--soft); }
.ms::before { content:""; position:absolute; left:8px; top:0; bottom:0; width:2px; background:var(--line); }
.ms:first-child::before { top:50%; } .ms:last-child::before { bottom:50%; }
.ms.done { color:var(--ink); }
.msdot { position:relative; flex-shrink:0; width:18px; height:18px; border-radius:50%; border:2px solid var(--line); background:var(--card); display:flex; align-items:center; justify-content:center; font-size:10.5px; font-weight:700; box-sizing:border-box; }
.ms.done .msdot { background:var(--primary); border-color:var(--primary); color:#FFF; }
.ms.done + .ms::before { background:linear-gradient(var(--primary), var(--primary) 50%, var(--line) 50%); }
.ms.done + .ms.done::before, .ms.done:first-child::before { background:var(--primary); }
.mslabel { flex:1; }
.msbar { width:56px; height:6px; background:color-mix(in srgb, var(--ink) 12%, var(--card)); border-radius:3px; overflow:hidden; }
.msbar i { display:block; height:100%; background:var(--primary); }
/* ---- accessibility ---- */
/* Reduce, don't remove: movement (keyframes, transform/size transitions) goes away, the 100ms colour and opacity
   feedback that tells a reduced-motion user a tap registered stays. */
@media (prefers-reduced-motion: reduce) { .cy *, .cy *::before, .cy *::after { animation:none !important; transition-property:background-color,border-color,color,opacity !important; transition-duration:var(--t-fast) !important; } }
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
.tab { min-height:44px; padding:12px 10px; }
/* The tab bar scrolls sideways (overflow-x:auto), which clips anything drawn outside it, so a tab's ring sits just inside the tab. */
.tab:focus-visible { outline-offset:-3px; }
.mc, .pill, .takebtn, .sbtn, .orgbtn, .stagechip, .topbtn, .linkbtn, .ghost, .route, .inp, .slider, .minichip, .scopy, .palopt, .calcell { min-height:44px; }
.sdot.on, .c-per-mark { outline:1.5px solid rgba(0,0,0,.35); }
.wearbtns { display:flex; gap:6px; flex-shrink:0; align-items:center; }
.wearconfirm { margin:2px 0 12px; }
.wearconfirm .ghostbtn { margin-top:8px; }
.sbtn:disabled, .sbtn[aria-disabled="true"] { cursor:default; color:var(--soft); border-color:var(--line); border-style:dashed; font-weight:600; }
button[aria-disabled="true"] { cursor:default; }
.statechip { font:700 11px 'Karla Variable','Karla'; color:var(--soft); border:1.5px dashed var(--line); border-radius:var(--r-pill); padding:6px 10px; align-self:center; line-height:1.2; }
.emailpreview { resize:vertical; font:500 12.5px/1.5 'Karla Variable','Karla',sans-serif; white-space:pre-wrap; user-select:text; -webkit-user-select:text; }
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
.goalbar { height:10px; background:var(--line); border-radius:5px; overflow:hidden; margin:8px 0 4px; }
.goalfill { height:100%; background:var(--primary); border-radius:5px; }
.pots-timer { font-family:'Fraunces Variable','Fraunces',serif; font-weight:600; font-size:54px; line-height:1.1; text-align:center; font-variant-numeric:tabular-nums; margin:6px 0 10px; color:var(--ink); }
.cta.stopbtn { background:var(--bad); color:#FFF; min-height:56px; font-size:15px; }
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
.rcover { background:var(--card); border:1.5px solid var(--line); box-shadow:0 1px 2px rgba(0,0,0,.04); border-radius:13px; padding:13px 15px 12px; margin-bottom:8px; }
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
.toast { position:fixed; left:50%; transform:translateX(-50%); bottom:calc(20px + var(--sa-b)); background:var(--ink); color:#FFF; font-size:13px; padding:9px 16px; border-radius:999px; max-width:86%; text-align:center; z-index:9; pointer-events:none; }
.cy:has(.stopbar) .toast { bottom:calc(86px + var(--sa-b)); }
`;
