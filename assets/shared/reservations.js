// Table reservations: pure domain logic (no DOM, no storage), shared by the site, the admin and the tests.
// DEMO: reservations live in the browser only. Every number below is a PLACEHOLDER until the owner confirms it:
// capacity, party-size limit, table turn time, buffer, pacing, opening and last-seating times. They are all plain
// settings (editable in Admin > Reservations), so confirming them is a settings change, not a code change.
// Times are venue-local wall-clock strings ('YYYY-MM-DD', 'HH:MM'); only "now" is converted from an instant.
import { OrderError, validateCustomer } from './orders.js?v=mwg3bo34';
import { athensParts } from './hours.js?v=mwg3bo34';

export const RES_STATUSES = ['pending', 'confirmed', 'seated', 'completed', 'declined', 'cancelled', 'no_show'];
/** Statuses that occupy seats ('pending' only when settings.countPending). */
export const RES_ACTIVE = ['pending', 'confirmed', 'seated'];
export const RES_TRANSITIONS = {
  pending: ['confirmed', 'declined', 'cancelled'],
  confirmed: ['seated', 'cancelled', 'no_show'],
  seated: ['completed'],
  completed: [], declined: [], cancelled: [], no_show: [],
};

/** Weekly service times: weekday 0=Sun..6=Sat -> {opens,lastSeating} ('HH:MM') or null when closed. */
export const DEFAULT_RES_HOURS = {
  0: { opens: '13:00', lastSeating: '17:30' }, 1: null, 2: null,
  3: { opens: '17:00', lastSeating: '22:00' }, 4: { opens: '17:00', lastSeating: '22:00' },
  5: { opens: '17:00', lastSeating: '22:30' }, 6: { opens: '13:00', lastSeating: '22:30' },
};

export const RES_DEFAULTS = {
  enabled: true,
  verified: false,           // set to true once the owner has confirmed the numbers below
  maxCapacity: 60,           // seats that can be occupied at the same moment
  maxPartySize: 10,          // largest group that books a table online automatically
  largePartyMode: 'call',    // above that: 'call' = ask them to phone us, 'request' = take a request the venue approves personally
  maxLargeParty: 40,         // biggest group accepted as a request when largePartyMode is 'request'
  slotMinutes: 30,           // spacing of the bookable times
  durationMinutes: 90,       // how long a table is held for one booking
  bufferMinutes: 15,         // reset time after every booking
  maxCoversPerSlot: 24,      // pacing: most guests that may ARRIVE in the same slot
  leadMinutes: 120,          // shortest notice for online bookings
  maxAdvanceDays: 45,        // how far ahead guests can book
  autoConfirm: false,        // false = the venue approves each request; true = confirmed on the spot when there is room
  countPending: true,        // requests waiting for approval already hold their seats
  hours: DEFAULT_RES_HOURS,
  closedDates: [],           // ['YYYY-MM-DD', ...] full-day closures (holidays, private events)
};

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
export const fromMin = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const weekdayOf = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
export const addDays = (date, n) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const pad = (n) => String(n).padStart(2, '0');

/** Venue-local "now": { date:'YYYY-MM-DD', min:minutes since midnight }. */
export function localNow(now = Date.now()) {
  const p = athensParts(new Date(now));
  return { date: `${p.y}-${pad(p.m)}-${pad(p.d)}`, min: p.h * 60 + p.min };
}

export const mergeSettings = (saved) => ({ ...RES_DEFAULTS, ...(saved ?? {}), hours: { ...RES_DEFAULTS.hours, ...(saved?.hours ?? {}) } });

/** Bookable start times for a date from the weekly hours (ignores capacity and notice). */
export function slotTimes(date, s) {
  if (!DATE_RE.test(date) || s.closedDates.includes(date)) return [];
  const h = s.hours[weekdayOf(date)];
  if (!h) return [];
  const out = [];
  for (let m = toMin(h.opens); m <= toMin(h.lastSeating); m += s.slotMinutes) out.push(fromMin(m));
  return out;
}

const holds = (r, s) => r.status === 'seated' || r.status === 'confirmed' || (r.status === 'pending' && s.countPending);

/** Seats in use at minute `at` of `date`. */
export function seatsAt(reservations, date, at, s) {
  let n = 0;
  for (const r of reservations) {
    if (r.date !== date || !holds(r, s)) continue;
    const start = toMin(r.time);
    if (at >= start && at < start + s.durationMinutes + s.bufferMinutes) n += r.partySize;
  }
  return n;
}

