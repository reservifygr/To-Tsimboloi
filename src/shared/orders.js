// Order domain: creation, validation, status state machine, audit trail, optimistic concurrency.
// Mirrors what the production API must enforce server-side. DEMO: nothing here leaves the browser.
import { totals } from './cart.js';

/** @typedef {'pending'|'confirmed'|'preparing'|'ready'|'collected'|'rejected'|'cancelled'} OrderStatus */
/** @typedef {'owner'|'staff'|'kitchen'} StaffRole */
/**
 * @typedef {{at:string,actor:string,from:OrderStatus|null,to:OrderStatus,reason?:string}} AuditEntry
 * @typedef {{
 *   id:string, idempotencyKey:string, status:OrderStatus, version:number, demo:true, simulated:boolean,
 *   customer:{name:string,phone:string}, pickup:{mode:'asap'|'slot'|'manual',requestedAt?:string,manualText?:string},
 *   payment:'pay_at_pickup', lines:any[], subtotal:number, itemCount:number, createdAt:string, audit:AuditEntry[]
 * }} Order
 */

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
export function createOrder({ menu, cart, customer, pickup, idempotencyKey, now, seq, simulated = false }) {
  if (!idempotencyKey || String(idempotencyKey).length < 8) throw new OrderError('NO_IDEMPOTENCY_KEY', 'Missing idempotency key');
  if (!cart.lines.length) throw new OrderError('EMPTY_CART', 'Cart is empty');
  const t = totals(menu, cart);
  if (t.problems.length) throw new OrderError('CART_PROBLEMS', `Cart has problems: ${t.problems.join(', ')}`);
  const c = validateCustomer(customer);
  const pk = normalisePickup(pickup);
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
    payment: 'pay_at_pickup', // label only: no card payment is supported
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
export function transition(order, to, { actor, role, expectedVersion, reason, now }) {
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
  return {
    ...order,
    status: to,
    version: order.version + 1,
    audit: [...order.audit, { at: new Date(now).toISOString(), actor, from: order.status, to, ...(reason ? { reason: String(reason).trim() } : {}) }],
  };
}
