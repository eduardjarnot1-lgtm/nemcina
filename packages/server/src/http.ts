/**
 * The HTTP surface.
 *
 * `node:http` and a switch, not a framework. There are eight routes; a router
 * dependency would be more code to audit than the code it replaces, and this
 * server's whole point is that it holds credentials and can be read end to end.
 *
 * Every handler follows the same shape: parse, authenticate, do one thing,
 * answer in JSON. Nothing here computes a schedule or decides what to study —
 * that is the client's engine, and duplicating it server-side would give two
 * implementations to keep in step.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { Accounts, AuthError, type Account } from './accounts.ts';
import { ProgressStorage } from './progress.ts';
import { openDatabase } from './db.ts';
import type { ServerConfig } from './config.ts';

/** A request body bigger than this is refused before it is read into memory. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

export interface Api {
  readonly server: Server;
  readonly accounts: Accounts;
  readonly progress: ProgressStorage;
  readonly db: DatabaseSync;
  listen(port: number): Promise<number>;
  close(): Promise<void>;
}

/**
 * CORS, only for origins that were named.
 *
 * No wildcard, and nothing at all when the allowlist is empty: an API holding
 * sessions should not be callable from any page the learner happens to have
 * open. `Vary: Origin` because the answer depends on who asked.
 */
function applyCors(
  request: IncomingMessage, response: ServerResponse, allowed: readonly string[],
): void {
  const origin = request.headers.origin;
  if (!origin || allowed.length === 0) return;
  response.setHeader('Vary', 'Origin');
  if (!allowed.includes(origin)) return;
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  response.setHeader('Access-Control-Max-Age', '600');
}

function send(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    // This API is read by apps, never embedded in a page.
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
  response.end(payload);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new AuthError('That request is too large.', 413);
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AuthError('That request body is not valid JSON.', 400);
  }
}

const bearer = (request: IncomingMessage): string => {
  const header = request.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
};

const field = (body: unknown, name: string): string => {
  const value = (body as Record<string, unknown>)?.[name];
  return typeof value === 'string' ? value : '';
};

export function createApi(config: ServerConfig, now: () => number = Date.now): Api {
  const db = openDatabase(config.databasePath);
  const accounts = new Accounts(db, config, now);
  const progress = new ProgressStorage(db, now);

  const requireAccount = (request: IncomingMessage): Account => {
    const account = accounts.authenticate(bearer(request));
    if (!account) throw new AuthError('Sign in first.', 401);
    return account;
  };

  const server = createServer((request, response) => {
    applyCors(request, response, config.corsOrigins);
    if (request.method === 'OPTIONS') {
      response.writeHead(204).end();
      return;
    }
    void handle(request, response).catch((error: unknown) => {
      if (error instanceof AuthError) {
        send(response, error.status, { error: error.message });
        return;
      }
      // Never return the message: an internal error's text is for the operator,
      // and has a habit of containing a query, a path or a value.
      console.error('unhandled request error', error);
      send(response, 500, { error: 'Something went wrong.' });
    });
  });

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const route = `${request.method} ${url.pathname}`;

    switch (route) {
      case 'GET /health':
        return send(response, 200, { ok: true });

      case 'POST /accounts': {
        const body = await readJson(request);
        const session = await accounts.register(field(body, 'email'), field(body, 'password'));
        return send(response, 201, session);
      }

      case 'POST /sessions': {
        const body = await readJson(request);
        const session = await accounts.signIn(field(body, 'email'), field(body, 'password'));
        return send(response, 200, session);
      }

      case 'DELETE /sessions': {
        requireAccount(request);
        accounts.signOut(bearer(request));
        return send(response, 200, { ok: true });
      }

      case 'DELETE /sessions/all': {
        const account = requireAccount(request);
        accounts.signOutEverywhere(account.id);
        return send(response, 200, { ok: true });
      }

      case 'GET /me': {
        const account = requireAccount(request);
        // The entitlement is computed here and sent as a fact. The client shows
        // it; it never decides it (§31).
        return send(response, 200, {
          account,
          premium: accounts.isPremium(account),
        });
      }

      case 'DELETE /me': {
        const account = requireAccount(request);
        accounts.deleteAccount(account.id);
        return send(response, 200, { ok: true });
      }

      case 'POST /progress/sync': {
        const account = requireAccount(request);
        const body = await readJson(request) as Record<string, unknown>;
        const incoming = Array.isArray(body.records) ? body.records : [];
        const since = Number(body.since ?? 0);
        const result = progress.sync(
          account.id,
          incoming,
          Number.isFinite(since) && since > 0 ? since : 0,
        );
        return send(response, 200, result);
      }

      case 'DELETE /progress': {
        const account = requireAccount(request);
        progress.clear(account.id);
        return send(response, 200, { ok: true });
      }

      default:
        return send(response, 404, { error: 'No such endpoint.' });
    }
  }

  return {
    server,
    accounts,
    progress,
    db,
    listen(port: number): Promise<number> {
      return new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => {
          const address = server.address();
          resolve(typeof address === 'object' && address ? address.port : port);
        });
      });
    },
    close(): Promise<void> {
      return new Promise((resolve) => {
        server.close(() => { db.close(); resolve(); });
      });
    },
  };
}
