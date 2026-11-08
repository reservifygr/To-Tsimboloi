// Staff admin (DEMO). The login below is a PUBLIC FIXTURE with no security value: it only demonstrates role gating.
// Production needs real authentication (e.g. Supabase Auth) and server-side RLS/policy enforcement.
import { lang, T, $, $$, esc, adapter, storage, toast, fmtDateTime, fmtTime, uuid, base } from './core.js';
import { eur, toCents } from './shared/money.js';
import { L } from './shared/strings.js';
import { TRANSITIONS, ROLE_TRANSITIONS, ACTIVE_STATUSES, can, canTransition, OrderError } from './shared/orders.js';
import { emptyCart, addLine } from './shared/cart.js';
import { LATEST_POSTS, PAST_POSTS, EVENTS } from './shared/social-data.js';
import { VENUE } from './shared/content-data.js';
import { reservationsView, bindReservations, pendingReservations } from './admin-reservations.js';
import { menuQr, downloadText, downloadPng } from './qrtools.js';

const FIXTURE = { owner: 'owner-demo', staff: 'staff-demo', kitchen: 'kitchen-demo' };
const SESSION = 'tsb.admin.session';
const root = $('#admin-root');
let session = null;
try { session = JSON.parse(sessionStorage.getItem(SESSION) || 'null'); } catch { session = null; }
let tab = 'orders';
let filter = 'all';
let view = 'active'; // 'active' | 'archive'
let query = '';
let seen = null;
let audio = null;
let soundOn = false;
let alarm = null;
let freshIds = [];
const dismissed = new Set(); // pending orders the staff chose to look at later
let sig = '';
let qrState = { url: '', table: '' };

const A = (p, v) => T('admin.' + p, v);
const EDITING = ['menu', 'media', 'qr', 'settings', 'customers'];
const pnorm = (p) => String(p ?? '').replace(/[^\d+]/g, '');

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
      enableSound(); // this click is the gesture browsers require before any sound
      seen = null; render();
    } else renderLogin(A('badLogin'));
  });
}

function logout() {
  stopAlarm();
  document.getElementById('incoming')?.close();
  document.getElementById('reason')?.close();
  session = null;
  try { sessionStorage.removeItem(SESSION); } catch { /* ignore */ }
  renderLogin();
}

/* ---- Sound: a soft two-note chime, repeated every 10 s until every pending order is answered ---- */
function enableSound() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
    soundOn = true;
  } catch { soundOn = false; }
}
function tone(freq, at, len) {
  const o = audio.createOscillator(); const g = audio.createGain();
  const t0 = audio.currentTime + at;
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  o.connect(g); g.connect(audio.destination); o.start(t0); o.stop(t0 + len + 0.05);
}
function chime() {
  if (!soundOn || !audio) return;
  try { audio.resume?.(); tone(659.25, 0, 0.55); tone(880, 0.24, 0.8); } catch { /* sound is optional */ }
}
function stopAlarm() { if (alarm) { clearInterval(alarm); alarm = null; } }
const pendingFor = (role) => (canTransition(role, 'confirmed') ? adapter.listOrders().filter((o) => o.status === 'pending') : []);
function syncAlarm(pending, fresh) {
  if (!pending.length || !soundOn) { stopAlarm(); return; }
  if (!alarm) {
    chime();
    alarm = setInterval(() => {
      if (!session || !soundOn || !pendingFor(session.role).length) { stopAlarm(); return; }
      chime();
    }, 10000);
  } else if (fresh.length) chime();
}

const tabsFor = (role) => ['orders', ...(can(role, 'reservations') ? ['reservations'] : []), 'customers', 'menu', 'media', 'qr', 'settings', ...(can(role, 'reports') ? ['reports'] : []), 'audit'];

