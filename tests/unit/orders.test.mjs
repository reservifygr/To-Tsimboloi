import test from 'node:test';
import assert from 'node:assert/strict';
import { MENU } from '../../src/shared/menu-data.js';
import { emptyCart, addLine } from '../../src/shared/cart.js';
import { createOrder, transition, OrderError, can, canTransition } from '../../src/shared/orders.js';
import { DemoAdapter, ProductionAdapter, createStorage, createAdapter } from '../../src/shared/adapter.js';
import { pickupMode, HOURS } from '../../src/shared/hours.js';
import { validateCoupon } from '../../src/shared/content-data.js';

const NOW = Date.parse('2026-11-04T16:30:00Z'); // Wednesday 18:30 Athens
const cart = () => addLine(addLine(emptyCart(), MENU, { itemId: 'tzatziki', qty: 2 }), MENU, { itemId: 'meat-platter', optionIds: ['p4'] });
const customer = { name: 'Maria P.', phone: '+30 694 123 4567' };
const pickup = { mode: 'manual', manualText: 'around 20:30' };
const mk = (over = {}) => createOrder({ menu: MENU, cart: cart(), customer, pickup, idempotencyKey: 'key-0001-abcd', now: NOW, seq: 1, ...over });
const fresh = () => new DemoAdapter(createStorage(null), () => NOW);

test('order: created server-side style, totals recomputed, demo flagged, cash/card labels only', () => {
  const o = mk();
  assert.equal(o.status, 'pending');
  assert.equal(o.version, 1);
  assert.equal(o.demo, true);
  assert.equal(o.payment, 'cash');
  assert.equal(o.paid, false);
  assert.deepEqual(o.fulfilment, { type: 'takeaway' });
  assert.equal(o.subtotal, 2 * 500 + 3900);
  assert.match(o.id, /^DEMO-/);
  assert.equal(o.audit.length, 1);
});

test('order: customer + pickup + cart validation', () => {
  assert.throws(() => mk({ customer: { name: 'A', phone: '+30 694 123 4567' } }), (e) => e.code === 'BAD_NAME');
  assert.throws(() => mk({ customer: { name: 'Maria', phone: '123' } }), (e) => e.code === 'BAD_PHONE');
  assert.throws(() => mk({ cart: emptyCart() }), (e) => e.code === 'EMPTY_CART');
  assert.throws(() => mk({ pickup: { mode: 'manual', manualText: '' } }), (e) => e.code === 'BAD_PICKUP');
  assert.throws(() => mk({ pickup: { mode: 'slot', requestedAt: 'nope' } }), (e) => e.code === 'BAD_PICKUP');
  assert.throws(() => mk({ idempotencyKey: '' }), (e) => e.code === 'NO_IDEMPOTENCY_KEY');
});

test('order states: legal path pending -> confirmed -> preparing -> ready -> collected, audited', () => {
  let o = mk();
  const step = (to, role = 'staff') => { o = transition(o, to, { actor: 'tester', role, expectedVersion: o.version, now: NOW + 1000 }); };
  step('confirmed'); step('preparing'); step('ready'); step('collected');
  assert.equal(o.status, 'collected');
  assert.equal(o.version, 5);
  assert.deepEqual(o.audit.map((a) => a.to), ['pending', 'confirmed', 'preparing', 'ready', 'collected']);
  assert.equal(o.audit[1].from, 'pending');
});

test('order states: illegal transitions, terminal states, reasons and roles', () => {
  const o = mk();
  const ctx = (role, extra = {}) => ({ actor: 't', role, expectedVersion: o.version, now: NOW, ...extra });
  assert.throws(() => transition(o, 'ready', ctx('owner')), (e) => e.code === 'BAD_TRANSITION');
  assert.throws(() => transition(o, 'rejected', ctx('staff')), (e) => e.code === 'REASON_REQUIRED');
  const rej = transition(o, 'rejected', ctx('staff', { reason: 'Out of stock' }));
  assert.equal(rej.audit.at(-1).reason, 'Out of stock');
  assert.throws(() => transition(rej, 'confirmed', { actor: 't', role: 'owner', expectedVersion: rej.version, now: NOW }), (e) => e.code === 'BAD_TRANSITION');
  assert.throws(() => transition(o, 'confirmed', ctx('kitchen')), (e) => e.code === 'FORBIDDEN');
  assert.throws(() => transition(o, 'wat', ctx('owner')), (e) => e.code === 'BAD_STATUS');
});

test('roles: kitchen is limited; only owner edits prices', () => {
  assert.ok(canTransition('kitchen', 'ready'));
  assert.ok(!canTransition('kitchen', 'collected'));
  assert.ok(can('owner', 'prices'));
  assert.ok(!can('staff', 'prices'));
  assert.ok(!can('kitchen', 'pause'));
});

