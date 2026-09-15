/**
 * A study session end to end.
 *
 * The behaviour worth protecting: a wrong answer comes back before the session
 * is over, it comes back easier, and the summary tells the truth about it rather
 * than counting the second, prompted attempt as a success.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { StudySession } from '../src/session.ts';
import { InMemoryProgressStore } from '../src/storage.ts';
import { newProgress, review } from '../src/srs.ts';
import { EXERCISE_STAGES } from '../src/selection.ts';
import {
  GRADE, type CefrLevel, type ExerciseKind, type ItemProgress, type VocabularyItem, type WordType,
} from '../src/types.ts';

function item(over: Partial<VocabularyItem<'de'>> & { id: string; term: string }): VocabularyItem<'de'> {
  return {
    language: 'de',
    translation: `meaning-${over.id}`,
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

const corpus = Array.from({ length: 20 }, (_, i) =>
  item({ id: `v${String(i + 1).padStart(2, '0')}`, term: `Wort${i + 1}` }));

const T0 = 1_700_000_000_000;
const half = () => 0.5;
const plan = (progress: ReadonlyMap<string, ItemProgress> = new Map()) =>
  StudySession.plan('u1', corpus, progress, { now: T0, random: half });

/** Answer the question in front of the learner correctly. */
const answerCorrectly = (session: StudySession, at: number) => {
  const question = session.current;
  assert.ok(question);
  return session.answer(question.answers[0] as string, { now: at });
};

describe('planning', () => {
  test('a session is the mix, not the whole corpus', () => {
    const session = plan();
    assert.equal(session.position.total, 12);
    assert.ok(session.current);
    assert.equal(session.finished, false);
  });

  test('a brand-new learner is asked to recognise, not to spell', () => {
    const session = plan();
    assert.equal(session.current?.kind, 'recognise');
    assert.equal(session.current?.producedTargetLanguage, false);
  });

  test('a well-known item is asked at a harder form', () => {
    let record = newProgress('u1', 'v01');
    record = review(record, GRADE.EASY, { now: T0 - 40 * 86_400_000 });
    record = review(record, GRADE.EASY, { now: T0 - 10 * 86_400_000 });
    const session = StudySession.plan('u1', [corpus[0]!], new Map([['v01', record]]),
      { now: T0, random: half });
    assert.ok(['typing', 'recall', 'context'].includes(session.current?.kind as string),
      `asked ${session.current?.kind} of a strong item`);
  });

  test('an empty corpus gives an empty, finished session rather than throwing', () => {
    const empty = StudySession.plan('u1', [], new Map(), { now: T0, random: half });
    assert.equal(empty.finished, true);
    assert.equal(empty.current, null);
    assert.equal(empty.summary.asked, 0);
  });
});

describe('answering', () => {
  test('a right answer advances, grades and returns a record to persist', () => {
    const session = plan();
    const outcome = answerCorrectly(session, T0 + 5_000);
    assert.equal(outcome.verdict.correct, true);
    assert.equal(outcome.grade, GRADE.GOOD, 'recognition is Good, never Easy');
    assert.equal(outcome.progress.seen, true);
    assert.equal(outcome.attempt.correct, true);
    assert.equal(outcome.willRepeat, false);
  });

  test('producing the word unaided earns Easy; with a hint it does not', () => {
    const one = [item({ id: 'x1', term: 'Haus', translation: 'house' })];
    const unaided = StudySession.plan('u1', one, new Map([
      ['x1', review(newProgress('u1', 'x1'), GRADE.GOOD, { now: T0 - 5 * 86_400_000 })],
    ]), { now: T0, random: half });
    assert.equal(unaided.current?.kind, 'recall');
    assert.equal(unaided.answer('Haus', { now: T0 }).grade, GRADE.EASY);

    const hinted = StudySession.plan('u1', one, new Map([
      ['x1', review(newProgress('u1', 'x1'), GRADE.GOOD, { now: T0 - 5 * 86_400_000 })],
    ]), { now: T0, random: half });
    assert.equal(hinted.answer('Haus', { hintShown: true, now: T0 }).grade, GRADE.GOOD);
  });

  test('a near miss is Hard, not Again — the learner knew the word', () => {
    const session = plan();
    const question = session.current;
    assert.ok(question);
    // One character off the right option.
    const nearly = (question.answers[0] as string).slice(0, -1);
    const outcome = session.answer(nearly, { now: T0 });
    assert.equal(outcome.verdict.close, true);
    assert.equal(outcome.grade, GRADE.HARD);
  });

  test('answering past the end is an error, not a silent no-op', () => {
    const session = StudySession.plan('u1', [], new Map(), { now: T0, random: half });
    assert.throws(() => session.answer('x', { now: T0 }), /no current question/);
  });

  test('skipping moves on without scoring anything', () => {
    const session = plan();
    session.skip();
    assert.equal(session.summary.asked, 0);
    assert.equal(session.position.index, 1);
  });
});

