// Inquiry domain (event/party requests + contact messages). DEMO: stored in the browser only.
// An inquiry is NEVER a booking: `confirmed` is always false and there is no auto-confirmation path.
import { validateCustomer, OrderError } from './orders.js?v=mwg3bo34';

export const INQUIRY_TYPES = ['birthday', 'group', 'private', 'other'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, max);

/**
 * @typedef {{id:string,kind:'event'|'contact',type?:string,name:string,phone:string,email?:string,date?:string,partySize?:number,
 *   budgetPerPerson?:string,dietary?:string,message?:string,consent:true,status:'new',confirmed:false,demo:true,createdAt:string}} Inquiry
 */

function ymd(now) { return new Date(now).toISOString().slice(0, 10); }

/** @returns {Inquiry} */
export function validateEventInquiry(input, now = Date.now(), seq = 1) {
  const { name, phone } = validateCustomer({ name: input.name, phone: input.phone });
  if (!INQUIRY_TYPES.includes(input.type)) throw new OrderError('BAD_TYPE', 'Choose a request type');
  const email = clean(input.email, 120);
  if (email && !EMAIL_RE.test(email)) throw new OrderError('BAD_EMAIL', 'Invalid email');
  const size = Number(input.partySize);
  if (!Number.isInteger(size) || size < 1 || size > 200) throw new OrderError('BAD_SIZE', 'Party size must be 1-200');
  const date = clean(input.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || date <= ymd(now)) throw new OrderError('BAD_DATE', 'Pick a future date');
  if (input.consent !== true) throw new OrderError('NO_CONSENT', 'Consent is required');
  return {
    id: `DEMO-INQ-${String(seq).padStart(4, '0')}`, kind: 'event', type: input.type, name, phone,
    ...(email ? { email } : {}), date, partySize: size,
    budgetPerPerson: clean(input.budget, 40), dietary: clean(input.dietary, 200), message: clean(input.message, 600),
    consent: true, status: 'new', confirmed: false, demo: true, createdAt: new Date(now).toISOString(),
  };
}

/** @returns {Inquiry} */
export function validateContactMessage(input, now = Date.now(), seq = 1) {
  const { name, phone } = validateCustomer({ name: input.name, phone: input.phone });
  const message = clean(input.message, 600);
  if (message.length < 3) throw new OrderError('BAD_MESSAGE', 'Write a message');
  if (input.consent !== true) throw new OrderError('NO_CONSENT', 'Consent is required');
  return { id: `DEMO-MSG-${String(seq).padStart(4, '0')}`, kind: 'contact', name, phone, message, consent: true, status: 'new', confirmed: false, demo: true, createdAt: new Date(now).toISOString() };
}
