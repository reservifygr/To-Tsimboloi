// Generates the review screenshots into screenshots/. Usage: npm run build && npm run shots
import { mkdir } from 'node:fs/promises';
import { launch } from './lib.mjs';
import { start } from '../../scripts/serve.mjs';

const PORT = 4800 + Math.floor(Math.random() * 100);
const U = (p) => `http://localhost:${PORT}${p}`;
const out = new URL('../../screenshots/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const srv = await start(PORT); const br = await launch();
try {
  const dismiss = (p) => p.eval(`document.querySelector('[data-consent=essential]')?.click(); document.querySelectorAll('.reveal').forEach(e=>e.classList.add('in')); document.querySelectorAll('img[loading=lazy]').forEach(i=>i.loading='eager'); Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r}))).then(()=>true)`);
  const fresh = async (opts) => { const p = await br.newPage(opts); await p.goto(U('/robots.txt')); await p.eval(`localStorage.clear();sessionStorage.clear();localStorage.setItem('tsb.embeds','"off"');true`); return p; };

  let p = await fresh({ width: 1440, height: 900 });
  await p.goto(U('/')); await dismiss(p); await p.shot(out + '01-desktop-homepage.png'); await p.shot(out + '01-desktop-homepage-full.png', { full: true });

  p = await fresh({ width: 390, height: 844, mobile: true, scale: 2 });
  await p.goto(U('/menu/?table=12')); await dismiss(p); await p.shot(out + '02-mobile-menu.png');
  await p.click('[data-open-qr]'); await p.waitFor(`document.querySelector('#qr-dialog').open`); await p.shot(out + '02b-mobile-menu-qr.png');

  p = await fresh({ width: 390, height: 844, mobile: true, scale: 2 });
  await p.goto(U('/en/order/')); await dismiss(p); await p.waitFor(`document.querySelector('[data-add]')`);
  for (const [id, opt] of [['saganaki'], ['tzatziki'], ['meat-platter', 'p4']]) {
    await p.click(`[data-add="${id}"]`); await p.waitFor(`document.querySelector('#item-dialog').open`);
    if (opt) await p.click(`#item-dialog input[value="${opt}"]`); await p.click('#d-add'); await p.waitFor(`!document.querySelector('#item-dialog').open`);
  }
  await p.click('[data-mode="delivery"]');
  await new Promise((r) => setTimeout(r, 300)); await p.shot(out + '03a-mobile-order-page.png');
  await p.click('#cart-fab'); await p.waitFor(`document.querySelector('#co-dialog').open`);
  await p.fill('#f-name', 'Maria P.'); await p.fill('#f-phone', '694 123 4567'); await p.fill('#f-street', 'Agiou Ioannou'); await p.fill('#f-number', '71');
  await new Promise((r) => setTimeout(r, 300));
  await p.shot(out + '03-mobile-checkout-cart.png');

  p = await fresh({ width: 1440, height: 900 });
  await p.goto(U('/en/admin/')); await dismiss(p);
  await p.fill('#a-user', 'owner'); await p.fill('#a-pass', 'owner-demo'); await p.click('#login button[type=submit]');
  await p.waitFor('document.querySelector("#sim")');
  for (let i = 0; i < 5; i++) await p.click('#sim');
  await p.waitFor(`document.querySelector('#incoming').open`); await new Promise((r) => setTimeout(r, 400));
  await p.shot(out + '04a-admin-incoming-popup.png');
  for (const eta of ['20', '35', '50']) {
    await p.waitFor(`document.querySelector('#incoming').open`);
    await p.fill('#eta', eta); await p.click('#in-accept'); await new Promise((r) => setTimeout(r, 250));
  }
  await p.waitFor(`document.querySelector('#incoming').open`);
  await p.click('#in-reject'); await p.fill('#rj', 'Outside our delivery area'); await p.click('#rj-ok'); await new Promise((r) => setTimeout(r, 250));
  await p.waitFor(`document.querySelector('#incoming').open`);
  await p.click('#in-later'); await new Promise((r) => setTimeout(r, 400));
  await p.eval(`(()=>{const c=document.querySelector('#col-confirmed ~ .ord [data-act=preparing]');c&&c.click();return true})()`);
  await new Promise((r) => setTimeout(r, 300)); await p.shot(out + '04-staff-incoming-orders.png');
  await p.click('[data-view="archive"]'); await new Promise((r) => setTimeout(r, 200)); await p.eval(`document.querySelector('.arch summary')?.click();true`);
  await new Promise((r) => setTimeout(r, 200)); await p.shot(out + '04b-admin-archive.png');

  p = await fresh({ width: 390, height: 844, mobile: true, scale: 2 });
  await p.goto(U('/en/admin/')); await dismiss(p);
  await p.fill('#a-user', 'owner'); await p.fill('#a-pass', 'owner-demo'); await p.click('#login button[type=submit]');
  await p.waitFor('document.querySelector("#sim")'); await p.click('#sim'); await p.click('#sim');
  await p.waitFor(`document.querySelector('#incoming').open`); await new Promise((r) => setTimeout(r, 400));
  await p.shot(out + '04c-mobile-admin-incoming-popup.png');
  console.log('overflow', await p.eval('document.documentElement.scrollWidth>innerWidth'));

  p = await fresh({ width: 1440, height: 900 });
  await p.goto(U('/events/')); await dismiss(p); await p.shot(out + '05-events.png', { full: true });
  p = await fresh({ width: 1440, height: 900 });
  await p.goto(U('/en/admin/')); await dismiss(p);
  await p.fill('#a-user', 'owner'); await p.fill('#a-pass', 'owner-demo'); await p.click('#login button[type=submit]');
  await p.click('#tab-menu'); await new Promise((r) => setTimeout(r, 200)); await p.shot(out + '06-admin-menu-images-prices.png');
  await p.click('#tab-qr'); await p.waitFor(`document.querySelector('#q-box svg')`); await p.shot(out + '07-admin-qr-with-logo.png');
  console.log('screenshots written to', out);
} finally { br.close(); srv.close(); }
