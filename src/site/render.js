// Build-time page renderer: pure functions returning HTML strings (Greek-first, mirrored English).
// Pages work without JavaScript wherever possible (home, menu, events, offers, contact, privacy).
import { S, t, fmt, L } from '../shared/strings.js';
import { MENU } from '../shared/menu-data.js';
import { VENUE, OFFERS } from '../shared/content-data.js';
import { LATEST_POSTS, PAST_POSTS, EVENTS, splitEvents } from '../shared/social-data.js';
import { eur } from '../shared/money.js';

export const ROUTES = ['', 'menu', 'order', 'events', 'offers', 'contact', 'privacy', 'admin'];
export const NAV = ['', 'menu', 'order', 'events', 'offers', 'contact'];
const NAV_KEY = { '': 'home', menu: 'menu', order: 'order', events: 'events', offers: 'offers', contact: 'contact' };

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function ctx(env = {}) {
  return {
    base: (env.BASE ?? '').replace(/\/$/, ''),
    site: (env.SITE_URL ?? 'https://tsimboloi-demo.example').replace(/\/$/, ''),
    indexable: env.INDEXABLE === '1',
    version: env.ASSET_VERSION ?? '2',
    now: env.NOW ? new Date(env.NOW) : new Date(),
  };
}

export function pathFor(c, lang, route) {
  const p = (lang === 'en' ? '/en/' : '/') + (route ? route + '/' : '');
  return c.base + p;
}
const abs = (c, lang, route) => c.site + pathFor(c, lang, route).slice(c.base.length);
const loc = (lang) => (lang === 'el' ? 'el-GR' : 'en-GB');
export const longDate = (lang, ymd) => new Intl.DateTimeFormat(loc(lang), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(ymd + 'T12:00:00Z'));
export const monthYear = (lang, ymd) => new Intl.DateTimeFormat(loc(lang), { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(ymd + 'T12:00:00Z'));
const dayNum = (ymd) => String(Number(ymd.slice(8, 10)));
const monShort = (lang, ymd) => new Intl.DateTimeFormat(loc(lang), { month: 'short', timeZone: 'UTC' }).format(new Date(ymd + 'T12:00:00Z'));

const svgLeaf = `<svg class="olive" viewBox="0 0 120 40" aria-hidden="true" focusable="false"><path d="M2 20h116" fill="none" stroke="currentColor" stroke-width="1.2"/><g fill="currentColor"><path d="M24 20c-2-8 3-14 9-16 2 8-1 14-9 16z"/><path d="M24 20c-2 8 3 14 9 16 2-8-1-14-9-16z"/><path d="M52 20c-2-8 3-14 9-16 2 8-1 14-9 16z"/><path d="M52 20c-2 8 3 14 9 16 2-8-1-14-9-16z"/><path d="M80 20c-2-8 3-14 9-16 2 8-1 14-9 16z"/><path d="M80 20c-2 8 3 14 9 16 2-8-1-14-9-16z"/><path d="M104 20c-3-5 0-10 6-12 1 5-1 10-6 12z"/></g></svg>`;
const arrow = `<svg class="arrow" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ---------- chrome ---------- */
function header(c, lang, route) {
  const other = lang === 'el' ? 'en' : 'el';
  const links = NAV.map((r) => `<li><a href="${pathFor(c, lang, r)}"${r === route ? ' aria-current="page"' : ''}>${esc(t(lang, 'nav.' + NAV_KEY[r]))}</a></li>`).join('');
  return `<header class="site-header" data-header>
  <div class="wrap bar">
    <a class="brand" href="${pathFor(c, lang, '')}"><img class="brand-logo" src="${c.base}/images/logo-sign.webp" alt="${esc(S[lang].brand)}" width="440" height="218"></a>
    <nav id="site-nav" class="site-nav" aria-label="${esc(t(lang, 'nav.main'))}"><ul>${links}</ul></nav>
    <a class="btn btn-primary btn-sm head-call" href="tel:${VENUE.phoneTel}">${esc(t(lang, 'cta.book'))}</a>
    <a class="lang-switch" href="${pathFor(c, other, route)}" hreflang="${other}" lang="${other}" data-lang-switch="${other}" aria-label="${esc(t(lang, 'nav.langSwitchLabel'))}">${esc(t(lang, 'nav.langSwitch'))}</a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" data-nav-toggle><span class="sr-only">${esc(t(lang, 'nav.menuBtn'))}</span><span class="burger" aria-hidden="true"></span></button>
  </div>
</header>`;
}

function footer(c, lang) {
  return `<footer class="site-footer">
  <div class="wrap foot-grid">
    <div><img class="foot-logo" src="${c.base}/images/logo-sign.webp" alt="${esc(S[lang].brand)}" width="220" height="109" loading="lazy">
      <p>${esc(lang === 'el' ? VENUE.street + ', ' + VENUE.city : VENUE.streetEn + ', ' + VENUE.cityEn)}</p>
      <p><a href="tel:${VENUE.phoneTel}">${esc(VENUE.phoneDisplay)}</a></p><p class="muted">${esc(t(lang, 'footer.hours'))}</p></div>
    <div><ul class="foot-links">${NAV.slice(1).map((r) => `<li><a href="${pathFor(c, lang, r)}">${esc(t(lang, 'nav.' + NAV_KEY[r]))}</a></li>`).join('')}<li><a href="${pathFor(c, lang, 'privacy')}">${esc(t(lang, 'footer.privacy'))}</a></li><li><a href="${VENUE.instagram.url}" target="_blank" rel="noopener me">${esc(t(lang, 'footer.instagram'))}</a></li></ul></div>
    <div class="muted small"><p>${esc(t(lang, 'footer.rights'))}</p><p>${esc(t(lang, 'footer.by'))}. <a href="${pathFor(c, lang, 'admin')}" rel="nofollow">${lang === 'el' ? 'Διαχείριση (demo)' : 'Staff admin (demo)'}</a></p></div>
  </div>
</footer>`;
}

function actionBar(c, lang) {
  return `<nav class="action-bar" aria-label="${lang === 'el' ? 'Γρήγορες ενέργειες' : 'Quick actions'}">
  <a href="tel:${VENUE.phoneTel}">${esc(t(lang, 'cta.call'))}</a>
  <a href="${pathFor(c, lang, 'menu')}">${esc(t(lang, 'nav.menu'))}</a>
  <a href="${pathFor(c, lang, 'order')}">${esc(t(lang, 'nav.order'))}</a>
  <a href="${pathFor(c, lang, 'events')}">Live</a>
</nav>`;
}

export function layout(c, lang, route, { title, desc, body, scripts = [], jsonld = [], noindex = false, ogImage = '/images/og-interior.jpg', bodyClass = '' }) {
  const other = lang === 'el' ? 'en' : 'el';
  const robots = noindex || !c.indexable ? '<meta name="robots" content="noindex,nofollow">' : '<meta name="robots" content="index,follow">';
  const A = (p) => `${c.base}${p}`;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${robots}
<link rel="canonical" href="${abs(c, lang, route)}">
<link rel="alternate" hreflang="el" href="${abs(c, 'el', route)}">
<link rel="alternate" hreflang="en" href="${abs(c, 'en', route)}">
<link rel="alternate" hreflang="x-default" href="${abs(c, 'el', route)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(S[lang].brand)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${abs(c, lang, route)}">
<meta property="og:locale" content="${lang === 'el' ? 'el_GR' : 'en_GB'}">
<meta property="og:locale:alternate" content="${other === 'el' ? 'el_GR' : 'en_GB'}">
<meta property="og:image" content="${c.site}${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0f1830">
<link rel="icon" href="${A('/favicon-32.png')}" sizes="32x32" type="image/png">
<link rel="icon" href="${A('/icon-192.png')}" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="${A('/apple-touch-icon.png')}">
<link rel="stylesheet" href="${A('/assets/site.css')}?v=${c.version}">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body class="${bodyClass}" data-lang="${lang}" data-route="${route || 'home'}" data-base="${esc(c.base)}">
<a class="skip-link" href="#main">${esc(S[lang].skip)}</a>
<div class="demo-banner" role="note"><div class="wrap"><strong>${esc(S[lang].demoBadge)}</strong> ${esc(S[lang].demoBanner)}</div></div>
${header(c, lang, route)}
<main id="main" tabindex="-1">
${route === 'admin' ? body : splitHeadings(body)}
</main>
${footer(c, lang)}
${actionBar(c, lang)}
<div id="cookie-root"></div>
<script type="module" src="${A('/assets/app.js')}?v=${c.version}"></script>
${scripts.map((s) => `<script type="module" src="${A('/assets/' + s)}?v=${c.version}"></script>`).join('\n')}
</body>
</html>
`;
}

