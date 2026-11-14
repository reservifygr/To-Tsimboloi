// Admin > Reservations: at-a-glance numbers, a day navigator with a table the floor staff can read quickly, a new-booking form
// and the settings that hold every capacity number (so the owner's answers are a settings change, not a code change).
import { T, $, $$, esc, adapter, toast, lang } from './core.js?v=mwg3bo34';
import { can } from './shared/orders.js?v=mwg3bo34';
import { RES_TRANSITIONS, localNow, mergeSettings, slotTimes, seatsAt, toMin, addDays } from './shared/reservations.js?v=mwg3bo34';

const RA = (p, v) => T('admin.res.' + p, v);
const fmtDay = (d) => new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
const STATUS = (s) => T('reserve.statuses.' + s);
const ACTIONS = { confirmed: ['confirm', 'btn-primary'], declined: ['decline', 'btn-ghost'], seated: ['seat', 'btn-primary'], completed: ['complete', 'btn-primary'], no_show: ['noShow', 'btn-ghost'], cancelled: ['cancel', 'btn-ghost'] };
const NUMS = ['maxCapacity', 'maxPartySize', 'maxLargeParty', 'slotMinutes', 'durationMinutes', 'bufferMinutes', 'maxCoversPerSlot', 'leadMinutes', 'maxAdvanceDays'];
const BOOLS = ['enabled', 'autoConfirm', 'countPending', 'verified'];

export const pendingReservations = () => adapter.listReservations().filter((r) => r.status === 'pending');

let sub = 'bookings'; let vd = null; let filter = 'all'; let adding = false;
const nowDate = () => localNow(adapter.clock?.() ?? Date.now()).date;
const ACTIVE = ['pending', 'confirmed', 'seated'];
const FILTERS = { all: null, waiting: ['pending'], confirmed: ['confirmed'], seated: ['seated'], done: ['completed', 'no_show', 'cancelled', 'declined'] };
const byTime = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);

function actions(r) {
  return (RES_TRANSITIONS[r.status] ?? []).map((to) => `<button class="btn btn-sm ${ACTIONS[to][1]}" type="button" data-res="${esc(r.id)}" data-to="${to}" data-v="${r.version}">${esc(RA(ACTIONS[to][0]))}</button>`).join('');
}

function row(r, showDate) {
  const note = [r.occasion, r.notes].filter(Boolean).join(' · ');
  return `<tr class="rv-row st-${esc(r.status)}">
  <td class="rv-time" data-l="${esc(RA('colTime'))}"><b>${esc(r.time)}</b>${showDate ? `<span>${esc(fmtDay(r.date))}</span>` : ''}</td>
  <td data-l="${esc(RA('colGuest'))}"><b>${esc(r.name)}</b><a href="tel:${esc(r.phone.replace(/\s/g, ''))}">${esc(r.phone)}</a>${r.email ? `<span class="rv-sub">${esc(r.email)}</span>` : ''}</td>
  <td data-l="${esc(RA('colParty'))}"><span class="rv-party">${r.partySize}</span>${r.large ? `<span class="badge rv-large">${esc(RA('large'))}</span>` : ''}</td>
  <td class="rv-notes" data-l="${esc(RA('colNotes'))}">${note ? esc(note) : '<span class="muted">-</span>'}${r.source === 'staff' ? `<span class="rv-sub">${esc(RA('byStaff'))}</span>` : ''}</td>
  <td data-l="${esc(RA('colStatus'))}"><span class="badge status-${esc(r.status)}">${esc(STATUS(r.status))}</span><span class="rv-sub">${esc(r.id)}</span></td>
  <td class="rv-act">${actions(r)}</td></tr>`;
}

const table = (list, showDate = false) => `<div class="rv-tablewrap"><table class="rv-table"><thead><tr><th>${esc(RA('colTime'))}</th><th>${esc(RA('colGuest'))}</th><th>${esc(RA('colParty'))}</th><th>${esc(RA('colNotes'))}</th><th>${esc(RA('colStatus'))}</th><th></th></tr></thead><tbody>${list.map((r) => row(r, showDate)).join('')}</tbody></table></div>`;

function addForm(day) {
  return `<form class="rv-add" id="rv-add" novalidate><h3>${esc(RA('newBooking'))}</h3><p class="muted small">${esc(RA('newHint'))}</p>
  <div class="rs-grid">
  <div class="field"><label for="na-date">${esc(RA('colDate'))}</label><input id="na-date" type="date" value="${esc(day)}"></div>
  <div class="field"><label for="na-time">${esc(RA('colTime'))}</label><input id="na-time" type="time" step="900" value="20:00"></div>
  <div class="field"><label for="na-party">${esc(RA('colParty'))}</label><input id="na-party" type="number" min="1" max="200" value="2"></div>
  <div class="field"><label for="na-name">${esc(RA('colName'))}</label><input id="na-name" type="text" maxlength="80"></div>
  <div class="field"><label for="na-phone">${esc(RA('phone'))}</label><input id="na-phone" type="tel" maxlength="20"></div>
  <div class="field"><label for="na-notes">${esc(RA('notes'))}</label><input id="na-notes" type="text" maxlength="300"></div></div>
  <p class="form-msg error" role="alert"></p>
  <button class="btn btn-primary" type="submit">${esc(RA('addBtn'))}</button> <button class="btn btn-ghost" type="button" id="rv-new-cancel">${esc(RA('cancelForm'))}</button></form>`;
}

