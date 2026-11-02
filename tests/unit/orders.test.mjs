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

test('order: created server-side style, totals recomputed, demo flagged, pay-at-pickup label only', () => {
  const o = mk();
  assert.equal(o.status, 'pending');
  assert.equal(o.version, 1);
  assert.equal(o.demo, true);
  assert.equal(o.payment, 'pay_at_pickup');
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
