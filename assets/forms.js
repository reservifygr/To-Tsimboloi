// Inquiry + contact forms (DEMO: stored in this browser only; no email/SMS is sent).
import { lang, T, $, esc, storage, setFieldError } from './core.js?v=mwg3bo34';
import { validateEventInquiry, validateContactMessage } from './shared/inquiries.js?v=mwg3bo34';
import { INQUIRY_TYPES } from './shared/inquiries.js?v=mwg3bo34';

const KEY = 'tsb.demo.inquiries.v1';
const save = (q) => storage.set(KEY, [q, ...storage.get(KEY, [])]);
const nextSeq = () => storage.get(KEY, []).length + 1;
const fieldMap = { BAD_NAME: 'name', BAD_PHONE: 'phone', BAD_SIZE: 'size', BAD_DATE: 'date', NO_CONSENT: 'consent', BAD_EMAIL: 'email', BAD_TYPE: 'type', BAD_MESSAGE: 'msg' };

function field(id, label, control, hint = '') { return `<div class="field"><label for="${id}">${esc(label)}</label>${control}${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>`; }
const consentHtml = (text, id) => `<div class="field"><label class="checkbox"><input type="checkbox" id="${id}"> <span>${esc(text)}</span></label></div>`;

function wire(form, fn, successKey, mount) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    $('.error', form) && form.querySelectorAll('[aria-invalid]').forEach((i) => setFieldError(i, ''));
    try {
      const q = fn(nextSeq());
      save(q);
      mount.innerHTML = `<div class="success" role="status" tabindex="-1" id="form-ok"><p><strong>${esc(q.id)}</strong></p><p>${esc(T(successKey))}</p></div>`;
      $('#form-ok').focus();
    } catch (err) {
      const id = fieldMap[err.code];
      const input = id && form.querySelector('#' + form.dataset.prefix + id);
      const text = T(`events.errors.${err.code}`) !== `events.errors.${err.code}` ? T(`events.errors.${err.code}`) : T('order.errors.generic');
      if (input) { setFieldError(input, text); input.focus(); } else $('.form-msg', form).textContent = text;
    }
  });
}

export function mountInquiryForm(mount) {
  const min = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  mount.innerHTML = `<form class="form-grid" data-prefix="i-" novalidate>
  ${field('i-type', T('events.fType'), `<select id="i-type">${INQUIRY_TYPES.map((k) => `<option value="${k}">${esc(T('events.types.' + k))}</option>`).join('')}</select>`)}
  ${field('i-size', T('events.fSize'), '<input id="i-size" type="number" min="1" max="200" inputmode="numeric">')}
  ${field('i-name', T('events.fName'), '<input id="i-name" type="text" autocomplete="name" maxlength="80">')}
  ${field('i-phone', T('events.fPhone'), '<input id="i-phone" type="tel" autocomplete="tel" inputmode="tel">')}
  ${field('i-email', T('events.fEmail'), '<input id="i-email" type="email" autocomplete="email">')}
  ${field('i-date', T('events.fDate'), `<input id="i-date" type="date" min="${min}">`)}
  ${field('i-budget', T('events.fBudget'), '<input id="i-budget" type="text" maxlength="40">')}
  ${field('i-diet', T('events.fDiet'), '<input id="i-diet" type="text" maxlength="200">')}
  <div style="grid-column:1/-1">${field('i-msg', T('events.fMsg'), '<textarea id="i-msg" maxlength="600"></textarea>')}
  ${consentHtml(T('events.consent'), 'i-consent')}
  <div class="error form-msg" role="alert"></div>
  <button class="btn btn-primary" type="submit">${esc(T('events.send'))}</button></div></form>`;
  const form = $('form', mount);
  wire(form, (seq) => validateEventInquiry({
    type: $('#i-type').value, name: $('#i-name').value, phone: $('#i-phone').value, email: $('#i-email').value, date: $('#i-date').value,
    partySize: $('#i-size').value, budget: $('#i-budget').value, dietary: $('#i-diet').value, message: $('#i-msg').value, consent: $('#i-consent').checked,
  }, Date.now(), seq), 'events.sent', mount);
}

export function mountContactForm(mount) {
  mount.innerHTML = `<form data-prefix="c-" novalidate>
  ${field('c-name', T('events.fName'), '<input id="c-name" type="text" autocomplete="name" maxlength="80">')}
  ${field('c-phone', T('events.fPhone'), '<input id="c-phone" type="tel" autocomplete="tel" inputmode="tel">')}
  ${field('c-msg', T('contact.fMsg'), '<textarea id="c-msg" maxlength="600"></textarea>')}
  ${consentHtml(T('events.consent'), 'c-consent')}
  <div class="error form-msg" role="alert"></div>
  <button class="btn btn-primary" type="submit">${esc(T('contact.send'))}</button></form>`;
  wire($('form', mount), (seq) => validateContactMessage({ name: $('#c-name').value, phone: $('#c-phone').value, message: $('#c-msg').value, consent: $('#c-consent').checked }, Date.now(), seq), 'contact.sent', mount);
}
