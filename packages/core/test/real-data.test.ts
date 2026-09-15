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
import { InMemoryContentRepository, type SearchHit } from '../src/content.ts';
import { DEFAULT_SHAPE, lessonStatus, lessonsByCategory, lessonsByLevel, nextLesson } from '../src/lessons.ts';
import {
  readCategoryTitles, readGrammar, readVocabulary,
  type RawGrammarFile, type RawVocabularyFile,
} from '../src/pipeline.ts';
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

// --- the typed pipeline, against the real corpus -----------------------------

describe('the importer reads the real pipeline output', () => {
  const items = readVocabulary(vocabulary as unknown as RawVocabularyFile);
  const topics = readGrammar(grammar as unknown as RawGrammarFile);
  const repo = new InMemoryContentRepository('de', items, topics);

  test('every card survives the import with a term and a meaning', () => {
    assert.equal(items.length, vocabulary.words.length);
    for (const item of items) {
      assert.ok(item.term, `${item.id} lost its term`);
      assert.ok(item.translation, `${item.id} lost its meaning`);
    }
  });

  test('no card claims a level it was not given one for', () => {
    for (const item of items) {
      if (item.levelProvenance.kind === 'stated') {
        assert.ok(item.levelProvenance.sources.length > 0, `${item.id} states a level with no source`);
        assert.ok(item.level, `${item.id} has sources but no level`);
      }
    }
    const approximated = items.filter((i) => i.levelProvenance.kind === 'approximated').length;
    // The pipeline reports 591 tier-approximated cards; if that number moves,
    // the corpus changed and someone should know.
    assert.equal(approximated, 591, `approximated card count changed: ${approximated}`);
  });

  test('every grammar topic imports, keeps its exercises and keeps its explanation', () => {
    assert.equal(topics.length, grammar.topics.length);
    for (const topic of topics) {
      assert.ok(topic.exercises.length > 0, `${topic.id} lost its exercises`);
      assert.ok(topic.explanation.length > 0 || topic.rules.length > 0,
        `${topic.id} has neither explanation nor rules`);
    }
  });

  test('a card teaches the word\'s meaning, not its example\'s translation', () => {
    // This is a regression. The Goethe transcription's third column translates
    // the example SENTENCE, and reading it as the headword's meaning put "How
    // many letters are there in the alphabet in your language?" on the card for
    // Alphabet. Two invariants hold it shut.
    const abbreviations = ['sth.', 'sb.', 'etc.', 'i.e.', 'e.g.', 'vs.', 'tog.'];
    for (const entry of items) {
      if (entry.exampleTranslation.trim()) {
        assert.notEqual(entry.translation.trim(), entry.exampleTranslation.trim(),
          `${entry.id} (${entry.term}) is glossed with its example's translation`);
      }
      // Interjections really are glossed with exclamations — Prost! means
      // "Cheers!" — so a punctuated German side is exempt, and short glosses
      // are never flagged.
      const german = entry.term.trim();
      const meaning = entry.translation.trim();
      if (german.endsWith('!') || german.endsWith('?')) continue;
      if (!/[.?!]$/.test(meaning)) continue;
      if (abbreviations.some((a) => meaning.toLowerCase().endsWith(a))) continue;
      assert.ok(meaning.split(/\s+/).length < 6,
        `${entry.id} (${entry.term}) is glossed with a sentence: ${meaning}`);
    }
  });

  test('an example that has a translation keeps it — it is half the card', () => {
    const withExample = items.filter((entry) => entry.example.trim());
    const translated = withExample.filter((entry) => entry.exampleTranslation.trim());
    assert.ok(translated.length > 3000,
      `only ${translated.length} of ${withExample.length} examples carry a translation`);
  });

  test('searching the real corpus finds what a learner would type', () => {
    const term = (hits: readonly SearchHit[]) =>
      hits[0] && hits[0].kind === 'vocabulary' ? hits[0].item.term : null;
    assert.equal(term(repo.search('Haus')), 'Haus');
    // No umlaut on the keyboard, and ss for ß: both must still work.
    assert.ok(repo.search('strasse').some((h) => h.kind === 'vocabulary' && h.item.term === 'Straße'));
    assert.ok(repo.search('kuche').some((h) => h.kind === 'vocabulary' && h.item.term === 'Küche'));
    // Looking up the grammar by what it is called.
    assert.ok(repo.search('Passiv', { kind: 'grammar' }).length > 0);
  });
});

describe('the real corpus becomes lessons a person could finish', () => {
  const items = readVocabulary(vocabulary as unknown as RawVocabularyFile);
  const repo = new InMemoryContentRepository('de', items);
  const titles = readCategoryTitles(vocabulary as unknown as Parameters<typeof readCategoryTitles>[0]);
  const byCategory = lessonsByCategory(repo, { titles });
  const byLevel = lessonsByLevel(repo);

  test('every lesson is between 10 and 20 items, unless its category is smaller than that', () => {
    for (const lesson of [...byCategory, ...byLevel]) {
      const groupSize = lesson.groupId.includes('/')
        ? repo.vocabulary({ category: lesson.groupId }).length
        : Infinity;
      if (groupSize >= DEFAULT_SHAPE.min) {
        assert.ok(lesson.itemIds.length >= DEFAULT_SHAPE.min,
          `${lesson.id} has only ${lesson.itemIds.length} items`);
      }
      assert.ok(lesson.itemIds.length <= DEFAULT_SHAPE.max,
        `${lesson.id} has ${lesson.itemIds.length} items — too long for one sitting`);
    }
  });

  test('every card is reachable through at least one lesson', () => {
    const covered = new Set([...byCategory, ...byLevel].flatMap((l) => l.itemIds));
    for (const item of items) {
      assert.ok(covered.has(item.id), `${item.id} (${item.term}) is in no lesson`);
    }
  });

  test('the first lesson of a level teaches common words, not obscure ones', () => {
    const first = byLevel.find((lesson) => lesson.groupId === 'a1' && lesson.index === 1);
    assert.ok(first);
    const ranks = repo.items(first.itemIds).map((i) => i.frequencyRank).filter((r) => r > 0);
    assert.ok(ranks.length > 0, 'the first A1 lesson has no ranked words at all');
    const worst = Math.max(...ranks);
    assert.ok(worst < 500, `the first A1 lesson reaches rank ${worst} — it is not the common words`);
  });

  test('lesson membership is stable across rebuilds — progress is shown against it', () => {
    assert.deepEqual(lessonsByLevel(repo), byLevel);
  });

  test('a learner finishes a real lesson and the app can say so', async () => {
    const store = new InMemoryProgressStore();
    const lesson = byLevel.find((l) => l.groupId === 'a1' && l.index === 1);
    assert.ok(lesson);

    const before = lessonStatus(lesson, new Map());
    assert.equal(before.complete, false);

    let when = T0;
    for (const itemId of lesson.itemIds) {
      const record = await store.get('u1', itemId);
      await store.put(review(record, GRADE.GOOD, { now: when }));
      when += 20_000;
    }

    const records = await store.all('u1');
    const after = lessonStatus(lesson, new Map(records.map((r) => [r.itemId, r])));
    assert.equal(after.total, lesson.itemIds.length);
    assert.equal(after.learned, lesson.itemIds.length);
    assert.equal(after.complete, true);

    // And the app now points at the next one, not back at this one.
    assert.equal(nextLesson(byLevel, new Map(records.map((r) => [r.itemId, r])))?.index, 2);
  });
});
