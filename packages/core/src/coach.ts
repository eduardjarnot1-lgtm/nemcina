/**
 * The learning coach's evidence.
 *
 * Everything a coach says has to be computed from records the learner actually
 * produced. "I see you've mastered travel vocabulary" is worse than useless when
 * it is not true — it tells the learner the app is not really looking, and once
 * they know that, nothing it says later counts either.
 *
 * So this module is the whole factual basis. It reads progress and attempts and
 * produces a structure of numbers and item ids: no prose, no advice phrased for
 * a screen, nothing a language model contributed. Anything downstream — the
 * deterministic advice below, or a model asked to phrase it — may only work
 * from what is here, and may not add to it.
 */

import { isDue, overdueDays } from './srs.ts';
import { streak } from './stats.ts';
import type {
  AttemptRecord, CefrLevel, GrammarTopic, ItemProgress, Timestamp, VocabularyItem,
} from './types.ts';

export interface WeakItem {
  readonly itemId: string;
  readonly term: string;
  readonly translation: string;
  readonly incorrect: number;
  readonly correct: number;
  /** 0–1. Low means the learner keeps getting it wrong. */
  readonly accuracy: number;
}

export interface CategoryStanding {
  readonly category: string;
  readonly total: number;
  readonly seen: number;
  readonly learned: number;
}

export interface CoachEvidence {
  readonly at: Timestamp;
  /** Every count here is over items the learner has actually answered. */
  readonly vocabulary: {
    readonly total: number;
    readonly seen: number;
    readonly learned: number;
    readonly mastered: number;
    readonly due: number;
    readonly weak: number;
  };
  readonly grammar: {
    readonly topics: number;
    readonly exercisesSeen: number;
    readonly exercisesLearned: number;
  };
  readonly streak: { readonly current: number; readonly longest: number; readonly activeToday: boolean };
  /** First-attempt accuracy over the recent attempts supplied. Null when there are none. */
  readonly recentAccuracy: number | null;
  readonly attemptsConsidered: number;
  /** The most-failed items, worst first. Empty when nothing has been failed. */
  readonly weakest: readonly WeakItem[];
  /** The most overdue items, in days. */
  readonly mostOverdue: readonly { readonly itemId: string; readonly term: string; readonly days: number }[];
  readonly byLevel: Readonly<Partial<Record<CefrLevel, { seen: number; learned: number; total: number }>>>;
  readonly categories: readonly CategoryStanding[];
  /**
   * True when there is nothing at all to go on.
   *
   * Answers count as evidence even where no progress record survives them — a
   * learner who has answered a dozen questions has not "done nothing", and
   * telling them so is exactly the kind of claim this module exists to prevent.
   */
  readonly empty: boolean;
}

export interface EvidenceInput {
  readonly items: readonly VocabularyItem[];
  readonly topics?: readonly GrammarTopic[];
  readonly progress: ReadonlyMap<string, ItemProgress>;
  readonly attempts?: readonly AttemptRecord[];
  readonly now?: Timestamp;
  /** How many weak items and overdue items to name. */
  readonly limit?: number;
  readonly offsetMinutes?: number;
}

const learned = (record: ItemProgress): boolean =>
  record.state === 'review' || record.state === 'strong' || record.state === 'mastered';

/**
 * Build the evidence.
 *
 * Deterministic and pure: the same records at the same instant always produce
 * the same structure, so what a coach said can be reproduced afterwards.
 */
export function buildEvidence(input: EvidenceInput): CoachEvidence {
  const now = input.now ?? Date.now();
  const limit = input.limit ?? 5;
  const progress = input.progress;

  const vocabulary = { total: input.items.length, seen: 0, learned: 0, mastered: 0, due: 0, weak: 0 };
  const byLevel: Partial<Record<CefrLevel, { seen: number; learned: number; total: number }>> = {};
  const categories = new Map<string, { total: number; seen: number; learned: number }>();
  const weak: WeakItem[] = [];
  const overdue: { itemId: string; term: string; days: number }[] = [];

  for (const item of input.items) {
    if (item.level) {
      const level = byLevel[item.level] ?? { seen: 0, learned: 0, total: 0 };
      level.total += 1;
      byLevel[item.level] = level;
    }
    for (const category of item.categories) {
      const standing = categories.get(category) ?? { total: 0, seen: 0, learned: 0 };
      standing.total += 1;
      categories.set(category, standing);
    }

    const record = progress.get(item.id);
    if (!record?.seen) continue;

    vocabulary.seen += 1;
    const known = learned(record);
    if (known) vocabulary.learned += 1;
    if (record.state === 'mastered') vocabulary.mastered += 1;
    if (isDue(record, now)) {
      vocabulary.due += 1;
      overdue.push({ itemId: item.id, term: item.term, days: Math.floor(overdueDays(record, now)) });
    }

    if (item.level) {
      const level = byLevel[item.level] as { seen: number; learned: number; total: number };
      level.seen += 1;
      if (known) level.learned += 1;
    }
    for (const category of item.categories) {
      const standing = categories.get(category) as { total: number; seen: number; learned: number };
      standing.seen += 1;
      if (known) standing.learned += 1;
    }

    const attempts = record.correctCount + record.incorrectCount;
    // "Weak" means the learner has genuinely been getting it wrong, not that
    // they missed it once on first contact.
    if (record.incorrectCount >= 2 && record.incorrectCount >= record.correctCount) {
      vocabulary.weak += 1;
      weak.push({
        itemId: item.id,
        term: item.term,
        translation: item.translation,
        incorrect: record.incorrectCount,
        correct: record.correctCount,
        accuracy: attempts === 0 ? 0 : record.correctCount / attempts,
      });
    }
  }

  const topics = input.topics ?? [];
  const grammar = { topics: topics.length, exercisesSeen: 0, exercisesLearned: 0 };
  for (const topic of topics) {
    for (const exercise of topic.exercises) {
      const record = progress.get(exercise.id);
      if (!record?.seen) continue;
      grammar.exercisesSeen += 1;
      if (learned(record)) grammar.exercisesLearned += 1;
    }
  }

  const attempts = input.attempts ?? [];
  // First attempt per item only: counting a retry the learner has just been
  // shown the answer to would make every week look like a good one.
  const firstAttempt = new Map<string, boolean>();
  for (const attempt of [...attempts].sort((a, b) => a.at - b.at)) {
    if (!firstAttempt.has(attempt.itemId)) firstAttempt.set(attempt.itemId, attempt.correct);
  }
  const considered = firstAttempt.size;
  const rightFirstTime = [...firstAttempt.values()].filter(Boolean).length;

  weak.sort((a, b) => a.accuracy - b.accuracy || b.incorrect - a.incorrect
    || (a.itemId < b.itemId ? -1 : 1));
  overdue.sort((a, b) => b.days - a.days || (a.itemId < b.itemId ? -1 : 1));

  return {
    at: now,
    vocabulary,
    grammar,
    streak: streak(attempts, { now, offsetMinutes: input.offsetMinutes ?? 0 }),
    recentAccuracy: considered === 0 ? null : rightFirstTime / considered,
    attemptsConsidered: considered,
    weakest: weak.slice(0, limit),
    mostOverdue: overdue.slice(0, limit),
    byLevel,
    categories: [...categories.entries()]
      .map(([category, standing]) => ({ category, ...standing }))
      .sort((a, b) => (a.category < b.category ? -1 : 1)),
    empty: vocabulary.seen === 0 && grammar.exercisesSeen === 0 && considered === 0,
  };
}

