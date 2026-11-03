// Scroll-spy: highlights the nav link of the section currently being read and keeps it visible in a sideways-scrolling tab bar.
import { $$ } from './core.js';

export function spy(linkSelector, sectionSelector) {
  const links = $$(linkSelector);
  const secs = $$(sectionSelector);
  if (!links.length || !secs.length) return;
  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  let current = null;
  let tick = false;
  const run = () => {
    tick = false;
    const line = 150; // px from the top of the viewport (below the sticky header and tab bar)
    let act = secs[0];
    for (const s of secs) if (s.getBoundingClientRect().top - line <= 0) act = s;
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) act = secs[secs.length - 1];
    if (act.id === current) return;
    current = act.id;
    links.forEach((a) => { a.classList.remove('active'); a.removeAttribute('aria-current'); });
    const a = byId.get(act.id);
    if (!a) return;
    a.classList.add('active');
    a.setAttribute('aria-current', 'true');
    const bar = a.parentElement.closest('.cat-nav, .o-tabs') ?? a.parentElement;
    if (bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: a.offsetLeft - bar.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' });
  };
  const onScroll = () => { if (!tick) { tick = true; requestAnimationFrame(run); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  run();
}
