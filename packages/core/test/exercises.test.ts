/**
 * Question building.
 *
 * Most of these protect against questions that are unfair or broken rather than
 * merely wrong: an option list without the right answer, a "wrong" option that
 * means the same thing, a gap where the word never was.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GAP, availableKinds, blankOut, buildQuestion, distractors } from '../src/exercises.ts';
import { checkAnswer } from '../src/answers.ts';
import type { CefrLevel, VocabularyItem, WordType } from '../src/types.ts';

function item(over: Partial<VocabularyItem<'de'>> & { id: string; term: string }): VocabularyItem<'de'> {
  return {
    language: 'de',
    translation: `meaning of ${over.term}`,
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

/** Deterministic "random": no shuffling, so option order is predictable. */
const fixed = () => 0;

const haus = item({
  id: 'v1', term: 'Haus', translation: 'house', metadata: {
    article: 'das', pluralForm: 'Häuser', verbForms: {}, preposition: '',
    regionalVariant: '', isPluralEntry: false,
  },
  example: 'Das Haus ist groß.', exampleTranslation: 'The house is big.',
});

const pool = [
  haus,
  item({ id: 'v2', term: 'Tisch', translation: 'table' }),
  item({ id: 'v3', term: 'Stuhl', translation: 'chair' }),
  item({ id: 'v4', term: 'Fenster', translation: 'window' }),
  item({ id: 'v5', term: 'laufen', translation: 'to run', wordType: 'verb' }),
  item({ id: 'v6', term: 'gehen', translation: 'to go', wordType: 'verb' }),
];

describe('distractors', () => {
  test('never include the right answer', () => {
    const wrong = distractors(haus, pool, 3, 'translation', fixed);
    assert.equal(wrong.includes('house'), false);
    assert.equal(wrong.length, 3);
  });

  test('never include a word that means the same thing — that is an unfair question', () => {
    const synonym = item({ id: 'syn', term: 'Gebäude', translation: 'house' });
    const wrong = distractors(haus, [...pool, synonym], 3, 'translation', fixed);
    assert.equal(wrong.includes('house'), false);
  });

  test('prefer the same word type, so the answer is not given away by shape', () => {
    const wrong = [...distractors(haus, pool, 3, 'translation', fixed)].sort();
    assert.deepEqual(wrong, ['chair', 'table', 'window']);
  });

  test('fall back to other types rather than returning too few options', () => {
    const wrong = [...distractors(haus, [pool[4]!, pool[5]!], 3, 'translation', fixed)].sort();
    assert.deepEqual(wrong, ['to go', 'to run']);
  });

  test('prefer nearby levels over distant ones', () => {
    const near = item({ id: 'n', term: 'Bett', translation: 'bed', level: 'A2' });
    const far = item({ id: 'f', term: 'Giebel', translation: 'gable', level: 'C1' });
    const wrong = distractors(haus, [far, near], 1, 'translation', fixed);
    assert.deepEqual(wrong, ['bed']);
  });

  test('an empty pool yields no distractors rather than throwing', () => {
    assert.deepEqual(distractors(haus, [], 3, 'translation', fixed), []);
  });
});

describe('blanking a word out of its own sentence', () => {
  test('the word becomes a gap', () => {
    assert.equal(blankOut('Das Haus ist groß.', 'Haus'), `Das ${GAP} ist groß.`);
  });

  test('only whole words — "Haus" must not blank the middle of "Hausaufgabe"', () => {
    assert.equal(blankOut('Die Hausaufgabe ist fertig.', 'Haus'), null);
  });

  test('umlauts and ß are letters, so they bound words correctly', () => {
    assert.equal(blankOut('Die Straße ist lang.', 'Straße'), `Die ${GAP} ist lang.`);
    assert.equal(blankOut('Der Großvater kommt.', 'Groß'), null);
  });

  test('a word that is not in the sentence gives null — no invented gap', () => {
    assert.equal(blankOut('Das Auto ist rot.', 'Haus'), null);
    assert.equal(blankOut('', 'Haus'), null);
  });

  test('only the first occurrence is blanked, so the sentence stays readable', () => {
    assert.equal(blankOut('Haus und Haus.', 'Haus'), `${GAP} und Haus.`);
  });
});

