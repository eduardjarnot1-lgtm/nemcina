/**
 * Experience, levels and achievements.
 *
 * Gamification earns its place only if it is honest. A badge for something the
 * learner did not do is worth less than no badge, because it tells them the
 * whole scoreboard is decoration — and once they think that, the streak and the
 * level stop working too.
 *
 * So everything here is a pure function of records the learner produced. XP
 * comes from the attempt log, which is append-only; a level is arithmetic on
 * XP; an achievement is a predicate over real counts, and every one of them
 * reports how far along it is rather than flicking from invisible to earned.
 *
 * The client cannot inflate any of it in a way that survives: the same attempts
 * on another device produce the same numbers, and a server holding the same log
 * computes the same answer.
 */

import type { AttemptRecord, ExerciseKind } from './types.ts';
import type { CoachEvidence } from './coach.ts';

// --- experience ---------------------------------------------------------------

/**
 * What an answer is worth.
 *
 * Producing the word is worth more than recognising it, because it is harder
 * and it is the thing the learner actually wants to be able to do. A wrong
 * answer earns nothing and costs nothing: charging for mistakes would make the
 * scoreboard something to protect rather than something to grow, and people
 * protect a score by not practising.
 */
const XP_BY_KIND: Readonly<Record<ExerciseKind, number>> = {
  recognise: 1,
  choice: 1,
  recall: 2,
  typing: 3,
  context: 3,
  transform: 2,
  reorder: 2,
  'error-correction': 2,
};

export const xpFor = (attempt: AttemptRecord): number =>
  attempt.correct ? XP_BY_KIND[attempt.exerciseKind] ?? 1 : 0;

/**
 * Total XP from an attempt log.
 *
 * Only the first correct answer for an item on a given day counts. Without that
 * an afternoon of re-answering the same word would out-earn a week of real
 * study, and the fastest way to a high level would be to learn nothing.
 */
export function totalXp(attempts: Iterable<AttemptRecord>, offsetMinutes = 0): number {
  const counted = new Set<string>();
  let total = 0;
  for (const attempt of attempts) {
    if (!attempt.correct) continue;
    const day = Math.floor((attempt.at - offsetMinutes * 60_000) / 86_400_000);
    const key = `${attempt.itemId}:${day}`;
    if (counted.has(key)) continue;
    counted.add(key);
    total += xpFor(attempt);
  }
  return total;
}

export interface Level {
  readonly level: number;
  readonly xp: number;
  /** XP earned since this level began. */
  readonly into: number;
  /** XP needed from the start of this level to reach the next. */
  readonly span: number;
  /** 0–1 through the current level. */
  readonly progress: number;
}

/**
 * XP needed to go from level `n` to `n + 1`.
 *
 * Rising, but gently: a curve that doubles each level makes level 12 a wall and
 * every level after it a rumour. This one keeps a level roughly a few sessions
 * long for a long time.
 */
export const spanOf = (level: number): number => 100 + 50 * (level - 1);

export function levelFor(xp: number): Level {
  const total = Math.max(0, Math.floor(xp));
  let level = 1;
  let consumed = 0;
  while (consumed + spanOf(level) <= total) {
    consumed += spanOf(level);
    level += 1;
  }
  const span = spanOf(level);
  const into = total - consumed;
  return { level, xp: total, into, span, progress: span === 0 ? 0 : into / span };
}

// --- achievements -------------------------------------------------------------

export type AchievementId =
  | 'first-word'
  | 'words-50'
  | 'words-250'
  | 'words-1000'
  | 'mastered-50'
  | 'streak-3'
  | 'streak-7'
  | 'streak-30'
  | 'grammar-started'
  | 'accuracy-90'
  | 'level-5'
  | 'level-10';

export interface Achievement {
  readonly id: AchievementId;
  /** How far along, in the same unit as `target`. Never above `target`. */
  readonly progress: number;
  readonly target: number;
  readonly earned: boolean;
}

/** Attempts needed before an accuracy figure is allowed to earn anything. */
const ACCURACY_EVIDENCE = 50;

interface Measure {
  readonly id: AchievementId;
  readonly target: number;
  readonly of: (evidence: CoachEvidence, level: Level) => number;
}

const MEASURES: readonly Measure[] = [
  { id: 'first-word', target: 1, of: (e) => e.vocabulary.learned },
  { id: 'words-50', target: 50, of: (e) => e.vocabulary.learned },
  { id: 'words-250', target: 250, of: (e) => e.vocabulary.learned },
  { id: 'words-1000', target: 1000, of: (e) => e.vocabulary.learned },
  { id: 'mastered-50', target: 50, of: (e) => e.vocabulary.mastered },
  // The longest streak, not the current one: an achievement that can be taken
  // away by one missed Tuesday is a punishment wearing a medal.
  { id: 'streak-3', target: 3, of: (e) => e.streak.longest },
  { id: 'streak-7', target: 7, of: (e) => e.streak.longest },
  { id: 'streak-30', target: 30, of: (e) => e.streak.longest },
  { id: 'grammar-started', target: 1, of: (e) => e.grammar.exercisesLearned },
  {
    id: 'accuracy-90',
    target: 90,
    // Worth nothing until there are enough answers for 90 % to mean anything;
    // three right out of three is not accuracy.
    of: (e) => (e.attemptsConsidered >= ACCURACY_EVIDENCE && e.recentAccuracy !== null
      ? Math.round(e.recentAccuracy * 100)
      : 0),
  },
  { id: 'level-5', target: 5, of: (_, level) => level.level },
  { id: 'level-10', target: 10, of: (_, level) => level.level },
];

/**
 * Every achievement, earned or not, with how far along it is.
 *
 * Returning the unearned ones too is the point: "38 of 50" is an invitation and
 * a locked icon is a shrug.
 */
export function achievements(evidence: CoachEvidence, level: Level): readonly Achievement[] {
  return MEASURES.map((measure) => {
    const raw = measure.of(evidence, level);
    const progress = Math.max(0, Math.min(raw, measure.target));
    return { id: measure.id, progress, target: measure.target, earned: raw >= measure.target };
  });
}

export const earned = (list: readonly Achievement[]): readonly Achievement[] =>
  list.filter((entry) => entry.earned);