/** Pre-split plain-text h1/h2 into words at build time, so the rise-in animation starts hidden and never flashes. */
function splitHeadings(html) {
  return html.replace(/<(h[12])([^>]*)>([^<]+)<\/\1>/g, (m, tag, attrs, text) => {
    const words = text.trim().split(/\s+/);
    const a = / class="/.test(attrs) ? attrs.replace(/ class="/, ' class="wsplit ') : `${attrs} class="wsplit"`;
    return `<${tag}${a} aria-label="${words.join(' ')}">${words.map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`).join(' ')}</${tag}>`;
  });
}

const pageHead =(lang, key, lead, kicker = '') => `<section class="page-head"><div class="wrap">${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ''}<h1 class="reveal">${esc(t(lang, key + '.h1'))}</h1>${lead ? `<p class="lead reveal">${esc(lead)}</p>` : ''}${svgLeaf}</div></section>`;

/* ---------- shared blocks ---------- */
function postCard(c, lang, p) {
  const media = p.media
    ? (p.kind === 'video'
      ? `<video class="post-img" src="${c.base}${p.media}" ${p.poster ? `poster="${c.base}${p.poster}"` : ''} muted playsinline controls preload="none"></video>`
      : `<img class="post-img" src="${c.base}${p.media}" alt="" loading="lazy">`)
    : '';
  return `<article class="post${p.media ? ' has-media' : ''}" data-post="${p.id}">
  <div class="post-media" data-post-media>${media}<div class="post-ph" aria-hidden="true"><span class="post-ph-date">${esc(monShort(lang, p.posted))}</span><span class="post-ph-year">${p.posted.slice(0, 4)}</span>${svgLeaf}<span class="post-ph-note">${esc(t(lang, 'social.soon'))}</span></div></div>
  <div class="post-body"><span class="post-date">${esc(fmt(t(lang, 'social.posted'), { d: monthYear(lang, p.posted) }))}</span>
  <a class="post-link" href="${p.url}" target="_blank" rel="noopener noreferrer">${esc(t(lang, 'social.open'))} ${arrow}<span class="sr-only"> (${esc(monthYear(lang, p.posted))})</span></a></div></article>`;
}

function carousel(c, lang, id, posts) {
  return `<div class="carousel" data-carousel id="${id}">
  <div class="car-track" tabindex="0" role="region" aria-label="${esc(t(lang, 'social.carousel'))}">${posts.map((p) => postCard(c, lang, p)).join('')}</div>
  <div class="car-ctl"><button class="car-btn" type="button" data-car-prev aria-label="${esc(t(lang, 'social.prev'))}">${arrow}</button><button class="car-btn" type="button" data-car-next aria-label="${esc(t(lang, 'social.next'))}">${arrow}</button></div></div>`;
}

function eventFeature(c, lang, e, { compact = false } = {}) {
  const imgAlt = lang === 'el' ? S.el.events.posterAlt : S.en.events.posterAlt;
  return `<article class="event-feature js-upcoming" data-event-date="${e.date}" data-event-time="${e.time}">
  <div class="ef-poster"><img src="${c.base}${e.poster}" alt="${esc(imgAlt)}" width="636" height="844" loading="${compact ? 'lazy' : 'eager'}"></div>
  <div class="ef-copy">
    <div class="date-badge" aria-hidden="true"><span>${esc(monShort(lang, e.date))}</span><b>${dayNum(e.date)}</b></div>
    <p class="kicker"><span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>${esc(t(lang, compact ? 'home.nextKicker' : 'events.nextTitle'))}</p>
    <h2 class="ef-title">${esc(longDate(lang, e.date))}</h2>
    <p class="ef-time">${esc(fmt(t(lang, 'events.from'), { t: e.time }))} <span class="countdown" data-countdown="${e.date}T${e.time}:00+02:00" data-today="${esc(t(lang, 'home.nextToday'))}" data-tomorrow="${esc(t(lang, 'home.nextTomorrow'))}" data-in="${esc(t(lang, 'home.nextIn'))}"></span></p>
    <p class="ef-lineup-h">${esc(t(lang, 'events.lineup'))}</p>
    <ul class="lineup">${e.artists.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
    <p><a class="btn btn-primary" href="tel:${VENUE.phoneTel}">${esc(t(lang, 'home.nextCta'))}</a></p>
    <p class="small muted">${esc(e.source.includes('NEEDS') ? 'NEEDS OWNER VERIFICATION: names and time as printed on the venue poster.' : '')}</p>
  </div></article>`;
}

/* ---------- menu list ---------- */
function menuSection(lang) {
  const cats = [...MENU.categories].sort((a, b) => a.order - b.order);
  return cats.map((cat, idx) => {
    const items = MENU.items.filter((i) => i.cat === cat.id);
    const rows = items.map((i) => {
      const hasOpts = (i.optionGroups ?? []).length > 0;
      const price = hasOpts
        ? `<span class="price" data-price-for="${i.id}">${esc(eur(i.price, lang))} <span class="muted">/ ${esc(i.optionGroups[0].options[0].label[lang])}</span><br>${esc(eur(i.price + i.optionGroups[0].options[1].priceDelta, lang))} <span class="muted">/ ${esc(i.optionGroups[0].options[1].label[lang])}</span></span>`
        : `<span class="price" data-price-for="${i.id}">${esc(eur(i.price, lang))}</span>`;
      const gloss = i.gloss && i.gloss[lang] ? `<span class="gloss">${esc(i.gloss[lang])}</span>` : '';
      return `<li class="dish" data-item="${i.id}"><div class="dthumb" data-thumb-for="${i.id}" hidden></div><div class="dtext"><span class="dish-name">${esc(L(i.name, lang))}</span>${gloss}${i.note ? `<span class="needs-verify" title="NEEDS OWNER VERIFICATION">${lang === 'el' ? 'προς επιβεβαίωση' : 'to be confirmed'}</span>` : ''}</div><span class="dots" aria-hidden="true"></span>${price}<span class="unavail" data-unavail-for="${i.id}" hidden>${esc(t(lang, 'menu.soldout'))}</span></li>`;
    }).join('');
    return `<section class="menu-cat" id="cat-${cat.id}" aria-labelledby="h-${cat.id}"><header class="mc-head"><span class="mc-num" aria-hidden="true">${String(idx + 1).padStart(2, '0')}</span><h2 id="h-${cat.id}">${esc(L(cat.name, lang))}</h2></header><ul class="dishes">${rows}</ul></section>`;
  }).join('');
}

/* ---------- pages ---------- */
// Google Maps embed supplied by the owner. The iframe is created by app.js (so it can be switched off) and always has a plain link fallback.
const MAP_SRC = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3143.7461790855887!2d23.825362976090734!3d38.006380471928246!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14a19927c8ff9419%3A0xebd0af2ffc5fb72d!2sTo%20tsimboloi!5e0!3m2!1sen!2sgr!4v1793719838198!5m2!1sen!2sgr';
const mapFrame = (lang) => `<div class="map-frame reveal" data-map="${MAP_SRC}" data-title="${esc(lang === 'el' ? 'Χάρτης Google: Το Τσιμπολόι' : 'Google map: To Tsimboloi')}"><a class="btn btn-light" href="${VENUE.mapsQuery}" target="_blank" rel="noopener">${esc(t(lang, 'cta.directions'))}</a></div>`;
const gallery = (c, lang) => [
  ['interior.webp', lang === 'el' ? 'Το εσωτερικό του μαγαζιού με ξύλινα τραπέζια και βαρέλια' : 'The dining room with wooden tables and barrels', 'g-big'],
  ['salad-feta.webp', lang === 'el' ? 'Σαλάτα με φέτα' : 'Salad with feta', ''],
  ['pan-snails.webp', lang === 'el' ? 'Πιάτο που σερβίρεται σε τηγάνι' : 'A dish served in a pan', ''],
  ['plates-salad.webp', lang === 'el' ? 'Πιάτα μεζέδων στο τραπέζι' : 'Meze plates on the table', 'g-wide'],
].map(([f, alt, cls]) => `<figure class="g-item ${cls} reveal"><img src="${c.base}/images/${f}" alt="${esc(alt)}" loading="lazy" width="900" height="900"></figure>`).join('');

function homePage(c, lang) {
  const { upcoming } = splitEvents(EVENTS, c.now);
  const next = upcoming[0];
  const sig = ['saganaki', 'tirokafteri', 'fava', 'stuffed-sausage', 'meat-platter', 'orange-pie'].map((id) => MENU.items.find((i) => i.id === id));
  const sigHtml = sig.map((i) => `<li class="reveal"><span>${esc(L(i.name, lang))}</span><span class="dots" aria-hidden="true"></span><span class="price">${i.optionGroups ? esc(t(lang, 'menu.from')) + ' ' : ''}${esc(eur(i.price, lang))}</span></li>`).join('');
  const ticker = [1, 2, 3, 4, 5].map((n) => `<span>${esc(t(lang, 'home.ticker' + n))}</span>`).join('');
  const body = `
<section class="hero2" data-hero>
  <img class="hero-bg" src="${c.base}/images/interior.webp" alt="" width="1600" height="1067" fetchpriority="high" data-parallax>
  <div class="hero-veil"></div>
  <div class="notes" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map((i) => `<svg class="note n${i}" viewBox="0 0 24 24"><path fill="currentColor" d="${i % 2 ? 'M9 17V5l10-2v12.2A3 3 0 1 1 17 13V6.3L11 7.5V17a3 3 0 1 1-2-2.8z' : 'M12 3v10.6A4 4 0 1 0 14 17V7h4V3z'}"/></svg>`).join('')}</div>
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="kicker hero-in" style="--d:.05s">${esc(t(lang, 'home.heroKicker'))}</p>
      <h1 class="hero-in" style="--d:.15s">${esc(t(lang, 'home.heroTitle'))}</h1>
      <p class="lead hero-in" style="--d:.3s">${esc(t(lang, 'home.heroLead'))}</p>
      <div class="cta-row hero-in" style="--d:.45s">
        <a class="btn btn-primary" href="tel:${VENUE.phoneTel}">${esc(t(lang, 'cta.book'))} <span class="btn-sub">${esc(VENUE.phoneDisplay)}</span></a>
        <a class="btn btn-light" href="${pathFor(c, lang, 'menu')}">${esc(t(lang, 'cta.menu'))}</a>
        <a class="btn btn-light" href="${pathFor(c, lang, 'order')}">${esc(t(lang, 'cta.order'))}</a>
        <a class="btn btn-ghost" href="${pathFor(c, lang, 'events')}">${esc(t(lang, 'cta.events'))}</a>
      </div>
      <p class="hero-note hero-in" style="--d:.55s">${esc(t(lang, 'cta.bookNote'))}</p>
    </div>
    <figure class="neon-card hero-in" style="--d:.35s"><img src="${c.base}/images/live-music-sign.webp" alt="${lang === 'el' ? 'Φωτεινή επιγραφή «Το Τσιμπολόι Live music» πάνω από τη σκηνή' : 'Neon sign reading "To Tsimboloi Live music" above the stage'}" width="814" height="814"></figure>
  </div>
