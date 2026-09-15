/**
 * What to study next, and how hard to make it.
 *
 * Two decisions live here:
 *
 *   1. Which items go into this session, in what order.
 *   2. Which exercise form each item deserves, given how well it is known.
 *
 * The first matters more than it looks. The failure mode of a vocabulary app is
 * showing endless new words while the ones the learner already got wrong quietly
 * rot. So weak and overdue items outrank new ones, and a session that is short
 * on reviews backfills with new items rather than the other way round.
 *
 * Deterministic: the caller supplies `now`, and shuffling takes an explicit
 * random source. A learning queue that cannot be reproduced cannot be tested.
 */

import { currentRecall, isDue, overdueDays } from './srs.ts';
import type { ExerciseKind, ItemProgress, Timestamp } from './types.ts';

/** A pluggable random source so tests can make selection deterministic. */
export type Random = () => number;

/** Fisher–Yates, with the random source injected. */
export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/**
 * The buckets the session mix is expressed in, in priority order.
 * `weak` outranks `due` on purpose: an item the learner has actually failed is
 * more urgent than one the schedule merely says is ready.
 */
export type Bucket = 'weak' | 'due' | 'learning' | 'fresh' | 'maintenance';

export const BUCKET_ORDER: readonly Bucket[] = ['weak', 'due', 'learning', 'fresh', 'maintenance'];

export function bucketOf(record: ItemProgress, now: Timestamp = Date.now()): Bucket {
  if (!record.seen) return 'fresh';
  if (record.incorrectCount > 0 && record.state === 'learning') return 'weak';
  if (isDue(record, now)) return 'due';
  if (record.state === 'learning' || record.state === 'review') return 'learning';
  return 'maintenance';
}

/**
 * Score within a bucket — higher comes first.
 *
 * Bucket order dominates; this only breaks ties inside one bucket, using how
 * faded the memory actually is rather than how long ago the clock says.
 */
export function priority(record: ItemProgress, now: Timestamp = Date.now()): number {
  const bucket = bucketOf(record, now);
  const base = (BUCKET_ORDER.length - BUCKET_ORDER.indexOf(bucket)) * 1000;

  switch (bucket) {
    case 'weak': {
      const attempts = record.correctCount + record.incorrectCount;
      const accuracy = attempts ? record.correctCount / attempts : 0;
      return base + record.incorrectCount * 10 + (1 - accuracy) * 50;
    }
    case 'due':
      return base + Math.min(overdueDays(record, now), 30) + (1 - currentRecall(record, now)) * 10;
    case 'learning':
      return base + (1 - currentRecall(record, now)) * 10;
    case 'fresh':
      return base;
    case 'maintenance':
      return base - Math.min(record.repetitionCount, 20);
  }
}

/** How many items of each kind a session should aim for. */
export interface SessionMix {
  readonly total: number;
  /** Upper bound on brand-new items, so a session is never all new. */
  readonly maxNew: number;
  /** At most one maintenance item, and only if there is room. */
  readonly maxMaintenance: number;
}

export const DEFAULT_MIX: SessionMix = { total: 12, maxNew: 5, maxMaintenance: 1 };

export interface SessionCandidate<T> {
  readonly item: T;
  readonly progress: ItemProgress;
}

export interface SessionPlan<T> {
  readonly items: readonly SessionCandidate<T>[];
  /** How many came from each bucket — shown to the learner and asserted in tests. */
  readonly composition: Readonly<Record<Bucket, number>>;
}

/**
 * Build one study session.
 *
 * Fills in bucket priority order, capping new items so review work is never
 * crowded out. If the priority buckets cannot fill the session, the remaining
 * slots go to new items — a short session is worse than a slightly new-heavy one.
 */
