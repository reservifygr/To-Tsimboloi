// Build-time page renderer: pure functions returning HTML strings (Greek-first, mirrored English).
// Pages work without JavaScript wherever possible (home, menu, events list, offers, contact, privacy).
import { S, t, fmt, L } from '../shared/strings.js';
import { MENU } from '../shared/menu-data.js';
import { VENUE, EVENTS, OFFERS } from '../shared/content-data.js';
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
    version: env.ASSET_VERSION ?? '1',
  };
}

export function pathFor(c, lang, route) {
  const p = (lang === 'en' ? '/en/' : '/') + (route ? route + '/' : '');
  return c.base + p;
}
const abs = (c, lang, route) => c.site + pathFor(c, lang, route).slice(c.base.length);

const svgLeaf = `<svg class="olive" viewBox="0 0 120 40" aria-hidden="true" focusable="false"><path d="M2 20h116" fill="none" stroke="currentColor" stroke-width="1.2"/><g fill="currentColor"><path d="M24 20c-2-8 3-14 9-16 2 8-1 14-9 16z"/><path d="M24 20c-2 8 3 14 9 16 2-8-1-14-9-16z"/><path d="M52 20c-2-8 3-14 9-16 2 8-1 14-9 16z"/><path d="M52 20c-2 8 3 14 9 16 2-8-1-14-9-16z"/><path d="M80 20c-2-8 3-14 9-16 2 8-1 14-9 16z"/><path d="M80 20c-2 8 3 14 9 16 2-8-1-14-9-16z"/><path d="M104 20c-3-5 0-10 6-12 1 5-1 10-6 12z"/></g></svg>`;

function header(c, lang, route) {
  const other = lang === 'el' ? 'en' : 'el';
  const links = NAV.map((r) => {
    const cur = r === route ? ' aria-current="page"' : '';
    return `<li><a href="${pathFor(c, lang, r)}"${cur}>${esc(t(lang, 'nav.' + NAV_KEY[r]))}</a></li>`;
  }).join('');
  return `<header class="site-header">
  <div class="wrap bar">
    <a class="brand" href="${pathFor(c, lang, '')}"><img class="brand-logo" src="${c.base}/images/logo-sign.webp" alt="${esc(S[lang].brand)}" width="440" height="218"></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" data-nav-toggle><span class="sr-only">${esc(t(lang, 'nav.menuBtn'))}</span><span class="burger" aria-hidden="true"></span></button>
    <nav id="site-nav" class="site-nav" aria-label="${esc(t(lang, 'nav.main'))}"><ul>${links}</ul></nav>
    <a class="lang-switch" href="${pathFor(c, other, route)}" hreflang="${other}" lang="${other}" data-lang-switch="${other}" aria-label="${esc(t(lang, 'nav.langSwitchLabel'))}">${esc(t(lang, 'nav.langSwitch'))}</a>
  </div>
</header>`;
}

function footer(c, lang) {
  return `<footer class="site-footer">
  <div class="wrap foot-grid">
    <div><p class="foot-brand">${esc(S[lang].brand)}</p><p>${esc(lang === 'el' ? VENUE.street + ', ' + VENUE.city : VENUE.streetEn + ', ' + VENUE.cityEn)}</p>
      <p><a href="tel:${VENUE.phoneTel}">${esc(VENUE.phoneDisplay)}</a></p><p class="muted">${esc(t(lang, 'footer.hours'))}</p></div>
    <div><ul class="foot-links">${NAV.slice(1).map((r) => `<li><a href="${pathFor(c, lang, r)}">${esc(t(lang, 'nav.' + NAV_KEY[r]))}</a></li>`).join('')}<li><a href="${pathFor(c, lang, 'privacy')}">${esc(t(lang, 'footer.privacy'))}</a></li></ul></div>
    <div class="muted small"><p>${esc(t(lang, 'footer.rights'))}</p><p>${esc(t(lang, 'footer.by'))}. <a href="${pathFor(c, lang, 'admin')}" rel="nofollow">Staff demo</a></p></div>
  </div>
</footer>`;
}

