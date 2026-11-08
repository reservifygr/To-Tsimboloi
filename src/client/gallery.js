// Hero video (with a pause control), lazy clips, and the photo lightbox. Everything degrades to the poster image and plain links.
import { T, $, $$, esc } from './core.js';

const calm = matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData === true;

// Hero loop: plays only while visible (and not for reduced-motion / data-saver users).
const hv = $('[data-hero-video]');
if (hv && !calm) new IntersectionObserver(([e]) => { if (e.isIntersecting) hv.play().catch(() => {}); else hv.pause(); }, { threshold: 0.15 }).observe(hv);

// Gallery clips: muted, play while on screen.
const clips = $$('[data-clip]');
if (clips.length && !calm) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause(); }), { threshold: 0.45 });
  clips.forEach((v) => io.observe(v));
} else clips.forEach((v) => { v.controls = true; });

// Lightbox
const links = $$('a[data-lb]');
if (links.length) {
  const dlg = document.createElement('dialog');
  dlg.className = 'lightbox';
  dlg.setAttribute('aria-label', T('gallery.h1'));
  dlg.innerHTML = `<div class="lb-bar"><span class="lb-count" aria-live="polite"></span><button class="btn btn-ghost btn-sm" type="button" data-lb-close>${esc(T('gallery.close'))}</button></div>
    <div class="lb-stage"><button class="lb-nav" type="button" data-lb-prev aria-label="${esc(T('gallery.prev'))}">&#8249;</button><img alt=""><button class="lb-nav" type="button" data-lb-next aria-label="${esc(T('gallery.next'))}">&#8250;</button></div><p class="lb-cap"></p>`;
  document.body.append(dlg);
  const img = $('img', dlg); let cur = 0;
  const show = (i) => {
    cur = (i + links.length) % links.length;
    const a = links[cur]; const cap = a.dataset.lb;
    img.src = a.href; img.alt = cap;
    $('.lb-cap', dlg).textContent = cap;
    $('.lb-count', dlg).textContent = `${cur + 1} ${T('gallery.of')} ${links.length}`;
  };
  links.forEach((a, i) => a.addEventListener('click', (e) => { e.preventDefault(); show(i); if (!dlg.open) dlg.showModal(); }));
  $('[data-lb-close]', dlg).addEventListener('click', () => dlg.close());
  $('[data-lb-prev]', dlg).addEventListener('click', () => show(cur - 1));
  $('[data-lb-next]', dlg).addEventListener('click', () => show(cur + 1));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') show(cur + 1); if (e.key === 'ArrowLeft') show(cur - 1); });
}
