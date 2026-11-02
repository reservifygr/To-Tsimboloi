// Static build: pre-renders every route in Greek (/) and English (/en/), copies public/ and client modules.
// Zero dependencies. Env: BASE (sub-path), SITE_URL (canonical origin), INDEXABLE=1 (allow indexing).
import { mkdir, rm, cp, writeFile, readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ctx, renderPage, ROUTES, sitemapXml, robotsTxt } from '../src/site/render.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const c = ctx(process.env);

await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'assets'), { recursive: true });
await cp(join(root, 'public'), out, { recursive: true });
await cp(join(root, 'src/shared'), join(out, 'assets/shared'), { recursive: true });
await cp(join(root, 'src/styles/site.css'), join(out, 'assets/site.css'));
for (const f of await readdir(join(root, 'src/client'))) if (f.endsWith('.js')) await cp(join(root, 'src/client', f), join(out, 'assets', f));

let count = 0;
for (const lang of ['el', 'en']) {
  for (const route of ROUTES) {
    const dir = join(out, lang === 'en' ? 'en' : '', route);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.html'), renderPage(c, lang, route));
    count++;
  }
}
await writeFile(join(out, 'sitemap.xml'), sitemapXml(c));
await writeFile(join(out, 'robots.txt'), robotsTxt(c));
await writeFile(join(out, '404.html'), (await readFile(join(out, 'index.html'), 'utf8')));
console.log(`built ${count} pages -> dist/ (indexable=${c.indexable}, base="${c.base}")`);
