/**
 * Talking to the sync server.
 *
 * One place that knows the shape of the API, so a screen never builds a URL or
 * an Authorization header. Every call returns either a value or an `ApiError`
 * carrying a message a person can read — the server writes those deliberately,
 * and passing them through beats inventing a worse one here.
 *
 * The base URL comes from the environment and has **no default**. Nothing is
 * deployed yet, and a hard-coded fallback would be a placeholder that quietly
 * shipped. When it is unset, the app says sync is unavailable instead of
 * failing at a URL nobody set.
 */

import type { CoachEvidence, ItemProgress, SyncResponse, Timestamp } from '@nemcina/core';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export const syncConfigured = (): boolean => API_URL.trim().length > 0;

export interface Account {
  readonly id: string;
  readonly email: string;
  readonly tier: 'free' | 'premium';
  readonly premiumUntil: number;
}

export type CoachIntent = 'progress' | 'what-next' | 'encourage';

export interface Quota {
  readonly limit: number;
  readonly used: number;
  readonly remaining: number;
}

export interface CoachReply {
  /** Null when no model is configured. The app then shows its own advice. */
  readonly text: string | null;
  readonly reason: string | null;
  readonly quota: Quota;
}

export interface Session {
  readonly token: string;
  readonly expiresAt: Timestamp;
  readonly account: Account;
}

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  if (!syncConfigured()) {
    throw new ApiError('No sync server is configured for this build.', 0);
  }
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_URL.replace(/\/$/, '')}${path}`, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } catch {
    // A phone is offline far more often than a server is broken, and the
    // message should say the thing that is usually true.
    throw new ApiError('Could not reach the server. Check your connection.', 0);
  }

  const text = await response.text();
  let payload: unknown = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }

  if (!response.ok) {
    const message = typeof (payload as { error?: unknown })?.error === 'string'
      ? String((payload as { error: string }).error)
      : 'Something went wrong.';
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export const api = {
  register: (email: string, password: string) =>
    call<Session>('/accounts', { method: 'POST', body: { email, password } }),

  signIn: (email: string, password: string) =>
    call<Session>('/sessions', { method: 'POST', body: { email, password } }),

  signOut: (token: string) =>
    call<{ ok: true }>('/sessions', { method: 'DELETE', token }),

  me: (token: string) =>
    call<{ account: Account; premium: boolean }>('/me', { token }),

  deleteAccount: (token: string) =>
    call<{ ok: true }>('/me', { method: 'DELETE', token }),

  sync: (token: string, records: readonly ItemProgress[], since: Timestamp) =>
    call<SyncResponse>('/progress/sync', { method: 'POST', token, body: { records, since } }),

  coachStatus: (token: string) =>
    call<{ quota: Quota; available: boolean }>('/coach', { token }),

  /**
   * Ask the coach.
   *
   * The evidence goes up; no prompt does. The server owns the wording, the
   * quota and whether there is a model at all — this is a request, not an
   * instruction.
   */
  askCoach: (token: string, intent: CoachIntent, evidence: CoachEvidence) =>
    call<CoachReply>('/coach', { method: 'POST', token, body: { intent, evidence } }),
};
