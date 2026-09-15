/**
 * The content repository.
 *
 * Everything the learner can be shown — vocabulary and grammar — lives behind
 * this interface. The engine already refuses to know where *progress* is stored;
 * this is the same boundary for content, so the web app reading a bundled JSON
 * file and a phone reading a downloaded course pack are the same code path.
 *
 * Queries are synchronous, unlike `ProgressStore`. That is deliberate and not an
 * inconsistency: a course is loaded once and then read thousands of times while
 * building a session, and making every lookup a promise would buy nothing except
 * `await` on every line. Loading is the async part, and it happens at
 * construction, outside this interface.
 */

import { levelIndex, type CefrLevel, type GrammarTopic, type LanguageCode, type VocabularyItem, type WordType } from './types.ts';

// --- normalisation for search -------------------------------------------------

/**
 * Fold text for *searching*.
 *
 * This strips diacritics, and that is the opposite of what `answers.fold` does —
 * on purpose. Someone typing "schon" as an *answer* when the word is "schön" is
 * wrong; someone typing "schon" into a *search box* is looking for "schön" and
 * very likely cannot type the umlaut on their keyboard. Same-looking function,
 * opposite requirement, so they are deliberately not shared.
 */
export function searchFold(text: string): string {
  return String(text)
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- queries -----------------------------------------------------------------

export interface ContentQuery {
  readonly levels?: readonly CefrLevel[];
  readonly category?: string;
  readonly wordType?: WordType;
  /** Only items that carry an example sentence — context exercises need one. */
  readonly withExample?: boolean;
}

export type SearchHit<L extends LanguageCode = LanguageCode> =
  | { readonly kind: 'vocabulary'; readonly score: number; readonly item: VocabularyItem<L> }
  | { readonly kind: 'grammar'; readonly score: number; readonly topic: GrammarTopic };

export interface SearchOptions {
  readonly limit?: number;
  /** Restrict to one kind. Omitted means both, interleaved by score. */
  readonly kind?: 'vocabulary' | 'grammar';
  readonly levels?: readonly CefrLevel[];
}

export interface ContentRepository<L extends LanguageCode = LanguageCode> {
  readonly language: L;
  /** Every vocabulary item, in the order the source produced them. */
  vocabulary(query?: ContentQuery): readonly VocabularyItem<L>[];
  item(id: string): VocabularyItem<L> | null;
  /** Several items at once, skipping ids the repository does not know. */
  items(ids: readonly string[]): readonly VocabularyItem<L>[];
  grammar(query?: Pick<ContentQuery, 'levels'>): readonly GrammarTopic[];
  topic(id: string): GrammarTopic | null;
  /** Category ids that at least one item belongs to. */
  categories(): readonly string[];
  search(query: string, options?: SearchOptions): readonly SearchHit<L>[];
}

// --- scoring -----------------------------------------------------------------

/**
 * How well one field matches, 0 when it does not.
 *
 * The tiers matter more than the exact numbers: an exact hit must always beat a
 * prefix, a prefix must always beat a match in the middle of a word, or search
 * feels random. `weight` scales a whole field, so a hit in the headword outranks
 * the same hit in an example sentence.
 */
function fieldScore(value: string, needle: string, weight: number): number {
  if (!value) return 0;
  const haystack = searchFold(value);
  if (!haystack) return 0;
  if (haystack === needle) return 100 * weight;
  if (haystack.startsWith(needle)) return 60 * weight;
  const at = haystack.indexOf(needle);
  if (at < 0) return 0;
  // A match that starts a word ("fahren" in "Auto fahren") is worth more than
  // one buried inside it ("fahren" in "erfahren").
  return (haystack[at - 1] === ' ' ? 40 : 20) * weight;
}

function scoreItem(item: VocabularyItem, needle: string): number {
  return Math.max(
    fieldScore(item.term, needle, 1),
    fieldScore(item.translation, needle, 0.8),
    fieldScore(item.example, needle, 0.3),
    fieldScore(item.exampleTranslation, needle, 0.25),
  );
}

function scoreTopic(topic: GrammarTopic, needle: string): number {
  let best = Math.max(
    fieldScore(topic.title, needle, 1),
    fieldScore(topic.titleInSourceLanguage, needle, 0.95),
    fieldScore(topic.summary, needle, 0.5),
  );
  for (const rule of topic.rules) best = Math.max(best, fieldScore(rule, needle, 0.3));
  return best;
}

/** Sorts after every real CEFR level, for items no source has levelled. */
const CEFR_AFTER_ALL = 99;

/** Ranked items lead unranked ones: a common word is a better guess than a rare one. */
const frequencyKey = (item: VocabularyItem): number =>
  item.frequencyRank > 0 ? item.frequencyRank : Number.MAX_SAFE_INTEGER;

// --- implementation ----------------------------------------------------------

/**
 * A repository over content already in memory.
 *
 * Indexes are built once in the constructor. With ~5 000 items that costs
 * milliseconds and removes every linear scan from the session-building path,
 * which runs far more often.
 */
export class InMemoryContentRepository<L extends LanguageCode = LanguageCode>
implements ContentRepository<L> {
  readonly language: L;
  readonly #items: readonly VocabularyItem<L>[];
  readonly #topics: readonly GrammarTopic[];
  readonly #byId = new Map<string, VocabularyItem<L>>();
  readonly #byTopicId = new Map<string, GrammarTopic>();
  readonly #byCategory = new Map<string, VocabularyItem<L>[]>();

  constructor(language: L, items: readonly VocabularyItem<L>[], topics: readonly GrammarTopic[] = []) {
    this.language = language;
    this.#items = items;
    this.#topics = topics;

    for (const item of items) {
      // A duplicate id is not a cosmetic problem: progress is keyed on it, so
      // two cards sharing an id would share one memory. Fail loudly at load.
      if (this.#byId.has(item.id)) throw new Error(`duplicate vocabulary id: ${item.id}`);
      this.#byId.set(item.id, item);
      for (const category of item.categories) {
        const bucket = this.#byCategory.get(category);
        if (bucket) bucket.push(item);
        else this.#byCategory.set(category, [item]);
      }
    }
    for (const topic of topics) {
      if (this.#byTopicId.has(topic.id)) throw new Error(`duplicate grammar topic id: ${topic.id}`);
      this.#byTopicId.set(topic.id, topic);
    }
  }

  vocabulary(query: ContentQuery = {}): readonly VocabularyItem<L>[] {
    const base = query.category ? this.#byCategory.get(query.category) ?? [] : this.#items;
    const levels = query.levels;
    return base.filter((item) => {
      if (levels && (item.level === null || !levels.includes(item.level))) return false;
      if (query.wordType && item.wordType !== query.wordType) return false;
      if (query.withExample && !item.example.trim()) return false;
      return true;
    });
  }

  item(id: string): VocabularyItem<L> | null {
    return this.#byId.get(id) ?? null;
  }

  items(ids: readonly string[]): readonly VocabularyItem<L>[] {
    const out: VocabularyItem<L>[] = [];
    for (const id of ids) {
      const item = this.#byId.get(id);
      if (item) out.push(item);
    }
    return out;
  }

  grammar(query: Pick<ContentQuery, 'levels'> = {}): readonly GrammarTopic[] {
    const levels = query.levels;
    if (!levels) return this.#topics;
    return this.#topics.filter((topic) => levels.includes(topic.level));
  }

  topic(id: string): GrammarTopic | null {
    return this.#byTopicId.get(id) ?? null;
  }

  categories(): readonly string[] {
    return [...this.#byCategory.keys()].sort();
  }

  search(query: string, options: SearchOptions = {}): readonly SearchHit<L>[] {
    const needle = searchFold(query);
    // One character matches most of the corpus and answers nothing.
    if (needle.length < 2) return [];
    const limit = options.limit ?? 25;
    const levels = options.levels;
    const hits: SearchHit<L>[] = [];

    if (options.kind !== 'grammar') {
      for (const item of this.#items) {
        if (levels && (item.level === null || !levels.includes(item.level))) continue;
        const score = scoreItem(item, needle);
        if (score > 0) hits.push({ kind: 'vocabulary', score, item });
      }
    }
    if (options.kind !== 'vocabulary') {
      for (const topic of this.#topics) {
        if (levels && !levels.includes(topic.level)) continue;
        const score = scoreTopic(topic, needle);
        if (score > 0) hits.push({ kind: 'grammar', score, topic });
      }
    }

    hits.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Ties are broken deterministically, never by insertion luck: a search
      // that reorders itself between runs looks broken.
      const aKey = a.kind === 'vocabulary' ? frequencyKey(a.item) : Number.MAX_SAFE_INTEGER;
      const bKey = b.kind === 'vocabulary' ? frequencyKey(b.item) : Number.MAX_SAFE_INTEGER;
      if (aKey !== bKey) return aKey - bKey;
      const aId = a.kind === 'vocabulary' ? a.item.id : a.topic.id;
      const bId = b.kind === 'vocabulary' ? b.item.id : b.topic.id;
      return aId < bId ? -1 : aId > bId ? 1 : 0;
    });

    return hits.slice(0, limit);
  }
}

/**
 * Teaching order: easiest level first, then the most common words.
 *
 * A learner meeting a category for the first time should meet *Haus* before
 * *Dachrinne*, and frequency is the only evidence in the data about which of two
 * same-level words is worth more. Items with no level or no rank sort last
 * rather than being dropped — unranked is unknown, not rare.
 */
export function teachingOrder(a: VocabularyItem, b: VocabularyItem): number {
  const aLevel = a.level ? levelIndex(a.level) : CEFR_AFTER_ALL;
  const bLevel = b.level ? levelIndex(b.level) : CEFR_AFTER_ALL;
  if (aLevel !== bLevel) return aLevel - bLevel;
  const aRank = frequencyKey(a);
  const bRank = frequencyKey(b);
  if (aRank !== bRank) return aRank - bRank;
  const aTerm = searchFold(a.term);
  const bTerm = searchFold(b.term);
  if (aTerm !== bTerm) return aTerm < bTerm ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

