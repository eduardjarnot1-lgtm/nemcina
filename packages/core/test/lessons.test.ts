/**
 * Lessons.
 *
 * The thing being protected here is finishability. A category of 430 words has
 * to become a row of small units a person can complete, in an order that puts
 * the useful words first, with no stub lesson of one word at the end and no
 * lesson so long nobody gets through it.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryContentRepository } from '../src/content.ts';
import {
  DEFAULT_SHAPE, buildLessonGroup, lessonStatus, lessonsByCategory, lessonsByLevel,
  lessonsForItem, nextLesson, splitSizes,
} from '../src/lessons.ts';
import { newProgress, review } from '../src/srs.ts';
import { GRADE, type CefrLevel, type ItemProgress, type VocabularyItem } from '../src/types.ts';

function item(over: Partial<VocabularyItem<'de'>> & { id: string; term: string }): VocabularyItem<'de'> {
  return {
    language: 'de',
    translation: over.term,
    translationProvenance: 'wordlist',
    wordType: 'noun',
    level: 'A1' as CefrLevel,
    levelProvenance: { kind: 'stated', sources: ['test'] },
    example: '',
    exampleTranslation: '',
    categories: [],
    source: { title: 'test', page: 0 },
    frequencyRank: 0,
    metadata: {
      article: '', pluralForm: '', verbForms: {}, preposition: '',
      regionalVariant: '', isPluralEntry: false,
    },
    needsReview: false,
    note: '',
    ...over,
  };
}

/** `count` items, ranked 1..count so teaching order is fully determined. */
const ladder = (count: number, over: Partial<VocabularyItem<'de'>> = {}) =>
  Array.from({ length: count }, (_, i) =>
    item({ id: `i${String(i + 1).padStart(3, '0')}`, term: `w${i + 1}`, frequencyRank: i + 1, ...over }));

describe('cutting a group into lesson-sized pieces', () => {
  test('a group that already fits is one lesson', () => {
    assert.deepEqual(splitSizes(20), [20]);
    assert.deepEqual(splitSizes(15), [15]);
  });

  test('a group too small for a full lesson is still one lesson, not zero', () => {
    assert.deepEqual(splitSizes(6), [6]);
    assert.deepEqual(splitSizes(1), [1]);
  });

  test('nothing splits into nothing', () => {
    assert.deepEqual(splitSizes(0), []);
    assert.deepEqual(splitSizes(-3), []);
  });

  test('THE regression: no stub lesson at the end', () => {
    // Greedy filling would give 15/15/1 here. One word is not a lesson.
    assert.deepEqual(splitSizes(31), [16, 15]);
    assert.deepEqual(splitSizes(21), [11, 10]);
    assert.deepEqual(splitSizes(46), [16, 15, 15]);
  });

  test('every lesson of a large group stays inside the 10–20 band', () => {
    for (let total = 21; total <= 500; total += 1) {
      const sizes = splitSizes(total);
      assert.equal(sizes.reduce((a, b) => a + b, 0), total, `sizes do not sum for ${total}`);
      for (const size of sizes) {
        assert.ok(size >= DEFAULT_SHAPE.min, `${total} produced a lesson of ${size}`);
        assert.ok(size <= DEFAULT_SHAPE.max, `${total} produced a lesson of ${size}`);
      }
      // Sizes differ by at most one — no lesson is visibly the odd one out.
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `uneven split for ${total}`);
    }
  });

  test('the ceiling wins when the floor and the ceiling cannot both hold', () => {
    const sizes = splitSizes(22, { target: 20, min: 20, max: 21 });
    assert.ok(Math.max(...sizes) <= 21, 'a lesson longer than the maximum was produced');
  });

  test('the earlier lessons are the longer ones — a course should not get heavier', () => {
    const sizes = splitSizes(31);
    assert.ok((sizes[0] as number) >= (sizes[1] as number));
  });
});

