/**
 * Plan "retire the v2 Self reading", server step 3 (SELF_V2_RETIRED=1 with the per-card reading on): the Self build runs
 * the family readers and then the card step over the natal context. No v2 Oracle, no v2 Personalizer: no
 * `self.oracle.v2.*` or `self.personalizer` call and no `self.v2.oracle` / `self.v2.personalizer` row. The card step
 * gets the natal prefix byte for byte, the seven findings and a portrait without the v2 paragraph ids. Its progress is
 * written on the existing stage names. Statuses: ok when a card was read, preparing (marker ready, never failed) when the
 * board is not ready to read, and a fresh reading counts only a card read now. Every model call is mocked; the card
 * step is a fake.
 */
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPendingIndividualRecycles } from '../../../../../src/reading/llm/cacheSweep.js';
import { clearReaderMemo } from '../../../../../src/reading/oracle/prewarm.js';
import { runSelfV2Build, retiredStatus } from '../../../../../src/reading/self/v2/build.js';
import { runSelfReadingBuild } from '../../../../../src/reading/self/buildEvent.js';
import type { SelfReadingResult } from '../../../../../src/reading/self/service.js';
import type { SelfV3StepDeps, SelfV3StepInput, SelfV3StepResult } from '../../../../../src/reading/self/v3/build.js';
import { portraitLines } from '../../../../../src/reading/person/portrait.js';
import { makeGemini, makePrisma, makeSubs } from './fixtures.js';

const seen = vi.hoisted(() => ({ calls: [] as Array<{ deps: unknown; input: unknown }>, result: null as unknown }));
vi.mock('../../../../../src/reading/self/v3/build.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../../src/reading/self/v3/build.js')>();
  return {
    ...real,
    runSelfV3Cards: vi.fn(async (deps: SelfV3StepDeps, input: SelfV3StepInput) => {
      seen.calls.push({ deps, input });
      deps.onStage?.('clocks');
      deps.onStage?.('cards');
      return seen.result;
    }),
  };
});

const fakeV3 = (over: Partial<SelfV3StepResult> = {}): SelfV3StepResult => ({
  status: 'ok',
  cards: { mind: {} as never, body: {} as never },
  frame: null,
  agents: [],
  issues: [],
  gaps: [],
  cached: false,
  stored: true,
  key: null,
  ms: { total: 1 },
  cardsRun: { order: ['mind', 'body'], spentUsd: 0.05, capReached: false, results: [{ card: 'mind', status: 'ok' }, { card: 'body', status: 'cached' }] },
  ...over,
});

const ENV = {
  READING_EXPLICIT_CACHE: '1',
  READING_MODEL_READER: 'gemini-3.1-flash-lite',
  READING_MODEL_ORACLE: 'gemini-3.8-flash',
  SELF_PERSONALIZER_MODEL: 'gemini-3.1-flash-lite',
  READING_SPEND_CAP_USD: '1',
  SELF_V3_BUILD: '1',
  READING_CLOCK_LAYER: '1',
  SELF_V2_RETIRED: '1',
} as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  seen.calls = [];
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

const NOW = () => new Date('2026-11-19T12:00:00Z');
/** the natal prefix of the v2 agent fixtures, pinned in tests/unit/reading/slices/natalPrefixPin.test.ts */
const PREFIX_SHA256 = '11931c46e30e3d114c46e45752622e68289994bd6e4c494aa32f35359b0a9eda';

const build = (db: ReturnType<typeof makePrisma>, log: string[], steps: string[] = [], args: Record<string, unknown> = {}) => {
  const ensureCache = vi.fn(async () => 'cachedContents/mock');
  const done = runSelfV2Build(
    { prisma: db.prisma, callGemini: makeGemini(log), ensureCache, informUsed: vi.fn(), now: NOW, onStep: (s) => steps.push(s) },
    { userId: 'u-v2', kundliId: 'k-v2', asOf: '2026-11-19', subs: makeSubs(), ...args } as never,
  );
  return { done, ensureCache };
};