/** Looks at orders: detects new ones, drives the alarm and the incoming popup. Runs on every render and every poll tick. */
function watch() {
  if (!session) return [];
  const orders = adapter.listOrders();
  const ids = new Set(orders.map((o) => o.id));
  const fresh = seen ? orders.filter((o) => !seen.has(o.id)).map((o) => o.id) : [];
  seen = ids;
  if (fresh.length) { freshIds = fresh; fresh.forEach((id) => dismissed.delete(id)); }
  const pending = canTransition(session.role, 'confirmed') ? orders.filter((o) => o.status === 'pending') : [];
  syncAlarm(pending, fresh);
  syncIncoming(pending);
  return pending;
}

function resWaiting(role) {
  const n = can(role, 'reservations') ? pendingReservations().length : 0;
  return n && tab !== 'reservations' ? `<div class="alert-bar" role="status" id="res-bar"><span class="grow">${esc(T('admin.res.waiting', { n }))}</span><button class="btn btn-primary btn-sm" type="button" id="open-res">${esc(T('admin.res.openRes'))}</button></div>` : '';
}

function render() {
  if (!session) return renderLogin();
  const role = session.role;
  const pending = watch();
  const orders = adapter.listOrders();
  if (!tabsFor(role).includes(tab)) tab = 'orders';
  const views = { orders: ordersView, reservations: (o, r) => reservationsView(r), customers: customersView, menu: menuView, media: mediaView, qr: qrView, settings: settingsView, reports: reportsView, audit: auditView };
  const waiting = pending.length && !document.getElementById('incoming')?.open
    ? `<div class="alert-bar" role="status"><span class="grow">${esc(A('waiting', { n: pending.length }))}</span><button class="btn btn-primary btn-sm" type="button" id="open-in">${esc(A('openIt'))}</button></div>` : '';
  root.innerHTML = `<div class="admin-bar"><span class="grow"><strong>${esc(A('roles.' + role))}</strong> (${esc(session.user)}) <span class="badge">${esc(T('common.demo'))}</span></span>
    <button class="btn btn-sm ${soundOn ? 'btn-ghost' : 'snd-off'}" type="button" id="snd" aria-pressed="${soundOn}">${esc(soundOn ? A('soundOn') : A('soundOff'))}</button>
    <button class="btn btn-ghost btn-sm" type="button" id="out">${esc(A('logout'))}</button></div>
  <div class="tabs" role="tablist" aria-label="${esc(A('h1'))}">${tabsFor(role).map((k) => `<button role="tab" id="tab-${k}" aria-selected="${k === tab}" aria-controls="panel" data-tab="${k}">${esc(A('tabs.' + k))}</button>`).join('')}</div>
  ${waiting}${resWaiting(role)}
  <div id="panel" role="tabpanel" aria-labelledby="tab-${tab}">${views[tab](orders, role, freshIds)}</div>`;
  sig = JSON.stringify([orders, adapter.listReservations(), adapter.getReservationSettings(), adapter.getSettings(), adapter.listCustomers(), tab, soundOn, filter, view]);
  bind(role);
  if (tab === 'qr') drawQr();
}

function lineText(l) { return `${l.qty}× ${L(l.name, lang)}${l.note ? ` ("${l.note}")` : ''}`; }
function pickupText(o) { return o.pickup.mode === 'slot' ? fmtDateTime(o.pickup.requestedAt) : o.pickup.mode === 'manual' ? `"${o.pickup.manualText}"` : 'ASAP'; }
const ftype = (o) => o.fulfilment?.type ?? 'takeaway';

const addrText = (a) => (a ? `${a.street} ${a.number}, ${a.area} ${a.postcode}${a.floor ? `, ${A('floor')} ${a.floor}` : ''}${a.bell ? `, ${A('bell')} ${a.bell}` : ''}${a.notes ? ` (${a.notes})` : ''}` : '');
const etaText = (o) => (o.etaMinutes ? A('eta', { n: o.etaMinutes, t: fmtTime(o.etaAt) }) : '');
const isRegular = (o) => adapter.listCustomers().some((c) => c.phone === pnorm(o.customer.phone));