describe('a wrong answer comes back', () => {
  test('THE behaviour that makes a session teach: it is asked again before the end', () => {
    const session = plan();
    const first = session.currentItem?.id;
    const outcome = session.answer('definitely wrong', { now: T0 });
    assert.equal(outcome.verdict.correct, false);
    assert.equal(outcome.willRepeat, true);
    assert.equal(session.position.total, 13, 'the queue grew by the retry');

    // Walk to the end; the failed item must appear again.
    const seen: string[] = [];
    while (!session.finished) {
      seen.push(session.currentItem?.id as string);
      answerCorrectly(session, T0 + 1_000);
    }
    assert.ok(seen.includes(first as string), 'the failed word never came back');
  });

  test('it comes back easier — repeating the same hard form teaches nothing', () => {
    const one = [item({ id: 'x1', term: 'Haus', translation: 'house' }), ...corpus];
    const session = StudySession.plan('u1', one, new Map([
      ['x1', review(newProgress('u1', 'x1'), GRADE.GOOD, { now: T0 - 5 * 86_400_000 })],
    ]), { now: T0, random: half });
    assert.equal(session.current?.kind, 'recall', 'precondition: it starts at a produced form');

    const asked = session.current?.kind as ExerciseKind;
    session.answer('wrong', { now: T0 });
    while (session.currentItem?.id !== 'x1' && !session.finished) session.skip();
    assert.equal(session.finished, false, 'the retry was never queued');

    // The rung matters less than the direction: whatever the retry is, it must
    // be lower on the ladder than the form that was just failed.
    const retried = session.current?.kind as ExerciseKind;
    assert.ok(
      EXERCISE_STAGES.indexOf(retried) < EXERCISE_STAGES.indexOf(asked),
      `retried at ${retried}, which is not easier than ${asked}`,
    );
  });

  test('an item is not re-asked forever', () => {
    const session = StudySession.plan('u1', corpus, new Map(),
      { now: T0, random: half, maxRetries: 1 });
    let guard = 0;
    while (!session.finished) {
      session.answer('wrong', { now: T0 });
      guard += 1;
      assert.ok(guard < 100, 'the session never ends');
    }
    assert.equal(session.position.total, 24, '12 questions plus one retry each');
  });
});

describe('the summary tells the truth', () => {
  test('accuracy counts first attempts, not the prompted retry', () => {
    const session = plan();
    // Fail the first question, then get everything (including its retry) right.
    session.answer('wrong', { now: T0 });
    while (!session.finished) answerCorrectly(session, T0 + 1_000);

    const summary = session.summary;
    assert.equal(summary.itemsStudied, 12);
    assert.equal(summary.accuracy, 11 / 12,
      'the retry was counted as if the learner had known it');
    assert.equal(summary.asked, 13);
    assert.equal(summary.incorrect, 1);
  });

  test('a perfect session is 1, an entirely failed one is 0', () => {
    const perfect = plan();
    while (!perfect.finished) answerCorrectly(perfect, T0 + 1_000);
    assert.equal(perfect.summary.accuracy, 1);

    const failed = plan();
    while (!failed.finished) failed.answer('wrong', { now: T0 });
    assert.equal(failed.summary.accuracy, 0);
  });

  test('duration is measured, not guessed', () => {
    const session = plan();
    answerCorrectly(session, T0 + 30_000);
    assert.equal(session.summary.durationMs, 30_000);
  });
});

describe('the session owns no storage', () => {
  test('changed records are handed back for the caller to persist', async () => {
    const store = new InMemoryProgressStore();
    const session = plan();
    while (!session.finished) {
      const outcome = answerCorrectly(session, T0 + 1_000);
      await store.put(outcome.progress);
      await store.recordAttempt(outcome.attempt);
    }
    const saved = await store.all('u1');
    assert.equal(saved.length, 12);
    assert.deepEqual(
      [...session.changed].map((r) => r.itemId).sort(),
      saved.map((r) => r.itemId).sort(),
    );
    assert.equal((await store.recentAttempts('u1', 100)).length, 12);
  });

  test('a session resumed from stored progress continues where it left off', async () => {
    const store = new InMemoryProgressStore();
    const first = plan();
    while (!first.finished) {
      const outcome = answerCorrectly(first, T0 + 1_000);
      await store.put(outcome.progress);
    }
    const records = await store.all('u1');
    const second = StudySession.plan('u1', corpus, new Map(records.map((r) => [r.itemId, r])),
      { now: T0 + 86_400_000, random: half });
    // The twelve answered items are now scheduled; the eight untouched ones are
    // still new, so the second session is not simply the first one again.
    const repeated = new Set(records.map((r) => r.itemId));
    const fresh = corpus.filter((entry) => !repeated.has(entry.id)).length;
    assert.equal(fresh, 8);
    assert.ok(second.position.total > 0);
  });
});
