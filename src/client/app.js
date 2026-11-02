// Runs on every page: language persistence, mobile nav, cookie notice, mock analytics page view.
import { lang, route, T, $, $$, storage, track, esc } from './core.js';

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
