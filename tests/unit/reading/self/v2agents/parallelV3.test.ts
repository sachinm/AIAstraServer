/**
 * 2026-11-19: the v2 Personalizer and the v3 step run side by side after the portrait is built. The v3 step starts
 * before the Personalizer ends; the two share one budget (READING_SPEND_CAP_USD): while the Personalizer is in flight it
 * holds its upper-bound cost, and the v3 step's `maxSpendUsd` (read live) is the cap less the spend before the fork and
 * that hold. Outcome rules are unchanged (doc 83 step 1). Every model call is mocked; the v3 step is a fake.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeminiCallOptions, GeminiResult } from '../../../../../src/reading/llm/gemini.js';
import { clearPendingIndividualRecycles } from '../../../../../src/reading/llm/cacheSweep.js';
import { clearReaderMemo } from '../../../../../src/reading/oracle/prewarm.js';
import { personalizerHoldUsd, runSelfV2Build } from '../../../../../src/reading/self/v2/build.js';
import type { SelfV3StepDeps, SelfV3StepInput, SelfV3StepResult } from '../../../../../src/reading/self/v3/build.js';
import { makeGemini, makePrisma, makeSubs } from './fixtures.js';

type FakeV3 = (deps: SelfV3StepDeps, i: SelfV3StepInput) => Promise<SelfV3StepResult>;
const v3Impl = vi.hoisted(() => ({ fn: null as unknown as FakeV3 }));
vi.mock('../../../../../src/reading/self/v3/build.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../../src/reading/self/v3/build.js')>();
  return { ...real, runSelfV3Cards: vi.fn((deps: SelfV3StepDeps, i: SelfV3StepInput) => v3Impl.fn(deps, i)) };
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

const timing = (costUsd: number) => ({ agent: 'v3.card', call: 'v3.card', status: 'ok', ms: 1, promptTokens: 0, cachedTokens: 0, outputTokens: 0, thoughtTokens: 0, costUsd }) as unknown as SelfV3StepResult['agents'][number];

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

const ENV = {
  READING_EXPLICIT_CACHE: '1',
  READING_MODEL_READER: 'gemini-3.1-flash-lite',
  READING_MODEL_ORACLE: 'gemini-3.8-flash',
  SELF_PERSONALIZER_MODEL: 'gemini-3.8-flash',
  READING_SPEND_CAP_USD: '1',
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
const ARGS = { userId: 'u-v2', kundliId: 'k-v2', asOf: '2026-11-09' };

/** makeGemini, with the Personalizer's call held until `gate` resolves (or 2 s pass, so a sequential build cannot hang) */
function heldGemini(log: string[], gate: Promise<void>, opts: Parameters<typeof makeGemini>[1] = {}) {
  const base = makeGemini(log, opts);
  const state = { personalizerStarted: false, personalizerDone: false };
  const call = async (o: GeminiCallOptions): Promise<GeminiResult> => {
    if (o.node !== 'self.personalizer') return base(o);
    state.personalizerStarted = true;
    await Promise.race([gate, tick(2000)]);
    try {
      return await base(o);
    } finally {
      state.personalizerDone = true;
    }
  };
  return { call, state };
}