function actionBar(c, lang) {
  return `<nav class="action-bar" aria-label="${lang === 'el' ? 'Γρήγορες ενέργειες' : 'Quick actions'}">
  <a href="tel:${VENUE.phoneTel}">${esc(t(lang, 'cta.call'))}</a>
  <a href="${pathFor(c, lang, 'menu')}">${esc(t(lang, 'nav.menu'))}</a>
  <a href="${pathFor(c, lang, 'order')}">${esc(t(lang, 'nav.order'))}</a>
  <a href="${pathFor(c, lang, 'events')}">${lang === 'el' ? 'Μουσική' : 'Music'}</a>
</nav>`;
}

export function layout(c, lang, route, { title, desc, body, scripts = [], jsonld = null, noindex = false, ogImage = '/images/og-interior.jpg', bodyClass = '' }) {
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
<meta name="theme-color" content="#14213d">
<link rel="icon" href="${A('/favicon-32.png')}" sizes="32x32" type="image/png">
<link rel="icon" href="${A('/icon-192.png')}" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="${A('/apple-touch-icon.png')}">
<link rel="stylesheet" href="${A('/assets/site.css')}?v=${c.version}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body class="${bodyClass}" data-lang="${lang}" data-route="${route || 'home'}" data-base="${esc(c.base)}">
<a class="skip-link" href="#main">${esc(S[lang].skip)}</a>
<div class="demo-banner" role="note"><div class="wrap"><strong>${esc(S[lang].demoBadge)}</strong> ${esc(S[lang].demoBanner)}</div></div>
${header(c, lang, route)}
<main id="main" tabindex="-1">
${body}
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

const pageHead = (lang, key, lead) => `<section class="page-head"><div class="wrap narrow"><h1>${esc(t(lang, key + '.h1'))}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}${svgLeaf}</div></section>`;

/* ---------- menu list (shared by home highlights and /menu) ---------- */
function menuSection(lang) {
  const cats = [...MENU.categories].sort((a, b) => a.order - b.order);
  return cats.map((cat) => {
    const items = MENU.items.filter((i) => i.cat === cat.id);
    const rows = items.map((i) => {
      const hasOpts = (i.optionGroups ?? []).length > 0;
      const price = hasOpts
        ? `<span class="price" data-price-for="${i.id}">${esc(eur(i.price, lang))} <span class="muted">/ ${esc(i.optionGroups[0].options[0].label[lang])}</span><br>${esc(eur(i.price + i.optionGroups[0].options[1].priceDelta, lang))} <span class="muted">/ ${esc(i.optionGroups[0].options[1].label[lang])}</span></span>`
        : `<span class="price" data-price-for="${i.id}">${esc(eur(i.price, lang))}</span>`;
      const gloss = i.gloss && i.gloss[lang] ? ` <span class="gloss">(${esc(i.gloss[lang])})</span>` : '';
      return `<li class="dish" data-item="${i.id}"><span class="dish-name">${esc(L(i.name, lang))}${gloss}${i.note ? `<span class="needs-verify" title="NEEDS OWNER VERIFICATION">${lang === 'el' ? 'προς επιβεβαίωση' : 'to be confirmed'}</span>` : ''}</span><span class="dots" aria-hidden="true"></span>${price}<span class="unavail" data-unavail-for="${i.id}" hidden>${esc(t(lang, 'menu.unavailable'))}</span></li>`;
    }).join('');
    return `<section class="menu-cat" id="cat-${cat.id}" aria-labelledby="h-${cat.id}"><h2 id="h-${cat.id}">${esc(L(cat.name, lang))}</h2><ul class="dishes">${rows}</ul></section>`;
  }).join('');
}

const musicFigure = (c, lang) => `<figure class="music-fig"><img src="${c.base}/images/live-music-sign.webp" alt="${lang === 'el' ? 'Φωτεινή επιγραφή «Το Τσιμπολόι Live music» πάνω από τη σκηνή με μικρόφωνο και κιθάρα' : 'Neon sign reading "To Tsimboloi Live music" above the stage with a microphone and guitar'}" width="814" height="814" loading="lazy"><figcaption>${esc(t(lang, 'home.photoCredit'))}</figcaption></figure>`;

/* ---------- pages ---------- */
function homePage(c, lang) {
  const sig = ['saganaki', 'tirokafteri', 'fava', 'stuffed-sausage', 'meat-platter', 'orange-pie'].map((id) => MENU.items.find((i) => i.id === id));
  const sigHtml = sig.map((i) => `<li><span>${esc(L(i.name, lang))}</span><span class="price">${i.optionGroups ? esc(t(lang, 'menu.from')) + ' ' : ''}${esc(eur(i.price, lang))}</span></li>`).join('');
  const body = `
<section class="hero">
  <img class="hero-img" src="${c.base}/images/interior.webp" alt="${lang === 'el' ? 'Το εσωτερικό του Τσιμπολιού με ξύλινα τραπέζια και ζεστό φωτισμό' : 'The interior of To Tsimboloi with wooden tables and warm lighting'}" width="1600" height="1067" fetchpriority="high">
  <div class="hero-veil"></div>
  <div class="wrap hero-copy">
    <p class="kicker">${esc(t(lang, 'home.heroKicker'))}</p>
    <h1>${esc(t(lang, 'home.heroTitle'))}</h1>
    <p class="lead">${esc(t(lang, 'home.heroLead'))}</p>
    <div class="cta-row">
      <a class="btn btn-primary" href="tel:${VENUE.phoneTel}">${esc(t(lang, 'cta.book'))} <span class="btn-sub">${esc(VENUE.phoneDisplay)}</span></a>
      <a class="btn btn-light" href="${pathFor(c, lang, 'menu')}">${esc(t(lang, 'cta.menu'))}</a>
      <a class="btn btn-light" href="${pathFor(c, lang, 'order')}">${esc(t(lang, 'cta.order'))}</a>
      <a class="btn btn-ghost" href="${pathFor(c, lang, 'events')}">${esc(t(lang, 'cta.events'))}</a>
    </div>
    <p class="hero-note">${esc(t(lang, 'cta.bookNote'))}</p>
  </div>
</section>

<section class="section story"><div class="wrap split">
  <div><p class="kicker">${esc(t(lang, 'home.storyKicker'))}</p><h2>${esc(t(lang, 'home.storyTitle'))}</h2>
  <p>${esc(t(lang, 'home.storyP1'))}</p><p class="muted">${esc(t(lang, 'home.storyP2'))}</p></div>
  <figure><img src="${c.base}/images/pan-snails.webp" alt="${lang === 'el' ? 'Πιάτο που σερβίρεται σε τηγάνι' : 'A dish served in a pan'}" width="900" height="900" loading="lazy"><figcaption>${esc(t(lang, 'home.photoCredit'))}</figcaption></figure>
</div></section>

<section class="section tint"><div class="wrap split rev">
  <figure><img src="${c.base}/images/salad-feta.webp" alt="${lang === 'el' ? 'Σαλάτα με φέτα' : 'Salad with feta'}" width="900" height="900" loading="lazy"></figure>
  <div><p class="kicker">${esc(t(lang, 'home.sigKicker'))}</p><h2>${esc(t(lang, 'home.sigTitle'))}</h2>
  <ul class="sig-list">${sigHtml}</ul>
  <p class="small muted">${esc(t(lang, 'home.sigNote'))}</p>
  <a class="btn btn-primary" href="${pathFor(c, lang, 'menu')}">${esc(t(lang, 'home.sigAll'))}</a></div>
</div></section>

<section class="section dark"><div class="wrap split">
  <div><p class="kicker">${esc(t(lang, 'home.musicKicker'))}</p><h2>${esc(t(lang, 'home.musicTitle'))}</h2><p>${esc(t(lang, 'home.musicP'))}</p>
  <a class="btn btn-light" href="${pathFor(c, lang, 'events')}">${esc(t(lang, 'home.musicLink'))}</a></div>
  ${musicFigure(c, lang)}
</div></section>

<section class="section"><div class="wrap"><div class="cards2">
  <article class="card"><p class="kicker">${esc(t(lang, 'home.partyKicker'))}</p><h3>${esc(t(lang, 'home.partyTitle'))}</h3><p>${esc(t(lang, 'home.partyP'))}</p><a class="link" href="${pathFor(c, lang, 'events')}#inquiry">${esc(t(lang, 'home.partyLink'))}</a></article>
  <article class="card"><p class="kicker">${esc(t(lang, 'home.offerKicker'))}</p><h3>${esc(t(lang, 'home.offerTitle'))}</h3><p>${esc(t(lang, 'home.offerP'))}</p><span class="tag">${esc(t(lang, 'offers.existing'))}</span><br><a class="link" href="${pathFor(c, lang, 'offers')}">${esc(t(lang, 'home.offerLink'))}</a></article>
</div></div></section>

<section class="section tint"><div class="wrap split">
  <div><p class="kicker">${esc(t(lang, 'home.visitKicker'))}</p><h2>${esc(t(lang, 'home.visitTitle'))}</h2>
  <p><a class="big-phone" href="tel:${VENUE.phoneTel}">${esc(VENUE.phoneDisplay)}</a></p>
  <h3 class="h-small">${esc(t(lang, 'home.hoursTitle'))}</h3><p>${esc(t(lang, 'home.hoursPending'))}</p>
  <p><a class="btn btn-light" href="${VENUE.mapsQuery}" rel="noopener" target="_blank">${esc(t(lang, 'cta.directions'))}</a></p></div>
  <figure><img src="${c.base}/images/plates-salad.webp" alt="${lang === 'el' ? 'Πιάτα μεζέδων στο τραπέζι' : 'Meze plates on the table'}" width="900" height="900" loading="lazy"></figure>
</div></section>`;
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'Restaurant', name: S.el.brand, alternateName: S.en.brand,
    address: { '@type': 'PostalAddress', streetAddress: VENUE.street, addressLocality: VENUE.city, addressCountry: 'GR' },
    telephone: VENUE.phoneTel, url: abs(c, lang, ''), image: c.site + '/images/og-interior.jpg',
    // Deliberately omitted until the owner verifies them: openingHours, priceRange, servesCuisine, sameAs, aggregateRating, geo, postalCode.
  };
  return { title: t(lang, 'home.title'), desc: t(lang, 'home.desc'), body, jsonld, ogImage: '/images/og-interior.jpg' };
}

