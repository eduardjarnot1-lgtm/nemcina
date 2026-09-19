/**
 * Two devices, the real engine, the real server, real HTTP.
 *
 * Everything else tests a piece. This tests the thing the pieces are for: a
 * learner studies on one device, and the work is on the other. It uses the
 * client's own `syncProgress` and its own `ProgressStore`, so what is exercised
 * here is what the app ships, not a test harness that resembles it.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRADE, InMemoryProgressStore, NO_SYNC, review, syncProgress,
  type Grade, type ItemProgress, type SyncBookmark, type SyncResponse, type SyncTransport,
} from '@nemcina/core';
import { createApi, type Api } from '../src/http.ts';
import { readConfig } from '../src/config.ts';

const config = readConfig({ NODE_ENV: 'test', TOKEN_PEPPER: 'test-pepper', DATABASE_PATH: ':memory:' });
let clock = 1_700_000_000_000;
let api: Api;
let base: string;

before(async () => {
  api = createApi(config, () => clock);
  base = `http://127.0.0.1:${await api.listen(0)}`;
});
after(async () => { await api.close(); });

/** The transport the app would ship: one fetch, no cleverness. */
const httpTransport = (token: string): SyncTransport => ({
  async push(records, since) {
    const response = await fetch(`${base}/progress/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ records, since }),
    });
    if (!response.ok) throw new Error(`sync failed: ${response.status}`);
    return await response.json() as SyncResponse;
  },
});

async function account(email: string): Promise<string> {
  const response = await fetch(`${base}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'a long enough password' }),
  });
  const session = await response.json() as { token: string };
  return session.token;
}

/** A device: its own store, its own bookmark, nothing shared. */
class Device {
  readonly store = new InMemoryProgressStore();
  readonly userId: string;
  readonly transport: SyncTransport;
  bookmark: SyncBookmark = NO_SYNC;

  constructor(userId: string, transport: SyncTransport) {
    this.userId = userId;
    this.transport = transport;
  }

  async study(itemId: string, grade: Grade, at: number): Promise<ItemProgress> {
    const before = await this.store.get(this.userId, itemId);
    const after = review(before, grade, { now: at });
    await this.store.put(after);
    return after;
  }

  async sync(options: { full?: boolean } = {}) {
    const outcome = await syncProgress(
      this.store, this.transport, this.userId, this.bookmark, { ...options, now: clock },
    );
    this.bookmark = outcome.bookmark;
    return outcome;
  }

  async known(): Promise<string[]> {
    return (await this.store.all(this.userId)).map((r) => r.itemId).sort();
  }
}

