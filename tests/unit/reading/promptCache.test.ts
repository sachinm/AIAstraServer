import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { callGemini } from '../../../src/reading/llm/gemini.js';
import { buildRequestBody } from '../../../src/reading/llm/gemini.js';
import { cacheStats, clearPromptCache, settlePromptCache, prefixKey, setCacheRegistry } from '../../../src/reading/llm/promptCache.js';
import { memoryCacheRegistry } from '../../../src/reading/llm/cacheRegistry.js';
import { startFakeGemini, type FakeGemini } from '../../helpers/fakeGemini.js';

let fake: FakeGemini;
const env0 = { ...process.env };
beforeAll(async () => {
  fake = await startFakeGemini();
});
afterAll(async () => fake.close());
beforeEach(() => {
  Object.assign(process.env, { GEMINI_API_URL: fake.url, GEMINI_API_KEY: 'k' });
  fake.reset();
  clearPromptCache();
  setCacheRegistry(memoryCacheRegistry());
});
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in env0)) delete process.env[k];
  Object.assign(process.env, env0);
});

const call = (base = 'BASE CHART '.repeat(400)) => callGemini({ model: 'gemini-2.5-flash', node: 't', system: 'SYSTEM', parts: [base, 'subject part', 'question'], cachePrefix: true, thinking: 'off', maxOutputTokens: 50 });

describe('explicit prompt cache', () => {
  it('is off by default: no cache created, full prompt sent', async () => {
    await call();
    await call();
    expect(fake.cacheCreates).toHaveLength(0);
    expect(fake.requests.every((r) => !r.body.cachedContent && r.body.systemInstruction)).toBe(true);
  });

  it('when on, the prefix is cached on its second use and later calls send only the rest', async () => {
    process.env.READING_EXPLICIT_CACHE = '1';
    await call(); // first use: uncached
    await call(); // second use: still uncached, creation starts in the background
    await settlePromptCache();
    expect(fake.cacheCreates).toHaveLength(1);
    const created = fake.cacheCreates[0] as { model: string; systemInstruction: unknown; contents: Array<{ parts: Array<{ text: string }> }>; ttl: string };
    expect(created.model).toBe('models/gemini-2.5-flash');
    expect(created.contents[0]!.parts[0]!.text).toMatch(/^BASE CHART/);
    expect(created.ttl).toBe('1800s');
    const r = await call(); // third use: served from the cache
    const last = fake.requests.at(-1)!.body;
    expect(last.cachedContent).toBe('cachedContents/fake-1');
    expect(last.systemInstruction).toBeUndefined();
    expect(last.contents[0].parts.map((p: { text: string }) => p.text)).toEqual(['subject part', 'question']);
    expect(r.usage.cachedTokens).toBe(3000);
    expect(cacheStats.hits).toBe(1);
  });

  it('different users (different base charts) get different cache entries', () => {
    expect(prefixKey('m', 's', 'chart A')).not.toBe(prefixKey('m', 's', 'chart B'));
    expect(prefixKey('m', 's', 'chart A')).toBe(prefixKey('m', 's', 'chart A'));
  });

  it('calls without cachePrefix are never cached', async () => {
    process.env.READING_EXPLICIT_CACHE = '1';
    for (let i = 0; i < 3; i++) await callGemini({ model: 'gemini-2.5-flash', node: 't', system: 'S', parts: ['a', 'b'], thinking: 'off' });
    await settlePromptCache();
    expect(fake.cacheCreates).toHaveLength(0);
  });

  it('the request body moves system and first part into the cache reference', () => {
    const body = buildRequestBody({ model: 'm', node: 'n', system: 'S', parts: ['base', 'rest'] }, 'cachedContents/x');
    expect(body).toMatchObject({ cachedContent: 'cachedContents/x', contents: [{ role: 'user', parts: [{ text: 'rest' }] }] });
    expect(body.systemInstruction).toBeUndefined();
  });
});
