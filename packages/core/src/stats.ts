/**
 * The numbers a learner is shown about themselves.
 *
 * Small arithmetic, but it has to be right: a streak that resets when it should
 * not is the single most reliable way to lose someone who was doing well, and a
 * "learned" count that drifts up while recall drifts down is a lie the app tells
 * every day.
 *
 * Days are local days. Midnight UTC is the wrong boundary for a person studying
 * at 23:00 in Prague, so the caller passes their offset.
 */

import { isDue } from './srs.ts';
import type { AttemptRecord, ItemProgress, Timestamp } from './types.ts';

export const DAY_MS = 86_400_000;

/** Which local day a moment falls on, as a whole number of days since the epoch. */
export function localDay(at: Timestamp, offsetMinutes = 0): number {
  return Math.floor((at - offsetMinutes * 60_000) / DAY_MS);
}

export interface Totals {
  readonly seen: number;
  readonly learned: number;
  readonly mastered: number;
  readonly due: number;
}

export function totals(records: Iterable<ItemProgress>, now: Timestamp = Date.now()): Totals {
  let seen = 0;
  let learned = 0;
  let mastered = 0;
  let due = 0;
  for (const record of records) {
    if (!record.seen) continue;
    seen += 1;
    if (record.state === 'review' || record.state === 'strong' || record.state === 'mastered') {
      learned += 1;
    }
    if (record.state === 'mastered') mastered += 1;
    if (isDue(record, now)) due += 1;
  }
  return { seen, learned, mastered, due };
}

export interface Streak {
  /** Consecutive days studied, counting back from today or yesterday. */
  readonly current: number;
  readonly longest: number;
  /** Already studied today, so the streak is safe. */
  readonly activeToday: boolean;
}

/**
 * Days studied in a row.
 *
 * Today not being studied yet does **not** break the streak — it is still
 * running until the day ends. Breaking it at midnight-plus-one-second would
 * punish someone who studies each evening for having not yet studied this
 * morning, which is the behaviour people quit over.
 */
export function streak(
  attempts: Iterable<Pick<AttemptRecord, 'at'>>,
  options: { now?: Timestamp; offsetMinutes?: number } = {},
): Streak {
  const now = options.now ?? Date.now();
  const offset = options.offsetMinutes ?? 0;
  const days = new Set<number>();
  for (const attempt of attempts) days.add(localDay(attempt.at, offset));
  if (days.size === 0) return { current: 0, longest: 0, activeToday: false };

  const sorted = [...days].sort((a, b) => a - b);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    run = (sorted[i] as number) - (sorted[i - 1] as number) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const today = localDay(now, offset);
  const activeToday = days.has(today);
  // Count back from today if studied, otherwise from yesterday — the streak is
  // still alive until today is over.
  let cursor = activeToday ? today : today - 1;
  let current = 0;
  while (days.has(cursor)) {
    current += 1;
    cursor -= 1;
  }

  return { current, longest, activeToday };
}

/** Items answered per local day, oldest first — the shape a small chart needs. */
export function dailyActivity(
  attempts: Iterable<Pick<AttemptRecord, 'at'>>,
  options: { now?: Timestamp; offsetMinutes?: number; days?: number } = {},
): readonly { readonly day: number; readonly count: number }[] {
  const now = options.now ?? Date.now();
  const offset = options.offsetMinutes ?? 0;
  const span = options.days ?? 30;
  const today = localDay(now, offset);
  const counts = new Map<number, number>();
  for (const attempt of attempts) {
    const day = localDay(attempt.at, offset);
    if (day > today || day <= today - span) continue;
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return Array.from({ length: span }, (_, i) => {
    const day = today - span + 1 + i;
    return { day, count: counts.get(day) ?? 0 };
  });
}
