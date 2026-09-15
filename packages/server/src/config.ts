/**
 * Configuration, and what happens when it is missing.
 *
 * Every secret comes from the environment. None has a default that would work:
 * a fallback signing key is a fallback that ships, and a build that starts
 * without one is a build that is quietly insecure in production.
 *
 * So the rule here is: in production, a missing secret is a refusal to start.
 * In development, a clearly-labelled ephemeral value is generated in memory, so
 * a contributor can run the thing without being handed credentials — and every
 * session is invalidated the moment the process restarts, which is exactly what
 * a development secret should do.
 */

import { randomBytes } from 'node:crypto';

export interface ServerConfig {
  readonly port: number;
  readonly databasePath: string;
  /** Used to derive nothing that outlives a restart in development. */
  readonly tokenPepper: string;
  readonly production: boolean;
  /** How long a session lasts before it must be renewed. */
  readonly sessionDays: number;
  /** Sign-in attempts allowed per account per window. */
  readonly signInAttempts: number;
  readonly signInWindowMs: number;
  /**
   * Browser origins allowed to call this API.
   *
   * Empty by default, and empty means no CORS headers at all — a phone does not
   * need them, and a wildcard on an API that holds sessions is a way to be
   * called by any page the learner happens to have open. A web client is
   * allowed by naming it, one origin at a time.
   */
  readonly corsOrigins: readonly string[];
}

export class ConfigError extends Error {}

const required = (env: NodeJS.ProcessEnv, name: string, production: boolean): string => {
  const value = env[name];
  if (value && value.trim()) return value;
  if (production) {
    throw new ConfigError(
      `${name} is not set. It has no default; set it in the environment before starting.`,
    );
  }
  // Development only, and it does not persist: restarting invalidates every
  // session, which is the correct behaviour for a value nobody chose.
  return `dev-ephemeral-${randomBytes(24).toString('base64url')}`;
};

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const production = env.NODE_ENV === 'production';
  return {
    port: Number(env.PORT ?? 8080),
    databasePath: env.DATABASE_PATH ?? (production ? '/var/lib/nemcina/nemcina.db' : ':memory:'),
    tokenPepper: required(env, 'TOKEN_PEPPER', production),
    production,
    sessionDays: Number(env.SESSION_DAYS ?? 30),
    signInAttempts: Number(env.SIGN_IN_ATTEMPTS ?? 10),
    signInWindowMs: Number(env.SIGN_IN_WINDOW_MS ?? 15 * 60_000),
    corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean),
  };
}
