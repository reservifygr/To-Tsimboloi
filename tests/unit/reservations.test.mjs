import test from 'node:test';
import assert from 'node:assert/strict';
import { availability, createReservation, transitionReservation, slotTimes, mergeSettings, isClosed, toMin } from '../../src/shared/reservations.js';
import { DemoAdapter, createStorage } from '../../src/shared/adapter.js';

// Friday 2026-11-13 12:00 Athens = 10:00Z. Venue opens Fri 17:00.
const NOW = Date.parse('2026-11-13T10:00:00Z');
const FRI = '2026-11-13'; const SAT = '2026-11-14'; const MON = '2026-11-16';
const base = { name: 'Maria P', phone: '694 123 4567', partySize: 4, date: SAT, time: '20:00', consent: true };
const mk = (over = {}, ctx = {}) => createReservation({ ...base, ...over }, { settings: {}, reservations: [], now: NOW, seq: 1, ...ctx });

test('slots follow the weekly hours; closed days have none', () => {
  const s = mergeSettings({});
  assert.deepEqual(slotTimes(MON, s), []);
  assert.equal(slotTimes(FRI, s)[0], '17:00');
  assert.equal(slotTimes(FRI, s).at(-1), '22:30');
  assert.equal(isClosed(MON, {}), true);
  assert.equal(isClosed(FRI, { closedDates: [FRI] }), true);
});

test('lead time blocks near slots, allows later ones', () => {
  const a = availability({ date: FRI, partySize: 2, settings: { leadMinutes: 360 }, reservations: [], now: NOW }); // 12:00 + 6h = 18:00
  assert.equal(a.find((x) => x.time === '17:30').reason, 'notice');
  assert.equal(a.find((x) => x.time === '18:00').available, true);
});

test('reservation is pending by default, confirmed with autoConfirm', () => {
  assert.equal(mk().status, 'pending');
  assert.equal(mk({}, { settings: { autoConfirm: true } }).status, 'confirmed');
  assert.equal(mk().id, 'DEMO-RES-0001');
});

test('capacity: overlapping bookings fill the room, later ones are free again', () => {
  const settings = { maxCapacity: 10, maxCoversPerSlot: 99 };
  const r1 = mk({ partySize: 6, time: '20:00' }, { settings });
  assert.throws(() => mk({ partySize: 6, time: '20:30' }, { settings, reservations: [r1], seq: 2 }), /no longer available/);
  assert.doesNotThrow(() => mk({ partySize: 4, time: '20:30' }, { settings, reservations: [r1], seq: 2 }));
  // 20:00 + 90 + 15 buffer = 21:45 -> 21:45 is not on a 30-min grid, 22:00 is free
  assert.doesNotThrow(() => mk({ partySize: 10, time: '22:00' }, { settings, reservations: [r1], seq: 2 }));
});

test('a booking that would run into a fuller later booking is refused', () => {
  const settings = { maxCapacity: 10, maxCoversPerSlot: 99 };
  const late = mk({ partySize: 8, time: '21:00' }, { settings });
  assert.throws(() => mk({ partySize: 4, time: '20:00' }, { settings, reservations: [late], seq: 2 }));
});

test('pacing limits guests arriving in one slot', () => {
  const settings = { maxCapacity: 100, maxCoversPerSlot: 8 };
  const r1 = mk({ partySize: 6 }, { settings });
  assert.throws(() => mk({ partySize: 4 }, { settings, reservations: [r1], seq: 2 }));
});

test('declined/cancelled bookings release their seats; pending holds them only when configured', () => {
  const settings = { maxCapacity: 6, maxCoversPerSlot: 99 };
  const r = mk({ partySize: 6 }, { settings });
  assert.throws(() => mk({ partySize: 2 }, { settings, reservations: [r], seq: 2 }));
  const gone = transitionReservation(r, 'cancelled', { actor: 'staff', now: NOW });
  assert.doesNotThrow(() => mk({ partySize: 2 }, { settings, reservations: [gone], seq: 2 }));
  assert.doesNotThrow(() => mk({ partySize: 2 }, { settings: { ...settings, countPending: false }, reservations: [r], seq: 2 }));
});

