import test from 'node:test';
import assert from 'node:assert/strict';
import { LATEST_POSTS, PAST_POSTS, EVENTS, splitEvents, athensDate } from '../../src/shared/social-data.js';

test('all 14 owner-supplied Instagram links are present, unique, newest first, and link out only', () => {
  const all = [...LATEST_POSTS, ...PAST_POSTS];
  assert.equal(all.length, 14);
  assert.equal(new Set(all.map((p) => p.id)).size, 14);
  for (const p of all) assert.match(p.url, /^https:\/\/www\.instagram\.com\/p\/[\w-]{11}\/$/);
  for (const list of [LATEST_POSTS, PAST_POSTS]) assert.deepEqual(list.map((p) => p.posted), [...list.map((p) => p.posted)].sort().reverse());
  assert.ok(PAST_POSTS[0].posted < LATEST_POSTS.at(-1).posted);
});

test('events split by Athens date: today counts as upcoming, next day is past', () => {
  assert.equal(athensDate(new Date('2026-11-07T22:30:00Z')), '2026-11-08'); // 00:30 Athens next day
  assert.equal(splitEvents(EVENTS, new Date('2026-11-03T10:00:00Z')).upcoming.length, 1);
  assert.equal(splitEvents(EVENTS, new Date('2026-11-08T08:00:00Z')).upcoming.length, 1);
  const after = splitEvents(EVENTS, new Date('2026-11-09T08:00:00Z'));
  assert.equal(after.upcoming.length, 0);
  assert.equal(after.past[0].id, 'live-2026-11-08');
});
