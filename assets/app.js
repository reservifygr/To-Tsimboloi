// Runs on every page: language persistence, mobile nav, cookie notice, mock analytics page view.
import { lang, route, T, $, $$, storage, track, esc } from './core.js?v=mw625ahn';

const LANG_KEY = 'tsb.lang';
const sw = $('[data-lang-switch]');

// Language persistence: an explicit choice is remembered and applied when a page of the other language is opened.
const stored = storage.get(LANG_KEY, null);
if ((stored === 'el' || stored === 'en') && stored !== lang && sw && sw.dataset.langSwitch === stored) {
  location.replace(sw.href + location.search + location.hash);
}
sw?.addEventListener('click', () => storage.set(LANG_KEY, sw.dataset.langSwitch));

// Mobile navigation
const toggle = $('[data-nav-toggle]');
const nav = $('#site-nav');
function setNav(open) {
  nav.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', String(open));
}
toggle?.addEventListener('click', () => setNav(toggle.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('open')) { setNav(false); toggle.focus(); } });
$$('#site-nav a').forEach((a) => a.addEventListener('click', () => setNav(false)));
matchMedia('(min-width: 861px)').addEventListener('change', (e) => { if (e.matches) setNav(false); });

// Cookie / storage notice (draft). No third-party scripts exist; this records the visitor's choice only.
function cookieNotice() {
  if (storage.get('tsb.consent', null)) return;
  const root = $('#cookie-root');
  root.innerHTML = `<section class="cookie" role="region" aria-labelledby="ck-h"><h2 id="ck-h">${esc(T('cookie.title'))}</h2><p>${esc(T('cookie.text'))}</p>
  <div class="row"><button class="btn btn-primary btn-sm" type="button" data-consent="essential">${esc(T('cookie.essential'))}</button>
  <button class="btn btn-ghost btn-sm" type="button" data-consent="analytics">${esc(T('cookie.analytics'))}</button>
  <a href="${route('privacy')}">${esc(T('cookie.more'))}</a></div></section>`;
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-consent]'); if (!b) return;
    storage.set('tsb.consent', b.dataset.consent);
    root.innerHTML = '';
    track('page_view');
  });
}
cookieNotice();
track('page_view');

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Header shadow after scrolling
const head = $('[data-header]');
if (head) {
  const on = () => head.classList.toggle('scrolled', scrollY > 10);
  addEventListener('scroll', on, { passive: true });
  on();
}

// Temporary demo photos (Unsplash, free licence) are loaded from Unsplash by the visitor's browser; a failed load hides the tile.
if (storage.get('tsb.embeds', 'on') !== 'off') {
  $$('img[data-ext]').forEach((img) => {
    img.addEventListener('error', () => { img.closest('figure').hidden = true; });
    img.src = img.dataset.ext;
  });
} else $$('img[data-ext]').forEach((img) => { img.closest('figure').hidden = true; });

// Google map embed (owner-supplied). Lazy; the directions link stays as the fallback.
if (storage.get('tsb.embeds', 'on') !== 'off') {
  $$('[data-map]').forEach((box) => {
    const f = document.createElement('iframe');
    f.src = box.dataset.map;
    f.title = box.dataset.title;
    f.loading = 'lazy';
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    f.setAttribute('allowfullscreen', '');
    box.append(f);
    box.classList.add('has-map');
  });
}

// Scroll reveal (content stays visible without JS and under reduced motion)
const reveals = $$('.reveal, .wsplit');
if (reduced || !('IntersectionObserver' in window)) reveals.forEach((e) => e.classList.add('in'));
else {
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  reveals.forEach((e, i) => { e.style.transitionDelay = `${(i % 4) * 60}ms`; io.observe(e); });
}

// Gentle hero parallax
const bg = $('[data-parallax]');
if (bg && !reduced) {
  let tick = false;
  addEventListener('scroll', () => {
    if (tick) return;
    tick = true;
    requestAnimationFrame(() => { if (scrollY < 900) bg.style.transform = `translateY(${scrollY * 0.12}px)`; tick = false; });
  }, { passive: true });
}

// Event countdown; events whose date has passed are hidden (the daily rebuild moves them to "Past events")
const athensToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
$$('.js-upcoming').forEach((ev) => {
  const date = ev.dataset.eventDate;
  const today = athensToday();
  if (date < today) {
    ev.hidden = true;
    const none = $('[data-no-upcoming]');
    if (none) none.hidden = false;
    ev.closest('.next-night')?.setAttribute('hidden', '');
    return;
  }
  const cd = $('[data-countdown]', ev);
  if (cd) {
    const days = Math.round((Date.parse(date + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 86400000);
    cd.textContent = days === 0 ? cd.dataset.today : days === 1 ? cd.dataset.tomorrow : cd.dataset.in.replace('{n}', String(days));
  }
});
