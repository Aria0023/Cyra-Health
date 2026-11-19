/* A test photo made here, in memory (nothing is downloaded): a PNG of a plate with three blobs of "food" on a table,
   for the Meal photos specs. Returns what Playwright's setInputFiles takes. */
import zlib from "node:zlib";

const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type, "latin1"), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]); };

export function platePng(w = 1600, h = 1200) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.42;
  const blobs = [[cx - R * 0.35, cy - R * 0.15, R * 0.34, [236, 228, 205]], [cx + R * 0.32, cy - R * 0.2, R * 0.3, [176, 112, 60]], [cx + R * 0.02, cy + R * 0.42, R * 0.3, [96, 150, 78]]];
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1); raw[row] = 0;
    for (let x = 0; x < w; x++) {
      let c = [150 + ((x + y) % 23), 118 + ((x * 3 + y) % 17), 92]; // a wooden table
      const d = Math.hypot(x - cx, y - cy);
      if (d < R) c = d > R * 0.9 ? [228, 230, 233] : [248, 248, 246]; // the plate and its rim
      for (const [bx, by, br, col] of blobs) if (Math.hypot(x - bx, y - by) < br) c = [col[0] + ((x * 7 + y * 3) % 13), col[1] + ((x + y * 5) % 11), col[2]];
      const o = row + 1 + x * 3; raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2];
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
export const plateFile = (w, h) => ({ name: "IMG_4021.png", mimeType: "image/png", buffer: platePng(w, h) });
