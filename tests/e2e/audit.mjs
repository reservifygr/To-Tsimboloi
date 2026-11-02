// In-page accessibility + layout audit (string evaluated in the browser). Lightweight, not a replacement for axe/Lighthouse.
export const AUDIT = `(() => {
  const out = [];
  const q = (s, r = document) => [...r.querySelectorAll(s)];
  const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  if (!document.documentElement.lang) out.push('html lang missing');
  if (q('h1').filter(visible).length !== 1) out.push('expected exactly one visible h1, got ' + q('h1').filter(visible).length);
  if (!q('main').length) out.push('no <main>');
  q('img').forEach((i) => { if (!i.hasAttribute('alt')) out.push('img without alt: ' + i.src); });
  const name = (e) => (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') && document.getElementById(e.getAttribute('aria-labelledby'))?.textContent || e.innerText || e.textContent || e.title || [...e.querySelectorAll('img[alt]')].map((i) => i.alt).join(' ') || '').trim();
  q('button, a[href]').filter(visible).forEach((e) => { if (!name(e)) out.push('no accessible name: ' + e.outerHTML.slice(0, 80)); });
  q('input:not([type=hidden]), select, textarea').filter(visible).forEach((e) => {
    const lbl = e.id && document.querySelector('label[for="' + e.id + '"]');
    if (!lbl && !e.closest('label') && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')) out.push('unlabelled control: ' + e.outerHTML.slice(0, 80));
  });
  q('[id]').forEach((e) => { if (q('[id="' + CSS.escape(e.id) + '"]').length > 1) out.push('duplicate id ' + e.id); });
  const hs = q('h1,h2,h3,h4').filter(visible).map((h) => +h.tagName[1]);
  for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) { out.push('heading level jump ' + hs[i - 1] + '->' + hs[i]); break; }
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push('horizontal overflow: ' + document.documentElement.scrollWidth + ' > ' + innerWidth);
  // contrast for text on plain backgrounds
  const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const parse = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { c: p.slice(0, 3), a: p[3] ?? 1 }; };
  const bgOf = (e) => { for (let n = e; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage !== 'none') return null; const p = parse(cs.backgroundColor); if (p && p.a > 0.9) return p.c; } return [255, 255, 255]; };
  const seen = new Set();
  q('main *, header *, footer *').filter(visible).forEach((e) => {
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
    if (e.closest('.hero, [disabled], .sr-only')) return;
    const bg = bgOf(e); if (!bg) return;
    const fg = parse(getComputedStyle(e).color); if (!fg) return;
    const l1 = lum(fg.c), l2 = lum(bg); const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const fs = parseFloat(getComputedStyle(e).fontSize); const bold = +getComputedStyle(e).fontWeight >= 700;
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5;
    const k = e.tagName + e.className; if (ratio < need && !seen.has(k)) { seen.add(k); out.push('low contrast ' + ratio.toFixed(2) + ' (<' + need + ') ' + e.tagName + '.' + e.className + ' "' + e.textContent.trim().slice(0, 30) + '"'); }
  });
  return out;
})()`;
