import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryProgressStore, KeyValueProgressStore, type KeyValueStore, type ProgressStore } from '../src/storage.ts';
import { newProgress, review } from '../src/srs.ts';
import { GRADE, type AttemptRecord } from '../src/types.ts';

const T0 = 1_700_000_000_000;

/** A key-value store that keeps its bytes, the way a real device does. */
class FakeDevice implements KeyValueStore {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

const attempt = (itemId: string, correct: boolean): AttemptRecord => ({
  userId: 'u1', itemId, at: T0, correct, grade: correct ? GRADE.GOOD : GRADE.AGAIN,
  given: 'x', expected: 'y', exerciseKind: 'typing',
});

/** Both implementations must behave identically, so both run the same suite. */
const implementations: ReadonlyArray<readonly [string, () => ProgressStore]> = [
  ['InMemoryProgressStore', () => new InMemoryProgressStore()],
  ['KeyValueProgressStore', () => new KeyValueProgressStore(new FakeDevice())],
];

for (const [name, create] of implementations) {
  describe(name, () => {
    test('an unknown item comes back as a fresh record, not null', async () => {
      const store = create();
      const record = await store.get('u1', 'nope');
      assert.equal(record.seen, false);
      assert.equal(record.itemId, 'nope');
    });

    test('a stored record round-trips', async () => {
      const store = create();
      const saved = review(newProgress('u1', 'w1'), GRADE.GOOD, { now: T0 });
      await store.put(saved);
      assert.deepEqual(await store.get('u1', 'w1'), saved);
    });

    test('getMany answers for every id asked, known or not', async () => {
      const store = create();
      await store.put(review(newProgress('u1', 'w1'), GRADE.GOOD, { now: T0 }));
      const many = await store.getMany('u1', ['w1', 'w2']);
      assert.equal(many.size, 2);
      assert.equal(many.get('w1')!.seen, true);
      assert.equal(many.get('w2')!.seen, false);
    });

    test('one user cannot see or clear another user\'s progress', async () => {
      const store = create();
      await store.put(review(newProgress('u1', 'w1'), GRADE.GOOD, { now: T0 }));
      await store.put(review(newProgress('u2', 'w1'), GRADE.GOOD, { now: T0 }));

      assert.equal((await store.all('u1')).length, 1);
      assert.equal((await store.get('u2', 'w1')).userId, 'u2');

      await store.clear('u1');
      assert.equal((await store.all('u1')).length, 0);
      assert.equal((await store.all('u2')).length, 1, 'u2 must be untouched');
    });

    test('attempts are logged newest-first and scoped per user', async () => {
      const store = create();
      await store.recordAttempt(attempt('w1', true));
      await store.recordAttempt(attempt('w2', false));
      await store.recordAttempt({ ...attempt('w3', true), userId: 'u2' });

      const recent = await store.recentAttempts('u1', 10);
      assert.equal(recent.length, 2);
      assert.equal(recent[0]!.itemId, 'w2', 'newest first');
      assert.equal((await store.recentAttempts('u2', 10)).length, 1);
    });

    test('clear removes the attempt log too — GDPR deletion, not just progress', async () => {
      const store = create();
      await store.put(review(newProgress('u1', 'w1'), GRADE.GOOD, { now: T0 }));
      await store.recordAttempt(attempt('w1', true));
      await store.clear('u1');
      assert.equal((await store.recentAttempts('u1', 10)).length, 0);
    });
  });
}

describe('KeyValueProgressStore persistence', () => {
  test('progress survives a restart — the app is closed and reopened', async () => {
    const device = new FakeDevice();

    const before = new KeyValueProgressStore(device);
    await before.put(review(newProgress('u1', 'w1'), GRADE.GOOD, { now: T0 }));
    await before.recordAttempt(attempt('w1', true));

    // A brand-new instance over the same device state: process restarted.
    const after = new KeyValueProgressStore(device);
    const record = await after.get('u1', 'w1');
    assert.equal(record.seen, true, 'progress must not vanish on restart');
    assert.ok(record.stability > 0);
    assert.equal((await after.recentAttempts('u1', 10)).length, 1);
  });

  test('every write reaches the device immediately, not at session end', async () => {
    const device = new FakeDevice();
    const store = new KeyValueProgressStore(device);
    await store.put(review(newProgress('u1', 'w1'), GRADE.GOOD, { now: T0 }));
    assert.ok(device.data.size > 0, 'a crash right now must not lose the answer');
  });

  test('corrupt stored data does not brick the app', async () => {
    const device = new FakeDevice();
    device.data.set('nemcina:v1:progress', '{ this is not json');
    device.data.set('nemcina:v1:attempts', 'neither is this');

    const store = new KeyValueProgressStore(device);
    const record = await store.get('u1', 'w1');
    assert.equal(record.seen, false, 'starts clean rather than throwing');

    await store.put(review(record, GRADE.GOOD, { now: T0 }));
    const repaired = new KeyValueProgressStore(device);
    assert.equal((await repaired.get('u1', 'w1')).seen, true, 'and the next write repairs it');
  });

  test('two stores with different prefixes do not see each other', async () => {
    const device = new FakeDevice();
    const a = new KeyValueProgressStore(device, { prefix: 'a' });
    const b = new KeyValueProgressStore(device, { prefix: 'b' });
    await a.put(review(newProgress('u1', 'w1'), GRADE.GOOD, { now: T0 }));
    assert.equal((await b.get('u1', 'w1')).seen, false);
  });

  test('the attempt log is capped so it cannot grow without bound', async () => {
    const store = new KeyValueProgressStore(new FakeDevice(), { attemptLimit: 5 });
    for (let i = 0; i < 20; i += 1) await store.recordAttempt(attempt(`w${i}`, true));
    const recent = await store.recentAttempts('u1', 100);
    assert.equal(recent.length, 5);
    assert.equal(recent[0]!.itemId, 'w19', 'the newest are the ones kept');
  });
});
