// Order domain: creation, validation, status state machine, audit trail, optimistic concurrency.
// Mirrors what the production API must enforce server-side. DEMO: nothing here leaves the browser.
import { totals } from './cart.js';

/** @typedef {{street:string,number:string,area:string,postcode:string,floor?:string,bell?:string,notes?:string}} Address */
/** @typedef {'pending'|'confirmed'|'preparing'|'ready'|'collected'|'rejected'|'cancelled'} OrderStatus */
/** @typedef {'owner'|'staff'|'kitchen'} StaffRole */
/**
 * @typedef {{at:string,actor:string,from:OrderStatus|null,to:OrderStatus,reason?:string}} AuditEntry
 * @typedef {{
 *   id:string, idempotencyKey:string, status:OrderStatus, version:number, demo:true, simulated:boolean,
 *   customer:{name:string,phone:string}, pickup:{mode:'asap'|'slot'|'manual',requestedAt?:string,manualText?:string},
 *   fulfilment:{type:'takeaway'|'delivery',address?:Address}, payment:'cash'|'card', paid:false, lines:any[], subtotal:number, itemCount:number, createdAt:string, audit:AuditEntry[]
 * }} Order
 */

export const FULFILMENT_TYPES = ['takeaway', 'delivery'];
export const PAYMENT_METHODS = ['cash', 'card']; // LABELS ONLY: no online payment exists; card = POS terminal at handover

export const STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'collected', 'rejected', 'cancelled'];

/** Allowed transitions. Terminal states have none. */
export const TRANSITIONS = {
  pending: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['collected'],
  collected: [],
  rejected: [],
  cancelled: [],
};

export const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready'];

/** Which roles may trigger which target statuses (role gating, mirrored by server-side policy in production). */
export const ROLE_TRANSITIONS = {
  owner: STATUSES,
  staff: ['confirmed', 'rejected', 'preparing', 'ready', 'collected', 'cancelled'],
  kitchen: ['preparing', 'ready'],
};

export const ROLE_ACTIONS = {
  owner: ['orders', 'availability', 'prices', 'pause', 'prep_time', 'reports', 'simulate'],
  staff: ['orders', 'availability', 'pause', 'reports', 'simulate'],
  kitchen: ['orders', 'availability'],
};

export const can = (role, action) => !!ROLE_ACTIONS[role]?.includes(action);
export const canTransition = (role, to) => !!ROLE_TRANSITIONS[role]?.includes(to);

export class OrderError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) {
    super(message);
    this.name = 'OrderError';
    this.code = code;
  }
}

const PHONE_RE = /^(\+30|0030)?\s?(?:\d[\s-]?){10}$/;

/** Validate the customer block. Returns normalised {name, phone}. */
export function validateCustomer({ name, phone }) {
  const n = String(name ?? '').replace(/\s+/g, ' ').trim();
  const p = String(phone ?? '').trim();
  if (n.length < 2 || n.length > 80) throw new OrderError('BAD_NAME', 'Name must be 2-80 characters');
  if (!PHONE_RE.test(p)) throw new OrderError('BAD_PHONE', 'Enter a valid Greek phone number');
  return { name: n, phone: p };
}

const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

/** Validate fulfilment. Delivery needs a complete address; takeaway carries none. */
export function validateFulfilment(f = { type: 'takeaway' }) {
  if (!FULFILMENT_TYPES.includes(f.type)) throw new OrderError('BAD_FULFILMENT', 'Choose takeaway or delivery');
  if (f.type === 'takeaway') return { type: 'takeaway' };
  const a = f.address ?? {};
  const street = clip(a.street, 80), number = clip(a.number, 10), area = clip(a.area, 60);
  const postcode = String(a.postcode ?? '').replace(/\s/g, '');
  if (street.length < 3) throw new OrderError('BAD_ADDRESS_STREET', 'Enter the street');
  if (!number) throw new OrderError('BAD_ADDRESS_NUMBER', 'Enter the street number');
  if (area.length < 2) throw new OrderError('BAD_ADDRESS_AREA', 'Enter the area');
  if (!/^\d{5}$/.test(postcode)) throw new OrderError('BAD_ADDRESS_POSTCODE', 'Postcode must be 5 digits');
  return { type: 'delivery', address: { street, number, area, postcode, floor: clip(a.floor, 20), bell: clip(a.bell, 40), notes: clip(a.notes, 120) } };
}

function newId(now, seq) {
  const d = new Date(now);
  const pad = (x) => String(x).padStart(2, '0');
  return `DEMO-${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${String(seq).padStart(4, '0')}`;
}

