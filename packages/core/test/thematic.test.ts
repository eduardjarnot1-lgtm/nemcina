import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  clusterStatus, composeLesson, dueItemIds, nextCluster, recommendCluster, reviewSlots,
  vocabularyTopicProgress,
  type CefrLevel, type ItemProgress, type VocabularyCluster, type VocabularyItem,
} from '../src/index.ts';

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

function item(id: string, over: Partial<VocabularyItem<'de'>> = {}): VocabularyItem<'de'> {
  return {
    id, language: 'de', term: `Wort-${id}`, translation: `meaning-${id}`,
    translationProvenance: 'wordlist', wordType: 'noun',
    level: 'A2' as CefrLevel, levelProvenance: { kind: 'stated', sources: ['t'] },
    example: '', exampleTranslation: '', categories: [], cluster: '',
    source: { title: 't', page: 0 }, frequencyRank: 0,
    metadata: {
      article: '', pluralForm: '', verbForms: {}, preposition: '',
      regionalVariant: '', isPluralEntry: false,
    },
    needsReview: false, note: '',
    ...over,
  };
}

function cluster(id: string, itemIds: string[], over: Partial<VocabularyCluster> = {}): VocabularyCluster {
  return {
    id, level: 'A2' as CefrLevel, category: 'a2topics', subcategory: 'travel',
    field: 'airport-flying', name: 'Airport & flying', blurb: '', order: 0,
    preview: itemIds.slice(0, 3), itemIds, ...over,
  };
}

function progress(itemId: string, over: Partial<ItemProgress> = {}): ItemProgress {
  return {
    userId: 'u1', itemId, state: 'review', seen: true,
    correctCount: 2, incorrectCount: 0, repetitionCount: 2,
    lastReviewed: NOW - DAY, dueAt: NOW + DAY,
    difficulty: 5, stability: 10, ...over,
  };
}

/** A record the scheduler wants back now. */
const due = (id: string) => progress(id, { dueAt: NOW - DAY * 3 });
/** A record the learner has actually got wrong. */
const weak = (id: string) =>
  progress(id, { state: 'learning', incorrectCount: 3, correctCount: 1, dueAt: NOW - DAY });

const records = (list: ItemProgress[]) => new Map(list.map((r) => [r.itemId, r]));
const ids = (n: number, prefix = 'c') => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

describe('how a lesson is mixed', () => {
  test('a learner with nothing owed gets a lesson that is all topic', () => {
    // Three slots of filler would be worse than nothing: the words would be
    // ones the scheduler is not asking for, in a lesson that claims to be
    // about airports.
    assert.equal(reviewSlots(0), 0);
  });

  test('a small debt is not cleared in one sitting, and a large one is not either', () => {
    assert.equal(reviewSlots(1), 1, 'never asks for more review than exists');
    assert.equal(reviewSlots(9), 3, 'a modest debt still gets the floor');
    assert.equal(reviewSlots(60), 8, 'a huge debt is capped at the ceiling');
  });

  test('review never takes the majority of a lesson', () => {
    // The guarantee the whole change rests on: whatever the learner's state,
    // the topic is still what the lesson is about.
    for (const owed of [0, 1, 5, 20, 100, 5000]) {
      const slots = reviewSlots(owed);
      assert.ok(slots <= 8, `${owed} owed produced ${slots} review slots of 20`);
    }
  });
});

