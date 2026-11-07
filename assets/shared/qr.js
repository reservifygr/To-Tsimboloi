// Minimal QR Code generator (byte mode, error-correction level M, versions 1-10), no dependencies.
// Algorithm follows the public ISO/IEC 18004 structure (finder/timing/alignment patterns, Reed-Solomon over GF(256),
// 8 mask patterns scored by penalty rules). Output: a boolean matrix. ALWAYS scan a printed QR with a phone before
// putting it on tables: see README.

// Version table for level M (versions 1..10): [ecc codewords per block, number of blocks]
const ECC_M = [null, [10, 1], [16, 1], [26, 1], [18, 2], [24, 2], [16, 4], [18, 4], [22, 4], [22, 5], [26, 5]];
// Level H (~30% damage tolerated): needed when a logo covers the centre of the code.
const ECC_H = [null, [17, 1], [28, 1], [22, 2], [16, 4], [22, 4], [28, 4], [26, 5], [26, 6], [24, 8], [28, 8]];
const ECC = { M: ECC_M, H: ECC_H };
const LEVEL_BITS = { M: 0b00, H: 0b10 };
const TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

// GF(256) with primitive polynomial 0x11D
const EXP = new Array(512);
const LOG = new Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gmul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

export function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gmul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly; // highest degree first, leading 1
}

/** Reed-Solomon remainder (the ecc codewords) of `data` for `degree` ecc symbols. */
export function rsRemainder(data, degree) {
  const gen = rsGenerator(degree);
  const rem = new Array(degree).fill(0);
  for (const b of data) {
    const factor = b ^ rem.shift();
    rem.push(0);
    for (let i = 0; i < degree; i++) rem[i] ^= gmul(gen[i + 1], factor);
  }
  return rem;
}

function dataCapacityBytes(version, level = 'M') {
  const [eccPer, blocks] = ECC[level][version];
  const dataCw = TOTAL_CODEWORDS[version] - eccPer * blocks;
  const lenBits = version < 10 ? 8 : 16;
  return Math.floor((dataCw * 8 - 4 - lenBits) / 8);
}

function pickVersion(len, level = 'M') {
  for (let v = 1; v <= 10; v++) if (len <= dataCapacityBytes(v, level)) return v;
  throw new RangeError('Text too long for this minimal QR encoder (max ~213 bytes)');
}

function buildCodewords(bytes, version, level = 'M') {
  const [eccPer, blocks] = ECC[level][version];
  const dataCw = TOTAL_CODEWORDS[version] - eccPer * blocks;
  const bits = [];
  const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4); // byte mode
  put(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const cap = dataCw * 8;
  put(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  // Split into blocks (short blocks first, then long blocks get +1)
  const shortLen = Math.floor(dataCw / blocks);
  const numLong = dataCw % blocks;
  const dBlocks = [];
  let pos = 0;
  for (let b = 0; b < blocks; b++) {
    const len = shortLen + (b >= blocks - numLong ? 1 : 0);
    dBlocks.push(data.slice(pos, pos + len));
    pos += len;
  }
  const eBlocks = dBlocks.map((d) => rsRemainder(d, eccPer));
  const out = [];
  for (let i = 0; i < shortLen + 1; i++) for (const d of dBlocks) if (i < d.length) out.push(d[i]);
  for (let i = 0; i < eccPer; i++) for (const e of eBlocks) out.push(e[i]);
  return { codewords: out, dBlocks, eBlocks, eccPer };
}

function makeMatrix(size) {
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const f = Array.from({ length: size }, () => new Array(size).fill(false));
  return { m, f };
}

function setFn(g, x, y, dark) { g.m[y][x] = dark; g.f[y][x] = true; }

function drawFinder(g, cx, cy) {
  const n = g.m.length;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= n || y >= n) continue;
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    setFn(g, x, y, d !== 2 && d !== 4);
  }
}

