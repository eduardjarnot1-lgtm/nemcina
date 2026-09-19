/**
 * Password hashing.
 *
 * scrypt from `node:crypto`, so there is nothing to install and nothing to keep
 * patched. Parameters follow the OWASP guidance for scrypt: N=2^15, r=8, p=1,
 * which costs roughly 100 ms and 32 MB per hash — slow enough to matter to
 * someone with a stolen database, fast enough that a person signing in does not
 * notice.
 *
 * The stored string carries its own parameters, so raising the cost later does
 * not invalidate existing passwords: an old hash still verifies with the
 * parameters it was made with, and `needsRehash` says when to upgrade it.
 */

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt) as (
  password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
// scrypt needs roughly 128 * N * r bytes; the default cap is below that at this N.
const MAX_MEMORY = 256 * N * R;

/** `scrypt$N$r$p$salt$hash`, all base64url. Self-describing on purpose. */
export async function hashPassword(password: string): Promise<string> {
  if (!password) throw new Error('refusing to hash an empty password');
  const salt = randomBytes(16);
  const hash = await derive(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAX_MEMORY });
  return ['scrypt', N, R, P, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  const salt = Buffer.from(parts[4] as string, 'base64url');
  const expected = Buffer.from(parts[5] as string, 'base64url');
  let actual: Buffer;
  try {
    actual = await derive(password, salt, expected.length, { N: n, r, p, maxmem: 256 * n * r });
  } catch {
    return false;
  }
  // Constant time: a length check that short-circuits is itself an oracle.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** True when a stored hash was made with weaker parameters than we use now. */
export function needsRehash(stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return true;
  return Number(parts[1]) < N || Number(parts[2]) < R;
}
