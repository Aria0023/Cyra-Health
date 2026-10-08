/* One stylesheet, injected once per screen shell. CSS custom properties come from
   the active palette (see App.jsx). */
export const css = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,440;9..144,600&family=Karla:wght@400;500;700&display=swap');
.cy { background:var(--paper); color:var(--ink); font-family:'Karla',sans-serif; min-height:100vh; max-width:430px; margin:0 auto; padding:18px 16px 48px; box-sizing:border-box; transition:background .35s; }
.cy * { box-sizing:border-box; }
.mast { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
.mark { font-family:'Fraunces',serif; font-weight:600; font-size:24px; }
.sub { font-size:10px; font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:var(--primary); margin-left:7px; vertical-align:3px; }
.orgsel { display:flex; gap:4px; background:var(--card); border:1px solid var(--line); border-radius:999px; padding:3px; }
.orgbtn { border:none; background:none; border-radius:999px; padding:5px 12px; font:700 11.5px 'Karla'; color:var(--soft); cursor:pointer; }
.orgbtn.on { background:var(--primary); color:#FFF; }
.topnav { display:flex; gap:4px; margin-bottom:12px; }
.topbtn { flex:1; border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:8px 1px; font:700 11px 'Karla'; color:var(--ink); cursor:pointer; }
.topbtn.on { background:var(--primary); border-color:var(--primary); color:#FFF; }
.stagebar { display:flex; gap:7px; margin-bottom:14px; }
.stagesel { flex:1; display:flex; flex-direction:column; gap:1px; align-items:flex-start; border:1px solid var(--line); background:var(--card); border-radius:12px; padding:9px 11px; cursor:pointer; font-family:'Karla'; }
.stagesel b { font-size:13px; color:var(--ink); } .stagesel span { font-size:10.5px; color:var(--soft); }
.stagesel.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 8%, var(--card)); }
.stagesel.on b { color:var(--primary); }
.tabs { display:flex; gap:1px; border-bottom:2px solid var(--line); margin-bottom:16px; overflow-x:auto; scrollbar-width:none; -webkit-overflow-scrolling:touch; }
.tabs::-webkit-scrollbar { display:none; }
.tab { flex-shrink:0; }
.tab { background:none; border:none; border-bottom:3px solid transparent; padding:7px 8px 9px; font:700 13px 'Karla'; color:var(--soft); cursor:pointer; }
.tab-on { color:var(--ink); border-bottom-color:var(--primary); }
.disp { font-family:'Fraunces',serif; font-weight:440; font-size:25px; line-height:1.14; margin:0 0 8px; }
.hint { font-size:13.5px; line-height:1.55; color:var(--soft); margin:0 0 16px; }
.chips { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-bottom:16px; }
.chip { border:1.5px solid var(--line); background:var(--card); box-shadow:0 1px 2px rgba(0,0,0,.04); border-radius:13px; padding:11px; text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:5px; font-size:13.5px; color:var(--ink); }
.dots { font-size:10px; letter-spacing:3px; color:var(--soft); }
.chip.sev-1, .chip.sev-2 { border-color:var(--accent); background:color-mix(in srgb, var(--accent) 14%, var(--card)); }
.chip.sev-3 { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 12%, var(--card)); }
.row { display:flex; gap:8px; margin-bottom:16px; }
.pill { flex:1; border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:9px 4px; font:500 13px 'Karla'; color:var(--ink); cursor:pointer; }
.pill-on { border-color:#7E9B87; background:#E7EFE9; }
.cta { width:100%; border:none; border-radius:13px; background:var(--primary); color:#FFF; font:700 14px 'Karla'; padding:14px; cursor:pointer; }
.cta:disabled { opacity:.6; }
.stripes { display:flex; height:88px; border-radius:10px; overflow:hidden; margin-bottom:6px; }
.scol { flex:1; display:flex; flex-direction:column; } .stripe { flex:1; } .sdot { height:5px; } .sdot.on { background:var(--primary); }
.legend { display:flex; align-items:center; gap:8px; font-size:11px; color:var(--soft); margin-bottom:16px; }
.lbar { flex:1; height:5px; border-radius:3px; } .lper { color:var(--primary); font-weight:700; }
.card { background:var(--card); border:1.5px solid var(--line); box-shadow:0 1px 2px rgba(0,0,0,.04); border-radius:13px; padding:13px 15px; display:flex; gap:13px; align-items:baseline; margin-bottom:10px; }
.num { font-family:'Fraunces',serif; font-weight:600; font-size:23px; color:var(--primary); min-width:56px; }
.card p { margin:0; font-size:13px; line-height:1.5; }
.icard { margin-bottom:12px; }
.advice { display:flex; gap:9px; align-items:flex-start; background:color-mix(in srgb, var(--primary) 10%, var(--card)); border:1.5px solid var(--line); border-top:none; border-radius:0 0 13px 13px; padding:10px 15px; }
.uchip { flex-shrink:0; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; border-radius:999px; padding:3px 9px; }
.u-now { background:#F3DBDB; color:#A04545; } .u-visit { background:color-mix(in srgb, var(--primary) 16%, var(--card)); color:var(--primary); } .u-self { background:#E7EFE9; color:#43604F; }
.atext { font-size:12.5px; line-height:1.5; }
.bars { display:grid; gap:8px; margin-top:6px; }
.brow { display:grid; grid-template-columns:108px 1fr 24px; align-items:center; gap:9px; }
.blab { font-size:12px; } .btrack { height:10px; background:color-mix(in srgb, var(--ink) 14%, var(--card)); border-radius:5px; overflow:hidden; }
.bfill { height:100%; } .bval { font-size:11.5px; color:var(--soft); text-align:right; }
.rep { background:var(--card); border:1.5px solid var(--line); box-shadow:0 1px 2px rgba(0,0,0,.04); border-radius:13px; padding:15px; margin-bottom:12px; }
.rtitle { font-family:'Fraunces',serif; font-weight:600; font-size:17px; margin-bottom:10px; }
.rmeta { display:block; font-size:11.5px; font-weight:400; color:var(--soft); margin-top:2px; font-family:'Karla'; }
.rtab { width:100%; border-collapse:collapse; font-size:12.5px; }
.rtab th { text-align:left; font-size:11px; color:var(--soft); padding:3px 0; }
.rtab td { padding:5px 0; border-top:1px solid var(--line); }
.rsec { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.09em; color:var(--soft); margin:12px 0 6px; }
.rlist { margin:0; padding-left:17px; font-size:12.5px; line-height:1.6; } .rfoot { font-size:11.5px; color:var(--soft); margin:12px 0 0; line-height:1.5; }
.routes { display:flex; gap:8px; }
.route { flex:1; display:flex; flex-direction:column; gap:2px; border:1px solid var(--primary); background:var(--card); color:var(--primary); border-radius:12px; padding:11px 8px; font:700 12px 'Karla'; cursor:pointer; }
.route span { font-weight:500; font-size:10.5px; color:var(--soft); }
.shelfc { background:var(--card); border:1.5px solid var(--line); box-shadow:0 1px 2px rgba(0,0,0,.04); border-radius:13px; padding:14px; margin-bottom:10px; }
.shead { display:flex; justify-content:space-between; margin-bottom:3px; }
.sbrand { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--soft); }
.ppill { font-size:10px; font-weight:700; text-transform:uppercase; border:1px solid var(--line); border-radius:999px; padding:2px 8px; color:var(--soft); }
.sname { font-family:'Fraunces',serif; font-weight:600; font-size:15.5px; margin-bottom:3px; }
.smatch { font-size:11.5px; color:var(--primary); font-weight:700; margin-bottom:5px; }
.ev { display:inline-block; font-size:10.5px; font-weight:700; border-radius:999px; padding:3px 9px; margin-bottom:8px; }
.ev-strong { background:#E7EFE9; color:#43604F; } .ev-mixed { background:#FBEEE2; color:#A15E22; } .ev-comfort { background:#EDE7EF; color:#6E6076; }
.sfoot { display:flex; justify-content:space-between; align-items:center; font-size:13px; gap:8px; }
.sbtn { border:1px solid var(--primary); background:none; color:var(--primary); border-radius:999px; padding:7px 14px; font:700 12px 'Karla'; cursor:pointer; }
.loglines { background:var(--card); border:1.5px solid var(--line); border-radius:13px; padding:12px; font-family:ui-monospace,monospace; font-size:11px; line-height:1.7; }
.logline.money { color:#43604F; font-weight:700; } .logline.bad { color:#A04545; font-weight:700; }
.swatches { display:flex; gap:6px; margin-top:8px; }
.swatch { width:22px; height:22px; border-radius:6px; border:1px solid var(--line); }
.phasecard { display:flex; gap:14px; align-items:center; background:var(--card); border:1.5px solid var(--line); box-shadow:0 1px 2px rgba(0,0,0,.04); border-radius:13px; padding:13px 15px; margin-bottom:14px; }
.phaseday { font-family:'Fraunces',serif; font-weight:600; font-size:21px; color:var(--primary); white-space:nowrap; }
.phaseinfo { display:flex; flex-direction:column; gap:2px; font-size:13px; }
.phaseinfo span { color:var(--soft); font-size:12.5px; line-height:1.45; }
.readcard { background:color-mix(in srgb, var(--primary) 10%, var(--card)); border:1.5px solid color-mix(in srgb, var(--primary) 25%, var(--line)); border-radius:13px; padding:14px; margin-top:14px; }
.calgrid { display:grid; grid-template-columns:repeat(7,1fr); gap:5px; margin-bottom:10px; }
.calhead { text-align:center; font-size:10.5px; font-weight:700; color:var(--soft); padding:2px 0; }
.calcell { position:relative; aspect-ratio:1; display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:600; border-radius:10px; background:var(--card); border:1.5px solid var(--line); color:var(--ink); cursor:pointer; }
.c-period { background:var(--primary); border-color:var(--primary); color:#FFF; font-weight:700; }
.c-pred { background:color-mix(in srgb, var(--primary) 18%, var(--card)); border-style:dashed; border-color:var(--primary); color:var(--primary); font-weight:700; }
.c-fert { background:color-mix(in srgb, var(--accent) 22%, var(--card)); border-color:var(--accent); }
.c-today { outline:2px solid var(--ink); outline-offset:1px; }
.callegend { display:flex; flex-wrap:wrap; gap:10px; font-size:11.5px; color:var(--soft); margin-bottom:12px; }
.callegend .dot { display:inline-block; width:10px; height:10px; border-radius:3px; margin-right:4px; vertical-align:-1px; }
.d-period { background:var(--primary); } .d-pred { background:color-mix(in srgb, var(--primary) 25%, var(--card)); border:1px dashed var(--primary); } .d-fert { background:color-mix(in srgb, var(--accent) 35%, var(--card)); }
.pregband { display:flex; gap:14px; align-items:center; background:var(--card); border:1.5px solid var(--line); box-shadow:0 1px 2px rgba(0,0,0,.04); border-radius:13px; padding:14px 15px; margin-bottom:8px; }
.pregweek { font-family:'Fraunces',serif; font-weight:600; font-size:22px; color:var(--primary); white-space:nowrap; }
.pregmeta { display:flex; flex-direction:column; gap:2px; font-size:13px; }
.pregmeta span { color:var(--soft); font-size:12.5px; }
.pregbar { height:8px; background:color-mix(in srgb, var(--ink) 8%, var(--paper)); border-radius:4px; overflow:hidden; margin-bottom:14px; }
.pregfill { height:100%; background:linear-gradient(90deg,var(--accent),var(--primary)); }
.kickrow { display:flex; gap:10px; align-items:stretch; margin-bottom:12px; }
.kickcount { display:flex; flex-direction:column; align-items:center; justify-content:center; background:var(--card); border:1px solid var(--line); border-radius:13px; padding:6px 16px; }
.kickcount b { font-family:'Fraunces',serif; font-size:20px; color:var(--primary); } .kickcount span { font-size:10.5px; color:var(--soft); }
.inp { width:100%; border:1.5px solid var(--line); background:var(--card); border-radius:11px; padding:11px 13px; font:500 13.5px 'Karla'; color:var(--ink); margin-bottom:9px; }
.splash { padding-top:46px; text-align:left; }
.splashmark { font-family:'Fraunces',serif; font-weight:600; font-size:44px; }
.splashmark span { color:var(--primary); }
.splashtag { font-size:12px; font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:var(--primary); margin-top:2px; }
.ghostbtn { width:100%; border:1px solid var(--primary); background:none; color:var(--primary); border-radius:13px; font:700 14px 'Karla'; padding:13px; margin-top:10px; cursor:pointer; }
.consentcard { background:var(--card); border:1.5px solid var(--line); border-radius:13px; padding:14px; font-size:13px; margin-bottom:12px; }
.consentopt { display:flex; gap:11px; width:100%; text-align:left; border:1.5px solid var(--line); background:var(--card); border-radius:13px; padding:13px; font:400 12.5px 'Karla'; color:var(--ink); line-height:1.5; cursor:pointer; }
.consentopt.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 7%, var(--card)); }
.ckbox { flex-shrink:0; width:22px; height:22px; border:2px solid var(--primary); border-radius:7px; display:flex; align-items:center; justify-content:center; font-weight:700; color:var(--primary); }
.acctchip { font-size:11px; font-weight:700; color:var(--ink); border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:6px 11px; margin-right:6px; }
.stagechip { border:1.5px solid var(--line); background:var(--card); color:var(--primary); border-radius:999px; padding:6px 12px; font:700 11.5px 'Karla'; cursor:pointer; }
.obwrap { padding-top:14px; }
.obq { font-family:'Fraunces',serif; font-weight:600; font-size:20px; margin:6px 0 14px; }
.obopts { display:grid; gap:9px; margin-bottom:18px; }
.obopt { border:1.5px solid var(--line); background:var(--card); box-shadow:0 1px 2px rgba(0,0,0,.05); border-radius:13px; padding:14px; text-align:left; font:500 14.5px 'Karla'; color:var(--ink); cursor:pointer; }
.obopt:active { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 8%, var(--card)); }
.obdots { display:flex; gap:6px; margin-bottom:16px; }
.obdots span { width:8px; height:8px; border-radius:50%; background:var(--line); }
.obdots span.on { background:var(--primary); }
.c-log { position:absolute; top:3px; right:4px; width:5px; height:5px; border-radius:50%; background:var(--accent); }
.c-period .c-log { background:#FFF; }
.linkbtn { border:none; background:none; color:var(--primary); font:700 12.5px 'Karla'; text-decoration:underline; cursor:pointer; padding:0; }
.c-wk { border-color:var(--accent); }
.c-wklab { position:absolute; bottom:2px; font-size:7.5px; font-weight:700; color:var(--accent); }
.d-logdot { background:var(--accent); border-radius:50%; }
.section-lab { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--soft); margin:14px 0 7px; }
.disclosure { width:100%; display:flex; justify-content:space-between; align-items:center; border:1.5px solid var(--line); background:var(--card); border-radius:13px; padding:13px 15px; font:700 13px 'Karla'; color:var(--ink); cursor:pointer; margin:14px 0 0; }
.bodypanel { border:1.5px solid var(--line); border-top:none; border-radius:0 0 13px 13px; background:var(--card); padding:4px 15px 14px; }
.wrapchips { display:flex; flex-wrap:wrap; gap:7px; }
.minichip { border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:7px 13px; font:500 12.5px 'Karla'; color:var(--ink); cursor:pointer; }
.minichip.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 12%, var(--card)); color:var(--primary); font-weight:700; }
.scalerow { margin-bottom:12px; }
.scalehead { display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:3px; }
.scalehead b { font-family:'Fraunces',serif; color:var(--primary); font-size:15px; }
.slider { width:100%; accent-color:var(--primary); }
.scaleends { display:flex; justify-content:space-between; font-size:11px; color:var(--soft); }
.meter { border:2px solid var(--line); box-shadow:0 1px 3px rgba(0,0,0,.06); background:var(--card); border-radius:13px; padding:12px 14px; margin-bottom:14px; transition:border-color .3s; }
.meterhead { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:7px; }
.meterlabel { font-family:'Fraunces',serif; font-weight:600; font-size:16px; }
.meterval { font-family:'Fraunces',serif; font-weight:600; font-size:20px; transition:color .3s; }
.metertrack { height:11px; background:color-mix(in srgb, var(--ink) 14%, var(--card)); border-radius:5px; overflow:hidden; }
.meterfill { height:100%; border-radius:5px; transition:width .3s ease, background .3s; }
.meterends { display:flex; justify-content:space-between; font-size:10.5px; color:var(--soft); margin-top:3px; }
.gradlegend { display:flex; align-items:center; gap:8px; font-size:11px; color:var(--soft); margin-bottom:12px; }
.gradbar { flex:1; height:7px; border-radius:4px; }
.c-per-mark { position:absolute; bottom:3px; width:5px; height:5px; border-radius:50%; background:var(--primary); box-shadow:0 0 0 1.5px rgba(255,255,255,.7); }
.d-permark { background:var(--primary); border-radius:50%; }
.scorepill { float:right; font-size:10px; font-weight:700; color:#FFF; border-radius:999px; padding:3px 9px; }
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
.lab { font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--soft); margin:16px 0 8px; }
.labErr { color:#B4462F; }
.need { color:#B4462F; font-weight:700; }
.mcrow { display:flex; flex-wrap:wrap; gap:8px; }
.mc { border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:9px 15px; font:500 13px 'Karla'; color:var(--ink); cursor:pointer; }
.mc.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 12%, var(--card)); color:var(--primary); font-weight:700; }
.err .mc, .err .stagecard { border-color:#E0A99B; }
.inpErr { border-color:#C4573B !important; background:#FBEEEA !important; }
.errhint { font-size:12.5px; color:#B4462F; line-height:1.5; margin:14px 0 0; background:#FBEEEA; border:1.5px solid #E7C3B8; border-radius:11px; padding:11px 13px; }
.regcards { display:grid; gap:9px; }
.stagecard { display:flex; flex-direction:column; align-items:flex-start; gap:2px; border:1.5px solid var(--line); background:var(--card); border-radius:13px; padding:13px 15px; cursor:pointer; text-align:left; }
.stagecard.on { border-color:var(--primary); background:color-mix(in srgb, var(--primary) 8%, var(--card)); }
.stagecard b { font-family:'Fraunces',serif; font-size:16px; color:var(--ink); } .stagecard.on b { color:var(--primary); }
.stagecard span { font-size:12px; color:var(--soft); }
.nav { display:flex; gap:10px; margin-top:20px; }
.back { border:1.5px solid var(--line); background:var(--card); color:var(--ink); border-radius:13px; padding:14px 20px; font:700 14px 'Karla'; cursor:pointer; }
.nav .cta { flex:1; }
.plaincard { background:var(--card); border:1.5px solid var(--line); border-radius:13px; padding:14px 16px; margin-bottom:6px; box-shadow:0 1px 2px rgba(0,0,0,.04); }
.plain { font-size:14px; line-height:1.6; margin:0 0 10px; }
.plain:last-child { margin-bottom:0; }
.script { font-size:14px; line-height:1.6; margin:0 0 12px; padding-left:12px; border-left:3px solid var(--primary); color:var(--ink); }
.script:last-child { margin-bottom:0; }
.homehead { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; }
.greet { font-family:'Fraunces',serif; font-weight:440; font-size:26px; line-height:1.1; }
.greetsub { font-size:13px; color:var(--soft); margin-top:4px; }
.streak { display:flex; flex-direction:column; align-items:center; background:var(--card); border:1.5px solid var(--line); border-radius:13px; padding:8px 14px; min-width:70px; }
.streak b { font-family:'Fraunces',serif; font-size:22px; color:var(--primary); line-height:1; } .streak span { font-size:10px; color:var(--soft); margin-top:2px; }
.nextrow { display:flex; gap:12px; align-items:flex-start; padding:10px 0; border-top:1.5px solid var(--line); }
.nextrow:first-child { border-top:none; }
.nextdot { flex-shrink:0; width:9px; height:9px; border-radius:50%; background:var(--accent); margin-top:5px; }
.nexttext { font-size:14px; } .nextsub { font-size:12px; color:var(--soft); margin-top:2px; } .nextsub.link { color:var(--primary); font-weight:700; }
.pulse { background:color-mix(in srgb, var(--primary) 9%, var(--card)); border:1.5px solid color-mix(in srgb, var(--primary) 25%, var(--line)); border-radius:13px; padding:12px 16px; }
.pulserow { display:flex; gap:12px; align-items:baseline; padding:6px 0; }
.pulserow b { font-family:'Fraunces',serif; font-size:22px; color:var(--primary); min-width:72px; } .pulserow span { font-size:13.5px; }
.recaprow { display:flex; justify-content:space-between; padding:9px 0; border-top:1.5px solid var(--line); font-size:13.5px; }
.recaprow:first-child { border-top:none; margin-top:8px; } .recaprow b { font-weight:700; }
.up { color:#43604F; font-weight:700; margin-left:4px; } .down { color:#A04545; font-weight:700; margin-left:4px; } .flat { color:var(--soft); font-weight:500; margin-left:4px; }
.medrow { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:10px 0; border-top:1.5px solid var(--line); }
.medinfo { display:flex; flex-direction:column; gap:2px; } .medinfo b { font-size:14px; } .medinfo span { font-size:12px; color:var(--soft); }
.medeff { color:var(--primary) !important; font-weight:700; } .medeff.muted { color:var(--soft) !important; font-weight:500; }
.takebtn { flex-shrink:0; border:1.5px solid var(--line); background:var(--card); border-radius:999px; padding:8px 13px; font:700 12px 'Karla'; color:var(--ink); cursor:pointer; }
.takebtn.on { border-color:var(--primary); background:var(--primary); color:#FFF; }
.jentry { border-top:1.5px solid var(--line); padding:10px 0; } .jentry b { font-size:12px; color:var(--soft); } .jentry p { margin:4px 0 0; font-size:13.5px; line-height:1.55; white-space:pre-wrap; }
.orline { display:flex; align-items:center; gap:10px; margin:14px 0 10px; font-size:11.5px; color:var(--soft); text-transform:uppercase; letter-spacing:.07em; }
.orline::before, .orline::after { content:""; flex:1; height:1.5px; background:var(--line); }
.social { display:grid; gap:8px; }
.socialbtn { display:flex; align-items:center; justify-content:center; gap:9px; border:1.5px solid var(--line); background:var(--card); border-radius:13px; padding:12px; font:700 14px 'Karla'; color:var(--ink); cursor:pointer; }
.socialbtn:disabled { opacity:.6; }
.socialdot { width:12px; height:12px; border-radius:50%; }
.mstrip { display:grid; gap:7px; }
.ms { display:flex; align-items:center; gap:10px; background:var(--card); border:1.5px solid var(--line); border-radius:11px; padding:9px 12px; font-size:13px; color:var(--soft); }
.ms.done { color:var(--ink); border-color:color-mix(in srgb, var(--primary) 35%, var(--line)); }
.msdot { flex-shrink:0; width:20px; height:20px; border-radius:50%; border:2px solid var(--line); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; }
.ms.done .msdot { background:var(--primary); border-color:var(--primary); color:#FFF; }
.mslabel { flex:1; }
.msbar { width:56px; height:6px; background:color-mix(in srgb, var(--ink) 12%, var(--card)); border-radius:3px; overflow:hidden; }
.msbar i { display:block; height:100%; background:var(--primary); }
/* ---- accessibility ---- */
@media (prefers-reduced-motion: reduce) { .cy * { transition:none !important; animation:none !important; } }
button:focus-visible, input:focus-visible, textarea:focus-visible, [tabindex]:focus-visible { outline:3px solid var(--primary); outline-offset:2px; border-radius:8px; }
.tab { min-height:44px; padding:12px 10px; }
.mc, .pill, .takebtn, .sbtn, .orgbtn, .stagechip, .topbtn, .linkbtn, .ghost, .route { min-height:44px; }
.minichip { min-height:40px; }
.sdot.on, .c-per-mark { outline:1.5px solid rgba(0,0,0,.35); }
.toast { position:fixed; left:50%; transform:translateX(-50%); bottom:20px; background:var(--ink); color:#FFF; font-size:13px; padding:9px 16px; border-radius:999px; max-width:86%; text-align:center; z-index:9; }
`;
