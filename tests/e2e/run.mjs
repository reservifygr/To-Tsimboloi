// End-to-end tests in real headless Chrome against the built site (run `npm run build` first; `npm run test:e2e` does both).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch } from './lib.mjs';
import { AUDIT } from './audit.mjs';
import { start } from '../../scripts/serve.mjs';

const PORT = 4300 + Math.floor(Math.random() * 400);
const U = (p) => `http://localhost:${PORT}${p}`;
let srv; let br;
const ROUTES = ['', 'menu/', 'order/', 'events/', 'gallery/', 'offers/', 'contact/', 'reserve/', 'privacy/', 'admin/'];

before(async () => { srv = await start(PORT); br = await launch(); });
after(() => { br?.close(); srv?.close(); });

async function page(opts) {
  const p = await br.newPage(opts);
  await p.goto(U('/robots.txt'));
  await p.eval("localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tsb.embeds','\"off\"'); true");
  return p;
}
const clean = (p) => assert.deepEqual(p.logs, [], 'browser console must be clean:\n' + p.logs.join('\n'));

for (const [label, opts] of [['390px mobile', { width: 390, height: 844, mobile: true }], ['1440px desktop', { width: 1440, height: 900 }]]) {
  test(`a11y + layout + clean console on every route, both languages @ ${label}`, async () => {
    const p = await page(opts);
    for (const lang of ['', 'en/']) for (const r of ROUTES) {
      await p.goto(U(`/${lang}${r}`));
      await p.eval('new Promise(r=>setTimeout(r,200))');
      const issues = await p.eval(AUDIT);
      assert.deepEqual(issues, [], `${lang}${r}: ${issues.join(' | ')}`);
    }
    clean(p);
    await p.close();
  });
}

test('language persistence: explicit choice is remembered across pages and reloads', async () => {
  const p = await page({ width: 1440, height: 900 });
  await p.goto(U('/menu/'));
  assert.equal(await p.eval('document.documentElement.lang'), 'el');
  await p.eval(`(()=>{document.querySelector('[data-lang-switch]').click();return true})()`);
  await p.waitFor(`location.pathname==='/en/menu/'`);
  await p.goto(U('/contact/')); // Greek URL typed directly
  await p.waitFor(`location.pathname==='/en/contact/'`);
  assert.equal(await p.eval('document.documentElement.lang'), 'en');
  await p.eval(`document.querySelector('[data-lang-switch]').click()`);
  await p.waitFor(`location.pathname==='/contact/'`);
  await p.goto(U('/en/offers/'));
  await p.waitFor(`location.pathname==='/offers/'`);
  assert.equal(await p.eval(`localStorage.getItem('tsb.lang')`), '"el"');
  clean(p);
});

test('mobile navigation at 390px opens, closes with Escape, and navigates', async () => {
  const p = await page({ width: 390, height: 844, mobile: true });
  await p.goto(U('/'));
  assert.equal(await p.eval(`getComputedStyle(document.querySelector('#site-nav')).display`), 'none');
  assert.equal(await p.eval(`document.querySelector('[data-nav-toggle]').getBoundingClientRect().width >= 44`), true);
  await p.click('[data-nav-toggle]');
  assert.equal(await p.eval(`document.querySelector('[data-nav-toggle]').getAttribute('aria-expanded')`), 'true');
  assert.notEqual(await p.eval(`getComputedStyle(document.querySelector('#site-nav')).display`), 'none');
  await p.key('Escape');
  await p.waitFor(`document.querySelector('[data-nav-toggle]').getAttribute('aria-expanded')==='false'`);
  await p.click('[data-nav-toggle]');
  await p.eval(`document.querySelector('#site-nav a[href="/menu/"]').click()`);
  await p.waitFor(`location.pathname==='/menu/'`);
  // bottom action bar present with a call link
  await p.waitFor(`document.querySelector('.action-bar a[href^="tel:"]')?.getBoundingClientRect().height>=44`);
  assert.equal(await p.eval(`document.querySelector('.action-bar a[href^="tel:"]').getBoundingClientRect().height >= 44`), true);
  clean(p);
});

