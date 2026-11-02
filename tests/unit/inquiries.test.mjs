import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEventInquiry, validateContactMessage } from '../../src/shared/inquiries.js';

const NOW = Date.parse('2026-11-02T10:00:00Z');
const ok = { type: 'birthday', name: 'Eleni K.', phone: '694 123 4567', partySize: '12', date: '2026-12-05', consent: true };

test('inquiry: valid request is stored as new and never confirmed', () => {
  const q = validateEventInquiry(ok, NOW, 3);
  assert.equal(q.status, 'new');
  assert.equal(q.confirmed, false);
  assert.equal(q.demo, true);
  assert.equal(q.partySize, 12);
  assert.equal(q.id, 'DEMO-INQ-0003');
});

test('inquiry: validation errors carry stable codes', () => {
  const code = (over) => { try { validateEventInquiry({ ...ok, ...over }, NOW); return 'none'; } catch (e) { return e.code; } };
  assert.equal(code({ type: 'wedding' }), 'BAD_TYPE');
  assert.equal(code({ partySize: 0 }), 'BAD_SIZE');
  assert.equal(code({ partySize: 201 }), 'BAD_SIZE');
  assert.equal(code({ date: '2026-11-02' }), 'BAD_DATE');
  assert.equal(code({ date: 'soon' }), 'BAD_DATE');
  assert.equal(code({ consent: false }), 'NO_CONSENT');
  assert.equal(code({ email: 'nope' }), 'BAD_EMAIL');
  assert.equal(code({ phone: '12' }), 'BAD_PHONE');
  assert.equal(code({ name: '' }), 'BAD_NAME');
});

test('contact message: needs text and consent', () => {
  const base = { name: 'Nikos', phone: '210 600 5412', message: 'Hello there', consent: true };
  assert.equal(validateContactMessage(base, NOW).kind, 'contact');
  assert.throws(() => validateContactMessage({ ...base, message: '' }, NOW), (e) => e.code === 'BAD_MESSAGE');
  assert.throws(() => validateContactMessage({ ...base, consent: false }, NOW), (e) => e.code === 'NO_CONSENT');
});
