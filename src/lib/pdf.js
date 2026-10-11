/* A minimal PDF 1.4 writer for the POTS clinician report (design 6.2, owner decision D5).
   No dependency, no network, no font file: it uses the two base-14 fonts every PDF reader
   has (Helvetica and Helvetica-Bold, WinAnsiEncoding), so nothing is embedded and the file
   is built entirely on the device. Loaded only from the export handler
   (`await import("./lib/pdf.js")`), so it is its own chunk and costs nothing until used.

   What it can draw: text (with real glyph widths, so wrapping and tables fit), lines (solid
   or dashed), rectangles, polylines and wrapped tables with automatic page breaks and a
   repeated header row. Coordinates are in points from the TOP-left corner of the page
   (y grows downwards); the writer converts to PDF's bottom-left origin.

   Text is WinAnsi only. winAnsi() maps a few common symbols to plain text (≥ -> ">="), strips
   emoji and turns anything else outside WinAnsi into "?". The screen warns when that will
   happen, and the spreadsheet keeps the exact text. The PDF is untagged; the on-screen
   preview and the CSV are its accessible equivalents (Q8).

   Output is deterministic: no creation date, no random ids, so the same model gives the same
   bytes (unit-tested). */

/* Adobe Core14 AFM advance widths (units per 1000 em) for WinAnsi codes 32-255 (the same
   numbers as Helvetica.afm and Helvetica-Bold.afm; the five unassigned WinAnsi codes carry the
   bullet width, which winAnsi() never produces). */
const HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 350, 556, 350, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 350, 611, 350, 350, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 350, 500, 667, 278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611, 667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, 556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500];
const HELVB = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 350, 556, 350, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 350, 611, 350, 350, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 350, 500, 667, 278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, 611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556];

/* Unicode -> WinAnsi for the 27 characters WinAnsi places in 0x80-0x9F. Latin-1 (0xA0-0xFF)
   maps to itself. */
const CP1252 = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89,
  0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};
/* Plain-text stand-ins for symbols the report or her typing may use. */
const SUBS = { "≥": ">=", "≤": "<=", "→": "->", "←": "<-", "≈": "~", "✓": "yes", "✔": "yes", "×": "x", "−": "-", "‑": "-", "‐": "-" };
const SPACES = /[\t\n\r\f\v -   　]/g;
// Emoji and their joiners, variation selectors, skin tones, keycaps and flags are left out.
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}‍︎️⃣]/gu;

/** `str` as WinAnsi: a JS string whose every character code is one WinAnsi byte (32-255).
    Known symbols become plain text, emoji are removed, other characters outside WinAnsi
    become "?". Keeps – — · ° ' " ½ ¼. */
export function winAnsi(str) {
  const s = String(str ?? "").replace(/[≥≤→←≈✓✔×−‑‐]/g, (c) => SUBS[c]).replace(SPACES, " ").replace(EMOJI, "");
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c >= 32 && c <= 126) out += ch;
    else if (c >= 0xa0 && c <= 0xff) out += ch;
    else if (CP1252[c]) out += String.fromCharCode(CP1252[c]);
    else if (c < 32 || c === 127 || (c >= 0x80 && c < 0xa0)) continue; // control characters
    else out += "?";
  }
  return out;
}
const widthOf = (enc, size, bold) => {
  const t = bold ? HELVB : HELV;
  let w = 0;
  for (let i = 0; i < enc.length; i++) w += t[enc.charCodeAt(i) - 32] ?? 556;
  return (w * size) / 1000;
};
/** Width in points of `str` (Unicode, encoded with winAnsi) at `size`, Helvetica or Helvetica-Bold. */
export const textWidth = (str, size = 10, bold = false) => widthOf(winAnsi(str), size, bold);

/** Split `str` into lines no wider than `w` points: on spaces, and inside a word only when the
    word alone is wider than the line. Returns encoded (WinAnsi) lines. */
function wrapEnc(enc, w, size, bold) {
  const out = [];
  for (const para of enc.split("\u0000")) {
    const words = para.split(" ");
    let line = "";
    const push = () => { out.push(line); line = ""; };
    for (const word0 of words) {
      let word = word0;
      const tryLine = line ? `${line} ${word}` : word;
      if (widthOf(tryLine, size, bold) <= w) { line = tryLine; continue; }
      if (line) push();
      while (widthOf(word, size, bold) > w && word.length > 1) {
        let n = word.length - 1;
        while (n > 1 && widthOf(word.slice(0, n), size, bold) > w) n--;
        out.push(word.slice(0, n));
        word = word.slice(n);
      }
      line = word;
    }
    out.push(line);
  }
  return out;
}
/** `str` wrapped to `w` points (Unicode in, WinAnsi-encoded lines out). Line breaks in `str` are kept. */
export const wrapLines = (str, w, size = 10, bold = false) => wrapEnc(String(str ?? "").split(/\r?\n/).map(winAnsi).join("\u0000"), w, size, bold);

