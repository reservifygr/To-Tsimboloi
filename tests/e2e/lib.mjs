// Tiny Chrome DevTools Protocol driver (no dependencies). Needs Chrome/Chromium: set CHROME_PATH or install google-chrome.
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const CANDIDATES = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch() {
  const bin = CANDIDATES.find((p) => existsSync(p));
  if (!bin) throw new Error('No Chrome found. Set CHROME_PATH.');
  const dir = await mkdtemp(join(tmpdir(), 'tsb-chrome-'));
  const port = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(bin, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
  let ws;
  for (let i = 0; i < 60; i++) {
    try { const j = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); ws = j.webSocketDebuggerUrl; break; } catch { await sleep(250); }
  }
  if (!ws) { proc.kill(); throw new Error('Chrome did not start'); }
  const sock = new WebSocket(ws);
  await new Promise((ok, no) => { sock.onopen = ok; sock.onerror = no; });
  let id = 0; const pending = new Map(); const listeners = new Set();
  sock.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const { ok, no } = pending.get(d.id); pending.delete(d.id); d.error ? no(new Error(d.error.message)) : ok(d.result); }
    else listeners.forEach((l) => l(d));
  };
  const send = (method, params = {}, sessionId) => new Promise((ok, no) => { const i = ++id; pending.set(i, { ok, no }); sock.send(JSON.stringify({ id: i, method, params, sessionId })); });
  return {
    async newPage({ width = 1440, height = 900, mobile = false, scale = 1 } = {}) {
      const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      const s = (m, p) => send(m, p, sessionId);
      const logs = [];
      listeners.add((d) => {
        if (d.sessionId !== sessionId) return;
        if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(d.params.type)) logs.push(`console.${d.params.type}: ${d.params.args.map((a) => a.value ?? a.description).join(' ')}`);
        if (d.method === 'Runtime.exceptionThrown') logs.push('exception: ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text));
        if (d.method === 'Log.entryAdded' && ['error', 'warning'].includes(d.params.entry.level)) logs.push(`log.${d.params.entry.level}: ${d.params.entry.text} ${d.params.entry.url ?? ''}`);
      });
      await Promise.all([s('Page.enable'), s('Runtime.enable'), s('Log.enable')]);
      await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
      await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      const page = {
        logs,
        async goto(url) {
          const loaded = new Promise((ok) => { const l = (d) => { if (d.sessionId === sessionId && d.method === 'Page.loadEventFired') { listeners.delete(l); ok(); } }; listeners.add(l); });
          await s('Page.navigate', { url }); await loaded; await sleep(120);
        },
        async eval(expr) {
          const r = await s('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
          if (r.exceptionDetails) throw new Error('eval failed: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text) + '\n' + expr);
          return r.result.value;
        },
        async waitFor(expr, timeout = 9000) {
          const t0 = Date.now();
          while (Date.now() - t0 < timeout) { if (await page.eval(`!!(${expr})`).catch(() => false)) return true; await sleep(80); }
          throw new Error('waitFor timeout: ' + expr);
        },
        click: (sel) => page.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)throw new Error('no element '+${JSON.stringify(sel)});e.click();return true})()`),
        async realClick(sel) {
          const r = await page.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`);
          for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await s('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
        },
        fill: (sel, v) => page.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)throw new Error('no element '+${JSON.stringify(sel)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`),
        text: (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.innerText ?? null`),
        count: (sel) => page.eval(`document.querySelectorAll(${JSON.stringify(sel)}).length`),
        key: async (key) => { await s('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key }); await s('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key }); },
        async shot(path, { full = false } = {}) {
          const r = await s('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full });
          await writeFile(path, Buffer.from(r.data, 'base64'));
        },
        async resize(width, height, mobile = false) { await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile }); },
        close: () => send('Target.closeTarget', { targetId }),
      };
      return page;
    },
    close() { try { sock.close(); } catch {} proc.kill('SIGKILL'); },
  };
}
