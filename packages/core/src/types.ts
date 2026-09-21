/**
 * The domain model of the learning engine.
 *
 * Nothing here knows about German. German is the first course, not the shape of
 * the product: a vocabulary item carries a `metadata` bag whose type is chosen
 * by the item's target language, so adding Spanish means adding one interface
 * and one entry to `LanguageMetadata` — not touching the scheduler, the answer
 * checker or the selection logic.
 *
 * These types mirror the JSON the Python content pipeline already produces
 * (`app/data/*.json`). They were written from that data, not invented alongside
 * it, so the importer and the engine cannot drift apart silently.
 */

// --- languages and courses ---------------------------------------------------

/** ISO 639-1 where one exists. Kept as a string union so a typo is a type error. */
export type LanguageCode = 'de' | 'en' | 'es' | 'fr' | 'it';

/**
 * A course is a direction, not a language: "English speaker learning German" is
 * a different product from "German speaker learning English", with different
 * content and different UI strings.
 */
export interface Course {
  readonly id: string;
  readonly sourceLanguage: LanguageCode;
  readonly targetLanguage: LanguageCode;
}

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/** Index of a level in the CEFR order; -1 for anything unrecognised. */
export const levelIndex = (level: string): number =>
  (CEFR_LEVELS as readonly string[]).indexOf(level);

// --- language-specific vocabulary metadata -----------------------------------

/** German: gender lives in the article, and both matter for exercises. */
export interface GermanVocabularyMetadata {
  /** der / die / das. Empty when the word is not a noun or the source omits it. */
  readonly article: '' | 'der' | 'die' | 'das';
  /** Full plural form once expanded ("Häuser"), never the source shorthand ("-¨er"). */
  readonly pluralForm: string;
  /** Present/past/participle where a source supplies them. */
  readonly verbForms: Readonly<Record<string, string>>;
  /** A fixed preposition and the case it governs, e.g. "auf + A". */
  readonly preposition: string;
  /** D / A / CH, where the source distinguishes regional standard forms. */
  readonly regionalVariant: '' | 'D' | 'A' | 'CH';
  /** The entry is listed in the plural, so its article is the plural article. */
  readonly isPluralEntry: boolean;
}

/**
 * Add a language by adding its interface here. A `VocabularyItem<'es'>` then
 * fails to compile until Spanish metadata is defined, which is the point.
 */
export interface LanguageMetadata {
  de: GermanVocabularyMetadata;
  en: Record<string, never>;
  es: Record<string, never>;
  fr: Record<string, never>;
  it: Record<string, never>;
}

// --- content -----------------------------------------------------------------

export type WordType =
  | 'noun' | 'verb' | 'adjective' | 'adverb'
  | 'pronoun' | 'preposition' | 'conjunction' | 'other';

/** Where a level came from. A source's statement and a guess are not the same claim. */
export type LevelProvenance =
  | { readonly kind: 'stated'; readonly sources: readonly string[] }
  | { readonly kind: 'approximated'; readonly basis: string };

/** Where a translation came from, for the same reason. */
export type TranslationProvenance = 'wordlist' | 'dictionary' | 'course-material';

export interface SourceReference {
  readonly title: string;
  /** 0 when the source is not paginated (a word list rather than a book). */
  readonly page: number;
}

export interface VocabularyItem<L extends LanguageCode = LanguageCode> {
  readonly id: string;
  readonly language: L;
  /** The headword as the learner should see it. */
  readonly term: string;
  readonly translation: string;
  readonly translationProvenance: TranslationProvenance;
  readonly wordType: WordType;
  readonly level: CefrLevel | null;
  readonly levelProvenance: LevelProvenance;
  /** An example sentence in the target language, verbatim from the source. */
  readonly example: string;
  /** Its translation, when the source supplies one. Empty is normal, not a bug. */
  readonly exampleTranslation: string;
  readonly categories: readonly string[];
  readonly source: SourceReference;
  /** Rank in a frequency list; 0 when the word is not ranked. */
  readonly frequencyRank: number;
  readonly metadata: LanguageMetadata[L];
  /** A human should look at this entry; the reason is in `note`. */
  readonly needsReview: boolean;
  readonly note: string;
}

export interface GrammarTable {
  readonly caption: string;
  /** The first column is the row label, so its header is usually empty. */
  readonly columns: readonly string[];
  /** Each row has exactly `columns.length` cells; the build refuses otherwise. */
  readonly rows: readonly (readonly string[])[];
}

export interface GrammarComparisonRow {
  /** What is being compared — "Verb position", "Meaning". */
  readonly aspect: string;
  readonly left: string;
  readonly right: string;
}

/**
 * Two structures learners confuse, set against each other.
 *
 * Written for this project, and a weaker claim than a paradigm table: a
 * declension is a closed system anyone can check, whereas choosing which two
 * structures to contrast and what to say about each is a teaching decision.
 * Each one is attached to a topic that teaches at least one side of it.
 */