</section>
<div class="marquee" aria-hidden="true"><div class="marquee-track">${ticker}${ticker}${ticker}${ticker}</div></div>

${next ? `<section class="section next-night"><div class="wrap">${eventFeature(c, lang, next, { compact: true })}</div></section>` : ''}

<section class="section story"><div class="wrap split">
  <div class="story-imgs"><img class="si-a reveal" src="${c.base}/images/pan-snails.webp" alt="${lang === 'el' ? 'Πιάτο που σερβίρεται σε τηγάνι' : 'A dish served in a pan'}" width="900" height="900" loading="lazy"><img class="si-b reveal" src="${c.base}/images/salad-feta.webp" alt="${lang === 'el' ? 'Σαλάτα με φέτα' : 'Salad with feta'}" width="900" height="900" loading="lazy"></div>
  <div><p class="kicker">${esc(t(lang, 'home.storyKicker'))}</p><h2 class="reveal">${esc(t(lang, 'home.storyTitle'))}</h2>
  <p class="reveal">${esc(t(lang, 'home.storyP1'))}</p><p class="muted reveal">${esc(t(lang, 'home.storyP2'))}</p>${svgLeaf}</div>
</div></section>

<section class="section dark menu-tease"><div class="wrap split">
  <div><p class="kicker">${esc(t(lang, 'home.menuKicker'))}</p><h2 class="reveal">${esc(t(lang, 'home.menuTitle'))}</h2><p class="reveal">${esc(t(lang, 'home.menuLead'))}</p>
  <ul class="sig-list">${sigHtml}</ul>
  <p class="small muted">${esc(t(lang, 'home.sigNote'))}</p>
  <div class="cta-row"><a class="btn btn-light" href="${pathFor(c, lang, 'menu')}">${esc(t(lang, 'home.sigAll'))}</a><a class="btn btn-primary" href="${pathFor(c, lang, 'order')}">${esc(t(lang, 'cta.order'))}</a></div></div>
  <figure class="tilt reveal"><img src="${c.base}/images/plates-salad.webp" alt="${lang === 'el' ? 'Πιάτα μεζέδων στο τραπέζι' : 'Meze plates on the table'}" width="900" height="900" loading="lazy"></figure>