function bookingsView(role) {
  const s = mergeSettings(adapter.getReservationSettings());
  const all = adapter.listReservations();
  const today = nowDate();
  if (!vd) vd = today;
  const pending = all.filter((r) => r.status === 'pending').sort(byTime);
  const day = all.filter((r) => r.date === vd).sort(byTime);
  const shown = FILTERS[filter] ? day.filter((r) => FILTERS[filter].includes(r.status)) : day;
  const act = day.filter((r) => ACTIVE.includes(r.status));
  const covers = act.reduce((a, r) => a + r.partySize, 0);
  const times = slotTimes(vd, s);
  const loads = times.map((t) => [t, seatsAt(all, vd, toMin(t), s)]);
  const peak = loads.reduce((m, x) => Math.max(m, x[1]), 0);
  const weekCovers = (d) => all.filter((r) => r.date === d && ACTIVE.includes(r.status)).reduce((a, r) => a + r.partySize, 0);
  const strip = Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((d) => `<button type="button" class="rv-dayb ${d === vd ? 'on' : ''}" data-rv-day="${d}"><span>${esc(fmtDay(d))}</span><b>${weekCovers(d)}</b></button>`).join('');
  const stat = (n, l, cls = '') => `<div class="rv-stat ${cls}"><b>${n}</b><span>${esc(l)}</span></div>`;
  const chips = Object.keys(FILTERS).map((f) => `<button type="button" class="rv-chip ${f === filter ? 'on' : ''}" data-rv-f="${f}">${esc(RA('f_' + f))}${f === 'waiting' ? ` <i>${day.filter((r) => r.status === 'pending').length}</i>` : ''}</button>`).join('');
  return `${pending.length ? `<section class="rv-wait"><h3>${esc(RA('waitingTitle'))} <span class="n">${pending.length}</span></h3>${table(pending, true)}</section>` : ''}
  <div class="rv-stats">${stat(covers, RA('statGuests'))}${stat(act.length, RA('statBookings'))}${stat(`${peak}/${s.maxCapacity}`, RA('statPeak'))}${stat(pending.length, RA('statWaiting'), pending.length ? 'warn' : '')}</div>
  <div class="rv-week" role="group" aria-label="${esc(RA('weekLabel'))}">${strip}</div>
  <div class="rv-bar"><div class="rv-nav"><button class="btn btn-ghost btn-sm" type="button" data-rv-day="${addDays(vd, -1)}" aria-label="${esc(RA('prevDay'))}">&#8249;</button><h3>${esc(new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${vd}T12:00:00Z`)))}${vd === today ? ` <span class="badge">${esc(RA('today'))}</span>` : ''}</h3><button class="btn btn-ghost btn-sm" type="button" data-rv-day="${addDays(vd, 1)}" aria-label="${esc(RA('nextDay'))}">&#8250;</button>${vd !== today ? `<button class="btn btn-ghost btn-sm" type="button" data-rv-day="${today}">${esc(RA('today'))}</button>` : ''}</div>
  <button class="btn btn-primary btn-sm" type="button" id="rv-new">+ ${esc(RA('newBooking'))}</button></div>
  ${adding ? addForm(vd) : ''}
  ${times.length ? `<div class="rv-load" aria-label="${esc(RA('loadTitle'))}">${loads.map(([t, n]) => `<div title="${esc(t)}: ${n}/${s.maxCapacity}"><i style="height:${Math.min(100, Math.round((n / s.maxCapacity) * 100))}%" class="${n / s.maxCapacity > 0.85 ? 'hot' : ''}"></i><span>${esc(t.endsWith(':00') ? t : '')}</span></div>`).join('')}</div>` : `<p class="notice">${esc(RA('closedDay'))}</p>`}
  <div class="rv-chips">${chips}</div>
  ${shown.length ? table(shown) : `<p class="muted rv-empty">${esc(RA('noneDay'))}</p>`}`;
}

function settingsForm(role) {
  const s = mergeSettings(adapter.getReservationSettings());
  const dis = can(role, 'res_settings') ? '' : 'disabled';
  const num = (k) => `<div class="field"><label for="rs-${k}">${esc(RA(k))}</label><input id="rs-${k}" type="number" min="${k === 'bufferMinutes' ? 0 : 1}" value="${s[k]}" ${dis}></div>`;
  const bool = (k) => `<div class="field"><label class="checkbox"><input type="checkbox" id="rs-${k}" ${s[k] ? 'checked' : ''} ${dis}> <span>${esc(RA(k))}</span></label></div>`;
  const sel = `<div class="field"><label for="rs-largePartyMode">${esc(RA('largePartyMode'))}</label><select id="rs-largePartyMode" ${dis}><option value="call" ${s.largePartyMode === 'call' ? 'selected' : ''}>${esc(RA('largeCall'))}</option><option value="request" ${s.largePartyMode === 'request' ? 'selected' : ''}>${esc(RA('largeRequest'))}</option></select></div>`;
  const days = [3, 4, 5, 6, 0, 1, 2].map((d) => { const h = s.hours[d]; return `<div class="rs-day"><span class="rs-dn">${esc(RA('days')[d])}</span><label class="checkbox"><input type="checkbox" data-open="${d}" ${h ? 'checked' : ''} ${dis}> <span>${esc(RA('opens'))}</span></label><input type="time" data-from="${d}" value="${h?.opens ?? '17:00'}" ${dis} aria-label="${esc(RA('days')[d])} ${esc(RA('opens'))}"><label class="rs-last">${esc(RA('last'))}</label><input type="time" data-to="${d}" value="${h?.lastSeating ?? '22:00'}" ${dis} aria-label="${esc(RA('days')[d])} ${esc(RA('last'))}"></div>`; }).join('');
  return `<section class="res-settings"><h3>${esc(RA('settingsTitle'))}</h3><p class="muted small">${esc(RA('settingsLead'))}</p>
  <div class="rs-grid">${BOOLS.map(bool).join('')}</div><div class="rs-grid">${NUMS.map(num).join('')}${sel}</div>
  <h4>${esc(RA('hoursTitle'))}</h4><div class="rs-days">${days}</div>
  <div class="field"><label for="rs-closed">${esc(RA('closedDates'))}</label><textarea id="rs-closed" rows="3" ${dis}>${esc(s.closedDates.join('\n'))}</textarea></div>
  ${can(role, 'res_settings') ? `<button class="btn btn-primary" type="button" id="rs-save">${esc(RA('save'))}</button>` : `<p class="small muted">${esc(RA('ownerOnly'))}</p>`}</section>`;
}

export function reservationsView(role) {
  const sb = (k) => `<button type="button" class="rv-sub-tab ${sub === k ? 'on' : ''}" data-rv-sub="${k}">${esc(RA('tab_' + k))}</button>`;
  return `<div class="res-admin"><div class="rv-subtabs" role="tablist">${sb('bookings')}${sb('settings')}</div>${sub === 'settings' ? settingsForm(role) : bookingsView(role)}</div>`;
}

export function bindReservations(role, rerender) {
  const go = (fn) => (e) => { fn(e.currentTarget); rerender(); };
  $$('[data-rv-sub]').forEach((b) => b.addEventListener('click', go((el) => { sub = el.dataset.rvSub; })));
  $$('[data-rv-day]').forEach((b) => b.addEventListener('click', go((el) => { vd = el.dataset.rvDay; })));
  $$('[data-rv-f]').forEach((b) => b.addEventListener('click', go((el) => { filter = el.dataset.rvF; })));
  $('#rv-new')?.addEventListener('click', go(() => { adding = !adding; }));
  $('#rv-new-cancel')?.addEventListener('click', go(() => { adding = false; }));
  $('#rv-add')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = $('.form-msg', e.currentTarget);
    try {
      const { reservation } = adapter.submitReservation({ partySize: $('#na-party').value, date: $('#na-date').value, time: $('#na-time').value, name: $('#na-name').value, phone: $('#na-phone').value, notes: $('#na-notes').value }, { staff: true });
      vd = reservation.date; adding = false; toast(RA('added')); rerender();
    } catch (err) { msg.textContent = T(`reserve.errors.${err.code}`) !== `reserve.errors.${err.code}` ? T(`reserve.errors.${err.code}`) : err.message; }
  });
  $$('[data-res]').forEach((b) => b.addEventListener('click', () => {
    try { adapter.changeReservation(b.dataset.res, b.dataset.to, { actor: role, expectedVersion: Number(b.dataset.v) }); rerender(); } catch (err) { toast(err.code === 'STALE_VERSION' ? RA('stale') : err.message); rerender(); }
  }));
  $('#rs-save')?.addEventListener('click', () => {
    const patch = {};
    for (const k of BOOLS) patch[k] = $('#rs-' + k).checked;
    patch.largePartyMode = $('#rs-largePartyMode').value === 'request' ? 'request' : 'call';
    for (const k of NUMS) { const v = Number($('#rs-' + k).value); if (!Number.isFinite(v) || v < (k === 'bufferMinutes' ? 0 : 1)) return toast(RA('bad')); patch[k] = Math.round(v); }
    const hours = {};
    for (const d of [0, 1, 2, 3, 4, 5, 6]) {
      if (!$(`[data-open="${d}"]`).checked) { hours[d] = null; continue; }
      const from = $(`[data-from="${d}"]`).value; const to = $(`[data-to="${d}"]`).value;
      if (!/^\d\d:\d\d$/.test(from) || !/^\d\d:\d\d$/.test(to) || from > to) return toast(RA('bad'));
      hours[d] = { opens: from, lastSeating: to };
    }
    patch.hours = hours;
    patch.closedDates = $('#rs-closed').value.split(/[\s,]+/).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x));
    if (patch.maxLargeParty < patch.maxPartySize) return toast(RA('bad'));
    adapter.saveReservationSettings(patch); toast(RA('saved')); rerender();
  });
}
