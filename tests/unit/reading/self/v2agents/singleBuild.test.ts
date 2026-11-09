/**
 * One build pays once (docs/TODOS.md "Every build pays twice when SELF_V2_BUILD=1"): with the v2 build owning the You
 * board, the self build event and a self refresh make no v1 model call (the v1 code panels still run, from fixtures),
 * the board's dates come from the v2 Oracle document, the question is committed on a v2 ok and given back otherwise, and
 * a retry the same day after a failure is not held back and gets its own v2 key. Every model call is a mock.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { digestView } from '../../../../../src/reading/digest/load.js';
import type { ActivationRow } from '../../../../../src/reading/digest/activation.js';
import { callGemini } from '../../../../../src/reading/llm/gemini.js';
import { queueSelfReadingBuild, readBuildMarker, runSelfReadingBuild } from '../../../../../src/reading/self/buildEvent.js';
import { selfBoardDates, selfV2OwnsBoard } from '../../../../../src/reading/self/synthesisValidity.js';
import { oracleStoreKey } from '../../../../../src/reading/self/v2/build.js';

vi.mock('../../../../../src/reading/llm/gemini.js', () => ({
  callGemini: vi.fn(async () => ({
    text: '- Confirmed Jupiter in 7th {planet:D1.Ju}\n\nVALID_UNTIL:\noverall: 2027-01-01',
    usage: { node: 'test', model: 'gemini-3.1-flash-lite', promptTokens: 500, cachedTokens: 0, outputTokens: 120, thoughtTokens: 0, ms: 5 },
    finishReason: 'STOP',
  })),
}));

const FIX = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../fixtures/self/research-calibration.json'), 'utf8')) as {
  digest: Array<{ section: string; key: string; row: unknown }>;
  activation: ActivationRow[];
  systems: Array<{ system: string; family: string }>;
};

const NOW = new Date('2026-11-09T10:00:00Z');
const DAY = '2026-11-09';
/** the v1 path's model nodes: its family readers (same ids as v2's, never run here since the v2 build is a stub), its lineman and Oracle */
const V1_NODES = ['self.reader', 'self.oracle', 'lineman.self', 'family.rasi', 'family.varga', 'family.dasha', 'family.year', 'family.sky'];

/* eslint-disable @typescript-eslint/no-explicit-any */
function fakePrisma() {
  const outputs = new Map<string, any>();
  const markers = new Map<string, any>();
  const mk = (w: any) => `${w.kundli_id}|${w.area}|${w.as_of.toISOString()}`;
  const prisma: any = {
    kundli: { findFirst: async ({ where }: any) => (where.user_id === 'u1' ? { id: 'k1', preferred_dasha: 'dwisatpathi' } : null), updateMany: async () => ({ count: 1 }) },
    personFact: { findMany: async () => [] },
    techniqueOutput: {
      findUnique: async ({ where }: any) => outputs.get(where.cache_key) ?? null,
      findFirst: async () => null,
      upsert: async ({ where, create, update }: any) => {
        const cur = outputs.get(where.cache_key);
        const next = cur ? { ...cur, ...update } : { ...create, hit_count: 0, last_hit_at: null };
        outputs.set(where.cache_key, next);
        return next;
      },
      updateMany: async () => ({ count: 1 }),
    },
    agentRegistry: { upsert: async () => ({}) },
    agentRun: { create: async () => ({}) },
    readingFindingsCache: { findUnique: async () => null, upsert: async ({ create }: any) => create, updateMany: async () => ({ count: 0 }) },
    readingDossier: { create: async ({ data }: any) => ({ id: 'd1', ...data }) },
    areaBuild: {
      findUnique: async ({ where }: any) => markers.get(mk(where.kundli_id_area_as_of)) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const k = mk(where.kundli_id_area_as_of);
        const next = markers.has(k) ? { ...markers.get(k), ...update } : create;
        markers.set(k, next);
        return next;
      },
    },
  };
  return { prisma, outputs, markers };
}

const self = {
  now: () => NOW,
  loadDigest: async () => digestView('k1', FIX.digest as never, { status: 'ready', version: 'd1.test' }),
  systemsPresent: async () => FIX.systems,
  activationFor: async (_p: unknown, _k: unknown, q: any) => FIX.activation.filter((r) => (!q.systems || q.systems.includes(r.system)) && r.level <= (q.maxLevel ?? 3) && r.from < q.to && r.to > q.from),
  loadTransit: async () => null,
};

const gemini = callGemini as unknown as ReturnType<typeof vi.fn>;
const v1Calls = () => gemini.mock.calls.map((c) => (c[0] as { node?: string }).node).filter((n): n is string => typeof n === 'string' && V1_NODES.includes(n));