test('race: two devices acting on the same version - second one fails', () => {
  const a = fresh();
  const { order } = a.submitOrder({ cart: cart(), customer, pickup, idempotencyKey: 'key-race-0001' });
  a.changeStatus(order.id, 'confirmed', { actor: 'device-A', role: 'staff', expectedVersion: 1 });
  assert.throws(() => a.changeStatus(order.id, 'rejected', { actor: 'device-B', role: 'staff', expectedVersion: 1, reason: 'x' }), (e) => e.code === 'STALE_VERSION');
  assert.equal(a.getOrder(order.id).status, 'confirmed');
});

test('no duplicate orders: same idempotency key returns the same order, only one stored', () => {
  const a = fresh();
  const r1 = a.submitOrder({ cart: cart(), customer, pickup, idempotencyKey: 'key-dup-00001' });
  const r2 = a.submitOrder({ cart: cart(), customer, pickup, idempotencyKey: 'key-dup-00001' });
  assert.equal(r1.duplicate, false);
  assert.equal(r2.duplicate, true);
  assert.equal(r1.order.id, r2.order.id);
  assert.equal(a.listOrders().length, 1);
  const r3 = a.submitOrder({ cart: cart(), customer, pickup, idempotencyKey: 'key-dup-00002' });
  assert.notEqual(r3.order.id, r1.order.id);
  assert.equal(a.listOrders().length, 2);
});

test('staff controls: pause blocks customers, price + availability overrides apply to new orders', () => {
  const a = fresh();
  a.saveSettings({ paused: true });
  assert.throws(() => a.submitOrder({ cart: cart(), customer, pickup, idempotencyKey: 'key-pause-001' }), (e) => e.code === 'ORDERING_PAUSED');
  a.saveSettings({ paused: false });
  a.setOverride('tzatziki', { price: 600 });
  const { order } = a.submitOrder({ cart: cart(), customer, pickup, idempotencyKey: 'key-price-001' });
  assert.equal(order.lines.find((l) => l.itemId === 'tzatziki').unit, 600);
  a.setOverride('tzatziki', { available: false });
  assert.throws(() => a.submitOrder({ cart: cart(), customer, pickup, idempotencyKey: 'key-unavail-01' }), (e) => e instanceof OrderError && e.code === 'CART_PROBLEMS');
});

test('production adapter is inert; mode switch works', () => {
  const p = createAdapter('production', {});
  assert.ok(p instanceof ProductionAdapter);
  assert.throws(() => p.submitOrder(), /PRODUCTION_TRANSPORT_DISABLED/);
  assert.ok(createAdapter('demo', { storage: createStorage(null) }) instanceof DemoAdapter);
});

test('hours: unverified hours force manual pickup request; verified fixture yields slots; closed handled', () => {
  const settings = { prepMinutes: 25, paused: false };
  assert.deepEqual(pickupMode(new Date(NOW), settings), { mode: 'manual', reason: 'hours_unverified' });
  const verified = { ...HOURS, verified: true, weekly: { ...HOURS.weekly, 3: { opens: [17, 0], closes: [23, 0] } } };
  const r = pickupMode(new Date(NOW), settings, verified); // Wed 18:30 Athens
  assert.equal(r.mode, 'slots');
  assert.ok(r.slots.length > 5);
  const firstMinutes = new Date(r.slots[0]).getTime() - NOW;
  assert.ok(firstMinutes >= 25 * 60000, 'respects prep time');
  assert.ok(new Date(r.slots[0]).getTime() % (15 * 60000) === 0, 'slots on 15-minute marks');
  const monday = Date.parse('2026-11-02T16:30:00Z');
  assert.deepEqual(pickupMode(new Date(monday), settings, verified), { mode: 'manual', reason: 'closed' });
  const late = Date.parse('2026-11-04T21:30:00Z'); // 23:30 Athens, after close
  assert.deepEqual(pickupMode(new Date(late), settings, verified), { mode: 'manual', reason: 'closed' });
  assert.equal(pickupMode(new Date(NOW), { ...settings, paused: true }, verified).mode, 'paused');
});

test('coupons: concept coupons never validate', () => {
  assert.deepEqual(validateCoupon('student-concept'), { ok: false, reason: 'not_active' });
  assert.deepEqual(validateCoupon('whatever'), { ok: false, reason: 'unknown' });
});

const addr = { street: 'Agiou Ioannou', number: '12', area: 'Agia Paraskevi', postcode: '153 42', floor: '3', bell: 'Papadakis' };