function menuPage(c, lang) {
  const cats = [...MENU.categories].sort((a, b) => a.order - b.order);
  const nav = cats.map((cat) => `<li><a href="#cat-${cat.id}">${esc(L(cat.name, lang))}</a></li>`).join('');
  const body = `${pageHead(lang, 'menu', t(lang, 'menu.lead'))}
<div class="wrap narrow menu-wrap">
  <div class="menu-tools">
    <span class="table-chip" data-table-chip hidden></span>
    <button type="button" class="btn btn-ghost" data-open-qr hidden>${esc(t(lang, 'menu.share'))}</button>
    <a class="btn btn-primary" href="${pathFor(c, lang, 'order')}">${esc(t(lang, 'menu.orderCta'))}</a>
  </div>
  <p class="notice">${esc(t(lang, 'menu.pricesNote'))}</p>
  <nav class="cat-nav" aria-label="${esc(t(lang, 'menu.categories'))}"><ul>${nav}</ul></nav>
  <div id="menu-root">${menuSection(lang)}</div>
  <aside class="allergen" aria-labelledby="allergen-h"><h2 id="allergen-h">${esc(t(lang, 'menu.allergenTitle'))}</h2><p>${esc(t(lang, 'menu.allergenText'))}</p></aside>
  <div class="print-qr" data-print-qr hidden></div>
</div>
<dialog class="dialog" id="qr-dialog" aria-labelledby="qr-title">
  <h2 id="qr-title">${esc(t(lang, 'menu.qrTitle'))}</h2>
  <div class="qr-box" data-qr-box></div>
  <p>${esc(t(lang, 'menu.qrText'))}</p>
  <p class="small"><strong>${esc(t(lang, 'menu.qrUrl'))}:</strong> <code data-qr-url></code></p>
  <p class="small muted">${esc(t(lang, 'menu.qrDemoNote'))}</p>
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
  const cards = EVENTS.map((e) => `<article class="card event"><span class="tag">${esc(t(lang, 'events.sampleBadge'))}</span><h2 class="card-title">${esc(L(e.title, lang))}</h2><p>${esc(L(e.blurb, lang))}</p></article>`).join('');
  const body = `${pageHead(lang, 'events', t(lang, 'events.lead'))}
<div class="wrap">
  <div class="split events-intro">${musicFigure(c, lang)}<div><p class="notice">${esc(t(lang, 'events.noDates'))}</p><div class="cards1">${cards}</div></div></div>
  <section class="section-sm" aria-labelledby="cal-h"><h2 id="cal-h">${esc(t(lang, 'events.calendar'))}</h2><div id="calendar-root"></div></section>
  <section class="section-sm" id="inquiry" aria-labelledby="inq-h"><h2 id="inq-h">${esc(t(lang, 'events.inquiryTitle'))}</h2><p>${esc(t(lang, 'events.inquiryLead'))}</p><div id="inquiry-root"><noscript><p class="notice">${esc(t(lang, 'cta.bookNote'))} ${esc(VENUE.phoneDisplay)}</p></noscript></div></section>
</div>`;
  return { title: t(lang, 'events.title'), desc: t(lang, 'events.desc'), body, scripts: ['events.js'] };
}

function offersPage(c, lang) {
  const cards = OFFERS.map((o) => `<article class="card offer"><span class="tag ${o.status === 'concept' ? 'tag-concept' : 'tag-existing'}">${esc(o.status === 'concept' ? t(lang, 'offers.concept') : t(lang, 'offers.existing'))}</span><h2 class="card-title">${esc(L(o.title, lang))}</h2><p>${esc(L(o.blurb, lang))}</p>${o.id === 'student-id' ? `<p class="small muted">${esc(t(lang, 'offers.studentNote'))}</p>` : ''}</article>`).join('');
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
<div class="wrap split-2">
  <div>
    <h2 class="h-small">${esc(t(lang, 'contact.address'))}</h2><address>${esc(addr)}</address>
    <h2 class="h-small">${esc(t(lang, 'contact.phone'))}</h2><p><a class="big-phone" href="tel:${VENUE.phoneTel}">+30 ${esc(VENUE.phoneDisplay)}</a></p>
    <p><a class="btn btn-primary" href="tel:${VENUE.phoneTel}">${esc(t(lang, 'cta.call'))}</a> <a class="btn btn-ghost" href="${VENUE.mapsQuery}" target="_blank" rel="noopener">${esc(t(lang, 'contact.openGoogle'))}</a> <a class="btn btn-ghost" href="${VENUE.osmQuery}" target="_blank" rel="noopener">${esc(t(lang, 'contact.openOsm'))}</a></p>
    <h2 class="h-small">${esc(t(lang, 'contact.social'))}</h2>
    <p><a href="${VENUE.instagram.url}" target="_blank" rel="noopener me">Instagram @${esc(VENUE.instagram.handle)}</a></p>
    <p class="small muted">${esc(t(lang, 'contact.instagramNote'))} NEEDS OWNER VERIFICATION</p>
    <h2 class="h-small">${esc(t(lang, 'contact.mapTitle'))}</h2><p class="muted">${esc(t(lang, 'contact.mapText'))}</p>
  </div>
  <div><h2>${esc(t(lang, 'contact.formTitle'))}</h2><p class="muted">${esc(t(lang, 'contact.formLead'))}</p><div id="contact-root"></div></div>
</div>`;
  return { title: t(lang, 'contact.title'), desc: t(lang, 'contact.desc'), body, scripts: ['contact.js'] };
}

