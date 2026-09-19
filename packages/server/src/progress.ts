/**
 * Stored progress, and the sync endpoint's half of the merge.
 *
 * The merge rule itself lives in `@nemcina/core` so the client and the server
 * cannot disagree about who wins. This module is the part that has to be here:
 * reading and writing rows, and refusing anything that does not belong to the
 * account that sent it.
 */

import type { DatabaseSync } from 'node:sqlite';
import { isProgressRecord, mergeProgress, type ItemProgress, type MasteryState } from '@nemcina/core';

const toRecord = (row: Record<string, unknown>): ItemProgress => ({
  userId: String(row.user_id),
  itemId: String(row.item_id),
  state: String(row.state) as MasteryState,
  seen: Number(row.seen) === 1,
  correctCount: Number(row.correct_count),
  incorrectCount: Number(row.incorrect_count),
  repetitionCount: Number(row.repetition_count),
  lastReviewed: Number(row.last_reviewed),
  dueAt: Number(row.due_at),
  difficulty: Number(row.difficulty),
  stability: Number(row.stability),
});

export interface SyncResult {
  /** Records the client did not have, or had an older version of. */
  readonly changed: readonly ItemProgress[];
  /** Server clock at the moment of the merge; the client sends it back next time. */
  readonly syncedAt: number;
  readonly accepted: number;
  /** Records refused for being malformed. Reported, never silently dropped. */
  readonly rejected: number;
}

export class ProgressStorage {
  readonly #db: DatabaseSync;
  readonly #now: () => number;

  constructor(db: DatabaseSync, now: () => number = Date.now) {
    this.#db = db;
    this.#now = now;
  }

  all(userId: string): readonly ItemProgress[] {
    const rows = this.#db.prepare('SELECT * FROM progress WHERE user_id = ?')
      .all(userId) as Record<string, unknown>[];
    return rows.map(toRecord);
  }

  /** Everything the server has seen change since a moment on its own clock. */
  changedSince(userId: string, since: number): readonly ItemProgress[] {
    const rows = this.#db.prepare('SELECT * FROM progress WHERE user_id = ? AND updated_at > ?')
      .all(userId, since) as Record<string, unknown>[];
    return rows.map(toRecord);
  }

  /**
   * Merge a client's records in and report what it is missing.
   *
   * `since` is the server timestamp the client last synced at. Sending only
   * what changed after it keeps a sync small; sending 0 asks for everything,
   * which is what a fresh install does.
   *
   * Records are stamped with the **server's** clock, never the client's. A
   * device with a wrong clock would otherwise be able to make its rows
   * permanently invisible to itself, or permanently newest.
   */
  sync(userId: string, incoming: readonly unknown[], since: number): SyncResult {
    const valid: ItemProgress[] = [];
    let rejected = 0;
    for (const candidate of incoming) {
      if (!isProgressRecord(candidate)) { rejected += 1; continue; }
      // A client may only write its own rows, whatever the payload claims.
      valid.push({ ...candidate, userId });
    }

    const stored = this.all(userId);
    const { toPush, toApply } = mergeProgress(valid, stored);
    const at = this.#now();

    // `toPush` is what the client holds and the server does not — exactly the
    // rows to write. `toApply` is the reverse, and goes back in the response.
    if (toPush.length > 0) {
      const write = this.#db.prepare(`
        INSERT INTO progress (user_id, item_id, state, seen, correct_count, incorrect_count,
                              repetition_count, last_reviewed, due_at, difficulty, stability, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, item_id) DO UPDATE SET
          state = excluded.state, seen = excluded.seen,
          correct_count = excluded.correct_count, incorrect_count = excluded.incorrect_count,
          repetition_count = excluded.repetition_count, last_reviewed = excluded.last_reviewed,
          due_at = excluded.due_at, difficulty = excluded.difficulty,
          stability = excluded.stability, updated_at = excluded.updated_at`);
      this.#db.exec('BEGIN');
      try {
        for (const record of toPush) {
          write.run(
            userId, record.itemId, record.state, record.seen ? 1 : 0,
            record.correctCount, record.incorrectCount, record.repetitionCount,
            record.lastReviewed, record.dueAt, record.difficulty, record.stability, at,
          );
        }
        this.#db.exec('COMMIT');
      } catch (error) {
        this.#db.exec('ROLLBACK');
        throw error;
      }
    }

    // What to send back: everything the client is behind on. That is the rows
    // the merge said it should adopt, plus anything another device changed
    // since its last sync.
    const byId = new Map<string, ItemProgress>();
    for (const record of toApply) byId.set(record.itemId, record);
    if (since > 0) {
      for (const record of this.changedSince(userId, since)) {
        if (!toPush.some((pushed) => pushed.itemId === record.itemId)) {
          byId.set(record.itemId, record);
        }
      }
    } else {
      // A fresh install asks for everything it does not already hold.
      const held = new Set(valid.map((record) => record.itemId));
      for (const record of stored) if (!held.has(record.itemId)) byId.set(record.itemId, record);
    }

    const changed = [...byId.values()].sort((a, b) =>
      a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0);
    return { changed, syncedAt: at, accepted: toPush.length, rejected };
  }

  clear(userId: string): void {
    this.#db.prepare('DELETE FROM progress WHERE user_id = ?').run(userId);
  }
}
