/**
 * Practising a grammar topic.
 *
 * The behaviour that matters: the source's order survives a first pass, the
 * explanation is shown whether the answer was right or wrong, and a topic's
 * progress is the scheduler's verdict rather than a count of screens seen.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GrammarPractice, practiceOrder, questionFor, topicProgress } from '../src/grammar.ts';
import { newProgress, review } from '../src/srs.ts';
import { InMemoryProgressStore } from '../src/storage.ts';
import {
  GRADE, type Exercise, type GrammarTopic, type Grade, type ItemProgress,
} from '../src/types.ts';

const exercise = (over: Partial<Exercise> & { id: string }): Exercise => ({
  kind: 'typing',
  prompt: 'Complete the sentence.',
  text: 'Woher ___ du?',
  options: [],
  answers: ['kommst'],
  hint: '',
  explanation: 'The regular du-ending is -st.',
  fromSource: false,
  ...over,
});

const topic: GrammarTopic = {
  id: 'g1',
  language: 'de',
  level: 'A1',
  title: 'Regular verbs in the present tense',
  titleInSourceLanguage: 'Regular verbs in the present tense',
  summary: 'The endings -e, -st, -t, -en, -t, -en.',
  explanation: [{ heading: 'The endings', text: 'Stem plus -e, -st, -t, -en, -t, -en.' }],
  rules: ['kommen: ich komme, du kommst.'],
  examples: [{ text: 'ich komme', note: 'regular ending -e', en: 'I come', marks: [] }],
  exercises: [
    exercise({ id: 'e1' }),
    exercise({ id: 'e2', kind: 'choice', options: ['heißt', 'heißst', 'heißest', 'heißen'], answers: ['heißt'] }),
    exercise({ id: 'e3', answers: ['wohnst'] }),
    exercise({ id: 'e4', kind: 'error-correction', text: 'Du wohnt in Tübingen.', answers: ['Du wohnst in Tübingen.'] }),
  ],
  prerequisites: [],
  difficulty: 1,
  category: 'Verben',
  formulas: [],
  tables: [],
  comparison: null,
  source: { title: 'DaF kompakt', page: 1 },
};

const T0 = 1_700_000_000_000;
const answered = (id: string, grade: Grade = GRADE.GOOD, at = T0): ItemProgress =>
  review(newProgress('u1', id), grade, { now: at });

describe('the order to work through a topic', () => {
  test('a first pass keeps the source order — the third exercise assumes the first', () => {
    const order = practiceOrder(topic.exercises, new Map(), T0);
    assert.deepEqual(order.map((e) => e.id), ['e1', 'e2', 'e3', 'e4']);
  });

  test('exercises already attempted move behind the unseen ones', () => {
    const progress = new Map([['e1', answered('e1')], ['e2', answered('e2')]]);
    const order = practiceOrder(topic.exercises, progress, T0 + 1000);
    assert.deepEqual(order.slice(0, 2).map((e) => e.id), ['e3', 'e4'],
      'the unseen exercises should lead');
  });

  test('among those, the one that was failed comes first', () => {
    const progress = new Map([
      ['e1', answered('e1', GRADE.GOOD)],
      ['e2', answered('e2', GRADE.AGAIN)],
      ['e3', answered('e3', GRADE.GOOD)],
      ['e4', answered('e4', GRADE.GOOD)],
    ]);
    const order = practiceOrder(topic.exercises, progress, T0 + 1000);
    assert.equal(order[0]?.id, 'e2');
  });
});

describe('a practice run', () => {
  test('it walks the topic and reports where it is', () => {
    const practice = GrammarPractice.forTopic('u1', topic, new Map(), { now: T0 });
    assert.equal(practice.position.total, 4);
    assert.equal(practice.current?.exerciseId, 'e1');
    assert.equal(practice.finished, false);
  });

  test('a limit shortens it without reordering it', () => {
    const practice = GrammarPractice.forTopic('u1', topic, new Map(), { now: T0, limit: 2 });
    assert.equal(practice.position.total, 2);
    assert.equal(practice.current?.exerciseId, 'e1');
  });

  test('answering twice spends two questions — the guard is the caller\'s', () => {
    // Written down because it is surprising and a screen depends on it. Two
    // taps that both reach `answer` do not answer the same question twice:
    // they answer this question and the next one, and record an attempt
    // against a question nobody saw. The engine has no notion of an outcome
    // being on screen, so it cannot refuse — every caller has to hold a
    // synchronous lock between the answer and showing it, and both screens do.
    const practice = GrammarPractice.forTopic('u1', topic, new Map(), { now: T0 });
    const first = practice.current;
    practice.answer(first?.answers[0] ?? 'x', { now: T0 });
    assert.equal(practice.position.index, 1);
    practice.answer(first?.answers[0] ?? 'x', { now: T0 });
    assert.equal(practice.position.index, 2, 'the second call consumed another question');
    assert.equal(practice.summary.asked, 2, 'and recorded it as asked');
  });

  test('THE point of a grammar exercise: the explanation comes back either way', () => {
    const right = GrammarPractice.forTopic('u1', topic, new Map(), { now: T0 });
    const good = right.answer('kommst', { now: T0 });
    assert.equal(good.verdict.correct, true);
    assert.equal(good.explanation, 'The regular du-ending is -st.');

    const wrong = GrammarPractice.forTopic('u1', topic, new Map(), { now: T0 });
    const bad = wrong.answer('kommt', { now: T0 });
    assert.equal(bad.verdict.correct, false);
    assert.equal(bad.explanation, 'The regular du-ending is -st.',
      'someone who got it wrong needs the explanation most');
  });

  test('a correct answer is graded Easy — grammar is always produced in German', () => {
    const practice = GrammarPractice.forTopic('u1', topic, new Map(), { now: T0 });
    assert.equal(practice.answer('kommst', { now: T0 }).grade, GRADE.EASY);
  });

  test('a hint costs the Easy grade, as everywhere else', () => {
    const practice = GrammarPractice.forTopic('u1', topic, new Map(), { now: T0 });
    assert.equal(practice.answer('kommst', { hintShown: true, now: T0 }).grade, GRADE.GOOD);
  });

  test('a typo is a near miss, not a failure', () => {
    const practice = GrammarPractice.forTopic('u1', topic, new Map(), { now: T0 });
    const outcome = practice.answer('kommsst', { now: T0 });
    assert.equal(outcome.verdict.close, true);
    assert.equal(outcome.grade, GRADE.HARD);
  });

  test('there is no retry queue — re-asking the sentence just shown tests the screen', () => {
    const practice = GrammarPractice.forTopic('u1', topic, new Map(), { now: T0 });
    practice.answer('completely wrong', { now: T0 });
    assert.equal(practice.position.total, 4, 'the queue grew');
    assert.equal(practice.current?.exerciseId, 'e2');
  });

  test('it ends, and the summary is honest about it', () => {
    const practice = GrammarPractice.forTopic('u1', topic, new Map(), { now: T0 });
    practice.answer('kommst', { now: T0 });
    practice.answer('heißt', { now: T0 });
    practice.answer('nonsense', { now: T0 });
    practice.answer('Du wohnst in Tübingen.', { now: T0 });
    assert.equal(practice.finished, true);
    assert.deepEqual(practice.summary, { asked: 4, correct: 3, accuracy: 0.75, total: 4 });
  });

  test('answering past the end is an error, not a silent no-op', () => {
    const practice = GrammarPractice.forTopic('u1', topic, new Map(), { now: T0, limit: 1 });
    practice.answer('kommst', { now: T0 });
    assert.throws(() => practice.answer('x', { now: T0 }), /no current question/);
  });

  test('skipping moves on without scoring', () => {
    const practice = GrammarPractice.forTopic('u1', topic, new Map(), { now: T0 });
    practice.skip();
    assert.equal(practice.summary.asked, 0);
    assert.equal(practice.current?.exerciseId, 'e2');
  });

  test('a choice exercise carries its options through unchanged', () => {
    const question = questionFor(topic, topic.exercises[1] as Exercise);
    assert.deepEqual(question.options, ['heißt', 'heißst', 'heißest', 'heißen']);
    assert.equal(question.kind, 'choice');
  });

  test('progress records are handed back for the caller to store', async () => {
    const store = new InMemoryProgressStore();
    const practice = GrammarPractice.forTopic('u1', topic, new Map(), { now: T0 });
    while (!practice.finished) {
      const question = practice.current;
      assert.ok(question);
      const outcome = practice.answer(question.answers[0] as string, { now: T0 });
      await store.put(outcome.progress);
      await store.recordAttempt(outcome.attempt);
    }
    assert.equal((await store.all('u1')).length, 4);
    assert.equal((await store.recentAttempts('u1', 10)).length, 4);
  });
});

describe('how far through a topic someone is', () => {
  test('nothing attempted is zero', () => {
    assert.deepEqual(topicProgress(topic, new Map()), { total: 4, learned: 0, completion: 0 });
  });

  test('an exercise failed counts as attempted but not learned', () => {
    const progress = new Map([['e1', answered('e1', GRADE.AGAIN)]]);
    assert.equal(topicProgress(topic, progress).learned, 0);
  });

  test('getting them right fills the bar', () => {
    const progress = new Map(topic.exercises.map((e) => [e.id, answered(e.id)]));
    assert.deepEqual(topicProgress(topic, progress), { total: 4, learned: 4, completion: 1 });
  });

  test('a topic with no exercises does not divide by zero', () => {
    assert.deepEqual(topicProgress({ ...topic, exercises: [] }, new Map()),
      { total: 0, learned: 0, completion: 0 });
  });
});
