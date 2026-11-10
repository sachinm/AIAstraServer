/**
 * doc 66 replay run 2 (2026-11-09): 15 expired cache regions answered HTTP 403 on delete, so their `llm_cache_entries`
 * rows kept `deleted_at = null` and every per-individual delete retried them. A 403 or 404 on a region past `expires_at`
 * now counts as gone and marks the row deleted; a 403 on a live region stays an error. Gemini is a mocked fetch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryCacheRegistry, type CacheRow } from '../../../../src/reading/llm/cacheRegistry.js';
import { recycleIndividualCaches } from '../../../../src/reading/llm/cacheSweep.js';
import { CacheDeleteError, clearPromptCache, deleteIndividualCaches, deleteUserCaches, goneOnDelete, setCacheRegistry, sweepLlmCaches } from '../../../../src/reading/llm/promptCache.js';

const NOW = Date.now();
const row = (name: string, expiresInMs: number): CacheRow => ({
  name,
  provider: 'gemini',
  userId: 'u1',
  kundliId: 'k1',
  prefixHash: name,
  model: 'gemini-3.1-flash-lite',
  createdAt: new Date(NOW - 3_600_000),
  lastUsedAt: new Date(NOW - 3_600_000),
  expiresAt: new Date(NOW + expiresInMs),
  deletedAt: null,
  deleteError: null,
});

const env0 = { ...process.env };
let reg: ReturnType<typeof memoryCacheRegistry>;
const deletes: string[] = [];

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  reg = memoryCacheRegistry();
  setCacheRegistry(reg);
  clearPromptCache();
  deletes.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = new URL(String(input));
      if ((init?.method ?? 'GET') === 'DELETE') {
        deletes.push(url.pathname);
        return new Response(JSON.stringify({ error: { message: 'permission denied' } }), { status: 403 });
      }
      return new Response(JSON.stringify({ cachedContents: [] }), { status: 200 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  setCacheRegistry(undefined);
  process.env = { ...env0 };
});

describe('expired cache regions that answer 403 on delete', () => {
  it('goneOnDelete: 403/404 past expiry is gone; 403 on a live region, or a 500, is not', () => {
    const past = new Date(NOW - 1000);
    const future = new Date(NOW + 60_000);
    expect(goneOnDelete(new CacheDeleteError(403), past)).toBe(true);
    expect(goneOnDelete(new CacheDeleteError(404), past)).toBe(true);
    expect(goneOnDelete(new Error('HTTP 403'), past)).toBe(true);
    expect(goneOnDelete(new CacheDeleteError(403), future)).toBe(false);
    expect(goneOnDelete(new CacheDeleteError(500), past)).toBe(false);
    expect(goneOnDelete(new CacheDeleteError(403), null)).toBe(false);
  });

  it('the per-individual delete marks the 15 expired rows deleted and keeps the live 403 as an error', async () => {
    for (let i = 0; i < 15; i++) await reg.record(row(`cachedContents/old${i}`, -3_600_000));
    await reg.record(row('cachedContents/live', 1_800_000));
    const r = await deleteIndividualCaches({ userId: 'u1', kundliId: 'k1' });
    expect(r).toMatchObject({ deleted: 15, failed: 1 });
    for (let i = 0; i < 15; i++) expect(reg.rows.get(`cachedContents/old${i}`)!.deletedAt).toBeInstanceOf(Date);
    expect(reg.rows.get('cachedContents/live')!.deletedAt).toBeNull();
    expect(reg.rows.get('cachedContents/live')!.deleteError).toBe('HTTP 403');
    // a second pass touches only the live row: the expired ones are no longer retried
    deletes.length = 0;
    await deleteIndividualCaches({ userId: 'u1', kundliId: 'k1' });
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toContain('cachedContents/live');
  });

  it('the recycler (cacheSweep.ts) and logout go through the same rule', async () => {
    await reg.record(row('cachedContents/old', -60_000));
    const r = await recycleIndividualCaches({ userId: 'u1', kundliId: 'k1' }, { prisma: null, onlyUsed: false });
    expect(r.llmDeleted).toBe(1);
    expect(r.llmFailed).toBe(0);
    await reg.record(row('cachedContents/old2', -60_000));
    expect(await deleteUserCaches('u1')).toEqual({ deleted: 1, failed: 0 });
  });

  it('the sweep still marks expired rows without a provider call', async () => {
    await reg.record(row('cachedContents/old', -60_000));
    const out = await sweepLlmCaches({ now: new Date() });
    expect(out.expiredMarked).toBe(1);
    expect(deletes).toEqual([]);
  });
});