function typeBadges(o) {
  return `<div class="badges"><span class="badge type-${ftype(o)}">${esc(A(ftype(o)))}</span><span class="badge">${esc(A(o.payment ?? 'cash'))}</span>${o.paid ? '' : `<span class="badge warn">${esc(A('unpaid'))}</span>`}${isRegular(o) ? `<span class="badge reg">${esc(A('regular'))}</span>` : ''}${o.simulated ? '<span class="badge sim">SIM</span>' : ''}</div>`;
}

function secondaryActs(o) {
  return `<div class="acts sec"><button class="btn btn-ghost btn-sm" type="button" data-rc="print">${esc(A('rcPrint'))}</button><button class="btn btn-ghost btn-sm" type="button" data-rc="email">${esc(A('rcEmail'))}</button><button class="btn btn-ghost btn-sm" type="button" data-rc="copy">${esc(A('rcCopy'))}</button>${isRegular(o) ? '' : `<button class="btn btn-ghost btn-sm" type="button" data-savecust>${esc(A('saveCustomer'))}</button>`}</div>`;
}

function orderCard(o, role, fresh) {
  const decides = o.status === 'pending' && canTransition(role, 'confirmed');
  const acts = TRANSITIONS[o.status].filter((to) => ROLE_TRANSITIONS[role].includes(to) && !(o.status === 'pending' && (to === 'confirmed' || to === 'rejected' || to === 'cancelled')));
  const del = ftype(o) === 'delivery';
  const addr = del && o.fulfilment?.address ? `<div class="addr"><strong>${esc(A('address'))}:</strong> ${esc(addrText(o.fulfilment.address))}</div>` : '';
  return `<article class="ord ${fresh.includes(o.id) ? 'is-new' : ''}" data-id="${esc(o.id)}" data-version="${o.version}" data-type="${ftype(o)}" aria-label="${esc(o.id)}">
  <header><span>${esc(o.id)}</span><span>${esc(eur(o.subtotal, lang))}</span></header>
  ${typeBadges(o)}
  <div>${esc(o.customer.name)} · <a href="tel:${esc(o.customer.phone.replace(/\s/g, ''))}">${esc(o.customer.phone)}</a></div>
  ${addr}
  <div>${esc(A('pickup'))}: ${esc(pickupText(o))}</div>
  ${o.etaMinutes ? `<div class="eta">${esc(etaText(o))}</div>` : ''}
  <ul>${o.lines.map((l) => `<li>${esc(lineText(l))}</li>`).join('')}</ul>
  <div class="small muted">${esc(fmtDateTime(o.createdAt))}</div>
  <div class="acts">${decides ? `<button class="btn btn-primary btn-sm" type="button" data-review>${esc(A('accept'))} / ${esc(A('reject'))}</button>` : ''}${acts.map((to) => `<button class="btn ${to === 'cancelled' ? 'btn-ghost' : 'btn-primary'} btn-sm" type="button" data-act="${to}">${esc(A('act.' + to))}</button>`).join('')}</div>
  ${secondaryActs(o)}</article>`;
}

const money = (c) => eur(c, lang);
/** Plain-text slip: used for print, copy and the email body. */
function receiptText(o) {
  const del = ftype(o) === 'delivery';
  const a = o.fulfilment?.address;
  const rows = [
    `${L(VENUE.name, lang)} - ${A('rcTitle')}`,
    `${lang === 'en' ? VENUE.streetEn : VENUE.street}, ${lang === 'en' ? VENUE.cityEn : VENUE.city} - ${VENUE.phoneDisplay}`,
    '------------------------------',
    `${o.id}  ${fmtDateTime(o.createdAt)}`,
    `${A(ftype(o)).toUpperCase()} / ${A(o.payment ?? 'cash')}`,
    `${A('pickup')}: ${pickupText(o)}`,
    ...(o.etaMinutes ? [etaText(o)] : []),
    `${A('rcCustomer')}: ${o.customer.name}, ${o.customer.phone}`,
  ];
  if (del && a) rows.push(`${A('address')}: ${addrText(a)}`);
  rows.push('------------------------------');
  o.lines.forEach((l) => rows.push(`${l.qty}x ${L(l.name, lang)}${l.note ? ` ("${l.note}")` : ''}  ${money(l.total)}`));
  rows.push('------------------------------', `${A('rcTotal')}: ${money(o.subtotal)}`);
  rows.push((o.payment ?? 'cash') === 'cash' ? `${A('rcCollect')}: ${money(o.subtotal)}` : A('rcCard'));
  rows.push('', A('rcNotFiscal'));
  return rows.join('\n');
}