/**
 * Build a new order. Prices are recomputed from `menu`; client totals are ignored.
 * @param {{menu:any,cart:any,customer:any,pickup:any,idempotencyKey:string,now:number|Date|string,seq:number,simulated?:boolean}} p
 * @returns {Order}
 */
export function createOrder({ menu, cart, customer, pickup, idempotencyKey, now, seq, simulated = false, fulfilment = { type: 'takeaway' }, payment = 'cash' }) {
  if (!idempotencyKey || String(idempotencyKey).length < 8) throw new OrderError('NO_IDEMPOTENCY_KEY', 'Missing idempotency key');
  if (!cart.lines.length) throw new OrderError('EMPTY_CART', 'Cart is empty');
  const t = totals(menu, cart);
  if (t.problems.length) throw new OrderError('CART_PROBLEMS', `Cart has problems: ${t.problems.join(', ')}`);
  const c = validateCustomer(customer);
  const pk = normalisePickup(pickup);
  const ful = validateFulfilment(fulfilment);
  if (!PAYMENT_METHODS.includes(payment)) throw new OrderError('BAD_PAYMENT', 'Choose cash or card');
  const at = new Date(now).toISOString();
  return {
    id: newId(now, seq),
    idempotencyKey,
    status: 'pending',
    version: 1,
    demo: true,
    simulated,
    customer: c,
    pickup: pk,
    fulfilment: ful,
    payment, // label only: 'card' means the card terminal at handover. No online payment exists.
    paid: false,
    lines: t.lines.map(({ itemId, optionIds, qty, note, name, unit, total }) => ({ itemId, optionIds, qty, note, name, unit, total })),
    subtotal: t.subtotal,
    itemCount: t.itemCount,
    createdAt: at,
    audit: [{ at, actor: simulated ? 'simulator' : 'customer', from: null, to: 'pending' }],
  };
}

function normalisePickup(p = {}) {
  if (p.mode === 'asap') return { mode: 'asap' };
  if (p.mode === 'slot') {
    if (!p.requestedAt || Number.isNaN(Date.parse(p.requestedAt))) throw new OrderError('BAD_PICKUP', 'Invalid pickup slot');
    return { mode: 'slot', requestedAt: new Date(p.requestedAt).toISOString() };
  }
  if (p.mode === 'manual') {
    const text = String(p.manualText ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    if (text.length < 2 || text.length > 120) throw new OrderError('BAD_PICKUP', 'Describe the pickup time you would like');
    return { mode: 'manual', manualText: text };
  }
  throw new OrderError('BAD_PICKUP', 'Choose how you want to set pickup time');
}

/**
 * Move an order to a new status, appending an audit entry.
 * `expectedVersion` makes concurrent edits (two staff devices) fail instead of silently overwriting.
 * @param {Order} order @param {OrderStatus} to @param {{actor:string,role:StaffRole,expectedVersion:number,reason?:string,now:number|Date|string}} ctx
 * @returns {Order}
 */
export function transition(order, to, { actor, role, expectedVersion, reason, now, etaMinutes }) {
  if (expectedVersion !== order.version) {
    throw new OrderError('STALE_VERSION', `Order changed (you saw v${expectedVersion}, now v${order.version}). Refresh and retry.`);
  }
  if (!STATUSES.includes(to)) throw new OrderError('BAD_STATUS', `Unknown status "${to}"`);
  if (!TRANSITIONS[order.status].includes(to)) {
    throw new OrderError('BAD_TRANSITION', `Cannot move ${order.status} -> ${to}`);
  }
  if (!canTransition(role, to)) throw new OrderError('FORBIDDEN', `Role "${role}" may not set status "${to}"`);
  if ((to === 'rejected' || to === 'cancelled') && !String(reason ?? '').trim()) {
    throw new OrderError('REASON_REQUIRED', 'A reason is required to reject or cancel');
  }
  let eta = {};
  if (etaMinutes !== undefined && etaMinutes !== null && etaMinutes !== '') {
    const n = Number(etaMinutes);
    if (!Number.isInteger(n) || n < 1 || n > 240) throw new OrderError('BAD_ETA', 'Time must be 1-240 minutes');
    // Per-order promise made by the venue when it accepts: minutes from now, plus the absolute time.
    eta = { etaMinutes: n, etaAt: new Date(new Date(now).getTime() + n * 60000).toISOString() };
  }
  return {
    ...order,
    ...eta,
    status: to,
    version: order.version + 1,
    audit: [...order.audit, { at: new Date(now).toISOString(), actor, from: order.status, to, ...(reason ? { reason: String(reason).trim() } : {}), ...(eta.etaMinutes ? { etaMinutes: eta.etaMinutes } : {}) }],
  };
}
