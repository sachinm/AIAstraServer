/**
 * Runs the readers while the person reads the clarify card, so the Oracle can start at once on confirm (docs/reading-engine/39
 * §5). Results go into the clarify row's `reading_runs.findings`, which any Lambda instance can read, and into this instance's
 * memo. This is not the journal: journal rows are written only after the Oracle, and these entries are copied into the journal
 * at confirm with source `prewarm`. Spend is saved with them, wasted calls included, and counts against the question's caps.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { getReadingCacheRecycleMs } from '../../config/env.js';
import type { CacheOwner } from '../llm/promptCache.js';
import type { Usage } from '../types.js';
import type { ReaderResult } from './runReader.js';
import { clearValidatorCache } from './validator.js';

const MEMO_TTL_MS = 6 * 3_600_000;
const MEMO_MAX = 500;

export type HeldReader = { finding: ReaderResult['finding']; usage: Usage };
interface MemoEntry {
  at: number;
  lastUsedAt: number;
  usedCount: number;
  owner?: CacheOwner;
  value: HeldReader;
}
const memo = new Map<string, MemoEntry>();

let readerCacheUsedHook: ((owner: CacheOwner) => void) | null = null;

export function setReaderCacheUsedHook(fn: ((owner: CacheOwner) => void) | null): void {
  readerCacheUsedHook = fn;
}

function notifyUsed(owner?: CacheOwner): void {
  if (owner && (owner.userId || owner.kundliId) && readerCacheUsedHook) {
    try {
      readerCacheUsedHook(owner);
    } catch {
      // never break reader cache operations
    }
  }
}

export function getReaderMemo(key: string, owner?: CacheOwner): HeldReader | undefined {
  const e = memo.get(key);
  if (!e) return undefined;
  if (Date.now() - e.at > MEMO_TTL_MS) {
    memo.delete(key);
    return undefined;
  }
  e.lastUsedAt = Date.now();
  e.usedCount += 1;
  if (owner) {
    e.owner = {
      userId: owner.userId ?? e.owner?.userId ?? null,
      kundliId: owner.kundliId ?? e.owner?.kundliId ?? null,
    };
  }
  notifyUsed(e.owner);
  return e.value;
}

export function setReaderMemo(key: string, value: HeldReader, owner?: CacheOwner, used = true): void {
  if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value as string);
  const now = Date.now();
  memo.set(key, {
    at: now,
    lastUsedAt: now,
    usedCount: used ? 1 : 0,
    ...(owner ? { owner: { userId: owner.userId ?? null, kundliId: owner.kundliId ?? null } } : {}),
    value,
  });
  if (used) notifyUsed(owner);
}

/** Evicts in-memory reader memo entries belonging to an individual (`userId` and/or `kundliId`). */
export function evictReaderMemoForIndividual(
  owner: CacheOwner,
  opts: { onlyUsed?: boolean; idleBeforeMs?: number } = {},
): number {
  if (!owner.userId && !owner.kundliId) return 0;
  let deleted = 0;
  for (const [k, e] of memo.entries()) {
    const match = (owner.userId && e.owner?.userId === owner.userId) || (owner.kundliId && e.owner?.kundliId === owner.kundliId);
    if (!match) continue;
    if (opts.onlyUsed && e.usedCount <= 0) continue;
    if (opts.idleBeforeMs !== undefined && e.lastUsedAt > opts.idleBeforeMs) continue;
    memo.delete(k);
    deleted += 1;
  }
  return deleted;
}

/** Test seam. */
export function clearReaderMemo(): void {
  memo.clear();
  clearValidatorCache();
}

export interface PrewarmedSet {
  entries: Map<string, HeldReader>;
  spentUsd: number;
}

interface StoredPrewarm {
  prewarm: { entries: Array<{ key: string; finding: ReaderResult['finding']; usage: Usage }>; spentUsd: number };
}

/** What a clarify conversation already read. Never throws: no prewarm just means the readers run. */
export async function loadPrewarmed(prisma: PrismaClient, userId: string, clarifyRunId: string | undefined): Promise<PrewarmedSet | undefined> {
  if (!clarifyRunId) return undefined;
  try {
    const row = await prisma.readingRun.findFirst({ where: { id: clarifyRunId, user_id: userId }, select: { findings: true } });
    const stored = (row?.findings as unknown as StoredPrewarm | null)?.prewarm;
    if (!stored) return undefined;
    return { entries: new Map(stored.entries.map((e) => [e.key, { finding: e.finding, usage: e.usage }])), spentUsd: stored.spentUsd };
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'prewarm read failed', error: (err as Error).message.slice(0, 200) }));
    return undefined;
  }
}

