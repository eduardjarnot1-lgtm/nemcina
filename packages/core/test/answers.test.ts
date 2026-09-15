import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer, fold, distance, gradeFor } from '../src/answers.ts';
import { GRADE } from '../src/types.ts';

describe('answer checking', () => {
  test('accepts an exact answer', () => {
    assert.equal(checkAnswer('der Tisch', ['der Tisch']).correct, true);
  });

  test('ignores case, punctuation and stray whitespace', () => {
    for (const given of ['DER TISCH', 'der tisch.', '  der   Tisch  ', 'der Tisch!']) {
      assert.equal(checkAnswer(given, ['der Tisch']).correct, true, given);
    }
  });

  test('accepts ss for ß in German', () => {
    assert.equal(checkAnswer('gross', ['groß']).correct, true);
    assert.equal(checkAnswer('groß', ['gross']).correct, true);
  });

  test('does NOT fold accents — schon and schön are different words', () => {
    const verdict = checkAnswer('schon', ['schön']);
    assert.equal(verdict.correct, false, 'must not accept schon for schön');
    assert.equal(verdict.close, true, 'but it is a near miss, not nonsense');
  });

  test('accepts any of several listed answers, and reports which matched', () => {
    const verdict = checkAnswer('lorry', ['truck', 'lorry']);
    assert.equal(verdict.correct, true);
    assert.equal(verdict.matched, 'lorry');
  });

  test('one typo is close, not correct', () => {
    const verdict = checkAnswer('Tich', ['Tisch']);
    assert.equal(verdict.correct, false);
    assert.equal(verdict.close, true);
  });

  test('nonsense and empty input are wrong, not close', () => {
    for (const given of ['', '   ', 'qqqqqqqq']) {
      const verdict = checkAnswer(given, ['Tisch']);
      assert.equal(verdict.correct, false, given);
      assert.equal(verdict.close, false, given);
    }
  });

  test('a different real word is wrong, not close', () => {
    const verdict = checkAnswer('Stuhl', ['Tisch']);
    assert.equal(verdict.correct, false);
    assert.equal(verdict.close, false);
  });

  test('a missing article is only accepted when the caller allows it', () => {
    assert.equal(checkAnswer('Tisch', ['der Tisch']).correct, false,
      'on an article exercise the article is the question');
    assert.equal(
      checkAnswer('Tisch', ['der Tisch'], { allowMissingArticle: true }).correct, true);
  });

  test('short answers tolerate only a single edit', () => {
    assert.equal(checkAnswer('Hun', ['Hund']).close, true);
    assert.equal(checkAnswer('Hxyz', ['Hund']).close, false);
  });

  test('fold and distance behave as the checker assumes', () => {
    assert.equal(fold('Der Groß-Vater!', 'de'), 'der gross-vater');
    assert.equal(distance('abc', 'abc'), 0);
    assert.equal(distance('abc', 'abd'), 1);
    assert.equal(distance('a', 'abcdefghij'), 99, 'far-apart lengths bail out early');
  });
});

describe('grading', () => {
  const ctx = { kind: 'typing' as const, hintShown: false, producedTargetLanguage: true };

  test('wrong is Again, close is Hard', () => {
    assert.equal(gradeFor({ correct: false, close: false, matched: '' }, ctx), GRADE.AGAIN);
    assert.equal(gradeFor({ correct: false, close: true, matched: '' }, ctx), GRADE.HARD);
  });

  test('unaided production of the target language is Easy', () => {
    assert.equal(gradeFor({ correct: true, close: false, matched: '' }, ctx), GRADE.EASY);
  });

  test('a hint on screen downgrades Easy to Good', () => {
    assert.equal(
      gradeFor({ correct: true, close: false, matched: '' }, { ...ctx, hintShown: true }),
      GRADE.GOOD);
  });

  test('recognition is only ever Good — picking a button is weaker evidence', () => {
    assert.equal(
      gradeFor({ correct: true, close: false, matched: '' }, { ...ctx, kind: 'choice' }),
      GRADE.GOOD);
  });

  test('typing the source language is Good, not Easy', () => {
    assert.equal(
      gradeFor({ correct: true, close: false, matched: '' },
        { ...ctx, producedTargetLanguage: false }),
      GRADE.GOOD);
  });
});
