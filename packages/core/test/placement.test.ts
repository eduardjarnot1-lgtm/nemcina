/**
 * Placing a new learner.
 *
 * The failure this guards against is quiet: someone with school German is put
 * at lesson one of A1, spends a week on *und* and *nicht*, and leaves without
 * ever filing a complaint. So the tests are mostly about where people end up,
 * and about the test not fabricating knowledge it did not measure.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOCK_SIZE, MAX_QUESTIONS, PLACEMENT_LEVELS, PlacementTest, levelsFrom,
} from '../src/placement.ts';
import type { CefrLevel, VocabularyItem, WordType } from '../src/types.ts';

function item(
  id: string, level: CefrLevel, over: Partial<VocabularyItem<'de'>> = {},
): VocabularyItem<'de'> {
  return {
    id,
    language: 'de',
    term: `Wort-${id}`,
    translation: `meaning-${id}`,
    translationProvenance: 'wordlist',
    wordType: 'noun' as WordType,
    level,
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

/** Twenty items per level: enough for a block plus distractors, several times. */
const corpus = PLACEMENT_LEVELS.flatMap((level) =>
  Array.from({ length: 20 }, (_, i) => item(`${level}-${i}`, level)));

const fixed = () => 0.5;
const start = (options: Parameters<typeof PlacementTest.create>[1] = {}) =>
  PlacementTest.create(corpus, { random: fixed, ...options });

/**
 * Run a test, answering by a rule that says how well the learner knows a level.
 * `knows` returns how many of the five in a block they get right.
 */
function run(
  test_: PlacementTest,
  knows: (level: CefrLevel) => number,
): PlacementTest {
  const remaining = new Map<CefrLevel, number>();
  let seenInBlock = 0;
  let blockLevel: CefrLevel | null = null;

  while (!test_.finished) {
    const question = test_.current;
    const level = test_.currentLevel;
    assert.ok(question && level);
    if (level !== blockLevel) {
      blockLevel = level;
      seenInBlock = 0;
      remaining.set(level, knows(level));
    }
    const budget = remaining.get(level) ?? 0;
    const answerCorrectly = seenInBlock < budget;
    seenInBlock += 1;
    test_.answer(answerCorrectly ? (question.answers[0] as string) : 'definitely wrong');
  }
  return test_;
}

const all = (n: number) => () => n;

describe('the shape of the test', () => {
  test('it starts in the middle of the ladder, not at the bottom', () => {
    assert.equal(start().currentLevel, 'A2');
  });

  test('it asks recognition, not spelling — reading is what is being measured', () => {
    const question = start().current;
    assert.equal(question?.kind, 'recognise');
    assert.equal(question?.producedTargetLanguage, false);
    assert.equal(question?.options.length, 4);
  });

  test('no word is asked twice', () => {
    const placement = start();
    const seen = new Set<string>();
    while (!placement.finished) {
      const id = placement.currentItem?.id as string;
      assert.equal(seen.has(id), false, `${id} was asked twice`);
      seen.add(id);
      placement.answer(placement.current?.answers[0] as string);
    }
  });

  test('it never runs longer than its cap', () => {
    for (const correctPerBlock of [0, 1, 2, 3, 4, 5]) {
      const placement = run(start(), all(correctPerBlock));
      assert.ok(placement.result);
      assert.ok(placement.result.asked <= MAX_QUESTIONS,
        `${correctPerBlock}/5 produced ${placement.result.asked} questions`);
    }
  });

  test('answering past the end is an error, not a silent no-op', () => {
    const placement = run(start(), all(5));
    assert.throws(() => placement.answer('x'), /no current question/);
  });
});

