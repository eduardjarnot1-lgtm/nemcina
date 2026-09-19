/**
 * Spaced repetition — FSRS-5.
 *
 * Ported from `app/src/srs.js` with the behaviour preserved and the types made
 * explicit. An item carries two numbers instead of one ease factor:
 *
 *   stability  S — days until recall probability falls to the target retention
 *   difficulty D — 1 (easy) to 10 (hard), how much a review moves stability
 *
 * Retrievability is not stored. It is computed from elapsed time, so an item
 * left alone for a month is correctly treated as shakier than the same item
 * seen yesterday. That is the whole reason FSRS beats SM-2 here: SM-2
 * multiplies a fixed interval and has no notion of how faded a memory is when
 * the learner finally comes back.
 *
 * The published FSRS-5 default parameters are used as they are. One learner's
 * history is nowhere near enough data to refit them, so nothing pretends to.
 *
 * Pure functions: no storage, no clock of their own, no DOM. `now` is always a
 * parameter so tests can control time instead of sleeping.
 *
 * Reference: the FSRS papers and the reference implementations at
 * github.com/open-spaced-repetition. Reimplemented rather than installed —
 * `ts-fsrs` would be a dependency for ~80 lines of arithmetic.
 */

import { GRADE, type Grade, type ItemProgress, type MasteryState, type Timestamp } from './types.ts';

export const DAY = 86_400_000;

/** FSRS-5 default weights, w[0]..w[18]. */
const W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
  0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
] as const;

const DECAY = -0.5;
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1; // = 19/81

/** Recall probability we schedule for. 0.9 is the FSRS default. */
export const DEFAULT_RETENTION = 0.9;

const MIN_STABILITY = 0.01;
const MAX_STABILITY = 36_500;
const MAX_INTERVAL = 365 * DAY;

/**
 * Learning steps for the minutes after a lapse. FSRS schedules the long tail;
 * it does not claim to schedule the next ten minutes. Anki draws the same line.
 */
const AGAIN_STEP = 10 * 60_000;
const HARD_STEP = 60 * 60_000;

/** Stability thresholds, in days, at which an item changes state. */
const STRONG_STABILITY = 7;
const MASTERED_STABILITY = 60;

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

const w = (index: number): number => W[index] as number;

// --- the model ---------------------------------------------------------------

/** Recall probability after `days` days at this stability. */
export function retrievability(stability: number, days: number): number {
  if (!(stability > 0) || days <= 0) return 1;
  return Math.pow(1 + FACTOR * (days / stability), DECAY);
}

