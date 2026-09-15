import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { planSession, bucketOf, priority, stageFor, stageWithin, shuffle, DEFAULT_MIX, EXERCISE_STAGES } from '../src/selection.ts';
import { newProgress, review, DAY } from '../src/srs.ts';
import { GRADE, type ItemProgress } from '../src/types.ts';

const T0 = 1_700_000_000_000;
/** Deterministic "random" so session order is reproducible in tests. */
const fixed = (): number => 0.5;

const make = (id: string, shape: Partial<ItemProgress> = {}): ItemProgress =>
  ({ ...newProgress('u1', id), ...shape });

const candidates = (records: ItemProgress[]) =>
  records.map((progress) => ({ item: progress.itemId, progress }));

describe('buckets', () => {
  test('an unseen item is fresh', () => {
    assert.equal(bucketOf(make('a'), T0), 'fresh');
  });

  test('a failed learning item is weak', () => {
    const record = review(make('a'), GRADE.AGAIN, { now: T0 });
    assert.equal(bucketOf(record, T0), 'weak');
  });

  test('a scheduled item past its date is due', () => {
    const record = review(make('a'), GRADE.GOOD, { now: T0 });
    assert.equal(bucketOf(record, record.dueAt + 1), 'due');
  });

  test('a mastered item that is not due is maintenance', () => {
    let record = make('a');
    for (let i = 0; i < 6; i += 1) record = review(record, GRADE.EASY, { now: record.dueAt || T0 });
    assert.equal(record.state, 'mastered');
    assert.equal(bucketOf(record, record.lastReviewed), 'maintenance');
  });

  test('weak outranks due, due outranks fresh, fresh outranks maintenance', () => {
    const weak = review(make('w'), GRADE.AGAIN, { now: T0 });
    const due = review(make('d'), GRADE.GOOD, { now: T0 - 10 * DAY });
    const fresh = make('f');
    let mastered = make('m');
    for (let i = 0; i < 6; i += 1) mastered = review(mastered, GRADE.EASY, { now: mastered.dueAt || T0 });

    const p = (r: ItemProgress) => priority(r, T0);
    assert.ok(p(weak) > p(due), 'weak > due');
    assert.ok(p(due) > p(fresh), 'due > fresh');
    assert.ok(p(fresh) > p(mastered), 'fresh > maintenance');
  });
});

describe('session planning', () => {
  test('new items are capped so reviews are never crowded out', () => {
    const weak = Array.from({ length: 10 }, (_, i) =>
      review(make(`w${i}`), GRADE.AGAIN, { now: T0 }));
    const fresh = Array.from({ length: 50 }, (_, i) => make(`f${i}`));
    const plan = planSession(candidates([...weak, ...fresh]), { now: T0, random: fixed });

    assert.equal(plan.items.length, DEFAULT_MIX.total);
    assert.ok(plan.composition.fresh <= DEFAULT_MIX.maxNew,
      `expected at most ${DEFAULT_MIX.maxNew} new, got ${plan.composition.fresh}`);
    assert.ok(plan.composition.weak > 0, 'weak items must appear');
  });

  test('THE regression this product cannot afford: never all-new while weak items wait', () => {
    const weak = Array.from({ length: 3 }, (_, i) =>
      review(make(`w${i}`), GRADE.AGAIN, { now: T0 }));
    const fresh = Array.from({ length: 200 }, (_, i) => make(`f${i}`));
    const plan = planSession(candidates([...weak, ...fresh]), { now: T0, random: fixed });
    const ids = new Set(plan.items.map((entry) => entry.progress.itemId));
    for (const record of weak) {
      assert.ok(ids.has(record.itemId), `${record.itemId} must be in the session`);
    }
  });

  test('a session short on reviews backfills with new items rather than ending early', () => {
    const weak = [review(make('w0'), GRADE.AGAIN, { now: T0 })];
    const fresh = Array.from({ length: 30 }, (_, i) => make(`f${i}`));
    const plan = planSession(candidates([...weak, ...fresh]), { now: T0, random: fixed });
    assert.equal(plan.items.length, DEFAULT_MIX.total, 'the session is filled');
    assert.ok(plan.composition.fresh > DEFAULT_MIX.maxNew,
      'the cap is a target, not a hard ceiling when there is nothing else to show');
  });

  test('at most one maintenance item', () => {
    const mastered = Array.from({ length: 10 }, (_, i) => {
      let record = make(`m${i}`);
      for (let k = 0; k < 6; k += 1) record = review(record, GRADE.EASY, { now: record.dueAt || T0 });
      return record;
    });
    const plan = planSession(candidates(mastered), { now: T0, random: fixed });
    assert.ok(plan.composition.maintenance <= DEFAULT_MIX.maxMaintenance);
  });

  test('never returns more than the requested total, and never duplicates', () => {
    const records = Array.from({ length: 100 }, (_, i) => make(`x${i}`));
    const plan = planSession(candidates(records), { now: T0, random: fixed, mix: { total: 7, maxNew: 7, maxMaintenance: 0 } });
    assert.equal(plan.items.length, 7);
    assert.equal(new Set(plan.items.map((e) => e.progress.itemId)).size, 7);
  });

  test('an empty pool yields an empty session rather than throwing', () => {
    const plan = planSession([], { now: T0, random: fixed });
    assert.equal(plan.items.length, 0);
  });

  test('composition adds up to the number of items returned', () => {
    const records = Array.from({ length: 40 }, (_, i) => make(`x${i}`));
    const plan = planSession(candidates(records), { now: T0, random: fixed });
    const sum = Object.values(plan.composition).reduce((a, b) => a + b, 0);
    assert.equal(sum, plan.items.length);
  });
});

