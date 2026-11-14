// Coupon ARCHITECTURE only: nothing is redeemable. Concept codes are refused; the attempt is tracked locally as intent.
import { T, $, esc, storage, track } from './core.js?v=mwg3bo34';
import { validateCoupon } from './shared/content-data.js?v=mwg3bo34';

const root = $('#coupon-root');
root.innerHTML = `<form id="coupon-form" novalidate><div class="field"><label for="coupon-code">${esc(T('offers.couponTitle'))}</label><input id="coupon-code" type="text" maxlength="30" autocomplete="off"></div>
<button class="btn btn-ghost" type="submit">${esc(T('offers.couponBtn'))}</button><div id="coupon-msg" class="small" role="status" style="margin-top:.7rem"></div></form>`;
$('#coupon-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = $('#coupon-code').value.trim();
  if (!code) return;
  const r = validateCoupon(code);
  storage.set('tsb.demo.coupon_intents', [{ code: code.toUpperCase().slice(0, 30), result: r.reason ?? 'ok', at: new Date().toISOString() }, ...storage.get('tsb.demo.coupon_intents', [])].slice(0, 50));
  track('coupon_intent', { result: r.reason });
  $('#coupon-msg').textContent = r.reason === 'unknown' ? T('offers.couponUnknown') : T('offers.couponNone');
});