test('validation: size limit, closed day, past, far future, consent, phone', () => {
  assert.throws(() => mk({ partySize: 11 }), (e) => e.code === 'PARTY_TOO_LARGE');
  assert.throws(() => mk({ date: MON, time: '20:00' }), (e) => e.code === 'SLOT_UNAVAILABLE');
  assert.throws(() => mk({ date: '2026-11-12', time: '20:00' }), (e) => e.code === 'SLOT_UNAVAILABLE');
  assert.throws(() => mk({ date: '2027-03-06', time: '20:00' }), (e) => e.code === 'SLOT_UNAVAILABLE');
  assert.throws(() => mk({ consent: false }), (e) => e.code === 'NO_CONSENT');
  assert.throws(() => mk({ phone: '123' }), (e) => e.code === 'BAD_PHONE');
  assert.throws(() => mk({ time: '20:10' }), (e) => e.code === 'SLOT_UNAVAILABLE');
  assert.throws(() => mk({}, { settings: { enabled: false } }), (e) => e.code === 'RES_DISABLED');
});

test('lifecycle and optimistic locking', () => {
  const r = mk();
  const c = transitionReservation(r, 'confirmed', { actor: 'staff', expectedVersion: 1, now: NOW });
  assert.equal(c.version, 2); assert.equal(c.history.length, 2);
  assert.throws(() => transitionReservation(c, 'completed', { actor: 'staff', now: NOW }), (e) => e.code === 'BAD_TRANSITION');
  assert.throws(() => transitionReservation(c, 'seated', { actor: 'staff', expectedVersion: 1, now: NOW }), (e) => e.code === 'STALE_VERSION');
  const done = transitionReservation(transitionReservation(c, 'seated', { actor: 'staff', now: NOW }), 'completed', { actor: 'staff', now: NOW });
  assert.equal(done.status, 'completed');
});

test('adapter: submit is idempotent, settings persist, lookup needs reference + phone', () => {
  const a = new DemoAdapter(createStorage(null), () => NOW);
  const r1 = a.submitReservation({ ...base, idempotencyKey: 'k1' });
  const r2 = a.submitReservation({ ...base, idempotencyKey: 'k1' });
  assert.equal(r2.duplicate, true); assert.equal(a.listReservations().length, 1);
  assert.ok(a.findReservation(r1.reservation.id.toLowerCase(), '6941234567'));
  assert.equal(a.findReservation(r1.reservation.id, '6999999999'), null);
  a.saveReservationSettings({ maxCapacity: 40, durationMinutes: 120 });
  assert.equal(a.getReservationSettings().maxCapacity, 40);
  assert.equal(a.getReservationSettings().slotMinutes, 30);
  a.changeReservation(r1.reservation.id, 'confirmed', { actor: 'staff' });
  assert.equal(a.getReservation(r1.reservation.id).status, 'confirmed');
  a.resetDemo(); assert.equal(a.listReservations().length, 0);
  assert.ok(toMin('01:30') === 90);
});

test('10+ guests: call-only by default, request mode is pending and never auto-confirmed, staff can always book', () => {
  assert.throws(() => mk({ partySize: 14 }), (e) => e.code === 'PARTY_TOO_LARGE');
  const settings = { largePartyMode: 'request', maxLargeParty: 30, autoConfirm: true, maxCapacity: 20 };
  const r = mk({ partySize: 25 }, { settings });
  assert.equal(r.status, 'pending'); assert.equal(r.large, true);
  assert.throws(() => mk({ partySize: 31 }, { settings }), (e) => e.code === 'PARTY_TOO_LARGE');
  const st = mk({ partySize: 45, consent: false, time: '20:10' }, { settings, staff: true });
  assert.equal(st.status, 'confirmed'); assert.equal(st.source, 'staff');
});
