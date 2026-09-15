/**
 * The numbers shown back to the learner.
 *
 * The streak tests are the ones that matter. A streak that resets a day early
 * is worse than no streak at all, and it resets silently — nobody files a bug,
 * they just stop opening the app.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS, dailyActivity, localDay, streak, totals } from '../src/stats.ts';
import { newProgress, review } from '../src/srs.ts';
import { GRADE, type ItemProgress } from '../src/types.ts';

/** Noon UTC on a Wednesday, so day boundaries are never a rounding accident. */
const NOON = Date.UTC(2026, 0, 14, 12, 0, 0);
const at = (daysAgo: number, hour = 12) => NOON - daysAgo * DAY_MS + (hour - 12) * 3_600_000;

describe('local days', () => {
  test('two moments on the same local day are the same day', () => {
    assert.equal(localDay(at(0, 9)), localDay(at(0, 21)));
  });

  test('the offset moves the boundary, which is the whole point of having it', () => {
    // 23:00 in Prague (UTC+1) is 22:00 UTC — the same day locally, and the day
    // before if the boundary were UTC midnight for a UTC-5 learner.
    const late = Date.UTC(2026, 0, 14, 22, 0, 0);
    assert.equal(localDay(late, 60), localDay(NOON, 60));
    assert.notEqual(localDay(late, -5 * 60), localDay(late, 60) );
  });
});

describe('totals', () => {
  const T0 = NOON - 10 * DAY_MS;
  const records: ItemProgress[] = [
    newProgress('u1', 'untouched'),
    review(newProgress('u1', 'failed'), GRADE.AGAIN, { now: T0 }),
    review(newProgress('u1', 'learned'), GRADE.GOOD, { now: T0 }),
  ];

  test('an item never answered counts towards nothing', () => {
    const result = totals(records, NOON);
    assert.equal(result.seen, 2);
    assert.equal(result.learned, 1);
    assert.equal(result.mastered, 0);
  });

  test('due counts what the scheduler says is due now, not what looks old', () => {
    assert.equal(totals(records, T0).due, 0);
    assert.equal(totals(records, NOON).due, 2, 'ten days on, both answered items are due');
  });

  test('mastery is the scheduler\'s verdict, not an attempt count', () => {
    let record = newProgress('u1', 'x');
    for (let i = 0; i < 12; i += 1) record = review(record, GRADE.EASY, { now: record.dueAt || T0 });
    assert.equal(totals([record], record.lastReviewed).mastered, 1);
  });

  test('nothing at all is all zeros, not a crash', () => {
    assert.deepEqual(totals([], NOON), { seen: 0, learned: 0, mastered: 0, due: 0 });
  });
});

describe('streaks', () => {
  const on = (...daysAgo: number[]) => daysAgo.map((d) => ({ at: at(d) }));

  test('studying today and the three days before is a streak of four', () => {
    assert.equal(streak(on(0, 1, 2, 3), { now: NOON }).current, 4);
  });

  test('THE one that loses users: today not studied yet does not break it', () => {
    // Studied yesterday and the day before, nothing yet today. It is 12:00 —
    // the day is not over, so the streak is alive.
    const result = streak(on(1, 2, 3), { now: NOON });
    assert.equal(result.current, 3);
    assert.equal(result.activeToday, false);
  });

  test('a missed day does break it', () => {
    // Studied today, then a gap at day 1.
    assert.equal(streak(on(0, 2, 3), { now: NOON }).current, 1);
  });

  test('several sessions in one day are one day', () => {
    const sameDay = [{ at: at(0, 8) }, { at: at(0, 13) }, { at: at(0, 22) }];
    assert.equal(streak(sameDay, { now: NOON }).current, 1);
  });

  test('the longest streak is remembered after the current one breaks', () => {
    const result = streak(on(0, 5, 6, 7, 8, 9), { now: NOON });
    assert.equal(result.current, 1);
    assert.equal(result.longest, 5);
  });

  test('never having studied is zero, not one', () => {
    assert.deepEqual(streak([], { now: NOON }), { current: 0, longest: 0, activeToday: false });
  });

  test('an evening learner in a positive offset keeps their streak', () => {
    // 23:30 local in UTC+1 on each of three nights.
    const evenings = [1, 2, 3].map((d) => ({ at: at(d, 22) + 30 * 60_000 }));
    assert.equal(streak(evenings, { now: NOON, offsetMinutes: 60 }).current, 3);
  });
});

describe('daily activity', () => {
  test('a fixed-length window, oldest first, with gaps as zeros', () => {
    const activity = dailyActivity([{ at: at(0) }, { at: at(0) }, { at: at(2) }],
      { now: NOON, days: 5 });
    assert.equal(activity.length, 5);
    assert.deepEqual(activity.map((d) => d.count), [0, 0, 1, 0, 2]);
  });

  test('anything older than the window is left out rather than piled on the edge', () => {
    const activity = dailyActivity([{ at: at(90) }], { now: NOON, days: 5 });
    assert.deepEqual(activity.map((d) => d.count), [0, 0, 0, 0, 0]);
  });
});
