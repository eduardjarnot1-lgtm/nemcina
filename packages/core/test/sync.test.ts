/**
 * Merging two devices.
 *
 * The scenario these protect: study on the train with no signal, then on a
 * tablet at home. Getting this wrong loses someone's work silently, which is
 * the one bug a learning app cannot come back from.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isProgressRecord, mergeProgress, pickNewer } from '../src/sync.ts';
import { newProgress, review } from '../src/srs.ts';
import { GRADE, type ItemProgress } from '../src/types.ts';

const T0 = 1_700_000_000_000;
const DAY = 86_400_000;
const at = (id: string, when: number, grade = GRADE.GOOD): ItemProgress =>
  review(newProgress('u1', id), grade, { now: when });

describe('which record wins', () => {
  test('the later review — it is what the other one was computed from', () => {
    const older = at('haus', T0);
    const newer = at('haus', T0 + DAY);
    assert.equal(pickNewer(older, newer), newer);
    assert.equal(pickNewer(newer, older), newer);
  });

  test('a tie goes to the record with more history behind it', () => {
    const thin = at('haus', T0);
    const thick = review(at('haus', T0 - DAY), GRADE.GOOD, { now: T0 });
    assert.equal(thin.lastReviewed, thick.lastReviewed);
    assert.equal(pickNewer(thin, thick), thick);
  });

  test('identical records merge to one, not two', () => {
    const record = at('haus', T0);
    const result = mergeProgress([record], [record]);
    assert.equal(result.merged.length, 1);
    assert.deepEqual(result.toPush, []);
    assert.deepEqual(result.toApply, []);
  });
});

describe('merging two devices', () => {
  test('each side gets what only the other has', () => {
    const local = [at('a', T0), at('b', T0)];
    const remote = [at('b', T0), at('c', T0)];
    const result = mergeProgress(local, remote);
    assert.deepEqual(result.merged.map((r) => r.itemId), ['a', 'b', 'c']);
    assert.deepEqual(result.toPush.map((r) => r.itemId), ['a'], 'the server is missing a');
    assert.deepEqual(result.toApply.map((r) => r.itemId), ['c'], 'this device is missing c');
  });

  test('THE case this exists for: the train, then the tablet', () => {
    // Studied on the phone at 09:00 offline; the tablet has yesterday's state.
    const phone = [at('haus', T0 + DAY), at('tisch', T0 + DAY)];
    const tablet = [at('haus', T0), at('tisch', T0), at('stuhl', T0)];

    const result = mergeProgress(phone, tablet);
    assert.equal(result.merged.length, 3);
    const haus = result.merged.find((r) => r.itemId === 'haus');
    assert.equal(haus?.lastReviewed, T0 + DAY, 'the phone had the newer review');
    assert.deepEqual(result.toPush.map((r) => r.itemId), ['haus', 'tisch']);
    assert.deepEqual(result.toApply.map((r) => r.itemId), ['stuhl']);
  });

  test('nothing is lost when one side is empty', () => {
    const local = [at('a', T0), at('b', T0)];
    assert.equal(mergeProgress(local, []).merged.length, 2);
    assert.equal(mergeProgress([], local).merged.length, 2);
    assert.deepEqual(mergeProgress([], []).merged, []);
  });

  test('merging is symmetric in what it decides, if not in which delta it fills', () => {
    const local = [at('a', T0 + DAY), at('b', T0)];
    const remote = [at('a', T0), at('b', T0 + DAY)];
    const forwards = mergeProgress(local, remote);
    const backwards = mergeProgress(remote, local);
    assert.deepEqual(forwards.merged, backwards.merged);
  });

  test('merging twice changes nothing the second time', () => {
    const local = [at('a', T0 + DAY), at('b', T0)];
    const remote = [at('a', T0), at('c', T0)];
    const once = mergeProgress(local, remote);
    const twice = mergeProgress(once.merged, once.merged);
    assert.deepEqual(twice.merged, once.merged);
    assert.deepEqual(twice.toPush, []);
    assert.deepEqual(twice.toApply, []);
  });

  test('the output order is stable, so two runs produce the same bytes', () => {
    const local = [at('z', T0), at('a', T0)];
    const remote = [at('m', T0)];
    assert.deepEqual(mergeProgress(local, remote).merged.map((r) => r.itemId), ['a', 'm', 'z']);
  });
});

describe('what arrives over a network is a stranger until checked', () => {
  test('a real record passes', () => {
    assert.equal(isProgressRecord(at('haus', T0)), true);
  });

  test('anything else does not', () => {
    for (const value of [null, undefined, 42, 'progress', [], {}]) {
      assert.equal(isProgressRecord(value), false, `${JSON.stringify(value)} was accepted`);
    }
  });

  test('a record missing a field, or carrying the wrong type, is refused', () => {
    const good = at('haus', T0) as unknown as Record<string, unknown>;
    assert.equal(isProgressRecord({ ...good, itemId: undefined }), false);
    assert.equal(isProgressRecord({ ...good, itemId: '' }), false);
    assert.equal(isProgressRecord({ ...good, seen: 'yes' }), false);
    assert.equal(isProgressRecord({ ...good, stability: 'lots' }), false);
  });

  test('NaN and Infinity are refused — they poison every later comparison', () => {
    const good = at('haus', T0) as unknown as Record<string, unknown>;
    assert.equal(isProgressRecord({ ...good, stability: Number.NaN }), false);
    assert.equal(isProgressRecord({ ...good, dueAt: Number.POSITIVE_INFINITY }), false);
  });

  test('a state outside the five known values is refused, not merged in', () => {
    const good = at('haus', T0) as unknown as Record<string, unknown>;
    assert.equal(isProgressRecord({ ...good, state: 'whatever' }), false);
    assert.equal(isProgressRecord({ ...good, state: '' }), false);
    // Every real state still passes — the check is a whitelist, not a typo trap.
    for (const state of ['new', 'learning', 'review', 'strong', 'mastered']) {
      assert.equal(isProgressRecord({ ...good, state }), true, `${state} should be valid`);
    }
  });
});