// --- deterministic advice -----------------------------------------------------

/**
 * The advice a learner gets with no model involved at all.
 *
 * Each one carries the numbers it was derived from, so a screen can show the
 * reason next to the suggestion and a model asked to phrase it has nothing to
 * invent. Ordered by what would help most right now.
 */
export type AdviceKind =
  | 'nothing-yet'
  | 'reviews-due'
  | 'weak-items'
  | 'keep-streak'
  | 'accuracy-low'
  | 'accuracy-high'
  | 'new-material'
  | 'grammar-untouched';

export interface Advice {
  readonly kind: AdviceKind;
  /** Higher comes first. */
  readonly weight: number;
  /** The facts behind it. Never prose. */
  readonly facts: Readonly<Record<string, number | string>>;
  /** Item ids the advice is about, where it is about specific items. */
  readonly itemIds: readonly string[];
}

/** How far below this counts as struggling rather than learning. */
const LOW_ACCURACY = 0.6;
const HIGH_ACCURACY = 0.9;
/** Enough answers for accuracy to mean anything at all. */
const ENOUGH_FOR_ACCURACY = 10;

export function advise(evidence: CoachEvidence): readonly Advice[] {
  if (evidence.empty) {
    return [{ kind: 'nothing-yet', weight: 100, facts: { total: evidence.vocabulary.total }, itemIds: [] }];
  }

  const advice: Advice[] = [];

  if (evidence.vocabulary.due > 0) {
    advice.push({
      kind: 'reviews-due',
      // Overdue work outranks everything: a backlog is how a spaced-repetition
      // app stops being opened.
      weight: 90 + Math.min(evidence.vocabulary.due, 9),
      facts: {
        due: evidence.vocabulary.due,
        mostOverdueDays: evidence.mostOverdue[0]?.days ?? 0,
      },
      itemIds: evidence.mostOverdue.map((entry) => entry.itemId),
    });
  }

  if (evidence.weakest.length > 0) {
    advice.push({
      kind: 'weak-items',
      weight: 80,
      facts: { weak: evidence.vocabulary.weak, worst: evidence.weakest[0]?.term ?? '' },
      itemIds: evidence.weakest.map((entry) => entry.itemId),
    });
  }

  if (evidence.recentAccuracy !== null && evidence.attemptsConsidered >= ENOUGH_FOR_ACCURACY) {
    if (evidence.recentAccuracy < LOW_ACCURACY) {
      advice.push({
        kind: 'accuracy-low',
        weight: 70,
        facts: {
          accuracy: Math.round(evidence.recentAccuracy * 100),
          considered: evidence.attemptsConsidered,
        },
        itemIds: [],
      });
    } else if (evidence.recentAccuracy >= HIGH_ACCURACY) {
      advice.push({
        kind: 'accuracy-high',
        weight: 40,
        facts: {
          accuracy: Math.round(evidence.recentAccuracy * 100),
          considered: evidence.attemptsConsidered,
        },
        itemIds: [],
      });
    }
  }

  if (evidence.streak.current > 0 && !evidence.streak.activeToday) {
    advice.push({
      kind: 'keep-streak',
      weight: 60,
      facts: { streak: evidence.streak.current },
      itemIds: [],
    });
  }

  if (evidence.grammar.topics > 0 && evidence.grammar.exercisesSeen === 0) {
    advice.push({
      kind: 'grammar-untouched',
      weight: 50,
      facts: { topics: evidence.grammar.topics },
      itemIds: [],
    });
  }

  if (evidence.vocabulary.due === 0 && evidence.vocabulary.weak === 0) {
    advice.push({
      kind: 'new-material',
      weight: 30,
      facts: {
        learned: evidence.vocabulary.learned,
        remaining: evidence.vocabulary.total - evidence.vocabulary.seen,
      },
      itemIds: [],
    });
  }

  return advice.sort((a, b) => b.weight - a.weight || (a.kind < b.kind ? -1 : 1));
}