describe('building a question', () => {
  test('recognition shows the German with its article and asks what it means', () => {
    const question = buildQuestion(haus, 'recognise', { pool, random: fixed });
    assert.equal(question.subject, 'das Haus');
    assert.equal(question.direction, 'target-to-source');
    assert.equal(question.producedTargetLanguage, false);
    assert.deepEqual(question.answers, ['house']);
    assert.equal(question.options.length, 4);
    assert.ok(question.options.includes('house'));
  });

  test('every multiple choice contains its answer exactly once', () => {
    for (const entry of pool) {
      const question = buildQuestion(entry, 'choice', { pool, random: Math.random });
      const answer = question.answers[0] as string;
      assert.equal(question.options.filter((o) => o === answer).length, 1, `${entry.id}`);
      assert.equal(new Set(question.options).size, question.options.length, `${entry.id} has a duplicate`);
    }
  });

  test('recall asks for the word from the meaning, and does not insist on the article', () => {
    const question = buildQuestion(haus, 'recall', { pool, random: fixed });
    assert.equal(question.subject, 'house');
    assert.equal(question.producedTargetLanguage, true);
    assert.equal(checkAnswer('Haus', question.answers).correct, true);
    assert.equal(checkAnswer('das Haus', question.answers).correct, true);
  });

  test('typing is the hardest form: the article is part of the answer', () => {
    const question = buildQuestion(haus, 'typing', { pool, random: fixed });
    assert.deepEqual(question.answers, ['das Haus']);
    assert.equal(checkAnswer('Haus', question.answers).correct, false,
      'the article is the point of this exercise');
    assert.equal(checkAnswer('das Haus', question.answers).correct, true);
  });

  test('a context question uses the source example, gap and all', () => {
    const question = buildQuestion(haus, 'context', { pool, random: fixed });
    assert.equal(question.kind, 'context');
    assert.equal(question.subject, `Das ${GAP} ist groß.`);
    assert.equal(question.subjectTranslation, 'The house is big.');
    assert.deepEqual(question.answers, ['Haus']);
  });

  test('THE regression: no example means no context question, not a blank one', () => {
    const bare = item({ id: 'bare', term: 'Ding', translation: 'thing' });
    const question = buildQuestion(bare, 'context', { pool, random: fixed });
    assert.equal(question.kind, 'typing', 'it must fall back, not show an empty sentence');
    assert.ok(question.subject);
  });

  test('an example that does not contain the headword also falls back', () => {
    // German inflection means this happens for real: the source sentence uses a
    // form the plain headword does not match.
    const inflected = item({
      id: 'inf', term: 'gehen', translation: 'to go', wordType: 'verb',
      example: 'Ich gehe nach Hause.',
    });
    assert.equal(buildQuestion(inflected, 'context', { pool, random: fixed }).kind, 'typing');
  });

  test('a hint exists for every produced form — it costs the Easy grade, not the answer', () => {
    for (const kind of ['recall', 'typing', 'context'] as const) {
      const question = buildQuestion(haus, kind, { pool, random: fixed });
      assert.ok(question.hint, `${kind} has no hint`);
      assert.notEqual(question.hint, question.answers[0], `${kind}'s hint gives the answer away`);
    }
  });

  test('the same seed builds the same question — a session can be replayed', () => {
    const seeded = () => 0.42;
    assert.deepEqual(
      buildQuestion(haus, 'choice', { pool, random: seeded }),
      buildQuestion(haus, 'choice', { pool, random: seeded }),
    );
  });
});

describe('which forms an item can support', () => {
  test('a word with a usable example can host a context question', () => {
    assert.ok(availableKinds(haus, pool.length).includes('context'));
  });

  test('a word without one cannot, and says so instead of failing later', () => {
    const bare = item({ id: 'bare', term: 'Ding', translation: 'thing' });
    assert.equal(availableKinds(bare, pool.length).includes('context'), false);
  });

  test('too small a pool means no multiple choice', () => {
    const kinds = availableKinds(haus, 2);
    assert.equal(kinds.includes('choice'), false);
    assert.ok(kinds.includes('typing'), 'there is always something to ask');
  });
});
