/**
 * A study session, from first question to summary.
 *
 * This exists so that "what happens when the learner answers" is written once
 * and tested without a screen. The UI's whole job becomes: render
 * `session.current`, call `session.answer(text)`, persist what comes back.
 *
 * Two behaviours here are what separate a session that teaches from a quiz that
 * merely scores:
 *
 *   - A wrong answer comes back later in the same session. Being told "no" and
 *     never seeing the word again teaches nothing; the scheduler will bring it
 *     back tomorrow, but the learner should get it right today.
 *   - The grade comes from the answer, not from the learner's opinion of it.
 *
 * The session never touches storage. It returns the updated record and the
 * attempt, and the caller persists them — so a crash mid-session loses at most
 * the current question, and the same code works against `localStorage`,
 * AsyncStorage or an API.
 */

import { checkAnswer, gradeFor, type Verdict } from './answers.ts';
import { availableKinds, buildQuestion, type Question } from './exercises.ts';
import { DEFAULT_MIX, planSession, stageWithin, type Random, type SessionMix } from './selection.ts';
import { newProgress, review } from './srs.ts';
import type { AttemptRecord, Grade, ItemProgress, Timestamp, VocabularyItem } from './types.ts';

export interface SessionOptions {
  readonly now?: Timestamp;
  readonly mix?: SessionMix;
  readonly random?: Random;
  /** Items the distractors come from. Defaults to everything offered. */
  readonly pool?: readonly VocabularyItem[];
  /** How many times one item may be re-asked after a wrong answer. */
  readonly maxRetries?: number;
}

export interface AnswerOutcome {
  readonly verdict: Verdict;
  readonly grade: Grade;
  /** Persist this. The session holds it in memory but owns no storage. */
  readonly progress: ItemProgress;
  readonly attempt: AttemptRecord;
  /** The item will be asked again before the session ends. */
  readonly willRepeat: boolean;
  readonly finished: boolean;
}

export interface SessionSummary {
  readonly asked: number;
  readonly correct: number;
  readonly incorrect: number;
  /** Correct on the first attempt, divided by the items studied. The honest one. */
  readonly accuracy: number;
  readonly itemsStudied: number;
  readonly durationMs: number;
}

interface Slot {
  readonly item: VocabularyItem;
  readonly question: Question;
  readonly retry: boolean;
}

export class StudySession {
  readonly userId: string;
  readonly #queue: Slot[] = [];
  readonly #progress = new Map<string, ItemProgress>();
  readonly #pool: readonly VocabularyItem[];
  readonly #random: Random;
  readonly #maxRetries: number;
  readonly #retriesUsed = new Map<string, number>();
  readonly #firstAttemptCorrect = new Map<string, boolean>();
  readonly startedAt: Timestamp;

  #cursor = 0;
  #asked = 0;
  #correct = 0;
  #lastAnswerAt: Timestamp;

  private constructor(
    userId: string,
    slots: readonly Slot[],
    progress: ReadonlyMap<string, ItemProgress>,
    pool: readonly VocabularyItem[],
    random: Random,
    maxRetries: number,
    now: Timestamp,
  ) {
    this.userId = userId;
    this.#queue = slots.slice();
    for (const [id, record] of progress) this.#progress.set(id, record);
    this.#pool = pool;
    this.#random = random;
    this.#maxRetries = maxRetries;
    this.startedAt = now;
    this.#lastAnswerAt = now;
  }

  /**
   * Plan a session over the items offered.
   *
   * Selection decides *which* items (see `selection.ts`); this then asks each
   * one at the form it has earned, narrowed to the forms it can actually
   * support — an item with no example never produces a context question.
   */
  static plan(
    userId: string,
    items: readonly VocabularyItem[],
    progress: ReadonlyMap<string, ItemProgress>,
    options: SessionOptions = {},
  ): StudySession {
    const now = options.now ?? Date.now();
    const random = options.random ?? Math.random;
    const pool = options.pool ?? items;

    const candidates = items.map((item) => ({
      item,
      progress: progress.get(item.id) ?? newProgress(userId, item.id),
    }));
    const plan = planSession(candidates, {
      now,
      mix: options.mix ?? DEFAULT_MIX,
      random,
    });

    const slots = plan.items.map(({ item, progress: record }) => {
      const kind = stageWithin(record, availableKinds(item, pool.length)) ?? 'typing';
      return {
        item,
        question: buildQuestion(item, kind, { pool, random }),
        retry: false,
      };
    });

    const known = new Map<string, ItemProgress>();
    for (const { item, progress: record } of candidates) known.set(item.id, record);

    return new StudySession(userId, slots, known, pool, random, options.maxRetries ?? 1, now);
  }