</div></section>

<section class="section"><div class="wrap">
  <div class="sec-head"><div><p class="kicker">${esc(t(lang, 'home.socialKicker'))}</p><h2 class="reveal">${esc(t(lang, 'home.socialTitle'))}</h2></div><a class="link" href="${VENUE.instagram.url}" target="_blank" rel="noopener me">${esc(t(lang, 'social.follow'))} ${arrow}</a></div>
  ${carousel(c, lang, 'home-carousel', LATEST_POSTS)}
  <p class="small muted">${esc(t(lang, 'social.note'))}</p>
</div></section>

<section class="section tint"><div class="wrap">
  <p class="kicker">${esc(t(lang, 'home.galleryKicker'))}</p><h2 class="reveal">${esc(t(lang, 'home.galleryTitle'))}</h2>
  <div class="gallery">${gallery(c, lang)}</div>
  <p class="small muted">${esc(t(lang, 'home.photoCredit'))}</p>
</div></section>

<section class="section"><div class="wrap"><div class="cards2">
  <article class="card reveal"><p class="kicker">${esc(t(lang, 'home.partyKicker'))}</p><h3>${esc(t(lang, 'home.partyTitle'))}</h3><p>${esc(t(lang, 'home.partyP'))}</p><a class="link" href="${pathFor(c, lang, 'events')}#inquiry">${esc(t(lang, 'home.partyLink'))} ${arrow}</a></article>
  <article class="card reveal"><p class="kicker">${esc(t(lang, 'home.offerKicker'))}</p><h3>${esc(t(lang, 'home.offerTitle'))}</h3><p>${esc(t(lang, 'home.offerP'))}</p><span class="tag">${esc(t(lang, 'offers.existing'))}</span><br><a class="link" href="${pathFor(c, lang, 'offers')}">${esc(t(lang, 'home.offerLink'))} ${arrow}</a></article>
