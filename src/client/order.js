import { lang, T, $, $$, esc, adapter, storage, route, uuid, track, setFieldError, fmtTime } from './core.js';
import { eur } from './shared/money.js';
import { L } from './shared/strings.js';
import { emptyCart, addLine, setQty, removeLine, totals, MAX_QTY_PER_LINE, MAX_NOTE_LENGTH } from './shared/cart.js';
import { pickupMode } from './shared/hours.js';

const CART_KEY = 'tsb.cart.v1';
const IDEM_KEY = 'tsb.idem.v1';
const root = $('#order-root');
let cart = storage.get(CART_KEY, emptyCart());
let submitting = false;
const menuNow = () => adapter.getMenu();
const saveCart = () => storage.set(CART_KEY, cart);
const errText = (e) => T(`order.errors.${e.code}`) !== `order.errors.${e.code}` ? T(`order.errors.${e.code}`) : T('order.errors.generic');

function optLabel(item, optionIds) {
  return (item.optionGroups ?? []).flatMap((g) => g.options.filter((o) => optionIds.includes(o.id)).map((o) => L(o.label, lang))).join(', ');
}

function renderShell() {
  root.innerHTML = `<div class="order-grid">
    <div id="o-menu" aria-label="${esc(T('nav.menu'))}"></div>
    <aside class="cart" id="cart" aria-labelledby="cart-h">
      <h2 id="cart-h">${esc(T('order.cart'))}</h2>
      <div id="cart-lines" aria-live="polite"></div>
      <form id="checkout" novalidate>
        <h3>${esc(T('order.yourDetails'))}</h3>
        <div class="field"><label for="f-name">${esc(T('order.name'))}</label><input id="f-name" name="name" type="text" autocomplete="name" maxlength="80" required></div>
        <div class="field"><label for="f-phone">${esc(T('order.phone'))}</label><input id="f-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required aria-describedby="f-phone-hint"><span class="hint" id="f-phone-hint">${esc(T('order.phoneHint'))}</span></div>
        <div id="pickup-box"></div>
        <p class="small muted" id="pay-note">${esc(T('order.payment'))}</p>
        <p class="small muted" id="price-note">${esc(T('order.priceNote'))}</p>
        <button class="btn btn-primary" id="submit" type="submit" style="width:100%">${esc(T('order.submit'))}</button>
        <div id="form-msg" class="error" role="alert"></div>
      </form>
    </aside>
  </div>
  <a class="cart-fab btn btn-primary" id="cart-fab" href="#cart" hidden></a>
  <dialog class="dialog" id="item-dialog" aria-labelledby="item-dialog-h"></dialog>`;
  renderMenu();
  $('#checkout').addEventListener('submit', onSubmit);
  $('#item-dialog').addEventListener('close', () => { if (!$('#item-dialog').open) $('#item-dialog').innerHTML = ''; });
  renderPickup();
  renderCart();
}

function renderMenu() {
  const menu = menuNow();
  $('#o-menu').innerHTML = [...menu.categories].sort((a, b) => a.order - b.order).map((c) => {
    const items = menu.items.filter((i) => i.cat === c.id).map((i) => {
      const from = i.optionGroups?.length ? `${T('menu.from')} ` : '';
      return `<div class="o-item"><div><div class="nm">${esc(L(i.name, lang))}</div><div class="pr">${from}${esc(eur(i.price, lang))}${i.available ? '' : ` · ${esc(T('menu.unavailable'))}`}</div></div>
      <button class="btn btn-ghost btn-sm" type="button" data-add="${i.id}" ${i.available ? '' : 'disabled'} aria-label="${esc(T('order.add'))}: ${esc(L(i.name, lang))}">${esc(T('order.add'))}</button></div>`;
    }).join('');
    return `<section class="o-cat"><h2>${esc(L(c.name, lang))}</h2>${items}</section>`;
  }).join('');
  $$('[data-add]').forEach((b) => b.addEventListener('click', () => openItemDialog(b.dataset.add, b)));
}

