/**
 * Experience, levels and achievements.
 *
 * The thing being defended is that none of it can be earned without doing the
 * work. A badge for something the learner did not do is worth less than no
 * badge — it tells them the whole scoreboard is decoration, and then the streak
 * stops working too.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  achievements, earned, levelFor, spanOf, totalXp, xpFor,
} from '../src/achievements.ts';
import { buildEvidence } from '../src/coach.ts';
import { newProgress, review } from '../src/srs.ts';
import { GRADE, type AttemptRecord, type CefrLevel, type ExerciseKind, type Grade, type VocabularyItem } from '../src/types.ts';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 14, 12, 0, 0);

const attempt = (
  itemId: string, at: number, correct: boolean, exerciseKind: ExerciseKind = 'choice',
): AttemptRecord => ({
  userId: 'u1', itemId, at, correct,
  grade: correct ? GRADE.GOOD : GRADE.AGAIN,
  given: '', expected: '', exerciseKind,
});

function item(id: string, over: Partial<VocabularyItem<'de'>> = {}): VocabularyItem<'de'> {
  return {
    id, language: 'de', term: `Wort-${id}`, translation: `meaning-${id}`,
    translationProvenance: 'wordlist', wordType: 'noun',
    level: 'A1' as CefrLevel, levelProvenance: { kind: 'stated', sources: ['t'] },
    example: '', exampleTranslation: '', categories: [],
    source: { title: 't', page: 0 }, frequencyRank: 0,
    metadata: {
      article: '', pluralForm: '', verbForms: {}, preposition: '',
      regionalVariant: '', isPluralEntry: false,
    },
    needsReview: false, note: '',
    ...over,
  };
}

describe('what an answer is worth', () => {
  test('producing the word beats recognising it', () => {
    assert.ok(xpFor(attempt('a', T0, true, 'typing')) > xpFor(attempt('a', T0, true, 'recognise')));
    assert.ok(xpFor(attempt('a', T0, true, 'recall')) > xpFor(attempt('a', T0, true, 'choice')));
  });

  test('a wrong answer earns nothing and costs nothing', () => {
    assert.equal(xpFor(attempt('a', T0, false, 'typing')), 0);
    // Nothing in the scoring can go negative: a score people protect is a score
    // they protect by not practising.
    assert.ok(totalXp([attempt('a', T0, false), attempt('b', T0, false)]) >= 0);
  });

  test('THE exploit this closes: re-answering one word all afternoon', () => {
    const grinding = Array.from({ length: 200 }, (_, i) => attempt('haus', T0 + i * 1_000, true, 'typing'));
    const studying = ['a', 'b', 'c', 'd', 'e'].map((id) => attempt(id, T0, true, 'typing'));
    assert.equal(totalXp(grinding), xpFor(attempt('haus', T0, true, 'typing')),
      'the same word counted more than once in a day');
    assert.ok(totalXp(studying) > totalXp(grinding));
  });

  test('the same word on a different day counts again — that is review', () => {
    const across = [attempt('haus', T0, true), attempt('haus', T0 + DAY, true)];
    assert.equal(totalXp(across), 2 * xpFor(attempt('haus', T0, true)));
  });

  test('nothing studied is nothing earned', () => {
    assert.equal(totalXp([]), 0);
  });
});

describe('levels', () => {
  test('everyone starts at level one with nothing', () => {
    const level = levelFor(0);
    assert.equal(level.level, 1);
    assert.equal(level.into, 0);
    assert.equal(level.progress, 0);
  });

  test('the first level takes exactly its span', () => {
    assert.equal(levelFor(spanOf(1) - 1).level, 1);
    assert.equal(levelFor(spanOf(1)).level, 2);
  });

  test('levels get longer, but not punishingly', () => {
    for (let n = 1; n < 20; n += 1) assert.ok(spanOf(n + 1) > spanOf(n));
    // Level 20 should not cost more than a few times level 1.
    assert.ok(spanOf(20) < spanOf(1) * 12, 'the curve turned into a wall');
  });

  test('progress through a level is reported, not just the level', () => {
    const level = levelFor(spanOf(1) + 50);
    assert.equal(level.level, 2);
    assert.equal(level.into, 50);
    assert.equal(level.span, spanOf(2));
    assert.ok(level.progress > 0 && level.progress < 1);
  });

  test('a nonsense total does not produce a nonsense level', () => {
    assert.equal(levelFor(-500).level, 1);
    assert.equal(levelFor(Number.NaN).level, 1);
  });

  test('levels are monotonic in XP', () => {
    let previous = 0;
    for (let xp = 0; xp < 20_000; xp += 97) {
      const level = levelFor(xp).level;
      assert.ok(level >= previous);
      previous = level;
    }
  });
});

describe('achievements', () => {
  const items = Array.from({ length: 60 }, (_, i) => item(`w${i}`));
  const learnedProgress = (count: number) => new Map(
    items.slice(0, count).map((entry) => {
      let record = review(newProgress('u1', entry.id), GRADE.GOOD as Grade, { now: T0 - DAY });
      record = review(record, GRADE.GOOD as Grade, { now: T0 });
      return [entry.id, record];
    }),
  );

  test('an untouched learner has earned none of them, and is told how far off', () => {
    const list = achievements(buildEvidence({ items, progress: new Map(), now: T0 }), levelFor(0));
    assert.equal(earned(list).length, 0);
    const first = list.find((entry) => entry.id === 'first-word');
    assert.deepEqual(first, { id: 'first-word', progress: 0, target: 1, earned: false });
  });

  test('every achievement reports progress, not just a locked icon', () => {
    const list = achievements(buildEvidence({ items, progress: learnedProgress(30), now: T0 }), levelFor(0));
    const fifty = list.find((entry) => entry.id === 'words-50');
    assert.equal(fifty?.progress, 30);
    assert.equal(fifty?.earned, false);
  });

  test('progress never overshoots its target', () => {
    const list = achievements(buildEvidence({ items, progress: learnedProgress(60), now: T0 }), levelFor(99_999));
    for (const entry of list) assert.ok(entry.progress <= entry.target, entry.id);
  });

  test('learning one word earns the first one and nothing else', () => {
    const list = achievements(buildEvidence({ items, progress: learnedProgress(1), now: T0 }), levelFor(0));
    assert.deepEqual(earned(list).map((entry) => entry.id), ['first-word']);
  });

  test('THE dishonesty this avoids: three right answers is not 90% accuracy', () => {
    const three = [1, 2, 3].map((i) => attempt(`w${i}`, T0, true));
    const thin = achievements(
      buildEvidence({ items, progress: new Map(), attempts: three, now: T0 }), levelFor(0),
    );
    assert.equal(thin.find((entry) => entry.id === 'accuracy-90')?.earned, false);

    const many = Array.from({ length: 60 }, (_, i) => attempt(`w${i}`, T0, i < 57));
    const solid = achievements(
      buildEvidence({ items, progress: new Map(), attempts: many, now: T0 }), levelFor(0),
    );
    assert.equal(solid.find((entry) => entry.id === 'accuracy-90')?.earned, true);
  });

  test('a streak badge is not taken back by one missed day', () => {
    // Studied seven days running, then stopped for a week.
    const week = Array.from({ length: 7 }, (_, i) => attempt(`w${i}`, T0 - (i + 8) * DAY, true));
    const evidence = buildEvidence({ items, progress: new Map(), attempts: week, now: T0 });
    assert.equal(evidence.streak.current, 0, 'precondition: the current streak is broken');
    const list = achievements(evidence, levelFor(0));
    assert.equal(list.find((entry) => entry.id === 'streak-7')?.earned, true,
      'a badge already earned was taken away');
  });

  test('grammar is its own achievement, not folded into vocabulary', () => {
    const list = achievements(buildEvidence({ items, progress: learnedProgress(60), now: T0 }), levelFor(0));
    assert.equal(list.find((entry) => entry.id === 'grammar-started')?.earned, false);
  });

  test('the same records always produce the same achievements', () => {
    const evidence = buildEvidence({ items, progress: learnedProgress(12), now: T0 });
    assert.deepEqual(achievements(evidence, levelFor(500)), achievements(evidence, levelFor(500)));
  });
});