test('menu: category order, QR dialog, table param, print layout hooks, overrides from staff', async () => {
  const p = await page({ width: 390, height: 844, mobile: true });
  await p.goto(U('/menu/?table=12'));
  const cats = await p.eval(`[...document.querySelectorAll('.menu-cat h2')].map(h=>h.textContent)`);
  assert.deepEqual(cats, ['Για το ξεκίνημα', 'Δροσερά Τσιμπολογήματα', 'Βουτιές με ψωμάκι', 'Στη φωτιά & στο τηγάνι', 'Από τη σχάρα', 'Νερό', 'Αναψυκτικά', 'Μπύρες', 'Ούζο', 'Τσίπουρο', 'Κρασιά (Βαρελίσια 500ml)', 'Κρασιά (Φιάλες)', 'Αλκοόλ (Ποτήρι)', 'Αλκοόλ (Φιάλη)']);
  assert.equal(await p.count('.dish'), 66);
  assert.match(await p.text('[data-table-chip]'), /Τραπέζι 12/);
  await p.click('[data-open-qr]');
  await p.waitFor(`document.querySelector('#qr-dialog').open`);
  assert.ok(await p.eval(`document.querySelector('[data-qr-box] svg rect, [data-qr-box] svg path') !== null`));
  assert.match(await p.text('[data-qr-url]'), /\/menu\/\?table=12$/);
  await p.click('[data-close-dialog]');
  // staff marks an item unavailable and changes a price (as owner, through the shared adapter storage)
  await p.eval(`localStorage.setItem('tsb.demo.settings.v1', JSON.stringify({overrides:{saganaki:{available:false},tzatziki:{price:550}}}))`);
  await p.goto(U('/menu/'));
  assert.equal(await p.eval(`document.querySelector('[data-item="saganaki"]').classList.contains('is-unavailable')`), true);
  assert.match(await p.text('[data-price-for="tzatziki"]'), /5,50/);
  clean(p);
});

test('menu page is usable with JavaScript disabled (raw HTML)', async () => {
  const html = await (await fetch(U('/menu/'))).text();
  assert.ok(html.includes('Σαγανάκι') && html.includes('Μπύρες') && html.includes('Coca Cola'));
  const en = await (await fetch(U('/en/menu/'))).text();
  assert.ok(en.includes('Saganaki') && en.includes('Beers') && en.includes('Wine by the bottle'));
});

async function openCheckout(p, mobile = false) {
  await p.click(mobile ? '#cart-fab' : '#open-checkout');
  await p.waitFor(`document.querySelector('#co-dialog').open`);
}

async function addItem(p, id, { opt, qty, note } = {}) {
  await p.click(`[data-add="${id}"]`);
  await p.waitFor(`document.querySelector('#item-dialog').open`);
  if (opt) await p.click(`#item-dialog input[value="${opt}"]`);
  if (qty) await p.fill('#d-qty', String(qty));
  if (note) await p.fill('#d-note', note);
  await p.click('#d-add');
  await p.waitFor(`!document.querySelector('#item-dialog').open`);
}

test('order: cart math, options, notes, validation, manual pickup fallback, demo submit, no duplicates', async () => {
  const p = await page({ width: 390, height: 844, mobile: true });
  await p.goto(U('/en/order/'));
  await p.waitFor(`document.querySelector('[data-add]')`);
  await addItem(p, 'tzatziki', { qty: 2, note: 'no garlic' });
  await addItem(p, 'meat-platter', { opt: 'p4' });
  assert.match(await p.text('#cart-total'), /€?\s?49\.00|49\.00/); // 2*5 + 39
  // required option cannot be skipped: switch to unchecked state by submitting a platter without choosing (radio defaults to first)
  await p.click('[data-add="cheese-platter"]'); await p.waitFor(`document.querySelector('#item-dialog').open`);
  assert.equal(await p.eval(`document.querySelector('#item-dialog input[value="p2"]').checked`), true);
  await p.click('#d-cancel');
  // quantity bounds
  await p.click('[data-add="bread"]'); await p.waitFor(`document.querySelector('#item-dialog').open`);
  await p.fill('#d-qty', '21'); await p.click('#d-add');
  assert.ok((await p.text('#d-err')).length > 0);
  await p.click('#d-cancel');
  // +/- and remove
  await p.eval(`document.querySelector('.cart-line [data-inc]').click()`);
  assert.match(await p.text('#cart-total'), /54\.00/);
  await openCheckout(p, true); // the details form opens from a button, nobody scrolls to the bottom of the menu
  // hours are unverified -> manual pickup request, not a slot picker
  assert.equal(await p.eval(`document.querySelector('#f-pickup').tagName`), 'INPUT');
  assert.match(await p.text('#pickup-box'), /not yet verified/i);
  // invalid phone is rejected with an accessible error
  await p.fill('#f-name', 'Maria P.'); await p.fill('#f-phone', '123'); await p.fill('#f-pickup', 'around 20:30');
  await p.click('#submit');
  await p.waitFor(`document.querySelector('#f-phone').getAttribute('aria-invalid')==='true'`);
  assert.equal(await p.eval(`JSON.parse(localStorage.getItem('tsb.demo.orders.v1')||'[]').length`), 0);
  // valid submit with a double click => exactly one order
  await p.fill('#f-phone', '694 123 4567');
  await p.eval(`(()=>{const b=document.querySelector('#submit');b.click();b.click();return true})()`);
  await p.waitFor(`document.querySelector('#confirm')`);
  assert.equal(await p.eval(`JSON.parse(localStorage.getItem('tsb.demo.orders.v1')).length`), 1);
  assert.match(await p.text('#confirm'), /DEMO-\d{4}-0001/);
  const o = await p.eval(`JSON.parse(localStorage.getItem('tsb.demo.orders.v1'))[0]`);
  assert.equal(o.subtotal, 5400); assert.equal(o.payment, 'cash'); assert.equal(o.fulfilment.type, 'takeaway'); assert.equal(o.status, 'pending'); assert.equal(o.demo, true);
  assert.equal(o.lines.find((l) => l.itemId === 'tzatziki').note, 'no garlic');
  clean(p);
});

