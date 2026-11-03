// Instagram-style post cards + carousels. Cards link OUT to Instagram; nothing from Instagram is embedded.
import { $, $$, adapter, storage } from './core.js';

export function initSocial(root = document) {
  const imgs = adapter.getImages();
  $$('.post[data-post]', root).forEach((card) => {
    const src = imgs[`post:${card.dataset.post}`];
    if (!src) {
      // No uploaded image: show the real post through Instagram's own embed (loaded lazily, only near the viewport).
      if (storage.get('tsb.embeds', 'on') === 'off') return;
      const media = $('[data-post-media]', card);
      const f = document.createElement('iframe');
      f.src = `https://www.instagram.com/p/${card.dataset.post}/embed/`;
      f.loading = 'lazy';
      f.title = 'Instagram';
      f.setAttribute('scrolling', 'no');
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      media.append(f);
      card.classList.add('embedded');
      return;
    }
    const media = $('[data-post-media]', card);
    if (!$('.post-img', media)) {
      const img = new Image();
      img.className = 'post-img';
      img.alt = '';
      img.src = src;
      img.loading = 'lazy';
      media.prepend(img);
    }
    card.classList.add('has-media');
  });
  $$('[data-carousel]', root).forEach((car) => {
    const track = $('.car-track', car);
    const step = () => Math.max(220, track.clientWidth * 0.85);
    $('[data-car-prev]', car).addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    $('[data-car-next]', car).addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { track.scrollBy({ left: step() / 2, behavior: 'smooth' }); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { track.scrollBy({ left: -step() / 2, behavior: 'smooth' }); e.preventDefault(); }
    });
  });
}