describe('exercise progression', () => {
  test('an unseen item starts at recognition', () => {
    assert.equal(stageFor(make('a')), 'recognise');
  });

  test('difficulty climbs with mastery', () => {
    let record = review(make('a'), GRADE.GOOD, { now: T0 });
    assert.equal(stageFor(record), 'recall');
    record = review(record, GRADE.GOOD, { now: record.dueAt });
    assert.equal(stageFor(record), 'typing');
    for (let i = 0; i < 5; i += 1) record = review(record, GRADE.EASY, { now: record.dueAt });
    assert.equal(stageFor(record), 'context');
  });

  test('a lapse makes the next question easier, not harder', () => {
    let record = make('a');
    for (let i = 0; i < 6; i += 1) record = review(record, GRADE.EASY, { now: record.dueAt || T0 });
    assert.equal(stageFor(record), 'context');

    const lapsed = review(record, GRADE.AGAIN, { now: record.dueAt });
    const before = EXERCISE_STAGES.indexOf(stageFor(record));
    const after = EXERCISE_STAGES.indexOf(stageFor(lapsed));
    assert.ok(after < before, `expected an easier stage, went ${stageFor(record)} -> ${stageFor(lapsed)}`);
  });

  test('a lapse does not send a well-known item all the way back to recognition', () => {
    // Someone who knew a word six times and slipped once has not become a
    // beginner at it. Over-correcting here is how an app feels punitive.
    let record = make('a');
    for (let i = 0; i < 6; i += 1) record = review(record, GRADE.EASY, { now: record.dueAt || T0 });
    const lapsed = review(record, GRADE.AGAIN, { now: record.dueAt });
    assert.equal(stageFor(lapsed), 'choice');

    // A word failed on first contact, though, does start at the bottom.
    const neverKnown = review(make('b'), GRADE.AGAIN, { now: T0 });
    assert.equal(stageFor(neverKnown), 'recognise');
  });

  test('narrowing falls back down the ladder, never up', () => {
    let record = review(make('a'), GRADE.GOOD, { now: T0 });
    record = review(record, GRADE.GOOD, { now: record.dueAt });
    assert.equal(stageFor(record), 'typing');
    // No typing exercise available for this item (no example, no production form).
    assert.equal(stageWithin(record, ['recognise', 'choice']), 'choice');
    assert.equal(stageWithin(record, ['recognise']), 'recognise');
  });

  test('narrowing to nothing returns null rather than inventing a question', () => {
    assert.equal(stageWithin(make('a'), []), null);
  });
});

describe('shuffle', () => {
  test('keeps every element exactly once', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input, fixed);
    assert.deepEqual([...out].sort((a, b) => a - b), input);
  });

  test('does not mutate its input', () => {
    const input = [1, 2, 3];
    shuffle(input, fixed);
    assert.deepEqual(input, [1, 2, 3]);
  });
});

describe('a state the scheduler does not recognise', () => {
  test('stageFor returns a real exercise rather than undefined', () => {
    // Unreachable by the type, reachable at runtime: this is what a forged sync
    // payload or a hand-edited storage entry produced before both were checked.
    const record = {
      ...newProgress('u1', 'haus'), seen: true, state: 'whatever',
    } as unknown as ItemProgress;
    const stage = stageFor(record);
    assert.notEqual(stage, undefined, 'stageFor fell off the end of its switch');
    assert.ok(EXERCISE_STAGES.includes(stage));
    assert.equal(stage, 'recognise', 'the safe guess is the easiest form');
  });

  test('stageWithin still narrows to something available', () => {
    const record = {
      ...newProgress('u1', 'haus'), seen: true, state: 'whatever',
    } as unknown as ItemProgress;
    assert.equal(stageWithin(record, ['choice', 'typing']), 'choice');
  });
});
