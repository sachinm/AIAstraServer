/**
 * Doc 70 Phase 1: the reading clock set (`resolveReadingClocks`), the v3 step's default inventory loader
 * (`loadClockInventory`), `ensurePressureInventories` and the sync worker's hook. Fakes only: no engine, model, cache
 * endpoint or database is reached.
 */
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

const hook = vi.hoisted(() => ({ result: { gateComplete: true, more: false } as { gateComplete: boolean; more: boolean } }));
vi.mock('../../../../../src/services/kundliQueueService.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../../src/services/kundliQueueService.js')>()),
  processOneKundliRow: vi.fn(async () => hook.result),
}));

import { resolveReadingClocks, type ApplicabilityRow, type ReadingClockSet, type SystemPresence } from '../../../../../src/reading/self/clock.js';
import { ensurePressureInventories, type PressureInventoryDetail, type PressureLoad } from '../../../../../src/reading/self/sub/pressure.js';
import { loadClockInventory } from '../../../../../src/reading/self/v3/build.js';
import { otherClocks } from '../../../../../src/reading/self/v3/yearFrame.js';
import { runKundliSync } from '../../../../../src/services/kundliSyncWorker.js';

const ENV = ['READING_CLOCK_ORDER', 'READING_CLOCKS', 'READING_CLOCKS_MIN', 'SELF_CLOCK_CONDITIONAL_ORDER', 'KUNDLI_QUEUE_LOG_FILE'];
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.KUNDLI_QUEUE_LOG_FILE = path.join(os.tmpdir(), 'aiastra-clockset-test.log');
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const present = (...s: Array<[string, string]>): SystemPresence[] => s.map(([system, family]) => ({ system, family }));
const STORED = present(
  ['vimsottari', 'vimshottari'],
  ['narayana', 'other'],
  ['yogini', 'yogini'],
  ['chara', 'other'],
  ['karaka', 'karaka'],
  ['dwisatpathi', 'conditional'],
  ['ashtottari', 'other'],
);
const APPLIES: ApplicabilityRow[] = [
  { system: 'dwisatpathi', names: ['dwisatpathi'], applies: true },
  { system: 'ashtottari', names: ['ashtottari'], applies: false },
];

describe('resolveReadingClocks (doc 70 §4.1)', () => {
  it('a kundli with an applicable conditional clock: Vimshottari, Narayana, the year, that clock, Yogini', () => {
    const s = resolveReadingClocks('dwisatpathi', STORED, APPLIES);
    expect(s.clocks).toEqual(['vimsottari', 'narayana', 'tithi_pravesha', 'dwisatpathi', 'yogini']);
    expect(s.pulled).toEqual(['vimsottari', 'narayana', 'dwisatpathi', 'yogini']);
    expect(s.conditional).toBe('dwisatpathi');
    expect(s.skipped).toContainEqual({ system: 'chara', reason: 'limit' });
  });

  it('no conditional clock applies: Chara takes the fifth place', () => {
    const none = APPLIES.map((r) => ({ ...r, applies: false }));
    const s = resolveReadingClocks('vimsottari', STORED, none);
    expect(s.clocks).toEqual(['vimsottari', 'narayana', 'tithi_pravesha', 'yogini', 'chara']);
    expect(s.pulled).toEqual(['vimsottari', 'narayana', 'yogini', 'chara']);
    expect(s.conditional).toBeNull();
    expect(s.skipped).toContainEqual({ system: 'conditional', reason: 'none_applies' });
  });

  it('a spine outside the order is kept first and the last clock drops; the size and order come from env', () => {
    const s = resolveReadingClocks('karaka', STORED, APPLIES);
    expect(s.clocks).toEqual(['karaka', 'vimsottari', 'narayana', 'tithi_pravesha', 'dwisatpathi']);
    expect(s.pulled).not.toContain('tithi_pravesha');
    process.env.READING_CLOCKS = '3';
    expect(resolveReadingClocks('dwisatpathi', STORED, APPLIES).clocks).toEqual(['dwisatpathi', 'vimsottari', 'narayana']);
    // the spine is never dropped
    expect(resolveReadingClocks('yogini', STORED, APPLIES).clocks).toEqual(['yogini', 'vimsottari', 'narayana']);
    process.env.READING_CLOCKS = '6';
    process.env.READING_CLOCK_ORDER = 'yogini,tithi_pravesha,conditional';
    expect(resolveReadingClocks('dwisatpathi', STORED, APPLIES).clocks).toEqual(['yogini', 'tithi_pravesha', 'dwisatpathi']);
  });

  it('a system with no stored periods is skipped; with nothing stored yet every served system counts', () => {
    const few = present(['vimsottari', 'vimshottari'], ['yogini', 'yogini']);
    expect(resolveReadingClocks('vimsottari', few, null).clocks).toEqual(['vimsottari', 'tithi_pravesha', 'yogini']);
    expect(resolveReadingClocks('vimsottari', [], null).clocks).toEqual(['vimsottari', 'narayana', 'tithi_pravesha', 'yogini', 'chara']);
  });

  it('the year frame reads the set beside the spine; without a set, the confirming clocks', () => {
    const s = resolveReadingClocks('dwisatpathi', STORED, APPLIES);
    expect(otherClocks({ primary: 'dwisatpathi', confirming: ['karaka'], applicable: [] }, s)).toEqual(['vimsottari', 'narayana', 'yogini']);
    expect(otherClocks({ primary: 'dwisatpathi', confirming: ['karaka'], applicable: ['dwisatpathi'] }, null)).toEqual(['karaka']);
  });
});