const saved = { v2: process.env.SELF_V2_BUILD, model: process.env.SELF_READING_MODEL };
beforeEach(() => {
  gemini.mockClear();
  process.env.SELF_READING_MODEL = '1';
  process.env.SELF_V2_BUILD = '1';
});
afterEach(() => {
  for (const [k, v] of [['SELF_V2_BUILD', saved.v2], ['SELF_READING_MODEL', saved.model]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('SELF_V2_BUILD=1: the self build makes no v1 model call', () => {
  it('a first build: the v1 code panels run (no model), then the v2 build; the marker is ready', async () => {
    expect(selfV2OwnsBoard()).toBe(true);
    const f = fakePrisma();
    const v2Build = vi.fn(async () => ({ status: 'ok' }));
    const r = await runSelfReadingBuild({ prisma: f.prisma, self, now: () => NOW, v2Build }, 'u1', 'k1', 'self');
    expect(r?.status).toBe('ok');
    if (r?.status === 'ok') expect(r.reading.panels.length).toBeGreaterThan(0);
    expect(v1Calls()).toEqual([]);
    expect(gemini).not.toHaveBeenCalled();
    expect(v2Build).toHaveBeenCalledWith(expect.anything(), 'u1', 'k1', DAY, {});
    expect(await readBuildMarker(f.prisma, 'k1', 'self', NOW)).toBe('ready');
  });

  it('a self refresh: no v1 model call, the v2 build is forced for the day, the question committed on v2 ok', async () => {
    const f = fakePrisma();
    const settleBoardRefresh = vi.fn(async () => undefined as never);
    const v2Build = vi.fn(async () => ({ status: 'ok' }));
    await runSelfReadingBuild({ prisma: f.prisma, self, now: () => NOW, v2Build, gate: { settleBoardRefresh } }, 'u1', 'k1', 'self', { refreshDay: DAY });
    expect(v1Calls()).toEqual([]);
    expect(gemini).not.toHaveBeenCalled();
    expect(v2Build).toHaveBeenCalledWith(expect.anything(), 'u1', 'k1', DAY, { refreshDay: DAY });
    expect(settleBoardRefresh).toHaveBeenCalledWith('u1', 'self', DAY, true);
  });

  it('a refresh whose v2 build fails or throws gives the question back and marks the build failed', async () => {
    for (const outcome of ['failed', 'budget_exceeded', 'preparing', new Error('boom')] as const) {
      const f = fakePrisma();
      const settleBoardRefresh = vi.fn(async () => undefined as never);
      const v2Build = vi.fn(async () => {
        if (outcome instanceof Error) throw outcome;
        return { status: outcome };
      });
      await runSelfReadingBuild({ prisma: f.prisma, self, now: () => NOW, v2Build, gate: { settleBoardRefresh } }, 'u1', 'k1', 'self', { refreshDay: DAY });
      expect(settleBoardRefresh).toHaveBeenCalledWith('u1', 'self', DAY, false);
      expect(await readBuildMarker(f.prisma, 'k1', 'self', NOW)).toBe('failed_recently');
    }
    expect(v1Calls()).toEqual([]);
  });

  it('love and work keep the v1 path (their build is asked for the model synthesis as before)', async () => {
    const f = fakePrisma();
    const build = vi.fn(async () => ({ status: 'ok', built_at: DAY, cached: false, reading: { asOf: DAY, panels: [], oracle: { status: 'ok' } } }) as never);
    const v2Build = vi.fn(async () => ({ status: 'ok' }));
    const settleBoardRefresh = vi.fn(async () => undefined as never);
    await runSelfReadingBuild({ prisma: f.prisma, build, now: () => NOW, v2Build, gate: { settleBoardRefresh } }, 'u1', 'k1', 'love', { refreshDay: DAY });
    expect(settleBoardRefresh).toHaveBeenCalledWith('u1', 'love', DAY, true);
    expect(build).toHaveBeenCalledWith(expect.anything(), 'u1', 'love', { refreshDay: DAY });
    expect(v2Build).not.toHaveBeenCalled();
  });

  it('flag off: the self build takes the v1 path and its model layer runs (the check above can see a v1 call)', async () => {
    delete process.env.SELF_V2_BUILD;
    const f = fakePrisma();
    const v2Build = vi.fn(async () => ({ status: 'ok' }));
    await runSelfReadingBuild({ prisma: f.prisma, self, now: () => NOW, v2Build }, 'u1', 'k1', 'self');
    expect(v1Calls().length).toBeGreaterThan(0);
    expect(v2Build).not.toHaveBeenCalled();
  });
});

describe('a retry the same day after a failed fresh reading', () => {
  it('is queued despite the half-hour cooldown under the flag, and not with the flag off', async () => {
    const f = fakePrisma();
    const invokes: unknown[] = [];
    const deps = { prisma: f.prisma, invoke: async (p: unknown) => void invokes.push(p), now: () => NOW };
    const v2Build = vi.fn(async () => ({ status: 'failed' }));
    await runSelfReadingBuild({ prisma: f.prisma, self, now: () => NOW, v2Build, gate: { settleBoardRefresh: async () => undefined as never } }, 'u1', 'k1', 'self', { refreshDay: DAY });
    expect(await readBuildMarker(f.prisma, 'k1', 'self', NOW)).toBe('failed_recently');
    // a page open is still held back by the cooldown
    expect(await queueSelfReadingBuild(deps, 'u1', 'k1', 'self')).toBe('failed_recently');
    expect(await queueSelfReadingBuild(deps, 'u1', 'k1', 'self', { refreshDay: DAY })).toBe('invoked');
    delete process.env.SELF_V2_BUILD;
    const g = fakePrisma();
    await runSelfReadingBuild({ prisma: g.prisma, build: async () => ({ status: 'ok', reading: { asOf: DAY, oracle: { status: 'failed' } } }) as never, now: () => NOW, gate: { settleBoardRefresh: async () => undefined as never } }, 'u1', 'k1', 'self', { refreshDay: DAY });
    expect(await queueSelfReadingBuild({ ...deps, prisma: g.prisma }, 'u1', 'k1', 'self', { refreshDay: DAY })).toBe('failed_recently');
  });

  it('gets a distinct v2 key only when today\'s v2 build failed', async () => {
    const f = fakePrisma();
    const v2Build = vi.fn(async () => ({ status: 'ok' }));
    const deps = { prisma: f.prisma, self, now: () => NOW, v2Build, gate: { settleBoardRefresh: async () => undefined as never } };
    await runSelfReadingBuild(deps, 'u1', 'k1', 'self', { refreshDay: DAY });
    expect(v2Build).toHaveBeenLastCalledWith(expect.anything(), 'u1', 'k1', DAY, { refreshDay: DAY });
    // the v2 build marked itself failed today (src/reading/self/v2/store.ts writeSelfV2Marker)
    f.markers.set(`k1|self.v2|${DAY}T00:00:00.000Z`, { status: 'failed' });
    await runSelfReadingBuild(deps, 'u1', 'k1', 'self', { refreshDay: DAY });
    expect(v2Build).toHaveBeenLastCalledWith(expect.anything(), 'u1', 'k1', DAY, { refreshDay: DAY, refreshRetry: 'r100000' });

    const ctx = { stamps: { digestVersion: 'd1', clock: 'vimsottari', mainPeriod: 'a', subPeriod: 'b', subSubPeriod: 'c', skyWeek: 'w', year: 'y', confirmHash: 'h' } } as never;
    const slice = { prefixHash: 'pre' } as never;
    const first = oracleStoreKey(ctx, slice, 'in', DAY);
    expect(first.endsWith(`|fresh=${DAY}`)).toBe(true);
    expect(oracleStoreKey(ctx, slice, 'in', DAY, 'r100000')).toBe(`${first}.r100000`);
    expect(oracleStoreKey(ctx, slice, 'in', undefined, 'r100000')).not.toContain('fresh=');
    expect(oracleStoreKey(ctx, slice, 'in', DAY, 'Bad Tag!')).toBe(first);
  });
});

describe('the You board dates come from the v2 Oracle when the v2 build owns the board', () => {
  const v1Row = { output: { status: 'ok', validUntil: { overall: '2026-11-08' } }, created_at: new Date('2026-10-20T09:00:00Z'), valid_to: null };
  const v2Row = (validUntil: string, validTo: Date | null = null) => ({
    output: { key: 'self.v2.oracle|x', result: { status: 'ok', output: { doc: { areas: {}, validUntil }, patterns: [] } }, briefs: [] },
    created_at: new Date('2026-11-05T08:00:00Z'),
    valid_to: validTo,
  });
  const prismaWith = (rows: Record<string, any>) => ({ techniqueOutput: { findFirst: async ({ where }: any) => rows[where.technique_id] ?? null }, areaBuild: { findFirst: async () => null } }) as any;

  it('the v2 document\'s validUntil, with no v1 synthesis needed', async () => {
    expect(await selfBoardDates(prismaWith({ 'self.v2.oracle': v2Row('2026-12-01') }), 'k1', DAY)).toEqual({ made_at: '2026-11-05T08:00:00.000Z', valid_until: '2026-12-01', refresh_due: false });
    expect(await selfBoardDates(prismaWith({ 'self.v2.oracle': v2Row('2026-11-08'), 'self.reading.oracle': v1Row }), 'k1', DAY)).toMatchObject({ valid_until: '2026-11-08', refresh_due: true });
    // 'always' holds for good; an unreadable date falls back to the stored window's end
    expect(await selfBoardDates(prismaWith({ 'self.v2.oracle': v2Row('always') }), 'k1', DAY)).toMatchObject({ valid_until: null, refresh_due: false });
    expect(await selfBoardDates(prismaWith({ 'self.v2.oracle': v2Row('soon', new Date('2026-11-20T00:00:00Z')) }), 'k1', DAY)).toMatchObject({ valid_until: '2026-11-19' });
  });

  it('no v2 reading yet: the v1 rule; flag off: the v2 rows are not read', async () => {
    expect(await selfBoardDates(prismaWith({ 'self.reading.oracle': v1Row }), 'k1', DAY)).toEqual({ made_at: '2026-10-20T09:00:00.000Z', valid_until: '2026-11-08', refresh_due: true });
    delete process.env.SELF_V2_BUILD;
    expect(await selfBoardDates(prismaWith({ 'self.v2.oracle': v2Row('2026-12-01'), 'self.reading.oracle': v1Row }), 'k1', DAY)).toMatchObject({ valid_until: '2026-11-08' });
  });
});
