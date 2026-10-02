/**
 * Thematic lessons: one topic, plus the reviews that are actually due.
 *
 * The old shape of a vocabulary lesson here was a slice of a level in teaching
 * order. Teaching order is level, then frequency, then the word itself — and
 * almost nothing in a topic list carries a frequency rank, so in practice the
 * slices came out alphabetical. "A2, lesson 1" was *meinen, Liebe, Geld,
 * finden, Ordnung, brauchen, Problem…*: twenty words with nothing in common but
 * their level, which is the thing this file exists to stop.
 *
 * A lesson is now a cluster — airport words, or kitchen words — with a minority
 * of review items mixed in from wherever the scheduler says they are owed. Both
 * halves matter. All-thematic forever would quietly drop the spacing that makes
 * vocabulary stick; all-scheduler is where we started.
 *
 * The split is not fixed. A learner with forty overdue items does not need
 * seventeen new airport words, and one with none should not have three slots
 * wasted on filler. `composeLesson` reads the learner's actual state and moves
 * the ratio inside a band that always leaves the topic in the clear majority —
 * because the whole point is that the lesson still feels like it is *about*
 * something.
 */

import { bucketOf, priority, shuffle, type Random } from './selection.ts';
import { isDue } from './srs.ts';
import type {
  CefrLevel, ItemProgress, Timestamp, VocabularyCluster, VocabularyItem,
} from './types.ts';

// --- how a lesson is mixed ---------------------------------------------------

export interface LessonMix {
  /** Items in a full lesson. */
  readonly target: number;
  /** The fewest review slots to offer when anything at all is owed. */
  readonly minReview: number;
  /**
   * The most review slots, as a share of the lesson. Above this the topic stops
   * being the thing the lesson is about, which is the failure this file exists
   * to prevent — so it is a ceiling, not a target.
   */
  readonly maxReviewShare: number;
}

export const DEFAULT_LESSON_MIX: LessonMix = { target: 20, minReview: 3, maxReviewShare: 0.4 };

/**
 * How many of a lesson's slots should go to review, given what is owed.
 *
 * Nothing owed means a fully thematic lesson rather than three slots of
 * padding. A pile of overdue work earns more room, up to the ceiling. In
 * between it tracks demand instead of sitting on a constant, so the lesson a
 * learner gets reflects the state they are actually in.
 */
export function reviewSlots(
  owed: number, mix: LessonMix = DEFAULT_LESSON_MIX,
): number {
  if (owed <= 0) return 0;
  const ceiling = Math.floor(mix.target * mix.maxReviewShare);
  // Roughly a third of what is owed, so a small debt stays small and a large
  // one is not cleared in a single sitting either.
  const wanted = Math.ceil(owed / 3);
  // The floor is applied before the cap on what actually exists, not after:
  // with one word owed, a floor of three would otherwise ask for three.
  return Math.min(owed, Math.max(mix.minReview, Math.min(ceiling, wanted)));
}

export interface LessonComposition {
  readonly clusterId: string;
  /** Items from the lesson's own topic, in the order they should be asked. */
  readonly thematicIds: readonly string[];
  /** Items pulled in by the scheduler from anywhere in the course. */
  readonly reviewIds: readonly string[];
  /** thematicIds + reviewIds, which is what the session is planned over. */
  readonly itemIds: readonly string[];
}

/**
 * Build one thematic lesson.
 *
 * `reviewPool` is everything outside the cluster the learner has already met;
 * items inside the cluster are never also counted as review, so a word cannot
 * be asked twice in one sitting under two different headings.
 */
