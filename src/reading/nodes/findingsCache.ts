/**
 * Findings cache (token saving, docs/reading-engine/05 and 13 §1). A specialist's finding depends only on the chart, the
 * analyst, the subject, the period and the prompts, so the same inputs reuse the same finding instead of a new model
 * call. The promise and nakshatra layers do not depend on the period (natal), so their key ignores it: a second
 * question in the same area, or a horizon changed during clarification, re-runs only dasha and transit.
 *
 * In process, bounded (LRU), with a TTL. A new dossier (new hash) or new prompts (new version) never hit old entries.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { readingFindingsV2 } from '../config.js';
import type { CacheOwner } from '../llm/promptCache.js';
import { horizonRange, type Horizon } from '../packs/frames.js';
import { factsLine } from '../packs/fullPrefix.js';
import { hashText } from '../packs/selector.js';
import { PROMPT_VERSION } from '../prompts/generated.js';
import type { Finding, SpecialistAnalyst } from './specialists.js';

const MAX = 500;
const TTL_MS = (() => {
  const n = Number(process.env.READING_FINDINGS_CACHE_TTL_MS);
  return Number.isFinite(n) && n >= 0 ? n : 6 * 60 * 60_000;
})();

let specialistCacheUsedHook: ((owner: CacheOwner) => void) | null = null;

export function setSpecialistCacheUsedHook(fn: ((owner: CacheOwner) => void) | null): void {
  specialistCacheUsedHook = fn;
}

function notifySpecialistUsed(owner?: CacheOwner): void {
  if (owner && (owner.userId || owner.kundliId) && specialistCacheUsedHook) {
    try {
      specialistCacheUsedHook(owner);
    } catch {
      // never break cache operations
    }
  }
}

class Lru<V> {
  private m = new Map<string, { at: number; lastUsedAt: number; usedCount: number; owner?: CacheOwner; v: V }>();
  hits = 0;
  misses = 0;
  get(k: string, owner?: CacheOwner): V | undefined {
    const e = this.m.get(k);
    if (!e || Date.now() - e.at > TTL_MS) {
      if (e) this.m.delete(k);
      this.misses += 1;
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
    this.m.delete(k);
    this.m.set(k, e);
    this.hits += 1;
    notifySpecialistUsed(e.owner);
    return e.v;
  }
  set(k: string, v: V, owner?: CacheOwner, used = true): void {
    this.m.delete(k);
    const now = Date.now();
    this.m.set(k, {
      at: now,
      lastUsedAt: now,
      usedCount: used ? 1 : 0,
      ...(owner ? { owner: { userId: owner.userId ?? null, kundliId: owner.kundliId ?? null } } : {}),
      v,
    });
    while (this.m.size > MAX) this.m.delete(this.m.keys().next().value as string);
    if (used) notifySpecialistUsed(owner);
  }
  evictForIndividual(owner: CacheOwner, opts: { onlyUsed?: boolean; idleBeforeMs?: number } = {}): number {
    if (!owner.userId && !owner.kundliId) return 0;
    let deleted = 0;
    for (const [k, e] of this.m.entries()) {
      const match = (owner.userId && e.owner?.userId === owner.userId) || (owner.kundliId && e.owner?.kundliId === owner.kundliId);
      if (!match) continue;
      if (opts.onlyUsed && e.usedCount <= 0) continue;
      if (opts.idleBeforeMs !== undefined && e.lastUsedAt > opts.idleBeforeMs) continue;
      this.m.delete(k);
      deleted += 1;
    }
    return deleted;
  }
  clear(): void {
    this.m.clear();
    this.hits = 0;
    this.misses = 0;
  }
  get size(): number {
    return this.m.size;
  }
}

export const findingsCache = new Lru<Finding>();

/** Evicts in-memory specialist findings for an individual (`userId`/`kundliId`). */
export function evictFindingsCacheForIndividual(
  owner: CacheOwner,
  opts: { onlyUsed?: boolean; idleBeforeMs?: number } = {},
): number {
  return findingsCache.evictForIndividual(owner, opts);
}

/**
 * Cross-Lambda DB specialist findings cache (`reading_findings_cache`, `reader_id = 'specialist:<analyst>'`).
 */
export async function loadDbSpecialistFinding(
  prisma: PrismaClient | null | undefined,
  cacheKey: string,
  owner?: CacheOwner,
): Promise<Finding | undefined> {
  const mem = findingsCache.get(cacheKey, owner);
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
    const finding = (row.payload as { finding?: Finding } | Finding | null) && 'analyst' in (row.payload as object)
      ? (row.payload as Finding)
      : (row.payload as { finding?: Finding } | null)?.finding;
    if (finding?.analyst) {
      const effOwner: CacheOwner = {
        userId: owner?.userId ?? row.user_id ?? null,
        kundliId: owner?.kundliId ?? row.kundli_id ?? null,
      };
      findingsCache.set(cacheKey, finding, effOwner, true);
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
      return finding;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function saveDbSpecialistFinding(
  prisma: PrismaClient | null | undefined,
  entry: {
    cacheKey: string;
    kundliId: string;
    userId?: string | null;
    analyst: SpecialistAnalyst;
    packHash: string;
    horizonKey: string;
    finding: Finding;
  },
): Promise<void> {
  const owner: CacheOwner = { userId: entry.userId ?? null, kundliId: entry.kundliId };
  findingsCache.set(entry.cacheKey, entry.finding, owner, true);
  const model = (prisma as unknown as { readingFindingsCache?: { upsert?: (args: unknown) => Promise<unknown> } })?.readingFindingsCache;
  if (!model?.upsert) return;
  const natal = entry.analyst === 'promise' || entry.analyst === 'nakshatra';
  const ttlMs = natal ? 7 * 24 * 3_600_000 : TTL_MS;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  try {
    await model.upsert({
      where: { cache_key: entry.cacheKey },
      create: {
        cache_key: entry.cacheKey,
        kundli_id: entry.kundliId,
        ...(entry.userId ? { user_id: entry.userId } : {}),
        reader_id: `specialist:${entry.analyst}`,
        pack_hash: entry.packHash,
        horizon_key: entry.horizonKey,
        prompt_version: PROMPT_VERSION,
        payload: { finding: entry.finding } as unknown as Prisma.InputJsonValue,
        expires_at: expiresAt,
        hit_count: 1,
        last_used_at: now,
      },
      update: {
        payload: { finding: entry.finding } as unknown as Prisma.InputJsonValue,
        expires_at: expiresAt,
        ...(entry.userId ? { user_id: entry.userId } : {}),
        hit_count: { increment: 1 },
        last_used_at: now,
      },
    });
  } catch {
    // missing table or read-only replica: in-memory cache already holds the finding
  }
}

/** Natal layers (promise, nakshatra) ignore the period; timing layers key on the exact period; annual keys on the year + period. */
export function findingCacheKey(a: { dossierHash: string; analyst: SpecialistAnalyst; subject: string; horizon: Horizon; asOf: string; facts?: Record<string, string> | null }): string {
  const natal = a.analyst === 'promise' || a.analyst === 'nakshatra';
  const hz = horizonRange(a.horizon, a.asOf);
  const period = a.analyst === 'annual' ? `annual:${a.asOf.slice(0, 4)}:${hz.from}..${hz.to}` : natal ? 'natal' : `${hz.from}..${hz.to}`;
  const known = factsLine(a.facts);
  const base = [a.dossierHash, a.analyst, a.subject, period, PROMPT_VERSION, readingFindingsV2() ? 'v2' : 'v1'];
  if (known) base.push(hashText(known));
  return base.join('|');
}
