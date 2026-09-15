/**
 * The API, over real HTTP.
 *
 * The scenario at the end is the one the whole package exists for: study on a
 * phone with no signal, sign in on a tablet, and find the work there. It is run
 * against a real server on a real socket, because the parts that go wrong in
 * sync — auth headers, body parsing, whose rows are whose — are exactly the
 * parts a unit test of the merge function never touches.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApi, type Api } from '../src/http.ts';
import { readConfig } from '../src/config.ts';
import { newProgress, review, GRADE, type Grade, type ItemProgress } from '@nemcina/core';

const config = readConfig({ NODE_ENV: 'test', TOKEN_PEPPER: 'test-pepper', DATABASE_PATH: ':memory:' });
let clock = 1_700_000_000_000;
let api: Api;
let base: string;

before(async () => {
  api = createApi(config, () => clock);
  const port = await api.listen(0);
  base = `http://127.0.0.1:${port}`;
});
after(async () => { await api.close(); });

/** The body is whatever the server sent; these tests are what check its shape. */
interface Reply { status: number; body: any }

async function call(
  method: string, path: string, options: { token?: string; body?: unknown } = {},
): Promise<Reply> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  return { status: response.status, body: await response.json() };
}

/** A progress record as a client would produce it, through the real engine. */
const studied = (itemId: string, when: number, grade: Grade = GRADE.GOOD): ItemProgress =>
  review(newProgress('whatever-the-client-thinks', itemId), grade, { now: when });