export interface GrammarComparison {
  readonly left: string;
  readonly right: string;
  readonly rows: readonly GrammarComparisonRow[];
}

export interface GrammarExample {
  readonly text: string;
  readonly note: string;
  /**
   * Where in `text` the forms this topic teaches sit, as `[start, end)` pairs
   * into the string.
   *
   * Decided once at build time, from the topic's own exercise answers — the
   * corpus pointing at its own target — and never recomputed by a screen. The
   * app slices the string it was given, so what is highlighted was checked
   * where it could be checked, rather than re-derived by a regex per render.
   *
   * Nothing here identifies "the verb" or "the subject". That needs a parser,
   * and a wrong guess teaches wrong grammar. Examples the build could not mark
   * carry an empty list and simply are not highlighted.
   */
  readonly marks: readonly (readonly [number, number])[];
}

/** One headed paragraph of a grammar explanation, as the source document lays it out. */
export interface ExplanationSection {
  readonly heading: string;
  readonly text: string;
}

export type ExerciseKind =
  | 'recognise' | 'choice' | 'recall' | 'typing' | 'context'
  | 'transform' | 'reorder' | 'error-correction';

export interface Exercise {
  readonly id: string;
  readonly kind: ExerciseKind;
  readonly prompt: string;
  readonly text: string;
  readonly options: readonly string[];
  readonly answers: readonly string[];
  readonly hint: string;
  readonly explanation: string;
  /** False means written for practice, not quoted from the source document. */
  readonly fromSource: boolean;
}

export interface GrammarTopic {
  readonly id: string;
  readonly language: LanguageCode;
  readonly level: CefrLevel;
  readonly title: string;
  readonly titleInSourceLanguage: string;
  readonly summary: string;
  /** The explanation proper, in the source's own sections. */
  readonly explanation: readonly ExplanationSection[];
  readonly rules: readonly string[];
  readonly examples: readonly GrammarExample[];
  readonly exercises: readonly Exercise[];
  readonly prerequisites: readonly string[];
  /**
   * The grammatical family the source files this topic under — "Verben",
   * "Satzverbindungen", and eighteen others. Carried through because it is the
   * only grammatical classification the corpus states, so it is what lets the
   * app group topics by what they are rather than only by level.
   */
  readonly category: string;
  /**
   * Paradigm tables for this topic, where one exists.
   *
   * Written for this project rather than extracted: the corpus explains the
   * article, pronoun and adjective-ending systems in prose, and exactly one of
   * its 626 rules is a full paradigm. Those systems are closed and finite, so
   * they can be written down and checked against any reference grammar — which
   * is what separates writing them from inventing grammar. Topics whose content
   * is usage rather than a closed paradigm have none, and that is correct.
   */
  readonly tables: readonly GrammarTable[];
  /** Null on the topics — most of them — that contrast nothing. */
  readonly comparison: GrammarComparison | null;
  /** 1 (easiest) to 5. */
  readonly difficulty: number;
  readonly source: SourceReference;
}

// --- learner state -----------------------------------------------------------

/**
 * How well an item is known. Derived from the scheduler's own confidence, never
 * from a raw attempt counter — see `srs.ts`.
 */
export const MASTERY_STATES = ['new', 'learning', 'review', 'strong', 'mastered'] as const;
export type MasteryState = (typeof MASTERY_STATES)[number];

/**
 * Is this one of the states, at runtime?
 *
 * The type alone is not enough anywhere a record crosses a boundary — a synced
 * payload or a parsed key-value store is a string until something checks it.
 * Deriving the type from the array means the check and the type cannot drift.
 */
export const isMasteryState = (value: unknown): value is MasteryState =>
  typeof value === 'string' && (MASTERY_STATES as readonly string[]).includes(value);

/** FSRS grades. The learner never picks these; they are inferred from the answer. */
export const GRADE = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 } as const;
export type Grade = (typeof GRADE)[keyof typeof GRADE];

/** Epoch milliseconds. Named so a raw `number` cannot be passed by accident. */
export type Timestamp = number;

export interface ItemProgress {
  readonly userId: string;
  readonly itemId: string;
  readonly state: MasteryState;
  readonly seen: boolean;
  readonly correctCount: number;
  readonly incorrectCount: number;
  readonly repetitionCount: number;
  readonly lastReviewed: Timestamp;
  readonly dueAt: Timestamp;
  /** FSRS difficulty, 1 (easy) to 10 (hard). */
  readonly difficulty: number;
  /** FSRS stability in days: how long until recall drops to the target retention. */
  readonly stability: number;
}

export interface AttemptRecord {
  readonly userId: string;
  readonly itemId: string;
  readonly at: Timestamp;
  readonly correct: boolean;
  readonly grade: Grade;
  readonly given: string;
  readonly expected: string;
  readonly exerciseKind: ExerciseKind;
}
