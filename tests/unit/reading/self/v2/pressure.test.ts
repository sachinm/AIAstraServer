/**
 * The engine's pressure inventory (AIAstra_Radha docs/pressure-inventory.md; doc 66 §4.3) in the Self v2 build: the one
 * snake_case → camelCase mapper, the kundli_data store (one row per kundli and clock, refreshed after 7 days or on a
 * clock change), the silent degraded path when the engine refuses or is not deployed, and S3 preferring the rows.
 * Every engine call is a stub; nothing reaches the engine.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { digestView } from '../../../../../src/reading/digest/load.js';
import type { ActivationRow } from '../../../../../src/reading/digest/activation.js';
import { gaps } from '../../../../../src/reading/self/slices.js';
import { runSelfSubTechniques } from '../../../../../src/reading/self/sub/index.js';
import { subClock } from '../../../../../src/reading/self/sub/clock.js';
import { subWindows } from '../../../../../src/reading/self/sub/windows.js';
import {
  asPressurePayload,
  loadPressureInventory,
  PRESSURE_TYPE,
  pressureVariant,
  toPressureInventory,
  type EnginePressurePayload,
  type PressureLoad,
} from '../../../../../src/reading/self/sub/pressure.js';
import type { RadhaFetcher } from '../../../../../src/reading/chartData/store.js';

const ENGINE = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../fixtures/self/pressure-inventory.json'), 'utf8')) as EnginePressurePayload;
const FIX = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../fixtures/self/research-calibration.json'), 'utf8')) as {
  digest: Array<{ section: string; key: string; row: unknown }>;
  activation: ActivationRow[];
  systems: Array<{ system: string; family: string }>;
};
const ASOF = '2026-11-07';
const view = digestView('k1', FIX.digest as never, { status: 'ready', version: 'd1.test' });
const NOW = new Date('2026-11-07T09:00:00Z');
const DAY = 86_400_000;
const REQ = { params: { dob: '1990-05-01', tob: '10:00', place: 'Delhi' } as never, coords: { lat: 28.6, lon: 77.2, tz: 5.5 } };

/** a Map-backed kundli_data and chart_data_types */
function store() {
  const rows = new Map<string, Record<string, unknown>>();
  const types = new Map<string, Record<string, unknown>>();
  const key = (w: { kundli_id: string; data_type: string; variant: string; ayanamsa: string }) => `${w.kundli_id}|${w.data_type}|${w.variant}|${w.ayanamsa}`;
  const prisma = {
    kundliData: {
      findUnique: async ({ where }: { where: { kundli_data_key: Parameters<typeof key>[0] } }) => rows.get(key(where.kundli_data_key)) ?? null,
      upsert: async ({ where, create, update }: { where: { kundli_data_key: Parameters<typeof key>[0] }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const k = key(where.kundli_data_key);
        if (!types.has(String(where.kundli_data_key.data_type))) throw new Error('FK kundli_data_data_type_fkey');
        rows.set(k, rows.has(k) ? { ...rows.get(k), ...update } : { ...create });
      },
    },
    chartDataType: {
      upsert: async ({ where, create }: { where: { id: string }; create: Record<string, unknown> }) => {
        if (!types.has(where.id)) types.set(where.id, create);
      },
    },
  };
  return { prisma: prisma as unknown as PrismaClient, rows, types };
}

const okFetcher = () => vi.fn<RadhaFetcher>(async () => ENGINE as unknown);
const refused = () =>
  vi.fn<RadhaFetcher>(async () => {
    throw new Error('Radha 400: Invalid type: pressure_inventory');
  });

describe('pressure_inventory: the one mapper', () => {
  it('maps the engine rows to PressureRow (camelCase), keeps grades and dates as given, drops unreadable rows', () => {
    const payload = asPressurePayload(ENGINE)!;
    expect(payload).not.toBeNull();
    expect(asPressurePayload({ data: ENGINE })).not.toBeNull();
    expect(asPressurePayload({ rows: 'x' })).toBeNull();
    const { inventory, dropped } = toPressureInventory(payload, 'k1');
    expect(dropped).toEqual(['bogus:Xx@2026-01-01']);
    expect(inventory).toMatchObject({ kundliId: 'k1', clock: 'dwisatpathi', asOf: '2026-11-07', from: '2023-11-07', to: '2029-11-07', calcVersion: '1' });
    expect(inventory.rows).toHaveLength(7);
    const ra = inventory.rows.find((r) => r.id === 'dasha:dwisatpathi/1/Ra@2019-02-16')!;
    // Rahu always presses in the engine's table: kept as given
    expect(ra).toMatchObject({ kind: 'dasha', level: 1, planet: 'Ra', system: 'dwisatpathi', housesTouched: [10, 2, 4, 6], matters: ['career_and_standing'], polarity: 'presses', strength: 2, from: '2019-02-16', to: '2028-02-16' });
    expect(ra).not.toHaveProperty('houses_touched');
    const sa = inventory.rows.find((r) => r.id === 'transit:Sa@2025-03-29')!;
    expect(sa).toMatchObject({ kind: 'transit', houseFromMoon: 5, strength: 3 });
    expect(sa).not.toHaveProperty('level');
    expect(inventory.boundaries[0]).toEqual({ date: '2025-11-16', starts: ['dasha:dwisatpathi/2/Ve@2025-11-16'], ends: [] });
  });
});

describe('pressure_inventory: pull, store, refresh', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('pulls once with the doc 66 request, stores one kundli_data row per kundli and clock, then reads it for 7 days', async () => {
    const db = store();
    const fetcher = okFetcher();
    const r1 = await loadPressureInventory(db.prisma, 'k1', 'dwisatpathi', ASOF, { fetcher, kundliRequest: async () => REQ, now: () => NOW });
    expect(r1.source).toBe('pulled');
    expect(r1.inventory!.rows).toHaveLength(7);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]![1]).toBe('pressure_inventory');
    expect(fetcher.mock.calls[0]![2]).toEqual({ params: { as_of: ASOF, years_back: 3, years_ahead: 3, system: 'dwisatpathi', levels: 3 } });
    expect(db.types.has(PRESSURE_TYPE)).toBe(true);
    const row = db.rows.get(`k1|pressure_inventory|${pressureVariant('dwisatpathi')}|LAHIRI`)!;
    expect(row).toMatchObject({ data_type: 'pressure_inventory', variant: 'system=dwisatpathi', status: 'ready', calc_version: '1', error: null });
    expect(row.payload).toEqual(ENGINE);

    const r2 = await loadPressureInventory(db.prisma, 'k1', 'dwisatpathi', ASOF, { fetcher, kundliRequest: async () => REQ, now: () => new Date(NOW.getTime() + 6 * DAY) });
    expect(r2.source).toBe('stored');
    expect(fetcher).toHaveBeenCalledTimes(1);

    const r3 = await loadPressureInventory(db.prisma, 'k1', 'dwisatpathi', ASOF, { fetcher, kundliRequest: async () => REQ, now: () => new Date(NOW.getTime() + 8 * DAY) });
    expect(r3.source).toBe('pulled');
    expect(fetcher).toHaveBeenCalledTimes(2);

    // a clock switch reads its own variant: pulled on the new clock
    const r4 = await loadPressureInventory(db.prisma, 'k1', 'vimsottari', ASOF, { fetcher, kundliRequest: async () => REQ, now: () => NOW });
    expect(r4.source).toBe('pulled');
    expect(fetcher.mock.calls[2]![2]).toMatchObject({ params: { system: 'vimsottari' } });
    expect(db.rows.size).toBe(2);
  });

  it('a refused pull (engine not deployed: HTTP 400) is silent: no inventory, a gap, no retry for 24 h', async () => {
    const db = store();
    const fetcher = refused();
    const r1 = await loadPressureInventory(db.prisma, 'k1', 'dwisatpathi', ASOF, { fetcher, kundliRequest: async () => REQ, now: () => NOW });
    expect(r1).toMatchObject({ inventory: null, source: 'none' });
    expect(r1.gaps.join(' ')).toMatch(/pull failed \(Radha 400/);
    expect(db.rows.get(`k1|pressure_inventory|system=dwisatpathi|LAHIRI`)).toMatchObject({ status: 'failed' });
    const r2 = await loadPressureInventory(db.prisma, 'k1', 'dwisatpathi', ASOF, { fetcher, kundliRequest: async () => REQ, now: () => new Date(NOW.getTime() + 3_600_000) });
    expect(r2.inventory).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const r3 = await loadPressureInventory(db.prisma, 'k1', 'dwisatpathi', ASOF, { fetcher, kundliRequest: async () => REQ, now: () => new Date(NOW.getTime() + 25 * 3_600_000) });
    expect(r3.inventory).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('a failed refresh keeps serving the older stored payload', async () => {
    const db = store();
    await loadPressureInventory(db.prisma, 'k1', 'dwisatpathi', ASOF, { fetcher: okFetcher(), kundliRequest: async () => REQ, now: () => NOW });
    const r = await loadPressureInventory(db.prisma, 'k1', 'dwisatpathi', ASOF, { fetcher: refused(), kundliRequest: async () => REQ, now: () => new Date(NOW.getTime() + 9 * DAY) });
    expect(r.source).toBe('stale');
    expect(r.inventory!.rows).toHaveLength(7);
    expect(db.rows.get(`k1|pressure_inventory|system=dwisatpathi|LAHIRI`)).toMatchObject({ status: 'ready' });
  });

  it('SELF_V2_PRESSURE_PULL=0 never calls the engine', async () => {
    process.env.SELF_V2_PRESSURE_PULL = '0';
    const fetcher = okFetcher();
    const r = await loadPressureInventory(store().prisma, 'k1', 'dwisatpathi', ASOF, { fetcher, kundliRequest: async () => REQ, now: () => NOW });
    expect(r.inventory).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('S3 prefers the engine rows (degraded = false)', () => {
  const clock = subClock('dwisatpathi', FIX.systems, gaps());
  const inv = toPressureInventory(ENGINE, 'k1').inventory;

  it('windows from the inventory: engine strength and polarity order the heaviest window; since/until always said', () => {
    const g = gaps();
    const w = subWindows({ view, activation: FIX.activation, sky: null, asOf: ASOF, g, pressure: inv }, clock);
    expect(w.degraded).toBe(false);
    expect(w.heaviestNow).toMatchObject({ rowId: 'transit:Sa@2025-03-29', strength: 3, polarity: 'presses' });
    expect(w.easesAt).toBe('2027-06-03');
    expect(w.nextSupportFrom).toBe('2026-12-10');
    expect(w.rows.every((r) => r.sinceKnown && r.untilKnown)).toBe(true);
    expect(w.rows.find((r) => r.rowId === 'transit:Sa@2025-03-29')).toMatchObject({ houses: [1, 3, 7, 10], houseFromMoon: 5, matters: ['self_and_body'] });
    expect(g.list.join(' ')).not.toMatch(/degraded/);
  });

  it('an inventory on another clock is not used: degraded', () => {
    const g = gaps();
    const w = subWindows({ view, activation: FIX.activation, sky: null, asOf: ASOF, g, pressure: { ...inv, clock: 'vimsottari' } }, clock);
    expect(w.degraded).toBe(true);
  });

  const run = (loadPressure: (p: PrismaClient, k: string, s: string, a: string) => Promise<PressureLoad>) =>
    runSelfSubTechniques(
      {
        prisma: {
          kundli: { findUnique: async () => ({ preferred_dasha: 'dwisatpathi' }) },
          auth: { findUnique: async () => ({ date_of_birth: '1990-05-01', gender: null, role: 'novice' }) },
          personFact: { findMany: async () => [] },
        } as unknown as PrismaClient,
        loadDigest: async () => view,
        systemsPresent: async () => FIX.systems,
        activationFor: async (_p, _k, q) => FIX.activation.filter((r) => !q.systems || q.systems.includes(r.system)),
        loadTransit: async () => null,
        loadPressure,
      },
      { userId: 'u1', kundliId: 'k1', asOf: ASOF },
    );

  it('the build reads the inventory on the primary clock beside the activation', async () => {
    const asked: string[] = [];
    const out = await run(async (_p, _k, s) => (asked.push(s), { inventory: inv, source: 'stored', gaps: [] }));
    if ('status' in out) throw new Error('preparing');
    expect(asked).toEqual(['dwisatpathi']);
    expect(out.ctx.sub.windows!.degraded).toBe(false);
    expect(out.ctx.sub.risk!.rows.some((r) => r.evidence.includes('transit:Sa@2025-03-29') || r.from.windowId === 'transit:Sa@2025-03-29')).toBe(true);
    expect(out.gaps.join(' ')).not.toMatch(/windows: .*degraded/);
  });

  it('a pull that throws leaves the build in degraded mode with a gap, never a failure', async () => {
    const out = await run(async () => {
      throw new Error('engine down');
    });
    if ('status' in out) throw new Error('preparing');
    expect(out.ctx.sub.windows!.degraded).toBe(true);
    expect(out.gaps.join(' ')).toMatch(/pressure_inventory: engine down/);
    expect(Object.keys(out.ctx.sub)).toHaveLength(10);
  });
});
