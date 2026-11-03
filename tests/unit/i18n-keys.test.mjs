import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { S } from '../../src/shared/strings.js';

const get = (l, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), S[l]);
const files = ['src/site/render.js', ...readdirSync('src/client').filter((f) => f.endsWith('.js')).map((f) => 'src/client/' + f)];

test('every literal translation key used in the code exists in Greek and English', () => {
  const missing = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\b(?:t\((?:lang|'el'|'en'),\s*|T\(\s*)'([\w.]+)'(?=\s*[,)])/g)) {
      for (const l of ['el', 'en']) if (typeof get(l, m[1]) !== 'string') missing.push(`${f}: ${l} ${m[1]}`);
    }
    for (const m of src.matchAll(/\bA\('([\w.]+)'(?=\s*[,)])\)/g)) {
      for (const l of ['el', 'en']) if (typeof get(l, 'admin.' + m[1]) !== 'string') missing.push(`${f}: ${l} admin.${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});