/** Adds to what the clarify row holds. A second prewarm (the horizon was answered) keeps the first one's spend. */
export async function savePrewarmed(prisma: PrismaClient, userId: string, clarifyRunId: string, add: { entries: Array<{ key: string; held: HeldReader }>; spentUsd: number }): Promise<void> {
  const prev = await loadPrewarmed(prisma, userId, clarifyRunId);
  const entries = new Map(prev?.entries ?? []);
  for (const e of add.entries) entries.set(e.key, e.held);
  const value: StoredPrewarm = {
    prewarm: { entries: [...entries.entries()].map(([key, h]) => ({ key, finding: h.finding, usage: h.usage })), spentUsd: (prev?.spentUsd ?? 0) + add.spentUsd },
  };
  await prisma.readingRun.updateMany({ where: { id: clarifyRunId, user_id: userId }, data: { findings: value as unknown as Prisma.InputJsonValue } });
}

/**
 * Cross-Lambda DB reader cache (`reading_findings_cache`, M35/M38, docs/admin/06).
 * Natal readers (`R01..R06`) default to 7 days TTL; horizon-scoped readers (`R07..R14`, `P1..P3`, `specialist:*`) default to 6 hours TTL.
 * Tracks `hit_count` and `last_used_at` so used caches for an individual can be recycled after 45 minutes.
 * Tolerates a missing table or mock Prisma client without throwing.
 */