function openItemDialog(itemId, opener) {
  const item = menuNow().items.find((i) => i.id === itemId);
  const dlg = $('#item-dialog');
  const groups = (item.optionGroups ?? []).map((g) => `<fieldset class="opt-group"><legend>${esc(L(g.label, lang))}</legend>${g.options.map((o, idx) => {
    const type = g.max === 1 ? 'radio' : 'checkbox';
    return `<label class="opt-choice"><input type="${type}" name="g-${g.id}" value="${o.id}" ${type === 'radio' && idx === 0 && g.required ? 'checked' : ''}> <span>${esc(L(o.label, lang))}${o.priceDelta ? ` (+${esc(eur(o.priceDelta, lang))})` : ''}</span></label>`;
  }).join('')}</fieldset>`).join('');
  dlg.innerHTML = `<form method="dialog" id="item-form" novalidate><h2 id="item-dialog-h">${esc(L(item.name, lang))}</h2>
    <p class="price">${esc(eur(item.price, lang))}</p>${groups}
    <div class="field"><label for="d-qty">${esc(T('order.qty'))}</label><input id="d-qty" type="number" min="1" max="${MAX_QTY_PER_LINE}" value="1" inputmode="numeric"></div>
    <div class="field"><label for="d-note">${esc(T('order.note'))}</label><textarea id="d-note" maxlength="${MAX_NOTE_LENGTH}" aria-describedby="d-note-h"></textarea><span class="hint" id="d-note-h">${esc(T('order.noteHint'))}</span></div>
    <div class="error" id="d-err" role="alert"></div>
    <div class="dialog-actions"><button class="btn btn-primary" type="submit" id="d-add">${esc(T('order.addToCart'))}</button><button class="btn btn-ghost" type="button" id="d-cancel">${esc(T('order.cancel'))}</button></div></form>`;
  $('#d-cancel').addEventListener('click', () => dlg.close());
  $('#item-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const optionIds = $$('#item-form input[type=radio]:checked, #item-form input[type=checkbox]:checked').map((i) => i.value);
    try {
      cart = addLine(cart, menuNow(), { itemId, optionIds, qty: Number($('#d-qty').value), note: $('#d-note').value });
      saveCart(); track('add_to_cart', { itemId });
      dlg.close(); renderCart(); opener?.focus();
    } catch (err) { $('#d-err').textContent = errText(err); }
  });
  dlg.showModal();
}

function renderCart() {
  const menu = menuNow();
  const tt = totals(menu, cart);
  const box = $('#cart-lines');
  if (!tt.lines.length) box.innerHTML = `<p class="muted" id="cart-empty">${esc(T('order.cartEmpty'))}</p>`;
  else {
    box.innerHTML = tt.lines.map((l) => {
      const item = menu.items.find((i) => i.id === l.itemId);
      const opt = optLabel(item, l.optionIds);
      const bad = tt.problems.includes(`UNAVAILABLE:${l.itemId}`);
      return `<div class="cart-line" data-key="${esc(l.key)}"><div><strong>${esc(L(l.name, lang))}</strong>${bad ? ` <span class="error">${esc(T('menu.unavailable'))}</span>` : ''}</div><div class="price">${esc(eur(l.total, lang))}</div>
      ${opt || l.note ? `<div class="opt">${esc([opt, l.note && `"${l.note}"`].filter(Boolean).join(' · '))}</div>` : ''}
      <div class="qty"><button type="button" data-dec aria-label="${esc(T('order.decrease'))}">−</button><output aria-label="${esc(T('order.qty'))}">${l.qty}</output><button type="button" data-inc aria-label="${esc(T('order.increase'))}">+</button></div>
      <div><button class="link-btn" type="button" data-rm>${esc(T('order.remove'))}</button></div></div>`;
    }).join('') + `<div class="total-row"><span>${esc(T('order.subtotal'))}</span><span id="cart-total">${esc(eur(tt.subtotal, lang))}</span></div>`;
    $$('.cart-line', box).forEach((row) => {
      const key = row.dataset.key; const line = cart.lines.find((x) => x.key === key);
      $('[data-inc]', row).addEventListener('click', () => mutate(() => setQty(cart, key, Math.min(line.qty + 1, MAX_QTY_PER_LINE))));
      $('[data-dec]', row).addEventListener('click', () => mutate(() => setQty(cart, key, line.qty - 1)));
      $('[data-rm]', row).addEventListener('click', () => mutate(() => removeLine(cart, key)));
    });
  }
  const fab = $('#cart-fab');
  fab.hidden = !tt.itemCount;
  fab.textContent = `${T('order.cart')} (${tt.itemCount}) · ${eur(tt.subtotal, lang)}`;
}
function mutate(fn) { try { cart = fn(); saveCart(); renderCart(); } catch (e) { $('#form-msg').textContent = errText(e); } }