describe('the v2 Personalizer and the v3 step run side by side', () => {
  it('the v3 step starts before the Personalizer finishes', async () => {
    const gate = deferred();
    const log: string[] = [];
    const { call, state } = heldGemini(log, gate.promise);
    let personalizerDoneAtV3Start: boolean | null = null;
    v3Impl.fn = async () => {
      personalizerDoneAtV3Start = state.personalizerDone;
      // let the Personalizer reach its call, then release it
      for (let n = 0; n < 100 && !state.personalizerStarted; n++) await tick();
      gate.resolve();
      return fakeV3();
    };
    const steps: string[] = [];
    const r = await runSelfV2Build({ prisma: makePrisma().prisma, callGemini: call, ensureCache: vi.fn(async () => 'cachedContents/mock'), informUsed: vi.fn(), now: NOW, onStep: (s) => steps.push(s) }, { ...ARGS, subs: makeSubs() } as never);
    expect(personalizerDoneAtV3Start).toBe(false);
    expect(state.personalizerDone).toBe(true);
    expect(r.status).toBe('ok');
    expect(r.cards?.status).toBe('ok');
    expect(r.stored.cards).toBe(true);
    expect(r.v3).toMatchObject({ status: 'ok', cards: 3 });
    // every stage still reported; v3 now starts beside the Personalizer
    expect(steps).toEqual(expect.arrayContaining(['oracle.validated', 'v3', 'warm.personalizer', 'personalizer', 'personalizer.validated']));
    expect(steps.indexOf('v3')).toBeLessThan(steps.indexOf('personalizer.validated'));
    expect(typeof r.ms.personalizerStep).toBe('number');
    expect(typeof r.ms.v3).toBe('number');
    expect(r.agents.some((a) => a.agent === 'self.personalizer')).toBe(true);
  });

  it('the total spend never passes the cap: the v3 step spends everything it is given while the Personalizer is in flight', async () => {
    const gate = deferred();
    const log: string[] = [];
    // every call costs: 3.8-flash for the Oracle and the Personalizer, 6,000 output tokens each
    const { call, state } = heldGemini(log, gate.promise, { cost: { promptTokens: 20_000, cachedTokens: 0, outputTokens: 6_000 } });
    const cap = 0.45;
    const seen: number[] = [];
    v3Impl.fn = async (deps) => {
      for (let n = 0; n < 100 && !state.personalizerStarted; n++) await tick();
      // the budget while the Personalizer is held: spend all of it
      const held = deps.maxSpendUsd;
      seen.push(held);
      gate.resolve();
      // once the Personalizer is done its hold becomes its real cost: the rest of the cap is given back
      for (let n = 0; n < 200 && !state.personalizerDone; n++) await tick();
      await tick(20);
      const after = deps.maxSpendUsd;
      seen.push(after);
      return fakeV3({ agents: [timing(held), timing(Math.max(0, after - held))] });
    };
    const r = await runSelfV2Build({ prisma: makePrisma().prisma, callGemini: call, ensureCache: vi.fn(async () => 'cachedContents/mock'), informUsed: vi.fn(), now: NOW, maxSpendUsd: cap }, { ...ARGS, subs: makeSubs() } as never);
    const total = r.agents.reduce((n, a) => n + a.costUsd, 0);
    const personalizer = r.agents.find((a) => a.agent === 'self.personalizer')!.costUsd;
    const before = r.agents.filter((a) => a.agent !== 'self.personalizer' && a.agent !== ('v3.card' as never)).reduce((n, a) => n + a.costUsd, 0);
    expect(personalizer).toBeGreaterThan(0);
    expect(before).toBeLessThan(cap);
    // while held: the cap less the spend before the fork and the Personalizer's upper bound
    expect(seen[0]).toBeGreaterThan(0);
    expect(seen[0]! + before + personalizer).toBeLessThanOrEqual(cap + 1e-6);
    // after: the hold is released down to the real cost, and the whole build lands on the cap, never above it
    expect(seen[1]!).toBeGreaterThan(seen[0]!);
    expect(total).toBeLessThanOrEqual(cap + 1e-6);
    expect(total).toBeGreaterThan(cap - 1e-3);
  });

  it('the Personalizer hold is its upper bound: both calls uncached and both output caps', () => {
    const hold = personalizerHoldUsd({ model: 'gemini-3.8-flash', estTokens: { prefix: 10_000, suffix: 2_000 } });
    // 24,000 prompt tokens at 0.75/M + (12,000 + 16,000) output at 3.75/M
    expect(hold).toBeCloseTo(0.018 + 0.105, 6);
  });

  it('a Personalizer that throws still lets the v3 cards make the build ok', async () => {
    const base = makeGemini([]);
    const call = async (o: GeminiCallOptions) => {
      if (o.node === 'self.personalizer') throw new Error('mock personalizer timeout');
      return base(o);
    };
    v3Impl.fn = async () => fakeV3();
    const r = await runSelfV2Build({ prisma: makePrisma().prisma, callGemini: call, ensureCache: vi.fn(async () => 'cachedContents/mock'), informUsed: vi.fn(), now: NOW }, { ...ARGS, subs: makeSubs() } as never);
    expect(r.cards?.status).toBe('failed');
    expect(r.stored.cards).toBe(false);
    expect(r.status).toBe('ok');
    expect(r.gaps).toEqual(expect.arrayContaining([expect.stringMatching(/^v2 cards did not serve \(failed\); the board is served by 3 v3 cards$/)]));
  });

  it('a v3 failure (failed result or a throw) leaves the v2 result as it was', async () => {
    const run = async () =>
      runSelfV2Build({ prisma: makePrisma().prisma, callGemini: makeGemini([]), ensureCache: vi.fn(async () => 'cachedContents/mock'), informUsed: vi.fn(), now: NOW }, { ...ARGS, subs: makeSubs() } as never);

    v3Impl.fn = async () => fakeV3({ status: 'failed', cards: {}, stored: false, gaps: ['v3: mock failure'] });
    const failed = await run();
    expect(failed.status).toBe('ok');
    expect(failed.cards?.status).toBe('ok');
    expect(failed.stored).toEqual({ oracle: true, cards: true });
    expect(failed.v3).toMatchObject({ status: 'failed', cards: 0 });
    expect(failed.gaps).toContain('v3: mock failure');

    clearReaderMemo();
    v3Impl.fn = async () => {
      throw new Error('mock v3 crash');
    };
    const threw = await run();
    expect(threw.status).toBe('ok');
    expect(threw.cards?.status).toBe('ok');
    expect(threw.stored).toEqual({ oracle: true, cards: true });
    expect(threw.v3).toBeUndefined();
    expect(threw.gaps).toContain('v3: mock v3 crash');
  });
});
