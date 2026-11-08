// Admin > Reservations: the day list with confirm / seat / no-show actions, and the settings that hold every
// capacity number (so the owner's answers are a settings change, not a code change).
import { T, $, $$, esc, adapter, toast, lang } from './core.js';
import { can } from './shared/orders.js';
import { RES_TRANSITIONS, localNow, mergeSettings } from './shared/reservations.js';

const RA = (p, v) => T('admin.res.' + p, v);
const fmtDay = (d) => new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
const STATUS = (s) => T('reserve.statuses.' + s);
const ACTIONS = { confirmed: ['confirm', 'btn-primary'], declined: ['decline', 'btn-ghost'], seated: ['seat', 'btn-primary'], completed: ['complete', 'btn-primary'], no_show: ['noShow', 'btn-ghost'], cancelled: ['cancel', 'btn-ghost'] };
const NUMS = ['maxCapacity', 'maxPartySize', 'slotMinutes', 'durationMinutes', 'bufferMinutes', 'maxCoversPerSlot', 'leadMinutes', 'maxAdvanceDays'];
const BOOLS = ['enabled', 'autoConfirm', 'countPending', 'verified'];

export const pendingReservations = () => adapter.listReservations().filter((r) => r.status === 'pending');

function card(r) {
  const acts = (RES_TRANSITIONS[r.status] ?? []).map((to) => `<button class="btn btn-sm ${ACTIONS[to][1]}" type="button" data-res="${esc(r.id)}" data-to="${to}" data-v="${r.version}">${esc(RA(ACTIONS[to][0]))}</button>`).join('');
  return `<article class="res-card status-line-${esc(r.status)}"><header><strong class="res-time">${esc(r.time)}</strong> <span>${esc(fmtDay(r.date))}</span> <span class="badge status-${esc(r.status)}">${esc(STATUS(r.status))}</span><span class="grow"></span><span class="res-ref">${esc(r.id)}</span></header>
  <p class="res-who"><strong>${esc(r.name)}</strong> · ${esc(RA('guests', { n: r.partySize }))} · <a href="tel:${esc(r.phone.replace(/\s/g, ''))}">${esc(r.phone)}</a>${r.email ? ` · ${esc(r.email)}` : ''}</p>
  ${r.occasion ? `<p class="small">${esc(RA('occasion'))}: ${esc(r.occasion)}</p>` : ''}${r.notes ? `<p class="small">${esc(RA('notes'))}: ${esc(r.notes)}</p>` : ''}
  ${acts ? `<div class="res-actions">${acts}</div>` : ''}</article>`;
}

function group(title, list, extra = '') {
  return `<section class="res-group"><h3>${esc(title)} <span class="n">${list.length}</span></h3>${extra}${list.length ? list.map(card).join('') : `<p class="muted small">${esc(RA('none'))}</p>`}</section>`;
}

function settingsForm(role) {
  const s = mergeSettings(adapter.getReservationSettings());
  const dis = can(role, 'res_settings') ? '' : 'disabled';
  const num = (k) => `<div class="field"><label for="rs-${k}">${esc(RA(k))}</label><input id="rs-${k}" type="number" min="${k === 'bufferMinutes' ? 0 : 1}" value="${s[k]}" ${dis}></div>`;
  const bool = (k) => `<div class="field"><label class="checkbox"><input type="checkbox" id="rs-${k}" ${s[k] ? 'checked' : ''} ${dis}> <span>${esc(RA(k))}</span></label></div>`;
  const days = [3, 4, 5, 6, 0, 1, 2].map((d) => { const h = s.hours[d]; return `<div class="rs-day"><span class="rs-dn">${esc(RA('days')[d])}</span><label class="checkbox"><input type="checkbox" data-open="${d}" ${h ? 'checked' : ''} ${dis}> <span>${esc(RA('opens'))}</span></label><input type="time" data-from="${d}" value="${h?.opens ?? '17:00'}" ${dis} aria-label="${esc(RA('days')[d])} ${esc(RA('opens'))}"><label class="rs-last">${esc(RA('last'))}</label><input type="time" data-to="${d}" value="${h?.lastSeating ?? '22:00'}" ${dis} aria-label="${esc(RA('days')[d])} ${esc(RA('last'))}"></div>`; }).join('');
  return `<section class="res-settings"><h3>${esc(RA('settingsTitle'))}</h3><p class="muted small">${esc(RA('settingsLead'))}</p>
  <div class="rs-grid">${BOOLS.map(bool).join('')}</div><div class="rs-grid">${NUMS.map(num).join('')}</div>
  <h4>${esc(RA('hoursTitle'))}</h4><div class="rs-days">${days}</div>
  <div class="field"><label for="rs-closed">${esc(RA('closedDates'))}</label><textarea id="rs-closed" rows="3" ${dis}>${esc(s.closedDates.join('\n'))}</textarea></div>
  ${can(role, 'res_settings') ? `<button class="btn btn-primary" type="button" id="rs-save">${esc(RA('save'))}</button>` : `<p class="small muted">${esc(RA('ownerOnly'))}</p>`}</section>`;
}

export function reservationsView(role) {
  const all = adapter.listReservations();
  const ln = localNow(adapter.clock?.() ?? Date.now());
  const byTime = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);
  const pending = all.filter((r) => r.status === 'pending').sort(byTime);
  const rest = all.filter((r) => r.status !== 'pending');
  const today = rest.filter((r) => r.date === ln.date).sort(byTime);
  const upcoming = rest.filter((r) => r.date > ln.date).sort(byTime);
  const past = rest.filter((r) => r.date < ln.date).sort((a, b) => byTime(b, a)).slice(0, 30);
  const act = today.filter((r) => ['confirmed', 'seated', 'pending'].includes(r.status));
  const covers = act.reduce((a, r) => a + r.partySize, 0);
  return `<div class="res-admin"><p class="res-today" role="status">${esc(RA('coversToday', { n: covers, r: act.length }))}</p>
  ${group(RA('pending'), pending)}${group(RA('today'), today)}${group(RA('upcoming'), upcoming)}${group(RA('past'), past)}${settingsForm(role)}</div>`;
}

export function bindReservations(role, rerender) {
  $$('[data-res]').forEach((b) => b.addEventListener('click', () => {
    try { adapter.changeReservation(b.dataset.res, b.dataset.to, { actor: role, expectedVersion: Number(b.dataset.v) }); rerender(); } catch (err) { toast(err.code === 'STALE_VERSION' ? RA('stale') : err.message); rerender(); }
  }));
  $('#rs-save')?.addEventListener('click', () => {
    const patch = {};
    for (const k of BOOLS) patch[k] = $('#rs-' + k).checked;
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
    adapter.saveReservationSettings(patch); toast(RA('saved')); rerender();
  });
}