describe('the shape of the thing', () => {
  test('health needs no credentials', async () => {
    const reply = await call('GET', '/health');
    assert.equal(reply.status, 200);
    assert.deepEqual(reply.body, { ok: true });
  });

  test('an unknown endpoint is a 404, not a 500', async () => {
    assert.equal((await call('GET', '/nope')).status, 404);
    assert.equal((await call('POST', '/accounts/../secrets')).status, 404);
  });

  test('a malformed body is refused with a reason', async () => {
    const response = await fetch(`${base}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    assert.equal(response.status, 400);
    const body = await response.json() as { error: string };
    assert.match(body.error, /valid JSON/);
  });
});

describe('everything private needs a session', () => {
  const guarded: [string, string][] = [
    ['GET', '/me'], ['DELETE', '/me'], ['DELETE', '/sessions'],
    ['DELETE', '/sessions/all'], ['POST', '/progress/sync'], ['DELETE', '/progress'],
  ];

  test('no token means 401, on every one of them', async () => {
    for (const [method, path] of guarded) {
      assert.equal((await call(method, path)).status, 401, `${method} ${path} was open`);
    }
  });

  test('a made-up token means 401 too', async () => {
    for (const [method, path] of guarded) {
      const reply = await call(method, path, { token: 'not-a-real-token' });
      assert.equal(reply.status, 401, `${method} ${path} accepted a forged token`);
    }
  });
});

describe('registering and signing in', () => {
  test('registering returns a session', async () => {
    const reply = await call('POST', '/accounts',
      { body: { email: 'a@example.com', password: 'a long enough password' } });
    assert.equal(reply.status, 201);
    assert.ok(reply.body.token);
    assert.equal(reply.body.account.tier, 'free');
    assert.equal('passwordHash' in reply.body.account, false, 'the hash left the server');
    assert.equal('password' in reply.body.account, false);
  });

  test('a bad password is refused with a useful message', async () => {
    const reply = await call('POST', '/accounts',
      { body: { email: 'b@example.com', password: 'short' } });
    assert.equal(reply.status, 400);
    assert.match(reply.body.error, /at least 10/);
  });

  test('/me reports the entitlement as a server fact', async () => {
    const session = (await call('POST', '/sessions',
      { body: { email: 'a@example.com', password: 'a long enough password' } })).body;
    const reply = await call('GET', '/me', { token: session.token });
    assert.equal(reply.status, 200);
    assert.equal(reply.body.premium, false);
    assert.equal(reply.body.account.email, 'a@example.com');
  });

  test('a client cannot make itself premium by saying so', async () => {
    const session = (await call('POST', '/sessions',
      { body: { email: 'a@example.com', password: 'a long enough password' } })).body;
    await call('POST', '/progress/sync', {
      token: session.token,
      body: { records: [], since: 0, tier: 'premium', premium: true },
    });
    assert.equal((await call('GET', '/me', { token: session.token })).body.premium, false);
  });

  test('signing out ends the session', async () => {
    const session = (await call('POST', '/sessions',
      { body: { email: 'a@example.com', password: 'a long enough password' } })).body;
    assert.equal((await call('DELETE', '/sessions', { token: session.token })).status, 200);
    assert.equal((await call('GET', '/me', { token: session.token })).status, 401);
  });
});

describe('sync', () => {
  let token = '';

  before(async () => {
    const reply = await call('POST', '/accounts',
      { body: { email: 'sync@example.com', password: 'a long enough password' } });
    token = reply.body.token;
  });

  let firstSyncedAt = 0;

  test('a first sync accepts everything and has nothing to send back', async () => {
    const records = [studied('w1', clock), studied('w2', clock)];
    const reply = await call('POST', '/progress/sync', { token, body: { records, since: 0 } });
    assert.equal(reply.status, 200);
    assert.equal(reply.body.accepted, 2);
    assert.deepEqual(reply.body.changed, []);
    assert.equal(reply.body.syncedAt, clock);
    firstSyncedAt = reply.body.syncedAt;
  });

  test('syncing the same records again writes nothing — it is idempotent', async () => {
    const records = [studied('w1', clock), studied('w2', clock)];
    const reply = await call('POST', '/progress/sync',
      { token, body: { records, since: firstSyncedAt } });
    assert.equal(reply.body.accepted, 0);
    assert.deepEqual(reply.body.changed, []);
  });

  test('rubbish in the payload is counted and refused, not written', async () => {
    const reply = await call('POST', '/progress/sync', {
      token,
      body: { records: [{ itemId: 'x' }, null, 'nonsense', { ...studied('w3', clock) }], since: 0 },
    });
    assert.equal(reply.body.rejected, 3);
    assert.equal(reply.body.accepted, 1);
  });

  test('a record claiming another account is stored against the sender', async () => {
    const other = (await call('POST', '/accounts',
      { body: { email: 'victim@example.com', password: 'a long enough password' } })).body;
    const forged = { ...studied('stolen', clock), userId: other.account.id };
    await call('POST', '/progress/sync', { token, body: { records: [forged], since: 0 } });

    const theirs = await call('POST', '/progress/sync',
      { token: other.token, body: { records: [], since: 0 } });
    assert.deepEqual(theirs.body.changed, [], 'a client wrote into another account');
  });

  test('THE scenario: study on the train, sign in on the tablet, find it there', async () => {
    const phone = (await call('POST', '/accounts',
      { body: { email: 'traveller@example.com', password: 'a long enough password' } })).body;

    // On the train, offline, then a sync when signal comes back.
    const offline = [studied('haus', clock), studied('tisch', clock), studied('stuhl', clock)];
    const pushed = await call('POST', '/progress/sync',
      { token: phone.token, body: { records: offline, since: 0 } });
    assert.equal(pushed.body.accepted, 3);

    // At home: a different device, same account, holding nothing.
    clock += 3_600_000;
    const tablet = (await call('POST', '/sessions',
      { body: { email: 'traveller@example.com', password: 'a long enough password' } })).body;
    const pulled = await call('POST', '/progress/sync',
      { token: tablet.token, body: { records: [], since: 0 } });

    assert.equal(pulled.body.changed.length, 3, 'the tablet did not get the work');
    assert.deepEqual(pulled.body.changed.map((r: ItemProgress) => r.itemId).sort(),
      ['haus', 'stuhl', 'tisch']);
    const haus = pulled.body.changed.find((r: ItemProgress) => r.itemId === 'haus');
    assert.equal(haus.state, 'review');
    assert.ok(haus.stability > 0, 'the scheduling state did not survive the round trip');
  });

  test('the later review wins, and the other device is told', async () => {
    const account = (await call('POST', '/accounts',
      { body: { email: 'conflict@example.com', password: 'a long enough password' } })).body;

    // Two devices, both offline, both reviewing the same word.
    const early = studied('konflikt', clock);
    const late = studied('konflikt', clock + 86_400_000, GRADE.AGAIN);

    await call('POST', '/progress/sync', { token: account.token, body: { records: [late], since: 0 } });
    const second = await call('POST', '/progress/sync',
      { token: account.token, body: { records: [early], since: 0 } });

    assert.equal(second.body.accepted, 0, 'the older review overwrote the newer one');
    assert.equal(second.body.changed.length, 1);
    assert.equal(second.body.changed[0].lastReviewed, late.lastReviewed);
    assert.equal(second.body.changed[0].state, 'learning', 'the newer review was a lapse');
  });

  test('only what changed since the last sync comes back', async () => {
    const account = (await call('POST', '/accounts',
      { body: { email: 'delta@example.com', password: 'a long enough password' } })).body;
    const first = await call('POST', '/progress/sync',
      { token: account.token, body: { records: [studied('a', clock)], since: 0 } });

    clock += 60_000;
    // Another device pushes a second word.
    await call('POST', '/progress/sync',
      { token: account.token, body: { records: [studied('b', clock)], since: first.body.syncedAt } });

    clock += 60_000;
    const delta = await call('POST', '/progress/sync',
      { token: account.token, body: { records: [studied('a', clock - 120_000)], since: first.body.syncedAt } });
    assert.deepEqual(delta.body.changed.map((r: ItemProgress) => r.itemId), ['b'],
      'a delta sync sent back the whole history');
  });

  test('deleting progress leaves the account standing', async () => {
    const account = (await call('POST', '/accounts',
      { body: { email: 'wipe@example.com', password: 'a long enough password' } })).body;
    await call('POST', '/progress/sync',
      { token: account.token, body: { records: [studied('gone', clock)], since: 0 } });
    assert.equal((await call('DELETE', '/progress', { token: account.token })).status, 200);

    const after = await call('POST', '/progress/sync',
      { token: account.token, body: { records: [], since: 0 } });
    assert.deepEqual(after.body.changed, []);
    assert.equal((await call('GET', '/me', { token: account.token })).status, 200);
  });

  test('deleting the account takes the progress with it', async () => {
    const account = (await call('POST', '/accounts',
      { body: { email: 'erased@example.com', password: 'a long enough password' } })).body;
    await call('POST', '/progress/sync',
      { token: account.token, body: { records: [studied('bye', clock)], since: 0 } });
    assert.equal((await call('DELETE', '/me', { token: account.token })).status, 200);
    assert.equal((await call('GET', '/me', { token: account.token })).status, 401);
  });
});
