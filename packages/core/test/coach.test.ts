/**
 * The coach's evidence.
 *
 * The property being defended: every number comes from a record the learner
 * produced. A coach that says "you've mastered travel vocabulary" when they
 * have not teaches them the app is not really looking, and after that nothing
 * it says counts either.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { advise, buildEvidence } from '../src/coach.ts';
import { newProgress, review } from '../src/srs.ts';
import {
  GRADE, type AttemptRecord, type CefrLevel, type GrammarTopic, type Grade,
  type ItemProgress, type VocabularyItem,
} from '../src/types.ts';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 14, 12, 0, 0);

function item(
  id: string, over: Partial<VocabularyItem<'de'>> = {},
): VocabularyItem<'de'> {
  return {
    id,
    language: 'de',
    term: `Wort-${id}`,
    translation: `meaning-${id}`,
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

const items = [
  item('a', { categories: ['home/home-life'] }),
  item('b', { categories: ['home/home-life'] }),
  item('c', { level: 'A2', categories: ['travel/holidays'] }),
  item('d', { level: 'A2' }),
  item('e', { level: 'B1' }),
];

/** Answer an item a series of grades, one a day apart. */
function history(itemId: string, grades: readonly Grade[], from = T0 - 10 * DAY): ItemProgress {
  let record = newProgress('u1', itemId);
  let when = from;
  for (const grade of grades) {
    record = review(record, grade, { now: when });
    when += DAY;
  }
  return record;
}

const attempt = (itemId: string, at: number, correct: boolean): AttemptRecord => ({
  userId: 'u1', itemId, at, correct,
  grade: correct ? GRADE.GOOD : GRADE.AGAIN,
  given: '', expected: '', exerciseKind: 'choice',
});

const map = (...records: ItemProgress[]) => new Map(records.map((r) => [r.itemId, r]));

describe('a learner who has done nothing', () => {
  const evidence = buildEvidence({ items, progress: new Map(), now: T0 });

  test('is described as having done nothing, not as a beginner doing well', () => {
    assert.equal(evidence.empty, true);
    assert.equal(evidence.vocabulary.seen, 0);
    assert.equal(evidence.vocabulary.learned, 0);
    assert.equal(evidence.recentAccuracy, null, 'an accuracy was invented from no answers');
    assert.deepEqual(evidence.weakest, []);
  });

  test('the totals that do not depend on the learner are still real', () => {
    assert.equal(evidence.vocabulary.total, 5);
    assert.equal(evidence.byLevel.A1?.total, 2);
    assert.equal(evidence.byLevel.A2?.seen, 0);
  });

  test('and the only advice is to start', () => {
    const advice = advise(evidence);
    assert.equal(advice.length, 1);
    assert.equal(advice[0]?.kind, 'nothing-yet');
  });
});

