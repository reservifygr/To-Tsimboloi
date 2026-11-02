// Minimal static server for dist/ (directory indexes, correct MIME). Usage: node scripts/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.argv[2] || process.env.PORT || 4173);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };

export function start(p = port) {
  const srv = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = normalize(join(root, path));
      if (!file.startsWith(root)) { res.writeHead(403).end('Forbidden'); return; }
      let st = await stat(file).catch(() => null);
      if (st?.isDirectory()) {
        if (!path.endsWith('/')) { res.writeHead(301, { Location: path + '/' }).end(); return; }
        file = join(file, 'index.html'); st = await stat(file).catch(() => null);
      }
      if (!st) { res.writeHead(404, { 'Content-Type': MIME['.html'] }).end(await readFile(join(root, '404.html'))); return; }
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(await readFile(file));
    } catch (e) { res.writeHead(500).end(String(e)); }
  });
  return new Promise((ok) => srv.listen(p, () => ok(srv)));
}
if (import.meta.url === `file://${process.argv[1]}`) { await start(port); console.log(`http://localhost:${port}/ (serving dist/)`); }
