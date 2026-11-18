/**
 * Doc 83 step 1 (2026-11-18): the you board is served by its v3 cards. With SELF_V3_BUILD=1 the v3 step runs whenever
 * the Oracle served, even when the v2 Personalizer did not; a build whose v3 step stored cards is `ok` (marker `ready`),
 * and the stored latest reads `ok` without v2 cards. Every model call is mocked; the v3 step is a fake.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPendingIndividualRecycles } from '../../../../../src/reading/llm/cacheSweep.js';
import { clearReaderMemo } from '../../../../../src/reading/oracle/prewarm.js';
import { runSelfV2Build } from '../../../../../src/reading/self/v2/build.js';
import { readSelfV2Latest } from '../../../../../src/reading/self/v2/store.js';
import type { SelfV3StepResult } from '../../../../../src/reading/self/v3/build.js';
import { makeGemini, makePrisma, makeSubs } from './fixtures.js';

const v3Result = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('../../../../../src/reading/self/v3/build.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../../src/reading/self/v3/build.js')>();
  return { ...real, runSelfV3Cards: vi.fn(async () => v3Result.value) };
});

const fakeV3 = (over: Partial<SelfV3StepResult> = {}): SelfV3StepResult => ({
  status: 'ok',
  cards: { body: {} as never, mind: {} as never, stuck: {} as never },
  frame: null,
  agents: [],
  issues: [],
  gaps: [],
  cached: false,
  stored: true,
  key: 'self.v3.cards|test',
  ms: { total: 1 },
  ...over,
});

const ENV = {
  READING_EXPLICIT_CACHE: '1',
  READING_MODEL_READER: 'gemini-3.1-flash-lite',
  READING_MODEL_ORACLE: 'gemini-3.8-flash',
  SELF_PERSONALIZER_MODEL: 'gemini-3.1-flash-lite',
  SELF_READING_MAX_SPEND_USD: '1',
  SELF_V3_BUILD: '1',
} as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  clearReaderMemo();
  clearPendingIndividualRecycles();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => {
  for (const k of Object.keys(ENV)) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  clearReaderMemo();
  clearPendingIndividualRecycles();
  vi.restoreAllMocks();
});

const NOW = () => new Date('2026-11-09T12:00:00Z');
/** the v2 Personalizer answers with text that is not its document: it fails */
const brokenPersonalizer = () => 'not a document';
const build = (db: ReturnType<typeof makePrisma>, log: string[]) =>
  runSelfV2Build(
    { prisma: db.prisma, callGemini: makeGemini(log, { personal: brokenPersonalizer }), ensureCache: vi.fn(async () => 'cachedContents/mock'), informUsed: vi.fn(), now: NOW },
    { userId: 'u-v2', kundliId: 'k-v2', asOf: '2026-11-09', subs: makeSubs() } as never,
  );

describe('doc 83 step 1: v3 cards serve the board when the v2 Personalizer fails', () => {
  it('the v2 Personalizer fails, the v3 step stores cards: the build is ok, the marker ready, the latest ok', async () => {
    v3Result.value = fakeV3();
    const db = makePrisma();
    const log: string[] = [];
    const r = await build(db, log);
    expect(log).toContain('call:self.personalizer');
    expect(r.cards?.status).not.toBe('ok');
    expect(r.stored.cards).toBe(false);
    expect(r.v3).toMatchObject({ status: 'ok', cards: 3 });
    expect(r.status).toBe('ok');
    expect(r.gaps).toEqual(expect.arrayContaining([expect.stringMatching(/^v2 cards did not serve \(\w+\); the board is served by 3 v3 cards$/)]));
    const latest = await readSelfV2Latest(db.prisma, 'k-v2');
    expect(latest.cards).toBeNull();
    expect(latest.status).toBe('ok');
  });

  it('the v2 Personalizer fails and the v3 step stores no cards: the build is not ok and the latest is failed', async () => {
    v3Result.value = fakeV3({ status: 'failed', cards: {}, stored: false });
    const db = makePrisma();
    const r = await build(db, []);
    expect(r.status).not.toBe('ok');
    expect(r.gaps.some((g) => /the board is served by/.test(g))).toBe(false);
    expect((await readSelfV2Latest(db.prisma, 'k-v2')).status).toBe('failed');
  });
});
