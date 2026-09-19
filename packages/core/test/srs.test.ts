import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY, review, newProgress, isDue, currentRecall, retrievability, intervalDays,
} from '../src/srs.ts';
import { GRADE, type ItemProgress } from '../src/types.ts';

const T0 = 1_700_000_000_000;
const fresh = (): ItemProgress => newProgress('u1', 'w1');

describe('FSRS-5 scheduling', () => {
  test('a new item starts unseen, unscheduled and not due', () => {
    const record = fresh();
    assert.equal(record.seen, false);
    assert.equal(record.state, 'new');
    assert.equal(record.stability, 0);
    assert.equal(isDue(record, T0), false);
  });

  test('first Good answer uses the published initial stability w[2]', () => {
    const after = review(fresh(), GRADE.GOOD, { now: T0 });
    assert.ok(Math.abs(after.stability - 3.173) < 1e-9, `got ${after.stability}`);
    assert.equal(after.seen, true);
    assert.equal(after.correctCount, 1);
  });

  test('Easy starts far higher than Again', () => {
    const easy = review(fresh(), GRADE.EASY, { now: T0 });
    const again = review(fresh(), GRADE.AGAIN, { now: T0 });
    assert.ok(easy.stability > again.stability * 10);
  });

  test('stability grows across successful reviews', () => {
    let record = review(fresh(), GRADE.GOOD, { now: T0 });
    const first = record.stability;
    record = review(record, GRADE.GOOD, { now: record.dueAt });
    const second = record.stability;
    record = review(record, GRADE.GOOD, { now: record.dueAt });
    assert.ok(first < second && second < record.stability,
      `expected growth, got ${first} ${second} ${record.stability}`);
  });

  test('a lapse cuts stability and raises difficulty', () => {
    let record = fresh();
    for (let i = 0; i < 3; i += 1) record = review(record, GRADE.GOOD, { now: record.dueAt || T0 });
    const before = record;
    const after = review(record, GRADE.AGAIN, { now: record.dueAt });
    assert.ok(after.stability < before.stability, 'stability must drop');
    assert.ok(after.difficulty > before.difficulty, 'difficulty must rise');
    assert.equal(after.state, 'learning');
    assert.equal(after.repetitionCount, 0, 'the streak resets');
  });

  test('Again schedules a ten-minute learning step, not a day', () => {
    const after = review(fresh(), GRADE.AGAIN, { now: T0 });
    assert.equal(after.dueAt - T0, 10 * 60_000);
  });

  test('a successful review is never scheduled sooner than a day', () => {
    const after = review(fresh(), GRADE.GOOD, { now: T0 });
    assert.ok(after.dueAt - T0 >= DAY);
  });

  test('intervals are capped at a year', () => {
    let record = fresh();
    for (let i = 0; i < 25; i += 1) record = review(record, GRADE.EASY, { now: record.dueAt || T0 });
    assert.ok(record.dueAt - record.lastReviewed <= 365 * DAY);
  });

  test('state follows the scheduler, not a counter', () => {
    // Two Good answers is not mastery; the interval decides.
    let record = review(fresh(), GRADE.GOOD, { now: T0 });
    assert.equal(record.state, 'review', 'a 3-day interval is not "strong"');
    record = review(record, GRADE.GOOD, { now: record.dueAt });
    assert.equal(record.state, 'strong', 'past a week it is strong');
    assert.ok(record.stability >= 7);
  });

  test('a mastered item that lapses drops back to learning', () => {
    let record = fresh();
    for (let i = 0; i < 6; i += 1) record = review(record, GRADE.EASY, { now: record.dueAt || T0 });
    assert.equal(record.state, 'mastered');
    const lapsed = review(record, GRADE.AGAIN, { now: record.dueAt });
    assert.equal(lapsed.state, 'learning');
  });

  test('same-day repeats use the short-term path, not the long-term one', () => {
    const first = review(fresh(), GRADE.GOOD, { now: T0 });
    const sameDay = review(first, GRADE.GOOD, { now: T0 + 60_000 });
    const nextDay = review(first, GRADE.GOOD, { now: T0 + 2 * DAY });
    assert.notEqual(sameDay.stability, nextDay.stability);
    assert.ok(nextDay.stability > sameDay.stability,
      'a real day of forgetting earns more stability than a minute');
  });

  test('retrievability decays with elapsed time and is 0.9 at the interval', () => {
    const stability = 10;
    assert.equal(retrievability(stability, 0), 1);
    const atInterval = retrievability(stability, intervalDays(stability));
    assert.ok(Math.abs(atInterval - 0.9) < 1e-9, `got ${atInterval}`);
    assert.ok(retrievability(stability, 30) < retrievability(stability, 5));
  });

  test('currentRecall is 0 for an unseen item and decays after review', () => {
    assert.equal(currentRecall(fresh(), T0), 0);
    const record = review(fresh(), GRADE.GOOD, { now: T0 });
    assert.ok(currentRecall(record, T0) > 0.99);
    assert.ok(currentRecall(record, T0 + 30 * DAY) < 0.7);
  });

  test('isDue is false before the due date and true after', () => {
    const record = review(fresh(), GRADE.GOOD, { now: T0 });
    assert.equal(isDue(record, record.dueAt - 1), false);
    assert.equal(isDue(record, record.dueAt), true);
  });

  test('a lower target retention produces a longer interval', () => {
    const strict = review(fresh(), GRADE.GOOD, { now: T0, retention: 0.95 });
    const relaxed = review(fresh(), GRADE.GOOD, { now: T0, retention: 0.8 });
    assert.ok(relaxed.dueAt > strict.dueAt);
  });

  test('review never mutates the record it was given', () => {
    const record = fresh();
    const snapshot = JSON.stringify(record);
    review(record, GRADE.GOOD, { now: T0 });
    assert.equal(JSON.stringify(record), snapshot);
  });
});
