/**
 * Reading the Python pipeline's JSON.
 *
 * These tests are mostly about what the importer must NOT do: invent a level,
 * upgrade a guess into a claim, drop an exercise because the pipeline spells its
 * type differently. The corpus is a research artefact assembled from real
 * sources, and the value of it is that it does not make things up.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  readCategoryTitles, readGrammar, readVocabulary, toCategories, toExercise,
  toExerciseKind, toGrammarTopic, toLevel, toLevelProvenance, toVocabularyItem,
  toWordType, type RawWord,
} from '../src/pipeline.ts';

const word = (over: Partial<RawWord> = {}): RawWord => ({
  id: 'w0001', word: 'Haus', translation: 'house', type: 'noun',
  cefr: 'A1', cefrSource: 'goethe-a1', ...over,
});

describe('vocabulary fields', () => {
  test('the headword, meaning and type come across', () => {
    const item = toVocabularyItem(word({ article: 'das', pluralForm: 'Häuser' }));
    assert.equal(item.term, 'Haus');
    assert.equal(item.translation, 'house');
    assert.equal(item.wordType, 'noun');
    assert.equal(item.metadata.article, 'das');
    assert.equal(item.metadata.pluralForm, 'Häuser');
  });

  test('a word type the engine does not model becomes "other", not a crash', () => {
    assert.equal(toWordType('interjection'), 'other');
    assert.equal(toWordType('verb'), 'verb');
  });

  test('an article that is not an article is dropped rather than passed through', () => {
    assert.equal(toVocabularyItem(word({ article: 'le' })).metadata.article, '');
    assert.equal(toVocabularyItem(word({ article: '' })).metadata.article, '');
  });

  test('a level the engine does not know becomes null instead of being invented', () => {
    assert.equal(toLevel('B1'), 'B1');
    assert.equal(toLevel('GCSE'), null);
    assert.equal(toLevel(undefined), null);
    assert.equal(toVocabularyItem(word({ cefr: 'Foundation' })).level, null);
  });

  test('THE distinction the corpus rests on: a stated level is not a guessed one', () => {
    const stated = toLevelProvenance(word({ cefrSource: 'goethe-b1, lingster' }));
    assert.equal(stated.kind, 'stated');
    assert.deepEqual(stated.kind === 'stated' && stated.sources, ['goethe-b1', 'lingster']);

    const guessed = toLevelProvenance(word({ cefrSource: 'tier-approximation' }));
    assert.equal(guessed.kind, 'approximated');

    const silent = toLevelProvenance(word({ cefrSource: '' }));
    assert.equal(silent.kind, 'approximated', 'no source means no claim');
  });

  test('the synthetic level pseudo-category is dropped; level is a field, not a tag', () => {
    const categories = toCategories(word({
      categories: [
        { category: 'home', subcategory: 'home-life' },
        { category: 'levels', subcategory: 'a1' },
      ],
    }));
    assert.deepEqual(categories, ['home/home-life']);
  });

  test('missing optional fields become empty, never placeholder text', () => {
    // The factory supplies no example, note, rank or review flag — exactly the
    // state most cards from a bare word list are in.
    const item = toVocabularyItem(word());
    assert.equal(item.example, '');
    assert.equal(item.exampleTranslation, '');
    assert.equal(item.note, '');
    assert.equal(item.frequencyRank, 0);
    assert.equal(item.needsReview, false);
  });

  test('a dictionary translation is marked as one', () => {
    assert.equal(toVocabularyItem(word({ translationSource: 'ding' })).translationProvenance, 'dictionary');
    assert.equal(toVocabularyItem(word({ translationSource: 'wordlist' })).translationProvenance, 'wordlist');
    assert.equal(toVocabularyItem(word()).translationProvenance, 'wordlist');
  });

  test('a plural-only entry is flagged, because its article means something else', () => {
    assert.equal(toVocabularyItem(word({ plural: true, article: 'die' })).metadata.isPluralEntry, true);
    assert.equal(toVocabularyItem(word()).metadata.isPluralEntry, false);
  });
});

describe('exercises', () => {
  test('a gap-fill is typing: the name describes the demand, not the layout', () => {
    assert.equal(toExerciseKind('fill'), 'typing');
    assert.equal(toExerciseKind('error'), 'error-correction');
    assert.equal(toExerciseKind('choice'), 'choice');
    assert.equal(toExerciseKind('reorder'), 'reorder');
  });

  test('a transform exercise keeps the sentence it transforms', () => {
    const exercise = toExercise({
      id: 'e1', type: 'transform', prompt: 'Add the modal verb.',
      from: 'Ich mache mit.', text: '', answers: ['Ich möchte mitmachen.'],
    });
    assert.equal(exercise.text, 'Ich mache mit.');
    assert.equal(exercise.kind, 'transform');
  });

  test('a reorder exercise keeps its tokens — they are what the learner arranges', () => {
    const exercise = toExercise({
      id: 'e2', type: 'reorder', tokens: ['Wann', 'stehst', 'du', 'auf'], answers: ['Wann stehst du auf?'],
    });
    assert.deepEqual(exercise.options, ['Wann', 'stehst', 'du', 'auf']);
  });

  test('an exercise quoted from the source is distinguishable from one written for practice', () => {
    assert.equal(toExercise({ id: 'e3', type: 'fill', fromSource: true }).fromSource, true);
    assert.equal(toExercise({ id: 'e4', type: 'fill' }).fromSource, false);
  });
});

describe('grammar topics', () => {
  const raw = {
    id: 'g1', level: 'A1', title: 'Regular verbs', titleEn: 'Regular verbs',
    summary: 'Endings.',
    explanation: [{ heading: 'The endings', text: '-e, -st, -t, -en, -t, -en.' }],
    rules: ['kommen: ich komme, du kommst.'],
    examples: [{ de: 'ich komme', note: 'regular ending -e' }],
    exercises: [{ id: 'g1-e1', type: 'fill', text: 'Woher ___ du?', answers: ['kommst'] }],
    prerequisites: [], difficulty: 1, source: 'DaF kompakt', sourcePage: 1,
  };

  test('the explanation survives the trip — it is the teaching, not decoration', () => {
    const topic = toGrammarTopic(raw);
    assert.deepEqual(topic.explanation, [{ heading: 'The endings', text: '-e, -st, -t, -en, -t, -en.' }]);
    assert.deepEqual(topic.examples, [{ text: 'ich komme', note: 'regular ending -e', en: '', marks: [] }]);
    assert.equal(topic.exercises[0]?.kind, 'typing');
    assert.equal(topic.source.title, 'DaF kompakt');
    assert.equal(topic.source.page, 1);
  });

  test('a highlight span that does not fit its sentence is dropped, not clamped', () => {
    // Clamping would put a highlight somewhere deliberate-looking and wrong.
    const topic = toGrammarTopic({
      ...raw,
      examples: [{ de: 'ich komme', note: '', marks: [[0, 3], [5, 99], [4, 4], [-1, 2]] }],
    });
    assert.deepEqual(topic.examples[0]?.marks, [[0, 3]]);
  });

  test('a topic with an unusable level is refused loudly, not shown at the wrong level', () => {
    assert.throws(() => toGrammarTopic({ ...raw, level: 'X9' }), /unusable level/);
  });
});

describe('whole files', () => {
  test('a file round-trips into items and topics', () => {
    const items = readVocabulary({ words: [word(), word({ id: 'w2', word: 'Tisch', translation: 'table' })] });
    assert.deepEqual(items.map((i) => i.term), ['Haus', 'Tisch']);

    const topics = readGrammar({
      topics: [{ id: 'g1', level: 'A2', title: 'Dative' }],
    });
    assert.equal(topics[0]?.level, 'A2');
    assert.deepEqual(topics[0]?.exercises, []);
  });

  test('category titles are read for labelling, minus the level pseudo-group', () => {
    const titles = readCategoryTitles({
      categories: [
        { id: 'home', name: 'Home', subcategories: [{ id: 'home-life', name: 'Life in the home' }] },
        { id: 'levels', name: 'By level', subcategories: [{ id: 'a1', name: 'A1' }] },
      ],
    });
    assert.deepEqual(titles, { 'home/home-life': 'Life in the home' });
  });
});
