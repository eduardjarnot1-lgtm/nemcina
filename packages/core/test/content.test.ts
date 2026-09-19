/**
 * The content repository and search.
 *
 * Search is the feature users judge an app by in the first minute: typing a word
 * they half-remember and not finding it reads as "this app does not have it".
 * Most of these tests are about that — spelling that is close enough, keyboards
 * without umlauts, and results in an order that makes sense.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryContentRepository, searchFold, teachingOrder } from '../src/content.ts';
import type { CefrLevel, GrammarTopic, VocabularyItem, WordType } from '../src/types.ts';

function item(over: Partial<VocabularyItem<'de'>> & { id: string; term: string }): VocabularyItem<'de'> {
  return {
    language: 'de',
    translation: '',
    translationProvenance: 'wordlist',
    wordType: 'noun' as WordType,
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

function topic(over: Partial<GrammarTopic> & { id: string; title: string }): GrammarTopic {
  return {
    language: 'de',
    level: 'A1' as CefrLevel,
    titleInSourceLanguage: over.title,
    summary: '',
    explanation: [],
    rules: [],
    examples: [],
    exercises: [],
    prerequisites: [],
    difficulty: 1,
    source: { title: 'test', page: 0 },
    ...over,
  };
}

const corpus = [
  item({ id: 'v1', term: 'Haus', translation: 'house', level: 'A1', frequencyRank: 300, categories: ['home/home-life'] }),
  item({ id: 'v2', term: 'Hausaufgabe', translation: 'homework', level: 'A2', frequencyRank: 4000, categories: ['education/school'] }),
  item({ id: 'v3', term: 'schön', translation: 'beautiful', level: 'A1', wordType: 'adjective', frequencyRank: 120 }),
  item({ id: 'v4', term: 'Straße', translation: 'street', level: 'A1', frequencyRank: 900, categories: ['home/local-area'], example: 'Die Straße ist lang.' }),
  item({ id: 'v5', term: 'Krankenhaus', translation: 'hospital', level: 'B1', frequencyRank: 2000, categories: ['health/food'] }),
  item({ id: 'v6', term: 'wohnen', translation: 'to live', level: 'A1', wordType: 'verb', frequencyRank: 800, categories: ['home/home-life'] }),
];

const topics = [
  topic({ id: 'g1', title: 'Regular verbs in the present tense', summary: 'Endings -e, -st, -t.', level: 'A1' }),
  topic({ id: 'g2', title: 'The dative case', summary: 'Which prepositions take it.', level: 'A2', rules: ['aus, bei, mit, nach, seit, von, zu take the dative.'] }),
];

const repo = new InMemoryContentRepository('de', corpus, topics);

describe('folding for search', () => {
  test('umlauts and ß fold away, because keyboards do not have them', () => {
    assert.equal(searchFold('Straße'), 'strasse');
    assert.equal(searchFold('schön'), 'schon');
    assert.equal(searchFold('  MÜDE  '), 'mude');
  });

  test('this is deliberately the opposite of answer checking', async () => {
    // Searching "schon" should find "schön"; *answering* "schon" for "schön" is
    // a wrong answer. Both behaviours are correct and they must not be merged.
    const { fold } = await import('../src/answers.ts');
    assert.equal(searchFold('schön'), searchFold('schon'));
    assert.notEqual(fold('schön'), fold('schon'));
  });
});

describe('looking content up', () => {
  test('an item is found by id, and an unknown id is null rather than a throw', () => {
    assert.equal(repo.item('v1')?.term, 'Haus');
    assert.equal(repo.item('nope'), null);
  });

  test('items() skips ids it does not know instead of returning holes', () => {
    const found = repo.items(['v1', 'nope', 'v3']);
    assert.deepEqual(found.map((i) => i.id), ['v1', 'v3']);
  });

  test('duplicate ids are refused at construction — progress is keyed on them', () => {
    assert.throws(
      () => new InMemoryContentRepository('de', [item({ id: 'x', term: 'a' }), item({ id: 'x', term: 'b' })]),
      /duplicate vocabulary id: x/,
    );
  });

  test('filters compose: level, type, category, has-an-example', () => {
    assert.equal(repo.vocabulary({ levels: ['A1'] }).length, 4);
    assert.deepEqual(repo.vocabulary({ wordType: 'verb' }).map((i) => i.id), ['v6']);
    assert.deepEqual(repo.vocabulary({ category: 'home/home-life' }).map((i) => i.id), ['v1', 'v6']);
    assert.deepEqual(repo.vocabulary({ withExample: true }).map((i) => i.id), ['v4']);
    assert.deepEqual(repo.vocabulary({ levels: ['A1'], category: 'home/home-life' }).map((i) => i.id), ['v1', 'v6']);
  });

  test('categories are listed sorted, and the synthetic level group is not among them', () => {
    assert.deepEqual(repo.categories(),
      ['education/school', 'health/food', 'home/home-life', 'home/local-area']);
  });

  test('grammar filters by level', () => {
    assert.deepEqual(repo.grammar({ levels: ['A2'] }).map((t) => t.id), ['g2']);
    assert.equal(repo.grammar().length, 2);
    assert.equal(repo.topic('g1')?.level, 'A1');
  });
});

describe('search', () => {
  test('an exact headword wins, even against a more common word', () => {
    const hits = repo.search('Haus');
    assert.equal(hits[0]?.kind, 'vocabulary');
    assert.equal(hits[0]?.kind === 'vocabulary' && hits[0].item.id, 'v1');
  });

  test('a prefix beats a match buried inside a word', () => {
    const hits = repo.search('haus');
    const ids = hits.flatMap((h) => (h.kind === 'vocabulary' ? [h.item.id] : []));
    // Haus exact, then Hausaufgabe (prefix), then Krankenhaus (inside).
    assert.deepEqual(ids, ['v1', 'v2', 'v5']);
  });

  test('a learner without an umlaut key still finds the word', () => {
    const hits = repo.search('schon');
    assert.equal(hits[0]?.kind === 'vocabulary' && hits[0].item.id, 'v3');
    assert.equal(repo.search('strasse')[0]?.kind === 'vocabulary'
      && (repo.search('strasse')[0] as { item: VocabularyItem }).item.id, 'v4');
  });

  test('the English side is searchable too — people look up what they mean', () => {
    const hits = repo.search('hospital');
    assert.equal(hits[0]?.kind === 'vocabulary' && hits[0].item.id, 'v5');
  });

  test('grammar and vocabulary come back together, ranked against each other', () => {
    const hits = repo.search('dative');
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.kind, 'grammar');
  });

  test('kind narrows the search', () => {
    assert.equal(repo.search('verbs', { kind: 'vocabulary' }).length, 0);
    assert.equal(repo.search('verbs', { kind: 'grammar' }).length, 1);
  });

  test('one character searches nothing — it would match half the corpus', () => {
    assert.deepEqual(repo.search('h'), []);
    assert.deepEqual(repo.search(''), []);
  });

  test('limit is respected', () => {
    assert.equal(repo.search('haus', { limit: 2 }).length, 2);
  });

  test('equal scores are broken by frequency, not by insertion order', () => {
    // Two words, same kind of match, different rarity: the common one first.
    const tied = new InMemoryContentRepository('de', [
      item({ id: 'rare', term: 'Zeitungsabonnement', translation: 'x', frequencyRank: 90000 }),
      item({ id: 'common', term: 'Zeitung', translation: 'x', frequencyRank: 1500 }),
    ]);
    const ids = tied.search('zeitung').flatMap((h) => (h.kind === 'vocabulary' ? [h.item.id] : []));
    assert.deepEqual(ids, ['common', 'rare']);
  });

  test('the same query twice gives the same order', () => {
    assert.deepEqual(repo.search('haus'), repo.search('haus'));
  });
});

describe('teaching order', () => {
  test('lower level first, then the more common word', () => {
    const sorted = corpus.slice().sort(teachingOrder).map((i) => i.id);
    assert.deepEqual(sorted, ['v3', 'v1', 'v6', 'v4', 'v2', 'v5']);
  });

  test('an unlevelled or unranked word sorts last rather than being treated as easy', () => {
    const mixed = [
      item({ id: 'unlevelled', term: 'a', level: null, levelProvenance: { kind: 'approximated', basis: 'none' } }),
      item({ id: 'unranked', term: 'b', level: 'A1', frequencyRank: 0 }),
      item({ id: 'known', term: 'c', level: 'A1', frequencyRank: 10 }),
    ];
    assert.deepEqual(mixed.sort(teachingOrder).map((i) => i.id), ['known', 'unranked', 'unlevelled']);
  });
});
