// Order transport adapters.
//   DemoAdapter       - persists to browser storage only. NOTHING is sent anywhere. This is what ships in the demo.
//   ProductionAdapter - deliberately inert placeholder: throws until a real, reviewed backend is wired in.
// The UI only talks to the `OrderAdapter` shape below, so swapping transports does not touch UI code.
import { applyOverrides, MENU } from './menu-data.js';
import { createOrder, transition, OrderError, ACTIVE_STATUSES } from './orders.js';

export const MODE = 'demo'; // 'demo' | 'production' - production is intentionally not implemented in this repo

const K = { orders: 'tsb.demo.orders.v1', settings: 'tsb.demo.settings.v1', seq: 'tsb.demo.seq.v1', log: 'tsb.demo.eventlog.v1', images: 'tsb.demo.images.v1' };
export const DEFAULT_SETTINGS = { paused: false, prepMinutes: 25, takeaway: true, delivery: true, overrides: {} };

/** Storage with an in-memory fallback (private mode / blocked storage / Node tests). */
export function createStorage(backing) {
  const mem = new Map();
  const safe = (fn, fb) => { try { return backing ? fn(backing) : fb(); } catch { return fb(); } };
  return {
    get: (k, def) => safe((b) => { const v = b.getItem(k); return v == null ? def : JSON.parse(v); }, () => (mem.has(k) ? JSON.parse(mem.get(k)) : def)),
    set: (k, v) => safe((b) => b.setItem(k, JSON.stringify(v)), () => mem.set(k, JSON.stringify(v))),
    remove: (k) => safe((b) => b.removeItem(k), () => mem.delete(k)),
  };
}

export class DemoAdapter {
  /** @param {ReturnType<typeof createStorage>} storage @param {()=>number} [clock] */
  constructor(storage, clock = () => Date.now()) {
    this.s = storage;
    this.clock = clock;
    this.mode = 'demo';
  }

  getSettings() { return { ...DEFAULT_SETTINGS, ...this.s.get(K.settings, {}) }; }
  saveSettings(patch) { const next = { ...this.getSettings(), ...patch }; this.s.set(K.settings, next); this.#log('settings_changed', patch); return next; }
  getMenu() { return applyOverrides(MENU, this.getSettings().overrides); }
  setOverride(itemId, patch) {
    const cur = this.getSettings();
    this.saveSettings({ overrides: { ...cur.overrides, [itemId]: { ...(cur.overrides[itemId] ?? {}), ...patch } } });
  }
  /** Admin-uploaded images (data URIs, already downscaled by the client). key = 'item:<id>' | 'event:<id>' | 'post:<id>' | 'site:<slot>' */
  getImages() { return this.s.get(K.images, {}); }
  setImage(key, dataUri) {
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(String(dataUri)) || dataUri.length > 400000) throw new OrderError('BAD_IMAGE', 'Image must be a JPEG/PNG/WebP under ~300 KB');
    this.s.set(K.images, { ...this.getImages(), [key]: dataUri }); this.#log('image_set', { key });
  }
  removeImage(key) { const { [key]: _gone, ...rest } = this.getImages(); this.s.set(K.images, rest); this.#log('image_removed', { key }); }
  listOrders() { return this.s.get(K.orders, []); }
  getOrder(id) { return this.listOrders().find((o) => o.id === id); }

  /**
   * Idempotent: the same idempotencyKey always returns the same order and never creates a second one.
   * @returns {{order:any, duplicate:boolean}}
   */
  submitOrder({ cart, customer, pickup, idempotencyKey, simulated = false, fulfilment = { type: 'takeaway' }, payment = 'cash' }) {
    const settings = this.getSettings();
    if (settings.paused && !simulated) throw new OrderError('ORDERING_PAUSED', 'Online ordering is paused right now');
    if (!simulated && fulfilment?.type === 'takeaway' && settings.takeaway === false) throw new OrderError('TAKEAWAY_DISABLED', 'Takeaway is switched off right now');
    if (!simulated && fulfilment?.type === 'delivery' && settings.delivery === false) throw new OrderError('DELIVERY_DISABLED', 'Delivery is switched off right now');
    const orders = this.listOrders();
    const dup = orders.find((o) => o.idempotencyKey === idempotencyKey);
    if (dup) return { order: dup, duplicate: true };
    const seq = this.s.get(K.seq, 0) + 1;
    const order = createOrder({ menu: this.getMenu(), cart, customer, pickup, idempotencyKey, now: this.clock(), seq, simulated, fulfilment, payment });
    this.s.set(K.seq, seq);
    this.s.set(K.orders, [order, ...orders]);
    this.#log('order_created', { id: order.id, simulated });
    return { order, duplicate: false };
  }

  /** Optimistic-concurrency status change; throws OrderError(STALE_VERSION|BAD_TRANSITION|FORBIDDEN...). */
  changeStatus(id, to, { actor, role, expectedVersion, reason }) {
    const orders = this.listOrders();
    const idx = orders.findIndex((o) => o.id === id);
    if (idx < 0) throw new OrderError('NOT_FOUND', `Order ${id} not found`);
    const updated = transition(orders[idx], to, { actor, role, expectedVersion, reason, now: this.clock() });
    const next = orders.slice();
    next[idx] = updated;
    this.s.set(K.orders, next);
    this.#log('status_changed', { id, to, actor });
    return updated;
  }

  activeOrders() { return this.listOrders().filter((o) => ACTIVE_STATUSES.includes(o.status)); }
  resetDemo() { [K.orders, K.settings, K.seq, K.log, K.images].forEach((k) => this.s.remove(k)); }
  eventLog() { return this.s.get(K.log, []); }
  #log(type, data) {
    const log = this.s.get(K.log, []);
    log.unshift({ at: new Date(this.clock()).toISOString(), type, data });
    this.s.set(K.log, log.slice(0, 200));
  }
}

/** Placeholder for the future real backend (Supabase/Postgres + server-side validation). Intentionally inert. */
export class ProductionAdapter {
  constructor() { this.mode = 'production'; }
  #off() { throw new Error('PRODUCTION_TRANSPORT_DISABLED: no real order backend is connected in this demo. See README "Production roadmap".'); }
  submitOrder() { this.#off(); }
  changeStatus() { this.#off(); }
  listOrders() { this.#off(); }
}

export function createAdapter(mode, deps) {
  if (mode === 'demo') return new DemoAdapter(deps.storage, deps.clock);
  return new ProductionAdapter();
}
