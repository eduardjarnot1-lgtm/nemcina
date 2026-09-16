/**
 * Reading the Python pipeline's output.
 *
 * `app/data/*.json` is produced by the extractors in `app/tools/`, validated by
 * `validate_content.py`, and consumed by the web prototype directly. This module
 * turns that JSON into the core's own types so the engine never reads raw
 * pipeline fields, and so a change in the pipeline's shape breaks here — in one
 * typed place with tests behind it — rather than three screens deep in a UI.
 *
 * Nothing is invented on the way through. Where the pipeline has no value, the
 * result carries an empty one; no level is guessed, no example is written, no
 * translation is filled in. A card that says nothing about its plural must keep
 * saying nothing.
 */

import {
  CEFR_LEVELS,
  type CefrLevel,
  type Exercise,
  type ExerciseKind,
  type ExplanationSection,
  type GermanVocabularyMetadata,
  type GrammarExample,
  type GrammarTopic,
  type LevelProvenance,
  type TranslationProvenance,
  type VocabularyItem,
  type WordType,
} from './types.ts';

// --- the shapes the pipeline actually writes ---------------------------------

export interface RawVocabularyFile {
  readonly meta?: Record<string, unknown>;
  readonly words: readonly RawWord[];
}

export interface RawWord {
  readonly id: string;
  readonly language?: string;
  readonly word: string;
  readonly term?: string;
  readonly translation: string;
  readonly translationSource?: string;
  readonly type: string;
  readonly article?: string;
  readonly plural?: boolean;
  readonly pluralForm?: string;
  readonly verbForms?: Readonly<Record<string, string>>;
  readonly regionalVariant?: string;
  readonly example?: string;
  readonly exampleTranslation?: string;
  readonly note?: string;
  readonly needsReview?: boolean;
  readonly source?: string;
  readonly sourcePage?: number;
  readonly cefr?: string;
  readonly cefrSource?: string;
  readonly cefrApprox?: string;
  readonly frequencyRank?: number;
  readonly categories?: readonly { readonly category: string; readonly subcategory: string }[];
}

export interface RawGrammarFile {
  readonly meta?: Record<string, unknown>;
  readonly topics: readonly RawTopic[];
}

export interface RawTopic {
  readonly id: string;
  readonly level: string;
  readonly title: string;
  readonly titleEn?: string;
  readonly summary?: string;
  readonly explanation?: readonly { readonly heading?: string; readonly text?: string }[];
  readonly rules?: readonly string[];
  readonly examples?: readonly { readonly de?: string; readonly note?: string }[];
  readonly exercises?: readonly RawExercise[];
  readonly prerequisites?: readonly string[];
  readonly difficulty?: number;
  readonly source?: string;
  readonly sourcePage?: number;
}

export interface RawExercise {
  readonly id: string;
  readonly type: string;
  readonly prompt?: string;
  readonly text?: string;
  readonly from?: string;
  readonly options?: readonly string[];
  readonly tokens?: readonly string[];
  readonly answers?: readonly string[];
  readonly hint?: string;
  readonly explain?: string;
  readonly fromSource?: boolean;
}

// --- field-level conversions --------------------------------------------------

const WORD_TYPES = new Set<WordType>([
  'noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'other',
]);

/** Anything the engine does not model becomes "other" rather than a type error. */
export function toWordType(value: string): WordType {
  return WORD_TYPES.has(value as WordType) ? (value as WordType) : 'other';
}

export function toLevel(value: string | undefined): CefrLevel | null {
  return value && (CEFR_LEVELS as readonly string[]).includes(value) ? (value as CefrLevel) : null;
}

/**
 * Where a level came from.
 *
 * The pipeline writes `cefrSource: "tier-approximation"` when it inferred the
 * level from the GCSE tier rather than reading it off a word list. That is a
 * materially weaker claim and the type keeps them apart, so a UI can say "approx."
 * where it is true and nowhere else.
 */
export function toLevelProvenance(raw: RawWord): LevelProvenance {
  const source = (raw.cefrSource ?? '').trim();
  if (!source || source === 'tier-approximation') {
    return { kind: 'approximated', basis: source || 'unstated' };
  }
  return { kind: 'stated', sources: source.split(',').map((s) => s.trim()).filter(Boolean) };
}

/**
 * `ding` is the Ding dictionary, `b2-list` the supplied B2 vocabulary document,
 * and the rest of the corpus is the Goethe/Lingster word lists. The B2 list is
 * not one of those: it is course-style material with a gloss and a translated
 * example per entry, so calling it a word list would overstate what the other
 * lists provide and understate this one.
 */
function toTranslationProvenance(value: string | undefined): TranslationProvenance {
  if (value === 'ding') return 'dictionary';
  if (value === 'b2-list') return 'course-material';
  return 'wordlist';
}

const ARTICLES = new Set(['der', 'die', 'das']);
const REGIONS = new Set(['D', 'A', 'CH']);