export function composeLesson(
  cluster: VocabularyCluster,
  clusterItems: readonly VocabularyItem[],
  reviewPool: readonly VocabularyItem[],
  progress: ReadonlyMap<string, ItemProgress>,
  options: { now?: Timestamp; mix?: LessonMix; random?: Random } = {},
): LessonComposition {
  const now = options.now ?? Date.now();
  const mix = options.mix ?? DEFAULT_LESSON_MIX;
  const random = options.random ?? Math.random;

  const inCluster = new Set(cluster.itemIds);

  // Candidates for the review half: seen, outside this topic, and either the
  // scheduler says they are due or the learner has got them wrong.
  const owedPool = reviewPool
    .filter((item) => !inCluster.has(item.id))
    .map((item) => ({ item, record: progress.get(item.id) }))
    .filter((entry): entry is { item: VocabularyItem; record: ItemProgress } => {
      if (!entry.record?.seen) return false;
      const bucket = bucketOf(entry.record, now);
      return bucket === 'weak' || bucket === 'due';
    });

  const slots = reviewSlots(owedPool.length, mix);
  const review = owedPool
    // §23: overdue and failed first. `priority` already ranks weak above due
    // and sorts within each by how faded the memory is, so the review half is
    // ordered by the same rule the scheduler uses everywhere else.
    .sort((a, b) => priority(b.record, now) - priority(a.record, now))
    .slice(0, slots)
    .map((entry) => entry.item.id);

  // The topic keeps every slot review did not take. A short cluster simply
  // makes a short lesson; padding it with unrelated words to hit twenty would
  // undo the whole point.
  const thematicRoom = Math.max(0, mix.target - review.length);
  const thematic = orderThematic(clusterItems, progress, now, random).slice(0, thematicRoom);

  return {
    clusterId: cluster.id,
    thematicIds: thematic,
    reviewIds: review,
    itemIds: [...thematic, ...review],
  };
}

/**
 * Order a cluster's own words for one sitting.
 *
 * Words the learner has already struggled with come first, then ones in
 * progress, then new ones — but inside each of those the order is shuffled, so
 * the same cluster studied twice does not arrive as the same list. Clustering
 * is meant to build a mental group, not to train a sequence: a learner who has
 * learned *Flughafen, Flug, Flugzeug, fliegen* in that order every time has
 * learned the order.
 */
function orderThematic(
  items: readonly VocabularyItem[],
  progress: ReadonlyMap<string, ItemProgress>,
  now: Timestamp,
  random: Random,
): string[] {
  const needsWork: VocabularyItem[] = [];
  const started: VocabularyItem[] = [];
  const fresh: VocabularyItem[] = [];
  // Mastered words are left out unless the cluster has nothing else to offer:
  // the scheduler decides when a known word comes back, and a thematic lesson
  // that keeps re-teaching them is a lesson the learner stops opening.
  const mastered: VocabularyItem[] = [];

  for (const item of items) {
    const record = progress.get(item.id);
    if (!record?.seen) { fresh.push(item); continue; }
    const bucket = bucketOf(record, now);
    if (bucket === 'weak' || bucket === 'due') needsWork.push(item);
    else if (record.state === 'mastered') mastered.push(item);
    else started.push(item);
  }

  return [
    ...shuffle(needsWork, random),
    ...shuffle(started, random),
    ...shuffle(fresh, random),
    ...shuffle(mastered, random),
  ].map((item) => item.id);
}

// --- where the learner stands ------------------------------------------------

export interface ClusterStatus {
  readonly clusterId: string;
  readonly total: number;
  readonly seen: number;
  readonly learned: number;
  readonly mastered: number;
  /** Learned / total, 0–1. */
  readonly completion: number;
  /** Every word learned. The content is covered. */
  readonly complete: boolean;
  readonly started: boolean;
  /** Learned words the scheduler now wants back. */
  readonly due: number;
}

/**
 * Progress through one cluster.
 *
 * `complete` means the content has been covered, which is deliberately not the
 * same as mastery (§32): words keep coming back through review long after their
 * lesson is finished, and a screen that said "Airport ✓ done" while four of its
 * words were overdue would be lying. `due` is reported next to it so both facts
 * are available and neither has to stand in for the other.
 */
export function clusterStatus(
  cluster: VocabularyCluster,
  progress: ReadonlyMap<string, ItemProgress>,
  now: Timestamp = Date.now(),
): ClusterStatus {
  let seen = 0, learned = 0, mastered = 0, due = 0;
  for (const id of cluster.itemIds) {
    const record = progress.get(id);
    if (!record?.seen) continue;
    seen += 1;
    if (record.state === 'review' || record.state === 'strong' || record.state === 'mastered') {
      learned += 1;
    }
    if (record.state === 'mastered') mastered += 1;
    if (isDue(record, now)) due += 1;
  }
  const total = cluster.itemIds.length;
  return {
    clusterId: cluster.id,
    total, seen, learned, mastered, due,
    completion: total === 0 ? 0 : learned / total,
    complete: total > 0 && learned === total,
    started: seen > 0 && learned < total,
  };
}

