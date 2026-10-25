/**
 * Registry of explicit LLM prompt caches (`llm_cache_entries`, migration M8; docs/reading-engine/20 §8, R-7).
 *
 * One row per provider cache. Every instance looks here before creating a cache (one cache per chart prefix across Lambda
 * instances), logout deletes the user's caches, and the sweeper deletes idle ones and reconciles orphans.
 * promptCache.ts treats every call here as best effort: a failure (table missing, DB down) never breaks a chat call.
 */
import type { PrismaClient } from '@prisma/client';

export interface CacheRow {
  name: string;
  provider: string;
  userId: string | null;
  kundliId: string | null;
  prefixHash: string;
  model: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  deletedAt: Date | null;
  deleteError: string | null;
}

export interface CacheRegistry {
  /** A live (not deleted, not expired at `now`) row for this prefix, the one expiring last. */
  findLive(prefixHash: string, now: Date): Promise<CacheRow | null>;
  /** Insert or replace the row for `row.name`. */
  record(row: CacheRow): Promise<void>;
  /** Mark a use; `expiresAt` when the TTL was extended. */
  touch(name: string, lastUsedAt: Date, expiresAt?: Date): Promise<void>;
  /** Deleted at the provider (or found gone). */
  markDeleted(name: string, at: Date): Promise<void>;
  /** The provider delete failed; the row stays live so the sweeper retries. */
  markDeleteError(name: string, error: string): Promise<void>;
  /** Live rows of one user. */
  listByUser(userId: string): Promise<CacheRow[]>;
  /** Live rows idle since before `idleBefore`, or already expired at `now`. */
  listStale(idleBefore: Date, now: Date): Promise<CacheRow[]>;
  /** Names of every row not marked deleted. */
  liveNames(): Promise<Set<string>>;
}

type DbRow = {
  name: string;
  provider: string;
  user_id: string | null;
  kundli_id: string | null;
  prefix_hash: string;
  model: string;
  created_at: Date;
  last_used_at: Date;
  expires_at: Date;
  deleted_at: Date | null;
  delete_error: string | null;
};

const fromDb = (r: DbRow): CacheRow => ({
  name: r.name,
  provider: r.provider,
  userId: r.user_id,
  kundliId: r.kundli_id,
  prefixHash: r.prefix_hash,
  model: r.model,
  createdAt: r.created_at,
  lastUsedAt: r.last_used_at,
  expiresAt: r.expires_at,
  deletedAt: r.deleted_at,
  deleteError: r.delete_error,
});

/**
 * The slice of Prisma's `llmCacheEntry` delegate this file uses. Typed locally so the registry compiles against a client
 * generated before M8 (the generated client is shared between checkouts); at run time the build's `prisma generate`
 * provides the real delegate.
 */
type Where = Record<string, unknown>;
interface LlmCacheEntryDelegate {
  findFirst(args: { where: Where; orderBy?: Where }): Promise<DbRow | null>;
  findMany(args: { where: Where; select?: { name: true } }): Promise<DbRow[]>;
  upsert(args: { where: { name: string }; create: DbRow; update: Omit<DbRow, 'name'> }): Promise<unknown>;
  updateMany(args: { where: Where; data: Partial<DbRow> }): Promise<unknown>;
}

export function prismaCacheRegistry(prisma: PrismaClient): CacheRegistry {
  const t = (prisma as unknown as { llmCacheEntry: LlmCacheEntryDelegate }).llmCacheEntry;
  return {
    async findLive(prefixHash, now) {
      const r = await t.findFirst({ where: { prefix_hash: prefixHash, deleted_at: null, expires_at: { gt: now } }, orderBy: { expires_at: 'desc' } });
      return r ? fromDb(r) : null;
    },
    async record(row) {
      const data = {
        provider: row.provider,
        user_id: row.userId,
        kundli_id: row.kundliId,
        prefix_hash: row.prefixHash,
        model: row.model,
        created_at: row.createdAt,
        last_used_at: row.lastUsedAt,
        expires_at: row.expiresAt,
        deleted_at: row.deletedAt,
        delete_error: row.deleteError,
      };
      await t.upsert({ where: { name: row.name }, create: { name: row.name, ...data }, update: data });
    },
    async touch(name, lastUsedAt, expiresAt) {
      await t.updateMany({ where: { name, deleted_at: null }, data: { last_used_at: lastUsedAt, ...(expiresAt ? { expires_at: expiresAt } : {}) } });
    },
    async markDeleted(name, at) {
      await t.updateMany({ where: { name }, data: { deleted_at: at, delete_error: null } });
    },
    async markDeleteError(name, error) {
      await t.updateMany({ where: { name }, data: { delete_error: error.slice(0, 500) } });
    },
    async listByUser(userId) {
      return (await t.findMany({ where: { user_id: userId, deleted_at: null } })).map(fromDb);
    },
    async listStale(idleBefore, now) {
      return (await t.findMany({ where: { deleted_at: null, OR: [{ last_used_at: { lt: idleBefore } }, { expires_at: { lte: now } }] } })).map(fromDb);
    },
    async liveNames() {
      return new Set((await t.findMany({ where: { deleted_at: null }, select: { name: true } })).map((r) => r.name));
    },
  };
}

/** In-memory registry for tests and for running without a database. */
export function memoryCacheRegistry(): CacheRegistry & { rows: Map<string, CacheRow> } {
  const rows = new Map<string, CacheRow>();
  const live = (r: CacheRow) => !r.deletedAt;
  return {
    rows,
    async findLive(prefixHash, now) {
      const hits = [...rows.values()].filter((r) => live(r) && r.prefixHash === prefixHash && r.expiresAt > now);
      return hits.sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime())[0] ?? null;
    },
    async record(row) {
      rows.set(row.name, { ...row });
    },
    async touch(name, lastUsedAt, expiresAt) {
      const r = rows.get(name);
      if (r && live(r)) Object.assign(r, { lastUsedAt, ...(expiresAt ? { expiresAt } : {}) });
    },
    async markDeleted(name, at) {
      const r = rows.get(name);
      if (r) Object.assign(r, { deletedAt: at, deleteError: null });
    },
    async markDeleteError(name, error) {
      const r = rows.get(name);
      if (r) r.deleteError = error;
    },
    async listByUser(userId) {
      return [...rows.values()].filter((r) => live(r) && r.userId === userId);
    },
    async listStale(idleBefore, now) {
      return [...rows.values()].filter((r) => live(r) && (r.lastUsedAt < idleBefore || r.expiresAt <= now));
    },
    async liveNames() {
      return new Set([...rows.values()].filter(live).map((r) => r.name));
    },
  };
}