describe('building a lesson group', () => {
  const lessons = buildLessonGroup('home/home-life', 'Life in the home', ladder(31));

  test('lessons are numbered, know their group and know how many there are', () => {
    assert.deepEqual(lessons.map((l) => l.id), ['home/home-life-l01', 'home/home-life-l02']);
    assert.deepEqual(lessons.map((l) => l.index), [1, 2]);
    assert.ok(lessons.every((l) => l.total === 2));
    assert.ok(lessons.every((l) => l.groupTitle === 'Life in the home'));
  });

  test('every item lands in exactly one lesson of its group', () => {
    const ids = lessons.flatMap((l) => l.itemIds);
    assert.equal(ids.length, 31);
    assert.equal(new Set(ids).size, 31);
  });

  test('the common words come first — lesson one is not a random slice', () => {
    assert.deepEqual(lessons[0]?.itemIds.slice(0, 3), ['i001', 'i002', 'i003']);
    assert.equal(lessons[1]?.itemIds.at(-1), 'i031');
  });

  test('building twice gives the same lessons — progress is shown against these ids', () => {
    assert.deepEqual(buildLessonGroup('g', 'G', ladder(47)), buildLessonGroup('g', 'G', ladder(47)));
  });

  test('input order does not change the outcome', () => {
    const forwards = buildLessonGroup('g', 'G', ladder(31));
    const backwards = buildLessonGroup('g', 'G', ladder(31).slice().reverse());
    assert.deepEqual(forwards, backwards);
  });

  test('a mixed lesson is labelled with the level most of it carries', () => {
    const mixed = buildLessonGroup('g', 'G', [
      ...ladder(4, { level: 'A2' }),
      ...ladder(2, { level: 'B1' }).map((i) => ({ ...i, id: `b${i.id}` })),
    ]);
    assert.equal(mixed[0]?.level, 'A2');
  });

  test('a group with no levelled items has no level rather than a made-up one', () => {
    const none = buildLessonGroup('g', 'G', ladder(5, {
      level: null, levelProvenance: { kind: 'approximated', basis: 'none' },
    }));
    assert.equal(none[0]?.level, null);
  });
});

describe('lessons across a whole repository', () => {
  const repo = new InMemoryContentRepository('de', [
    ...ladder(25).map((i) => ({ ...i, categories: ['home/home-life'] })),
    ...ladder(12).map((i) => ({ ...i, id: `s${i.id}`, categories: ['education/school'], level: 'B1' as CefrLevel })),
    // A word in two categories: categories are ways in, not a partition.
    { ...item({ id: 'both', term: 'beides', frequencyRank: 1 }), categories: ['home/home-life', 'education/school'] },
  ]);

  test('every category becomes lessons, named from the titles supplied', () => {
    const lessons = lessonsByCategory(repo, { titles: { 'home/home-life': 'Life in the home' } });
    const groups = new Set(lessons.map((l) => l.groupId));
    assert.deepEqual([...groups].sort(), ['education/school', 'home/home-life']);
    assert.equal(lessons.find((l) => l.groupId === 'home/home-life')?.groupTitle, 'Life in the home');
    // No title supplied: the id is used rather than an empty string.
    assert.equal(lessons.find((l) => l.groupId === 'education/school')?.groupTitle, 'education/school');
  });

  test('an item in two categories appears in both, and says so', () => {
    const lessons = lessonsByCategory(repo);
    const found = lessonsForItem(lessons, 'both');
    assert.deepEqual(found.map((l) => l.groupId).sort(), ['education/school', 'home/home-life']);
  });

  test('levels give a second route, and it reaches every levelled card', () => {
    const lessons = lessonsByLevel(repo);
    const covered = new Set(lessons.flatMap((l) => l.itemIds));
    for (const entry of repo.vocabulary()) {
      if (entry.level) assert.ok(covered.has(entry.id), `${entry.id} is unreachable by level`);
    }
    assert.ok(lessons.every((l) => ['a1', 'b1'].includes(l.groupId)));
  });

  test('an empty level produces no lesson rather than an empty one', () => {
    assert.equal(lessonsByLevel(repo).some((l) => l.itemIds.length === 0), false);
    assert.equal(lessonsByLevel(repo).some((l) => l.groupId === 'c2'), false);
  });
});