describe('composing a thematic lesson', () => {
  const topicItems = ids(15).map((id) => item(id));
  const outsiders = ids(30, 'o').map((id) => item(id));
  const target = cluster('a2-travel-airport', ids(15));

  test('a first-time learner gets a coherent lesson and no filler', () => {
    const composed = composeLesson(target, topicItems, outsiders, new Map(), { now: NOW });
    assert.equal(composed.reviewIds.length, 0);
    assert.equal(composed.thematicIds.length, 15);
    // Every word in it comes from the cluster.
    const inCluster = new Set(target.itemIds);
    assert.ok(composed.itemIds.every((id) => inCluster.has(id)));
  });

  test('an overdue pile earns more review slots, and the topic still leads', () => {
    const owed = records(outsiders.slice(0, 24).map((entry) => due(entry.id)));
    const composed = composeLesson(target, topicItems, outsiders, owed, { now: NOW });
    assert.ok(composed.reviewIds.length > 3, 'a backlog should pull in more than the floor');
    assert.ok(
      composed.thematicIds.length > composed.reviewIds.length,
      `topic ${composed.thematicIds.length} vs review ${composed.reviewIds.length}`,
    );
  });

  test('a couple of owed words produce a small review share, not a fixed 30%', () => {
    const owed = records(outsiders.slice(0, 2).map((entry) => due(entry.id)));
    const composed = composeLesson(target, topicItems, outsiders, owed, { now: NOW });
    assert.equal(composed.reviewIds.length, 2);
    assert.equal(composed.thematicIds.length, 15);
  });

  test('failed words outrank merely-due ones in the review half', () => {
    const owed = records([
      ...outsiders.slice(0, 10).map((entry) => due(entry.id)),
      weak('o30'),
    ]);
    const composed = composeLesson(target, topicItems, outsiders, owed, { now: NOW });
    assert.ok(composed.reviewIds.includes('o30'), 'an item the learner has failed must be in');
  });

  test('a word is never both the topic and the review', () => {
    // Overlapping pools are how an item gets asked twice in one sitting under
    // two headings; the review half is drawn from outside the cluster only.
    const owed = records(topicItems.map((entry) => due(entry.id)));
    const composed = composeLesson(target, topicItems, topicItems, owed, { now: NOW });
    assert.equal(composed.reviewIds.length, 0);
    assert.equal(new Set(composed.itemIds).size, composed.itemIds.length);
  });

  test('no word appears twice in a composed lesson', () => {
    const owed = records(outsiders.map((entry) => due(entry.id)));
    const composed = composeLesson(target, topicItems, outsiders, owed, { now: NOW });
    assert.equal(new Set(composed.itemIds).size, composed.itemIds.length);
  });

  test('a six-word cluster makes a six-word lesson rather than being padded', () => {
    // Padding a short topic up to twenty with unrelated words is exactly the
    // behaviour being replaced.
    const small = cluster('a2-travel-small', ids(6, 's'));
    const smallItems = ids(6, 's').map((id) => item(id));
    const composed = composeLesson(small, smallItems, outsiders, new Map(), { now: NOW });
    assert.equal(composed.itemIds.length, 6);
  });

  test('an empty cluster does not throw', () => {
    const empty = cluster('a2-travel-empty', []);
    const composed = composeLesson(empty, [], outsiders, new Map(), { now: NOW });
    assert.deepEqual(composed.itemIds, []);
  });

  test('mastered topic words go last, so the lesson is not a re-run', () => {
    const mastered = records(topicItems.slice(0, 10).map(
      (entry) => progress(entry.id, { state: 'mastered', dueAt: NOW + DAY * 60 }),
    ));
    const composed = composeLesson(target, topicItems, outsiders, mastered, { now: NOW });
    const firstFive = composed.thematicIds.slice(0, 5);
    const masteredIds = new Set(topicItems.slice(0, 10).map((entry) => entry.id));
    assert.ok(
      firstFive.every((id) => !masteredIds.has(id)),
      'unseen words should come before ones already mastered',
    );
  });

  test('the same cluster twice does not arrive in the same order', () => {
    // Clustering builds a mental group; it must not train a sequence (§36).
    const seen: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      seen.push(composeLesson(target, topicItems, outsiders, new Map(), { now: NOW })
        .thematicIds.join(','));
    }
    assert.ok(new Set(seen).size > 1, 'the order was identical across twelve lessons');
  });
});

describe('CEFR level is never crossed', () => {
  test('a cluster carries one level, and composing cannot add another', () => {
    // The guarantee in §5: a topic may not change a word's level, and an A2
    // lesson may not quietly teach new B1 vocabulary. The review half is the
    // only route in from outside, and it only ever carries words the learner
    // has already met — never new material from a higher level.
    const a2Items = ids(15).map((id) => item(id, { level: 'A2' }));
    const b1Items = ids(10, 'b').map((id) => item(id, { level: 'B1' }));
    const target = cluster('a2-travel-airport', ids(15));

    const composed = composeLesson(target, a2Items, b1Items, new Map(), { now: NOW });
    assert.equal(composed.reviewIds.length, 0, 'unseen B1 words must not be pulled in');

    // Even once some B1 words are owed, they arrive as review of material the
    // learner has already been taught, never as new words.
    const owed = records(b1Items.map((entry) => due(entry.id)));
    const withReview = composeLesson(target, a2Items, b1Items, owed, { now: NOW });
    for (const id of withReview.reviewIds) {
      assert.ok(owed.get(id)?.seen, `${id} entered the lesson without having been taught`);
    }
  });
});