/** Why a slot cannot be booked, or null when it can. */
export function slotProblem({ date, time, partySize, settings: s, reservations, now = Date.now(), large = false }) {
  const ln = localNow(now);
  const start = toMin(time);
  if (date < ln.date || (date === ln.date && start < ln.min + s.leadMinutes)) return 'notice';
  if (date > addDays(ln.date, s.maxAdvanceDays)) return 'too_far';
  if (large) return null; // big groups are approved by a person, so they are not limited by the automatic seat count
  const block = s.durationMinutes + s.bufferMinutes;
  // peak occupancy over the booking's window: check its start and every other booking's start inside it
  const points = [start, ...reservations.filter((r) => r.date === date && holds(r, s)).map((r) => toMin(r.time)).filter((m) => m > start && m < start + block)];
  if (points.some((m) => seatsAt(reservations, date, m, s) + partySize > s.maxCapacity)) return 'full';
  const arriving = reservations.filter((r) => r.date === date && r.time === time && holds(r, s)).reduce((a, r) => a + r.partySize, 0);
  if (arriving + partySize > s.maxCoversPerSlot) return 'busy';
  return null;
}

/** All slots of a date with availability for a party. @returns {{time:string, available:boolean, reason:string|null}[]} */
export function availability({ date, partySize, settings, reservations, now = Date.now() }) {
  const s = mergeSettings(settings);
  return slotTimes(date, s).map((time) => {
    const reason = slotProblem({ date, time, partySize, settings: s, reservations, now, large: partySize > s.maxPartySize });
    return { time, available: !reason, reason };
  });
}

/** Is the whole date closed (weekly hours or a closure)? */
export const isClosed = (date, settings) => slotTimes(date, mergeSettings(settings)).length === 0;

/** @returns {object} a new reservation (status pending, or confirmed when autoConfirm) */
export function createReservation(input, { settings, reservations, now = Date.now(), seq = 1, staff = false }) {
  const s = mergeSettings(settings);
  if (!s.enabled) throw new OrderError('RES_DISABLED', 'Online bookings are switched off right now');
  const { name, phone } = validateCustomer({ name: input.name, phone: input.phone });
  const email = clean(input.email, 120);
  if (email && !EMAIL_RE.test(email)) throw new OrderError('BAD_EMAIL', 'Invalid email');
  const partySize = Number(input.partySize);
  if (!Number.isInteger(partySize) || partySize < 1) throw new OrderError('BAD_SIZE', 'Choose the number of guests');
  const large = partySize > s.maxPartySize;
  if (large && !staff && (s.largePartyMode !== 'request' || partySize > s.maxLargeParty)) throw new OrderError('PARTY_TOO_LARGE', `For more than ${s.maxPartySize} guests please call us`);
  const date = clean(input.date, 10); const time = clean(input.time, 5);
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date)) || !TIME_RE.test(time)) throw new OrderError('BAD_DATE', 'Pick a date and a time');
  if (!staff) {
    if (!slotTimes(date, s).includes(time)) throw new OrderError('SLOT_UNAVAILABLE', 'That time is not available');
    const problem = slotProblem({ date, time, partySize, settings: s, reservations, now, large });
    if (problem) throw new OrderError('SLOT_UNAVAILABLE', `That time is no longer available (${problem})`);
  }
  if (!staff && input.consent !== true) throw new OrderError('NO_CONSENT', 'Consent is required');
  const at = new Date(now).toISOString();
  const status = staff || (s.autoConfirm && !large) ? 'confirmed' : 'pending';
  return {
    id: `DEMO-RES-${String(seq).padStart(4, '0')}`, status, version: 1, demo: true,
    source: staff ? 'staff' : 'online', ...(large ? { large: true } : {}),
    name, phone, ...(email ? { email } : {}), partySize, date, time,
    occasion: clean(input.occasion, 40), notes: clean(input.notes, 300),
    idempotencyKey: clean(input.idempotencyKey, 80) || null, createdAt: at, updatedAt: at,
    history: [{ at, to: status, actor: staff ? 'staff' : s.autoConfirm && !large ? 'system' : 'customer', reason: null }],
  };
}

/** Optimistic-concurrency status change. */
export function transitionReservation(r, to, { actor, expectedVersion, reason, now = Date.now() }) {
  if (expectedVersion != null && expectedVersion !== r.version) throw new OrderError('STALE_VERSION', 'This booking was changed by someone else. Reloaded.');
  if (!RES_TRANSITIONS[r.status]?.includes(to)) throw new OrderError('BAD_TRANSITION', `Cannot change ${r.status} to ${to}`);
  const at = new Date(now).toISOString();
  return { ...r, status: to, version: r.version + 1, updatedAt: at, history: [...r.history, { at, to, actor: actor ?? 'staff', reason: reason ?? null }] };
}
