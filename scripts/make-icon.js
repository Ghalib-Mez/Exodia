'use strict';

// Generates assets/icon.ico — a purple lightning-bolt icon at sizes
// 16/32/48/64/128/256 (electron-builder requires a 256x256 entry).
// Pure Node (zlib + a hand-rolled PNG encoder wrapped in an ICO container).

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZES = [16, 32, 48, 64, 128, 256];

// --- render pixel data for one size ------------------------------------
function render(size) {
  const s = size / 64; // geometry is authored on a 64px grid
  const px = Buffer.alloc(size * size * 4);

  function setPx(x, y, r, g, b, a = 255) {
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  }

  const edgeLimit = (units) => Math.max(1, Math.round(units * s));

  // dark rounded-square background with subtle vertical gradient
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = y / (size - 1);
      const edge =
        x === 0 || y === 0 || x === size - 1 || y === size - 1 ||
        (x <= edgeLimit(1) && y <= edgeLimit(6)) ||
        (x >= size - 1 - edgeLimit(1) && y <= edgeLimit(6)) ||
        (x <= edgeLimit(6) && y <= edgeLimit(1)) ||
        (x >= size - 1 - edgeLimit(6) && y <= edgeLimit(1)) ||
        (x <= edgeLimit(1) && y >= size - 1 - edgeLimit(6)) ||
        (x >= size - 1 - edgeLimit(1) && y >= size - 1 - edgeLimit(6)) ||
        (x <= edgeLimit(6) && y >= size - 1 - edgeLimit(1)) ||
        (x >= size - 1 - edgeLimit(6) && y >= size - 1 - edgeLimit(1));
      if (edge) continue; // transparent corners -> rounded look
      setPx(x, y, Math.round(16 + 10 * t), Math.round(14 + 8 * t), Math.round(40 + 22 * t));
    }
  }

  // lightning bolt (amber), drawn as filled polygon
  const bolt64 = [
    [34, 6], [20, 34], [29, 34], [24, 58], [46, 26], [35, 26], [42, 6],
  ];
  const bolt = bolt64.map(([x, y]) => [x * s, y * s]);
  function inPoly(pt, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if ((yi > pt[1]) !== (yj > pt[1]) &&
          pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inPoly([x + 0.5, y + 0.5], bolt)) setPx(x, y, 255, 179, 71);
    }
  }
  return px;
}

// --- encode one RGBA buffer as PNG --------------------------------------
function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA

  // raw scanlines with filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- wrap all sizes in one ICO ------------------------------------------
function buildIco() {
  const images = SIZES.map((size) => ({ size, png: encodePng(size, render(size)) }));

  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);                 // reserved
  header.writeUInt16LE(1, 2);                 // type: icon
  header.writeUInt16LE(images.length, 4);     // image count

  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i;
    header[e] = size >= 256 ? 0 : size;       // width (0 = 256)
    header[e + 1] = size >= 256 ? 0 : size;   // height (0 = 256)
    header[e + 2] = 0;                        // palette
    header[e + 3] = 0;                        // reserved
    header.writeUInt16LE(1, e + 4);           // planes
    header.writeUInt16LE(32, e + 6);          // bpp
    header.writeUInt32LE(png.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });

  return Buffer.concat([header, ...images.map(({ png }) => png)]);
}

const out = path.join(__dirname, '..', 'assets', 'icon.ico');
const icon = buildIco();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, icon);
console.log(`Wrote ${out} (${icon.length} bytes, sizes: ${SIZES.join('/')})`);