function privacyPage(c, lang) {
  const el = `
<h2>Πρόχειρο κείμενο</h2><p>Αυτό είναι πρόχειρο κείμενο για το demo και <strong>δεν αποτελεί νομική συμβουλή</strong>. Πριν τη λειτουργία πρέπει να ελεγχθεί από νομικό σύμβουλο και να συμπληρωθεί από τον υπεύθυνο επεξεργασίας.</p>
<h2>Υπεύθυνος επεξεργασίας</h2><p>Επωνυμία, ΑΦΜ, διεύθυνση και email επικοινωνίας του καταστήματος: <strong>προς συμπλήρωση από τον ιδιοκτήτη</strong>.</p>
<h2>Τι αποθηκεύει το demo</h2><ul><li>Γλώσσα που επιλέξατε (<code>tsb.lang</code>).</li><li>Καλάθι, δοκιμαστικές παραγγελίες, αιτήματα και ρυθμίσεις, μόνο στον δικό σας περιηγητή (localStorage). Δεν στέλνονται σε διακομιστή.</li><li>Αν αποδεχτείτε τα "αναλυτικά (demo)", απλά γεγονότα (π.χ. προβολή σελίδας) καταγράφονται τοπικά στον περιηγητή σας. Δεν φορτώνεται υπηρεσία τρίτου.</li></ul>
<h2>Στην παραγωγή</h2><ul><li>Σκοπός και νομική βάση: εκτέλεση παραγγελίας (σύμβαση) και απάντηση σε αιτήματα. Στοιχεία: όνομα, τηλέφωνο, περιεχόμενο παραγγελίας, προαιρετικά email.</li><li>Χρόνος διατήρησης: να οριστεί (π.χ. διαγραφή αιτημάτων μετά από συγκεκριμένο διάστημα).</li><li>Δικαιώματα: πρόσβαση, διόρθωση, διαγραφή, περιορισμός, εναντίωση, φορητότητα, καταγγελία στην Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα.</li><li>Εκτελούντες την επεξεργασία (π.χ. πάροχος βάσης δεδομένων, email/SMS): να καταγραφούν με συμβάσεις επεξεργασίας.</li><li>Cookies: μόνο απαραίτητα χωρίς συγκατάθεση. Αναλυτικά ή διαφημιστικά εργαλεία μόνο με προηγούμενη συγκατάθεση. Ενσωματωμένοι χάρτες φορτώνονται μόνο με συγκατάθεση.</li></ul>`;
  const en = `
<h2>Draft text</h2><p>This is draft text for the demo and <strong>is not legal advice</strong>. Before launch it must be reviewed by a lawyer and completed by the data controller.</p>
<h2>Data controller</h2><p>Legal name, VAT number, address and contact email of the venue: <strong>to be completed by the owner</strong>.</p>
<h2>What the demo stores</h2><ul><li>The language you chose (<code>tsb.lang</code>).</li><li>Cart, trial orders, requests and settings, only in your own browser (localStorage). Nothing is sent to a server.</li><li>If you accept "analytics (demo)", simple events (e.g. page view) are recorded locally in your browser. No third-party service is loaded.</li></ul>
<h2>In production</h2><ul><li>Purpose and legal basis: fulfilling an order (contract) and replying to requests. Data: name, phone, order contents, optionally email.</li><li>Retention period: to be defined (e.g. delete requests after a set period).</li><li>Rights: access, rectification, erasure, restriction, objection, portability, and a complaint to the Hellenic Data Protection Authority.</li><li>Processors (e.g. database host, email/SMS provider): to be listed with data processing agreements.</li><li>Cookies: strictly necessary ones need no consent. Analytics or advertising tools only after prior consent. Embedded maps load only with consent.</li></ul>`;
  const body = `<section class="page-head"><div class="wrap narrow"><h1>${esc(lang === 'el' ? 'Απόρρητο & Cookies (πρόχειρο)' : 'Privacy & Cookies (draft)')}</h1>${svgLeaf}</div></section><div class="wrap narrow prose">${lang === 'el' ? el : en}</div>`;
  return { title: t(lang, 'privacy.title'), desc: t(lang, 'privacy.desc'), body };
}

function adminPage(c, lang) {
  const body = `<section class="page-head"><div class="wrap"><h1>${esc(t(lang, 'admin.h1'))}</h1></div></section>
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