export function planSession<T>(
  candidates: readonly SessionCandidate<T>[],
  options: { now?: Timestamp; mix?: SessionMix; random?: Random } = {},
): SessionPlan<T> {
  const now = options.now ?? Date.now();
  const mix = options.mix ?? DEFAULT_MIX;
  const random = options.random ?? Math.random;

  const byBucket = new Map<Bucket, SessionCandidate<T>[]>();
  for (const bucket of BUCKET_ORDER) byBucket.set(bucket, []);
  for (const candidate of candidates) {
    byBucket.get(bucketOf(candidate.progress, now))!.push(candidate);
  }
  for (const [bucket, list] of byBucket) {
    list.sort((a, b) => priority(b.progress, now) - priority(a.progress, now));
    byBucket.set(bucket, list);
  }

  const capacity: Record<Bucket, number> = {
    weak: mix.total,
    due: mix.total,
    learning: mix.total,
    fresh: mix.maxNew,
    maintenance: mix.maxMaintenance,
  };

  const chosen: SessionCandidate<T>[] = [];
  const composition: Record<Bucket, number> = {
    weak: 0, due: 0, learning: 0, fresh: 0, maintenance: 0,
  };

  for (const bucket of BUCKET_ORDER) {
    for (const candidate of byBucket.get(bucket)!) {
      if (chosen.length >= mix.total || composition[bucket] >= capacity[bucket]) break;
      chosen.push(candidate);
      composition[bucket] += 1;
    }
  }

  // Backfill with new items only after every priority bucket has been offered
  // its share, so review work is never displaced by the backfill.
  if (chosen.length < mix.total) {
    const used = new Set(chosen.map((entry) => entry.progress.itemId));
    for (const candidate of byBucket.get('fresh')!) {
      if (chosen.length >= mix.total) break;
      if (used.has(candidate.progress.itemId)) continue;
      chosen.push(candidate);
      composition.fresh += 1;
    }
  }

  // Order within the session is shuffled so the learner does not face a solid
  // block of failures first; the selection above already did the prioritising.
  return { items: shuffle(chosen, random), composition };
}

// --- exercise progression ----------------------------------------------------

/**
 * Exercise forms in increasing difficulty. Recognition first, production last:
 * being shown a word and picking its meaning is a far smaller ask than writing
 * the word from nothing, and the gap is where most apps lose people.
 */
export const EXERCISE_STAGES: readonly ExerciseKind[] = [
  'recognise', 'choice', 'recall', 'typing', 'context',
];

/**
 * Which stage an item has earned, from the scheduler's own confidence.
 *
 * Tied to stability rather than to an attempt count, so an item that lapses
 * drops back to an easier form instead of staying hard and staying failed.
 */
export function stageFor(record: ItemProgress): ExerciseKind {
  if (!record.seen) return 'recognise';
  switch (record.state) {
    case 'new': return 'recognise';
    case 'learning': return record.correctCount > 0 ? 'choice' : 'recognise';
    case 'review': return 'recall';
    case 'strong': return 'typing';
    case 'mastered': return 'context';
    default:
      // Unreachable by the type, reachable at runtime: a record can arrive
      // from a network payload or a parsed key-value store, where the type is
      // a promise nobody checked. Both of those validate now, but this
      // function promises an ExerciseKind and must not be able to return
      // undefined. The easiest form is the safe guess for a state we cannot
      // read.
      return 'recognise';
  }
}

/**
 * The stage, narrowed to the forms this item can actually support.
 *
 * An item with no example sentence cannot host a context exercise, and asking
 * for one anyway is how apps end up showing a blank. Falls back down the ladder,
 * never up, so narrowing can make a question easier but never harder.
 */
export function stageWithin(
  record: ItemProgress,
  available: readonly ExerciseKind[],
): ExerciseKind | null {
  if (available.length === 0) return null;
  const wanted = stageFor(record);
  const ceiling = EXERCISE_STAGES.indexOf(wanted);
  for (let i = ceiling; i >= 0; i -= 1) {
    const kind = EXERCISE_STAGES[i] as ExerciseKind;
    if (available.includes(kind)) return kind;
  }
  return available.find((kind) => !EXERCISE_STAGES.includes(kind)) ?? available[0] ?? null;
}
