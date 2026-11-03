// Instagram-style post cards + carousels. Cards link OUT to Instagram; nothing from Instagram is embedded.
import { $, $$, adapter } from './core.js';

export function initSocial(root = document) {
  const imgs = adapter.getImages();
  $$('.post[data-post]', root).forEach((card) => {
    const src = imgs[`post:${card.dataset.post}`];
    if (!src) return;
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
