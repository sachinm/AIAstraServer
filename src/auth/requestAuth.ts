/**
 * Request authentication for GraphQL and every REST route (docs/admin/01 §4.1.2).
 *
 * The JWT proves who is calling; the `auth` row decides what they may do. Each request reads the row's `role`, `locked_at`
 * and `token_version` through a per-instance cache (30 s, at most 5,000 users), so a lock or role change made by the admin
 * app is honoured within 30 s on every instance and at once on an instance that calls `forgetUser`.
 *
 *  - no token, a bad token, an expired token  -> { userId: null }
 *  - row missing                              -> { userId: null, reason: 'deleted' }
 *  - `locked_at` set                          -> { userId, role, locked: true }
 *  - row `token_version` > token `tv`         -> { userId: null, reason: 'revoked' }   (a token without `tv` is tv = 1)
 *  - otherwise                                -> { userId, role: canonicalRole(row.role), locked: false }
 *
 * A database error falls back to the token's role and not locked: a bug of ours must not lock everyone out.
 */
import jwt from 'jsonwebtoken';
import type express from 'express';
import { prisma } from '../lib/prisma.js';
import { canonicalRole, type RoleId } from './roles.js';
import { getJwtSecret } from './jwtSecret.js';

export const ACCOUNT_LOCKED_CODE = 'ACCOUNT_LOCKED';
export const ACCOUNT_LOCKED_MESSAGE = 'This account is locked.';

const CACHE_TTL_MS = 30_000;
const CACHE_MAX = 5_000;
const LAST_SEEN_EVERY_MS = 5 * 60_000;

export interface AuthRow {
  role: string | null;
  locked_at: Date | null;
  token_version: number;
  last_seen_at: Date | null;
}

export interface RequestAuth {
  userId: string | null;
  role: RoleId | null;
  locked: boolean;
  /** why a valid token was refused */
  reason?: 'deleted' | 'revoked';
}

export interface RequestAuthDeps {
  /** primary-key read of the auth row; null when there is none */
  readRow?: (userId: string) => Promise<AuthRow | null>;
  /** fire-and-forget `last_seen_at` write */
  touchLastSeen?: (userId: string, at: Date) => Promise<unknown>;
  now?: () => number;
  secret?: string;
}

type HeaderSource = Headers | Record<string, string | string[] | undefined>;

const NOBODY: RequestAuth = { userId: null, role: null, locked: false };

const prismaReadRow = (userId: string): Promise<AuthRow | null> =>
  prisma.auth.findUnique({ where: { id: userId }, select: { role: true, locked_at: true, token_version: true, last_seen_at: true } });

const prismaTouchLastSeen = (userId: string, at: Date): Promise<unknown> =>
  prisma.auth.updateMany({ where: { id: userId }, data: { last_seen_at: at } });

function header(headers: HeaderSource, name: string): string | undefined {
  if (typeof (headers as Headers).get === 'function') return (headers as Headers).get(name) ?? undefined;
  const v = (headers as Record<string, string | string[] | undefined>)[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}

/** X-Astra-Authorization first (CloudFront OAC owns Authorization toward the Function URL), then Authorization. */
export function bearerToken(headers: HeaderSource): string | null {
  const value = header(headers, 'X-Astra-Authorization') || header(headers, 'Authorization');
  return value?.startsWith('Bearer ') ? value.slice(7) : null;
}

/** user id -> the row as last read. Map order is insertion order, so the first key is the oldest. */
const cache = new Map<string, { row: AuthRow | null; at: number }>();

/** Drops one user so the next request reads the row again (call after changing their lock, role or token version). */
export function forgetUser(userId: string): void {
  cache.delete(userId);
}

export function resetRequestAuthForTests(): void {
  cache.clear();
}

function remember(userId: string, row: AuthRow | null, at: number): void {
  cache.delete(userId);
  while (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  cache.set(userId, { row, at });
}

export async function authenticateRequest(headers: HeaderSource, deps: RequestAuthDeps = {}): Promise<RequestAuth> {
  const token = bearerToken(headers);
  if (!token) return NOBODY;
  let claims: { sub?: string; userId?: string; role?: string; tv?: number };
  try {
    claims = jwt.verify(token, deps.secret ?? getJwtSecret()) as typeof claims;
  } catch {
    return NOBODY;
  }
  const userId = claims.sub ?? claims.userId ?? null;
  if (!userId) return NOBODY;
  const tv = typeof claims.tv === 'number' ? claims.tv : 1;
  const now = (deps.now ?? Date.now)();

  let entry = cache.get(userId);
  if (!entry || now - entry.at >= CACHE_TTL_MS) {
    try {
      entry = { row: await (deps.readRow ?? prismaReadRow)(userId), at: now };
      remember(userId, entry.row, now);
    } catch (err) {
      // no user id, email or token in the line
      console.warn(JSON.stringify({ msg: 'request auth: auth row read failed, using the token role', code: (err as { code?: string }).code ?? (err as Error).name }));
      return { userId, role: canonicalRole(claims.role), locked: false };
    }
  }

  const row = entry.row;
  if (!row) return { ...NOBODY, reason: 'deleted' };
  if (row.locked_at) return { userId, role: canonicalRole(row.role), locked: true };
  if (row.token_version > tv) return { ...NOBODY, reason: 'revoked' };

  if (!row.last_seen_at || now - row.last_seen_at.getTime() >= LAST_SEEN_EVERY_MS) {
    const at = new Date(now);
    row.last_seen_at = at; // the cached copy, so this instance writes at most once per 5 minutes per user
    void Promise.resolve()
      .then(() => (deps.touchLastSeen ?? prismaTouchLastSeen)(userId, at))
      .catch(() => undefined);
  }
  return { userId, role: canonicalRole(row.role), locked: false };
}

/** Express: the user id, or null after a 401 has been written (before any SSE frame, so the route just returns). */
export type RequireUser = (req: express.Request, res: express.Response) => Promise<string | null>;

export function makeRequireUser(deps: RequestAuthDeps = {}): RequireUser {
  return async (req, res) => {
    const a = await authenticateRequest(req.headers, deps);
    if (a.userId && !a.locked) return a.userId;
    if (!res.headersSent) {
      // `error` is kept for clients that read the old body
      if (a.locked) res.status(401).json({ code: 'account_locked', error: 'Account locked', message: ACCOUNT_LOCKED_MESSAGE });
      else if (a.reason === 'revoked') res.status(401).json({ code: 'session_revoked', error: 'Unauthorized' });
      else res.status(401).json({ code: 'unauthorized', error: 'Unauthorized' });
    }
    return null;
  };
}

/** Express, for public routes that only personalise: the user id or null, never a response. A locked user is nobody. */
export type OptionalUser = (req: express.Request) => Promise<string | null>;

export function makeOptionalUser(deps: RequestAuthDeps = {}): OptionalUser {
  return async (req) => {
    const a = await authenticateRequest(req.headers, deps);
    return a.userId && !a.locked ? a.userId : null;
  };
}

export const requireUser: RequireUser = makeRequireUser();
export const optionalUser: OptionalUser = makeOptionalUser();
