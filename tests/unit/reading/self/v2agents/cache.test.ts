import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaCacheRegistry } from '../../../../../src/reading/llm/cacheRegistry.js';
import { clearPendingIndividualRecycles, getPendingIndividualRecycles, informIndividualCacheUsed, recycleIndividualCaches } from '../../../../../src/reading/llm/cacheSweep.js';
import { cacheNameFor, clearPromptCache, setCacheRegistry } from '../../../../../src/reading/llm/promptCache.js';
import { markAgentUsed, warmPrefixes } from '../../../../../src/reading/self/v2/cache.js';
import { buildSelfV2Slices } from '../../../../../src/reading/self/v2/slices.js';
import { ACTIVATION, makeBriefs, makeCtx, makePrisma, makeView } from './fixtures.js';

const ENV_KEYS = ['GEMINI_API_KEY', 'READING_EXPLICIT_CACHE', 'READING_EXPLICIT_CACHE_MIN_USES'] as const;

describe('Self v2 warm-up and cache ledger (AGENTS.md machinery rules 4 and 5)', () => {
  const origFetch = globalThis.fetch;
  const saved: Record<string, string | undefined> = {};
  const created: string[] = [];
  const deleted: string[] = [];

  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.READING_EXPLICIT_CACHE = '1';
    process.env.READING_EXPLICIT_CACHE_MIN_USES = '1';
    clearPromptCache();
    clearPendingIndividualRecycles();
    created.length = 0;
    deleted.length = 0;
    let n = 0;
    // the provider is mocked: no request leaves the process
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.includes('/cachedContents')) {
        const name = `cachedContents/v2-${++n}`;
        created.push(name);
        return new Response(JSON.stringify({ name, expireTime: new Date(Date.now() + 1800_000).toISOString() }), { status: 200 });
      }
      if (init?.method === 'DELETE') {
        deleted.push(url);
        return new Response('{}', { status: 200 });
      }
      return new Response(JSON.stringify({ cachedContents: [] }), { status: 200 });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    setCacheRegistry(undefined);
    clearPromptCache();
    clearPendingIndividualRecycles();
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  const slices = () => {
    const s = buildSelfV2Slices(makeCtx(), { view: makeView(), activation: ACTIVATION, sky: null, preferred: null }, makeBriefs());
    return [...Object.values(s.families), s.oracle];
  };

  it('a region created through warmPrefixes has its llm_cache_entries row (name, provider, user, kundli, prefix hash, model, expiry)', async () => {
    const db = makePrisma();
    setCacheRegistry(prismaCacheRegistry(db.prisma));
    const all = slices();
    const warmed = await warmPrefixes(all);
    expect(warmed).toHaveLength(6);
    expect(warmed.every((w) => w.name?.startsWith('cachedContents/v2-'))).toBe(true);
    expect(created).toHaveLength(6);
    expect(db.cacheRows.size).toBe(6);
    for (const name of created) {
      const row = db.cacheRows.get(name)!;
      expect(row).toMatchObject({ name, provider: 'gemini', user_id: 'u-v2', kundli_id: 'k-v2', deleted_at: null });
      expect(row.prefix_hash).toMatch(/^[0-9a-f]{24}$/);
      expect(typeof row.model).toBe('string');
      expect(row.expires_at).toBeInstanceOf(Date);
    }
  });

  it('recycleIndividualCaches deletes the region at the provider and marks its row', async () => {
    const db = makePrisma();
    setCacheRegistry(prismaCacheRegistry(db.prisma));
    const [oracle] = slices().slice(-1);
    const [w] = await warmPrefixes([oracle!]);
    // the agent call consumes the cache (what callGemini does) and the build informs the recycler
    expect(cacheNameFor(oracle!.model, oracle!.system, oracle!.prefix, 'test-key', oracle!.cacheOwner)).toBe(w!.name);
    const res = await recycleIndividualCaches({ userId: 'u-v2', kundliId: 'k-v2' }, { prisma: null, onlyUsed: true });
    expect(res.llmDeleted).toBe(1);
    expect(deleted.some((u) => u.includes(w!.name!))).toBe(true);
    expect(db.cacheRows.get(w!.name!)!.deleted_at).toBeInstanceOf(Date);
  });

  it('is a no-op without READING_EXPLICIT_CACHE=1: no request, no row', async () => {
    delete process.env.READING_EXPLICIT_CACHE;
    const db = makePrisma();
    setCacheRegistry(prismaCacheRegistry(db.prisma));
    const ensure = vi.fn();
    const warmed = await warmPrefixes(slices(), { ensureCache: ensure });
    expect(warmed.every((w) => w.name === null)).toBe(true);
    expect(ensure).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
    expect(db.cacheRows.size).toBe(0);
  });

  it('warms all prefixes in parallel, one region per distinct prefix', async () => {
    let inFlight = 0;
    let peak = 0;
    const ensure = vi.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return 'cachedContents/x';
    });
    const all = slices();
    await warmPrefixes([...all, all[0]!], { ensureCache: ensure as never });
    expect(ensure).toHaveBeenCalledTimes(6);
    expect(peak).toBe(6);
  });

  it('markAgentUsed informs the 45-minute recycler for the slice owner', () => {
    const [oracle] = slices().slice(-1);
    markAgentUsed(oracle!);
    expect(getPendingIndividualRecycles()).toEqual([expect.objectContaining({ userId: 'u-v2', kundliId: 'k-v2' })]);
    const spy = vi.fn();
    markAgentUsed(oracle!, spy as unknown as typeof informIndividualCacheUsed);
    expect(spy).toHaveBeenCalledWith({ userId: 'u-v2', kundliId: 'k-v2' });
  });
});
