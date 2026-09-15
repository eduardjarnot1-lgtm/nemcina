/**
 * Lessons — turning a pile of cards into something a person can finish.
 *
 * 4 768 vocabulary items is a reference work, not a course. A learner opening
 * "Home and local area" and finding 430 words has been handed a dictionary and
 * told to feel motivated. The unit that works is small and finishable: ten to
 * twenty items, ordered so the easiest and most common come first, with a
 * visible end.
 *
 * Lessons are *derived*, never stored. They are a deterministic function of the
 * content, so rebuilding them after a content update cannot corrupt anyone's
 * progress — progress is keyed on item ids, which do not move. The cost of that
 * choice is that inserting a word into a category shifts later lesson
 * membership; the benefit is that there is no second source of truth to keep in
 * sync, and no migration to write.
 */

import { teachingOrder } from './content.ts';
import type { ContentRepository } from './content.ts';
import { CEFR_LEVELS, type CefrLevel, type ItemProgress, type LanguageCode, type VocabularyItem } from './types.ts';

export interface LessonShape {
  /** The size a lesson aims for. */
  readonly target: number;
  /** Below this, a lesson is too slight to feel like an achievement. */
  readonly min: number;
  /** Above this, it stops being finishable in one sitting. */
  readonly max: number;
}

/** §5: ten to twenty items, aiming at the middle. */
export const DEFAULT_SHAPE: LessonShape = { target: 15, min: 10, max: 20 };

/**
 * Split `total` items into lesson sizes.
 *
 * Even distribution rather than greedy filling, because greedy leaves a stub:
 * 31 items at 15 each gives 15/15/1, and that last lesson of one word is the one
 * that makes an app feel carelessly made. Evenly, it is 11/10/10.
 *
 * A group smaller than `min` becomes one short lesson. That is honest — the
 * category really does only have six words — and better than padding it with
 * unrelated ones.
 */