test('order: paused ordering blocks the form; unavailable items cannot be added', async () => {
  const p = await page({ width: 1440, height: 900 });
  await p.goto(U('/order/'));
  await p.eval(`localStorage.setItem('tsb.demo.settings.v1', JSON.stringify({paused:true,overrides:{fava:{available:false}}}))`);
  await p.goto(U('/order/'));
  await p.waitFor(`document.querySelector('#paused-note')`);
  assert.equal(await p.eval(`document.querySelector('#submit').disabled`), true);
  assert.equal(await p.eval(`document.querySelector('[data-add="fava"]').disabled`), true);
  clean(p);
});

test('admin: fixture login, role gating, order lifecycle, race protection, pause, price edit, audit, reports', async () => {
  const p = await page({ width: 1440, height: 900 });
  await p.goto(U('/admin/'));
  await p.fill('#a-user', 'staff'); await p.fill('#a-pass', 'wrong'); await p.click('#login button[type=submit]');
  assert.match(await p.text('#a-err'), /./);
  await p.fill('#a-user', 'owner'); await p.fill('#a-pass', 'owner-demo'); await p.click('#login button[type=submit]');
  await p.waitFor(`document.querySelector('#sim')`);
  await p.click('#sim'); await p.click('#sim');
  assert.equal(await p.count('.ord'), 2);
  assert.equal(await p.count('#col-pending ~ .ord'), 2);
  // a new order opens the popup; the venue gives THIS order its own time
  await p.waitFor(`document.querySelector('#incoming').open`);
  const firstId = await p.eval(`document.querySelector('#incoming').dataset.id`);
  await p.fill('#eta', '35'); await p.click('#in-accept');
  for (const to of ['preparing', 'ready', 'collected']) {
    await p.eval(`document.querySelector('.ord[data-id="${firstId}"] [data-act="${to}"]').click()`);
  }
  const st = await p.eval(`JSON.parse(localStorage.getItem('tsb.demo.orders.v1')).find(o=>o.id==='${firstId}')`);
  assert.equal(st.status, 'collected'); assert.equal(st.version, 5); assert.equal(st.audit.length, 5); assert.equal(st.etaMinutes, 35);
  // race: another "device" changes the order after this screen rendered; the stale click is rejected
  await p.waitFor(`document.querySelector('#incoming').open`);
  const secondId = await p.eval(`document.querySelector('#incoming').dataset.id`);
  await p.eval(`(()=>{const k='tsb.demo.orders.v1';const a=JSON.parse(localStorage.getItem(k));const o=a.find(x=>x.id==='${secondId}');o.version+=1;o.status='confirmed';localStorage.setItem(k,JSON.stringify(a));return true})()`);
  await p.click('#in-accept');
  await p.waitFor(`document.querySelector('.toast')`);
  assert.match(await p.text('.toast'), /another device|άλλη συσκευή/);
  // pause + prep time + price edit (owner)
  await p.click('#tab-settings'); await p.click('#s-pause');
  assert.equal(await p.eval(`JSON.parse(localStorage.getItem('tsb.demo.settings.v1')).paused`), true);
  await p.click('#tab-menu');
  await p.fill('[data-price="tzatziki"]', '5,80');
  assert.equal(await p.eval(`JSON.parse(localStorage.getItem('tsb.demo.settings.v1')).overrides.tzatziki.price`), 580);
  await p.click('#tab-reports'); assert.match(await p.text('#panel'), /Simulated|Προσομοιωμένες/);
  await p.click('#tab-audit'); assert.match(await p.text('#panel'), /pending → confirmed|pending → confirmed/);
  // kitchen role: no confirm/reject, no reports, no price edit
  await p.click('#out');
  await p.fill('#a-user', 'kitchen'); await p.fill('#a-pass', 'kitchen-demo'); await p.click('#login button[type=submit]');
  await p.waitFor(`document.querySelector('.tabs')`);
  assert.equal(await p.count('[data-act="confirmed"]'), 0);
  assert.equal(await p.count('#tab-reports'), 0);
  assert.equal(await p.count('#sim'), 0);
  await p.click('#tab-menu');
  assert.equal(await p.eval(`document.querySelector('[data-price]').disabled`), true);
  clean(p);
});