/** Days until recall probability falls to `retention`. */
export function intervalDays(stability: number, retention = DEFAULT_RETENTION): number {
  return (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
}

const initialStability = (grade: Grade): number =>
  clamp(w(grade - 1), MIN_STABILITY, MAX_STABILITY);

const initialDifficulty = (grade: Grade): number =>
  clamp(w(4) - Math.exp(w(5) * (grade - 1)) + 1, 1, 10);

function nextDifficulty(difficulty: number, grade: Grade): number {
  const delta = -w(6) * (grade - 3);
  const damped = difficulty + delta * ((10 - difficulty) / 9);
  const reverted = w(7) * initialDifficulty(GRADE.EASY) + (1 - w(7)) * damped;
  return clamp(reverted, 1, 10);
}

function stabilityOnRecall(
  difficulty: number, stability: number, recall: number, grade: Grade,
): number {
  const hard = grade === GRADE.HARD ? w(15) : 1;
  const easy = grade === GRADE.EASY ? w(16) : 1;
  const growth = Math.exp(w(8)) * (11 - difficulty) * Math.pow(stability, -w(9))
    * (Math.exp(w(10) * (1 - recall)) - 1) * hard * easy;
  return clamp(stability * (1 + growth), MIN_STABILITY, MAX_STABILITY);
}

function stabilityOnLapse(difficulty: number, stability: number, recall: number): number {
  const longTerm = w(11) * Math.pow(difficulty, -w(12))
    * (Math.pow(stability + 1, w(13)) - 1) * Math.exp(w(14) * (1 - recall));
  const shortTerm = stability / Math.exp(w(17) * w(18));
  return clamp(Math.min(longTerm, shortTerm), MIN_STABILITY, MAX_STABILITY);
}

/** Same-day repeat: the long-term formulas do not apply within a day. */
function shortTermStability(stability: number, grade: Grade): number {
  return clamp(stability * Math.exp(w(17) * (grade - 3 + w(18))), MIN_STABILITY, MAX_STABILITY);
}

// --- records -----------------------------------------------------------------

export function newProgress(userId: string, itemId: string): ItemProgress {
  return {
    userId, itemId,
    state: 'new',
    seen: false,
    correctCount: 0,
    incorrectCount: 0,
    repetitionCount: 0,
    lastReviewed: 0,
    dueAt: 0,
    difficulty: 5,
    stability: 0,
  };
}

/**
 * State from the scheduler's own confidence rather than an attempt counter.
 *
 * "Mastered" means the scheduler will leave the item alone for two months, not
 * that the learner got it right three times. A lapse drops it back, because the
 * stability drops.
 */
function stateFor(stability: number, correct: boolean): MasteryState {
  if (!correct) return 'learning';
  if (stability >= MASTERED_STABILITY) return 'mastered';
  if (stability >= STRONG_STABILITY) return 'strong';
  return 'review';
}

export interface ReviewOptions {
  readonly now?: Timestamp;
  readonly retention?: number;
}

/**
 * Apply one answer.
 *
 * `grade` is inferred from the answer by the caller — see `grading.ts`. The
 * learner is never asked to rate their own recall, because self-rating is
 * exactly the step users skip.
 */
export function review(record: ItemProgress, grade: Grade, options: ReviewOptions = {}): ItemProgress {
  const now = options.now ?? Date.now();
  const retention = options.retention ?? DEFAULT_RETENTION;
  const correct = grade > GRADE.AGAIN;

  const elapsedDays = record.seen && record.lastReviewed
    ? (now - record.lastReviewed) / DAY
    : 0;

  let stability: number;
  let difficulty: number;

  if (!record.seen || !(record.stability > 0)) {
    stability = initialStability(grade);
    difficulty = initialDifficulty(grade);
  } else {
    const recall = retrievability(record.stability, elapsedDays);
    difficulty = nextDifficulty(record.difficulty, grade);
    if (elapsedDays < 1) {
      stability = shortTermStability(record.stability, grade);
    } else if (correct) {
      stability = stabilityOnRecall(record.difficulty, record.stability, recall, grade);
    } else {
      stability = stabilityOnLapse(record.difficulty, record.stability, recall);
    }
  }

  let dueAt: Timestamp;
  if (grade === GRADE.AGAIN) {
    dueAt = now + AGAIN_STEP;
  } else if (grade === GRADE.HARD && stability < 1) {
    dueAt = now + HARD_STEP;
  } else {
    dueAt = now + clamp(intervalDays(stability, retention) * DAY, DAY, MAX_INTERVAL);
  }

  return {
    ...record,
    seen: true,
    lastReviewed: now,
    correctCount: record.correctCount + (correct ? 1 : 0),
    incorrectCount: record.incorrectCount + (correct ? 0 : 1),
    repetitionCount: correct ? record.repetitionCount + 1 : 0,
    stability,
    difficulty,
    dueAt,
    state: stateFor(stability, correct),
  };
}

/** Is this item due now? Unseen items are not "due" — they are new. */
export const isDue = (record: ItemProgress, now: Timestamp = Date.now()): boolean =>
  record.seen && record.dueAt > 0 && record.dueAt <= now;

/** How overdue, in days. Negative means not yet due. */
export const overdueDays = (record: ItemProgress, now: Timestamp = Date.now()): number =>
  record.dueAt ? (now - record.dueAt) / DAY : (record.seen ? 0 : -1);

/** Current recall probability, 0–1. Zero for an item never seen. */
export function currentRecall(record: ItemProgress, now: Timestamp = Date.now()): number {
  if (!record.seen || !(record.stability > 0)) return 0;
  return retrievability(record.stability, (now - record.lastReviewed) / DAY);
}