export async function loadDbReaderCache(
  prisma: PrismaClient | null | undefined,
  cacheKey: string,
  owner?: CacheOwner,
): Promise<HeldReader | undefined> {
  const mem = getReaderMemo(cacheKey, owner);
  if (mem) return mem;
  const model = (
    prisma as unknown as {
      readingFindingsCache?: {
        findUnique?: (args: unknown) => Promise<{
          payload: unknown;
          expires_at: Date;
          kundli_id?: string;
          user_id?: string | null;
        } | null>;
        updateMany?: (args: unknown) => Promise<unknown>;
      };
    }
  )?.readingFindingsCache;
  if (!model?.findUnique) return undefined;
  try {
    const row = await model.findUnique({ where: { cache_key: cacheKey } });
    if (!row || row.expires_at.getTime() <= Date.now()) return undefined;
    const held = row.payload as HeldReader;
    if (held?.finding) {
      const effOwner: CacheOwner = {
        userId: owner?.userId ?? row.user_id ?? null,
        kundliId: owner?.kundliId ?? row.kundli_id ?? null,
      };
      setReaderMemo(cacheKey, held, effOwner, true);
      if (model.updateMany) {
        void model
          .updateMany({
            where: { cache_key: cacheKey },
            data: {
              hit_count: { increment: 1 },
              last_used_at: new Date(),
              ...(effOwner.userId ? { user_id: effOwner.userId } : {}),
            },
          })
          .catch(() => {});
      }
      return held;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function saveDbReaderCache(
  prisma: PrismaClient | null | undefined,
  entry: {
    cacheKey: string;
    kundliId: string;
    userId?: string | null;
    readerId: string;
    packHash: string;
    horizonKey: string;
    promptVersion: string;
    natal: boolean;
    held: HeldReader;
    /** Explicit expiry timestamp (e.g. end of active Dasha sub-period, Tithi Pravesha year, or transit ingress window). */
    expiresAt?: Date;
    /** When true (default), marks the row as already used once (`hit_count = 1`, `last_used_at = now`). */
    used?: boolean;
  },
): Promise<void> {
  const used = entry.used !== false;
  const owner: CacheOwner = { userId: entry.userId ?? null, kundliId: entry.kundliId };
  setReaderMemo(entry.cacheKey, entry.held, owner, used);
  const model = (prisma as unknown as { readingFindingsCache?: { upsert?: (args: unknown) => Promise<unknown> } })?.readingFindingsCache;
  if (!model?.upsert) return;
  const ttlMs = entry.natal ? 3650 * 24 * 3_600_000 : MEMO_TTL_MS;
  const now = new Date();
  const expiresAt = entry.expiresAt && !Number.isNaN(entry.expiresAt.getTime()) ? entry.expiresAt : new Date(now.getTime() + ttlMs);
  try {
    await model.upsert({
      where: { cache_key: entry.cacheKey },
      create: {
        cache_key: entry.cacheKey,
        kundli_id: entry.kundliId,
        ...(entry.userId ? { user_id: entry.userId } : {}),
        reader_id: entry.readerId,
        pack_hash: entry.packHash,
        horizon_key: entry.horizonKey,
        prompt_version: entry.promptVersion,
        payload: entry.held as unknown as Prisma.InputJsonValue,
        expires_at: expiresAt,
        hit_count: used ? 1 : 0,
        last_used_at: used ? now : null,
      },
      update: {
        payload: entry.held as unknown as Prisma.InputJsonValue,
        expires_at: expiresAt,
        ...(entry.userId ? { user_id: entry.userId } : {}),
        ...(used ? { hit_count: { increment: 1 }, last_used_at: now } : {}),
      },
    });
  } catch {
    // missing table or read-only replica: in-memory memo already holds the entry
  }
}

export const NATAL_READER_IDS = ['R01', 'R02', 'R03', 'R04', 'R05', 'R06'] as const;

/**
 * Returns true when a `reading_findings_cache` row is protected from the 45-minute idle recycler:
 * unexpired (`expires_at > now`) natal (`R01..R06`) or `family.*` rows stay valid until their TTL expires.
 */
export function isProtectedReaderCacheRow(
  row: { reader_id?: string | null; expires_at?: Date | string | null },
  now: Date = new Date(),
): boolean {
  const expiresAt = row.expires_at ? (row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at)) : null;
  if (expiresAt && expiresAt.getTime() <= now.getTime()) return false;
  const readerId = row.reader_id ?? '';
  return (
    (NATAL_READER_IDS as readonly string[]).includes(readerId) ||
    readerId.startsWith('family.') ||
    readerId.startsWith('lineman.')
  );
}

/**
 * Recycles `reading_findings_cache` rows and in-memory reader memo entries for one individual (`userId`/`kundliId`).
 * By default (`onlyUsed = true`), removes caches that have already been used (`hit_count > 0` or `last_used_at IS NOT NULL`)
 * and whose last use is older than `idleMs` (or immediately when `idleMs` is 0 / omitted).
 * Unexpired natal (`R01..R06`) and `family.*` DB rows are preserved until `expires_at`.
 */
export async function recycleIndividualReaderCache(
  prisma: PrismaClient | null | undefined,
  owner: CacheOwner,
  opts: { onlyUsed?: boolean; idleMs?: number; now?: Date } = {},
): Promise<{ dbDeleted: number; memoryDeleted: number }> {
  if (!owner.userId && !owner.kundliId) return { dbDeleted: 0, memoryDeleted: 0 };
  const now = opts.now ?? new Date();
  const onlyUsed = opts.onlyUsed ?? true;
  const idleBeforeMs = opts.idleMs && opts.idleMs > 0 ? now.getTime() - opts.idleMs : undefined;
  const memoryDeleted = evictReaderMemoForIndividual(owner, { onlyUsed, ...(idleBeforeMs !== undefined ? { idleBeforeMs } : {}) });

  let dbDeleted = 0;
  const rawPrisma = prisma as unknown as {
    readingFindingsCache?: { deleteMany?: (args: { where: Record<string, unknown> }) => Promise<{ count: number }> };
    $executeRawUnsafe?: (sql: string, ...values: unknown[]) => Promise<number>;
  } | null;
  if (!rawPrisma) return { dbDeleted, memoryDeleted };

  const nonProtectedClause = {
    OR: [
      { expires_at: { lte: now } },
      {
        AND: [
          { reader_id: { notIn: [...NATAL_READER_IDS] } },
          { NOT: { reader_id: { startsWith: 'family.' } } },
          { NOT: { reader_id: { startsWith: 'lineman.' } } },
        ],
      },
    ],
  };

  try {
    if (rawPrisma.readingFindingsCache?.deleteMany) {
      const ownerOr: Array<Record<string, unknown>> = [];
      if (owner.kundliId) ownerOr.push({ kundli_id: owner.kundliId });
      if (owner.userId) ownerOr.push({ user_id: owner.userId });
      const where: Record<string, unknown> = { OR: ownerOr };
      if (onlyUsed) {
        where.AND = [
          { OR: [{ hit_count: { gt: 0 } }, { last_used_at: { not: null } }] },
          ...(idleBeforeMs !== undefined
            ? [{ OR: [{ last_used_at: { lte: new Date(idleBeforeMs) } }, { AND: [{ last_used_at: null }, { created_at: { lte: new Date(idleBeforeMs) } }] }] }]
            : []),
          nonProtectedClause,
        ];
      } else if (idleBeforeMs !== undefined) {
        where.AND = [
          { OR: [{ last_used_at: { lte: new Date(idleBeforeMs) } }, { AND: [{ last_used_at: null }, { created_at: { lte: new Date(idleBeforeMs) } }] }] },
          nonProtectedClause,
        ];
      } else {
        where.AND = [nonProtectedClause];
      }
      const res = await rawPrisma.readingFindingsCache.deleteMany({ where });
      dbDeleted = res.count;
    } else if (typeof rawPrisma.$executeRawUnsafe === 'function' && owner.kundliId) {
      const cutoff = new Date(idleBeforeMs ?? now.getTime());
      dbDeleted = await rawPrisma.$executeRawUnsafe(
        onlyUsed
          ? `DELETE FROM "reading_findings_cache"
              WHERE ("kundli_id" = $1 OR ($2::text IS NOT NULL AND "user_id" = $2))
                AND ("hit_count" > 0 OR "last_used_at" IS NOT NULL)
                AND COALESCE("last_used_at", "created_at") <= $3
                AND ("expires_at" <= $4 OR ("reader_id" NOT IN ('R01','R02','R03','R04','R05','R06') AND "reader_id" NOT LIKE 'family.%' AND "reader_id" NOT LIKE 'lineman.%'))`
          : `DELETE FROM "reading_findings_cache"
              WHERE ("kundli_id" = $1 OR ($2::text IS NOT NULL AND "user_id" = $2))
                AND COALESCE("last_used_at", "created_at") <= $3
                AND ("expires_at" <= $4 OR ("reader_id" NOT IN ('R01','R02','R03','R04','R05','R06') AND "reader_id" NOT LIKE 'family.%' AND "reader_id" NOT LIKE 'lineman.%'))`,
        owner.kundliId,
        owner.userId ?? null,
        cutoff,
        now,
      );
    }
  } catch {
    // best-effort DB cleanup
  }
  return { dbDeleted, memoryDeleted };
}

/**
 * Sweeps expired `reading_findings_cache` rows and recycles already-used rows idle longer than `idleMs` (default 45 min).
 * Unexpired natal (`R01..R06`) and `family.*` rows are preserved until `expires_at`.
 */
export async function sweepReaderFindingsCache(
  prisma: PrismaClient | null | undefined,
  opts: { idleMs?: number; now?: Date } = {},
): Promise<number> {
  const now = opts.now ?? new Date();
  const idleMs = opts.idleMs ?? getReadingCacheRecycleMs();
  const idleBefore = new Date(now.getTime() - idleMs);
  for (const [k, e] of memo.entries()) {
    if (now.getTime() - e.at > MEMO_TTL_MS || (e.usedCount > 0 && e.lastUsedAt <= idleBefore.getTime())) {
      memo.delete(k);
    }
  }
  const rawPrisma = prisma as unknown as {
    readingFindingsCache?: { deleteMany?: (args: { where: Record<string, unknown> }) => Promise<{ count: number }> };
    $executeRawUnsafe?: (sql: string, ...values: unknown[]) => Promise<number>;
  } | null;
  if (!rawPrisma) return 0;
  try {
    if (rawPrisma.readingFindingsCache?.deleteMany) {
      const res = await rawPrisma.readingFindingsCache.deleteMany({
        where: {
          OR: [
            { expires_at: { lte: now } },
            {
              AND: [
                { OR: [{ hit_count: { gt: 0 } }, { last_used_at: { not: null } }] },
                { OR: [{ last_used_at: { lte: idleBefore } }, { AND: [{ last_used_at: null }, { created_at: { lte: idleBefore } }] }] },
                { reader_id: { notIn: [...NATAL_READER_IDS] } },
                { NOT: { reader_id: { startsWith: 'family.' } } },
                { NOT: { reader_id: { startsWith: 'lineman.' } } },
              ],
            },
          ],
        },
      });
      return res.count;
    }
    if (typeof rawPrisma.$executeRawUnsafe === 'function') {
      return await rawPrisma.$executeRawUnsafe(
        `DELETE FROM "reading_findings_cache"
          WHERE "expires_at" <= $1
             OR (
               ("hit_count" > 0 OR "last_used_at" IS NOT NULL)
               AND COALESCE("last_used_at", "created_at") <= $2
               AND "reader_id" NOT IN ('R01','R02','R03','R04','R05','R06')
               AND "reader_id" NOT LIKE 'family.%'
               AND "reader_id" NOT LIKE 'lineman.%'
             )`,
        now,
        idleBefore,
      );
    }
  } catch {
    // best effort
  }
  return 0;
}