function drawAlign(g, cx, cy) {
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(g, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
}

function bch(value, poly, bitsLen, msbShift) {
  let rem = value << msbShift;
  for (let i = bitsLen - 1; i >= msbShift; i--) if ((rem >>> i) & 1) rem ^= poly << (i - msbShift);
  return rem;
}

function formatBits(mask, level = 'M') {
  const data = (LEVEL_BITS[level] << 3) | mask; // ECC indicator: M = 00, H = 10
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function versionBits(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

function drawFormat(g, mask, level = 'M') {
  const n = g.m.length;
  const bits = formatBits(mask, level);
  const bit = (i) => ((bits >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) setFn(g, 8, i, bit(i));
  setFn(g, 8, 7, bit(6));
  setFn(g, 8, 8, bit(7));
  setFn(g, 7, 8, bit(8));
  for (let i = 9; i < 15; i++) setFn(g, 14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) setFn(g, n - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) setFn(g, 8, n - 15 + i, bit(i));
  setFn(g, 8, n - 8, true); // dark module
}

function drawFunctionPatterns(g, version, level = 'M') {
  const n = g.m.length;
  for (let i = 0; i < n; i++) { setFn(g, 6, i, i % 2 === 0); setFn(g, i, 6, i % 2 === 0); }
  drawFinder(g, 3, 3); drawFinder(g, n - 4, 3); drawFinder(g, 3, n - 4);
  const pos = ALIGN[version];
  for (let i = 0; i < pos.length; i++) for (let j = 0; j < pos.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) continue;
    drawAlign(g, pos[i], pos[j]);
  }
  drawFormat(g, 0, level);
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const b = ((bits >>> i) & 1) !== 0;
      const a = n - 11 + (i % 3), c = Math.floor(i / 3);
      setFn(g, a, c, b); setFn(g, c, a, b);
    }
  }
}

function placeData(g, codewords) {
  const n = g.m.length;
  let i = 0;
  const totalBits = codewords.length * 8;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? n - 1 - vert : vert;
        if (!g.f[y][x] && i < totalBits) {
          g.m[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(g, mask) {
  const n = g.m.length;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!g.f[y][x] && MASKS[mask](x, y)) g.m[y][x] = !g.m[y][x];
}

function penalty(m) {
  const n = m.length;
  let score = 0;
  const run = (line) => {
    let s = 0, runLen = 1;
    for (let i = 1; i <= line.length; i++) {
      if (i < line.length && line[i] === line[i - 1]) runLen++;
      else { if (runLen >= 5) s += 3 + (runLen - 5); runLen = 1; }
    }
    return s;
  };
  for (let i = 0; i < n; i++) {
    score += run(m[i]);
    score += run(m.map((r) => r[i]));
  }
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
    const c = m[y][x];
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
  }
  const pat = [true, false, true, true, true, false, true, false, false, false, false];
  const rpat = [...pat].reverse();
  const match = (get, p) => { for (let k = 0; k < 11; k++) if (get(k) !== p[k]) return false; return true; };
  for (let y = 0; y < n; y++) for (let x = 0; x <= n - 11; x++) {
    if (match((k) => m[y][x + k], pat) || match((k) => m[y][x + k], rpat)) score += 40;
    if (match((k) => m[x + k][y], pat) || match((k) => m[x + k][y], rpat)) score += 40;
  }
  let dark = 0;
  for (const r of m) for (const c of r) if (c) dark++;
  score += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return score;
}

/** @param {string} text @returns {{size:number,version:number,mask:number,modules:boolean[][]}} */
export function encodeQR(text, level = 'M') {
  if (!ECC[level]) throw new RangeError('Unsupported error-correction level');
  const bytes = Array.from(new TextEncoder().encode(text));
  const version = pickVersion(bytes.length, level);
  const { codewords } = buildCodewords(bytes, version, level);
  const size = version * 4 + 17;
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const g = makeMatrix(size);
    drawFunctionPatterns(g, version, level);
    placeData(g, codewords);
    applyMask(g, mask);
    drawFormat(g, mask, level);
    const score = penalty(g.m);
    if (!best || score < best.score) best = { score, mask, m: g.m };
  }
  return { size, version, mask: best.mask, level, modules: best.m };
}

/**
 * Render as an SVG string (4-module quiet zone).
 * With `logo` (an image URL / data URI) the code is built at error-correction level H and the logo sits in the centre
 * on a light plate. The plate covers < 6% of the modules, well inside what level H can recover (~30%).
 * Still: scan every printed code with a phone.
 */
export function qrSvg(text, { dark = '#122040', light = '#ffffff', label = 'QR code', logo = null, logoRatio = 0.24, logoAspect = 1 } = {}) {
  const { size, modules } = encodeQR(text, logo ? 'H' : 'M');
  const q = 4;
  const total = size + q * 2;
  // centre plate (in modules), forced odd/even so it stays centred on the grid
  const plateW = Math.round(size * logoRatio * (logoAspect > 1 ? logoAspect : 1));
  const plateH = Math.round(size * logoRatio * (logoAspect < 1 ? 1 / logoAspect : 1));
  const x0 = Math.floor((size - plateW) / 2), y0 = Math.floor((size - plateH) / 2);
  const inPlate = (x, y) => logo && x >= x0 && x < x0 + plateW && y >= y0 && y < y0 + plateH;
  let d = '';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x] && !inPlate(x, y)) d += `M${x + q},${y + q}h1v1h-1z`;
  const plate = logo
    ? `<rect x="${x0 + q}" y="${y0 + q}" width="${plateW}" height="${plateH}" rx="1.2" fill="${light}"/>` +
      `<image href="${logo}" x="${x0 + q + 0.6}" y="${y0 + q + 0.6}" width="${plateW - 1.2}" height="${plateH - 1.2}" preserveAspectRatio="xMidYMid meet"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" role="img" aria-label="${label}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="${light}"/><path d="${d}" fill="${dark}"/>${plate}</svg>`;
}