function printReceipt(o) {
  const box = document.createElement('pre');
  box.id = 'receipt';
  box.textContent = receiptText(o);
  document.body.append(box);
  document.body.classList.add('print-receipt');
  const done = () => { document.body.classList.remove('print-receipt'); box.hidden = true; box.replaceChildren(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(done, 1000);
}

function emailReceipt(o) {
  const to = adapter.getSettings().courierEmail || '';
  const subject = `${L(VENUE.name, lang)} ${o.id} (${A(ftype(o))})`;
  location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(receiptText(o))}`;
}

function ordersView(all, role, fresh) {
  const isActive = (o) => ACTIVE_STATUSES.includes(o.status);
  const pool = all.filter((o) => (view === 'active' ? isActive(o) : !isActive(o)));
  const orders = filter === 'all' ? pool : pool.filter((o) => ftype(o) === filter);
  const cnt = (f) => (f === 'all' ? pool.length : pool.filter((o) => ftype(o) === f).length);
  const nActive = all.filter(isActive).length;
  const nArch = all.length - nActive;
  const views = `<div class="seg" role="group" aria-label="${esc(A('tabs.orders'))}"><button type="button" data-view="active" aria-pressed="${view === 'active'}">${esc(A('viewActive'))}<span class="n">${nActive}</span></button><button type="button" data-view="archive" aria-pressed="${view === 'archive'}">${esc(A('viewArchive'))}<span class="n">${nArch}</span></button></div>`;
  const seg = `<div class="seg" role="group" aria-label="${esc(A('filter'))}">${['all', 'takeaway', 'delivery'].map((f) => `<button type="button" data-filter="${f}" aria-pressed="${filter === f}">${esc(A(f))}<span class="n">${cnt(f)}</span></button>`).join('')}</div>`;
  const sim = can(role, 'simulate') ? `<button class="btn btn-ghost btn-sm" type="button" id="sim">${esc(A('simulate'))}</button>` : '';
  const tools = `<span class="grow"></span>${sim}<button class="btn btn-ghost btn-sm" type="button" id="reset">${esc(A('reset'))}</button>`;
  const head = `<div class="toolbar">${views}${seg}${tools}</div>`;
  if (view === 'archive') {
    return `${head}<p class="small muted">${esc(A('archiveHint'))}</p>
    <div class="field"><label class="sr-only" for="arch-q">${esc(A('archiveSearch'))}</label><input id="arch-q" type="search" placeholder="${esc(A('archiveSearch'))}" value="${esc(query)}" autocomplete="off"></div>
    <div id="arch-list">${archiveList(orders)}</div>`;
  }
  const cols = ['pending', 'confirmed', 'preparing', 'ready'];
  const board = cols.map((st) => {
    const list = orders.filter((o) => o.status === st);
    return `<section class="col" aria-labelledby="col-${st}"><h3 id="col-${st}">${esc(A('cols.' + st))} <span class="badge">${list.length}</span></h3>${list.map((o) => orderCard(o, role, fresh)).join('') || `<p class="small muted">${esc(A('noOrders'))}</p>`}</section>`;
  }).join('');
  return `${head}<div class="board">${board}</div>`;
}

function archiveList(orders) {
  const q = query.trim().toLowerCase();
  const rows = orders
    .filter((o) => !q || `${o.id} ${o.customer.name} ${o.customer.phone}`.toLowerCase().includes(q))
    .slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
  if (!rows.length) return `<p class="muted">${esc(A('archiveEmpty'))}</p>`;
  return rows.map((o) => {
    const last = o.audit.at(-1);
    return `<details class="arch" data-id="${esc(o.id)}"><summary><span><strong>${esc(o.id)}</strong></span><span>${esc(fmtDateTime(o.createdAt))}</span><span class="badge type-${ftype(o)}">${esc(A(ftype(o)))}</span><span>${esc(o.customer.name)}</span><span class="st">${esc(A('status.' + o.status))}</span><span>${esc(eur(o.subtotal, lang))}</span></summary>
    <div class="arch-body">${typeBadges(o)}<div>${esc(o.customer.name)} · <a href="tel:${esc(o.customer.phone.replace(/\s/g, ''))}">${esc(o.customer.phone)}</a></div>
    ${ftype(o) === 'delivery' && o.fulfilment?.address ? `<div><strong>${esc(A('address'))}:</strong> ${esc(addrText(o.fulfilment.address))}</div>` : ''}
    ${o.etaMinutes ? `<div>${esc(etaText(o))}</div>` : ''}${last?.reason ? `<div><strong>${esc(last.reason)}</strong></div>` : ''}
    <ul>${o.lines.map((l) => `<li>${esc(lineText(l))}</li>`).join('')}</ul>${secondaryActs(o)}</div></details>`;
  }).join('');
}

function customersView(orders) {
  const list = adapter.listCustomers();
  const n = (phone) => orders.filter((o) => pnorm(o.customer.phone) === phone).length;
  return `<p class="notice">${esc(A('custLead'))}</p>
  ${list.length ? list.map((c) => `<article class="cust" data-phone="${esc(c.phone)}"><header><span><strong>${esc(c.name)}</strong> <span class="badge reg">${esc(A('regular'))}</span></span><span><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a> · <span class="small muted">${n(c.phone)} ${esc(A('custOrders'))}</span></span></header>
    <div>${c.address ? `<strong>${esc(A('address'))}:</strong> ${esc(addrText(c.address))}` : `<span class="muted">${esc(A('custNoAddr'))}</span>`}</div>
    <div class="field"><label for="cn-${esc(c.phone)}">${esc(A('custNotes'))}</label><textarea id="cn-${esc(c.phone)}" data-cnotes maxlength="200">${esc(c.notes)}</textarea></div>
    <div class="acts"><button class="btn btn-primary btn-sm" type="button" data-csave>${esc(A('custSave'))}</button><button class="btn btn-ghost btn-sm" type="button" data-cdel>${esc(A('custDelete'))}</button></div></article>`).join('') : `<p class="muted">${esc(A('custEmpty'))}</p>`}`;
}

/* ---- Popups: incoming order (accept with a time / reject with a reason) and cancel-with-reason ---- */
function dlgEl(id) {
  let d = document.getElementById(id);
  if (!d) {
    d = document.createElement('dialog');
    d.id = id; d.className = 'dialog incoming';
    d.setAttribute('aria-labelledby', `${id}-h`);
    document.body.append(d);
  }
  return d;
}

function summaryHtml(o) {
  const a = o.fulfilment?.address;
  return `<div class="sum">${typeBadges(o)}<div><strong>${esc(o.customer.name)}</strong> · ${esc(o.customer.phone)}</div>
  ${ftype(o) === 'delivery' && a ? `<div><strong>${esc(A('address'))}:</strong> ${esc(addrText(a))}</div>` : ''}
  <div>${esc(A('pickup'))}: ${esc(pickupText(o))}</div>
  <ul>${o.lines.map((l) => `<li>${esc(lineText(l))}</li>`).join('')}</ul>
  <div class="tot"><span>${esc(A('rcTotal'))}</span><span>${esc(eur(o.subtotal, lang))}</span></div></div>`;
}

/** `seenVersion` is the version the staff member was looking at: a change from another device makes this fail instead of overwriting. */
function apply(id, to, seenVersion, extra = {}) {
  try {
    adapter.changeStatus(id, to, { actor: session.user, role: session.role, expectedVersion: seenVersion, ...extra });
  } catch (err) {
    toast(err instanceof OrderError && err.code === 'STALE_VERSION' ? A('stale') : err.code === 'FORBIDDEN' ? A('forbidden') : err.message);
  }
  render();
}

function reasonStep(o, { title, confirmLabel, to, back }) {
  const reasons = [0, 1, 2, 3].map((i) => A(`reasons.r${i}`));
  return `<h3 class="h-small">${esc(title)}</h3>
  <div class="chips" role="group" aria-label="${esc(title)}">${reasons.map((r) => `<button type="button" data-reason="${esc(r)}" aria-pressed="false">${esc(r)}</button>`).join('')}</div>
  <div class="field"><label for="rj">${esc(A('reasonLabel'))}</label><input id="rj" type="text" maxlength="120" autocomplete="off"></div>
  <div class="error" id="rj-err" role="alert"></div>
  <div class="dialog-actions"><button class="btn btn-primary" type="button" id="rj-ok">${esc(confirmLabel)}</button><button class="btn btn-ghost" type="button" id="rj-back">${esc(back)}</button></div>`;
}

function wireReason(host, o, to, onBack, onDone) {
  $$('[data-reason]', host).forEach((b) => b.addEventListener('click', () => {
    $('#rj', host).value = b.dataset.reason;
    $$('[data-reason]', host).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  $('#rj-back', host).addEventListener('click', onBack);
  $('#rj-ok', host).addEventListener('click', () => {
    const reason = $('#rj', host).value.trim();
    if (!reason) { $('#rj-err', host).textContent = A('reasonNeeded'); $('#rj', host).focus(); return; }
    apply(o.id, to, o.version, { reason });
    onDone?.();
  });
}

function showIncoming(o, total) {
  const dlg = dlgEl('incoming');
  if (!dlg.dataset.wired) {
    dlg.dataset.wired = '1';
    // Closing without answering (Esc, "Later") keeps the order waiting; the alarm goes on and a bar offers to reopen it.
    dlg.addEventListener('close', () => {
      if (dlg.open) return; // already reopened for a newer order: leave it alone
      const id = dlg.dataset.id;
      if (id && adapter.getOrder(id)?.status === 'pending') pendingFor(session?.role ?? 'kitchen').forEach((x) => dismissed.add(x.id));
      dlg.dataset.id = '';
      if (session) render();
    });
  }
  const s = adapter.getSettings();
  const del = ftype(o) === 'delivery';
  const def = Math.min(240, (s.prepMinutes || 25) + (del ? 15 : 0));
  dlg.dataset.id = o.id;
  const accept = () => {
    $('#in-step').innerHTML = `<fieldset class="field"><legend class="h-small">${esc(del ? A('etaDelivery') : A('etaTakeaway'))}</legend>
      <div class="chips" role="group">${[...new Set([10, 15, 20, 30, 45, 60, 90, def])].sort((x, y) => x - y).map((m) => `<button type="button" data-eta="${m}" aria-pressed="${m === def}">${m}</button>`).join('')}</div>
      <div class="eta-row"><div class="field"><label for="eta">${esc(A('etaCustom'))}</label><input id="eta" type="number" min="1" max="240" inputmode="numeric" value="${def}"></div><span class="muted">${esc(A('minutes'))}</span></div></fieldset>
      <div class="error" id="in-err" role="alert"></div>
      <div class="dialog-actions"><button class="btn btn-primary" type="button" id="in-accept">${esc(A('accept'))}</button><button class="btn btn-ghost" type="button" id="in-reject">${esc(A('reject'))}</button><button class="btn btn-ghost" type="button" id="in-later">${esc(A('later'))}</button></div>`;
    const input = $('#eta');
    const mark = () => $$('[data-eta]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.eta === String(Number(input.value)))));
    $$('[data-eta]').forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.eta; mark(); }));
    input.addEventListener('input', mark);
    $('#in-accept').addEventListener('click', () => {
      const eta = Number(input.value);
      if (!Number.isInteger(eta) || eta < 1 || eta > 240) { $('#in-err').textContent = A('etaBad'); input.focus(); return; }
      apply(o.id, 'confirmed', o.version, { etaMinutes: eta });
    });
    $('#in-reject').addEventListener('click', () => {
      $('#in-step').innerHTML = reasonStep(o, { title: A('rejectTitle'), confirmLabel: A('rejectConfirm'), to: 'rejected', back: A('back') });
      wireReason($('#in-step'), o, 'rejected', accept);
      $('#rj').focus();
    });
    $('#in-later').addEventListener('click', () => dlg.close());
  };
  dlg.innerHTML = `<h2 id="incoming-h">${esc(A('inTitle'))} · ${esc(o.id)}</h2><p class="cnt" id="in-count">${esc(A('inCount', { i: 1, n: total }))}</p>${summaryHtml(o)}<div id="in-step"></div>`;
  accept();
  if (!dlg.open) dlg.showModal();
  $('#in-accept')?.focus({ preventScroll: true });
}

function syncIncoming(pending) {
  const dlg = dlgEl('incoming');
  const visible = pending.filter((o) => !dismissed.has(o.id));
  if (!visible.length) { if (dlg.open) dlg.close(); return; }
  if (dlg.open && visible.some((o) => o.id === dlg.dataset.id)) {
    const c = $('#in-count'); if (c) c.textContent = A('inCount', { i: 1, n: pending.length });
    return;
  }
  showIncoming(visible[0], pending.length);
}

function askCancel(o) {
  const dlg = dlgEl('reason');
  dlg.innerHTML = `<h2 id="reason-h">${esc(A('cancelTitle'))} · ${esc(o.id)}</h2>${reasonStep(o, { title: A('reasonLabel'), confirmLabel: A('cancelConfirm'), to: 'cancelled', back: A('back') })}`;
  wireReason(dlg, o, 'cancelled', () => dlg.close(), () => dlg.close());
  dlg.showModal();
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
  <div class="field"><label for="s-courier">${esc(A('rcCourier'))}</label><input id="s-courier" type="email" autocomplete="off" value="${esc(s.courierEmail ?? '')}" ${can(role, 'prep_time') ? '' : 'disabled'} aria-describedby="s-courier-h"><span class="hint" id="s-courier-h">${esc(A('rcCourierHint'))}</span></div>
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

/** Receipt / courier-email / copy / save-customer buttons, in the board cards and in the archive. */
function bindOrderButtons(scope) {
  $$('[data-rc]', scope).forEach((b) => b.addEventListener('click', async () => {
    const o = adapter.getOrder(b.closest('[data-id]').dataset.id);
    if (!o) return;
    if (b.dataset.rc === 'print') printReceipt(o);
    else if (b.dataset.rc === 'email') emailReceipt(o);
    else { try { await navigator.clipboard.writeText(receiptText(o)); toast(A('rcCopied')); } catch { toast(receiptText(o), 8000); } }
  }));
  $$('[data-savecust]', scope).forEach((b) => b.addEventListener('click', () => {
    const o = adapter.getOrder(b.closest('[data-id]').dataset.id);
    if (!o) return;
    try {
      const old = adapter.listCustomers().find((x) => x.phone === pnorm(o.customer.phone));
      adapter.saveCustomer({ name: o.customer.name, phone: o.customer.phone, address: o.fulfilment?.address ?? old?.address ?? null, notes: old?.notes ?? '' });
      toast(A('customerSaved'));
      if (scope === root) render(); else b.hidden = true;
    } catch (err) { toast(err.message); }
  }));
}

function bind(role) {
  $('#open-res')?.addEventListener('click', () => { tab = 'reservations'; render(); });
  if (tab === 'reservations') bindReservations(role, render);
  $('#out').addEventListener('click', logout);
  $('#snd').addEventListener('click', () => {
    if (soundOn) { soundOn = false; stopAlarm(); } else { enableSound(); chime(); }
    render();
  });
  $('#open-in')?.addEventListener('click', () => { dismissed.clear(); render(); });
  $$('[data-view]').forEach((b) => b.addEventListener('click', () => { view = b.dataset.view; render(); }));
  $('#arch-q')?.addEventListener('input', (e) => {
    query = e.target.value;
    const all = adapter.listOrders().filter((o) => !ACTIVE_STATUSES.includes(o.status));
    $('#arch-list').innerHTML = archiveList(filter === 'all' ? all : all.filter((o) => ftype(o) === filter));
    bindOrderButtons($('#arch-list'));
  });
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); $(`#tab-${tab}`).focus(); }));
  $$('[data-tab]').forEach((b) => b.addEventListener('keydown', (e) => {
    const ks = tabsFor(role); const i = ks.indexOf(tab);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { tab = ks[(i + (e.key === 'ArrowRight' ? 1 : ks.length - 1)) % ks.length]; render(); $(`#tab-${tab}`).focus(); }
  }));
  $('#sim')?.addEventListener('click', () => { simulate(); render(); });
  $('#reset')?.addEventListener('click', () => { adapter.resetDemo(); seen = null; render(); });
  $$('[data-filter]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; render(); }));
  $$('.ord [data-review]').forEach((b) => b.addEventListener('click', () => {
    const o = adapter.getOrder(b.closest('.ord').dataset.id);
    if (!o || o.status !== 'pending') return;
    dismissed.delete(o.id);
    showIncoming(o, adapter.listOrders().filter((x) => x.status === 'pending').length);
  }));
  $$('.ord [data-act]').forEach((b) => b.addEventListener('click', () => {
    const o = adapter.getOrder(b.closest('.ord').dataset.id);
    if (!o) return;
    if (b.dataset.act === 'cancelled') askCancel(o);
    else apply(o.id, b.dataset.act, Number(b.closest('.ord').dataset.version));
  }));
  bindOrderButtons(root);
  $$('[data-csave]').forEach((b) => b.addEventListener('click', () => {
    const card = b.closest('.cust');
    const c = adapter.listCustomers().find((x) => x.phone === card.dataset.phone);
    if (c) { adapter.saveCustomer({ ...c, notes: $('[data-cnotes]', card).value }); toast(A('custSavedNotes')); }
  }));
  $$('[data-cdel]').forEach((b) => b.addEventListener('click', () => { adapter.deleteCustomer(b.closest('.cust').dataset.phone); toast(A('custDeleted')); render(); }));
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
    const em = $('#s-courier').value.trim();
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { $('#s-courier').setAttribute('aria-invalid', 'true'); return; }
    $('#s-courier').removeAttribute('aria-invalid');
    if (Number.isInteger(n) && n >= 5 && n <= 180) { adapter.saveSettings({ prepMinutes: n, courierEmail: em }); toast(A('save') + ' ✓'); }
  });
  $('#q-gen')?.addEventListener('click', () => { qrState = { url: $('#q-url').value.trim(), table: $('#q-table').value.trim() }; drawQr(); });
  $('#q-svg')?.addEventListener('click', () => downloadText('tsimboloi-menu-qr.svg', qrSvgText));
  $('#q-png')?.addEventListener('click', () => downloadPng('tsimboloi-menu-qr.png', qrSvgText));
  $('#q-print')?.addEventListener('click', () => window.print());
}

// Live updates: poll storage so a second tab/device shows new orders and stale-version conflicts.
// The alarm and popup are checked on every tick, even while someone is typing; the board only re-renders when idle.
setInterval(() => {
  if (!session) return;
  const el = document.activeElement;
  const busy = EDITING.includes(tab) || (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
  const next = JSON.stringify([adapter.listOrders(), adapter.listReservations(), adapter.getReservationSettings(), adapter.getSettings(), adapter.listCustomers(), tab, soundOn, filter, view]);
  if (!busy && next !== sig) render(); else watch();
}, 1500);
window.addEventListener('storage', () => { if (session && !EDITING.includes(tab) && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) render(); });
// After a page reload the browser forgets that sound was allowed: the first click anywhere on the page switches it back on.
document.addEventListener('pointerdown', (e) => {
  if (session && !audio && !e.target.closest?.('#snd, #login')) enableSound();
});
render();