describe('where people end up', () => {
  test('a true beginner is placed at A1', () => {
    // Nothing right anywhere.
    const result = run(start(), all(0)).result;
    assert.equal(result?.level, 'A1');
  });

  test('THE case this exists for: someone with school German does not start at A1', () => {
    // Comfortable up to B1, lost at B2.
    const result = run(start(), (level) => (level === 'B2' ? 0 : 5)).result;
    assert.equal(result?.level, 'B2');
    assert.equal(result?.confidence, 'bracketed');
  });

  test('passing a level places the learner above it, not back in it', () => {
    // Comfortable at A2, lost at B1.
    const result = run(start(), (level) => (level === 'A2' ? 5 : 0)).result;
    assert.equal(result?.level, 'B1');
  });

  test('half-knowing a level places the learner in it — half-known is not known', () => {
    const result = run(start(), all(3)).result;
    assert.equal(result?.level, 'A2');
    assert.equal(result?.confidence, 'partial');
  });

  test('the regression: failing A2 and half-knowing A1 places at A1, not A2', () => {
    const result = run(start(), (level) => (level === 'A1' ? 3 : 0)).result;
    assert.equal(result?.level, 'A1', 'a half-known A1 was treated as a passed one');
  });

  test('someone who knows everything is placed at the top rather than off the end', () => {
    const result = run(start(), all(5)).result;
    assert.equal(result?.level, 'B2');
    assert.equal(result?.confidence, 'bracketed');
  });

  test('failing the start and passing the level below brackets the answer', () => {
    // Good at A1, lost at A2.
    const result = run(start(), (level) => (level === 'A1' ? 5 : 0)).result;
    assert.equal(result?.level, 'A2');
    assert.equal(result?.confidence, 'bracketed');
  });

  test('the result says how it was reached, per level', () => {
    const result = run(start(), (level) => (level === 'A2' ? 5 : 0)).result;
    assert.ok(result);
    assert.equal(result.byLevel.A2?.asked, BLOCK_SIZE);
    assert.equal(result.byLevel.A2?.correct, BLOCK_SIZE);
    assert.equal(result.byLevel.B1?.correct, 0);
    assert.equal(result.asked, result.byLevel.A2!.asked + result.byLevel.B1!.asked);
  });

  test('a different starting level reaches the same place', () => {
    const fromBottom = run(start({ startLevel: 'A1' }), (l) => (l === 'B2' ? 0 : 5)).result;
    const fromMiddle = run(start({ startLevel: 'A2' }), (l) => (l === 'B2' ? 0 : 5)).result;
    assert.equal(fromBottom?.level, fromMiddle?.level);
  });
});

describe('content the test cannot ask about', () => {
  test('a level with too few words is skipped rather than asked badly', () => {
    const thin = [
      ...Array.from({ length: 20 }, (_, i) => item(`A1-${i}`, 'A1')),
      item('B2-only', 'B2'),
    ];
    const placement = PlacementTest.create(thin, { random: fixed, startLevel: 'A1' });
    const result = run(placement, all(5)).result;
    assert.ok(result);
    // A1 is passed, B2 cannot be asked, so the test stops rather than inventing.
    assert.equal(result.byLevel.B2, undefined);
  });

  test('no content at all finishes immediately instead of hanging', () => {
    const placement = PlacementTest.create([], { random: fixed });
    assert.equal(placement.finished, true);
    assert.equal(placement.current, null);
    assert.equal(placement.result?.level, 'A1');
    assert.equal(placement.result?.confidence, 'exhausted');
  });

  test('items with no translation are not askable', () => {
    const blank = Array.from({ length: 20 }, (_, i) => item(`A1-${i}`, 'A1', { translation: '  ' }));
    assert.equal(PlacementTest.create(blank, { random: fixed }).finished, true);
  });
});

describe('what the result is allowed to imply', () => {
  test('placement produces no progress records — it measured, it did not teach', () => {
    const result = run(start(), all(5)).result;
    assert.ok(result);
    // The result carries counts and a level. There is deliberately nothing here
    // that a scheduler could mistake for review history.
    assert.deepEqual(Object.keys(result).sort(),
      ['asked', 'byLevel', 'confidence', 'correct', 'level']);
  });

  test('levelsFrom offers the placed level and everything above it', () => {
    assert.deepEqual(levelsFrom('B1'), ['B1', 'B2', 'C1', 'C2']);
    assert.deepEqual(levelsFrom('A1').length, 6);
  });
});
