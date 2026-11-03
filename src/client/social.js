// Instagram posts + the centre-stage carousel (one highlighted post, a neighbour each side, auto-advance every 5 s, endless loop).
// Posts without an uploaded image show the real post through Instagram's own embed; every card also links out.
import { $, $$, adapter, storage } from './core.js';

const INTERVAL = 5000;

function mountEmbeds(root) {
  const imgs = adapter.getImages();
  $$('.post[data-post]', root).forEach((card) => {
    const src = imgs[`post:${card.dataset.post}`];
    const media = $('[data-post-media]', card);
    if (src) {
      if (!$('.post-img', media)) {
        const img = new Image();
        img.className = 'post-img';
        img.alt = '';
        img.src = src;
        img.loading = 'lazy';
        media.prepend(img);
      }
      card.classList.add('has-media');
      return;
    }
    if (storage.get('tsb.embeds', 'on') === 'off' || $('iframe', media)) return;
    const f = document.createElement('iframe');
    f.src = `https://www.instagram.com/p/${card.dataset.post}/embed/`;
    f.loading = 'lazy';
    f.title = 'Instagram';
    f.setAttribute('scrolling', 'no');
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    media.append(f);
    card.classList.add('embedded');
  });
}

function stage(car) {
  const track = $('.car-track', car);
  const cards = $$('.post', track);
  const n = cards.length;
  if (n < 3) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let active = 0;
  let timer = null;
  let hover = false;
  car.classList.add('cf');
  track.removeAttribute('tabindex');
  track.setAttribute('role', 'group');

  const layout = () => {
    const w = cards[0].offsetWidth || 320;
    cards.forEach((c, i) => {
      let off = (i - active) % n;
      if (off > n / 2) off -= n;
      if (off < -n / 2 + (n % 2 ? 0 : 0) && off <= -n / 2) off += n === 0 ? 0 : 0;
      const abs = Math.abs(off);
      const side = Math.sign(off);
      const x = abs === 0 ? 0 : abs === 1 ? side * w * 0.96 : side * w * 1.7;
      const s = abs === 0 ? 1 : abs === 1 ? 0.84 : 0.7;
      const o = abs === 0 ? 1 : abs === 1 ? 0.6 : 0;
      c.style.setProperty('--x', `${x}px`);
      c.style.setProperty('--s', String(s));
      c.style.setProperty('--o', String(o));
      c.style.zIndex = String(abs === 0 ? 3 : abs === 1 ? 2 : 1);
      c.classList.toggle('is-center', abs === 0);
      c.toggleAttribute('inert', abs !== 0);
      c.setAttribute('aria-hidden', abs > 1 ? 'true' : 'false');
    });
    const h = Math.max(...cards.map((c) => c.offsetHeight));
    track.style.setProperty('--h', `${h + 24}px`);
  };
  const go = (i) => { active = ((i % n) + n) % n; layout(); };
  const restart = () => {
    clearInterval(timer);
    if (!reduced) timer = setInterval(() => { if (!hover && !document.hidden) go(active + 1); }, INTERVAL);
  };

  $('[data-car-prev]', car).addEventListener('click', () => { go(active - 1); restart(); });
  $('[data-car-next]', car).addEventListener('click', () => { go(active + 1); restart(); });
  cards.forEach((c, i) => c.addEventListener('click', (e) => {
    if (i !== active) { e.preventDefault(); go(i); restart(); }
  }));
  track.addEventListener('mouseenter', () => { hover = true; });
  track.addEventListener('mouseleave', () => { hover = false; });
  track.addEventListener('focusin', () => { hover = true; });
  track.addEventListener('focusout', () => { hover = false; });
  car.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { go(active + 1); restart(); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { go(active - 1); restart(); e.preventDefault(); }
  });
  addEventListener('resize', layout);
  layout();
  setTimeout(layout, 600);
  setTimeout(layout, 2500);
  restart();
}

export function initSocial(root = document) {
  mountEmbeds(root);
  $$('[data-carousel]', root).forEach(stage);
}
