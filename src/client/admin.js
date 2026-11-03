// Staff admin (DEMO). The login below is a PUBLIC FIXTURE with no security value: it only demonstrates role gating.
// Production needs real authentication (e.g. Supabase Auth) and server-side RLS/policy enforcement.
import { lang, T, $, $$, esc, adapter, storage, toast, fmtDateTime, uuid, base } from './core.js';
import { eur, toCents } from './shared/money.js';
import { L } from './shared/strings.js';
import { TRANSITIONS, ROLE_TRANSITIONS, can, OrderError } from './shared/orders.js';
import { emptyCart, addLine } from './shared/cart.js';
import { LATEST_POSTS, PAST_POSTS, EVENTS } from './shared/social-data.js';
import { menuQr, downloadText, downloadPng } from './qrtools.js';

const FIXTURE = { owner: 'owner-demo', staff: 'staff-demo', kitchen: 'kitchen-demo' };
const SESSION = 'tsb.admin.session';
const root = $('#admin-root');
let session = null;
try { session = JSON.parse(sessionStorage.getItem(SESSION) || 'null'); } catch { session = null; }
let tab = 'orders';
let filter = 'all';
let seen = null;
let audio = null;
let soundOn = false;
let sig = '';
let qrState = { url: '', table: '' };

const A = (p) => T('admin.' + p);
const EDITING = ['menu', 'media', 'qr', 'settings'];

function renderLogin(msg = '') {
  root.innerHTML = `<form class="login" id="login" novalidate><div class="fixture" role="note"><strong>${esc(A('demoBox'))}</strong>
  <p>${Object.entries(FIXTURE).map(([u, p]) => `<code>${u}</code> / <code>${p}</code>`).join(' &nbsp; ')}</p></div>
  <div class="field"><label for="a-user">${esc(A('user'))}</label><input id="a-user" type="text" autocomplete="username" required></div>
  <div class="field"><label for="a-pass">${esc(A('pass'))}</label><input id="a-pass" type="password" autocomplete="current-password" required></div>
  <div class="error" role="alert" id="a-err">${esc(msg)}</div>
  <button class="btn btn-primary" type="submit">${esc(A('login'))}</button></form>`;
  $('#login').addEventListener('submit', (e) => {
    e.preventDefault();
    const u = $('#a-user').value.trim().toLowerCase(); const p = $('#a-pass').value;
    if (FIXTURE[u] && FIXTURE[u] === p) {
      session = { user: u, role: u };
      try { sessionStorage.setItem(SESSION, JSON.stringify(session)); } catch { /* memory only */ }
      adapter.saveSettings({});
      seen = null; render();
    } else renderLogin(A('badLogin'));
  });
}

function logout() { session = null; try { sessionStorage.removeItem(SESSION); } catch { /* ignore */ } renderLogin(); }

function beep() {
  if (!soundOn || !audio) return;
  try {
    const o = audio.createOscillator(); const g = audio.createGain();
    o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.12;
    o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.25);
  } catch { /* sound is optional */ }
}

const tabsFor = (role) => ['orders', 'menu', 'media', 'qr', 'settings', ...(can(role, 'reports') ? ['reports'] : []), 'audit'];

function render() {
  if (!session) return renderLogin();
  const role = session.role;
  const orders = adapter.listOrders();
  const ids = new Set(orders.map((o) => o.id));
  const fresh = seen ? orders.filter((o) => !seen.has(o.id)).map((o) => o.id) : [];
  if (fresh.length) beep();
  seen = ids;
  if (!tabsFor(role).includes(tab)) tab = 'orders';
  const views = { orders: ordersView, menu: menuView, media: mediaView, qr: qrView, settings: settingsView, reports: reportsView, audit: auditView };
  root.innerHTML = `<div class="admin-bar"><span class="grow"><strong>${esc(A('roles.' + role))}</strong> (${esc(session.user)}) <span class="badge">${esc(T('common.demo'))}</span></span>
    <button class="btn btn-ghost btn-sm" type="button" id="snd" aria-pressed="${soundOn}">${esc(soundOn ? A('soundOn') : A('soundOff'))}</button>
    <button class="btn btn-ghost btn-sm" type="button" id="out">${esc(A('logout'))}</button></div>
  <div class="tabs" role="tablist" aria-label="${esc(A('h1'))}">${tabsFor(role).map((k) => `<button role="tab" id="tab-${k}" aria-selected="${k === tab}" aria-controls="panel" data-tab="${k}">${esc(A('tabs.' + k))}</button>`).join('')}</div>
  <div id="panel" role="tabpanel" aria-labelledby="tab-${tab}">${views[tab](orders, role, fresh)}</div>`;
  sig = JSON.stringify([orders, adapter.getSettings(), tab, soundOn, filter]);
  bind(role);
  if (tab === 'qr') drawQr();
}