test('admin: soft chime repeats every 10 s until the order is answered; sound needs a click after a reload', async () => {
  const p = await page({ width: 1440, height: 900 });
  await p.goto(U('/admin/'));
  const hook = `window.__ac=0;window.__osc=0;const AC=window.AudioContext;window.AudioContext=function(...a){window.__ac++;const c=new AC(...a);const o=c.createOscillator.bind(c);c.createOscillator=()=>{window.__osc++;return o()};return c};true`;
  await p.eval(hook);
  assert.equal(await p.eval('window.__ac'), 0);
  await p.fill('#a-user', 'staff'); await p.fill('#a-pass', 'staff-demo'); await p.click('#login button[type=submit]');
  await p.waitFor(`document.querySelector('#snd')`);
  assert.equal(await p.eval('window.__ac'), 1); // created by the login click, never before
  assert.equal(await p.eval(`document.querySelector('#snd').getAttribute('aria-pressed')`), 'true');
  await p.click('#sim');
  await p.waitFor(`window.__osc>=2`, 5000);
  const n1 = await p.eval('window.__osc');
  await p.waitFor(`window.__osc>=${n1 + 2}`, 13000); // repeats about every 10 seconds
  await p.waitFor(`document.querySelector('#incoming').open`);
  await p.click('#in-accept'); // answered: the alarm stops
  await p.waitFor(`!document.querySelector('#incoming').open`);
  const n2 = await p.eval('window.__osc');
  await new Promise((r) => setTimeout(r, 11500));
  assert.equal(await p.eval('window.__osc'), n2);
  // after a reload the browser forgets: sound shows as off until the first click
  await p.goto(U('/admin/'));
  await p.eval(hook);
  await p.waitFor(`document.querySelector('#snd')`);
  assert.equal(await p.eval('window.__ac'), 0);
  assert.equal(await p.eval(`document.querySelector('#snd').getAttribute('aria-pressed')`), 'false');
  clean(p);
});