</div></div></section>

<svg class="wave" viewBox="0 0 1440 46" preserveAspectRatio="none" aria-hidden="true" style="margin-bottom:-1px"><path d="M0 46V22C180 2 360 4 540 20s360 26 540 6 270-16 360-8v28z"/></svg>
<section class="section dark visit" style="padding-top:2.5rem"><div class="wrap split">
  <div><p class="kicker">${esc(t(lang, 'home.visitKicker'))}</p><h2 class="reveal">${esc(t(lang, 'home.visitTitle'))}</h2>
  <p><a class="big-phone" href="tel:${VENUE.phoneTel}">${esc(VENUE.phoneDisplay)}</a></p>
  <h3 class="h-small">${esc(t(lang, 'home.hoursTitle'))}</h3><p>${esc(t(lang, 'home.hoursPending'))}</p>
  <p class="cta-row"><a class="btn btn-light" href="${VENUE.mapsQuery}" rel="noopener" target="_blank">${esc(t(lang, 'cta.directions'))}</a><a class="btn btn-ghost" href="tel:${VENUE.phoneTel}">${esc(t(lang, 'cta.call'))}</a></p></div>
  ${mapFrame(lang)}
</div></section>`;
  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'Restaurant', name: S.el.brand, alternateName: S.en.brand,
    address: { '@type': 'PostalAddress', streetAddress: VENUE.street, addressLocality: VENUE.city, addressCountry: 'GR' },
    telephone: VENUE.phoneTel, url: abs(c, lang, ''), image: c.site + '/images/og-interior.jpg',
    // Deliberately omitted until the owner verifies them: openingHours, priceRange, servesCuisine, sameAs, aggregateRating, geo, postalCode.
  }];
  return { title: t(lang, 'home.title'), desc: t(lang, 'home.desc'), body, jsonld, scripts: ['home.js'], bodyClass: 'page-home' };
}

function menuPage(c, lang) {
  const cats = [...MENU.categories].sort((a, b) => a.order - b.order);
  const nav = cats.map((cat) => `<li><a href="#cat-${cat.id}">${esc(L(cat.name, lang))}</a></li>`).join('');
  const body = `<section class="menu-hero"><div class="wrap">
    <p class="kicker">${esc(S[lang].tagline)}</p><h1 class="reveal">${esc(t(lang, 'menu.h1'))}</h1><p class="lead">${esc(t(lang, 'menu.lead'))}</p>
    <div class="menu-tools"><span class="table-chip" data-table-chip hidden></span>
    <a class="btn btn-primary" href="${pathFor(c, lang, 'order')}">${esc(t(lang, 'menu.orderCta'))}</a>
    <button type="button" class="btn btn-ghost" data-open-qr hidden>${esc(t(lang, 'menu.share'))}</button></div>
    <p class="small muted">${esc(t(lang, 'menu.readOnly'))}</p>${svgLeaf}</div></section>