describe('counting what the learner did', () => {
  test('seen, learned and mastered are the scheduler\'s verdicts, not attempt counts', () => {
    const failed = history('a', [GRADE.AGAIN]);
    const known = history('b', [GRADE.GOOD, GRADE.GOOD]);
    const evidence = buildEvidence({ items, progress: map(failed, known), now: T0 });

    assert.equal(evidence.vocabulary.seen, 2);
    assert.equal(evidence.vocabulary.learned, 1, 'a failed item counted as learned');
    assert.equal(evidence.empty, false);
  });

  test('due counts what the scheduler says is due now', () => {
    const old = history('a', [GRADE.GOOD], T0 - 60 * DAY);
    const fresh = history('b', [GRADE.GOOD], T0);
    const evidence = buildEvidence({ items, progress: map(old, fresh), now: T0 });
    assert.equal(evidence.vocabulary.due, 1);
    assert.equal(evidence.mostOverdue[0]?.itemId, 'a');
    assert.ok((evidence.mostOverdue[0]?.days ?? 0) > 0);
  });

  test('levels and categories are counted from the items themselves', () => {
    const evidence = buildEvidence({
      items,
      progress: map(history('a', [GRADE.GOOD, GRADE.GOOD]), history('c', [GRADE.GOOD, GRADE.GOOD])),
      now: T0,
    });
    assert.equal(evidence.byLevel.A1?.learned, 1);
    assert.equal(evidence.byLevel.A2?.learned, 1);
    assert.equal(evidence.byLevel.B1?.seen, 0);
    const home = evidence.categories.find((c) => c.category === 'home/home-life');
    assert.deepEqual(home, { category: 'home/home-life', total: 2, seen: 1, learned: 1 });
  });

  test('grammar exercises are counted separately from words', () => {
    const topic: GrammarTopic = {
      id: 'g1', language: 'de', level: 'A1', title: 'T', titleInSourceLanguage: 'T',
      summary: '', explanation: [], rules: [], examples: [],
      exercises: [
        { id: 'g1-e1', kind: 'typing', prompt: '', text: '', options: [], answers: ['x'], hint: '', explanation: '', fromSource: false },
        { id: 'g1-e2', kind: 'typing', prompt: '', text: '', options: [], answers: ['y'], hint: '', explanation: '', fromSource: false },
      ],
      prerequisites: [], difficulty: 1, category: 'Verben', tables: [], source: { title: 't', page: 0 },
    };
    const evidence = buildEvidence({
      items, topics: [topic],
      progress: map(history('g1-e1', [GRADE.GOOD, GRADE.GOOD])),
      now: T0,
    });
    assert.equal(evidence.grammar.topics, 1);
    assert.equal(evidence.grammar.exercisesSeen, 1);
    assert.equal(evidence.grammar.exercisesLearned, 1);
    assert.equal(evidence.vocabulary.seen, 0, 'a grammar exercise was counted as a word');
  });
});

describe('weakness', () => {
  test('one miss on first contact is not a weakness', () => {
    const evidence = buildEvidence({ items, progress: map(history('a', [GRADE.AGAIN])), now: T0 });
    assert.equal(evidence.vocabulary.weak, 0);
    assert.deepEqual(evidence.weakest, []);
  });

  test('repeatedly getting it wrong is', () => {
    const struggling = history('a', [GRADE.AGAIN, GRADE.AGAIN, GRADE.GOOD]);
    const evidence = buildEvidence({ items, progress: map(struggling), now: T0 });
    assert.equal(evidence.vocabulary.weak, 1);
    assert.equal(evidence.weakest[0]?.itemId, 'a');
    assert.equal(evidence.weakest[0]?.incorrect, 2);
    assert.equal(evidence.weakest[0]?.term, 'Wort-a', 'the coach cannot name the word it means');
  });

  test('the worst come first, and the list is capped', () => {
    const records = [
      history('a', [GRADE.AGAIN, GRADE.AGAIN, GRADE.AGAIN]),
      history('b', [GRADE.AGAIN, GRADE.AGAIN, GRADE.GOOD]),
      history('c', [GRADE.AGAIN, GRADE.AGAIN]),
    ];
    const evidence = buildEvidence({ items, progress: map(...records), now: T0, limit: 2 });
    assert.equal(evidence.weakest.length, 2);
    assert.ok((evidence.weakest[0]?.accuracy ?? 1) <= (evidence.weakest[1]?.accuracy ?? 1));
  });
});