test('delivery: complete address required, normalised; takeaway carries none; payment limited to cash/card labels', () => {
  const o = mk({ fulfilment: { type: 'delivery', address: addr }, payment: 'card' });
  assert.equal(o.fulfilment.type, 'delivery');
  assert.equal(o.fulfilment.address.postcode, '15342');
  assert.equal(o.payment, 'card');
  assert.equal(o.paid, false, 'nothing is ever charged online');
  const code = (over) => { try { mk({ fulfilment: { type: 'delivery', address: { ...addr, ...over } } }); return 'none'; } catch (e) { return e.code; } };
  assert.equal(code({ street: '' }), 'BAD_ADDRESS_STREET');
  assert.equal(code({ number: '' }), 'BAD_ADDRESS_NUMBER');
  assert.equal(code({ area: '' }), 'BAD_ADDRESS_AREA');
  assert.equal(code({ postcode: '12' }), 'BAD_ADDRESS_POSTCODE');
  assert.throws(() => mk({ fulfilment: { type: 'drone' } }), (e) => e.code === 'BAD_FULFILMENT');
  assert.throws(() => mk({ payment: 'bitcoin' }), (e) => e.code === 'BAD_PAYMENT');
  assert.equal(mk({ fulfilment: { type: 'takeaway', address: addr } }).fulfilment.address, undefined);
});

test('delivery/takeaway can be switched off separately by staff; image store validates uploads', () => {
  const a = fresh();
  const base = { cart: cart(), customer, pickup };
  a.saveSettings({ delivery: false });
  assert.throws(() => a.submitOrder({ ...base, idempotencyKey: 'key-deliv-001', fulfilment: { type: 'delivery', address: addr } }), (e) => e.code === 'DELIVERY_DISABLED');
  assert.ok(a.submitOrder({ ...base, idempotencyKey: 'key-take-0001' }).order);
  a.saveSettings({ delivery: true, takeaway: false });
  assert.throws(() => a.submitOrder({ ...base, idempotencyKey: 'key-take-0002' }), (e) => e.code === 'TAKEAWAY_DISABLED');
  assert.throws(() => a.setImage('item:bread', 'javascript:alert(1)'), (e) => e.code === 'BAD_IMAGE');
  assert.throws(() => a.setImage('item:bread', 'data:image/svg+xml;base64,AAAA'), (e) => e.code === 'BAD_IMAGE');
  a.setImage('item:bread', 'data:image/jpeg;base64,/9j/AAAA');
  assert.deepEqual(Object.keys(a.getImages()), ['item:bread']);
  a.removeImage('item:bread');
  assert.deepEqual(a.getImages(), {});
});

test('order: each order gets its own time when accepted; bad times are refused; rejection needs a reason', () => {
  const o = mk();
  const ctx = { actor: 'staff', role: 'staff', expectedVersion: 1, now: NOW };
  const a = transition(o, 'confirmed', { ...ctx, etaMinutes: 35 });
  assert.equal(a.etaMinutes, 35);
  assert.equal(a.etaAt, new Date(NOW + 35 * 60000).toISOString());
  assert.equal(a.audit.at(-1).etaMinutes, 35);
  const b = transition(mk(), 'confirmed', { ...ctx, etaMinutes: 20 });
  assert.notEqual(a.etaMinutes, b.etaMinutes);
  for (const bad of [0, -5, 241, 12.5, 'soon']) assert.throws(() => transition(mk(), 'confirmed', { ...ctx, etaMinutes: bad }), (e) => e.code === 'BAD_ETA');
  assert.throws(() => transition(mk(), 'rejected', ctx), (e) => e.code === 'REASON_REQUIRED');
});

test('adapter: accept stores the time; saved customers are keyed by phone, validated, replaceable and deletable', () => {
  const ad = fresh();
  const { order } = ad.submitOrder({ cart: cart(), customer, pickup, idempotencyKey: 'key-0002-abcd' });
  const upd = ad.changeStatus(order.id, 'confirmed', { actor: 'staff', role: 'staff', expectedVersion: 1, etaMinutes: 45 });
  assert.equal(ad.getOrder(order.id).etaMinutes, 45);
  assert.equal(upd.status, 'confirmed');
  assert.throws(() => ad.saveCustomer({ name: '', phone: '6941234567' }), (e) => e.code === 'BAD_CUSTOMER');
  assert.throws(() => ad.saveCustomer({ name: 'A', phone: '123' }), (e) => e.code === 'BAD_CUSTOMER');
  const addr = { street: 'Agiou Ioannou', number: '71', area: 'Agia Paraskevi', postcode: '15342' };
  ad.saveCustomer({ name: 'Maria P.', phone: '+30 694 123 4567', address: addr, notes: 'rings twice' });
  ad.saveCustomer({ name: 'Maria Papa', phone: '+306941234567', address: addr });
  assert.equal(ad.listCustomers().length, 1);
  assert.equal(ad.listCustomers()[0].name, 'Maria Papa');
  ad.deleteCustomer('+306941234567');
  assert.equal(ad.listCustomers().length, 0);
});