function lineText(l) { return `${l.qty}× ${L(l.name, lang)}${l.note ? ` ("${l.note}")` : ''}`; }
function pickupText(o) { return o.pickup.mode === 'slot' ? fmtDateTime(o.pickup.requestedAt) : o.pickup.mode === 'manual' ? `"${o.pickup.manualText}"` : 'ASAP'; }
const ftype = (o) => o.fulfilment?.type ?? 'takeaway';

function orderCard(o, role, fresh) {
  const acts = TRANSITIONS[o.status].filter((to) => ROLE_TRANSITIONS[role].includes(to));
  const del = ftype(o) === 'delivery';
  const a = o.fulfilment?.address;
  const addr = del && a ? `<div class="addr"><strong>${esc(A('address'))}:</strong> ${esc(`${a.street} ${a.number}, ${a.area} ${a.postcode}`)}${a.floor ? `, ${esc(A('floor'))} ${esc(a.floor)}` : ''}${a.bell ? `, ${esc(A('bell'))} ${esc(a.bell)}` : ''}${a.notes ? ` (${esc(a.notes)})` : ''}</div>` : '';
  return `<article class="ord ${fresh.includes(o.id) ? 'is-new' : ''}" data-id="${esc(o.id)}" data-version="${o.version}" data-type="${ftype(o)}" aria-label="${esc(o.id)}">
  <header><span>${esc(o.id)}</span><span>${esc(eur(o.subtotal, lang))}</span></header>
  <div class="badges"><span class="badge type-${ftype(o)}">${esc(A(ftype(o)))}</span><span class="badge">${esc(A(o.payment ?? 'cash'))}</span>${o.paid ? '' : `<span class="badge warn">${esc(A('unpaid'))}</span>`}${o.simulated ? '<span class="badge sim">SIM</span>' : ''}</div>
  <div>${esc(o.customer.name)} · <a href="tel:${esc(o.customer.phone.replace(/\s/g, ''))}">${esc(o.customer.phone)}</a></div>
  ${addr}
  <div>${esc(A('pickup'))}: ${esc(pickupText(o))}</div>
  <ul>${o.lines.map((l) => `<li>${esc(lineText(l))}</li>`).join('')}</ul>
  <div class="small muted">${esc(A('version'))}${o.version} · ${esc(fmtDateTime(o.createdAt))}</div>
  <div class="acts">${acts.map((to) => `<button class="btn ${to === 'rejected' || to === 'cancelled' ? 'btn-ghost' : 'btn-primary'} btn-sm" type="button" data-act="${to}">${esc(A('act.' + to))}</button>`).join('')}</div></article>`;
}