<div class="wrap menu-wrap">
  <p class="notice">${esc(t(lang, 'menu.pricesNote'))}</p>
  <nav class="cat-nav" aria-label="${esc(t(lang, 'menu.categories'))}"><ul>${nav}</ul></nav>
  <div id="menu-root">${menuSection(lang)}</div>
  <aside class="allergen" aria-labelledby="allergen-h"><h2 id="allergen-h">${esc(t(lang, 'menu.allergenTitle'))}</h2><p>${esc(t(lang, 'menu.allergenText'))}</p></aside>
  <section class="qr-panel" aria-labelledby="qr-h"><div class="qr-panel-copy"><p class="kicker">QR</p><h2 id="qr-h">${esc(t(lang, 'menu.qrTitle'))}</h2><p>${esc(t(lang, 'menu.qrText'))}</p><p class="small muted">${esc(t(lang, 'menu.qrDemoNote'))}</p>
    <div class="cta-row"><button class="btn btn-primary" type="button" data-print>${esc(t(lang, 'menu.qrPrintCard'))}</button></div></div>
    <div class="qr-tent" data-qr-tent><div class="qr-box" data-qr-box></div><p class="qr-tent-title">${esc(t(lang, 'menu.qrCard'))}</p><p class="qr-tent-url small" data-qr-url></p></div></section>
</div>
<dialog class="dialog" id="qr-dialog" aria-labelledby="qr-title">
  <h2 id="qr-title">${esc(t(lang, 'menu.qrTitle'))}</h2>
  <div class="qr-box" data-qr-box-dialog></div>
  <p>${esc(t(lang, 'menu.qrText'))}</p>
  <p class="small"><strong>${esc(t(lang, 'menu.qrUrl'))}:</strong> <code data-qr-url-dialog></code></p>
  <div class="dialog-actions"><button class="btn btn-primary" type="button" data-print>${esc(t(lang, 'menu.print'))}</button><button class="btn btn-ghost" type="button" data-close-dialog>${esc(t(lang, 'menu.close'))}</button></div>
</dialog>`;
  return { title: t(lang, 'menu.title'), desc: t(lang, 'menu.desc'), body, scripts: ['menu.js'], bodyClass: 'page-menu' };
}

function orderPage(c, lang) {
  const body = `${pageHead(lang, 'order', t(lang, 'order.pickupOnly'))}
<div class="wrap order-wrap">
  <p class="notice strong">${esc(t(lang, 'order.demoNotice'))}</p>
  <div id="order-root" aria-live="polite"><noscript><p class="notice">${esc(t(lang, 'order.noJs'))}</p></noscript></div>
</div>`;
  return { title: t(lang, 'order.title'), desc: t(lang, 'order.desc'), body, scripts: ['order.js'], bodyClass: 'page-order' };
}

function eventsPage(c, lang) {
  const { upcoming, past } = splitEvents(EVENTS, c.now);
  const feature = upcoming.length ? upcoming.map((e) => eventFeature(c, lang, e)).join('') : '';
  const none = `<p class="notice" data-no-upcoming ${upcoming.length ? 'hidden' : ''}>${esc(t(lang, 'events.none'))}</p>`;
  const pastEvents = past.length ? `<div class="past-events">${past.map((e) => `<article class="card"><h3>${esc(longDate(lang, e.date))}</h3><p>${esc(e.artists.join(' · '))}</p></article>`).join('')}</div>` : '';
  const body = `${pageHead(lang, 'events', t(lang, 'events.lead'), S[lang].tagline)}
<div class="wrap">
  <div class="section-sm" id="next-event">${feature}${none}</div>
  <section class="section-sm" aria-labelledby="latest-h"><div class="sec-head"><h2 id="latest-h">${esc(t(lang, 'events.latestTitle'))}</h2><a class="link" href="${VENUE.instagram.url}" target="_blank" rel="noopener me">${esc(t(lang, 'social.follow'))} ${arrow}</a></div>${carousel(c, lang, 'latest-carousel', LATEST_POSTS)}</section>
  <section class="section-sm" aria-labelledby="past-h"><h2 id="past-h">${esc(t(lang, 'events.pastTitle'))}</h2><p class="muted">${esc(t(lang, 'events.pastLead'))}</p>${pastEvents}<div class="past-grid" id="past-grid">${PAST_POSTS.map((p) => postCard(c, lang, p)).join('')}</div><p class="small muted">${esc(t(lang, 'social.note'))}</p></section>
  <section class="section-sm split-2" aria-labelledby="cal-h"><div><h2 id="cal-h">${esc(t(lang, 'events.calendar'))}</h2><p class="small muted">${esc(t(lang, 'events.calNote'))}</p><div id="calendar-root" data-events="${esc(JSON.stringify(EVENTS.map((e) => e.date)))}"></div></div>
  <div id="inquiry"><h2 id="inq-h">${esc(t(lang, 'events.inquiryTitle'))}</h2><p>${esc(t(lang, 'events.inquiryLead'))}</p><div id="inquiry-root"><noscript><p class="notice">${esc(t(lang, 'cta.bookNote'))} ${esc(VENUE.phoneDisplay)}</p></noscript></div></div></section>