test('admin: incoming popup (own time, reject with reason, later), archive search, saved customers', async () => {
  const p = await page({ width: 1440, height: 900 });
  await p.goto(U('/en/admin/'));
  await p.fill('#a-user', 'owner'); await p.fill('#a-pass', 'owner-demo'); await p.click('#login button[type=submit]');
  await p.waitFor(`document.querySelector('#sim')`);
  await p.click('#sim');
  await p.waitFor(`document.querySelector('#incoming').open`);
  await p.click('#in-later');
  await p.waitFor(`!document.querySelector('#incoming').open && document.querySelector('.alert-bar')`);
  await p.click('#open-in');
  await p.waitFor(`document.querySelector('#incoming').open`);
  await p.click('#in-later');
  await p.waitFor(`!document.querySelector('#incoming').open && document.querySelector('.alert-bar')`); // the bar proves the dismissal was recorded
  await p.click('#sim'); // second simulated order is a delivery
  await p.waitFor(`document.querySelector('#incoming').open`);
  assert.equal(await p.eval(`document.querySelector('#eta').value`), '40'); // 25 default + 15 for delivery: a suggestion, not a flat rate
  const delId = await p.eval(`document.querySelector('#incoming').dataset.id`);
  await p.click('#in-reject');
  await p.click('#rj-ok');
  assert.match(await p.text('#rj-err'), /./); // a reason is required
  await p.fill('#rj', 'We are full right now'); await p.click('#rj-ok');
  const rej = await p.eval(`JSON.parse(localStorage.getItem('tsb.demo.orders.v1')).find(o=>o.id==='${delId}')`);
  assert.equal(rej.status, 'rejected'); assert.equal(rej.audit.at(-1).reason, 'We are full right now');
  await p.waitFor(`document.querySelector('#open-in')`); // the takeaway order was put off with "Later": a bar offers to reopen it
  await p.click('#open-in');
  await p.waitFor(`document.querySelector('#incoming').open`);
  assert.equal(await p.eval(`document.querySelector('#eta').value`), '25');
  await p.fill('#eta', '20'); await p.click('#in-accept');
  await p.waitFor(`!document.querySelector('#incoming').open`);
  const acc = await p.eval(`JSON.parse(localStorage.getItem('tsb.demo.orders.v1')).find(o=>o.status==='confirmed')`);
  assert.equal(acc.etaMinutes, 20);
  assert.match(await p.text('.ord[data-id="' + acc.id + '"] .eta'), /20 min/);
  // archive: the rejected order lives there, with search
  await p.click('[data-view="archive"]');
  assert.equal(await p.count('.arch'), 1);
  await p.fill('#arch-q', 'zzzz');
  assert.equal(await p.count('.arch'), 0);
  await p.fill('#arch-q', delId);
  assert.equal(await p.count('.arch'), 1);
  // saved customers: save from an order, see it in the Customers tab, delete it
  await p.click('[data-view="active"]');
  await p.eval(`document.querySelector('.ord[data-id="${acc.id}"] [data-savecust]').click()`);
  await p.click('#tab-customers');
  assert.equal(await p.count('.cust'), 1);
  await p.click('[data-cdel]');
  assert.equal(await p.count('.cust'), 0);
  clean(p);
});

test('order: details form opens from a button; remembered details are optional and deletable; venue answer shows live', async () => {
  const p = await page({ width: 1440, height: 900 });
  await p.goto(U('/en/order/'));
  await p.waitFor(`document.querySelector('[data-add]')`);
  await addItem(p, 'tzatziki');
  await p.eval('window.scrollTo(0, 3000)');
  assert.equal(await p.eval(`(()=>{const r=document.querySelector('#open-checkout').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()`), true);
  assert.equal(await p.eval(`document.querySelector('#co-dialog').open`), false);
  await openCheckout(p);
  await p.fill('#f-name', 'Eleni D.'); await p.fill('#f-phone', '694 123 4567'); await p.fill('#f-pickup', 'around 21:00');
  await p.click('#f-remember');
  await p.click('#submit');
  await p.waitFor(`document.querySelector('#confirm')`);
  assert.match(await p.text('#live-status'), /Waiting/);
  // the venue accepts with its own time (written straight to demo storage here)
  await p.eval(`(()=>{const k='tsb.demo.orders.v1';const a=JSON.parse(localStorage.getItem(k));a[0].status='confirmed';a[0].version=2;a[0].etaMinutes=25;a[0].etaAt=new Date(Date.now()+25*60000).toISOString();localStorage.setItem(k,JSON.stringify(a));return true})()`);
  await p.waitFor(`/about 25 minutes/.test(document.querySelector('#live-status').textContent)`, 6000);
  // next visit: details are filled in; one click deletes them
  await p.goto(U('/en/order/'));
  await p.waitFor(`document.querySelector('[data-add]')`);
  await addItem(p, 'tzatziki');
  await openCheckout(p);
  assert.equal(await p.eval(`document.querySelector('#f-name').value`), 'Eleni D.');
  assert.equal(await p.eval(`document.querySelector('#saved-row').hidden`), false);
  await p.click('#forget');
  assert.equal(await p.eval(`document.querySelector('#f-name').value`), '');
  assert.equal(await p.eval(`localStorage.getItem('tsb.customer.v1')`), null);
  clean(p);
});