function ordersView(all, role, fresh) {
  const orders = filter === 'all' ? all : all.filter((o) => ftype(o) === filter);
  const cols = ['pending', 'confirmed', 'preparing', 'ready'];
  const done = orders.filter((o) => !cols.includes(o.status));
  const sim = can(role, 'simulate') ? `<button class="btn btn-primary btn-sm" type="button" id="sim">${esc(A('simulate'))}</button>` : '';
  const board = cols.map((s) => {
    const list = orders.filter((o) => o.status === s);
    return `<section class="col" aria-labelledby="col-${s}"><h3 id="col-${s}">${esc(A('cols.' + s))} <span class="badge">${list.length}</span></h3>${list.map((o) => orderCard(o, role, fresh)).join('') || `<p class="small muted">${esc(A('noOrders'))}</p>`}</section>`;
  }).join('');
  const seg = ['all', 'takeaway', 'delivery'].map((f) => `<button type="button" data-filter="${f}" aria-pressed="${filter === f}">${esc(A(f))}</button>`).join('');
  return `<div class="admin-bar">${sim}<button class="btn btn-ghost btn-sm" type="button" id="reset">${esc(A('reset'))}</button><span class="grow"></span><span class="small muted">${esc(A('filter'))}</span><div class="seg" role="group" aria-label="${esc(A('filter'))}">${seg}</div></div>
  <div class="board">${board}</div>
  <h3 style="margin-top:2rem">${esc(A('history'))}</h3>
  ${done.length ? `<table class="table"><tbody>${done.map((o) => `<tr><td>${esc(o.id)}</td><td>${esc(A(ftype(o)))}</td><td>${esc(o.customer.name)}</td><td>${esc(A('status.' + o.status))}${o.audit.at(-1).reason ? ` (${esc(o.audit.at(-1).reason)})` : ''}</td><td>${esc(eur(o.subtotal, lang))}</td></tr>`).join('')}</tbody></table>` : `<p class="muted">${esc(A('noOrders'))}</p>`}`;
}

function statusOf(i) { return i.hidden ? 'hidden' : i.available ? 'available' : 'soldout'; }

function menuView(orders, role) {
  const menu = adapter.getMenu();
  const images = adapter.getImages();
  const priceOk = can(role, 'prices');
  return `<p class="notice">${esc(priceOk ? '' : A('ownerOnlyPrice'))} ${esc(T('menu.pricesNote'))} ${esc(A('imgHint'))}</p>
  <div class="adm-items">${menu.items.map((i) => {
    const img = images[`item:${i.id}`];
    return `<div class="adm-item" data-item="${i.id}"><div class="thumb">${img ? `<img src="${esc(img)}" alt="">` : `<span class="small muted">${esc(A('noImage'))}</span>`}</div>
    <div class="grow"><strong>${esc(L(i.name, lang))}</strong>
      <div class="adm-row"><label>${esc(A('price'))} <input type="text" inputmode="decimal" data-price="${i.id}" value="${(i.price / 100).toFixed(2)}" ${priceOk ? '' : 'disabled'} aria-label="${esc(A('price'))}: ${esc(L(i.name, lang))}"></label>
      <label>${esc(A('itemStatus'))} <select data-status="${i.id}" aria-label="${esc(A('itemStatus'))}: ${esc(L(i.name, lang))}">${['available', 'soldout', 'hidden'].map((s) => `<option value="${s}" ${statusOf(i) === s ? 'selected' : ''}>${esc(A('status_' + s))}</option>`).join('')}</select></label></div>
      <div class="adm-row"><label class="btn btn-ghost btn-sm">${esc(A('upload'))}<input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" data-upload="item:${i.id}" aria-label="${esc(A('upload'))}: ${esc(L(i.name, lang))}"></label>${img ? `<button class="btn btn-ghost btn-sm" type="button" data-rmimg="item:${i.id}">${esc(A('removeImg'))}</button>` : ''}</div>
    </div></div>`;
  }).join('')}</div>`;
}

function mediaCard(key, title, url) {
  const img = adapter.getImages()[key];
  return `<div class="adm-item"><div class="thumb">${img ? `<img src="${esc(img)}" alt="">` : `<span class="small muted">${esc(A('noImage'))}</span>`}</div>
  <div class="grow"><strong>${esc(title)}</strong>${url ? ` <a class="small" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(A('open'))}</a>` : ''}
  <div class="adm-row"><label class="btn btn-ghost btn-sm">${esc(A('upload'))}<input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" data-upload="${esc(key)}" aria-label="${esc(A('upload'))}: ${esc(title)}"></label>${img ? `<button class="btn btn-ghost btn-sm" type="button" data-rmimg="${esc(key)}">${esc(A('removeImg'))}</button>` : ''}</div></div></div>`;
}

