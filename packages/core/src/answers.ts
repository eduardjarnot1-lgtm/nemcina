/**
 * Answer checking and grading.
 *
 * Two jobs that belong together: deciding whether a typed answer is right, and
 * turning that verdict into the FSRS grade the scheduler needs.
 *
 * Checking is deliberately forgiving. A learner who types "der Tisch." instead
 * of "der Tisch" knows the word; failing them teaches nothing except that the
 * app is pedantic. What it must NOT do is accept an answer that is actually
 * wrong, so "close" is a distinct verdict rather than a pass.
 *
 * Nothing here is German-specific except one fold rule (ß/ss), which is applied
 * per language rather than globally.
 */

import { GRADE, type ExerciseKind, type Grade, type LanguageCode } from './types.ts';

export interface Verdict {
  readonly correct: boolean;
  /** Right word, one or two characters off. Reported to the learner as "almost". */
  readonly close: boolean;
  /** The accepted answer this matched, or the first expected answer. */
  readonly matched: string;
}

/** Per-language normalisation applied before comparison. */
const LANGUAGE_FOLD: Partial<Record<LanguageCode, ReadonlyArray<readonly [string, string]>>> = {
  // German: ß and ss are the same word; keyboards frequently lack ß.
  de: [['ß', 'ss']],
};

/**
 * Lowercase, strip punctuation, collapse whitespace, apply language folds.
 * Accents are deliberately NOT stripped: in German "schon" and "schön" are
 * different words, and folding them would accept a wrong answer.
 */
export function fold(text: string, language: LanguageCode = 'de'): string {
  let value = String(text).toLowerCase();
  for (const [from, to] of LANGUAGE_FOLD[language] ?? []) {
    value = value.split(from).join(to);
  }
  return value
    .replace(/[.,!?;:„“"'`()\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein distance, capped. Only ever used to tell "close" from "wrong",
 * so it bails out early rather than computing a large distance precisely.
 */
export function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 4) return 99;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = (previous[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1);
      const insertion = (current[j - 1] as number) + 1;
      const deletion = (previous[j] as number) + 1;
      current[j] = Math.min(substitution, insertion, deletion);
    }
    previous = current;
  }
  return previous[b.length] as number;
}

/** How many edits still count as "almost", scaled to the length of the answer. */
const closeThreshold = (length: number): number => (length <= 4 ? 1 : length <= 10 ? 1 : 2);

export interface CheckOptions {
  readonly language?: LanguageCode;
  /**
   * Accept an answer that omits a leading article ("Tisch" for "der Tisch").
   * Off by default: on an article exercise the article is the whole question.
   */
  readonly allowMissingArticle?: boolean;
}

const ARTICLES = /^(der|die|das|ein|eine|el|la|los|las|le|il)\s+/;

/** Check a typed answer against every accepted answer. */
export function checkAnswer(
  given: string,
  accepted: readonly string[],
  options: CheckOptions = {},
): Verdict {
  const language = options.language ?? 'de';
  const candidates = accepted.filter((answer) => answer.trim().length > 0);
  const fallback = candidates[0] ?? '';
  const typed = fold(given, language);

  if (!typed) return { correct: false, close: false, matched: fallback };

  for (const answer of candidates) {
    if (fold(answer, language) === typed) {
      return { correct: true, close: false, matched: answer };
    }
  }

  if (options.allowMissingArticle) {
    for (const answer of candidates) {
      const bare = fold(answer, language).replace(ARTICLES, '');
      if (bare && bare === typed) return { correct: true, close: false, matched: answer };
    }
  }

  for (const answer of candidates) {
    const target = fold(answer, language);
    if (distance(typed, target) <= closeThreshold(target.length)) {
      return { correct: false, close: true, matched: answer };
    }
  }

  return { correct: false, close: false, matched: fallback };
}

// --- grading -----------------------------------------------------------------

export interface GradingContext {
  readonly kind: ExerciseKind;
  /** A hint was on screen when the learner answered. */
  readonly hintShown: boolean;
  /** The learner produced the target language rather than recognising it. */
  readonly producedTargetLanguage: boolean;
}

/**
 * Turn a verdict into an FSRS grade.
 *
 * The learner is never asked to rate their own recall, so the grade comes from
 * what the app already knows about the answer:
 *
 *   Again (1)  wrong
 *   Hard (2)   a near miss — right word, a typo away
 *   Good (3)   correct
 *   Easy (4)   correct, produced unaided in the target language
 *
 * Easy is reserved for production because recognising the right button is
 * weaker evidence than writing or saying the word, and the scheduler should not
 * treat them as the same event.
 */
export function gradeFor(verdict: Verdict, context: GradingContext): Grade {
  if (!verdict.correct) return verdict.close ? GRADE.HARD : GRADE.AGAIN;
  const produced = context.kind === 'typing' || context.kind === 'recall';
  if (produced && context.producedTargetLanguage && !context.hintShown) return GRADE.EASY;
  return GRADE.GOOD;
}