const PAPER = { letter: [612, 792], a4: [595.28, 841.89] };
const n2 = (x) => { const r = Math.round(x * 100) / 100; return Object.is(r, -0) ? "0" : String(r); };
const esc = (s) => s.replace(/[\\()]/g, (c) => `\\${c}`);
/** [r, g, b] in 0-255 (or 0-1) -> "r g b" for PDF operators. */
const col = (c) => (Array.isArray(c) ? c.map((v) => n2(v > 1 ? v / 255 : v)).join(" ") : "0 0 0");

export class PdfDoc {
  /** paper: "letter" | "a4". margin: points on every side; the bottom keeps room for the footer. */
  constructor({ paper = "a4", margin = 40, bottom = 52 } = {}) {
    [this.W, this.H] = PAPER[paper] || PAPER.a4;
    this.margin = margin;
    this.top = margin;
    this.bottom = this.H - bottom; // the lowest y body content may reach
    this.pages = [];
    this.cur = null;
    this.footerFn = null;
  }
  /** Start a new page; drawing goes there. */
  page() { this.cur = []; this.pages.push(this.cur); return this; }
  op(s) { if (!this.cur) this.page(); this.cur.push(s); }
  /** y (from the top) to continue at: `y` itself if `need` points still fit on this page,
      else the top of a new page. */
  ensure(y, need) { if (!this.cur) this.page(); if (y + need <= this.bottom) return y; this.page(); return this.top; }
  /** One line of text with its baseline at y. align: "left" | "center" | "right" (x is that edge or the centre). */
  text(x, y, str, { size = 10, bold = false, rgb = null, align = "left" } = {}) {
    const enc = winAnsi(str);
    if (!enc) return this;
    const w = widthOf(enc, size, bold), x0 = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    this.op(`BT /${bold ? "F2" : "F1"} ${n2(size)} Tf ${col(rgb)} rg ${n2(x0)} ${n2(this.H - y)} Td (${esc(enc)}) Tj ET`);
    return this;
  }
  /** Wrapped text in a box `w` wide whose first baseline is at y; breaks pages as needed.
      Returns the y for whatever comes next (one line-gap below the last line). */
  wrap(x, y, w, str, { size = 10, bold = false, rgb = null, gap = 1.35 } = {}) {
    const lh = size * gap;
    let yy = y;
    for (const line of wrapLines(str, w, size, bold)) {
      yy = this.ensure(yy, lh * 0.3);
      if (line) this.op(`BT /${bold ? "F2" : "F1"} ${n2(size)} Tf ${col(rgb)} rg ${n2(x)} ${n2(this.H - yy)} Td (${esc(line)}) Tj ET`);
      yy += lh;
    }
    return yy;
  }
  line(x1, y1, x2, y2, { dash = null, width = 0.75, rgb = null } = {}) {
    this.op(`q ${n2(width)} w ${col(rgb)} RG ${dash ? `[${dash.map(n2).join(" ")}] 0 d ` : ""}${n2(x1)} ${n2(this.H - y1)} m ${n2(x2)} ${n2(this.H - y2)} l S Q`);
    return this;
  }
  /** Rectangle with its top-left corner at (x, y). fill / stroke: [r, g, b] or null. */
  rect(x, y, w, h, { fill = null, stroke = null, width = 0.75 } = {}) {
    if (!fill && !stroke) return this;
    const paint = fill && stroke ? "B" : fill ? "f" : "S";
    this.op(`q ${n2(width)} w ${fill ? `${col(fill)} rg ` : ""}${stroke ? `${col(stroke)} RG ` : ""}${n2(x)} ${n2(this.H - y - h)} ${n2(w)} ${n2(h)} re ${paint} Q`);
    return this;
  }
  /** Open polyline through [[x, y], ...]. */
  poly(points, { rgb = null, width = 1.5, dash = null } = {}) {
    if (!points || points.length < 2) return this;
    const path = points.map(([x, y], i) => `${n2(x)} ${n2(this.H - y)} ${i ? "l" : "m"}`).join(" ");
    this.op(`q ${n2(width)} w 1 J 1 j ${col(rgb)} RG ${dash ? `[${dash.map(n2).join(" ")}] 0 d ` : ""}${path} S Q`);
    return this;
  }
  /** Filled dot (a small square-ish circle drawn with four Bézier curves). */
  dot(x, y, r, { rgb = null } = {}) {
    const k = 0.5523 * r, X = x, Y = this.H - y;
    this.op(`q ${col(rgb)} rg ${n2(X + r)} ${n2(Y)} m ${n2(X + r)} ${n2(Y + k)} ${n2(X + k)} ${n2(Y + r)} ${n2(X)} ${n2(Y + r)} c ${n2(X - k)} ${n2(Y + r)} ${n2(X - r)} ${n2(Y + k)} ${n2(X - r)} ${n2(Y)} c ${n2(X - r)} ${n2(Y - k)} ${n2(X - k)} ${n2(Y - r)} ${n2(X)} ${n2(Y - r)} c ${n2(X + k)} ${n2(Y - r)} ${n2(X + r)} ${n2(Y - k)} ${n2(X + r)} ${n2(Y)} c f Q`);
    return this;
  }
  /** A table at (x, y): cols [{ label, w }] (w in points), rows [[cell text]]. Cells wrap;
      a row that doesn't fit starts a new page, where the header row is drawn again.
      Returns the y below the table. */
  table(x, y, cols, rows, { size = 8, pad = 3, head = true, headFill = [236, 236, 236], rule = [190, 190, 190] } = {}) {
    const lh = size * 1.25, total = cols.reduce((a, c) => a + c.w, 0);
    const cellLines = (cells, bold) => cols.map((c, i) => wrapLines(cells[i] ?? "", c.w - 2 * pad, size, bold));
    const drawRow = (yy, lines, bold, fill) => {
      const h = Math.max(1, ...lines.map((l) => l.length)) * lh + 2 * pad;
      if (fill) this.rect(x, yy, total, h, { fill });
      let cx = x;
      lines.forEach((ls, i) => {
        ls.forEach((l, j) => { if (l) this.op(`BT /${bold ? "F2" : "F1"} ${n2(size)} Tf 0 0 0 rg ${n2(cx + pad)} ${n2(this.H - (yy + pad + size + j * lh - 1))} Td (${esc(l)}) Tj ET`); });
        cx += cols[i].w;
      });
      this.line(x, yy + h, x + total, yy + h, { rgb: rule, width: 0.5 });
      return yy + h;
    };
    const headLines = head ? cellLines(cols.map((c) => c.label), true) : null;
    const headH = head ? Math.max(1, ...headLines.map((l) => l.length)) * lh + 2 * pad : 0;
    let yy = this.ensure(y, headH + lh + 2 * pad);
    if (head) yy = drawRow(yy, headLines, true, headFill);
    for (const r of rows) {
      const lines = cellLines(r, false);
      const h = Math.max(1, ...lines.map((l) => l.length)) * lh + 2 * pad;
      if (yy + h > this.bottom) { this.page(); yy = this.top; if (head) yy = drawRow(yy, headLines, true, headFill); }
      yy = drawRow(yy, lines, false, null);
    }
    return yy;
  }
  /** fn(pageNo, pageCount, doc) draws on each page when the file is assembled (page numbers). */
  footer(fn) { this.footerFn = fn; return this; }

  /** The finished file as bytes. */
  bytes() {
    if (!this.pages.length) this.page();
    if (this.footerFn) {
      const n = this.pages.length;
      this.pages.forEach((p, i) => { this.cur = p; this.footerFn(i + 1, n, this); });
    }
    const objs = []; // index = object number - 1
    const pageNums = this.pages.map((_, i) => 6 + i * 2);
    objs[0] = "<< /Type /Catalog /Pages 2 0 R >>";
    objs[1] = `<< /Type /Pages /Kids [${pageNums.map((k) => `${k} 0 R`).join(" ")}] /Count ${this.pages.length} >>`;
    objs[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    // A neutral title (the file name is neutral too): a file list or preview never names a condition.
    objs[4] = "<< /Producer (Cyra) /Title (Cyra report) >>";
    this.pages.forEach((ops, i) => {
      const stream = ops.join("\n");
      objs[pageNums[i] - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n2(this.W)} ${n2(this.H)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageNums[i] + 1} 0 R >>`;
      objs[pageNums[i]] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });
    let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
    const offsets = [];
    objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
}