describe('SELF_V2_RETIRED=1: the Self build without the v2 Oracle and Personalizer', () => {
  it('runs the seven family readers and the card step only; no v2 Oracle, v2 Personalizer or v2 row', async () => {
    seen.result = fakeV3();
    const db = makePrisma();
    const log: string[] = [];
    const steps: string[] = [];
    const { done } = build(db, log, steps);
    const r = await done;
    expect(r.status).toBe('ok');
    expect(log.length).toBe(7);
    expect(log.every((c) => c.startsWith('call:family.'))).toBe(true);
    expect(log.some((c) => /self\.oracle|self\.personalizer|self\.v2/.test(c))).toBe(false);
    expect(r.oracle).toBeNull();
    expect(r.cards).toBeNull();
    expect(r.v3).toMatchObject({ status: 'ok', cards: 2 });
    const techniques = [...db.outputs.values()].map((o) => String(o.technique_id));
    expect(techniques).not.toContain('self.v2.oracle');
    expect(techniques).not.toContain('self.v2.personalizer');
    // the card step is the reading: called once, over the natal context (not the v2 Oracle slice)
    expect(seen.calls).toHaveLength(1);
    const input = seen.calls[0]!.input as SelfV3StepInput;
    expect(input.oracleSlice).toBeUndefined();
    expect(createHash('sha256').update(input.natal!.prefix).digest('hex')).toBe(PREFIX_SHA256);
    expect(input.natal!.model).toBe('gemini-3.8-flash');
    expect(input.findings).toHaveLength(7);
    // the portrait without the v2 Oracle: mind keys only, no dangling paragraph ids or patterns
    expect(input.portrait?.personality).toEqual({ mindKeys: { feeling: ['planet:D1.Mo'], thinking: ['planet:D1.Me'], peace: ['house:D1.h4'], judgement: ['house:D1.h5'] } });
    const lines = portraitLines(input.portrait!).join('\n');
    expect(lines).not.toMatch(/Oracle paragraphs|lagna\.p1|pattern:/);
    expect(lines).toContain('- character:\n  - mind keys: feeling 1, thinking 1, peace 1, judgement 1');
    // the card step's progress on the existing stage names
    expect(steps).toEqual(['subs', 'briefs', 'slices', 'warm', 'families', 'oracle', 'personalizer']);
    // the marker: ready, with the time a card was read (the board's builtAt)
    const marker = db.builds.get('k-v2|self.v2') as { status: string; result: { read_at?: string; stage?: string } };
    expect(marker.status).toBe('ready');
    expect(marker.result.stage).toBe('personalizer');
    expect(typeof marker.result.read_at).toBe('string');
  });

  it('does not warm the v2 Oracle system prompt (only the seven family prefixes)', async () => {
    seen.result = fakeV3();
    const db = makePrisma();
    const { done, ensureCache } = build(db, []);
    const r = await done;
    expect(r.warmed).toHaveLength(7);
    expect(r.warmed.every((w) => w.agent.startsWith('family.'))).toBe(true);
    expect(ensureCache).toHaveBeenCalledTimes(7);
  });

  it('a board not ready to read (fewer than CARDS_READ_MIN cards, no ledger) is preparing: marker ready, no read time', async () => {
    seen.result = fakeV3({ status: 'skipped', cards: {}, stored: false, cardsRun: undefined, gaps: ['cards: the board holds 2 cards (5 start the reading) and none was asked for; nothing read'] });
    const db = makePrisma();
    const r = await build(db, []).done;
    expect(r.status).toBe('preparing');
    const marker = db.builds.get('k-v2|self.v2') as { status: string; result: { read_at?: string } };
    expect(marker.status).toBe('ready');
    expect(marker.result.read_at).toBeUndefined();
  });

  it('a later build the same day that reads no card keeps the earlier read time (builtAt never moves back)', async () => {
    seen.result = fakeV3({ status: 'skipped', cards: {}, stored: false, cardsRun: undefined });
    const db = makePrisma();
    db.builds.set('k-v2|self.v2', { status: 'ready', result: { started_at: '2026-11-19T08:00:00.000Z', stage: 'personalizer', read_at: '2026-11-19T08:05:00.000Z' } });
    (db.prisma as unknown as { areaBuild: { findUnique: (q: { where: { kundli_id_area_as_of: { kundli_id: string; area: string } } }) => Promise<unknown> } }).areaBuild.findUnique = async ({ where }) =>
      db.builds.get(`${where.kundli_id_area_as_of.kundli_id}|${where.kundli_id_area_as_of.area}`) ?? null;
    const r = await build(db, []).done;
    expect(r.status).toBe('preparing');
    expect((db.builds.get('k-v2|self.v2') as { result: { read_at?: string } }).result.read_at).toBe('2026-11-19T08:05:00.000Z');
  });

  it('a failed card step fails the build (marker failed)', async () => {
    seen.result = fakeV3({ status: 'failed', cards: {}, stored: false, cardsRun: { order: ['mind'], spentUsd: 0, capReached: false, results: [{ card: 'mind', status: 'failed' }] } });
    const db = makePrisma();
    const r = await build(db, []).done;
    expect(r.status).toBe('failed');
    expect((db.builds.get('k-v2|self.v2') as { status: string }).status).toBe('failed');
  });

  it('flag off (retired: false): the v2 Oracle and Personalizer still run', async () => {
    seen.result = fakeV3();
    const db = makePrisma();
    const log: string[] = [];
    await runSelfV2Build(
      { prisma: db.prisma, callGemini: makeGemini(log), ensureCache: vi.fn(async () => 'cachedContents/mock'), informUsed: vi.fn(), now: NOW, retired: false },
      { userId: 'u-v2', kundliId: 'k-v2', asOf: '2026-11-19', subs: makeSubs() } as never,
    );
    expect(log.some((c) => c.startsWith('call:self.oracle.v2'))).toBe(true);
    expect(log).toContain('call:self.personalizer');
    expect((seen.calls[0]!.input as SelfV3StepInput).oracleSlice).toBeDefined();
  });
});