describe('accuracy', () => {
  test('counts first attempts only', () => {
    const attempts = [
      attempt('a', T0 - 3 * DAY, false),
      attempt('a', T0 - 2 * DAY, true),
      attempt('a', T0 - DAY, true),
      attempt('b', T0 - DAY, true),
    ];
    const evidence = buildEvidence({ items, progress: new Map(), attempts, now: T0 });
    assert.equal(evidence.attemptsConsidered, 2);
    assert.equal(evidence.recentAccuracy, 0.5,
      'the corrected retry was counted as if the learner had known it');
  });

  test('no attempts means no accuracy, not zero', () => {
    const evidence = buildEvidence({ items, progress: new Map(), attempts: [], now: T0 });
    assert.equal(evidence.recentAccuracy, null);
  });

  test('the streak comes from the attempt times', () => {
    const attempts = [1, 2, 3].map((d) => attempt(`w${d}`, T0 - d * DAY, true));
    const evidence = buildEvidence({ items, progress: new Map(), attempts, now: T0 });
    assert.equal(evidence.streak.current, 3);
    assert.equal(evidence.streak.activeToday, false);
  });
});

describe('the advice', () => {
  test('overdue reviews outrank everything — a backlog is how people stop opening it', () => {
    const records = [
      history('a', [GRADE.GOOD], T0 - 60 * DAY),
      history('b', [GRADE.AGAIN, GRADE.AGAIN, GRADE.GOOD]),
    ];
    const advice = advise(buildEvidence({ items, progress: map(...records), now: T0 }));
    assert.equal(advice[0]?.kind, 'reviews-due');
    assert.ok(advice.some((entry) => entry.kind === 'weak-items'));
  });

  test('every piece carries the numbers behind it, and no prose', () => {
    const advice = advise(buildEvidence({
      items, progress: map(history('a', [GRADE.AGAIN, GRADE.AGAIN])), now: T0,
    }));
    for (const entry of advice) {
      assert.ok(Object.keys(entry.facts).length > 0, `${entry.kind} carries no facts`);
      for (const value of Object.values(entry.facts)) {
        assert.ok(typeof value === 'number' || typeof value === 'string');
      }
      assert.equal('text' in entry, false, 'advice carries prose the UI cannot translate');
    }
  });

  test('a low accuracy is reported only once there are enough answers to mean it', () => {
    const few = [attempt('a', T0, false), attempt('b', T0, false)];
    const thin = advise(buildEvidence({ items, progress: new Map(), attempts: few, now: T0 }));
    assert.equal(thin.some((entry) => entry.kind === 'accuracy-low'), false,
      'two wrong answers were called a low accuracy');

    const many = Array.from({ length: 12 }, (_, i) => attempt(`w${i}`, T0, i < 4));
    const solid = advise(buildEvidence({ items, progress: new Map(), attempts: many, now: T0 }));
    assert.ok(solid.some((entry) => entry.kind === 'accuracy-low'));
  });

  test('a streak at risk is mentioned; one already kept today is not', () => {
    const yesterday = [1, 2].map((d) => attempt(`w${d}`, T0 - d * DAY, true));
    const atRisk = advise(buildEvidence({ items, progress: new Map(), attempts: yesterday, now: T0 }));
    assert.ok(atRisk.some((entry) => entry.kind === 'keep-streak'));

    const includingToday = [...yesterday, attempt('w0', T0, true)];
    const safe = advise(buildEvidence({ items, progress: new Map(), attempts: includingToday, now: T0 }));
    assert.equal(safe.some((entry) => entry.kind === 'keep-streak'), false);
  });

  test('new material is suggested only when nothing is owed', () => {
    const clear = advise(buildEvidence({
      items, progress: map(history('a', [GRADE.GOOD], T0)), now: T0,
    }));
    assert.ok(clear.some((entry) => entry.kind === 'new-material'));

    const owed = advise(buildEvidence({
      items, progress: map(history('a', [GRADE.GOOD], T0 - 60 * DAY)), now: T0,
    }));
    assert.equal(owed.some((entry) => entry.kind === 'new-material'), false);
  });

  test('the same records always produce the same advice', () => {
    const records = map(history('a', [GRADE.AGAIN, GRADE.AGAIN]), history('b', [GRADE.GOOD]));
    const once = advise(buildEvidence({ items, progress: records, now: T0 }));
    const twice = advise(buildEvidence({ items, progress: records, now: T0 }));
    assert.deepEqual(once, twice);
  });
});