function mediaView() {
  const posts = [...LATEST_POSTS, ...PAST_POSTS];
  return `<p class="notice">${esc(A('mediaLead'))} ${esc(A('imgHint'))}</p>
  <h3>${esc(A('mediaTitle'))}</h3><div class="adm-items">${posts.map((p) => mediaCard(`post:${p.id}`, `${p.id} (${p.posted})`, p.url)).join('')}</div>
  <h3>${esc(A('posterTitle'))}</h3><div class="adm-items">${EVENTS.map((e) => mediaCard(`event:${e.id}`, `${L(e.title, lang)} (${e.date})`)).join('')}</div>`;
}

function qrDefaultUrl() {
  const path = `${base}${lang === 'en' ? '/en/' : '/'}menu/`;
  return location.origin + path + (document.body.dataset.relative ? 'index.html' : '');
}

function qrFullUrl() {
  const u = qrState.url || qrDefaultUrl();
  return qrState.table && /^\d{1,3}$/.test(qrState.table) ? `${u}${u.includes('?') ? '&' : '?'}table=${qrState.table}` : u;
}

function qrView() {
  if (!qrState.url) qrState.url = qrDefaultUrl();
  return `<p class="notice">${esc(A('qrNote'))}</p>
  <div class="qr-admin"><div class="qr-fields">
    <div class="field"><label for="q-url">${esc(A('qrUrl'))}</label><input id="q-url" type="url" value="${esc(qrState.url)}"></div>
    <div class="field"><label for="q-table">${esc(A('qrTable'))}</label><input id="q-table" type="text" inputmode="numeric" maxlength="3" value="${esc(qrState.table)}"></div>
    <button class="btn btn-primary" type="button" id="q-gen">${esc(A('qrGen'))}</button>
    <div class="adm-row"><button class="btn btn-ghost btn-sm" type="button" id="q-svg">${esc(T('menu.qrDownloadSvg'))}</button><button class="btn btn-ghost btn-sm" type="button" id="q-png">${esc(T('menu.qrDownloadPng'))}</button><button class="btn btn-ghost btn-sm" type="button" id="q-print">${esc(T('menu.qrPrintCard'))}</button></div></div>
  <div class="qr-preview" id="q-box" aria-live="polite"></div></div>`;
}

let qrSvgText = '';
async function drawQr() {
  const url = qrFullUrl();
  qrSvgText = await menuQr(url, T('menu.qrTitle'));
  const box = $('#q-box');
  if (box) box.innerHTML = `${qrSvgText}<p class="small muted" data-qr-url>${esc(url)}</p>`;
}

function settingsView(orders, role) {
  const s = adapter.getSettings();
  const dis = can(role, 'pause') ? '' : 'disabled';
  return `<div class="login" style="max-width:520px">
  <div class="field"><label class="checkbox"><input type="checkbox" id="s-pause" ${s.paused ? 'checked' : ''} ${dis}> <span>${esc(A('pause'))}</span></label></div>
  <div class="field"><label class="checkbox"><input type="checkbox" id="s-takeaway" ${s.takeaway !== false ? 'checked' : ''} ${dis}> <span>${esc(A('takeawayOn'))}</span></label></div>
  <div class="field"><label class="checkbox"><input type="checkbox" id="s-delivery" ${s.delivery !== false ? 'checked' : ''} ${dis}> <span>${esc(A('deliveryOn'))}</span></label></div>
  <div class="field"><label for="s-prep">${esc(A('prep'))}</label><input id="s-prep" type="number" min="5" max="180" value="${s.prepMinutes}" ${can(role, 'prep_time') ? '' : 'disabled'}></div>
  ${can(role, 'prep_time') ? `<button class="btn btn-primary" type="button" id="s-save">${esc(A('save'))}</button>` : `<p class="small muted">${esc(A('forbidden'))}</p>`}</div>`;
}