describe('retiredStatus', () => {
  const results = (...s: string[]) => ({ order: [], spentUsd: 0, capReached: false, results: s.map((status, i) => ({ card: `c${i}` as never, status })) });
  it('a first reading is ok when cards are served, cached ones too; a fresh reading only when a card was read now', () => {
    const cachedOnly = { status: 'ok' as const, cards: { mind: {} as never }, cardsRun: results('cached') };
    expect(retiredStatus(cachedOnly, false)).toBe('ok');
    expect(retiredStatus(cachedOnly, true)).toBe('failed');
    expect(retiredStatus({ ...cachedOnly, cardsRun: results('cached', 'ok') }, true)).toBe('ok');
  });
  it('skipped is preparing; a cap with nothing read is budget_exceeded', () => {
    expect(retiredStatus({ status: 'skipped', cards: {}, cardsRun: undefined }, false)).toBe('preparing');
    expect(retiredStatus({ status: 'budget_exceeded', cards: {}, cardsRun: results('skipped_cap') }, false)).toBe('budget_exceeded');
    expect(retiredStatus({ status: 'budget_exceeded', cards: {}, cardsRun: results('skipped_cap') }, true)).toBe('budget_exceeded');
  });
});

describe('the build event with the v2 reading retired', () => {
  const reading = { status: 'ok', built_at: '2026-11-19', cached: false, reading: { asOf: '2026-11-19', panels: [], oracle: { status: 'ok', cached: false } } } as unknown as SelfReadingResult;
  const savedEnv = { v2: process.env.SELF_V2_BUILD, model: process.env.SELF_READING_MODEL };
  beforeEach(() => {
    process.env.SELF_V2_BUILD = '1';
    process.env.SELF_READING_MODEL = '1';
  });
  afterEach(() => {
    for (const [k, v] of [['SELF_V2_BUILD', savedEnv.v2], ['SELF_READING_MODEL', savedEnv.model]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
  const run = async (status: string, refreshDay?: string) => {
    const writes: Array<{ status: string }> = [];
    const prisma = { areaBuild: { findUnique: async () => null, upsert: async (q: { update: { status: string } }) => void writes.push(q.update) } } as never;
    const settleBoardRefresh = vi.fn(async () => undefined as never);
    await runSelfReadingBuild({ prisma, build: async () => reading, now: NOW, gate: { settleBoardRefresh }, v2Build: async () => ({ status }), lensGate: { settleLensRefresh: async () => undefined } as never }, 'u1', 'k1', 'self', refreshDay ? { refreshDay } : {});
    return { marker: writes[writes.length - 1]?.status, settleBoardRefresh };
  };

  it('preparing (no card read yet) marks the board ready, never failed; a card read commits a fresh reading; nothing read gives it back', async () => {
    expect((await run('preparing')).marker).toBe('ready');
    const ok = await run('ok', '2026-11-19');
    expect(ok.marker).toBe('ready');
    expect(ok.settleBoardRefresh).toHaveBeenCalledWith('u1', 'self', '2026-11-19', true);
    const none = await run('failed', '2026-11-19');
    expect(none.marker).toBe('failed');
    expect(none.settleBoardRefresh).toHaveBeenCalledWith('u1', 'self', '2026-11-19', false);
  });
});
