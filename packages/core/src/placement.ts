/**
 * Placing a new learner.
 *
 * Without this, everyone starts at lesson one of A1. Someone with two years of
 * school German spends their first week on *ich*, *und*, *nicht* and leaves,
 * and a true beginner would have been fine either way — so the cost of not
 * asking falls entirely on the people most worth keeping.
 *
 * The test is adaptive and short. It walks a ladder of levels in blocks, moving
 * up on a clear pass and down on a clear fail, and stops as soon as the answer
 * is bracketed rather than grinding through every level for completeness.
 *
 * What it deliberately does NOT do is fabricate progress. A learner placed at
 * B1 has not studied the A1 and A2 words, and writing review records for items
 * they were never asked about would be inventing evidence the scheduler then
 * treats as real. The result chooses where lessons *start*; only the items
 * actually answered get a progress record, and those are honest.
 */

import { buildQuestion, type Question } from './exercises.ts';
import { checkAnswer } from './answers.ts';
import { shuffle, type Random } from './selection.ts';
import { CEFR_LEVELS, type CefrLevel, type VocabularyItem } from './types.ts';

/** Levels the test can place into. C1 and C2 have no vocabulary to ask about. */
export const PLACEMENT_LEVELS: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2'];

/** Questions asked before deciding about one level. */
export const BLOCK_SIZE = 5;
/** ≥ this many correct in a block means the level is comfortably known. */
const PASS = 4;
/** ≤ this many means it is clearly too hard. */
const FAIL = 1;
/** A hard stop, so the test cannot become a chore. */
export const MAX_QUESTIONS = 20;

export interface PlacementResult {
  readonly level: CefrLevel;
  /**
   * `bracketed` — a level was passed and the next one failed, so the answer is
   * pinned from both sides. `partial` — the test stopped on a borderline block.
   * `exhausted` — it ran out of questions or of content and had to guess.
   */
  readonly confidence: 'bracketed' | 'partial' | 'exhausted';
  readonly asked: number;
  readonly correct: number;
  /** Correct answers per level, for showing the learner what happened. */
  readonly byLevel: Readonly<Partial<Record<CefrLevel, { asked: number; correct: number }>>>;
}

export interface PlacementOptions {
  readonly random?: Random;
  /** Where to begin. The middle of the ladder costs the fewest questions. */
  readonly startLevel?: CefrLevel;
  readonly maxQuestions?: number;
}

interface Asked {
  readonly item: VocabularyItem;
  readonly question: Question;
  readonly level: CefrLevel;
}

/**
 * An adaptive placement test.
 *
 * Questions are recognition only — four meanings, pick one. Production would
 * measure spelling as much as knowledge, and someone who reads German well but
 * writes it badly should still be placed by what they can read.
 */
export class PlacementTest {
  readonly #byLevel: Map<CefrLevel, VocabularyItem[]>;
  readonly #random: Random;
  readonly #maxQuestions: number;
  readonly #used = new Set<string>();

  #levelIndex: number;
  #block: Asked[] = [];
  #blockCorrect = 0;
  #current: Asked | null = null;

  #asked = 0;
  #correct = 0;
  /** The highest level answered comfortably (>= PASS in a block). */
  #passed: CefrLevel | null = null;
  /** A level answered clearly badly (<= FAIL). */
  #failed: CefrLevel | null = null;
  /** A level answered half-well. If one exists, it is the answer. */
  #borderline: CefrLevel | null = null;
  #outcome: PlacementResult | null = null;
  readonly #tally = new Map<CefrLevel, { asked: number; correct: number }>();

  private constructor(
    byLevel: Map<CefrLevel, VocabularyItem[]>,
    options: PlacementOptions,
  ) {
    this.#byLevel = byLevel;
    this.#random = options.random ?? Math.random;
    this.#maxQuestions = options.maxQuestions ?? MAX_QUESTIONS;
    const start = options.startLevel ?? 'A2';
    this.#levelIndex = Math.max(0, PLACEMENT_LEVELS.indexOf(start));
    this.#advance();
  }

  /**
   * Build a test from the course's vocabulary.
   *
   * Only levelled items with a translation can be asked, and each level needs
   * enough of them to fill a block with distractors. A level that cannot supply
   * that is skipped rather than asked about badly.
   */
  static create(items: readonly VocabularyItem[], options: PlacementOptions = {}): PlacementTest {
    const random = options.random ?? Math.random;
    const byLevel = new Map<CefrLevel, VocabularyItem[]>();
    for (const level of PLACEMENT_LEVELS) {
      const pool = items.filter((item) =>
        item.level === level && item.translation.trim() && item.term.trim());
      if (pool.length >= BLOCK_SIZE + 3) {
        // Common words first is wrong here: a placement test that only asks the
        // thousand commonest words cannot tell A2 from B2. Sample across the
        // whole level instead.
        byLevel.set(level, shuffle(pool, random));
      }
    }
    return new PlacementTest(byLevel, { ...options, random });
  }

