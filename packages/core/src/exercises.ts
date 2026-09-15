/**
 * Turning a vocabulary item into a question.
 *
 * The UI should not decide what to ask. If it does, the web app and the phone
 * ask differently, the difficulty ladder stops meaning anything, and neither can
 * be tested without a screen. So the question is built here — what is shown,
 * what is accepted, which distractors appear — and the UI only renders it.
 *
 * Deliberately free of prose. There is no `prompt: "Choose the right meaning"`
 * field, because that sentence is UI chrome and has to exist in every interface
 * language (§20). The question says what *kind* it is; the interface says it in
 * the learner's language.
 *
 * Nothing is invented. A context question is only built when the item's own
 * example sentence really contains the word — the example comes verbatim from a
 * source and this code will not write one.
 */

import { shuffle, type Random } from './selection.ts';
import { levelIndex, type ExerciseKind, type VocabularyItem } from './types.ts';

/** Which way round the question runs. */
export type Direction = 'target-to-source' | 'source-to-target';

export interface Question {
  readonly itemId: string;
  readonly kind: ExerciseKind;
  readonly direction: Direction;
  /** What the learner is shown: a word, or a sentence with a gap. */
  readonly subject: string;
  /** Present only for `context`: the sentence's translation, when the source has one. */
  readonly subjectTranslation: string;
  /** Choices for a multiple-choice question; empty for the typed forms. */
  readonly options: readonly string[];
  /** Everything accepted as correct. Never empty. */
  readonly answers: readonly string[];
  /** Shown on request, at the cost of the Easy grade. Empty when there is none. */
  readonly hint: string;
  /** The answer is in the language being learned — the harder direction. */
  readonly producedTargetLanguage: boolean;
}

/** The gap a context question leaves where the word belongs. */
export const GAP = '___';

const OPTION_COUNT = 4;

/**
 * Distractors for a multiple-choice question.
 *
 * Wrong answers have to be *plausible*, or the question tests nothing: three
 * verbs and a noun gives the answer away without any German. So candidates of
 * the same word type come first, then the nearest levels, and anything whose
 * meaning matches the right answer is excluded — a synonym presented as a wrong
 * answer is simply an unfair question.
 */
export function distractors(
  item: VocabularyItem,
  pool: readonly VocabularyItem[],
  count: number,
  field: 'term' | 'translation',
  random: Random = Math.random,
): readonly string[] {
  const answer = item[field].trim().toLowerCase();
  const seen = new Set<string>([answer]);
  const candidates: VocabularyItem[] = [];

  for (const candidate of pool) {
    if (candidate.id === item.id) continue;
    const value = candidate[field].trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    // Same meaning, different word: a fair question cannot call this wrong.
    if (candidate.translation.trim().toLowerCase() === item.translation.trim().toLowerCase()) continue;
    seen.add(key);
    candidates.push(candidate);
  }

  const sameType = shuffle(candidates.filter((c) => c.wordType === item.wordType), random);
  const rest = shuffle(candidates.filter((c) => c.wordType !== item.wordType), random);

  // Within the preferred group, nearer levels first: a B2 word among A1 options
  // stands out for the wrong reason.
  const distance = (other: VocabularyItem): number => {
    if (!item.level || !other.level) return 9;
    return Math.abs(levelIndex(item.level) - levelIndex(other.level));
  };
  sameType.sort((a, b) => distance(a) - distance(b));

  return [...sameType, ...rest].slice(0, count).map((c) => c[field].trim());
}

/**
 * Blank the word out of its own example sentence.
 *
 * Returns null when the word does not actually appear — German being German,
 * the example may well use an inflected form the plain headword does not match,
 * and guessing at stems here would produce nonsense gaps. The caller falls back
 * to an easier question rather than showing one.
 */
export function blankOut(sentence: string, term: string): string | null {
  const word = term.trim();
  if (!sentence.trim() || !word) return null;
  // Word boundaries by hand: \b does not treat ä, ö, ü, ß as word characters.
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|[^\\p{L}])(${escaped})(?=[^\\p{L}]|$)`, 'iu');
  if (!pattern.test(sentence)) return null;
  return sentence.replace(pattern, `$1${GAP}`);
}

export interface QuestionOptions {
  /** Items the distractors are drawn from. Usually the lesson or the level. */
  readonly pool?: readonly VocabularyItem[];
  readonly random?: Random;
  /**
   * Force a direction. By default recognition runs German → English (the
   * learner is reading) and production runs English → German (they are writing),
   * which is the way round each exercise is actually useful.
   */
  readonly direction?: Direction;
}

/**
 * Build the question this item deserves at this stage.
 *
 * Falls back down the ladder rather than showing something broken: an item with
 * no usable example cannot host a context question, and one with too small a
 * pool cannot host a multiple choice.
 */
export function buildQuestion(
  item: VocabularyItem,
  kind: ExerciseKind,
  options: QuestionOptions = {},
): Question {
  const pool = options.pool ?? [];
  const random = options.random ?? Math.random;
  const article = 'article' in item.metadata ? String(item.metadata.article ?? '') : '';
  const fullTerm = article ? `${article} ${item.term}` : item.term;

  const base = {
    itemId: item.id,
    subjectTranslation: '',
    hint: '',
  };

  if (kind === 'context') {
    const gapped = blankOut(item.example, item.term);
    if (gapped) {
      return {
        ...base,
        kind: 'context',
        direction: 'source-to-target',
        subject: gapped,
        subjectTranslation: item.exampleTranslation,
        options: [],
        answers: [item.term],
        // The meaning is the clue; the shape of the word is the question.
        hint: item.translation,
        producedTargetLanguage: true,
      };
    }
    kind = 'typing';
  }

  if (kind === 'choice' || kind === 'recognise') {
    // Recognition and choice are the same shape; recognition is the gentler
    // direction, showing the German and asking what it means.
    const direction = options.direction ?? 'target-to-source';
    const toSource = direction === 'target-to-source';
    const answer = toSource ? item.translation : fullTerm;
    const field = toSource ? 'translation' : 'term';
    const wrong = distractors(item, pool, OPTION_COUNT - 1, field, random);
    return {
      ...base,
      kind,
      direction,
      subject: toSource ? fullTerm : item.translation,
      options: shuffle([answer, ...wrong], random),
      answers: [answer],
      producedTargetLanguage: !toSource,
    };
  }

  if (kind === 'recall') {
    // Recall: shown the meaning, say the word. Typed, but the article is not
    // required — the word is what is being recalled.
    return {
      ...base,
      kind: 'recall',
      direction: 'source-to-target',
      subject: item.translation,
      options: [],
      answers: article ? [fullTerm, item.term] : [item.term],
      hint: item.term.slice(0, 1),
      producedTargetLanguage: true,
    };
  }

  // Typing: the full form, article and all, from the meaning alone.
  return {
    ...base,
    kind: 'typing',
    direction: options.direction ?? 'source-to-target',
    subject: item.translation,
    options: [],
    answers: article ? [fullTerm] : [item.term],
    hint: article ? `${article} …` : item.term.slice(0, 1),
    producedTargetLanguage: true,
  };
}

/** The exercise forms this item can actually support, for `stageWithin`. */
export function availableKinds(item: VocabularyItem, poolSize: number): readonly ExerciseKind[] {
  const kinds: ExerciseKind[] = ['recall', 'typing'];
  if (poolSize >= OPTION_COUNT) kinds.unshift('recognise', 'choice');
  if (blankOut(item.example, item.term)) kinds.push('context');
  return kinds;
}
