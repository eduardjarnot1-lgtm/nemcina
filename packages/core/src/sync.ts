/**
 * Merging progress from two devices.
 *
 * Someone studies on the train with no signal, then again on a tablet at home.
 * Both devices hold a record for *Haus*. One of them is right, and the app has
 * to pick without asking the learner, who neither knows nor cares.
 *
 * The rule: **the later review wins.** A spaced-repetition record only changes
 * when the item is reviewed, and `lastReviewed` is exactly when that happened.
 * A device that reviewed the item more recently holds strictly newer knowledge;
 * the other device's state is what the newer one was computed from.
 *
 * What this costs, stated plainly: if the same item is reviewed on two devices
 * while both are offline, the earlier review is discarded rather than replayed.
 * Replaying the attempt log through the scheduler would preserve both and is
 * the better answer, but it requires the full log on both sides and a
 * deterministic replay; this is the rule that is right for the common case and
 * wrong only for a case that needs two offline devices and the same word.
 *
 * Nothing here talks to a network. It is a pure function over two sets of
 * records, so the client, the server and the tests all merge identically.
 */

import { MASTERY_STATES, type ItemProgress } from './types.ts';

/**
 * Which of two records for the same item to keep.
 *
 * Ties are broken by evidence, not by arbitrary choice: more attempts means the
 * record has seen more of the learner's history, and higher stability breaks
 * the remaining tie towards the record that the scheduler trusts more.
 */
export function pickNewer(left: ItemProgress, right: ItemProgress): ItemProgress {
  if (left.lastReviewed !== right.lastReviewed) {
    return left.lastReviewed > right.lastReviewed ? left : right;
  }
  const leftAttempts = left.correctCount + left.incorrectCount;
  const rightAttempts = right.correctCount + right.incorrectCount;
  if (leftAttempts !== rightAttempts) return leftAttempts > rightAttempts ? left : right;
  if (left.stability !== right.stability) return left.stability > right.stability ? left : right;
  return left;
}

export interface MergeResult {
  /** The state both sides should end up holding. */
  readonly merged: readonly ItemProgress[];
  /** Records the remote side does not have, or has an older version of. */
  readonly toPush: readonly ItemProgress[];
  /** Records the local side should adopt from the remote. */
  readonly toApply: readonly ItemProgress[];
}

/**
 * Merge two sets of records.
 *
 * Returns not just the answer but the two deltas, so a caller can send only
 * what the other side is missing instead of the whole history every time.
 */
export function mergeProgress(
  local: Iterable<ItemProgress>,
  remote: Iterable<ItemProgress>,
): MergeResult {
  const localById = new Map<string, ItemProgress>();
  for (const record of local) localById.set(record.itemId, record);
  const remoteById = new Map<string, ItemProgress>();
  for (const record of remote) remoteById.set(record.itemId, record);

  const merged: ItemProgress[] = [];
  const toPush: ItemProgress[] = [];
  const toApply: ItemProgress[] = [];

  for (const [itemId, mine] of localById) {
    const theirs = remoteById.get(itemId);
    if (!theirs) {
      merged.push(mine);
      toPush.push(mine);
      continue;
    }
    const winner = pickNewer(mine, theirs);
    merged.push(winner);
    if (winner === mine && !sameRecord(mine, theirs)) toPush.push(mine);
    if (winner === theirs && !sameRecord(mine, theirs)) toApply.push(theirs);
  }

  for (const [itemId, theirs] of remoteById) {
    if (localById.has(itemId)) continue;
    merged.push(theirs);
    toApply.push(theirs);
  }

  // Deterministic order, so two runs of the same merge produce the same bytes.
  const byId = (a: ItemProgress, b: ItemProgress) =>
    a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0;
  merged.sort(byId);
  toPush.sort(byId);
  toApply.sort(byId);
  return { merged, toPush, toApply };
}

function sameRecord(a: ItemProgress, b: ItemProgress): boolean {
  return a.lastReviewed === b.lastReviewed
    && a.dueAt === b.dueAt
    && a.stability === b.stability
    && a.difficulty === b.difficulty
    && a.state === b.state
    && a.correctCount === b.correctCount
    && a.incorrectCount === b.incorrectCount
    && a.repetitionCount === b.repetitionCount
    && a.seen === b.seen;
}

/**
 * Is this object actually a progress record?
 *
 * Anything arriving over a network is a stranger's guess at the shape until it
 * has been checked. The server must not write a row because a client said the
 * word "progress".
 */
export function isProgressRecord(value: unknown): value is ItemProgress {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  const numbers = [
    'correctCount', 'incorrectCount', 'repetitionCount',
    'lastReviewed', 'dueAt', 'difficulty', 'stability',
  ];
  return typeof record.userId === 'string'
    && typeof record.itemId === 'string' && record.itemId.length > 0
    && typeof record.state === 'string'
    && (MASTERY_STATES as readonly string[]).includes(record.state)
    && typeof record.seen === 'boolean'
    && numbers.every((key) => typeof record[key] === 'number' && Number.isFinite(record[key] as number));
}