describe('progress through a topic', () => {
  const target = cluster('a2-travel-airport', ids(10));

  test('a finished topic is not called mastered while words are still owed', () => {
    const status = clusterStatus(target, records(ids(10).map(
      (id) => progress(id, { state: 'review', dueAt: NOW - DAY }),
    )), NOW);
    assert.equal(status.complete, true, 'the content has been covered');
    assert.equal(status.mastered, 0);
    assert.equal(status.due, 10, 'and the review debt is reported alongside it');
  });

  test('being shown a word is not progress', () => {
    const status = clusterStatus(target, records(ids(10).map(
      (id) => progress(id, { state: 'learning', correctCount: 0 }),
    )), NOW);
    assert.equal(status.seen, 10);
    assert.equal(status.learned, 0);
    assert.equal(status.completion, 0);
  });

  test('topic progress rolls its clusters up', () => {
    const a = cluster('a2-travel-1', ids(10), { order: 0 });
    const b = cluster('a2-travel-2', ids(10, 'x'), { order: 1 });
    const [topic] = vocabularyTopicProgress([a, b], records(
      ids(10).map((id) => progress(id, { state: 'mastered' })),
    ), NOW);
    assert.equal(topic?.total, 20);
    assert.equal(topic?.learned, 10);
    assert.equal(topic?.mastered, 10);
    assert.equal(topic?.clustersComplete, 1);
    assert.equal(topic?.completion, 0.5);
  });
});

describe('what to study next', () => {
  const a = cluster('a2-travel-1', ids(5, 'a'), { order: 0, subcategory: 'travel' });
  const b = cluster('a2-travel-2', ids(5, 'b'), { order: 1, subcategory: 'travel' });
  const c = cluster('a2-food-1', ids(5, 'f'), { order: 0, subcategory: 'food' });

  test('a brand-new learner is given a real first lesson, not a random draw', () => {
    const first = recommendCluster([a, b, c], new Map(), NOW);
    assert.ok(first);
    assert.equal(first?.itemIds.length, 5);
  });

  test('a started topic outranks a fresh one', () => {
    const started = records([progress('b1', { state: 'learning', correctCount: 0 })]);
    assert.equal(recommendCluster([a, b, c], started, NOW)?.id, 'a2-travel-2');
  });

  test('a finished cluster is skipped', () => {
    const done = records(ids(5, 'a').map((id) => progress(id, { state: 'mastered' })));
    assert.equal(recommendCluster([a, b, c], done, NOW)?.id, 'a2-travel-2');
  });

  test('the next lesson stays inside the topic before moving on', () => {
    assert.equal(nextCluster([a, b, c], a, new Map(), NOW)?.id, 'a2-travel-2');
  });

  test('and moves on once the topic is done', () => {
    const done = records([...ids(5, 'a'), ...ids(5, 'b')].map(
      (id) => progress(id, { state: 'mastered' }),
    ));
    assert.equal(nextCluster([a, b, c], a, done, NOW)?.id, 'a2-food-1');
  });

  test('nothing left returns null rather than looping', () => {
    const done = records([...ids(5, 'a'), ...ids(5, 'b'), ...ids(5, 'f')].map(
      (id) => progress(id, { state: 'mastered' }),
    ));
    assert.equal(nextCluster([a, b, c], a, done, NOW), null);
    assert.equal(recommendCluster([a, b, c], done, NOW), null);
  });
});

describe('mixed review stays mixed', () => {
  test('it is the scheduler list, unfiltered by topic', () => {
    // §37: this route is *supposed* to jump between subjects. It is the other
    // half of the design, not a bug to be clustered away.
    const owed = records([due('a1'), due('f1'), weak('b1'), progress('z1')]);
    const list = dueItemIds(owed, NOW);
    assert.deepEqual([...list].sort(), ['a1', 'b1', 'f1']);
    assert.ok(!list.includes('z1'), 'an item not yet due must not be in it');
  });

  test('the most urgent come first', () => {
    const owed = records([due('a1'), weak('b1')]);
    assert.equal(dueItemIds(owed, NOW)[0], 'b1', 'a failed item outranks a merely due one');
  });
});
