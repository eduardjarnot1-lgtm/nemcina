/**
 * Ten example lessons, from the real database (§43).
 *
 * The clustering can pass every unit test and still produce lessons that feel
 * random, because "coherent" is not a property a unit test can check. So this
 * builds lessons the way the app builds them — same engine, same composition —
 * for learners in the states that matter, and prints them to be read.
 *
 *   node --experimental-strip-types scripts/example-lessons.ts
 */
import { readFileSync } from 'node:fs';
import {
  InMemoryContentRepository, composeLesson, readClusters, readGrammar, readVocabulary,
  recommendCluster, type ItemProgress, type VocabularyCluster,
} from '../packages/core/src/index.ts';

const file = JSON.parse(readFileSync('app/data/vocabulary.json', 'utf8'));
const grammar = JSON.parse(readFileSync('app/data/grammar.json', 'utf8'));
const clusters = readClusters(file);
const repo = new InMemoryContentRepository('de', readVocabulary(file), readGrammar(grammar), clusters);

const titles: Record<string, string> = {};
for (const group of file.categories ?? []) {
  for (const sub of group.subcategories ?? []) titles[`${group.id}/${sub.id}`] = sub.name;
}

const NOW = Date.now();
const DAY = 86_400_000;

const record = (itemId: string, over: Partial<ItemProgress> = {}): ItemProgress => ({
  userId: 'u', itemId, state: 'review', seen: true,
  correctCount: 3, incorrectCount: 0, repetitionCount: 3,
  lastReviewed: NOW - DAY * 2, dueAt: NOW + DAY, difficulty: 5, stability: 10, ...over,
});

/** Make a learner who has studied `studied` words and owes `owed` of them. */
function learner(level: string, studied: number, owed: number, weak = 0) {
  const pool = repo.vocabulary({ levels: [level as 'A2'] }).slice(0, studied);
  const map = new Map<string, ItemProgress>();
  pool.forEach((item, i) => {
    if (i < owed) map.set(item.id, record(item.id, { dueAt: NOW - DAY * (1 + (i % 9)) }));
    else if (i < owed + weak) {
      map.set(item.id, record(item.id, {
        state: 'learning', incorrectCount: 4, correctCount: 1, dueAt: NOW - DAY,
      }));
    } else map.set(item.id, record(item.id, { state: 'mastered', dueAt: NOW + DAY * 40 }));
  });
  return map;
}

function show(label: string, level: string, progress: Map<string, ItemProgress>, pick?: string) {
  const atLevel = clusters.filter((c) => c.level === level);
  const cluster: VocabularyCluster | null =
    (pick ? atLevel.find((c) => c.id === pick) ?? null : null) ?? recommendCluster(atLevel, progress, NOW);
  if (!cluster) { console.log(`${label}: no cluster\n`); return; }

  const composed = composeLesson(
    cluster, repo.items(cluster.itemIds), repo.vocabulary(), progress,
    { now: NOW, mix: { target: 20, minReview: 3, maxReviewShare: 0.4 } },
  );
  const topic = titles[`${cluster.category}/${cluster.subcategory}`] ?? cluster.subcategory;
  const term = (id: string) => repo.item(id)?.term ?? id;

  console.log(`── ${label}`);
  console.log(`   ${cluster.level}  ${topic.toUpperCase()}  ·  ${cluster.name}`);
  console.log(`   ${composed.itemIds.length} words  ·  ${composed.thematicIds.length} topic + ${composed.reviewIds.length} review`);
  console.log(`   TOPIC : ${composed.thematicIds.map(term).join(', ')}`);
  if (composed.reviewIds.length) {
    console.log(`   REVIEW: ${composed.reviewIds.map(term).join(', ')}`);
  }
  console.log();
}

console.log('TEN EXAMPLE LESSONS\n');
show('1. A1, brand-new learner', 'A1', new Map());
show('2. A2, brand-new learner', 'A2', new Map());
show('3. B1, brand-new learner', 'B1', new Map());
show('4. B2, brand-new learner', 'B2', new Map());
show('5. C1, brand-new learner', 'C1', new Map());
show('6. A2, returning learner with a few reviews owed', 'A2', learner('A2', 60, 4));
show('7. A2, returning learner with a big backlog', 'A2', learner('A2', 300, 90));
show('8. A2, learner with many weak words', 'A2', learner('A2', 120, 0, 40));
show('9. B1, learner who has mastered a lot and owes nothing', 'B1', learner('B1', 200, 0));
show('10. A2, learner choosing a topic by hand (hotel)', 'A2',
  learner('A2', 80, 10), clusters.find((c) => c.name.startsWith('Hotel'))?.id);
