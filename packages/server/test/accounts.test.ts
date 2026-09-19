/**
 * Accounts.
 *
 * Most of these are about what the server must NOT do: confirm that an address
 * is registered, answer faster for an unknown one, believe a client about what
 * it has paid for, or keep a session alive past its expiry.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Accounts, AuthError, looksLikeEmail, passwordProblem } from '../src/accounts.ts';
import { hashPassword, needsRehash, verifyPassword } from '../src/passwords.ts';
import { openDatabase } from '../src/db.ts';
import { readConfig } from '../src/config.ts';
import type { DatabaseSync } from 'node:sqlite';

const config = readConfig({ NODE_ENV: 'test', TOKEN_PEPPER: 'test-pepper', DATABASE_PATH: ':memory:' });
let db: DatabaseSync;
let clock = 1_700_000_000_000;
let accounts: Accounts;

before(() => {
  db = openDatabase(':memory:');
  accounts = new Accounts(db, config, () => clock);
});
after(() => db.close());

describe('passwords', () => {
  test('a hash verifies and carries its own parameters', async () => {
    const stored = await hashPassword('correct horse battery');
    assert.match(stored, /^scrypt\$\d+\$\d+\$\d+\$/);
    assert.equal(await verifyPassword('correct horse battery', stored), true);
    assert.equal(await verifyPassword('correct horse batteru', stored), false);
  });

  test('the same password hashes differently every time — salts are per-user', async () => {
    assert.notEqual(await hashPassword('same password'), await hashPassword('same password'));
  });

  test('a malformed stored hash fails closed rather than throwing', async () => {
    for (const bad of ['', 'nonsense', 'scrypt$1', 'bcrypt$1$2$3$4$5']) {
      assert.equal(await verifyPassword('anything', bad), false, bad);
    }
  });

  test('an empty password is refused outright, not hashed', async () => {
    await assert.rejects(() => hashPassword(''), /empty password/);
  });

  test('a hash made with weaker parameters is flagged for upgrade', () => {
    assert.equal(needsRehash('scrypt$16384$8$1$c2FsdA$aGFzaA'), true);
    assert.equal(needsRehash('scrypt$32768$8$1$c2FsdA$aGFzaA'), false);
    assert.equal(needsRehash('not a hash'), true);
  });

  test('length is the rule; character classes are not', () => {
    assert.equal(passwordProblem('a'.repeat(10)), null);
    assert.match(passwordProblem('short') ?? '', /at least 10/);
    assert.match(passwordProblem('x'.repeat(2000)) ?? '', /too long/);
  });
});

describe('email addresses', () => {
  test('obvious non-addresses are refused', () => {
    for (const bad of ['', 'nope', '@example.com', 'a@', 'a b@example.com', 'a@b@c']) {
      assert.equal(looksLikeEmail(bad), false, bad);
    }
  });

  test('unusual but real addresses are accepted — this is not the delivery test', () => {
    for (const good of ['a@b', "o'brien@example.co.uk", 'user+tag@example.museum', 'ünïcode@example.de']) {
      assert.equal(looksLikeEmail(good), true, good);
    }
  });
});

describe('registering', () => {
  test('creates an account and signs it in', async () => {
    const session = await accounts.register('Learner@Example.com', 'a long enough password');
    assert.ok(session.token.length >= 32);
    assert.equal(session.account.email, 'learner@example.com', 'the address is normalised');
    assert.equal(session.account.tier, 'free', 'nobody registers as premium');
    assert.ok(session.expiresAt > clock);
  });

  test('THE leak this avoids: registering a known address says nothing about it', async () => {
    await assert.rejects(
      () => accounts.register('learner@example.com', 'another long password'),
      (error: AuthError) => {
        assert.equal(error.status, 409);
        assert.doesNotMatch(error.message, /already|exists|taken|registered account/i,
          `"${error.message}" tells an attacker the address is in use`);
        return true;
      },
    );
  });

  test('a weak password or a non-address is refused before anything is written', async () => {
    await assert.rejects(() => accounts.register('new@example.com', 'short'), /at least 10/);
    await assert.rejects(() => accounts.register('not-an-address', 'a long enough password'), /email address/);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM accounts').get()?.n, 1);
  });

  test('the password is never stored as itself', () => {
    const row = db.prepare('SELECT password_hash FROM accounts WHERE email = ?')
      .get('learner@example.com') as { password_hash: string };
    assert.doesNotMatch(row.password_hash, /a long enough password/);
    assert.match(row.password_hash, /^scrypt\$/);
  });
});

describe('signing in', () => {
  test('the right password works', async () => {
    const session = await accounts.signIn('learner@example.com', 'a long enough password');
    assert.ok(accounts.authenticate(session.token));
  });

  test('a wrong password and an unknown address give the same answer', async () => {
    const wrong = await accounts.signIn('learner@example.com', 'wrong password here')
      .catch((error: AuthError) => error);
    const unknown = await accounts.signIn('nobody@example.com', 'wrong password here')
      .catch((error: AuthError) => error);
    assert.equal((wrong as AuthError).message, (unknown as AuthError).message);
    assert.equal((wrong as AuthError).status, (unknown as AuthError).status);
  });

  test('repeated failures are rate limited', async () => {
    const email = 'target@example.com';
    await accounts.register(email, 'a long enough password');
    let limited = false;
    for (let i = 0; i < 20; i += 1) {
      const error = await accounts.signIn(email, `guess ${i}`).catch((e: AuthError) => e);
      if ((error as AuthError).status === 429) { limited = true; break; }
    }
    assert.ok(limited, 'an attacker could guess indefinitely');
  });

  test('a successful sign-in clears the count, so a real user is not locked out', async () => {
    const email = 'recovers@example.com';
    await accounts.register(email, 'a long enough password');
    for (let i = 0; i < 5; i += 1) await accounts.signIn(email, 'wrong').catch(() => {});
    const session = await accounts.signIn(email, 'a long enough password');
    assert.ok(session.token);
  });
});

describe('sessions', () => {
  test('a token that was never issued authenticates nobody', () => {
    assert.equal(accounts.authenticate('made up'), null);
    assert.equal(accounts.authenticate(''), null);
  });

  test('the raw token is not in the database — only its HMAC', async () => {
    const session = await accounts.register('hashed@example.com', 'a long enough password');
    const rows = db.prepare('SELECT token_hash FROM sessions').all() as { token_hash: string }[];
    assert.equal(rows.some((row) => row.token_hash === session.token), false);
    assert.ok(accounts.authenticate(session.token));
  });

  test('an expired session stops working and is cleaned up', async () => {
    const session = await accounts.register('expires@example.com', 'a long enough password');
    const before = clock;
    clock += (config.sessionDays + 1) * 86_400_000;
    assert.equal(accounts.authenticate(session.token), null);
    assert.equal(
      db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE token_hash IS NOT NULL AND user_id = ?')
        .get(session.account.id)?.n, 0);
    clock = before;
  });

  test('signing out ends that session and no other', async () => {
    const phone = await accounts.register('two@example.com', 'a long enough password');
    const tablet = await accounts.signIn('two@example.com', 'a long enough password');
    accounts.signOut(phone.token);
    assert.equal(accounts.authenticate(phone.token), null);
    assert.ok(accounts.authenticate(tablet.token), 'the other device was signed out too');
  });

  test('signing out everywhere is possible — the reason this is not a JWT', async () => {
    const phone = await accounts.register('stolen@example.com', 'a long enough password');
    const tablet = await accounts.signIn('stolen@example.com', 'a long enough password');
    accounts.signOutEverywhere(phone.account.id);
    assert.equal(accounts.authenticate(phone.token), null);
    assert.equal(accounts.authenticate(tablet.token), null);
  });
});

describe('entitlements', () => {
  test('a new account is free, and the client cannot say otherwise', async () => {
    const session = await accounts.register('paying@example.com', 'a long enough password');
    assert.equal(accounts.isPremium(session.account), false);
    // Whatever a client sends, the account row is what counts.
    const claimed = { ...session.account, tier: 'premium' as const, premiumUntil: clock + 1 };
    const real = accounts.authenticate(session.token);
    assert.equal(real?.tier, 'free', 'the server believed a client-supplied tier');
    assert.equal(accounts.isPremium(claimed), true, 'precondition: the claim would otherwise pass');
  });

  test('premium is only premium while it is paid for', async () => {
    const session = await accounts.register('sub@example.com', 'a long enough password');
    accounts.setTier(session.account.id, 'premium', clock + 86_400_000);
    const active = accounts.authenticate(session.token);
    assert.ok(active);
    assert.equal(accounts.isPremium(active), true);
    assert.equal(accounts.isPremium(active, clock + 2 * 86_400_000), false,
      'an expired subscription is still premium');
  });
});

describe('deleting an account', () => {
  test('takes its sessions and its progress with it', async () => {
    const session = await accounts.register('erase@example.com', 'a long enough password');
    db.prepare(`INSERT INTO progress (user_id, item_id, state, seen, correct_count, incorrect_count,
      repetition_count, last_reviewed, due_at, difficulty, stability, updated_at)
      VALUES (?, 'w1', 'review', 1, 1, 0, 1, 1, 2, 5, 3, 1)`).run(session.account.id);

    accounts.deleteAccount(session.account.id);
    assert.equal(accounts.authenticate(session.token), null);
    assert.equal(
      db.prepare('SELECT COUNT(*) AS n FROM progress WHERE user_id = ?').get(session.account.id)?.n, 0,
      'GDPR erasure left the progress behind');
  });
});