  get current(): Question | null {
    return this.#current?.question ?? null;
  }

  get currentLevel(): CefrLevel | null {
    return this.#current?.level ?? null;
  }

  get finished(): boolean {
    return this.#outcome !== null;
  }

  get position(): { readonly index: number; readonly max: number } {
    return { index: this.#asked, max: this.#maxQuestions };
  }

  /** The item behind the current question, so a result screen can show it. */
  get currentItem(): VocabularyItem | null {
    return this.#current?.item ?? null;
  }

  answer(given: string): { readonly correct: boolean; readonly expected: string } {
    const asked = this.#current;
    if (!asked) throw new Error('the placement test has no current question');

    const verdict = checkAnswer(given, asked.question.answers, { language: asked.item.language });
    this.#asked += 1;
    this.#blockCorrect += verdict.correct ? 1 : 0;
    if (verdict.correct) this.#correct += 1;

    const tally = this.#tally.get(asked.level) ?? { asked: 0, correct: 0 };
    tally.asked += 1;
    if (verdict.correct) tally.correct += 1;
    this.#tally.set(asked.level, tally);

    this.#advance();
    return { correct: verdict.correct, expected: asked.question.answers[0] ?? '' };
  }

  get result(): PlacementResult | null {
    return this.#outcome;
  }

  // --- the ladder -------------------------------------------------------------

  #advance(): void {
    if (this.#outcome) return;

    if (this.#block.length > 0) {
      this.#current = this.#block.shift() as Asked;
      return;
    }

    // A block just finished, or none has started.
    if (this.#asked > 0) {
      const level = PLACEMENT_LEVELS[this.#levelIndex] as CefrLevel;
      if (this.#blockCorrect >= PASS) {
        this.#passed = level;
        if (this.#levelIndex >= PLACEMENT_LEVELS.length - 1) return this.#finish('bracketed');
        this.#levelIndex += 1;
      } else if (this.#blockCorrect <= FAIL) {
        this.#failed = level;
        if (this.#levelIndex === 0) return this.#finish(this.#passed ? 'bracketed' : 'partial');
        this.#levelIndex -= 1;
      } else {
        // Half-known: this is exactly where they are, and no further question
        // would say it better.
        this.#borderline = level;
        return this.#finish('partial');
      }
      if (this.#passed && this.#failed) return this.#finish('bracketed');
      if (this.#asked >= this.#maxQuestions) return this.#finish('exhausted');
    }

    const block = this.#fill(PLACEMENT_LEVELS[this.#levelIndex] as CefrLevel);
    if (block.length === 0) return this.#finish('exhausted');
    this.#block = block;
    this.#blockCorrect = 0;
    this.#current = this.#block.shift() as Asked;
  }

  #fill(level: CefrLevel): Asked[] {
    const pool = this.#byLevel.get(level);
    if (!pool) return [];
    const chosen: Asked[] = [];
    for (const item of pool) {
      if (chosen.length >= BLOCK_SIZE) break;
      if (this.#used.has(item.id)) continue;
      this.#used.add(item.id);
      chosen.push({
        item,
        level,
        question: buildQuestion(item, 'recognise', { pool, random: this.#random }),
      });
    }
    return chosen;
  }

  #finish(confidence: PlacementResult['confidence']): void {
    this.#current = null;
    const byLevel: Partial<Record<CefrLevel, { asked: number; correct: number }>> = {};
    for (const [level, tally] of this.#tally) byLevel[level] = { ...tally };
    this.#outcome = {
      level: this.#decide(),
      confidence,
      asked: this.#asked,
      correct: this.#correct,
      byLevel,
    };
  }

  /**
   * Where to start.
   *
   * Three cases, in this order:
   *
   *   1. A level was answered half-well — start there. Half-known is not known,
   *      and it is the most useful place to be.
   *   2. Otherwise a level was answered comfortably — start *above* it, because
   *      re-teaching known words is the boredom this test exists to prevent.
   *   3. Otherwise A1. There is nothing below it, and a true beginner belongs
   *      at the beginning.
   */
  #decide(): CefrLevel {
    if (this.#borderline) return this.#borderline;
    if (!this.#passed) return 'A1';
    const index = PLACEMENT_LEVELS.indexOf(this.#passed);
    return PLACEMENT_LEVELS[Math.min(index + 1, PLACEMENT_LEVELS.length - 1)] as CefrLevel;
  }

}

/** Levels a learner placed here should be offered, hardest-appropriate first. */
export function levelsFrom(level: CefrLevel): readonly CefrLevel[] {
  const index = CEFR_LEVELS.indexOf(level);
  return index < 0 ? CEFR_LEVELS.slice() : CEFR_LEVELS.slice(index);
}