function reportsView(orders) {
  const valid = orders.filter((o) => !['rejected', 'cancelled'].includes(o.status));
  const revenue = valid.reduce((a, o) => a + o.subtotal, 0);
  const top = {};
  valid.forEach((o) => o.lines.forEach((l) => { top[l.itemId] = top[l.itemId] || { name: l.name, qty: 0 }; top[l.itemId].qty += l.qty; }));
  const topRows = Object.values(top).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const an = storage.get('tsb.analytics', []);
  const by = (t) => valid.filter((o) => ftype(o) === t);
  return `<p class="notice">${esc(A('reportsNote'))}</p>
  <div class="stat-grid"><div class="stat"><span>${esc(A('repOrders'))}</span><b>${orders.length}</b></div><div class="stat"><span>${esc(A('repRevenue'))}</span><b>${esc(eur(revenue, lang))}</b></div>
  <div class="stat"><span>${esc(A('takeaway'))}</span><b>${by('takeaway').length}</b></div><div class="stat"><span>${esc(A('delivery'))}</span><b>${by('delivery').length}</b></div></div>
  <h3>${esc(A('repTop'))}</h3>${topRows.length ? `<table class="table"><tbody>${topRows.map((r) => `<tr><td>${esc(L(r.name, lang))}</td><td>${r.qty}</td></tr>`).join('')}</tbody></table>` : `<p class="muted">${esc(A('auditEmpty'))}</p>`}
  <h3>${esc(A('repAnalytics'))}</h3><p class="muted">${an.length} events</p>`;
}

function auditView(orders) {
  const rows = orders.flatMap((o) => o.audit.map((a) => ({ ...a, id: o.id }))).sort((a, b) => b.at.localeCompare(a.at));
  const log = adapter.eventLog();
  return `<h3>${esc(A('tabs.audit'))}</h3>${rows.length ? `<table class="table"><tbody>${rows.map((a) => `<tr><td>${esc(fmtDateTime(a.at))}</td><td>${esc(a.id)}</td><td>${esc(a.actor)}</td><td>${esc(a.from ?? '–')} → ${esc(a.to)}</td><td>${esc(a.reason ?? '')}</td></tr>`).join('')}</tbody></table>` : `<p class="muted">${esc(A('auditEmpty'))}</p>`}
  <h3>Event log</h3>${log.length ? `<table class="table"><tbody>${log.slice(0, 50).map((e) => `<tr><td>${esc(fmtDateTime(e.at))}</td><td>${esc(e.type)}</td><td><code>${esc(JSON.stringify(e.data))}</code></td></tr>`).join('')}</tbody></table>` : `<p class="muted">${esc(A('auditEmpty'))}</p>`}`;
}

const SIM_NAMES = ['Μαρία Π.', 'Γιάννης Κ.', 'Eleni D.', 'Nikos T.'];
let simN = 0;
function simulate() {
  const menu = adapter.getMenu();
  const pool = menu.items.filter((i) => i.available && !i.hidden);
  let cart = emptyCart();
  for (let n = 0; n < 2 + Math.floor(Math.random() * 3); n++) {
    const it = pool[Math.floor(Math.random() * pool.length)];
    const opt = it.optionGroups?.length ? [it.optionGroups[0].options[Math.floor(Math.random() * 2)].id] : [];
    cart = addLine(cart, menu, { itemId: it.id, optionIds: opt, qty: 1 + Math.floor(Math.random() * 2) });
  }
  const delivery = simN++ % 2 === 1;
  adapter.submitOrder({
    cart, customer: { name: SIM_NAMES[Math.floor(Math.random() * SIM_NAMES.length)], phone: '6940000000' },
    pickup: { mode: 'manual', manualText: 'simulated' }, idempotencyKey: 'sim-' + uuid(), simulated: true,
    fulfilment: delivery ? { type: 'delivery', address: { street: 'Δοκιμαστική', number: '1', area: 'Αγία Παρασκευή', postcode: '15341' } } : { type: 'takeaway' },
    payment: delivery ? 'card' : 'cash',
  });
}

/** Downscale to ~720px JPEG so a data URI fits browser storage. */
async function downscale(file, max = 720) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}

async function onUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  try {
    const uri = await downscale(file);
    adapter.setImage(input.dataset.upload, uri);
    toast(A('imgSaved'));
  } catch (err) {
    toast(err?.name === 'QuotaExceededError' ? A('imgFull') : A('imgBad'));
  }
  render();
}

