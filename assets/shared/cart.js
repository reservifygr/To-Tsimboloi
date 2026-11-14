// Pure, immutable cart logic. Prices are always recomputed from the menu (never trusted from the client):
// this mirrors what the server-authoritative production endpoint must do.
import { findItem } from './menu-data.js?v=mwg3bo34';

export const MAX_QTY_PER_LINE = 20;
export const MAX_LINES = 40;
export const MAX_NOTE_LENGTH = 200;

export class CartError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) {
    super(message);
    this.name = 'CartError';
    this.code = code;
  }
}

/** @typedef {{key:string,itemId:string,optionIds:string[],qty:number,note:string}} CartLine */
/** @typedef {{lines:CartLine[]}} Cart */

/** @returns {Cart} */
export const emptyCart = () => ({ lines: [] });

export function lineKey(itemId, optionIds = [], note = '') {
  return `${itemId}|${[...optionIds].sort().join(',')}|${note.trim().toLowerCase()}`;
}

function cleanNote(note) {
  const n = String(note ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (n.length > MAX_NOTE_LENGTH) throw new CartError('NOTE_TOO_LONG', `Note exceeds ${MAX_NOTE_LENGTH} characters`);
  return n;
}

/** Validate option selection against the item's option groups. Throws CartError. */
export function validateOptions(item, optionIds = []) {
  const groups = item.optionGroups ?? [];
  const known = new Map();
  for (const g of groups) for (const o of g.options) known.set(o.id, g.id);
  const chosen = new Set();
  for (const id of optionIds) {
    if (!known.has(id)) throw new CartError('UNKNOWN_OPTION', `Unknown option "${id}" for ${item.id}`);
    if (chosen.has(id)) throw new CartError('DUPLICATE_OPTION', `Option "${id}" selected twice`);
    chosen.add(id);
  }
  for (const g of groups) {
    const n = g.options.filter((o) => chosen.has(o.id)).length;
    if (n < (g.required ? Math.max(1, g.min) : g.min)) throw new CartError('OPTION_REQUIRED', `Choose an option for "${g.id}"`);
    if (n > g.max) throw new CartError('OPTION_MAX', `Too many options for "${g.id}"`);
  }
}

/** Unit price in cents for an item with the chosen options. */
export function unitPrice(item, optionIds = []) {
  let p = item.price;
  for (const g of item.optionGroups ?? []) for (const o of g.options) if (optionIds.includes(o.id)) p += o.priceDelta;
  return p;
}

function assertQty(qty) {
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
    throw new CartError('BAD_QTY', `Quantity must be a whole number from 1 to ${MAX_QTY_PER_LINE}`);
  }
}

/**
 * Add an item (merging with an identical existing line).
 * @param {Cart} cart
 * @param {{categories:any[],items:any[]}} menu
 * @param {{itemId:string,optionIds?:string[],qty?:number,note?:string}} req
 * @returns {Cart}
 */
export function addLine(cart, menu, { itemId, optionIds = [], qty = 1, note = '' }) {
  const item = findItem(menu, itemId);
  if (!item) throw new CartError('UNKNOWN_ITEM', `Unknown item "${itemId}"`);
  if (!item.available) throw new CartError('UNAVAILABLE', `${itemId} is currently unavailable`);
  assertQty(qty);
  validateOptions(item, optionIds);
  const n = cleanNote(note);
  const key = lineKey(itemId, optionIds, n);
  const existing = cart.lines.find((l) => l.key === key);
  if (existing) {
    const total = existing.qty + qty;
    assertQty(total);
    return { lines: cart.lines.map((l) => (l.key === key ? { ...l, qty: total } : l)) };
  }
  if (cart.lines.length >= MAX_LINES) throw new CartError('CART_FULL', 'Too many different items in the cart');
  return { lines: [...cart.lines, { key, itemId, optionIds: [...optionIds], qty, note: n }] };
}

/** Set quantity of a line; qty 0 removes it. */
export function setQty(cart, key, qty) {
  if (qty === 0) return removeLine(cart, key);
  assertQty(qty);
  return { lines: cart.lines.map((l) => (l.key === key ? { ...l, qty } : l)) };
}

export function removeLine(cart, key) {
  return { lines: cart.lines.filter((l) => l.key !== key) };
}

/**
 * Price the cart from the menu. Unavailable / unknown items are reported in `problems` (not silently dropped).
 * @returns {{lines:Array<CartLine & {name:any,unit:number,total:number}>,subtotal:number,itemCount:number,problems:string[]}}
 */
export function totals(menu, cart) {
  const lines = [];
  const problems = [];
  let subtotal = 0;
  let itemCount = 0;
  for (const l of cart.lines) {
    const item = findItem(menu, l.itemId);
    if (!item) { problems.push(`UNKNOWN_ITEM:${l.itemId}`); continue; }
    if (!item.available) problems.push(`UNAVAILABLE:${l.itemId}`);
    const unit = unitPrice(item, l.optionIds);
    const total = unit * l.qty;
    subtotal += total;
    itemCount += l.qty;
    lines.push({ ...l, name: item.name, unit, total });
  }
  return { lines, subtotal, itemCount, problems };
}
