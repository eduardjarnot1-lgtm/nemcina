/**
 * Session tokens.
 *
 * Opaque random strings, not JWTs. A JWT here would buy stateless verification
 * and cost the ability to revoke a session — and "sign me out everywhere" after
 * a stolen phone is not a feature to trade away for one database read.
 *
 * The token is shown to the client once. What is stored is its HMAC, so a
 * database someone walks off with contains no usable tokens.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const newToken = (): string => randomBytes(32).toString('base64url');

/** HMAC rather than a bare hash: the pepper is not in the database. */
export function tokenHash(token: string, pepper: string): string {
  return createHmac('sha256', pepper).update(token).digest('base64url');
}

/** Compare two hashes without leaking where they differ. */
export function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
