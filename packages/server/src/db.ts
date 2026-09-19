/**
 * The database.
 *
 * `node:sqlite`, so the server has no runtime dependencies at all and runs
 * anywhere Node does. It is an experimental Node API and that is a real risk,
 * stated rather than hidden: **Postgres is the production answer**, and the
 * reason every query lives behind this module is so that swapping it is one
 * file rather than a rewrite.
 *
 * The schema is small because the interesting state is not here. Scheduling
 * lives in the client's engine; this stores what the client computed, keyed so
 * that two devices can be merged.
 */

import { DatabaseSync } from 'node:sqlite';

export interface AccountRow {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly createdAt: number;
  /** Entitlements the client is never allowed to assert for itself (§31). */
  readonly tier: 'free' | 'premium';
  readonly premiumUntil: number;
}

export interface ProgressRow {
  readonly userId: string;
  readonly itemId: string;
  readonly state: string;
  readonly seen: number;
  readonly correctCount: number;
  readonly incorrectCount: number;
  readonly repetitionCount: number;
  readonly lastReviewed: number;
  readonly dueAt: number;
  readonly difficulty: number;
  readonly stability: number;
  /** Server clock, for "everything changed since X". Never the client's. */
  readonly updatedAt: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  tier          TEXT NOT NULL DEFAULT 'free',
  premium_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS progress (
  user_id          TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_id          TEXT NOT NULL,
  state            TEXT NOT NULL,
  seen             INTEGER NOT NULL,
  correct_count    INTEGER NOT NULL,
  incorrect_count  INTEGER NOT NULL,
  repetition_count INTEGER NOT NULL,
  last_reviewed    INTEGER NOT NULL,
  due_at           INTEGER NOT NULL,
  difficulty       REAL NOT NULL,
  stability        REAL NOT NULL,
  updated_at       INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id)
);
CREATE INDEX IF NOT EXISTS progress_changed ON progress(user_id, updated_at);

CREATE TABLE IF NOT EXISTS coach_usage (
  user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  day     INTEGER NOT NULL,
  count   INTEGER NOT NULL,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS sign_in_attempts (
  email      TEXT NOT NULL,
  at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sign_in_attempts_email ON sign_in_attempts(email, at);
`;

export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  // Referential integrity is off by default in SQLite, which makes the
  // ON DELETE CASCADE above decorative unless it is turned on.
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}
