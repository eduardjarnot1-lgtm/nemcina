/**
 * The engine against the project's actual content.
 *
 * Unit tests prove the arithmetic. This proves the types were written from the
 * real data rather than alongside it: if the Python pipeline changes shape, this
 * fails, which is the whole point of having it.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkAnswer } from '../src/answers.ts';
import { newProgress, review } from '../src/srs.ts';
import { planSession, stageFor } from '../src/selection.ts';
import { InMemoryProgressStore } from '../src/storage.ts';
import { CEFR_LEVELS, GRADE, type CefrLevel } from '../src/types.ts';

const dataUrl = (name: string) => new URL(`../../../app/data/${name}`, import.meta.url);
const load = (name: string) => JSON.parse(readFileSync(fileURLToPath(dataUrl(name)), 'utf8'));

interface RawWord {
  id: string; word: string; translation: string; type: string;
  cefr?: string; cefrSource?: string; article?: string; example?: string;
}

const vocabulary = load('vocabulary.json') as { words: RawWord[]; meta: Record<string, unknown> };
const grammar = load('grammar.json') as { topics: Array<{ id: string; level: string; exercises: unknown[] }> };
const T0 = 1_700_000_000_000;

describe('the shipped content matches what the engine expects', () => {
  test('vocabulary is non-trivial and every card has an id, term and meaning', () => {
    assert.ok(vocabulary.words.length > 4000, `only ${vocabulary.words.length} cards`);
    for (const word of vocabulary.words) {
      assert.ok(word.id, 'missing id');
      assert.ok(word.word?.trim(), `${word.id} has no term`);
      assert.ok(word.translation?.trim(), `${word.id} has no translation`);
    }
  });

  test('ids are unique — progress is keyed on them', () => {
    const ids = new Set(vocabulary.words.map((w) => w.id));
    assert.equal(ids.size, vocabulary.words.length);
  });

  test('every stated CEFR level is one the engine knows', () => {
    for (const word of vocabulary.words) {
      if (!word.cefr) continue;
      assert.ok((CEFR_LEVELS as readonly string[]).includes(word.cefr),
        `${word.id} has level ${word.cefr}`);
    }
  });

  test('a stated level always carries its provenance', () => {
    for (const word of vocabulary.words) {
      assert.equal(Boolean(word.cefr), Boolean(word.cefrSource),
        `${word.id}: level and source disagree`);
    }
  });

  test('A1 through B2 all hold real content — no level claims to be complete while empty', () => {
    const counts = new Map<CefrLevel, number>();
    for (const word of vocabulary.words) {
      if (word.cefr) counts.set(word.cefr as CefrLevel, (counts.get(word.cefr as CefrLevel) ?? 0) + 1);
    }
    for (const level of ['A1', 'A2', 'B1', 'B2'] as CefrLevel[]) {
      assert.ok((counts.get(level) ?? 0) > 100, `${level} has only ${counts.get(level) ?? 0} cards`);
    }
  });

  test('every grammar topic has a usable level and at least one exercise', () => {
    assert.ok(grammar.topics.length > 100);
    for (const topic of grammar.topics) {
      assert.ok((CEFR_LEVELS as readonly string[]).includes(topic.level), `${topic.id}: ${topic.level}`);
      assert.ok(topic.exercises.length > 0, `${topic.id} has no exercises`);
    }
  });
});

describe('the engine drives real cards end to end', () => {
  test('a learner works through real B1 words and progress persists', async () => {
    const store = new InMemoryProgressStore();
    const b1 = vocabulary.words.filter((w) => w.cefr === 'B1').slice(0, 40);
    assert.ok(b1.length === 40);

    // Plan a session from real cards with no history at all.
    let candidates = await Promise.all(b1.map(async (word) => ({
      item: word,
      progress: await store.get('u1', word.id),
    })));
    const first = planSession(candidates, { now: T0, random: () => 0.5 });
    assert.equal(first.items.length, 12);
    assert.equal(first.composition.fresh, 12, 'a first session is all new — there is nothing else');

    // Answer them: the first half right, the second half wrong.
    let when = T0;
    for (const [index, entry] of first.items.entries()) {
      const grade = index < 6 ? GRADE.GOOD : GRADE.AGAIN;
      await store.put(review(entry.progress, grade, { now: when }));
      when += 30_000;
    }

    // The next session must lead with what was failed, not with more new words.
    candidates = await Promise.all(b1.map(async (word) => ({
      item: word,
      progress: await store.get('u1', word.id),
    })));
    const second = planSession(candidates, { now: when, random: () => 0.5 });
    assert.ok(second.composition.weak >= 6, `expected the 6 failures back, got ${second.composition.weak}`);
    assert.ok(second.composition.fresh <= 5, 'new words must not crowd out the failures');
  });

  test('real answers are checked the way a learner would type them', () => {
    const tisch = vocabulary.words.find((w) => w.word === 'Tisch');
    assert.ok(tisch, 'the corpus should contain Tisch');
    const accepted = [tisch.translation];
    assert.equal(checkAnswer(tisch.translation, accepted).correct, true);
    assert.equal(checkAnswer(tisch.translation.toUpperCase() + '.', accepted).correct, true);
    assert.equal(checkAnswer('zzzzzz', accepted).correct, false);
  });

  test('exercise difficulty rises as a real card is learned', () => {
    const word = vocabulary.words.find((w) => w.cefr === 'A1' && w.example);
    assert.ok(word);
    let progress = newProgress('u1', word.id);
    assert.equal(stageFor(progress), 'recognise');
    progress = review(progress, GRADE.GOOD, { now: T0 });
    progress = review(progress, GRADE.GOOD, { now: progress.dueAt });
    assert.equal(stageFor(progress), 'typing');
  });
});
