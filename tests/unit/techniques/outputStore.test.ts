import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAgentRegistryState } from '../../../src/agents/registry.js';
import { techniqueById, type TechniqueDef } from '../../../src/techniques/catalog.js';
import {
  deleteKundliTechniqueOutputs,
  resetTechniqueOutputStoreState,
  runningYearSpan,
  shortestRunningPeriodSpan,
  sweepTechniqueOutputs,
  withTechniqueOutput,
  type StoredTechniqueOutputRow,
} from '../../../src/techniques/outputStore.js';
import type { ValidityConfig } from '../../../src/techniques/pieces.js';
import { runCodeReadersCached } from '../../../src/reading/codeReaders/readers.js';
import type { EvidencePack } from '../../../src/reading/packs/selector.js';

const cfg: ValidityConfig = { transitWindowHours: 2, dashaFallbackDays: 30, annualFallbackDays: 90 };
const NOW = new Date('2026-11-06T13:15:00Z');

const T = (id: string): TechniqueDef => {
  const t = techniqueById(id);
  if (!t) throw new Error(`missing technique ${id}`);
  return t;
};

interface FakeStore {
  rows: Map<string, StoredTechniqueOutputRow>;
  agentRuns: Array<Record<string, unknown>>;
  prisma: PrismaClient;
}

function makeFakeStore(opts: { failRead?: boolean; failWrite?: boolean; conflictOnCreate?: boolean } = {}): FakeStore {
  const rows = new Map<string, StoredTechniqueOutputRow>();
  const agentRuns: Array<Record<string, unknown>> = [];

  const prisma = {
    agentRegistry: {
      upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => create),
    },
    agentRun: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        agentRuns.push(data);
        return data;
      }),
    },
    techniqueOutput: {
      findUnique: vi.fn(async ({ where }: { where: { cache_key: string } }) => {
        if (opts.failRead) throw new Error('db read error');
        return rows.get(where.cache_key) ?? null;
      }),
      create: vi.fn(async ({ data }: { data: StoredTechniqueOutputRow }) => {
        if (opts.failWrite) throw new Error('db write error');
        if (opts.conflictOnCreate || rows.has(data.cache_key)) {
          const err = new Error('Unique constraint failed') as Error & { code: string };
          err.code = 'P2002';
          throw err;
        }
        rows.set(data.cache_key, { ...data, hit_count: 0, last_hit_at: null });
        return data;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { cache_key: string }; data: { hit_count?: { increment: number }; last_hit_at?: Date } }) => {
        const existing = rows.get(where.cache_key);
        if (!existing) return { count: 0 };
        existing.hit_count = (existing.hit_count ?? 0) + (data.hit_count?.increment ?? 0);
        if (data.last_hit_at) existing.last_hit_at = data.last_hit_at;
        return { count: 1 };
      }),
      deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        let deleted = 0;
        if (typeof where.cache_key === 'string') {
          if (rows.delete(where.cache_key)) deleted++;
          return { count: deleted };
        }
        if (typeof where.kundli_id === 'string') {
          for (const [k, v] of rows.entries()) {
            if (v.kundli_id === where.kundli_id) {
              rows.delete(k);
              deleted++;
            }
          }
          return { count: deleted };
        }
        const lt = (where.valid_to as { lt?: Date } | undefined)?.lt;
        if (lt instanceof Date) {
          for (const [k, v] of rows.entries()) {
            if (v.valid_to && new Date(v.valid_to).getTime() < lt.getTime()) {
              rows.delete(k);
              deleted++;
            }
          }
        }
        return { count: deleted };
      }),
    },
  } as unknown as PrismaClient;

  return { rows, agentRuns, prisma };
}