describe('two devices, one account', () => {
  test('THE thing this package exists for: the train, then the tablet', async () => {
    const token = await account('roundtrip@example.com');
    const userId = 'local';
    const phone = new Device(userId, httpTransport(token));
    const tablet = new Device(userId, httpTransport(token));

    // On the train: three words, offline.
    await phone.study('haus', GRADE.GOOD, clock);
    await phone.study('tisch', GRADE.GOOD, clock);
    await phone.study('stuhl', GRADE.AGAIN, clock);
    assert.deepEqual(await tablet.known(), [], 'precondition: the tablet knows nothing');

    // Signal comes back.
    const pushed = await phone.sync();
    assert.equal(pushed.pushed, 3);
    assert.equal(pushed.pulled, 0);

    // At home, on the tablet.
    clock += 3_600_000;
    const pulled = await tablet.sync();
    assert.equal(pulled.pulled, 3);
    assert.deepEqual(await tablet.known(), ['haus', 'stuhl', 'tisch']);

    // And the scheduling state came with it, not just the ids.
    const haus = await tablet.store.get(userId, 'haus');
    const phoneHaus = await phone.store.get(userId, 'haus');
    assert.equal(haus.stability, phoneHaus.stability);
    assert.equal(haus.dueAt, phoneHaus.dueAt);
    assert.equal(haus.state, 'review');
    assert.equal((await tablet.store.get(userId, 'stuhl')).state, 'learning',
      'the failed word arrived as failed');
  });

  test('work done on the tablet goes back to the phone', async () => {
    const token = await account('both-ways@example.com');
    const phone = new Device('local', httpTransport(token));
    const tablet = new Device('local', httpTransport(token));

    await phone.study('eins', GRADE.GOOD, clock);
    await phone.sync();
    clock += 60_000;
    await tablet.sync();

    await tablet.study('zwei', GRADE.GOOD, clock);
    await tablet.sync();
    clock += 60_000;

    const back = await phone.sync();
    assert.equal(back.pulled, 1);
    assert.deepEqual(await phone.known(), ['eins', 'zwei']);
  });

  test('the later review wins on both devices, not just on the server', async () => {
    const token = await account('conflict-roundtrip@example.com');
    const phone = new Device('local', httpTransport(token));
    const tablet = new Device('local', httpTransport(token));

    // Both offline, both reviewing the same word, the tablet later.
    await phone.study('konflikt', GRADE.GOOD, clock);
    await tablet.study('konflikt', GRADE.AGAIN, clock + 86_400_000);

    await phone.sync();
    clock += 2 * 86_400_000;
    await tablet.sync();
    // The phone syncs again and must adopt the newer state.
    const resolved = await phone.sync();

    assert.equal(resolved.pulled, 1);
    const onPhone = await phone.store.get('local', 'konflikt');
    const onTablet = await tablet.store.get('local', 'konflikt');
    assert.equal(onPhone.lastReviewed, onTablet.lastReviewed);
    assert.equal(onPhone.state, 'learning', 'the phone kept its own older answer');
  });

  test('syncing twice in a row does nothing the second time', async () => {
    const token = await account('idempotent@example.com');
    const phone = new Device('local', httpTransport(token));
    await phone.study('wort', GRADE.GOOD, clock);
    await phone.sync();
    clock += 1_000;
    const again = await phone.sync();
    assert.equal(again.pushed, 0);
    assert.equal(again.pulled, 0);
  });

  test('a fresh install asks for everything and gets it', async () => {
    const token = await account('reinstall@example.com');
    const before = new Device('local', httpTransport(token));
    for (const word of ['a', 'b', 'c', 'd']) await before.study(word, GRADE.GOOD, clock);
    await before.sync();

    clock += 86_400_000;
    const reinstalled = new Device('local', httpTransport(token));
    const outcome = await reinstalled.sync({ full: true });
    assert.equal(outcome.pulled, 4);
    assert.deepEqual(await reinstalled.known(), ['a', 'b', 'c', 'd']);
  });

  test('a device offline for a week catches up in one sync', async () => {
    const token = await account('catchup@example.com');
    const phone = new Device('local', httpTransport(token));
    const tablet = new Device('local', httpTransport(token));
    await phone.sync();
    await tablet.sync();

    for (let day = 0; day < 7; day += 1) {
      clock += 86_400_000;
      await phone.study(`day${day}`, GRADE.GOOD, clock);
      await phone.sync();
    }

    clock += 3_600_000;
    const outcome = await tablet.sync();
    assert.equal(outcome.pulled, 7);
    assert.equal((await tablet.known()).length, 7);
  });

  test('a sync that fails leaves the local store intact', async () => {
    const phone = new Device('local', {
      async push() { throw new Error('no network'); },
    });
    await phone.study('offline', GRADE.GOOD, clock);
    await assert.rejects(() => phone.sync(), /no network/);
    assert.deepEqual(await phone.known(), ['offline'], 'a failed sync lost local work');
    assert.deepEqual(phone.bookmark, NO_SYNC, 'a failed sync moved the bookmark');
  });

  test('an unusable token cannot sync, and says so', async () => {
    const phone = new Device('local', httpTransport('forged'));
    await phone.study('nope', GRADE.GOOD, clock);
    await assert.rejects(() => phone.sync(), /sync failed: 401/);
  });
});

describe('what the server is trusted with', () => {
  test('another account never sees these records', async () => {
    const mine = await account('mine@example.com');
    const theirs = await account('theirs@example.com');
    const phone = new Device('local', httpTransport(mine));
    await phone.study('private', GRADE.GOOD, clock);
    await phone.sync();

    const stranger = new Device('local', httpTransport(theirs));
    await stranger.sync({ full: true });
    assert.deepEqual(await stranger.known(), []);
  });

  test('progress is keyed to the local user, whatever the server calls the account', async () => {
    const token = await account('keying@example.com');
    const phone = new Device('local', httpTransport(token));
    await phone.study('haus', GRADE.GOOD, clock);
    await phone.sync();

    const fresh = new Device('local', httpTransport(token));
    await fresh.sync({ full: true });
    const record = await fresh.store.get('local', 'haus');
    assert.equal(record.userId, 'local', 'the account id leaked into the local key');
    assert.equal(record.seen, true);
  });
});
