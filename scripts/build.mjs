// Static build: pre-renders every route in Greek (/) and English (/en/), copies public/ and client modules.
// Zero dependencies. Env: BASE (sub-path), SITE_URL (canonical origin), INDEXABLE=1 (allow indexing).
import { mkdir, rm, cp, writeFile, readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ctx, renderPage, ROUTES, sitemapXml, robotsTxt } from '../src/site/render.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const c = ctx(process.env);
c.version = process.env.ASSET_VERSION ?? Date.now().toString(36);

await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'assets'), { recursive: true });
await cp(join(root, 'public'), out, { recursive: true });
await cp(join(root, 'src/shared'), join(out, 'assets/shared'), { recursive: true });
await cp(join(root, 'src/styles/site.css'), join(out, 'assets/site.css'));
for (const f of await readdir(join(root, 'src/client'))) if (f.endsWith('.js')) await cp(join(root, 'src/client', f), join(out, 'assets', f));

// Cache busting: stamp every relative module import with this build's version so browsers never mix old and new modules.
async function stamp(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await stamp(p);
    else if (e.name.endsWith('.js')) {
      const src = await readFile(p, 'utf8');
      await writeFile(p, src.replace(/(from\s+['"])(\.{1,2}\/[^'"]+?\.js)(['"])/g, `$1$2?v=${c.version}$3`));
    }
  }
}
await stamp(join(out, 'assets'));

// RELATIVE=1: rewrite root-absolute links so the site works from any folder or file host (e.g. a shared preview link).
function relativise(html, depth) {
  const pre = depth ? '../'.repeat(depth) : './';
  return html
    .replace(/(href|src)="\/(?!\/)/g, `$1="${pre}`)
    .replace(/href="((?:\.\.\/|\.\/)[^"#?]*\/)(?=["#?])/g, 'href="$1index.html')
    .replace(/href="\.\/(?=["#?])/g, 'href="./index.html')
    .replace(/data-base=""/, `data-base="${pre.replace(/\/$/, '')}" data-relative="1"`);
}

let count = 0;
for (const lang of ['el', 'en']) {
  for (const route of ROUTES) {
    const dir = join(out, lang === 'en' ? 'en' : '', route);
    await mkdir(dir, { recursive: true });
    let html = renderPage(c, lang, route);
    if (process.env.RELATIVE === '1') html = relativise(html, (lang === 'en' ? 1 : 0) + (route ? 1 : 0));
    await writeFile(join(dir, 'index.html'), html);
    count++;
  }
}
await writeFile(join(out, 'sitemap.xml'), sitemapXml(c));
await writeFile(join(out, 'robots.txt'), robotsTxt(c));
await writeFile(join(out, '404.html'), (await readFile(join(out, 'index.html'), 'utf8')));
console.log(`built ${count} pages -> dist/ (indexable=${c.indexable}, base="${c.base}")`);