describe('withTechniqueOutput (date-range validity cache)', () => {
  beforeEach(() => {
    resetTechniqueOutputStoreState();
    resetAgentRegistryState();
  });

  it('stores output on miss and skips the agent on a second call inside the same 2-hour transit window', async () => {
    const store = makeFakeStore();
    let makerCalls = 0;
    const make = vi.fn(async () => {
      makerCalls++;
      return { tone: 'open', confidence: 'confirmed', call: makerCalls };
    });

    // First call at 13:15 UTC (inside the 12:00-14:00 2h window): cache miss, runs maker
    const first = await withTechniqueOutput(
      store.prisma,
      {
        technique: 'work.present_tone',
        kundliId: 'kundli-1',
        digestVersion: 'v3',
        context: { now: NOW },
        config: cfg,
      },
      make,
    );

    expect(first.cached).toBe(false);
    expect(first.value).toEqual({ tone: 'open', confidence: 'confirmed', call: 1 });
    expect(first.window.freshness).toBe('transit');
    expect(first.window.from.toISOString()).toBe('2026-11-06T12:00:00.000Z');
    expect(first.window.to?.toISOString()).toBe('2026-11-06T14:00:00.000Z');
    expect(makerCalls).toBe(1);
    expect(store.rows.size).toBe(1);

    // Second call 40 minutes later at 13:55 UTC (still inside 12:00-14:00): cache hit, skips maker!
    const second = await withTechniqueOutput(
      store.prisma,
      {
        technique: 'work.present_tone',
        kundliId: 'kundli-1',
        digestVersion: 'v3',
        context: { now: new Date('2026-11-06T13:55:00Z') },
        config: cfg,
      },
      make,
    );

    expect(second.cached).toBe(true);
    expect(second.value).toEqual({ tone: 'open', confidence: 'confirmed', call: 1 });
    expect(makerCalls).toBe(1); // Maker was NOT called!
    const stored = store.rows.get(first.cacheKey!)!;
    expect(stored.hit_count).toBe(1);
    expect(store.agentRuns).toHaveLength(1);
    expect(store.agentRuns[0]).toMatchObject({
      agent_id: 'area.career_inputs',
      technique_id: 'work.present_tone',
      kundli_id: 'kundli-1',
      status: 'cached',
    });

    // Third call at 14:05 UTC (next 2-hour window 14:00-16:00): runs maker for the new window
    const third = await withTechniqueOutput(
      store.prisma,
      {
        technique: 'work.present_tone',
        kundliId: 'kundli-1',
        digestVersion: 'v3',
        context: { now: new Date('2026-11-06T14:05:00Z') },
        config: cfg,
      },
      make,
    );
    expect(third.cached).toBe(false);
    expect(third.value.call).toBe(2);
    expect(makerCalls).toBe(2);
  });

  it('caches a natal technique open-ended across days until digestVersion changes', async () => {
    const store = makeFakeStore();
    const make = vi.fn(async () => ({ items: [{ code: 'J01' }] }));

    const first = await withTechniqueOutput(
      store.prisma,
      {
        technique: T('general.jaimini'),
        kundliId: 'kundli-1',
        digestVersion: 'v3',
        context: { now: NOW },
        config: cfg,
      },
      make,
    );
    expect(first.cached).toBe(false);
    expect(first.window.freshness).toBe('natal');
    expect(first.window.to).toBeNull();

    // 60 days later with the same digestVersion: still valid, skips agent!
    const later = await withTechniqueOutput(
      store.prisma,
      {
        technique: 'general.jaimini',
        kundliId: 'kundli-1',
        digestVersion: 'v3',
        context: { now: new Date('2027-01-05T08:00:00Z') },
        config: cfg,
      },
      make,
    );
    expect(later.cached).toBe(true);
    expect(make).toHaveBeenCalledTimes(1);

    // Digest rebuilt to v4: recomputes cleanly
    const rebuilt = await withTechniqueOutput(
      store.prisma,
      {
        technique: 'general.jaimini',
        kundliId: 'kundli-1',
        digestVersion: 'v4',
        context: { now: new Date('2027-01-05T08:00:00Z') },
        config: cfg,
      },
      make,
    );
    expect(rebuilt.cached).toBe(false);
    expect(make).toHaveBeenCalledTimes(2);
  });

  it('recomputes when a stored row has expired even if returned under the same key, and updates the row for subsequent hits', async () => {
    const store = makeFakeStore();
    let call = 0;
    const make = vi.fn(async () => ({ status: 'fresh', call: ++call }));

    const first = await withTechniqueOutput(
      store.prisma,
      {
        technique: 'lucky.day_tables',
        kundliId: 'kundli-1',
        digestVersion: 'v3',
        context: { now: NOW },
        config: cfg,
      },
      make,
    );
    expect(first.cached).toBe(false);
    expect(first.value).toEqual({ status: 'fresh', call: 1 });

    // Artificially expire the stored row's valid_to before NOW
    const row = store.rows.get(first.cacheKey!)!;
    row.valid_to = new Date('2026-11-06T10:00:00Z');

    const second = await withTechniqueOutput(
      store.prisma,
      {
        technique: 'lucky.day_tables',
        kundliId: 'kundli-1',
        digestVersion: 'v3',
        context: { now: NOW },
        config: cfg,
      },
      make,
    );
    expect(second.cached).toBe(false);
    expect(second.value).toEqual({ status: 'fresh', call: 2 });
    expect(make).toHaveBeenCalledTimes(2);

    // Third call at NOW must hit the freshly updated row rather than staying permanently expired
    const third = await withTechniqueOutput(
      store.prisma,
      {
        technique: 'lucky.day_tables',
        kundliId: 'kundli-1',
        digestVersion: 'v3',
        context: { now: NOW },
        config: cfg,
      },
      make,
    );
    expect(third.cached).toBe(true);
    expect(third.value).toEqual({ status: 'fresh', call: 2 });
    expect(make).toHaveBeenCalledTimes(2);
  });

  it('refines stored validity window when make() returns runningPeriod or year spans', async () => {
    const store = makeFakeStore();
    const runningRows = [
      { from: '2026-01-01', to: '2027-01-01' },
      { from: '2026-11-01', to: '2026-11-12' },
    ];
    const shortest = shortestRunningPeriodSpan(runningRows, NOW);
    expect(shortest?.from.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(shortest?.to.toISOString()).toBe('2026-11-12T00:00:00.000Z');

    const fakeView = {
      annual: () => [
        {
          kind: 'TP' as const,
          dashas: [{ periods: [{ from: '2026-06-01', to: '2027-06-01' }] }],
        },
      ],
    };
    const yearSpan = runningYearSpan(fakeView, NOW);
    expect(yearSpan?.from.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(yearSpan?.to.toISOString()).toBe('2027-06-01T00:00:00.000Z');

    const out = await withTechniqueOutput(
      store.prisma,
      {
        technique: 'self.activation',
        kundliId: 'kundli-1',
        digestVersion: 'v3',
        context: { now: NOW },
        config: cfg,
      },
      async () => ({
        value: { ok: true },
        context: { runningPeriod: shortest },
      }),
    );
    expect(out.window.to?.toISOString()).toBe('2026-11-12T00:00:00.000Z');
    const stored = store.rows.get(out.cacheKey!)!;
    expect(new Date(stored.valid_to!).toISOString()).toBe('2026-11-12T00:00:00.000Z');
  });

  it('caches runCodeReadersCached per subject and separates distinct person signifiers', async () => {
    const store = makeFakeStore();
    const basePack = (who?: string): EvidencePack =>
      ({
        subject: 'family_parents',
        keyFrame: { houses: [4, 9], lords: ['Mo', 'Ju'], karakas: ['Su', 'Mo'], vargas: ['D1', 'D12'] },
        sections: {
          digest: {
            version: 'v3',
            vargas: ['D1', 'D12'],
            house: {
              D1: {
                h4: { lord: 'Mo', lordDignity: 'exalted', sav: 31 },
                h9: { lord: 'Ju', lordDignity: 'debilitated', sav: 20 },
              },
              D12: {
                h4: { lord: 'Mo', lordDignity: 'own' },
                h9: { lord: 'Ju', lordDignity: 'debilitated' },
              },
            },
            planet: {
              D1: {
                Mo: { dignity: 'exalted', house: 4 },
                Su: { dignity: 'debilitated', house: 9 },
              },
              D12: {
                Mo: { dignity: 'own', house: 4 },
                Su: { dignity: 'debilitated', house: 9 },
              },
            },
            yoga: {},
            point: {},
            rasi: {},
            person: who
              ? {
                  who,
                  houses: who === 'mother' ? [4] : [9],
                  varga: 'D12',
                  karaka: who === 'mother' ? 'Mo' : 'Su',
                }
              : undefined,
          },
        },
      }) as unknown as EvidencePack;

    const mother1 = await runCodeReadersCached(store.prisma, basePack('mother'), ['person'], {
      kundliId: 'kundli-1',
      digestVersion: 'v3',
      now: NOW,
    });
    const father1 = await runCodeReadersCached(store.prisma, basePack('father'), ['person'], {
      kundliId: 'kundli-1',
      digestVersion: 'v3',
      now: NOW,
    });
    expect(mother1[0]!.claims[0]!.about).toBe('mother');
    expect(father1[0]!.claims[0]!.about).toBe('father');
    expect(mother1[0]!.verdict).not.toBe(father1[0]!.verdict);
    expect(store.rows.size).toBe(2);

    // Repeat call for mother hits the stored output and logs a cached run
    const mother2 = await runCodeReadersCached(store.prisma, basePack('mother'), ['person'], {
      kundliId: 'kundli-1',
      digestVersion: 'v3',
      now: NOW,
    });
    expect(mother2).toEqual(mother1);
    expect(store.agentRuns.some((r) => r.technique_id === 'general.person' && r.status === 'cached')).toBe(true);
  });

  it('never caches question-fresh techniques (general.prashna)', async () => {
    const store = makeFakeStore();
    const make = vi.fn(async () => ({ prashna: 'instant' }));

    const res = await withTechniqueOutput(
      store.prisma,
      {
        technique: 'general.prashna',
        kundliId: 'kundli-1',
        digestVersion: 'v3',
        context: { now: NOW },
        questionHash: 'qhash',
        config: cfg,
      },
      make,
    );
    expect(res.cached).toBe(false);
    expect(res.cacheKey).toBeNull();
    expect(store.rows.size).toBe(0);
  });

  it('tolerates concurrent insert conflicts (ON CONFLICT DO NOTHING) and store read/write failures', async () => {
    const conflictStore = makeFakeStore({ conflictOnCreate: true });
    const res1 = await withTechniqueOutput(
      conflictStore.prisma,
      {
        technique: 'general.jaimini',
        kundliId: 'kundli-1',
        digestVersion: 'v3',
        context: { now: NOW },
        config: cfg,
      },
      async () => ({ ok: true }),
    );
    expect(res1.value).toEqual({ ok: true });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const brokenStore = makeFakeStore({ failRead: true, failWrite: true });
      const res2 = await withTechniqueOutput(
        brokenStore.prisma,
        {
          technique: 'general.jaimini',
          kundliId: 'kundli-1',
          digestVersion: 'v3',
          context: { now: NOW },
          config: cfg,
        },
        async () => ({ fallback: true }),
      );
      expect(res2.value).toEqual({ fallback: true });
      expect(res2.cached).toBe(false);
      expect(warnSpy).toHaveBeenCalledTimes(1); // warns once only
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('deletes a kundli outputs on digest rebuild and sweeps expired outputs older than 1 day', async () => {
    const store = makeFakeStore();
    await withTechniqueOutput(
      store.prisma,
      {
        technique: 'work.present_tone',
        kundliId: 'kundli-1',
        digestVersion: 'v3',
        context: { now: new Date('2026-11-01T12:00:00Z') },
        config: cfg,
      },
      async () => ({ old: true }),
    );
    await withTechniqueOutput(
      store.prisma,
      {
        technique: 'general.jaimini',
        kundliId: 'kundli-1',
        digestVersion: 'v3',
        context: { now: NOW },
        config: cfg,
      },
      async () => ({ natal: true }),
    );
    expect(store.rows.size).toBe(2);

    // Sweep at 2026-11-06 removes the 2026-11-01 transit row (valid_to < now - 1 day) and keeps the open natal row
    const swept = await sweepTechniqueOutputs(store.prisma, NOW);
    expect(swept).toBe(1);
    expect(store.rows.size).toBe(1);

    // Digest rebuild deletes all remaining rows for kundli-1
    const deleted = await deleteKundliTechniqueOutputs(store.prisma, 'kundli-1');
    expect(deleted).toBe(1);
    expect(store.rows.size).toBe(0);
  });
});