function bind(role) {
  $('#out').addEventListener('click', logout);
  $('#snd').addEventListener('click', () => {
    soundOn = !soundOn;
    if (soundOn) { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); beep(); }
    render();
  });
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); $(`#tab-${tab}`).focus(); }));
  $$('[data-tab]').forEach((b) => b.addEventListener('keydown', (e) => {
    const ks = tabsFor(role); const i = ks.indexOf(tab);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { tab = ks[(i + (e.key === 'ArrowRight' ? 1 : ks.length - 1)) % ks.length]; render(); $(`#tab-${tab}`).focus(); }
  }));
  $('#sim')?.addEventListener('click', () => { simulate(); render(); });
  $('#reset')?.addEventListener('click', () => { adapter.resetDemo(); seen = null; render(); });
  $$('[data-filter]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; render(); }));
  $$('.ord [data-act]').forEach((b) => b.addEventListener('click', () => {
    const card = b.closest('.ord'); const to = b.dataset.act;
    let reason;
    if (to === 'rejected' || to === 'cancelled') { reason = window.prompt(A('reasonPrompt')); if (!reason) return; }
    try {
      adapter.changeStatus(card.dataset.id, to, { actor: session.user, role, expectedVersion: Number(card.dataset.version), reason });
    } catch (err) {
      toast(err instanceof OrderError && err.code === 'STALE_VERSION' ? A('stale') : err.code === 'FORBIDDEN' ? A('forbidden') : err.message);
    }
    render();
  }));
  $$('[data-status]').forEach((s) => s.addEventListener('change', () => {
    const v = s.value;
    adapter.setOverride(s.dataset.status, { available: v === 'available', hidden: v === 'hidden' });
    sig = '';
  }));
  $$('[data-price]').forEach((i) => i.addEventListener('change', () => {
    const cents = toCents(i.value);
    if (Number.isNaN(cents) || cents <= 0 || cents > 100000) { i.setAttribute('aria-invalid', 'true'); toast(T('order.errors.generic')); return; }
    i.removeAttribute('aria-invalid');
    adapter.setOverride(i.dataset.price, { price: cents });
    i.value = (cents / 100).toFixed(2);
  }));
  $$('[data-upload]').forEach((i) => i.addEventListener('change', () => onUpload(i)));
  $$('[data-rmimg]').forEach((b) => b.addEventListener('click', () => { adapter.removeImage(b.dataset.rmimg); render(); }));
  $('#s-pause')?.addEventListener('change', (e) => adapter.saveSettings({ paused: e.target.checked }));
  $('#s-takeaway')?.addEventListener('change', (e) => adapter.saveSettings({ takeaway: e.target.checked }));
  $('#s-delivery')?.addEventListener('change', (e) => adapter.saveSettings({ delivery: e.target.checked }));
  $('#s-save')?.addEventListener('click', () => {
    const n = Number($('#s-prep').value);
    if (Number.isInteger(n) && n >= 5 && n <= 180) { adapter.saveSettings({ prepMinutes: n }); toast(A('save') + ' ✓'); }
  });
  $('#q-gen')?.addEventListener('click', () => { qrState = { url: $('#q-url').value.trim(), table: $('#q-table').value.trim() }; drawQr(); });
  $('#q-svg')?.addEventListener('click', () => downloadText('tsimboloi-menu-qr.svg', qrSvgText));
  $('#q-png')?.addEventListener('click', () => downloadPng('tsimboloi-menu-qr.png', qrSvgText));
  $('#q-print')?.addEventListener('click', () => window.print());
}

// Live updates: poll storage so a second tab/device shows new orders and stale-version conflicts.
setInterval(() => {
  if (!session || EDITING.includes(tab)) return;
  if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  const next = JSON.stringify([adapter.listOrders(), adapter.getSettings(), tab, soundOn, filter]);
  if (next !== sig) render();
}, 1500);
window.addEventListener('storage', () => { if (session && !EDITING.includes(tab) && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) render(); });
render();