test('events: real flyer event, past events section, instagram carousel, calendar, inquiry never auto-confirms', async () => {
  const p = await page({ width: 1440, height: 900 });
  await p.goto(U('/en/events/'));
  assert.equal(await p.count('.event-feature'), 1);
  assert.match(await p.text('.event-feature'), /Κυριακάκης/);
  assert.equal(await p.count('.past-grid .post'), 8);
  assert.ok((await p.count('.car-track .post')) >= 6);
  assert.equal(await p.eval(`[...document.querySelectorAll('.post a[href*="instagram.com"]')].every(a=>a.rel.includes('noopener'))`), true);
  const m1 = await p.text('.cal-head h3');
  await p.click('#cal-next');
  assert.notEqual(await p.text('.cal-head h3'), m1);
  await p.click('#inquiry-root button[type=submit]');
  await p.waitFor(`document.querySelector('[aria-invalid=true]')`);
  await p.fill('#i-name', 'Eleni K.'); await p.fill('#i-phone', '694 123 4567'); await p.fill('#i-size', '12');
  await p.fill('#i-date', '2099-01-10'); await p.eval(`document.querySelector('#i-consent').click()`);
  await p.click('#inquiry-root button[type=submit]');
  await p.waitFor(`document.querySelector('#form-ok')`);
  const q = await p.eval(`JSON.parse(localStorage.getItem('tsb.demo.inquiries.v1'))[0]`);
  assert.equal(q.confirmed, false); assert.equal(q.status, 'new'); assert.equal(q.demo, true);
  assert.match(await p.text('#form-ok'), /not a booking|δεν αποτελεί κράτηση/i);
  clean(p);
});

test('offers: all concept labels visible; coupon architecture refuses every code', async () => {
  const p = await page({ width: 1440, height: 900 });
  await p.goto(U('/en/offers/'));
  assert.equal(await p.count('.tag-concept'), 5);
  await p.fill('#coupon-code', 'student-concept'); await p.click('#coupon-form button');
  assert.match(await p.text('#coupon-msg'), /no active codes/i);
  await p.fill('#coupon-code', 'FREE100'); await p.click('#coupon-form button');
  assert.match(await p.text('#coupon-msg'), /Unknown code/i);
  clean(p);
});

test('contact: click-to-call, directions, demo form saves locally', async () => {
  const p = await page({ width: 390, height: 844, mobile: true });
  await p.goto(U('/contact/'));
  assert.equal(await p.eval(`document.querySelector('a[href="tel:+302106005412"]') !== null`), true);
  await p.fill('#c-name', 'Nikos T.'); await p.fill('#c-phone', '210 600 5412'); await p.fill('#c-msg', 'Γεια σας');
  await p.eval(`document.querySelector('#c-consent').click()`);
  await p.click('#contact-root button[type=submit]');
  await p.waitFor(`document.querySelector('#form-ok')`);
  clean(p);
});

test('cookie notice: shown once, choice remembered, analytics only after opt-in', async () => {
  const p = await page({ width: 1440, height: 900 });
  await p.goto(U('/'));
  assert.equal(await p.count('.cookie'), 1);
  assert.equal(await p.eval(`localStorage.getItem('tsb.analytics')`), null);
  await p.click('[data-consent="analytics"]');
  assert.equal(await p.count('.cookie'), 0);
  assert.equal(await p.eval(`JSON.parse(localStorage.getItem('tsb.analytics')).length`) >= 1, true);
  await p.goto(U('/menu/'));
  assert.equal(await p.count('.cookie'), 0);
  clean(p);
});

test('no third-party requests: every network request stays on the demo origin', async () => {
  const p = await page({ width: 1440, height: 900 });
  await p.goto(U('/'));
  const external = await p.eval(`performance.getEntriesByType('resource').map(r=>r.name).filter(n=>!n.startsWith(location.origin))`);
  assert.deepEqual(external, []);
});

test('order: delivery requires an address, card is a label only, order appears in admin with type and address', async () => {
  const p = await page({ width: 390, height: 844, mobile: true });
  await p.goto(U('/en/order/'));
  await p.waitFor(`document.querySelector('[data-add]')`);
  await addItem(p, 'tzatziki', { qty: 1 });
  await p.click('[data-mode="delivery"]');
  await openCheckout(p, true);
  assert.equal(await p.eval(`document.querySelector('#address-box').hidden`), false);
  await p.fill('#f-name', 'Nikos T.'); await p.fill('#f-phone', '694 123 4567'); await p.fill('#f-pickup', 'around 21:00');
  await p.eval(`document.querySelector('input[name=pay][value=card]').click()`);
  await p.click('#submit');
  await p.waitFor(`document.querySelector('#f-street[aria-invalid=true]')`);
  assert.equal(await p.eval(`JSON.parse(localStorage.getItem('tsb.demo.orders.v1')||'[]').length`), 0);
  await p.fill('#f-street', 'Agiou Ioannou'); await p.fill('#f-number', '71'); await p.fill('#f-area', 'Agia Paraskevi'); await p.fill('#f-postcode', '15342');
  await p.click('#submit');
  await p.waitFor(`document.querySelector('#confirm')`);
  const o = await p.eval(`JSON.parse(localStorage.getItem('tsb.demo.orders.v1'))[0]`);
  assert.equal(o.fulfilment.type, 'delivery'); assert.equal(o.payment, 'card'); assert.equal(o.paid, false);
  await p.goto(U('/en/admin/'));
  await p.fill('#a-user', 'staff'); await p.fill('#a-pass', 'staff-demo'); await p.click('#login button[type=submit]');
  await p.waitFor(`document.querySelector('.ord')`);
  assert.match(await p.text('.ord'), /Agiou Ioannou 71/);
  assert.equal(await p.eval(`document.querySelector('.ord').dataset.type`), 'delivery');
  await p.click('[data-filter="takeaway"]');
  assert.equal(await p.count('.ord'), 0);
  clean(p);
});