  /** The question on screen, or null when the session is over. */
  get current(): Question | null {
    return this.#queue[this.#cursor]?.question ?? null;
  }

  /** The item behind the current question, for showing extra detail. */
  get currentItem(): VocabularyItem | null {
    return this.#queue[this.#cursor]?.item ?? null;
  }

  /** 0–1, for a progress bar. Retries extend the queue, so it can move backwards. */
  get position(): { readonly index: number; readonly total: number } {
    return { index: Math.min(this.#cursor, this.#queue.length), total: this.#queue.length };
  }

  get finished(): boolean {
    return this.#cursor >= this.#queue.length;
  }

  /** The progress records this session has changed, for persisting in bulk. */
  get changed(): readonly ItemProgress[] {
    return [...this.#progress.values()].filter((record) => record.lastReviewed >= this.startedAt);
  }

  /**
   * Answer the current question.
   *
   * `hintShown` matters: an answer produced with the first letter on screen is
   * not the same evidence as one produced from nothing, and the grade reflects
   * that rather than pretending both were Easy.
   */
  answer(given: string, options: { hintShown?: boolean; now?: Timestamp } = {}): AnswerOutcome {
    const slot = this.#queue[this.#cursor];
    if (!slot) throw new Error('the session has no current question');

    const now = options.now ?? Date.now();
    const question = slot.question;
    const verdict = checkAnswer(given, question.answers, {
      language: slot.item.language,
      // On a recall question the article is not what is being asked for.
      allowMissingArticle: question.kind === 'recall',
    });
    const grade = gradeFor(verdict, {
      kind: question.kind,
      hintShown: options.hintShown === true,
      producedTargetLanguage: question.producedTargetLanguage,
    });

    const before = this.#progress.get(slot.item.id) ?? newProgress(this.userId, slot.item.id);
    const after = review(before, grade, { now });
    this.#progress.set(slot.item.id, after);

    if (!this.#firstAttemptCorrect.has(slot.item.id)) {
      this.#firstAttemptCorrect.set(slot.item.id, verdict.correct);
    }
    this.#asked += 1;
    if (verdict.correct) this.#correct += 1;
    this.#lastAnswerAt = now;

    const attempt: AttemptRecord = {
      userId: this.userId,
      itemId: slot.item.id,
      at: now,
      correct: verdict.correct,
      grade,
      given,
      expected: verdict.matched,
      exerciseKind: question.kind,
    };

    const willRepeat = !verdict.correct && this.#scheduleRetry(slot);
    this.#cursor += 1;

    return { verdict, grade, progress: after, attempt, willRepeat, finished: this.finished };
  }

  /**
   * Put a failed item back at the end of the queue, once.
   *
   * Re-asked one rung easier: someone who could not type it is not helped by
   * being asked to type it again thirty seconds later.
   */
  #scheduleRetry(slot: Slot): boolean {
    const used = this.#retriesUsed.get(slot.item.id) ?? 0;
    if (used >= this.#maxRetries) return false;
    this.#retriesUsed.set(slot.item.id, used + 1);

    const easier = slot.question.kind === 'choice' || slot.question.kind === 'recognise'
      ? 'recognise'
      : 'choice';
    const kinds = availableKinds(slot.item, this.#pool.length);
    const kind = kinds.includes(easier) ? easier : 'recall';

    this.#queue.push({
      item: slot.item,
      question: buildQuestion(slot.item, kind, { pool: this.#pool, random: this.#random }),
      retry: true,
    });
    return true;
  }

  /** Skip without answering. Counts as neither right nor wrong, and does not reschedule. */
  skip(): void {
    if (!this.finished) this.#cursor += 1;
  }

  get summary(): SessionSummary {
    const studied = this.#firstAttemptCorrect.size;
    const firstTime = [...this.#firstAttemptCorrect.values()].filter(Boolean).length;
    return {
      asked: this.#asked,
      correct: this.#correct,
      incorrect: this.#asked - this.#correct,
      // Measured on first attempts only: counting the retry the learner has just
      // been shown the answer to would flatter every session to near 100 %.
      accuracy: studied === 0 ? 0 : firstTime / studied,
      itemsStudied: studied,
      durationMs: Math.max(0, this.#lastAnswerAt - this.startedAt),
    };
  }
}
