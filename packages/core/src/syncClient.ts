/**
 * The client half of sync.
 *
 * Knows nothing about HTTP. It is handed a transport — one method, one
 * round trip — so it can be driven against a real server in tests, against a
 * fake one in unit tests, and against whatever the app ends up shipping,
 * without any of them being the version that is only exercised in production.
 *
 * The merge itself is not repeated here. The server applies the rule from
 * `sync.ts` and answers with exactly the records this device is behind on;
 * re-deciding locally would be a second implementation to keep in step.
 */

import type { ProgressStore } from './storage.ts';
import type { ItemProgress, Timestamp } from './types.ts';

export interface SyncResponse {
  /** Records this device should adopt. */
  readonly changed: readonly ItemProgress[];
  /** The server's clock at the merge. Sent back on the next sync. */
  readonly syncedAt: Timestamp;
  readonly accepted: number;
  readonly rejected: number;
}

export interface SyncTransport {
  push(records: readonly ItemProgress[], since: Timestamp): Promise<SyncResponse>;
}

/**
 * Where the sync bookmarks live.
 *
 * Two clocks, deliberately kept apart. `serverSyncedAt` is the server's own
 * timestamp and is only ever echoed back, never compared to anything local.
 * `localPushedAt` is this device's clock and is only ever compared to this
 * device's records. Mixing them is how a phone with a wrong clock stops syncing.
 */
export interface SyncBookmark {
  readonly serverSyncedAt: Timestamp;
  readonly localPushedAt: Timestamp;
}

export const NO_SYNC: SyncBookmark = { serverSyncedAt: 0, localPushedAt: 0 };

export interface SyncOutcome {
  readonly pushed: number;
  readonly pulled: number;
  readonly rejected: number;
  readonly bookmark: SyncBookmark;
}

export interface SyncOptions {
  /** Send everything rather than the recent changes. A fresh install wants this. */
  readonly full?: boolean;
  readonly now?: Timestamp;
}

/**
 * One sync.
 *
 * Returns the new bookmark rather than storing it: where a bookmark belongs is
 * a platform question — a key-value store on a phone, a preference on the web —
 * and this module is not the place to decide it.
 */
export async function syncProgress(
  store: ProgressStore,
  transport: SyncTransport,
  userId: string,
  bookmark: SyncBookmark = NO_SYNC,
  options: SyncOptions = {},
): Promise<SyncOutcome> {
  const now = options.now ?? Date.now();
  const all = await store.all(userId);

  // Only what this device has touched since it last pushed. A little slack, so
  // a record written in the same millisecond as the last sync is not skipped.
  const since = bookmark.localPushedAt;
  const outgoing = options.full || since === 0
    ? all
    : all.filter((record) => record.lastReviewed >= since);

  const response = await transport.push(outgoing, options.full ? 0 : bookmark.serverSyncedAt);

  for (const record of response.changed) {
    // The server's records carry the account's id; keep the local key stable.
    await store.put({ ...record, userId });
  }

  return {
    pushed: response.accepted,
    pulled: response.changed.length,
    rejected: response.rejected,
    bookmark: { serverSyncedAt: response.syncedAt, localPushedAt: now },
  };
}