test('admin: hide / sold-out / price / image reflect on the menu and order pages; QR carries the logo', async () => {
  const p = await page({ width: 1440, height: 900 });
  await p.goto(U('/en/admin/'));
  await p.fill('#a-user', 'owner'); await p.fill('#a-pass', 'owner-demo'); await p.click('#login button[type=submit]');
  await p.click('#tab-menu');
  await p.eval(`(()=>{const s=document.querySelector('[data-status="tzatziki"]');s.value='hidden';s.dispatchEvent(new Event('change'));const f=document.querySelector('[data-status="fava"]');f.value='soldout';f.dispatchEvent(new Event('change'));const pr=document.querySelector('[data-price="bread"]');pr.value='3.50';pr.dispatchEvent(new Event('change'));return true})()`);
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await p.eval(`(()=>{const k=JSON.parse(localStorage.getItem('tsb.demo.images.v1')||'{}');k['item:bread']='${png}';localStorage.setItem('tsb.demo.images.v1',JSON.stringify(k));return true})()`);
  await p.goto(U('/en/menu/'));
  assert.equal(await p.count('[data-item="tzatziki"]'), 0);
  assert.equal(await p.eval(`document.querySelector('[data-item="fava"]').classList.contains('is-unavailable')`), true);
  assert.match(await p.text('[data-price-for="bread"]'), /3\.50/);
  assert.equal(await p.count('[data-item="bread"] img'), 1);
  await p.goto(U('/en/order/'));
  await p.waitFor(`document.querySelector('[data-add]')`);
  assert.equal(await p.count('[data-add="tzatziki"]'), 0);
  assert.equal(await p.eval(`document.querySelector('[data-add="fava"]').disabled`), true);
  // QR on the menu page contains the centre logo image
  await p.goto(U('/en/menu/'));
  await p.waitFor(`document.querySelector('[data-qr-box] svg image')`);
  clean(p);
});

test('admin: order receipt text has address and cash-to-collect; courier email is validated and used in mailto', async () => {
  const p = await page({ width: 1440, height: 900 });
  await p.goto(U('/en/admin/'));
  await p.fill('#a-user', 'owner'); await p.fill('#a-pass', 'owner-demo'); await p.click('#login button[type=submit]');
  await p.click('#sim'); await p.click('#sim');
  await p.waitFor(`document.querySelectorAll('.ord').length>=2`);
  await p.eval(`window.__print=0;window.print=()=>{window.__print++;window.__slip=document.querySelector('#receipt').textContent};true`);
  await p.eval(`document.querySelector('.ord[data-type=delivery] [data-rc=print]').click()`);
  assert.equal(await p.eval('window.__print'), 1);
  const slip = await p.eval('window.__slip');
  assert.match(slip, /Address:/); assert.match(slip, /NOT a tax receipt/);
  await p.click('#tab-settings');
  await p.fill('#s-courier', 'not-an-email'); await p.click('#s-save');
  assert.equal(await p.eval(`document.querySelector('#s-courier').getAttribute('aria-invalid')`), 'true');
  await p.fill('#s-courier', 'courier@example.com'); await p.click('#s-save');
  assert.equal(await p.eval(`JSON.parse(localStorage.getItem('tsb.demo.settings.v1')).courierEmail`), 'courier@example.com');
  clean(p);
});

