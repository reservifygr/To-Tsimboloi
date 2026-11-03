import test from 'node:test';
import assert from 'node:assert/strict';
import { rsGenerator, rsRemainder, encodeQR, qrSvg } from '../../src/shared/qr.js';

test('QR: Reed-Solomon matches published vectors', () => {
  // degree-7 generator polynomial exponents (alpha^0, 87, 229, 146, 149, 238, 102, 21) from ISO 18004 annex
  const EXP = []; const LOG = [];
  let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  assert.deepEqual(rsGenerator(7).map((c) => LOG[c]), [0, 87, 229, 146, 149, 238, 102, 21]);
  // Well-known "HELLO WORLD" version 1-M example: 16 data codewords -> 10 ecc codewords
  const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
  assert.deepEqual(rsRemainder(data, 10), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
});

test('QR: sizes, finder patterns, timing patterns', () => {
  const q = encodeQR('https://example.com/menu/');
  assert.equal(q.size, q.version * 4 + 17);
  const m = q.modules;
  const finder = (ox, oy) => {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
      assert.equal(m[oy + y][ox + x], ring !== 2, `finder @${ox},${oy} (${x},${y})`);
    }
  };
  finder(0, 0); finder(q.size - 7, 0); finder(0, q.size - 7);
  for (let i = 8; i < q.size - 8; i++) { assert.equal(m[6][i], i % 2 === 0); assert.equal(m[i][6], i % 2 === 0); }
  assert.equal(m[q.size - 8][8], true, 'dark module');
});

test('QR: format information is correct (BCH) for the chosen mask, read from both copies', () => {
  const q = encodeQR('https://example.com/menu/');
  const m = q.modules; const n = q.size;
  // Reference: ECC level M format strings (after XOR mask) for masks 0-7
  const REF = ['101010000010010', '101000100100101', '101111001111100', '101101101001011', '100010111111001', '100000011001110', '100111110010111', '100101010100000'];
  const bits = [];
  for (let i = 0; i <= 5; i++) bits[i] = m[i][8];
  bits[6] = m[7][8]; bits[7] = m[8][8]; bits[8] = m[8][7];
  for (let i = 9; i < 15; i++) bits[i] = m[8][14 - i];
  const val = bits.reduce((acc, b, i) => acc | ((b ? 1 : 0) << i), 0);
  assert.equal(val.toString(2).padStart(15, '0'), REF[q.mask]);
  const bits2 = [];
  for (let i = 0; i < 8; i++) bits2[i] = m[8][n - 1 - i];
  for (let i = 8; i < 15; i++) bits2[i] = m[n - 15 + i][8];
  const val2 = bits2.reduce((acc, b, i) => acc | ((b ? 1 : 0) << i), 0);
  assert.equal(val2, val);
});

test('QR: capacity, determinism, svg output, long input rejected', () => {
  assert.equal(encodeQR('A').version, 1);
  assert.ok(encodeQR('https://tsimboloi-demo.example/menu/?table=12').version >= 3);
  assert.deepEqual(encodeQR('abc').modules, encodeQR('abc').modules);
  const svg = qrSvg('https://example.com/menu/', { label: 'Menu QR' });
  assert.match(svg, /^<svg[^>]+aria-label="Menu QR"/);
  assert.throws(() => encodeQR('x'.repeat(400)), RangeError);
});

test('QR level H: format bits, capacity and logo plate', async () => {
  const q = encodeQR('https://example.com/menu/', 'H');
  const REF_H = ['001011010001001', '001001110111110', '001110011100111', '001100111010000', '000011101100010', '000001001010101', '000110100001100', '000100000111011'];
  const m = q.modules;
  const bits = [];
  for (let i = 0; i <= 5; i++) bits[i] = m[i][8];
  bits[6] = m[7][8]; bits[7] = m[8][8]; bits[8] = m[8][7];
  for (let i = 9; i < 15; i++) bits[i] = m[8][14 - i];
  const val = bits.reduce((acc, b, i) => acc | ((b ? 1 : 0) << i), 0);
  assert.equal(val.toString(2).padStart(15, '0'), REF_H[q.mask]);
  assert.ok(q.version >= encodeQR('https://example.com/menu/', 'M').version, 'H needs at least as many modules as M');
  const svg = qrSvg('https://example.com/menu/?table=12', { logo: 'data:image/png;base64,AAAA', label: 'x' });
  assert.match(svg, /<image href="data:image\/png;base64,AAAA"/);
  const centre = encodeQR('https://example.com/menu/?table=12', 'H');
  const plate = Math.round(centre.size * 0.24);
  assert.ok((plate * plate) / (centre.size * centre.size) < 0.06, 'logo plate must stay under 6% of modules');
  assert.throws(() => encodeQR('abc', 'Z'), RangeError);
});
