/**
 * LLM cache lifecycle (R-7, docs/reading-engine/20 §8): registry rows, sliding TTL, cross-instance reuse, logout delete,
 * sweeper, and registry failure. Gemini's cachedContents API is a mocked global fetch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryCacheRegistry, type CacheRegistry, type CacheRow } from '../../../src/reading/llm/cacheRegistry.js';
import { cacheNameFor, cacheStats, clearPromptCache, deleteUserCaches, prefixKey, setCacheRegistry, settlePromptCache, sweepLlmCaches } from '../../../src/reading/llm/promptCache.js';
import { isCacheSweepEvent } from '../../../src/reading/llm/cacheSweep.js';

interface FakeCache {
  name: string;
  displayName?: string;
  createTime: string;
  expireTime: string;
}
const store = new Map<string, FakeCache>();
const calls: Array<{ method: string; path: string; search: string; body: any }> = [];
let n = 0;

const reply = (status: number, obj: unknown) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const fakeFetch = vi.fn(async (input: unknown, init?: RequestInit) => {
  const url = new URL(String(input));
  const method = init?.method ?? 'GET';
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  calls.push({ method, path: url.pathname, search: url.search, body });
  const one = /\/(cachedContents\/[^/]+)$/.exec(url.pathname)?.[1];
  if (url.pathname.endsWith('/cachedContents')) {
    if (method === 'GET') return reply(200, { cachedContents: [...store.values()] });
    const name = `cachedContents/c${++n}`;
    const c = { name, displayName: body.displayName, createTime: new Date().toISOString(), expireTime: new Date(Date.now() + parseInt(body.ttl, 10) * 1000).toISOString() };
    store.set(name, c);
    return reply(200, c);
  }
  if (one && method === 'PATCH') {
    const c = store.get(one);
    if (!c) return reply(404, { error: { message: 'not found' } });
    c.expireTime = new Date(Date.now() + parseInt(body.ttl, 10) * 1000).toISOString();
    return reply(200, c);
  }
  if (one && method === 'DELETE') return store.delete(one) ? reply(200, {}) : reply(404, { error: { message: 'not found' } });
  return reply(400, { error: { message: 'unexpected' } });
});

const MODEL = 'gemini-3-flash';
const SYSTEM = 'SYSTEM';
const BASE = 'BASE CHART '.repeat(50);
const KEY = prefixKey(MODEL, SYSTEM, BASE);
const owner = { userId: 'u1', kundliId: 'k1' };
const ask = () => cacheNameFor(MODEL, SYSTEM, BASE, 'k', owner);

const env0 = { ...process.env };
let reg: ReturnType<typeof memoryCacheRegistry>;

function row(over: Partial<CacheRow> & { name: string }): CacheRow {
  const now = Date.now();
  return { provider: 'gemini', userId: 'u1', kundliId: 'k1', prefixHash: 'p', model: MODEL, createdAt: new Date(now), lastUsedAt: new Date(now), expiresAt: new Date(now + 1800_000), deletedAt: null, deleteError: null, ...over };
}
function seedCache(name: string, displayName: string | undefined, ageMs = 0): void {
  store.set(name, { name, displayName, createTime: new Date(Date.now() - ageMs).toISOString(), expireTime: new Date(Date.now() + 1800_000).toISOString() });
}

beforeEach(() => {
  Object.assign(process.env, { GEMINI_API_URL: 'http://gemini.test/v1beta/models', GEMINI_API_KEY: 'k', READING_EXPLICIT_CACHE: '1' });
  delete process.env.READING_EXPLICIT_CACHE_TTL_SECONDS;
  vi.stubGlobal('fetch', fakeFetch);
  store.clear();
  calls.length = 0;
  n = 0;
  clearPromptCache();
  reg = memoryCacheRegistry();
  setCacheRegistry(reg);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setCacheRegistry(undefined);
  for (const k of Object.keys(process.env)) if (!(k in env0)) delete process.env[k];
  Object.assign(process.env, env0);
});

async function createOne(): Promise<string> {
  expect(ask()).toBeNull(); // first use: registry lookup only
  await settlePromptCache();
  expect(ask()).toBeNull(); // second use: creation in the background
  await settlePromptCache();
  const name = ask();
  expect(name).toMatch(/^cachedContents\/c\d+$/);
  return name!;
}

describe('LLM cache lifecycle', () => {
  it('create uses a 30-minute TTL, sets displayName aiastra:<prefixHash> and records the owner in the registry', async () => {
    const name = await createOne();
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.body.ttl).toBe('1800s');
    expect(post.body.displayName).toBe(`aiastra:${KEY}`);
    expect(reg.rows.get(name)).toMatchObject({ provider: 'gemini', userId: 'u1', kundliId: 'k1', prefixHash: KEY, model: MODEL, deletedAt: null });
  });

  it('a hit with less than half the TTL left extends it (PATCH updateMask=ttl) and moves the registry expiry', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const name = await createOne();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false); // fresh: no extension
    const before = reg.rows.get(name)!.expiresAt.getTime();
    vi.setSystemTime(Date.now() + 1000_000); // 1000 s later: 800 s left < 900 s
    expect(ask()).toBe(name);
    await settlePromptCache();
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.path).toMatch(new RegExp(`/${name}$`));
    expect(patch.search).toContain('updateMask=ttl');
    expect(patch.body).toEqual({ ttl: '1800s' });
    expect(reg.rows.get(name)!.expiresAt.getTime()).toBeGreaterThan(before);
    expect(cacheStats.extended).toBe(1);
  });

  it('a second instance adopts the live registry row instead of creating another cache', async () => {
    const name = await createOne();
    clearPromptCache(); // a fresh Lambda instance: empty memory, same registry
    expect(ask()).toBeNull();
    await settlePromptCache();
    expect(ask()).toBe(name);
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(cacheStats.adopted).toBe(1);
  });

  it("logout deletes the user's caches (404 counts as deleted) and leaves other users' caches alone", async () => {
    seedCache('cachedContents/a', 'aiastra:a');
    await reg.record(row({ name: 'cachedContents/a' }));
    await reg.record(row({ name: 'cachedContents/gone' })); // already gone at Gemini → 404
    seedCache('cachedContents/b', 'aiastra:b');
    await reg.record(row({ name: 'cachedContents/b', userId: 'u2' }));
    const out = await deleteUserCaches('u1');
    expect(out).toEqual({ deleted: 2, failed: 0 });
    expect(reg.rows.get('cachedContents/a')!.deletedAt).not.toBeNull();
    expect(reg.rows.get('cachedContents/gone')!.deletedAt).not.toBeNull();
    expect(reg.rows.get('cachedContents/b')!.deletedAt).toBeNull();
    expect(store.has('cachedContents/a')).toBe(false);
    expect(store.has('cachedContents/b')).toBe(true);
  });

  it('logout also forgets the name in memory, so the next question goes uncached', async () => {
    await createOne();
    await deleteUserCaches('u1');
    expect(ask()).toBeNull();
  });

  it('the sweeper deletes idle caches and aiastra: orphans only', async () => {
    const now = Date.now();
    seedCache('cachedContents/idle', 'aiastra:idle', 3600_000);
    await reg.record(row({ name: 'cachedContents/idle', lastUsedAt: new Date(now - 40 * 60_000) }));
    seedCache('cachedContents/fresh', 'aiastra:fresh', 3600_000);
    await reg.record(row({ name: 'cachedContents/fresh' }));
    await reg.record(row({ name: 'cachedContents/expired', expiresAt: new Date(now - 1000) }));
    seedCache('cachedContents/orphan', 'aiastra:orphan', 10 * 60_000);
    seedCache('cachedContents/young-orphan', 'aiastra:young', 60_000); // its row may still be on the way
    seedCache('cachedContents/foreign', 'someone-else', 3600_000);
    seedCache('cachedContents/unnamed', undefined, 3600_000);
    const out = await sweepLlmCaches();
    expect(out).toMatchObject({ idleDeleted: 1, expiredMarked: 1, orphansDeleted: 1, failed: 0, reconciled: true });
    expect([...store.keys()].sort()).toEqual(['cachedContents/foreign', 'cachedContents/fresh', 'cachedContents/unnamed', 'cachedContents/young-orphan']);
    expect(reg.rows.get('cachedContents/idle')!.deletedAt).not.toBeNull();
    expect(reg.rows.get('cachedContents/expired')!.deletedAt).not.toBeNull();
    expect(reg.rows.get('cachedContents/fresh')!.deletedAt).toBeNull();
    expect(calls.some((c) => c.method === 'DELETE' && c.path.endsWith('/expired'))).toBe(false);
  });

  it('a failing registry never breaks the cache: logged once, memory only, and the sweeper skips the orphan reconcile', async () => {
    const boom = async () => {
      throw new Error('relation "llm_cache_entries" does not exist');
    };
    const broken = Object.fromEntries(Object.keys(memoryCacheRegistry()).filter((k) => k !== 'rows').map((k) => [k, boom])) as unknown as CacheRegistry;
    setCacheRegistry(broken);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const name = await createOne();
    expect(ask()).toBe(name);
    const registryWarnings = warn.mock.calls.filter((c) => String(c[0]).includes('registry unavailable'));
    expect(registryWarnings).toHaveLength(1);
    seedCache('cachedContents/orphan', 'aiastra:orphan', 3600_000);
    const out = await sweepLlmCaches();
    expect(out.reconciled).toBe(false);
    expect(store.has('cachedContents/orphan')).toBe(true);
    // logout still deletes what this instance knows about
    expect(await deleteUserCaches('u1')).toEqual({ deleted: 1, failed: 0 });
    warn.mockRestore();
  });

  it('is inert when the explicit cache is off', () => {
    delete process.env.READING_EXPLICIT_CACHE;
    expect(ask()).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('recognises only the scheduled sweep event, with the token when one is configured', () => {
    const ev = { source: 'aws.events', 'detail-type': 'Scheduled Event', detail: { task: 'llm-cache-sweep', token: 't' } };
    expect(isCacheSweepEvent(ev)).toBe(true);
    expect(isCacheSweepEvent({ ...ev, detail: { task: 'other' } })).toBe(false);
    expect(isCacheSweepEvent({ query: '{ me }' })).toBe(false);
    process.env.LLM_CACHE_SWEEP_TOKEN = 't';
    expect(isCacheSweepEvent(ev)).toBe(true);
    expect(isCacheSweepEvent({ ...ev, detail: { task: 'llm-cache-sweep' } })).toBe(false);
  });
});
