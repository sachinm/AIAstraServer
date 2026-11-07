import type { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getReadingCacheRecycleMinutes, getReadingCacheRecycleMs } from '../../../src/config/env.js';
import { memoryCacheRegistry } from '../../../src/reading/llm/cacheRegistry.js';
import {
  clearPendingIndividualRecycles,
  getPendingIndividualRecycles,
  informIndividualCacheUsed,
  recycleIndividualCaches,
  runScheduledSweep,
} from '../../../src/reading/llm/cacheSweep.js';
import {
  cacheNameFor,
  clearPromptCache,
  setCacheRegistry,
  settlePromptCache,
} from '../../../src/reading/llm/promptCache.js';
import { findingsCache } from '../../../src/reading/nodes/findingsCache.js';
import { clearChartBundles, loadChartBundle } from '../../../src/reading/oracle/chartBundle.js';
import {
  clearReaderMemo,
  getReaderMemo,
  loadDbReaderCache,
  saveDbReaderCache,
} from '../../../src/reading/oracle/prewarm.js';

describe('45-minute per-individual cache recycling of used caches', () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    clearPendingIndividualRecycles();
    clearPromptCache();
    clearReaderMemo();
    clearChartBundles();
    findingsCache.clear();
    delete process.env.READING_CACHE_RECYCLE_MINUTES;
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.READING_EXPLICIT_CACHE = '1';
    process.env.READING_EXPLICIT_CACHE_MIN_USES = '1';
  });

  afterEach(() => {
    clearPendingIndividualRecycles();
    setCacheRegistry(undefined);
    globalThis.fetch = origFetch;
    delete process.env.READING_CACHE_RECYCLE_MINUTES;
    delete process.env.READING_EXPLICIT_CACHE;
    delete process.env.READING_EXPLICIT_CACHE_MIN_USES;
  });

  it('defaults READING_CACHE_RECYCLE_MINUTES to 45 minutes and honors env overrides', () => {
    expect(getReadingCacheRecycleMinutes()).toBe(45);
    expect(getReadingCacheRecycleMs()).toBe(45 * 60_000);

    process.env.READING_CACHE_RECYCLE_MINUTES = '60';
    expect(getReadingCacheRecycleMinutes()).toBe(60);
    expect(getReadingCacheRecycleMs()).toBe(60 * 60_000);
  });

  it('informs the 45-minute recycle task whenever a cache is used and removes all used caches for that individual', async () => {
    const reg = memoryCacheRegistry();
    setCacheRegistry(reg);

    const deletedGeminiCaches: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.includes('/cachedContents')) {
        return new Response(
          JSON.stringify({
            name: 'cachedContents/indiv-k1-cache',
            expireTime: new Date(Date.now() + 3600_000).toISOString(),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (init?.method === 'DELETE') {
        deletedGeminiCaches.push(url);
        return new Response('{}', { status: 200 });
      }
      if (url.includes('/cachedContents')) {
        return new Response(JSON.stringify({ cachedContents: [] }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    const owner1 = { userId: 'user-1', kundliId: 'kundli-1' };
    const owner2 = { userId: 'user-2', kundliId: 'kundli-2' };

    // 1. Trigger Gemini prompt cache creation & usage for owner1
    cacheNameFor('gemini-3.1-flash-lite', 'SYS', 'CHART CORE: {...}', 'test-key', owner1);
    await settlePromptCache();
    expect(cacheNameFor('gemini-3.1-flash-lite', 'SYS', 'CHART CORE: {...}', 'test-key', owner1)).toBe(
      'cachedContents/indiv-k1-cache',
    );

    // Verify the 45m recycle task was automatically informed for owner1
    const pending = getPendingIndividualRecycles();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ userId: 'user-1', kundliId: 'kundli-1' });
    expect(pending[0]!.dueAt - pending[0]!.lastUsedAt).toBe(45 * 60_000);

    // 2. Populate DB & memory caches for owner1 (used + unused) and owner2 (used)
    const findingsRows = new Map<string, Record<string, unknown>>();
    const techniqueRows = new Map<string, Record<string, unknown>>();

    const fakePrisma = {
      readingFindingsCache: {
        findUnique: vi.fn(async ({ where }: { where: { cache_key: string } }) => findingsRows.get(where.cache_key) ?? null),
        upsert: vi.fn(async ({ where, create, update }: { where: { cache_key: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
          const prev = findingsRows.get(where.cache_key);
          const next = prev ? { ...prev, ...update } : { ...create };
          findingsRows.set(where.cache_key, next);
          return next;
        }),
        updateMany: vi.fn(async ({ where, data }: { where: { cache_key: string }; data: Record<string, unknown> }) => {
          const r = findingsRows.get(where.cache_key);
          if (r) {
            r.hit_count = ((r.hit_count as number) ?? 0) + 1;
            r.last_used_at = data.last_used_at;
          }
          return { count: r ? 1 : 0 };
        }),
        deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
          let count = 0;
          for (const [k, r] of findingsRows.entries()) {
            const matchOwner =
              Array.isArray(where.OR) &&
              (where.OR as Array<Record<string, unknown>>).some(
                (cond) => (cond.kundli_id && r.kundli_id === cond.kundli_id) || (cond.user_id && r.user_id === cond.user_id),
              );
            if (!matchOwner) continue;
            const isUsed = ((r.hit_count as number) ?? 0) > 0 || r.last_used_at != null;
            if (where.AND && !isUsed) continue;
            findingsRows.delete(k);
            count += 1;
          }
          return { count };
        }),
      },
      techniqueOutput: {
        deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
          let count = 0;
          for (const [k, r] of techniqueRows.entries()) {
            if (where.kundli_id && r.kundli_id !== where.kundli_id) continue;
            const isUsed = ((r.hit_count as number) ?? 0) > 0 || r.last_hit_at != null;
            if (where.AND && !isUsed) continue;
            techniqueRows.delete(k);
            count += 1;
          }
          return { count };
        }),
      },
    } as unknown as PrismaClient;

    const dummyHeld = {
      finding: {
        verdict: 'strong' as const,
        layerScore: 2,
        digest: 'ok',
        claims: [],
        windows: [],
        quotes: [],
        gaps: [],
        disagree: '',
        actors: [],
        graces: [],
        pointers: [],
        sensitive: '',
        form: '',
        culprits: [],
        contributors: [],
        caveats: [],
      },
      usage: { node: 'R01', model: 'm', promptTokens: 10, cachedTokens: 0, outputTokens: 5, thoughtTokens: 0, ms: 1 },
    };

    // Owner 1: one used reader finding, one unused prewarmed reader finding
    await saveDbReaderCache(fakePrisma, {
      cacheKey: 'k1-used-reader',
      kundliId: 'kundli-1',
      userId: 'user-1',
      readerId: 'R01',
      packHash: 'p1',
      horizonKey: 'natal',
      promptVersion: 'v1',
      natal: true,
      held: dummyHeld,
      used: true,
    });
    await saveDbReaderCache(fakePrisma, {
      cacheKey: 'k1-unused-prewarm',
      kundliId: 'kundli-1',
      userId: 'user-1',
      readerId: 'R02',
      packHash: 'p1',
      horizonKey: 'natal',
      promptVersion: 'v1',
      natal: true,
      held: dummyHeld,
      used: false,
    });
    // Owner 2: one used reader finding
    await saveDbReaderCache(fakePrisma, {
      cacheKey: 'k2-used-reader',
      kundliId: 'kundli-2',
      userId: 'user-2',
      readerId: 'R01',
      packHash: 'p2',
      horizonKey: 'natal',
      promptVersion: 'v1',
      natal: true,
      held: dummyHeld,
      used: true,
    });

    // Technique outputs for owner1: one used, one unused
    techniqueRows.set('tech-k1-used', {
      cache_key: 'tech-k1-used',
      kundli_id: 'kundli-1',
      hit_count: 2,
      last_hit_at: new Date(),
    });
    techniqueRows.set('tech-k1-unused', {
      cache_key: 'tech-k1-unused',
      kundli_id: 'kundli-1',
      hit_count: 0,
      last_hit_at: null,
    });

    // In-memory specialist findings & chartBundle for owner1
    findingsCache.set('spec-k1', { analyst: 'promise', subject: 'career_work', verdict: 'strong', layerScore: 2, claims: [], windows: [], keyFacts: [], caveats: [] }, owner1, true);
    await loadChartBundle({ read: async () => [{ data_type: 'varga.d1', variant: '', payload: { ok: true } }] }, 'kundli-1', ['varga.d1'], '2026-11-06');

    // 3. Run 45-minute recycle for owner1 (`onlyUsed: true`)
    const res = await recycleIndividualCaches(owner1, { prisma: fakePrisma, onlyUsed: true });

    expect(res.llmDeleted).toBe(1);
    expect(deletedGeminiCaches.some((u) => u.includes('cachedContents/indiv-k1-cache'))).toBe(true);
    expect(res.readerDbDeleted).toBe(1);
    expect(findingsRows.has('k1-used-reader')).toBe(false);
    // Unused prewarmed cache and owner2's cache remain intact!
    expect(findingsRows.has('k1-unused-prewarm')).toBe(true);
    expect(findingsRows.has('k2-used-reader')).toBe(true);
    expect(getReaderMemo('k1-used-reader')).toBeUndefined();
    expect(getReaderMemo('k1-unused-prewarm')).toBeDefined();

    // Used technique output for owner1 was recycled; unused one was kept
    expect(res.techniqueOutputsDeleted).toBe(1);
    expect(techniqueRows.has('tech-k1-used')).toBe(false);
    expect(techniqueRows.has('tech-k1-unused')).toBe(true);

    expect(res.specialistMemoryDeleted).toBe(1);
    expect(findingsCache.get('spec-k1')).toBeUndefined();
    expect(res.chartBundleEvicted).toBe(true);
  });

  it('executes scheduled per-individual recycle when runScheduledSweep advances past 45 minutes', async () => {
    const reg = memoryCacheRegistry();
    setCacheRegistry(reg);
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ cachedContents: [] }), { status: 200 })) as typeof fetch;

    const findingsRows = new Map<string, Record<string, unknown>>([
      [
        'k9-used',
        {
          cache_key: 'k9-used',
          kundli_id: 'kundli-9',
          user_id: 'user-9',
          hit_count: 1,
          last_used_at: new Date(Date.now() - 50 * 60_000),
          created_at: new Date(Date.now() - 50 * 60_000),
          expires_at: new Date(Date.now() + 3600_000),
          payload: { finding: { verdict: 'moderate', layerScore: 1, digest: 'd', claims: [], windows: [], quotes: [], gaps: [], disagree: '', actors: [], graces: [], pointers: [], sensitive: '', form: '', culprits: [], contributors: [], caveats: [] }, usage: { node: 'R01', model: 'm', promptTokens: 1, cachedTokens: 0, outputTokens: 1, thoughtTokens: 0, ms: 1 } },
        },
      ],
    ]);

    const fakePrisma = {
      readingFindingsCache: {
        findUnique: async ({ where }: { where: { cache_key: string } }) => findingsRows.get(where.cache_key) ?? null,
        updateMany: async () => ({ count: 1 }),
        deleteMany: async () => {
          const n = findingsRows.size;
          findingsRows.clear();
          return { count: n };
        },
      },
      techniqueOutput: {
        deleteMany: async () => ({ count: 1 }),
      },
    } as unknown as PrismaClient;

    await loadDbReaderCache(fakePrisma, 'k9-used', { userId: 'user-9', kundliId: 'kundli-9' });
    informIndividualCacheUsed({ userId: 'user-9', kundliId: 'kundli-9' }, { delayMs: 45 * 60_000, prisma: fakePrisma });
    expect(getPendingIndividualRecycles()).toHaveLength(1);

    const future = new Date(Date.now() + 46 * 60_000);
    const sweepOut = await runScheduledSweep({ prisma: fakePrisma, now: future, force: true });
    expect('skipped' in sweepOut).toBe(false);
    if (!('skipped' in sweepOut)) {
      expect(sweepOut.individualsRecycled).toBe(1);
    }
    expect(getPendingIndividualRecycles()).toHaveLength(0);
    expect(findingsRows.size).toBe(0);
  });
});
