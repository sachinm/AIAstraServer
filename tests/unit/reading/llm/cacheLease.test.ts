/**
 * Doc 86: a build's explicit caches are deleted at the kundli's last lease release, a failed delete is queued for the
 * sweeper, an in-flight create is awaited before its delete, and a call whose cache is gone still answers (uncached).
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { acquireCacheLease, clearCacheLeases, isCacheLeased, leaseState, setLeaseDeleter, withCacheLease } from '../../../../src/reading/llm/cacheLease.js';
import { memoryCacheRegistry } from '../../../../src/reading/llm/cacheRegistry.js';
import { callGemini, streamGemini } from '../../../../src/reading/llm/gemini.js';
import { cacheNameFor, clearPromptCache, deleteCachesByKey, ensurePromptCache, prefixKey, setCacheRegistry, sweepLlmCaches } from '../../../../src/reading/llm/promptCache.js';

/** a small Gemini stand-in: creates, deletes (status set per test), and refuses a deleted cache with 403 */
interface Fake {
  url: string;
  creates: string[];
  deletes: string[];
  gone: Set<string>;
  deleteStatus: number;
  createDelayMs: number;
  generate: Array<{ cachedContent: string | null; stream: boolean }>;
  close: () => Promise<void>;
}
async function startFake(): Promise<Fake> {
  const f = { creates: [] as string[], deletes: [] as string[], gone: new Set<string>(), deleteStatus: 200, createDelayMs: 0, generate: [] as Fake['generate'] } as Fake;
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const url = req.url ?? '';
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const json = (status: number, o: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(o));
      };
      if (req.method === 'POST' && /\/cachedContents$/.test(url)) {
        await new Promise((r) => setTimeout(r, f.createDelayMs));
        const name = `cachedContents/c${f.creates.length + 1}`;
        f.creates.push(name);
        return json(200, { name, expireTime: new Date(Date.now() + 3600_000).toISOString(), usageMetadata: { totalTokenCount: 1234 } });
      }
      if (req.method === 'DELETE') {
        const name = url.replace(/^.*\/(cachedContents\/[^/?]+).*$/, '$1');
        f.deletes.push(name);
        if (f.deleteStatus === 200) f.gone.add(name);
        return json(f.deleteStatus, f.deleteStatus === 200 ? {} : { error: { message: 'boom' } });
      }
      if (req.method === 'GET' && /\/cachedContents/.test(url)) return json(200, { cachedContents: [] });
      const stream = /streamGenerateContent/.test(url);
      const cc: string | null = body.cachedContent ?? null;
      f.generate.push({ cachedContent: cc, stream });
      if (cc && f.gone.has(cc)) return json(403, { error: { message: 'CachedContent not found (or permission denied)' } });
      const usageMetadata = { promptTokenCount: 10, cachedContentTokenCount: cc ? 8 : 0, candidatesTokenCount: 3, thoughtsTokenCount: 0 };
      if (!stream) return json(200, { candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }], usageMetadata });
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }], usageMetadata })}\n\n`);
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  f.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1beta/models`;
  f.close = () =>
    new Promise<void>((r) => {
      server.close(() => r());
      server.closeAllConnections();
    });
  return f;
}

let fake: Fake;
const env0 = { ...process.env };
const owner = { userId: 'u1', kundliId: 'k1' };
const SYS = 'SYSTEM';
const BASE = 'PERSON PACK '.repeat(200);

beforeAll(async () => {
  fake = await startFake();
});
afterAll(async () => fake.close());
beforeEach(() => {
  Object.assign(process.env, { GEMINI_API_URL: fake.url, GEMINI_API_KEY: 'k', READING_EXPLICIT_CACHE: '1' });
  delete process.env.READING_CACHE_DELETE_AFTER_BUILD;
  Object.assign(fake, { creates: [], deletes: [], generate: [], deleteStatus: 200, createDelayMs: 0 });
  fake.gone.clear();
  clearPromptCache();
  clearCacheLeases();
  setLeaseDeleter(null);
  setCacheRegistry(memoryCacheRegistry());
});
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in env0)) delete process.env[k];
  Object.assign(process.env, env0);
  setLeaseDeleter(null);
});