export function splitSizes(total: number, shape: LessonShape = DEFAULT_SHAPE): readonly number[] {
  if (total <= 0) return [];
  if (total <= shape.max) return [total];

  let count = Math.max(1, Math.round(total / shape.target));
  // Never exceed the ceiling...
  while (Math.ceil(total / count) > shape.max) count += 1;
  // ...and never fall under the floor, as long as dropping a lesson can fix it
  // without breaking the ceiling. The ceiling wins: a lesson too long to finish
  // is a worse failure than one that ends a little early.
  while (
    count > 1
    && Math.floor(total / count) < shape.min
    && Math.ceil(total / (count - 1)) <= shape.max
  ) count -= 1;

  const base = Math.floor(total / count);
  const remainder = total % count;
  // The larger lessons go first: a course should not get heavier as it goes.
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

export interface Lesson {
  readonly id: string;
  /** The category or level this lesson was cut from. */
  readonly groupId: string;
  /** The group's name as the content supplies it — content, not UI chrome. */
  readonly groupTitle: string;
  /** 1-based position within its group. */
  readonly index: number;
  /** How many lessons the group has, so a UI can say "3 of 9". */
  readonly total: number;
  /** The level most of its items carry; null when the group has no levels. */
  readonly level: CefrLevel | null;
  readonly itemIds: readonly string[];
}

/** Two digits so lesson ids sort lexically the way they read. */
const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * Cut one ordered group of items into lessons.
 *
 * Items are sorted by `teachingOrder`, so a lesson is not a random slice: early
 * lessons hold the common, low-level words and later ones the rarer material.
 */
export function buildLessonGroup(
  groupId: string,
  groupTitle: string,
  items: readonly VocabularyItem[],
  shape: LessonShape = DEFAULT_SHAPE,
): readonly Lesson[] {
  const ordered = items.slice().sort(teachingOrder);
  const sizes = splitSizes(ordered.length, shape);
  const lessons: Lesson[] = [];
  let cursor = 0;

  for (const [i, size] of sizes.entries()) {
    const slice = ordered.slice(cursor, cursor + size);
    cursor += size;
    lessons.push({
      id: `${groupId}-l${pad(i + 1)}`,
      groupId,
      groupTitle,
      index: i + 1,
      total: sizes.length,
      level: dominantLevel(slice),
      itemIds: slice.map((item) => item.id),
    });
  }
  return lessons;
}

/** The level a lesson is best labelled with: the one most of its items carry. */
function dominantLevel(items: readonly VocabularyItem[]): CefrLevel | null {
  const counts = new Map<CefrLevel, number>();
  for (const item of items) {
    if (item.level) counts.set(item.level, (counts.get(item.level) ?? 0) + 1);
  }
  let best: CefrLevel | null = null;
  let bestCount = 0;
  for (const level of CEFR_LEVELS) {
    const count = counts.get(level) ?? 0;
    // Ties go to the lower level: labelling a mixed lesson with the harder one
    // scares people away from material they can handle.
    if (count > bestCount) { best = level; bestCount = count; }
  }
  return best;
}

export interface LessonBuildOptions {
  readonly shape?: LessonShape;
  /** Titles for group ids. Falls back to the id when a title is missing. */
  readonly titles?: Readonly<Record<string, string>>;
}

/**
 * Lessons for every category in the repository (§5).
 *
 * An item in three categories appears in three lessons. That is intentional:
 * categories are ways in, not a partition, and the scheduler deduplicates by
 * item id when a session is planned.
 */
export function lessonsByCategory<L extends LanguageCode>(
  repository: ContentRepository<L>,
  options: LessonBuildOptions = {},
): readonly Lesson[] {
  const shape = options.shape ?? DEFAULT_SHAPE;
  const out: Lesson[] = [];
  for (const category of repository.categories()) {
    const items = repository.vocabulary({ category });
    out.push(...buildLessonGroup(category, options.titles?.[category] ?? category, items, shape));
  }
  return out;
}

/**
 * Lessons for every CEFR level.
 *
 * The path for a learner who wants "A2" rather than "food". It also covers the
 * items no topical category claims — roughly half the corpus comes from word
 * lists that are organised by level and nothing else — so no card is
 * unreachable through some route.
 */
export function lessonsByLevel<L extends LanguageCode>(
  repository: ContentRepository<L>,
  options: LessonBuildOptions = {},
): readonly Lesson[] {
  const shape = options.shape ?? DEFAULT_SHAPE;
  const out: Lesson[] = [];
  for (const level of CEFR_LEVELS) {
    const items = repository.vocabulary({ levels: [level] });
    if (items.length === 0) continue;
    const id = level.toLowerCase();
    out.push(...buildLessonGroup(id, options.titles?.[id] ?? level, items, shape));
  }
  return out;
}

// --- progress through a lesson -----------------------------------------------

export interface LessonStatus {
  readonly lessonId: string;
  readonly total: number;
  /** Items the learner has answered at least once. */
  readonly seen: number;
  /** Items the scheduler now treats as known rather than being learned. */
  readonly learned: number;
  readonly mastered: number;
  /** Learned / total, 0–1. What a progress ring should show. */
  readonly completion: number;
  /** Every item learned. The lesson can be marked finished. */
  readonly complete: boolean;
  /** Started but not finished — what a "continue" button should point at. */
  readonly started: boolean;
}

/**
 * Where a learner stands in one lesson.
 *
 * "Learned" deliberately means the scheduler's own verdict, not "was shown". An
 * item answered once and forgotten is not progress, and a completion bar that
 * counts it is lying to the person reading it.
 */
export function lessonStatus(
  lesson: Lesson,
  progress: ReadonlyMap<string, ItemProgress>,
): LessonStatus {
  let seen = 0;
  let learned = 0;
  let mastered = 0;

  for (const itemId of lesson.itemIds) {
    const record = progress.get(itemId);
    if (!record?.seen) continue;
    seen += 1;
    if (record.state === 'review' || record.state === 'strong' || record.state === 'mastered') {
      learned += 1;
    }
    if (record.state === 'mastered') mastered += 1;
  }

  const total = lesson.itemIds.length;
  return {
    lessonId: lesson.id,
    total,
    seen,
    learned,
    mastered,
    completion: total === 0 ? 0 : learned / total,
    complete: total > 0 && learned === total,
    started: seen > 0 && learned < total,
  };
}

/**
 * The lesson to open next.
 *
 * A lesson already started outranks a fresh one — finishing what is open beats
 * starting something new, and it is also what a learner expects the button to
 * do. Otherwise it is the first unfinished lesson in order.
 */
export function nextLesson(
  lessons: readonly Lesson[],
  progress: ReadonlyMap<string, ItemProgress>,
): Lesson | null {
  let firstUntouched: Lesson | null = null;
  for (const lesson of lessons) {
    const status = lessonStatus(lesson, progress);
    if (status.started) return lesson;
    if (!status.complete && !firstUntouched) firstUntouched = lesson;
  }
  return firstUntouched;
}

/** Every lesson a given item appears in — an item can sit in several categories. */
export function lessonsForItem(lessons: readonly Lesson[], itemId: string): readonly Lesson[] {
  return lessons.filter((lesson) => lesson.itemIds.includes(itemId));
}
