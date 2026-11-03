import { lang, T, $, $$, adapter, esc } from './core.js';
import { eur } from './shared/money.js';
import { menuQr } from './qrtools.js';

// Apply staff overrides (price, sold out, hidden, images) from the demo adapter to the pre-rendered menu.
const menu = adapter.getMenu();
const images = adapter.getImages();
for (const it of menu.items) {
  const li = $(`[data-item="${it.id}"]`);
  if (!li) continue;
  if (it.hidden) { li.remove(); continue; }
  li.classList.toggle('is-unavailable', !it.available);
  $(`[data-unavail-for="${it.id}"]`, li).hidden = it.available;
  const price = $(`[data-price-for="${it.id}"]`, li);
  if (it.optionGroups?.length) {
    const [a, b] = it.optionGroups[0].options;
    price.innerHTML = `${esc(eur(it.price + a.priceDelta, lang))} <span class="muted">/ ${esc(a.label[lang])}</span><br>${esc(eur(it.price + b.priceDelta, lang))} <span class="muted">/ ${esc(b.label[lang])}</span>`;
  } else price.textContent = eur(it.price, lang);
  const src = images[`item:${it.id}`];
  if (src) {
    const th = $(`[data-thumb-for="${it.id}"]`, li);
    th.innerHTML = `<img alt="" loading="lazy">`;
    th.firstElementChild.src = src;
    th.hidden = false;
  }
}
// categories left empty after hiding items disappear from the page and the category nav
$$('.menu-cat').forEach((sec) => {
  if (!$('.dish', sec)) { $(`.cat-nav a[href="#${sec.id}"]`)?.closest('li').remove(); sec.remove(); }
});

// Highlight the category currently in view
const links = new Map($$('.cat-nav a').map((a) => [a.getAttribute('href').slice(1), a]));
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { links.forEach((a) => a.classList.remove('active')); links.get(en.target.id)?.classList.add('active'); }
  }), { rootMargin: '-30% 0px -60% 0px' });
  $$('.menu-cat').forEach((s) => io.observe(s));
}

// Table QR support: /menu/?table=12 shows a table chip. It is display only: the QR menu has no ordering.
const table = new URLSearchParams(location.search).get('table');
const chip = $('[data-table-chip]');
const tableOk = table && /^\d{1,3}$/.test(table);
if (tableOk) { chip.textContent = `${T('menu.table')} ${table}`; chip.hidden = false; }

const qrUrl = () => location.origin + location.pathname + (tableOk ? `?table=${table}` : '');
let svgCache = null;
async function qrSvgNow() {
  if (!svgCache || svgCache.url !== qrUrl()) svgCache = { url: qrUrl(), svg: await menuQr(qrUrl(), T('menu.qrTitle')) };
  return svgCache;
}
const tent = $('[data-qr-box]');
qrSvgNow().then(({ svg, url }) => { tent.innerHTML = svg; $('[data-qr-url]').textContent = url; });

const dlg = $('#qr-dialog');
const openBtn = $('[data-open-qr]');
if (dlg && typeof dlg.showModal === 'function') {
  openBtn.hidden = false;
  openBtn.addEventListener('click', async () => {
    const { svg, url } = await qrSvgNow();
    $('[data-qr-box-dialog]', dlg).innerHTML = svg;
    $('[data-qr-url-dialog]', dlg).textContent = url;
    dlg.showModal();
  });
  $$('[data-close-dialog]', dlg).forEach((b) => b.addEventListener('click', () => dlg.close()));
}
$$('[data-print]').forEach((b) => b.addEventListener('click', () => {
  dlg?.open && dlg.close();
  document.body.classList.toggle('print-card-only', !b.closest('#qr-dialog'));
  window.print();
}));
window.addEventListener('afterprint', () => document.body.classList.remove('print-card-only'));