const inv = (clock: string): PressureInventoryDetail => ({ kundliId: 'k1', clock, asOf: '2026-11-10', from: '2023-11-10', to: '2029-11-10', rows: [], boundaries: [], calcVersion: '2' });
const noPrisma = {} as PrismaClient;

describe('loadClockInventory (the v3 step default loader)', () => {
  it('the pull succeeds: its inventory, no stored read', async () => {
    const stored = vi.fn(async () => inv('stored'));
    const r = await loadClockInventory(noPrisma, 'k1', 'yogini', '2026-11-10', { pull: async () => ({ inventory: inv('yogini'), source: 'pulled', gaps: [] }), stored });
    expect(r?.clock).toBe('yogini');
    expect(stored).not.toHaveBeenCalled();
  });

  it('the pull fails (throws or returns nothing): the stored row is used', async () => {
    const stored = vi.fn(async () => inv('narayana'));
    const thrown = await loadClockInventory(noPrisma, 'k1', 'narayana', '2026-11-10', {
      pull: async () => {
        throw new Error('engine down');
      },
      stored,
    });
    expect(thrown?.clock).toBe('narayana');
    const empty = await loadClockInventory(noPrisma, 'k1', 'narayana', '2026-11-10', { pull: async () => ({ inventory: null, source: 'none', gaps: ['x'] }), stored });
    expect(empty?.clock).toBe('narayana');
    expect(stored).toHaveBeenCalledTimes(2);
  });

  it('neither: null, never throws', async () => {
    const r = await loadClockInventory(noPrisma, 'k1', 'chara', '2026-11-10', {
      pull: async () => {
        throw new Error('x');
      },
      stored: async () => {
        throw new Error('db');
      },
    });
    expect(r).toBeNull();
  });
});

const SET: ReadingClockSet = {
  spine: 'dwisatpathi',
  clocks: ['vimsottari', 'narayana', 'tithi_pravesha', 'dwisatpathi', 'yogini'],
  pulled: ['vimsottari', 'narayana', 'dwisatpathi', 'yogini'],
  conditional: 'dwisatpathi',
  skipped: [],
};

describe('ensurePressureInventories', () => {
  it('loads every pulled clock in parallel; a failed one is reported, the rest stand', async () => {
    const started: string[] = [];
    let open = 0;
    let maxOpen = 0;
    const load = vi.fn(async (_p: PrismaClient, _k: string, system: string): Promise<PressureLoad> => {
      started.push(system);
      maxOpen = Math.max(maxOpen, ++open);
      await new Promise((r) => setTimeout(r, 5));
      open--;
      if (system === 'narayana') throw new Error('engine refused');
      return { inventory: inv(system), source: 'pulled', gaps: [] };
    });
    const r = await ensurePressureInventories(noPrisma, 'k1', '2026-11-10', { loadSet: async () => SET, load: load as never });
    expect(started).toEqual(SET.pulled);
    expect(maxOpen).toBe(4);
    expect(r.clocks.map((c) => [c.system, c.source])).toEqual([
      ['vimsottari', 'pulled'],
      ['narayana', 'none'],
      ['dwisatpathi', 'pulled'],
      ['yogini', 'pulled'],
    ]);
    expect(r.clocks[1]!.gaps[0]).toMatch(/engine refused/);
  });

  it('never throws when the set cannot be read (no store in this context)', async () => {
    const r = await ensurePressureInventories(noPrisma, 'k1', '2026-11-10');
    expect(r.set).toBeNull();
    expect(r.clocks).toEqual([]);
    expect(r.gaps).toHaveLength(1);
  });
});

// ---------------------------------------------------------------- the sync worker hook

function leasePrisma() {
  const k = { id: 'k1', queue_started_at: null as Date | null, user: {} };
  return {
    kundli: {
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => (Object.assign(k, data), { count: 1 })),
      findUnique: vi.fn(async () => k),
    },
  } as unknown as PrismaClient;
}

describe('sync worker: the clock set inventories after a complete sync', () => {
  it('pulls under the lease when the chart is complete and time is left', async () => {
    hook.result = { gateComplete: true, more: false };
    const ensurePressure = vi.fn(async () => undefined);
    const out = await runKundliSync({ prisma: leasePrisma(), maxMs: 12 * 60_000, now: () => Date.parse('2026-11-10T08:00:00Z'), ensurePressure }, 'k1');
    expect(out).toMatchObject({ status: 'ran' });
    expect(ensurePressure).toHaveBeenCalledWith(expect.anything(), 'k1', '2026-11-10');
  });

  it('skips the pull when the chart is not complete, when more is left, or when under 30 s of budget remain', async () => {
    const ensurePressure = vi.fn(async () => undefined);
    hook.result = { gateComplete: false, more: false };
    await runKundliSync({ prisma: leasePrisma(), maxMs: 12 * 60_000, ensurePressure }, 'k1');
    hook.result = { gateComplete: true, more: true };
    await runKundliSync({ prisma: leasePrisma(), maxMs: 12 * 60_000, ensurePressure, invoke: async () => true }, 'k1');
    hook.result = { gateComplete: true, more: false };
    let t = 0;
    // each read of the clock moves it 20 s: the deadline is 60 s after start, and the check comes after two reads
    await runKundliSync({ prisma: leasePrisma(), maxMs: 60_000, now: () => (t += 20_000), ensurePressure }, 'k1');
    expect(ensurePressure).not.toHaveBeenCalled();
  });

  it('a failing pull never fails the sync', async () => {
    hook.result = { gateComplete: true, more: false };
    const out = await runKundliSync(
      {
        prisma: leasePrisma(),
        maxMs: 12 * 60_000,
        ensurePressure: async () => {
          throw new Error('boom');
        },
      },
      'k1',
    );
    expect(out).toMatchObject({ status: 'ran', gateComplete: true });
  });
});