</div>`;
  const jsonld = upcoming.map((e) => ({
    '@context': 'https://schema.org', '@type': 'Event', name: `${S.el.brand}: ${L(e.title, 'el')}`,
    startDate: `${e.date}T${e.time}:00+02:00`, eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: S.el.brand, address: { '@type': 'PostalAddress', streetAddress: VENUE.street, addressLocality: VENUE.city, addressCountry: 'GR' } },
    performer: e.artists.map((n) => ({ '@type': 'Person', name: n })), image: c.site + e.poster,
  }));
  return { title: t(lang, 'events.title'), desc: t(lang, 'events.desc'), body, scripts: ['events.js'], jsonld, ogImage: upcoming[0]?.poster ?? '/images/og-interior.jpg', bodyClass: 'page-events' };
}

function offersPage(c, lang) {
  const cards = OFFERS.map((o) => `<article class="card offer reveal"><span class="tag ${o.status === 'concept' ? 'tag-concept' : 'tag-existing'}">${esc(o.status === 'concept' ? t(lang, 'offers.concept') : t(lang, 'offers.existing'))}</span><h2 class="card-title">${esc(L(o.title, lang))}</h2><p>${esc(L(o.blurb, lang))}</p>${o.id === 'student-id' ? `<p class="small muted">${esc(t(lang, 'offers.studentNote'))}</p>` : ''}</article>`).join('');
  const body = `${pageHead(lang, 'offers', t(lang, 'offers.lead'))}
<div class="wrap">
  <p class="notice">${esc(t(lang, 'offers.stackNote'))}</p>
  <div class="cards2">${cards}</div>
  <section class="section-sm" aria-labelledby="coupon-h"><h2 id="coupon-h">${esc(t(lang, 'offers.couponTitle'))}</h2><p class="muted">${esc(t(lang, 'offers.couponHint'))}</p><div id="coupon-root"></div></section>
</div>`;
  return { title: t(lang, 'offers.title'), desc: t(lang, 'offers.desc'), body, scripts: ['offers.js'] };
}

function contactPage(c, lang) {
  const addr = lang === 'el' ? `${VENUE.street}, ${VENUE.city}` : `${VENUE.streetEn}, ${VENUE.cityEn}`;
  const body = `${pageHead(lang, 'contact')}
<div class="wrap split-2 contact-grid">
  <div>
    <h2 class="h-small">${esc(t(lang, 'contact.address'))}</h2><address>${esc(addr)}</address>
    <h2 class="h-small">${esc(t(lang, 'contact.phone'))}</h2><p><a class="big-phone" href="tel:${VENUE.phoneTel}">+30 ${esc(VENUE.phoneDisplay)}</a></p>
    <p><a class="btn btn-primary" href="tel:${VENUE.phoneTel}">${esc(t(lang, 'cta.call'))}</a> <a class="btn btn-ghost" href="${VENUE.mapsQuery}" target="_blank" rel="noopener">${esc(t(lang, 'contact.openGoogle'))}</a> <a class="btn btn-ghost" href="${VENUE.osmQuery}" target="_blank" rel="noopener">${esc(t(lang, 'contact.openOsm'))}</a></p>
    <h2 class="h-small">${esc(t(lang, 'contact.social'))}</h2>
    <p><a href="${VENUE.instagram.url}" target="_blank" rel="noopener me">Instagram @${esc(VENUE.instagram.handle)}</a></p>
    <p class="small muted">${esc(t(lang, 'contact.instagramNote'))} NEEDS OWNER VERIFICATION</p>
    <h2 class="h-small">${esc(t(lang, 'contact.mapTitle'))}</h2>${mapFrame(lang)}
  </div>
  <div><h2>${esc(t(lang, 'contact.formTitle'))}</h2><p class="muted">${esc(t(lang, 'contact.formLead'))}</p><div id="contact-root"></div></div>
</div>`;
  return { title: t(lang, 'contact.title'), desc: t(lang, 'contact.desc'), body, scripts: ['contact.js'] };
}

function privacyPage(c, lang) {
  const el = `