describe('cache leases (doc 86)', () => {
  it('records the keys a build uses and deletes them only at the last release', async () => {
    const deleted: string[][] = [];
    setLeaseDeleter(async (keys) => (deleted.push(keys), { deleted: keys.length, failed: 0 }));
    const chat = acquireCacheLease(owner, 'card.chat');
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    const build = withCacheLease(owner, 'build.v3', async () => {
      cacheNameFor('m', SYS, BASE, 'k', owner);
      await held;
    });
    await new Promise((r) => setTimeout(r, 5));
    expect(leaseState('k1')).toMatchObject({ count: 2, keys: [prefixKey('m', SYS, BASE)] });
    release();
    await build;
    expect(deleted).toEqual([]); // the chat still holds its lease
    expect(isCacheLeased('k1')).toBe(true);
    await chat.release();
    expect(deleted).toEqual([[prefixKey('m', SYS, BASE)]]);
    expect(isCacheLeased('k1')).toBe(false);
    expect(await chat.release()).toBeNull(); // idempotent
  });

  it('keys used outside a recording lease are not recorded (another operation, a card chat)', async () => {
    const deleted: string[][] = [];
    setLeaseDeleter(async (keys) => (deleted.push(keys), { deleted: keys.length, failed: 0 }));
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    const build = withCacheLease(owner, 'build.v3', async () => {
      cacheNameFor('m', SYS, 'BUILD ONLY', 'k', owner);
      await held;
    });
    await new Promise((r) => setTimeout(r, 5));
    cacheNameFor('m', SYS, 'ASK FLOW, SAME PERSON', 'k', owner); // not inside the build's call tree
    await withCacheLease(owner, 'card.chat', async () => void cacheNameFor('m', SYS, 'CHAT', 'k', owner), { record: false });
    release();
    await build;
    expect(deleted).toEqual([[prefixKey('m', SYS, 'BUILD ONLY')]]);
  });

  it('READING_CACHE_DELETE_AFTER_BUILD=0 records and deletes nothing', async () => {
    process.env.READING_CACHE_DELETE_AFTER_BUILD = '0';
    const deleted: string[][] = [];
    setLeaseDeleter(async (keys) => (deleted.push(keys), { deleted: keys.length, failed: 0 }));
    await withCacheLease(owner, 'build.v3', async () => void cacheNameFor('m', SYS, BASE, 'k', owner));
    expect(deleted).toEqual([]);
  });

  it('a real release deletes the cache at the provider and marks its row; an in-flight create is awaited first', async () => {
    const reg = memoryCacheRegistry();
    setCacheRegistry(reg);
    fake.createDelayMs = 60;
    let name: string | null = null;
    await withCacheLease(owner, 'build.v3', async () => {
      void ensurePromptCache('m', SYS, BASE, owner).then((n) => (name = n));
      await new Promise((r) => setTimeout(r, 5)); // the build ends while the create is still on the wire
    });
    expect(name).toBe('cachedContents/c1');
    expect(fake.deletes).toEqual(['cachedContents/c1']);
    expect(reg.rows.get('cachedContents/c1')!.deletedAt).not.toBeNull();
  });

  it('a failed delete keeps the row live, marks it for the next sweep, and the sweep deletes it', async () => {
    const reg = memoryCacheRegistry();
    setCacheRegistry(reg);
    const name = await ensurePromptCache('m', SYS, BASE, owner);
    fake.deleteStatus = 500;
    const r = await deleteCachesByKey([prefixKey('m', SYS, BASE)]);
    expect(r).toMatchObject({ deleted: 0, failed: 1 });
    const row = reg.rows.get(name!)!;
    expect(row.deletedAt).toBeNull();
    expect(row.deleteError).toMatch(/500/);
    expect(row.lastUsedAt.getTime()).toBe(0);
    fake.deleteStatus = 200;
    const s = await sweepLlmCaches({ idleMs: 45 * 60_000 });
    expect(s.idleDeleted).toBe(1);
    expect(reg.rows.get(name!)!.deletedAt).not.toBeNull();
  });
});

describe('a call whose cache was deleted still answers (doc 86, card chat)', () => {
  const o = (stream: boolean) => ({ model: 'm', node: stream ? 'card.chat.self' : 't', system: SYS, parts: [BASE, 'question'], cachePrefix: true, cacheOwner: owner, cacheCreate: false, thinking: 'off' as const, maxOutputTokens: 50 });

  it('cacheCreate false never starts a create, however often the prefix is used', async () => {
    for (let i = 0; i < 3; i++) await callGemini(o(false));
    await new Promise((r) => setTimeout(r, 20));
    expect(fake.creates).toEqual([]);
    expect(fake.generate.every((g) => g.cachedContent === null)).toBe(true);
  });

  it('call and stream paths: a cache deleted elsewhere is refused (403) and the call is retried uncached', async () => {
    const name = await ensurePromptCache('m', SYS, BASE, owner);
    fake.gone.add(name!); // deleted by another instance: this instance still thinks it is live
    const a = await callGemini(o(false));
    expect(a.text).toBe('ok');
    const name2 = await ensurePromptCache('m', SYS, BASE, owner);
    fake.gone.add(name2!);
    const b = await streamGemini(o(true));
    expect(b.text).toBe('ok');
    const refused = fake.generate.filter((g) => g.cachedContent);
    expect(refused.length).toBe(2);
    expect(fake.generate.filter((g) => !g.cachedContent).length).toBe(2);
  });
});