describe('progress through a lesson', () => {
  const lesson = buildLessonGroup('g', 'G', ladder(10))[0]!;
  const T0 = 1_700_000_000_000;

  const withProgress = (records: readonly ItemProgress[]) =>
    new Map(records.map((record) => [record.itemId, record]));

  test('an untouched lesson is at zero and is not "started"', () => {
    const status = lessonStatus(lesson, new Map());
    assert.equal(status.seen, 0);
    assert.equal(status.completion, 0);
    assert.equal(status.complete, false);
    assert.equal(status.started, false);
  });

  test('being shown a word is not progress — only the scheduler\'s verdict counts', () => {
    // Answered once and got it wrong: seen, but nothing has been learned.
    const wrong = review(newProgress('u1', 'i001'), GRADE.AGAIN, { now: T0 });
    const status = lessonStatus(lesson, withProgress([wrong]));
    assert.equal(status.seen, 1);
    assert.equal(status.learned, 0);
    assert.equal(status.completion, 0);
    assert.equal(status.started, true);
  });

  test('completion tracks learned items and reaches 1 only when all are learned', () => {
    const records = lesson.itemIds.slice(0, 5)
      .map((id) => review(newProgress('u1', id), GRADE.GOOD, { now: T0 }));
    const half = lessonStatus(lesson, withProgress(records));
    assert.equal(half.learned, 5);
    assert.equal(half.completion, 0.5);
    assert.equal(half.complete, false);

    const all = lesson.itemIds.map((id) => review(newProgress('u1', id), GRADE.GOOD, { now: T0 }));
    const done = lessonStatus(lesson, withProgress(all));
    assert.equal(done.complete, true);
    assert.equal(done.started, false, 'a finished lesson is not still in progress');
  });

  test('a lapse takes a finished lesson back below complete — it has to be honest', () => {
    const all = lesson.itemIds.map((id) => review(newProgress('u1', id), GRADE.GOOD, { now: T0 }));
    assert.equal(lessonStatus(lesson, withProgress(all)).complete, true);
    const lapsed = all.map((record, index) =>
      index === 0 ? review(record, GRADE.AGAIN, { now: T0 + 40 * 86_400_000 }) : record);
    const after = lessonStatus(lesson, withProgress(lapsed));
    assert.equal(after.complete, false);
    assert.equal(after.learned, 9);
  });

  test('mastery is counted separately from completion', () => {
    let record = newProgress('u1', 'i001');
    for (let i = 0; i < 12; i += 1) record = review(record, GRADE.EASY, { now: record.dueAt || T0 });
    assert.equal(record.state, 'mastered');
    assert.equal(lessonStatus(lesson, withProgress([record])).mastered, 1);
  });
});

describe('what to open next', () => {
  const lessons = buildLessonGroup('g', 'G', ladder(40));
  const T0 = 1_700_000_000_000;

  test('with nothing done, it is the first lesson', () => {
    assert.equal(nextLesson(lessons, new Map())?.id, 'g-l01');
  });

  test('finishing what is open beats starting something new', () => {
    // Lesson one is finished; lesson two has been touched but not completed.
    const records = [
      ...lessons[0]!.itemIds.map((id) => review(newProgress('u1', id), GRADE.GOOD, { now: T0 })),
      review(newProgress('u1', lessons[1]!.itemIds[0] as string), GRADE.AGAIN, { now: T0 }),
    ];
    assert.equal(nextLesson(lessons, new Map(records.map((r) => [r.itemId, r])))?.id, 'g-l02');
  });

  test('when every lesson is finished there is nothing to open', () => {
    const records = lessons.flatMap((lesson) => lesson.itemIds
      .map((id) => review(newProgress('u1', id), GRADE.GOOD, { now: T0 })));
    assert.equal(nextLesson(lessons, new Map(records.map((r) => [r.itemId, r]))), null);
  });
});