function toGermanMetadata(raw: RawWord): GermanVocabularyMetadata {
  const article = (raw.article ?? '').trim();
  const region = (raw.regionalVariant ?? '').trim();
  return {
    article: ARTICLES.has(article) ? (article as 'der' | 'die' | 'das') : '',
    pluralForm: raw.pluralForm ?? '',
    verbForms: raw.verbForms ?? {},
    // The current pipeline carries no separate preposition column; the
    // information, where it exists, is inside the translation text.
    preposition: '',
    regionalVariant: REGIONS.has(region) ? (region as 'D' | 'A' | 'CH') : '',
    isPluralEntry: raw.plural === true,
  };
}

/**
 * Categories as flat `group/subgroup` ids.
 *
 * The synthetic `levels/*` group the pipeline adds is dropped: level is a field
 * of its own here, and keeping both would let the two disagree.
 */
export function toCategories(raw: RawWord): readonly string[] {
  return (raw.categories ?? [])
    .filter((entry) => entry.category !== 'levels')
    .map((entry) => `${entry.category}/${entry.subcategory}`);
}

export function toVocabularyItem(raw: RawWord): VocabularyItem<'de'> {
  return {
    id: raw.id,
    language: 'de',
    term: (raw.term ?? raw.word ?? '').trim(),
    translation: (raw.translation ?? '').trim(),
    translationProvenance: toTranslationProvenance(raw.translationSource),
    wordType: toWordType(raw.type),
    level: toLevel(raw.cefr),
    levelProvenance: toLevelProvenance(raw),
    example: raw.example ?? '',
    exampleTranslation: raw.exampleTranslation ?? '',
    categories: toCategories(raw),
    source: { title: raw.source ?? '', page: raw.sourcePage ?? 0 },
    frequencyRank: raw.frequencyRank ?? 0,
    metadata: toGermanMetadata(raw),
    needsReview: raw.needsReview === true,
    note: raw.note ?? '',
  };
}

/**
 * Exercise kinds.
 *
 * `fill` becomes `typing` because that is what it asks of the learner — produce
 * the word — and that is the rung it belongs on in the difficulty ladder. The
 * pipeline's name describes the layout; the engine's name describes the demand.
 */
const EXERCISE_KINDS: Readonly<Record<string, ExerciseKind>> = {
  fill: 'typing',
  choice: 'choice',
  context: 'context',
  transform: 'transform',
  reorder: 'reorder',
  error: 'error-correction',
  recognise: 'recognise',
  recall: 'recall',
  typing: 'typing',
};

export function toExerciseKind(value: string): ExerciseKind {
  return EXERCISE_KINDS[value] ?? 'typing';
}

export function toExercise(raw: RawExercise): Exercise {
  const kind = toExerciseKind(raw.type);
  return {
    id: raw.id,
    kind,
    prompt: raw.prompt ?? '',
    // A transform exercise shows the sentence to be transformed; the pipeline
    // keeps it in `from` and leaves `text` empty.
    text: (raw.text ?? '') || (raw.from ?? ''),
    // A reorder exercise's tokens are the things the learner arranges — the same
    // role `options` plays everywhere else.
    options: (raw.options?.length ? raw.options : raw.tokens) ?? [],
    answers: raw.answers ?? [],
    hint: raw.hint ?? '',
    explanation: raw.explain ?? '',
    fromSource: raw.fromSource === true,
  };
}

function toGrammarExample(raw: { de?: string; note?: string }): GrammarExample {
  return { text: raw.de ?? '', note: raw.note ?? '' };
}

function toExplanation(raw: { heading?: string; text?: string }): ExplanationSection {
  return { heading: raw.heading ?? '', text: raw.text ?? '' };
}

export function toGrammarTopic(raw: RawTopic): GrammarTopic {
  const level = toLevel(raw.level);
  if (!level) throw new Error(`grammar topic ${raw.id} has an unusable level: ${raw.level}`);
  return {
    id: raw.id,
    language: 'de',
    level,
    title: raw.title,
    titleInSourceLanguage: raw.titleEn ?? raw.title,
    summary: raw.summary ?? '',
    explanation: (raw.explanation ?? []).map(toExplanation),
    rules: raw.rules ?? [],
    examples: (raw.examples ?? []).map(toGrammarExample),
    exercises: (raw.exercises ?? []).map(toExercise),
    prerequisites: raw.prerequisites ?? [],
    difficulty: raw.difficulty ?? 1,
    source: { title: raw.source ?? '', page: raw.sourcePage ?? 0 },
  };
}

// --- whole files --------------------------------------------------------------

export function readVocabulary(file: RawVocabularyFile): readonly VocabularyItem<'de'>[] {
  return file.words.map(toVocabularyItem);
}

export function readGrammar(file: RawGrammarFile): readonly GrammarTopic[] {
  return file.topics.map(toGrammarTopic);
}

/** Category titles, so lessons can be labelled with a name rather than an id. */
export function readCategoryTitles(file: {
  readonly categories?: readonly {
    readonly id: string;
    readonly name: string;
    readonly subcategories?: readonly { readonly id: string; readonly name: string }[];
  }[];
}): Readonly<Record<string, string>> {
  const titles: Record<string, string> = {};
  for (const group of file.categories ?? []) {
    if (group.id === 'levels') continue;
    for (const sub of group.subcategories ?? []) {
      titles[`${group.id}/${sub.id}`] = sub.name;
    }
  }
  return titles;
}