<h2>Πρόχειρο κείμενο</h2><p>Αυτό είναι πρόχειρο κείμενο για το demo και <strong>δεν αποτελεί νομική συμβουλή</strong>. Πριν τη λειτουργία πρέπει να ελεγχθεί από νομικό σύμβουλο και να συμπληρωθεί από τον υπεύθυνο επεξεργασίας.</p>
<h2>Υπεύθυνος επεξεργασίας</h2><p>Επωνυμία, ΑΦΜ, διεύθυνση και email επικοινωνίας του καταστήματος: <strong>προς συμπλήρωση από τον ιδιοκτήτη</strong>.</p>
<h2>Τι αποθηκεύει το demo</h2><ul><li>Γλώσσα που επιλέξατε (<code>tsb.lang</code>).</li><li>Καλάθι, δοκιμαστικές παραγγελίες (με όνομα, τηλέφωνο και, για delivery, διεύθυνση), αιτήματα, εικόνες και ρυθμίσεις, μόνο στον δικό σας περιηγητή (localStorage). Δεν στέλνονται σε διακομιστή.</li><li>Αν αποδεχτείτε τα "αναλυτικά (demo)", απλά γεγονότα (π.χ. προβολή σελίδας) καταγράφονται τοπικά στον περιηγητή σας. Δεν φορτώνεται υπηρεσία τρίτου.</li><li>Οι δημοσιεύσεις Instagram είναι σύνδεσμοι: δεν φορτώνεται κώδικας του Instagram στη σελίδα.</li></ul>
<h2>Στην παραγωγή</h2><ul><li>Σκοπός και νομική βάση: εκτέλεση παραγγελίας (σύμβαση) και απάντηση σε αιτήματα. Στοιχεία: όνομα, τηλέφωνο, περιεχόμενο παραγγελίας, διεύθυνση παράδοσης, προαιρετικά email.</li><li>Χρόνος διατήρησης: να οριστεί (π.χ. διαγραφή διευθύνσεων και αιτημάτων μετά από συγκεκριμένο διάστημα).</li><li>Δικαιώματα: πρόσβαση, διόρθωση, διαγραφή, περιορισμός, εναντίωση, φορητότητα, καταγγελία στην Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα.</li><li>Εκτελούντες την επεξεργασία (π.χ. πάροχος βάσης δεδομένων, email/SMS): να καταγραφούν με συμβάσεις επεξεργασίας.</li><li>Cookies: μόνο απαραίτητα χωρίς συγκατάθεση. Αναλυτικά ή διαφημιστικά εργαλεία μόνο με προηγούμενη συγκατάθεση. Ενσωματωμένοι χάρτες ή Instagram feeds φορτώνονται μόνο με συγκατάθεση.</li></ul>`;
  const en = `
<h2>Draft text</h2><p>This is draft text for the demo and <strong>is not legal advice</strong>. Before launch it must be reviewed by a lawyer and completed by the data controller.</p>
<h2>Data controller</h2><p>Legal name, VAT number, address and contact email of the venue: <strong>to be completed by the owner</strong>.</p>
<h2>What the demo stores</h2><ul><li>The language you chose (<code>tsb.lang</code>).</li><li>Cart, trial orders (with name, phone and, for delivery, address), requests, images and settings, only in your own browser (localStorage). Nothing is sent to a server.</li><li>If you accept "analytics (demo)", simple events (e.g. page view) are recorded locally in your browser. No third-party service is loaded.</li><li>Instagram posts are plain links: no Instagram code loads on the page.</li></ul>
<h2>In production</h2><ul><li>Purpose and legal basis: fulfilling an order (contract) and replying to requests. Data: name, phone, order contents, delivery address, optionally email.</li><li>Retention period: to be defined (e.g. delete addresses and requests after a set period).</li><li>Rights: access, rectification, erasure, restriction, objection, portability, and a complaint to the Hellenic Data Protection Authority.</li><li>Processors (e.g. database host, email/SMS provider): to be listed with data processing agreements.</li><li>Cookies: strictly necessary ones need no consent. Analytics or advertising tools only after prior consent. Embedded maps or Instagram feeds load only with consent.</li></ul>`;
  const body = `<section class="page-head"><div class="wrap narrow"><h1>${esc(lang === 'el' ? 'Απόρρητο & Cookies (πρόχειρο)' : 'Privacy & Cookies (draft)')}</h1>${svgLeaf}</div></section><div class="wrap narrow prose">${lang === 'el' ? el : en}</div>`;
  return { title: t(lang, 'privacy.title'), desc: t(lang, 'privacy.desc'), body };
}

function adminPage(c, lang) {
  const body = `<section class="page-head compact"><div class="wrap"><h1>${esc(t(lang, 'admin.h1'))}</h1></div></section>
<div class="wrap admin-wrap"><div id="admin-root"><noscript><p class="notice">${esc(t(lang, 'order.noJs'))}</p></noscript></div></div>`;
  return { title: t(lang, 'admin.title'), desc: t(lang, 'admin.title'), body, scripts: ['admin.js'], noindex: true, bodyClass: 'page-admin' };
}

const PAGES = { '': homePage, menu: menuPage, order: orderPage, events: eventsPage, offers: offersPage, contact: contactPage, privacy: privacyPage, admin: adminPage };

export function renderPage(c, lang, route) {
  const p = PAGES[route](c, lang);
  return layout(c, lang, route, p);
}

export function sitemapXml(c) {
  const urls = ROUTES.filter((r) => r !== 'admin').flatMap((r) => ['el', 'en'].map((l) => `  <url><loc>${abs(c, l, r)}</loc><xhtml:link rel="alternate" hreflang="el" href="${abs(c, 'el', r)}"/><xhtml:link rel="alternate" hreflang="en" href="${abs(c, 'en', r)}"/></url>`));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}

export function robotsTxt(c) {
  return c.indexable
    ? `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /en/admin/\n\nSitemap: ${c.site}/sitemap.xml\n`
    : `# DEMO build: not for indexing. Set INDEXABLE=1 at build time once the owner approves go-live.\nUser-agent: *\nDisallow: /\n`;
}
