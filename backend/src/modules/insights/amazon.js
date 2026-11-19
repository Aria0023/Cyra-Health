// Amazon Associates earnings report, uploaded by hand (docs/plans/tracking-reports.md Task 3). Amazon has no simple
// reporting API for a new Associates account, so the owner downloads the earnings report (Associates Central → Reports →
// Download reports → Earnings, CSV) and uploads it in the portal. This file only PARSES it: date, items shipped, revenue
// and earnings per row, summed to ONE TOTAL PER DAY. Product names, ASINs, tracking ids and every other column are read
// past and never kept. Business data only; an Associates report holds nothing about any Solia Health user.
//
// The header row is found by name, so a title line above it and extra or reordered columns don't matter:
//   date      "Date Shipped" | "Date"
//   items     "Items Shipped" | "Shipped Items" | "Qty" | "Quantity"      (optional: 0 when the report has none)
//   revenue   "Revenue" | "Revenue($)" | "Shipped Revenue" | "Product Sales"
//   earnings  "Ad Fees" | "Ad Fees($)" | "Earnings" | "Total Earnings" | "Commission"
// VERIFY the column names against a real report from your Associates account before relying on the numbers.
export const AMAZON_CAPS = Object.freeze({ bytes: 1024 * 1024, rows: 20_000, amount: 10_000_000, items: 1_000_000, yearsBack: 5 });
const norm = (s) => String(s || "").toLowerCase().replace(/\(.*?\)|[^a-z]/g, "");
const COLS = Object.freeze({
  date: ["dateshipped", "date"],
  items: ["itemsshipped", "shippeditems", "qty", "quantity"],
  revenue: ["revenue", "shippedrevenue", "productsales"],
  earnings: ["adfees", "earnings", "totalearnings", "commission"],
});

/** One CSV text → rows of cells (quotes, doubled quotes, commas or tabs, CRLF). */
export function csvRows(text, maxRows = AMAZON_CAPS.rows + 50) {
  const s = String(text || "").replace(/^﻿/, "");
  const sep = (s.split(/\r?\n/, 3).join("\n").match(/\t/g) || []).length > (s.split(/\r?\n/, 3).join("\n").match(/,/g) || []).length ? "\t" : ",";
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"' && cell === "") { q = true; continue; }
    if (c === sep) { row.push(cell); cell = ""; continue; }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
      if (rows.length > maxRows) return rows;
      continue;
    }
    cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

/** "2026-11-01", "2026-11-01 00:00:00", "11/01/2026", "November 1, 2026" → "2026-11-01" | null. */
export function reportDay(v) {
  const s = String(v || "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/.exec(s);
  if (!m) { const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); if (us) m = [null, us[3], us[1].padStart(2, "0"), us[2].padStart(2, "0")]; }
  if (!m && /^[A-Za-z]{3,9}\.? \d{1,2},? \d{4}$/.test(s)) { const t = Date.parse(`${s} UTC`); if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10); }
  if (!m) return null;
  const day = `${m[1]}-${m[2]}-${m[3]}`;
  const t = Date.parse(`${day}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === day ? day : null;
}
/** "$1,234.50", "1234.5", "(3.20)", "-3.20" → a number | null. */
export function amount(v) {
  let s = String(v ?? "").trim();
  if (s === "") return 0;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s);
  s = s.replace(/[()$£€\s,]|^-|USD/gi, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}
const cents = (n) => Math.round(n * 100) / 100;

/** CSV text → { days: [{ day, items, revenue, earnings }], rows, skipped, from, to } | { error }. */
export function parseAmazonCsv(text, { nowMs = Date.now() } = {}) {
  if (typeof text !== "string" || !text.trim()) return { error: "the file is empty" };
  if (Buffer.byteLength(text, "utf8") > AMAZON_CAPS.bytes) return { error: "the file is larger than 1 MB" };
  if (/\u0000/.test(text)) return { error: "this isn't a text (CSV) file" };
  const rows = csvRows(text);
  if (rows.length > AMAZON_CAPS.rows + 10) return { error: `the report has more than ${AMAZON_CAPS.rows} rows: download a shorter period` };
  let head = -1, idx = null;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const names = rows[i].map(norm);
    const find = (list) => names.findIndex((n) => list.includes(n));
    const c = { date: find(COLS.date), items: find(COLS.items), revenue: find(COLS.revenue), earnings: find(COLS.earnings) };
    if (c.date >= 0 && c.earnings >= 0 && c.revenue >= 0) { head = i; idx = c; break; }
  }
  if (head < 0) return { error: "no header row found: the report needs Date (or Date Shipped), Revenue and Ad Fees (or Earnings) columns" };
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const oldest = `${Number(today.slice(0, 4)) - AMAZON_CAPS.yearsBack}${today.slice(4)}`;
  const byDay = new Map();
  let used = 0, skipped = 0;
  for (const r of rows.slice(head + 1)) {
    const day = reportDay(r[idx.date]);
    const revenue = amount(r[idx.revenue]), earnings = amount(r[idx.earnings]);
    const itemsRaw = idx.items >= 0 ? amount(r[idx.items]) : 0;
    const items = itemsRaw == null ? null : Math.round(itemsRaw);
    if (!day || day > today || day < oldest || revenue == null || earnings == null || items == null || Math.abs(revenue) > AMAZON_CAPS.amount || Math.abs(earnings) > AMAZON_CAPS.amount || Math.abs(items) > AMAZON_CAPS.items) { skipped++; continue; }
    const d = byDay.get(day) || { day, items: 0, revenue: 0, earnings: 0 };
    d.items += items; d.revenue = cents(d.revenue + revenue); d.earnings = cents(d.earnings + earnings);
    byDay.set(day, d); used++;
  }
  if (!used) return { error: "no row could be read: check that the Date, Revenue and Ad Fees columns hold dates and amounts" };
  const days = [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
  return { days, rows: used, skipped, from: days[0].day, to: days.at(-1).day };
}

/** stored day rows → totals from `since` on. */
export function amazonTotals(days, since) {
  const t = { items: 0, revenue: 0, earnings: 0, days: 0 };
  for (const d of days || []) if (d.day >= since) { t.items += d.items; t.revenue = cents(t.revenue + d.revenue); t.earnings = cents(t.earnings + d.earnings); t.days++; }
  return t;
}
