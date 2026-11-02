import { lang, T, $, $$, adapter, esc } from './core.js';
import { eur } from './shared/money.js';
import { qrSvg } from './shared/qr.js';

// Apply staff price/availability overrides (demo adapter) to the pre-rendered menu.
const menu = adapter.getMenu();
for (const it of menu.items) {
  const li = $(`[data-item="${it.id}"]`); if (!li) continue;
  li.classList.toggle('is-unavailable', !it.available);
  $(`[data-unavail-for="${it.id}"]`, li).hidden = it.available;
  const price = $(`[data-price-for="${it.id}"]`, li);
  if (it.optionGroups?.length) {
    const [a, b] = it.optionGroups[0].options;
    price.innerHTML = `${esc(eur(it.price + a.priceDelta, lang))} <span class="muted">/ ${esc(a.label[lang])}</span><br>${esc(eur(it.price + b.priceDelta, lang))} <span class="muted">/ ${esc(b.label[lang])}</span>`;
  } else price.textContent = eur(it.price, lang);
}

// Table QR support: /menu/?table=12 shows a table chip (display only; no ordering is attached to a table in the demo).
const table = new URLSearchParams(location.search).get('table');
const chip = $('[data-table-chip]');
if (table && /^\d{1,3}$/.test(table)) { chip.textContent = `${T('menu.table')} ${table}`; chip.hidden = false; }

const dlg = $('#qr-dialog');
const openBtn = $('[data-open-qr]');
function qrUrl() { return location.origin + location.pathname + (chip.hidden ? '' : `?table=${table}`); }
function fillQr(target) { target.innerHTML = qrSvg(qrUrl(), { label: T('menu.qrTitle') }); }
if (dlg && typeof dlg.showModal === 'function') {
  openBtn.hidden = false;
  openBtn.addEventListener('click', () => {
    fillQr($('[data-qr-box]', dlg));
    $('[data-qr-url]', dlg).textContent = qrUrl();
    dlg.showModal();
  });
  $$('[data-close-dialog]', dlg).forEach((b) => b.addEventListener('click', () => dlg.close()));
  $('[data-print]', dlg).addEventListener('click', () => { dlg.close(); window.print(); });
}
const pq = $('[data-print-qr]');
window.addEventListener('beforeprint', () => { fillQr(pq); pq.insertAdjacentHTML('beforeend', `<p class="small">${esc(qrUrl())}</p>`); pq.hidden = false; });
window.addEventListener('afterprint', () => { pq.hidden = true; pq.innerHTML = ''; });
