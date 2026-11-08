// Table booking page (DEMO: stored in this browser only; nothing is sent). Capacity, hours and limits come from the
// reservation settings (see shared/reservations.js), so the owner's numbers change behaviour without touching this file.
import { lang, T, $, $$, esc, adapter, uuid, setFieldError, track } from './core.js';
import { availability, isClosed, localNow, addDays } from './shared/reservations.js';

const root = $('#reserve-root');
const phone = root.dataset.phone;
const R = (p, v) => T('reserve.' + p, v);
const cfg = () => adapter.getReservationSettings();
const fmtDate = (d) => new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
const guestLabel = (n) => (n === 1 ? R('guestOne') : R('guestMany', { n }));
let key = uuid();
let state = { party: 2, date: '', time: '' };
const field = (id, label, control, hint = '') => `<div class="field"><label for="${id}">${esc(label)}</label>${control}${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>`;

function formHtml() {
  const s = cfg();
  const today = localNow().date;
  if (!s.enabled) return `<p class="notice strong">${esc(R('errors.RES_DISABLED'))} <a href="tel:${esc(phone.replace(/\s/g, ''))}">${esc(phone)}</a></p>`;
  const sizes = Array.from({ length: s.maxPartySize }, (_, i) => i + 1).map((n) => `<option value="${n}" ${n === state.party ? 'selected' : ''}>${esc(guestLabel(n))}</option>`).join('');
  return `<form id="res-form" class="res-form" novalidate>
  <div class="res-row">
    ${field('r-party', R('guests'), `<select id="r-party">${sizes}</select>`, R('guestsMore', { n: s.maxPartySize, phone }))}
    ${field('r-date', R('date'), `<input id="r-date" type="date" min="${today}" max="${addDays(today, s.maxAdvanceDays)}" value="${esc(state.date)}">`)}
  </div>
  <fieldset class="slots-box"><legend>${esc(R('time'))}</legend><div id="slots" aria-live="polite"></div></fieldset>
  <div class="res-row">
    ${field('r-name', R('name'), '<input id="r-name" type="text" autocomplete="name" maxlength="80">')}
    ${field('r-phone', R('phone'), '<input id="r-phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="20">', R('phoneHint'))}
  </div>
  <div class="res-row">
    ${field('r-email', R('email'), '<input id="r-email" type="email" autocomplete="email" maxlength="120">', R('emailHint'))}
    ${field('r-occasion', R('occasion'), `<select id="r-occasion">${['none', 'birthday', 'anniversary', 'business', 'other'].map((k) => `<option value="${k === 'none' ? '' : esc(R('occasions.' + k))}">${esc(R('occasions.' + k))}</option>`).join('')}</select>`)}
  </div>
  ${field('r-notes', R('notes'), '<textarea id="r-notes" rows="3" maxlength="300"></textarea>', R('notesHint'))}
  <div class="field"><label class="checkbox"><input type="checkbox" id="r-consent"> <span>${esc(R('consent'))}</span></label></div>
  <p class="form-msg error" role="alert"></p>
  <button class="btn btn-primary" type="submit" id="r-submit">${esc(R('submit'))}</button>
</form>`;
}

function renderSlots() {
  const box = $('#slots'); if (!box) return;
  const s = cfg();
  if (!state.date) { box.innerHTML = `<p class="muted">${esc(R('pickDate'))}</p>`; return; }
  if (isClosed(state.date, s)) { box.innerHTML = `<p class="notice">${esc(R('closedDay'))}</p>`; state.time = ''; return; }
  const list = availability({ date: state.date, partySize: state.party, settings: s, reservations: adapter.listReservations() });
  if (!list.some((x) => x.available)) { box.innerHTML = `<p class="notice">${esc(R('noTimes'))}</p>`; state.time = ''; return; }
  if (!list.find((x) => x.time === state.time && x.available)) state.time = '';
  box.innerHTML = `<p class="small muted">${esc(R('slotsFor', { n: guestLabel(state.party), date: fmtDate(state.date) }))}</p><div class="slot-grid" role="radiogroup" aria-label="${esc(R('time'))}">${list.map((x) => `<label class="slot ${x.available ? '' : 'off'}"><input type="radio" name="r-time" value="${x.time}" ${x.available ? '' : 'disabled'} ${x.time === state.time ? 'checked' : ''}><span>${x.time}${x.available ? '' : `<small>${esc(R('reasons.' + (x.reason ?? 'full')))}</small>`}</span></label>`).join('')}</div>`;
  $$('input[name=r-time]', box).forEach((i) => i.addEventListener('change', () => { state.time = i.value; $('.form-msg').textContent = ''; }));
}