export interface TopicProgress {
  readonly category: string;
  readonly subcategory: string;
  readonly level: CefrLevel;
  readonly clusters: readonly VocabularyCluster[];
  readonly total: number;
  readonly learned: number;
  readonly mastered: number;
  readonly completion: number;
  readonly clustersComplete: number;
}

/**
 * Progress rolled up to the topic, for a category card (§31) or a bar (§30).
 *
 * Named for vocabulary because grammar already exports a `topicProgress` over
 * its own topics, and one of the two having to be renamed at the import site is
 * how a screen ends up showing grammar numbers on a vocabulary card.
 */
export function vocabularyTopicProgress(
  clusters: readonly VocabularyCluster[],
  progress: ReadonlyMap<string, ItemProgress>,
  now: Timestamp = Date.now(),
): readonly TopicProgress[] {
  const groups = new Map<string, VocabularyCluster[]>();
  for (const cluster of clusters) {
    const key = `${cluster.level}/${cluster.category}/${cluster.subcategory}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(cluster);
    else groups.set(key, [cluster]);
  }

  const out: TopicProgress[] = [];
  for (const bucket of groups.values()) {
    const ordered = bucket.slice().sort((a, b) => a.order - b.order);
    let total = 0, learned = 0, mastered = 0, done = 0;
    for (const cluster of ordered) {
      const status = clusterStatus(cluster, progress, now);
      total += status.total;
      learned += status.learned;
      mastered += status.mastered;
      if (status.complete) done += 1;
    }
    const first = ordered[0] as VocabularyCluster;
    out.push({
      category: first.category,
      subcategory: first.subcategory,
      level: first.level,
      clusters: ordered,
      total, learned, mastered,
      completion: total === 0 ? 0 : learned / total,
      clustersComplete: done,
    });
  }
  return out;
}

/**
 * The cluster to study next (§25, §38, §39).
 *
 * A cluster already begun outranks a fresh one: finishing what is open beats
 * opening something else, and it is what the learner expects the button to do.
 * Otherwise it is the first unfinished cluster in course order, which for a
 * learner with no history at all is simply the first cluster of the level —
 * a coherent starter lesson rather than a random draw.
 *
 * The order of `clusters` as given *is* the course order: the build emits them
 * grouped by topic, each topic in the order its source teaches it. Re-sorting
 * here by subcategory name would replace that with the alphabet, so finishing
 * the first Travel lesson would send the learner to Food rather than to the
 * second Travel lesson.
 */
export function recommendCluster(
  clusters: readonly VocabularyCluster[],
  progress: ReadonlyMap<string, ItemProgress>,
  now: Timestamp = Date.now(),
): VocabularyCluster | null {
  let firstUntouched: VocabularyCluster | null = null;
  for (const cluster of clusters) {
    const status = clusterStatus(cluster, progress, now);
    if (status.started) return cluster;
    if (!status.complete && !firstUntouched) firstUntouched = cluster;
  }
  return firstUntouched;
}

/**
 * The cluster after this one, for "what's next" at the end of a lesson (§32).
 * Stays inside the same topic while that topic has anything left, then moves on.
 */
export function nextCluster(
  clusters: readonly VocabularyCluster[],
  current: VocabularyCluster,
  progress: ReadonlyMap<string, ItemProgress>,
  now: Timestamp = Date.now(),
): VocabularyCluster | null {
  const sameTopic = clusters.filter(
    (c) => c.subcategory === current.subcategory && c.level === current.level,
  );
  for (const cluster of sameTopic) {
    if (cluster.id === current.id) continue;
    if (!clusterStatus(cluster, progress, now).complete) return cluster;
  }
  const at = clusters.findIndex((c) => c.id === current.id);
  for (const cluster of clusters.slice(at + 1)) {
    if (!clusterStatus(cluster, progress, now).complete) return cluster;
  }
  return null;
}

/** Every item the scheduler says is owed, for the mixed-review route (§37). */
export function dueItemIds(
  progress: ReadonlyMap<string, ItemProgress>,
  now: Timestamp = Date.now(),
): readonly string[] {
  return [...progress.values()]
    .filter((record) => record.seen && isDue(record, now))
    .sort((a, b) => priority(b, now) - priority(a, now))
    .map((record) => record.itemId);
}
