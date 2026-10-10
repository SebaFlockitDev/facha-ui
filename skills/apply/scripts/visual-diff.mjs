#!/usr/bin/env node
// facha-ui · visual diff for /facha-ui:apply. No dependencies: PNG is decoded and encoded with zlib.
// Usage: node visual-diff.mjs <before.png> <after.png> <diff.png>
//
// Writes <diff.png>: the "after" capture dimmed, changed pixels in red and the changed regions
// outlined; prints a JSON summary (changed share, regions, size change). It writes only the
// diff image it is given, inside the project's screenshots folder.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Decodes an 8-bit, non-interlaced PNG into RGBA. */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("Not a PNG file");
  let width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  let palette = null, alpha = null;
  const data = [];
  for (let at = 8; at < buf.length; ) {
    const len = buf.readUInt32BE(at);
    const kind = buf.toString("latin1", at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + len);
    if (kind === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      type = body[9];
      interlace = body[12];
    } else if (kind === "PLTE") palette = body;
    else if (kind === "tRNS") alpha = body;
    else if (kind === "IDAT") data.push(body);
    else if (kind === "IEND") break;
    at += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || !(type in CHANNELS)) throw new Error(`Unsupported PNG (depth ${depth}, type ${type}, interlace ${interlace})`);
  const channels = CHANNELS[type];
  const raw = zlib.inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[x] = v & 255;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * channels;
    let r, g, b, a = 255;
    if (type === 0) r = g = b = pixels[s];
    else if (type === 4) { r = g = b = pixels[s]; a = pixels[s + 1]; }
    else if (type === 2) { r = pixels[s]; g = pixels[s + 1]; b = pixels[s + 2]; }
    else if (type === 6) { r = pixels[s]; g = pixels[s + 1]; b = pixels[s + 2]; a = pixels[s + 3]; }
    else { const p = pixels[s]; r = palette[p * 3]; g = palette[p * 3 + 1]; b = palette[p * 3 + 2]; a = alpha && p < alpha.length ? alpha[p] : 255; }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
  }
  return { width, height, data: rgba };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(kind, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(kind, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

/** Encodes RGBA pixels as an 8-bit PNG. */
export function encodePng({ width, height, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/**
 * Compares two captures. Pixels whose channels differ by more than `threshold` count as changed;
 * changed 32px cells are merged into regions.
 */
export function diffImages(before, after, { threshold = 24, cell = 32 } = {}) {
  const width = after.width, height = after.height;
  const w = Math.min(before.width, width), h = Math.min(before.height, height);
  const out = Buffer.alloc(width * height * 4);
  const cols = Math.ceil(width / cell), rows = Math.ceil(height / cell);
  const hits = new Uint32Array(cols * rows);
  let changed = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = after.data[i], g = after.data[i + 1], b = after.data[i + 2];
      let differs = x >= w || y >= h;
      if (!differs) {
        const j = (y * before.width + x) * 4;
        differs = Math.max(Math.abs(r - before.data[j]), Math.abs(g - before.data[j + 1]), Math.abs(b - before.data[j + 2])) > threshold;
      }
      if (differs) {
        changed++;
        hits[Math.floor(y / cell) * cols + Math.floor(x / cell)]++;
        out[i] = 230; out[i + 1] = 40; out[i + 2] = 40; out[i + 3] = 255;
      } else {
        // the unchanged page, faded to grey so the changes stand out
        const grey = Math.round(0.3 * r + 0.59 * g + 0.11 * b);
        const v = Math.round(255 - (255 - grey) * 0.35);
        out[i] = v; out[i + 1] = v; out[i + 2] = v; out[i + 3] = 255;
      }
    }
  }
  // Cells with more than 1% changed pixels, merged with their neighbours into regions.
  const minHits = Math.max(1, Math.round(cell * cell * 0.01));
  const seen = new Uint8Array(cols * rows);
  const regions = [];
  for (let k = 0; k < cols * rows; k++) {
    if (seen[k] || hits[k] < minHits) continue;
    let x0 = cols, y0 = rows, x1 = 0, y1 = 0;
    const stack = [k];
    seen[k] = 1;
    while (stack.length) {
      const c = stack.pop();
      const cx = c % cols, cy = Math.floor(c / cols);
      x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, n = ny * cols + nx;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen[n] || hits[n] < minHits) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    regions.push({ x: x0 * cell, y: y0 * cell, width: Math.min(width, (x1 + 1) * cell) - x0 * cell, height: Math.min(height, (y1 + 1) * cell) - y0 * cell });
  }
  regions.sort((a, b) => b.width * b.height - a.width * a.height);
  // Outline the regions.
  for (const r of regions) {
    for (let x = r.x; x < r.x + r.width; x++) for (const y of [r.y, r.y + 1, r.y + r.height - 2, r.y + r.height - 1]) paint(out, width, height, x, y);
    for (let y = r.y; y < r.y + r.height; y++) for (const x of [r.x, r.x + 1, r.x + r.width - 2, r.x + r.width - 1]) paint(out, width, height, x, y);
  }
  return {
    image: { width, height, data: out },
    summary: {
      before: { width: before.width, height: before.height },
      after: { width, height },
      heightChange: height - before.height,
      changedPixels: changed,
      changedPercent: Math.round((changed / (width * height)) * 1000) / 10,
      regions: regions.slice(0, 10),
    },
  };
}

function paint(out, width, height, x, y) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const i = (y * width + x) * 4;
  out[i] = 190; out[i + 1] = 30; out[i + 2] = 200; out[i + 3] = 255;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [beforeFile, afterFile, outFile] = process.argv.slice(2);
  if (!beforeFile || !afterFile || !outFile || !outFile.endsWith(".png")) {
    process.stderr.write("Usage: node visual-diff.mjs <before.png> <after.png> <diff.png>\n");
    process.exit(2);
  }
  const { image, summary } = diffImages(decodePng(fs.readFileSync(beforeFile)), decodePng(fs.readFileSync(afterFile)));
  fs.writeFileSync(outFile, encodePng(image));
  process.stdout.write(JSON.stringify({ diff: outFile, ...summary }, null, 2) + "\n");
}