let mode = null;
function renderPickup() {
  const settings = adapter.getSettings();
  mode = pickupMode(new Date(), settings);
  const box = $('#pickup-box'); const btn = $('#submit');
  btn.disabled = submitting || mode.mode === 'paused';
  if (mode.mode === 'paused') { box.innerHTML = `<p class="notice" id="paused-note">${esc(T('order.paused'))}</p>`; return; }
  const prev = $('#f-pickup')?.value ?? '';
  const prep = `<p class="small muted">${esc(T('order.prepNote', { n: settings.prepMinutes }))}</p>`;
  if (mode.mode === 'slots') {
    box.innerHTML = `<div class="field"><label for="f-pickup">${esc(T('order.pickupSlot'))}</label><select id="f-pickup">${mode.slots.map((s) => `<option value="${s}">${fmtTime(s)}</option>`).join('')}</select></div>${prep}`;
  } else {
    const hint = mode.reason === 'closed' ? T('order.closedHint') : T('order.manualHint');
    box.innerHTML = `<div class="field"><label for="f-pickup">${esc(T('order.pickupManual'))}</label><input id="f-pickup" type="text" maxlength="120" aria-describedby="f-pickup-hint" required><span class="hint" id="f-pickup-hint">${esc(hint)}</span></div>${prep}`;
    if (prev) $('#f-pickup').value = prev;
  }
}

async function onSubmit(e) {
  e.preventDefault();
  if (submitting) return; // double-click / double-tap guard
  const msg = $('#form-msg'); msg.textContent = '';
  const name = $('#f-name'); const phone = $('#f-phone'); const pk = $('#f-pickup');
  [name, phone, pk].forEach((i) => i && setFieldError(i, ''));
  if (!cart.lines.length) { msg.textContent = T('order.errors.EMPTY_CART'); return; }
  const pickup = mode.mode === 'slots' ? { mode: 'slot', requestedAt: pk.value } : { mode: 'manual', manualText: pk?.value ?? '' };
  submitting = true; $('#submit').disabled = true; $('#submit').textContent = T('order.submitting');
  try {
    await new Promise((r) => setTimeout(r, 350)); // simulates network latency; makes double-submit protection observable
    let key = storage.get(IDEM_KEY, null);
    if (!key) { key = uuid(); storage.set(IDEM_KEY, key); }
    const { order, duplicate } = adapter.submitOrder({ cart, customer: { name: name.value, phone: phone.value }, pickup, idempotencyKey: key });
    storage.remove(IDEM_KEY); cart = emptyCart(); saveCart(); track('order_submitted_demo');
    showConfirmation(order, duplicate);
    return;
  } catch (err) {
    const target = { BAD_NAME: name, BAD_PHONE: phone, BAD_PICKUP: pk }[err.code];
    if (target) { setFieldError(target, errText(err)); target.focus(); } else msg.textContent = errText(err);
  }
  submitting = false; $('#submit').textContent = T('order.submit'); renderPickup(); renderCart();
}

function showConfirmation(order, duplicate) {
  submitting = false;
  root.innerHTML = `<section class="success" role="status" tabindex="-1" id="confirm"><h2>${esc(T('order.confirmTitle'))}</h2>
  <p>${esc(duplicate ? T('order.confirmDup', { id: order.id }) : T('order.confirmText', { id: order.id }))}</p>
  <p><strong>${esc(eur(order.subtotal, lang))}</strong> · ${esc(T('order.payment'))}</p>
  <p><button class="btn btn-primary" type="button" id="new-order">${esc(T('order.newOrder'))}</button> <a class="btn btn-ghost" href="${route('admin')}">${esc(T('order.viewAdmin'))}</a></p></section>`;
  $('#confirm').focus();
  $('#new-order').addEventListener('click', () => { renderShell(); });
}

renderShell();
setInterval(() => { if (!submitting && $('#pickup-box')) renderPickup(); }, 60000);
window.addEventListener('storage', () => { if ($('#o-menu')) { renderMenu(); renderCart(); renderPickup(); } });