const idMap = { BAD_NAME: 'r-name', BAD_PHONE: 'r-phone', BAD_EMAIL: 'r-email', NO_CONSENT: 'r-consent' };
const errText = (code) => (T(`reserve.errors.${code}`) !== `reserve.errors.${code}` ? R('errors.' + code) : R('errors.generic'));

function statusBlock(r) {
  const call = R('callToChange', { phone });
  return `<p><span class="badge status-${esc(r.status)}">${esc(R('statuses.' + r.status))}</span></p>
  <dl class="res-sum"><div><dt>${esc(R('ref'))}</dt><dd><strong>${esc(r.id)}</strong></dd></div><div><dt>${esc(R('time'))}</dt><dd>${esc(R('summary', { n: guestLabel(r.partySize), date: fmtDate(r.date), time: r.time }))}</dd></div></dl><p class="small muted">${esc(call)}</p>`;
}

function success(r) {
  root.innerHTML = `<div class="success" role="status" tabindex="-1" id="res-ok"><h2>${esc(R('doneTitle'))}</h2><p>${esc(R(r.status === 'confirmed' ? 'doneConfirmed' : 'donePending'))}</p>${statusBlock(r)}<p><button class="btn btn-ghost" type="button" id="res-again">${esc(R('again'))}</button></p></div>${lookupHtml()}`;
  $('#res-ok').focus();
  $('#res-again').addEventListener('click', () => { state = { party: 2, date: '', time: '' }; key = uuid(); mount(); });
  bindLookup();
}

function lookupHtml() {
  return `<section class="res-lookup" aria-labelledby="lk-h"><h2 id="lk-h">${esc(R('lookupTitle'))}</h2><p class="muted">${esc(R('lookupLead'))}</p>
  <form id="lk-form" class="res-row" novalidate>${field('lk-ref', R('ref'), '<input id="lk-ref" type="text" autocomplete="off" placeholder="DEMO-RES-0001">')}${field('lk-phone', R('phone'), '<input id="lk-phone" type="tel" inputmode="tel" autocomplete="tel">')}<div class="field"><button class="btn btn-ghost" type="submit">${esc(R('lookupBtn'))}</button></div></form><div id="lk-out" aria-live="polite"></div></section>`;
}

function bindLookup() {
  $('#lk-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const out = $('#lk-out');
    const r = adapter.findReservation($('#lk-ref').value, $('#lk-phone').value);
    if (!r) { out.innerHTML = `<p class="notice">${esc(R('notFound'))}</p>`; return; }
    const canCancel = r.status === 'pending' || r.status === 'confirmed';
    out.innerHTML = `${statusBlock(r)}${canCancel ? `<button class="btn btn-ghost" type="button" id="lk-cancel">${esc(R('cancelBtn'))}</button>` : ''}`;
    $('#lk-cancel')?.addEventListener('click', () => { try { const u = adapter.changeReservation(r.id, 'cancelled', { actor: 'customer', expectedVersion: r.version }); out.innerHTML = `<p class="success" role="status">${esc(R('cancelled'))}</p>${statusBlock(u)}`; } catch { out.innerHTML = `<p class="notice">${esc(R('errors.generic'))}</p>`; } });
  });
}

function mount() {
  root.innerHTML = formHtml() + lookupHtml();
  const form = $('#res-form');
  if (form) {
    $('#r-party').addEventListener('change', (e) => { state.party = Number(e.target.value); renderSlots(); });
    $('#r-date').addEventListener('change', (e) => { state.date = e.target.value; renderSlots(); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      $$('[aria-invalid]', form).forEach((i) => setFieldError(i, ''));
      $('.form-msg', form).textContent = '';
      try {
        const { reservation } = adapter.submitReservation({
          partySize: state.party, date: state.date, time: state.time, name: $('#r-name').value, phone: $('#r-phone').value, email: $('#r-email').value,
          occasion: $('#r-occasion').value, notes: $('#r-notes').value, consent: $('#r-consent').checked, idempotencyKey: key,
        });
        track('reservation_submitted', { party: reservation.partySize });
        success(reservation);
      } catch (err) {
        const input = idMap[err.code] && $('#' + idMap[err.code]);
        if (input) { setFieldError(input, errText(err.code)); input.focus(); } else { $('.form-msg', form).textContent = errText(err.code); if (err.code === 'SLOT_UNAVAILABLE') renderSlots(); }
      }
    });
    renderSlots();
  }
  bindLookup();
}
mount();
