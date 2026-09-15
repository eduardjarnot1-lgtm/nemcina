/**
 * Practising a grammar topic.
 *
 * Vocabulary and grammar are not the same exercise. A word can be asked in any
 * order and the scheduler decides when; a topic's exercises were written in a
 * sequence that teaches — the third one assumes the first — and shuffling them
 * on a learner's first pass throws that away.
 *
 * So: unseen exercises keep the source's order, and only the ones already
 * answered are reordered by what the scheduler says is most urgent. The same
 * `ProgressStore` and the same FSRS scheduling apply, keyed on the exercise id,
 * so a rule practised once and then forgotten comes back like any other item.
 */

import { checkAnswer, gradeFor, type Verdict } from './answers.ts';
import { priority } from './selection.ts';
import { newProgress, review } from './srs.ts';
import type {
  AttemptRecord, Exercise, ExerciseKind, GrammarTopic, Grade, ItemProgress, Timestamp,
} from './types.ts';

export interface GrammarQuestion {
  readonly exerciseId: string;
  readonly topicId: string;
  readonly kind: ExerciseKind;
  /** What the learner is asked to do, as the source phrases it. */
  readonly prompt: string;
  /** The sentence: with a gap, or the one to transform or correct. */
  readonly text: string;
  /** Choices, or the tokens of a reorder exercise. */
  readonly options: readonly string[];
  readonly answers: readonly string[];
  readonly hint: string;
  /** Shown after answering, right or wrong. This is where the teaching is. */
  readonly explanation: string;
  /** False means written for practice rather than quoted from the source. */
  readonly fromSource: boolean;
}

export function questionFor(topic: GrammarTopic, exercise: Exercise): GrammarQuestion {
  return {
    exerciseId: exercise.id,
    topicId: topic.id,
    kind: exercise.kind,
    prompt: exercise.prompt,
    text: exercise.text,
    options: exercise.options,
    answers: exercise.answers,
    hint: exercise.hint,
    explanation: exercise.explanation,
    fromSource: exercise.fromSource,
  };
}

/**
 * The order to work through a topic's exercises.
 *
 * Unseen ones first, in the order the source wrote them, because that order is
 * a teaching sequence. Everything already attempted follows, most urgent first.
 */
export function practiceOrder(
  exercises: readonly Exercise[],
  progress: ReadonlyMap<string, ItemProgress>,
  now: Timestamp = Date.now(),
): readonly Exercise[] {
  const fresh: Exercise[] = [];
  const seen: Exercise[] = [];
  for (const exercise of exercises) {
    const record = progress.get(exercise.id);
    (record?.seen ? seen : fresh).push(exercise);
  }
  seen.sort((a, b) =>
    priority(progress.get(b.id) as ItemProgress, now) - priority(progress.get(a.id) as ItemProgress, now));
  return [...fresh, ...seen];
}

export interface GrammarOutcome {
  readonly verdict: Verdict;
  readonly grade: Grade;
  readonly progress: ItemProgress;
  readonly attempt: AttemptRecord;
  readonly explanation: string;
  readonly finished: boolean;
}

export interface GrammarSummary {
  readonly asked: number;
  readonly correct: number;
  readonly accuracy: number;
  readonly total: number;
}

/**
 * One pass through a topic's exercises.
 *
 * No retry queue, unlike a vocabulary session. A grammar exercise has one right
 * answer and an explanation attached; re-asking the same sentence a minute after
 * showing the answer measures memory of the screen, not of the rule. The
 * scheduler brings it back tomorrow instead.
 */
export class GrammarPractice {
  readonly userId: string;
  readonly topicId: string;
  readonly #queue: readonly GrammarQuestion[];
  readonly #progress = new Map<string, ItemProgress>();
  #cursor = 0;
  #correct = 0;
  #asked = 0;

  private constructor(
    userId: string,
    topicId: string,
    queue: readonly GrammarQuestion[],
    progress: ReadonlyMap<string, ItemProgress>,
  ) {
    this.userId = userId;
    this.topicId = topicId;
    this.#queue = queue;
    for (const [id, record] of progress) this.#progress.set(id, record);
  }

  static forTopic(
    userId: string,
    topic: GrammarTopic,
    progress: ReadonlyMap<string, ItemProgress>,
    options: { now?: Timestamp; limit?: number } = {},
  ): GrammarPractice {
    const now = options.now ?? Date.now();
    const ordered = practiceOrder(topic.exercises, progress, now);
    const limited = options.limit ? ordered.slice(0, options.limit) : ordered;
    return new GrammarPractice(
      userId,
      topic.id,
      limited.map((exercise) => questionFor(topic, exercise)),
      progress,
    );
  }

  get current(): GrammarQuestion | null {
    return this.#queue[this.#cursor] ?? null;
  }

  get position(): { readonly index: number; readonly total: number } {
    return { index: Math.min(this.#cursor, this.#queue.length), total: this.#queue.length };
  }

  get finished(): boolean {
    return this.#cursor >= this.#queue.length;
  }

  answer(given: string, options: { hintShown?: boolean; now?: Timestamp } = {}): GrammarOutcome {
    const question = this.#queue[this.#cursor];
    if (!question) throw new Error('the practice has no current question');
    const now = options.now ?? Date.now();

    const verdict = checkAnswer(given, question.answers, { language: 'de' });
    const grade = gradeFor(verdict, {
      kind: question.kind,
      hintShown: options.hintShown === true,
      // Every grammar exercise here is answered in German, choices included.
      producedTargetLanguage: true,
    });

    const before = this.#progress.get(question.exerciseId)
      ?? newProgress(this.userId, question.exerciseId);
    const after = review(before, grade, { now });
    this.#progress.set(question.exerciseId, after);

    this.#asked += 1;
    if (verdict.correct) this.#correct += 1;
    this.#cursor += 1;

    return {
      verdict,
      grade,
      progress: after,
      attempt: {
        userId: this.userId,
        itemId: question.exerciseId,
        at: now,
        correct: verdict.correct,
        grade,
        given,
        expected: verdict.matched,
        exerciseKind: question.kind,
      },
      // The explanation is shown whether the answer was right or wrong: someone
      // who guessed correctly has learned nothing until they read why.
      explanation: question.explanation,
      finished: this.finished,
    };
  }

  skip(): void {
    if (!this.finished) this.#cursor += 1;
  }

  get summary(): GrammarSummary {
    return {
      asked: this.#asked,
      correct: this.#correct,
      accuracy: this.#asked === 0 ? 0 : this.#correct / this.#asked,
      total: this.#queue.length,
    };
  }
}

/** How much of a topic the learner has got right at least once. */
export function topicProgress(
  topic: GrammarTopic,
  progress: ReadonlyMap<string, ItemProgress>,
): { readonly total: number; readonly learned: number; readonly completion: number } {
  let learned = 0;
  for (const exercise of topic.exercises) {
    const record = progress.get(exercise.id);
    if (record && record.state !== 'new' && record.state !== 'learning') learned += 1;
  }
  const total = topic.exercises.length;
  return { total, learned, completion: total === 0 ? 0 : learned / total };
}
