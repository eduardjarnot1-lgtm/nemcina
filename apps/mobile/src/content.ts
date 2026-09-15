/**
 * The course, loaded once.
 *
 * The content is bundled with the app rather than fetched, because the product
 * has to work on a train (§offline). That costs about four megabytes in the
 * bundle and a parse on first use, so the parse happens once, lazily, and every
 * screen shares the result.
 *
 * This is the only module that knows where the Python pipeline writes its
 * output. If `app/data` ever moves, it moves here and nowhere else.
 */
import {
  InMemoryContentRepository,
  lessonsByCategory,
  lessonsByLevel,
  readCategoryTitles,
  readGrammar,
  readVocabulary,
  type ContentRepository,
  type Lesson,
  type RawGrammarFile,
  type RawVocabularyFile,
} from '@nemcina/core';

import vocabularyJson from '../../../app/data/vocabulary.json';
import grammarJson from '../../../app/data/grammar.json';

export interface Course {
  readonly repository: ContentRepository<'de'>;
  readonly levelLessons: readonly Lesson[];
  readonly topicLessons: readonly Lesson[];
  /** Every lesson, both routes, for lookup by id. */
  readonly lessonsById: ReadonlyMap<string, Lesson>;
}

let course: Course | null = null;

export function loadCourse(): Course {
  if (course) return course;

  const vocabularyFile = vocabularyJson as unknown as RawVocabularyFile;
  const grammarFile = grammarJson as unknown as RawGrammarFile;

  const repository = new InMemoryContentRepository(
    'de',
    readVocabulary(vocabularyFile),
    readGrammar(grammarFile),
  );
  const titles = readCategoryTitles(
    vocabularyJson as unknown as Parameters<typeof readCategoryTitles>[0],
  );

  const levelLessons = lessonsByLevel(repository);
  const topicLessons = lessonsByCategory(repository, { titles });
  const lessonsById = new Map<string, Lesson>();
  for (const lesson of [...levelLessons, ...topicLessons]) lessonsById.set(lesson.id, lesson);

  course = { repository, levelLessons, topicLessons, lessonsById };
  return course;
}
