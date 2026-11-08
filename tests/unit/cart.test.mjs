import test from 'node:test';
import assert from 'node:assert/strict';
import { MENU, ITEMS, applyOverrides, findItem } from '../../src/shared/menu-data.js';
import { emptyCart, addLine, setQty, removeLine, totals, CartError, MAX_QTY_PER_LINE } from '../../src/shared/cart.js';
import { eur, toCents } from '../../src/shared/money.js';

const menu = MENU;

test('menu: every item has bilingual names, integer cents, and is has a boolean verified flag (drinks the owner confirmed are true)', () => {
  assert.ok(ITEMS.length >= 20);
  const ids = new Set();
  for (const i of ITEMS) {
    assert.ok(i.name.el && i.name.en, `${i.id} needs el+en`);
    assert.ok(Number.isInteger(i.price) && i.price > 0, `${i.id} price`);
    assert.equal(typeof i.verified, 'boolean', `${i.id} needs a verified flag`);
    assert.ok(menu.categories.some((c) => c.id === i.cat), `${i.id} category`);
    assert.ok(!ids.has(i.id), `${i.id} duplicated`);
    ids.add(i.id);
  }
});

test('menu: prices from the brief', () => {
  const p = (id) => findItem(menu, id).price;
  assert.equal(p('bread'), 250);
  assert.equal(p('choriatiki'), 1000);
  assert.equal(p('saganaki'), 850);
  assert.equal(p('beef-patties'), 1450);
  assert.equal(p('meat-platter'), 2700);
  assert.equal(p('pink-grapefruit'), 350);
});

test('cart: add, merge identical lines, quantity math', () => {
  let c = emptyCart();
  c = addLine(c, menu, { itemId: 'tzatziki', qty: 2 });
  c = addLine(c, menu, { itemId: 'tzatziki', qty: 1 });
  assert.equal(c.lines.length, 1);
  assert.equal(c.lines[0].qty, 3);
  c = addLine(c, menu, { itemId: 'bread', qty: 2 });
  const t = totals(menu, c);
  assert.equal(t.subtotal, 3 * 500 + 2 * 250);
  assert.equal(t.itemCount, 5);
});

test('cart: different notes make separate lines', () => {
  let c = emptyCart();
  c = addLine(c, menu, { itemId: 'fries', qty: 1, note: 'no salt' });
  c = addLine(c, menu, { itemId: 'fries', qty: 1, note: '' });
  assert.equal(c.lines.length, 2);
});

test('cart: options are required, validated and priced (platters 2 vs 4 people)', () => {
  assert.throws(() => addLine(emptyCart(), menu, { itemId: 'meat-platter', qty: 1 }), (e) => e instanceof CartError && e.code === 'OPTION_REQUIRED');
  assert.throws(() => addLine(emptyCart(), menu, { itemId: 'meat-platter', optionIds: ['p2', 'p4'] }), (e) => e.code === 'OPTION_MAX');
  assert.throws(() => addLine(emptyCart(), menu, { itemId: 'meat-platter', optionIds: ['bogus'] }), (e) => e.code === 'UNKNOWN_OPTION');
  assert.throws(() => addLine(emptyCart(), menu, { itemId: 'bread', optionIds: ['p2'] }), (e) => e.code === 'UNKNOWN_OPTION');
  const two = totals(menu, addLine(emptyCart(), menu, { itemId: 'meat-platter', optionIds: ['p2'] }));
  const four = totals(menu, addLine(emptyCart(), menu, { itemId: 'meat-platter', optionIds: ['p4'] }));
  assert.equal(two.subtotal, 2700);
  assert.equal(four.subtotal, 3900); // brief: mixed meat platter 4 people EUR 39
  const cheese4 = totals(menu, addLine(emptyCart(), menu, { itemId: 'cheese-platter', optionIds: ['p4'] }));
  assert.equal(cheese4.subtotal, 2700); // brief: cheese platter 4 people EUR 27
});

test('cart: quantity bounds and integer checks', () => {
  for (const bad of [0, -1, 1.5, MAX_QTY_PER_LINE + 1, NaN]) {
    assert.throws(() => addLine(emptyCart(), menu, { itemId: 'bread', qty: bad }), (e) => e.code === 'BAD_QTY');
  }
  let c = addLine(emptyCart(), menu, { itemId: 'bread', qty: MAX_QTY_PER_LINE });
  assert.throws(() => addLine(c, menu, { itemId: 'bread', qty: 1 }), (e) => e.code === 'BAD_QTY');
});

test('cart: setQty / removeLine', () => {
  let c = addLine(emptyCart(), menu, { itemId: 'bread', qty: 2 });
  const key = c.lines[0].key;
  c = setQty(c, key, 5);
  assert.equal(c.lines[0].qty, 5);
  c = setQty(c, key, 0);
  assert.equal(c.lines.length, 0);
  c = addLine(c, menu, { itemId: 'fries' });
  assert.equal(removeLine(c, c.lines[0].key).lines.length, 0);
});

test('cart: unknown / unavailable items and long notes are rejected', () => {
  assert.throws(() => addLine(emptyCart(), menu, { itemId: 'nope' }), (e) => e.code === 'UNKNOWN_ITEM');
  const m2 = applyOverrides(menu, { bread: { available: false } });
  assert.throws(() => addLine(emptyCart(), m2, { itemId: 'bread' }), (e) => e.code === 'UNAVAILABLE');
  assert.throws(() => addLine(emptyCart(), menu, { itemId: 'bread', note: 'x'.repeat(201) }), (e) => e.code === 'NOTE_TOO_LONG');
});

test('cart: price comes from the menu, so staff price overrides apply; availability change is reported', () => {
  let c = addLine(emptyCart(), menu, { itemId: 'tzatziki', qty: 2 });
  const m2 = applyOverrides(menu, { tzatziki: { price: 600 } });
  assert.equal(totals(m2, c).subtotal, 1200);
  const m3 = applyOverrides(menu, { tzatziki: { available: false } });
  assert.deepEqual(totals(m3, c).problems, ['UNAVAILABLE:tzatziki']);
});

test('money helpers', () => {
  assert.match(eur(850, 'en'), /8\.50/);
  assert.equal(toCents('8,50'), 850);
  assert.equal(toCents('12'), 1200);
  assert.ok(Number.isNaN(toCents('abc')));
  assert.ok(Number.isNaN(toCents('1.234')));
});