test('reservations: guest books a slot, staff confirms it, owner capacity setting closes the slots, guest can look up and cancel', async () => {
  const p = await page({ width: 390, height: 844, mobile: true });
  await p.goto(U('/en/reserve/'));
  await p.waitFor(`document.querySelector('#res-form')`);
  const pickDate = `(()=>{const d=new Date(Date.now()+4*86400000);while(d.getUTCDay()!==6)d=new Date(d.getTime()+86400000);const v=d.toISOString().slice(0,10);const i=document.querySelector('#r-date');i.value=v;i.dispatchEvent(new Event('change',{bubbles:true}));return v})()`.replace('const d=new Date(Date.now()+4*86400000)', 'let d=new Date(Date.now()+4*86400000)');
  const date = await p.eval(pickDate);
  await p.waitFor(`document.querySelector('input[name=r-time]:not([disabled])')`);
  await p.eval(`(()=>{document.querySelector('input[name=r-time][value="20:00"]').click();return true})()`);
  // submitting without details shows field errors and stores nothing
  await p.click('#r-submit');
  await p.waitFor(`document.querySelector('#r-name[aria-invalid=true]')`);
  assert.equal(await p.eval(`JSON.parse(localStorage.getItem('tsb.demo.reservations.v1')||'[]').length`), 0);
  await p.eval(`(()=>{const s=document.querySelector('#r-party');s.value='4';s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  await p.waitFor(`document.querySelector('input[name=r-time]:not([disabled])')`);
  await p.eval(`(()=>{document.querySelector('input[name=r-time][value="20:00"]').click();return true})()`);
  await p.fill('#r-name', 'Maria P.'); await p.fill('#r-phone', '694 123 4567');
  await p.eval(`document.querySelector('#r-consent').click()`);
  await p.click('#r-submit');
  await p.waitFor(`document.querySelector('#res-ok')`);
  const r = await p.eval(`JSON.parse(localStorage.getItem('tsb.demo.reservations.v1'))[0]`);
  assert.equal(r.status, 'pending'); assert.equal(r.partySize, 4); assert.equal(r.time, '20:00'); assert.equal(r.date, date);
  assert.match(await p.text('#res-ok'), /DEMO-RES-0001/);

  // staff confirms
  await p.goto(U('/en/admin/'));
  await p.fill('#a-user', 'staff'); await p.fill('#a-pass', 'staff-demo'); await p.click('#login button[type=submit]');
  await p.waitFor(`document.querySelector('#res-bar')`);
  await p.click('#open-res');
  await p.waitFor(`document.querySelector('.rv-row')`);
  assert.match(await p.text('.rv-row'), /Maria P\./);
  await p.click('[data-res][data-to="confirmed"]');
  await p.waitFor(`JSON.parse(localStorage.getItem('tsb.demo.reservations.v1'))[0].status==='confirmed'`);
  await p.click('[data-rv-sub="settings"]');
  await p.waitFor(`document.querySelector('#rs-maxCapacity')`);
  assert.equal(await p.eval(`document.querySelector('#rs-save')===null`), true); // staff has no save button
  assert.equal(await p.eval(`document.querySelector('#rs-maxCapacity').disabled`), true); // only the owner edits limits
  await p.eval(`sessionStorage.clear()`);

  // owner shrinks capacity -> a party of 4 no longer fits anywhere that day
  await p.goto(U('/en/admin/'));
  await p.fill('#a-user', 'owner'); await p.fill('#a-pass', 'owner-demo'); await p.click('#login button[type=submit]');
  await p.waitFor(`document.querySelector('#tab-reservations')`);
  await p.click('#tab-reservations');
  await p.waitFor(`document.querySelector('[data-rv-sub="settings"]')`);
  await p.click('[data-rv-sub="settings"]');
  await p.waitFor(`document.querySelector('#rs-maxCapacity')`);
  await p.fill('#rs-maxCapacity', '3'); await p.click('#rs-save');
  await p.waitFor(`JSON.parse(localStorage.getItem('tsb.demo.reservation-settings.v1')).maxCapacity===3`);
  await p.goto(U('/en/reserve/'));
  await p.waitFor(`document.querySelector('#res-form')`);
  await p.eval(`(()=>{const s=document.querySelector('#r-party');s.value='4';s.dispatchEvent(new Event('change',{bubbles:true}));const i=document.querySelector('#r-date');i.value='${date}';i.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  await p.waitFor(`document.querySelector('#slots .notice')`);
  assert.equal(await p.count('input[name=r-time]:not([disabled])'), 0);

  // guest looks the booking up and cancels it
  await p.fill('#lk-ref', 'demo-res-0001'); await p.fill('#lk-phone', '6941234567');
  await p.eval(`document.querySelector('#lk-form').requestSubmit()`);
  await p.waitFor(`document.querySelector('#lk-cancel')`);
  await p.click('#lk-cancel');
  await p.waitFor(`JSON.parse(localStorage.getItem('tsb.demo.reservations.v1'))[0].status==='cancelled'`);
  clean(p);
});
