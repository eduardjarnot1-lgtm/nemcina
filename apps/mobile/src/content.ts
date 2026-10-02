/**
 * The course, loaded once.
 *
 * The content is bundled with the app rather than fetched, because the product
 * has to work on a train (§offline). That costs about four megabytes in the
 * bundle and a parse on first use, so the parse happens once, lazily, and every
 * screen shares the result.
 *
 * This is the only module that knows where the Python pipeline writes its
 * output. If `app/data` ever moves, it moves here and nowhere else.
 */
import {
  InMemoryContentRepository,
  readCategoryTitles,
  readClusters,
  readGrammar,
  readVocabulary,
  type ContentRepository,
  type RawGrammarFile,
  type RawVocabularyFile,
  type VocabularyCluster,
} from '@nemcina/core';

import vocabularyJson from '../../../app/data/vocabulary.json';
import grammarJson from '../../../app/data/grammar.json';

/** A topic — one subcategory at one level — and the lessons it is cut into. */
export interface Topic {
  readonly id: string;
  readonly level: string;
  readonly category: string;
  readonly subcategory: string;
  /** The name the content gives it: "Travel", "Health & the body". */
  readonly title: string;
  readonly clusters: readonly VocabularyCluster[];
  readonly wordCount: number;
}

export interface Course {
  readonly repository: ContentRepository<'de'>;
  /** Every lesson cluster, in build order. */
  readonly clusters: readonly VocabularyCluster[];
  readonly clustersById: ReadonlyMap<string, VocabularyCluster>;
  /** Topics grouped by level, for the browse screen. */
  readonly topicsByLevel: ReadonlyMap<string, readonly Topic[]>;
  /** Topic lookup by `level/subcategory`. */
  readonly topicsById: ReadonlyMap<string, Topic>;
}

let course: Course | null = null;

export function loadCourse(): Course {
  if (course) return course;

  const vocabularyFile = vocabularyJson as unknown as RawVocabularyFile;
  const grammarFile = grammarJson as unknown as RawGrammarFile;

  const clusters = readClusters(vocabularyFile);
  const repository = new InMemoryContentRepository(
    'de',
    readVocabulary(vocabularyFile),
    readGrammar(grammarFile),
    clusters,
  );
  const titles = readCategoryTitles(
    vocabularyJson as unknown as Parameters<typeof readCategoryTitles>[0],
  );

  const clustersById = new Map<string, VocabularyCluster>();
  for (const cluster of clusters) clustersById.set(cluster.id, cluster);

  // Clusters arrive already grouped by topic and in course order, so building
  // the topic list is a grouping rather than a sort — the order a learner walks
  // through a topic is decided once, in the build, not per screen.
  const topicsById = new Map<string, Topic>();
  for (const cluster of clusters) {
    const id = `${cluster.level}/${cluster.subcategory}`;
    const existing = topicsById.get(id);
    if (existing) {
      (existing.clusters as VocabularyCluster[]).push(cluster);
      continue;
    }
    topicsById.set(id, {
      id,
      level: cluster.level,
      category: cluster.category,
      subcategory: cluster.subcategory,
      title: titles[`${cluster.category}/${cluster.subcategory}`] ?? cluster.subcategory,
      clusters: [cluster],
      wordCount: 0,
    });
  }
  for (const topic of topicsById.values()) {
    (topic as { wordCount: number }).wordCount =
      topic.clusters.reduce((sum, cluster) => sum + cluster.itemIds.length, 0);
  }

  const topicsByLevel = new Map<string, Topic[]>();
  for (const topic of topicsById.values()) {
    const bucket = topicsByLevel.get(topic.level);
    if (bucket) bucket.push(topic);
    else topicsByLevel.set(topic.level, [topic]);
  }
  // Biggest topics first: a learner scanning A2 should meet Travel and Health
  // before a six-word corner of the list.
  for (const bucket of topicsByLevel.values()) {
    bucket.sort((a, b) => (b.wordCount - a.wordCount) || (a.title < b.title ? -1 : 1));
  }

  course = { repository, clusters, clustersById, topicsByLevel, topicsById };
  return course;
}
