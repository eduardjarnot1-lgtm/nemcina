/**
 * Accounts and sessions.
 *
 * Everything the client is not allowed to decide for itself lives here (§31):
 * who someone is, how long they stay signed in, and whether they have paid.
 * A phone can claim anything; none of it is believed.
 */

import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { hashPassword, needsRehash, verifyPassword } from './passwords.ts';
import { newToken, tokenHash } from './tokens.ts';
import type { ServerConfig } from './config.ts';

export interface Account {
  readonly id: string;
  readonly email: string;
  readonly tier: 'free' | 'premium';
  readonly premiumUntil: number;
}

export interface Session {
  readonly token: string;
  readonly expiresAt: number;
  readonly account: Account;
}

export class AuthError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Deliberately shallow.
 *
 * Rejecting addresses that look odd is how real people with real addresses get
 * turned away; the only address that matters is one that can receive mail, and
 * this cannot know that. It refuses what is obviously not an address and lets
 * delivery be the real test.
 */
export function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 254) return false;
  if (/\s/.test(trimmed)) return false;
  const at = trimmed.indexOf('@');
  return at > 0 && at < trimmed.length - 1 && trimmed.indexOf('@', at + 1) === -1;
}

/**
 * The password rule: length, and nothing else.
 *
 * Character-class requirements push people towards "Password1!" and towards
 * reuse. Length is the property that actually costs an attacker anything.
 */
export const MIN_PASSWORD_LENGTH = 10;

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A password needs at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > 1024) return 'That password is too long.';
  return null;
}

const normalise = (email: string): string => email.trim().toLowerCase();

const toAccount = (row: Record<string, unknown>): Account => ({
  id: String(row.id),
  email: String(row.email),
  tier: row.tier === 'premium' ? 'premium' : 'free',
  premiumUntil: Number(row.premium_until ?? 0),
});

export class Accounts {
  readonly #db: DatabaseSync;
  readonly #config: ServerConfig;
  readonly #now: () => number;

  constructor(db: DatabaseSync, config: ServerConfig, now: () => number = Date.now) {
    this.#db = db;
    this.#config = config;
    this.#now = now;
  }

  async register(email: string, password: string): Promise<Session> {
    const address = normalise(email);
    if (!looksLikeEmail(address)) throw new AuthError('That does not look like an email address.', 400);
    const problem = passwordProblem(password);
    if (problem) throw new AuthError(problem, 400);

    const existing = this.#db.prepare('SELECT id FROM accounts WHERE email = ?').get(address);
    if (existing) {
      // Same wording as a failed sign-in would give, so this endpoint cannot be
      // used to find out who has an account here.
      throw new AuthError('That email address cannot be registered.', 409);
    }

    const id = randomUUID();
    this.#db.prepare(
      'INSERT INTO accounts (id, email, password_hash, created_at, tier, premium_until) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id, address, await hashPassword(password), this.#now(), 'free', 0);

    return this.#startSession(id);
  }

  async signIn(email: string, password: string): Promise<Session> {
    const address = normalise(email);
    this.#recordAttempt(address);
    if (this.#tooManyAttempts(address)) {
      throw new AuthError('Too many sign-in attempts. Try again later.', 429);
    }

    const row = this.#db.prepare(
      'SELECT id, email, password_hash, tier, premium_until FROM accounts WHERE email = ?',
    ).get(address) as Record<string, unknown> | undefined;

    // An unknown address must cost the same as a wrong password, or the timing
    // difference says which addresses are registered.
    const stored = row ? String(row.password_hash) : await this.#decoyHash();
    const ok = await verifyPassword(password, stored);
    if (!row || !ok) throw new AuthError('Wrong email address or password.', 401);

    if (needsRehash(stored)) {
      this.#db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?')
        .run(await hashPassword(password), String(row.id));
    }
    this.#clearAttempts(address);
    return this.#startSession(String(row.id));
  }

  /** A hash of a value nobody knows, so verifying against it always fails. */
  #decoy: string | null = null;
  async #decoyHash(): Promise<string> {
    this.#decoy ??= await hashPassword(randomUUID());
    return this.#decoy;
  }

  #startSession(userId: string): Session {
    const token = newToken();
    const created = this.#now();
    const expires = created + this.#config.sessionDays * 86_400_000;
    this.#db.prepare(
      'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    ).run(tokenHash(token, this.#config.tokenPepper), userId, created, expires);

    const row = this.#db.prepare(
      'SELECT id, email, tier, premium_until FROM accounts WHERE id = ?',
    ).get(userId) as Record<string, unknown>;
    return { token, expiresAt: expires, account: toAccount(row) };
  }

  /** The account behind a token, or null. Expired sessions are removed on sight. */
  authenticate(token: string): Account | null {
    if (!token) return null;
    const hash = tokenHash(token, this.#config.tokenPepper);
    const row = this.#db.prepare(
      `SELECT a.id, a.email, a.tier, a.premium_until, s.expires_at
         FROM sessions s JOIN accounts a ON a.id = s.user_id
        WHERE s.token_hash = ?`,
    ).get(hash) as Record<string, unknown> | undefined;
    if (!row) return null;
    if (Number(row.expires_at) <= this.#now()) {
      this.#db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
      return null;
    }
    return toAccount(row);
  }

  signOut(token: string): void {
    this.#db.prepare('DELETE FROM sessions WHERE token_hash = ?')
      .run(tokenHash(token, this.#config.tokenPepper));
  }

  /** Sign out everywhere — the thing a stolen phone needs and a JWT cannot do. */
  signOutEverywhere(userId: string): void {
    this.#db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  }

  /** GDPR erasure. Cascades to sessions and progress. */
  deleteAccount(userId: string): void {
    this.#db.prepare('DELETE FROM accounts WHERE id = ?').run(userId);
  }

  /**
   * Entitlements are set here and nowhere else.
   *
   * A store receipt is verified server-side and then written through this; the
   * client is never asked what it is entitled to, and never told to remember.
   */
  setTier(userId: string, tier: 'free' | 'premium', premiumUntil: number): void {
    this.#db.prepare('UPDATE accounts SET tier = ?, premium_until = ? WHERE id = ?')
      .run(tier, premiumUntil, userId);
  }

  /** Premium only while it is paid for; an expired subscription is not premium. */
  isPremium(account: Account, at: number = this.#now()): boolean {
    return account.tier === 'premium' && account.premiumUntil > at;
  }

  #recordAttempt(email: string): void {
    this.#db.prepare('INSERT INTO sign_in_attempts (email, at) VALUES (?, ?)').run(email, this.#now());
  }

  #tooManyAttempts(email: string): boolean {
    const since = this.#now() - this.#config.signInWindowMs;
    const row = this.#db.prepare(
      'SELECT COUNT(*) AS n FROM sign_in_attempts WHERE email = ? AND at >= ?',
    ).get(email, since) as { n: number };
    return Number(row.n) > this.#config.signInAttempts;
  }

  #clearAttempts(email: string): void {
    this.#db.prepare('DELETE FROM sign_in_attempts WHERE email = ?').run(email);
  }
}

/** Compare two tokens from a request without leaking length or content. */
export function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
