import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addStudyAttempt, studySummary, type StudyDay } from '../src/activity.ts';
import { KeyValueProgressStore, type KeyValueStore } from '../src/storage.ts';
import type { AttemptRecord } from '../src/types.ts';

const NOW = Date.UTC(2026, 8, 15, 12);
const DAY = 86_400_000;
const answer = (itemId: string, at = NOW): AttemptRecord => ({
  userId: 'local', itemId, at, correct: true, grade: 3,
  exerciseKind: 'typing', given: 'answer', expected: 'answer',
});
function device(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
}

test('daily counts include mistakes but XP rewards only the first correct answer', () => {
  let days: readonly StudyDay[] = [];
  days = addStudyAttempt(days, { ...answer('word'), correct: false, grade: 1 });
  days = addStudyAttempt(days, answer('word', NOW + 1));
  days = addStudyAttempt(days, answer('word', NOW + 2));
  const summary = studySummary(days, { now: NOW + 3 });
  assert.equal(summary.xp, 3);
  assert.equal(summary.today, 3);
});

test('local days are recorded when answered, including a change in timezone offset', () => {
  const before = Date.UTC(2026, 8, 14, 21, 30);
  const after = before + 3_600_000;
  let days = addStudyAttempt([], answer('word', before), 120);
  days = addStudyAttempt(days, answer('word', after), 120);
  assert.equal(studySummary(days, { now: after, offsetMinutes: 120 }).streak.current, 2);
  assert.equal(studySummary(days, { now: after, offsetMinutes: 120 }).xp, 6);
});

test('XP and longest streak survive more than 500 answers and a restart', async () => {
  const backing = device();
  const store = new KeyValueProgressStore(backing);
  for (let i = 0; i < 510; i++) {
    await store.recordAttempt(answer(`w${i}`, NOW - Math.floor((509 - i) / 10) * DAY));
  }
  const restarted = new KeyValueProgressStore(backing);
  assert.equal((await restarted.recentAttempts('local', 1000)).length, 500);
  const summary = studySummary(await restarted.studyDays('local'), { now: NOW });
  assert.equal(summary.xp, 1530);
  assert.equal(summary.streak.longest, 51);
  assert.equal(summary.streak.current, 51);
  assert.equal(summary.today, 10);
});

test('a legacy answer array migrates once without inventing lost history', async () => {
  const backing = device();
  await backing.setItem('nemcina:v1:attempts', JSON.stringify([
    answer('a', NOW - DAY), answer('b'),
  ]));
  const store = new KeyValueProgressStore(backing);
  assert.equal(studySummary(await store.studyDays('local'), { now: NOW }).xp, 6);
  await store.recordAttempt(answer('c'));
  const restarted = new KeyValueProgressStore(backing);
  const summary = studySummary(await restarted.studyDays('local'), { now: NOW });
  assert.equal(summary.xp, 9);
  assert.equal(summary.streak.current, 2);
});

test('clearing a learner deletes their daily history and preserves another learner', async () => {
  const backing = device();
  const store = new KeyValueProgressStore(backing);
  await store.recordAttempt(answer('a'));
  await store.recordAttempt({ ...answer('b'), userId: 'other' });
  await store.clear('local');
  const restarted = new KeyValueProgressStore(backing);
  assert.equal((await restarted.studyDays('local')).length, 0);
  assert.equal(studySummary(await restarted.studyDays('other'), { now: NOW }).xp, 3);
});

test('a rejected history write can be retried without counting the answer twice', async () => {
  const backing = device();
  let fail = true;
  const store = new KeyValueProgressStore({
    ...backing,
    setItem(key, value) {
      if (fail) { fail = false; throw new Error('full'); }
      return backing.setItem(key, value);
    },
  });
  await assert.rejects(store.recordAttempt(answer('a')), /full/);
  await store.recordAttempt(answer('a'));
  const summary = studySummary(await store.studyDays('local'), { now: NOW });
  assert.equal(summary.today, 1);
  assert.equal(summary.xp, 3);
});
